export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}

export type PositionTuple = [number, number, number];
export type BuildMode = 'physical' | 'fast' | 'cinematic';
export type BuildStatus = 'queued' | 'building' | 'paused' | 'verifying' | 'repairing' | 'completed' | 'unverified' | 'partial' | 'cancelled' | 'failed';
export type BuildCategory = 'foundation' | 'structural' | 'wall' | 'floor' | 'roof' | 'decoration';

export interface BlockPlacement {
  position: BlockPosition;
  block: string;
  state?: Record<string, string | number | boolean>;
  category?: BuildCategory;
  section?: string;
}

export interface PlannedBlock extends BlockPlacement {
  index: number;
  dependencies: number[];
}

export interface BuildPlanSection {
  name: string;
  startIndex: number;
  endIndex: number;
  blocks: number;
}

export interface BuildPlan {
  name: string;
  origin: BlockPosition;
  blocks: PlannedBlock[];
  sections: BuildPlanSection[];
  boundingBox: RegionBounds;
  materials: Record<string, number>;
  requiredAir?:BlockPosition[];
}

export interface RegionBounds {
  from: BlockPosition;
  to: BlockPosition;
}

export interface BuildLimits {
  maxBlocks: number;
  maxScanBlocks: number;
  maxDimension: number;
  maxQueue: number;
}

export interface PlacementQueueConfig {
  concurrency: number;
  batchSize: number;
  retryCount: number;
  timeoutMs: number;
}

export interface BuildConfiguration extends PlacementQueueConfig, BuildLimits {
  mode: BuildMode;
  verify: boolean;
  autoRepair: boolean;
  maxRepairPasses: number;
  cinematicDelayMs: number;
  fastCommandIntervalMs: number;
  maxPreflightBlocks: number;
  preflightNavigationTimeoutMs: number;
  fastModeEnabled: boolean;
  teleportEnabled: boolean;
  verificationSectorSize: number;
  checkpointDirectory: string | false;
}

export interface BuildExecutionOptions {
  verifyAfterBuild?: boolean;
  autoRepair?: boolean;
  preflight?: boolean;
  expectedBlocks?: number;
  design?: DesignRequirements;
}

export interface PlacementFailure {
  placement: BlockPlacement;
  error: string;
  attempts: number;
}

export interface ExecutionResult {
  requestedBlocks: number;
  placedBlocks: number;
  failedBlocks: number;
  failures: PlacementFailure[];
  retries: number;
  durationMs: number;
}

export interface BuildProgress {
  id: string;
  name: string;
  status: BuildStatus;
  progress: number;
  total: number;
  completed: number;
  failed: number;
  retries: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  submitted?: number;
  verified?: number;
  pending?: number;
  verificationComplete?: boolean;
  phase?: 'placement' | 'verification' | 'repair';
}

export interface DesignRequirements {
  roofBounds?: RegionBounds;
  roofBaseY?: number;
  requiredSupports?: BlockPosition[];
  requiredAir?: BlockPosition[];
  requireConnected?: boolean;
}

export class BuildValidationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'BuildValidationError'; }
}

export interface BuildMetrics {
  toolCalls: number;
  durationMs: number;
  blocksPlaced: number;
  blocksFailed: number;
  retries: number;
  verificationErrors: number;
}

export interface BuildRecord extends BuildProgress {
  origin: BlockPosition;
  mode: BuildMode;
  accuracy?: number;
  metrics: BuildMetrics;
}

export class BuildLimitError extends Error {
  readonly code = 'LIMIT_EXCEEDED';

  constructor(message: string) {
    super(message);
    this.name = 'BuildLimitError';
  }
}

export function tupleToPosition([x, y, z]: PositionTuple): BlockPosition {
  return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
}

export function positionKey(position: BlockPosition): string {
  return `${position.x},${position.y},${position.z}`;
}

export function normalizeBounds(a: BlockPosition, b: BlockPosition): RegionBounds {
  return {
    from: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) },
    to: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) }
  };
}

export function regionVolume(bounds: RegionBounds): number {
  return (bounds.to.x - bounds.from.x + 1)
    * (bounds.to.y - bounds.from.y + 1)
    * (bounds.to.z - bounds.from.z + 1);
}
