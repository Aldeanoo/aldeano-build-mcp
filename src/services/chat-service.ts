import type mineflayer from 'mineflayer';
import { resolveBot } from './service-utils.js';
import type { MessageStore } from '../message-store.js';
import type {
  ActionResult,
  BotOrGetter,
  ChatMessageResult
} from './types.js';

export class ChatService {
  constructor(
    private botOrGetter: BotOrGetter,
    private messageStore?: MessageStore
  ) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  sendChat(message: string): ActionResult {
    const bot = this.getBot();
    bot.chat(message);
    return {
      success: true,
      message: `Sent message: "${message}"`
    };
  }

  readChat(count = 10): ChatMessageResult[] {
    if (!this.messageStore) {
      return [];
    }

    const maxCount = Math.min(count, this.messageStore.getMaxMessages());
    const messages = this.messageStore.getRecentMessages(maxCount);

    return messages.map((msg) => ({
      username: msg.username,
      message: msg.content,
      content: msg.content,
      timestamp: msg.timestamp,
      trusted: true
    }));
  }
}
