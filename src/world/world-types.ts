import type { BlockPosition, RegionBounds } from '../build/build-types.js';

export type WorldDetailLevel = 'summary' | 'compact' | 'full';

export interface WorldBlock {
  position: BlockPosition;
  name: string;
  state?: Record<string, unknown>;
}

export interface WorldReadCoverage {
  version: 1;
  requestedBlocks: number;
  readBlocks: number;
  unavailableBlocks: number;
  complete: boolean;
}

export interface HeightmapResult {
  bounds: RegionBounds;
  min: number | null;
  max: number | null;
  coverage: WorldReadCoverage;
  columns: Array<{ x: number; z: number; y: number | null; block?: string; readBlocks: number; unavailableBlocks: number; status: 'complete' | 'partial' | 'unavailable'; heightKnown: boolean }>;
}

export interface RegionScanResult {
  bounds: RegionBounds;
  detail: WorldDetailLevel;
  scannedBlocks: number;
  coverage: WorldReadCoverage;
  palette: Record<string, number>;
  height: { min: number | null; max: number | null; complete: boolean };
  entities: WorldEntity[];
  interestingBlocks: WorldBlock[];
  blocks?: WorldBlock[];
  compact?: Array<{ name: string; count: number; sample: BlockPosition[] }>;
}

export interface WorldEntity {
  id: number;
  name: string;
  type: string;
  position: BlockPosition;
  distance: number;
  source: 'minecraft_world';
  trusted: false;
}

export interface EnvironmentResult {
  time: number;
  isDay: boolean;
  dimension: string;
  biome?: string;
  weather: 'clear' | 'rain' | 'thunder';
  gameMode: string;
  difficulty?: string;
  position: BlockPosition;
  source: 'minecraft_world';
  trusted: false;
}
