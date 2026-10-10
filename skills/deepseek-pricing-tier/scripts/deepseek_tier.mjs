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
  const tries = [
    explicit,
    process.env.DEEPSEEK_PANEL_HTML,
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
  if (!m) throw new Error('CORE block not found in ' + panelPath);
  const core = m.split('/*CORE-END*/')[0];
  // Evaluate the panel's own logic and hand back the symbols we need.
  return new Function(core + '\nreturn {tierAt, nextSwitch, daySegments, bj, HOLIDAYS, PRICES};')();
}

function args(argv) {
  const o = { days: 0, json: false, quiet: false, at: null, panel: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--at') o.at = argv[++i];
    else if (a === '--panel') o.panel = argv[++i];
    else if (a === '--days') o.days = Number(argv[++i] || 0);
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('unknown argument: ' + a);
  }
  return o;
}

const HELP = `DeepSeek API peak / off-peak tier

  node deepseek_tier.mjs [--json] [--quiet] [--at <ISO>] [--days N] [--panel <index.html>]

  --at     evaluate a specific instant (default: now)
  --days   also list switches over the next N days
  --quiet  print nothing, only set the exit code
  exit 0 = off-peak (half price) · 3 = peak (full price) · 2 = error
`;

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
  const { tierAt, nextSwitch, daySegments, bj, HOLIDAYS, PRICES } = loadCore(panel);

  const at = o.at ? new Date(o.at).getTime() : Date.now();
  if (Number.isNaN(at)) throw new Error('--at is not a valid date: ' + o.at);

  const tier = tierAt(at);
  const nx = nextSwitch(at);
  const p = bj(at);
  const segs = daySegments(at);
  const reason = HOLIDAYS.has(p.key) ? 'public holiday'
    : (p.wd === 0 || p.wd === 6) ? 'weekend'
    : segs.length ? 'outside the weekday peak windows' : 'weekday, outside peak';

  const out = {
    evaluated_at_beijing: bjStamp(p),
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.wd],
    tier,                                  // 'off' (half price) | 'peak' (full price)
    off_peak: tier === 'off',
    reason,
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
    let t = at;
    for (let i = 0; i < 40 && sw.length < o.days * 3; i++) {
      const n = nextSwitch(t);
      if (!n) break;
      sw.push({ at_beijing: bjStamp(bj(n)), to: tierAt(n) === 'peak' ? 'peak' : 'off-peak' });
      t = n;
    }
    out.upcoming_switches = sw;
  }

  if (o.json) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else if (!o.quiet) {
    const label = out.off_peak ? 'OFF-PEAK — half price' : 'PEAK — full price';
    const lines = [
      `${label}`,
      `  now (Beijing)   ${out.evaluated_at_beijing} (${out.weekday}) — ${out.reason}`,
      `  today's peak    ${out.today_peak_windows.length ? out.today_peak_windows.join(', ') + ' (Beijing)' : 'none'}`,
      `  next switch     ${out.next_switch_beijing} → ${out.next_switch_to} (in ${human(nx - at)})`,
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
  return tier === 'off' ? 0 : 3;
}

try {
  process.exit(main());
} catch (e) {
  process.stderr.write('error: ' + e.message + '\n');
  process.exit(2);
}
