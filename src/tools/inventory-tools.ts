// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { InventoryService } from '../services/inventory-service.js';
import { InventoryError } from '../errors/index.js';
import type { BotOrGetter } from '../services/types.js';

export function registerInventoryTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | InventoryService
): void {
  const inventoryService = botOrService instanceof InventoryService
    ? botOrService
    : new InventoryService(botOrService);

  factory.registerTool(
    "list-inventory",
    "List all items in the bot's inventory",
    {},
    async () => {
      const result = inventoryService.listInventory();
      return factory.createWorldResponse({ success: result.success, items: result.items, totalCount: result.totalCount, message: result.message });
    }
  );

  factory.registerTool(
    "find-item",
    "Find a specific item in the bot's inventory",
    {
      nameOrType: z.string().describe("Name or type of item to find")
    },
    async ({ nameOrType }) => {
      const result = inventoryService.findItem(nameOrType);
      if (result) {
        return factory.createWorldResponse({ success: result.success, item: result.item, message: result.message });
      }
      return factory.createWorldResponse({ success: false, message: `Couldn't find any item matching '${nameOrType}' in inventory` });
    }
  );

  factory.registerTool(
    "equip-item",
    "Equip a specific item",
    {
      itemName: z.string().describe("Name of the item to equip"),
      destination: z.string().optional().describe("Where to equip the item (default: 'hand')")
    },
    async ({ itemName, destination = 'hand' }) => {
      try {
        const result = await inventoryService.equipItem(itemName, destination);
        return factory.createResponse(result.message ?? '');
      } catch (error) {
        if (error instanceof InventoryError) {
          return factory.createResponse(`Couldn't find any item matching '${itemName}' in inventory`);
        }
        throw error;
      }
    }
  );
}
