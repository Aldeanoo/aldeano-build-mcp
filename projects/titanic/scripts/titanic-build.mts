import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {
  W, D, ORIGIN, GROUND_Y, KEEL, MAIN_DECK, HULL_X0, HULL_LEN,
  HULL_ZC, vox, jobs, labels, design,
} from './titanic-design.mts';
import { ParallelFastExecutor, partitionFastOperations } from '../../../src/build/executor/parallel-fast-executor.js';
import { compress, world } from './titanic-dryrun.mts';
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';

const STATE_FILE = new URL('../artifacts/titanic-progress.json', import.meta.url);
const WORKERS = 4, TILE = 48, SLAB = W / WORKERS;
/** Ship occupies reservation y 0..57. Clear a margin above it, never below the ground. */
const CLEAR_Y0 = 0, CLEAR_Y1 = 58;
const PHASES = ['titanic_hull', 'titanic_superstructure', 'titanic_funnel', 'titanic_mast_crane', 'titanic_lifeboats', 'titanic_details'];
/** Cadence. A /fill is up to 32,400 blocks, so 4 workers x 8/tick saturated the
 *  server and it dropped keepalives. 1/tick per worker keeps the parallel slabs alive. */
const COMMANDS_PER_TICK = 1;

type State = { origin: { x: number; y: number; z: number }; groundY: number; jobs: Record<string, { status: string; commands?: number; blocks?: number }>; labelsDone: boolean; started: string };
const prior = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8').replace(/^\uFEFF/, '')) : null;
/** Any prior progress belongs to the old water world; start clean. */
const state: State = { origin: ORIGIN, groundY: GROUND_Y, jobs: {}, labelsDone: false, started: new Date().toISOString() };
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const bots: mineflayer.Bot[] = [];
const commandErrors: string[] = [];

async function connect(name: string): Promise<mineflayer.Bot> {
  const bot = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: name, auth: 'offline', connectTimeout: 30000 });
  bots.push(bot);
  await new Promise<void>((res, rej) => { bot.once('spawn', res); bot.once('error', rej); bot.once('kicked', (r) => rej(Error(String(r)))); });
  if (bot.game.gameMode !== 'creative') throw Error('Creative mode required');
  return bot;
}

type Cell = { x: number; y: number; z: number; b: string; phase: string };
const byPhaseTile = new Map<string, Cell[]>();

function prepare() {
  for (const [k, b] of vox) {
    const [x, y, z] = k.split(',').map(Number);
    const worker = Math.floor(x / SLAB);
    const key = `${jobs.get(k) ?? 'titanic_hull'}:${worker}:${Math.floor((x - worker * SLAB) / TILE)}:${Math.floor(z / TILE)}`;
    const row = byPhaseTile.get(key) ?? [];
    row.push({ x, y, z, b, phase: jobs.get(k) ?? '' });
    byPhaseTile.set(key, row);
  }
}

/** Park every worker above its own slab. Reservation y=0 is the ground, so park well above the mast. */
async function positionAll(tz: number) {
  const y = 60;
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const x = Math.min(W - 1, Math.floor((i + 0.5) * SLAB));
    const z = Math.min(D - 1, tz + TILE / 2);
    const p = world(x, y, z);
    await new BoundedTeleportService(bot).selfTo(p);
  }
}

async function submit(ops: FastCommandOperation[]): Promise<number> {
  if (!ops.length) return 0;
  const parts = partitionFastOperations(ops, WORKERS);
  await Promise.all(bots.map(async (bot, w) => {
    let i = 0;
    while (i < parts[w].length) {
      await new ParallelFastExecutor([bot]).execute(parts[w].slice(i, i + 16), { commandsPerTick: COMMANDS_PER_TICK });
      i += 16;
    }
  }));
  return ops.length;
}

/** Air-fill the ship's bounding volume. Never touches anything below the ground plane. */
function clearOps(): FastCommandOperation[] {
  const zWidth = Math.max(1, Math.floor(32768 / W));
  const out: FastCommandOperation[] = [];
  for (let y = CLEAR_Y0; y <= CLEAR_Y1; y++)
    for (let z = 0; z < D; z += zWidth)
      out.push({ type: 'fill', from: world(0, y, z), to: world(W - 1, y, Math.min(D - 1, z + zWidth - 1)), block: 'air' });
  return out;
}

async function clearSite() {
  if (state.jobs.site_clear?.status === 'complete') return;
  await positionAll(0);
  const commands = await submit(clearOps());
  state.jobs.site_clear = { status: 'complete', commands };
  save();
  console.log(JSON.stringify({ stage: 'site_cleared', commands, yRange: [CLEAR_Y0, CLEAR_Y1] }));
}

async function phases() {
  for (const phase of PHASES) {
    const keys = [...byPhaseTile.keys()].filter(k => k.startsWith(`${phase}:`));
    let done = 0;
    for (const k of keys) {
      const id = k.replace(/:/g, '_');
      if (state.jobs[id]?.status === 'complete') { done++; continue; }
      const cells = byPhaseTile.get(k)!;
      const tileZ = Number(k.split(':')[3]) * TILE;
      await positionAll(tileZ);
      const ops = compress(cells);
      state.jobs[id] = { status: 'running', blocks: cells.length, commands: ops.length };
      save();
      await submit(ops);
      state.jobs[id].status = 'complete';
      save();
      done++;
    }
    console.log(JSON.stringify({ stage: 'phase_complete', phase, tiles: keys.length, completed: done }));
  }
}

async function summonLabels() {
  if (state.labelsDone) return;
  const bot = bots[0];
  for (const l of labels) {
    const p = world(l.x, l.y, l.z);
    const text = JSON.stringify(JSON.stringify({ text: l.text, color: 'black' }));
    bot.chat(`/summon minecraft:text_display ${p.x} ${p.y} ${p.z} {Tags:["titanic_benchmark"],billboard:"center",background:2003202047,line_width:300,text:${text},transformation:{scale:[2f,2f,2f]}}`);
    await new Promise<void>(r => setTimeout(r, 200));
  }
  state.labelsDone = true;
  save();
  console.log(JSON.stringify({ stage: 'labels', count: labels.length }));
}

async function run() {
  const summary = design();
  console.log(JSON.stringify({ stage: 'designed', ...summary, groundY: GROUND_Y, water: false }));
  prepare();

  const master = await connect('TitanicMaster');
  for (const bot of bots) bot.on('message', (msg: { toString(): string }) => {
    const m = msg.toString();
    if (/error|unknown|outside|too many|expected/i.test(m)) commandErrors.push(m.slice(0, 160));
  });
  const unknown = [...new Set(vox.values())].map(n => n.split('[')[0]).filter(n => !master.registry.blocksByName[n]);
  if (unknown.length) throw Error(`Unknown construction blocks: ${unknown.join(', ')}`);
  console.log(JSON.stringify({ stage: 'blocks_validated', distinct: new Set([...vox.values()].map(v => v.split('[')[0])).size, allValid: true }));

  for (let i = 1; i < WORKERS; i++) await connect(`TitanicWorker${i}`);
  console.log(JSON.stringify({ stage: 'workers_connected', count: bots.length }));

  await clearSite();
  await phases();
  await summonLabels();

const verified=await finalizeVoxels(master,vox,state.origin,{mode:'fast'});
  const result = {
    verifiedBlocks:verified.correct, expectedBlocks:verified.expected, completed: true, origin: state.origin, groundY: GROUND_Y,
    dimensions: { xSpan: W, zSpan: D }, water: false,
    hull: { length: HULL_LEN, beam: 28, keelY: KEEL, deckY: MAIN_DECK },
    designBlocks: summary.blocks, phases: PHASES.length, labels: labels.length,
    commandErrors: commandErrors.length,
    completedJobs: Object.values(state.jobs).filter(s => s.status === 'complete').length,
    pendingJobs: Object.values(state.jobs).filter(s => s.status !== 'complete').length,
    verifyAfterBuild: true, visualReview: false, finished: new Date().toISOString(),
  };
  writeFileSync(new URL('../artifacts/titanic-result.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ stage: 'completed', ...result }));
  if (commandErrors.length) console.log('COMMAND_ERRORS:', JSON.stringify(commandErrors.slice(0, 10), null, 2));
}

run()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const b of bots) b.quit(); setTimeout(() => process.exit(process.exitCode ?? 0), 1500); });
