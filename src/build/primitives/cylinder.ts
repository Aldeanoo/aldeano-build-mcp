import type { BlockPlacement, BlockPosition } from '../build-types.js';

export function buildCylinder(center: BlockPosition, radius: number, height: number, block: string, hollow = false): BlockPlacement[] {
  const result: BlockPlacement[] = [];
  const r = Math.max(0, Math.floor(radius));
  const outer = (r + 0.5) ** 2;
  const inner = Math.max(0, r - 0.5) ** 2;
  for (let y = 0; y < Math.max(0, Math.floor(height)); y += 1) {
    for (let x = -r; x <= r; x += 1) {
      for (let z = -r; z <= r; z += 1) {
        const d = x * x + z * z;
        if (d <= outer && (!hollow || d >= inner)) {
          result.push({ position: { x: center.x + x, y: center.y + y, z: center.z + z }, block, category: 'structural' });
        }
      }
    }
  }
  return result;
}
