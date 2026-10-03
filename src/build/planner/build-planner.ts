import type { InternalBlueprint } from '../../blueprints/blueprint.js';
import type { BlockPosition, BuildPlan, PlannedBlock } from '../build-types.js';
import { normalizeBounds, positionKey } from '../build-types.js';
import { compareBlockOrder, inferCategory } from './block-order.js';
import { DependencyResolver } from './dependency-resolver.js';
import { normalizePlacement } from './normalize-placements.js';

export class BuildPlanner {
  constructor(private readonly resolver = new DependencyResolver()) {}

  plan(blueprint: InternalBlueprint, origin: BlockPosition): BuildPlan {
    const minimumY = origin.y + blueprint.blocks.reduce((min,block)=>Math.min(min,block.y),0);
    const relativeIndex = new Map(blueprint.blocks.map((block, index) => [positionKey(block), index]));
    const initial: PlannedBlock[] = blueprint.blocks.map((block, index) => ({
      index,
      ...normalizePlacement({position:{ x: origin.x + block.x, y: origin.y + block.y, z: origin.z + block.z },block:block.block,state:block.state}),
      category: block.category,
      section: block.section ?? block.category ?? 'structure',
      dependencies: (block.dependsOn ?? []).flatMap((dependency) => {
        const dependencyIndex = relativeIndex.get(positionKey(dependency));
        return dependencyIndex === undefined ? [] : [dependencyIndex];
      })
    }));
    initial.sort((a, b) => compareBlockOrder(a, b, minimumY));
    const blocks = this.resolver.resolve(initial.map((block) => ({ ...block, category: inferCategory(block, minimumY) })));
    const materials: Record<string, number> = {};
    for (const block of blocks) materials[block.block] = (materials[block.block] ?? 0) + 1;
    const positions = blocks.map((block) => block.position);
    const from = positions.reduce((acc, p) => ({ x: Math.min(acc.x, p.x), y: Math.min(acc.y, p.y), z: Math.min(acc.z, p.z) }), positions[0] ?? origin);
    const to = positions.reduce((acc, p) => ({ x: Math.max(acc.x, p.x), y: Math.max(acc.y, p.y), z: Math.max(acc.z, p.z) }), positions[0] ?? origin);
    const sections = [] as BuildPlan['sections'];
    let current = '';
    for (const [index, block] of blocks.entries()) {
      const name = block.section ?? 'structure';
      if (name !== current) {
        sections.push({ name, startIndex: index, endIndex: index, blocks: 1 });
        current = name;
      } else {
        const section = sections[sections.length - 1]; section.endIndex = index; section.blocks += 1;
      }
    }
    return { name: blueprint.name, origin, blocks, sections, boundingBox: normalizeBounds(from, to), materials };
  }
}
