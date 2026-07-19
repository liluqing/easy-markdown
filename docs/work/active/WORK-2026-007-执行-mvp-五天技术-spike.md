---
id: WORK-2026-007
title: "执行 MVP 五天技术 Spike"
status: in-progress
requirement: REQ-2026-007
owner: "Codex"
created: 2026-07-18
updated: 2026-07-19
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
| `src-tauri/icons/icon.png` | absent | 用户于 2026-07-19 明确追加的应用图标工件 |
| `app-icon.png`, `src-tauri/icons/**` | `app-icon.png` absent；图标目录仅含本 WORK 生成的 `icon.png` | 用户于 2026-07-19 明确要求通过 Tauri CLI 生成完整平台图标集 |

## 3. 范围与非目标

### 范围

- 安装并验证 Rust stable MSVC、Cargo、Visual Studio Build Tools C++ 工具链、WebView2，并记录 Node/pnpm/Git/ripgrep 版本。
- 建立 Windows 首发最小 Tauri 2 + React + TypeScript + Vite 项目骨架、严格 CSP、最小 capability、Rust toolchain 固定和锁文件。
- 保留可继续开发的目录结构与启动/构建脚本，不加入业务 IPC 或领域模块。
- 保留一枚 512×512 PNG 应用图标源文件，并通过 Tauri CLI 生成 Windows、macOS、Linux 所需的完整平台图标集；不开启 bundle 或验证安装包。
- 优化仓库忽略规则，覆盖 pnpm 本地缓存、调试符号、TypeScript 增量元数据和测试报告等可重建产物；不忽略应用图标源文件或平台图标资产。

### 非目标

- 不实现文件保存、外部修改冲突、CodeMirror、Git CLI、ripgrep、Markdown 预览、Agent Worktree、性能测试或 E2E。
- 不做完整生产 UI、语雀迁移、PR API、自动更新、完整冲突解决器、跨平台适配或生产发布。
- bundle 保持关闭，安装/打包属于后续 Spike 切片。

## 4. 计划

- [x] 步骤 1：同步合并后的 `main`，创建精确基线分支，建立 REQ/WORK 记录。
- [x] 步骤 2：完成环境闸门；准备 Rust stable MSVC、Cargo、MSVC Build Tools、WebView2 与 pnpm 版本证据。
- [x] 步骤 3：生成并收敛 Tauri 2 + React/TypeScript/Vite 最小骨架，去除模板业务示例和多余 opener 权限。
- [x] 步骤 4：按用户追加授权生成 512×512 PNG 应用图标。
- [x] 步骤 5：将源图保存为根目录 `app-icon.png`，运行 `pnpm tauri icon app-icon.png` 生成并验证完整平台图标集。
- [x] 验证与文档：本切片已完成前端/Cargo metadata/Tauri info 与完整 `pnpm tauri build --debug` 验证；后续业务 Spike 另行执行。

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
| 2026-07-19 | 范围追加 | 用户明确要求“为当前应用生成一个图标，要求 512×512” | 追加单个图标源文件；不扩大到 bundle/安装包 |
| 2026-07-19 | 范围追加 | 用户提供并推荐 `pnpm tauri icon app-icon.png` 方法 | 批量生成平台派生图标；影响限定为 `app-icon.png` 与 `src-tauri/icons/**` |
| 2026-07-19 | Git 提交 | 用户要求提交当前代码并优化 Git 忽略配置 | 仅提交代码/文档与 `.gitignore`；按当前策略暂不自动纳入二进制图标 |

## 7. 风险与阻塞

- 风险：此前完整 Rust 编译曾被 Windows 应用控制策略以错误 4551 阻止，切换开发机策略后已通过；bundle 仍关闭，打包展示验证留待后续。
- 图标生成影响：Tauri CLI 会批量创建/覆盖 `src-tauri/icons/**` 中的派生图标；该目录当前仅含本 WORK 生成的 `icon.png`，不存在用户预有文件。
- 图标回退：删除本次派生图标并恢复生成前的单个 `icon.png` 即可；不修改应用代码、依赖或配置。
- 阻塞条件：已解除；开发机当前允许 Cargo build-script 执行。
- 解除人/条件：机器管理员/负责人将开发机 App Control 策略切换为允许开发构建的模式。
- 解除后的第一步：已在相同骨架上重跑 `pnpm tauri build --debug` 并确认通过；后续另建/恢复业务 Spike 切片。

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
| `pnpm tauri build --debug` | passed | 前端 Vite 构建与 Rust/Tauri 编译均通过；生成 `src-tauri/target/debug/easy-markdown.exe` | 仅验证 Debug 构建，不代表 bundle/安装包交付 |
| PNG 尺寸/格式检查 | passed | `512×512`, PNG | `src-tauri/icons/icon.png` |
| `pnpm tauri icon app-icon.png` | passed | 生成 52 个平台图标文件 | 含 48 个 PNG、`icon.ico`、`icon.icns` 和 2 个 Android XML |
| 平台图标完整性检查 | passed | 48 个 PNG 均可读取；ICO 为 256×256；ICNS 为 1024×1024；主 `icon.png` 为 512×512 | Pillow `verify()` |
| Git 忽略规则检查 | passed | `dist/`、Tauri/Cargo target、pnpm 缓存、测试报告、`*.tsbuildinfo`、`*.pdb` 均被忽略；`app-icon.png` 与 `src-tauri/icons/icon.png` 保持可跟踪 | `git check-ignore -v` |

## 9. 交接

- 当前状态：`in-progress`（本次启动切片已完成，等待后续业务 Spike）
- 已完成：同步合并后的 `main`；创建分支和 REQ/WORK；安装 Rust/MSVC 并确认 WebView2；生成并收敛 Tauri 2 + React/TypeScript/Vite 骨架；前端构建、Cargo metadata、Tauri info 通过；生成 512×512 PNG 源图，并通过 Tauri CLI 生成完整平台图标集。
- 未完成：实际业务开发和完整 Spike；bundle 接线、平台图标衍生格式和安装包留待后续切片。
- 下一具体动作：本次用户范围到此暂停；后续若继续，另建/恢复业务 Spike 切片。
- 修改路径：REQ/WORK、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`rust-toolchain.toml`、`index.html`、`vite.config.ts`、`tsconfig*.json`、`src/**`、`src-tauri/**`、`public/**`、`app-icon.png`。
- 已运行验证：环境版本盘点、pnpm install/approve-builds、前端 build、Cargo metadata、Tauri info、Tauri icon、图标格式/尺寸完整性检查、diff 检查。
- 未运行验证及原因：业务测试按用户要求未实现；bundle/安装包展示验证属于后续切片。
- 残余风险：Debug 构建已通过，但 bundle 仍关闭，图标尚未经过安装包展示验证。
- 工作区保护：任务开始时 `main` clean；REQ/WORK、骨架文件从 absent 新建；本次仅扩充 `.gitignore` 的可重建产物规则。
- 工作区保护：任务开始时 `main` clean；REQ/WORK 从 absent 新建；随后保留用户生成的 `app-icon.png` 与 `src-tauri/icons/**`，本次不自动暂存二进制图标。
- Git 状态：当前分支 `codex/WORK-2026-007-mvp-technical-spike`，尚无上游；base `ef912f5`；
  当前 HEAD 为 `ecdb8c7`，已包含本次 `.gitignore` 与 WORK 记录提交；工作区仅保留未跟踪的
  `app-icon.png` 和 `src-tauri/icons/**`；REQ/WORK 与骨架 owned paths 初始为 absent。
- 图标提交状态：`not-run`；仓库策略的 `allowed_binary_globs` 为空，本次提交不自动暂存 PNG/ICO/ICNS 二进制工件。
- PR 状态：`not-run`；未推送/未创建 Draft PR。改动命中 `package.json`、`Cargo.toml` 等 `remote_execution_paths`，按策略等待独立安全/维护者批准后再推送。
- 终态说明：`done` 可在归档后进入 Ready/merge；`abandoned` 必须记录原因、未满足验收、
  保留结果、残余风险和后续负责人，永不 Ready/merge。
