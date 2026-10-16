# DeepSeek API 计费时段面板

[English](README.md)

一个 HTML 文件。打开就知道 DeepSeek API 此刻按高峰价还是空闲价计费，以及下一次切换在什么时候。

![面板](docs/preview.png)

不用构建、不用起服务、不联网。双击即开。

## 规则

> 高峰 = 北京时间（UTC+8）周一至周五 09:00–12:00、14:00–18:00，不含中国法定节假日。
> 其余全部时段 —— 工作日夜里、午休 12:00–14:00、整个周末、整个节假日 —— 都按高峰价的 50% 计费。

同模型、同量 token，两档单价差 2 倍。官方定价页未说明跨时段请求如何归档，以实际账单为准。

## 跑起来

```bash
git clone https://github.com/ybbms777/deepseek-pricing-panel
cd deepseek-pricing-panel
```

浏览器打开 `index.html`。Windows 上也可以双击 `打开面板.bat`。

### 桌面版（Windows / Tauri）

`desktop/` 把同一份面板包成 Tauri 壳：原生窗口 + 系统托盘（显示/隐藏、置顶开关、退出），关窗收进托盘而不退出。壳里跑的就是这份 HTML，逻辑没有重写。

```bash
node desktop/tools/sync-panel.mjs        # 把当前面板同步进壳
cd desktop && npx @tauri-apps/cli build  # → src-tauri/target/release/bundle/nsis/
```

本地 Rust 构建会校验内嵌副本与 `index.html` 一致，不一致就停止构建并提示同步。直接使用 Cargo 构建也有此保护；CI 另有一致性检查。

**下载**：安装包由 GitHub Actions 在打标签的那个提交上、于 `windows-latest` 构建，与 `SHA256SUMS.txt` 一起附在 [Releases](https://github.com/ybbms777/deepseek-pricing-panel/releases) —— 不发布任何手工本地构建的产物。

如实说明限制：安装包**未签名**（SmartScreen 会提示），需要目标电脑已有 WebView2（Win10/11 自带），托盘与窗口交互**尚未在真实桌面上做过人工验收** —— 已验证的只有面板逻辑、构建与一致性守卫。只想看面板就直接打开 `index.html`，不需要安装。

跑测试（需要 Node 20+，无第三方依赖）：

```bash
node --test        # 逻辑、CLI、安装和渲染回归
```

## 页面显示什么

三栏工作区在视口高度内排布，支持深浅色与键盘操作。窗口窄于 1180px 时可横向滚动到其余栏；输入框中的方向键保留原生行为。

| 区域 | 内容 |
|---|---|
| 顶栏 | 当前档位、北京时间、距下次切换倒计时、复制摘要 |
| 左栏 | 本段窗口进度、接下来 4 次切换、7 天汇总、成本速算（填输入/输出 token → 现在跑 vs 全挪空闲的价差） |
| 中栏 | 未来 14 天时刻表（每天一条 24 小时轨道，高峰为实心段，今天带"此刻"竖线）+ 每日高峰小时数条形图 |
| 右栏 | 选中日详情、逐小时计费倍率条形图、单价表 |
| 底栏 | 规则摘要与数据来源 |

`↑`/`↓` 选日期，`T` 回今天，`D` 切深浅色；点击时刻表任一行，右栏显示该日详情。

## 数据从哪来

- 时段规则与单价：[官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)，2026-10-15 核对
- 模型名与版本：实调 `GET https://api.deepseek.com/models`
- 节假日：国务院办公厅《关于 2026 年部分节假日安排的通知》，33 天
- 逻辑：`node --test` 覆盖时段边界、节假日、下次切换、半价关系、CLI 参数与时间窗口、独立目录安装、年份覆盖及固定时钟渲染。已有 CI 使用 Ubuntu/Windows、Node 20/22；本地测试无需 CI。

## 模型名

API 的模型名和模型版本不是一回事：

| API 模型名 | 实际模型 | 说明 |
|---|---|---|
| `deepseek-flash` | DeepSeek-V4.1-Flash | 1M 上下文，最大 384K 输出，支持图像输入 |
| `deepseek-v4-pro` | DeepSeek-V4-Pro | 1M 上下文，最大 384K 输出，不支持图像 |

`deepseek-flash` 不是 V4-Flash。旧模型名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 仍可调用，但对应模型已下线，请求由 DeepSeek-V4.1-Flash 承接，按 Flash 价格计费。

## 单价（元 / 百万 tokens）

| 模型 | 输入·缓存命中 | 输入·缓存未命中 | 输出 | 并发上限 |
|---|---|---|---|---|
| `deepseek-flash` 空闲 | 0.02 | 1 | 4 | 2500 |
| `deepseek-flash` 高峰 | 0.04 | 2 | 8 | 2500 |
| `deepseek-v4-pro` 空闲 | 0.15 | 4.5 | 13.5 | 500 |
| `deepseek-v4-pro` 高峰 | 0.30 | 9.0 | 27.0 | 500 |

单价与规则转录自官方定价页，官方可能调整，所以把它当作"已公布规则的可视化"，不是规则本身。

## 给 Hermes Agent 用，或写进脚本

仓库里带一个 Hermes 技能 `skills/deepseek-pricing-tier/`。它的 CLI 直接抽取 `index.html` 里的
`/*CORE-START*/ … /*CORE-END*/` 段来执行，不另写一份逻辑：

```bash
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs            # 现在
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --json     # 给 Agent 读
node skills/deepseek-pricing-tier/scripts/deepseek_tier.mjs --days 7   # 未来切换时刻
```

退出码 0 = 空闲，3 = 高峰，2 = 出错或节假日覆盖不完整。`node deepseek_tier.mjs --quiet && run_your_batch`
仅在此次检查返回 0 时执行批处理；高峰时跳过，不会等待、重试或自动延后。`--quiet` 下警告仍写入 stderr。

`--days N` 接受 0–366 的整数，按滚动区间 `[at, at + N×24小时)` 列出切换：包含恰好落在起点的切换，排除终点；0 不列出切换。`--at` 必须是含秒和明确 `Z` 或时区偏移的 ISO 日期时间。网页的7天概览则按今天北京时间零点起的7个自然日统计。

安装时需**同时带上 HTML 依赖**。在仓库内执行下列命令，目标须为尚不存在的技能目录，避免覆盖其他改动：

```bash
node tools/install-skill.mjs /path/to/hermes/skills/deepseek-pricing-tier
```

也可从任意工作目录用绝对路径调用安装脚本。安装后的 `scripts/deepseek_tier.mjs` 不依赖当前工作目录。手动安装需把技能目录和仓库 `index.html` 一同放入目标技能目录；或明确用 `--panel` / `DEEPSEEK_PANEL_HTML` 指向仓库 HTML。显式路径不存在时报错，不再静默回退。

JSON 提供 `data_metadata`、`current_calendar_covered`、`calendar_coverage` 和 `warnings`。覆盖检查包含下次切换所查日期及所请求的未来窗口；跨年缺口也返回退出码2。未维护年份仅按周规则估算，不能当作已核实的节假日结论。网页会警告14天时刻表中的任何年份缺口。

## 改一处就能用

可调项都在 `index.html` 的 `/*CORE-START*/ … /*CORE-END*/` 段里：

```js
HOLIDAYS          // 法定节假日集合（'YYYY-MM-DD'）
PRICES            // 模型 → 版本名 / [空闲, 高峰] 单价 / 并发上限
isPeakHour(y,mo,d,h)
tierAt(ts)        // 'off' | 'peak'
nextSwitch(ts)    // 下一次档位切换的时间戳
daySegments(ts)   // 某天（北京时间）的高峰区间
```

明年的放假通知出来后，核实日期并加入 `HOLIDAYS`，再更新 `DATA_METADATA.holiday_years` 及来源。重新核对价格后才能更新 `pricing_checked_on`。

## 两个坑

- **调休上班的周六算空闲。** 官方规则只区分"周一至周五 / 周末"，2026-10-10（周六，调休上班）按规则算周末 → 空闲半价。若账单与此不符，以账单为准。
- **2027 年节假日未收。** 2026 年已内置；2027 年的通知公布后需补录。

## 许可

MIT，见 [LICENSE](LICENSE)。
