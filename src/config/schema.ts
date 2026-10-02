import { z } from 'zod';

export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const AuthModeSchema = z.enum(['offline', 'microsoft']).or(z.string());
export type AuthMode = 'offline' | 'microsoft' | string;

export const AldeanoConfigSchema = z.object({
  host: z.string().min(1, 'Host cannot be empty'),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  username: z.string().min(1, 'Username cannot be empty'),
  version: z.string().min(1, 'Version cannot be empty'),
  auth: z.string().min(1, 'Auth mode cannot be empty'),
  connectTimeout: z.number().positive('Connect timeout must be positive'),
  reconnect: z.boolean(),
  reconnectAttempts: z.number().int().min(0, 'Reconnect attempts must be non-negative'),
  logLevel: LogLevelSchema,
});

export type AldeanoConfig = z.infer<typeof AldeanoConfigSchema>;
