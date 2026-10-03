import type mineflayer from 'mineflayer';
import { randomUUID } from 'node:crypto';
import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import { BlockService } from '../services/block-service.js';
import type { InternalBlueprint } from '../blueprints/blueprint.js';
import { BlueprintParser } from '../blueprints/blueprint-parser.js';
import { BlueprintValidator, type BlueprintValidationResult } from '../blueprints/blueprint-validator.js';
import { BuildPlanner } from './planner/build-planner.js';
import { PlacementQueue } from './executor/placement-queue.js';
import { BuildExecutor } from './executor/build-executor.js';
import { CinematicBuildStrategy, FastBuildStrategy, PhysicalBuildStrategy, type BuildExecutionStrategy } from './executor/execution-strategy.js';
import { StructureVerifier, isVerificationComplete } from './verification/structure-verifier.js';
import { BuildCompletionService } from './verification/build-completion.js';
import { BuildCheckpoints, planFingerprint, type BuildCheckpoint } from './history/build-checkpoints.js';
import { placementPlan } from './planner/placement-plan.js';
import { normalizePlacements } from './planner/normalize-placements.js';
import { validateDesign, parseDesignRequirements, translateDesign } from './verification/design-validator.js';
import { RegionPositioner } from '../world/region-positioner.js';
import { BuildValidationError, positionKey } from './build-types.js';
import type { RepairResult } from './verification/structure-repair.js';
import type { VerificationResult } from './verification/verification-result.js';
import { BuildHistory } from './history/build-history.js';
import { createBuildResult, type StructuredBuildResult } from './build-result.js';
import { loadBuildConfiguration } from './build-context.js';
import type { BlockPlacement, BlockPosition, BuildConfiguration, BuildExecutionOptions, BuildMode, BuildPlan, BuildProgress, BuildRecord, ExecutionResult, RegionBounds } from './build-types.js';
import { BuildLimitError, normalizeBounds, regionVolume } from './build-types.js';
import { BuildPreflight } from './verification/build-preflight.js';

interface ActiveBuild {
  progress: BuildProgress;
  plan: BuildPlan;
  controller: AbortController;
  strategy: BuildExecutionStrategy;
  execution?: ExecutionResult;
}

export interface BuildPreview {
  valid: boolean;
  name: string;
  dimensions: InternalBlueprint['size'];
  blocks: number;
  materials: Record<string, number>;
  boundingBox: RegionBounds;
  estimatedDurationMs: number;
  warnings: string[];
  errors: string[];
}

export class BuildService {
  readonly config: BuildConfiguration;
  readonly history = new BuildHistory();
  private readonly planner = new BuildPlanner();
  private readonly parser = new BlueprintParser();
  private readonly verifier: StructureVerifier;
  private readonly completion: BuildCompletionService;
  private readonly checkpoints: BuildCheckpoints;
  private readonly modes = new Map<string, BuildMode>();
  private readonly preflight: BuildPreflight;
  private readonly active = new Map<string, ActiveBuild>();
  private readonly plans = new Map<string, BuildPlan>();


  constructor(private readonly botOrGetter: BotOrGetter, overrides: Partial<BuildConfiguration> = {}) {
    this.config = loadBuildConfiguration(overrides);
    this.verifier = new StructureVerifier(botOrGetter);
    this.completion = new BuildCompletionService(botOrGetter);
    this.checkpoints = new BuildCheckpoints(this.config.checkpointDirectory);
    this.preflight = new BuildPreflight(botOrGetter, this.config.maxPreflightBlocks, this.config.preflightNavigationTimeoutMs, undefined, this.config.teleportEnabled && this.config.fastModeEnabled);
  }
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  parseBlueprint(value: string | unknown): InternalBlueprint { return this.parser.parse(value); }

  validateBlueprint(blueprint: InternalBlueprint): BlueprintValidationResult {
    const result=new BlueprintValidator(this.config, this.bot.version).validate(blueprint);
    try {const design=parseDesignRequirements(blueprint.metadata?.design);validateDesign(blueprint.blocks.map(b=>({position:{x:b.x,y:b.y,z:b.z},block:b.block,state:b.state})),design);} catch(error){result.errors.push(error instanceof Error?error.message:String(error));result.valid=false;}
    return result;
  }

  preview(blueprintInput: string | unknown, origin: BlockPosition = { x: 0, y: 0, z: 0 }, mode = this.config.mode): BuildPreview {
    const blueprint = this.parser.parse(blueprintInput);
    const validation = this.validateBlueprint(blueprint);
    const plan = this.planner.plan(blueprint, origin);
    const perBlockMs = mode === 'physical' ? 450 : mode === 'cinematic' ? 30 : 8;
    return {
      valid: validation.valid,
      name: blueprint.name,
      dimensions: blueprint.size,
      blocks: blueprint.blocks.length,
      materials: plan.materials,
      boundingBox: plan.boundingBox,
      estimatedDurationMs: blueprint.blocks.length * perBlockMs,
      warnings: validation.warnings,
      errors: validation.errors
    };
  }

  async buildBlueprint(blueprintInput: string | unknown, origin: BlockPosition, mode = this.config.mode, options: BuildExecutionOptions = {}): Promise<StructuredBuildResult> {
    const blueprint = this.parser.parse(blueprintInput);
    const validation = this.validateBlueprint(blueprint);
    if (!validation.valid) throw new Error(`Blueprint validation failed: ${validation.errors.join('; ')}`);
    const plan = this.planner.plan(blueprint, origin);
    const design=parseDesignRequirements(blueprint.metadata?.design);
    return this.executePlan(plan, mode, {...options,design:options.design ?? translateDesign(design,origin)});
  }

  async executePlacements(name:string,placements:BlockPlacement[],mode=this.config.mode,options:BuildExecutionOptions={}):Promise<StructuredBuildResult>{
    this.enforceBlockLimit(placements.length);
    const final=normalizePlacements(placements);
    if(options.expectedBlocks!==undefined && options.expectedBlocks!==final.length)throw new BuildValidationError('PLAN_COUNT_MISMATCH','Declared '+options.expectedBlocks+' blocks but final plan contains '+final.length+' unique positions');
    validateDesign(final,options.design);
    return this.executePlan(placementPlan(name,final),mode,options);
  }

  async fillRegion(bounds: RegionBounds, block: string, mode = this.config.mode): Promise<StructuredBuildResult> {
    const normalized = normalizeBounds(bounds.from, bounds.to);
    this.enforceBlockLimit(regionVolume(normalized));
    const placements: BlockPlacement[] = [];
    for (let x = normalized.from.x; x <= normalized.to.x; x += 1) for (let y = normalized.from.y; y <= normalized.to.y; y += 1) for (let z = normalized.from.z; z <= normalized.to.z; z += 1) placements.push({ position: { x, y, z }, block });
    return this.executePlacements('fill-region', placements, mode, { preflight: false });
  }

  clearRegion(bounds: RegionBounds, mode = this.config.mode): Promise<StructuredBuildResult> { return this.fillRegion(bounds, 'air', mode); }

  async replaceBlocks(bounds: RegionBounds, fromBlock: string, toBlock: string, mode = this.config.mode): Promise<StructuredBuildResult> {
    const normalized = normalizeBounds(bounds.from, bounds.to); this.enforceBlockLimit(regionVolume(normalized));
    const placements: BlockPlacement[] = [];
    for (let x = normalized.from.x; x <= normalized.to.x; x += 1) for (let y = normalized.from.y; y <= normalized.to.y; y += 1) for (let z = normalized.from.z; z <= normalized.to.z; z += 1) {
      if (this.bot.blockAt(new Vec3(x, y, z))?.name === fromBlock.replace(/^minecraft:/, '')) placements.push({ position: { x, y, z }, block: toBlock });
    }
    return this.executePlacements('replace-blocks', placements, mode, { preflight: false });
  }

  async cloneRegion(bounds: RegionBounds, destination: BlockPosition, mode = this.config.mode): Promise<StructuredBuildResult> {
    const normalized = normalizeBounds(bounds.from, bounds.to); this.enforceBlockLimit(regionVolume(normalized));
    const placements: BlockPlacement[] = [];
    for (let x = normalized.from.x; x <= normalized.to.x; x += 1) for (let y = normalized.from.y; y <= normalized.to.y; y += 1) for (let z = normalized.from.z; z <= normalized.to.z; z += 1) {
      const block = this.bot.blockAt(new Vec3(x, y, z));
      if (block) placements.push({ position: { x: destination.x + x - normalized.from.x, y: destination.y + y - normalized.from.y, z: destination.z + z - normalized.from.z }, block: block.name, state: typeof block.getProperties === 'function' ? block.getProperties() as Record<string, string | number | boolean> : undefined });
    }
    return this.executePlacements('clone-region', placements, mode, { preflight: false });
  }

  getProgress(id:string):BuildProgress|undefined {
    return structuredClone(this.active.get(id)?.progress ?? this.history.get(id) ?? this.checkpoints.load(id)?.progress);
  }
  cancel(id:string):boolean {const b=this.active.get(id);if(!b)return false;b.progress.status='cancelled';b.controller.abort();return true;}
  pause(id:string):boolean {const b=this.active.get(id);if(!b||b.progress.status!=='building')return false;b.progress.status='paused';return true;}
  resume(id:string):boolean {const b=this.active.get(id);if(!b||b.progress.status!=='paused')return false;b.progress.status='building';return true;}

  private savedPlan(id:string):BuildPlan {
    const plan=this.plans.get(id) ?? this.checkpoints.load(id)?.plan;
    if(!plan)throw new BuildValidationError('BUILD_NOT_FOUND','Unknown build '+id);
    return plan;
  }
  verify(id:string,includeExtras=false):VerificationResult {return this.verifier.verify(this.savedPlan(id),includeExtras);}
  async verifyAsync(id:string,includeExtras=false):Promise<VerificationResult>{
    const saved=this.checkpoints.load(id);
    if(saved && saved.identity!==this.identity())throw new BuildValidationError('WORLD_MISMATCH','Checkpoint belongs to another server or dimension');
    const plan=this.savedPlan(id);
    if(includeExtras && regionVolume(plan.boundingBox)>this.config.maxPreflightBlocks)throw new BuildLimitError('Extra-block verification volume exceeds scan limit');
    return this.completion.verify(plan,{mode:this.modes.get(id) ?? saved?.mode ?? this.config.mode,teleportEnabled:this.config.teleportEnabled&&this.config.fastModeEnabled,sectorSize:this.config.verificationSectorSize,includeExtras});
  }
  async repair(id:string):Promise<RepairResult>{
    if(this.active.size)throw new BuildValidationError('BUILD_BUSY','Cannot repair while a build is running');
    const saved=this.checkpoints.load(id);
    if(saved && saved.identity!==this.identity())throw new BuildValidationError('WORLD_MISMATCH','Checkpoint belongs to another server or dimension');
    const plan=this.savedPlan(id),mode=this.modes.get(id) ?? saved?.mode ?? this.config.mode;
    const done=await this.completion.finalize(plan,{mode,teleportEnabled:this.config.teleportEnabled&&this.config.fastModeEnabled,sectorSize:this.config.verificationSectorSize,autoRepair:true,maxRepairPasses:this.config.maxRepairPasses},this.strategy(mode));
    const repair=done.repair ?? {passes:0,repaired:0,status:'COMPLETED' as const,verification:done.verification};
    const progress=saved?.progress ?? this.getProgress(id);
    if(progress){
      this.updateVerified(progress,done.verification);
      progress.status=isVerificationComplete(done.verification)?'completed':'partial';
      if(saved)this.checkpoints.save({...saved,progress});
    }
    return repair;
  }
  listCheckpoints(){return this.checkpoints.list();}
  async recover(id:string):Promise<StructuredBuildResult>{
    if(this.active.size)throw new BuildValidationError('BUILD_BUSY','A build is already running');
    const saved=this.checkpoints.load(id);
    if(!saved)throw new BuildValidationError('BUILD_NOT_FOUND','No checkpoint for '+id);
    if(saved.construction && saved.preflightPassed!==true)throw new BuildValidationError('PREFLIGHT_REQUIRED','Saved build did not pass site preflight; start a new construction after inspecting its site');
    if(saved.identity!==this.identity())throw new BuildValidationError('WORLD_MISMATCH','Checkpoint belongs to another server or dimension');
    this.enforceBlockLimit(saved.plan.blocks.length);
    if(normalizePlacements(saved.plan.blocks).length!==saved.plan.blocks.length)throw new BuildValidationError('CHECKPOINT_INVALID','Checkpoint has duplicate coordinates');
    return this.executePlan(saved.plan,saved.mode,{verifyAfterBuild:saved.verifyAfterBuild,autoRepair:saved.autoRepair,preflight:saved.construction},saved);
  }

  private identity():string {
    const bot=this.bot as mineflayer.Bot & {_client?:{socket?:{remoteAddress?:string;remotePort?:number}}};
    const socket=bot._client?.socket;
    return JSON.stringify({host:socket?.remoteAddress ?? 'unavailable',port:socket?.remotePort ?? 0,dimension:bot.game?.dimension ?? 'unavailable'});
  }
  private updateVerified(progress:BuildProgress,verification:VerificationResult):void{
    progress.verified=verification.correct;progress.completed=verification.correct;
    progress.pending=Math.max(verification.expected-verification.correct+verification.extra,verification.missing+verification.incorrect+verification.unreachable+verification.extra);
    progress.failed=verification.missing+verification.incorrect+verification.unreachable+verification.extra;
    progress.progress=verification.expected?verification.correct/verification.expected:1;
    if(!isVerificationComplete(verification))progress.progress=Math.min(progress.progress,0.999999);
    progress.verificationComplete=isVerificationComplete(verification);
  }

  private async assertResumeSite(plan:BuildPlan,mode:BuildMode):Promise<void>{
    const expected=new Map(plan.blocks.map(b=>[positionKey(b.position),b]));
    const bounds=plan.boundingBox,positioner=new RegionPositioner(this.botOrGetter,this.config.teleportEnabled&&this.config.fastModeEnabled);
    if(regionVolume(bounds)>this.config.maxPreflightBlocks)throw new BuildLimitError('Resume inspection exceeds preflight volume limit');
    for(let x=bounds.from.x;x<=bounds.to.x;x+=32)for(let z=bounds.from.z;z<=bounds.to.z;z+=32){
      const section={from:{x,y:bounds.from.y,z},to:{x:Math.min(x+31,bounds.to.x),y:bounds.to.y,z:Math.min(z+31,bounds.to.z)}};
      await positioner.visit(section,mode);
      for(let xx=section.from.x;xx<=section.to.x;xx++)for(let y=bounds.from.y;y<=bounds.to.y;y++)for(let zz=section.from.z;zz<=section.to.z;zz++){
        const actual=this.bot.blockAt(new Vec3(xx,y,zz));
        if(!actual)throw new BuildValidationError('SITE_UNAVAILABLE','Cannot inspect saved site before resume');
        if(['air','cave_air','void_air'].includes(actual.name))continue;
        const block=expected.get(positionKey({x:xx,y,z:zz}));
        if(!block || actual.name!==block.block)throw new BuildValidationError('SITE_CHANGED','Saved construction site now contains unexpected '+actual.name+' at '+xx+','+y+','+zz);
      }
    }
  }

  private async executePlan(plan:BuildPlan,mode:BuildMode,options:BuildExecutionOptions={},saved?:BuildCheckpoint):Promise<StructuredBuildResult>{
    if(this.active.size)throw new BuildValidationError('BUILD_BUSY','A build is already running on this service');
    this.enforceBlockLimit(plan.blocks.length);
    if(mode!=='physical' && (!this.config.fastModeEnabled||this.bot.game?.gameMode!=='creative'))throw new BuildValidationError('FAST_MODE_UNAVAILABLE','Fast construction requires explicitly enabled fast mode and creative gamemode');
    if(options.expectedBlocks!==undefined && plan.blocks.length!==options.expectedBlocks)throw new BuildValidationError('PLAN_COUNT_MISMATCH','Declared block count differs from unique final plan');
    validateDesign(plan.blocks,options.design);
    if(options.design?.requiredAir){
      const {from,to}=plan.boundingBox;
      if(options.design.requiredAir.some(p=>p.x<from.x||p.x>to.x||p.y<from.y||p.y>to.y||p.z<from.z||p.z>to.z))throw new BuildValidationError('DESIGN_OUTSIDE_BOUNDS','Required interior air must be inside the inspected construction volume');
      plan={...plan,requiredAir:options.design.requiredAir};
    }
    const id=saved?.id ?? this.nextId(),controller=new AbortController(),strategy=this.strategy(mode);
    const progress:BuildProgress={id,name:plan.name,status:'queued',progress:0,total:plan.blocks.length,completed:0,failed:0,retries:0,submitted:0,verified:0,pending:plan.blocks.length,verificationComplete:false,phase:'placement',startedAt:saved?.progress.startedAt ?? new Date().toISOString()};
    const active:ActiveBuild={progress,plan,controller,strategy};
    this.active.set(id,active);this.plans.set(id,plan);this.modes.set(id,mode);
    const started=Date.now(),shouldVerify=options.verifyAfterBuild??this.config.verify,shouldRepair=options.autoRepair??this.config.autoRepair;
    const fingerprint=planFingerprint(plan);
    let verifiedSectors:string[]=[];
    let preflightPassed=saved?.preflightPassed ?? options.preflight===false;
    const persist=()=>this.checkpoints.save({version:1,id,identity:this.identity(),fingerprint,plan,progress:structuredClone(progress),mode,verifyAfterBuild:shouldVerify,autoRepair:shouldRepair,construction:options.preflight!==false,verifiedSectors,preflightPassed});
    const positioner=new RegionPositioner(this.botOrGetter,this.config.teleportEnabled&&this.config.fastModeEnabled);
    try{
      let preflight;
      if(saved && saved.construction)await this.assertResumeSite(plan,mode);
      else if(!saved && options.preflight!==false && plan.blocks.length)preflight=await this.preflight.inspect(plan,mode);
      preflightPassed=true;
      persist();
      let work=plan;
      if(saved){
        const checked=await this.completion.verify(plan,{mode,sectorSize:this.config.verificationSectorSize,teleportEnabled:this.config.teleportEnabled&&this.config.fastModeEnabled,signal:controller.signal});
        const remaining=new Set(checked.differences.filter(d=>d.expected).map(d=>positionKey(d.position)));
        work={...plan,blocks:plan.blocks.filter(b=>remaining.has(positionKey(b.position)))};
      }
      const executor=new BuildExecutor(new PlacementQueue(this.config));
      const execution=await executor.execute(work,strategy,progress,controller,{onBatch:persist,beforeBatch:async blocks=>{
        controller.signal.throwIfAborted();
        if(blocks.some(b=>!this.bot.blockAt(new Vec3(b.position.x,b.position.y,b.position.z)))){
          const bounds=placementPlan('placement-batch',blocks).boundingBox;await positioner.visit(bounds,mode,controller.signal);
        }
      }});
      execution.requestedBlocks=plan.blocks.length;active.execution=execution;
      await strategy.settle?.();
      let verification:VerificationResult|undefined,initialVerification:VerificationResult|undefined,repairSummary:StructuredBuildResult['repair'];
      if(shouldVerify && !controller.signal.aborted){
        progress.status='verifying';progress.phase='verification';
        const done=await this.completion.finalize(plan,{mode,teleportEnabled:this.config.teleportEnabled&&this.config.fastModeEnabled,sectorSize:this.config.verificationSectorSize,autoRepair:shouldRepair,maxRepairPasses:this.config.maxRepairPasses,signal:controller.signal,onPhase:phase=>{progress.phase=phase;progress.status=phase==='repair'?'repairing':'verifying';},onProgress:v=>{verifiedSectors=v.checkedSectors??[];this.updateVerified(progress,v);persist();}},strategy);
        verification=done.verification;initialVerification=done.initial;
        if(done.repair)repairSummary={passes:done.repair.passes,repaired:done.repair.repaired,status:done.repair.status};
        this.updateVerified(progress,verification);
      }
      progress.status=controller.signal.aborted?'cancelled':verification?(isVerificationComplete(verification)?'completed':'partial'):execution.failedBlocks?'partial':'unverified';
      progress.completedAt=new Date().toISOString();
      persist();
      this.saveRecord(progress,plan.origin,mode,Date.now()-started,execution,verification);
      return createBuildResult(progress,execution,verification,initialVerification,repairSummary,preflight);
    }catch(error){
      progress.status=controller.signal.aborted?'cancelled':'failed';progress.error=error instanceof Error?error.message:String(error);progress.completedAt=new Date().toISOString();
      persist();
      const execution=active.execution??{requestedBlocks:plan.blocks.length,placedBlocks:progress.submitted??0,failedBlocks:progress.failed,failures:[],retries:progress.retries,durationMs:Date.now()-started};
      this.saveRecord(progress,plan.origin,mode,Date.now()-started,execution);throw error;
    }finally{this.active.delete(id);}
  }

  private strategy(mode: BuildMode): BuildExecutionStrategy {
    if (mode === 'physical') return new PhysicalBuildStrategy(new BlockService(this.botOrGetter));
    const fast = new FastBuildStrategy(this.botOrGetter, this.config.fastModeEnabled, this.config.fastCommandIntervalMs);
    return mode === 'cinematic' ? new CinematicBuildStrategy(fast, this.config.cinematicDelayMs) : fast;
  }
  private enforceBlockLimit(count: number): void { if (count > this.config.maxBlocks || count > this.config.maxQueue) throw new BuildLimitError(`Operation contains ${count} blocks; configured maximum is ${Math.min(this.config.maxBlocks, this.config.maxQueue)}`); }
  private nextId(): string { return 'build_'+randomUUID(); }
  private saveRecord(progress: BuildProgress, origin: BlockPosition, mode: BuildMode, durationMs: number, execution: ExecutionResult, verification?: VerificationResult): void {
    const record: BuildRecord = { ...progress, origin, mode, accuracy: verification?.accuracy, metrics: { toolCalls: 1, durationMs, blocksPlaced: verification?.correct ?? 0, blocksFailed: execution.failedBlocks, retries: execution.retries, verificationErrors: verification?.differences.length ?? 0 } };
    this.history.save(record);
  }
}
