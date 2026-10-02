import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { EntityService } from '../services/entity-service.js';
import type { BotOrGetter } from '../services/types.js';

export function registerEntityTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | EntityService
): void {
  const entityService = botOrService instanceof EntityService
    ? botOrService
    : new EntityService(botOrService);

  factory.registerTool(
    "find-entity",
    "Find the nearest entity of a specific type",
    {
      type: z.string().optional().describe("Type of entity to find (empty for any entity)"),
      maxDistance: z.coerce.number().finite().optional().describe("Maximum search distance (default: 16)")
    },
    async ({ type = '', maxDistance = 16 }) => {
      const result = entityService.findEntity(type, maxDistance);
      return factory.createResponse(result.message);
    }
  );
}
