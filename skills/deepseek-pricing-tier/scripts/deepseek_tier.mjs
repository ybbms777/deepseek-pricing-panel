#!/usr/bin/env node
// DeepSeek API peak / off-peak tier — CLI.
//
// Zero dependencies. It does NOT re-implement the schedule: it extracts the
// /*CORE-START*/ … /*CORE-END*/ block out of index.html and evaluates that, so
// the CLI and the panel can never disagree. If the panel is fixed, this is fixed.
//
// Usage:
//   node deepseek_tier.mjs                 # now
//   node deepseek_tier.mjs --json          # machine-readable
//   node deepseek_tier.mjs --at 2026-10-12T09:30:00+08:00
//   node deepseek_tier.mjs --days 7        # also list upcoming switches
//   DEEPSEEK_PANEL_HTML=/path/index.html node deepseek_tier.mjs
//
// Exit code: 0 = off-peak (half price), 3 = peak (full price), 2 = error.
// Handy inside a pipeline: `node deepseek_tier.mjs --quiet && run_the_batch`

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function locatePanel(explicit) {
  const requested = explicit ?? process.env.DEEPSEEK_PANEL_HTML;
  if (requested !== undefined) {
    try {
      if (fs.statSync(requested).isFile()) return path.resolve(requested);
    } catch { /* report the requested path instead of silently falling back */ }
    throw new Error('requested panel is not a readable file: ' + requested);
  }
  const tries = [
    path.join(HERE, '..', '..', '..', 'index.html'), // repo layout: skills/<name>/scripts/
    path.join(HERE, '..', '..', 'index.html'),       // skill installed one level shallower
    path.join(HERE, '..', 'index.html'),
    path.join(HERE, 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ].filter(Boolean);
  for (const p of tries) {
    try { if (fs.statSync(p).isFile()) return path.resolve(p); } catch { /* keep looking */ }
  }
  return null;
}

function loadCore(panelPath) {
  const html = fs.readFileSync(panelPath, 'utf8');
  const m = html.split('/*CORE-START*/')[1];
  if (!m || !m.includes('/*CORE-END*/')) throw new Error('complete CORE block not found in ' + panelPath);
  const core = m.split('/*CORE-END*/')[0];
  // Evaluate the panel's own logic and hand back the symbols we need.
  return new Function(core + '\nreturn {tierAt, nextSwitch, daySegments, bj, PRICES, tierReason, DATA_METADATA, calendarCoverage, coverageWarnings};')();
}

function args(argv) {
  const o = { days: 0, json: false, quiet: false, at: null, panel: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--') || v === '-h') throw new Error(a + ' requires a value');
      return v;
    };
    if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--at') o.at = value();
    else if (a === '--panel') o.panel = value();
    else if (a === '--days') {
      const v = value();
      if (!/^\d+$/.test(v) || Number(v) > 366) throw new Error('--days must be an integer from 0 to 366');
      o.days = Number(v);
    }
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('unknown argument: ' + a);
  }
  return o;
}

const HELP = `DeepSeek API peak / off-peak tier

  node deepseek_tier.mjs [--json] [--quiet] [--at <ISO>] [--days N] [--panel <index.html>]

  --at     ISO instant with Z or UTC offset (default: now)
  --days   integer 0..366; switches in [at, at + N*24h), including a switch at at
  --quiet  print no result; errors and coverage warnings still go to stderr
  exit 0 = off-peak · 3 = peak · 2 = error or incomplete holiday coverage
`;

function parseInstant(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) throw new Error('--at requires an ISO date-time with seconds and Z or UTC offset');
  const [, year, month, day, hour, minute, second, zone] = m;
  const date = new Date(year + '-' + month + '-' + day + 'T00:00:00Z');
  const ts = Date.parse(value);
  if (!Number.isFinite(ts) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}` ||
      +hour > 23 || +minute > 59 || +second > 59 ||
      (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59))) {
    throw new Error('--at is not a valid date: ' + value);
  }
  return ts;
}

function pad(n) { return String(n).padStart(2, '0'); }
function bjStamp(p) { return `${p.key} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`; }
function human(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function main() {
  const o = args(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP); return 0; }

  const panel = locatePanel(o.panel);
  if (!panel) throw new Error('index.html not found — pass --panel <path> or set DEEPSEEK_PANEL_HTML');
  const { tierAt, nextSwitch, daySegments, bj, PRICES, tierReason, DATA_METADATA, calendarCoverage, coverageWarnings } = loadCore(panel);

  const at = o.at ? parseInstant(o.at) : Date.now();

  const tier = tierAt(at);
  const nx = nextSwitch(at);
  const p = bj(at);
  const segs = daySegments(at);
  const reason = tierReason(at);
  const horizon = at + o.days * 86400000;
  // Include every date consulted for the next switch as well as the requested forecast.
  const coverageEnd = Math.max(at + 1, horizon, nx ? nx + 1 : at + 15 * 86400000);
  const warnings = coverageWarnings(at, coverageEnd);

  const out = {
    evaluated_at_beijing: bjStamp(p),
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.wd],
    tier,                                  // 'off' (half price) | 'peak' (full price)
    off_peak: tier === 'off',
    reason,
    data_metadata: DATA_METADATA,
    calendar_coverage: calendarCoverage(at, coverageEnd),
    current_calendar_covered: calendarCoverage(at).complete,
    warnings,
    today_peak_windows: segs.map(s => `${pad(s.h0)}:00-${pad(s.h1)}:00`),
    next_switch_beijing: nx ? bjStamp(bj(nx)) : null,
    seconds_until_switch: nx ? Math.floor((nx - at) / 1000) : null,
    next_switch_to: nx ? (tierAt(nx) === 'peak' ? 'peak (full price)' : 'off-peak (half price)') : null,
    prices_rmb_per_1m_tokens: Object.fromEntries(
      Object.entries(PRICES).map(([m, v]) => [m, {
        model_version: v.ver,
        input_cache_hit: v.hit[tier === 'off' ? 0 : 1],
        input_cache_miss: v.miss[tier === 'off' ? 0 : 1],
        output: v.out[tier === 'off' ? 0 : 1],
      }])),
    source: path.relative(process.cwd(), panel) || panel,
  };

  if (o.days > 0) {
    const sw = [];
    let n = tierAt(at - 1) !== tier ? at : nextSwitch(at);
    while (n !== null && n < horizon) {
      sw.push({ at_beijing: bjStamp(bj(n)), to: tierAt(n) === 'peak' ? 'peak' : 'off-peak' });
      n = nextSwitch(n);
    }
    out.upcoming_switches = sw;
    out.switch_window = { start_beijing: bjStamp(bj(at)), end_beijing_exclusive: bjStamp(bj(horizon)), days: o.days };
  }

  for (const warning of warnings) process.stderr.write('warning: ' + warning + '\n');
  if (o.quiet) {
    // Incomplete coverage must not authorize a batch through `&&`.
  } else if (o.json) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else if (!o.quiet) {
    const label = out.off_peak ? 'OFF-PEAK — half price' : 'PEAK — full price';
    const lines = [
      `${label}${calendarCoverage(at).complete ? '' : ' (estimate; holidays not maintained)'}`,
      `  now (Beijing)   ${out.evaluated_at_beijing} (${out.weekday}) — ${out.reason}`,
      `  today's peak    ${out.today_peak_windows.length ? out.today_peak_windows.join(', ') + ' (Beijing)' : 'none'}`,
      `  next switch     ${out.next_switch_beijing} → ${out.next_switch_to} (in ${human(nx - at)})`,
      `  pricing checked ${DATA_METADATA.pricing_checked_on} · ${DATA_METADATA.pricing_source}`,
      `  holiday years   ${DATA_METADATA.holiday_years.join(', ')}`,
    ];
    for (const [m, v] of Object.entries(out.prices_rmb_per_1m_tokens)) {
      lines.push(`  ${m.padEnd(16)} in ${v.input_cache_miss} / out ${v.output} RMB per 1M  (${v.model_version})`);
    }
    if (out.upcoming_switches) {
      lines.push('  upcoming switches:');
      for (const s of out.upcoming_switches) lines.push(`    ${s.at_beijing} → ${s.to}`);
    }
    process.stdout.write(lines.join('\n') + '\n');
  }
  return warnings.length ? 2 : tier === 'off' ? 0 : 3;
}

try {
  process.exit(main());
} catch (e) {
  process.stderr.write('error: ' + e.message + '\n');
  process.exit(2);
}
