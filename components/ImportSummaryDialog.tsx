import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Info, AlertTriangle, FileText, Layers, Box, Disc } from 'lucide-react';

interface ImportSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  stats: {
    total: number;
    unsupported: number;
    counts: Record<string, number>;
  };
  layers?: string[];
  blocks?: string[];
}

const ImportSummaryDialog: React.FC<ImportSummaryDialogProps> = ({ 
  isOpen, 
  onClose, 
  fileName, 
  stats,
  layers = [],
  blocks = []
}) => {
  const [activeTab, setActiveTab] = useState<'entities' | 'layers' | 'blocks'>('entities');

  if (!isOpen) return null;

  const supportedCount = stats.total - stats.unsupported;
  const successRate = stats.total > 0 ? (supportedCount / stats.total) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-[#0c0c0e]/98 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] w-[360px] max-w-full overflow-hidden font-sans"
          onClick={e => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-[12px] uppercase tracking-widest leading-none mb-1">Import Registry</h3>
                <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest leading-none max-w-[200px] truncate">{fileName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group">
              <X className="w-4 h-4 text-neutral-600 group-hover:text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <p className="text-neutral-500 text-[8px] uppercase tracking-widest font-black mb-1">Total Entities</p>
                <p className="text-lg font-black text-white font-mono tracking-tighter leading-none mt-1">{stats.total}</p>
              </div>
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <p className="text-neutral-500 text-[8px] uppercase tracking-widest font-black mb-1">Import Success</p>
                <p className={`text-lg font-black font-mono tracking-tighter leading-none mt-1 ${successRate > 90 ? 'text-cyan-400' : successRate > 50 ? 'text-amber-400' : 'text-red-500'}`}>
                  {successRate.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Dynamic Interactive Registry Explorer Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-neutral-500 text-[8px] uppercase tracking-widest font-black">Registry Catalog</p>
                <div className="flex bg-neutral-950 rounded-lg p-0.5 border border-white/5">
                  <button 
                    onClick={() => setActiveTab('entities')}
                    className={`px-2 py-1 text-[7.5px] font-black uppercase rounded-md transition-all ${activeTab === 'entities' ? 'bg-[#00bcd4]/15 text-[#00bcd4]' : 'text-neutral-600 hover:text-neutral-400'}`}
                  >
                    Entities
                  </button>
                  <button 
                    onClick={() => setActiveTab('layers')}
                    className={`px-2 py-1 text-[7.5px] font-black uppercase rounded-md transition-all ${activeTab === 'layers' ? 'bg-[#10b981]/15 text-[#10b981]' : 'text-neutral-600 hover:text-neutral-400'}`}
                  >
                    Layers ({layers.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('blocks')}
                    className={`px-2 py-1 text-[7.5px] font-black uppercase rounded-md transition-all ${activeTab === 'blocks' ? 'bg-purple-500/15 text-purple-400' : 'text-neutral-600 hover:text-neutral-400'}`}
                  >
                    Blocks ({blocks.length})
                  </button>
                </div>
              </div>

              {/* Explorer Window */}
              <div className="h-36 overflow-y-auto scrollbar-thin bg-neutral-950/60 rounded-2xl p-2 border border-white/5">
                {activeTab === 'entities' && (
                  <div className="space-y-1">
                    {Object.entries(stats.counts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.02] transition-colors">
                        <span className="text-neutral-400 font-extrabold text-[8.5px] uppercase tracking-wider">{type}</span>
                        <span className="text-cyan-400 font-black text-[9.5px] font-mono">{count}</span>
                      </div>
                    ))}
                    {Object.keys(stats.counts).length === 0 && (
                      <div className="h-28 flex flex-col items-center justify-center text-center">
                        <Disc className="w-6 h-6 text-neutral-800 animate-spin" />
                        <p className="text-neutral-600 text-[8px] font-bold uppercase tracking-widest mt-2">No Entity Record</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'layers' && (
                  <div className="space-y-1">
                    {layers.map((layer) => {
                      const isDefault = layer === '0' || layer === 'defpoints';
                      return (
                        <div key={layer} className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.02] transition-colors">
                          <Layers className={`w-3 h-3 ${isDefault ? 'text-neutral-500' : 'text-[#10b981]'} shrink-0`} />
                          <span className={`font-extrabold text-[8.5px] uppercase tracking-wider truncate ${isDefault ? 'text-neutral-500' : 'text-neutral-300'}`}>{layer}</span>
                          {isDefault ? (
                            <span className="ml-[auto] text-[6.5px] text-neutral-500/70 font-mono font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-neutral-500/5 border border-neutral-500/10">Default Retained</span>
                          ) : (
                            <span className="ml-[auto] text-[6.5px] text-[#10b981]/90 font-mono font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/20 animate-pulse">Auto-Created</span>
                          )}
                        </div>
                      );
                    })}
                    {layers.length === 0 && (
                      <div className="h-28 flex flex-col items-center justify-center text-center">
                        <Layers className="w-5 h-5 text-neutral-800" />
                        <p className="text-neutral-600 text-[8px] font-bold uppercase tracking-widest mt-2">No custom layers created</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'blocks' && (
                  <div className="space-y-1">
                    {blocks.map((block) => (
                      <div key={block} className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.02] transition-colors">
                        <Box className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="text-neutral-300 font-extrabold text-[8.5px] uppercase tracking-wider truncate">{block}</span>
                        <span className="ml-[auto] text-[6.5px] text-purple-400/90 font-mono font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-400/15 border border-purple-400/25">Auto-Mapped</span>
                      </div>
                    ))}
                    {blocks.length === 0 && (
                      <div className="h-28 flex flex-col items-center justify-center text-center">
                        <Box className="w-5 h-5 text-neutral-800" />
                        <p className="text-neutral-600 text-[8px] font-bold uppercase tracking-widest mt-2">No block definitions imported</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {stats.unsupported > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-400/5 border border-amber-400/10 p-3 rounded-xl">
                <AlertTriangle style={{ height: '12px' }} className="w-3 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-400/60 text-[8px] font-bold leading-relaxed uppercase tracking-widest">
                  {stats.unsupported} entities bypassed. Advanced drawing models or solid assemblies are converted to baseline polylines.
                </p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 bg-[#0a0a0c]/80 border-t border-white/5">
            <button 
              onClick={onClose}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-black rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-950/40"
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
