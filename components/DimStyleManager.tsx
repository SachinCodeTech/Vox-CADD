
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Ruler, Plus, Trash2, Settings2 } from 'lucide-react';
import { AppSettings, DimensionStyle } from '../types';
import { formatDimensionValue } from '../services/cadService';

const ArrowPreview: React.FC<{ type?: string, size: number, flip?: boolean }> = ({ type = 'closed', size, flip }) => {
    const s = Math.max(4, Math.min(20, size));
    const renderArrow = () => {
        switch (type) {
            case 'open':
                return <div className={`w-0 h-0 border-t-[${s/3}px] border-b-[${s/3}px] border-l-[${s}px] border-t-transparent border-b-transparent border-l-cyan-500`} style={{ borderWidth: `${s/3}px 0 ${s/3}px ${s}px`, borderColor: `transparent transparent transparent #06b6d4`, transform: flip ? 'rotate(180deg)' : 'none' }} />;
            case 'tick':
                return <div className="w-px h-6 bg-cyan-500/80 rotate-45" style={{ height: `${s*2}px` }} />;
            case 'dot':
                return <div className="rounded-full bg-cyan-500" style={{ width: `${s/1.5}px`, height: `${s/1.5}px` }} />;
            case 'closed':
            default:
                return (
                    <div 
                        className="w-0 h-0 border-t-transparent border-b-transparent border-l-cyan-500" 
                        style={{ 
                            borderWidth: `${s/3}px 0 ${s/3}px ${s}px`, 
                            borderColor: `transparent transparent transparent #06b6d4`,
                            transform: flip ? 'rotate(180deg)' : 'none'
                        }} 
                    />
                );
        }
    };
    return <div className="flex items-center justify-center">{renderArrow()}</div>;
};

interface DimStyleManagerProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClose: () => void;
}

const DimStyleManager: React.FC<DimStyleManagerProps> = ({ settings, onUpdateSettings, onClose }) => {
  const [activeStyleId, setActiveStyleId] = useState(settings.activeDimStyle);
  const styles = settings.dimStyles;
  const activeStyle = styles[activeStyleId] || Object.values(styles)[0];

  const [isCreating, setIsCreating] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newArrowType, setNewArrowType] = useState<'closed' | 'open' | 'tick' | 'dot'>('closed');
  const [newTextSize, setNewTextSize] = useState(12);
  const [newOffsetLine, setNewOffsetLine] = useState(5);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
    };
    const handleEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const updateStyle = (id: string, updates: Partial<DimensionStyle>) => {
    const newStyles = { ...styles, [id]: { ...styles[id], ...updates } };
    onUpdateSettings({ ...settings, dimStyles: newStyles });
  };

  const addStyle = () => {
    setIsCreating(true);
    setNewStyleName('');
    setNewTextSize(activeStyle.textSize || 12);
    setNewOffsetLine(activeStyle.offsetLine || 5);
    setNewArrowType(activeStyle.arrowType || 'closed');
  };

  const handleCreateStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStyleName.trim()) return;
    const id = newStyleName.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (styles[id]) {
      alert(`A dimension style with name "${newStyleName.trim()}" already exists.`);
      return;
    }

    const newStyle: DimensionStyle = {
      ...activeStyle,
      id,
      name: newStyleName.trim().toUpperCase(),
      arrowType: newArrowType,
      textSize: newTextSize,
      offsetLine: newOffsetLine,
      arrowSize: Math.max(3, newTextSize * 0.8),
    };

    onUpdateSettings({ 
        ...settings, 
        dimStyles: { ...styles, [id]: newStyle },
        activeDimStyle: id
    });
    setActiveStyleId(id);
    setIsCreating(false);
    setNewStyleName('');
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
    <div 
      className="relative bg-[#0e0e11] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] font-sans"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 1100 }}
    >
      {/* Create custom style Modal overlay */}
      {isCreating && (
        <div className="absolute inset-0 bg-[#060608]/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-350">
          <form onSubmit={handleCreateStyle} className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_32px_120px_rgba(0,0,0,0.9)] flex flex-col p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-cyan-400">
                      <Plus size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest font-sans">New Custom Dimension Style</span>
                  </div>
                  <button type="button" onClick={() => setIsCreating(false)} className="text-neutral-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full">
                      <X size={14} />
                  </button>
              </div>

              <div className="space-y-4 text-left">
                  <div className="space-y-1.5 flex flex-col">
                      <label className="text-[8px] font-black uppercase text-neutral-500 tracking-widest pl-1">Style Name</label>
                      <input 
                          type="text"
                          required
                          placeholder="e.g. ISO-25, MECHANICAL"
                          value={newStyleName}
                          onChange={e => setNewStyleName(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] uppercase font-bold text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-neutral-700 focus:bg-white/10"
                      />
                  </div>

                  <div className="space-y-1.5 flex flex-col">
                      <label className="text-[8px] font-black uppercase text-neutral-500 tracking-widest pl-1">Arrow Type</label>
                      <select 
                          value={newArrowType}
                          onChange={e => setNewArrowType(e.target.value as any)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] uppercase font-bold text-white outline-none focus:border-cyan-500/50 transition-all font-sans"
                      >
                          <option value="closed">Closed Filled</option>
                          <option value="open">Open</option>
                          <option value="tick">Architectural Tick</option>
                          <option value="dot">Dot</option>
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 flex flex-col">
                          <label className="text-[8px] font-black uppercase text-neutral-500 tracking-widest pl-1">Text Height</label>
                          <input 
                              type="number"
                              required
                              min="1"
                              value={newTextSize}
                              onChange={e => setNewTextSize(parseFloat(e.target.value) || 12)}
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500/50 transition-all"
                          />
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                          <label className="text-[8px] font-black uppercase text-neutral-500 tracking-widest pl-1">Ext. Line Offset</label>
                          <input 
                              type="number"
                              required
                              value={newOffsetLine}
                              onChange={e => setNewOffsetLine(parseFloat(e.target.value) || 5)}
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500/50 transition-all"
                          />
                      </div>
                  </div>
              </div>

              <div className="pt-4 flex gap-2">
                  <button 
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all active:scale-95"
                  >
                      Cancel
                  </button>
                  <button 
                      type="submit"
                      className="flex-1 py-2.5 bg-cyan-600 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all active:scale-95 shadow-md shadow-cyan-950/20"
                  >
                      Save Style
                  </button>
              </div>
          </form>
        </div>
      )}
      {/* Header */}
      <div 
        className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#121214] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
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

        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
          {/* Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-white/5 bg-[#0a0a0c] flex flex-col p-2 gap-1 overflow-y-auto max-h-[30vh] md:max-h-full">
            <div className="px-2 py-1 mb-2">
                <span className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Available Styles</span>
            </div>
            {Object.values(styles).map((style: DimensionStyle, i) => (
              <div 
                key={`${style.id}-${i}`}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group cursor-pointer shrink-0 ${activeStyleId === style.id ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,188,212,0.2)]' : 'text-neutral-400 hover:bg-white/5'}`}
                onClick={() => {
                  setActiveStyleId(style.id);
                  onUpdateSettings({ ...settings, activeDimStyle: style.id });
                }}
              >
                <span className="text-[10px] font-bold uppercase truncate pr-2 flex-1">{style.name}</span>
                <div className="flex items-center gap-1">
                  {activeStyleId !== style.id && Object.keys(styles).length > 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeStyle(style.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                      title="Delete Style"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {activeStyleId === style.id && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            ))}
            <button 
              onClick={addStyle}
              className="mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-neutral-600 hover:text-cyan-500 hover:border-cyan-500/50 transition-all shrink-0"
            >
              <Plus size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">New Style</span>
            </button>
          </div>

          {/* Properties Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0e0e11]">
            <div className="mb-6 flex items-center gap-2 text-cyan-500">
                <Settings2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Properties: {activeStyle.name}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <PropInput 
                    label="Arrow Size" 
                    value={activeStyle.arrowSize} 
                    onChange={val => updateStyle(activeStyle.id, { arrowSize: val })} 
                />
                <PropInput 
                    label="Arrow Scale" 
                    value={activeStyle.arrowScale || 1.0} 
                    onChange={val => updateStyle(activeStyle.id, { arrowScale: val })} 
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
                    <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Text Placement</label>
                    <select 
                        value={activeStyle.textPlacement || 'center'}
                        onChange={e => updateStyle(activeStyle.id, { textPlacement: e.target.value as 'above' | 'center' | 'below' })}
                        className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] uppercase font-bold text-white outline-none focus:border-cyan-500/50 transition-all"
                    >
                        <option value="above">Above Line</option>
                        <option value="center">Centered</option>
                        <option value="below">Below Line</option>
                    </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Arrow Type</label>
                    <select 
                        value={activeStyle.arrowType || 'closed'}
                        onChange={e => updateStyle(activeStyle.id, { arrowType: e.target.value as 'closed' | 'open' | 'tick' | 'dot' })}
                        className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] uppercase font-bold text-white outline-none focus:border-cyan-500/50 transition-all"
                    >
                        <option value="closed">Closed Filled</option>
                        <option value="open">Open</option>
                        <option value="tick">Architectural Tick</option>
                        <option value="dot">Dot</option>
                    </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Unit Format</label>
                    <select 
                        value={activeStyle.unitFormat || 'decimal'}
                        onChange={e => updateStyle(activeStyle.id, { unitFormat: e.target.value as any })}
                        className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] uppercase font-bold text-white outline-none focus:border-cyan-500/50 transition-all"
                    >
                        <option value="decimal">Decimal</option>
                        <option value="architectural">Architectural</option>
                        <option value="engineering">Engineering</option>
                        <option value="fractional">Fractional</option>
                    </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest">Precision / Fractional</label>
                    {activeStyle.unitFormat === 'architectural' || activeStyle.unitFormat === 'fractional' ? (
                        <select 
                            value={activeStyle.fractionalPrecision || 16}
                            onChange={e => updateStyle(activeStyle.id, { fractionalPrecision: parseInt(e.target.value) })}
                            className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500/50 transition-all"
                        >
                            <option value={1}>1</option>
                            <option value={2}>1/2</option>
                            <option value={4}>1/4</option>
                            <option value={8}>1/8</option>
                            <option value={16}>1/16</option>
                            <option value={32}>1/32</option>
                            <option value={64}>1/64</option>
                        </select>
                    ) : (
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
                    )}
                </div>
            </div>

            {/* Preview Section - Expanded */}
            <div className="mt-10 p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center">
                <div className="text-[8px] font-black uppercase text-neutral-700 tracking-[0.2em] mb-6">Live Style Preview</div>
                <div className="relative w-full max-w-[400px] h-32 flex items-center justify-center">
                    {/* Fake Dim line */}
                    <div className="absolute left-10 right-10 h-px bg-cyan-500/50" />
                    
                    {/* Extension lines */}
                    <div className="absolute left-10 w-px bg-cyan-500/30" style={{ height: '40px', bottom: '50%', transform: `translateY(${activeStyle.offsetLine/10}px)` }} />
                    <div className="absolute right-10 w-px bg-cyan-500/30" style={{ height: '40px', bottom: '50%', transform: `translateY(${activeStyle.offsetLine/10}px)` }} />
                    
                    {/* Fake Text */}
                    <div 
                        className={`bg-[#121214] px-2 py-0.5 rounded text-cyan-400 font-mono text-[11px] z-10 transition-all cursor-default select-none ${activeStyle.textPlacement === 'above' ? 'mb-10 border border-white/5' : (activeStyle.textPlacement === 'below' ? 'mt-10 border border-white/5' : 'bg-[#121214] border-none')}`}
                    >
                        {formatDimensionValue(1250, activeStyle, settings)}
                    </div>

                    {/* Arrows */}
                    <div className="absolute left-10 flex items-center justify-center">
                        <ArrowPreview type={activeStyle.arrowType} size={activeStyle.arrowSize * (activeStyle.arrowScale || 1) / 15} flip />
                    </div>
                    <div className="absolute right-10 flex items-center justify-center">
                        <ArrowPreview type={activeStyle.arrowType} size={activeStyle.arrowSize * (activeStyle.arrowScale || 1) / 15} />
                    </div>
                </div>
                
                <div className="w-full grid grid-cols-3 gap-4 mt-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 items-center flex flex-col">
                        <span className="text-[7px] font-bold text-neutral-600 uppercase">Unit Format</span>
                        <span className="text-[9px] font-black text-white uppercase mt-1">{activeStyle.unitFormat || 'Decimal'}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 items-center flex flex-col">
                        <span className="text-[7px] font-bold text-neutral-600 uppercase">Placement</span>
                        <span className="text-[9px] font-black text-white uppercase mt-1">{activeStyle.textPlacement || 'Centered'}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 items-center flex flex-col">
                        <span className="text-[7px] font-bold text-neutral-600 uppercase">Arrow</span>
                        <span className="text-[9px] font-black text-white uppercase mt-1">{activeStyle.arrowType || 'Closed'}</span>
                    </div>
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
