import React, { useState } from 'react';
import { X, Check, Droplets } from 'lucide-react';
import { aciColors, hexToRgbStr } from '../services/colorUtils';

interface ColorSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelect: (color: string) => void;
  title?: string;
}

const ColorSelector: React.FC<ColorSelectorProps> = ({ isOpen, onClose, currentColor, onSelect, title = "Select Color" }) => {
  const [customColor, setCustomColor] = useState(currentColor.startsWith('#') ? currentColor : '#FFFFFF');
  const [activeTab, setActiveTab] = useState<'aci' | 'custom'>('aci');

  if (!isOpen) return null;

  const handleSelect = (color: string) => {
    onSelect(color);
    onClose();
  };

  const isSelected = (color: string) => {
    return currentColor.toLowerCase() === color.toLowerCase();
  };

  const getAciFromColor = (color: string) => {
    const hex = color.toUpperCase();
    const idx = aciColors.indexOf(hex);
    return idx !== -1 ? idx : null;
  };

  const selectedAci = getAciFromColor(currentColor);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md sm:p-4">
      <div className="bg-[#0a0a0c] border border-white/10 sm:rounded-[2rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] w-full max-w-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#121214]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
               <Droplets size={20} />
             </div>
             <div className="flex flex-col">
               <h3 className="text-white font-black text-sm uppercase tracking-widest">{title}</h3>
               <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter">Professional Color Management Engine</span>
             </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#121214] px-6 gap-6">
          <button 
            onClick={() => setActiveTab('aci')}
            className={`pb-4 pt-1 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'aci' ? 'text-cyan-400 border-cyan-400' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}
          >
            Index Color (ACI)
          </button>
          <button 
            onClick={() => setActiveTab('custom')}
            className={`pb-4 pt-1 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'custom' ? 'text-cyan-400 border-cyan-400' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}
          >
            True Color (RGB)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {activeTab === 'aci' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => handleSelect('BYLAYER')}
                   className={`p-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all shadow-lg ${isSelected('bylayer') ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-[#121214] border-white/5 text-neutral-500 hover:text-white hover:border-white/20'}`}
                 >
                    BYLAYER
                 </button>
                 <button 
                   onClick={() => handleSelect('BYBLOCK')}
                   className={`p-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all shadow-lg ${isSelected('byblock') ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-[#121214] border-white/5 text-neutral-500 hover:text-white hover:border-white/20'}`}
                 >
                    BYBLOCK
                 </button>
              </div>

              <div>
                <h4 className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em] mb-4">Standard Drafting Suite (1-9)</h4>
                <div className="grid grid-cols-9 gap-2.5">
                  {aciColors.slice(1, 10).map((color, i) => (
                    <button
                      key={i + 1}
                      title={`ACI ${i + 1}`}
                      onClick={() => handleSelect(color)}
                      style={{ backgroundColor: color }}
                      className={`h-11 rounded-xl relative flex items-center justify-center transition-all hover:scale-110 shadow-2xl border border-white/10 ${isSelected(color) ? 'ring-2 ring-white ring-offset-4 ring-offset-[#0a0a0c]' : ''}`}
                    >
                      {isSelected(color) && <Check size={18} className={`${i === 6 ? 'text-black' : 'text-white'} drop-shadow-md`} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em] mb-4">Full Index Palette (10-249)</h4>
                <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5">
                  {aciColors.slice(10, 250).map((color, i) => {
                    const aci = i + 10;
                    return (
                      <button
                        key={`aci-${aci}`}
                        title={`ACI ${aci} - ${color} (${hexToRgbStr(color)})`}
                        onClick={() => handleSelect(color)}
                        style={{ backgroundColor: color }}
                        className={`group h-7 rounded-lg relative flex items-center justify-center hover:scale-150 transition-all shadow-lg hover:z-20 border border-white/5 ${isSelected(color) ? 'ring-2 ring-white z-10 scale-125' : ''}`}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none">
                           <span className="text-[7px] font-black text-white mix-blend-difference">{aci}</span>
                        </div>
                        {isSelected(color) && <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em] mb-4">Drafting Grays (250-255)</h4>
                <div className="grid grid-cols-6 gap-3">
                  {aciColors.slice(250).map((color, i) => (
                    <button
                      key={i + 250}
                      title={`ACI ${i + 250}`}
                      onClick={() => handleSelect(color)}
                      style={{ backgroundColor: color }}
                      className={`h-11 rounded-xl relative flex items-center justify-center transition-all hover:scale-110 shadow-xl border border-white/10 ${isSelected(color) ? 'ring-2 ring-white ring-offset-4 ring-offset-[#0a0a0c]' : ''}`}
                    >
                      {isSelected(color) && <Check size={18} className="text-cyan-400 mix-blend-difference" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-12 py-8">
              <div 
                className="w-40 h-40 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] border-[6px] border-white/5" 
                style={{ backgroundColor: customColor }}
              />
              
              <div className="w-full max-w-sm space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.3em] block ml-1">TrueColor Hex / RGB</label>
                  <input 
                    type="text" 
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-full bg-[#121214] border border-white/5 text-white p-4 rounded-2xl outline-none font-mono text-center text-lg focus:border-cyan-500/30 transition-all shadow-inner"
                    placeholder="#FFFFFF"
                  />
                </div>
                
                <input 
                  type="color" 
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-full h-14 bg-transparent cursor-pointer rounded-2xl overflow-hidden border-none shadow-xl"
                />
                
                <button 
                  onClick={() => handleSelect(customColor)}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-5 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98] uppercase tracking-[0.3em] text-xs"
                >
                  Commit Selection
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 bg-[#121214] border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest mb-1.5">Current Value</span>
                <div className="flex items-center gap-3">
                   <div style={{ backgroundColor: isSelected('bylayer') ? '#fff' : isSelected('byblock') ? '#aaa' : currentColor }} className="w-6 h-6 rounded-lg border border-white/10 shadow-inner" />
                   <div className="flex flex-col">
                     <span className="text-xs font-mono text-white font-black uppercase tracking-wider leading-none">{currentColor}</span>
                     {currentColor.startsWith('#') && (
                       <span className="text-[8px] font-mono text-neutral-500 font-bold uppercase tracking-tighter mt-1">RGB: {hexToRgbStr(currentColor)}</span>
                     )}
                   </div>
                </div>
              </div>
              
              {selectedAci !== null && (
                <div className="flex flex-col border-l border-white/5 pl-8">
                  <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest mb-1.5">AutoCAD Index</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em]">ACI {selectedAci}</span>
                  </div>
                </div>
              )}
           </div>
           <button onClick={onClose} className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-white transition-all bg-white/5 border border-transparent hover:border-white/10">
             Cancel
           </button>
        </div>

      </div>
    </div>
  );
};

export default ColorSelector;
