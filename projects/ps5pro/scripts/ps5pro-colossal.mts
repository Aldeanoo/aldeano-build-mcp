// PS5 Pro COLOSSAL — vertical, solid, analytic row generation (no per-voxel map).
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { operationsPlan } from '../../../src/build/executor/parallel-fast-executor.js';
import { BuildCompletionService } from '../../../src/build/verification/build-completion.js';
// Scale 1cm = 9 blocks -> 348 x 81 x 195. Reuses the proven harness architecture:
// 4 disjoint X slabs, run compression under the 32768 cap, no sleeps, event-paced.
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { ParallelFastExecutor } from '../../../src/build/executor/parallel-fast-executor.js';
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';

const WHITE = 'white_concrete', QUARTZ = 'smooth_quartz', BLACK = 'black_concrete',
      GRAY = 'gray_concrete', LGRAY = 'light_gray_concrete', PBLACK = 'polished_blackstone',
      DEEP = 'deepslate_tiles', BLUE = 'light_blue_concrete';

// ─── DIMENSIONS (blocks) ────────────────────────────────────────────────────
const H = 348;            // body height
const BASE = 15;          // black foot
const BODYW = 81;         // max width
const BODYD = 195;        // max depth
const CENTER = 6;         // |x| <= CENTER is the black core column
const BAND_T = 0.44;      // bands centred on the middle third
const BAND_H = 6, BAND_GAP = 6, BAND_RAISE = 3;
const FILL_CAP = 32768;
const SITE = new Vec3(2000, 2, 2000);

// Half-extents for a given height fraction. Narrow foot, flare, waist, curved crown.
const halfAt = (t: number) => {
  const w = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.08)) - 0.10 * Math.exp(-((t - 0.62) ** 2) / 0.006);
  const d = 0.62 + 0.38 * Math.sin(Math.PI * (0.25 + t * 0.72));
  return { hw: Math.max(4, Math.round((BODYW * Math.max(0.42, w)) / 2)), hd: Math.max(8, Math.round((BODYD * Math.max(0.5, d)) / 2)) };
};
// For a row at |z|, how far out in x does the body still reach? Ellipse-like, so
// the x-extent is contiguous and the whole row is ONE run.
const xHalfAt = (hw: number, hd: number, az: number) => {
  if (az > hd) return 0;
  const a = Math.floor(((hw + 1) * (1 - az / hd)) / 0.28);
  return Math.max(0, Math.min(hw, a));
};

type Row = { y: number; z: number; x0: number; x1: number; b: string };
const rows: Row[] = [];
const vol = new Set<number>();       // rough volume accounting, per y-slice

function bodyRuns() {
  for (let y = BASE; y < BASE + H; y++) {
    const t = (y - BASE) / H;
    const { hw, hd } = halfAt(t);
    // Three black bands sit proud of the shell through the middle third.
    const rel = y - Math.round(BASE + H * BAND_T);
    const bandIdx = Math.floor(rel / (BAND_H + BAND_GAP));
    const inBand = rel >= 0 && bandIdx >= 0 && bandIdx < 3 && rel % (BAND_H + BAND_GAP) < BAND_H;
    const hdB = inBand ? hd + BAND_RAISE : hd;
    // Alternating y-bands get a quartz trim so the shell reads as panels, not noise.
    const trim = Math.floor(y / 12) % 2 === 0;
    for (let z = -hdB; z <= hdB; z++) {
      const xh = xHalfAt(hw, hd, Math.abs(z));
      if (xh < 1) continue;
      const outer = Math.abs(z) >= hd - 2;          // front/rear face
      const b = inBand ? BLACK : (outer && trim ? QUARTZ : WHITE);
      const c0 = Math.min(CENTER, xh), c1 = Math.max(-CENTER, -xh);
      if (c0 > c1) { rows.push({ y, z, x0: -xh, x1: xh, b }); }
      else {
        if (-xh <= -CENTER - 1) rows.push({ y, z, x0: -xh, x1: -CENTER - 1, b });
        rows.push({ y, z, x0: -CENTER, x1: CENTER, b: BLACK });
        if (CENTER + 1 <= xh) rows.push({ y, z, x0: CENTER + 1, x1: xh, b });
      }
      vol.add(y);
    }
  }
  // Black tapered foot.
  for (let y = 0; y < BASE; y++) {
    const r = Math.max(3, Math.round(27 * (1 - y / (BASE * 2.6))));
    for (let z = -r; z <= r; z++) {
      const xh = Math.round(r * Math.sqrt(Math.max(0, 1 - (z * z) / (r * r))));
      if (xh < 1) continue;
      rows.push({ y, z, x0: -xh, x1: xh, b: y === 0 ? PBLACK : BLACK });
    }
  }
}

// Detail generators: relative voxels, translated into place. Never one LLM call per block.
const details: FastCommandOperation[] = [];
const det = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: string) => {
  details.push({ type: 'fill', from: { x: SITE.x + x0, y: SITE.y + y0, z: SITE.z + z0 },
                 to: { x: SITE.x + x1, y: SITE.y + y1, z: SITE.z + z1 }, block: b });
};

function decorate() {
  const front = (t: number) => -halfAt(t).hd;
  const rear = (t: number) => halfAt(t).hd;
  const fy = Math.round(BASE + H * 0.30), fz = front(0.30) - 1;

  // Front: two USB-C receptacles with a rim, plus the power button.
  for (const cx of [-18, -6]) det(cx, fy, fz, cx + 11, fy + 5, fz + 2, PBLACK);
  for (const cx of [-18, -6]) det(cx - 1, fy - 1, fz, cx + 12, fy - 1, fz + 2, GRAY);
  det(8, fy, fz, 20, fy + 5, fz + 2, PBLACK);
  det(12, fy + 1, fz, 16, fy + 4, fz + 2, GRAY);
  det(11, fy + 6, fz, 17, fy + 8, fz + 2, LGRAY);          // power button

  // Rear I/O: 2x USB-A, Ethernet, HDMI OUT, power inlet.
  const ry = Math.round(BASE + H * 0.30), rz = rear(0.30) + 1;
  det(-24, ry, rz, -13, ry + 8, rz + 2, PBLACK);           // USB-A x2 pair
  det(-12, ry, rz, -2, ry + 8, rz + 2, PBLACK);
  det(-1, ry, rz, 12, ry + 8, rz + 2, DEEP);              // Ethernet
  det(13, ry, rz, 29, ry + 8, rz + 2, PBLACK);             // HDMI
  det(30, ry, rz, 40, ry + 10, rz + 2, GRAY);             // power inlet

  // Rear ventilation grille: black / dark-grey stripes over the rear face.
  for (let y = ry + 22; y < ry + 130; y += 9) {
    const t = (y - BASE) / H, { hd } = halfAt(t);
    for (const sx of [-34, -12, 10, 32]) {
      const z = rear(t) + 1;
      if (y + 8 >= BASE + H) break;
      det(sx, y, z, sx + 21, y + 4, z, y % 18 === 0 ? GRAY : BLACK);
    }
    void hd;
  }
  // Top vent grid.
  const ty = BASE + H - 1;
  for (let x = -27; x <= 27; x += 6) for (let z = -45; z <= 45; z += 6)
    det(x, ty, z, x + 3, ty, z + 3, x % 12 === 0 ? GRAY : BLACK);
  // Single restrained blue light line near the foot.
  const by = Math.round(BASE + H * 0.06);
  for (let y = by; y < by + 6; y++) det(-1, y, front((y - BASE) / H) - 1, 1, y, front((y - BASE) / H) - 1, BLUE);

  // PlayStation emblem, 24x24 pixel form on the upper white panel.
  const ly = Math.round(BASE + H * 0.80), lz = front(0.80) - 1, o = -12;
  const on = (x: number, y: number) => {
    if (x < 0 || x > 23 || y < 0 || y > 23) return;
    det(o + x, ly + y, lz, o + x, ly + y, lz, PBLACK);
  };
  // PlayStation emblem: ring + vertical spine + two arms + two lower quads.
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {          // top ring
    const dx = x - 11, dy = y - 7, r = Math.sqrt(dx * dx + dy * dy);
    if (r <= 6.5 && r >= 3.5) on(x, y);
  }
  for (let y = 0; y < 24; y++) on(11, y);                               // vertical spine
  for (let x = 12; x <= 23; x++) on(x, 12 - Math.floor((x - 12) / 3));  // upper-right arm
  for (let x = 12; x <= 23; x++) on(x, 12 + Math.floor((x - 12) / 3));  // lower-right arm
  for (let k = 0; k < 8; k++) on(10 - k, 15 + k);                       // lower-left quad
  for (let k = 0; k < 8; k++) on(10 - Math.floor(k / 2), 15 + k);       // lower-right quad
}

// ─── RUN COMPRESSION ────────────────────────────────────────────────────────
function bodyOps(): FastCommandOperation[] {
  const runs: FastCommandOperation[] = [];
  for (const r of rows) runs.push({
    type: 'fill',
    from: { x: SITE.x + r.x0, y: SITE.y + r.y, z: SITE.z + r.z },
    to: { x: SITE.x + r.x1, y: SITE.y + r.y, z: SITE.z + r.z },
    block: r.b,
  });
  // Merge identical X/Z runs vertically while under the fill cap.
  const groups = new Map<string, Extract<FastCommandOperation, { type: 'fill' }>[]>();
  for (const op of runs) {
    const k = `${op.from.x},${op.to.x},${op.from.z},${op.block}`;
    const g = groups.get(k) ?? []; g.push(op); groups.set(k, g);
  }
  const merged: FastCommandOperation[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.from.y - b.from.y);
    for (let i = 0; i < g.length;) {
      let j = i;
      while (j + 1 < g.length && g[j + 1].from.y === g[j].to.y + 1
        && (g[j + 1].to.y - g[i].from.y + 1) * (g[i].to.x - g[i].from.x + 1) <= FILL_CAP) j++;
      merged.push({ ...g[i], to: { ...g[i].to, y: g[j].to.y } });
      i = j + 1;
    }
  }
  for (const op of merged) {
    const v = (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
    if (v > FILL_CAP) throw Error(`Run volume ${v} exceeds cap ${FILL_CAP}`);
  }
  return merged;
}

// Phase 0: clear the whole reservation so the site is provably empty.
function clearOps(y0: number, y1: number): FastCommandOperation[] {
  const out: FastCommandOperation[] = [];
  for (let y = y0; y <= y1; y++) out.push({
    type: 'fill',
    from: { x: SITE.x - 44, y: SITE.y + y, z: SITE.z - 104 },
    to: { x: SITE.x + 44, y: SITE.y + y, z: SITE.z + 104 },
    block: 'air',
  });
  return out;
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────
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
  bodyRuns(); decorate();
  const body = bodyOps();
  const all = [...body, ...details];
  const topY = BASE + H;

  const v = (op: FastCommandOperation) => (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
  console.log(JSON.stringify({
    stage: 'designed', bodyCommands: body.length, detailCommands: details.length,
    totalCommands: all.length, placementVolume: all.reduce((a, o) => a + v(o), 0),
    dimensions: [BODYW, BASE + H, BODYD], heightOverCap: v(all[0]) > FILL_CAP ? 'CHECK' : 'ok',
  }));

  const master = await connect('PS5ProMaster');
  const unknown = [...new Set(all.map((o) => (o as { block: string }).block))].filter((n) => !master.registry.blocksByName[n.split('[')[0]]);
  if (unknown.length) throw Error(`Unknown blocks: ${unknown.join(', ')}`);

  for (let i = 1; i < 4; i++) await connect(`PS5ProWork${i}`);

  // Keep every chunk of the reservation resident. forceload is asynchronous:
  // the world must be told to load, then the region actually probed for air
  // before any fill can succeed — fills into unloaded chunks are silent no-ops.
  master.chat(`/forceload add ${SITE.x - 48} ${SITE.z - 112} ${SITE.x + 48} ${SITE.z + 112}`);
  await master.waitForTicks(40);
  let loaded = 0;
  for (let x = SITE.x - 44; x <= SITE.x + 44; x += 32) for (let z = SITE.z - 104; z <= SITE.z + 104; z += 32) {
    const blk = master.blockAt(new Vec3(x, SITE.y + 1, z));
    if (blk) loaded++; else console.log(JSON.stringify({ stage: 'chunk_unloaded', x, z }));
  }
  if (loaded === 0) throw Error('Reservation chunks never loaded — fills would be silent no-ops');
  console.log(JSON.stringify({ stage: 'chunks_loaded', loadedProbes: loaded }));

  // Four workers, each owning a disjoint X slab. The slab span must cover every
  // operation's real extent — details like the emblem and ports sit outside the
  // body — and runs are CUT at the borders, not filtered, or volume is lost.
  let opMinX = 1e9, opMaxX = -1e9;
  for (const op of all) {
    if (op.type !== 'fill') continue;
    opMinX = Math.min(opMinX, op.from.x); opMaxX = Math.max(opMaxX, op.to.x);
  }
  const span = opMaxX - opMinX + 1;
  const step = Math.ceil(span / 4);
  const slabBounds: number[] = [];
  for (let i = 0; i <= 4; i++) slabBounds.push(opMinX + Math.min(i * step, span));
  const cut = (ops: FastCommandOperation[]): FastCommandOperation[][] => {
    const out: FastCommandOperation[][] = [[], [], [], []];
    for (const op of ops) {
      if (op.type !== 'fill') continue;
      for (let i = 0; i < 4; i++) {
        const lo = Math.max(op.from.x, slabBounds[i]), hi = Math.min(op.to.x, slabBounds[i + 1] - 1);
        if (lo > hi) continue;
        out[i].push({ type: 'fill', from: { ...op.from, x: lo }, to: { ...op.to, x: hi }, block: op.block });
      }
    }
    return out;
  };

  // Phase 0 — clear, in Y-bands, world kept answering between bands.
  for (let y = 0; y < topY; y += 60) {
    const band = clearOps(y, Math.min(y + 59, topY - 1));
    const slabs = cut(band);
    await new ParallelFastExecutor(bots).execute(slabs.flat(), { commandsPerTick: 8 });
    await master.waitForTicks(5);
    // An unreadable probe means the chunk is not resident — that is a different
    // failure from an occupied site, and must not be reported as "clear failed".
    const probe = master.blockAt(new Vec3(SITE.x, SITE.y + y, SITE.z));
    if (!probe) throw Error(`Clear unverifiable at y=${y}: chunk not loaded`);
    if (!['air', 'cave_air', 'void_air'].includes(probe.name)) throw Error(`Clear failed at y=${y}: ${probe.name}`);
  }
  console.log(JSON.stringify({ stage: 'cleared', y0: SITE.y, y1: SITE.y + topY }));

  // Phase 1 — the console itself, then Phase 2 — details on top.
  const bodySlabs = cut(body);
  const detailSlabs = cut(details);
  const perWorker = bodySlabs.map((s, i) => s.length + detailSlabs[i].length);
  const srcVol = all.filter((o) => o.type === 'fill').reduce((a, o) => a + v(o), 0);
  const cutVol = [...bodySlabs, ...detailSlabs].flat().reduce((a, o) => a + v(o), 0);
  if (srcVol !== cutVol) throw Error(`Slab cut lost volume: ${srcVol} vs ${cutVol}`);
  console.log(JSON.stringify({ stage: 'partition', perWorker, volume: cutVol }));

  for (let i = 0; i < 4; i++) await tp(bots[i], new Vec3(Math.floor((slabBounds[i] + slabBounds[i + 1] - 1) / 2), SITE.y + 60, SITE.z));

  const t0 = Date.now();
  let last = 0;
  await new ParallelFastExecutor(bots).execute(bodySlabs.flat(), {
    commandsPerTick: 8,
    onProgress: (n, total) => { if (n - last >= 2000 || n === total) { last = n; console.log(JSON.stringify({ stage: 'body', n, total })); } },
  });
  const bodySecs = (Date.now() - t0) / 1000;
  await new ParallelFastExecutor(bots).execute(detailSlabs.flat(), { commandsPerTick: 8 });
  await master.waitForTicks(20);

  // Prove the result on the world itself, not from counters.
  let solid = 0, checked = 0, empty = 0;
  for (let y = 4; y < topY; y += 17) {
    const t = (y - BASE) / H, { hw, hd } = halfAt(Math.max(0, Math.min(1, t)));
    for (let z = -hd; z <= hd; z += 11) for (let x = -hw; x <= hw; x += 7) {
      const xh = xHalfAt(hw, hd, Math.abs(z));
      if (Math.abs(x) > xh) continue;
      const blk = master.blockAt(new Vec3(SITE.x + x, SITE.y + y, SITE.z + z));
      checked++;
      if (blk && !['air', 'cave_air', 'void_air'].includes(blk.name)) solid++; else empty++;
    }
  }
  const secs = (Date.now() - t0) / 1000;
  const final=await new BuildCompletionService(master).finalize(operationsPlan(all),{mode:'fast'});
  if(final.verification.correct!==final.verification.expected || final.verification.unreachable)throw Error('Colossal final verification incomplete');
  const result = {
    origin: SITE, dimensions: [BODYW, BASE + H, BODYD], workers: 4,
    bodyCommands: body.length, detailCommands: details.length,
    seconds: Math.round(secs * 10) / 10, bodySeconds: Math.round(bodySecs * 10) / 10,
    verifiedBlocks:final.verification.correct, expectedBlocks:final.verification.expected, placementVolume: srcVol, solidProbe: `${solid}/${checked}`, airPocketsFound: empty,
  };
  console.log(JSON.stringify({ stage: 'completed', ...result }));
  if (empty > 0) console.log(JSON.stringify({ stage: 'warning', airPockets: empty }));
}
run().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const b of bots) b.quit(); setTimeout(() => process.exit(process.exitCode ?? 0), 500); });
