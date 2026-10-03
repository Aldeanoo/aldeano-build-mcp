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
    // A chat tool must not become an arbitrary privileged command executor.
    // eslint-disable-next-line no-control-regex
    if (!message.trim() || message.length > 256 || /[\u0000-\u001f\u007f-\u009f]/.test(message) || message.trimStart().startsWith('/')) {
      throw new Error('Chat accepts plain single-line messages (1–256 characters), not slash commands');
    }
    const bot = this.getBot();
    bot.chat(message);
    return {
      success: true,
      message: `Sent message: "${message}"`
    };
  }

  readChat(count = 10): ChatMessageResult[] {
    if (!this.messageStore || !Number.isFinite(count) || count < 1) {
      return [];
    }

    const maxCount = Math.min(count, this.messageStore.getMaxMessages());
    const messages = this.messageStore.getRecentMessages(maxCount);

    return messages.map((msg) => ({
      username: msg.username,
      message: msg.content,
      content: msg.content,
      timestamp: msg.timestamp,
      source: 'minecraft_world',
      trusted: false
    }));
  }
}
