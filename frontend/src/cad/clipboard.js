// Copy and paste of sheet pieces. Pieces that share a tag stay one device,
// under a new tag, so the copy does not move the original coil or contact.

const SOLVER_FIELDS = ['energized', 'programOutputs', 'programRares', 'programNote', 'spin', 'sequence', 'actuated'];
const PASTE_STEP = 20;

export function tagKey(tag) {
  return String(tag ?? '').trim().toUpperCase();
}

// -K1 belongs to -K. -KM1 belongs to -KM. A tag with no number uses the symbol prefix.
export function tagFamily(tag, fallback = '') {
  const raw = String(tag ?? '').trim();
  const match = raw.match(/^(.*?)(\d+)$/);
  if (match?.[1]) return match[1];
  const spare = String(fallback ?? '').trim();
  return spare || raw;
}

export function nextFreeTag(prefix, used) {
  const head = String(prefix || '').trim() || 'K';
  const folded = head.toUpperCase();
  let number = 1;
  while (used.has(`${folded}${number}`)) number += 1;
  return `${head}${number}`;
}

function freshId(prefix, index) {
  return `${prefix}_${Date.now().toString(36)}_${index.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function selectionItems(selected) {
  if (!selected) return [];
  if (selected.type === 'group') return (selected.items || []).filter(item => item?.id);
  if (selected.type === 'component' || selected.type === 'wire') {
    return [{ type: selected.type, id: selected.id }];
  }
  return [];
}

function storedCopy(component) {
  const copy = JSON.parse(JSON.stringify(component));
  SOLVER_FIELDS.forEach(key => {
    delete copy[key];
  });
  return copy;
}

export function copySelection(sheet, selected, prefixOf = () => '') {
  const wanted = new Set(
    selectionItems(selected)
      .filter(item => item.type === 'component')
      .map(item => item.id)
  );
  if (!wanted.size) return null;
  const components = (sheet?.components || []).filter(comp => wanted.has(comp.id)).map(storedCopy);
  if (!components.length) return null;
  const prefixes = {};
  components.forEach(comp => {
    prefixes[comp.id] = String(prefixOf(comp) || '');
  });
  const wires = (sheet?.wires || []).filter(wire => {
    const fromId = wire?.from?.compId;
    const toId = wire?.to?.compId;
    return fromId && toId && wanted.has(fromId) && wanted.has(toId);
  }).map(wire => JSON.parse(JSON.stringify(wire)));
  return { components, wires, prefixes, generation: 0 };
}

function shiftEnd(end, idMap, dx, dy) {
  if (!end) return null;
  if (end.compId) {
    const compId = idMap.get(end.compId);
    if (!compId) return null;
    return { compId, pinId: end.pinId };
  }
  return {
    x: (Number(end.x) || 0) + dx,
    y: (Number(end.y) || 0) + dy
  };
}

export function pasteCopies(clipboard, existingComponents, step = PASTE_STEP) {
  const source = clipboard?.components || [];
  if (!source.length) return null;
  const generation = (clipboard.generation || 0) + 1;
  const dx = step * generation;
  const dy = step * generation;
  const used = new Set((existingComponents || []).map(comp => tagKey(comp.tag)).filter(Boolean));
  const shared = new Map();
  const idMap = new Map();
  let salt = 0;

  const components = source.map(item => {
    const copy = storedCopy(item);
    const previousId = copy.id;
    salt += 1;
    copy.id = freshId('cmp', salt);
    idMap.set(previousId, copy.id);
    copy.x = (Number(copy.x) || 0) + dx;
    copy.y = (Number(copy.y) || 0) + dy;
    const key = tagKey(copy.tag);
    if (!key) {
      copy.tag = '';
      return copy;
    }
    if (!shared.has(key)) {
      const prefix = tagFamily(copy.tag, clipboard.prefixes?.[previousId]);
      const next = nextFreeTag(prefix, used);
      used.add(tagKey(next));
      shared.set(key, next);
    }
    copy.tag = shared.get(key);
    return copy;
  });

  const wires = (clipboard.wires || []).map(item => {
    const copy = JSON.parse(JSON.stringify(item));
    salt += 1;
    copy.id = freshId('w', salt);
    delete copy.energized;
    const from = shiftEnd(copy.from, idMap, dx, dy);
    const to = shiftEnd(copy.to, idMap, dx, dy);
    if (!from || !to) return null;
    copy.from = from;
    copy.to = to;
    copy.waypoints = (copy.waypoints || []).map(point => ({
      ...point,
      x: (Number(point.x) || 0) + dx,
      y: (Number(point.y) || 0) + dy
    }));
    return copy;
  }).filter(Boolean);

  return { components, wires, generation };
}

function remapSheetEnd(end, idMap) {
  if (!end) return null;
  if (end.compId) {
    const compId = idMap.get(end.compId);
    if (!compId) return null;
    return { compId, pinId: end.pinId };
  }
  if (!Number.isFinite(Number(end.x)) || !Number.isFinite(Number(end.y))) return null;
  return { x: Number(end.x), y: Number(end.y) };
}

// A copied page is its own circuit. Pieces that shared a tag still share one
// tag, and that tag is new so it does not move the original page.
export function duplicateSheetPieces(sheet, existingComponents, prefixOf = () => '') {
  const source = (sheet?.components || []).map(storedCopy);
  const used = new Set((existingComponents || []).map(comp => tagKey(comp.tag)).filter(Boolean));
  const shared = new Map();
  const idMap = new Map();
  let salt = 0;
  const components = source.map(item => {
    const copy = storedCopy(item);
    const previousId = copy.id;
    salt += 1;
    copy.id = freshId('cmp', salt);
    idMap.set(previousId, copy.id);
    const key = tagKey(copy.tag);
    if (!key) {
      copy.tag = '';
      return copy;
    }
    if (!shared.has(key)) {
      const prefix = tagFamily(copy.tag, prefixOf(item));
      const next = nextFreeTag(prefix, used);
      used.add(tagKey(next));
      shared.set(key, next);
    }
    copy.tag = shared.get(key);
    return copy;
  });
  const wires = (sheet?.wires || []).map(item => {
    const copy = JSON.parse(JSON.stringify(item));
    salt += 1;
    copy.id = freshId('w', salt);
    delete copy.energized;
    const from = remapSheetEnd(copy.from, idMap);
    const to = remapSheetEnd(copy.to, idMap);
    if (!from || !to) return null;
    copy.from = from;
    copy.to = to;
    return copy;
  }).filter(Boolean);
  return { components, wires };
}

export function nextCopyTitle(title, titles) {
  const raw = String(title || '').trim() || 'Plano';
  const base = raw.replace(/\s+\(copia(?:\s+\d+)?\)$/i, '').trim() || 'Plano';
  const used = new Set((titles || []).map(item => String(item || '').trim()));
  const first = `${base} (copia)`;
  if (!used.has(first)) return first;
  let number = 2;
  while (used.has(`${base} (copia ${number})`)) number += 1;
  return `${base} (copia ${number})`;
}
