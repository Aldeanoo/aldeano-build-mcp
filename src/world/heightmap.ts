import type { RegionBounds } from '../build/build-types.js';
import type { BlockReader } from './block-reader.js';
import type { HeightmapResult } from './world-types.js';

export class Heightmap {
  constructor(private readonly reader: BlockReader) {}

  get(bounds: RegionBounds): HeightmapResult {
    const columns: HeightmapResult['columns'] = [];
    let min: number | null = null; let max: number | null = null;
    for (let x = bounds.from.x; x <= bounds.to.x; x += 1) for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
      let found: HeightmapResult['columns'][number] = { x, z, y: null };
      for (let y = bounds.to.y; y >= bounds.from.y; y -= 1) {
        const block = this.reader.getBlock({ x, y, z });
        if (block && !['air', 'cave_air', 'void_air'].includes(block.name)) { found = { x, z, y, block: block.name }; break; }
      }
      columns.push(found);
      if (found.y !== null) { min = min === null ? found.y : Math.min(min, found.y); max = max === null ? found.y : Math.max(max, found.y); }
    }
    return { bounds, min, max, columns };
  }
}
