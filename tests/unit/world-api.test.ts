import test from 'ava';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { WorldApiService } from '../../src/world/world-service.js';
import { WorldScreenshotRenderer } from '../../src/world/world-screenshot.js';

function bot(): mineflayer.Bot {
  return {
    entity: { position: new Vec3(0, 64, 0) },
    entities: {},
    blockAt: (position: Vec3) => ({
      name: position.y <= 63 ? 'stone' : 'air', type: position.y <= 63 ? 1 : 0,
      position, biome: { name: 'plains' }, getProperties: () => ({})
    }),
    time: { timeOfDay: 1000, isDay: true },
    game: { gameMode: 'creative', dimension: 'overworld', difficulty: 'peaceful' },
    isRaining: false
  } as unknown as mineflayer.Bot;
}

test('scan-region defaults can return a compact summary without a block dump', (t) => {
  const result = new WorldApiService(bot(), 1_000).scanRegion({ x: 0, y: 63, z: 0 }, 1);
  t.is(result.scannedBlocks, 27);
  t.is(result.palette.stone, 18);
  t.is(result.palette.air, 9);
  t.false('blocks' in result);
});

test('scan-region enforces the configured volume limit', (t) => {
  const service = new WorldApiService(bot(), 10);
  const error = t.throws(() => service.scanRegion({ x: 0, y: 64, z: 0 }, 2));
  t.true(error?.message.includes('LIMIT') || error?.message.includes('maximum'));
});

test('heightmap rejects excess volume before reading any blocks', (t) => {
  const fake = bot();
  let reads = 0;
  fake.blockAt = () => { reads++; return null; };
  const service = new WorldApiService(fake, 10);
  t.throws(() => service.getHeightmap({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }), { message: /maximum/ });
  t.is(reads, 0);
});

test('heightmap accepts the inclusive limit and normalizes reversed corners', (t) => {
  const service = new WorldApiService(bot(), 27);
  const result = service.getHeightmap({ x: 2, y: 64, z: 2 }, { x: 0, y: 62, z: 0 });
  t.is(result.columns.length, 9);
  t.is(result.min, 63);
  t.is(result.max, 63);
});

test('world scans reject unsafe coordinates without invoking the reader', (t) => {
  const fake = bot();
  let reads = 0;
  fake.blockAt = () => { reads++; return null; };
  const service = new WorldApiService(fake);
  const point = { x: Number.MAX_SAFE_INTEGER + 1, y: 64, z: 0 };
  t.throws(() => service.getHeightmap(point, point));
  t.throws(() => service.getRegion(point, point));
  t.is(reads, 0);
});

test('world screenshot produces a valid PNG without a browser renderer', (t) => {
  const world = new WorldApiService(bot(), 1_000);
  const result = new WorldScreenshotRenderer(world).capture({ from: { x: -1, y: 62, z: -1 }, to: { x: 1, y: 64, z: 1 } }, 320, 240);
  t.deepEqual([...result.data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  t.is(result.width, 320);
  t.is(result.height, 240);
  t.true(result.renderedBlocks > 0);
});

test('scans distinguish unavailable blocks from loaded air and read each position once', (t) => {
  for (const detail of ['summary', 'compact', 'full'] as const) {
    const fake = bot();
    let reads = 0;
    fake.blockAt = () => { reads++; return null; };
    const result = new WorldApiService(fake, 27).scanRegion({ x: 0, y: 63, z: 0 }, 1, detail);
    t.is(reads, 27);
    t.is(result.scannedBlocks, 27);
    t.deepEqual(result.coverage, { version: 1, requestedBlocks: 27, readBlocks: 0, unavailableBlocks: 27, complete: false });
    t.deepEqual(result.palette, {});
    t.false(result.height.complete);
    const loaded = new WorldApiService(bot(), 27).scanRegion({ x: 0, y: 65, z: 0 }, 1, detail);
    t.true(loaded.coverage.complete);
    t.is(loaded.palette.air, 27);
    t.true(loaded.height.complete);
    t.is(loaded.height.max, null);
  }
});

test('height certainty depends on missing blocks above the observed surface', (t) => {
  for (const missingY of [62, 64]) {
    const fake = bot();
    const original = fake.blockAt.bind(fake);
    fake.blockAt = (position) => position.y === missingY ? null : original(position);
    const result = new WorldApiService(fake, 3).getHeightmap({ x: 0, y: 62, z: 0 }, { x: 0, y: 64, z: 0 });
    t.false(result.coverage.complete);
    t.is(result.coverage.readBlocks, 2);
    t.is(result.columns[0].status, 'partial');
    t.is(result.columns[0].y, 63);
    t.is(result.columns[0].heightKnown, missingY === 62);
  }
});
