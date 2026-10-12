import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import CadCanvas from './components/CadCanvas';
import BottomStatusBar from './components/BottomStatusBar';
import DeviceListModal from './components/DeviceListModal';
import SymbolEditorModal from './components/SymbolEditorModal';
import { SYMBOL_DEFINITIONS } from './cad/symbolCatalog';
import { createBlankSymbol, getActiveSymbolDefinitions, isCustomDrawn, librarySymbolDefinitions } from './cad/symbolStore';
import { solveCircuit } from './simulation/circuitSolver';
import { exportSheetToDxf } from './services/dxfExporter';
import {
  downloadProjectFile,
  installProjectSymbols,
  readProjectFile,
  recallProject,
  rememberProject
} from './services/projectFile';
import { SAMPLE_PROJECTS } from './sampleProjects';
import { applyPlanTheme, readStoredPlanTheme } from './theme/planThemes';
import { reanchorWire } from './cad/componentPose';
import { ioOf, userCanOperate } from './cad/ioKind';

function loadInitialWorkspace() {
  const recalled = recallProject();
  if (!recalled) {
    return {
      project: SAMPLE_PROJECTS[0],
      sheetId: SAMPLE_PROJECTS[0].sheets[0].id
    };
  }
  try {
    installProjectSymbols(recalled.symbols);
  } catch (err) {
    console.warn('No se pudieron restaurar las piezas del diseño:', err);
  }
  return { project: recalled.project, sheetId: recalled.activeSheetId };
}

export default function App() {
  const [boot] = useState(loadInitialWorkspace);
  const [project, setProject] = useState(boot.project);
  const [activeSheetId, setActiveSheetId] = useState(boot.sheetId);

  // Symbol Definitions (Supports dynamic custom pieces)
  const [symbolDefs, setSymbolDefs] = useState(getActiveSymbolDefinitions);
  const librarySymbols = librarySymbolDefinitions(symbolDefs);
  const [isSymbolEditorOpen, setIsSymbolEditorOpen] = useState(false);
  const [editingSymbolType, setEditingSymbolType] = useState('');

  const handleOpenSymbolEditor = (type) => {
    setEditingSymbolType(type || '');
    setIsSymbolEditorOpen(true);
  };

  const handleCreateSymbol = (category) => {
    const def = createBlankSymbol(category);
    setSymbolDefs(getActiveSymbolDefinitions());
    setEditingSymbolType(def.type);
    setIsSymbolEditorOpen(true);
  };

  const handleSymbolsUpdated = () => {
    setSymbolDefs(getActiveSymbolDefinitions());
  };

  // Keep the open design in this browser. Guardar also downloads a copy.
  useEffect(() => {
    try {
      rememberProject(project, activeSheetId);
    } catch (err) {
      console.warn('No se pudo recordar el diseño:', err);
    }
  }, [project, activeSheetId, symbolDefs]);

  // Active Tool & Placement
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'wire' | 'pan' | 'delete' | 'rotate'
  const [placingSymbol, setPlacingSymbol] = useState(null);

  // Selected Element Inspector
  const [selectedElement, setSelectedElement] = useState(null);

  // CAD Toggles
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(true);
  const [planTheme, setPlanTheme] = useState(readStoredPlanTheme);

  // Cursor coordinates
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simData, setSimData] = useState(null);
  const [simLogs, setSimLogs] = useState([]);

  // Modals
  const [isBomOpen, setIsBomOpen] = useState(false);

  // Get active sheet
  const activeSheet = project.sheets.find(s => s.id === activeSheetId) || project.sheets[0];

  // Flatten all components across all project sheets for cross-sheet synchronization
  const allComponents = project.sheets.flatMap(s => s.components || []);
  const allWires = project.sheets.flatMap(s => s.wires || []);

  const projectRef = useRef(project);
  projectRef.current = project;
  const symbolDefsRef = useRef(symbolDefs);
  symbolDefsRef.current = symbolDefs;
  const isSimulatingRef = useRef(isSimulating);
  isSimulatingRef.current = isSimulating;
  const derivedSimRef = useRef(new Map());
  const simSignatureRef = useRef('');
  const heldInteractionRef = useRef(null);
  const commitSimulationRef = useRef(() => {});
  const releaseInteractionRef = useRef(() => {});

  const defFor = (type) => symbolDefsRef.current[type] || SYMBOL_DEFINITIONS[type];

  const isThermalDef = (def) => def?.switchType === 'thermal' || def?.linkedRole === 'thermal';

  const tagKey = (tag) => String(tag || '').trim().toUpperCase();

  const sameTag = (a, b) => {
    const left = tagKey(a);
    const right = tagKey(b);
    return left !== '' && left === right;
  };

  // Operated means the piece is away from rest: button held, switch on, breaker open, thermal tripped.
  const isOperated = (def, state) => {
    const current = state || {};
    if (!def) return !!current.pressed;
    if (isCustomDrawn(def)) return !!current.on || !!current.pressed;
    if (def.switchType === 'momentary_NC' || def.contactType === 'NC') return !!current.pressed || current.closed === false;
    if (def.switchType === 'breaker') return current.closed === false;
    if (isThermalDef(def)) return !!current.tripped;
    if (def.switchType === 'momentary_NO' || def.role === 'switch' || def.role === 'contact') {
      return !!current.pressed || !!current.closed;
    }
    return !!current.pressed;
  };

  const stateForOperation = (def, state, operated) => {
    const next = { ...(state || {}) };
    if (!def) return next;
    if (isCustomDrawn(def)) {
      next.on = !!operated;
      return next;
    }
    if (def.switchType === 'momentary_NC' || def.contactType === 'NC') {
      next.pressed = !!operated;
      next.closed = !operated;
      return next;
    }
    if (def.switchType === 'breaker') {
      next.closed = !operated;
      return next;
    }
    if (isThermalDef(def)) {
      next.tripped = !!operated;
      return next;
    }
    if (
      def.switchType === 'momentary_NO'
      || def.role === 'switch'
      || def.role === 'contact'
      || def.contactType === 'NO'
      || def.contactType === 'power_3p'
    ) {
      next.pressed = !!operated;
      next.closed = !!operated;
      return next;
    }
    return next;
  };

  const nextFreeTag = (prefix, components) => {
    const used = new Set(components.map(comp => tagKey(comp.tag)).filter(Boolean));
    const head = tagKey(prefix) || 'K';
    let number = 1;
    while (used.has(`${head}${number}`)) number += 1;
    return `${head}${number}`;
  };

  // -K1 belongs to the family -K. -KM1 does not.
  const tagInFamily = (tag, prefix) => {
    const value = tagKey(tag);
    const head = tagKey(prefix);
    if (!head || !value.startsWith(head)) return false;
    return /^[0-9]+$/.test(value.slice(head.length));
  };

  // The coil takes the next free -Kn. Its switch takes that same -Kn.
  // A switch placed first keeps its tag, and the next coil adopts it.
  const tagForPlacedPiece = (def, components) => {
    const family = (comp) => tagInFamily(comp.tag, def.prefix);
    const roleOf = (comp) => defFor(comp.type)?.role;

    if (def.role === 'coil') {
      const coilTags = new Set(
        components
          .filter(comp => family(comp) && roleOf(comp) === 'coil')
          .map(comp => tagKey(comp.tag))
      );
      const waiting = components.find(comp => (
        family(comp)
        && roleOf(comp) === 'contact'
        && defFor(comp.type)?.followsRole === 'coil'
        && !coilTags.has(tagKey(comp.tag))
      ));
      if (waiting) return waiting.tag;
    }

    if (def.followsRole) {
      const leader = [...components].reverse().find(comp => (
        family(comp) && roleOf(comp) === def.followsRole
      ));
      if (leader) return leader.tag;
    }

    return nextFreeTag(def.prefix || '-K', components);
  };

  function withComponentState(source, compId, produceState) {
    const all = source.sheets.flatMap(sheet => sheet.components || []);
    const target = all.find(comp => comp.id === compId);
    if (!target) return source;

    const def = defFor(target.type);
    const nextState = produceState({ ...(target.state || {}) }, def);
    const operated = isOperated(def, nextState);

    return {
      ...source,
      sheets: source.sheets.map(sheet => ({
        ...sheet,
        components: (sheet.components || []).map(comp => {
          if (comp.id === compId) return { ...comp, state: nextState };
          if (!sameTag(comp.tag, target.tag)) return comp;
          const siblingDef = defFor(comp.type);
          // A click on one input can move the other inputs of that name.
          // It must not force a coil, a contact or any other output.
          if (ioOf(def) !== 'in' || ioOf(siblingDef) !== 'in') return comp;
          return { ...comp, state: stateForOperation(siblingDef, comp.state, operated) };
        })
      }))
    };
  }

  function rememberSimulation(result) {
    const nextDerived = new Map();
    result.updatedComponents.forEach(comp => {
      nextDerived.set(comp.id, {
        closed: typeof comp.state?.closed === 'boolean' ? comp.state.closed : undefined,
        tripped: !!comp.state?.tripped,
        energized: !!comp.energized
      });
    });
    derivedSimRef.current = nextDerived;

    const signature = result.updatedComponents
      .map(comp => `${comp.id}:${comp.energized ? 1 : 0}:${comp.state?.closed ? 1 : 0}:${comp.state?.tripped ? 1 : 0}`)
      .join('|');

    if (signature !== simSignatureRef.current) {
      simSignatureRef.current = signature;
      if (result.logs?.length) {
        setSimLogs(prev => [...prev, ...result.logs].slice(-40));
      }
    }
  }

  function commitSimulation(source) {
    const components = source.sheets.flatMap(sheet => sheet.components || []);
    const wires = source.sheets.flatMap(sheet => sheet.wires || []);
    const result = solveCircuit(components, wires, symbolDefsRef.current, derivedSimRef.current);
    rememberSimulation(result);
    setSimData(result);
    return result;
  }

  commitSimulationRef.current = commitSimulation;

  function releaseHeldInteraction() {
    const held = heldInteractionRef.current;
    if (!held) return;
    heldInteractionRef.current = null;

    const prev = projectRef.current;
    const next = held.kind === 'momentary_NC'
      ? withComponentState(prev, held.id, (state) => ({ ...state, pressed: false, closed: true }))
      : withComponentState(prev, held.id, (state) => ({ ...state, pressed: false, closed: false }));

    projectRef.current = next;
    setProject(next);
    if (isSimulatingRef.current) commitSimulationRef.current(next);
  }

  releaseInteractionRef.current = releaseHeldInteraction;

  // Solve the whole project whenever the circuit or the simulation mode changes.
  useEffect(() => {
    if (!isSimulating) {
      heldInteractionRef.current = null;
      derivedSimRef.current = new Map();
      simSignatureRef.current = '';
      setSimData(null);
      return;
    }
    commitSimulation(project);
  }, [isSimulating, project, symbolDefs]);

  useEffect(() => {
    const onPointerUp = () => releaseInteractionRef.current();
    window.addEventListener('mouseup', onPointerUp);
    return () => window.removeEventListener('mouseup', onPointerUp);
  }, []);

  const handleToggleSimulation = () => {
    if (isSimulatingRef.current) {
      releaseHeldInteraction();
      setIsSimulating(false);
      return;
    }
    setIsSimulating(true);
  };

  // Pushbuttons conduct only while the pointer is down. Breakers and thermals latch.
  const handleSimulationPointerDown = (compId) => {
    if (!isSimulatingRef.current) return;

    const prev = projectRef.current;
    const comp = prev.sheets.flatMap(sheet => sheet.components || []).find(item => item.id === compId);
    if (!comp) return;

    const def = defFor(comp.type);
    if (!def) return;

    if (!userCanOperate(def)) {
      const tag = comp.tag || def.name || 'Pieza';
      setSimLogs(prev => [...prev, `[SIM] ${tag} es salida (OUT). Solo el circuito puede activarla.`].slice(-40));
      return;
    }

    let next = null;

    if (ioOf(def) === 'inout') {
      next = withComponentState(prev, comp.id, (state) => ({ ...state, forced: !state.forced }));
    } else if (isCustomDrawn(def)) {
      next = withComponentState(prev, compId, (state) => ({ ...state, on: !state.on }));
    } else if (def.switchType === 'momentary_NO') {
      heldInteractionRef.current = { id: compId, kind: 'momentary_NO' };
      next = withComponentState(prev, compId, (state) => ({ ...state, pressed: true, closed: true }));
    } else if (def.switchType === 'momentary_NC') {
      heldInteractionRef.current = { id: compId, kind: 'momentary_NC' };
      next = withComponentState(prev, compId, (state) => ({ ...state, pressed: true, closed: false }));
    } else if (def.switchType === 'breaker') {
      const closed = comp.state?.closed === false;
      next = withComponentState(prev, compId, (state) => ({ ...state, closed }));
    } else if (isThermalDef(def)) {
      const tripped = !comp.state?.tripped;
      next = withComponentState(prev, compId, (state) => ({ ...state, tripped }));
    } else if (def.role === 'switch') {
      next = withComponentState(prev, compId, (state) => ({ ...state, closed: !state.closed }));
    }

    if (!next) return;
    projectRef.current = next;
    setProject(next);
    commitSimulation(next);
  };

  // Add Component (Place Symbol onto active sheet)
  const handlePlaceSymbol = (symbolType, x, y) => {
    const def = symbolDefs[symbolType] || SYMBOL_DEFINITIONS[symbolType];
    if (!def) return;

    const newTag = tagForPlacedPiece(def, allComponents);

    const newComp = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: symbolType,
      tag: newTag,
      x,
      y,
      state: { ...(def.defaultState || {}) }
    };

    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet =>
        sheet.id === activeSheetId
          ? { ...sheet, components: [...(sheet.components || []), newComp] }
          : sheet
      )
    }));

    setPlacingSymbol(null);
    setActiveTool('select');
  };

  // Update Component (e.g. tag, position, rotation, state)
  const handleUpdateComponent = (compId, updates) => {
    const poseChanged = ['x', 'y', 'rotation'].some(key => Object.prototype.hasOwnProperty.call(updates, key));
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => {
        const components = (sheet.components || []).map(comp =>
          comp.id === compId ? { ...comp, ...updates } : comp
        );
        const touched = poseChanged && (sheet.components || []).some(comp => comp.id === compId);
        return {
          ...sheet,
          components,
          wires: touched
            ? (sheet.wires || []).map(wire => (
              wire.from?.compId === compId || wire.to?.compId === compId
                ? reanchorWire(wire, components, comp => defFor(comp.type))
                : wire
            ))
            : sheet.wires
        };
      })
    }));

    if (selectedElement?.type === 'component' && selectedElement.id === compId) {
      setSelectedElement(prev => ({
        ...prev,
        data: { ...prev.data, ...updates }
      }));
    }
  };

  // Delete Component
  const handleDeleteComponent = (compId) => {
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => ({
        ...sheet,
        components: (sheet.components || []).filter(comp => comp.id !== compId),
        // Also remove wires connected to this component
        wires: (sheet.wires || []).filter(
          wire => wire.from.compId !== compId && wire.to.compId !== compId
        )
      }))
    }));
    if (selectedElement?.id === compId) {
      setSelectedElement(null);
    }
  };

  // Add Wire
  const handleAddWire = (wire) => {
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet =>
        sheet.id === activeSheetId
          ? { ...sheet, wires: [...(sheet.wires || []), wire] }
          : sheet
      )
    }));
  };

  // Delete Wire
  const handleDeleteWire = (wireId) => {
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => ({
        ...sheet,
        wires: (sheet.wires || []).filter(wire => wire.id !== wireId)
      }))
    }));
    if (selectedElement?.id === wireId) {
      setSelectedElement(null);
    }
  };

  // Sheet Management
  const handleAddSheet = () => {
    const sheetNum = project.sheets.length + 1;
    const newSheet = {
      id: `sheet_${Date.now()}`,
      title: `Plano Eléctrico ${sheetNum}`,
      sizeKey: 'A4_HORIZONTAL',
      width: 1100,
      height: 750,
      components: [],
      wires: []
    };

    setProject(prev => ({
      ...prev,
      sheets: [...prev.sheets, newSheet]
    }));
    setActiveSheetId(newSheet.id);
  };

  const handleCloseSheet = (sheetId) => {
    if (project.sheets.length <= 1) return;
    const filtered = project.sheets.filter(s => s.id !== sheetId);
    setProject(prev => ({ ...prev, sheets: filtered }));
    if (activeSheetId === sheetId) {
      setActiveSheetId(filtered[0].id);
    }
  };

  const handleUpdateSheetConfig = (updates) => {
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet =>
        sheet.id === activeSheetId ? { ...sheet, ...updates } : sheet
      )
    }));
  };

  // Load Presets
  const handleLoadPreset = (presetKey) => {
    if (presetKey === 'proj_motor_starter') {
      setProject(SAMPLE_PROJECTS[0]);
      setActiveSheetId(SAMPLE_PROJECTS[0].sheets[0].id);
      setIsSimulating(false);
    } else if (presetKey === 'empty') {
      const emptyProject = {
        id: `proj_${Date.now()}`,
        name: 'Nuevo Proyecto Eléctrico',
        sheets: [
          {
            id: 'sheet_1',
            title: 'Plano Principal',
            sizeKey: 'A4_HORIZONTAL',
            width: 1100,
            height: 750,
            components: [],
            wires: []
          }
        ]
      };
      setProject(emptyProject);
      setActiveSheetId('sheet_1');
      setIsSimulating(false);
    }
  };

  const projectHasWork = (source) => (source?.sheets || []).some(sheet =>
    (sheet.components || []).length > 0 || (sheet.wires || []).length > 0
  );

  const applyLoadedProject = (loaded) => {
    installProjectSymbols(loaded.symbols);
    setSymbolDefs(getActiveSymbolDefinitions());
    setProject(loaded.project);
    setActiveSheetId(loaded.activeSheetId);
    setSelectedElement(null);
    setPlacingSymbol(null);
    setIsSimulating(false);
    setSimLogs(prev => [...prev, `[ARCHIVO] Diseño "${loaded.project.name || 'sin nombre'}" abierto.`]);
  };

  const handleSaveProject = () => {
    try {
      const filename = downloadProjectFile(project, activeSheetId);
      setSimLogs(prev => [...prev, `[ARCHIVO] Diseño guardado en ${filename}.`]);
    } catch (err) {
      console.error('Error guardando el diseño:', err);
      setSimLogs(prev => [...prev, '[ARCHIVO] No se pudo guardar el diseño.']);
    }
  };

  const handleOpenProject = async (file) => {
    if (!file) return;
    if (projectHasWork(project) && !window.confirm('Abrir este archivo reemplaza el plano que tienes ahora. ¿Continuar?')) {
      return;
    }
    try {
      applyLoadedProject(await readProjectFile(file));
    } catch (err) {
      console.error('Error abriendo el diseño:', err);
      setSimLogs(prev => [...prev, `[ARCHIVO] No se pudo abrir el archivo. ${err.message || ''}`.trim()]);
    }
  };

  // Export to DXF
  const handleExportDxf = async () => {
    try {
      await exportSheetToDxf(activeSheet, project.name);
      setSimLogs(prev => [
        ...prev,
        `[DXF] Plano "${activeSheet.title}" exportado con éxito a formato AutoCAD DXF R12 / R2000.`
      ]);
    } catch (err) {
      console.error('Error exportando a DXF:', err);
    }
  };

  const energizedById = {};
  if (isSimulating && simData?.updatedComponents) {
    simData.updatedComponents.forEach(comp => {
      if (comp.energized) energizedById[comp.id] = true;
    });
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-autocad-bg text-autocad-textBright font-cad select-none">
      {/* 1. TOP HEADER & TABS BAR */}
      <TopBar
        sheets={project.sheets}
        activeSheetId={activeSheetId}
        onSelectSheet={setActiveSheetId}
        onAddSheet={handleAddSheet}
        onCloseSheet={handleCloseSheet}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onExportDxf={handleExportDxf}
        onOpenSymbolEditor={() => handleOpenSymbolEditor()}
        isSimulating={isSimulating}
        onToggleSimulation={handleToggleSimulation}
        gridEnabled={gridEnabled}
        setGridEnabled={setGridEnabled}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        orthoEnabled={orthoEnabled}
        setOrthoEnabled={setOrthoEnabled}
        onLoadPreset={handleLoadPreset}
        planTheme={planTheme}
        onPlanTheme={(id) => setPlanTheme(applyPlanTheme(id))}
      />

      {/* 2. MAIN WORKSPACE (LEFT NAV + CAD CANVAS + RIGHT INSPECTOR) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Drawer (Symbol library, Project tree, Tag sync manager) */}
        <LeftSidebar
          sheets={project.sheets}
          activeSheetId={activeSheetId}
          onSelectSheet={setActiveSheetId}
          onStartPlaceSymbol={(symType) => {
            setPlacingSymbol(symType);
            setActiveTool('select');
          }}
          activePlacingSymbol={placingSymbol}
          allComponents={allComponents}
          energizedById={energizedById}
          isSimulating={isSimulating}
          symbolDefs={librarySymbols}
          onOpenSymbolEditor={handleOpenSymbolEditor}
          onCreateSymbol={handleCreateSymbol}
        />

        {/* CAD Canvas Engine */}
        <main className="plan-frame flex-1 h-full relative">
          <CadCanvas
            sheet={activeSheet}
            activeTool={activeTool}
            placingSymbol={placingSymbol}
            symbolDefs={symbolDefs}
            onPlaceSymbol={handlePlaceSymbol}
            onUpdateComponent={handleUpdateComponent}
            onDeleteComponent={handleDeleteComponent}
            onDeleteWire={handleDeleteWire}
            onAddWire={handleAddWire}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            isSimulating={isSimulating}
            simulatedData={simData}
            gridEnabled={gridEnabled}
            snapEnabled={snapEnabled}
            orthoEnabled={orthoEnabled}
            onCursorMove={(x, y) => setCursorPos({ x, y })}
            onSimulationPointerDown={handleSimulationPointerDown}
          />
        </main>

        {/* Right Inspector & Sheet Settings */}
        <RightSidebar
          selectedElement={selectedElement}
          onUpdateComponent={handleUpdateComponent}
          onDeleteComponent={handleDeleteComponent}
          sheet={activeSheet}
          onUpdateSheetConfig={handleUpdateSheetConfig}
          gridEnabled={gridEnabled}
          setGridEnabled={setGridEnabled}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          orthoEnabled={orthoEnabled}
          setOrthoEnabled={setOrthoEnabled}
          symbolDefs={symbolDefs}
          onOpenSymbolEditor={handleOpenSymbolEditor}
        />
      </div>

      {/* 3. BOTTOM AUTOCAD STATUS BAR & SIMULATION TERMINAL */}
      <BottomStatusBar
        cursorPos={cursorPos}
        gridEnabled={gridEnabled}
        snapEnabled={snapEnabled}
        orthoEnabled={orthoEnabled}
        isSimulating={isSimulating}
        simLogs={simLogs}
        onOpenBomModal={() => setIsBomOpen(true)}
      />

      {/* 4. MODALS (BOM / PIECE EDITOR) */}
      <DeviceListModal
        isOpen={isBomOpen}
        onClose={() => setIsBomOpen(false)}
        sheets={project.sheets}
        energizedById={energizedById}
        isSimulating={isSimulating}
      />

      <SymbolEditorModal
        isOpen={isSymbolEditorOpen}
        onClose={() => setIsSymbolEditorOpen(false)}
        symbolDefinitions={librarySymbols}
        onSymbolsUpdated={handleSymbolsUpdated}
        initialSymbolType={editingSymbolType}
      />
    </div>
  );
}
