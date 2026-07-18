---
id: WORK-2026-005
title: "配置 GitHub 远程协作与首次推送"
status: in-progress
requirement: REQ-2026-005
owner: "Codex"
created: 2026-07-18
updated: 2026-07-18
---

# WORK-2026-005：配置 GitHub 远程协作与首次推送

## 1. 目标

落实 [REQ-2026-005](../../requirements/REQ-2026-005-启用-github-协作基线.md)：为已创建的
GitHub 私有仓库建立最小权限 CI、Reviewer 路径、`main` 保护和可信远程策略，并把当前本地基线
首次推送到远程。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-005](../../requirements/REQ-2026-005-启用-github-协作基线.md)。
- 相关产品/技术/ADR：[MVP PRD](../../product/02-mvp-prd.md)、
  [Git 工作流](../../harness/git-workflow.md)；不需要产品 ADR。
- 当前分支/worktree：仓库根工作树，`main`；本任务开始时工作区干净。
- 上游/HEAD：无 upstream；`d550415b27cc3368604b8228b772148ee5b00428`。
- 基线引用/SHA：`main` / `d550415b27cc3368604b8228b772148ee5b00428`。
- Git 策略模式/canonical repository：`bootstrap-limited` / `null`。
- 启动时 Git 状态：无 modified、staged 或 untracked 文件；`origin` 已配置为
  `https://github.com/liluqing/easy-markdown.git`。
- 远程/PR 状态：GitHub 私有空仓库已由浏览器验证；未 fetch/push，无远程分支、CI、保护或 PR；
  GitHub Agent 连接器对新私有仓库返回 404，GitHub CLI 未安装。
- 必须保护、但不属于本 WORK 的用户改动：无。

| 目标路径 | 任务开始状态 | 归属/可暂存证据 |
| --- | --- | --- |
| `docs/requirements/REQ-2026-005-启用-github-协作基线.md` | absent | 本任务需求记录 |
| `docs/work/active/WORK-2026-005-配置-github-远程协作与首次推送.md` | absent | 本任务执行记录 |
| `.github/workflows/harness.yml` | absent | 本任务最小 CI |
| `docs/harness/git-policy.json` | clean | 本任务可信远程和 active 策略 |
| `docs/harness/README.md` | clean | 如需同步当前远程协作状态，仅修改相关段落 |

## 3. 范围与非目标

### 范围

- 安装/认证 GitHub CLI并验证仓库管理权限。
- 邀请负责人指定的 Reviewer，不在记录中保存其邮箱。
- 创建最小权限 Harness CI，并用不可变 SHA 固定外部 actions。
- 配置 `main` 保护和 required check。
- 更新 Git 策略为可验证的 `active` 配置。
- 运行本地/远程闸门，完成一次性 bootstrap 激活提交和首次非强制推送。

### 非目标

- 不实现 MVP 功能，不发布、部署、打标签或自动合并。
- 不创建普通业务 PR；首次推送用于建立受保护主干基线。
- 不降低 Reviewer、检查、token 或凭据安全要求。

## 4. 计划

- [x] 建立 accepted REQ、active WORK，记录精确 base、路径归属和一次性 bootstrap 边界。
- [x] 安装并认证 GitHub CLI；确认账号 `dfdh44675-star` 对私有空仓库具有 Write 权限，并已形成独立 Reviewer 路径。
- [x] 固定 action SHA，创建最小权限 CI 并完成 YAML、权限、凭据和可变引用静态安全审计。
- [ ] 邀请 Reviewer，配置 `main` 保护并核验平台返回值。
- [ ] 更新 active Git 策略，运行 Harness、格式、安全、diff 和 URL 闸门。
- [ ] 完成聚焦提交、首次 push、远程 SHA/CI/保护复核和最终交接。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | `gh --version/auth status/repo view` 与仓库 API | passed |
| AC-2 | 工作流静态审计、YAML 解析、action SHA 查询 | passed |
| AC-3 | GitHub collaborator/protection API 查询 | pending |
| AC-4 | policy JSON、全部 raw/解析 URL/rewrite/refspec 审计 | pending |
| AC-5 | Harness、秘密/异常文件、完整 diff 和负责人授权记录 | pending |
| AC-6 | 显式非强制 push 与本地/远程 ref 精确比较 | pending |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 决定 | 使用个人私有仓库 `liluqing/easy-markdown` | repository owner |
| 2026-07-18 | 决定 | 最小 CI、1 位独立审批、过期审批失效、禁止强推/删除 | repository owner 最终共同理解确认 |
| 2026-07-18 | 边界 | 这是从 bootstrap 到 active 的一次性治理激活事务；不创建普通 WORK 分支 | 旧策略禁止普通 branch/commit/push，只有完整激活闸门通过后才能首次推送 |
| 2026-07-18 | 安全 | Reviewer 邀请目标只提交给 GitHub，不写入仓库 | 避免持久化个人邮箱 |

## 7. 风险与阻塞

- 风险：GitHub 个人私有仓库套餐可能不支持所需保护能力；必须以 API 返回事实为准。
- 风险：首次推送前远程没有 `main`，required check 可能只能在工作流首次运行后绑定；按平台允许的
  最安全顺序执行并记录短暂 bootstrap 窗口，不伪造已生效保护。
- 风险：Reviewer 邀请未接受时不能形成真实非作者审批；邀请状态与自动 merge 能力分开记录。
- 阻挡条件：认证失败、远程非空/来源不明、工作流存在高权限或可变 include、保护规则不支持、
  policy/URL/refspec 不匹配、Harness 或秘密扫描失败。
- 解除条件：对应事实通过 GitHub CLI/API、本地检查和精确 SHA 证据验证；不使用 force 或绕过规则。
- 解除后的第一步：从失败闸门重新验证，不跳到后续 push。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| 初始 Git/远程/工具审计 | passed | clean `main`; HEAD `d550415`; HTTPS origin；`gh` missing | 未进行网络 Git 操作 |
| GitHub CLI 安装 | passed | 官方 v2.96.0 Windows amd64 MSI；SHA-256 `583ee966...21fa5d6` 匹配；`gh version 2.96.0` | 未记录令牌或设备码 |
| `gh auth status` | failed | 尚无 GitHub 登录会话 | 已打开交互式网页登录窗口，等待负责人授权 |
| CLI 登录与仓库权限复核 | passed | `dfdh44675-star` 已登录；`liluqing/easy-markdown` private、空默认分支、viewerPermission `WRITE` | CLI 账号与仓库所有者不同，可承担非作者 Reviewer |
| Reviewer 协作权限 | passed | `dfdh44675-star` collaborator permission = `write` | 负责人提供的邀请目标已接受，不需再次保存或提交邮箱 |
| 官方 action SHA | passed | checkout v7 `9c091bb...fe3e0`；setup-node v7 `8207627...e5020` | 均由 GitHub 官方仓库 commit API 查询 |
| `node scripts/harness/check-harness.mjs`（首次推送前） | passed | 5 REQ、1 active WORK、4 archived WORK、5 ADR、43 Markdown | 候选文件建档完整 |
| GitHub Actions YAML 解析 | passed | PyYAML 6.0.3 解析成功；只读 permissions、10 分钟超时、checkout 不持久化凭据 | 初次因缺少 PyYAML 未运行，安装验证依赖后重跑通过 |
| CI 静态安全审计 | passed | 无 `pull_request_target`、无 write permission、两项 action 均为 40 位不可变 SHA | 无生产 secret 或外部可变 include |
| 候选秘密形态与 `git diff --check` | passed | 3 个任务路径无 token/private-key/password 形态；无空白错误 | 仅任务拥有的 absent 路径 |
| GitHub 仓库/保护查询 | not-run | 待首次推送和保护配置后执行 | 当前仓库为空，尚无 `main` |
| 首次 push 与远程 SHA 比较 | not-run | 待执行 | 所有前置闸门通过后运行 |

## 9. 交接

- 当前状态：`in-progress`
- 已完成：需求接受和执行范围建档；确认本地基线、远程地址和策略模式；安装并认证 GitHub CLI
  2.96.0；确认独立 Reviewer 已具备 Write 权限；固定官方 action SHA 并创建最小 CI。
- 未完成：首次 bootstrap 推送、保护规则、active policy、最终提交和远程复核。
- 下一具体动作：提交已验证的最小 CI/建档候选，并对确认为空的远程执行一次性 bootstrap 推送。
- 修改路径：REQ-2026-005、WORK-2026-005、`.github/workflows/harness.yml`。
- 已运行验证：初始 Git/远程/工具审计、Harness、YAML 解析、CI 安全和秘密形态检查。
- 未运行验证及原因：远程 CI、保护和 SHA 比较必须在首次建立 `main` 后运行。
- 残余风险：空仓库在首次分支建立前无法绑定传统 branch protection；需缩短并记录首次 push 到保护
  生效之间的 bootstrap 窗口；GitHub App 仓库授权尚未验证。
- 工作区保护：任务开始时无用户改动；只暂存第 2 节明确列出的 clean/absent 路径。
- Git 状态：`main`，无 upstream，base/HEAD `d550415b27cc3368604b8228b772148ee5b00428`；
  当前新增 REQ/WORK 尚未提交；last push `not-run`。
- PR 状态：本任务是首次主干激活，不创建业务 PR；checks/review/protection 均 `not-run`。
- 终态说明：只有全部验收和最终 Harness 通过后才能设为 `done` 并归档；不执行自动 merge。
