// Piece rotation on the sheet. Electrical drawings turn in quarter steps.
// Canvas Y grows downward, so 90° is a clockwise turn on screen.

export function normalizeRotation(degrees) {
  const value = Number(degrees) || 0;
  const steps = Math.round(value / 90);
  return ((steps % 4) + 4) % 4 * 90;
}

export function nextRotation(degrees) {
  return normalizeRotation(normalizeRotation(degrees) + 90);
}

export function rotateOffset(x, y, degrees) {
  const turn = normalizeRotation(degrees);
  if (turn === 90) return { x: -y, y: x };
  if (turn === 180) return { x: -x, y: -y };
  if (turn === 270) return { x: y, y: -x };
  return { x, y };
}

export function unrotateOffset(x, y, degrees) {
  return rotateOffset(x, y, (360 - normalizeRotation(degrees)) % 360);
}

export function worldToLocal(comp, worldX, worldY) {
  return unrotateOffset(worldX - (comp?.x || 0), worldY - (comp?.y || 0), comp?.rotation || 0);
}

export function pinWorld(comp, pin) {
  const local = rotateOffset(pin?.x || 0, pin?.y || 0, comp?.rotation || 0);
  return { x: (comp?.x || 0) + local.x, y: (comp?.y || 0) + local.y };
}

export function rotatedBounds(box, degrees) {
  const corners = [
    rotateOffset(box.minX, box.minY, degrees),
    rotateOffset(box.maxX, box.minY, degrees),
    rotateOffset(box.maxX, box.maxY, degrees),
    rotateOffset(box.minX, box.maxY, degrees)
  ];
  return {
    minX: Math.min(...corners.map(point => point.x)),
    minY: Math.min(...corners.map(point => point.y)),
    maxX: Math.max(...corners.map(point => point.x)),
    maxY: Math.max(...corners.map(point => point.y))
  };
}

export function nominalBox(def) {
  const halfW = (def?.width || 40) / 2;
  const halfH = (def?.height || 50) / 2;
  return { minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH };
}

// Keep each cable end on the terminal it was tied to.
// A hand-routed cable, or one that already has a junction, keeps its corners.
export function reanchorWire(wire, components, definitionFor) {
  if (!Array.isArray(wire?.waypoints) || wire.waypoints.length < 2) return wire;

  const fromComp = wire.from?.compId ? components.find(comp => comp.id === wire.from.compId) : null;
  const toComp = wire.to?.compId ? components.find(comp => comp.id === wire.to.compId) : null;
  const fromPin = fromComp
    ? (definitionFor(fromComp)?.pins || []).find(pin => pin.id === wire.from.pinId)
    : null;
  const toPin = toComp
    ? (definitionFor(toComp)?.pins || []).find(pin => pin.id === wire.to.pinId)
    : null;
  const start = fromPin ? pinWorld(fromComp, fromPin) : null;
  const end = toPin ? pinWorld(toComp, toPin) : null;
  if (!start && !end) return wire;

  const waypoints = wire.waypoints.map(point => ({ x: point.x, y: point.y }));
  const oldStart = waypoints[0];
  const oldMiddle = waypoints.length === 3 ? waypoints[1] : null;
  if (start) waypoints[0] = { x: start.x, y: start.y };
  if (end) waypoints[waypoints.length - 1] = { x: end.x, y: end.y };

  if (!wire.manual && oldMiddle && start && end && waypoints.length === 3) {
    const verticalFirst = Math.abs(oldMiddle.x - oldStart.x) <= Math.abs(oldMiddle.y - oldStart.y);
    waypoints[1] = verticalFirst
      ? { x: waypoints[0].x, y: waypoints[2].y }
      : { x: waypoints[2].x, y: waypoints[0].y };
  }

  return { ...wire, waypoints };
}
