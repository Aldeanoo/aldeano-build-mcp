import test from 'ava';
import { MinecraftRuntime } from '../../src/runtime/minecraft-runtime.js';

if (process.env.RUN_MINECRAFT_TESTS !== 'true') {
  test('runtime connection lifecycle (SKIPPED)', (t) => {
    t.pass('Requires an isolated Minecraft server and RUN_MINECRAFT_TESTS=true.');
  });
} else {
  test.serial('runtime reconnects to Minecraft when only lifecycle options change', async (t) => {
    const runtime = new MinecraftRuntime({
      host: process.env.MC_HOST || '127.0.0.1',
      port: Number(process.env.MC_PORT || 25565),
      username: 'LifecycleTestBot',
      version: '1.20.4',
      auth: 'offline',
      reconnect: false,
    });
    runtime.on('error', (error) => t.log(error.message));
    t.teardown(() => runtime.disconnect());

    const first = await runtime.connect();
    t.true(first.isSpawned());
    const second = await runtime.connect({ connectTimeoutMs: 40000, pingIntervalMs: 1000 });
    t.not(first, second);
    t.true(first.isDisposed);
    t.true(second.isSpawned());
    t.is(second.config.connectTimeoutMs, 40000);
    t.is(second.config.pingIntervalMs, 1000);
    t.is(second.getBot().version, '1.20.4');
    t.truthy(second.getPosition());
    t.is(await runtime.connect({ connectTimeoutMs: 40000, pingIntervalMs: 1000 }), second);
  });
}
