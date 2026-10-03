import type { BlockPosition } from '../build/build-types.js';

export class StuckDetector {
  private last?: BlockPosition;
  private unchanged = 0;
  update(position: BlockPosition): boolean {
    if (this.last && this.last.x === position.x && this.last.y === position.y && this.last.z === position.z) this.unchanged += 1;
    else this.unchanged = 0;
    this.last = { ...position };
    return this.unchanged >= 2;
  }
  reset(): void { this.last = undefined; this.unchanged = 0; }
}
