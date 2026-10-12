// Industrial electrical circuit solver.
// Union-find over pins, potential propagation, and tag sync across every sheet.

import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { conductingPairs } from '../cad/pinLinks';
import { isCustomDrawn } from '../cad/symbolStore';
import { ioOf } from '../cad/ioKind';

const MAX_ITERATIONS = 16;

function definitionFor(comp, symbolDefs) {
  return (symbolDefs && symbolDefs[comp.type]) || SYMBOL_DEFINITIONS[comp.type] || null;
}

function isThermal(def) {
  return def?.switchType === 'thermal' || def?.linkedRole === 'thermal';
}

function tagOf(comp) {
  return String(comp?.tag || '').trim().toUpperCase();
}

function pinById(def, id, fallbackIndex) {
  const pins = def?.pins || [];
  if (pins.some(pin => pin.id === id)) return id;
  return pins[fallbackIndex]?.id || null;
}

/**
 * A closed flag means the contacts are touching.
 * NC devices conduct at rest (closed !== false) and open when operated.
 */
function isConducting(comp, def) {
  const state = comp.state || {};

  // The pin table conducts while the drawn piece shows its actuated sprite.
  if (isCustomDrawn(def)) {
    if (def.role === 'passive') return true;
    if (def.role === 'source' || def.role === 'coil' || def.role === 'load' || def.role === 'motor') return false;
    if (ioOf(def) === 'out') return def.contactType === 'NC' ? state.closed !== false : !!state.closed;
    return !!(state.on || state.pressed || state.forced);
  }

  if (def.role === 'passive') return true;

  if (isThermal(def)) return state.tripped !== true;

  if (def.switchType === 'momentary_NC') {
    return !state.pressed && state.closed !== false;
  }

  if (def.contactType === 'NC') {
    return state.closed !== false;
  }

  if (def.switchType === 'breaker') {
    return state.closed !== false;
  }

  if (
    def.switchType === 'momentary_NO' ||
    def.contactType === 'NO' ||
    def.contactType === 'power_3p' ||
    def.role === 'switch' ||
    def.role === 'contact'
  ) {
    return !!(state.pressed || state.closed);
  }

  return false;
}

function bridgesPins(def) {
  if (isCustomDrawn(def)) return def.role !== 'source';
  return def?.role === 'switch' || def?.role === 'contact' || def?.role === 'passive';
}

/**
 * Solve the whole project, not a single sheet.
 * priorStates keeps the last contact positions so a seal-in (enclavamiento)
 * survives from one user action to the next.
 */
export function solveCircuit(components, wires, symbolDefs = null, priorStates = null) {
  const compMap = new Map();

  components.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    const state = { ...(comp.state || {}) };
    const prior = priorStates?.get?.(comp.id);

    if (def?.role === 'contact' && !isThermal(def) && prior && typeof prior.closed === 'boolean') {
      state.closed = prior.closed;
    }

    compMap.set(comp.id, {
      ...comp,
      state,
      energized: false
    });
  });

  const wireList = Array.isArray(wires) ? wires : [];
  const logs = [];
  const pinKey = (compId, pinId) => `${compId}::${pinId}`;

  // A tripped thermal device opens every thermal contact that shares its tag.
  const trippedTags = new Set();
  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    const tag = tagOf(comp);
    if (!def || !tag || !isThermal(def)) return;
    if (comp.state?.tripped) trippedTags.add(tag);
  });
  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    const tag = tagOf(comp);
    if (!def || !tag || !trippedTags.has(tag) || !isThermal(def)) return;
    comp.state.tripped = true;
  });

  let changed = true;
  let iterations = 0;
  let isPinLive = () => false;
  let isPinNeutral = () => false;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations += 1;

    const parent = new Map();
    const find = (id) => {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) === id) return id;
      const root = find(parent.get(id));
      parent.set(id, root);
      return root;
    };
    const union = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootA, rootB);
    };

    wireList.forEach(wire => {
      if (!wire?.from || !wire?.to) return;
      union(
        pinKey(wire.from.compId, wire.from.pinId),
        pinKey(wire.to.compId, wire.to.pinId)
      );
    });

    compMap.forEach(comp => {
      const def = definitionFor(comp, symbolDefs);
      if (!def || !bridgesPins(def) || !isConducting(comp, def)) return;
      conductingPairs(def).forEach(([a, b]) => {
        union(pinKey(comp.id, a), pinKey(comp.id, b));
      });
    });

    const liveRoots = new Set();
    const neutralRoots = new Set();

    compMap.forEach(comp => {
      const def = definitionFor(comp, symbolDefs);
      if (!def || def.role !== 'source') return;

      (def.pins || []).forEach(pin => {
        let kind = pin.potential || null;
        if (!kind && def.potentialType === 'dc_supply') {
          kind = pin.id === 'POS' || pin.label === '+' ? 'live' : 'neutral';
        } else if (!kind) {
          kind = def.potentialType === 'live'
            ? 'live'
            : def.potentialType === 'neutral' || def.potentialType === 'ground'
              ? def.potentialType
              : null;
        }
        const root = find(pinKey(comp.id, pin.id));
        if (kind === 'live') liveRoots.add(root);
        else if (kind === 'neutral' || kind === 'ground') neutralRoots.add(root);
      });
    });

    isPinLive = (compId, pinId) => !!pinId && liveRoots.has(find(pinKey(compId, pinId)));
    isPinNeutral = (compId, pinId) => !!pinId && neutralRoots.has(find(pinKey(compId, pinId)));

    const activeTags = new Set();

    compMap.forEach(comp => {
      const def = definitionFor(comp, symbolDefs);
      if (!def) return;

      let newlyEnergized = false;

      if (def.role === 'coil') {
        const a1 = pinById(def, 'A1', 0);
        const a2 = pinById(def, 'A2', 1);
        const a1Live = isPinLive(comp.id, a1);
        const a2Live = isPinLive(comp.id, a2);
        const a1Neutral = isPinNeutral(comp.id, a1);
        const a2Neutral = isPinNeutral(comp.id, a2);
        newlyEnergized = (a1Live && a2Neutral) || (a2Live && a1Neutral);
      } else if (def.role === 'load') {
        const x1 = pinById(def, 'X1', 0);
        const x2 = pinById(def, 'X2', 1);
        const x1Live = isPinLive(comp.id, x1);
        const x2Live = isPinLive(comp.id, x2);
        const x1Neutral = isPinNeutral(comp.id, x1);
        const x2Neutral = isPinNeutral(comp.id, x2);
        newlyEnergized = (x1Live && x2Neutral) || (x2Live && x1Neutral);
      } else if (def.role === 'motor') {
        const u = isPinLive(comp.id, pinById(def, 'U1', 0));
        const v = isPinLive(comp.id, pinById(def, 'V1', 1));
        const w = isPinLive(comp.id, pinById(def, 'W1', 2));
        const liveCount = [u, v, w].filter(Boolean).length;
        newlyEnergized = liveCount >= 2;
      }

      if (ioOf(def) === 'inout' && comp.state?.forced) newlyEnergized = true;

      if (comp.energized !== newlyEnergized) {
        comp.energized = newlyEnergized;
        changed = true;
      }

      const tag = tagOf(comp);
      if (comp.energized && tag && def.role === 'coil') {
        activeTags.add(tag);
      }
    });

    // An energized coil publishes its name. Its contacts follow.
    // A pressed input does not: that would force the coil.
    compMap.forEach(comp => {
      const def = definitionFor(comp, symbolDefs);
      if (!def) return;
      const tag = tagOf(comp);
      const tagActive = !!tag && activeTags.has(tag);

      if ((def.role === 'load' || def.role === 'motor') && tagActive && !comp.energized) {
        comp.energized = true;
        changed = true;
      }

      if (def.role !== 'contact' || !tag || isThermal(def)) return;

      let nextClosed = comp.state.closed;

      if (def.contactType === 'NC') {
        nextClosed = !tagActive;
      } else if (
        def.contactType === 'NO' ||
        def.contactType === 'power_3p' ||
        def.role === 'contact'
      ) {
        nextClosed = tagActive;
      }
      if (ioOf(def) === 'inout' && comp.state?.forced) {
        nextClosed = def.contactType === 'NC' ? false : true;
      }

      if (comp.state.closed !== nextClosed) {
        comp.state.closed = nextClosed;
        changed = true;
      }
    });
  }

  const linkedNames = new Set();
  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    const tag = tagOf(comp);
    if (!def || !tag) return;
    if ((def.role === 'coil' || def.role === 'load' || def.role === 'motor') && comp.energized) linkedNames.add(tag);
    if (isThermal(def) && comp.state?.tripped) linkedNames.add(tag);
  });
  compMap.forEach(comp => {
    if (linkedNames.has(tagOf(comp))) comp.linked = true;
  });

  const energizedWires = new Set();
  wireList.forEach(wire => {
    if (!wire?.from || !wire?.to) return;
    const live = isPinLive(wire.from.compId, wire.from.pinId) || isPinLive(wire.to.compId, wire.to.pinId);
    if (live) energizedWires.add(wire.id);
  });

  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    if (!def) return;
    const prior = priorStates?.get?.(comp.id);
    const wasEnergized = !!prior?.energized;
    const tag = comp.tag || comp.id;

    if (def.role === 'coil' && comp.energized && !wasEnergized) {
      logs.push(`[SIM] Bobina ${tag} energizada.`);
    } else if (def.role === 'coil' && !comp.energized && wasEnergized) {
      logs.push(`[SIM] Bobina ${tag} desenergizada.`);
    } else if (def.role === 'motor' && comp.energized && !wasEnergized) {
      logs.push(`[SIM] Motor ${tag} en marcha.`);
    } else if (def.role === 'motor' && !comp.energized && wasEnergized) {
      logs.push(`[SIM] Motor ${tag} detenido.`);
    } else if (def.role === 'load' && comp.energized && !wasEnergized) {
      logs.push(`[SIM] Piloto ${tag} encendido.`);
    } else if (def.role === 'load' && !comp.energized && wasEnergized) {
      logs.push(`[SIM] Piloto ${tag} apagado.`);
    } else if (isThermal(def) && def.switchType === 'thermal' && comp.state?.tripped && !prior?.tripped) {
      logs.push(`[SIM] Térmico ${tag} disparado. El contacto 95-96 abre el mando.`);
    } else if (
      def.role === 'contact' &&
      !isThermal(def) &&
      prior &&
      comp.state?.closed === true &&
      prior.closed !== true &&
      def.contactType !== 'NC'
    ) {
      logs.push(`[SYNC] Contacto ${tag} cerrado por su bobina.`);
    } else if (
      def.role === 'contact' &&
      !isThermal(def) &&
      def.contactType === 'NC' &&
      prior &&
      comp.state?.closed === false &&
      prior.closed !== false
    ) {
      logs.push(`[SYNC] Contacto NC ${tag} abierto por su bobina.`);
    }
  });

  return {
    updatedComponents: Array.from(compMap.values()),
    energizedWires,
    logs,
    iterations
  };
}
