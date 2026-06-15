
import React, { useState, useRef, useEffect } from 'react';
import { X, Square, Triangle, Circle, Target, Hash, MousePointer2, Zap, LayoutGrid, CheckSquare, XSquare, Ruler, Settings2, Globe, Equal, Maximize, Compass, Pentagon, Scissors, Palette, Users } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'snaps' | 'grid' | 'units' | 'polar' | 'view' | 'constraints'>('snaps');
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
      className={`flex items-center gap-3 w-full text-left group px-3 py-1.5 rounded-lg transition-all border no-tap ${active ? 'bg-cyan-500/5 border-cyan-500/10' : 'border-transparent hover:bg-white/5'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => toggleSnap(id)}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${active ? 'bg-cyan-500 text-black' : 'bg-neutral-800 text-neutral-500'}`}>
        <Icon size={12} strokeWidth={3} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <span className={`text-[9px] font-black uppercase tracking-wide transition-colors truncate ${active ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}`}>
          {label}
        </span>
      </div>
      <div className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center shrink-0 ${active ? 'bg-cyan-500 border-cyan-400' : 'border-neutral-700 bg-neutral-900/50'}`}>
        {active && <div className="w-1 h-1 bg-black rounded-full" />}
      </div>
    </button>
  );

  const navItems = [
    { id: 'snaps', label: 'Snaps', icon: Zap },
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'view', label: 'View', icon: Settings2 },
    { id: 'units', label: 'Units', icon: Globe },
    { id: 'polar', label: 'Polar', icon: Compass },
    { id: 'constraints', label: 'Constraints', icon: Equal }
  ];

  return (
    <div 
      className="relative glass-panel w-[94vw] sm:w-[480px] sm:max-w-[95vw] h-[82vh] sm:h-auto sm:max-h-[85vh] rounded-3xl shadow-[0_50px_120px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/10"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 160 }}
    >
      <div 
        className="flex justify-between items-center px-8 py-5 border-b border-white/5 bg-[#1a1a1c] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Target size={18} />
            </div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Drafting Settings</h3>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-all"><X size={22} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Vertical Tabs Sidebar */}
        <div className="w-[75px] bg-[#1a1a1c] border-r border-white/5 flex flex-col shrink-0">
          {navItems.map(item => (
             <button 
               key={item.id}
               onClick={() => setActiveTab(item.id as any)}
               className={`flex flex-col items-center justify-center gap-1.5 py-5 text-[7px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === item.id ? 'text-cyan-400 bg-cyan-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}
             >
               {activeTab === item.id && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-cyan-500 rounded-r-full" />}
               <item.icon size={14} />
               <span>{item.label}</span>
             </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-none bg-[#0d0d0f]">
            {activeTab === 'snaps' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Geometric Anchors</label>
                        <div className="grid grid-cols-1 gap-1">
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
                        </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-white/5">
                        <button onClick={() => setAllSnaps(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-900 border border-white/5 rounded-xl text-[8px] font-black uppercase text-neutral-400 hover:text-white transition-all"><CheckSquare size={12} /> Select All</button>
                        <button onClick={() => setAllSnaps(false)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-900 border border-white/5 rounded-xl text-[8px] font-black uppercase text-neutral-400 hover:text-white transition-all"><XSquare size={12} /> Clear None</button>
                    </div>
                </div>
            )}

            {activeTab === 'constraints' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Automatic Relations</label>
                        <button 
                            type="button"
                            onClick={() => onSettingsChange({ geometricConstraintsEnabled: !settings.geometricConstraintsEnabled })} 
                            className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${settings.geometricConstraintsEnabled ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-4">
                                <Equal size={20} />
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Auto Constraints</span>
                                    <span className="text-[7.5px] font-bold opacity-65 uppercase">Influence new line segments</span>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full relative transition-all ${settings.geometricConstraintsEnabled ? 'bg-cyan-500' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg transition-all ${settings.geometricConstraintsEnabled ? 'right-1' : 'left-1'}`} />
                            </div>
                         </button>
                    </div>

                    <div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="text-[8px] font-black text-neutral-400 uppercase tracking-wider">Active Rule Engines</div>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between opacity-80 pl-2">
                                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                    <span>PERPENDICULARITY</span>
                                </div>
                                <span className="text-[7.5px] font-bold text-neutral-500 uppercase">90° SNAP INFLUENCE</span>
                            </div>
                            <div className="flex items-center justify-between opacity-80 pl-2">
                                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                    <span>PARALLELISM</span>
                                </div>
                                <span className="text-[7.5px] font-bold text-neutral-500 uppercase">0° / 180° RELATIONS</span>
                            </div>
                            <div className="flex items-center justify-between opacity-80 pl-2">
                                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                                    <span>HORIZONTAL / VERTICAL</span>
                                </div>
                                <span className="text-[7.5px] font-bold text-neutral-500 uppercase">AXIAL AUTO-ALIGNMENT</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-[#141416] border border-white/5 rounded-xl text-[8px] text-neutral-500 font-bold uppercase tracking-wider leading-relaxed">
                        <span className="text-cyan-400 font-extrabold block mb-1">PRO-DRAFTING TIP</span>
                        When enabled, drawing lines near perpendicular/parallel angles to nearby shapes automatically locks them to exact constraints.
                    </div>
                </div>
            )}

            {activeTab === 'view' && (
               <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                 <div className="space-y-4">
                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Workspace Modes</label>
                    <div className="grid grid-cols-2 bg-neutral-950 p-1.5 rounded-2xl border border-white/5 gap-1.5">
                        <button 
                            onClick={() => onSettingsChange({ showCtbInView: false })} 
                            className={`py-3.5 rounded-xl text-[9px] font-black uppercase transition-all ${!settings.showCtbInView ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
                        >
                            Layer Mode
                        </button>
                        <button 
                            onClick={() => onSettingsChange({ showCtbInView: true })} 
                            className={`py-3.5 rounded-xl text-[9px] font-black uppercase transition-all ${settings.showCtbInView ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
                        >
                            CTB Mode
                        </button>
                    </div>
                 </div>

                  <div className="space-y-4">
                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Visibility Toggles</label>
                    <div className="grid grid-cols-2 gap-2">
                       <button 
                        onClick={() => onSettingsChange({ showLineWeights: !settings.showLineWeights })} 
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${settings.showLineWeights ? 'bg-cyan-500/5 border-cyan-500/10 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                       >
                          <Ruler size={14} />
                          <span className="text-[6.5px] font-black uppercase tracking-widest">Weight</span>
                       </button>
                       <button 
                        onClick={() => onSettingsChange({ showHUD: !settings.showHUD })} 
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${settings.showHUD ? 'bg-cyan-500/5 border-cyan-500/10 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                       >
                          <Settings2 size={14} />
                          <span className="text-[6.5px] font-black uppercase tracking-widest">HUD</span>
                       </button>
                       <button 
                        onClick={() => onSettingsChange({ aiSuggestionsEnabled: !settings.aiSuggestionsEnabled })} 
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${settings.aiSuggestionsEnabled ? 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                       >
                          <Zap size={14} className={settings.aiSuggestionsEnabled ? "animate-pulse" : ""} />
                          <span className="text-[6.5px] font-black uppercase tracking-widest">AI SUGGEST</span>
                       </button>
                       <button 
                        onClick={() => onSettingsChange({ showSimulatedCollaborators: !settings.showSimulatedCollaborators })} 
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${settings.showSimulatedCollaborators !== false ? 'bg-cyan-500/5 border-cyan-500/10 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                       >
                          <Users size={14} />
                          <span className="text-[6.5px] font-black uppercase tracking-widest">SIM PEERS</span>
                       </button>
                    </div>
                 </div>
               </div>
            )}

            {activeTab === 'grid' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Grid Controls</label>
                        <div className="grid grid-cols-3 gap-2">
                             <button onClick={() => onSettingsChange({ grid: !settings.grid })} className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.grid ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}>
                                <LayoutGrid size={20} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Display</span>
                             </button>
                             <button onClick={() => onSettingsChange({ ortho: !settings.ortho })} className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.ortho ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}>
                                <Hash size={20} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Ortho</span>
                             </button>
                             <button onClick={() => onSettingsChange({ gridSnap: !settings.gridSnap })} className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.gridSnap ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}>
                                <Target size={20} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Snap (F9)</span>
                             </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Advanced Grid Mode</label>
                        <button 
                            type="button"
                            onClick={() => onSettingsChange({ isometricGrid: !settings.isometricGrid })} 
                            className={`w-full flex items-between items-center p-5 rounded-2xl border transition-all cursor-pointer ${settings.isometricGrid ? 'bg-[#00bcd4]/10 border-[#00bcd4]/20 text-[#00bcd4]' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-4">
                                <LayoutGrid size={20} className={settings.isometricGrid ? "rotate-45" : ""} />
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Isometric Drafting Grid</span>
                                    <span className="text-[7.5px] font-bold opacity-65 uppercase">30°/60° plane snap and rendering support</span>
                                </div>
                            </div>
                            <div className="ml-auto">
                                <div className={`w-10 h-5 rounded-full relative transition-all ${settings.isometricGrid ? 'bg-[#00bcd4]' : 'bg-neutral-800'}`}>
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg transition-all ${settings.isometricGrid ? 'right-1' : 'left-1'}`} />
                                </div>
                            </div>
                         </button>
                    </div>
                    <div className="space-y-4">
                        <button 
                            type="button"
                            onClick={() => onSettingsChange({ unlimitedGrid: !settings.unlimitedGrid })} 
                            className={`w-full flex justify-between items-center p-5 rounded-2xl border transition-all cursor-pointer ${settings.unlimitedGrid !== false ? 'bg-[#00bcd4]/10 border-[#00bcd4]/20 text-[#00bcd4]' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-4">
                                <Compass size={20} />
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Unlimited Grid Area</span>
                                    <span className="text-[7.5px] font-bold opacity-65 uppercase">Display grid dynamically past traditional drawing or limits bounds</span>
                                </div>
                            </div>
                            <div className="ml-auto">
                                <div className={`w-10 h-5 rounded-full relative transition-all ${settings.unlimitedGrid !== false ? 'bg-[#00bcd4]' : 'bg-neutral-800'}`}>
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg transition-all ${settings.unlimitedGrid !== false ? 'right-1' : 'left-1'}`} />
                                </div>
                            </div>
                         </button>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Spacing Values</label>
                        <div className="grid grid-cols-3 gap-3">
                           <div className="space-y-2">
                               <input 
                                   type="number" 
                                   value={settings.gridSpacing} 
                                   onChange={e => onSettingsChange({ gridSpacing: parseFloat(e.target.value) || 100 })}
                                   className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                               />
                               <span className="text-[7px] text-neutral-500 font-black uppercase block text-center">Interval</span>
                           </div>
                           <div className="space-y-2">
                               <input 
                                   type="number" 
                                   value={settings.snapSpacing} 
                                   onChange={e => onSettingsChange({ snapSpacing: parseFloat(e.target.value) || 10 })}
                                   className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                               />
                               <span className="text-[7px] text-neutral-500 font-black uppercase block text-center">Snap Spacing</span>
                           </div>
                           <div className="space-y-2">
                               <input 
                                   type="number" 
                                   value={settings.gridMajorInterval || 5} 
                                   onChange={e => onSettingsChange({ gridMajorInterval: parseInt(e.target.value) || 5 })}
                                   className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none" 
                               />
                               <span className="text-[7px] text-neutral-500 font-black uppercase block text-center">Major Segments</span>
                           </div>
                        </div>
                    </div>
                    <div className="space-y-4 border-t border-white/5 pt-6 text-center">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em]">Global Linetype Density</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0.001"
                                value={settings.ltScale} 
                                onChange={e => onSettingsChange({ ltScale: parseFloat(e.target.value) || 1.0 })}
                                className="flex-1 bg-black border border-white/10 rounded-xl py-4 px-5 text-xs text-cyan-400 font-mono focus:border-white/30 outline-none" 
                            />
                            <div className="flex bg-neutral-950 border border-white/5 rounded-xl p-1 gap-1">
                                <button onClick={() => onSettingsChange({ ltScale: 0.5 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">0.5</button>
                                <button onClick={() => onSettingsChange({ ltScale: 1.0 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">1.0</button>
                                <button onClick={() => onSettingsChange({ ltScale: 2.0 })} className="px-3 py-1 text-[8px] font-black text-neutral-500 hover:text-white transition-all uppercase">2.0</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'polar' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Radial Alignment</label>
                        <button 
                            onClick={() => onSettingsChange({ polarTrackingEnabled: !settings.polarTrackingEnabled })} 
                            className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${settings.polarTrackingEnabled ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-neutral-900/50 border-white/5 text-neutral-600'}`}
                         >
                            <div className="flex items-center gap-4">
                                <Compass size={20} />
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Polar Tracking</span>
                                    <span className="text-[7px] font-bold opacity-50 uppercase">Lock angles on draft</span>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full relative transition-all ${settings.polarTrackingEnabled ? 'bg-cyan-500' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg transition-all ${settings.polarTrackingEnabled ? 'right-1' : 'left-1'}`} />
                            </div>
                         </button>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Angular Resolution</label>
                        <div className="relative">
                            <select 
                                value={(settings.polarAngles?.[0] || 90).toString()}
                                onChange={e => {
                                    const base = parseFloat(e.target.value);
                                    const angles = [base];
                                    onSettingsChange({ polarAngles: angles });
                                }}
                                className="w-full bg-black border border-white/10 rounded-xl py-4 px-5 text-[10px] text-white font-bold tracking-widest focus:border-white/30 outline-none appearance-none cursor-pointer"
                            >
                                <option value="90">90.0 DEGREES</option>
                                <option value="45">45.0 DEGREES</option>
                                <option value="30">30.0 DEGREES</option>
                                <option value="22.5">22.5 DEGREES</option>
                                <option value="15">15.0 DEGREES</option>
                                <option value="10">10.0 DEGREES</option>
                                <option value="5">05.0 DEGREES</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600">
                                <Compass size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'units' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Systems</label>
                            <div className="flex bg-neutral-950 p-1 rounded-xl border border-white/5">
                                <button onClick={() => onSettingsChange({ units: 'metric' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'metric' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>Metric</button>
                                <button onClick={() => onSettingsChange({ units: 'imperial' })} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase transition-all ${settings.units === 'imperial' ? 'bg-cyan-600 text-black' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>Imp</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Scale Unit</label>
                            <select 
                                value={settings.unitSubtype}
                                onChange={e => onSettingsChange({ unitSubtype: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[9px] text-white font-black tracking-widest focus:border-white/20 outline-none appearance-none"
                            >
                                {settings.units === 'metric' ? (
                                    <>
                                        <option value="mm">MILLIMETERS</option>
                                        <option value="cm">CENTIMETERS</option>
                                        <option value="m">METERS</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="inches">INCHES</option>
                                        <option value="feet">FEET</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Format</label>
                            <select 
                                value={settings.linearFormat}
                                onChange={e => onSettingsChange({ linearFormat: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[9px] text-white font-black tracking-widest focus:border-white/20 outline-none appearance-none"
                            >
                                <option value="decimal">DECIMAL</option>
                                <option value="architectural">ARCH</option>
                                <option value="engineering">ENG</option>
                                <option value="fractional">FRAC</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Rounding</label>
                            <select 
                                value={settings.precision}
                                onChange={e => onSettingsChange({ precision: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[9px] text-white font-mono focus:border-white/20 outline-none appearance-none"
                            >
                                {(settings.linearFormat === 'architectural' || settings.linearFormat === 'fractional' ? ['1"', '1/2"', '1/4"', '1/8"', '1/16"', '1/32"', '1/64"'] : ['0', '0.0', '0.00', '0.000', '0.0000']).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Angle Mode</label>
                            <select 
                                value={settings.angularFormat}
                                onChange={e => onSettingsChange({ angularFormat: e.target.value as any })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[9px] text-white font-black tracking-widest focus:border-white/20 outline-none appearance-none"
                            >
                                <option value="decimalDegrees">DEGREES</option>
                                <option value="radians">RADIANS</option>
                                <option value="grads">GRADS</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em] px-1">Angle Prec</label>
                            <select 
                                value={settings.anglePrecision}
                                onChange={e => onSettingsChange({ anglePrecision: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-[9px] text-white font-mono focus:border-white/20 outline-none appearance-none"
                            >
                                {['0', '0.0', '0.00', '0.000'].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="p-6 bg-[#1a1a1c] border-t border-white/5 flex justify-end shrink-0">
        <button onClick={onClose} className="px-12 py-4 bg-cyan-600 text-black text-[10px] font-black uppercase rounded-2xl shadow-2xl shadow-cyan-950/20 active:scale-95 transition-all">Apply Settings</button>
      </div>
    </div>
  );
};

export default DraftingSettings;
