import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import type { BlockPosition } from '../build/build-types.js';
import type { WorldBlock } from './world-types.js';

export class BlockReader {
  constructor(private readonly botOrGetter: BotOrGetter) {}
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  getBlock(position: BlockPosition): WorldBlock | null {
    const block = this.bot.blockAt(new Vec3(position.x, position.y, position.z));
    if (!block) return null;
    return {
      position: { x: block.position.x, y: block.position.y, z: block.position.z },
      name: block.name,
      state: typeof block.getProperties === 'function' ? block.getProperties() as Record<string, unknown> : undefined
    };
  }
}
