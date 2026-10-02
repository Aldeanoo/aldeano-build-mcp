export type ErrorContext = Record<string, unknown>;

export class AldeanoError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code = 'ALDEANO_ERROR',
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): {
    name: string;
    message: string;
    code: string;
    context: Record<string, unknown>;
    timestamp: string;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

export class BotNotConnectedError extends AldeanoError {
  constructor(
    message = 'Bot is not connected to a Minecraft server',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'BOT_NOT_CONNECTED', context);
  }
}

export class BotNotReadyError extends BotNotConnectedError {
  constructor(message = 'Bot is not ready', context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class MinecraftConnectionError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'MINECRAFT_CONNECTION_ERROR', context);
  }
}

export class ConnectionError extends MinecraftConnectionError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class TimeoutError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'TIMEOUT_ERROR', context);
  }
}

export class ConnectionTimeoutError extends TimeoutError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class MaxReconnectAttemptsError extends MinecraftConnectionError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class SessionDisposedError extends AldeanoError {
  constructor(sessionId?: string, context: Record<string, unknown> = {}) {
    super(
      sessionId ? `Session ${sessionId} is disposed` : 'Session is disposed',
      'SESSION_DISPOSED',
      context
    );
  }
}

export class ValidationError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

export class UnsupportedVersionError extends AldeanoError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'UNSUPPORTED_VERSION_ERROR', context);
  }
}
