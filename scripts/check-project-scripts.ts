import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../projects/', import.meta.url));
const files: string[] = [];
function collect(directory: string): void {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (item.name === 'artifacts' || item.name === 'docs') continue;
    const target = path.join(directory, item.name);
    if (item.isDirectory()) collect(target);
    else if (/\.(?:ts|mts|mjs)$/.test(item.name)) files.push(target);
  }
}
collect(root);
let failed = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES2022, allowJs: true, isolatedModules: true } });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    console.error(`${file}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`); failed++;
  }
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const module = statement.moduleSpecifier;
    if (!module || !ts.isStringLiteral(module) || !module.text.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), module.text);
    const candidates = [target, target.replace(/\.js$/, '.ts'), target.replace(/\.mjs$/, '.mts'), path.join(target, 'index.ts')];
    if (!candidates.some(candidate => existsSync(candidate))) { console.error(`${file}: unresolved import ${module.text}`); failed++; }
  }
}
console.log(`${files.length} project scripts checked: syntax and relative imports only; no world actions executed.`);
process.exitCode = failed ? 1 : 0;
