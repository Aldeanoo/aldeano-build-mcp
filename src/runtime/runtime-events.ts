import { EventEmitter } from 'node:events';
import type { ConnectionStatus, RuntimeHealth } from './runtime-types.js';
import type { BotSession } from './bot-session.js';

export interface RuntimeEvents {
  statusChange: (newStatus: ConnectionStatus, oldStatus: ConnectionStatus) => void;
  connected: (session: BotSession) => void;
  spawned: (session: BotSession) => void;
  disconnected: (reason?: string) => void;
  error: (error: Error) => void;
  chat: (username: string, message: string, trusted: boolean) => void;
  healthUpdate: (health: RuntimeHealth) => void;
}

export type RuntimeEventName = keyof RuntimeEvents;

/**
 * Strongly typed EventEmitter for Minecraft runtime and bot lifecycle events.
 */
export class RuntimeEventEmitter extends EventEmitter {
  override on<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  override addListener<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.addListener(event, listener as (...args: unknown[]) => void);
  }

  override prependListener<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.prependListener(event, listener as (...args: unknown[]) => void);
  }

  override prependOnceListener<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.prependOnceListener(event, listener as (...args: unknown[]) => void);
  }

  override emit<E extends RuntimeEventName>(event: E, ...args: Parameters<RuntimeEvents[E]>): boolean {
    return super.emit(event, ...args);
  }

  override off<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override removeListener<E extends RuntimeEventName>(event: E, listener: RuntimeEvents[E]): this {
    return super.removeListener(event, listener as (...args: unknown[]) => void);
  }
}
