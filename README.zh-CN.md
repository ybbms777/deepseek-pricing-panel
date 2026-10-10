# DeepSeek API 计费时段面板

[English](README.md)

一个 HTML 文件。打开就知道 DeepSeek API 此刻按高峰价还是空闲价计费，以及下一次切换在什么时候。

![面板](docs/preview.png)

不用构建、不用起服务、不联网。双击即开。

## 规则

> 高峰 = 北京时间（UTC+8）周一至周五 09:00–12:00、14:00–18:00，不含中国法定节假日。
> 其余全部时段 —— 工作日夜里、午休 12:00–14:00、整个周末、整个节假日 —— 都按高峰价的 50% 计费。

同一批 token，单价差 2 倍，只看请求什么时候跑完。

## 跑起来

```bash
git clone https://github.com/ybbms777/deepseek-pricing-panel
cd deepseek-pricing-panel
```

浏览器打开 `index.html`。Windows 上也可以双击 `打开面板.bat`。

跑测试（需要 Node 20+，无第三方依赖）：

```bash
node --test        # 10 个用例 / 38 条断言
```

## 页面显示什么

它是 PC 面板，不是会整页滚动的网页：三栏工作区，视口高度内排布、页面不滚动，支持深浅色与键盘操作。

| 区域 | 内容 |
|---|---|
| 顶栏 | 当前档位、北京时间、距下次切换倒计时、复制摘要 |
| 左栏 | 本段窗口进度、接下来 4 次切换、7 天汇总、成本速算（填输入/输出 token → 现在跑 vs 全挪空闲的价差） |
| 中栏 | 未来 14 天时刻表（每天一条 24 小时轨道，高峰为实心段，今天带"此刻"竖线）+ 每日高峰小时数条形图 |
| 右栏 | 选中日详情、逐小时计费倍率条形图、单价表 |
| 底栏 | 规则摘要与数据来源 |

`↑`/`↓` 选日期，`T` 回今天，`D` 切深浅色；点击时刻表任一行，右栏显示该日详情。

## 数据从哪来

- 时段规则与单价：官方定价页脚注 `api-docs.deepseek.com/quick_start/pricing`
- 模型名与版本：实调 `GET https://api.deepseek.com/models`
- 节假日：国务院办公厅《关于 2026 年部分节假日安排的通知》，33 天
- 逻辑：`node --test` 跑 10 个用例 / 38 条断言，覆盖 09:00 / 12:00 / 14:00 / 18:00 四个边界、周末、春节与国庆、下次切换算法、空闲价 = 高峰价 ÷ 2，以及 CLI 退出码。CI 在 Ubuntu 与 Windows、Node 20 与 22 上跑。

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

退出码 0 = 空闲，3 = 高峰，2 = 出错。所以 `node deepseek_tier.mjs --quiet && run_your_batch`
本身就能把批处理推到便宜时段。

安装技能：把 `skills/deepseek-pricing-tier/` 复制进 Hermes 技能目录，或用 `DEEPSEEK_PANEL_HTML`
指向 `index.html`。

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

明年的放假通知出来后，把日期加进 `HOLIDAYS` 即可。

## 两个坑

- **调休上班的周六算空闲。** 官方规则只区分"周一至周五 / 周末"，2026-10-10（周六，调休上班）按规则算周末 → 空闲半价。若账单与此不符，以账单为准。
- **2027 年节假日未收。** 2026 年已内置；2027 年的通知公布后需补录。

## 许可

MIT，见 [LICENSE](LICENSE)。
