
import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Plus, X, Check, Layers, Lock, Unlock, Snowflake, Sun, Printer, Settings2, Search } from 'lucide-react';
import { LayerConfig, LineType } from '../types';

interface LayerManagerProps {
  layers: Record<string, LayerConfig>;
  lineTypeDefinitions?: Record<string, any>;
  activeLayer: string;
  onClose: () => void;
  onUpdateLayer: (id: string, updates: Partial<LayerConfig>) => void;
  onAddLayer: (name: string) => void;
  onRemoveLayer: (id: string) => void;
  onSetActive: (id: string) => void;
  onOpenLineTypes?: () => void;
  onOpenColorSelector?: (currentColor: string, onSelect: (color: string) => void, title?: string) => void;
  onPurgeEmpty?: () => void;
  selectedCount?: number;
  onMoveSelectedToLayer?: (layerId: string) => void;
  onLoadLayersTemplate?: (newLayers: Record<string, LayerConfig>) => void;
}

const LINE_WEIGHTS = [
    "DEFAULT", "0.00 Lightweight", "0.05", "0.09", "0.13", "0.15", "0.18", "0.20", "0.25",
    "0.30", "0.35", "0.40", "0.50", "0.60", "0.70", "0.80", "1.00", "1.40", "2.00", "2.11"
];

const LineTypePreview = ({ type, color = "#00bcd4", weight = 0.25 }: { type: LineType, color?: string, weight?: number }) => {
    const L = 12;
    const getDash = () => {
        switch (type) {
            case 'dashed': return [L * 2, L * 1.5];
            case 'dotted': return [1, L * 1.2];
            case 'center': return [L * 4, L, L * 0.8, L];
            case 'dashdot': return [L * 3, L * 0.8, L * 0.4, L * 0.8];
            case 'border': return [L * 6, L * 1.2, L * 2, L * 1.2];
            case 'divide': return [L * 2.5, L * 0.6, L * 0.5, L * 0.6, L * 0.5, L * 0.6];
            case 'phantom': return [L * 5, L * 0.8, L * 0.5, L * 0.8, L * 0.5, L * 0.8];
            case 'hidden': return [L, L * 0.8];
            case 'gasLine': return [L * 6, L * 2];
            case 'fenceLine': return [L * 4, L * 2];
            case 'tracks': return [L * 1.5, L * 1, L * 1.5, L * 1];
            case 'batt': return [L * 2.5, L * 0.5];
            case 'zigzag': return [L * 3, L, L, L];
            case 'zigzag2': return [L * 1.2, L * 0.6];
            case 'dots2': return [0.5, L * 0.6];
            case 'dash2': return [L * 0.8, L * 0.6];
            case 'hotwater': return [L * 5, L * 2];
            default: return [];
        }
    };
    return (
        <svg width="40" height="8" className="overflow-visible opacity-90">
            <line x1="0" y1="4" x2="40" y2="4" stroke={color} strokeWidth={Math.max(1, weight * 0.8)} strokeDasharray={getDash().join(',')} strokeLinecap={type === 'dotted' || type === 'dots2' ? 'round' : 'square'} />
            {(type === 'gasLine') && <text x="20" y="6.5" fontSize="4.5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1.5px' }}>GAS</text>}
            {(type === 'hotwater') && <text x="20" y="6.5" fontSize="4.5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1.5px' }}>HW</text>}
            {(type === 'fenceLine') && <text x="20" y="6.5" fontSize="4.5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1.5px' }}>FEN</text>}
        </svg>
    );
};

const DEFAULT_TEMPLATES: Record<string, Record<string, Omit<LayerConfig, 'id'>>> = {
  "Architectural Template": {
    "0": { name: "0", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFFFF", thickness: 0.15, lineType: "continuous" },
    "walls": { name: "A-WALLS", visible: true, locked: false, frozen: false, plottable: true, color: "#FF0000", thickness: 0.50, lineType: "continuous" },
    "doors": { name: "A-DOORS", visible: true, locked: false, frozen: false, plottable: true, color: "#00FFFF", thickness: 0.25, lineType: "continuous" },
    "windows": { name: "A-WINDOWS", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFF00", thickness: 0.18, lineType: "continuous" },
    "dimensions": { name: "A-DIMS", visible: true, locked: false, frozen: false, plottable: true, color: "#00FF00", thickness: 0.13, lineType: "continuous" },
    "text": { name: "A-TEXT", visible: true, locked: false, frozen: false, plottable: true, color: "#FF00FF", thickness: 0.15, lineType: "continuous" },
    "centerlines": { name: "A-CLNS", visible: true, locked: false, frozen: false, plottable: true, color: "#0000FF", thickness: 0.13, lineType: "center" }
  },
  "Mechanical Template": {
    "0": { name: "0", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFFFF", thickness: 0.15, lineType: "continuous" },
    "visible": { name: "M-VISIBLE", visible: true, locked: false, frozen: false, plottable: true, color: "#00FFFF", thickness: 0.50, lineType: "continuous" },
    "hidden": { name: "M-HIDDEN", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFF00", thickness: 0.25, lineType: "dashed" },
    "center": { name: "M-CENTER", visible: true, locked: false, frozen: false, plottable: true, color: "#FF0000", thickness: 0.18, lineType: "center" },
    "dims": { name: "M-DIMS", visible: true, locked: false, frozen: false, plottable: true, color: "#00FF00", thickness: 0.13, lineType: "continuous" },
    "hatch": { name: "M-HATCH", visible: true, locked: false, frozen: false, plottable: true, color: "#0000FF", thickness: 0.13, lineType: "continuous" }
  },
  "Electrical Template": {
    "0": { name: "0", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFFFF", thickness: 0.15, lineType: "continuous" },
    "wiring": { name: "E-WIRING", visible: true, locked: false, frozen: false, plottable: true, color: "#FFFF00", thickness: 0.35, lineType: "continuous" },
    "power": { name: "E-POWER", visible: true, locked: false, frozen: false, plottable: true, color: "#FF0000", thickness: 0.50, lineType: "continuous" },
    "control": { name: "E-CONTROL", visible: true, locked: false, frozen: false, plottable: true, color: "#0000FF", thickness: 0.25, lineType: "continuous" },
    "fixtures": { name: "E-FIXTURES", visible: true, locked: false, frozen: false, plottable: true, color: "#00FF00", thickness: 0.18, lineType: "continuous" },
    "text": { name: "E-TEXT", visible: true, locked: false, frozen: false, plottable: true, color: "#00FFFF", thickness: 0.15, lineType: "continuous" }
  }
};

const LayerManager: React.FC<LayerManagerProps> = ({ 
    layers, lineTypeDefinitions, activeLayer, onClose, onUpdateLayer, onAddLayer, onRemoveLayer, onSetActive, onOpenLineTypes, onOpenColorSelector, onPurgeEmpty,
    selectedCount = 0, onMoveSelectedToLayer, onLoadLayersTemplate
}) => {
  const [newLayerName, setNewLayerName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [layerSearch, setLayerSearch] = useState('');
  const [templateName, setTemplateName] = useState('');

  const [customTemplates, setCustomTemplates] = useState<Record<string, Record<string, LayerConfig>>>(() => {
    try {
      const stored = localStorage.getItem('voxcad_layer_templates');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const name = templateName.trim();
    const updated = {
      ...customTemplates,
      [name]: layers
    };
    setCustomTemplates(updated);
    localStorage.setItem('voxcad_layer_templates', JSON.stringify(updated));
    setTemplateName('');
  };

  const handleLoadTemplate = (tplName: string) => {
    let tpl: Record<string, any> = {};
    if (DEFAULT_TEMPLATES[tplName]) {
      const raw = DEFAULT_TEMPLATES[tplName];
      Object.keys(raw).forEach(key => {
        tpl[key] = {
          ...raw[key],
          id: key
        };
      });
    } else if (customTemplates[tplName]) {
      tpl = customTemplates[tplName];
    }
    if (onLoadLayersTemplate && Object.keys(tpl).length > 0) {
      onLoadLayersTemplate(tpl);
    }
  };

  const filteredLayers = (Object.values(layers) as LayerConfig[]).filter(layer => 
    layer.name.toLowerCase().includes(layerSearch.toLowerCase())
  );

  useEffect(() => {
    if (editingId && editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (id === '0' || id === 'defpoints') return;
    setEditingId(id);
    setEditingName(name);
  };

  const handleFinishRename = () => {
    if (editingId && editingName.trim()) {
        onUpdateLayer(editingId, { name: editingName.trim().toUpperCase() });
    }
    setEditingId(null);
  };
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
    };
    const handleEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLayerName.trim()) { 
        onAddLayer(newLayerName.trim().toUpperCase()); 
        setNewLayerName(''); 
    }
  };

  const baseLineTypes: { value: LineType; label: string }[] = [
    { value: 'continuous', label: 'Continuous' }, 
    { value: 'dashed', label: 'Dashed' }, 
    { value: 'dotted', label: 'Dotted' }, 
    { value: 'center', label: 'Center' },
    { value: 'dashdot', label: 'Dash Dot' },
    { value: 'border', label: 'Border' },
    { value: 'divide', label: 'Divide' },
    { value: 'phantom', label: 'Phantom' },
    { value: 'zigzag', label: 'Zigzag' },
    { value: 'hotwater', label: 'Hot Water' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'gasLine', label: 'Gas Line' },
    { value: 'fenceLine', label: 'Fence Line' },
    { value: 'tracks', label: 'Tracks' },
    { value: 'batt', label: 'Batt' },
    { value: 'zigzag2', label: 'Zigzag 2' },
    { value: 'dots2', label: 'Dots (dense)' },
    { value: 'dash2', label: 'Dashed (short)' },
  ];

  const allLineTypes = [...baseLineTypes];
  if (lineTypeDefinitions) {
    Object.keys(lineTypeDefinitions).forEach(key => {
      if (!allLineTypes.find(lt => lt.value === key)) {
          allLineTypes.push({ value: key as LineType, label: lineTypeDefinitions[key].description || key });
      }
    });
  }

  return (
    <div 
        className="relative w-[94vw] sm:w-[600px] sm:max-w-[95vw] h-[82vh] sm:h-[80vh] sm:max-h-[700px] glass-panel rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 150 }}
    >
      <div 
        className="flex justify-between items-center px-4 py-3 sm:py-2.5 border-b border-white/5 bg-[#121214] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Layers size={14} className="sm:size-16" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] text-neutral-300">Layer Properties</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 hover:text-white transition-all"><X size={18} /></button>
      </div>

      {/* Layer Actions Toolbar */}
      <div className="flex flex-col border-b border-white/5 bg-[#0e0e10] shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                Object.keys(layers).forEach(id => onUpdateLayer(id, { locked: true }));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 hover:bg-amber-600/15 active:scale-95 text-neutral-400 hover:text-amber-500 border border-white/5 hover:border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              title="Lock all layers in current drawing"
            >
              <Lock size={11} className="stroke-[2.5]" />
              Lock All
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                Object.keys(layers).forEach(id => onUpdateLayer(id, { locked: false }));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 hover:bg-cyan-500/15 active:scale-95 text-neutral-400 hover:text-cyan-400 border border-white/5 hover:border-cyan-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              title="Unlock all layers in current drawing"
            >
              <Unlock size={11} className="stroke-[2.5]" />
              Unlock All
            </button>
            
            {onPurgeEmpty && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPurgeEmpty();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 hover:bg-red-500/15 active:scale-95 text-neutral-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                title="Purge layers that contain zero shapes and are not currently active"
              >
                <Trash2 size={11} className="stroke-[2.5]" />
                Purge Empty
              </button>
            )}
          </div>
          <div className="text-[8px] font-mono text-neutral-600 font-bold uppercase tracking-widest mr-1">
            {Object.keys(layers).length} ACTIVE LAYERS
          </div>
        </div>

        {/* Templates Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-1 border-b border-white/5 bg-[#121214]">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-neutral-500 uppercase tracking-wider">Template:</span>
            <select
              className="bg-[#0b0b0d] border border-white/5 rounded-lg px-2.5 py-1 text-[9px] text-neutral-300 font-bold uppercase transition-all hover:bg-black focus:border-[#00bcd4]/40 focus:ring-1 focus:ring-[#00bcd4]/15 outline-none cursor-pointer"
              onChange={(e) => {
                if (e.target.value) {
                  handleLoadTemplate(e.target.value);
                  e.target.value = ""; // Reset
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>-- Select Project Template --</option>
              <optgroup label="Standard Templates" className="bg-[#121214] text-neutral-300 font-bold">
                {Object.keys(DEFAULT_TEMPLATES).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
              {Object.keys(customTemplates).length > 0 && (
                <optgroup label="Saved Templates" className="bg-[#121214] text-neutral-300 font-bold">
                  {Object.keys(customTemplates).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              placeholder="Save current layers as..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="bg-[#0b0b0d] border border-white/5 rounded-lg px-2 py-1 text-[9.5px] text-neutral-300 placeholder:text-neutral-700 outline-none w-36 uppercase font-bold focus:border-[#00bcd4]/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveTemplate();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="px-2.5 py-1 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 border border-[#00bcd4]/30 text-[#00bcd4] hover:text-white rounded-lg text-[8.5px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Save Template
            </button>
            {Object.keys(customTemplates).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCustomTemplates({});
                  localStorage.removeItem('voxcad_layer_templates');
                }}
                className="px-2 py-1 hover:bg-red-500/10 text-neutral-600 hover:text-red-400 rounded transition-all text-[8px]"
                title="Clear all saved custom templates"
              >
                Clear Saved
              </button>
            )}
          </div>
        </div>

        {/* Search & Quick Filter Bar */}
        <div className="flex items-center gap-2 px-4 pb-2 bg-black/10">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
            <input 
              type="text"
              placeholder="Search or filter layers by name..."
              value={layerSearch}
              onChange={(e) => setLayerSearch(e.target.value)}
              className="w-full bg-[#121214] border border-white/5 rounded-lg pl-8 pr-7 py-1.5 text-[9.5px] uppercase text-neutral-300 placeholder:text-neutral-700 font-bold focus:border-[#00bcd4]/40 outline-none transition-all tracking-wider font-mono animate-in fade-in duration-300"
            />
            {layerSearch && (
              <button 
                type="button"
                onClick={() => setLayerSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X size={10} />
              </button>
            )}
          </div>
          {layerSearch && filteredLayers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const anyVisible = filteredLayers.some(l => l.visible);
                filteredLayers.forEach(l => onUpdateLayer(l.id, { visible: !anyVisible }));
              }}
              className="px-2.5 py-1.5 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 border border-[#00bcd4]/30 text-[#00bcd4] rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95"
              title="Toggle Visibility of all matching results"
            >
              Toggle Visibility ({filteredLayers.length})
            </button>
          )}
        </div>

        {/* Batch Actions Float Bar */}
        {selectedLayerIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-cyan-950/20 border-t border-cyan-500/10 shrink-0 text-[10px] gap-2 animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2 font-black text-cyan-400 uppercase tracking-widest">
                  <Layers size={11} />
                  <span>{selectedLayerIds.length} Selected:</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  <button 
                    type="button"
                    onClick={() => {
                       const anyVisible = selectedLayerIds.some(id => layers[id]?.visible);
                       selectedLayerIds.forEach(id => onUpdateLayer(id, { visible: !anyVisible }));
                    }}
                    className="px-2 py-1 bg-black/40 hover:bg-black border border-white/5 rounded text-neutral-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Toggle On/Off
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                       const anyFrozen = selectedLayerIds.some(id => layers[id]?.frozen);
                       selectedLayerIds.forEach(id => {
                          if (id !== activeLayer) {
                            onUpdateLayer(id, { frozen: !anyFrozen });
                          }
                       });
                    }}
                    className="px-2 py-1 bg-black/40 hover:bg-black border border-white/5 rounded text-neutral-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Toggle Freeze
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                       const anyLocked = selectedLayerIds.some(id => layers[id]?.locked);
                       selectedLayerIds.forEach(id => onUpdateLayer(id, { locked: !anyLocked }));
                    }}
                    className="px-2 py-1 bg-black/40 hover:bg-black border border-white/5 rounded text-neutral-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Toggle Lock
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                       const anyPlottable = selectedLayerIds.some(id => layers[id]?.plottable);
                       selectedLayerIds.forEach(id => onUpdateLayer(id, { plottable: !anyPlottable }));
                    }}
                    className="px-2 py-1 bg-black/40 hover:bg-black border border-white/5 rounded text-neutral-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Toggle Plot
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                       onOpenColorSelector?.('#FFFFFF', (color) => {
                           selectedLayerIds.forEach(id => onUpdateLayer(id, { color }));
                       }, "Batch Color Selection");
                    }}
                    className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 hover:text-white rounded text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Batch Color
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                       selectedLayerIds.forEach(id => {
                          if (id !== '0' && id !== activeLayer) {
                            onRemoveLayer(id);
                          }
                       });
                       setSelectedLayerIds([]);
                    }}
                    className="px-2 py-1 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 hover:text-red-300 rounded text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    Batch Delete
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedLayerIds([])}
                    className="px-1.5 py-1 text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded text-[8px] uppercase font-black transition-all"
                  >
                    Clear
                  </button>
              </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-[#0a0a0c] scrollbar-thin scrollbar-thumb-zinc-700/85 scrollbar-track-transparent">
        <div className="min-w-[812px] flex flex-col h-full"> 
          {/* Header Row - Sticky inside the horizontal scroll container */}
          <div className="flex items-center text-[9px] text-neutral-600 font-black uppercase border-b border-white/5 bg-[#121214] sticky top-0 z-20 select-none shrink-0 shadow-sm">
              <div className="w-16 px-2 py-2 shrink-0 border-r border-white/5 flex items-center justify-between gap-1 select-none">
                <input 
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-white/10 bg-neutral-900 accent-[#00bcd4] cursor-pointer"
                  checked={selectedLayerIds.length === Object.keys(layers).length && Object.keys(layers).length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLayerIds(Object.keys(layers));
                    } else {
                      setSelectedLayerIds([]);
                    }
                  }}
                />
                <span className="text-[8px] font-black text-neutral-600 uppercase pr-1">Stat</span>
              </div>
              <div className="w-40 px-3 py-2 shrink-0 border-r border-white/5">Layer Name</div>
              <div className="w-12 text-center py-2 shrink-0 border-r border-white/5">On</div>
              <div className="w-12 text-center py-2 shrink-0 border-r border-white/5">Frz</div>
              <div className="w-12 text-center py-2 shrink-0 border-r border-white/5">Lck</div>
              <div className="w-12 text-center py-2 shrink-0 border-r border-white/5">Plt</div>
              <div className="w-12 text-center py-2 shrink-0 border-r border-white/5 text-[8.5px] tracking-tight">Iso</div>
              <div className="w-28 text-center py-2 shrink-0 border-r border-white/5">Color</div>
              <div className="w-44 text-center py-2 shrink-0 border-r border-white/5 flex items-center justify-center gap-1">
                Line Type
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenLineTypes?.(); }}
                  className="p-1 hover:bg-white/10 rounded transition-all text-neutral-600 hover:text-cyan-400"
                  title="Manage Line Types"
                >
                  <Settings2 size={10} />
                </button>
              </div>
              <div className="w-32 text-center py-2 shrink-0 border-r border-white/5">Line Weight</div>
              <div className="w-20 text-center py-2 shrink-0 border-r border-white/5 uppercase tracking-tighter">Style</div>
              <div className="flex-1 py-2"></div>
          </div>

          <div className="flex flex-col">
            {filteredLayers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-600 font-bold uppercase tracking-widest text-[9px] gap-2 animate-in fade-in duration-300">
                <Search size={22} className="text-neutral-800" />
                <span>No matching layers found</span>
              </div>
            )}
            {filteredLayers.map((layer: LayerConfig, i) => {
                const isActive = activeLayer === layer.id;
                const isZero = layer.name === '0';
                return (
                  <div 
                    key={`${layer.id}-${i}`}
                    className={`flex items-center transition-colors border-b border-white/[0.03] no-tap group cursor-pointer relative 
                      ${isActive 
                        ? 'bg-cyan-500/10 shadow-[inset_3px_0_0_#06b6d4,inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.1)]' 
                        : 'hover:bg-white/[0.04]'}`}
                    onPointerDown={() => onSetActive(layer.id)}
                  >
                    {/* Compact Select & Active Columns */}
                    <div className="w-16 flex items-center justify-between px-2 shrink-0 py-1 border-r border-white/5" onPointerDown={e => e.stopPropagation()}>
                        <input 
                            type="checkbox"
                            checked={selectedLayerIds.includes(layer.id)}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setSelectedLayerIds(prev => [...prev, layer.id]);
                                } else {
                                    setSelectedLayerIds(prev => prev.filter(id => id !== layer.id));
                                }
                            }}
                            className="w-3.5 h-3.5 rounded border-white/10 bg-neutral-900 accent-[#00bcd4] cursor-pointer"
                        />
                        <div 
                            title={isActive ? "Current Layer" : "Click to make current"}
                            className={`w-4 h-4 flex items-center justify-center rounded-full transition-all cursor-pointer ${isActive ? 'bg-cyan-500 text-black' : 'bg-neutral-900/50 text-neutral-800 border border-white/5'}`}
                            onClick={() => onSetActive(layer.id)}
                        >
                            {isActive ? <Check size={10} strokeWidth={4} /> : <div className="w-1 h-1 rounded-full bg-neutral-800" />}
                        </div>
                    </div>

                    {/* Name Column */}
                    <div 
                        className="w-40 px-3 shrink-0 py-1 border-r border-white/5"
                        onDoubleClick={(e) => handleStartRename(e, layer.id, layer.name)}
                    >
                        {editingId === layer.id ? (
                            <input
                                ref={editInputRef}
                                type="text"
                                className="w-full bg-black border border-cyan-500/50 rounded px-1.5 py-0.5 text-[11px] text-white outline-none font-bold uppercase"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={handleFinishRename}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleFinishRename();
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <div 
                                className={`text-[11px] font-bold uppercase tracking-wide truncate ${isActive ? 'text-cyan-300' : 'text-neutral-300'}`}
                                title="Double-click to rename"
                            >
                                {layer.name}
                            </div>
                        )}
                    </div>

                    {/* Visibility */}
                    <div className="w-12 flex justify-center shrink-0 py-1 border-r border-white/5">
                        <button 
                            title="Turn On/Off"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onUpdateLayer(layer.id, { visible: !layer.visible }); 
                            }} 
                            className={`p-1 rounded transition-all hover:bg-white/5 ${layer.visible ? 'text-amber-400' : 'text-neutral-700'}`}
                        >
                            {layer.visible ? <Sun size={13} fill="currentColor" /> : <EyeOff size={13} />}
                        </button>
                    </div>

                    {/* Freeze */}
                    <div className="w-12 flex justify-center shrink-0 py-1 border-r border-white/5">
                        <button 
                            title="Freeze/Thaw"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isActive) return;
                                onUpdateLayer(layer.id, { frozen: !layer.frozen }); 
                            }} 
                            className={`p-1 rounded transition-all hover:bg-white/5 ${layer.frozen ? 'text-blue-400' : 'text-neutral-700'}`}
                            disabled={isActive}
                        >
                            {layer.frozen ? <Snowflake size={13} strokeWidth={3} /> : <Sun size={12} className="opacity-40 text-neutral-500" />}
                        </button>
                    </div>

                    {/* Lock */}
                    <div className="w-12 flex justify-center shrink-0 py-1 border-r border-white/5">
                        <button 
                            title="Lock/Unlock"
                            onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }} 
                            className={`p-1 rounded transition-all hover:bg-white/5 ${layer.locked ? 'text-amber-600' : 'text-neutral-500'}`}
                        >
                            {layer.locked ? <Lock size={13} strokeWidth={3} /> : <Unlock size={13} className="opacity-40 text-neutral-500" />}
                        </button>
                    </div>

                    {/* Plottable */}
                    <div className="w-12 flex justify-center shrink-0 py-1 border-r border-white/5">
                        <button 
                            title="Plot/No Plot"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onUpdateLayer(layer.id, { plottable: !layer.plottable }); 
                            }} 
                            className={`p-1 rounded transition-all hover:bg-white/5 ${layer.plottable ? 'text-neutral-300' : 'text-red-500'}`}
                        >
                            <div className="relative">
                                <Printer size={13} />
                                {!layer.plottable && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-70">
                                    <div className="w-[1px] h-3.5 bg-current rotate-45" />
                                  </div>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Isolate */}
                    <div className="w-12 flex justify-center shrink-0 py-1 border-r border-white/5">
                        <button 
                            title="Isolate Layer (sets all other layers to non-visible while keeping locked/frozen state unchanged)"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                Object.keys(layers).forEach(id => {
                                    onUpdateLayer(id, { visible: id === layer.id });
                                });
                            }} 
                            className="p-1 rounded transition-all hover:bg-neutral-800 text-neutral-500 hover:text-cyan-400 active:scale-90"
                        >
                            <Eye size={13} className="stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Color */}
                    <div className="w-28 flex items-center gap-2 shrink-0 py-1 border-r border-white/5 px-2.5">
                        <div 
                            title="Change Color"
                            className="relative w-6 h-6 rounded-lg border border-white/10 overflow-hidden bg-black cursor-pointer transition-all hover:scale-110 active:scale-95 shrink-0"
                            style={{ backgroundColor: layer.color || '#FFFFFF' }}
                            onClick={e => {
                                e.stopPropagation();
                                onOpenColorSelector?.(layer.color || '#FFFFFF', (color) => {
                                    onUpdateLayer(layer.id, { color });
                                }, `Layer: ${layer.name}`);
                            }}
                        />
                        <input 
                            type="text"
                            className="w-full bg-[#0d0d0f] border border-white/5 rounded px-1.5 py-1 text-[9px] text-neutral-400 outline-none font-mono uppercase transition-all hover:border-white/20"
                            value={layer.color || '#FFFFFF'}
                            onClick={e => e.stopPropagation()}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val.match(/^#?[0-9A-Fa-f]{0,6}$/)) {
                                    onUpdateLayer(layer.id, { color: val.startsWith('#') ? val : '#' + val });
                                }
                            }}
                        />
                    </div>

                    {/* Linetype */}
                    <div className="w-44 px-2 shrink-0 py-1 flex items-center gap-1.5 border-r border-white/5">
                        <div className="flex-1 relative group/select">
                            <select 
                                value={layer.lineType} 
                                onClick={e => e.stopPropagation()}
                                onChange={e => onUpdateLayer(layer.id, { lineType: e.target.value as LineType })} 
                                className="w-full bg-[#0d0d0f]/60 border border-white/5 rounded-lg pl-2 pr-6 py-2 text-[9px] text-neutral-300 outline-none uppercase font-black tracking-tight cursor-pointer appearance-none transition-all hover:border-white/20 hover:bg-black focus:ring-1 focus:ring-white/10"
                            >
                                {allLineTypes.map((lt, idx) => <option key={`${lt.value}-${idx}`} value={lt.value} className="bg-[#121214] text-white py-2">{lt.label}</option>)}
                            </select>
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 transition-colors">
                                <Settings2 size={10} />
                            </div>
                        </div>
                        <div className="w-10 h-7 flex items-center justify-center bg-black/40 rounded-lg border border-white/5 shrink-0 shadow-inner">
                            <LineTypePreview type={layer.lineType} color={layer.color} weight={typeof layer.thickness === 'number' ? layer.thickness : 0.25} />
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="w-32 px-3 shrink-0 py-1 border-r border-white/5 flex flex-col items-center justify-center gap-1">
                        <select 
                            value={typeof layer.thickness === 'number' ? layer.thickness.toFixed(2) : layer.thickness} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                                const val = e.target.value;
                                onUpdateLayer(layer.id, { thickness: (val === 'DEFAULT' || val === '0.00 Lightweight') ? (val === 'DEFAULT' ? 'DEFAULT' : 0.0) : parseFloat(val) });
                            }} 
                            className="w-full bg-[#0d0d0f]/60 border border-white/5 rounded-lg px-2 py-1.5 text-[9px] text-neutral-300 outline-none font-mono cursor-pointer appearance-none text-center transition-all hover:border-white/20 hover:bg-black focus:ring-1 focus:ring-white/10 shadow-inner"
                        >
                            {LINE_WEIGHTS.map((w, idx) => <option key={`${w}-${idx}`} value={w} className="bg-[#121214] text-white py-2">{w}{w !== 'DEFAULT' && w !== '0.00 Lightweight' ? 'mm' : ''}</option>)}
                        </select>
                    </div>

                    {/* Plot Style */}
                    <div className="w-20 shrink-0 py-1 border-r border-white/5 flex items-center justify-center px-1">
                        <div className="text-[8px] font-black text-neutral-700 uppercase tracking-tighter pl-1">ByColor</div>
                    </div>

                    {/* Actions */}
                    <div className="flex-1 px-3 flex justify-end items-center py-1">
                        {selectedCount > 0 && (
                            <button 
                                type="button"
                                title={`Move ${selectedCount} selected shapes to layer ${layer.name}`}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onMoveSelectedToLayer?.(layer.id); 
                                }} 
                                className="mr-2 text-cyan-400 hover:text-black bg-cyan-950/40 hover:bg-cyan-400 border border-cyan-500/20 hover:border-cyan-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 shrink-0"
                            >
                                <span>Move Select</span>
                            </button>
                        )}
                        {!isActive && !isZero && (
                            <button 
                                type="button"
                                title="Delete Layer"
                                onClick={(e) => { e.stopPropagation(); onRemoveLayer(layer.id); }} 
                                className="text-neutral-700 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-3 border-t border-white/5 bg-[#0d0d0f] flex gap-2 shrink-0">
        <div className="relative flex-1">
            <Plus size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-700" />
            <input 
                type="text" 
                placeholder="New Layer Name..." 
                className="w-full bg-black border border-white/5 rounded-xl pl-10 pr-3 py-2.5 text-[11px] text-neutral-200 focus:border-cyan-500/30 outline-none uppercase tracking-widest transition-all font-black placeholder:text-neutral-800" 
                value={newLayerName} 
                onChange={(e) => setNewLayerName(e.target.value)} 
            />
        </div>
        <button type="submit" className="bg-neutral-800 text-neutral-400 hover:text-cyan-400 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/5 transition-all flex items-center gap-2 active:scale-95 shrink-0">
            Create
        </button>
      </form>
    </div>
  );
};

export default LayerManager;
