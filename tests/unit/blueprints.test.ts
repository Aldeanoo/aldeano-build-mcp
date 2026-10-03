import test from 'ava';
import { BlueprintParser } from '../../src/blueprints/blueprint-parser.js';
import { BlueprintTransformer } from '../../src/blueprints/blueprint-transform.js';
import { BlueprintValidator } from '../../src/blueprints/blueprint-validator.js';
import { BuildPlanner } from '../../src/build/planner/build-planner.js';
import type { InternalBlueprint } from '../../src/blueprints/blueprint.js';

const sample: InternalBlueprint = {
  version: 1, name: 'sample', size: { x: 2, y: 2, z: 3 },
  blocks: [
    { x: 0, y: 0, z: 0, block: 'stone', category: 'foundation', section: 'base' },
    { x: 1, y: 1, z: 2, block: 'torch', state: { facing: 'north' }, dependsOn: [{ x: 0, y: 0, z: 0 }], section: 'decor' }
  ]
};

test('parser accepts the versioned internal format', (t) => {
  t.deepEqual(new BlueprintParser().parse(JSON.stringify(sample)), sample);
});

test('rotate90 changes dimensions, coordinates and facing', (t) => {
  const rotated = new BlueprintTransformer().rotate90(sample);
  t.deepEqual(rotated.size, { x: 3, y: 2, z: 2 });
  t.deepEqual({ x: rotated.blocks[1].x, z: rotated.blocks[1].z }, { x: 0, z: 1 });
  t.is(rotated.blocks[1].state?.facing, 'east');
  t.deepEqual(rotated.blocks[1].dependsOn?.[0], { x: 2, y: 0, z: 0 });
});

test('validator rejects duplicate and out-of-bounds blocks', (t) => {
  const invalid: InternalBlueprint = { ...sample, blocks: [...sample.blocks, { x: 0, y: 0, z: 0, block: 'stone' }, { x: 9, y: 0, z: 0, block: 'stone' }] };
  const result = new BlueprintValidator({ maxBlocks: 100, maxScanBlocks: 100, maxDimension: 20, maxQueue: 100 }, '1.20.4').validate(invalid);
  t.false(result.valid);
  t.true(result.errors.some((error) => error.includes('Duplicate')));
  t.true(result.errors.some((error) => error.includes('outside')));
});

test('planner translates relative coordinates and preserves dependency order', (t) => {
  const plan = new BuildPlanner().plan(sample, { x: 100, y: 64, z: -20 });
  t.deepEqual(plan.blocks[0].position, { x: 100, y: 64, z: -20 });
  t.is(plan.blocks[1].dependencies[0], 0);
  t.deepEqual(plan.materials, { stone: 1, torch: 1 });
});
