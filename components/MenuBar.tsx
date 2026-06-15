
import React from 'react';
import { 
  FilePlus, FolderOpen, Save, Share2, Download, 
  Settings, Info, HelpCircle, Layout, Grid, 
  Zap, Calculator, Layers, Sliders, Ruler, Target,
  Globe, Cpu, Type, MousePointer2, Settings2, Trash2, FileText, Palette,
  Mail, MessageSquare, FileCode, XCircle, LogIn, LogOut, User as UserIcon, Cloud, LayoutDashboard,
  FileEdit
} from 'lucide-react';
import { UnitType } from '../types';
import { useSession } from './SessionContext';

import VoxIcon from './VoxIcon';

interface MenuBarProps {
  onAction: (action: string, payload?: any) => void;
  currentFileName: string;
  units: UnitType;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', text: 'text-cyan-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/25', text: 'text-pink-400' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', text: 'text-indigo-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400' },
};

const MenuButton = ({ icon: Icon, label, color, onClick, desc }: { icon: any, label: string, color: string, onClick: () => void, desc?: string }) => {
  const key = color.replace('bg-', '').replace('-500', '');
  const colors = COLOR_MAP[key] || { bg: 'bg-neutral-800/50', border: 'border-neutral-700/20', text: 'text-white' };

  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-[#181818] hover:bg-[#222] border border-white/5 rounded-2xl transition-all active:scale-[0.98] text-left w-full group"
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${colors.bg} border ${colors.border} shadow-inner shrink-0 transition-all`} >
        <Icon size={18} className={colors.text} />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="text-[11px] sm:text-xs font-black text-neutral-100 uppercase tracking-tight truncate">{label}</div>
        {desc && <div className="text-[8px] sm:text-[9px] text-neutral-500 font-medium uppercase tracking-tighter truncate">{desc}</div>}
      </div>
    </button>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 mb-3 mt-6">
    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.25em]">{label}</span>
  </div>
);

const MenuBar: React.FC<MenuBarProps> = ({ onAction, currentFileName, units }) => {
  const { user, login, signOut, isAuthenticated } = useSession();

  return (
    <div className="flex-1 flex flex-col bg-[#0d0d0d] overflow-y-auto scrollbar-none pb-12 px-6">
      
      {/* Enterprise Identity Banner */}
      <div className="mt-4 p-4 bg-[#111] border border-white/5 rounded-2xl mb-2">
        {!isAuthenticated ? (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center border border-white/5">
                   <UserIcon size={20} className="text-neutral-500" />
                </div>
                <div>
                   <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Enterprise Sync</div>
                   <div className="text-[9px] text-neutral-600 font-medium uppercase">Not Authorized</div>
                </div>
             </div>
             <button 
               onClick={login}
               className="w-full py-2.5 bg-white text-black text-[9px] font-black uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all"
             >
               <LogIn size={14} /> Authorize with Google
             </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} className="w-10 h-10 rounded-full border border-cyan-500/50" alt="profile" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
                    <UserIcon size={20} className="text-cyan-500" />
                  </div>
                )}
                <div className="overflow-hidden">
                   <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-1">
                     <Cloud size={10} /> Cloud Active
                   </div>
                   <div className="text-[11px] text-white font-black truncate">{user?.displayName || user?.email}</div>
                </div>
             </div>
             <div className="flex gap-2">
                <button 
                onClick={() => onAction('syncToCloud')}
                className="flex-1 py-2 bg-neutral-800 text-cyan-400 text-[8px] font-black uppercase rounded-lg flex items-center justify-center gap-2 border border-white/5"
                >
                  <Cloud size={12} /> Sync Drawing
                </button>
                <button 
                onClick={signOut}
                className="px-3 py-2 bg-neutral-900 text-neutral-500 text-[8px] font-black uppercase rounded-lg flex items-center justify-center gap-2 border border-white/5"
                >
                  <LogOut size={12} />
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Workspace Header */}
      <div className="mt-4 p-5 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0c] border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] animate-pulse"></div>
          <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Active Workspace</span>
        </div>
        <button 
          onClick={() => onAction('rename')}
          className="text-lg font-black text-white hover:text-cyan-400 text-left transition-colors truncate pr-2 flex items-center gap-1.5 active:scale-95 duration-150 group"
          title="Rename Project"
        >
          <span>{currentFileName || "Untitled Project"}</span>
          <FileEdit size={12} className="text-neutral-500 group-hover:text-cyan-400 inline-block shrink-0 transition-colors" />
        </button>
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
          <button onClick={() => onAction('close')} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-black uppercase rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-500/20">
            <XCircle size={14} /> Close Active Drawing
          </button>
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
            icon={Palette} 
            label="Plot Style Manager" 
            desc="Configure CTB color mapping & lineweights"
            color="bg-cyan-500" 
            onClick={() => onAction('toggleCtbManager')} 
        />
        <MenuButton 
            icon={Sliders} 
            label="Wall Alignment Audit" 
            desc="Detect and snap crooked A-WALL segments"
            color="bg-purple-500" 
            onClick={() => onAction('toggleWallAlignment')} 
        />
        <MenuButton 
            icon={FileText} 
            label="Project Properties" 
            desc="Manage drawing metadata and statistics"
            color="bg-amber-500" 
            onClick={() => onAction('toggleDrawingProps')} 
        />
        <MenuButton 
            icon={LayoutDashboard} 
            label="Live Project Dashboard" 
            desc="Model complexity & material takeoff estimation"
            color="bg-pink-500" 
            onClick={() => onAction('toggleDashboard')} 
        />
      </div>

      <SectionHeader label="Share & Export" />
      <div className="grid grid-cols-4 gap-1.5">
        <button 
          onClick={() => onAction('share', 'pdf')}
          className="flex flex-col items-center justify-center p-2.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all"
        >
          <FileText size={14} className="text-red-500 mb-1" />
          <span className="text-[7px] font-black text-white uppercase">PDF</span>
        </button>
        <button 
          onClick={() => onAction('share', 'vox')}
          className="flex flex-col items-center justify-center p-2.5 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl transition-all"
        >
          <VoxIcon size={14} className="text-emerald-500 mb-1" />
          <span className="text-[7px] font-black text-white uppercase">VOX</span>
        </button>
        <button 
          onClick={() => onAction('share', 'dxf')}
          className="flex flex-col items-center justify-center p-2.5 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-xl transition-all"
        >
          <FileCode size={14} className="text-cyan-500 mb-1" />
          <span className="text-[7px] font-black text-white uppercase">DXF</span>
        </button>
        <button 
          onClick={() => onAction('publish')}
          className="flex flex-col items-center justify-center p-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all"
        >
          <Globe size={14} className="text-indigo-500 mb-1" />
          <span className="text-[7px] font-black text-white uppercase">LINK</span>
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
