import type { BuildConfiguration, BuildMode } from './build-types.js';
import { fileURLToPath } from 'node:url';

function envNumber(name: string, fallback: number, min = 0): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function envMode(): BuildMode {
  const value = process.env.BUILD_MODE?.trim().toLowerCase();
  return value === 'fast' || value === 'cinematic' ? value : 'physical';
}

export function loadBuildConfiguration(overrides: Partial<BuildConfiguration> = {}): BuildConfiguration {
  return {
    mode: envMode(),
    verify: envBoolean('BUILD_VERIFY', true),
    autoRepair: envBoolean('BUILD_AUTO_REPAIR', true),
    maxBlocks: envNumber('BUILD_MAX_BLOCKS', 10_000, 1),
    batchSize: envNumber('BUILD_BATCH_SIZE', 100, 1),
    concurrency: envNumber('BUILD_CONCURRENCY', 4, 1),
    retryCount: envNumber('BUILD_RETRY_COUNT', 2),
    timeoutMs: envNumber('BUILD_TIMEOUT_MS', 30_000, 1),
    maxRepairPasses: envNumber('BUILD_MAX_REPAIR_PASSES', 3),
    maxScanBlocks: envNumber('WORLD_MAX_SCAN_BLOCKS', 65_536, 1),
    maxDimension: envNumber('BUILD_MAX_DIMENSION', 256, 1),
    maxQueue: envNumber('BUILD_MAX_QUEUE', 20_000, 1),
    cinematicDelayMs: envNumber('BUILD_CINEMATIC_DELAY_MS', 100),
    fastCommandIntervalMs: envNumber('BUILD_FAST_COMMAND_INTERVAL_MS', 20),
    maxPreflightBlocks: envNumber('BUILD_PREFLIGHT_MAX_BLOCKS', 1_000_000, 1),
    preflightNavigationTimeoutMs: envNumber('BUILD_PREFLIGHT_NAVIGATION_TIMEOUT_MS', 45_000, 1_000),
    fastModeEnabled: envBoolean('BUILD_FAST_MODE_ENABLED', false),
    teleportEnabled: envBoolean('BUILD_TELEPORT_ENABLED', true),
    verificationSectorSize: envNumber('BUILD_VERIFICATION_SECTOR_SIZE', 32, 1),
    checkpointDirectory: process.env.BUILD_CHECKPOINT_DIRECTORY ?? fileURLToPath(new URL('../../artifacts/builds/', import.meta.url)),
    ...overrides
  };
}
