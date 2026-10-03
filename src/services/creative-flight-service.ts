import { Vec3 } from 'vec3';
import { MovementError } from '../errors/index.js';
import { resolveBot } from './service-utils.js';
import type { BotOrGetter } from './types.js';

/** Own the tick loop: Mineflayer's creative.flyTo keeps running after a raced abort. */
export class CreativeFlightService {
  private cancelActive?: (reason: Error) => void;

  constructor(private readonly botOrGetter: BotOrGetter, private readonly timeoutMs = 20_000) {}

  stop(): void {
    if (this.cancelActive) {
      this.cancelActive(new MovementError('Flight operation cancelled'));
      return;
    }
    const bot = resolveBot(this.botOrGetter);
    // stopFlying before startFlying sets gravity to null in Mineflayer. Do not do that.
    if (bot.physics?.gravity === 0 && bot.creative) {
      bot.creative.stopFlying();
      if (!Number.isFinite(bot.physics.gravity) || bot.physics.gravity <= 0) {
        throw new MovementError('Normal gravity is unavailable; cannot safely resume walking');
      }
    }
  }

  async flyTo(destination: Vec3): Promise<void> {
    const bot = resolveBot(this.botOrGetter);
    if (!bot.creative || bot.game?.gameMode !== 'creative') {
      throw new MovementError('Creative mode is not available. Cannot fly.');
    }
    if (this.cancelActive) throw new MovementError('A flight is already in progress; stop it first');
    const { minY, height } = bot.game as typeof bot.game & { minY: number; height: number };
    if (![destination.x, destination.y, destination.z, minY, height, bot.entity.width, bot.entity.height].every(Number.isFinite)
      || bot.entity.width <= 0 || bot.entity.height <= 0
      || Math.abs(destination.x) > 29_999_900 || Math.abs(destination.z) > 29_999_900
      || destination.y < minY || destination.y + bot.entity.height >= minY + height) {
      throw new MovementError('Flight destination outside readable world bounds');
    }
    this.stop();
    const gravity = bot.physics.gravity;
    if (!Number.isFinite(gravity) || gravity <= 0) throw new MovementError('Normal gravity is unavailable');
    bot.pathfinder?.stop();
    bot.pathfinder?.setGoal?.(null);
    bot.clearControlStates();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let arrivalTicks = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        bot.removeListener('physicsTick', tick);
        bot.removeListener('end', disconnected);
        bot.removeListener('death', died);
        this.cancelActive = undefined;
        try { bot.creative.stopFlying(); } catch (failure) { error ??= failure as Error; }
        finally { bot.physics.gravity = gravity; }
        if (error) reject(error); else resolve();
      };
      const disconnected = () => finish(new MovementError('Disconnected during flight'));
      const died = () => finish(new MovementError('Bot died during flight'));
      const tick = () => {
        try {
          if (bot.game.gameMode !== 'creative') throw new MovementError('Creative mode changed during flight');
          const delta = destination.minus(bot.entity.position);
          const distance = delta.norm();
          if (!Number.isFinite(distance)) throw new MovementError('Flight position is unavailable');
          // Wait for two transmitted physics ticks at the destination, rather than trusting a resolved mock.
          if (distance < 0.05) {
            this.assertClear(destination);
            bot.entity.position = destination.clone();
            if (++arrivalTicks >= 2) { finish(); return; }
          } else {
            arrivalTicks = 0;
            const step = delta.scaled(Math.min(0.5, distance) / distance);
            this.assertClear(bot.entity.position.plus(step.scaled(0.5)));
            const next = bot.entity.position.plus(step);
            this.assertClear(next);
            bot.entity.position = next;
          }
          bot.physics.gravity = 0;
          bot.entity.velocity = new Vec3(0, 0, 0);
        } catch (error) { finish(error instanceof Error ? error : new MovementError(String(error))); }
      };
      this.cancelActive = finish;
      timer = setTimeout(() => finish(new MovementError(`Flight timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
      bot.on('physicsTick', tick);
      bot.once('end', disconnected);
      bot.once('death', died);
      try { this.assertClear(destination); bot.creative.startFlying(); }
      catch (error) { finish(error instanceof Error ? error : new MovementError(String(error))); }
    });
  }

  private assertClear(position: Vec3): void {
    const bot = resolveBot(this.botOrGetter);
    const halfWidth = bot.entity.width / 2;
    const epsilon = 1e-6;
    const min = position.offset(-halfWidth, 0, -halfWidth);
    const max = position.offset(halfWidth, bot.entity.height, halfWidth);
    for (let x = Math.floor(min.x + epsilon); x <= Math.floor(max.x - epsilon); x++) {
      for (let y = Math.floor(min.y + epsilon); y <= Math.floor(max.y - epsilon); y++) {
        for (let z = Math.floor(min.z + epsilon); z <= Math.floor(max.z - epsilon); z++) {
          const block = bot.blockAt(new Vec3(x, y, z));
          if (!block) throw new MovementError('Flight path is unreadable; load the region first');
          // Fluids, cobwebs and other non-air blocks are not safe flight space either.
          if (!['air', 'cave_air', 'void_air'].includes(block.name)) {
            throw new MovementError(`Flight path is occupied at (${x}, ${y}, ${z})`);
          }
        }
      }
    }
  }
}
