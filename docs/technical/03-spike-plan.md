# Easy Markdown 五天技术 Spike 计划

| 字段 | 内容 |
| --- | --- |
| 文档状态 | Ready |
| 周期 | 5 个工作日 |
| 目标 | 验证高风险技术，不建设完整产品 |

## 1. Spike 目标

五天结束时必须能够明确回答：

1. Tauri 2 是否适合当前团队和 Windows 首发。
2. CodeMirror 中文输入、保存和 Diff 是否稳定。
3. Rust 后端能否无损处理文件和外部变化。
4. 系统 Git CLI 能否形成稳定、可取消的适配层。
5. ripgrep 是否满足 10,000 文件搜索目标。
6. 严格 CSP 和 Markdown 策略是否能阻止脚本和越界资源。
7. Agent Worktree 是否能隔离并发修改。

## 2. 不做事项

- 不完成正式 UI。
- 不完成语雀迁移。
- 不接入 Pull Request API。
- 不实现自动更新。
- 不实现完整冲突解决器。
- 不追求 macOS/Linux 适配。

## 3. 环境准备

当前机器已经具备 Node.js、Git、ripgrep 和 WebView2 Runtime，但缺少 Rust/Cargo 与 MSVC C++ Build Tools。Spike 开始前准备：

- Rust stable MSVC Toolchain。
- Cargo。
- Microsoft C++ Build Tools。
- 确认 Edge WebView2 Runtime 在测试机可用。
- Node.js 24 LTS 或项目指定 LTS，当前机器已经具备。
- pnpm。
- Git for Windows，当前机器已经具备。
- 一个本地 Bare Git Remote。
- 一个团队实际 Git 远端的测试仓库。

安装动作需要单独执行，不在本次技术分析范围内。

## 4. 第 1 天：桌面壳和安全边界

### 实现

- 创建 Tauri 2 + React + TypeScript + Vite 最小项目。
- 开启 TypeScript Strict。
- 配置最小 Tauri Capability。
- 配置严格 CSP。
- 实现目录选择和 `open_workspace`。
- 前端只获得 Workspace ID，不保存可任意访问的文件权限。

### 验证

- Windows 开发模式启动。
- 生成 NSIS 测试安装包。
- 安装后打开和卸载。
- WebView 无远程脚本。
- 任意 IPC Command 不可从前端调用。

### 当日门槛

- 一台干净或接近干净的 Windows 测试机可运行安装包。
- 未授权路径无法通过 IPC 读取。

## 5. 第 2 天：文件、编辑器和外部变化

### 实现

- CodeMirror 6 Markdown/TXT 编辑器。
- `read_text` 和带 `expectedVersion` 的 `save_text`。
- 临时文件加安全替换。
- 递归 Watch 和事件去抖。
- 外部修改冲突提示的最小界面。
- CodeMirror Unified Merge View。

### 测试样本

- 中文文件名和内容。
- Emoji。
- UTF-8 BOM。
- LF 和 CRLF。
- 只读文件。
- 1 MiB、5 MiB 文档。
- 以 `-` 开头的文件。
- 外部编辑器原子保存。

### 故障注入

- 写入临时文件后杀死应用。
- 替换目标前杀死应用。
- 保存前外部修改原文件。
- 保存时 Git Checkout。

### 当日门槛

- 中文 IME 不丢字、不重复输入。
- 所有冲突场景不静默覆盖。
- 强制终止后原文件或新文件至少有一份完整可恢复内容。

## 6. 第 3 天：Git 适配层

### 实现

- Git 版本检测。
- Repository Status Porcelain v2 解析。
- Stage/Unstage。
- Diff。
- Commit。
- Log/Show。
- Fetch/Push。
- 超时、取消和错误码。
- 创建 Agent Worktree。

### 测试仓库状态

- 无 Git 仓库。
- 新建但没有首个 Commit 的仓库。
- Clean。
- Modified、Staged、Untracked、Renamed、Deleted。
- Detached HEAD。
- 无远端。
- 无凭据。
- Push 被拒绝。
- 同行冲突。
- rename/delete 冲突。
- 文件名包含空格、中文、Emoji 和前导短横线。

### 凭据验证

- 本地 Bare Remote 验证完整功能。
- 团队真实远端使用系统 Credential Helper 或 SSH。
- 应用不读取或记录密码、Token、私钥。
- 网络命令有明确超时和取消。

### 当日门槛

- 不解析本地化的人类输出完成 Status。
- 不通过 Shell 拼接用户路径。
- 应用中断不损坏 `.git/index`。
- Agent Worktree 不影响主工作目录未保存内容。

## 7. 第 4 天：搜索和安全预览

### 实现

- 捆绑 ripgrep Sidecar。
- JSON 流式结果。
- 查询取消和结果上限。
- `react-markdown + remark-gfm`。
- 自定义链接与图片组件。
- 受控本地资源协议或等价方案。

### 数据集

生成不进入正式仓库的测试知识库：

- 10,000 个中小型 `.md/.txt`。
- 1,000 个图片或非文本资源。
- 多层目录。
- `.gitignore` 和隐藏目录。
- 中文关键词、英文关键词和正则特殊字符。

### 安全样本

- `<script>`。
- `<img onerror>`。
- `javascript:` 链接。
- `file:///` 链接。
- `../` 本地图片。
- 指向根目录外的 Junction/Symlink。
- 远程跟踪图片。
- 恶意 SVG。

### 当日门槛

- 10,000 文件普通搜索 P95 小于 2 秒。
- 查询取消后 500 ms 内停止输出。
- Markdown 无脚本执行。
- 无知识库外文件读取。
- 预览不自动发起远程图片请求。

## 8. 第 5 天：E2E、安装和决策

### 自动化

完成至少一条 WebdriverIO Tauri E2E：

1. 打开测试知识库。
2. 打开 Markdown。
3. 编辑并保存。
4. 检测外部修改。
5. 查看 Git Diff。
6. 创建本地版本。
7. 恢复未提交修改。

完成 Rust 集成测试：

- 路径穿越表。
- 文件版本 Token。
- Git Porcelain 解析。
- Git 进程超时。
- ripgrep JSON 解析。

### 性能记录

记录：

- 安装包大小。
- 冷启动时间。
- 空闲内存。
- 目录扫描。
- 搜索 P50/P95。
- 1 MiB/5 MiB 文档打开。
- Git Status 在 10,000 文件仓库中的耗时。

### 评审

逐条更新 ADR：

- Accepted。
- Accepted with conditions。
- Rejected。

输出下一 Sprint 的技术任务拆分和估算。

## 9. 硬性通过标准

以下任一失败，不直接进入正式开发：

- 中文 IME 存在稳定复现的数据错误。
- 保存或外部修改测试出现不可恢复的数据丢失。
- 路径穿越或符号链接可读取根目录外文件。
- Markdown 可以执行脚本或自动请求未授权远程资源。
- Git 参数可被文件名注入。
- Git 网络命令无法取消且会永久挂起。
- 10,000 文件普通搜索 P95 超过 2 秒且无简单优化路径。
- Windows 安装包无法在目标团队环境稳定运行。

## 10. 技术回退规则

### Tauri 回退到 Electron

满足任一条件：

- Rust/MSVC 环境使团队开发或 CI 无法稳定复现。
- Tauri/WebView2 中文 IME 或编辑器问题无法在 Spike 内规避。
- WebdriverIO Tauri 无法覆盖 Windows 主流程。
- 系统 WebView 差异成为近期多平台发布的主要阻塞。

Electron 回退必须同时启用：

- `nodeIntegration: false`。
- `contextIsolation: true`。
- Renderer Sandbox。
- 严格 CSP。
- Preload 只暴露窄 API。
- 所有 IPC Sender 校验。

### ripgrep 回退到 SQLite FTS5

满足任一条件：

- 代表性 100,000 文件搜索持续不能达到目标。
- 产品确定需要相关度排序、中文分词或元数据组合过滤。

### 系统 Git 回退到嵌入式 Git

只有在以下情况才评估：

- 大量目标用户没有 Git，且安装 Git 不可接受。
- 团队远端认证无法通过系统 Credential Helper 稳定工作。
- 必须实现完全自包含的离线部署。

即使回退，也需优先评估捆绑官方 Git/MinGit 与 GCM，而不是立即改用 libgit2。

## 11. Spike 交付物

- 可运行的 Spike 分支和 Windows 安装包。
- 自动化测试结果。
- 性能结果 CSV。
- 安全测试清单。
- 已更新的 ADR。
- 技术风险清单。
- Go / Conditional Go / No-Go 技术决策。
- Sprint 1 工程任务和重新估算。
