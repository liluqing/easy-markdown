---
id: WORK-2026-006
title: "收紧 GitHub 合并方式"
status: in-progress
requirement: REQ-2026-006
owner: "Codex"
created: 2026-07-18
updated: 2026-07-18
---

# WORK-2026-006：收紧 GitHub 合并方式

## 1. 目标

落实 [REQ-2026-006](../../requirements/REQ-2026-006-强制-github-squash-merge.md)：让 GitHub
只允许 Squash Merge，与 `git-policy.json` 一致，并保留既有共享历史。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-006](../../requirements/REQ-2026-006-强制-github-squash-merge.md)。
- 相关产品/技术/ADR：[Git 工作流](../../harness/git-workflow.md)、
  [Git 策略](../../harness/git-policy.json)；仓库流程修正，不新增产品 ADR。
- 当前分支/worktree：仓库根工作树，`codex/WORK-2026-006-enforce-squash-merge`。
- 上游/HEAD：创建时跟踪 `origin/main`；HEAD `a164ee22f4c1e51713b78d586b9c81fb4281b2b1`。
- 基线引用/SHA：`origin/main` / `a164ee22f4c1e51713b78d586b9c81fb4281b2b1`。
- Git 策略模式/canonical repository：`active` / `liluqing/easy-markdown`。
- 启动时 Git 状态：clean `main`，无 modified、staged 或 untracked 文件。
- 远程/PR 状态：公开仓库；`main` protected；PR #1 已批准并合并；本 WORK 尚无 PR。
- 平台修改前基线：Merge Commit、Squash Merge、Rebase Merge 均启用；auto-merge 与自动删分支关闭。
- 必须保护、但不属于本 WORK 的用户改动：无。

| 目标路径 | 任务开始状态 | 归属/可暂存证据 |
| --- | --- | --- |
| `docs/requirements/REQ-2026-006-强制-github-squash-merge.md` | absent | 本任务需求记录 |
| `docs/work/active/WORK-2026-006-收紧-github-合并方式.md` | absent | 本任务执行与交接记录 |

## 3. 范围与非目标

### 范围

- 通过 GitHub 所有者设置关闭 Merge Commit 和 Rebase Merge，保留 Squash Merge。
- 用 GitHub API 和所有者页面双重验证合并方式、公开性、默认分支与主干保护。
- 记录历史偏差、授权、验证、回退与后续 PR 交接。

### 非目标

- 不改写 PR #1 或 `main` 历史。
- 不修改 Git 策略、分支保护、required check、远程 URL、仓库可见性或发布设置。
- 不自动合并本治理变更。

## 4. 计划

- [x] 复核本地/远程基线、现有策略与 GitHub 合并方式。
- [x] 修改 GitHub 设置为只允许 Squash Merge，并复核无旁路变化。
- [ ] 更新证据，运行 Harness/diff/秘密/URL 闸门，提交、推送并建立 PR。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | GitHub repository API 三个 merge 布尔值 | passed |
| AC-2 | API/页面核对 visibility、default branch、protected、`validate` | passed |
| AC-3 | main SHA/历史比较，release/tag/deployment 审计 | passed |
| AC-4 | Harness、diff、秘密/异常文件、URL 审计与 PR | pending |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 授权 | 用户明确要求处理只保留 Squash Merge | repository owner |
| 2026-07-18 | 决定 | 不修正既有 Merge Commit，只约束未来 PR | 避免重写共享历史 |

## 7. 风险与阻塞

- 风险：GitHub 设置修改可能误触 auto-merge、分支删除或可见性；修改后逐字段复核。
- 阻塞条件：所有者会话失效、API 返回与页面不一致、`main` SHA/保护改变、Harness 或秘密检查失败。
- 解除人/条件：由 repository owner 恢复管理会话，或以 GitHub 平台事实和本地闸门证明一致。
- 解除后的第一步：重新读取完整设置，不在未知状态下重试写操作。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| 初始 Git/策略审计 | passed | clean main；active policy；base `a164ee2` | 无用户改动 |
| GitHub 合并方式基线 | passed | merge=true, squash=true, rebase=true | 与 policy `squash` 不一致 |
| GitHub 主干基线 | passed | public；default `main`；protected=true；SHA `a164ee2` | 修改前证据 |
| GitHub 合并方式修改 | passed | merge=false, squash=true, rebase=false | API 与所有者页面一致 |
| GitHub 仓库旁路复核 | passed | public；default `main`；auto-merge=false；自动删分支=false；main SHA `a164ee2` | 可见性、历史和其他合并设置未变 |
| `main` 保护复核 | passed | PR/status required；`validate` required；no bypass；force push/delete disabled | 所有者保护规则页面 |
| 最新主干 CI | passed | Harness push run success，head `a164ee2` | 修改设置未触发代码变更 |

## 9. 交接

- 当前状态：`in-progress`
- 已完成：接受 REQ、建立 WORK/分支、复核基线；平台已只允许 Squash Merge；主干保护与历史无变化。
- 未完成：本地 Harness/diff/秘密/URL 闸门、提交、push、PR 与远程 CI。
- 下一具体动作：验证并提交 REQ/WORK 证据，推送工作分支并创建 Draft PR。
- 修改路径：REQ-2026-006、WORK-2026-006。
- 已运行验证：Git 状态/策略/远程基线、GitHub repository/branch/actions API、所有者设置和保护页面。
- 未运行验证及原因：本地 Harness/diff/秘密/URL 和 PR CI 尚待执行。
- 残余风险：现有 Merge Commit 按约定保留；本治理记录仍需独立评审，不自动 merge。
- 工作区保护：任务开始时 clean，无用户改动；只暂存上表两个 absent 路径。
- Git 状态：分支 `codex/WORK-2026-006-enforce-squash-merge`；base/HEAD `a164ee2`；
  REQ/WORK 为本任务新增未跟踪文件；last commit/push not-run。
- PR 状态：not-run；重大治理变更不自动 merge。
- 终态说明：完成平台复核与交付闸门后设为 `done` 并归档。
