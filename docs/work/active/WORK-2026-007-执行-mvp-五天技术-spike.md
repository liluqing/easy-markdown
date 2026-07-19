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

执行 [REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md) 的启动切片、
Day 1 和 Day 2 首个纵向切片：在已验证的 Tauri 2 + React/TypeScript/Vite/Rust 骨架上，
交付由 Rust 控制的工作区选择、文档列表、UTF-8 文本读取、带版本令牌的安全保存，以及
CodeMirror 6 手动编辑闭环。本切片仍不实现自动保存、递归 Watch、Merge View、Git、搜索、
预览或 E2E 业务闭环。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md)。
- 相关产品/技术/ADR：[MVP PRD](../../product/02-mvp-prd.md)、[用户故事](../../product/04-user-stories.md)、
  [Spike 计划](../../technical/03-spike-plan.md)、[技术选型](../../technical/02-technology-selection.md)、
  [ADR 索引](../../technical/adr/README.md)。
- 当前分支/worktree：`codex/WORK-2026-007-mvp-technical-spike`，仓库根工作树。
- 上游/HEAD：分支从 `main` 的 `ef912f53afbeec51bbb0bf9a3c383aaaf17e9f08` 创建；
  当前 HEAD `135edba`，Day 1 与 Day 2 工作树变更尚未提交。
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
| `scripts/harness/lib.mjs`, `scripts/harness/lib.test.mjs` | `lib.mjs` clean；测试文件 absent | 修复 Harness 扫描 Git 忽略生成目录的前置质量闸门 |
| `docs/requirements/REQ-2026-007-mvp-五天技术-spike.md`, `docs/technical/adr/0003-rust-owns-workspace-io.md` | clean | Day 1 依赖、IPC 与安全边界记录 |
| `src-tauri/src/workspace.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | `workspace.rs` absent；其余 clean | Rust 工作区注册、官方目录选择依赖和测试 |
| `src/App.tsx`, `src/App.css`, `src/contracts/workspace.ts` | contracts 文件 absent；其余 clean | 最小目录选择 UI 与窄 IPC 类型 |
| `src-tauri/src/document.rs`, `src/contracts/document.ts`, `src/components/CodeMirrorEditor.tsx` | Day 2 开始时 absent | Rust 文档边界、前端 IPC contract 与 CodeMirror 适配层 |
| `package.json`, `pnpm-lock.yaml` | Day 2 开始时已由本 WORK 修改 | CodeMirror 6 当前切片依赖；不引入尚未使用的 Merge View 依赖 |

## 3. 范围与非目标

### 范围

- 安装并验证 Rust stable MSVC、Cargo、Visual Studio Build Tools C++ 工具链、WebView2，并记录 Node/pnpm/Git/ripgrep 版本。
- 建立 Windows 首发最小 Tauri 2 + React + TypeScript + Vite 项目骨架、严格 CSP、最小 capability、Rust toolchain 固定和锁文件。
- 保留可继续开发的目录结构与启动/构建脚本；本切片只加入 `open_workspace`、
  `list_documents`、`read_text` 和 `save_text` 四个窄 IPC。
- 保留一枚 512×512 PNG 应用图标源文件，并通过 Tauri CLI 生成 Windows、macOS、Linux 所需的完整平台图标集，用于 Debug NSIS 安装验证。
- 优化仓库忽略规则，覆盖 pnpm 本地缓存、调试符号、TypeScript 增量元数据和测试报告等可重建产物；不忽略应用图标源文件或平台图标资产。
- 将程序图片源资产纳入受控 Git 二进制白名单：根目录 `app-icon.png`、`src-tauri/icons/**` 的 PNG/ICO/ICNS，以及 `src/assets/**`、`public/assets/**` 的常用图片格式；单文件上限为 10 MiB。
- 修复 Harness 文件遍历，使 UTF-8 和 Markdown 检查不读取 Git 忽略的常见生成目录，并用
  Node 内置测试固定该行为。
- 通过无路径参数的 Rust `open_workspace` Command 打开系统目录选择器；规范化并注册目录，
  只返回 Workspace ID 和显示名称。
- 为文件命令提供集中式相对路径解析器，拒绝绝对路径、父级穿越、未知 Workspace ID 和
  规范化后越界路径。
- 递归列出工作区内的 Markdown/TXT 文档；跳过符号链接和 `.git`、`.easy-markdown`、
  `node_modules`、`target`、`dist` 等生成或内部目录。
- 读取不超过 5 MiB 的 UTF-8 文本，返回 SHA-256 版本令牌、UTF-8 BOM 和换行风格信息；
  保存时要求调用方提供期望版本，保留 BOM/换行风格，并使用同目录临时文件、刷盘和原子替换。
- 使用 CodeMirror 6 提供文档列表、打开、编辑、脏状态提示、手动保存和外部版本冲突选择。
- 开启并验证 Windows NSIS Debug bundle；不发布安装包。

### 非目标

- 不实现递归文件 Watch、自动保存、完整 Merge View、Git CLI、ripgrep、Markdown 预览、
  Agent Worktree、性能测试或 E2E。
- 不做完整生产 UI、语雀迁移、PR API、自动更新、完整冲突解决器、跨平台适配或生产发布。
- 不发布、上传或安装到生产环境；NSIS 仅作为本机 Spike 工件验证。

## 4. 计划

- [x] 步骤 1：同步合并后的 `main`，创建精确基线分支，建立 REQ/WORK 记录。
- [x] 步骤 2：完成环境闸门；准备 Rust stable MSVC、Cargo、MSVC Build Tools、WebView2 与 pnpm 版本证据。
- [x] 步骤 3：生成并收敛 Tauri 2 + React/TypeScript/Vite 最小骨架，去除模板业务示例和多余 opener 权限。
- [x] 步骤 4：按用户追加授权生成 512×512 PNG 应用图标。
- [x] 步骤 5：将源图保存为根目录 `app-icon.png`，运行 `pnpm tauri icon app-icon.png` 生成并验证完整平台图标集。
- [x] 步骤 6：修复 Harness 生成目录扫描并添加回归测试。
- [x] 步骤 7：实现 Rust Workspace Registry、原生目录选择和路径边界测试。
- [x] 步骤 8：实现最小 React 目录选择 UI 和显式 IPC contract。
- [x] 步骤 9：验证前端、Rust、Tauri Debug 构建与 Windows NSIS bundle。
- [x] 步骤 10：实现 Markdown/TXT 列表、UTF-8 读取、SHA-256 版本令牌与安全保存，并添加 Rust 测试。
- [x] 步骤 11：接入 CodeMirror 6，完成文档列表、打开、编辑、手动保存和版本冲突选择 UI。
- [x] 步骤 12：更新 REQ/ADR/WORK，执行 Rust、TypeScript、前端和 Harness 验证。
- [x] 验证与文档：记录 Day 1 与 Day 2 首个纵向切片的命令、结果、限制和下一具体动作。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | 每个 Spike 目标在 WORK/`research/` 中记录实验、环境、命令、结果和限制 | deferred（后续 Spike） |
| AC-2 | 已完成 Tauri 壳、严格 CSP、最小 capability、无路径 `open_workspace`、越界拒绝、Windows Debug/NSIS 构建、安装和安装版启动/目录选择；卸载受测试控制器产品策略阻止 | partial |
| AC-3 | UTF-8/BOM/CRLF、文档过滤、版本冲突和安全保存已覆盖；递归 Watch、IME、Git CLI 取消超时、Porcelain、Worktree 待后续切片 | partial |
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
| 2026-07-19 | Git 提交 | 用户要求提交当前代码并优化 Git 忽略配置 | 已提交代码/文档与 `.gitignore`；图片资产准入策略另行确认 |
| 2026-07-19 | Git 策略 | 用户确认程序图片属于代码骨架资产，并将单文件上限从 5 MiB 调整为 10 MiB | 更新 `git-policy.json` 的图片白名单与大小阈值，并纳入当前图标集 |
| 2026-07-19 | 授权/范围继续 | 用户确认“可以，继续吧” | 修复 Harness 后继续 Spike Day 1 安全工作区与安装验证 |
| 2026-07-19 | 依赖/IPC | `open_workspace` 不接受路径参数；首选官方 dialog 插件因间接 `tauri-plugin-fs` build-script 被 App Control 4551 阻止，回退为 MIT 许可的 `rfd` 0.17 异步 Rust API | WebView 不获得任意绝对路径或文件系统插件权限；依赖由 Cargo.lock 固定 |
| 2026-07-19 | Harness | 文件遍历默认跳过 Git 忽略的常见生成目录 | 避免 `target/` 内 Tauri 生成的非 UTF-8 资产造成伪失败；保留源文件 UTF-8 检查 |
| 2026-07-19 | 授权/范围继续 | 用户明确要求“开始下一步开发吧” | 在同一 WORK 中进入 Day 2 文件与编辑器切片 |
| 2026-07-19 | 范围收窄 | Day 2 先完成可独立验证的手动编辑纵向闭环 | 递归 Watch、自动保存与 Merge View 留到下一切片，避免一次引入多个并发状态源 |
| 2026-07-19 | 依赖/安全 | 前端采用 CodeMirror 6；Rust 采用 `sha2` 版本摘要和 Windows `MoveFileExW` 原子替换能力 | 不向前端开放任意文件系统权限；移除当前切片尚未使用的 `@codemirror/merge` |
| 2026-07-19 | Git WIP/Draft 授权 | 用户在已获知 Clippy 因 App Control 4551 未通过后，明确要求“提交代码，并提交PR吧” | 作为非 Agent 的仓库负责人批准含已披露静态检查缺口的 WIP 检查点，并独立批准治理/远端执行路径仅用于 Draft PR 交接；不授权转 Ready、merge 或把失败写成通过 |

## 7. 风险与阻塞

- 风险：此前完整 Rust 编译曾被 Windows 应用控制策略以错误 4551 阻止；当前普通 Rust
  测试和 Debug/NSIS 构建已通过，但 Clippy 会在重新构建 `web_atoms` build-script 时再次
  被 4551 阻止。
- 图标生成影响：Tauri CLI 会批量创建/覆盖 `src-tauri/icons/**` 中的派生图标；该目录当前仅含本 WORK 生成的 `icon.png`，不存在用户预有文件。
- 图标回退：删除本次派生图标并恢复生成前的单个 `icon.png` 即可；不修改应用代码、依赖或配置。
- 阻塞条件：普通构建已解除；Clippy 的独立构建图仍被 App Control 部分阻止。
- 解除人/条件：机器管理员/负责人将开发机 App Control 策略切换为允许开发构建的模式。
- 解除后的第一步：已在相同骨架上重跑 `pnpm tauri build --debug` 并确认通过；后续另建/恢复业务 Spike 切片。
- 当前质量闸门：Harness 会读取 `src-tauri/target/` 中被 Git 忽略的生成资产并报非 UTF-8；
  先修复遍历规则并用回归测试验证，不能沿用临时移出构建目录的做法。
- 依赖实验：`tauri-plugin-dialog` 2.7.2 下载成功，但其间接 `tauri-plugin-fs` 2.5.1
  build-script 被 App Control 以 4551 阻止；已按 ADR 回退为不暴露前端权限的 `rfd`
  0.17.2 Rust-only 目录选择。`Cargo.lock` 已确认只保留 `rfd`，未保留两个 Tauri 插件。
- Git 风险等级：Day 1 涉及依赖、IPC、安全边界和 Harness 治理，按重大变更处理；允许本地
  检查点提交，但 push/merge 需要独立维护者及安全视角批准，且不自动 merge。
- 安装环境限制：NSIS 从打包的 Codex 桌面环境启动后，Windows 将每用户安装目录重定向到
  Codex package `LocalCache`。安装器报告成功且应用可启动，但该路径不能代表普通外部进程
  在干净 Windows 用户会话中的最终安装位置。
- 卸载阻塞：用户已在动作时明确批准卸载；Computer Use 对真实 `uninstall.exe` 返回
  `product policy blocks this app`。重复运行 Setup 只提供重新安装流程，不提供受支持的
  卸载入口，因此未绕过策略，测试应用仍留在上述隔离 `LocalCache`。
- Day 2 当前只在保存时比较 SHA-256 版本令牌；尚无递归 Watch、自动保存或完整三方合并，
  外部修改会在手动保存时进入显式冲突选择。
- 安全替换在写入临时文件后再次校验版本，并在同目录执行原子替换；最终校验与替换之间仍有
  极短 TOCTOU 窗口，后续 Watch/冲突切片需继续评估 Windows 文件共享和锁语义。
- 前端生产包因 CodeMirror 基础扩展约为 809 KiB，Vite 报告单块超过 500 KiB；不影响当前
  Spike 验证，后续可通过路由/编辑器懒加载或手工扩展集合收敛。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| `git status --short --branch` / `git rev-parse HEAD` | passed | clean `main`; base `ef912f5` | 已完成并创建 Spike 分支 |
| Git remote URL/策略预检 | passed | HTTPS origin 与 active policy 完全匹配 | 无 rewrite/multi-url |
| Node/pnpm/Git/ripgrep 版本盘点 | passed | Node 24.17.0; pnpm 11.9.0; Git 2.54.0; rg 15.1.0 | 已具备 |
| Rust/Cargo/MSVC 工具盘点 | passed | Rust 1.97.1、Cargo 1.97.1、VS Build Tools 2026 | 工具链已具备 |
| `node scripts/harness/check-harness.mjs` | passed | 7 REQ、1 active WORK、6 archived WORK、5 ADR、47 Markdown files | 临时移出构建目录后检查通过；构建目录由规则忽略 |
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
| Git 图片资产策略检查 | passed | `app-icon.png` 与 `src-tauri/icons/**` 命中白名单；53 个图标文件均小于 10 MiB | `git-policy.json` 与文件大小检查 |
| `node --test scripts/harness/lib.test.mjs` | passed | 2/2 tests | 默认跳过常见生成目录，并保留显式覆盖语义 |
| `node scripts/harness/check-harness.mjs` | passed | 7 REQ、1 active WORK、6 archived WORK、5 ADR、47 Markdown files | 构建目录留在原位时通过，不再需要临时移出 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | passed | 6/6 tests | 覆盖中文/空格目录、非目录、工作区内解析、绝对路径/`..`、未知句柄、符号链接越界 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | passed | no diff | Day 1 Rust 代码格式通过 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | failed | `web_atoms` build-script 被 App Control 阻止，os error 4551 | 未请求豁免；普通 test/build 已通过，残余静态检查缺口保留 |
| `pnpm build` | passed | Vite 7.3.6，32 modules | TypeScript 与生产前端构建通过 |
| `pnpm tauri build --debug --bundles nsis` | passed | `Easy Markdown_0.1.0_x64-setup.exe` | Debug 应用与 NSIS 打包成功；尚未执行安装 |
| Windows UI：取消目录选择 | passed | 状态显示“已取消选择，未授予新的目录权限。” | 原生目录选择器关闭后无新授权 |
| Windows UI：选择 `my_book` | passed | 只显示 `my_book` 与 `workspace-1` | UI 未显示绝对路径；应用未读取目录正文 |
| Windows UI：NSIS 安装 | passed | Setup 显示 `Setup was completed successfully`；未创建桌面快捷方式 | 每用户安装被测试宿主重定向到 Codex `LocalCache` |
| Windows UI：安装版启动/目录选择 | passed | app id `com.easymarkdown.desktop`；初始界面正常，取消选择后无新授权 | 证明安装工件可启动且 Rust 原生目录选择器可用 |
| Windows UI：NSIS 卸载 | not-run | 用户已批准；Computer Use 对真实 `uninstall.exe` 返回产品策略阻断 | 未绕过控制器策略；重复 Setup 无卸载入口，残留测试应用需在宿主外手工卸载 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | passed | 11/11 tests | 新增文档过滤、UTF-8 BOM/CRLF、保存、外部版本冲突、非法类型/穿越测试 |
| `.\node_modules\.bin\tsc.cmd --noEmit` | passed | no diagnostics | Day 2 IPC contract、编辑器适配层与 UI 类型检查通过 |
| `pnpm build` | passed | Vite 7.3.6，57 modules，JS 809.31 KiB | Day 2 生产构建通过；保留单块超过 500 KiB 的优化提示 |
| `node --test scripts/harness/lib.test.mjs` | passed | 2/2 tests | Day 2 修改后 Harness 回归测试通过 |
| `node scripts/harness/check-harness.mjs` | passed | 7 REQ、1 active WORK、6 archived WORK、5 ADR、47 Markdown files | Day 2 文档与交接记录完成后通过 |

## 9. 交接

- 当前状态：`in-progress`（启动切片、Day 1 和 Day 2 首个手动编辑纵向切片已完成；继续等待
  独立评审与后续业务 Spike）。
- 已完成：环境和骨架、图标集、Harness 生成目录修复、Rust Workspace Registry、无路径
  `open_workspace`、相对路径安全解析、Markdown/TXT 列表、UTF-8/BOM/CRLF 读取、带版本
  令牌的安全保存、CodeMirror 6 手动编辑与冲突选择、11 个 Rust 测试、前端构建、
  Debug/NSIS bundle、安装版启动，以及取消/成功目录选择人工验证。
- 未完成：NSIS 卸载因 Computer Use 产品策略未运行；Clippy 因 App Control 4551 未通过；
  递归 Watch、自动保存、Merge View、Git、搜索、预览、E2E、性能和最终 ADR/Go 决策仍属
  后续切片。
- 下一具体动作：项目侧实现递归 Watch/debounce，把外部修改事件接入当前版本令牌模型，
  再加入自动保存和完整 Merge View；宿主外的人类会话可另行卸载隔离 `LocalCache` 中的
  测试应用。因治理/远端执行路径需要独立批准，push/PR 保持 `not-run`。
- 修改路径：REQ/WORK、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`rust-toolchain.toml`、`index.html`、`vite.config.ts`、`tsconfig*.json`、`src/**`、`src-tauri/**`、`public/**`、`app-icon.png`。
- 已运行验证：环境版本盘点、pnpm install/approve-builds、前端 build/typecheck、Cargo
  metadata、Tauri info/icon、图标完整性、Node Harness tests、Harness、Rust fmt/test、
  Tauri Debug/NSIS build，以及 Windows UI 取消/成功选择。
- 未运行/失败验证及原因：NSIS 卸载被 Computer Use 产品策略阻止；Clippy 的 `web_atoms`
  build-script 被 App Control 4551 阻止；后续业务测试尚未实现。
- 残余风险：安装路径受 Codex 宿主虚拟化影响，仍需在外部干净 Windows 会话复核；隔离
  `LocalCache` 中保留测试安装；Clippy 无结果；Workspace ID 为进程内句柄且重启后失效；
  文件外部变化只在手动保存时发现；前端单块约 809 KiB。这些均为当前切片的已知限制。
- 工作区保护：任务开始时 `main` clean；REQ/WORK、骨架文件从 absent 新建；本次仅扩充 `.gitignore` 的可重建产物规则。
- 工作区保护：任务开始时 `main` clean；REQ/WORK 从 absent 新建；用户生成的 `app-icon.png` 与 `src-tauri/icons/**` 经策略确认后纳入本次资产提交。
- Git 状态：当前分支 `codex/WORK-2026-007-mvp-technical-spike`，尚无上游；base `ef912f5`；
  当前 HEAD 为 `135edba`；Day 1 与 Harness 变更尚未提交，所有修改路径均已在 owned paths
  中按 clean/absent 起始状态记录。
- 图标提交状态：`included`；`app-icon.png` 与 `src-tauri/icons/**` 已按白名单提交，单文件均不超过 10 MiB。
- 检查点状态：`authorized`；Clippy 的环境阻断仍是提交闸门失败，用户在已知该失败后明确
  批准建立 WIP 检查点。提交与 PR 必须继续披露该失败，不得宣称本 WORK 已完成。
- PR 状态：`planned-draft`；分支累计改动命中治理与 `remote_execution_paths`，用户作为
  非 Agent 的仓库负责人已独立批准本次 Draft PR 交接；不授权转 Ready 或 merge。
- 终态说明：`done` 可在归档后进入 Ready/merge；`abandoned` 必须记录原因、未满足验收、
  保留结果、残余风险和后续负责人，永不 Ready/merge。
