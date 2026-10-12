// Visual themes for the plan workspace. Colors are original.
// The Warcraft theme uses stone, gold and parchment. It does not use game art.

const STORAGE_KEY = 'dragno_plan_theme_v1';

const VAR_BY_CHANNEL = {
  bg: '--cad-bg',
  canvas: '--cad-canvas',
  inset: '--cad-inset',
  raised: '--cad-raised',
  surface: '--cad-surface',
  panel: '--cad-panel',
  header: '--cad-header',
  hover: '--cad-hover',
  border: '--cad-border',
  borderLight: '--cad-border-light',
  accent: '--cad-accent',
  gold: '--cad-gold',
  live: '--cad-live',
  danger: '--cad-danger',
  text: '--cad-text',
  muted: '--cad-muted',
  onAccent: '--cad-on-accent',
  chip: '--cad-chip',
  chipHover: '--cad-chip-hover',
  chipGold: '--cad-chip-gold',
  chipLive: '--cad-chip-live',
  accentHot: '--cad-accent-hot',
  grid: '--cad-grid',
  gridDim: '--cad-grid-dim'
};

function theme(id, label, swatch, channels, extras) {
  return { id, label, swatch, channels, ...extras };
}

export const PLAN_THEMES = {
  autocad: theme('autocad', 'AutoCAD', ['#0c0e12', '#00e5ff', '#ffd600'], {
    bg: '12 14 18',
    canvas: '16 19 24',
    inset: '10 13 18',
    raised: '14 18 24',
    surface: '19 23 32',
    panel: '21 25 33',
    header: '26 32 44',
    hover: '32 40 54',
    border: '38 47 63',
    borderLight: '55 65 81',
    accent: '0 229 255',
    gold: '255 214 0',
    live: '0 230 118',
    danger: '255 61 0',
    text: '226 232 240',
    muted: '139 152 165',
    onAccent: '0 0 0',
    chip: '8 47 61',
    chipHover: '14 78 99',
    chipGold: '66 48 0',
    chipLive: '4 48 32',
    accentHot: '103 232 249',
    grid: '33 41 54',
    gridDim: '24 31 42',
    wire: '76 99 125',
    wireLive: '255 230 0',
    sheet: '13 16 22',
    sheetShade: '13 16 22',
    sheetEdge: '34 48 66',
    sheetInk: '0 229 118',
    sheetPanel: '18 23 32',
    crosshair: '255 255 255',
    crosshairHalo: '0 0 0',
    tag: '255 214 0',
    tagLive: '0 230 118',
    titleLabel: '129 212 250',
    titleValue: '255 255 255',
    pin: '255 61 0',
    select: '0 229 255',
    guide: '255 79 216'
  }, { crosshairAlpha: 0.32, haloAlpha: 0.45, vignette: null, glow: false, ornate: false, doubleLine: false }),

  neon: theme('neon', 'Neón morado', ['#12041c', '#c450ff', '#ff46be'], {
    bg: '8 4 18',
    canvas: '14 6 32',
    inset: '6 2 16',
    raised: '20 8 44',
    surface: '28 10 56',
    panel: '34 12 66',
    header: '48 16 88',
    hover: '70 24 118',
    border: '98 40 158',
    borderLight: '150 78 214',
    accent: '196 80 255',
    gold: '255 70 190',
    live: '70 255 220',
    danger: '255 50 90',
    text: '244 232 255',
    muted: '176 150 210',
    onAccent: '14 0 24',
    chip: '52 12 96',
    chipHover: '82 22 136',
    chipGold: '84 12 64',
    chipLive: '8 52 48',
    accentHot: '230 170 255',
    grid: '132 78 210',
    gridDim: '54 24 96',
    wire: '130 80 190',
    wireLive: '255 90 220',
    sheet: '10 4 26',
    sheetShade: '6 2 16',
    sheetEdge: '92 36 160',
    sheetInk: '190 90 255',
    sheetPanel: '22 8 48',
    crosshair: '230 180 255',
    crosshairHalo: '0 0 0',
    tag: '255 120 220',
    tagLive: '120 255 230',
    titleLabel: '206 156 255',
    titleValue: '255 245 255',
    pin: '255 60 140',
    select: '196 80 255',
    guide: '255 90 210'
  }, { crosshairAlpha: 0.55, haloAlpha: 0.5, vignette: 'rgba(48, 0, 90, 0.55)', glow: true, ornate: false, doubleLine: false }),

  golden: theme('golden', 'Dorado', ['#0e0c08', '#e8bc4a', '#ffd678'], {
    bg: '12 10 6',
    canvas: '18 14 8',
    inset: '8 7 4',
    raised: '26 20 10',
    surface: '34 26 12',
    panel: '40 30 14',
    header: '56 40 16',
    hover: '78 56 18',
    border: '128 94 36',
    borderLight: '184 140 52',
    accent: '232 188 74',
    gold: '255 214 120',
    live: '86 214 140',
    danger: '220 70 40',
    text: '255 244 214',
    muted: '186 164 120',
    onAccent: '28 18 4',
    chip: '66 46 10',
    chipHover: '98 70 16',
    chipGold: '84 58 8',
    chipLive: '24 52 28',
    accentHot: '255 224 140',
    grid: '120 90 36',
    gridDim: '64 48 20',
    wire: '146 114 54',
    wireLive: '255 220 110',
    sheet: '16 12 6',
    sheetShade: '10 8 4',
    sheetEdge: '140 104 36',
    sheetInk: '212 168 64',
    sheetPanel: '32 24 10',
    crosshair: '255 214 120',
    crosshairHalo: '0 0 0',
    tag: '255 208 90',
    tagLive: '255 244 190',
    titleLabel: '212 176 96',
    titleValue: '255 248 230',
    pin: '255 120 60',
    select: '255 208 80',
    guide: '255 150 70'
  }, { crosshairAlpha: 0.55, haloAlpha: 0.5, vignette: 'rgba(48, 28, 0, 0.45)', glow: true, ornate: false, doubleLine: true }),

  wow: theme('wow', 'Warcraft', ['#24180f', '#e2c56a', '#3ad4f0'], {
    bg: '10 16 18',
    canvas: '16 26 28',
    inset: '22 16 10',
    raised: '34 24 14',
    surface: '54 36 20',
    panel: '44 30 18',
    header: '62 40 22',
    hover: '78 52 28',
    border: '154 112 52',
    borderLight: '214 170 84',
    accent: '58 214 240',
    gold: '255 214 64',
    live: '86 236 214',
    danger: '210 72 52',
    text: '236 228 206',
    muted: '168 146 112',
    onAccent: '6 18 22',
    chip: '10 48 58',
    chipHover: '14 74 88',
    chipGold: '72 50 14',
    chipLive: '8 58 64',
    accentHot: '168 244 255',
    grid: '38 68 72',
    gridDim: '24 48 52',
    wire: '72 104 108',
    wireLive: '90 240 255',
    sheet: '28 58 62',
    sheetShade: '16 36 40',
    sheetEdge: '74 48 26',
    sheetInk: '226 184 86',
    sheetPanel: '230 210 166',
    rail: '176 132 62',
    letter: '48 30 12',
    crosshair: '120 236 255',
    crosshairHalo: '0 0 0',
    tag: '255 220 60',
    tagLive: '90 245 255',
    titleLabel: '90 58 28',
    titleValue: '36 22 10',
    pin: '255 96 72',
    select: '80 220 255',
    guide: '255 196 80'
  }, { crosshairAlpha: 0.85, haloAlpha: 0.55, vignette: 'rgba(0, 12, 16, 0.55)', glow: false, ornate: false, doubleLine: false, board: true })
};

export const PLAN_THEME_LIST = ['autocad', 'neon', 'golden', 'wow'].map(id => PLAN_THEMES[id]);

const listeners = new Set();
let currentId = 'autocad';

function resolveTheme(id) {
  return PLAN_THEMES[id] || PLAN_THEMES.autocad;
}

function channelHex(triplet) {
  return '#' + triplet.split(' ').map(part => Number(part).toString(16).padStart(2, '0')).join('');
}

function channelRgba(triplet, alpha) {
  const [r, g, b] = triplet.split(' ').map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function paletteOf(id) {
  const theme = resolveTheme(id);
  const channels = theme.channels;
  const paint = {};
  Object.keys(channels).forEach(key => {
    paint[key] = channelHex(channels[key]);
  });
  paint.selectFill = channelRgba(channels.select, 0.16);
  paint.liveFill = channelRgba(channels.live, 0.14);
  paint.liveLine = channelRgba(channels.live, 0.9);
  paint.accentLine = channelRgba(channels.accent, 0.9);
  paint.crosshairLine = channelRgba(channels.crosshair, theme.crosshairAlpha);
  paint.crosshairHaloLine = channelRgba(channels.crosshairHalo, theme.haloAlpha);
  paint.vignette = theme.vignette;
  paint.glow = theme.glow;
  paint.ornate = theme.ornate;
  paint.doubleLine = theme.doubleLine;
  paint.board = !!theme.board;
  return paint;
}

export function canvasPalette() {
  return paletteOf(currentId);
}

export function getPlanThemeId() {
  return currentId;
}

export function readStoredPlanTheme() {
  try {
    if (typeof localStorage === 'undefined') return 'autocad';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && PLAN_THEMES[saved]) return saved;
  } catch {
    // Storage can be blocked. The default theme still applies.
  }
  return 'autocad';
}

export function applyPlanTheme(id) {
  const theme = resolveTheme(id);
  currentId = theme.id;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.planTheme = theme.id;
    Object.entries(VAR_BY_CHANNEL).forEach(([key, cssName]) => {
      root.style.setProperty(cssName, theme.channels[key]);
    });
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // The theme still applies for this session.
  }
  listeners.forEach(listener => listener(theme.id));
  return theme.id;
}

export function bootPlanTheme() {
  return applyPlanTheme(readStoredPlanTheme());
}

export function subscribePlanTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
