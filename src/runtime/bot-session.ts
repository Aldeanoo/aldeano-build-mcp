import type { EventEmitter } from 'node:events';
import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { IndexedData } from 'minecraft-data';
import minecraftData from 'minecraft-data';
import pathfinderPkg from 'mineflayer-pathfinder';
import type { Pathfinder, Movements } from 'mineflayer-pathfinder';
import {
  type BotSessionConfig,
  type UntrustedChatMessage,
  type UntrustedContent,
  type UntrustedSignText,
  type UntrustedEntityInfo,
} from './runtime-types.js';
import { SessionDisposedError, BotNotConnectedError } from '../errors/index.js';
import { log } from '../logger/index.js';
import type { MessageStore } from '../message-store.js';
import { MovementService } from '../services/movement-service.js';
import { BlocksService } from '../services/blocks-service.js';
import { InventoryService } from '../services/inventory-service.js';
import { WorldService } from '../services/world-service.js';
import { ChatService } from '../services/chat-service.js';
import { CraftingService } from '../services/crafting-service.js';
import { MessageStore as MessageStoreClass } from '../message-store.js';
import { normalizeWorldText } from '../world/untrusted-content.js';

const { Movements: MovementsClass } = pathfinderPkg;

export type SessionStatus = 'initializing' | 'active' | 'closed';

interface TrackedListener {
  emitter: EventEmitter;
  event: string;
  listener: (...args: unknown[]) => void;
}

/**
 * BotSession (or AgentSession) represents an individual bot session with a configurable username.
 * Holds the Mineflayer bot instance and provides access to bot, pathfinder, mcData, and session properties.
 * Handles security baseline: incoming messages, chat, signs, entity names have source: 'minecraft_world', trusted: false.
 * Implements thorough event unhooking and cleanup.
 */
export class BotSession {
  readonly id: string;
  readonly username: string;
  readonly config: Readonly<BotSessionConfig>;
  readonly createdAt: Date;

  private botInstance: Bot | null = null;
  private mcData: IndexedData | null = null;
  private movements: Movements | null = null;
  private disposed = false;
  private untrustedChatHistory: UntrustedChatMessage[] = [];
  private readonly maxChatHistory = 100;
  private trackedListeners: TrackedListener[] = [];
  private messageStore?: MessageStore;

  constructor(
    configOrBot: BotSessionConfig | Bot,
    botOrStore?: Bot | MessageStore
  ) {
    this.id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.createdAt = new Date();

    if ('username' in configOrBot && typeof (configOrBot as BotSessionConfig).host === 'string') {
      // Called with (config: BotSessionConfig, bot?: Bot)
      const config = configOrBot as BotSessionConfig;
      this.username = config.username;
      this.config = Object.freeze({ ...config });
      if (botOrStore && 'on' in botOrStore) {
        this.attachBot(botOrStore as Bot);
      }
    } else {
      // Called with (bot: Bot, messageStore?: MessageStore)
      const bot = configOrBot as Bot;
      this.username = bot.username || 'LLMBot';
      this.config = Object.freeze({
        host: (bot as unknown as { host?: string }).host || 'localhost',
        port: (bot as unknown as { port?: number }).port || 25565,
        username: this.username,
      });
      if (botOrStore && 'addMessage' in botOrStore) {
        this.messageStore = botOrStore as MessageStore;
      }
      this.attachBot(bot);
    }
  }

  get bot(): Bot {
    return this.getBot();
  }

  getBot(): Bot {
    if (this.disposed) {
      throw new SessionDisposedError(this.id);
    }
    if (!this.botInstance) {
      throw new BotNotConnectedError(`No active bot connection in session ${this.id}`);
    }
    return this.botInstance;
  }

  getBotOrNull(): Bot | null {
    if (this.disposed) return null;
    return this.botInstance;
  }

  attachBot(bot: Bot): void {
    if (this.disposed) {
      throw new SessionDisposedError(this.id);
    }
    this.botInstance = bot;
    this.hookBotEvents(bot);

    if (bot.version) {
      this.initPathfinder();
    }
  }

  private hookBotEvents(bot: Bot): void {
    const handleChat = (username: string, message: string) => {
      if (username === bot.username) return;

      const untrusted = this.wrapChatMessage(username, message);
      this.untrustedChatHistory.push(untrusted);
      if (this.untrustedChatHistory.length > this.maxChatHistory) {
        this.untrustedChatHistory.shift();
      }

      if (this.messageStore) {
        this.messageStore.addMessage(username, message);
      }
    };

    this.registerListener(bot as unknown as EventEmitter, 'chat', handleChat as (...args: unknown[]) => void);

    const handleSpawn = () => {
      this.initPathfinder();
    };

    this.registerListener(bot as unknown as EventEmitter, 'spawn', handleSpawn as (...args: unknown[]) => void);
  }

  initPathfinder(): void {
    if (!this.botInstance || this.disposed) return;
    try {
      if (this.botInstance.version && !this.mcData) {
        this.mcData = minecraftData(this.botInstance.version);
      }
      if (this.botInstance && this.mcData && MovementsClass && !this.movements) {
        this.movements = new MovementsClass(this.botInstance, this.mcData);
        if (this.botInstance.pathfinder) {
          this.botInstance.pathfinder.setMovements(this.movements);
        }
      }
    } catch (err) {
      log('warn', `Failed to initialize pathfinder for session ${this.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Security baseline: Wrap arbitrary data from Minecraft world as untrusted.
   */
  wrapUntrusted<T>(content: T, metadata?: Record<string, unknown>): UntrustedContent<T> {
    return {
      source: 'minecraft_world',
      trusted: false,
      content,
      timestamp: Date.now(),
      metadata,
    };
  }

  /**
   * Security baseline: Wrap incoming chat message as untrusted world input.
   */
  wrapChatMessage(username: string, message: string): UntrustedChatMessage {
    return {
      source: 'minecraft_world',
      trusted: false,
      username: normalizeWorldText(username, 128),
      message: normalizeWorldText(message),
      timestamp: Date.now(),
    };
  }

  /**
   * Security baseline: Wrap sign text lines as untrusted world input.
   */
  wrapSignText(lines: string[], position?: { x: number; y: number; z: number }): UntrustedSignText {
    return {
      source: 'minecraft_world',
      trusted: false,
      lines: lines.slice(0, 4).map(line => normalizeWorldText(line)),
      position,
      timestamp: Date.now(),
    };
  }

  /**
   * Security baseline: Wrap entity info (name, custom name) as untrusted world input.
   */
  wrapEntity(entity: Entity | { id: number; name?: string; displayName?: string; type?: string; customName?: unknown }): UntrustedEntityInfo {
    const raw = entity as Record<string, unknown>;
    const customName = typeof raw.customName === 'string' ? raw.customName : undefined;
    return {
      source: 'minecraft_world',
      trusted: false,
      id: entity.id,
      name: entity.name === undefined ? undefined : normalizeWorldText(entity.name, 128),
      displayName: entity.displayName === undefined ? undefined : normalizeWorldText(entity.displayName, 128),
      customName: customName === undefined ? undefined : normalizeWorldText(customName, 128),
      type: entity.type,
      timestamp: Date.now(),
    };
  }

  getUntrustedChatMessages(limit = 10): UntrustedChatMessage[] {
    return this.untrustedChatHistory.slice(-limit);
  }

  getPathfinder(): Pathfinder | null {
    if (this.disposed || !this.botInstance) return null;
    return this.botInstance.pathfinder ?? null;
  }

  getMovements(): Movements | null {
    return this.movements;
  }

  getMcData(): IndexedData | null {
    return this.mcData;
  }

  isSpawned(): boolean {
    return Boolean(this.botInstance && this.botInstance.entity);
  }

  isAlive(): boolean {
    return Boolean(this.botInstance && (this.botInstance as unknown as { isAlive?: boolean }).isAlive !== false && this.botInstance.entity);
  }

  getPosition(): { x: number; y: number; z: number } | null {
    if (!this.botInstance?.entity?.position) return null;
    const { x, y, z } = this.botInstance.entity.position;
    return { x, y, z };
  }

  private _movement?: MovementService;
  private _blocks?: BlocksService;
  private _inventory?: InventoryService;
  private _world?: WorldService;
  private _chat?: ChatService;
  private _crafting?: CraftingService;

  get movement(): MovementService {
    if (!this._movement) {
      this._movement = new MovementService(() => this.getBot());
    }
    return this._movement;
  }

  get blocks(): BlocksService {
    if (!this._blocks) {
      this._blocks = new BlocksService(() => this.getBot());
    }
    return this._blocks;
  }

  get inventory(): InventoryService {
    if (!this._inventory) {
      this._inventory = new InventoryService(() => this.getBot());
    }
    return this._inventory;
  }

  get world(): WorldService {
    if (!this._world) {
      this._world = new WorldService(() => this.getBot());
    }
    return this._world;
  }

  get chat(): ChatService {
    if (!this._chat) {
      if (!this.messageStore) {
        this.messageStore = new MessageStoreClass();
      }
      this._chat = new ChatService(() => this.getBot(), this.messageStore);
    }
    return this._chat;
  }

  get crafting(): CraftingService {
    if (!this._crafting) {
      this._crafting = new CraftingService(() => this.getBot());
    }
    return this._crafting;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  getStatus(): SessionStatus {
    if (this.disposed) return 'closed';
    if (this.isSpawned()) return 'active';
    return 'initializing';
  }

  isActive(): boolean {
    return !this.disposed && this.botInstance !== null;
  }

  private registerListener(emitter: EventEmitter, event: string, listener: (...args: unknown[]) => void): void {
    emitter.on(event, listener);
    this.trackedListeners.push({ emitter, event, listener });
  }

  cleanup(reason = 'Session disposed'): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const { emitter, event, listener } of this.trackedListeners) {
      try {
        emitter.removeListener(event, listener);
      } catch {
        // ignore listener cleanup error
      }
    }
    this.trackedListeners = [];

    if (this.botInstance) {
      try {
        if (typeof this.botInstance.quit === 'function') {
          this.botInstance.quit(reason);
        }
      } catch (err) {
        log('warn', `Error while quitting bot in session ${this.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      this.botInstance = null;
    }

    this.mcData = null;
    this.movements = null;
    this.untrustedChatHistory = [];
  }

  close(reason = 'Session closed'): void {
    this.cleanup(reason);
  }
}

export { BotSession as AgentSession };
