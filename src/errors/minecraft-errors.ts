import { AldeanoError, type ErrorContext } from './base-error.js';

/**
 * Thrown when connection to the Minecraft server fails or disconnects unexpectedly.
 */
export class MinecraftConnectionError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'MINECRAFT_CONNECTION_ERROR') {
    super(message, code, context);
  }
}

export class ConnectionError extends MinecraftConnectionError {
  constructor(message: string, context: ErrorContext = {}, code = 'CONNECTION_ERROR') {
    super(message, context, code);
  }
}

export class MaxReconnectAttemptsError extends MinecraftConnectionError {
  constructor(message: string, context: ErrorContext = {}, code = 'MAX_RECONNECT_ATTEMPTS') {
    super(message, context, code);
  }
}

/**
 * Thrown when movement or pathfinding actions fail, are unreachable, or encounter obstacles.
 */
export class MovementError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'MOVEMENT_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when placing a block fails due to collision, range, or missing item.
 */
export class BlockPlacementError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'BLOCK_PLACEMENT_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when inventory operations fail (missing items, slot out of range, container full).
 */
export class InventoryError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'INVENTORY_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when an asynchronous Minecraft operation exceeds its configured deadline.
 */
export class TimeoutError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'TIMEOUT_ERROR') {
    super(message, code, context);
  }
}

export class ConnectionTimeoutError extends TimeoutError {
  constructor(message: string, context: ErrorContext = {}, code = 'CONNECTION_TIMEOUT') {
    super(message, context, code);
  }
}

/**
 * Thrown when parameters, configuration, or inputs fail schema validation.
 */
export class ValidationError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'VALIDATION_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when the target Minecraft server version is incompatible with current capabilities.
 */
export class UnsupportedVersionError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'UNSUPPORTED_VERSION_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when crafting operations fail (no recipe, missing ingredients, missing table).
 */
export class CraftingError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'CRAFTING_ERROR') {
    super(message, code, context);
  }
}

/**
 * Thrown when entity operations fail (entity not found, out of reach, invalid entity).
 */
export class EntityError extends AldeanoError {
  constructor(message: string, context: ErrorContext = {}, code = 'ENTITY_ERROR') {
    super(message, code, context);
  }
}
