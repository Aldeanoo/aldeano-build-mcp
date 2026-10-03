// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLogLevel: LogLevel = 'debug';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

export function shouldLog(level: string): boolean {
  const normLevel = level.toLowerCase() as LogLevel;
  const targetSeverity = LOG_SEVERITY[normLevel] ?? 1;
  const currentSeverity = LOG_SEVERITY[currentLogLevel] ?? 0;
  return targetSeverity >= currentSeverity;
}

export function log(level: string, message: string): void {
  if (!shouldLog(level)) {
    return;
  }
  const timestamp = new Date().toISOString();
  process.stderr.write(`${timestamp} [minecraft] [mcp-server] [${level}] ${message}\n`);
}

export const logger = {
  debug: (message: string) => log('debug', message),
  info: (message: string) => log('info', message),
  warn: (message: string) => log('warn', message),
  error: (message: string) => log('error', message),
  setLevel: setLogLevel,
  getLevel: getLogLevel
};
