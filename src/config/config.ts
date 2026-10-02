import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AldeanoConfigSchema, type AldeanoConfig, type LogLevel } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { ValidationError } from '../errors/index.js';

let cachedConfig: AldeanoConfig | null = null;

function parseBoolean(val: string | undefined): boolean | undefined {
  if (val === undefined) return undefined;
  const lower = val.trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return undefined;
}

function parseNumber(val: string | undefined): number | undefined {
  if (val === undefined || val.trim() === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Loads configuration with precedence:
 * CLI arguments -> Environment variables -> Default configuration
 *
 * @param cliArgs Optional explicit CLI arguments (defaults to process.argv)
 */
export function loadConfig(cliArgs?: string[]): AldeanoConfig {
  const args = cliArgs !== undefined ? cliArgs : hideBin(process.argv);

  const argv = yargs(args)
    .version(false)
    .help(false)
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
    })
    .option('username', {
      type: 'string',
      description: 'Bot username (default: MCPBot)',
    })
    .option('version', {
      type: 'string',
      description: 'Minecraft version (e.g. 1.20.4)',
    })
    .option('auth', {
      type: 'string',
      description: 'Authentication type (offline/microsoft)',
    })
    .option('connect-timeout', {
      type: 'number',
      alias: 'connectTimeout',
      description: 'Connection timeout in milliseconds',
    })
    .option('reconnect', {
      type: 'boolean',
      description: 'Auto-reconnect on disconnect',
    })
    .option('reconnect-attempts', {
      type: 'number',
      alias: 'reconnectAttempts',
      description: 'Max reconnect attempts',
    })
    .option('log-level', {
      type: 'string',
      alias: 'logLevel',
      choices: ['error', 'warn', 'info', 'debug', 'trace'],
      description: 'Log level',
    })
    .parseSync() as Record<string, unknown>;

  // Host: CLI -> MC_HOST -> DEFAULT
  const host = (typeof argv.host === 'string' && argv.host.trim() !== '' ? argv.host.trim() : undefined)
    ?? (process.env.MC_HOST && process.env.MC_HOST.trim() !== '' ? process.env.MC_HOST.trim() : undefined)
    ?? DEFAULT_CONFIG.host;

  // Port: CLI -> MC_PORT -> DEFAULT
  const portCli = typeof argv.port === 'number' && Number.isFinite(argv.port) ? argv.port : undefined;
  const port = portCli
    ?? parseNumber(process.env.MC_PORT)
    ?? DEFAULT_CONFIG.port;

  // Username: CLI -> MC_USERNAME -> DEFAULT
  const username = (typeof argv.username === 'string' && argv.username.trim() !== '' ? argv.username.trim() : undefined)
    ?? (process.env.MC_USERNAME && process.env.MC_USERNAME.trim() !== '' ? process.env.MC_USERNAME.trim() : undefined)
    ?? DEFAULT_CONFIG.username;

  // Version: CLI -> MC_VERSION -> DEFAULT
  const version = (typeof argv.version === 'string' && argv.version.trim() !== '' ? argv.version.trim() : undefined)
    ?? (process.env.MC_VERSION && process.env.MC_VERSION.trim() !== '' ? process.env.MC_VERSION.trim() : undefined)
    ?? DEFAULT_CONFIG.version;

  // Auth: CLI -> MC_AUTH -> DEFAULT
  const auth = (typeof argv.auth === 'string' && argv.auth.trim() !== '' ? argv.auth.trim() : undefined)
    ?? (process.env.MC_AUTH && process.env.MC_AUTH.trim() !== '' ? process.env.MC_AUTH.trim() : undefined)
    ?? DEFAULT_CONFIG.auth;

  // Connect Timeout: CLI -> MC_CONNECT_TIMEOUT -> DEFAULT
  const connectTimeoutCli = (typeof argv.connectTimeout === 'number' && Number.isFinite(argv.connectTimeout) ? argv.connectTimeout : undefined)
    ?? (typeof argv['connect-timeout'] === 'number' && Number.isFinite(argv['connect-timeout'] as number) ? (argv['connect-timeout'] as number) : undefined);
  const connectTimeout = connectTimeoutCli
    ?? parseNumber(process.env.MC_CONNECT_TIMEOUT)
    ?? DEFAULT_CONFIG.connectTimeout;

  // Reconnect: CLI -> MC_RECONNECT -> DEFAULT
  const reconnectCli = typeof argv.reconnect === 'boolean' ? argv.reconnect : undefined;
  const reconnect = reconnectCli
    ?? parseBoolean(process.env.MC_RECONNECT)
    ?? DEFAULT_CONFIG.reconnect;

  // Reconnect Attempts: CLI -> MC_RECONNECT_ATTEMPTS -> DEFAULT
  const reconnectAttemptsCli = (typeof argv.reconnectAttempts === 'number' && Number.isFinite(argv.reconnectAttempts) ? argv.reconnectAttempts : undefined)
    ?? (typeof argv['reconnect-attempts'] === 'number' && Number.isFinite(argv['reconnect-attempts'] as number) ? (argv['reconnect-attempts'] as number) : undefined);
  const reconnectAttempts = reconnectAttemptsCli
    ?? parseNumber(process.env.MC_RECONNECT_ATTEMPTS)
    ?? DEFAULT_CONFIG.reconnectAttempts;

  // Log Level: CLI -> LOG_LEVEL / MC_LOG_LEVEL -> DEFAULT
  const rawLogLevel = (typeof argv.logLevel === 'string' && argv.logLevel.trim() !== '' ? argv.logLevel.trim() : undefined)
    ?? (typeof argv['log-level'] === 'string' && (argv['log-level'] as string).trim() !== '' ? (argv['log-level'] as string).trim() : undefined)
    ?? (process.env.LOG_LEVEL && process.env.LOG_LEVEL.trim() !== '' ? process.env.LOG_LEVEL.trim() : undefined)
    ?? (process.env.MC_LOG_LEVEL && process.env.MC_LOG_LEVEL.trim() !== '' ? process.env.MC_LOG_LEVEL.trim() : undefined)
    ?? DEFAULT_CONFIG.logLevel;

  const logLevel = rawLogLevel.toLowerCase() as LogLevel;

  const rawConfig = {
    host,
    port,
    username,
    version,
    auth,
    connectTimeout,
    reconnect,
    reconnectAttempts,
    logLevel,
  };

  const validation = AldeanoConfigSchema.safeParse(rawConfig);
  if (!validation.success) {
    const errorDetails = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(`Configuration validation failed: ${errorDetails}`, { errors: validation.error.errors });
  }

  cachedConfig = validation.data;
  return cachedConfig;
}

/**
 * Retrieves the currently loaded configuration, or loads it if not yet initialized.
 */
export function getConfig(): AldeanoConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/**
 * Updates the active configuration with overrides and validates the resulting config.
 */
export function setConfig(overrides: Partial<AldeanoConfig>): AldeanoConfig {
  const current = getConfig();
  const merged = { ...current, ...overrides };
  const validation = AldeanoConfigSchema.safeParse(merged);
  if (!validation.success) {
    const errorDetails = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(`Invalid configuration update: ${errorDetails}`, { errors: validation.error.errors });
  }
  cachedConfig = validation.data;
  return cachedConfig;
}

/**
 * Resets the cached configuration to force reload on subsequent getConfig calls.
 */
export function resetConfig(): void {
  cachedConfig = null;
}
