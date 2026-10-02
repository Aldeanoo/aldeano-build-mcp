import test from 'ava';
import sinon from 'sinon';
import {
  COMMANDS,
  getCommand,
  getAllCommands,
  parseCommandLine,
  executeCommand,
} from '../../src/dev/commands.js';
import { setColorsEnabled } from '../../src/dev/formatter.js';
import type { MinecraftRuntime } from '../../src/runtime/runtime.js';

test.before(() => {
  setColorsEnabled(false);
});

test('parseCommandLine parses simple commands and quoted arguments', (t) => {
  t.deepEqual(parseCommandLine(''), { command: '', args: [] });
  t.deepEqual(parseCommandLine('   '), { command: '', args: [] });

  t.deepEqual(parseCommandLine('position'), { command: 'position', args: [] });
  t.deepEqual(parseCommandLine('move 10 64 20'), {
    command: 'move',
    args: ['10', '64', '20'],
  });
  t.deepEqual(parseCommandLine('chat "hello world from bot"'), {
    command: 'chat',
    args: ['hello world from bot'],
  });
  t.deepEqual(parseCommandLine("equip 'diamond sword' hand"), {
    command: 'equip',
    args: ['diamond sword', 'hand'],
  });
});

test('getCommand returns command by name and alias', (t) => {
  t.is(getCommand('position')?.name, 'position');
  t.is(getCommand('pos')?.name, 'position');
  t.is(getCommand('inventory')?.name, 'inventory');
  t.is(getCommand('inv')?.name, 'inventory');
  t.is(getCommand('exit')?.name, 'exit');
  t.is(getCommand('quit')?.name, 'exit');
  t.is(getCommand('UNKNOWN_CMD'), undefined);
});

test('getAllCommands returns complete list of commands', (t) => {
  const all = getAllCommands();
  t.is(all.length, COMMANDS.length);
  const names = all.map((c) => c.name);
  t.true(names.includes('position'));
  t.true(names.includes('move'));
  t.true(names.includes('fly'));
  t.true(names.includes('place'));
  t.true(names.includes('dig'));
  t.true(names.includes('info'));
  t.true(names.includes('find'));
  t.true(names.includes('inventory'));
  t.true(names.includes('equip'));
  t.true(names.includes('chat'));
  t.true(names.includes('status'));
  t.true(names.includes('health'));
  t.true(names.includes('gamemode'));
  t.true(names.includes('help'));
  t.true(names.includes('exit'));
});

function createMockRuntime(): MinecraftRuntime {
  return {
    movement: {
      getPosition: sinon.stub().returns({ x: 10, y: 64, z: 20 }),
      moveToPosition: sinon.stub().resolves({ success: true, message: 'Moved to 10, 64, 20' }),
      flyTo: sinon.stub().resolves({ success: true, message: 'Flew to 10, 80, 20' }),
    },
    blocks: {
      placeBlock: sinon.stub().resolves({ success: true, message: 'Placed stone at (10, 64, 20)' }),
      digBlock: sinon.stub().resolves('stone'),
      getBlockInfo: sinon.stub().returns({
        success: true,
        name: 'dirt',
        type: 3,
        position: { x: 10, y: 63, z: 20 },
      }),
      findBlocks: sinon.stub().returns({
        success: true,
        blocks: [{ x: 12, y: 64, z: 20 }],
        message: 'Found block',
      }),
    },
    inventory: {
      listInventory: sinon.stub().returns({
        success: true,
        items: [{ slot: 0, name: 'stone', count: 64 }],
        totalCount: 64,
        message: 'Found items',
      }),
      equipItem: sinon.stub().resolves({
        success: true,
        message: 'Equipped stone to hand',
      }),
    },
    chat: {
      sendChat: sinon.stub(),
      readChat: sinon.stub().returns([]),
    },
    world: {
      detectGamemode: sinon.stub().returns('creative'),
      findEntity: sinon.stub().returns(null),
    },
    getStatus: sinon.stub().returns({
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
      inventoryCount: 1,
      ping: 5,
    }),
    getHealth: sinon.stub().returns({
      status: 'healthy',
      connected: true,
      state: 'connected',
      botSpawned: true,
      uptimeSeconds: 60,
      memory: { heapUsedMB: 20, heapTotalMB: 40, rssMB: 60 },
      bot: { isAlive: true, health: 20, food: 20, ping: 5 },
      server: { host: 'localhost', port: 25565, version: '1.20.4' },
      summary: 'All good',
    }),
    disconnect: sinon.stub().resolves(),
  } as unknown as MinecraftRuntime;
}

test('executeCommand: position and pos return coordinates from MovementService', async (t) => {
  const runtime = createMockRuntime();
  const out1 = await executeCommand('position', runtime);
  t.true(out1.includes('(X: 10, Y: 64, Z: 20)'));

  const out2 = await executeCommand('pos', runtime);
  t.true(out2.includes('(X: 10, Y: 64, Z: 20)'));
});

test('executeCommand: move invokes MovementService.moveToPosition', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('move 10 64 20', runtime);
  t.true(out.includes('Moved to 10, 64, 20'));
  t.true((runtime.movement.moveToPosition as sinon.SinonStub).calledWith(10, 64, 20));
});

test('executeCommand: move validates coordinates', async (t) => {
  const runtime = createMockRuntime();
  const err1 = await executeCommand('move 10', runtime);
  t.true(err1.includes('Usage: move <x> <y> <z>'));

  const err2 = await executeCommand('move foo bar baz', runtime);
  t.true(err2.includes('Coordinates must be valid numbers'));
});

test('executeCommand: fly invokes MovementService.flyTo', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('fly 10 80 20', runtime);
  t.true(out.includes('Flew to 10, 80, 20'));
  t.true((runtime.movement.flyTo as sinon.SinonStub).calledWith(10, 80, 20));
});

test('executeCommand: place invokes BlockService.placeBlock', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('place stone 10 64 20', runtime);
  t.true(out.includes('Placed stone at (10, 64, 20)'));
  t.true((runtime.blocks.placeBlock as sinon.SinonStub).calledWith('stone', 10, 64, 20, 'down'));
});

test('executeCommand: dig invokes BlockService.digBlock', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('dig 10 64 20', runtime);
  t.true(out.includes('Dug stone at (10, 64, 20)'));
  t.true((runtime.blocks.digBlock as sinon.SinonStub).calledWith(10, 64, 20));
});

test('executeCommand: info invokes BlockService.getBlockInfo', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('info 10 63 20', runtime);
  t.true(out.includes('Block: dirt'));
  t.true((runtime.blocks.getBlockInfo as sinon.SinonStub).calledWith(10, 63, 20));
});

test('executeCommand: find invokes BlockService.findBlocks', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('find diamond_ore 32 5', runtime);
  t.true(out.includes('Found 1 diamond_ore block(s)'));
  t.true((runtime.blocks.findBlocks as sinon.SinonStub).calledWith('diamond_ore', 32, 5));
});

test('executeCommand: inventory and inv list inventory items', async (t) => {
  const runtime = createMockRuntime();
  const out1 = await executeCommand('inventory', runtime);
  t.true(out1.includes('stone'));
  t.true(out1.includes('x64'));

  const out2 = await executeCommand('inv', runtime);
  t.true(out2.includes('stone'));
});

test('executeCommand: equip invokes InventoryService.equipItem', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('equip stone hand', runtime);
  t.true(out.includes('Equipped stone to hand'));
  t.true((runtime.inventory.equipItem as sinon.SinonStub).calledWith('stone', 'hand'));
});

test('executeCommand: chat invokes ChatService.sendChat', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('chat Hello world from LLM!', runtime);
  t.true(out.includes('Sent chat: "Hello world from LLM!"'));
  t.true((runtime.chat.sendChat as sinon.SinonStub).calledWith('Hello world from LLM!'));
});

test('executeCommand: status invokes runtime.getStatus', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('status', runtime);
  t.true(out.includes('=== Minecraft Bot & Connection Status ==='));
  t.true(out.includes('TestBot'));
});

test('executeCommand: health invokes runtime.getHealth', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('health', runtime);
  t.true(out.includes('=== Aldeano Build MCP - Runtime Health Check ==='));
  t.true(out.includes('HEALTHY'));
});

test('executeCommand: gamemode invokes WorldService.detectGamemode', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('gamemode', runtime);
  t.true(out.includes('Current gamemode: creative'));
});

test('executeCommand: help lists available commands', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('help', runtime);
  t.true(out.includes('position'));
  t.true(out.includes('move'));
  t.true(out.includes('dig'));
});

test('executeCommand: exit and quit disconnect runtime', async (t) => {
  const runtime = createMockRuntime();
  const out1 = await executeCommand('exit', runtime);
  t.true(out1.includes('Goodbye'));
  t.true((runtime.disconnect as sinon.SinonStub).called);

  const out2 = await executeCommand('quit', runtime);
  t.true(out2.includes('Goodbye'));
});

test('executeCommand: handles unknown command gracefully', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('unknown_action', runtime);
  t.true(out.includes('Unknown command: "unknown_action"'));
});

test('executeCommand: returns empty string for empty input', async (t) => {
  const runtime = createMockRuntime();
  const out = await executeCommand('', runtime);
  t.is(out, '');
});
