import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  checkJavaInstalled,
  parseJavaVersionOutput,
  getMinecraftDevDir,
  ensureMinecraftDir,
  writeEula,
  writeServerProperties,
  SERVER_PROPERTIES_CONTENT
} from '../../scripts/minecraft/setup-server.js';
import { checkPortInUse } from '../../scripts/minecraft/start-server.js';
import { resetWorld, isServerRunning } from '../../scripts/minecraft/reset-world.js';

test('checkJavaInstalled finds Java in current environment', (t) => {
  const result = checkJavaInstalled();
  t.true(result.installed);
  t.truthy(result.version);
  t.true((result.majorVersion ?? 0) >= 17);
});

test('parseJavaVersionOutput parses OpenJDK and Oracle versions accurately', (t) => {
  const openJdkOutput = `openjdk version "21.0.12.1" 2026-08-18 LTS\nOpenJDK Runtime Environment Temurin-21.0.12.1+1`;
  const parsed21 = parseJavaVersionOutput(openJdkOutput);
  t.true(parsed21.installed);
  t.is(parsed21.version, '21.0.12.1');
  t.is(parsed21.majorVersion, 21);

  const java17Output = `java version "17.0.8" 2023-07-18 LTS\nJava(TM) SE Runtime Environment`;
  const parsed17 = parseJavaVersionOutput(java17Output);
  t.true(parsed17.installed);
  t.is(parsed17.version, '17.0.8');
  t.is(parsed17.majorVersion, 17);

  const java8Output = `java version "1.8.0_301"\nJava(TM) SE Runtime Environment`;
  const parsed8 = parseJavaVersionOutput(java8Output);
  t.true(parsed8.installed);
  t.is(parsed8.version, '1.8.0_301');
  t.is(parsed8.majorVersion, 8);
});

test('getMinecraftDevDir returns expected relative directory', (t) => {
  const mcDir = getMinecraftDevDir(process.cwd());
  t.true(mcDir.endsWith(path.join('.dev', 'minecraft')));
});

test('ensureMinecraftDir, writeEula and writeServerProperties create expected files', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test-'));
  try {
    ensureMinecraftDir(tempDir);
    t.true(fs.existsSync(tempDir));

    writeEula(tempDir);
    const eulaContent = fs.readFileSync(path.join(tempDir, 'eula.txt'), 'utf-8');
    t.true(eulaContent.includes('eula=true'));

    writeServerProperties(tempDir);
    const propsContent = fs.readFileSync(path.join(tempDir, 'server.properties'), 'utf-8');
    t.true(propsContent.includes('server-ip=127.0.0.1'));
    t.true(propsContent.includes('server-port=25565'));
    t.true(propsContent.includes('online-mode=false'));
    t.true(propsContent.includes('gamemode=creative'));
    t.true(propsContent.includes('difficulty=peaceful'));
    t.true(propsContent.includes('allow-flight=true'));
    t.true(propsContent.includes('spawn-protection=0'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SERVER_PROPERTIES_CONTENT contains mandatory localhost configuration', (t) => {
  t.true(SERVER_PROPERTIES_CONTENT.includes('server-ip=127.0.0.1'));
  t.true(SERVER_PROPERTIES_CONTENT.includes('server-port=25565'));
  t.true(SERVER_PROPERTIES_CONTENT.includes('online-mode=false'));
  t.true(SERVER_PROPERTIES_CONTENT.includes('gamemode=creative'));
});

test('checkPortInUse and isServerRunning return false for unused port', async (t) => {
  const inUse = await checkPortInUse(59123, '127.0.0.1', 200);
  t.false(inUse);

  const running = await isServerRunning(59123, '127.0.0.1', 200);
  t.false(running);
});

test('resetWorld deletes world directories when server is not running', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-world-test-'));
  try {
    const worldDir = path.join(tempDir, 'world');
    const netherDir = path.join(tempDir, 'world_nether');
    const endDir = path.join(tempDir, 'world_the_end');

    fs.mkdirSync(worldDir, { recursive: true });
    fs.mkdirSync(netherDir, { recursive: true });
    fs.mkdirSync(endDir, { recursive: true });

    fs.writeFileSync(path.join(worldDir, 'level.dat'), 'dummy');
    fs.writeFileSync(path.join(netherDir, 'level.dat'), 'dummy');
    fs.writeFileSync(path.join(endDir, 'level.dat'), 'dummy');

    t.true(fs.existsSync(worldDir));
    t.true(fs.existsSync(netherDir));
    t.true(fs.existsSync(endDir));

    const result = await resetWorld({ mcDir: tempDir, force: true });
    t.false(result.aborted);
    t.is(result.deleted.length, 3);
    t.false(fs.existsSync(worldDir));
    t.false(fs.existsSync(netherDir));
    t.false(fs.existsSync(endDir));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
