# 工作项与执行记忆

WORK 保存一次执行的计划、当前状态、验证证据和交接。它是跨成员、跨 Agent 会话恢复的
唯一执行真源。

## 1. 创建或恢复

先检查 `docs/work/active/` 是否已有同一任务。存在则恢复原 WORK，不要因为换了 Agent
或会话而重复创建。

用户说“继续”“接着做上次的内容”时，Agent 应从 active WORK、Git 状态和仓库真源恢复
最匹配的任务；不要要求用户复述编号或重新填写上下文。若存在多个无法可靠区分的 active
WORK，才询问用户要继续哪一个。

标准或重大变更从已接受的 REQ 创建：

```text
node scripts/harness/new-work-item.mjs --title "工作标题" --requirement REQ-YYYY-NNN --owner "负责人"
```

维护类执行只有在确实不对应需求时才显式使用 `--requirement none`；如果变化用户行为，
不能用 `none` 绕过需求。

轻微变更不要求 REQ，但只要进入自动 commit/PR 生命周期，就使用
`--requirement none` 建立轻量 WORK，以持久记录初始文件归属、验证和 Ready 证据。用户
明确要求同会话本地修改且不进入 Git 生命周期时才可省略。

WORK 记录不得删除，ID 创建后不复用；同一年三位序号用尽时生成器会明确失败。

清晰的实施授权下，Agent 同时按 [软件仓库 Git 工作流](../harness/git-workflow.md) 自动
创建/恢复该 WORK 的聚焦分支，并在安全检查点 commit、交接点 push。用户不需要逐次确认；
bootstrap、文件归属、检查、远端或冲突条件不足时在 WORK 中如实记录。

## 2. 生命周期

```text
planned -> in-progress -> review -> done -> archive/
                    \-> blocked -> in-progress
planned/in-progress/blocked/review -> abandoned -> archive/
```

`done` 和 `abandoned` 文件不得留在 `active/`。归档：

```text
node scripts/harness/archive-work-item.mjs --id WORK-YYYY-NNN
```

归档后必须再次运行 Harness。`done` 表示满足 DoD，可继续到 PR Ready/merge；`abandoned`
表示停止交付，必须记录未满足验收与后续归属，永不 Ready/merge。

## 3. 更新时机

以下事件发生后立即写回 WORK：

- 完成一个可验证步骤。
- 范围、验收、计划或下一步变化。
- 做出或否决重要技术决定。
- 发现用户已有改动、安全/兼容风险或隐藏依赖。
- 测试成功、失败、无法运行或环境改变。
- 进入阻塞、评审、完成或放弃状态。

## 4. 必需内容

- REQ 及相关产品/技术/ADR 链接。
- 启动时 Git 状态和必须保护的用户改动。
- 目标、范围、非目标、计划与验收映射。
- 决定、假设、风险和阻塞。
- 准确验证命令、结果和未运行原因。
- 当前/上游分支、HEAD、base ref/SHA、owned paths/初始状态、最后 commit/push、PR exact
  head、changed-files、检查/评审、风险等级和自动 merge 条件。
- 终态是 `done` 还是 `abandoned`；若放弃，记录原因、未满足验收、保留结果、残余风险与
  后续负责人。
- 已完成、未完成、下一具体动作、修改路径和残余风险。

完整恢复协议见 [Agent 交接](../harness/agent-handoff.md)，模板见
[work-item.md](../templates/work-item.md)。

## 5. 归档规则

- 归档保留执行证据，不代表它仍是当前计划。
- 继续已归档工作时创建新 WORK，并链接原项。
- 归档后如只修正错字可直接修；若改变结论或证据，建立新 WORK 说明原因。
- 不删除失败或放弃的 WORK；失败信息是后续决策输入。
