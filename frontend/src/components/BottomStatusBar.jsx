import React, { useState } from 'react';
import { Terminal, Zap, ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';

export default function BottomStatusBar({
  cursorPos = { x: 0, y: 0 },
  gridEnabled,
  snapEnabled,
  orthoEnabled,
  isSimulating,
  simLogs = [],
  onOpenBomModal
}) {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <footer className="plan-frame flex flex-col bg-autocad-panel border-t border-autocad-border text-[11px] font-mono select-none">
      {/* Expandable CAD & Simulation Terminal Console */}
      {consoleOpen && (
        <div className="h-32 bg-autocad-inset border-b border-autocad-border p-2 overflow-y-auto text-[10px] space-y-1">
          <div className="flex items-center justify-between text-autocad-textMuted border-b border-autocad-border/40 pb-1 mb-1">
            <span className="font-bold text-autocad-cyan flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              CONSOLA DE EVENTOS Y SIMULACIÓN CAD
            </span>
            <span>AutoCAD Command Line Mode</span>
          </div>

          {simLogs.length === 0 ? (
            <div className="text-autocad-textMuted italic">
              Sistema en espera. Inicia la simulación para inspeccionar eventos en tiempo real.
            </div>
          ) : (
            simLogs.map((log, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-autocad-textMuted">&gt;</span>
                <span className={log.includes('energizada') || log.includes('marcha') ? 'text-autocad-green' : 'text-autocad-cyan'}>
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-autocad-bg">
        {/* Left: Modes & Console Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="flex items-center gap-1 text-autocad-textBright hover:text-autocad-cyan px-1.5 py-0.5 rounded bg-autocad-panel border border-autocad-border"
          >
            <Terminal className="w-3 h-3 text-autocad-yellow" />
            <span>Línea de Comandos</span>
            {consoleOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          <button
            onClick={onOpenBomModal}
            className="flex items-center gap-1 text-autocad-textBright hover:text-autocad-cyan px-1.5 py-0.5 rounded bg-autocad-panel border border-autocad-border"
          >
            <ListOrdered className="w-3 h-3 text-autocad-cyan" />
            <span>Listado de Materiales (BOM)</span>
          </button>
        </div>

        {/* Center: Live Coordinates */}
        <div className="flex items-center gap-4 text-autocad-textBright font-semibold">
          <span>X: <span className="text-autocad-cyan">{Number(cursorPos.x || 0).toFixed(2)}</span></span>
          <span>Y: <span className="text-autocad-cyan">{Number(cursorPos.y || 0).toFixed(2)}</span></span>
          <span className="text-autocad-textMuted">Z: 0.00</span>
        </div>

        {/* Right: CAD Status Indicators */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`px-1.5 py-0.5 rounded border ${gridEnabled ? 'bg-autocad-chip border-autocad-cyan text-autocad-cyan' : 'text-autocad-textMuted border-transparent'}`}>
            GRID
          </span>
          <span className={`px-1.5 py-0.5 rounded border ${snapEnabled ? 'bg-autocad-chip border-autocad-cyan text-autocad-cyan' : 'text-autocad-textMuted border-transparent'}`}>
            SNAP
          </span>
          <span className={`px-1.5 py-0.5 rounded border ${orthoEnabled ? 'bg-autocad-chipGold border-autocad-yellow text-autocad-yellow' : 'text-autocad-textMuted border-transparent'}`}>
            ORTHO
          </span>
          <span className="h-3 w-px bg-autocad-border" />
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
            isSimulating
              ? 'bg-autocad-chipLive border border-autocad-green text-autocad-green'
              : 'bg-zinc-900 text-zinc-500'
          }`}>
            <Zap className={`w-2.5 h-2.5 ${isSimulating ? 'text-autocad-green fill-autocad-green animate-pulse' : ''}`} />
            {isSimulating ? 'SIMULACIÓN ACTIVA' : 'STANDBY'}
          </span>
        </div>
      </div>
    </footer>
  );
}
