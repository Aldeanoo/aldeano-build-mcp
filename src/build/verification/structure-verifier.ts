import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../../services/types.js';
import { resolveBot } from '../../services/service-utils.js';
import type { BuildPlan, RegionBounds } from '../build-types.js';
import { positionKey } from '../build-types.js';
import { normalizePlacement } from '../planner/normalize-placements.js';
import { planSectors } from './plan-sectors.js';
import type { VerificationDifference, VerificationResult } from './verification-result.js';

export interface VerificationOptions {
  includeExtras?:boolean;
  sectorSize?:number;
  signal?:AbortSignal;
  beforeSection?:(bounds:RegionBounds)=>Promise<void>;
  onProgress?:(result:VerificationResult)=>void;
}
export const isVerificationComplete=(v:VerificationResult):boolean=>v.correct===v.expected && v.missing===0 && v.incorrect===0 && v.unreachable===0 && v.extra===0;

/** Exact final state comparison; unreadable data is never a match. */
export class StructureVerifier {
  constructor(private readonly botOrGetter:BotOrGetter) {}
  private get bot():mineflayer.Bot{return resolveBot(this.botOrGetter);}

  verify(plan:BuildPlan,includeExtras=false):VerificationResult {
    const differences:VerificationDifference[]=[];
    let correct=0,missing=0,incorrect=0,unreachable=0,extra=0;
    const expectedPositions=new Set<string>();
    for(const source of plan.blocks){
      const expected=normalizePlacement(source),key=positionKey(expected.position);
      if(expectedPositions.has(key))throw new Error(`Verification requires unique final coordinates: ${key}`);
      expectedPositions.add(key);
      const actual=this.bot.blockAt(new Vec3(expected.position.x,expected.position.y,expected.position.z));
      if(!actual){unreachable++;differences.push({type:'UNREACHABLE',expected,position:expected.position});continue;}
      const isAir=['air','cave_air','void_air'].includes(actual.name);
      if(actual.name===expected.block || isAir && ['air','cave_air','void_air'].includes(expected.block)){
        const properties=typeof actual.getProperties==='function'?actual.getProperties() as Record<string,unknown>:undefined;
        if(expected.state && (!properties || Object.entries(expected.state).some(([k,v])=>String(properties[k])!==String(v)))){
          incorrect++;differences.push({type:'WRONG_STATE',expected,actual:actual.name,position:expected.position});
        }else correct++;
      }else if(isAir){missing++;differences.push({type:'MISSING_BLOCK',expected,actual:actual.name,position:expected.position});}
      else{incorrect++;differences.push({type:'WRONG_BLOCK',expected,actual:actual.name,position:expected.position});}
    }
    for(const position of plan.requiredAir??[]){
      if(expectedPositions.has(positionKey(position)))continue;
      expectedPositions.add(positionKey(position));
      const actual=this.bot.blockAt(new Vec3(position.x,position.y,position.z));
      if(!actual){unreachable++;differences.push({type:'UNREACHABLE',position});}
      else if(!['air','cave_air','void_air'].includes(actual.name)){extra++;differences.push({type:'EXTRA_BLOCK',position,actual:actual.name,expected:{position,block:'air'}});}
    }
    if(includeExtras){
      const {from,to}=plan.boundingBox;
      for(let x=from.x;x<=to.x;x++)for(let y=from.y;y<=to.y;y++)for(let z=from.z;z<=to.z;z++){
        const position={x,y,z};if(expectedPositions.has(positionKey(position)))continue;
        const actual=this.bot.blockAt(new Vec3(x,y,z));
        if(!actual){unreachable++;differences.push({type:'UNREACHABLE',position});}
        else if(!['air','cave_air','void_air'].includes(actual.name)){extra++;differences.push({type:'EXTRA_BLOCK',actual:actual.name,position});}
      }
    }
    const expected=plan.blocks.length;
    return {expected,correct,missing,incorrect,extra,unreachable,accuracy:expected?correct/expected:1,differences};
  }

  async verifyAsync(plan:BuildPlan,options:VerificationOptions={}):Promise<VerificationResult>{
    const size=options.sectorSize??32,sectors=planSectors(plan,size);
    if(options.includeExtras){
      const keys=new Set(sectors.map(s=>s.key)),{from,to}=plan.boundingBox;
      for(let x=Math.floor(from.x/size);x<=Math.floor(to.x/size);x++)for(let z=Math.floor(from.z/size);z<=Math.floor(to.z/size);z++){
        const key=`${x},${z}`;
        if(!keys.has(key))sectors.push({key,blocks:[],bounds:{from:{x:x*size,y:from.y,z:z*size},to:{x:x*size+size-1,y:to.y,z:z*size+size-1}}});
      }
    }
    const result:VerificationResult={expected:plan.blocks.length,correct:0,missing:0,incorrect:0,extra:0,unreachable:0,accuracy:plan.blocks.length?0:1,differences:[],checkedSectors:[]};
    for(const sector of sectors){
      options.signal?.throwIfAborted();
      const bounds={from:{x:Math.max(sector.bounds.from.x,plan.boundingBox.from.x),y:plan.boundingBox.from.y,z:Math.max(sector.bounds.from.z,plan.boundingBox.from.z)},to:{x:Math.min(sector.bounds.to.x,plan.boundingBox.to.x),y:plan.boundingBox.to.y,z:Math.min(sector.bounds.to.z,plan.boundingBox.to.z)}};
      if(options.beforeSection)await options.beforeSection(bounds);
      options.signal?.throwIfAborted();
      const checked=this.verify({...plan,blocks:sector.blocks,boundingBox:bounds,requiredAir:plan.requiredAir?.filter(p=>p.x>=bounds.from.x&&p.x<=bounds.to.x&&p.z>=bounds.from.z&&p.z<=bounds.to.z)},options.includeExtras);
      for(const key of ['correct','missing','incorrect','extra','unreachable'] as const)result[key]+=checked[key];
      result.differences.push(...checked.differences);
      result.accuracy=result.expected?result.correct/result.expected:1;
      if(checked.unreachable===0)result.checkedSectors!.push(sector.key);
      options.onProgress?.({...result,differences:[]});
    }
    return result;
  }
}
