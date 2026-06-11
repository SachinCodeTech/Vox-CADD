import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Plus, ChevronDown, Palette, Check, BoxSelect, Maximize2, Zap, Edit3, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { AppSettings, CtbFile, CtbPlotStyle } from '../types';
import { createVoxCtb, getDefaultLineweights } from '../services/ctbService';
import { aciColors, hexToRgbStr } from '../services/colorUtils';

interface CtbManagerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenColorSelector: (currentColor: string, onSelect: (color: string) => void, title?: string) => void;
}

const CtbManager: React.FC<CtbManagerProps> = ({ isOpen, onClose, settings, onUpdateSettings, onOpenColorSelector }) => {
  const [editingCtbId, setEditingCtbId] = useState<string | null>(settings.activeCtbId || 'voxcadd');
  const [selectedAcis, setSelectedAcis] = useState<number[]>([1]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModified, setFilterModified] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [renamingCtbId, setRenamingCtbId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [activeTab, setActiveTab] = useState<'catalogs' | 'matrix' | 'editor'>('matrix');

  useEffect(() => {
    if (settings.activeCtbId && !editingCtbId) {
      setEditingCtbId(settings.activeCtbId);
    }
  }, [settings.activeCtbId, editingCtbId]);

  // Auto-switch to editor tab when selection changes on mobile
  useEffect(() => {
    if (window.innerWidth < 768 && selectedAcis.length > 0) {
      setActiveTab('editor');
    }
  }, [selectedAcis]);

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
    setRenamingCtbId(id);
    setRenamingValue(file.name);
  };

  const handleRenameCtb = (id: string) => {
    if (!renamingValue.trim()) {
      setRenamingCtbId(null);
      return;
    }
    const newFiles = { ...ctbFiles };
    let fileName = renamingValue.trim();
    if (!fileName.toLowerCase().endsWith('.ctb')) {
      fileName += '.ctb';
    }
    newFiles[id] = { ...newFiles[id], name: fileName };
    onUpdateSettings({ ...settings, ctbFiles: newFiles });
    setRenamingCtbId(null);
  };

  const handleDeleteCtb = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'voxcadd' || id === 'monochrome') return;
    const { [id]: _, ...newFiles } = ctbFiles;
    onUpdateSettings({ 
      ...settings, 
      ctbFiles: newFiles, 
      activeCtbId: settings.activeCtbId === id ? 'monochrome' : settings.activeCtbId 
    });
    if (editingCtbId === id) setEditingCtbId('monochrome');
  };

  const handleUpdateStyle = (aciOrAcis: number | number[], updates: Partial<CtbPlotStyle>) => {
    if (!editingCtbId || !activeCtb) return;
    
    const acis = Array.isArray(aciOrAcis) ? aciOrAcis : [aciOrAcis];
    const newStyles = { ...activeCtb.styles };
    
    acis.forEach(aci => {
      newStyles[aci] = { ...newStyles[aci], ...updates };
    });

    const newCtb = { ...activeCtb, styles: newStyles };
    onUpdateSettings({ ...settings, ctbFiles: { ...ctbFiles, [editingCtbId]: newCtb } });
  };

  const toggleAciSelection = (aci: number, isMulti: boolean) => {
    if (isMulti) {
      setSelectedAcis(prev => 
        prev.includes(aci) ? prev.filter(a => a !== aci) : [...prev, aci]
      );
    } else {
      setSelectedAcis([aci]);
    }
  };

  const lineweights = getDefaultLineweights();
  
  const filteredAcis = aciColors.map((c, i) => i).filter(i => {
    if (i === 0) return false;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!i.toString().includes(q) && !aciColors[i].toLowerCase().includes(q)) return false;
    }
    if (filterModified && activeCtb) {
      const s = activeCtb.styles[i];
      const isDefault = s.plotColor === 'useObjectColor' && s.lineweight === 'useObjectLineweight' && s.screening === 100;
      if (isDefault) return false;
    }
    return true;
  });

  const jumpToColor = (aci: number) => {
    const el = document.getElementById(`aci-swatch-${aci}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSelectedAcis([aci]);
  };

  const isMultiSelecting = selectedAcis.length > 1;
  const firstAci = selectedAcis[0] || 1;
  const currentStyle = activeCtb?.styles[firstAci];

  return (
    <div 
      className="relative w-[94vw] sm:w-[940px] sm:max-w-[98vw] h-[82vh] sm:h-[82vh] sm:max-h-[720px] bg-[#0c0c0e]/98 backdrop-blur-3xl rounded-3xl shadow-[0_60px_150px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-white/10 select-none font-sans"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 1100 }}
    >
      <div 
        className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 bg-[#0a0a0c] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <div className="w-8 h-8 rounded-lg bg-cyan-400 flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,188,212,0.2)]">
            <Palette size={16} strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] leading-none mb-0.5">Plot Style Manager</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[6px] text-cyan-400 font-black uppercase tracking-widest opacity-80">v1.2.4</span>
              {activeCtb && <span className="text-[6px] text-neutral-700 font-bold uppercase tracking-widest truncate max-w-[120px]">{activeCtb.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={() => onUpdateSettings({ ...settings, showCtbInView: !settings.showCtbInView })}
              className={`px-3 py-1.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest border transition-all active:scale-95 flex items-center gap-2 ${settings.showCtbInView ? 'bg-cyan-400 text-black border-cyan-400' : 'bg-white/5 text-neutral-500 border-white/10 hover:border-cyan-400/30'}`}
            >
              <Zap size={11} fill={settings.showCtbInView ? "currentColor" : "none"} />
              {settings.showCtbInView ? 'CTB ENABLED' : 'CTB BYPASS'}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-neutral-800 rounded-lg text-neutral-500 transition-all active:scale-95">
              <X size={16} />
            </button>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="flex md:hidden items-center border-b border-white/5 bg-[#0a0a0c] shrink-0">
        {[
          { id: 'catalogs', label: 'Catalog', icon: <FileText size={12} /> },
          { id: 'matrix', label: 'Matrix', icon: <Palette size={12} /> },
          { id: 'editor', label: 'Styles', icon: <Maximize2 size={12} /> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all border-b-2 ${activeTab === tab.id ? 'border-cyan-400 text-white bg-white/5' : 'border-transparent text-neutral-600'}`}
          >
            {tab.icon}
            <span className="text-[7px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar: File Catalog */}
        <div className={`${activeTab === 'catalogs' ? 'flex' : 'hidden'} md:flex w-full md:w-52 border-b md:border-b-0 md:border-r border-white/5 bg-[#08080a] flex-col shrink-0`}>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
             <div className="flex items-center gap-2 px-1 pb-1.5">
               <span className="text-[7px] font-black text-neutral-800 uppercase tracking-[0.2em]">Catalogs</span>
               <div className="flex-1 h-px bg-white/5" />
             </div>
             {Object.values(ctbFiles).map(ctb => (
                <div key={`ctb-item-${ctb.id}`} className="group relative">
                  {renamingCtbId === ctb.id ? (
                    <div className="flex items-center gap-1 p-1 bg-cyan-400/5 border border-cyan-400/20 rounded-lg">
                       <input 
                         autoFocus
                         className="flex-1 bg-transparent border-none text-[9px] font-black text-white uppercase outline-none px-1"
                         value={renamingValue}
                         onChange={e => setRenamingValue(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleRenameCtb(ctb.id)}
                         onBlur={() => handleRenameCtb(ctb.id)}
                       />
                       <button onClick={() => handleRenameCtb(ctb.id)} className="text-cyan-400 p-1 hover:bg-cyan-400/20 rounded">
                          <Check size={10} />
                       </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setEditingCtbId(ctb.id)}
                        className={`flex-1 relative p-2 rounded-lg text-left transition-all border ${editingCtbId === ctb.id ? 'bg-cyan-400/10 text-white border-cyan-400/20' : 'bg-transparent text-neutral-600 border-transparent hover:bg-white/[0.01] hover:text-neutral-400'}`}
                      >
                          <div className="flex items-center gap-2.5 truncate">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${editingCtbId === ctb.id ? 'bg-cyan-400 text-black' : 'bg-white/5 text-neutral-800'}`}>
                                <FileText size={11} />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-tight truncate flex-1">{ctb.name}</span>
                          </div>
                      </button>
                      <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${editingCtbId === ctb.id ? 'w-6 opacity-100' : 'w-0 opacity-0'}`}>
                        {ctb.id !== 'voxcadd' && ctb.id !== 'monochrome' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setRenamingCtbId(ctb.id); setRenamingValue(ctb.name); }}
                            className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 text-neutral-700 hover:text-cyan-400 rounded-md transition-colors shadow-sm"
                          >
                            <Edit3 size={10} />
                          </button>
                        )}
                        {ctb.id !== 'voxcadd' && ctb.id !== 'monochrome' && (
                          <button 
                            onClick={(e) => handleDeleteCtb(ctb.id, e)}
                            className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-neutral-700 hover:text-red-400 rounded-md transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
             ))}
          </div>
          <div className="p-3 bg-[#0a0a0c]/80 border-t border-white/5">
            <button 
              onClick={handleCreateCtb}
              className="w-full h-8 flex items-center justify-center gap-2 bg-white/5 hover:bg-cyan-400/10 border border-white/5 hover:border-cyan-400/20 text-neutral-600 hover:text-cyan-400 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] transition-all active:scale-95"
            >
              <Plus size={12} /> New Profile
            </button>
          </div>
        </div>

        {/* Center: ACI Matrix */}
        <div className={`${activeTab === 'matrix' ? 'flex' : 'hidden'} md:flex w-full md:w-[240px] border-b md:border-b-0 md:border-r border-white/5 bg-[#050507] flex-col shrink-0`}>
            <div className="p-3 flex flex-col gap-2 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between">
                    <span className="text-[7px] font-black text-neutral-700 uppercase tracking-widest">
                       {isMultiSelecting ? `${selectedAcis.length} SELECTED` : `ACI INDEX ${firstAci}`}
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setFilterModified(!filterModified)}
                            className={`text-[6px] font-black uppercase px-2 py-0.5 rounded border transition-all ${filterModified ? 'bg-cyan-400 text-black border-cyan-400 shadow-[0_0_8px_rgba(0,188,212,0.3)]' : 'bg-transparent border-white/10 text-neutral-700'}`}
                        >
                            DIFFS
                        </button>
                    </div>
                </div>
                <div className="relative group">
                    <input 
                      type="text"
                      placeholder="SEARCH COLORS..."
                      className="w-full bg-black/60 border border-white/5 rounded px-2.5 py-1 text-[8px] font-black text-white outline-none focus:border-cyan-400/30 transition-all placeholder:text-neutral-900"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
                    {[1, 7, 8, 250, 255].map(aci => (
                        <button 
                            key={`jump-${aci}`}
                            onClick={() => jumpToColor(aci)}
                            className="shrink-0 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[6px] font-bold text-neutral-500 uppercase border border-white/5"
                        >
                            #{aci}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-10 md:grid-cols-5 gap-1.5 scrollbar-none content-start">
                {filteredAcis.map((i) => {
                    const color = aciColors[i];
                    const isSelected = selectedAcis.includes(i);
                    const isModified = activeCtb && (
                      activeCtb.styles[i].plotColor !== 'useObjectColor' || 
                      activeCtb.styles[i].lineweight !== 'useObjectLineweight' || 
                      activeCtb.styles[i].screening !== 100
                    );

                    return (
                        <button 
                            key={`aci-swatch-${i}`}
                            onClick={(e) => toggleAciSelection(i, e.shiftKey || e.metaKey || e.ctrlKey)}
                            className={`aspect-square rounded-md transition-all relative group overflow-hidden border-2 ${isSelected ? 'border-cyan-400 scale-105 shadow-[0_0_10px_rgba(0,188,212,0.4)] z-10' : 'border-white/[0.03] hover:border-white/10'}`}
                            style={{ backgroundColor: color }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center text-[6px] font-black text-white mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">{i}</span>
                            {isModified && !isSelected && <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-cyan-400" />}
                            {isSelected && <div className="absolute inset-0 border border-black/30 rounded-sm" />}
                        </button>
                    )
                })}
            </div>
        </div>

        <div className={`${activeTab === 'editor' ? 'flex' : 'hidden md:flex'} flex-1 overflow-y-auto bg-[#0a0a0c] flex-col scrollbar-none`}>
          {activeCtb && currentStyle ? (
            <>
              <div className="px-4 py-2 border-b border-white/5 bg-[#0c0c0e]/90 backdrop-blur-3xl flex items-center justify-between sticky top-0 z-20">
                 <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-lg border border-white/10 shadow-lg relative flex items-center justify-center overflow-hidden" 
                      style={{ backgroundColor: isMultiSelecting ? 'transparent' : aciColors[firstAci] }}
                    >
                        {isMultiSelecting ? (
                           <div className="grid grid-cols-2 gap-[1px] p-0.5 bg-neutral-950 w-full h-full opacity-40">
                              {selectedAcis.slice(0, 4).map(a => (
                                <div key={`prev-${a}`} className="w-full h-full" style={{ backgroundColor: aciColors[a] }} />
                              ))}
                           </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                            <span className="text-[11px] font-black text-white mix-blend-difference z-10">{firstAci}</span>
                          </>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[11px] font-black text-white uppercase tracking-tight">
                            {isMultiSelecting ? `${selectedAcis.length} SELECTED` : `COLOR ${firstAci}`}
                          </h4>
                          <span className="text-[5px] font-black text-cyan-400/60 uppercase tracking-widest border border-cyan-400/10 px-1 rounded">
                            {isMultiSelecting ? 'BATCH' : 'PEN'}
                          </span>
                        </div>
                        <span className="text-[6.5px] font-black text-neutral-700 uppercase tracking-widest">
                          {isMultiSelecting ? 'Global style alignment active' : hexToRgbStr(aciColors[firstAci])}
                        </span>
                    </div>
                 </div>
                 
                 <button 
                  onClick={() => onUpdateSettings({ ...settings, activeCtbId: editingCtbId || 'vox' })}
                  className={`px-3 h-7.5 rounded-lg flex items-center gap-2 transition-all border active:scale-95 ${settings.activeCtbId === editingCtbId ? 'bg-cyan-400 border-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.25)]' : 'bg-white/5 border-white/5 text-neutral-700 hover:text-white'}`}
                 >
                    <Check size={10} strokeWidth={4} />
                    <span className="text-[7px] font-black uppercase tracking-widest">
                        {settings.activeCtbId === editingCtbId ? 'ACTIVE' : 'SELECT'}
                    </span>
                 </button>
              </div>

              <div className="p-4 space-y-5">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-0.5">
                            <div className="flex items-center gap-2 text-neutral-600">
                               <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                               <span className="text-[8.5px] font-black uppercase tracking-[0.15em]">Mapping Output</span>
                            </div>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(aci => (
                                    <button 
                                        key={`quick-color-${aci}`}
                                        onClick={() => handleUpdateStyle(selectedAcis, { plotColor: aciColors[aci] })}
                                        className="w-3.5 h-3.5 rounded-full border border-white/10 hover:scale-125 transition-transform"
                                        style={{ backgroundColor: aciColors[aci] }}
                                        title={`Map to ACI ${aci}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="p-3 bg-[#0d0d0f] border border-white/5 rounded-xl block transition-all shadow-lg hover:border-white/10">
                           <div 
                             className="flex items-center justify-between bg-black/50 p-2 rounded-lg border border-white/5 mb-2.5 group/color-btn cursor-pointer active:scale-95 transition-all"
                             onClick={() => onOpenColorSelector(currentStyle.plotColor === 'useObjectColor' ? aciColors[firstAci] : currentStyle.plotColor, (color) => {
                                handleUpdateStyle(selectedAcis, { plotColor: color });
                             }, `MAPPING COLOR [${selectedAcis.length} ITEMS]`)}
                           >
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md border border-white/10 shadow-lg flex items-center justify-center bg-neutral-950 overflow-hidden">
                                        {isMultiSelecting ? (
                                           <div className="grid grid-cols-3 w-full h-full opacity-20">
                                              <div className="bg-red-500" /> <div className="bg-blue-500" />
                                              <div className="bg-green-500" /> <div className="bg-yellow-500" />
                                              <div className="bg-cyan-500" /> <div className="bg-magenta-500" />
                                           </div>
                                        ) : (
                                          <div className="w-full h-full" style={{ backgroundColor: currentStyle.plotColor === 'useObjectColor' ? aciColors[firstAci] : currentStyle.plotColor }} />
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-white uppercase tracking-tight leading-none">
                                           {currentStyle.plotColor === 'useObjectColor' ? 'By Layer' : 'Custom Map'}
                                        </span>
                                        <span className="text-[6.5px] font-mono text-neutral-800 font-bold uppercase tracking-widest mt-0.5">
                                           {currentStyle.plotColor === 'useObjectColor' ? 'DYNAMIC' : currentStyle.plotColor}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-neutral-900 group-hover/color-btn:text-cyan-400">
                                    <ChevronDown size={12} />
                                </div>
                           </div>
                           <div className="flex items-center justify-between px-0.5">
                              <p className="text-[6px] text-neutral-900 font-black uppercase tracking-widest italic">Translation Control.</p>
                              {currentStyle.plotColor !== 'useObjectColor' && (
                                <button 
                                  onClick={() => handleUpdateStyle(selectedAcis, { plotColor: 'useObjectColor' })}
                                  className="text-[6.5px] font-black text-cyan-400 opacity-60 hover:opacity-100 transition-opacity"
                                >
                                  BYLAYER
                                </button>
                              )}
                           </div>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-0.5">
                            <div className="flex items-center gap-2 text-neutral-600">
                               <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                               <span className="text-[8.5px] font-black uppercase tracking-[0.15em]">Lineweight Override</span>
                            </div>
                            <div className="flex gap-1.5">
                                {[0.05, 0.18, 0.35, 0.70].map(lw => (
                                    <button 
                                        key={`quick-lw-${lw}`}
                                        onClick={() => handleUpdateStyle(selectedAcis, { lineweight: lw })}
                                        className="text-[6.5px] font-black text-neutral-700 hover:text-cyan-400 border border-white/5 hover:border-cyan-400/30 px-1 rounded bg-black/40 transition-all"
                                    >
                                        {lw.toFixed(2)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-3 bg-[#0d0d0f] border border-white/5 rounded-xl transition-all shadow-lg hover:border-white/10">
                           <div className="relative group/select">
                               <select 
                                   value={currentStyle.lineweight}
                                   onChange={(e) => handleUpdateStyle(selectedAcis, { lineweight: e.target.value === 'useObjectLineweight' ? 'useObjectLineweight' : parseFloat(e.target.value) })}
                                   className="w-full bg-black/50 border border-white/5 text-white text-[10px] p-2.5 rounded-lg outline-none appearance-none font-black text-center tracking-[0.1em] hover:border-cyan-400/20 transition-all font-mono"
                               >
                                   <option value="useObjectLineweight">BY OBJECT</option>
                                   {lineweights.map((lw) => (
                                      <option key={`lw-opt-${lw}`} value={lw}>{lw.toFixed(2)} MM</option>
                                   ))}
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-900 pointer-events-none group-hover/select:text-cyan-400 transition-colors">
                                    <ChevronDown size={14} />
                                </div>
                           </div>
                           <div className="mt-2.5 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between px-0.5">
                                  <span className="text-[6px] font-black text-neutral-900 uppercase tracking-widest">MIN</span>
                                  {currentStyle.lineweight !== 'useObjectLineweight' && (
                                    <button 
                                      onClick={() => handleUpdateStyle(selectedAcis, { lineweight: 'useObjectLineweight' })}
                                      className="text-[6.5px] font-black text-cyan-400 opacity-60 hover:opacity-100"
                                    >
                                      DEFAULT
                                    </button>
                                  )}
                                  <span className="text-[6px] font-black text-neutral-900 uppercase tracking-widest">MAX</span>
                                </div>
                                <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                  <motion.div 
                                    className="h-full bg-cyan-400 rounded-full" 
                                    initial={{ width: 0 }}
                                    animate={{ width: currentStyle.lineweight === 'useObjectLineweight' ? '0%' : `${Math.min(100, (currentStyle.lineweight as number)*45)}%` }}
                                  />
                                </div>
                           </div>
                        </div>
                    </div>

                    <div className="col-span-full space-y-2.5">
                        <div className="flex items-center justify-between px-0.5">
                            <div className="flex items-center gap-2 text-neutral-600">
                               <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                               <span className="text-[8.5px] font-black uppercase tracking-[0.15em]">Linetype Plot Map</span>
                            </div>
                            <div className="flex gap-1.5">
                                {['continuous', 'dashed', 'center'].map(lt => (
                                    <button 
                                        key={`quick-lt-${lt}`}
                                        onClick={() => handleUpdateStyle(selectedAcis, { lineStyle: lt as any })}
                                        className={`text-[6.5px] font-black uppercase px-2 py-0.5 rounded border transition-all ${currentStyle.lineStyle === lt ? 'bg-cyan-400 text-black border-cyan-400' : 'bg-black/40 border-white/5 text-neutral-700 hover:text-cyan-400 hover:border-cyan-400/30'}`}
                                    >
                                        {lt.slice(0, 4)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-3 bg-[#0d0d0f] border border-white/5 rounded-xl transition-all shadow-lg hover:border-white/10 flex items-center gap-4">
                           <div className="relative group/lt-select flex-1">
                               <select 
                                   value={currentStyle.lineStyle}
                                   onChange={(e) => handleUpdateStyle(selectedAcis, { lineStyle: e.target.value as any })}
                                   className="w-full bg-black/50 border border-white/5 text-white text-[10px] p-2.5 rounded-lg outline-none appearance-none font-black text-center tracking-[0.1em] hover:border-cyan-400/20 transition-all uppercase"
                               >
                                   <option value="useObjectLineStyle">USE OBJECT LINETYPE</option>
                                   <option value="continuous">CONTINUOUS</option>
                                   <option value="dashed">DASHED</option>
                                   <option value="dotted">DOTTED</option>
                                   <option value="center">CENTER</option>
                                   <option value="dashdot">DASHDOT</option>
                                   <option value="border">BORDER</option>
                                   <option value="divide">DIVIDE</option>
                                   <option value="phantom">PHANTOM</option>
                                   <option value="zigzag">ZIGZAG</option>
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-900 pointer-events-none group-hover/lt-select:text-cyan-400 transition-colors">
                                    <ChevronDown size={14} />
                                </div>
                           </div>
                           <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-lg border border-white/5 min-w-[120px] justify-center">
                              <span className="text-[7.5px] font-black text-neutral-700 uppercase tracking-widest">AUTO_RESCALE</span>
                              <div className="w-8 h-4 rounded-full bg-neutral-900 border border-white/10 relative p-0.5 pointer-events-none">
                                <div className="w-3 h-3 rounded-full bg-cyan-400/20 absolute right-0.5" />
                              </div>
                           </div>
                        </div>
                    </div>
                 </div>

                 <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-0.5">
                        <div className="flex items-center gap-2 text-neutral-600">
                           <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                           <span className="text-[8.5px] font-black uppercase tracking-[0.15em]">Screening Intensity</span>
                        </div>
                        <div className="flex items-baseline gap-1 min-w-[40px] justify-end">
                          <span className="text-[15px] font-mono text-cyan-400 font-black tracking-tight">{currentStyle.screening}</span>
                          <span className="text-[7.5px] font-black text-neutral-800 uppercase tracking-widest">%</span>
                        </div>
                    </div>

                    {/* Decision Scale: 5% Increments */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
                        {Array.from({ length: 21 }, (_, i) => i * 5).map(v => (
                            <button 
                                key={`screen-btn-${v}`}
                                onClick={() => handleUpdateStyle(selectedAcis, { screening: v })}
                                className={`shrink-0 w-8 h-6 flex items-center justify-center text-[7.5px] font-mono font-black rounded border transition-all ${currentStyle.screening === v ? 'bg-cyan-400 text-black border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]' : 'bg-white/5 text-neutral-700 border-white/5 hover:border-cyan-400/20'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    <div className="p-5 bg-[#0d0d0f] border border-white/5 rounded-xl shadow-lg relative overflow-hidden group">
                        <input 
                            type="range" 
                            min="0" max="100" step="5"
                            value={currentStyle.screening}
                            onChange={(e) => handleUpdateStyle(selectedAcis, { screening: parseInt(e.target.value) })}
                            className="w-full h-1 bg-black rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                        />
                        <div className="flex justify-between mt-5 px-1 relative h-4">
                            {Array.from({ length: 11 }, (_, i) => i * 10).map(v => (
                                <div key={`screen-mark-${v}`} className="flex flex-col items-center gap-1 absolute" style={{ left: `${v}%`, transform: 'translateX(-50%)' }}>
                                    <div className={`w-[1px] transition-all duration-300 ${currentStyle.screening === v ? 'bg-cyan-400 h-2 shadow-[0_0_5px_cyan]' : 'bg-neutral-900 h-1'}`} />
                                    {v % 20 === 0 && (
                                        <span className={`text-[6px] font-black transition-colors duration-300 ${currentStyle.screening === v ? 'text-neutral-300' : 'text-neutral-900'}`}>{v}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                        { 
                          label: 'TERMINAL', 
                          icon: <BoxSelect size={11} />, 
                          val: currentStyle.lineEndStyle || 'BUTT',
                          onClick: () => {
                             const opts = ['BUTT', 'SQUARE', 'ROUND', 'DIAMOND'];
                             const idx = opts.indexOf(currentStyle.lineEndStyle || 'BUTT');
                             handleUpdateStyle(selectedAcis, { lineEndStyle: opts[(idx + 1) % opts.length] as any });
                          }
                        },
                        { 
                          label: 'JOINT', 
                          icon: <Maximize2 size={11} />, 
                          val: currentStyle.lineJoinStyle || 'MITER',
                          onClick: () => {
                             const opts = ['MITER', 'BEVEL', 'ROUND', 'DIAMOND'];
                             const idx = opts.indexOf(currentStyle.lineJoinStyle || 'MITER');
                             handleUpdateStyle(selectedAcis, { lineJoinStyle: opts[(idx + 1) % opts.length] as any });
                          }
                        },
                        { 
                          label: 'FILL ALGO', 
                          icon: <Palette size={11} />, 
                          val: currentStyle.fillStyle || 'SOLID',
                          onClick: () => {
                             const opts = ['SOLID', 'CHECKERBOARD', 'CROSSHATCH'];
                             const idx = opts.indexOf(currentStyle.fillStyle || 'SOLID');
                             handleUpdateStyle(selectedAcis, { fillStyle: opts[(idx + 1) % opts.length] as any });
                          }
                        }
                    ].map(card => (
                        <div 
                          key={card.label} 
                          onClick={card.onClick}
                          className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between group hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer active:scale-95"
                        >
                            <div className="flex flex-col">
                                <span className="text-[6.5px] font-black text-neutral-800 uppercase tracking-[0.1em]">{card.label}</span>
                                <span className="text-[9px] font-black text-white/60 group-hover:text-cyan-400 uppercase transition-colors mt-0.5">{card.val}</span>
                            </div>
                            <div className="w-7 h-7 rounded-md bg-black/40 flex items-center justify-center text-neutral-800 group-hover:text-cyan-400 transition-all border border-white/5">
                                {card.icon}
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
               <Palette className="w-12 h-12 text-white/5 mb-6 animate-pulse" />
               <h4 className="text-[12px] font-black text-neutral-800 uppercase tracking-[0.25em] mb-2">Style Ready</h4>
               <p className="text-[9px] text-neutral-900 font-bold uppercase tracking-widest max-w-[200px]">Select a color index from the matrix to configure pen translation parameters.</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 sm:py-3.5 bg-[#0a0a0c] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-[0_-15px_45px_rgba(0,0,0,0.8)] z-30">
          <div className="flex items-center gap-5 w-full sm:w-auto overflow-hidden">
             <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,188,212,0.8)]" />
                <span className="text-[7.5px] font-black text-neutral-800 uppercase tracking-[0.15em] shrink-0">CORE_STABLE</span>
             </div>
             <div className="h-4 w-px bg-white/5 hidden sm:block shrink-0" />
             <span className="text-[7.5px] font-mono text-neutral-700 font-bold uppercase tracking-tight truncate">{(activeCtb?.name || 'VOX').replace('.ctb', '').toUpperCase()}.KERNEL</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button 
                onClick={onClose}
                className="text-[8.5px] font-black uppercase tracking-[0.15em] text-neutral-700 hover:text-white transition-all px-4 h-9"
              >
                DISCARD
              </button>
              <button 
                onClick={onClose}
                className="h-9 px-6 sm:px-10 rounded-lg bg-cyan-400 text-black text-[9px] font-black uppercase tracking-[0.15em] shadow-[0_8px_20px_rgba(0,188,212,0.15)] hover:bg-cyan-300 transition-all flex items-center justify-center min-w-[200px] sm:min-w-[180px]"
              >
                COMMIT PEN MAP
              </button>
          </div>
      </div>
    </div>
  );
};

export default CtbManager;
