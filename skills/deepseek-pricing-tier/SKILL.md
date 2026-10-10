---
name: deepseek-pricing-tier
description: Answer whether DeepSeek bills peak or off-peak right now.
version: 0.1.0
author: ybbms777, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [DeepSeek, pricing, cost, scheduling, off-peak]
---

# DeepSeek Pricing Tier Skill

Tell the user — in one call — whether DeepSeek's API is billing at **peak (full price)** or
**off-peak (half price)** at this moment, when the tier flips next, and what the two models cost
per 1M tokens in the tier that is live. It also renders a human-readable panel.

The CLI does not re-implement the schedule: it extracts the `/*CORE-START*/ … /*CORE-END*/` block
from the repo's `index.html` and evaluates that, so the panel and the agent can never disagree.
No API key, no network, no dependencies — the panel is a static HTML file.

## When to Use

- "现在 DeepSeek 是半价吗 / when is DeepSeek cheapest / 什么时候跑最省"
- Before the agent launches a large or long DeepSeek batch: check whether waiting a few hours
  halves the bill.
- Explaining a bill that looks higher than expected (peak vs off-peak, holiday vs workday).
- Anything needing the exact next peak ↔ off-peak switch time.

Don't use for: other providers' rates, or subscription/quota questions — this covers DeepSeek's
published time-of-day pricing only.

## Prerequisites

- **Node 20+** for the CLI (`node --version`; CI runs 20 and 22 on Ubuntu and Windows). The panel
  itself needs only a browser.
- The repo checked out, or the skill installed with `index.html` reachable. The script looks for
  the panel next to itself; override with `--panel <path>` or `DEEPSEEK_PANEL_HTML`.
- No API key, no credentials, no install step.

## How to Run

```bash
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --json
```

Through the `terminal` tool:

```
terminal(command="node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --json", timeout=60)
```

For a human who wants to watch it, open `index.html` (or the GitHub Pages URL) instead of parsing
JSON.

## Quick Reference

| Flag | Effect |
|---|---|
| `--json` | Machine-readable output (use this when the agent reads it) |
| `--at <ISO>` | Evaluate a specific instant, e.g. `2026-10-12T09:30:00+08:00` |
| `--days N` | Also list the next N days of switch times |
| `--quiet` | Print nothing; communicate through the exit code |
| `--panel <path>` | Point at a specific `index.html` |

Exit codes: **0** = off-peak (half price) · **3** = peak (full price) · **2** = error.

## Procedure

1. Run the CLI with `--json` and read `tier`, `reason`, `next_switch_beijing` and
   `seconds_until_switch`.
   *Done when*: you can state peak/off-peak, why (weekend / public holiday / window), and the
   exact next flip time in Beijing time.
2. If the tier is `peak` and the work is deferrable, quote the wait and the saving: the same
   tokens cost **half** off-peak. Offer to schedule the job for after the switch (a cron job or a
   background task) rather than starting it now.
   *Done when*: the user has either the scheduled time or an explicit "run it now anyway".
3. If the user wants to see it, open `index.html` — or the live panel at
   `https://ybbms777.github.io/deepseek-pricing-panel/` — rather than describing the panel.
   *Done when*: the file/page is open, not summarised.
4. When a new year's holiday calendar is published, add the dates to `HOLIDAYS` in `index.html`
   and re-run the CLI for that year's dates to confirm the flip.
   *Done when*: a peak/off-peak query inside the new holiday window returns `off` with
   `reason: public holiday`.

## Pitfalls

- **A make-up workday is off-peak by the rule.** DeepSeek distinguishes only Mon–Fri from
  weekend, so a Saturday that the government turns into a workday still reads `off`. Say this
  when it matters; if an invoice disagrees, the invoice wins.
- **`reason` can hide the real cause** — a weekday inside no window reads
  "outside the weekday peak windows" while a holiday reads "public holiday". Prefer the holiday
  wording when explaining a saving.
- **Never edit the schedule in two places.** Change `index.html`'s CORE block only; the CLI picks
  it up automatically.
- **Do not pass MSYS-style paths (`/e/...`) to `node`** on Windows — use `E:/...`. Node is a native
  binary and does not translate them.
- **The panel shows published list prices**, not a quote for a specific account, discount or
  currency conversion.

## Verification

- Run with a fixed instant whose tier is obvious from the rule:
  `--at 2026-10-12T09:00:00+08:00` → `PEAK`, exit 3; `--at 2026-10-12T12:00:00+08:00` → `OFF-PEAK`,
  exit 0; `--at 2026-10-02T10:00:00+08:00` → `OFF-PEAK`, `reason: public holiday`.
- Confirm the displayed prices equal `离线价 = 高峰价 ÷ 2` on every row.
- Confirm `source` points at the intended `index.html` — a wrong panel file is the one silent
  failure mode.
