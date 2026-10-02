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

      if (messages.length === 0) {
        return factory.createResponse("No chat messages found");
      }

      let output = `Found ${messages.length} chat message(s):\n\n`;
      messages.forEach((msg, index) => {
        const timestamp = new Date(msg.timestamp).toISOString();
        output += `${index + 1}. ${timestamp} - ${msg.username}: ${msg.message}\n`;
      });

      return factory.createResponse(output);
    }
  );
}
