import { useEffect, useRef, useState } from 'react';
import {
  alignTranslation,
  axisLock,
  lineNeighbor,
  boundsCenter,
  boundsOf,
  boundsOfMany,
  cloneData,
  dist,
  finePoint,
  handlePositions,
  hitPrimitive,
  insertNode,
  layerState,
  linePoints,
  mirrorPrimitive,
  moveNode,
  primitiveNodes,
  removeNode,
  resolvePoint,
  rotatePrimitive,
  scalePrimitive,
  selectionHits,
  translatePrimitive,
  uid,
  weldLines
} from './geometry';
import { paintEditor } from './paintScene';
import { getPlanThemeId, subscribePlanTheme } from '../../theme/planThemes';

const TOOL_KEYS = {
  v: 'select',
  n: 'nodes',
  h: 'pan',
  l: 'line',
  r: 'rect',
  c: 'circle',
  e: 'ellipse',
  p: 'bezier',
  a: 'arc',
  t: 'text',
  m: 'move',
  q: 'rotate',
  k: 'scale',
  x: 'mirror',
  b: 'pin'
};

function blankPrimitive(type, layerId, fields) {
  return {
    id: uid('prim'),
    type,
    stroke: '#00e5ff',
    strokeWidth: 2,
    fill: 'none',
    layerId: layerId || 'geom',
    ...fields
  };
}

function rectFromDrag(x1, y1, x2, y2, square, fromCenter) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  if (fromCenter) {
    return {
      x: x1 - Math.abs(dx),
      y: y1 - Math.abs(dy),
      width: Math.abs(dx) * 2,
      height: Math.abs(dy) * 2
    };
  }
  return {
    x: Math.min(x1, x1 + dx),
    y: Math.min(y1, y1 + dy),
    width: Math.abs(dx),
    height: Math.abs(dy)
  };
}

export function useCadDraw({
  enabled,
  canvasRef,
  primitives,
  setPrimitives,
  layers,
  activeLayerId,
  historyKey,
  gridSize,
  gridSnap,
  objectSnap,
  zoom,
  setZoom,
  pan,
  setPan,
  pins,
  setPins,
  pinLinks,
  pinRadius,
  ghost,
  symbolWidth,
  symbolHeight,
  symbolPrefix,
  spriteMode,
  previewActive,
  previewRole,
  onEscape,
  onToggleGrid,
  onToggleObjectSnap,
  onToggleFullscreen
}) {
  const [tool, setToolState] = useState('select');
  const [selectedIds, setSelectedIdsState] = useState([]);
  const [selectedNode, setSelectedNodeState] = useState(null);
  const [selectedPinId, setSelectedPinIdState] = useState(null);
  const [draft, setDraftState] = useState(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [snapMarker, setSnapMarker] = useState(null);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [pivot, setPivotState] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [historyTick, setHistoryTick] = useState(0);
  const [themeId, setThemeId] = useState(getPlanThemeId);
  const [orthoLock, setOrthoLock] = useState(false);
  const [lineDash, setLineDash] = useState('solid');

  useEffect(() => subscribePlanTheme(setThemeId), []);

  const primRef = useRef(primitives);
  const layersRef = useRef(layers);
  const toolRef = useRef(tool);
  const selectedRef = useRef(selectedIds);
  const nodeRef = useRef(selectedNode);
  const pinIdRef = useRef(selectedPinId);
  const pinsRef = useRef(pins);
  const draftRef = useRef(draft);
  const pivotRef = useRef(pivot);
  const viewRef = useRef({ zoom, pan });
  const gridRef = useRef({ gridSize, gridSnap, objectSnap, activeLayerId, pinRadius });
  const gestureRef = useRef(null);
  const spaceRef = useRef(false);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const apiRef = useRef({});
  const callbackRef = useRef({});
  const ghostRef = useRef(ghost);
  const orthoRef = useRef(false);
  const dashRef = useRef('solid');

  primRef.current = primitives;
  layersRef.current = layers;
  toolRef.current = tool;
  selectedRef.current = selectedIds;
  nodeRef.current = selectedNode;
  pinIdRef.current = selectedPinId;
  pinsRef.current = pins;
  draftRef.current = draft;
  pivotRef.current = pivot;
  viewRef.current = { zoom, pan };
  ghostRef.current = ghost;
  orthoRef.current = orthoLock;
  dashRef.current = lineDash;
  gridRef.current = { gridSize, gridSnap, objectSnap, activeLayerId, pinRadius };
  callbackRef.current = { onEscape, onToggleGrid, onToggleObjectSnap, onToggleFullscreen, setPrimitives, setPins, setZoom, setPan };

  const writeDraft = (next) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const writeSelection = (ids) => {
    selectedRef.current = ids;
    setSelectedIdsState(ids);
  };
  const writeNode = (node) => {
    nodeRef.current = node;
    setSelectedNodeState(node);
  };
  const writePin = (id) => {
    pinIdRef.current = id;
    setSelectedPinIdState(id);
  };

  const bumpHistory = () => setHistoryTick(tick => tick + 1);

  const remember = () => {
    undoRef.current.push(cloneData(primRef.current));
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    bumpHistory();
  };

  const writePrimitives = (next, keepHistory) => {
    if (keepHistory) remember();
    primRef.current = next;
    callbackRef.current.setPrimitives(next);
  };

  const editable = () => primRef.current.filter(prim => {
    const layer = layerState(layersRef.current, prim.layerId);
    return layer.visible && !layer.locked;
  });

  const screenToModel = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (canvas.width / Math.max(rect.width, 1));
    const sy = (clientY - rect.top) * (canvas.height / Math.max(rect.height, 1));
    return {
      x: (sx - canvas.width / 2 - view.pan.x) / view.zoom,
      y: (sy - canvas.height / 2 - view.pan.y) / view.zoom
    };
  };

  const aimedPoint = (raw, extra = {}) => resolvePoint(raw, {
    primitives: primRef.current,
    layers: layersRef.current,
    zoom: viewRef.current.zoom,
    gridSize: gridRef.current.gridSize,
    gridSnap: extra.free ? false : gridRef.current.gridSnap,
    objectSnap: gridRef.current.objectSnap,
    fromPoint: extra.fromPoint || null,
    ignoreIds: extra.ignoreIds || [],
    free: !!extra.free
  });

  const withDash = (fields = {}) => {
    const dash = dashRef.current;
    if (!dash || dash === 'solid') return fields;
    return { dash, ...fields };
  };

  const placePoint = (raw, anchor, extra = {}) => {
    const aimed = aimedPoint(raw, { ...extra, fromPoint: extra.fromPoint ?? anchor ?? null });
    if (orthoRef.current && anchor) return axisLock(anchor, aimed);
    return aimed;
  };

  const finishOpenDraft = () => {
    const current = draftRef.current;
    if (!current) return primRef.current;
    if (current.type === 'line' && current.points.length >= 2) {
      const created = blankPrimitive('line', gridRef.current.activeLayerId, withDash());
      const withPoints = {
        ...created,
        points: current.points.map(point => ({ x: point.x, y: point.y })),
        x1: current.points[0].x,
        y1: current.points[0].y,
        x2: current.points[current.points.length - 1].x,
        y2: current.points[current.points.length - 1].y
      };
      const next = [...primRef.current, withPoints];
      writePrimitives(next, true);
      writeSelection([withPoints.id]);
      writeDraft(null);
      return next;
    }
    if (current.type === 'bezier' && current.nodes.length >= 2) {
      const created = blankPrimitive('bezier', gridRef.current.activeLayerId, withDash({
        nodes: current.nodes,
        closed: !!current.closed
      }));
      const next = [...primRef.current, created];
      writePrimitives(next, true);
      writeSelection([created.id]);
      writeDraft(null);
      return next;
    }
    writeDraft(null);
    return primRef.current;
  };

  const undo = () => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(cloneData(primRef.current));
    primRef.current = previous;
    callbackRef.current.setPrimitives(previous);
    writeSelection([]);
    writeNode(null);
    bumpHistory();
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(cloneData(primRef.current));
    primRef.current = next;
    callbackRef.current.setPrimitives(next);
    writeSelection([]);
    writeNode(null);
    bumpHistory();
  };

  const removeSelection = () => {
    const node = nodeRef.current;
    if (toolRef.current === 'nodes' && node) {
      const prim = primRef.current.find(item => item.id === node.primId);
      if (!prim) return;
      const result = removeNode(prim, node);
      if (!result) return;
      if (result.removePrimitive) {
        writePrimitives(primRef.current.filter(item => item.id !== prim.id), true);
        writeSelection([]);
        writeNode(null);
        return;
      }
      writePrimitives(primRef.current.map(item => item.id === prim.id ? result.prim : item), true);
      writeNode(null);
      return;
    }
    if (pinIdRef.current) {
      const id = pinIdRef.current;
      callbackRef.current.setPins(pinsRef.current.filter(pin => pin.id !== id));
      writePin(null);
      return;
    }
    if (!selectedRef.current.length) return;
    const drop = new Set(selectedRef.current);
    writePrimitives(primRef.current.filter(prim => !drop.has(prim.id)), true);
    writeSelection([]);
    writeNode(null);
  };

  const updateSelected = (patch) => {
    const ids = selectedRef.current;
    if (!ids.length) return;
    writePrimitives(primRef.current.map(prim => {
      if (!ids.includes(prim.id)) return prim;
      const next = { ...prim, ...patch };
      if (patch.stroke && prim.type === 'text') next.color = patch.stroke;
      return next;
    }), true);
  };

  const setNodePosition = (axis, value) => {
    const node = nodeRef.current;
    if (!node) return;
    const prim = primRef.current.find(item => item.id === node.primId);
    if (!prim) return;
    const grip = primitiveNodes(prim).find(item => item.kind === node.kind && item.index === node.index);
    if (!grip) return;
    const point = { x: grip.x, y: grip.y, [axis]: Number(value) };
    writePrimitives(primRef.current.map(item => item.id === prim.id ? moveNode(item, node, point) : item), true);
  };

  const weld = () => {
    const result = weldLines(primRef.current, selectedRef.current);
    if (!result.joined) return;
    writePrimitives(result.primitives, true);
  };

  const collect = () => finishOpenDraft();

  useEffect(() => {
    undoRef.current = [];
    redoRef.current = [];
    writeDraft(null);
    writeSelection([]);
    writeNode(null);
    writePin(null);
    setPivotState(null);
    pivotRef.current = null;
    gestureRef.current = null;
    bumpHistory();
  }, [historyKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const canvas = canvasRef.current;
    const holder = canvas?.parentElement;
    if (!holder) return undefined;
    const measure = () => {
      const w = Math.max(1, holder.clientWidth);
      const h = Math.max(1, holder.clientHeight);
      setViewport(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(holder);
    return () => observer.disconnect();
  }, [enabled, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (canvas.width !== viewport.w) canvas.width = viewport.w;
    if (canvas.height !== viewport.h) canvas.height = viewport.h;
    const aimed = draftRef.current?.type === 'line' || draftRef.current?.type === 'bezier'
      ? snapMarker
      : snapMarker;
    paintEditor(ctx, {
      width: viewport.w,
      height: viewport.h,
      zoom,
      pan,
      gridSize,
      gridSnap,
      primitives,
      ghost,
      layers,
      draft,
      cursor: aimed && aimed.kind && aimed.kind !== 'free' ? aimed : cursor,
      selectedIds,
      selectedNode,
      tool,
      marquee,
      guides,
      snapMarker,
      pivot,
      pins,
      pinLinks,
      pinRadius,
      selectedPinId,
      symbolWidth,
      symbolHeight,
      symbolPrefix,
      spriteMode,
      previewActive,
      previewRole,
      lineDash
    });
  }, [
    enabled, viewport, zoom, pan, gridSize, gridSnap, primitives, ghost, layers, draft,
    cursor, selectedIds, selectedNode, tool, marquee, guides, snapMarker, pivot, pins, pinLinks,
    pinRadius, selectedPinId, symbolWidth, symbolHeight, symbolPrefix, spriteMode,
    previewActive, previewRole, canvasRef, themeId, lineDash
  ]);

  const changeTool = (next) => {
    finishOpenDraft();
    toolRef.current = next;
    setToolState(next);
    if (next !== 'nodes') writeNode(null);
  };

  apiRef.current.down = (event) => {
    if (!enabled) return;
    const currentTool = toolRef.current;
    if (event.button === 1 || currentTool === 'pan' || spaceRef.current) {
      gestureRef.current = {
        mode: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        originPan: { ...viewRef.current.pan }
      };
      return;
    }
    if (event.button !== 0) return;
    const raw = screenToModel(event.clientX, event.clientY);
    const zoomNow = viewRef.current.zoom;
    const threshold = 7 / zoomNow;

    if (currentTool === 'line') {
      const from = draftRef.current?.type === 'line' ? draftRef.current.points[draftRef.current.points.length - 1] : null;
      const point = placePoint(raw, from);
      setSnapMarker(point);
      const points = draftRef.current?.type === 'line' ? [...draftRef.current.points, point] : [point];
      writeDraft({ type: 'line', points });
      return;
    }

    if (currentTool === 'bezier') {
      const existing = draftRef.current?.type === 'bezier' ? draftRef.current : null;
      const point = aimedPoint(raw, { fromPoint: existing?.nodes?.[existing.nodes.length - 1] || null });
      if (existing && existing.nodes.length >= 3 && dist(point, existing.nodes[0]) <= threshold) {
        const created = blankPrimitive('bezier', gridRef.current.activeLayerId, withDash({ nodes: existing.nodes, closed: true }));
        writePrimitives([...primRef.current, created], true);
        writeSelection([created.id]);
        writeDraft(null);
        return;
      }
      const node = { x: point.x, y: point.y, inX: null, inY: null, outX: null, outY: null };
      const nodes = existing ? [...existing.nodes, node] : [node];
      writeDraft({ type: 'bezier', nodes, dragging: true });
      gestureRef.current = { mode: 'bezier-handle', index: nodes.length - 1, origin: point };
      return;
    }

    if (currentTool === 'arc') {
      const point = aimedPoint(raw);
      const arcDraft = draftRef.current?.type === 'arc' ? draftRef.current : { type: 'arc', phase: 0 };
      if (arcDraft.phase === 0) {
        writeDraft({ type: 'arc', phase: 1, cx: point.x, cy: point.y, r: 0, startAngle: 0, endAngle: 0 });
        return;
      }
      if (arcDraft.phase === 1) {
        const radius = Math.max(0.4, dist(point, { x: arcDraft.cx, y: arcDraft.cy }));
        const angle = Math.atan2(point.y - arcDraft.cy, point.x - arcDraft.cx);
        writeDraft({ ...arcDraft, phase: 2, r: radius, startAngle: angle, endAngle: angle });
        return;
      }
      const created = blankPrimitive('arc', gridRef.current.activeLayerId, withDash({
        cx: arcDraft.cx,
        cy: arcDraft.cy,
        r: arcDraft.r,
        startAngle: arcDraft.startAngle,
        endAngle: Math.atan2(point.y - arcDraft.cy, point.x - arcDraft.cx)
      }));
      writePrimitives([...primRef.current, created], true);
      writeSelection([created.id]);
      writeDraft(null);
      return;
    }

    if (currentTool === 'text') {
      const point = aimedPoint(raw);
      const created = blankPrimitive('text', gridRef.current.activeLayerId === 'geom' ? 'anotacion' : gridRef.current.activeLayerId, {
        x: point.x,
        y: point.y,
        text: '{tag}',
        color: '#ffd600',
        fontSize: 10,
        align: 'center'
      });
      writePrimitives([...primRef.current, created], true);
      writeSelection([created.id]);
      return;
    }

    if (currentTool === 'pin') {
      const point = aimedPoint(raw);
      const label = String(pinsRef.current.length + 1);
      const id = uid('pin');
      callbackRef.current.setPins([...pinsRef.current, { id, label, x: point.x, y: point.y }]);
      writePin(id);
      writeSelection([]);
      return;
    }

    if (currentTool === 'mirror') {
      const point = aimedPoint(raw);
      if (!draftRef.current || draftRef.current.type !== 'mirror') {
        writeDraft({ type: 'mirror', anchor: point });
        return;
      }
      const anchor = draftRef.current.anchor;
      if (dist(anchor, point) < 0.5 || !selectedRef.current.length) {
        writeDraft(null);
        return;
      }
      const ids = new Set(selectedRef.current);
      writePrimitives(primRef.current.map(prim => ids.has(prim.id) ? mirrorPrimitive(prim, anchor, point) : prim), true);
      writeDraft(null);
      return;
    }

    if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'ellipse') {
      const point = aimedPoint(raw);
      gestureRef.current = { mode: `draw-${currentTool}`, x1: point.x, y1: point.y, x2: point.x, y2: point.y };
      if (currentTool === 'rect') writeDraft({ type: 'rect', x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      if (currentTool === 'circle') writeDraft({ type: 'circle', cx: point.x, cy: point.y, x2: point.x, y2: point.y });
      if (currentTool === 'ellipse') writeDraft({ type: 'ellipse', cx: point.x, cy: point.y, rx: 0, ry: 0 });
      return;
    }

    const targets = editable();
    const selectedNow = targets.filter(prim => selectedRef.current.includes(prim.id));
    const box = boundsOfMany(selectedNow);

    if (box && (currentTool === 'select' || currentTool === 'move' || currentTool === 'scale' || currentTool === 'rotate')) {
      const handles = handlePositions(box);
      const handleIndex = handles.findIndex(point => dist(raw, point) <= threshold);
      const center = boundsCenter(box);
      const pivotPoint = pivotRef.current || center;
      const rotateAt = { x: center.x, y: box.minY - 22 / zoomNow };
      if (currentTool === 'select' && handleIndex >= 0) {
        gestureRef.current = { mode: 'scale-handle', handle: handleIndex, originPrims: cloneData(primRef.current), box, ids: [...selectedRef.current] };
        return;
      }
      if ((currentTool === 'select' || currentTool === 'rotate') && dist(raw, rotateAt) <= threshold) {
        gestureRef.current = {
          mode: 'rotate',
          originPrims: cloneData(primRef.current),
          ids: [...selectedRef.current],
          pivot: pivotPoint,
          startAngle: Math.atan2(raw.y - pivotPoint.y, raw.x - pivotPoint.x)
        };
        return;
      }
      if (currentTool === 'select' && dist(raw, pivotPoint) <= threshold) {
        gestureRef.current = { mode: 'pivot', origin: pivotPoint };
        return;
      }
    }

    if (currentTool === 'nodes') {
      const preferred = nodeRef.current?.primId || selectedRef.current[0];
      const ordered = [...targets].reverse();
      const focus = ordered.find(prim => prim.id === preferred) || null;
      const pools = focus ? [focus, ...ordered.filter(prim => prim.id !== focus.id)] : ordered;
      for (const prim of pools) {
        const grips = primitiveNodes(prim);
        const grip = grips.find(item => dist(raw, item) <= threshold);
        if (grip) {
          writeSelection([prim.id]);
          writeNode({ primId: prim.id, kind: grip.kind, index: grip.index });
          const anchor = prim.type === 'line' && grip.kind === 'anchor' ? lineNeighbor(prim, grip.index) : null;
          gestureRef.current = {
            mode: 'node',
            id: prim.id,
            node: { kind: grip.kind, index: grip.index },
            anchor,
            originPrims: cloneData(primRef.current)
          };
          return;
        }
      }
    }

    if (currentTool === 'select' || currentTool === 'move' || currentTool === 'pin') {
      for (const pin of pinsRef.current) {
        const radius = Math.max((pin.r ?? gridRef.current.pinRadius) + 1.2, threshold);
        if (dist(raw, pin) <= radius) {
          writePin(pin.id);
          writeSelection([]);
          writeNode(null);
          gestureRef.current = { mode: 'pin', id: pin.id, grab: { ...raw } };
          return;
        }
      }
    }

    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const prim = targets[index];
      if (!hitPrimitive(prim, raw, threshold)) continue;
      let ids = selectedRef.current.includes(prim.id) ? [...selectedRef.current] : [prim.id];
      if (event.shiftKey && currentTool === 'select') {
        ids = selectedRef.current.includes(prim.id)
          ? selectedRef.current.filter(id => id !== prim.id)
          : [...selectedRef.current, prim.id];
      }
      writeSelection(ids);
      writePin(null);
      if (currentTool === 'nodes') {
        writeNode(null);
        return;
      }
      if (currentTool === 'rotate') {
        const groupBox = boundsOfMany(primRef.current.filter(item => ids.includes(item.id)));
        const pivotPoint = pivotRef.current || (groupBox ? boundsCenter(groupBox) : raw);
        gestureRef.current = {
          mode: 'rotate',
          originPrims: cloneData(primRef.current),
          ids,
          pivot: pivotPoint,
          startAngle: Math.atan2(raw.y - pivotPoint.y, raw.x - pivotPoint.x)
        };
        return;
      }
      if (currentTool === 'scale') {
        const groupBox = boundsOfMany(primRef.current.filter(item => ids.includes(item.id)));
        const origin = groupBox ? boundsCenter(groupBox) : raw;
        gestureRef.current = {
          mode: 'scale-free',
          originPrims: cloneData(primRef.current),
          ids,
          origin,
          startDist: Math.max(0.5, dist(raw, origin))
        };
        return;
      }
      gestureRef.current = {
        mode: 'move',
        originPrims: cloneData(primRef.current),
        ids,
        grab: { ...raw }
      };
      setPivotState(null);
      pivotRef.current = null;
      return;
    }

    if (currentTool === 'nodes') {
      writeNode(null);
      writeSelection([]);
      return;
    }

    if (currentTool === 'select') {
      gestureRef.current = { mode: 'marquee', x1: raw.x, y1: raw.y, x2: raw.x, y2: raw.y, shift: event.shiftKey };
      setMarquee({ x1: raw.x, y1: raw.y, x2: raw.x, y2: raw.y });
      if (!event.shiftKey) {
        writeSelection([]);
        writePin(null);
        writeNode(null);
      }
    }
  };

  apiRef.current.move = (event) => {
    const canvas = canvasRef.current;
    const gesture = gestureRef.current;
    if (!gesture && event.target !== canvas) return;
    const raw = screenToModel(event.clientX, event.clientY);
    setCursor(raw);
    if (!gesture) {
      const from = draftRef.current?.type === 'line'
        ? draftRef.current.points[draftRef.current.points.length - 1]
        : draftRef.current?.type === 'bezier'
          ? draftRef.current.nodes[draftRef.current.nodes.length - 1]
          : null;
      const marker = draftRef.current?.type === 'line' ? placePoint(raw, from) : aimedPoint(raw, { fromPoint: from });
      setSnapMarker(marker);
      if (draftRef.current?.type === 'line' && orthoRef.current && from) setCursor(marker);
      if (draftRef.current?.type === 'arc' && draftRef.current.phase === 2) {
        writeDraft({
          ...draftRef.current,
          endAngle: Math.atan2(marker.y - draftRef.current.cy, marker.x - draftRef.current.cx)
        });
      }
      return;
    }

    if (gesture.mode === 'pan') {
      callbackRef.current.setPan({
        x: gesture.originPan.x + (event.clientX - gesture.startX),
        y: gesture.originPan.y + (event.clientY - gesture.startY)
      });
      return;
    }

    let point = aimedPoint(raw, { ignoreIds: gesture.ids || (gesture.id ? [gesture.id] : []) });
    if (gesture.mode === 'node' && orthoRef.current && gesture.anchor) point = axisLock(gesture.anchor, point);
    setSnapMarker(point);

    if (gesture.mode === 'draw-rect') {
      const shape = rectFromDrag(gesture.x1, gesture.y1, point.x, point.y, event.shiftKey, event.altKey);
      gesture.x2 = point.x;
      gesture.y2 = point.y;
      gesture.square = event.shiftKey;
      gesture.fromCenter = event.altKey;
      writeDraft({ type: 'rect', x1: shape.x, y1: shape.y, x2: shape.x + shape.width, y2: shape.y + shape.height });
      return;
    }
    if (gesture.mode === 'draw-circle') {
      gesture.x2 = point.x;
      gesture.y2 = point.y;
      gesture.diameter = event.altKey;
      const cx = event.altKey ? (gesture.x1 + point.x) / 2 : gesture.x1;
      const cy = event.altKey ? (gesture.y1 + point.y) / 2 : gesture.y1;
      writeDraft({ type: 'circle', cx, cy, x2: point.x, y2: point.y });
      return;
    }
    if (gesture.mode === 'draw-ellipse') {
      let rx = Math.abs(point.x - gesture.x1);
      let ry = Math.abs(point.y - gesture.y1);
      if (event.shiftKey) rx = ry = Math.max(rx, ry);
      const cx = event.altKey ? gesture.x1 : gesture.x1 + (point.x >= gesture.x1 ? rx / (event.altKey ? 1 : 2) : -rx / 2);
      const cy = event.altKey ? gesture.y1 : gesture.y1 + (point.y >= gesture.y1 ? ry / 2 : -ry / 2);
      gesture.rx = rx;
      gesture.ry = ry;
      gesture.cx = event.altKey ? gesture.x1 : Math.min(gesture.x1, point.x) + rx / 2;
      gesture.cy = event.altKey ? gesture.y1 : Math.min(gesture.y1, point.y) + ry / 2;
      writeDraft({ type: 'ellipse', cx: gesture.cx, cy: gesture.cy, rx, ry });
      void cx;
      void cy;
      return;
    }
    if (gesture.mode === 'bezier-handle') {
      const current = draftRef.current;
      if (!current) return;
      const nodes = current.nodes.map(item => ({ ...item }));
      const node = nodes[gesture.index];
      if (dist(point, gesture.origin) > 2 / viewRef.current.zoom) {
        node.outX = point.x;
        node.outY = point.y;
        node.inX = gesture.origin.x * 2 - point.x;
        node.inY = gesture.origin.y * 2 - point.y;
      }
      writeDraft({ ...current, nodes, dragging: true });
      return;
    }
    if (gesture.mode === 'marquee') {
      gesture.x2 = raw.x;
      gesture.y2 = raw.y;
      setMarquee({ x1: gesture.x1, y1: gesture.y1, x2: raw.x, y2: raw.y });
      return;
    }
    if (gesture.mode === 'pivot') {
      const next = { x: point.x, y: point.y };
      pivotRef.current = next;
      setPivotState(next);
      return;
    }
    if (gesture.mode === 'pin') {
      callbackRef.current.setPins(pinsRef.current.map(pin => pin.id === gesture.id ? { ...pin, x: point.x, y: point.y } : pin));
      return;
    }
    if (gesture.mode === 'node') {
      const next = gesture.originPrims.map(prim => prim.id === gesture.id ? moveNode(prim, gesture.node, point) : prim);
      if (!gesture.remembered) {
        undoRef.current.push(cloneData(gesture.originPrims));
        redoRef.current = [];
        gesture.remembered = true;
        bumpHistory();
      }
      primRef.current = next;
      callbackRef.current.setPrimitives(next);
      return;
    }

    const apply = (producer) => {
      const next = producer(gesture.originPrims);
      if (!gesture.remembered) {
        undoRef.current.push(cloneData(gesture.originPrims));
        redoRef.current = [];
        gesture.remembered = true;
        bumpHistory();
      }
      primRef.current = next;
      callbackRef.current.setPrimitives(next);
    };

    if (gesture.mode === 'move') {
      let dx = point.x - gesture.grab.x;
      let dy = point.y - gesture.grab.y;
      if (point.kind === 'free' || point.kind === 'grid') {
        const moving = gesture.originPrims.filter(prim => gesture.ids.includes(prim.id));
        const box = boundsOfMany(moving);
        const others = gesture.originPrims
          .filter(prim => !gesture.ids.includes(prim.id))
          .map(boundsOf)
          .filter(Boolean);
        const aligned = alignTranslation(box, others, dx, dy, 6 / viewRef.current.zoom);
        dx = aligned.dx;
        dy = aligned.dy;
        setGuides(aligned.guides);
      } else setGuides([]);
      apply(base => base.map(prim => gesture.ids.includes(prim.id) ? translatePrimitive(prim, dx, dy) : prim));
      return;
    }
    if (gesture.mode === 'scale-handle') {
      const handles = handlePositions(gesture.box);
      const origin = handles[(gesture.handle + 4) % 8];
      const start = handles[gesture.handle];
      const edge = gesture.handle % 2 === 1;
      let sx = 1;
      let sy = 1;
      if (edge && (gesture.handle === 1 || gesture.handle === 5)) {
        sy = (point.y - origin.y) / ((start.y - origin.y) || 1);
        sx = event.shiftKey ? sy : 1;
      } else if (edge) {
        sx = (point.x - origin.x) / ((start.x - origin.x) || 1);
        sy = event.shiftKey ? sx : 1;
      } else {
        sx = (point.x - origin.x) / ((start.x - origin.x) || 1);
        sy = (point.y - origin.y) / ((start.y - origin.y) || 1);
        if (event.shiftKey) {
          const uniform = Math.max(Math.abs(sx), Math.abs(sy));
          sx = Math.sign(sx || 1) * uniform;
          sy = Math.sign(sy || 1) * uniform;
        }
      }
      apply(base => base.map(prim => gesture.ids.includes(prim.id) ? scalePrimitive(prim, origin, sx, sy) : prim));
      return;
    }
    if (gesture.mode === 'scale-free') {
      const factor = dist(point, gesture.origin) / gesture.startDist;
      apply(base => base.map(prim => gesture.ids.includes(prim.id) ? scalePrimitive(prim, gesture.origin, factor, factor) : prim));
      return;
    }
    if (gesture.mode === 'rotate') {
      let delta = Math.atan2(raw.y - gesture.pivot.y, raw.x - gesture.pivot.x) - gesture.startAngle;
      if (event.shiftKey) delta = Math.round(delta / (Math.PI / 12)) * (Math.PI / 12);
      apply(base => base.map(prim => gesture.ids.includes(prim.id) ? rotatePrimitive(prim, gesture.pivot, delta) : prim));
    }
  };

  apiRef.current.up = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setGuides([]);
    if (!gesture) return;
    if (gesture.mode === 'bezier-handle') {
      const current = draftRef.current;
      if (current?.type === 'bezier') writeDraft({ ...current, dragging: false });
      return;
    }
    if (gesture.mode === 'marquee') {
      const travel = Math.hypot((gesture.x2 ?? gesture.x1) - gesture.x1, (gesture.y2 ?? gesture.y1) - gesture.y1);
      setMarquee(null);
      if (travel < 2) return;
      const ids = selectionHits(editable(), { x1: gesture.x1, y1: gesture.y1, x2: gesture.x2, y2: gesture.y2 });
      writeSelection(gesture.shift ? [...new Set([...selectedRef.current, ...ids])] : ids);
      return;
    }
    if (gesture.mode === 'draw-rect') {
      const shape = rectFromDrag(gesture.x1, gesture.y1, gesture.x2 ?? gesture.x1, gesture.y2 ?? gesture.y1, gesture.square, gesture.fromCenter);
      writeDraft(null);
      if (shape.width >= 1 && shape.height >= 1) {
        const created = blankPrimitive('rect', gridRef.current.activeLayerId, withDash(shape));
        writePrimitives([...primRef.current, created], true);
        writeSelection([created.id]);
      }
      return;
    }
    if (gesture.mode === 'draw-circle') {
      const x2 = gesture.x2 ?? gesture.x1;
      const y2 = gesture.y2 ?? gesture.y1;
      const cx = gesture.diameter ? (gesture.x1 + x2) / 2 : gesture.x1;
      const cy = gesture.diameter ? (gesture.y1 + y2) / 2 : gesture.y1;
      const radius = gesture.diameter ? dist({ x: gesture.x1, y: gesture.y1 }, { x: x2, y: y2 }) / 2 : dist({ x: cx, y: cy }, { x: x2, y: y2 });
      writeDraft(null);
      if (radius >= 1) {
        const created = blankPrimitive('circle', gridRef.current.activeLayerId, withDash({ cx, cy, r: finePoint({ x: radius, y: 0 }).x }));
        writePrimitives([...primRef.current, created], true);
        writeSelection([created.id]);
      }
      return;
    }
    if (gesture.mode === 'draw-ellipse') {
      writeDraft(null);
      if ((gesture.rx || 0) >= 1 && (gesture.ry || 0) >= 1) {
        const created = blankPrimitive('ellipse', gridRef.current.activeLayerId, withDash({
          cx: gesture.cx,
          cy: gesture.cy,
          rx: gesture.rx,
          ry: gesture.ry,
          rotation: 0
        }));
        writePrimitives([...primRef.current, created], true);
        writeSelection([created.id]);
      }
    }
  };

  apiRef.current.wheel = (event) => {
    event.preventDefault();
    const raw = screenToModel(event.clientX, event.clientY);
    const nextZoom = Math.min(12, Math.max(0.2, viewRef.current.zoom * (event.deltaY < 0 ? 1.12 : 0.89)));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * (canvas.width / Math.max(rect.width, 1));
    const sy = (event.clientY - rect.top) * (canvas.height / Math.max(rect.height, 1));
    callbackRef.current.setZoom(nextZoom);
    callbackRef.current.setPan({
      x: sx - canvas.width / 2 - raw.x * nextZoom,
      y: sy - canvas.height / 2 - raw.y * nextZoom
    });
  };

  apiRef.current.double = (event) => {
    const currentTool = toolRef.current;
    if (currentTool === 'line' || currentTool === 'bezier') {
      const current = draftRef.current;
      if (current?.type === 'line') {
        const points = current.points.length >= 3 ? current.points.slice(0, -1) : current.points;
        writeDraft({ type: 'line', points });
      }
      finishOpenDraft();
      return;
    }
    if (currentTool !== 'nodes') return;
    const raw = screenToModel(event.clientX, event.clientY);
    const threshold = 8 / viewRef.current.zoom;
    for (let index = editable().length - 1; index >= 0; index -= 1) {
      const prim = editable()[index];
      if (prim.type !== 'line' && prim.type !== 'bezier') continue;
      if (!hitPrimitive(prim, raw, threshold)) continue;
      const inserted = insertNode(prim, raw);
      if (!inserted) continue;
      writePrimitives(primRef.current.map(item => item.id === prim.id ? inserted.prim : item), true);
      writeSelection([prim.id]);
      writeNode({ primId: prim.id, ...inserted.node });
      return;
    }
  };

  apiRef.current.menu = (event) => {
    event.preventDefault();
    if (draftRef.current?.type === 'line' || draftRef.current?.type === 'bezier') finishOpenDraft();
  };

  apiRef.current.key = (event) => {
    if (!enabled) return;
    if (event.target?.closest?.('[data-block-program]')) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
    if (event.code === 'Space') {
      spaceRef.current = true;
      setSpaceDown(true);
      event.preventDefault();
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'a') {
      event.preventDefault();
      writeSelection(editable().map(prim => prim.id));
      return;
    }
    if (event.key === 'Escape') {
      if (draftRef.current) {
        writeDraft(null);
        return;
      }
      if (selectedRef.current.length || nodeRef.current || pinIdRef.current) {
        writeSelection([]);
        writeNode(null);
        writePin(null);
        return;
      }
      callbackRef.current.onEscape?.();
      return;
    }
    if (event.key === 'Enter') {
      finishOpenDraft();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelection();
      return;
    }
    if (event.key === 'F8') {
      event.preventDefault();
      setOrthoLock(value => !value);
      return;
    }
    if (event.key === 'F9') {
      event.preventDefault();
      callbackRef.current.onToggleGrid?.();
      return;
    }
    if (event.key === 'F3') {
      event.preventDefault();
      callbackRef.current.onToggleObjectSnap?.();
      return;
    }
    if (event.key === 'F11') {
      event.preventDefault();
      callbackRef.current.onToggleFullscreen?.();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (TOOL_KEYS[key]) changeTool(TOOL_KEYS[key]);
  };

  apiRef.current.keyup = (event) => {
    if (event.code === 'Space') {
      spaceRef.current = false;
      setSpaceDown(false);
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const down = (event) => apiRef.current.down(event);
    const move = (event) => apiRef.current.move(event);
    const up = () => apiRef.current.up();
    const wheel = (event) => apiRef.current.wheel(event);
    const double = (event) => apiRef.current.double(event);
    const menu = (event) => apiRef.current.menu(event);
    const key = (event) => apiRef.current.key(event);
    const keyup = (event) => apiRef.current.keyup(event);
    canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('dblclick', double);
    canvas.addEventListener('contextmenu', menu);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyup);
    return () => {
      canvas.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', double);
      canvas.removeEventListener('contextmenu', menu);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyup);
      spaceRef.current = false;
      setSpaceDown(false);
    };
  }, [enabled, canvasRef]);

  const statusText = (() => {
    if (tool === 'nodes') return `NODOS · arrastra un vértice · doble clic inserta · Supr quita${orthoLock ? ' · ORTO desde el nodo anterior' : ''}`;
    if (tool === 'line') return `LÍNEA · clic por vértice · Enter, doble clic o botón derecho termina${orthoLock ? ' · ORTO horizontal o vertical desde el último nodo' : ''}`;
    if (tool === 'bezier') return 'PLUMA · clic esquina, arrastre curva · clic en el inicio cierra';
    if (tool === 'select') return 'SELECCIÓN · azul encierra, verde cruza · asas escalan y giran';
    if (tool === 'rect') return 'RECTÁNGULO · Shift cuadrado · Alt desde el centro';
    if (tool === 'circle') return 'CÍRCULO · arrastra el radio · Alt usa el diámetro';
    if (tool === 'ellipse') return 'ELIPSE · Shift radios iguales · Alt desde el centro';
    if (tool === 'arc') return 'ARCO · centro, inicio y fin';
    if (tool === 'text') return 'TEXTO · clic para colocar el rótulo';
    if (tool === 'pin') return 'BORNE · clic para dejar un punto de conexión';
    if (tool === 'move') return 'MOVER · arrastra la selección. Las guías rosas alinean con otras piezas';
    if (tool === 'rotate') return 'ROTAR · arrastra alrededor del pivote rosa · Shift cada 15°';
    if (tool === 'scale') return 'ESCALA · arrastra desde el centro de la selección';
    if (tool === 'mirror') return 'REFLEJO · dos clics marcan el eje';
    if (tool === 'pan') return 'PAN · arrastra el lienzo. También con el botón central o Espacio';
    return '';
  })();

  const aim = snapMarker && snapMarker.kind && snapMarker.kind !== 'free' ? snapMarker : cursor;

  return {
    tool,
    setTool: changeTool,
    selectedIds,
    selectedNode,
    selectedPinId,
    setSelectedPinId: writePin,
    cursor: aim,
    snapKind: snapMarker?.kind || 'free',
    canUndo: undoRef.current.length > 0 || historyTick === -1,
    canRedo: redoRef.current.length > 0 && historyTick !== -1,
    undo,
    redo,
    collect,
    removeSelection,
    updateSelected,
    setNodePosition,
    weld,
    spaceDown,
    statusText,
    orthoLock,
    toggleOrtho: () => setOrthoLock(value => !value),
    lineDash,
    setLineDash
  };
}


