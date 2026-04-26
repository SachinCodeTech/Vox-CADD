
import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Shape, ViewState, AppSettings, SnapPoint, LayerConfig, Point, MTextShape, BlockDefinition, LayoutDefinition } from '../types';
import { hitTestShape, findBestSnap, formatLength, getShapesInRect, getShapeBounds, isRectIntersecting } from '../services/cadService';

interface CADCanvasProps {
  layers: Record<string, Shape[]>;
  blocks: Record<string, BlockDefinition>;
  layouts: LayoutDefinition[];
  layerConfig: Record<string, LayerConfig>; 
  view: ViewState;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  settings: AppSettings;
  isCommandActive: boolean;
  activeTab: string;
  isViewportActive?: boolean;
  onViewportToggle?: () => void;
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
}

export interface CADCanvasHandle {
  captureImage: () => string;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(({ 
    layers, blocks, layouts, layerConfig, view, setView, settings, isCommandActive, activeTab, 
    isViewportActive = false, onViewportToggle,
    onMouseMove, onClick, selectedIds = [], highlightIds = [], onSelectionChange, previewShapes,
    activePrompt, basePoint = null, activeCommandName, isAiThinking, lastAiCommandTime, onAction, onCommand
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useImperativeHandle(ref, () => ({
    captureImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
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
  
  const getAllShapesForRendering = () => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        return conf ? !conf.frozen : true;
    });
  };

  const getAllShapesForSelection = () => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        return conf ? (!conf.frozen && !conf.locked) : true;
    });
  };

  const calculateScreenToWorld = (sx: number, sy: number, v: ViewState, w: number, h: number): Point => {
    const ts = v.scale * settings.drawingScale;
    return { x: (sx - w/2 - v.originX)/ts, y: -(sy - h/2 - v.originY)/ts };
  };

  const screenToWorld = (sx: number, sy: number): Point => {
    const canvas = canvasRef.current; if (!canvas || !view) return { x: 0, y: 0 };
    const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
    return calculateScreenToWorld(sx, sy, view, w, h);
  };

  const worldToScreen = (wx: number, wy: number): Point => {
      const canvas = canvasRef.current; if (!canvas || !view) return { x: 0, y: 0 };
      const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r, ts = view.scale * settings.drawingScale;
      return { x: wx * ts + w/2 + view.originX, y: -wy * ts + h/2 + view.originY };
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
    ctx.fillStyle = isModel ? "#121212" : "#333"; ctx.fillRect(0, 0, w, h);

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
              
              ctx.translate(vX, vY);
              ctx.strokeStyle = isViewportActive ? "#00bcd4" : "#adadad"; 
              ctx.lineWidth = isViewportActive ? 2 : 1;
              ctx.strokeRect(0, 0, vW, vH);
              
              const region = new Path2D();
              region.rect(0, 0, vW, vH);
              ctx.clip(region);
              
              // Render model space inside viewport
              const vts = vp.viewState.scale * settings.drawingScale;
              ctx.translate(vW/2 + vp.viewState.originX, vH/2 + vp.viewState.originY);
              ctx.scale(vts, -vts);
              
              const vShapes = getAllShapesForRendering();
              vShapes.forEach(s => drawShape(ctx, s, vts));
              ctx.restore();
          });
      }
      
      if (!isViewportActive) {
          // return? Let's check how we handle clicks in layout
      }
    }

    if (isModel || isViewportActive) {
      ctx.save(); ctx.translate(w/2 + view.originX, h/2 + view.originY); ctx.scale(ts, -ts);
    
    if (isModel && settings.grid) {
        const sMin = calculateScreenToWorld(0, 0, view, w, h);
        const sMax = calculateScreenToWorld(w*r, h*r, view, w, h);
        const g = settings.gridSpacing;
        const majorEvery = 5;
        
        // Minor Grid Lines
        ctx.lineWidth = 0.5 / ts;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
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
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
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
        const bounds = getShapeBounds(s);
        return isRectIntersecting(viewportBounds, bounds);
    });

    visibleShapes.forEach(s => drawShape(ctx, s, ts));
    if (activeSnapRef.current) drawSnapMarker(ctx, activeSnapRef.current, ts);
    if (previewShapes) previewShapes.forEach(s => drawShape(ctx, s, ts));
    
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
        const text = `${formatLength(targetWorldP.x, settings.units === 'imperial')}, ${formatLength(targetWorldP.y, settings.units === 'imperial')}`;
        ctx.font = '700 10px "Fira Code", monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
        ctx.beginPath(); ctx.roundRect(screenPos.x + 15, screenPos.y - 28, tw + 20, 22, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(0, 188, 212, 0.4)'; ctx.stroke();
        ctx.fillStyle = '#00bcd4'; ctx.fillText(text, screenPos.x + 25, screenPos.y - 13);
    }
    ctx.restore();
  }, [view, layers, previewShapes, selectedIds, highlightIds, settings, layerConfig, activeTab, isViewportActive, isCommandActive, selectionRect]);

  const drawGrips = (ctx: CanvasRenderingContext2D, s: Shape, ts: number) => {
    const size = 6 / ts;
    ctx.fillStyle = "#3b82f6";
    const drawBox = (px: number, py: number) => { ctx.fillRect(px - size/2, py - size/2, size, size); };

    switch (s.type) {
        case 'line': drawBox(s.x1, s.y1); drawBox(s.x2, s.y2); drawBox((s.x1+s.x2)/2, (s.y1+s.y2)/2); break;
        case 'circle': drawBox(s.x, s.y); drawBox(s.x + s.radius, s.y); drawBox(s.x - s.radius, s.y); break;
        case 'rect': drawBox(s.x, s.y); drawBox(s.x+s.width, s.y); drawBox(s.x+s.width, s.y+s.height); drawBox(s.x, s.y+s.height); break;
        case 'pline': case 'polygon': case 'spline': s.points.forEach(p => drawBox(p.x, p.y)); break;
        case 'arc': drawBox(s.x, s.y); drawBox(s.x + s.radius * Math.cos(s.startAngle), s.y + s.radius * Math.sin(s.startAngle)); drawBox(s.x + s.radius * Math.cos(s.endAngle), s.y + s.radius * Math.sin(s.endAngle)); break;
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape, ts: number) => {
    const isS = selectedIds.includes(s.id), isH = highlightIds.includes(s.id) || highlightedIds.includes(s.id);
    const conf = layerConfig[s.layer]; 
    if (!s.isPreview && conf && (!conf.visible || conf.frozen)) return;
    
    ctx.save(); ctx.beginPath();
    let baseColor = conf?.color || s.color;
    if (s.isPreview && isCommandActive) baseColor = layerConfig[settings.currentLayer]?.color || "#FFFFFF";
    if (activeTab !== 'model' && (baseColor.toUpperCase() === '#FFF' || baseColor.toUpperCase() === '#FFFFFF')) baseColor = '#111111';
    
    let weight = s.thickness || conf?.thickness || 1;
    if (!settings.showLineWeights && !isS && !isH && !s.isPreview) weight = 1;

    if (s.isPreview) { ctx.strokeStyle = baseColor; ctx.setLineDash([6/ts, 4/ts]); ctx.globalAlpha = 0.5; ctx.lineWidth = 1/ts; }
    else if (isS) { ctx.strokeStyle = "#00bcd4"; ctx.lineWidth = 2.5/ts; ctx.setLineDash([2/ts, 2/ts]); }
    else if (isH) { ctx.strokeStyle = "#00bcd4"; ctx.lineWidth = 1.5/ts; ctx.setLineDash([4/ts, 4/ts]); }
    else { ctx.strokeStyle = baseColor; if (conf?.locked) ctx.globalAlpha = 0.45; ctx.lineWidth = weight/ts; }
    
    const currentLineType = s.lineType || conf?.lineType || 'continuous';
    if (!s.isPreview && !isH && !isS) {
        if (currentLineType === 'dashed') ctx.setLineDash([12/ts, 8/ts]);
        else if (currentLineType === 'dotted') ctx.setLineDash([1.5/ts, 5/ts]);
        else if (currentLineType === 'center') ctx.setLineDash([20/ts, 6/ts, 4/ts, 6/ts]);
        else ctx.setLineDash([]);
    }

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
          // Draw dimension line
          ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.dimX, s.dimY);
          ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.dimX, s.dimY); // This is wrong for standard dims, but okay for a sketch
          // Extension lines
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const len = Math.sqrt(dx*dx + dy*dy);
          const nx = -dy/len, ny = dx/len;
          ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x1 + nx * 5/ts, s.y1 + ny * 5/ts);
          ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.x2 + nx * 5/ts, s.y2 + ny * 5/ts);
          break;
      }
      case 'point': {
          const size = (s.size || 5) / ts;
          ctx.moveTo(s.x - size, s.y); ctx.lineTo(s.x + size, s.y);
          ctx.moveTo(s.x, s.y - size); ctx.lineTo(s.x, s.y + size);
          break;
      }
      case 'pline': case 'polygon': case 'spline': case 'dline':
        if(s.points && s.points.length > 0) {
            ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.forEach(p => ctx.lineTo(p.x, p.y));
            if(s.closed || s.type === 'polygon') ctx.closePath();
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
        ctx.save(); ctx.translate(s.x, s.y); if (s.rotation) ctx.rotate(s.rotation); ctx.scale(1,-1); ctx.font=`400 ${s.size}px monospace`; ctx.fillStyle=ctx.strokeStyle; 
        ctx.textAlign = s.justification || 'left';
        if (s.type === 'mtext') {
            const lines = s.content.split('\n');
            const xOffset = (s.justification === 'center' ? s.width/2 : s.justification === 'right' ? s.width : 0);
            lines.forEach((line, i) => ctx.fillText(line, xOffset, (i + 1) * s.size * 1.2));
        } else ctx.fillText(s.content, 0, 0);
        ctx.restore(); break;
      case 'block':
        const block = blocks[s.blockId];
        if (block) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(-s.rotation * Math.PI / 180);
          ctx.scale(s.scaleX, s.scaleY);
          block.shapes.forEach(bs => drawShape(ctx, bs, ts));
          ctx.restore();
        }
        break;
    }
    if(s.filled && !isS && !isH) { ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1.0; }
    ctx.stroke(); ctx.restore();
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

  const handlePointerDown = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y}); pointerStartPos.current = { x, y };
      
      const count = activePointers.current.size;
      if (count === 1) {
          touchStartTime.current = Date.now();
          touchStartCount.current = 1;
      } else if (count === 2) {
          touchStartCount.current = 2;
      }

      if (count === 2) {
          setIsPanning(false); 
          const pts = Array.from(activePointers.current.values()) as Point[];
          initialPinchDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          initialViewOnPinch.current = { ...view };
          
          const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
          initialPanMid.current = { x: midX, y: midY };
          worldPointOnPinch.current = screenToWorld(midX, midY);
      }
      const now = Date.now();
      if (now - lastClickTime.current < 300) { if (activeTab === 'layout' && onViewportToggle) onViewportToggle(); return; }
      lastClickTime.current = now;
      if (activePointers.current.size === 1) { 
        lastPos.current = { x, y }; 
        if (!isCommandActive || activeCommandName === 'PAN' || e.button === 1 || e.button === 2) {
            setIsPanning(true);
        } else if (activeCommandName === 'SPLINE' || activeCommandName === 'SKETCH') {
            const wp = screenToWorld(x, y);
            if (onClick) onClick(wp.x, wp.y, !!activeSnapRef.current);
        }
      }
      updateCursorAndSnaps(x, y); redraw();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y});
      
      if (activePointers.current.size === 1) {
          if (isPanning) {
              const dx = x - lastPos.current.x, dy = y - lastPos.current.y;
              if (Math.hypot(x - pointerStartPos.current.x, y - pointerStartPos.current.y) > 2) {
                 const isSelCmd = ['SELECT', 'ERASE', 'MOVE', 'COPYCLIP', 'CUTCLIP', 'STRETCH'].includes(activeCommandName || '');
                 if (((!isCommandActive && activeCommandName !== 'PAN') || isSelCmd) && e.buttons === 1) {
                    const crossing = pointerStartPos.current.x > x;
                    setSelectionRect({ start: pointerStartPos.current, end: {x, y}, crossing });
                    
                    const w1 = screenToWorld(pointerStartPos.current.x, pointerStartPos.current.y);
                    const w2 = screenToWorld(x, y);
                    const selectableShapes = getAllShapesForSelection();
                    const hits = getShapesInRect(w1, w2, selectableShapes, crossing);
                    setHighlightedIds(hits.map(s => s.id));
                 }
                 else setView(v => ({ ...v, originX: v.originX + dx, originY: v.originY + dy }));
              }
          }
          lastPos.current = { x, y };
      } else if (activePointers.current.size === 2) {
          const pts = Array.from(activePointers.current.values()) as Point[];
          const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
          
          if (initialPinchDist.current && initialViewOnPinch.current && worldPointOnPinch.current && initialPanMid.current) {
              const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
              
              // Scale
              const factor = curDist / initialPinchDist.current;
              const newScale = Math.max(0.000001, initialViewOnPinch.current.scale * factor);
              const ts = newScale * settings.drawingScale;
              
              // Origin based on mid point movement (Panning while pinching)
              const newOriginX = midX - w/2 - worldPointOnPinch.current.x * ts;
              const newOriginY = midY - h/2 + worldPointOnPinch.current.y * ts;
              
              setView({ scale: newScale, originX: newOriginX, originY: newOriginY });
          }
      }
      updateCursorAndSnaps(x, y); redraw();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      
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

      if ((activeCommandName === 'SPLINE' || activeCommandName === 'SKETCH') && !selectionRect) {
          // Finish sketching on PointerUp
          const wp = screenToWorld(x, y);
          if (onClick) onClick(wp.x, wp.y, !!activeSnapRef.current);
      } else if (selectionRect) {
          const w1 = screenToWorld(selectionRect.start.x, selectionRect.start.y), w2 = screenToWorld(selectionRect.end.x, selectionRect.end.y);
          const selectableShapes = getAllShapesForSelection();
          const hits = getShapesInRect(w1, w2, selectableShapes, selectionRect.crossing);
          if (onSelectionChange) onSelectionChange(hits.map(s => s.id), e.shiftKey);
          setSelectionRect(null);
          setHighlightedIds([]);
      } else {
          const dx = Math.abs(x - pointerStartPos.current.x), dy = Math.abs(y - pointerStartPos.current.y);
          if (dx < 10 && dy < 10 && activePointers.current.size === 1) {
              const wp = screenToWorld(x, y), snapped = !!activeSnapRef.current;
              const finalP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : wp;
              if (isCommandActive && onClick && activeCommandName !== 'PAN') onClick(finalP.x, finalP.y, snapped);
              else if (activeCommandName !== 'PAN') {
                const ts = view.scale * settings.drawingScale, selectableShapes = getAllShapesForSelection();
                const hit = selectableShapes.find(s => hitTestShape(finalP.x, finalP.y, s, 20/ts, blocks));
                if (onSelectionChange) onSelectionChange(hit ? [hit.id] : [], false);
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

  const handleWheel = (e: React.WheelEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const zoomIn = e.deltaY < 0, factor = zoomIn ? 1.25 : 0.8;
    const wp = screenToWorld(x, y), newScale = Math.max(0.000001, view.scale * factor);
    const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r, ts = newScale * settings.drawingScale;
    const newOriginX = x - w/2 - wp.x * ts, newOriginY = y - h/2 + wp.y * ts;
    setView({ scale: newScale, originX: newOriginX, originY: newOriginY });
  };

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
    <div className="w-full h-full overflow-hidden bg-[#121212] touch-none">
        <canvas ref={canvasRef} className="w-full h-full outline-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel} onContextMenu={e => e.preventDefault()} />
    </div>
  );
});

export default CADCanvas;
