
import React, { useState } from 'react';
import { 
  Move, Minus, Square, Circle, 
  RotateCw, Ruler, Hash, Target, Maximize, Trash2, 
  PenTool, BoxSelect, Navigation, Monitor, Scaling, FlipHorizontal, Maximize2, Ungroup,
  ZoomIn, ZoomOut, Hand, Scissors, CopyPlus, Hexagon, CircleDashed,
  RotateCcw, RotateCw as RedoIcon, FileEdit, Weight,
  FilePlus, FolderOpen, Save, Share2, Calculator, Layers, Sliders, XCircle,
  LayoutGrid, MousePointer2, Clipboard, Copy, Spline,
  Infinity, ArrowUpRight, Rows, Dot, CircleOff, Type, AlignLeft, MousePointer, 
  Zap, Pencil, Activity, Grid3X3, Layers2, Settings2, Info, Lock, Eye, EyeOff,
  Package, Grid2X2, Download, Search, Filter, MonitorPlay,
  ArrowRightLeft, Radius, Diameter, Settings
} from 'lucide-react';
import { AppSettings } from '../types';
import { ToolbarCategory } from '../App';

interface ToolbarProps {
  category: ToolbarCategory;
  settings: AppSettings;
  activePanel: string;
  onSettingChange: (settings: AppSettings) => void;
  onAction: (action: string, payload?: any) => void;
  onCommand: (cmd: string) => void;
  activeCommandName?: string;
  showCircleOptions?: boolean;
  showArcOptions?: boolean;
  showEllipseOptions?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

const ToolCircleBtn: React.FC<{ 
    icon: React.ReactNode, 
    label: string, 
    onClick: () => void, 
    onLongPress?: () => void,
    active?: boolean,
    danger?: boolean,
    disabled?: boolean
}> = ({ icon, label, onClick, onLongPress, active, danger, disabled }) => {
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = React.useRef<any>(null);
    const longPressTriggered = React.useRef(false);

    const handleStart = () => {
        if (!onLongPress || disabled) return;
        longPressTriggered.current = false;
        timerRef.current = setTimeout(() => {
            onLongPress();
            longPressTriggered.current = true;
            if (navigator.vibrate) navigator.vibrate([30, 50]);
        }, 600);
    };

    const handleEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return;
        if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
        }
        if (navigator.vibrate) navigator.vibrate(10);
        onClick();
    };

    return (
        <button 
            onClick={handleClick} 
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={() => { handleEnd(); setIsHovered(false); }}
            onMouseEnter={() => setIsHovered(true)}
            onTouchStart={(e) => { handleStart(); }}
            onTouchEnd={(e) => { handleEnd(); }}
            disabled={disabled}
            className={`flex-shrink-0 flex flex-col items-center justify-center active:scale-90 no-tap py-1 px-1 transition-all duration-200 ${disabled ? 'opacity-20 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <div className={`w-[44px] h-[44px] rounded-full border flex items-center justify-center transition-all duration-300 relative
                ${active ? 'bg-[#00bcd4] text-black border-[#00bcd4] scale-110 z-10' : 
                  danger ? 'bg-red-950/20 border-red-900/40 text-red-500 hover:border-red-500 hover:bg-red-500/10' :
                  'bg-[#121214] border-white/10 text-neutral-400'}
                ${isHovered && !active && !disabled ? 'border-[#00bcd4] text-[#00bcd4] scale-105' : ''}`}
            >
                {React.cloneElement(icon as React.ReactElement, { size: 19, strokeWidth: active ? 2.5 : 2 })}
            </div>
            <span className={`text-[8px] font-black uppercase mt-1.5 tracking-[0.1em] leading-none transition-colors duration-300 ${active ? 'text-[#00bcd4]' : isHovered ? 'text-neutral-300' : 'text-neutral-600'}`}>{label}</span>
        </button>
    );
};

const Toolbar: React.FC<ToolbarProps> = ({ category, onCommand, onAction, settings, activePanel, onSettingChange, canUndo, canRedo, activeCommandName, showCircleOptions, showArcOptions, showEllipseOptions }) => {
  const [dimFlyoutOpen, setDimFlyoutOpen] = useState(false);

    const btnRef = React.useRef<HTMLDivElement>(null);
    const [flyoutPos, setFlyoutPos] = useState({ x: 0, y: 0 });

    const toggleFlyout = () => {
        if (!dimFlyoutOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setFlyoutPos({ x: rect.left, y: rect.top });
        }
        setDimFlyoutOpen(!dimFlyoutOpen);
    };

  const renderContent = () => {
    switch (category) {
      case 'Draw':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('l')} icon={<Minus className="rotate-45" />} label="LINE" active={activeCommandName === 'LINE'} />
            <ToolCircleBtn onClick={() => onCommand('pl')} icon={<PenTool />} label="PLINE" active={activeCommandName === 'PLINE'} />
            <ToolCircleBtn onClick={() => onCommand('spl')} icon={<Spline />} label="SPLINE" active={activeCommandName === 'SPLINE'} />
            <ToolCircleBtn onClick={() => onCommand('c')} icon={<Circle />} label="CIRCLE" active={activeCommandName === 'CIRCLE'} />
            <ToolCircleBtn onClick={() => onCommand('rec')} icon={<Square />} label="RECT" active={activeCommandName === 'RECT'} />
            <ToolCircleBtn onClick={() => onCommand('pol')} icon={<Hexagon />} label="POLY" active={activeCommandName === 'POLYGON'} />
            <ToolCircleBtn onClick={() => onCommand('a')} icon={<RotateCw />} label="ARC" active={activeCommandName === 'ARC'} />
            <ToolCircleBtn onClick={() => onCommand('el')} icon={<CircleDashed />} label="ELLIPSE" active={activeCommandName === 'ELLIPSE'} />
            <ToolCircleBtn onClick={() => onCommand('xl')} icon={<Infinity />} label="XLINE" active={activeCommandName === 'XLINE'} />
            <ToolCircleBtn onClick={() => onCommand('ray')} icon={<ArrowUpRight />} label="XRAY" active={activeCommandName === 'RAY'} />
            <ToolCircleBtn onClick={() => onCommand('dl')} icon={<Rows />} label="DLINE" active={activeCommandName === 'DLINE'} />
            <ToolCircleBtn onClick={() => onCommand('po')} icon={<Dot />} label="POINT" active={activeCommandName === 'POINT'} />
            <ToolCircleBtn onClick={() => onCommand('donut')} icon={<CircleOff />} label="DONUT" active={activeCommandName === 'DONUT'} />
          </>
        );
      case 'Modify':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('m')} icon={<Move />} label="MOVE" active={activeCommandName === 'MOVE'} />
            <ToolCircleBtn onClick={() => onCommand('ro')} icon={<RotateCw />} label="ROTATE" active={activeCommandName === 'ROTATE'} />
            <ToolCircleBtn onClick={() => onCommand('sc')} icon={<Scaling />} label="SCALE" active={activeCommandName === 'SCALE'} />
            <ToolCircleBtn onClick={() => onCommand('mi')} icon={<FlipHorizontal />} label="MIRROR" active={activeCommandName === 'MIRROR'} />
            <ToolCircleBtn onClick={() => onCommand('co')} icon={<Copy />} label="COPY" active={activeCommandName === 'COPY'} />
            <ToolCircleBtn onClick={() => onCommand('s')} icon={<Maximize />} label="STRCH" active={activeCommandName === 'STRETCH'} />
            <ToolCircleBtn onClick={() => onCommand('tr')} icon={<Scissors />} label="TRIM" active={activeCommandName === 'TRIM'} />
            <ToolCircleBtn onClick={() => onCommand('ex')} icon={<Maximize2 />} label="EXTEND" active={activeCommandName === 'EXTEND'} />
            <ToolCircleBtn onClick={() => onCommand('x')} icon={<Ungroup />} label="EXPLODE" active={activeCommandName === 'EXPLODE'} />
            <ToolCircleBtn onClick={() => onCommand('ar')} icon={<Grid2X2 />} label="ARRAY" active={activeCommandName === 'ARRAY'} />
            <ToolCircleBtn onClick={() => onCommand('block')} icon={<Package />} label="BLOCK" active={activeCommandName === 'BLOCK'} />
            <ToolCircleBtn onClick={() => onCommand('insert')} icon={<Download />} label="INSERT" active={activeCommandName === 'INSERT'} />
            <ToolCircleBtn onClick={() => onCommand('o')} icon={<CopyPlus />} label="OFFSET" active={activeCommandName === 'OFFSET'} />
            <ToolCircleBtn onClick={() => onCommand('f')} icon={<Zap />} label="FILLET" active={activeCommandName === 'FILLET'} />
            <ToolCircleBtn onClick={() => onCommand('e')} icon={<Trash2 />} label="ERASE" danger active={activeCommandName === 'ERASE'} />
            <ToolCircleBtn onClick={() => onAction('cancel')} icon={<XCircle />} label="CANCEL" />
          </>
        );
      case 'Edit':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('select')} icon={<MousePointer2 />} label="SELECT" active={activeCommandName === 'SELECT'} />
            <ToolCircleBtn onClick={() => onAction('undo')} icon={<RotateCcw />} label="UNDO" disabled={!canUndo} />
            <ToolCircleBtn onClick={() => onCommand('all')} icon={<MousePointer />} label="ALL" />
            <ToolCircleBtn onClick={() => onCommand('cut')} icon={<Scissors />} label="CUT" />
            <ToolCircleBtn onClick={() => onCommand('copyclip')} icon={<Copy />} label="COPY" />
            <ToolCircleBtn onClick={() => onCommand('paste')} icon={<Clipboard />} label="PASTE" />
            <ToolCircleBtn onClick={() => onAction('toggleProperties')} icon={<Settings2 />} label="PROPS" />
            <ToolCircleBtn onClick={() => onCommand('sketch')} icon={<Pencil />} label="SKETCH" active={activeCommandName === 'SKETCH'} />
          </>
        );
      case 'Anno':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('mt')} icon={<AlignLeft />} label="MTEXT" active={activeCommandName === 'MTEXT'} />
            <ToolCircleBtn onClick={() => onCommand('t')} icon={<Type />} label="TEXT" active={activeCommandName === 'TEXT'} />
            <div className="relative shrink-0" ref={btnRef}>
                <ToolCircleBtn 
                    onClick={() => { if (dimFlyoutOpen) setDimFlyoutOpen(false); else onCommand('dimlinear'); }} 
                    onLongPress={toggleFlyout}
                    icon={<div className="relative"><Ruler />{dimFlyoutOpen && <div className="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full w-2 h-2" />}</div>} 
                    label="DIM"
                    active={activeCommandName?.startsWith('DIM')} 
                />
                {dimFlyoutOpen && (
                    <>
                    <div className="fixed inset-0 z-[1050]" onClick={() => setDimFlyoutOpen(false)} />
                    <div 
                        className="fixed bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1100] animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-200 min-w-[180px]"
                        style={{ 
                            left: Math.max(10, Math.min(flyoutPos.x - 90, window.innerWidth - 190)), 
                            bottom: (window.innerHeight - flyoutPos.y) + 8
                        }}
                    >
                        <div className="px-3 py-1.5 border-b border-white/5 mb-1 text-center">
                            <div className="text-[7.5px] font-black uppercase text-cyan-500 tracking-widest">Dimension Tools</div>
                        </div>
                        <button onClick={() => { onCommand('dimlinear'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <ArrowRightLeft size={14} className="text-cyan-500" /> Linear
                        </button>
                        <button onClick={() => { onCommand('aligned'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <ArrowUpRight size={14} className="text-cyan-500" /> Aligned
                        </button>
                        <button onClick={() => { onCommand('dimradius'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <Radius size={14} className="text-cyan-500" /> Radius
                        </button>
                        <button onClick={() => { onCommand('dimdiam'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <Diameter size={14} className="text-cyan-500" /> Diameter
                        </button>
                        <button onClick={() => { onCommand('angular'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <RotateCw size={14} className="text-cyan-500" /> Angular
                        </button>
                        <button onClick={() => { onCommand('dimarc'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <Activity size={14} className="text-cyan-500" /> Arc Length
                        </button>
                        <button onClick={() => { onCommand('dimord'); setDimFlyoutOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
                            <Target size={14} className="text-cyan-500" /> Ordinate
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button 
                            onClick={() => { onAction('toggleDimStyle'); setDimFlyoutOpen(false); }} 
                            className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl bg-cyan-500/10 text-cyan-500 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500 hover:text-black transition-all active:scale-95"
                        >
                            <Settings size={12} /> Dimension Styles
                        </button>
                    </div>
                    </>
                )}
            </div>
            <ToolCircleBtn onClick={() => onCommand('lea')} icon={<Navigation className="rotate-[-135deg]" />} label="LEADER" active={activeCommandName === 'LEADER'} />
            <ToolCircleBtn onClick={() => onCommand('dist')} icon={<Target />} label="DIST" active={activeCommandName === 'DIST'} />
            <ToolCircleBtn onClick={() => onCommand('area')} icon={<BoxSelect />} label="AREA" active={activeCommandName === 'AREA'} />
            <ToolCircleBtn onClick={() => onCommand('h')} icon={<Grid3X3 />} label="HATCH" active={activeCommandName === 'HATCH'} />
          </>
        );
      case 'View':
        return (
          <>
            <ToolCircleBtn onClick={() => onAction('zoomExtents')} icon={<Maximize />} label="FULL" />
            <ToolCircleBtn onClick={() => onAction('zoomIn')} icon={<ZoomIn />} label="IN" />
            <ToolCircleBtn onClick={() => onAction('zoomOut')} icon={<ZoomOut />} label="OUT" />
            <ToolCircleBtn onClick={() => onCommand('p')} icon={<Hand />} label="PAN" active={activeCommandName === 'PAN'} />
          </>
        );
      case 'Tools': // TOOLS
        return (
          <>
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, snap: !settings.snap })} icon={<Target />} label="SNAP" active={settings.snap} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, ortho: !settings.ortho })} icon={<Hash />} label="ORTHO" active={settings.ortho} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, grid: !settings.grid })} icon={<LayoutGrid />} label="GRID" active={settings.grid} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, showHUD: !settings.showHUD })} icon={<Monitor />} label="HUD" active={settings.showHUD} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, showLineWeights: !settings.showLineWeights })} icon={<Weight />} label="L-WEIGHT" active={settings.showLineWeights} />
            <ToolCircleBtn onClick={() => onAction('toggleLayers')} icon={<Layers2 />} label="LAYERS" active={activePanel === 'layers'} />
            <ToolCircleBtn onClick={() => onAction('toggleProperties')} icon={<Settings2 />} label="PROPS" active={activePanel === 'properties'} />
            <ToolCircleBtn onClick={() => onAction('toggleDraftingSettings')} icon={<Sliders />} label="DRAFT" active={activePanel === 'drafting'} />
            <ToolCircleBtn onClick={() => onAction('toggleCalculator')} icon={<Calculator />} label="CALC" active={activePanel === 'calculator'} />
            <ToolCircleBtn onClick={() => onCommand('filter')} icon={<Filter />} label="FILTER" active={activeCommandName === 'FILTER'} />
            <ToolCircleBtn onClick={() => onCommand('find')} icon={<Search />} label="FIND" active={activeCommandName === 'FIND'} />
            <ToolCircleBtn onClick={() => onCommand('vports')} icon={<MonitorPlay />} label="VPORTS" active={activeCommandName === 'VIEWPORT'} />
            <ToolCircleBtn onClick={() => onAction('toggleAbout')} icon={<Info />} label="ABOUT" active={activePanel === 'about'} />
          </>
        );
      default: return null;
    }
  };

  return (
    <div className="w-full flex flex-col bg-black pt-1 pb-1 border-t border-white/5 transition-all">
      {showCircleOptions && activeCommandName === 'CIRCLE' && (
        <div className="flex items-center gap-2 px-4 h-10 border-b border-white/5 bg-[#0a0a0c] animate-in slide-in-from-bottom-2 duration-200 overflow-x-auto scrollbar-none">
           <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mr-2 border-r border-white/10 pr-2 shrink-0">CIRCLE MODES</span>
           <button onClick={() => onCommand('center')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Center</button>
           <button onClick={() => onCommand('2p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">2P</button>
           <button onClick={() => onCommand('3p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">3P</button>
           <button onClick={() => onCommand('ttr')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">TTR</button>
           <div className="w-[1px] h-4 bg-white/10 mx-2 shrink-0" />
           <button onClick={() => onAction('cancel')} className="shrink-0 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
        </div>
      )}
      {showArcOptions && activeCommandName === 'ARC' && (
        <div className="flex items-center gap-2 px-4 h-10 border-b border-white/5 bg-[#0a0a0c] animate-in slide-in-from-bottom-2 duration-200 overflow-x-auto scrollbar-none">
           <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mr-2 border-r border-white/10 pr-2 shrink-0">ARC MODES</span>
           <button onClick={() => onCommand('center')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Center</button>
           <button onClick={() => onCommand('2p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">2P</button>
           <button onClick={() => onCommand('3p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">3P</button>
           <button onClick={() => onCommand('tan')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Tan</button>
           <div className="w-[1px] h-4 bg-white/10 mx-2 shrink-0" />
           <button onClick={() => onAction('cancel')} className="shrink-0 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
        </div>
      )}
      {showEllipseOptions && activeCommandName === 'ELLIPSE' && (
        <div className="flex items-center gap-2 px-4 h-10 border-b border-white/5 bg-[#0a0a0c] animate-in slide-in-from-bottom-2 duration-200 overflow-x-auto scrollbar-none">
           <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mr-2 border-r border-white/10 pr-2 shrink-0">ELLIPSE MODES</span>
           <button onClick={() => onCommand('center')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Center</button>
           <button onClick={() => onCommand('2p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">2P</button>
           <button onClick={() => onCommand('3p')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">3P</button>
           <button onClick={() => onCommand('tan')} className="shrink-0 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Tan</button>
           <div className="w-[1px] h-4 bg-white/10 mx-2 shrink-0" />
           <button onClick={() => onAction('cancel')} className="shrink-0 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
        </div>
      )}
      <div className="w-full flex items-center gap-4 px-4 h-[64px] overflow-x-auto scrollbar-none touch-pan-x overscroll-x-contain">
        {renderContent()}
      </div>
    </div>
  );
};

export default Toolbar;
