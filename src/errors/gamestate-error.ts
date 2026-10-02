import { AldeanoError } from './base-error.js';

export class GameStateError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'GAME_STATE_ERROR', context);
  }
}
