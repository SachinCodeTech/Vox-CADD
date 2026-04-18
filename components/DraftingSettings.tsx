
import React, { useState, useRef, useEffect } from 'react';
import { X, Square, Triangle, Circle, Target, Hash, MousePointer2, Zap, LayoutGrid, CheckSquare, XSquare, Ruler, Settings2, Globe, Equal, Maximize, Compass, Pentagon, Scissors } from 'lucide-react';
import { SnapOptions, AppSettings } from '../types';

interface DraftingSettingsProps {
  options: SnapOptions;
  settings: AppSettings;
  onChange: (updates: Partial<SnapOptions>) => void;
  onSettingsChange: (updates: Partial<AppSettings>) => void;
  onClose: () => void;
}

const DraftingSettings: React.FC<DraftingSettingsProps> = ({ options, settings, onChange, onSettingsChange, onClose }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'snaps' | 'grid' | 'units'>('snaps');
  const [isInteracting, setIsInteracting] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      setPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handleEnd = () => { 
        isDragging.current = false;
        setIsInteracting(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    isDragging.current = true;
    setIsInteracting(true);
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const toggleSnap = (key: keyof SnapOptions) => {
    onChange({ [key]: !options[key] });
  };

  const setAllSnaps = (val: boolean) => {
    const updates: Partial<SnapOptions> = {};
    (Object.keys(options) as (keyof SnapOptions)[]).forEach(k => {
      updates[k] = val;
    });
    onChange(updates);
  };

  const SnapItem = ({ id, label, active, icon: Icon }: { id: keyof SnapOptions, label: string, active: boolean, icon: any }) => (
    <button 
      type="button"
      className={`flex items-center gap-3 w-full text-left group px-3 py-2.5 rounded-xl transition-all border no-tap ${active ? 'bg-cyan-500/10 border-cyan-500/20' : 'border-transparent hover:bg-neutral-800/50'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => toggleSnap(id)}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${active ? 'bg-cyan-500 text-black' : 'bg-neutral-800 text-neutral-500'}`}>
        <Icon size={14} strokeWidth={3} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <span className={`text-[11px] font-black uppercase tracking-tight transition-colors truncate ${active ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}`}>
          {label}
        </span>
      </div>
      <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shrink-0 ${active ? 'bg-cyan-500/20 border-cyan-500' : 'border-neutral-700 bg-neutral-900/50'}`}>
        <div className={`w-2 h-2 rounded-full transition-all ${active ? 'bg-cyan-400 scale-100 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-transparent scale-0'}`} />
      </div>
    </button>
  );

  return (
    <div 
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] glass-panel rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
        style={{ 
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
            zIndex: isInteracting ? 9999 : 500
        }}
        onPointerDown={() => setIsInteracting(true)}
      >
        <div 
          className="p-5 border-b border-white/5 bg-white/5 cursor-grab active:cursor-grabbing touch-none flex justify-between items-center"
          onPointerDown={e => { e.stopPropagation(); startDrag(e.clientX, e.clientY); }}
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <Target size={18} className="text-cyan-500" />
            <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Drafting Dashboard</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors cursor-pointer"><X size={18} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-black border-b border-white/5 p-1 shrink-0">
            <button onClick={() => setActiveTab('snaps')} className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${activeTab === 'snaps' ? 'bg-white/5 text-cyan-400' : 'text-neutral-600'}`}>
                <Zap size={14} />
                <span className="text-[7px] font-black uppercase mt-1">Snaps</span>
            </button>
            <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${activeTab === 'grid' ? 'bg-white/5 text-cyan-400' : 'text-neutral-600'}`}>
                <LayoutGrid size={14} />
                <span className="text-[7px] font-black uppercase mt-1">Grid</span>
            </button>
            <button onClick={() => setActiveTab('units')} className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${activeTab === 'units' ? 'bg-white/5 text-cyan-400' : 'text-neutral-600'}`}>
                <Globe size={14} />
                <span className="text-[7px] font-black uppercase mt-1">Units</span>
            </button>
        </div>

        <div className="px-4 py-4 max-h-[50vh] overflow-y-auto scrollbar-none bg-[#0a0a0c]">
            {activeTab === 'snaps' && (
                <div className="grid grid-cols-1 gap-1.5">
                    <SnapItem id="endpoint" label="Endpoint" icon={Square} active={options.endpoint} />
                    <SnapItem id="midpoint" label="Midpoint" icon={Triangle} active={options.midpoint} />
                    <SnapItem id="center" label="Center" icon={Circle} active={options.center} />
                    <SnapItem id="quadrant" label="Quadrant" icon={Hash} active={options.quadrant} />
                    <SnapItem id="intersection" label="Intersection" icon={X} active={options.intersection} />
                    <SnapItem id="perpendicular" label="Perpendicular" icon={LayoutGrid} active={options.perpendicular} />
                    <SnapItem id="node" label="Node" icon={Target} active={options.node} />
                    <SnapItem id="nearest" label="Nearest" icon={MousePointer2} active={options.nearest} />
                    <SnapItem id="tangent" label="Tangent" icon={Compass} active={options.tangent} />
                    <SnapItem id="extension" label="Extension" icon={Maximize} active={options.extension} />
                    <SnapItem id="parallel" label="Parallel" icon={Equal} active={options.parallel} />
                    <SnapItem id="gcenter" label="Geometric Center" icon={Pentagon} active={options.gcenter} />
                    <SnapItem id="appint" label="Apparent Intersection" icon={Scissors} active={options.appint} />
                    
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <button onClick={() => setAllSnaps(true)} className="flex items-center justify-center gap-2 py-3 bg-neutral-900 border border-white/5 rounded-xl text-[9px] font-black uppercase text-neutral-400 hover:text-white transition-all"><CheckSquare size={12} /> All</button>
                        <button onClick={() => setAllSnaps(false)} className="flex items-center justify-center gap-2 py-3 bg-neutral-900 border border-white/5 rounded-xl text-[9px] font-black uppercase text-neutral-400 hover:text-white transition-all"><XSquare size={12} /> None</button>
                    </div>
                </div>
            )}

            {activeTab === 'grid' && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Grid & Constrains</label>
                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => onSettingsChange({ grid: !settings.grid })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.grid ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-neutral-900 border-white/5 text-neutral-600'}`}>
                                <LayoutGrid size={18} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Grid Vis</span>
                             </button>
                             <button onClick={() => onSettingsChange({ ortho: !settings.ortho })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.ortho ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-neutral-900 border-white/5 text-neutral-600'}`}>
                                <Hash size={18} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Ortho</span>
                             </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Grid Spacing</label>
                        <input 
                            type="number" 
                            value={settings.gridSpacing} 
                            onChange={e => onSettingsChange({ gridSpacing: parseFloat(e.target.value) || 100 })}
                            className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                        />
                    </div>
                </div>
            )}

            {activeTab === 'units' && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Linear System</label>
                        <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/5">
                            <button onClick={() => onSettingsChange({ units: 'metric' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'metric' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}>Metric</button>
                            <button onClick={() => onSettingsChange({ units: 'imperial' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'imperial' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}>Imperial</button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Decimal Precision</label>
                        <select 
                            value={settings.precision}
                            onChange={e => onSettingsChange({ precision: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-xs text-white font-mono focus:border-cyan-500 outline-none appearance-none"
                        >
                            {(settings.units === 'metric' ? ['0', '0.0', '0.00', '0.000', '0.0000'] : ['1"', '1/2"', '1/4"', '1/8"', '1/16"', '1/32"', '1/64"']).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 bg-black border-t border-white/5 flex justify-end">
          <button onClick={onClose} className="px-10 py-3.5 bg-cyan-600 text-black text-[10px] font-black uppercase rounded-xl shadow-xl shadow-cyan-950/20 active:scale-95 transition-all">OK</button>
        </div>
      </div>
  );
};

export default DraftingSettings;
