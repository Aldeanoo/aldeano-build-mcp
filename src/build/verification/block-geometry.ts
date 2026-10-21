import minecraftData from 'minecraft-data';
import type { BlockPlacement } from '../build-types.js';
import { BuildValidationError } from '../build-types.js';
import { normalizePlacement } from '../planner/normalize-placements.js';

type Box = number[];
const registries = new Map<string, ReturnType<typeof minecraftData>>();
const shapeCache = new Map<string, Box[]>();
const EPSILON = 1e-7;

/** State-specific collision geometry from the installed Minecraft registry, in local block units. */
export function blockShapes(placement: BlockPlacement, version = '1.20.4'): Box[] {
  const cell = normalizePlacement(placement);
  const key = `${version}:${cell.block}:${JSON.stringify(cell.state ?? {})}`;
  const cached = shapeCache.get(key);
  if (cached) return cached;
  let data = registries.get(version);
  if (!data) { data = minecraftData(version); registries.set(version, data); }
  const block = data.blocksByName[cell.block];
  if (!block) throw new BuildValidationError('INVALID_BLOCK', `Unknown block ${cell.block} for Minecraft ${version}`);
  const properties = block.states ?? [];
  let remainder = block.defaultState - block.minStateId;
  const digits = new Map<string, number>();
  for (let i = properties.length - 1; i >= 0; i--) {
    digits.set(properties[i].name, remainder % properties[i].num_values);
    remainder = Math.floor(remainder / properties[i].num_values);
  }
  for (const [name, value] of Object.entries(cell.state ?? {})) {
    const property = properties.find(item => item.name === name);
    const values = property?.type === 'bool' ? ['true', 'false'] : property?.values?.map(String);
    const digit = values ? values.indexOf(String(value)) : Number(value);
    if (!property || !Number.isInteger(digit) || digit < 0 || digit >= property.num_values) {
      throw new BuildValidationError('INVALID_STATE', `Invalid ${cell.block} state ${name}=${value}`);
    }
    digits.set(name, digit);
  }
  let offset = 0;
  for (const property of properties) offset = offset * property.num_values + digits.get(property.name)!;
  const ids = data.blockCollisionShapes.blocks[cell.block];
  const id = Array.isArray(ids) ? ids[offset] : ids;
  const shapes = data.blockCollisionShapes.shapes[id];
  if (!shapes) throw new BuildValidationError('GEOMETRY_UNAVAILABLE', `Collision geometry unavailable for ${cell.block}`);
  if (shapeCache.size > 8192) shapeCache.clear();
  shapeCache.set(key, shapes);
  return shapes;
}

export function isFullCube(cell: BlockPlacement, version?: string): boolean {
  return blockShapes(cell, version).some(box => box.slice(0, 3).every(v => v <= EPSILON)
    && box.slice(3).every(v => v >= 1 - EPSILON));
}

/** Face contact has positive area. Merely adjacent voxel coordinates or touching edges do not suffice. */
export function blocksTouch(a: BlockPlacement, b: BlockPlacement, version?: string): boolean {
  const ap = [a.position.x, a.position.y, a.position.z], bp = [b.position.x, b.position.y, b.position.z];
  return blockShapes(a, version).some(left => blockShapes(b, version).some(right => {
    const overlaps = [0, 1, 2].map(i => Math.min(left[i+3]+ap[i], right[i+3]+bp[i]) - Math.max(left[i]+ap[i], right[i]+bp[i]));
    return overlaps.every(v => v >= -EPSILON) && overlaps.filter(v => v > EPSILON).length >= 2;
  }));
}
