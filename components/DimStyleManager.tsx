
import React, { useState } from 'react';
import { X, Check, Ruler, Plus, Trash2, Settings2 } from 'lucide-react';
import { AppSettings, DimensionStyle } from '../types';

interface DimStyleManagerProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClose: () => void;
}

const DimStyleManager: React.FC<DimStyleManagerProps> = ({ settings, onUpdateSettings, onClose }) => {
  const [activeStyleId, setActiveStyleId] = useState(settings.activeDimStyle);
  const styles = settings.dimStyles;
  const activeStyle = styles[activeStyleId] || Object.values(styles)[0];

  const updateStyle = (id: string, updates: Partial<DimensionStyle>) => {
    const newStyles = { ...styles, [id]: { ...styles[id], ...updates } };
    onUpdateSettings({ ...settings, dimStyles: newStyles });
  };

  const addStyle = () => {
    const name = window.prompt('Enter style name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const newStyle: DimensionStyle = {
      ...activeStyle,
      id,
      name,
    };
    onUpdateSettings({ 
        ...settings, 
        dimStyles: { ...styles, [id]: newStyle },
        activeDimStyle: id
    });
    setActiveStyleId(id);
  };

  const removeStyle = (id: string) => {
    if (Object.keys(styles).length <= 1) return;
    if (confirm(`Delete style "${styles[id].name}"?`)) {
      const newStyles = { ...styles };
      delete newStyles[id];
      const nextActive = Object.keys(newStyles)[0];
      onUpdateSettings({ 
          ...settings, 
          dimStyles: newStyles,
          activeDimStyle: nextActive 
      });
      setActiveStyleId(nextActive);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#0e0e11] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 border border-cyan-500/20">
              <Ruler size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Dimension Styles</h2>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">Global DIM-STYLE Manager</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r border-white/5 bg-[#0a0a0c] flex flex-col p-2 gap-1 overflow-y-auto">
            <div className="px-2 py-1 mb-2">
                <span className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Available Styles</span>
            </div>
            {Object.values(styles).map((style: DimensionStyle) => (
              <button 
                key={style.id}
                onClick={() => {
                  setActiveStyleId(style.id);
                  onUpdateSettings({ ...settings, activeDimStyle: style.id });
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${activeStyleId === style.id ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,188,212,0.2)]' : 'text-neutral-400 hover:bg-white/5'}`}
              >
                <span className="text-[10px] font-bold uppercase truncate pr-2">{style.name}</span>
                {activeStyleId !== style.id && Object.keys(styles).length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeStyle(style.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {activeStyleId === style.id && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
            <button 
              onClick={addStyle}
              className="mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-neutral-600 hover:text-cyan-500 hover:border-cyan-500/50 transition-all"
            >
              <Plus size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">New Style</span>
            </button>
          </div>

          {/* Properties Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#0e0e11]">
            <div className="mb-6 flex items-center gap-2 text-cyan-500">
                <Settings2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Properties: {activeStyle.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <PropInput 
                    label="Arrow Size" 
                    value={activeStyle.arrowSize} 
                    onChange={val => updateStyle(activeStyle.id, { arrowSize: val })} 
                />
                <PropInput 
                    label="Text Height" 
                    value={activeStyle.textSize} 
                    onChange={val => updateStyle(activeStyle.id, { textSize: val })} 
                />
                <PropInput 
                    label="Text Offset" 
                    value={activeStyle.textOffset} 
                    onChange={val => updateStyle(activeStyle.id, { textOffset: val })} 
                />
                <PropInput 
                    label="Line Extension" 
                    value={activeStyle.extendLine} 
                    onChange={val => updateStyle(activeStyle.id, { extendLine: val })} 
                />
                <PropInput 
                    label="Line Offset" 
                    value={activeStyle.offsetLine} 
                    onChange={val => updateStyle(activeStyle.id, { offsetLine: val })} 
                />
                <div className="space-y-1.5 flex flex-col">
                    <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Precision (Decimals)</label>
                    <select 
                        value={activeStyle.precision}
                        onChange={e => updateStyle(activeStyle.id, { precision: parseInt(e.target.value) })}
                        className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500/50 transition-all"
                    >
                        <option value={0}>0</option>
                        <option value={1}>0.0</option>
                        <option value={2}>0.00</option>
                        <option value={3}>0.000</option>
                        <option value={4}>0.0000</option>
                    </select>
                </div>
            </div>

            {/* Preview Section - Simulated */}
            <div className="mt-10 p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center">
                <div className="text-[8px] font-black uppercase text-neutral-700 tracking-[0.2em] mb-6">Live Style Preview</div>
                <div className="relative w-full max-w-[300px] h-32 flex items-center justify-center">
                    {/* Fake Dim line */}
                    <div className="absolute left-0 right-0 h-px bg-cyan-500/50" />
                    {/* Fake Text */}
                    <div className="bg-[#121214] px-3 py-1 border border-white/10 rounded text-cyan-400 font-mono text-[10px] z-10 mb-8" style={{ fontSize: `${Math.max(8, activeStyle.textSize / 20)}px` }}>1250.00</div>
                    {/* Arrows */}
                    <div className="absolute left-0 w-2 h-2 border-l border-t border-cyan-500 -rotate-45" />
                    <div className="absolute right-0 w-2 h-2 border-r border-t border-cyan-500 rotate-45" />
                </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-[#0a0a0c] flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-cyan-600 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-cyan-950/20 active:scale-95 transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

const PropInput: React.FC<{ label: string, value: number, onChange: (val: number) => void }> = ({ label, value, onChange }) => (
    <div className="space-y-1.5 flex flex-col">
        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">{label}</label>
        <input 
            type="number" 
            value={value} 
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500/50 transition-all"
        />
    </div>
);

export default DimStyleManager;
