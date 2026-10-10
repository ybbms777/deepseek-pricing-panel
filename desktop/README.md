# 桌面壳（Tauri）

把仓库根目录的 `index.html` 包成一个 Windows 桌面程序：一个原生窗口 + 系统托盘。
**不重写任何逻辑** —— 壳里跑的就是面板那一份 HTML。

## 结构

```
desktop/
├─ dist/index.html          ← 由 tools/sync-panel.mjs 从 ../../index.html 生成（已提交，CI 守漂移）
├─ dist/panel.sha256        ← 生成清单：源文件与 sha256
├─ tools/sync-panel.mjs     ← 同步 / 校验（--check）
└─ src-tauri/
   ├─ src/main.rs           ← 窗口 + 托盘（显示/隐藏、置顶开关、退出；关窗收进托盘）
   ├─ tauri.conf.json       ← 窗口 1440×900，最小 1180×700，居中
   ├─ Cargo.toml
   └─ icons/                ← 由 cargo tauri icon 从一张 1024×1024 PNG 生成
```

## 构建与运行

```sh
node desktop/tools/sync-panel.mjs          # 先把当前面板同步进 dist/
cd desktop
npx @tauri-apps/cli build --debug          # 开发用二进制：src-tauri/target/debug/deepseek-pricing-panel.exe
npx @tauri-apps/cli build                  # 发布：NSIS 安装包（src-tauri/target/release/bundle/nsis/）
```

前提：Rust MSVC 工具链、Visual Studio Build Tools（链接器）、WebView2 运行时（Win10/11 自带）。

## 刻意的取舍

- **权限表留空**（`capabilities/default.json` 只有 `core:default`）：面板是纯静态页面，不需要任何 IPC 能力，少给一分是一分。
- **关窗即收进托盘**，不退出 —— 这是常驻工具，误点关闭不该丢状态（面板本身无状态，重新打开即最新）。
- **置顶**放在托盘菜单里开关，而不是写死：看代码时不一定想让它压在最上层。
- **不做自动更新**：现在没有分发渠道，加了只会增加签名与网络面。要发版时再加更新器。
