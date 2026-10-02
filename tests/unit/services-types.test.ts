import test from 'ava';
import {
  type ActionResult,
  type MovementResult,
  type BlockActionResult,
  type BlockInfoResult,
  type InventoryResult,
  createActionResult,
  createMovementResult,
  createBlockActionResult,
  createBlockInfoResult,
  createInventoryResult,
} from '../../src/services/index.js';

test('createActionResult builds valid ActionResult structure', (t) => {
  const result: ActionResult<{ blockCount: number }> = createActionResult(
    'dig',
    true,
    { blockCount: 1 },
    undefined,
    150
  );

  t.is(result.action, 'dig');
  t.true(result.success);
  t.deepEqual(result.data, { blockCount: 1 });
  t.is(result.durationMs, 150);
  t.is(result.error, undefined);
});

test('createActionResult builds failed action with error', (t) => {
  const result = createActionResult('place', false, undefined, 'Block obstructed');

  t.is(result.action, 'place');
  t.false(result.success);
  t.is(result.error, 'Block obstructed');
  t.is(result.data, undefined);
});

test('createMovementResult builds structured MovementResult', (t) => {
  const position = { x: 100, y: 64, z: -200 };
  const result: MovementResult = createMovementResult('walk', position, true, 320);

  t.is(result.action, 'walk');
  t.true(result.success);
  t.deepEqual(result.position, position);
  t.is(result.durationMs, 320);
});

test('createBlockActionResult builds structured BlockActionResult', (t) => {
  const position = { x: 10, y: 60, z: 10 };
  const result: BlockActionResult = createBlockActionResult('place-block', position, 'oak_planks', true, 80);

  t.is(result.action, 'place-block');
  t.true(result.success);
  t.deepEqual(result.position, position);
  t.is(result.block, 'oak_planks');
  t.is(result.durationMs, 80);
});

test('createBlockInfoResult builds structured BlockInfoResult', (t) => {
  const block = {
    name: 'diamond_ore',
    position: { x: 12, y: -58, z: 30 },
    hardness: 3,
    boundingBox: 'block',
  };

  const result: BlockInfoResult = createBlockInfoResult(block, true);

  t.true(result.success);
  t.deepEqual(result.block, block);
  t.is(result.block.name, 'diamond_ore');
  t.is(result.block.hardness, 3);
});

test('createInventoryResult builds structured InventoryResult', (t) => {
  const items = [
    { name: 'iron_ingot', count: 32, slot: 0 },
    { name: 'torch', count: 64, slot: 1 },
  ];

  const result: InventoryResult = createInventoryResult(items, true);

  t.true(result.success);
  t.is(result.items.length, 2);
  t.deepEqual(result.items, items);
});
