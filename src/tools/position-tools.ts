// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { coerceCoordinates } from './coordinate-utils.js';
import { MovementService } from '../services/movement-service.js';
import type { BotOrGetter, MovementDirection } from '../services/types.js';

export function registerPositionTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | MovementService
): void {
  const movementService = botOrService instanceof MovementService
    ? botOrService
    : new MovementService(botOrService);

  factory.registerTool('movement.teleport', 'Bounded creative self-teleport with destination block predicates, confirmed arrival and clearance. Requires command permission.', {
    x:z.coerce.number().int(), y:z.coerce.number().int(), z:z.coerce.number().int()
  }, async ({x,y,z}:{x:number;y:number;z:number}) => factory.createResponse(JSON.stringify(await movementService.teleportTo(x,y,z))));

  factory.registerTool(
    "get-position",
    "Get the current position of the bot",
    {},
    async () => {
      const pos = movementService.getPosition();
      return factory.createResponse(`Current position: (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  );

  factory.registerTool(
    "move-to-position",
    "Move the bot to a specific position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
      range: z.coerce.number().finite().optional().describe("How close to get to the target (default: 1)"),
      timeoutMs: z.number().int().min(50).optional().describe("Timeout in milliseconds before cancelling (min: 50, default: no timeout)")
    },
    async ({ x, y, z, range = 1, timeoutMs }: { x: number; y: number; z: number; range?: number; timeoutMs?: number }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));
      const result = await movementService.moveToPosition(x, y, z, timeoutMs, range);
      return factory.createResponse(result.message ?? '');
    }
  );

  factory.registerTool(
    "look-at",
    "Make the bot look at a specific position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
    },
    async ({ x, y, z }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));
      const result = await movementService.lookAt(x, y, z);
      return factory.createResponse(result.message ?? '');
    }
  );

  factory.registerTool(
    "jump",
    "Make the bot jump",
    {},
    async () => {
      const result = await movementService.jump();
      return factory.createResponse(result.message ?? '');
    }
  );

  factory.registerTool(
    "move-in-direction",
    "Move the bot in a specific direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction to move"),
      duration: z.number().optional().describe("Duration in milliseconds (default: 1000)")
    },
    async ({ direction, duration = 1000 }: { direction: MovementDirection; duration?: number }) => {
      const result = await movementService.moveInDirection(direction, duration);
      return factory.createResponse(result.message ?? '');
    }
  );
}
