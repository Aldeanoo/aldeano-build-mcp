import { regionVolume, type BlockPosition, type RegionBounds } from '../build/build-types.js';
import type { BlockReader } from './block-reader.js';
import type { HeightmapResult, WorldBlock } from './world-types.js';
import { enforceScanLimit } from './scan-limits.js';

export class HeightmapAccumulator {
  private readonly columns = new Map<string, { x: number; z: number; y: number | null; block?: string; readBlocks: number; highestUnavailable: number }>();

  constructor(private readonly bounds: RegionBounds) {
    for (let x = bounds.from.x; x <= bounds.to.x; x++) for (let z = bounds.from.z; z <= bounds.to.z; z++) {
      this.columns.set(`${x},${z}`, { x, z, y: null, readBlocks: 0, highestUnavailable: -Infinity });
    }
  }

  observe(position: BlockPosition, block: WorldBlock | null): void {
    const column = this.columns.get(`${position.x},${position.z}`)!;
    if (!block) { column.highestUnavailable = Math.max(column.highestUnavailable, position.y); return; }
    column.readBlocks++;
    if (!['air', 'cave_air', 'void_air'].includes(block.name) && (column.y === null || position.y > column.y)) {
      column.y = position.y;
      column.block = block.name;
    }
  }

  result(): HeightmapResult {
    const columnSize = this.bounds.to.y - this.bounds.from.y + 1;
    let min: number | null = null; let max: number | null = null; let readBlocks = 0;
    const columns: HeightmapResult['columns'] = [...this.columns.values()].map(({ highestUnavailable, ...column }) => {
      const unavailableBlocks = columnSize - column.readBlocks;
      readBlocks += column.readBlocks;
      if (column.y !== null) { min = min === null ? column.y : Math.min(min, column.y); max = max === null ? column.y : Math.max(max, column.y); }
      return { ...column, unavailableBlocks, status: unavailableBlocks === 0 ? 'complete' : column.readBlocks === 0 ? 'unavailable' : 'partial', heightKnown: unavailableBlocks === 0 || (column.y !== null && highestUnavailable < column.y) };
    });
    const requestedBlocks = regionVolume(this.bounds);
    return { bounds: this.bounds, min, max, columns, coverage: { version: 1, requestedBlocks, readBlocks, unavailableBlocks: requestedBlocks - readBlocks, complete: readBlocks === requestedBlocks } };
  }
}

export class Heightmap {
  constructor(private readonly reader: BlockReader, private readonly maxBlocks = 65_536) {}

  get(bounds: RegionBounds): HeightmapResult {
    enforceScanLimit(bounds, this.maxBlocks);
    const terrain = new HeightmapAccumulator(bounds);
    for (let x = bounds.from.x; x <= bounds.to.x; x += 1) for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
      for (let y = bounds.to.y; y >= bounds.from.y; y -= 1) {
        const block = this.reader.getBlock({ x, y, z });
        terrain.observe({ x, y, z }, block);
      }
    }
    return terrain.result();
  }
}
