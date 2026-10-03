// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { normalizeWorldText } from './world/untrusted-content.js';

export interface StoredMessage {
  timestamp: number;
  username: string;
  content: string;
}

export type ChatMessage = StoredMessage;

const MAX_STORED_MESSAGES = 100;

export class MessageStore {
  private messages: StoredMessage[] = [];
  private maxMessages = MAX_STORED_MESSAGES;

  addMessage(username: string, content: string): void {
    const message: StoredMessage = {
      timestamp: Date.now(),
      username: normalizeWorldText(username, 128),
      content: normalizeWorldText(content)
    };

    this.messages.push(message);

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  getRecentMessages(count: number = 10): StoredMessage[] {
    if (!Number.isFinite(count) || count < 1) {
      return [];
    }
    return this.messages.slice(-Math.min(this.maxMessages, Math.floor(count)));
  }

  getMaxMessages(): number {
    return this.maxMessages;
  }
}
