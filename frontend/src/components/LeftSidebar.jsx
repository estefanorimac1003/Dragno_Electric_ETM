import React, { useState } from 'react';
import {
  FolderTree,
  Cpu,
  Boxes,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Wrench,
  Edit3,
  Plus
} from 'lucide-react';
import { CATEGORIES, SYMBOL_DEFINITIONS } from '../cad/symbolCatalog';
import SymbolThumb from './SymbolThumb';

export default function LeftSidebar({
  sheets,
  activeSheetId,
  onSelectSheet,
  onStartPlaceSymbol,
  activePlacingSymbol,
  allComponents,
  energizedById = {},
  isSimulating,
  symbolDefs = SYMBOL_DEFINITIONS,
  onOpenSymbolEditor,
  onCreateSymbol
}) {
  const [activeTab, setActiveTab] = useState('symbols'); // 'tree' | 'symbols' | 'devices'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({
    'Lo más usado': true,
    'Potenciales y Señales': true,
    'Protección Eléctrica': true,
    'Mandos y Actuadores': true,
    'Cargas y Motores': true,
  });

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group devices by unique Tag across the entire project
  const tagsMap = new Map();
  allComponents.forEach(comp => {
    const tag = comp.tag || 'SIN_TAG';
    if (!tagsMap.has(tag)) {
      tagsMap.set(tag, []);
    }
    tagsMap.get(tag).push(comp);
  });

  return (
    <aside className="plan-frame flex h-full bg-autocad-panel border-r border-autocad-border text-xs select-none">
      {/* 1. Slim Vertical Navigation Rail (ControlMAX 360 Style) */}
      <div className="w-12 flex flex-col items-center py-2 bg-autocad-bg border-r border-autocad-border gap-2">
        {/* Tab: Símbolos */}
        <button
          onClick={() => setActiveTab('symbols')}
          className={`flex flex-col items-center justify-center w-10 h-10 rounded transition ${
            activeTab === 'symbols'
              ? 'bg-autocad-cyan text-autocad-onAccent font-bold shadow-glow-cyan'
              : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
          }`}
          title="Biblioteca de Símbolos Eléctricos"
        >
          <Boxes className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 scale-90">Símbolos</span>
        </button>

        {/* Tab: Árbol de Proyecto */}
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex flex-col items-center justify-center w-10 h-10 rounded transition ${
            activeTab === 'tree'
              ? 'bg-autocad-cyan text-autocad-onAccent font-bold shadow-glow-cyan'
              : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
          }`}
          title="Navegador de Planos y Árbol de Proyecto"
        >
          <FolderTree className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 scale-90">Planos</span>
        </button>

        {/* Tab: Dispositivos & Sincronización */}
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex flex-col items-center justify-center w-10 h-10 rounded transition ${
            activeTab === 'devices'
              ? 'bg-autocad-cyan text-autocad-onAccent font-bold shadow-glow-cyan'
              : 'text-autocad-textMuted hover:text-white hover:bg-autocad-panel'
          }`}
          title="Gestor de Tags y Sincronización Lógica"
        >
          <Cpu className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 scale-90">Tags</span>
        </button>
      </div>

      {/* 2. Expandable Panel Drawer */}
      <div className="w-64 flex flex-col h-full bg-autocad-surface overflow-hidden">
        {/* TAB 1: BIBLIOTECA DE SÍMBOLOS */}
        {activeTab === 'symbols' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-autocad-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-autocad-cyan uppercase tracking-wider text-[11px]">
                  Biblioteca Eléctrica
                </span>
                <span className="text-[10px] text-autocad-textMuted">Por grupos</span>
              </div>

              {/* Search input */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-autocad-textMuted absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Buscar símbolo (contactor, relé)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-autocad-inset border border-autocad-border rounded pl-7 pr-2 py-1 text-xs text-autocad-textBright placeholder-autocad-textMuted focus:outline-none focus:border-autocad-cyan"
                />
              </div>

              {/* Symbol Studio / Piece Editor Button */}
              <button
                onClick={() => onOpenSymbolEditor && onOpenSymbolEditor()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-autocad-chip/70 hover:bg-autocad-chipHover border border-autocad-cyan/50 text-autocad-cyan font-bold rounded transition text-[11px] shadow-sm"
                title="Abrir el diseñador para alterar geometrías y bornes de conexión"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Diseñador / Editor de Piezas</span>
              </button>
            </div>

            {/* Categorized Symbols List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {[...CATEGORIES, 'Personalizados'].map(category => {
                const query = searchQuery.trim().toLowerCase();
                const symbolsInCat = Object.values(symbolDefs).filter(s => {
                  const group = s.category || 'Personalizados';
                  const matchesCat = group === category;
                  const matchesSearch = !query
                    || (s.name || '').toLowerCase().includes(query)
                    || (s.prefix || '').toLowerCase().includes(query);
                  return matchesCat && matchesSearch;
                });

                const isExpanded = expandedCategories[category] ?? true;

                return (
                  <div key={category} className="border border-autocad-border/60 rounded bg-autocad-raised overflow-hidden">
                    <div className="w-full flex items-center justify-between px-2 py-1.5 bg-autocad-panelHeader text-[11px] font-semibold text-autocad-textBright">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex-1 flex items-center justify-between text-left hover:text-autocad-cyan transition"
                      >
                        <span>{category}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-autocad-textMuted" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-autocad-textMuted" />
                        )}
                      </button>
                      <button
                        type="button"
                        title={`Crear una pieza en ${category}`}
                        onClick={() => onCreateSymbol && onCreateSymbol(category)}
                        className="ml-1 p-0.5 rounded text-autocad-textMuted hover:text-autocad-cyan hover:bg-autocad-hover"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="p-1 grid grid-cols-1 gap-0.5">
                        {symbolsInCat.length === 0 && (
                          <p className="px-1 py-1 text-[10px] text-autocad-textMuted">
                            {query ? 'Sin coincidencias.' : 'Vacío. Pulsa + para crear la pieza.'}
                          </p>
                        )}
                        {symbolsInCat.map(sym => {
                          const isPlacing = activePlacingSymbol === sym.type;
                          return (
                            <div
                              key={sym.type}
                              className={`flex items-center gap-1 rounded border px-1 py-0.5 transition ${
                                isPlacing
                                  ? 'border-autocad-cyan bg-autocad-cyan/15 text-autocad-cyan'
                                  : 'border-autocad-border/40 bg-autocad-surface hover:border-autocad-cyan/60 text-autocad-textBright'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onStartPlaceSymbol(sym.type)}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                title={`Colocar ${sym.name}`}
                              >
                                <SymbolThumb def={sym} />
                                <span className="font-mono text-[10px] px-1 py-0.5 bg-autocad-inset border border-autocad-border rounded text-autocad-yellow shrink-0">
                                  {sym.prefix}
                                </span>
                                <span className={`text-[11px] truncate ${isPlacing ? 'font-semibold' : ''}`}>
                                  {sym.name}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenSymbolEditor) onOpenSymbolEditor(sym.type);
                                }}
                                className="p-1 text-autocad-textMuted hover:text-autocad-cyan hover:bg-autocad-hover rounded shrink-0"
                                title={`Editar diseño y bornes de ${sym.name}`}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ÁRBOL DE PROYECTO & NAVEGADOR DE PLANOS */}
        {activeTab === 'tree' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-autocad-border">
              <span className="font-bold text-autocad-cyan uppercase tracking-wider text-[11px]">
                Árbol de Proyecto
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-autocad-textBright font-semibold text-[11px]">
                <FolderTree className="w-3.5 h-3.5 text-autocad-yellow" />
                <span>Proyecto Principal (ControlMAX 360)</span>
              </div>

              {/* Sheet Nodes */}
              <div className="pl-4 space-y-1">
                {sheets.map((sheet, index) => {
                  const isActive = sheet.id === activeSheetId;
                  const compCount = sheet.components?.length || 0;
                  const wireCount = sheet.wires?.length || 0;

                  return (
                    <div key={sheet.id} className="space-y-0.5">
                      <div
                        onClick={() => onSelectSheet(sheet.id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                          isActive
                            ? 'bg-autocad-chip/70 border border-autocad-cyan/60 text-autocad-cyan font-bold'
                            : 'hover:bg-autocad-hover text-autocad-textMuted hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-autocad-yellow">#{index + 1}</span>
                          <span className="text-[11px]">{sheet.title}</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.5 bg-autocad-raised rounded text-autocad-textMuted">
                          {compCount} disp.
                        </span>
                      </div>

                      {/* Components inside active sheet */}
                      {isActive && (
                        <div className="pl-4 space-y-0.5 border-l border-autocad-border/40 ml-2 py-1">
                          {sheet.components?.map(c => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between px-1.5 py-0.5 text-[10px] text-autocad-textMuted hover:text-autocad-textBright"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-mono text-autocad-yellow">{c.tag}</span>
                                <span className="text-[9px] truncate">({c.type})</span>
                              </div>
                              {(c.energized || energizedById[c.id]) && (
                                <Zap className="w-3 h-3 text-autocad-green fill-autocad-green animate-pulse" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GESTOR DE DISPOSITIVOS Y SINCRONIZACIÓN POR TAGS */}
        {activeTab === 'devices' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-autocad-border">
              <span className="font-bold text-autocad-cyan uppercase tracking-wider text-[11px]">
                Sincronización de Tags
              </span>
              <p className="text-[10px] text-autocad-textMuted mt-1">
                Dispositivos con el mismo nombre se vinculan y operan en paralelo en tiempo real.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {Array.from(tagsMap.entries()).map(([tag, comps]) => {
                const isTagEnergized = comps.some(c => c.energized || energizedById[c.id]);
                const hasMultiple = comps.length > 1;

                return (
                  <div
                    key={tag}
                    className={`p-2 rounded border transition ${
                      isTagEnergized
                        ? 'bg-autocad-chipLive/40 border-autocad-green/60 shadow-glow-green'
                        : 'bg-autocad-raised border-autocad-border/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-autocad-yellow">
                          {tag}
                        </span>
                        {hasMultiple && (
                          <span className="text-[9px] px-1 py-0.2 bg-blue-950 border border-blue-600/40 text-blue-300 rounded">
                            {comps.length} vinculados
                          </span>
                        )}
                      </div>

                      {isTagEnergized ? (
                        <span className="flex items-center gap-1 text-[9px] text-autocad-green font-bold">
                          <Zap className="w-2.5 h-2.5 fill-autocad-green animate-pulse" />
                          ACTIVO
                        </span>
                      ) : (
                        <span className="text-[9px] text-autocad-textMuted">REPOSO</span>
                      )}
                    </div>

                    {/* Linked elements list */}
                    <div className="space-y-0.5 mt-1 border-t border-autocad-border/30 pt-1">
                      {comps.map((c, i) => (
                        <div key={c.id} className="flex items-center justify-between text-[10px] text-autocad-textMuted">
                          <span className="truncate">{c.type}</span>
                          <span className="font-mono text-[9px] text-autocad-cyan">
                            {c.state?.closed ? 'CERRADO' : (c.state?.tripped ? 'DISPARADO' : 'NORMAL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
