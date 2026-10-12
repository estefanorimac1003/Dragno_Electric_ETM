// Stroke patterns stored on a primitive as dash: 'dot' | 'dash'.
// Empty means a continuous line. Lengths are in drawing units.

export function dashSegments(dash) {
  if (dash === 'dot') return [0.15, 2.8];
  if (dash === 'dash') return [7, 3.5];
  return [];
}

export function applyDash(ctx, dash) {
  const segments = dashSegments(dash);
  ctx.setLineDash(segments);
  ctx.lineCap = dash === 'dot' ? 'round' : 'butt';
}
