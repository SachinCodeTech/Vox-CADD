
import React, { useState, useRef, useEffect } from 'react';
import { X, HelpCircle, Info, ChevronRight, Cpu, MousePointer2, Zap, Settings, Command } from 'lucide-react';

interface InfoPanelProps {
  type: 'about' | 'help' | 'privacy';
  onClose: () => void;
  onSwitch?: (type: 'about' | 'help' | 'privacy') => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ type, onClose, onSwitch }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPos({
        x: clientX - dragStart.current.x,
        y: clientY - dragStart.current.y
      });
    };
    const handleEnd = () => { 
      isDragging.current = false;
      setIsInteracting(false);
    };
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
    setIsInteracting(true);
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const HelpSection = ({ title, icon: Icon, children }: { title: string, icon: any, children?: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1 border-b border-white/5 pb-2">
        <Icon size={14} className="text-cyan-400" />
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{title}</span>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );

  const CommandItem = ({ cmd, desc, alias }: { cmd: string, desc: string, alias?: string }) => (
    <div className="flex items-start gap-3 p-2 bg-neutral-900/50 rounded-lg border border-white/5">
      <div className="w-16 shrink-0 font-mono text-[10px] font-black text-cyan-500 uppercase">{cmd} {alias && <span className="text-neutral-600">({alias})</span>}</div>
      <div className="text-[10px] text-neutral-400 leading-tight">{desc}</div>
    </div>
  );

  const renderAbout = () => (
    <div className="flex flex-col items-center text-center p-4">
      <div className="w-20 h-20 bg-cyan-500 rounded-3xl flex items-center justify-center font-black text-4xl text-black mb-6 shadow-[0_0_30px_rgba(6,182,212,0.4)]">V</div>
      <h2 className="text-2xl font-black text-white mb-1">VoxCADD Mobile Pro</h2>
      <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-6">Version 2.5.0-Stable</p>
      
      <div className="w-full space-y-4 text-left bg-black/40 p-4 rounded-2xl border border-white/5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Company</h4>
            <p className="text-xs text-neutral-200 font-bold">Code Tech</p>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Developer</h4>
            <p className="text-xs text-neutral-200 font-bold">Sachin Sheth</p>
          </div>
        </div>
        <div>
          <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Engine</h4>
          <p className="text-xs text-neutral-200">V-Core 3.0 Web-GL / Canvas2D High-Precision</p>
        </div>
        <div>
          <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Credits</h4>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Built with React, TailwindCSS, Lucide Icons, and Gemini 2.5 Pro Vision API for architectural intelligence. Special thanks to the open-source CAD community.
          </p>
        </div>
      </div>
      
      {onSwitch && (
        <button 
          onClick={() => onSwitch('privacy')}
          className="mt-6 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all group"
        >
          <Zap size={10} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Privacy Protocol</span>
        </button>
      )}

      <p className="mt-8 text-[9px] text-neutral-600 uppercase font-medium">© 2024 Code Tech. All Rights Reserved.</p>
    </div>
  );
  const renderHelp = () => (
    <div className="p-4 space-y-2">
      <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
        <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-2">Quick Start Tutorial</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-[10px] shrink-0">1</div>
            <p className="text-[10px] text-neutral-300 leading-normal">Use the <b>Command Bar</b> at the bottom to type shortcuts like <span className="text-white font-mono">L</span> (Line) or <span className="text-white font-mono">REC</span> (Rectangle).</p>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-[10px] shrink-0">2</div>
            <p className="text-[10px] text-neutral-300 leading-normal">Tap the <b>AI Architect</b> icon to speak or type natural language prompts like <span className="italic text-cyan-200">"Draw a master bedroom with a walk-in closet"</span>.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-[10px] shrink-0">3</div>
            <p className="text-[10px] text-neutral-300 leading-normal">Try the <b>SKETCH</b> command to draw rough shapes freehand. The AI will automatically interpret and clean them up into precise geometry.</p>
          </div>
        </div>
      </div>

      <HelpSection title="Drawing Commands" icon={Command}>
        <CommandItem cmd="LINE" alias="L" desc="Create individual straight line segments." />
        <CommandItem cmd="PLINE" alias="PL" desc="Create continuous polylines (shapes)." />
        <CommandItem cmd="RECT" alias="REC" desc="Draw rectangles by specifying two corners." />
        <CommandItem cmd="CIRCLE" alias="C" desc="Draw circles by center point and radius." />
        <CommandItem cmd="ARC" alias="A" desc="Create arcs (3-Point, Start-Center-End [C], or Start-End-Radius [E])." />
        <CommandItem cmd="SKETCH" alias="SK" desc="Draw rough freehand shapes for AI interpretation." />
        <CommandItem cmd="TEXT" alias="T" desc="Add annotations to your drawing." />
      </HelpSection>

      <HelpSection title="AI Architect Intelligence" icon={Cpu}>
        <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-3">
          <div className="space-y-1">
            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Grounding & Research</h4>
            <p className="text-[10px] text-neutral-400 leading-normal">Ask for real-world data: <span className="italic text-indigo-200">"Research the dimensions of the Parthenon and draft its floor plan"</span>. The AI uses Google Search to find accurate building data.</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Sketch Interpretation</h4>
            <p className="text-[10px] text-neutral-400 leading-normal">Use the <b>SKETCH</b> tool to draw a rough layout. The Principal Architect will analyze the image and replace it with professional CAD entities.</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Live Voice Drafting</h4>
            <p className="text-[10px] text-neutral-400 leading-normal">Tap the microphone to start a live session. You can talk through design changes while the engine drafts in real-time.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection title="Modification Tools" icon={Zap}>
        <CommandItem cmd="MOVE" alias="M" desc="Shift selected entities using a base point." />
        <CommandItem cmd="TRIM" alias="TR" desc="Cut segments that intersect other shapes." />
        <CommandItem cmd="OFFSET" alias="O" desc="Create parallel copies of lines or shapes." />
        <CommandItem cmd="ERASE" alias="E" desc="Delete selected entities (Type ALL for full clear)." />
      </HelpSection>
    </div>
  );


  const renderPrivacy = () => (
    <div className="p-5 space-y-6">
      <div className="text-center pb-4 border-b border-white/5">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
          <Zap size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Privacy Protocol</h2>
        <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold tracking-widest">Last Updated: April 2026</p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-cyan-400 rounded-full" /> Data Collection
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            VoxCADD operates as a client-side drafting engine. Your architectural designs (.vox, .dxf) are stored locally in your browser's indexedDB or device storage. We do not transmit your drawing data to any central server unless explicitly shared by you through our collaboration features.
          </p>
        </div>

        <div>
          <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-cyan-400 rounded-full" /> Architectural AI
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            When you consult the Principal Architect (AI), only the necessary context (entity counts, scale, and active command) and your specified prompt are sent to the LLM processor. This interaction is transient and session-based.
          </p>
        </div>

        <div>
          <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-cyan-400 rounded-full" /> Device Permissions
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            The application requests camera and microphone access solely for the AI Voice Drafting and Sketch Interpretation features. This data is processed in real-time and is not recorded on our systems.
          </p>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
          <p className="text-[10px] text-neutral-500 leading-snug">
            By using VoxCADD, you consent to this localized data processing protocol. For advanced enterprise security audits, please contact the developer directly.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed left-1/2 top-10 -translate-x-1/2 w-[340px] max-w-[95vw] bg-[#1a1a1a] border border-neutral-800 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
      style={{ 
        transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
        zIndex: isInteracting ? 9999 : 500
      }}
      onMouseDown={() => setIsInteracting(true)}
      onTouchStart={() => setIsInteracting(true)}
    >
      <div 
        className="flex justify-between items-center p-4 border-b border-neutral-800 bg-[#222] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => { e.stopPropagation(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => { e.stopPropagation(); if (e.touches.length > 0) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          {type === 'help' && <HelpCircle size={18} className="text-cyan-400" />}
          {type === 'about' && <Info size={18} className="text-cyan-400" />}
          {type === 'privacy' && <Zap size={18} className="text-emerald-400" />}
          <h3 className="text-xs font-black text-neutral-200 uppercase tracking-widest">
            {type === 'help' ? 'Help & Commands' : type === 'about' ? 'About VoxCADD' : 'Privacy protocol'}
          </h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none max-h-[75vh]">
        {type === 'help' && renderHelp()}
        {type === 'about' && renderAbout()}
        {type === 'privacy' && renderPrivacy()}
      </div>

      <div className="p-4 bg-[#121212] border-t border-neutral-800 flex justify-end shrink-0">
        <button 
          onClick={onClose}
          className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-black uppercase rounded-lg transition-all"
        >
          Close Dialog
        </button>
      </div>
    </div>
  );
};

export default InfoPanel;
