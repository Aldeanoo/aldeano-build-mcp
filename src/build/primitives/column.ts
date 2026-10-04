import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export function buildColumn(origin: BlockPosition, height: number, block: string, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  checkGenerationBounds(origin, { ...origin, y: origin.y + height - 1 }, limits);
  checkGenerationCount(height, limits);
  return Array.from({ length: Math.max(0, Math.floor(height)) }, (_, y) => ({
    position: { x: origin.x, y: origin.y + y, z: origin.z }, block, category: 'structural' as const
  }));
}
