// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { coerceCoordinates } from './coordinate-utils.js';
import { FurnaceService } from '../services/furnace-service.js';
import { FurnaceError } from '../errors/index.js';
import type { BotOrGetter } from '../services/types.js';

export function registerFurnaceTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | FurnaceService
): void {
  const furnaceService = botOrService instanceof FurnaceService
    ? botOrService
    : new FurnaceService(botOrService);

  factory.registerTool(
    "smelt-item",
    "Smelt items using a furnace-like block",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
      inputItem: z.string().trim().min(1).describe("Name of item to smelt"),
      inputCount: z.number().int().positive().optional().describe("Amount of input to smelt (default: 1)"),
      fuelItem: z.string().trim().min(1).describe("Name of fuel item"),
      fuelCount: z.number().int().positive().optional().describe("Amount of fuel to use (default: 1)"),
      takeOutput: z.boolean().optional().describe("Whether to take output when ready (default: true)"),
      timeoutMs: z.number().int().positive().optional().describe("Timeout waiting for output in ms (default: 60000)")
    },
    async ({
      x,
      y,
      z,
      inputItem,
      inputCount = 1,
      fuelItem,
      fuelCount = 1,
      takeOutput = true,
      timeoutMs = 60000
    }: {
      x: number;
      y: number;
      z: number;
      inputItem: string;
      inputCount?: number;
      fuelItem: string;
      fuelCount?: number;
      takeOutput?: boolean;
      timeoutMs?: number;
    }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      try {
        const result = await furnaceService.smeltItem(inputItem, fuelItem, inputCount, {
          x,
          y,
          z,
          fuelCount,
          takeOutput,
          timeoutMs
        });
        return factory.createResponse(result.message);
      } catch (error) {
        if (error instanceof FurnaceError) {
          return factory.createResponse(error.message);
        }
        throw error;
      }
    }
  );
}
