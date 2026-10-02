import type mineflayer from 'mineflayer';
import { BotNotConnectedError } from '../errors/index.js';
import type { BotOrGetter } from './types.js';

export function resolveBot(botOrGetter: BotOrGetter): mineflayer.Bot {
  const bot = typeof botOrGetter === 'function' ? botOrGetter() : botOrGetter;
  if (!bot) {
    throw new BotNotConnectedError('Bot is not connected to a Minecraft server');
  }
  return bot;
}
