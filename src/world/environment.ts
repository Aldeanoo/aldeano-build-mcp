import type mineflayer from 'mineflayer';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import type { EnvironmentResult } from './world-types.js';

export class EnvironmentReader {
  constructor(private readonly botOrGetter: BotOrGetter) {}
  get(): EnvironmentResult {
    const bot = resolveBot(this.botOrGetter);
    const position = bot.entity.position.floored();
    const rain = Boolean(bot.isRaining);
    const thunder = Number((bot as mineflayer.Bot & { thunderState?: number }).thunderState ?? 0) > 0;
    const dimension = String((bot.game as unknown as { dimension?: string })?.dimension ?? 'unknown');
    const block = bot.blockAt(position);
    return {
      time: bot.time.timeOfDay,
      isDay: bot.time.isDay,
      dimension,
      biome: block ? String(block.biome?.name ?? block.biome?.id ?? 'unknown') : undefined,
      weather: thunder ? 'thunder' : rain ? 'rain' : 'clear',
      gameMode: bot.game?.gameMode ?? 'unknown',
      difficulty: String((bot.game as unknown as { difficulty?: string })?.difficulty ?? 'unknown'),
      position: { x: position.x, y: position.y, z: position.z },
      source: 'minecraft_world', trusted: false
    };
  }
}
