// Block program of one piece. Blocks carry values. Wires join an output to an input.

export const BLOCK_W = 180;
export const BLOCK_H = 86;

const TYPES = new Set(['const', 'var', 'input', 'output', 'not', 'and', 'or', 'actuated']);

export function emptyProgram() {
  return { blocks: [], wires: [] };
}

export function portsOf(block) {
  if (!block) return { inputs: [], outputs: [] };
  if (block.type === 'const' || block.type === 'input' || block.type === 'actuated') {
    return { inputs: [], outputs: ['out'] };
  }
  if (block.type === 'var' || block.type === 'not') return { inputs: ['in'], outputs: ['out'] };
  if (block.type === 'output') return { inputs: ['in'], outputs: [] };
  if (block.type === 'and' || block.type === 'or') return { inputs: ['a', 'b'], outputs: ['out'] };
  return { inputs: [], outputs: [] };
}

export function blockKindTitle(block) {
  if (block?.type === 'actuated') return String(block.name || '').trim() || 'Pieza';
  if (block?.type === 'output' && block.rare) return 'Salida rara';
  const titles = {
    const: 'Constante',
    var: 'Variable',
    input: 'Entrada',
    output: 'Salida',
    not: 'NOT',
    and: 'AND',
    or: 'OR'
  };
  return titles[block?.type] || 'Bloque';
}

export function portPoint(block, direction, port) {
  const names = direction === 'in' ? portsOf(block).inputs : portsOf(block).outputs;
  const index = Math.max(0, names.indexOf(port));
  const count = Math.max(1, names.length);
  return {
    x: direction === 'in' ? block.x : block.x + BLOCK_W,
    y: block.y + ((index + 1) / (count + 1)) * BLOCK_H
  };
}

export function wirePath(x1, y1, x2, y2) {
  const bend = Math.max(36, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function cleanBlock(raw) {
  if (!raw || !TYPES.has(raw.type) || !raw.id) return null;
  const type = raw.type;
  return {
    id: String(raw.id),
    type,
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 48,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 48,
    value: raw.value == null ? (type === 'const' ? '0' : '') : String(raw.value),
    name: raw.name == null ? '' : String(raw.name),
    pinId: raw.pinId ? String(raw.pinId) : '',
    rare: type === 'output' && raw.rare === true
  };
}

export function normalizeProgram(raw) {
  const blocks = [];
  const seen = new Set();
  (Array.isArray(raw?.blocks) ? raw.blocks : []).forEach(item => {
    const block = cleanBlock(item);
    if (!block || seen.has(block.id)) return;
    seen.add(block.id);
    blocks.push(block);
  });
  const wires = [];
  const wireIds = new Set();
  (Array.isArray(raw?.wires) ? raw.wires : []).forEach(item => {
    if (!item?.id || wireIds.has(String(item.id))) return;
    const source = blocks.find(block => block.id === item.from?.blockId);
    const target = blocks.find(block => block.id === item.to?.blockId);
    if (!source || !target) return;
    if (source.type === 'actuated' && item.from?.port === 'false') return;
    const fromPort = source.type === 'actuated' ? 'out' : item.from?.port;
    if (!portsOf(source).outputs.includes(fromPort)) return;
    if (!portsOf(target).inputs.includes(item.to?.port)) return;
    wireIds.add(String(item.id));
    wires.push({
      id: String(item.id),
      from: { blockId: source.id, port: fromPort },
      to: { blockId: target.id, port: item.to.port }
    });
  });
  return { blocks, wires };
}

export function addBlock(program, spec, at = {}) {
  const source = normalizeProgram(program);
  if (!TYPES.has(spec?.type)) return source;
  const count = source.blocks.length;
  const rare = spec.type === 'output' && spec.rare === true;
  const same = source.blocks.filter(block => block.type === spec.type && !!block.rare === rare).length + 1;
  source.blocks.push({
    id: nextId('blk'),
    type: spec.type,
    x: Number.isFinite(at.x) ? at.x : 64 + (count % 5) * 28,
    y: Number.isFinite(at.y) ? at.y : 56 + (count % 7) * 22,
    value: spec.type === 'const' ? '0' : '',
    name: spec.type === 'actuated'
      ? (String(spec.name || '').trim() || 'Pieza')
      : (spec.type === 'var' ? `V${same}` : (rare ? `R${same}` : '')),
    pinId: '',
    rare
  });
  return source;
}

export function moveBlock(program, id, x, y) {
  return updateBlock(program, id, { x: Math.max(16, x), y: Math.max(16, y) });
}

export function updateBlock(program, id, patch) {
  const source = normalizeProgram(program);
  source.blocks = source.blocks.map(block => {
    if (block.id !== id) return block;
    const next = { ...block };
    if (patch.value !== undefined) next.value = String(patch.value);
    if (patch.name !== undefined) next.name = String(patch.name);
    if (patch.pinId !== undefined) next.pinId = patch.pinId ? String(patch.pinId) : '';
    if (patch.x !== undefined) next.x = Number(patch.x);
    if (patch.y !== undefined) next.y = Number(patch.y);
    if (patch.rare !== undefined && block.type === 'output') next.rare = patch.rare === true;
    if (next.type !== 'output') next.rare = false;
    return next;
  });
  return source;
}

export function removeBlock(program, id) {
  const source = normalizeProgram(program);
  return {
    blocks: source.blocks.filter(block => block.id !== id),
    wires: source.wires.filter(wire => wire.from.blockId !== id && wire.to.blockId !== id)
  };
}

export function removeWire(program, id) {
  const source = normalizeProgram(program);
  return { ...source, wires: source.wires.filter(wire => wire.id !== id) };
}

function reaches(wires, start, goal) {
  const next = new Map();
  wires.forEach(wire => {
    const list = next.get(wire.from.blockId) || [];
    list.push(wire.to.blockId);
    next.set(wire.from.blockId, list);
  });
  const stack = [start];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === goal) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    (next.get(id) || []).forEach(item => stack.push(item));
  }
  return false;
}

export function connectBlocks(program, from, to) {
  const source = normalizeProgram(program);
  const origin = source.blocks.find(block => block.id === from?.blockId);
  const target = source.blocks.find(block => block.id === to?.blockId);
  if (!origin || !target) return { program: source, error: 'El bloque ya no está.' };
  if (!portsOf(origin).outputs.includes(from.port)) return { program: source, error: 'Ese punto no es una salida.' };
  if (!portsOf(target).inputs.includes(to.port)) return { program: source, error: 'Une la salida con una entrada.' };
  if (reaches(source.wires, target.id, origin.id)) {
    return { program: source, error: 'Esa unión se cierra sobre sí misma.' };
  }
  const wires = source.wires.filter(wire => !(wire.to.blockId === target.id && wire.to.port === to.port));
  const same = wires.some(wire => wire.from.blockId === origin.id && wire.from.port === from.port && wire.to.blockId === target.id && wire.to.port === to.port);
  if (!same) {
    wires.push({
      id: nextId('wire'),
      from: { blockId: origin.id, port: from.port },
      to: { blockId: target.id, port: to.port }
    });
  }
  return { program: { ...source, wires }, error: '' };
}

function actuationTitle(name) {
  const line = String(name || '').split('\n').map(item => item.trim()).find(Boolean);
  return line || 'Pieza';
}

// One block carries the piece name. Its output is the mouse state.
export function withActuatedBlock(program, name) {
  const title = actuationTitle(name);
  const source = normalizeProgram(program);
  const found = source.blocks.filter(block => block.type === 'actuated');
  const splitPort = Array.isArray(program?.wires) && program.wires.some(wire => (
    (wire?.from?.port === 'true' || wire?.from?.port === 'false')
    && found.some(block => block.id === wire.from?.blockId)
  ));
  if (found.length === 1 && found[0].name === title && program?.blocks && !splitPort) return program;
  const blocks = source.blocks.filter(block => block.type !== 'actuated');
  blocks.unshift(found[0]
    ? { ...found[0], name: title }
    : {
      id: 'blk_actuated',
      type: 'actuated',
      x: 40,
      y: 36,
      value: '',
      name: title,
      pinId: '',
      rare: false
    });
  const ids = new Set(blocks.map(block => block.id));
  return {
    blocks,
    wires: source.wires.filter(wire => ids.has(wire.from.blockId) && ids.has(wire.to.blockId))
  };
}

export function stripActuatedBlocks(program) {
  const source = normalizeProgram(program);
  if (!source.blocks.some(block => block.type === 'actuated')) return program?.blocks ? program : source;
  const blocks = source.blocks.filter(block => block.type !== 'actuated');
  const ids = new Set(blocks.map(block => block.id));
  return {
    blocks,
    wires: source.wires.filter(wire => ids.has(wire.from.blockId) && ids.has(wire.to.blockId))
  };
}

export function constantIsOn(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  return !['0', 'false', 'falso', 'no', 'off', 'apagado'].includes(text);
}

export function hasBlockProgram(def) {
  const program = normalizeProgram(def?.program);
  if (!program.blocks.some(block => block.type === 'output') && !program.wires.length) return false;
  return true;
}

// The saved graph already uses the piece name as a block. On the sheet that
// block is the mouse, and each Entrada stays the borne the user assigned.
export function programWiresHand(program) {
  const source = normalizeProgram(program);
  const ids = new Set(source.blocks.filter(block => block.type === 'actuated').map(block => block.id));
  if (!ids.size) return false;
  return source.wires.some(wire => ids.has(wire.from.blockId));
}

// Saved graphs ignore block position. A drag must not look like a new logic.
export function programLogicKey(program) {
  const source = normalizeProgram(program);
  return JSON.stringify({
    blocks: source.blocks.map(block => ({
      id: block.id,
      type: block.type,
      value: block.value,
      name: block.name,
      pinId: block.pinId,
      rare: block.rare
    })),
    wires: source.wires
  });
}

export function resolvePinId(pins, pinId) {
  const text = String(pinId ?? '').trim();
  if (!text) return '';
  const list = Array.isArray(pins) ? pins : [];
  const byId = list.find(pin => String(pin.id) === text);
  if (byId) return String(byId.id);
  const folded = text.toLowerCase();
  const byLabel = list.find(pin => String(pin.label || '').trim().toLowerCase() === folded);
  return byLabel ? String(byLabel.id) : '';
}

// A two-terminal contact can leave the bornes empty. Entrada takes the first
// terminal and Salida the second, so the drawn wire has a real path.
function bindOpenTerminals(program, pins) {
  const list = Array.isArray(pins) ? pins : [];
  if (list.length !== 2) return program;
  const inputs = program.blocks.filter(block => block.type === 'input');
  const outputs = program.blocks.filter(block => block.type === 'output' && !block.rare);
  if (inputs.length !== 1 || outputs.length !== 1) return program;
  if (resolvePinId(list, inputs[0].pinId) || resolvePinId(list, outputs[0].pinId)) return program;
  return {
    ...program,
    blocks: program.blocks.map(block => {
      if (block.id === inputs[0].id) return { ...block, pinId: String(list[0].id) };
      if (block.id === outputs[0].id) return { ...block, pinId: String(list[1].id) };
      return block;
    })
  };
}

function programForPiece(def) {
  const program = normalizeProgram(def?.program);
  const role = def?.role;
  if (role === 'switch' || role === 'contact' || role === 'passive') {
    return bindOpenTerminals(program, def?.pins);
  }
  return program;
}

// Salida bornes the logic owns. Those pins no longer use the factory contact.
export function programOwnedPins(def) {
  const owned = new Set();
  const pins = def?.pins || [];
  programForPiece(def).blocks.forEach(block => {
    if (block.type !== 'output' || block.rare) return;
    const id = resolvePinId(pins, block.pinId);
    if (id) owned.add(id);
  });
  return owned;
}

function evaluationOrder(program) {
  const indeg = new Map(program.blocks.map(block => [block.id, 0]));
  const nextIds = new Map();
  program.wires.forEach(wire => {
    indeg.set(wire.to.blockId, (indeg.get(wire.to.blockId) || 0) + 1);
    const list = nextIds.get(wire.from.blockId) || [];
    list.push(wire.to.blockId);
    nextIds.set(wire.from.blockId, list);
  });
  const queue = program.blocks.filter(block => indeg.get(block.id) === 0).map(block => block.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (nextIds.get(id) || []).forEach(next => {
      indeg.set(next, indeg.get(next) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    });
  }
  program.blocks.forEach(block => {
    if (!order.includes(block.id)) order.push(block.id);
  });
  return order;
}

// Editor preview only. A forced Entrada reads as positive so the window can
// show the logic result. It does not feed the sheet and it does not save.
export function previewBlockValues(program, options = {}) {
  const source = normalizeProgram(program);
  const forced = new Set(Array.isArray(options.forcedInputIds) ? options.forcedInputIds : []);
  const byId = new Map(source.blocks.map(block => [block.id, block]));
  const incoming = new Map();
  source.wires.forEach(wire => {
    const list = incoming.get(wire.to.blockId) || [];
    list.push(wire);
    incoming.set(wire.to.blockId, list);
  });
  const readIn = (values, blockId, port) => (
    (incoming.get(blockId) || []).some(wire => wire.to.port === port && values.get(wire.from.blockId) === true)
  );
  const compute = (values, block) => {
    if (block.type === 'const') return constantIsOn(block.value);
    if (block.type === 'actuated') return options.actuated === true;
    if (block.type === 'input') return forced.has(block.id);
    if (block.type === 'var') {
      const key = block.name.trim().toUpperCase();
      if (key && values.has(`var:${key}`)) return values.get(`var:${key}`) === true;
      return readIn(values, block.id, 'in');
    }
    if (block.type === 'not') return !readIn(values, block.id, 'in');
    if (block.type === 'and') return readIn(values, block.id, 'a') && readIn(values, block.id, 'b');
    if (block.type === 'or') return readIn(values, block.id, 'a') || readIn(values, block.id, 'b');
    if (block.type === 'output') return readIn(values, block.id, 'in');
    return false;
  };
  const order = evaluationOrder(source);
  const values = new Map();
  const computeAll = () => {
    order.forEach(id => values.set(id, compute(values, byId.get(id))));
  };
  computeAll();
  const localShared = new Map();
  source.blocks.filter(block => block.type === 'var' && block.name.trim()).forEach(block => {
    const key = block.name.trim().toUpperCase();
    localShared.set(key, localShared.get(key) === true || values.get(block.id) === true);
  });
  localShared.forEach((on, key) => values.set(`var:${key}`, on));
  computeAll();
  const live = {};
  source.blocks.forEach(block => {
    live[block.id] = values.get(block.id) === true;
  });
  return live;
}

// Runs the block graph when a real source already feeds the piece.
// A loose piece has no voltage to repeat, so it cannot send a signal.
// A source (origin) may emit its own potential from a constant.
export function evaluateProgram(program, options = {}) {
  const prepared = normalizeProgram(program);
  const source = options.bindOpenPins === false
    ? prepared
    : bindOpenTerminals(prepared, options.pins);
  const pinOn = typeof options.pinOn === 'function' ? options.pinOn : () => false;
  const pinIdOf = (pinId) => resolvePinId(options.pins, pinId) || (options.pins ? '' : String(pinId || ''));
  const physicalPins = Array.isArray(options.pins) ? options.pins : [];
  const anyPinLive = physicalPins.length
    ? physicalPins.some(pin => pinOn(pin.id))
    : source.blocks.some(block => block.type === 'input' && pinOn(pinIdOf(block.pinId)));
  // A source may emit before any other pin is live. Every other piece waits
  // for a real signal and must not invent one.
  if (!anyPinLive && options.origin !== true) {
    return { bridges: [], rares: [], vars: [], waiting: true, fed: false };
  }

  const byId = new Map(source.blocks.map(block => [block.id, block]));
  const incoming = new Map();
  source.wires.forEach(wire => {
    const list = incoming.get(wire.to.blockId) || [];
    list.push(wire);
    incoming.set(wire.to.blockId, list);
  });
  const readIn = (values, blockId, port) => (
    (incoming.get(blockId) || []).some(wire => wire.to.port === port && values.get(wire.from.blockId) === true)
  );
  const compute = (values, block) => {
    if (block.type === 'const') return constantIsOn(block.value);
    if (block.type === 'actuated') return options.actuated === true;
    if (block.type === 'input') {
      const id = pinIdOf(block.pinId);
      const live = !!(id && pinOn(id));
      if (!live) return false;
      // The borne carries the source. A contact adds its own open or closed state.
      if (typeof options.engaged === 'boolean') return options.engaged;
      return true;
    }
    if (block.type === 'var') {
      const key = block.name.trim().toUpperCase();
      if (key && values.has(`var:${key}`)) return values.get(`var:${key}`) === true;
      return readIn(values, block.id, 'in');
    }
    if (block.type === 'not') return !readIn(values, block.id, 'in');
    if (block.type === 'and') return readIn(values, block.id, 'a') && readIn(values, block.id, 'b');
    if (block.type === 'or') return readIn(values, block.id, 'a') || readIn(values, block.id, 'b');
    if (block.type === 'output') return readIn(values, block.id, 'in');
    return false;
  };

  const order = evaluationOrder(source);
  const values = new Map();
  const computeAll = () => {
    order.forEach(id => values.set(id, compute(values, byId.get(id))));
  };
  computeAll();

  // Variables that share a name inside this piece take the OR of their own
  // wires. A shared name arriving from another piece is applied afterwards,
  // so a reader does not publish that name back.
  const localShared = new Map();
  source.blocks.filter(block => block.type === 'var' && block.name.trim()).forEach(block => {
    const key = block.name.trim().toUpperCase();
    localShared.set(key, localShared.get(key) === true || values.get(block.id) === true);
  });
  localShared.forEach((on, key) => values.set(`var:${key}`, on));
  computeAll();

  const writers = [];
  localShared.forEach((on, key) => {
    if (on) writers.push(key);
  });

  const preset = options.sharedVars && typeof options.sharedVars === 'object' ? options.sharedVars : null;
  if (preset && Object.keys(preset).some(key => preset[key] === true)) {
    Object.keys(preset).forEach(key => {
      if (preset[key] === true) values.set(`var:${String(key).trim().toUpperCase()}`, true);
    });
    computeAll();
  }

  const bridges = [];
  const rares = [];
  const seenPins = new Set();
  source.blocks.filter(block => block.type === 'output' && values.get(block.id) === true).forEach(block => {
    if (block.rare) {
      rares.push({ name: block.name.trim() || 'Salida rara', on: true });
      return;
    }
    const pinId = pinIdOf(block.pinId);
    if (!pinId || seenPins.has(pinId)) return;
    seenPins.add(pinId);
    const sources = [];
    const seen = new Set();
    let powered = false;
    const rememberInput = (item) => {
      if (!item || item.type !== 'input') return;
      const sourceId = pinIdOf(item.pinId);
      if (sourceId && pinOn(sourceId)) sources.push(sourceId);
    };
    // A true NOT repeats the live borne behind it. The gate it inverted may
    // itself be false, so the walk keeps going until it reaches that borne.
    const walk = (blockId, throughNot = false) => {
      if (seen.has(blockId)) return;
      seen.add(blockId);
      const item = byId.get(blockId);
      if (!item) return;
      if (item.type === 'const' && values.get(blockId) === true) powered = true;
      if (item.type === 'actuated' && values.get(blockId) === true) powered = true;
      rememberInput(item);
      if (item.type === 'not' || throughNot) {
        (incoming.get(blockId) || []).forEach(wire => walk(wire.from.blockId, true));
        return;
      }
      (incoming.get(blockId) || []).forEach(wire => {
        if (values.get(wire.from.blockId) === true) walk(wire.from.blockId, false);
      });
    };
    walk(block.id);
    const entradaSources = [...new Set(sources)];
    if (entradaSources.length) {
      bridges.push({ pinId, sources: entradaSources, powered });
      return;
    }
    if (!powered) return;
    // A source constant emits that borne's own potential. It does not borrow
    // another pin, and it does not invent a potential on a loose piece.
    if (options.origin === true) {
      bridges.push({ pinId, sources: [], powered: true });
      return;
    }
    // A constant may pass the voltage of a source already connected to the piece.
    const feed = physicalPins
      .map(pin => String(pin.id))
      .filter(id => id !== pinId && pinOn(id));
    if (!feed.length) return;
    bridges.push({ pinId, sources: feed, powered: true });
  });
  const produced = bridges.length > 0 || rares.length > 0;
  return {
    bridges,
    rares,
    vars: writers,
    waiting: false,
    fed: !produced
  };
}
