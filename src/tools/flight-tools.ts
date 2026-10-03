// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { coerceCoordinates } from './coordinate-utils.js';
import { MovementService } from '../services/movement-service.js';
import { MovementError } from '../errors/index.js';
import type { BotOrGetter } from '../services/types.js';

export function registerFlightTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | MovementService
): void {
  const movementService = botOrService instanceof MovementService
    ? botOrService
    : new MovementService(botOrService);

  factory.registerTool('stop-flying', 'Cancel flight and restore normal gravity; does not teleport or guarantee a safe landing.', {}, async () => {
    movementService.stop();
    return factory.createResponse('Flight stopped; normal gravity restored');
  });

  factory.registerTool(
    "fly-to",
    "Make the bot fly to a specific position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate")
    },
    async ({ x, y, z }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      try {
        const result = await movementService.flyTo(x, y, z);
        return factory.createResponse(result.message ?? '');
      } catch (error) {
        if (error instanceof MovementError && error.message.includes("Creative mode is not available")) {
          return factory.createResponse(error.message);
        }
        return factory.createErrorResponse(error as Error);
      }
    }
  );
}
