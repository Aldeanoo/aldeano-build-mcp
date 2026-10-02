import type { Bot } from 'mineflayer';
import type {
  BotSessionConfig,
  RuntimeStatus,
  RuntimeHealth,
} from './runtime-types.js';
import { ConnectionStatus } from './runtime-types.js';
import { RuntimeEventEmitter, type RuntimeEvents, type RuntimeEventName } from './runtime-events.js';
import { BotSession } from './bot-session.js';
import { ConnectionManager } from './connection-manager.js';
import { DEFAULT_CONFIG, loadConfig } from '../config/index.js';
import { logger } from '../logger/index.js';
import { BotNotReadyError } from '../errors/index.js';

/**
 * Central MinecraftRuntime singleton and manager.
 * Decouples MCP tools, Dev Shell, and other components from direct Mineflayer coupling.
 */
export class MinecraftRuntime {
  private static instance: MinecraftRuntime | null = null;

  public readonly events: RuntimeEventEmitter;
  private connectionManager: ConnectionManager;
  private currentConfig: BotSessionConfig;

  constructor(options?: Partial<BotSessionConfig>) {
    this.events = new RuntimeEventEmitter();
    this.currentConfig = this.resolveConfig(options);
    this.connectionManager = new ConnectionManager({
      config: this.currentConfig,
      events: this.events,
    });

    this.events.on('statusChange', (newStatus, oldStatus) => {
      logger.info(`Status transition: ${oldStatus} -> ${newStatus}`);
    });
  }

  /**
   * Get or create the global MinecraftRuntime singleton.
   */
  public static getInstance(config?: Partial<BotSessionConfig>): MinecraftRuntime {
    if (!MinecraftRuntime.instance) {
      MinecraftRuntime.instance = new MinecraftRuntime(config);
    }
    return MinecraftRuntime.instance;
  }

  /**
   * Reset the global singleton instance, disconnecting if currently active.
   */
  public static async resetInstance(): Promise<void> {
    if (MinecraftRuntime.instance) {
      await MinecraftRuntime.instance.disconnect();
      MinecraftRuntime.instance = null;
    }
  }

  /**
   * Resolve runtime configuration with fallback to environment / loaded config and defaults.
   */
  private resolveConfig(options?: Partial<BotSessionConfig>): BotSessionConfig {
    const defaultHost = DEFAULT_CONFIG?.host ?? 'localhost';
    const defaultPort = DEFAULT_CONFIG?.port ?? 25565;
    const defaultUsername = DEFAULT_CONFIG?.username ?? 'LLMBot';
    const defaultAuth: 'offline' | 'microsoft' = DEFAULT_CONFIG?.auth === 'microsoft' ? 'microsoft' : 'offline';
    const defaultReconnect = DEFAULT_CONFIG?.reconnect ?? true;
    const defaultAttempts = DEFAULT_CONFIG?.reconnectAttempts ?? 10;
    const defaultTimeout = DEFAULT_CONFIG?.connectTimeout ?? 30000;

    let fileOrEnvConfig: Partial<BotSessionConfig> = {};
    try {
      const loaded = loadConfig();
      if (loaded) {
        const auth: 'offline' | 'microsoft' = loaded.auth === 'microsoft' ? 'microsoft' : 'offline';
        fileOrEnvConfig = {
          host: loaded.host,
          port: loaded.port,
          username: loaded.username,
          version: loaded.version,
          auth,
          reconnect: loaded.reconnect,
          maxReconnectAttempts: loaded.reconnectAttempts,
          connectTimeoutMs: loaded.connectTimeout,
        };
      }
    } catch {
      // Config file or schema error, fallback to defaults
    }

    return {
      host: options?.host ?? fileOrEnvConfig.host ?? defaultHost,
      port: options?.port ?? fileOrEnvConfig.port ?? defaultPort,
      username: options?.username ?? fileOrEnvConfig.username ?? defaultUsername,
      auth: options?.auth ?? fileOrEnvConfig.auth ?? defaultAuth,
      version: options?.version ?? fileOrEnvConfig.version,
      reconnect: options?.reconnect ?? fileOrEnvConfig.reconnect ?? defaultReconnect,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? fileOrEnvConfig.maxReconnectAttempts ?? defaultAttempts,
      reconnectDelayMs: options?.reconnectDelayMs ?? 2000,
      reconnectBackoffMultiplier: options?.reconnectBackoffMultiplier ?? 1.5,
      maxReconnectDelayMs: options?.maxReconnectDelayMs ?? 30000,
      connectTimeoutMs: options?.connectTimeoutMs ?? fileOrEnvConfig.connectTimeoutMs ?? defaultTimeout,
      spawnTimeoutMs: options?.spawnTimeoutMs ?? 30000,
      pingIntervalMs: options?.pingIntervalMs ?? 15000,
      plugins: options?.plugins,
    };
  }

  /**
   * Connect to Minecraft server and return the ready BotSession.
   */
  async connect(options?: Partial<BotSessionConfig>): Promise<BotSession> {
    if (options && Object.keys(options).length > 0) {
      const mergedConfig = this.resolveConfig({ ...this.currentConfig, ...options });
      // If config changed, disconnect existing if connected and create new manager
      if (
        mergedConfig.host !== this.currentConfig.host ||
        mergedConfig.port !== this.currentConfig.port ||
        mergedConfig.username !== this.currentConfig.username
      ) {
        await this.disconnect();
        this.currentConfig = mergedConfig;
        this.connectionManager = new ConnectionManager({
          config: this.currentConfig,
          events: this.events,
        });
      }
    }

    logger.info(`Connecting to ${this.currentConfig.host}:${this.currentConfig.port} as ${this.currentConfig.username}`);
    return this.connectionManager.connect();
  }

  /**
   * Disconnect cleanly from the server.
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting runtime...');
    await this.connectionManager.disconnect();
  }

  /**
   * Reconnect to the server.
   */
  async reconnect(): Promise<BotSession> {
    logger.info('Reconnecting runtime...');
    return this.connectionManager.reconnect();
  }

  /**
   * Get active BotSession or null if not connected.
   */
  getSession(): BotSession | null {
    return this.connectionManager.getSession();
  }

  /**
   * Get active BotSession or throw BotNotReadyError if not connected.
   */
  requireSession(): BotSession {
    const session = this.getSession();
    if (!session || !session.isActive()) {
      throw new BotNotReadyError('Minecraft bot session is not active or ready');
    }
    return session;
  }

  /**
   * Get underlying Mineflayer bot instance or null if not connected.
   */
  getBot(): Bot | null {
    return this.connectionManager.getBot();
  }

  /**
   * Get current runtime connection and network status.
   */
  getStatus(): RuntimeStatus {
    return this.connectionManager.getStatus();
  }

  /**
   * Get health metrics for the runtime and bot.
   */
  async health(): Promise<RuntimeHealth> {
    return this.connectionManager.getHealth();
  }

  /**
   * Wait for bot to be ready/spawned.
   */
  async waitForReady(timeoutMs?: number): Promise<BotSession> {
    return this.connectionManager.waitForReady(timeoutMs);
  }

  /**
   * Check if bot is currently connected.
   */
  isConnected(): boolean {
    const status = this.connectionManager.getConnectionStatus();
    return status === ConnectionStatus.READY || status === ConnectionStatus.CONNECTED;
  }

  /**
   * Check if bot is ready to receive commands.
   */
  isReady(): boolean {
    return this.connectionManager.getConnectionStatus() === ConnectionStatus.READY;
  }

  /**
   * Service accessors delegating to current active session.
   */
  get movement() {
    return this.requireSession().movement;
  }

  get blocks() {
    return this.requireSession().blocks;
  }

  get inventory() {
    return this.requireSession().inventory;
  }

  get world() {
    return this.requireSession().world;
  }

  get chat() {
    return this.requireSession().chat;
  }

  get crafting() {
    return this.requireSession().crafting;
  }

  // Event emitter delegation methods
  on<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    this.events.on(event, listener);
    return this;
  }

  once<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    this.events.once(event, listener);
    return this;
  }

  off<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    this.events.off(event, listener);
    return this;
  }

  removeListener<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    this.events.removeListener(event, listener);
    return this;
  }
}
