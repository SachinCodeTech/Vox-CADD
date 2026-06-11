import React, { useState, useEffect, useRef } from 'react';
import { Ruler, ShieldAlert, AlignCenter, RotateCcw, CheckCircle2, ChevronRight, Wand2, X, Eye, Lock, Unlock, Layers } from 'lucide-react';
import { Shape } from '../types';

interface WallAlignmentPanelProps {
  layers: Record<string, Shape[]>;
  onClose: () => void;
  onUpdateWallShapes: (shapes: Shape[]) => void;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  selectedIds: string[];
  onUpdateAllLayers: (layers: Record<string, Shape[]>) => void;
}

interface WallLineIssue {
  id: string;
  shape: any;
  angle: number;
  type: 'crooked' | 'skewed_intersection';
  description: string;
  severity: 'high' | 'medium' | 'low';
  intersectingId?: string;
  angleDiff?: number;
}

// Distance helper: Point to line segment
function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
  if (l2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export default function WallAlignmentPanel({ 
  layers, 
  onClose, 
  onUpdateWallShapes,
  settings,
  setSettings,
  selectedIds,
  onUpdateAllLayers
}: WallAlignmentPanelProps) {
  const [issues, setIssues] = useState<WallLineIssue[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

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

  // Default wall properties initialized from active settings
  const [alignment, setAlignment] = useState<'top' | 'zero' | 'bottom'>(settings?.doubleLineJustification || 'zero');
  const [thicknessInput, setThicknessInput] = useState<string>((settings?.doubleLineThickness !== undefined ? settings.doubleLineThickness : 230).toString());
  const [isLocked, setIsLocked] = useState<boolean>(true);

  const wallShapes = layers['A-WALL'] || [];
  const wallLines = wallShapes.filter((s: any) => s && s.type === 'line');

  // Filter selected shapes that can be batch aligned (lines & double-lines)
  const selectedWallShapes = Object.values(layers).flat().filter(
    s => s && selectedIds.includes(s.id) && (s.type === 'line' || s.type === 'dline')
  );

  // Sync settings when alignment toggles
  const handleAlignmentChange = (newAlign: 'top' | 'zero' | 'bottom') => {
    setAlignment(newAlign);
    setSettings((prev: any) => ({
      ...prev,
      doubleLineJustification: newAlign
    }));
  };

  // Sync thickness on input change
  const handleThicknessChange = (val: string) => {
    setThicknessInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setSettings((prev: any) => ({
        ...prev,
        doubleLineThickness: parsed
      }));
    }
  };

  // Perform alignment correction on selected lines or double-lines
  const handleBatchAlignSelection = () => {
    if (selectedWallShapes.length === 0) return;

    const updatedLayers: Record<string, Shape[]> = {};
    let count = 0;

    Object.keys(layers).forEach(layerName => {
      updatedLayers[layerName] = layers[layerName].map(shape => {
        if (selectedIds.includes(shape.id) && (shape.type === 'line' || shape.type === 'dline')) {
          count++;
          return {
            ...shape,
            justification: alignment
          } as any;
        }
        return shape;
      });
    });

    if (count > 0 && onUpdateAllLayers) {
      onUpdateAllLayers(updatedLayers);
    }
  };

  // Existing Diagnostics logic
  const runScan = () => {
    const list: WallLineIssue[] = [];
    
    // We analyze wall line shapes
    for (let i = 0; i < wallLines.length; i++) {
      const w1: any = wallLines[i];
      if (typeof w1.x1 !== 'number' || typeof w1.y1 !== 'number' || typeof w1.x2 !== 'number' || typeof w1.y2 !== 'number') {
        continue;
      }
      
      const dx1 = w1.x2 - w1.x1;
      const dy1 = w1.y2 - w1.y1;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      if (len1 < 5.0) continue; // Skip extremely short dummy lines

      let rad1 = Math.atan2(dy1, dx1);
      let deg1 = (rad1 * 180) / Math.PI;
      if (deg1 < 0) deg1 += 180;
      if (deg1 >= 180) deg1 -= 180;

      // 1. Check if the line itself is crooked (off-orthogonal to 0, 45, 90, 135 deg)
      const targetInt = Math.round(deg1 / 45) * 45;
      const angleDev = Math.abs(deg1 - targetInt);
      
      if (angleDev > 0.05 && angleDev < 10.0) {
        list.push({
          id: w1.id,
          shape: w1,
          angle: deg1,
          type: 'crooked',
          description: `Wall line is crooked by ${angleDev.toFixed(1)}° (current angle: ${deg1.toFixed(1)}°, nearest: ${targetInt}°).`,
          severity: angleDev > 3 ? 'high' : 'medium'
        });
        continue; // Only flag once per line
      }

      // 2. Check for intersecting walls that are NOT exactly perpendicular (or parallel)
      for (let j = i + 1; j < wallLines.length; j++) {
        const w2: any = wallLines[j];
        if (typeof w2.x1 !== 'number' || typeof w2.y1 !== 'number' || typeof w2.x2 !== 'number' || typeof w2.y2 !== 'number') {
          continue;
        }

        // Check if w1 and w2 touch/near-intersect
        const d1a = distancePointToSegment(w1.x1, w1.y1, w2.x1, w2.y1, w2.x2, w2.y2);
        const d1b = distancePointToSegment(w1.x2, w1.y2, w2.x1, w2.y1, w2.x2, w2.y2);
        const d2a = distancePointToSegment(w2.x1, w2.y1, w1.x1, w1.y1, w1.x2, w1.y2);
        const d2b = distancePointToSegment(w2.x2, w2.y2, w1.x1, w1.y1, w1.x2, w1.y2);
        const minDistance = Math.min(d1a, d1b, d2a, d2b);

        if (minDistance < 25.0) { // Touching or within 25 units
          const dx2 = w2.x2 - w2.x1;
          const dy2 = w2.y2 - w2.y1;
          let rad2 = Math.atan2(dy2, dx2);
          let deg2 = (rad2 * 180) / Math.PI;
          if (deg2 < 0) deg2 += 180;
          if (deg2 >= 180) deg2 -= 180;

          let diff = Math.abs(deg1 - deg2) % 180;
          if (diff > 90) diff = 180 - diff;

          const perpDev = Math.abs(diff - 90);
          if (perpDev > 0.05 && perpDev < 10.0) {
            list.push({
              id: w1.id,
              shape: w1,
              angle: deg1,
              type: 'skewed_intersection',
              description: `Meets Wall #${w2.id.slice(-4)} at a crooked ${diff.toFixed(1)}° angle instead of a perfect 90° corner.`,
              severity: perpDev > 3 ? 'high' : 'medium',
              intersectingId: w2.id,
              angleDiff: diff
            });
          }
        }
      }
    }

    setIssues(list);
    setHasScanned(true);
  };

  // Perform alignment correction of all shapes on A-WALL layer
  const executeAlignment = () => {
    const updated = wallShapes.map((s: any) => {
      if (s.type !== 'line') return s;
      
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 5.0) return s;

      let angleRad = Math.atan2(dy, dx);
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 180;
      if (angleDeg >= 180) angleDeg -= 180;

      // Find nearest 45 degree target
      const targetDeg = Math.round(angleDeg / 45) * 45;
      const deviation = Math.abs(angleDeg - targetDeg);

      // Snap if within 10 degree threshold
      if (deviation > 0.02 && deviation < 10.0) {
        const mx = (s.x1 + s.x2) / 2;
        const my = (s.y1 + s.y2) / 2;
        const targetRad = (targetDeg * Math.PI) / 180;

        const newX1 = mx - (length / 2) * Math.cos(targetRad);
        const newY1 = my - (length / 2) * Math.sin(targetRad);
        const newX2 = mx + (length / 2) * Math.cos(targetRad);
        const newY2 = my + (length / 2) * Math.sin(targetRad);

        return {
          ...s,
          x1: Math.round(newX1 * 100) / 100,
          y1: Math.round(newY1 * 100) / 100,
          x2: Math.round(newX2 * 100) / 100,
          y2: Math.round(newY2 * 100) / 100
        };
      }
      return s;
    });

    onUpdateWallShapes(updated);
    setIssues([]);
    setHasScanned(false);
  };

  // Perform alignment correction for a single shape on A-WALL layer
  const executeSingleAlignment = (targetId: string) => {
    const updated = wallShapes.map((s: any) => {
      if (s.id !== targetId || s.type !== 'line') return s;

      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 5.0) return s;

      let angleRad = Math.atan2(dy, dx);
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 180;
      if (angleDeg >= 180) angleDeg -= 180;

      const targetDeg = Math.round(angleDeg / 45) * 45;

      const mx = (s.x1 + s.x2) / 2;
      const my = (s.y1 + s.y2) / 2;
      const targetRad = (targetDeg * Math.PI) / 180;

      const newX1 = mx - (length / 2) * Math.cos(targetRad);
      const newY1 = my - (length / 2) * Math.sin(targetRad);
      const newX2 = mx + (length / 2) * Math.cos(targetRad);
      const newY2 = my + (length / 2) * Math.sin(targetRad);

      return {
        ...s,
        x1: Math.round(newX1 * 100) / 100,
        y1: Math.round(newY1 * 100) / 100,
        x2: Math.round(newX2 * 100) / 100,
        y2: Math.round(newY2 * 100) / 100
      };
    });

    onUpdateWallShapes(updated);
    setIssues(prev => prev.filter(iss => iss.id !== targetId));
  };

  useEffect(() => {
    runScan();
  }, [layers]);

  // Visual SVG preview markup based on alignment
  const renderPreviewSVG = () => {
    if (alignment === 'zero') {
      return (
        <svg className="w-full h-24 bg-[#09090b] rounded-xl border border-white/5" viewBox="0 0 300 100">
          <line x1="0" y1="25" x2="300" y2="25" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="75" x2="300" y2="75" stroke="#FFFFFF" strokeOpacity="0.015" />
          
          <rect x="25" y="35" width="250" height="30" fill="#06b6d4" fillOpacity="0.12" />
          <line x1="25" y1="35" x2="275" y2="35" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="65" x2="275" y2="65" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          
          <line x1="10" y1="50" x2="290" y2="50" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
          
          <text x="35" y="27" fill="#64748b" fontSize="8" className="font-sans font-bold">Wall Top Boundary</text>
          <text x="35" y="80" fill="#64748b" fontSize="8" className="font-sans font-bold">Wall Bottom Boundary</text>
          <text x="145" y="53" fill="#f43f5e" fontSize="8.5" className="font-sans font-black uppercase tracking-wider">Cursor Centerline</text>
          
          <circle cx="130" cy="50" r="5" fill="none" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="130" y1="41" x2="130" y2="59" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="121" y1="50" x2="139" y2="50" stroke="#f43f5e" strokeWidth="1.2" />
        </svg>
      );
    } else if (alignment === 'top') {
      return (
        <svg className="w-full h-24 bg-[#09090b] rounded-xl border border-white/5" viewBox="0 0 300 100">
          <line x1="0" y1="25" x2="300" y2="25" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="75" x2="300" y2="75" stroke="#FFFFFF" strokeOpacity="0.015" />
          
          <rect x="25" y="50" width="250" height="30" fill="#06b6d4" fillOpacity="0.12" />
          <line x1="25" y1="50" x2="275" y2="50" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="80" x2="275" y2="80" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          
          <line x1="10" y1="50" x2="290" y2="50" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
          
          <text x="35" y="44" fill="#06b6d4" fontSize="8" className="font-sans font-bold uppercase tracking-wider">Top Edge (Aligned)</text>
          <text x="35" y="93" fill="#64748b" fontSize="8" className="font-sans font-bold">Wall Bottom Boundary</text>
          <text x="145" y="53" fill="#f43f5e" fontSize="8.5" className="font-sans font-black uppercase tracking-wider">Cursor Headline</text>
          
          <circle cx="130" cy="50" r="5" fill="none" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="130" y1="41" x2="130" y2="59" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="121" y1="50" x2="139" y2="50" stroke="#f43f5e" strokeWidth="1.2" />
        </svg>
      );
    } else {
      return (
        <svg className="w-full h-24 bg-[#09090b] rounded-xl border border-white/5" viewBox="0 0 300 100">
          <line x1="0" y1="25" x2="300" y2="25" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="#FFFFFF" strokeOpacity="0.015" />
          <line x1="0" y1="75" x2="300" y2="75" stroke="#FFFFFF" strokeOpacity="0.015" />
          
          <rect x="25" y="20" width="250" height="30" fill="#06b6d4" fillOpacity="0.12" />
          <line x1="25" y1="20" x2="275" y2="20" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="50" x2="275" y2="50" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
          
          <line x1="10" y1="50" x2="290" y2="50" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
          
          <text x="35" y="14" fill="#64748b" fontSize="8" className="font-sans font-bold">Wall Top Boundary</text>
          <text x="35" y="62" fill="#06b6d4" fontSize="8" className="font-sans font-bold uppercase tracking-wider">Bottom Edge (Aligned)</text>
          <text x="145" y="53" fill="#f43f5e" fontSize="8.5" className="font-sans font-black uppercase tracking-wider">Cursor Baseline</text>
          
          <circle cx="130" cy="50" r="5" fill="none" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="130" y1="41" x2="130" y2="59" stroke="#f43f5e" strokeWidth="1.2" />
          <line x1="121" y1="50" x2="139" y2="50" stroke="#f43f5e" strokeWidth="1.2" />
        </svg>
      );
    }
  };

  return (
    <div 
      className="relative w-[94vw] sm:w-[410px] h-[82vh] sm:h-[85vh] sm:max-h-[660px] glass-panel rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5 bg-[#0a0a0c]"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 150 }}
    >
      {/* Header */}
      <div 
        className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-[#121214] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <AlignCenter size={15} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400 block">Wall Alignment Tool</span>
            <span className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">A-WALL Diagnostics & Alignment Control</span>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all">
          <X size={15} />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Toggle & Alignment Section */}
        <div className="space-y-2.5 p-3.5 bg-neutral-900/40 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-bold uppercase text-neutral-400 tracking-wider">Wall alignment property</h4>
            <span className="text-[7.5px] font-black text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded tracking-wide font-mono uppercase">
              Mode: {alignment === 'zero' ? 'Center' : alignment.toUpperCase()}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-1 px-0.5 py-0.5 bg-black/40 rounded-lg border border-white/5">
            <button
              onClick={() => handleAlignmentChange('top')}
              className={`py-2 text-[9px] font-black uppercase rounded-md transition-all ${
                alignment === 'top' 
                ? 'bg-neutral-800 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Top Side
            </button>
            <button
              onClick={() => handleAlignmentChange('zero')}
              className={`py-2 text-[9px] font-black uppercase rounded-md transition-all ${
                alignment === 'zero' 
                ? 'bg-neutral-800 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Center (Zero)
            </button>
            <button
              onClick={() => handleAlignmentChange('bottom')}
              className={`py-2 text-[9px] font-black uppercase rounded-md transition-all ${
                alignment === 'bottom' 
                ? 'bg-neutral-800 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Bottom Side
            </button>
          </div>

          {/* Mini preview */}
          <div className="space-y-1 mt-2.5">
            <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block">Cursor Alignment Preview</span>
            {renderPreviewSVG()}
          </div>
        </div>

        {/* Thickness Input field with explicit lock */}
        <div className="p-3.5 bg-neutral-900/40 rounded-xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
              <Ruler size={11} className="text-cyan-400" />
              Double Line Drafting Thickness
            </span>
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider transition-all duration-200 ${
                isLocked 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}
            >
              {isLocked ? <Lock size={9} /> : <Unlock size={9} />}
              {isLocked ? "LOCK ACTIVE" : "EDITABLE"}
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              disabled={isLocked}
              value={thicknessInput}
              onChange={(e) => handleThicknessChange(e.target.value)}
              placeholder="e.g. 230"
              className={`w-full bg-[#0a0a0c] border rounded-lg px-3 py-2 text-xs font-mono transition-all outline-none ${
                isLocked 
                  ? 'border-white/5 text-neutral-500 cursor-not-allowed bg-neutral-950/40' 
                  : 'border-cyan-500/20 text-neutral-200 focus:border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-neutral-600 font-mono font-black uppercase">
              mm (Units)
            </span>
          </div>
          <p className="text-[8px] text-neutral-500 font-medium leading-normal mt-1">
            Setting the thickness defines the default offset width for future <span className="font-bold text-cyan-400">DLINE</span> (Double Line) drafting actions. Toggle lock off to edit.
          </p>
        </div>

        {/* Batch Align Selection */}
        <div className="p-3.5 bg-neutral-900/40 rounded-xl border border-white/5 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
              <Layers size={11} className="text-pink-500" />
              Selection alignment processor
            </span>
            <span className="text-[8px] font-mono font-black text-neutral-500">
              {selectedWallShapes.length} Shapes Selected
            </span>
          </div>
          
          <button
            disabled={selectedWallShapes.length === 0}
            onClick={handleBatchAlignSelection}
            className={`w-full py-2.5 text-[9px] font-black uppercase rounded-lg border flex items-center justify-center gap-2 transition-all ${
              selectedWallShapes.length > 0
                ? 'bg-pink-600 hover:bg-pink-500 text-white border-pink-500/20 shadow-lg shadow-pink-900/10 cursor-pointer active:scale-95'
                : 'bg-neutral-900/40 text-neutral-600 border-white/5 cursor-not-allowed'
            }`}
          >
            <Wand2 size={12} />
            Batch Align Selection
          </button>
          
          {selectedWallShapes.length === 0 ? (
            <p className="text-[8px] text-neutral-600 text-center font-medium leading-normal italic">
              * Hint: Select wall lines/double-lines in the drawing to batch align them.
            </p>
          ) : (
            <p className="text-[8px] text-pink-400/80 text-center font-medium leading-normal">
              Click to force {selectedWallShapes.length} selected lines or double-lines to follow the {alignment === 'zero' ? 'Center' : alignment.toUpperCase()} setting.
            </p>
          )}
        </div>

        {/* Action Button Strip */}
        <div className="flex gap-2">
          <button
            onClick={runScan}
            className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 text-[9px] font-black uppercase rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <RotateCcw size={12} />
            Re-Scan Diagnostics
          </button>
          
          {issues.length > 0 && (
            <button
              onClick={executeAlignment}
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-black uppercase rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/10 transition-all active:scale-95"
            >
              <Wand2 size={12} />
              Snap-to-Align All
            </button>
          )}
        </div>

        {/* Scan Results */}
        {hasScanned && (
          <div className="space-y-2.5">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Diagnostic Results ({issues.length} Issues)</h3>
            
            {issues.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center justify-center text-center space-y-1.5">
                <CheckCircle2 className="text-emerald-500" size={24} />
                <div>
                  <h4 className="text-[11px] font-bold text-neutral-200 uppercase tracking-widest">A-WALL is Perfectly Orthogonal!</h4>
                  <p className="text-[9px] text-neutral-500 uppercase mt-0.5 font-bold">All wall segments and corners hit perfect angles of 0°, 45°, or 90°.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {issues.map((iss, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#111113] hover:bg-[#141416] rounded-lg border border-white/5 flex flex-col gap-1 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono font-black text-cyan-500/80">ID: ...{iss.id.slice(-6)}</span>
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        iss.severity === 'high' ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'
                       }`}>
                        {iss.severity} ISSUE
                      </span>
                    </div>
                    <p className="text-[9px] text-neutral-300 font-medium leading-normal">{iss.description}</p>
                    <div className="flex gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          executeSingleAlignment(iss.id);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black rounded text-[8px] font-black uppercase tracking-wider border border-cyan-500/15 transition-all cursor-pointer"
                      >
                        <Wand2 size={9} />
                        Quick Fix
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info banner */}
      <div className="p-3 border-t border-white/5 bg-[#121214] flex items-center justify-between shrink-0">
        <span className="text-[8px] font-mono text-neutral-600 font-bold uppercase tracking-widest">
          Wall Segments: {wallLines.length} Total
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[9px] font-black uppercase rounded transition-all"
        >
          Close Panel
        </button>
      </div>
    </div>
  );
}
