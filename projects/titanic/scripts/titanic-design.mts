import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });

/** New build zone, far from the previous crater at (2500, *, 2500). */
export const W = 400, D = 400, MAX_Y = 154;
/** Measured superflat surface: grass_block at y = -61 (probed live). */
export const GROUND_Y = -61;
/** Reservation y=0 is the ground; ORIGIN.y maps reservation space onto world space. */
export const ORIGIN = { x: 5000, y: GROUND_Y, z: 5000 };
/** Keel one block above the ground; the ship stands on dry land, no water anywhere. */
export const KEEL = 1;

/** 270 long at 1 block = 1 metre (LOA 269.06 m). Beam widened to 40 for legibility:
 *  the real 28.19 m gives a 9.6:1 hull that reads as a sliver in Minecraft. */
export const HULL_X0 = 60, HULL_LEN = 270, HULL_ZC = 200, HULL_HB = 20;
export const MAIN_DECK = KEEL + 19;
export const BOAT_DECK = 35;
export const SS_X0 = 112, SS_X1 = 248;

export const vox = new Map<string, string>(), jobs = new Map<string, string>();
export const structures: Array<Record<string, unknown>> = [];
export const labels: Array<{ x: number; y: number; z: number; text: string }> = [];
let phase = 'titanic_hull';

export const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export const put = (x: number, y: number, z: number, b: string) => {
  if (x < 0 || x >= W || z < 0 || z >= D || y < 0 || y > MAX_Y)
    throw Error(`Design outside reservation ${x},${y},${z}`);
  const k = key(x, y, z); vox.set(k, b); jobs.set(k, phase);
};
export const box = (x: number, y: number, z: number, X: number, Y: number, Z: number, b: string) => {
  for (let i = x; i <= X; i++) for (let j = y; j <= Y; j++) for (let k = z; k <= Z; k++) put(i, j, k, b);
};
const label = (x: number, y: number, z: number, text: string) => labels.push({ x, y, z, text });

/* ── Hull geometry ────────────────────────────────────────────────────────── */

/** Half-beam: fine entry, long parallel midbody, elliptical run to a rounded transom.
 *  Ends at 40% beam, never 0 — the previous profile closed to zero and erased the stern. */
export const halfBeam = (t: number) => {
  if (t < 0.12) return HULL_HB * Math.sin((t / 0.12) * (Math.PI / 2));
  if (t < 0.72) return HULL_HB;
  const u = (t - 0.72) / 0.28;
  return HULL_HB * Math.sqrt(Math.max(0, 1 - u * u * 0.84));
};
/** Sheer: deck rises toward bow and stern, the curve that reads as a real hull. */
const sheer = (t: number) => 2.6 * Math.pow(Math.abs(t - 0.44) / 0.44, 1.7);
/** Rounded bilge: the hull pulls in below the waterline instead of being a slab. */
const bilge = (y: number) => (y <= 0 ? 0 : y <= 3 ? 3 - y : 0);

export const hullAt = (x: number) => {
  const i = x - HULL_X0;
  if (i < 0 || i >= HULL_LEN) return null;
  const t = i / (HULL_LEN - 1);
  return {
    t, w: Math.round(halfBeam(t)), sh: Math.round(sheer(t)),
    keel: KEEL, deck: MAIN_DECK + Math.round(sheer(t)),
    skin: Math.abs(t - 0.5) > 0.34 ? 1 : 2,
  };
};
/** Half-width at a given height, including bilge inset. */
const hullHalf = (h: { t: number; w: number }, y: number) => Math.max(1, h.w - bilge(y - KEEL));
const HULL_XC = () => HULL_X0 + Math.round(HULL_LEN * 0.34);

function hull() {
  phase = 'titanic_hull';
  for (let i = 0; i < HULL_LEN; i++) {
    const x = HULL_X0 + i, h = hullAt(x)!;
    if (h.w < 1) continue;
    for (let y = h.keel; y <= h.deck; y++) {
      const hw = hullHalf(h, y), skin = Math.min(h.skin, hw);
      // Red-oxide boot top below the waterline, black topsides, yellow sheer strake.
      const b = y === h.deck - 1 ? 'yellow_concrete' : y <= KEEL + 5 ? 'red_concrete' : 'black_concrete';
      for (let s = 0; s < skin; s++) { put(x, y, HULL_ZC + hw - s, b); put(x, y, HULL_ZC - hw + s, b); }
    }
    const dh = hullHalf(h, h.deck);
    for (let z = HULL_ZC - dh; z <= HULL_ZC + dh; z++) put(x, h.deck, z, 'light_gray_concrete');
    const bh = hullHalf(h, KEEL);
    for (let z = HULL_ZC - bh + 1; z <= HULL_ZC + bh - 1; z++) put(x, KEEL, z, 'iron_block');
    if (h.deck - 1 > KEEL + 1)
      for (let z = HULL_ZC - bh + 2; z <= HULL_ZC + bh - 2; z++) put(x, KEEL + 1, z, 'gray_concrete');
  }
  structures.push({ id: 'hull', kind: 'hull', length: HULL_LEN, beam: HULL_HB * 2, keelY: KEEL, deckY: MAIN_DECK });
  label(HULL_XC(), MAIN_DECK + 4, HULL_ZC, 'RMS TITANIC');
}

/* ── Superstructure: solid stepped tiers, no gap over the hull ─────────────── */

/** Rounded bow of the superstructure, same technique as the hull. */
const superHalf = (u: number, hw: number) => {
  if (u < 0.10) return hw * Math.sin((u / 0.10) * (Math.PI / 2));
  if (u > 0.93) return hw * Math.max(0.45, 1 - (u - 0.93) / 0.07 * 0.55);
  return hw;
};
/** Tiers stacked from the main deck up. The first starts at the hull deck itself,
 *  which is the fix for the floating-superstructure defect. */
const TIERS = [
  { y0: MAIN_DECK, y1: MAIN_DECK + 5, hw: 18, win: -1 },
  { y0: 26, y1: 28, hw: 17, win: 27 },
  { y0: 29, y1: 31, hw: 16, win: 30 },
  { y0: 32, y1: 34, hw: 15, win: 33 },
  { y0: 35, y1: 37, hw: 12, win: 36 },
  { y0: 38, y1: 40, hw: 9, win: 39 },
  { y0: 41, y1: 43, hw: 7, win: 42 },
];

function superstructure() {
  phase = 'titanic_superstructure';
  for (const t of TIERS) {
    const floor = t.y0 === MAIN_DECK ? 'oak_planks' : t.y0 === BOAT_DECK ? 'light_gray_concrete' : undefined;
    for (let x = SS_X0; x <= SS_X1; x++) {
      const u = (x - SS_X0) / (SS_X1 - SS_X0), w = Math.round(superHalf(u, t.hw));
      if (w < 1) continue;
      for (let y = t.y0; y <= t.y1; y++)
        for (let z = HULL_ZC - w; z <= HULL_ZC + w; z++) put(x, y, z, 'white_concrete');
      if (floor) for (let z = HULL_ZC - w; z <= HULL_ZC + w; z++) put(x, t.y0, z, floor);
      // Continuous window band: the promenade read.
      if (t.win > 0)
        for (let z = HULL_ZC - w; z <= HULL_ZC + w; z++) put(x, t.win, z, 'glass_pane');
    }
    structures.push({ id: `tier_${t.y0}`, kind: 'tier', y0: t.y0, y1: t.y1, halfWidth: t.hw });
  }
  // Bridge and officers' house: the blocky crowns that finish the silhouette.
  box(SS_X0 + 2, 44, HULL_ZC - 4, SS_X0 + 16, 44, HULL_ZC + 4, 'dark_oak_planks');
  for (const dz of [-4, 0, 4]) box(SS_X0 + 2, 45, HULL_ZC + dz, SS_X0 + 16, 45, HULL_ZC + dz, 'glass_pane');
  box(SS_X1 - 14, 44, HULL_ZC - 5, SS_X1 - 4, 46, HULL_ZC + 5, 'dark_oak_planks');
  for (let y = 44; y <= 46; y++) for (let z = HULL_ZC - 5; z <= HULL_ZC + 5; z += 2) put(SS_X1 - 4, y, z, 'glass_pane');
  label(HULL_XC(), BOAT_DECK + 7, HULL_ZC, 'HARLAND AND WOLFF  BELFAST  1912');
  label(SS_X0 + 4, 29, HULL_ZC, 'WHITE STAR LINE');
}

/* ── Funnels: slim, four, the fourth clearly shorter ──────────────────────── */

function funnel(x: number, top: number) {
  for (let y = BOAT_DECK + 1; y <= top; y++) {
    const r = y > BOAT_DECK + 9 ? 2 : 3;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const edge = Math.abs(dz) === r || Math.abs(dx) === r;
      if (y > top - 2 && !edge) continue;
      put(x + dx, y, HULL_ZC + dz, y > top - 4 ? 'black_concrete' : 'yellow_concrete');
    }
  }
  structures.push({ id: `funnel_${x}`, kind: 'funnel', x, top });
}
function funnels() {
  phase = 'titanic_funnel';
  const top = BOAT_DECK + 21;
  funnel(134, top); funnel(154, top); funnel(174, top); funnel(194, top - 5);
  structures.push({ id: 'funnel_group', kind: 'funnels', count: 4, note: 'fourth is the shorter dummy ventilator' });
}

/* ── Masts, cranes, ventilators ──────────────────────────────────────────── */

function mastCrane() {
  phase = 'titanic_mast_crane';
  for (const [x, above] of [[124, 22], [212, 16]] as const) {
    const top = BOAT_DECK + above;
    for (let y = BOAT_DECK + 1; y <= top; y++) put(x, y, HULL_ZC, 'dark_oak_log');
    box(x - 1, top, HULL_ZC - 1, x + 1, top, HULL_ZC + 1, 'dark_oak_log');
    for (const s of [-1, 1]) for (let t = 1; t <= 6; t++) {
      put(x + s * t, top - t, HULL_ZC, 'oak_fence');
      put(x, top - t, HULL_ZC + s * t, 'oak_fence');
    }
    structures.push({ id: `mast_${x}`, kind: 'mast', x, top });
  }
  // Cargo cranes between the funnels, with a walkable gantry.
  for (const cx of [144, 184]) {
    for (const s of [-1, 1]) {
      for (let y = BOAT_DECK + 1; y <= BOAT_DECK + 8; y++) put(cx, y, HULL_ZC + s * 8, 'dark_oak_log');
      put(cx, BOAT_DECK + 8, HULL_ZC + s * 5, 'dark_oak_log');
      for (let t = 1; t <= 4; t++) put(cx, BOAT_DECK + 8 - t, HULL_ZC + s * (5 + t - 1), 'oak_fence');
    }
    for (let y = BOAT_DECK + 8; y <= BOAT_DECK + 9; y++) for (let x = cx - 4; x <= cx + 4; x++) put(x, y, HULL_ZC, 'dark_oak_planks');
    structures.push({ id: `crane_${cx}`, kind: 'crane' });
  }
  // Cowl ventilators: the mushroom shapes that break up the boat deck.
  for (let i = 0; i < 10; i++) {
    const x = 120 + i * 12, z = HULL_ZC + (i % 2 === 0 ? 13 : -13);
    for (let y = BOAT_DECK + 1; y <= BOAT_DECK + 3; y++) put(x, y, z, 'iron_block');
    put(x, BOAT_DECK + 4, z, 'iron_block');
  }
}

/* ── Lifeboats in davits ─────────────────────────────────────────────────── */

function lifeboats() {
  phase = 'titanic_lifeboats';
  let count = 0;
  for (let i = 0; i < 8; i++) {
    const x = 146 + i * 11;
    for (const s of [-1, 1]) {
      const z = HULL_ZC + s * 11;
      for (let dx = -1; dx <= 1; dx++) put(x + dx, BOAT_DECK + 1, z, i % 2 === 0 ? 'white_wool' : 'oak_planks');
      for (let dz = -1; dz <= 1; dz++) { put(x + dz, BOAT_DECK, HULL_ZC + s * 12, 'dark_oak_log'); put(x + dz, BOAT_DECK + 2, HULL_ZC + s * 12, 'dark_oak_log'); }
      for (let y = BOAT_DECK + 1; y <= BOAT_DECK + 2; y++) put(x, y, HULL_ZC + s * 13, 'dark_oak_log');
      count++;
    }
  }
  structures.push({ id: 'lifeboats', kind: 'lifeboat', count, note: '16 boats in 8 davits' });
}

/* ── Details that fill the volume ─────────────────────────────────────────── */

function details() {
  phase = 'titanic_details';
  // Main-deck bulwark with deliberate gaps at bow and stern, not a solid fence.
  for (let i = 0; i < HULL_LEN; i++) {
    const x = HULL_X0 + i, h = hullAt(x)!;
    if (h.w < 2) continue;
    const hw = hullHalf(h, h.deck);
    const gap = h.t < 0.10 || h.t > 0.90 || (i % 7 === 0);
    if (gap) continue;
    put(x, h.deck + 1, HULL_ZC - hw, 'oak_fence');
    put(x, h.deck + 1, HULL_ZC + hw, 'oak_fence');
  }
  // Cargo hatches fore and aft of the funnels.
  for (const hx of [122, 132, 204, 214]) {
    for (let dx = 0; dx < 5; dx++) for (let dz = -4; dz <= 4; dz++) put(hx + dx, BOAT_DECK + 1, HULL_ZC + dz, 'dark_oak_planks');
    for (let dx = 1; dx < 4; dx++) put(hx + dx, BOAT_DECK + 2, HULL_ZC, 'oak_trapdoor[open=true]');
  }
  // Bollards along the main deck.
  for (let i = 0; i < 18; i++) {
    const x = HULL_X0 + 12 + i * 14, h = hullAt(x)!;
    if (h.w < 6) continue;
    for (const s of [-1, 1]) {
      const hw = hullHalf(h, h.deck);
      put(x, h.deck + 1, HULL_ZC + s * (hw - 1), 'dark_oak_log');
      put(x, h.deck + 2, HULL_ZC + s * (hw - 1), 'dark_oak_log');
    }
  }
  // Anchors and hawse pipes at the bow.
  for (const ax of [HULL_X0 + 8, HULL_X0 + 14]) {
    const h = hullAt(ax)!;
    for (const s of [-1, 1]) {
      const hw = hullHalf(h, KEEL + 8);
      box(ax, KEEL + 6, HULL_ZC + s * (hw + 1), ax + 1, KEEL + 9, HULL_ZC + s * (hw + 1), 'iron_block');
    }
  }
  // Stern: rudder and three propellers, the last structural detail the previous build lacked.
  const sx = HULL_X0 + HULL_LEN - 1, stern = hullAt(sx)!;
  for (let y = KEEL + 2; y <= stern.deck - 2; y++)
    for (const dz of [-3, 0, 3]) put(sx, y, HULL_ZC + dz, 'oak_planks');
  box(sx + 1, KEEL, HULL_ZC - 1, sx + 2, KEEL + 12, HULL_ZC + 1, 'iron_block');
  for (const [px, pz] of [[sx + 3, -6], [sx + 4, 0], [sx + 3, 6]] as const) {
    box(sx + 3, KEEL, HULL_ZC + pz - 1, sx + 4, KEEL, HULL_ZC + pz + 1, 'iron_block');
    for (const d of [-1, 1]) { put(sx + 3, KEEL + 1, HULL_ZC + pz + d, 'iron_block'); put(sx + 4, KEEL - 1, HULL_ZC + pz + d, 'iron_block'); }
  }
  // Stern promenade: a covered walk with windows, the detail the old stern lacked.
  for (let x = SS_X1 + 4; x <= HULL_X0 + HULL_LEN - 8; x++) {
    const h = hullAt(x)!; if (h.w < 3) continue;
    for (let y = h.deck + 1; y <= h.deck + 4; y++)
      for (const s of [-1, 1]) put(x, y, HULL_ZC + s * 4, y === h.deck + 2 ? 'glass_pane' : 'white_concrete');
    for (let z = HULL_ZC - 4; z <= HULL_ZC + 4; z++) put(x, h.deck + 4, z, 'light_gray_concrete');
  }
  structures.push({ id: 'rails', kind: 'railing' });
  structures.push({ id: 'anchors', kind: 'anchor' });
  structures.push({ id: 'rudder_and_screws', kind: 'propulsion' });
  structures.push({ id: 'stern_promenade', kind: 'promenade' });
  structures.push({ id: 'cargo_hatches', kind: 'hatch' });
}

export function design() {
  hull(); superstructure(); funnels(); mastCrane(); lifeboats(); details();
  const phases = [...new Set(jobs.values())];
  let minY = Infinity, maxY = -Infinity;
  for (const k of vox.keys()) { const y = Number(k.split(',')[1]); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  // Structural assertions: the previous build failed because nobody checked these.
  const mid = hullAt(HULL_X0 + 135)!;
  if (mid.w !== HULL_HB) throw Error(`Midbody beam wrong: ${mid.w} != ${HULL_HB}`);
  const stern = hullAt(HULL_X0 + HULL_LEN - 1)!;
  if (stern.w < HULL_HB * 0.3) throw Error(`Stern closed to ${stern.w} — transom missing`);
  const bow = hullAt(HULL_X0 + 1)!;
  if (bow.w < 1) throw Error('Bow has no width');
  if (TIERS[0].y0 !== MAIN_DECK) throw Error('Superstructure does not start at the hull deck — gap would reappear');
  writeFileSync(new URL('../artifacts/titanic-design-summary.json', import.meta.url), JSON.stringify({
    dimensions: [W, D], origin: ORIGIN, groundY: GROUND_Y, water: false,
    hull: { length: HULL_LEN, beam: HULL_HB * 2, x0: HULL_X0, zc: HULL_ZC, keelY: KEEL, deckY: MAIN_DECK, boatDeckY: BOAT_DECK },
    sternHalfBeam: stern.w, bowHalfBeam: bow.w, yRange: [minY, maxY],
    blocks: vox.size, structures, labels, phases,
    verifyAfterBuild: true, visualReview: false,
  }, null, 2));
  return { blocks: vox.size, phases, structures: structures.length, labels: labels.length, yRange: [minY, maxY], sternHalfBeam: stern.w };
}
