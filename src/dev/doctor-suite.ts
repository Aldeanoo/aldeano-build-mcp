import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DoctorStage {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  details: string;
  log?: string;
}

export interface DoctorSuiteReport {
  version: 1;
  timestamp: string;
  mode: 'full' | 'offline';
  status: 'passed' | 'failed' | 'partial';
  durationMs: number;
  stages: DoctorStage[];
  benchmark?: unknown;
  directory: string;
}

export const doctorSteps = [
  { name: 'Build', cli: 'typescript/bin/tsc', args: ['-p', 'tsconfig.build.json'] },
  { name: 'Typecheck', cli: 'typescript/bin/tsc', args: ['--noEmit'] },
  { name: 'Project scripts', cli: 'tsx/dist/cli.mjs', args: ['scripts/check-project-scripts.ts'] },
  { name: 'Lint', cli: 'eslint/bin/eslint.js', args: ['{src,tests,scripts,benchmarks,projects}/**/*.ts'] },
  { name: 'Unit tests', cli: 'ava/entrypoints/cli.mjs', args: ['tests/unit/**/*.test.ts'] }
];

export function offlineUuid(username: string): string {
  const bytes = createHash('md5').update(`OfflinePlayer:${username}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { child.kill(); }, 20_000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.stdin?.write('stop\n');
  });
}

async function startIsolatedServer(root: string, directory: string, signal: AbortSignal): Promise<{ child: ChildProcess; port: number }> {
  const jar = path.join(root, '.dev', 'minecraft', 'server.jar');
  const eula = path.join(root, '.dev', 'minecraft', 'eula.txt');
  if (!existsSync(jar)) throw new Error('Falta server.jar: ejecuta npm run mc:setup primero.');
  if (!existsSync(eula) || !/^eula\s*=\s*true\s*$/m.test(readFileSync(eula, 'utf8'))) throw new Error('Acepta la EULA del servidor local antes de ejecutar la integración.');
  const port = await freePort();
  const serverDirectory = path.join(directory, 'server');
  mkdirSync(serverDirectory, { recursive: true });
  writeFileSync(path.join(serverDirectory, 'eula.txt'), 'eula=true\n', 'utf8');
  writeFileSync(path.join(serverDirectory, 'server.properties'), [
    'server-ip=127.0.0.1', `server-port=${port}`, 'online-mode=false', 'gamemode=creative',
    'force-gamemode=true', 'difficulty=peaceful', 'allow-flight=true', 'spawn-protection=0',
    'level-name=doctor-world', 'level-type=minecraft:flat', 'generate-structures=false',
    'generator-settings={"layers":[{"block":"minecraft:bedrock","height":1},{"block":"minecraft:dirt","height":2},{"block":"minecraft:grass_block","height":1}],"biome":"minecraft:plains"}',
    'view-distance=6', 'simulation-distance=3', 'max-players=8', 'enable-rcon=false',
    'enable-command-block=false', 'sync-chunk-writes=true'
  ].join('\n') + '\n', 'utf8');
  writeFileSync(path.join(serverDirectory, 'ops.json'), JSON.stringify(['BenchmarkBot', 'ParallelTestBot', 'SmokeBot'].map(name => ({ uuid: offlineUuid(name), name, level: 4, bypassesPlayerLimit: false }))), 'utf8');
  const child = spawn('java', ['-Xms256M', '-Xmx768M', '-jar', jar, '--nogui'], { cwd: serverDirectory, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const log = createWriteStream(path.join(directory, 'minecraft-server.log'));
  child.stdout?.pipe(log, { end: false }); child.stderr?.pipe(log, { end: false });
  child.once('close', () => log.end());
  const abort = () => { child.stdin?.write('stop\n'); };
  signal.addEventListener('abort', abort, { once: true });
  child.once('close', () => signal.removeEventListener('abort', abort));
  try {
    await new Promise<void>((resolve, reject) => {
      let tail = '';
      const cleanup = () => { clearTimeout(timer); child.stdout?.removeListener('data', output); child.removeListener('error', error); child.removeListener('exit', exited); signal.removeEventListener('abort', cancelled); };
      const output = (data: Buffer) => { tail = (tail + data.toString()).slice(-8_000); if (/Done \([\d.]+s\)!/.test(tail)) { cleanup(); resolve(); } };
      const error = (err: Error) => { cleanup(); reject(err); };
      const exited = () => error(new Error('El servidor aislado terminó antes de estar listo. Consulta minecraft-server.log.'));
      const cancelled = () => error(new Error('Doctor cancelado.'));
      const timer = setTimeout(() => error(new Error('Timeout preparando el servidor aislado (120s).')), 120_000);
      child.stdout?.on('data', output); child.once('error', error); child.once('exit', exited); signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled();
    });
    return { child, port };
  } catch (error) { await stopServer(child); throw error; }
}

export function writeDoctorReport(report: DoctorSuiteReport): void {
  writeFileSync(path.join(report.directory, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  const rows = report.stages.map(s => `| ${s.name} | ${s.status} | ${(s.durationMs / 1000).toFixed(2)} | ${s.details.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`);
  writeFileSync(path.join(report.directory, 'report.md'), `# Doctor\n\n${report.timestamp} — ${report.mode} — ${report.status}\n\n| Comprobación | Estado | Segundos | Resultado |\n| --- | --- | ---: | --- |\n${rows.join('\n')}\n\n## Benchmark\n\n\`\`\`json\n${JSON.stringify(report.benchmark ?? { unavailable: true }, null, 2)}\n\`\`\`\n`, 'utf8');
}

/** One entry point; never runs destructive tests against the configured/user world. */
export async function runDoctorSuite(options: { root?: string; offline?: boolean } = {}): Promise<DoctorSuiteReport> {
  const root = options.root ?? fileURLToPath(new URL('../../', import.meta.url));
  const base = path.join(root, 'artifacts', 'doctor'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(path.join(base, 'run-'));
  const started = Date.now(), controller = new AbortController();
  const report: DoctorSuiteReport = { version: 1, timestamp: new Date().toISOString(), mode: options.offline ? 'offline' : 'full', status: 'partial', durationMs: 0, stages: [], directory };
  const cancel = () => controller.abort(new Error('Doctor cancelado'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const run = async (name: string, args: string[], env: NodeJS.ProcessEnv = {}, timeoutMs = 180_000): Promise<void> => {
    if (controller.signal.aborted) { report.stages.push({name,status:'skipped',durationMs:0,details:'Doctor cancelado'}); return; }
    console.log(`[doctor] ${name}…`);
    const begin = Date.now(), logFile = path.join(directory, name.toLowerCase().replaceAll(' ', '-') + '.log');
    let output = '';
    const log = createWriteStream(logFile);
    const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, env: { ...process.env, ...env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout?.pipe(log, { end: false }); child.stderr?.pipe(log, { end: false });
    child.stdout?.on('data', (data: Buffer) => { output = (output + data.toString()).slice(-12_000); });
    child.stderr?.on('data', (data: Buffer) => { output = (output + data.toString()).slice(-12_000); });
    let timedOut = false;
    const abort = () => child.kill(); controller.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    let errorText = '';
    const code = await new Promise<number | null>(resolve => { child.once('error', error => { errorText = error.message; }); child.once('close', resolve); });
    clearTimeout(timer); controller.signal.removeEventListener('abort', abort); log.end();
    const status = code === 0 && !timedOut && !controller.signal.aborted ? 'passed' : 'failed';
    const details = status === 'passed' ? output.match(/\d+ tests? passed/)?.[0] ?? 'OK' : timedOut ? 'Timeout; consulta el log.' : errorText || output.slice(-2_000) || 'Proceso cancelado';
    report.stages.push({ name, status, durationMs: Date.now() - begin, details, log: logFile });
    console.log(`[doctor] ${name}: ${status} (${((Date.now() - begin) / 1000).toFixed(2)}s) ${status === 'passed' ? details : logFile}`);
  };
  let server: ChildProcess | undefined;
  try {
    for (const step of doctorSteps) { if (controller.signal.aborted) break; await run(step.name, [path.join(root, 'node_modules', step.cli), ...step.args]); }
    if (options.offline) {
      report.stages.push({ name: 'Minecraft integration', status: 'skipped', durationMs: 0, details: 'Modo offline explícito; no certifica gameplay.' });
      await run('Benchmark offline', ['--import=tsx', 'benchmarks/runner.ts', '--offline', '--all', `--report=${path.join(directory, 'benchmark.json')}`]);
    } else if (!controller.signal.aborted) {
      const begin = Date.now();
      try {
        console.log('[doctor] Preparando Minecraft aislado…');
        const startedServer = await startIsolatedServer(root, directory, controller.signal); server = startedServer.child;
        report.stages.push({ name: 'Isolated server', status: 'passed', durationMs: Date.now() - begin, details: `127.0.0.1:${startedServer.port}; mundo temporal` });
        const env = { MC_HOST: '127.0.0.1', MC_PORT: String(startedServer.port), MC_USERNAME: 'BenchmarkBot', MC_AUTH: 'offline', RUN_MINECRAFT_TESTS: 'true' };
        await run('Minecraft integration', [path.join(root, 'node_modules', 'ava', 'entrypoints', 'cli.mjs'), '--serial', 'tests/integration/**/*.ts'], env);
        if (!controller.signal.aborted) await run('Benchmark live', ['--import=tsx', 'benchmarks/runner.ts', '--all', `--report=${path.join(directory, 'benchmark.json')}`], env, 300_000);
      } catch (error) {
        report.stages.push({ name: 'Isolated server', status: 'failed', durationMs: Date.now() - begin, details: error instanceof Error ? error.message : String(error) });
        report.stages.push({ name: 'Minecraft integration', status: 'skipped', durationMs: 0, details: 'Servidor no disponible; no validado.' });
        await run('Benchmark offline', ['--import=tsx', 'benchmarks/runner.ts', '--offline', '--all', `--report=${path.join(directory, 'benchmark.json')}`]);
      }
    }
  } finally {
    if (server) { console.log('[doctor] Cerrando servidor aislado…'); await stopServer(server); }
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    const benchmarkFile = path.join(directory, 'benchmark.json');
    if (existsSync(benchmarkFile)) try { report.benchmark = JSON.parse(readFileSync(benchmarkFile, 'utf8')); } catch { report.stages.push({ name: 'Benchmark report', status: 'failed', durationMs: 0, details: 'JSON inválido' }); }
    report.durationMs = Date.now() - started;
    report.status = controller.signal.aborted || report.stages.some(s => s.status === 'failed') ? 'failed' : report.stages.some(s => s.status === 'skipped') ? 'partial' : 'passed';
    writeDoctorReport(report);
    writeFileSync(path.join(base, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
    writeFileSync(path.join(base, 'latest.md'), readFileSync(path.join(directory, 'report.md'), 'utf8'), 'utf8');
    const benchmark = report.benchmark as { results?: Array<{ name: string; expectedBlocks: number; verifiedBlocks: number | null; durationMs: number; verifiedBlocksPerSecond: number | null; status: string }> } | undefined;
    if (benchmark?.results) console.table(benchmark.results.map(row => ({ caso: row.name, esperados: row.expectedBlocks, verificados: row.verifiedBlocks ?? 'N/A', segundos: (row.durationMs / 1000).toFixed(2), 'bloques/s': row.verifiedBlocksPerSecond?.toFixed(1) ?? 'N/A', estado: row.status })));
    console.log(`\n[doctor] ${report.status.toUpperCase()} — ${(report.durationMs / 1000).toFixed(2)}s\nInforme: ${path.join(directory, 'report.md')}\nJSON: ${path.join(directory, 'report.json')}`);
  }
  return report;
}
