import type mineflayer from 'mineflayer';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import { FurnaceError } from '../errors/index.js';
import { resolveBot } from './service-utils.js';
import type {
  BotOrGetter,
  SmeltOptions,
  SmeltResult
} from './types.js';

const FURNACE_BLOCKS = new Set(['furnace', 'blast_furnace', 'smoker']);

export class FurnaceService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  async smeltItem(
    inputItem: string,
    fuelItem: string,
    count = 1,
    options?: SmeltOptions
  ): Promise<SmeltResult> {
    const bot = this.getBot();
    const takeOutput = options?.takeOutput ?? true;
    const timeoutMs = options?.timeoutMs ?? 60000;
    const fuelCount = options?.fuelCount ?? 1;

    let furnaceBlock: ReturnType<typeof bot.blockAt> | null = null;

    if (options?.x !== undefined && options?.y !== undefined && options?.z !== undefined) {
      const furnacePos = new Vec3(options.x, options.y, options.z);
      furnaceBlock = bot.blockAt(furnacePos);

      if (!furnaceBlock || !FURNACE_BLOCKS.has(furnaceBlock.name)) {
        throw new FurnaceError(`No furnace block found at (${options.x}, ${options.y}, ${options.z})`);
      }
    } else {
      const mcData = minecraftData(bot.version);
      const furnaceIds = ['furnace', 'blast_furnace', 'smoker']
        .map((name) => mcData.blocksByName[name]?.id)
        .filter((id): id is number => typeof id === 'number');

      furnaceBlock = bot.findBlock({
        matching: furnaceIds,
        maxDistance: 16
      });

      if (!furnaceBlock) {
        throw new FurnaceError('No furnace block found nearby');
      }
    }

    const items = bot.inventory.items();
    const input = items.find((item) => item.name.includes(inputItem.toLowerCase()));
    if (!input) {
      throw new FurnaceError(`Couldn't find any item matching '${inputItem}' in inventory`);
    }

    const fuel = items.find((item) => item.name.includes(fuelItem.toLowerCase()));
    if (!fuel) {
      throw new FurnaceError(`Couldn't find any fuel item matching '${fuelItem}' in inventory`);
    }

    const resolvedInputCount = Math.min(count, input.count);
    const resolvedFuelCount = Math.min(fuelCount, fuel.count);

    const furnace = await bot.openFurnace(furnaceBlock);
    const cleanup = () => {
      try {
        furnace.close();
      } catch {
        // ignore
      }
    };

    try {
      const existingInput = furnace.inputItem();
      if (existingInput && existingInput.name !== input.name) {
        throw new FurnaceError(`Furnace input slot is occupied by ${existingInput.name}`);
      }

      const existingFuel = furnace.fuelItem();
      if (existingFuel && existingFuel.name !== fuel.name) {
        throw new FurnaceError(`Furnace fuel slot is occupied by ${existingFuel.name}`);
      }

      await furnace.putFuel(fuel.type, fuel.metadata ?? null, resolvedFuelCount);
      await furnace.putInput(input.type, input.metadata ?? null, resolvedInputCount);

      if (!takeOutput) {
        return {
          success: true,
          inputCount: resolvedInputCount,
          fuelCount: resolvedFuelCount,
          message: `Started smelting ${resolvedInputCount} ${input.name} with ${resolvedFuelCount} ${fuel.name}`
        };
      }

      const output = await this.waitForOutput(furnace, timeoutMs);
      if (!output) {
        throw new FurnaceError(`No output after ${timeoutMs}ms`);
      }

      const taken = await furnace.takeOutput();
      return {
        success: true,
        smeltedItem: taken.name,
        smeltedCount: taken.count,
        inputCount: resolvedInputCount,
        fuelCount: resolvedFuelCount,
        message: `Smelted ${taken.count} ${taken.name}`
      };
    } finally {
      cleanup();
    }
  }

  private waitForOutput(furnace: mineflayer.Furnace, timeoutMs: number): Promise<Item | null> {
    const existing = furnace.outputItem();
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const onUpdate = () => {
        const output = furnace.outputItem();
        if (output) {
          cleanup();
          resolve(output);
        }
      };

      const cleanup = () => {
        furnace.removeListener('update', onUpdate);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      furnace.on('update', onUpdate);

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);
    });
  }
}
