import type { BlockPlacement, BlockPosition } from '../build-types.js';
import { BuildValidationError, normalizeBounds, positionKey } from '../build-types.js';
import { validateDesign } from '../verification/design-validator.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

export interface RoofOptions {
  style?: 'flat' | 'gable' | 'hip';
  axis?: 'x' | 'z';
  height?: number;
  thickness?: number;
  overhang?: number;
  closeEnds?: boolean;
  gableBlock?: string;
  ridgeBlock?: string;
}

/** Legacy entry point now closes gable ends; its input schema is unchanged. */
export function buildRoof(from: BlockPosition, to: BlockPosition, block: string, axis: 'x' | 'z' = 'x', limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  return buildRoofDetailed(from, to, block, { axis }, limits);
}

export function buildRoofDetailed(from: BlockPosition, to: BlockPosition, block: string, options: RoofOptions = {}, limits?: PrimitiveGenerationLimits): BlockPlacement[] {
  if (![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isSafeInteger)) throw new BuildValidationError('INVALID_POSITION', 'Roof coordinates must be integers');
  const bounds = normalizeBounds(from, to), style = options.style ?? 'gable', axis = options.axis ?? 'x';
  const overhang = options.overhang ?? 0, thickness = options.thickness ?? 1;
  if (!Number.isInteger(overhang) || overhang < 0 || overhang > 16 || !Number.isInteger(thickness) || thickness < 1 || thickness > 16) throw new BuildValidationError('INVALID_ROOF', 'Roof overhang must be 0–16 and thickness 1–16');
  const x0 = bounds.from.x-overhang, x1 = bounds.to.x+overhang, z0 = bounds.from.z-overhang, z1 = bounds.to.z+overhang, baseY = bounds.from.y;
  const maxDistance = style === 'hip' ? Math.floor(Math.min(x1-x0,z1-z0)/2) : Math.floor((axis === 'x' ? z1-z0 : x1-x0)/2);
  const rise = style === 'flat' ? 0 : options.height ?? maxDistance;
  if (!Number.isInteger(rise) || rise < 0 || rise > maxDistance) throw new BuildValidationError('INVALID_ROOF', `Roof rise must be 0–${maxDistance}; steeper slopes would create gaps`);
  checkGenerationBounds({ x: x0, y: baseY - thickness + 1, z: z0 }, { x: x1, y: baseY + rise, z: z1 }, limits);
  checkGenerationCount((x1 - x0 + 1) * (z1 - z0 + 1) * thickness, limits);
  if (!limits && (x1-x0+1)*(z1-z0+1)*(rise+thickness+1) > 1_000_000) throw new BuildValidationError('LIMIT_EXCEEDED', 'Roof generation exceeds one million candidate blocks');
  const final = new Map<string, BlockPlacement>();
  const add = (x:number,y:number,z:number,material:string,state?:BlockPlacement['state']) => {
    const p = { position:{x,y,z},block:material,state,category:'roof' as const };
    if (!final.has(positionKey(p.position))) checkGenerationCount(final.size + 1, limits);
    final.set(positionKey(p.position),p);
  };
  for (let x=x0;x<=x1;x++) for (let z=z0;z<=z1;z++) {
    const dx = Math.min(x-x0,x1-x), dz = Math.min(z-z0,z1-z);
    const distance = style === 'hip' ? Math.min(dx,dz) : axis === 'x' ? dz : dx;
    const y = baseY+(maxDistance ? Math.floor(distance*rise/maxDistance) : 0);
    const ridge = distance === maxDistance && rise > 0;
    const material = ridge ? options.ridgeBlock ?? block : block;
    let facing = axis === 'x' ? (z-z0 <= z1-z ? 'south' : 'north') : (x-x0 <= x1-x ? 'east' : 'west');
    if (style === 'hip') facing = dx < dz ? (x-x0 <= x1-x ? 'east' : 'west') : (z-z0 <= z1-z ? 'south' : 'north');
    const state = material.replace(/^minecraft:/,'').endsWith('_stairs') ? { facing, half:'bottom', shape:'straight' } : undefined;
    for (let layer=0;layer<thickness;layer++) add(x,y-layer,z,material,state);
    if (style === 'gable' && options.closeEnds !== false && (axis === 'x' ? x === x0 || x === x1 : z === z0 || z === z1)) {
      for (let yy=baseY;yy<y-thickness+1;yy++) add(x,yy,z,options.gableBlock ?? options.ridgeBlock ?? block);
    }
  }
  const placements = [...final.values()];
  validateDesign(placements, { roofBounds:{from:{x:x0,y:baseY,z:z0},to:{x:x1,y:baseY+rise,z:z1}},roofBaseY:baseY });
  return placements;
}
