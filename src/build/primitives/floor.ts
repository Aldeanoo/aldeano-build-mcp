import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { normalizeBounds } from '../build-types.js';

export function buildFloor(from: BlockPosition, to: BlockPosition, block: string): BlockPlacement[] {
  const bounds = normalizeBounds(from, to);
  const y = Math.floor(from.y);
  const result: BlockPlacement[] = [];
  for (let x = bounds.from.x; x <= bounds.to.x; x += 1) {
    for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
      result.push({ position: { x, y, z }, block, category: 'floor' });
    }
  }
  return result;
}
