
import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, Info, User, Briefcase, Activity, Calendar, ShieldCheck, PenLine } from 'lucide-react';
import { AppSettings } from '../types';

interface DrawingPropertiesProps {
  settings: AppSettings;
  onConfirm: (metadata: any, newTitle: string) => void;
  onClose: () => void;
  entityCount: number;
  currentFileName: string;
}

const DrawingProperties: React.FC<DrawingPropertiesProps> = ({ settings, onConfirm, onClose, entityCount, currentFileName }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Internal state for smooth editing
  const [localMetadata, setLocalMetadata] = useState(settings.metadata || {
    author: '',
    createdAt: '',
    revision: '',
    projectRevision: '',
    description: ''
  });
  const [localTitle, setLocalTitle] = useState(currentFileName.replace(/\.(vox|dxf)$/i, ''));

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

  const handleConfirm = () => {
    const ext = currentFileName.toLowerCase().endsWith('.dxf') ? '.dxf' : '.vox';
    const finalName = localTitle.endsWith('.vox') || localTitle.endsWith('.dxf') ? localTitle : localTitle + ext;
    
    onConfirm(
      { ...localMetadata, lastModified: new Date().toISOString() },
      finalName
    );
  };

  const PropertySection = ({ title, icon: Icon, children, accent = "cyan" }: { title: string, icon: any, children?: React.ReactNode, accent?: string }) => (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon size={14} className={accent === "cyan" ? "text-cyan-500" : "text-amber-500"} />
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">{title}</span>
      </div>
      <div className="space-y-3 bg-neutral-900/30 rounded-xl p-4 border border-white/5 shadow-inner">
        {children}
      </div>
    </div>
  );

  const InputField = ({ label, value, onChange, placeholder, icon: Icon }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, icon?: any }) => (
    <div className="space-y-1.5">
      <label className="text-[9px] font-bold text-neutral-600 uppercase pl-1">{label}</label>
      <div className="relative group">
        {Icon && <Icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-cyan-500 transition-colors" />}
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
          className={`w-full bg-black/40 border border-neutral-800 rounded-xl py-2.5 ${Icon ? 'pl-9' : 'px-3'} pr-3 text-[11px] text-neutral-200 outline-none focus:border-cyan-600 transition-all font-bold placeholder:text-neutral-800 select-text cursor-text`}
        />
      </div>
    </div>
  );

  return (
    <div 
      className="fixed left-1/2 top-20 -translate-x-1/2 w-[340px] max-w-[95vw] glass-panel rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{ 
        transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
        zIndex: isInteracting ? 9999 : 500
      }}
      onMouseDown={() => setIsInteracting(true)}
      onTouchStart={() => setIsInteracting(true)}
    >
      <div 
        className="flex justify-between items-center p-6 border-b border-neutral-800/50 bg-[#151517] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => { e.stopPropagation(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => { e.stopPropagation(); if (e.touches.length > 0) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <Briefcase size={20} className="text-amber-400" />
          <div>
            <h3 className="text-[12px] font-black text-neutral-100 uppercase tracking-[0.2em]">Project Properties</h3>
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Metadata Profile</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-none max-h-[60vh]">
        
        {/* Simplified Project Info */}
        <PropertySection title="General Information" icon={FileText} accent="amber">
          <InputField 
            label="Project Title" 
            value={localTitle} 
            onChange={(v) => setLocalTitle(v)} 
            placeholder="Drawing1" 
            icon={PenLine} 
          />
          <InputField 
            label="Draughter" 
            value={localMetadata.author || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, author: v }))} 
            placeholder="ARCHITECT NAME" 
            icon={User} 
          />
          <div className="grid grid-cols-2 gap-3">
             <InputField 
                label="Date" 
                value={localMetadata.createdAt || ''} 
                onChange={(v) => setLocalMetadata(prev => ({ ...prev, createdAt: v }))} 
                icon={Calendar} 
              />
             <InputField 
                label="Revision" 
                value={localMetadata.revision || ''} 
                onChange={(v) => setLocalMetadata(prev => ({ ...prev, revision: v }))} 
                icon={ShieldCheck} 
              />
          </div>
          <InputField 
            label="Project Revision" 
            value={localMetadata.projectRevision || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, projectRevision: v }))} 
            placeholder="e.g. V-1.0.0" 
            icon={ShieldCheck} 
          />
          <InputField 
            label="Project Description" 
            value={localMetadata.description || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, description: v }))} 
            placeholder="PROJECT NOTES..." 
            icon={PenLine} 
          />
        </PropertySection>

        {/* Live Workspace Status */}
        <PropertySection title="Drawing Statistics" icon={Activity}>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/60 p-4 rounded-xl border border-white/5">
              <div className="text-[8px] font-black text-neutral-600 uppercase mb-1">Entity Count</div>
              <div className="text-2xl font-black text-cyan-400 font-mono tracking-tighter">{entityCount}</div>
            </div>
            <div className="bg-black/60 p-4 rounded-xl border border-white/5">
              <div className="text-[8px] font-black text-neutral-600 uppercase mb-1">Current Layer</div>
              <div className="text-[10px] font-black text-white truncate uppercase tracking-widest mt-2">{settings.currentLayer}</div>
            </div>
          </div>
        </PropertySection>

        <div className="mt-4 p-5 bg-amber-950/10 rounded-2xl border border-amber-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Metadata Insight</span>
          </div>
          <p className="text-[10px] leading-relaxed text-neutral-400 font-medium">
            This panel manages high-level architectural metadata. Drafting units and snap settings are accessible via the main drafting dashboard.
          </p>
        </div>
      </div>

      <div className="p-6 bg-[#0f0f11] border-t border-neutral-800/50 shrink-0">
        <button 
          onClick={handleConfirm}
          className="w-full py-4 bg-amber-600 text-black text-[12px] font-black uppercase rounded-2xl shadow-xl shadow-amber-950/20 active:scale-95 transition-all"
        >
          Confirm Metadata
        </button>
      </div>
    </div>
  );
};

export default DrawingProperties;
