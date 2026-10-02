import { loadConfig, type AldeanoConfig } from './config/index.js';

export * from './config/index.js';

export interface ServerConfig {
  host: string;
  port: number;
  username: string;
  [key: string]: unknown;
}

/**
 * Backward compatibility wrapper delegating to loadConfig()
 */
export function parseConfig(cliArgs?: string[]): ServerConfig & AldeanoConfig {
  return loadConfig(cliArgs);
}
