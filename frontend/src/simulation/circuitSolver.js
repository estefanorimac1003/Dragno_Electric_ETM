// Industrial electrical circuit solver.
// Union-find over pins, potential propagation, and tag sync across every sheet.

import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { conductingPairs } from '../cad/pinLinks';
import { isCustomDrawn } from '../cad/symbolStore';
import { ioOf, mouseActuated, userCanOperate } from '../cad/ioKind';
import { deviceIsNegated, pinIsNegated } from '../cad/outputNot';
import { evaluateProgram, hasBlockProgram, programOwnedPins, programWiresHand, withActuatedBlock } from '../cad/blockProgram';
import { componentName } from '../cad/componentLabel';
import { bondWireNets, wireNodeKeys } from '../cad/wireGeometry';
import { motorPhasePins, motorTurnOf, oppositeTurn, phaseSequence } from '../cad/motorTurn';
import { isMomentaryPushbutton } from '../cad/pushbutton';

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

function sourcePhase(pin) {
  const id = String(pin?.id || '');
  if (id === 'L1' || id === 'L2' || id === 'L3') return id;
  if (pin?.potential === 'live') return 'L';
  return null;
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
    if (ioOf(def, comp) === 'out') return def.contactType === 'NC' ? state.closed !== false : !!state.closed;
    if (isMomentaryPushbutton(def)) return !!(state.pressed || state.forced);
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

// Coils, lamps, motors and sources do not pass a pole through to another pole.
function conductsAcross(def) {
  if (!def) return false;
  if (def.role === 'coil' || def.role === 'load' || def.role === 'motor' || def.role === 'source') return false;
  return bridgesPins(def);
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

    const copy = {
      ...comp,
      state,
      energized: false
    };
    // Hand state, before a same-tag follower copies state.on onto this piece.
    copy.actuated = mouseActuated(copy, def);
    compMap.set(comp.id, copy);
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

  // The hand that turned a piece on. Later passes must not treat a follower
  // copy of that state as a new hand, or the tag would latch itself.
  const userActuated = new Set();
  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    const state = comp.state || {};
    if (!userCanOperate(def, comp)) return;
    if (state.forced || state.pressed) userActuated.add(comp.id);
    else if (state.on && !isMomentaryPushbutton(def)) userActuated.add(comp.id);
  });

  let changed = true;
  let iterations = 0;
  let isPinLive = () => false;
  let isPinNeutral = () => false;
  let wireIsLive = () => false;
  let phaseAt = () => null;

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

    bondWireNets(wireList, union, pinKey);

    // A normal output joins its pins while the contact conducts.
    // A negated output waits until that path already has potential.
    compMap.forEach(comp => {
      const def = definitionFor(comp, symbolDefs);
      if (!def || !conductsAcross(def) || !isConducting(comp, def)) return;
      // The block wires are the only path. Pairing the bornes in order would
      // join two phase inputs and the motor would see a short.
      if (def.role !== 'contact' && hasBlockProgram(def)) return;
      const owned = programOwnedPins(def);
      conductingPairs(def).forEach(([a, b]) => {
        // A contactor contact follows its coil. Its program must not take the poles.
        if (def.role !== 'contact' && (owned.has(a) || owned.has(b))) return;
        if (pinIsNegated(comp, def, a) || pinIsNegated(comp, def, b)) return;
        union(pinKey(comp.id, a), pinKey(comp.id, b));
      });
    });

    const liveRoots = new Set();
    const neutralRoots = new Set();
    const phaseRoots = new Map();
    const markPotentials = () => {
      liveRoots.clear();
      neutralRoots.clear();
      phaseRoots.clear();
      compMap.forEach(comp => {
        const def = definitionFor(comp, symbolDefs);
        if (!def || def.role !== 'source') return;

        (def.pins || []).forEach(pin => {
          if (pinIsNegated(comp, def, pin.id)) return;
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
          if (kind === 'live') {
            liveRoots.add(root);
            const phase = sourcePhase(pin);
            if (phase) {
              const names = phaseRoots.get(root) || new Set();
              names.add(phase);
              phaseRoots.set(root, names);
            }
          } else if (kind === 'neutral' || kind === 'ground') neutralRoots.add(root);
        });
      });
    };

    isPinLive = (compId, pinId) => !!pinId && liveRoots.has(find(pinKey(compId, pinId)));
    isPinNeutral = (compId, pinId) => !!pinId && neutralRoots.has(find(pinKey(compId, pinId)));
    wireIsLive = (wire) => wireNodeKeys(wire, pinKey).some(key => liveRoots.has(find(key)));
    phaseAt = (compId, pinId) => {
      if (!pinId) return null;
      const names = phaseRoots.get(find(pinKey(compId, pinId)));
      if (!names || names.size !== 1) return null;
      const [name] = names;
      return name === 'L1' || name === 'L2' || name === 'L3' ? name : null;
    };
    markPotentials();

    const pairFed = (compId, a, b) => (
      isPinLive(compId, a) || isPinNeutral(compId, a) ||
      isPinLive(compId, b) || isPinNeutral(compId, b)
    );

    // One negated output passes only when its own path is already fed
    // and the mechanical contact is open. Another output stays as drawn.
    let negatedGrew = true;
    let negatedPass = 0;
    while (negatedGrew && negatedPass < compMap.size + 1) {
      negatedGrew = false;
      negatedPass += 1;
      compMap.forEach(comp => {
        const def = definitionFor(comp, symbolDefs);
        if (!def || !conductsAcross(def) || isConducting(comp, def)) return;
        if (def.role !== 'contact' && hasBlockProgram(def)) return;
        const owned = programOwnedPins(def);
        conductingPairs(def).forEach(([a, b]) => {
          if (def.role !== 'contact' && (owned.has(a) || owned.has(b))) return;
          if (!(pinIsNegated(comp, def, a) || pinIsNegated(comp, def, b)) || !pairFed(comp.id, a, b)) return;
          const left = pinKey(comp.id, a);
          const right = pinKey(comp.id, b);
          if (find(left) === find(right)) return;
          union(left, right);
          negatedGrew = true;
        });
      });
      if (negatedGrew) markPotentials();
    }

    // A piece with a source on one of its bornes runs its program and may
    // repeat that voltage. A loose piece has nothing to send.
    const powerStamp = () => Array.from(compMap.values()).map(comp => (
      `${comp.id}:${comp.energized ? 1 : 0}:${comp.state?.closed ? 1 : 0}:${comp.state?.tripped ? 1 : 0}:${(comp.programOutputs || []).join('.')}:${(comp.programRares || []).map(item => item.name).join('.')}`
    )).join('|');
    const beforePower = powerStamp();

    const refreshPowerStates = () => {
      const activeTags = new Set();
      compMap.forEach(comp => {
        const def = definitionFor(comp, symbolDefs);
        if (!def) return;

        let newlyEnergized = false;
        const wholeNegated = deviceIsNegated(comp, def);
        const liveOn = (pinId) => {
          if (!wholeNegated && pinIsNegated(comp, def, pinId)) return false;
          return isPinLive(comp.id, pinId);
        };
        const neutralOn = (pinId) => {
          if (!wholeNegated && pinIsNegated(comp, def, pinId)) return false;
          return isPinNeutral(comp.id, pinId);
        };

        if (def.role === 'coil') {
          const a1 = pinById(def, 'A1', 0);
          const a2 = pinById(def, 'A2', 1);
          const byTerminals = (liveOn(a1) && neutralOn(a2)) || (liveOn(a2) && neutralOn(a1));
          const byProgram = (comp.programRares || []).some(item => item.on !== false);
          newlyEnergized = byTerminals || byProgram;
        } else if (def.role === 'load') {
          const x1 = pinById(def, 'X1', 0);
          const x2 = pinById(def, 'X2', 1);
          newlyEnergized = (liveOn(x1) && neutralOn(x2)) || (liveOn(x2) && neutralOn(x1));
        } else if (def.role === 'motor') {
          comp.spin = null;
          comp.sequence = null;
          const phasePins = motorPhasePins(def);
          if (phasePins) {
            const sequence = phaseSequence(
              phaseAt(comp.id, phasePins[0]),
              phaseAt(comp.id, phasePins[1]),
              phaseAt(comp.id, phasePins[2])
            );
            newlyEnergized = !!sequence;
            comp.sequence = sequence;
          }
        }

        if ((def.role === 'coil' || def.role === 'load' || def.role === 'motor') && wholeNegated) {
          const fed = (def.pins || []).some(pin => isPinLive(comp.id, pin.id) || isPinNeutral(comp.id, pin.id));
          newlyEnergized = fed ? !newlyEnergized : false;
        }

        if (ioOf(def, comp) === 'inout' && comp.state?.forced) newlyEnergized = true;
        if (
          ioOf(def, comp) === 'in'
          && comp.state?.on
          && (def.role === 'coil' || def.role === 'load' || def.role === 'motor')
        ) {
          newlyEnergized = true;
        }
        comp.energized = newlyEnergized;
        if (def.role === 'motor') {
          if (!comp.energized) {
            comp.spin = null;
            comp.sequence = null;
          } else if (comp.sequence === 'reverse') {
            comp.spin = oppositeTurn(comp.turn);
          } else {
            comp.spin = motorTurnOf(comp);
          }
        }

        const tag = tagOf(comp);
        if (!tag || def.role === 'source' || isThermal(def)) return;
        const powered = (def.role === 'coil' || def.role === 'load' || def.role === 'motor') && comp.energized;
        if (powered || userActuated.has(comp.id)) activeTags.add(tag);
      });

      // One tag is one device. The part that is on moves the other parts.
      // A contact that merely stayed closed does not keep the device on.
      compMap.forEach(comp => {
        const def = definitionFor(comp, symbolDefs);
        if (!def || def.role === 'source' || isThermal(def)) return;
        const tag = tagOf(comp);
        const tagActive = !!tag && activeTags.has(tag);
        const normallyClosed = def.contactType === 'NC' || def.switchType === 'momentary_NC';

        if ((def.role === 'coil' || def.role === 'load' || def.role === 'motor') && tagActive) {
          comp.energized = true;
          if (def.role === 'motor' && !comp.spin) comp.spin = motorTurnOf(comp);
        }

        if ((def.role !== 'contact' && def.role !== 'switch') || !tag) return;

        if (def.role === 'contact') {
          let nextClosed = normallyClosed ? !tagActive : tagActive;
          if (ioOf(def, comp) === 'in' && comp.state?.on) {
            nextClosed = !normallyClosed;
          }
          if (ioOf(def, comp) === 'inout' && comp.state?.forced) {
            nextClosed = normallyClosed ? false : true;
          }
          comp.state.closed = nextClosed;
          return;
        }

        if (userActuated.has(comp.id)) return;
        comp.state.closed = tagActive ? !normallyClosed : normallyClosed;
        comp.state.on = tagActive ? !normallyClosed : false;
      });
    };

    // Names such as RETRO are shared by every piece that carries the same tag.
    // A false variable must not clear a true one written by another piece.
    let sharedByTag = new Map();
    const tagVarSig = (map) => [...map.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([tag, names]) => `${tag}:${[...names].sort().join(',')}`)
      .join('|');

    const pinFeedsProgram = (comp, def, pinId) => {
      if (!pinId) return false;
      if (def.role === 'coil') {
        const a1 = pinById(def, 'A1', 0);
        const a2 = pinById(def, 'A2', 1);
        if (pinId === a2 && a2 !== a1) return isPinNeutral(comp.id, pinId);
        if (pinId === a1) return isPinLive(comp.id, pinId);
      }
      return isPinLive(comp.id, pinId);
    };

    const applyPrograms = () => {
      let grew = false;
      let emissionChanged = false;
      const usedSig = tagVarSig(sharedByTag);
      const written = new Map();
      compMap.forEach(comp => {
        const def = definitionFor(comp, symbolDefs);
        // A source already carries its potential. A motor follows the phase
        // sequence on U1, V1 and W1. Neither one is a block program.
        if (!def || def.role === 'source' || def.role === 'motor' || !hasBlockProgram(def)) {
          comp.programOutputs = [];
          comp.programRares = [];
          comp.programNote = '';
          return;
        }
        const tag = tagOf(comp);
        const sharedNames = tag ? sharedByTag.get(tag) : null;
        const operable = userCanOperate(def, comp);
        const handInProgram = programWiresHand(def.program);
        const result = evaluateProgram(
          operable ? withActuatedBlock(def.program, componentName(comp, def)) : def.program,
          {
            pins: def.pins,
            bindOpenPins: def.role === 'switch' || def.role === 'contact' || def.role === 'passive',
            // A graph that already wires the name block uses that block as the
            // mouse. The Entrada remains the borne, so the sheet runs the program.
            engaged: !handInProgram && (def.role === 'switch' || def.role === 'contact')
              ? isConducting(comp, def)
              : undefined,
            actuated: comp.actuated === true,
            sharedVars: sharedNames && sharedNames.size
              ? Object.fromEntries([...sharedNames].map(name => [name, true]))
              : undefined,
            pinOn: (pinId) => pinFeedsProgram(comp, def, pinId)
          }
        );
        result.bridges.forEach(bridge => {
          const outputKey = pinKey(comp.id, bridge.pinId);
          bridge.sources.forEach(sourceId => {
            const sourceKey = pinKey(comp.id, sourceId);
            if (find(outputKey) !== find(sourceKey)) grew = true;
            union(outputKey, sourceKey);
          });
        });
        const previousPins = (comp.programOutputs || []).join(',');
        comp.programOutputs = result.bridges.map(bridge => bridge.pinId);
        if (previousPins !== comp.programOutputs.join(',')) emissionChanged = true;
        comp.programRares = result.rares;
        comp.programNote = '';
        if (!result.bridges.length && !result.rares.length) {
          if (result.waiting) comp.programNote = 'waiting';
          else if (result.fed) comp.programNote = 'fed';
        }
        if (tag && result.vars?.length) {
          const set = written.get(tag) || new Set();
          result.vars.forEach(name => set.add(name));
          written.set(tag, set);
        }
      });
      sharedByTag = written;
      return { grew, emissionChanged, varsChanged: tagVarSig(written) !== usedSig };
    };

    // Programs run on the incoming contact state, then coils and contacts
    // update. Doing it the other way opens a seal-in before the contact
    // can feed the coil again.
    let settle = true;
    let settlePass = 0;
    while (settle && settlePass < 8) {
      settle = false;
      settlePass += 1;
      let again = true;
      let growPass = 0;
      while (again && growPass < 8) {
        growPass += 1;
        const applied = applyPrograms();
        again = applied.grew || applied.emissionChanged || applied.varsChanged;
        if (applied.grew || applied.emissionChanged) markPotentials();
      }
      const mid = powerStamp();
      refreshPowerStates();
      if (powerStamp() !== mid) settle = true;
    }
    if (powerStamp() !== beforePower) changed = true;
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
    if (wire?.id && wireIsLive(wire)) energizedWires.add(wire.id);
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
      const sense = comp.spin === 'ccw' ? 'antihorario' : 'horario';
      const why = comp.sequence === 'reverse' ? ' por secuencia inversa' : '';
      logs.push(`[SIM] Motor ${tag} en marcha, giro ${sense}${why}.`);
    } else if (def.role === 'motor' && comp.energized && wasEnergized && prior?.spin && comp.spin && prior.spin !== comp.spin) {
      logs.push(`[SIM] Motor ${tag} ahora gira ${comp.spin === 'ccw' ? 'antihorario' : 'horario'}.`);
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

  compMap.forEach(comp => {
    const def = definitionFor(comp, symbolDefs);
    if (def?.role === 'source' || def?.role === 'motor') return;
    const tag = comp.tag || comp.id;
    if (comp.programOutputs?.length) {
      logs.push(`[SIM] ${tag}: la programación encendió el borne ${comp.programOutputs.join(', ')}.`);
    } else if (comp.programRares?.length) {
      logs.push(`[SIM] ${tag}: la programación encendió ${comp.programRares.map(item => item.name).join(', ')}.`);
    } else if (comp.programNote === 'waiting') {
      logs.push(`[SIM] ${tag}: la pieza está suelta o no tiene fuente, y no manda señal.`);
    } else if (comp.programNote === 'fed') {
      logs.push(`[SIM] ${tag}: la pieza tiene fuente, y la lógica dejó la salida apagada.`);
    }
  });

  return {
    updatedComponents: Array.from(compMap.values()),
    energizedWires,
    logs,
    iterations
  };
}
