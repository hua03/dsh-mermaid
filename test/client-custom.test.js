import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientHarness } from '../test-support/client-harness.js';

test('renders a banner-labelled fence, hides native fence chrome, and restores it on disposal', async () => {
  const harness = await createClientHarness({ initialSource: null });
  const { addMarkdownBlock, document, disposePlugin, state, wait } = harness;
  try {
    const block = addMarkdownBlock({
      bannerText: 'mermaid',
      source: '%%{init: {"theme":"forest"}}%%\nflowchart TD\nA-->B',
    });
    await wait(1_200);

    const card = document.querySelector('.dsh-mmd-c');
    assert.equal(card?.dataset.state, 'ok');
    assert.equal(block.wrapper.hasAttribute('data-dsh-mmd-c-host'), true);
    assert.equal(block.wrapper.querySelector('[data-code-block-banner]')?.getAttribute('data-dsh-mmd-c-banner'), null);
    assert.equal(
      state.renderCalls.at(-1),
      '%%{init: {"theme":"forest"}}%%\nflowchart TD\nA-->B',
    );
    const css = document.getElementById('dsh-mermaid-custom/css');
    assert.match(css?.textContent, /\[data-dsh-mmd-c-host\] \[data-code-block-banner\]\{display:none!important\}/);

    disposePlugin();
    assert.equal(block.wrapper.hasAttribute('data-dsh-mmd-c-host'), false);
    assert.equal(document.querySelector('.dsh-mmd-c'), null);
    assert.equal(document.getElementById('dsh-mermaid-custom/css'), null);
  } finally {
    await harness.cleanup();
  }
});

test('does not claim foreign fences whose source merely looks like a diagram', async () => {
  const harness = await createClientHarness({ initialSource: null });
  const { addMarkdownBlock, document, wait } = harness;
  try {
    const foreign = addMarkdownBlock({
      bannerText: 'python',
      source: 'graph = {"flowchart": "TD"}',
    });
    const explicit = addMarkdownBlock({
      language: 'arduino',
      source: 'flowchart TD\nA-->B',
    });
    const generic = addMarkdownBlock({
      bannerText: '代码',
      source: 'flowchart TD\nA-->B',
    });
    await wait(1_200);

    assert.equal(foreign.wrapper.hasAttribute('data-dsh-mmd-c-host'), false);
    assert.equal(explicit.wrapper.hasAttribute('data-dsh-mmd-c-host'), false);
    assert.equal(generic.wrapper.hasAttribute('data-dsh-mmd-c-host'), true);
    assert.equal(document.querySelectorAll('.dsh-mmd-c').length, 1);
  } finally {
    await harness.cleanup();
  }
});

test('copies the raw source from the card toolbar and reports the transient label', async () => {
  const harness = await createClientHarness();
  const { document, state, wait } = harness;
  try {
    await wait(1_100);
    let copied = '';
    Object.defineProperty(harness.window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { copied = text; } },
    });
    const buttons = [...document.querySelectorAll('.dsh-mmd-c-btn')];
    const copy = buttons.find((button) => button.textContent === '复制');
    assert.ok(copy, 'copy button exists');
    copy.click();
    await wait(50);
    assert.equal(copied, 'flowchart LR\nA-->B');
    assert.equal(copy.textContent, '已复制');
    await wait(1_300);
    assert.equal(copy.textContent, '复制');
  } finally {
    await harness.cleanup();
  }
});
