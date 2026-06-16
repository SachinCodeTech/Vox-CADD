import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Sparkles, Send, Copy, RotateCcw, 
  ChevronDown, ChevronRight, Check, Play, Info, CornerDownLeft, MessageSquare, History,
  Trash2, Camera, UploadCloud, Image as ImageIcon, Target, Shield, Settings2, Sliders, Eraser, AlertTriangle
} from 'lucide-react';
import { validateAndSnapCommands, SnappingEngineReport } from '../services/cadSnappingService';

interface AiDraftingPanelProps {
  onClose: () => void;
  onCommand: (cmd: string) => void;
  getCommandFromAI: (
    prompt: string, 
    contextSummary: string, 
    sketchData?: string | null, 
    history?: any[],
    drawingType?: string,
    standards?: string
  ) => Promise<any>;
  getAiContextSummary: () => string;
  undo: () => void;
  setLogMessage: (msg: string) => void;
  onCaptureCanvas?: () => string | undefined;
}

interface MessageLogEntry {
  sender: 'user' | 'assistant';
  text: string;
  commands?: string[];
  timestamp: Date;
  hasSketch?: boolean;
}

const DRAFTING_CATEGORIES = [
  {
    id: 'arch-layouts',
    title: 'Architectural Layouts',
    description: 'Create standard room layouts and multi-room structures',
    items: [
      { label: 'Draw Bedroom 4x5m', prompt: 'Create bedroom layout of size 4000x5000mm starting at coordinate 0,0. Separate outer walls on layer A-WALL at 230mm wall thickness, add entry door swing opening of width 900mm at (4000, 1000), place inner partition walls on A-WALL-INT at 115mm thickness, and add text label "MASTER BEDROOM" at center on A-TEXT.' },
      { label: 'Create 2BHK Layout Plan', prompt: 'Design a complete 2BHK floorplan at coordinate 0,0. Incorporate: Living lounge (4.8x5m), Kitchen (2.4x3.6m), Bedroom 1 (3.6x4.2m), Bedroom 2 (3.6x3.6m), and two compact Baths (1.8x2.4m). Draw all walls properly: exterior masonry at 230mm thickness on A-WALL, interior separations at 115mm on A-WALL-INT, leave correct entry door gaps of 900mm, and label each room with centered text on A-TEXT.' },
      { label: 'Design Office Executive Suite', prompt: 'Draw a professional executive office suite measuring 6000x4000mm at 0,0. Partition a conference chamber of size 2500x4000mm, construct exterior walls at 230mm, internal glass partition on A-GLAZ, place a work desk of 1600x800mm, and add centered title labels in both spaces on layer A-TEXT.' },
      { label: 'Draw Retail Store Floorplan', prompt: 'Design a retail shop layout measuring 8x12 meters. Lay down 230mm perimeter masonry, segment a rear inventory compartment (2.5x5m) to the left with an inner 115mm wall, leave two 1500mm double-door openings at the front, and place labels "MAIN ADVERTISING FLOOR" and "SUPPORT STOCKROOM" on A-TEXT.' }
    ]
  },
  {
    id: 'structural-openings',
    title: 'Room Openings & Structures',
    description: 'Add standard doors, windows, and columns',
    items: [
      { label: 'Add 900mm Swing Door', prompt: 'Draw a standard 900mm wide right-hand swing door at coordinate 150,150 on layer A-DOOR. Include the vertical frame segment, the flat door leaf line, and a 90-degree trace swing arc demonstrating standard clearance.' },
      { label: 'Add 1800mm Glazed Window', prompt: 'Insert a 1.8m sliding glazed window centered at coordinate 300,0 on layer A-WINDOW. Model this with dual parallel sashes and wall framing jamb lines.' },
      { label: 'Place Reinforced Column Grid', prompt: 'Lay out a grid of 4 reinforced concrete corner columns at (0,0), (6000,0), (6000,4500), and (0,4500) measuring 300x300mm on layer A-WALL, finished with compact solid boundary styles.' },
      { label: 'Lay Out Bedroom Furniture Block', prompt: 'Place standard king-size bed boundary of size 2000x2100mm centered at 1500,1500, flanked by two side-tables of size 500x500mm on layer A-FURN.' }
    ]
  },
  {
    id: 'dims-annot-layers',
    title: 'Dimensions & Annotations',
    description: 'Initialize layers, add dimensions, site details',
    items: [
      { label: 'Add Aligned Dimensions', prompt: 'Inspect all major room boundaries in the drawing and draw linear aligned dimension annotations with clear extension lines on the A-DIM layer.' },
      { label: 'Initialize Standard Layers', prompt: 'Initialize the complete collection of standard professional CAD design layers: A-WALL (exterior walls), A-WALL-INT (interior partitions), A-DOOR (doors), A-WINDOW (windows), A-FURN (furniture, fixtures), A-ANNO (dimension lines and marks), A-TEXT (room labels), and A-SKETCH.' },
      { label: 'Insert North Arrow Symbol', prompt: 'Draw a compass North Arrow icon centered at coordinate 2000,2000 with outer circle radius 150 on layer A-ANNO, detailing an upward pointing arrow and text annotation "N" positioned above it.' }
    ]
  }
];

export const AiDraftingPanel: React.FC<AiDraftingPanelProps> = ({
  onClose,
  onCommand,
  getCommandFromAI,
  getAiContextSummary,
  undo,
  setLogMessage,
  onCaptureCanvas
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ 'arch-layouts': true });
  const [attachedSketch, setAttachedSketch] = useState<string | null>(null);

  // VoxCADD Architecture UI State variables
  const [drawingType, setDrawingType] = useState<'floorplan' | 'elevation' | 'section'>('floorplan');
  const [standards, setStandards] = useState<'none' | 'ada' | 'ibc'>('none');
  const [autoExecute, setAutoExecute] = useState(false); 
  const [verificationProposal, setVerificationProposal] = useState<any | null>(null);
  const [proposalExplanation, setProposalExplanation] = useState('');
  const [editedCommandsText, setEditedCommandsText] = useState('');
  
  // Real AI conversation log with local storage persistence
  const [messages, setMessages] = useState<MessageLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('voxcadd_ai_draft_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        }
      }
    } catch (e) {
      console.error("Failed to restore AI messages history:", e);
    }
    return [
      {
        sender: 'assistant',
        text: "Hello! I am your AI Drafting Assistant. I can convert your custom natural language prompts directly into precision CAD drawings, layers, and offset parameters. Tap predefined buttons or capture/upload sketches below.",
        timestamp: new Date()
      }
    ];
  });

  const [copiedIndex, setCopiedIndex] = useState<{ msgIdx: number; cmdIdx: number } | null>(null);
  const [scriptCopiedIndex, setScriptCopiedIndex] = useState<number | null>(null);
  const [columnSize, setColumnSize] = useState(300);
  const [customDimScale, setCustomDimScale] = useState(100);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to lowest message in list
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Save messages to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('voxcadd_ai_draft_history', JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to persist AI messages history:", e);
    }
  }, [messages]);

  const toggleCategory = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handlePromptSelect = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your AI drafting log history? This will clear all previous messages.")) {
      const defaultState: MessageLogEntry[] = [
        {
          sender: 'assistant',
          text: "Hello! Message history cleared. Write a new prompt or upload secondary sketches to analyze geometry.",
          timestamp: new Date()
        }
      ];
      setMessages(defaultState);
      localStorage.setItem('voxcadd_ai_draft_history', JSON.stringify(defaultState));
      setLogMessage("AI_HISTORY_CLEARED");
    }
  };

  const handleCaptureCanvas = () => {
    if (onCaptureCanvas) {
      const base64 = onCaptureCanvas();
      if (base64) {
        setAttachedSketch(base64);
        setLogMessage("CANVAS_VIEW_CAPTURED");
        if (navigator.vibrate) navigator.vibrate(10);
      } else {
        setLogMessage("ERR: Unable to capture active canvas.");
      }
    } else {
      setLogMessage("ERR: Canvas capture integration not active.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          setAttachedSketch(event.target.result);
          setLogMessage("SKETCH_IMAGE_UPLOADED");
          if (navigator.vibrate) navigator.vibrate(10);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleExecuteDraft = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const activePrompt = prompt.trim();
    if (!activePrompt && !attachedSketch) return;
    if (loading) return;

    // Add user message to log
    const userMsg: MessageLogEntry = {
      sender: 'user',
      text: activePrompt || `Analyze and draft sketch as a standard ${drawingType.toUpperCase()} complying to ${standards.toUpperCase()} standard.`,
      timestamp: new Date(),
      hasSketch: !!attachedSketch
    };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);
    setLogMessage("CONSULTING AI ARCHITECT ENGINE...");

    const currentAttachedImage = attachedSketch;
    setAttachedSketch(null); // Clear attachment box for next message

    try {
      const context = getAiContextSummary();
      
      // Pass conversation history from messages for context tracking
      const historyPayload = messages
        .filter(m => m.sender === 'user')
        .map(m => ({ role: 'user', parts: [{ text: m.text }] }));

      const res = await getCommandFromAI(
        activePrompt || `Draft a standard ${drawingType} schema with standard architectural details conforming to ${standards} building codes. Convertrough visual elements into accurate elements.`, 
        context, 
        currentAttachedImage, 
        historyPayload,
        drawingType,
        standards
      );
      
      const commands: string[] = res.commands && Array.isArray(res.commands) ? res.commands : [];
      const explanation: string = res.explanation || res.text || "CAD Commands generated successfully.";

      // Run our high-fidelity Architectural Snapping & Validation Engine
      const snappingReport = validateAndSnapCommands(commands);

      // Add AI Response to conversation log
      const assistantMsg: MessageLogEntry = {
        sender: 'assistant',
        text: explanation,
        commands: snappingReport.snappedCommands,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (commands.length > 0) {
        if (autoExecute) {
          // If auto-execute is enabled, directly render subcommands
          snappingReport.snappedCommands.forEach(cmd => {
            onCommand(cmd);
          });
          setLogMessage(`SUCCESS: SNAP-ALIGNED & DRAWN ${snappingReport.snappedCommands.length} ELEMENTS`);
        } else {
          // Trigger the diagnostic & verification console overlay
          setVerificationProposal(snappingReport);
          setProposalExplanation(explanation);
          setEditedCommandsText(snappingReport.snappedCommands.join('\n'));
          setLogMessage("VERIFICATION NEEDED: Review AI Blueprint Layout & Wall Dimensions");
        }
      } else {
        setLogMessage("AI: Processed successfully, but no drafting commands generated.");
      }

    } catch (err: any) {
      console.error(err);
      const errorMsg: MessageLogEntry = {
        sender: 'assistant',
        text: `Error processing drafting request: ${err.message || 'The model encountered an error.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      setLogMessage(`ERR: AI_DRAFTING_FAILED (${err.message || 'Engine error'})`);
    } finally {
      setLoading(false);
    }
  };

  const copyCommandToClipboard = (cmd: string, msgIdx: number, cmdIdx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex({ msgIdx, cmdIdx });
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const copyRawScript = (cmds: string[], idx: number) => {
    const script = cmds.join('\n');
    navigator.clipboard.writeText(script);
    setScriptCopiedIndex(idx);
    setTimeout(() => setScriptCopiedIndex(null), 2000);
  };

  const undoLastDraftSetForMsg = (cmds: string[]) => {
    if (!cmds || cmds.length === 0) return;
    
    const steps = cmds.length;
    for (let i = 0; i < steps; i++) {
      undo();
    }
    setLogMessage(`REVERTED: UNDID LAST ${steps} DRAFTING STEPS`);
    
    // Add info note about undid action
    setMessages(prev => [...prev, {
      sender: 'assistant',
      text: `Undid the previous set of ${steps} commands successfully. Canvas state restored.`,
      timestamp: new Date()
    }]);
  };

  return (
    <div className="relative w-80 sm:w-96 max-w-[calc(100vw-30px)] h-[calc(100vh-140px)] sm:h-[650px] bg-[#111115] border border-white/10 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden select-none font-sans z-[1000] text-neutral-300">
      
      {/* AI Verification & Snapping Proposal Overlay */}
      {verificationProposal && (
        <div className="absolute inset-0 bg-neutral-950/95 z-[150] flex flex-col p-4 overflow-y-auto border border-indigo-500/20 rounded-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center pb-2.5 border-b border-indigo-500/20 shrink-0">
            <div className="flex items-center gap-1.5">
              <Shield className="text-emerald-400" size={14} />
              <div>
                <h3 className="text-[10px] font-black uppercase text-white tracking-wider font-mono">AI CAD Verification Console</h3>
                <span className="text-[7.5px] font-mono text-emerald-400 uppercase">Interactive Snapping Engine</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setVerificationProposal(null);
                setLogMessage("VERIFICATION_DISMISSED");
              }} 
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-3 py-3 overflow-y-auto min-h-0">
            {/* Thought Process / AI Explanation */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-[#4f46e5]/10 border border-indigo-500/10 rounded-xl">
              <span className="text-[7.5px] font-bold font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={9} /> AI Architect Design Intent
              </span>
              <p className="text-[9px] text-neutral-300 font-medium leading-normal max-h-[80px] overflow-y-auto whitespace-pre-line pr-1">
                {proposalExplanation}
              </p>
            </div>

            {/* Diagnostic Snapping Reports */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-amber-950/20 border border-amber-500/15 rounded-xl">
              <span className="text-[7.5px] font-bold font-mono text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Sliders size={9} /> Snap Auto-Corrections Report ({verificationProposal.logs.length})
              </span>
              <div className="max-h-[85px] overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-[8px]">
                {verificationProposal.logs.length === 0 ? (
                  <span className="text-neutral-500 italic">No rounding or parallel angles snap needed. Pure geometry matched.</span>
                ) : (
                  verificationProposal.logs.map((log: string, lIdx: number) => (
                    <div key={lIdx} className="flex gap-1.5 py-0.5 text-neutral-300">
                      <span className="text-amber-500 shrink-0">🔧</span>
                      <span className="leading-tight">{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detected Elements Entity Matrix */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-black/40 border border-white/5 rounded-xl">
              <span className="text-[7.5px] font-bold font-mono text-teal-400 uppercase tracking-widest flex items-center gap-1">
                <Target size={9} /> Compiled Entity List ({verificationProposal.entities.filter((e: any) => e.type !== 'UNKNOWN').length})
              </span>
              <div className="max-h-[100px] overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-[8.5px]">
                {verificationProposal.entities.filter((e: any) => e.type !== 'UNKNOWN').map((ent: any, eIdx: number) => (
                  <div key={eIdx} className="flex justify-between items-center py-1 border-b border-white/5">
                    <div className="flex gap-1.5 items-center">
                      <span className="px-1 py-0.5 rounded text-[7px] font-black uppercase bg-white/5 text-neutral-300">
                        {ent.type}
                      </span>
                      <span className="text-neutral-400 text-[8px]">{ent.layer}</span>
                    </div>
                    <span className="text-neutral-200 truncate max-w-[120px]" title={ent.snapped}>{ent.snapped}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Editable Macro Commands */}
            <div className="flex flex-col gap-1 flex-1 min-h-[90px]">
              <span className="text-[7.5px] font-bold font-mono text-neutral-400 uppercase tracking-widest">
                Target Output Commands (Editable):
              </span>
              <textarea
                value={editedCommandsText}
                onChange={(e) => setEditedCommandsText(e.target.value)}
                className="flex-1 w-full bg-black border border-white/10 rounded-xl p-2 font-mono text-[9px] text-[#00bcd4] outline-none focus:border-indigo-500/50 resize-y"
                placeholder="No commands loaded."
              />
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-col gap-2 pt-2.5 border-t border-indigo-500/10 shrink-0">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[7.5px] font-mono text-neutral-500 uppercase">Save verification choice list:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="accent-indigo-500 text-indigo-500 bg-black border-white/10 rounded"
                />
                <span className="text-[8px] font-mono text-neutral-400 uppercase select-none">Auto-Execute future drafts</span>
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setVerificationProposal(null);
                  setLogMessage("DISCARDED_AI_PLAN");
                }}
                className="py-1.5 px-3 bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-neutral-300 font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Eraser size={10} className="text-neutral-400" />
                Discard
              </button>
              <button
                onClick={() => {
                  const commandList = editedCommandsText
                    .split('\n')
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
                  
                  if (commandList.length > 0) {
                    commandList.forEach(cmd => {
                      onCommand(cmd);
                    });
                    setLogMessage(`SUCCESS: DRAWN ${commandList.length} ELEMENTS`);
                  }
                  setVerificationProposal(null);
                }}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.2)] transition-all active:scale-95"
              >
                <Play size={10} />
                Approve & Render
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Indigo Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#14141a]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-300">AI Drafting Assistant</h3>
            <p className="text-[8px] text-neutral-500 font-mono">Convert Natural Prompts or Sketches to CAD</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearHistory} 
            title="Clear AI Conversation History"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-neutral-400 transition-all border border-transparent hover:border-red-500/20"
          >
            <Trash2 size={13} />
          </button>
          <button 
            onClick={onClose} 
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-all text-neutral-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Container - Log Scrollable Zone on top */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-none" ref={scrollRef}>
        
        {/* Dynamic AI Message Log */}
        <div className="flex flex-col gap-3 min-h-[140px] bg-black/10 border border-white/5 p-3 rounded-xl">
          <div className="flex items-center gap-1 text-[8px] font-black font-mono text-indigo-400 uppercase tracking-widest mb-1">
            <MessageSquare size={10} />
            AI CAD Narrative Log & History
          </div>
          
          <div className="flex flex-col gap-3.5 max-h-[220px] overflow-y-auto pr-1">
            {messages.map((msg, msgIdx) => {
              const isUser = msg.sender === 'user';
              return (
                <div 
                  key={`msg-${msgIdx}`} 
                  className={`flex flex-col gap-1.5 p-3 rounded-xl border ${
                    isUser 
                      ? 'bg-neutral-800/40 border-white/5 self-end ml-10' 
                      : 'bg-indigo-950/10 border-indigo-500/10 self-start mr-10'
                  }`}
                >
                  <div className="flex justify-between items-center text-[7px] font-mono text-neutral-500 tracking-wider">
                    <span className={isUser ? 'text-cyan-400 font-bold font-sans' : 'text-indigo-400 font-bold font-sans'}>
                      {isUser ? '👤 YOU' : '🤖 AI ASSISTANT'}
                    </span>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  
                  <p className="text-[10px] text-neutral-300 leading-relaxed break-words whitespace-pre-wrap font-medium">{msg.text}</p>
                  
                  {msg.hasSketch && (
                    <div className="text-[7.5px] font-mono text-cyan-400 flex items-center gap-1 mt-1 font-bold">
                      📸 Includes Image Attachment
                    </div>
                  )}

                  {msg.commands && msg.commands.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[7.5px] font-mono text-indigo-400 uppercase tracking-wider font-extrabold">Generated Macro Commands</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => copyRawScript(msg.commands!, msgIdx)}
                            title="Copy full script"
                            className="p-1 rounded bg-white/5 text-neutral-400 hover:text-white transition-all hover:bg-white/10"
                          >
                            {scriptCopiedIndex === msgIdx ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                          </button>
                          <button 
                            onClick={() => undoLastDraftSetForMsg(msg.commands!)}
                            title="Undo these generated shapes"
                            className="p-1 rounded bg-red-500/10 text-red-400 hover:text-red-300 transition-all hover:bg-red-500/20"
                          >
                            <RotateCcw size={10} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-black/40 rounded-lg p-1.5 border border-white/5 flex flex-col gap-0.5 max-h-[80px] overflow-y-auto">
                        {msg.commands.map((cmd, cmdIdx) => (
                          <div key={`cmd-${cmdIdx}`} className="flex justify-between items-center hover:bg-white/5 py-0.5 px-1 rounded font-mono text-[9px]">
                            <span className="text-neutral-400 truncate max-w-[180px]">
                              <span className="text-[#00bcd4] font-bold">{cmd.split(' ')[0]}</span>
                              <span className="text-neutral-200"> {cmd.split(' ').slice(1).join(' ')}</span>
                            </span>
                            <button 
                              onClick={() => copyCommandToClipboard(cmd, msgIdx, cmdIdx)}
                              className="p-0.5 rounded text-neutral-600 hover:text-white hover:bg-white/10 transition-all"
                            >
                              {copiedIndex?.msgIdx === msgIdx && copiedIndex?.cmdIdx === cmdIdx 
                                ? <Check size={8} className="text-emerald-400" /> 
                                : <Copy size={8} />}
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between items-center text-[7px] font-mono text-neutral-500">
                        <span>Executed macro commands: {msg.commands.length}</span>
                        <button 
                          onClick={() => {
                            msg.commands!.forEach(c => onCommand(c));
                            setLogMessage("RERUN_AI_DRAFT");
                          }}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
                        >
                          <Play size={9} /> RE-RUN MACRO
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time CAD Automation Suite */}
        <div className="flex flex-col gap-1.5 p-3 bg-indigo-950/20 border border-indigo-500/15 rounded-xl">
          <label className="text-[8px] font-black font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            <Sparkles size={10} />
            AI CAD Power Actions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onCommand("autodim");
              }}
              title="Locate the most recently modified rectangular boundary and automatically execute 'dimlinear' for all four walls on layer A-DIM"
              className="py-1.5 px-2 bg-black/60 hover:bg-indigo-500/15 hover:text-indigo-300 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
            >
              <Target size={11} className="text-indigo-400 shrink-0" />
              Auto-Dim Walls
            </button>
            <button
              type="button"
              onClick={() => {
                onCommand("suggestlayout");
              }}
              title="Analyze the current A-WALL geometry configuration and construct an AI-suggested room furniture/doors layout preview"
              className="py-1.5 px-2 bg-black/60 hover:bg-indigo-500/15 hover:text-indigo-300 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
            >
              <Sparkles size={11} className="text-indigo-400 shrink-0" />
              AI Suggest Layout
            </button>
          </div>
        </div>

        {/* Structural Grid and Dim Scales */}
        <div className="flex flex-col gap-2 p-3 bg-teal-950/20 border border-teal-500/15 rounded-xl">
          <label className="text-[8px] font-black font-mono text-teal-400 uppercase tracking-widest flex items-center gap-1">
            <Target size={10} />
            Structural Grid & Scale
          </label>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400 font-bold uppercase">Column Size x (mm):</span>
              <span className="text-[10px] font-mono text-teal-300 font-bold">{columnSize} mm</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min={150} 
                max={1500} 
                step={50}
                value={columnSize}
                onChange={e => setColumnSize(parseInt(e.target.value) || 300)}
                className="flex-1 accent-teal-500 h-1 rounded-lg bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => {
                  onCommand(`structgrid ${columnSize}`);
                }}
                className="py-1 px-2.5 bg-teal-600 hover:bg-teal-500 text-black font-black text-[9px] uppercase tracking-wider rounded-md transition-all active:scale-95"
              >
                Build Grid
              </button>
            </div>
            <p className="text-[8px] text-neutral-500 leading-normal mt-0.5">
              Generates a dynamic <strong>{columnSize/100}m x {columnSize/100}m</strong> structural grid with {columnSize}mm x {columnSize}mm columns on layer A-WALL at corners (0,0), ({columnSize*10},0), etc.
            </p>
          </div>

          <div className="h-px bg-white/5 my-0.5" />

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400 font-bold uppercase">Drawing Scale:</span>
              <span className="text-[10px] font-mono text-teal-300 font-bold">1 : {customDimScale}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={customDimScale}
                onChange={e => setCustomDimScale(parseInt(e.target.value) || 100)}
                className="bg-black/40 border border-white/5 text-[9px] font-bold text-neutral-300 rounded px-1.5 py-1 outline-none"
              >
                <option value={10}>1 : 10 (Detail)</option>
                <option value={20}>1 : 20 (Detail)</option>
                <option value={50}>1 : 50 (Room Layout)</option>
                <option value={100}>1 : 100 (Floor Plan)</option>
                <option value={200}>1 : 200 (Site Layout)</option>
                <option value={500}>1 : 500 (Master Plan)</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  onCommand(`dimstyle create scale_1_${customDimScale} ${customDimScale}`);
                }}
                className="py-1 px-1.5 bg-neutral-800 hover:text-teal-300 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded border border-white/5 transition-all text-center"
              >
                Create Style
              </button>
            </div>
            <p className="text-[8px] text-neutral-500 leading-normal">
              Creates and selects a Dimension Style properly dimensioned for print output at 1:{customDimScale}.
            </p>
          </div>
        </div>

        {/* Visual Sketch Recognition Tools (Canvas Capture & Upload) */}
        <div className="flex flex-col gap-1.5 p-3 bg-cyan-950/10 border border-cyan-500/10 rounded-xl">
          <label className="text-[8px] font-black font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1">
            <Camera size={10} />
            Sketch Interpretation Tools
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCaptureCanvas}
              title="Capture the current CAD viewport as a temporary visual sketch layer"
              className="py-1.5 px-2 bg-black/60 hover:bg-cyan-500/15 hover:text-cyan-300 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Camera size={11} className="text-cyan-400" />
              Capture Canvas
            </button>
            <button
              type="button"
              onClick={triggerUploadClick}
              title="Upload reference JPEG or PNG sketch for automated vector digitization"
              className="py-1.5 px-2 bg-black/60 hover:bg-cyan-500/15 hover:text-cyan-300 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <UploadCloud size={11} className="text-cyan-400" />
              Upload Sketch
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        </div>

        {/* Template & Code Standards Controls */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-900/60 border border-white/5 rounded-xl shrink-0">
          <label className="text-[8px] font-black font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            <Settings2 size={10} />
            AI Drafting Config & Standards
          </label>
          
          <div className="flex flex-col gap-2">
            {/* Drawing Mode Segmented Control */}
            <div className="flex flex-col gap-1">
              <span className="text-[7.5px] font-mono text-neutral-400 uppercase">Target Drawing Type:</span>
              <div className="grid grid-cols-3 gap-1 bg-black/60 p-0.5 rounded-lg border border-white/5">
                {(['floorplan', 'elevation', 'section'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDrawingType(mode)}
                    className={`py-1 text-[8.5px] font-bold uppercase rounded-md transition-all ${
                      drawingType === mode
                        ? 'bg-indigo-600/90 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {mode === 'floorplan' ? 'Floor Plan' : mode === 'elevation' ? 'Elevation' : 'Section'}
                  </button>
                ))}
              </div>
            </div>

            {/* Regulatory Building Codes Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[7.5px] font-mono text-neutral-400 uppercase">Code Compliance Guardrail:</span>
              <select
                value={standards}
                onChange={(e) => setStandards(e.target.value as any)}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-[9px] font-bold uppercase text-neutral-300 outline-none focus:border-indigo-500/50"
              >
                <option value="none">No Standard Injection (Raw)</option>
                <option value="ada">ADA Compliant (Accessibility Space)</option>
                <option value="ibc">IBC Compliant (Building Codes)</option>
              </select>
            </div>

            {/* Auto Execute Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-[8px] font-mono text-neutral-400 uppercase">Auto-Execute CAD Output:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-black peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:bg-indigo-400 peer-checked:bg-indigo-950 border border-white/5"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Prompts Input Area */}
        <form onSubmit={handleExecuteDraft} className="flex flex-col gap-2 bg-black/40 border border-white/5 p-3 rounded-xl shrink-0">
          <label className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest flex justify-between items-center">
            <span>Natural Language Architect Entry</span>
            {attachedSketch && (
              <span className="text-cyan-400 text-[8px] animate-pulse">📷 Reference Attached</span>
            )}
          </label>
          
          {attachedSketch && (
            <div className="relative w-24 h-24 bg-neutral-900 border border-cyan-500/30 rounded-lg overflow-hidden group flex items-center justify-center">
              <img 
                src={attachedSketch} 
                alt="Attached Sketch" 
                className="max-w-full max-h-full object-contain" 
              />
              <button
                type="button"
                onClick={() => {
                  setAttachedSketch(null);
                  setLogMessage("ATTACHMENT_REMOVED");
                }}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg border border-red-500/40 opacity-90 hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={attachedSketch ? 2 : 3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={attachedSketch ? "How should the AI vectorise this sketch? e.g. 'clean up alignments' or hit DRAFT directly" : "e.g. 'draw 3 concentric circles starting from radius 10' or 'make a bedroom of 5000x4000 at 100,200 with door opening'"}
              className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-[11px] text-white placeholder:text-neutral-700 outline-none focus:border-indigo-500/50 resize-none font-medium leading-relaxed"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleExecuteDraft();
                }
              }}
            />
            {prompt.trim() && (
              <button 
                type="button" 
                onClick={() => setPrompt('')}
                className="absolute top-2 right-2 text-neutral-600 hover:text-white p-1 rounded hover:bg-white/5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex justify-between items-center mt-1">
            <span className="text-[7px] font-mono text-neutral-600 uppercase flex items-center gap-1">
              <Info size={10} />
              Press Enter key to translate
            </span>
            <button
              type="submit"
              disabled={loading || (!prompt.trim() && !attachedSketch)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all ${
                loading || (!prompt.trim() && !attachedSketch)
                  ? 'bg-neutral-900 text-neutral-600'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.25)]'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send size={11} strokeWidth={2.5} />
                  DRAFT WITH AI
                </>
              )}
            </button>
          </div>
        </form>

        {/* Recipes Accordion */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-[8px] font-extrabold font-mono text-neutral-500 uppercase tracking-widest mb-1">
            <History size={10} />
            Predefined AI Prompt Templates
          </div>
          {DRAFTING_CATEGORIES.map((cat) => {
            const isExpanded = !!expandedCats[cat.id];
            return (
              <div key={cat.id} className="border border-white/5 rounded-xl bg-black/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex justify-between items-center p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider font-mono">{cat.title}</span>
                    <span className="text-[7px] text-neutral-500 font-mono mt-0.5">{cat.description}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-indigo-400" /> : <ChevronRight size={14} className="text-neutral-600" />}
                </button>

                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-1 border-t border-white/5 bg-black/40 animate-in slide-in-from-top-2 duration-200">
                    {cat.items.map((item, idx) => (
                      <button
                        key={`${cat.id}-item-${idx}`}
                        type="button"
                        onClick={() => handlePromptSelect(item.prompt)}
                        className="w-full text-left p-2 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors flex justify-between items-center group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-neutral-400 group-hover:text-indigo-300 tracking-tight leading-snug truncate">{item.label}</span>
                          <span className="text-[7.5px] font-mono text-neutral-600 group-hover:text-neutral-500 truncate mt-0.5">"{item.prompt}"</span>
                        </div>
                        <CornerDownLeft size={10} className="text-neutral-600 group-hover:text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      <div className="p-3 bg-black/80 border-t border-white/5 text-center flex flex-col items-center justify-center gap-1 shrink-0">
         <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider flex items-center justify-center gap-1 text-center w-full">
           <Info size={10} />
           Dual engine AI architecture optimized for vector compilation.
         </span>
      </div>
    </div>
  );
};

export default AiDraftingPanel;
