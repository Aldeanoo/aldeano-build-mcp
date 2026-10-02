#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import net from 'node:net';

const host = process.env.MC_HOST || process.env.MINECRAFT_HOST || '127.0.0.1';
const port = Number(process.env.MC_PORT || process.env.MINECRAFT_PORT || 25565);

console.log('================================================================');
console.log('       Aldeano Build MCP - Minecraft Smoke Test Runner          ');
console.log('================================================================\n');

function checkServerListening(targetHost: string, targetPort: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(targetPort, targetHost);
  });
}

async function run() {
  console.log(`[SmokeRunner] Checking Minecraft server connectivity on ${host}:${port}...`);
  const isListening = await checkServerListening(host, port);

  if (!isListening) {
    console.warn(`[SmokeRunner] WARNING: No Minecraft server detected listening on ${host}:${port}.`);
    console.warn(`[SmokeRunner] To start a local test server, run:\n`);
    console.warn(`  npm run mc:start\n`);
    console.warn(`[SmokeRunner] Proceeding anyway (test will attempt connection and report results)...\n`);
  } else {
    console.log(`[SmokeRunner] Server is listening on ${host}:${port}. Starting test suite...\n`);
  }

  process.env.RUN_MINECRAFT_TESTS = 'true';

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCmd, ['ava', 'tests/integration/smoke.minecraft.ts', '--verbose'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RUN_MINECRAFT_TESTS: 'true'
    },
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n[SmokeRunner] All smoke tests passed successfully!');
    } else {
      console.error(`\n[SmokeRunner] Smoke tests completed with exit code: ${code}`);
    }
    process.exit(code ?? 1);
  });
}

run().catch((err) => {
  console.error('[SmokeRunner] Fatal error executing smoke tests:', err);
  process.exit(1);
});
