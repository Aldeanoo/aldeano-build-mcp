import { AldeanoError, type ErrorContext } from './base-error.js';
export { BlockPlacementError } from './minecraft-errors.js';

export class BlockError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'BLOCK_ERROR') {
    super(message, code, context);
  }
}

export class BlockDigError extends BlockError {
  constructor(message: string, context: ErrorContext = {}, code = 'BLOCK_DIG_ERROR') {
    super(message, context, code);
  }
}

export class BlockActionError extends BlockError {
  constructor(message: string, context: ErrorContext = {}, code = 'BLOCK_ACTION_ERROR') {
    super(message, context, code);
  }
}
