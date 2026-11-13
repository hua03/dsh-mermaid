// The card contains and clips its absolutely positioned live status during scrolling.
const CSS = `
.dsh-mmd-c{position:relative;margin:8px 0 10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06));overflow:hidden}
.dsh-mmd-c-bar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));background:var(--dsw-alias-bg-layer-1,transparent)}
.dsh-mmd-c-badge{margin-right:auto;font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-tertiary,#888);padding:0 6px}
.dsh-mmd-c-btn{appearance:none;min-width:28px;min-height:28px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#666);border-radius:5px;font:12px/20px inherit;padding:2px 10px;cursor:pointer}
.dsh-mmd-c-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
.dsh-mmd-c-btn:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4c6ef5);outline-offset:2px}
.dsh-mmd-c-btn[aria-pressed='true']{border-color:var(--dsw-alias-button-primary-fill,#4c6ef5);color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgba(76,110,245,.12))}
.dsh-mmd-c-action-slot{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsh-mmd-c-body{padding:10px 12px;overflow-x:auto}
.dsh-mmd-c-pane{display:block}
.dsh-mmd-c-pane svg{max-width:100%;height:auto;display:block;margin:0 auto}
.dsh-mmd-c-pane[data-state='loading'],.dsh-mmd-c-pane[data-state='error']{font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-tertiary,#888);padding:12px 4px;white-space:pre-wrap}
.dsh-mmd-c-pane[data-state='error']{color:var(--dsw-alias-state-error-primary,#d33)}
.dsh-mmd-c-code{display:none;margin:0;padding:12px 14px;overflow-x:auto;font:var(--dsl-code-block-content-font,var(--dsw-font-markdown-code-block,13px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace));color:var(--dsw-alias-label-primary,#e6e6e6);white-space:pre;tab-size:4}
.dsh-mmd-c-error{display:none;font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-state-error-primary,#d33);padding:8px 14px 0;white-space:pre-wrap}
.dsh-mmd-c-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.dsh-mmd-c[data-view='code'] .dsh-mmd-c-body{padding:0}
.dsh-mmd-c[data-view='code'] .dsh-mmd-c-pane{display:none}
.dsh-mmd-c[data-view='code'] .dsh-mmd-c-code{display:block}
.dsh-mmd-c[data-view='code'][data-state='error'] .dsh-mmd-c-error{display:block}
.dsh-mmd-c[data-state='error'] .dsh-mmd-c-view-control{display:none}
.dsh-mmd-c:not([data-state='ok']) .dsh-mmd-c-diagram-action{display:none}
/* Keep native titlebar clearance even when Desktop's fullscreen marker is stale. */
.dsh-mmd-c-viewer{position:fixed;z-index:2147483000;inset:0;top:max(var(--dsh-mmd-c-titlebar-height,0px),calc(env(titlebar-area-y,0px) + env(titlebar-area-height,0px)));-webkit-app-region:no-drag;display:flex;flex-direction:column;background:#fff;color:var(--dsw-alias-label-primary,#222)}
html[data-windows-titlebar]:not([data-fullscreen]) .dsh-mmd-c-viewer{--dsh-mmd-c-titlebar-height:var(--dsh-windows-titlebar-height,40px)}
body[data-ds-dark-theme] .dsh-mmd-c-viewer{background:#121212;color:var(--dsw-alias-label-primary,#f5f5f5)}
.dsh-mmd-c-viewer[hidden]{display:none}
.dsh-mmd-c-viewer-bar{display:flex;align-items:center;gap:8px;min-height:48px;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-1,rgba(30,30,30,.98))}
.dsh-mmd-c-viewer-title{margin-right:auto;font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-secondary,#bbb)}
.dsh-mmd-c-viewer-viewport{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab;touch-action:none}
.dsh-mmd-c-viewer-viewport[data-dragging='true']{cursor:grabbing}
.dsh-mmd-c-viewer-stage{position:absolute;left:50%;top:50%;transform-origin:center;will-change:transform}
.dsh-mmd-c-viewer-stage svg{display:block;max-width:none;height:auto;background:transparent}
.md-code-block[data-dsh-mmd-c-host]{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}
[data-dsh-mmd-c-host] [data-code-block-banner]{display:none!important}
[data-dsh-mmd-c-host] [data-code-block-content]{padding:0!important;background:transparent!important;border:0!important}
/* 原始代码块始终隐藏：代码视图由卡片内部的 .dsh-mmd-c-code 呈现 */
.dsh-mmd-c + pre{display:none}
@media (prefers-reduced-motion:reduce){.dsh-mmd-c *{animation:none!important;transition:none!important}}
@media (forced-colors:active){.dsh-mmd-c-btn:focus-visible{outline-color:Highlight}}
`;

export { CSS };
