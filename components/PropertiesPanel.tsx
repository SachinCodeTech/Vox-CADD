
import React, { useState, useEffect, useRef } from 'react';
// Fix: Added missing PolyShape import to satisfy type cast on line 154
import { Shape, AppSettings, LayerConfig, LineType, Point, LineShape, CircleShape, RectShape, ArcShape, TextShape, MTextShape, LeaderShape, PolyShape, EllipseShape, DonutShape, DimensionShape, DoubleLineShape } from '../types';
import { X, Sliders, Layers, Target, Maximize2, PenTool, FileEdit, Move, Zap, ChevronDown, ChevronRight, Info, Type, Ruler, Box, Compass, Activity, Hash, Layers2, Square, Copy, Scissors, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import { formatLength, parseLength, distance, calculateArea, calculatePolylineLength, formatDualLength, formatDualArea, calculateShapeLength } from '../services/cadService';

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
  lineTypeDefinitions?: Record<string, any>;
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onClose: () => void;
  onCommand?: (cmd: string) => void;
  onFilterType?: (type: string) => void;
  onOpenColorSelector?: (currentColor: string, onSelect: (color: string) => void, title?: string) => void;
}

const LineTypePreview = ({ type, color = "#00bcd4", weight = 1 }: { type: LineType, color?: string, weight?: number }) => {
  const L = 10; 
  const getDash = () => {
    switch (type) {
        case 'dashed': return [L * 2.0, L * 1.5];
        case 'dotted': return [0.5, L * 1.0];
        case 'center': return [L * 5, L * 1.5, L * 1, L * 1.5];
        case 'dashdot': return [L * 5, L * 1.5, L * 0.8, L * 1.5];
        case 'border': return [L * 8, L * 1.5, L * 2.5, L * 1.5];
        case 'divide': return [L * 4, L * 1, L * 1, L * 1, L * 1, L * 1];
        case 'phantom': return [L * 8, L * 1.2, L * 1.2, L * 1.2, L * 1.2, L * 1.2];
        case 'zigzag': return [L * 5, L * 1.5, L * 1.5, L * 1.5];
        case 'hotwater': return [L * 7, L * 2, L * 1, L * 2, L * 1, L * 2];
        case 'hidden': return [L * 1.2, L * 1.2];
        case 'gasLine': return [L * 12, L * 4, L * 1.5, L * 4];
        case 'fenceLine': return [L * 8, L * 1.2, L * 1.2, L * 1.2];
        case 'tracks': return [L * 3, L * 1.5, L * 3, L * 1.5];
        case 'batt': return [L * 3.5, L * 0.5, L * 0.5, L * 0.5, L * 3.5, L * 0.5];
        case 'zigzag2': return [L * 2, L * 1];
        case 'dots2': return [0.5, L * 0.5];
        case 'dash2': return [L * 1, L * 1];
        default: return [];
    }
  };

  return (
    <svg width="60" height="12" className="overflow-visible">
      <line 
        x1="0" y1="6" x2="60" y2="6" 
        stroke={color} 
        strokeWidth={Math.max(1, weight * 0.5)} 
        strokeDasharray={getDash().join(',')}
      />
    </svg>
  );
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    selectedShapes, onUpdateShape, layers, lineTypeDefinitions, settings, onUpdateSettings, onClose, onCommand, onFilterType, onOpenColorSelector
}) => {
  const isImperial = settings.units === 'imperial';
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [activePanelTab, setActivePanelTab] = useState<'props' | 'stats'>('props');
  const [filterType, setFilterType] = useState<string | null>(null);
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

  const NumericInput = ({ value, onChange, readOnly = false, isArea = false }: { value: number, onChange: (val: number) => void, readOnly?: boolean, isArea?: boolean }) => {
    const { primary, secondary } = isArea ? formatDualArea(value, settings) : formatDualLength(value, settings);
    const [local, setLocal] = useState(primary);
    useEffect(() => { setLocal(primary); }, [value, isImperial, primary]);
    
    if (readOnly) return (
      <div className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between shadow-inner group-hover/row:bg-white/[0.02] transition-colors">
        <span className={`text-[11px] font-mono truncate block leading-none ${isArea ? 'text-[#00bcd4]' : 'text-white'}`}>{primary}</span>
        <span className="text-[9px] text-neutral-600 font-mono tracking-tighter truncate block leading-none ml-2 uppercase opacity-80">{secondary}</span>
      </div>
    );

    return (
        <div className="group/input relative">
            <input 
                type="text"
                name={`vox-props-${Math.random()}`}
                className="w-full bg-[#121214] border border-white/5 text-[11px] text-white font-mono rounded-xl px-4 py-3 pb-3 outline-none focus:border-[#00bcd4]/50 transition-all uppercase shadow-inner"
                value={local}
                onChange={e => setLocal(e.target.value)}
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                onBlur={() => { 
                    const p = parseLength(local, settings); 
                    if (!isNaN(p)) onChange(p); 
                    else setLocal(primary); 
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const p = parseLength(local, settings);
                        if (!isNaN(p)) onChange(p);
                        (e.target as HTMLInputElement).blur();
                    }
                }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity flex flex-col items-end opacity-100">
                <span className="text-[9px] text-neutral-600 font-mono uppercase bg-[#121214] px-1 tracking-tighter">{secondary}</span>
            </div>
        </div>
    );
  };

  const DualAreaLabel = ({ value }: { value: number }) => {
    return <NumericInput value={value} onChange={() => {}} readOnly={true} isArea={true} />;
  };

  const baseLineTypes: { value: LineType; label: string }[] = [
    { value: 'bylayer', label: 'By Layer' },
    { value: 'byblock', label: 'By Block' },
    { value: 'continuous', label: 'Continuous' }, 
    { value: 'dashed', label: 'Dashed' }, 
    { value: 'dotted', label: 'Dotted' }, 
    { value: 'center', label: 'Center' },
    { value: 'dashdot', label: 'Dash Dot' },
    { value: 'border', label: 'Border' },
    { value: 'divide', label: 'Divide' },
    { value: 'phantom', label: 'Phantom' },
    { value: 'zigzag', label: 'Zigzag' },
    { value: 'hotwater', label: 'Hot Water' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'gasLine', label: 'Gas Line' },
    { value: 'fenceLine', label: 'Fence Line' },
    { value: 'tracks', label: 'Tracks' },
    { value: 'batt', label: 'Batt' },
    { value: 'zigzag2', label: 'Zigzag 2' },
    { value: 'dots2', label: 'Dots (dense)' },
    { value: 'dash2', label: 'Dashed (short)' },
  ];

  const allLineTypes = [...baseLineTypes];
  if (lineTypeDefinitions) {
    Object.keys(lineTypeDefinitions).forEach(key => {
      if (!allLineTypes.find(lt => lt.value === key)) {
          allLineTypes.push({ value: key as LineType, label: lineTypeDefinitions[key].description || key });
      }
    });
  }

  const LINE_WEIGHTS = [
    "DEFAULT", "0.00", "0.05", "0.09", "0.13", "0.15", "0.18", "0.20", "0.25",
    "0.30", "0.35", "0.40", "0.50", "0.60", "0.70", "0.80", "1.00", "1.40", "2.00", "2.11"
  ];

  const renderGeometry = (s: Shape) => {
    switch (s.type) {
      case 'line': {
        const l = s as LineShape;
        const len = distance({x: l.x1, y: l.y1}, {x: l.x2, y: l.y2});
        const angle = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
        return (
          <>
            <PropertyRow label="Start X"><NumericInput value={l.x1} onChange={v => handleShapeChange('x1', v)} /></PropertyRow>
            <PropertyRow label="Start Y"><NumericInput value={l.y1} onChange={v => handleShapeChange('y1', v)} /></PropertyRow>
            <PropertyRow label="End X"><NumericInput value={l.x2} onChange={v => handleShapeChange('x2', v)} /></PropertyRow>
            <PropertyRow label="End Y"><NumericInput value={l.y2} onChange={v => handleShapeChange('y2', v)} /></PropertyRow>
            <PropertyRow label="Length" readOnly><NumericInput value={len} onChange={() => {}} readOnly /></PropertyRow>
            <PropertyRow label="Angle" readOnly><span className="text-[10px] text-[#00bcd4]/70 font-mono px-3">{angle.toFixed(2)}°</span></PropertyRow>
          </>
        );
      }
      case 'circle': {
        const c = s as CircleShape;
        const area = Math.PI * c.radius * c.radius;
        const circ = 2 * Math.PI * c.radius;
        return (
          <>
            <PropertyRow label="Center X"><NumericInput value={c.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Center Y"><NumericInput value={c.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Radius"><NumericInput value={c.radius} onChange={v => handleShapeChange('radius', v)} /></PropertyRow>
            <PropertyRow label="Diameter"><NumericInput value={c.radius * 2} onChange={v => handleShapeChange('radius', v / 2)} /></PropertyRow>
            <PropertyRow label="Circumf." readOnly><NumericInput value={circ} onChange={() => {}} readOnly /></PropertyRow>
            <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>
          </>
        );
      }
      case 'rect': {
        const r = s as RectShape;
        const area = r.width * r.height;
        const perim = 2 * (r.width + r.height);
        return (
          <>
            <PropertyRow label="Origin X"><NumericInput value={r.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Origin Y"><NumericInput value={r.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Width"><NumericInput value={r.width} onChange={v => handleShapeChange('width', v)} /></PropertyRow>
            <PropertyRow label="Height"><NumericInput value={r.height} onChange={v => handleShapeChange('height', v)} /></PropertyRow>
            <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>
            <PropertyRow label="Perimeter" readOnly><NumericInput value={perim} onChange={() => {}} readOnly /></PropertyRow>
          </>
        );
      }
      case 'pline': case 'spline': case 'polygon': {
          const p = s as PolyShape;
          const len = calculatePolylineLength(p.points, p.closed);
          const area = p.closed ? calculateArea(p.points) : 0;
          return (
              <>
                <PropertyRow label="Nodes" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3">{p.points.length} points</span></PropertyRow>
                <PropertyRow label="Length" readOnly><NumericInput value={len} onChange={() => {}} readOnly /></PropertyRow>
                {p.closed && <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>}
                <PropertyRow label="Closed">
                    <button onClick={() => handleShapeChange('closed', !p.closed)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${p.closed ? 'bg-[#00bcd4]/10 border-[#00bcd4]/30 text-[#00bcd4]' : 'bg-white/5 border-white/5 text-neutral-500'}`}>
                        {p.closed ? 'Yes' : 'No'}
                    </button>
                </PropertyRow>
              </>
          );
      }
      case 'dline': {
        const d = s as DoubleLineShape;
        const len = calculatePolylineLength(d.points, d.closed);
        return (
          <>
            <PropertyRow label="Nodes" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3">{d.points.length} points</span></PropertyRow>
            <PropertyRow label="Thickness"><NumericInput value={d.thickness} onChange={v => handleShapeChange('thickness', v)} /></PropertyRow>
            <PropertyRow label="Length" readOnly><NumericInput value={len} onChange={() => {}} readOnly /></PropertyRow>
            <PropertyRow label="Justify" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3 uppercase">{d.justification}</span></PropertyRow>
          </>
        );
      }
      case 'arc': {
        const a = s as ArcShape;
        const arcLen = a.radius * Math.abs(a.endAngle - a.startAngle);
        return (
          <>
            <PropertyRow label="Center X"><NumericInput value={a.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Center Y"><NumericInput value={a.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Radius"><NumericInput value={a.radius} onChange={v => handleShapeChange('radius', v)} /></PropertyRow>
            <PropertyRow label="Start Angle"><NumericInput value={a.startAngle * 180 / Math.PI} onChange={v => handleShapeChange('startAngle', v * Math.PI / 180)} /></PropertyRow>
            <PropertyRow label="End Angle"><NumericInput value={a.endAngle * 180 / Math.PI} onChange={v => handleShapeChange('endAngle', v * Math.PI / 180)} /></PropertyRow>
            <PropertyRow label="Arc Length" readOnly><NumericInput value={arcLen} onChange={() => {}} readOnly /></PropertyRow>
          </>
        );
      }
      case 'ellipse': {
        const e = s as EllipseShape;
        const area = Math.PI * e.rx * e.ry;
        return (
          <>
            <PropertyRow label="Center X"><NumericInput value={e.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Center Y"><NumericInput value={e.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Axis Major"><NumericInput value={e.rx} onChange={v => handleShapeChange('rx', v)} /></PropertyRow>
            <PropertyRow label="Axis Minor"><NumericInput value={e.ry} onChange={v => handleShapeChange('ry', v)} /></PropertyRow>
            <PropertyRow label="Rotation"><NumericInput value={e.rotation * 180 / Math.PI} onChange={v => handleShapeChange('rotation', v * Math.PI / 180)} /></PropertyRow>
            <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>
          </>
        );
      }
      case 'donut': {
        const d = s as DonutShape;
        const area = Math.PI * (d.outerRadius * d.outerRadius - d.innerRadius * d.innerRadius);
        return (
          <>
            <PropertyRow label="Center X"><NumericInput value={d.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
            <PropertyRow label="Center Y"><NumericInput value={d.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
            <PropertyRow label="Inner Rad"><NumericInput value={d.innerRadius} onChange={v => handleShapeChange('innerRadius', v)} /></PropertyRow>
            <PropertyRow label="Outer Rad"><NumericInput value={d.outerRadius} onChange={v => handleShapeChange('outerRadius', v)} /></PropertyRow>
            <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>
          </>
        );
      }
      case 'hatch': {
        const h = s as any;
        const area = calculateArea(h.points);
        return (
          <>
            <PropertyRow label="Pattern">
               <select 
                 value={h.pattern}
                 onChange={e => handleShapeChange('pattern', e.target.value)}
                 className="w-full bg-[#121214] border border-white/5 text-[11px] text-white font-mono rounded-xl px-4 py-3 outline-none focus:border-[#00bcd4]/50 transition-all uppercase"
               >
                 <option value="solid">Solid</option>
                 <option value="ansi31">ANSI31 (Iron)</option>
                 <option value="ansi32">ANSI32 (Steel)</option>
                 <option value="ansi33">ANSI33 (Bronze)</option>
                 <option value="ansi37">ANSI37 (Glass)</option>
                 <option value="ansi38">ANSI38 (Check)</option>
                 <option value="dots">Dots</option>
                 <option value="cross">Cross</option>
                 <option value="net">Net</option>
                 <option value="honey">Honey</option>
                 <option value="gravel">Gravel</option>
                 <option value="brick">Brick</option>
                 <option value="hound">Houndst.</option>
                 <option value="grid">Grid</option>
                 <option value="triang">Triangle</option>
                 <option value="zigzag">Zigzag</option>
                 <option value="stars">Stars</option>
                 <option value="grass">Grass</option>
                 <option value="clay">Clay</option>
                 <option value="cork">Cork</option>
               </select>
            </PropertyRow>
            <PropertyRow label="Scale"><NumericInput value={h.scale || 1} onChange={v => handleShapeChange('scale', v)} /></PropertyRow>
            <PropertyRow label="Rotation"><NumericInput value={(h.rotation || 0)} onChange={v => handleShapeChange('rotation', v)} /></PropertyRow>
            <PropertyRow label="Area" readOnly><DualAreaLabel value={area} /></PropertyRow>
          </>
        );
      }
      case 'dimension': {
        const d = s as DimensionShape;
        const actualLen = distance({x: d.x1, y: d.y1}, {x: d.x2, y: d.y2});
        return (
          <>
            <PropertyRow label="Dim Type" readOnly><span className="text-[10px] text-neutral-400 font-mono px-3 uppercase">{d.dimType}</span></PropertyRow>
            <PropertyRow label="Measured" readOnly><NumericInput value={actualLen} onChange={() => {}} readOnly /></PropertyRow>
            <PropertyRow label="Point 1 X"><NumericInput value={d.x1} onChange={v => handleShapeChange('x1', v)} /></PropertyRow>
            <PropertyRow label="Point 1 Y"><NumericInput value={d.y1} onChange={v => handleShapeChange('y1', v)} /></PropertyRow>
            <PropertyRow label="Point 2 X"><NumericInput value={d.x2} onChange={v => handleShapeChange('x2', v)} /></PropertyRow>
            <PropertyRow label="Point 2 Y"><NumericInput value={d.y2} onChange={v => handleShapeChange('y2', v)} /></PropertyRow>
            <PropertyRow label="Override Text">
                <input 
                    type="text"
                    className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-mono rounded-lg px-3 py-2 outline-none focus:border-[#00bcd4]/50"
                    value={d.text}
                    onChange={e => handleShapeChange('text', e.target.value)}
                />
            </PropertyRow>
          </>
        );
      }
      case 'text': case 'mtext': {
          const t = s as TextShape | MTextShape;
          return (
              <>
                <PropertyRow label="Position X"><NumericInput value={t.x} onChange={v => handleShapeChange('x', v)} /></PropertyRow>
                <PropertyRow label="Position Y"><NumericInput value={t.y} onChange={v => handleShapeChange('y', v)} /></PropertyRow>
                <PropertyRow label="Height"><NumericInput value={t.size} onChange={v => handleShapeChange('size', v)} /></PropertyRow>
                <PropertyRow label="Font Family">
                    <select 
                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-mono rounded-lg px-3 py-2 outline-none focus:border-[#00bcd4]/50 transition-all uppercase"
                        value={t.fontFamily || 'monospace'}
                        onChange={e => handleShapeChange('fontFamily', e.target.value)}
                    >
                        <option value="monospace">Monospace</option>
                        <option value="serif">Serif</option>
                        <option value="sans-serif">Sans-Serif</option>
                        <option value="Inter">Inter (UI)</option>
                        <option value="Space Grotesk">Space Grotesk (Tech)</option>
                        <option value="Outfit">Outfit (Modern)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Code)</option>
                        <option value="Playfair Display">Playfair Display (Elegant)</option>
                        <option value="Impact">Impact (Bold)</option>
                        <option value="Comic Sans MS">Comic Sans MS (Draft)</option>
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </PropertyRow>
                <PropertyRow label="Rotation"><NumericInput value={t.rotation || 0} onChange={v => handleShapeChange('rotation', v)} /></PropertyRow>
                <PropertyRow label="Content">
                    <textarea 
                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-sans rounded-lg px-3 py-2 outline-none focus:border-[#00bcd4]/50 transition-all resize-none h-20"
                        value={t.content}
                        onChange={e => handleShapeChange('content', e.target.value)}
                    />
                </PropertyRow>
              </>
          );
      }
      default: return null;
    }
  };

  return (
    <div 
      className="relative glass-panel w-full sm:w-[340px] sm:max-w-[95vw] h-full sm:h-auto sm:max-h-[85vh] sm:rounded-[2rem] shadow-[0_50px_120px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/10"
      style={{ transform: window.innerWidth > 640 ? `translate(${pos.x}px, ${pos.y}px)` : undefined, zIndex: 160 }}
    >
      <div 
        className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#1a1a1c] sm:cursor-grab active:sm:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => window.innerWidth > 640 && startDrag(e.clientX, e.clientY)}
        onTouchStart={e => window.innerWidth > 640 && e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-8 h-8 rounded-xl bg-[#00bcd4]/10 flex items-center justify-center text-[#00bcd4]">
                <Sliders size={16} />
            </div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.25em]">Properties</h3>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-all"><X size={20} /></button>
      </div>

      <div className="flex bg-[#1a1a1c] border-b border-white/5 shrink-0">
          <button 
            onClick={() => setActivePanelTab('props')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activePanelTab === 'props' ? 'text-[#00bcd4] border-[#00bcd4] bg-[#00bcd4]/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <Sliders size={12} />
            Properties
          </button>
          <button 
            onClick={() => setActivePanelTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activePanelTab === 'stats' ? 'text-[#00bcd4] border-[#00bcd4] bg-[#00bcd4]/5' : 'text-neutral-500 border-transparent hover:text-white'}`}
          >
            <Activity size={12} />
            Statistics
          </button>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[80vh] scrollbar-none bg-[#0d0d0f]">
          {selectedShapes.length > 0 ? (
              <div className="flex flex-col">
                {activePanelTab === 'props' ? (
                  <>
                  <div className="px-6 py-4 bg-[#00bcd4]/5 border-b border-[#00bcd4]/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-black text-[#00bcd4] uppercase tracking-[0.15em]">
                        {filterType ? filterType : (selectedShapes.length === 1 ? selectedShapes[0].type : 'Multiple')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#00bcd4]/20 text-[9px] text-[#00bcd4] font-black border border-[#00bcd4]/30">
                        x{filterType ? (selectedShapes.filter(s => s.type === filterType).length) : selectedShapes.length}
                      </span>
                    </div>
                    {filterType && (
                        <button 
                            onClick={() => setFilterType(null)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[8px] font-black uppercase hover:bg-red-500/20 transition-all"
                        >
                            <XCircle size={10} />
                            Clear Filter
                        </button>
                    )}
                    {!filterType && <Zap size={14} className="text-[#00bcd4]" />}
                  </div>

                  {(() => {
                    const filtered = filterType ? selectedShapes.filter(s => s.type === filterType) : selectedShapes;
                    
                    if (filtered.length === 1) {
                      const s = filtered[0];
                      return (
                        <>
                          <PropertySection title="Entity Identity" icon={Info} defaultOpen={false}>
                            <PropertyRow label="Entity Type" readOnly>
                                <span className="text-[10px] text-[#00bcd4] font-black uppercase tracking-wider px-3">{s.type}</span>
                            </PropertyRow>
                            <PropertyRow label="Handle" readOnly>
                                <span className="text-[10px] text-neutral-500 font-mono px-3">{s.id}</span>
                            </PropertyRow>
                          </PropertySection>
                          
                          <PropertySection title="General Appearance" icon={Layers}>
                            <PropertyRow label="Layer">
                                <div className="relative group/select">
                                    <select 
                                      className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-xl px-4 py-3 outline-none font-black uppercase cursor-pointer appearance-none hover:border-[#00bcd4]/40 hover:bg-black transition-all shadow-inner" 
                                      value={s.layer} 
                                      onChange={(e) => onUpdateShape(s.id, { layer: e.target.value })}
                                    >
                                        {Object.values(layers).map((l: LayerConfig) => <option key={`prop-layer-opt-${l.id}`} value={l.id} className="bg-[#121214] text-white">{l.name}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 transition-colors group-hover/select:text-[#00bcd4]">
                                        <ChevronDown size={11} />
                                    </div>
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Color">
                              <div className="flex items-center gap-3">
                                <div 
                                  title="Change Color"
                                  className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-transform shrink-0"
                                  style={{ backgroundColor: s.color && (s.color === 'BYLAYER' || s.color === 'BYBLOCK') ? '#444' : (s.color || '#ffffff') }}
                                  onClick={() => {
                                      onOpenColorSelector?.(s.color || '#FFFFFF', (color) => {
                                          onUpdateShape(s.id, { color });
                                      }, `Entity: ${s.type.toUpperCase()}`);
                                  }}
                                >
                                  { (s.color === 'BYLAYER' || s.color === 'BYBLOCK') && (
                                      <div className="absolute inset-0 flex items-center justify-center text-[7px] font-black uppercase text-white/40">
                                          {s.color === 'BYLAYER' ? 'LAYER' : 'BLOCK'}
                                      </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="text"
                                    className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-mono rounded-xl px-4 py-3 outline-none focus:border-[#00bcd4]/50 transition-all uppercase shadow-inner"
                                    value={s.color || 'BYLAYER'}
                                    spellCheck={false}
                                    onClick={() => {
                                        onOpenColorSelector?.(s.color || '#FFFFFF', (color) => {
                                            onUpdateShape(s.id, { color });
                                        }, `Entity: ${s.type.toUpperCase()}`);
                                    }}
                                    readOnly
                                  />
                                </div>
                              </div>
                            </PropertyRow>

                            <PropertyRow label="Linetype">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative group/select">
                                        <select 
                                          className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-xl px-4 pr-8 py-3 outline-none uppercase font-black cursor-pointer appearance-none hover:border-[#00bcd4]/40 hover:bg-black transition-all shadow-inner" 
                                          value={s.lineType || 'continuous'} 
                                          onChange={(e) => onUpdateShape(s.id, { lineType: e.target.value as LineType })}
                                        >
                                            {allLineTypes.map((lt, idx) => <option key={`${lt.value}-${idx}`} value={lt.value} className="bg-[#121214] text-white py-2">{lt.label}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 transition-colors group-hover/select:text-[#00bcd4]">
                                            <ChevronDown size={11} />
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl px-3 py-3 flex items-center justify-center min-w-[80px] shadow-inner border border-white/5">
                                      <LineTypePreview 
                                          type={s.lineType || 'continuous'} 
                                          color={s.color || '#00bcd4'}
                                      />
                                    </div>
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Lineweight">
                                <div className="relative group/select">
                                    <select 
                                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-xl px-4 pr-8 py-3 outline-none uppercase font-black cursor-pointer appearance-none hover:border-[#00bcd4]/40 hover:bg-black transition-all shadow-inner text-left font-mono" 
                                        value={typeof s.thickness === 'number' ? s.thickness.toFixed(2) : (s.thickness || 'BYLAYER')} 
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === 'BYLAYER' || val === 'BYBLOCK' || val === 'DEFAULT') {
                                            onUpdateShape(s.id, { thickness: val });
                                          } else {
                                            onUpdateShape(s.id, { thickness: parseFloat(val) });
                                          }
                                        }}
                                    >
                                        <option value="BYLAYER" className="bg-[#121214] text-white">By Layer</option>
                                        <option value="BYBLOCK" className="bg-[#121214] text-white">By Block</option>
                                        {LINE_WEIGHTS.map(w => <option key={w} value={w} className="bg-[#121214] text-white">{w}{w !== 'DEFAULT' ? 'mm' : ''}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 transition-colors group-hover/select:text-[#00bcd4]">
                                        <ChevronDown size={11} />
                                    </div>
                                </div>
                            </PropertyRow>
                          </PropertySection>

                          <PropertySection title="Geometric Data" icon={Target}>
                            {renderGeometry(s)}
                          </PropertySection>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <PropertySection title="General appearance" icon={Layers}>
                             <PropertyRow label="Global Color">
                               <div className="flex items-center gap-3">
                                 <div 
                                   title="Change All Colors"
                                   className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-transform shrink-0"
                                   style={{ backgroundColor: filtered.every(s => s.color === filtered[0].color) ? (filtered[0].color === 'BYLAYER' || filtered[0].color === 'BYBLOCK' ? '#444' : (filtered[0].color || '#ffffff')) : '#222' }}
                                   onClick={() => {
                                       onOpenColorSelector?.(filtered[0].color || '#FFFFFF', (color) => {
                                           filtered.forEach(s => onUpdateShape(s.id, { color }));
                                       }, `Multiple: ${filtered.length} Objects`);
                                   }}
                                 >
                                    {filtered.every(s => s.color === filtered[0].color) && (filtered[0].color === 'BYLAYER' || filtered[0].color === 'BYBLOCK') && (
                                        <div className="absolute inset-0 flex items-center justify-center text-[6px] font-black uppercase text-white/40">
                                            {filtered[0].color === 'BYLAYER' ? 'LAYER' : 'BLOCK'}
                                        </div>
                                    )}
                                 </div>
                                 <div className="flex-1">
                                    <input 
                                      type="text"
                                      className="w-full bg-[#121214] border border-white/5 text-[10px] text-white font-mono rounded-lg px-2 py-1.5 outline-none focus:border-[#00bcd4]/50 transition-all uppercase cursor-pointer"
                                      placeholder="Mixed"
                                      value={filtered.every(s => s.color === filtered[0].color) ? (filtered[0].color || 'BYLAYER') : ''}
                                      onClick={() => {
                                          onOpenColorSelector?.(filtered[0].color || '#FFFFFF', (color) => {
                                              filtered.forEach(s => onUpdateShape(s.id, { color }));
                                          }, `Multiple: ${filtered.length} Objects`);
                                      }}
                                      readOnly
                                    />
                                 </div>
                               </div>
                             </PropertyRow>
                             <PropertyRow label="Global Layer">
                                <select 
                                    className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-lg px-3 py-2 outline-none uppercase font-black cursor-pointer appearance-none hover:border-[#00bcd4]/30 transition-all" 
                                    value={filtered.every(s => s.layer === filtered[0].layer) ? filtered[0].layer : ''} 
                                    onChange={(e) => filtered.forEach(s => onUpdateShape(s.id, { layer: e.target.value }))}
                                >
                                    <option value="" disabled>Mixed Layers</option>
                                    {Object.values(layers).map((l: LayerConfig) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                             </PropertyRow>
                          </PropertySection>

                          <PropertySection title="Geometric Data" icon={Target}>
                            <div className="px-8 py-10 text-center flex flex-col items-center gap-3">
                                <Box size={24} className="text-neutral-800" />
                                <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest leading-relaxed">Multi-Selection Geometry editing restricted</p>
                            </div>
                          </PropertySection>
                        </>
                      );
                    }
                  })()}
                  </>
                ) : (
                  <div className="flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="px-6 py-4 bg-[#00bcd4]/5 border-b border-[#00bcd4]/10">
                        <h4 className="text-[10px] font-black text-[#00bcd4] uppercase tracking-[0.2em] mb-1">Selection Summary</h4>
                        <p className="text-[8px] text-neutral-500 uppercase tracking-widest">{selectedShapes.length} objects currently selected</p>
                    </div>

                    <div className="px-6 py-6 space-y-6">
                        <div className="space-y-2">
                           <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest pl-2">Object Types</span>
                           <div className="grid grid-cols-2 gap-2">
                              {Object.entries(selectedShapes.reduce((acc, s) => {
                                  acc[s.type] = (acc[s.type] || 0) + 1;
                                  return acc;
                              }, {} as Record<string, number>)).map(([type, count]) => (
                                  <button 
                                      key={type} 
                                      onClick={() => {
                                          setFilterType(type);
                                          setActivePanelTab('props');
                                      }}
                                      className="bg-[#121214] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-[#00bcd4]/10 hover:border-[#00bcd4]/30 transition-all active:scale-95 group/stat"
                                  >
                                      <span className="text-[9px] text-neutral-400 group-hover/stat:text-[#00bcd4] font-black uppercase tracking-tighter transition-colors">{type}</span>
                                      <span className="text-[11px] text-[#00bcd4] font-black leading-none">{count}</span>
                                  </button>
                              ))}
                           </div>
                        </div>
                        
                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest pl-2">Accumulated Data</span>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between px-4 py-3 bg-[#121214] border border-white/5 rounded-xl shadow-inner">
                                      <div className="flex items-center gap-2">
                                          <Ruler size={14} className="text-neutral-600" />
                                          <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Total Length</span>
                                      </div>
                                      <span className="text-[11px] text-white font-mono">{formatLength(selectedShapes.reduce((sum, s) => sum + (calculateShapeLength(s) || 0), 0), settings)}</span>
                                  </div>
                                  
                                  {selectedShapes.some(s => s.type === 'rect' || (s as any).closed) && (
                                      <div className="flex items-center justify-between px-4 py-3 bg-[#00bcd4]/5 border border-[#00bcd4]/10 rounded-xl shadow-inner">
                                          <div className="flex items-center gap-2">
                                              <Maximize2 size={14} className="text-[#00bcd4]" />
                                              <span className="text-[9px] text-[#00bcd4] font-black uppercase tracking-widest">Cumulative Area</span>
                                          </div>
                                          <span className="text-[11px] text-[#00bcd4] font-mono">
                                              {formatLength(selectedShapes.reduce((sum, s) => {
                                                  if (s.type === 'rect') return sum + (s.width * s.height);
                                                  if (s.type === 'circle') return sum + (Math.PI * s.radius * s.radius);
                                                  if ((s as any).closed && (s as any).points) return sum + calculateArea((s as any).points);
                                                  return sum;
                                              }, 0), settings)}²
                                          </span>
                                      </div>
                                  )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 space-y-4">
                             <div className="flex items-center gap-2 pl-2">
                                <FileEdit size={12} className="text-neutral-500" />
                                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Bulk Actions</span>
                             </div>
                             <div className="space-y-4">
                                <PropertyRow label="Set All Layers">
                                    <select 
                                        className="w-full bg-[#121214] border border-white/5 text-[10px] text-white rounded-lg px-3 py-2 outline-none uppercase font-black cursor-pointer appearance-none hover:border-[#00bcd4]/30 transition-all shadow-inner" 
                                        value="" 
                                        onChange={(e) => selectedShapes.forEach(s => onUpdateShape(s.id, { layer: e.target.value }))}
                                    >
                                        <option value="" disabled>Select Layer...</option>
                                        {Object.values(layers).map((l: LayerConfig) => <option key={`bulk-layer-opt-${l.id}`} value={l.id}>{l.name}</option>)}
                                    </select>
                                </PropertyRow>
                                <PropertyRow label="Set All Colors">
                                    <div className="flex items-center gap-3">
                                      <div 
                                        title="Override All Colors"
                                        className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-transform shrink-0"
                                        style={{ backgroundColor: selectedShapes.every(s => s.color === selectedShapes[0].color) ? (selectedShapes[0].color === 'BYLAYER' || selectedShapes[0].color === 'BYBLOCK' ? '#444' : (selectedShapes[0].color || '#ffffff')) : '#222' }}
                                        onClick={() => {
                                            onOpenColorSelector?.(selectedShapes[0]?.color || '#FFFFFF', (color) => {
                                                selectedShapes.forEach(s => onUpdateShape(s.id, { color }));
                                            }, "Bulk Color Override");
                                        }}
                                      >
                                          {selectedShapes.every(s => s.color === selectedShapes[0].color) && (selectedShapes[0].color === 'BYLAYER' || selectedShapes[0].color === 'BYBLOCK') && (
                                              <div className="absolute inset-0 flex items-center justify-center text-[6px] font-black uppercase text-white/40">
                                                  {selectedShapes[0].color === 'BYLAYER' ? 'LAYER' : 'BLOCK'}
                                              </div>
                                          )}
                                      </div>
                                      <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Global Color Override</span>
                                    </div>
                                </PropertyRow>
                             </div>
                        </div>
                    </div>
                  </div>
                )}
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
