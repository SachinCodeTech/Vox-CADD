
import React from 'react';
import { X, Grid, Hash, MoreHorizontal } from 'lucide-react';

interface HatchPatternSelectorProps {
  onSelect: (pattern: string) => void;
  onCancel: () => void;
}

const patterns = [
  { id: 'ansi31', name: 'ANSI31 (Brick)', icon: <Hash size={24} /> },
  { id: 'ansi32', name: 'ANSI32 (Steel)', icon: <Hash size={24} className="rotate-90" /> },
  { id: 'ansi37', name: 'ANSI37 (Glass)', icon: <Grid size={24} /> },
  { id: 'cross', name: 'CROSS (Net)', icon: <MoreHorizontal size={24} className="rotate-45" /> },
  { id: 'net', name: 'NET', icon: <Grid size={24} /> },
  { id: 'dots', name: 'DOTS', icon: <div className="grid grid-cols-2 gap-1"><div className="w-1 h-1 bg-current rounded-full" /><div className="w-1 h-1 bg-current rounded-full" /><div className="w-1 h-1 bg-current rounded-full" /><div className="w-1 h-1 bg-current rounded-full" /></div> },
  { id: 'honey', name: 'HONEY (Hex)', icon: <div className="grid grid-cols-3 gap-0.5"><div className="w-1.5 h-1.5 bg-current transform rotate-45" /><div className="w-1.5 h-1.5 bg-current transform rotate-45" /><div className="w-1.5 h-1.5 bg-current transform rotate-45" /></div> },
  { id: 'gravel', name: 'GRAVEL', icon: <div className="flex gap-1 items-end"><div className="w-2 h-2 border border-current rotate-12" /><div className="w-1.5 h-1.5 border border-current -rotate-12" /><div className="w-2 h-1 border border-current rotate-45" /></div> },
  { id: 'solid', name: 'SOLID', icon: <div className="w-6 h-6 bg-current rounded-sm" /> },
];

const HatchPatternSelector: React.FC<HatchPatternSelectorProps> = ({ onSelect, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0d0d0f] rounded-[2rem] overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,1)] border border-white/10 animate-in zoom-in-95 duration-400">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Hash size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Hatch Patterns</h2>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">Select fill configuration</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-3 gap-4">
          {patterns.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group aspect-square flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all active:scale-95 text-neutral-400 hover:text-cyan-400"
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 group-hover:bg-cyan-500/20 transition-colors">
                {p.icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-center px-1 leading-tight">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="p-6 bg-[#0a0a0c] border-t border-white/5 flex justify-end">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default HatchPatternSelector;
