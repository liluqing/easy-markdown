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
GitHub 仓库建立最小权限 CI、Reviewer 路径、`main` 保护和可信远程策略，并把当前本地基线
首次推送到远程。仓库最初为私有；因免费套餐不执行私有仓库保护，负责人随后授权改为公开。

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
- 当前执行分支：`codex/WORK-2026-005-activate-github-governance`；base ref/SHA：
  `origin/main` / `00876fe9f271b2dc2854fc8c8e7ba5144bfafb26`。
- 当前策略/远程：候选 `active`；canonical `liluqing/easy-markdown`；fetch/push 均为
  `https://github.com/liluqing/easy-markdown.git`；无 URL rewrite。

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
- 在负责人确认公开范围后，把仓库从私有改为公开，使免费套餐下的保护规则实际执行。
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
- [x] 确认 Reviewer 已具备协作权限，配置 `main` 保护并核验平台返回值。
- [x] 更新 active Git 策略，运行 Harness、格式、安全、diff 和 URL 闸门。
- [x] 完成聚焦提交、首次 push、远程 SHA/CI 复核。
- [x] 通过负责人授权改为公开仓库，使保护规则实际执行。
- [ ] 完成治理分支、PR、远程 CI 与最终交接。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | `gh --version/auth status/repo view` 与仓库 API | passed |
| AC-2 | 工作流静态审计、YAML 解析、action SHA 查询 | passed |
| AC-3 | GitHub collaborator/protection 页面与平台返回状态 | passed：规则 `Currently applies to 1 branch` |
| AC-4 | policy JSON、全部 raw/解析 URL/rewrite/refspec 审计 | passed |
| AC-5 | Harness、秘密/异常文件、完整 diff 和负责人授权记录 | passed |
| AC-6 | 显式非强制 push 与本地/远程 ref 精确比较 | passed |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 决定 | 使用个人私有仓库 `liluqing/easy-markdown` | repository owner |
| 2026-07-18 | 决定 | 最小 CI、1 位独立审批、过期审批失效、禁止强推/删除 | repository owner 最终共同理解确认 |
| 2026-07-18 | 边界 | 这是从 bootstrap 到 active 的一次性治理激活事务；不创建普通 WORK 分支 | 旧策略禁止普通 branch/commit/push，只有完整激活闸门通过后才能首次推送 |
| 2026-07-18 | 安全 | Reviewer 邀请目标只提交给 GitHub，不写入仓库 | 避免持久化个人邮箱 |
| 2026-07-18 | 平台事实 | 个人私有仓库已保存 `main` 经典保护规则，但 GitHub 明确标记 `Not enforced` | 不得把本地 policy 切换为 `active`；需由负责人决定升级 GitHub Pro、迁移到付费组织或改变可见性 |
| 2026-07-18 | 授权 | 将仓库改为公开；现有提交邮箱、产品/技术文档和协作流程可长期公开 | repository owner 在 Grilling 共同理解后明确授权实施 |
| 2026-07-18 | 平台事实 | 仓库公开后保护规则显示 `Currently applies to 1 branch` | 阻塞解除；允许把可信远程策略切换为 `active` |

## 7. 风险与阻塞

- 已解除：GitHub 允许保存经典保护规则，但个人私有仓库中曾显示 `Not enforced`；负责人授权改为
  公开后，规则状态变为 `Currently applies to 1 branch`。
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
| 首次 bootstrap commit/push | passed | commit `00876fe9f271b2dc2854fc8c8e7ba5144bfafb26`；非强制 `main -> main` | upstream 已设为 `origin/main` |
| 本地/远程 SHA 比较 | passed | local HEAD 与 `refs/heads/main` 均为 `00876fe9f271b2dc2854fc8c8e7ba5144bfafb26` | 未创建 tag、release 或部署 |
| 首次 GitHub Actions | passed | run `29644723142`；job/check `validate` success | workflow 与提交 SHA 精确匹配 |
| Reviewer 协作状态 | passed | `dfdh44675-star` collaborator permission = `write` | 已接受，不需再次邀请 |
| `main` 保护规则配置（私有阶段） | historical-blocked | 规则 `80428080`：PR、1 approval、dismiss stale、latest non-author approval、`validate`、up-to-date、conversation resolution、no bypass；force push/delete 未允许 | 当时 GitHub 页面显示 `Not enforced` |
| active policy（私有阶段） | historical-blocked | 保持 `bootstrap-limited` | 当时保护未实际执行，不能伪报 active |
| 公开前仓库审计 | passed | 无凭据/受控数据/异常大文件；3 个提交邮箱与产品、技术、流程文档均经负责人确认可长期公开 | 未改写历史 |
| 仓库可见性变更 | passed | GitHub settings 显示 `This repository is currently public`；CLI 返回 `visibility: PUBLIC` | 未改名、迁移、发布或部署 |
| `main` 保护执行复核 | passed | GitHub 显示规则 `80428080` `Currently applies to 1 branch` | CLI 协作者令牌无读取保护 API 的管理权限，返回 404；以所有者页面为准 |
| active policy candidate | passed | canonical `liluqing/easy-markdown`；fetch/push HTTPS URL；required check `validate`；无 URL rewrite | 待治理分支 CI/评审 |

## 9. 交接

- 当前状态：`in-progress`
- 已完成：需求接受和执行范围建档；安装并认证 GitHub CLI 2.96.0；确认独立 Reviewer 具备 Write
  权限；固定官方 action SHA；创建并通过最小 CI；完成首次非强制推送和 SHA 复核；保存完整
  `main` 保护规则。
- 已完成：保护规则实际执行；仓库改为公开；active policy 候选；治理分支已从精确远程 main 建立。
- 未完成：治理检查点提交、分支 push、PR、远程 CI、独立审批和归档。
- 下一具体动作：提交并推送治理候选，创建 Draft PR，等待 `validate` 与非作者评审。
- 修改路径：`docs/harness/git-policy.json`、REQ-2026-005、WORK-2026-005；此前已推送
  `.github/workflows/harness.yml`。
- 已运行验证：初始 Git/远程/工具审计、Harness、YAML 解析、CI 安全、秘密形态、首次远程 CI、
  本地/远程 SHA、协作者权限和保护规则页面复核。
- 未运行验证及原因：治理分支远程 CI、PR 检查与非作者审批需在首次分支 push 后运行。
- 残余风险：仓库内容已公开；治理变更命中 `docs/harness/**`，必须经过独立评审，不自动 merge。
- 工作区保护：任务开始时无用户改动；只暂存第 2 节明确列出的 clean/absent 路径。
- Git 状态：`codex/WORK-2026-005-activate-github-governance`；base/HEAD/remote main
  `00876fe9f271b2dc2854fc8c8e7ba5144bfafb26`；3 个任务路径尚未提交。
- PR 状态：未创建；首次 main CI `validate` 已通过；保护规则实际应用于 `main`。
- 终态说明：只有全部验收和最终 Harness 通过后才能设为 `done` 并归档；不执行自动 merge。
