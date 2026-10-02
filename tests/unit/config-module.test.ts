import test from 'ava';
import {
  DEFAULT_CONFIG,
  AldeanoConfigSchema,
  loadConfig,
  getConfig,
  setConfig,
  resetConfig,
} from '../../src/config/index.js';
import { ValidationError } from '../../src/errors/index.js';

test.beforeEach(() => {
  resetConfig();
  // Clear any MC_ / LOG_LEVEL env vars
  delete process.env.MC_HOST;
  delete process.env.MC_PORT;
  delete process.env.MC_USERNAME;
  delete process.env.MC_VERSION;
  delete process.env.MC_AUTH;
  delete process.env.MC_CONNECT_TIMEOUT;
  delete process.env.MC_RECONNECT;
  delete process.env.MC_RECONNECT_ATTEMPTS;
  delete process.env.MC_LOG_LEVEL;
  delete process.env.LOG_LEVEL;
});

test.serial('DEFAULT_CONFIG conforms to required specifications', (t) => {
  t.is(DEFAULT_CONFIG.host, '127.0.0.1');
  t.is(DEFAULT_CONFIG.port, 25565);
  t.is(DEFAULT_CONFIG.username, 'MCPBot');
  t.is(DEFAULT_CONFIG.version, '1.20.4');
  t.is(DEFAULT_CONFIG.auth, 'offline');
  t.is(DEFAULT_CONFIG.connectTimeout, 30000);
  t.is(DEFAULT_CONFIG.reconnect, true);
  t.is(DEFAULT_CONFIG.reconnectAttempts, 5);
  t.is(DEFAULT_CONFIG.logLevel, 'info');

  const validated = AldeanoConfigSchema.parse(DEFAULT_CONFIG);
  t.deepEqual(validated, DEFAULT_CONFIG);
});

test.serial('AldeanoConfigSchema validates valid configuration', (t) => {
  const result = AldeanoConfigSchema.safeParse({
    host: 'play.example.org',
    port: 25566,
    username: 'BuilderBot',
    version: '1.20.2',
    auth: 'microsoft',
    connectTimeout: 45000,
    reconnect: false,
    reconnectAttempts: 3,
    logLevel: 'debug',
  });

  t.true(result.success);
});

test.serial('AldeanoConfigSchema rejects invalid fields', (t) => {
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, port: 999999 }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, port: 0 }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, host: '' }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, username: '' }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, version: '' }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, connectTimeout: -100 }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, reconnectAttempts: -1 }).success);
  t.false(AldeanoConfigSchema.safeParse({ ...DEFAULT_CONFIG, logLevel: 'unknown_level' }).success);
});

test.serial('loadConfig loads defaults when no args or env vars are provided', (t) => {
  const config = loadConfig([]);
  t.deepEqual(config, DEFAULT_CONFIG);
});

test.serial('loadConfig respects environment variables over defaults', (t) => {
  process.env.MC_HOST = 'env.server.net';
  process.env.MC_PORT = '25570';
  process.env.MC_USERNAME = 'EnvBot';
  process.env.MC_VERSION = '1.20.1';
  process.env.MC_AUTH = 'microsoft';
  process.env.MC_CONNECT_TIMEOUT = '15000';
  process.env.MC_RECONNECT = 'false';
  process.env.MC_RECONNECT_ATTEMPTS = '10';
  process.env.LOG_LEVEL = 'warn';

  const config = loadConfig([]);

  t.is(config.host, 'env.server.net');
  t.is(config.port, 25570);
  t.is(config.username, 'EnvBot');
  t.is(config.version, '1.20.1');
  t.is(config.auth, 'microsoft');
  t.is(config.connectTimeout, 15000);
  t.is(config.reconnect, false);
  t.is(config.reconnectAttempts, 10);
  t.is(config.logLevel, 'warn');
});

test.serial('loadConfig gives highest priority to CLI arguments over environment variables', (t) => {
  process.env.MC_HOST = 'env.server.net';
  process.env.MC_PORT = '25570';
  process.env.MC_USERNAME = 'EnvBot';
  process.env.LOG_LEVEL = 'warn';

  const config = loadConfig([
    '--host', 'cli.server.net',
    '--port', '25580',
    '--username', 'CliBot',
    '--log-level', 'debug',
    '--no-reconnect'
  ]);

  t.is(config.host, 'cli.server.net');
  t.is(config.port, 25580);
  t.is(config.username, 'CliBot');
  t.is(config.logLevel, 'debug');
  t.is(config.reconnect, false);
});

test.serial('loadConfig throws ValidationError on invalid CLI arguments', (t) => {
  t.throws(
    () => {
      loadConfig(['--port', '999999']);
    },
    { instanceOf: ValidationError }
  );
});

test.serial('getConfig returns cached instance, setConfig updates, and resetConfig reloads', (t) => {
  const initial = loadConfig([]);
  t.is(initial.host, '127.0.0.1');

  const retrieved = getConfig();
  t.is(retrieved, initial);

  const updated = setConfig({ host: 'updated.host.com' });
  t.is(updated.host, 'updated.host.com');
  t.is(getConfig().host, 'updated.host.com');

  resetConfig();
  const reloaded = getConfig();
  t.is(reloaded.host, '127.0.0.1');
});
