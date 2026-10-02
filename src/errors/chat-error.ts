import { AldeanoError } from './base-error.js';

export class ChatError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CHAT_ERROR', context);
  }
}
