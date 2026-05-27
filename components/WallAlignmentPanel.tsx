import React, { useState, useEffect } from 'react';
import { Ruler, ShieldAlert, AlignCenter, RotateCcw, CheckCircle2, ChevronRight, Wand2, X, Eye } from 'lucide-react';
import { Shape } from '../types';

interface WallAlignmentPanelProps {
  layers: Record<string, Shape[]>;
  onClose: () => void;
  onUpdateWallShapes: (shapes: Shape[]) => void;
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

export default function WallAlignmentPanel({ layers, onClose, onUpdateWallShapes }: WallAlignmentPanelProps) {
  const [issues, setIssues] = useState<WallLineIssue[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasScanned, setHasScanned] = useState(false);

  const wallShapes = layers['A-WALL'] || [];
  const wallLines = wallShapes.filter((s: any) => s && s.type === 'line');

  // Perform detection of alignment anomalies
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
      // Standard CAD design uses increments of 45 degrees
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

          // Perpendicular ideal = 90 deg. Near-perpendicular is between 80° and 100°
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
        // Rotate around midpoint
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

  useEffect(() => {
    runScan();
  }, [layers]);

  return (
    <div className="relative w-full sm:w-[380px] h-full sm:h-[80vh] sm:max-h-[550px] glass-panel sm:rounded-[1.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5 bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-[#121214] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <AlignCenter size={15} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400 block">Wall Alignment Tool</span>
            <span className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">A-WALL Layer Diagnostics</span>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all">
          <X size={15} />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description card */}
        <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-white/5 space-y-1.5">
          <h4 className="text-[9px] font-bold uppercase text-neutral-400 tracking-wider">Orthogonal Alignment Audit</h4>
          <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">
            This module inspects parallel wall segments and intersections on the <span className="text-cyan-400 font-bold">A-WALL</span> layer. It identifies segments that are crooked or skewed relative to their intersecting walls and allows correcting them instantly.
          </p>
        </div>

        {/* Action Button Strip */}
        <div className="flex gap-2">
          <button
            onClick={runScan}
            className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 text-[9px] font-black uppercase rounded-lg border border-white/5 flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw size={12} />
            Re-Scan Layer
          </button>
          
          {issues.length > 0 && (
            <button
              onClick={executeAlignment}
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-black uppercase rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/10 transition-all"
            >
              <Wand2 size={12} />
              Snap-to-Align All
            </button>
          )}
        </div>

        {/* Scan Results */}
        {hasScanned && (
          <div className="space-y-2.5">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Scan Results ({issues.length} Issues)</h3>
            
            {issues.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center justify-center text-center space-y-1.5">
                <CheckCircle2 className="text-emerald-500" size={24} />
                <div>
                  <h4 className="text-[11px] font-bold text-neutral-200 uppercase tracking-widest">A-WALL is Perfectly Orthogonal!</h4>
                  <p className="text-[9px] text-neutral-500 uppercase mt-0.5 font-bold">All wall segments and corners hit perfect angles of 0°, 45°, or 90°.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
          Cancel
        </button>
      </div>
    </div>
  );
}
