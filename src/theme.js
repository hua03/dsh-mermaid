// Mermaid theme derived from DSH's live design tokens so diagrams match the app
// in light, dark and acrylic (wallpaper/fluent) themes.

const LIGHT_FALLBACKS = {
  canvas: '#ffffff',
  bg: '#f7f7f7',
  surface: '#fafafa',
  text: '#222222',
  line: '#4b5563',
  muted: '#9ca3af',
  accent: '#4d6bfe',
  border: 'rgba(0, 0, 0, 0.1)',
};

const DARK_FALLBACKS = {
  canvas: '#1b1b1c',
  bg: '#1e1e1e',
  surface: '#2b2b2b',
  text: '#eeeeee',
  line: '#a1a7ae',
  muted: '#767d85',
  accent: '#6b8dff',
  border: 'rgba(255, 255, 255, 0.12)',
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

function mix(foreground, background, weight) {
  const read = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const [fr, fg, fb] = read(foreground);
  const [br, bgColor, bb] = read(background);
  const channel = (f, b) => Math.round(f * weight + b * (1 - weight)).toString(16).padStart(2, '0');
  return `#${channel(fr, br)}${channel(fg, bgColor)}${channel(fb, bb)}`;
}

function themeConfig(document) {
  if (!document.body) throw new Error('Mermaid theme requires a document body');
  const dark = isDark();
  const fallbacks = dark ? DARK_FALLBACKS : LIGHT_FALLBACKS;
  const reader = colorReader(document, dark);
  try {
    const canvas = reader.color('--dsw-alias-bg-layer-1', fallbacks.canvas);
    const bg = reader.color('--dsw-alias-markdown-code-block', fallbacks.bg);
    const text = reader.color('--dsw-alias-label-primary', fallbacks.text);
    const line = reader.color('--dsw-alias-label-secondary', fallbacks.line);
    const muted = reader.color('--dsw-alias-label-tertiary', fallbacks.muted);
    const accent = reader.color('--dsw-alias-state-business-primary', fallbacks.accent);
    const border = reader.color('--dsw-alias-border-l2', fallbacks.border);
    // DSH's code-block surface sits within a few percent of the page background
    // (#f9fafb on #fff), so painting nodes with it makes them disappear in the
    // light theme. Tint the accent into the page background instead: readable
    // in every theme without hard-coding light/dark colors.
    const nodeFill = mix(accent, canvas, dark ? 0.26 : 0.11);
    const nodeBorder = mix(accent, canvas, dark ? 0.55 : 0.42);
    const clusterFill = mix(accent, canvas, dark ? 0.12 : 0.05);
    const fontFamily = document.defaultView.getComputedStyle(document.body).fontFamily || 'sans-serif';
    // Mermaid 11 resolves several diagram families through themeVariables, but
    // sequence diagrams still paint actors from the base theme. Re-assert the
    // DSH tokens for them so every diagram family matches the surrounding UI.
    const sequenceCss = [
      `[aria-roledescription="sequence"] rect.actor,`,
      `[aria-roledescription="sequence"] .actor-man circle,`,
      `[aria-roledescription="sequence"] .actor-man line { fill: ${nodeFill}; stroke: ${nodeBorder}; }`,
      `[aria-roledescription="sequence"] text.actor > tspan { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .actor-line { stroke: ${muted}; }`,
      `[aria-roledescription="sequence"] .messageLine0,`,
      `[aria-roledescription="sequence"] .messageLine1 { stroke: ${line}; }`,
      `[aria-roledescription="sequence"] [id$="-arrowhead"] path { fill: ${line}; stroke: ${line}; }`,
      `[aria-roledescription="sequence"] .messageText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .labelBox { fill: ${nodeFill}; stroke: ${nodeBorder}; }`,
      `[aria-roledescription="sequence"] .labelText,`,
      `[aria-roledescription="sequence"] .loopText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .note { fill: ${bg}; stroke: ${border}; }`,
      `[aria-roledescription="sequence"] .noteText { fill: ${text}; }`,
      `[aria-roledescription="sequence"] .activation0,`,
      `[aria-roledescription="sequence"] .activation1,`,
      `[aria-roledescription="sequence"] .activation2 { fill: ${nodeFill}; stroke: ${accent}; }`,
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
        background: 'transparent',
        primaryColor: nodeFill,
        primaryTextColor: text,
        primaryBorderColor: nodeBorder,
        secondaryColor: clusterFill,
        secondaryTextColor: text,
        secondaryBorderColor: nodeBorder,
        tertiaryColor: bg,
        tertiaryTextColor: text,
        tertiaryBorderColor: border,
        lineColor: line,
        textColor: text,
        mainBkg: nodeFill,
        nodeBorder,
        clusterBkg: clusterFill,
        clusterBorder: nodeBorder,
        edgeLabelBackground: canvas,
        actorBkg: nodeFill,
        actorBorder: nodeBorder,
        actorTextColor: text,
        actorLineColor: muted,
        signalColor: line,
        signalTextColor: text,
        labelBoxBkgColor: nodeFill,
        labelBoxBorderColor: nodeBorder,
        labelTextColor: text,
        noteBkgColor: bg,
        noteBorderColor: border,
        noteTextColor: text,
        activationBkgColor: nodeFill,
        activationBorderColor: accent,
        stateBkg: nodeFill,
        stateBorder: nodeBorder,
        labelBackgroundColor: canvas,
        compositeBackground: clusterFill,
        compositeBorder: nodeBorder,
        compositeTitleBackground: clusterFill,
      },
    };
  } finally {
    reader.dispose();
  }
}

export { THEME_ATTRIBUTES, isDark, themeConfig, themeFingerprint };
