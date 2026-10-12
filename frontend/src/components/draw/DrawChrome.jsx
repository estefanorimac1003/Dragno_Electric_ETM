import {
  Circle,
  CircleDot,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Hand,
  Link2,
  Lock,
  Maximize2,
  Minus,
  MousePointer,
  Move,
  PenTool,
  Plus,
  Redo2,
  RotateCw,
  Spline,
  Square,
  Trash2,
  Type,
  Undo2,
  LockOpen,
  Waypoints
} from 'lucide-react';

const TOOLS = [
  ['select', 'Selección (V)', MousePointer],
  ['nodes', 'Nodos (N)', Spline],
  ['move', 'Mover (M)', Move],
  ['rotate', 'Rotar (Q)', RotateCw],
  ['scale', 'Escalar (K)', Maximize2],
  ['mirror', 'Reflejar (X)', FlipHorizontal2],
  ['pan', 'Encuadrar (H)', Hand],
  ['line', 'Polilínea (L)', Minus],
  ['rect', 'Rectángulo (R)', Square],
  ['circle', 'Círculo (C)', Circle],
  ['ellipse', 'Elipse (E)', CircleDot],
  ['arc', 'Arco (A)', Waypoints],
  ['bezier', 'Pluma Bézier (P)', PenTool],
  ['text', 'Texto (T)', Type],
  ['pin', 'Borne (B)', CircleDot]
];

const COLORS = ['#00e5ff', '#ffd600', '#00e676', '#ff3d00', '#2979ff', '#ffffff'];
const FILLS = [
  ['none', 'Sin relleno'],
  ['#141822', 'Gris CAD'],
  ['#0a1926', 'Azul oscuro'],
  ['#00e5ff', 'Cian'],
  ['#ffd600', 'Amarillo']
];

function ToolButton({ active, title, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-11 h-9 rounded flex items-center justify-center transition ${
        active
          ? 'bg-autocad-cyan text-autocad-onAccent'
          : 'text-autocad-textMuted hover:text-white hover:bg-autocad-hover disabled:opacity-30'
      }`}
    >
      {children}
    </button>
  );
}

export function DrawToolbox({ tool, onTool, onDelete, onWeld, canEdit }) {
  return (
    <div className="w-14 bg-autocad-bg border-r border-autocad-border flex flex-col items-center py-2 gap-1 overflow-y-auto">
      {TOOLS.map(([id, title, Icon]) => (
        <ToolButton key={id} active={tool === id} title={title} onClick={() => onTool(id)}>
          <Icon className="w-4 h-4" />
        </ToolButton>
      ))}
      <ToolButton title="Soldar polilíneas que se tocan" onClick={onWeld} disabled={!canEdit}>
        <Link2 className="w-4 h-4" />
      </ToolButton>
      <ToolButton title="Eliminar selección (Supr)" onClick={onDelete} disabled={!canEdit}>
        <Trash2 className="w-4 h-4 text-red-400" />
      </ToolButton>
    </div>
  );
}

export function DrawProperties({
  gridSnap,
  objectSnap,
  gridSize,
  gridSteps,
  onToggleGrid,
  onToggleObjectSnap,
  onGridSize,
  zoom,
  onZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  layers,
  activeLayerId,
  onActiveLayer,
  selected,
  onPatch,
  lineDash,
  onLineDash,
  orthoLock,
  onToggleOrtho
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-autocad-raised border-b border-autocad-border flex-wrap">
      <button type="button" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} className="p-1 rounded border border-autocad-border disabled:opacity-30">
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={onRedo} className="p-1 rounded border border-autocad-border disabled:opacity-30">
        <Redo2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleGrid}
        className={`px-2 py-1 rounded border font-bold ${gridSnap ? 'bg-autocad-chip border-autocad-cyan text-autocad-cyan' : 'border-autocad-border text-autocad-textMuted'}`}
        title="Freno de malla (F9). Las piezas, los nodos y el dibujo nuevo caen en la malla."
      >
        MALLA {gridSnap ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        onClick={onToggleObjectSnap}
        className={`px-2 py-1 rounded border font-bold ${objectSnap ? 'bg-autocad-chipGold border-autocad-yellow text-autocad-yellow' : 'border-autocad-border text-autocad-textMuted'}`}
        title="Referencias: punto final, medio, centro, intersección y perpendicular (F3)"
      >
        OSNAP {objectSnap ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        onClick={onToggleOrtho}
        className={`px-2 py-1 rounded border font-bold ${orthoLock ? 'bg-autocad-chip border-autocad-cyan text-autocad-cyan' : 'border-autocad-border text-autocad-textMuted'}`}
        title="ORTO (F8). Desde el nodo de referencia, el tramo queda completamente horizontal o completamente vertical. El eje lo marca hacia dónde mueves el cursor."
      >
        ORTO {orthoLock ? 'ON' : 'OFF'}
      </button>
      <label className="flex items-center gap-1 text-[10px] text-autocad-textMuted">
        Trazo
        <select
          value={lineDash || 'solid'}
          onChange={(event) => onLineDash(event.target.value)}
          className="bg-autocad-surface border border-autocad-border rounded px-1 py-0.5 text-white"
          title="Continuo, punteado o a trazos. Se aplica a la línea nueva y a la selección."
        >
          <option value="solid">Continuo</option>
          <option value="dot">Punteado</option>
          <option value="dash">Trazos</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-[10px] text-autocad-textMuted">
        Paso
        <select value={gridSize} onChange={(event) => onGridSize(Number(event.target.value))} className="bg-autocad-surface border border-autocad-border rounded px-1 py-0.5 text-white">
          {gridSteps.map(step => <option key={step} value={step}>{step}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[10px] text-autocad-textMuted">
        Capa
        <select value={activeLayerId} onChange={(event) => onActiveLayer(event.target.value)} className="bg-autocad-surface border border-autocad-border rounded px-1 py-0.5 text-white max-w-[120px]">
          {layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
        </select>
      </label>
      <div className="flex gap-1">
        {COLORS.map(color => (
          <button
            key={color}
            type="button"
            title="Color de trazo"
            disabled={!selected}
            onClick={() => onPatch({ stroke: color })}
            className={`w-4 h-4 rounded border ${selected?.stroke === color ? 'border-white' : 'border-transparent'} disabled:opacity-30`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <label className="flex items-center gap-1 text-[10px] text-autocad-textMuted">
        Grosor
        <input
          type="number"
          min="0.5"
          max="8"
          step="0.5"
          disabled={!selected}
          value={selected?.strokeWidth || 2}
          onChange={(event) => onPatch({ strokeWidth: Number(event.target.value) })}
          className="w-14 bg-autocad-surface border border-autocad-border rounded px-1 py-0.5 font-mono text-white disabled:opacity-40"
        />
      </label>
      <select
        disabled={!selected}
        value={selected?.fill || 'none'}
        onChange={(event) => onPatch({ fill: event.target.value })}
        className="bg-autocad-surface border border-autocad-border rounded px-1 py-0.5 text-[10px] text-white disabled:opacity-40"
      >
        {FILLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div className="ml-auto flex items-center gap-1 text-[10px]">
        <button type="button" onClick={() => onZoom(-1)} className="px-1.5 py-0.5 bg-autocad-surface border border-autocad-border rounded">-</button>
        <span className="font-mono w-10 text-center">{zoom.toFixed(1)}x</span>
        <button type="button" onClick={() => onZoom(1)} className="px-1.5 py-0.5 bg-autocad-surface border border-autocad-border rounded">+</button>
      </div>
    </div>
  );
}

export function DrawLayers({ layers, activeLayerId, onChange, onActive }) {
  return (
    <div className="space-y-2 border-b border-autocad-border pb-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-autocad-cyan uppercase text-[11px]">Capas</span>
        <button
          type="button"
          title="Nueva capa"
          onClick={() => {
            const id = `capa_${Date.now().toString(36)}`;
            onChange([...layers, { id, name: `Capa ${layers.length + 1}`, visible: true, locked: false }]);
            onActive(id);
          }}
          className="p-1 text-autocad-textMuted hover:text-white"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto">
        {layers.map(layer => (
          <div
            key={layer.id}
            className={`flex items-center gap-1 px-1 py-1 rounded border ${
              activeLayerId === layer.id ? 'border-autocad-cyan bg-autocad-chip/30' : 'border-autocad-border/60'
            }`}
          >
            <button type="button" title={layer.visible ? 'Ocultar' : 'Mostrar'} onClick={() => onChange(layers.map(item => item.id === layer.id ? { ...item, visible: !item.visible } : item))}>
              {layer.visible ? <Eye className="w-3.5 h-3.5 text-autocad-cyan" /> : <EyeOff className="w-3.5 h-3.5 text-autocad-textMuted" />}
            </button>
            <button type="button" title={layer.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => onChange(layers.map(item => item.id === layer.id ? { ...item, locked: !item.locked } : item))}>
              {layer.locked ? <Lock className="w-3.5 h-3.5 text-autocad-yellow" /> : <LockOpen className="w-3.5 h-3.5 text-autocad-textMuted" />}
            </button>
            <input
              value={layer.name}
              onFocus={() => onActive(layer.id)}
              onChange={(event) => onChange(layers.map(item => item.id === layer.id ? { ...item, name: event.target.value } : item))}
              className="flex-1 min-w-0 bg-transparent text-[10px] text-white outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
