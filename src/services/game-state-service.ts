import type mineflayer from 'mineflayer';
import { resolveBot } from './service-utils.js';
import type {
  BotOrGetter,
  GamemodeResult
} from './types.js';

export class GameStateService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  detectGamemode(): GamemodeResult {
    const bot = this.getBot();
    const gamemode = bot.game?.gameMode ?? 'unknown';
    return {
      success: true,
      gamemode,
      message: `Bot gamemode: "${gamemode}"`
    };
  }
}
