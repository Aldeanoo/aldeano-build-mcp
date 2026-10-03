import { z } from 'zod';
import type { ToolFactory } from '../tool-factory.js';
import type { LocationMemory } from '../world/locations/location-memory.js';
import type { NavigationService, NavigationOptions } from '../world/navigation-service.js';
import type { PositionTuple } from '../build/build-types.js';
import { tupleToPosition } from '../build/build-types.js';

const position = z.tuple([z.coerce.number().int(), z.coerce.number().int(), z.coerce.number().int()]);
const json = (factory: ToolFactory, value: unknown) => factory.createResponse(JSON.stringify(value));

export function registerLocationTools(factory: ToolFactory, memory: LocationMemory, navigation: NavigationService): void {
  factory.registerTool('remember-location', 'Remember a named world location for this MCP session.', { name: z.string().min(1).max(64), position, description: z.string().max(256).optional() }, async ({ name, position: value, description }: { name: string; position: PositionTuple; description?: string }) => json(factory, { success: true, location: memory.remember(name, tupleToPosition(value), description) }));
  factory.registerTool('list-locations', 'List named locations remembered by the project session.', {}, async () => json(factory, { locations: memory.list() }));
  factory.registerTool('remove-location', 'Remove a named location.', { name: z.string().min(1) }, async ({ name }: { name: string }) => json(factory, { success: memory.remove(name), name }));
  factory.registerTool('go-to-location', 'Navigate to a remembered location with stuck detection and bounded retries.', { name: z.string().min(1), timeout: z.coerce.number().int().positive().max(300_000).optional() }, async ({ name, timeout }: { name: string; timeout?: number }) => {
    const location = memory.get(name); if (!location) return json(factory, { success: false, error: { code: 'LOCATION_NOT_FOUND', message: `Unknown location '${name}'` } });
    return json(factory, await navigation.navigateTo(location.position, { timeout }));
  });
  factory.registerTool('navigate-to', 'Navigate with bounded retries, path recalculation and environmental options.', {
    position, allowDigging: z.boolean().optional(), allowScaffolding: z.boolean().optional(), avoidWater: z.boolean().optional(), avoidLava: z.boolean().optional(), maxFallDistance: z.coerce.number().int().nonnegative().max(32).optional(), timeout: z.coerce.number().int().positive().max(300_000).optional()
  }, async ({ position: value, ...options }: { position: PositionTuple } & NavigationOptions) => json(factory, await navigation.navigateTo(tupleToPosition(value), options)));
}
