import type { BuildExecutionStrategy } from '../executor/execution-strategy.js';
import type { BuildPlan, PlannedBlock } from '../build-types.js';
import { StructureVerifier, isVerificationComplete } from './structure-verifier.js';
import type { VerificationResult } from './verification-result.js';

export interface RepairResult {
  passes: number;
  repaired: number;
  status: 'COMPLETED' | 'PARTIAL';
  verification: VerificationResult;
}

export class StructureRepair {
  constructor(private readonly verifier: StructureVerifier, private readonly verifyPlan?: (plan:BuildPlan)=>Promise<VerificationResult>, private readonly beforePlacement?: (block:PlannedBlock)=>Promise<void>) {}

  async repair(plan: BuildPlan, strategy: BuildExecutionStrategy, maxPasses: number, controller = new AbortController()): Promise<RepairResult> {
    const verify=()=>this.verifyPlan ? this.verifyPlan(plan) : Promise.resolve(this.verifier.verify(plan));
    let verification = await verify();
    const initialProblems=verification.differences.length;
    let repaired = 0;
    let passes = 0;
    while (!isVerificationComplete(verification) && passes < maxPasses && !controller.signal.aborted) {
      passes += 1;
      const repairs: PlannedBlock[] = verification.differences.flatMap((difference, index) => {
        if (difference.type === 'UNREACHABLE') return [];
        if (difference.type === 'EXTRA_BLOCK') {
          return [{ index, position: difference.position, block: 'air', category: 'decoration', dependencies: [] }];
        }
        return difference.expected ? [{ ...difference.expected, index, dependencies: [] }] : [];
      });
      for (const block of repairs) {
        if(controller.signal.aborted) break;
        try { await this.beforePlacement?.(block); await strategy.place(block, controller.signal); } catch { /* reported by verification */ }
      }
      await strategy.settle?.();
      verification = await verify();
    }
    repaired=Math.max(0,initialProblems-verification.differences.length);
    return { passes, repaired, status: isVerificationComplete(verification) ? 'COMPLETED' : 'PARTIAL', verification };
  }
}
