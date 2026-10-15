import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const at = '2026-10-12T09:00:00+08:00';
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], {
  encoding: 'utf8', env: { ...process.env, DEEPSEEK_PANEL_HTML: path.join(root, 'index.html') }, ...options
});
const json = (...args) => {
  const result = run(['--at', at, '--json', ...args]);
  assert.notEqual(result.status, null, result.error?.message);
  return { code: result.status, data: JSON.parse(result.stdout), stderr: result.stderr };
};

test('reason follows the current tier in CLI JSON', () => {
  assert.equal(json().data.reason, 'inside the weekday peak windows');
  assert.equal(json('--at', '2026-10-12T12:00:00+08:00').data.reason, 'outside the weekday peak windows');
});

test('--days uses a rolling half-open window, with no event-count cap', () => {
  const one = json('--days', '1').data;
  assert.deepEqual(one.upcoming_switches.map(s => s.at_beijing), [
    '2026-10-12 09:00:00', '2026-10-12 12:00:00', '2026-10-12 14:00:00', '2026-10-12 18:00:00'
  ]);
  assert.equal(one.switch_window.end_beijing_exclusive, '2026-10-13 09:00:00');
  const partial = json('--at', '2026-10-12T09:30:00+08:00', '--days', '1').data.upcoming_switches;
  assert.equal(partial[0].at_beijing, '2026-10-12 12:00:00');
  assert.equal(partial.at(-1).at_beijing, '2026-10-13 09:00:00');
  assert.equal(json('--days', '21').data.upcoming_switches.length, 60);
  assert.deepEqual(json('--at', '2026-10-10T10:00:00+08:00', '--days', '1').data.upcoming_switches, []);
  assert.equal(json('--days', '0').data.upcoming_switches, undefined);
});

test('invalid values, missing values, and explicit missing panels fail clearly', () => {
  for (const args of [
    ['--nope'], ['--at'], ['--panel'], ['--days'], ['--at', '--json'],
    ['--days', '-1'], ['--days', 'NaN'], ['--days', 'Infinity'], ['--days', '1.5'], ['--days', '367'],
    ['--at', 'garbage'], ['--at', '2026-02-30T10:00:00+08:00'], ['--at', '2026-10-12T25:00:00Z'],
    ['--at', '2026-10-12T09:30:00'], ['--panel', path.join(root, 'missing.html')],
    ['--panel', root]
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /^error: /);
    assert.equal(result.stdout, '');
  }
  const result = run(['--json'], { env: { ...process.env, DEEPSEEK_PANEL_HTML: path.join(root, 'missing.html') } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requested panel/);
  assert.equal(run(['--at', at, '--panel', path.join(root, 'index.html')], {
    env: { ...process.env, DEEPSEEK_PANEL_HTML: path.join(root, 'missing.html') }
  }).status, 3);
});

test('metadata and warnings include current and future calendar coverage', () => {
  const core = html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
  const coverage = new Function(core + '; return calendarCoverage')();
  const start = Date.parse('2026-12-31T00:00:00+08:00');
  const end = Date.parse('2027-01-01T00:00:00+08:00');
  assert.equal(coverage(start, end).complete, true);
  assert.deepEqual(coverage(start, end + 1).missing_years, [2027]);
  const covered = json();
  assert.equal(covered.code, 3);
  assert.equal(covered.data.data_metadata.pricing_checked_on, '2026-10-15');
  assert.match(covered.data.data_metadata.pricing_source, /^https:\/\/api-docs.deepseek.com/);
  assert.deepEqual(covered.data.data_metadata.holiday_years, [2026]);
  assert.deepEqual(covered.data.warnings, []);
  for (const args of [
    ['--at', '2027-01-04T09:30:00+08:00'],
    ['--at', '2026-12-28T09:30:00+08:00', '--days', '7'],
    ['--at', '2026-12-31T18:00:00+08:00']
  ]) {
    const result = json(...args);
    assert.equal(result.code, 2);
    assert.deepEqual(result.data.calendar_coverage.missing_years, [2027]);
    assert.match(result.data.warnings[0], /2027/);
    assert.match(result.stderr, /^warning: /);
  }
  const quiet = run(['--at', '2027-01-04T09:30:00+08:00', '--quiet', '--json']);
  assert.equal(quiet.status, 2);
  assert.equal(quiet.stdout, '');
  assert.match(quiet.stderr, /2027/);
});

test('installed skill includes HTML and runs from an unrelated clean cwd', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-install-'));
  try {
    const dest = path.join(temporary, 'skills', 'deepseek-pricing-tier');
    const install = spawnSync(process.execPath, [path.join(root, 'tools/install-skill.mjs'), dest], { cwd: temporary, encoding: 'utf8' });
    assert.equal(install.status, 0, install.stderr);
    assert.ok(fs.existsSync(path.join(dest, 'index.html')));
    const env = { ...process.env };
    delete env.DEEPSEEK_PANEL_HTML;
    const result = spawnSync(process.execPath, [path.join(dest, 'scripts/deepseek_tier.mjs'), '--at', at, '--json'], { cwd: temporary, env, encoding: 'utf8' });
    assert.equal(result.status, 3, result.stderr);
    assert.equal(JSON.parse(result.stdout).tier, 'peak');
    const repeat = spawnSync(process.execPath, [path.join(root, 'tools/install-skill.mjs'), dest], { cwd: temporary, encoding: 'utf8' });
    assert.equal(repeat.status, 2);
    assert.match(repeat.stderr, /already exists/);
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('deepseek-install-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

// Minimal DOM checks the actual render function; real browser checks are recorded separately.
test('fixed-clock render has 35/133 hours, truthful reasons, and cross-year warnings', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '2', style: {}, textContent: '', innerHTML: '' });
    return elements.get(id);
  };
  let now = Date.parse('2026-10-12T09:30:00+08:00');
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, document: {
    getElementById: element, querySelectorAll: () => [], documentElement: { dataset: {} }
  }, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, setInterval() {} });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script, context);
  assert.match(element('weekSummary').innerHTML, /高峰合计<\/span> 35 小时/);
  assert.match(element('weekSummary').innerHTML, /空闲合计<\/span> 133 小时/);
  assert.match(element('reason').textContent, /当前处在高峰时段/);
  assert.match(element('weekSummary').innerHTML, /费用节省 50%/);
  assert.match(element('dayDetail').innerHTML, /时长占比不代表费用节省/);
  assert.equal(element('coverageWarning').hidden, true);
  for (const instant of ['2026-12-28T09:30:00+08:00', '2027-01-04T09:30:00+08:00']) {
    now = Date.parse(instant);
    vm.runInContext('render()', context);
    assert.equal(element('coverageWarning').hidden, false);
    assert.match(element('coverageWarning').textContent, /2027/);
  }
  assert.match(element('word').textContent, /估算/);
});
