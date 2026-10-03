import type { BotOrGetter } from '../../services/types.js';
import { resolveBot } from '../../services/service-utils.js';
import type { BlockPosition } from '../build-types.js';

export type FastCommandOperation =
  | { type: 'fill'; from: BlockPosition; to: BlockPosition; block: string }
  | { type: 'setblock'; position: BlockPosition; block: string };

export interface FastCommandBatchResult {
  commands: number;
  estimatedBlockOperations: number;
  durationMs: number;
}

function blockArgument(value: string): string {
  const normalized = value.replace(/^minecraft:/, '');
  if (!/^[a-z0-9_]+(?:\[[a-z0-9_=,-]+\])?$/.test(normalized)) throw new Error(`Invalid bounded block argument '${value}'`);
  return `minecraft:${normalized}`;
}

export function validateFastOperation(operation: FastCommandOperation): void {
  const positions = operation.type === 'fill' ? [operation.from, operation.to] : [operation.position];
  if (positions.some(p => ![p.x, p.y, p.z].every(Number.isSafeInteger))) throw new Error('Coordinates must be safe integers');
  blockArgument(operation.block);
  if (operation.type === 'fill') {
    const { from, to } = operation;
    const volume = (Math.abs(to.x - from.x) + 1) * (Math.abs(to.y - from.y) + 1) * (Math.abs(to.z - from.z) + 1);
    if (volume > 32_768) throw new Error(`Fill volume ${volume} exceeds Minecraft's 32768-block command limit`);
  }
}

export class FastCommandBatch {
  constructor(private readonly botOrGetter: BotOrGetter, private readonly intervalMs = 50, private readonly maxCommands = 1_000) {}

  async execute(operations: FastCommandOperation[]): Promise<FastCommandBatchResult> {
    if (operations.length > this.maxCommands) throw new Error(`Command batch contains ${operations.length} commands; maximum is ${this.maxCommands}`);
    operations.forEach(validateFastOperation);
    const bot = resolveBot(this.botOrGetter);
    const started = Date.now();
    let estimatedBlockOperations = 0;
    for (const operation of operations) {
      if (operation.type === 'fill') {
        const { from, to } = operation;
        const volume = (Math.abs(to.x - from.x) + 1) * (Math.abs(to.y - from.y) + 1) * (Math.abs(to.z - from.z) + 1);
        if (volume > 32_768) throw new Error(`Fill volume ${volume} exceeds Minecraft's 32768-block command limit`);
        estimatedBlockOperations += volume;
        bot.chat(`/fill ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${blockArgument(operation.block)} replace`);
      } else {
        estimatedBlockOperations += 1;
        const { x, y, z } = operation.position;
        bot.chat(`/setblock ${x} ${y} ${z} ${blockArgument(operation.block)} replace`);
      }
      if (this.intervalMs > 0) await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    }
    return { commands: operations.length, estimatedBlockOperations, durationMs: Date.now() - started };
  }
}
