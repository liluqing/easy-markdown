# ADR-0001：桌面框架使用 Tauri 2

| 字段 | 内容 |
| --- | --- |
| 状态 | Accepted for Spike |
| 日期 | 2026-07-18 |

## 背景

产品需要跨平台桌面 UI、本地文件访问、Git 进程、严格路径边界和相对较小的运行体积。

## 决策

MVP 默认使用 Tauri 2：

- React/TypeScript 运行在系统 WebView。
- Rust Core 承担所有高权限操作。
- WebView 只调用明确授权的窄 IPC Commands。

## 后果

正面：

- 文件和进程能力集中在 Rust 信任边界。
- 前端不直接拥有 Node.js。
- 安装和基础资源占用低于 Electron。

负面：

- 团队需要 Rust、MSVC 和 WebView2 工具链。
- 系统 WebView 带来跨平台差异。

## 回退

若五天 Spike 中中文 IME、E2E、WebView2 或团队 Rust 维护能力不达标，切换 Electron，并执行严格的 Sandbox、Context Isolation、CSP 和窄 Preload API。
