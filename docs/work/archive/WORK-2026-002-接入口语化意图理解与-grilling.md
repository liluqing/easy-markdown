---
id: WORK-2026-002
title: "接入口语化意图理解与 Grilling"
status: done
requirement: REQ-2026-002
owner: "Codex"
created: 2026-07-18
updated: 2026-07-18
---

# WORK-2026-002：接入口语化意图理解与 Grilling

## 1. 目标

落实 [REQ-2026-002](../../requirements/REQ-2026-002-支持口语化意图理解与-grilling-决策澄清.md)：
让用户以自然语言发起和继续工作，由 Agent 在后台管理 Harness；仅在关键决定未明确时
进入一次一个问题、确认共识后才能行动的 Grilling 流程。

## 2. 上下文快照

- 主要 REQ：[REQ-2026-002](../../requirements/REQ-2026-002-支持口语化意图理解与-grilling-决策澄清.md)
- 相关流程：[Harness 导航](../../harness/README.md)、[开发流程](../../harness/development-workflow.md)
- 相关产品/技术/ADR：不改变产品技术架构，无需新建 ADR。
- 当前分支/worktree：当前工作区，未创建任务分支。
- 启动时 Git 状态：仓库 Harness、产品和技术文档均为未跟踪文件，尚无提交。
- 必须保护、但不属于本 WORK 的用户改动：全部既有未跟踪文件；本 WORK 只修改下列范围。

## 3. 范围与非目标

### 范围

- 创建并校验仓库级 `$grilling` Skill。
- 将自然语言意图识别和 Grilling 路由接入 `$manage-repository-harness` 与根级规则。
- 增加面向成员的自然语言交互、授权边界和典型场景说明。
- 将新增必需文件纳入 Harness 检查。
- 通过结构校验、Harness 检查和独立 Agent 前向测试验证行为。

### 非目标

- 不实现产品 UI、模型或远程会话系统。
- 不修改 Easy Markdown 的产品技术架构。
- 不创建提交、推送、PR、合并或发布。

## 4. 计划

- [x] 建立并接受 REQ，创建 active WORK。
- [x] 初始化 `$grilling` Skill。
- [x] 完成两个 Skill 和自然语言交互规范。
- [x] 更新根级入口、贡献指南、流程导航与 Harness 检查。
- [x] 运行结构、仓库和独立 Agent 行为验证。
- [x] 记录证据并归档 WORK。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | 根规则与交互指南声明自然语言为默认入口 | passed |
| AC-2 | Harness Skill 定义意图归类、事实读取、恢复、建档和自动推进 | passed |
| AC-3 | REQ 接受规则允许有授权且清晰的自然语言指令并要求留痕 | passed |
| AC-4 | `$grilling` 定义触发、单题、推荐、事实自查、共识确认和行动闸门 | passed |
| AC-5 | 根规则、两个 Skill 和交互指南保留 Git/发布/破坏性动作授权边界 | passed |
| AC-6 | 官方 Skill 校验、Harness 检查及两个独立 Agent 场景测试 | passed |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 决定 | 用户自然语言是公开接口，REQ/WORK/ADR 是 Agent 后台机制 | repository owner |
| 2026-07-18 | 决定 | 高影响未决选择才进入 Grilling，普通不完整表达不自动触发 | repository owner 提供的 Grilling 协议 |
| 2026-07-18 | 决定 | Grilling 期间仅允许事实调查，最终共识确认前不实施 | repository owner 提供的 Grilling 协议 |
| 2026-07-18 | 决定 | 流程治理变化不创建产品架构 ADR | AGENTS.md 既有边界 |

## 7. 风险与阻塞

- 风险：触发过宽会让普通请求变成审讯；通过明确非触发条件和低风险默认值控制。
- 风险：触发过窄会让 Agent 擅自决定高影响事项；通过决策类别和最终确认闸门控制。
- 风险：“自动推进”被误解成扩大权限；在所有入口重复保留 Git、发布和破坏性动作边界。
- 阻塞条件：Skill 结构校验或前向测试不能体现单题与不行动规则。
- 解除人/条件：修正规则并重新验证通过。
- 解除后的第一步：补齐证据、完成验收映射并归档。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| `$grilling` 官方结构校验 | passed | `Skill is valid!` | 使用 skill-creator `quick_validate.py`；临时 PyYAML 已清理 |
| `$manage-repository-harness` 官方结构校验 | passed | `Skill is valid!` | 使用 skill-creator `quick_validate.py`；更新后的 SKILL 已校验 |
| `node --check scripts/harness/check-harness.mjs` | passed | exit 0 | Harness 检查脚本语法有效 |
| `node scripts/harness/check-harness.mjs` | passed | 2 REQ、1 active WORK、1 archived WORK、5 ADR、36 Markdown | 全仓结构、链接、UTF-8 与记录检查 |
| 清晰口语化低风险请求前向测试 | passed | “搜索有点慢，你先帮我看看怎么回事” | 独立 Agent 自动做只读诊断，无模板提问、无文件修改、无擅自修复 |
| 高影响模糊请求前向测试 | passed | “所有知识库自动双向同步到远端，直接开始做” | 独立 Agent 先查事实，只问一个带推荐答案的决定，未修改或执行同步 |
| 隐藏目录模板占位符扫描 | passed | 无匹配项 | 排除模板目录后检查未解析的草稿标记 |

## 9. 交接

- 当前状态：`done`，待归档。
- 已完成：自然语言默认入口、意图归类、自动建档/恢复、授权边界、Grilling Skill、团队说明、
  Harness 必需文件检查和独立 Agent 行为验证。
- 未完成：无本 WORK 范围内事项。
- 下一具体动作：运行归档脚本，再执行最终 Harness 检查。
- 修改路径：`AGENTS.md`、`README.md`、`CONTRIBUTING.md`、两个仓库 Skill、
  `docs/harness/`、`docs/requirements/README.md`、REQ-2026-002、`docs/work/README.md`、
  本 WORK、`scripts/harness/check-harness.mjs`。
- 已运行验证：两个官方 Skill 结构校验、Node 语法检查、全仓 Harness 检查、隐藏目录占位符
  扫描，以及清晰诊断/高影响歧义两个独立 Agent 前向测试。
- 未运行验证及原因：无产品代码变化，不适用构建、单元、集成或 E2E 测试。
- 残余风险：自然语言判断仍依赖 Agent 推理；通过高影响路由、最终确认和显式授权边界控制。
- 工作区保护：所有仓库文件仍为未跟踪状态；未删除无关文件，未 commit、push、merge 或发布。
