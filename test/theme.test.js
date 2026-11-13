import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { themeConfig, themeFingerprint } from '../src/theme.js';

async function withDom(callback) {
  const window = new Window({ url: 'http://localhost/' });
  const names = ['window', 'document'];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  globalThis.window = window;
  globalThis.document = window.document;
  document.head.innerHTML = `<style>
    :root, body {
      --dsw-alias-markdown-code-block: #f1f1f3;
      --dsw-alias-bg-layer-1: #ffffff;
      --dsw-alias-bg-layer-2: #ffffff;
      --dsw-alias-label-primary: #1a1a1a;
      --dsw-alias-label-secondary: #4b5563;
      --dsw-alias-label-tertiary: #777777;
      --dsw-alias-state-business-primary: #4f46e5;
      --dsw-alias-border-l1: #e0e0e4;
      --dsw-alias-border-l2: rgba(0, 0, 0, 0.1);
    }
    body[data-ds-dark-theme] {
      --dsw-alias-markdown-code-block: #1b1b1f;
      --dsw-alias-bg-layer-1: #121214;
      --dsw-alias-bg-layer-2: #232329;
      --dsw-alias-label-primary: #f2f2f3;
      --dsw-alias-label-secondary: #a1a7ae;
      --dsw-alias-label-tertiary: #9a9aa2;
      --dsw-alias-state-business-primary: #8b8bff;
      --dsw-alias-border-l1: #34343c;
      --dsw-alias-border-l2: rgba(255, 255, 255, 0.12);
    }
  </style>`;
  document.body.textContent = '';
  try {
    return await callback(window);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
    await window.happyDOM.abort();
  }
}

test('maps DSH design tokens to a base Mermaid theme in light and dark mode', () =>
  withDom(() => {
    const light = themeConfig(document);
    assert.equal(light.theme, 'base');
    assert.equal(light.themeVariables.darkMode, false);
    assert.equal(light.themeVariables.primaryTextColor, '#1a1a1a');
    assert.equal(light.themeVariables.lineColor, '#4b5563');
    assert.equal(light.maxTextSize, 50_000);
    assert.equal(light.maxEdges, 2_000);
    assert.equal(light.securityLevel, 'strict');
    assert.equal(light.suppressErrorRendering, true);
    assert.equal(light.themeVariables.htmlLabels, undefined);
    assert.match(light.themeCSS, /\[aria-roledescription="sequence"\] rect\.actor/);

    document.body.setAttribute('data-ds-dark-theme', '');
    const dark = themeConfig(document);
    assert.equal(dark.themeVariables.darkMode, true);
    assert.equal(dark.themeVariables.primaryTextColor, '#f2f2f3');
    // Node fill is an accent tint over the page background, not the near-white
    // code-block surface, and must differ from the surrounding canvas.
    assert.equal(dark.themeVariables.background, 'transparent');
    assert.match(dark.themeVariables.primaryColor, /^#[0-9a-f]{6}$/);
    assert.notEqual(dark.themeVariables.primaryColor, '#121214');
    assert.notEqual(dark.themeVariables.primaryColor, dark.themeVariables.primaryBorderColor);
  }));

test('theme fingerprint changes when boolean appearance attributes flip', () =>
  withDom(() => {
    const light = themeFingerprint();
    document.body.setAttribute('data-ds-dark-theme', '');
    assert.notEqual(themeFingerprint(), light);
    const dark = themeFingerprint();
    document.body.setAttribute('data-acrylic-wallpaper', '');
    assert.notEqual(themeFingerprint(), dark);
  }));
