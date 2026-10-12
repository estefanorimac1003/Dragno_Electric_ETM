import {
  boundsOfMany,
  handlePositions,
  layerState,
  linePoints,
  primitiveNodes
} from './geometry';
import { tracePrimitive } from './tracePrimitive';
import { applyDash, dashSegments } from './lineStyle';
import { canvasPalette } from '../../theme/planThemes';

function adaptiveStep(base, zoom) {
  let step = Math.max(1, base || 5);
  while (step * zoom < 16) step *= 2;
  return step;
}

function paintPrimitive(ctx, prim, options) {
  const traced = tracePrimitive(ctx, prim);
  if (traced === 'text') {
    ctx.save();
    ctx.translate(prim.x, prim.y);
    if (prim.rotation) ctx.rotate(prim.rotation);
    ctx.font = `${prim.fontSize || 10}px Consolas, monospace`;
    ctx.fillStyle = options.color || prim.color || prim.stroke || '#ffd600';
    ctx.textAlign = prim.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((prim.text || '').replace('{tag}', options.tag || ''), 0, 0);
    ctx.restore();
    return;
  }
  if (traced !== 'path') return;
  ctx.save();
  ctx.strokeStyle = options.stroke || prim.stroke || '#00e5ff';
  ctx.lineWidth = (prim.strokeWidth || 2) + (options.extraWidth || 0);
  applyDash(ctx, options.dash ?? prim.dash);
  const fill = options.fill ?? prim.fill ?? 'none';
  if (fill !== 'none') {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

export function paintEditor(ctx, scene) {
  const palette = canvasPalette();
  const { width, height, zoom, pan } = scene;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.inset;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
  ctx.scale(zoom, zoom);

  const left = (-width / 2 - pan.x) / zoom;
  const right = (width / 2 - pan.x) / zoom;
  const top = (-height / 2 - pan.y) / zoom;
  const bottom = (height / 2 - pan.y) / zoom;
  const step = adaptiveStep(scene.gridSize, zoom);
  const dot = 1.15 / zoom;
  ctx.fillStyle = scene.gridSnap ? palette.grid : palette.gridDim;
  let drawn = 0;
  for (let x = Math.floor(left / step) * step; x <= right && drawn < 7000; x += step) {
    for (let y = Math.floor(top / step) * step; y <= bottom && drawn < 7000; y += step) {
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      drawn += 1;
    }
  }

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.1 / zoom;
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(right, 0);
  ctx.moveTo(0, top);
  ctx.lineTo(0, bottom);
  ctx.stroke();
  ctx.fillStyle = palette.titleLabel;
  ctx.font = `${11 / zoom}px Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('X', right - 16 / zoom, -4 / zoom);
  ctx.textAlign = 'right';
  ctx.fillText('Y', -4 / zoom, top + 14 / zoom);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(-1.3, -1.3, 2.6, 2.6);

  ctx.save();
  ctx.strokeStyle = scene.spriteMode === 'actuated' ? palette.live : palette.border;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(-scene.symbolWidth / 2, -scene.symbolHeight / 2, scene.symbolWidth, scene.symbolHeight);
  ctx.restore();

  (scene.ghost || []).forEach(prim => {
    if (!layerState(scene.layers, prim.layerId).visible) return;
    ctx.save();
    ctx.globalAlpha = 0.28;
    paintPrimitive(ctx, prim, { stroke: palette.muted, fill: 'none', tag: scene.symbolPrefix });
    ctx.restore();
  });

  scene.primitives.forEach(prim => {
    if (!layerState(scene.layers, prim.layerId).visible) return;
    const selected = scene.selectedIds?.includes(prim.id);
    let stroke = prim.stroke;
    let fill = prim.fill;
    if (scene.previewActive && scene.spriteMode === 'rest') {
      if (scene.previewRole === 'coil' || scene.previewRole === 'motor') stroke = '#00e676';
      if (scene.previewRole === 'load') {
        stroke = '#ffd600';
        if (fill && fill !== 'none') fill = '#ffd600';
      }
    }
    paintPrimitive(ctx, prim, {
      stroke: selected ? palette.text : stroke,
      fill,
      extraWidth: selected ? 0.45 : 0,
      tag: `${scene.symbolPrefix || 'K'}1`
    });
  });

  paintDraft(ctx, scene);
  (scene.guides || []).forEach(guide => {
    ctx.save();
    ctx.strokeStyle = palette.guide;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.beginPath();
    ctx.moveTo(guide.x1, guide.y1);
    ctx.lineTo(guide.x2, guide.y2);
    ctx.stroke();
    ctx.restore();
  });

  if (scene.marquee) {
    const { x1, y1, x2, y2 } = scene.marquee;
    const windowMode = x2 >= x1;
    ctx.save();
    ctx.fillStyle = windowMode ? palette.selectFill : palette.liveFill;
    ctx.strokeStyle = windowMode ? palette.select : palette.live;
    ctx.lineWidth = 1 / zoom;
    if (!windowMode) ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.restore();
  }

  paintSelection(ctx, scene);
  paintNodes(ctx, scene);
  paintPinLinks(ctx, scene);
  paintPins(ctx, scene);
  paintSnap(ctx, scene);
  ctx.restore();
}

function paintDraft(ctx, scene) {
  const draft = scene.draft;
  if (!draft) return;
  const palette = canvasPalette();
  ctx.save();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 1.3;
  if (scene.lineDash === 'dot' || scene.lineDash === 'dash') {
    ctx.setLineDash(dashSegments(scene.lineDash));
    if (scene.lineDash === 'dot') ctx.lineCap = 'round';
  } else {
    ctx.setLineDash([5 / scene.zoom, 4 / scene.zoom]);
  }
  if (draft.type === 'line' && draft.points?.length) {
    ctx.beginPath();
    ctx.moveTo(draft.points[0].x, draft.points[0].y);
    draft.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    if (scene.cursor) ctx.lineTo(scene.cursor.x, scene.cursor.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = palette.gold;
    draft.points.forEach(point => ctx.fillRect(point.x - 1.2, point.y - 1.2, 2.4, 2.4));
  } else if (draft.type === 'rect') {
    const x = Math.min(draft.x1, draft.x2);
    const y = Math.min(draft.y1, draft.y2);
    ctx.strokeRect(x, y, Math.abs(draft.x2 - draft.x1), Math.abs(draft.y2 - draft.y1));
  } else if (draft.type === 'circle') {
    ctx.beginPath();
    ctx.arc(draft.cx, draft.cy, Math.hypot(draft.x2 - draft.cx, draft.y2 - draft.cy), 0, Math.PI * 2);
    ctx.stroke();
  } else if (draft.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(draft.cx, draft.cy, Math.max(0.2, Math.abs(draft.rx)), Math.max(0.2, Math.abs(draft.ry)), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (draft.type === 'arc' && draft.phase >= 1) {
    ctx.beginPath();
    ctx.arc(draft.cx, draft.cy, draft.r, draft.startAngle, draft.endAngle);
    ctx.stroke();
  } else if (draft.type === 'bezier' && draft.nodes?.length) {
    paintPrimitive(ctx, { ...draft, type: 'bezier' }, { stroke: palette.gold, fill: 'none' });
    const last = draft.nodes[draft.nodes.length - 1];
    if (scene.cursor && !draft.dragging) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(scene.cursor.x, scene.cursor.y);
      ctx.stroke();
    }
  } else if (draft.type === 'mirror' && draft.anchor && scene.cursor) {
    ctx.beginPath();
    ctx.moveTo(draft.anchor.x, draft.anchor.y);
    ctx.lineTo(scene.cursor.x, scene.cursor.y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintSelection(ctx, scene) {
  if (!scene.selectedIds?.length) return;
  if (scene.tool === 'nodes') return;
  const selected = scene.primitives.filter(prim => scene.selectedIds.includes(prim.id));
  const box = boundsOfMany(selected);
  if (!box) return;
  const pad = 3 / scene.zoom;
  ctx.save();
  const palette = canvasPalette();
  ctx.strokeStyle = palette.select;
  ctx.lineWidth = 1 / scene.zoom;
  ctx.setLineDash([4 / scene.zoom, 3 / scene.zoom]);
  ctx.strokeRect(box.minX - pad, box.minY - pad, box.maxX - box.minX + pad * 2, box.maxY - box.minY + pad * 2);
  ctx.setLineDash([]);
  const grip = 7 / scene.zoom;
  handlePositions(box).forEach(point => {
    ctx.fillStyle = palette.inset;
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 1 / scene.zoom;
    ctx.fillRect(point.x - grip / 2, point.y - grip / 2, grip, grip);
    ctx.strokeRect(point.x - grip / 2, point.y - grip / 2, grip, grip);
  });
  const pivot = scene.pivot || { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const rotateAt = { x: (box.minX + box.maxX) / 2, y: box.minY - 22 / scene.zoom };
  ctx.strokeStyle = palette.gold;
  ctx.beginPath();
  ctx.moveTo(pivot.x, box.minY);
  ctx.lineTo(rotateAt.x, rotateAt.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rotateAt.x, rotateAt.y, 4.5 / scene.zoom, 0, Math.PI * 2);
  ctx.fillStyle = palette.gold;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 3.5 / scene.zoom, 0, Math.PI * 2);
  ctx.fillStyle = palette.guide;
  ctx.fill();
  ctx.restore();
}

function paintNodes(ctx, scene) {
  if (scene.tool !== 'nodes') return;
  const targetId = scene.selectedNode?.primId || scene.selectedIds?.[0];
  const prim = scene.primitives.find(item => item.id === targetId);
  if (!prim) return;
  const palette = canvasPalette();
  const grip = 4.6 / scene.zoom;
  primitiveNodes(prim).forEach(node => {
    const active = scene.selectedNode
      && scene.selectedNode.primId === prim.id
      && scene.selectedNode.kind === node.kind
      && scene.selectedNode.index === node.index;
    const handle = node.kind.startsWith('handle');
    ctx.beginPath();
    if (handle) {
      const anchor = (prim.nodes || [])[node.index];
      if (anchor) {
        ctx.strokeStyle = palette.muted;
        ctx.lineWidth = 1 / scene.zoom;
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, grip / 2, 0, Math.PI * 2);
      ctx.fillStyle = active ? palette.gold : palette.accent;
      ctx.fill();
    } else {
      ctx.fillStyle = active ? palette.gold : palette.inset;
      ctx.strokeStyle = active ? palette.gold : palette.text;
      ctx.lineWidth = 1 / scene.zoom;
      ctx.fillRect(node.x - grip / 2, node.y - grip / 2, grip, grip);
      ctx.strokeRect(node.x - grip / 2, node.y - grip / 2, grip, grip);
    }
  });
}

function paintPinLinks(ctx, scene) {
  const byId = new Map((scene.pins || []).map(pin => [pin.id, pin]));
  (scene.pinLinks || []).forEach(link => {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to || link.from === link.to) return;
    ctx.save();
    ctx.strokeStyle = canvasPalette().liveLine;
    ctx.setLineDash([5 / scene.zoom, 3 / scene.zoom]);
    ctx.lineWidth = 1.2 / scene.zoom;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = 7 / scene.zoom;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - size * Math.cos(angle - 0.45), to.y - size * Math.sin(angle - 0.45));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - size * Math.cos(angle + 0.45), to.y - size * Math.sin(angle + 0.45));
    ctx.stroke();
    ctx.restore();
  });
}

function paintPins(ctx, scene) {
  (scene.pins || []).forEach(pin => {
    const selected = scene.selectedPinId === pin.id;
    const radius = pin.r ?? scene.pinRadius ?? 1.5;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
    const palette = canvasPalette();
    ctx.fillStyle = selected ? palette.text : palette.pin;
    ctx.fill();
    ctx.strokeStyle = selected ? palette.gold : palette.accent;
    ctx.lineWidth = Math.max(0.35, 0.8 / scene.zoom);
    ctx.stroke();
    if (selected || scene.zoom >= 2) {
      ctx.font = `${9 / scene.zoom}px Consolas, monospace`;
      ctx.fillStyle = selected ? palette.gold : palette.titleLabel;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(pin.label || pin.id, pin.x, pin.y - radius - 3 / scene.zoom);
    }
  });
}

function paintSnap(ctx, scene) {
  const marker = scene.snapMarker;
  if (!marker || marker.kind === 'free') return;
  ctx.save();
  const palette = canvasPalette();
  ctx.strokeStyle = marker.kind === 'grid' ? palette.accentLine : palette.gold;
  ctx.lineWidth = 1.2 / scene.zoom;
  const arm = 4.5 / scene.zoom;
  ctx.beginPath();
  if (marker.kind === 'endpoint' || marker.kind === 'grid' || marker.kind === 'ortho') {
    ctx.strokeRect(marker.x - arm, marker.y - arm, arm * 2, arm * 2);
  } else if (marker.kind === 'midpoint') {
    ctx.moveTo(marker.x, marker.y - arm);
    ctx.lineTo(marker.x + arm, marker.y + arm);
    ctx.lineTo(marker.x - arm, marker.y + arm);
    ctx.closePath();
    ctx.stroke();
  } else if (marker.kind === 'center') {
    ctx.arc(marker.x, marker.y, arm, 0, Math.PI * 2);
    ctx.stroke();
  } else if (marker.kind === 'intersection') {
    ctx.moveTo(marker.x - arm, marker.y - arm);
    ctx.lineTo(marker.x + arm, marker.y + arm);
    ctx.moveTo(marker.x + arm, marker.y - arm);
    ctx.lineTo(marker.x - arm, marker.y + arm);
    ctx.stroke();
  } else if (marker.kind === 'perpendicular') {
    ctx.strokeRect(marker.x - arm, marker.y - arm, arm * 1.3, arm * 1.3);
    ctx.beginPath();
    ctx.moveTo(marker.x - arm, marker.y);
    ctx.lineTo(marker.x - arm, marker.y - arm);
    ctx.stroke();
  }
  ctx.restore();
}

export function draftCursor(draft, point) {
  if (!draft) return point;
  if (draft.type === 'line') return point;
  return point;
}

export function lineDraftPoints(draft) {
  return draft?.type === 'line' ? linePoints({ points: draft.points, x1: 0, y1: 0, x2: 0, y2: 0 }).filter((_, index, list) => list.length) : [];
}
