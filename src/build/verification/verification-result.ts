import type { BlockPlacement } from '../build-types.js';

export type VerificationErrorType = 'MISSING_BLOCK' | 'WRONG_BLOCK' | 'WRONG_STATE' | 'EXTRA_BLOCK' | 'UNREACHABLE' | 'PLACEMENT_FAILED';

export interface VerificationDifference {
  type: VerificationErrorType;
  expected?: BlockPlacement;
  actual?: string;
  position: BlockPlacement['position'];
  details?: string;
}

export interface VerificationResult {
  expected: number;
  correct: number;
  missing: number;
  incorrect: number;
  extra: number;
  unreachable: number;
  accuracy: number;
  differences: VerificationDifference[];
  checkedSectors?:string[];
}
