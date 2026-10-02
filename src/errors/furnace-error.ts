import { AldeanoError } from './base-error.js';

export class FurnaceError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'FURNACE_ERROR', context);
  }
}
