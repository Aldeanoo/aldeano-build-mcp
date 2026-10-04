import test from 'ava';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { BoundedTeleportService } from '../../src/services/bounded-teleport-service.js';
import { BuildPreflight } from '../../src/build/verification/build-preflight.js';
import { EventEmitter } from 'node:events';

function mock(occupied = false): mineflayer.Bot {
  const state = { position: new Vec3(0, 0, 0) };
  return {
    entity: state,
    game: { gameMode: 'creative', minY: -64, height: 384 },
    chat: (command: string) => { const [x, y, z] = command.split(' ').slice(2).map(Number); state.position = new Vec3(x, y, z); },
    waitForTicks: async () => {},
    waitForChunksToLoad: async () => {},
    blockAt: () => ({ name: occupied ? 'stone' : 'air' })
  } as unknown as mineflayer.Bot;
}

test('bounded self teleport confirms arrival and rejects occupied destinations', async (t) => {
  const bot = mock();
  await new BoundedTeleportService(bot).selfTo({ x: 12, y: 4, z: 20 });
  t.deepEqual(bot.entity.position, new Vec3(12.5, 4, 20.5));
  await t.throwsAsync(new BoundedTeleportService(mock(true)).selfTo({ x: 12, y: 4, z: 20 }), { message: 'Teleport destination is occupied or unavailable' });
});

test('preflight accepts direct positioning without invoking flight or walking', async (t) => {
  const bot = mock();
  const destinations: Array<{ x: number; y: number; z: number }> = [];
  const preflight = new BuildPreflight(bot, 100, 1000, async (position) => { destinations.push(position); await new BoundedTeleportService(bot).selfTo(position); });
  const result = await preflight.inspectBounds({ from: { x: 0, y: 1, z: 0 }, to: { x: 2, y: 4, z: 2 } }, 'fast');
  t.true(result.clear);
  t.is(result.scannedBlocks, 36);
  t.is(destinations.length, 2);
});

test('remote player teleport resolves an online name and waits for entity visibility',async t=>{
  const emitter=new EventEmitter();
  const commands:string[]=[];
  let arrived=false;
  const state={position:new Vec3(0,0,0)};
  const players:{Aldeano_:{entity?:{position:Vec3}}}={Aldeano_:{}};
  const bot=Object.assign(emitter,{entity:state,players,game:{gameMode:'creative'},blockAt:()=>({name:'air'}),waitForChunksToLoad:async()=>{},waitForTicks:async()=>{},chat:(command:string)=>{
    commands.push(command);
    if(!arrived){arrived=true;setTimeout(()=>{state.position=new Vec3(100,66,100);emitter.emit('forcedMove');setTimeout(()=>{players.Aldeano_.entity={position:new Vec3(100,64,100)};},20);},0);}
  }}) as unknown as mineflayer.Bot;
  await new BoundedTeleportService(bot,1000).selfToPlayer('aldeano_');
  t.is(commands.length,9);
  t.true(commands.every(command=>command.includes('at Aldeano_ positioned ~ ~2 ~ if block')));
  t.is(emitter.listenerCount('forcedMove'),0);
  t.is(emitter.listenerCount('end'),0);
  await t.throwsAsync(new BoundedTeleportService(bot).selfToPlayer('Aldeano_;kill'),{message:'Invalid player name'});
});
