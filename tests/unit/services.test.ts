import test from 'ava';
import mineflayer from 'mineflayer';
import { EventEmitter } from 'node:events';
import { Vec3 } from 'vec3';
import { MessageStore } from '../../src/message-store.js';
import {
  MovementService,
  BlocksService,
  InventoryService,
  WorldService,
  ChatService
} from '../../src/services/index.js';
import { BlockPlacementError, InventoryError } from '../../src/errors/index.js';

function createMockBot(overrides: Record<string, unknown> = {}): mineflayer.Bot {
  const emitter = new EventEmitter();
  const mockBot = Object.assign(emitter, {
    version: '1.20.4',
    username: 'ServiceTestBot',
    entity: {
      position: new Vec3(10.5, 64.0, 20.5),
      yaw: 0,
      pitch: 0
    },
    inventory: {
      items: () => [
        { name: 'iron_ingot', count: 5, slot: 36 },
        { name: 'oak_log', count: 12, slot: 37 }
      ]
    },
    entities: {
      '1': {
        name: 'cow',
        type: 'mob',
        position: new Vec3(15, 64, 20)
      }
    },
    game: {
      gameMode: 'creative'
    },
    pathfinder: {
      goto: async () => {},
      stop: () => {},
      setMovements: () => {}
    },
    blockAt: (pos: Vec3) => {
      if (pos.y < 64) {
        return { name: 'stone', type: 1, position: pos };
      }
      return { name: 'air', type: 0, position: pos };
    },
    canSeeBlock: () => true,
    canDigBlock: () => true,
    lookAt: async () => {},
    dig: async () => {},
    placeBlock: async () => {},
    findBlock: () => null,
    findBlocks: () => [new Vec3(10, 63, 20)],
    recipesFor: () => [],
    craft: async () => {},
    equip: async () => {},
    chat: () => {},
    setControlState: () => {},
    clearControlStates: () => {},
    quit: () => {},
    ...overrides
  });

  return mockBot as unknown as mineflayer.Bot;
}

test('MovementService getPosition returns floored coordinates', (t) => {
  const bot = createMockBot();
  const movement = new MovementService(() => bot);

  const pos = movement.getPosition();
  t.is(pos.x, 10);
  t.is(pos.y, 64);
  t.is(pos.z, 20);
});

test('MovementService stop clears control states and stops pathfinder', (t) => {
  let stopCalled = false;
  let clearCalled = false;
  const bot = createMockBot({
    pathfinder: {
      stop: () => { stopCalled = true; },
      goto: async () => {},
      setMovements: () => {}
    },
    clearControlStates: () => { clearCalled = true; }
  });

  const movement = new MovementService(() => bot);
  movement.stop();

  t.true(stopCalled);
  t.true(clearCalled);
});

test('BlocksService getBlockInfo returns block details', (t) => {
  const bot = createMockBot();
  const blocks = new BlocksService(() => bot);

  const info = blocks.getBlockInfo(10, 60, 20);
  t.truthy(info);
  t.is(info?.name, 'stone');
  t.is(info?.type, 1);
});

test('BlocksService placeBlock throws error when attempting to place inside bot', async (t) => {
  const bot = createMockBot();
  const blocks = new BlocksService(() => bot);

  await t.throwsAsync(
    async () => blocks.placeBlock(10, 64, 20),
    { instanceOf: BlockPlacementError, message: /standing or one block above/ }
  );
});

test('InventoryService listInventory and findItem return items correctly', (t) => {
  const bot = createMockBot();
  const inventory = new InventoryService(() => bot);

  const result = inventory.listInventory();
  t.is(result.items.length, 2);
  t.is(result.items[0].name, 'iron_ingot');

  const iron = inventory.findItem('iron_ingot');
  t.truthy(iron);
  t.is(iron?.count, 5);

  const diamond = inventory.findItem('diamond');
  t.is(diamond, null);
});

test('InventoryService equipItem throws InventoryError if item not present', async (t) => {
  const bot = createMockBot();
  const inventory = new InventoryService(() => bot);

  await t.throwsAsync(
    async () => inventory.equipItem('diamond_sword'),
    { instanceOf: InventoryError, message: /not found in inventory/ }
  );
});

test('WorldService detects gamemode and finds entities', (t) => {
  const bot = createMockBot();
  const world = new WorldService(() => bot);

  t.is(world.detectGamemode(), 'creative');

  const cow = world.findEntity('cow');
  t.truthy(cow);
  t.is(cow?.name, 'cow');
  t.is(cow?.type, 'mob');

  const zombie = world.findEntity('zombie');
  t.is(zombie, null);
});

test('ChatService sends messages and reads from MessageStore', (t) => {
  let sentMessage = '';
  const bot = createMockBot({
    chat: (msg: string) => { sentMessage = msg; }
  });
  const store = new MessageStore();
  store.addMessage('Player1', 'Hello bot');

  const chat = new ChatService(() => bot, store);
  const sendRes = chat.sendChat('Hello player');
  t.true(sendRes.success);
  t.is(sentMessage, 'Hello player');

  const recent = chat.readChat(5);
  t.is(recent.length, 1);
  t.is(recent[0].username, 'Player1');
  t.is(recent[0].content, 'Hello bot');
});
