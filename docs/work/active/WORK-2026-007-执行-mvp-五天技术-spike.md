---
id: WORK-2026-007
title: "执行 MVP 五天技术 Spike"
status: in-progress
requirement: REQ-2026-007
owner: "Codex"
created: 2026-07-18
updated: 2026-07-18
---

# WORK-2026-007：执行 MVP 五天技术 Spike

## 1. 目标

执行 [REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md) 的启动切片：只准备 Windows 开发环境并交付
Tauri 2 + React/TypeScript/Vite/Rust 的最小项目骨架；本 WORK 当前切片不实现文件、Git、搜索、预览或 E2E 业务功能。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md)。
- 相关产品/技术/ADR：[MVP PRD](../../product/02-mvp-prd.md)、[用户故事](../../product/04-user-stories.md)、
  [Spike 计划](../../technical/03-spike-plan.md)、[技术选型](../../technical/02-technology-selection.md)、
  [ADR 索引](../../technical/adr/README.md)。
- 当前分支/worktree：`codex/WORK-2026-007-mvp-technical-spike`，仓库根工作树。
- 上游/HEAD：分支刚从 `main` 创建，HEAD `ef912f53afbeec51bbb0bf9a3c383aaaf17e9f08`。
- 基线引用/SHA：`origin/main` / `ef912f53afbeec51bbb0bf9a3c383aaaf17e9f08`。
- Git 策略模式/canonical repository：`active` / `liluqing/easy-markdown`。
- 启动时 Git 状态：`main` 已快进同步且 clean；随后本 WORK 新建两个文档文件。
- 远端/PR 状态：尚未 push 或创建 PR；当前工作切片先完成环境闸门和 Spike 计划记录。
- 必须保护、但不属于本 WORK 的用户改动：无。

| 目标路径 | 任务开始状态 | 归属/可暂存证据 |
| --- | --- | --- |
| `docs/requirements/REQ-2026-007-mvp-五天技术-spike.md` | absent | 本 WORK 新建 REQ |
| `docs/work/active/WORK-2026-007-执行-mvp-五天技术-spike.md` | absent | 本 WORK 执行记录 |
| `package.json`, `pnpm-lock.yaml`, `src/**`, `src-tauri/**`, `tests/**` | absent | 预期 Spike 工件，尚未创建 |

## 3. 范围与非目标

### 范围

- 安装并验证 Rust stable MSVC、Cargo、Visual Studio Build Tools C++ 工具链、WebView2，并记录 Node/pnpm/Git/ripgrep 版本。
- 建立 Windows 首发最小 Tauri 2 + React + TypeScript + Vite 项目骨架、严格 CSP、最小 capability、Rust toolchain 固定和锁文件。
- 保留可继续开发的目录结构与启动/构建脚本，不加入业务 IPC 或领域模块。

### 非目标

- 不实现文件保存、外部修改冲突、CodeMirror、Git CLI、ripgrep、Markdown 预览、Agent Worktree、性能测试或 E2E。
- 不做完整生产 UI、语雀迁移、PR API、自动更新、完整冲突解决器、跨平台适配或生产发布。
- 不提交生成的二进制图标；bundle 保持关闭，安装/打包属于后续 Spike 切片。

## 4. 计划

- [x] 步骤 1：同步合并后的 `main`，创建精确基线分支，建立 REQ/WORK 记录。
- [x] 步骤 2：完成环境闸门；准备 Rust stable MSVC、Cargo、MSVC Build Tools、WebView2 与 pnpm 版本证据。
- [x] 步骤 3：生成并收敛 Tauri 2 + React/TypeScript/Vite 最小骨架，去除模板业务示例和多余 opener 权限。
- [ ] 验证与文档：本切片已完成前端/Cargo metadata/Tauri info 验证；完整 Rust 编译受机器应用控制策略阻塞，后续业务 Spike 另行执行。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | 每个 Spike 目标在 WORK/`research/` 中记录实验、环境、命令、结果和限制 | deferred（后续 Spike） |
| AC-2 | 本切片完成 Tauri 壳骨架、严格 CSP、最小 capability 和 Windows 环境版本盘点；行为边界实验后续执行 | partial |
| AC-3 | 文件/编码/外部修改、Git CLI 取消超时、Porcelain、Worktree 测试 | deferred（后续 Spike） |
| AC-4 | 10,000 文件搜索 P95 < 2 秒、取消 < 500 ms、安全 Markdown 测试 | deferred（后续 Spike） |
| AC-5 | WebdriverIO E2E、Rust 集成、性能 CSV、安全清单 | deferred（后续 Spike） |
| AC-6 | ADR 结论、Go 判断和 Sprint 1 任务拆分 | deferred（后续 Spike） |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 授权 | 用户明确说“嗯，开始吧”，授权建立并实施本 Spike | repository owner |
| 2026-07-18 | 假设 | 先完成只读环境闸门；工具链安装作为独立环境动作，不把缺失工具伪装成已验证 | Spike 计划 |
| 2026-07-18 | 范围收窄 | 用户明确本次只准备开发环境和项目骨架，不做实际开发 | 当前 WORK 只交付启动切片 |

## 7. 风险与阻塞

- 风险：完整 Rust 编译被 Windows 应用控制策略以错误 4551 阻止；bundle 图标未纳入，打包验证留待后续。
- 阻塞条件：若要继续运行 Tauri Rust 编译，需要机器管理员为构建脚本执行提供允许策略。
- 解除人/条件：机器管理员/负责人调整应用控制策略，或提供允许 Cargo build-script 的开发环境。
- 解除后的第一步：在相同骨架上重跑 `pnpm tauri build --debug`，再开始后续业务 Spike。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| `git status --short --branch` / `git rev-parse HEAD` | passed | clean `main`; base `ef912f5` | 已完成并创建 Spike 分支 |
| Git remote URL/策略预检 | passed | HTTPS origin 与 active policy 完全匹配 | 无 rewrite/multi-url |
| Node/pnpm/Git/ripgrep 版本盘点 | passed | Node 24.17.0; pnpm 11.9.0; Git 2.54.0; rg 15.1.0 | 已具备 |
| Rust/Cargo/MSVC 工具盘点 | blocked | `cargo`/`rustc` 不在 PATH；MSVC 未发现 | 安装动作未执行 |
| `node scripts/harness/check-harness.mjs` | not-run | 记录创建后再运行 | 当前切片未完成 |
| `pnpm install` + `pnpm approve-builds esbuild` | passed | 依赖锁定、仅批准 esbuild 安装脚本 | 生成 `pnpm-lock.yaml`/`pnpm-workspace.yaml` |
| `pnpm build` | passed | Vite 7.3.6，29 modules，生成 `dist/` | 前端骨架通过 |
| `cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps` | passed | `CARGO_METADATA_OK` | Rust manifest/依赖图可解析 |
| `pnpm tauri info` | passed | WebView2 150.0.4078.65、VS Build Tools 2026、Rust 1.97.1、Tauri 2.11.5 | 环境与配置一致 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | passed | Rust skeleton formatting clean | `rustfmt` component installed for pinned toolchain |
| `pnpm tauri build --debug` | blocked | Windows 应用控制策略拒绝 Cargo build-script，错误 4551；仓库路径与 `%TEMP%` 均复现 | 不是源码编译诊断 |

## 9. 交接

- 当前状态：`in-progress`（本次启动切片已完成，等待后续业务 Spike）
- 已完成：同步合并后的 `main`；创建分支和 REQ/WORK；安装 Rust/MSVC 并确认 WebView2；生成并收敛 Tauri 2 + React/TypeScript/Vite 骨架；前端构建、Cargo metadata、Tauri info 通过。
- 未完成：实际业务开发和完整 Spike；Rust 编译/打包被机器应用控制策略阻塞，bundle 图标和安装包留待后续切片。
- 下一具体动作：本次用户范围到此暂停；后续若继续，先解决应用控制策略，再另建/恢复业务 Spike 切片。
- 修改路径：REQ/WORK、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`rust-toolchain.toml`、`index.html`、`vite.config.ts`、`tsconfig*.json`、`src/**`、`src-tauri/**`、`public/**`。
- 已运行验证：环境版本盘点、pnpm install/approve-builds、前端 build、Cargo metadata、Tauri info、diff 检查。
- 未运行验证及原因：完整 `pnpm tauri build --debug` 因 Windows 应用控制策略错误 4551 阻塞；业务测试按用户要求未实现。
- 残余风险：未证明 Rust 编译器能执行依赖 build-script；bundle 关闭且无图标资产，不可作为安装包交付。
- 工作区保护：任务开始时 `main` clean；REQ/WORK、骨架文件从 absent 新建；原有 `.gitignore` 已恢复未改动。
- 工作区保护：任务开始时 `main` clean；REQ/WORK 从 absent 新建；无用户 modified/staged/untracked 文件。
- Git 状态：当前分支 `codex/WORK-2026-007-mvp-technical-spike`，尚无上游；base `ef912f5`；
  当前 HEAD `c0c2851`；工作区 clean；REQ/WORK 与骨架 owned paths 初始为 absent；本地检查点已提交。
- PR 状态：`not-run`；未推送/未创建 Draft PR。改动命中 `package.json`、`Cargo.toml` 等 `remote_execution_paths`，按策略等待独立安全/维护者批准后再推送。
- 终态说明：`done` 可在归档后进入 Ready/merge；`abandoned` 必须记录原因、未满足验收、
  保留结果、残余风险和后续负责人，永不 Ready/merge。
