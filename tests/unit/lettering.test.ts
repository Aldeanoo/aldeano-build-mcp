import test from 'ava';
import { EventEmitter } from 'node:events';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { layoutLettering, textPixels, wrapText, panelComponent } from '../../src/services/lettering/text-layout.js';
import { buildLettering, glyphRows } from '../../src/build/primitives/lettering.js';
import { LetteringService, componentText, bookPages, snbt, textComponentTag } from '../../src/services/lettering/lettering-service.js';
import { BuildService } from '../../src/build/build-service.js';

test('sign layout retains all words, accents, hierarchy and explicit paragraphs',t=>{
  const input = {support:'sign' as const,title:'Museo óseo',subtitle:'Anatomía',body:'Cráneo y mandíbula.\nObserva las vértebras y sus conexiones.'};
  const result = layoutLettering(input);
  t.true(result.panels.length>1);
  t.true(result.panels.every(panel=>panel.length<=4));
  t.is(result.panels.flat().map(line=>line.text).join(' ').replace(/\s+/g,' '),[input.title,input.subtitle,input.body].join(' ').replace(/\s+/g,' '));
  t.true(result.panels.flat().every(line=>textPixels(line.text,line.role==='title')<=90));
  t.is(result.panels[0][0].role,'title');
});
test('books paginate without dropping content and respect default-font widths',t=>{
  const body = 'El museo conserva información de los huesos. '.repeat(45).trim();
  const result = layoutLettering({support:'book',title:'Guía',body});
  t.true(result.panels.length>1);
  t.true(result.panels.every(panel=>panel.length<=12));
  t.is(result.panels.flat().map(line=>line.text).join(' ').replace(/\s+/g,' '),`Guía ${body}`);
  t.true(result.panels.flat().every(line=>textPixels(line.text)<=114));
});
test('book text has dark contrast and SNBT does not confuse JSON escapes with literals',t=>{
  const layout=layoutLettering({support:'book',title:'Guía',body:'Texto'});
  t.is(layout.theme.foreground,'#171717');
  t.is(layout.theme.title,'#005577');
  const component=JSON.stringify({text:'Primera\nSegunda "á" \\'});
  t.false(snbt(component).includes('\n'));
  t.true(snbt(component).includes('\\\\n'));
  t.is(snbt('a"b\\c'),'"a\\"b\\\\c"');
  const text={text:'Árbol\nNiño "cita"',bold:true};
  t.deepEqual(JSON.parse(textComponentTag(text,true)),text);
  t.deepEqual(JSON.parse(JSON.parse(textComponentTag(text,false))),text);
  t.false(textComponentTag(text,true).includes('\n'));
});
test('formatting rejects overflow and ambiguous codes instead of truncation',t=>{
  t.throws(()=>wrapText('x'.repeat(100),90),{message:/TEXT_WORD_TOO_WIDE/});
  t.throws(()=>layoutLettering({support:'sign',width:100,body:'hola'}));
  for(const body of ['§aHola','abc\u202ed','\u0000','😀']) t.throws(()=>layoutLettering({support:'display',body}));
  t.throws(()=>layoutLettering({support:'display'}),{message:/TEXT_EMPTY/});
  t.deepEqual(wrapText('a\r\nb\n\nc',90),['a','b','','c']);
});
test('display components contain only escaped text, no executable events',t=>{
  const body = '"Hola" \\ ruta /kill @e';
  const layout = layoutLettering({support:'display',body});
  const component = panelComponent(layout,layout.panels[0]);
  t.is(componentText(JSON.stringify(component)),body);
  t.false(JSON.stringify(component).includes('clickEvent'));
  t.is(componentText({type:'compound',value:{text:{type:'string',value:'á'},extra:{type:'list',value:{type:'compound',value:[{text:{type:'string',value:'ñ'}}]}}}}),'áñ');
});
test('block letters preserve Spanish accents, clear baselines, facing and configured bounds',t=>{
  const layout = layoutLettering({support:'blocks',title:'ÁÑ',body:'Ü'});
  const limits={maxBlocks:10000,maxQueue:10000,maxDimension:256,maxPreflightBlocks:1000000};
  t.notDeepEqual(glyphRows('Ñ'),glyphRows('N'));
  t.notDeepEqual(glyphRows('Á'),glyphRows('A'));
  const origin={x:0,y:0,z:0};
  for(const facing of ['north','south','east','west'] as const){
    const blocks=buildLettering(layout,origin,facing,limits);
    t.true(blocks.some(block=>block.block==='cyan_concrete'));
    t.true(blocks.some(block=>block.block==='white_concrete'));
    t.is(new Set(blocks.map(block=>JSON.stringify(block.position))).size,blocks.length);
  }
  t.throws(()=>buildLettering(layout,origin,'north',{...limits,maxBlocks:1}));
  t.throws(()=>buildLettering(layoutLettering({support:'blocks',body:'Ω'}),origin,'north',limits),{message:/TEXT_UNSUPPORTED_GLYPH/});
});
test('block wrapping uses the monospaced glyph width even for narrow Minecraft letters',t=>{
  const layout=layoutLettering({support:'blocks',body:'I I I I I I I I I I',width:30});
  t.true(layout.panels.flat().every(line=>line.text.length*6<=30));
});
test('book readback understands legacy NBT and component pages',t=>{
  t.deepEqual(bookPages({nbt:{type:'compound',value:{pages:{type:'list',value:{type:'string',value:['Uno','Dos']}}}}}),['Uno','Dos']);
  t.deepEqual(bookPages({components:[{type:'writable_book_content',data:{pages:[{content:'Árbol'},{raw:'Página'}]}}]}),['Árbol','Página']);
});
function fakeBot(){
  return Object.assign(new EventEmitter(),{entities:{},entity:{position:new Vec3(0,0,0)},game:{gameMode:'creative',dimension:'overworld'},version:'1.20.4',_client:{socket:{remoteAddress:'localhost',remotePort:9999}},registry:{entitiesByName:{text_display:{metadataKeys:['text']}}},inventory:{slots:Array(45).fill(null)},chat:()=>{}}) as unknown as mineflayer.Bot;
}
test('contextual lettering rejects protected access and distant anchors before mutation',t=>{
  const bot=fakeBot();
  const service=new LetteringService(bot,new BuildService(bot,{fastModeEnabled:true,checkpointDirectory:false}));
  const text={support:'blocks' as const,title:'A'};
  t.throws(()=>service.preview(text,{origin:{x:0,y:0,z:0},facing:'north',keepClear:[{from:{x:0,y:0,z:0},to:{x:4,y:20,z:2}}]}),{message:/TEXT_BLOCKED_ACCESS/});
  t.throws(()=>service.preview(text,{origin:{x:0,y:0,z:0},facing:'north',anchor:{x:100,y:0,z:0}}),{message:/TEXT_TOO_FAR/});
});
test('book writes refuse occupied slots and require explicit fast mode',async t=>{
  const bot=fakeBot();
  bot.inventory.slots[36]={name:'diamond'} as never;
  const service=new LetteringService(bot,new BuildService(bot,{fastModeEnabled:true,checkpointDirectory:false}));
  await t.throwsAsync(service.writeBook({support:'book',body:'Hola'},0),{message:/TEXT_SLOT_OCCUPIED/});
  const disabled=new LetteringService(bot,new BuildService(bot,{fastModeEnabled:false,checkpointDirectory:false}));
  await t.throwsAsync(disabled.place({support:'sign',body:'Hola'},{origin:{x:0,y:0,z:0},facing:'north'}),{message:/TEXT_FAST_CREATIVE/});
});
