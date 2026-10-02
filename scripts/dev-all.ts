#!/usr/bin/env node
/**
 * Aldeano Build MCP - All-in-One Dev Runner
 * Checks if the Minecraft server is running on the target port; if not,
 * launches the server via scripts/minecraft/start-server.ts.
 * Once ready, starts the Dev Shell (or MCP server if --mcp flag is passed).
 */

import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, ChildProcess } from 'node:child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface DevAllOptions {
  host?: string;
  port?: number;
  username?: string;
  mcp?: boolean;
  timeout?: number;
}

export function checkPortInUse(
  port = 25565,
  host = '127.0.0.1',
  timeoutMs = 800
): Promise<boolean> {
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

    socket.connect(port, host);
  });
}

export async function waitForServer(
  port = 25565,
  host = '127.0.0.1',
  maxWaitMs = 60000,
  pollIntervalMs = 1000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const inUse = await checkPortInUse(port, host, 600);
    if (inUse) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

export async function runDevAll(options: DevAllOptions = {}): Promise<void> {
  const argv = yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
      default: options.host || '127.0.0.1',
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: options.port || 25565,
    })
    .option('username', {
      type: 'string',
      description: 'Bot username',
      default: options.username || 'LLMBot',
    })
    .option('mcp', {
      type: 'boolean',
      description: 'Start in MCP server mode instead of Dev Shell',
      default: options.mcp || false,
    })
    .option('timeout', {
      type: 'number',
      description: 'Max wait time for server in milliseconds',
      default: options.timeout || 60000,
    })
    .parseSync();

  const host = argv.host as string;
  const port = argv.port as number;
  const username = argv.username as string;
  const isMcp = argv.mcp as boolean;
  const timeout = argv.timeout as number;

  console.log('================================================================');
  console.log('             Aldeano Build MCP - Dev Environment               ');
  console.log('================================================================');
  console.log(` Target Server: ${host}:${port}`);
  console.log(` Bot Username:  ${username}`);
  console.log(` Target Mode:   ${isMcp ? 'MCP Server (stdio)' : 'Dev Shell (interactive REPL)'}`);
  console.log('================================================================\n');

  let serverProcess: ChildProcess | null = null;
  let launchedServer = false;

  const isRunning = await checkPortInUse(port, host);

  if (isRunning) {
    console.log(`[dev-all] ✔ Minecraft server is already running on ${host}:${port}.`);
  } else {
    console.log(`[dev-all] Minecraft server not detected on ${host}:${port}.`);
    console.log('[dev-all] Launching local server via scripts/minecraft/start-server.ts...');

    const mcDir = path.resolve(process.cwd(), '.dev', 'minecraft');
    const jarPath = path.join(mcDir, 'server.jar');

    if (!fs.existsSync(jarPath)) {
      console.log('[dev-all] Server JAR not found. Running setup via scripts/minecraft/setup-server.ts...');
      const setupScript = path.resolve(process.cwd(), 'scripts', 'minecraft', 'setup-server.ts');
      const setupChild = spawn(process.execPath, [
        path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        setupScript,
      ], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      await new Promise<void>((resolve, reject) => {
        setupChild.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Server setup exited with code ${code}`));
        });
      });
    }

    const startScript = path.resolve(process.cwd(), 'scripts', 'minecraft', 'start-server.ts');

    serverProcess = spawn(process.execPath, [
      path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      startScript,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    launchedServer = true;

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.includes('[server]') || text.includes('Done (') || text.includes('Loading')) {
        process.stdout.write(`[mc-server] ${text}`);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[mc-server] ${data.toString()}`);
    });

    serverProcess.on('exit', (code) => {
      if (launchedServer) {
        console.log(`[dev-all] Server process exited with code ${code ?? 0}`);
      }
    });

    console.log(`[dev-all] Waiting for Minecraft server to start on port ${port}...`);
    const ready = await waitForServer(port, host, timeout, 1000);

    if (!ready) {
      console.error(`\n[dev-all] ✖ Server failed to become ready on ${host}:${port} within ${timeout / 1000}s.`);
      if (serverProcess) {
        try {
          serverProcess.kill();
        } catch {
          // ignore
        }
      }
      process.exit(1);
    }

    console.log(`[dev-all] ✔ Minecraft server is ready on ${host}:${port}!\n`);
  }

  // Clean up server process when dev-all exits if we launched it
  const cleanup = () => {
    if (serverProcess && launchedServer) {
      console.log('\n[dev-all] Stopping background Minecraft server...');
      try {
        serverProcess.kill();
      } catch {
        // ignore
      }
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  // Launch target mode
  if (isMcp) {
    console.log('[dev-all] Starting Aldeano Build MCP Server mode...\n');
    const mainScript = path.resolve(process.cwd(), 'src', 'main.ts');
    const mcpProcess = spawn(process.execPath, [
      path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      mainScript,
      '--host', host,
      '--port', String(port),
      '--username', username,
    ], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    mcpProcess.on('exit', (code) => {
      cleanup();
      process.exit(code ?? 0);
    });
  } else {
    console.log('[dev-all] Starting Dev Shell...\n');
    const shellScript = path.resolve(process.cwd(), 'src', 'dev', 'dev-shell.ts');
    const shellProcess = spawn(process.execPath, [
      path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      shellScript,
      '--host', host,
      '--port', String(port),
      '--username', username,
    ], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    shellProcess.on('exit', (code) => {
      cleanup();
      process.exit(code ?? 0);
    });
  }
}

// Direct execution check
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (
  invokedFile === currentFile ||
  invokedFile.endsWith('dev-all.ts') ||
  invokedFile.endsWith('dev-all.js')
) {
  runDevAll().catch((err) => {
    console.error('\n[dev-all] Fatal error:', err);
    process.exit(1);
  });
}
