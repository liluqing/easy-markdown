# 需求管理

`docs/requirements/` 保存一次变化的“为什么、做什么、边界和如何验收”。它是 PRD/用户
故事与实际执行之间的变更台账，不替代当前产品基线。

## 1. 什么时候需要 REQ

- 用户可见功能或行为变化。
- Bug 修复及其期望行为。
- 多文件技术改进、依赖、数据、接口或安全变化。
- 会影响团队协作方式的仓库治理变化。

错字、失效链接和不改变含义的小型文档修正可以不创建。

## 2. 创建需求

用户直接用自然语言描述问题或目标即可，Agent 负责查找上下文并在后台建立 REQ。以下命令
是 Agent 和维护者的记录工具，不是用户提交需求的前置表单：

```text
node scripts/harness/new-requirement.mjs --title "需求标题" --type feature --owner "负责人"
```

可选参数：

```text
--type feature|bug|improvement|enabler|discovery|maintenance
--priority P0|P1|P2|P3
--year 2026
--dry-run
```

生成器只会建立 `proposed` 草稿，不会自动批准。文件名为
`REQ-YYYY-NNN-<slug>.md`。记录不得删除，ID 创建后不复用；单年三位序号用尽时
生成器会明确失败，而不是生成与校验规则不兼容的 ID。

## 3. Ready 与接受

提交评审前补全：

- 问题、证据、目标用户和预期结果。
- 范围、非目标及受影响 FR/US。
- 可判断通过/失败的验收标准。
- 依赖、风险、安全、迁移/回退和验证计划。
- 负责人及需要谁决策。

只有有授权的产品/项目负责人可以把 `proposed` 改为 `accepted`。其清晰自然语言指令可以
构成接受，不要求说出状态名；Agent 必须在决策记录中保存解释依据。Agent 可以起草、发现
矛盾和提出备选，但不能把没有回应或含糊方向解释为接受。高影响决定未明确时按
[自然语言协作协议](../harness/user-agent-interaction.md) 进入 Grilling。

## 4. 生命周期

```text
proposed -> accepted -> in-progress -> validated -> released
        \-> rejected
任一仍有效状态 -> superseded
```

- `validated` 表示验收条件有证据，不自动代表已经发布。
- `released` 只在进入目标发布或团队正式流程后设置。
- `rejected`/`superseded` 保留原因；后者必须链接替代需求。

状态定义以 [文档治理](../harness/document-governance.md) 为准。

## 5. 关联规则

- REQ 链接受影响的产品文档、FR/US、ADR 与 WORK。
- 不复制整份 PRD 或技术方案；只描述本次变化的增量理由和边界。
- 一个 REQ 可以拆成多个 WORK；每个 WORK 只链接一个主要 REQ。
- 实施中改变验收或范围时，先修改 REQ 的决策记录并重新确认，再继续 WORK。
- 完成后更新当前产品/技术基线，不能让已归档 WORK 成为唯一的新事实。

模板见 [requirement.md](../templates/requirement.md)，质量标准见
[Definition of Ready](../harness/quality-gates.md#1-definition-of-ready)。
