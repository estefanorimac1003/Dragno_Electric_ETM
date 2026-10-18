import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import CadCanvas from './components/CadCanvas';
import BottomStatusBar from './components/BottomStatusBar';
import DeviceListModal from './components/DeviceListModal';
import SymbolEditorModal from './components/SymbolEditorModal';
import { SYMBOL_DEFINITIONS } from './cad/symbolCatalog';
import { createBlankSymbol, getActiveSymbolDefinitions, hideSymbolFromLibrary, isCustomDrawn, librarySymbolDefinitions } from './cad/symbolStore';
import { solveCircuit } from './simulation/circuitSolver';
import { exportSheetToDxf } from './services/dxfExporter';
import {
  downloadProjectFile,
  installLibraryHidden,
  installProjectSymbols,
  readProjectFile,
  recallProject,
  rememberProject
} from './services/projectFile';
import { SAMPLE_PROJECTS } from './sampleProjects';
import { applyPlanTheme, readStoredPlanTheme } from './theme/planThemes';
import { reanchorWire } from './cad/componentPose';
import { applySelectionMove, insertWirePoint } from './cad/wireGeometry';
import { createDesignHistory, endDesignGesture, noteDesignChange, redoDesign, undoDesign } from './cad/designHistory';
import { ioOf, userCanOperate } from './cad/ioKind';
import { isMomentaryPushbutton, pressedPushbuttonState, releasedPushbuttonState } from './cad/pushbutton';

function loadInitialWorkspace() {
  const recalled = recallProject();
  if (!recalled) {
    return {
      project: SAMPLE_PROJECTS[0],
      sheetId: SAMPLE_PROJECTS[0].sheets[0].id
    };
  }
  try {
    installLibraryHidden(recalled.libraryHidden);
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

  // Remove one library entry. Copies already placed on a sheet stay there.
  const handleRemoveLibrarySymbol = (type) => {
    const def = symbolDefs[type] || SYMBOL_DEFINITIONS[type];
    if (!type || def?.role === 'source') return;
    hideSymbolFromLibrary(type);
    setPlacingSymbol(current => (current === type ? null : current));
    if (editingSymbolType === type) {
      setIsSymbolEditorOpen(false);
      setEditingSymbolType('');
    }
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
  const activeSheetIdRef = useRef(activeSheetId);
  activeSheetIdRef.current = activeSheetId;
  const historyRef = useRef(createDesignHistory());
  const [historySteps, setHistorySteps] = useState({ undo: 0, redo: 0 });

  const publishHistory = (history) => {
    historyRef.current = history;
    setHistorySteps({ undo: history.past.length, redo: history.future.length });
  };

  // One snapshot before a change. A repeated gesture, such as dragging, keeps that first snapshot.
  const rememberDesign = (gestureKey = null) => {
    const next = noteDesignChange(historyRef.current, {
      project: projectRef.current,
      activeSheetId: activeSheetIdRef.current
    }, gestureKey);
    if (next === historyRef.current) return;
    publishHistory(next);
  };

  const currentDesign = () => ({
    project: projectRef.current,
    activeSheetId: activeSheetIdRef.current
  });

  const applyDesignSnapshot = (snapshot) => {
    heldInteractionRef.current = null;
    projectRef.current = snapshot.project;
    setProject(snapshot.project);
    setActiveSheetId(snapshot.activeSheetId);
    setSelectedElement(null);
    setPlacingSymbol(null);
  };

  const handleUndoDesign = () => {
    const result = undoDesign(historyRef.current, currentDesign());
    if (!result) return;
    publishHistory(result.history);
    applyDesignSnapshot(result.snapshot);
  };

  const handleRedoDesign = () => {
    const result = redoDesign(historyRef.current, currentDesign());
    if (!result) return;
    publishHistory(result.history);
    applyDesignSnapshot(result.snapshot);
  };

  const handleUndoRef = useRef(handleUndoDesign);
  const handleRedoRef = useRef(handleRedoDesign);
  handleUndoRef.current = handleUndoDesign;
  handleRedoRef.current = handleRedoDesign;
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
          if (ioOf(def, target) !== 'in' || ioOf(siblingDef, comp) !== 'in') return comp;
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
        energized: !!comp.energized,
        spin: comp.spin === 'cw' || comp.spin === 'ccw' ? comp.spin : null
      });
    });
    derivedSimRef.current = nextDerived;

    const signature = result.updatedComponents
      .map(comp => `${comp.id}:${comp.energized ? 1 : 0}:${comp.spin || ''}:${comp.state?.closed ? 1 : 0}:${comp.state?.tripped ? 1 : 0}:${(comp.programOutputs || []).join('.')}:${(comp.programRares || []).map(item => item.name).join('.')}:${comp.programNote || ''}`)
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
    const def = defFor(prev.sheets.flatMap(sheet => sheet.components || []).find(item => item.id === held.id)?.type);
    const next = withComponentState(prev, held.id, (state) => releasedPushbuttonState(state, def));

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
    const onPointerUp = () => {
      releaseInteractionRef.current();
      const next = endDesignGesture(historyRef.current);
      if (next !== historyRef.current) historyRef.current = next;
    };
    const onKeyDown = (event) => {
      if (document.querySelector('[data-symbol-editor]')) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndoRef.current();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedoRef.current();
      }
    };
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleToggleSimulation = () => {
    if (isSimulatingRef.current) {
      releaseHeldInteraction();
      setIsSimulating(false);
      return;
    }
    // A pulsador cannot stay pressed. Drop a leftover hand before the solve,
    // so a normally closed stop conducts again at rest.
    const prev = projectRef.current;
    let changed = false;
    const next = {
      ...prev,
      sheets: (prev.sheets || []).map(sheet => ({
        ...sheet,
        components: (sheet.components || []).map(comp => {
          const def = defFor(comp.type);
          if (!isMomentaryPushbutton(def)) return comp;
          if (!comp.state?.on && !comp.state?.pressed) return comp;
          changed = true;
          return { ...comp, state: releasedPushbuttonState(comp.state, def) };
        })
      }))
    };
    if (changed) {
      projectRef.current = next;
      setProject(next);
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

    if (!userCanOperate(def, comp)) {
      const tag = comp.tag || def.name || 'Pieza';
      setSimLogs(prev => [...prev, `[SIM] ${tag} es salida (OUT). Solo el circuito puede activarla.`].slice(-40));
      return;
    }

    let next = null;
    const direction = ioOf(def, comp);

    if (direction === 'inout') {
      next = withComponentState(prev, comp.id, (state) => ({ ...state, forced: !state.forced }));
    } else if (isMomentaryPushbutton(def)) {
      heldInteractionRef.current = { id: compId, kind: 'momentary' };
      next = withComponentState(prev, compId, (state) => pressedPushbuttonState(state, def));
    } else if (isCustomDrawn(def)) {
      next = withComponentState(prev, compId, (state) => ({ ...state, on: !state.on }));
    } else if (def.switchType === 'breaker') {
      const closed = comp.state?.closed === false;
      next = withComponentState(prev, compId, (state) => ({ ...state, closed }));
    } else if (isThermalDef(def)) {
      const tripped = !comp.state?.tripped;
      next = withComponentState(prev, compId, (state) => ({ ...state, tripped }));
    } else if (def.role === 'switch') {
      next = withComponentState(prev, compId, (state) => ({ ...state, closed: !state.closed }));
    } else if (def.role === 'contact') {
      next = withComponentState(prev, compId, (state) => ({ ...state, on: !state.on }));
    } else if (def.role === 'coil' || def.role === 'load' || def.role === 'motor') {
      next = withComponentState(prev, compId, (state) => ({ ...state, on: !state.on }));
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

    rememberDesign();
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
    let gesture = null;
    if (Object.prototype.hasOwnProperty.call(updates, 'x') || Object.prototype.hasOwnProperty.call(updates, 'y')) {
      gesture = `move:${compId}`;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'tagOffset')) {
      gesture = `tagpos:${compId}`;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'nameOffset')) {
      gesture = `namepos:${compId}`;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'tag')) {
      gesture = `tag:${compId}`;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      gesture = `name:${compId}`;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'nameStyle')) {
      gesture = `namestyle:${compId}`;
    }
    rememberDesign(gesture);
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

  // One drag moves every marked piece and every marked cable in the same step.
  const handleMoveComponents = (moves, wireMoves = []) => {
    const componentMoves = Array.isArray(moves) ? moves : [];
    const cableMoves = Array.isArray(wireMoves) ? wireMoves : [];
    if (!componentMoves.length && !cableMoves.length) return;
    rememberDesign('move:selection');
    const byId = new Map(componentMoves.map(item => [item.id, item]));
    const cableIds = new Set(cableMoves.map(item => item.id));
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => {
        const touched = (sheet.components || []).some(comp => byId.has(comp.id))
          || (sheet.wires || []).some(wire => cableIds.has(wire.id));
        if (!touched) return sheet;
        const moved = applySelectionMove(
          sheet.components,
          sheet.wires,
          componentMoves,
          cableMoves,
          comp => defFor(comp.type)
        );
        return { ...sheet, components: moved.components, wires: moved.wires };
      })
    }));
    if (selectedElement?.type === 'component' && byId.has(selectedElement.id)) {
      const move = byId.get(selectedElement.id);
      setSelectedElement(prev => ({
        ...prev,
        data: { ...prev.data, x: move.x, y: move.y }
      }));
    }
  };

  const handleDeleteSelection = (items) => {
    if (!items?.length) return;
    const compIds = new Set(items.filter(item => item.type === 'component').map(item => item.id));
    const wireIds = new Set(items.filter(item => item.type === 'wire').map(item => item.id));
    rememberDesign();
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => ({
        ...sheet,
        components: (sheet.components || []).filter(comp => !compIds.has(comp.id)),
        wires: (sheet.wires || []).filter(wire => (
          !wireIds.has(wire.id)
          && !compIds.has(wire?.from?.compId)
          && !compIds.has(wire?.to?.compId)
        ))
      }))
    }));
    setSelectedElement(null);
  };

  // Delete one placed piece by its own id. Two pieces may share a tag.
  const handleDeleteComponent = (compId) => {
    rememberDesign();
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => ({
        ...sheet,
        components: (sheet.components || []).filter(comp => comp.id !== compId),
        wires: (sheet.wires || []).filter(wire => (
          wire?.from?.compId !== compId && wire?.to?.compId !== compId
        ))
      }))
    }));
    if (selectedElement?.id === compId) {
      setSelectedElement(null);
    }
  };

  // Add Wire. A join inserts the touched point into the cable that was hit.
  const handleAddWire = (wire, joins = []) => {
    rememberDesign();
    setProject(prev => ({
      ...prev,
      sheets: prev.sheets.map(sheet => {
        if (sheet.id !== activeSheetId) return sheet;
        let wires = sheet.wires || [];
        joins.forEach(join => {
          wires = wires.map(item => (
            item.id === join.wireId ? insertWirePoint(item, join.point) : item
          ));
        });
        return { ...sheet, wires: [...wires, wire] };
      })
    }));
  };

  // Delete Wire
  const handleDeleteWire = (wireId) => {
    rememberDesign();
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

    rememberDesign();
    setProject(prev => ({
      ...prev,
      sheets: [...prev.sheets, newSheet]
    }));
    setActiveSheetId(newSheet.id);
  };

  const handleCloseSheet = (sheetId) => {
    if (project.sheets.length <= 1) return;
    const filtered = project.sheets.filter(s => s.id !== sheetId);
    rememberDesign();
    setProject(prev => ({ ...prev, sheets: filtered }));
    if (activeSheetId === sheetId) {
      setActiveSheetId(filtered[0].id);
    }
  };

  const handleUpdateSheetConfig = (updates) => {
    rememberDesign(`sheet:${activeSheetId}`);
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
      rememberDesign();
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
      rememberDesign();
      setProject(emptyProject);
      setActiveSheetId('sheet_1');
      setIsSimulating(false);
    }
  };

  const projectHasWork = (source) => (source?.sheets || []).some(sheet =>
    (sheet.components || []).length > 0 || (sheet.wires || []).length > 0
  );

  const applyLoadedProject = (loaded) => {
    rememberDesign();
    installLibraryHidden(loaded.libraryHidden);
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
        canUndo={historySteps.undo > 0}
        canRedo={historySteps.redo > 0}
        onUndo={handleUndoDesign}
        onRedo={handleRedoDesign}
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
          onRemoveLibrarySymbol={handleRemoveLibrarySymbol}
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
            onDeleteSelection={handleDeleteSelection}
            onMoveComponents={handleMoveComponents}
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
          onDeleteSelection={handleDeleteSelection}
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
          livePiece={
            isSimulating && selectedElement?.type === 'component'
              ? simData?.updatedComponents?.find(item => item.id === selectedElement.id) || null
              : null
          }
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
        symbolDefs={symbolDefs}
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
