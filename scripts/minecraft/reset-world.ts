import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MC_DIR = path.resolve(process.cwd(), '.dev', 'minecraft');

export interface ResetWorldOptions {
  mcDir?: string;
  force?: boolean;
}

/**
 * Checks if Minecraft server is currently running by testing port 25565.
 */
export function isServerRunning(port = 25565, host = '127.0.0.1', timeoutMs = 800): Promise<boolean> {
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
 * Cleanly deletes Minecraft world data.
 */
export async function resetWorld(options: ResetWorldOptions = {}): Promise<{ deleted: string[]; aborted: boolean }> {
  const mcDir = options.mcDir || DEFAULT_MC_DIR;

  console.log('================================================================');
  console.log('       Aldeano Build MCP - Reset Local Test World Data          ');
  console.log('================================================================\n');

  // 1. Check if server is running
  const running = await isServerRunning(25565, '127.0.0.1');
  if (running && !options.force) {
    console.error('[ERROR] Minecraft server is currently active and listening on 127.0.0.1:25565.');
    console.error('Resetting the world while the server is running will cause corruption.');
    console.error('\nPlease stop the server first (Ctrl+C in the server terminal, or type "stop").');
    console.error('To force reset anyway, run with --force.\n');
    return { deleted: [], aborted: true };
  }

  // 2. Identify world directories
  const targetWorldDirs = [
    path.join(mcDir, 'world'),
    path.join(mcDir, 'world_nether'),
    path.join(mcDir, 'world_the_end')
  ];

  const deleted: string[] = [];

  for (const worldDir of targetWorldDirs) {
    if (fs.existsSync(worldDir)) {
      const folderName = path.basename(worldDir);
      console.log(`[reset] Removing directory: ${folderName}...`);
      try {
        fs.rmSync(worldDir, { recursive: true, force: true });
        deleted.push(folderName);
        console.log(`[reset] Successfully deleted: ${folderName}`);
      } catch (err: unknown) {
        console.error(`[reset] Failed to delete ${folderName}: ${(err as Error).message}`);
        throw err;
      }
    }
  }

  console.log('\n================================================================');
  if (deleted.length > 0) {
    console.log(` World reset complete! Deleted ${deleted.length} dimension folder(s):`);
    for (const item of deleted) {
      console.log(`  - ${item}`);
    }
    console.log('\nA fresh reproducible world will be generated automatically on next server start.');
  } else {
    console.log(' No world directories found in .dev/minecraft. World is already clean.');
  }
  console.log('================================================================\n');

  return { deleted, aborted: false };
}

// Direct execution check
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile === currentFile || invokedFile.endsWith('reset-world.ts') || invokedFile.endsWith('reset-world.js')) {
  const force = process.argv.includes('--force');
  resetWorld({ force }).then((result) => {
    if (result.aborted) {
      process.exit(1);
    }
    process.exit(0);
  }).catch((err) => {
    console.error('\n[ERROR] Reset world failed:', err);
    process.exit(1);
  });
}
