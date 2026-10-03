import type { BuildProgress, ExecutionResult } from './build-types.js';
import type { VerificationResult } from './verification/verification-result.js';
import type { BuildPreflightResult } from './verification/build-preflight.js';

export interface StructuredBuildResult {
  resultVersion: 2;
  success: boolean;
  buildId: string;
  status: BuildProgress['status'];
  requestedBlocks: number;
  placedBlocks: number;
  failedBlocks: number;
  durationMs: number;
  initialVerification?: VerificationResult;
  verification?: VerificationResult;
  repair?: { passes: number; repaired: number; status: 'COMPLETED' | 'PARTIAL' };
  preflight?: BuildPreflightResult;
  error?: { code: string; message: string };
  submittedBlocks?:number;
  verifiedBlocks?:number;
  pendingBlocks?:number;
  verificationStatus?:'verified'|'unverified'|'partial';
}

export function createBuildResult(
  progress: BuildProgress,
  execution: ExecutionResult,
  verification?: VerificationResult,
  initialVerification?: VerificationResult,
  repair?: StructuredBuildResult['repair'],
  preflight?: BuildPreflightResult
): StructuredBuildResult {
  return {
    resultVersion: 2,
    success: progress.status === 'completed',
    buildId: progress.id,
    status: progress.status,
    requestedBlocks: execution.requestedBlocks,
    placedBlocks: verification?.correct ?? 0,
    failedBlocks: verification ? verification.differences.length : execution.failedBlocks,
    submittedBlocks: execution.placedBlocks,
    verifiedBlocks: verification?.correct ?? 0,
    pendingBlocks: verification ? verification.differences.length : execution.requestedBlocks,
    verificationStatus: verification ? progress.status==='completed'?'verified':'partial' : 'unverified',
    durationMs: execution.durationMs,
    initialVerification,
    verification,
    repair,
    preflight
  };
}
