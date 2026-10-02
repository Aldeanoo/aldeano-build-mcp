import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MC_DIR = path.resolve(process.cwd(), '.dev', 'minecraft');
export const DEFAULT_MIN_MEMORY = process.env.MC_MEMORY_MIN || '1G';
export const DEFAULT_MAX_MEMORY = process.env.MC_MEMORY_MAX || '2G';

export interface StartServerOptions {
  mcDir?: string;
  minMemory?: string;
  maxMemory?: string;
  jvmArgs?: string[];
}

/**
 * Checks if a TCP port is currently listening.
 */
export function checkPortInUse(port = 25565, host = '127.0.0.1', timeoutMs = 800): Promise<boolean> {
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

/**
 * Spawns and manages the Minecraft development server.
 */
export async function startServer(options: StartServerOptions = {}): Promise<ChildProcess> {
  const mcDir = options.mcDir || DEFAULT_MC_DIR;
  const jarPath = path.join(mcDir, 'server.jar');

  console.log('================================================================');
  console.log('       Aldeano Build MCP - Starting Local Minecraft Server     ');
  console.log('================================================================\n');

  // 1. Verify server.jar exists
  if (!fs.existsSync(jarPath)) {
    console.error('\n[ERROR] Minecraft server jar not found at:');
    console.error(`  ${jarPath}`);
    console.error('\nPlease run "npm run mc:setup" first to download and prepare the server.');
    console.error('Command:');
    console.error('  npm run mc:setup\n');
    process.exit(1);
  }

  // 2. Check port status
  const portInUse = await checkPortInUse(25565, '127.0.0.1');
  if (portInUse) {
    console.warn('\n[WARN] Port 25565 is already in use by another process.');
    console.warn('If an existing Minecraft server is already running, please stop it or wait.\n');
  }

  // 3. Assemble JVM arguments
  const minMemory = options.minMemory || DEFAULT_MIN_MEMORY;
  const maxMemory = options.maxMemory || DEFAULT_MAX_MEMORY;
  const customJvmArgs = options.jvmArgs || [];

  const args: string[] = [
    `-Xms${minMemory}`,
    `-Xmx${maxMemory}`,
    '-XX:+UseG1GC',
    ...customJvmArgs,
    '-jar',
    'server.jar',
    'nogui'
  ];

  console.log(`[server] Working directory: ${mcDir}`);
  console.log(`[server] Launching: java ${args.join(' ')}\n`);

  // 4. Spawn Java process
  const child = spawn('java', args, {
    cwd: mcDir,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let isStopping = false;
  let isReady = false;

  // Stream stdout and detect readiness
  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);

    // Detect server ready pattern (Done (X.Xs)!)
    if (!isReady && /Done\s+\([0-9.]+s\)/i.test(text)) {
      isReady = true;
      console.log('\n================================================================');
      console.log('          Minecraft Local Dev Server is READY!                 ');
      console.log('================================================================');
      console.log('  Server Address: 127.0.0.1:25565');
      console.log('  Mode: Creative | Difficulty: Peaceful | Spawn-protection: 0');
      console.log('  Bot Connection: Ready for MCP bot connection (MCPBot)');
      console.log('  Stop server: Press Ctrl+C or type "stop" in console');
      console.log('================================================================\n');
    }
  });

  // Stream stderr
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk.toString());
  });

  // Handle errors
  child.on('error', (err) => {
    console.error('\n[ERROR] Failed to start Minecraft server process:', err);
    process.exit(1);
  });

  // Handle clean stop
  const stopServer = () => {
    if (isStopping) return;
    isStopping = true;

    console.log('\n[server] Shutting down Minecraft server cleanly (sending "stop" command)...');

    try {
      if (child.stdin?.writable) {
        child.stdin.write('stop\n');
      }
    } catch {
      // stdin might already be closed
    }

    const forceKillTimeout = setTimeout(() => {
      console.warn('[server] Server shutdown timed out (15s). Forcing termination...');
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, 15000);

    child.on('exit', () => {
      clearTimeout(forceKillTimeout);
      console.log('[server] Server stopped cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', stopServer);
  process.on('SIGTERM', stopServer);

  // Pipe user terminal input into server console if interactive
  if (process.stdin.isTTY) {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (input: string) => {
      if (!isStopping && child.stdin?.writable) {
        child.stdin.write(input);
      }
    });
  }

  child.on('exit', (code) => {
    if (!isStopping) {
      console.log(`\n[server] Server process exited with code ${code ?? 0}.`);
      process.exit(code ?? 0);
    }
  });

  return child;
}

// Direct execution check
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile === currentFile || invokedFile.endsWith('start-server.ts') || invokedFile.endsWith('start-server.js')) {
  startServer().catch((err) => {
    console.error('\n[ERROR] Error starting server:', err);
    process.exit(1);
  });
}
