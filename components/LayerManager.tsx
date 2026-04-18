
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
  ];

  return (
    <div 
        className="fixed left-1/2 top-10 -translate-x-1/2 w-[520px] max-w-[98vw] glass-panel rounded-[1.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 border border-white/5"
        style={{ transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`, zIndex: 150 }}
    >
      <div 
        className="flex justify-between items-center px-5 py-3 border-b border-white/5 bg-[#121214] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Layers size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">Layers</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 hover:text-white transition-all"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-x-auto bg-[#0a0a0c] scrollbar-thin">
        <div className="min-w-[600px] flex flex-col">
          {/* Header Row */}
          <div className="flex items-center text-[8px] text-neutral-600 font-bold uppercase border-b border-white/5 bg-[#0a0a0c] sticky top-0 z-10 select-none">
              <div className="w-10 text-center py-2 shrink-0">Stat</div>
              <div className="w-32 px-3 py-2 shrink-0">Layer Name</div>
              <div className="w-12 text-center py-2 shrink-0">On</div>
              <div className="w-12 text-center py-2 shrink-0">Frz</div>
              <div className="w-12 text-center py-2 shrink-0">Lck</div>
              <div className="w-14 text-center py-2 shrink-0">Color</div>
              <div className="w-28 text-center py-2 shrink-0">Line Type</div>
              <div className="w-24 text-center py-2 shrink-0">Weight</div>
              <div className="flex-1 py-2"></div>
          </div>

          <div className="overflow-y-auto max-h-[40vh] scrollbar-none">
            {Object.values(layers).map((layer: LayerConfig) => {
                const isActive = activeLayer === layer.id;
                return (
                  <div 
                    key={layer.id}
                    className={`flex items-center transition-all border-b border-white/[0.03] no-tap group ${isActive ? 'bg-cyan-500/[0.04]' : 'hover:bg-neutral-800/30'}`}
                    onClick={() => onSetActive(layer.id)}
                  >
                    {/* Status Column */}
                    <div className="w-10 flex justify-center shrink-0 py-1.5">
                        <div className={`w-5 h-5 flex items-center justify-center rounded transition-all ${isActive ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'bg-neutral-900 text-neutral-700'}`}>
                            {isActive && <Check size={12} strokeWidth={4} />}
                        </div>
                    </div>

                    {/* Name Column */}
                    <div className="w-32 px-3 shrink-0 py-1.5">
                        <div className={`text-[11px] font-black uppercase tracking-tight truncate ${isActive ? 'text-cyan-400' : 'text-neutral-400'}`}>
                            {layer.name}
                        </div>
                    </div>

                    {/* Visibility */}
                    <div className="w-12 flex justify-center shrink-0 py-1.5">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }} 
                            className={`p-1.5 rounded transition-all ${layer.visible ? 'text-cyan-500 bg-cyan-500/5' : 'text-neutral-800 bg-neutral-900'}`}
                        >
                            <Sun size={13} fill={layer.visible ? "currentColor" : "none"} />
                        </button>
                    </div>

                    {/* Freeze */}
                    <div className="w-12 flex justify-center shrink-0 py-1.5">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { frozen: !layer.frozen }); }} 
                            className={`p-1.5 rounded transition-all ${layer.frozen ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-800 bg-neutral-900'}`}
                        >
                            {layer.frozen ? <Snowflake size={13} strokeWidth={3} /> : <Sun size={12} className="opacity-20" />}
                        </button>
                    </div>

                    {/* Lock */}
                    <div className="w-12 flex justify-center shrink-0 py-1.5">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }} 
                            className={`p-1.5 rounded transition-all ${layer.locked ? 'text-amber-500 bg-amber-500/10' : 'text-neutral-800 bg-neutral-900'}`}
                        >
                            {layer.locked ? <Lock size={13} strokeWidth={3} /> : <Unlock size={13} className="opacity-20" />}
                        </button>
                    </div>

                    {/* Color */}
                    <div className="w-14 flex justify-center shrink-0 py-1.5">
                        <div className="relative w-5 h-5 rounded-sm border border-white/10 overflow-hidden bg-black shadow-inner">
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
                    <div className="w-28 px-2 shrink-0 py-1.5">
                        <select 
                            value={layer.lineType} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => onUpdateLayer(layer.id, { lineType: e.target.value as LineType })} 
                            className="w-full bg-neutral-950 border border-white/5 rounded px-2 py-1 text-[9px] text-neutral-500 outline-none uppercase font-black cursor-pointer appearance-none text-center hover:border-white/10"
                        >
                            {lineTypes.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                        </select>
                    </div>

                    {/* Weight */}
                    <div className="w-24 px-2 shrink-0 py-1.5">
                        <select 
                            value={layer.thickness.toFixed(2)} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => onUpdateLayer(layer.id, { thickness: parseFloat(e.target.value) })} 
                            className="w-full bg-neutral-950 border border-white/5 rounded px-2 py-1 text-[9px] text-neutral-500 outline-none font-mono cursor-pointer appearance-none text-center hover:border-white/10"
                        >
                            {LINE_WEIGHTS.map(w => <option key={w} value={w}>{w}mm</option>)}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex-1 px-4 flex justify-end items-center py-1.5">
                        {layer.id !== '0' && layer.id !== 'defpoints' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveLayer(layer.id); }} 
                                className="text-neutral-800 hover:text-red-500 p-1.5 hover:bg-red-500/5 rounded-full transition-all opacity-0 group-hover:opacity-100"
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
