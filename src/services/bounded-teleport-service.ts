import { Vec3 } from 'vec3';
import type { BotOrGetter, Position } from './types.js';
import { resolveBot } from './service-utils.js';
import { MovementError } from '../errors/index.js';

const air = ['air', 'cave_air', 'void_air'];

export class TeleportError extends MovementError {
  constructor(message:string) { super(message); this.name = 'TeleportError'; }
}

/** Typed creative self-teleport. Server block predicates guard even remote destinations. */
export class BoundedTeleportService {
  constructor(private readonly botOrGetter: BotOrGetter, private readonly timeoutMs = 30_000) {}

  async selfToPlayer(name: string, signal?: AbortSignal): Promise<void> {
    const bot = resolveBot(this.botOrGetter);
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(name)) throw new TeleportError('Invalid player name');
    const key = Object.keys(bot.players).find(player => player.toLowerCase() === name.toLowerCase());
    const entity = key ? bot.players[key]?.entity : undefined;
    if (!entity) {
      if (!key) throw new TeleportError('Player is not online');
      if (bot.game.gameMode !== 'creative') throw new TeleportError('Teleport positioning requires creative mode');
      signal?.throwIfAborted();
      bot.pathfinder?.stop();bot.clearControlStates?.();bot.creative?.startFlying?.();
      await new Promise<void>((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);bot.removeListener('forcedMove',arrived);bot.removeListener('end',ended);signal?.removeEventListener('abort',aborted);};
        const arrived=()=>{cleanup();resolve();};
        const ended=()=>{cleanup();reject(new TeleportError('Disconnected during player teleport'));};
        const aborted=()=>{cleanup();reject(signal?.reason ?? new TeleportError('Teleport cancelled'));};
        const timer=setTimeout(()=>{cleanup();reject(new TeleportError('Player teleport not confirmed; destination blocked or command permission denied'));},this.timeoutMs);
        bot.once('forcedMove',arrived);bot.once('end',ended);signal?.addEventListener('abort',aborted,{once:true});
        // The server resolves the player's position; predicates prevent landing in solid blocks.
        for(const feet of air)for(const head of air)bot.chat(`/execute at ${key} positioned ~ ~2 ~ if block ~ ~ ~ minecraft:${feet} if block ~ ~1 ~ minecraft:${head} run tp @s ~ ~ ~`);
      });
      await bot.waitForChunksToLoad();await bot.waitForTicks(2);
      await new Promise<void>((resolve,reject)=>{
        const started=Date.now();
        const poll=setInterval(()=>{
          const target=bot.players[key]?.entity;
          if(target && bot.entity.position.distanceTo(target.position)<=5){clearInterval(poll);resolve();}
          else if(Date.now()-started>8000){clearInterval(poll);reject(new TeleportError('Arrival near player could not be confirmed'));}
        },50);
      });
      for(const dy of [0,1]){const block=bot.blockAt(bot.entity.position.offset(0,dy,0));if(!block || !air.includes(block.name))throw new TeleportError('Player teleport destination is not clear');}
      bot.creative?.startFlying?.();
      return;
    }
    const position = entity.position.floored().offset(0, 2, 0);
    await this.selfTo({ x: position.x, y: position.y, z: position.z }, signal);
  }

  async selfTo(position: Position, signal?: AbortSignal): Promise<void> {
    const bot = resolveBot(this.botOrGetter);
    if (bot.game.gameMode !== 'creative') throw new TeleportError('Teleport positioning requires creative mode');
    if (![position.x,position.y,position.z].every(Number.isSafeInteger)) throw new TeleportError('Teleport coordinates must be safe integers');
    const dimension = bot.game as typeof bot.game & { minY:number; height:number };
    if (!Number.isFinite(dimension.minY) || !Number.isFinite(dimension.height)) throw new TeleportError('World height data unavailable');
    if (Math.abs(position.x)>29_999_900 || Math.abs(position.z)>29_999_900 || position.y<dimension.minY || position.y+2>=dimension.minY+dimension.height) throw new TeleportError('Teleport destination outside world bounds');
    signal?.throwIfAborted();
    const target = new Vec3(position.x+0.5,position.y,position.z+0.5);
    const blocks = [0,1].map(dy=>bot.blockAt(target.offset(0,dy,0)));
    if (blocks.some(b=>b && !air.includes(b.name))) throw new TeleportError('Teleport destination is occupied or unavailable');
    bot.pathfinder?.stop();
    bot.clearControlStates?.();
    bot.creative?.startFlying?.();
    const feet = blocks[0] ? [blocks[0].name] : air, head = blocks[1] ? [blocks[1].name] : air;
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);bot.removeListener?.('forcedMove',arrival);bot.removeListener?.('end',ended);signal?.removeEventListener('abort',aborted);};
      const arrival=()=>{if(bot.entity.position.distanceTo(target)<0.75){bot.creative?.startFlying?.();cleanup();resolve();}};
      const ended=()=>{cleanup();reject(new TeleportError('Disconnected during teleport'));};
      const aborted=()=>{cleanup();reject(signal?.reason ?? new TeleportError('Teleport cancelled'));};
      const timer=setTimeout(()=>{cleanup();reject(new TeleportError('Teleport arrival could not be confirmed; destination may be unloaded or command permission denied'));},this.timeoutMs);
      bot.on?.('forcedMove',arrival);bot.once?.('end',ended);signal?.addEventListener('abort',aborted,{once:true});
      try {
        for(const a of feet) for(const b of head) bot.chat(`/execute positioned ${target.x} ${target.y} ${target.z} if block ~ ~ ~ minecraft:${a} if block ~ ~1 ~ minecraft:${b} run tp @s ${target.x} ${target.y} ${target.z}`);
        arrival();
      } catch(error) {cleanup();reject(error);}
    });
    let timer:ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([bot.waitForChunksToLoad(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new TeleportError('Destination chunks could not be loaded')),this.timeoutMs);})]);
    } finally {clearTimeout(timer);}
    signal?.throwIfAborted();
    if(bot.entity.position.distanceTo(target)>1.5) throw new TeleportError('Teleport arrival changed before clearance inspection');
    for(const dy of [0,1]) {const b=bot.blockAt(target.offset(0,dy,0));if(!b || !air.includes(b.name))throw new TeleportError('Teleport destination is occupied or unavailable');}
    bot.creative?.startFlying?.();
  }
}
