import { EventEmitter } from 'node:events';
import type { Bot } from 'mineflayer';
import sinon from 'sinon';
import { Vec3 } from 'vec3';

export function createFlightBot() {
  const events = new EventEmitter();
  const physics = { gravity: 0.08 };
  const creative = {
    flyTo: sinon.stub().rejects(new Error('Do not use the uncancellable native flight loop')),
    startFlying: sinon.stub().callsFake(() => { physics.gravity = 0; }),
    stopFlying: sinon.stub().callsFake(() => { physics.gravity = 0.08; })
  };
  const bot = Object.assign(events, {
    physics, creative,
    entity: { position: new Vec3(0.5, 64, 0.5), velocity: new Vec3(0, 0, 0), width: 0.6, height: 1.8 },
    game: { gameMode: 'creative', minY: -64, height: 384 },
    clearControlStates: sinon.stub(),
    setControlState: sinon.stub(),
    pathfinder: { stop: sinon.stub(), setGoal: sinon.stub(), goto: sinon.stub().resolves() },
    blockAt: sinon.stub().callsFake((position: Vec3) => ({ name: 'air', position }))
  });
  return { bot: bot as unknown as Bot, events, physics, creative, blockAt: bot.blockAt, pathfinder: bot.pathfinder };
}

export async function pumpFlightTicks(events: EventEmitter): Promise<void> {
  // Let the MCP connection check finish before driving simulated physics.
  await new Promise<void>(resolve => setImmediate(resolve));
  for (let i = 0; i < 1000 && events.listenerCount('physicsTick'); i++) events.emit('physicsTick');
}
