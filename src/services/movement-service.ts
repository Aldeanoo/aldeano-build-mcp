import type mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import { MovementError } from '../errors/index.js';
import { BoundedTeleportService } from './bounded-teleport-service.js';
import { CreativeFlightService } from './creative-flight-service.js';
import { resolveBot } from './service-utils.js';
import type {
  BotOrGetter,
  MovementDirection,
  MovementResult,
  Position
} from './types.js';

export class MovementService {
  private readonly flight: CreativeFlightService;
  constructor(private botOrGetter: BotOrGetter) {
    this.flight = new CreativeFlightService(botOrGetter);
  }

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

  async teleportTo(x:number,y:number,z:number): Promise<MovementResult> {
    this.flight.stop();
    await new BoundedTeleportService(this.botOrGetter).selfTo({x,y,z});
    return {success:true,position:{x,y,z},message:`Teleported to (${x}, ${y}, ${z}) and confirmed destination clearance`};
  }

  async teleportToPlayer(name:string): Promise<MovementResult> {
    this.flight.stop();
    await new BoundedTeleportService(this.botOrGetter).selfToPlayer(name);
    const position = this.getPosition();
    return {success:true,position,message:`Arrived near ${name} and checked clearance`};
  }

  stop(): void {
    this.flight.stop();
    const bot = this.getBot();
    if (bot.pathfinder) {
      bot.pathfinder.stop();
      // stop() only sets a deferred flag in pathfinder; clear it now, before a future goto.
      bot.pathfinder.setGoal?.(null);
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
    this.flight.stop();
    const bot = this.getBot();
    bot.pathfinder.setGoal?.(null);
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
    this.flight.stop();
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
    this.flight.stop();
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
    await this.flight.flyTo(new Vec3(x, y, z));
    return { success: true, position: { x, y, z }, message: `Successfully flew to position (${x}, ${y}, ${z}).` };
  }
}
