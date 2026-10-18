// Negated outputs for every piece. Each output terminal can invert on its own.
// The general NOT marks every output. A NOT on one terminal marks only that one.
// Inversion passes voltage only when that path already has live, neutral, or ground.
// An empty input stays empty.

import { conductingPairs } from './pinLinks.js';

export function canNegateOutput(def) {
  return !!def;
}

export function outputPinIds(def) {
  const ids = [];
  conductingPairs(def).forEach(([, to]) => {
    if (to && !ids.includes(to)) ids.push(to);
  });
  return ids;
}

// Pieces that pass current use the salida of each path.
// A coil, a lamp, a motor or a source has no path, so every terminal can carry NOT.
export function negationTargets(def) {
  const pins = (def?.pins || []).map(pin => pin.id).filter(Boolean);
  if (!def) return [];
  if (def.role === 'source' || def.role === 'coil' || def.role === 'load' || def.role === 'motor') return pins;
  if (Array.isArray(def.pinLinks) && def.pinLinks.length === 0) return pins;
  const linked = outputPinIds(def);
  return linked.length ? linked : pins;
}

// A saved "all outputs" flag fills terminals that do not already say otherwise.
export function applyStoredNegation(pins, pinLinks, def) {
  const list = (pins || []).map(pin => ({ ...pin }));
  if (def?.negate !== true) return list;
  const outputs = new Set(negationTargets({ pins: list, pinLinks, role: def.role }));
  return list.map(pin => {
    if (!outputs.has(pin.id) || pin.negate === false) return pin;
    return { ...pin, negate: true };
  });
}

export function pinIsNegated(comp, def, pinId) {
  if (!canNegateOutput(def) || !pinId) return false;
  if (comp?.negate === true) return true;
  if (comp?.negate === false) return false;
  const pin = (def?.pins || []).find(item => item.id === pinId);
  if (pin && typeof pin.negate === 'boolean') return pin.negate;
  return def?.negate === true;
}

export function allOutputsNegated(comp, def) {
  if (!def) return false;
  const ids = negationTargets(def);
  if (!ids.length) return comp?.negate === true || (comp?.negate !== false && def.negate === true);
  return ids.every(id => pinIsNegated(comp, def, id));
}

// The whole piece is negated when the general NOT is on, or every output is.
export function deviceIsNegated(comp, def) {
  if (!def) return false;
  if (comp?.negate === true) return true;
  if (comp?.negate === false) return false;
  if (def.negate === true) return true;
  const ids = negationTargets(def);
  return ids.length > 0 && ids.every(id => {
    const pin = (def.pins || []).find(item => item.id === id);
    return pin?.negate === true;
  });
}

function markOnOutput(def, fromId, toId) {
  const pins = def?.pins || [];
  const from = pins.find(pin => pin.id === fromId);
  const to = pins.find(pin => pin.id === toId);
  if (!from || !to) return null;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const length = Math.hypot(dx, dy) || 1;
  const inset = Math.min(8, length * 0.35);
  return {
    pinId: toId,
    x: to.x + (dx / length) * inset,
    y: to.y + (dy / length) * inset,
    r: 2.4
  };
}

export function negationMarks(comp, def) {
  if (!def) return [];
  const marks = [];
  const seen = new Set();
  conductingPairs(def).forEach(([fromId, toId]) => {
    if (seen.has(toId) || !pinIsNegated(comp, def, toId)) return;
    const mark = markOnOutput(def, fromId, toId);
    if (!mark) return;
    seen.add(toId);
    marks.push(mark);
  });
  (def.pins || []).forEach(pin => {
    if (seen.has(pin.id) || !pinIsNegated(comp, def, pin.id)) return;
    const length = Math.hypot(pin.x, pin.y) || 1;
    const inset = Math.min(8, length * 0.45);
    seen.add(pin.id);
    marks.push({
      pinId: pin.id,
      x: pin.x - (pin.x / length) * inset,
      y: pin.y - (pin.y / length) * inset,
      r: 2.4
    });
  });
  return marks;
}
