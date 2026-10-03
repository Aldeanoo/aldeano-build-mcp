import type { BotOrGetter } from '../../services/types.js';
import { resolveBot } from '../../services/service-utils.js';
import type { BlockPlacement, BuildMode, BuildPlan, RegionBounds } from '../build-types.js';
import { BuildValidationError } from '../build-types.js';
import { placementPlan } from '../planner/placement-plan.js';
import { RegionPositioner } from '../../world/region-positioner.js';
import { StructureVerifier, isVerificationComplete } from './structure-verifier.js';
import { StructureRepair } from './structure-repair.js';
import type { RepairResult } from './structure-repair.js';
import type { VerificationResult } from './verification-result.js';
import { FastCommandBatch } from '../executor/fast-command-batch.js';
import type { BuildExecutionStrategy } from '../executor/execution-strategy.js';

export interface CompletionOptions {
  mode?:BuildMode;
  teleportEnabled?:boolean;
  sectorSize?:number;
  autoRepair?:boolean;
  maxRepairPasses?:number;
  signal?:AbortSignal;
  includeExtras?:boolean;
  onProgress?:(result:VerificationResult)=>void;
  visit?:(bounds:RegionBounds)=>Promise<void>;
  onPhase?:(phase:'verification'|'repair')=>void;
}

/** Shared finalization gate for MCP builds and standalone workers/scripts. */
export class BuildCompletionService {
  readonly verifier:StructureVerifier;
  constructor(private readonly botOrGetter:BotOrGetter){this.verifier=new StructureVerifier(botOrGetter);}

  async verify(plan:BuildPlan,options:CompletionOptions={}):Promise<VerificationResult>{
    options.onPhase?.('verification');
    const positioner=new RegionPositioner(this.botOrGetter,options.teleportEnabled??true);
    return this.verifier.verifyAsync(plan,{includeExtras:options.includeExtras,sectorSize:options.sectorSize,signal:options.signal,onProgress:options.onProgress,beforeSection:options.visit??(bounds=>positioner.visit(bounds,options.mode??'fast',options.signal))});
  }

  async finalize(plan:BuildPlan,options:CompletionOptions={},strategy?:BuildExecutionStrategy):Promise<{initial:VerificationResult;verification:VerificationResult;repair?:RepairResult}>{
    const initial=await this.verify(plan,options);
    if(isVerificationComplete(initial)||options.autoRepair===false)return {initial,verification:initial};
    const bot=resolveBot(this.botOrGetter),positioner=new RegionPositioner(this.botOrGetter,options.teleportEnabled??true);
    if(!strategy && (options.mode==='physical'||bot.game?.gameMode!=='creative'))throw new BuildValidationError('REPAIR_UNAVAILABLE','A physical repair requires a placement strategy');
    let submitted=0;
    const paced:BuildExecutionStrategy=strategy??{mode:'fast',place:async(block,signal)=>{
      signal?.throwIfAborted();
      const name=block.block+(block.state?'['+Object.entries(block.state).map(([k,v])=>`${k}=${v}`).join(',')+']':'');
      await new FastCommandBatch(this.botOrGetter,0,1).execute([{type:'setblock',position:block.position,block:name}]);
      if(++submitted%8===0)await bot.waitForTicks(1);
    },settle:()=>bot.waitForTicks(4)};
    let sector='';
    const repairer=new StructureRepair(this.verifier,p=>this.verify(p,options),async block=>{
      options.onPhase?.('repair');
      const size=options.sectorSize??32,key=`${Math.floor(block.position.x/size)},${Math.floor(block.position.z/size)}`;
      if(key===sector)return;
      sector=key;
      const bounds={from:block.position,to:block.position};
      if(options.visit)await options.visit(bounds);else await positioner.visit(bounds,options.mode??'fast',options.signal);
    });
    const controller=new AbortController();
    const abort=()=>controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
    try {const repair=await repairer.repair(plan,paced,options.maxRepairPasses??3,controller);return {initial,verification:repair.verification,repair};}
    finally {options.signal?.removeEventListener('abort',abort);}
  }
}

export async function finalizePlacements(bot:BotOrGetter,placements:BlockPlacement[],options:CompletionOptions={}):Promise<VerificationResult>{
  const final=await new BuildCompletionService(bot).finalize(placementPlan('script-final-state',placements),options);
  if(!isVerificationComplete(final.verification))throw new BuildValidationError('BUILD_INCOMPLETE',`${final.verification.correct}/${final.verification.expected} correct; ${final.verification.unreachable} unreadable; ${final.verification.extra} unexpected`);
  return final.verification;
}

export async function finalizeVoxels(bot:BotOrGetter,voxels:Map<string,string>,origin:{x:number;y:number;z:number},options:CompletionOptions={}):Promise<VerificationResult>{
  return finalizePlacements(bot,[...voxels].map(([key,block])=>{const [x,y,z]=key.split(',').map(Number);return {position:{x:origin.x+x,y:origin.y+y,z:origin.z+z},block};}),options);
}
