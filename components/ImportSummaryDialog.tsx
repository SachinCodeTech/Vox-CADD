
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
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-[#1e1e22] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Import Summary</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-white/50" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-white/60 text-sm">Target File</p>
              <p className="text-white font-medium truncate">{fileName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Total Entities</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Success Rate</p>
                <p className={`text-2xl font-bold mt-1 ${successRate > 90 ? 'text-green-400' : successRate > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {successRate.toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Entity Breakdown</p>
              <div className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {Object.entries(stats.counts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                    <span className="text-white/80 font-mono text-xs">{type}</span>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.counts).length === 0 && (
                   <p className="text-white/30 text-xs italic">No entities detected</p>
                )}
              </div>
            </div>

            {stats.unsupported > 0 && (
              <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-yellow-200/80 text-xs leading-relaxed">
                  {stats.unsupported} entities were not supported and could not be imported. Advanced entities like PROXY_ENTITY or custom objects may be missing.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all active:scale-95 text-sm"
            >
              Continue to Drawing
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImportSummaryDialog;
