import test from 'ava';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { BuildService } from '../../src/build/build-service.js';
import { buildWall } from '../../src/build/primitives/wall.js';
import { BuildPreflightError, BuildPreflight } from '../../src/build/verification/build-preflight.js';
import { ParallelFastExecutor } from '../../src/build/executor/parallel-fast-executor.js';
import { WorldApiService } from '../../src/world/world-service.js';
import { buildRoofDetailed } from '../../src/build/primitives/roof.js';
import { BoundedTeleportService } from '../../src/services/bounded-teleport-service.js';
import { BuildCompletionService } from '../../src/build/verification/build-completion.js';
import { operationsPlan } from '../../src/build/executor/parallel-fast-executor.js';
import { FastCommandBatch } from '../../src/build/executor/fast-command-batch.js';

const { pathfinder } = pathfinderPkg;
const enabled = process.env.RUN_MINECRAFT_TESTS === 'true';

if (!enabled) {
  test('Build engine live integration (SKIPPED)', (t) => t.pass('Set RUN_MINECRAFT_TESTS=true to run against a creative server.'));
} else {
  test.serial('build -> verify fault -> repair diff -> verify 100%', async (t) => {
    t.timeout(60_000);
    const host = process.env.MC_HOST ?? '127.0.0.1';
    const port = Number(process.env.MC_PORT ?? 9999);
    const bot = mineflayer.createBot({ host, port, username: process.env.MC_USERNAME ?? 'BenchmarkBot', plugins: { pathfinder } });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out connecting to ${host}:${port}`)), 15_000);
        bot.once('spawn', () => { clearTimeout(timer); resolve(); });
        bot.once('error', (error) => { clearTimeout(timer); reject(error); });
        bot.once('kicked', (reason) => { clearTimeout(timer); reject(new Error(`Kicked: ${JSON.stringify(reason)}`)); });
      });
      await bot.waitForChunksToLoad();
      await bot.waitForTicks(2);
      const start = bot.entity.position.floored().offset(5, 0, 12);
      const end = start.offset(9, 0, 0);
      const placements = buildWall(start, end, 5, 'stone_bricks');
      const service = new BuildService(bot, { mode: 'fast', fastModeEnabled: true, fastCommandIntervalMs: 20, concurrency: 1, verify: true, autoRepair: true });
      const result = await service.executePlacements('repair-integration', placements, 'fast');
      t.true(result.success);
      t.is(result.verification?.accuracy, 1);
      t.true(result.preflight?.clear);
      t.is(result.preflight?.scannedBlocks, 50);

      const occupied = await t.throwsAsync(service.executePlacements('occupied-site', placements, 'fast', { verifyAfterBuild: false }));
      t.true(occupied instanceof BuildPreflightError);
      t.is((occupied as BuildPreflightError).code, 'SITE_OCCUPIED');

      const fault = start.offset(4, 2, 0);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          bot.removeListener('blockUpdate', onUpdate);
        };
        const onUpdate: mineflayer.BotEvents['blockUpdate'] = (_previous, current) => {
          if (current?.position.equals(fault) && current.name === 'dirt') {
            cleanup();
            resolve();
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`No dirt block update received at ${fault} within 5s`));
        }, 5000);
        bot.on('blockUpdate', onUpdate);
        bot.chat(`/setblock ${fault.x} ${fault.y} ${fault.z} minecraft:dirt replace`);
      });
      const damaged = service.verify(result.buildId);
      t.is(damaged.incorrect, 1);
      t.is(damaged.accuracy, 49 / 50);

      const repaired = await service.repair(result.buildId);
      t.is(repaired.status, 'COMPLETED');
      t.is(repaired.repaired, 1);
      t.is(repaired.verification.accuracy, 1);

      const scan = new WorldApiService(bot, 1_000).scanRegion({ x: fault.x, y: fault.y, z: fault.z }, 1);
      t.is(scan.detail, 'summary');
      t.true((scan.palette.stone_bricks ?? 0) > 0);

      await service.clearRegion({ from: start, to: end.offset(0, 4, 0) }, 'fast');
      const withoutValidation = await service.executePlacements('no-post-validation', placements, 'fast', { verifyAfterBuild: false });
      t.false(withoutValidation.success);
      t.is(withoutValidation.status,'unverified');
      t.is(withoutValidation.verification, undefined);
      t.true(withoutValidation.preflight?.clear);
      await service.clearRegion({ from: start, to: end.offset(0, 4, 0) }, 'fast');

      const worker=mineflayer.createBot({host,port,username:'ParallelTestBot',plugins:{pathfinder}});
      try {
        await new Promise<void>((resolve,reject)=>{worker.once('spawn',resolve);worker.once('error',reject);worker.once('kicked',reason=>reject(new Error(String(reason))));});
        await worker.waitForChunksToLoad();
        const parallel=await new ParallelFastExecutor([bot,worker]).execute([{type:'fill',from:start,to:end.offset(0,4,0),block:'stone_bricks'}]);
        t.is(parallel.submittedCommands,2);
        await bot.waitForTicks(4);
        t.is(service.verify(result.buildId).accuracy,1);
      } finally {worker.quit();await service.clearRegion({from:start,to:end.offset(0,4,0)},'fast');}
    } finally {
      bot.quit();
    }
  });
  test.serial('creative TP -> closed stair roof -> 6000 exact parallel blocks',async t=>{
    t.timeout(90_000);
    const bot=mineflayer.createBot({host:process.env.MC_HOST??'127.0.0.1',port:Number(process.env.MC_PORT??9999),username:'BenchmarkBot',plugins:{pathfinder}});
    const cleanup:Array<{from:{x:number;y:number;z:number};to:{x:number;y:number;z:number}}>=[];
    const service=new BuildService(bot,{mode:'fast',fastModeEnabled:true,fastCommandIntervalMs:20,concurrency:1,checkpointDirectory:false});
    try{
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Integration spawn timed out')),15000);bot.once('spawn',()=>{clearTimeout(timer);resolve();});bot.once('error',reject);});
      await bot.waitForChunksToLoad();
      const base=bot.entity.position.floored().offset(24,12,28);
      await new BoundedTeleportService(bot).selfTo({x:base.x-3,y:base.y+8,z:base.z});
      t.true(bot.entity.position.distanceTo(base.offset(-3,8,0))<1.5);
      const roof=buildRoofDetailed(base,base.offset(8,0,6),'oak_stairs',{ridgeBlock:'oak_planks',gableBlock:'oak_planks'});
      cleanup.push({from:base,to:base.offset(8,4,6)});
      const built=await service.executePlacements('closed-roof-live',roof,'fast',{verifyAfterBuild:true,expectedBlocks:roof.length});
      t.true(built.success);t.is(built.verifiedBlocks,roof.length);
      const block=roof.find(b=>b.state?.facing)!;
      bot.chat(`/setblock ${block.position.x} ${block.position.y} ${block.position.z} minecraft:oak_stairs[facing=west] replace`);await bot.waitForTicks(4);
      const damaged=await service.verifyAsync(built.buildId);t.true(damaged.incorrect>0);
      const repaired=await service.repair(built.buildId);t.is(repaired.status,'COMPLETED');
      const box={from:{x:base.x+20,y:base.y,z:base.z},to:{x:base.x+49,y:base.y+9,z:base.z+19}};cleanup.push(box);
      const ops=[{type:'fill' as const,...box,block:'stone_bricks'}];
      // One coordinator inspects every position before the worker receives commands.
      await new BuildPreflight(bot,10000,30000,undefined,true).inspectBounds(box,'fast');
      const result=await new ParallelFastExecutor([bot]).execute(ops,{commandsPerTick:2});
      t.is(result.expectedBlocks,6000);t.is(result.verifiedBlocks,6000);t.is(result.status,'completed');
      const final=await new BuildCompletionService(bot).verify(operationsPlan(ops),{mode:'fast'});t.is(final.correct,6000);t.is(final.unreachable,0);
    }finally{
      for(const bounds of cleanup)try{await new FastCommandBatch(bot,0,1).execute([{type:'fill',...bounds,block:'air'}]);await bot.waitForTicks(4);}catch{/* isolated test world only */}
      bot.quit();
    }
  });
}
