# ADR-0005：Markdown 使用安全 React 渲染管线

| 字段 | 内容 |
| --- | --- |
| 状态 | Accepted for Spike |
| 日期 | 2026-07-18 |

## 背景

Markdown 可能来自语雀导入、其他成员或 Agent，不能被视为可信 HTML。

## 决策

- 使用 `react-markdown + remark-gfm`。
- 不启用 `rehype-raw`。
- 自定义链接、图片和代码块组件。
- 拒绝危险协议。
- 默认不加载远程图片。
- 本地资源通过受控只读协议加载。
- P0 不渲染 Mermaid。

## 后果

正面：

- Markdown 无法直接注入可执行 HTML。
- 可以统一实现本地导航和资源边界。
- 与 GFM 产品约定一致。

负面：

- 部分语雀导出的原始 HTML 不会按原样渲染。
- Mermaid 和复杂嵌入需要后续安全评估。
