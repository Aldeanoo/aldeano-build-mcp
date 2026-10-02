import test from 'ava';
import path from 'node:path';
import {
  checkNodeVersion,
  checkJavaVersion,
  checkDependencies,
  checkMineflayerPackages,
  checkMcpSdk,
  checkLocalMinecraftServer,
  checkPortStatus,
  checkBotConfig,
  runDiagnostics,
  printDiagnosticReport
} from '../../src/dev/doctor.js';

test('checkNodeVersion passes for current runtime', (t) => {
  const result = checkNodeVersion('20.10.0');
  t.is(result.status, 'OK');
  t.is(result.critical, true);
  t.true(result.details.includes('required'));
});

test('checkNodeVersion fails for impossible version', (t) => {
  const result = checkNodeVersion('999.0.0');
  t.is(result.status, 'FAIL');
  t.true(result.details.includes('lower than required'));
});

test('checkJavaVersion detects installed Java', (t) => {
  const result = checkJavaVersion();
  t.is(result.category, 'Runtime');
  t.is(result.check, 'Java Development Kit');
  t.true(result.status === 'OK' || result.status === 'WARN');
});

test('checkDependencies detects core dependencies in current workspace', (t) => {
  const result = checkDependencies(process.cwd());
  t.is(result.category, 'Dependencies');
  t.is(result.status, 'OK');
});

test('checkDependencies fails when node_modules is missing', (t) => {
  const dummyPath = path.resolve(process.cwd(), 'does-not-exist-dir');
  const result = checkDependencies(dummyPath);
  t.is(result.status, 'FAIL');
  t.true(result.details.includes('node_modules directory missing'));
});

test('checkMineflayerPackages detects installed mineflayer and pathfinder', (t) => {
  const result = checkMineflayerPackages(process.cwd());
  t.is(result.category, 'Dependencies');
  t.is(result.status, 'OK');
  t.true(result.details.includes('mineflayer v'));
  t.true(result.details.includes('mineflayer-pathfinder v'));
});

test('checkMcpSdk detects MCP SDK package', (t) => {
  const result = checkMcpSdk(process.cwd());
  t.is(result.category, 'MCP SDK');
  t.true(result.status === 'OK' || result.status === 'WARN');
  t.true(result.details.includes('@modelcontextprotocol/sdk'));
});

test('checkLocalMinecraftServer detects server configuration', (t) => {
  const result = checkLocalMinecraftServer(process.cwd());
  t.is(result.category, 'Minecraft Server');
  t.true(result.status === 'OK' || result.status === 'WARN');
});

test('checkPortStatus inspects port 25565', async (t) => {
  const result = await checkPortStatus(25565, '127.0.0.1', 300);
  t.is(result.category, 'Network & Port');
  t.true(result.status === 'OK' || result.status === 'INFO');
});

test('checkBotConfig returns default configuration', (t) => {
  const result = checkBotConfig();
  t.is(result.category, 'Bot Connection');
  t.is(result.status, 'OK');
  t.true(result.details.includes('127.0.0.1'));
  t.true(result.details.includes('25565'));
  t.true(result.details.includes('MCPBot'));
});

test('runDiagnostics aggregates full health report', async (t) => {
  const report = await runDiagnostics(process.cwd());
  t.truthy(report.timestamp);
  t.true(report.items.length >= 8);
  t.is(typeof report.passed, 'number');
  t.is(typeof report.allCriticalPassed, 'boolean');
  t.true(report.allCriticalPassed);

  // Test printer does not throw
  t.notThrows(() => {
    printDiagnosticReport(report);
  });
});
