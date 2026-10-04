import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import type { BotSessionConfig, RuntimeStatus, RuntimeHealth } from './runtime-types.js';
import { ConnectionStatus } from './runtime-types.js';
import { BotSession } from './bot-session.js';
import { RuntimeEventEmitter } from './runtime-events.js';
import {
  ConnectionError,
  ConnectionTimeoutError,
  MaxReconnectAttemptsError,
} from '../errors/index.js';
import { log } from '../logger/index.js';

const { pathfinder } = pathfinderPkg;

export interface ConnectionManagerOptions {
  config: BotSessionConfig;
  events?: RuntimeEventEmitter;
}

/**
 * ConnectionManager coordinates the connection lifecycle, state transitions,
 * auto-reconnect with exponential backoff, ping health checks, and timeouts.
 */
export class ConnectionManager {
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private session: BotSession | null = null;
  private bot: mineflayer.Bot | null = null;
  private readonly config: BotSessionConfig;
  private readonly events: RuntimeEventEmitter;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;
  private lastPing?: number;
  private lastError?: string;

  // Active connection promise to de-duplicate simultaneous connect() calls
  private activeConnectPromise: Promise<BotSession> | null = null;
  private botListenerCleanup: Array<() => void> = [];

  constructor(options: ConnectionManagerOptions) {
    this.config = { ...options.config };
    this.events = options.events ?? new RuntimeEventEmitter();
  }

  getEvents(): RuntimeEventEmitter {
    return this.events;
  }

  getStatus(): RuntimeStatus {
    return {
      status: this.status,
      username: this.session?.username ?? this.config.username,
      host: this.config.host,
      port: this.config.port,
      ping: this.lastPing,
      error: this.lastError,
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getSession(): BotSession | null {
    return this.session;
  }

  getBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getPing(): number | undefined {
    return this.lastPing;
  }

  getHealth(): RuntimeHealth {
    const isSpawned = Boolean(this.session?.isSpawned());
    const position = this.session?.getPosition() ?? undefined;
    return {
      minecraft: this.status === ConnectionStatus.READY || this.status === ConnectionStatus.CONNECTED,
      spawned: isSpawned,
      pathfinder: Boolean(this.session?.getPathfinder()),
      username: this.session?.username ?? this.config.username,
      version: this.bot?.version ?? this.config.version,
      position,
      status: this.status,
    };
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;
    const oldStatus = this.status;
    this.status = newStatus;
    log('info', `Connection status changed: ${oldStatus} -> ${newStatus}`);
    this.events.emit('statusChange', newStatus, oldStatus);

    if (newStatus === ConnectionStatus.READY) {
      this.reconnectAttempts = 0;
      this.lastError = undefined;
    }

    this.events.emit('healthUpdate', this.getHealth());
  }

  /**
   * Connect to Minecraft server and return the ready BotSession.
   */
  async connect(): Promise<BotSession> {
    if (this.status === ConnectionStatus.READY && this.session && !this.session.isDisposed) {
      return this.session;
    }

    if (this.activeConnectPromise) {
      return this.activeConnectPromise;
    }

    this.isIntentionalDisconnect = false;
    this.clearReconnectTimer();

    this.activeConnectPromise = this.executeConnect().finally(() => {
      this.activeConnectPromise = null;
    });

    return this.activeConnectPromise;
  }

  private executeConnect(): Promise<BotSession> {
    return new Promise<BotSession>((resolve, reject) => {
      this.setStatus(ConnectionStatus.CONNECTING);

      const timeoutMs = this.config.connectTimeoutMs ?? 30000;
      let isSettled = false;

      const clearAllTimers = () => {
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
      };

      this.connectTimeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          clearAllTimers();
          const timeoutErr = new ConnectionTimeoutError(
            `Connection attempt timed out after ${timeoutMs}ms connecting to ${this.config.host}:${this.config.port}`,
            { timeoutMs }
          );
          this.lastError = timeoutErr.message;
          this.setStatus(ConnectionStatus.ERROR);
          this.cleanupBotInstance('Connection timeout');
          this.events.emit('error', timeoutErr);
          reject(timeoutErr);
        }
      }, timeoutMs);

      try {
        const botOptions = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          auth: this.config.auth ?? 'offline',
          version: this.config.version,
          plugins: { pathfinder, ...(this.config.plugins || {}) },
        };

        log('info', `Creating Mineflayer bot for ${this.config.username} at ${this.config.host}:${this.config.port}...`);
        const bot = mineflayer.createBot(botOptions);
        this.bot = bot;
        const session = new BotSession(this.config, bot);
        this.session = session;

        const listen = <K extends keyof mineflayer.BotEvents>(
          event: K, listener: mineflayer.BotEvents[K], once = false,
        ) => {
          if (once) bot.once(event, listener);
          else bot.on(event, listener);
          this.botListenerCleanup.push(() => bot.removeListener(event, listener));
        };

        listen('login', () => {
          log('info', `Bot logged in to server (${this.config.host}:${this.config.port})`);
          this.setStatus(ConnectionStatus.CONNECTED);
          this.startPingMonitor();
        }, true);

        listen('spawn', () => {
          log('info', `Bot spawned in Minecraft world as "${this.config.username}"`);
          clearAllTimers();
          session.initPathfinder();
          this.setStatus(ConnectionStatus.READY);

          this.events.emit('connected', session);
          this.events.emit('spawned', session);

          if (!isSettled) {
            isSettled = true;
            resolve(session);
          }
        }, true);

        listen('chat', (username, message) => {
          if (username === bot.username) return;
          this.events.emit('chat', username, message, false);
        });

        listen('kicked', (reason) => {
          const formattedReason = this.formatError(reason);
          log('warn', `Bot kicked from server: ${formattedReason}`);
          this.lastError = `Kicked: ${formattedReason}`;
          this.handleDisconnectOrReconnect(`Kicked: ${formattedReason}`);
        });

        listen('error', (err: Error) => {
          const errorMsg = err?.message || String(err);
          const errorCode = (err as { code?: string }).code;
          this.lastError = errorMsg;
          log('error', `Bot error [${errorCode || 'UNKNOWN'}]: ${errorMsg}`);

          this.events.emit('error', err);

          if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND') {
            this.setStatus(ConnectionStatus.ERROR);
            if (!isSettled) {
              isSettled = true;
              clearAllTimers();
              reject(new ConnectionError(`Connection failed: ${errorMsg}`, { code: errorCode, host: this.config.host, port: this.config.port }));
            }
          }
        });

        listen('end', (reason) => {
          const reasonStr = this.formatError(reason);
          log('info', `Bot connection ended: ${reasonStr}`);
          this.stopPingMonitor();

          if (!isSettled) {
            isSettled = true;
            clearAllTimers();
            reject(new ConnectionError(`Connection ended before spawn: ${reasonStr}`));
          }

          this.handleDisconnectOrReconnect(reasonStr);
        });
      } catch (err) {
        clearAllTimers();
        const errObj = err instanceof Error ? err : new Error(String(err));
        this.lastError = errObj.message;
        this.setStatus(ConnectionStatus.ERROR);
        this.events.emit('error', errObj);
        reject(errObj);
      }
    });
  }

  /**
   * Handle unexpected disconnect and initiate backoff auto-reconnect if enabled.
   */
  private handleDisconnectOrReconnect(reason: string): void {
    if (this.isIntentionalDisconnect) {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.events.emit('disconnected', reason);
      return;
    }

    const autoReconnect = this.config.reconnect !== false;
    const maxAttempts = this.config.maxReconnectAttempts ?? 10;

    if (autoReconnect && this.reconnectAttempts < maxAttempts) {
      this.reconnectAttempts++;
      const baseDelay = this.config.reconnectDelayMs ?? 2000;
      const multiplier = this.config.reconnectBackoffMultiplier ?? 1.5;
      const maxDelay = this.config.maxReconnectDelayMs ?? 30000;
      const delay = Math.min(Math.round(baseDelay * Math.pow(multiplier, this.reconnectAttempts - 1)), maxDelay);

      log('info', `Auto-reconnect attempt ${this.reconnectAttempts}/${maxAttempts} scheduled in ${delay}ms...`);
      this.setStatus(ConnectionStatus.RECONNECTING);

      this.cleanupBotInstance('Reconnecting');

      this.reconnectTimer = setTimeout(() => {
        log('info', `Executing auto-reconnect attempt ${this.reconnectAttempts}/${maxAttempts}...`);
        this.connect().catch((err) => {
          log('warn', `Auto-reconnect attempt ${this.reconnectAttempts} failed: ${err.message}`);
        });
      }, delay);
    } else if (autoReconnect && this.reconnectAttempts >= maxAttempts) {
      log('error', `Max reconnection attempts (${maxAttempts}) reached. Giving up.`);
      this.setStatus(ConnectionStatus.ERROR);
      const maxErr = new MaxReconnectAttemptsError(
        `Max reconnection attempts reached (${maxAttempts}): ${reason}`,
        { attempts: this.reconnectAttempts }
      );
      this.events.emit('error', maxErr);
      this.events.emit('disconnected', `Max reconnection attempts reached: ${reason}`);
    } else {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.events.emit('disconnected', reason);
    }
  }

  /**
   * Manual reconnect: Disconnects current session if any and connects again.
   */
  async reconnect(): Promise<BotSession> {
    log('info', 'Manual reconnect requested');
    await this.disconnect('Manual reconnect');
    this.reconnectAttempts = 0;
    return this.connect();
  }

  /**
   * Wait for session to reach READY status.
   */
  async waitForReady(timeoutMs?: number): Promise<BotSession> {
    if (this.status === ConnectionStatus.READY && this.session && !this.session.isDisposed) {
      return this.session;
    }

    const timeout = timeoutMs ?? this.config.spawnTimeoutMs ?? 30000;

    return new Promise<BotSession>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const onSpawned = (session: BotSession) => {
        if (timer) clearTimeout(timer);
        this.events.removeListener('error', onError);
        resolve(session);
      };

      const onError = (error: Error) => {
        if (timer) clearTimeout(timer);
        this.events.removeListener('spawned', onSpawned);
        reject(error);
      };

      timer = setTimeout(() => {
        this.events.removeListener('spawned', onSpawned);
        this.events.removeListener('error', onError);
        reject(new ConnectionTimeoutError(`Timeout waiting for bot READY after ${timeout}ms`, { timeoutMs: timeout }));
      }, timeout);

      this.events.once('spawned', onSpawned);
      this.events.once('error', onError);
    });
  }

  /**
   * Disconnect cleanly from server.
   */
  async disconnect(reason = 'Disconnected by runtime'): Promise<void> {
    this.isIntentionalDisconnect = true;
    this.clearReconnectTimer();
    this.stopPingMonitor();

    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.cleanupBotInstance(reason);
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.events.emit('disconnected', reason);
  }

  private cleanupBotInstance(reason: string): void {
    for (const removeListener of this.botListenerCleanup) removeListener();
    this.botListenerCleanup = [];
    if (this.session) {
      try {
        this.session.cleanup(reason);
      } catch (err) {
        log('warn', `Error cleaning up session: ${this.formatError(err)}`);
      }
      this.session = null;
    }

    if (this.bot) {
      try {
        if (typeof this.bot.quit === 'function') {
          this.bot.quit(reason);
        }
      } catch (err) {
        log('warn', `Error quitting bot: ${this.formatError(err)}`);
      }
      this.bot = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPingMonitor(): void {
    this.stopPingMonitor();
    const intervalMs = this.config.pingIntervalMs ?? 15000;

    this.pingTimer = setInterval(() => {
      if (this.bot && this.status !== ConnectionStatus.DISCONNECTED) {
        const client = (this.bot as unknown as { _client?: { latency?: number } })._client;
        if (client && typeof client.latency === 'number') {
          this.lastPing = client.latency;
        }
        this.events.emit('healthUpdate', this.getHealth());
      }
    }, intervalMs);
  }

  private stopPingMonitor(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
