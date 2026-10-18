// Step back through the schematic. A drag or a typed tag is one step:
// the same gesture key keeps the snapshot taken before that gesture started.

const HISTORY_LIMIT = 60;

export function createDesignHistory() {
  return { past: [], future: [], gesture: null };
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

export function noteDesignChange(history, snapshot, gestureKey = null) {
  if (gestureKey && history.gesture === gestureKey) return history;
  const past = history.past.length >= HISTORY_LIMIT
    ? history.past.slice(history.past.length - (HISTORY_LIMIT - 1))
    : history.past.slice();
  past.push(cloneSnapshot(snapshot));
  return { past, future: [], gesture: gestureKey || null };
}

export function endDesignGesture(history) {
  if (!history.gesture) return history;
  return { ...history, gesture: null };
}

export function undoDesign(history, current) {
  if (!history.past.length) return null;
  const snapshot = cloneSnapshot(history.past[history.past.length - 1]);
  return {
    history: {
      past: history.past.slice(0, -1),
      future: history.future.concat(cloneSnapshot(current)),
      gesture: null
    },
    snapshot
  };
}

export function redoDesign(history, current) {
  if (!history.future.length) return null;
  const snapshot = cloneSnapshot(history.future[history.future.length - 1]);
  return {
    history: {
      past: history.past.concat(cloneSnapshot(current)),
      future: history.future.slice(0, -1),
      gesture: null
    },
    snapshot
  };
}
