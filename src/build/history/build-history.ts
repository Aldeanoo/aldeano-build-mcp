import type { BuildRecord } from '../build-types.js';

export class BuildHistory {
  private readonly records = new Map<string, BuildRecord>();
  save(record: BuildRecord): void { this.records.set(record.id, structuredClone(record)); }
  get(id: string): BuildRecord | undefined { const value = this.records.get(id); return value ? structuredClone(value) : undefined; }
  list(limit = 50): BuildRecord[] { return [...this.records.values()].slice(-Math.max(1, limit)).reverse().map((item) => structuredClone(item)); }
}
