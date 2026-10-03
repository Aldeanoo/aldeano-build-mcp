// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { MessageStore } from '../message-store.js';
import { ChatService } from '../services/chat-service.js';
import type { BotOrGetter } from '../services/types.js';

export function registerChatTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | ChatService,
  messageStore?: MessageStore
): void {
  const chatService = botOrService instanceof ChatService
    ? botOrService
    : new ChatService(botOrService, messageStore);

  factory.registerTool(
    "send-chat",
    "Send a chat message in-game",
    {
      message: z.string().describe("Message to send in chat")
    },
    async ({ message }) => {
      const result = chatService.sendChat(message);
      return factory.createResponse(result.message ?? '');
    }
  );

  factory.registerTool(
    "read-chat",
    "Get recent chat messages from players",
    {
      count: z.number().optional().describe("Number of recent messages to retrieve (default: 10, max: 100)")
    },
    async ({ count = 10 }) => {
      const messages = chatService.readChat(count);

      return factory.createWorldResponse({
        summary: messages.length ? `Found ${messages.length} chat message(s)` : 'No chat messages found',
        messages
      });
    }
  );
}
