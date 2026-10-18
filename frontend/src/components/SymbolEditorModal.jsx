import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Maximize2, Minimize2, Plus, RotateCcw, Save, Trash2, X, Zap } from 'lucide-react';
import { CATEGORIES, SWITCH_GROUP, SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { pushbuttonActuation } from '../cad/pushbutton';
import { DEFAULT_LAYERS, cloneData, primitiveNodes } from '../cad/draw/geometry';
import { useCadDraw } from '../cad/draw/useCadDraw';
import { DEFAULT_PRIMITIVES, createBlankSymbol, deleteCustomSymbol, saveCustomSymbol } from '../cad/symbolStore';

import { defaultPinLinks } from '../cad/pinLinks';
import { emptyProgram, normalizeProgram, programLogicKey, stripActuatedBlocks, withActuatedBlock } from '../cad/blockProgram';
import { userCanOperate } from '../cad/ioKind';
import { DrawLayers, DrawProperties, DrawToolbox } from './draw/DrawChrome';
import BlockProgramWindow from './BlockProgramWindow';

function pinsForDrawing(pins) {
  return (pins || []).map(pin => {
    const copy = { ...pin };
    delete copy.negate;
    return copy;
  });
}

const GRID_STEPS = [1, 2, 5, 10];
const DEFAULT_PIN_RADIUS = 1.5;

function drawingSignature(list) {
  return JSON.stringify((list || []).map(prim => {
    const copy = { ...prim };
    delete copy.id;
    return copy;
  }));
}

function mouseOperableSymbol(def, role) {
  if (def) return userCanOperate(def);
  return userCanOperate({ role: role || 'switch' });
}

function programForEditor(program, operable, name, role) {
  if (role === 'motor') return emptyProgram();
  const base = normalizeProgram(program);
  return operable ? withActuatedBlock(base, name) : stripActuatedBlocks(base);
}

export default function SymbolEditorModal({
  isOpen,
  onClose,
  symbolDefinitions,
  onSymbolsUpdated,
  initialSymbolType = ''
}) {
  const [selectedType, setSelectedType] = useState(initialSymbolType || '');
  const [symbolName, setSymbolName] = useState('Componente');
  const [symbolPrefix, setSymbolPrefix] = useState('K');
  const [symbolCategory, setSymbolCategory] = useState('Personalizados');
  const [symbolActuation, setSymbolActuation] = useState('latch');
  const [symbolRole, setSymbolRole] = useState('switch');
  const [symbolWidth, setSymbolWidth] = useState(40);
  const [symbolHeight, setSymbolHeight] = useState(50);
  const [pinRadius, setPinRadius] = useState(DEFAULT_PIN_RADIUS);
  const [pins, setPins] = useState([]);
  const [pinLinks, setPinLinks] = useState([]);
  const [primitives, setPrimitives] = useState([]);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('geom');
  const [spriteMode, setSpriteMode] = useState('rest');
  const [previewActive, setPreviewActive] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [program, setProgram] = useState(() => emptyProgram());
  const [programOpen, setProgramOpen] = useState(false);
  const [gridSnap, setGridSnap] = useState(true);
  const [objectSnap, setObjectSnap] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [zoom, setZoom] = useState(3);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loadEpoch, setLoadEpoch] = useState(0);

  const canvasRef = useRef(null);
  const defsRef = useRef(symbolDefinitions);
  const openedRef = useRef(false);
  const restSpriteRef = useRef([]);
  const actuatedSpriteRef = useRef([]);
  const programKeyRef = useRef('');
  const symbolNameRef = useRef(symbolName);
  symbolNameRef.current = symbolName;
  defsRef.current = symbolDefinitions;

  const ghost = spriteMode === 'actuated' ? restSpriteRef.current : actuatedSpriteRef.current;

  const editor = useCadDraw({
    enabled: isOpen,
    canvasRef,
    primitives,
    setPrimitives,
    layers,
    activeLayerId,
    historyKey: `${selectedType}:${spriteMode}:${loadEpoch}`,
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
    previewRole: symbolRole,
    onEscape: () => {
      if (isFullscreen) setIsFullscreen(false);
    },
    onToggleGrid: () => setGridSnap(value => !value),
    onToggleObjectSnap: () => setObjectSnap(value => !value),
    onToggleFullscreen: () => setIsFullscreen(value => !value)
  });

  const loadSymbol = useCallback((type, defs) => {
    const def = type ? defs[type] : null;
    if (!def) {
      setPrimitives([]);
      setPins([]);
      setPinLinks([]);
      programKeyRef.current = programLogicKey(emptyProgram());
      setProgram(emptyProgram());
      setSymbolRole('switch');
      setSymbolActuation('latch');
      restSpriteRef.current = [];
      actuatedSpriteRef.current = [];
      setSpriteMode('rest');
      setLoadEpoch(value => value + 1);
      return;
    }
    const loadedName = def.name || 'Componente';
    symbolNameRef.current = loadedName;
    setSymbolName(loadedName);
    setSymbolPrefix(def.prefix || 'K');
    setSymbolCategory(def.category || 'Personalizados');
    setSymbolActuation(pushbuttonActuation(def));
    setSymbolRole(def.role || 'switch');
    if (def.role === 'source' || def.role === 'motor') setProgramOpen(false);
    setSymbolWidth(def.width || 40);
    setSymbolHeight(def.height || 50);
    setPinRadius(def.pinRadius ?? DEFAULT_PIN_RADIUS);
    const nextPins = pinsForDrawing(def.pins ? cloneData(def.pins) : []);
    const nextLinks = Array.isArray(def.pinLinks) ? cloneData(def.pinLinks) : defaultPinLinks(nextPins);
    setPins(nextPins);
    setPinLinks(nextLinks);
    const loadedProgram = programForEditor(
      def.program,
      def.role !== 'motor' && userCanOperate(def),
      loadedName,
      def.role
    );
    programKeyRef.current = programLogicKey(loadedProgram);
    setProgram(loadedProgram);
    const rest = def.primitives
      ? cloneData(def.primitives)
      : (DEFAULT_PRIMITIVES[type] ? cloneData(DEFAULT_PRIMITIVES[type]) : []);
    const actuated = Array.isArray(def.activePrimitives) ? cloneData(def.activePrimitives) : [];
    const nextLayers = Array.isArray(def.layers) && def.layers.length ? cloneData(def.layers) : cloneData(DEFAULT_LAYERS);
    restSpriteRef.current = rest;
    actuatedSpriteRef.current = actuated;
    setPrimitives(rest);
    setLayers(nextLayers);
    setActiveLayerId(nextLayers[0]?.id || 'geom');
    setSpriteMode('rest');
    setLoadEpoch(value => value + 1);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setProgramOpen(false);
      return;
    }
    setIsFullscreen(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    const justOpened = !openedRef.current;
    openedRef.current = true;
    const typeToLoad = justOpened
      ? (initialSymbolType || Object.keys(defsRef.current)[0] || '')
      : selectedType;
    if (justOpened && typeToLoad !== selectedType) {
      setSelectedType(typeToLoad);
      return;
    }
    loadSymbol(typeToLoad, defsRef.current);
    // Saving refreshes the catalog. The open drawing stays until the piece changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedType, initialSymbolType, loadSymbol]);

  useEffect(() => {
    if (!isOpen || symbolRole === 'motor' || symbolRole === 'source') return;
    const stored = defsRef.current?.[selectedType];
    if (!mouseOperableSymbol(stored, symbolRole)) return;
    setProgram(current => {
      const next = withActuatedBlock(current, symbolNameRef.current);
      if (next !== current) programKeyRef.current = programLogicKey(next);
      return next;
    });
  }, [isOpen, symbolName, symbolRole, selectedType, symbolDefinitions]);

  const showSprite = (mode) => {
    if (mode === spriteMode) return;
    const current = editor.collect();
    if (spriteMode === 'rest') restSpriteRef.current = current;
    else actuatedSpriteRef.current = current;
    let incoming = mode === 'actuated' ? actuatedSpriteRef.current : restSpriteRef.current;
    if (mode === 'actuated' && (!incoming || incoming.length === 0)) {
      incoming = cloneData(restSpriteRef.current);
      actuatedSpriteRef.current = incoming;
    }
    setPrimitives(cloneData(incoming || []));
    setSpriteMode(mode);
  };

  const copyRestIntoActuated = () => {
    const source = spriteMode === 'rest' ? editor.collect() : restSpriteRef.current;
    if (spriteMode === 'rest') restSpriteRef.current = source;
    const copy = cloneData(source);
    actuatedSpriteRef.current = copy;
    setPrimitives(cloneData(copy));
    setSpriteMode('actuated');
  };

  const writeSymbol = (programSource, announce, actuation = symbolActuation) => {
    if (!selectedType) return;
    const current = editor.collect();
    const restPrimitives = spriteMode === 'rest' ? current : restSpriteRef.current;
    const actuatedPrimitives = spriteMode === 'actuated' ? current : actuatedSpriteRef.current;
    restSpriteRef.current = restPrimitives;
    actuatedSpriteRef.current = actuatedPrimitives;
    const activePrimitives = drawingSignature(actuatedPrimitives) === drawingSignature(restPrimitives)
      ? []
      : actuatedPrimitives;
    const nextProgram = programForEditor(
      programSource,
      symbolRole !== 'motor' && mouseOperableSymbol(symbolDefinitions?.[selectedType], symbolRole),
      symbolName,
      symbolRole
    );
    const saved = {
      type: selectedType,
      name: symbolName,
      prefix: symbolPrefix,
      category: symbolCategory,
      width: Number(symbolWidth),
      height: Number(symbolHeight),
      pinRadius,
      pins: pinsForDrawing(pins),
      program: nextProgram,
      primitives: restPrimitives,
      activePrimitives,
      layers
    };
    if (symbolCategory === SWITCH_GROUP) saved.momentary = actuation === 'momentary';
    saveCustomSymbol(saved);
    programKeyRef.current = programLogicKey(nextProgram);
    onSymbolsUpdated();
    if (!announce) return;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSave = () => writeSymbol(program, true);

  const handleProgramChange = (next) => {
    const operable = symbolRole !== 'motor' && symbolRole !== 'source' && mouseOperableSymbol(defsRef.current?.[selectedType], symbolRole);
    const wrapped = programForEditor(next, operable, symbolName, symbolRole);
    setProgram(wrapped);
    if (programLogicKey(wrapped) === programKeyRef.current) return;
    writeSymbol(wrapped, false);
  };

  const handleResetToDefault = () => {
    deleteCustomSymbol(selectedType);
    const catalog = SYMBOL_DEFINITIONS[selectedType];
    const starterPins = [
      { id: '1', label: '1', x: 0, y: -25 },
      { id: '2', label: '2', x: 0, y: 25 }
    ];
    const starterPrimitives = [
      { id: 'p1', type: 'rect', x: -15, y: -15, width: 30, height: 30, stroke: '#00e5ff', strokeWidth: 2, fill: 'none' },
      { id: 'p2', type: 'line', x1: 0, y1: -25, x2: 0, y2: -15, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'p3', type: 'line', x1: 0, y1: 15, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'p4', type: 'text', x: 0, y: 0, text: '{tag}', color: '#ffd600', fontSize: 10, align: 'center' }
    ];
    if (catalog) {
      setSymbolName(catalog.name || 'Componente');
      setSymbolPrefix(catalog.prefix || 'K');
      setSymbolCategory(catalog.category || 'Personalizados');
      setSymbolActuation(pushbuttonActuation(catalog));
      setSymbolRole(catalog.role || 'switch');
      setSymbolWidth(catalog.width || 40);
      setSymbolHeight(catalog.height || 50);
      setPinRadius(catalog.pinRadius ?? DEFAULT_PIN_RADIUS);
      const catalogPins = pinsForDrawing(cloneData(catalog.pins || []));
      const catalogLinks = Array.isArray(catalog.pinLinks) ? cloneData(catalog.pinLinks) : defaultPinLinks(catalogPins);
      setPins(catalogPins);
      setPinLinks(catalogLinks);
      const catalogName = catalog.name || 'Componente';
      symbolNameRef.current = catalogName;
      const catalogProgram = programForEditor(
        catalog.program,
        mouseOperableSymbol(catalog, catalog.role),
        catalogName,
        catalog.role
      );
      programKeyRef.current = programLogicKey(catalogProgram);
      setProgram(catalogProgram);
      const defaults = DEFAULT_PRIMITIVES[selectedType];
      const rest = defaults ? cloneData(defaults) : [];
      restSpriteRef.current = rest;
      actuatedSpriteRef.current = [];
      setPrimitives(rest);
    } else {
      setPinRadius(DEFAULT_PIN_RADIUS);
      setSymbolRole('switch');
      setSymbolActuation(symbolCategory === SWITCH_GROUP ? 'momentary' : 'latch');
      setPins(starterPins);
      setPinLinks(defaultPinLinks(starterPins));
      const blankProgram = programForEditor(emptyProgram(), true, symbolName, 'switch');
      symbolNameRef.current = symbolName;
      programKeyRef.current = programLogicKey(blankProgram);
      setProgram(blankProgram);
      restSpriteRef.current = cloneData(starterPrimitives);
      actuatedSpriteRef.current = [];
      setPrimitives(cloneData(starterPrimitives));
      const resetSymbol = {
        type: selectedType,
        name: symbolName,
        prefix: symbolPrefix,
        category: symbolCategory,
        width: Number(symbolWidth),
        height: Number(symbolHeight),
        pinRadius: DEFAULT_PIN_RADIUS,
        pins: starterPins,
        primitives: starterPrimitives,
        activePrimitives: [],
        layers: cloneData(DEFAULT_LAYERS)
      };
      if (symbolCategory === SWITCH_GROUP) resetSymbol.momentary = true;
      saveCustomSymbol(resetSymbol);
    }
    setLayers(cloneData(DEFAULT_LAYERS));
    setSpriteMode('rest');
    setLoadEpoch(value => value + 1);
    onSymbolsUpdated();
  };

  const handleCreateNewPiece = (category) => {
    const def = createBlankSymbol(category || symbolCategory || 'Personalizados');
    onSymbolsUpdated();
    setSelectedType(def.type);
  };

  const selected = primitives.find(prim => editor.selectedIds.length === 1 && prim.id === editor.selectedIds[0]) || null;
  const activePin = pins.find(pin => pin.id === editor.selectedPinId) || null;
  const nodePrim = primitives.find(prim => prim.id === editor.selectedNode?.primId) || null;
  const activeNode = editor.selectedNode && nodePrim
    ? primitiveNodes(nodePrim).find(node => node.kind === editor.selectedNode.kind && node.index === editor.selectedNode.index)
    : null;
  const canEdit = editor.selectedIds.length > 0 || !!editor.selectedPinId || !!editor.selectedNode;

  if (!isOpen) return null;

  return (
    <div
      data-symbol-editor
      className={`fixed inset-0 z-50 flex select-none ${
        isFullscreen ? 'h-screen w-screen bg-autocad-bg' : 'items-center justify-center bg-black/80 p-3'
      }`}
    >
      <div
        className={`plan-frame bg-autocad-raised border border-autocad-cyan/50 shadow-2xl flex flex-col text-xs text-autocad-textBright overflow-hidden ${
          isFullscreen ? 'h-full w-full max-w-none rounded-none' : 'w-full max-w-[1360px] h-[92vh] rounded-lg'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-autocad-border bg-autocad-panel">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-1.5 py-1 bg-autocad-chip border border-autocad-cyan/50 rounded text-autocad-cyan font-bold">CAD</span>
            <div className="min-w-0">
              <h2 className="font-bold text-autocad-cyan uppercase tracking-wider text-sm truncate">Editor de piezas</h2>
              <p className="text-[10px] text-autocad-textMuted truncate">Lienzo vectorial con snaps, nodos, capas y dos sprites.</p>
            </div>
            {symbolRole !== 'source' && symbolRole !== 'motor' && (
              <button
                type="button"
                onClick={() => setProgramOpen(true)}
                className={`shrink-0 px-2.5 py-1 rounded border font-bold tracking-wide ${
                  programOpen
                    ? 'bg-autocad-yellow text-autocad-onAccent border-autocad-yellow'
                    : 'border-autocad-yellow text-autocad-yellow hover:bg-autocad-chipGold'
                }`}
              >
                PROGRAMACIÓN
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleCreateNewPiece} className="flex items-center gap-1 px-2.5 py-1 bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 text-blue-300 font-semibold rounded">
              <Plus className="w-3.5 h-3.5" /> Nueva pieza
            </button>
            <button type="button" onClick={handleResetToDefault} className="flex items-center gap-1 px-2.5 py-1 bg-autocad-panelHeader hover:bg-autocad-hover border border-autocad-border text-autocad-textMuted hover:text-white rounded">
              <RotateCcw className="w-3.5 h-3.5" /> Restablecer
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-1 font-bold rounded ${saveSuccess ? 'bg-autocad-green text-white' : 'bg-autocad-cyan text-autocad-onAccent hover:bg-autocad-accentHot'}`}
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saveSuccess ? 'Guardado' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(value => !value)}
              className="flex items-center gap-1 px-2.5 py-1 border border-autocad-cyan/60 rounded text-autocad-cyan hover:bg-autocad-chip"
              title={isFullscreen ? 'Restaurar la ventana (F11)' : 'Maximizar el editor (F11)'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullscreen ? 'Restaurar' : 'Maximizar'}
            </button>
            <button type="button" onClick={onClose} className="p-1 text-autocad-textMuted hover:text-white hover:bg-red-950/50 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <DrawToolbox
            tool={editor.tool}
            onTool={editor.setTool}
            onDelete={editor.removeSelection}
            onWeld={editor.weld}
            canEdit={canEdit}
          />

          <div className="flex-1 flex flex-col min-w-0 bg-autocad-inset">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-autocad-raised border-b border-autocad-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-autocad-textMuted">Pieza</span>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="bg-autocad-panel border border-autocad-border rounded px-2 py-1 text-xs text-autocad-cyan font-bold focus:outline-none max-w-[240px]"
                >
                  {Object.values(symbolDefinitions).length === 0 && (
                    <option value="">Sin piezas</option>
                  )}
                  {Object.values(symbolDefinitions).map(def => (
                    <option key={def.type} value={def.type}>{def.name} ({def.prefix})</option>
                  ))}
                </select>
                <div className="flex overflow-hidden rounded border border-autocad-border">
                  <button type="button" onClick={() => showSprite('rest')} className={`px-2 py-1 font-bold ${spriteMode === 'rest' ? 'bg-autocad-cyan text-autocad-onAccent' : 'text-autocad-textMuted'}`}>Reposo</button>
                  <button type="button" onClick={() => showSprite('actuated')} className={`px-2 py-1 font-bold ${spriteMode === 'actuated' ? 'bg-autocad-green text-autocad-onAccent' : 'text-autocad-green'}`}>Accionada</button>
                </div>
                {spriteMode === 'actuated' && (
                  <button type="button" onClick={copyRestIntoActuated} className="px-2 py-1 rounded border border-autocad-green text-autocad-green">Copiar reposo</button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewActive(value => !value)}
                title="Tiñe el sprite de reposo con el color de la simulación"
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold ${
                  previewActive ? 'bg-autocad-chipLive border-autocad-green text-autocad-green' : 'border-autocad-border text-autocad-textMuted'
                }`}
              >
                <Zap className="w-3 h-3" />
                {previewActive ? 'Tinte ON' : 'Tinte'}
              </button>
            </div>

            <DrawProperties
              gridSnap={gridSnap}
              objectSnap={objectSnap}
              gridSize={gridSize}
              gridSteps={GRID_STEPS}
              onToggleGrid={() => setGridSnap(value => !value)}
              onToggleObjectSnap={() => setObjectSnap(value => !value)}
              onGridSize={setGridSize}
              zoom={zoom}
              onZoom={(direction) => setZoom(value => Math.min(12, Math.max(0.2, value + direction * 0.25)))}
              canUndo={editor.canUndo}
              canRedo={editor.canRedo}
              onUndo={editor.undo}
              onRedo={editor.redo}
              layers={layers}
              activeLayerId={activeLayerId}
              onActiveLayer={setActiveLayerId}
              selected={selected}
              onPatch={editor.updateSelected}
              lineDash={selected ? (selected.dash || 'solid') : editor.lineDash}
              onLineDash={(dash) => {
                editor.setLineDash(dash);
                if (editor.selectedIds.length) editor.updateSelected({ dash: dash === 'solid' ? null : dash });
              }}
              orthoLock={editor.orthoLock}
              onToggleOrtho={editor.toggleOrtho}
            />

            <div className="flex-1 relative min-h-0">
              {spriteMode === 'actuated' && (
                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded border border-autocad-green bg-autocad-chipLive/90 text-autocad-green font-bold pointer-events-none">
                  Sprite accionado
                </div>
              )}
              <canvas
                ref={canvasRef}
                className={`w-full h-full block ${editor.tool === 'pan' || editor.spaceDown ? 'cursor-grab' : 'cursor-crosshair'}`}
              />
            </div>

            <div className="h-7 px-3 flex items-center justify-between border-t border-autocad-border bg-autocad-raised font-mono text-[10px] text-autocad-textMuted">
              <span className="truncate">{editor.statusText}</span>
              <span className="text-autocad-cyan shrink-0">
                {spriteMode === 'actuated' ? 'ACCIONADA' : 'REPOSO'}
                {' · '}X {editor.cursor.x.toFixed(2)} Y {editor.cursor.y.toFixed(2)}
                {' · '}{editor.snapKind === 'free' ? (gridSnap ? `MALLA ${gridSize}` : 'LIBRE') : editor.snapKind.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="w-72 bg-autocad-surface border-l border-autocad-border overflow-y-auto p-3 space-y-4">
            <div className="space-y-2 border-b border-autocad-border pb-3">
              <span className="font-bold text-autocad-cyan uppercase text-[11px]">Pieza</span>
              <p className={`text-[10px] leading-snug ${spriteMode === 'actuated' ? 'text-autocad-green' : 'text-autocad-textMuted'}`}>
                {spriteMode === 'actuated'
                  ? 'Dibujo encendido. El trazo gris es el reposo. Guardar conserva este sprite.'
                  : 'Dibujo apagado. Accionada abre el otro sprite de esta misma pieza.'}
              </p>
              <label className="block text-[10px] text-autocad-textMuted">Nombre
                <input value={symbolName} onChange={(event) => setSymbolName(event.target.value)} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-white" />
              </label>
              <label className="block text-[10px] text-autocad-textMuted">Grupo
                <select value={symbolCategory} onChange={(event) => setSymbolCategory(event.target.value)} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded p-1 text-xs text-white">
                  {[...CATEGORIES, 'Personalizados'].map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              {symbolCategory === SWITCH_GROUP && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-autocad-textMuted">Estado del interruptor</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSymbolActuation('momentary');
                        writeSymbol(program, false, 'momentary');
                      }}
                      className={`px-2 py-1 rounded border font-bold ${
                        symbolActuation === 'momentary'
                          ? 'bg-autocad-yellow text-autocad-onAccent border-autocad-yellow'
                          : 'border-autocad-border text-autocad-textMuted hover:text-white hover:bg-autocad-hover'
                      }`}
                    >
                      Pulsador
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSymbolActuation('latch');
                        writeSymbol(program, false, 'latch');
                      }}
                      className={`px-2 py-1 rounded border font-bold ${
                        symbolActuation === 'latch'
                          ? 'bg-autocad-yellow text-autocad-onAccent border-autocad-yellow'
                          : 'border-autocad-border text-autocad-textMuted hover:text-white hover:bg-autocad-hover'
                      }`}
                    >
                      Botón
                    </button>
                  </div>
                  <p className="text-[10px] text-autocad-textMuted leading-snug">
                    {symbolActuation === 'momentary'
                      ? 'Pulsador: se presiona y, al soltar, vuelve a su reposo.'
                      : 'Botón: se presiona y queda en ese estado.'}
                  </p>
                </div>
              )}
              <label className="block text-[10px] text-autocad-textMuted">Prefijo
                <input value={symbolPrefix} onChange={(event) => setSymbolPrefix(event.target.value.toUpperCase())} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-yellow font-mono font-bold" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-autocad-textMuted">Ancho
                  <input type="number" value={symbolWidth} onChange={(event) => setSymbolWidth(Number(event.target.value))} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono" />
                </label>
                <label className="text-[10px] text-autocad-textMuted">Alto
                  <input type="number" value={symbolHeight} onChange={(event) => setSymbolHeight(Number(event.target.value))} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono" />
                </label>
              </div>
            </div>

            <DrawLayers layers={layers} activeLayerId={activeLayerId} onChange={setLayers} onActive={setActiveLayerId} />

            <div className="space-y-2 border-b border-autocad-border pb-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-autocad-yellow uppercase text-[11px]">Bornes ({pins.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    const id = `pin_${Date.now().toString(36)}`;
                    const label = String(pins.length + 1);
                    setPins(prev => [...prev, { id, label, x: 0, y: -25 }]);
                    editor.setSelectedPinId(id);
                  }}
                  className="px-2 py-0.5 bg-blue-950 border border-blue-500/40 text-blue-300 rounded text-[10px]"
                >
                  + Borne
                </button>
              </div>
              <label className="block text-[10px] text-autocad-textMuted">
                Radio de los bornes: <span className="text-white font-mono">{pinRadius.toFixed(1)}</span>
                <input type="range" min="0.6" max="4" step="0.1" value={pinRadius} onChange={(event) => setPinRadius(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {pins.map(pin => (
                  <div
                    key={pin.id}
                    onClick={() => editor.setSelectedPinId(pin.id)}
                    className={`p-1.5 rounded border flex items-center gap-1 ${activePin?.id === pin.id ? 'bg-red-950/40 border-red-500' : 'bg-autocad-inset border-autocad-border/60'}`}
                  >
                    <input value={pin.label || pin.id} onChange={(event) => setPins(prev => prev.map(item => item.id === pin.id ? { ...item, label: event.target.value } : item))} className="w-12 bg-autocad-surface border border-autocad-border rounded px-1 text-[10px] text-autocad-cyan font-mono" />
                    <input type="number" value={pin.x} onChange={(event) => setPins(prev => prev.map(item => item.id === pin.id ? { ...item, x: Number(event.target.value) } : item))} className="w-12 bg-autocad-surface border border-autocad-border rounded px-1 text-center font-mono text-[10px]" />
                    <input type="number" value={pin.y} onChange={(event) => setPins(prev => prev.map(item => item.id === pin.id ? { ...item, y: Number(event.target.value) } : item))} className="w-12 bg-autocad-surface border border-autocad-border rounded px-1 text-center font-mono text-[10px]" />
                    <input type="number" min="0.6" max="4" step="0.1" title="Radio de este borne" value={pin.r ?? pinRadius} onChange={(event) => setPins(prev => prev.map(item => item.id === pin.id ? { ...item, r: Number(event.target.value) } : item))} className="w-12 bg-autocad-surface border border-autocad-border rounded px-1 text-center font-mono text-[10px] text-red-300" />
                    <button type="button" onClick={(event) => { event.stopPropagation(); setPins(prev => prev.filter(item => item.id !== pin.id)); setPinLinks(prev => prev.filter(link => link.from !== pin.id && link.to !== pin.id)); }} className="text-autocad-textMuted hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {activeNode && (
              <div className="space-y-2 border-b border-autocad-border pb-3">
                <span className="font-bold text-white uppercase text-[11px]">Nodo {editor.selectedNode.index + 1}</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-autocad-textMuted">X
                    <input type="number" step="0.01" value={activeNode.x} onChange={(event) => editor.setNodePosition('x', event.target.value)} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono" />
                  </label>
                  <label className="text-[10px] text-autocad-textMuted">Y
                    <input type="number" step="0.01" value={activeNode.y} onChange={(event) => editor.setNodePosition('y', event.target.value)} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono" />
                  </label>
                </div>
              </div>
            )}

            {selected?.type === 'text' && (
              <label className="block text-[10px] text-autocad-textMuted">Texto
                <input value={selected.text || ''} onChange={(event) => editor.updateSelected({ text: event.target.value })} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono text-autocad-yellow" />
              </label>
            )}
            {selected?.type === 'circle' && (
              <label className="block text-[10px] text-autocad-textMuted">Radio
                <input type="number" min="0.4" step="0.5" value={selected.r} onChange={(event) => editor.updateSelected({ r: Number(event.target.value) })} className="mt-0.5 w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 font-mono" />
              </label>
            )}
          </div>
        </div>
      </div>
      <BlockProgramWindow
        open={programOpen && symbolRole !== 'source' && symbolRole !== 'motor'}
        title={symbolName}
        pins={pins}
        program={program}
        actuated={spriteMode === 'actuated'}
        onChange={handleProgramChange}
        onSave={handleSave}
        onClose={() => setProgramOpen(false)}
      />
    </div>
  );
}
