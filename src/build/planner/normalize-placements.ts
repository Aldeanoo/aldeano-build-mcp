import type { BlockPlacement } from '../build-types.js';
import { BuildValidationError, positionKey } from '../build-types.js';

/** A final plan has one expected value at each coordinate; last write wins. */
export function normalizePlacement(placement: BlockPlacement): BlockPlacement {
  if (![placement.position.x, placement.position.y, placement.position.z].every(Number.isSafeInteger)) {
    throw new BuildValidationError('INVALID_POSITION', 'Block coordinates must be safe integers');
  }
  const match = /^(?:minecraft:)?([a-z0-9_]+)(?:\[([a-z0-9_=,-]+)\])?$/.exec(placement.block);
  if (!match) throw new BuildValidationError('INVALID_BLOCK', `Invalid block '${placement.block}'`);
  const state: Record<string, string | number | boolean> = {};
  if (match[2]) for (const entry of match[2].split(',')) {
    const [key, value, extra] = entry.split('=');
    if (!key || !value || extra !== undefined || key in state) throw new BuildValidationError('INVALID_STATE', `Invalid state '${entry}'`);
    state[key] = value;
  }
  Object.assign(state, placement.state);
  for (const [key, value] of Object.entries(state)) {
    if (!/^[a-z0-9_]+$/.test(key) || !/^[a-z0-9_-]+$/.test(String(value))) throw new BuildValidationError('INVALID_STATE', `Invalid state '${key}'`);
  }
  return { ...placement, position: { ...placement.position }, block: match[1], state: Object.keys(state).length ? state : undefined };
}

export function normalizePlacements(placements: BlockPlacement[]): BlockPlacement[] {
  const final = new Map<string, BlockPlacement>();
  for (const placement of placements) {
    const normalized = normalizePlacement(placement);
    final.set(positionKey(normalized.position), normalized);
  }
  return [...final.values()];
}
