# ADR-0002：Git 使用系统 Git CLI

| 字段 | 内容 |
| --- | --- |
| 状态 | Accepted for Spike |
| 日期 | 2026-07-18 |

## 背景

产品需要兼容现有 Git 仓库、远端凭据、SSH、Hooks、签名、分支、Worktree 和冲突状态。

## 决策

MVP 通过 Rust 后端调用系统 Git CLI：

- 只构造允许的命令。
- 程序和参数分离，不使用 Shell 拼接。
- 状态使用 Porcelain v2 和 NUL 分隔。
- 复用系统 Credential Helper，不读取 Token。

## 后果

正面：

- 与用户已有 Git 行为一致。
- 对 Git 平台和认证方式保持中立。
- 支持 Worktree、Hooks 和签名。

负面：

- 用户需要安装兼容版本的 Git。
- 网络进程必须处理超时、取消和交互式凭据。

## 未来评估

若大量用户无法安装 Git，再评估捆绑 MinGit/GCM。除非出现明确阻塞，不采用 libgit2。
