
import React, { useState, useEffect, useRef } from 'react';
// Fix: Added missing PolyShape import to satisfy type cast on line 154
import { Shape, AppSettings, LayerConfig, LineType, Point, LineShape, CircleShape, RectShape, ArcShape, TextShape, MTextShape, LeaderShape, PolyShape } from '../types';
import { X, Sliders, Layers, Target, Maximize2, PenTool, FileEdit, Move, Zap, ChevronDown, ChevronRight, Info, Type, Ruler, Box } from 'lucide-react';
import { formatLength, parseLength, distance } from '../services/cadService';

const PropertySection = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-[#00bcd4] opacity-80" />
          <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em]">{title}</span>
        </div>
        {isOpen ? <ChevronDown size={14} className="text-neutral-600" /> : <ChevronRight size={14} className="text-neutral-600" />}
      </button>
      {isOpen && <div className="pb-4 bg-black/10">{children}</div>}
    </div>
  );
};

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  layers: Record<string, LayerConfig>;
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onClose: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    selectedShapes, onUpdateShape, layers, settings, onUpdateSettings, onClose 
}) => {
  const isImperial = settings.units === 'imperial';
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

  const handleShapeChange = (key: string, value: any) => {
      selectedShapes.forEach(shape => onUpdateShape(shape.id, { [key]: value }));
  };

  const PropertyRow = ({ label, tooltip, children, readOnly = false }: { label: string, tooltip?: string, children?: React.ReactNode, readOnly?: boolean }) => (
    <div className={`flex items-center gap-2 px-6 py-2.5 ${readOnly ? 'opacity-60' : ''}`}>
      <div className="w-24 shrink-0 flex items-center gap-1.5">
        <span className="text-[9px] text-neutral-500 font-black uppercase tracking-tight truncate">{label}</span>
        {tooltip && (
          <div className="relative group/tip">
            <Info size={11} className="text-neutral-700 hover:text-[#00bcd4] transition-colors cursor-help" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );

  const NumericInput = ({ value, onChange, readOnly = false }: { value: number, onChange: (val: number) => void, readOnly?: boolean }) => {
    const [local, setLocal] = useState(formatLength(value, isImperial));
    useEffect(() => { setLocal(formatLength(value, isImperial)); }, [value, isImperial]);
    
    if (readOnly) return <span className="text-[10px] text-[#00bcd4]/70 font-mono px-3 truncate block">{local}</span>;

    return (
        <input 
            type="text"
            className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-mono rounded-lg px-3 py-2 outline-none focus:border-[#00bcd4]/50 transition-all uppercase shadow-inner"
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => { 
                const p = parseLength(local, isImperial); 
                if (!isNaN(p)) onChange(p); 
                else setLocal(formatLength(value, isImperial)); 
            }}
        />
    );
  };

  const lineTypes: { value: LineType; label: string }[] = [
    { value: 'continuous', label: 'Continuous' }, 
    { value: 'dashed', label: 'Dashed' }, 
    { value: 'dotted', label: 'Dotted' }, 
    { value: 'center', label: 'Center' },
  ];

  const renderGeometry = (s: Shape) => {
    switch (s.type) {
      case 'line': {
        const l = s as LineShape;
        const len = distance({x: l.x1, y: l.y1}, {x: l.x2, y: l.y2});
        return (
          <>
            <PropertyRow label="Start X"><NumericInput value={l.x1} onChange={v => handleShapeChange('x1', v)} /></PropertyRow>
            <PropertyRow label="Start Y"><NumericInput value={l.y1} onChange={v => handleShapeChange('y1', v)} /></PropertyRow>
            <PropertyRow label="End X"><NumericInput value={l.x2} onChange={v => handleShapeChange('x2', v)} /></PropertyRow>
            <PropertyRow label="End Y"><NumericInput value={l.y2} onChange={v => handleShapeChange('y2', v)} /></PropertyRow>
            <PropertyRow label="Length" readOnly><NumericInput value={len} onChange={() => {}} readOnly /></PropertyRow>
          </>
        );
      }
      case 'circle': {
        const c = s as CircleShape;
        const area = Math.PI * c.radius * c.radius;
        return (
          <>
            <PropertyRow label="Center X"><NumericInput value={c.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Center Y"><NumericInput value={c.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Radius"><NumericInput value={c.radius} onChange={v => handleShapeChange('radius', v)} /></PropertyRow>
            <PropertyRow label="Diameter" readOnly><NumericInput value={c.radius * 2} onChange={() => {}} readOnly /></PropertyRow>
            <PropertyRow label="Area" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3">{area.toFixed(2)} sq</span></PropertyRow>
          </>
        );
      }
      case 'rect': {
        const r = s as RectShape;
        return (
          <>
            <PropertyRow label="Origin X"><NumericInput value={r.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Origin Y"><NumericInput value={r.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Width"><NumericInput value={r.width} onChange={v => handleShapeChange('width', v)} /></PropertyRow>
            <PropertyRow label="Height"><NumericInput value={r.height} onChange={v => handleShapeChange('height', v)} /></PropertyRow>
          </>
        );
      }
      case 'pline': case 'spline': case 'polygon': {
          const p = s as PolyShape;
          return (
              <>
                <PropertyRow label="Points" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3">{p.points.length} nodes</span></PropertyRow>
                <PropertyRow label="Closed">
                    <button onClick={() => handleShapeChange('closed', !p.closed)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${p.closed ? 'bg-[#00bcd4]/10 border-[#00bcd4]/30 text-[#00bcd4]' : 'bg-white/5 border-white/5 text-neutral-500'}`}>
                        {p.closed ? 'Yes' : 'No'}
                    </button>
                </PropertyRow>
              </>
          );
      }
      default: return null;
    }
  };

  return (
    <div 
      className="fixed right-4 top-14 glass-panel w-[340px] rounded-[2rem] shadow-[0_50px_120px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 border border-white/10"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 160 }}
    >
      <div 
        className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#1a1a1c] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-8 h-8 rounded-xl bg-[#00bcd4]/10 flex items-center justify-center text-[#00bcd4]">
                <Sliders size={16} />
            </div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.25em]">Properties</h3>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-all"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[80vh] scrollbar-none bg-[#0d0d0f]">
          {selectedShapes.length > 0 ? (
              <div className="flex flex-col">
                <div className="px-6 py-4 bg-[#00bcd4]/5 border-b border-[#00bcd4]/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-black text-[#00bcd4] uppercase tracking-[0.15em]">{selectedShapes.length === 1 ? selectedShapes[0].type : 'Multiple'}</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#00bcd4]/20 text-[9px] text-[#00bcd4] font-black border border-[#00bcd4]/30">x{selectedShapes.length}</span>
                  </div>
                  <Zap size={14} className="text-[#00bcd4]" />
                </div>
                
                <PropertySection title="General Appearance" icon={Layers}>
                  <PropertyRow label="Layer">
                      <select 
                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-lg px-3 py-2 outline-none uppercase font-black cursor-pointer appearance-none hover:border-[#00bcd4]/30 transition-all" 
                        value={selectedShapes.length === 1 ? selectedShapes[0].layer : ''} 
                        onChange={(e) => handleShapeChange('layer', e.target.value)}
                      >
                          {Object.values(layers).map((l: LayerConfig) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                  </PropertyRow>

                  <PropertyRow label="Color">
                    <div className="flex items-center gap-4">
                      {/* Refined Color indicator as a thin 2px line */}
                      <div className="relative flex-1 h-[2px] rounded-full overflow-hidden bg-white/5 cursor-pointer group">
                        <div 
                          className="absolute inset-0 transition-all" 
                          style={{ backgroundColor: selectedShapes.length === 1 ? selectedShapes[0].color || '#ffffff' : '#444' }}
                        />
                        <input 
                          type="color" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                          value={selectedShapes.length === 1 ? selectedShapes[0].color || '#ffffff' : '#888888'} 
                          onChange={(e) => handleShapeChange('color', e.target.value)} 
                        />
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase shrink-0 min-w-[60px] text-right">
                        {selectedShapes.length === 1 ? selectedShapes[0].color : 'MIXED'}
                      </span>
                    </div>
                  </PropertyRow>

                  <PropertyRow label="Linetype">
                      <select 
                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-lg px-3 py-2 outline-none uppercase font-black cursor-pointer" 
                        value={selectedShapes.length === 1 ? selectedShapes[0].lineType || 'continuous' : ''} 
                        onChange={(e) => handleShapeChange('lineType', e.target.value)}
                      >
                          {lineTypes.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                      </select>
                  </PropertyRow>

                  <PropertyRow label="Lineweight">
                      <select 
                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-lg px-3 py-2 outline-none uppercase font-black cursor-pointer" 
                        value={selectedShapes.length === 1 ? selectedShapes[0].thickness?.toString() : ''} 
                        onChange={(e) => handleShapeChange('thickness', parseFloat(e.target.value))}
                      >
                          {["0.00", "0.05", "0.25", "0.50", "1.00", "2.11"].map(v => <option key={v} value={v}>{v} mm</option>)}
                      </select>
                  </PropertyRow>
                </PropertySection>

                <PropertySection title="Geometric Data" icon={Target}>
                   {selectedShapes.length === 1 ? renderGeometry(selectedShapes[0]) : (
                     <div className="px-8 py-10 text-center flex flex-col items-center gap-3">
                        <Box size={24} className="text-neutral-800" />
                        <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest leading-relaxed">Multi-Selection Geometry editing restricted</p>
                     </div>
                   )}
                </PropertySection>
              </div>
          ) : (
              <div className="flex flex-col py-20 px-8 items-center text-center">
                  <Maximize2 size={32} className="text-neutral-800 mb-6" />
                  <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3">No Entity Selected</h4>
                  <p className="text-[10px] text-neutral-700 font-bold uppercase tracking-widest leading-relaxed max-w-[200px]">Interact with the CAD canvas to inspect drawing properties.</p>
              </div>
          )}
      </div>
      
      <div className="px-6 py-4 bg-[#0d0d0f] border-t border-white/5 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00bcd4] animate-pulse" />
              <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Real-time DB Sync</span>
           </div>
           <span className="text-[8px] font-black text-neutral-800 uppercase tracking-widest">VoxCadd PRD 10A</span>
      </div>
    </div>
  );
};

export default PropertiesPanel;
