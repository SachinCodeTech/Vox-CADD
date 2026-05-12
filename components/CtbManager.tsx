import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Settings2, Trash2, Plus, Info, ChevronDown, Palette, Edit3, Check, Sliders } from 'lucide-react';
import { motion } from 'motion/react';
import { AppSettings, CtbFile, CtbPlotStyle, LineType } from '../types';
import { createVoxCtb, createDefaultCtb, getDefaultLineweights } from '../services/ctbService';
import { aciColors, hexToRgbStr } from '../services/colorUtils';

interface CtbManagerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenColorSelector: (currentColor: string, onSelect: (color: string) => void, title?: string) => void;
}

const CtbManager: React.FC<CtbManagerProps> = ({ isOpen, onClose, settings, onUpdateSettings, onOpenColorSelector }) => {
  const [editingCtbId, setEditingCtbId] = useState<string | null>(settings.activeCtbId || 'vox');
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
    const file = createVoxCtb();
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
    if (id === 'vox' || id === 'monochrome') return;
    
    const newFiles = { ...ctbFiles };
    delete newFiles[id];
    let nextActive = settings.activeCtbId;
    if (nextActive === id) nextActive = 'vox';
    
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
      className="relative w-full sm:w-[1040px] sm:max-w-[98vw] h-full sm:h-[92vh] sm:max-h-[880px] bg-[#0c0c0e]/95 backdrop-blur-3xl sm:rounded-[2.5rem] shadow-[0_100px_250px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-white/10 select-none font-sans"
      style={{ transform: window.innerWidth > 640 ? `translate(${pos.x}px, ${pos.y}px)` : undefined, zIndex: 1100 }}
    >
      {/* Dynamic Header */}
      <div 
        className="flex justify-between items-center px-8 py-6 border-b border-white/5 bg-[#0a0a0c] sm:cursor-grab active:sm:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => window.innerWidth > 640 && startDrag(e.clientX, e.clientY)}
      >
        <div className="flex items-center gap-5 pointer-events-none">
          <div className="w-12 h-12 rounded-[1.25rem] bg-[#00bcd4] flex items-center justify-center text-black shadow-[0_0_30px_rgba(0,188,212,0.3)]">
            <Palette size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-white uppercase tracking-[0.25em] leading-none mb-1.5">Plot Style Manager</h3>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-cyan-400 font-black uppercase tracking-widest bg-cyan-400/10 px-2.5 py-1 rounded-md border border-cyan-400/20">VOX ENGINE ACTIVE</span>
              {activeCtb && <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">Editing: {activeCtb.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500 hover:text-white rounded-xl text-neutral-500 transition-all active:scale-95 group">
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar: File Catalog */}
        <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/5 bg-[#08080a] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-none">
             <div className="flex items-center gap-3 px-2 pb-4">
               <span className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em]">Style Library</span>
               <div className="flex-1 h-px bg-white/5" />
             </div>
             {Object.values(ctbFiles).map(ctb => (
              <div 
                key={`ctb-file-${ctb.id}`}
                onClick={() => setEditingCtbId(ctb.id)}
                className={`group relative p-4 rounded-[1.25rem] cursor-pointer transition-all border-2 ${editingCtbId === ctb.id ? 'bg-cyan-400/10 text-white border-cyan-400/40 shadow-[0_10px_30px_rgba(0,188,212,0.1)]' : 'bg-transparent text-neutral-500 border-white/[0.03] hover:border-white/10 hover:text-neutral-300'}`}
              >
                 <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4 truncate">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${editingCtbId === ctb.id ? 'bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,188,212,0.5)]' : 'bg-white/5 text-neutral-700'}`}>
                           <FileText size={18} />
                        </div>
                        {renamingId === ctb.id ? (
                          <input 
                            autoFocus
                            className="bg-black/60 border-b-2 border-cyan-500 px-2 py-1 text-[11px] font-black text-white w-full outline-none uppercase"
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
                          <div className="flex flex-col gap-0.5">
                             <span className="text-[11px] font-black uppercase tracking-tight leading-none">{ctb.name}</span>
                             <span className="text-[7px] text-neutral-600 font-black uppercase tracking-widest">{ctb.id === 'vox' || ctb.id === 'monochrome' ? 'SYSTEM DEFINED' : `INDEX: ${ctb.id.substring(4,8)}`}</span>
                          </div>
                        )}
                    </div>
                    {ctb.id !== 'vox' && ctb.id !== 'monochrome' && (
                       <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setRenamingId(ctb.id); setNewName(ctb.name); }}
                            className="p-2 text-neutral-600 hover:text-cyan-400 transition-colors"
                          >
                            <Edit3 size={12} />
                          </button>
                       </div>
                    )}
                 </div>
              </div>
            ))}
          </div>
          <div className="p-6 bg-[#0a0a0c]/80 border-t border-white/5">
            <button 
              onClick={handleCreateCtb}
              className="w-full h-12 flex items-center justify-center gap-3 bg-cyan-400/5 hover:bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95 group"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Add Catalog
            </button>
          </div>
        </div>

        {/* Center: ACI Matrix */}
        <div className="w-full md:w-[280px] border-b md:border-b-0 md:border-r border-white/5 bg-[#050507] flex flex-col shrink-0">
            <div className="p-6 flex flex-col gap-2 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-neutral-700 uppercase tracking-widest">Active ACI Index</span>
                    <div className="flex items-center gap-2">
                       <span className="text-[11px] font-black text-cyan-400 font-mono">{selectedAci}</span>
                    </div>
                </div>
                <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden mt-1 pt-0.5">
                    <motion.div 
                      className="h-full bg-cyan-400" 
                      animate={{ width: `${(selectedAci/255)*100}%` }}
                      transition={{ type: 'spring', damping: 20 }}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-8 md:grid-cols-4 gap-3 scrollbar-none content-start bg-gradient-to-b from-[#0a0a0c] to-transparent">
                {aciColors.map((color, i) => {
                    if (i === 0) return null; 
                    const isSelected = selectedAci === i;
                    return (
                        <button 
                            key={`aci-swatch-${i}`}
                            onClick={() => setSelectedAci(i)}
                            className={`aspect-square rounded-[0.8rem] transition-all relative group overflow-hidden border ${isSelected ? 'border-cyan-400 scale-110 shadow-[0_0_20px_rgba(0,188,212,0.3)] z-10' : 'border-white/[0.05] hover:border-white/20'}`}
                            style={{ backgroundColor: color }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">{i}</span>
                            {isSelected && <div className="absolute inset-0 border-2 border-black/40 rounded-[0.7rem]" />}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Inspector Panel */}
        <div className="flex-1 overflow-y-auto bg-[#0a0a0c] flex flex-col scrollbar-none">
          {activeCtb && currentStyle ? (
            <>
              <div className="p-8 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-2xl flex items-center justify-between sticky top-0 z-20">
                 <div className="flex items-center gap-8">
                    <div 
                      className="w-20 h-20 rounded-[1.75rem] border-4 border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative flex items-center justify-center overflow-hidden active:scale-95 transition-transform" 
                      style={{ backgroundColor: aciColors[selectedAci] }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                        <span className="text-[24px] font-black text-white mix-blend-difference z-10">{selectedAci}</span>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-[18px] font-black text-white uppercase tracking-tight font-mono">ACI {selectedAci}</h4>
                          <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[8px] font-black text-neutral-500 uppercase tracking-widest">Pen Data</div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">{hexToRgbStr(aciColors[selectedAci])}</span>
                           <div className="w-[1.5px] h-3 bg-neutral-800 rounded-full" />
                           <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Vector Translation Active</span>
                        </div>
                    </div>
                 </div>
                 
                 <button 
                  onClick={() => onUpdateSettings({ ...settings, activeCtbId: editingCtbId || 'vox' })}
                  className={`px-6 py-3 rounded-2xl flex items-center gap-3 transition-all border-2 active:scale-95 ${settings.activeCtbId === editingCtbId ? 'bg-cyan-400 border-cyan-400 text-black shadow-[0_0_25px_rgba(0,188,212,0.3)]' : 'bg-white/5 border-white/10 text-neutral-600 hover:border-cyan-400/50 hover:text-cyan-400'}`}
                 >
                    <Check size={16} strokeWidth={4} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {settings.activeCtbId === editingCtbId ? 'Active Profile' : 'Set as Active'}
                    </span>
                 </button>
              </div>

              <div className="p-10 space-y-14">
                 {/* Property Section: Output Color */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                    <div className="space-y-5">
                        <div className="flex items-center gap-3 px-1 text-neutral-500 group">
                           <div className="w-2 h-2 rounded-full bg-cyan-500" />
                           <span className="text-[11px] font-black uppercase tracking-[0.35em]">Plot Output Color</span>
                        </div>
                        <div className="p-7 bg-[#0d0d0f] border border-white/5 rounded-[2rem] group hover:border-cyan-400/20 transition-all shadow-2xl">
                           <div 
                             className="flex items-center justify-between bg-black/60 p-5 rounded-2xl border border-white/5 mb-5 group/color-btn cursor-pointer active:scale-95 transition-all"
                             onClick={() => onOpenColorSelector(currentStyle.plotColor === 'useObjectColor' ? aciColors[selectedAci] : currentStyle.plotColor, (color) => {
                                handleUpdateStyle(selectedAci, { plotColor: color });
                             }, `MAPPING COLOR [ACI ${selectedAci}]`)}
                           >
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-xl border-2 border-white/10 shadow-lg" style={{ backgroundColor: currentStyle.plotColor === 'useObjectColor' ? aciColors[selectedAci] : currentStyle.plotColor }} />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-black text-white uppercase tracking-tight">{currentStyle.plotColor === 'useObjectColor' ? 'Native Object Color' : 'Custom Plot Mapping'}</span>
                                        <span className="text-[9px] font-mono text-neutral-600 font-bold uppercase tracking-widest">{currentStyle.plotColor === 'useObjectColor' ? 'Dynamic Binding' : currentStyle.plotColor}</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-neutral-700 group-hover/color-btn:text-cyan-400 group-hover/color-btn:bg-cyan-400/10 transition-all">
                                    <ChevronDown size={20} />
                                </div>
                           </div>
                           <p className="px-2 text-[9px] text-neutral-700 font-bold uppercase tracking-tight leading-relaxed italic opacity-80">Renders all geometry of this ACI index to the specified output color during plot operations.</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="flex items-center gap-3 px-1 text-neutral-500 group">
                           <div className="w-2 h-2 rounded-full bg-cyan-500" />
                           <span className="text-[11px] font-black uppercase tracking-[0.35em]">Lineweight Override</span>
                        </div>
                        <div className="p-7 bg-[#0d0d0f] border border-white/5 rounded-[2rem] group hover:border-cyan-400/20 transition-all shadow-2xl">
                           <div className="relative group/select">
                               <select 
                                   value={currentStyle.lineweight}
                                   onChange={(e) => handleUpdateStyle(selectedAci, { lineweight: e.target.value === 'useObjectLineweight' ? 'useObjectLineweight' : parseFloat(e.target.value) })}
                                   className="w-full bg-black/60 border border-white/5 text-white text-[14px] font-mono p-5 rounded-2xl outline-none appearance-none font-black text-center tracking-[0.2em] hover:border-cyan-400/30 transition-all"
                               >
                                   <option value="useObjectLineweight">USE OBJECT WEIGHT</option>
                                   {lineweights.map((lw) => (
                                   <option key={`lw-${lw}`} value={lw}>{lw === 0 ? '0.00' : lw.toFixed(2)} MM</option>
                                   ))}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-700 pointer-events-none group-hover/select:text-cyan-400 transition-colors">
                                    <ChevronDown size={22} />
                                </div>
                           </div>
                           <div className="mt-6 flex flex-col gap-3">
                               <div className="flex items-center justify-between text-[8px] font-black text-neutral-700 uppercase tracking-widest px-1">
                                  <span>HAIRLINE (0.00MM)</span>
                                  <span>HEAVY (2.11MM)</span>
                               </div>
                               <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 p-0.5">
                                  <motion.div 
                                    className="h-full bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(0,188,212,0.5)]" 
                                    initial={{ width: 0 }}
                                    animate={{ width: currentStyle.lineweight === 'useObjectLineweight' ? '0%' : `${Math.min(100, (currentStyle.lineweight as number)*45)}%` }}
                                  />
                               </div>
                           </div>
                        </div>
                    </div>
                 </div>

                 {/* Property Section: Screening */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3 text-neutral-500 group">
                           <div className="w-2 h-2 rounded-full bg-cyan-500" />
                           <span className="text-[11px] font-black uppercase tracking-[0.35em]">Screening Intensity</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-[20px] font-mono text-cyan-400 font-black tracking-tight">{currentStyle.screening}</span>
                            <span className="text-[10px] font-black text-neutral-700 uppercase">% LEVEL</span>
                        </div>
                    </div>
                    <div className="p-10 bg-[#0d0d0f] border border-white/5 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-cyan-400 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity pointer-events-none" />
                        <input 
                            type="range" 
                            min="0" max="100" step="5"
                            value={currentStyle.screening}
                            onChange={(e) => handleUpdateStyle(selectedAci, { screening: parseInt(e.target.value) })}
                            className="w-full h-3 bg-black rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all border border-white/5"
                        />
                        <div className="flex justify-between mt-8 px-2">
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                                <div key={`screen-mark-${v}`} className="flex flex-col items-center gap-3">
                                    <div className={`w-[2px] rounded-full transition-all duration-500 ${currentStyle.screening >= v ? 'bg-cyan-400 h-4 shadow-[0_0_8px_cyan]' : 'bg-neutral-800 h-2'}`} />
                                    <span className={`text-[8px] font-black transition-colors duration-500 ${currentStyle.screening >= v ? 'text-white' : 'text-neutral-800'}`}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {[
                        { label: 'TERMINAL ENDS', icon: <BoxSelect size={14} />, val: 'BUTT/SQUARE' },
                        { label: 'JOINT TYPE', icon: <Maximize2 size={14} />, val: 'MITER_ANGLE' },
                        { label: 'FILL ALGORITHM', icon: <Palette size={14} />, val: 'SOLID_SCAN' }
                    ].map(card => (
                        <div key={card.label} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between group hover:bg-white/[0.05] hover:border-cyan-400/20 transition-all cursor-pointer active:scale-95">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-neutral-700 uppercase tracking-[0.25em]">{card.label}</span>
                                <span className="text-[12px] font-black text-neutral-400 uppercase tracking-tight group-hover:text-cyan-400 transition-colors">{card.val}</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-neutral-800 group-hover:text-cyan-400 group-hover:bg-cyan-400/10 transition-all border border-white/5 group-hover:border-cyan-400/20">
                                {card.icon}
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
               <div className="w-40 h-40 rounded-[3rem] bg-white/[0.02] flex items-center justify-center mb-10 border-2 border-white/[0.03] group relative">
                  <div className="absolute inset-0 bg-cyan-400/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Palette size={80} className="text-neutral-900 group-hover:scale-110 group-hover:text-cyan-400 transition-all duration-1000 relative z-10" />
               </div>
               <h4 className="text-[20px] font-black text-neutral-800 uppercase tracking-[0.5em] mb-6">STANDBY STATE</h4>
               <p className="max-w-[360px] text-[11px] font-bold uppercase tracking-[0.2em] leading-relaxed text-neutral-700 opacity-60">
                 PEN DRIVER HAS NOT RECEIVED TARGET CATALOG DATA. PLEASE SELECT A CTB FILE FROM THE LEFT LIBRARY TO BEGIN MAPPING.
               </p>
            </div>
          )}
        </div>
      </div>

      {/* Persistence Bar */}
      <div className="px-12 py-8 bg-[#0a0a0c] border-t border-white/5 flex items-center justify-between shrink-0 shadow-[0_-40px_80px_rgba(0,0,0,0.8)] z-30">
          <div className="flex items-center gap-8">
             <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(0,188,212,0.8)]" />
                <span className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.4em]">SYSTEM LINK SECURE</span>
             </div>
             <div className="h-5 w-px bg-white/10" />
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-neutral-800 uppercase tracking-widest leading-none mb-1">SERVICE_CORE_ID</span>
                <span className="text-[10px] font-mono text-neutral-600 font-bold uppercase leading-none">VOXCADD_CTB_01.KERNEL</span>
             </div>
          </div>
          <div className="flex items-center gap-8">
              <button 
                onClick={onClose}
                className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-700 hover:text-white transition-all hover:tracking-[0.4em] active:scale-95"
              >
                DISCARD CHANGES
              </button>
              <button 
                onClick={onClose}
                className="h-14 px-14 rounded-2xl bg-cyan-400 text-black text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_15px_45px_rgba(0,188,212,0.4)] hover:bg-cyan-300 hover:shadow-[0_20px_60px_rgba(0,188,212,0.5)] transition-all active:scale-95"
              >
                COMMIT PEN TABLE
              </button>
          </div>
      </div>
    </div>
  );
};

export default CtbManager;
