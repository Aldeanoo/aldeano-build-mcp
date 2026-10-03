import { z } from 'zod';
import type { ToolFactory } from '../tool-factory.js';
import type { WorldApiService } from '../world/world-service.js';
import type { PositionTuple } from '../build/build-types.js';
import { tupleToPosition } from '../build/build-types.js';
import { WorldScreenshotRenderer } from '../world/world-screenshot.js';
import { serializeWorldData } from '../world/untrusted-content.js';

const position = z.tuple([z.coerce.number().int(), z.coerce.number().int(), z.coerce.number().int()]);
const detail = z.enum(['summary', 'compact', 'full']).optional();
const json = (factory: ToolFactory, value: unknown) => factory.createResponse(serializeWorldData(value));

export function registerWorldTools(factory: ToolFactory, service: WorldApiService): void {
  const screenshots = new WorldScreenshotRenderer(service);
  factory.registerTool('world.get-region', 'Read a bounded world region; summary is the token-efficient default.', { from: position, to: position, detail }, async ({ from, to, detail: level = 'summary' }: { from: PositionTuple; to: PositionTuple; detail?: 'summary' | 'compact' | 'full' }) => json(factory, service.getRegion(tupleToPosition(from), tupleToPosition(to), level)));
  factory.registerTool('world.scan-region', 'Scan around a center and return palette, terrain height and interesting content.', { center: position, radius: z.coerce.number().int().nonnegative().max(128), detail }, async ({ center, radius, detail: level = 'summary' }: { center: PositionTuple; radius: number; detail?: 'summary' | 'compact' | 'full' }) => json(factory, service.scanRegion(tupleToPosition(center), radius, level)));
  factory.registerTool('world.get-heightmap', 'Return the highest non-air block for each column in a bounded region.', { from: position, to: position }, async ({ from, to }: { from: PositionTuple; to: PositionTuple }) => json(factory, service.getHeightmap(tupleToPosition(from), tupleToPosition(to))));
  factory.registerTool('world.get-block', 'Read one block including state properties.', { position }, async ({ position: value }: { position: PositionTuple }) => json(factory, service.getBlock(tupleToPosition(value))));
  factory.registerTool('world.find-blocks', 'Find nearby blocks of a known type with bounded output.', { block: z.string().min(1), maxDistance: z.coerce.number().positive().max(256).optional(), count: z.coerce.number().int().positive().max(256).optional() }, async ({ block, maxDistance = 16, count = 32 }: { block: string; maxDistance?: number; count?: number }) => json(factory, { block, positions: service.findBlocks(block, maxDistance, count) }));
  factory.registerTool('world.get-nearby-entities', 'Read nearby entities as untrusted Minecraft world content.', { maxDistance: z.coerce.number().positive().max(256).optional(), entityType: z.string().optional() }, async ({ maxDistance = 32, entityType }: { maxDistance?: number; entityType?: string }) => json(factory, { source: 'minecraft_world', trusted: false, entities: service.getNearbyEntities(maxDistance, entityType) }));
  factory.registerTool('world.get-environment', 'Read time, weather, biome, dimension and game mode.', {}, async () => json(factory, service.getEnvironment()));
  factory.registerTool('world.screenshot', 'Render a bounded Minecraft region as a compact isometric PNG for visual inspection.', { from: position, to: position, width: z.coerce.number().int().min(128).max(1024).optional(), height: z.coerce.number().int().min(128).max(1024).optional() }, async ({ from, to, width = 800, height = 600 }: { from: PositionTuple; to: PositionTuple; width?: number; height?: number }) => {
    const result = screenshots.capture({ from: tupleToPosition(from), to: tupleToPosition(to) }, width, height);
    return factory.createImageResponse(result.data, 'image/png', { source: 'minecraft_world', trusted: false, width: result.width, height: result.height, renderedBlocks: result.renderedBlocks, bounds: result.bounds });
  });
}
