import { randomUUID } from 'node:crypto';
import type mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import type { BotOrGetter } from '../types.js';
import { resolveBot } from '../service-utils.js';
import { BuildService } from '../../build/build-service.js';
import { BuildPreflight } from '../../build/verification/build-preflight.js';
import { buildLettering, letteringPosition, type LetteringFacing } from '../../build/primitives/lettering.js';
import type { BlockPlacement, BlockPosition, RegionBounds } from '../../build/build-types.js';
import { layoutLettering, panelComponent, type LetteringInput, type LetteringLayout } from './text-layout.js';

export interface LetteringPlacement {
  origin: BlockPosition;
  facing: LetteringFacing;
  anchor?: BlockPosition;
  keepClear?: RegionBounds[];
}
interface LetteringRecord {
  id: string;
  identity: string;
  layout: LetteringLayout;
  positions?: BlockPosition[];
  entities?: string[];
  displayLines?: Array<{uuid:string;panel:number;line:number}>;
  buildId?: string;
  slot?: number;
}

/** SNBT string escaping differs from JSON: literal newlines are legal; backslash-n is not. */
export function snbt(value: unknown): string {
  if (typeof value === 'string') return `"${value.replaceAll('\\','\\\\').replaceAll('"','\\"')}"`;
  if (typeof value === 'boolean') return value ? '1b' : '0b';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(snbt).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key,item])=>`${snbt(key)}:${snbt(item)}`).join(',')}}`;
  throw new Error('TEXT_INVALID_NBT');
}

export function textComponentTag(value:object,modern:boolean):string {
  // 1.21.5 added structured text and JSON-compatible newline escapes to SNBT.
  return modern ? JSON.stringify(value) : snbt(JSON.stringify(value));
}

/** Handle both typed NBT received over the protocol and legacy JSON text components. */
export function plainData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plainData);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('type' in object && 'value' in object) return plainData(object.value);
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, plainData(item)]));
  }
  return value;
}
export function componentText(value: unknown): string {
  const data = plainData(value);
  if (typeof data === 'string') {
    try { return componentText(JSON.parse(data)); } catch { return data; }
  }
  if (Array.isArray(data)) return data.map(componentText).join('');
  if (!data || typeof data !== 'object') return '';
  const object = data as Record<string, unknown>;
  return (typeof object.text === 'string' ? object.text : '') + (Array.isArray(object.extra) ? object.extra.map(componentText).join('') : '');
}
export function bookPages(item: unknown): string[] {
  const data = plainData(item) as { nbt?: { pages?: string[] }; components?: Array<{ type: string; data: { pages?: Array<{ content?: string; raw?: string }> } }> } | null;
  if (!data) return [];
  return data.nbt?.pages ?? data.components?.find(component => component.type === 'writable_book_content')?.data.pages?.map(page => page.content ?? page.raw ?? '') ?? [];
}
function intersects(a: RegionBounds, b: RegionBounds): boolean {
  return (['x','y','z'] as const).every(axis => a.from[axis] <= b.to[axis] && a.to[axis] >= b.from[axis]);
}
function boundsOf(positions: BlockPosition[]): RegionBounds {
  return { from: { x: Math.min(...positions.map(p => p.x)), y: Math.min(...positions.map(p => p.y)), z: Math.min(...positions.map(p => p.z)) }, to: { x: Math.max(...positions.map(p => p.x)), y: Math.max(...positions.map(p => p.y)), z: Math.max(...positions.map(p => p.z)) } };
}

export class LetteringService {
  private readonly records = new Map<string, LetteringRecord>();
  private busy = false;
  private lastFeedback: string | null = null;
  constructor(private readonly botOrGetter: BotOrGetter, private readonly builds: BuildService) {}
  private get bot(): mineflayer.Bot { return resolveBot(this.botOrGetter); }
  private identity(): string { const bot = this.bot; return JSON.stringify([bot._client.socket?.remoteAddress, bot._client.socket?.remotePort, bot.game.dimension]); }
  preview(input: LetteringInput, placement?: LetteringPlacement) {
    const layout = this.layout(input);
    if (!placement || layout.input.support === 'book') return { layout };
    const plan = this.plan(layout, placement);
    return { layout, bounds: plan.bounds, positions: plan.positions, blocks: plan.blocks.length, warnings: [...layout.warnings, ...(!placement.anchor ? ['No element anchor supplied; semantic association must be reviewed by the caller.'] : [])] };
  }
  private layout(input:LetteringInput):LetteringLayout {
    const legacy = Number(this.bot.version.split('.')[1])<=20 && input.support==='display';
    const layout=layoutLettering(legacy?{...input,width:Math.min(input.width??240,90)}:input);
    if(legacy)layout.warnings.push('Legacy command limits use narrower lines and separate display entities; all content is retained.');
    return layout;
  }
  status() {
    const bot = this.bot;
    return {version:bot.version,gameMode:bot.game.gameMode,fastModeEnabled:this.builds.config.fastModeEnabled,players:Object.entries(bot.players).map(([name,player])=>({name,position:player.entity?.position ?? null})),books:bot.inventory.items().filter(item=>item.name==='writable_book').map(item=>({slot:item.slot,pages:bookPages(item)})),lastFeedback:this.lastFeedback,source:'minecraft_world',trusted:false};
  }
  private plan(layout: LetteringLayout, placement: LetteringPlacement) {
    if (![placement.origin.x,placement.origin.y,placement.origin.z].every(Number.isSafeInteger)) throw new Error('TEXT_INVALID_POSITION');
    if (placement.anchor && new Vec3(placement.origin.x,placement.origin.y,placement.origin.z).distanceTo(new Vec3(placement.anchor.x,placement.anchor.y,placement.anchor.z)) > 12) throw new Error('TEXT_TOO_FAR_FROM_ELEMENT: maximum anchor distance is 12 blocks');
    let blocks: BlockPlacement[] = [];
    let positions: BlockPosition[];
    if (layout.input.support === 'blocks') {
      blocks = buildLettering(layout,placement.origin,placement.facing,this.builds.config);
      positions = blocks.map(block => block.position);
    } else if (layout.input.support === 'sign') {
      positions = layout.panels.map((_panel,index) => letteringPosition(placement.origin,index*2,1,0,placement.facing));
      const rotation = { south: 0, west: 4, north: 8, east: 12 }[placement.facing];
      blocks = positions.flatMap(position => [{position:{...position,y:position.y-1},block:'black_concrete',category:'structural' as const},{position,block:'oak_sign',state:{rotation:String(rotation)},category:'decoration' as const}]);
    } else {
      positions = layout.panels.map((_panel,index) => letteringPosition(placement.origin,0,index*4,0,placement.facing));
    }
    const displayWidth = Math.ceil(layout.width / 40);
    const bounds = boundsOf(blocks.length ? blocks.map(block => block.position) : positions.flatMap(position => [letteringPosition(position,-Math.ceil(displayWidth/2),0,0,placement.facing),letteringPosition(position,Math.ceil(displayWidth/2),3,0,placement.facing)]));
    for (const clear of placement.keepClear ?? []) if (intersects(bounds,clear)) throw new Error('TEXT_BLOCKED_ACCESS: lettering intersects a protected circulation volume');
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity || entity.type !== 'player') continue;
      const point = entity.position.floored();
      if (intersects(bounds,{from:{x:point.x-1,y:point.y,z:point.z-1},to:{x:point.x+1,y:point.y+2,z:point.z+1}})) throw new Error('TEXT_PLAYER_OBSTRUCTION');
    }
    return { blocks, positions, bounds };
  }
  private modernComponents(): boolean { const [major,minor,patch] = this.bot.version.split('.').map(Number); return major > 1 || minor > 21 || (minor === 21 && patch >= 5); }
  private textTag(value: object): string { return textComponentTag(value,this.modernComponents()); }
  private command(command: string): void {
    const maximum=Number(this.bot.version.split('.')[1])<=20?255:16000;
    if (command.length > maximum || command.includes('\n')) throw new Error(`TEXT_COMMAND_TOO_LONG_OR_CONTROL: maximum ${maximum}`);
    const bot = this.bot;
    const feedback = (text:string) => {clearTimeout(timeout);this.lastFeedback=text;};
    const timeout = setTimeout(()=>bot.removeListener('messagestr',feedback),8000);
    bot.once('messagestr',feedback);
    bot.chat(command);
  }
  private async waitFor(predicate: () => boolean): Promise<void> {
    const bot = this.bot;
    await new Promise<void>((resolve,reject) => {
      const cleanup = () => { clearTimeout(timeout); clearInterval(poll); bot.removeListener('end',ended); };
      const ended = () => { cleanup(); reject(new Error('TEXT_DISCONNECTED')); };
      const check = () => { try { if (predicate()) { cleanup(); resolve(); } } catch(error) { cleanup(); reject(error); } };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('TEXT_VERIFICATION_TIMEOUT: server did not confirm the expected content')); },8000);
      const poll = setInterval(check,50);
      bot.once('end',ended);
      check();
    });
  }
  async place(input: LetteringInput, placement: LetteringPlacement) {
    if (this.busy) throw new Error('TEXT_BUSY');
    const layout = this.layout(input);
    if (layout.input.support === 'book') throw new Error('TEXT_USE_WRITE_BOOK');
    if (this.bot.game.gameMode !== 'creative' || !this.builds.config.fastModeEnabled) throw new Error('TEXT_FAST_CREATIVE_REQUIRED');
    if (!this.bot.registry.entitiesByName.text_display && layout.input.support === 'display') throw new Error('TEXT_UNSUPPORTED_VERSION');
    const plan = this.plan(layout,placement);
    const record: LetteringRecord = { id: `label_${randomUUID()}`, identity: this.identity(), layout, positions: plan.positions };
    this.busy = true;
    try {
      if (plan.blocks.length) {
        const result = await this.builds.executePlacements('lettering',plan.blocks,'fast',{verifyAfterBuild:true});
        record.buildId = result.buildId;
        if (!result.success) throw new Error('TEXT_STRUCTURE_FAILED');
      } else await new BuildPreflight(this.botOrGetter,this.builds.config.maxPreflightBlocks,this.builds.config.preflightNavigationTimeoutMs,undefined,this.builds.config.teleportEnabled).inspectBounds(plan.bounds,'fast');
      if (layout.input.support === 'sign') {
        for (const [index,position] of plan.positions.entries()) {
          const panel = layout.panels[index];
          const messages = Array.from({length:4},(_unused,line) => this.textTag({text:panel[line]?.text ?? '',color:panel[line]?.role==='title'?layout.theme.title:layout.theme.foreground,bold:panel[line]?.role==='title'}));
          for(const [line,message] of messages.entries()) {
            this.command(`/data modify block ${position.x} ${position.y} ${position.z} front_text.messages[${line}] set value ${message}`);
            await this.bot.waitForTicks(1);
          }
          this.command(`/data merge block ${position.x} ${position.y} ${position.z} {front_text:{color:"white",has_glowing_text:1b}}`);
          await this.waitFor(() => this.bot.blockAt(new Vec3(position.x,position.y,position.z))?.signText?.trimEnd() === panel.map(line => line.text).join('\n').trimEnd());
        }
      } else if (layout.input.support === 'display') {
        record.entities = [];
        record.displayLines = [];
        for (const [index,position] of plan.positions.entries()) {
        for(const [lineIndex,line] of layout.panels[index].entries()) {
          const uuid = randomUUID();
          const hex = uuid.replaceAll('-','');
          const uuidInts = Array.from({length:4},(_unused,part) => Number.parseInt(hex.slice(part*8,part*8+8),16)|0);
          const y=position.y+2-lineIndex*0.28;
          this.command(`/summon minecraft:text_display ${position.x} ${y} ${position.z} {UUID:[I;${uuidInts.join(',')}],Tags:["aldeano_lettering"]}`);
          // Persist ID before readback so failed/partial operations remain inspectable.
          record.entities.push(uuid);
          record.displayLines.push({uuid,panel:index,line:lineIndex});
          await this.waitFor(()=>this.readDisplay(uuid)!==null);
          this.command(`/data merge entity ${uuid} {Rotation:[${{south:0,west:90,north:180,east:270}[placement.facing]}f,0f],line_width:${layout.width},background:-15263977,alignment:"${layout.input.alignment}"}`);
          await this.bot.waitForTicks(1);
          this.command(`/data modify entity ${uuid} text set value ${this.textTag({text:line.text,color:line.role==='title'?layout.theme.title:layout.theme.foreground,bold:line.role==='title'})}`);
          await this.waitFor(() => this.readDisplay(uuid) === line.text);
        }
        }
      }
      this.records.set(record.id,record);
      return { labelId:record.id, ...(await this.verify(record.id)) };
    } catch (error) { this.records.set(record.id,record); throw new Error(`Lettering ${record.id}: ${error instanceof Error?error.message:String(error)}`); }
    finally { this.busy = false; }
  }
  private readDisplay(uuid: string): string | null {
    const entity = Object.values(this.bot.entities).find(entity => entity?.uuid === uuid);
    if (!entity) return null;
    const index = this.bot.registry.entitiesByName.text_display.metadataKeys?.indexOf('text');
    if (index === undefined || index < 0) return null;
    return componentText(entity.metadata[index]);
  }
  async writeBook(input: LetteringInput, slot: number, overwrite = false) {
    if (this.busy) throw new Error('TEXT_BUSY');
    const layout = layoutLettering({...input,support:'book'});
    if (!Number.isInteger(slot) || slot<0 || slot>8) throw new Error('TEXT_INVALID_HOTBAR_SLOT');
    if (this.bot.game.gameMode !== 'creative' || !this.builds.config.fastModeEnabled) throw new Error('TEXT_FAST_CREATIVE_REQUIRED');
    const existing = this.bot.inventory.slots[36+slot];
    if (existing && (existing.name !== 'writable_book' || (!overwrite && bookPages(existing).some(Boolean)))) throw new Error('TEXT_SLOT_OCCUPIED: choose an empty slot or explicitly overwrite a writable book');
    const pages = layout.panels.map(panel => panel.map(line => line.text).join('\n'));
    const record: LetteringRecord = { id:`label_${randomUUID()}`,identity:this.identity(),layout,slot };
    this.busy = true;
    try {
      if (!existing) {
        this.command(`/item replace entity @s hotbar.${slot} with minecraft:writable_book`);
        await this.waitFor(()=>this.bot.inventory.slots[36+slot]?.name==='writable_book');
      }
      // 1.18+ edit_book carries plain page strings. Sending newline-containing SNBT
      // through a command is invalid, and the installed Mineflayer wrapper uses legacy fields.
      const minor = Number(this.bot.version.split('.')[1]);
      if (minor<18) throw new Error('TEXT_UNSUPPORTED_BOOK_VERSION');
      this.bot._client.write('edit_book',{hand:slot,pages,title:undefined});
      await this.waitFor(() => JSON.stringify(bookPages(this.bot.inventory.slots[36+slot])) === JSON.stringify(pages));
      this.records.set(record.id,record);
      return {labelId:record.id,...(await this.verify(record.id))};
    } catch(error) { this.records.set(record.id,record); throw new Error(`Lettering ${record.id}: ${String(error)}`); }
    finally { this.busy = false; }
  }
  async giveBook(id:string,player:string,author:string) {
    if (this.busy) throw new Error('TEXT_BUSY');
    if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) throw new Error('TEXT_INVALID_PLAYER');
    const record=this.records.get(id);
    if(!record || record.layout.input.support!=='book')throw new Error('TEXT_BOOK_NOT_FOUND');
    const verified=await this.verify(id);
    if(!verified.success)throw new Error('TEXT_BOOK_NOT_VERIFIED');
    if(this.bot.game.gameMode!=='creative' || !this.builds.config.fastModeEnabled)throw new Error('TEXT_FAST_CREATIVE_REQUIRED');
    if(!Object.keys(this.bot.players).some(name=>name.toLowerCase()===player.toLowerCase()))throw new Error('TEXT_PLAYER_OFFLINE');
    const layout=record.layout;
    const pages=layout.panels.map(panel=>panelComponent(layout,panel));
    const title=layout.input.title || 'Libro';
    if(title.length>32 || author.length>64 || /[\r\n]/.test(author))throw new Error('TEXT_BOOK_CREDITS_TOO_LONG');
    const [major,minor,patch]=this.bot.version.split('.').map(Number);
    const components=major>1 || minor>20 || (minor===20 && patch>=5);
    const argument=components ? `minecraft:written_book[minecraft:written_book_content={title:${snbt(title)},author:${snbt(author)},pages:[${pages.map(page=>`{raw:${this.textTag(page)}}`).join(',')}]}]` : `minecraft:written_book${snbt({title,author,pages:pages.map(page=>JSON.stringify(page))})}`;
    const bot=this.bot;
    this.busy=true;
    try {
      await new Promise<void>((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);bot.removeListener('message',feedback);bot.removeListener('end',ended);};
        const feedback:mineflayer.BotEvents['message']=(message,position)=>{
          const data=plainData(message.json) as {translate?:string;with?:unknown[]};
          if(position!=='system' || data?.translate!=='commands.give.success.single')return;
          if(!JSON.stringify(data.with).toLowerCase().includes(player.toLowerCase()))return;
          cleanup();resolve();
        };
        const ended=()=>{cleanup();reject(new Error('TEXT_DISCONNECTED'));};
        const timer=setTimeout(()=>{cleanup();reject(new Error('TEXT_DELIVERY_UNCONFIRMED: check recipient inventory before retrying'));},8000);
        bot.on('message',feedback);bot.once('end',ended);
        try{this.command(`/give ${player} ${argument} 1`);}catch(error){cleanup();reject(error);}
      });
      return {success:true,serverAcknowledged:true,recipient:player,pages:pages.length,labelId:id,inventoryReadback:false};
    }finally{this.busy=false;}
  }
  async verify(id: string) {
    const record = this.records.get(id);
    if (!record) throw new Error('TEXT_NOT_FOUND');
    if (record.identity !== this.identity()) throw new Error('TEXT_WORLD_MISMATCH');
    const expected = record.layout.panels.map(panel => panel.map(line => line.text).join('\n').trimEnd());
    let observed: Array<string|null>;
    if (record.layout.input.support === 'sign') observed = record.positions!.map(position => this.bot.blockAt(new Vec3(position.x,position.y,position.z))?.signText?.trimEnd() ?? null);
    else if (record.layout.input.support === 'display') observed = expected.map((_panel,index) => {
      if(!record.displayLines)return record.entities?.[index] ? this.readDisplay(record.entities[index]) : null;
      const lines=record.displayLines.filter(line=>line.panel===index).sort((a,b)=>a.line-b.line).map(line=>this.readDisplay(line.uuid));
      return lines.length===record.layout.panels[index].length && lines.every(line=>line!==null)?lines.join('\n'):null;
    });
    else if (record.layout.input.support === 'book') observed = bookPages(this.bot.inventory.slots[36+record.slot!]);
    else {
      if (!record.buildId) return {success:false,verified:false,missingStructure:true};
      const result = await this.builds.verifyAsync(record.buildId);
      return {success:result.accuracy===1,verified:result.accuracy===1,verification:result,renderedText:expected,source:'minecraft_world',trusted:false};
    }
    observed = observed.map(text=>text?.trimEnd() ?? null);
    const verified = observed.length === expected.length && expected.every((text,index)=>text===observed[index]);
    return {success:verified,verified,expected,observed,source:'minecraft_world',trusted:false};
  }
}
