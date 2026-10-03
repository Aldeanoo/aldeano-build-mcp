import { BlueprintSchema } from './blueprint-schema.js';
import type { InternalBlueprint } from './blueprint.js';

export class BlueprintParser {
  parse(input: string | unknown): InternalBlueprint {
    let value = input;
    if (typeof input === 'string') {
      try {
        value = JSON.parse(input) as unknown;
      } catch (error) {
        throw new Error(`Invalid blueprint JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return BlueprintSchema.parse(value) as InternalBlueprint;
  }
}
