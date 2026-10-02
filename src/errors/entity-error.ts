import { AldeanoError } from './base-error.js';

export class EntityError extends AldeanoError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'ENTITY_ERROR', context);
  }
}

export class EntityNotFoundError extends EntityError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.assign(this, { code: 'ENTITY_NOT_FOUND' });
  }
}
