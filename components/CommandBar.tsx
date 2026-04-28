
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bot, Send, Terminal, Mic, MicOff, ChevronUp, ChevronDown, Paperclip, X, Check } from 'lucide-react';

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  onAiQuery: (prompt: string, attachment?: string | null) => Promise<void>;
  onLiveToggle: () => void;
  isLiveActive: boolean;
  isCommandActive: boolean;
  isAiThinking?: boolean;
  prompt: string;      
  history: string[]; 
  value: string;
  onChange: (val: string) => void;
}

const COMMAND_LIST = [
    { cmd: 'LINE', alias: 'L' }, { cmd: 'PLINE', alias: 'PL' }, { cmd: 'CIRCLE', alias: 'C' },
    { cmd: 'RECT', alias: 'REC' }, { cmd: 'ARC', alias: 'A' }, { cmd: 'MOVE', alias: 'M' },
    { cmd: 'ROTATE', alias: 'RO' }, { cmd: 'SCALE', alias: 'SC' }, { cmd: 'MIRROR', alias: 'MI' },
    { cmd: 'COPY', alias: 'CO' }, { cmd: 'EXTEND', alias: 'EX' }, { cmd: 'EXPLODE', alias: 'X' },
    { cmd: 'TRIM', alias: 'TR' }, { cmd: 'OFFSET', alias: 'O' }, { cmd: 'FILLET', alias: 'F' },
    { cmd: 'RAY', alias: 'RAY' }, { cmd: 'XLINE', alias: 'XL' },
    { cmd: 'ERASE', alias: 'E' }, { cmd: 'MTEXT', alias: 'MT' }
];

const CommandBar: React.FC<CommandBarProps> = ({ 
  onCommand, onAiQuery, onLiveToggle, isLiveActive, isCommandActive, isAiThinking,
  prompt, history, value, onChange
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'ai' | null>(null);
  const [historyHeight, setHistoryHeight] = useState(0); 
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHistoryOpen = historyHeight > 0;

  const inputHistory = useMemo(() => history.filter(h => h.startsWith("> ")).map(h => h.substring(2)), [history]);
  const [histIdx, setHistIdx] = useState(-1);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    
    // If command is active OR empty input (for repeat last command), allow empty string
    const canSubmit = trimmed || attachment || (activeTab === 'cli');
    if (!canSubmit) return;
    
    if (activeTab === 'cli') {
        onCommand(trimmed);
        onChange('');
        setHistIdx(-1);
        setShowSuggestions(false);
    } else {
        if (!trimmed && !attachment) return; // AI needs input
        onAiQuery(trimmed, attachment);
        setAttachment(null);
        onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeTab !== 'cli') return;
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(histIdx + 1, inputHistory.length - 1);
        if (next >= 0) {
            setHistIdx(next);
            onChange(inputHistory[inputHistory.length - 1 - next]);
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = histIdx - 1;
        setHistIdx(next);
        if (next >= 0) {
            onChange(inputHistory[inputHistory.length - 1 - next]);
        } else {
            onChange('');
        }
    } else if (e.key === ' ' && !value.trim()) {
        // CAD specific: Spacebar acts as Enter when input is empty
        e.preventDefault();
        handleSubmit();
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startHeight.current = historyHeight;
    if ('vibrate' in navigator) navigator.vibrate(5);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY.current - currentY;
    const newHeight = Math.max(0, Math.min(window.innerHeight * 0.45, startHeight.current + delta));
    setHistoryHeight(newHeight);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (historyHeight < 30) setHistoryHeight(0);
  }, [historyHeight]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (scrollRef.current && isHistoryOpen) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [history, isHistoryOpen]);

  const suggestions = useMemo(() => {
    if (!value || activeTab !== 'cli') return [];
    const search = value.trim().toUpperCase();
    return COMMAND_LIST.filter(c => c.cmd.startsWith(search) || (c.alias && c.alias.startsWith(search))).slice(0, 5);
  }, [value, activeTab]);

  const toggleTab = (tab: 'cli' | 'ai') => {
    if (activeTab === tab) {
      setActiveTab(null);
      setHistoryHeight(0);
    } else {
      setActiveTab(tab);
      if (historyHeight === 0) setHistoryHeight(80);
    }
  };

  return (
    <div className="flex flex-col w-full bg-[#0d0d0f] border-t border-white/5 relative transition-all duration-300">
      
      <div 
          ref={scrollRef} 
          style={{ height: `${historyHeight}px` }}
          className="overflow-y-auto px-4 text-[9px] bg-black border-b border-white/5 scrollbar-none font-mono flex flex-col transition-[height] duration-75"
      >
          <div className="py-2 min-h-full flex flex-col justify-end gap-1">
            <div className="text-neutral-800 uppercase tracking-tighter mb-4 opacity-40">VOXCADD_CORE_V3 // KERNEL_ACTIVE</div>
            {history.map((msg, i) => (
               <div key={i} className="text-[#00bcd4] font-black uppercase p-2 bg-cyan-500/5 border-l-2 border-cyan-500 whitespace-pre-wrap break-words">
                 {msg}
               </div>
            ))}
            <div className="mt-4 opacity-20 text-[7px] text-center uppercase tracking-widest border-t border-white/5 pt-2">SWIPE DOWN TO COLLAPSE</div>
          </div>
      </div>

      {(isHistoryOpen || activeTab) && (
        <div 
            className="w-full flex justify-center py-2 bg-black cursor-ns-resize active:bg-cyan-500/10 touch-none border-b border-white/5"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
        >
            <div className="w-16 h-1 bg-neutral-800 rounded-full group-hover:bg-cyan-500 transition-colors" />
        </div>
      )}

      {activeTab && (
        <div className="bg-black px-3 pb-2 pt-1 animate-in slide-in-from-bottom-2 duration-150">
          {activeTab === 'cli' ? (
            <form onSubmit={handleSubmit} className="flex items-start gap-2 bg-[#0a0a0c] border border-white/10 rounded-xl px-3 min-h-10 focus-within:border-[#00bcd4]/50 transition-all relative">
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden backdrop-blur-xl">
                        {suggestions.map((s, i) => (
                            <button key={i} type="button" onClick={() => { onChange(s.cmd); onCommand(s.cmd); onChange(''); setShowSuggestions(false); }} className="w-full px-4 py-3 text-left text-[10px] font-bold text-neutral-400 hover:bg-white hover:text-black border-b border-white/5 uppercase flex justify-between items-center transition-colors">
                                <span>{s.cmd}</span>
                                <span className="opacity-30 text-[8px] font-mono">{s.alias}</span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="text-[8px] font-black text-[#00bcd4] uppercase tracking-widest shrink-0 font-mono pr-2 border-r border-white/5 pt-3">
                    {prompt}
                </div>
                <div className="flex-1 min-w-0 h-full">
                    <textarea 
                        autoFocus
                        name={`vox-cmd-${Date.now()}`}
                        value={value}
                        onChange={e => { 
                            onChange(e.target.value); 
                            setShowSuggestions(true);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.max(40, Math.min(e.target.scrollHeight, 150))}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e as any);
                            (e.target as HTMLTextAreaElement).style.height = '40px';
                          } else {
                            handleKeyDown(e as any);
                          }
                        }}
                        className="w-full bg-transparent text-white font-mono outline-none text-[11px] uppercase tracking-widest placeholder:text-neutral-900 select-text resize-none py-2.5 h-[40px] max-h-[150px] scrollbar-thin scrollbar-thumb-white/10 block focus:ring-0"
                        placeholder="ENTER COMMAND..."
                        autoComplete="off-vox"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        role="presentation"
                    />
                </div>
                <div className="flex items-center self-stretch py-1.5 pl-2 shrink-0">
                    <button 
                        type="submit" 
                        className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-90 shadow-lg ${!value && isCommandActive ? 'bg-emerald-500 text-black shadow-emerald-900/20' : 'bg-cyan-500 text-black shadow-cyan-900/20'}`}
                    >
                        {!value && isCommandActive ? <Check size={16} strokeWidth={4} /> : <Send size={14} strokeWidth={3} />}
                    </button>
                </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className={`flex items-start gap-2 bg-[#0a0a0c] border rounded-xl px-3 min-h-10 transition-all ${isAiThinking ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border-white/10 focus-within:border-indigo-500/50'}`}>
                <div className="flex items-center gap-2 shrink-0 pt-3">
                  <div className="relative">
                    <Bot size={14} className={isAiThinking ? 'text-indigo-400 animate-pulse' : 'text-indigo-500'} />
                    {isAiThinking && <div className="absolute inset-0 bg-indigo-500/20 blur-sm animate-ping rounded-full" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0 h-full">
                    <textarea 
                        autoFocus
                        disabled={isAiThinking}
                        name={`vox-ai-${Date.now()}`}
                        value={value}
                        onChange={e => {
                            onChange(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey && !isAiThinking) {
                            e.preventDefault();
                            handleSubmit(e as any);
                            (e.target as HTMLTextAreaElement).style.height = 'auto';
                          }
                        }}
                        className="w-full bg-transparent text-white outline-none text-[10px] sm:text-[11px] placeholder:text-neutral-800 tracking-tight disabled:opacity-50 select-text font-medium resize-none py-2.5 h-[40px] max-h-[150px] scrollbar-none block focus:ring-0 ring-offset-0 ring-0"
                        placeholder={isAiThinking ? "PRINCIPAL ARCHITECT IS THINKING..." : "CONSULT ARCHITECT (E.G. 'DESIGN A 2BHK APARTMENT', 'CALCULATE LIVING AREA')..."}
                        autoComplete="new-ai-query"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        role="presentation"
                    />
                </div>
                <div className="flex items-center gap-1.5 self-stretch py-2 shrink-0 pl-1">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            const r = new FileReader();
                            r.onload = (ev) => setAttachment(ev.target?.result as string);
                            r.readAsDataURL(f);
                        }
                    }} accept="image/*" />
                    <button type="button" disabled={isAiThinking} onClick={() => fileInputRef.current?.click()} className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${attachment ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-600'}`}><Paperclip size={14} /></button>
                    <button type="button" disabled={isAiThinking} onClick={onLiveToggle} className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${isLiveActive ? 'text-white bg-red-600 animate-pulse' : 'text-neutral-600 hover:bg-white/5'}`}>
                        {isLiveActive ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button type="submit" disabled={isAiThinking || (!value.trim() && !attachment)} className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0 ${isAiThinking ? 'bg-neutral-800' : 'bg-indigo-600 shadow-indigo-900/20'}`}>
                        {isAiThinking ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send size={14} strokeWidth={3} />}
                    </button>
                </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-black px-3 py-2 flex items-center justify-between shrink-0 h-10 sm:h-12">
          <div className="flex gap-2">
            <button 
              onClick={() => toggleTab('cli')}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl no-tap border ${activeTab === 'cli' ? 'bg-[#00bcd4] border-[#00bcd4] text-black shadow-[0_0_15px_rgba(0,188,212,0.4)]' : 'bg-[#0d0d0f] border-white/5 text-white'}`}
            >
              <Terminal size={12} className="sm:size-[14px]" strokeWidth={3} />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">CLI</span>
            </button>
            
            <button 
              onClick={() => toggleTab('ai')}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl no-tap border ${activeTab === 'ai' ? 'bg-[#1a1a1c] border-[#6366f1]/40 text-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-[#0d0d0f] border-white/5 text-white'}`}
            >
              <Bot size={12} className="sm:size-[14px]" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">ARCHITECT AI</span>
            </button>
          </div>

          <button 
            onClick={() => setHistoryHeight(isHistoryOpen ? 0 : 100)} 
            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all no-tap ${isHistoryOpen ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-800 hover:text-neutral-600 bg-white/5'}`}
          >
            {isHistoryOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
      </div>

      {attachment && (
        <div className="absolute bottom-[100%] left-4 mb-3 bg-black/90 border border-cyan-500/30 rounded-2xl p-1.5 animate-in zoom-in-95 shadow-2xl z-[300]">
            <div className="relative">
                <img src={attachment} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                <button 
                    onClick={() => setAttachment(null)} 
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 border-2 border-black hover:bg-red-500 transition-colors shadow-lg"
                >
                    <X size={10} strokeWidth={3} />
                </button>
                <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 rounded-md">
                    <span className="text-[6px] text-cyan-400 font-black uppercase tracking-widest">SKETCH_DATA</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CommandBar;
