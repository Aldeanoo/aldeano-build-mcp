import type { ExecutionResult, PlacementFailure, PlacementQueueConfig, PlannedBlock } from '../build-types.js';

export interface QueueControl {
  signal?: AbortSignal;
  isPaused?: () => boolean;
  onProgress?: (completed: number, failed: number, retries: number) => void;
  beforeBatch?: (items:PlannedBlock[])=>Promise<void>;
  onBatch?: ()=>void;
}

export class PlacementQueue {
  constructor(private readonly config: PlacementQueueConfig) {}

  async execute(items: PlannedBlock[], handler: (item: PlannedBlock, signal?: AbortSignal) => Promise<void>, control: QueueControl = {}): Promise<ExecutionResult> {
    const started = Date.now();
    const failures: PlacementFailure[] = [];
    let placed = 0; let retries = 0;
    for (let offset = 0; offset < items.length; offset += this.config.batchSize) {
      const batch = items.slice(offset, offset + this.config.batchSize);
      if(control.signal?.aborted)break;
      await control.beforeBatch?.(batch);
      for (let cursor = 0; cursor < batch.length; cursor += this.config.concurrency) {
        if (control.signal?.aborted) break;
        while (control.isPaused?.() && !control.signal?.aborted) await new Promise((resolve) => setTimeout(resolve, 50));
        const chunk = batch.slice(cursor, cursor + this.config.concurrency);
        await Promise.all(chunk.map(async (item) => {
          let attempts = 0;
          while (attempts <= this.config.retryCount) {
            attempts += 1;
            try {
              await this.withTimeout(handler(item, control.signal));
              placed += 1; retries += attempts - 1; control.onProgress?.(placed, failures.length, retries); return;
            } catch (error) {
              if (attempts > this.config.retryCount || control.signal?.aborted) {
                retries += Math.max(0, attempts - 1);
                failures.push({ placement: item, error: error instanceof Error ? error.message : String(error), attempts });
                control.onProgress?.(placed, failures.length, retries); return;
              }
            }
          }
        }));
      }
      if (control.signal?.aborted) break;
      control.onBatch?.();
    }
    return { requestedBlocks: items.length, placedBlocks: placed, failedBlocks: failures.length, failures, retries, durationMs: Date.now() - started };
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Placement timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs); });
    try { return await Promise.race([operation, timeout]); } finally { clearTimeout(timer!); }
  }
}
