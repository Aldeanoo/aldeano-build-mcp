import type { BuildPlan, PlannedBlock, RegionBounds } from '../build-types.js';

export interface PlanSector { key:string; bounds:RegionBounds; blocks:PlannedBlock[] }

export function planSectors(plan:BuildPlan,size=32):PlanSector[] {
  if(!Number.isInteger(size)||size<1||size>128)throw new Error('Sector size must be 1–128');
  const sectors=new Map<string,PlanSector>();
  for(const block of plan.blocks){
    const tx=Math.floor(block.position.x/size),tz=Math.floor(block.position.z/size),key=`${tx},${tz}`;
    let sector=sectors.get(key);
    if(!sector){sector={key,bounds:{from:{x:tx*size,y:plan.boundingBox.from.y,z:tz*size},to:{x:tx*size+size-1,y:plan.boundingBox.to.y,z:tz*size+size-1}},blocks:[]};sectors.set(key,sector);}
    sector.blocks.push(block);
  }
  for(const p of plan.requiredAir??[]){
    const tx=Math.floor(p.x/size),tz=Math.floor(p.z/size),key=`${tx},${tz}`;
    if(!sectors.has(key))sectors.set(key,{key,bounds:{from:{x:tx*size,y:plan.boundingBox.from.y,z:tz*size},to:{x:tx*size+size-1,y:plan.boundingBox.to.y,z:tz*size+size-1}},blocks:[]});
  }
  return [...sectors.values()];
}
