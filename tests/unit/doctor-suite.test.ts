import test from 'ava';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { doctorSteps, offlineUuid, writeDoctorReport, type DoctorSuiteReport } from '../../src/dev/doctor-suite.js';

test('doctor includes build lint and every unit test without recursively invoking doctor', t => {
  t.deepEqual(doctorSteps.map(s => s.name), ['Build', 'Typecheck', 'Project scripts', 'Lint', 'Unit tests']);
  t.true(doctorSteps[4].args.includes('tests/unit/**/*.test.ts'));
  t.false(doctorSteps.some(s => s.cli.includes('doctor')));
});

test('isolated operator UUID uses the Minecraft offline algorithm', t => {
  t.is(offlineUuid('Notch'), 'b50ad385-829d-3141-a216-7e7d7539ba7f');
});

test('doctor persists partial results and benchmark without claiming live verification', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aldeano-doctor-'));
  t.teardown(() => rmSync(directory, { recursive: true, force: true }));
  const report: DoctorSuiteReport = { version: 1, timestamp: new Date().toISOString(), mode: 'offline', status: 'partial', durationMs: 10, directory, stages: [{ name: 'Minecraft integration', status: 'skipped', durationMs: 0, details: 'Sin servidor' }], benchmark: { mode: 'offline' } };
  writeDoctorReport(report);
  t.is(JSON.parse(readFileSync(path.join(directory, 'report.json'), 'utf8')).status, 'partial');
  t.true(readFileSync(path.join(directory, 'report.md'), 'utf8').includes('skipped'));
  t.true(readFileSync(path.join(directory, 'report.md'), 'utf8').includes('Benchmark'));
});
