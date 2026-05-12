
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bot, Send, Terminal, Mic, MicOff, ChevronUp, ChevronDown, Paperclip, X, Check, History } from 'lucide-react';

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  onAiQuery: (prompt: string, attachment?: string | null) => Promise<void>;
  onLiveToggle: () => void;
  onToggleHistory?: () => void;
  isLiveActive: boolean;
  isCommandActive: boolean;
  isAiThinking?: boolean;
  prompt: string;      
  history: string[]; 
  value: string;
  onChange: (val: string) => void;
}

export const COMMAND_LIST = [
    { cmd: 'LINE', alias: 'L', desc: 'Create straight line segments' }, 
    { cmd: 'PLINE', alias: 'PL', desc: 'Create 2D polylines' }, 
    { cmd: 'DLINE', alias: 'DL', desc: 'Draw double lines' },
    { cmd: 'CIRCLE', alias: 'C', desc: 'Create circles' }, 
    { cmd: 'ARC', alias: 'A', desc: 'Create arcs' }, 
    { cmd: 'RECT', alias: 'REC', desc: 'Create rectangular polylines' },
    { cmd: 'POLYGON', alias: 'POL', desc: 'Create regular polygons' }, 
    { cmd: 'ELLIPSE', alias: 'EL', desc: 'Create ellipses' }, 
    { cmd: 'SPLINE', alias: 'SPL', desc: 'Create smooth periodic splines' },
    { cmd: 'DONUT', alias: 'DO', desc: 'Create filled circles or pipes' }, 
    { cmd: 'POINT', alias: 'PO', desc: 'Create point objects' }, 
    { cmd: 'SKETCH', alias: 'SKETCH', desc: 'Freehand sketching' },
    { cmd: 'MOVE', alias: 'M', desc: 'Move objects' }, 
    { cmd: 'COPY', alias: 'CO', desc: 'Copy objects' }, 
    { cmd: 'ROTATE', alias: 'RO', desc: 'Rotate objects' },
    { cmd: 'SCALE', alias: 'SC', desc: 'Enlarge or reduce objects' }, 
    { cmd: 'MIRROR', alias: 'MI', desc: 'Create mirror images' }, 
    { cmd: 'STRETCH', alias: 'S', desc: 'Stretch objects' },
    { cmd: 'EXTEND', alias: 'EX', desc: 'Extend objects to boundary' }, 
    { cmd: 'TRIM', alias: 'TR', desc: 'Trim objects at cutting edges' }, 
    { cmd: 'FILLET', alias: 'F', desc: 'Round/fillet object edges' },
    { cmd: 'CHAMFER', alias: 'CHA', desc: 'Bevel/chamfer object edges' }, 
    { cmd: 'OFFSET', alias: 'O', desc: 'Create concentric geometry' }, 
    { cmd: 'EXPLODE', alias: 'X', desc: 'Break compound objects' }, 
    { cmd: 'ERASE', alias: 'E', desc: 'Remove objects from drawing' },
    { cmd: 'ZOOM', alias: 'Z', desc: 'Increase/decrease view scale' }, 
    { cmd: 'PAN', alias: 'P', desc: 'Move the view around' }, 
    { cmd: 'ZOOM_RT', alias: 'ZR', desc: 'Real-time zooming' },
    { cmd: 'DIST', alias: 'DI', desc: 'Measure distance and angle' }, 
    { cmd: 'AREA', alias: 'AA', desc: 'Calculate area and perimeter' },
    { cmd: 'MTEXT', alias: 'MT', desc: 'Multiline text annotations' }, 
    { cmd: 'TEXT', alias: 'T', desc: 'Single line text annotations' }, 
    { cmd: 'HATCH', alias: 'H', desc: 'Fill areas with patterns' }, 
    { cmd: 'BLOCK', alias: 'B', desc: 'Create block definitions' }, 
    { cmd: 'INSERT', alias: 'I', desc: 'Insert blocks' },
    { cmd: 'ARRAY', alias: 'AR', desc: 'Create multiple patterns' }, 
    { cmd: 'SELECT', alias: 'SEL', desc: 'Select objects' }, 
    { cmd: 'SELALL', alias: 'SA', desc: 'Select all objects' },
    { cmd: 'DIMENSION', alias: 'DIM', desc: 'Create linear dimensions' }, 
    { cmd: 'LEADER', alias: 'LE', desc: 'Add leader annotations' },
    { cmd: 'RAY', alias: 'RAY', desc: 'Create semi-infinite lines' }, 
    { cmd: 'XLINE', alias: 'XL', desc: 'Create infinite lines' },
    { cmd: 'MATCHPROP', alias: 'MA', desc: 'Match object properties' }, 
    { cmd: 'VIEWPORT', alias: 'VP', desc: 'Create layout viewports' }, 
    { cmd: 'LAYOUT', alias: 'LO', desc: 'Manage layout tabs' }, 
    { cmd: 'FIND', alias: 'FIND', desc: 'Find and replace text' },
    { cmd: 'COPYCLIP', alias: 'CC', desc: 'Copy to clipboard' }, 
    { cmd: 'PASTECLIP', alias: 'CV', desc: 'Paste from clipboard' }
];

const CommandBar: React.FC<CommandBarProps> = ({ 
  onCommand, onAiQuery, onLiveToggle, onToggleHistory, isLiveActive, isCommandActive, isAiThinking,
  prompt, history, value, onChange
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'ai' | null>(null);
  const [historyHeight, setHistoryHeight] = useState(0); 
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHistoryOpen = historyHeight > 0;

  const inputHistory = useMemo(() => history.filter(h => h.startsWith("> ")).map(h => h.substring(2)), [history]);
  const [histIdx, setHistIdx] = useState(-1);

  const suggestions = useMemo(() => {
    if (!value || activeTab !== 'cli') return [];
    const search = value.trim().toUpperCase();
    if (!search) return [];
    return COMMAND_LIST.filter(c => 
      c.cmd.includes(search) || (c.alias && c.alias.startsWith(search))
    ).slice(0, 8);
  }, [value, activeTab]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    
    // If command is active OR empty input (for repeat last command), allow empty string
    const canSubmit = trimmed || attachment || (activeTab === 'cli');
    if (!canSubmit) return;
    
    if (activeTab === 'cli') {
        const cmdToRun = (suggestionIdx >= 0 && suggestions[suggestionIdx]) ? suggestions[suggestionIdx].cmd : trimmed;
        onCommand(cmdToRun);
        onChange('');
        setHistIdx(-1);
        setShowSuggestions(false);
        setSuggestionIdx(-1);
    } else {
        if (!trimmed && !attachment) return; // AI needs input
        onAiQuery(trimmed, attachment);
        setAttachment(null);
        onChange('');
        setHistIdx(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeTab !== 'cli') return;

    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSuggestionIdx(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          return;
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSuggestionIdx(prev => (prev >= suggestions.length - 1 ? 0 : prev + 1));
          return;
      } else if (e.key === 'Tab') {
          e.preventDefault();
          const target = suggestions[suggestionIdx >= 0 ? suggestionIdx : 0];
          if (target) {
            onChange(target.cmd);
            setSuggestionIdx(-1);
            setShowSuggestions(false);
          }
          return;
      } else if (e.key === 'Escape') {
          setShowSuggestions(false);
          setSuggestionIdx(-1);
          return;
      }
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(histIdx + 1, inputHistory.length - 1);
        if (next >= 0) {
            setHistIdx(next);
            onChange(inputHistory[inputHistory.length - 1 - next]);
            setShowSuggestions(false);
            setSuggestionIdx(-1);
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
        setShowSuggestions(false);
        setSuggestionIdx(-1);
    }
 else if (e.key === ' ' && value.trim()) {
        // CAD specific: Spacebar acts as Enter to complete commands
        e.preventDefault();
        handleSubmit();
    } else if (e.key === ' ' && !value.trim()) {
        // CAD specific: Spacebar acts as Enter when input is empty (repeats last or finishes)
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
    <div className="flex flex-col w-full bg-[#0d0d0f] relative transition-all duration-300 z-[150]">
      {/* PERSISTENT BAR */}
      <div className="bg-black px-3 py-2 flex items-center justify-between shrink-0 h-10 sm:h-12 border-t border-white/5">
          <div className="flex gap-2">
            <button 
              onClick={() => toggleTab('cli')}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl no-tap border ${activeTab === 'cli' ? 'bg-[#00bcd4] border-[#00bcd4] text-black' : 'bg-[#0d0d0f] border-white/5 text-white'}`}
            >
              <Terminal size={12} className="sm:size-[14px]" strokeWidth={3} />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">CLI</span>
            </button>
            
            <button 
              onClick={() => toggleTab('ai')}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl no-tap border ${activeTab === 'ai' ? 'bg-[#1a1a1c] border-[#6366f1]/40 text-[#6366f1]' : 'bg-[#0d0d0f] border-white/5 text-white'}`}
            >
              <Bot size={12} className="sm:size-[14px]" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">ARCHITECT AI</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end mr-4">
                <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest">SYSTEM STATUS</span>
                <span className="text-[8px] font-mono text-cyan-500/50 uppercase">Ready // v1.0.5</span>
            </div>
            <button 
              onClick={() => onToggleHistory ? onToggleHistory() : setHistoryHeight(isHistoryOpen ? 0 : 150)} 
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all no-tap ${isHistoryOpen || (onToggleHistory && document.getElementById('command-history-panel')?.style.height !== '0px') ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-800 hover:text-neutral-600 bg-white/5'}`}
            >
              <History size={16} />
            </button>
          </div>
      </div>

      {/* INPUT DRAWER (NOW ABOVE HISTORY, BELOW TABS) */}
      <div className={`overflow-hidden transition-all duration-300 ${activeTab ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-black px-3 pb-3 pt-1 border-t border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
          {activeTab === 'cli' ? (
            <form onSubmit={handleSubmit} className="flex items-start gap-2 bg-[#0a0a0c] border border-white/10 rounded-xl px-3 min-h-10 focus-within:border-[#00bcd4]/50 transition-all relative">
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-[#111] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,1)] z-[200] overflow-hidden backdrop-blur-xl">
                        <div className="px-3 py-1.5 border-b border-white/5 bg-white/5">
                            <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest">Command Suggestions</span>
                        </div>
                        {suggestions.map((s, i) => (
                            <button 
                              key={`suggestion-${s.cmd}`} 
                              type="button" 
                              onClick={() => { onChange(s.cmd); onCommand(s.cmd); onChange(''); setShowSuggestions(false); setSuggestionIdx(-1); }} 
                              className={`w-full px-4 py-3 text-left text-[10px] font-bold border-b border-white/5 uppercase flex justify-between items-center transition-colors ${suggestionIdx === i ? 'bg-cyan-500 text-black' : 'text-neutral-400 hover:bg-white/5'}`}
                            >
                                <span>{s.cmd}</span>
                                <span className={`text-[8px] font-mono ${suggestionIdx === i ? 'text-black/50' : 'opacity-30'}`}>{s.alias}</span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex flex-col flex-1 min-w-0 h-full py-2">
                    {prompt && prompt !== "COMMAND:" && (
                        <div className="text-[9px] font-bold text-[#00bcd4] uppercase tracking-wider mb-1 opacity-80 break-words leading-relaxed">
                            {prompt}
                        </div>
                    )}
                    <textarea 
                        autoFocus
                        name={`vox-cmd-${Date.now()}`}
                        value={value}
                        onChange={e => { 
                            onChange(e.target.value); 
                            setShowSuggestions(true);
                            setSuggestionIdx(-1);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.max(32, Math.min(e.target.scrollHeight, 120))}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e as any);
                            (e.target as HTMLTextAreaElement).style.height = '32px';
                          } else {
                            handleKeyDown(e as any);
                          }
                        }}
                        className="w-full bg-transparent text-white font-mono outline-none text-[12px] uppercase tracking-widest placeholder:text-neutral-800 select-text resize-none py-1 h-[32px] max-h-[120px] scrollbar-thin scrollbar-thumb-white/10 block focus:ring-0"
                        placeholder="ENTER COMMAND OR SELECT SUGGESTION..."
                        autoComplete="off-vox"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        role="presentation"
                    />
                </div>
                <div className="flex items-end gap-1.5 py-1.5 shrink-0">
                    <button 
                        type="button" 
                        onClick={onLiveToggle} 
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isLiveActive ? 'text-white bg-red-600 animate-pulse' : 'text-neutral-600 hover:bg-white/5'}`}
                        title="Voice Input"
                    >
                        {isLiveActive ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button 
                        type="submit" 
                        className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-90 shadow-lg ${!value && isCommandActive ? 'bg-emerald-500 text-black shadow-emerald-900/20' : 'bg-cyan-500 text-black shadow-cyan-900/20'}`}
                    >
                        {!value && isCommandActive ? <Check size={16} strokeWidth={4} /> : <Send size={14} strokeWidth={3} />}
                    </button>
                </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className={`flex items-end gap-2 bg-[#0a0a0c] border rounded-xl px-3 py-1.5 min-h-10 transition-all ${isAiThinking ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-white/10 focus-within:border-indigo-500/50'}`}>
                <div className="flex items-center gap-2 shrink-0 pb-2">
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
                            e.target.style.height = `${Math.max(32, Math.min(e.target.scrollHeight, 120))}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey && !isAiThinking) {
                            e.preventDefault();
                            handleSubmit(e as any);
                            (e.target as HTMLTextAreaElement).style.height = '32px';
                          }
                        }}
                        className="w-full bg-transparent text-white outline-none text-[12px] placeholder:text-neutral-800 tracking-tight disabled:opacity-50 select-text font-medium resize-none py-1.5 h-[32px] max-h-[120px] scrollbar-none block focus:ring-0 ring-offset-0 ring-0"
                        placeholder={isAiThinking ? "PRINCIPAL ARCHITECT IS THINKING..." : "INTERACT WITH AI (E.G. 'PLAN 50x50 PLOT', 'REPLACE ALL CIRCLES')..."}
                        autoComplete="new-ai-query"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        role="presentation"
                    />
                </div>
                <div className="flex items-center gap-1.5 py-1 shrink-0 pl-1">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            const r = new FileReader();
                            r.onload = (ev) => setAttachment(ev.target?.result as string);
                            r.readAsDataURL(f);
                        }
                    }} accept="image/*" />
                    <button type="button" title="Attach Sketch" disabled={isAiThinking} onClick={() => fileInputRef.current?.click()} className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors ${attachment ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-600'}`}><Paperclip size={14} /></button>
                    <button type="button" title="Microphone Toggle" disabled={isAiThinking} onClick={onLiveToggle} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isLiveActive ? 'text-white bg-red-600 animate-pulse' : 'text-neutral-600 hover:bg-white/5'}`}>
                        {isLiveActive ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button type="submit" disabled={isAiThinking || (!value.trim() && !attachment)} className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0 ${isAiThinking ? 'bg-neutral-800' : 'bg-indigo-600 shadow-indigo-900/20'}`}>
                        {isAiThinking ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send size={15} strokeWidth={3} />}
                    </button>
                </div>
            </form>
          )}
        </div>
      </div>

      {/* HISTORY PANEL (NOW BELOW BAR) */}
      <div 
          ref={scrollRef} 
          style={{ height: `${historyHeight}px` }}
          className="overflow-y-auto px-4 text-[9px] bg-black border-t border-white/5 scrollbar-none font-mono flex flex-col transition-[height] duration-300 relative group/history"
      >
          <div className="py-3 min-h-full flex flex-col gap-1.5">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-black/80 backdrop-blur-md py-2 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    <div className="text-neutral-600 font-bold uppercase tracking-widest text-[8px]">Session History // Last 50 Commands</div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onCommand('CLEARLOGS'); }}
                  className="opacity-0 group-hover/history:opacity-100 transition-opacity text-[8px] text-red-500/50 hover:text-red-500 font-bold uppercase tracking-widest px-2 py-1 rounded hover:bg-red-500/10"
                >
                  Clear Logs
                </button>
            </div>
            {history.map((msg, i) => {
               const isCommand = msg.startsWith("> ");
               const isAi = msg.startsWith("AI: ") || msg.includes("PRINCIPAL ARCHITECT");
               return (
                 <div 
                    key={`hist-${i}`} 
                    onClick={() => isCommand && onCommand(msg.substring(2))}
                    className={`font-black uppercase p-2.5 border-l-2 whitespace-pre-wrap break-words transition-all rounded-r-lg ${
                        isCommand 
                        ? 'bg-cyan-500/5 border-cyan-500 text-[#00bcd4] cursor-pointer hover:bg-cyan-500/10 active:scale-[0.99]' 
                        : isAi 
                        ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400'
                        : 'bg-neutral-900/40 border-neutral-700 text-neutral-500'
                    }`}
                 >
                   {msg}
                 </div>
               );
            })}
            <div className="mt-8 opacity-20 text-[7px] text-center uppercase tracking-widest border-t border-white/5 pt-4 pb-4">End of History Buffer</div>
          </div>
      </div>

      {isHistoryOpen && (
        <div 
            className="w-full h-1 bg-neutral-900 cursor-ns-resize active:bg-cyan-500/10 touch-none absolute top-full left-0 z-50"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
        />
      )}

      {attachment && (
        <div className="absolute top-[-80px] left-4 bg-black/90 border border-cyan-500/30 rounded-2xl p-1.5 animate-in zoom-in-95 shadow-2xl z-[300]">
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
