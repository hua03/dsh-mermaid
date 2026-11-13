# Changelog

## 0.1.1 — 2026-11-13

修复中文界面下 mermaid 代码块不渲染的问题。

- DSH 中文 UI 对未知/未标注语言的 fence 显示通用标签「代码块」（英文为
  `Code block`），旧逻辑把它当成真实语言名直接判否，导致中文界面上聊天与
  文件预览里的 mermaid 块全部不接管。现在「代码块 / 代码片段 / code block /
  codeblock」等按通用标签处理，继续走源码首词判定。
- 收紧 `graph` / `flowchart` 的源码启发式：要求首行带方向词（TD/TB/BT/LR/RL）
  或图里存在箭头，避免把 `graph = build_dag()` 这类普通代码误判为 mermaid。
- 补充对应单元测试；harness 用「代码块」banner 复测通过（3/3 块接管并出图）。

## 0.1.0 — 2026-11-13

首个自定义版本，基于 MrmoLabs/dsh-mermaid 0.4.5 的源码结构（MIT）重写定制。

- 重命名为 `@huahao/dsh-mermaid`，插件 id `dsh-mermaid-custom`，DOM/CSS 前缀
  `dsh-mmd-c`，runtime 路由 `/dsh-mermaid-custom/mermaid-runtime.js`。
- 新增 banner 语言识别：先读 `language-*` class，再读 `[data-code-block-banner]`
  infostring，最后才用源码首词；显式非 Mermaid 语言永不误渲染。
- 新增 `stripPreamble`：跳过 `%%` 注释、`%%{init}%%` 指令与 `---` YAML frontmatter，
  再判定 diagram 类型。
- 文件预览适配：识别 `.md-code-block` 宿主并加 `data-dsh-mmd-c-host`，隐藏 DSH
  原生语言/复制栏，改由卡片工具栏提供代码/图形、全屏、下载 SVG、复制。
- 主题改为 DSH token 驱动：`theme: 'base'` + `themeVariables` + 布尔属性指纹
  （修复空属性值与缺失无法区分导致主题切换不重渲染的问题）；为 Mermaid 11
  sequence 图补充作用域 `themeCSS`。
- 新增懒渲染：IntersectionObserver（400px 前置边距）首次接近视口才 import
  运行时并渲染；保留 500ms 流式去抖与串行渲染队列。
- 新增复制源码按钮（clipboard API + execCommand 回退，1200ms 反馈）。
- 新增空 SVG 输出检测（`renderEmpty`）与对应中英文案。
- 测试与工程：删除 installer/bin，全部测试改用新 id 与路由；新增 banner/foreign
  language/theme/copy/host 接管用例；bundle 体积上限 48KB，构建校验模块 id 与
  runtime revision。
