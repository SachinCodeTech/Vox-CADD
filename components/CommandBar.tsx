
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bot, Send, Terminal, Mic, MicOff, ChevronUp, ChevronDown, Paperclip, X, Check, History, Target, Image, Sparkles, UploadCloud, Camera } from 'lucide-react';

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  onAiQuery: (prompt: string, attachment?: string | null) => Promise<void>;
  onLiveToggle: () => void;
  onToggleHistory?: () => void;
  onAction?: (type: string, data?: any) => void;
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
    { cmd: 'REVCLOUD', alias: 'REVC', desc: 'Create revision clouds' },
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
    { cmd: 'TABLE', alias: 'TB', desc: 'Create custom Bill of Materials table' },
    { cmd: 'LAYER', alias: 'LA', desc: 'Manage layers and linetype properties' },
    { cmd: 'CLEAN', alias: 'CL', desc: 'Remove zero-length lines and overlapping duplicates' },
    { cmd: 'COPYCLIP', alias: 'CC', desc: 'Copy to clipboard' }, 
    { cmd: 'PASTECLIP', alias: 'CV', desc: 'Paste from clipboard' }
];

export const AI_PROMPT_SUGGESTIONS = [
    { label: 'Draw Bedroom', prompt: 'Draw a standard 4.5m x 4m master bedroom with ensuite bath.' },
    { label: 'Create 2BHK', prompt: 'Design a compact 100sqm 2BHK apartment plan.' },
    { label: 'Modern Office', prompt: 'Create a modern open-plan office layout for 10 people.' },
    { label: 'Clean Drawing', prompt: 'Fix all misaligned lines and ensure corners are perfectly closed.' },
    { label: 'Add Dimensions', prompt: 'Auto-dimension all major room spans and wall lengths.' },
    { label: 'Extension', prompt: 'Add a 3m wide terrace garden extension to the living area.' }
];

const CommandBar: React.FC<CommandBarProps> = ({ 
  onCommand, onAiQuery, onLiveToggle, onToggleHistory, onAction, isLiveActive, isCommandActive, isAiThinking,
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
  const rightFileInputRef = useRef<HTMLInputElement>(null);

  const isHistoryOpen = historyHeight > 0;

  const inputHistory = useMemo(() => history.filter(h => h.startsWith("> ")).map(h => h.substring(2)), [history]);
  const [histIdx, setHistIdx] = useState(-1);

  // Synchronise showSuggestions visibility whenever input changes
  useEffect(() => {
    if (value && value.trim()) {
      setShowSuggestions(true);
    } else if (activeTab === 'cli') {
      setShowSuggestions(false);
    }
  }, [value, activeTab]);

  const suggestions = useMemo(() => {
    if (activeTab === 'cli') {
        if (!value) return [];
        const search = value.trim().toUpperCase();
        if (!search) return [];
        
        let matches = COMMAND_LIST.map(c => {
          let score = 0;
          const cmd = c.cmd.toUpperCase();
          const alias = c.alias ? c.alias.toUpperCase() : '';
          const desc = c.desc ? c.desc.toUpperCase() : '';
          
          if (cmd === search) {
            score = 1000;
          } else if (alias === search) {
            score = 900;
          } else if (cmd.startsWith(search)) {
            score = 800 - (cmd.length - search.length);
          } else if (alias.startsWith(search)) {
            score = 700 - (alias.length - search.length);
          } else if (cmd.includes(search)) {
            score = 600 - cmd.indexOf(search);
          } else if (alias.includes(search)) {
            score = 500 - alias.indexOf(search);
          } else {
            // Fuzzy match: check if all characters of search appear sequentially within cmd
            let cmdIdx = 0;
            let matchCount = 0;
            for (let char of search) {
              const foundIdx = cmd.indexOf(char, cmdIdx);
              if (foundIdx !== -1) {
                matchCount++;
                cmdIdx = foundIdx + 1;
              } else {
                break;
              }
            }
            if (matchCount === search.length) {
              score = 400 - cmdIdx;
            } else {
              // Try the same sequential match on alias
              let aliasIdx = 0;
              let aliasMatchCount = 0;
              for (let char of search) {
                const foundIdx = alias.indexOf(char, aliasIdx);
                if (foundIdx !== -1) {
                  aliasMatchCount++;
                  aliasIdx = foundIdx + 1;
                } else {
                  break;
                }
              }
              if (aliasMatchCount === search.length) {
                score = 300 - aliasIdx;
              } else if (desc.includes(search)) {
                score = 100 - desc.indexOf(search);
              }
            }
          }
          
          return { ...c, score, type: 'cmd' as const };
        }).filter(item => item.score > 0);
        
        // Sort by score descending, then alphabetically by cmd
        matches.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.cmd.localeCompare(b.cmd);
        });
        
        return matches.slice(0, 10);
    } else if (activeTab === 'ai') {
        const search = value.trim().toLowerCase();
        if (!search) return AI_PROMPT_SUGGESTIONS.map(s => ({ cmd: s.prompt, label: s.label, type: 'ai' as const })).slice(0, 5);
        return AI_PROMPT_SUGGESTIONS.filter(s => 
          s.label.toLowerCase().includes(search) || s.prompt.toLowerCase().includes(search)
        ).map(s => ({ cmd: s.prompt, label: s.label, type: 'ai' as const })).slice(0, 5);
    }
    return [];
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
        setShowSuggestions(false);
        setSuggestionIdx(-1);
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

  // Auto-reveal and auto-focus CLI tab when keyboard inputs are directed to command bar
  useEffect(() => {
    if (value && activeTab === null) {
      setActiveTab('cli');
      if (historyHeight === 0) setHistoryHeight(80);
      
      // Focus the textbox after rendering pass
      setTimeout(() => {
        const inputEl = document.getElementById('command-input');
        if (inputEl) inputEl.focus();
      }, 50);
    }
  }, [value, activeTab, historyHeight]);

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
      <div className={`transition-all duration-300 ${activeTab ? 'max-h-[300px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="bg-black px-3 pb-3 pt-1 border-t border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
          {activeTab === 'cli' ? (
            <form onSubmit={handleSubmit} className="flex items-start gap-2 bg-[#0a0a0c] border border-white/10 rounded-xl px-3 min-h-10 focus-within:border-[#00bcd4]/50 transition-all relative">
                {showSuggestions && suggestions.length > 0 && !isAiThinking && (
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-[#111] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,1)] z-[200] overflow-hidden backdrop-blur-xl max-h-[260px] flex flex-col">
                        <div className="px-3 py-1.5 border-b border-white/5 bg-[#161619] flex justify-between items-center shrink-0">
                            <span className="text-[7.5px] font-black text-cyan-400/80 uppercase tracking-widest leading-relaxed">
                                {activeTab === 'cli' ? `CMD SUGGESTIONS FOR "${value.toUpperCase()}"` : 'Architectural Prompts'}
                            </span>
                            {activeTab === 'ai' && <Bot size={10} className="text-indigo-500" />}
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-white/5 animate-in fade-in-50 duration-200">
                            {suggestions.map((s: any, i) => (
                                <button 
                                  key={`suggestion-${s.cmd}`} 
                                  type="button" 
                                  onClick={() => { 
                                    if (s.type === 'ai') {
                                        onAiQuery(s.cmd);
                                    } else {
                                        onChange(s.cmd); onCommand(s.cmd); 
                                    }
                                    onChange(''); 
                                    setShowSuggestions(false); 
                                    setSuggestionIdx(-1); 
                                  }} 
                                  className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase flex justify-between items-center transition-all ${suggestionIdx === i ? (s.type === 'ai' ? 'bg-indigo-600 text-white' : 'bg-cyan-500 text-black') : 'text-neutral-400 hover:bg-white/5'}`}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black tracking-widest uppercase truncate ${suggestionIdx === i ? (s.type === 'ai' ? 'text-white' : 'text-black') : 'text-cyan-400'}`}>
                                                {s.cmd}
                                            </span>
                                            {s.alias && (
                                                <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded ${suggestionIdx === i ? 'bg-black/20 text-black/80' : 'bg-neutral-800 text-neutral-400'}`}>
                                                    {s.alias}
                                                </span>
                                            )}
                                        </div>
                                        {s.desc && (
                                            <span className={`text-[8.5px] normal-case font-semibold tracking-tight truncate max-w-[280px] sm:max-w-md ${suggestionIdx === i ? 'text-black/60' : 'text-neutral-500'}`}>
                                                {s.desc}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[8px] font-mono shrink-0 pl-3 ${suggestionIdx === i ? 'opacity-60 text-black' : 'opacity-40 text-neutral-500'}`}>
                                        {s.type === 'ai' ? 'AI' : 'SELECT [TAB]'}
                                    </span>
                                </button>
                            ))}
                        </div>
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
                        id="command-input"
                        name={`vox-cmd-${Date.now()}`}
                        value={value}
                        onFocus={() => setShowSuggestions(true)}
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
              <form onSubmit={handleSubmit} className={`flex flex-col gap-2.5 bg-[#040406]/95 border rounded-[22px] p-3 w-full transition-all relative shadow-[0_15px_35px_rgba(0,0,0,0.6)] ${isAiThinking ? 'border-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.2)]' : 'border-indigo-500/25 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_24px_rgba(99,102,241,0.15)]'}`}>
                  {showSuggestions && suggestions.length > 0 && !isAiThinking && (
                      <div className="absolute bottom-full left-0 mb-2 w-full bg-[#111] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,1)] z-[200] overflow-hidden backdrop-blur-xl max-h-[260px] flex flex-col">
                          <div className="px-3 py-1.5 border-b border-white/5 bg-[#161619] flex gap-2 items-center shrink-0">
                              <Bot size={10} className="text-indigo-500" />
                              <span className="text-[7.5px] font-black text-neutral-500 uppercase tracking-widest leading-relaxed">Architectural Patterns</span>
                          </div>
                          <div className="overflow-y-auto flex-1 divide-y divide-white/5 animate-in fade-in-50 duration-200">
                              {suggestions.map((s: any, i) => (
                                  <button 
                                    key={`suggestion-ai-${i}`} 
                                    type="button" 
                                    onClick={() => { 
                                      onAiQuery(s.cmd);
                                      onChange(''); 
                                      setShowSuggestions(false); 
                                      setSuggestionIdx(-1); 
                                    }} 
                                    className={`w-full px-4 py-3 text-left transition-all flex flex-col gap-0.5 ${suggestionIdx === i ? 'bg-indigo-600 text-white' : 'text-neutral-300 hover:bg-white/5'}`}
                                  >
                                      <span className={`text-[10px] font-black uppercase tracking-tight ${suggestionIdx === i ? 'text-white' : 'text-indigo-400'}`}>{s.label}</span>
                                      <span className={`text-[8.5px] line-clamp-1 normal-case font-medium ${suggestionIdx === i ? 'text-white/70' : 'text-neutral-500'}`}>{s.cmd}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
                  
                  {/* Center Query Textbox */}
                  <div className="w-full flex items-center px-1">
                      <textarea 
                         autoFocus
                         id="ai-command-input"
                         disabled={isAiThinking}
                         name={`vox-ai-${Date.now()}`}
                         value={value}
                         onFocus={() => setShowSuggestions(true)}
                         onChange={e => {
                             onChange(e.target.value);
                             e.target.style.height = 'auto';
                             e.target.style.height = `${Math.max(36, Math.min(e.target.scrollHeight, 120))}px`;
                         }}
                         onKeyDown={e => {
                           if (e.key === 'Enter' && !e.shiftKey && !isAiThinking) {
                             e.preventDefault();
                             handleSubmit(e as any);
                             (e.target as HTMLTextAreaElement).style.height = '36px';
                           }
                         }}
                         className="w-full bg-transparent text-white outline-none text-[13px] placeholder:text-neutral-500 tracking-wider disabled:opacity-50 select-text font-bold resize-none py-1.5 h-[36px] max-h-[120px] scrollbar-none block focus:ring-0 ring-offset-0 ring-0 transition-colors"
                         placeholder={isAiThinking ? "PRINCIPAL ARCHITECT IS THINKING..." : "INTERACT WITH AI / E.G. \"PLAN...\""}
                         autoComplete="new-ai-query"
                         autoCorrect="off"
                         autoCapitalize="off"
                         spellCheck={false}
                         data-lpignore="true"
                         role="presentation"
                      />
                  </div>

                  {/* Bottom Control Bar splitting left actions and right actions */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 px-1">
                      {/* Left Action Buttons */}
                      <div className="flex items-center gap-1.5">
                          <button 
                             type="button"
                             onClick={() => {
                                 const el = document.getElementById('ai-command-input');
                                 if (el) el.focus();
                                 setShowSuggestions(prev => !prev);
                             }}
                             className={`w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 hover:bg-indigo-500 hover:text-black active:scale-95 transition-all outline-none cursor-pointer disabled:opacity-30 ${showSuggestions ? 'ring-1 ring-indigo-500bg-indigo-500/20' : ''}`}
                             title="Show AI Commands & Architectural Patterns List"
                             disabled={isAiThinking}
                          >
                             <Sparkles size={13} className={isAiThinking ? 'text-indigo-400 animate-pulse' : ''} />
                          </button>

                          <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             accept="image/*" 
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                     const dataUrl = event.target?.result as string;
                                     if (onAction) onAction('interpret_sketch', dataUrl);
                                  };
                                  reader.readAsDataURL(file);
                               }
                             }}
                          />
                          <button 
                             type="button"
                             disabled={isAiThinking}
                             onClick={() => fileInputRef.current?.click()}
                             className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-black active:scale-95 transition-all outline-none cursor-pointer disabled:opacity-30"
                             title="Upload photo or sketch component to instantly convert into professional vector CAD drawing"
                          >
                             <UploadCloud size={13} />
                          </button>

                          <button 
                             type="button"
                             disabled={isAiThinking}
                             onClick={() => onAction && onAction('interpret_sketch')}
                             className="w-8 h-8 flex items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 hover:bg-cyan-500 hover:text-black active:scale-95 transition-all outline-none cursor-pointer disabled:opacity-30"
                             title="Screen Capture the active workspace canvas and auto-vectorize its contents"
                          >
                             <Camera size={13} />
                          </button>

                          <input 
                             type="file" 
                             ref={rightFileInputRef} 
                             className="hidden" 
                             onChange={(e) => {
                                 const f = e.target.files?.[0];
                                 if (f) {
                                     const r = new FileReader();
                                     r.onload = (ev) => setAttachment(ev.target?.result as string);
                                     r.readAsDataURL(f);
                                 }
                             }} 
                             accept="image/*" 
                          />
                          <button 
                             type="button" 
                             title="Attach a reference graphic or sketch to your text prompt context" 
                             disabled={isAiThinking} 
                             onClick={() => rightFileInputRef.current?.click()} 
                             className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30 border ${attachment ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' : 'text-violet-500/80 hover:text-violet-400 bg-violet-500/5 hover:bg-violet-500/10 border-violet-500/5'}`}
                          >
                             <Paperclip size={13} />
                          </button>
                      </div>

                      {/* Right Actions: Voice Mic, Send */}
                      <div className="flex items-center gap-1.5">
                          <button 
                             type="button" 
                             title="Microphone Toggle (Voice Input)" 
                             disabled={isAiThinking} 
                             onClick={onLiveToggle} 
                             className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30 ${isLiveActive ? 'text-white bg-red-600 animate-pulse' : 'text-neutral-500 hover:text-neutral-300 bg-indigo-500/5 hover:bg-indigo-500/10'}`}
                          >
                             {isLiveActive ? <MicOff size={13} /> : <Mic size={13} />}
                          </button>

                          <button 
                             type="submit" 
                             disabled={isAiThinking || (!value.trim() && !attachment)} 
                             className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-30 ${isAiThinking ? 'bg-neutral-800' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25'}`}
                          >
                             {isAiThinking ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send size={13} strokeWidth={3} />}
                          </button>
                      </div>
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
