
import React from 'react';
import { 
  FilePlus, FolderOpen, Save, Share2, Download, 
  Settings, Info, HelpCircle, Layout, Grid, 
  Zap, Calculator, Layers, Sliders, Ruler, Target,
  Globe, Cpu, Type, MousePointer2, Settings2, Trash2, FileText,
  Mail, MessageSquare, FileCode
} from 'lucide-react';
import { UnitType } from '../types';

import VoxIcon from './VoxIcon';

interface MenuBarProps {
  onAction: (action: string, payload?: any) => void;
  currentFileName: string;
  units: UnitType;
}

const MenuButton = ({ icon: Icon, label, color, onClick, desc }: { icon: any, label: string, color: string, onClick: () => void, desc?: string }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-[#181818] hover:bg-[#222] border border-white/5 rounded-2xl transition-all active:scale-[0.98] text-left w-full"
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} bg-opacity-10 text-opacity-100 shadow-inner`}>
      <Icon size={20} className={color.replace('bg-', 'text-')} />
    </div>
    <div className="flex-1">
      <div className="text-xs font-black text-neutral-100 uppercase tracking-tight">{label}</div>
      {desc && <div className="text-[9px] text-neutral-500 font-medium uppercase tracking-tighter">{desc}</div>}
    </div>
  </button>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 mb-3 mt-6">
    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.25em]">{label}</span>
  </div>
);

const MenuBar: React.FC<MenuBarProps> = ({ onAction, currentFileName, units }) => {
  return (
    <div className="flex-1 flex flex-col bg-[#0d0d0d] overflow-y-auto scrollbar-none pb-12 px-6">
      
      {/* Workspace Header */}
      <div className="mt-4 p-5 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0c] border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] animate-pulse"></div>
          <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Active Workspace</span>
        </div>
        <div className="text-lg font-black text-white truncate pr-2">{currentFileName || "Untitled Project"}</div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={() => onAction('save')} className="flex-1 py-3 bg-cyan-600 text-black text-[9px] font-black uppercase rounded-xl active:scale-95 transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2">
              <VoxIcon size={14} /> Save Project
            </button>
            <button onClick={() => onAction('saveAs', 'dxf')} className="flex-1 py-3 bg-neutral-800 text-cyan-400 text-[9px] font-black uppercase rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
              <FileCode size={14} /> Export DXF
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onAction('saveAs', 'vox')} className="flex-1 py-2.5 bg-neutral-900 text-neutral-400 text-[8px] font-black uppercase rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/5">
              <VoxIcon size={12} /> Save As .VOX
            </button>
            <button onClick={() => onAction('saveImage')} className="flex-1 py-2.5 bg-neutral-900 text-neutral-400 text-[8px] font-black uppercase rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/5">
              <Download size={12} /> Save Image
            </button>
          </div>
          <button onClick={() => onAction('openFileManager')} className="w-full py-3 bg-neutral-900/50 text-neutral-400 text-[9px] font-black uppercase rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/5">
            <FolderOpen size={12} /> Project Center
          </button>
        </div>
      </div>

      <SectionHeader label="Project Operations" />
      <div className="grid grid-cols-1 gap-2">
        <MenuButton 
            icon={FilePlus} 
            label="New Drawing" 
            desc="Initialize fresh drafting canvas"
            color="bg-emerald-500" 
            onClick={() => onAction('new')} 
        />
        <MenuButton 
            icon={FileText} 
            label="Project Properties" 
            desc="Manage drawing metadata and statistics"
            color="bg-amber-500" 
            onClick={() => onAction('toggleDrawingProps')} 
        />
      </div>

      <SectionHeader label="Share & Export" />
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => onAction('share', 'pdf')}
          className="flex flex-col items-center justify-center p-5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-[1.5rem] transition-all"
        >
          <FileText size={20} className="text-red-500 mb-2" />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Share PDF</span>
        </button>
        <button 
          onClick={() => onAction('share', 'dxf')}
          className="flex flex-col items-center justify-center p-5 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-[1.5rem] transition-all"
        >
          <FileCode size={20} className="text-cyan-500 mb-2" />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Share DXF</span>
        </button>
      </div>

      <SectionHeader label="Environment & Units" />
      <div className="p-1.5 bg-neutral-900 rounded-2xl border border-white/5 flex gap-1">
        <button 
          onClick={() => onAction('setUnits', 'metric')}
          className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase transition-all ${units === 'metric' ? 'bg-cyan-600 text-black shadow-lg shadow-cyan-900/20' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Metric (mm/m)
        </button>
        <button 
          onClick={() => onAction('setUnits', 'imperial')}
          className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase transition-all ${units === 'imperial' ? 'bg-cyan-600 text-black shadow-lg shadow-cyan-900/20' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Imperial (ft/in)
        </button>
      </div>

      <SectionHeader label="System & Knowledge" />
      <div className="grid grid-cols-1 gap-2">
        <MenuButton 
          icon={HelpCircle} 
          label="Help & Commands" 
          desc="Quick reference for all engine tools"
          color="bg-indigo-500" 
          onClick={() => onAction('toggleHelp')} 
        />
        <MenuButton 
          icon={Info} 
          label="About VoxCADD" 
          desc="v-1.0.0 Stable Release"
          color="bg-blue-500" 
          onClick={() => onAction('toggleAbout')} 
        />
        <MenuButton 
          icon={Zap} 
          label="Privacy Protocol" 
          desc="Data & Security Standards"
          color="bg-emerald-500" 
          onClick={() => onAction('togglePrivacy')} 
        />
      </div>

      <div className="mt-12 text-center opacity-30 flex flex-col items-center gap-1">
        <div className="w-10 h-[1px] bg-neutral-500 mb-2"></div>
        <p className="text-[8px] font-black uppercase tracking-[0.3em]">VoxCADD v1.0.0</p>
        <p className="text-[7px] font-medium text-neutral-600 uppercase tracking-widest">Architectural Data Management Engine</p>
      </div>
    </div>
  );
};

export default MenuBar;
