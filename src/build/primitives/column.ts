import type { BlockPlacement, BlockPosition } from '../build-types.js';

export function buildColumn(origin: BlockPosition, height: number, block: string): BlockPlacement[] {
  return Array.from({ length: Math.max(0, Math.floor(height)) }, (_, y) => ({
    position: { x: origin.x, y: origin.y + y, z: origin.z }, block, category: 'structural' as const
  }));
}
