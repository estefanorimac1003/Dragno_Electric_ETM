import { isMomentaryPushbutton } from './pushbutton';

// PLC-style direction of a piece.
// IN: the operator can actuate it.
// OUT: only the circuit can actuate it.
// IN-OUT: both can.

export function ioOf(def, comp) {
  const chosen = String(comp?.io || def?.io || '').toLowerCase();
  if (chosen === 'in' || chosen === 'out' || chosen === 'inout') return chosen;
  if (!def) return 'out';
  if (def.switchType === 'thermal' || def.linkedRole === 'thermal') return 'inout';
  if (def.role === 'switch') return 'in';
  return 'out';
}

export function userCanOperate(def, comp) {
  const io = ioOf(def, comp);
  return io === 'in' || io === 'inout';
}

// The hand state of a mouse-operated piece. OUT pieces stay dark.
// IN-OUT uses the forced flag. A breaker is on while it remains closed.
export function mouseActuated(comp, def) {
  if (!userCanOperate(def, comp)) return false;
  const state = comp?.state || {};
  if (ioOf(def, comp) === 'inout') return state.forced === true;
  if (def?.switchType === 'breaker') return state.closed !== false;
  if (def?.switchType === 'thermal' || def?.linkedRole === 'thermal') return state.tripped === true;
  // A pulsador is only actuated while the pointer is down. A leftover state.on
  // must not hold a normally closed contact open.
  if (isMomentaryPushbutton(def)) return state.pressed === true;
  return state.pressed === true || state.on === true;
}
