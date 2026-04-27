
import React, { useState } from 'react';
import { Ruler, Globe, X, FileEdit, Check, Target } from 'lucide-react';
import { UnitType } from '../types';

interface NewFileDialogProps {
  onSelect: (config: { units: UnitType, subUnit: string, precision: string, name: string }) => void;
  onClose: () => void;
}

const NewFileDialog: React.FC<NewFileDialogProps> = ({ onSelect, onClose }) => {
  const [name, setName] = useState('DRAWING_01');
  const [standard, setStandard] = useState<UnitType>('metric');
  const [subUnit, setSubUnit] = useState('mm');
  const [precision, setPrecision] = useState('0.0000');

  const metricPrecisions = ['0', '0.0', '0.00', '0.000', '0.0000'];
  const imperialPrecisions = ['1"', '1/2"', '1/4"', '1/8"', '1/16"', '1/32"', '1/64"'];

  const handleCreate = () => {
    onSelect({ units: standard, subUnit, precision, name });
  };

  const isMetric = standard === 'metric';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-[380px] bg-[#0c0c0e] rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/[0.08] flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Title Bar */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <h2 className="text-[13px] font-black text-white uppercase tracking-[0.2em] leading-none">New Workspace</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-neutral-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Identifier Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.15em]">Project Identity</label>
              <FileEdit size={10} className="text-neutral-700" />
            </div>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#121214] border border-white/[0.03] rounded-xl py-3.5 px-4 text-xs text-white font-bold outline-none focus:border-cyan-500/30 transition-all uppercase placeholder:text-neutral-800"
              placeholder="PROJECT_NAME_01"
            />
          </div>

          {/* Standard Selection - More compact */}
          <div className="space-y-2">
             <label className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.15em] px-1">Standard System</label>
             <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => { setStandard('metric'); setSubUnit('mm'); setPrecision('0.0000'); }}
                    className={`flex items-center justify-center gap-2.5 py-3.5 rounded-xl border transition-all no-tap ${isMetric ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-[#121214] border-transparent text-neutral-600 hover:bg-white/5'}`}
                >
                    <Globe size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Metric</span>
                </button>
                <button 
                    onClick={() => { setStandard('imperial'); setSubUnit('ft-in'); setPrecision('1/16"'); }}
                    className={`flex items-center justify-center gap-2.5 py-3.5 rounded-xl border transition-all no-tap ${!isMetric ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-[#121214] border-transparent text-neutral-600 hover:bg-white/5'}`}
                >
                    <Ruler size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Imperial</span>
                </button>
             </div>
          </div>

          {/* Precision Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.15em] px-1">Units</label>
                <select 
                    value={subUnit}
                    onChange={(e) => setSubUnit(e.target.value)}
                    className="w-full bg-[#121214] border border-white/[0.03] rounded-xl py-3 px-3 text-[10px] text-white font-bold outline-none appearance-none uppercase cursor-pointer hover:border-white/10 transition-all text-center"
                >
                    {isMetric ? (
                        <>
                            <option value="mm">Millimeters</option>
                            <option value="cm">Centimeters</option>
                            <option value="m">Meters</option>
                        </>
                    ) : (
                        <>
                            <option value="ft-in">Feet-Inches</option>
                            <option value="in">Inches</option>
                            <option value="ft">Decimal Feet</option>
                        </>
                    )}
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.15em] px-1">Precision</label>
                <select 
                    value={precision}
                    onChange={(e) => setPrecision(e.target.value)}
                    className="w-full bg-[#121214] border border-white/[0.03] rounded-xl py-3 px-3 text-[10px] text-white font-bold outline-none appearance-none text-center cursor-pointer hover:border-white/10 transition-all"
                >
                    {(isMetric ? metricPrecisions : imperialPrecisions).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
          </div>

          <button 
            onClick={handleCreate}
            className={`w-full py-4.5 rounded-[1.25rem] flex items-center justify-center gap-3 transition-all active:scale-[0.98] font-black text-[10px] uppercase tracking-[0.25em] mt-2 shadow-lg ${isMetric ? 'bg-cyan-500 text-black shadow-cyan-500/20' : 'bg-amber-500 text-black shadow-amber-500/20'}`}
          >
            <Check size={16} strokeWidth={3} /> Initialize Workspace
          </button>
        </div>

        <div className="mt-auto p-4 bg-black/40 text-center border-t border-white/[0.03]">
          <div className="flex items-center justify-center gap-2 text-[8px] text-neutral-600 font-bold uppercase tracking-[0.3em]">
            <Target size={10} className="text-neutral-700" />
            <span>Core v22.04 | 1:1 Scale Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewFileDialog;
