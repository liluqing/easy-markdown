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
- 每次操作都进行根目录、路径穿越和符号链接校验。
- `list_documents`、`read_text` 和 `save_text` 只接受 Workspace ID 与相对路径；当前编辑
  类型限制为 Markdown/TXT，单文件上限为 5 MiB。
- 读取结果包含原始字节 SHA-256 版本 Token、UTF-8 BOM 和换行符信息。保存必须携带
  `expectedVersion`，Token 不一致时返回显式冲突，不覆盖外部变化。
- 保存先在目标目录写入并同步临时文件，替换前再次核对版本；Windows 使用
  `MoveFileExW` 的 replace-existing/write-through 语义，其他平台使用同卷 rename。

## 后果

正面：

- 安全规则只有一个实现位置。
- 前端不能任意读取用户磁盘。
- 易于进行路径和故障注入测试。

负面：

- IPC 类型和后端命令数量增加。
- 流式读取和大文件需要额外设计。
- 工作区句柄当前只在进程内有效；持久化最近工作区属于后续独立设计。

## Spike 验证与回退

- 以 Rust 单元测试覆盖目录规范化、非目录拒绝、未知句柄和 `..`/绝对路径拒绝。
- 以 Rust 单元测试覆盖 Markdown/TXT 枚举、UTF-8 BOM/CRLF、版本冲突和安全替换保存。
- 以最小 UI 人工验证目录选择取消、成功注册和不暴露绝对路径。
- 首选的官方 `tauri-plugin-dialog` 2.7.2 会间接引入 `tauri-plugin-fs` 2.5.1；其
  build-script 在当前 Windows 开发机被 App Control 以 4551 阻止。Spike 因此回退为
  `rfd` 0.17 的 Rust-only 异步目录选择器，减少插件 IPC/权限表面，同时保留相同契约。
- 若 `rfd` 原生对话框仍不稳定，保留相同无路径 IPC 契约，替换 Rust 侧目录选择实现；
  不得回退为前端提交任意绝对路径。
- Day 2 第一纵切使用手动保存验证 IPC 与数据安全；递归 Watch、自动保存和 CodeMirror
  Merge View 留在同一 Day 2 的后续切片，未完成前不宣称外部变化闭环已通过。
