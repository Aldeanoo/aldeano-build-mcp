import { BuildLimitError, regionVolume, type RegionBounds } from '../build/build-types.js';

export function enforceScanLimit(bounds: RegionBounds, maxBlocks: number): number {
  const coordinates = [...Object.values(bounds.from), ...Object.values(bounds.to)];
  const volume = regionVolume(bounds);
  if (!coordinates.every(Number.isSafeInteger) || !Number.isSafeInteger(volume) || volume < 1 || volume > maxBlocks) {
    throw new BuildLimitError(`Scan volume ${volume} exceeds configured maximum of ${maxBlocks} or has invalid bounds`);
  }
  return volume;
}
