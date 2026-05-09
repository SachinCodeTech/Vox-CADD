import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Settings2, Trash2, Plus, Info, ChevronDown, Palette, Edit3 } from 'lucide-react';
import { AppSettings, CtbFile, CtbPlotStyle, LineType } from '../types';
import { createAcadCtb, createDefaultCtb, getDefaultLineweights } from '../services/ctbService';
import { aciColors, hexToRgbStr } from '../services/colorUtils';

interface CtbManagerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenColorSelector: (currentColor: string, onSelect: (color: string) => void, title?: string) => void;
}

const CtbManager: React.FC<CtbManagerProps> = ({ isOpen, onClose, settings, onUpdateSettings, onOpenColorSelector }) => {
  const [editingCtbId, setEditingCtbId] = useState<string | null>(settings.activeCtbId || 'acad');
  const [selectedAci, setSelectedAci] = useState<number>(1);
  const [activeView, setActiveView] = useState<'files' | 'colors' | 'edit'>('colors');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Sync editing ID if active CTB changes
    if (settings.activeCtbId && !editingCtbId) {
      setEditingCtbId(settings.activeCtbId);
    }
  }, [settings.activeCtbId]);

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
  
  if (!isOpen) return null;

  const ctbFiles = (settings.ctbFiles || {}) as Record<string, CtbFile>;
  const activeCtb = editingCtbId ? ctbFiles[editingCtbId] : null;

  const handleCreateCtb = () => {
    const id = `ctb_${Date.now()}`;
    const file = createAcadCtb();
    file.id = id;
    file.name = "New Plot Style.ctb";
    
    const newFiles = { ...ctbFiles, [id]: file };
    onUpdateSettings({ ...settings, ctbFiles: newFiles, activeCtbId: id });
    setEditingCtbId(id);
    setRenamingId(id);
    setNewName("New Plot Style.ctb");
  };

  const handleRename = (id: string) => {
    if (!newName.trim()) {
      setRenamingId(null);
      return;
    }
    const currentName = ctbFiles[id]?.name;
    const filename = newName.trim().toLowerCase().endsWith('.ctb') ? newName.trim() : newName.trim() + '.ctb';
    
    if (filename === currentName) {
      setRenamingId(null);
      return;
    }

    const updated = { ...ctbFiles };
    updated[id] = { ...updated[id], name: filename };
    onUpdateSettings({ ...settings, ctbFiles: updated });
    setRenamingId(null);
  };

  const handleDeleteCtb = (id: string) => {
    if (id === 'acad' || id === 'monochrome') return;
    
    const newFiles = { ...ctbFiles };
    delete newFiles[id];
    let nextActive = settings.activeCtbId;
    if (nextActive === id) nextActive = 'acad';
    
    onUpdateSettings({ ...settings, ctbFiles: newFiles, activeCtbId: nextActive });
    if (editingCtbId === id) setEditingCtbId(nextActive);
  };

  const handleUpdateStyle = (aci: number, updates: Partial<CtbPlotStyle>) => {
    if (!editingCtbId || !activeCtb) return;
    
    const newStyles = { ...activeCtb.styles, [aci]: { ...activeCtb.styles[aci], ...updates } };
    const newCtb = { ...activeCtb, styles: newStyles };
    onUpdateSettings({ ...settings, ctbFiles: { ...ctbFiles, [editingCtbId]: newCtb } });
  };

  const lineweights = getDefaultLineweights();
  const currentStyle = activeCtb?.styles[selectedAci];

  return (
    <div 
      className="relative w-full sm:w-[900px] sm:max-w-[95vw] h-full sm:h-[85vh] sm:max-h-[800px] bg-[#0a0a0c] sm:rounded-[2.5rem] shadow-[0_60px_150px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/10 select-none font-sans"
      style={{ transform: window.innerWidth > 640 ? `translate(${pos.x}px, ${pos.y}px)` : undefined, zIndex: 1100 }}
    >
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex h-14 bg-[#121214] border-b border-white/5 shrink-0">
          <button 
            onClick={() => setActiveView('files')}
            className={`flex-1 h-full text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'files' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500'}`}
          >
            Styles
          </button>
          <button 
            onClick={() => setActiveView('colors')}
            className={`flex-1 h-full text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'colors' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500'}`}
          >
            Colors
          </button>
          <button 
            onClick={() => setActiveView('edit')}
            className={`flex-1 h-full text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'edit' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500'}`}
          >
            Settings
          </button>
      </div>

      {/* Dynamic Header */}
      <div 
        className="flex justify-between items-center px-6 sm:px-8 py-4 sm:py-6 border-b border-white/5 bg-[#121214] sm:cursor-grab active:sm:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => window.innerWidth > 640 && startDrag(e.clientX, e.clientY)}
      >
        <div className="flex items-center gap-4 pointer-events-none">
          <div className="w-12 h-12 rounded-[1.2rem] bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
            <Palette size={24} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">Plot Style Manager</h3>
            <p className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5 leading-none">
              <FileText size={10} /> Color-Dependent Control (.CTB)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all"><X size={24} /></button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar: Files */}
        <div className={`${activeView === 'files' ? 'flex' : 'hidden'} md:flex w-full md:w-60 border-b md:border-b-0 md:border-r border-white/5 bg-[#121214]/50 flex-col shrink-0`}>
          <div className="p-4 space-y-2 flex-1 overflow-y-auto scrollbar-none">
             <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-2 mb-3">Available Styles</div>
             {Object.values(ctbFiles).map(ctb => (
              <div 
                key={`ctb-file-${ctb.id}`}
                onClick={() => {
                  setEditingCtbId(ctb.id);
                  if (window.innerWidth < 768) setActiveView('colors');
                }}
                className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${editingCtbId === ctb.id ? 'bg-cyan-500/10 border-cyan-500/30 text-white' : 'bg-black/20 text-neutral-500 border-white/5 hover:border-white/10 hover:text-neutral-400'}`}
              >
                 <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <FileText size={16} className={editingCtbId === ctb.id ? 'text-cyan-400' : 'text-neutral-700'} />
                    {renamingId === ctb.id ? (
                      <input 
                        autoFocus
                        className="bg-black border border-cyan-500/50 rounded-lg px-2 py-1 text-[10px] font-black text-white w-full outline-none uppercase"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onBlur={() => handleRename(ctb.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(ctb.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate text-[10px] font-black uppercase tracking-tight">{ctb.name}</span>
                    )}
                 </div>
                 {ctb.id !== 'acad' && ctb.id !== 'monochrome' && (
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                       onClick={(e) => { e.stopPropagation(); setRenamingId(ctb.id); setNewName(ctb.name); }}
                       className="p-1.5 hover:text-cyan-400"
                     >
                       <Edit3 size={12} />
                     </button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); handleDeleteCtb(ctb.id); }}
                       className="p-1.5 hover:text-red-500"
                     >
                       <Trash2 size={12} />
                     </button>
                   </div>
                 )}
              </div>
            ))}
          </div>
          <div className="p-4 bg-[#121214] border-t border-white/5">
            <button 
              onClick={handleCreateCtb}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-neutral-400 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              <Plus size={14} /> New Plot Style
            </button>
          </div>
        </div>

        {/* Center: ACI Grid */}
        <div className={`${activeView === 'colors' ? 'flex' : 'hidden'} md:flex w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-black/40 flex-col shrink-0`}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#121214]/50">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Select Color</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-900/20 rounded">ACI {selectedAci}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-5 sm:grid-cols-10 md:grid-cols-4 lg:grid-cols-5 gap-1.5 scrollbar-none content-start bg-[#0a0a0c]">
                {aciColors.map((color, i) => {
                    const aci = i;
                    if (aci === 0) return null; // Skip ByBlock index 0 for now
                    return (
                        <button 
                            key={`ctb-aci-btn-${aci}`}
                            onClick={() => {
                              setSelectedAci(aci);
                              if (window.innerWidth < 768) setActiveView('edit');
                            }}
                            className={`aspect-square rounded-lg transition-all relative group flex items-center justify-center border ${selectedAci === aci ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-black scale-110 z-10' : 'border-white/5 hover:border-white/20'}`}
                            style={{ backgroundColor: color }}
                            title={`ACI ${aci}: ${hexToRgbStr(color)}`}
                        >
                            <span className="text-[7px] font-black text-white mix-blend-difference pointer-events-none opacity-0 group-hover:opacity-100">{aci}</span>
                            {selectedAci === aci && <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Right Area: Detailed Style Editor */}
        <div className={`${activeView === 'edit' ? 'flex' : 'hidden'} md:flex flex-1 bg-[#0a0a0c] flex-col overflow-hidden`}>
          {activeCtb && currentStyle ? (
            <>
              <div className="p-4 sm:p-6 bg-[#121214] border-b border-white/5 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
                 <div className="flex items-center gap-5 w-full sm:w-auto">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-[3px] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: aciColors[selectedAci] }}>
                        <span className="text-[9px] sm:text-[11px] font-black text-white mix-blend-difference">{selectedAci}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-black text-base sm:text-lg uppercase tracking-tight mb-1">Color {selectedAci}</span>
                        <div className="flex items-center gap-2">
                           <div className="px-2 py-0.5 bg-neutral-900 border border-white/5 rounded text-[8px] font-mono text-neutral-500 font-bold uppercase">{hexToRgbStr(aciColors[selectedAci])}</div>
                        </div>
                    </div>
                 </div>
                 
                 <button 
                   onClick={() => onUpdateSettings({ ...settings, activeCtbId: editingCtbId || 'acad' })}
                   className={`h-11 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto ${settings.activeCtbId === editingCtbId ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                 >
                   {settings.activeCtbId === editingCtbId ? '✓ ACTIVE' : 'SET DEFAULT'}
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-10 scrollbar-none">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                    
                    {/* Plot Color Control */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Output Behavior</label>
                        <span className="text-[8px] text-cyan-500 font-bold uppercase tracking-tighter italic">Ink & Media</span>
                      </div>
                      <div 
                        className="bg-[#121214] border border-white/5 p-4 rounded-2xl transition-all group hover:border-white/20 hover:bg-neutral-800/20 cursor-pointer"
                        onClick={() => {
                          onOpenColorSelector(currentStyle.plotColor === 'useObjectColor' ? aciColors[selectedAci] : currentStyle.plotColor, (color) => {
                            handleUpdateStyle(selectedAci, { plotColor: color });
                          }, `Plot Color Map [ACI ${selectedAci}]`);
                        }}
                      >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[11px] font-black text-neutral-300 uppercase">Plot Color</span>
                            <div className="w-8 h-8 rounded-xl border border-white/10" style={{ backgroundColor: currentStyle.plotColor === 'useObjectColor' ? aciColors[selectedAci] : currentStyle.plotColor }} />
                        </div>
                        <div className="flex items-center justify-between bg-black/40 rounded-xl px-4 py-3 border border-white/5">
                            <span className="text-[10px] font-mono text-cyan-400 font-bold">{currentStyle.plotColor === 'useObjectColor' ? 'USE OBJECT COLOR' : currentStyle.plotColor}</span>
                            <ChevronDown size={14} className="text-neutral-700" />
                        </div>
                      </div>
                      <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest leading-relaxed px-1">Determine if this index color renders in its original hue or fixed TrueColor.</p>
                    </div>

                    {/* Lineweight Control */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Pen Weight</label>
                        <span className="text-[8px] text-cyan-500 font-bold uppercase tracking-tighter italic">Drafting Standard</span>
                      </div>
                      <div className="bg-[#121214] border border-white/5 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[11px] font-black text-neutral-300 uppercase">Lineweight</span>
                            <span className="text-[10px] font-mono text-cyan-400 font-black">ISO</span>
                        </div>
                        <div className="relative">
                            <select 
                                value={currentStyle.lineweight}
                                onChange={(e) => handleUpdateStyle(selectedAci, { lineweight: e.target.value === 'useObjectLineweight' ? 'useObjectLineweight' : parseFloat(e.target.value) })}
                                className="w-full bg-black/40 border border-white/5 text-cyan-400 text-xs font-mono p-4 rounded-2xl outline-none focus:border-cyan-500/30 transition-all appearance-none text-center font-black"
                            >
                                <option value="useObjectLineweight">USE OBJECT LINEWEIGHT</option>
                                {lineweights.map((lw) => (
                                <option key={`lw-opt-${lw}`} value={lw}>{lw.toFixed(2)} mm</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown size={14} className="text-neutral-700" />
                            </div>
                        </div>
                      </div>
                      <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest leading-relaxed px-1">Override the object's lineweight for specific plot-time thickness.</p>
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Screening (Intensity)</label>
                            <span className="text-[10px] font-mono text-white font-bold">{currentStyle.screening}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100" step="5"
                            value={currentStyle.screening}
                            onChange={(e) => handleUpdateStyle(selectedAci, { screening: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <p className="text-[7.5px] text-neutral-600 font-black uppercase tracking-widest italic">100% is full color. Lower values create transparency/halftones.</p>
                     </div>

                     <div className="flex items-center gap-4 bg-yellow-500/5 p-5 rounded-2xl border border-yellow-500/10">
                        <Info size={18} className="text-yellow-500 shrink-0" />
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Pro Tip</span>
                            <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-wide leading-relaxed">
                                Use screening at 50% for background references (XREFs) to make new geometry stand out during plots.
                            </p>
                        </div>
                     </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#0a0a0c]">
               <div className="w-24 h-24 rounded-[2.5rem] bg-[#121214] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                  <Palette size={40} className="text-neutral-800" />
               </div>
               <h4 className="text-[14px] font-black text-neutral-400 uppercase tracking-[0.4em] mb-3">Engine Config Required</h4>
               <p className="text-neutral-600 max-w-[280px] text-[10px] font-bold uppercase tracking-[0.2em] leading-loose">
                 Select a Plot Style file from the sidebar to begin color mapping configuration.
               </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-8 py-6 bg-[#121214] border-t border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Real-time Sync Active</span>
          </div>
          <button 
            onClick={onClose}
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-12 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-cyan-500/20 transition-all active:scale-[0.98]"
          >
            Finished Configuration
          </button>
      </div>
    </div>
  );
};

export default CtbManager;
