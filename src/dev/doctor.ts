import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runDoctorSuite } from './doctor-suite.js';

export type CheckStatus = 'OK' | 'WARN' | 'FAIL' | 'INFO';

export interface DiagnosticItem {
  category: string;
  check: string;
  status: CheckStatus;
  details: string;
  critical: boolean;
}

export interface DiagnosticReport {
  timestamp: string;
  items: DiagnosticItem[];
  passed: number;
  warnings: number;
  failed: number;
  info: number;
  allCriticalPassed: boolean;
}

/**
 * Checks if Node.js version satisfies >= 20.10.0.
 */
export function checkNodeVersion(minVersion = '20.10.0'): DiagnosticItem {
  const currentVersion = process.version.replace(/^v/, '');
  const parseSemver = (v: string) => v.split('.').map((x) => parseInt(x, 10) || 0);

  const [curMajor, curMinor, curPatch] = parseSemver(currentVersion);
  const [minMajor, minMinor, minPatch] = parseSemver(minVersion);

  let satisfies = false;
  if (curMajor > minMajor) {
    satisfies = true;
  } else if (curMajor === minMajor) {
    if (curMinor > minMinor) {
      satisfies = true;
    } else if (curMinor === minMinor) {
      satisfies = curPatch >= minPatch;
    }
  }

  return {
    category: 'Runtime',
    check: 'Node.js Version',
    status: satisfies ? 'OK' : 'FAIL',
    details: satisfies
      ? `v${currentVersion} (>= ${minVersion} required)`
      : `v${currentVersion} is lower than required v${minVersion}`,
    critical: true
  };
}

/**
 * Checks if Java is installed and compatible (JDK 17+ or 21).
 */
export function checkJavaVersion(): DiagnosticItem {
  try {
    const res = spawnSync('java', ['-version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (res.error) {
      return {
        category: 'Runtime',
        check: 'Java Development Kit',
        status: 'FAIL',
        details: 'Java executable not found in PATH (JDK 17 or 21 required)',
        critical: true
      };
    }

    const output = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
    const versionMatch = output.match(/(?:openjdk|java)\s+version\s+"?([0-9._]+)"?/i);
    const verString = versionMatch ? versionMatch[1] : 'unknown';

    let major = 0;
    if (verString.startsWith('1.')) {
      major = parseInt(verString.split('.')[1], 10);
    } else {
      major = parseInt(verString.split('.')[0], 10);
    }

    if (major > 0 && major < 17) {
      return {
        category: 'Runtime',
        check: 'Java Development Kit',
        status: 'WARN',
        details: `Java ${verString} detected. Minecraft 1.20+ requires Java 17 or 21`,
        critical: false
      };
    }

    return {
      category: 'Runtime',
      check: 'Java Development Kit',
      status: 'OK',
      details: verString !== 'unknown' ? `Java ${verString} detected` : 'Java runtime detected',
      critical: true
    };
  } catch {
    return {
      category: 'Runtime',
      check: 'Java Development Kit',
      status: 'FAIL',
      details: 'Failed to execute java -version',
      critical: true
    };
  }
}

/**
 * Checks if node_modules and critical project dependencies are present.
 */
export function checkDependencies(projectRoot: string = process.cwd()): DiagnosticItem {
  const nodeModulesDir = path.resolve(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    return {
      category: 'Dependencies',
      check: 'node_modules Directory',
      status: 'FAIL',
      details: 'node_modules directory missing. Run "npm install"',
      critical: true
    };
  }

  const criticalPackages = [
    '@modelcontextprotocol/sdk',
    'mineflayer',
    'mineflayer-pathfinder',
    'vec3',
    'yargs',
    'zod'
  ];

  const missing: string[] = [];
  for (const pkg of criticalPackages) {
    const pkgPath = path.resolve(nodeModulesDir, pkg, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    return {
      category: 'Dependencies',
      check: 'node_modules Installed',
      status: 'FAIL',
      details: `Missing packages: ${missing.join(', ')}. Run "npm install"`,
      critical: true
    };
  }

  return {
    category: 'Dependencies',
    check: 'node_modules Installed',
    status: 'OK',
    details: 'All core dependencies present in node_modules',
    critical: true
  };
}

/**
 * Checks Mineflayer and Pathfinder versions specifically.
 */
export function checkMineflayerPackages(projectRoot: string = process.cwd()): DiagnosticItem {
  const mfPkgPath = path.resolve(projectRoot, 'node_modules', 'mineflayer', 'package.json');
  const pfPkgPath = path.resolve(projectRoot, 'node_modules', 'mineflayer-pathfinder', 'package.json');

  let mfVer = '';
  let pfVer = '';

  if (fs.existsSync(mfPkgPath)) {
    try {
      const mfPkg = JSON.parse(fs.readFileSync(mfPkgPath, 'utf-8'));
      mfVer = mfPkg.version || '';
    } catch {
      // ignore
    }
  }

  if (fs.existsSync(pfPkgPath)) {
    try {
      const pfPkg = JSON.parse(fs.readFileSync(pfPkgPath, 'utf-8'));
      pfVer = pfPkg.version || '';
    } catch {
      // ignore
    }
  }

  if (!mfVer || !pfVer) {
    return {
      category: 'Dependencies',
      check: 'Mineflayer & Pathfinder',
      status: 'FAIL',
      details: `Missing package metadata (mineflayer: ${mfVer || 'missing'}, pathfinder: ${pfVer || 'missing'})`,
      critical: true
    };
  }

  return {
    category: 'Dependencies',
    check: 'Mineflayer & Pathfinder',
    status: 'OK',
    details: `mineflayer v${mfVer}, mineflayer-pathfinder v${pfVer}`,
    critical: true
  };
}

/**
 * Checks MCP SDK installation and build status.
 */
export function checkMcpSdk(projectRoot: string = process.cwd()): DiagnosticItem {
  const mcpPkgPath = path.resolve(projectRoot, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json');
  const distMainPath = path.resolve(projectRoot, 'dist', 'main.js');

  let sdkVer = '';
  if (fs.existsSync(mcpPkgPath)) {
    try {
      const mcpPkg = JSON.parse(fs.readFileSync(mcpPkgPath, 'utf-8'));
      sdkVer = mcpPkg.version || '';
    } catch {
      // ignore
    }
  }

  if (!sdkVer) {
    return {
      category: 'MCP SDK',
      check: 'MCP SDK Configuration',
      status: 'FAIL',
      details: '@modelcontextprotocol/sdk not found. Run "npm install"',
      critical: true
    };
  }

  const hasDist = fs.existsSync(distMainPath);
  return {
    category: 'MCP SDK',
    check: 'MCP SDK Configuration',
    status: hasDist ? 'OK' : 'WARN',
    details: hasDist
      ? `@modelcontextprotocol/sdk v${sdkVer}, dist/main.js built`
      : `@modelcontextprotocol/sdk v${sdkVer} (dist/main.js not built; run "npm run build")`,
    critical: false
  };
}

/**
 * Checks local Minecraft server installation in .dev/minecraft.
 */
export function checkLocalMinecraftServer(projectRoot: string = process.cwd()): DiagnosticItem {
  const mcDir = path.resolve(projectRoot, '.dev', 'minecraft');
  const jarPath = path.join(mcDir, 'server.jar');
  const eulaPath = path.join(mcDir, 'eula.txt');
  const propsPath = path.join(mcDir, 'server.properties');

  if (!fs.existsSync(jarPath)) {
    return {
      category: 'Minecraft Server',
      check: 'Local Server Files',
      status: 'WARN',
      details: 'server.jar not found. Run "npm run mc:setup" to download and configure',
      critical: false
    };
  }

  const jarStats = fs.statSync(jarPath);
  const sizeMb = (jarStats.size / (1024 * 1024)).toFixed(1);

  const hasEula = fs.existsSync(eulaPath) && fs.readFileSync(eulaPath, 'utf-8').includes('eula=true');
  const hasProps = fs.existsSync(propsPath);

  if (!hasEula || !hasProps) {
    return {
      category: 'Minecraft Server',
      check: 'Local Server Files',
      status: 'WARN',
      details: `server.jar present (${sizeMb} MB), but ${!hasEula ? 'eula.txt' : 'server.properties'} is missing. Run "npm run mc:setup"`,
      critical: false
    };
  }

  return {
    category: 'Minecraft Server',
    check: 'Local Server Files',
    status: 'OK',
    details: `server.jar (${sizeMb} MB), eula.txt, server.properties configured`,
    critical: false
  };
}

/**
 * Checks port 25565 availability and server status.
 */
export function checkPortStatus(port = 25565, host = '127.0.0.1', timeoutMs = 800): Promise<DiagnosticItem> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve({
        category: 'Network & Port',
        check: `Port ${port} Status`,
        status: 'OK',
        details: `Server is active and listening on ${host}:${port}`,
        critical: false
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        category: 'Network & Port',
        check: `Port ${port} Status`,
        status: 'INFO',
        details: `Port ${port} is available (server not running; start with "npm run mc:start")`,
        critical: false
      });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({
        category: 'Network & Port',
        check: `Port ${port} Status`,
        status: 'INFO',
        details: `Port ${port} is available (server not running; start with "npm run mc:start")`,
        critical: false
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Checks bot connection configuration.
 */
export function checkBotConfig(): DiagnosticItem {
  return {
    category: 'Bot Connection',
    check: 'Bot Configuration',
    status: 'OK',
    details: 'Default host: 127.0.0.1, Port: 25565, Username: MCPBot',
    critical: false
  };
}

/**
 * Runs all diagnostics and produces a report.
 */
export async function runDiagnostics(projectRoot: string = process.cwd()): Promise<DiagnosticReport> {
  const items: DiagnosticItem[] = [];

  items.push(checkNodeVersion());
  items.push(checkJavaVersion());
  items.push(checkDependencies(projectRoot));
  items.push(checkMineflayerPackages(projectRoot));
  items.push(checkMcpSdk(projectRoot));
  items.push(checkLocalMinecraftServer(projectRoot));
  items.push(await checkPortStatus(Number(process.env.MC_PORT ?? 25565), process.env.MC_HOST ?? '127.0.0.1'));
  items.push(checkBotConfig());

  const passed = items.filter((i) => i.status === 'OK').length;
  const warnings = items.filter((i) => i.status === 'WARN').length;
  const failed = items.filter((i) => i.status === 'FAIL').length;
  const info = items.filter((i) => i.status === 'INFO').length;

  const criticalFailed = items.some((i) => i.critical && i.status === 'FAIL');

  return {
    timestamp: new Date().toISOString(),
    items,
    passed,
    warnings,
    failed,
    info,
    allCriticalPassed: !criticalFailed
  };
}

/**
 * Prints a clean formatted CLI table for diagnostics report.
 */
export function printDiagnosticReport(report: DiagnosticReport): void {
  console.log('================================================================================');
  console.log('                       Aldeano Build MCP - System Doctor                        ');
  console.log('================================================================================\n');

  const pad = (str: string, len: number) => {
    if (str.length >= len) return str.slice(0, len);
    return str + ' '.repeat(len - str.length);
  };

  const statusBadges: Record<CheckStatus, string> = {
    OK: '[  OK  ]',
    WARN: '[ WARN ]',
    FAIL: '[ FAIL ]',
    INFO: '[ INFO ]'
  };

  console.log(`  ${pad('Category', 18)} ${pad('Check', 26)} ${pad('Status', 10)} Details`);
  console.log(' ' + '─'.repeat(78));

  for (const item of report.items) {
    const badge = statusBadges[item.status] || `[ ${item.status} ]`;
    console.log(`  ${pad(item.category, 18)} ${pad(item.check, 26)} ${pad(badge, 10)} ${item.details}`);
  }

  console.log(' ' + '─'.repeat(78));
  console.log(`\n  Summary: ${report.passed} OK, ${report.info} Info, ${report.warnings} Warnings, ${report.failed} Failed`);

  if (report.allCriticalPassed && report.failed === 0) {
    console.log('  \x1b[32m✔ All essential requirements satisfied! Environment is healthy.\x1b[0m\n');
  } else if (report.allCriticalPassed) {
    console.log('  \x1b[33m! Essential checks passed with non-critical warnings.\x1b[0m\n');
  } else {
    console.log('  \x1b[31m✖ Critical checks failed! Please resolve the issues above.\x1b[0m\n');
  }
  console.log('================================================================================\n');
}

// Direct execution check
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile === currentFile || invokedFile.endsWith('doctor.ts') || invokedFile.endsWith('doctor.js')) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  runDiagnostics(root).then(async (report) => {
    printDiagnosticReport(report);
    if (process.argv.includes('--checks-only')) { process.exitCode = report.allCriticalPassed ? 0 : 1; return; }
    const suite = await runDoctorSuite({ root, offline: process.argv.includes('--offline') });
    process.exitCode = !report.allCriticalPassed || suite.status === 'failed' ? 1 : 0;
  }).catch((err) => {
    console.error('\n[ERROR] Doctor failed unexpectedly:', err);
    process.exit(1);
  });
}
