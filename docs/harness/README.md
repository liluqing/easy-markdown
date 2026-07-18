# Easy Markdown Repository Harness

Repository Harness 是本仓库的持久协作系统：它让一个没有聊天历史、没有上次会话记忆的
团队成员或 Agent，仍能恢复项目目标、当前执行状态、决策依据和验证证据。

Harness 不替代产品管理或代码评审，也不替负责人作产品决定。用户用自然语言表达目标与
决定，Agent 在后台把工作上下文变成可追踪、可检查的仓库文件。

## 1. 设计目标

- 新成员在几分钟内找到项目阶段、技术边界和当前工作。
- 每个非轻微变化能从需求追到工作项、决策、实现、测试和验收。
- 工作在任意会话结束时都能安全交给下一位成员。
- 同一事实只有一个维护位置，避免 README、PRD、ADR 和聊天互相漂移。
- 流程与变更风险成比例，小修正不背负完整需求流程。
- 能机器检查的规则交给脚本，人只判断范围、价值、风险和取舍。
- 用户无需学习 Harness 术语；事实由 Agent 查找，只有高影响决定才逐项询问。

## 2. Harness 的四层结构

| 层 | 入口 | 职责 |
| --- | --- | --- |
| 强制契约 | [AGENTS.md](../../AGENTS.md) | 每次任务必须遵守的启动、安全、追踪、验证和交接规则 |
| 可复用流程 | [Harness Skill](../../.agents/skills/manage-repository-harness/SKILL.md)、[Grilling Skill](../../.agents/skills/grilling/SKILL.md) | 从自然语言路由到执行记录；必要时逐项确认高影响决定 |
| 长期知识 | 本目录、`docs/product/`、`docs/technical/` | 解释开发流程、工程原则、产品与技术真源 |
| 执行与自动化 | `docs/requirements/`、`docs/work/`、`scripts/harness/` | 保存单次变化与当前状态，并检查结构性错误 |

根文件保持短而强制，Skill 保持可操作，详细原因放在本目录，脚本只编码可确定的规则。
同一条规则不在四层重复维护。

## 3. 追踪链

```text
产品基线 / 用户反馈
        │
        ▼
REQ：为什么做、做什么、如何验收
        │
        ▼
WORK：怎么做、当前做到哪里、下一步是什么
        │
        ├── ADR：需要长期保留的技术取舍
        ├── 实现：代码、配置、文档
        └── 验证：测试、Spike、人工检查证据
        │
        ▼
产品/技术基线更新 + WORK 归档
```

轻微变更可以跳过 REQ 和 WORK；标准或重大变更不得跳过。ADR 只记录需要长期理解的
产品技术决策，不把普通实现细节都升级为架构决策。

## 4. 真源地图

| 要回答的问题 | 去哪里找 | 不应放在哪里 |
| --- | --- | --- |
| 这个产品当前要解决什么？ | `docs/product/` | WORK、聊天 |
| 为什么提出这次变化，边界是什么？ | `docs/requirements/REQ-*.md` | 提交消息、WORK 的复制段落 |
| 这次工作做到哪里，谁接手？ | `docs/work/active/WORK-*.md` | README、聊天 |
| 为什么选择这项架构？ | `docs/technical/adr/` | 代码注释、REQ |
| 系统现在应如何设计？ | `docs/technical/` | 单个 ADR |
| 软件仓库何时自动 commit/push/merge？ | `docs/harness/git-workflow.md` | 聊天、单个 WORK |
| 原始调研证据是什么？ | `research/` | PRD 的无来源结论 |
| 项目当前处于什么阶段？ | `README.md` | 多份计划文档 |
| 精确依赖版本是什么？ | manifest 与 lockfile | AGENTS、技术说明 |

真源之间冲突时，不按“最近修改”自动裁决。先识别每个文件拥有的事实类型，再在 active
WORK 中记录冲突、影响和需要谁决定。

## 5. 常用路径

- 日常怎么向 Agent 提需求：[自然语言协作协议](user-agent-interaction.md)
- 新增或评审需求：[需求管理](../requirements/README.md)
- 开始、恢复或归档执行：[工作项管理](../work/README.md)
- 从需求到关闭：[开发流程](development-workflow.md)
- 软件仓库 branch/commit/push/PR/merge：[Git 工作流](git-workflow.md)
- Git bootstrap/远端/保护机器配置：[Git 策略](git-policy.json)
- 代码与架构原则：[工程规范](engineering-standards.md)
- 文档放置与更新规则：[文档治理](document-governance.md)
- Definition of Ready/Done：[质量闸门](quality-gates.md)
- 跨会话恢复：[Agent 交接协议](agent-handoff.md)
- 技术选择与边界：[MVP 技术选型](../technical/02-technology-selection.md)
- 原始实验数据：[调研数据治理](../../research/README.md)

## 6. 当前落地范围

当前 Harness 提供本地模板、生成器和一致性检查。尚未包含：

- 远端 CI 和分支保护配置。
- Git 托管平台的审批、Issue 或 PR 自动同步。
- 自动决定需求是否被接受。
- 自动证明产品验收标准成立。

这些能力应在团队完成首轮真实使用后，根据实际摩擦新增，不能为了“流程完整”提前构建。
