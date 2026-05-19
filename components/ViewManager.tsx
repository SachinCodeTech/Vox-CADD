
import React, { useState } from 'react';
import { AppSettings, NamedView, ViewState } from '../types';
import { Camera, Plus, Trash2, Crosshair, ChevronRight, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ViewManagerProps {
  settings: AppSettings;
  activeTab: string;
  currentView: ViewState;
  onRecallView: (view: NamedView) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  onClose: () => void;
}

const ViewManager: React.FC<ViewManagerProps> = ({
  settings,
  activeTab,
  currentView,
  onRecallView,
  onSaveView,
  onDeleteView,
  onClose
}) => {
  const [newViewName, setNewViewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const namedViews = settings.namedViews || [];

  const handleSave = () => {
    if (!newViewName.trim()) return;
    onSaveView(newViewName.trim());
    setNewViewName('');
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border-l border-white/5 w-80 shadow-2xl relative z-[150]">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">View Manager</h2>
          <p className="text-[9px] text-neutral-500 font-medium uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
            <Bookmark size={9} />
            Named Camera States
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-500 hover:text-white"
        >
          <Crosshair size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
        {/* Quick Save Section */}
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em]">Actions</span>
            </div>
            {!isSaving ? (
                <button 
                    onClick={() => setIsSaving(true)}
                    className="w-full p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-3 group"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Capture Current View</span>
                </button>
            ) : (
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/10 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <input 
                        autoFocus
                        type="text"
                        placeholder="VIEW_NAME..."
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') setIsSaving(false);
                        }}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-cyan-500/50"
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleSave}
                            className="flex-1 py-2 rounded-xl bg-cyan-500 text-black text-[9px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-colors"
                        >
                            Save
                        </button>
                        <button 
                            onClick={() => setIsSaving(false)}
                            className="flex-1 py-2 rounded-xl bg-white/5 text-neutral-400 text-[9px] font-black uppercase tracking-wider hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Saved Views List */}
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em]">Stored Views ({namedViews.length})</span>
            </div>
            
            <div className="space-y-2">
                <AnimatePresence initial={false}>
                    {namedViews.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-neutral-700 opacity-50 border-2 border-dashed border-white/5 rounded-3xl">
                            <Camera size={32} strokeWidth={1} />
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] mt-4">No Saved Views</span>
                        </div>
                    ) : (
                        namedViews.map((view) => (
                            <motion.div 
                                key={view.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group relative"
                            >
                                <button 
                                    onClick={() => onRecallView(view)}
                                    className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-neutral-500 group-hover:text-cyan-400 group-hover:bg-cyan-400/10 transition-colors">
                                            <Camera size={14} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] font-black text-white uppercase tracking-wider">{view.name}</div>
                                            <div className="text-[8px] text-neutral-500 font-mono mt-0.5">
                                                Z: {(view.scale * 100).toFixed(1)}% | {Math.round(view.originX)},{Math.round(view.originY)}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-neutral-700 group-hover:text-white transition-colors" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteView(view.id);
                                    }}
                                    className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>

        {/* Standard Views */}
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.25em]">Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {[
                    { name: 'Top Plan', scale: 0.05, x: 0, y: 0 },
                    { name: 'Zoom Extents', type: 'extents' },
                    { name: 'A3 Bounds', scale: 0.03, x: 21000, y: 14850 }
                ].map((preset, i) => (
                    <button 
                        key={i}
                        onClick={() => {
                            if (preset.type === 'extents') {
                                // Handled via special logic if needed, but for now just mock or use a known center
                                onRecallView({ id: 'extents', name: 'Extents', scale: 0.02, originX: 0, originY: 0 });
                            } else {
                                onRecallView({ 
                                    id: 'preset-' + i, 
                                    name: preset.name, 
                                    scale: preset.scale!, 
                                    originX: preset.x!, 
                                    originY: preset.y! 
                                });
                            }
                        }}
                        className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 hover:text-cyan-400 transition-all text-left group"
                    >
                        <div className="text-[8px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-cyan-500">{preset.name}</div>
                    </button>
                ))}
            </div>
        </div>
      </div>
      
      <div className="p-4 bg-black/60 border-t border-white/5">
        <div className="flex items-center justify-between px-2">
          <span className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Active State</span>
          <span className="text-[8px] font-mono text-cyan-500/50 uppercase">LIVE_MONITOR</span>
        </div>
      </div>
    </div>
  );
};

export default ViewManager;
