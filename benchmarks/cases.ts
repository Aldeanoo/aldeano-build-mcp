import type { BlockPlacement } from '../src/build/build-types.js';
import { buildWall } from '../src/build/primitives/wall.js';
import { buildFloor } from '../src/build/primitives/floor.js';
import { buildCylinder } from '../src/build/primitives/cylinder.js';
import { buildSphere } from '../src/build/primitives/sphere.js';
import { buildRoof } from '../src/build/primitives/roof.js';
import { buildBox } from '../src/build/primitives/box.js';

export interface BenchmarkCase {
  name: string;
  placements: BlockPlacement[];
}

function unique(placements: BlockPlacement[]): BlockPlacement[] {
  const result = new Map<string, BlockPlacement>();
  for (const placement of placements) result.set(`${placement.position.x},${placement.position.y},${placement.position.z}`, placement);
  return [...result.values()];
}

function wall(length: number, height: number): BlockPlacement[] {
  return buildWall({ x: 0, y: 0, z: 0 }, { x: length - 1, y: 0, z: 0 }, height, 'stone_bricks');
}

function house(): BlockPlacement[] {
  const blocks = [
    ...buildFloor({ x: 0, y: 0, z: 0 }, { x: 9, y: 0, z: 7 }, 'stone_bricks'),
    ...buildWall({ x: 0, y: 1, z: 0 }, { x: 9, y: 1, z: 0 }, 5, 'oak_planks'),
    ...buildWall({ x: 0, y: 1, z: 7 }, { x: 9, y: 1, z: 7 }, 5, 'oak_planks'),
    ...buildWall({ x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: 6 }, 5, 'oak_planks'),
    ...buildWall({ x: 9, y: 1, z: 1 }, { x: 9, y: 1, z: 6 }, 5, 'oak_planks'),
    ...buildRoof({ x: -1, y: 6, z: -1 }, { x: 10, y: 6, z: 8 }, 'dark_oak_planks', 'x')
  ];
  for (const y of [2, 3]) {
    blocks.push({ position: { x: 2, y, z: 0 }, block: 'glass', category: 'wall' });
    blocks.push({ position: { x: 7, y, z: 0 }, block: 'glass', category: 'wall' });
  }
  blocks.push({ position: { x: 4, y: 1, z: 0 }, block: 'oak_door', state: { half: 'lower', facing: 'north' }, category: 'decoration' });
  blocks.push({ position: { x: 4, y: 2, z: 0 }, block: 'oak_door', state: { half: 'upper', facing: 'north' }, category: 'decoration' });
  return unique(blocks);
}

function tower(): BlockPlacement[] {
  const blocks = buildCylinder({ x: 7, y: 0, z: 7 }, 7, 30, 'stone_bricks', true);
  for (const y of [0, 6, 12, 18, 24, 29]) blocks.push(...buildFloor({ x: 1, y, z: 1 }, { x: 13, y, z: 13 }, 'stone_bricks'));
  return unique(blocks);
}

function castle(): BlockPlacement[] {
  return unique([
    ...buildWall({ x: 0, y: 0, z: 0 }, { x: 39, y: 0, z: 0 }, 12, 'stone_bricks'),
    ...buildCylinder({ x: 0, y: 0, z: 0 }, 6, 20, 'stone_bricks', true),
    ...buildCylinder({ x: 39, y: 0, z: 0 }, 6, 20, 'stone_bricks', true),
    ...buildFloor({ x: -5, y: 19, z: -5 }, { x: 5, y: 19, z: 5 }, 'stone_bricks'),
    ...buildFloor({ x: 34, y: 19, z: -5 }, { x: 44, y: 19, z: 5 }, 'stone_bricks')
  ]);
}

const CASES: Record<string, () => BlockPlacement[]> = {
  wall_10x5: () => wall(10, 5),
  wall_30x10: () => wall(30, 10),
  blocks_6000: () => buildBox({ x: 0, y: 0, z: 0 }, { x: 29, y: 9, z: 19 }, 'stone_bricks'),
  house_small: house,
  tower_medium: tower,
  sphere_15: () => buildSphere({ x: 15, y: 15, z: 15 }, 15, 'stone_bricks', true),
  castle_section: castle
};

const ALIASES: Record<string, string> = { 'small-house': 'house_small', 'tower-medium': 'tower_medium', 'castle-section': 'castle_section' };

export const benchmarkNames = Object.keys(CASES);

export function getBenchmarkCase(requested: string): BenchmarkCase {
  const name = ALIASES[requested] ?? requested;
  const create = CASES[name];
  if (!create) throw new Error(`Unknown benchmark '${requested}'. Available: ${Object.keys(CASES).join(', ')}`);
  return { name, placements: create() };
}
