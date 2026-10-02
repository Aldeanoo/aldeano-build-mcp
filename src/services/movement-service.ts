import type mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import { MovementError } from '../errors/index.js';
import { resolveBot } from './service-utils.js';
import type {
  BotOrGetter,
  MovementDirection,
  MovementResult,
  Position
} from './types.js';

export class MovementService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  getPosition(): Position {
    const bot = this.getBot();
    const position = bot.entity.position;
    return {
      x: Math.floor(position.x),
      y: Math.floor(position.y),
      z: Math.floor(position.z)
    };
  }

  stop(): void {
    const bot = this.getBot();
    if (bot.pathfinder) {
      bot.pathfinder.stop();
    }
    const anyBot = bot as unknown as { clearControlStates?: () => void };
    if (typeof anyBot.clearControlStates === 'function') {
      anyBot.clearControlStates();
    }
  }

  async moveToPosition(
    x: number,
    y: number,
    z: number,
    timeoutMs?: number,
    range = 1
  ): Promise<MovementResult> {
    const bot = this.getBot();
    const goal = new goals.GoalNear(x, y, z, range);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let timeoutPromise: Promise<never> | null = null;
    let timedOut = false;

    if (timeoutMs !== undefined) {
      timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new MovementError(`Move timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
    }

    const gotoPromise = bot.pathfinder.goto(goal);

    try {
      if (timeoutPromise) {
        await Promise.race([gotoPromise, timeoutPromise]);
      } else {
        await gotoPromise;
      }
      return {
        success: true,
        position: { x, y, z },
        message: `Successfully moved to position near (${x}, ${y}, ${z})`
      };
    } catch (error) {
      if (timedOut) {
        throw new MovementError(`Move timed out after ${timeoutMs}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new MovementError(message);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (timedOut) {
        bot.pathfinder.stop();
        gotoPromise.catch(() => {});
      }
    }
  }

  async lookAt(x: number, y: number, z: number): Promise<MovementResult> {
    const bot = this.getBot();
    try {
      await bot.lookAt(new Vec3(x, y, z), true);
      return {
        success: true,
        position: { x, y, z },
        message: `Looking at position (${x}, ${y}, ${z})`
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new MovementError(`Failed to look at (${x}, ${y}, ${z}): ${msg}`);
    }
  }

  async jump(): Promise<MovementResult> {
    const bot = this.getBot();
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 250);
    return {
      success: true,
      message: 'Successfully jumped'
    };
  }

  async moveInDirection(
    direction: MovementDirection,
    durationMs = 1000
  ): Promise<MovementResult> {
    const bot = this.getBot();
    return new Promise((resolve) => {
      bot.setControlState(direction, true);
      setTimeout(() => {
        bot.setControlState(direction, false);
        resolve({
          success: true,
          message: `Moved ${direction} for ${durationMs}ms`
        });
      }, durationMs);
    });
  }

  async flyTo(x: number, y: number, z: number, _speed?: number): Promise<MovementResult> {
    const bot = this.getBot();

    if (!bot.creative) {
      throw new MovementError('Creative mode is not available. Cannot fly.');
    }

    const controller = new AbortController();
    const FLIGHT_TIMEOUT_MS = 20000;

    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }, FLIGHT_TIMEOUT_MS);

    try {
      const destination = new Vec3(x, y, z);
      await this.createCancellableFlightOperation(bot, destination, controller);
      return {
        success: true,
        position: { x, y, z },
        message: `Successfully flew to position (${x}, ${y}, ${z}).`
      };
    } catch (error) {
      if (controller.signal.aborted) {
        const currentPosAfterTimeout = bot.entity.position;
        throw new MovementError(
          `Flight timed out after ${FLIGHT_TIMEOUT_MS / 1000} seconds. The destination may be unreachable. ` +
          `Current position: (${Math.floor(currentPosAfterTimeout.x)}, ${Math.floor(currentPosAfterTimeout.y)}, ${Math.floor(currentPosAfterTimeout.z)})`
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new MovementError(message);
    } finally {
      clearTimeout(timeoutId);
      bot.creative.stopFlying();
    }
  }

  private createCancellableFlightOperation(
    bot: mineflayer.Bot,
    destination: Vec3,
    controller: AbortController
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let aborted = false;

      controller.signal.addEventListener('abort', () => {
        aborted = true;
        bot.creative.stopFlying();
        reject(new MovementError('Flight operation cancelled'));
      });

      bot.creative.flyTo(destination)
        .then(() => {
          if (!aborted) {
            resolve(true);
          }
        })
        .catch((err: Error) => {
          if (!aborted) {
            reject(err);
          }
        });
    });
  }
}
