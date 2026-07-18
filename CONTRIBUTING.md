# 参与 Easy Markdown 开发

本仓库把需求、执行状态、技术决策和验证证据都保存为普通文件，使人类成员和没有历史
记忆的 Agent 能够使用同一套协作流程。

开始前先阅读 [AGENTS.md](AGENTS.md) 和
[Harness 导航](docs/harness/README.md)。详细规则以它们链接的文档为准，本文件只提供
最短操作路径。

日常情况下直接用自然语言说明目标即可，例如“先看看搜索为什么慢”“把这个链接问题
修掉”或“继续上次的 Spike”。Agent 会在后台读取上下文、维护记录和运行检查。只有会
实质改变方向、安全、数据或授权的决定才需要逐项确认，详见
[自然语言协作协议](docs/harness/user-agent-interaction.md)。

## 提交一个需求

1. 直接告诉 Agent 问题、期望结果或已有约束。用户不需要先提供 REQ 编号或填写模板。
2. 若你希望手工建立记录，可以运行：

   ```text
   node scripts/harness/new-requirement.mjs --title "需求标题" --type feature --owner "负责人"
   ```

3. Agent 或维护者补全问题、目标、范围、非目标、验收标准、风险和验证计划。
4. 由产品/项目负责人作决定。清晰且有权限的自然语言指令可以作为接受依据；含糊决定仍
   保持 `proposed` 并逐项澄清。
5. 不要把完整 PRD 复制进 REQ；链接受影响的 FR、US 或产品文档。

小型错字或不改变行为的说明修正不要求创建 REQ；若会 commit/开 PR，Agent 会在后台创建
一个 `requirement: none` 的轻量 WORK，用户不用填写。

## 开始实现

标准或重大变更需要工作项。Agent 默认在后台创建；维护者也可以手工运行：

```text
node scripts/harness/new-work-item.mjs --title "实现标题" --requirement REQ-YYYY-NNN --owner "负责人"
```

在 `docs/work/active/` 的 WORK 中记录上下文、计划、保护中的用户改动和验证方法。一个
任务只维护一个 active WORK；后续成员应恢复原工作项，而不是新建重复记录。

若改变架构、依赖、安全边界、数据格式、IPC 或 Git 行为，先运行：

```text
node scripts/harness/new-adr.mjs --title "决策标题"
```

在 ADR 评审前保持 `Proposed`。流程治理变化记录在 Harness 文档；只有影响产品技术
架构时才创建技术 ADR。

## 分支、提交与评审

用户只需授权“做、修、实现”目标，不需要在每个阶段再次说“可以提交”“可以推送”。Agent
按 [软件仓库 Git 工作流](docs/harness/git-workflow.md) 自动推进：

- 使用受保护 `main` 和包含 WORK ID 的短生命周期分支。
- 单一意图且检查通过时自动 commit，只显式暂存任务拥有的文件。
- 在暂停、交接或 PR-ready 时自动 push，并创建/更新 Draft PR。
- 只有 `done` 且归档、归档后 Harness 通过的 WORK 才把 PR 转为 Ready；只有轻微/标准
  变更在当前 HEAD 的 CI、非作者批准、风险证据、主干保护和 expected-head merge 均满足
  时自动 Squash Merge。`abandoned` 永不 Ready/merge。
- 文件归属不明、秘密/异常文件、检查失败、冲突、远端/凭据或保护条件不足时才询问。

任务开始前已脏的文件整文件受保护；治理、CI/CD、CODEOWNERS 和远端执行路径不能用候选
新规则自我授权。push/Ready/merge 使用分支点 base、当前 protected tip 与候选 HEAD 的
最严格规则，并要求独立批准；未评审分支 CI 不得获得生产秘密或高权限。重大/紧急变更
永不自动 merge。

“先看看”“只做方案”“不要提交/推送”等更窄约束始终有效。不强制推送、不重写共享历史，
不把普通开发授权扩展到发布、部署或标签。评审同时检查实现、测试、产品/技术文档和 WORK
中的验收证据。

## 完成工作

1. 逐条验证验收标准并把证据写回 WORK。
2. 更新受影响的产品基线、技术基线和 ADR。
3. 检查完整差异，确认没有秘密、调试文件或无关变化。
4. 完成交付时将 WORK 设为 `done`；停止交付时记录原因、未满足验收、风险和后续负责人，
   再设为 `abandoned`。只有 `done` 可以进入 Ready/merge。
5. 归档 WORK：

   ```text
   node scripts/harness/archive-work-item.mjs --id WORK-YYYY-NNN
   ```

6. 对归档后的最终状态运行：

   ```text
   node scripts/harness/check-harness.mjs
   ```

质量要求和无法运行测试时的记录方式见
[质量闸门](docs/harness/quality-gates.md)。
