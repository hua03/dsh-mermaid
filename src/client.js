import { diagramType, isMermaidCodeBlock } from './detection.js';
import { resolveLocale, translate } from './i18n.js';
import { CSS } from './styles.js';
import { ensureSvgAccessibility, localizeGeneratedSvgTitle, serializeSvg } from './svg.js';
import { THEME_ATTRIBUTES, themeConfig, themeFingerprint } from './theme.js';
import { createFullscreenViewer } from './viewer.js';

const TAG_ID = 'dsh-mermaid-custom/css';
const STABLE_MS = 300;
const RENDER_DEBOUNCE_MS = 500;
const VIEWPORT_MARGIN_PX = 400;
const COPY_FEEDBACK_MS = 1_200;
const MAX_SOURCE_CHARS = 50_000;
const MAX_SOURCE_LINES = 2_000;
const RUNTIME_REVISION = typeof __DSH_MERMAID_RUNTIME_REV__ === 'undefined'
  ? 'development'
  : __DSH_MERMAID_RUNTIME_REV__;
const RUNTIME_URL = `/dsh-mermaid-custom/mermaid-runtime.js?rev=${RUNTIME_REVISION}`;

let uid = 0;
let currentLocale = 'en';
let styleTag = null;
let mermaidRuntime = null;
let runtimePromise = null;
let renderQueueActive = false;
let tooltipPositioner = null;
let tooltipPositionerFactory = null;
let preserveViewPosition = null;
const entries = new WeakMap();
const wrappers = new Set();
const renderQueue = [];

function setMermaidRuntimeForTesting(runtime, positionerFactory, viewPositioner) {
  const previous = mermaidRuntime;
  const previousPromise = runtimePromise;
  const previousPositionerFactory = tooltipPositionerFactory;
  const previousViewPositioner = preserveViewPosition;
  mermaidRuntime = runtime;
  runtimePromise = Promise.resolve(runtime);
  tooltipPositionerFactory = positionerFactory;
  preserveViewPosition = viewPositioner;
  return () => {
    mermaidRuntime = previous;
    runtimePromise = previousPromise;
    tooltipPositionerFactory = previousPositionerFactory;
    preserveViewPosition = previousViewPositioner;
  };
}

function loadMermaidRuntime() {
  if (mermaidRuntime) return Promise.resolve(mermaidRuntime);
  if (!runtimePromise) {
    runtimePromise = import(RUNTIME_URL)
      .then((module) => {
        mermaidRuntime = { initialize: module.default.initialize, render: module.renderMermaid };
        tooltipPositionerFactory = module.createTooltipPositioner;
        preserveViewPosition = module.preserveViewPosition;
        return mermaidRuntime;
      })
      .catch((error) => {
        runtimePromise = null;
        throw error;
      });
  }
  return runtimePromise;
}

let activeThemeFingerprint = null;

function t(key, parameters) {
  return translate(currentLocale, key, parameters);
}

const fullscreenViewer = createFullscreenViewer({ t });

function detectLocale() {
  const languages = [...(navigator.languages || [])];
  if (navigator.language && !languages.includes(navigator.language)) languages.push(navigator.language);
  return resolveLocale(document.documentElement?.lang, languages);
}

function localizeEntry(entry) {
  entry.bar.setAttribute('aria-label', t('viewOptions'));
  entry.btnDiagram.textContent = t('diagramView');
  entry.btnCode.textContent = t('codeView');
  entry.btnCopy.textContent = t('copy');
  entry.btnCopy.setAttribute('aria-label', t('copy'));
  entry.btnFullscreen.textContent = t('fullscreen');
  entry.btnDownloadSvg.textContent = t('downloadSvg');
  if (entry.statusKey) entry.statusEl.textContent = t(entry.statusKey, entry.statusParameters);
  localizeGeneratedSvgTitle(
    entry.pane.querySelector('svg'),
    t('diagramTitle', { type: entry.badge.textContent || 'mermaid' }),
  );
  if (entry.messageKey && entry.pane.dataset.state !== 'ok') {
    const message = t(entry.messageKey, entry.messageParameters);
    entry.pane.textContent = message;
    if (entry.wrapper.dataset.state === 'error') entry.errorEl.textContent = message;
  }
}

function refreshLocale() {
  currentLocale = detectLocale();
  for (const wrapper of wrappers) {
    const entry = entries.get(wrapper._dshCode);
    if (entry) localizeEntry(entry);
  }
  fullscreenViewer.localize();
}

function initializeMermaid(runtime) {
  runtime.initialize(themeConfig(document));
}

function syncThemeFingerprint() {
  activeThemeFingerprint = themeFingerprint();
}

function injectCss() {
  if (styleTag || !document.head) return;
  styleTag = document.createElement('style');
  styleTag.id = TAG_ID;
  styleTag.textContent = CSS;
  document.head.appendChild(styleTag);
}

function removeCss() {
  styleTag?.remove();
  styleTag = null;
}

function setView(entry, view) {
  entry.wrapper.dataset.view = view;
  entry.btnDiagram.setAttribute('aria-pressed', String(view === 'diagram'));
  entry.btnCode.setAttribute('aria-pressed', String(view === 'code'));
}

function setViewFromControl(entry, view) {
  if (entry.wrapper.dataset.view === view) return;
  if (preserveViewPosition) preserveViewPosition(entry, () => setView(entry, view));
  else setView(entry, view);
}

function setViewControlsAvailable(entry, available) {
  entry.btnDiagram.hidden = !available;
  entry.btnCode.hidden = !available;
}

function setEntryStatus(entry, key, parameters = {}) {
  entry.statusKey = key;
  entry.statusParameters = parameters;
  entry.statusEl.textContent = t(key, parameters);
}

function setEntryError(entry, key, parameters, statusKey = key) {
  const message = t(key, parameters);
  entry.wrapper.dataset.state = 'error';
  setViewControlsAvailable(entry, false);
  entry.pane.dataset.state = 'error';
  entry.messageKey = key;
  entry.messageParameters = parameters;
  entry.pane.textContent = message;
  entry.errorEl.textContent = message;
  setEntryStatus(entry, statusKey, parameters);
  setView(entry, 'code');
  if (fullscreenViewer.isOpenFor(entry)) {
    fullscreenViewer.close();
    entry.codePane.focus({ preventScroll: true });
  }
}

function downloadSvg(entry) {
  const svg = entry.pane.querySelector('svg');
  if (!svg) return;
  const blob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const type = diagramType(entry.lastRendered) || 'diagram';
  anchor.href = url;
  anchor.download = `mermaid-${type}.svg`;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setEntryStatus(entry, 'downloaded');
}

function copySource(entry) {
  const source = entry.code.textContent || '';
  if (!source) return;
  const done = () => {
    entry.btnCopy.textContent = t('copied');
    clearTimeout(entry.copyTimer);
    entry.copyTimer = setTimeout(() => {
      entry.copyTimer = null;
      entry.btnCopy.textContent = t('copy');
    }, COPY_FEEDBACK_MS);
    setEntryStatus(entry, 'copied');
  };
  const fallback = () => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = source;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand?.('copy');
      textarea.remove();
      if (ok) done();
      else setEntryStatus(entry, 'copyFailed');
    } catch {
      setEntryStatus(entry, 'copyFailed');
    }
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(source).then(done, fallback);
  } else {
    fallback();
  }
}

// Hide DSH's own fence chrome (language label + copy button) for Mermaid blocks:
// the card below carries the same affordances and the source stays one click away.
function claimHostBlock(entry) {
  const block = entry.code.closest('.md-code-block');
  if (!block) return null;
  block.setAttribute('data-dsh-mmd-c-host', '');
  return block;
}

function releaseHostBlock(entry) {
  entry.hostBlock?.removeAttribute('data-dsh-mmd-c-host');
  entry.hostBlock = null;
}

function createEntry(code) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dsh-mmd-c';
  wrapper.dataset.view = 'diagram';

  const bar = document.createElement('div');
  bar.className = 'dsh-mmd-c-bar';
  bar.setAttribute('role', 'group');
  const badge = document.createElement('span');
  badge.className = 'dsh-mmd-c-badge';
  badge.textContent = 'mermaid';
  const btnDiagram = document.createElement('button');
  btnDiagram.type = 'button';
  btnDiagram.className = 'dsh-mmd-c-btn dsh-mmd-c-view-control';
  btnDiagram.setAttribute('aria-pressed', 'true');
  const btnCode = document.createElement('button');
  btnCode.type = 'button';
  btnCode.className = 'dsh-mmd-c-btn dsh-mmd-c-view-control';
  btnCode.setAttribute('aria-pressed', 'false');
  const btnCopy = document.createElement('button');
  btnCopy.type = 'button';
  btnCopy.className = 'dsh-mmd-c-btn';
  const btnFullscreen = document.createElement('button');
  btnFullscreen.type = 'button';
  btnFullscreen.className = 'dsh-mmd-c-btn dsh-mmd-c-diagram-action';
  const btnDownloadSvg = document.createElement('button');
  btnDownloadSvg.type = 'button';
  btnDownloadSvg.className = 'dsh-mmd-c-btn dsh-mmd-c-diagram-action';
  const actionSlot = document.createElement('div');
  actionSlot.className = 'dsh-mmd-c-action-slot';
  actionSlot.append(btnFullscreen, btnDownloadSvg, btnCopy);
  const body = document.createElement('div');
  body.className = 'dsh-mmd-c-body';
  const pane = document.createElement('div');
  pane.className = 'dsh-mmd-c-pane';
  pane.dataset.state = 'loading';
  const codePane = document.createElement('pre');
  codePane.className = 'dsh-mmd-c-code';
  codePane.tabIndex = -1;
  codePane.textContent = code.textContent || '';
  const errorEl = document.createElement('div');
  errorEl.className = 'dsh-mmd-c-error';
  const statusEl = document.createElement('div');
  statusEl.className = 'dsh-mmd-c-sr-only';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.setAttribute('aria-atomic', 'true');

  body.append(pane, codePane, errorEl, statusEl);
  bar.append(badge, btnCode, btnDiagram, actionSlot);
  wrapper.append(bar, body);

  const entry = {
    code, wrapper, bar, pane, codePane, errorEl, statusEl, badge, btnDiagram, btnCode,
    btnCopy, btnFullscreen, btnDownloadSvg, actionSlot,
    lastRendered: '', stableTimer: null, renderTimer: null, renderGeneration: 0, viewAdjustment: 0,
    viewportObserver: null, copyTimer: null, hostBlock: null,
    messageKey: 'rendering', messageParameters: {},
    statusKey: null, statusParameters: {}, tooltipPositioner,
  };
  entries.set(code, entry);
  localizeEntry(entry);

  btnDiagram.addEventListener('click', () => setViewFromControl(entry, 'diagram'));
  btnCode.addEventListener('click', () => setViewFromControl(entry, 'code'));
  btnCopy.addEventListener('click', () => copySource(entry));
  btnFullscreen.addEventListener('click', () => fullscreenViewer.open(entry));
  btnDownloadSvg.addEventListener('click', () => downloadSvg(entry));

  // Track pending cards too, so disposal also cancels their first-mount timer.
  wrapper._dshCode = code;
  wrappers.add(wrapper);
  entry.stableTimer = setTimeout(() => {
    entry.stableTimer = null;
    const pre = code.closest('pre');
    if (!code.isConnected || !pre?.parentNode) {
      disposeEntry(entry);
      return;
    }
    pre.parentNode.insertBefore(wrapper, pre);
    entry.hostBlock = claimHostBlock(entry);
    // Defer Mermaid parsing until the diagram is close to the viewport; the
    // preview sidebar can hold long documents, so offscreen fences stay cheap.
    if (typeof IntersectionObserver === 'function') {
      entry.viewportObserver = new IntersectionObserver((records) => {
        if (!records.some((record) => record.isIntersecting)) return;
        entry.viewportObserver?.disconnect();
        entry.viewportObserver = null;
        scheduleRender(entry);
      }, { rootMargin: `${VIEWPORT_MARGIN_PX}px 0px` });
      entry.viewportObserver.observe(wrapper);
    } else {
      scheduleRender(entry);
    }
  }, STABLE_MS);
}

async function renderDiagram(entry) {
  const source = (entry.code.textContent || '').trim();
  if (!source) {
    disposeEntry(entry);
    return;
  }
  if (source === entry.lastRendered && entry.pane.dataset.state === 'ok') return;

  const generation = ++entry.renderGeneration;
  entry.badge.textContent = diagramType(source) || 'mermaid';
  entry.codePane.textContent = entry.code.textContent || '';
  entry.wrapper.dataset.state = 'rendering';
  setViewControlsAvailable(entry, true);
  entry.pane.dataset.state = 'loading';
  entry.messageKey = 'rendering';
  entry.messageParameters = {};
  entry.pane.textContent = t('rendering');
  setEntryStatus(entry, 'rendering');

  let limitMessage = null;
  if (source.length > MAX_SOURCE_CHARS) {
    limitMessage = { key: 'tooLong', parameters: { actual: source.length, limit: MAX_SOURCE_CHARS } };
  } else {
    const lineCount = source.split('\n', MAX_SOURCE_LINES + 1).length;
    if (lineCount > MAX_SOURCE_LINES) {
      limitMessage = { key: 'tooManyLines', parameters: { actual: lineCount, limit: MAX_SOURCE_LINES } };
    }
  }
  if (limitMessage) {
    setEntryError(entry, limitMessage.key, limitMessage.parameters);
    return;
  }

  try {
    const runtime = await loadMermaidRuntime();
    if (generation !== entry.renderGeneration || !entry.wrapper.isConnected) return;
    if ((entry.code.textContent || '').trim() !== source) return;
    initializeMermaid(runtime);
    const id = `dsh-mmd-c-${++uid}`;
    const { svg, bindFunctions } = await runtime.render(id, source);
    if (generation !== entry.renderGeneration || !entry.wrapper.isConnected) return;
    if ((entry.code.textContent || '').trim() !== source) return;
    entry.pane.innerHTML = svg;
    const svgElement = entry.pane.querySelector('svg');
    if (!svgElement) {
      setEntryError(entry, 'renderEmpty', {}, 'renderFailedStatus');
      return;
    }
    ensureSvgAccessibility(svgElement, t('diagramTitle', { type: entry.badge.textContent || 'mermaid' }));
    if (svgElement && bindFunctions) {
      try {
        bindFunctions(svgElement);
      } finally {
        const positions = entry.tooltipPositioner;
        if (positions && !positions.disposed) {
          positions.instance ||= tooltipPositionerFactory?.(document);
          positions.instance?.trackCurrent();
        }
      }
    }
    entry.lastRendered = source;
    entry.messageKey = null;
    entry.messageParameters = null;
    entry.wrapper.dataset.state = 'ok';
    setViewControlsAvailable(entry, true);
    entry.pane.dataset.state = 'ok';
    setEntryStatus(entry, 'rendered');
    if (fullscreenViewer.isOpenFor(entry)) fullscreenViewer.update(entry, false);
  } catch (error) {
    if (generation !== entry.renderGeneration || !entry.wrapper.isConnected) return;
    if ((entry.code.textContent || '').trim() !== source) return;
    const parameters = { detail: error?.message || String(error) };
    setEntryError(entry, 'renderFailed', parameters, 'renderFailedStatus');
  }
}

function scheduleRender(entry) {
  if (entry.renderTimer) clearTimeout(entry.renderTimer);
  entry.renderTimer = null;
  // Clearing must invalidate in-flight work even while the render queue is busy.
  if (!(entry.code.textContent || '').trim()) {
    disposeEntry(entry);
    return;
  }
  entry.renderTimer = setTimeout(() => {
    entry.renderTimer = null;
    enqueueRender(entry);
  }, RENDER_DEBOUNCE_MS);
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function enqueueRender(entry) {
  if (entry.renderQueued) return;
  entry.renderQueued = true;
  renderQueue.push(entry);
  void drainRenderQueue();
}

async function drainRenderQueue() {
  if (renderQueueActive) return;
  renderQueueActive = true;
  try {
    while (renderQueue.length) {
      const entry = renderQueue.shift();
      entry.renderQueued = false;
      if (entry.wrapper.isConnected && entry.code.isConnected) {
        await renderDiagram(entry);
        await yieldToBrowser();
      }
    }
  } finally {
    renderQueueActive = false;
    if (renderQueue.length) void drainRenderQueue();
  }
}

function maybeEnhance(code) {
  if (!code || entries.has(code) || !isMermaidCodeBlock(code)) return;
  if (!(code.textContent || '').trim()) return;
  createEntry(code);
}

function disposeEntry(entry) {
  if (entry.stableTimer) clearTimeout(entry.stableTimer);
  if (entry.renderTimer) clearTimeout(entry.renderTimer);
  if (entry.copyTimer) clearTimeout(entry.copyTimer);
  entry.viewportObserver?.disconnect();
  entry.viewportObserver = null;
  releaseHostBlock(entry);
  entry.renderGeneration += 1;
  if (fullscreenViewer.isOpenFor(entry)) fullscreenViewer.close();
  entry.wrapper.remove();
  wrappers.delete(entry.wrapper);
  entries.delete(entry.code);
}

function collectGarbage() {
  for (const wrapper of wrappers) {
    const code = wrapper._dshCode;
    const entry = code ? entries.get(code) : null;
    if ((!wrapper.isConnected && !entry?.stableTimer) || !code?.isConnected) {
      if (entry) {
        disposeEntry(entry);
        if (code.isConnected) maybeEnhance(code);
      }
      else wrappers.delete(wrapper);
    }
  }
}

function handleMutations(mutations) {
  const codesToEnhance = new Set();
  const entriesToRender = new Set();

  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.('code')) codesToEnhance.add(node);
        node.querySelectorAll?.('code').forEach((code) => codesToEnhance.add(code));
      }
    }

    const target = mutation.type === 'characterData' ? mutation.target.parentElement : mutation.target;
    const hostCode = target?.matches?.('code') ? target : target?.closest?.('code');
    const entry = hostCode ? entries.get(hostCode) : null;
    if (entry) entriesToRender.add(entry);
    else if (hostCode) codesToEnhance.add(hostCode);
  }

  codesToEnhance.forEach(maybeEnhance);
  entriesToRender.forEach(scheduleRender);
  collectGarbage();
}

function reRenderAll() {
  for (const wrapper of wrappers) {
    const entry = entries.get(wrapper._dshCode);
    if (entry) {
      entry.lastRendered = '';
      scheduleRender(entry);
    }
  }
}

function apply(ctx) {
  ctx.effect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined;
    currentLocale = detectLocale();
    syncThemeFingerprint();
    injectCss();
    const positions = { disposed: false, instance: null };
    tooltipPositioner = positions;

    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const themeObserver = new MutationObserver(() => {
      const next = themeFingerprint();
      if (next === activeThemeFingerprint) return;
      activeThemeFingerprint = next;
      reRenderAll();
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
    const localeObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'lang')) refreshLocale();
    });
    localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const handleDocumentKeydown = (event) => {
      if (event.key === 'Escape') {
        fullscreenViewer.close();
      }
    };
    const handleWindowResize = () => {
      if (fullscreenViewer.isOpen()) fullscreenViewer.fit();
    };
    document.addEventListener('keydown', handleDocumentKeydown);
    window.addEventListener('resize', handleWindowResize);

    document.querySelectorAll('pre code').forEach(maybeEnhance);

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      localeObserver.disconnect();
      document.removeEventListener('keydown', handleDocumentKeydown);
      window.removeEventListener('resize', handleWindowResize);
      for (const wrapper of [...wrappers]) {
        const entry = entries.get(wrapper._dshCode);
        if (entry) disposeEntry(entry);
        else wrapper.remove();
      }
      fullscreenViewer.destroy();
      positions.disposed = true;
      positions.instance?.dispose();
      if (tooltipPositioner === positions) tooltipPositioner = null;
      removeCss();
    };
  });
}

const inject = [];
export { inject, apply, setMermaidRuntimeForTesting };
