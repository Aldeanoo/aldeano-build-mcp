import { design, vox, W, D, MAX_Y, ORIGIN, HULL_X0, HULL_LEN } from './titanic-design.mts';
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';

const world = (x: number, y: number, z: number) => ({ x: ORIGIN.x + x, y: ORIGIN.y + y, z: ORIGIN.z + z });

type Cell = { x: number; y: number; z: number; b: string; phase: string };

/** Identical run-merging strategy to the builder: rows, then vertical stacking under 32768. */
export function compress(cells: Cell[]): FastCommandOperation[] {
  const rows = new Map<string, Cell[]>();
  for (const c of cells) { const rk = `${c.y},${c.z}`, r = rows.get(rk) ?? []; r.push(c); rows.set(rk, r); }
  const runs: Extract<FastCommandOperation, { type: 'fill' }>[] = [];
  for (const r of rows.values()) {
    r.sort((a, b) => a.x - b.x);
    for (let i = 0; i < r.length;) {
      let j = i;
      while (j + 1 < r.length && r[j + 1].x === r[j].x + 1 && r[j + 1].b === r[i].b) j++;
      runs.push({ type: 'fill', from: world(r[i].x, r[i].y, r[i].z), to: world(r[j].x, r[j].y, r[j].z), block: r[i].b });
      i = j + 1;
    }
  }
  const groups = new Map<string, typeof runs>();
  for (const op of runs) { const k = `${op.from.x},${op.to.x},${op.from.z},${op.block}`, g = groups.get(k) ?? []; g.push(op); groups.set(k, g); }
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
  return merged;
}

export { world };

if (process.argv[1]?.endsWith('titanic-dryrun.mts')) {
  const t0 = Date.now();
  const summary = design();
  const cells: Cell[] = [];
  for (const [k, b] of vox) {
    const [x, y, z] = k.split(',').map(Number);
    cells.push({ x, y, z, b, phase: 'x' });
  }
  const ops = compress(cells);
  let maxVol = 0, violations = 0;
  for (const op of ops) {
    if (op.type !== 'fill') continue;
    const v = (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
    if (v > maxVol) maxVol = v;
    if (v > 32768) violations++;
  }
  const names = [...new Set(cells.map(c => c.b.split('[')[0]))].sort();
  let minY = Infinity, maxY = -Infinity;
  for (const c of cells) { if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y; }
  console.log(JSON.stringify({
    stage: 'dryrun', ...summary,
    ops: ops.length, maxRunVolume: maxVol, limit: 32768, violations,
    yRange: [minY, maxY], distinctBlocks: names.length, ms: Date.now() - t0,
  }, null, 2));
  console.log('BLOCKS:', names.join(' '));
  console.log('HULL:', JSON.stringify({ x0: HULL_X0, len: HULL_LEN, reserve: [W, D], maxY: MAX_Y }));
  if (violations) { console.error('FAIL: run volume limit exceeded'); process.exit(1); }
}
