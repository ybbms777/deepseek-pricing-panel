# DeepSeek API 计费时段面板

[English](README.md) · **简体中文**

![无需构建](https://img.shields.io/badge/build-none-brightgreen)
![零依赖](https://img.shields.io/badge/dependencies-0-blue)
![单文件](https://img.shields.io/badge/single--file-index.html-informational)
![离线可用](https://img.shields.io/badge/works-offline-lightgrey)
![跨平台](https://img.shields.io/badge/platform-any%20browser-success)
![内置节假日](https://img.shields.io/badge/China%20holidays-2026%20built--in-orange)
![许可](https://img.shields.io/badge/license-MIT-green)

**就一个 HTML 文件。打开它，立刻知道 DeepSeek API 现在按高峰价（全价）还是空闲价（半价）在给你计费** —— 带秒级倒计时，还有一张已经把周末和中国法定节假日算进去的未来 7 天时刻表。

![DeepSeek 峰谷计费面板](docs/preview.png)

不用构建、不用 npm、不用起服务、不用登录、不联网，双击即开。

## 一句话说清规则

> **高峰** = 北京时间（UTC+8）**周一至周五 09:00–12:00、14:00–18:00**，且**不含中国法定节假日**。
> **其余全部时段** —— 工作日夜里、午休 12:00–14:00、整个周末、整个节假日 —— 都是**空闲，价格正好是高峰的一半**。

同样的 token，**价格差整整 2 倍**，只看你的请求在什么时候跑完。这是大多数 DeepSeek API 用户从没拉过的、最便宜的一根杠杆。

## 面板显示什么

| 区块 | 给你什么 |
|---|---|
| 状态横幅 | 此刻是高峰还是空闲、北京时间时钟、距下次切换的实时倒计时 |
| 单价表 | `deepseek-flash` / `deepseek-v4-pro` 单价，当前生效档高亮、另一档灰色括注，附并发上限 |
| 未来 7 天 | 每天一条 24 小时时间条：红 = 高峰，绿 = 空闲，周末与节假日单独标注 |
| 切换列表 | 接下来 4 次高峰 ↔ 空闲切换的准确时刻 |

## 同类工具已经很多了，为什么还要用它

这个问题上早就有 Windows 托盘指示器、WinUI 小组件、KDE Plasma 小挂件、OpenCode/TUI 插件、Docker 托管的页面。这个面板的定位是**零安装 + 认得中国节假日**：

- **真·节假日感知。** 峰谷判定不是简单的「UTC 工作日 + 小时」。它在「工作日 / 周末」规则之上叠加了国务院公布的 2026 年放假安排（33 天：元旦、春节、清明、劳动节、端午、中秋、国庆）—— 这是「周一九点」和「十一黄金周那个周一九点」的区别，只按工作日算的挂件会算错。
- **零安装、零依赖、零联网。** 一个约 13 KB 的文件：没有框架、没有 CDN、没有埋点。U 盘、共享盘、内网隔离机、编辑器旁边的 iframe，哪儿都能跑。
- **只要有浏览器就能用。** 不是 Windows 专用，不是要编译的原生程序，不是要一直开着的容器。
- **核心逻辑可测试。** 时段调度逻辑与 DOM 解耦，装在 `/*CORE-START*/ … /*CORE-END*/` 段里，可以直接抽到 Node 上断言 —— 22 项断言覆盖时段边界、节假日、下次切换算法与半价不变式。
- **看门道的地方也写清楚了。** 比如顺手记下了一个很多人踩的坑：`deepseek-flash` **不是** V4-Flash（见下）。

## 快速开始

```bash
git clone https://github.com/ybbms777/deepseek-pricing-panel
cd deepseek-pricing-panel
```

浏览器打开 `index.html`，Windows 上也可以直接双击 `打开面板.bat`。

想把它摆在终端旁边？嵌进去就行：

```html
<iframe src="index.html" width="860" height="920" style="border:0"></iframe>
```

## 模型名：这个面板顺手记录的坑

API 的模型名和模型版本**不是一回事**：

| API 模型名 | 实际模型 | 说明 |
|---|---|---|
| `deepseek-flash` | **DeepSeek-V4.1-Flash** | 1M 上下文、最大 384K 输出、支持图像输入 |
| `deepseek-v4-pro` | **DeepSeek-V4-Pro**（官方文档写 `DeepSeek-V4-Pro-0813`） | 1M 上下文、最大 384K 输出、不支持图像 |

所以 `deepseek-flash` **不是** V4-Flash。旧模型名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 仍可调用，但对应模型已下线 —— 请求由 DeepSeek-V4.1-Flash 承接，按 Flash 价格计费。这一点是实调 `GET https://api.deepseek.com/models` 核对的，该接口会同时返回 `id` 和 `name`。

## 单价（元 / 百万 tokens，官方公布口径）

| 模型 | 输入 · 缓存命中 | 输入 · 缓存未命中 | 输出 | 并发上限 |
|---|---|---|---|---|
| `deepseek-flash` 空闲 | 0.02 | 1 | 4 | 2500 |
| `deepseek-flash` 高峰 | 0.04 | 2 | 8 | 2500 |
| `deepseek-v4-pro` 空闲 | 0.15 | 4.5 | 13.5 | 500 |
| `deepseek-v4-pro` 高峰 | 0.30 | 9.0 | 27.0 | 500 |

每一行空闲价都正好是高峰价的一半。规则与单价转录自官方定价页；官方随时可能调整，所以请把面板当作「已公布规则的可视化」，而不是规则本身。

## 每一条都能溯源

- **时段规则与单价** —— 官方定价页脚注 `api-docs.deepseek.com/quick_start/pricing`。
- **模型 id 与版本** —— 实调 `GET api.deepseek.com/models`，不是抄博客。
- **节假日** —— 国务院办公厅《关于 2026 年部分节假日安排的通知》。
- **逻辑** —— 22 项断言，覆盖 09:00 / 12:00 / 14:00 / 18:00 四个边界、周末、春节与国庆、下次切换算法、以及「空闲价 = 高峰价 × 50%」不变式。

## 一分钟改完

所有可调项都在 `index.html` 的 `/*CORE-START*/ … /*CORE-END*/` 段内：

```js
HOLIDAYS          // 法定节假日集合（'YYYY-MM-DD'）
PRICES            // 模型 → 版本名 / [空闲, 高峰] 单价 / 并发上限
isPeakHour(y,mo,d,h)
tierAt(ts)        // 'off' | 'peak'
nextSwitch(ts)    // 下一次档位切换的时间戳
daySegments(ts)   // 某天（北京时间）的高峰区间
```

明年的放假通知出来了？把日期追加进 `HOLIDAYS` 就行。不用重新构建，不用发版。

## 常见问题

**调休上班的周六（比如 2026-10-10）算高峰吗？** 官方规则只区分「周一至周五 / 周末」，所以调休上班的周六仍按周末算 → 空闲半价。面板按同一口径显示，并在页脚标出这个坑。若对账单与之不符，以账单为准。

**需要 API key 吗？** 不需要。面板从不访问 DeepSeek，纯粹是按公开规则做的本地计算 —— 没有密钥可泄露，也不会被限流。

**2027 年的节假日呢？** 2026 年已内置。2027 年通知公布后，把日期加进 `HOLIDAYS` 即可。

**这是官方工具吗？** 不是。独立第三方，与 DeepSeek 无关；以其官方定价页为准。

## 许可

MIT —— 见 [LICENSE](LICENSE)。
