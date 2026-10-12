import React, { useState } from 'react';
import { Sliders, Settings2, Trash2, Tag, Zap, ToggleLeft, ToggleRight, Layers, Edit3, Wrench } from 'lucide-react';
import { SHEET_SIZES } from '../cad/titleBlock';
import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { isCustomDrawn } from '../cad/symbolStore';
import { normalizeRotation } from '../cad/componentPose';
import { ioOf, userCanOperate } from '../cad/ioKind';

export default function RightSidebar({
  selectedElement,
  onUpdateComponent,
  onDeleteComponent,
  sheet,
  onUpdateSheetConfig,
  gridEnabled,
  setGridEnabled,
  snapEnabled,
  setSnapEnabled,
  orthoEnabled,
  setOrthoEnabled,
  symbolDefs = SYMBOL_DEFINITIONS,
  onOpenSymbolEditor
}) {
  const [activeTab, setActiveTab] = useState('element'); // 'element' | 'canvas'

  const compData = selectedElement?.type === 'component' ? selectedElement.data : null;
  const compDef = compData ? (symbolDefs[compData.type] || SYMBOL_DEFINITIONS[compData.type]) : null;

  return (
    <aside className="plan-frame w-64 h-full bg-autocad-panel border-l border-autocad-border flex flex-col text-xs select-none">
      {/* Tab Switcher */}
      <div className="flex border-b border-autocad-border bg-autocad-raised">
        <button
          onClick={() => setActiveTab('element')}
          className={`flex-1 py-2 text-center font-semibold text-[11px] transition ${
            activeTab === 'element'
              ? 'text-autocad-cyan border-b-2 border-autocad-cyan bg-autocad-surface'
              : 'text-autocad-textMuted hover:text-white'
          }`}
        >
          Propiedades
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex-1 py-2 text-center font-semibold text-[11px] transition ${
            activeTab === 'canvas'
              ? 'text-autocad-cyan border-b-2 border-autocad-cyan bg-autocad-surface'
              : 'text-autocad-textMuted hover:text-white'
          }`}
        >
          Atributos de Lienzo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TAB 1: ELEMENT PROPERTIES */}
        {activeTab === 'element' && (
          <div>
            {compData && compDef ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-autocad-border pb-2">
                  <span className="font-bold text-autocad-yellow uppercase">{compDef.name}</span>
                  <button
                    onClick={() => onDeleteComponent(compData.id)}
                    className="p-1 text-autocad-textMuted hover:text-red-400 hover:bg-red-950/50 rounded"
                    title="Eliminar elemento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Button to open piece editor */}
                <button
                  onClick={() => onOpenSymbolEditor && onOpenSymbolEditor(compData.type)}
                  className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-autocad-chip/60 hover:bg-autocad-chipHover border border-autocad-cyan/50 text-autocad-cyan font-bold rounded text-[10px] transition"
                  title="Modificar dibujo vectorial y bornes de conexión de este símbolo"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Modificar Diseño / Bornes</span>
                </button>

                {/* Tag / Device Identifier (Supports live synchronization!) */}
                <div>
                  <label className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                    Nombre / Identificador (Tag):
                  </label>
                  <input
                    type="text"
                    value={compData.tag || ''}
                    onChange={(e) => onUpdateComponent(compData.id, { tag: e.target.value.toUpperCase() })}
                    className="w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-cyan font-mono font-bold focus:outline-none focus:border-autocad-cyan"
                    placeholder="Ej: KM1, SB1, QM1"
                  />
                  <p className="text-[9px] text-autocad-textMuted mt-1">
                    * Cada pieza nueva recibe un tag libre. Si dos piezas quedan con el mismo nombre, accionar una acciona todas.
                  </p>
                </div>

                {/* Component Type & Category */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-autocad-textMuted block">Tipo:</span>
                    <span className="font-mono text-autocad-textBright">{compData.type}</span>
                  </div>
                  <div>
                    <span className="text-autocad-textMuted block">Rol:</span>
                    <span className="font-mono text-autocad-green uppercase">{compDef.role}</span>
                  </div>
                </div>

                {/* Coordinates (X, Y) */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-autocad-textMuted block">Posición X:</span>
                    <span className="font-mono text-autocad-yellow">{compData.x} px</span>
                  </div>
                  <div>
                    <span className="text-autocad-textMuted block">Posición Y:</span>
                    <span className="font-mono text-autocad-yellow">{compData.y} px</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                    Giro: {normalizeRotation(compData.rotation) || 360}°
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {[90, 180, 270, 360].map(angle => {
                      const stored = normalizeRotation(compData.rotation);
                      const active = angle === 360 ? stored === 0 : stored === angle;
                      return (
                        <button
                          key={angle}
                          type="button"
                          onClick={() => onUpdateComponent(compData.id, { rotation: angle === 360 ? 0 : angle })}
                          className={`py-1 rounded border font-mono text-[10px] ${
                            active
                              ? 'bg-autocad-cyan text-autocad-onAccent border-autocad-cyan'
                              : 'bg-autocad-inset border-autocad-border text-autocad-textBright hover:border-autocad-cyan'
                          }`}
                        >
                          {angle}°
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-autocad-border/60 rounded p-2 bg-autocad-raised">
                  <span className="block text-[10px] font-semibold text-autocad-textBright mb-1">Dirección</span>
                  <span className="font-mono text-[11px] text-autocad-yellow">
                    {ioOf(compDef) === 'in' ? 'IN — entrada' : ioOf(compDef) === 'inout' ? 'IN-OUT' : 'OUT — salida'}
                  </span>
                  <p className="mt-1 text-[10px] leading-snug text-autocad-textMuted">
                    {userCanOperate(compDef)
                      ? 'Puedes accionarla con el clic durante la simulación.'
                      : 'Solo el circuito puede activarla. El clic no la fuerza.'}
                  </p>
                </div>

                {/* State Toggles (Breaker state, Button state) */}
                {userCanOperate(compDef) && isCustomDrawn(compDef) && (
                  <div className="border border-autocad-border/60 rounded p-2 bg-autocad-raised">
                    <span className="block text-[10px] font-semibold text-autocad-textBright mb-1.5">
                      Sprite:
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-autocad-textMuted">
                        {compData.state?.on ? 'ACCIONADO' : 'REPOSO'}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateComponent(compData.id, {
                            state: { ...compData.state, on: !compData.state?.on }
                          })
                        }
                        className="px-2 py-1 bg-autocad-panel border border-autocad-border rounded text-[10px] text-autocad-cyan hover:border-autocad-cyan"
                      >
                        Alternar
                      </button>
                    </div>
                  </div>
                )}
                {userCanOperate(compDef) && !isCustomDrawn(compDef) && compDef.role === 'switch' && (
                  <div className="border border-autocad-border/60 rounded p-2 bg-autocad-raised">
                    <span className="block text-[10px] font-semibold text-autocad-textBright mb-1.5">
                      Estado del Contacto:
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-autocad-textMuted">
                        {compData.state?.closed ? 'CERRADO (Conduce)' : 'ABIERTO (Aislado)'}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateComponent(compData.id, {
                            state: { ...compData.state, closed: !compData.state?.closed }
                          })
                        }
                        className="px-2 py-1 bg-autocad-panel border border-autocad-border rounded text-[10px] text-autocad-cyan hover:border-autocad-cyan"
                      >
                        Alternar
                      </button>
                    </div>
                  </div>
                )}

                {/* Connected Pins list */}
                <div>
                  <span className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                    Terminales / Bornes:
                  </span>
                  <div className="space-y-1">
                    {compDef.pins?.map(pin => (
                      <div
                        key={pin.id}
                        className="flex items-center justify-between px-2 py-1 bg-autocad-inset border border-autocad-border/40 rounded text-[10px]"
                      >
                        <span className="font-mono text-autocad-yellow">Pin {pin.label || pin.id}</span>
                        <span className="text-autocad-textMuted font-mono">({pin.x}, {pin.y})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedElement?.type === 'wire' ? (
              <div className="space-y-3">
                <div className="border-b border-autocad-border pb-2">
                  <span className="font-bold text-autocad-cyan uppercase">Cable Eléctrico</span>
                </div>
                <div className="text-[11px] text-autocad-textMuted">
                  ID: <span className="font-mono text-autocad-textBright">{selectedElement.id}</span>
                </div>
                <div>
                  <label className="block text-[10px] text-autocad-textMuted mb-1">Color del Cable:</label>
                  <select
                    className="w-full bg-autocad-inset border border-autocad-border rounded p-1 text-xs text-autocad-textBright"
                    value={selectedElement.data?.color || '#00e5ff'}
                    onChange={(e) => {
                      // Handled by parent wire update
                    }}
                  >
                    <option value="#00e5ff">Cian (Mando AC/DC)</option>
                    <option value="#ff3d00">Rojo (Fase L / +24V)</option>
                    <option value="#ffd600">Amarillo (Fase L2 / Señal)</option>
                    <option value="#2979ff">Azul (Fase L3 / Neutro)</option>
                    <option value="#76ff03">Verde-Amarillo (Tierra PE)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-autocad-textMuted">
                <Settings2 className="w-6 h-6 mx-auto mb-2 opacity-40 text-autocad-cyan" />
                <p>Selecciona un elemento en el lienzo para inspeccionar sus atributos.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CANVAS & TITLE BLOCK ATTRIBUTES (ControlMAX 360 Style) */}
        {activeTab === 'canvas' && (
          <div className="space-y-3">
            <span className="font-bold text-autocad-cyan uppercase block border-b border-autocad-border pb-1">
              Atributos de Lienzo
            </span>

            {/* Template format selector */}
            <div>
              <label className="block text-[10px] text-autocad-textMuted mb-1">Formato de Plantilla:</label>
              <select
                value={sheet.sizeKey || 'A4_HORIZONTAL'}
                onChange={(e) => onUpdateSheetConfig({ sizeKey: e.target.value })}
                className="w-full bg-autocad-inset border border-autocad-border rounded p-1.5 text-xs text-autocad-textBright focus:border-autocad-cyan focus:outline-none"
              >
                {Object.entries(SHEET_SIZES).map(([key, val]) => (
                  <option key={key} value={key}>{val.name}</option>
                ))}
              </select>
            </div>

            {/* Sheet Title */}
            <div>
              <label className="block text-[10px] text-autocad-textMuted mb-1">Título del Plano:</label>
              <input
                type="text"
                value={sheet.title || ''}
                onChange={(e) => onUpdateSheetConfig({ title: e.target.value })}
                className="w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-textBright focus:border-autocad-cyan focus:outline-none"
              />
            </div>

            {/* Canvas Toggles */}
            <div className="space-y-2 border-t border-autocad-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-autocad-textBright">Cuadrícula (Grid)</span>
                <input
                  type="checkbox"
                  checked={gridEnabled}
                  onChange={(e) => setGridEnabled(e.target.checked)}
                  className="accent-autocad-cyan"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-autocad-textBright">Snap a Malla</span>
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={(e) => setSnapEnabled(e.target.checked)}
                  className="accent-autocad-cyan"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-autocad-textBright">Trazado Ortogonal (ORTHO)</span>
                <input
                  type="checkbox"
                  checked={orthoEnabled}
                  onChange={(e) => setOrthoEnabled(e.target.checked)}
                  className="accent-autocad-cyan"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
