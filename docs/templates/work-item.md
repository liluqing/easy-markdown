---
id: {{ID}}
title: {{TITLE_YAML}}
status: planned
requirement: {{REQUIREMENT}}
owner: {{OWNER_YAML}}
created: {{DATE}}
updated: {{DATE}}
---

# {{ID}}：{{TITLE}}

## 1. 目标

用一两句话说明本次执行要交付的可验证结果，并链接主要 REQ。

## 2. 上下文快照

- 主要 REQ：
- 相关产品/技术/ADR：
- 当前分支/worktree：
- 上游/HEAD：
- 基线引用/SHA：
- Git 策略模式/canonical repository：
- 启动时 Git 状态：
- 远端/PR 状态：
- 必须保护、但不属于本 WORK 的用户改动：

| 目标路径 | 任务开始状态 | 归属/可暂存证据 |
| --- | --- | --- |
|  | clean / modified / staged / untracked / absent |  |

## 3. 范围与非目标

### 范围

-

### 非目标

-

## 4. 计划

- [ ] 步骤 1：
- [ ] 步骤 2：
- [ ] 验证与文档：

## 5. 验收映射

| REQ 验收标准 | 实现/验证方式 | 当前状态 |
| --- | --- | --- |
| AC-1 |  | pending |

## 6. 决定、假设与范围变化

| 日期 | 类型 | 内容 | 影响/批准人 |
| --- | --- | --- | --- |
| {{DATE}} | 假设 |  |  |

## 7. 风险与阻塞

- 风险：
- 阻塞条件：
- 解除人/条件：
- 解除后的第一步：

## 8. 验证证据

| 检查/命令 | 结果 | 证据 | 说明 |
| --- | --- | --- | --- |
|  | not-run |  |  |

## 9. 交接

- 当前状态：`planned`
- 已完成：
- 未完成：
- 下一具体动作：
- 修改路径：
- 已运行验证：
- 未运行验证及原因：
- 残余风险：
- 工作区保护：
- Git 状态：当前/上游分支、HEAD、base ref/SHA、owned paths/初始状态、未提交/未跟踪、
  最后 commit/push。
- PR 状态：链接、Draft/Ready、检查/评审、自动 merge 条件或 `not-run` 原因。
- 终态说明：`done` 可在归档后进入 Ready/merge；`abandoned` 必须记录原因、未满足验收、
  保留结果、残余风险和后续负责人，永不 Ready/merge。
