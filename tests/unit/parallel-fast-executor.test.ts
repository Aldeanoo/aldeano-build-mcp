import test from 'ava';
import { EventEmitter } from 'node:events';
import type mineflayer from 'mineflayer';
import { ParallelFastExecutor, partitionFastOperations } from '../../src/build/executor/parallel-fast-executor.js';
import type { FastCommandOperation } from '../../src/build/executor/fast-command-batch.js';

test('partition splits spanning fills without duplicate or missing coordinates', t => {
  const ops: FastCommandOperation[] = [{type:'fill',from:{x:0,y:64,z:0},to:{x:9,y:64,z:0},block:'stone'}, {type:'setblock',position:{x:4,y:64,z:0},block:'glass'}];
  const sections=partitionFastOperations(ops,3);
  const cells=sections.flatMap(section=>section.filter(op=>op.type==='fill').flatMap(op=>Array.from({length:op.to.x-op.from.x+1},(_,i)=>op.from.x+i)));
  t.deepEqual(cells,[0,1,2,3,4,5,6,7,8,9]);
  t.is(sections[1][1].block,'glass');
});

function mockBot(): {bot:mineflayer.Bot; sent:string[]} {
  const emitter=new EventEmitter();const sent:string[]=[];
  const bot=Object.assign(emitter,{chat:(command:string)=>{sent.push(command);setImmediate(()=>emitter.emit('physicsTick'));}}) as unknown as mineflayer.Bot;
  return {bot,sent};
}

test('workers finish without timers and preserve per-section overwrite order',async t=>{
  const left=mockBot(),right=mockBot();
  const ops:FastCommandOperation[]=[{type:'fill',from:{x:0,y:64,z:0},to:{x:9,y:64,z:0},block:'stone'},{type:'setblock',position:{x:1,y:64,z:0},block:'glass'}];
  const result=await new ParallelFastExecutor([left.bot,right.bot]).execute(ops,{verifyAfterBuild:false});
  t.is(result.submittedCommands,3);
  t.is(result.status,'unverified');
  t.is(result.verifiedBlocks,0);
  t.true(left.sent[0].endsWith('minecraft:stone replace'));
  t.true(left.sent[1].endsWith('minecraft:glass replace'));
  t.is(right.sent.length,1);
  t.is(left.bot.listenerCount('physicsTick'),0);
  t.is(right.bot.listenerCount('end'),0);
});

test('cancel before execution submits no commands',async t=>{
  const worker=mockBot();const control=new AbortController();control.abort();
  await t.throwsAsync(new ParallelFastExecutor([worker.bot]).execute([{type:'setblock',position:{x:0,y:64,z:0},block:'stone'}],{signal:control.signal}));
  t.is(worker.sent.length,0);
});

test('disconnected worker cancels the pool and removes listeners',async t=>{
  const emitter=new EventEmitter();
  const bot=Object.assign(emitter,{chat:()=>setImmediate(()=>emitter.emit('end'))}) as unknown as mineflayer.Bot;
  await t.throwsAsync(new ParallelFastExecutor([bot]).execute([{type:'setblock',position:{x:0,y:64,z:0},block:'stone'}]));
  t.is(bot.listenerCount('physicsTick'),0);
  t.is(bot.listenerCount('end'),0);
});
