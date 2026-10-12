// Pure geometry for the piece editor. No DOM, so the schematic and the DXF
// export can share the same outlines as the interactive canvas.

let sequence = 1;

export function uid(prefix = 'id') {
  sequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}`;
}

export function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function finePoint(point) {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100
  };
}

export function snapGrid(point, step) {
  const size = step || 1;
  return {
    x: Math.round(point.x / size) * size,
    y: Math.round(point.y / size) * size
  };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function linePoints(prim) {
  if (Array.isArray(prim.points) && prim.points.length >= 2) {
    return prim.points.map(point => ({ x: point.x, y: point.y }));
  }
  return [
    { x: Number(prim.x1) || 0, y: Number(prim.y1) || 0 },
    { x: Number(prim.x2) || 0, y: Number(prim.y2) || 0 }
  ];
}

// Lock a point to the horizontal or vertical axis through an anchor node.
// The larger travel wins, so the segment stays perfectly flat or upright.
export function axisLock(anchor, point) {
  if (!anchor || !point) return point;
  const dx = Math.abs(point.x - anchor.x);
  const dy = Math.abs(point.y - anchor.y);
  if (dx >= dy) {
    if (Math.abs(point.y - anchor.y) < 0.02) return point;
    return { ...point, y: anchor.y, kind: 'ortho' };
  }
  if (Math.abs(point.x - anchor.x) < 0.02) return point;
  return { ...point, x: anchor.x, kind: 'ortho' };
}

// The vertex a line node is attached to. The previous point is the grip;
// the first vertex uses the next point.
export function lineNeighbor(prim, index) {
  const points = linePoints(prim);
  if (index > 0 && points[index - 1]) return { x: points[index - 1].x, y: points[index - 1].y };
  if (points[index + 1]) return { x: points[index + 1].x, y: points[index + 1].y };
  return null;
}

export function applyLinePoints(prim, points) {
  return {
    ...prim,
    points: points.map(point => ({ x: point.x, y: point.y })),
    x1: points[0].x,
    y1: points[0].y,
    x2: points[points.length - 1].x,
    y2: points[points.length - 1].y
  };
}

export function rectCorners(prim) {
  return [
    { x: prim.x, y: prim.y },
    { x: prim.x + prim.width, y: prim.y },
    { x: prim.x + prim.width, y: prim.y + prim.height },
    { x: prim.x, y: prim.y + prim.height }
  ];
}

export function rectFromCorner(prim, index, point) {
  const opposite = rectCorners(prim)[(index + 2) % 4];
  return {
    ...prim,
    x: Math.min(point.x, opposite.x),
    y: Math.min(point.y, opposite.y),
    width: Math.max(0.4, Math.abs(point.x - opposite.x)),
    height: Math.max(0.4, Math.abs(point.y - opposite.y))
  };
}

export const DEFAULT_LAYERS = [
  { id: 'geom', name: 'Geometría', visible: true, locked: false },
  { id: 'anotacion', name: 'Anotación', visible: true, locked: false }
];

export function layerState(layers, layerId) {
  if (!layerId) return { visible: true, locked: false };
  const layer = (layers || []).find(item => item.id === layerId);
  if (!layer) return { visible: true, locked: false };
  return { visible: layer.visible !== false, locked: !!layer.locked };
}

function rotateLocal(dx, dy, rotation) {
  const cos = Math.cos(rotation || 0);
  const sin = Math.sin(rotation || 0);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

export function ellipsePoint(prim, angle) {
  const local = rotateLocal(Math.cos(angle) * prim.rx, Math.sin(angle) * prim.ry, prim.rotation || 0);
  return { x: prim.cx + local.x, y: prim.cy + local.y };
}

export function arcPoint(prim, angle) {
  return {
    x: prim.cx + prim.r * Math.cos(angle),
    y: prim.cy + prim.r * Math.sin(angle)
  };
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
  };
}

export function bezierSegments(prim) {
  const nodes = prim.nodes || [];
  if (nodes.length < 2) return [];
  const count = prim.closed ? nodes.length : nodes.length - 1;
  const segments = [];
  for (let index = 0; index < count; index += 1) {
    const start = nodes[index];
    const end = nodes[(index + 1) % nodes.length];
    const c1 = start.outX == null ? start : { x: start.outX, y: start.outY };
    const c2 = end.inX == null ? end : { x: end.inX, y: end.inY };
    const straight = start.outX == null && end.inX == null;
    segments.push(straight
      ? { type: 'line', a: start, b: end, index }
      : { type: 'cubic', p0: start, p1: c1, p2: c2, p3: end, index });
  }
  return segments;
}

export function sampleSegment(segment, steps = 10) {
  if (segment.type === 'line') return [segment.a, segment.b];
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    points.push(cubicAt(segment.p0, segment.p1, segment.p2, segment.p3, step / steps));
  }
  return points;
}

function polylineFrom(prim) {
  if (prim.type === 'line') {
    const points = linePoints(prim);
    return prim.closed && points.length > 2 ? [...points, points[0]] : points;
  }
  if (prim.type === 'rect') {
    const corners = rectCorners(prim);
    return [...corners, corners[0]];
  }
  if (prim.type === 'circle') {
    const points = [];
    const steps = 28;
    for (let index = 0; index <= steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      points.push({ x: prim.cx + prim.r * Math.cos(angle), y: prim.cy + prim.r * Math.sin(angle) });
    }
    return points;
  }
  if (prim.type === 'ellipse') {
    const points = [];
    const steps = 32;
    for (let index = 0; index <= steps; index += 1) points.push(ellipsePoint(prim, (index / steps) * Math.PI * 2));
    return points;
  }
  if (prim.type === 'arc') {
    const start = prim.startAngle || 0;
    const end = prim.endAngle ?? Math.PI;
    const steps = 18;
    const points = [];
    for (let index = 0; index <= steps; index += 1) points.push(arcPoint(prim, start + (end - start) * (index / steps)));
    return points;
  }
  if (prim.type === 'bezier') {
    const points = [];
    bezierSegments(prim).forEach(segment => {
      const sampled = sampleSegment(segment, 8);
      if (points.length) sampled.shift();
      points.push(...sampled);
    });
    return points;
  }
  if (prim.type === 'text') return [{ x: prim.x, y: prim.y }];
  return [];
}

export function outlineSegments(prim) {
  const points = polylineFrom(prim);
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push([points[index], points[index + 1]]);
  }
  return segments;
}

export function boundsOf(prim) {
  if (prim.type === 'ellipse') {
    const rot = prim.rotation || 0;
    const ux = prim.rx * Math.cos(rot);
    const uy = prim.rx * Math.sin(rot);
    const vx = -prim.ry * Math.sin(rot);
    const vy = prim.ry * Math.cos(rot);
    const halfW = Math.hypot(ux, vx);
    const halfH = Math.hypot(uy, vy);
    return { minX: prim.cx - halfW, minY: prim.cy - halfH, maxX: prim.cx + halfW, maxY: prim.cy + halfH };
  }
  if (prim.type === 'circle') {
    return { minX: prim.cx - prim.r, minY: prim.cy - prim.r, maxX: prim.cx + prim.r, maxY: prim.cy + prim.r };
  }
  if (prim.type === 'text') {
    const pad = (prim.fontSize || 10) * 0.6;
    return { minX: prim.x - pad, minY: prim.y - pad, maxX: prim.x + pad, maxY: prim.y + pad };
  }
  const points = polylineFrom(prim);
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return { minX, minY, maxX, maxY };
}

export function boundsOfMany(primitives) {
  let box = null;
  primitives.forEach(prim => {
    const next = boundsOf(prim);
    if (!next) return;
    if (!box) box = { ...next };
    else {
      box.minX = Math.min(box.minX, next.minX);
      box.minY = Math.min(box.minY, next.minY);
      box.maxX = Math.max(box.maxX, next.maxX);
      box.maxY = Math.max(box.maxY, next.maxY);
    }
  });
  return box;
}

export function boundsCenter(box) {
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

function projectOnSegment(point, start, end) {
  const lengthSq = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
  if (lengthSq === 0) return { dist: dist(point, start), point: { ...start }, t: 0 };
  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projected = {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y)
  };
  return { dist: dist(point, projected), point: projected, t };
}

export function closestSegment(points, model) {
  let best = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const hit = projectOnSegment(model, points[index], points[index + 1]);
    if (!best || hit.dist < best.dist) best = { ...hit, index };
  }
  return best;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitPrimitive(prim, model, threshold) {
  if (prim.type === 'circle') {
    const distance = dist(model, { x: prim.cx, y: prim.cy });
    if (prim.fill && prim.fill !== 'none') return distance <= prim.r + threshold;
    return Math.abs(distance - prim.r) <= threshold;
  }
  if (prim.type === 'ellipse') {
    const cos = Math.cos(-(prim.rotation || 0));
    const sin = Math.sin(-(prim.rotation || 0));
    const dx = model.x - prim.cx;
    const dy = model.y - prim.cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const value = (lx / prim.rx) ** 2 + (ly / prim.ry) ** 2;
    if (prim.fill && prim.fill !== 'none') return value <= 1.15;
    return Math.abs(value - 1) <= (threshold / Math.max(prim.rx, prim.ry)) * 3;
  }
  if (prim.type === 'rect') {
    const inside = model.x >= prim.x && model.x <= prim.x + prim.width && model.y >= prim.y && model.y <= prim.y + prim.height;
    if (prim.fill && prim.fill !== 'none' && inside) return true;
    return closestSegment([...rectCorners(prim), rectCorners(prim)[0]], model)?.dist <= threshold;
  }
  if (prim.type === 'text') return dist(model, prim) <= threshold + (prim.fontSize || 10) * 0.7;
  if (prim.type === 'bezier') {
    const points = polylineFrom(prim);
    if (prim.closed && prim.fill && prim.fill !== 'none' && pointInPolygon(model, points)) return true;
    return closestSegment(points, model)?.dist <= threshold;
  }
  const points = polylineFrom(prim);
  if (prim.closed && prim.fill && prim.fill !== 'none' && pointInPolygon(model, points)) return true;
  return closestSegment(points, model)?.dist <= threshold;
}

export function primitiveNodes(prim) {
  if (prim.type === 'line') return linePoints(prim).map((point, index) => ({ ...point, kind: 'anchor', index }));
  if (prim.type === 'rect') return rectCorners(prim).map((point, index) => ({ ...point, kind: 'corner', index }));
  if (prim.type === 'circle') {
    return [
      { x: prim.cx, y: prim.cy, kind: 'center', index: 0 },
      { x: prim.cx + prim.r, y: prim.cy, kind: 'radius', index: 1 }
    ];
  }
  if (prim.type === 'ellipse') {
    const rx = ellipsePoint(prim, 0);
    const ry = ellipsePoint(prim, Math.PI / 2);
    return [
      { x: prim.cx, y: prim.cy, kind: 'center', index: 0 },
      { ...rx, kind: 'rx', index: 1 },
      { ...ry, kind: 'ry', index: 2 }
    ];
  }
  if (prim.type === 'arc') {
    return [
      { x: prim.cx, y: prim.cy, kind: 'center', index: 0 },
      { ...arcPoint(prim, prim.startAngle || 0), kind: 'start', index: 1 },
      { ...arcPoint(prim, prim.endAngle ?? Math.PI), kind: 'end', index: 2 }
    ];
  }
  if (prim.type === 'text') return [{ x: prim.x, y: prim.y, kind: 'anchor', index: 0 }];
  if (prim.type === 'bezier') {
    const nodes = [];
    (prim.nodes || []).forEach((node, index) => {
      nodes.push({ x: node.x, y: node.y, kind: 'anchor', index });
      if (node.inX != null) nodes.push({ x: node.inX, y: node.inY, kind: 'handle-in', index });
      if (node.outX != null) nodes.push({ x: node.outX, y: node.outY, kind: 'handle-out', index });
    });
    return nodes;
  }
  return [];
}

export function moveNode(prim, node, point) {
  if (!node) return prim;
  if (prim.type === 'line' && node.kind === 'anchor') {
    const points = linePoints(prim);
    if (!points[node.index]) return prim;
    points[node.index] = { x: point.x, y: point.y };
    return applyLinePoints(prim, points);
  }
  if (prim.type === 'rect' && node.kind === 'corner') return rectFromCorner(prim, node.index, point);
  if (prim.type === 'circle' && node.kind === 'center') return { ...prim, cx: point.x, cy: point.y };
  if (prim.type === 'circle' && node.kind === 'radius') {
    return { ...prim, r: Math.max(0.4, dist(point, { x: prim.cx, y: prim.cy })) };
  }
  if (prim.type === 'ellipse' && node.kind === 'center') return { ...prim, cx: point.x, cy: point.y };
  if (prim.type === 'ellipse' && (node.kind === 'rx' || node.kind === 'ry')) {
    const cos = Math.cos(-(prim.rotation || 0));
    const sin = Math.sin(-(prim.rotation || 0));
    const dx = point.x - prim.cx;
    const dy = point.y - prim.cy;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    if (node.kind === 'rx') return { ...prim, rx: Math.max(0.4, Math.abs(localX)) };
    return { ...prim, ry: Math.max(0.4, Math.abs(localY)) };
  }
  if (prim.type === 'arc' && node.kind === 'center') return { ...prim, cx: point.x, cy: point.y };
  if (prim.type === 'arc' && node.kind === 'start') {
    return {
      ...prim,
      r: Math.max(0.4, dist(point, { x: prim.cx, y: prim.cy })),
      startAngle: Math.atan2(point.y - prim.cy, point.x - prim.cx)
    };
  }
  if (prim.type === 'arc' && node.kind === 'end') {
    return { ...prim, endAngle: Math.atan2(point.y - prim.cy, point.x - prim.cx) };
  }
  if (prim.type === 'text') return { ...prim, x: point.x, y: point.y };
  if (prim.type === 'bezier') {
    const nodes = (prim.nodes || []).map(item => ({ ...item }));
    const current = nodes[node.index];
    if (!current) return prim;
    if (node.kind === 'anchor') {
      const dx = point.x - current.x;
      const dy = point.y - current.y;
      current.x = point.x;
      current.y = point.y;
      if (current.outX != null) {
        current.outX += dx;
        current.outY += dy;
      }
      if (current.inX != null) {
        current.inX += dx;
        current.inY += dy;
      }
    } else if (node.kind === 'handle-out') {
      current.outX = point.x;
      current.outY = point.y;
    } else if (node.kind === 'handle-in') {
      current.inX = point.x;
      current.inY = point.y;
    }
    return { ...prim, nodes };
  }
  return prim;
}

export function insertNode(prim, model) {
  if (prim.type === 'line') {
    const points = linePoints(prim);
    const chain = prim.closed && points.length > 2 ? [...points, points[0]] : points;
    const hit = closestSegment(chain, model);
    if (!hit) return null;
    const next = points.slice();
    next.splice(hit.index + 1, 0, { x: hit.point.x, y: hit.point.y });
    return { prim: applyLinePoints(prim, next), node: { kind: 'anchor', index: hit.index + 1 } };
  }
  if (prim.type === 'bezier') {
    let best = null;
    bezierSegments(prim).forEach(segment => {
      const samples = sampleSegment(segment, 12);
      const hit = closestSegment(samples, model);
      if (!hit) return;
      if (!best || hit.dist < best.dist) best = { ...hit, index: segment.index };
    });
    if (!best) return null;
    const nodes = (prim.nodes || []).map(item => ({ ...item }));
    nodes.splice(best.index + 1, 0, { x: best.point.x, y: best.point.y, inX: null, inY: null, outX: null, outY: null });
    return { prim: { ...prim, nodes }, node: { kind: 'anchor', index: best.index + 1 } };
  }
  return null;
}

export function removeNode(prim, node) {
  if (!node || node.kind !== 'anchor') return null;
  if (prim.type === 'line') {
    const points = linePoints(prim);
    if (points.length <= 2) return { removePrimitive: true };
    points.splice(node.index, 1);
    return { prim: applyLinePoints(prim, points) };
  }
  if (prim.type === 'bezier') {
    const nodes = (prim.nodes || []).slice();
    if (nodes.length <= 2) return { removePrimitive: true };
    nodes.splice(node.index, 1);
    return { prim: { ...prim, nodes } };
  }
  return null;
}

function isAxisAligned(corners) {
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);
    if (dx > 0.08 && dy > 0.08) return false;
  }
  return true;
}

function mapPrimitive(prim, mapPoint) {
  if (prim.type === 'line') return applyLinePoints(prim, linePoints(prim).map(mapPoint));
  if (prim.type === 'rect') {
    const corners = rectCorners(prim).map(mapPoint);
    if (isAxisAligned(corners)) {
      const xs = corners.map(point => point.x);
      const ys = corners.map(point => point.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { ...prim, x: minX, y: minY, width: Math.max(0.4, Math.max(...xs) - minX), height: Math.max(0.4, Math.max(...ys) - minY) };
    }
    return applyLinePoints({ ...prim, type: 'line', closed: true }, [...corners, corners[0]]);
  }
  if (prim.type === 'circle') {
    const center = mapPoint({ x: prim.cx, y: prim.cy });
    const edge = mapPoint({ x: prim.cx + prim.r, y: prim.cy });
    return { ...prim, cx: center.x, cy: center.y, r: Math.max(0.4, dist(center, edge)) };
  }
  if (prim.type === 'ellipse') {
    const rotation = prim.rotation || 0;
    const center = mapPoint({ x: prim.cx, y: prim.cy });
    const axisX = mapPoint({ x: prim.cx + prim.rx * Math.cos(rotation), y: prim.cy + prim.rx * Math.sin(rotation) });
    const axisY = mapPoint({ x: prim.cx - prim.ry * Math.sin(rotation), y: prim.cy + prim.ry * Math.cos(rotation) });
    return {
      ...prim,
      cx: center.x,
      cy: center.y,
      rx: Math.max(0.4, dist(center, axisX)),
      ry: Math.max(0.4, dist(center, axisY)),
      rotation: Math.atan2(axisX.y - center.y, axisX.x - center.x)
    };
  }
  if (prim.type === 'arc') {
    const center = mapPoint({ x: prim.cx, y: prim.cy });
    const start = mapPoint(arcPoint(prim, prim.startAngle || 0));
    const end = mapPoint(arcPoint(prim, prim.endAngle ?? Math.PI));
    return {
      ...prim,
      cx: center.x,
      cy: center.y,
      r: Math.max(0.4, (dist(center, start) + dist(center, end)) / 2),
      startAngle: Math.atan2(start.y - center.y, start.x - center.x),
      endAngle: Math.atan2(end.y - center.y, end.x - center.x)
    };
  }
  if (prim.type === 'bezier') {
    return {
      ...prim,
      nodes: (prim.nodes || []).map(node => {
        const anchor = mapPoint(node);
        const outgoing = node.outX == null ? null : mapPoint({ x: node.outX, y: node.outY });
        const incoming = node.inX == null ? null : mapPoint({ x: node.inX, y: node.inY });
        return {
          x: anchor.x,
          y: anchor.y,
          outX: outgoing ? outgoing.x : null,
          outY: outgoing ? outgoing.y : null,
          inX: incoming ? incoming.x : null,
          inY: incoming ? incoming.y : null
        };
      })
    };
  }
  if (prim.type === 'text') {
    const point = mapPoint({ x: prim.x, y: prim.y });
    return { ...prim, x: point.x, y: point.y };
  }
  return prim;
}

export function translatePrimitive(prim, dx, dy) {
  return mapPrimitive(prim, point => ({ x: point.x + dx, y: point.y + dy }));
}

export function scalePrimitive(prim, origin, sx, sy) {
  const safeX = Math.abs(sx) < 0.04 ? 0.04 * Math.sign(sx || 1) : sx;
  const safeY = Math.abs(sy) < 0.04 ? 0.04 * Math.sign(sy || 1) : sy;
  if (prim.type === 'circle' && Math.abs(Math.abs(safeX) - Math.abs(safeY)) > 0.02) {
    return {
      ...prim,
      type: 'ellipse',
      cx: origin.x + (prim.cx - origin.x) * safeX,
      cy: origin.y + (prim.cy - origin.y) * safeY,
      rx: Math.max(0.4, prim.r * Math.abs(safeX)),
      ry: Math.max(0.4, prim.r * Math.abs(safeY)),
      rotation: 0
    };
  }
  return mapPrimitive(prim, point => ({
    x: origin.x + (point.x - origin.x) * safeX,
    y: origin.y + (point.y - origin.y) * safeY
  }));
}

export function rotatePrimitive(prim, origin, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return mapPrimitive(prim, point => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
  });
}

export function mirrorPoint(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  const footX = start.x + t * dx;
  const footY = start.y + t * dy;
  return { x: 2 * footX - point.x, y: 2 * footY - point.y };
}

export function mirrorPrimitive(prim, start, end) {
  return mapPrimitive(prim, point => mirrorPoint(point, start, end));
}

function segmentIntersection(a, b, c, d) {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-8) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / den;
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function footFromPoint(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return null;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  if (t < 0 || t > 1) return null;
  return { x: start.x + t * dx, y: start.y + t * dy };
}

const SNAP_RANK = { endpoint: 0, center: 1, midpoint: 2, intersection: 3, perpendicular: 4, grid: 5 };

export function resolvePoint(raw, options) {
  const zoom = options.zoom || 1;
  const tolerance = 10 / zoom;
  let best = null;
  const consider = (point, kind) => {
    const distance = dist(raw, point);
    if (distance > tolerance) return;
    const rank = SNAP_RANK[kind] ?? 9;
    if (!best || rank < best.rank || (rank === best.rank && distance < best.distance)) {
      best = { ...finePoint(point), kind, rank, distance };
    }
  };

  if (options.objectSnap !== false) {
    const bags = [];
    (options.primitives || []).forEach(prim => {
      if (!layerState(options.layers, prim.layerId).visible) return;
      if (options.ignoreIds?.includes(prim.id)) return;
      if (prim.type === 'line') {
        linePoints(prim).forEach(point => consider(point, 'endpoint'));
      } else if (prim.type === 'rect') {
        rectCorners(prim).forEach(point => consider(point, 'endpoint'));
      } else if (prim.type === 'bezier') {
        (prim.nodes || []).forEach(point => consider(point, 'endpoint'));
      } else if (prim.type === 'circle' || prim.type === 'arc') {
        consider({ x: prim.cx, y: prim.cy }, 'center');
        consider({ x: prim.cx + prim.r, y: prim.cy }, 'endpoint');
        consider({ x: prim.cx - prim.r, y: prim.cy }, 'endpoint');
        consider({ x: prim.cx, y: prim.cy + prim.r }, 'endpoint');
        consider({ x: prim.cx, y: prim.cy - prim.r }, 'endpoint');
      } else if (prim.type === 'ellipse') {
        consider({ x: prim.cx, y: prim.cy }, 'center');
        consider(ellipsePoint(prim, 0), 'endpoint');
        consider(ellipsePoint(prim, Math.PI / 2), 'endpoint');
        consider(ellipsePoint(prim, Math.PI), 'endpoint');
        consider(ellipsePoint(prim, -Math.PI / 2), 'endpoint');
      } else if (prim.type === 'text') {
        consider({ x: prim.x, y: prim.y }, 'endpoint');
      }
      const points = polylineFrom(prim);
      for (let index = 0; index < points.length - 1; index += 1) {
        consider({
          x: (points[index].x + points[index + 1].x) / 2,
          y: (points[index].y + points[index + 1].y) / 2
        }, 'midpoint');
        bags.push([points[index], points[index + 1]]);
      }
    });
    const cap = Math.min(bags.length, 240);
    for (let i = 0; i < cap; i += 1) {
      for (let j = i + 1; j < cap; j += 1) {
        const hit = segmentIntersection(bags[i][0], bags[i][1], bags[j][0], bags[j][1]);
        if (hit) consider(hit, 'intersection');
      }
    }
    if (options.fromPoint) {
      (options.primitives || []).forEach(prim => {
        if (!layerState(options.layers, prim.layerId).visible) return;
        outlineSegments(prim).forEach(([start, end]) => {
          const foot = footFromPoint(options.fromPoint, start, end);
          if (foot) consider(foot, 'perpendicular');
        });
      });
    }
  }

  if (best) return best;
  if (options.free) return { ...finePoint(raw), kind: 'free' };
  if (options.gridSnap) return { ...snapGrid(raw, options.gridSize), kind: 'grid' };
  return { ...finePoint(raw), kind: 'free' };
}

export function alignTranslation(box, others, dx, dy, tolerance) {
  if (!box) return { dx, dy, guides: [] };
  const moving = {
    minX: box.minX + dx,
    maxX: box.maxX + dx,
    minY: box.minY + dy,
    maxY: box.maxY + dy
  };
  const verticals = [moving.minX, (moving.minX + moving.maxX) / 2, moving.maxX];
  const horizontals = [moving.minY, (moving.minY + moving.maxY) / 2, moving.maxY];
  let bestX = null;
  let bestY = null;
  others.forEach(other => {
    const targetX = [other.minX, (other.minX + other.maxX) / 2, other.maxX];
    const targetY = [other.minY, (other.minY + other.maxY) / 2, other.maxY];
    verticals.forEach((value, index) => {
      targetX.forEach(target => {
        const gap = Math.abs(value - target);
        if (gap <= tolerance && (!bestX || gap < bestX.gap)) bestX = { gap, shift: target - value, at: target, index };
      });
    });
    horizontals.forEach(value => {
      targetY.forEach(target => {
        const gap = Math.abs(value - target);
        if (gap <= tolerance && (!bestY || gap < bestY.gap)) bestY = { gap, shift: target - value, at: target };
      });
    });
  });
  const guides = [];
  let nextX = dx;
  let nextY = dy;
  if (bestX) {
    nextX += bestX.shift;
    guides.push({ x1: bestX.at, y1: Math.min(moving.minY, ...others.map(item => item.minY)) - 20, x2: bestX.at, y2: Math.max(moving.maxY, ...others.map(item => item.maxY)) + 20, axis: 'x' });
  }
  if (bestY) {
    nextY += bestY.shift;
    guides.push({ x1: Math.min(moving.minX, ...others.map(item => item.minX)) - 20, y1: bestY.at, x2: Math.max(moving.maxX, ...others.map(item => item.maxX)) + 20, y2: bestY.at, axis: 'y' });
  }
  return { dx: nextX, dy: nextY, guides };
}

export function selectionHits(primitives, rect) {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  // Dragging left to right keeps only objects fully inside. The other way
  // keeps anything the rectangle touches.
  const windowMode = rect.x2 >= rect.x1;
  return primitives.filter(prim => {
    const box = boundsOf(prim);
    if (!box) return false;
    const inside = box.minX >= left && box.maxX <= right && box.minY >= top && box.maxY <= bottom;
    if (windowMode) return inside;
    if (inside) return true;
    const center = boundsCenter(box);
    if (center.x >= left && center.x <= right && center.y >= top && center.y <= bottom) return true;
    return outlineSegments(prim).some(([start, end]) => segmentIntersectsRect(start, end, left, top, right, bottom));
  }).map(prim => prim.id);
}

function segmentIntersectsRect(start, end, left, top, right, bottom) {
  if ((start.x >= left && start.x <= right && start.y >= top && start.y <= bottom)
    || (end.x >= left && end.x <= right && end.y >= top && end.y <= bottom)) return true;
  const edges = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }]
  ];
  return edges.some(([a, b]) => segmentIntersection(start, end, a, b));
}

function endpointsNear(a, b, tolerance) {
  return dist(a, b) <= tolerance;
}

function tryJoin(first, second, tolerance) {
  const a0 = first[0];
  const a1 = first[first.length - 1];
  const b0 = second[0];
  const b1 = second[second.length - 1];
  if (endpointsNear(a1, b0, tolerance)) return first.concat(second.slice(1));
  if (endpointsNear(a1, b1, tolerance)) return first.concat(second.slice(0, -1).reverse());
  if (endpointsNear(a0, b1, tolerance)) return second.concat(first.slice(1));
  if (endpointsNear(a0, b0, tolerance)) return second.reverse().concat(first.slice(1));
  return null;
}

export function weldLines(primitives, ids) {
  const selected = primitives.filter(prim => ids.includes(prim.id) && prim.type === 'line' && !prim.closed);
  if (selected.length < 2) return { primitives, joined: false };
  let chains = selected.map(prim => ({ prim, points: linePoints(prim) }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < chains.length; i += 1) {
      for (let j = i + 1; j < chains.length; j += 1) {
        const joined = tryJoin(chains[i].points, chains[j].points, 0.8);
        if (!joined) continue;
        chains[i] = { prim: chains[i].prim, points: joined };
        chains.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  if (chains.length === selected.length) return { primitives, joined: false };
  const surviving = new Set(chains.map(chain => chain.prim.id));
  const dropped = new Set(selected.map(prim => prim.id).filter(id => !surviving.has(id)));
  const next = primitives.filter(prim => !dropped.has(prim.id)).map(prim => {
    const chain = chains.find(item => item.prim.id === prim.id);
    return chain ? applyLinePoints(prim, chain.points) : prim;
  });
  return { primitives: next, joined: true };
}

export function handlePositions(box) {
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  return [
    { x: box.minX, y: box.minY },
    { x: midX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: midY },
    { x: box.maxX, y: box.maxY },
    { x: midX, y: box.maxY },
    { x: box.minX, y: box.maxY },
    { x: box.minX, y: midY }
  ];
}
