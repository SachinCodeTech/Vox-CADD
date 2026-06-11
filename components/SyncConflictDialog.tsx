import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CloudRain, HardDrive, RefreshCw, XCircle } from 'lucide-react';

interface SyncConflictDialogProps {
  fileName: string;
  localTime: number;
  onResolve: (strategy: 'local' | 'cloud' | 'blend') => void;
  onCancel: () => void;
}

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({
  fileName,
  localTime,
  onResolve,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Panel */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-[#0e0e11] border border-white/10 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500" />
        
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 shrink-0 border border-amber-500/20">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-white font-heavy text-[13px] tracking-[0.2em] uppercase font-black">Sync Conflict Detected</h3>
            <p className="text-neutral-500 text-[9px] uppercase tracking-wider mt-1">
              File: <span className="text-cyan-400 font-mono font-bold lowercase">{fileName}</span>
            </p>
          </div>
        </div>

        <p className="text-neutral-400 text-[10px] leading-relaxed mb-6 uppercase tracking-wider">
          You made local modifications to this drawing while offline, but there is also a newer version stored in your Cloud hub profile. Choose how to reconcile these drafts:
        </p>

        <div className="grid grid-cols-1 gap-3 mb-6">
          {/* Choice 1: Keep Local */}
          <button
            onClick={() => onResolve('local')}
            className="group w-full text-left bg-white/[0.02] hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <HardDrive className="text-neutral-500 group-hover:text-cyan-400 mt-0.5" size={16} />
              <div>
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest group-hover:text-cyan-400">Keep My Local Draft</h4>
                <p className="text-neutral-500 text-[8px] uppercase tracking-wider mt-1 leading-normal">
                  Overwrites cloud drive files with your offline changes.
                </p>
              </div>
            </div>
          </button>

          {/* Choice 2: Keep Cloud */}
          <button
            onClick={() => onResolve('cloud')}
            className="group w-full text-left bg-white/[0.02] hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/50 rounded-xl p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <CloudRain className="text-neutral-500 group-hover:text-indigo-400 mt-0.5" size={16} />
              <div>
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-400">Adopt Cloud Hub Draft</h4>
                <p className="text-neutral-500 text-[8px] uppercase tracking-wider mt-1 leading-normal">
                  Discards offline edits and restores cloud drawings.
                </p>
              </div>
            </div>
          </button>

          {/* Choice 3: Smart Merge */}
          <button
            onClick={() => onResolve('blend')}
            className="group w-full text-left bg-white/[0.02] hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/50 rounded-xl p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <RefreshCw className="text-neutral-500 group-hover:text-emerald-400 mt-0.5" size={16} />
              <div>
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-400">Smart Blueprint Merge</h4>
                <p className="text-neutral-500 text-[8px] uppercase tracking-wider mt-1 leading-normal text-emerald-500/80">
                  Intelligently merges shapes from both drafts so no geometry is lost.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest font-bold">
            VoxCADD Sync System Phase 4
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};
