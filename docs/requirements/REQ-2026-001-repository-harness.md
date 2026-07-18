---
id: REQ-2026-001
title: 建立可恢复的仓库协作 Harness
type: enabler
status: validated
priority: P0
owner: repository-maintainers
created: 2026-07-18
updated: 2026-07-18
related_product: []
related_work_items: [WORK-2026-001]
related_adrs: []
---

# REQ-2026-001：建立可恢复的仓库协作 Harness

## 1. 问题与证据

仓库已有完整的可行性、PRD、用户故事、技术选型、Spike 和 ADR，但没有统一入口、需求
变更台账、执行状态或交接协议。Agent 每次进入可能没有历史记忆，只能重新推断“需求放
哪里、当前做到哪里、哪些决定已批准”，容易重复工作或让文档互相漂移。

现有直接证据是 README 仍写着“尚未进行技术选型”，而技术选型文档和五个 ADR 已存在。

## 2. 目标用户与预期结果

- 目标用户：开发、产品、测试、维护者和参与仓库工作的 Agent。
- 预期结果：任何成员仅依赖仓库文件即可恢复目标、边界、当前工作和下一步。
- 成功信号：新增需求、工作项、ADR、验证和交接都有固定位置与可运行命令。

## 3. 范围

- 根级 Agent 强制规则和人类贡献入口。
- 需求、工作项、ADR、文档、质量和交接的治理方法。
- 仓库级 `$manage-repository-harness` Skill。
- REQ/WORK/ADR 模板与无额外依赖的 Node 生成/归档工具。
- ID、状态、引用、本地链接和占位符的自动一致性检查。
- 修正 README 的当前阶段漂移，并治理 `research/`。

## 4. 非目标

- 不创建产品功能代码或初始化 Tauri/React 工程。
- 不配置远端 CI、分支保护或 Git 托管平台集成。
- 不自动批准需求、ADR 或产品验收。
- 不批量改写现有产品/技术文档的格式。

## 5. 相关基线

- [MVP PRD](../product/02-mvp-prd.md)
- [MVP 技术选型](../technical/02-technology-selection.md)
- [五天技术 Spike](../technical/03-spike-plan.md)

## 6. 约束、依赖与风险

- 流程必须与风险成比例，轻微修正不能被迫创建完整 REQ/WORK。
- 同一规则不能在 AGENTS、Skill 和说明文档中多份维护。
- 自动化仅依赖已存在的 Node.js，不应提前创建产品 package manifest。
- Harness 自身可能过重；首版只覆盖高频创建、归档与结构校验。
- Agent 不能把没有回应解释为需求已批准。

## 7. 方案边界

采用四层结构：AGENTS 是强制入口，Skill 路由动作，`docs/harness` 解释长期规范，
REQ/WORK/ADR 与脚本保存和检查执行状态。仓库流程决定不创建产品技术 ADR；只有影响
产品架构的选择才进入 `docs/technical/adr/`。

## 8. 验收标准

- [x] AC-1：新 Agent 能从根入口确定启动顺序、当前技术状态、安全边界和结束协议。
- [x] AC-2：团队能明确判断需求、当前执行、产品基线、技术决定和研究证据分别放哪里。
- [x] AC-3：REQ、WORK、ADR 能通过模板/命令重复创建，完成 WORK 能安全归档。
- [x] AC-4：自动检查能发现缺失入口、非法/重复 ID 和状态、悬空 REQ 引用、完成项留在
  active、本地 Markdown 断链、ADR 索引漂移和非模板占位符。
- [x] AC-5：本次 Harness 建设本身拥有 REQ、WORK、验证证据和归档交接。

## 9. 验证计划

- 对所有 Node 脚本执行语法检查。
- 以 dry-run 验证三个生成器，以当前 WORK 验证归档器。
- 运行 Harness 全仓检查。
- 使用 `skill-creator` 校验器验证仓库 Skill。
- 让一个不参与实现的 Agent 只依赖 Skill 和仓库文件进行可用性复核。

## 10. 决策记录

| 日期 | 决策人 | 决定 | 原因/影响 |
| --- | --- | --- | --- |
| 2026-07-18 | repository owner | Accepted | 用户明确要求建立仓库级 Harness、规范和持久协作流程 |
| 2026-07-18 | maintainers | 不创建产品 ADR | 本次改变仓库开发治理，不改变 Easy Markdown 产品技术架构 |
| 2026-07-18 | maintainers | Validated | 生成器、归档保护、故障注入、全仓检查、Skill 官方校验和独立 Agent 复核均通过 |
