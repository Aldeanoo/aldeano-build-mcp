import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { BuildPlan, BuildProgress, BuildMode } from '../build-types.js';
import { BuildValidationError } from '../build-types.js';
import { normalizePlacements } from '../planner/normalize-placements.js';

export interface BuildCheckpoint {
  version:1;
  id:string;
  identity:string;
  fingerprint:string;
  plan:BuildPlan;
  progress:BuildProgress;
  mode:BuildMode;
  verifyAfterBuild:boolean;
  autoRepair:boolean;
  construction:boolean;
  preflightPassed?:boolean;
  verifiedSectors?:string[];
}

export function planFingerprint(plan:BuildPlan):string {
  return createHash('sha256').update(JSON.stringify({name:plan.name,origin:plan.origin,boundingBox:plan.boundingBox,blocks:normalizePlacements(plan.blocks),requiredAir:plan.requiredAir})).digest('hex');
}

export class BuildCheckpoints {
  constructor(private readonly directory:string|false){}
  private target(id:string):string {
    if(!this.directory)throw new BuildValidationError('CHECKPOINTS_DISABLED','Build checkpoints are disabled');
    if(!/^build_[a-f0-9-]{36}$/.test(id))throw new BuildValidationError('INVALID_BUILD_ID','Invalid checkpoint ID');
    return path.join(path.resolve(this.directory),id+'.json');
  }
  save(checkpoint:BuildCheckpoint):void {
    if(!this.directory)return;
    const target=this.target(checkpoint.id);
    mkdirSync(path.dirname(target),{recursive:true});
    const temporary=target+'.tmp';
    writeFileSync(temporary,JSON.stringify(checkpoint),'utf8');
    renameSync(temporary,target);
  }
  load(id:string):BuildCheckpoint|undefined {
    if(!this.directory)return undefined;
    if(!/^build_[a-f0-9-]{36}$/.test(id))return undefined;
    const target=this.target(id);if(!existsSync(target))return undefined;
    const value=JSON.parse(readFileSync(target,'utf8')) as BuildCheckpoint;
    if(value.version!==1||value.id!==id||!value.plan||!value.progress||!['physical','fast','cinematic'].includes(value.mode)||typeof value.identity!=='string'||typeof value.verifyAfterBuild!=='boolean'||typeof value.autoRepair!=='boolean'||typeof value.construction!=='boolean')throw new BuildValidationError('CHECKPOINT_INVALID','Invalid checkpoint contract');
    if(value.fingerprint!==planFingerprint(value.plan))throw new BuildValidationError('CHECKPOINT_CHANGED','Saved plan fingerprint does not match');
    return value;
  }
  list():Array<{id:string;status:BuildProgress['status'];name:string}> {
    if(!this.directory||!existsSync(this.directory))return [];
    return readdirSync(this.directory).filter(n=>/^build_[a-f0-9-]{36}\.json$/.test(n)).map(n=>this.load(n.slice(0,-5))!).map(c=>({id:c.id,status:c.progress.status,name:c.plan.name}));
  }
}
