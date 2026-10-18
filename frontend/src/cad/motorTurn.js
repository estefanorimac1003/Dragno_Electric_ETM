// Motor rotation mark. The arrow sits outside the circle and points
// the way the shaft turns. Clockwise follows the canvas, Y downward.

export function motorTurnOf(comp) {
  return comp?.turn === 'ccw' ? 'ccw' : 'cw';
}

export function oppositeTurn(turn) {
  return motorTurnOf({ turn }) === 'cw' ? 'ccw' : 'cw';
}

// While the motor runs, spin is the electrical direction. At rest it is absent
// and the arrow shows the direction the user chose for the direct sequence.
export function motorSpinOf(comp) {
  if (comp?.spin === 'cw' || comp?.spin === 'ccw') return comp.spin;
  return motorTurnOf(comp);
}

const PHASE_RANK = { L1: 0, L2: 1, L3: 2 };
const EARTH_PIN = /^(pe|gnd|tierra|ground)$/i;

// U1 V1 W1 when the symbol has those bornes. A drawn motor uses the three
// leftmost power bornes, so labels 1 2 3 still receive L1 L2 L3.
export function motorPhasePins(def) {
  const pins = Array.isArray(def?.pins) ? def.pins.filter(Boolean) : [];
  if (['U1', 'V1', 'W1'].every(id => pins.some(pin => pin.id === id))) {
    return ['U1', 'V1', 'W1'];
  }
  const phases = pins
    .filter(pin => !EARTH_PIN.test(String(pin.id || '')) && !EARTH_PIN.test(String(pin.label || '')))
    .sort((a, b) => (Number(a.x) - Number(b.x)) || (Number(a.y) - Number(b.y)));
  if (phases.length < 3) return null;
  return [phases[0].id, phases[1].id, phases[2].id];
}

// Even permutations of L1 L2 L3 are the direct sequence, including a cyclic
// shift. Swapping any two phases is the reverse sequence.
export function phaseSequence(u, v, w) {
  const names = [u, v, w];
  if (names.some(name => PHASE_RANK[name] == null)) return null;
  if (new Set(names).size !== 3) return null;
  const seq = names.map(name => PHASE_RANK[name]);
  let inversions = 0;
  for (let i = 0; i < seq.length; i += 1) {
    for (let j = i + 1; j < seq.length; j += 1) {
      if (seq[i] > seq[j]) inversions += 1;
    }
  }
  return inversions % 2 === 0 ? 'direct' : 'reverse';
}

export function motorArrowGeometry(turn) {
  const cw = motorTurnOf({ turn }) === 'cw';
  const radius = 24;
  const sweep = Math.PI * 0.72;
  // Bottom arc, clear of the U1 V1 W1 leads and of the earth pin.
  const end = cw ? 1.16 * Math.PI : 0.44 * Math.PI;
  const start = cw ? end - sweep : end + sweep;
  const steps = 18;
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const along = index / steps;
    const angle = cw ? start + sweep * along : start - sweep * along;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  const head = points[points.length - 1];
  const prev = points[points.length - 2];
  const dx = head.x - prev.x;
  const dy = head.y - prev.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const size = 5.5;
  const baseX = head.x - ux * size;
  const baseY = head.y - uy * size;
  return {
    points,
    head: [
      head,
      { x: baseX + px * size * 0.7, y: baseY + py * size * 0.7 },
      { x: baseX - px * size * 0.7, y: baseY - py * size * 0.7 }
    ]
  };
}

export function paintMotorArrow(ctx, comp, palette, spinAngle, running) {
  const turn = motorSpinOf(comp);
  const arrow = motorArrowGeometry(turn);
  const lit = running ? palette.tagLive : (palette.gold || palette.text);
  ctx.save();
  ctx.strokeStyle = lit;
  ctx.fillStyle = lit;
  ctx.lineWidth = running ? 2.2 : 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (running) {
    ctx.shadowColor = lit;
    ctx.shadowBlur = 8;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -((spinAngle * 10) % 22);
  }
  ctx.beginPath();
  arrow.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  arrow.head.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();

  if (running) {
    const direction = turn === 'ccw' ? -1 : 1;
    const angle = direction * spinAngle;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9);
    ctx.lineTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
    ctx.stroke();
  }
  ctx.restore();
}
