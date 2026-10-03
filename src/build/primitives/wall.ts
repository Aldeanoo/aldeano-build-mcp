import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { buildLine } from './line.js';

export function buildWall(from: BlockPosition, to: BlockPosition, height: number, block: string): BlockPlacement[] {
  const result: BlockPlacement[] = [];
  for (let y = 0; y < Math.floor(height); y += 1) {
    result.push(...buildLine(
      { x: from.x, y: from.y + y, z: from.z },
      { x: to.x, y: to.y + y, z: to.z },
      block
    ).map((placement) => ({ ...placement, category: 'wall' as const })));
  }
  return result;
}
