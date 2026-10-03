import type { PlannedBlock } from '../build-types.js';
import { positionKey } from '../build-types.js';

const NEEDS_SUPPORT_BELOW = /door|bed|rail|lantern|sign|button|lever/;
const ATTACHED = /torch|ladder|button|lever|wall_sign|wall_banner/;

export class DependencyResolver {
  resolve(blocks: PlannedBlock[]): PlannedBlock[] {
    const byPosition = new Map(blocks.map((block) => [positionKey(block.position), block.index]));
    const enriched = blocks.map((block) => {
      const dependencies = new Set(block.dependencies);
      if (NEEDS_SUPPORT_BELOW.test(block.block)) {
        const support = byPosition.get(positionKey({ ...block.position, y: block.position.y - 1 }));
        if (support !== undefined) dependencies.add(support);
      }
      if (ATTACHED.test(block.block)) {
        const stateFacing = typeof block.state?.facing === 'string' ? block.state.facing : undefined;
        const offset = stateFacing === 'north' ? { x: 0, z: 1 }
          : stateFacing === 'south' ? { x: 0, z: -1 }
            : stateFacing === 'east' ? { x: -1, z: 0 }
              : stateFacing === 'west' ? { x: 1, z: 0 }
                : { x: 0, z: 0 };
        const support = byPosition.get(positionKey({ x: block.position.x + offset.x, y: block.position.y, z: block.position.z + offset.z }));
        if (support !== undefined && support !== block.index) dependencies.add(support);
      }
      return { ...block, dependencies: [...dependencies] };
    });

    const result: PlannedBlock[] = [];
    const pending = new Map(enriched.map((block) => [block.index, block]));
    const completed = new Set<number>();
    while (pending.size > 0) {
      const ready = [...pending.values()].filter((block) => block.dependencies.every((id) => completed.has(id) || !pending.has(id)));
      if (ready.length === 0) {
        result.push(...pending.values());
        break;
      }
      for (const block of ready) {
        result.push(block); pending.delete(block.index); completed.add(block.index);
      }
    }
    return result;
  }
}
