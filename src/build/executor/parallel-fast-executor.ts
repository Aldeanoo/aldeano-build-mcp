import type mineflayer from 'mineflayer';
import { FastCommandBatch, validateFastOperation, type FastCommandOperation } from './fast-command-batch.js';
import { placementPlan } from '../planner/placement-plan.js';
import { BuildCompletionService } from '../verification/build-completion.js';
import { isVerificationComplete } from '../verification/structure-verifier.js';
import { BuildValidationError, positionKey, type BlockPlacement } from '../build-types.js';

export interface ParallelFastOptions {
  commandsPerTick?: number;
  signal?: AbortSignal;
  onProgress?: (submitted: number, total: number) => void;
  verifyAfterBuild?:boolean;
  autoRepair?:boolean;
  teleportEnabled?:boolean;
  maxExpectedBlocks?:number;
  onVerificationProgress?:(verified:number,total:number)=>void;
}

/** Partition commands into disjoint X slabs. Each worker preserves input order. */
export function partitionFastOperations(operations: FastCommandOperation[], count: number): FastCommandOperation[][] {
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('Worker count must be between 1 and 4');
  const result: FastCommandOperation[][] = Array.from({ length: count }, () => []);
  if (!operations.length) return result;
  let minX = Infinity; let maxX = -Infinity;
  for (const op of operations) {
    const from = op.type === 'fill' ? op.from : op.position;
    const to = op.type === 'fill' ? op.to : op.position;
    for (const p of [from, to]) if (![p.x, p.y, p.z].every(Number.isSafeInteger)) throw new Error('Coordinates must be safe integers');
    minX = Math.min(minX, from.x, to.x); maxX = Math.max(maxX, from.x, to.x);
  }
  const width = Math.ceil((maxX - minX + 1) / count);
  for (const op of operations) {
    if (op.type === 'setblock') { result[Math.min(count - 1, Math.floor((op.position.x - minX) / width))].push(op); continue; }
    for (let worker = 0; worker < count; worker++) {
      const low = Math.max(Math.min(op.from.x, op.to.x), minX + worker * width);
      const high = Math.min(Math.max(op.from.x, op.to.x), minX + (worker + 1) * width - 1);
      if (low <= high) result[worker].push({ ...op, from: { ...op.from, x: low }, to: { ...op.to, x: high } });
    }
  }
  return result;
}

/** A bounded pool of already connected bots. No wall-clock sleeps or build deadline. */
export class ParallelFastExecutor {
  constructor(private readonly bots: mineflayer.Bot[]) {
    if (bots.length < 1 || bots.length > 4) throw new Error('Provide 1 to 4 connected worker bots');
    if (new Set(bots).size !== bots.length) throw new Error('Each worker must have its own bot connection');
  }

  async execute(operations: FastCommandOperation[], options: ParallelFastOptions = {}): Promise<{ submittedCommands: number; durationMs: number; status:'completed'|'unverified'; expectedBlocks:number; verifiedBlocks:number }> {
    const burst = options.commandsPerTick ?? 2;
    if (!Number.isInteger(burst) || burst < 1 || burst > 8) throw new Error('commandsPerTick must be between 1 and 8');
    operations.forEach(validateFastOperation);
    const sections = partitionFastOperations(operations, this.bots.length);
    const plans=sections.map(section=>operationsPlan(section,options.maxExpectedBlocks));
    const total = sections.reduce((sum, items) => sum + items.length, 0);
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const started = Date.now(); let submitted = 0;
    const expectedBlocks=plans.reduce((sum,plan)=>sum+plan.blocks.length,0);
    let verifiedBlocks=0;
    const workerVerified=plans.map(()=>0);
    try {
      const outcomes = await Promise.allSettled(this.bots.map(async (bot, index) => {
        const onEnd = () => controller.abort(new Error(`Worker ${index + 1} disconnected`));
        bot.once('end', onEnd);
        try {
          const batch = new FastCommandBatch(bot, 0, burst);
          for (let offset = 0; offset < sections[index].length; offset += burst) {
            controller.signal.throwIfAborted();
            const commands = sections[index].slice(offset, offset + burst);
            await batch.execute(commands);
            submitted += commands.length; options.onProgress?.(submitted, total);
            await this.nextTick(bot, controller.signal);
          }
          const plan=plans[index];
          if(options.verifyAfterBuild!==false && plan.blocks.length){
            const completion=await new BuildCompletionService(bot).finalize(plan,{mode:'fast',teleportEnabled:options.teleportEnabled,autoRepair:options.autoRepair,signal:controller.signal,onProgress:v=>{workerVerified[index]=v.correct;options.onVerificationProgress?.(workerVerified.reduce((sum,n)=>sum+n,0),expectedBlocks);}});
            if(!isVerificationComplete(completion.verification))throw new BuildValidationError('BUILD_INCOMPLETE','Worker '+(index+1)+' verified '+completion.verification.correct+'/'+completion.verification.expected+' blocks');
            verifiedBlocks+=completion.verification.correct;
          }
        } catch (error) { controller.abort(error); throw error; }
        finally { bot.removeListener('end', onEnd); }
      }));
      const failure = outcomes.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      return { submittedCommands: submitted, durationMs: Date.now() - started, status:options.verifyAfterBuild===false?'unverified':'completed',expectedBlocks,verifiedBlocks };
    } finally { options.signal?.removeEventListener('abort', abort); }
  }

  private nextTick(bot: mineflayer.Bot, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => { bot.removeListener('physicsTick', tick); signal.removeEventListener('abort', aborted); };
      const tick = () => { cleanup(); resolve(); };
      const aborted = () => { cleanup(); reject(signal.reason ?? new Error('Build cancelled')); };
      if (signal.aborted) { reject(signal.reason); return; }
      bot.once('physicsTick', tick); signal.addEventListener('abort', aborted, { once: true });
    });
  }
}

/** Expand only bounded typed operations and retain the last state at every coordinate. */
export function operationsPlan(operations:FastCommandOperation[],maxBlocks=1_000_000){
  if(!Number.isSafeInteger(maxBlocks)||maxBlocks<1||maxBlocks>1_000_000)throw new BuildValidationError('INVALID_LIMIT','Verification limit must be between 1 and 1000000');
  operations.forEach(validateFastOperation);
  const placements=new Map<string,BlockPlacement>();
  const add=(position:{x:number;y:number;z:number},block:string)=>{
    if(![position.x,position.y,position.z].every(Number.isSafeInteger))throw new BuildValidationError('INVALID_POSITION','Operation coordinates must be integers');
    placements.set(positionKey(position),{position,block});
    if(placements.size>maxBlocks)throw new BuildValidationError('LIMIT_EXCEEDED','Operation verification exceeds '+maxBlocks+' unique positions');
  };
  for(const op of operations){
    if(op.type==='setblock')add(op.position,op.block);
    else for(let x=Math.min(op.from.x,op.to.x);x<=Math.max(op.from.x,op.to.x);x++)for(let y=Math.min(op.from.y,op.to.y);y<=Math.max(op.from.y,op.to.y);y++)for(let z=Math.min(op.from.z,op.to.z);z<=Math.max(op.from.z,op.to.z);z++)add({x,y,z},op.block);
  }
  return placementPlan('parallel-final-state',[...placements.values()]);
}
