import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { buildLine } from './line.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export function buildWall(from: BlockPosition, to: BlockPosition, height: number, block: string, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  checkGenerationBounds(
    { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), z: Math.min(from.z, to.z) },
    { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y) + height - 1, z: Math.max(from.z, to.z) }, limits,
  );
  checkGenerationCount((Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), Math.abs(to.z - from.z)) + 1) * height, limits);
  const result: BlockPlacement[] = [];
  for (let y = 0; y < Math.floor(height); y += 1) {
    for (const placement of buildLine(
      { x: from.x, y: from.y + y, z: from.z },
      { x: to.x, y: to.y + y, z: to.z },
      block
    )) result.push({ ...placement, category: 'wall' });
  }
  return result;
}
