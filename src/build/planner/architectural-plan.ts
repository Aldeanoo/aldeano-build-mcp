import type { BlockPlacement } from '../build-types.js';
import { BuildValidationError, positionKey } from '../build-types.js';
import { normalizePlacements } from './normalize-placements.js';
import { blocksTouch, isFullCube } from '../verification/block-geometry.js';

export interface ArchitecturePreparation {
  placements: BlockPlacement[];
  adjustments: string[];
}

/** Resolve architectural intent before planning, counts, preflight and serialization; never edit a live world. */
export function prepareArchitecture(source: BlockPlacement[], version = '1.20.4', requiredAir: BlockPlacement['position'][] = []): ArchitecturePreparation {
  const cells = new Map(normalizePlacements(source).map(cell => [positionKey(cell.position), cell]));
  const protectedAir = new Set(requiredAir.map(positionKey));
  const adjustments: string[] = [];
  const columns = new Map<string, BlockPlacement[]>();
  for (const cell of cells.values()) {
    if (cell.category !== 'wall' && cell.category !== 'roof') continue;
    const key = `${cell.position.x},${cell.position.z}`;
    const column = columns.get(key) ?? [];
    column.push(cell); columns.set(key, column);
  }
  let filled = 0;
  for (const column of columns.values()) {
    column.sort((a, b) => a.position.y - b.position.y);
    let wall: BlockPlacement | undefined;
    for (const cell of column) {
      if (cell.category === 'wall') { wall = cell; continue; }
      if (!wall) continue;
      const gap = cell.position.y - wall.position.y - 1;
      if (gap > 0) {
        if (!isFullCube(wall, version)) throw new BuildValidationError('DESIGN_WALL_MATERIAL', `Wall at ${positionKey(wall.position)} needs a full closure material`);
        if (gap > 256 || cells.size + gap > 1_000_000) throw new BuildValidationError('LIMIT_EXCEEDED', 'Roof-wall closure exceeds architectural planning limits');
        for (let y = wall.position.y + 1; y < cell.position.y; y++) {
          const position = { ...wall.position, y }, key = positionKey(position);
          if (protectedAir.has(key)) throw new BuildValidationError('DESIGN_ROOF_WALL_GAP', `Roof-wall closure at ${key} conflicts with requiredAir; revise the wall/roof intent`);
          const existing = cells.get(key);
          if (!existing || ['air', 'cave_air', 'void_air'].includes(existing.block)) {
            cells.set(key, { ...wall, position, state: wall.state ? { ...wall.state } : undefined }); filled++;
          }
        }
      }
      // Only the first roof over a wall belongs to that junction. Higher roofs need their own walls.
      wall = undefined;
    }
  }
  if (filled) adjustments.push(`Closed ${filled} missing wall blocks below tagged roofs`);
  let slabs = 0;
  // Read a fixed snapshot so the result is independent of input/iteration order.
  const snapshot = new Map(cells);
  for (const [key, cell] of snapshot) {
    if (!cell.block.endsWith('_slab') || cell.category === 'decoration' || cell.state?.type === 'double') continue;
    const below = snapshot.get(positionKey({ ...cell.position, y: cell.position.y - 1 }));
    const above = snapshot.get(positionKey({ ...cell.position, y: cell.position.y + 1 }));
    const upper: BlockPlacement = { ...cell, state: { ...cell.state, type: 'top' } };
    const lower: BlockPlacement = { ...cell, state: { ...cell.state, type: 'bottom' } };
    const contactAbove = above?.block.endsWith('_slab') && above.category !== 'decoration'
      ? { ...above, state: { ...above.state, type: above.state?.type === 'double' ? 'double' : 'bottom' } } : above;
    const contactBelow = below?.block.endsWith('_slab') && below.category !== 'decoration'
      ? { ...below, state: { ...below.state, type: below.state?.type === 'double' ? 'double' : 'top' } } : below;
    const needsTop = contactAbove && above?.category !== 'decoration' && blocksTouch(upper, contactAbove, version);
    const needsBottom = contactBelow && below?.category !== 'decoration' && blocksTouch(lower, contactBelow, version);
    const type = needsTop && needsBottom ? 'double' : needsTop ? 'top' : needsBottom ? 'bottom' : cell.state?.type ?? 'bottom';
    if (type !== (cell.state?.type ?? 'bottom')) slabs++;
    cells.set(key, { ...cell, state: { ...cell.state, type, ...(type === 'double' ? { waterlogged: false } : {}) } });
  }
  if (slabs) adjustments.push(`Adjusted ${slabs} structural slabs to top/bottom/double for real surface contact`);
  return { placements: [...cells.values()], adjustments };
}
