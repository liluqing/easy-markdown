# Easy Markdown 仓库协作约束

本文件适用于整个仓库，是人类成员与 Agent 的强制入口。更深目录若增加
`AGENTS.md`，可以补充该目录规则，但不得削弱这里的安全、追溯和质量要求。

## 1. 项目目标与当前阶段

Easy Markdown 是面向团队成员与 AI Agent 的本地优先文档工作区。Markdown、
TXT 和本地资源文件是知识正文的唯一真源，Git 提供版本、差异、恢复和异步协作。

当前处于 **MVP 技术 Spike 准备阶段**。技术方案已经暂定，但仍须通过
[五天技术 Spike](docs/technical/03-spike-plan.md) 验证；不得把 “Accepted for
Spike” 描述成已经完成生产验证。

## 2. 用户交互：自然语言优先

- 用户可以随性、口语化地表达目标，不要求主动提供 REQ、WORK、ADR、状态或模板字段。
- Agent 先从仓库、环境和工具查找事实，再判断用户要探索、诊断、规划、变更、评审、恢复
  或执行被明确点名的动作；不要把可发现的事实反问用户。
- 意图和权限清晰时，Agent 在后台分级、建档、实施、验证和交接。低风险缺失项采用可逆的
  推荐假设并留痕，不因用户表达不正式而停工。
- 有授权负责人的清晰自然语言指令可以构成需求接受；必须在 REQ 记录解释依据，含糊的产品
  决定仍不得由 Agent 自行批准。
- 用户明确要求 grill、访谈、压力测试，或未决选择会实质改变产品、架构、安全、数据、
  迁移、破坏性动作或权限时，使用 `$grilling`：先查事实，一次只问一个决定，每题给出
  推荐答案；完整共同理解获最终确认前只读调查，不实施目标动作。
- 自动推进不扩大任务范围；但清晰的实施授权同时触发
  [软件仓库 Git 工作流](docs/harness/git-workflow.md) 的常规 branch、commit、push、PR 和
  条件 merge 长期授权。发布、删除、批量迁移和高风险 Git 例外仍须明确决定。

具体语义、触发条件和示例见
[用户与 Agent 的自然语言协作协议](docs/harness/user-agent-interaction.md)。

## 3. 每次开始工作的固定顺序

1. 阅读本文件和 [README](README.md)。
2. 阅读与任务直接相关的产品文档、技术文档和 ADR，不要只依赖聊天上下文。
3. 检查 Git 状态和差异，识别并保护用户已有的已修改、已暂存和未跟踪文件。
4. 在 `docs/work/active/` 查找同一任务的工作项；存在则恢复它，不要重复创建。
5. 按下表判断变更等级，补齐所需记录后再实施。
6. 按 [Git 工作流](docs/harness/git-workflow.md) 判断 bootstrap/分支/远端状态；可信基线
   存在时自动创建或恢复聚焦分支。
7. 写代码前确认验收标准、范围、非目标和验证方法。

聊天记录、Agent 记忆和口头约定都不是仓库真源。若仓库事实互相冲突，停止猜测，
在工作项中记录冲突并向负责人确认。

## 4. 变更分级与必需记录

| 等级 | 典型范围 | 开始前必须具备 |
| --- | --- | --- |
| 轻微 | 错字、链接、小型说明修正，不改变行为、接口、数据或架构 | 无需 REQ；进入自动 Git/PR 生命周期时由 Agent 建立 `requirement: none` 的轻量 WORK |
| 标准 | 用户可见行为、Bug 修复、多文件实现、测试变化 | 状态为 `accepted` 或 `in-progress` 的 REQ；一个 active WORK |
| 重大 | 架构、依赖、安全边界、数据格式、IPC、Git 行为或开发流程变化 | 标准变更材料；涉及产品架构时另有 Proposed/Accepted ADR |
| 紧急 | 会丢数据、阻断开发或存在安全风险 | 先建立 WORK 控制范围；合并前补齐 REQ、验证与复盘，不能跳过证据 |

需求由有授权的产品/项目负责人从 `proposed` 改为 `accepted`。Agent 可以起草和
指出缺口，但不能替负责人默许含糊的产品范围。创建方式见
[需求管理](docs/requirements/README.md)。

## 5. 一项事实只有一个主人

| 事实 | 唯一真源 |
| --- | --- |
| 项目入口和当前阶段 | `README.md` |
| 当前产品目标与行为 | `docs/product/` |
| 单次变化的原因、边界和验收 | `docs/requirements/REQ-*.md` |
| 当前执行状态、计划、证据与交接 | `docs/work/active/WORK-*.md` |
| 技术基线与系统边界 | `docs/technical/` |
| 架构决策原因与后果 | `docs/technical/adr/` |
| 原始实验和调研数据 | `research/` |
| 强制仓库规则 | 本文件 |
| 软件仓库 Git 自动化与询问边界 | `docs/harness/git-workflow.md` |
| 详细协作方法 | `docs/harness/` |

REQ 不复制整份 PRD，WORK 不复制需求，ADR 不复制技术基线；用相对链接建立追踪。
精确依赖版本以未来的 manifest 和 lockfile 为准，不在本文件手工维护。

## 6. 技术与架构边界

当前技术选择以
[MVP 技术选型与架构](docs/technical/02-technology-selection.md) 和
[ADR](docs/technical/adr/README.md) 为准。实现时必须保持：

- Tauri 2 + Rust Core 承担文件、路径、Git、搜索和安全边界。
- React + TypeScript + Vite 只负责 UI 与交互；前端不得获得任意文件系统或命令执行能力。
- CodeMirror 6 负责文本编辑和 Diff；Markdown 使用安全 React 渲染管线。
- Git 使用系统 Git CLI，搜索使用捆绑的 ripgrep；命令必须从允许列表构造。
- 正文不进入数据库；索引和缓存必须可从普通文件重建。
- 文件写入必须校验工作区边界，不静默覆盖外部变化，不在日志中记录正文或凭据。

改变上述任一边界，或新增运行时依赖、持久化格式、IPC 能力前，先更新 REQ 和 ADR。
Spike 结果可以推翻暂定选择，但必须保留决策与回退证据。

## 7. 实现原则

- 做满足验收标准的最小完整变更，不顺手扩展无关范围。
- 先复用现有模式；引入抽象、依赖或配置前说明它解决的当前问题。
- 业务规则只保留一份：前端不复制 Rust 的文件、路径或 Git 规则。
- IPC 和持久化格式视为契约；错误码、失败路径、取消和并发状态必须显式设计。
- 安全默认拒绝：路径越界、任意命令、远程脚本、原始 HTML 和未知协议不得默认放行。
- 所有破坏性或批量文件操作必须缩小范围并获得明确授权。
- 文档和测试是实现的一部分；不能运行的验证必须如实记录原因和残余风险。

详细原则见 [工程规范](docs/harness/engineering-standards.md)。

## 8. 质量闸门

开始前满足 Definition of Ready；结束前满足 Definition of Done。最低要求：

- 验收标准逐条映射到实现或验证证据。
- 运行与风险相称的格式、类型、单元、集成、E2E 和安全测试。
- 用户可见行为更新产品基线；架构/依赖/安全变化更新技术文档和 ADR。
- 执行 `node scripts/harness/check-harness.mjs`。
- 检查完整 Git diff，不夹带调试文件、秘密、模板占位符或无关改动。

代码尚未初始化时，不得虚构不存在的构建或测试命令。代码落地后，以 manifest 中的
脚本为准，并同步更新 [质量闸门](docs/harness/quality-gates.md)。

## 9. Git 与文件安全

- 不删除、覆盖、回滚或格式化用户已有改动；未跟踪文件也视为用户数据。
- 一次清晰的实施授权覆盖当前 WORK 的常规 Git 生命周期；Agent 按
  [软件仓库 Git 工作流](docs/harness/git-workflow.md) 自动创建聚焦分支、检查点 commit、
  交接点 push、Draft PR，以及满足全部保护条件后的 Squash Merge，不逐次询问。
- 诊断、评审、方案和显式“不要提交/推送”不授权 Git 写入，并优先于默认自动化。
- 一个 WORK 对应一个聚焦分支或独立 worktree；Agent 分支使用
  `codex/WORK-YYYY-NNN-<slug>`，并从已验证 exact base SHA 创建/校验 ancestry。轻微变更
  使用可追踪的短分支，不直接推送 `main`。
- 记录 owned paths 和任务开始状态；预先 modified/staged/untracked 的文件整文件受保护，
  不能因 Agent 后来修改而按路径暂存。提交必须单一意图、通过相称检查并关联 REQ/WORK。
- 只有在暂停、交接或 PR-ready 时自动 push；只向负责人已配置的可信远端和当前任务分支
  推送。只有轻微/标准变更可自动 merge，且 changed-files、CI、非作者批准、风险证据、真实
  分支保护和 expected-head 原子操作必须绑定同一 HEAD；重大/紧急变更永不自动 merge。
- 任何 fetch/push 前先解析所有配置来源、URL rewrite 和多值 fetch/push URL，并逐一匹配
  机器策略；不得仅检查 `origin` 显示值后才发现真实网络端点。
- 文件归属不明、秘密/异常文件、失败闸门、凭据/远端缺失、非快进、分叉、冲突或保护条件
  不足时才暂停并提出一个最小问题；可从环境查到的事实不得询问用户。
- Git 权限取分支点 base、fetch 后当前 protected tip 与候选 HEAD 三者规则的最严格交集；
  治理、CI/CD、CODEOWNERS 和远端执行路径的变更不能自我授权 push/merge，必须按当前有效
  规则取得独立批准；主干后来收紧的规则同样约束旧分支。
- 不直接编辑 `.git`，不自动 force push、reset/rebase 共享历史、绕过安全闸门、发布、部署
  或创建发布标签。这些动作不属于普通开发授权。
- 没有可信初始提交、exact base SHA 或 active Git 策略时处于 bootstrap 受限模式，不得
  自动把全部未跟踪文件导入基线。可信基线与 active 策略存在、但远端暂时不可用时，可
  继续安全的本地 branch/commit，只把 push/PR/merge 记为 `not-run`。
- 删除、批量移动、迁移、依赖升级和生成大量文件前，先在 WORK 中写明影响与回退。

## 10. 更新与交接

实施过程中出现以下事件时立即更新 active WORK：范围变化、重要决定、新风险、阻塞、
验证结果或下一步改变。结束会话前必须记录：

- 已完成与未完成事项。
- 修改过的路径。
- 已运行的命令、结果和未运行原因。
- 风险、阻塞和需要负责人决定的问题。
- 下一位成员可直接执行的具体下一步。

完成或放弃的 WORK 状态改为 `done`/`abandoned` 后移入 `docs/work/archive/`，再对归档状态
运行 Harness。只有 `done` 可以进入 Ready/merge；`abandoned` 是永不 Ready/merge 的独立
终态。
完整流程见 [开发流程](docs/harness/development-workflow.md) 与
[Agent 交接协议](docs/harness/agent-handoff.md)。

## 11. Harness 常用命令

```text
node scripts/harness/new-requirement.mjs --title "需求标题" --type feature --owner "负责人"
node scripts/harness/new-work-item.mjs --title "工作标题" --requirement REQ-YYYY-NNN --owner "负责人"
node scripts/harness/new-adr.mjs --title "决策标题"
node scripts/harness/archive-work-item.mjs --id WORK-YYYY-NNN
node scripts/harness/check-harness.mjs
```

需要执行需求、工作项、ADR、验证或交接流程时，优先使用仓库 Skill：
`$manage-repository-harness`。需要逐项澄清高影响决定时使用 `$grilling`。
