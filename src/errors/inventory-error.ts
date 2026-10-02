import { AldeanoError } from './base-error.js';

export class InventoryError extends AldeanoError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'INVENTORY_ERROR', context);
  }
}

export class ItemNotFoundError extends InventoryError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.assign(this, { code: 'ITEM_NOT_FOUND' });
  }
}
