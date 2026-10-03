import type { InternalBlueprint } from './blueprint.js';

export class BlueprintStorage {
  private readonly blueprints = new Map<string, InternalBlueprint>();

  save(blueprint: InternalBlueprint): void {
    this.blueprints.set(blueprint.name, structuredClone(blueprint));
  }

  get(name: string): InternalBlueprint | undefined {
    const blueprint = this.blueprints.get(name);
    return blueprint ? structuredClone(blueprint) : undefined;
  }

  list(): Array<{ name: string; blocks: number; size: InternalBlueprint['size'] }> {
    return [...this.blueprints.values()].map(({ name, blocks, size }) => ({ name, blocks: blocks.length, size: { ...size } }));
  }

  remove(name: string): boolean {
    return this.blueprints.delete(name);
  }
}
