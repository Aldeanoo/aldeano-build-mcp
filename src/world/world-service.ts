import type mineflayer from 'mineflayer';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import type { BlockPosition, RegionBounds } from '../build/build-types.js';
import { normalizeBounds } from '../build/build-types.js';
import { BlockReader } from './block-reader.js';
import { RegionScanner } from './region-scanner.js';
import { Heightmap } from './heightmap.js';
import { EnvironmentReader } from './environment.js';
import type { WorldDetailLevel, WorldEntity } from './world-types.js';
import { normalizeWorldText } from './untrusted-content.js';

export class WorldApiService {
  readonly reader: BlockReader;
  readonly scanner: RegionScanner;
  readonly heightmap: Heightmap;
  readonly environment: EnvironmentReader;

  constructor(private readonly botOrGetter: BotOrGetter, maxScanBlocks = 65_536) {
    this.reader = new BlockReader(botOrGetter);
    this.scanner = new RegionScanner(botOrGetter, this.reader, maxScanBlocks);
    this.heightmap = new Heightmap(this.reader, maxScanBlocks);
    this.environment = new EnvironmentReader(botOrGetter);
  }
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }
  getBlock(position: BlockPosition) { return this.reader.getBlock(position); }
  getRegion(from: BlockPosition, to: BlockPosition, detail: WorldDetailLevel = 'summary') { return this.scanner.scan(normalizeBounds(from, to), detail); }
  scanRegion(center: BlockPosition, radius: number, detail: WorldDetailLevel = 'summary') {
    const r = Math.max(0, Math.floor(radius));
    return this.getRegion({ x: center.x - r, y: center.y - r, z: center.z - r }, { x: center.x + r, y: center.y + r, z: center.z + r }, detail);
  }
  getHeightmap(from: BlockPosition, to: BlockPosition) { return this.heightmap.get(normalizeBounds(from, to)); }
  findBlocks(name: string, maxDistance = 16, count = 32): BlockPosition[] {
    const found = this.bot.findBlocks({ matching: (block) => block.name === name, maxDistance, count: Math.min(256, Math.max(1, count)) });
    return found.map(({ x, y, z }) => ({ x, y, z }));
  }
  getNearbyEntities(maxDistance = 32, entityType?: string): WorldEntity[] {
    const origin = this.bot.entity.position;
    return Object.values(this.bot.entities).flatMap((entity) => {
      if (!entity || entity === this.bot.entity || (entityType && entity.type !== entityType && entity.name !== entityType)) return [];
      const distance = origin.distanceTo(entity.position);
      if (distance > maxDistance) return [];
      return [{ id: entity.id, name: normalizeWorldText(entity.name ?? entity.username ?? 'unknown', 128), type: entity.type ?? 'unknown', position: { x: Math.floor(entity.position.x), y: Math.floor(entity.position.y), z: Math.floor(entity.position.z) }, distance, source: 'minecraft_world' as const, trusted: false as const }];
    }).sort((a, b) => a.distance - b.distance);
  }
  getEnvironment() { return this.environment.get(); }
}

export type { RegionBounds };
