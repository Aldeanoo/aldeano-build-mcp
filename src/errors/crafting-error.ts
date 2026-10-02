import { AldeanoError } from './base-error.js';

export class CraftingError extends AldeanoError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'CRAFTING_ERROR', context);
  }
}

export class RecipeNotFoundError extends CraftingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.assign(this, { code: 'RECIPE_NOT_FOUND' });
  }
}
