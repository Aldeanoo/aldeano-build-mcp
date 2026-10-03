import type { BlockPlacement, DesignRequirements } from '../build-types.js';
import { BuildValidationError, positionKey } from '../build-types.js';
import { normalizePlacements } from '../planner/normalize-placements.js';
import { z } from 'zod';

const position=z.object({x:z.number().int(),y:z.number().int(),z:z.number().int()});
export const designRequirementsSchema=z.object({roofBounds:z.object({from:position,to:position}).optional(),roofBaseY:z.number().int().optional(),requiredSupports:z.array(position).optional(),requiredAir:z.array(position).optional(),requireConnected:z.boolean().optional()});
export function parseDesignRequirements(value:unknown):DesignRequirements|undefined {return value===undefined?undefined:designRequirementsSchema.parse(value);}
export function translateDesign(requirements:DesignRequirements|undefined,origin:{x:number;y:number;z:number}):DesignRequirements|undefined {
  if(!requirements)return undefined;
  const p=(v:{x:number;y:number;z:number})=>({x:v.x+origin.x,y:v.y+origin.y,z:v.z+origin.z});
  return {...requirements,roofBounds:requirements.roofBounds?{from:p(requirements.roofBounds.from),to:p(requirements.roofBounds.to)}:undefined,roofBaseY:requirements.roofBaseY===undefined?undefined:requirements.roofBaseY+origin.y,requiredAir:requirements.requiredAir?.map(p),requiredSupports:requirements.requiredSupports?.map(p)};
}

const air = new Set(['air', 'cave_air', 'void_air']);

/** Explicit architectural contracts; arbitrary sculptures need not be closed buildings. */
export function validateDesign(placements: BlockPlacement[], requirements: DesignRequirements = {}): void {
  requirements=designRequirementsSchema.parse(requirements);
  const solid = new Map(normalizePlacements(placements).filter(p => !air.has(p.block)).map(p => [positionKey(p.position), p]));
  for (const position of requirements.requiredSupports ?? []) if (!solid.has(positionKey(position))) {
    throw new BuildValidationError('DESIGN_MISSING_SUPPORT', `Missing planned support at ${positionKey(position)}`);
  }
  for (const position of requirements.requiredAir ?? []) if (solid.has(positionKey(position))) {
    throw new BuildValidationError('DESIGN_BLOCKED_OPENING', `Planned opening obstructed at ${positionKey(position)}`);
  }
  if (requirements.roofBounds) {
    const { from, to } = requirements.roofBounds;
    if(from.x>to.x||from.y>to.y||from.z>to.z)throw new BuildValidationError('DESIGN_INVALID_BOUNDS','Roof bounds must be ordered');
    if((to.x-from.x+1)*(to.z-from.z+1)>1_000_000)throw new BuildValidationError('LIMIT_EXCEEDED','Roof contract exceeds 1000000 columns');
    const covered = new Set([...solid.values()].filter(p => p.position.y >= (requirements.roofBaseY ?? from.y) && p.position.y <= to.y).map(p => `${p.position.x},${p.position.z}`));
    for (let x = from.x; x <= to.x; x++) for (let z = from.z; z <= to.z; z++) if (!covered.has(`${x},${z}`)) {
      throw new BuildValidationError('DESIGN_OPEN_ROOF', `Roof has no cover above ${x},${z}`);
    }
  }
  if (requirements.requireConnected && solid.size) {
    const seen = new Set<string>();
    const queue = [[...solid.values()][0].position];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], key = positionKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [x, y, z] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const q = { x: p.x+x, y: p.y+y, z: p.z+z }, k = positionKey(q);
        if (solid.has(k) && !seen.has(k)) queue.push(q);
      }
    }
    if (seen.size !== solid.size) throw new BuildValidationError('DESIGN_DISCONNECTED', `${solid.size-seen.size} blocks are disconnected from the structure`);
  }
}
