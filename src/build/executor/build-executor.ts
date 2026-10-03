import type { BuildPlan, BuildProgress, ExecutionResult } from '../build-types.js';
import type { BuildExecutionStrategy } from './execution-strategy.js';
import { PlacementQueue, type QueueControl } from './placement-queue.js';

export class BuildExecutor {
  constructor(private readonly queue: PlacementQueue) {}

  execute(plan: BuildPlan, strategy: BuildExecutionStrategy, progress: BuildProgress, controller: AbortController, options:Pick<QueueControl,'beforeBatch'|'onBatch'>={}): Promise<ExecutionResult> {
    progress.status = 'building';
    return this.queue.execute(plan.blocks, (block, signal) => strategy.place(block, signal), {
      ...options,
      signal: controller.signal,
      isPaused: () => progress.status === 'paused',
      onProgress: (completed, failed, retries) => {
        progress.submitted = completed; progress.failed = failed; progress.retries = retries;
        progress.phase='placement';
      }
    });
  }
}
