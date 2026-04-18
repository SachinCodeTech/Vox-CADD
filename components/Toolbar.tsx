
import React from 'react';
import { 
  Move, Minus, Square, Circle, 
  RotateCw, Ruler, Hash, Target, Maximize, Trash2, 
  PenTool, BoxSelect, Navigation, Monitor,
  ZoomIn, ZoomOut, Hand, Scissors, CopyPlus, Hexagon, CircleDashed,
  RotateCcw, RotateCw as RedoIcon, FileEdit, Weight,
  FilePlus, FolderOpen, Save, Share2, Calculator, Layers, Sliders, XCircle,
  LayoutGrid, MousePointer2, Clipboard, Copy, Spline
} from 'lucide-react';
import { AppSettings } from '../types';
import { ToolbarCategory } from '../App';

interface ToolbarProps {
  category: ToolbarCategory;
  settings: AppSettings;
  onSettingChange: (settings: AppSettings) => void;
  onAction: (action: string, payload?: any) => void;
  onCommand: (cmd: string) => void;
  activeCommandName?: string;
  showCircleOptions?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

const ToolCircleBtn: React.FC<{ 
    icon: React.ReactNode, 
    label: string, 
    onClick: () => void, 
    active?: boolean,
    danger?: boolean,
    disabled?: boolean
}> = ({ icon, label, onClick, active, danger, disabled }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`flex-shrink-0 flex flex-col items-center justify-center active:scale-90 no-tap ${disabled ? 'opacity-20 grayscale' : ''}`}
    >
        <div className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all
            ${active ? 'bg-[#00bcd4] text-black border-[#00bcd4] shadow-[0_0_12px_rgba(0,188,212,0.4)]' : 
              danger ? 'bg-red-950/20 border-red-900/40 text-red-500' :
              'bg-[#121214] border-white/5 text-neutral-500 hover:text-white'}`}
        >
            {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <span className={`text-[7px] font-black uppercase mt-1 tracking-widest ${active ? 'text-[#00bcd4]' : 'text-neutral-600'}`}>{label}</span>
    </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ category, onCommand, onAction, settings, onSettingChange, canUndo, canRedo, activeCommandName, showCircleOptions }) => {
  const renderContent = () => {
    switch (category) {
      case 'Draw':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('l')} icon={<Minus className="rotate-45" />} label="LINE" active={activeCommandName === 'LINE'} />
            <ToolCircleBtn onClick={() => onCommand('pl')} icon={<PenTool />} label="PLINE" active={activeCommandName === 'POLYLINE'} />
            <ToolCircleBtn onClick={() => onCommand('spl')} icon={<Spline />} label="SPLINE" active={activeCommandName === 'SPLINE'} />
            <ToolCircleBtn onClick={() => onCommand('c')} icon={<Circle />} label="CIRCLE" active={activeCommandName === 'CIRCLE'} />
            <ToolCircleBtn onClick={() => onCommand('rec')} icon={<Square />} label="RECT" active={activeCommandName === 'RECTANGLE'} />
            <ToolCircleBtn onClick={() => onCommand('pol')} icon={<Hexagon />} label="POLY" active={activeCommandName === 'POLYGON'} />
            <ToolCircleBtn onClick={() => onCommand('a')} icon={<RotateCw />} label="ARC" active={activeCommandName === 'ARC'} />
            <ToolCircleBtn onClick={() => onCommand('el')} icon={<CircleDashed />} label="ELLIPSE" active={activeCommandName === 'ELLIPSE'} />
          </>
        );
      case 'Modify':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('m')} icon={<Move />} label="MOVE" />
            <ToolCircleBtn onClick={() => onCommand('tr')} icon={<Scissors />} label="TRIM" />
            <ToolCircleBtn onClick={() => onCommand('o')} icon={<CopyPlus />} label="OFFSET" />
            <ToolCircleBtn onClick={() => onCommand('e')} icon={<Trash2 />} label="ERASE" danger />
            <ToolCircleBtn onClick={() => onAction('cancel')} icon={<XCircle />} label="CANCEL" />
          </>
        );
      case 'Edit':
        return (
          <>
            <ToolCircleBtn onClick={() => onAction('undo')} icon={<RotateCcw />} label="UNDO" disabled={!canUndo} />
            <ToolCircleBtn onClick={() => onCommand('all')} icon={<MousePointer2 />} label="ALL" />
            <ToolCircleBtn onClick={() => onCommand('cut')} icon={<Scissors />} label="CUT" />
            <ToolCircleBtn onClick={() => onCommand('copy')} icon={<Copy />} label="COPY" />
            <ToolCircleBtn onClick={() => onCommand('paste')} icon={<Clipboard />} label="PASTE" />
          </>
        );
      case 'Anno':
        return (
          <>
            <ToolCircleBtn onClick={() => onCommand('mt')} icon={<FileEdit />} label="MTEXT" />
            <ToolCircleBtn onClick={() => onCommand('t')} icon={<FileEdit size={14}/>} label="TEXT" />
            <ToolCircleBtn onClick={() => onCommand('dim')} icon={<Ruler />} label="DIM" />
            <ToolCircleBtn onClick={() => onCommand('dist')} icon={<Target />} label="DIST" />
            <ToolCircleBtn onClick={() => onCommand('area')} icon={<BoxSelect />} label="AREA" />
          </>
        );
      case 'View':
        return (
          <>
            <ToolCircleBtn onClick={() => onAction('zoomExtents')} icon={<Maximize />} label="FULL" />
            <ToolCircleBtn onClick={() => onAction('zoomIn')} icon={<ZoomIn />} label="IN" />
            <ToolCircleBtn onClick={() => onAction('zoomOut')} icon={<ZoomOut />} label="OUT" />
            <ToolCircleBtn onClick={() => onCommand('p')} icon={<Hand />} label="PAN" />
          </>
        );
      case 'Assist': // TOOLS
        return (
          <>
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, snap: !settings.snap })} icon={<Target />} label="SNAP" active={settings.snap} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, ortho: !settings.ortho })} icon={<Hash />} label="ORTHO" active={settings.ortho} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, grid: !settings.grid })} icon={<LayoutGrid />} label="GRID" active={settings.grid} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, showHUD: !settings.showHUD })} icon={<Monitor />} label="HUD" active={settings.showHUD} />
            <ToolCircleBtn onClick={() => onSettingChange({ ...settings, showLineWeights: !settings.showLineWeights })} icon={<Weight />} label="L-WEIGHT" active={settings.showLineWeights} />
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
      <div className="flex items-center gap-4 px-4 h-[72px] overflow-x-auto scrollbar-none">
        {renderContent()}
      </div>
    </div>
  );
};

export default Toolbar;
