
import React, { useState } from 'react';
import { Ruler, Globe, X, FileEdit, Check, Target } from 'lucide-react';
import { UnitType } from '../types';

interface NewFileDialogProps {
  onSelect: (config: { units: UnitType, subUnit: string, precision: string, name: string }) => void;
  onClose: () => void;
}

const NewFileDialog: React.FC<NewFileDialogProps> = ({ onSelect, onClose }) => {
  const [name, setName] = useState('DRAUGHT_01');
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#0d0d0f] rounded-[2.5rem] overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,1)] border border-white/10 animate-in zoom-in-95 duration-400">
        
        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">New Drawing</h2>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.15em] mt-1">Setup Architectural Workspace</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 pt-4 space-y-8">
          {/* Filename Input */}
          <div className="space-y-3">
            <label className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.2em] px-1">Project Identifier</label>
            <div className="relative group">
              <FileEdit size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-white transition-colors" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#121214] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-black outline-none focus:border-white/10 transition-all uppercase placeholder:text-neutral-800"
                placeholder="Enter Drawing Name..."
              />
            </div>
          </div>

          {/* Unit System Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => { setStandard('metric'); setSubUnit('mm'); setPrecision('0.0000'); }}
                className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all no-tap ${isMetric ? 'bg-transparent border-cyan-500/50 text-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-[#121214] border-transparent text-neutral-600 hover:text-neutral-400'}`}
            >
                <Globe size={28} strokeWidth={isMetric ? 2.5 : 2} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">ISO Metric</span>
            </button>
            <button 
                onClick={() => { setStandard('imperial'); setSubUnit('ft-in'); setPrecision('1/16"'); }}
                className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all no-tap ${!isMetric ? 'bg-transparent border-amber-500/50 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'bg-[#121214] border-transparent text-neutral-600 hover:text-neutral-400'}`}
            >
                <Ruler size={28} strokeWidth={!isMetric ? 2.5 : 2} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">ANSI Imperial</span>
            </button>
          </div>

          {/* Sub-Units & Precision Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
                <label className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] px-1">Base Unit</label>
                <div className="relative">
                  <select 
                      value={subUnit}
                      onChange={(e) => setSubUnit(e.target.value)}
                      className="w-full bg-[#121214] border border-white/5 rounded-xl py-4 px-4 text-[10px] text-white font-black outline-none appearance-none uppercase text-center cursor-pointer hover:border-white/20 transition-all"
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
            </div>
            <div className="space-y-3">
                <label className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] px-1">Precision</label>
                <div className="relative">
                  <select 
                      value={precision}
                      onChange={(e) => setPrecision(e.target.value)}
                      className="w-full bg-[#121214] border border-white/5 rounded-xl py-4 px-4 text-[10px] text-white font-black outline-none appearance-none text-center cursor-pointer hover:border-white/20 transition-all"
                  >
                      {(isMetric ? metricPrecisions : imperialPrecisions).map(p => (
                          <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
                </div>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleCreate}
            className={`w-full py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl font-black text-[11px] uppercase tracking-[0.2em] mt-2 ${isMetric ? 'bg-cyan-500 text-black shadow-cyan-500/10' : 'bg-amber-500 text-black shadow-amber-500/10'}`}
          >
            <Check size={20} strokeWidth={4} /> Prepare Drafting Area
          </button>
        </div>

        <div className="p-6 bg-[#0a0a0c] text-center border-t border-white/5">
          <p className="text-[8px] text-neutral-700 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Target size={10} /> Workspace v1.0.0 | Full Scale 1:1 Kernel Loaded
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewFileDialog;
