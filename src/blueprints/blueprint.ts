import type { BuildCategory, BlockPosition } from '../build/build-types.js';

export interface BlueprintSize {
  x: number;
  y: number;
  z: number;
}

export interface BlueprintBlock {
  x: number;
  y: number;
  z: number;
  block: string;
  state?: Record<string, string | number | boolean>;
  category?: BuildCategory;
  section?: string;
  dependsOn?: BlockPosition[];
}

export interface InternalBlueprint {
  version: 1;
  name: string;
  size: BlueprintSize;
  palette?: Record<string, string>;
  blocks: BlueprintBlock[];
  metadata?: Record<string, unknown>;
}
