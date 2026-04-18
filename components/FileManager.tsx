
import React, { useState, useRef, useEffect } from 'react';
import { 
    FilePlus, FolderOpen, Save, X, 
    Database, Share2, FileCode, CheckCircle2,
    FileText, Download, Briefcase
} from 'lucide-react';

import VoxIcon from './VoxIcon';

interface FileManagerProps {
    currentName: string;
    onAction: (action: string, payload?: any) => void;
    onClose: () => void;
}

const ProjectActionBtn = ({ icon: Icon, label, sublabel, onClick, danger }: { icon: any, label: string, sublabel: string, onClick: () => void, danger?: boolean }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-start p-5 bg-[#121214] border border-white/5 rounded-[2rem] hover:bg-neutral-800/50 transition-all active:scale-[0.98] text-left group no-tap`}
    >
        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center mb-4 transition-all ${danger ? 'bg-red-500/10 text-red-500' : 'bg-neutral-800 text-neutral-400 group-hover:text-white'}`}>
            <Icon size={20} />
        </div>
        <div className="text-[12px] font-black text-white uppercase tracking-tight">{label}</div>
        <div className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">{sublabel}</div>
    </button>
);

const ExportActionBtn = ({ icon: Icon, label, sublabel, onClick, badge }: { icon: any, label: string, sublabel: string, onClick: () => void, badge?: string }) => (
    <button 
        onClick={onClick}
        className="flex items-center gap-4 p-5 bg-[#121214] border border-white/5 rounded-[1.5rem] hover:bg-neutral-800/50 transition-all active:scale-[0.98] text-left relative group no-tap"
    >
        <div className="w-10 h-10 rounded-[0.8rem] bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white transition-all">
            <Icon size={18} />
        </div>
        <div>
            <div className="text-[11px] font-black text-white uppercase tracking-tight">{label}</div>
            <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest mt-0.5">{sublabel}</div>
        </div>
        {badge && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-neutral-800 rounded text-[6px] font-black text-neutral-500 uppercase border border-white/5">
                {badge}
            </div>
        )}
    </button>
);

const FileManager: React.FC<FileManagerProps> = ({ currentName, onAction, onClose }) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
        };
        const handleEnd = () => { isDragging.current = false; };
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
        dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
    };

    return (
        <div 
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-panel w-full max-w-[380px] rounded-[3rem] shadow-[0_60px_150px_rgba(0,0,0,0.9)] border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-400 select-none" 
            style={{ 
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                zIndex: 1000
            }}
        >
            {/* Header Section */}
            <div 
                className="flex justify-between items-center p-8 pb-4 cursor-grab active:cursor-grabbing"
                onMouseDown={e => startDrag(e.clientX, e.clientY)}
                onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[1.2rem] bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <VoxIcon size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Project Center</h3>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                      <Briefcase size={10} /> Professional File Manager
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto max-h-[70vh] scrollbar-none">
                
                {/* Storage Actions Section */}
                <div>
                    <h4 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] mb-4 px-2">Storage Actions</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <ProjectActionBtn icon={FilePlus} label="New" sublabel="New Canvas" onClick={() => onAction('new')} />
                        <ProjectActionBtn icon={FolderOpen} label="Open" sublabel="Import VOX/DXF" onClick={() => onAction('open')} />
                        <ProjectActionBtn icon={VoxIcon} label="Save Project" sublabel="VOX Format" onClick={() => onAction('save')} />
                        <ProjectActionBtn icon={VoxIcon} label="Save As" sublabel=".VOX Binary" onClick={() => onAction('saveAs', 'vox')} />
                    </div>
                </div>

                {/* Pro CAD Export Section */}
                <div>
                    <div className="flex items-center justify-between px-2 mb-4">
                        <h4 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em]">Pro CAD Export</h4>
                        <div className="bg-neutral-800/50 border border-white/5 px-2 py-0.5 rounded text-[7px] font-black text-neutral-500 uppercase tracking-widest">AutoCAD Compatible</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <ExportActionBtn 
                            icon={FileCode} 
                            label="Export to CAD (.dxf)" 
                            sublabel="AutoCAD R12/2000" 
                            onClick={() => onAction('saveAs', 'dxf')} 
                        />
                        <ExportActionBtn 
                            icon={Download} 
                            label="Save as Image (.png)" 
                            sublabel="High-Res Snapshot" 
                            onClick={() => onAction('saveImage')} 
                        />
                        <ExportActionBtn 
                            icon={FileText} 
                            label="PDF Package" 
                            sublabel="Architectural Sheet" 
                            onClick={() => onAction('share', 'pdf')} 
                            badge="Standard"
                        />
                        <ExportActionBtn 
                            icon={Share2} 
                            label="Global Share" 
                            sublabel="Project Transfer" 
                            onClick={() => onAction('share')} 
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="px-8 py-5 bg-[#0a0a0c] border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">System Secure & Synced</span>
              </div>
              <span className="text-[8px] font-bold text-neutral-800 uppercase tracking-[0.2em]">VoxCadd PRD V10A</span>
            </div>
        </div>
    );
};

export default FileManager;
