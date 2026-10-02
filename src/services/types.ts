import type mineflayer from 'mineflayer';

export type BotGetter = () => mineflayer.Bot;
export type BotOrGetter = mineflayer.Bot | BotGetter;

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  action?: string;
  data?: T;
  error?: string;
  durationMs?: number;
}

export interface MovementResult {
  success: boolean;
  message: string;
  position?: Position;
  action?: string;
  durationMs?: number;
}

export type MovementDirection = 'forward' | 'back' | 'left' | 'right';
export type FaceDirection = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';

export interface BlockActionResult {
  success: boolean;
  position: Position;
  message: string;
  blockName?: string;
  block?: string;
  face?: string;
  action?: string;
  durationMs?: number;
}

export interface BlockInfoResult {
  success: boolean;
  message: string;
  name?: string;
  type?: number;
  position?: Position;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block?: any;
}

export interface FindBlocksResult {
  success: boolean;
  message: string;
  blockType?: string;
  blocks: Position[];
}

export interface InventoryItem {
  name: string;
  count: number;
  slot: number;
}

export interface InventoryResult {
  success: boolean;
  items: InventoryItem[];
  message: string;
  totalCount?: number;
}

export interface ItemResult {
  success: boolean;
  item?: InventoryItem;
  message: string;
}

export interface RecipeIngredient {
  name: string;
  count: number;
}

export interface CraftingRecipe {
  name: string;
  count: number;
  ingredients: RecipeIngredient[];
  canCraft?: boolean;
  missingTotal?: number;
}

export interface RecipeListResult {
  success: boolean;
  recipes: CraftingRecipe[];
  message: string;
}

export interface RecipeResult {
  success: boolean;
  recipes: CraftingRecipe[];
  message: string;
}

export interface CanCraftResult {
  success: boolean;
  canCraft: boolean;
  itemName: string;
  message: string;
  missing?: RecipeIngredient[];
}

export interface CraftResult {
  success: boolean;
  itemName: string;
  craftedCount: number;
  message: string;
}

export interface SmeltResult {
  success: boolean;
  message: string;
  smeltedItem?: string;
  smeltedCount?: number;
  inputCount?: number;
  fuelCount?: number;
}

export interface SmeltOptions {
  x?: number;
  y?: number;
  z?: number;
  fuelCount?: number;
  takeOutput?: boolean;
  timeoutMs?: number;
}

export interface EntityInfo {
  name: string;
  type: string;
  position: Position;
}

export interface EntityResult {
  success: boolean;
  message: string;
  entity?: EntityInfo;
}

export interface ChatMessageResult {
  username: string;
  message: string;
  content?: string;
  timestamp: number;
  trusted: boolean;
}

export interface GamemodeResult {
  success: boolean;
  gamemode: string;
  message: string;
}

export function createActionResult<T = unknown>(
  action: string,
  success: boolean,
  data?: T,
  error?: string,
  durationMs?: number,
  message?: string
): ActionResult<T> {
  return {
    action,
    success,
    data,
    error,
    durationMs,
    message: message ?? (error ? `Failed: ${error}` : `Action ${action} succeeded`)
  };
}

export function createMovementResult(
  action: string,
  position?: Position,
  success = true,
  durationMs?: number,
  message?: string
): MovementResult {
  return {
    action,
    position,
    success,
    durationMs,
    message: message ?? `Movement ${action} succeeded`
  };
}

export function createBlockActionResult(
  action: string,
  position: Position,
  block?: string,
  success = true,
  durationMs?: number,
  message?: string
): BlockActionResult {
  return {
    action,
    position,
    block,
    blockName: block,
    success,
    durationMs,
    message: message ?? `Block action ${action} succeeded`
  };
}

export function createBlockInfoResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block?: any,
  success = true,
  message?: string
): BlockInfoResult {
  return {
    success,
    block,
    name: block?.name ?? '',
    type: block?.type ?? 0,
    position: block?.position ?? { x: 0, y: 0, z: 0 },
    message: message ?? `Found ${block?.name || 'unknown'}`
  };
}

export function createInventoryResult(
  items: InventoryItem[],
  success = true,
  message?: string
): InventoryResult {
  return {
    success,
    items,
    totalCount: items.length,
    message: message ?? `Found ${items.length} items in inventory`
  };
}
