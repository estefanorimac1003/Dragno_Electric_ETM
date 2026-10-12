import { bezierSegments, linePoints } from './geometry';

export function tracePrimitive(ctx, prim) {
  if (!prim || prim.type === 'text') return prim?.type === 'text' ? 'text' : 'empty';
  ctx.beginPath();
  if (prim.type === 'line') {
    const points = linePoints(prim);
    if (points.length < 2) return 'empty';
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    if (prim.closed) ctx.closePath();
    return 'path';
  }
  if (prim.type === 'rect') {
    ctx.rect(prim.x, prim.y, prim.width, prim.height);
    return 'path';
  }
  if (prim.type === 'circle') {
    ctx.arc(prim.cx, prim.cy, Math.max(0.2, prim.r || 0), 0, Math.PI * 2);
    return 'path';
  }
  if (prim.type === 'ellipse') {
    ctx.ellipse(
      prim.cx,
      prim.cy,
      Math.max(0.2, prim.rx || 0),
      Math.max(0.2, prim.ry || 0),
      prim.rotation || 0,
      0,
      Math.PI * 2
    );
    return 'path';
  }
  if (prim.type === 'arc') {
    ctx.arc(prim.cx, prim.cy, Math.max(0.2, prim.r || 0), prim.startAngle || 0, prim.endAngle ?? Math.PI);
    return 'path';
  }
  if (prim.type === 'bezier') {
    const nodes = prim.nodes || [];
    if (nodes.length < 2) return 'empty';
    ctx.moveTo(nodes[0].x, nodes[0].y);
    bezierSegments(prim).forEach(segment => {
      if (segment.type === 'line') ctx.lineTo(segment.b.x, segment.b.y);
      else ctx.bezierCurveTo(segment.p1.x, segment.p1.y, segment.p2.x, segment.p2.y, segment.p3.x, segment.p3.y);
    });
    if (prim.closed) ctx.closePath();
    return 'path';
  }
  return 'empty';
}
