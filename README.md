# DeepSeek API Peak / Off-Peak Pricing Panel

**English** · [简体中文](README.zh-CN.md)

![no build](https://img.shields.io/badge/build-none-brightgreen)
![dependencies](https://img.shields.io/badge/dependencies-0-blue)
![single file](https://img.shields.io/badge/single--file-index.html-informational)
![offline](https://img.shields.io/badge/works-offline-lightgrey)
![platform](https://img.shields.io/badge/platform-any%20browser-success)
![china holidays](https://img.shields.io/badge/China%20holidays-2026%20built--in-orange)
![license](https://img.shields.io/badge/license-MIT-green)
![tests](https://github.com/ybbms777/deepseek-pricing-panel/actions/workflows/test.yml/badge.svg)

**One HTML file. Open it and you instantly see whether DeepSeek's API is billing you at peak (full price) or off-peak (half price) right now** — with a live countdown to the next switch and a 7-day schedule that already knows about weekends and Chinese public holidays.

![DeepSeek peak / off-peak pricing panel](docs/preview.png)

No build step, no npm, no server, no account, no network. Double-click the file.

## The rule, in one line

> **Peak** = Beijing time (UTC+8) **Mon–Fri 09:00–12:00 and 14:00–18:00**, *excluding Chinese public holidays*.
> **Everything else** — weekday nights, the 12:00–14:00 lunch break, all weekend, all public holidays — is **off-peak at exactly 50%**.

That is a hard **2× price difference for the same tokens**, decided purely by *when your request finishes*. It is the cheapest lever most DeepSeek API users never pull.

## What the panel shows

| Block | What it gives you |
|---|---|
| Status banner | Peak or off-peak right now, a Beijing-time clock, live countdown to the next change |
| Price table | `deepseek-flash` and `deepseek-v4-pro` rates — current tier highlighted, the other tier in grey, plus concurrency limits |
| 7-day schedule | One 24-hour bar per day; red = peak, green = off-peak; weekends and holidays labelled |
| Switch list | The exact next 4 peak ↔ off-peak flip times |

## Why this one, when the space is already crowded

There are Windows tray indicators, WinUI widgets, KDE Plasma applets, OpenCode/TUI plugins and Docker-hosted pages aimed at exactly this question. This panel is the one that is **zero-install and holiday-aware**:

- **Chinese-holiday aware.** Peak detection is not "UTC weekday + hour". It layers the State Council's published 2026 holiday calendar (33 days: New Year, Spring Festival, Qingming, Labour Day, Dragon Boat, Mid-Autumn, National Day) on top of the weekday/weekend rule — the difference between *"9 AM on a Monday"* and *"9 AM on the Monday of Golden Week"*, which weekday-only widgets get wrong.
- **Zero install, zero dependencies, zero network.** One ~13 KB file: no framework, no CDN, no telemetry. Runs from a USB stick, a network share, an air-gapped machine, or an iframe beside your editor.
- **Any platform with a browser.** Not Windows-only, not a native app to compile, not a container to keep alive.
- **Testable core, tested core.** The scheduling logic is decoupled from the DOM inside
  `/*CORE-START*/ … /*CORE-END*/`, and the repo ships the suite that exercises it: `node --test`
  runs 10 tests / 38 assertions over boundaries, holidays, next-switch math, the halved-price
  invariant and the CLI's exit codes — on Ubuntu and Windows, Node 20 and 22.
- **Documents the traps, not just the clock.** The API model id is not the model version (see below), and a government make-up workday is flagged rather than silently mis-tiered (see FAQ).

## Quick start

```bash
git clone https://github.com/ybbms777/deepseek-pricing-panel
cd deepseek-pricing-panel
```

Open `index.html` in any browser — or double-click `打开面板.bat` on Windows.

Run the suite (Node 20+, zero dependencies):

```bash
node --test        # 10 tests / 38 assertions
```

Want it next to your terminal? Embed it:

```html
<iframe src="index.html" width="860" height="920" style="border:0"></iframe>
```

## Model names: the trap this panel documents

The API model id is **not** the model version:

| API model name | Actual model | Notes |
|---|---|---|
| `deepseek-flash` | **DeepSeek-V4.1-Flash** | 1M context, up to 384K output, accepts images |
| `deepseek-v4-pro` | **DeepSeek-V4-Pro** (`DeepSeek-V4-Pro-0813` in the docs) | 1M context, up to 384K output, text only |

So `deepseek-flash` is **not** V4-Flash. The legacy ids `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` still resolve, but those models are retired — requests are served by DeepSeek-V4.1-Flash and billed at Flash prices. Verified with a live `GET https://api.deepseek.com/models`, which returns `id` and `name` side by side.

## List prices (RMB per 1M tokens, as published)

| Model | Input · cache hit | Input · cache miss | Output | Concurrency |
|---|---|---|---|---|
| `deepseek-flash` off-peak | 0.02 | 1 | 4 | 2500 |
| `deepseek-flash` peak | 0.04 | 2 | 8 | 2500 |
| `deepseek-v4-pro` off-peak | 0.15 | 4.5 | 13.5 | 500 |
| `deepseek-v4-pro` peak | 0.30 | 9.0 | 27.0 | 500 |

Off-peak is exactly half on every line. Prices and the schedule are transcribed from the official pricing page; they can change, so treat the panel as a visualiser of the published rule, not as the rule itself.

## Use it from Hermes Agent, or from a script

The repo ships a Hermes skill (`skills/deepseek-pricing-tier/`) whose CLI reuses the panel's *own*
logic — it extracts and evaluates the `/*CORE-START*/ … /*CORE-END*/` block out of `index.html`, so
the panel and the agent can never drift apart:

```bash
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs            # now
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --json     # for agents
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --days 7   # upcoming switches
```

Exit code **0** = off-peak (half price), **3** = peak (full price), **2** = error — so
`node deepseek_tier.mjs --quiet && run_your_batch` defers the job to the cheap window by itself.

The skill's agent-facing half answers "is DeepSeek half price right now, and when does it flip"
without opening a browser. Install by copying `skills/deepseek-pricing-tier/` into your Hermes
skills directory, or point `DEEPSEEK_PANEL_HTML` at `index.html`.

## Everything is traceable

- **Schedule rule & prices** — the footnote on `api-docs.deepseek.com/quick_start/pricing`.
- **Model ids and versions** — a live call to `GET api.deepseek.com/models`, not a blog post.
- **Holiday calendar** — the State Council's 2026 notice (国务院办公厅关于 2026 年部分节假日安排的通知).
- **Logic** — a shipped test suite (`node --test`): 10 tests / 38 assertions over the
  09:00/12:00/14:00/18:00 boundaries, weekends, Spring Festival and National Day, next-switch
  computation, the halved-price invariant, and the CLI's exit codes.

## Customise it in one minute

Everything lives in the `/*CORE-START*/ … /*CORE-END*/` block of `index.html`:

```js
HOLIDAYS          // Set of 'YYYY-MM-DD' public holidays
PRICES            // model -> version name, [off-peak, peak] rates, concurrency
isPeakHour(y,mo,d,h)
tierAt(ts)        // 'off' | 'peak'
nextSwitch(ts)    // timestamp of the next tier change
daySegments(ts)   // peak ranges of a given Beijing-time day
```

Next year's holiday notice is out? Append the dates to `HOLIDAYS`. No rebuild, no release.

## FAQ

**Is a workday the government makes out of a Saturday ("调休上班日") peak?** DeepSeek's rule distinguishes only *Mon–Fri* from *weekend*, so a make-up Saturday still counts as a weekend → off-peak. The panel agrees and flags the caveat in its footer. If your invoice ever disagrees, trust the invoice.

**Do I need an API key?** No. The panel never calls DeepSeek. It is pure local arithmetic on published rules — nothing to leak, nothing to rate-limit.

**2027 holidays?** 2026 ships built in. When the 2027 notice lands, add the dates to `HOLIDAYS`.

**Is this official?** No. Independent and unaffiliated; DeepSeek's own pricing page is authoritative.

## License

MIT — see [LICENSE](LICENSE).
