import React, { useRef } from 'react';
import { PLAN_THEME_LIST } from '../theme/planThemes';
import {
  MousePointer,
  GitCommit,
  Move,
  Trash2,
  RotateCw,
  Maximize2,
  Download,
  FolderOpen,
  Play,
  Save,
  Square,
  Plus,
  X,
  FileCode2,
  Grid,
  Magnet,
  Layers,
  Sparkles,
  Wrench
} from 'lucide-react';

export default function TopBar({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onCloseSheet,
  activeTool,
  setActiveTool,
  onZoomFit,
  onSaveProject,
  onOpenProject,
  onExportDxf,
  onOpenSymbolEditor,
  isSimulating,
  onToggleSimulation,
  gridEnabled,
  setGridEnabled,
  snapEnabled,
  setSnapEnabled,
  orthoEnabled,
  setOrthoEnabled,
  onLoadPreset,
  planTheme,
  onPlanTheme
}) {
  const openFileRef = useRef(null);

  return (
    <header className="plan-frame flex flex-col bg-autocad-panel border-b border-autocad-border text-xs select-none">
      {/* 1. Main Header with Brand, Presets & Simulation Toggle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-autocad-border">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-3">
          <div className="plan-brand flex items-center gap-2 font-bold tracking-wider text-autocad-cyan uppercase text-sm">
            <span className="p-1 bg-autocad-chip/70 border border-autocad-cyan/40 rounded">⚡</span>
            <span>DRAGNO <span className="text-white">ELECTRIC</span></span>
            <span className="px-1.5 py-0.5 text-[9px] bg-autocad-chip border border-autocad-cyan/50 text-autocad-cyan rounded">
              CONTROLMAX 360 CAD
            </span>
          </div>

          <div className="h-4 w-px bg-autocad-border" />

          <label className="flex items-center gap-1.5 text-autocad-textMuted" title="Estilo del entorno donde se dibujan los planos">
            <span className="text-[10px] uppercase tracking-wide">Tema</span>
            <select
              value={planTheme}
              onChange={(event) => onPlanTheme(event.target.value)}
              className="bg-autocad-inset border border-autocad-border text-autocad-textBright rounded px-2 py-1 text-[11px] focus:outline-none focus:border-autocad-cyan"
            >
              {PLAN_THEME_LIST.map(theme => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </label>

          <div className="h-4 w-px bg-autocad-border" />

          {/* Quick Presets Selector */}
          <div className="flex items-center gap-1.5 text-autocad-textMuted">
            <Layers className="w-3.5 h-3.5 text-autocad-yellow" />
            <select
              className="bg-autocad-bg border border-autocad-border text-autocad-textBright rounded px-2 py-1 text-[11px] focus:outline-none focus:border-autocad-cyan"
              onChange={(e) => {
                if (e.target.value) onLoadPreset(e.target.value);
              }}
              defaultValue="default"
            >
              <option value="default" disabled>Cargar Esquema Ejemplo...</option>
              <option value="proj_motor_starter">Arranque Directo Motor (Marcha-Paro / Enclavamiento)</option>
              <option value="empty">Nuevo Plano Vacío</option>
            </select>
          </div>
        </div>

        {/* Global Action Buttons: save, DXF export and simulation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveProject}
            className="flex items-center gap-1.5 px-3 py-1 bg-autocad-chipLive/70 hover:bg-autocad-chipLive border border-autocad-green/60 text-autocad-green font-medium rounded transition"
            title="Guardar el diseño en un archivo y en este navegador"
          >
            <Save className="w-3.5 h-3.5" />
            <span>GUARDAR</span>
          </button>

          <button
            onClick={() => openFileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1 bg-autocad-panel hover:bg-autocad-chip border border-autocad-border text-autocad-textBright font-medium rounded transition"
            title="Abrir un diseño guardado (.dragno.json)"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>ABRIR</span>
          </button>
          <input
            ref={openFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              event.target.value = '';
              if (file && onOpenProject) onOpenProject(file);
            }}
          />

          {/* Export DXF Button */}
          <button
            onClick={onExportDxf}
            className="flex items-center gap-1.5 px-3 py-1 bg-autocad-chip/60 hover:bg-autocad-chipHover border border-autocad-cyan/50 text-autocad-cyan font-medium rounded transition"
            title="Exportar plano activo a formato AutoCAD DXF R12 / R2000"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORTAR DXF</span>
          </button>

          {/* Symbol Studio / Piece Editor Button */}
          <button
            onClick={onOpenSymbolEditor}
            className="flex items-center gap-1.5 px-3 py-1 bg-autocad-panel hover:bg-autocad-chip border border-autocad-cyan/40 text-autocad-cyan font-medium rounded transition shadow-sm"
            title="Diseñar nuevas piezas o personalizar geometrías y conexiones existentes"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>DISEÑADOR DE PIEZAS</span>
          </button>

          {/* Simulation Toggle Button */}
          <button
            onClick={onToggleSimulation}
            className={`flex items-center gap-2 px-4 py-1 font-bold rounded transition shadow-md ${
              isSimulating
                ? 'bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-400 shadow-glow-red animate-pulse'
                : 'bg-autocad-chipLive/80 hover:bg-autocad-chipLive border border-autocad-green text-autocad-green shadow-glow-green'
            }`}
            title="Evaluar flujo de corriente y sincronización lógica en tiempo real"
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-red-400" />
                <span>DETENER SIMULACIÓN</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-autocad-green" />
                <span>INICIAR SIMULACIÓN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Sheet Tabs Bar & Floating Toolset */}
      <div className="flex items-center justify-between px-2 py-1 bg-autocad-canvas">
        {/* Sheet Tabs (ControlMAX 360 / AutoCAD Layout tabs) */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[60%]">
          {sheets.map((sheet, idx) => {
            const isActive = sheet.id === activeSheetId;
            return (
              <div
                key={sheet.id}
                onClick={() => onSelectSheet(sheet.id)}
                className={`group flex items-center gap-2 px-3 py-1 rounded-t border-t-2 cursor-pointer transition text-[11px] ${
                  isActive
                    ? 'bg-autocad-panel border-autocad-cyan text-autocad-cyan font-semibold shadow-inner'
                    : 'bg-autocad-surface border-transparent text-autocad-textMuted hover:text-white hover:bg-autocad-hover'
                }`}
              >
                <FileCode2 className="w-3 h-3 text-autocad-yellow" />
                <span className="truncate max-w-[150px]">{sheet.title}</span>
                {sheets.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseSheet(sheet.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900/60 hover:text-red-300 rounded"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Sheet Button */}
          <button
            onClick={onAddSheet}
            className="p-1 text-autocad-textMuted hover:text-autocad-cyan hover:bg-autocad-hover rounded ml-1"
            title="Añadir nueva hoja / plano de circuito"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CAD Tools & Toggles (Select, Wire, Pan, Del, Grid, Snap, Ortho) */}
        <div className="flex items-center gap-1.5 bg-autocad-raised px-2 py-0.5 rounded border border-autocad-border">
          {/* Tool: Select */}
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded transition ${
              activeTool === 'select'
                ? 'bg-autocad-cyan text-autocad-onAccent font-bold'
                : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
            }`}
            title="Herramienta Selección / Mover (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* Tool: Wire (Orthogonal) */}
          <button
            onClick={() => setActiveTool('wire')}
            className={`p-1.5 rounded transition ${
              activeTool === 'wire'
                ? 'bg-autocad-cyan text-autocad-onAccent font-bold'
                : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
            }`}
            title="Conectar Cableado Ortogonal (W)"
          >
            <GitCommit className="w-3.5 h-3.5" />
          </button>

          {/* Tool: Pan */}
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded transition ${
              activeTool === 'pan'
                ? 'bg-autocad-cyan text-autocad-onAccent font-bold'
                : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
            }`}
            title="Encuadre / Paneo (H / Botón Central)"
          >
            <Move className="w-3.5 h-3.5" />
          </button>

          {/* Tool: Delete */}
          <button
            onClick={() => setActiveTool('delete')}
            className={`p-1.5 rounded transition ${
              activeTool === 'delete'
                ? 'bg-red-600 text-white font-bold'
                : 'text-autocad-textMuted hover:text-red-400 hover:bg-autocad-panel'
            }`}
            title="Eliminar elemento o cable (Supr)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Tool: Rotate in 90° steps */}
          <button
            onClick={() => setActiveTool('rotate')}
            className={`p-1.5 rounded transition ${
              activeTool === 'rotate'
                ? 'bg-autocad-cyan text-autocad-onAccent font-bold'
                : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
            }`}
            title="Girar pieza 90° (R). Pasos: 90, 180, 270 y 360"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-autocad-border mx-1" />

          {/* Toggle Grid */}
          <button
            onClick={() => setGridEnabled(!gridEnabled)}
            className={`px-1.5 py-1 rounded flex items-center gap-1 transition ${
              gridEnabled
                ? 'bg-autocad-panel text-autocad-cyan border border-autocad-cyan/40'
                : 'text-autocad-textMuted hover:text-white'
            }`}
            title="Alternar Rejilla / Grid (F7)"
          >
            <Grid className="w-3 h-3" />
            <span className="text-[10px]">GRID</span>
          </button>

          {/* Toggle Snap */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-1.5 py-1 rounded flex items-center gap-1 transition ${
              snapEnabled
                ? 'bg-autocad-panel text-autocad-cyan border border-autocad-cyan/40'
                : 'text-autocad-textMuted hover:text-white'
            }`}
            title="Alternar Snap a Malla (F9)"
          >
            <Magnet className="w-3 h-3" />
            <span className="text-[10px]">SNAP</span>
          </button>

          {/* Toggle Ortho */}
          <button
            onClick={() => setOrthoEnabled(!orthoEnabled)}
            className={`px-1.5 py-1 rounded flex items-center gap-1 transition ${
              orthoEnabled
                ? 'bg-autocad-panel text-autocad-yellow border border-autocad-yellow/40'
                : 'text-autocad-textMuted hover:text-white'
            }`}
            title="Alternar Cableado Ortogonal / ORTHO (F8)"
          >
            <span className="text-[10px] font-bold">ORTHO</span>
          </button>
        </div>
      </div>
    </header>
  );
}
