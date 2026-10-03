import type mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinderPkg from 'mineflayer-pathfinder';
import type { BotOrGetter, MovementResult } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import type { BlockPosition } from '../build/build-types.js';
import { MovementService } from '../services/movement-service.js';
import { StuckDetector } from './stuck-detector.js';

const { Movements } = pathfinderPkg;

interface ConfigurableMovements {
  canDig: boolean;
  allow1by1towers: boolean;
  maxDropDown: number;
  blocksToAvoid: Set<number>;
}

export interface NavigationOptions {
  allowDigging?: boolean;
  allowScaffolding?: boolean;
  avoidWater?: boolean;
  avoidLava?: boolean;
  maxFallDistance?: number;
  timeout?: number;
}

export class NavigationService {
  private readonly movement: MovementService;
  constructor(private readonly botOrGetter: BotOrGetter) { this.movement = new MovementService(botOrGetter); }
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  async navigateTo(target: BlockPosition, options: NavigationOptions = {}): Promise<MovementResult & { attempts: number; recalculated: boolean }> {
    const bot = this.bot; const data = minecraftData(bot.version); const movements = new Movements(bot, data);
    const configurable = movements as unknown as ConfigurableMovements;
    configurable.canDig = options.allowDigging ?? false;
    configurable.allow1by1towers = options.allowScaffolding ?? false;
    configurable.maxDropDown = Math.max(0, Math.floor(options.maxFallDistance ?? 3));
    if (options.avoidWater !== false && data.blocksByName.water) configurable.blocksToAvoid.add(data.blocksByName.water.id);
    if (options.avoidLava !== false && data.blocksByName.lava) configurable.blocksToAvoid.add(data.blocksByName.lava.id);
    bot.pathfinder.setMovements(movements);
    const detector = new StuckDetector(); const timeout = Math.max(1_000, options.timeout ?? 30_000); let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await this.movement.moveToPosition(target.x, target.y, target.z, Math.floor(timeout / 3), 1);
        return { ...result, attempts: attempt, recalculated: attempt > 1 };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const position = this.movement.getPosition();
        if (detector.update(position)) bot.pathfinder.stop();
      }
    }
    return { success: false, message: `Navigation failed cleanly after 3 attempts: ${lastError}`, position: this.movement.getPosition(), attempts: 3, recalculated: true };
  }
}
