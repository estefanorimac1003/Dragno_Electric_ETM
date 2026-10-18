// Tag and name sit to the left of the piece until the user drags each one.
// An offset is the right edge of that text, measured from the piece origin.

import { boundsOfMany } from './draw/geometry.js';
import { rotatedBounds } from './componentPose.js';

export const TAG_FONT = 'bold 11px Consolas, monospace';
export const NAME_FONT = '11px Consolas, monospace';
const SIDE_GAP = 8;
const STACK = 18;

export function labelAnchorBox(def) {
  const halfW = (def?.width || 40) / 2;
  const halfH = (def?.height || 50) / 2;
  const boxes = [{ minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH }];
  const drawn = boundsOfMany([...(def?.primitives || []), ...(def?.activePrimitives || [])]);
  if (drawn) boxes.push(drawn);
  const pins = (def?.pins || []).filter(pin => Number.isFinite(pin.x) && Number.isFinite(pin.y));
  if (pins.length) {
    const pinBox = boundsOfMany(pins.map(pin => ({
      type: 'circle',
      cx: pin.x,
      cy: pin.y,
      r: Math.max(pin.r || def?.pinRadius || 1.5, 6)
    })));
    if (pinBox) boxes.push(pinBox);
  }
  const box = boxes.reduce((acc, item) => ({
    minX: Math.min(acc.minX, item.minX),
    minY: Math.min(acc.minY, item.minY),
    maxX: Math.max(acc.maxX, item.maxX),
    maxY: Math.max(acc.maxY, item.maxY)
  }));
  const pad = 8;
  return {
    minX: box.minX - pad,
    minY: box.minY - pad,
    maxX: box.maxX + pad,
    maxY: box.maxY + pad
  };
}

// A blank name keeps the list name. Line breaks stay, so the block can be narrower.
export function componentName(comp, def) {
  if (typeof comp?.name === 'string') {
    const lines = comp.name.replace(/\r\n/g, '\n').split('\n').map(line => line.trim());
    while (lines.length && lines[0] === '') lines.shift();
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const custom = lines.join('\n');
    if (custom) return custom;
  }
  return String(def?.name || '').trim();
}

export function nameStyleOf(comp) {
  const raw = comp?.nameStyle || {};
  const align = raw.align === 'left' || raw.align === 'center' || raw.align === 'right' ? raw.align : 'right';
  const size = Math.min(36, Math.max(8, Math.round(Number(raw.size) || 11)));
  return { align, bold: raw.bold === true, size };
}

export function nameFont(style) {
  return `${style.bold ? 'bold ' : ''}${style.size}px Consolas, monospace`;
}

export function nameLineHeight(size) {
  return Math.max(size + 3, Math.round(size * 1.25));
}

function placedOffset(raw) {
  if (raw && Number.isFinite(Number(raw.x)) && Number.isFinite(Number(raw.y))) {
    return { x: Number(raw.x), y: Number(raw.y) };
  }
  return null;
}

export function tagIsPlaced(comp) {
  return !!placedOffset(comp?.tagOffset);
}

export function nameIsPlaced(comp) {
  return !!placedOffset(comp?.nameOffset);
}

function leftOfPiece(rotation, box, yShift) {
  const spun = rotatedBounds(box, rotation);
  return {
    x: spun.minX - SIDE_GAP,
    y: (spun.minY + spun.maxY) / 2 + yShift
  };
}

export function automaticTagOffset(rotation, box, hasName) {
  return leftOfPiece(rotation, box, hasName ? -STACK / 2 : 0);
}

export function automaticNameOffset(rotation, box, lineCount = 1, size = 11) {
  const extra = Math.max(0, lineCount - 1) * nameLineHeight(size) / 2;
  return leftOfPiece(rotation, box, STACK / 2 + extra);
}

export function componentLabels(comp, def) {
  const box = labelAnchorBox(def);
  const tag = String(comp?.tag || comp?.type || '');
  const name = componentName(comp, def);
  const style = nameStyleOf(comp);
  const lineCount = name ? name.split('\n').length : 1;
  const tagOffset = placedOffset(comp?.tagOffset) || automaticTagOffset(comp?.rotation, box, !!name);
  const nameOffset = placedOffset(comp?.nameOffset) || automaticNameOffset(comp?.rotation, box, lineCount, style.size);
  const originX = Number(comp?.x) || 0;
  const originY = Number(comp?.y) || 0;
  return {
    tag,
    name,
    tagX: originX + tagOffset.x,
    tagY: originY + tagOffset.y,
    nameX: originX + nameOffset.x,
    nameY: originY + nameOffset.y,
    nameStyle: style
  };
}

// nameY is the middle of the whole block. Extra lines hang below the first one
// when the name is still in its automatic place.
export function nameLinePositions(comp, def) {
  const labels = componentLabels(comp, def);
  const style = labels.nameStyle;
  const lines = labels.name ? labels.name.split('\n') : [];
  const lineHeight = nameLineHeight(style.size);
  const block = Math.max(lines.length, 1) * lineHeight;
  const firstY = labels.nameY - block / 2 + lineHeight / 2;
  return {
    labels,
    style,
    font: nameFont(style),
    lineHeight,
    lines: lines.map((text, index) => ({
      text,
      x: labels.nameX,
      y: firstY + index * lineHeight
    }))
  };
}

function estimateWidth(text, fontPx) {
  return String(text || '').length * fontPx * 0.62;
}

// The anchor is the right edge. The text grows to the left.
export function textHitBox(anchorX, anchorY, text, font, measureText, fontPx) {
  const width = Math.max(
    measureText ? measureText(text, font) : estimateWidth(text, fontPx),
    16
  );
  return {
    minX: anchorX - width - 4,
    minY: anchorY - 8,
    maxX: anchorX + 4,
    maxY: anchorY + 8
  };
}

function contains(box, x, y) {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

export function nameHitBox(comp, def, measureText) {
  const layout = nameLinePositions(comp, def);
  if (!layout.lines.length) return null;
  const widths = layout.lines.map(line => (
    measureText ? measureText(line.text || ' ', layout.font) : estimateWidth(line.text, layout.style.size)
  ));
  const width = Math.max(...widths, 16);
  const anchorX = layout.labels.nameX;
  const top = layout.lines[0].y - layout.lineHeight / 2;
  const bottom = layout.lines[layout.lines.length - 1].y + layout.lineHeight / 2;
  let minX = anchorX - width - 4;
  let maxX = anchorX + 4;
  if (layout.style.align === 'left') {
    minX = anchorX - 4;
    maxX = anchorX + width + 4;
  } else if (layout.style.align === 'center') {
    minX = anchorX - width / 2 - 4;
    maxX = anchorX + width / 2 + 4;
  }
  return { minX, minY: top - 2, maxX, maxY: bottom + 2 };
}

export function labelPartAt(comp, def, worldX, worldY, measureText) {
  const labels = componentLabels(comp, def);
  const hits = [];
  if (labels.tag) {
    const box = textHitBox(labels.tagX, labels.tagY, labels.tag, TAG_FONT, measureText, 11);
    if (contains(box, worldX, worldY)) hits.push({ part: 'tag', box, x: labels.tagX, y: labels.tagY });
  }
  const nameBox = nameHitBox(comp, def, measureText);
  if (nameBox && contains(nameBox, worldX, worldY)) {
    hits.push({ part: 'name', box: nameBox, x: labels.nameX, y: labels.nameY });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => Math.hypot(worldX - a.x, worldY - a.y) - Math.hypot(worldX - b.x, worldY - b.y));
  return { part: hits[0].part, labels, box: hits[0].box };
}
