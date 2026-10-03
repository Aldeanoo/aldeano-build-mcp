import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../services/types.js';
import { resolveBot } from '../services/service-utils.js';
import { MovementService } from '../services/movement-service.js';
import { BoundedTeleportService } from '../services/bounded-teleport-service.js';
import type { BuildMode, RegionBounds } from '../build/build-types.js';
import { BuildValidationError } from '../build/build-types.js';

/** Position outside the work geometry; verification never stands inside a new wall. */
export class RegionPositioner {
  constructor(private readonly botOrGetter:BotOrGetter, private readonly teleportEnabled:boolean, private readonly timeoutMs=30_000) {}

  async visit(bounds:RegionBounds,mode:BuildMode,signal?:AbortSignal):Promise<void> {
    signal?.throwIfAborted();
    const bot=resolveBot(this.botOrGetter), movement=new MovementService(this.botOrGetter);
    const x=Math.floor((bounds.from.x+bounds.to.x)/2), z=Math.floor((bounds.from.z+bounds.to.z)/2);
    const candidates=[{x,y:bounds.to.y+3,z},{x:bounds.from.x-3,y:bounds.from.y+1,z},{x:bounds.to.x+3,y:bounds.from.y+1,z}];
    if(mode==='physical')candidates.push(candidates.shift()!);
    const game=bot.game as typeof bot.game & {minY?:number;height?:number};
    const safe=candidates.find(p=>{
      if(game.minY!==undefined && game.height!==undefined && (p.y<game.minY || p.y+2>=game.minY+game.height))return false;
      const blocks=[0,1].map(dy=>bot.blockAt(new Vec3(p.x,p.y+dy,p.z)));
      return blocks.every(b=>!b || ['air','cave_air','void_air'].includes(b.name));
    });
    if(!safe)throw new BuildValidationError('SITE_UNAVAILABLE','No clear staging destination near region');
    if(mode!=='physical' && this.teleportEnabled && bot.game?.gameMode==='creative')await new BoundedTeleportService(this.botOrGetter,this.timeoutMs).selfTo(safe,signal);
    else if(mode!=='physical' && bot.game?.gameMode==='creative')await movement.flyTo(safe.x,safe.y,safe.z);
    else await movement.moveToPosition(safe.x,safe.y,safe.z,this.timeoutMs,2);
    signal?.throwIfAborted();
    if(bot.entity.position.distanceTo(new Vec3(safe.x,safe.y,safe.z))>3)throw new BuildValidationError('SITE_UNAVAILABLE','Region arrival could not be confirmed');
    await bot.waitForChunksToLoad();
    await bot.waitForTicks(2);
  }
}
