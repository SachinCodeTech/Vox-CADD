
import React, { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { AlertCircle, Ruler, Layers, Activity, ChevronDown, ChevronUp, Eye, EyeOff, X } from 'lucide-react';
import { Shape, ViewState, AppSettings, SnapPoint, LayerConfig, Point, MTextShape, BlockDefinition, LayoutDefinition, LineTypeDefinition, LineType, CtbFile } from '../types';
import { hitTestShape, findBestSnap, formatLength, formatAngle, formatDimensionValue, calculateDimensionValue, getShapesInRect, getShapeBounds, isRectIntersecting, formatDualLength, isShapeClosed, isPointInsideShape, getPolylineOffsetPoints, calculateShapeLength, distance, getAllShapesBounds, projectPointOnLine, calculateArea, getShapeBoundaryPoints, formatDualArea, resolvePointInput } from '../services/cadService';
import { resolveShapeProperties, resolveColor, resolveLineWeight, resolveLineType } from '../services/propertyService';
import { DrawingSpatialIndex } from '../services/spatialIndex';


const MAX_RENDERED_ENTITIES = 15000; // Limit for performance


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
  onClick?: (x: number, y: number, snapped: boolean, shiftKey?: boolean) => void; 
  onMouseMove?: (x: number, y: number, snapped: boolean, shiftKey?: boolean) => void;
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
  onObjectContextMenu?: (x: number, y: number) => void;
  isPlotting?: boolean;
  commandInput?: string;
  aiRecommendation?: string | null;
  isContextMenuOpen?: boolean;
  collaborators?: any[];
  editingBlockName?: string | null;
}

export interface CADCanvasHandle {
  captureImage: () => string;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(({ 
    layers, blocks, lineTypes, layouts, layerConfig, view, setView, settings, isCommandActive, activeTab, 
    isViewportActive = false, activeViewportId, onViewportToggle,
    onMouseMove, onClick, selectedIds = [], highlightIds = [], onSelectionChange, previewShapes,
    activePrompt, basePoint = null, activeCommandName, isAiThinking, lastAiCommandTime, onAction, onCommand,
    setLogMessage, onObjectContextMenu, isPlotting = false,
    commandInput = '',
    aiRecommendation = null,
    isContextMenuOpen = false,
    collaborators = [],
    editingBlockName = null
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useImperativeHandle(ref, () => ({
    captureImage: (options?: { isPlotting?: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      
      // If we are plotting, we should ideally render without non-plottable layers.
      // Since this is a capture, we can create an offscreen canvas.
      if (options?.isPlotting) {
          const r = getPixelRatio();
          const w = canvas.width / r;
          const h = canvas.height / r;
          const offscreen = document.createElement('canvas');
          offscreen.width = canvas.width;
          offscreen.height = canvas.height;
          const ctx = offscreen.getContext('2d', { alpha: false });
          if (ctx) {
              // We need to call the same render logic but with a different context and plottable filtering.
              // To avoid massive code duplication, we'll temporarily set a local flag that isPlotting is true
              // and force a redraw on the main canvas if we really have to, but that flickers.
              
              // Better: just use the main canvas and if isPlotting was passed to the component, it's already filtered!
          }
      }
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ start: Point, end: Point, crossing: boolean } | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [isHudExpanded, setIsHudExpanded] = useState(() => {
    return localStorage.getItem('voxcadd_hud_expanded') !== 'false';
  });
  const [isHudVisible, setIsHudVisible] = useState(() => {
    return localStorage.getItem('voxcadd_hud_visible') !== 'false';
  });
  const [isHudDismissed, setIsHudDismissed] = useState(() => {
    return localStorage.getItem('voxcadd_hud_dismissed') === 'true';
  });
  const [hudPos, setHudPos] = useState({ x: 0, y: 0 });
  const isDraggingHud = useRef(false);
  const dragStartHud = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleHudMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingHud.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setHudPos({ x: clientX - dragStartHud.current.x, y: clientY - dragStartHud.current.y });
    };
    const handleHudEnd = () => {
      isDraggingHud.current = false;
    };
    window.addEventListener('mousemove', handleHudMove);
    window.addEventListener('mouseup', handleHudEnd);
    window.addEventListener('touchmove', handleHudMove, { passive: false });
    window.addEventListener('touchend', handleHudEnd);
    return () => {
      window.removeEventListener('mousemove', handleHudMove);
      window.removeEventListener('mouseup', handleHudEnd);
      window.removeEventListener('touchmove', handleHudMove);
      window.removeEventListener('touchend', handleHudEnd);
    };
  }, []);

  // Sync toolbar HUD toggle to automatically restore stats panel accessibility
  useEffect(() => {
    if (settings.showHUD) {
      setIsHudDismissed(false);
      localStorage.setItem('voxcadd_hud_dismissed', 'false');
      setIsHudVisible(true);
      localStorage.setItem('voxcadd_hud_visible', 'true');
    }
  }, [settings.showHUD]);

  const startDraggingHud = (clientX: number, clientY: number) => {
    isDraggingHud.current = true;
    dragStartHud.current = { x: clientX - hudPos.x, y: clientY - hudPos.y };
  };

  const hudStats = useMemo(() => {
    let totalShapes = 0;
    let totalLength = 0;
    
    if (layers) {
      Object.entries(layers).forEach(([layerId, shapesList]) => {
        const list = shapesList as Shape[];
        if (!list) return;
        totalShapes += list.length;
        
        list.forEach(s => {
          if (s && ['line', 'pline', 'polygon', 'spline', 'dline', 'circle', 'rect', 'arc', 'ellipse'].includes(s.type)) {
            totalLength += calculateShapeLength(s);
          }
        });
      });
    }

    return {
      totalShapes,
      totalLength
    };
  }, [layers]);
  
  const activeRotationBlockId = useRef<string | null>(null);
  const initialBlockAngle = useRef<number>(0);
  const initialPointerAngle = useRef<number>(0);
  const [isRotatingBlock, setIsRotatingBlock] = useState(false);

  const getBlockRotationHandlePos = (s: any) => {
    const ts = view.scale * settings.drawingScale;
    const stickLen = 35 / ts; 
    const angle = (s.rotation || 0) + Math.PI / 2;
    return {
        x: (s.x || 0) + stickLen * Math.cos(angle),
        y: (s.y || 0) + stickLen * Math.sin(angle)
    };
  };

  const trackingPoints = useRef<SnapPoint[]>([]);
  const lastAcquireTime = useRef<number>(0);
  const pointerStartPos = useRef<Point>({ x: 0, y: 0 });
  const lastPos = useRef<Point>({ x: 0, y: 0 });
  const worldCursorRef = useRef<Point>({ x: 0, y: 0 });
  const activeSnapRef = useRef<SnapPoint | null>(null);
  const hoveredShapeRef = useRef<Shape | null>(null);
  const activePointers = useRef<Map<number, Point>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialPanMid = useRef<Point | null>(null);
  const initialViewOnPinch = useRef<ViewState | null>(null);
  const worldPointOnPinch = useRef<Point | null>(null);
  const lastClickTime = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isModel = activeTab === 'model';
  const touchStartCount = useRef<number>(0);

  // Canvas Optimization Layer Refs
  const isViewChangingRef = useRef<boolean>(false);
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenViewRef = useRef<{ scale: number; originX: number; originY: number; w: number; h: number; tab: string } | null>(null);
  const offscreenCacheValidRef = useRef<boolean>(false);

  const getPixelRatio = () => window.devicePixelRatio || 1;
  
  const allRenderableShapes = useMemo(() => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        if (!conf) return true;
        if (isPlotting && conf.plottable === false) return false;
        return conf.visible && !conf.frozen;
    });
  }, [layers, layerConfig, isPlotting]);

  const allSelectableShapes = useMemo(() => {
    return (Object.values(layers).flat() as Shape[]).filter(s => {
        const conf = layerConfig[s.layer];
        if (!conf) return true;
        return conf.visible && !conf.frozen && !conf.locked;
    });
  }, [layers, layerConfig]);

  const renderingSpatialIndex = useMemo(() => {
    return new DrawingSpatialIndex(allRenderableShapes, blocks);
  }, [allRenderableShapes, blocks]);

  const selectionSpatialIndex = useMemo(() => {
    return new DrawingSpatialIndex(allSelectableShapes, blocks);
  }, [allSelectableShapes, blocks]);

  const drawingBoundsMemo = useMemo(() => {
    return getAllShapesBounds(layers, blocks);
  }, [layers, blocks]);

  const getAllShapesForRendering = useCallback(() => allRenderableShapes, [allRenderableShapes]);

  const getAllShapesForSelection = useCallback(() => allSelectableShapes, [allSelectableShapes]);

  const calculateScreenToWorld = (sx: number, sy: number, v: ViewState, w: number, h: number): Point => {
    let ts = v.scale * settings.drawingScale;
    if (isNaN(ts) || !isFinite(ts) || ts <= 1e-12) ts = 1e-12;
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
                
                let vts = vp.viewState.scale;
                if (isNaN(vts) || !isFinite(vts) || vts <= 1e-12) vts = 1e-12;
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
      const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r;
      let ts = view.scale * settings.drawingScale;
      if (isNaN(ts) || !isFinite(ts) || ts <= 1e-12) ts = 1e-12;
      const isModel = activeTab === 'model';

      if (isModel) {
        return { x: wx * ts + w/2 + view.originX, y: -wy * ts + h/2 + view.originY };
      } else {
        if (isViewportActive && activeViewportId) {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp && layout) {
                let vts = vp.viewState.scale;
                if (isNaN(vts) || !isFinite(vts) || vts <= 1e-12) vts = 1e-12;
                
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

  const updateCursorAndSnaps = (x: number, y: number, shiftKey?: boolean, isTouch?: boolean) => {
    const wp = screenToWorld(x, y);
    worldCursorRef.current = wp;
    const ts = view.scale * settings.drawingScale;
    
    // SHIFT key temporarily overrides OSNAP setting
    const osnapActive = shiftKey ? !settings.snap : settings.snap;
    
    if (osnapActive && (activeTab === 'model' || isViewportActive)) {
      const searchRadius = Math.max(0.001, (isTouch ? 55 : 30) / ts);
      const queryBox = {
          xMin: wp.x - searchRadius,
          yMin: wp.y - searchRadius,
          xMax: wp.x + searchRadius,
          yMax: wp.y + searchRadius
      };
      const allRenderable = renderingSpatialIndex.query(queryBox);

      // Maintain tracking points
      const tps = [...trackingPoints.current];
      if (basePoint && !tps.some(p => distance(p, basePoint) < 1/ts)) {
          // Wrap basePoint into a SnapPoint
          tps.push({ x: basePoint.x, y: basePoint.y, type: 'polar' });
      }

      const s = findBestSnap(wp, allRenderable, settings.snapOptions, ts, tps, settings, isTouch);

      // Find hovered shape for translucent dashed line highlight
      const tolerance = 15 / ts; 
      const hovered = allRenderable.find(shape => hitTestShape(wp.x, wp.y, shape, tolerance, blocks));
      hoveredShapeRef.current = hovered || null;

      // Acquire logic: if hover over a snap point for 500ms, toggle tracking
      if (s && ['end', 'mid', 'cen', 'quad', 'int', 'node', 'gcen'].includes(s.type)) {
          if (lastAcquireTime.current === 0) {
              lastAcquireTime.current = Date.now();
          } else if (lastAcquireTime.current > 0 && Date.now() - lastAcquireTime.current > 500) {
              const matchIdx = trackingPoints.current.findIndex(tp => distance(tp, s) < 5/ts);
              if (matchIdx !== -1) {
                  // Release point
                  trackingPoints.current.splice(matchIdx, 1);
                  if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
                  if (setLogMessage) setLogMessage(`RELEASED_POINT: ${s.type.toUpperCase()}`);
              } else {
                  // Acquire point
                  if (trackingPoints.current.length < 8) { // Safety limit
                      trackingPoints.current.push(s);
                      if (navigator.vibrate) navigator.vibrate(10);
                      if (setLogMessage) setLogMessage(`ACQUIRED_POINT: ${s.type.toUpperCase()}`);
                  }
              }
              lastAcquireTime.current = -1; // Mark as processed for this hover
          }
      } else {
          lastAcquireTime.current = 0;
      }

      if (s && !activeSnapRef.current && navigator.vibrate) {
          navigator.vibrate(5); 
      }
      activeSnapRef.current = s;
    } else {
      activeSnapRef.current = null;
      hoveredShapeRef.current = null;
    }
    if (onMouseMove) {
      let targetP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : wp;
      let snapped = !!activeSnapRef.current;
      if (!activeSnapRef.current && settings.gridSnap) {
        const snapS = settings.snapSpacing || settings.gridSpacing || 10;
        if (snapS > 0) {
          if (settings.isometricGrid) {
            const k = Math.round(wp.x / snapS);
            let bestP = { x: wp.x, y: wp.y };
            let minDist = Infinity;
            for (let offset = -1; offset <= 1; offset++) {
              const c = k + offset;
              const m = Math.round(0.5 * ((wp.y * Math.sqrt(3)) / snapS - c));
              const px = c * snapS;
              const py = ((c + 2 * m) * snapS) / Math.sqrt(3);
              const dist = Math.hypot(px - wp.x, py - wp.y);
              if (dist < minDist) {
                minDist = dist;
                bestP = { x: px, y: py };
              }
            }
            targetP = bestP;
            snapped = true;
          } else {
            targetP = {
              x: Math.round(wp.x / snapS) * snapS,
              y: Math.round(wp.y / snapS) * snapS
            };
            snapped = true;
          }
        }
      }
      onMouseMove(targetP.x, targetP.y, snapped, shiftKey);
    }
  };

  useEffect(() => {
    trackingPoints.current = [];
  }, [activeCommandName, isCommandActive]);

  const renderStaticSceneToContext = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, r: number, ts: number) => {
    const isModel = activeTab === 'model';
    ctx.setTransform(r, 0, 0, r, 0, 0);
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
              
              // Custom, optional, customizable border style for layout viewports
              const borderVisible = vp.borderVisible !== false;
              if (borderVisible || isActive) {
                  ctx.save();
                  ctx.strokeStyle = isActive ? "#00bcd4" : (vp.borderColor || "#adadad"); 
                  ctx.lineWidth = isActive ? 1.8 : 1.0;
                  if (vp.borderStyle === 'dashed') {
                      ctx.setLineDash([6, 4]);
                  } else if (vp.borderStyle === 'dotted') {
                      ctx.setLineDash([2, 2]);
                  } else {
                      ctx.setLineDash([]);
                  }
                  ctx.strokeRect(0, 0, vW, vH);
                  ctx.restore();
              }
              
              // Watertight clipping path/stencil to prevent drafting content bleeding
              ctx.beginPath();
              ctx.rect(0, 0, vW, vH);
              ctx.clip();
              
              // Render model space inside viewport
              const vts = vp.viewState.scale * ts;
              // originX and originY are stored in paper units (mm)
              ctx.translate(vW/2 + vp.viewState.originX * ts, vH/2 + vp.viewState.originY * ts);
              ctx.scale(vts, -vts);
              
              const halfVpW = (vp.width / 2) / vp.viewState.scale;
              const halfVpH = (vp.height / 2) / vp.viewState.scale;
              const cx = -vp.viewState.originX;
              const cy = -vp.viewState.originY;
              
              // Add a generous 20% spatial padding so that dimensions, text labels, and 
              // extension boundaries near layout viewport borders do not get clipped
              const padX = halfVpW * 0.20;
              const padY = halfVpH * 0.20;
              const vpBounds = {
                  xMin: cx - halfVpW - padX,
                  yMin: cy - halfVpH - padY,
                  xMax: cx + halfVpW + padX,
                  yMax: cy + halfVpH + padY
              };
              const vShapes = renderingSpatialIndex.query(vpBounds);
              const visibleVShapes = vShapes.slice(0, MAX_RENDERED_ENTITIES);
              visibleVShapes.forEach(s => drawShape(ctx, s, vts));
              
              const layoutPreviewShapes = (window as any).__activePreviewShapes || previewShapes;
              if (isActive && isCommandActive && layoutPreviewShapes) {
                  layoutPreviewShapes.forEach(s => drawShape(ctx, s, vts));
              }
              
              ctx.restore();
          });

          // Render Paper Space Entities (Annotations, Title blocks, etc.)
          if (activeLayout.entities) {
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(ts, -ts);
            ctx.translate(0, -paperH); // DXF paper space: Y up, (0,0) bottom left
            
            activeLayout.entities.forEach(s => drawShape(ctx, s, ts));
            ctx.restore();
          }
      }
    }

    if (isModel) {
      ctx.save(); ctx.translate(w/2 + view.originX, h/2 + view.originY); ctx.scale(ts, -ts);
    
      if (settings.grid) {
        const sMin = calculateScreenToWorld(0, 0, view, w, h);
        const sMax = calculateScreenToWorld(w, h, view, w, h);
        
        let minX = sMin.x;
        let maxX = sMax.x;
        let minY = sMax.y;
        let maxY = sMin.y;

        if (settings.unlimitedGrid === false) {
            const limMinX = Math.min(settings.limitsMin.x, settings.limitsMax.x);
            const limMaxX = Math.max(settings.limitsMin.x, settings.limitsMax.x);
            const limMinY = Math.min(settings.limitsMin.y, settings.limitsMax.y);
            const limMaxY = Math.max(settings.limitsMin.y, settings.limitsMax.y);

            minX = Math.max(minX, limMinX);
            maxX = Math.min(maxX, limMaxX);
            minY = Math.max(minY, limMinY);
            maxY = Math.min(maxY, limMaxY);
        }

        let g = settings.gridSpacing;
        const majorEvery = settings.gridMajorInterval || 5;
        
        // Dynamic coarsening for "graph paper" feel and performance
        const ts_adj = ts;
        while (g * ts_adj < 5) g *= 5;
        
        if (settings.isometricGrid) {
            const left = minX;
            const right = maxX;
            const bottom = minY;
            const top = maxY;

            // 1. Draw Vertical lines
            ctx.lineWidth = 0.5 / ts;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
            ctx.beginPath();
            for (let x = Math.floor(left / g) * g; x <= right; x += g) {
                if (Math.abs(x % (g * majorEvery)) > 0.001 && Math.abs(x) > 0.001) {
                    ctx.moveTo(x, bottom); ctx.lineTo(x, top);
                }
            }
            ctx.stroke();

            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            for (let x = Math.floor(left / (g * majorEvery)) * (g * majorEvery); x <= right; x += (g * majorEvery)) {
                if (Math.abs(x) > 0.001) {
                    ctx.moveTo(x, bottom); ctx.lineTo(x, top);
                }
            }
            ctx.stroke();

            // 2. Draw 30-degree lines (slope = 1 / sqrt(3))
            // Equation: sqrt(3)*y - x = 2*k*g => x = sqrt(3)*y - 2*k*g
            const V1 = Math.sqrt(3) * bottom - left;
            const V2 = Math.sqrt(3) * bottom - right;
            const V3 = Math.sqrt(3) * top - left;
            const V4 = Math.sqrt(3) * top - right;
            const Vmin = Math.min(V1, V2, V3, V4);
            const Vmax = Math.max(V1, V2, V3, V4);

            const kMin = Math.floor(Vmin / (2 * g)) - 1;
            const kMax = Math.ceil(Vmax / (2 * g)) + 1;

            ctx.lineWidth = 0.5 / ts;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
            ctx.beginPath();
            for (let k = kMin; k <= kMax; k++) {
                if (Math.abs(k % majorEvery) !== 0) {
                    ctx.moveTo(Math.sqrt(3) * bottom - 2 * k * g, bottom);
                    ctx.lineTo(Math.sqrt(3) * top - 2 * k * g, top);
                }
            }
            ctx.stroke();

            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            for (let k = kMin; k <= kMax; k++) {
                if (Math.abs(k % majorEvery) === 0) {
                    ctx.moveTo(Math.sqrt(3) * bottom - 2 * k * g, bottom);
                    ctx.lineTo(Math.sqrt(3) * top - 2 * k * g, top);
                }
            }
            ctx.stroke();

            // 3. Draw 150-degree lines (slope = -1 / sqrt(3))
            // Equation: sqrt(3)*y + x = 2*m*g => x = 2*m*g - sqrt(3)*y
            const W1 = Math.sqrt(3) * bottom + left;
            const W2 = Math.sqrt(3) * bottom + right;
            const W3 = Math.sqrt(3) * top + left;
            const W4 = Math.sqrt(3) * top + right;
            const Wmin = Math.min(W1, W2, W3, W4);
            const Wmax = Math.max(W1, W2, W3, W4);

            const mMin = Math.floor(Wmin / (2 * g)) - 1;
            const mMax = Math.ceil(Wmax / (2 * g)) + 1;

            ctx.lineWidth = 0.5 / ts;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
            ctx.beginPath();
            for (let m = mMin; m <= mMax; m++) {
                if (Math.abs(m % majorEvery) !== 0) {
                    ctx.moveTo(2 * m * g - Math.sqrt(3) * bottom, bottom);
                    ctx.lineTo(2 * m * g - Math.sqrt(3) * top, top);
                }
            }
            ctx.stroke();

            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            for (let m = mMin; m <= mMax; m++) {
                if (Math.abs(m % majorEvery) === 0) {
                    ctx.moveTo(2 * m * g - Math.sqrt(3) * bottom, bottom);
                    ctx.lineTo(2 * m * g - Math.sqrt(3) * top, top);
                }
            }
            ctx.stroke();

            // 4. Main Axes (subtle layout)
            ctx.strokeStyle = "rgba(0, 188, 212, 0.3)"; // Subtle Cyan for Origin
            ctx.beginPath();
            if (0 >= left && 0 <= right) { ctx.moveTo(0, bottom); ctx.lineTo(0, top); }
            if (0 >= bottom && 0 <= top) { ctx.moveTo(left, 0); ctx.lineTo(right, 0); }
            ctx.stroke();
        } else {
            // Minor Grid Lines
            ctx.lineWidth = 0.5 / ts;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
            ctx.beginPath();
            for(let x=Math.floor(minX/g)*g; x<=maxX; x+=g){ 
                if (Math.abs(x % (g * majorEvery)) > 0.001 && Math.abs(x) > 0.001) {
                    ctx.moveTo(x, minY); ctx.lineTo(x, maxY); 
                }
            }
            for(let y=Math.floor(minY/g)*g; y<=maxY; y+=g){ 
                if (Math.abs(y % (g * majorEvery)) > 0.001 && Math.abs(y) > 0.001) {
                    ctx.moveTo(minX, y); ctx.lineTo(maxX, y); 
                }
            }
            ctx.stroke();

            // Major Grid Lines
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            for(let x=Math.floor(minX/(g * majorEvery))*(g * majorEvery); x<=maxX; x+=(g * majorEvery)){
                if (Math.abs(x) > 0.001) {
                    ctx.moveTo(x, minY); ctx.lineTo(x, maxY);
                }
            }
            for(let y=Math.floor(minY/(g * majorEvery))*(g * majorEvery); y<=maxY; y+=(g * majorEvery)){
                if (Math.abs(y) > 0.001) {
                    ctx.moveTo(minX, y); ctx.lineTo(maxX, y);
                }
            }
            ctx.stroke();

            // Main Axes (Origin Lines)
            ctx.strokeStyle = "rgba(0, 188, 212, 0.3)"; // Subtle Cyan for Origin
            ctx.beginPath();
            if (0 >= minX && 0 <= maxX) { ctx.moveTo(0, minY); ctx.lineTo(0, maxY); }
            if (0 >= minY && 0 <= maxY) { ctx.moveTo(minX, 0); ctx.lineTo(maxX, 0); }
            ctx.stroke();
        }
      }

      if (editingBlockName) {
        const radius = 10 / ts;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
        ctx.lineWidth = 1.8 / ts;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-20 / ts, 0); ctx.lineTo(20 / ts, 0);
        ctx.moveTo(0, -20 / ts); ctx.lineTo(0, 20 / ts);
        ctx.stroke();

        ctx.save();
        ctx.scale(1, -1);
        ctx.font = `bold ${10 / ts}px monospace`;
        ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
        ctx.textAlign = "center";
        ctx.fillText("BLOCK INSERTION ORIGIN (0,0)", 0, - (24 / ts));
        if (settings.snap) {
          ctx.font = `${8 / ts}px monospace`;
          ctx.fillStyle = "rgba(16, 185, 129, 0.65)";
          ctx.fillText(`GRID SNAP ACTIVE`, 0, - (36 / ts));
        }
        ctx.restore();
      }
    
      const renderable = getAllShapesForRendering();
      
      const sMin = calculateScreenToWorld(0, 0, view, w, h);
      const sMax = calculateScreenToWorld(w, h, view, w, h);
      const rawXMin = Math.min(sMin.x, sMax.x);
      const rawYMin = Math.min(sMin.y, sMax.y);
      const rawXMax = Math.max(sMin.x, sMax.x);
      const rawYMax = Math.max(sMin.y, sMax.y);
      const padX = (rawXMax - rawXMin) * 0.20;
      const padY = (rawYMax - rawYMin) * 0.20;
      
      const viewportBounds = { 
          xMin: rawXMin - padX, 
          yMin: rawYMin - padY, 
          xMax: rawXMax + padX, 
          yMax: rawYMax + padY 
      };
      
      const visibleShapes = renderingSpatialIndex.query(viewportBounds);
      const optimizedVisibleShapes = visibleShapes.slice(0, MAX_RENDERED_ENTITIES);

      optimizedVisibleShapes.forEach(s => {
          drawShape(ctx, s, ts);
      });
      ctx.restore();
    }
  }, [activeTab, layouts, view, settings, isViewportActive, activeViewportId, renderingSpatialIndex, previewShapes, isCommandActive, layers, blocks, allRenderableShapes]);

  const renderDynamicOverlays = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, r: number, ts: number) => {
    const isModel = activeTab === 'model';
    ctx.setTransform(r, 0, 0, r, 0, 0);

    const sMin = calculateScreenToWorld(0, 0, view, w, h);
    const sMax = calculateScreenToWorld(w, h, view, w, h);
    const rawXMin = Math.min(sMin.x, sMax.x);
    const rawYMin = Math.min(sMin.y, sMax.y);
    const rawXMax = Math.max(sMin.x, sMax.x);
    const rawYMax = Math.max(sMin.y, sMax.y);
    const padX = (rawXMax - rawXMin) * 0.20;
    const padY = (rawYMax - rawYMin) * 0.20;

    const viewportBounds = { 
        xMin: rawXMin - padX, 
        yMin: rawYMin - padY, 
        xMax: rawXMax + padX, 
        yMax: rawYMax + padY 
    };
    const visibleShapes = renderingSpatialIndex.query(viewportBounds);

    if (isModel) {
      ctx.save(); ctx.translate(w/2 + view.originX, h/2 + view.originY); ctx.scale(ts, -ts);

      if (activeSnapRef.current) drawSnapMarker(ctx, activeSnapRef.current, ts, w, h);
      const mainPreviewShapes = (window as any).__activePreviewShapes || previewShapes;
      if (mainPreviewShapes) mainPreviewShapes.forEach(s => drawShape(ctx, s, ts));

      // 1. OBJECT HOVER snaps assist (translucent dashed line highlight)
      if (hoveredShapeRef.current) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
          ctx.shadowColor = "rgba(0, 240, 255, 0.4)";
          ctx.shadowBlur = 4;
          ctx.lineWidth = 2.0 / ts;
          ctx.setLineDash([6 / ts, 4 / ts]);
          
          const hs = hoveredShapeRef.current;
          ctx.beginPath();
          if (hs.type === 'line') {
              ctx.moveTo(hs.x1, hs.y1);
              ctx.lineTo(hs.x2, hs.y2);
              ctx.stroke();
          } else if (hs.type === 'circle') {
              ctx.arc(hs.x, hs.y, hs.radius, 0, Math.PI * 2);
              ctx.stroke();
          } else if (hs.type === 'rect') {
              ctx.rect(hs.x, hs.y, hs.width, hs.height);
              ctx.stroke();
          } else if (hs.type === 'arc') {
              ctx.arc(hs.x, hs.y, hs.radius, hs.startAngle, hs.endAngle, !hs.counterClockwise);
              ctx.stroke();
          } else if (hs.type === 'pline' || hs.type === 'polygon' || hs.type === 'spline') {
              const pts = hs.points || [];
              if (pts.length > 1) {
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (let i = 1; i < pts.length; i++) {
                      ctx.lineTo(pts[i].x, pts[i].y);
                  }
                  if (hs.closed || hs.type === 'polygon') ctx.closePath();
                  ctx.stroke();
              }
          } else if (hs.type === 'ellipse') {
              ctx.ellipse(hs.x, hs.y, hs.rx, hs.ry, hs.rotation || 0, 0, Math.PI * 2);
              ctx.stroke();
          }
          ctx.restore();
      }
      
      // 2. AREA SHADING for closed selected shapes
      const tsSafeForShade = Math.max(1e-4, ts);
      visibleShapes.filter(shape => selectedIds.includes(shape.id) && isShapeClosed(shape)).forEach(shape => {
          const pts = getShapeBoundaryPoints(shape);
          if (pts && pts.length > 2) {
              ctx.save();
              ctx.fillStyle = "rgba(0, 188, 212, 0.16)"; // soft modern translucent cyan shading
              ctx.beginPath();
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) {
                  ctx.lineTo(pts[i].x, pts[i].y);
              }
              ctx.closePath();
              ctx.fill();
              
              ctx.strokeStyle = "rgba(0, 188, 212, 0.4)";
              ctx.lineWidth = 1.2 / tsSafeForShade;
              ctx.stroke();
              ctx.restore();
          }
      });
      visibleShapes.filter(s => selectedIds.includes(s.id)).forEach(s => drawGrips(ctx, s, ts));

      // Perpendicular and Tangent Feedback lines and symbols
      if (activeSnapRef.current && (activeSnapRef.current.type === 'perp' || activeSnapRef.current.type === 'tan') && activeSnapRef.current.lastPoint) {
          const snap = activeSnapRef.current;
          const lp = snap.lastPoint;
          const tsSafe = Math.max(1e-4, ts);
          ctx.save();
          ctx.strokeStyle = snap.type === 'perp' ? "rgba(16, 185, 129, 0.75)" : "rgba(236, 72, 153, 0.75)";
          ctx.lineWidth = 1.5/tsSafe;
          ctx.setLineDash([6/tsSafe, 6/tsSafe]);
          ctx.beginPath();
          ctx.moveTo(lp.x, lp.y);
          ctx.lineTo(snap.x, snap.y);
          ctx.stroke();

          // Render explicit feedback symbols at snap
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.strokeStyle = snap.type === 'perp' ? "#10b981" : "#ec4899";
          if (snap.type === 'perp') {
              const dx = lp.x - snap.x;
              const dy = lp.y - snap.y;
              const len = Math.sqrt(dx*dx + dy*dy);
              if (len > 0.001) {
                  const ux = dx / len;
                  const uy = dy / len;
                  const symSize = 8 / tsSafe;
                  const px = -uy;
                  const py = ux;
                  ctx.moveTo(snap.x + ux * symSize, snap.y + uy * symSize);
                  ctx.lineTo(snap.x + ux * symSize + px * symSize, snap.y + uy * symSize + py * symSize);
                  ctx.lineTo(snap.x + px * symSize, snap.y + py * symSize);
              }
          } else {
              // tangent indicator contact circle
              ctx.arc(snap.x, snap.y, 4 / tsSafe, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(236, 72, 153, 0.8)";
              ctx.fill();
          }
          ctx.stroke();
          ctx.restore();
      }

      // Polar / Tracking Line
      if (activeSnapRef.current && activeSnapRef.current.type === 'polar' && activeSnapRef.current.lastPoint) {
          const snap = activeSnapRef.current;
          const lp = snap.lastPoint;
          const tsSafe = Math.max(1e-4, ts);
          ctx.save();
          ctx.strokeStyle = "rgba(0, 188, 212, 0.6)"; 
          ctx.lineWidth = 1/tsSafe;
          ctx.setLineDash([10/tsSafe, 10/tsSafe]);
          ctx.beginPath();
          ctx.moveTo(lp.x, lp.y);
          ctx.lineTo(snap.x, snap.y);
          // Extend slightly past the snap point for better visual
          const dx = snap.x - lp.x, dy = snap.y - lp.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len > 0) {
              const ux = dx/len, uy = dy/len;
              ctx.lineTo(snap.x + ux * (20/tsSafe), snap.y + uy * (20/tsSafe));
          }
          ctx.stroke();
          ctx.restore();
          
          // Draw tooltip for angle/distance in screen coordinates to prevent division by zero or huge font sizes crashing the tab!
          if (len > 0) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const posAngle = (angle + 360) % 360;
            const label = `${len.toFixed(1)} < ${posAngle.toFixed(1)}°`;
            
            ctx.save();
            ctx.setTransform(r, 0, 0, r, 0, 0); // stable screen space
            
            const screenPos = worldToScreen(snap.x, snap.y);
            
            ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
            const tw = ctx.measureText(label).width;
            
            const padX = 6;
            const padY = 3;
            const rectW = tw + padX * 2;
            const rectH = 14;
            
            const bx = screenPos.x + 12;
            const by = screenPos.y - 18;
            
            ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(bx, by, rectW, rectH, 3);
            } else {
              ctx.rect(bx, by, rectW, rectH);
            }
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(0, 188, 212, 0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#00bcd4';
            ctx.fillText(label, bx + padX, by + 10.5);
            ctx.restore();
          }
      }
      ctx.restore();
    }

    if (isModel) {
      drawUCS(ctx, w, h);
    }

    // Tracking markers & Alignment Lines (OTRACK)
    if (isCommandActive && trackingPoints.current.length > 0) {
        ctx.save();
        const tsSafe = Math.max(1e-4, ts);
        ctx.setTransform(ts, 0, 0, -ts, w/2 + view.originX, h/2 + view.originY);
        
        ctx.lineWidth = 0.8/tsSafe;
        ctx.setLineDash([6/tsSafe, 6/tsSafe]);
        
        trackingPoints.current.forEach(tp => {
            // Draw OTRACK marker (Small cyan +)
            ctx.strokeStyle = "#22d3ee";
            const size = 3/tsSafe;
            ctx.beginPath();
            ctx.moveTo(tp.x - size, tp.y); ctx.lineTo(tp.x + size, tp.y);
            ctx.moveTo(tp.x, tp.y - size); ctx.lineTo(tp.x, tp.y + size);
            ctx.stroke();

            // Draw full alignment lines if they intersect with cursor projected onto them
            // This makes it feel much more like AutoCAD
            const drawInfinite = (p1: Point, p2: Point) => {
                const proj = projectPointOnLine(worldCursorRef.current, p1, p2);
                if (distance(worldCursorRef.current, proj) < 20/tsSafe) {
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
                    // Calculate ends of line based on viewport visibility or just large enough
                    const dx = p2.x - p1.x, dy = p2.y - p1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    if (len > 0) {
                        const ux = dx/len, uy = dy/len;
                        ctx.moveTo(tp.x - ux * 10000, tp.y - uy * 10000);
                        ctx.lineTo(tp.x + ux * 10000, tp.y + uy * 10000);
                        ctx.stroke();
                    }
                }
            };

            // H/V
            drawInfinite(tp, { x: tp.x + 1, y: tp.y });
            drawInfinite(tp, { x: tp.x, y: tp.y + 1 });

            // Polar
            if (settings.polarTrackingEnabled) {
                (settings.polarAngles || [45, 90]).forEach(ang => {
                    const step = ang;
                    for (let a = 0; a < 360; a += step) {
                        const r = a * Math.PI / 180;
                        drawInfinite(tp, { x: tp.x + Math.cos(r), y: tp.y + Math.sin(r) });
                    }
                });
            }
        });
        ctx.restore();
    }

    // Real-time Coordinate Input Preview Ghost
    if (isCommandActive && commandInput && commandInput.trim() !== '') {
        const pGhost = resolvePointInput(commandInput, basePoint || null, settings, worldCursorRef.current);
        if (pGhost && !isNaN(pGhost.x) && !isNaN(pGhost.y)) {
            const screenGhost = worldToScreen(pGhost.x, pGhost.y);

            ctx.save();
            ctx.setTransform(r, 0, 0, r, 0, 0); // stable screen space for overlay label

            // 1. Draw a prominent blinking target crosshair & circle at the parsed point
            const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
            ctx.strokeStyle = `rgba(236, 72, 153, ${0.7 + pulse * 0.3})`; // neon pink pulse
            ctx.lineWidth = 2;
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(screenGhost.x, screenGhost.y, 8, 0, Math.PI * 2);
            ctx.stroke();

            // Draw outer dashed circle
            ctx.save();
            ctx.strokeStyle = `rgba(236, 72, 153, ${0.4 + pulse * 0.3})`;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.arc(screenGhost.x, screenGhost.y, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Draw center cross hair of the target
            ctx.beginPath();
            ctx.moveTo(screenGhost.x - 12, screenGhost.y);
            ctx.lineTo(screenGhost.x + 12, screenGhost.y);
            ctx.moveTo(screenGhost.x, screenGhost.y - 12);
            ctx.lineTo(screenGhost.x, screenGhost.y + 12);
            ctx.stroke();

            // 2. Draw a dashed connector line from basePoint (clicked origin) to pGhost
            if (basePoint) {
                const screenBase = worldToScreen(basePoint.x, basePoint.y);
                ctx.save();
                ctx.strokeStyle = "rgba(236, 72, 153, 0.45)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(screenBase.x, screenBase.y);
                ctx.lineTo(screenGhost.x, screenGhost.y);
                ctx.stroke();
                ctx.restore();
            }

            // 3. Draw a floating text label displaying the coordinates and relationship
            ctx.font = '700 10px "JetBrains Mono", "Fira Code", monospace';
            let label = `GHOST POINT: (${formatLength(pGhost.x, settings)}, ${formatLength(pGhost.y, settings)})`;
            if (basePoint) {
                const dist = distance(basePoint, pGhost);
                const angle = Math.atan2(pGhost.y - basePoint.y, pGhost.x - basePoint.x) * 180 / Math.PI;
                const posAngle = (angle + 360) % 360;
                label += ` [Offset: ${formatLength(dist, settings)} < ${posAngle.toFixed(1)}°]`;
            }
            
            const tw = ctx.measureText(label).width;
            const padX = 8;
            const padY = 4;
            const rectW = tw + padX * 2;
            const rectH = 18;
            const bx = screenGhost.x + 15;
            const by = screenGhost.y - 35;

            // Draw background pill
            ctx.fillStyle = 'rgba(17, 12, 18, 0.9)'; // rich dark plum background
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(bx, by, rectW, rectH, 4);
            } else {
                ctx.rect(bx, by, rectW, rectH);
            }
            ctx.fill();

            // Border
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Text
            ctx.fillStyle = '#f472b6'; // pastel pink
            ctx.fillText(label, bx + padX, by + 12);

            ctx.restore();
        }
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
    ctx.strokeStyle = isModel ? `rgba(255, 255, 255, 0.5)` : `rgba(0,0,0,0.5)`; 
    ctx.lineWidth = 1.0; ctx.beginPath();
    
    // Crosshair lines
    ctx.moveTo(screenPos.x, 0); ctx.lineTo(screenPos.x, h);
    ctx.moveTo(0, screenPos.y); ctx.lineTo(w, screenPos.y);
    ctx.stroke();
    
    // Pickbox in center
    ctx.lineWidth = 1.0;
    ctx.strokeRect(screenPos.x - 6, screenPos.y - 6, 12, 12);
    
    if (settings.showHUD) {
        const text = `${formatLength(targetWorldP.x, settings)}, ${formatLength(targetWorldP.y, settings)}`;
        
        ctx.font = '700 10px "JetBrains Mono", "Fira Code", monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
        ctx.beginPath(); ctx.roundRect(screenPos.x + 15, screenPos.y - 28, tw + 20, 22, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(0, 188, 212, 0.4)'; ctx.stroke();
        ctx.fillStyle = '#00bcd4'; ctx.fillText(text, screenPos.x + 25, screenPos.y - 13);
    }

    // Floating Area Tooltip near cursor
    let areaTooltipText: string | null = null;
    const activePreview = (window as any).__activePreviewShapes || previewShapes;
    const measuringAreaShape = activePreview?.find(shape => shape.closed && shape.points && shape.points.length > 2);
    if (measuringAreaShape) {
        const areaVal = calculateArea(measuringAreaShape.points);
        const { primary, secondary } = formatDualArea(areaVal, settings);
        areaTooltipText = `Area: ${primary} (${secondary})`;
    } else {
        const selectedClosed = visibleShapes.find(shape => selectedIds.includes(shape.id) && isShapeClosed(shape));
        if (selectedClosed) {
            const areaVal = calculateArea(getShapeBoundaryPoints(selectedClosed));
            const { primary, secondary } = formatDualArea(areaVal, settings);
            areaTooltipText = `Area: ${primary} (${secondary})`;
        }
    }

    if (areaTooltipText) {
        ctx.font = '700 10px "JetBrains Mono", "Fira Code", monospace';
        const tw = ctx.measureText(areaTooltipText).width;
        const rectW = tw + 20;
        const rectH = 22;
        // Float beneath the standard coordinates HUD if both are showing
        const offsetY = settings.showHUD ? 4 : -28;
        
        ctx.fillStyle = 'rgba(10, 10, 12, 0.92)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(screenPos.x + 15, screenPos.y + offsetY, rectW, rectH, 4);
        } else {
            ctx.rect(screenPos.x + 15, screenPos.y + offsetY, rectW, rectH);
        }
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(areaTooltipText, screenPos.x + 25, screenPos.y + offsetY + 15);
    }

    // Collaborative Cursors & Workspace Highlights
    if (collaborators && collaborators.length > 0) {
        collaborators.forEach(p => {
            const peerScreen = worldToScreen(p.x, p.y);
            
            // Draw Peer Selection highlights
            if (p.selection && p.selection.length > 0) {
                p.selection.forEach((shpId: string) => {
                    const sh = visibleShapes.find(s => s.id === shpId);
                    if (sh) {
                        const bounds = getShapeBounds(sh);
                        if (bounds) {
                            const minS = worldToScreen(bounds.xMin, bounds.yMin);
                            const maxS = worldToScreen(bounds.xMax, bounds.yMax);
                            
                            ctx.save();
                            ctx.strokeStyle = p.color || '#ff007f';
                            ctx.lineWidth = 1.0;
                            ctx.setLineDash([3, 3]);
                            ctx.strokeRect(
                                Math.min(minS.x, maxS.x) - 4,
                                Math.min(minS.y, maxS.y) - 4,
                                Math.abs(maxS.x - minS.x) + 8,
                                Math.abs(maxS.y - minS.y) + 8
                            );
                            
                            // Small peer label tab
                            ctx.font = '700 7.5px "Inter", sans-serif';
                            const tagText = `${p.name} active`;
                            const tagW = ctx.measureText(tagText).width;
                            ctx.fillStyle = p.color || '#ff007f';
                            ctx.fillRect(Math.min(minS.x, maxS.x) - 4, Math.min(minS.y, maxS.y) - 13, tagW + 6, 9);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(tagText, Math.min(minS.x, maxS.x) - 1, Math.min(minS.y, maxS.y) - 6);
                            ctx.restore();
                        }
                    }
                });
            }

            // Draw Peer Cursor pointer arrow
            ctx.save();
            ctx.fillStyle = p.color || '#ff007f';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            
            ctx.beginPath();
            ctx.moveTo(peerScreen.x, peerScreen.y);
            ctx.lineTo(peerScreen.x + 10, peerScreen.y + 11);
            ctx.lineTo(peerScreen.x + 4, peerScreen.y + 11);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Name tab
            ctx.font = '700 8.5px "Inter", sans-serif';
            const nameW = ctx.measureText(p.name).width;
            ctx.fillStyle = p.color || '#ff007f';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 3;
            
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(peerScreen.x + 10, peerScreen.y + 8, nameW + 12, 14, 3);
            } else {
                ctx.rect(peerScreen.x + 10, peerScreen.y + 8, nameW + 12, 14);
            }
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(p.name, peerScreen.x + 16, peerScreen.y + 18);
            ctx.restore();
        });
    }

    ctx.restore();
  }, [activeTab, view, settings, isCommandActive, previewShapes, selectedIds, isAiThinking, lastAiCommandTime, selectionRect, renderingSpatialIndex, collaborators]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    if (canvas.width <= 0 || canvas.height <= 0) return;
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
    if (!ctx || !view) return;
    const r = getPixelRatio(), w = canvas.width/r, h = canvas.height/r, ts = view.scale * settings.drawingScale;
    if (w <= 0 || h <= 0) return;
    
    const isModel = activeTab === 'model';
    const cache = offscreenCanvasRef.current;
    const cachedView = offscreenViewRef.current;
    let usedCache = false;

    // Use offscreen buffer fast coordinate-scaling & copy during active pan/zoom 
    if (isViewChangingRef.current && cache && cache.width > 0 && cache.height > 0 && cachedView && cachedView.tab === activeTab && cachedView.w === w && cachedView.h === h && offscreenCacheValidRef.current) {
      ctx.setTransform(r, 0, 0, r, 0, 0); 
      ctx.fillStyle = isModel ? "#0a0a0c" : "#333"; ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // resets to pixel coordinate space
      
      const ts1 = view.scale * settings.drawingScale;
      const ts0 = cachedView.scale * settings.drawingScale;
      const ratio = ts1 / ts0;
      
      const dx = -ratio * (w * r / 2 + cachedView.originX * r) + w * r / 2 + view.originX * r;
      const dy = -ratio * (h * r / 2 + cachedView.originY * r) + h * r / 2 + view.originY * r;
      
      if (cache.width > 0 && cache.height > 0) {
        ctx.drawImage(cache, dx, dy, w * r * ratio, h * r * ratio);
      }
      ctx.restore();
      usedCache = true;
    }

    // Refresh of high-resolution cache when the view stabilizes or geometry dictates
    if (!usedCache) {
      if (!cache || cache.width !== canvas.width || cache.height !== canvas.height) {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        if (canvas.width > 0 && canvas.height > 0) {
          offscreenCanvasRef.current.width = canvas.width;
          offscreenCanvasRef.current.height = canvas.height;
        }
      }
      
      const octx = offscreenCanvasRef.current!.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      renderStaticSceneToContext(octx, w, h, r, ts);

      offscreenViewRef.current = {
        scale: view.scale,
        originX: view.originX,
        originY: view.originY,
        w,
        h,
        tab: activeTab
      };
      offscreenCacheValidRef.current = true;

      // Copy completed high-resolution offscreen buffer 1:1 on screens
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (offscreenCanvasRef.current && offscreenCanvasRef.current.width > 0 && offscreenCanvasRef.current.height > 0) {
        ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
      ctx.restore();
    }

    // Overlay real-time dynamic graphics (Cursor, snaps, alignment tracking, marquees)
    renderDynamicOverlays(ctx, w, h, r, ts);
  }, [view, settings, activeTab, renderStaticSceneToContext, renderDynamicOverlays]);;

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
        case 'dimension': case 'leader': drawBox(s.x1, s.y1); drawBox(s.x2, s.y2); if (s.type === 'dimension') drawBox((s as any).dimX, (s as any).dimY); break;
    }
    ctx.restore();
  };

  const drawPolyline = (ctx: CanvasRenderingContext2D, points: Point[], closed?: boolean) => {
    if (points.length < 1) return;
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const nextIdx = (i + 1) % points.length;
        if (nextIdx === 0 && !closed) break;
        const p2 = points[nextIdx];
        
        if (p1.bulge && Math.abs(p1.bulge) > 0.0001) {
            const b = p1.bulge;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist > 0.0001) {
                const s = dist / 2;
                const h = b * s;
                const r = (s * s + h * h) / (2 * h);
                
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const ux = (p2.x - p1.x) / dist;
                const uy = (p2.y - p1.y) / dist;
                
                const bulgeSign = b > 0 ? 1 : -1;
                const centerX = midX - (r - h) * uy * bulgeSign;
                const centerY = midY + (r - h) * ux * bulgeSign;
                
                const startAngle = Math.atan2(p1.y - centerY, p1.x - centerX);
                const endAngle = Math.atan2(p2.y - centerY, p2.x - centerX);
                
                ctx.arc(centerX, centerY, Math.abs(r), startAngle, endAngle, b < 0);
            } else {
                ctx.lineTo(p2.x, p2.y);
            }
        } else {
            ctx.lineTo(p2.x, p2.y);
        }
    }
    if (closed) ctx.closePath();
  };

  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape, ts: number, blockContext?: { color: string, thickness: number, lineType: LineType }) => {
    const isSafe = (v: number) => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e12;
    const isS = selectedIds.includes(s.id), isH = highlightIds.includes(s.id) || highlightedIds.includes(s.id);
    const conf = layerConfig[s.layer]; 
    if (!s.isPreview && conf && (!conf.visible || conf.frozen)) return;
    
    // LOD: Skip tiny text
    if ((s.type === 'text' || s.type === 'mtext') && s.size * ts < 2) return;

    // Resolve properties correctly using the new property service
    const activeCtb = settings.showCtbInView && settings.activeCtbId && settings.ctbFiles ? settings.ctbFiles[settings.activeCtbId] : undefined;
    const resolved = resolveShapeProperties(
        s,
        layerConfig,
        blocks,
        activeCtb,
        isPlotting,
        blockContext,
        activeTab
    );

    ctx.save(); ctx.beginPath();
    
    let baseColor = resolved.color;
    if (s.isPreview && isCommandActive) {
        const currentLayerConf = layerConfig[settings.currentLayer];
        baseColor = currentLayerConf?.color || "#FFFFFF";
    }
    
    // Ensure weight is a number (handles 'DEFAULT' if it leaked through)
    let weight = typeof resolved.lineweight === 'number' ? resolved.lineweight : 0.25;
    
    // Explicitly override to layerConfig.thickness if weight is bylayer/default or not explicitly a number
    const layerConf = layerConfig[s.layer];
    if (layerConf && typeof layerConf.thickness === 'number') {
        if (!s.thickness || s.thickness === 'bylayer' || s.thickness === 'DEFAULT' || typeof s.thickness !== 'number') {
            weight = layerConf.thickness;
        }
    }
    
    // Special case for double lines - use inherited weight but handle potential stale data or 'DEFAULT'
    if (s.type === 'dline') {
        const dweight = conf?.thickness;
        if (typeof dweight === 'number') weight = dweight;
        else if (typeof dweight === 'string' && dweight !== 'DEFAULT') weight = parseFloat(dweight) || 0.25;
        else weight = 0.25;
    }

    let finalThickness = weight;
    if (settings.showLineWeights) {
        // Improved weight mapping for clearer display
        // 0.00 treated as hairline (super thin)
        // Others scaled using a more distinctive function
        if (weight <= 0.001) {
            finalThickness = 0.20; // Slightly thickened hairline for better visibility
        } else {
            // Smoother non-linear mapping
            // weight 0.05 -> ~0.5
            // weight 0.25 -> ~1.8
            finalThickness = Math.pow(weight, 0.7) * 4.5 + 0.15;
        }
    } else if (!isS && !isH && !s.isPreview) {
        finalThickness = 1.0;
    }

    if (s.isPreview) { 
        ctx.strokeStyle = baseColor; 
        ctx.setLineDash([6/ts, 4/ts]); 
        ctx.globalAlpha = 0.5; 
        ctx.lineWidth = 1.2/ts; 
        if (s.type === 'dline') ctx.lineWidth = 2.0/ts;
    }
    else if (isS) { 
        ctx.strokeStyle = baseColor; 
        const minLw = (weight <= 0.001) ? 0.25/ts : 0.6/ts;
        ctx.lineWidth = Math.max(minLw + 1.2/ts, (finalThickness + 1.2)/ts); 
        ctx.setLineDash([4/ts, 4/ts]); 
    }
    else if (isH) { 
        ctx.strokeStyle = baseColor; 
        const minLw = (weight <= 0.001) ? 0.25/ts : 0.6/ts;
        ctx.lineWidth = Math.max(minLw + 0.6/ts, (finalThickness + 0.6)/ts); 
        ctx.setLineDash([6/ts, 6/ts]); 
    }
    else { 
        ctx.strokeStyle = baseColor; 
        ctx.globalAlpha = resolved.opacity;
        if (conf?.locked) ctx.globalAlpha *= 0.6; // Increased from 0.45 for better visibility        // Ensure even hairline is visible at any zoom
        const minLw = (weight <= 0.001) ? 0.25/ts : 0.6/ts;
        ctx.lineWidth = Math.max(minLw, finalThickness/ts); 
    }
    
    // Line Type implementation
    const currentLineType = resolved.lineType.toLowerCase();
    
    // Global and entity-specific line type scales
    const globalLtScale = (settings.drawingScale || 1.0) * (settings.ltScale || 1.0);
    const entityLtScale = s.lineScale || 1.0;
    const finalLtScale = globalLtScale * entityLtScale;

    const drawComplexLine = (points: Point[], type: string) => {
        if (points.length < 2) return;
        
        // Base size in model units: e.g. 10 units
        // But we want it to be at least N pixels on screen for visibility
        const minPixels = 15;
        const L = Math.max(10 * finalLtScale, minPixels / ts); 
        
        ctx.beginPath();
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx);
            if (type === 'zigzag') {
                const segCount = Math.floor(dist / (L * 1.5));
                const segLen = dist / (segCount || 1);
                ctx.moveTo(p1.x, p1.y);
                for (let j = 0; j < segCount; j++) {
                    const base = j * segLen;
                    const h = L / 2.2;
                    // Standard Zigzag: Line, Up-Down Peak, Line
                    const x1 = p1.x + Math.cos(angle) * (base + segLen * 0.4);
                    const y1 = p1.y + Math.sin(angle) * (base + segLen * 0.4);
                    const xPeak = p1.x + Math.cos(angle) * (base + segLen * 0.5);
                    const yPeak = p1.y + Math.sin(angle) * (base + segLen * 0.5);
                    const x2 = xPeak + Math.cos(angle + Math.PI/2) * h;
                    const y2 = yPeak + Math.sin(angle + Math.PI/2) * h;
                    const x3 = xPeak + Math.cos(angle + Math.PI/2) * (-h);
                    const y3 = yPeak + Math.sin(angle + Math.PI/2) * (-h);
                    const x4 = p1.x + Math.cos(angle) * (base + segLen * 0.6);
                    const y4 = p1.y + Math.sin(angle) * (base + segLen * 0.6);
                    
                    ctx.lineTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.lineTo(x3, y3);
                    ctx.lineTo(x4, y4);
                    ctx.lineTo(p1.x + Math.cos(angle) * (base + segLen), p1.y + Math.sin(angle) * (base + segLen));
                }
            } else if (type === 'zigzag2') {
                 const segCount = Math.floor(dist / L);
                 const segLen = dist / (segCount || 1);
                 ctx.moveTo(p1.x, p1.y);
                 for (let j = 0; j < segCount; j++) {
                     const base = j * segLen;
                     const h = L / 2;
                     const mx = p1.x + Math.cos(angle) * (base + segLen/2) + Math.cos(angle + Math.PI/2) * (h * (j % 2 === 0 ? 1 : -1));
                     const my = p1.y + Math.sin(angle) * (base + segLen/2) + Math.sin(angle + Math.PI/2) * (h * (j % 2 === 0 ? 1 : -1));
                     ctx.lineTo(mx, my);
                     ctx.lineTo(p1.x + Math.cos(angle) * (base + segLen), p1.y + Math.sin(angle) * (base + segLen));
                 }
            } else if (type === 'tracks') {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                const segCount = Math.floor(dist / (L/1.5));
                const segLen = dist / (segCount || 1);
                const h = L / 4;
                for (let j = 0; j <= segCount; j++) {
                    const bx = p1.x + Math.cos(angle) * (j * segLen);
                    const by = p1.y + Math.sin(angle) * (j * segLen);
                    ctx.moveTo(bx + Math.cos(angle + Math.PI/2) * h, by + Math.sin(angle + Math.PI/2) * h);
                    ctx.lineTo(bx - Math.cos(angle + Math.PI/2) * h, by - Math.sin(angle + Math.PI/2) * h);
                }
            } else if (type === 'batt') {
                 const segCount = Math.floor(dist / (L * 0.8));
                 const segLen = dist / (segCount || 1);
                 ctx.moveTo(p1.x, p1.y);
                 for (let j = 0; j < segCount; j++) {
                     const base = j * segLen;
                     const h = L / 3;
                     for (let phase = 0; phase <= Math.PI * 2; phase += 0.4) {
                         const px = p1.x + Math.cos(angle) * (base + (phase / (Math.PI * 2)) * segLen) + Math.cos(angle + Math.PI/2) * (Math.sin(phase) * h);
                         const py = p1.y + Math.sin(angle) * (base + (phase / (Math.PI * 2)) * segLen) + Math.sin(angle + Math.PI/2) * (Math.sin(phase) * h);
                         ctx.lineTo(px, py);
                     }
                 }
            } else if (type === 'fenceline') {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                const segCount = Math.floor(dist / (L * 1.5));
                const segLen = dist / (segCount || 1);
                const r = L / 6;
                for (let j = 1; j < segCount; j++) {
                    const bx = p1.x + Math.cos(angle) * (j * segLen);
                    const by = p1.y + Math.sin(angle) * (j * segLen);
                    ctx.moveTo(bx + r, by);
                    ctx.arc(bx, by, r, 0, Math.PI * 2);
                }
            } else if (type === 'gasline' || type === 'hotwater') {
                const label = type === 'gasline' ? 'GAS' : 'HW';
                const segLen = L * 6;
                const segCount = Math.floor(dist / segLen);
                const actualSegLen = dist / (segCount || 1);
                ctx.moveTo(p1.x, p1.y);
                for (let j = 0; j < segCount; j++) {
                    const bx = p1.x + Math.cos(angle) * (j * actualSegLen);
                    const by = p1.y + Math.sin(angle) * (j * actualSegLen);
                    const ex = p1.x + Math.cos(angle) * ((j + 1) * actualSegLen);
                    const ey = p1.y + Math.sin(angle) * ((j + 1) * actualSegLen);
                    
                    // Draw segment with gap for text
                    const gapStart = actualSegLen * 0.4;
                    const gapEnd = actualSegLen * 0.6;
                    
                    ctx.lineTo(p1.x + Math.cos(angle) * (j * actualSegLen + gapStart), p1.y + Math.sin(angle) * (j * actualSegLen + gapStart));
                    ctx.moveTo(p1.x + Math.cos(angle) * (j * actualSegLen + gapEnd), p1.y + Math.sin(angle) * (j * actualSegLen + gapEnd));
                    ctx.lineTo(ex, ey);
                    
                    // Draw Label
                    ctx.save();
                    ctx.translate(p1.x + Math.cos(angle) * (j * actualSegLen + actualSegLen * 0.5), p1.y + Math.sin(angle) * (j * actualSegLen + actualSegLen * 0.5));
                    let tAngle = angle;
                    if (tAngle > Math.PI/2 || tAngle < -Math.PI/2) tAngle += Math.PI;
                    ctx.rotate(tAngle);
                    ctx.scale(1, -1);
                    ctx.font = `bold ${L/2.5}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                    ctx.moveTo(ex, ey);
                }
            }
        }
        ctx.stroke();
    };

    const isComplexLT = ['zigzag', 'tracks', 'batt', 'fenceline', 'zigzag2', 'gasline', 'hotwater'].includes(currentLineType);

    if (currentLineType !== 'continuous' && !s.isPreview && !isH && !isS && !isComplexLT) {
        const ltDef = lineTypes[currentLineType];
        
        // Base scale for line types to be visually distinct
        const baseLTScale = 12.0; 
        
        if (ltDef && ltDef.pattern && ltDef.pattern.length > 0) {
            // Apply scale to pattern based on drawing scale and zoom
            // To be "accurate especially when scaled", we use model space but ensure a minimum pixel size
            const minDashPixels = 4;
            const scaledPattern = ltDef.pattern.map(p => {
                const modelSize = p * finalLtScale * baseLTScale;
                return Math.max(modelSize, minDashPixels / ts);
            }); 
            ctx.setLineDash(scaledPattern);
        } else {
            // Fallback for legacy names if not found in lineTypes map
            // Use same scaling logic
            const L = Math.max(2.0 * finalLtScale * baseLTScale, 10 / ts); 
    
            if (currentLineType === 'dashed') ctx.setLineDash([L * 2.0, L * 1.5]);
            else if (currentLineType === 'dotted') ctx.setLineDash([1/ts, L * 1.0]);
            else if (currentLineType === 'center') ctx.setLineDash([L * 6, L * 1.5, L * 1, L * 1.5]);
            else if (currentLineType === 'dashdot') ctx.setLineDash([L * 5, L * 1.5, L * 0.8, L * 1.5]);
            else if (currentLineType === 'border') ctx.setLineDash([L * 8, L * 1.5, L * 2.5, L * 1.5]);
            else if (currentLineType === 'divide') ctx.setLineDash([L * 4, L * 1, L * 1, L * 1, L * 1, L * 1]);
            else if (currentLineType === 'phantom') ctx.setLineDash([L * 8, L * 1.2, L * 1.2, L * 1.2, L * 1.2, L * 1.2]);
            else if (currentLineType === 'hidden') ctx.setLineDash([L * 1.2, L * 1.2]);
            else if (currentLineType === 'gasLine') ctx.setLineDash([L * 12, L * 4, L * 1.5, L * 4]);
            else if (currentLineType === 'fenceLine') ctx.setLineDash([L * 8, L * 1.2, L * 1.2, L * 1.2]);
            else if (currentLineType === 'hotwater') ctx.setLineDash([L * 7, L * 2, L * 1, L * 2, L * 1, L * 2]);
            else if (currentLineType === 'zigzag2') ctx.setLineDash([L * 2, L * 1]);
            else if (currentLineType === 'dots2') ctx.setLineDash([1/ts, L * 0.5]);
            else if (currentLineType === 'dash2') ctx.setLineDash([L * 1, L * 1]);
        }
    }

    const processText = (txt: string) => {
        if (!txt) return '';
        // Robust MTEXT/TEXT code cleaning
        return txt
            .replace(/%%c/gi, 'Ø')
            .replace(/%%d/gi, '°')
            .replace(/%%p/gi, '±')
            .replace(/\\P/g, '\n')
            .replace(/\\U\+([0-9A-F]{4})/gi, (match, grp) => String.fromCharCode(parseInt(grp, 16))) // Unicode
            .replace(/\{\\f[^;]*?;/g, '') // Formatting font
            .replace(/\{\\A[^;]*?;/g, '') // Formatting alignment
            .replace(/\{\\H[^;]*?;/g, '') // Formatting height
            .replace(/\{\\C[^;]*?;/g, '') // Formatting color
            .replace(/\\(A|C|f|H|S|T|Q|W).*?;/g, '') // MText control codes ending in ;
            .replace(/\\L/g, '') // Underline
            .replace(/\\l/g, '')
            .replace(/\\O/g, '') // Overline
            .replace(/\\o/g, '')
            .replace(/\\~ /g, ' ') // Non-breaking space
            .replace(/\{|}/g, '');
    };

    const drawArrowhead = (size: number, type: string = 'closed') => {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = ctx.strokeStyle;
        if (type === 'tick') {
            ctx.moveTo(-size/2, -size/2); ctx.lineTo(size/2, size/2);
            ctx.stroke();
        } else if (type === 'dot') {
            ctx.arc(0, 0, size/4, 0, Math.PI * 2); ctx.fill();
        } else if (type === 'open') {
            ctx.moveTo(size, size/3); ctx.lineTo(0, 0); ctx.lineTo(size, -size/3);
            ctx.stroke();
        } else {
            ctx.moveTo(size, size/4); ctx.lineTo(0, 0); ctx.lineTo(size, -size/4); 
            ctx.closePath(); 
            ctx.fill();
        }
        ctx.restore();
    };

    switch (s.type) {
      case 'line': 
        if (isSafe(s.x1) && isSafe(s.y1) && isSafe(s.x2) && isSafe(s.y2)) {
            ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); 
        }
        break;
      case 'circle': 
        if (isSafe(s.x) && isSafe(s.y) && isSafe(s.radius)) {
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); 
        }
        break;
      case 'rect': 
        if (isSafe(s.x) && isSafe(s.y) && isSafe(s.width) && isSafe(s.height)) {
            ctx.rect(s.x, s.y, s.width, s.height); 
        }
        break;
      case 'arc': 
        if (isSafe(s.x) && isSafe(s.y) && isSafe(s.radius)) {
            ctx.arc(s.x, s.y, s.radius, s.startAngle, s.endAngle, !s.counterClockwise); 
        }
        break;
      case 'ellipse': 
        if (isSafe(s.x) && isSafe(s.y)) {
            ctx.ellipse(s.x, s.y, s.rx, s.ry, s.rotation, 0, Math.PI * 2); 
        }
        break;
      case 'donut': 
        if (isSafe(s.x) && isSafe(s.y)) {
            ctx.arc(s.x, s.y, s.outerRadius, 0, Math.PI * 2);
            ctx.moveTo(s.x + s.innerRadius, s.y);
            ctx.arc(s.x, s.y, s.innerRadius, 0, Math.PI * 2, true);
        }
        break;
      case 'hatch':
        const hLoops = s.loops || (s.points ? [s.points] : []);
        if (hLoops.length > 0) {
          ctx.save();
          ctx.beginPath();
          hLoops.forEach(loop => {
              if (loop.length > 2) drawPolyline(ctx, loop, true);
          });
          ctx.clip();
          // Use first loop's points for bounding box estimation if needed, 
          // or pass all loops to drawHatchPattern
          drawHatchPattern(ctx, s.pattern, hLoops[0], s.scale || 1, s.rotation || 0, ts);
          ctx.restore();
          
          // Render boundary
          ctx.beginPath();
          hLoops.forEach(loop => {
              if (loop.length > 2) drawPolyline(ctx, loop, true);
          });
          ctx.stroke();
          ctx.restore();
          return;
        }
        break;
      case 'ray': {
          if (isSafe(s.x1) && isSafe(s.y1)) {
              const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
              const len = Math.sqrt(dx*dx + dy*dy);
              if (len > 0) {
                ctx.moveTo(s.x1, s.y1);
                ctx.lineTo(s.x1 + (dx/len) * 1e6, s.y1 + (dy/len) * 1e6);
              }
          }
          break;
      }
      case 'xline': {
          if (isSafe(s.x1) && isSafe(s.y1)) {
              const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
              const len = Math.sqrt(dx*dx + dy*dy);
              if (len > 0) {
                  ctx.moveTo(s.x1 - (dx/len) * 1e6, s.y1 - (dy/len) * 1e6);
                  ctx.lineTo(s.x1 + (dx/len) * 1e6, s.y1 + (dy/len) * 1e6);
              }
          }
          break;
      }
      case 'section': {
        if (isSafe(s.x1) && isSafe(s.y1) && isSafe(s.x2) && isSafe(s.y2)) {
            ctx.save();
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
            ctx.restore();

            const dx = s.x2 - s.x1;
            const dy = s.y2 - s.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.1) {
                const ux = dx / len;
                const uy = dy / len;
                const px = -uy;
                const py = ux;

                const baseH = (settings.drawingScale || 1.0) * 1.65;
                const arrowLen = baseH * 3.5;
                const arrowWid = baseH * 1.5;

                const drawSectionMarker = (x: number, y: number, perpX: number, perpY: number, label: string) => {
                    const fx = x + perpX * arrowLen;
                    const fy = y + perpY * arrowLen;

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(fx, fy);
                    ctx.stroke();

                    ctx.save();
                    ctx.translate(fx, fy);
                    ctx.rotate(Math.atan2(perpY, perpX));
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-arrowWid, -arrowWid / 2);
                    ctx.lineTo(-arrowWid, arrowWid / 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();

                    ctx.save();
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.font = `bold ${baseH * 2.5}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const tx = x + perpX * (arrowLen * 1.5);
                    const ty = y + perpY * (arrowLen * 1.5);

                    ctx.beginPath();
                    ctx.arc(tx, ty, baseH * 1.8, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillText(label || 'A', tx, ty);
                    ctx.restore();
                };

                drawSectionMarker(s.x1, s.y1, px, py, (s as any).tag);
                drawSectionMarker(s.x2, s.y2, px, py, (s as any).tag);
            }
        }
        break;
      }
      case 'dimension': {
          const ds = settings.dimStyles[s.styleId || 'standard'] || settings.dimStyles['standard'] || {
            arrowSize: 2.5, textSize: 2.5, textOffset: 0.6, extendLine: 1.25, offsetLine: 0.6, precision: 2
          };
          
          // Use size from shape (if parsed from DWG) or from style
          // User suggestion: Text height = Drawing scale * 1.65
          const defaultH = (settings.drawingScale || 1.0) * 1.65;
          const rawSize = s.size || s.height || ds.textSize || defaultH;
          
          // Compute adaptive auto-scale factor depending on general drawing bounds size vs raw text size
          let finalDimScale = 1.0;
          const shapesBounds = drawingBoundsMemo;
          if (shapesBounds) {
              const drawingSize = Math.max(shapesBounds.xMax - shapesBounds.xMin, shapesBounds.yMax - shapesBounds.yMin);
              if (drawingSize > 1.0) {
                  const optimalTextH = drawingSize * 0.016; // 1.6% of overall drawing extents
                  const currentTextH = rawSize * finalDimScale;
                  if (currentTextH > drawingSize * 0.032 || currentTextH < drawingSize * 0.005) {
                      finalDimScale = optimalTextH / rawSize;
                  }
              }
          }

          const finalDimTextSize = rawSize * finalDimScale;
          // Scale arrow size in direct proportion to visual text size to prevent bloating in imported drawings
          const rawArrowS = (s.size ? s.size * 0.72 : (ds.arrowSize || rawSize * 0.72)) * (ds.arrowScale || 1.0) * finalDimScale;
          const arrowS = Math.max(finalDimTextSize * 0.15, Math.min(finalDimTextSize * 0.32, rawArrowS * 0.32));
          const tOffset = (s.size ? s.size * 0.4 : (ds.textOffset || defaultH * 0.4)) * finalDimScale;

          const measuredValue = calculateDimensionValue(s, s.dimX, s.dimY);
          const rawText = s.text || '<>';
          const dimValueText = s.dimType === 'angular' ? formatAngle(measuredValue, settings) : formatDimensionValue(measuredValue, ds, settings);
          const dimText = processText(rawText.replace('<>', dimValueText));

          if (s.dimType === 'radius' || s.dimType === 'diameter') {
              const cx = s.cx ?? s.x1;
              const cy = s.cy ?? s.y1;
              const dx = s.x2 - cx, dy = s.y2 - cy;
              const angle = Math.atan2(dy, dx);
              const r = Math.sqrt(dx*dx + dy*dy);
              
              ctx.beginPath();
              ctx.moveTo(cx, cy); 
              ctx.lineTo(s.x2, s.y2);
              ctx.stroke();
              
              ctx.save();
              ctx.translate(s.x2, s.y2); ctx.rotate(angle + Math.PI);
              drawArrowhead(arrowS, ds.arrowType);
              ctx.restore();

              if (s.dimType === 'diameter') {
                  const x3 = cx - dx, y3 = cy - dy;
                  ctx.beginPath();
                  ctx.moveTo(cx, cy); ctx.lineTo(x3, y3);
                  ctx.stroke();
                  ctx.save();
                  ctx.translate(x3, y3); ctx.rotate(angle);
                  drawArrowhead(arrowS, ds.arrowType);
                  ctx.restore();
              }

              ctx.save();
              const tx = s.dimX || (cx + s.x2) / 2;
              const ty = s.dimY || (cy + s.y2) / 2;
              ctx.translate(tx, ty);
              let tAngle = angle;
              if (tAngle > Math.PI/2) tAngle -= Math.PI;
              if (tAngle < -Math.PI/2) tAngle += Math.PI;
              ctx.rotate(tAngle); ctx.scale(1, -1);
              ctx.font = `bold ${finalDimTextSize}px "JetBrains Mono", monospace`; 
              ctx.textAlign = 'center'; 
              ctx.textBaseline = 'middle';
              
              const metrics = ctx.measureText(dimText);
              ctx.fillStyle = isModel ? "#0a0a0c" : "#ffffff";
              ctx.fillRect(-metrics.width/2 - 2, -finalDimTextSize/2 - 1, metrics.width + 4, finalDimTextSize + 2);
              ctx.fillStyle = baseColor; 
              ctx.fillText(dimText, 0, 0);
              ctx.restore();
              break;
          }

          if (s.dimType === 'angular' || s.dimType === 'arc') {
              const cx = s.cx ?? s.x1;
              const cy = s.cy ?? s.y1;
              const dx = s.dimX - cx, dy = s.dimY - cy;
              const r = Math.sqrt(dx*dx + dy*dy);
              
              const a1 = s.angle1 || 0;
              const a2 = s.angle2 || 0;
              
              // Calculate correct sweep direction to pass through dimX, dimY
              const dimAngle = Math.atan2(dy, dx);
              
              // Normalize angles
              const normalize = (a: number) => {
                  let res = a % (Math.PI * 2);
                  if (res < 0) res += Math.PI * 2;
                  return res;
              };
              
              const na1 = normalize(a1);
              const na2 = normalize(a2);
              const ndim = normalize(dimAngle);
              
              let start = na1;
              let end = na2;
              let anticlockwise = false;
              
              // Check if ndim is between na1 and na2 in CCW or CW sense
              const isBetweenCCW = (a: number, s: number, e: number) => {
                  if (s <= e) return a >= s && a <= e;
                  return a >= s || a <= e;
              };
              
              if (isBetweenCCW(ndim, na1, na2)) {
                  start = na1; end = na2; anticlockwise = false;
              } else {
                  start = na1; end = na2; anticlockwise = true;
              }
              
              // Draw the arc dimension line
              ctx.beginPath();
              ctx.arc(cx, cy, r, start, end, anticlockwise);
              ctx.stroke();

              // Draw arrows
              const drawDimArrow = (ang: number, isStart: boolean) => {
                  ctx.save();
                  ctx.translate(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
                  // Arrow needs to be tangent to arc. Normal is rad vector
                  // Tangent is normal + PI/2. 
                  const tangent = ang + (anticlockwise ? (isStart ? -Math.PI/2 : Math.PI/2) : (isStart ? Math.PI/2 : -Math.PI/2));
                  ctx.rotate(tangent);
                  drawArrowhead(arrowS, ds.arrowType);
                  ctx.restore();
              };
              
              drawDimArrow(start, true);
              drawDimArrow(end, false);

              // Text position - midpoint of the arc used
              let mid = (start + end) / 2;
              if (Math.abs(end - start) > Math.PI && !anticlockwise) mid += Math.PI;
              if (Math.abs(end - start) < Math.PI && anticlockwise) mid += Math.PI;
              
              const tx = cx + (r + (ds.textPlacement === 'above' ? finalDimTextSize : 0)) * Math.cos(mid);
              const ty = cy + (r + (ds.textPlacement === 'above' ? finalDimTextSize : 0)) * Math.sin(mid);
              
              ctx.save();
              ctx.translate(tx, ty);
              let tAngle = mid + Math.PI/2;
              if (tAngle > Math.PI/2) tAngle -= Math.PI;
              if (tAngle < -Math.PI/2) tAngle += Math.PI;
              ctx.rotate(tAngle); ctx.scale(1, -1);
              ctx.font = `bold ${finalDimTextSize}px "JetBrains Mono", monospace`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              // Mask
              const metrics = ctx.measureText(dimText);
              ctx.fillStyle = isModel ? "#0a0a0c" : "#ffffff";
              ctx.fillRect(-metrics.width/2 - 2, -finalDimTextSize/2 - 1, metrics.width + 4, finalDimTextSize + 2);
              
              ctx.fillStyle = baseColor;
              ctx.fillText(dimText, 0, 0);
              ctx.restore();
              break;
          }

          if (s.dimType === 'ordinate') {
              const dx = Math.abs(s.x2 - s.x1), dy = Math.abs(s.y2 - s.y1);
              const isX = dx > dy;
              ctx.beginPath();
              ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
              ctx.stroke();
              ctx.save();
              ctx.translate(s.x2, s.y2); ctx.scale(1, -1);
              ctx.font = `bold ${finalDimTextSize}px "JetBrains Mono", monospace`; 
              ctx.textAlign = (isX ? 'left' : 'center') as CanvasTextAlign; 
              ctx.textBaseline = (isX ? 'middle' : 'bottom') as CanvasTextBaseline;
              ctx.fillStyle = baseColor;
              ctx.fillText(dimText, isX ? tOffset : 0, isX ? 0 : -tOffset);
              ctx.restore();
              break;
          }
          
          // Fallback safeguards for unpopulated or NaN dimension points
          if (typeof s.x1 !== 'number' || isNaN(s.x1)) s.x1 = 0;
          if (typeof s.y1 !== 'number' || isNaN(s.y1)) s.y1 = 0;
          if (typeof s.x2 !== 'number' || isNaN(s.x2)) s.x2 = s.x1 + 10;
          if (typeof s.y2 !== 'number' || isNaN(s.y2)) s.y2 = s.y1;
          if (typeof s.dimX !== 'number' || isNaN(s.dimX)) s.dimX = (s.x1 + s.x2) / 2;
          if (typeof s.dimY !== 'number' || isNaN(s.dimY)) s.dimY = (s.y1 + s.y2) / 2 + 15;

          let dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          let d_len = Math.sqrt(dx * dx + dy * dy);
          if (d_len === 0) break;

          if (s.dimType === 'linear') {
             const mx = (s.x1 + s.x2)/2, my = (s.y1 + s.y2)/2;
             const vdx = Math.abs(s.dimX - mx), vdy = Math.abs(s.dimY - my);
             if (vdx > vdy) { dx = 0; d_len = Math.abs(dy); } else { dy = 0; d_len = Math.abs(dx); }
          }
          
          if (d_len === 0) break;

          const ux = dx / d_len, uy = dy / d_len;
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

          ctx.beginPath();
          ctx.moveTo(ex1x, ex1y); ctx.lineTo(px2, py2);
          ctx.moveTo(s.x1 + nx * ds.offsetLine * sign, s.y1 + ny * ds.offsetLine * sign);
          ctx.lineTo(ex1x + nx * ds.extendLine * sign, ex1y + ny * ds.extendLine * sign);
          ctx.moveTo(s.x2 + nx * ds.offsetLine * sign, s.y2 + ny * ds.offsetLine * sign);
          ctx.lineTo(px2 + nx * ds.extendLine * sign, py2 + ny * ds.extendLine * sign);
          ctx.stroke();

          const angle = Math.atan2(py2 - ex1y, px2 - ex1x);
          ctx.save(); ctx.translate(ex1x, ex1y); ctx.rotate(angle); drawArrowhead(arrowS, ds.arrowType); ctx.restore();
          ctx.save(); ctx.translate(px2, py2); ctx.rotate(angle + Math.PI); drawArrowhead(arrowS, ds.arrowType); ctx.restore();
          
          ctx.save();
          let placementOffset = 0;
          if (ds.textPlacement === 'above') placementOffset = (tOffset + finalDimTextSize/2);
          else if (ds.textPlacement === 'below') placementOffset = -(tOffset + finalDimTextSize/2);
          else placementOffset = (tOffset + finalDimTextSize/2); 
          
          if (ds.textPlacement === 'center') placementOffset = 0;

          const mx = (ex1x + px2) / 2 + nx * placementOffset * sign;
          const my = (ex1y + py2) / 2 + ny * placementOffset * sign;
          ctx.translate(mx, my);
          let tAngle = angle;
          if (tAngle > Math.PI/2) tAngle -= Math.PI;
          if (tAngle < -Math.PI/2) tAngle += Math.PI;
          ctx.rotate(tAngle); ctx.scale(1, -1);
          ctx.font = `bold ${finalDimTextSize}px "JetBrains Mono", "Fira Code", monospace`; 
          ctx.textAlign = 'center'; 
          ctx.textBaseline = 'middle';
          
          // Always mask dimension text for better readability against drawing lines
          const metrics = ctx.measureText(dimText);
          const padX = finalDimTextSize * 0.4;
          const padY = finalDimTextSize * 0.2;
          ctx.fillStyle = isModel ? "#0a0a0c" : "#ffffff";
          ctx.fillRect(-metrics.width/2 - padX, -finalDimTextSize/2 - padY, metrics.width + padX*2, finalDimTextSize + padY*2);

          ctx.fillStyle = baseColor; 
          ctx.fillText(dimText, 0, 0);
          ctx.restore();
          break;
      }
      case 'point': {
          const size = 3 / ts; 
          ctx.save();
          ctx.setLineDash([]); // Ensure points are always solid
          ctx.lineWidth = 1 / ts;
          ctx.moveTo(s.x - size, s.y); ctx.lineTo(s.x + size, s.y);
          ctx.moveTo(s.x, s.y - size); ctx.lineTo(s.x, s.y + size);
          ctx.stroke();
          ctx.restore();
          break;
      }
      case 'pline': case 'poly': case 'polygon': case 'spline':
        if(s.points && s.points.length > 0) {
            let normalizedPoints: Point[] = [];
            if (typeof s.points[0] === 'number') {
                for(let i=0; i<s.points.length; i+=2) {
                    normalizedPoints.push({ x: s.points[i], y: s.points[i+1] });
                }
            } else {
                normalizedPoints = s.points as Point[];
            }

            if (s.type === 'spline' && normalizedPoints.length > 2) {
                ctx.moveTo(normalizedPoints[0].x, normalizedPoints[0].y);
                for (let i = 1; i < normalizedPoints.length - 2; i++) {
                    const xc = (normalizedPoints[i].x + normalizedPoints[i + 1].x) / 2;
                    const yc = (normalizedPoints[i].y + normalizedPoints[i + 1].y) / 2;
                    ctx.quadraticCurveTo(normalizedPoints[i].x, normalizedPoints[i].y, xc, yc);
                }
                const n = normalizedPoints.length;
                ctx.quadraticCurveTo(normalizedPoints[n-2].x, normalizedPoints[n-2].y, normalizedPoints[n-1].x, normalizedPoints[n-1].y);
            } else {
                drawPolyline(ctx, normalizedPoints, !!(s.closed || s.type === 'polygon'));
            }

            if (s.fill || s.filled) {
                ctx.save();
                ctx.fillStyle = ctx.strokeStyle + '22'; // Transparent fill
                ctx.fill();
                ctx.restore();
            }
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
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
          ctx.stroke();
          
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const a = Math.atan2(dy, dx);
          
          // Use proportion setup centered on active dimension style features
          const ds = settings.dimStyles[settings.activeDimStyle] || settings.dimStyles['standard'] || {
            arrowSize: 2.5, textSize: 2.5, textOffset: 0.6, extendLine: 1.25, offsetLine: 0.6, precision: 2
          };
          
          const defaultH = (settings.drawingScale || 1.0) * 1.65;
          const rawSize = s.size || s.height || ds.textSize || defaultH;
          
          let finalDimScale = 1.0;
          const shapesBounds = drawingBoundsMemo;
          if (shapesBounds) {
              const drawingSize = Math.max(shapesBounds.xMax - shapesBounds.xMin, shapesBounds.yMax - shapesBounds.yMin);
              if (drawingSize > 1.0) {
                  const optimalTextH = drawingSize * 0.016; // 1.6% of overall drawing extents
                  const currentTextH = rawSize * finalDimScale;
                  if (currentTextH > drawingSize * 0.032 || currentTextH < drawingSize * 0.005) {
                      finalDimScale = optimalTextH / rawSize;
                  }
              }
          }

          const finalDimTextSize = rawSize * finalDimScale;
          const rawArrowS = (s.size ? s.size * 0.72 : (ds.arrowSize || rawSize * 0.72)) * (ds.arrowScale || 1.0) * finalDimScale;
          const arrowS = Math.max(finalDimTextSize * 0.15, Math.min(finalDimTextSize * 0.32, rawArrowS * 0.32));
          
          ctx.save();
          ctx.translate(s.x1, s.y1);
          ctx.rotate(a);
          drawArrowhead(arrowS, s.arrowType || 'closed');
          ctx.restore();
          break;
      }
      case 'text':
      case 'mtext':
        ctx.save(); 
        ctx.translate(s.x, s.y); 
        
        let rAngle = (s as any).rotation || s.rotation || 0;
        // AutoCAD DXF stores text rotation in degrees. We convert to radians if it's in degrees.
        if (Math.abs(rAngle) > 2 * Math.PI) {
            rAngle = rAngle * Math.PI / 180;
        }
        if (rAngle) ctx.rotate(-rAngle); 
        ctx.scale(1,-1); 
        
        const weight = (s as any).bold ? 'bold' : '400';
        const style = (s as any).italic ? 'italic' : 'normal';
        
        // AutoCAD Font Mapping supporting CAD-standard typography
        const cadFontMap: Record<string, string> = {
            'simplex': 'Courier Prime',
            'romans': 'Rajdhani',
            'roman': 'Times New Roman',
            'romand': 'Outfit',
            'romanS': 'Rajdhani',
            'complex': 'Pathway Gothic One',
            'txt': 'JetBrains Mono',
            'standard': 'Inter',
            'italic': 'Inter',
            'bold': 'Inter',
            'arial': 'Arial',
            'arial ms unicode': 'Arial Unicode MS',
            'arial unicode ms': 'Arial Unicode MS',
            'isocp': 'Saira Condensed',
            'isocp2': 'Saira Condensed',
            'isoct': 'Chakra Petch',
            'isoct2': 'Chakra Petch',
            'monotxt': 'Major Mono Display',
            'arvo': 'Arvo',
            'anton': 'Anton',
            'oswald': 'Oswald',
            'rubik': 'Rubik',
            'pacifico': 'Pacifico',
            'poppins': 'Poppins',
            'montserrat': 'Montserrat',
            'roboto': 'Roboto',
            'raleway': 'Raleway',
            'lato': 'Lato',
            'opensans': 'Open Sans',
            'work-sans': 'Work Sans',
            'space-grotesk': 'Space Grotesk',
            'outfit': 'Outfit',
            'syne': 'Syne',
            'ibm-plex-sans': 'IBM Plex Sans',
            'ibm-plex-mono': 'IBM Plex Mono',
            'comfortaa': 'Comfortaa'
        };
        
        const rawFont = (s as any).fontFamily || 'standard';
        let fontName = cadFontMap[rawFont.toLowerCase()] || rawFont;
        if (rawFont.toLowerCase().endsWith('.shx')) {
            const baseFont = rawFont.substring(0, rawFont.length - 4).toLowerCase();
            fontName = cadFontMap[baseFont] || baseFont;
        }
        const textSize = s.size || 2.5;
        
        ctx.font=`${style} ${weight} ${textSize}px "${fontName}", sans-serif, monospace`; 
        ctx.fillStyle=ctx.strokeStyle; 
        
        const ap = (s as any).attachmentPoint || (s as any).attachment_point || 1;
        const aligns: Record<number, {h: CanvasTextAlign, v: CanvasTextBaseline}> = {
            1: {h: 'left', v: 'top'}, 2: {h: 'center', v: 'top'}, 3: {h: 'right', v: 'top'},
            4: {h: 'left', v: 'middle'}, 5: {h: 'center', v: 'middle'}, 6: {h: 'right', v: 'middle'},
            7: {h: 'left', v: 'bottom'}, 8: {h: 'center', v: 'bottom'}, 9: {h: 'right', v: 'bottom'}
        };
        const align = aligns[ap] || {h: (s.justification || 'left') as CanvasTextAlign, v: 'alphabetic'};
        ctx.textAlign = align.h;
        ctx.textBaseline = align.v;

        if (s.type === 'mtext') {
            const rawContent = processText(s.content);
            const textSize = s.size || 2.5;
            let lines: string[] = [];
            
            if (s.width > 0) {
                const paragraphs = rawContent.split('\n');
                paragraphs.forEach(para => {
                    if (!para.trim() && paragraphs.length > 1) {
                        lines.push('');
                        return;
                    }
                    const words = para.split(' ');
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
                    if (currentLine) lines.push(currentLine);
                });
            } else {
                lines = rawContent.split('\n');
            }

            const lineSpacing = 1.25;
            const totalH = lines.length * textSize * lineSpacing;
            const xOffset = s.width > 0 ? (align.h === 'center' ? s.width/2 : align.h === 'right' ? s.width : 0) : 0;
            
            // Adjust start Y based on vertical alignment using a unified, middle-referenced system
            let yBase = 0;
            if (align.v === 'top') {
                yBase = textSize * 0.5;
            } else if (align.v === 'middle') {
                yBase = -totalH / 2 + textSize * 0.5;
            } else { // bottom or alphabetic
                yBase = -totalH + textSize * 0.5;
            }
            ctx.textBaseline = 'middle';
            ctx.textAlign = align.h;
            
            lines.forEach((line, i) => {
                const ly = yBase + i * textSize * lineSpacing;
                
                if ((s as any).highlight) {
                    const tw = ctx.measureText(line).width;
                    let hx = xOffset;
                    if (align.h === 'center') hx -= tw/2;
                    else if (align.h === 'right') hx -= tw;
                    ctx.save();
                    // Custom highlighter color support
                    const hColor = (s as any).highlightColor || 'rgba(254, 240, 138, 0.9)';
                    ctx.fillStyle = hColor;
                    
                    // Slightly larger box for better coverage
                    ctx.fillRect(hx - 2, ly - textSize * 0.85, tw + 4, textSize * 1.2);
                    ctx.restore();
                }
                
                ctx.fillText(line, xOffset, ly);
                
                if ((s as any).underline) {
                    const tw = ctx.measureText(line).width;
                    let ux = xOffset;
                    if (align.h === 'center') ux -= tw/2;
                    else if (align.h === 'right') ux -= tw;
                    ctx.fillRect(ux, ly + textSize * 0.15, tw, Math.max(1, textSize/12));
                }

                if ((s as any).strikethrough) {
                    const tw = ctx.measureText(line).width;
                    let sx = xOffset;
                    if (align.h === 'center') sx -= tw/2;
                    else if (align.h === 'right') sx -= tw;
                    ctx.fillRect(sx, ly - textSize * 0.3, tw, Math.max(1, textSize/12));
                }
            });
        } else {
            const content = processText(s.content);
            const textSize = s.size || 2.5;
            if ((s as any).highlight) {
                const tw = ctx.measureText(content).width;
                let hx = 0;
                if (align.h === 'center') hx -= tw/2;
                else if (align.h === 'right') hx -= tw;
                ctx.save();
                const hColor = (s as any).highlightColor || 'rgba(255, 235, 59, 0.45)';
                ctx.fillStyle = hColor;
                if (hColor.startsWith('#')) {
                    ctx.globalAlpha = 0.45;
                }
                ctx.shadowBlur = 4;
                ctx.shadowColor = hColor;
                ctx.fillRect(hx - 2, -textSize * 0.35, tw + 4, textSize * 0.75);
                ctx.restore();
            }
            ctx.fillText(content, 0, 0);
            if ((s as any).underline) {
                const tw = ctx.measureText(content).width;
                let ux = 0;
                if (align.h === 'center') ux -= tw/2;
                else if (align.h === 'right') ux -= tw;
                ctx.fillRect(ux, textSize * 0.15, tw, Math.max(1, textSize/12));
            }
            if ((s as any).strikethrough) {
                const tw = ctx.measureText(content).width;
                let sx = 0;
                if (align.h === 'center') sx -= tw/2;
                else if (align.h === 'right') sx -= tw;
                ctx.fillRect(sx, -textSize * 0.3, tw, Math.max(1, textSize/12));
            }
        }
        ctx.restore(); break;
       case 'block':
        const blockIdToFind = (s.blockId || s.name || '').toLowerCase().trim();
        const block = blocks[s.blockId || s.name || ''] || 
                      blocks[blockIdToFind] || 
                      Object.values(blocks).find((b: any) => 
                          ((b && b.name) || '').toLowerCase().trim() === blockIdToFind || 
                          ((b && b.id) || '').toLowerCase().trim() === blockIdToFind ||
                          String((b && b.handle) || '').toLowerCase().trim() === blockIdToFind
                      );
        if (block) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(-s.rotation);
          
          if (s.scaleX !== undefined) ctx.scale(s.scaleX, s.scaleY || s.scaleX);
          else if (s.scale !== undefined) ctx.scale(s.scale, s.scale);
          else ctx.scale(1, 1);
          
          // Translate by negative basePoint to align the insertion point correctly
          if (block.basePoint) {
            ctx.translate(-block.basePoint.x, -block.basePoint.y);
          }
          
          const currentColor = resolveColor(s, layerConfig[s.layer], activeTab, blockContext);
          const currentThickness = resolveLineWeight(s, layerConfig[s.layer], blockContext);
          const currentLT = resolveLineType(s, layerConfig[s.layer], blockContext);
          
          block.shapes.forEach(bs => drawShape(ctx, bs, ts, { color: currentColor, thickness: currentThickness, lineType: currentLT }));
          ctx.restore();
        } else {
            // Enhanced Visual representation of Block when definition is missing
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(-s.rotation);
            const sclX = s.scaleX !== undefined ? s.scaleX : (s.scale !== undefined ? s.scale : 1);
            const sclY = s.scaleY !== undefined ? s.scaleY : (s.scale !== undefined ? s.scale : 1);
            ctx.scale(sclX, sclY);
            
            // Draw visual representation card
            ctx.beginPath();
            ctx.rect(-15, -15, 30, 30);
            ctx.fillStyle = "#1e40af";
            ctx.fill();
            ctx.strokeStyle = "#67e8f9";
            ctx.lineWidth = 1.6 / ts; // Scale border thickness dynamically with zoom
            if (ctx.lineWidth < 1.2) ctx.lineWidth = 1.2;
            ctx.stroke();

            // Diagonal lines inside box for CAD draft styling
            ctx.beginPath();
            ctx.moveTo(-15, -15);
            ctx.lineTo(15, 15);
            ctx.moveTo(-15, 15);
            ctx.lineTo(15, -15);
            ctx.strokeStyle = "rgba(103, 232, 249, 0.25)";
            ctx.lineWidth = 1.0 / ts;
            ctx.stroke();

            // Flip Y back to draw right-side-up readable text
            ctx.save();
            ctx.scale(1, -1);
            
            // Abbreviated label centered inside box
            ctx.font = `bold ${8 / ts}px sans-serif`;
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const rawBlockName = s.blockId || s.name || 'Block';
            const abbrev = rawBlockName.startsWith('*') ? 'BLK' : rawBlockName.substring(0, 3).toUpperCase();
            ctx.fillText(abbrev, 0, 0);

            // Full block name below the container
            ctx.font = `${7 / ts}px sans-serif`;
            ctx.fillStyle = "#67e8f9";
            ctx.globalAlpha = 0.85;
            const isAnon = rawBlockName.startsWith('*') || rawBlockName.startsWith('A$C') || /^[0-9a-f]{6,16}$/i.test(rawBlockName);
            const displayName = isAnon ? 'Block Ref' : rawBlockName;
            ctx.fillText(displayName, 0, 20);
            
            ctx.restore();
            ctx.restore();
        }
        
        if (isS) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(-s.rotation);
            
            const stickLen = 35 / ts; 
            const handleRad = 5 / ts;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, stickLen);
            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 1.6 / ts;
            ctx.setLineDash([3 / ts, 2 / ts]);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, stickLen, handleRad, 0, Math.PI * 2);
            ctx.fillStyle = '#00bcd4';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 / ts;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, stickLen, handleRad * 1.8, Math.PI * 0.2, Math.PI * 1.8);
            ctx.strokeStyle = 'rgba(0, 188, 212, 0.6)';
            ctx.lineWidth = 1 / ts;
            ctx.stroke();
            
            ctx.restore();
        }
        break;
    }
    if(s.filled) { ctx.fillStyle = baseColor; ctx.globalAlpha = isS ? 0.35 : isH ? 0.3 : 0.08; ctx.fill(); ctx.globalAlpha = 1.0; }
    
    if (isComplexLT && !s.isPreview && !isH && !isS) {
        let pts: Point[] = [];
        if (s.type === 'line') pts = [{x: s.x1, y: s.y1}, {x: s.x2, y: s.y2}];
        else if (s.type === 'pline' || s.type === 'poly' || s.type === 'polygon' || s.type === 'spline' || s.type === 'dline') {
            if (s.points && s.points.length > 0) {
               if (typeof s.points[0] === 'number') {
                   for(let i=0; i<s.points.length; i+=2) pts.push({ x: s.points[i], y: s.points[i+1] });
               } else pts = s.points as Point[];
            }
        } else if (s.type === 'rect') {
            pts = [{x: s.x, y: s.y}, {x: s.x + s.width, y: s.y}, {x: s.x + s.width, y: s.y + s.height}, {x: s.x, y: s.y + s.height}, {x: s.x, y: s.y}];
        } else if (s.type === 'circle') {
            const steps = 64;
            for (let i = 0; i <= steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                pts.push({ x: s.x + s.radius * Math.cos(a), y: s.y + s.radius * Math.sin(a) });
            }
        } else if (s.type === 'arc') {
            const steps = 32;
            const diff = s.endAngle - s.startAngle;
            for (let i = 0; i <= steps; i++) {
                const a = s.startAngle + (i / steps) * diff;
                pts.push({ x: s.x + s.radius * Math.cos(a), y: s.y + s.radius * Math.sin(a) });
            }
        }

        if (pts.length > 1) {
            drawComplexLine(pts, currentLineType);
        } else {
            ctx.stroke();
        }
    } else {
        ctx.stroke();
    }
    ctx.restore();
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

    // Advanced hatch pattern mapping for AutoCAD pattern compatibility
    const knownPatterns = ['solid', 'dots', 'ansi31', 'ansi32', 'ansi33', 'ansi37', 'cross', 'net', 'hound', 'grid', 'brick', 'gravel', 'honey', 'ansi38', 'triang', 'zigzag', 'stars', 'grass', 'earth'];
    let finalPattern = (pattern || 'ansi31').toLowerCase().trim();
    if (finalPattern === 'user' || finalPattern === '_user' || !knownPatterns.includes(finalPattern) && !finalPattern.startsWith('ansi')) {
        if (finalPattern.includes('sand') || finalPattern.includes('conc') || finalPattern.includes('dirt') || finalPattern.includes('gravel')) {
            finalPattern = 'gravel';
        } else if (finalPattern.includes('hex') || finalPattern.includes('honey')) {
            finalPattern = 'honey';
        } else if (finalPattern.includes('cross') || finalPattern.includes('net') || finalPattern.includes('box') || finalPattern.includes('grid')) {
            finalPattern = 'grid';
        } else if (finalPattern.includes('dot')) {
            finalPattern = 'dots';
        } else if (finalPattern.includes('star')) {
            finalPattern = 'stars';
        } else if (finalPattern.includes('grass')) {
            finalPattern = 'grass';
        } else if (finalPattern.includes('earth') || finalPattern.includes('mud') || finalPattern.includes('clay')) {
            finalPattern = 'earth';
        } else {
            finalPattern = 'ansi31';
        }
    }

    const width = xMax - xMin, height = yMax - yMin;
    // Spacing should be model-space (not divided by ts)
    const spacing = (scale || 1) * (finalPattern === 'dots' ? 12 : 24);
    const angle = (rotation || 0) * Math.PI / 180;
    
    ctx.save();
    ctx.lineWidth = 0.8/ts;
    ctx.setLineDash([]);
    // Use the color of the shape if provided, else current strokeStyle
    const hatchColor = ctx.strokeStyle;
    ctx.globalAlpha = 0.6;
    
    if (finalPattern === 'solid') {
      ctx.fillStyle = hatchColor;
      ctx.globalAlpha = 0.08; // Beautiful soft opacity for solid hatch fills so underlying vectors remain visible
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p, idx) => { if (idx > 0) ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.fill(); 
    } else {
        pattern = finalPattern;
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
                    const a = (pattern === 'ansi31' || pattern === 'ansi32' || pattern === 'ansi33') ? Math.PI/4 : 
                              (pattern === 'ansi37' || pattern === 'cross') ? -Math.PI/4 : 0;
                    
                    ctx.save();
                    ctx.rotate(a);
                    ctx.moveTo(-diagonal, offset);
                    ctx.lineTo(diagonal, offset);
                    if (pattern === 'ansi32') { 
                        ctx.moveTo(-diagonal, offset + spacing/5);
                        ctx.lineTo(diagonal, offset + spacing/5);
                    }
                    if (pattern === 'ansi33') { 
                        ctx.moveTo(-diagonal, offset + spacing/6);
                        ctx.lineTo(diagonal, offset + spacing/6);
                        ctx.moveTo(-diagonal, offset + spacing/3);
                        ctx.lineTo(diagonal, offset + spacing/3);
                    }
                    if (pattern === 'net' || pattern === 'cross') {
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

                if (pattern === 'ansi38') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        if ((i + j) % 2 === 0) {
                            const px = i * s;
                            const py = j * s;
                            ctx.rect(px, py, s, s);
                        }
                    }
                }

                if (pattern === 'triang') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        const px = i * s + (j % 2 === 0 ? 0 : s/2);
                        const py = j * s;
                        const r = s * 0.3;
                        ctx.moveTo(px, py - r);
                        ctx.lineTo(px - r, py + r);
                        ctx.lineTo(px + r, py + r);
                        ctx.lineTo(px, py - r);
                    }
                }

                if (pattern === 'zigzag') {
                    const s = spacing;
                    ctx.save();
                    ctx.rotate(angle); // already rotated but adding variation
                    ctx.moveTo(-diagonal, offset);
                    for (let x = -diagonal; x < diagonal; x += s) {
                        ctx.lineTo(x + s/2, offset + s/2);
                        ctx.lineTo(x + s, offset);
                    }
                    ctx.restore();
                }

                if (pattern === 'stars') {
                    const s = spacing * 1.5;
                    for (let j = -count; j <= count; j++) {
                        const px = i * s + (j % 2 === 0 ? 0 : s/2);
                        const py = j * s;
                        const r = s * 0.2;
                        ctx.beginPath();
                        for (let k = 0; k < 5; k++) {
                            const a1 = (k * 0.8 * Math.PI) - Math.PI/2;
                            const a2 = ((k+1) * 0.8 * Math.PI) - Math.PI/2;
                            ctx.moveTo(px + Math.cos(a1) * r, py + Math.sin(a1) * r);
                            ctx.lineTo(px + Math.cos(a2) * r, py + Math.sin(a2) * r);
                        }
                        ctx.stroke();
                    }
                }

                if (pattern === 'grass') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        // Deterministic "random" position within cell
                        const noiseX = Math.abs(Math.sin(i * 12.9898 + j * 78.233)) * s;
                        const noiseY = Math.abs(Math.cos(i * 12.9898 + j * 78.233)) * s;
                        const px = i * s + noiseX;
                        const py = j * s + noiseY;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(px - s*0.1, py - s*0.3);
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + s*0.1, py - s*0.3);
                        ctx.moveTo(px, py);
                        ctx.lineTo(px, py - s*0.4);
                        ctx.stroke();
                    }
                }

                if (pattern === 'earth') {
                    const s = spacing;
                    ctx.beginPath();
                    ctx.moveTo(-diagonal, offset);
                    ctx.lineTo(diagonal, offset);
                    ctx.stroke();
                    for (let x = -diagonal; x < diagonal; x += s) {
                        ctx.beginPath();
                        ctx.moveTo(x, offset);
                        ctx.lineTo(x + s*0.3, offset - s*0.3);
                        ctx.stroke();
                    }
                }

                if (pattern === 'sand') {
                    const s = spacing / 2.5;
                    const noise = Math.abs(Math.sin(i * 99 + offset * 88));
                    if (noise > 0.5) {
                        ctx.beginPath();
                        ctx.arc(i * s, offset, 0.2/ts, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                if (pattern === 'conc') {
                    const s = spacing;
                    const noise = Math.abs(Math.sin(i * 123 + offset * 456));
                    if (noise > 0.8) {
                        ctx.beginPath();
                        const r = s * 0.1;
                        ctx.moveTo(i*s, offset - r);
                        ctx.lineTo(i*s + r, offset + r);
                        ctx.lineTo(i*s - r, offset + r);
                        ctx.closePath();
                        ctx.stroke();
                    } else if (noise > 0.4) {
                        ctx.beginPath();
                        ctx.arc(i*s, offset, 0.1/ts, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                if (pattern === 'cork') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        const noiseX = Math.abs(Math.sin(i * 45 + j * 67)) * s;
                        const noiseY = Math.abs(Math.cos(i * 45 + j * 67)) * s;
                        const px = i * s + noiseX;
                        const py = j * s + noiseY;
                        ctx.beginPath();
                        ctx.arc(px, py, s*0.1, 0, Math.PI * 2);
                        ctx.moveTo(px + s*0.2, py + s*0.1);
                        ctx.lineTo(px + s*0.3, py + s*0.2);
                        ctx.stroke();
                    }
                }

                if (pattern === 'clay') {
                    const s = spacing;
                    for (let j = -count; j <= count; j++) {
                        const px = i * s + (j % 2 === 0 ? 0 : s/2);
                        const py = j * s;
                        ctx.moveTo(px - s*0.2, py);
                        ctx.arc(px, py, s*0.2, Math.PI, 0);
                        ctx.moveTo(px + s*0.1, py + s*0.1);
                        ctx.arc(px + s*0.3, py + s*0.1, s*0.2, Math.PI, 0);
                    }
                }
            }
            ctx.stroke();
        }
    }
    ctx.restore();
  };

  const drawSnapMarker = (ctx: CanvasRenderingContext2D, snap: SnapPoint, ts: number, w: number, h: number) => {
    ctx.save();
    const { x, y, type } = snap;
    const size = 12 / ts; 

    // Assign appropriate color styles for the geometric outline markers
    let markerColor = "#00f0ff";
    if (type === 'mid') {
      markerColor = "#eab308";
    } else if (type === 'cen') {
      markerColor = "#ec4899";
    } else if (type === 'perp') {
      markerColor = "#10b981";
    } else if (type === 'tan') {
      markerColor = "#ec4899";
    }
    
    ctx.strokeStyle = markerColor; 
    ctx.lineWidth = 2.5 / ts;
    ctx.beginPath();
    
    switch (type) {
      case 'end':
        ctx.rect(x - size, y - size, size * 2, size * 2);
        break;
      case 'mid':
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
        ctx.closePath();
        break;
      case 'cen':
        ctx.arc(x, y, size, 0, Math.PI * 2);
        break;
      case 'node':
        ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, size/2, 0, Math.PI * 2);
        break;
      case 'quad':
        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y);
        ctx.closePath();
        break;
      case 'int':
        ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
        break;
      case 'perp':
        ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y - size);
        ctx.moveTo(x - size, y - size); ctx.lineTo(x, y - size); ctx.lineTo(x, y);
        break;
      case 'gcen':
        ctx.moveTo(x - size, y - size/2); ctx.lineTo(x, y - size); ctx.lineTo(x + size, y - size/2);
        ctx.lineTo(x + size, y + size/2); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y + size/2);
        ctx.closePath();
        break;
      case 'appint':
        ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
        ctx.setLineDash([2/ts, 2/ts]);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      case 'tan':
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y - size);
        break;
      case 'near':
        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y);
        ctx.closePath();
        break;
      case 'ext':
        ctx.setLineDash([2/ts, 2/ts]);
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        break;
      case 'polar':
        ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
        ctx.stroke(); ctx.beginPath();
        ctx.arc(x, y, size/2, 0, Math.PI * 2);
        break;
      case 'grid':
        ctx.moveTo(x - size/1.5, y); ctx.lineTo(x + size/1.5, y);
        ctx.moveTo(x, y - size/1.5); ctx.lineTo(x, y + size/1.5);
        ctx.rect(x - size/3, y - size/3, size * (2/3), size * (2/3));
        break;
      default:
        ctx.rect(x - size, y - size, size * 2, size * 2);
    }
    ctx.stroke();

    // Draw Tooltip Label
    if (activeTab === 'model' || isViewportActive) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for text to be upright and constant size
      const screenX = (x * ts) + w/2 + view.originX;
      const screenY = (-y * ts) + h/2 + view.originY;
      
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.font = "bold 11px Inter, sans-serif";
      const label = type.toUpperCase();
      const metrics = ctx.measureText(label);
      
      const padding = 6;
      const labelW = metrics.width + padding * 2;
      const labelH = 18;
      const labelX = screenX + 15;
      const labelY = screenY - 10;

      ctx.fillStyle = "rgba(40, 40, 45, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      
      // Draw rounded rect background
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(labelX + r, labelY);
      ctx.lineTo(labelX + labelW - r, labelY);
      ctx.quadraticCurveTo(labelX + labelW, labelY, labelX + labelW, labelY + r);
      ctx.lineTo(labelX + labelW, labelY + labelH - r);
      ctx.quadraticCurveTo(labelX + labelW, labelY + labelH, labelX + labelW - r, labelY + labelH);
      ctx.lineTo(labelX + r, labelY + labelH);
      ctx.quadraticCurveTo(labelX, labelY + labelH, labelX, labelY + labelH - r);
      ctx.lineTo(labelX, labelY + r);
      ctx.quadraticCurveTo(labelX, labelY, labelX + r, labelY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#22d3ee"; // Cyan text
      ctx.fillText(label, labelX + padding, labelY + 13);
    }

    ctx.restore();
  };

  const selectionTimer = useRef<NodeJS.Timeout | null>(null);
  const isMultiSelecting = useRef<boolean>(false);

  const clampViewState = (vs: ViewState): ViewState => {
    const minScale = 1e-6;
    const maxScale = 1e6;
    const maxOrigin = 1e9;
    
    let scale = vs.scale;
    if (isNaN(scale) || !isFinite(scale)) scale = 1;
    scale = Math.max(minScale, Math.min(maxScale, scale));

    let originX = vs.originX;
    if (isNaN(originX) || !isFinite(originX)) originX = 0;
    originX = Math.max(-maxOrigin, Math.min(maxOrigin, originX));

    let originY = vs.originY;
    if (isNaN(originY) || !isFinite(originY)) originY = 0;
    originY = Math.max(-maxOrigin, Math.min(maxOrigin, originY));

    return { scale, originX, originY };
  };

  const setClampedView = (newView: ViewState | ((prev: ViewState) => ViewState)) => {
    if (typeof newView === 'function') {
      setView(prev => clampViewState(newView(prev)));
    } else {
      setView(clampViewState(newView));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (isContextMenuOpen) return;
      const canvas = canvasRef.current; if (!canvas) return;
      // try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y}); pointerStartPos.current = { x, y };
      
      const count = activePointers.current.size;
      if (count === 1) {
          touchStartTime.current = Date.now();
          touchStartCount.current = 1;

          // Check if we clicked on a rotation handle!
          const wp = screenToWorld(x, y);
          const ts = view.scale * settings.drawingScale;
          const clickTolerance = 15 / ts; // 15 pixels tolerance
          
          const activeBlockId = selectedIds.find(id => {
              const s = allRenderableShapes.find(sh => sh.id === id);
              if (s && s.type === 'block') {
                  const hPos = getBlockRotationHandlePos(s);
                  const dist = Math.hypot(wp.x - hPos.x, wp.y - hPos.y);
                  return dist < clickTolerance;
              }
              return false;
          });
          
          if (activeBlockId) {
              activeRotationBlockId.current = activeBlockId;
              const s = allRenderableShapes.find(sh => sh.id === activeBlockId)!;
              initialBlockAngle.current = s.rotation || 0;
              initialPointerAngle.current = Math.atan2(wp.y - s.y, wp.x - s.x);
              setIsRotatingBlock(true);
              if (setLogMessage) setLogMessage("ROTATING BLOCK INTERACTIVELY");
              setIsPanning(false);
              updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch'); redraw();
              return;
          }

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
          if (isCommandActive && onAction) {
              onAction('enter');
          } else if (activeTab !== 'model' && onViewportToggle) {
              onViewportToggle(x, y); 
          } else if (activeTab === 'model') {
              onAction?.('zoomExtents');
          }
          return; 
      }
      lastClickTime.current = now;
      if (activePointers.current.size === 1) { 
        lastPos.current = { x, y }; 
        if (e.button === 1 || e.button === 2 || activeCommandName === 'PAN') {
            setIsPanning(true);
        } else if (e.button === 0) {
            if (activeCommandName === 'ZOOM' || activeCommandName === 'ZOOM_RT') {
                const wp = screenToWorld(x, y);
                if (onClick) onClick(wp.x, wp.y, !!activeSnapRef.current, e.shiftKey);
            }
            // For selection window / rubber band
            setIsPanning(true); 
        }
      }
      updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch'); redraw();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (isContextMenuOpen) return;
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      activePointers.current.set(e.pointerId, {x, y});
      
      if (activeRotationBlockId.current) {
          const wp = screenToWorld(x, y);
          const s = allRenderableShapes.find(sh => sh.id === activeRotationBlockId.current);
          if (s) {
              const currentPointerAngle = Math.atan2(wp.y - s.y, wp.x - s.x);
              const deltaAngle = currentPointerAngle - initialPointerAngle.current;
              let newAngle = initialBlockAngle.current + deltaAngle;
              
              if (e.shiftKey) {
                  const snapStep = 15 * Math.PI / 180;
                  newAngle = Math.round(newAngle / snapStep) * snapStep;
              }
              
              onAction?.('updateShapeRotation', { id: s.id, rotation: newAngle });
          }
          updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch'); redraw();
          return;
      }
      
      if (activePointers.current.size === 1) {
          const dx_p = x - pointerStartPos.current.x, dy_p = y - pointerStartPos.current.y;
          if (Math.hypot(dx_p, dy_p) > 10 && selectionTimer.current) {
            clearTimeout(selectionTimer.current);
            selectionTimer.current = null;
          }

          if (isPanning) {
              const dx = x - lastPos.current.x, dy = y - lastPos.current.y;
              if (Math.hypot(x - pointerStartPos.current.x, y - pointerStartPos.current.y) > 6) {
                 const isSelCmd = ['SELECT', 'ERASE', 'MOVE', 'COPYCLIP', 'CUTCLIP', 'STRETCH'].includes(activeCommandName || '');
                 if (((!isCommandActive && activeCommandName !== 'PAN') || isSelCmd) && e.buttons === 1) {
                    const crossing = pointerStartPos.current.x > x;
                    setSelectionRect({ start: pointerStartPos.current, end: {x, y}, crossing });
                    
                    const w1 = screenToWorld(pointerStartPos.current.x, pointerStartPos.current.y);
                    const w2 = screenToWorld(x, y);
                    const selectableShapes = selectionSpatialIndex.query({ xMin: Math.min(w1.x, w2.x), yMin: Math.min(w1.y, w2.y), xMax: Math.max(w1.x, w2.x), yMax: Math.max(w1.y, w2.y) });
                    const hits = getShapesInRect(w1, w2, selectableShapes, crossing, blocks);
                    setHighlightedIds(hits.map(s => s.id));
                 }
                 else if (e.buttons === 4 || e.buttons === 2 || (activeCommandName === 'PAN' && e.buttons === 1)) {
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
                            setClampedView(v => ({ 
                                ...v, 
                                originX: v.originX + dx_paper, 
                                originY: v.originY + dy_paper 
                            }));
                        }
                    } else {
                        // Panning model space or layout paper
                        // originX/Y are in pixels
                        setClampedView(v => ({ 
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
              const newScale = initialViewOnPinch.current.scale * factor;
              
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
              
              setClampedView({ scale: newScale, originX: newOriginX, originY: newOriginY });
          }
      }
      updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch'); redraw();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX-rect.left, y = e.clientY-rect.top;
      
      if (activeRotationBlockId.current) {
          activeRotationBlockId.current = null;
          setIsRotatingBlock(false);
          onAction?.('commitHistory');
          activePointers.current.delete(e.pointerId);
          setIsPanning(false);
          updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch'); redraw();
          return;
      }
      
      if (selectionTimer.current) {
        clearTimeout(selectionTimer.current);
        selectionTimer.current = null;
      }
      const multi = isMultiSelecting.current;
      isMultiSelecting.current = false;

      if (e.button === 2) {
          // Right-click: context menu logic
          if (isCommandActive && onAction) {
              // Let contextual right-click menu pop up without advancing the command's internal state machine or submitting an Enter.
              // Note: handleContextMenu on the canvas will fire on right-click to open commandContextMenu.
          } else if (selectedIds.length > 0 && onObjectContextMenu) {
              onObjectContextMenu(e.clientX, e.clientY);
          } else {
              // If no command active and nothing selected, repeat last command
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
              if (onClick) onClick(w2.x, w2.y, !!activeSnapRef.current, e.shiftKey);
          } else {
              const w1 = screenToWorld(selectionRect.start.x, selectionRect.start.y), w2 = screenToWorld(selectionRect.end.x, selectionRect.end.y);
              const selectableShapes = selectionSpatialIndex.query({ xMin: Math.min(w1.x, w2.x), yMin: Math.min(w1.y, w2.y), xMax: Math.max(w1.x, w2.x), yMax: Math.max(w1.y, w2.y) });
              const hits = getShapesInRect(w1, w2, selectableShapes, selectionRect.crossing, blocks);
              if (onSelectionChange) onSelectionChange(hits.map(s => s.id), e.shiftKey);
          }
          setSelectionRect(null);
          setHighlightedIds([]);
      } else {
          const dx = Math.abs(x - pointerStartPos.current.x), dy = Math.abs(y - pointerStartPos.current.y);
          if (dx < 6 && dy < 6 && activePointers.current.size === 1) {
              const wp = screenToWorld(x, y);
              let snapped = !!activeSnapRef.current;
              let finalP = activeSnapRef.current ? {x: activeSnapRef.current.x, y: activeSnapRef.current.y} : wp;
              if (!activeSnapRef.current && settings.gridSnap) {
                  const snapS = settings.snapSpacing || settings.gridSpacing || 10;
                  if (snapS > 0) {
                      if (settings.isometricGrid) {
                          const k = Math.round(wp.x / snapS);
                          let bestP = { x: wp.x, y: wp.y };
                          let minDist = Infinity;
                          for (let offset = -1; offset <= 1; offset++) {
                              const c = k + offset;
                              const m = Math.round(0.5 * ((wp.y * Math.sqrt(3)) / snapS - c));
                              const px = c * snapS;
                              const py = ((c + 2 * m) * snapS) / Math.sqrt(3);
                              const dist = Math.hypot(px - wp.x, py - wp.y);
                              if (dist < minDist) {
                                  minDist = dist;
                                  bestP = { x: px, y: py };
                              }
                          }
                          finalP = bestP;
                          snapped = true;
                      } else {
                          finalP = {
                              x: Math.round(wp.x / snapS) * snapS,
                              y: Math.round(wp.y / snapS) * snapS
                          };
                          snapped = true;
                      }
                  }
              }
              if (isCommandActive && onClick && activeCommandName !== 'PAN') onClick(finalP.x, finalP.y, snapped, e.shiftKey);
              else if (activeCommandName !== 'PAN') {
                const ts = view.scale * settings.drawingScale;
                const radius = 20 / ts;
                const selectableShapes = selectionSpatialIndex.query({
                    xMin: finalP.x - radius,
                    yMin: finalP.y - radius,
                    xMax: finalP.x + radius,
                    yMax: finalP.y + radius
                });
                const hit = selectableShapes.find(s => hitTestShape(finalP.x, finalP.y, s, radius, blocks));
                
                // Requirement: Single tap -> additive selection for shapes, click empty -> clear
                if (onSelectionChange) {
                    if (hit) {
                        const idx = allSelectableShapes.findIndex(sh => sh.id === hit.id);
                        setSelectedIndex(idx !== -1 ? idx : null);
                        if (idx !== -1) {
                            window.dispatchEvent(new CustomEvent('shapeSelected', { 
                                detail: { shape: hit, index: idx } 
                            }));
                        }
                        onSelectionChange([hit.id], true);
                    } else if (!(isMultiSelecting.current || e.shiftKey)) {
                        setSelectedIndex(null);
                        onSelectionChange([], false);
                    }
                }
              }
          }
      }
      isMultiSelecting.current = false;
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
      updateCursorAndSnaps(x, y, e.shiftKey, e.pointerType === 'touch');
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
        const r_pixel = getPixelRatio(), w_pixel = canvas.width/r_pixel, h_pixel = canvas.height/r_pixel;

        // Fresh ref-safe screenToWorld calculation to prevent stale scale drift
        const freshScreenToWorld = (sx: number, sy: number, vState: ViewState): Point => {
          const ts = vState.scale * settings.drawingScale;
          return { x: (sx - w_pixel/2 - vState.originX)/ts, y: -(sy - h_pixel/2 - vState.originY)/ts };
        };

        let wp: Point;
        const isModel = activeTab === 'model';
        if (isModel) {
            wp = freshScreenToWorld(x, y, view);
        } else {
            const pPoint = freshScreenToWorld(x, y, view);
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
                    wp = {
                        x: (relX - vp.width/2 - vp.viewState.originX) / vts,
                        y: (vp.height/2 + vp.viewState.originY - relY) / vts
                    };
                } else {
                    wp = pPoint;
                }
            } else {
                wp = pPoint;
            }
        }
        
        const currentView = (isViewportActive && activeViewportId) ? 
            layouts.find(l=>l.id===activeTab)?.viewports.find(vp=>vp.id===activeViewportId)?.viewState : view;
        
        if (!currentView) return;

        const newScale = currentView.scale * factor;
        const ts = newScale * settings.drawingScale;
        
        let newOriginX: number, newOriginY: number;
        
        if (activeTab === 'model' || !isViewportActive) {
            newOriginX = x - w_pixel/2 - wp.x * ts;
            newOriginY = y - h_pixel/2 + wp.y * ts;
        } else {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp && layout) {
                const pPoint = freshScreenToWorld(x, y, view);
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
        
        const clampViewState = (vs: ViewState): ViewState => {
          const minScale = 1e-6;
          const maxScale = 1e6;
          const maxOrigin = 1e9;
          
          let scale_v = vs.scale;
          if (isNaN(scale_v) || !isFinite(scale_v)) scale_v = 1;
          scale_v = Math.max(minScale, Math.min(maxScale, scale_v));

          let x_v = vs.originX;
          if (isNaN(x_v) || !isFinite(x_v)) x_v = 0;
          x_v = Math.max(-maxOrigin, Math.min(maxOrigin, x_v));

          let y_v = vs.originY;
          if (isNaN(y_v) || !isFinite(y_v)) y_v = 0;
          y_v = Math.max(-maxOrigin, Math.min(maxOrigin, y_v));

          return { scale: scale_v, originX: x_v, originY: y_v };
        };

        const clamped = clampViewState({ scale: newScale, originX: newOriginX, originY: newOriginY });
        setView(clamped);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Intercept Escape key to show confirmation modal during active drawing commands
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCommandActive && activeCommandName && activeCommandName !== 'PAN') {
        const drawingCommands = [
          'LINE', 'DLINE', 'POLY', 'RECT', 'CIRCLE', 'ARC', 'ELLIPSE', 
          'SPLINE', 'PLINE', 'DONUT', 'POINT', 'HATCH', 'TEXT', 'MTEXT', 'LEADER',
          'POLYGON', 'COPY', 'MOVE', 'ROTATE', 'SCALE', 'MIRROR', 'ARRAY'
        ];
        if (drawingCommands.includes(activeCommandName.toUpperCase())) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setShowConfirmCancel(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isCommandActive, activeCommandName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Optimized resize handler using ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === canvas.parentElement) {
          const { width, height } = entry.contentRect;
          const r = getPixelRatio();
          canvas.width = width * r;
          canvas.height = height * r;
          redraw();
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [redraw]);

  useEffect(() => {
    let anim: number;
    const loop = () => {
      if (isAiThinking || (lastAiCommandTime && Date.now() - lastAiCommandTime < 1000) || activeSnapRef.current) {
        redraw();
      }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [isAiThinking, lastAiCommandTime, redraw]);

  // Invalidate offscreen cache when geometry or active settings affect layout rendering
  useEffect(() => {
    offscreenCacheValidRef.current = false;
  }, [layers, blocks, layerConfig, settings, activeTab]);

  // Track active view changes (panning, zooming, pinching) to enable fast-scaling draw mode
  const lastViewRef = useRef<ViewState>(view);
  useEffect(() => {
    const scaleDiff = Math.abs(view.scale - lastViewRef.current.scale);
    const originDiff = Math.abs(view.originX - lastViewRef.current.originX) + Math.abs(view.originY - lastViewRef.current.originY);
    
    if (scaleDiff > 1e-6 || originDiff > 1e-6) {
      isViewChangingRef.current = true;
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
      }
      viewTimeoutRef.current = setTimeout(() => {
        isViewChangingRef.current = false;
        redraw();
      }, 100);
    }
    lastViewRef.current = view;
  }, [view, redraw]);

  useEffect(() => {
    return () => {
      if (viewTimeoutRef.current) clearTimeout(viewTimeoutRef.current);
    };
  }, []);

  useEffect(() => { redraw(); }, [redraw, view, isViewportActive, layers, layerConfig, selectedIds, highlightIds, settings, previewShapes, activeTab]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = screenToWorld(sx, sy);
    const x = e.clientX, y = e.clientY;
    if (isCommandActive) {
      onAction?.('commandContextMenu', { x, y, wp });
    } else {
      onObjectContextMenu?.(x, y);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData('application/x-cad-block');
    const bJson = e.dataTransfer.getData('application/x-cad-block-json');
    if (blockId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wp = screenToWorld(sx, sy);
      onAction?.('dropBlock', { blockId, x: wp.x, y: wp.y, blockJson: bJson });
    }
  };

  return (
    <div 
      className="w-full h-full overflow-hidden bg-[#0a0a0c] touch-none relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
        <canvas 
          ref={canvasRef} 
          className="w-full h-full outline-none select-none touch-none will-change-transform" 
          style={{ 
            cursor: isPanning ? 'grabbing' : activeCommandName === 'PAN' ? 'grab' : isCommandActive ? 'crosshair' : 'default' 
          }}
          onPointerDown={handlePointerDown} 
          onPointerMove={handlePointerMove} 
          onPointerUp={handlePointerUp} 
          onPointerCancel={handlePointerUp} 
          onContextMenu={handleContextMenu} 
        />
        
        {/* Dynamic Input Floating UI */}
        {isCommandActive && (
          <div 
            className="absolute pointer-events-none flex flex-col gap-1.5"
            style={{ 
              left: (worldCursorRef.current ? worldToScreen(worldCursorRef.current.x, worldCursorRef.current.y).x : 0) + 20, 
              top: (worldCursorRef.current ? worldToScreen(worldCursorRef.current.x, worldCursorRef.current.y).y : 0) + 20,
              zIndex: 50
            }}
          >
            {/* Prompt */}
            {activePrompt && (
              <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded px-2 py-0.5 whitespace-nowrap shadow-xl">
                 <span className="text-[9px] font-mono text-neutral-400 leading-none">{activePrompt.split(':')[0]}</span>
              </div>
            )}
            
            {/* Current Input / Stats */}
            <div className="flex items-center gap-1.5">
               <div className="bg-[#00bcd4]/95 border border-[#00bcd4] rounded px-2 py-0.5 shadow-[0_0_15px_rgba(0,188,212,0.4)] min-w-[40px] flex items-center justify-center">
                  <span className="text-[10px] font-mono text-black font-bold tracking-tight">
                    {commandInput || "SPECIFY_POINT"}
                    {commandInput && <span className="animate-pulse ml-0.5">_</span>}
                  </span>
               </div>
               
               {basePoint && (
                 <div className="bg-neutral-900/90 border border-white/5 rounded px-2 py-0.5 backdrop-blur-sm">
                    <span className="text-[9px] font-mono text-neutral-300">
                        {formatLength(distance(basePoint, worldCursorRef.current), settings)} {" < "} {(Math.atan2(worldCursorRef.current.y - basePoint.y, worldCursorRef.current.x - basePoint.x) * 180 / Math.PI + 360) % 360}°
                    </span>
                 </div>
               )}
            </div>

            {settings.aiSuggestionsEnabled && aiRecommendation && (
              <div className="bg-indigo-500/90 backdrop-blur-md border border-indigo-400/50 rounded px-2 py-0.5 shadow-xl animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-1.5">
                 <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                 <span className="text-[8px] font-black text-white uppercase tracking-widest">
                    SUGGESTION: {aiRecommendation}
                 </span>
              </div>
            )}
            
            <div className="flex items-center gap-1 opacity-60">
               <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-tighter">TAB: CYCLE FIELDS</span>
               <span className="text-[7px] font-mono text-white/20">|</span>
               <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-tighter">ENTER: CONFIRM</span>
            </div>
          </div>
        )}

        {/* Confirmation Dialog to Catch Accidental Cancel/Escape */}
        {showConfirmCancel && (
          <div className="absolute inset-0 bg-[#060608]/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300 pointer-events-auto select-none">
            <div className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_32px_120px_rgba(0,0,0,0.95)] flex flex-col p-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <AlertCircle size={18} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-widest text-neutral-100 font-sans">Confirm Action</span>
                  <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Unsaved progress will be discarded</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-[10px] text-neutral-300 font-semibold leading-relaxed uppercase tracking-wider pl-0.5">
                  Are you sure you want to cancel the active <span className="text-cyan-400 font-extrabold">{activeCommandName?.toUpperCase()}</span> drawing command?
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowConfirmCancel(false);
                  }}
                  className="flex-1 py-3 bg-neutral-900 border border-white/5 hover:bg-neutral-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-neutral-300 hover:text-white transition-all active:scale-95 cursor-pointer outline-none"
                >
                  Keep Drawing
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowConfirmCancel(false);
                    onAction?.('cancel');
                  }}
                  className="flex-1 py-3 bg-red-600/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all active:scale-95 cursor-pointer outline-none"
                >
                  Cancel Command
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Statistics HUD */}
        {settings.showHUD && !isHudDismissed && (
          isHudVisible ? (
            <div 
              className="absolute bottom-4 right-4 z-40 bg-zinc-950/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.7)] flex flex-col font-sans transition-all duration-300 w-64 pointer-events-auto select-none"
              style={{ transform: `translate(${hudPos.x}px, ${hudPos.y}px)` }}
            >
              {/* HUD Header */}
              <div 
                className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
                onMouseDown={e => startDraggingHud(e.clientX, e.clientY)}
                onTouchStart={e => e.touches.length > 0 && startDraggingHud(e.touches[0].clientX, e.touches[0].clientY)}
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <span className="text-[10px] font-bold text-neutral-200 uppercase tracking-wider font-sans">Drawing Stats</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      const next = !isHudExpanded;
                      setIsHudExpanded(next);
                      localStorage.setItem('voxcadd_hud_expanded', next ? 'true' : 'false');
                    }}
                    className="p-1 hover:bg-white/5 text-neutral-400 hover:text-white rounded-md transition-colors cursor-pointer outline-none"
                    title={isHudExpanded ? "Collapse" : "Expand"}
                  >
                    {isHudExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button 
                    onClick={() => {
                      setIsHudVisible(false);
                      localStorage.setItem('voxcadd_hud_visible', 'false');
                    }}
                    className="p-1 hover:bg-white/5 text-neutral-400 hover:text-red-400 rounded-md transition-colors cursor-pointer outline-none"
                    title="Hide HUD"
                  >
                    <EyeOff size={14} />
                  </button>
                </div>
              </div>

              {/* HUD Content */}
              {isHudExpanded ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* 1. Total Length */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Ruler size={13} className="text-cyan-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold">Total Length</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 text-right">
                      {formatLength(hudStats.totalLength, settings)}
                    </span>
                  </div>

                  {/* 2. Active Shapes */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Activity size={13} className="text-[#ec4899]" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold">Active Shapes</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#ec4899] text-right">
                      {hudStats.totalShapes} {hudStats.totalShapes === 1 ? 'shape' : 'shapes'}
                    </span>
                  </div>

                  {/* 3. Current Layer */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Layers size={13} className="text-amber-500" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold">Drawing Layer</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <div 
                        className="w-2.5 h-2.5 rounded-full border border-white/10" 
                        style={{ backgroundColor: layerConfig[settings.currentLayer]?.color || '#ffffff' }}
                      />
                      <span className="text-[10px] font-mono font-bold text-amber-500 max-w-[80px] truncate uppercase">
                        {settings.currentLayer}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Collapsed view summary */
                <div className="flex items-center justify-between gap-4 text-[9px] font-mono font-bold text-neutral-400 animate-in fade-in duration-200">
                  <span className="text-cyan-400">{hudStats.totalShapes} OBJ</span>
                  <span className="text-neutral-600">|</span>
                  <span className="text-pink-400 font-bold truncate max-w-[100px]" style={{ color: layerConfig[settings.currentLayer]?.color || '#ec4899' }}>
                    L: {settings.currentLayer}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Small mini restore pill container in corner */
            <div 
              className="absolute bottom-4 right-4 z-40 flex items-center gap-2 pointer-events-auto"
              style={{ transform: `translate(${hudPos.x}px, ${hudPos.y}px)` }}
            >
              <button 
                onClick={() => {
                  setIsHudVisible(true);
                  localStorage.setItem('voxcadd_hud_visible', 'true');
                }}
                className="bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 px-3 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto transition-all duration-200 active:scale-95 text-neutral-400 hover:text-cyan-400 cursor-pointer outline-none"
                title="Restore HUD"
              >
                <Eye size={14} className="stroke-[2.5]" />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none font-sans">Stats HUD</span>
              </button>
              <button
                onClick={() => {
                  setIsHudDismissed(true);
                  localStorage.setItem('voxcadd_hud_dismissed', 'true');
                }}
                className="bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 p-2 rounded-full shadow-lg flex items-center justify-center text-neutral-400 hover:text-red-400 transition-all duration-200 active:scale-95 cursor-pointer outline-none"
                title="Fully Hide HUD from Drawing Area"
              >
                <X size={14} />
              </button>
            </div>
          )
        )}
    </div>
  );
});

export default CADCanvas;
