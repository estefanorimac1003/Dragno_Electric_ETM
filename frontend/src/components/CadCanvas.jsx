import React, { useRef, useEffect, useState, useCallback } from 'react';
import { drawSheetBorder, SHEET_SIZES } from '../cad/titleBlock';
import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { renderSymbolPrimitives, symbolHitBox, symbolSprite } from '../cad/symbolStore';
import { canvasPalette, getPlanThemeId, subscribePlanTheme } from '../theme/planThemes';
import { nextRotation, normalizeRotation, pinWorld, rotatedBounds, worldToLocal } from '../cad/componentPose';

export default function CadCanvas({
  sheet,
  activeTool, // 'select' | 'wire' | 'pan' | 'delete' | 'rotate'
  placingSymbol,
  symbolDefs = SYMBOL_DEFINITIONS,
  onPlaceSymbol,
  onUpdateComponent,
  onDeleteComponent,
  onDeleteWire,
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

  // Dragging components
  const [draggingComp, setDraggingComp] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Wire creation state
  const [wireStartPin, setWireStartPin] = useState(null); // { compId, pinId, x, y, title }
  const [pinPrompt, setPinPrompt] = useState(null);
  const [hoverPin, setHoverPin] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // World coords
  const [screenMousePos, setScreenMousePos] = useState({ x: 0, y: 0 }); // Screen coords for crosshairs

  // Animation frame for simulation current flow
  const [animOffset, setAnimOffset] = useState(0);
  const [themeId, setThemeId] = useState(getPlanThemeId);

  useEffect(() => subscribePlanTheme(setThemeId), []);

  useEffect(() => {
    let animId;
    if (isSimulating) {
      const loop = () => {
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

  // Find Wire near world coordinates
  const findWireAt = useCallback((worldX, worldY, threshold = 8) => {
    const wires = sheet.wires || [];
    for (const wire of wires) {
      if (!wire.waypoints || wire.waypoints.length < 2) continue;
      for (let i = 0; i < wire.waypoints.length - 1; i++) {
        const p1 = wire.waypoints[i];
        const p2 = wire.waypoints[i + 1];
        // Distance from point to segment
        const dist = distToSegment({ x: worldX, y: worldY }, p1, p2);
        if (dist <= threshold) {
          return wire;
        }
      }
    }
    return null;
  }, [sheet.wires]);

  // Distance formula from point to line segment
  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

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
      const isSelected = selectedElement?.type === 'wire' && selectedElement?.id === wire.id;

      drawWire(ctx, wire, isEnergized, isSelected, animOffset);
    });

    // 4. Draw Components
    const components = visibleComponents();
    components.forEach(comp => {
      const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
      const isSelected = selectedElement?.type === 'component' && selectedElement?.id === comp.id;

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
          const aimed = activeTool === 'wire' && (hoverPin?.key === pinKey || (wireStartPin?.compId === comp.id && wireStartPin?.pinId === pin.id));
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

      ctx.restore();

      // The tag stays upright above the turned piece.
      const spun = rotatedBounds(box, rotation);
      ctx.fillStyle = comp.energized ? palette.tagLive : palette.tag;
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(comp.tag || comp.type, (spun.minX + spun.maxX) / 2, spun.minY - 6);

      ctx.restore();
    });

    // 5. Draw In-Progress Wire Routing (Rubberband)
    if (wireStartPin) {
      ctx.save();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Orthogonal routing: (start.x, start.y) -> (start.x, mousePos.y) -> (mousePos.x, mousePos.y)
      ctx.beginPath();
      ctx.moveTo(wireStartPin.x, wireStartPin.y);
      if (orthoEnabled) {
        ctx.lineTo(wireStartPin.x, mousePos.y);
        ctx.lineTo(mousePos.x, mousePos.y);
      } else {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      ctx.stroke();
      ctx.restore();
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
        ctx.restore();
      }
    }

    ctx.restore();

    // 7. Draw Screen-Space AutoCAD Crosshairs
    drawAutoCadCrosshair(ctx, screenMousePos.x, screenMousePos.y, width, height, activeTool);

  }, [
    transform, sheet, simulatedData, selectedElement, activeTool, wireStartPin, hoverPin,
    mousePos, screenMousePos, placingSymbol, animOffset, isSimulating, gridEnabled,
    orthoEnabled, symbolDefs, visibleComponents, themeId
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

    // Draw connection junction dots at start/end
    wire.waypoints.forEach((p, idx) => {
      if (idx === 0 || idx === wire.waypoints.length - 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isEnergized ? palette.wireLive : palette.wire;
        ctx.fill();
      }
    });

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

  const commitWirePin = (hit) => {
    setPinPrompt(null);
    if (!hit) return;
    if (!wireStartPin) {
      setWireStartPin({
        compId: hit.comp.id,
        pinId: hit.pin.id,
        x: hit.x,
        y: hit.y,
        title: hit.title
      });
      return;
    }
    if (hit.comp.id === wireStartPin.compId && hit.pin.id === wireStartPin.pinId) {
      setWireStartPin(null);
      return;
    }
    const waypoints = [
      { x: wireStartPin.x, y: wireStartPin.y },
      orthoEnabled
        ? { x: wireStartPin.x, y: hit.y }
        : { x: hit.x, y: hit.y },
      { x: hit.x, y: hit.y }
    ];
    onAddWire({
      id: `w_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      from: { compId: wireStartPin.compId, pinId: wireStartPin.pinId },
      to: { compId: hit.comp.id, pinId: hit.pin.id },
      waypoints
    });
    setWireStartPin(null);
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
      const clickedComp = findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) onSimulationPointerDown?.(clickedComp.id);
      return;
    }

    // 3. Wire Routing Tool. A direct hit uses that pin. A click on the piece,
    // or two pins equally close, asks which terminal to use.
    if (activeTool === 'wire') {
      const radius = Math.max(8, 14 / transform.scale);
      const hits = pinsNear(rawWorld.x, rawWorld.y, radius);
      const ambiguous = hits.length > 1 && hits[1].dist - hits[0].dist < radius * 0.35;
      if (ambiguous) {
        openPinPrompt(hits.slice(0, 8), e.clientX, e.clientY);
        return;
      }
      if (hits.length === 1 || (hits.length > 1 && !ambiguous)) {
        commitWirePin(hits[0]);
        return;
      }
      const comp = findComponentAt(rawWorld.x, rawWorld.y);
      const options = comp ? pinsOfComponent(comp) : [];
      if (options.length === 1) commitWirePin(options[0]);
      else if (options.length > 1) openPinPrompt(options, e.clientX, e.clientY);
      else setWireStartPin(null);
      return;
    }

    // 4. Delete Tool
    if (activeTool === 'delete') {
      const clickedComp = findComponentAt(rawWorld.x, rawWorld.y);
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
      const clickedComp = findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) {
        const rotation = nextRotation(clickedComp.rotation);
        onSelectElement({
          type: 'component',
          id: clickedComp.id,
          data: { ...clickedComp, rotation }
        });
        onUpdateComponent(clickedComp.id, { rotation });
      }
      return;
    }

    // 6. Select & Drag Component
    if (activeTool === 'select') {
      const clickedComp = findComponentAt(rawWorld.x, rawWorld.y);
      if (clickedComp) {
        onSelectElement({ type: 'component', id: clickedComp.id, data: clickedComp });
        setDraggingComp(clickedComp);
        setDragOffset({ x: rawWorld.x - clickedComp.x, y: rawWorld.y - clickedComp.y });
        return;
      }

      const clickedWire = findWireAt(rawWorld.x, rawWorld.y);
      if (clickedWire) {
        onSelectElement({ type: 'wire', id: clickedWire.id, data: clickedWire });
        return;
      }

      // Deselect if clicking empty canvas
      onSelectElement(null);
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
      const near = pinsNear(rawWorld.x, rawWorld.y, Math.max(10, 22 / transform.scale));
      const next = near[0] || null;
      setHoverPin(prev => (prev?.key || null) === (next?.key || null) ? prev : next);
    } else if (hoverPin) {
      setHoverPin(null);
    }

    // Dragging component logic
    if (draggingComp && activeTool === 'select') {
      const newX = snapToGrid(rawWorld.x - dragOffset.x, 0).x;
      const newY = snapToGrid(0, rawWorld.y - dragOffset.y).y;

      onUpdateComponent(draggingComp.id, { x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
    if (draggingComp) setDraggingComp(null);
  };

  // Keyboard shortcut listener (Escape cancels wire, Delete deletes selection)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.querySelector('[data-symbol-editor]')) return;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
      if (e.key === 'Escape') {
        setWireStartPin(null);
        setPinPrompt(null);
      }
      if (!typing && (e.key === 'r' || e.key === 'R') && !isSimulating && selectedElement?.type === 'component') {
        const comp = (sheet.components || []).find(item => item.id === selectedElement.id);
        if (comp) {
          e.preventDefault();
          onUpdateComponent(comp.id, { rotation: nextRotation(comp.rotation) });
        }
      }
      if (e.key === 'Delete' && selectedElement && !isSimulating) {
        if (selectedElement.type === 'component') {
          onDeleteComponent(selectedElement.id);
        } else if (selectedElement.type === 'wire') {
          onDeleteWire(selectedElement.id);
        }
        onSelectElement(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, onDeleteComponent, onDeleteWire, onSelectElement, onUpdateComponent, isSimulating, sheet.components]);

  useEffect(() => {
    if (activeTool !== 'wire') {
      setWireStartPin(null);
      setPinPrompt(null);
      setHoverPin(null);
    }
  }, [activeTool]);

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
      {activeTool === 'rotate' && (
        <div className="absolute left-3 top-3 pointer-events-none px-2 py-1 rounded border border-autocad-border bg-autocad-raised/90 text-[11px] text-autocad-cyan">
          Pulsa una pieza para girarla 90°. El ciclo es 90, 180, 270 y 360.
        </div>
      )}
      {activeTool === 'wire' && (
        <div className="absolute left-3 top-3 pointer-events-none px-2 py-1 rounded border border-autocad-border bg-autocad-raised/90 text-[11px] text-autocad-cyan">
          {wireStartPin ? `Origen ${wireStartPin.title}. Elige el borne de destino.` : 'Elige el borne. En una pieza con varios pines, pulsa el cuerpo y escoge cuál.'}
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
            {wireStartPin ? 'Borne de destino' : 'Borne de origen'}
          </p>
          {pinPrompt.options.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => commitWirePin(option)}
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
