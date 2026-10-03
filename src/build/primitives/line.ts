import type { BlockPlacement, BlockPosition } from '../build-types.js';

export function buildLine(from: BlockPosition, to: BlockPosition, block: string): BlockPlacement[] {
  let x1 = Math.floor(from.x); let y1 = Math.floor(from.y); let z1 = Math.floor(from.z);
  const x2 = Math.floor(to.x); const y2 = Math.floor(to.y); const z2 = Math.floor(to.z);
  const dx = Math.abs(x2 - x1); const dy = Math.abs(y2 - y1); const dz = Math.abs(z2 - z1);
  const xs = x2 > x1 ? 1 : -1; const ys = y2 > y1 ? 1 : -1; const zs = z2 > z1 ? 1 : -1;
  const result: BlockPlacement[] = [];
  const add = () => result.push({ position: { x: x1, y: y1, z: z1 }, block, category: 'structural' });

  if (dx >= dy && dx >= dz) {
    let p1 = 2 * dy - dx; let p2 = 2 * dz - dx;
    while (x1 !== x2) { add(); x1 += xs; if (p1 >= 0) { y1 += ys; p1 -= 2 * dx; } if (p2 >= 0) { z1 += zs; p2 -= 2 * dx; } p1 += 2 * dy; p2 += 2 * dz; }
  } else if (dy >= dx && dy >= dz) {
    let p1 = 2 * dx - dy; let p2 = 2 * dz - dy;
    while (y1 !== y2) { add(); y1 += ys; if (p1 >= 0) { x1 += xs; p1 -= 2 * dy; } if (p2 >= 0) { z1 += zs; p2 -= 2 * dy; } p1 += 2 * dx; p2 += 2 * dz; }
  } else {
    let p1 = 2 * dy - dz; let p2 = 2 * dx - dz;
    while (z1 !== z2) { add(); z1 += zs; if (p1 >= 0) { y1 += ys; p1 -= 2 * dz; } if (p2 >= 0) { x1 += xs; p2 -= 2 * dz; } p1 += 2 * dy; p2 += 2 * dx; }
  }
  add();
  return result;
}
