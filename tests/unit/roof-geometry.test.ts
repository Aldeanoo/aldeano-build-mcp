import test from 'ava';
import type { BlockPlacement } from '../../src/build/build-types.js';
import { positionKey } from '../../src/build/build-types.js';
import { blockShapes, blocksTouch, isFullCube } from '../../src/build/verification/block-geometry.js';
import { prepareArchitecture } from '../../src/build/planner/architectural-plan.js';
import { validateDesign } from '../../src/build/verification/design-validator.js';
import { buildRoofDetailed } from '../../src/build/primitives/roof.js';
import { BuildService } from '../../src/build/build-service.js';
import { PhysicalBuildStrategy, blockArgument } from '../../src/build/executor/execution-strategy.js';
import type { BlockService } from '../../src/services/block-service.js';
import { buildBot } from '../fixtures/build-bot.js';

const cell = (y: number, block: string, state?: BlockPlacement['state']): BlockPlacement => ({ position: { x: 0, y, z: 0 }, block, state });

test('collision geometry distinguishes lower, upper and double slabs and rejects invalid states', t => {
  t.deepEqual(blockShapes(cell(0,'oak_slab',{type:'bottom'})), [[0,0,0,1,0.5,1]]);
  t.deepEqual(blockShapes(cell(0,'oak_slab',{type:'top'})), [[0,0.5,0,1,1,1]]);
  t.true(isFullCube(cell(0,'oak_slab',{type:'double'})));
  t.false(isFullCube(cell(0,'oak_stairs',{half:'top',facing:'east'})));
  t.throws(() => blockShapes(cell(0,'oak_slab',{type:'sideways'})));
});

test('adjacent cells with a half-block void are disconnected even though both cells exist', t => {
  const above = cell(1,'stone');
  t.false(blocksTouch(cell(0,'oak_slab',{type:'bottom'}),above));
  t.true(blocksTouch(cell(0,'oak_slab',{type:'top'}),above));
  t.throws(() => validateDesign([cell(0,'oak_slab',{type:'bottom'}),above],{requireConnected:true}),{code:'DESIGN_DISCONNECTED'});
});

test('structural slabs automatically choose upper, lower or double from real neighboring surfaces', t => {
  const upper = prepareArchitecture([cell(0,'oak_slab'),cell(1,'stone')]);
  t.is(upper.placements[0].state?.type,'top');
  const lower = prepareArchitecture([cell(0,'stone'),cell(1,'oak_slab',{type:'top'})]);
  t.is(lower.placements[1].state?.type,'bottom');
  const both = prepareArchitecture([cell(0,'stone'),cell(1,'oak_slab'),cell(2,'stone')]);
  t.is(both.placements[1].state?.type,'double');
  t.is(both.placements[1].state?.waterlogged,false);
  validateDesign(both.placements,{requireConnected:true});
  t.true(upper.adjustments.length > 0);
  t.is(blockArgument(both.placements[1]),'minecraft:oak_slab[type=double,waterlogged=false]');
});

test('stacked slabs resolve simultaneously, independently of iteration order, and preparation is idempotent', t => {
  const source = [cell(0,'oak_slab'),cell(1,'oak_slab'),cell(2,'oak_slab')];
  const prepared = prepareArchitecture(source);
  t.deepEqual(prepared.placements.map(p=>p.state?.type),['top','double','bottom']);
  const reversed = prepareArchitecture([...source].reverse());
  t.deepEqual([...reversed.placements].reverse(),prepared.placements);
  t.deepEqual(prepareArchitecture(prepared.placements).placements,prepared.placements);
  validateDesign(prepared.placements,{requireConnected:true});
});

test('explicit decorative slabs retain their half and input plans are not mutated', t => {
  const slab = {...cell(0,'oak_slab',{type:'bottom'}),category:'decoration' as const};
  const source = [slab,cell(1,'stone')];
  t.is(prepareArchitecture(source).placements[0].state?.type,'bottom');
  t.deepEqual(source,[slab,cell(1,'stone')]);
});

test('a tagged roof-wall junction fills the missing band using wall material while leaving the room hollow', t => {
  const source: BlockPlacement[] = [];
  for(let x=0;x<3;x++)for(let z=0;z<3;z++){
    if(x===0||x===2||z===0||z===2)source.push({position:{x,y:0,z},block:'bricks',category:'wall'});
    source.push({position:{x,y:4,z},block:'stone',category:'roof'});
  }
  const prepared=prepareArchitecture(source),map=new Map(prepared.placements.map(p=>[positionKey(p.position),p]));
  t.is(prepared.placements.length,source.length+24);
  for(let y=1;y<4;y++){t.is(map.get(`0,${y},1`)?.block,'bricks');t.false(map.has(`1,${y},1`));}
  t.true(prepared.adjustments.some(message=>message.includes('24')));
  t.throws(()=>prepareArchitecture(source,'1.20.4',[{x:0,y:2,z:1}]),{code:'DESIGN_ROOF_WALL_GAP'});
});

test('untagged sculptures and subsequent floating roofs are not guessed to be building walls', t => {
  t.is(prepareArchitecture([cell(0,'stone'),cell(5,'stone')]).placements.length,2);
  const prepared=prepareArchitecture([{...cell(0,'stone'),category:'wall'},{...cell(3,'stone'),category:'roof'},{...cell(8,'stone'),category:'roof'}]);
  t.is(prepared.placements.length,5);
  t.false(prepared.placements.some(p=>p.position.y===4));
});

test('roof primitive closes the wall crown on the actual wall footprint, independently of overhang, axis and style', t => {
  for(const style of ['flat','gable','hip'] as const)for(const axis of ['x','z'] as const)for(const width of [5,6]){
    const roof=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:width-1},'oak_stairs',{style,axis,overhang:1,wallTopY:66,wallBlock:'bricks'});
    const map=new Map(roof.map(p=>[positionKey(p.position),p]));
    for(let y=67;y<70;y++){
      t.is(map.get(`0,${y},0`)?.block,'bricks');
      t.false(map.has(`-1,${y},-1`));
      t.false(map.has(`3,${y},2`));
    }
    t.true(roof.filter(p=>p.category==='wall').every(p=>isFullCube(p)));
  }
  t.throws(()=>buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:6},'stone',{wallTopY:70}),{code:'INVALID_ROOF'});
});

test('stair gables use full wall blocks and slab roof steps have solid backing without filling the attic', t => {
  const stairs=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:6},'oak_stairs');
  t.true(stairs.some(p=>p.category==='wall'));
  t.true(stairs.filter(p=>p.category==='wall').every(p=>p.block==='oak_planks'));
  const slabs=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:6},'oak_slab');
  validateDesign(slabs,{requireConnected:true});
  t.false(slabs.some(p=>p.position.x===3&&p.position.z===3&&p.position.y===70));
});

test('explicitly open gables remain open after shared preparation while the crown band is still closed', t => {
  const roof=buildRoofDetailed({x:0,y:70,z:0},{x:6,y:70,z:6},'oak_stairs',{closeEnds:false,wallTopY:66});
  const prepared=prepareArchitecture(roof),map=new Map(prepared.placements.map(p=>[positionKey(p.position),p]));
  t.is(map.get('0,69,3')?.block,'oak_planks');
  t.false(map.has('0,71,3'));
  t.false(map.has('0,72,3'));
});

test('preview reports corrected final counts; stale declared counts fail before world placement', async t => {
  const mock=buildBot(),service=new BuildService(mock.bot,{mode:'fast',fastModeEnabled:true,checkpointDirectory:false});
  const blueprint={version:1,name:'independent-junction',size:{x:1,y:5,z:1},blocks:[{x:0,y:0,z:0,block:'bricks',category:'wall'},{x:0,y:4,z:0,block:'stone',category:'roof'}]};
  const preview=service.preview(blueprint);
  t.true(preview.valid);t.is(preview.blocks,5);t.true(preview.warnings.some(message=>message.includes('3 missing')));
  await t.throwsAsync(service.buildBlueprint(blueprint,{x:0,y:80,z:0},'fast',{expectedBlocks:2}),{code:'PLAN_COUNT_MISMATCH'});
  t.is(mock.sent.length,0);
});

test('corrected slab state is sent even when post-build verification is disabled', async t => {
  const mock=buildBot(),service=new BuildService(mock.bot,{mode:'fast',fastModeEnabled:true,checkpointDirectory:false});
  const result=await service.executePlacements('slab-support',[cell(80,'oak_slab'),cell(81,'stone')],'fast',{verifyAfterBuild:false});
  t.is(result.status,'unverified');
  t.is(mock.world.get('0,80,0')?.state.type,'top');
});

test('physical placement does not skip an existing slab merely because its material matches', async t => {
  const calls:unknown[][]=[];
  const blocks={getBlockInfo:()=>({name:'oak_slab',block:{getProperties:()=>({type:'bottom',waterlogged:false})}}),
    digBlock:async(...args:unknown[])=>{calls.push(['dig',...args]);},placeBlock:async(...args:unknown[])=>{calls.push(['place',...args]);}};
  await new PhysicalBuildStrategy(blocks as unknown as BlockService).place(cell(0,'oak_slab',{type:'top',waterlogged:false}));
  t.is(calls[0][0],'dig');t.is(calls[1][0],'place');
  t.deepEqual(calls[1][6],{type:'top',waterlogged:false});
});

test('physical mode refuses unsupported explicit states before digging an existing block', async t => {
  let dug=false;
  const blocks={getBlockInfo:()=>({name:'oak_stairs',block:{getProperties:()=>({facing:'north'})}}),digBlock:async()=>{dug=true;}};
  await t.throwsAsync(new PhysicalBuildStrategy(blocks as unknown as BlockService).place(cell(0,'oak_stairs',{facing:'east'})),{code:'PHYSICAL_STATE_UNSUPPORTED'});
  t.false(dug);
});

test('roof crown closure preserves configured generation bounds and output limits', t => {
  const limits = {maxBlocks:1000,maxQueue:1000,maxDimension:8,maxPreflightBlocks:1000};
  t.throws(()=>buildRoofDetailed({x:0,y:70,z:0},{x:4,y:70,z:4},'stone',{wallTopY:60},limits));
  t.throws(()=>buildRoofDetailed({x:0,y:70,z:0},{x:4,y:70,z:4},'stone',{wallTopY:66},{...limits,maxBlocks:30}));
});
