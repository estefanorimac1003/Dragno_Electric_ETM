import React, { useRef, useEffect, useState, useCallback } from 'react';
import { drawSheetBorder, SHEET_SIZES } from '../cad/titleBlock';
import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { renderSymbolPrimitives, symbolHitBox, symbolSprite } from '../cad/symbolStore';
import { canvasPalette, getPlanThemeId, subscribePlanTheme } from '../theme/planThemes';
import { nextRotation, normalizeRotation, pinWorld, worldToLocal } from '../cad/componentPose';
import { labelPartAt, nameHitBox, nameLinePositions, textHitBox, TAG_FONT } from '../cad/componentLabel';
import { negationMarks } from '../cad/outputNot';
import { paintMotorArrow } from '../cad/motorTurn';
import {
  cornerPoint,
  junctionPoints,
  nearestWirePoint,
  routeTo,
  samePoint,
  simplifyPath,
  translateWireGeometry,
  WIRE_JOIN_REACH,
  wireJoinAt
} from '../cad/wireGeometry';
import { itemsInRect } from '../cad/sheetSelection';

function drawJunctionDots(ctx, wires, energized, palette) {
  junctionPoints(wires).forEach(point => {
    const hot = point.wireIds.some(id => energized.has(id));
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = hot ? palette.wireLive : palette.wire;
    ctx.fill();
  });
}

function paintProgramEffect(ctx, comp, def, palette, box) {
  const pins = def?.pins || [];
  (comp.programOutputs || []).forEach(pinId => {
    const pin = pins.find(item => item.id === pinId);
    if (!pin) return;
    const radius = pin.r ?? def?.pinRadius ?? 1.5;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00e676';
    ctx.fill();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = Math.max(0.4, radius * 0.35);
    ctx.stroke();
  });
  (comp.programRares || []).forEach((item, index) => {
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillStyle = palette.tagLive;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.name || 'Salida rara', box.maxX + 8, box.minY + 8 + index * 12);
  });
}

function paintNegationMark(ctx, comp, def, color) {
  negationMarks(comp, def).forEach(mark => {
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, mark.r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

function paintComponentLabel(ctx, comp, def, palette, activePart) {
  const layout = nameLinePositions(comp, def);
  const labels = layout.labels;
  const measure = (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = TAG_FONT;
  ctx.fillStyle = comp.energized ? palette.tagLive : palette.tag;
  if (labels.tag) ctx.fillText(labels.tag, labels.tagX, labels.tagY);
  if (layout.lines.length) {
    ctx.font = layout.font;
    ctx.textAlign = layout.style.align;
    ctx.fillStyle = palette.text;
    layout.lines.forEach(line => {
      if (line.text) ctx.fillText(line.text, line.x, line.y);
    });
  }
  const strokeBox = (box) => {
    if (!box) return;
    ctx.strokeStyle = palette.select;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    ctx.setLineDash([]);
  };
  if (activePart === 'tag' && labels.tag) {
    strokeBox(textHitBox(labels.tagX, labels.tagY, labels.tag, TAG_FONT, measure, 11));
  }
  if (activePart === 'name') strokeBox(nameHitBox(comp, def, measure));
  ctx.restore();
}

export default function CadCanvas({
  sheet,
  activeTool, // 'select' | 'wire' | 'pan' | 'delete' | 'rotate'
  placingSymbol,
  symbolDefs = SYMBOL_DEFINITIONS,
  onPlaceSymbol,
  onUpdateComponent,
  onDeleteComponent,
  onDeleteWire,
  onDeleteSelection,
  onMoveComponents,
  onAddWire,
  selectedElement,
  onSelectElement,
  isSimulating,
  simulatedData,
  gridEnabled = true,
  snapEnabled = true,
  orthoEnabled = true,
  onCursorMove,
  onSimulationPointerDown
}) {
  const canvasRef = useRef(null);

  // Viewport transformation: Pan and Zoom
  const [transform, setTransform] = useState({ scale: 1.0, offsetX: 60, offsetY: 40 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging components, or only their tag
  const [draggingComp, setDraggingComp] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingLabel, setDraggingLabel] = useState(null);
  const [activeLabel, setActiveLabel] = useState(null);
  const [picked, setPicked] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const pickedRef = useRef([]);
  const marqueeRef = useRef(null);
  const groupDragRef = useRef(null);
  const marqueeUpRef = useRef(null);
  pickedRef.current = picked;

  // Wire creation state. A route is the cable the user is still laying down.
  const [wireRoute, setWireRoute] = useState(null); // { points, from, title }
  const wireRouteRef = useRef(null);
  const [pinPrompt, setPinPrompt] = useState(null);
  const [hoverPin, setHoverPin] = useState(null);
  const [hoverJoint, setHoverJoint] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // World coords
  const [screenMousePos, setScreenMousePos] = useState({ x: 0, y: 0 }); // Screen coords for crosshairs

  // Animation frame for simulation current flow
  const [animOffset, setAnimOffset] = useState(0);
  const motorSpinRef = useRef(0);
  const [themeId, setThemeId] = useState(getPlanThemeId);

  useEffect(() => subscribePlanTheme(setThemeId), []);

  useEffect(() => {
    let animId;
    if (isSimulating) {
      const loop = () => {
        motorSpinRef.current += 0.08;
        setAnimOffset(prev => (prev + 1.2) % 24);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isSimulating]);

  // Convert Screen coordinates to Canvas World coordinates
  const screenToWorld = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - transform.offsetX) / transform.scale;
    const y = (screenY - rect.top - transform.offsetY) / transform.scale;
    return { x, y };
  }, [transform]);

  // Snap to Grid (10px / 20px)
  const snapToGrid = useCallback((x, y, gridSize = 10) => {
    if (!snapEnabled) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  }, [snapEnabled]);

  // Components of this sheet, with the solved electrical state while simulating.
  const visibleComponents = useCallback(() => {
    const own = sheet.components || [];
    if (!isSimulating || !simulatedData?.updatedComponents) return own;
    const solved = new Map(simulatedData.updatedComponents.map(comp => [comp.id, comp]));
    return own.map(comp => solved.get(comp.id) || comp);
  }, [sheet.components, simulatedData, isSimulating]);

  const pinTitle = (comp, pin) => `${comp.tag || comp.type} · ${pin.label || pin.id}`;

  const pinsOfComponent = useCallback((comp) => {
    const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
    return (def?.pins || []).map(pin => {
      const world = pinWorld(comp, pin);
      return {
        comp,
        pin,
        x: world.x,
        y: world.y,
        title: pinTitle(comp, pin),
        key: `${comp.id}:${pin.id}`
      };
    });
  }, [symbolDefs]);

  // Nearest terminals, closest first. The wire tool uses this so a click
  // lands on the pin the user aimed at, not the first one inside a wide box.
  const pinsNear = useCallback((worldX, worldY, threshold) => {
    const hits = [];
    visibleComponents().forEach(comp => {
      pinsOfComponent(comp).forEach(pin => {
        const dist = Math.hypot(worldX - pin.x, worldY - pin.y);
        if (dist <= threshold) hits.push({ ...pin, dist });
      });
    });
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }, [visibleComponents, pinsOfComponent]);

  // Find Component at given world coordinates
  const findComponentAt = useCallback((worldX, worldY) => {
    const comps = visibleComponents();
    // Traverse backwards so top-most is selected first
    for (let i = comps.length - 1; i >= 0; i--) {
      const comp = comps[i];
      const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
      const box = symbolHitBox(def);
      const local = worldToLocal(comp, worldX, worldY);
      if (
        local.x >= box.minX &&
        local.x <= box.maxX &&
        local.y >= box.minY &&
        local.y <= box.maxY
      ) {
        return comp;
      }
    }
    return null;
  }, [visibleComponents, symbolDefs]);

  const measureLabel = useCallback((text, font) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return String(text || '').length * 7;
    ctx.save();
    ctx.font = font;
    const width = ctx.measureText(String(text || '')).width;
    ctx.restore();
    return width;
  }, []);

  // Tag and name are separate texts. The hit says which one was grabbed.
  const findLabelHit = useCallback((worldX, worldY) => {
    const comps = visibleComponents();
    for (let i = comps.length - 1; i >= 0; i--) {
      const comp = comps[i];
      const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
      const hit = labelPartAt(comp, def, worldX, worldY, measureLabel);
      if (hit) return { comp, ...hit };
    }
    return null;
  }, [visibleComponents, symbolDefs, measureLabel]);

  // Find Wire near world coordinates
  const findWireAt = useCallback((worldX, worldY, threshold = 8) => (
    nearestWirePoint(sheet.wires, worldX, worldY, threshold)?.wire || null
  ), [sheet.wires]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const palette = canvasPalette();

    // Clear the area around the sheet
    ctx.fillStyle = palette.inset;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply pan and zoom
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    // 1. Draw Sheet Boundary and Technical Title Block (Cajetín)
    drawSheetBorder(ctx, {
      sizeKey: sheet.sizeKey || 'A4_HORIZONTAL',
      projectName: 'SISTEMA CONTROLMAX 360',
      sheetTitle: sheet.title || 'Circuito Eléctrico',
      company: 'DRAGNO ELECTRIC CAD',
      date: new Date().toLocaleDateString(),
      pageIndex: 1,
      totalPages: 1
    });

    // 2. Draw AutoCAD Grid
    if (gridEnabled) {
      drawCadGrid(ctx, sheet.width || 1100, sheet.height || 750);
    }

    // 3. Draw Wires
    const wires = sheet.wires || [];
    const energizedWires = simulatedData?.energizedWires || new Set();

    wires.forEach(wire => {
      const isEnergized = isSimulating && energizedWires.has(wire.id);
      const isSelected = picked.some(item => item.type === 'wire' && item.id === wire.id)
        || (selectedElement?.type === 'wire' && selectedElement.id === wire.id);

      drawWire(ctx, wire, isEnergized, isSelected, animOffset);
    });

    // 4. Draw Components
    const components = visibleComponents();
    components.forEach(comp => {
      const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
      const isSelected = picked.some(item => item.type === 'component' && item.id === comp.id)
        || (selectedElement?.type === 'component' && selectedElement.id === comp.id);

      ctx.save();
      ctx.translate(comp.x, comp.y);
      const rotation = normalizeRotation(comp.rotation);
      const box = symbolHitBox(def);

      ctx.save();
      ctx.rotate((rotation * Math.PI) / 180);

      // Selected element aura glow
      if (isSelected) {
        ctx.strokeStyle = palette.select;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
        ctx.setLineDash([]);
      }

      // Built-in symbols use their state-aware drawing so contacts, coils and
      // lamps react while the simulation is running. Custom pieces use primitives.
      let drawn = false;
      if (def && typeof def.draw === 'function' && !def.isCustom) {
        def.draw(ctx, comp, isSimulating);
        drawn = true;
      }
      const sprite = symbolSprite(def, comp);
      if (!drawn && sprite.primitives.length > 0) {
        drawn = renderSymbolPrimitives(ctx, sprite.primitives, comp, isSimulating, def, {
          preserveColors: sprite.actuated
        });
      }
      if (!drawn && def && typeof def.draw === 'function') {
        def.draw(ctx, comp, isSimulating);
      }

      paintNegationMark(ctx, comp, def, palette.tag);
      if (def?.role === 'motor') {
        paintMotorArrow(ctx, comp, palette, motorSpinRef.current, isSimulating && !!comp.energized);
      }

      // Draw Pins snap dots in the piece frame, so they turn with it.
      if (def?.pins && (activeTool === 'wire' || activeTool === 'select' || activeTool === 'rotate')) {
        def.pins.forEach(pin => {
          const pinRadius = pin.r ?? def.pinRadius ?? 1.5;
          ctx.beginPath();
          ctx.arc(pin.x, pin.y, pinRadius, 0, Math.PI * 2);
          ctx.fillStyle = palette.pin;
          ctx.fill();
          ctx.strokeStyle = palette.text;
          ctx.lineWidth = Math.max(0.4, pinRadius * 0.35);
          ctx.stroke();

          const pinKey = `${comp.id}:${pin.id}`;
          const routePin = wireRoute?.from?.kind === 'pin' ? wireRoute.from : null;
          const aimed = activeTool === 'wire' && (hoverPin?.key === pinKey || (routePin?.compId === comp.id && routePin?.pinId === pin.id));
          if (aimed) {
            ctx.beginPath();
            ctx.arc(pin.x, pin.y, pinRadius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
          if (activeTool === 'wire') {
            ctx.font = 'bold 9px Consolas, monospace';
            ctx.fillStyle = aimed ? palette.accent : palette.gold;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(pin.label || pin.id, pin.x + pinRadius + 3, pin.y - 2);
          }
        });
      }

      if (isSimulating) paintProgramEffect(ctx, comp, def, palette, box);

      ctx.restore();
      ctx.restore();

      paintComponentLabel(
        ctx,
        comp,
        def,
        palette,
        activeLabel?.id === comp.id ? activeLabel.part : null
      );
    });

    // A circle only where cables actually meet. A plain crossing has no dot.
    drawJunctionDots(ctx, wires, isSimulating ? energizedWires : new Set(), palette);

    // 5. Draw In-Progress Wire Routing (Rubberband)
    if (activeTool === 'wire' && hoverJoint) {
      ctx.beginPath();
      ctx.arc(hoverJoint.x, hoverJoint.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }
    if (wireRoute?.points?.length) {
      const aimed = hoverPin
        ? { x: hoverPin.x, y: hoverPin.y, kind: 'pin' }
        : hoverJoint
          ? { x: hoverJoint.x, y: hoverJoint.y, kind: 'wire' }
          : { x: mousePos.x, y: mousePos.y, kind: 'point' };
      const preview = aimed.kind === 'point'
        ? simplifyPath([
          ...wireRoute.points,
          cornerPoint(wireRoute.points[wireRoute.points.length - 1], aimed, orthoEnabled)
        ])
        : routeTo(wireRoute.points, aimed, orthoEnabled);
      if (preview.length >= 2) {
        ctx.save();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(preview[0].x, preview[0].y);
        for (let i = 1; i < preview.length; i += 1) ctx.lineTo(preview[i].x, preview[i].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Draw Symbol Placement Ghost
    if (placingSymbol) {
      const def = symbolDefs[placingSymbol] || SYMBOL_DEFINITIONS[placingSymbol];
      if (def) {
        ctx.save();
        ctx.translate(mousePos.x, mousePos.y);
        ctx.globalAlpha = 0.65;
        let ghostDrawn = false;
        const ghostSprite = symbolSprite(def, { tag: def.prefix + '?' });
        if (ghostSprite.primitives.length > 0) {
          ghostDrawn = renderSymbolPrimitives(ctx, ghostSprite.primitives, { tag: def.prefix + '?' }, false, def);
        }
        if (!ghostDrawn && typeof def.draw === 'function') {
          def.draw(ctx, { x: 0, y: 0, tag: def.prefix + '?', type: placingSymbol, state: {} }, false);
        }
        paintNegationMark(ctx, { type: placingSymbol }, def, palette.tag);
        if (def?.role === 'motor') paintMotorArrow(ctx, {}, palette, 0, false);
        paintComponentLabel(ctx, {
          x: 0,
          y: 0,
          tag: `${def.prefix || ''}?`,
          rotation: 0
        }, def, palette, false);
        ctx.restore();
      }
    }

    if (marquee) {
      const left = Math.min(marquee.x1, marquee.x2);
      const top = Math.min(marquee.y1, marquee.y2);
      const widthBox = Math.abs(marquee.x2 - marquee.x1);
      const heightBox = Math.abs(marquee.y2 - marquee.y1);
      ctx.save();
      ctx.fillStyle = palette.selectFill || 'rgba(0, 229, 255, 0.16)';
      ctx.strokeStyle = palette.select;
      ctx.lineWidth = 1.25 / transform.scale;
      ctx.setLineDash([5 / transform.scale, 3 / transform.scale]);
      ctx.fillRect(left, top, widthBox, heightBox);
      ctx.strokeRect(left, top, widthBox, heightBox);
      ctx.restore();
    }

    ctx.restore();

    // 7. Draw Screen-Space AutoCAD Crosshairs
    drawAutoCadCrosshair(ctx, screenMousePos.x, screenMousePos.y, width, height, activeTool);

  }, [
    transform, sheet, simulatedData, selectedElement, picked, marquee, activeTool, wireRoute, hoverPin, hoverJoint,
    mousePos, screenMousePos, placingSymbol, animOffset, isSimulating, gridEnabled,
    orthoEnabled, symbolDefs, visibleComponents, themeId, activeLabel
  ]);

  // Draw Grid Lines/Dots
  function drawCadGrid(ctx, w, h) {
    const spacing = 20;
    ctx.save();
    ctx.fillStyle = canvasPalette().grid;

    // Dot grid style (classic AutoCAD style)
    for (let x = 30; x <= w - 30; x += spacing) {
      for (let y = 30; y <= h - 30; y += spacing) {
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  // Draw Wire Segment with Orthogonal styling & Glow
  function drawWire(ctx, wire, isEnergized, isSelected, animOffset) {
    if (!wire.waypoints || wire.waypoints.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(wire.waypoints[0].x, wire.waypoints[0].y);
    for (let i = 1; i < wire.waypoints.length; i++) {
      ctx.lineTo(wire.waypoints[i].x, wire.waypoints[i].y);
    }

    const palette = canvasPalette();
    if (isSelected) {
      ctx.strokeStyle = palette.select;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = palette.select;
      ctx.shadowBlur = 8;
      ctx.stroke();
    } else if (isEnergized) {
      ctx.shadowColor = palette.wireLive;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = palette.wireLive;
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Flow pulse animation
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.text;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -animOffset;
      ctx.stroke();
    } else {
      const ownColor = wire.color && wire.color.toLowerCase() !== '#00e5ff' ? wire.color : '';
      ctx.strokeStyle = ownColor || palette.wire;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw full-canvas AutoCAD Crosshairs & Pickbox
  function drawAutoCadCrosshair(ctx, sx, sy, w, h, tool) {
    if (sx < 0 || sy < 0 || sx > w || sy > h) return;

    ctx.save();
    const palette = canvasPalette();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.crosshairHaloLine;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.crosshairLine;
    ctx.stroke();

    // Central Pickbox square (classic AutoCAD)
    const boxSize = 8;
    ctx.strokeStyle = tool === 'wire' ? palette.accent : palette.gold;
    ctx.strokeRect(sx - boxSize / 2, sy - boxSize / 2, boxSize, boxSize);

    ctx.restore();
  }

  // React's wheel listener is passive, so preventDefault there only warns.
  // The schematic zoom listens on the canvas itself and may cancel the scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const wheel = (event) => {
      event.preventDefault();
      const current = transformRef.current;
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(Math.max(current.scale * zoomFactor, 0.25), 3.5);
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      setTransform({
        scale: newScale,
        offsetX: mouseX - (mouseX - current.offsetX) * (newScale / current.scale),
        offsetY: mouseY - (mouseY - current.offsetY) * (newScale / current.scale)
      });
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  const openPinPrompt = (options, clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || options.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    setPinPrompt({
      sx: clientX - rect.left + 14,
      sy: clientY - rect.top + 14,
      options
    });
  };

  const pinTarget = (hit) => ({
    kind: 'pin',
    compId: hit.comp.id,
    pinId: hit.pin.id,
    x: hit.x,
    y: hit.y,
    title: hit.title
  });

  const rememberRoute = (next) => {
    wireRouteRef.current = next;
    setWireRoute(next);
  };

  // A point on the sheet adds a corner. A pin or a cable finishes the run.
  // The second click of a double-click does not start another cable.
  const takeWireTarget = (target, finishPoint = false) => {
    setPinPrompt(null);
    if (!target) return;
    const point = { x: target.x, y: target.y };
    const route = wireRouteRef.current;
    if (!route) {
      if (finishPoint) return;
      rememberRoute({
        points: [point],
        from: target,
        title: target.title || (target.kind === 'wire' ? 'Unión' : 'Punto')
      });
      return;
    }
    const sameStartPin = target.kind === 'pin'
      && route.from?.kind === 'pin'
      && target.compId === route.from.compId
      && target.pinId === route.from.pinId
      && route.points.length < 2;
    if (sameStartPin) {
      if (!finishPoint) rememberRoute(null);
      return;
    }
    if (target.kind === 'point' && !finishPoint) {
      const next = cornerPoint(route.points[route.points.length - 1], point, orthoEnabled);
      if (samePoint(next, route.points[route.points.length - 1])) return;
      rememberRoute({ ...route, points: [...route.points, next] });
      return;
    }
    const points = routeTo(route.points, point, orthoEnabled);
    if (points.length < 2 || samePoint(points[0], points[points.length - 1])) return;
    const anchor = (item, at) => (
      item.kind === 'pin' ? { compId: item.compId, pinId: item.pinId } : { x: at.x, y: at.y }
    );
    const joins = [];
    if (route.from?.kind === 'wire') joins.push({ wireId: route.from.wireId, point: points[0] });
    if (target.kind === 'wire') joins.push({ wireId: target.wireId, point: points[points.length - 1] });
    onAddWire({
      id: `w_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      from: anchor(route.from, points[0]),
      to: anchor(target, points[points.length - 1]),
      waypoints: points,
      manual: route.points.length > 1 || joins.length > 0
    }, joins);
    rememberRoute(null);
  };

  const defFor = (comp) => symbolDefs[comp?.type] || SYMBOL_DEFINITIONS[comp?.type];

  const beginGroupDrag = (grabX, grabY) => {
    const marked = pickedRef.current;
    groupDragRef.current = {
      grabX,
      grabY,
      origins: marked.filter(entry => entry.type === 'component').map(entry => {
        const comp = (sheet.components || []).find(candidate => candidate.id === entry.id);
        return { id: entry.id, x: comp?.x || 0, y: comp?.y || 0 };
      }),
      wires: marked.filter(entry => entry.type === 'wire').map(entry => {
        const wire = (sheet.wires || []).find(candidate => candidate.id === entry.id);
        if (!wire) return null;
        return {
          id: wire.id,
          waypoints: (wire.waypoints || []).map(point => ({ x: point.x, y: point.y })),
          from: wire.from ? { ...wire.from } : null,
          to: wire.to ? { ...wire.to } : null
        };
      }).filter(Boolean)
    };
  };

  const commitPicked = (items) => {
    const next = items || [];
    pickedRef.current = next;
    setPicked(next);
    if (next.length === 1) {
      const item = next[0];
      if (item.type === 'component') {
        const comp = (sheet.components || []).find(entry => entry.id === item.id);
        onSelectElement(comp ? { type: 'component', id: comp.id, data: comp } : null);
        return;
      }
      const wire = (sheet.wires || []).find(entry => entry.id === item.id);
      onSelectElement(wire ? { type: 'wire', id: wire.id, data: wire } : null);
      return;
    }
    onSelectElement(next.length ? { type: 'group', items: next } : null);
  };

  const togglePicked = (item) => {
    const key = `${item.type}:${item.id}`;
    const current = pickedRef.current;
    const exists = current.some(entry => `${entry.type}:${entry.id}` === key);
    return exists
      ? current.filter(entry => `${entry.type}:${entry.id}` !== key)
      : [...current, item];
  };

  const finishMarquee = (clientX, clientY) => {
    const gesture = marqueeRef.current;
    if (!gesture) return;
    marqueeRef.current = null;
    setMarquee(null);
    if (marqueeUpRef.current) {
      window.removeEventListener('mouseup', marqueeUpRef.current);
      marqueeUpRef.current = null;
    }
    if (!gesture.active) {
      setActiveLabel(null);
      if (!gesture.shift) commitPicked([]);
      return;
    }
    const end = Number.isFinite(clientX) ? screenToWorld(clientX, clientY) : { x: gesture.x2, y: gesture.y2 };
    const hits = itemsInRect(
      sheet.components,
      sheet.wires,
      { x1: gesture.x1, y1: gesture.y1, x2: end.x, y2: end.y },
      defFor
    );
    const next = gesture.shift
      ? [...pickedRef.current, ...hits.filter(hit => !pickedRef.current.some(entry => entry.type === hit.type && entry.id === hit.id))]
      : hits;
    setActiveLabel(null);
    commitPicked(next);
  };

  const handleMouseDown = (e) => {
    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const snapped = snapToGrid(rawWorld.x, rawWorld.y);

    // Middle click OR Pan tool -> Start Panning
    if (e.button === 1 || activeTool === 'pan' || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.offsetX, y: e.clientY - transform.offsetY });
      return;
    }

    if (e.button !== 0) return; // Only left click for actions below

    // 1. Placing a Symbol from Library
    if (placingSymbol) {
      onPlaceSymbol(placingSymbol, snapped.x, snapped.y);
      return;
    }

    // 2. Simulation mode: operate devices. Editing stays suspended.
    if (isSimulating && !placingSymbol) {
      const clickedComp = findLabelHit(rawWorld.x, rawWorld.y)?.comp || findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) onSimulationPointerDown?.(clickedComp.id);
      return;
    }

    // 3. Wire tool. A pin still wins. A click on a cable plants a junction.
    // A click on empty sheet lays the next corner of the cable.
    if (activeTool === 'wire') {
      const radius = Math.max(8, 14 / transform.scale);
      const finishPoint = e.detail >= 2;
      const hits = pinsNear(rawWorld.x, rawWorld.y, radius);
      const ambiguous = hits.length > 1 && hits[1].dist - hits[0].dist < radius * 0.35;
      if (ambiguous) {
        openPinPrompt(hits.slice(0, 8), e.clientX, e.clientY);
        return;
      }
      if (hits.length >= 1) {
        takeWireTarget(pinTarget(hits[0]), finishPoint);
        return;
      }
      const onWire = wireJoinAt(sheet.wires, rawWorld, snapped, WIRE_JOIN_REACH);
      if (onWire) {
        takeWireTarget({
          kind: 'wire',
          wireId: onWire.wire.id,
          x: onWire.point.x,
          y: onWire.point.y,
          title: 'Unión'
        }, finishPoint);
        return;
      }
      const comp = findComponentAt(rawWorld.x, rawWorld.y);
      const options = comp ? pinsOfComponent(comp) : [];
      if (options.length === 1) takeWireTarget(pinTarget(options[0]), finishPoint);
      else if (options.length > 1) openPinPrompt(options, e.clientX, e.clientY);
      else {
        const spot = snapToGrid(rawWorld.x, rawWorld.y);
        takeWireTarget({ kind: 'point', x: spot.x, y: spot.y, title: 'Punto' }, finishPoint);
      }
      return;
    }

    // 4. Delete Tool
    if (activeTool === 'delete') {
      const clickedComp = findLabelHit(rawWorld.x, rawWorld.y)?.comp || findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) {
        onDeleteComponent(clickedComp.id);
        return;
      }
      const clickedWire = findWireAt(rawWorld.x, rawWorld.y);
      if (clickedWire) {
        onDeleteWire(clickedWire.id);
        return;
      }
    }

    // 5. Rotate tool. Each click turns the piece one quarter.
    if (activeTool === 'rotate') {
      const clickedComp = findLabelHit(rawWorld.x, rawWorld.y)?.comp || findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) {
        const rotation = nextRotation(clickedComp.rotation);
        commitPicked([{ type: 'component', id: clickedComp.id }]);
        onUpdateComponent(clickedComp.id, { rotation });
      }
      return;
    }

    // 6. Select & Drag Component
    if (activeTool === 'select') {
      const labelHit = findLabelHit(rawWorld.x, rawWorld.y);
      if (labelHit) {
        const anchorX = labelHit.part === 'name' ? labelHit.labels.nameX : labelHit.labels.tagX;
        const anchorY = labelHit.part === 'name' ? labelHit.labels.nameY : labelHit.labels.tagY;
        const item = { type: 'component', id: labelHit.comp.id };
        commitPicked(e.shiftKey ? togglePicked(item) : [item]);
        setDraggingComp(null);
        groupDragRef.current = null;
        setActiveLabel({ id: labelHit.comp.id, part: labelHit.part });
        setDraggingLabel({
          id: labelHit.comp.id,
          part: labelHit.part,
          grabX: rawWorld.x - anchorX,
          grabY: rawWorld.y - anchorY
        });
        return;
      }

      const clickedComp = findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) {
        const item = { type: 'component', id: clickedComp.id };
        const keepGroup = !e.shiftKey
          && pickedRef.current.length > 1
          && pickedRef.current.some(entry => entry.type === 'component' && entry.id === clickedComp.id);
        if (e.shiftKey) commitPicked(togglePicked(item));
        else if (!keepGroup) commitPicked([item]);
        setActiveLabel(null);
        setDraggingLabel(null);
        if (keepGroup) {
          beginGroupDrag(rawWorld.x, rawWorld.y);
          setDraggingComp(null);
          return;
        }
        groupDragRef.current = null;
        setDraggingComp(clickedComp);
        setDragOffset({ x: rawWorld.x - clickedComp.x, y: rawWorld.y - clickedComp.y });
        return;
      }

      const clickedWire = findWireAt(rawWorld.x, rawWorld.y);
      if (clickedWire) {
        const item = { type: 'wire', id: clickedWire.id };
        const keepGroup = !e.shiftKey
          && pickedRef.current.length > 1
          && pickedRef.current.some(entry => entry.type === 'wire' && entry.id === clickedWire.id);
        if (e.shiftKey) commitPicked(togglePicked(item));
        else if (!keepGroup) commitPicked([item]);
        setDraggingComp(null);
        if (keepGroup) beginGroupDrag(rawWorld.x, rawWorld.y);
        else groupDragRef.current = null;
        return;
      }

      // A press on empty sheet starts the selection margin. A plain click clears it.
      const gesture = {
        x1: rawWorld.x,
        y1: rawWorld.y,
        x2: rawWorld.x,
        y2: rawWorld.y,
        sx: e.clientX,
        sy: e.clientY,
        active: false,
        shift: e.shiftKey
      };
      marqueeRef.current = gesture;
      const onUp = (upEvent) => finishMarquee(upEvent.clientX, upEvent.clientY);
      if (marqueeUpRef.current) window.removeEventListener('mouseup', marqueeUpRef.current);
      marqueeUpRef.current = onUp;
      window.addEventListener('mouseup', onUp);
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setScreenMousePos({ x: sx, y: sy });

    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        offsetX: e.clientX - panStart.x,
        offsetY: e.clientY - panStart.y
      }));
      return;
    }

    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const snapped = snapToGrid(rawWorld.x, rawWorld.y);
    setMousePos(snapped);

    // Notify coordinate bar
    if (onCursorMove) {
      onCursorMove(snapped.x, snapped.y);
    }

    if (activeTool === 'wire') {
      const pinRadius = Math.max(10, 22 / transform.scale);
      const near = pinsNear(rawWorld.x, rawWorld.y, pinRadius);
      const next = near[0] || null;
      setHoverPin(prev => (prev?.key || null) === (next?.key || null) ? prev : next);
      const joint = next ? null : wireJoinAt(sheet.wires, rawWorld, snapped, WIRE_JOIN_REACH);
      const jointPoint = joint
        ? { x: joint.point.x, y: joint.point.y, wireId: joint.wire.id }
        : null;
      setHoverJoint(prev => (
        prev?.x === jointPoint?.x && prev?.y === jointPoint?.y && prev?.wireId === jointPoint?.wireId
          ? prev
          : jointPoint
      ));
    } else if (hoverPin || hoverJoint) {
      setHoverPin(null);
      setHoverJoint(null);
    }

    if (marqueeRef.current && activeTool === 'select') {
      const travel = Math.hypot(e.clientX - marqueeRef.current.sx, e.clientY - marqueeRef.current.sy);
      marqueeRef.current.x2 = rawWorld.x;
      marqueeRef.current.y2 = rawWorld.y;
      if (travel >= 4) {
        marqueeRef.current.active = true;
        setMarquee({
          x1: marqueeRef.current.x1,
          y1: marqueeRef.current.y1,
          x2: rawWorld.x,
          y2: rawWorld.y
        });
      }
      return;
    }

    if (groupDragRef.current && activeTool === 'select' && onMoveComponents) {
      const drag = groupDragRef.current;
      const delta = snapToGrid(rawWorld.x - drag.grabX, rawWorld.y - drag.grabY);
      const componentMoves = (drag.origins || []).map(item => ({
        id: item.id,
        x: item.x + delta.x,
        y: item.y + delta.y
      }));
      const wireMoves = (drag.wires || []).map(wire => translateWireGeometry(wire, delta));
      if (componentMoves.length || wireMoves.length) onMoveComponents(componentMoves, wireMoves);
      return;
    }

    // Dragging a text leaves the piece in place. Dragging the body moves both.
    if (draggingLabel && activeTool === 'select') {
      const comp = (sheet.components || []).find(item => item.id === draggingLabel.id);
      if (comp) {
        const anchor = snapToGrid(rawWorld.x - draggingLabel.grabX, rawWorld.y - draggingLabel.grabY);
        const offset = {
          x: Math.round((anchor.x - comp.x) * 100) / 100,
          y: Math.round((anchor.y - comp.y) * 100) / 100
        };
        onUpdateComponent(comp.id, draggingLabel.part === 'name' ? { nameOffset: offset } : { tagOffset: offset });
      }
    } else if (draggingComp && activeTool === 'select') {
      const newX = snapToGrid(rawWorld.x - dragOffset.x, 0).x;
      const newY = snapToGrid(0, rawWorld.y - dragOffset.y).y;

      onUpdateComponent(draggingComp.id, { x: newX, y: newY });
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) setIsPanning(false);
    finishMarquee(e?.clientX, e?.clientY);
    if (draggingComp) setDraggingComp(null);
    if (draggingLabel) setDraggingLabel(null);
    groupDragRef.current = null;
  };

  // Keyboard shortcut listener (Escape cancels wire, Delete deletes selection)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.querySelector('[data-symbol-editor]')) return;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
      if (e.key === 'Escape') {
        wireRouteRef.current = null;
        setWireRoute(null);
        setPinPrompt(null);
      }
      if (!typing && (e.key === 'r' || e.key === 'R') && !isSimulating && selectedElement?.type === 'component') {
        const comp = (sheet.components || []).find(item => item.id === selectedElement.id);
        if (comp) {
          e.preventDefault();
          onUpdateComponent(comp.id, { rotation: nextRotation(comp.rotation) });
        }
      }
      if (e.key === 'Delete' && !isSimulating) {
        const marked = pickedRef.current;
        if (marked.length > 1 && onDeleteSelection) {
          onDeleteSelection(marked);
          commitPicked([]);
        } else if (selectedElement?.type === 'component') {
          onDeleteComponent(selectedElement.id);
          commitPicked([]);
        } else if (selectedElement?.type === 'wire') {
          onDeleteWire(selectedElement.id);
          commitPicked([]);
        } else if (marked.length === 1 && onDeleteSelection) {
          onDeleteSelection(marked);
          commitPicked([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, picked, onDeleteComponent, onDeleteWire, onDeleteSelection, onSelectElement, onUpdateComponent, isSimulating, sheet.components]);

  useEffect(() => {
    if (activeTool !== 'wire') {
      wireRouteRef.current = null;
      setWireRoute(null);
      setPinPrompt(null);
      setHoverPin(null);
      setHoverJoint(null);
    }
    if (activeTool !== 'select') {
      marqueeRef.current = null;
      setMarquee(null);
      groupDragRef.current = null;
      if (marqueeUpRef.current) {
        window.removeEventListener('mouseup', marqueeUpRef.current);
        marqueeUpRef.current = null;
      }
    }
  }, [activeTool]);

  // Releasing outside the sheet ends the group drag. A removed piece leaves the selection.
  useEffect(() => {
    const onUp = () => {
      groupDragRef.current = null;
      setDraggingComp(current => (current ? null : current));
      setDraggingLabel(current => (current ? null : current));
    };
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      if (marqueeUpRef.current) {
        window.removeEventListener('mouseup', marqueeUpRef.current);
        marqueeUpRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const compIds = new Set((sheet.components || []).map(comp => comp.id));
    const wireIds = new Set((sheet.wires || []).map(wire => wire.id));
    const alive = pickedRef.current.filter(item => (
      item.type === 'component' ? compIds.has(item.id) : item.type === 'wire' && wireIds.has(item.id)
    ));
    if (!selectedElement) {
      if (pickedRef.current.length) commitPicked([]);
      return;
    }
    if (alive.length !== pickedRef.current.length) commitPicked(alive);
  }, [sheet.components, sheet.wires, selectedElement]);

  // Adjust canvas size on container resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-autocad-canvas select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {activeTool === 'select' && !isSimulating && (
        <div className="absolute left-3 top-3 pointer-events-none px-2 py-1 rounded border border-autocad-border bg-autocad-raised/90 text-[11px] text-autocad-cyan">
          Arrastra en el plano. El recuadro marca todo lo que quieras seleccionar.
        </div>
      )}
      {activeTool === 'rotate' && (
        <div className="absolute left-3 top-3 pointer-events-none px-2 py-1 rounded border border-autocad-border bg-autocad-raised/90 text-[11px] text-autocad-cyan">
          Pulsa una pieza para girarla 90°. El ciclo es 90, 180, 270 y 360.
        </div>
      )}
      {activeTool === 'wire' && (
        <div className="absolute left-3 top-3 pointer-events-none px-2 py-1 rounded border border-autocad-border bg-autocad-raised/90 text-[11px] text-autocad-cyan">
          {wireRoute
            ? `Recorrido desde ${wireRoute.title}. Pulsa para doblar. En un cable nace la unión. Doble clic termina.`
            : 'Pulsa un borne o el plano. Junto a otro cable, un clic los une. El área es corta y el círculo marca la unión.'}
        </div>
      )}
      {activeTool === 'wire' && hoverPin && !pinPrompt && (
        <div
          className="absolute pointer-events-none px-1.5 py-0.5 rounded border border-autocad-cyan bg-autocad-raised text-[10px] font-mono text-autocad-cyan"
          style={{ left: screenMousePos.x + 18, top: screenMousePos.y + 18 }}
        >
          {hoverPin.title}
        </div>
      )}
      {pinPrompt && (
        <div
          className="absolute z-20 w-44 max-h-48 overflow-y-auto rounded border border-autocad-cyan bg-autocad-raised shadow-lg"
          style={{ left: pinPrompt.sx, top: pinPrompt.sy }}
        >
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-autocad-textMuted border-b border-autocad-border">
            {wireRoute ? 'Borne de destino' : 'Borne de origen'}
          </p>
          {pinPrompt.options.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => takeWireTarget(pinTarget(option))}
              className="block w-full text-left px-2 py-1 text-[11px] font-mono text-autocad-textBright hover:bg-autocad-chip hover:text-autocad-cyan"
            >
              {option.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
