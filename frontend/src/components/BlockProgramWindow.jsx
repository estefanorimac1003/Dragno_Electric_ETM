import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  BLOCK_H,
  BLOCK_W,
  addBlock,
  blockKindTitle,
  connectBlocks,
  moveBlock,
  portPoint,
  portsOf,
  previewBlockValues,
  removeBlock,
  removeWire,
  updateBlock,
  wirePath
} from '../cad/blockProgram';

const PALETTE = [
  { type: 'const', title: 'Constante', hint: 'Valor fijo' },
  { type: 'var', title: 'Variable', hint: 'Nombre para leer y escribir' },
  { type: 'input', title: 'Entrada', hint: 'Toma un borne de la pieza' },
  { type: 'output', title: 'Salida', hint: 'Entrega a un borne', rare: false },
  { type: 'output', title: 'Salida rara', hint: 'Salida especial, fuera de un borne común', rare: true },
  { type: 'not', title: 'NOT', hint: 'Invierte la señal' },
  { type: 'and', title: 'AND', hint: 'Pide las dos entradas' },
  { type: 'or', title: 'OR', hint: 'Basta una entrada' }
];

const BOARD_W = 2400;
const BOARD_H = 1600;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;
const ZOOM_STOPS = [0.25, 0.35, 0.5, 0.67, 0.85, 1, 1.25, 1.5];

function clampZoom(value) {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  return Math.round(next * 100) / 100;
}

function pointerOnBoard(event, surface, scale) {
  if (!surface) return { x: 0, y: 0 };
  const rect = surface.getBoundingClientRect();
  const zoom = scale || 1;
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom
  };
}

function nextZoomStop(current, direction) {
  if (direction < 0) {
    return [...ZOOM_STOPS].reverse().find(stop => stop < current - 0.001) ?? ZOOM_STOPS[0];
  }
  return ZOOM_STOPS.find(stop => stop > current + 0.001) ?? ZOOM_STOPS[ZOOM_STOPS.length - 1];
}

function toneClass(block, actuated) {
  if (block.type === 'actuated') {
    return actuated
      ? 'border-autocad-green text-autocad-green shadow-[0_0_14px_rgba(0,230,118,0.55)]'
      : 'border-autocad-red text-autocad-red shadow-[0_0_14px_rgba(255,61,0,0.55)]';
  }
  if (block.rare || block.type === 'const') return 'border-autocad-yellow text-autocad-yellow';
  if (block.type === 'input' || block.type === 'output') return 'border-autocad-green text-autocad-green';
  return 'border-autocad-cyan text-autocad-cyan';
}

function wireColor(block) {
  if (!block) return '#00e5ff';
  if (block.rare || block.type === 'const') return '#ffd600';
  if (block.type === 'input' || block.type === 'output') return '#00e676';
  return '#00e5ff';
}

function pinLabel(pins, pinId) {
  const pin = (pins || []).find(item => item.id === pinId);
  return pin ? (pin.label || pin.id) : '';
}

function blockSummary(block, pins, actuated, forced) {
  if (block.type === 'actuated') return actuated ? 'True' : 'False';
  if (block.type === 'const') return block.value || '0';
  if (block.type === 'var') return block.name || 'Variable';
  if (block.type === 'input' && forced) {
    const label = pinLabel(pins, block.pinId);
    return label ? `${label} · Positivo` : 'Positivo';
  }
  if (block.type === 'input') return pinLabel(pins, block.pinId) || 'Sin borne';
  if (block.type === 'output' && block.rare) return block.name || 'Sin nombre';
  if (block.type === 'output') return pinLabel(pins, block.pinId) || 'Sin borne';
  if (block.type === 'not') return 'Invierte';
  if (block.type === 'and') return 'A y B';
  if (block.type === 'or') return 'A o B';
  return '';
}

function portCaption(port) {
  if (port === 'a') return 'A';
  if (port === 'b') return 'B';
  return '';
}

export default function BlockProgramWindow({
  open,
  title,
  pins,
  program,
  actuated = false,
  onChange,
  onSave,
  onClose
}) {
  const frameRef = useRef(null);
  const boardRef = useRef(null);
  const surfaceRef = useRef(null);
  const gestureRef = useRef(null);
  const programRef = useRef(program);
  const onChangeRef = useRef(onChange);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 72, y: 64 });
  const [selectedId, setSelectedId] = useState('');
  const [selectedWireId, setSelectedWireId] = useState('');
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [forcedInputs, setForcedInputs] = useState(() => new Set());
  const [forcedActuated, setForcedActuated] = useState(null);
  const forcedKey = [...forcedInputs].sort().join('|');
  const shownActuated = forcedActuated === null ? actuated : forcedActuated;
  const preview = useMemo(() => {
    if (!forcedInputs.size && forcedActuated === null) return {};
    return previewBlockValues(program, {
      forcedInputIds: [...forcedInputs],
      actuated: shownActuated
    });
  }, [program, forcedKey, shownActuated, forcedInputs, forcedActuated]);

  programRef.current = program;
  onChangeRef.current = onChange;
  zoomRef.current = zoom;

  const applyZoom = (next, clientX, clientY) => {
    const board = boardRef.current;
    const prev = zoomRef.current || 1;
    const clamped = clampZoom(next);
    if (!board || clamped === prev) {
      if (clamped !== prev) {
        zoomRef.current = clamped;
        setZoom(clamped);
      }
      return;
    }
    const rect = board.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const anchorX = (board.scrollLeft + localX) / prev;
    const anchorY = (board.scrollTop + localY) / prev;
    zoomRef.current = clamped;
    setZoom(clamped);
    requestAnimationFrame(() => {
      const node = boardRef.current;
      if (!node) return;
      node.scrollLeft = anchorX * clamped - localX;
      node.scrollTop = anchorY * clamped - localY;
    });
  };
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  useEffect(() => {
    if (!open) {
      gestureRef.current = null;
      setDraft(null);
    }
  }, [open]);

  useEffect(() => {
    const boardPoint = (event) => pointerOnBoard(event, surfaceRef.current, zoomRef.current);
    const hitInput = (point, source) => {
      let found = null;
      const reach = Math.min(36, 18 / (zoomRef.current || 1));
      source.blocks.forEach(block => {
        portsOf(block).inputs.forEach(port => {
          const at = portPoint(block, 'in', port);
          const dx = at.x - point.x;
          const dy = at.y - point.y;
          if (dx * dx + dy * dy <= reach * reach) found = { blockId: block.id, port };
        });
      });
      return found;
    };
    const move = (event) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (gesture.kind === 'window') {
        setPos({
          x: Math.max(8, event.clientX - gesture.dx),
          y: Math.max(8, event.clientY - gesture.dy)
        });
        return;
      }
      if (gesture.kind === 'block') {
        const scale = zoomRef.current || 1;
        onChangeRef.current(moveBlock(
          programRef.current,
          gesture.id,
          gesture.x + (event.clientX - gesture.ox) / scale,
          gesture.y + (event.clientY - gesture.oy) / scale
        ));
        return;
      }
      if (gesture.kind === 'wire') {
        const point = boardPoint(event);
        setDraft(current => current ? { ...current, x: point.x, y: point.y } : current);
      }
    };
    const up = (event) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      gestureRef.current = null;
      if (gesture.kind !== 'wire') return;
      const hit = hitInput(boardPoint(event), programRef.current);
      if (hit) {
        const result = connectBlocks(programRef.current, gesture.from, hit);
        onChangeRef.current(result.program);
        setNotice(result.error);
        if (!result.error) setSelectedId(hit.blockId);
      }
      setDraft(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!open || !board) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * board.clientHeight
          : event.deltaY;
      applyZoomRef.current(zoomRef.current * Math.exp(-delta * 0.0016), event.clientX, event.clientY);
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    return () => board.removeEventListener('wheel', onWheel);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setForcedInputs(current => (current.size ? new Set() : current));
    setForcedActuated(null);
  }, [open]);

  useEffect(() => {
    const ids = new Set((program?.blocks || []).filter(block => block.type === 'input').map(block => block.id));
    setForcedInputs(current => {
      let changed = false;
      const next = new Set();
      current.forEach(id => {
        if (ids.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [program]);

  if (!open) return null;

  const simulating = forcedInputs.size > 0 || forcedActuated !== null;
  const toggleForcedInput = (block) => {
    if (block?.type === 'actuated') {
      setSelectedId(block.id);
      setSelectedWireId('');
      const next = !shownActuated;
      setForcedActuated(next);
      setNotice(next
        ? 'La pieza queda en True. Los bloques encendidos son el resultado.'
        : 'La pieza queda en False. Los bloques encendidos son el resultado.');
      return;
    }
    if (block?.type !== 'input') return;
    setSelectedId(block.id);
    setSelectedWireId('');
    const release = forcedInputs.has(block.id);
    setForcedInputs(current => {
      const next = new Set(current);
      if (next.has(block.id)) next.delete(block.id);
      else next.add(block.id);
      return next;
    });
    setNotice(release
      ? 'Entrada en reposo.'
      : 'Entrada forzada a positivo. Los bloques encendidos son el resultado.');
  };

  const selected = program.blocks.find(block => block.id === selectedId) || null;
  const portBoost = Math.min(2.4, Math.max(1, 0.85 / zoom));
  const zoomAtCenter = (next) => {
    const board = boardRef.current;
    if (!board) {
      applyZoom(next, 0, 0);
      return;
    }
    const rect = board.getBoundingClientRect();
    applyZoom(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const focusFrame = (event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    frameRef.current?.focus();
  };

  const onKeyDown = (event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    event.stopPropagation();
    if (selectedId) {
      const chosen = program.blocks.find(block => block.id === selectedId);
      if (chosen?.type === 'actuated') return;
      onChange(removeBlock(program, selectedId));
      setSelectedId('');
      return;
    }
    if (selectedWireId) {
      onChange(removeWire(program, selectedWireId));
      setSelectedWireId('');
    }
  };

  const startWindowDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    gestureRef.current = {
      kind: 'window',
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y
    };
  };

  const startBlockDrag = (event, block) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(block.id);
    setSelectedWireId('');
    frameRef.current?.focus();
    gestureRef.current = {
      kind: 'block',
      id: block.id,
      ox: event.clientX,
      oy: event.clientY,
      x: block.x,
      y: block.y
    };
  };

  const startWire = (event, block, port) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const point = pointerOnBoard(event, surfaceRef.current, zoomRef.current);
    const x = point.x;
    const y = point.y;
    gestureRef.current = { kind: 'wire', from: { blockId: block.id, port } };
    setDraft({ from: { blockId: block.id, port }, x, y });
    setNotice('');
  };

  return (
    <div
      ref={frameRef}
      data-block-program
      tabIndex={-1}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={focusFrame}
      onKeyDown={onKeyDown}
      className="fixed z-[80] flex flex-col overflow-hidden rounded-lg border border-autocad-yellow/70 bg-autocad-raised text-autocad-textBright shadow-2xl outline-none"
      style={{ left: pos.x, top: pos.y, width: 980, height: 640, minWidth: 720, minHeight: 420, resize: 'both' }}
    >
      <div
        onPointerDown={startWindowDrag}
        className="flex items-center justify-between gap-3 px-3 py-2 border-b border-autocad-border bg-autocad-panel cursor-move select-none"
      >
        <div className="min-w-0">
          <div className="font-bold tracking-wide text-autocad-yellow">PROGRAMACIÓN</div>
          <div className="truncate text-[10px] text-autocad-textMuted">{title || 'Pieza'} · arrastra esta barra para mover la ventana. La rueda aleja la vista.</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {simulating && (
            <button
              type="button"
              title="Quitar el positivo de las entradas"
              onClick={() => {
                setForcedInputs(new Set());
                setForcedActuated(null);
                setNotice('Simulación en reposo.');
              }}
              className="px-2 py-1 rounded border border-autocad-green text-[10px] font-bold text-autocad-green"
            >
              Soltar
            </button>
          )}
          <div className="flex items-center gap-0.5 rounded border border-autocad-border bg-autocad-inset p-0.5">
            <button
              type="button"
              title="Alejar"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => zoomAtCenter(nextZoomStop(zoom, -1))}
              className="w-6 h-6 rounded text-sm font-bold text-autocad-textBright hover:bg-autocad-hover disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              title="Volver al 100%"
              onClick={() => zoomAtCenter(1)}
              className="w-12 h-6 rounded font-mono text-[10px] text-autocad-yellow hover:bg-autocad-hover"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              title="Acercar"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => zoomAtCenter(nextZoomStop(zoom, 1))}
              className="w-6 h-6 rounded text-sm font-bold text-autocad-textBright hover:bg-autocad-hover disabled:opacity-30"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="px-2.5 py-1 rounded bg-autocad-cyan text-autocad-onAccent font-bold"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-autocad-textMuted hover:text-white hover:bg-red-950/50"
            title="Cerrar programación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-40 shrink-0 overflow-y-auto border-r border-autocad-border bg-autocad-surface p-2 space-y-1">
          <div className="px-1 pb-1 text-[10px] font-bold uppercase text-autocad-textMuted">Bloques</div>
          {PALETTE.map(item => (
            <button
              key={`${item.type}-${item.title}`}
              type="button"
              onClick={() => {
                const next = addBlock(program, item);
                onChange(next);
                setSelectedId(next.blocks[next.blocks.length - 1]?.id || '');
                setSelectedWireId('');
                setNotice('');
              }}
              className={`w-full rounded border px-2 py-1.5 text-left hover:border-autocad-yellow ${
                item.rare ? 'border-autocad-yellow/60 bg-autocad-chipGold' : 'border-autocad-border bg-autocad-inset'
              }`}
            >
              <div className={`text-[11px] font-bold ${item.rare ? 'text-autocad-yellow' : 'text-autocad-textBright'}`}>{item.title}</div>
              <div className="text-[9px] leading-snug text-autocad-textMuted">{item.hint}</div>
            </button>
          ))}
        </div>

        <div
          ref={boardRef}
          className="relative flex-1 overflow-auto bg-autocad-inset"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget && event.target.dataset?.board !== 'yes') return;
            setSelectedId('');
            setSelectedWireId('');
          }}
        >
          <div data-board="yes" className="relative overflow-hidden" style={{ width: BOARD_W * zoom, height: BOARD_H * zoom }}>
            <div
              ref={surfaceRef}
              data-board="yes"
              className="absolute left-0 top-0"
              style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
            >
            <svg className="absolute inset-0 pointer-events-none" width={BOARD_W} height={BOARD_H}>
              {program.wires.map(wire => {
                const source = program.blocks.find(block => block.id === wire.from.blockId);
                const target = program.blocks.find(block => block.id === wire.to.blockId);
                if (!source || !target) return null;
                const from = portPoint(source, 'out', wire.from.port);
                const to = portPoint(target, 'in', wire.to.port);
                const path = wirePath(from.x, from.y, to.x, to.y);
                const active = wire.id === selectedWireId;
                const hot = simulating && preview[source.id] === true;
                return (
                  <g key={wire.id}>
                    <path
                      d={path}
                      stroke="transparent"
                      strokeWidth={Math.min(64, 14 / zoom)}
                      fill="none"
                      className="pointer-events-auto cursor-pointer"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        frameRef.current?.focus();
                        setSelectedWireId(wire.id);
                        setSelectedId('');
                      }}
                    />
                    <path
                      d={path}
                      stroke={hot ? '#00e676' : wireColor(source)}
                      strokeWidth={(active ? 3.5 : 2) / zoom}
                      fill="none"
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
              {draft && (() => {
                const source = program.blocks.find(block => block.id === draft.from.blockId);
                if (!source) return null;
                const from = portPoint(source, 'out', draft.from.port);
                return (
                  <path
                    d={wirePath(from.x, from.y, draft.x, draft.y)}
                    stroke="#ffd600"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                    fill="none"
                    pointerEvents="none"
                  />
                );
              })()}
            </svg>

            {program.blocks.map(block => {
              const inputs = portsOf(block).inputs;
              const outputs = portsOf(block).outputs;
              const active = block.id === selectedId;
              const forced = block.type === 'input' && forcedInputs.has(block.id);
              const live = simulating && preview[block.id] === true;
              const dead = simulating && preview[block.id] !== true;
              return (
                <div
                  key={block.id}
                  onPointerDown={(event) => startBlockDrag(event, block)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleForcedInput(block);
                  }}
                  className={`absolute rounded-md border bg-autocad-panel shadow-lg select-none ${toneClass(block, shownActuated)} ${
                    active
                      ? 'ring-2 ring-autocad-yellow'
                      : live
                        ? 'ring-2 ring-autocad-green shadow-[0_0_14px_rgba(0,230,118,0.55)]'
                        : dead
                          ? 'ring-2 ring-autocad-red shadow-[0_0_14px_rgba(255,61,0,0.55)]'
                          : ''
                  }`}
                  style={{ left: block.x, top: block.y, width: BLOCK_W, height: BLOCK_H }}
                >
                  <div className="flex items-center justify-between px-2 h-6 border-b border-autocad-border/70 bg-autocad-panelHeader rounded-t-md cursor-grab">
                    <span className="text-[10px] font-bold uppercase tracking-wide">{blockKindTitle(block)}</span>
                  </div>
                  <div className={`px-3 pt-2 font-mono truncate ${
                    block.type === 'actuated'
                      ? `text-[16px] font-bold ${shownActuated ? 'text-autocad-green' : 'text-autocad-red'}`
                      : live
                        ? 'text-[11px] font-bold text-autocad-green'
                        : dead
                          ? 'text-[11px] font-bold text-autocad-red'
                          : 'text-[11px] text-autocad-textBright'
                  }`}
                  >
                    {blockSummary(block, pins, shownActuated, forced)}
                  </div>
                  {inputs.map(port => {
                    const at = portPoint(block, 'in', port);
                    return (
                      <button
                        key={port}
                        type="button"
                        title="Entrada"
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute w-3.5 h-3.5 rounded-full border-2 border-white bg-autocad-inset"
                        style={{ left: at.x - block.x, top: at.y - block.y, transform: `translate(-50%, -50%) scale(${portBoost})` }}
                      >
                        {portCaption(port) && (
                          <span className="absolute left-4 -top-1 text-[9px] text-autocad-textMuted">{portCaption(port)}</span>
                        )}
                      </button>
                    );
                  })}
                  {outputs.map(port => {
                    const at = portPoint(block, 'out', port);
                    return (
                      <button
                        key={port}
                        type="button"
                        title="Salida: arrastra hasta una entrada"
                        onPointerDown={(event) => startWire(event, block, port)}
                        className={`absolute w-3.5 h-3.5 rounded-full border-2 ${
                          block.type === 'actuated'
                            ? (shownActuated ? 'border-autocad-green bg-autocad-green' : 'border-autocad-red bg-autocad-red')
                            : live
                              ? 'border-autocad-green bg-autocad-green'
                              : dead
                                ? 'border-autocad-red bg-autocad-red'
                              : block.rare
                                ? 'border-autocad-yellow bg-autocad-yellow'
                                : 'border-autocad-cyan bg-autocad-cyan'
                        }`}
                        style={{ left: at.x - block.x, top: at.y - block.y, transform: `translate(-50%, -50%) scale(${portBoost})` }}
                      />
                    );
                  })}
                </div>
              );
            })}
            {program.blocks.length === 0 && (
              <div data-board="yes" className="absolute left-8 top-8 max-w-sm text-[12px] leading-relaxed text-autocad-textMuted">
                Agrega una constante, una variable o una salida. Arrastra el punto de la derecha de un bloque hasta el punto de la izquierda de otro.
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="w-56 shrink-0 overflow-y-auto border-l border-autocad-border bg-autocad-surface p-3 space-y-3 select-text">
          <div className="text-[10px] font-bold uppercase text-autocad-textMuted">Bloque</div>
          {!selected && !selectedWireId && (
            <p className="text-[11px] leading-snug text-autocad-textMuted">
              Elige un bloque para escribir su valor, su nombre o su borne. Una salida rara no depende de un borne común.
            </p>
          )}
          {selectedWireId && !selected && (
            <div className="space-y-2">
              <p className="text-[11px] text-autocad-textBright">Unión seleccionada.</p>
              <button
                type="button"
                onClick={() => {
                  onChange(removeWire(program, selectedWireId));
                  setSelectedWireId('');
                }}
                className="flex items-center gap-1 px-2 py-1 rounded border border-autocad-border text-[11px] text-red-300 hover:border-red-400"
              >
                <Trash2 className="w-3 h-3" /> Quitar unión
              </button>
            </div>
          )}
          {selected && (
            <div className="space-y-2">
              <div className="text-[12px] font-bold text-autocad-yellow">{blockKindTitle(selected)}</div>
              {selected.type === 'actuated' && (
                <p className="text-[11px] leading-snug text-autocad-textBright">
                  {shownActuated ? 'True. La pieza está accionada.' : 'False. La pieza está apagada.'}
                  {' '}Clic derecho cambia este estado y muestra el resultado.
                </p>
              )}
              {selected.type === 'const' && (
                <label className="block text-[10px] text-autocad-textMuted">Valor
                  <input
                    value={selected.value}
                    onChange={(event) => onChange(updateBlock(program, selected.id, { value: event.target.value }))}
                    className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono text-xs text-autocad-yellow"
                  />
                </label>
              )}
              {selected.type === 'var' && (
                <label className="block text-[10px] text-autocad-textMuted">Nombre
                  <input
                    value={selected.name}
                    onChange={(event) => onChange(updateBlock(program, selected.id, { name: event.target.value }))}
                    className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono text-xs text-autocad-cyan"
                  />
                </label>
              )}
              {selected.type === 'input' && (
                <>
                <p className="text-[11px] leading-snug text-autocad-textBright">
                  {forcedInputs.has(selected.id)
                    ? 'Positivo. Clic derecho otra vez y la Entrada vuelve a reposo.'
                    : 'Clic derecho fuerza esta Entrada a positivo y muestra el resultado.'}
                </p>
                <label className="block text-[10px] text-autocad-textMuted">Borne
                  <select
                    value={selected.pinId}
                    onChange={(event) => onChange(updateBlock(program, selected.id, { pinId: event.target.value }))}
                    className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-green"
                  >
                    <option value="">Sin borne</option>
                    {pins.map(pin => (
                      <option key={pin.id} value={pin.id}>{pin.label || pin.id}</option>
                    ))}
                  </select>
                </label>
                </>
              )}
              {selected.type === 'output' && (
                <>
                  <label className="flex items-center gap-2 text-[11px] text-autocad-yellow">
                    <input
                      type="checkbox"
                      checked={selected.rare}
                      onChange={(event) => onChange(updateBlock(program, selected.id, { rare: event.target.checked }))}
                    />
                    Salida rara
                  </label>
                  {selected.rare ? (
                    <label className="block text-[10px] text-autocad-textMuted">Nombre de la salida
                      <input
                        value={selected.name}
                        onChange={(event) => onChange(updateBlock(program, selected.id, { name: event.target.value }))}
                        className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono text-xs text-autocad-yellow"
                      />
                    </label>
                  ) : (
                    <label className="block text-[10px] text-autocad-textMuted">Borne
                      <select
                        value={selected.pinId}
                        onChange={(event) => onChange(updateBlock(program, selected.id, { pinId: event.target.value }))}
                        className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-green"
                      >
                        <option value="">Sin borne</option>
                        {pins.map(pin => (
                          <option key={pin.id} value={pin.id}>{pin.label || pin.id}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="text-[10px] leading-snug text-autocad-textMuted">
                    La salida rara es una salida especial. No tiene que coincidir con un borne común de la pieza.
                  </p>
                </>
              )}
              {selected.type !== 'actuated' && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(removeBlock(program, selected.id));
                    setSelectedId('');
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-autocad-border text-[11px] text-red-300 hover:border-red-400"
                >
                  <Trash2 className="w-3 h-3" /> Quitar bloque
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] leading-snug text-autocad-textMuted">
            Arrastra el punto derecho hasta el punto izquierdo. La rueda del ratón aleja o acerca la vista. Clic derecho en una Entrada la fuerza a positivo. Clic derecho en el bloque con el nombre de la pieza cambia su True o False. Los bloques encendidos son el resultado. Una entrada admite una sola unión. En una pieza que el ratón puede accionar, el bloque con su nombre tiene una salida: True se ilumina al accionarla y False queda apagada. Con señal en la Entrada, el NOT invierte el contacto: un pulsador NC deja pasar la tensión en reposo y la corta mientras se mantiene pulsado. Sin fuente, la salida no manda señal. En el contactor, la variable RETRO mantiene la bobina solo si tú la unes.
          </p>
          {notice && <p className="text-[10px] leading-snug text-autocad-yellow">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
