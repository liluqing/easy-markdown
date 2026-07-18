---
id: WORK-2026-001
title: 建立仓库协作 Harness
status: done
requirement: REQ-2026-001
owner: Codex
created: 2026-07-18
updated: 2026-07-18
---

# WORK-2026-001：建立仓库协作 Harness

## 1. 目标

交付 [REQ-2026-001](../../requirements/REQ-2026-001-repository-harness.md) 定义的根级
约束、仓库 Skill、治理知识、模板和自动化，使后续 Agent 能在无会话记忆时恢复工作。

## 2. 上下文快照

- 相关产品：[MVP PRD](../../product/02-mvp-prd.md)
- 相关技术：[技术选型](../../technical/02-technology-selection.md)、
  [Spike 计划](../../technical/03-spike-plan.md)
- 当前分支/worktree：仓库初始分支，尚无提交。
- 启动时 Git 状态：`README.md`、`docs/`、`research/` 全部为用户已有未跟踪内容。
- 工作区保护：所有已有产品、技术和调研文件均保留；只修正 README 的阶段描述。

## 3. 范围与非目标

### 范围

- 建立 AGENTS/CONTRIBUTING/Skill 三个入口。
- 建立 Harness、REQ、WORK、模板和研究治理目录。
- 建立需求、工作项、ADR 创建器、归档器和一致性检查。
- 验证 Skill、脚本、链接和追踪链。

### 非目标

- 不初始化产品代码。
- 不提交、推送或修改远端。
- 不改变现有产品范围与技术选择。

## 4. 计划

- [x] 审查现有仓库和 Skill 创建规范。
- [x] 设计真源地图、变更分级、生命周期和质量闸门。
- [x] 创建根入口、仓库 Skill、治理文档、模板与当前追踪记录。
- [x] 实现并验证 Harness 脚本。
- [x] 独立复核、完成验收映射并归档。

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 | `AGENTS.md`、README、Agent 交接协议；独立 Agent 恢复测试 | passed |
| AC-2 | Harness 真源地图、文档治理 | passed |
| AC-3 | 三个生成器 dry-run、ADR 索引同步、归档状态保护与最终归档 | passed |
| AC-4 | 全仓检查和受控故障注入 | passed |
| AC-5 | 当前 REQ/WORK、验证证据、交接与归档 | passed |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| 2026-07-18 | 决定 | 使用四层 Harness，避免 AGENTS/Skill/长文档复制规则 | 用户请求范围内 |
| 2026-07-18 | 决定 | 产品架构未变化，不新增技术 ADR | 记录于 REQ |
| 2026-07-18 | 环境 | Skill 初始化器在 Windows 生成乱码 YAML，已重建为 UTF-8 | 不影响产品代码 |
| 2026-07-18 | 审查 | 独立脚本复核发现 ADR 原子性、链接解析和 CLI 参数等问题 | 已加固并用故障测试复验 |
| 2026-07-18 | 决定 | 文本统一 UTF-8/LF，并兼容 BOM 与 PowerShell 5.1 显式 UTF-8 读取 | `.editorconfig` 与 Harness 检查落实 |

## 7. 风险与阻塞

- 风险：流程过重会被绕过；通过轻微变更通道和最小模板控制。
- 风险：规则仍可能漂移；通过唯一真源表和机器检查减少。
- 阻塞条件：无。
- 解除后的第一步：不适用。

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
| `node --check scripts/harness/*.mjs` | passed | 6 个脚本全部通过 | PowerShell 逐文件执行 |
| REQ/WORK/ADR 生成器 dry-run | passed | 分配 `REQ-2026-002`、`WORK-2026-002`、`ADR-0006`；含中文、冒号和 `#` | 未产生测试记录 |
| CLI 未知参数故障注入 | passed | `--dryrun` 被拒绝，未创建 REQ | 防止拼错 dry-run 变成真实写入 |
| 归档状态故障注入 | passed | `in-progress` WORK 被拒绝归档 |  |
| ADR 索引故障注入 | passed | 索引标记损坏时预检失败，未留下 `0006` 文件 | 原子替换在 Windows 实际运行通过 |
| Markdown 链接测试 | passed | 平衡括号、reference-style、文件锚点通过；缺失锚点被阻断 | 临时夹具已删除 |
| active 状态故障注入 | passed | `done` WORK 留在 active 时被阻断 | 状态随后恢复并进入正常关闭 |
| Skill quick validation | passed | `Skill is valid!` | Python 3.14.6，`-X utf8`，临时 PyYAML 6.0.3 |
| `node scripts/harness/check-harness.mjs` | passed | 归档后：1 REQ、0 active WORK、1 archived WORK、5 ADR、32 Markdown | 归档前后均通过 |
| 独立 Agent 可用性复核 | passed | 正确把“原始 HTML 预览”识别为重大安全变更并路由至 REQ/WORK/ADR/验证 | 全程只读 |
| 独立脚本审查 | passed after fixes | P1/P2 发现已修复并重新验证 | 保留完整审查反馈于本次会话 |

## 9. 交接

- 当前状态：`done`
- 已完成：信息架构、入口、治理文档、模板、自动化、故障测试、官方 Skill 校验、独立复核和 WORK 归档。
- 未完成：无必需项；远端 CI、分支保护和产品代码初始化明确不在本需求范围。
- 下一具体动作：无；未来开发从新的 accepted REQ/active WORK 开始。当前文件尚未暂存或提交，
  只有在仓库负责人明确授权后再进入 Git 提交流程。
- 修改路径：`AGENTS.md`、`CONTRIBUTING.md`、`README.md`、`.agents/`、`docs/harness/`、
  `docs/requirements/`、`docs/work/`、`docs/templates/`、`research/README.md`。
- 已运行验证：见“验证证据”表；全部计划内 Harness 验证通过。
- 未运行验证及原因：未运行产品构建/测试，因产品代码和 manifest 尚未初始化且不在范围。
- 残余风险：零依赖 Markdown 检查器覆盖 inline/reference 链接与常用标题锚点，不是完整
  CommonMark 解析器；出现复杂扩展语法时应以新 REQ 评估标准解析库。当前尚无远端 CI。
- 工作区保护：不得删除或重写原有未跟踪产品、技术、ADR 和 CSV 文件。
