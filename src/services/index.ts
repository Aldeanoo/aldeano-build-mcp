export * from './types.js';
export * from './base-service.js';
export * from './movement-service.js';
export * from './inventory-service.js';
export * from './chat-service.js';
export * from './crafting-service.js';
export * from './entity-service.js';
export * from './furnace-service.js';
export * from './game-state-service.js';
export * from './block-service.js';
export { BlocksService } from './blocks-service.js';
export { WorldService } from './world-service.js';
export * from '../errors/index.js';

import type { BotOrGetter } from './types.js';
import type { MessageStore } from '../message-store.js';
import { MovementService } from './movement-service.js';
import { InventoryService } from './inventory-service.js';
import { BlockService } from './block-service.js';
import { EntityService } from './entity-service.js';
import { ChatService } from './chat-service.js';
import { GameStateService } from './game-state-service.js';
import { CraftingService } from './crafting-service.js';
import { FurnaceService } from './furnace-service.js';

export interface Services {
  movement: MovementService;
  inventory: InventoryService;
  block: BlockService;
  entity: EntityService;
  chat: ChatService;
  gameState: GameStateService;
  crafting: CraftingService;
  furnace: FurnaceService;
}

export function createServices(
  botOrGetter: BotOrGetter,
  messageStore?: MessageStore
): Services {
  return {
    movement: new MovementService(botOrGetter),
    inventory: new InventoryService(botOrGetter),
    block: new BlockService(botOrGetter),
    entity: new EntityService(botOrGetter),
    chat: new ChatService(botOrGetter, messageStore),
    gameState: new GameStateService(botOrGetter),
    crafting: new CraftingService(botOrGetter),
    furnace: new FurnaceService(botOrGetter),
  };
}
