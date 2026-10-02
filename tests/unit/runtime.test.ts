import test from 'ava';
import { MinecraftRuntime } from '../../src/runtime/runtime.js';
import { BotSession } from '../../src/runtime/bot-session.js';
import { BotNotReadyError } from '../../src/errors/index.js';
import mineflayer from 'mineflayer';
import { EventEmitter } from 'node:events';

function createMockBot(): mineflayer.Bot {
  const emitter = new EventEmitter();
  const mockBot = Object.assign(emitter, {
    version: '1.20.4',
    username: 'TestBot',
    entity: {
      position: { x: 10, y: 64, z: 20 },
      yaw: 0,
      pitch: 0
    },
    inventory: {
      items: () => []
    },
    entities: {},
    game: {
      gameMode: 'survival'
    },
    pathfinder: {
      goto: async () => {},
      stop: () => {},
      setMovements: () => {}
    },
    blockAt: () => null,
    canSeeBlock: () => true,
    canDigBlock: () => true,
    lookAt: async () => {},
    dig: async () => {},
    placeBlock: async () => {},
    findBlock: () => null,
    findBlocks: () => [],
    recipesFor: () => [],
    craft: async () => {},
    equip: async () => {},
    chat: () => {},
    setControlState: () => {},
    clearControlStates: () => {},
    quit: () => {}
  });

  return mockBot as unknown as mineflayer.Bot;
}

test('MinecraftRuntime initializes with default configuration', (t) => {
  const runtime = new MinecraftRuntime();
  const config = runtime.getConfig();

  t.truthy(config);
  t.truthy(config.host);
  t.truthy(config.port);
  t.truthy(config.username);
  t.truthy(runtime.getMessageStore());
  t.truthy(runtime.getConnection());
});

test('MinecraftRuntime returns null session when bot is not connected', (t) => {
  const runtime = new MinecraftRuntime();
  t.is(runtime.getSession(), null);
});

test('MinecraftRuntime requireSession throws BotNotReadyError when disconnected', (t) => {
  const runtime = new MinecraftRuntime();
  t.throws(
    () => runtime.requireSession(),
    { instanceOf: BotNotReadyError, message: /not active or connected/ }
  );
});

test('BotSession initializes all service interfaces with mock bot', (t) => {
  const mockBot = createMockBot();
  const session = new BotSession(mockBot);

  t.is(session.bot, mockBot);
  t.is(session.getStatus(), 'active');
  t.true(session.isActive());

  t.truthy(session.movement);
  t.truthy(session.blocks);
  t.truthy(session.inventory);
  t.truthy(session.world);
  t.truthy(session.chat);
  t.truthy(session.crafting);
});

test('BotSession close changes status and calls bot.quit', (t) => {
  const mockBot = createMockBot();
  let quitCalled = false;
  mockBot.quit = () => { quitCalled = true; };

  const session = new BotSession(mockBot);
  t.true(session.isActive());

  session.close('test shutdown');
  t.is(session.getStatus(), 'closed');
  t.false(session.isActive());
  t.true(quitCalled);
});
