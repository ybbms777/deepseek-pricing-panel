# 实施交接

更新日期：2026-10-15。基准：`main` 的 `2e6fdca03aa925eee489430cf5bb5a35b33fd974`。分支：`fix/pricing-panel-correctness`。

## 已完成

- 7天概览只累计今天北京时间零点起7个自然日，14天时刻表保持不变。固定2026-10-12为35小时高峰、133小时空闲；时长占比与同量token从高峰移至空闲节省50%的费用明确区分。选中日错误换算也已修正。
- 网页和CLI共用档位原因，高峰不再显示“高峰之外”。
- CLI `--days N`改为滚动`[at, at + N×24小时)`，包含起点切换、排除终点，无事件数量截断。N为0–366整数，0省略列表。缺值、非法参数/日期、无时区日期、显式缺失HTML路径返回2；`--at`要求含秒和时区的ISO时间。
- 安装脚本同时复制技能和HTML，拒绝覆盖已有目标目录；安装脚本与已安装CLI均可从任意cwd运行。文档明确`&& batch`高峰时跳过，不会自动延后。
- 网页和JSON增加价格核对日期、官方来源及节假日覆盖年份。未维护年份、未来跨年窗口明确警告并标为估算；CLI覆盖检查还包括下次切换所查日期，覆盖缺口返回2。
- [官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)于2026-10-15核对，现有价格与周规则保持。删除“按请求完成时刻判定”的无依据表述，未补造2027假日。模型映射历史核对日期保留2026-10-10，未声称本次重新实调模型API。
- 保留1180px桌面布局并恢复窄屏横向滚动；数字输入与可编辑区域不再被全局快捷键拦截。
- Rust构建前校验根HTML与内嵌HTML，兼容CRLF/LF，旧副本阻止构建并提示同步。已同步`desktop/dist`，规则核心仍只有根HTML一份。

## 实际验证

| 验证 | 结果 |
|---|---|
| 修改前Node测试 | 10/10通过 |
| 修改后Node测试 | 16/16通过，包含CLI滚动边界、21天60次切换、非法参数、覆盖检查、独立目录安装及固定时钟render回归 |
| 独立Rust保护测试 | 3/3通过：相同HTML、CRLF/LF、旧HTML拒绝 |
| 内嵌HTML一致性 | 同步后的`--check`通过 |
| Release桌面构建 | Windows x64、Rust1.98.1/MSVC，Tauri CLI2.12.2，`build --no-bundle -- --locked --offline`成功；没有构建安装包 |
| 实际桌面WebView2 | Edge155.0.4283.45，载入`http://tauri.localhost/`，确认新价格核对元数据、35/133小时、输入上键2→2.1、主题切换、2027警告及估算标记，无pageerror |
| 独立真实浏览器 | Chromium153，1440×900、390×844、1180×700；方向键、主题、来源链接、跨年提示、复制失败回退通过；390px下可横向滚动790px |

真实WebView的主题点击需要等待异步状态变化后断言，已修正本地测试时序；产品代码无需为此改动。最小DOM回归和真实浏览器验证分别记录，不混称视觉测试。截图已目视检查。

## 本地构建与证据

Tauri CLI2.12.2和平台包安装在项目`desktop/node_modules`，没有全局安装。npm cache、CARGO_HOME、CARGO_TARGET_DIR、TEMP/TMP及WebView测试数据均显式指向项目D盘`output`；没有修改全局环境、系统组件或证书。依赖清单和Cargo.lock未改变。

忽略的`output/`保存构建日志、测试记录、截图和PR草稿，不纳入提交。运行时及Windows管理的系统记录可能少量写入系统盘，不能承诺系统盘零写入。本机磁盘、完整路径等详情仅保存在本地记录中。

## 剩余限制

- 已从固定CLI源码核实NSIS3.11和Tauri NSIS插件0.5.3，下载仍待单独授权；未下载NSIS、未生成或公开安装包。
- 安装/卸载、托盘显示隐藏、关窗恢复、置顶和托盘退出未验证。当前执行环境没有原生Windows Computer Use会话；实际WebView自动化不能替代这些交互验证。测试使用进程清理结束程序，不冒充托盘退出通过。
- Hermes/DSH宿主端到端未验证；已验证安装后CLI从无关工作目录运行。
- 2027节假日未维护；不得将按周规则的估算当作官方完整结论。

## 远程交付边界

只同步既有公开仓库修复分支并创建中文草稿PR；不合并、不部署、不公开发布安装包。

现有源码测试工作流监听main的push、pull_request及手动workflow_dispatch。提交使用`[skip ci]`以跳过push/PR自动运行；该标记不覆盖手动事件、pull_request_target或后续无标记提交，必需检查也可能保持Pending。依据：[GitHub跳过工作流说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)。

仓库另有GitHub Pages动态工作流，已只读核对发布源为main根目录。本次不更改main，不修改Pages或Actions设置，不手动触发工作流。远程交付后核对修复提交及PR没有产生Actions运行。
