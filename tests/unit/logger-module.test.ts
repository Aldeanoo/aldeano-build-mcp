import test from 'ava';
import { Writable } from 'node:stream';
import { Logger, log } from '../../src/logger/index.js';

class MemoryStream extends Writable {
  public output = '';

  override _write(chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.output += String(chunk);
    callback();
  }
}

test('Logger defaults to debug or env level and allows get/setLevel', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ stream });

  t.is(logger.getLevel(), 'debug');

  logger.setLevel('warn');
  t.is(logger.getLevel(), 'warn');

  logger.setLevel('info');
  t.is(logger.getLevel(), 'info');
});

test('Logger filters messages based on priority level', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ level: 'warn', stream });

  logger.trace('Trace message');
  logger.debug('Debug message');
  logger.info('Info message');
  logger.warn('Warn message');
  logger.error('Error message');

  t.false(stream.output.includes('Trace message'));
  t.false(stream.output.includes('Debug message'));
  t.false(stream.output.includes('Info message'));
  t.true(stream.output.includes('Warn message'));
  t.true(stream.output.includes('Error message'));
});

test('Logger trace level enables all log calls', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ level: 'trace', stream });

  logger.trace('T1');
  logger.debug('D1');
  logger.info('I1');
  logger.warn('W1');
  logger.error('E1');

  t.true(stream.output.includes('[trace] T1'));
  t.true(stream.output.includes('[debug] D1'));
  t.true(stream.output.includes('[info] I1'));
  t.true(stream.output.includes('[warn] W1'));
  t.true(stream.output.includes('[error] E1'));
});

test('Logger info level enables error, warn, and info, but filters debug and trace', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ level: 'info', stream });

  logger.trace('T2');
  logger.debug('D2');
  logger.info('I2');
  logger.warn('W2');
  logger.error('E2');

  t.false(stream.output.includes('T2'));
  t.false(stream.output.includes('D2'));
  t.true(stream.output.includes('[info] I2'));
  t.true(stream.output.includes('[warn] W2'));
  t.true(stream.output.includes('[error] E2'));
});

test('Logger formats contextual data as JSON suffix', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ level: 'debug', stream });

  logger.info('Player joined', { player: 'Steve', dimension: 'overworld' });

  t.true(stream.output.includes('[info] Player joined {"player":"Steve","dimension":"overworld"}\n'));
});

test('Logger format without context omits trailing space', (t) => {
  const stream = new MemoryStream();
  const logger = new Logger({ level: 'debug', stream });

  logger.info('Simple message');

  t.regex(stream.output, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[minecraft\] \[mcp-server\] \[info\] Simple message\n$/);
});

test('Logger writes strictly to process.stderr by default', (t) => {
  const originalStderrWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;
  let stderrOutput = '';
  let stdoutOutput = '';

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  const defaultLogger = new Logger({ level: 'info' });
  defaultLogger.info('Stderr destination check');

  t.true(stderrOutput.includes('Stderr destination check'));
  t.is(stdoutOutput, '');

  process.stderr.write = originalStderrWrite;
  process.stdout.write = originalStdoutWrite;
});

test('log export maintains backward compatibility', (t) => {
  const originalStderrWrite = process.stderr.write;
  let captured = '';

  process.stderr.write = ((chunk: string | Uint8Array) => {
    captured += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  log('info', 'Global log test');
  t.true(captured.includes('[info] Global log test'));

  process.stderr.write = originalStderrWrite;
});
