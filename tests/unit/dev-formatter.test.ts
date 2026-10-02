import test from 'ava';
import {
  formatBanner,
  formatCoordinates,
  formatBlock,
  formatFoundBlocks,
  formatInventory,
  formatStatus,
  formatHealth,
  formatTable,
  formatHelp,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  setColorsEnabled,
} from '../../src/dev/formatter.js';
import { COMMANDS } from '../../src/dev/commands.js';
import type { RuntimeStatus, RuntimeHealth } from '../../src/runtime/runtime.js';

// Disable colors for deterministic string matching in tests
test.before(() => {
  setColorsEnabled(false);
});

test('formatBanner matches required layout', (t) => {
  const banner = formatBanner({
    host: 'localhost',
    port: 25565,
    username: 'TestBot',
    connected: true,
  });

  t.true(banner.includes('Aldeano Build MCP Dev Shell'));
  t.true(banner.includes('Minecraft: connected'));
  t.true(banner.includes('Host: localhost'));
  t.true(banner.includes('Port: 25565'));
  t.true(banner.includes('Bot: TestBot'));
});

test('formatBanner handles disconnected state', (t) => {
  const banner = formatBanner({
    host: '127.0.0.1',
    port: 25566,
    username: 'OfflineBot',
    connected: false,
  });

  t.true(banner.includes('Minecraft: disconnected'));
});

test('formatCoordinates returns formatted string', (t) => {
  const str = formatCoordinates({ x: 10, y: 64, z: -25 });
  t.is(str, '(X: 10, Y: 64, Z: -25)');
});

test('formatBlock handles found and missing blocks', (t) => {
  const found = formatBlock({
    name: 'stone',
    type: 1,
    position: { x: 5, y: 60, z: 12 },
  });
  t.true(found.includes('Block: stone'));
  t.true(found.includes('(ID: 1)'));
  t.true(found.includes('(X: 5, Y: 60, Z: 12)'));

  const air = formatBlock(null, { x: 0, y: 100, z: 0 });
  t.true(air.includes('No block found (air)'));
  t.true(air.includes('(X: 0, Y: 100, Z: 0)'));
});

test('formatFoundBlocks formats non-empty and empty lists', (t) => {
  const empty = formatFoundBlocks([], 'diamond_ore', 16);
  t.is(empty, 'No diamond_ore found within 16 blocks.');

  const found = formatFoundBlocks(
    [{ x: 1, y: 12, z: 3 }, { x: 2, y: 12, z: 4 }],
    'diamond_ore',
    16
  );
  t.true(found.includes('Found 2 diamond_ore block(s) within 16 blocks:'));
  t.true(found.includes('1. (X: 1, Y: 12, Z: 3)'));
  t.true(found.includes('2. (X: 2, Y: 12, Z: 4)'));
});

test('formatInventory handles empty and populated inventory', (t) => {
  const empty = formatInventory([]);
  t.is(empty, 'Inventory is empty.');

  const populated = formatInventory([
    { slot: 0, name: 'iron_sword', count: 1 },
    { slot: 1, name: 'bread', count: 16 },
  ]);
  t.true(populated.includes('Slot'));
  t.true(populated.includes('Item Name'));
  t.true(populated.includes('Count'));
  t.true(populated.includes('iron_sword'));
  t.true(populated.includes('bread'));
  t.true(populated.includes('Total: 2 unique slot(s), 17 item(s)'));
});

test('formatTable creates bordered table', (t) => {
  const table = formatTable(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
  t.true(table.includes('Name'));
  t.true(table.includes('Alice'));
  t.true(table.includes('Bob'));
  t.true(table.includes('┌'));
  t.true(table.includes('└'));
});

test('formatStatus formats bot status', (t) => {
  const status: RuntimeStatus = {
    connected: true,
    state: 'connected',
    host: 'localhost',
    port: 25565,
    username: 'TestBot',
    botSpawned: true,
    position: { x: 10, y: 64, z: 20 },
    health: 20,
    food: 20,
    gamemode: 'creative',
    dimension: 'overworld',
    difficulty: 'peaceful',
    isAlive: true,
    inventoryCount: 3,
    ping: 15,
  };

  const output = formatStatus(status);
  t.true(output.includes('=== Minecraft Bot & Connection Status ==='));
  t.true(output.includes('Server:      localhost:25565'));
  t.true(output.includes('Username:    TestBot'));
  t.true(output.includes('Gamemode:    creative'));
  t.true(output.includes('Position:    (X: 10, Y: 64, Z: 20)'));
  t.true(output.includes('Health:      20/20'));
});

test('formatHealth formats runtime health check', (t) => {
  const health: RuntimeHealth = {
    status: 'healthy',
    connected: true,
    state: 'connected',
    botSpawned: true,
    uptimeSeconds: 120,
    memory: {
      heapUsedMB: 30.5,
      heapTotalMB: 60.0,
      rssMB: 75.2,
    },
    bot: {
      isAlive: true,
      health: 20,
      food: 20,
      ping: 10,
    },
    server: {
      host: '127.0.0.1',
      port: 25565,
      version: '1.20.4',
    },
    summary: 'Bot connection is healthy',
  };

  const output = formatHealth(health);
  t.true(output.includes('=== Aldeano Build MCP - Runtime Health Check ==='));
  t.true(output.includes('HEALTHY'));
  t.true(output.includes('Uptime:      120s'));
  t.true(output.includes('Heap: 30.5 MB / 60 MB'));
});

test('formatHelp generates command list', (t) => {
  const help = formatHelp(COMMANDS);
  t.true(help.includes('Dev Shell Commands'));
  t.true(help.includes('position'));
  t.true(help.includes('move <x> <y> <z>'));
  t.true(help.includes('place <block> <x> <y> <z>'));
  t.true(help.includes('dig <x> <y> <z>'));
  t.true(help.includes('fly <x> <y> <z>'));
  t.true(help.includes('exit'));
});

test('formatSuccess, formatError, formatWarning, formatInfo format messages', (t) => {
  t.true(formatSuccess('Success message').includes('Success message'));
  t.true(formatError('Something went wrong').includes('Something went wrong'));
  t.true(formatWarning('Be careful').includes('Be careful'));
  t.true(formatInfo('Useful note').includes('Useful note'));
});
