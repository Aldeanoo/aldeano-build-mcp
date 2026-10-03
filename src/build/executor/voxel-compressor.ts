import type { FastCommandOperation } from './fast-command-batch.js';
import type { BlockPosition } from '../build-types.js';

/** Lossless compression of a final voxel map into disjoint bounded fills. */
export function compressVoxels(voxels:Map<string,string>,origin:BlockPosition):FastCommandOperation[]{
  type Fill=Extract<FastCommandOperation,{type:'fill'}>;
  const rows=new Map<string,Array<{x:number;block:string}>>();
  for(const [key,block]of voxels){const [x,y,z]=key.split(',').map(Number);const rowKey=`${y},${z}`;const row=rows.get(rowKey)??[];row.push({x,block});rows.set(rowKey,row);}
  const columns=new Map<string,Fill[]>();
  for(const [key,row]of rows){const [y,z]=key.split(',').map(Number);row.sort((a,b)=>a.x-b.x);
    for(let i=0;i<row.length;){let end=i;while(end+1<row.length&&row[end+1].x===row[end].x+1&&row[end+1].block===row[i].block)end++;
      const op:Fill={type:'fill',from:{x:origin.x+row[i].x,y:origin.y+y,z:origin.z+z},to:{x:origin.x+row[end].x,y:origin.y+y,z:origin.z+z},block:row[i].block};
      const groupKey=`${op.from.x},${op.to.x},${op.from.z},${op.block}`;const group=columns.get(groupKey)??[];group.push(op);columns.set(groupKey,group);i=end+1;
    }
  }
  const depths=new Map<string,Fill[]>();
  for(const group of columns.values()){group.sort((a,b)=>a.from.y-b.from.y);let op=group[0];
    const save=()=>{const k=`${op.from.x},${op.to.x},${op.from.y},${op.to.y},${op.block}`;const items=depths.get(k)??[];items.push(op);depths.set(k,items);};
    for(let i=1;i<group.length;i++){const next=group[i];const volume=(op.to.x-op.from.x+1)*(next.to.y-op.from.y+1);if(next.from.y===op.to.y+1&&volume<=32768)op={...op,to:{...op.to,y:next.to.y}};else{save();op=next;}}save();
  }
  const result:Fill[]=[];
  for(const group of depths.values()){group.sort((a,b)=>a.from.z-b.from.z);let op=group[0];for(let i=1;i<group.length;i++){const next=group[i];const volume=(op.to.x-op.from.x+1)*(op.to.y-op.from.y+1)*(next.to.z-op.from.z+1);if(next.from.z===op.to.z+1&&volume<=32768)op={...op,to:{...op.to,z:next.to.z}};else{result.push(op);op=next;}}result.push(op);}
  return result.sort((a,b)=>a.from.y-b.from.y);
}
