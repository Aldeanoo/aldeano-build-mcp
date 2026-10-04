import test from 'ava';
import sinon from 'sinon';
import mineflayer from 'mineflayer';
import { EventEmitter } from 'node:events';
import { BotConnection } from '../../src/bot-connection.js';
import { MinecraftRuntime } from '../../src/runtime/minecraft-runtime.js';
import { BotSession } from '../../src/runtime/bot-session.js';

function mockBot(): mineflayer.Bot {
  return Object.assign(new EventEmitter(), {
    username: 'RegressionBot',
    quit: sinon.stub(),
    chat: sinon.stub(),
    entity: { position: { x: 0, y: 64, z: 0 } },
    pathfinder: { stop: sinon.stub() },
  }) as unknown as mineflayer.Bot;
}

test('session cleanup preserves Mineflayer end listeners', async (t) => {
  const bot = mockBot();
  let ended = false;
  bot.once('end', () => { ended = true; });
  bot.quit = () => { queueMicrotask(() => bot.emit('end', 'quit')); };
  const session = new BotSession({ host: 'localhost', port: 25565, username: bot.username }, bot);
  session.cleanup();
  await Promise.resolve();
  t.true(ended);
  t.is(bot.listenerCount('chat'), 0);
  t.is(bot.listenerCount('spawn'), 0);
});

test.serial('runtime disconnect preserves plugin end hooks without scheduling reconnects', async (t) => {
  let ended = 0;
  const createBot = sinon.stub(mineflayer, 'createBot').callsFake(() => {
    const bot = mockBot();
    bot.once('end', () => { ended++; });
    bot.quit = () => { queueMicrotask(() => bot.emit('end', 'quit')); };
    queueMicrotask(() => bot.emit('spawn'));
    return bot;
  });
  const initPathfinder = sinon.stub(BotSession.prototype, 'initPathfinder');
  const runtime = new MinecraftRuntime({ host: 'localhost', port: 25565, username: 'RegressionBot' });
  t.teardown(async () => {
    await runtime.disconnect();
    createBot.restore();
    initPathfinder.restore();
  });
  await runtime.connect();
  await runtime.disconnect();
  await Promise.resolve();
  t.is(ended, 1);
  t.is(createBot.callCount, 1);
  t.is(runtime.getSession(), null);
});

test.serial('an end event before spawn permits another connection attempt', async (t) => {
  const first = mockBot();
  const second = mockBot();
  const createBot = sinon.stub(mineflayer, 'createBot');
  createBot.onFirstCall().returns(first);
  createBot.onSecondCall().returns(second);
  const clock = sinon.useFakeTimers();
  const connection = new BotConnection(
    { host: 'localhost', port: 25565, username: 'RegressionBot' },
    { onLog: () => {}, onChatMessage: () => {} },
    1,
  );
  t.teardown(() => {
    connection.cleanup();
    clock.restore();
    createBot.restore();
  });

  connection.connect();
  first.emit('end', 'socketClosed');
  t.is(connection.getState(), 'disconnected');
  t.is(connection.getBot(), null);
  connection.attemptReconnect();
  await clock.tickAsync(1);
  t.is(createBot.callCount, 2);
  t.is(connection.getBot(), second);
});

test.serial('connect applies authentication and version overrides without changing the address', async (t) => {
  const createBot = sinon.stub(mineflayer, 'createBot').callsFake(() => {
    const bot = mockBot();
    queueMicrotask(() => bot.emit('spawn'));
    return bot;
  });
  const initPathfinder = sinon.stub(BotSession.prototype, 'initPathfinder');
  const runtime = new MinecraftRuntime({
    host: 'localhost', port: 25565, username: 'RegressionBot', auth: 'offline',
    version: '1.20.4', reconnect: true,
  });
  t.teardown(async () => {
    await runtime.disconnect();
    createBot.restore();
    initPathfinder.restore();
  });

  const session = await runtime.connect({
    auth: 'microsoft', version: '1.21.1', reconnect: false, connectTimeoutMs: 500,
  });
  t.is(createBot.firstCall.args[0]?.auth, 'microsoft');
  t.is(createBot.firstCall.args[0]?.version, '1.21.1');
  t.false(session.config.reconnect);
  t.is(session.config.connectTimeoutMs, 500);
});

test.serial('connect recreates a ready session when only lifecycle options change', async (t) => {
  const createBot = sinon.stub(mineflayer, 'createBot').callsFake(() => {
    const bot = mockBot();
    queueMicrotask(() => bot.emit('spawn'));
    return bot;
  });
  const initPathfinder = sinon.stub(BotSession.prototype, 'initPathfinder');
  const runtime = new MinecraftRuntime({
    host: 'localhost', port: 25565, username: 'RegressionBot', reconnect: false,
  });
  t.teardown(async () => {
    await runtime.disconnect();
    createBot.restore();
    initPathfinder.restore();
  });

  const first = await runtime.connect();
  const second = await runtime.connect({ connectTimeoutMs: 750, pingIntervalMs: 1000 });
  t.not(first, second);
  t.true(first.isDisposed);
  t.is(second.config.connectTimeoutMs, 750);
  t.is(second.config.pingIntervalMs, 1000);
  t.is(createBot.callCount, 2);
  t.is(await runtime.connect({ connectTimeoutMs: 750, pingIntervalMs: 1000 }), second);
  t.is(createBot.callCount, 2);
});
