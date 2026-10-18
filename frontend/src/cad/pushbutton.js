// A pulsador is a hand switch. Breakers and thermals stay latched.
// Momentary means the pointer holds it, and releasing the click returns it to rest.

export function isPushbutton(def) {
  if (!def || def.role !== 'switch') return false;
  if (def.switchType === 'breaker' || def.switchType === 'thermal' || def.linkedRole === 'thermal') return false;
  return true;
}

function namedPulsador(def) {
  return /^pulsador\b/i.test(String(def?.name || '').trim());
}

export function isMomentaryPushbutton(def) {
  if (!isPushbutton(def)) return false;
  if (def.momentary === false) return false;
  if (def.momentary === true) return true;
  // A piece named Pulsador springs back even when its folder has no button control.
  if (namedPulsador(def)) return true;
  return def.switchType === 'momentary_NO' || def.switchType === 'momentary_NC';
}

// Pulsador springs back. Botón stays where the click left it.
export function pushbuttonActuation(def) {
  if (def?.momentary === false) return 'latch';
  if (isMomentaryPushbutton(def)) return 'momentary';
  return 'latch';
}

function restsClosed(def) {
  return def?.switchType === 'momentary_NC' || def?.contactType === 'NC';
}

export function pressedPushbuttonState(state, def) {
  return {
    ...(state || {}),
    pressed: true,
    on: true,
    closed: !restsClosed(def)
  };
}

export function releasedPushbuttonState(state, def) {
  return {
    ...(state || {}),
    pressed: false,
    on: false,
    closed: restsClosed(def)
  };
}
