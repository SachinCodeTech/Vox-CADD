
import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Plus, X, Check, Layers, Lock, Unlock, Snowflake, Sun } from 'lucide-react';
import { LayerConfig, LineType } from '../types';

interface LayerManagerProps {
  layers: Record<string, LayerConfig>;
  activeLayer: string;
  onClose: () => void;
  onUpdateLayer: (id: string, updates: Partial<LayerConfig>) => void;
  onAddLayer: (name: string) => void;
  onRemoveLayer: (id: string) => void;
  onSetActive: (id: string) => void;
}

const LINE_WEIGHTS = [
    "0.00", "0.05", "0.09", "0.13", "0.15", "0.18", "0.20", "0.25",
    "0.30", "0.35", "0.40", "0.50", "0.60", "0.70", "0.80", "1.00", "1.40", "2.11"
];

const LineTypePreview = ({ type, color = "#00bcd4" }: { type: LineType, color?: string }) => {
    const L = 6;
    const getDash = () => {
        switch (type) {
            case 'dashed': return [L * 2, L * 1.5];
            case 'dotted': return [0.5, L * 1.2];
            case 'center': return [L * 4, L, L * 0.5, L];
            case 'dashdot': return [L * 3, L * 0.8, L * 0.2, L * 0.8];
            case 'border': return [L * 6, L * 1.2, L * 2, L * 1.2];
            case 'divide': return [L * 2.5, L * 0.6, L * 0.5, L * 0.6, L * 0.5, L * 0.6];
            case 'phantom': return [L * 5, L * 0.8, L * 0.5, L * 0.8, L * 0.5, L * 0.8];
            case 'hidden': return [L, L * 0.8];
            case 'gasLine': return [L * 6, L * 2];
            case 'fenceLine': return [L * 4, L * 2];
            case 'tracks': return [L * 1.5, L * 1, L * 1.5, L * 1];
            case 'batt': return [L * 2, L * 0.5, L * 0.2, L * 0.5, L * 2, L * 0.5];
            case 'zigzag': return [L * 3, L, L, L];
            case 'zigzag2': return [L * 1.2, L * 0.6];
            case 'dots2': return [0.3, L * 0.5];
            case 'dash2': return [L * 0.6, L * 0.4];
            case 'hotwater': return [L * 5, L * 2];
            default: return [];
        }
    };
    return (
        <svg width="40" height="8" className="overflow-visible opacity-90">
            <line x1="0" y1="4" x2="40" y2="4" stroke={color} strokeWidth="1.2" strokeDasharray={getDash().join(',')} strokeLinecap={type === 'dotted' || type === 'dots2' ? 'round' : 'square'} />
            {(type === 'gasLine') && <text x="20" y="6.5" fontSize="5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1px' }}>GAS</text>}
            {(type === 'hotwater') && <text x="20" y="6.5" fontSize="5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1px' }}>HW</text>}
            {(type === 'fenceLine') && <text x="20" y="6.5" fontSize="5" fill={color} textAnchor="middle" fontWeight="black" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '1px' }}>FENCE</text>}
        </svg>
    );
};

const LayerManager: React.FC<LayerManagerProps> = ({ 
    layers, activeLayer, onClose, onUpdateLayer, onAddLayer, onRemoveLayer, onSetActive 
}) => {
  const [newLayerName, setNewLayerName] = useState('');
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

  const lineTypes: { value: LineType; label: string }[] = [
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

  return (
    <div 
        className="fixed left-1/2 top-10 -translate-x-1/2 w-[480px] max-w-[98vw] glass-panel rounded-[1.25rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 border border-white/5"
        style={{ transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`, zIndex: 150 }}
    >
      <div 
        className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 bg-[#121214] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Layers size={14} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-300">Layer Properties</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 hover:text-white transition-all"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-auto bg-[#0a0a0c] scrollbar-thin">
        <div className="min-w-[760px] flex flex-col h-full"> 
          {/* Header Row - Sticky inside the horizontal scroll container */}
          <div className="flex items-center text-[9px] text-neutral-500 font-bold uppercase border-b border-white/5 bg-[#121214] sticky top-0 z-20 select-none shrink-0 shadow-sm">
              <div className="w-12 text-center py-2.5 shrink-0 border-r border-white/5">Stat</div>
              <div className="w-40 px-3 py-2.5 shrink-0 border-r border-white/5">Layer Name</div>
              <div className="w-14 text-center py-2.5 shrink-0 border-r border-white/5">On</div>
              <div className="w-14 text-center py-2.5 shrink-0 border-r border-white/5">Frz</div>
              <div className="w-14 text-center py-2.5 shrink-0 border-r border-white/5">Lck</div>
              <div className="w-16 text-center py-2.5 shrink-0 border-r border-white/5">Color</div>
              <div className="w-48 text-center py-2.5 shrink-0 border-r border-white/5">Line Type</div>
              <div className="w-32 text-center py-2.5 shrink-0 border-r border-white/5">Line Weight</div>
              <div className="flex-1 py-2.5"></div>
          </div>

          <div className="flex flex-col">
            {Object.values(layers).map((layer: LayerConfig) => {
                const isActive = activeLayer === layer.id;
                const isZero = layer.name === '0';
                return (
                  <div 
                    key={layer.id}
                    className={`flex items-center transition-all border-b border-white/[0.03] no-tap group cursor-pointer ${isActive ? 'bg-cyan-500/[0.08]' : 'hover:bg-neutral-800/40'}`}
                    onClick={() => onSetActive(layer.id)}
                  >
                    {/* Status Column */}
                    <div className="w-12 flex justify-center shrink-0 py-2 border-r border-white/5">
                        <div 
                            title={isActive ? "Current Layer" : "Click to make current"}
                            className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${isActive ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-neutral-900/50 text-neutral-800 border border-white/5'}`}
                        >
                            {isActive ? <Check size={12} strokeWidth={4} /> : <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />}
                        </div>
                    </div>

                    {/* Name Column */}
                    <div className="w-40 px-3 shrink-0 py-2 border-r border-white/5">
                        <div className={`text-[11px] font-bold uppercase tracking-wide truncate ${isActive ? 'text-cyan-300' : 'text-neutral-300'}`}>
                            {layer.name}
                        </div>
                    </div>

                    {/* Visibility */}
                    <div className="w-14 flex justify-center shrink-0 py-2 border-r border-white/5">
                        <button 
                            title="Turn On/Off"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onUpdateLayer(layer.id, { visible: !layer.visible }); 
                            }} 
                            className={`p-1.5 rounded transition-all hover:bg-white/5 ${layer.visible ? 'text-amber-400' : 'text-neutral-700'}`}
                        >
                            {layer.visible ? <Sun size={13} fill="currentColor" /> : <EyeOff size={13} />}
                        </button>
                    </div>

                    {/* Freeze */}
                    <div className="w-14 flex justify-center shrink-0 py-2 border-r border-white/5">
                        <button 
                            title="Freeze/Thaw"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isActive) return;
                                onUpdateLayer(layer.id, { frozen: !layer.frozen }); 
                            }} 
                            className={`p-1.5 rounded transition-all hover:bg-white/5 ${layer.frozen ? 'text-blue-400' : 'text-neutral-700'}`}
                            disabled={isActive}
                        >
                            {layer.frozen ? <Snowflake size={13} strokeWidth={3} /> : <Sun size={12} className="opacity-40 text-neutral-500" />}
                        </button>
                    </div>

                    {/* Lock */}
                    <div className="w-14 flex justify-center shrink-0 py-2 border-r border-white/5">
                        <button 
                            title="Lock/Unlock"
                            onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }} 
                            className={`p-1.5 rounded transition-all hover:bg-white/5 ${layer.locked ? 'text-amber-600' : 'text-neutral-500'}`}
                        >
                            {layer.locked ? <Lock size={13} strokeWidth={3} /> : <Unlock size={13} className="opacity-40 text-neutral-500" />}
                        </button>
                    </div>

                    {/* Color */}
                    <div className="w-16 flex justify-center shrink-0 py-2 border-r border-white/5">
                        <div 
                            title="Change Color"
                            className="relative w-5 h-5 rounded-sm border border-white/20 overflow-hidden bg-black cursor-pointer transition-all hover:scale-110 active:scale-95"
                        >
                            <input 
                                type="color" 
                                value={layer.color} 
                                onClick={e => e.stopPropagation()}
                                onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })} 
                                className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 border-0" 
                            />
                        </div>
                    </div>

                    {/* Linetype */}
                    <div className="w-48 px-2 shrink-0 py-2 flex items-center gap-2 border-r border-white/5">
                        <div className="flex-1 relative group/select">
                            <select 
                                value={layer.lineType} 
                                onClick={e => e.stopPropagation()}
                                onChange={e => onUpdateLayer(layer.id, { lineType: e.target.value as LineType })} 
                                className="w-full bg-[#0d0d0f] border border-white/5 rounded px-2 py-1 text-[9px] text-neutral-400 outline-none uppercase font-bold cursor-pointer appearance-none text-center transition-all hover:border-white/20"
                            >
                                {lineTypes.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                            </select>
                        </div>
                        <div className="w-12 h-6 flex items-center justify-center bg-black/40 rounded border border-white/5 shrink-0">
                            <LineTypePreview type={layer.lineType} color={layer.color} />
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="w-32 px-2 shrink-0 py-2 border-r border-white/5">
                        <select 
                            value={layer.thickness.toFixed(2)} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => onUpdateLayer(layer.id, { thickness: parseFloat(e.target.value) })} 
                            className="w-full bg-[#0d0d0f] border border-white/5 rounded px-2 py-1 text-[9px] text-neutral-400 outline-none font-mono cursor-pointer appearance-none text-center transition-all hover:border-white/20"
                        >
                            {LINE_WEIGHTS.map(w => <option key={w} value={w}>{w}mm</option>)}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex-1 px-4 flex justify-end items-center py-2">
                        {!isActive && !isZero && (
                            <button 
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
