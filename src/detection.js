// Which code blocks are Mermaid diagrams?
//
// DSH 0.2.2-rc.1 renders Markdown fences as:
//   <div class="md-code-block">
//     <div data-code-block-banner>
//       <div data-text-interaction-exclude>mermaid</div>  ← fence language lives here
//       <button>Copy</button>
//     </div>
//     <div data-code-block-content>
//       <pre class="shiki css-variables"><code class="language-…"></code></pre>
//     </div>
//   </div>
//
// Shiki output normally carries a `language-*` class, but DSH's lazy highlighter
// does not always add it, so the banner text is the more reliable signal.
// The source heuristic is only a fallback for untagged fences.

const MERMAID_LANG_RE = /^language-(?:mermaid|mermaidjs|mmd)$/i;
const ANY_LANG_RE = /^language-/i;
const BANNER_SPLIT_RE = /[\s·|]+/;

// Lowercase first token → canonical Mermaid diagram type.
const DIAGRAM_TYPES = new Map([
  ['flowchart', 'flowchart'],
  ['graph', 'graph'],
  ['sequencediagram', 'sequenceDiagram'],
  ['classdiagram', 'classDiagram'],
  ['statediagram', 'stateDiagram'],
  ['statediagram-v2', 'stateDiagram-v2'],
  ['erdiagram', 'erDiagram'],
  ['gantt', 'gantt'],
  ['pie', 'pie'],
  ['journey', 'journey'],
  ['timeline', 'timeline'],
  ['mindmap', 'mindmap'],
  ['gitgraph', 'gitGraph'],
  ['quadrantchart', 'quadrantChart'],
  ['requirementdiagram', 'requirementDiagram'],
  ['c4context', 'C4Context'],
  ['c4container', 'C4Container'],
  ['c4component', 'C4Component'],
  ['c4dynamic', 'C4Dynamic'],
  ['c4deployment', 'C4Deployment'],
  ['block-beta', 'block-beta'],
  ['packet-beta', 'packet-beta'],
  ['architecture-beta', 'architecture-beta'],
  ['sankey-beta', 'sankey-beta'],
  ['xychart-beta', 'xychart-beta'],
  ['radar-beta', 'radar-beta'],
  ['treemap-beta', 'treemap-beta'],
  ['zenuml', 'zenuml'],
]);

const MERMAID_BANNER_LANGS = new Set(['mermaid', 'mermaidjs', 'mmd']);

// Languages that DSH may show in the banner. A block carrying one of these must
// never be re-interpreted from its first token (e.g. `graph = {…}` in Python).
const FOREIGN_LANGS = new Set([
  'bash', 'sh', 'shell', 'zsh', 'powershell', 'ps1', 'bat', 'cmd',
  'c', 'cpp', 'c++', 'csharp', 'cs', 'css', 'scss', 'less', 'diff', 'dockerfile',
  'elixir', 'erlang', 'go', 'graphql', 'haskell', 'html', 'ini', 'java',
  'javascript', 'js', 'jsx', 'json', 'jsonc', 'json5', 'kotlin', 'latex', 'tex',
  'lua', 'makefile', 'markdown', 'md', 'nginx', 'objective-c', 'objc', 'perl',
  'php', 'proto', 'protobuf', 'python', 'py', 'r', 'ruby', 'rb', 'rust', 'rs',
  'scala', 'sql', 'swift', 'toml', 'ts', 'tsx', 'typescript', 'vue', 'svelte',
  'xml', 'yaml', 'yml', 'dart', 'groovy', 'julia', 'matlab', 'zig', 'asm',
]);

// Generic banner labels that carry no language information; fall back to source.
const GENERIC_LABELS = new Set([
  'code', 'code-block', 'codeblock', 'code-snippet', 'snippet',
  'text', 'txt', 'plain', 'plaintext', 'plain-text', 'unknown',
  '代码', '代码块', '代码片段', '文本', '纯文本',
]);

function stripPreamble(source) {
  let text = String(source ?? '').replace(/\r\n?/g, '\n').trimStart();
  // Mermaid allows %% comments / %%{init: …}%% directives before the diagram and
  // an optional YAML front-matter block delimited by --- lines.
  for (let guard = 0; guard < 64 && text; guard += 1) {
    const lines = text.split('\n');
    if (lines[0].trim() === '---') {
      const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
      if (close > 0) {
        text = lines.slice(close + 1).join('\n').trimStart();
        continue;
      }
    }
    if (text.startsWith('%%')) {
      const end = text.indexOf('\n');
      text = end === -1 ? '' : text.slice(end + 1).trimStart();
      continue;
    }
    break;
  }
  return text;
}

function firstToken(source) {
  const match = /^\s*([A-Za-z][\w-]*)/.exec(stripPreamble(source));
  return match ? match[1] : '';
}

function diagramType(source) {
  return DIAGRAM_TYPES.get(firstToken(source).toLowerCase()) || '';
}

// `graph` / `flowchart` are the only headers that take a trailing direction on
// the first line, and both are also common variable names in other languages
// (`graph = build_dag()`). Require a diagram body before trusting them.
const FLOW_HEADER_RE = /^(?:flowchart|graph)\b/i;
const FLOW_DIRECTION_RE = /^(?:flowchart|graph)\s+(?:TD|TB|BT|LR|RL)\b/i;
const EDGE_RE = /(?:-->|---|==>|-\.->|<-->|--[^-\n]+-->)/;

function isMermaidSource(source) {
  const type = firstToken(source).toLowerCase();
  if (!DIAGRAM_TYPES.has(type)) return false;
  if (!FLOW_HEADER_RE.test(stripPreamble(source))) return true;
  return FLOW_DIRECTION_RE.test(stripPreamble(source)) || EDGE_RE.test(source);
}

function bannerLanguage(block) {
  const banner = block?.querySelector?.('[data-code-block-banner]');
  if (!banner) return '';
  const info = banner.querySelector('[data-text-interaction-exclude]');
  // Only fall back to the whole banner when DSH does not render the infostring
  // element at all; otherwise the banner's copy-button label leaks in.
  const text = (info ? info.textContent : banner.textContent || '').trim();
  if (!text) return '';
  return (text.split(BANNER_SPLIT_RE)[0] || '')
    .replace(/^[`'"]+|[`'"]+$/g, '')
    .toLowerCase();
}

function hasMermaidLanguage(classList) {
  return Array.from(classList || []).some((name) => MERMAID_LANG_RE.test(name));
}

function hasExplicitLanguage(classList) {
  return Array.from(classList || []).some((name) => ANY_LANG_RE.test(name));
}

// DSH's locale strings for the "no known language" banner come as
// `Code block` / `代码块` / `代码片段` and may be prefixed by nothing else. Treat a
// label as generic when it is a known alias or one of them plus a suffix.
function isGenericLabel(label) {
  if (!label) return true;
  if (GENERIC_LABELS.has(label)) return true;
  const stripped = label.replace(/(?:块|片段|block)$/u, '').trim();
  return stripped !== label && (GENERIC_LABELS.has(stripped) || stripped === 'code' || stripped === '代码');
}

// An explicit `language-*` class is authoritative; DSH's banner is a fallback
// for lazy-highlighted output. Only an empty/generic label allows the source
// heuristic, so ```` ```arduino ```` can never be mistaken for a diagram.
function isMermaidCodeBlock(code) {
  const pre = code?.closest?.('pre');
  if (!pre) return false;
  if (code.closest('.dsh-mmd-c, .dsh-mmd')) return false;
  if (hasMermaidLanguage(code.classList)) return true;
  if (hasExplicitLanguage(code.classList)) return false;
  const language = bannerLanguage(code.closest('.md-code-block'));
  if (MERMAID_BANNER_LANGS.has(language)) return true;
  // Any non-generic banner label is a real language, so it cannot be Mermaid.
  if (language && !isGenericLabel(language)) return false;
  return isMermaidSource(code.textContent || '');
}

export {
  diagramType,
  hasExplicitLanguage,
  hasMermaidLanguage,
  isMermaidCodeBlock,
  isMermaidSource,
  stripPreamble,
};
