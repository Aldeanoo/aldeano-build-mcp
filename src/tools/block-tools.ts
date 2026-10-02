import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { coerceCoordinates } from './coordinate-utils.js';
import { BlockService } from '../services/block-service.js';
import { BlockDigError, BlockError, BlockPlacementError } from '../errors/index.js';
import type { BotOrGetter, FaceDirection } from '../services/types.js';

export function registerBlockTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | BlockService
): void {
  const blockService = botOrService instanceof BlockService
    ? botOrService
    : new BlockService(botOrService);

  factory.registerTool(
    "place-block",
    "Place a block at the specified position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
      faceDirection: z.enum(['up', 'down', 'north', 'south', 'east', 'west']).optional().describe("Direction to place against (default: 'down')")
    },
    async ({ x, y, z, faceDirection = 'down' }: { x: number; y: number; z: number; faceDirection?: FaceDirection }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      try {
        const result = await blockService.placeBlock(x, y, z, faceDirection);
        return factory.createResponse(result.message ?? '');
      } catch (error) {
        if (error instanceof BlockPlacementError) {
          return factory.createResponse(error.message);
        }
        throw error;
      }
    }
  );

  factory.registerTool(
    "dig-block",
    "Dig a block at the specified position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
    },
    async ({ x, y, z }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      try {
        const result = await blockService.digBlock(x, y, z);
        return factory.createResponse(result.message ?? '');
      } catch (error) {
        if (error instanceof BlockDigError) {
          return factory.createResponse(error.message);
        }
        throw error;
      }
    }
  );

  factory.registerTool(
    "get-block-info",
    "Get information about a block at the specified position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
    },
    async ({ x, y, z }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      try {
        const result = blockService.getBlockInfo(x, y, z);
        if (!result) {
          return factory.createResponse(`No block information found at position (${x}, ${y}, ${z})`);
        }
        return factory.createResponse(result.message ?? '');
      } catch (error) {
        if (error instanceof BlockError) {
          return factory.createResponse(error.message);
        }
        throw error;
      }
    }
  );

  factory.registerTool(
    "find-blocks",
    "Find one or more nearby blocks of a specific type",
    {
      blockType: z.string().describe("Type of block to find"),
      maxDistance: z.coerce.number().finite().optional().describe("Maximum search distance (default: 16)"),
      count: z.coerce.number().int().positive().optional().describe("Maximum number of blocks to return (default: 1; values above 256 are clamped)")
    },
    async ({ blockType, maxDistance = 16, count = 1 }) => {
      const result = blockService.findBlocks(blockType, maxDistance, count);
      return factory.createResponse(result.message ?? '');
    }
  );
}