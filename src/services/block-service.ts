import type mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import { BlockDigError, BlockPlacementError } from '../errors/index.js';
import { log } from '../logger.js';
import { resolveBot } from './service-utils.js';
import type {
  BlockActionResult,
  BlockInfoResult,
  BotOrGetter,
  FaceDirection,
  FindBlocksResult
} from './types.js';

const MAX_FIND_BLOCKS_COUNT = 256;
const MAX_PLACEMENT_DISTANCE = 32;

interface FaceOption {
  direction: FaceDirection;
  vector: Vec3;
}

export class BlockService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  async placeBlock(x: number, y: number, z: number, faceDirection?: FaceDirection): Promise<BlockActionResult>;
  async placeBlock(name: string, x: number, y: number, z: number, faceDirection?: FaceDirection, state?: Record<string, string | number | boolean>): Promise<BlockActionResult>;
  async placeBlock(
    arg1: string | number,
    arg2?: number,
    arg3?: number,
    arg4?: number | FaceDirection,
    arg5?: FaceDirection,
    requestedState?: Record<string, string | number | boolean>
  ): Promise<BlockActionResult> {
    const bot = this.getBot();

    let name: string | undefined;
    let x: number;
    let y: number;
    let z: number;
    let faceDirection: FaceDirection = 'down';
    const slabType = requestedState?.type;
    if (slabType !== undefined && (!['top', 'bottom', 'double'].includes(String(slabType)) || typeof arg1 !== 'string' || !arg1.endsWith('_slab'))) {
      throw new BlockPlacementError('Physical slab placement needs type=top, bottom or double');
    }

    if (typeof arg1 === 'number') {
      x = arg1;
      y = arg2!;
      z = arg3!;
      if (typeof arg4 === 'string') {
        faceDirection = arg4;
      }
    } else {
      name = arg1;
      x = arg2!;
      y = arg3!;
      z = arg4 as number;
      if (arg5) {
        faceDirection = arg5;
      }
    }

    if (name) {
      const items = bot.inventory.items();
      const normalizedName = name.toLowerCase().replace(/^minecraft:/, '');
      const item = items.find((i) => i.name.toLowerCase() === normalizedName)
        ?? items.find((i) => i.name.toLowerCase().includes(normalizedName));
      if (!item) {
        throw new BlockPlacementError(`Item '${name}' not found in inventory`);
      }
      if (slabType === 'double' && item.count < 2) throw new BlockPlacementError('A double slab requires two slab items');
      if (bot.heldItem?.name !== item.name) {
        await bot.equip(item, 'hand');
      }
    }

    const placePos = new Vec3(x, y, z).floored();
    const botPos = bot.entity.position.floored();

    if (placePos.equals(botPos) || placePos.equals(botPos.offset(0, 1, 0))) {
      throw new BlockPlacementError("You can't place a block where you're standing or one block above");
    }

    const distance = bot.entity.position.distanceTo(placePos);
    if (distance > MAX_PLACEMENT_DISTANCE) {
      throw new BlockPlacementError(`Target position (${placePos.x}, ${placePos.y}, ${placePos.z}) is too far (${distance.toFixed(1)} blocks, max ${MAX_PLACEMENT_DISTANCE})`);
    }

    const blockAtPos = bot.blockAt(placePos);
    if (blockAtPos && blockAtPos.name !== 'air') {
      throw new BlockPlacementError(`There's already a block (${blockAtPos.name}) at (${placePos.x}, ${placePos.y}, ${placePos.z})`);
    }

    const possibleFaces: FaceOption[] = [
      { direction: 'down', vector: new Vec3(0, -1, 0) },
      { direction: 'north', vector: new Vec3(0, 0, -1) },
      { direction: 'south', vector: new Vec3(0, 0, 1) },
      { direction: 'east', vector: new Vec3(1, 0, 0) },
      { direction: 'west', vector: new Vec3(-1, 0, 0) },
      { direction: 'up', vector: new Vec3(0, 1, 0) }
    ];

    if (faceDirection !== 'down') {
      const specificFace = possibleFaces.find(face => face.direction === faceDirection);
      if (specificFace) {
        possibleFaces.unshift(possibleFaces.splice(possibleFaces.indexOf(specificFace), 1)[0]);
      }
    }

    for (const face of possibleFaces) {
      // A vertical click fixes the half: upper face -> bottom slab; lower face -> top slab.
      if (slabType === 'top' && face.direction === 'down') continue;
      if ((slabType === 'bottom' || slabType === 'double') && face.direction === 'up') continue;
      const referencePos = placePos.plus(face.vector);
      const referenceBlock = bot.blockAt(referencePos);

      if (referenceBlock && referenceBlock.name !== 'air') {
        if (!bot.canSeeBlock(referenceBlock)) {
          const goal = new goals.GoalNear(referencePos.x, referencePos.y, referencePos.z, 2);
          await bot.pathfinder.goto(goal);
        }

        await bot.lookAt(placePos, true);

        try {
          if (slabType !== undefined) {
            const stateBot = bot as typeof bot & {
              _placeBlockWithOptions: (reference: typeof referenceBlock, face: Vec3, options: { half: string; swingArm: string }) => Promise<void>;
              _genericPlace: (reference: typeof referenceBlock, face: Vec3, options: { delta: Vec3; swingArm: string }) => Promise<void>;
            };
            if (typeof stateBot._placeBlockWithOptions !== 'function') throw new BlockPlacementError('State-aware physical placement is unavailable');
            await stateBot._placeBlockWithOptions(referenceBlock, face.vector.scaled(-1), { half: slabType === 'top' ? 'top' : 'bottom', swingArm: 'right' });
            if (slabType === 'double') {
              const half = bot.blockAt(placePos);
              if (!half || half.getProperties().type !== 'bottom') throw new BlockPlacementError('Cannot merge slab: expected the lower half at the target');
              await stateBot._genericPlace(half, new Vec3(0, 1, 0), { delta: new Vec3(0.5, 0.5, 0.5), swingArm: 'right' });
              await bot.waitForTicks(2);
            }
            const placed = bot.blockAt(placePos);
            const properties = placed?.getProperties() ?? {};
            if (!placed || placed.name !== name?.replace(/^minecraft:/, '') || Object.entries(requestedState ?? {}).some(([key,value]) => String(properties[key]) !== String(value))) {
              throw new BlockPlacementError(`Physical slab state mismatch at ${x},${y},${z}; expected ${JSON.stringify(requestedState)}`);
            }
          } else await bot.placeBlock(referenceBlock, face.vector.scaled(-1));
          return {
            success: true,
            position: { x: placePos.x, y: placePos.y, z: placePos.z },
            blockName: name || referenceBlock.name,
            face: face.direction,
            message: `Placed block at (${placePos.x}, ${placePos.y}, ${placePos.z}) using ${face.direction} face`
          };
        } catch (placeError) {
          log('warn', `Failed to place using ${face.direction} face: ${placeError}`);
          continue;
        }
      }
    }

    throw new BlockPlacementError(`Failed to place block at (${placePos.x}, ${placePos.y}, ${placePos.z}): No suitable reference block found`);
  }

  async digBlock(x: number, y: number, z: number): Promise<BlockActionResult> {
    const bot = this.getBot();
    const blockPos = new Vec3(x, y, z);
    const block = bot.blockAt(blockPos);

    if (!block || block.name === 'air') {
      throw new BlockDigError(`No block found at position (${x}, ${y}, ${z})`);
    }

    if (!bot.canDigBlock(block) || !bot.canSeeBlock(block)) {
      const goal = new goals.GoalNear(x, y, z, 2);
      await bot.pathfinder.goto(goal);
    }

    await bot.dig(block);
    return {
      success: true,
      blockName: block.name,
      position: { x, y, z },
      message: `Dug ${block.name} at (${x}, ${y}, ${z})`
    };
  }

  getBlockInfo(x: number, y: number, z: number): (BlockInfoResult & { name: string; type: number }) | null {
    const bot = this.getBot();
    const blockPos = new Vec3(x, y, z);
    const block = bot.blockAt(blockPos);

    if (!block) {
      return null;
    }

    const details = {
      name: block.name,
      type: block.type,
      position: { x: block.position.x, y: block.position.y, z: block.position.z }
    };

    return Object.assign(details, {
      success: true,
      block,
      name: block.name,
      type: block.type,
      position: details.position,
      message: `Found ${block.name} (type: ${block.type}) at position (${block.position.x}, ${block.position.y}, ${block.position.z})`
    });
  }

  findBlocks(name: string, maxDistance = 16, count = 1): FindBlocksResult {
    const bot = this.getBot();
    const mcData = minecraftData(bot.version);
    const blocksByName = mcData.blocksByName;
    const normalizedCount = Math.min(count, MAX_FIND_BLOCKS_COUNT);

    if (!blocksByName[name]) {
      return {
        success: false,
        blockType: name,
        blocks: [],
        message: `Unknown block type: ${name}`
      };
    }

    const blockId = blocksByName[name].id;

    if (normalizedCount === 1) {
      const block = bot.findBlock({
        matching: blockId,
        maxDistance: maxDistance
      });

      if (!block) {
        return {
          success: false,
          blockType: name,
          blocks: [],
          message: `No ${name} found within ${maxDistance} blocks`
        };
      }

      return {
        success: true,
        blockType: name,
        blocks: [{ x: block.position.x, y: block.position.y, z: block.position.z }],
        message: `Found ${name} at position (${block.position.x}, ${block.position.y}, ${block.position.z})`
      };
    }

    const blocks = bot.findBlocks({
      point: bot.entity.position,
      matching: blockId,
      maxDistance: maxDistance,
      count: normalizedCount
    });

    if (blocks.length === 0) {
      return {
        success: false,
        blockType: name,
        blocks: [],
        message: `No ${name} found within ${maxDistance} blocks`
      };
    }

    const blocksList = blocks
      .map((block, i) => `${i + 1}. (${block.x}, ${block.y}, ${block.z})`)
      .join('\n');

    return {
      success: true,
      blockType: name,
      blocks: blocks.map((b) => ({ x: b.x, y: b.y, z: b.z })),
      message: `Found ${blocks.length} ${name} block(s) within ${maxDistance} blocks:\n${blocksList}`
    };
  }
}
