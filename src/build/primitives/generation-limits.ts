import { BuildLimitError, regionVolume, normalizeBounds, type BlockPosition } from '../build-types.js';

export interface PrimitiveGenerationLimits {
  maxBlocks: number;
  maxQueue: number;
  maxDimension: number;
  maxPreflightBlocks: number;
}

/** Limit candidate work and output before constructing a placement array. */
export function checkGenerationBounds(from: BlockPosition, to: BlockPosition, limits?: PrimitiveGenerationLimits): void {
  if (!limits) return;
  const bounds = normalizeBounds(from, to);
  const dimensions = ['x', 'y', 'z'].map((axis) => bounds.to[axis as keyof BlockPosition] - bounds.from[axis as keyof BlockPosition] + 1);
  const volume = regionVolume(bounds);
  if (![...Object.values(from), ...Object.values(to)].every(Number.isSafeInteger)
    || !Number.isSafeInteger(volume) || volume < 1
    || Math.max(...dimensions) > limits.maxDimension || volume > limits.maxPreflightBlocks) {
    throw new BuildLimitError('Primitive dimensions or candidate volume exceed configured generation limits');
  }
}

export function checkGenerationCount(count: number, limits?: PrimitiveGenerationLimits): void {
  if (limits && (!Number.isSafeInteger(count) || count > Math.min(limits.maxBlocks, limits.maxQueue))) {
    throw new BuildLimitError(`Primitive generation exceeds configured maximum of ${Math.min(limits.maxBlocks, limits.maxQueue)} blocks`);
  }
}
