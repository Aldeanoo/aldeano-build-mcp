import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export function buildSphere(center: BlockPosition, radius: number, block: string, hollow = false, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  const result: BlockPlacement[] = [];
  const r = Math.max(0, Math.floor(radius));
  checkGenerationBounds({ x: center.x - r, y: center.y - r, z: center.z - r }, { x: center.x + r, y: center.y + r, z: center.z + r }, limits);
  const outer = (r + 0.5) ** 2;
  const inner = Math.max(0, r - 0.5) ** 2;
  for (let x = -r; x <= r; x += 1) {
    for (let y = -r; y <= r; y += 1) {
      for (let z = -r; z <= r; z += 1) {
        const d = x * x + y * y + z * z;
        if (d <= outer && (!hollow || d >= inner)) {
          checkGenerationCount(result.length + 1, limits);
          result.push({ position: { x: center.x + x, y: center.y + y, z: center.z + z }, block, category: 'structural' });
        }
      }
    }
  }
  return result;
}
