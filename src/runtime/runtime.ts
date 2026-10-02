import { ServerConfig, parseConfig } from '../config.js';
import { BotConnection } from '../bot-connection.js';
import { BotSession } from './bot-session.js';
import { MessageStore } from '../message-store.js';
import { log } from '../logger.js';
import { ConnectionError, BotNotReadyError, BotNotConnectedError } from '../errors/index.js';
import { MovementService } from '../services/movement-service.js';
import { BlocksService } from '../services/blocks-service.js';
import { InventoryService } from '../services/inventory-service.js';
import { WorldService } from '../services/world-service.js';
import { ChatService } from '../services/chat-service.js';
import { CraftingService } from '../services/crafting-service.js';

export interface RuntimeOptions {
  config?: ServerConfig;
  messageStore?: MessageStore;
  autoConnect?: boolean;
}

export interface RuntimeStatus {
  connected: boolean;
  state: 'connected' | 'connecting' | 'disconnected';
  host: string;
  port: number;
  username: string;
  botSpawned: boolean;
  position: { x: number; y: number; z: number } | null;
  health: number | null;
  food: number | null;
  gamemode: string;
  dimension: string;
  difficulty: string;
  isAlive: boolean;
  inventoryCount: number;
  ping: number | null;
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  state: 'connected' | 'connecting' | 'disconnected';
  botSpawned: boolean;
  uptimeSeconds: number;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  bot: {
    isAlive: boolean;
    health: number | null;
    food: number | null;
    ping: number | null;
  };
  server: {
    host: string;
    port: number;
    version: string;
  };
  summary: string;
}

export class MinecraftRuntime {
  private config: ServerConfig;
  private messageStore: MessageStore;
  private connection: BotConnection;
  private session: BotSession | null = null;
  private isShuttingDown = false;

  public readonly movement: MovementService;
  public readonly blocks: BlocksService;
  public readonly inventory: InventoryService;
  public readonly world: WorldService;
  public readonly chat: ChatService;
  public readonly crafting: CraftingService;

  constructor(options: RuntimeOptions = {}) {
    this.config = options.config ?? parseConfig();
    this.messageStore = options.messageStore ?? new MessageStore();

    this.connection = new BotConnection(
      this.config,
      {
        onLog: log,
        onChatMessage: (username, message) => this.messageStore.addMessage(username, message)
      }
    );

    const getBot = () => {
      const b = this.connection.getBot();
      if (!b) throw new BotNotConnectedError('Minecraft bot is not connected');
      return b;
    };

    this.movement = new MovementService(getBot);
    this.blocks = new BlocksService(getBot);
    this.inventory = new InventoryService(getBot);
    this.world = new WorldService(getBot);
    this.chat = new ChatService(getBot, this.messageStore);
    this.crafting = new CraftingService(getBot);

    if (options.autoConnect) {
      this.connect();
    }
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  getMessageStore(): MessageStore {
    return this.messageStore;
  }

  getConnection(): BotConnection {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  getState(): 'connected' | 'connecting' | 'disconnected' {
    return this.connection.getState();
  }

  getSession(): BotSession | null {
    const bot = this.connection.getBot();
    if (!bot || !this.connection.isConnected()) {
      return null;
    }
    if (!this.session || this.session.getBotOrNull() !== bot) {
      this.session = new BotSession(bot, this.messageStore);
    }
    return this.session;
  }

  requireSession(): BotSession {
    const session = this.getSession();
    if (!session) {
      throw new BotNotReadyError('Minecraft bot session is not active or connected');
    }
    return session;
  }

  connect(): void {
    this.connection.connect();
  }

  async waitForReady(timeoutMs = 15000): Promise<BotSession> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.connection.isConnected()) {
        const session = this.getSession();
        if (session) return session;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new ConnectionError(`Bot failed to connect and spawn within ${timeoutMs}ms`);
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    if (this.session) {
      this.session.close('Runtime disconnected');
      this.session = null;
    }
    this.connection.cleanup();
  }

  getStatus(): RuntimeStatus {
    const isConn = this.connection.isConnected();
    const state = this.connection.getState();
    const bot = this.connection.getBot();

    const position = bot?.entity?.position
      ? {
          x: Math.floor(bot.entity.position.x),
          y: Math.floor(bot.entity.position.y),
          z: Math.floor(bot.entity.position.z),
        }
      : null;

    const inventoryCount = bot?.inventory ? bot.inventory.items().length : 0;
    const clientLatency = (bot as unknown as { _client?: { latency?: number } })?._client?.latency ?? null;
    const isAlive = bot ? Boolean((bot as unknown as { isAlive?: boolean }).isAlive !== false && bot.entity) : false;

    return {
      connected: isConn,
      state,
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      botSpawned: !!bot,
      position,
      health: bot?.health ?? null,
      food: bot?.food ?? null,
      gamemode: bot?.game?.gameMode ?? 'unknown',
      dimension: bot?.game?.dimension ?? 'unknown',
      difficulty: bot?.game?.difficulty ?? 'unknown',
      isAlive,
      inventoryCount,
      ping: clientLatency,
    };
  }

  getHealth(): RuntimeHealth {
    const isConn = this.connection.isConnected();
    const state = this.connection.getState();
    const bot = this.connection.getBot();
    const mem = process.memoryUsage();
    const clientLatency = (bot as unknown as { _client?: { latency?: number } })?._client?.latency ?? null;
    const isAlive = bot ? Boolean((bot as unknown as { isAlive?: boolean }).isAlive !== false && bot.entity) : false;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let summary = 'Runtime and bot connection are fully operational.';

    if (!isConn) {
      if (state === 'connecting') {
        status = 'degraded';
        summary = 'Bot is attempting to connect to the Minecraft server.';
      } else {
        status = 'unhealthy';
        summary = 'Bot is disconnected from the Minecraft server.';
      }
    } else if (!bot || !isAlive) {
      status = 'degraded';
      summary = 'Bot is connected but not spawned or alive in world.';
    } else if (bot.health !== undefined && bot.health <= 0) {
      status = 'degraded';
      summary = 'Bot health is at zero (dead).';
    }

    return {
      status,
      connected: isConn,
      state,
      botSpawned: !!bot,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      },
      bot: {
        isAlive,
        health: bot?.health ?? null,
        food: bot?.food ?? null,
        ping: clientLatency,
      },
      server: {
        host: this.config.host,
        port: this.config.port,
        version: bot?.version ?? (this.config.version as string) ?? 'unknown',
      },
      summary,
    };
  }
}
