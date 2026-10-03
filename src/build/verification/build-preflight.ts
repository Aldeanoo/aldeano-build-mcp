import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../../services/types.js';
import { resolveBot } from '../../services/service-utils.js';
import { MovementService } from '../../services/movement-service.js';
import type { BlockPosition, BuildMode, BuildPlan, RegionBounds } from '../build-types.js';
import { regionVolume } from '../build-types.js';
import { RegionPositioner } from '../../world/region-positioner.js';

const AIR = new Set(['air', 'cave_air', 'void_air']);

export interface BuildPreflightResult {
  clear: true;
  scannedBlocks: number;
  bounds: BuildPlan['boundingBox'];
  inspectionPosition: BlockPosition;
}

export class BuildPreflightError extends Error {
  constructor(public readonly code: 'SITE_OCCUPIED' | 'SITE_UNAVAILABLE' | 'PREFLIGHT_LIMIT_EXCEEDED', message: string) {
    super(message); this.name = 'BuildPreflightError';
  }
}

export class BuildPreflight {
  private readonly movement: MovementService;
  constructor(private readonly botOrGetter: BotOrGetter, private readonly maxBlocks: number, private readonly navigationTimeoutMs: number, private readonly positionAt?: (position: BlockPosition) => Promise<void>, private readonly teleportEnabled=false) {
    this.movement = new MovementService(botOrGetter);
  }
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }

  async inspect(plan: BuildPlan, mode: BuildMode): Promise<BuildPreflightResult> {
    return this.inspectBounds(plan.boundingBox, mode);
  }

  async inspectBounds(bounds: RegionBounds, mode: BuildMode): Promise<BuildPreflightResult> {
    const volume = regionVolume(bounds);
    if (volume > this.maxBlocks) throw new BuildPreflightError('PREFLIGHT_LIMIT_EXCEEDED', `Construction site contains ${volume} positions; preflight maximum is ${this.maxBlocks}`);
    const center = {
      x: Math.floor((bounds.from.x + bounds.to.x) / 2),
      y: bounds.from.y + 2,
      z: Math.floor((bounds.from.z + bounds.to.z) / 2)
    };
    let unavailable = 0;
    let occupiedCount = 0;
    const occupied: Array<{ position: BlockPosition; block: string }> = [];
    const positioner=new RegionPositioner(this.botOrGetter,this.teleportEnabled,this.navigationTimeoutMs);
    for(let sx=bounds.from.x;sx<=bounds.to.x;sx+=32)for(let sz=bounds.from.z;sz<=bounds.to.z;sz+=32){
      const section={from:{x:sx,y:bounds.from.y,z:sz},to:{x:Math.min(sx+31,bounds.to.x),y:bounds.to.y,z:Math.min(sz+31,bounds.to.z)}};
      if(mode!=='physical' && this.positionAt){await this.positionAt({x:Math.floor((section.from.x+section.to.x)/2),y:center.y,z:Math.floor((section.from.z+section.to.z)/2)});await this.bot.waitForChunksToLoad();await this.bot.waitForTicks(2);}
      else await positioner.visit(section,mode);
    for (let x = section.from.x; x <= section.to.x; x += 1) for (let y = bounds.from.y; y <= bounds.to.y; y += 1) for (let z = section.from.z; z <= section.to.z; z += 1) {
      const block = this.bot.blockAt(new Vec3(x, y, z));
      if (!block) { unavailable += 1; continue; }
      if (!AIR.has(block.name)) {
        occupiedCount += 1;
        if (occupied.length < 16) occupied.push({ position: { x, y, z }, block: block.name });
      }
    }
    }
    if (unavailable > 0) throw new BuildPreflightError('SITE_UNAVAILABLE', `${unavailable} positions could not be read after visiting the construction site`);
    if (occupiedCount > 0) throw new BuildPreflightError('SITE_OCCUPIED', `Construction site contains ${occupiedCount} occupied positions. First obstructions: ${occupied.map((item) => `${item.block}@${item.position.x},${item.position.y},${item.position.z}`).join('; ')}`);

    const staging = { x: bounds.from.x - 3, y: bounds.from.y + 1, z: center.z };
    if (mode !== 'physical' && this.positionAt) await this.positionAt(staging);
    else await positioner.visit(bounds,mode);
    return { clear: true, scannedBlocks: volume, bounds, inspectionPosition: center };
  }
}
