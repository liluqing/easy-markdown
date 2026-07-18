# Easy Markdown 可行性判断

| 字段 | 内容 |
| --- | --- |
| 文档状态 | 已形成初步结论，等待团队验证 |
| 版本 | 0.1 |
| 日期 | 2026-07-18 |
| 产品阶段 | Discovery |

## 1. 结论

建议为团队内部使用进行条件性立项。

技术上，本地 Markdown/TXT 编辑、预览、全文搜索、文件监听和 Git 集成都有成熟基础，MVP 可行性较高。主要风险不在编辑器本身，而在：

1. 非开发人员能否在不了解 Git 的前提下安全协作。
2. Agent 写入是否能够被约束、审查和恢复。
3. 语雀中的目录、图片、链接和特殊内容能否可靠迁移。
4. 自研方案相对“语雀 + 官方 MCP”能否产生足够明显的收益。

对外商业化暂不立项。需要先在内部试点证明本地文件所有权、批量修改、变更审查和工程集成构成了真实差异化。

## 2. 问题重新定义

产品要解决的并不是“做一个本地版 Notion”，而是：

> 为团队建立一套人类和 Agent 可以共同维护的项目知识源，并让每次修改都可检查、可追踪、可回滚。

“类似 Notion”在 MVP 中只指：

- 容易理解的目录与文档导航。
- 低门槛的写作和阅读体验。
- 不要求普通成员使用命令行。

MVP 不复制 Notion 的块数据库、实时协同、评论系统和复杂权限模型。

## 3. 已核实的外部事实

### 3.1 语雀已经支持 Agent 接入

截至调研日，语雀官方已经提供 MCP Server，支持搜索知识库、读取 Markdown、创建和更新文档等操作。

这意味着“语雀无法被 Agent 读写”不能再作为唯一立项理由。语雀 MCP 应作为验证中的基线方案。

当前官方能力仍未覆盖评论、附件上传与管理、成员与权限管理和段落级修改；写入能力受 Token 权限控制。

参考：

- [语雀官方 MCP Server](https://github.com/yuque/yuque-mcp-server)
- [语雀 AI 生态](https://github.com/yuque/yuque-ecosystem)

### 3.2 本地 Markdown 产品模型已经成立

Obsidian 使用普通本地文件夹作为 Vault，Markdown 文件可以被其他编辑器、文件管理器和版本控制工具直接处理。

参考：

- [Obsidian：创建本地 Vault](https://obsidian.md/help/Getting%2Bstarted/Create%2Ba%2Bvault)
- [Obsidian：导入 Markdown](https://obsidian.md/help/import/markdown)

### 3.3 Git 可以承担异步协作，但不是实时协同

Git 可以自动合并不同文件或不同行的变化。多人修改同一行，或者一人删除而另一人修改同一文件时，仍需要人工解决冲突。

远端 Git 平台可以利用受保护分支、Pull Request 和审批规则保护正式知识。

参考：

- [GitHub：关于合并冲突](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/about-merge-conflicts)
- [GitHub：受保护分支](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

### 3.4 Agent 目录授权需要真实安全边界

MCP Roots 提供了工作目录边界的表达方式，并要求防止路径穿越，但实际安全仍应依靠操作系统权限、沙箱或受控的 Agent 启动方式。

参考：

- [MCP Roots 安全说明](https://modelcontextprotocol.io/specification/2025-06-18/client/roots)

## 4. 方案比较

| 方案 | 优势 | 局限 | 在验证中的角色 |
| --- | --- | --- | --- |
| 语雀 + 官方 MCP | 无迁移成本；已有成熟团队体验；Agent 可读写 | 云端与 API 是真源；Agent 写入审查、批量文件处理和本地工程集成较弱 | 必须测试的基线 |
| Obsidian + Git | 本地 Markdown 模型成熟；可以快速验证 | Git 协作和团队治理需要额外约定 | 低成本概念验证 |
| GitBook + Git Sync | 可视化编辑和 Git 双向同步 | 仍依赖云产品及其同步规则 | 商业替代方案 |
| VS Code + Git | 几乎无需开发；Agent 天然可访问 | 对产品和测试人员不友好 | 技术流程基线 |
| 自研 Easy Markdown | 可围绕 Agent 安全、Git 协作和迁移深度设计 | 需要维护跨平台、Git 凭据和冲突处理 | 条件性立项方案 |

## 5. 产品差异化假设

以下内容仍是假设，必须通过两周验证计划检验：

1. 普通成员愿意用“文件夹 + 文档”的组织方式替代语雀知识库。
2. Agent 对本地文件的批量读取和修改，比通过语雀 API 更稳定、更快速。
3. Git Diff 和分支评审可以显著降低 Agent 误写知识的风险。
4. 团队愿意接受异步协作，不强依赖同一文档实时共同编辑。
5. 代表性语雀文档能够以可接受的质量迁移为 Markdown。

## 6. 建议的立项门槛

满足以下条件后进入正式 MVP 开发：

- 代表性语雀文档迁移成功率不低于 90%。
- Agent 读取类任务成功率不低于 95%。
- Agent 修改类任务至少 90% 能形成可审查的正确差异。
- 相比语雀 MCP，至少一个高频核心流程节省 30% 以上时间，或显著提高可审计性。
- 非开发角色无需命令行即可完成编辑、同步和恢复。
- 验证期没有不可恢复的数据丢失。

## 7. 工作量假设

在桌面端优先、复用现有 Git 远端、不做实时协同和复杂权限的前提下：

- 技术原型：1～2 周。
- P0 MVP：4～6 周。
- 迁移工具与内部试点：2～3 周。

以上为产品阶段的粗略估算，需要在完成技术选型和 Spike 后重新评估。
