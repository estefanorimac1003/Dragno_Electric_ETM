import React from 'react';
import { X, FileSpreadsheet, CheckCircle2, Zap } from 'lucide-react';
import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { componentName } from '../cad/componentLabel';

export default function DeviceListModal({ isOpen, onClose, sheets, isSimulating, energizedById = {}, symbolDefs = SYMBOL_DEFINITIONS }) {
  if (!isOpen) return null;

  // Flatten all devices across sheets
  const deviceMap = new Map();

  sheets.forEach(sheet => {
    (sheet.components || []).forEach(comp => {
      const def = symbolDefs[comp.type] || SYMBOL_DEFINITIONS[comp.type];
      const tag = comp.tag || comp.type;
      const name = componentName(comp, def).replace(/\n/g, ' ');

      if (!deviceMap.has(tag)) {
        deviceMap.set(tag, {
          tag,
          type: comp.type,
          names: [],
          role: def?.role || 'general',
          count: 0,
          sheets: new Set(),
          energized: !!(comp.energized || energizedById[comp.id])
        });
      }

      const item = deviceMap.get(tag);
      if (name && !item.names.includes(name)) item.names.push(name);
      item.count += 1;
      item.sheets.add(sheet.title);
      if (comp.energized || energizedById[comp.id]) item.energized = true;
    });
  });

  const deviceList = Array.from(deviceMap.values()).sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-autocad-surface border border-autocad-cyan/50 rounded-lg shadow-2xl w-[750px] max-h-[85vh] flex flex-col text-xs text-autocad-textBright">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-autocad-border bg-autocad-panel">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-autocad-yellow" />
            <span className="font-bold text-autocad-cyan uppercase text-sm tracking-wide">
              Listado de Dispositivos y Materiales (BOM)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-autocad-textMuted hover:text-white hover:bg-zinc-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table Content */}
        <div className="p-4 overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse border border-autocad-border">
            <thead>
              <tr className="bg-autocad-panelHeader text-autocad-cyan border-b border-autocad-border text-[11px]">
                <th className="p-2 border-r border-autocad-border">Tag / Identificador</th>
                <th className="p-2 border-r border-autocad-border">Descripción del Dispositivo</th>
                <th className="p-2 border-r border-autocad-border">Cant.</th>
                <th className="p-2 border-r border-autocad-border">Planos Asociados</th>
                <th className="p-2">Estado en Simulación</th>
              </tr>
            </thead>
            <tbody>
              {deviceList.map((dev, idx) => (
                <tr
                  key={dev.tag}
                  className={`border-b border-autocad-border/60 hover:bg-autocad-hover ${
                    idx % 2 === 0 ? 'bg-autocad-raised' : 'bg-autocad-surface'
                  }`}
                >
                  <td className="p-2 border-r border-autocad-border font-mono font-bold text-autocad-yellow">
                    {dev.tag}
                  </td>
                  <td className="p-2 border-r border-autocad-border">{dev.names.join(' · ')}</td>
                  <td className="p-2 border-r border-autocad-border font-mono text-center">{dev.count}</td>
                  <td className="p-2 border-r border-autocad-border text-[10px] text-autocad-textMuted">
                    {Array.from(dev.sheets).join(', ')}
                  </td>
                  <td className="p-2">
                    {isSimulating ? (
                      dev.energized ? (
                        <span className="flex items-center gap-1 text-autocad-green font-semibold text-[10px]">
                          <Zap className="w-3 h-3 fill-autocad-green animate-pulse" />
                          ENERGIZADO / ACTIVO
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[10px]">DESENERGIZADO</span>
                      )
                    ) : (
                      <span className="text-zinc-500 text-[10px]">STANDBY</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-autocad-border bg-autocad-raised">
          <span className="text-autocad-textMuted">
            Total de componentes registrados: <strong className="text-white">{deviceList.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-autocad-cyan text-autocad-onAccent font-bold rounded hover:bg-autocad-accentHot transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
