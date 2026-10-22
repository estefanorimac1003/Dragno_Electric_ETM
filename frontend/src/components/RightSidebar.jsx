import React, { useState } from 'react';
import { Sliders, Settings2, Trash2, Tag, Zap, ToggleLeft, ToggleRight, Layers, Edit3, Wrench, RotateCw, RotateCcw } from 'lucide-react';
import { SHEET_SIZES } from '../cad/titleBlock';
import { SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import { isCustomDrawn } from '../cad/symbolStore';
import { normalizeRotation } from '../cad/componentPose';
import { nameIsPlaced, nameStyleOf, tagIsPlaced, textTurn } from '../cad/componentLabel';
import { ioOf, userCanOperate } from '../cad/ioKind';
import { motorSpinOf, motorTurnOf } from '../cad/motorTurn';

function TextTurn({ value, onChange }) {
  const stored = textTurn(value);
  return (
    <div className="mt-1">
      <span className="block text-[10px] text-autocad-textMuted mb-1">
        Giro del texto: {stored || 360}°
      </span>
      <div className="grid grid-cols-4 gap-1">
        {[90, 180, 270, 360].map(angle => {
          const active = angle === 360 ? stored === 0 : stored === angle;
          return (
            <button
              key={angle}
              type="button"
              onClick={() => onChange(angle === 360 ? 0 : angle)}
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
      <p className="text-[9px] text-autocad-textMuted mt-1">
        Gira solo este texto. La pieza queda en su sitio.
      </p>
    </div>
  );
}

function NameStyleBar({ comp, onChange }) {
  const style = nameStyleOf(comp);
  const setStyle = (patch) => onChange({ ...style, ...patch });
  const alignButton = (align, label) => (
    <button
      key={align}
      type="button"
      onClick={() => setStyle({ align })}
      className={`px-1 py-1 rounded border text-[10px] ${
        style.align === align
          ? 'bg-autocad-cyan text-autocad-onAccent border-autocad-cyan'
          : 'bg-autocad-inset border-autocad-border text-autocad-textBright hover:border-autocad-cyan'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-1 space-y-1">
      <div className="grid grid-cols-3 gap-1">
        {alignButton('left', 'Izquierda')}
        {alignButton('center', 'Centrar')}
        {alignButton('right', 'Derecha')}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setStyle({ bold: !style.bold })}
          className={`flex-1 py-1 rounded border text-[10px] font-bold ${
            style.bold
              ? 'bg-autocad-cyan text-autocad-onAccent border-autocad-cyan'
              : 'bg-autocad-inset border-autocad-border text-autocad-textBright hover:border-autocad-cyan'
          }`}
        >
          Negrita
        </button>
        <label className="flex items-center gap-1 text-[10px] text-autocad-textMuted">
          Tamaño
          <input
            type="number"
            min={8}
            max={36}
            value={Number.isFinite(Number(comp.nameStyle?.size)) ? comp.nameStyle.size : style.size}
            onChange={(event) => {
              const size = Number(event.target.value);
              if (!Number.isFinite(size)) return;
              setStyle({ size });
            }}
            onBlur={() => {
              const stored = Number(comp.nameStyle?.size);
              if (!Number.isFinite(stored)) return;
              const clamped = nameStyleOf(comp).size;
              if (stored !== clamped) setStyle({ size: clamped });
            }}
            className="w-12 bg-autocad-inset border border-autocad-border rounded px-1 py-1 text-xs text-autocad-yellow focus:outline-none focus:border-autocad-cyan"
          />
        </label>
      </div>
    </div>
  );
}

export default function RightSidebar({
  selectedElement,
  onUpdateComponent,
  onDeleteComponent,
  onDeleteSelection,
  sheet,
  onUpdateSheetConfig,
  gridEnabled,
  setGridEnabled,
  snapEnabled,
  setSnapEnabled,
  orthoEnabled,
  setOrthoEnabled,
  symbolDefs = SYMBOL_DEFINITIONS,
  onOpenSymbolEditor,
  livePiece = null
}) {
  const [activeTab, setActiveTab] = useState('element'); // 'element' | 'canvas'

  const compData = selectedElement?.type === 'component' ? selectedElement.data : null;
  const compDef = compData ? (symbolDefs[compData.type] || SYMBOL_DEFINITIONS[compData.type]) : null;
  const groupItems = selectedElement?.type === 'group' ? (selectedElement.items || []) : [];
  const groupPieceCount = groupItems.filter(item => item.type === 'component').length;
  const groupCableCount = groupItems.filter(item => item.type === 'wire').length;

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

                {/* Tag stays the electrical identifier. The name is the text under it. */}
                <div>
                  <label className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                    Tag
                  </label>
                  <input
                    type="text"
                    value={compData.tag || ''}
                    onChange={(e) => onUpdateComponent(compData.id, { tag: e.target.value.toUpperCase() })}
                    className="w-full bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-cyan font-mono font-bold focus:outline-none focus:border-autocad-cyan"
                    placeholder="Ej: -K1, SB1, QM1"
                  />
                  <TextTurn
                    value={compData.tagRotation}
                    onChange={(tagRotation) => onUpdateComponent(compData.id, { tagRotation })}
                  />
                  <p className="text-[9px] text-autocad-textMuted mt-1">
                    Sale a la izquierda de la pieza. Arrástralo en el plano sin mover el nombre.
                    {tagIsPlaced(compData) ? ' Ahora está colocado a mano.' : ' Ahora está a la izquierda.'}
                  </p>
                  {compDef.role === 'terminal' && (
                    <p className="text-[9px] text-autocad-textMuted mt-1">
                      El mismo tag une este borne con los demás, en esta hoja y en las otras. Si uno recibe tensión, los otros del mismo tag se encienden. Cada número de pin es una conexión distinta.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                    Nombre
                  </label>
                  <textarea
                    rows={3}
                    value={typeof compData.name === 'string' ? compData.name : (compDef.name || '')}
                    onChange={(e) => onUpdateComponent(compData.id, { name: e.target.value })}
                    className="w-full resize-y bg-autocad-inset border border-autocad-border rounded px-2 py-1 text-xs text-autocad-textBright focus:outline-none focus:border-autocad-cyan"
                    placeholder={compDef.name || 'Nombre de la lista'}
                  />
                  <NameStyleBar
                    comp={compData}
                    onChange={(nameStyle) => onUpdateComponent(compData.id, { nameStyle })}
                  />
                  <TextTurn
                    value={compData.nameRotation}
                    onChange={(nameRotation) => onUpdateComponent(compData.id, { nameRotation })}
                  />
                  <p className="text-[9px] text-autocad-textMuted mt-1">
                    Enter parte el nombre en otra línea para que ocupe menos ancho. Empieza con el nombre de la lista y puedes escribir el código. Arrástralo por su cuenta.
                    {nameIsPlaced(compData) ? ' Ahora está colocado a mano.' : ' Ahora está a la izquierda.'}
                    {' '}Si lo borras, vuelve el nombre de la lista.
                  </p>
                  {typeof compData.name === 'string' && (
                    <button
                      type="button"
                      onClick={() => onUpdateComponent(compData.id, { name: null })}
                      className="mt-1 w-full py-1 bg-autocad-inset border border-autocad-border rounded text-[10px] text-autocad-textBright hover:border-autocad-cyan"
                    >
                      Nombre de la lista
                    </button>
                  )}
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

                {compDef.role === 'motor' && (
                  <div>
                    <span className="block text-[10px] text-autocad-textMuted mb-1 font-semibold uppercase">
                      Sentido de giro
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        ['cw', 'Horario', RotateCw],
                        ['ccw', 'Antihorario', RotateCcw]
                      ].map(([turn, label, Icon]) => {
                        const active = motorTurnOf(compData) === turn;
                        return (
                          <button
                            key={turn}
                            type="button"
                            title={label}
                            onClick={() => onUpdateComponent(compData.id, { turn })}
                            className={`py-1 rounded border text-[10px] ${
                              active
                                ? 'bg-autocad-cyan text-autocad-onAccent border-autocad-cyan'
                                : 'bg-autocad-inset border-autocad-border text-autocad-textBright hover:border-autocad-cyan'
                            }`}
                          >
                            <Icon className="w-5 h-5 mx-auto" />
                            <span className="block leading-none mt-0.5">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[9px] leading-snug text-autocad-textMuted">
                      Este sentido es la secuencia directa: L1 en U1, L2 en V1 y L3 en W1.
                      Cruzar dos fases invierte el giro. Hacen falta las tres fases para arrancar.
                    </p>
                    {livePiece?.energized && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] leading-snug text-autocad-cyan">
                        {motorSpinOf(livePiece) === 'ccw'
                          ? <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          : <RotateCw className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          En marcha, giro {motorSpinOf(livePiece) === 'ccw' ? 'antihorario' : 'horario'}
                          {livePiece.sequence === 'reverse' ? ', secuencia inversa.' : '.'}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {compDef.role !== 'source' && compDef.role !== 'terminal' && (
                  <div className="border border-autocad-border/60 rounded p-2 bg-autocad-raised">
                    <span className="block text-[10px] font-semibold text-autocad-textBright mb-1">Dirección</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        ['in', 'IN'],
                        ['out', 'OUT'],
                        ['inout', 'IN-OUT']
                      ].map(([io, label]) => {
                        const active = ioOf(compDef, compData) === io;
                        return (
                          <button
                            key={io}
                            type="button"
                            onClick={() => onUpdateComponent(compData.id, { io })}
                            className={`py-1 rounded border text-[10px] font-bold ${
                              active
                                ? 'bg-autocad-cyan text-autocad-onAccent border-autocad-cyan'
                                : 'bg-autocad-inset border-autocad-border text-autocad-textBright hover:border-autocad-cyan'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-autocad-textMuted">
                      {ioOf(compDef, compData) === 'out'
                        ? 'OUT: solo el circuito la activa. El mouse no la fuerza.'
                        : ioOf(compDef, compData) === 'inout'
                          ? 'IN-OUT: el circuito la activa y el mouse también puede forzarla.'
                          : 'IN: durante la simulación el mouse la activa.'}
                    </p>
                  </div>
                )}

                {/* State Toggles (Breaker state, Button state) */}
                {userCanOperate(compDef, compData) && isCustomDrawn(compDef) && (
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
                {userCanOperate(compDef, compData) && !isCustomDrawn(compDef) && compDef.role === 'switch' && (
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
            ) : selectedElement?.type === 'group' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-autocad-border pb-2">
                  <span className="font-bold text-autocad-yellow uppercase">Selección</span>
                  <button
                    onClick={() => onDeleteSelection?.(groupItems)}
                    className="p-1 text-autocad-textMuted hover:text-red-400 hover:bg-red-950/50 rounded"
                    title="Eliminar selección"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-autocad-textBright leading-5">
                  {groupPieceCount === 1 ? '1 pieza' : `${groupPieceCount} piezas`}
                  {' y '}
                  {groupCableCount === 1 ? '1 cable' : `${groupCableCount} cables`}
                </p>
                <p className="text-[10px] text-autocad-textMuted">
                  Arrastra una pieza o un cable marcado. El grupo se mueve junto.
                </p>
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
