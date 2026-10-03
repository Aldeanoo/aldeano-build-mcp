import { BuildPlanner } from './build-planner.js';
import { normalizePlacements } from './normalize-placements.js';
import type { BlockPlacement, BuildPlan } from '../build-types.js';

export function placementPlan(name:string,source:BlockPlacement[]):BuildPlan {
  const blocks=normalizePlacements(source);
  const origin=blocks.reduce((p,b)=>({x:Math.min(p.x,b.position.x),y:Math.min(p.y,b.position.y),z:Math.min(p.z,b.position.z)}),blocks[0]?.position??{x:0,y:0,z:0});
  const to=blocks.reduce((p,b)=>({x:Math.max(p.x,b.position.x),y:Math.max(p.y,b.position.y),z:Math.max(p.z,b.position.z)}),origin);
  return new BuildPlanner().plan({version:1,name,size:{x:to.x-origin.x+1,y:to.y-origin.y+1,z:to.z-origin.z+1},blocks:blocks.map(b=>({x:b.position.x-origin.x,y:b.position.y-origin.y,z:b.position.z-origin.z,block:b.block,state:b.state,category:b.category,section:b.section}))},origin);
}
