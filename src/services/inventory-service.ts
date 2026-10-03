import type mineflayer from 'mineflayer';
import { InventoryError } from '../errors/index.js';
import { resolveBot } from './service-utils.js';
import { normalizeWorldText } from '../world/untrusted-content.js';
import type {
  ActionResult,
  BotOrGetter,
  InventoryItem,
  InventoryResult,
  ItemResult
} from './types.js';

export class InventoryService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  listInventory(): InventoryResult & InventoryItem[] {
    const bot = this.getBot();
    const items = bot.inventory.items();
    const itemList: InventoryItem[] = items.map((item) => ({
      name: normalizeWorldText(item.name, 128),
      count: item.count,
      slot: item.slot
    }));

    if (items.length === 0) {
      const emptyResult = Object.assign([] as InventoryItem[], {
        success: true,
        items: [],
        totalCount: 0,
        message: 'Inventory is empty'
      });
      return emptyResult as unknown as InventoryResult & InventoryItem[];
    }

    let inventoryText = `Found ${items.length} items in inventory:\n\n`;
    itemList.forEach((item) => {
      inventoryText += `- ${item.name} (x${item.count}) in slot ${item.slot}\n`;
    });

    const result = Object.assign([...itemList], {
      success: true,
      items: itemList,
      totalCount: items.length,
      message: inventoryText
    });

    return result as unknown as InventoryResult & InventoryItem[];
  }

  findItem(name: string): (ItemResult & InventoryItem) | null {
    const bot = this.getBot();
    const items = bot.inventory.items();
    const item = items.find((i) =>
      i.name.toLowerCase().includes(name.toLowerCase())
    );

    if (item) {
      const itemData: InventoryItem = {
        name: normalizeWorldText(item.name, 128),
        count: item.count,
        slot: item.slot
      };
      return Object.assign({ ...itemData }, {
        success: true,
        item: itemData,
        message: `Found ${item.count} ${itemData.name} in inventory (slot ${item.slot})`
      });
    }

    return null;
  }

  async equipItem(
    name: string,
    destination: string = 'hand'
  ): Promise<ActionResult> {
    const bot = this.getBot();
    const items = bot.inventory.items();
    const item = items.find((i) =>
      i.name.toLowerCase().includes(name.toLowerCase())
    );

    if (!item) {
      throw new InventoryError(`Item '${name}' not found in inventory`);
    }

    try {
      await bot.equip(item, destination as mineflayer.EquipmentDestination);
      return {
        success: true,
        message: `Equipped ${item.name} to ${destination}`
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InventoryError(`Failed to equip ${item.name}: ${msg}`);
    }
  }
}
