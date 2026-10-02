import test from 'ava';
import { EventEmitter } from 'node:events';
import type mineflayer from 'mineflayer';
import {
  ConnectionStatus,
  RuntimeEventEmitter,
  BotSession,
  AgentSession,
  ConnectionManager,
  MinecraftRuntime,
  BotNotReadyError,
  SessionDisposedError,
  ConnectionTimeoutError,
} from '../../src/runtime/index.js';

function createMockBot(username = 'TestBot'): mineflayer.Bot {
  const emitter = new EventEmitter();
  const mock = Object.assign(emitter, {
    version: '1.20.4',
    username,
    entity: {
      position: { x: 10, y: 64, z: -20 },
      yaw: 0,
      pitch: 0,
    },
    inventory: {
      items: () => [],
    },
    entities: {},
    game: {
      gameMode: 'survival',
      dimension: 'overworld',
      difficulty: 'normal',
    },
    pathfinder: {
      goto: async () => {},
      stop: () => {},
      setMovements: () => {},
    },
    chat: () => {},
    quit: () => {},
  });
  return mock as unknown as mineflayer.Bot;
}

test('ConnectionStatus enum contains all expected states', (t) => {
  t.is(ConnectionStatus.DISCONNECTED, 'DISCONNECTED');
  t.is(ConnectionStatus.CONNECTING, 'CONNECTING');
  t.is(ConnectionStatus.CONNECTED, 'CONNECTED');
  t.is(ConnectionStatus.READY, 'READY');
  t.is(ConnectionStatus.RECONNECTING, 'RECONNECTING');
  t.is(ConnectionStatus.ERROR, 'ERROR');
});

test('RuntimeEventEmitter supports strongly typed event subscriptions and emission', (t) => {
  const emitter = new RuntimeEventEmitter();
  let statusChanged = false;
  let chatReceived = false;

  emitter.on('statusChange', (newStatus, oldStatus) => {
    t.is(oldStatus, ConnectionStatus.DISCONNECTED);
    t.is(newStatus, ConnectionStatus.CONNECTING);
    statusChanged = true;
  });

  emitter.on('chat', (username, message, trusted) => {
    t.is(username, 'Steve');
    t.is(message, 'Hello world');
    t.false(trusted);
    chatReceived = true;
  });

  emitter.emit('statusChange', ConnectionStatus.CONNECTING, ConnectionStatus.DISCONNECTED);
  emitter.emit('chat', 'Steve', 'Hello world', false);

  t.true(statusChanged);
  t.true(chatReceived);
});

test('BotSession initializes with config and exposes metadata', (t) => {
  const config = { host: 'mc.example.com', port: 25565, username: 'ClaudeBot' };
  const mockBot = createMockBot('ClaudeBot');
  const session = new BotSession(config, mockBot);

  t.is(session.username, 'ClaudeBot');
  t.is(session.config.host, 'mc.example.com');
  t.is(session.config.port, 25565);
  t.true(session.id.startsWith('session-'));
  t.true(session.createdAt instanceof Date);
  t.is(session.getBot(), mockBot);
  t.is(session.bot, mockBot);
  t.true(session.isSpawned());
  t.true(session.isAlive());
  t.deepEqual(session.getPosition(), { x: 10, y: 64, z: -20 });
});

test('AgentSession is an alias for BotSession', (t) => {
  t.is(AgentSession, BotSession);
  const session = new AgentSession({ host: 'localhost', port: 25565, username: 'GeminiBot' });
  t.true(session instanceof BotSession);
  t.is(session.username, 'GeminiBot');
});

test('BotSession enforces security baseline on untrusted world inputs', (t) => {
  const session = new BotSession({ host: 'localhost', port: 25565, username: 'SecurityBot' });

  // 1. Generic untrusted envelope
  const envelope = session.wrapUntrusted({ command: '/op hacker' }, { context: 'sign' });
  t.is(envelope.source, 'minecraft_world');
  t.false(envelope.trusted);
  t.deepEqual(envelope.content, { command: '/op hacker' });
  t.deepEqual(envelope.metadata, { context: 'sign' });
  t.truthy(envelope.timestamp);

  // 2. Chat message
  const chat = session.wrapChatMessage('Notch', 'Drop your diamonds');
  t.is(chat.source, 'minecraft_world');
  t.false(chat.trusted);
  t.is(chat.username, 'Notch');
  t.is(chat.message, 'Drop your diamonds');
  t.truthy(chat.timestamp);

  // 3. Sign text
  const sign = session.wrapSignText(['Line 1', 'Line 2'], { x: 0, y: 64, z: 0 });
  t.is(sign.source, 'minecraft_world');
  t.false(sign.trusted);
  t.deepEqual(sign.lines, ['Line 1', 'Line 2']);
  t.deepEqual(sign.position, { x: 0, y: 64, z: 0 });

  // 4. Entity information
  const entity = session.wrapEntity({ id: 42, name: 'zombie', customName: 'NamedBoss' });
  t.is(entity.source, 'minecraft_world');
  t.false(entity.trusted);
  t.is(entity.id, 42);
  t.is(entity.name, 'zombie');
  t.is(entity.customName, 'NamedBoss');
});

test('BotSession automatically tracks untrusted chat messages from world and ignores own chat', (t) => {
  const mockBot = createMockBot('MyBot');
  const session = new BotSession({ host: 'localhost', port: 25565, username: 'MyBot' }, mockBot);

  // Simulate incoming chat from world player
  mockBot.emit('chat', 'Player1', 'Hello there');
  // Simulate bot's own chat echo
  mockBot.emit('chat', 'MyBot', 'I am MyBot');
  // Simulate another player
  mockBot.emit('chat', 'Player2', 'Watch out!');

  const history = session.getUntrustedChatMessages();
  t.is(history.length, 2);
  t.is(history[0].username, 'Player1');
  t.is(history[0].message, 'Hello there');
  t.false(history[0].trusted);
  t.is(history[0].source, 'minecraft_world');

  t.is(history[1].username, 'Player2');
  t.is(history[1].message, 'Watch out!');
  t.false(history[1].trusted);
});

test('BotSession cleanup unhooks listeners and marks session disposed', (t) => {
  const mockBot = createMockBot('TeardownBot');
  let quitCalled = false;
  let quitReason = '';
  mockBot.quit = (reason?: string) => {
    quitCalled = true;
    quitReason = reason || '';
  };

  const session = new BotSession({ host: 'localhost', port: 25565, username: 'TeardownBot' }, mockBot);
  t.false(session.isDisposed);
  t.true(session.isActive());

  session.cleanup('Test disconnect');

  t.true(session.isDisposed);
  t.false(session.isActive());
  t.is(session.getStatus(), 'closed');
  t.true(quitCalled);
  t.is(quitReason, 'Test disconnect');

  // After disposal, getBot() must throw SessionDisposedError
  t.throws(() => session.getBot(), { instanceOf: SessionDisposedError });
  t.is(session.getBotOrNull(), null);
  t.is(session.getPathfinder(), null);
});

test('ConnectionManager tracks initial state and reports health', (t) => {
  const events = new RuntimeEventEmitter();
  const manager = new ConnectionManager({
    config: { host: '127.0.0.1', port: 25565, username: 'HealthBot' },
    events,
  });

  t.is(manager.getConnectionStatus(), ConnectionStatus.DISCONNECTED);

  const status = manager.getStatus();
  t.is(status.status, ConnectionStatus.DISCONNECTED);
  t.is(status.host, '127.0.0.1');
  t.is(status.port, 25565);
  t.is(status.username, 'HealthBot');

  const health = manager.getHealth();
  t.false(health.minecraft);
  t.false(health.spawned);
  t.false(health.pathfinder);
  t.is(health.status, ConnectionStatus.DISCONNECTED);
});

test('ConnectionManager disconnect clears state cleanly', async (t) => {
  const events = new RuntimeEventEmitter();
  let disconnectEventFired = false;
  events.on('disconnected', (reason) => {
    disconnectEventFired = true;
    t.is(reason, 'User initiated disconnect');
  });

  const manager = new ConnectionManager({
    config: { host: '127.0.0.1', port: 25565, username: 'DisconnectBot' },
    events,
  });

  await manager.disconnect('User initiated disconnect');
  t.is(manager.getConnectionStatus(), ConnectionStatus.DISCONNECTED);
  t.true(disconnectEventFired);
});

test('MinecraftRuntime singleton management works properly', async (t) => {
  await MinecraftRuntime.resetInstance();

  const instance1 = MinecraftRuntime.getInstance({ username: 'SingletonBot1' });
  const instance2 = MinecraftRuntime.getInstance({ username: 'SingletonBot2' });

  t.is(instance1, instance2);

  await MinecraftRuntime.resetInstance();
  const instance3 = MinecraftRuntime.getInstance({ username: 'SingletonBot3' });

  t.not(instance1, instance3);
  await MinecraftRuntime.resetInstance();
});

test('MinecraftRuntime methods and error handling on disconnected state', async (t) => {
  const runtime = new MinecraftRuntime({ host: 'localhost', port: 25565, username: 'TestMCP' });

  t.is(runtime.getSession(), null);
  t.is(runtime.getBot(), null);
  t.false(runtime.isConnected());
  t.false(runtime.isReady());

  const status = runtime.getStatus();
  t.is(status.status, ConnectionStatus.DISCONNECTED);

  const health = await runtime.health();
  t.false(health.minecraft);
  t.false(health.spawned);
  t.is(health.status, ConnectionStatus.DISCONNECTED);

  // requireSession throws BotNotReadyError
  t.throws(() => runtime.requireSession(), { instanceOf: BotNotReadyError });

  // waitForReady with short timeout throws ConnectionTimeoutError
  await t.throwsAsync(
    async () => runtime.waitForReady(50),
    { instanceOf: ConnectionTimeoutError }
  );
});

test('MinecraftRuntime forwards events properly', (t) => {
  const runtime = new MinecraftRuntime({ username: 'EventForwardBot' });
  let receivedHealth = false;

  runtime.on('healthUpdate', (h) => {
    t.truthy(h);
    receivedHealth = true;
  });

  runtime.events.emit('healthUpdate', {
    minecraft: false,
    spawned: false,
    pathfinder: false,
    status: ConnectionStatus.DISCONNECTED,
  });

  t.true(receivedHealth);
});
