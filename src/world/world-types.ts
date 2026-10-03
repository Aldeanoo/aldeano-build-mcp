import type { BlockPosition, RegionBounds } from '../build/build-types.js';

export type WorldDetailLevel = 'summary' | 'compact' | 'full';

export interface WorldBlock {
  position: BlockPosition;
  name: string;
  state?: Record<string, unknown>;
}

export interface HeightmapResult {
  bounds: RegionBounds;
  min: number | null;
  max: number | null;
  columns: Array<{ x: number; z: number; y: number | null; block?: string }>;
}

export interface RegionScanResult {
  bounds: RegionBounds;
  detail: WorldDetailLevel;
  scannedBlocks: number;
  palette: Record<string, number>;
  height: { min: number | null; max: number | null };
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
