// Mermaid theme derived from DSH's live design tokens so diagrams match the app
// in light, dark and acrylic (wallpaper/fluent) themes.

const LIGHT_FALLBACKS = {
  bg: '#f7f7f7',
  surface: '#fafafa',
  text: '#222222',
  line: '#666666',
  accent: '#0067c0',
  border: '#bbbbbb',
};

const DARK_FALLBACKS = {
  bg: '#1e1e1e',
  surface: '#2b2b2b',
  text: '#eeeeee',
  line: '#aaaaaa',
  accent: '#79b8ff',
  border: '#505050',
};

// Theme-relevant body attributes DSH flips when the appearance changes.
const THEME_ATTRIBUTES = [
  'data-ds-dark-theme',
  'data-acrylic-wallpaper',
  'data-acrylic-fluent',
  'class',
  'style',
];

// These are boolean markers (presence, not value).
const BOOLEAN_THEME_ATTRIBUTES = new Set([
  'data-ds-dark-theme',
  'data-acrylic-wallpaper',
  'data-acrylic-fluent',
]);

function isDark() {
  return document.body?.hasAttribute('data-ds-dark-theme') ?? false;
}

function themeFingerprint() {
  const body = document.body;
  if (!body) return 'light';
  return THEME_ATTRIBUTES
    .map((name) => (BOOLEAN_THEME_ATTRIBUTES.has(name)
      ? `${name}=${body.hasAttribute(name) ? '1' : '0'}`
      : `${name}=${body.getAttribute(name) || ''}`))
    .join('|');
}

function colorReader(document, dark) {
  const view = document.defaultView;
  const probe = document.createElement('span');
  probe.dataset.dshMermaidProbe = '';
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const canvas = dark ? 31 : 255;

  function color(token, fallback) {
    probe.style.color = `var(${token},${fallback})`;
    const value = view.getComputedStyle(probe).color;
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return `#${[...value.slice(1)].map((channel) => channel + channel).join('')}`;
    }
    const rgb = value.match(
      /^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+))?/,
    );
    if (!rgb) return fallback;
    const alpha = rgb[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(rgb[4])));
    return `#${rgb.slice(1, 4)
      .map((channel) => Math.round(Number(channel) * alpha + canvas * (1 - alpha))
        .toString(16).padStart(2, '0'))
      .join('')}`;
  }

  return {
    color,
    dispose() {
      probe.remove();
    },
  };
}

function themeConfig(document) {
  if (!document.body) throw new Error('Mermaid theme requires a document body');
  const dark = isDark();
  const fallbacks = dark ? DARK_FALLBACKS : LIGHT_FALLBACKS;
  const reader = colorReader(document, dark);
  try {
    const bg = reader.color('--dsw-alias-markdown-code-block', fallbacks.bg);
    const surface = reader.color('--dsw-alias-bg-layer-2', fallbacks.surface);
    const text = reader.color('--dsw-alias-label-primary', fallbacks.text);
    const line = reader.color('--dsw-alias-label-tertiary', fallbacks.line);
    const accent = reader.color('--dsw-alias-state-business-primary', fallbacks.accent);
    const border = reader.color('--dsw-alias-border-l1', fallbacks.border);
    const fontFamily = document.defaultView.getComputedStyle(document.body).fontFamily || 'sans-serif';
    // Mermaid 11 resolves several diagram families through themeVariables, but
    // sequence diagrams still paint actors from the base theme. Re-assert the
    // DSH tokens for them so every diagram family matches the surrounding UI.
    const sequenceCss = [
      `[aria-roledescription="sequence"] rect.actor,`,
      `[aria-roledescription="sequence"] .actor-man circle,`,
      `[aria-roledescription="sequence"] .actor-man line { fill: ${surface}; stroke: ${border}; }`,
      `[aria-roledescription="sequence"] text.actor > tspan { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .actor-line { stroke: ${line}; }`,
      `[aria-roledescription="sequence"] .messageLine0,`,
      `[aria-roledescription="sequence"] .messageLine1 { stroke: ${line}; }`,
      `[aria-roledescription="sequence"] [id$="-arrowhead"] path { fill: ${line}; stroke: ${line}; }`,
      `[aria-roledescription="sequence"] .messageText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .labelBox { fill: ${surface}; stroke: ${border}; }`,
      `[aria-roledescription="sequence"] .labelText,`,
      `[aria-roledescription="sequence"] .loopText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .note { fill: ${bg}; stroke: ${border}; }`,
      `[aria-roledescription="sequence"] .noteText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .activation0,`,
      `[aria-roledescription="sequence"] .activation1,`,
      `[aria-roledescription="sequence"] .activation2 { fill: ${surface}; stroke: ${accent}; }`,
    ].join('\n');

    return {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      themeCSS: sequenceCss,
      maxTextSize: 50_000,
      maxEdges: 2_000,
      htmlLabels: false,
      flowchart: { htmlLabels: false, curve: 'linear', nodeSpacing: 36, rankSpacing: 44, padding: 14 },
      themeVariables: {
        darkMode: dark,
        fontFamily,
        fontSize: '14px',
        background: bg,
        primaryColor: surface,
        primaryTextColor: text,
        primaryBorderColor: border,
        secondaryColor: bg,
        secondaryTextColor: text,
        secondaryBorderColor: line,
        tertiaryColor: surface,
        tertiaryTextColor: text,
        tertiaryBorderColor: line,
        lineColor: line,
        textColor: text,
        mainBkg: surface,
        nodeBorder: border,
        clusterBkg: bg,
        clusterBorder: border,
        edgeLabelBackground: bg,
        actorBkg: surface,
        actorBorder: border,
        actorTextColor: text,
        actorLineColor: line,
        signalColor: line,
        signalTextColor: text,
        labelBoxBkgColor: surface,
        labelBoxBorderColor: line,
        labelTextColor: text,
        noteBkgColor: bg,
        noteBorderColor: line,
        noteTextColor: text,
        activationBkgColor: surface,
        activationBorderColor: accent,
      },
    };
  } finally {
    reader.dispose();
  }
}

export { THEME_ATTRIBUTES, isDark, themeConfig, themeFingerprint };
