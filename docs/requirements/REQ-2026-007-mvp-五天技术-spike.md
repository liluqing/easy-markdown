---
id: REQ-2026-007
title: "MVP 五天技术 Spike"
type: discovery
status: accepted
priority: P1
owner: "repository-maintainers"
created: 2026-07-18
updated: 2026-07-18
related_product: []
related_work_items: [WORK-2026-007]
related_adrs: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005]
---

# REQ-2026-007：MVP 五天技术 Spike

## 1. 问题与证据

当前产品仍处于 MVP 技术 Spike 准备阶段，Tauri 2、Rust Core、CodeMirror 6、系统 Git CLI、ripgrep
和安全 Markdown 渲染只是“Accepted for Spike”，尚未完成 Windows 首发环境中的可运行性、数据安全、性能和
E2E 验证。仓库已有产品基线、暂定技术选型和五天 Spike 计划，但还没有可运行的 Spike 工件或结果记录。

## 2. 目标用户与预期结果

- 目标用户：产品负责人、技术负责人和后续 Sprint 1 实施成员。
- 预期结果：用五个工作日验证暂定技术边界，形成可运行 Spike 分支、自动化测试、性能/安全证据、更新后的 ADR
  结论和 Go / Conditional Go / No-Go 建议。
- 可观察的成功信号：七个 Spike 目标均有可复现证据；所有硬门槛通过；下一 Sprint 的技术任务和风险有明确拆分。

## 3. 范围

- 包含：
  - Windows 开发环境和 Tauri 2 + React + TypeScript + Vite 最小项目。
  - 工作区边界、窄 IPC、文件读写/外部变更、CodeMirror 编辑与 Diff。
  - 系统 Git CLI 适配层、取消/超时、Porcelain 状态解析和 Agent Worktree。
  - ripgrep 搜索、10,000 文件样本、性能记录和查询取消。
  - 安全 Markdown 预览、CSP、受控本地资源和恶意输入测试。
  - 至少一条 Tauri E2E、Rust 集成测试、性能 CSV、安全清单、ADR 结论和 Sprint 1 拆分。

## 4. 非目标

- 不包含：
  - 完整生产 UI、完整语雀迁移、Pull Request API、自动更新和完整冲突解决器。
  - macOS/Linux 适配、发布、部署、标签和生产数据迁移。
  - 未经单独需求/ADR 批准的架构、依赖、IPC 或持久化边界变更。

## 5. 相关基线

- 产品文档或 FR/US：[MVP PRD](../product/02-mvp-prd.md)、[用户故事与验收标准](../product/04-user-stories.md)。
- 技术文档或 ADR：[Spike 计划](../technical/03-spike-plan.md)、[技术选型](../technical/02-technology-selection.md)、
  [ADR 索引](../technical/adr/README.md)。
- 已有需求：无；本需求是 Spike 验证入口。

## 6. 约束、依赖与风险

- 产品约束：Spike 只验证技术风险，不把“Accepted for Spike”描述为生产完成。
- 技术依赖：Windows、Node.js、pnpm、Rust stable MSVC、Cargo、MSVC C++ Build Tools、WebView2、Git for Windows、ripgrep。
- 数据/隐私/安全：使用合成测试知识库；不提交凭据、真实客户内容或文件正文日志；前端不得获得任意文件/命令权限。
- 兼容与迁移：优先 Windows 首发；测试需覆盖中文、Emoji、UTF-8 BOM、LF/CRLF 和只读文件。
- 回退考虑：若硬门槛失败，保留最小可复现实验和证据，按 Spike 计划评估 Electron、SQLite FTS5 或嵌入式 Git，
  不在本 WORK 中直接切换正式架构。

## 7. 方案边界

只记录必须遵守的结果或约束；可替换的实现细节留给 WORK/ADR。正文仍以 Markdown/TXT/本地资源文件为唯一真源；
Rust Core 负责文件、路径、Git、搜索和安全边界；React/TypeScript 仅负责 UI；所有 Spike 结论必须可回溯到原始实验数据。

## 8. 验收标准

- [ ] AC-1：五天计划的七个技术问题均完成实验，并在 `research/` 或对应 WORK 证据中记录结果、环境、命令和限制。
- [ ] AC-2：Tauri 壳、严格 CSP、窄 IPC、工作区越界拒绝和 Windows 开发/安装路径可复现。
- [ ] AC-3：文件保存、外部修改、中文 IME/编码、Git CLI 取消/超时、Porcelain 解析和 Agent Worktree 通过相应测试。
- [ ] AC-4：10,000 文件 ripgrep 搜索达到 P95 < 2 秒，取消在 500 ms 内停止输出；恶意 Markdown/资源输入不执行脚本或越界读取。
- [ ] AC-5：至少一条 WebdriverIO Tauri E2E 和 Rust 集成测试通过；性能 CSV、安全测试清单和残余风险已提交。
- [ ] AC-6：ADR 逐条更新为 Accepted、Accepted with conditions 或 Rejected，并形成 Go / Conditional Go / No-Go 决定及 Sprint 1 任务拆分。

每条标准必须能独立判断通过或失败，并在 WORK 中关联证据。

## 9. 验证计划

- 自动化：Rust 单元/集成测试、Vitest、WebdriverIO Tauri E2E、Harness、diff/秘密/异常文件检查。
- 人工验证：Windows 开发模式、NSIS 安装/卸载、中文 IME、系统文件对话框、凭据 helper 和外部修改冲突。
- 测试数据/环境：合成 10,000 个 Markdown/TXT、1,000 个资源文件、多层目录、恶意 Markdown 样本和 Git 测试仓库；
  记录 Node/Rust/pnpm/Git/WebView2 版本及机器信息。

## 10. 决策记录

| 日期 | 决策人 | 决定 | 原因/影响 |
| --- | --- | --- | --- |
| 2026-07-18 | repository owner | Accepted | 用户明确要求“开始吧”，授权按既定五天 Spike 计划建立 REQ/WORK 并实施验证；生产选型仍待 Spike 结论 |
