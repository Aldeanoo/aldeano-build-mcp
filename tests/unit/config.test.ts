import test from 'ava';
import { parseConfig } from '../../src/config.js';

test('parseConfig returns default values', (t) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js'];

  const config = parseConfig();

  t.is(config.host, '127.0.0.1');
  t.is(config.port, 25565);
  t.is(config.username, 'MCPBot');
  t.is(config.version, '1.20.4');
  t.is(config.auth, 'offline');
  t.is(config.connectTimeout, 30000);
  t.is(config.reconnect, true);
  t.is(config.reconnectAttempts, 5);
  t.is(config.logLevel, 'info');

  process.argv = originalArgv;
});

test('parseConfig parses custom host', (t) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', '--host', 'example.com'];

  const config = parseConfig();

  t.is(config.host, 'example.com');
  t.is(config.port, 25565);
  t.is(config.username, 'MCPBot');

  process.argv = originalArgv;
});

test('parseConfig parses custom port', (t) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', '--port', '12345'];

  const config = parseConfig();

  t.is(config.host, '127.0.0.1');
  t.is(config.port, 12345);
  t.is(config.username, 'MCPBot');

  process.argv = originalArgv;
});

test('parseConfig parses custom username', (t) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', '--username', 'CustomBot'];

  const config = parseConfig();

  t.is(config.host, '127.0.0.1');
  t.is(config.port, 25565);
  t.is(config.username, 'CustomBot');

  process.argv = originalArgv;
});

test('parseConfig parses all custom options', (t) => {
  const originalArgv = process.argv;
  process.argv = [
    'node',
    'script.js',
    '--host',
    'server.net',
    '--port',
    '9999',
    '--username',
    'TestBot',
    '--version',
    '1.20.2',
    '--auth',
    'microsoft',
    '--connect-timeout',
    '45000',
    '--no-reconnect',
    '--log-level',
    'debug'
  ];

  const config = parseConfig();

  t.is(config.host, 'server.net');
  t.is(config.port, 9999);
  t.is(config.username, 'TestBot');
  t.is(config.version, '1.20.2');
  t.is(config.auth, 'microsoft');
  t.is(config.connectTimeout, 45000);
  t.is(config.reconnect, false);
  t.is(config.logLevel, 'debug');

  process.argv = originalArgv;
});

test('parseConfig handles numeric port as number type', (t) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', '--port', '30000'];

  const config = parseConfig();

  t.is(typeof config.port, 'number');
  t.is(config.port, 30000);

  process.argv = originalArgv;
});
