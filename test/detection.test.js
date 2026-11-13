import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diagramType,
  isMermaidCodeBlock,
  isMermaidSource,
  stripPreamble,
} from '../src/detection.js';

function block({ language = '', source = '', withBanner = true, bannerText } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'md-code-block';
  if (withBanner) {
    const banner = document.createElement('div');
    banner.setAttribute('data-code-block-banner', '');
    const info = document.createElement('div');
    info.setAttribute('data-text-interaction-exclude', '');
    info.textContent = bannerText ?? language;
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    banner.append(info, copy);
    wrapper.append(banner);
  }
  const content = document.createElement('div');
  content.setAttribute('data-code-block-content', '');
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  if (language) code.className = `language-${language}`;
  code.textContent = source;
  pre.append(code);
  content.append(pre);
  wrapper.append(content);
  document.body.append(wrapper);
  return code;
}

// happy-dom does not provide the browser globals unless a Window is active.
async function withDom(callback) {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/' });
  const names = ['document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'navigator'];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: window[name] });
  }
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

test('strips Mermaid directives and front matter before reading the diagram type', async () => {
  assert.equal(diagramType('%%{init: {"theme":"forest"}}%%\nflowchart TD\nA-->B'), 'flowchart');
  assert.equal(diagramType('%% a comment\n%% another\nsequenceDiagram\nA->>B: hi'), 'sequenceDiagram');
  assert.equal(diagramType('---\ntitle: Demo\n---\nflowchart LR\nA-->B'), 'flowchart');
  assert.equal(diagramType('---\ntitle: Demo\n---\n%%{init: {"theme":"dark"}}%%\ngraph TD\nA-->B'), 'graph');
  assert.equal(diagramType('json\n{"graph": "not a diagram"}'), '');
  assert.equal(stripPreamble('%%{init: {}}%%\npie\n"a": 1'), 'pie\n"a": 1');
});

test('banner text decides the language when the code element has no language class', () =>
  withDom(() => {
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: 'mermaid', source: 'flowchart TD\nA-->B' })), true);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: 'python', source: 'graph = {"a": 1}' })), false);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: '代码', source: 'flowchart TD\nA-->B' })), true);
    // DSH's zh-CN UI labels untagged/unknown fences with 「代码块」; that is a
    // generic label, not a language, so the source heuristic must still run.
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: '代码块', source: 'flowchart TD\nA-->B' })), true);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: '代码块', source: 'graph = {"a": 1}' })), false);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: 'Code block', source: 'flowchart TD\nA-->B' })), true);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: 'Code block', source: 'graph = {"a": 1}' })), false);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: '', source: 'graph LR\nA-->B' })), true);
    assert.equal(isMermaidCodeBlock(block({ language: '', bannerText: 'mermaid', source: '%%{init: {}}%%\nflowchart TD\nA-->B' })), true);
    assert.equal(isMermaidSource('%%{init: {"theme":"forest"}}%%\nflowchart TD\nA-->B'), true);
  }));

test('explicit non-Mermaid language classes and diagram-looking foreign sources are rejected', () =>
  withDom(() => {
    assert.equal(isMermaidCodeBlock(block({ language: 'arduino', source: 'flowchart TD\nA-->B' })), false);
    assert.equal(isMermaidCodeBlock(block({ language: 'json', source: '{ "graph": "x" }' })), false);
    assert.equal(isMermaidCodeBlock(block({ language: 'mermaid', source: 'flowchart TD\nA-->B' })), true);
    const notInPre = document.createElement('code');
    notInPre.className = 'language-mermaid';
    notInPre.textContent = 'flowchart TD\nA-->B';
    document.body.append(notInPre);
    assert.equal(isMermaidCodeBlock(notInPre), false);
  }));
