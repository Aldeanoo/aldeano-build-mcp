import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { benchmarkNames, getBenchmarkCase } from './cases.js';
import { normalizePlacements } from '../src/build/planner/normalize-placements.js';
import { placementPlan } from '../src/build/planner/placement-plan.js';
import { BuildPreflight } from '../src/build/verification/build-preflight.js';
import { ParallelFastExecutor } from '../src/build/executor/parallel-fast-executor.js';
import { compressVoxels } from '../src/build/executor/voxel-compressor.js';
import { blockArgument } from '../src/build/executor/execution-strategy.js';

const { pathfinder } = pathfinderPkg;
const args = process.argv.slice(2);
const offline = args.includes('--offline');
const names = args.includes('--all') ? benchmarkNames : [args.find(arg => !arg.startsWith('--')) ?? 'wall_30x10'];
const reportPath = args.find(arg => arg.startsWith('--report='))?.slice('--report='.length);
const host = process.env.MC_HOST ?? '127.0.0.1';
const port = Number(process.env.MC_PORT ?? 9999);
const username = process.env.MC_USERNAME ?? 'BenchmarkBot';

let bot: mineflayer.Bot | undefined;
interface Measurement { name: string; expectedBlocks: number; verifiedBlocks: number | null; commands: number; planningMs: number; durationMs: number; verifiedBlocksPerSecond: number | null; status: string; error?: string }
const results: Measurement[] = [];

async function waitForSpawn(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${host}:${port}`)), 15_000);
    bot!.once('spawn', () => { clearTimeout(timeout); resolve(); });
    bot!.once('error', (error) => { clearTimeout(timeout); reject(error); });
    bot!.once('kicked', (reason) => { clearTimeout(timeout); reject(new Error(`Kicked: ${JSON.stringify(reason)}`)); });
  });
}

async function main(): Promise<void> {
  if (!offline) {
    bot = mineflayer.createBot({ host, port, username, plugins: { pathfinder } });
    await waitForSpawn(); await bot.waitForChunksToLoad();
  }
  const anchor = bot ? bot.entity.position.floored().offset(16, 16, 16) : { x: 0, y: 64, z: 0 };
  for (const [index, name] of names.entries()) {
    const started = performance.now(), benchmark = getBenchmarkCase(name);
    const origin = { x: anchor.x + index * 64, y: anchor.y, z: anchor.z };
    const placements = normalizePlacements(benchmark.placements.map(p => ({ ...p, position: { x: p.position.x + origin.x, y: p.position.y + origin.y, z: p.position.z + origin.z } })));
    const plan = placementPlan(name, placements);
    const operations = compressVoxels(new Map(placements.map(p => [`${p.position.x},${p.position.y},${p.position.z}`, blockArgument(p)])), { x: 0, y: 0, z: 0 });
    const planningMs = performance.now() - started;
    const row: Measurement = { name, expectedBlocks: placements.length, verifiedBlocks: null, commands: operations.length, planningMs, durationMs: planningMs, verifiedBlocksPerSecond: null, status: offline ? 'planning-only' : 'failed' };
    try {
      if (bot) {
        // Read every site coordinate before placing. No world resets or silent overwrites.
        await new BuildPreflight(bot, 1_000_000, 45_000, undefined, true).inspectBounds(plan.boundingBox, 'fast');
        const result = await new ParallelFastExecutor([bot]).execute(operations, { commandsPerTick: 2, verifyAfterBuild: true });
        row.verifiedBlocks = result.verifiedBlocks; row.status = result.status;
        row.durationMs = performance.now() - started;
        row.verifiedBlocksPerSecond = result.verifiedBlocks / (row.durationMs / 1000);
      }
    } catch (error) { row.error = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
    results.push(row);
    console.log(`${name}: ${row.verifiedBlocks ?? 'no verificados'}/${row.expectedBlocks} bloques, ${row.commands} comandos, ${(row.durationMs / 1000).toFixed(2)}s, ${row.verifiedBlocksPerSecond?.toFixed(1) ?? 'N/A'} bloques verificados/s (${row.status})`);
    // A failed navigation/connection is not safe to continue using for later cases.
    if (row.error) break;
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => {
  const report = { version: 1, timestamp: new Date().toISOString(), mode: offline ? 'offline' : 'live', node: process.version, minecraft: bot?.version ?? null, executor: 'parallel-fast/1-worker/2-commands-per-tick', timing: 'planning + mandatory preflight + commands + verification + bounded repair', results };
  if (reportPath) { mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true }); writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8'); }
  bot?.quit();
});
