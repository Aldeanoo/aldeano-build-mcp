import type mineflayer from 'mineflayer';
import type { BlockService } from '../../services/block-service.js';
import type { BotOrGetter } from '../../services/types.js';
import { resolveBot } from '../../services/service-utils.js';
import type { BlockPlacement, BuildMode } from '../build-types.js';

export interface BuildExecutionStrategy {
  readonly mode: BuildMode;
  place(placement: BlockPlacement, signal?: AbortSignal): Promise<void>;
  settle?(): Promise<void>;
}

export function blockArgument(placement: BlockPlacement): string {
  const name = placement.block.replace(/^minecraft:/, '');
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Invalid block name '${placement.block}'`);
  const entries = Object.entries(placement.state ?? {});
  for (const [key, value] of entries) {
    if (!/^[a-z0-9_]+$/.test(key) || !/^[a-z0-9_-]+$/.test(String(value))) throw new Error('Invalid block state');
  }
  return `minecraft:${name}${entries.length ? `[${entries.map(([key, value]) => `${key}=${value}`).join(',')}]` : ''}`;
}

export class PhysicalBuildStrategy implements BuildExecutionStrategy {
  readonly mode = 'physical' as const;
  constructor(private readonly blocks: BlockService) {}

  async place(placement: BlockPlacement): Promise<void> {
    if (placement.block === 'air') {
      try { await this.blocks.digBlock(placement.position.x, placement.position.y, placement.position.z); } catch { /* already air */ }
      return;
    }
    const existing = this.blocks.getBlockInfo(placement.position.x, placement.position.y, placement.position.z);
    const expectedName = placement.block.replace(/^minecraft:/, '').split('[')[0];
    if (existing?.name === expectedName) return;
    if (existing && !['air', 'cave_air', 'void_air'].includes(existing.name)) {
      await this.blocks.digBlock(placement.position.x, placement.position.y, placement.position.z);
    }
    await this.blocks.placeBlock(placement.block, placement.position.x, placement.position.y, placement.position.z);
  }
}

export class FastBuildStrategy implements BuildExecutionStrategy {
  readonly mode = 'fast' as const;
  private commandChain: Promise<void> = Promise.resolve();
  constructor(private readonly botOrGetter: BotOrGetter, private readonly enabled: boolean, private readonly commandIntervalMs = 20) {}
  protected get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  async place(placement: BlockPlacement, signal?: AbortSignal): Promise<void> {
    if (!this.enabled) throw new Error('Fast mode is disabled. Set BUILD_FAST_MODE_ENABLED=true to enable bounded Minecraft commands.');
    if (signal?.aborted) throw new Error('Build cancelled');
    const execute = async () => {
      if (signal?.aborted) throw new Error('Build cancelled');
      const { x, y, z } = placement.position;
      this.bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${blockArgument(placement)} replace`);
      if (this.commandIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, this.commandIntervalMs));
    };
    const current = this.commandChain.then(execute, execute);
    this.commandChain = current.catch(() => {});
    await current;
  }

  async settle(): Promise<void> {
    await this.commandChain;
    const waitForTicks = (this.bot as mineflayer.Bot & { waitForTicks?: (ticks: number) => Promise<void> }).waitForTicks;
    if (typeof waitForTicks === 'function') await waitForTicks.call(this.bot, 4);
    else await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export class CinematicBuildStrategy implements BuildExecutionStrategy {
  readonly mode = 'cinematic' as const;
  private lastY: number | undefined;
  constructor(private readonly fast: FastBuildStrategy, private readonly layerDelayMs: number) {}

  async place(placement: BlockPlacement, signal?: AbortSignal): Promise<void> {
    if (this.lastY !== undefined && placement.position.y !== this.lastY && this.layerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.layerDelayMs));
    }
    this.lastY = placement.position.y;
    await this.fast.place(placement, signal);
  }

  settle(): Promise<void> { return this.fast.settle(); }
}
