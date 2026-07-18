---
id: REQ-2026-006
title: "强制 GitHub Squash Merge"
type: maintenance
status: validated
priority: P1
owner: "repository-maintainers"
created: 2026-07-18
updated: 2026-07-18
related_product: []
related_work_items: [WORK-2026-006]
related_adrs: []
---

# REQ-2026-006：强制 GitHub Squash Merge

## 1. 问题与证据

仓库策略 `docs/harness/git-policy.json` 已规定 `merge_method: squash`，但 GitHub 仓库同时允许
Merge Commit、Squash Merge 和 Rebase Merge。PR #1 因此被人工以 Merge Commit 合入，生成
`a164ee22f4c1e51713b78d586b9c81fb4281b2b1`，说明平台设置与机器策略不一致，后续仍可能重复偏离。

## 2. 目标用户与预期结果

- 目标用户：仓库维护者、Reviewer 和按 Harness 自动协作的 Agent。
- 预期结果：GitHub 只提供 Squash Merge，使平台行为与仓库策略一致。
- 可观察的成功信号：仓库 API 返回 `allow_squash_merge=true`、`allow_merge_commit=false`、
  `allow_rebase_merge=false`；现有共享历史不被改写。

## 3. 范围

- 关闭 GitHub 的 Merge Commit 和 Rebase Merge，保留 Squash Merge。
- 验证仓库公开性、默认分支、保护规则、CI 和合并方式没有被意外改变。
- 记录 PR #1 的历史偏差、负责人授权、平台返回值和回退方式。

## 4. 非目标

- 不改写、rebase、reset 或 force push 已合并历史。
- 不改变分支保护、Reviewer 数量、必需检查、仓库可见性、远程 URL 或 Git 策略字段。
- 不发布、部署、打标签或自动合并本治理变更。

## 5. 相关基线

- 产品文档或 FR/US：无产品行为变化。
- 技术文档或 ADR：[Git 工作流](../harness/git-workflow.md)、
  [Git 策略](../harness/git-policy.json)；这是仓库流程修正，不新增产品 ADR。
- 已有需求：[REQ-2026-005](REQ-2026-005-启用-github-协作基线.md)。

## 6. 约束、依赖与风险

- 产品约束：不影响 Easy Markdown 运行时或知识正文。
- 技术依赖：GitHub 仓库设置、所有者管理会话和 GitHub repository API。
- 数据/隐私/安全：不读取或写入凭据，不改变仓库可见性；只修改合并能力布尔值。
- 兼容与迁移：已存在的 Merge Commit 保留；新规则只影响未来 PR。
- 回退考虑：若平台兼容性问题需要恢复，必须通过新的治理需求显式重新开启对应方式；不得改写历史。

## 7. 方案边界

平台必须只允许 Squash Merge。Repository Harness 中的 `merge_method: squash` 继续作为机器真源；
GitHub 设置是执行层，不在文档中复制可变 UI 步骤。

## 8. 验收标准

- [x] AC-1：GitHub API 证实 `allow_squash_merge=true`、`allow_merge_commit=false`、
  `allow_rebase_merge=false`。
- [x] AC-2：仓库仍为 public、默认分支仍为 `main`，现有 `main` 保护和 required check `validate`
  保持生效。
- [x] AC-3：`main` 历史未被改写；本变更不创建 release、deployment、tag 或自动 merge。
- [x] AC-4：Harness、完整 diff、秘密/异常文件和远程 URL 闸门通过；治理变更进入独立评审 PR。

每条标准必须能独立判断通过或失败，并在 WORK 中关联证据。

## 9. 验证计划

- 自动化：GitHub repository API、保护页面/API、远程 URL 审计、Harness、diff 和秘密形态检查。
- 人工验证：所有者设置页面只显示 Squash Merge 为启用状态。
- 测试数据/环境：公开仓库 `liluqing/easy-markdown`，受保护分支 `main`，基线
  `a164ee22f4c1e51713b78d586b9c81fb4281b2b1`。

## 10. 决策记录

| 日期 | 决策人 | 决定 | 原因/影响 |
| --- | --- | --- | --- |
| 2026-07-18 | repository owner | Accepted | 用户在得知 PR #1 使用 Merge Commit 后明确说“可以的，处理下吧”，授权只保留 Squash Merge |
| 2026-07-18 | maintainers | 不改写既有历史 | 共享历史保持可追溯；修正只约束未来合并 |
