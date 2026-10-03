// PS5 Pro — vertical, solid, procedural. Design module: zero world contact.
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { BuildPreflight } from '../../../src/build/verification/build-preflight.js';
import { ParallelFastExecutor } from '../../../src/build/executor/parallel-fast-executor.js';
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';

const AIR = ['air', 'cave_air', 'void_air'];
const WHITE = 'white_concrete', QUARTZ = 'smooth_quartz', BLACK = 'black_concrete',
      GRAY = 'gray_concrete', LGRAY = 'light_gray_concrete', PBLACK = 'polished_blackstone',
      DEEP = 'deepslate_tiles', BLUE = 'light_blue_concrete';

// ─── GEOMETRY ───────────────────────────────────────────────────────────────
// 1 cm = 3 blocks → 116 × 27 × 65. Vertical: Y = height, X = width (thin), Z = depth.
const H = 116;          // total height
const BASE = 5;         // base height
const BODYW = 27;       // max body width
const BODYD = 65;       // max body depth

// The console stands on its round base; the body flares out at mid height and
// curves in at the top. Profiles are per-Y and stepped by at most 1 block.
const profile = (t: number) => {           // t in [0,1] along the body
  // narrow foot, flare at 0.35, slight waist at 0.62, broad shoulder, curved crown
  const w = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.08)) - 0.10 * Math.exp(-((t - 0.62) ** 2) / 0.006);
  const d = 0.62 + 0.38 * Math.sin(Math.PI * (0.25 + t * 0.72));
  return { w: Math.max(0.42, w), d: Math.max(0.5, d) };
};

const blocks = new Map<string, string>();
const prio = new Map<string, number>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function put(x: number, y: number, z: number, b: string, p = 30) {
  blocks.set(key(x, y, z), b);
  if (p > (prio.get(key(x, y, z)) ?? -1)) prio.set(key(x, y, z), p);
}
const cut = (x: number, y: number, z: number, X: number, Y: number, Z: number) => {
  for (let i = x; i <= X; i++) for (let j = y; j <= Y; j++) for (let k = z; k <= Z; k++) { blocks.delete(key(i, j, k)); prio.delete(key(i, j, k)); }
};

// Layer A: solid interior + base.
function design() {
  for (let y = 0; y < BASE; y++) {
    const r = Math.max(1, Math.round(9 * (1 - y / (BASE * 2.6))));  // tapered black foot
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++)
      if (x * x + z * z <= r * r + 1) put(x, y, z, y === 0 ? PBLACK : BLACK, 40);
  }

  for (let y = BASE; y < BASE + H; y++) {
    const t = (y - BASE) / H;
    const p = profile(t);
    const halfW = Math.max(1, Math.round((BODYW * p.w) / 2));
    const halfD = Math.round((BODYD * p.d) / 2);
    // Gentle curvature: front (z-) is slightly convex, rear (z+) flatter.
    for (let x = -halfW; x <= halfW; x++) {
      const edge = 1 - Math.abs(x) / (halfW + 1);
      const zMax = Math.round(halfD * (0.72 + 0.28 * edge));
      for (let z = -zMax; z <= zMax; z++) {
        const isCenter = Math.abs(x) <= 2;
        // Black central core column visible on the front face.
        let mat = isCenter ? BLACK : WHITE;
        if (Math.abs(z) === zMax) mat = isCenter ? BLACK : (x % 3 === 0 ? QUARTZ : WHITE);
        put(x, y, z, mat, 30);
      }
    }
  }

  // Layer E: three black bands across the central third.
  const bandY0 = Math.round(BASE + H * 0.44);
  for (let b = 0; b < 3; b++) {
    const y0 = bandY0 + b * 4;
    for (let y = y0; y < y0 + 2; y++) {
      const t = (y - BASE) / H, p = profile(t);
      const halfW = Math.max(1, Math.round((BODYW * p.w) / 2)), halfD = Math.round((BODYD * p.d) / 2);
      for (let x = -halfW; x <= halfW; x++) {
        const zMax = Math.round(halfD * (0.72 + 0.28 * (1 - Math.abs(x) / (halfW + 1))));
        for (let z = -zMax; z <= zMax; z++) {
          // Bands sit proud by 1 block on the shell, 1 block inward at the edges.
          const inward = Math.abs(x) >= halfW - 1;
          if (inward) { blocks.delete(key(x, y, z)); continue; }
          put(x, y, z, b === 1 ? PBLACK : BLACK, 40);
        }
      }
    }
  }

  // Layer F/G/H: front ports + power button, rear IO, top vents, logo.
  decorate();
}

// Generators emit relative voxels, then get translated — no LLM per-block.
function decorate() {
  // Front (z-): 2 USB-C, power button, thin centre line.
  const fy = Math.round(BASE + H * 0.30), fz = -Math.round((BODYD * profile(0.30).d) / 2) - 1;
  for (const cx of [-6, -2]) for (let i = 0; i < 4; i++) {
    for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) put(cx + i, fy + y, fz + z, i === 0 || i === 3 ? GRAY : PBLACK, 60);
  }
  put(4, fy, fz, LGRAY, 60); put(5, fy, fz, LGRAY, 60); put(4, fy + 1, fz, GRAY, 60);

  // Rear (z+): 2 USB-A, Ethernet, HDMI, power — spaced cluster.
  const ry = Math.round(BASE + H * 0.30), rz = Math.round((BODYD * profile(0.30).d) / 2) + 1;
  const io: Array<[number, number, string]> = [[-8, 4, PBLACK], [-3, 4, PBLACK], [2, 3, DEEP], [6, 5, GRAY], [12, 3, PBLACK]];
  for (const [ox, w, mat] of io) for (let i = 0; i < w; i++) for (let y = 0; y < 3; y++) put(ox + i, ry + y, rz, mat, 60);
  // Rear ventilation grille: black/dark-grey stripes over the rear face.
  for (let y = ry + 7; y < ry + 46; y += 3) for (let x = -10; x <= 10; x++) {
    const t = (y - BASE) / H, p = profile(t), halfW = Math.round((BODYW * p.w) / 2);
    const zz = Math.round((BODYD * p.d) / 2 * (0.72 + 0.28 * (1 - Math.abs(x) / (halfW + 1))));
    put(x, y, zz, y % 6 === 0 ? GRAY : BLACK, 50);
  }
  // Top vents.
  for (let x = -6; x <= 6; x += 2) for (let z = -8; z <= 8; z += 2) {
    const t = 1 - 0.001, p = profile(t);
    const yy = BASE + H - 1;
    put(x, yy, z, x % 4 === 0 ? GRAY : BLACK, 50);
  }
  // PlayStation logo on the upper white panel, 8×8 pixel form.
  const ly = Math.round(BASE + H * 0.86), lx = -4;
  const art = ['..##....', '.#..#...', '#....#..', '#.....#.', '##..#.#.', '.####...', '...##..#', '..#....#'];
  art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') put(lx + c, ly + 7 - r, -Math.round((BODYD * profile(0.86).d) / 2) - 1, PBLACK, 70); }));
  // Single subtle blue light line.
  for (let y = Math.round(BASE + H * 0.06); y < Math.round(BASE + H * 0.06) + 3; y++) put(0, y, -Math.round((BODYD * profile(0.06).d) / 2) - 1, BLUE, 65);
}

// ─── RUN COMPRESSION ────────────────────────────────────────────────────────
function operations(o: Vec3): FastCommandOperation[] {
  const rows = new Map<string, Array<{ x: number; b: string }>>();
  for (const [k, b] of blocks) {
    const [x, y, z] = k.split(',').map(Number);
    const rk = `${y},${z}`, row = rows.get(rk) ?? [];
    row.push({ x, b }); rows.set(rk, row);
  }
  const runs: FastCommandOperation[] = [];
  for (const [rk, row] of rows) {
    const y = Number(rk.split(',')[0]), z = Number(rk.split(',')[1]);
    row.sort((a, b) => a.x - b.x);
    for (let i = 0; i < row.length;) {
      let j = i;
      while (j + 1 < row.length && row[j + 1].x === row[j].x + 1 && row[j + 1].b === row[i].b) j++;
      runs.push({ type: 'fill', from: { x: o.x + row[i].x, y: o.y + y, z: o.z + z }, to: { x: o.x + row[j].x, y: o.y + y, z: o.z + z }, block: row[i].b });
      i = j + 1;
    }
  }
  const groups = new Map<string, Extract<FastCommandOperation, { type: 'fill' }>[]>();
  for (const op of runs) if (op.type === 'fill') {
    const k = `${op.from.x},${op.to.x},${op.from.z},${op.block}`, g = groups.get(k) ?? [];
    g.push(op); groups.set(k, g);
  }
  const merged: FastCommandOperation[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.from.y - b.from.y);
    for (let i = 0; i < g.length;) {
      let j = i;
      while (j + 1 < g.length && g[j + 1].from.y === g[j].to.y + 1 && (g[j + 1].to.y - g[i].from.y + 1) * (g[i].to.x - g[i].from.x + 1) <= 32768) j++;
      merged.push({ ...g[i], to: { ...g[i].to, y: g[j].to.y } });
      i = j + 1;
    }
  }
  for (const op of merged) if (op.type === 'fill') {
    const v = (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
    if (v > 32768) throw Error(`Run volume ${v} exceeds cap`);
  }
  return merged;
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────
const SITE = { x: 2000, y: 2, z: 2000 };
const bots: mineflayer.Bot[] = [];

async function connect(name: string) {
  const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: name, auth: 'offline' });
  bots.push(b);
  await new Promise<void>((res, rej) => { b.once('spawn', res); b.once('error', rej); b.once('kicked', (r) => rej(Error(String(r)))); });
  await b.waitForChunksToLoad();
  if (b.game.gameMode !== 'creative') throw Error('Creative mode required');
  return b;
}

async function tp(b: mineflayer.Bot, p: Vec3) {
  await new BoundedTeleportService(b).selfTo(p.floored());
}

async function run() {
  design();
  const o = new Vec3(SITE.x, SITE.y, SITE.z);
  const b0 = await connect('PS5ProMaster');
  const invalid = [...new Set(blocks.values())].filter((n) => !b0.registry.blocksByName[n.split('[')[0]]);
  if (invalid.length) throw Error(`Unknown blocks: ${invalid.join(', ')}`);

  // 4 workers, disjoint X slabs — no two workers ever write the same column.
  // The executor requires 1-4 bots, so the master IS worker 0 and three more join.
  const W4 = 4;
  for (let i = 1; i < W4; i++) {
    const w = await connect(`PS5ProWork${i}`);
    await tp(w, new Vec3(o.x + Math.round((i - 1.5) * 8), o.y + H + 12, o.z));
  }

  // Site preflight: the whole volume must read as air before a single block.
  const from = new Vec3(o.x - 20, o.y, o.z - 38), to = new Vec3(o.x + 20, o.y + BASE + H, o.z + 38);
  for (let x = from.x; x <= to.x; x += 64) for (let z = from.z; z <= to.z; z += 64) {
    const endX = Math.min(x + 63, to.x), endZ = Math.min(z + 63, to.z);
    await tp(b0, new Vec3(Math.floor((x + endX) / 2), o.y + 2, Math.floor((z + endZ) / 2)));
    const r = await new BuildPreflight(b0, 2_000_000, 45000).inspectBounds({ from: { x, y: o.y, z }, to: { x: endX, y: to.y, z: endZ } }, 'fast');
    console.log(JSON.stringify({ stage: 'preflight', scannedBlocks: r.scannedBlocks }));
  }

  // Split operations into 4 disjoint X-slabs. The console is only 28 wide but each
  // compressed row spans its full width, so runs must be CUT at slab borders —
  // filtering whole ops silently drops every run that straddles a boundary.
  const all = operations(o);
  let opMinX = 1e9, opMaxX = -1e9;
  for (const op of all) {
    if (op.type !== 'fill') continue;
    opMinX = Math.min(opMinX, op.from.x); opMaxX = Math.max(opMaxX, op.to.x);
  }
  const span = opMaxX - opMinX + 1;
  const step = Math.ceil(span / 4);
  const bounds: number[] = [];
  for (let i = 0; i <= 4; i++) bounds.push(opMinX + Math.min(i * step, span));

  const slabs: FastCommandOperation[][] = [[], [], [], []];
  for (const op of all) {
    if (op.type !== 'fill') continue;
    for (let i = 0; i < 4; i++) {
      const lo = Math.max(op.from.x, bounds[i]);
      const hi = Math.min(op.to.x, bounds[i + 1] - 1);
      if (lo > hi) continue;
      slabs[i].push({ type: 'fill', from: { ...op.from, x: lo }, to: { ...op.to, x: hi }, block: op.block });
    }
  }
  const perWorker = slabs.map((s) => s.length);
  const groups: FastCommandOperation[] = slabs.flat();
  // Coverage assertion: every sub-run volume must equal the source volume exactly once.
  const srcVol = all.reduce((a, op) => a + (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1), 0);
  const cutVol = groups.reduce((a, op) => a + (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1), 0);
  if (srcVol !== cutVol) throw Error(`Slab partition volume mismatch: source ${srcVol} vs cut ${cutVol}`);
  // No coordinate may be claimed by two slabs.
  const overlap = groups.some((a, i) => groups.some((b, j) => j > i
    && a.from.x <= b.to.x && b.from.x <= a.to.x
    && a.from.y <= b.to.y && b.from.y <= a.to.y
    && a.from.z <= b.to.z && b.from.z <= a.to.z));
  if (overlap) throw Error('Slab partition produced overlapping writes');
  console.log(JSON.stringify({ stage: 'partition', perWorker, total: groups.length, volume: srcVol }));

  const t0 = Date.now();
  let last = 0;
  await new ParallelFastExecutor(bots).execute(groups, {
    commandsPerTick: 8,
    onProgress: (n, total) => { if (n - last >= 500 || n === total) { last = n; console.log(JSON.stringify({ stage: 'building', commands: n, total })); } },
  });
  const secs = (Date.now() - t0) / 1000;

const verified=await finalizeVoxels(bots[0],blocks,o,{mode:'fast'});
  const result = {
    origin: o, dimensions: [BODYW, BASE + H, BODYD], blocks: blocks.size,
    commands: groups.length, seconds: Math.round(secs * 10) / 10,
    blocksPerSecond: Math.round(blocks.size / Math.max(secs, 0.001)),
    workers: 4, verifiedBlocks:verified.correct, expectedBlocks:verified.expected,
  };
  console.log(JSON.stringify({ stage: 'completed', ...result }));
}
run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { for (const b of bots) b.quit(); setTimeout(() => process.exit(process.exitCode ?? 0), 500); });
