# Easy Markdown 技术可行性分析

| 字段 | 内容 |
| --- | --- |
| 文档状态 | 进入技术 Spike 前 |
| 版本 | 0.1 |
| 日期 | 2026-07-18 |
| 结论 | 技术可行，附带明确验证条件 |

## 1. 结论

Easy Markdown MVP 在技术上可行。

Markdown/TXT 编辑、GFM 预览、目录监听、全文搜索和 Git 版本管理都有成熟组件。真正需要通过 Spike 消除的不确定性集中在：

1. Windows 上安全、无损的文件保存和外部修改检测。
2. 使用系统 Git CLI 时，凭据、索引、冲突和异常中断能否稳定处理。
3. Tauri WebView2 中中文输入法、CodeMirror、文件监听和大目录性能。
4. 本地图片和 Markdown 链接在严格安全策略下的预览方式。
5. Agent 独立 Worktree 是否足以隔离人类与 Agent 的并发修改。

整体判断：

| 子系统 | 可行性 | 风险 |
| --- | --- | --- |
| Markdown/TXT 编辑 | 高 | 中文 IME、超大文件、外部修改覆盖 |
| Markdown 预览 | 高 | 原始 HTML、危险 URL、远程图片的数据外泄 |
| 本地文件管理 | 高 | 路径穿越、符号链接、原子替换、编码 |
| 文件变化监听 | 中高 | Git Checkout 和编辑器原子保存会产生事件风暴 |
| Git 状态/差异/历史 | 高 | 必须使用稳定机器格式，不能解析人类文案 |
| Git 拉取/推送/凭据 | 中 | 凭据助手、代理、SSH 和长时间阻塞 |
| Git 冲突处理 | 中 | 文本冲突可做；复杂 rename/delete 冲突需要降级 |
| 全文搜索 | 高 | MVP 无需建立数据库索引 |
| Agent 文件读写 | 高 | 应用无法约束被单独授权的外部 Agent |
| Windows 安装和升级 | 中高 | 需要 WebView2、签名和安装器验证 |
| macOS/Linux | 中 | 系统 WebView 差异需要单独兼容测试 |

## 2. 技术边界

### 2.1 文件是真源是可行的

应用不需要业务数据库保存正文。

建议数据分层：

| 数据 | 保存位置 | 是否为真源 |
| --- | --- | --- |
| Markdown/TXT/图片 | 用户选择的知识库目录 | 是 |
| Git 历史 | 知识库对应的 `.git` | 是 |
| 最近工作区、窗口尺寸、界面偏好 | 系统应用数据目录 | 否 |
| 搜索缓存 | MVP 不建立；后续位于系统缓存目录 | 否 |
| 调试日志 | 系统日志目录 | 否 |

这满足“退出或卸载应用后，知识仍可被普通工具读取”的要求。

### 2.2 Agent 可以直接操作文件，但安全能力有限

存在两个不同的安全边界：

1. Easy Markdown 自身的文件操作

   可以由 Rust 后端对每个路径进行规范化、根目录校验和权限控制。

2. 用户在其他 Agent 产品中授予的文件权限

   Easy Markdown 无法收回或限制这些权限。真实约束必须由 Agent 运行时、操作系统权限或沙箱完成。

因此，MVP 不应承诺“应用可以阻止所有 Agent 越权”。可实现的安全措施是：

- 为 Agent 创建独立分支或 Git Worktree。
- 只把该 Worktree 路径授权给 Agent。
- 根目录放置 `AGENTS.md` 说明允许操作的文件和规则。
- 所有 Agent 写入通过 Git Diff 审查。
- 删除、批量移动和合并由人确认。

Git 原生支持一个仓库关联多个工作目录，并让每个 Worktree 拥有独立的 `HEAD` 和索引，适合作为 Agent 任务隔离机制。[Git Worktree 文档](https://git-scm.com/docs/git-worktree)

### 2.3 Git 适合异步协作，不提供实时共同编辑

Git 能可靠处理：

- 文本差异。
- 提交历史。
- 分支。
- 远端同步。
- 审查和恢复。

Git 不能单独解决：

- 同一篇文档的实时光标和共同编辑。
- 无冲突的段落级 CRDT 合并。
- 在线评论和成员通知。

这些能力继续保持在 MVP 范围之外。

## 3. 桌面框架可行性

### 3.1 Tauri 2

Tauri 使用 Rust 处理系统能力、使用系统 WebView 渲染前端，并通过 IPC 暴露受控命令。官方能力系统可以按窗口和命令限制前端可调用的系统能力。[Tauri 架构](https://v2.tauri.app/concept/architecture/) [Tauri 安全模型](https://v2.tauri.app/security/)

优势：

- Rust 适合承载路径校验、文件写入、Git 进程和搜索进程。
- 前端默认不直接拥有 Node.js 和完整文件系统能力。
- Capabilities 和 Command Scopes 可缩小 IPC 攻击面。
- 使用系统 WebView，安装包和基础资源占用较小。
- Windows 使用 Edge WebView2，Windows 10/11 环境较普遍。

风险：

- 开发环境需要 Rust、MSVC C++ Build Tools 和 WebView2。
- macOS 使用 WKWebView，Linux 使用 WebKitGTK，渲染差异高于 Electron。
- 团队必须有人能够维护 Rust 后端。

### 3.2 Electron

Electron 捆绑 Chromium、V8 和 Node.js，跨平台渲染一致，Node/NPM 生态成熟。官方也指出，典型压缩安装包约为 80～100 MB。[Electron 选择说明](https://www.electronjs.org/docs/latest/why-electron)

优势：

- 全 TypeScript 团队上手快。
- Chromium 行为跨平台更一致。
- 文件、进程、更新和安装生态成熟。
- 桌面端成功案例多。

风险：

- 安装体积和基础内存占用更高。
- Node/文件系统能力与渲染层之间的隔离需要团队持续维护。
- Markdown 属于可被用户和 Agent 修改的输入，XSS 后果会被桌面权限放大。

Electron 官方安全清单要求启用上下文隔离和沙箱、限制 IPC、设置 CSP，并禁止向不受信任内容暴露 Node 能力。[Electron 安全清单](https://www.electronjs.org/docs/latest/tutorial/security)

### 3.3 结论

MVP 优先选择 Tauri 2。

选择不是因为 Electron 不可行，而是因为本产品的主要能力是“受控本地文件与进程”，Rust 后端加窄 IPC 更贴合安全边界。

保留切换 Electron 的条件：

- 团队没有任何 Rust 维护能力。
- 五天 Spike 中 Tauri 在中文 IME、WebView2、E2E 或文件监听上出现阻塞问题。
- 目标平台快速扩展到 macOS/Linux，且系统 WebView 差异显著拖慢交付。

## 4. 编辑器与预览可行性

### 4.1 编辑器

CodeMirror 6 提供模块化扩展、不可变编辑状态、事务式修改、撤销历史、搜索、Markdown 语言支持和 Merge View。[CodeMirror 系统说明](https://codemirror.net/docs/guide/) [CodeMirror Merge API](https://codemirror.net/docs/ref/)

它能够覆盖：

- Markdown/TXT 编辑。
- 中文输入和通用快捷键。
- 大文本虚拟化。
- 只读模式。
- 行内搜索。
- 并排或统一 Diff。
- 冲突内容接受/拒绝。

Monaco 也可行，并原生提供强大的 Diff Editor，但其 IDE 能力对 Markdown MVP 过剩，资源和集成复杂度更高。

结论：选择 CodeMirror 6。

### 4.2 Markdown 预览

选择 `react-markdown + remark-gfm`：

- `react-markdown` 默认不使用 `dangerouslySetInnerHTML`，原始 HTML 默认不会直接执行。
- `remark-gfm` 支持表格、任务列表、删除线、自动链接等 GFM 能力。
- React 组件映射便于接管链接、图片和代码块行为。

参考：

- [react-markdown](https://github.com/remarkjs/react-markdown)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)

MVP 安全规则：

- 不启用 `rehype-raw`。
- 禁止 `javascript:`、`file:` 和未知协议链接。
- HTTP/HTTPS 链接交给系统浏览器，并在打开前校验。
- 默认不自动加载远程图片，防止跟踪像素和内网请求。
- 本地图片只允许知识库根目录内的白名单扩展名。
- 不从 CDN 加载脚本、主题或高亮器。
- P0 不渲染 Mermaid。

## 5. 文件系统可行性

### 5.1 前后端职责

不允许 WebView 前端直接获得整个知识库的通用读写权限。

由 Rust 后端提供窄命令：

- `open_workspace`
- `list_entries`
- `read_text`
- `save_text`
- `create_entry`
- `rename_entry`
- `move_entry`
- `trash_entry`
- `watch_workspace`

每个命令：

1. 只接受工作区 ID 和相对路径。
2. 拒绝绝对路径、`..` 和 NUL 字符。
3. 解析真实路径后再次验证位于根目录。
4. 默认不跟随越过根目录的符号链接或 Windows Junction。

Tauri 文件系统插件本身支持 Scope、路径穿越防护和递归 Watch，但官方也提示，当安全比便利更重要时应优先编写专用命令。[Tauri 文件系统插件](https://v2.tauri.app/plugin/file-system/) [Tauri Dialog API 安全说明](https://v2.tauri.app/reference/javascript/dialog/)

### 5.2 安全保存

建议协议：

1. 读取文件时返回内容和 `versionToken`。
2. `versionToken` 至少包含当前字节内容 Hash；mtime/size 只用于快速判断。
3. 保存时客户端必须带回读取时的 Token。
4. 后端重新检查磁盘内容。
5. Token 不一致则返回“外部修改冲突”，不覆盖。
6. Token 一致时写入同目录临时文件，再执行平台安全替换。

需要 Spike 验证：

- Windows 文件被杀毒软件或索引器短暂占用。
- 应用在写入或替换中途被强制结束。
- 原文件只读或权限不足。
- Git Checkout 与自动保存同时发生。
- 临时文件和目标文件位于不同卷。

### 5.3 编码和换行

- 新文件使用 UTF-8 无 BOM。
- 现有 UTF-8 BOM、LF/CRLF 在保存时保留。
- 无法按 UTF-8 解码的文件以只读方式打开，并提示显式转换。
- 不允许静默将 GBK 等编码重写为 UTF-8。
- Git 仓库建议提供 `.gitattributes`，但应用不强制重写用户已有策略。

### 5.4 文件监听

后端使用 Rust 文件监听库，进行 200～500 ms 去抖和批量合并。

事件模型只向前端暴露：

- created
- modified
- renamed
- removed
- rescan-required

不能假设操作系统总能提供完整 rename 对；发生事件溢出或无法配对时，对受影响目录重新扫描。

## 6. Git 可行性

### 6.1 选择系统 Git CLI

MVP 使用用户机器已安装的 Git，而不是嵌入 libgit2。

原因：

- 与用户已有 Git 配置、SSH、代理和 Credential Helper 行为一致。
- Git for Windows 通常包含 Git Credential Manager，可使用系统安全存储和 OAuth。[Git Credentials 文档](https://git-scm.com/docs/gitcredentials.html)
- 对 Worktree、签名、Hooks 和新 Git 能力兼容更完整。
- 避免在应用中读取和保存密码或 Token。

代价：

- 协作功能依赖系统 Git。
- 必须处理版本差异。
- 子进程可能长时间等待凭据或网络。

策略：

- 本地编辑不依赖 Git。
- 未检测到 Git 时禁用版本和同步功能，并提供安装指导。
- MVP 暂定最低 Git 2.40，最终最低版本由 Spike 测试确定。
- 不捆绑 MinGit/GCM；在 P1 重新评估。

### 6.2 Git 命令适配层

所有 Git 调用由 Rust 后端执行：

- 不通过 Shell 拼接字符串。
- 程序和参数分开传递。
- 所有路径参数前使用 `--`。
- 设置超时、取消和输出上限。
- 禁用外部 Diff：`--no-ext-diff`。
- 需要机器读取的状态使用稳定格式和 NUL 分隔。

Git 官方提供 `status --porcelain` 供脚本使用，并保证不受用户配置影响。[Git Status Porcelain](https://git-scm.com/docs/git-status/2.24.0.html)

建议命令映射：

| 能力 | Git 入口 |
| --- | --- |
| 仓库识别 | `git rev-parse` |
| 状态 | `git status --porcelain=v2 -z --branch` |
| 未暂存 Diff | `git diff --no-ext-diff --no-textconv` |
| 已包含 Diff | `git diff --cached --no-ext-diff --no-textconv` |
| 版本历史 | `git log` + 自定义 NUL 格式 |
| 文件版本内容 | `git show <revision>:<path>` |
| 包含/排除文件 | `git add` / `git restore --staged` |
| 创建版本 | `git commit` |
| 获取更新 | `git fetch` |
| 同步 | 明确的 merge/rebase 策略，Spike 后决定 |
| 恢复已共享版本 | `git revert` |
| Agent 隔离 | `git worktree add` |

### 6.3 Git 索引

产品中的“包含在本次版本”映射为 Git Index：

- 自动保存不自动 Stage。
- 用户选择文件后执行 Stage。
- 创建版本只提交已经 Stage 的内容。
- 如果外部工具已经 Stage 内容，应用如实显示，不清空或隐藏。
- 不创建第二套私有暂存状态。

这避免应用与命令行、IDE、Agent 对“本次提交内容”产生两个真源。

### 6.4 同步和冲突

P0 同步策略需在 Spike 后从以下方案中确定：

- 默认 `fetch + merge --ff-only`，不能快进时要求创建/切换变更分支。
- 或者在明确无本地未推送提交时使用 fast-forward，其他情况交给评审流程。

不建议 MVP 自动 Rebase：

- 失败后的继续、跳过和中止状态复杂。
- 会重写本地提交 ID。
- 对非开发用户难以解释。

复杂冲突的降级策略：

- 同行文本冲突：应用内处理。
- rename/delete、directory/file、submodule、二进制冲突：显示原因，保留仓库状态，要求高级用户或管理员处理。

## 7. 搜索可行性

MVP 使用捆绑的 ripgrep Sidecar，不建立 SQLite 全文索引。

ripgrep：

- 支持 Windows、macOS、Linux。
- 默认尊重 `.gitignore`。
- 跳过隐藏和二进制内容。
- 支持 Unicode、上下文和 JSON 流式输出。

参考：[ripgrep 官方仓库](https://github.com/BurntSushi/ripgrep)

查询策略：

- 只搜索 `.md`、`.markdown`、`.txt`。
- 明确排除 `.git`、应用内部目录和临时文件。
- 使用 JSON 输出流式返回结果。
- 查询可取消。
- 设置最大结果数和最大单文件大小。
- 文件名搜索复用内存文件树，不启动第二次全文扫描。

暂不选择 SQLite FTS5 的原因：

- 需要处理索引与文件监听的一致性。
- MVP 规模下实时扫描更简单，且不会出现索引过期。
- 当前产品不需要复杂排名、布尔查询和元数据聚合。

升级到 SQLite FTS5 的触发条件：

- 100,000 个代表性文件的 P95 搜索超过 2 秒。
- 用户明确需要相关度排序、中文分词或复杂组合过滤。
- 需要基于 Front Matter 的结构化查询。

## 8. 本地资源预览

不直接把任意 `file://` 路径交给 WebView。

推荐实现自定义只读资源协议：

1. 前端将相对图片路径交给后端。
2. 后端解析并验证位于当前工作区。
3. 只允许 PNG、JPEG、GIF、WebP、SVG 等明确白名单。
4. SVG 默认按不执行脚本的方式处理；Spike 验证后决定是否直接支持。
5. 返回正确 MIME、`nosniff` 和禁止缓存敏感路径的响应头。

备选方案是 Tauri Asset Protocol。其官方 API要求显式启用并设置访问 Scope 和 CSP。[Tauri `convertFileSrc`](https://v2.tauri.app/reference/javascript/api/namespacecore/)

## 9. 性能可行性

初步分级，最终值由 Spike 校准：

| 项目 | 目标 |
| --- | --- |
| 10,000 个文件首次目录扫描 | P95 小于 3 秒 |
| 文件名搜索 | P95 小于 200 ms |
| 普通关键词全文搜索 | P95 小于 2 秒 |
| 外部文件变化到 UI 更新 | P95 小于 1 秒 |
| 1 MiB Markdown 打开 | P95 小于 500 ms |
| 5 MiB 以上文档 | 可降级为源码模式，暂停实时预览 |
| 搜索取消 | 用户取消后 500 ms 内停止输出 |

风险最大的是：

- Windows Defender 对大量文件和临时文件的影响。
- Git Checkout 产生的大批事件。
- Markdown 代码高亮和超长表格渲染。
- CodeMirror 与预览同时保留大文本副本。

## 10. 安装、升级与测试

### 10.1 Windows

Tauri 在 Windows 使用 Edge WebView2；官方开发前置条件还包括 MSVC C++ Build Tools 和 Rust。[Tauri Windows 前置条件](https://v2.tauri.app/start/prerequisites/)

内部 MVP：

- 优先 NSIS per-user 安装包。
- 安装时检测 WebView2，缺失时通过官方 Bootstrapper 安装。
- 正式分发前进行代码签名。
- P0 可以人工发布版本，自动更新列为 P1。

### 10.2 测试

- Rust 单元/集成：`cargo test`，使用临时目录和临时 Git 仓库。
- 前端单元/组件：Vitest + Testing Library。
- 桌面 E2E：WebdriverIO Tauri Service。

Tauri 当前官方推荐 WebdriverIO，并支持 Windows、Linux 和 macOS；也支持快速的纯浏览器前端测试模式。[Tauri WebDriver 测试](https://v2.tauri.app/develop/tests/webdriver/)

必须覆盖：

- 中文输入法。
- 路径穿越、符号链接和 Windows Junction。
- 文件名以 `-` 开头、空格、中文、Emoji、换行等情况。
- 原始 HTML、`javascript:` 链接和远程图片。
- 写入中断和应用强制结束。
- 外部文件修改。
- Git 无仓库、无远端、无凭据、冲突、Detached HEAD、未出生分支。
- Agent 批量修改和恢复。

## 11. 当前开发环境核查

2026-07-18 在当前 Windows 工作区检测到：

| 工具 | 状态 |
| --- | --- |
| Git | 2.54.0.windows.1 |
| Node.js | 24.17.0 |
| npm | 11.13.0 |
| ripgrep | 15.1.0 |
| Edge WebView2 Runtime | 150.0.4078.65 |
| Rust / Cargo | 未检测到 |
| MSVC C++ Build Tools | 未检测到 |
| Git Credential Helper | 系统配置为 `manager` |

影响：

- 文档分析和前端原型环境基本具备。
- Tauri Spike 前需要安装 Rust stable MSVC toolchain 和 C++ Build Tools；WebView2 Runtime 已具备。
- 系统 Git 已启用 Credential Manager，但仍需用团队实际远端验证认证、代理和权限。

本轮仅做技术分析，没有修改系统开发环境。

## 12. 最终判断

建议进入五天技术 Spike。

在以下条件全部通过后，将技术选型从“暂定”升级为“正式”：

- Tauri 可在目标 Windows 环境稳定安装和运行。
- 中文 IME 和 CodeMirror 不存在阻塞问题。
- 文件安全保存和外部冲突测试零数据丢失。
- Git 状态、Stage、Commit、Fetch、Push 和冲突能够通过结构化适配层完成。
- 10,000 文件搜索达到目标。
- 恶意 Markdown 无法执行脚本或越权读取本地文件。
- 至少一条 Windows 桌面 E2E 流程可在 CI 或固定测试机重复运行。
