# ADR-0003：工作区文件操作由 Rust 后端负责

| 字段 | 内容 |
| --- | --- |
| 状态 | Accepted for Spike |
| 日期 | 2026-07-18 |

## 背景

Markdown 是可被人和 Agent 修改的不受信任输入。WebView 若拥有广泛文件权限，XSS 或 IPC 缺陷可能扩大为本地文件泄露或破坏。

## 决策

- WebView 不直接获得知识库的通用文件系统权限。
- Rust 后端提供专用读写、移动、删除和监听命令。
- 命令只接受 Workspace ID 和相对路径。
- 初次打开工作区由无路径参数的 Rust `open_workspace` Command 触发原生目录选择器；
  WebView 不提交或接收绝对路径。Spike 使用 Rust `rfd` 异步 API，不向前端 capability
  开放文件系统或对话框插件命令。
- Rust 将用户选择的目录规范化并验证为现存目录后，存入进程内 Workspace Registry；
  前端只获得不含路径信息的进程内句柄和显示名称。
- 当前 Spike 是单工作区模型；新工作区的 Watch 成功建立后才同时替换活动 Registry 和
  Watcher，旧 Workspace ID 随即失效。Watch 初始化失败时保留原工作区和原监听。
- 每次操作都进行根目录、路径穿越和符号链接校验。
- `list_documents`、`read_text` 和 `save_text` 只接受 Workspace ID 与相对路径；当前编辑
  类型限制为 Markdown/TXT，单文件上限为 5 MiB。
- 读取结果包含原始字节 SHA-256 版本 Token、UTF-8 BOM 和换行符信息。保存必须携带
  `expectedVersion`，Token 不一致时返回显式冲突，不覆盖外部变化。
- 保存先在目标目录写入并同步临时文件，替换前再次核对版本；Windows 使用
  `MoveFileExW` 的 replace-existing/write-through 语义，其他平台使用同卷 rename。
- Rust 为当前打开的工作区建立递归 Watch；事件经约 250 ms 去抖后只向 WebView 发送
  `workspace-documents-changed` / `{ workspaceId, revision }` 失效通知；监听错误使用
  `workspace-watch-error` / `{ workspaceId, code, message }`。两种事件都不发送绝对路径、
  正文或底层 Watch 原始事件。前端收到失效通知后重新枚举文档，并用版本 Token 重新读取
  当前文档。
- `create_text`、`rename_document` 和 `trash_document` 只处理 `.md`/`.txt` 相对路径。
  新建使用 create-new 语义；重命名与删除要求 `expectedVersion`，目标已存在或版本过期
  时拒绝。所有文档命令统一拒绝 `.git`、`.easy-markdown`、`node_modules`、`target`、
  `dist` 等内部目录，不能仅依赖列表过滤。
- 当前路径校验仍是按名称解析、canonicalize 和 reparse/symlink 检查，没有持有从工作区根
  到目标的 OS 目录句柄；`expectedVersion` 也是替换、移动或回收站动作前的乐观复核，不是
  文件系统原子 CAS。正常外部编辑与已覆盖测试会被阻断，但能并发替换父目录或在最后复核后
  抢占写入的进程仍存在 TOCTOU。该安全硬门槛在句柄级方案或明确的 Spike 风险决定前保持
  未关闭，不得把当前实现描述为对抗恶意并发文件系统修改的生产边界。
- 删除只调用系统回收站能力；失败时不回退为永久删除。脏文档或冲突文档是否允许删除由
  前端交互先行阻断，Rust 仍以版本 Token 防止检查后的外部变化被误删。
- 前端自动保存采用约 800 ms 防抖。保存期间编辑器保持可编辑，以编辑修订号区分保存快照；
  保存过程中出现的新输入排队进入下一次保存。外部冲突或文件缺失会冻结自动保存。
- 正常关闭由 Tauri `onCloseRequested` 先阻止默认关闭、排空当前保存，再调用主窗口
  `destroy`；因此 capability 只额外授予主窗口 `core:window:allow-destroy`。保存失败、
  冲突或文件缺失时窗口保持打开，不扩大为通用文件或命令权限。
- CodeMirror 6 会由 `style-mod` 在运行时生成 `<style>`。生产 CSP 继续保持
  `style-src 'self'`：Vite 使用 `html.cspNonce = "__TAURI_STYLE_NONCE__"` 生成 nonce
  载体，Tauri 打包响应将占位符替换为随机 style nonce 并加入 CSP，前端再通过
  `EditorView.cspNonce` 传给 CodeMirror。开发 CSP 只允许同名固定开发 nonce 和本地
  Vite HMR，不启用生产 `unsafe-inline`，也不关闭 Tauri 的资产 CSP 改写。
- Spike 使用 `notify` 8.2.0（CC0-1.0）与平台推荐 Watcher，不采用 9.0.0 预发布版；
  系统回收站使用 `trash` 5.2.6（MIT）。该回收站库披露的 Linux/FreeBSD mount 查询限制
  作为跨平台残余风险保留；当前只把 Windows 作为首发验证结论。前端状态机测试使用
  Vitest 4.1.10（MIT），不增加前端运行时文件系统依赖。

## 后果

正面：

- 安全规则只有一个实现位置。
- 前端不能任意读取用户磁盘。
- 易于进行路径和故障注入测试。

负面：

- IPC 类型和后端命令数量增加。
- 流式读取和大文件需要额外设计。
- 工作区句柄当前只在进程内有效；持久化最近工作区属于后续独立设计。
- Watch 采用失效重扫而非逐事件镜像，重复工作量更高，但能把重命名、原子保存和事件合并
  的平台差异封装在 Rust 侧，并避免向 WebView 暴露磁盘路径。
- 名称级路径校验与乐观版本复核只形成当前 Spike 的功能证据；若进入正式开发，需以独立
  安全决策验证 capability/handle-relative 文件访问、版本冲突后的无损回滚或等价方案，
  并补充并发 junction/symlink 替换及最后时刻外部写入故障注入。
- 自动保存没有独立崩溃草稿日志；强制终止可能丢失最近一个防抖窗口的输入，但已成功保存
  的源文件必须保持完整。
- CodeMirror 的 nonce 传递依赖 Vite/Tauri 的已验证占位符契约；升级两者时必须重新验证
  打包 WebView 中无 CSP 违规，不能静默回退为 `style-src 'unsafe-inline'`。

## Spike 验证与回退

- 以 Rust 单元测试覆盖目录规范化、非目录拒绝、未知句柄和 `..`/绝对路径拒绝。
- 以 Rust 单元测试覆盖 Markdown/TXT 枚举、UTF-8 BOM/CRLF、版本冲突和安全替换保存。
- 以最小 UI 人工验证目录选择取消、成功注册和不暴露绝对路径。
- 首选的官方 `tauri-plugin-dialog` 2.7.2 会间接引入 `tauri-plugin-fs` 2.5.1；其
  build-script 在当前 Windows 开发机被 App Control 以 4551 阻止。Spike 因此回退为
  `rfd` 0.17 的 Rust-only 异步目录选择器，减少插件 IPC/权限表面，同时保留相同契约。
- 若 `rfd` 原生对话框仍不稳定，保留相同无路径 IPC 契约，替换 Rust 侧目录选择实现；
  不得回退为前端提交任意绝对路径。
- Day 2 第一纵切使用手动保存验证 IPC 与数据安全；后续切片补充递归 Watch、自动保存、
  文件操作和能并排比较本地/外部内容的最小界面。完整三方合并不属于该切片，未完成相应
  自动化与人工故障测试前不宣称外部变化闭环已通过。
