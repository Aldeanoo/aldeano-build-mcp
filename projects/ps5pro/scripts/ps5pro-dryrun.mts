// Offline dry-run for the PS5 Pro design. No Minecraft contact, no sockets.
import { Vec3 } from 'vec3';

const WHITE = 'white_concrete', QUARTZ = 'smooth_quartz', BLACK = 'black_concrete',
      GRAY = 'gray_concrete', LGRAY = 'light_gray_concrete', PBLACK = 'polished_blackstone',
      DEEP = 'deepslate_tiles', BLUE = 'light_blue_concrete';

const H = 116, BASE = 5, BODYW = 27, BODYD = 65;
const profile = (t: number) => {
  const w = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.08)) - 0.10 * Math.exp(-((t - 0.62) ** 2) / 0.006);
  const d = 0.62 + 0.38 * Math.sin(Math.PI * (0.25 + t * 0.72));
  return { w: Math.max(0.42, w), d: Math.max(0.5, d) };
};

const blocks = new Map<string, string>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function put(x: number, y: number, z: number, b: string) { blocks.set(key(x, y, z), b); }
const cut = (x: number, y: number, z: number, X: number, Y: number, Z: number) => {
  for (let i = x; i <= X; i++) for (let j = y; j <= Y; j++) for (let k = z; k <= Z; k++) blocks.delete(key(i, j, k));
};

function design() {
  for (let y = 0; y < BASE; y++) {
    const r = Math.max(1, Math.round(9 * (1 - y / (BASE * 2.6))));
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++)
      if (x * x + z * z <= r * r + 1) put(x, y, z, y === 0 ? PBLACK : BLACK);
  }
  for (let y = BASE; y < BASE + H; y++) {
    const t = (y - BASE) / H, p = profile(t);
    const halfW = Math.max(1, Math.round((BODYW * p.w) / 2)), halfD = Math.round((BODYD * p.d) / 2);
    for (let x = -halfW; x <= halfW; x++) {
      const edge = 1 - Math.abs(x) / (halfW + 1);
      const zMax = Math.round(halfD * (0.72 + 0.28 * edge));
      for (let z = -zMax; z <= zMax; z++) {
        const isCenter = Math.abs(x) <= 2;
        let mat = isCenter ? BLACK : WHITE;
        if (Math.abs(z) === zMax) mat = isCenter ? BLACK : (x % 3 === 0 ? QUARTZ : WHITE);
        put(x, y, z, mat);
      }
    }
  }
  const bandY0 = Math.round(BASE + H * 0.44);
  for (let b = 0; b < 3; b++) {
    const y0 = bandY0 + b * 4;
    for (let y = y0; y < y0 + 2; y++) {
      const t = (y - BASE) / H, p = profile(t);
      const halfW = Math.max(1, Math.round((BODYW * p.w) / 2)), halfD = Math.round((BODYD * p.d) / 2);
      for (let x = -halfW; x <= halfW; x++) {
        const zMax = Math.round(halfD * (0.72 + 0.28 * (1 - Math.abs(x) / (halfW + 1))));
        for (let z = -zMax; z <= zMax; z++) {
          if (Math.abs(x) >= halfW - 1) { blocks.delete(key(x, y, z)); continue; }
          put(x, y, z, b === 1 ? PBLACK : BLACK);
        }
      }
    }
  }
  const fy = Math.round(BASE + H * 0.30), fz = -Math.round((BODYD * profile(0.30).d) / 2) - 1;
  for (const cx of [-6, -2]) for (let i = 0; i < 4; i++)
    for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) put(cx + i, fy + y, fz + z, i === 0 || i === 3 ? GRAY : PBLACK);
  put(4, fy, fz, LGRAY); put(5, fy, fz, LGRAY); put(4, fy + 1, fz, GRAY);
  const ry = Math.round(BASE + H * 0.30), rz = Math.round((BODYD * profile(0.30).d) / 2) + 1;
  const io: Array<[number, number, string]> = [[-8, 4, PBLACK], [-3, 4, PBLACK], [2, 3, DEEP], [6, 5, GRAY], [12, 3, PBLACK]];
  for (const [ox, w, mat] of io) for (let i = 0; i < w; i++) for (let y = 0; y < 3; y++) put(ox + i, ry + y, rz, mat);
  for (let y = ry + 7; y < ry + 46; y += 3) for (let x = -10; x <= 10; x++) {
    const t = (y - BASE) / H, p = profile(t), halfW = Math.round((BODYW * p.w) / 2);
    const zz = Math.round((BODYD * p.d) / 2 * (0.72 + 0.28 * (1 - Math.abs(x) / (halfW + 1))));
    put(x, y, zz, y % 6 === 0 ? GRAY : BLACK);
  }
  for (let x = -6; x <= 6; x += 2) for (let z = -8; z <= 8; z += 2) put(x, BASE + H - 1, z, x % 4 === 0 ? GRAY : BLACK);
  const ly = Math.round(BASE + H * 0.86), lx = -4;
  const art = ['..##....', '.#..#...', '#....#..', '#.....#.', '##..#.#.', '.####...', '...##..#', '..#....#'];
  art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') put(lx + c, ly + 7 - r, -Math.round((BODYD * profile(0.86).d) / 2) - 1, PBLACK); }));
  for (let y = Math.round(BASE + H * 0.06); y < Math.round(BASE + H * 0.06) + 3; y++) put(0, y, -Math.round((BODYD * profile(0.06).d) / 2) - 1, BLUE);
}

function runsFor(o: Vec3) {
  const rows = new Map<string, Array<{ x: number; b: string }>>();
  for (const [k, b] of blocks) {
    const [x, y, z] = k.split(',').map(Number);
    const rk = `${y},${z}`, row = rows.get(rk) ?? [];
    row.push({ x, b }); rows.set(rk, row);
  }
  const runs: any[] = [];
  for (const [rk, row] of rows) {
    const y = Number(rk.split(',')[0]), z = Number(rk.split(',')[1]);
    row.sort((a, b) => a.x - b.x);
    for (let i = 0; i < row.length;) {
      let j = i;
      while (j + 1 < row.length && row[j + 1].x === row[j].x + 1 && row[j + 1].b === row[i].b) j++;
      runs.push({ from: { x: o.x + row[i].x, y: o.y + y, z: o.z + z }, to: { x: o.x + row[j].x, y: o.y + y, z: o.z + z }, block: row[i].b });
      i = j + 1;
    }
  }
  const groups = new Map<string, any[]>();
  for (const op of runs) { const k = `${op.from.x},${op.to.x},${op.from.z},${op.block}`, g = groups.get(k) ?? []; g.push(op); groups.set(k, g); }
  const merged: any[] = [];
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

design();
const o = new Vec3(2000, 2, 2000);
const merged = runsFor(o);
let worst = 0, over = 0;
for (const op of merged) {
  const v = (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
  worst = Math.max(worst, v);
  if (v > 32768) over++;
}
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
for (const k of blocks.keys()) {
  const [x, y, z] = k.split(',').map(Number);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
}
const w = maxX - minX + 1, h = maxY - minY + 1, d = maxZ - minZ + 1;
// Slab split check: rows span the full 28-wide body, so runs must be CUT at borders.
let opMinX = 1e9, opMaxX = -1e9;
for (const op of merged) { opMinX = Math.min(opMinX, op.from.x); opMaxX = Math.max(opMaxX, op.to.x); }
const span = opMaxX - opMinX + 1;
const step = Math.ceil(span / 4);
const bounds: number[] = [];
for (let i = 0; i <= 4; i++) bounds.push(opMinX + Math.min(i * step, span));
const vol = (op: any) => (Math.abs(op.to.x - op.from.x) + 1) * (Math.abs(op.to.y - op.from.y) + 1) * (Math.abs(op.to.z - op.from.z) + 1);
const slabs: any[][] = [[], [], [], []];
for (const op of merged) for (let i = 0; i < 4; i++) {
  const lo = Math.max(op.from.x, bounds[i]), hi = Math.min(op.to.x, bounds[i + 1] - 1);
  if (lo > hi) continue;
  slabs[i].push({ from: { ...op.from, x: lo }, to: { ...op.to, x: hi }, block: op.block });
}
const cutOps = slabs.flat();
const perWorker = slabs.map((s) => s.length);
const srcVol = merged.reduce((a, op) => a + vol(op), 0), cutVol = cutOps.reduce((a, op) => a + vol(op), 0);
const overlap = cutOps.some((a, i) => cutOps.some((b, j) => j > i && a.from.x <= b.to.x && b.from.x <= a.to.x
  && a.from.y <= b.to.y && b.from.y <= a.to.y && a.from.z <= b.to.z && b.from.z <= a.to.z));
console.log(JSON.stringify({
  blocks: blocks.size, commands: merged.length, worstRunVolume: worst, runsOverCap: over,
  bbox: { w, h, d },
  ratios: { heightToWidth: +(h / w).toFixed(2), heightToDepth: +(h / d).toFixed(2), target: { heightToWidth: 4.36, heightToDepth: 1.80 } },
  perWorker, cutCommands: cutOps.length, volumeMatch: srcVol === cutVol, srcVol, cutVol, overlap,
  materials: [...new Set(blocks.values())].sort(),
}, null, 2));
