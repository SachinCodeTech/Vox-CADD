
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
  const [activeTab, setActiveTab] = useState<'snaps' | 'grid' | 'units' | 'polar'>('snaps');
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
        <div className={`w-2 h-2 rounded-full transition-all ${active ? 'bg-cyan-400 scale-100' : 'bg-transparent scale-0'}`} />
      </div>
    </button>
  );

  return (
    <div 
      className="relative glass-panel w-full sm:w-[340px] sm:max-w-[95vw] h-full sm:h-auto sm:max-h-[85vh] sm:rounded-[2rem] shadow-[0_50px_120px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/10"
      style={{ transform: window.innerWidth > 640 ? `translate(${pos.x}px, ${pos.y}px)` : undefined, zIndex: 160 }}
    >
      <div 
        className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#1a1a1c] sm:cursor-grab active:sm:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => window.innerWidth > 640 && startDrag(e.clientX, e.clientY)}
        onTouchStart={e => window.innerWidth > 640 && e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Target size={16} />
            </div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.25em]">Drafting Settings</h3>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-all"><X size={20} /></button>
      </div>

      <div className="flex bg-[#1a1a1c] border-b border-white/5 shrink-0">
          <button 
            onClick={() => setActiveTab('snaps')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'snaps' ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <Zap size={12} />
            Snaps
          </button>
          <button 
            onClick={() => setActiveTab('grid')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'grid' ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <LayoutGrid size={12} />
            Grid
          </button>
          <button 
            onClick={() => setActiveTab('units')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'units' ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <Globe size={12} />
            Units
          </button>
          <button 
            onClick={() => setActiveTab('polar')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'polar' ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <Compass size={12} />
            Polar
          </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[70vh] p-6 space-y-8 scrollbar-none bg-[#0d0d0f]">
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
                        <div className="flex gap-2">
                           <div className="flex-1 space-y-1">
                               <span className="text-[7px] text-neutral-500 font-bold uppercase block px-1">Spacing</span>
                               <input 
                                   type="number" 
                                   value={settings.gridSpacing} 
                                   onChange={e => onSettingsChange({ gridSpacing: parseFloat(e.target.value) || 100 })}
                                   className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                               />
                           </div>
                           <div className="flex-1 space-y-1">
                               <span className="text-[7px] text-neutral-500 font-bold uppercase block px-1">Major Lines</span>
                               <input 
                                   type="number" 
                                   value={settings.gridMajorInterval || 5} 
                                   onChange={e => onSettingsChange({ gridMajorInterval: parseInt(e.target.value) || 5 })}
                                   className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                               />
                           </div>
                        </div>
                    </div>
                    <div className="space-y-3 border-t border-white/5 pt-6">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Global Linetype Scale (LTSCALE)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0.001"
                                value={settings.ltScale} 
                                onChange={e => onSettingsChange({ ltScale: parseFloat(e.target.value) || 1.0 })}
                                className="flex-1 bg-black border border-white/10 rounded-xl py-3 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                            />
                            <div className="flex bg-neutral-900 border border-white/5 rounded-xl p-1 gap-1">
                                <button onClick={() => onSettingsChange({ ltScale: 0.5 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">0.5</button>
                                <button onClick={() => onSettingsChange({ ltScale: 1.0 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">1.0</button>
                                <button onClick={() => onSettingsChange({ ltScale: 2.0 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">2.0</button>
                            </div>
                        </div>
                        <p className="text-[7px] text-neutral-500 font-bold uppercase tracking-widest px-1">Adjusts the density of dashed and dotted lines globally.</p>
                    </div>
                </div>
            )}

            {activeTab === 'polar' && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Polar Tracking</label>
                        <button 
                            onClick={() => onSettingsChange({ polarTrackingEnabled: !settings.polarTrackingEnabled })} 
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${settings.polarTrackingEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-neutral-900 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-3">
                                <Compass size={16} />
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Polar Tracking (F10)</span>
                                    <span className="text-[7px] font-bold opacity-60 uppercase">Alignment guides at specific angles</span>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full relative transition-all ${settings.polarTrackingEnabled ? 'bg-cyan-500' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.polarTrackingEnabled ? 'right-1' : 'left-1'}`} />
                            </div>
                         </button>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Increment Angle</label>
                        <select 
                            value={(settings.polarAngles?.[0] || 90).toString()}
                            onChange={e => {
                                const base = parseFloat(e.target.value);
                                const angles = [];
                                angles.push(base);
                                onSettingsChange({ polarAngles: angles });
                            }}
                            className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-bold tracking-tight focus:border-cyan-500 outline-none appearance-none"
                        >
                            <option value="90">90</option>
                            <option value="45">45, 90, 135, 180...</option>
                            <option value="30">30, 60, 90, 120...</option>
                            <option value="22.5">22.5, 45, 67.5...</option>
                            <option value="15">15, 30, 45, 60...</option>
                            <option value="10">10, 20, 30, 40...</option>
                            <option value="5">5, 10, 15, 20...</option>
                        </select>
                    </div>
                </div>
            )}

            {activeTab === 'units' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Linear System</label>
                            <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/5">
                                <button onClick={() => onSettingsChange({ units: 'metric' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'metric' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}>Metric</button>
                                <button onClick={() => onSettingsChange({ units: 'imperial' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'imperial' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}>Imperial</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Active Subunit</label>
                            <select 
                                value={settings.unitSubtype}
                                onChange={e => onSettingsChange({ unitSubtype: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-bold tracking-tight focus:border-cyan-500 outline-none appearance-none"
                            >
                                {settings.units === 'metric' ? (
                                    <>
                                        <option value="mm">MILLIMETERS</option>
                                        <option value="cm">CENTIMETERS</option>
                                        <option value="m">METERS</option>
                                        <option value="km">KILOMETERS</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="inches">INCHES</option>
                                        <option value="feet">FEET</option>
                                        <option value="yards">YARDS</option>
                                        <option value="miles">MILES</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Linear Format</label>
                            <select 
                                value={settings.linearFormat}
                                onChange={e => onSettingsChange({ linearFormat: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-bold tracking-tight focus:border-cyan-500 outline-none appearance-none"
                            >
                                <option value="decimal">DECIMAL</option>
                                <option value="architectural">ARCHITECTURAL</option>
                                <option value="engineering">ENGINEERING</option>
                                <option value="fractional">FRACTIONAL</option>
                                <option value="scientific">SCIENTIFIC</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Precision</label>
                            <select 
                                value={settings.precision}
                                onChange={e => onSettingsChange({ precision: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-mono focus:border-cyan-500 outline-none appearance-none"
                            >
                                {(settings.linearFormat === 'architectural' || settings.linearFormat === 'fractional' ? ['1"', '1/2"', '1/4"', '1/8"', '1/16"', '1/32"', '1/64"', '1/128"', '1/256"'] : ['0', '0.0', '0.00', '0.000', '0.0000', '0.00000', '0.000000', '0.0000000', '0.00000000']).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Angular Format</label>
                            <select 
                                value={settings.angularFormat}
                                onChange={e => onSettingsChange({ angularFormat: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-bold tracking-tight focus:border-cyan-500 outline-none appearance-none"
                            >
                                <option value="decimalDegrees">DEC DEGREES</option>
                                <option value="degMinSec">DMS</option>
                                <option value="grads">GRADS</option>
                                <option value="radians">RADIANS</option>
                                <option value="surveyors">SURVEYORS</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Angle Precision</label>
                            <select 
                                value={settings.anglePrecision}
                                onChange={e => onSettingsChange({ anglePrecision: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-mono focus:border-cyan-500 outline-none appearance-none"
                            >
                                {['0', '0.0', '0.00', '0.000', '0.0000', '0.00000', '0.000000', '0.0000000'].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-white/5 pt-6">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Display Options</label>
                         <button 
                            onClick={() => onSettingsChange({ showDualUnits: !settings.showDualUnits })} 
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${settings.showDualUnits ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-neutral-900 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-3">
                                <Maximize size={16} />
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Dual Unit Overlay</span>
                                    <span className="text-[7px] font-bold opacity-60 uppercase">Shows metric & imperial simultaneously</span>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full relative transition-all ${settings.showDualUnits ? 'bg-cyan-500' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.showDualUnits ? 'right-1' : 'left-1'}`} />
                            </div>
                         </button>
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
