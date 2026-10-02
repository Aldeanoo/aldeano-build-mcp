/**
 * Connection states for Minecraft bot and runtime.
 */
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  READY = 'READY',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * Runtime status descriptor reflecting connection details, host, port, ping, and last error.
 */
export interface RuntimeStatus {
  status: ConnectionStatus;
  username?: string;
  host: string;
  port: number;
  ping?: number;
  error?: string;
}

/**
 * Detailed runtime health metrics.
 */
export interface RuntimeHealth {
  minecraft: boolean;
  spawned: boolean;
  pathfinder: boolean;
  username?: string;
  version?: string;
  position?: { x: number; y: number; z: number };
  status: ConnectionStatus;
}

/**
 * Configuration options for bot session creation and connection.
 */
export interface BotSessionConfig {
  host: string;
  port: number;
  username: string;
  auth?: 'offline' | 'microsoft';
  version?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectDelayMs?: number;
  connectTimeoutMs?: number;
  spawnTimeoutMs?: number;
  pingIntervalMs?: number;
  plugins?: Record<string, unknown>;
}

/**
 * Options for configuring or overriding agent session properties.
 */
export type AgentSessionOptions = Partial<BotSessionConfig>;

/**
 * Untrusted world input security baseline envelope.
 * All incoming messages, chat, signs, entity names originating from the
 * Minecraft world must be marked with source 'minecraft_world' and trusted false.
 */
export interface UntrustedContent<T = string> {
  source: 'minecraft_world';
  trusted: false;
  content: T;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UntrustedChatMessage {
  source: 'minecraft_world';
  trusted: false;
  username: string;
  message: string;
  timestamp: number;
}

export interface UntrustedSignText {
  source: 'minecraft_world';
  trusted: false;
  lines: string[];
  position?: { x: number; y: number; z: number };
  timestamp: number;
}

export interface UntrustedEntityInfo {
  source: 'minecraft_world';
  trusted: false;
  id: number;
  name?: string;
  displayName?: string;
  customName?: string;
  type?: string;
  timestamp: number;
}
