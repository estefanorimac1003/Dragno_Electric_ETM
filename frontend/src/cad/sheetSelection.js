// Marquee on the schematic. A dragged rectangle keeps every piece and cable it covers.

import { rotatedBounds } from './componentPose';
import { symbolHitBox } from './symbolStore';

export function normalizeRect(x1, y1, x2, y2) {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2)
  };
}

export function componentWorldBox(comp, def) {
  const local = symbolHitBox(def);
  const spun = rotatedBounds(local, comp?.rotation || 0);
  const x = comp?.x || 0;
  const y = comp?.y || 0;
  return {
    minX: x + spun.minX,
    minY: y + spun.minY,
    maxX: x + spun.maxX,
    maxY: y + spun.maxY
  };
}

export function boxesOverlap(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// A cable counts when it crosses the margin, ends inside it, or runs along an edge.
export function segmentHitsRect(start, end, rect) {
  if (!start || !end || !rect) return false;
  const left = 1;
  const right = 2;
  const above = 4;
  const below = 8;
  const code = (point) => {
    let bits = 0;
    if (point.x < rect.minX) bits |= left;
    else if (point.x > rect.maxX) bits |= right;
    if (point.y < rect.minY) bits |= above;
    else if (point.y > rect.maxY) bits |= below;
    return bits;
  };
  let a = { x: start.x, y: start.y };
  let b = { x: end.x, y: end.y };
  let codeA = code(a);
  let codeB = code(b);
  for (let step = 0; step < 8; step += 1) {
    if (!(codeA | codeB)) return true;
    if (codeA & codeB) return false;
    const outside = codeA || codeB;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let x = a.x;
    let y = a.y;
    if (outside & below) {
      y = rect.maxY;
      x = a.x + dx * (y - a.y) / dy;
    } else if (outside & above) {
      y = rect.minY;
      x = a.x + dx * (y - a.y) / dy;
    } else if (outside & right) {
      x = rect.maxX;
      y = a.y + dy * (x - a.x) / dx;
    } else {
      x = rect.minX;
      y = a.y + dy * (x - a.x) / dx;
    }
    if (outside === codeA) {
      a = { x, y };
      codeA = code(a);
    } else {
      b = { x, y };
      codeB = code(b);
    }
  }
  return !(codeA | codeB);
}

export function itemsInRect(components, wires, rect, definitionFor) {
  const box = normalizeRect(rect.x1, rect.y1, rect.x2, rect.y2);
  const hits = [];
  (components || []).forEach(comp => {
    const def = typeof definitionFor === 'function' ? definitionFor(comp) : null;
    if (boxesOverlap(componentWorldBox(comp, def), box)) {
      hits.push({ type: 'component', id: comp.id });
    }
  });
  (wires || []).forEach(wire => {
    const points = wire?.waypoints || [];
    for (let index = 1; index < points.length; index += 1) {
      if (segmentHitsRect(points[index - 1], points[index], box)) {
        hits.push({ type: 'wire', id: wire.id });
        break;
      }
    }
  });
  return hits;
}
