---
id: REQ-2026-005
title: "启用 GitHub 协作基线"
type: enabler
status: accepted
priority: P0
owner: "repository-maintainers"
created: 2026-07-18
updated: 2026-07-18
related_product: []
related_work_items: [WORK-2026-005]
related_adrs: []
---

# REQ-2026-005：启用 GitHub 协作基线

## 1. 问题与证据

本地 `main` 已有可信提交基线，GitHub 私有空仓库 `liluqing/easy-markdown` 也已创建并配置为
`origin`，但 `docs/harness/git-policy.json` 仍处于 `bootstrap-limited`：没有 canonical
repository、获准 URL、必需检查或已验证的主干保护，因此 Harness 明确禁止 push、PR 和 merge。
同时 GitHub CLI 尚未安装，新私有仓库尚未授予 Agent 连接器访问权，远程协作链路不可验证。

## 2. 目标用户与预期结果

- 目标用户：Easy Markdown 维护者、团队 Reviewer 和无聊天记忆的 Agent。
- 预期结果：建立最小权限、可审计的 GitHub 协作基线，并把现有本地 `main` 首次推送到可信远程。
- 可观察的成功信号：远程 `main` 精确对应获准本地 HEAD；最小 CI、主干保护、Reviewer 路径和
  active Git 策略均有可复核证据；后续 Agent 可按 Harness 自动使用短分支和 PR。

## 3. 范围

- 安装并认证 GitHub CLI，验证当前用户对 `liluqing/easy-markdown` 的管理权限。
- 邀请负责人指定的非作者 Reviewer；不在仓库文档中保存其邮箱或其他凭据。
- 增加只运行 Harness 一致性检查的最小 GitHub Actions 工作流。
- 为 `main` 配置 PR、至少一位非作者审批、过期审批失效、必需检查、禁止强推和禁止删除。
- 将 canonical repository、获准 HTTPS fetch/push URL 和必需检查写入 Git 策略并切换为 `active`。
- 以一次聚焦 bootstrap 激活事务保存治理记录和 CI，然后首次推送 `main`，核验远程状态。

## 4. 非目标

- 不实现产品功能，不启动 MVP 技术 Spike。
- 不发布、部署、打标签或配置生产凭据。
- 不自动合并任何业务 PR，不降低现有 Reviewer 和安全要求。
- 不把协作者邮箱、认证令牌、设备码或正文内容写入仓库、日志或 WORK。

## 5. 相关基线

- 产品文档或 FR/US：[MVP PRD](../product/02-mvp-prd.md)。
- 技术文档或 ADR：[技术选型](../technical/02-technology-selection.md)；本变更仅影响软件仓库治理，
  不新增产品架构 ADR。
- 已有需求：[REQ-2026-003](REQ-2026-003-建立低打扰自动化-git-工作流.md)、
  [REQ-2026-004](REQ-2026-004-初始化仓库可信基线.md)。

## 6. 约束、依赖与风险

- 产品约束：GitHub 只保存软件仓库，不改变本地优先知识正文模型。
- 技术依赖：系统 Git、Node、GitHub CLI、GitHub Actions 和 GitHub 分支保护 API。
- 数据/隐私/安全：工作流 `permissions: contents: read`，不使用生产 secret，不持久化凭据；外部
  actions 固定到不可变 commit SHA；协作者身份只提交平台所需邀请，不写入仓库。
- 兼容与迁移：首次推送必须是从空远程建立 `main`，不重写本地历史；远程若不为空或出现非快进
  状态则停止。
- 回退考虑：推送前可删除尚未生效的本地候选配置；推送后不得改写历史，回退通过后续治理提交和
  平台配置修改完成。

## 7. 方案边界

这是 `bootstrap-limited` 到 `active` 的一次性治理激活事务。只有在 GitHub 账号、远程空仓库、
最小 CI 权限模型、Reviewer 邀请路径和主干保护能力均已验证后，才允许把候选策略视为 active 并
执行首次推送。传统保护必须在远程 `main` 与首次 check 存在后才能完整绑定，因此允许在所有本地
安全闸门通过后进行一次非强制 bootstrap push；若随后发现 GitHub 套餐使必需保护无法执行，则保持
`bootstrap-limited`、停止后续治理推送，并如实记录平台阻塞。

## 8. 验收标准

- [x] AC-1：GitHub CLI 已安装并以获授权协作者身份认证，仓库所有者的管理会话可用；远程仓库存在、
  私有、初始为空且 URL 精确匹配。
- [x] AC-2：最小 CI 仅检出仓库并运行 `node scripts/harness/check-harness.mjs`，token 只读、无凭据持久化、
  无生产 secret，所有外部 action 固定到不可变 SHA。
- [x] AC-3：`main` 配置为必须通过 PR、至少一位审批、过期审批失效、必需 Harness 检查通过，且禁止
  强推和删除；指定 Reviewer 已邀请，接受状态如实记录。
- [x] AC-4：Git 策略为 `active`，canonical repository、全部 raw/解析后 fetch/push URL、scheme、
  refspec 和 required check 与平台事实一致，且 URL rewrite 审计无未批准项。
- [x] AC-5：Harness、YAML/JSON、秘密/异常文件和完整 diff 检查通过；治理变更由负责人明确批准。
- [x] AC-6：本地现有 `main` 以非强制首次推送到空远程，远程 `refs/heads/main` 精确等于获准本地
  HEAD；未创建发布、标签、部署或自动合并。

## 9. 验证计划

- 自动化：Harness、JSON/YAML 解析、工作流静态安全审计、Git 状态/差异/URL rewrite/引用 SHA、
  GitHub CLI/API 仓库与保护规则查询、远程引用精确比较。
- 人工验证：确认协作者邀请目标、私有可见性、保护规则和 GitHub Actions 页面状态。
- 测试数据/环境：当前 Windows 工作区、本地提交 `d550415b27cc3368604b8228b772148ee5b00428`、
  GitHub 私有仓库 `liluqing/easy-markdown`。

## 10. 决策记录

| 日期 | 决策人 | 决定 | 原因/影响 |
| --- | --- | --- | --- |
| 2026-07-18 | repository owner | Accepted | 用户在逐项确认私有个人仓库、独立 Reviewer、最小 CI 和主干保护后，明确说“可以，开始实施吧” |
| 2026-07-18 | repository owner | 使用负责人提供的邀请目标 | 目标仅用于 GitHub 协作者邀请，不把邮箱或凭据写入仓库记录 |
| 2026-07-18 | maintainers | 不创建产品 ADR | 这是软件仓库治理激活，不改变产品运行时架构 |
| 2026-07-18 | platform verification | 保持 `bootstrap-limited` | `main` 规则已保存，但 GitHub 将个人私有仓库中的规则标记为 `Not enforced`；AC-3/AC-4 暂不能成立 |
| 2026-07-18 | repository owner | 将仓库改为公开并接受长期公开 | 负责人确认提交邮箱、产品文档、技术文档和协作流程均可长期公开；不改写历史，不发布或部署 |
| 2026-07-18 | platform verification | 激活 Git 策略 | 公开后 GitHub 显示保护规则 `Currently applies to 1 branch`，满足 active policy 的平台前提 |
