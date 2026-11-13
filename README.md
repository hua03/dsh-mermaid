# @huahao/dsh-mermaid

[简体中文](README.zh-CN.md) | English

Render Mermaid fences as interactive SVG inside DeepSeek Harness (DSH) — in chat
transcripts and in sidebar file previews. Customized from
[MrmoLabs/dsh-mermaid](https://github.com/MrmoLabs/dsh-mermaid) (MIT) and adapted
to the **DSH 0.2.2-rc.1** DOM contract.

## What is different

- **File preview support.** DSH's document preview renders Markdown through the same
  `div.md-code-block` structure, so the same decorator covers chat and preview.
- **Banner-aware detection.** DSH 0.2.2 no longer puts a `language-*` class on the
  shiki `<code>`; the fence language only appears as the infostring text inside
  `[data-code-block-banner]`. The plugin checks classes first, then the banner, and
  only then falls back to the source's first token. `%%{init: …}%%`, YAML
  frontmatter and `%%` comments are skipped; `python`/`json`/`arduino` lookalikes
  stay untouched.
- **Native chrome handover.** For claimed fences the host `.md-code-block` gets
  `data-dsh-mmd-c-host`; DSH's own language/copy bar is hidden (it duplicated the
  card toolbar in preview) and the card toolbar provides code/diagram, fullscreen,
  SVG download and copy.
- **Token-derived theme.** Colors come from DSH's `--dsw-alias-*` variables via
  `theme: 'base'` + `themeVariables`; light/dark/acrylic switches re-render. Mermaid
  11 paints sequence actors from the base theme, so a scoped `themeCSS` block maps
  `[aria-roledescription="sequence"]` back to the same tokens.
- **Lazy same-origin runtime.** Mermaid 11.17.2 ships as a separate ESM bundle served
  by the host half at `/dsh-mermaid-custom/mermaid-runtime.js?rev=<hash>`; the client
  `import()`s it when the first diagram approaches the viewport. No CDN, no
  telemetry, no extra network origin.
- **Streaming-safe and bounded.** MutationObserver discovery with a 500 ms debounce,
  IntersectionObserver 400 px margin, 32-entry SVG cache invalidated on theme change,
  `securityLevel: 'strict'`, `htmlLabels: false`, DOMParser-based SVG sanitizing and
  a 50,000-character / 2,000-line limit.

Fullscreen zoom/pan (Esc, focus trap), SVG export, source fallback and zh/en i18n
from upstream are preserved.

## Install

```bash
node scripts/build.mjs
dsh plugin --profile web add /Users/huahao/workspace/Project/github/dsh-mermaid-custom
```

Restart `dsh web` or refresh the page afterwards. Fences tagged `mermaid`,
`mermaidjs` or `mmd` are supported, plus untagged blocks whose first token is a
Mermaid diagram keyword or that start with `%%`/`---` frontmatter.

## Verify

1. Chat shows a card with code/diagram/fullscreen/download/copy controls.
2. A Markdown file with a Mermaid fence in the sidebar preview shows the same card,
   and the original DSH `mermaid` banner is gone.
3. Only one request appears: `GET /dsh-mermaid-custom/mermaid-runtime.js?rev=…` → 200.
4. Switching the DSH light/dark theme re-renders diagrams with the new tokens.
5. `%%{init: {"theme":"forest"}}%%` blocks render (DSH tokens still win).
6. `python`/`json` blocks that start with `graph` remain plain code blocks.

## Develop

```bash
pnpm install
node scripts/build.mjs
node --test
```

`lib/client.js` is a prebuilt CJS bundle registered through
`window.__ModuleLoader__.load`; `lib/mermaid-runtime.js` is an ESM bundle of Mermaid
11.17.2. The build stamps the runtime's sha256 prefix into the client `?rev=` URL.

## Uninstall

```bash
dsh plugin --profile web remove @huahao/dsh-mermaid
```

## Compatibility

Built and hand-verified against DSH `0.2.2-rc.1` (web profile). Declares
`dsh.engines.dsh >=0.2.2-rc.1 <0.3.0-0`; DSH has no stable third-party renderer
extension point, so re-run the verification list after DSH upgrades.

## License

MIT. Based on MrmoLabs/dsh-mermaid (Copyright © 2026 Mrmo072); modifications in this
repository are released under the same license. See [LICENSE](LICENSE).
