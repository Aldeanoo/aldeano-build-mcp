import type { BlockPlacement, BuildCategory } from '../build-types.js';

const PRIORITY: Record<BuildCategory, number> = {
  foundation: 0,
  structural: 1,
  wall: 2,
  floor: 3,
  roof: 4,
  decoration: 5
};

const DECORATION = /torch|lantern|ladder|door|bed|rail|button|lever|sign|banner|flower|painting|item_frame/;
const ROOF = /roof|stair|slab/;

export function inferCategory(placement: BlockPlacement, minimumY: number): BuildCategory {
  if (placement.category) return placement.category;
  if (placement.position.y === minimumY) return 'foundation';
  if (DECORATION.test(placement.block)) return 'decoration';
  if (ROOF.test(placement.block)) return 'roof';
  return 'structural';
}

export function compareBlockOrder(a: BlockPlacement, b: BlockPlacement, minimumY: number): number {
  const category = PRIORITY[inferCategory(a, minimumY)] - PRIORITY[inferCategory(b, minimumY)];
  return category || a.position.y - b.position.y || a.position.x - b.position.x || a.position.z - b.position.z;
}
