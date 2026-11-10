// Regression: every CORE time entry point must reject a non-finite instant instead of
// silently answering "off".
//
// Why this file exists
// --------------------
// The CORE used to do `ts + TZ` with no type guard. `new Date(ms) + TZ` is a *string*
// concatenation, `new Date(<garbage string>)` is an Invalid Date, every field is NaN, and
// `isPeakHour` then falls through both `false` branches to `return (h>=9&&h<12)||...` →
// false → "off". So a caller who passed a Date object got the half-price tier during a
// peak window, and got it *without an error*. Measured on pin c9108c0 (the pre-guard CORE):
//
//   tierAt(Number(ms))  -> "peak"
//   tierAt(new Date(ms))-> "off"
//   tierAt(ISO string)  -> "off"
//   tierAt(undefined)   -> "off"
//   tierAt(null)        -> "off"
//
// The contract now: a non-number / non-finite instant throws TypeError. The number path
// must be unchanged, which the boundary assertions below pin down.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const core = html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
const { tierAt, nextSwitch, daySegments, bj, calendarCoverage, tierReason } =
  new Function(core + '\nreturn {tierAt, nextSwitch, daySegments, bj, calendarCoverage, tierReason};')();

const PEAK = new Date('2026-11-10T09:30:00+08:00').getTime(); // Tuesday, inside 09:00-12:00
const BAD = [
  ['Date object', new Date(PEAK)],
  ['ISO string with offset', '2026-11-10T09:30:00+08:00'],
  ['ISO string without offset', '2026-11-10T09:30'],
  ['date-only string', '2026-11-10'],
  ['undefined', undefined],
  ['null', null],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['true', true],
  ['array', [PEAK]],
  ['object', {}],
];

test('the number path is unchanged (peak boundaries still exact)', () => {
  assert.equal(tierAt(new Date('2026-11-10T08:59:00+08:00').getTime()), 'off');
  assert.equal(tierAt(PEAK), 'peak');
  assert.equal(tierAt(new Date('2026-11-10T11:59:00+08:00').getTime()), 'peak');
  assert.equal(tierAt(new Date('2026-11-10T12:00:00+08:00').getTime()), 'off');
  assert.equal(tierAt(new Date('2026-11-10T14:00:00+08:00').getTime()), 'peak');
  assert.equal(tierAt(new Date('2026-11-10T18:00:00+08:00').getTime()), 'off');
  assert.deepEqual(daySegments(PEAK), [{ h0: 9, h1: 12 }, { h0: 14, h1: 18 }]);
  assert.equal(nextSwitch(PEAK), new Date('2026-11-10T12:00:00+08:00').getTime());
  assert.equal(bj(PEAK).key, '2026-11-10');
  assert.equal(tierReason(PEAK), 'inside the weekday peak windows');
  assert.deepEqual(calendarCoverage(PEAK), { complete: true, missing_years: [] });
});

for (const fn of [tierAt, nextSwitch, daySegments, bj, tierReason]) {
  test(`${fn.name} rejects every non-finite instant`, () => {
    for (const [label, value] of BAD) {
      assert.throws(() => fn(value), TypeError, `${fn.name}(${label}) must throw TypeError`);
    }
  });
}

test('calendarCoverage rejects a missing start instead of reporting "complete"', () => {
  // Previously calendarCoverage() with no argument produced {complete:true, missing_years:[]}
  // — i.e. it certified coverage it never checked.
  assert.throws(() => calendarCoverage(), TypeError);
  // NB: an explicit `undefined` end is *not* an error — it selects the documented default
  // (end = start + 1), same as omitting it.
  assert.deepEqual(calendarCoverage(PEAK, undefined), calendarCoverage(PEAK));
  assert.throws(() => calendarCoverage(PEAK, NaN), TypeError);
  assert.throws(() => calendarCoverage(PEAK, null), TypeError);
});

test('the error message names the function and the received type', () => {
  assert.throws(() => tierAt(new Date(PEAK)), /tierAt expects a finite millisecond timestamp \(number\), got Date/);
  assert.throws(() => tierAt('2026-11-10T09:30:00+08:00'), /got string "2026-11-10T09:30:00\+08:00"/);
  assert.throws(() => tierAt(undefined), /got undefined/);
  assert.throws(() => tierAt(null), /got null/);
});
