import type { AldeanoConfig } from './schema.js';

export const DEFAULT_CONFIG: AldeanoConfig = {
  host: '127.0.0.1',
  port: 25565,
  username: 'MCPBot',
  version: '1.20.4',
  auth: 'offline',
  connectTimeout: 30000,
  reconnect: true,
  reconnectAttempts: 5,
  logLevel: 'info',
};
