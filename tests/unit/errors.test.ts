import test from 'ava';
import {
  AldeanoError,
  MinecraftConnectionError,
  MovementError,
  BlockPlacementError,
  InventoryError,
  TimeoutError,
  ValidationError,
  UnsupportedVersionError,
  CraftingError,
  EntityError,
} from '../../src/errors/index.js';

test('AldeanoError sets name, code, message, context, and timestamp', (t) => {
  const context = { server: 'localhost', port: 25565 };
  const err = new AldeanoError('Something failed', 'CUSTOM_CODE', context);

  t.true(err instanceof Error);
  t.true(err instanceof AldeanoError);
  t.is(err.name, 'AldeanoError');
  t.is(err.message, 'Something failed');
  t.is(err.code, 'CUSTOM_CODE');
  t.deepEqual(err.context, context);
  t.regex(err.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

  const json = err.toJSON();
  t.is(json.name, 'AldeanoError');
  t.is(json.message, 'Something failed');
  t.is(json.code, 'CUSTOM_CODE');
  t.deepEqual(json.context, context);
  t.is(json.timestamp, err.timestamp);
});

test('AldeanoError has default code and empty context when not provided', (t) => {
  const err = new AldeanoError('Generic error');

  t.is(err.code, 'ALDEANO_ERROR');
  t.deepEqual(err.context, {});
});

test('MinecraftConnectionError initializes correctly', (t) => {
  const err = new MinecraftConnectionError('Failed to connect to host', { host: 'mc.example.com' });

  t.true(err instanceof Error);
  t.true(err instanceof AldeanoError);
  t.true(err instanceof MinecraftConnectionError);
  t.is(err.code, 'MINECRAFT_CONNECTION_ERROR');
  t.is(err.message, 'Failed to connect to host');
  t.deepEqual(err.context, { host: 'mc.example.com' });
});

test('MovementError initializes correctly', (t) => {
  const err = new MovementError('Path unreachable', { target: { x: 10, y: 64, z: 20 } });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof MovementError);
  t.is(err.code, 'MOVEMENT_ERROR');
  t.is(err.message, 'Path unreachable');
});

test('BlockPlacementError initializes correctly', (t) => {
  const err = new BlockPlacementError('Block placement obstructed', { block: 'stone' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof BlockPlacementError);
  t.is(err.code, 'BLOCK_PLACEMENT_ERROR');
  t.is(err.message, 'Block placement obstructed');
});

test('InventoryError initializes correctly', (t) => {
  const err = new InventoryError('Item not found in inventory', { item: 'diamond' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof InventoryError);
  t.is(err.code, 'INVENTORY_ERROR');
  t.is(err.message, 'Item not found in inventory');
});

test('TimeoutError initializes correctly', (t) => {
  const err = new TimeoutError('Pathfinding timed out after 30000ms', { timeoutMs: 30000 });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof TimeoutError);
  t.is(err.code, 'TIMEOUT_ERROR');
  t.is(err.message, 'Pathfinding timed out after 30000ms');
});

test('ValidationError initializes correctly', (t) => {
  const err = new ValidationError('Invalid coordinate values', { field: 'x' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof ValidationError);
  t.is(err.code, 'VALIDATION_ERROR');
  t.is(err.message, 'Invalid coordinate values');
});

test('UnsupportedVersionError initializes correctly', (t) => {
  const err = new UnsupportedVersionError('Minecraft version 1.12.2 is unsupported', { version: '1.12.2' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof UnsupportedVersionError);
  t.is(err.code, 'UNSUPPORTED_VERSION_ERROR');
  t.is(err.message, 'Minecraft version 1.12.2 is unsupported');
});

test('CraftingError initializes correctly', (t) => {
  const err = new CraftingError('Missing crafting table', { item: 'iron_pickaxe' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof CraftingError);
  t.is(err.code, 'CRAFTING_ERROR');
  t.is(err.message, 'Missing crafting table');
});

test('EntityError initializes correctly', (t) => {
  const err = new EntityError('Entity not found', { entityType: 'cow' });

  t.true(err instanceof AldeanoError);
  t.true(err instanceof EntityError);
  t.is(err.code, 'ENTITY_ERROR');
  t.is(err.message, 'Entity not found');
});
