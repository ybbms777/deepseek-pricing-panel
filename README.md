# DeepSeek API Peak / Off-Peak Pricing Panel

[简体中文](README.zh-CN.md)

One HTML file. Open it and you can see whether the DeepSeek API is billing at peak or off-peak right now, and when the tier flips next.

![the panel](docs/preview.png)

No build, no dependencies, no network. Double-click the file.

## The rule

> Peak = Beijing time (UTC+8) Monday–Friday 09:00–12:00 and 14:00–18:00, excluding Chinese public holidays.
> Every other instant — weekday nights, the 12:00–14:00 lunch break, all weekend, all holidays — bills at exactly 50% of the peak rate.

Same tokens, 2× the price, decided only by when the request finishes.

## Run it

```bash
git clone https://github.com/ybbms777/deepseek-pricing-panel
cd deepseek-pricing-panel
```

Open `index.html` in any browser. On Windows you can double-click `打开面板.bat` instead.

Run the tests (Node 20+, no third-party packages):

```bash
node --test        # 10 tests / 38 assertions
```

## What the page shows

It is a desktop panel, not a scrolling web page: three panes in a viewport-height grid, no page
scroll, dark/light toggle, keyboard control.

| Pane | What |
|---|---|
| Top bar | Live tier, Beijing clock, countdown to the next switch, copy-summary button |
| Left | Current window progress, the next 4 switches, 7-day totals, and a cost calculator (type input/output tokens → what it costs now vs. moved entirely off-peak) |
| Middle | 14-day timetable (one 24-hour lane per day, peak as a solid block, "now" rule on today) plus a bar chart of peak hours per day |
| Right | Selected day detail, an hourly price-multiplier bar chart, and the price table |
| Bottom | The rule and where the numbers come from |

`↑`/`↓` pick a day, `T` jumps to today, `D` toggles dark mode; clicking a row in the timetable shows that day on the right.

## Where the numbers come from

- Schedule rule and prices: the footnote on `api-docs.deepseek.com/quick_start/pricing`
- Model ids and versions: a live `GET https://api.deepseek.com/models`
- Holidays: State Council notice for 2026, 33 days
- Logic: `node --test` runs 10 tests / 38 assertions covering the 09:00 / 12:00 / 14:00 / 18:00 boundaries, weekends, Spring Festival and National Day, the next-switch calculation, off-peak = peak ÷ 2, and the CLI's exit codes. CI runs it on Ubuntu and Windows with Node 20 and 22.

## Model names

The API model name is not the model version:

| API model name | Actual model | Notes |
|---|---|---|
| `deepseek-flash` | DeepSeek-V4.1-Flash | 1M context, up to 384K output, accepts images |
| `deepseek-v4-pro` | DeepSeek-V4-Pro | 1M context, up to 384K output, text only |

`deepseek-flash` is not V4-Flash. The legacy ids `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` still resolve, but those models are retired: requests are served by DeepSeek-V4.1-Flash at Flash prices.

## Prices (RMB per 1M tokens)

| Model | Input · cache hit | Input · cache miss | Output | Concurrency |
|---|---|---|---|---|
| `deepseek-flash` off-peak | 0.02 | 1 | 4 | 2500 |
| `deepseek-flash` peak | 0.04 | 2 | 8 | 2500 |
| `deepseek-v4-pro` off-peak | 0.15 | 4.5 | 13.5 | 500 |
| `deepseek-v4-pro` peak | 0.30 | 9.0 | 27.0 | 500 |

Transcribed from the official pricing page, which can change. Treat the panel as a view of the published rule, not as the rule itself.

## From Hermes Agent or a script

The repo ships a Hermes skill at `skills/deepseek-pricing-tier/`. Its CLI evaluates the `/*CORE-START*/ … /*CORE-END*/` block pulled out of `index.html`, so there is no second copy of the logic:

```bash
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs            # now
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --json     # for an agent
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --days 7   # upcoming switches
```

Exit code 0 = off-peak, 3 = peak, 2 = error, so `node deepseek_tier.mjs --quiet && run_your_batch` defers the batch into the cheap window on its own.

To install the skill, copy `skills/deepseek-pricing-tier/` into your Hermes skills directory, or point `DEEPSEEK_PANEL_HTML` at `index.html`.

## Change it

Everything adjustable lives in the `/*CORE-START*/ … /*CORE-END*/` block of `index.html`:

```js
HOLIDAYS          // Set of 'YYYY-MM-DD' public holidays
PRICES            // model -> version name, [off-peak, peak] rates, concurrency
isPeakHour(y,mo,d,h)
tierAt(ts)        // 'off' | 'peak'
nextSwitch(ts)    // timestamp of the next tier change
daySegments(ts)   // peak ranges of a given Beijing-time day
```

When next year's holiday notice is published, append the dates to `HOLIDAYS`.

## Two caveats

- A make-up workday on a Saturday counts as off-peak. The rule only distinguishes Monday–Friday from weekend, so 2026-10-10 (a Saturday the government turned into a workday) reads as off-peak at half price. If an invoice disagrees, the invoice wins.
- 2027 holidays are not included. 2026 is built in; add the 2027 dates when the notice is published.

## License

MIT, see [LICENSE](LICENSE).
