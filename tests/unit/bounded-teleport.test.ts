import test from 'ava';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { BoundedTeleportService } from '../../src/services/bounded-teleport-service.js';
import { BuildPreflight } from '../../src/build/verification/build-preflight.js';

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
