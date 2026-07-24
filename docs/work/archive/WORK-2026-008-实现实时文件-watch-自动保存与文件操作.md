---
id: WORK-2026-008
title: "实现实时文件 Watch、自动保存与文件操作"
status: done
requirement: REQ-2026-007
owner: "Codex"
created: 2026-07-19
updated: 2026-07-24
---

# WORK-2026-008：实现实时文件 Watch、自动保存与文件操作

## 1. 目标

完成 [REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md) 的
Day 2 后续纵向切片：在现有版本令牌与原子保存基础上，交付递归文件 Watch、可靠自动保存、
Markdown/TXT 新建/重命名/删除和外部冲突最小比较闭环，并保留可复现测试证据。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-007](../../requirements/REQ-2026-007-mvp-五天技术-spike.md)。
- 相关产品/技术/ADR：[MVP PRD](../../product/02-mvp-prd.md)、
  [用户故事](../../product/04-user-stories.md)、
  [Spike 计划](../../technical/03-spike-plan.md)、
  [技术选型](../../technical/02-technology-selection.md)、
  [ADR-0003](../../technical/adr/0003-rust-owns-workspace-io.md)、
  [WORK-2026-007](../archive/WORK-2026-007-执行-mvp-五天技术-spike.md)。
- 当前分支/worktree：`codex/WORK-2026-008-watch-autosave-file-ops`，仓库根工作树。
- 上游/HEAD：创建时无上游；HEAD `c208ce32165b7d78063d5e63fcd7b6f4ffa64e1a`。
- 基线引用/SHA：`origin/main` / `c208ce32165b7d78063d5e63fcd7b6f4ffa64e1a`；
  已在无 URL rewrite、无多值 fetch/push URL 后显式 fetch 并核验。
- Git 策略模式/canonical repository：`active` / `liluqing/easy-markdown`。
- 启动时 Git 状态：`main` 与 `origin/main` 同为 `c208ce3` 且 clean；随后从精确 SHA
  创建本分支，WORK-008 文件从 absent 生成。
- 远端/PR 状态：PR #3 已 squash merge；本分支尚未 push，PR `not-run`。
- 必须保护、但不属于本 WORK 的用户改动：无。

| 目标路径 | 任务开始状态 | 归属/可暂存证据 |
| --- | --- | --- |
| `README.md`, `docs/product/**`, `docs/requirements/REQ-2026-007-*`, `docs/technical/**` | clean | 本 WORK 文档与决策基线 |
| `docs/work/active/WORK-2026-007-*` | clean | 收口已合并切片并归档 |
| `docs/work/active/WORK-2026-008-*` | absent | 本 WORK 由 Harness 生成 |
| `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/src/{lib,workspace,document}.rs` | clean | Rust Watch、路径与文件操作实现 |
| `src-tauri/src/watcher.rs` | absent | Rust Watch 新模块 |
| `package.json`, `pnpm-lock.yaml`, `src/**` | clean | 自动保存状态机、事件订阅、文件操作 UI 与测试 |
| `index.html`, `vite.config.ts`, `src-tauri/{tauri.conf.json,capabilities/default.json}` | clean | CodeMirror CSP nonce 与正常关闭最小权限 |

## 3. 范围与非目标

### 范围

- 对当前工作区递归监听文档创建、修改、重命名和删除；事件去抖后触发安全重扫。
- 编辑停止约 800 ms 后自动保存；手动保存、文档切换、重命名和正常关闭前主动 flush。
- 保存期间继续接收输入；以编辑修订号和文档身份丢弃过期异步结果并排队后续保存。
- 外部修改：clean 文档自动刷新；dirty 文档停止自动保存并提供保留本地、加载外部、比较。
- 外部删除/未知移动 dirty 文档时保留内存草稿；仅在用户明确确认后原路径重建。
- 新建、重命名、删除 `.md`/`.txt`；禁止覆盖同名目标，删除只进系统回收站。
- 删除 dirty/conflict 文档时阻断，版本令牌变化时 Rust 端再次拒绝。
- 统一所有文档 IPC 的工作区、相对路径、内部目录、符号链接和 5 MiB 边界。

### 非目标

- 不实现新建/重命名/删除目录、跨目录拖拽或批量文件操作。
- 不实现完整三方合并、崩溃草稿日志、Git、搜索、Markdown 预览或发布。
- 不把本切片结果描述成五天 Spike 或生产验证已完成。

## 4. 计划

- [x] 步骤 1：核验远端策略与精确 `main`，创建 WORK-008 聚焦分支并收口 WORK-007。
- [x] 步骤 2：补齐 REQ、产品基线、ADR 和本 WORK 的行为/安全决策。
- [x] 步骤 3：实现 Rust 递归 Watch、统一路径策略与新建/重命名/回收站 IPC。
- [x] 步骤 4：实现前端自动保存状态机、Watch 协调、冲突/缺失处理和文件操作 UI。
- [x] 步骤 5：补充 Rust/前端测试，运行格式、类型、单元、构建、Harness 与人工验证。
- [x] 验证与文档：逐项记录验收证据、风险、diff、Git/PR 交接和后续 Spike 范围。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-3 本切片：文件保存、外部修改与编码部分 | 28 个 Rust 测试、18 个前端状态机测试；Windows Debug 人工验证新建、中文/Emoji 自动保存、外部编辑重载、外部移动与应用内重命名 | partial；REQ 的 IME、Git/Worktree 等后续范围未完成 |
| AC-2 本切片：窄 IPC、CSP 与常规越界拒绝部分 | 所有文档命令共用路径策略；覆盖内部目录、穿越、ADS、静态符号链接、canonical escape、未知 Workspace ID，并在 Windows 文件操作前校验并持有句柄 | passed；真实回收站 UI 仍为残余人工验证 |
| 本 WORK：可靠自动保存 | 800 ms 防抖、flush、编辑中保存、失败重试、冲突/缺失冻结和过期 reconcile 竞态测试 | passed |
| 本 WORK：安全文件操作 | create-new、同目录 rename no-clobber、句柄级版本保护、回收站 only 与 dirty/conflict UI 阻断 | passed；Windows 句柄级路径竞态已修正，真实回收站 UI 未人工执行 |
| 本 WORK：最小冲突比较 | dirty 外部修改可并排查看本地与外部内容；reducer 覆盖双向选择和继续编辑 | passed；人工并发时序未稳定命中冲突窗口 |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-19 | 授权 | 用户明确要求先实现实时 Watch、自动保存、新建/重命名/删除并最终确认“实施吧” | repository owner |
| 2026-07-19 | 产品决定 | 自动保存约 800 ms 防抖；手动保存、切换、重命名、正常关闭前 flush；不新增崩溃草稿日志 | repository owner |
| 2026-07-19 | 数据安全 | dirty 文件外部消失时冻结自动保存并保留草稿，只在明确确认后原路径重建 | repository owner |
| 2026-07-19 | 删除语义 | 应用内 dirty/conflict 文档先阻断；删除只进系统回收站，失败不永久删除 | repository owner |
| 2026-07-19 | 范围 | 当前只操作 `.md`/`.txt` 文件；不做目录、跨目录移动、批量操作或完整三方合并 | repository owner |
| 2026-07-19 | 技术决定 | Watch 只发 workspace/revision 失效信号，前端重扫并用版本 Token 判定 self-write、外部冲突或缺失 | ADR-0003 / Spike |
| 2026-07-19 | 依赖核验 | 使用稳定 `notify` 8.2.0、`trash` 5.2.6、Vitest 4.1.10；不采用 notify 9 RC；版本、许可、Rust/Node/Vite 兼容性已从官方文档与注册表核验 | Codex |
| 2026-07-20 | CSP 修正 | Windows Debug 人工验收发现 `style-src 'self'` 阻止 CodeMirror 运行时样式；采用 Vite/Tauri style nonce + `EditorView.cspNonce`，生产 CSP 不启用 `unsafe-inline` | ADR-0003 / Codex |
| 2026-07-20 | 评审闭环 | 独立复审发现 clean missing 阻断退出和保存前过期 reconcile 回退两项阻断；修复后第三轮复审无阻断 | integration review |
| 2026-07-20 | 安全终审 | 发现名称级路径解析与 `expectedVersion` 复核不是句柄级边界或文件系统原子 CAS；先修复 Watch 首次订阅追赶重扫和 5 MiB 有界读取，其余方案需负责人决定是否扩展本 WORK | final diff audit |
| 2026-07-24 | 范围确认 | 负责人确认按推荐方案扩大本 WORK：修复 Windows 句柄级路径竞态与版本保护，重跑闸门，提交并经独立评审合入 main；随后开始 Agent 文件编辑产品文档 | repository owner |

## 7. 风险与阻塞

- 2026-07-24 解除决定：负责人确认先扩大本 WORK 实现句柄级路径安全与版本保护，重跑完整闸门，
  再进行 commit、push、Draft PR、独立评审与合入 main；合入后才开始 Agent 文件编辑产品文档。
- 已完成的安全修正：Windows 文档读写、创建、同目录重命名和目录枚举在使用前打开并校验句柄；
  读写与重命名保持句柄存活，重命名使用 `SetFileInformationByHandle(FileRenameInfo)` 且不覆盖目标，
  保存使用独占句柄复核版本后写回并刷盘。

- 风险：OS Watch 会合并、重复或重排事件；失效重扫与版本 Token 是正确性来源，不能依赖
  单个底层事件或时间窗口忽略应用自身写入。
- 风险：保存期间继续输入、切换文档和 Watch 回调可能返回过期结果；前端必须按
  workspace/path/generation/editRevision 丢弃，不能把旧结果应用到新文档。
- 风险：系统回收站能力和文件 Watch 在不同平台语义有差异；当前 Windows 首发，依赖与
  人工验证结果必须留痕，失败时保持文件不变。
- 风险：强制终止可能丢失最近约 800 ms 输入；没有独立恢复日志是本次明确接受的边界。
- 风险：回收站版本检查与 OS 操作之间仍有不可消除的 TOCTOU；非 Windows no-clobber
  重命名在极端回滚失败时可能留下两个同内容名称，但不会覆盖目标或丢失源文件。
- 风险：dirty missing 原路径重建为 create + save 两步；两步之间崩溃可能留下空文件，
  且当前重建不保留原 BOM/CRLF 元数据。
- 风险：CodeMirror CSP nonce 依赖已锁定 Vite/Tauri 的占位符传递；升级时必须重跑打包
  WebView 验证。当前生产 `style-src` 未放宽。
- 历史阻塞（已解除）：路径防护先检查再按名称执行，没有持有目录/文件句柄；并发 junction/symlink
  替换仍可能使后续操作越过已验证路径。`expectedVersion` 的最后复核与替换/移动/回收站
  动作之间也不是原子 CAS。常规外部编辑测试通过，但安全硬门槛不能据此标为完成。
- 已修复终审项：文档读取改为最多 `5 MiB + 1 byte` 的有界读取，并从同一已打开文件句柄
  获取 metadata；Watch 监听在应用生命周期预注册，注册完成后补一次列表与当前文档追赶重扫。
- 残余验证：界面控制规则要求对真实本地删除在动作当下再次确认，本轮未点击“移入回收站”；
  Rust fake provider 覆盖成功/失败语义和失败保留源文件，真实 Windows 回收站仍待独立人工确认。
- 残余验证：界面自动化调用延迟使人工并发注入最终按顺序合并，未稳定命中冲突面板；18 个
  前端状态机测试已覆盖 dirty/conflict 比较、选择与过期异步结果。
- 当前阻塞条件：路径安全、版本保护、回收站失败无永久删除、自动保存竞态或 Harness 任一闸门失败；
  当前自动化闸门已通过，真实 Windows 回收站 UI 仍保留为需动作时确认的残余验证。
- 解除人/条件：实现修正并通过对应自动化/人工验证；环境策略导致无法运行时由机器管理员解除。
- 解除后的第一步：重跑最小失败用例，再执行完整相关闸门。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| `git status --short --branch` / `git rev-parse HEAD` | passed | clean exact base `c208ce3` | 创建聚焦分支前核验 |
| 远端 URL/策略预检与显式 fetch | passed | canonical HTTPS、无 rewrite/multi-url；`origin/main=c208ce3` | 不信任仅显示的 origin |
| `node scripts/harness/check-harness.mjs` | passed | 7 REQ、1 active WORK、7 archived WORK、5 ADR、48 Markdown | 最终 blocker/交接更新后仍须末次重跑 |
| `cargo fmt --all -- --check` | passed | 无格式差异 | `src-tauri` manifest |
| `cargo test --locked` | passed | 28/28 Rust 单元测试，bin/doc-tests 通过 | 曾有 App Control 4551；终审修正后完整重跑通过 |
| `cargo clippy --locked --all-targets -- -D warnings` | passed | 无 Clippy 警告 | MSVC linker 仅输出建库提示 |
| Windows 句柄级路径安全修正 | passed | `cargo check --locked`、`cargo test --locked` 28/28、Clippy 严格检查、Debug 构建 | 读写/创建/重命名/目录枚举使用校验后的句柄；保存与重命名不按名称二次执行 |
| `pnpm test` | passed | 18/18 Vitest | 覆盖自动保存、冲突、missing 与 reconcile 竞态 |
| `pnpm typecheck` | passed | TypeScript 无错误 |  |
| `pnpm build` | passed | Vite 62 modules | 仅保留约 841 kB chunk 警告 |
| `pnpm tauri build --debug --no-bundle` | passed | 当前 Debug EXE 构建成功 | nonce 修复后重建 |
| Windows Debug 新建/自动保存/Watch/重命名/关闭 | passed | 临时夹具 `easy-markdown-work008-3997a4b2e62f41158c58fbebae9a6b9e` | 中文/Emoji 落盘、clean 外部重载、clean missing、应用内 rename、正常关闭 |
| Windows Debug CSP | passed | 修复前复现 inline style CSP 违规；修复后 CodeMirror 正常布局，DevTools 0 条控制台消息 | 生产 `style-src 'self'` 保持不变 |
| Windows 真实回收站 UI | not-run | 需动作当下确认 | 不以永久删除替代；自动化验证失败保留 |
| 完整 diff / `git diff --check` / 秘密与异常文件扫描 | passed | 无空白错误、高置信秘密、异常二进制或超策略阈值文件 | 安全终审另发现并记录句柄级 TOCTOU |

## 9. 交接

- 当前状态：`done`；用户已确认扩大本 WORK 实现句柄级安全层，安全阻塞已解除，自动化质量
  闸门已通过，进入合格提交、push、Draft PR、独立评审与合入 main 生命周期。
- 已完成：Rust Watch/路径/文件操作、Windows 句柄级路径校验与版本保护、前端自动保存/冲突/
  missing/UI、CSP nonce、28+18 自动化测试、独立复审和 Windows Debug 人工验证；完整 diff
  与秘密/异常文件扫描通过。
- 未完成：合格提交、push/Draft PR、独立评审与合入 main；真实回收站 UI 与人工冲突时序作为
  明确残余验证保留。
- 下一具体动作：按 active Git 策略核验远端与 exact head，创建单一意图 commit，推送当前任务
  分支并创建 Draft PR；满足 CI、非作者批准、分支保护和 expected-head 后合入 main。合入后
  从主干创建产品文档工作项并输出 Agent 文件编辑产品文档。
- 修改路径：README、产品/需求/技术/WORK 文档、前端应用/样式/状态机/契约、Tauri 配置/
  capability、Rust workspace/document/watcher、Cargo/pnpm manifest 与 lockfile。
- 已运行验证：表中全部 passed 项；依赖精确版本由 `cargo tree`/`pnpm list` 核验。
- 未运行验证及原因：真实回收站 UI 需要动作时即时确认；人工并发冲突未稳定命中时序，
  两者均由自动化和残余风险明确覆盖。
- 残余风险：Watch 平台差异、回收站 TOCTOU/跨平台语义、强制终止约 800 ms 窗口、
  dirty missing 两步重建、CSP nonce 升级回归和现有前端 chunk 警告。
- 工作区保护：任务开始时 `main` clean、无用户修改；所有既有 owned paths 为 clean，
  WORK-008/watcher/测试文件为 absent。
- Git 状态：当前分支 `codex/WORK-2026-008-watch-autosave-file-ops`，HEAD/base
  `c208ce32165b7d78063d5e63fcd7b6f4ffa64e1a`；修改均属于本 WORK，尚无本任务 commit、
  upstream 或 push。
- PR 状态：`not-run`；重大变更不自动 merge，push/PR 前重新核验治理、
  `remote_execution_paths`、exact head、changed-files、CI 与独立批准。
- 终态说明：`done` 可在归档后进入 Ready/merge；`abandoned` 必须记录原因、未满足验收、
  保留结果、残余风险和后续负责人，永不 Ready/merge。
