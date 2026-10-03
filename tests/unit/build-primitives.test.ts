import test from 'ava';
import { buildLine } from '../../src/build/primitives/line.js';
import { buildWall } from '../../src/build/primitives/wall.js';
import { buildFloor } from '../../src/build/primitives/floor.js';
import { buildBox, buildHollowBox } from '../../src/build/primitives/box.js';
import { buildCylinder } from '../../src/build/primitives/cylinder.js';
import { buildSphere } from '../../src/build/primitives/sphere.js';
import { buildRoof } from '../../src/build/primitives/roof.js';

test('build-wall creates the exact inclusive 21 by 5 wall', (t) => {
  const blocks = buildWall({ x: 0, y: 64, z: 0 }, { x: 20, y: 64, z: 0 }, 5, 'stone_bricks');
  t.is(blocks.length, 105);
  t.deepEqual(blocks[0].position, { x: 0, y: 64, z: 0 });
  t.deepEqual(blocks.at(-1)?.position, { x: 20, y: 68, z: 0 });
});

test('line is deterministic in all three axes', (t) => {
  const first = buildLine({ x: 0, y: 0, z: 0 }, { x: 4, y: 2, z: 3 }, 'stone');
  const second = buildLine({ x: 0, y: 0, z: 0 }, { x: 4, y: 2, z: 3 }, 'stone');
  t.deepEqual(first, second);
  t.is(first.length, 5);
});

test('floor and box counts are exact', (t) => {
  t.is(buildFloor({ x: 0, y: 5, z: 0 }, { x: 2, y: 9, z: 3 }, 'oak_planks').length, 12);
  t.is(buildBox({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, 'stone').length, 27);
  t.is(buildHollowBox({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, 'stone').length, 26);
});

test('round primitives and roof contain no duplicate positions', (t) => {
  for (const blocks of [
    buildCylinder({ x: 0, y: 0, z: 0 }, 4, 3, 'stone', true),
    buildSphere({ x: 0, y: 0, z: 0 }, 4, 'stone', true),
    buildRoof({ x: 0, y: 5, z: 0 }, { x: 6, y: 5, z: 5 }, 'bricks')
  ]) {
    const keys = blocks.map(({ position: p }) => `${p.x},${p.y},${p.z}`);
    t.is(new Set(keys).size, keys.length);
  }
});
