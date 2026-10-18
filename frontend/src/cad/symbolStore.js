// Symbol Store and Dynamic Component Customization Engine
// Handles custom piece geometries, pin connections, storage in localStorage and rendering

import { SYMBOL_DEFINITIONS as DEFAULT_SYMBOLS, CATEGORIES as DEFAULT_CATEGORIES, SWITCH_GROUP } from './symbolCatalog';
import { DEFAULT_LAYERS, layerState } from './draw/geometry';
import { labelAnchorBox } from './componentLabel';
import { defaultPinLinks } from './pinLinks';
import { ioOf, userCanOperate } from './ioKind';
import { tracePrimitive } from './draw/tracePrimitive';
import { applyDash } from './draw/lineStyle';


const STORAGE_KEY = 'dragno_custom_symbols_v1';
const LIBRARY_HIDDEN_KEY = 'dragno_library_hidden_v1';

// The editor stores the drawing and the name. These fields are the electrical
// behavior, and a saved drawing must not replace them.
const LOGIC_FIELDS = [
  'role',
  'io',
  'negate',
  'switchType',
  'contactType',
  'linkedRole',
  'behavior',
  'followsRole',
  'pinLinks',
  'defaultState'
];

function visualSymbolOverlay(customDef) {
  const overlay = { ...(customDef || {}) };
  LOGIC_FIELDS.forEach(field => delete overlay[field]);
  if (Array.isArray(overlay.pins)) {
    overlay.pins = overlay.pins.map(pin => {
      if (!pin || pin.negate === undefined) return pin;
      const copy = { ...pin };
      delete copy.negate;
      return copy;
    });
  }
  return overlay;
}

// Default primitive vector geometries for each built-in symbol
export const DEFAULT_PRIMITIVES = {
  COIL: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -15, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'rect', x: -12, y: -15, width: 24, height: 30, stroke: '#00e5ff', strokeWidth: 2, fill: '#141822' },
    { id: 'p3', type: 'line', x1: 0, y1: 15, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'text', x: 0, y: 3, text: '{tag}', color: '#ffd600', fontSize: 9, align: 'center' }
  ],
  BUTTON_NO: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'line', x1: 0, y1: 10, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: 10, x2: 10, y2: -8, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: 6, y1: 0, x2: 0, y2: 0, stroke: '#00e5ff', strokeWidth: 1.5 },
    { id: 'p5', type: 'line', x1: 0, y1: -6, x2: 0, y2: 6, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  BUTTON_NC: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'line', x1: 0, y1: 10, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: 10, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: -5, y1: -10, x2: 5, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p5', type: 'line', x1: 0, y1: 0, x2: -6, y2: 0, stroke: '#00e5ff', strokeWidth: 1.5 },
    { id: 'p6', type: 'line', x1: -6, y1: -6, x2: -6, y2: 6, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  CONTACT_NO: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'line', x1: 0, y1: 10, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: 10, x2: 10, y2: -8, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  CONTACT_NC: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'line', x1: 0, y1: 10, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: 10, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: -5, y1: -10, x2: 5, y2: -10, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  BREAKER_1P: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -12, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'line', x1: 0, y1: 12, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: 12, x2: 10, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: 4, y1: 0, x2: 12, y2: 0, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  PILOT_LIGHT: [
    { id: 'p1', type: 'line', x1: 0, y1: -25, x2: 0, y2: -12, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'circle', cx: 0, cy: 0, r: 12, stroke: '#00e5ff', strokeWidth: 2, fill: '#141822' },
    { id: 'p3', type: 'line', x1: -8, y1: -8, x2: 8, y2: 8, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: 8, y1: -8, x2: -8, y2: 8, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p5', type: 'line', x1: 0, y1: 12, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 }
  ],
  MOTOR_3P: [
    { id: 'p1', type: 'circle', cx: 0, cy: 0, r: 18, stroke: '#00e5ff', strokeWidth: 2, fill: '#141822' },
    { id: 'p2', type: 'line', x1: -20, y1: -30, x2: -20, y2: -18, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p3', type: 'line', x1: 0, y1: -30, x2: 0, y2: -18, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p4', type: 'line', x1: 20, y1: -30, x2: 20, y2: -18, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p5', type: 'line', x1: 18, y1: 15, x2: 25, y2: 15, stroke: '#76ff03', strokeWidth: 2 },
    { id: 'p6', type: 'text', x: 0, y: -2, text: 'M', color: '#ffffff', fontSize: 11, align: 'center' },
    { id: 'p7', type: 'text', x: 0, y: 10, text: '3~', color: '#81d4fa', fontSize: 9, align: 'center' }
  ],
  TERMINAL_BLOCK: [
    { id: 'p1', type: 'line', x1: 0, y1: -20, x2: 0, y2: -5, stroke: '#00e5ff', strokeWidth: 2 },
    { id: 'p2', type: 'circle', cx: 0, cy: 0, r: 5, stroke: '#00e5ff', strokeWidth: 2, fill: '#141822' },
    { id: 'p3', type: 'line', x1: 0, y1: 5, x2: 0, y2: 20, stroke: '#00e5ff', strokeWidth: 2 }
  ]
};

Object.values(DEFAULT_SYMBOLS).forEach(def => {
  if (def.primitives && (def.category === 'Potenciales y Señales' || def.library)) {
    DEFAULT_PRIMITIVES[def.type] = def.primitives;
  }
});

// Retrieve all custom symbols from localStorage
export function getStoredCustomSymbols() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error cargando símbolos personalizados:', err);
    return {};
  }
}

// Save a custom symbol
export function saveCustomSymbol(symbolDef) {
  try {
    const current = getStoredCustomSymbols();
    current[symbolDef.type] = {
      ...symbolDef,
      isCustom: true,
      updatedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (err) {
    console.error('Error guardando símbolo personalizado:', err);
    return null;
  }
}

function readHiddenLibraryTypes() {
  try {
    const raw = localStorage.getItem(LIBRARY_HIDDEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(item => typeof item === 'string' && item);
  } catch {
    return [];
  }
}

export function hiddenLibraryTypes() {
  return readHiddenLibraryTypes();
}

// Drop a piece from the library list. The definition stays, so a copy already
// drawn on a sheet keeps its symbol.
export function hideSymbolFromLibrary(type) {
  const id = String(type || '');
  if (!id) return readHiddenLibraryTypes();
  const hidden = new Set(readHiddenLibraryTypes());
  hidden.add(id);
  const list = [...hidden];
  try {
    localStorage.setItem(LIBRARY_HIDDEN_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error ocultando símbolo de la biblioteca:', err);
  }
  return list;
}

export function replaceHiddenLibraryTypes(list) {
  const next = Array.isArray(list)
    ? list.filter(item => typeof item === 'string' && item)
    : [];
  try {
    localStorage.setItem(LIBRARY_HIDDEN_KEY, JSON.stringify([...new Set(next)]));
  } catch (err) {
    console.error('Error guardando la biblioteca oculta:', err);
  }
  return readHiddenLibraryTypes();
}

// Delete or reset a custom symbol
export function deleteCustomSymbol(type) {
  try {
    const current = getStoredCustomSymbols();
    delete current[type];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (err) {
    console.error('Error eliminando símbolo:', err);
    return null;
  }
}

// Reset everything to default catalog
export function resetAllCustomSymbols() {
  localStorage.removeItem(STORAGE_KEY);
}

// Full set used to draw pieces already on a sheet, including factory symbols.
export function getActiveSymbolDefinitions() {
  const custom = getStoredCustomSymbols();
  const merged = { ...DEFAULT_SYMBOLS };

  Object.keys(merged).forEach(type => {
    if (!merged[type].primitives && DEFAULT_PRIMITIVES[type]) {
      merged[type] = {
        ...merged[type],
        primitives: DEFAULT_PRIMITIVES[type]
      };
    }
  });

  Object.keys(custom).forEach(type => {
    const stored = {
      ...(merged[type] || {}),
      ...visualSymbolOverlay(custom[type]),
      isCustom: true
    };
    // A piece the user drew is rest sprite + actuated sprite + the pin table.
    // A saved name or group must not rewrite that into a breaker or a tint.
    if (String(type).startsWith('CUSTOM_')) {
      delete stored.switchType;
      delete stored.contactType;
      delete stored.linkedRole;
      delete stored.behavior;
      if (!stored.role) {
        // A drawn motor keeps the three-phase sequence. Other drawn pieces
        // stay switches, because the editor does not store a role.
        stored.role = /^motor\b/i.test(String(stored.name || '').trim()) ? 'motor' : 'switch';
      }
      stored.defaultState = { on: false };
    }
    merged[type] = stored;
  });

  return merged;
}

// Library list. Factory pieces stay hidden, except the voltage sources
// and the pieces marked library (the contactor coil and its switch).
// A type the user removed stays out of this list. Sources always stay.
export function librarySymbolDefinitions(defs = {}) {
  const hidden = new Set(readHiddenLibraryTypes());
  const library = {};
  Object.keys(defs).forEach(type => {
    const def = defs[type];
    const factory = DEFAULT_SYMBOLS[type];
    const category = def?.category || factory?.category || 'Personalizados';
    const role = def?.role || factory?.role;
    if (role === 'source') {
      library[type] = { ...def, category };
      return;
    }
    if (hidden.has(type)) return;
    if (factory && category !== 'Potenciales y Señales' && !def?.library && !factory.library) return;
    library[type] = {
      ...def,
      category
    };
  });
  return library;
}

export function createBlankSymbol(category = 'Personalizados') {
  const type = `CUSTOM_${Date.now()}`;
  const def = {
    type,
    name: 'Nueva Pieza Eléctrica',
    prefix: 'U',
    category: category || 'Personalizados',
    role: 'switch',
    io: 'in',
    ...(category === SWITCH_GROUP ? { momentary: true } : {}),
    defaultState: { on: false },
    width: 40,
    height: 50,
    pinRadius: 1.5,
    pins: [
      { id: '1', label: '1', x: 0, y: -25 },
      { id: '2', label: '2', x: 0, y: 25 }
    ],
    pinLinks: defaultPinLinks([
      { id: '1', label: '1', x: 0, y: -25 },
      { id: '2', label: '2', x: 0, y: 25 }
    ]),
    primitives: [
      { id: 'p1', type: 'rect', x: -15, y: -15, width: 30, height: 30, stroke: '#00e5ff', strokeWidth: 2, fill: 'none' },
      { id: 'p2', type: 'line', x1: 0, y1: -25, x2: 0, y2: -15, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'p3', type: 'line', x1: 0, y1: 15, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'p4', type: 'text', x: 0, y: 0, text: '{tag}', color: '#ffd600', fontSize: 10, align: 'center' }
    ],
    activePrimitives: [],
    layers: DEFAULT_LAYERS.map(layer => ({ ...layer })),
    isCustom: true
  };
  saveCustomSymbol(def);
  return def;
}

// Click target in symbol coordinates. The declared width is only a starting box:
// a guardamotor drawn wider than that field must still receive the click.
export function symbolHitBox(def) {
  return labelAnchorBox(def);
}

// The actuated sprite is the drawing used when the piece is operated:
// a contact closes, a stop opens, a coil pulls in, or a thermal trips.
export function isCustomDrawn(def) {
  return !!def?.isCustom && String(def.type || '').startsWith('CUSTOM_');
}

// The drawing the user made for "encendido". Click sets state.on.
// A coil, pilot or motor they drew also uses that drawing when current arrives.
export function isSymbolActuated(comp, def) {
  const state = comp?.state || {};
  if (isCustomDrawn(def)) {
    if (userCanOperate(def, comp) && (state.on || state.pressed || state.forced)) return true;
    if (def.role === 'coil' || def.role === 'load' || def.role === 'motor') {
      return !!comp?.energized || !!comp?.linked;
    }
    if (def.role === 'contact' || ioOf(def, comp) === 'out') return !!comp?.linked || state.closed === true;
    return false;
  }
  if (comp?.linked && !userCanOperate(def, comp)) return true;
  if (def?.role === 'coil' || def?.role === 'load' || def?.role === 'motor') return !!comp?.energized;
  if (def?.switchType === 'thermal' || def?.linkedRole === 'thermal') return state.tripped === true;
  if (def?.contactType === 'NC' || def?.switchType === 'momentary_NC') {
    return state.pressed === true || state.closed === false;
  }
  if (def?.switchType === 'breaker') return state.closed === false;
  if (def?.role === 'switch' || def?.role === 'contact') return !!(state.pressed || state.closed);
  return !!comp?.energized;
}

export function symbolSprite(def, comp) {
  if (!def) return { primitives: [], actuated: false };
  const actuated = isSymbolActuated(comp, def);
  if (actuated && Array.isArray(def.activePrimitives) && def.activePrimitives.length > 0) {
    return { primitives: def.activePrimitives, actuated: true };
  }
  return { primitives: def.primitives || [], actuated: false };
}

// Universal primitive renderer for custom and standard pieces
export function renderSymbolPrimitives(ctx, primitives, comp, isSimulating, def, options = {}) {
  if (!primitives || primitives.length === 0) return false;

  const isEnergized = comp.energized;
  const state = comp.state || {};
  const isThermalPiece = def?.switchType === 'thermal' || def?.linkedRole === 'thermal';
  const isNormallyClosed = def?.contactType === 'NC' || def?.switchType === 'momentary_NC';
  const isConducting = isThermalPiece
    ? state.tripped !== true
    : isNormallyClosed
      ? !state.pressed && state.closed !== false
      : !!(state.pressed || state.closed || (def?.switchType === 'breaker' && state.closed !== false));

  primitives.forEach(prim => {
    if (!layerState(def?.layers, prim.layerId).visible) return;
    ctx.save();

    // Color dynamic adaptation during simulation
    let strokeColor = prim.stroke || '#00e5ff';
    let fillColor = prim.fill || 'none';

    // A drawn piece keeps the colors of the sprite that is on screen.
    const keepDrawnColors = options.preserveColors || isCustomDrawn(def);
    if (!keepDrawnColors && isEnergized) {
      if (def?.role === 'coil') {
        strokeColor = '#00e676';
        if (fillColor !== 'none') fillColor = 'rgba(0, 230, 118, 0.25)';
      } else if (def?.role === 'load') {
        strokeColor = '#ffd600';
        fillColor = comp.color || '#ffd600';
      } else if (def?.role === 'motor') {
        strokeColor = '#00e676';
      }
    } else if (!keepDrawnColors && isSimulating && isThermalPiece && state.tripped) {
      strokeColor = '#ff3d00';
    } else if (!keepDrawnColors && isSimulating && isConducting && (def?.role === 'switch' || def?.role === 'contact')) {
      strokeColor = '#00e676';
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = prim.strokeWidth || 2;
    applyDash(ctx, prim.dash);
    if (fillColor !== 'none') {
      ctx.fillStyle = fillColor;
    }

    if (prim.type === 'line' && prim.isBlade && (!prim.points || prim.points.length <= 2)) {
      const linePts = prim.points?.length >= 2
        ? prim.points
        : [{ x: prim.x1, y: prim.y1 }, { x: prim.x2, y: prim.y2 }];
      ctx.beginPath();
      if (isConducting) {
        ctx.moveTo(linePts[0].x, linePts[0].y);
        ctx.lineTo(linePts[0].x, linePts[1].y);
      } else {
        ctx.moveTo(linePts[0].x, linePts[0].y);
        ctx.lineTo(linePts[1].x, linePts[1].y);
      }
      ctx.stroke();
    } else {
      const traced = tracePrimitive(ctx, prim);
      if (traced === 'text') {
        ctx.save();
        ctx.translate(prim.x, prim.y);
        if (prim.rotation) ctx.rotate(prim.rotation);
        ctx.font = `${prim.fontSize || 10}px Consolas, monospace`;
        ctx.fillStyle = prim.color || strokeColor;
        ctx.textAlign = prim.align || 'center';
        ctx.textBaseline = 'middle';
        const renderedText = (prim.text || '').replace('{tag}', comp.tag || def?.prefix || '');
        ctx.fillText(renderedText, 0, 0);
        ctx.restore();
      } else if (traced === 'path') {
        if (fillColor !== 'none') ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  });

  return true;
}
