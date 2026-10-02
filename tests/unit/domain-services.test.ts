import test from 'ava';
import sinon from 'sinon';
import { EventEmitter } from 'node:events';
import { Vec3 } from 'vec3';
import type mineflayer from 'mineflayer';
import { MessageStore } from '../../src/message-store.js';
import {
  createServices,
  MovementService,
  BlockService,
  InventoryService,
  CraftingService,
  FurnaceService,
  EntityService,
  ChatService,
  GameStateService
} from '../../src/services/index.js';
import {
  MovementError,
  BlockPlacementError,
  BlockDigError,
  InventoryError,
  FurnaceError,
  RecipeNotFoundError
} from '../../src/errors/index.js';

function createMockBot(overrides: Record<string, unknown> = {}): mineflayer.Bot {
  const emitter = new EventEmitter();
  const mockBot = Object.assign(emitter, {
    version: '1.20.4',
    username: 'TestBot',
    entity: {
      position: new Vec3(10.2, 64.0, 20.8),
      yaw: 0,
      pitch: 0
    },
    inventory: {
      items: () => [
        { name: 'dirt', count: 16, slot: 36 },
        { name: 'iron_ore', count: 4, slot: 37, type: 15, metadata: 0 },
        { name: 'coal', count: 8, slot: 38, type: 263, metadata: 0 }
      ]
    },
    game: {
      gameMode: 'survival'
    },
    pathfinder: {
      goto: sinon.stub().resolves(),
      stop: sinon.stub(),
      setMovements: sinon.stub()
    },
    blockAt: sinon.stub().callsFake((pos: Vec3) => {
      if (pos.x === 10 && pos.y === 64 && pos.z === 25) {
        return { name: 'furnace', type: 61, position: pos };
      }
      if (pos.y < 64) {
        return { name: 'stone', type: 1, position: pos };
      }
      return { name: 'air', type: 0, position: pos };
    }),
    canSeeBlock: sinon.stub().returns(true),
    canDigBlock: sinon.stub().returns(true),
    lookAt: sinon.stub().resolves(),
    dig: sinon.stub().resolves(),
    placeBlock: sinon.stub().resolves(),
    findBlock: sinon.stub().callsFake(({ matching }: { matching: unknown }) => {
      if (Array.isArray(matching) || typeof matching === 'number') {
        return { name: 'furnace', position: new Vec3(10, 64, 25) };
      }
      return null;
    }),
    findBlocks: sinon.stub().returns([new Vec3(10, 63, 20)]),
    openFurnace: sinon.stub().callsFake(async () => {
      const furnaceEmitter = new EventEmitter();
      return Object.assign(furnaceEmitter, {
        inputItem: () => null,
        fuelItem: () => null,
        outputItem: () => ({ name: 'iron_ingot', count: 1 }),
        putInput: sinon.stub().resolves(),
        putFuel: sinon.stub().resolves(),
        takeOutput: sinon.stub().resolves({ name: 'iron_ingot', count: 1 }),
        close: sinon.stub()
      });
    }),
    nearestEntity: sinon.stub().callsFake((filter: (e: unknown) => boolean) => {
      const cow = { name: 'cow', type: 'mob', position: new Vec3(12, 64, 20) };
      return filter(cow) ? cow : null;
    }),
    equip: sinon.stub().resolves(),
    chat: sinon.stub(),
    setControlState: sinon.stub(),
    clearControlStates: sinon.stub(),
    ...overrides
  });

  return mockBot as unknown as mineflayer.Bot;
}

test('MovementService getPosition and lookAt', async (t) => {
  const bot = createMockBot();
  const service = new MovementService(bot);

  const pos = service.getPosition();
  t.is(pos.x, 10);
  t.is(pos.y, 64);
  t.is(pos.z, 20);

  const lookResult = await service.lookAt(15, 65, 25);
  t.true(lookResult.success);
  t.true(lookResult.message.includes('15, 65, 25'));
});

test('MovementService moveToPosition resolves and handles errors', async (t) => {
  const bot = createMockBot();
  const service = new MovementService(bot);

  const res = await service.moveToPosition(12, 64, 22);
  t.true(res.success);
  t.true(res.message.includes('12, 64, 22'));

  (bot.pathfinder.goto as sinon.SinonStub).rejects(new Error('Path obstructed'));
  await t.throwsAsync(
    async () => service.moveToPosition(50, 64, 50),
    { instanceOf: MovementError, message: /Path obstructed/ }
  );
});

test('MovementService jump and moveInDirection', async (t) => {
  const bot = createMockBot();
  const service = new MovementService(bot);

  const jumpRes = await service.jump();
  t.true(jumpRes.success);
  t.is(jumpRes.message, 'Successfully jumped');

  const moveRes = await service.moveInDirection('forward', 50);
  t.true(moveRes.success);
  t.is(moveRes.message, 'Moved forward for 50ms');
});

test('MovementService flyTo rejects when creative not available', async (t) => {
  const bot = createMockBot();
  const service = new MovementService(bot);

  await t.throwsAsync(
    async () => service.flyTo(10, 80, 20),
    { instanceOf: MovementError, message: /Creative mode is not available/ }
  );
});

test('BlockService getBlockInfo, digBlock, and placeBlock', async (t) => {
  const bot = createMockBot();
  const service = new BlockService(bot);

  const info = service.getBlockInfo(10, 63, 20);
  t.truthy(info);
  t.is(info?.name, 'stone');

  const digRes = await service.digBlock(10, 63, 20);
  t.true(digRes.success);
  t.is(digRes.blockName, 'stone');

  await t.throwsAsync(
    async () => service.digBlock(10, 70, 20),
    { instanceOf: BlockDigError, message: /No block found/ }
  );

  await t.throwsAsync(
    async () => service.placeBlock(10, 64, 20),
    { instanceOf: BlockPlacementError, message: /standing/ }
  );

  const placeRes = await service.placeBlock('dirt', 10, 64, 21, 'down');
  t.true(placeRes.success);
});

test('InventoryService listInventory and findItem', (t) => {
  const bot = createMockBot();
  const service = new InventoryService(bot);

  const list = service.listInventory();
  t.true(list.success);
  t.is(list.items.length, 3);
  t.is(list[0].name, 'dirt');

  const found = service.findItem('dirt');
  t.truthy(found);
  t.is(found?.name, 'dirt');

  const notFound = service.findItem('diamond');
  t.is(notFound, null);
});

test('InventoryService equipItem succeeds and throws when not found', async (t) => {
  const bot = createMockBot();
  const service = new InventoryService(bot);

  const res = await service.equipItem('dirt', 'hand');
  t.true(res.success);

  await t.throwsAsync(
    async () => service.equipItem('diamond_sword'),
    { instanceOf: InventoryError, message: /not found/ }
  );
});

test('EntityService findEntity', (t) => {
  const bot = createMockBot();
  const service = new EntityService(bot);

  const cow = service.findEntity('cow', 16);
  t.true(cow.success);
  t.is(cow.entity?.name, 'cow');

  const zombie = service.findEntity('zombie', 16);
  t.false(zombie.success);
});

test('ChatService sendChat and readChat', (t) => {
  const bot = createMockBot();
  const store = new MessageStore();
  store.addMessage('Alice', 'Hello world');

  const service = new ChatService(bot, store);
  const sendRes = service.sendChat('Hello there');
  t.true(sendRes.success);

  const msgs = service.readChat(5);
  t.is(msgs.length, 1);
  t.is(msgs[0].username, 'Alice');
  t.is(msgs[0].message, 'Hello world');
  t.is(msgs[0].content, 'Hello world');
});

test('GameStateService detectGamemode', (t) => {
  const bot = createMockBot();
  const service = new GameStateService(bot);

  const res = service.detectGamemode();
  t.true(res.success);
  t.is(res.gamemode, 'survival');
});

test('FurnaceService smeltItem with mock furnace', async (t) => {
  const bot = createMockBot();
  const service = new FurnaceService(bot);

  const res = await service.smeltItem('iron_ore', 'coal', 1, { x: 10, y: 64, z: 25 });
  t.true(res.success);
  t.is(res.smeltedItem, 'iron_ingot');

  await t.throwsAsync(
    async () => service.smeltItem('gold_ore', 'coal', 1, { x: 10, y: 64, z: 25 }),
    { instanceOf: FurnaceError, message: /gold_ore/ }
  );
});

test('CraftingService getRecipe throws when recipes unavailable', (t) => {
  const bot = createMockBot({
    version: '0.0.0'
  });
  const service = new CraftingService(bot);

  t.throws(
    () => service.getRecipe('stick'),
    { instanceOf: RecipeNotFoundError }
  );
});

test('createServices factory returns all domain services', (t) => {
  const bot = createMockBot();
  const store = new MessageStore();
  const services = createServices(bot, store);

  t.truthy(services.movement);
  t.truthy(services.block);
  t.truthy(services.inventory);
  t.truthy(services.crafting);
  t.truthy(services.furnace);
  t.truthy(services.entity);
  t.truthy(services.chat);
  t.truthy(services.gameState);
  t.is(services.movement.getPosition().x, 10);
});
