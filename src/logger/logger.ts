export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type LogContext = Record<string, unknown>;

export const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const VALID_LEVELS = new Set<string>(['error', 'warn', 'info', 'debug', 'trace']);

function parseLogLevel(val: string | undefined): LogLevel | undefined {
  if (!val) return undefined;
  const lower = val.trim().toLowerCase();
  return VALID_LEVELS.has(lower) ? (lower as LogLevel) : undefined;
}

export interface LoggerOptions {
  level?: LogLevel;
  stream?: NodeJS.WritableStream;
}

/**
 * Standard leveled logger for Aldeano MCP.
 * Directs all logs strictly to process.stderr to protect MCP stdout JSON-RPC stream.
 */
export class Logger {
  private currentLevel: LogLevel;
  private stream: NodeJS.WritableStream;

  constructor(options: LoggerOptions = {}) {
    const envLevel = parseLogLevel(process.env.LOG_LEVEL) ?? parseLogLevel(process.env.MC_LOG_LEVEL);
    this.currentLevel = options.level ?? envLevel ?? 'debug';
    this.stream = options.stream ?? process.stderr;
  }

  public setLevel(level: LogLevel): void {
    if (VALID_LEVELS.has(level.toLowerCase())) {
      this.currentLevel = level.toLowerCase() as LogLevel;
    }
  }

  public getLevel(): LogLevel {
    return this.currentLevel;
  }

  public isLevelEnabled(level: string): boolean {
    const priority = LOG_LEVEL_PRIORITIES[level.toLowerCase() as LogLevel];
    if (priority === undefined) {
      return true;
    }
    return priority <= LOG_LEVEL_PRIORITIES[this.currentLevel];
  }

  public writeRaw(level: string, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const contextStr = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    this.stream.write(`${timestamp} [minecraft] [mcp-server] [${level}] ${message}${contextStr}\n`);
  }

  public log(level: LogLevel | string, message: string, context?: LogContext): void {
    if (this.isLevelEnabled(level)) {
      this.writeRaw(level, message, context);
    }
  }

  public error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  public trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }
}

// Global logger instance
export const logger = new Logger();

/**
 * Backward-compatible logging function.
 * Respects log level configuration and routes to stderr.
 */
export function log(level: string, message: string, context?: LogContext): void {
  logger.log(level, message, context);
}
