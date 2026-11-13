# Changelog

## 0.1.4 — 2026-11-13

渲染不再等滚动，打开文档即出图。

- 检测到 mermaid 块后立即渲染（首个块由 `setTimeout(0)` 触发，不再挂
  IntersectionObserver 等进入视口）；剩余图表在 `requestIdleCallback` 空闲时段
  依次渲染，避免和滚动/输入抢主线程。单文档最多预渲染 10 张，超出部分仍按视口
  懒渲染，卡片回收时释放名额。
- 配合 0.1.3 的 iframe 隔离渲染：滚动到图表时不再触发任何渲染，实测 4 图文档
  打开后 811ms 全部出图，随后 26 步滚动 0 个 long task。

## 0.1.3 — 2026-11-13

修复打开长文档、滚动到图表时约 2 秒的主线程卡顿。

- 根因：mermaid 渲染会反复插入/测量临时节点，每次布局刷新都会为大正文（预览约 1400 元素）重算样式；trace 里 `UpdateLayoutTree` 累计 1.9s，单次 long task 1.6–2.2s。
- 渲染改到隐藏的同源 iframe 内完成（`ensureIsolatedRenderer` / `renderIsolated`）：iframe 只加载一次 3.5MB runtime，之后通过 `postMessage` 传入源码与主题配置，取回 SVG 标记插入正文。正文 DOM 不再参与 mermaid 的样式重算。
- 首块检测到即预建 iframe（预取 runtime），避免滚动到位时再付启动成本；iframe `ready`/`render` 分别有 3s/15s 超时，失败自动回退到原来的页内渲染，并记住不可用状态不再重试。
- 实测（1600×1000 headless，5669px 预览、27 节点中文 flowchart）：滚动到图表的 long task 由 2152ms 降到 219ms；同一张图在 iframe 内渲染约 232ms。
- 单元测试仍为 51 项全通过；`lib/client.js` 35.9KB。

## 0.1.2

- 图表配色改为用 `--dsw-alias-state-business-primary` 与页面背景混合出底色（亮色 11%、暗色 26%），修复白色主题下节点几乎不可见的问题；连线改用 `label-secondary`。
- 首次渲染不再等待 500 ms 去抖（流式更新仍保留），并在检测到 mermaid 块时预取 3.5 MB runtime。
- 新增按（主题 + 源码）键的 SVG 模板缓存（24 条），预览面板重挂载、主题切换、页面缩放时命中缓存直接插入，避免重复 ~250 ms 的 mermaid 布局。
- 全屏查看器缩放上限由 5× 降到 4×，viewport/stage 增加 CSS containment，降低大图缩放时的光栅化开销。

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
