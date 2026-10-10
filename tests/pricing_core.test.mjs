// DeepSeek peak / off-peak panel — logic + CLI tests.
// Zero dependencies: Node's built-in test runner and assert only.
//
//   node --test                  (Node 18+, run from the repo root)
//
// 10 tests / 38 assertions, zero dependencies — Node's built-in test runner and assert only.
// The suite reads the /*CORE-START*/ … /*CORE-END*/ block straight out of index.html,
// so it tests the artifact users actually open — not a copy that can drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PANEL = path.join(ROOT, 'index.html');
const TIER_CLI = path.join(ROOT, 'skills', 'deepseek-pricing-tier', 'scripts', 'deepseek_tier.mjs');

const html = fs.readFileSync(PANEL, 'utf8');
const core = html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
const { tierAt, nextSwitch, daySegments, bj, HOLIDAYS, PRICES } =
  new Function(core + '\nreturn {tierAt, nextSwitch, daySegments, bj, HOLIDAYS, PRICES};')();

const at = (iso) => new Date(iso).getTime();
const toBeijingISO = (ts) => new Date(ts + 8 * 3600000).toISOString().slice(0, 16);

test('peak window boundaries (Beijing time)', () => {
  assert.equal(tierAt(at('2026-10-12T08:59:59+08:00')), 'off', '08:59:59 is off-peak');
  assert.equal(tierAt(at('2026-10-12T09:00:00+08:00')), 'peak', '09:00 is peak');
  assert.equal(tierAt(at('2026-10-12T11:59:59+08:00')), 'peak', '11:59:59 is peak');
  assert.equal(tierAt(at('2026-10-12T12:00:00+08:00')), 'off', '12:00 lunch break is off-peak');
  assert.equal(tierAt(at('2026-10-12T14:00:00+08:00')), 'peak', '14:00 is peak');
  assert.equal(tierAt(at('2026-10-12T18:00:00+08:00')), 'off', '18:00 is off-peak');
});

test('weekends are off-peak all day', () => {
  assert.equal(tierAt(at('2026-10-10T10:00:00+08:00')), 'off', 'Saturday');
  assert.equal(tierAt(at('2026-10-11T15:00:00+08:00')), 'off', 'Sunday');
  assert.deepEqual(daySegments(at('2026-10-10T10:00:00+08:00')), []);
});

test('Chinese public holidays are off-peak, their neighbours are not', () => {
  assert.equal(tierAt(at('2026-10-02T10:00:00+08:00')), 'off', 'National Day');
  assert.equal(tierAt(at('2026-02-17T15:00:00+08:00')), 'off', 'Spring Festival');
  assert.equal(tierAt(at('2026-10-08T10:00:00+08:00')), 'peak', 'first workday after Golden Week');
  assert.equal(tierAt(at('2026-02-13T10:00:00+08:00')), 'peak', 'Friday before Spring Festival');
});

test('2026 holiday calendar is complete (3+9+3+5+3+3+7 days)', () => {
  assert.equal(HOLIDAYS.size, 33);
  assert.ok(HOLIDAYS.has('2026-01-01') && HOLIDAYS.has('2026-10-07'));
  assert.ok(!HOLIDAYS.has('2026-10-08'), 'Golden Week ends on the 7th');
});

test('peak segments within a weekday', () => {
  assert.deepEqual(daySegments(at('2026-10-12T09:30:00+08:00')),
    [{ h0: 9, h1: 12 }, { h0: 14, h1: 18 }]);
});

test('next switch is the next tier change, boundaries on the hour', () => {
  assert.equal(toBeijingISO(nextSwitch(at('2026-10-10T10:56:00+08:00'))), '2026-10-12T09:00',
    'weekend → Monday 09:00');
  assert.equal(toBeijingISO(nextSwitch(at('2026-10-12T09:30:00+08:00'))), '2026-10-12T12:00',
    'inside morning peak → 12:00');
  assert.equal(toBeijingISO(nextSwitch(at('2026-10-12T16:00:00+08:00'))), '2026-10-12T18:00',
    'inside afternoon peak → 18:00');
  assert.equal(toBeijingISO(nextSwitch(at('2026-10-07T10:00:00+08:00'))), '2026-10-08T09:00',
    'last holiday day → first peak after it');
});

test('every off-peak price is exactly half the peak price', () => {
  for (const [model, v] of Object.entries(PRICES)) {
    for (const row of ['hit', 'miss', 'out']) {
      assert.equal(v[row][0] * 2, v[row][1], `${model}.${row}: off-peak must be peak / 2`);
    }
    assert.ok(v.ver && v.conc, `${model} needs a version name and a concurrency limit`);
  }
  assert.deepEqual(Object.keys(PRICES), ['deepseek-flash', 'deepseek-v4-pro']);
});

test('model ids map to the documented versions', () => {
  assert.equal(PRICES['deepseek-flash'].ver, 'DeepSeek-V4.1-Flash');
  assert.match(PRICES['deepseek-v4-pro'].ver, /V4-Pro/);
});

test('the panel file is self-contained (no network, no build)', () => {
  assert.ok(!/<script[^>]+src=/.test(html), 'no external scripts');
  assert.ok(!/<link[^>]+stylesheet/.test(html), 'no external stylesheets');
  assert.ok(!/\bfetch\(|XMLHttpRequest/.test(html), 'no runtime network calls');
});

test('CLI: exit code follows the tier, JSON agrees with the panel', () => {
  const run = (iso) => {
    try {
      const out = execFileSync(process.execPath, [TIER_CLI, '--at', iso, '--json'],
        { encoding: 'utf8' });
      return { code: 0, data: JSON.parse(out) };
    } catch (e) {
      return { code: e.status, data: JSON.parse(e.stdout) };
    }
  };
  const peak = run('2026-10-12T09:30:00+08:00');
  assert.equal(peak.code, 3, 'peak must exit 3');
  assert.equal(peak.data.tier, 'peak');
  assert.equal(peak.data.next_switch_beijing, '2026-10-12 12:00:00');
  assert.equal(peak.data.prices_rmb_per_1m_tokens['deepseek-flash'].output, 8);

  const off = run('2026-10-12T12:30:00+08:00');
  assert.equal(off.code, 0, 'off-peak must exit 0');
  assert.equal(off.data.tier, 'off');
  assert.equal(off.data.prices_rmb_per_1m_tokens['deepseek-flash'].output, 4);

  const holiday = run('2026-10-02T10:00:00+08:00');
  assert.equal(holiday.data.reason, 'public holiday');
  assert.equal(holiday.data.off_peak, true);
});
