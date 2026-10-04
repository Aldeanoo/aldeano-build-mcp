import type mineflayer from 'mineflayer';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import type { RegionBounds } from '../build/build-types.js';
import { enforceScanLimit } from './scan-limits.js';
import type { BlockReader } from './block-reader.js';
import { Heightmap } from './heightmap.js';
import type { RegionScanResult, WorldDetailLevel, WorldEntity } from './world-types.js';
import { normalizeWorldText } from './untrusted-content.js';

const INTERESTING = /ore|chest|spawner|portal|beacon|sign|bed|furnace|crafting_table|barrel|shulker_box/;

export class RegionScanner {
  constructor(private readonly botOrGetter: BotOrGetter, private readonly reader: BlockReader, private readonly maxBlocks: number) {}
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  scan(bounds: RegionBounds, detail: WorldDetailLevel = 'summary'): RegionScanResult {
    const volume = enforceScanLimit(bounds, this.maxBlocks);
    const palette: Record<string, number> = {};
    const blocks = [] as NonNullable<RegionScanResult['blocks']>;
    const interestingBlocks = [] as RegionScanResult['interestingBlocks'];
    const samples = new Map<string, RegionScanResult['interestingBlocks']>();
    for (let x = bounds.from.x; x <= bounds.to.x; x += 1) for (let y = bounds.from.y; y <= bounds.to.y; y += 1) for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
      const block = this.reader.getBlock({ x, y, z });
      if (!block) continue;
      palette[block.name] = (palette[block.name] ?? 0) + 1;
      if (detail === 'full') blocks.push(block);
      const list = samples.get(block.name) ?? [];
      if (list.length < 3) list.push(block);
      samples.set(block.name, list);
      if (INTERESTING.test(block.name) && interestingBlocks.length < 256) interestingBlocks.push(block);
    }
    const map = new Heightmap(this.reader, this.maxBlocks).get(bounds);
    return {
      bounds, detail, scannedBlocks: volume, palette,
      height: { min: map.min, max: map.max }, entities: this.entities(bounds), interestingBlocks,
      ...(detail === 'full' ? { blocks } : {}),
      ...(detail === 'compact' ? { compact: Object.entries(palette).map(([name, count]) => ({ name, count, sample: (samples.get(name) ?? []).map((item) => item.position) })) } : {})
    };
  }

  private entities(bounds: RegionBounds): WorldEntity[] {
    const origin = this.bot.entity.position;
    return Object.values(this.bot.entities).flatMap((entity) => {
      if (!entity || entity === this.bot.entity) return [];
      const { x, y, z } = entity.position;
      if (x < bounds.from.x || x > bounds.to.x || y < bounds.from.y || y > bounds.to.y || z < bounds.from.z || z > bounds.to.z) return [];
      return [{ id: entity.id, name: normalizeWorldText(entity.name ?? entity.username ?? 'unknown', 128), type: entity.type ?? 'unknown', position: { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }, distance: origin.distanceTo(entity.position), source: 'minecraft_world' as const, trusted: false as const }];
    });
  }
}
