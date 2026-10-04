import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { normalizeBounds } from '../build-types.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export function buildBox(from: BlockPosition, to: BlockPosition, block: string, hollow = false, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  const bounds = normalizeBounds(from, to);
  checkGenerationBounds(bounds.from, bounds.to, limits);
  const dx = bounds.to.x - bounds.from.x + 1, dy = bounds.to.y - bounds.from.y + 1, dz = bounds.to.z - bounds.from.z + 1;
  checkGenerationCount(dx * dy * dz - (hollow ? Math.max(0, dx - 2) * Math.max(0, dy - 2) * Math.max(0, dz - 2) : 0), limits);
  const result: BlockPlacement[] = [];
  for (let x = bounds.from.x; x <= bounds.to.x; x += 1) {
    for (let y = bounds.from.y; y <= bounds.to.y; y += 1) {
      for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
        const edge = x === bounds.from.x || x === bounds.to.x || y === bounds.from.y
          || y === bounds.to.y || z === bounds.from.z || z === bounds.to.z;
        if (!hollow || edge) result.push({ position: { x, y, z }, block, category: 'structural' });
      }
    }
  }
  return result;
}

export function buildHollowBox(from: BlockPosition, to: BlockPosition, block: string, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  return buildBox(from, to, block, true, limits);
}
