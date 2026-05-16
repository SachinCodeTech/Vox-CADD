
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

const PropertySection = ({ title, icon: Icon, children, accent = "cyan" }: { title: string, icon: any, children?: React.ReactNode, accent?: string }) => (
  <div className="mb-4 last:mb-0">
    <div className="flex items-center gap-2 mb-2 px-1">
      <Icon size={12} className={accent === "cyan" ? "text-cyan-500" : "text-amber-500"} />
      <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">{title}</span>
    </div>
    <div className="space-y-2 bg-neutral-950/40 rounded-xl p-3 border border-white/5">
      {children}
    </div>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, icon: Icon, isTextArea }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, icon?: any, isTextArea?: boolean }) => {
  const id = React.useId();
  const InputComponent = isTextArea ? 'textarea' : 'input';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[8px] font-bold text-neutral-700 uppercase pl-1 cursor-pointer hover:text-neutral-500 transition-colors tracking-widest">{label}</label>
      <div className="relative group">
        {Icon && <Icon size={10} className={`absolute left-2.5 ${isTextArea ? 'top-3.5' : 'top-1/2 -translate-y-1/2'} text-neutral-600 group-focus-within:text-amber-500 transition-colors pointer-events-none`} />}
        <InputComponent 
          id={id}
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
          className={`w-full bg-black/40 border border-neutral-900 rounded-lg py-2 ${Icon ? 'pl-8' : 'px-3'} pr-3 text-[10px] text-neutral-300 outline-none focus:border-amber-600/50 focus:bg-black/60 hover:border-neutral-800 transition-all font-bold placeholder:text-neutral-900 select-text cursor-text ${isTextArea ? 'min-h-[60px] resize-none py-2' : ''}`}
        />
      </div>
    </div>
  );
};

const DrawingProperties: React.FC<DrawingPropertiesProps> = ({ settings, onConfirm, onClose, entityCount, currentFileName }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Internal state for smooth editing
  const [localMetadata, setLocalMetadata] = useState({
    author: '',
    createdAt: new Date().toISOString().split('T')[0],
    revision: 'REV-01',
    projectRevision: 'V-1.0',
    description: '',
    ...(settings.metadata || {})
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

  return (
    <div 
      className="relative bg-[#0a0a0c]/95 backdrop-blur-3xl w-[320px] max-w-[95vw] border border-white/10 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden font-sans"
    >
      <div 
        className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-white/[0.02] shrink-0"
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <Briefcase size={18} className="text-amber-400" />
          <div>
            <h3 className="text-[11px] font-black text-neutral-200 uppercase tracking-[0.2em]">Project Properties</h3>
            <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest">Metadata Profile</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-neutral-600 transition-colors active:scale-90">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-none max-h-[55vh]">
        
        {/* Simplified Project Info */}
        <PropertySection title="General Context" icon={FileText} accent="amber">
          <InputField 
            label="Project Name" 
            value={localTitle} 
            onChange={(v) => setLocalTitle(v)} 
            placeholder="Drawing1" 
            icon={PenLine} 
          />
          <InputField 
            label="Design Lead" 
            value={localMetadata.author || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, author: v }))} 
            placeholder="ARCHITECT" 
            icon={User} 
          />
          <div className="grid grid-cols-2 gap-2">
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
            label="Version" 
            value={localMetadata.projectRevision || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, projectRevision: v }))} 
            placeholder="e.g. V-1.0.0" 
            icon={ShieldCheck} 
          />
          <InputField 
            label="Project Summary" 
            value={localMetadata.description || ''} 
            onChange={(v) => setLocalMetadata(prev => ({ ...prev, description: v }))} 
            placeholder="NOTES..." 
            icon={PenLine} 
            isTextArea
          />
        </PropertySection>

        {/* Live Workspace Status */}
        <PropertySection title="Environment Stats" icon={Activity}>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/60 p-3 rounded-lg border border-white/5">
              <div className="text-[7px] font-black text-neutral-700 uppercase mb-0.5">Entities</div>
              <div className="text-xl font-black text-cyan-400 font-mono tracking-tighter">{entityCount}</div>
            </div>
            <div className="bg-black/60 p-3 rounded-lg border border-white/5">
              <div className="text-[7px] font-black text-neutral-700 uppercase mb-0.5">Active Layer</div>
              <div className="text-[9px] font-black text-white truncate uppercase tracking-widest mt-1 opacity-70">{settings.currentLayer}</div>
            </div>
          </div>
        </PropertySection>

        <div className="mt-2 p-4 bg-amber-950/10 rounded-xl border border-amber-800/10">
          <div className="flex items-center gap-2 mb-1">
            <Info size={12} className="text-amber-400" />
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">Note</span>
          </div>
          <p className="text-[9px] leading-relaxed text-neutral-600 font-medium">
            Drafting units and snap settings are handled via the drafting dashboard.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 bg-[#0a0a0c]/50 border-t border-white/5 shrink-0">
        <button 
          onClick={handleConfirm}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black text-[11px] font-black uppercase rounded-xl shadow-lg shadow-amber-950/20 active:scale-95 transition-all"
        >
          Confirm Metadata
        </button>
      </div>
    </div>
  );
};

export default DrawingProperties;
