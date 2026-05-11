
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Terminal, Zap, Info, ArrowRight } from 'lucide-react';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: string) => void;
  commands: { cmd: string, alias?: string, desc?: string }[];
}

const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ isOpen, onClose, onSelect, commands }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim() === '' 
    ? commands.filter(c => ['LINE', 'MOVE', 'ERASE', 'CIRCLE', 'PLINE', 'TEXT', 'DIMENSION', 'HATCH', 'ZOOM', 'PAN'].includes(c.cmd)).slice(0, 10)
    : commands.filter(c => 
        c.cmd.toLowerCase().includes(search.toLowerCase()) || 
        c.alias?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 15);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].cmd);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-start justify-center pt-[15vh] px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-[600px] bg-[#111114] border border-white/10 rounded-[2.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col font-sans"
          >
            <div className="flex items-center px-8 py-6 border-b border-white/5 gap-5">
              <Search size={24} className="text-cyan-500" />
              <input 
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands, aliases, or tools..."
                className="flex-1 bg-transparent border-none outline-none text-white text-xl placeholder:text-neutral-700 font-bold uppercase tracking-widest"
              />
              <div className="flex items-center gap-2">
                <div className="bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 flex items-center gap-1.5">
                   <kbd className="text-[10px] font-black text-neutral-500">ESC</kbd>
                </div>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="max-h-[450px] overflow-y-auto p-3 scrollbar-none"
            >
              {filtered.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                    {filtered.map((c, i) => (
                    <button 
                        key={c.cmd}
                        onClick={() => { onSelect(c.cmd); onClose(); }}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`w-full flex items-center justify-between px-5 py-4 rounded-3xl transition-all group ${selectedIndex === i ? 'bg-[#00bcd4] text-black shadow-xl shadow-cyan-500/10' : 'hover:bg-white/5 text-neutral-400'}`}
                    >
                        <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${selectedIndex === i ? 'bg-black/10' : 'bg-[#1a1a1c]'}`}>
                            <Terminal size={18} strokeWidth={selectedIndex === i ? 3 : 2} />
                        </div>
                        <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                                <span className={`text-[12px] font-black uppercase tracking-[0.1em] ${selectedIndex === i ? 'text-black' : 'text-white'}`}>{c.cmd}</span>
                                {c.alias && (
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${selectedIndex === i ? 'bg-black/20 text-black' : 'bg-neutral-900 text-neutral-500'}`}>{c.alias}</span>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium uppercase tracking-tighter mt-0.5 ${selectedIndex === i ? 'text-black/60' : 'text-neutral-600'}`}>{c.desc || 'Standard CAD Command'}</span>
                        </div>
                        </div>
                        <ArrowRight size={16} className={`transition-transform duration-300 ${selectedIndex === i ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`} strokeWidth={3} />
                    </button>
                    ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center gap-4 opacity-30">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Info size={32} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-[14px] font-black uppercase tracking-widest text-white">No matches found</h4>
                    <p className="text-[10px] font-medium text-neutral-500 uppercase mt-1">Try another keyword or command alias</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-[#0a0a0c] border-t border-white/5 flex justify-between items-center">
               <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">V-CORE ENGINE</span>
                 </div>
                 <div className="h-4 w-px bg-white/5" />
                 <div className="flex items-center gap-2">
                    <Zap size={12} className="text-amber-500" />
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-tighter">AI Optimized Search</span>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <kbd className="text-[9px] font-black text-neutral-500 bg-white/5 px-1.5 py-1 rounded border border-white/5">↑↓</kbd>
                    <span className="text-[8px] font-bold text-neutral-700 uppercase">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="text-[9px] font-black text-neutral-500 bg-white/5 px-1.5 py-1 rounded border border-white/5">ENTER</kbd>
                    <span className="text-[8px] font-bold text-neutral-700 uppercase">Select</span>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalCommandPalette;
