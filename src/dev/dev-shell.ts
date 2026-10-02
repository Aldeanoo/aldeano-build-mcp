#!/usr/bin/env node
/**
 * Aldeano Build MCP - Developer Shell (Dev Mode)
 * Interactive terminal REPL for controlling the Minecraft bot in real time.
 */

import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getConfig } from '../config.js';
import { MinecraftRuntime } from '../runtime/runtime.js';
import { executeCommand, parseCommandLine } from './commands.js';
import { formatBanner, formatError, colorize } from './formatter.js';

export interface DevShellOptions {
  host?: string;
  port?: number;
  username?: string;
  connectTimeout?: number;
}

export async function startDevShell(options: DevShellOptions = {}): Promise<void> {
  const config = getConfig();

  if (options.host) config.host = options.host;
  if (options.port) config.port = options.port;
  if (options.username) config.username = options.username;
  if (options.connectTimeout) config.connectTimeout = options.connectTimeout;

  console.log(colorize.dim(`Connecting to Minecraft server at ${config.host}:${config.port} as ${config.username}...`));

  const runtime = new MinecraftRuntime({ config });
  runtime.connect();

  const connectTimeoutMs = config.connectTimeout ?? 15000;

  try {
    await runtime.waitForReady(connectTimeoutMs);
  } catch (err) {
    console.error('\n' + formatError(err));
    console.error(colorize.yellow('\nPlease verify:'));
    console.error(`  1. Minecraft server is running on ${config.host}:${config.port}`);
    console.error('  2. Server version is compatible (e.g. 1.20.4 / 1.21)');
    console.error('  3. Run "npm run dev:all" to automatically start both the server and shell.');
    await runtime.disconnect();
    process.exit(1);
  }

  // Display required welcome banner
  console.log(
    formatBanner({
      host: config.host,
      port: config.port,
      username: config.username,
      connected: true,
    })
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const { command } = parseCommandLine(trimmed);

    if (command === 'exit' || command === 'quit') {
      console.log('Exiting dev shell. Goodbye!');
      rl.close();
      await runtime.disconnect();
      process.exit(0);
    }

    try {
      const output = await executeCommand(trimmed, runtime);
      if (output) {
        console.log(output);
      }
    } catch (err) {
      console.error(formatError(err));
    }

    rl.prompt();
  });

  const handleShutdown = async () => {
    console.log('\nExiting dev shell. Goodbye!');
    rl.close();
    await runtime.disconnect();
    process.exit(0);
  };

  rl.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  rl.on('close', async () => {
    await runtime.disconnect();
  });
}

// Direct execution check
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (
  invokedFile === currentFile ||
  invokedFile.endsWith('dev-shell.ts') ||
  invokedFile.endsWith('dev-shell.js')
) {
  startDevShell().catch(async (err) => {
    console.error(formatError(err));
    process.exit(1);
  });
}
