# DeepSeek API 计费时段面板

一个单文件、离线可用的 HTML 面板，实时显示 **DeepSeek API 当前该按高峰价还是空闲（半价）计费**，以及未来 7 天的时段分布和下一次切换时刻。

![无需构建](https://img.shields.io/badge/build-none-brightgreen) ![单文件](https://img.shields.io/badge/single--file-index.html-blue)

## 计费规则（来自官方定价页脚注）

- **高峰时段**：北京时间 **周一至周五 9:00–12:00、14:00–18:00**（不含中国法定节假日）
- **空闲时段**：其余全部时段 —— 工作日 18:00–次日 9:00、午休 12:00–14:00，以及**周末和中国法定节假日全天**
- 空闲价为高峰价的 **50%**
- 计费按**请求完成时刻**落入哪个时段判定，跨时段的长请求需注意

## 面板显示什么

| 区块 | 内容 |
|---|---|
| 状态横幅 | 当前档位（空闲半价 / 高峰全价）、北京时间秒级时钟、距下次切换的倒计时 |
| 单价表 | `deepseek-flash`、`deepseek-v4-pro` 的三类单价，当前生效档高亮，另一档灰色括注，附并发上限 |
| 未来 7 天 | 每天一条 24 小时时间条，红色 = 高峰，绿色 = 空闲；标注周末 / 法定节假日 |
| 切换列表 | 接下来 4 次高峰 ↔ 空闲切换的准确时刻 |

## 用法

直接双击 `index.html`，或双击 `打开面板.bat`（Windows 用默认浏览器打开）。纯静态页面，无需服务器、无外部依赖、不联网。

## 模型名与版本

面板显示的是**官方 API 模型名 + 实际版本**：

- `deepseek-flash` → **DeepSeek-V4.1-Flash**（1M 上下文 / 最大 384K 输出 / 支持图像输入）
- `deepseek-v4-pro` → **DeepSeek-V4-Pro**（官方文档「模型版本」写作 `DeepSeek-V4-Pro-0813`）

> 注意：`deepseek-flash` **不是** V4-Flash。旧模型名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 已下线，仍可调用但由 DeepSeek-V4.1-Flash 承接，并按 Flash 价格计费。

## 数据来源与核对

- 时段规则与单价：官方定价页 `api-docs.deepseek.com/quick_start/pricing`
- 模型 id 与版本名：实调 `GET https://api.deepseek.com/models` 返回的 `id` / `name`
- 中国法定节假日：2026 年国务院办公厅《关于 2026 年部分节假日安排的通知》（元旦 3 天、春节 9 天、清明 3 天、劳动节 5 天、端午 3 天、中秋 3 天、国庆 7 天，共 33 天）

## 需要留意

- **调休上班日**：官方规则只区分「周一至周五 / 周末」，因此像 2026-10-10（周六，调休上班）这类日子仍按周末算 → 空闲半价。若对账单与此不符，以实际账单为准。
- **2027 年放假安排**公布后，需在 `index.html` 的 `HOLIDAYS` 集合里补录。
- 单价与规则可能调整，请以官方定价页为准；面板只是把规则可视化。

## 自定义

所有可调项都集中在 `index.html` 的 `/*CORE-START*/ … /*CORE-END*/` 段内，且不依赖 DOM，可直接抽出来在 Node 里测试：

```js
HOLIDAYS          // 法定节假日集合（'YYYY-MM-DD'）
PRICES            // 模型 → 版本名 / 三类单价 [空闲, 高峰] / 并发上限
isPeakHour(y,mo,d,h)
tierAt(ts)        // 'off' | 'peak'
nextSwitch(ts)    // 下一次档位切换的时间戳
daySegments(ts)   // 某天的高峰时段区间
```
