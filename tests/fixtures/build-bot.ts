import { EventEmitter } from 'node:events';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { normalizePlacement } from '../../src/build/planner/normalize-placements.js';
import { positionKey } from '../../src/build/build-types.js';

export function buildBot(){
  const emitter=new EventEmitter(),sent:string[]=[],world=new Map<string,{name:string;state:Record<string,string|number|boolean>}>();
  const unreadable=new Set<string>();
  let dropped=0,dropAll=false;
  const entity={position:new Vec3(0,64,0)};
  const read=(p:Vec3)=>{const key=positionKey({x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)});if(unreadable.has(key))return null;const value=world.get(key)??{name:'air',state:{}};return {...value,getProperties:()=>value.state};};
  const write=(x:number,y:number,z:number,block:string)=>{const p=normalizePlacement({position:{x,y,z},block});world.set(positionKey(p.position),{name:p.block,state:p.state??{}});};
  const bot=Object.assign(emitter,{
    entity,username:'UnitBuilder',game:{gameMode:'creative',minY:-64,height:384,dimension:'overworld'},
    _client:{socket:{remoteAddress:'127.0.0.1',remotePort:25565}},
    blockAt:read,
    chat:(command:string)=>{
      sent.push(command);
      if(command.startsWith('/execute positioned ')){
        const values=command.split(' '),target=new Vec3(...values.slice(2,5).map(Number) as [number,number,number]);
        if([0,1].every(dy=>{const b=read(target.offset(0,dy,0));return b&&['air','cave_air','void_air'].includes(b.name);})){entity.position=target;emitter.emit('forcedMove');}
      }else if(command.startsWith('/setblock ')){
        if(dropAll||dropped>0){dropped=Math.max(0,dropped-1);}else{const parts=command.split(' ');write(Number(parts[1]),Number(parts[2]),Number(parts[3]),parts[4]);}
      }else if(command.startsWith('/fill ')){
        const parts=command.split(' '),[x,y,z,X,Y,Z]=parts.slice(1,7).map(Number);
        if(!dropAll)for(let xx=x;xx<=X;xx++)for(let yy=y;yy<=Y;yy++)for(let zz=z;zz<=Z;zz++)write(xx,yy,zz,parts[7]);
      }
      setImmediate(()=>emitter.emit('physicsTick'));
    },
    creative:{startFlying:()=>{},flyTo:async(p:Vec3)=>{entity.position=p;},stopFlying:()=>{}},
    pathfinder:{stop:()=>{},goto:async(goal:{x:number;y:number;z:number})=>{entity.position=new Vec3(goal.x,goal.y,goal.z);}},
    clearControlStates:()=>{},
    waitForTicks:async()=>{},waitForChunksToLoad:async()=>{}
  }) as unknown as mineflayer.Bot;
  return {bot,sent,world,unreadable,write,setDropped:(n:number)=>{dropped=n;},setDropAll:(value:boolean)=>{dropAll=value;}};
}
