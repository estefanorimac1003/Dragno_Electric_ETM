// Cable geometry for the sheet. A circle belongs only where two cables share a point.
// A segment that merely crosses another has no shared vertex, so it stays a crossing.

import { reanchorWire } from './componentPose';

const EPS = 0.6;

// A cable only steals the grid snap inside this pad. It is shorter than one grid step.
export const WIRE_JOIN_REACH = 6;

export function roundPoint(point) {
  return {
    x: Math.round(Number(point?.x) * 100) / 100,
    y: Math.round(Number(point?.y) * 100) / 100
  };
}

export function samePoint(a, b, eps = EPS) {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function projectOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) {
    return {
      point: { x: start.x, y: start.y },
      t: 0,
      dist: Math.hypot(point.x - start.x, point.y - start.y)
    };
  }
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2;
  t = Math.max(0, Math.min(1, t));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return { point: { x, y }, t, dist: Math.hypot(point.x - x, point.y - y) };
}

export function nearestWirePoint(wires, x, y, threshold) {
  let best = null;
  (wires || []).forEach(wire => {
    const points = wire?.waypoints;
    if (!points || points.length < 2) return;
    for (let index = 0; index < points.length - 1; index += 1) {
      const hit = projectOnSegment({ x, y }, points[index], points[index + 1]);
      if (hit.dist > threshold) continue;
      if (!best || hit.dist < best.dist) {
        best = {
          wire,
          index,
          dist: hit.dist,
          t: hit.t,
          point: roundPoint(hit.point)
        };
      }
    }
  });
  return best;
}

// The grid point and the crosshair are both tried. The closer one wins.
// A hit that sits on an existing corner uses that corner, so the two cables share it.
export function wireJoinAt(wires, raw, snapped, reach = WIRE_JOIN_REACH) {
  const probes = [snapped, raw].filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  let best = null;
  probes.forEach(point => {
    const hit = nearestWirePoint(wires, point.x, point.y, reach);
    if (!hit) return;
    if (!best || hit.dist < best.dist) best = hit;
  });
  if (!best) return null;
  const points = best.wire?.waypoints || [];
  const start = points[best.index];
  const end = points[best.index + 1];
  const nearer = [start, end]
    .filter(Boolean)
    .map(vertex => ({ vertex, dist: Math.hypot(best.point.x - vertex.x, best.point.y - vertex.y) }))
    .sort((a, b) => a.dist - b.dist)[0];
  if (nearer && nearer.dist <= reach) {
    return { ...best, point: roundPoint(nearer.vertex), t: nearer.vertex === start ? 0 : 1 };
  }
  return best;
}

// One click, one corner. Ortho keeps that corner on the stronger axis.
export function cornerPoint(last, target, ortho) {
  const point = roundPoint(target);
  if (!ortho || !last) return point;
  const dx = Math.abs(point.x - last.x);
  const dy = Math.abs(point.y - last.y);
  if (dx <= EPS && dy <= EPS) return roundPoint(last);
  if (dx >= dy) return { x: point.x, y: last.y };
  return { x: last.x, y: point.y };
}

export function simplifyPath(points) {
  const source = (points || []).map(roundPoint).filter((point, index, list) => (
    index === 0 || !samePoint(point, list[index - 1])
  ));
  if (source.length <= 2) return source;
  const kept = [source[0]];
  for (let index = 1; index < source.length - 1; index += 1) {
    const previous = kept[kept.length - 1];
    const point = source[index];
    const next = source[index + 1];
    const vertical = Math.abs(previous.x - point.x) <= EPS && Math.abs(point.x - next.x) <= EPS;
    const horizontal = Math.abs(previous.y - point.y) <= EPS && Math.abs(point.y - next.y) <= EPS;
    if (!vertical && !horizontal) kept.push(point);
  }
  kept.push(source[source.length - 1]);
  return kept;
}

// The last point is the place the user touched. Ortho may insert one elbow before it.
export function routeTo(points, target, ortho) {
  const last = points?.[points.length - 1];
  const end = roundPoint(target);
  if (!last) return [end];
  const aligned = Math.abs(last.x - end.x) <= EPS || Math.abs(last.y - end.y) <= EPS;
  if (!ortho || aligned) return simplifyPath([...points, end]);
  return simplifyPath([...points, { x: last.x, y: end.y }, end]);
}

export function insertWirePoint(wire, point) {
  const spot = roundPoint(point);
  const points = (wire?.waypoints || []).map(item => ({ x: item.x, y: item.y }));
  if (points.length < 2) return wire;
  if (points.some(item => samePoint(item, spot))) {
    return wire.manual ? wire : { ...wire, manual: true };
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const hit = projectOnSegment(spot, points[index], points[index + 1]);
    if (hit.dist > EPS || hit.t <= 0 || hit.t >= 1) continue;
    points.splice(index + 1, 0, spot);
    return { ...wire, waypoints: points, manual: true };
  }
  return wire;
}

export function pointKey(point) {
  const spot = roundPoint(point);
  return `joint:${spot.x}:${spot.y}`;
}

export function wireNodeKey(wire, index, pinKey) {
  const points = wire?.waypoints || [];
  const point = points[index];
  if (!point) return '';
  const last = points.length - 1;
  if (index === 0 && wire.from?.compId && wire.from?.pinId) return pinKey(wire.from.compId, wire.from.pinId);
  if (index === last && wire.to?.compId && wire.to?.pinId) return pinKey(wire.to.compId, wire.to.pinId);
  return pointKey(point);
}

export function wireNodeKeys(wire, pinKey) {
  const points = wire?.waypoints;
  if (!points || points.length < 2) {
    const keys = [];
    if (wire?.from?.compId && wire?.from?.pinId) keys.push(pinKey(wire.from.compId, wire.from.pinId));
    if (wire?.to?.compId && wire?.to?.pinId) keys.push(pinKey(wire.to.compId, wire.to.pinId));
    return keys;
  }
  return points.map((_, index) => wireNodeKey(wire, index, pinKey)).filter(Boolean);
}

// Pins and free ends that share coordinates are the same electrical point.
// A crossing has no vertex there, so the two cables stay apart.
export function bondWireNets(wires, union, pinKey) {
  (wires || []).forEach(wire => {
    const points = wire?.waypoints;
    if (!points || points.length < 2) {
      if (wire?.from?.compId && wire?.from?.pinId && wire?.to?.compId && wire?.to?.pinId) {
        union(pinKey(wire.from.compId, wire.from.pinId), pinKey(wire.to.compId, wire.to.pinId));
      }
      return;
    }
    for (let index = 0; index < points.length; index += 1) {
      const node = wireNodeKey(wire, index, pinKey);
      const joint = pointKey(points[index]);
      if (node && joint && node !== joint) union(node, joint);
      if (index === 0) continue;
      const previous = wireNodeKey(wire, index - 1, pinKey);
      if (previous && node) union(previous, node);
    }
  });
}

function shiftPoint(point, dx, dy) {
  return {
    x: Math.round((Number(point?.x) + dx) * 100) / 100,
    y: Math.round((Number(point?.y) + dy) * 100) / 100
  };
}

function shiftAnchor(anchor, dx, dy) {
  if (!anchor) return anchor;
  if (anchor.compId) return { ...anchor };
  if (!Number.isFinite(Number(anchor.x)) || !Number.isFinite(Number(anchor.y))) return { ...anchor };
  return shiftPoint(anchor, dx, dy);
}

// Move a marked cable with the selection. A pinned end keeps its borne.
export function translateWireGeometry(wire, delta) {
  const dx = Number(delta?.x) || 0;
  const dy = Number(delta?.y) || 0;
  return {
    ...wire,
    waypoints: (wire?.waypoints || []).map(point => shiftPoint(point, dx, dy)),
    from: shiftAnchor(wire?.from, dx, dy),
    to: shiftAnchor(wire?.to, dx, dy)
  };
}

// Marked pieces and marked cables move together. A cable left out of the
// selection still follows only by its pinned ends.
export function applySelectionMove(components, wires, componentMoves, wireMoves, definitionFor) {
  const byId = new Map((componentMoves || []).filter(item => item?.id).map(item => [item.id, item]));
  const wireById = new Map((wireMoves || []).filter(item => item?.id).map(item => [item.id, item]));
  const movedIds = new Set(byId.keys());
  const nextComponents = (components || []).map(comp => {
    const move = byId.get(comp.id);
    return move ? { ...comp, x: move.x, y: move.y } : comp;
  });
  const lookup = typeof definitionFor === 'function' ? definitionFor : () => null;
  const nextWires = (wires || []).map(wire => {
    const movedWire = wireById.get(wire?.id);
    let next = wire;
    if (movedWire) {
      next = {
        ...wire,
        waypoints: movedWire.waypoints || wire.waypoints,
        from: movedWire.from ?? wire.from,
        to: movedWire.to ?? wire.to
      };
    }
    const followsPiece = movedIds.has(next?.from?.compId) || movedIds.has(next?.to?.compId);
    if (followsPiece || movedWire) return reanchorWire(next, nextComponents, lookup);
    return next;
  });
  return { components: nextComponents, wires: nextWires };
}

export function junctionPoints(wires) {
  const groups = new Map();
  (wires || []).forEach(wire => {
    const points = wire?.waypoints;
    if (!points || !wire?.id) return;
    const seen = new Set();
    points.forEach(point => {
      const key = pointKey(point);
      if (seen.has(key)) return;
      seen.add(key);
      const group = groups.get(key) || { ...roundPoint(point), wireIds: [] };
      group.wireIds.push(wire.id);
      groups.set(key, group);
    });
  });
  return [...groups.values()].filter(group => group.wireIds.length >= 2);
}
