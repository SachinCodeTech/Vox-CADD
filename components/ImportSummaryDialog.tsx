
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Info, AlertTriangle, FileText, Layout, Layers, Box } from 'lucide-react';

interface ImportSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  stats: {
    total: number;
    unsupported: number;
    counts: Record<string, number>;
  };
}

const ImportSummaryDialog: React.FC<ImportSummaryDialogProps> = ({ isOpen, onClose, fileName, stats }) => {
  if (!isOpen) return null;

  const supportedCount = stats.total - stats.unsupported;
  const successRate = stats.total > 0 ? (supportedCount / stats.total) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] w-full max-w-sm overflow-hidden font-sans"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-black text-white text-[12px] uppercase tracking-widest leading-none mb-1">Import Summary</h3>
                <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest leading-none">{fileName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group">
              <X className="w-4 h-4 text-neutral-600 group-hover:text-white" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-neutral-700 text-[8px] uppercase tracking-widest font-black mb-1">Total Entities</p>
                <p className="text-xl font-black text-white font-mono tracking-tighter">{stats.total}</p>
              </div>
              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-neutral-700 text-[8px] uppercase tracking-widest font-black mb-1">Integrity</p>
                <p className={`text-xl font-black font-mono tracking-tighter ${successRate > 90 ? 'text-cyan-400' : successRate > 50 ? 'text-amber-400' : 'text-red-500'}`}>
                  {successRate.toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-neutral-700 text-[8px] uppercase tracking-widest font-black px-1">Registry Breakdown</p>
              <div className="max-h-32 overflow-y-auto pr-1 space-y-1 scrollbar-none bg-black/20 rounded-xl p-2 border border-white/[0.02]">
                {Object.entries(stats.counts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className="text-neutral-400 font-bold text-[9px] uppercase tracking-wider">{type}</span>
                    <span className="text-white font-black text-[10px] font-mono">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.counts).length === 0 && (
                   <p className="text-neutral-800 text-[9px] font-bold italic py-2 text-center">Empty Catalog</p>
                )}
              </div>
            </div>

            {stats.unsupported > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-400/5 border border-amber-400/10 p-3 rounded-xl">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-500/60 text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                  {stats.unsupported} entities bypassed. Advanced geometry types or custom definitions were not parsed.
                </p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 bg-[#0a0a0c]/50 border-t border-white/5">
            <button 
              onClick={onClose}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-black rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-900/20"
            >
              Initialize Workspace
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImportSummaryDialog;
