// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { CraftingService } from '../services/crafting-service.js';
import { RecipeNotFoundError } from '../errors/index.js';
import type { BotOrGetter } from '../services/types.js';

export function registerCraftingTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | CraftingService
): void {
  const craftingService = botOrService instanceof CraftingService
    ? botOrService
    : new CraftingService(botOrService);

  factory.registerTool(
    "list-recipes",
    "List all available crafting recipes the bot can make with current inventory",
    {
      outputItem: z.string().trim().min(1).optional().describe("Optional: filter recipes by output item name")
    },
    async ({ outputItem }) => {
      const result = craftingService.listRecipes(outputItem);
      return factory.createResponse(result.message);
    }
  );

  factory.registerTool(
    "craft-item",
    "Craft an item using a crafting recipe",
    {
      outputItem: z.string().trim().min(1).describe("Name of the item to craft"),
      amount: z.number().int().min(1).optional().describe("Number of times to craft (default: 1)")
    },
    async ({ outputItem, amount = 1 }) => {
      try {
        const result = await craftingService.craftItem(outputItem, amount);
        return factory.createResponse(result.message);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return factory.createErrorResponse(msg);
      }
    }
  );

  factory.registerTool(
    "get-recipe",
    "Get detailed information about a specific recipe",
    {
      itemName: z.string().trim().min(1).describe("Name of the item to get recipe for")
    },
    async ({ itemName }) => {
      try {
        const result = craftingService.getRecipe(itemName);
        return factory.createResponse(result.message);
      } catch (error) {
        if (error instanceof RecipeNotFoundError) {
          return factory.createErrorResponse(error.message);
        }
        throw error;
      }
    }
  );

  factory.registerTool(
    "can-craft",
    "Check if the bot can craft a specific item with current inventory",
    {
      itemName: z.string().trim().min(1).describe("Name of the item to check")
    },
    async ({ itemName }) => {
      try {
        const result = craftingService.canCraft(itemName);
        return factory.createResponse(result.message);
      } catch (error) {
        if (error instanceof RecipeNotFoundError) {
          return factory.createErrorResponse(error.message);
        }
        throw error;
      }
    }
  );
}
