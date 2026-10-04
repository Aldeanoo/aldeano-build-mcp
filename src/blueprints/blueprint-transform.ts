import type { BlueprintBlock, InternalBlueprint } from './blueprint.js';
import { parseDesignRequirements } from '../build/verification/design-validator.js';
import type { BlockPosition } from '../build/build-types.js';

function transformMetadata(blueprint:InternalBlueprint,map:(p:BlockPosition)=>BlockPosition):InternalBlueprint['metadata']{
  const design=parseDesignRequirements(blueprint.metadata?.design);
  if(!design)return blueprint.metadata;
  const ends=design.roofBounds?[map(design.roofBounds.from),map(design.roofBounds.to)]:undefined;
  const bounds=ends?{from:{x:Math.min(ends[0].x,ends[1].x),y:Math.min(ends[0].y,ends[1].y),z:Math.min(ends[0].z,ends[1].z)},to:{x:Math.max(ends[0].x,ends[1].x),y:Math.max(ends[0].y,ends[1].y),z:Math.max(ends[0].z,ends[1].z)}}:undefined;
  return {...blueprint.metadata,design:{...design,roofBounds:bounds,roofBaseY:design.roofBaseY===undefined?undefined:map({x:0,y:design.roofBaseY,z:0}).y,requiredAir:design.requiredAir?.map(map),requiredSupports:design.requiredSupports?.map(map)}};
}

export type BlueprintTransform = 'translate' | 'rotate90' | 'rotate180' | 'rotate270' | 'mirrorX' | 'mirrorZ';

function remapState(state: BlueprintBlock['state'], quarterTurns: number, mirrorAxis?: 'x' | 'z'): BlueprintBlock['state'] {
  if (!state) return undefined;
  const result = { ...state };
  if (quarterTurns % 2 === 1 && (state.axis === 'x' || state.axis === 'z')) result.axis = state.axis === 'x' ? 'z' : 'x';
  if (mirrorAxis && typeof state.shape === 'string') {
    result.shape = ({ inner_left: 'inner_right', inner_right: 'inner_left', outer_left: 'outer_right', outer_right: 'outer_left' } as Record<string, string>)[state.shape] ?? state.shape;
  }
  if (typeof state.facing !== 'string') return result;
  const directions = ['north', 'east', 'south', 'west'];
  let facing = state.facing;
  const index = directions.indexOf(facing);
  if (index >= 0) facing = directions[(index + quarterTurns) % 4];
  if (mirrorAxis === 'x') facing = ({ east: 'west', west: 'east' } as Record<string, string>)[facing] ?? facing;
  if (mirrorAxis === 'z') facing = ({ north: 'south', south: 'north' } as Record<string, string>)[facing] ?? facing;
  return { ...result, facing };
}

export class BlueprintTransformer {
  translate(blueprint: InternalBlueprint, x: number, y: number, z: number): InternalBlueprint {
    const blocks = blueprint.blocks.map((block) => ({
      ...block, x: block.x + x, y: block.y + y, z: block.z + z,
      dependsOn: block.dependsOn?.map((dependency) => ({ x: dependency.x + x, y: dependency.y + y, z: dependency.z + z }))
    }));
    const max = blocks.reduce((acc, block) => ({ x: Math.max(acc.x, block.x + 1), y: Math.max(acc.y, block.y + 1), z: Math.max(acc.z, block.z + 1) }), { x: 1, y: 1, z: 1 });
    return { ...blueprint, blocks, size: max, metadata:transformMetadata(blueprint,p=>({x:p.x+x,y:p.y+y,z:p.z+z})) };
  }

  rotate90(blueprint: InternalBlueprint): InternalBlueprint { return this.rotate(blueprint, 1); }
  rotate180(blueprint: InternalBlueprint): InternalBlueprint { return this.rotate(blueprint, 2); }
  rotate270(blueprint: InternalBlueprint): InternalBlueprint { return this.rotate(blueprint, 3); }

  mirrorX(blueprint: InternalBlueprint): InternalBlueprint {
    return { ...blueprint, metadata:transformMetadata(blueprint,p=>({...p,x:blueprint.size.x-1-p.x})), blocks: blueprint.blocks.map((block) => ({ ...block, x: blueprint.size.x - 1 - block.x, dependsOn: block.dependsOn?.map((dependency) => ({ ...dependency, x: blueprint.size.x - 1 - dependency.x })), state: remapState(block.state, 0, 'x') })) };
  }

  mirrorZ(blueprint: InternalBlueprint): InternalBlueprint {
    return { ...blueprint, metadata:transformMetadata(blueprint,p=>({...p,z:blueprint.size.z-1-p.z})), blocks: blueprint.blocks.map((block) => ({ ...block, z: blueprint.size.z - 1 - block.z, dependsOn: block.dependsOn?.map((dependency) => ({ ...dependency, z: blueprint.size.z - 1 - dependency.z })), state: remapState(block.state, 0, 'z') })) };
  }

  private rotate(blueprint: InternalBlueprint, turns: number): InternalBlueprint {
    let size = { ...blueprint.size };
    let blocks = blueprint.blocks.map((block) => ({ ...block }));
    let metadata=blueprint.metadata;
    for (let turn = 0; turn < turns; turn += 1) {
      metadata=transformMetadata({...blueprint,metadata},p=>({x:size.z-1-p.z,y:p.y,z:p.x}));
      blocks = blocks.map((block) => ({
        ...block, x: size.z - 1 - block.z, z: block.x,
        dependsOn: block.dependsOn?.map((dependency) => ({ x: size.z - 1 - dependency.z, y: dependency.y, z: dependency.x }))
      }));
      size = { x: size.z, y: size.y, z: size.x };
    }
    blocks = blocks.map((block) => ({ ...block, state: remapState(block.state, turns) }));
    return { ...blueprint, size, blocks, metadata };
  }
}
