import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { normalizeBounds } from '../build-types.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export function buildFloor(from: BlockPosition, to: BlockPosition, block: string, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  const bounds = normalizeBounds(from, to);
  const y = Math.floor(from.y);
  checkGenerationBounds({ ...bounds.from, y }, { ...bounds.to, y }, limits);
  checkGenerationCount((bounds.to.x - bounds.from.x + 1) * (bounds.to.z - bounds.from.z + 1), limits);
  const result: BlockPlacement[] = [];
  for (let x = bounds.from.x; x <= bounds.to.x; x += 1) {
    for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
      result.push({ position: { x, y, z }, block, category: 'floor' });
    }
  }
  return result;
}
