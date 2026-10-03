import minecraftData from 'minecraft-data';
import type { BuildLimits } from '../build/build-types.js';
import { positionKey } from '../build/build-types.js';
import type { InternalBlueprint } from './blueprint.js';

export interface BlueprintValidationResult {
  valid: boolean;
  blocks: number;
  warnings: string[];
  errors: string[];
}

export class BlueprintValidator {
  private readonly knownBlocks?: Set<string>;

  constructor(private limits: BuildLimits, minecraftVersion?: string) {
    if (minecraftVersion) {
      try { this.knownBlocks = new Set(Object.keys(minecraftData(minecraftVersion).blocksByName)); } catch { /* schema checks still apply */ }
    }
  }

  validate(blueprint: InternalBlueprint): BlueprintValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { size, blocks } = blueprint;
    if (Math.max(size.x, size.y, size.z) > this.limits.maxDimension) {
      errors.push(`Blueprint dimension exceeds configured maximum of ${this.limits.maxDimension}`);
    }
    if (blocks.length > this.limits.maxBlocks || blocks.length > this.limits.maxQueue) {
      errors.push(`Blueprint contains ${blocks.length} blocks; configured maximum is ${Math.min(this.limits.maxBlocks, this.limits.maxQueue)}`);
    }

    const seen = new Set<string>();
    const coordinates = new Set(blocks.map((block) => positionKey(block)));
    for (const [key, value] of Object.entries(blueprint.palette ?? {})) {
      const name = value.replace(/^minecraft:/, '').split('[')[0];
      if (this.knownBlocks && !this.knownBlocks.has(name)) errors.push(`Palette entry '${key}' references unknown Minecraft block '${value}'`);
    }
    for (const [index, block] of blocks.entries()) {
      const key = positionKey(block);
      if (seen.has(key)) errors.push(`Duplicate block coordinate at ${key}`);
      seen.add(key);
      if (block.x < 0 || block.y < 0 || block.z < 0 || block.x >= size.x || block.y >= size.y || block.z >= size.z) {
        errors.push(`Block ${index} at ${key} is outside blueprint dimensions`);
      }
      if (this.knownBlocks && !this.knownBlocks.has(block.block.replace(/^minecraft:/, '').split('[')[0])) {
        errors.push(`Unknown Minecraft block '${block.block}' at ${key}`);
      }
      for (const dependency of block.dependsOn ?? []) {
        if (!coordinates.has(positionKey(dependency))) warnings.push(`Block at ${key} has external dependency at ${positionKey(dependency)}`);
      }
    }

    return { valid: errors.length === 0, blocks: blocks.length, warnings, errors };
  }
}
