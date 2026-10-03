import test from 'ava';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BuildService } from '../../src/build/build-service.js';
import { placementPlan } from '../../src/build/planner/placement-plan.js';
import { StructureVerifier, isVerificationComplete } from '../../src/build/verification/structure-verifier.js';
import { StructureRepair } from '../../src/build/verification/structure-repair.js';
import { ParallelFastExecutor, operationsPlan } from '../../src/build/executor/parallel-fast-executor.js';
import { buildRoofDetailed } from '../../src/build/primitives/roof.js';
import { validateDesign } from '../../src/build/verification/design-validator.js';
import { buildBox } from '../../src/build/primitives/box.js';
import { buildBot } from '../fixtures/build-bot.js';
import { BoundedTeleportService } from '../../src/services/bounded-teleport-service.js';
import { BlueprintTransformer } from '../../src/blueprints/blueprint-transform.js';
import type { InternalBlueprint } from '../../src/blueprints/blueprint.js';
import { parseDesignRequirements } from '../../src/build/verification/design-validator.js';

const config={mode:'fast' as const,fastModeEnabled:true,fastCommandIntervalMs:0,concurrency:1,checkpointDirectory:false as const};
const single=[{position:{x:1,y:64,z:1},block:'stone'}];

test('blueprint transforms preserve relative roof, support and opening contracts', t => {
  const blueprint:InternalBlueprint={version:1,name:'contracts',size:{x:4,y:3,z:6},blocks:[{x:1,y:2,z:3,block:'stone'}],metadata:{design:{requiredSupports:[{x:1,y:2,z:3}],requiredAir:[{x:2,y:1,z:3}],roofBaseY:2,roofBounds:{from:{x:0,y:2,z:0},to:{x:3,y:2,z:5}}}}};
  const transformer=new BlueprintTransformer();
  for(const transformed of [transformer.translate(blueprint,5,10,8),transformer.rotate90(blueprint),transformer.rotate180(blueprint),transformer.rotate270(blueprint),transformer.mirrorX(blueprint),transformer.mirrorZ(blueprint)]){
    const design=parseDesignRequirements(transformed.metadata?.design)!,block=transformed.blocks[0];
    t.deepEqual(design.requiredSupports,[{x:block.x,y:block.y,z:block.z}]);
    t.true(design.roofBounds!.from.x<=design.roofBounds!.to.x);t.is(design.roofBaseY,block.y);
  }
  t.throws(()=>validateDesign(single,{roofBounds:{from:{x:0,y:0,z:0},to:{x:10000,y:70,z:10000}}}));
  t.throws(()=>validateDesign(single,{roofBounds:{from:{x:10,y:0,z:0},to:{x:0,y:70,z:1}}}));
});

test('a blocked planned opening is verified and repaired even when all solid blocks match', async t => {
  const mock = buildBot(), plan = placementPlan('opening', [...single, { position: { x: 3, y: 64, z: 1 }, block: 'stone' }]);
  plan.requiredAir = [{ x: 2, y: 64, z: 1 }];
  mock.write(1,64,1,'stone'); mock.write(3,64,1,'stone'); mock.write(2,64,1,'dirt');
  const verifier = new StructureVerifier(mock.bot), checked = await verifier.verifyAsync(plan);
  t.is(checked.correct,2); t.is(checked.extra,1); t.false(isVerificationComplete(checked));
  const fixed = await new StructureRepair(verifier).repair(plan, { mode: 'fast', place: async block => { mock.write(block.position.x,block.position.y,block.position.z,block.block); } }, 1);
  t.is(fixed.status,'COMPLETED'); t.is(fixed.repaired,1);
});

test('malformed or oversized later operations cannot partially modify the world', async t => {
  const mock = buildBot();
  await t.throwsAsync(new ParallelFastExecutor([mock.bot]).execute([{ type:'setblock', ...single[0] }, {type:'fill',from:{x:0,y:0,z:0},to:{x:40,y:40,z:40},block:'stone'}]));
  t.is(mock.sent.length,0);
  t.throws(()=>operationsPlan([{type:'setblock',...single[0]}],NaN));
});

test('a failed initial preflight checkpoint cannot bypass preflight through recovery', async t => {
  const directory=mkdtempSync(path.join(os.tmpdir(),'aldeano-checkpoint-'));t.teardown(()=>rmSync(directory,{recursive:true,force:true}));
  const mock=buildBot(); mock.write(1,64,1,'stone');
  const first=new BuildService(mock.bot,{...config,checkpointDirectory:directory});
  await t.throwsAsync(first.executePlacements('occupied',single,'fast'));
  const saved=first.listCheckpoints()[0];
  t.truthy(saved); await t.throwsAsync(new BuildService(mock.bot,{...config,checkpointDirectory:directory}).recover(saved.id));
  t.is(mock.sent.filter(c=>c.startsWith('/setblock')).length,0);
});

test('typed teleport fails safely on denied permission, survival and cancellation', async t => {
  const mock=buildBot(); mock.bot.chat=()=>{};
  await t.throwsAsync(new BoundedTeleportService(mock.bot,10).selfTo({x:20,y:70,z:20}));
  t.is(mock.bot.listenerCount('forcedMove'),0); t.is(mock.bot.listenerCount('end'),0);
  mock.bot.game.gameMode='survival'; await t.throwsAsync(new BoundedTeleportService(mock.bot).selfTo({x:20,y:70,z:20}));
  mock.bot.game.gameMode='creative';const controller=new AbortController();controller.abort();
  // DOMException is not recognized as Error by AVA on every supported Node version.
  const cancelled = await new BoundedTeleportService(mock.bot).selfTo({x:20,y:70,z:20},controller.signal).then(() => undefined, (reason: unknown) => reason);
  t.is(cancelled, controller.signal.reason);
});

test('6000 unique planned blocks require 6000 exact world matches',async t=>{
  const mock=buildBot(),service=new BuildService(mock.bot,config);
  const blocks=buildBox({x:0,y:64,z:0},{x:29,y:73,z:19},'stone');
  const result=await service.executePlacements('6000',blocks,'fast',{expectedBlocks:6000,verifyAfterBuild:true});
  t.true(result.success);t.is(result.requestedBlocks,6000);t.is(result.verifiedBlocks,6000);t.is(result.pendingBlocks,0);
  t.is(service.getProgress(result.buildId)?.progress,1);
});
test('declared count mismatch is rejected before placement',async t=>{
  const mock=buildBot();await t.throwsAsync(new BuildService(mock.bot,config).executePlacements('count',single,'fast',{expectedBlocks:6000}));
  t.is(mock.sent.length,0);
});
test('rejected commands cannot produce a completed result or 100 percent progress',async t=>{
  const mock=buildBot();mock.setDropAll(true);const service=new BuildService(mock.bot,config);
  const result=await service.executePlacements('rejected',single,'fast',{verifyAfterBuild:true,autoRepair:false});
  t.false(result.success);t.is(result.status,'partial');t.is(result.placedBlocks,0);t.is(result.submittedBlocks,1);t.is(result.pendingBlocks,1);t.is(service.getProgress(result.buildId)?.progress,0);
});
test('disabled verification reports unverified and does not claim placed blocks',async t=>{
  const mock=buildBot();const result=await new BuildService(mock.bot,config).executePlacements('unchecked',single,'fast',{verifyAfterBuild:false});
  t.false(result.success);t.is(result.status,'unverified');t.is(result.placedBlocks,0);t.is(result.submittedBlocks,1);
});
test('repair places only the lost block and confirms its final state',async t=>{
  const mock=buildBot();mock.setDropped(1);const result=await new BuildService(mock.bot,config).executePlacements('repair',single,'fast',{verifyAfterBuild:true});
  t.true(result.success);t.is(result.repair?.repaired,1);t.is(mock.sent.filter(c=>c.startsWith('/setblock')).length,2);
});
test('inline stair states and unavailable properties are not silently accepted',t=>{
  const mock=buildBot();mock.write(1,64,1,'oak_stairs[facing=west]');
  const plan=placementPlan('states',[{...single[0],block:'oak_stairs[facing=east]'}]);
  const result=new StructureVerifier(mock.bot).verify(plan);
  t.is(result.correct,0);t.is(result.differences[0].type,'WRONG_STATE');
});
test('unloaded positions remain pending and are not blindly repaired',async t=>{
  const mock=buildBot();mock.unreadable.add('1,64,1');const plan=placementPlan('unreadable',single);
  const verifier=new StructureVerifier(mock.bot),repair=await new StructureRepair(verifier).repair(plan,{mode:'fast',place:async()=>t.fail('unreadable position must not be written')},2);
  t.is(repair.status,'PARTIAL');t.is(repair.verification.unreachable,1);
});
test('sector verification loads each region before reading it',async t=>{
  const mock=buildBot(),plan=placementPlan('sectors',[...single,{position:{x:80,y:64,z:1},block:'stone'}]);
  mock.unreadable.add('1,64,1');mock.unreadable.add('80,64,1');let visits=0;
  const checked=await new StructureVerifier(mock.bot).verifyAsync(plan,{beforeSection:async bounds=>{visits++;for(const b of plan.blocks)if(b.position.x>=bounds.from.x&&b.position.x<=bounds.to.x){mock.unreadable.delete(b.position.x+',64,1');mock.write(b.position.x,64,1,'stone');}}});
  t.is(visits,2);t.true(isVerificationComplete(checked));
});
test('extra blocks and unreadable interior cannot be considered complete',t=>{
  const mock=buildBot();mock.write(1,64,1,'stone');mock.write(3,64,1,'stone');mock.write(2,64,1,'dirt');
  const plan=placementPlan('extras',[...single,{position:{x:3,y:64,z:1},block:'stone'}]);
  const verifier=new StructureVerifier(mock.bot),checked=verifier.verify(plan,true);
  t.is(checked.accuracy,1);t.false(isVerificationComplete(checked));
  mock.unreadable.add('2,64,1');t.is(verifier.verify(plan,true).unreachable,1);
});
test('checkpoint recovery rereads the world and submits only missing coordinates',async t=>{
  const directory=mkdtempSync(path.join(os.tmpdir(),'aldeano-checkpoint-'));t.teardown(()=>rmSync(directory,{recursive:true,force:true}));
  const mock=buildBot();mock.setDropped(1);
  const first=await new BuildService(mock.bot,{...config,checkpointDirectory:directory}).executePlacements('recover',[...single,{position:{x:2,y:64,z:1},block:'stone'}],'fast',{verifyAfterBuild:true,autoRepair:false});
  t.is(first.status,'partial');const before=mock.sent.filter(c=>c.startsWith('/setblock')).length;
  const second=await new BuildService(mock.bot,{...config,checkpointDirectory:directory}).recover(first.buildId);
  t.is(second.buildId,first.buildId);t.true(second.success);t.is(mock.sent.filter(c=>c.startsWith('/setblock')).length-before,1);
});
test('resume rejects foreign blocks in the saved construction volume',async t=>{
  const directory=mkdtempSync(path.join(os.tmpdir(),'aldeano-checkpoint-'));t.teardown(()=>rmSync(directory,{recursive:true,force:true}));
  const mock=buildBot();const first=await new BuildService(mock.bot,{...config,checkpointDirectory:directory}).executePlacements('site',single,'fast',{verifyAfterBuild:true});
  mock.write(1,64,1,'diamond_block');const before=mock.sent.filter(c=>c.startsWith('/setblock')).length;
  await t.throwsAsync(new BuildService(mock.bot,{...config,checkpointDirectory:directory}).recover(first.buildId));t.is(mock.sent.filter(c=>c.startsWith('/setblock')).length,before);
});
test('checkpoint tampering and another server are rejected',async t=>{
  const directory=mkdtempSync(path.join(os.tmpdir(),'aldeano-checkpoint-'));t.teardown(()=>rmSync(directory,{recursive:true,force:true}));
  const mock=buildBot();const result=await new BuildService(mock.bot,{...config,checkpointDirectory:directory}).executePlacements('saved',single,'fast',{verifyAfterBuild:true});
  const filename=path.join(directory,result.buildId+'.json'),saved=JSON.parse(readFileSync(filename,'utf8'));
  saved.identity='another-world';writeFileSync(filename,JSON.stringify(saved));await t.throwsAsync(new BuildService(mock.bot,{...config,checkpointDirectory:directory}).recover(result.buildId));
  saved.plan.blocks[0].block='dirt';writeFileSync(filename,JSON.stringify(saved));await t.throwsAsync(new BuildService(mock.bot,{...config,checkpointDirectory:directory}).recover(result.buildId));
});
test('parallel verification uses final unique coordinates after overwrites',async t=>{
  const mock=buildBot(),ops=[{type:'fill' as const,from:{x:1,y:64,z:1},to:{x:3,y:64,z:1},block:'stone'},{type:'setblock' as const,position:{x:2,y:64,z:1},block:'glass'}];
  t.is(operationsPlan(ops).blocks.length,3);
  const result=await new ParallelFastExecutor([mock.bot]).execute(ops);t.is(result.status,'completed');t.is(result.verifiedBlocks,3);
});
test('parallel lost commands fail rather than return completed',async t=>{
  const mock=buildBot();mock.setDropAll(true);
  await t.throwsAsync(new ParallelFastExecutor([mock.bot]).execute([{type:'setblock',position:{x:1,y:64,z:1},block:'stone'}],{autoRepair:false}));
});
test('roofs cover odd and even footprints, close gables and preserve interior air',t=>{
  for(const width of [5,6])for(const axis of ['x','z'] as const){
    const blocks=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:width-1},'bricks',{axis});
    validateDesign(blocks,{roofBounds:{from:{x:0,y:70,z:0},to:{x:6,y:80,z:width-1}}});
    const middle=blocks.filter(b=>b.position.x===3&&b.position.z===2);t.is(middle.length,1);
  }
});
test('flat, hip, thickness, overhang and stairs produce deterministic covered roofs',t=>{
  for(const style of ['flat','hip','gable'] as const){
    const blocks=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:6},'oak_stairs',{style,overhang:1,thickness:2,closeEnds:false,ridgeBlock:'oak_planks'});
    validateDesign(blocks,{roofBounds:{from:{x:-1,y:70,z:-1},to:{x:7,y:80,z:7}}});
    t.true(blocks.some(b=>b.state?.facing));t.is(new Set(blocks.map(b=>JSON.stringify(b.position))).size,blocks.length);
  }
});
test('design contracts reject roof holes, absent supports, blocked openings and disconnected pieces',t=>{
  t.throws(()=>validateDesign(single,{roofBounds:{from:{x:1,y:64,z:1},to:{x:2,y:64,z:1}}}));
  t.throws(()=>validateDesign(single,{requiredSupports:[{x:2,y:64,z:1}]}));
  t.throws(()=>validateDesign(single,{requiredAir:[single[0].position]}));
  t.throws(()=>validateDesign([...single,{position:{x:4,y:64,z:1},block:'stone'}],{requireConnected:true}));
  t.throws(()=>buildRoofDetailed({x:0,y:70,z:0},{x:4,y:70,z:4},'stone',{height:20}));
});
