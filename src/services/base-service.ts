import mineflayer from 'mineflayer';

export abstract class BaseService {
  constructor(protected readonly getBotInstance: () => mineflayer.Bot) {}

  protected get bot(): mineflayer.Bot {
    const bot = this.getBotInstance();
    if (!bot) {
      throw new Error('Bot is not connected or initialized');
    }
    return bot;
  }
}
