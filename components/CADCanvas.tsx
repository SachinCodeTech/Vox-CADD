
import React, { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Shape, ViewState, AppSettings, SnapPoint, LayerConfig, Point, MTextShape, BlockDefinition, LayoutDefinition, LineTypeDefinition } from '../types';
import { hitTestShape, findBestSnap, formatLength, getShapesInRect, getShapeBounds, isRectIntersecting, formatDualLength, isShapeClosed, isPointInsideShape, getPolylineOffsetPoints, calculateShapeLength } from '../services/cadService';

interface CADCanvasProps {
  layers: Record<string, Shape[]>;
  blocks: Record<string, BlockDefinition>;
  lineTypes: Record<string, LineTypeDefinition>;
  layouts: LayoutDefinition[];
  layerConfig: Record<string, LayerConfig>; 
  view: ViewState;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  settings: AppSettings;
  isCommandActive: boolean;
  activeTab: string;
  isViewportActive?: boolean;
  activeViewportId?: string | null;
  onViewportToggle?: (x?: number, y?: number) => void;
  onClick?: (x: number, y: number, snapped: boolean) => void; 
  onMouseMove?: (x: number, y: number, snapped: boolean) => void;
  selectedIds?: string[];
  highlightIds?: string[];
  onSelectionChange?: (ids: string[], additive: boolean) => void;
  previewShapes?: Shape[] | null; 
  activePrompt?: string;
  basePoint?: Point | null;
  activeCommandName?: string;
  isAiThinking?: boolean;
  lastAiCommandTime?: number;
  onAction?: (action: string, payload?: any) => void;
  onCommand?: (cmd: string) => void;
  setLogMessage?: (msg: string | null) => void;
}

export interface CADCanvasHandle {
  captureImage: () => string;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(({ 
    layers, blocks, lineTypes, layouts, layerConfig, view, setView, settings, isCommandActive, activeTab, 
    isViewportActive = false, activeViewportId, onViewportToggle,
    onMouseMove, onClick, selectedIds = [], highlightIds = [], onSelectionChange, previewShapes,
    activePrompt, basePoint = null, activeCommandName, isAiThinking, lastAiCommandTime, onAction, onCommand,
    setLogMessage
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useImperativeHandle(ref, () => ({
    captureImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
    },
    getCanvasSize: () => {
      const canvas = canvasRef.current;
      if (!canvas) return { width: 800, height: 600 };
      const r = getPixelRatio();
      return { width: canvas.width / r, height: canvas.height / r };
    }
  }));

  const [isPanning, setIsPanning] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ start: Point, end: Point, crossing: boolean } | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const pointerStartPos = useRef<Point>({ x: 0, y: 0 });
  const lastPos = useRef<Point>({ x: 0, y: 0 });
  const worldCursorRef = useRef<Point>({ x: 0, y: 0 });
  const activeSnapRef = useRef<SnapPoint | null>(null);
  const activePointers = useRef<Map<number, Point>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialPanMid = useRef<Point | null>(null);
  const initialViewOnPinch = useRef<ViewState | null>(null);
  const worldPointOnPinch = useRef<Point | null>(null);
  const lastClickTime = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchStartCount = useRef<number>(0);

  const getPixelRatio = () => window.devicePixelRatio || 1;
  
  const allRenderableShapes = useMemo(() => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        if (!conf) return true;
        return conf.visible && !conf.frozen;
    });
  }, [layers, layerConfig]);

  const allSelectableShapes = useMemo(() => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        if (!conf) return true;
        return conf.visible && !conf.frozen && !conf.locked;
    });
  }, [layers, layerConfig]);

  const getAllShapesForRendering = useCallback(() => allRenderableShapes, [allRenderableShapes]);
  const getAllShapesForSelection = useCallback(() => allSelectableShapes, [allSelectableShapes]);

  const calculateScreenToWorld = (sx: number, sy: number, v: ViewState, w: number, h: number): Point => {
    const ts = v.scale * settings.drawingScale;
    return { x: (sx - w/2 - v.originX)/ts, y: -(sy - h/2 - v.originY)/ts };
  };

  const screenToWorld = (sx: number, sy: number): Point => {
    const canvas = canvasRef.current; if (!canvas || !view) return { x: 0, y: 0 };
    const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
    const isModel = activeTab === 'model';
    
    if (isModel) {
        return calculateScreenToWorld(sx, sy, view, w, h);
    } else {
        const pPoint = calculateScreenToWorld(sx, sy, view, w, h);
        if (isViewportActive && activeViewportId) {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp && layout) {
                const paperW = layout.paperSize.width;
                const paperH = layout.paperSize.height;
                
                const papX = pPoint.x + paperW/2;
                const papY = paperH/2 - pPoint.y;
                
                const relX = papX - vp.x;
                const relY = papY - vp.y;
                
                const vts = vp.viewState.scale;
                return {
                    x: (relX - vp.width/2 - vp.viewState.originX) / vts,
                    y: (vp.height/2 + vp.viewState.originY - relY) / vts
                };
            }
        }
        return pPoint;
    }
  };

  const worldToScreen = (wx: number, wy: number): Point => {
      const canvas = canvasRef.current; if (!canvas || !view) return { x: 0, y: 0 };
      const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r, ts = view.scale * settings.drawingScale;
      const isModel = activeTab === 'model';

      if (isModel) {
        return { x: wx * ts + w/2 + view.originX, y: -wy * ts + h/2 + view.originY };
      } else {
        if (isViewportActive && activeViewportId) {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp && layout) {
                const vts = vp.viewState.scale;
                
                const papX_rel = (wx * vts + vp.viewState.originX) + vp.width/2;
                const papY_rel = (-wy * vts + vp.viewState.originY) + vp.height/2;

                const papX = papX_rel + vp.x;
                const papY = papY_rel + vp.y;
                
                const paperW = layout.paperSize.width;
                const paperH = layout.paperSize.height;
                const pPoint = { x: papX - paperW/2, y: paperH/2 - papY };

                return { x: pPoint.x * ts + w/2 + view.originX, y: -pPoint.y * ts + h/2 + view.originY };
            }
        }
        return { x: wx * ts + w/2 + view.originX, y: -wy * ts + h/2 + view.originY };
      }
  };

  const drawUCS = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const margin = 50;
    const size = 35;
    const originX = margin;
    const originY = h - margin;

    ctx.save();
    ctx.setTransform(getPixelRatio(), 0, 0, getPixelRatio(), 0, 0);
    
    ctx.beginPath();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    
    // X Axis
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + size, originY);
    // Y Axis
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, originY - size);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Inter';
    ctx.fillText('X', originX + size + 5, originY + 3);
    ctx.fillText('Y', originX - 3, originY - size - 5);
    
    ctx.restore();
  };

  const updateCursorAndSnaps = (x: number, y: number) => {
    const wp = screenToWorld(x, y);
    worldCursorRef.current = wp;
    const ts = view.scale * settings.drawingScale;
    if (settings.snap && (activeTab === 'model' || isViewportActive)) {
      const allRenderable = getAllShapesForRendering().filter(s => {
        const conf = layerConfig[s.layer];
        return conf ? conf.visible : true;
      });
      const s = findBestSnap(wp, allRenderable, settings.snapOptions, ts, basePoint);
      if (s && !activeSnapRef.current && navigator.vibrate) {
          navigator.vibrate(5); // Tiny buzz on new snap
      }
      activeSnapRef.current = s;
    } else {
      activeSnapRef.current = null;
    }
    if (onMouseMove) {
      const targetP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : wp;
      onMouseMove(targetP.x, targetP.y, !!activeSnapRef.current);
    }
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
    if (!ctx || !view) return;
    const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r, ts = view.scale * settings.drawingScale;
    ctx.setTransform(r, 0, 0, r, 0, 0); 
    const isModel = activeTab === 'model';
    ctx.fillStyle = isModel ? "#0a0a0c" : "#333"; ctx.fillRect(0, 0, w, h);

    if (!isModel) {
      const activeLayout = layouts.find(l => l.id === activeTab);
      if (activeLayout) {
          // Render Background around paper (Darker contrast)
          ctx.fillStyle = "#0c0c0e"; ctx.fillRect(0, 0, w, h);
          
          // Render Paper
          const paperW = activeLayout.paperSize.width; 
          const paperH = activeLayout.paperSize.height;
          const px = w/2 - (paperW * ts)/2 + view.originX;
          const py = h/2 - (paperH * ts)/2 + view.originY;
          const pw = paperW * ts;
          const ph = paperH * ts;

          // Shadow for paper
          ctx.save();
          ctx.shadowBlur = 40; ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px, py, pw, ph);
          ctx.restore();

          // Border for paper
          ctx.strokeStyle = "rgba(255,255,255,0.05)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, pw, ph);

          // Paper Grid (Subtle)
          if (settings.grid) {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
            ctx.lineWidth = 0.5;
            const g = settings.gridSpacing * ts;
            if (g > 5) {
              ctx.beginPath();
              for (let gx = px; gx <= px + pw; gx += g) { ctx.moveTo(gx, py); ctx.lineTo(gx, py + ph); }
              for (let gy = py; gy <= py + ph; gy += g) { ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); }
              ctx.stroke();
            }
          }

          // Render Viewports
          activeLayout.viewports.forEach(vp => {
              ctx.save();
              const vX = px + vp.x * ts;
              const vY = py + vp.y * ts;
              const vW = vp.width * ts;
              const vH = vp.height * ts;
              
              const isActive = isViewportActive && vp.id === activeViewportId;
              
              ctx.translate(vX, vY);
              ctx.strokeStyle = isActive ? "#00bcd4" : "#adadad"; 
              ctx.lineWidth = isActive ? 2 : 1;
              ctx.strokeRect(0, 0, vW, vH);
              
              const region = new Path2D();
              region.rect(0, 0, vW, vH);
              ctx.clip(region);
              
              // Render model space inside viewport
              const vts = vp.viewState.scale * ts;
              // originX and originY are stored in paper units (mm)
              ctx.translate(vW/2 + vp.viewState.originX * ts, vH/2 + vp.viewState.originY * ts);
              ctx.scale(vts, -vts);
              
              const vShapes = getAllShapesForRendering();
              vShapes.forEach(s => drawShape(ctx, s, vts));
              
              if (isActive && isCommandActive && previewShapes) {
                  previewShapes.forEach(s => drawShape(ctx, s, vts));
              }
              
              ctx.restore();
          });
      }
      
      if (!isViewportActive) {
          // return? Let's check how we handle clicks in layout
      }
    }

    if (isModel) {
      ctx.save(); ctx.translate(w/2 + view.originX, h/2 + view.originY); ctx.scale(ts, -ts);
    
      if (settings.grid) {
        const sMin = calculateScreenToWorld(0, 0, view, w, h);
        const sMax = calculateScreenToWorld(w*r, h*r, view, w, h);
        
        let g = settings.gridSpacing;
        const majorEvery = 5;
        
        // Dynamic coarsening for "graph paper" feel and performance
        const ts_adj = ts;
        while (g * ts_adj < 5) g *= 5;
        
        // Minor Grid Lines
        ctx.lineWidth = 0.5 / ts;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        for(let x=Math.floor(sMin.x/g)*g; x<=sMax.x; x+=g){ 
            if (Math.abs(x % (g * majorEvery)) > 0.001 && Math.abs(x) > 0.001) {
                ctx.moveTo(x, sMin.y); ctx.lineTo(x, sMax.y); 
            }
        }
        for(let y=Math.floor(sMax.y/g)*g; y<=sMin.y; y+=g){ 
            if (Math.abs(y % (g * majorEvery)) > 0.001 && Math.abs(y) > 0.001) {
                ctx.moveTo(sMin.x, y); ctx.lineTo(sMax.x, y); 
            }
        }
        ctx.stroke();

        // Major Grid Lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        for(let x=Math.floor(sMin.x/(g * majorEvery))*(g * majorEvery); x<=sMax.x; x+=(g * majorEvery)){
            if (Math.abs(x) > 0.001) {
                ctx.moveTo(x, sMin.y); ctx.lineTo(x, sMax.y);
            }
        }
        for(let y=Math.floor(sMax.y/(g * majorEvery))*(g * majorEvery); y<=sMin.y; y+=(g * majorEvery)){
            if (Math.abs(y) > 0.001) {
                ctx.moveTo(sMin.x, y); ctx.lineTo(sMax.x, y);
            }
        }
        ctx.stroke();

        // Main Axes (Origin Lines)
        ctx.strokeStyle = "rgba(0, 188, 212, 0.3)"; // Subtle Cyan for Origin
        ctx.beginPath();
        if (0 >= sMin.x && 0 <= sMax.x) { ctx.moveTo(0, sMin.y); ctx.lineTo(0, sMax.y); }
        if (0 >= sMax.y && 0 <= sMin.y) { ctx.moveTo(sMin.x, 0); ctx.lineTo(sMax.x, 0); }
        ctx.stroke();
      }
    
      const renderable = getAllShapesForRendering();
      
      // Performance Optimization: Viewport Culling
      const sMin = calculateScreenToWorld(0, 0, view, w, h);
      const sMax = calculateScreenToWorld(w*r, h*r, view, w, h);
      const viewportBounds = { 
          xMin: Math.min(sMin.x, sMax.x), 
          yMin: Math.min(sMin.y, sMax.y), 
          xMax: Math.max(sMin.x, sMax.x), 
          yMax: Math.max(sMin.y, sMax.y) 
      };
      
      const visibleShapes = renderable.filter(s => {
          const bounds = getShapeBounds(s, blocks);
          return isRectIntersecting(viewportBounds, bounds);
      });

      // LOD: If we have many shapes, skip tiny details
      const useLOD = visibleShapes.length > 5000;

      visibleShapes.forEach(s => {
          if (useLOD) {
              const bounds = getShapeBounds(s, blocks);
              const pixelSize = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) * ts;
              if (pixelSize < 1) return; // Skip too small to see
          }
          drawShape(ctx, s, ts);
      });
      if (activeSnapRef.current) drawSnapMarker(ctx, activeSnapRef.current, ts);
      if (isCommandActive && previewShapes) previewShapes.forEach(s => drawShape(ctx, s, ts));
      
      visibleShapes.filter(s => selectedIds.includes(s.id)).forEach(s => drawGrips(ctx, s, ts));
      ctx.restore();
    }

    if (isModel) {
      drawUCS(ctx, w, h);
    }

    // AI Thinking Overlay
    if (isAiThinking) {
      ctx.save();
      ctx.setTransform(r, 0, 0, r, 0, 0);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, w, h);
      
      // Pulsing "Thinking" text
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      ctx.font = '900 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 188, 212, ${0.4 + pulse * 0.6})`;
      ctx.fillText('ARCHITECT IS DRAFTING...', w / 2, h / 2);
      
      // Scanning line effect
      const scanY = (Date.now() / 10) % h;
      ctx.strokeStyle = 'rgba(0, 188, 212, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();
      ctx.restore();
    }

    // Success Pulse Effect
    if (lastAiCommandTime && Date.now() - lastAiCommandTime < 1000) {
      const age = Date.now() - lastAiCommandTime;
      const opacity = 1 - (age / 1000);
      ctx.save();
      ctx.setTransform(r, 0, 0, r, 0, 0);
      ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }

    if (selectionRect) {
      ctx.save();
      const s1 = selectionRect.start, s2 = selectionRect.end;
      const isCrossing = selectionRect.crossing; 
      if (isCrossing) {
        ctx.fillStyle = 'rgba(0, 255, 127, 0.15)'; ctx.strokeStyle = 'rgba(0, 255, 127, 0.8)'; ctx.setLineDash([5, 3]);
      } else {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'; ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; ctx.setLineDash([]);
      }
      ctx.lineWidth = 1.0;
      ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.restore();
    }

    const targetWorldP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : worldCursorRef.current;
    const screenPos = worldToScreen(targetWorldP.x, targetWorldP.y);
    
    ctx.save(); ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.strokeStyle = isModel ? `rgba(255, 255, 255, 0.4)` : `rgba(0,0,0,0.4)`; 
    ctx.lineWidth = 0.5; ctx.beginPath();
    ctx.moveTo(screenPos.x, 0); ctx.lineTo(screenPos.x, h);
    ctx.moveTo(0, screenPos.y); ctx.lineTo(w, screenPos.y);
    ctx.stroke();
    ctx.lineWidth = 1.0;
    ctx.strokeRect(screenPos.x - 5, screenPos.y - 5, 10, 10);
    
    if (settings.showHUD) {
        const text = `${formatLength(targetWorldP.x, settings)}, ${formatLength(targetWorldP.y, settings)}`;
        
        ctx.font = '700 10px "JetBrains Mono", "Fira Code", monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
        ctx.beginPath(); ctx.roundRect(screenPos.x + 15, screenPos.y - 28, tw + 20, 22, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(0, 188, 212, 0.4)'; ctx.stroke();
        ctx.fillStyle = '#00bcd4'; ctx.fillText(text, screenPos.x + 25, screenPos.y - 13);
    }
    ctx.restore();
  }, [view, layers, previewShapes, selectedIds, highlightIds, settings, layerConfig, activeTab, isViewportActive, isCommandActive, selectionRect]);

  const drawGrips = (ctx: CanvasRenderingContext2D, s: Shape, ts: number) => {
    const size = 7 / ts;
    ctx.fillStyle = "#3b82f6";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.5 / ts;
    const drawBox = (px: number, py: number) => { 
        ctx.beginPath();
        ctx.rect(px - size/2, py - size/2, size, size);
        ctx.fill();
        ctx.stroke();
    };

    ctx.save();
    switch (s.type) {
        case 'line': drawBox(s.x1, s.y1); drawBox(s.x2, s.y2); drawBox((s.x1+s.x2)/2, (s.y1+s.y2)/2); break;
        case 'circle': drawBox(s.x, s.y); drawBox(s.x + s.radius, s.y); drawBox(s.x, s.y + s.radius); drawBox(s.x - s.radius, s.y); drawBox(s.x, s.y - s.radius); break;
        case 'rect': drawBox(s.x, s.y); drawBox(s.x+s.width, s.y); drawBox(s.x+s.width, s.y+s.height); drawBox(s.x, s.y+s.height); drawBox(s.x + s.width/2, s.y); drawBox(s.x + s.width, s.y + s.height/2); break;
        case 'pline': case 'polygon': case 'spline': s.points.forEach(p => drawBox(p.x, p.y)); break;
        case 'arc': drawBox(s.x, s.y); drawBox(s.x + s.radius * Math.cos(s.startAngle), s.y + s.radius * Math.sin(s.startAngle)); drawBox(s.x + s.radius * Math.cos(s.endAngle), s.y + s.radius * Math.sin(s.endAngle)); drawBox(s.x + s.radius * Math.cos((s.startAngle+s.endAngle)/2), s.y + s.radius * Math.sin((s.startAngle+s.endAngle)/2)); break;
    }
    ctx.restore();
  };

  const resolveColor = (s: Shape, layerConf?: LayerConfig, activeTab: string = 'model', blockContext?: { color: string }): string => {
    // 1. Check entity color
    const entColor = (s.color || '').toLowerCase();
    
    // BYBLOCK logic: use block insertion color
    if (entColor === 'byblock' && blockContext?.color) {
        return blockContext.color;
    }
    
    // BYLAYER or missing logic: use layer color
    if (!entColor || entColor === 'bylayer') {
        const lColor = layerConf?.color || "#FFFFFF";
        if (activeTab !== 'model' && (lColor.toUpperCase() === '#FFF' || lColor.toUpperCase() === '#FFFFFF')) {
            return '#111111';
        }
        return lColor;
    }

    // Direct color
    if (activeTab !== 'model' && (entColor === '#fff' || entColor === '#ffffff' || entColor === 'white')) {
        return '#111111';
    }
    return s.color!;
  };

  const resolveLineWeight = (s: Shape, layerConf?: LayerConfig, blockContext?: { thickness: number }): number => {
      // Direct thickness
      if (s.thickness !== undefined && typeof s.thickness === 'number' && s.thickness >= 0) {
          return s.thickness;
      }
      
      const entThick = (s.thickness as any);

      // BYBLOCK logic
      if (entThick === 'byblock' && blockContext?.thickness !== undefined) {
          return blockContext.thickness;
      }

      // BYLAYER logic
      return layerConf?.thickness || 0.25;
  };

  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape, ts: number, blockContext?: { color: string, thickness: number }) => {
    const isS = selectedIds.includes(s.id), isH = highlightIds.includes(s.id) || highlightedIds.includes(s.id);
    const conf = layerConfig[s.layer]; 
    if (!s.isPreview && conf && (!conf.visible || conf.frozen)) return;
    
    // LOD: Skip tiny text
    if ((s.type === 'text' || s.type === 'mtext') && s.size * ts < 5) return;

    ctx.save(); ctx.beginPath();
    
    let baseColor = resolveColor(s, conf, activeTab, blockContext);
    if (s.isPreview && isCommandActive) baseColor = layerConfig[settings.currentLayer]?.color || "#FFFFFF";
    
    let weight = resolveLineWeight(s, conf, blockContext);
    // Special case for double lines: thickness in VOX/DXF is often distance between lines, but here we also have stroke weight
    if (s.type === 'dline') weight = conf?.thickness || 0.25;

    if (!settings.showLineWeights && !isS && !isH && !s.isPreview) weight = 1;

    if (s.isPreview) { 
        ctx.strokeStyle = baseColor; 
        ctx.setLineDash([6/ts, 4/ts]); 
        ctx.globalAlpha = 0.5; 
        ctx.lineWidth = 1/ts; 
        if (s.type === 'dline') ctx.lineWidth = 1.5/ts;
    }
    else if (isS) { ctx.strokeStyle = "#00bcd4"; ctx.lineWidth = 2.5/ts; ctx.setLineDash([2/ts, 2/ts]); }
    else if (isH) { ctx.strokeStyle = "#00bcd4"; ctx.lineWidth = 1.5/ts; ctx.setLineDash([4/ts, 4/ts]); }
    else { ctx.strokeStyle = baseColor; if (conf?.locked) ctx.globalAlpha = 0.45; ctx.lineWidth = weight/ts; }
    
    // Line Type implementation
    const currentLineType = (s.lineType || conf?.lineType || 'continuous').toLowerCase();
    
    if (currentLineType !== 'continuous' && !s.isPreview && !isH && !isS) {
        const ltDef = lineTypes[currentLineType];
        if (ltDef && ltDef.pattern && ltDef.pattern.length > 0) {
            // Apply scale to pattern based on drawing scale and zoom
            const scale = settings.drawingScale / ts;
            const scaledPattern = ltDef.pattern.map(p => p / ts); 
            ctx.setLineDash(scaledPattern);
        } else {
            // Fallback for legacy names if not found in lineTypes map
            let L = 32 / ts; 
            const sLen = calculateShapeLength(s);
            if (sLen > 0 && sLen < L * 10) L = sLen / 10;
    
            if (currentLineType === 'dashed') ctx.setLineDash([L * 2.0, L * 1.5]);
            else if (currentLineType === 'dotted') ctx.setLineDash([1/ts, L * 1.0]);
            else if (currentLineType === 'center') ctx.setLineDash([L * 6, L * 1.5, L * 1, L * 1.5]);
            else if (currentLineType === 'dashdot') ctx.setLineDash([L * 5, L * 1.5, L * 0.8, L * 1.5]);
            else if (currentLineType === 'border') ctx.setLineDash([L * 8, L * 1.5, L * 2.5, L * 1.5]);
            else if (currentLineType === 'divide') ctx.setLineDash([L * 4, L * 1, L * 1, L * 1, L * 1, L * 1]);
            else if (currentLineType === 'phantom') ctx.setLineDash([L * 8, L * 1.2, L * 1.2, L * 1.2, L * 1.2, L * 1.2]);
            else if (currentLineType === 'zigzag') ctx.setLineDash([L * 5, L * 1.5, L * 1.5, L * 1.5]);
            else if (currentLineType === 'hotwater') ctx.setLineDash([L * 7, L * 2, L * 1, L * 2, L * 1, L * 2]);
            else if (currentLineType === 'hidden') ctx.setLineDash([L * 1.2, L * 1.2]);
            else if (currentLineType === 'gasLine') ctx.setLineDash([L * 12, L * 4, L * 1.5, L * 4]);
            else if (currentLineType === 'fenceLine') ctx.setLineDash([L * 8, L * 1.2, L * 1.2, L * 1.2]);
            else if (currentLineType === 'tracks') ctx.setLineDash([L * 3, L * 1.5, L * 3, L * 1.5]);
            else if (currentLineType === 'batt') ctx.setLineDash([L * 3.5, L * 0.5, L * 0.5, L * 0.5, L * 3.5, L * 0.5]);
            else if (currentLineType === 'zigzag2') ctx.setLineDash([L * 2, L * 1]);
            else if (currentLineType === 'dots2') ctx.setLineDash([1/ts, L * 0.5]);
            else if (currentLineType === 'dash2') ctx.setLineDash([L * 1, L * 1]);
        }
    }

    const processText = (txt: string) => {
        if (!txt) return '';
        return txt
            .replace(/%%c/gi, 'Ø')
            .replace(/%%d/gi, '°')
            .replace(/%%p/gi, '±')
            .replace(/\\P/g, '\n')
            .replace(/\{|}/g, '');
    };

    switch (s.type) {
      case 'line': ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); break;
      case 'circle': ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); break;
      case 'rect': ctx.rect(s.x, s.y, s.width, s.height); break;
      case 'arc': ctx.arc(s.x, s.y, s.radius, s.startAngle, s.endAngle, !s.counterClockwise); break;
      case 'ellipse': ctx.ellipse(s.x, s.y, s.rx, s.ry, s.rotation, 0, Math.PI * 2); break;
      case 'donut': 
        ctx.arc(s.x, s.y, s.outerRadius, 0, Math.PI * 2);
        ctx.moveTo(s.x + s.innerRadius, s.y);
        ctx.arc(s.x, s.y, s.innerRadius, 0, Math.PI * 2, true);
        break;
      case 'hatch':
        if (s.points && s.points.length > 2) {
          ctx.save();
          // Define clipping path
          const clipPath = new Path2D();
          clipPath.moveTo(s.points[0].x, s.points[0].y);
          s.points.forEach((p, idx) => { if (idx > 0) clipPath.lineTo(p.x, p.y); });
          clipPath.closePath();
          
          ctx.clip(clipPath);
          
          drawHatchPattern(ctx, s.pattern, s.points, s.scale || 1, s.rotation || 0, ts);
          ctx.restore();
          
          // Render boundary
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          s.points.forEach((p, idx) => { if (idx > 0) ctx.lineTo(p.x, p.y); });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          return;
        }
        break;
      case 'ray': {
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const len = Math.sqrt(dx*dx + dy*dy);
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x1 + (dx/len) * 1e6, s.y1 + (dy/len) * 1e6);
          break;
      }
      case 'xline': {
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const len = Math.sqrt(dx*dx + dy*dy);
          ctx.moveTo(s.x1 - (dx/len) * 1e6, s.y1 - (dy/len) * 1e6);
          ctx.lineTo(s.x1 + (dx/len) * 1e6, s.y1 + (dy/len) * 1e6);
          break;
      }
      case 'dimension': {
          const ds = settings.dimStyles[s.styleId || 'standard'] || settings.dimStyles['standard'] || {
            arrowSize: 200, textSize: 250, textOffset: 100, extendLine: 150, offsetLine: 100, precision: 2
          };

          if (s.dimType === 'radius' || s.dimType === 'diameter' || s.dimType === 'angular' || s.dimType === 'arc') {
              const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
              const angle = Math.atan2(dy, dx);
              
              ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
              
              ctx.save();
              ctx.translate(s.x2, s.y2); ctx.rotate(angle + Math.PI);
              ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, ds.arrowSize/4);
              ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, -ds.arrowSize/4);
              ctx.restore();

              if (s.dimType === 'diameter') {
                  ctx.save();
                  ctx.translate(s.x1 - dx, s.y1 - dy);
                  ctx.rotate(angle);
                  ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, ds.arrowSize/4);
                  ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, -ds.arrowSize/4);
                  ctx.restore();
                  ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x1 - dx, s.y1 - dy);
              }

              ctx.save();
              const tx = (s.x1 + s.x2) / 2 + Math.cos(angle + Math.PI/2) * (ds.textOffset + ds.textSize/2);
              const ty = (s.y1 + s.y2) / 2 + Math.sin(angle + Math.PI/2) * (ds.textOffset + ds.textSize/2);
              ctx.translate(tx, ty);
              let tAngle = angle;
              if (tAngle > Math.PI/2) tAngle -= Math.PI;
              if (tAngle < -Math.PI/2) tAngle += Math.PI;
              ctx.rotate(tAngle); ctx.scale(1, -1);
              ctx.font = `${ds.textSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillStyle = ctx.strokeStyle; ctx.fillText(processText(s.text), 0, 0);
              ctx.restore();
              break;
          }

          if (s.dimType === 'ordinate') {
              const dx = Math.abs(s.x2 - s.x1), dy = Math.abs(s.y2 - s.y1);
              const isX = dx > dy;
              ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
              ctx.save();
              ctx.translate(s.x2, s.y2); ctx.scale(1, -1);
              ctx.font = `${ds.textSize}px monospace`; ctx.textAlign = isX ? 'left' : 'center'; ctx.textBaseline = isX ? 'middle' : 'bottom';
              ctx.fillStyle = ctx.strokeStyle;
              ctx.fillText(processText(s.text), isX ? ds.textOffset : 0, isX ? 0 : -ds.textOffset);
              ctx.restore();
              break;
          }
          
          let dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          let len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) break;

          if (s.dimType === 'linear') {
             const mx = (s.x1 + s.x2)/2, my = (s.y1 + s.y2)/2;
             const vdx = Math.abs(s.dimX - mx), vdy = Math.abs(s.dimY - my);
             if (vdx > vdy) { dx = 0; len = Math.abs(dy); } else { dy = 0; len = Math.abs(dx); }
          }
          
          const ux = dx / len, uy = dy / len;
          const nx = -uy, ny = ux;
          const vdx = s.dimX - s.x1, vdy = s.dimY - s.y1;
          const distFromLine = vdx * nx + vdy * ny;
          const sign = distFromLine >= 0 ? 1 : -1;
          
          const ex1x = s.x1 + nx * distFromLine, ex1y = s.y1 + ny * distFromLine;
          let px2 = s.x2 + nx * distFromLine, py2 = s.y2 + ny * distFromLine;
          if (s.dimType === 'linear') {
              if (dx === 0) { px2 = ex1x; py2 = s.y2 + ny * distFromLine; }
              else { px2 = s.x2 + nx * distFromLine; py2 = ex1y; }
          }

          ctx.moveTo(ex1x, ex1y); ctx.lineTo(px2, py2);
          ctx.moveTo(s.x1 + nx * ds.offsetLine * sign, s.y1 + ny * ds.offsetLine * sign);
          ctx.lineTo(ex1x + nx * ds.extendLine * sign, ex1y + ny * ds.extendLine * sign);
          ctx.moveTo(s.x2 + nx * ds.offsetLine * sign, s.y2 + ny * ds.offsetLine * sign);
          ctx.lineTo(px2 + nx * ds.extendLine * sign, py2 + ny * ds.extendLine * sign);

          const angle = Math.atan2(py2 - ex1y, px2 - ex1x);
          ctx.save(); ctx.translate(ex1x, ex1y); ctx.rotate(angle); ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, ds.arrowSize/4); ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, -ds.arrowSize/4); ctx.restore();
          ctx.save(); ctx.translate(px2, py2); ctx.rotate(angle + Math.PI); ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, ds.arrowSize/4); ctx.moveTo(0, 0); ctx.lineTo(ds.arrowSize, -ds.arrowSize/4); ctx.restore();
          
          ctx.save();
          const mx = (ex1x + px2) / 2 + nx * (ds.textOffset + ds.textSize/2) * sign;
          const my = (ex1y + py2) / 2 + ny * (ds.textOffset + ds.textSize/2) * sign;
          ctx.translate(mx, my);
          let tAngle = angle;
          if (tAngle > Math.PI/2) tAngle -= Math.PI;
          if (tAngle < -Math.PI/2) tAngle += Math.PI;
          ctx.rotate(tAngle); ctx.scale(1, -1);
          ctx.font = `${ds.textSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = ctx.strokeStyle; ctx.fillText(processText(s.text), 0, 0);
          ctx.restore();
          break;
      }
      case 'point': {
          const size = (s.size || 5) / ts;
          ctx.moveTo(s.x - size, s.y); ctx.lineTo(s.x + size, s.y);
          ctx.moveTo(s.x, s.y - size); ctx.lineTo(s.x, s.y + size);
          break;
      }
      case 'pline': case 'polygon': case 'spline':
        if(s.points && s.points.length > 0) {
            ctx.moveTo(s.points[0].x, s.points[0].y);
            if (s.type === 'spline' && s.points.length > 2) {
                for (let i = 1; i < s.points.length - 2; i++) {
                    const xc = (s.points[i].x + s.points[i + 1].x) / 2;
                    const yc = (s.points[i].y + s.points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, xc, yc);
                }
                // For the last 2 points
                const n = s.points.length;
                ctx.quadraticCurveTo(s.points[n-2].x, s.points[n-2].y, s.points[n-1].x, s.points[n-1].y);
            } else {
                s.points.forEach(p => ctx.lineTo(p.x, p.y));
            }
            if(s.closed || s.type === 'polygon') ctx.closePath();
        }
        break;
      case 'dline':
        if(s.points && s.points.length > 1) {
            const thickness = s.thickness || 230;
            const justification = s.justification || 'zero';
            
            let offset1 = 0;
            let offset2 = 0;
            
            if (justification === 'zero') {
                offset1 = thickness / 2;
                offset2 = -thickness / 2;
            } else if (justification === 'top') {
                offset1 = 0;
                offset2 = -thickness;
            } else if (justification === 'bottom') {
                offset1 = thickness;
                offset2 = 0;
            }
            
            const pts1 = getPolylineOffsetPoints(s.points, offset1, s.closed);
            const pts2 = getPolylineOffsetPoints(s.points, offset2, s.closed);
            
            // Draw path 1
            if (pts1.length > 0) {
                ctx.moveTo(pts1[0].x, pts1[0].y);
                pts1.forEach(p => ctx.lineTo(p.x, p.y));
                if (s.closed) ctx.closePath();
            }
            
            // Draw path 2
            if (pts2.length > 0) {
                ctx.moveTo(pts2[0].x, pts2[0].y);
                pts2.forEach(p => ctx.lineTo(p.x, p.y));
                if (s.closed) ctx.closePath();
            }

            // Optional: Draw end caps if not closed
            if (!s.closed) {
                if (pts1.length > 0 && pts2.length > 0) {
                    // Start cap
                    ctx.moveTo(pts1[0].x, pts1[0].y);
                    ctx.lineTo(pts2[0].x, pts2[0].y);
                    // End cap
                    ctx.moveTo(pts1[pts1.length-1].x, pts1[pts1.length-1].y);
                    ctx.lineTo(pts2[pts2.length-1].x, pts2[pts2.length-1].y);
                }
            }
        }
        break;
      case 'leader': {
          ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
          // Simple arrowhead
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const a = Math.atan2(dy, dx);
          const size = 10 / ts;
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x1 + size * Math.cos(a + 0.5), s.y1 + size * Math.sin(a + 0.5));
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x1 + size * Math.cos(a - 0.5), s.y1 + size * Math.sin(a - 0.5));
          break;
      }
      case 'text':
      case 'mtext':
        ctx.save(); 
        ctx.translate(s.x, s.y); 
        if (s.rotation) ctx.rotate(-s.rotation); 
        ctx.scale(1,-1); 
        
        const weight = (s as any).bold ? 'bold' : '400';
        const style = (s as any).italic ? 'italic' : 'normal';
        const font = (s as any).fontFamily || 'monospace';
        
        ctx.font=`${style} ${weight} ${s.size}px ${font}`; 
        ctx.fillStyle=ctx.strokeStyle; 
        ctx.textAlign = s.justification || 'left';
        
        

        if (s.type === 'mtext') {
            const rawContent = processText(s.content);
            let lines: string[] = [];
            
            if (s.width > 0) {
                const words = rawContent.split(' ');
                let currentLine = '';
                words.forEach(word => {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    if (ctx.measureText(testLine).width > s.width && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                });
                lines.push(currentLine);
            } else {
                lines = rawContent.split('\n');
            }

            const xOffset = (s.justification === 'center' ? s.width/2 : s.justification === 'right' ? s.width : 0);
            lines.forEach((line, i) => {
                const ly = i * s.size * 1.2;
                
                if ((s as any).highlight) {
                    const tw = ctx.measureText(line).width;
                    let hx = xOffset;
                    if (s.justification === 'center') hx -= tw/2;
                    else if (s.justification === 'right') hx -= tw;
                    ctx.save();
                    ctx.fillStyle = 'rgba(255, 230, 0, 0.4)';
                    // Fix highlighter size to fit text bounds only
                    ctx.fillRect(hx - 2, ly - s.size * 0.85, tw + 4, s.size * 1.1);
                    ctx.restore();
                }
                
                ctx.fillText(line, xOffset, ly);
                
                if ((s as any).underline) {
                    const tw = ctx.measureText(line).width;
                    let ux = xOffset;
                    if (s.justification === 'center') ux -= tw/2;
                    else if (s.justification === 'right') ux -= tw;
                    ctx.fillRect(ux, ly + 2, tw, s.size/10);
                }
            });
        } else {
            const content = processText(s.content);
            if ((s as any).highlight) {
                const tw = ctx.measureText(content).width;
                let hx = 0;
                if (s.justification === 'center') hx -= tw/2;
                else if (s.justification === 'right') hx -= tw;
                ctx.save();
                ctx.fillStyle = 'rgba(255, 230, 0, 0.4)';
                ctx.fillRect(hx - 2, -s.size * 0.85, tw + 4, s.size * 1.1);
                ctx.restore();
            }
            ctx.fillText(content, 0, 0);
            if ((s as any).underline) {
                const tw = ctx.measureText(content).width;
                let ux = 0;
                if (s.justification === 'center') ux -= tw/2;
                else if (s.justification === 'right') ux -= tw;
                ctx.fillRect(ux, 4, tw, s.size/10);
            }
        }
        ctx.restore(); break;
      case 'block':
        const block = blocks[s.blockId];
        if (block) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(-s.rotation * Math.PI / 180);
          ctx.scale(s.scaleX, s.scaleY);
          
          // Translate by negative basePoint to align the insertion point correctly
          if (block.basePoint) {
            ctx.translate(-block.basePoint.x, -block.basePoint.y);
          }
          
          const currentColor = resolveColor(s, layerConfig[s.layer], activeTab, blockContext);
          const currentThickness = resolveLineWeight(s, layerConfig[s.layer], blockContext);
          
          block.shapes.forEach(bs => drawShape(ctx, bs, ts, { color: currentColor, thickness: currentThickness }));
          ctx.restore();
        }
        break;
    }
    if(s.filled && !isS && !isH) { ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1.0; }
    ctx.stroke(); ctx.restore();
  };

  const drawHatchPattern = (ctx: CanvasRenderingContext2D, pattern: string, points: Point[], scale: number, rotation: number, ts: number) => {
    // Calculate bounds of the hatch
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    points.forEach(p => {
        xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
        yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
    });
    
    // Safety check for empty bounds
    if (xMin === Infinity) return;

    const width = xMax - xMin, height = yMax - yMin;
    // Spacing should be model-space (not divided by ts)
    const spacing = (scale || 1) * (pattern === 'dots' ? 12 : 24);
    const angle = (rotation || 0) * Math.PI / 180;
    
    ctx.save();
    ctx.lineWidth = 0.8/ts;
    ctx.setLineDash([]);
    // Use the color of the shape if provided, else current strokeStyle
    const hatchColor = ctx.strokeStyle;
    ctx.globalAlpha = 0.6;
    
    if (pattern === 'solid') {
      ctx.fillStyle = hatchColor;
      ctx.globalAlpha = 0.5; // Slightly more opaque for solid hatch
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p, idx) => { if (idx > 0) ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.fill(); 
    } else {
        const diagonal = Math.sqrt(width*width + height*height) * 2;
        let count = Math.ceil(diagonal / spacing);
        // Safety cap for extremely dense patterns
        if (count > 500) count = 500; 
        
        const startX = (xMin + xMax) / 2;
        const startY = (yMin + yMax) / 2;
        
        ctx.translate(startX, startY);
        ctx.rotate(angle);
        
        if (pattern === 'dots') {
            ctx.beginPath();
            const dotSize = 0.5/ts;
            const step = spacing;
            for (let i = -count; i <= count; i++) {
                for (let j = -count; j <= count; j++) {
                    const px = i * step, py = j * step;
                    ctx.moveTo(px + dotSize, py);
                    ctx.arc(px, py, dotSize, 0, Math.PI * 2);
                }
            }
            ctx.fillStyle = hatchColor;
            ctx.fill();
        } else {
            ctx.beginPath();
            for (let i = -count; i <= count; i++) {
                const offset = i * spacing;
                
                // ANSI patterns
                if (pattern.startsWith('ansi') || pattern === 'cross' || pattern === 'net' || pattern === 'hound' || pattern === 'grid') {
                    const a = (pattern === 'ansi31' || pattern === 'ansi32') ? Math.PI/4 : 
                              (pattern === 'ansi37') ? -Math.PI/4 : 0;
                    
                    ctx.save();
                    ctx.rotate(a);
                    ctx.moveTo(-diagonal, offset);
                    ctx.lineTo(diagonal, offset);
                    if (pattern === 'ansi32') { 
                        ctx.moveTo(-diagonal, offset + spacing/5);
                        ctx.lineTo(diagonal, offset + spacing/5);
                    }
                    if (pattern === 'net') {
                         ctx.rotate(Math.PI/2);
                         ctx.moveTo(-diagonal, offset);
                         ctx.lineTo(diagonal, offset);
                    }
                    ctx.restore();
                }
                
                if (pattern === 'grid') {
                     ctx.moveTo(-diagonal, offset);
                     ctx.lineTo(diagonal, offset);
                     ctx.save();
                     ctx.rotate(Math.PI/2);
                     ctx.moveTo(-diagonal, offset);
                     ctx.lineTo(diagonal, offset);
                     ctx.restore();
                }

                if (pattern === 'ansi37' || pattern === 'hound') {
                    ctx.save();
                    ctx.rotate(Math.PI/4); 
                    ctx.moveTo(-diagonal, offset);
                    ctx.lineTo(diagonal, offset);
                    if (pattern === 'hound') {
                         ctx.rotate(Math.PI/2);
                         ctx.setLineDash([spacing/2, spacing/2]);
                         ctx.moveTo(-diagonal, offset);
                         ctx.lineTo(diagonal, offset);
                    }
                    ctx.restore();
                }
                
                if (pattern === 'brick') {
                    const s = spacing;
                    ctx.moveTo(-diagonal, i * s);
                    ctx.lineTo(diagonal, i * s);
                    for (let j = -count; j <= count; j++) {
                        const x = j * s * 2 + (i % 2 === 0 ? 0 : s);
                        ctx.moveTo(x, i * s);
                        ctx.lineTo(x, (i + 1) * s);
                    }
                }
                
                if (pattern === 'gravel') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        const px = i * s + (j % 2 === 0 ? 0 : s/2);
                        const py = j * s;
                        const r = s * 0.15;
                        const rot = Math.sin(i * 133 + j * 93) * Math.PI;
                        const c = Math.cos(rot), st = Math.sin(rot);
                        ctx.moveTo(px + (-r*c - (-r)*st), py + (-r*st + (-r)*c));
                        ctx.lineTo(px + (r*c - (-r)*st), py + (r*st + (-r)*c));
                        ctx.lineTo(px + (0 - r*st), py + (r*c));
                        ctx.lineTo(px + (-r*c - (-r)*st), py + (-r*st + (-r)*c));
                    }
                }
                
                if (pattern === 'honey') {
                    const s = spacing;
                    const h = s * Math.sqrt(3) / 2;
                    for (let j = -count; j <= count; j++) {
                        const px = i * s * 1.5;
                        const py = j * h * 2 + (i % 2 === 0 ? 0 : h);
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + s * 0.5, py + h);
                        ctx.lineTo(px + s * 1.5, py + h);
                        ctx.lineTo(px + s * 2.0, py);
                    }
                }
            }
            ctx.stroke();
        }
    }
    ctx.restore();
  };

  const drawSnapMarker = (ctx: CanvasRenderingContext2D, snap: SnapPoint, ts: number) => {
    ctx.save(); const { x, y, type } = snap, size = 10 / ts;
    ctx.strokeStyle = "#00bcd4"; ctx.lineWidth = 2.5 / ts; ctx.beginPath();
    switch (type) {
      case 'end': ctx.rect(x-size, y-size, size*2, size*2); break;
      case 'mid': ctx.moveTo(x, y-size); ctx.lineTo(x-size, y+size); ctx.lineTo(x+size, y+size); ctx.closePath(); break;
      case 'cen': ctx.arc(x, y, size, 0, Math.PI*2); break;
      case 'int': ctx.moveTo(x-size, y-size); ctx.lineTo(x+size, y+size); ctx.moveTo(x+size, y-size); ctx.lineTo(x-size, y+size); break;
      case 'perp': ctx.moveTo(x-size, y); ctx.lineTo(x, y); ctx.lineTo(x, y-size); break;
      case 'tan': 
        ctx.arc(x, y, size, 0, Math.PI*2);
        ctx.moveTo(x-size, y-size); ctx.lineTo(x+size, y-size);
        break;
      case 'quad':
        ctx.moveTo(x, y-size); ctx.lineTo(x+size, y); ctx.lineTo(x, y+size); ctx.lineTo(x-size, y); ctx.closePath();
        ctx.stroke(); ctx.beginPath();
        ctx.arc(x, y, size/2, 0, Math.PI*2);
        break;
      case 'ext':
        ctx.moveTo(x-size, y); ctx.lineTo(x+size, y);
        ctx.moveTo(x, y-size); ctx.lineTo(x, y+size);
        break;
      case 'par':
        ctx.moveTo(x-size, y-size/2); ctx.lineTo(x+size, y-size/2);
        ctx.moveTo(x-size, y+size/2); ctx.lineTo(x+size, y+size/2);
        break;
      case 'gcen':
        ctx.moveTo(x-size, y); ctx.lineTo(x+size, y);
        ctx.moveTo(x, y-size); ctx.lineTo(x, y+size);
        ctx.stroke(); ctx.beginPath();
        ctx.arc(x, y, size/2, 0, Math.PI*2);
        break;
      case 'appint':
        ctx.moveTo(x-size, y-size); ctx.lineTo(x+size, y+size);
        ctx.moveTo(x+size, y-size); ctx.lineTo(x-size, y+size);
        ctx.stroke(); ctx.beginPath();
        ctx.rect(x-size/2, y-size/2, size, size);
        break;
      case 'near': 
        ctx.moveTo(x, y-size); ctx.lineTo(x+size, y); ctx.lineTo(x, y+size); ctx.lineTo(x-size, y); ctx.closePath();
        break;
    }
    ctx.stroke(); ctx.restore();
  };

  const selectionTimer = useRef<NodeJS.Timeout | null>(null);
  const isMultiSelecting = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      // try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y}); pointerStartPos.current = { x, y };
      
      const count = activePointers.current.size;
      if (count === 1) {
          touchStartTime.current = Date.now();
          touchStartCount.current = 1;

          // REQUIREMENT: Long press for multi object selection or Hatch
          if (!isCommandActive) {
            selectionTimer.current = setTimeout(() => {
                isMultiSelecting.current = true;
                
                // If long pressing on a closed shape, trigger HATCH
                const wp = screenToWorld(x, y);
                const allShapes = getAllShapesForSelection();
                const target = allShapes.find(s => isShapeClosed(s) && isPointInsideShape(wp, s));
                
                if (target && onCommand) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    onSelectionChange?.([target.id], false);
                    onCommand('HATCH');
                } else {
                    if(navigator.vibrate) navigator.vibrate(30);
                    if (setLogMessage) setLogMessage("MULTI_SELECT_ACTIVE (LONG PRESS)");
                }
            }, 600);
          }
      } else if (count === 2) {
          touchStartCount.current = 2;
          setIsPanning(false);
          setSelectionRect(null); // Clear selection when pinch starts
          if (selectionTimer.current) {
            clearTimeout(selectionTimer.current);
            selectionTimer.current = null;
          }
      }

      if (count === 2) {
          const pts = Array.from(activePointers.current.values()) as Point[];
          initialPinchDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          
          const currentView = (isViewportActive && activeViewportId) ? 
              layouts.find(l=>l.id===activeTab)?.viewports.find(vp=>vp.id===activeViewportId)?.viewState : view;
          
          initialViewOnPinch.current = currentView ? { ...currentView } : { scale: 1, originX: 0, originY: 0 };
          
          const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
          initialPanMid.current = { x: midX, y: midY };
          worldPointOnPinch.current = screenToWorld(midX, midY);
      }
      const now = Date.now();
      // Only handle double-tap for single pointer to avoid blocking pinch
      if (count === 1 && now - lastClickTime.current < 300) { 
          if (activeTab !== 'model' && onViewportToggle) onViewportToggle(x, y); 
          return; 
      }
      lastClickTime.current = now;
      if (activePointers.current.size === 1) { 
        lastPos.current = { x, y }; 
        if (e.button === 1 || e.button === 2 || activeCommandName === 'PAN') {
            setIsPanning(true);
        } else if (e.button === 0) {
            if (activeCommandName === 'SPLINE' || activeCommandName === 'SKETCH' || activeCommandName === 'ZOOM') {
                const wp = screenToWorld(x, y);
                if (onClick) onClick(wp.x, wp.y, !!activeSnapRef.current);
            }
            // For selection window / rubber band
            setIsPanning(true); 
        }
      }
      updateCursorAndSnaps(x, y); redraw();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y});
      
      if (activePointers.current.size === 1) {
          const dx_p = x - pointerStartPos.current.x, dy_p = y - pointerStartPos.current.y;
          if (Math.hypot(dx_p, dy_p) > 10 && selectionTimer.current) {
            clearTimeout(selectionTimer.current);
            selectionTimer.current = null;
          }

          if (isPanning) {
              const dx = x - lastPos.current.x, dy = y - lastPos.current.y;
              if (Math.hypot(x - pointerStartPos.current.x, y - pointerStartPos.current.y) > 6) {
                 const isSelCmd = ['SELECT', 'ERASE', 'MOVE', 'COPYCLIP', 'CUTCLIP', 'STRETCH', 'ZOOM'].includes(activeCommandName || '');
                 if (((!isCommandActive && activeCommandName !== 'PAN') || isSelCmd) && e.buttons === 1) {
                    const crossing = pointerStartPos.current.x > x;
                    setSelectionRect({ start: pointerStartPos.current, end: {x, y}, crossing });
                    
                    const w1 = screenToWorld(pointerStartPos.current.x, pointerStartPos.current.y);
                    const w2 = screenToWorld(x, y);
                    const selectableShapes = getAllShapesForSelection();
                    const hits = getShapesInRect(w1, w2, selectableShapes, crossing, blocks);
                    setHighlightedIds(hits.map(s => s.id));
                 }
                 else if (e.buttons === 4 || e.buttons === 2 || activeCommandName === 'PAN') {
                    const lts = view.scale * settings.drawingScale;
                    if (activeTab !== 'model' && isViewportActive && activeViewportId) {
                        const layout = layouts.find(l => l.id === activeTab);
                        const vp = layout?.viewports.find(v => v.id === activeViewportId);
                        if (vp) {
                            // Panning drawing inside viewport
                            // dx/dy are in screen pixels, need to convert to paper units first
                            const dx_paper = dx / lts;
                            const dy_paper = dy / lts;
                            // relX = halfW + originX + mx*vts
                            // relY = halfH + originY - my*vts
                            // To increase relX, increase originX. To increase relY, increase originY.
                            setView(v => ({ 
                                ...v, 
                                originX: v.originX + dx_paper, 
                                originY: v.originY + dy_paper 
                            }));
                        }
                    } else {
                        // Panning model space or layout paper
                        // originX/Y are in pixels
                        setView(v => ({ 
                            ...v, 
                            originX: v.originX + dx, 
                            originY: v.originY + dy 
                        }));
                    }
                 }
              }
          }
          lastPos.current = { x, y };
      } else if (activePointers.current.size === 2) {
          const pts = Array.from(activePointers.current.values()) as Point[];
          const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
          
          if (initialPinchDist.current && initialViewOnPinch.current && worldPointOnPinch.current && initialPanMid.current) {
              const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
              const factor = curDist / initialPinchDist.current;
              const newScale = Math.max(0.000001, initialViewOnPinch.current.scale * factor);
              
              let newOriginX: number, newOriginY: number;
              const wp = worldPointOnPinch.current;

              if (activeTab === 'model' || !isViewportActive) {
                  const ts = newScale * settings.drawingScale;
                  newOriginX = midX - w/2 - wp.x * ts;
                  newOriginY = midY - h/2 + wp.y * ts;
              } else {
                  const layout = layouts.find(l => l.id === activeTab);
                  const vp = layout?.viewports.find(v => v.id === activeViewportId);
                  if (vp && layout) {
                      const pPoint = calculateScreenToWorld(midX, midY, view, w, h);
                      const paperW = layout.paperSize.width, paperH = layout.paperSize.height;
                      const papX = pPoint.x + paperW/2, papY = paperH/2 - pPoint.y;
                      const relX = papX - vp.x, relY = papY - vp.y;
                      
                      newOriginX = relX - vp.width/2 - wp.x * newScale;
                      newOriginY = relY - vp.height/2 + wp.y * newScale;
                  } else {
                      newOriginX = initialViewOnPinch.current.originX;
                      newOriginY = initialViewOnPinch.current.originY;
                  }
              }
              
              setView({ scale: newScale, originX: newOriginX, originY: newOriginY });
          }
      }
      updateCursorAndSnaps(x, y); redraw();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      
      if (selectionTimer.current) {
        clearTimeout(selectionTimer.current);
        selectionTimer.current = null;
      }
      const multi = isMultiSelecting.current;
      isMultiSelecting.current = false;

      if (e.button === 2) {
          // Right-click: Send Enter to command engine
          if (isCommandActive && onAction) {
              onAction('enter');
          } else {
              // If no command active, repeat last command
              if (onCommand) onCommand('');
          }
          activePointers.current.delete(e.pointerId);
          setIsPanning(false);
          return;
      }

      if ((activeCommandName === 'SKETCH' || activeCommandName === 'SPLINE') && !selectionRect) {
          // Finish sketching or freehand drawing on PointerUp if it was a drag
          const dist = Math.hypot(x - pointerStartPos.current.x, y - pointerStartPos.current.y);
          if (dist > 10) {
              const wp = screenToWorld(x, y);
              if (onClick) onClick(wp.x, wp.y, !!activeSnapRef.current);
          }
      } else if (selectionRect) {
          if (activeCommandName === 'ZOOM') {
              const w2 = screenToWorld(x, y);
              if (onClick) onClick(w2.x, w2.y, !!activeSnapRef.current);
          } else {
              const w1 = screenToWorld(selectionRect.start.x, selectionRect.start.y), w2 = screenToWorld(selectionRect.end.x, selectionRect.end.y);
              const selectableShapes = getAllShapesForSelection();
              const hits = getShapesInRect(w1, w2, selectableShapes, selectionRect.crossing, blocks);
              if (onSelectionChange) onSelectionChange(hits.map(s => s.id), e.shiftKey);
          }
          setSelectionRect(null);
          setHighlightedIds([]);
      } else {
          const dx = Math.abs(x - pointerStartPos.current.x), dy = Math.abs(y - pointerStartPos.current.y);
          if (dx < 6 && dy < 6 && activePointers.current.size === 1) {
              const wp = screenToWorld(x, y), snapped = !!activeSnapRef.current;
              const finalP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : wp;
              if (isCommandActive && onClick && activeCommandName !== 'PAN') onClick(finalP.x, finalP.y, snapped);
              else if (activeCommandName !== 'PAN') {
                const ts = view.scale * settings.drawingScale, selectableShapes = getAllShapesForSelection();
                const hit = selectableShapes.find(s => hitTestShape(finalP.x, finalP.y, s, 20/ts, blocks));
                
                // Requirement: Single tap -> single object, Long press -> multi object selection
                if (onSelectionChange) onSelectionChange(hit ? [hit.id] : [], multi || e.shiftKey);
              }
          }
      }
      const countBefore = activePointers.current.size;
      activePointers.current.delete(e.pointerId);
      const countAfter = activePointers.current.size;

      // Gesture: Two-finger tap for Undo
      if (touchStartCount.current === 2 && countAfter === 0) {
          const duration = Date.now() - touchStartTime.current;
          if (duration < 300 && onAction) {
              onAction('undo');
          }
      }

      if (countAfter === 0) { setIsPanning(false); initialPinchDist.current = null; }
      redraw();
  };

  const propsRef = useRef({ view, isViewportActive, activeViewportId, layouts, activeTab, settings, setView });
  useEffect(() => {
    propsRef.current = { view, isViewportActive, activeViewportId, layouts, activeTab, settings, setView };
  }, [view, isViewportActive, activeViewportId, layouts, activeTab, settings, setView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const { view, isViewportActive, activeViewportId, layouts, activeTab, settings, setView } = propsRef.current;
        
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 33; // Lines to pixels
        if (e.deltaMode === 2) delta *= 500; // Pages to pixels
        
        const factor = Math.pow(1.002, -delta);
        const wp = screenToWorld(x, y);
        
        const currentView = (isViewportActive && activeViewportId) ? 
            layouts.find(l=>l.id===activeTab)?.viewports.find(vp=>vp.id===activeViewportId)?.viewState : view;
        
        if (!currentView) return;

        const newScale = Math.max(0.000001, currentView.scale * factor);
        const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
        const ts = newScale * settings.drawingScale;
        
        let newOriginX: number, newOriginY: number;
        
        if (activeTab === 'model' || !isViewportActive) {
            newOriginX = x - w/2 - wp.x * ts;
            newOriginY = y - h/2 + wp.y * ts;
        } else {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp && layout) {
                const pPoint = calculateScreenToWorld(x, y, view, w, h);
                const paperW = layout.paperSize.width, paperH = layout.paperSize.height;
                const papX = pPoint.x + paperW/2, papY = paperH/2 - pPoint.y;
                const relX = papX - vp.x, relY = papY - vp.y;
                
                const vts = newScale; 
                newOriginX = relX - vp.width/2 - wp.x * vts;
                newOriginY = relY - vp.height/2 + wp.y * vts;
            } else {
                newOriginX = currentView.originX;
                newOriginY = currentView.originY;
            }
        }
        
        setView({ scale: newScale, originX: newOriginX, originY: newOriginY });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const handleResize = () => { canvas.width = canvas.clientWidth * getPixelRatio(); canvas.height = canvas.clientHeight * getPixelRatio(); redraw(); };
    window.addEventListener('resize', handleResize); handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  useEffect(() => {
    let anim: number;
    const loop = () => {
      if (isAiThinking || (lastAiCommandTime && Date.now() - lastAiCommandTime < 1000)) {
        redraw();
      }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [isAiThinking, lastAiCommandTime, redraw]);

  useEffect(() => { redraw(); }, [redraw, view, isViewportActive, layers, layerConfig, selectedIds, highlightIds, settings, previewShapes]);

  return (
    <div className="w-full h-full overflow-hidden bg-[#0a0a0c] touch-none">
        <canvas ref={canvasRef} className="w-full h-full outline-none select-none touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onContextMenu={e => e.preventDefault()} />
    </div>
  );
});

export default CADCanvas;
