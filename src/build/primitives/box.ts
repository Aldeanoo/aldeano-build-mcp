import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { normalizeBounds } from '../build-types.js';

export function buildBox(from: BlockPosition, to: BlockPosition, block: string, hollow = false): BlockPlacement[] {
  const bounds = normalizeBounds(from, to);
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

export function buildHollowBox(from: BlockPosition, to: BlockPosition, block: string): BlockPlacement[] {
  return buildBox(from, to, block, true);
}
