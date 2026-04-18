
import React, { useState, useEffect, useRef } from 'react';
import { 
  Minus, Square, Circle, PenTool, Type, BoxSelect, 
  Move, RotateCw, Scaling, Copy, FlipHorizontal, Scissors, 
  ArrowUpFromLine, CornerDownLeft, Trash2, Maximize, ZoomIn, ZoomOut, 
  RotateCcw, MousePointer2, Clipboard, Ruler, SquareCheck, X, Eraser,
  Cpu, FileText, Layers, Sliders, Target, Calculator, Hand, CopyPlus, Hexagon, CircleDashed, FileEdit
} from 'lucide-react';

interface ContextPaletteProps {
  type: 'draw' | 'modify' | 'edit' | 'view' | 'tools';
  onCommand: (cmd: string) => void;
  onAction?: (action: string, payload?: any) => void;
  onClose: () => void;
}

const PaletteSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="mb-4 last:mb-0">
        <div className="px-2 mb-2">
            <span className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
            {children}
        </div>
    </div>
);

const ToolButton: React.FC<{ icon: any, label: string, onClick: () => void, danger?: boolean, active?: boolean }> = ({ icon: Icon, label, onClick, danger, active }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2.5 border rounded-xl transition-all active:scale-90 no-tap group
            ${active ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 hover:bg-white/5 text-neutral-500 hover:text-white'}
        `}
    >
        <Icon size={16} className={`${danger ? 'text-red-500' : active ? 'text-black' : 'text-neutral-500 group-hover:text-white'} mb-1 group-hover:scale-110 transition-transform`} />
        <span className={`text-[8px] font-black uppercase tracking-tighter ${danger ? 'text-red-400' : active ? 'text-black' : 'text-neutral-500 group-hover:text-white'}`}>{label}</span>
    </button>
);

const ContextPalette: React.FC<ContextPaletteProps> = ({ type, onCommand, onAction, onClose }) => {
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

    const renderContent = () => {
        switch (type) {
            case 'draw':
                return (
                    <>
                        <PaletteSection title="Vector Geometries">
                            <ToolButton icon={Minus} label="Line" onClick={() => onCommand('l')} />
                            <ToolButton icon={PenTool} label="PLine" onClick={() => onCommand('pl')} />
                            <ToolButton icon={Square} label="Rect" onClick={() => onCommand('rec')} />
                            <ToolButton icon={Circle} label="Circle" onClick={() => onCommand('c')} />
                            <ToolButton icon={RotateCw} label="Arc" onClick={() => onCommand('a')} />
                            <ToolButton icon={Hexagon} label="Poly" onClick={() => onCommand('pol')} />
                        </PaletteSection>
                        <PaletteSection title="Annotations">
                            <ToolButton icon={FileEdit} label="MText" onClick={() => onCommand('mt')} />
                            <ToolButton icon={Type} label="Text" onClick={() => onCommand('t')} />
                            <ToolButton icon={Ruler} label="Dim" onClick={() => onCommand('dim')} />
                        </PaletteSection>
                    </>
                );
            case 'modify':
                return (
                    <>
                        <PaletteSection title="Basic Transformation">
                            <ToolButton icon={Move} label="Move" onClick={() => onCommand('m')} />
                            <ToolButton icon={Copy} label="Copy" onClick={() => onCommand('m')} />
                            <ToolButton icon={RotateCw} label="Rot" onClick={() => onCommand('ro')} />
                            <ToolButton icon={Scaling} label="Scale" onClick={() => onCommand('sc')} />
                            <ToolButton icon={FlipHorizontal} label="Mir" onClick={() => onCommand('mi')} />
                            <ToolButton icon={CopyPlus} label="Offset" onClick={() => onCommand('o')} />
                        </PaletteSection>
                        <PaletteSection title="Geometry Editing">
                            <ToolButton icon={Scissors} label="Trim" onClick={() => onCommand('tr')} />
                            <ToolButton icon={ArrowUpFromLine} label="Ext" onClick={() => onCommand('ex')} />
                            <ToolButton icon={Trash2} label="Del" onClick={() => onCommand('e')} danger />
                        </PaletteSection>
                    </>
                );
            case 'view':
                return (
                    <>
                        <PaletteSection title="Zoom Control">
                            <ToolButton icon={Maximize} label="Extents" onClick={() => onCommand('z e')} />
                            <ToolButton icon={ZoomIn} label="Z-In" onClick={() => onCommand('z i')} />
                            <ToolButton icon={ZoomOut} label="Z-Out" onClick={() => onCommand('z o')} />
                        </PaletteSection>
                        <PaletteSection title="Canvas Navigation">
                            <ToolButton icon={Hand} label="Pan" onClick={() => onCommand('p')} />
                            <ToolButton icon={MousePointer2} label="Window" onClick={() => onCommand('z')} />
                        </PaletteSection>
                    </>
                );
            case 'tools':
                return (
                    <>
                        <PaletteSection title="System Tools">
                            <ToolButton icon={Cpu} label="AI Arch" onClick={() => onAction?.('toggleAiMode')} />
                            <ToolButton icon={Layers} label="Layers" onClick={() => onAction?.('toggleLayers')} />
                            <ToolButton icon={FileText} label="DrawProp" onClick={() => onAction?.('toggleDrawingProps')} />
                        </PaletteSection>
                        <PaletteSection title="Drafting & Utils">
                            <ToolButton icon={Target} label="Snaps" onClick={() => onAction?.('toggleDraftingSettings')} />
                            <ToolButton icon={Calculator} label="Calc" onClick={() => onAction?.('toggleCalculator')} />
                            <ToolButton icon={Sliders} label="Entity" onClick={() => onAction?.('toggleProperties')} />
                        </PaletteSection>
                    </>
                );
            case 'edit':
                return (
                    <PaletteSection title="Clipboard">
                        <ToolButton icon={RotateCcw} label="Undo" onClick={() => onCommand('u')} />
                        <ToolButton icon={Scissors} label="Cut" onClick={() => {}} />
                        <ToolButton icon={Clipboard} label="Paste" onClick={() => {}} />
                        <ToolButton icon={MousePointer2} label="Select All" onClick={() => onCommand('all')} />
                    </PaletteSection>
                );
        }
    };

    return (
        <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex items-center justify-center p-6 pointer-events-none"
            style={{ zIndex: 140 }}
        >
            <div 
                className="glass-panel rounded-[2rem] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.8)] max-w-[280px] w-full pointer-events-auto animate-in fade-in zoom-in-95 duration-200" 
                style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            >
                <div 
                    className="flex justify-between items-center mb-4 cursor-grab active:cursor-grabbing px-2 border-b border-white/5 pb-2"
                    onMouseDown={e => startDrag(e.clientX, e.clientY)}
                    onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                >
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] pointer-events-none">{type} Centre</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-neutral-600 transition-colors no-tap"><X size={16} /></button>
                </div>
                <div className="overflow-y-auto max-h-[50vh] scrollbar-none">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default ContextPalette;
