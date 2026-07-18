# Easy Markdown

Easy Markdown 是一个面向团队成员与 AI Agent 的本地优先文档工作区。

产品的核心约束是：

- Markdown、TXT 和本地资源文件是知识的唯一真源。
- 人通过桌面界面编辑和预览。
- Agent 像操作普通本地文件一样读取和修改知识。
- Git 负责版本、差异、回滚和团队异步协作。
- 搜索索引、缓存等数据必须可以从本地文件重新生成。

## 当前阶段

当前处于 **MVP 技术 Spike 准备阶段**。产品范围、用户故事和暂定技术选型已经形成；
Tauri 2、Rust Core、React/TypeScript、CodeMirror、系统 Git CLI 与 ripgrep 等选择仍需
通过五天 Spike 后才能升级为正式技术基线。

## 仓库协作 Harness

- [Agent 强制约束](AGENTS.md)
- [人类贡献指南](CONTRIBUTING.md)
- [如何用自然语言与 Agent 协作](docs/harness/user-agent-interaction.md)
- [低打扰自动化 Git 工作流](docs/harness/git-workflow.md)
- [Harness 导航与真源地图](docs/harness/README.md)
- [需求管理](docs/requirements/README.md)
- [工作项与跨会话交接](docs/work/README.md)
- 仓库级 Skill：`$manage-repository-harness`、`$grilling`

## 产品文档

- [可行性判断](docs/product/01-feasibility.md)
- [MVP PRD](docs/product/02-mvp-prd.md)
- [两周验证计划](docs/product/03-validation-plan.md)
- [用户故事与验收标准](docs/product/04-user-stories.md)

## 技术文档

- [技术可行性分析](docs/technical/01-technical-feasibility.md)
- [MVP 技术选型与架构](docs/technical/02-technology-selection.md)
- [五天技术 Spike 计划](docs/technical/03-spike-plan.md)
- [架构决策记录](docs/technical/adr/)

## 调研记录

- [调研数据治理](research/README.md)
- [样本文档清单模板](research/sample-manifest.csv)
- [验证结果记录模板](research/validation-results.csv)
