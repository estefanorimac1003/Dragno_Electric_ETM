// PLC-style direction of a piece.
// IN: the operator can actuate it.
// OUT: only the circuit can actuate it.
// IN-OUT: both can.

export function ioOf(def) {
  const raw = String(def?.io || '').toLowerCase();
  if (raw === 'in' || raw === 'out' || raw === 'inout') return raw;
  if (!def) return 'out';
  if (def.switchType === 'thermal' || def.linkedRole === 'thermal') return 'inout';
  if (def.role === 'switch') return 'in';
  return 'out';
}

export function userCanOperate(def) {
  const io = ioOf(def);
  return io === 'in' || io === 'inout';
}
