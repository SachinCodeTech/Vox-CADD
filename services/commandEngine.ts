
import { Shape, Point, AppSettings, LayerConfig, LineShape, CircleShape, RectShape, ArcShape, PolyShape, TextShape, MTextShape, EllipseShape, DimensionShape, AngularDimensionShape, PointShape, InfiniteLineShape, DonutShape, LeaderShape, ViewState, DoubleLineShape, DLineJustification, TextJustification, LineType, BlockDefinition, LayoutDefinition, LayoutViewport, DimensionType } from '../types';
import { generateId, getCircleFrom3Points, formatLength, parseLength, hitTestShape, distance, getTrimmedShapes, moveShape, resolvePointInput, calculateArea, offsetShape, getPolygonPoints, stretchShape, getShapesInRect, rotateShape, scaleShape, mirrorShape, getExtendedShapes, filletLines } from './cadService';

export interface CommandContext {
    getSettings: () => AppSettings;
    getLayers: () => Record<string, Shape[]>; 
    getLayerConfig: () => Record<string, LayerConfig>;
    getSelectedIds: () => string[]; 
    setLayers: (cb: (prev: Record<string, Shape[]>) => Record<string, Shape[]>) => void;
    setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
    setPreview: (shapes: Shape[] | null) => void; 
    setMessage: (msg: string | null) => void;
    addLog: (msg: string) => void; 
    setView: (updater: ViewState | ((v: ViewState) => ViewState)) => void;
    getViewState: () => ViewState;
    onFinish: () => void;
    lastMousePoint: Point;
    start: (cmd: CADCommand) => void;
    getBlocks: () => Record<string, BlockDefinition>;
    setBlocks: (cb: (prev: Record<string, BlockDefinition>) => Record<string, BlockDefinition>) => void;
    getLayouts: () => LayoutDefinition[];
    setLayouts: (layouts: LayoutDefinition[]) => void;
    getActiveTab: () => string;
    onExternalRequest?: (type: string, data: any, callback: (result: any, props?: any) => void) => void;
}

export class ViewportCommand implements CADCommand {
    name = "VIEWPORT"; p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() {
        if (this.ctx.getActiveTab() === 'model') {
            this.ctx.addLog("VIEWPORT command only available in layout tabs.");
            this.ctx.onFinish();
            return;
        }
        this.ctx.setMessage("VIEWPORT Specify first corner:");
    }
    onClick(p: Point) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("VIEWPORT Specify opposite corner:");
        } else {
            const id = generateId();
            const vp: LayoutViewport = {
                id,
                x: Math.min(this.p1.x, p.x),
                y: Math.min(this.p1.y, p.y),
                width: Math.abs(p.x - this.p1.x),
                height: Math.abs(p.y - this.p1.y),
                viewState: { scale: 0.01, originX: 0, originY: 0 }
            };
            const activeTabId = this.ctx.getActiveTab();
            this.ctx.setLayouts(this.ctx.getLayouts().map(l => 
                l.id === activeTabId ? { ...l, viewports: [...l.viewports, vp] } : l
            ));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            this.ctx.setPreview([{
                id: 'preview',
                type: 'rect',
                x: Math.min(this.p1.x, p.x),
                y: Math.min(this.p1.y, p.y),
                width: Math.abs(p.x - this.p1.x),
                height: Math.abs(p.y - this.p1.y),
                isPreview: true,
                layer: '0',
                color: '#888'
            } as any]);
        }
    }
    onEnter() {} onCancel() { this.ctx.onFinish(); }
}

export interface CADCommand {
    name: string;
    onStart(): void;
    onClick(p: Point, snapped: boolean): void;
    onMove(p: Point, snapped: boolean): void;
    onInput?(text: string): boolean; 
    onEnter(): void;
    onCancel(): void;
}

let clipboardBuffer: Shape[] = [];
let clipboardBasePoint: Point = { x: 0, y: 0 };

const applyOrthoConstraint = (p: Point, anchor: Point, enabled: boolean, snapped: boolean): Point => {
    if (!enabled || snapped) return p;
    const dx = Math.abs(p.x - anchor.x);
    const dy = Math.abs(p.y - anchor.y);
    return dx > dy ? { x: p.x, y: anchor.y } : { x: anchor.x, y: p.y };
};

const getStyleSettings = (ctx: CommandContext) => {
    const settings = ctx.getSettings();
    const layer = settings.currentLayer;
    const layerConfig = ctx.getLayerConfig()[layer];
    return {
        layer,
        color: layerConfig?.color || '#FFFFFF',
        thickness: settings.penThickness !== 1 ? settings.penThickness : (layerConfig?.thickness || 0.25),
        lineType: settings.activeLineType !== 'continuous' ? settings.activeLineType : (layerConfig?.lineType || 'continuous'),
        textSize: settings.textSize || 250,
        textRotation: settings.textRotation || 0,
        textJustification: settings.textJustification || 'left'
    };
};

export class CommandEngine {
    active: CADCommand | null = null;
    ctx: CommandContext;

    constructor(ctx: CommandContext) { 
        this.ctx = ctx; 
        this.ctx.start = (cmd: CADCommand) => this.start(cmd);
    }
    
    start(cmd: CADCommand) { 
        try {
            this.cancel(); 
            this.active = cmd; 
            cmd.onStart(); 
        } catch (e) {
            console.error("CAD Engine Error:", e);
            this.ctx.addLog("SYSTEM_ERROR: CMD_FAILURE");
            this.cancel();
        }
    }
    
    click(p: Point, snapped: boolean = false) { 
        this.ctx.lastMousePoint = p;
        if (this.active) this.active.onClick(p, snapped);
    }
    
    move(p: Point, snapped: boolean = false) { 
        this.ctx.lastMousePoint = p;
        if (this.active) this.active.onMove(p, snapped);
    }
    
    input(text: string): boolean {
        if (!this.active) return false;
        try {
            const t = text.trim().toLowerCase();
            if (['exit', 'quit', 'cancel', 'esc'].includes(t)) { this.cancel(); return true; }
            if (t === '' || t === 'finish' || t === 'done') { this.active.onEnter(); return true; }
            if (this.active.onInput) return this.active.onInput(text);
        } catch (e) { this.ctx.addLog("INPUT_ERROR: INVALID_SYNTAX"); }
        return false;
    }
    
    cancel() { 
        if (this.active) this.active.onCancel();
        this.active = null; 
        this.ctx.setPreview([]); 
        this.ctx.setMessage(null); 
    }
}

export class LineCommand implements CADCommand {
    name = "LINE"; public pts: Point[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("LINE Specify start point:"); }
    onClick(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            this.addSegment(anchor, finalP);
            this.pts.push(finalP);
        } else { this.pts.push(p); }
        this.ctx.setMessage(`LINE Next point or <Enter to finish>`);
    }
    onInput(text: string): boolean {
        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }
    private addSegment(p1: Point, p2: Point) {
        const style = getStyleSettings(this.ctx);
        const s: LineShape = { id: generateId(), type: 'line', layer: style.layer, color: style.color, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }
    onMove(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const cp = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:anchor.x, y1:anchor.y, x2:cp.x, y2:cp.y} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
}

export class DoubleLineCommand implements CADCommand {
    name = "DLINE"; public pts: Point[] = []; public thickness: number = 230;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        this.ctx.setMessage("DLINE Specify start point or [Thickness]:"); 
    }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 't' || t === 'thickness') {
            this.ctx.setMessage("DLINE Specify wall thickness:");
            return true;
        }
        if (!isNaN(parseFloat(t)) && !t.includes(',') && this.pts.length === 0) {
            this.thickness = parseFloat(t);
            this.ctx.setMessage("DLINE Thickness set. Specify start point:");
            return true;
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }
    onClick(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            this.pts.push(finalP);
        } else {
            this.pts.push(p);
        }
        this.ctx.setMessage("DLINE Next point or <Enter to finish>");
    }
    onMove(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'dline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, finalP], thickness: this.thickness, justification: 'zero'} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: DoubleLineShape = { id: generateId(), type: 'dline', layer: style.layer, color: style.color, points: this.pts, thickness: this.thickness, justification: 'zero' };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        }
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class PolyCommand implements CADCommand {
    name = "PLINE"; public pts: Point[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("PLINE Specify start point:"); }
    onClick(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            this.pts.push(finalP);
        } else {
            this.pts.push(p);
        }
        this.ctx.setMessage("PLINE Next point or <Enter to finish>");
    }
    onInput(text: string): boolean {
        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }
    onMove(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'pline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, finalP]} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: PolyShape = { id: generateId(), type: 'pline', layer: style.layer, color: style.color, points: this.pts, closed: false, thickness: style.thickness, lineType: style.lineType };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        }
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class SplineCommand implements CADCommand {
    name = "SPLINE"; 
    public pts: Point[] = [];
    private isDrawing = false;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("SPLINE: Drag to sketch naturally (Freehand) or Tap to start."); 
    }

    onClick(p: Point) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.pts = [p];
            this.ctx.setMessage("SPLINE: Drawing... Tap or release to finish.");
        } else {
            this.isDrawing = false;
            this.onEnter();
        }
    }

    onMove(p: Point) {
        if (this.isDrawing) {
            const last = this.pts[this.pts.length - 1];
            // Minimum distance to add a new point for smoothness (5 world units threshold)
            if (distance(last, p) > 5) {
                this.pts.push(p);
            }
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id: 'p', 
                type: 'spline', 
                isPreview: true, 
                layer: style.layer, 
                color: style.color, 
                points: this.pts
            } as any]);
        }
    }

    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: PolyShape = { 
                id: generateId(), 
                type: 'spline', 
                layer: style.layer, 
                color: style.color, 
                points: this.pts, 
                thickness: style.thickness, 
                lineType: style.lineType 
            };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        }
        this.ctx.onFinish();
    }

    onCancel() { this.ctx.onFinish(); }
}

export class SketchCommand implements CADCommand {
    name = "SKETCH";
    public pts: Point[] = [];
    private isDrawing = false;

    constructor(public ctx: CommandContext) {}

    onStart() {
        this.ctx.setMessage("SKETCH: Draw a rough shape. Release to interpret.");
    }

    onClick(p: Point) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.pts = [p];
        } else {
            this.isDrawing = false;
            this.onEnter();
        }
    }

    onMove(p: Point) {
        if (this.isDrawing) {
            const last = this.pts[this.pts.length - 1];
            if (distance(last, p) > 5) {
                this.pts.push(p);
            }
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id: 'p',
                type: 'spline',
                isPreview: true,
                layer: style.layer,
                color: '#00bcd4',
                points: this.pts
            } as any]);
        }
    }

    onEnter() {
        if (this.pts.length > 5) {
            if (this.ctx.onExternalRequest) {
                this.ctx.onExternalRequest('interpret_sketch', { points: this.pts }, () => {});
            }
        }
        this.ctx.onFinish();
    }

    onCancel() { this.ctx.onFinish(); }
}

export class CircleCommand implements CADCommand {
    name = "CIRCLE"; 
    public mode: 'default' | '2p' | '3p' | 'ttr' = 'default'; 
    public pts: Point[] = [];
    public selectedShapes: Shape[] = [];
    public radius: number = 0;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("CIRCLE Specify center point or [2P/3P/TTR]:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (this.pts.length === 0 && this.selectedShapes.length === 0) {
            if (t === '2p') { 
                this.mode = '2p'; 
                this.ctx.setMessage("CIRCLE 2P Specify first diameter point:"); 
                return true; 
            }
            if (t === '3p') { 
                this.mode = '3p'; 
                this.ctx.setMessage("CIRCLE 3P Specify first point on circle:"); 
                return true; 
            }
            if (t === 'ttr') {
                this.mode = 'ttr';
                this.ctx.setMessage("CIRCLE TTR Specify point on object for first tangent:");
                return true;
            }
            if (t === 'center') {
                this.mode = 'default';
                this.ctx.setMessage("CIRCLE Specify center point or [2P/3P/TTR]:");
                return true;
            }
        }

        if (this.mode === 'ttr' && this.selectedShapes.length === 2) {
            const r = parseLength(text, this.ctx.getSettings().units === 'imperial');
            if (!isNaN(r) && r > 0) {
                this.radius = r;
                this.solveTTR();
                return true;
            }
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { 
            this.onClick(p, false); 
            return true; 
        }

        return false;
    }

    onClick(p: Point, snapped: boolean) {
        if (this.mode === 'ttr') {
            if (this.selectedShapes.length < 2) {
                const shape = this.findShapeAt(p);
                if (shape) {
                    this.selectedShapes.push(shape);
                    this.pts.push(p); // Store click point for proximity
                    if (this.selectedShapes.length === 1) {
                        this.ctx.setMessage("CIRCLE TTR Specify point on object for second tangent:");
                    } else if (this.selectedShapes.length === 2) {
                        this.ctx.setMessage("CIRCLE TTR Specify radius:");
                    }
                } else {
                    this.ctx.addLog("No object found at selection point.");
                }
            } else {
                // User clicked for radius
                const r = distance(this.pts[1], p);
                if (r > 0) {
                    this.radius = r;
                    this.solveTTR();
                }
            }
            return;
        }

        if (this.mode === 'default' && this.pts.length === 1) {
            const finalP = applyOrthoConstraint(p, this.pts[0], this.ctx.getSettings().ortho, snapped);
            this.pts.push(finalP);
        } else {
            this.pts.push(p);
        }
        
        if (this.mode === 'default') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("CIRCLE Specify radius point:");
            } else { 
                this.addCircle(this.pts[0], distance(this.pts[0], this.pts[1])); 
                this.ctx.onFinish(); 
            }
        } else if (this.mode === '2p') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("CIRCLE 2P Specify second point:");
            } else { 
                const cen = { x: (this.pts[0].x + this.pts[1].x)/2, y: (this.pts[0].y + this.pts[1].y)/2 }; 
                this.addCircle(cen, distance(this.pts[0], this.pts[1]) / 2); 
                this.ctx.onFinish(); 
            }
        } else if (this.mode === '3p') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("CIRCLE 3P Specify second point:");
            } else if (this.pts.length === 2) {
                this.ctx.setMessage("CIRCLE 3P Specify third point:");
            } else if (this.pts.length === 3) {
                const res = getCircleFrom3Points(this.pts[0], this.pts[1], this.pts[2]);
                if (res) {
                    this.addCircle({x: res.x, y: res.y}, res.radius);
                } else {
                    this.ctx.addLog("Points are collinear, cannot create circle.");
                }
                this.ctx.onFinish();
            }
        }
    }

    private findShapeAt(p: Point): Shape | null {
        // Use a scale-dependent threshold for selection
        const threshold = 10 / this.ctx.getViewState().scale; 
        const allLayers = this.ctx.getLayers();
        for (const layerName in allLayers) {
            for (const shape of allLayers[layerName]) {
                if (hitTestShape(p.x, p.y, shape, threshold, this.ctx.getBlocks())) return shape;
            }
        }
        return null;
    }

    private solveTTR() {
        if (this.selectedShapes.length < 2 || this.radius <= 0) return;
        
        const s1 = this.selectedShapes[0];
        const s2 = this.selectedShapes[1];
        const p1 = this.pts[0];
        const p2 = this.pts[1];

        // Basic TTR for two lines
        if (s1.type === 'line' && s2.type === 'line') {
            const getLineEq = (l: LineShape) => {
                const A = l.y1 - l.y2;
                const B = l.x2 - l.x1;
                const C = l.x1 * l.y2 - l.x2 * l.y1;
                return { A, B, C, norm: Math.sqrt(A*A + B*B) };
            };

            const eq1 = getLineEq(s1);
            const eq2 = getLineEq(s2);

            // Parallel lines at distance R
            const offset1 = [eq1.C + this.radius * eq1.norm, eq1.C - this.radius * eq1.norm];
            const offset2 = [eq2.C + this.radius * eq2.norm, eq2.C - this.radius * eq2.norm];

            let bestCenter: Point | null = null;
            let minDist = Infinity;
            const target = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };

            for (const c1 of offset1) {
                for (const c2 of offset2) {
                    // Intersection of Ax + By + c1 = 0 and Ax + By + c2 = 0
                    const det = eq1.A * eq2.B - eq2.A * eq1.B;
                    if (Math.abs(det) < 0.0001) continue;
                    const cx = (eq1.B * c2 - eq2.B * c1) / det;
                    const cy = (eq2.A * c1 - eq1.A * c2) / det;
                    const center = { x: cx, y: cy };
                    const d = distance(center, target);
                    if (d < minDist) {
                        minDist = d;
                        bestCenter = center;
                    }
                }
            }

            if (bestCenter) {
                this.addCircle(bestCenter, this.radius);
                this.ctx.onFinish();
            } else {
                this.ctx.addLog("No TTR solution found.");
                this.ctx.onFinish();
            }
        } else {
            this.ctx.addLog("TTR currently only supported for lines.");
            this.ctx.onFinish();
        }
    }

    private addCircle(cen: Point, r: number) {
        const style = getStyleSettings(this.ctx);
        const s: CircleShape = { 
            id: generateId(), 
            type: 'circle', 
            layer: style.layer, 
            color: style.color, 
            x: cen.x, 
            y: cen.y, 
            radius: r, 
            thickness: style.thickness, 
            lineType: style.lineType 
        };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }

    onMove(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        if (this.mode === 'default' && this.pts.length === 1) {
            const finalP = applyOrthoConstraint(p, this.pts[0], this.ctx.getSettings().ortho, snapped);
            this.ctx.setPreview([{id:'p', type:'circle', isPreview:true, layer: style.layer, color: style.color, x: this.pts[0].x, y: this.pts[0].y, radius: distance(this.pts[0], finalP)} as any]);
        } else if (this.mode === '2p' && this.pts.length === 1) {
            const cen = { x: (this.pts[0].x + p.x)/2, y: (this.pts[0].y + p.y)/2 };
            this.ctx.setPreview([{id:'p', type:'circle', isPreview:true, layer: style.layer, color: style.color, x: cen.x, y: cen.y, radius: distance(this.pts[0], p) / 2} as any]);
        } else if (this.mode === '3p') {
            if (this.pts.length === 1) {
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:p.x, y2:p.y} as any]);
            } else if (this.pts.length === 2) {
                const res = getCircleFrom3Points(this.pts[0], this.pts[1], p);
                if (res) {
                    this.ctx.setPreview([{id:'p', type:'circle', isPreview:true, layer: style.layer, color: style.color, x: res.x, y: res.y, radius: res.radius} as any]);
                }
            }
        } else if (this.mode === 'ttr' && this.selectedShapes.length === 2) {
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[1].x, y1:this.pts[1].y, x2:p.x, y2:p.y} as any]);
        }
    }

    onEnter() { this.ctx.onFinish(); } 
    onCancel() { this.ctx.onFinish(); }
}

export class ArcCommand implements CADCommand {
    name = "ARC"; 
    public pts: Point[] = [];
    public mode: '3p' | 'center' | '2p' | 'tan' = '3p';
    
    constructor(public ctx: CommandContext) {}
    
    onStart() { 
        this.ctx.setMessage("ARC Specify start point or [Center/2P/3P/Tan]:"); 
    }
    
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === '3p') {
            this.mode = '3p'; this.pts = [];
            this.ctx.setMessage("ARC 3P Specify start point:");
            return true;
        }
        if (t === 'center' || t === 'c') {
            this.mode = 'center'; this.pts = [];
            this.ctx.setMessage("ARC CENTER Specify center point:");
            return true;
        }
        if (t === '2p') {
            this.mode = '2p'; this.pts = [];
            this.ctx.setMessage("ARC 2P Specify start point:");
            return true;
        }
        if (t === 'tan') {
            this.mode = 'tan'; this.pts = [];
            this.ctx.setMessage("ARC TAN Specify start point (tangent to object):");
            return true;
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }

    onClick(p: Point, snapped: boolean) {
        const ortho = this.ctx.getSettings().ortho;
        let finalP = p;
        if (this.pts.length > 0) {
            const anchor = (this.mode === 'center') ? this.pts[0] : this.pts[this.pts.length - 1];
            finalP = applyOrthoConstraint(p, anchor, ortho, snapped);
        }

        this.pts.push(finalP);
        const style = getStyleSettings(this.ctx);

        if (this.mode === '3p') {
            if (this.pts.length === 1) this.ctx.setMessage("ARC 3P Specify second point:");
            else if (this.pts.length === 2) this.ctx.setMessage("ARC 3P Specify end point:");
            else {
                const res = getCircleFrom3Points(this.pts[0], this.pts[1], this.pts[2]);
                if (res) {
                    const s: ArcShape = { 
                        id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
                        x: res.x, y: res.y, radius: res.radius, 
                        startAngle: res.startAngle, endAngle: res.endAngle, 
                        counterClockwise: res.counterClockwise,
                        thickness: style.thickness, lineType: style.lineType 
                    };
                    this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                }
                this.ctx.onFinish();
            }
        } else if (this.mode === 'center') {
            if (this.pts.length === 1) this.ctx.setMessage("ARC CENTER Specify start point:");
            else if (this.pts.length === 2) this.ctx.setMessage("ARC CENTER Specify end point:");
            else {
                const cen = this.pts[0], start = this.pts[1], end = this.pts[2];
                const r = distance(cen, start);
                const sa = Math.atan2(start.y - cen.y, start.x - cen.x);
                const ea = Math.atan2(end.y - cen.y, end.x - cen.x);
                const s: ArcShape = { 
                    id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
                    x: cen.x, y: cen.y, radius: r, startAngle: sa, endAngle: ea, 
                    counterClockwise: true, thickness: style.thickness, lineType: style.lineType 
                };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
            }
        } else if (this.mode === '2p') {
            if (this.pts.length === 1) this.ctx.setMessage("ARC 2P Specify end point:");
            else if (this.pts.length === 2) this.ctx.setMessage("ARC 2P Specify radius point (drag for bulge):");
            else {
                const start = this.pts[0], end = this.pts[1], mid = this.pts[2];
                const res = getCircleFrom3Points(start, mid, end);
                if (res) {
                    const s: ArcShape = { 
                        id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
                        x: res.x, y: res.y, radius: res.radius, startAngle: res.startAngle, endAngle: res.endAngle, 
                        counterClockwise: res.counterClockwise, thickness: style.thickness, lineType: style.lineType 
                    };
                    this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                }
                this.ctx.onFinish();
            }
        } else if (this.mode === 'tan') {
            if (this.pts.length === 1) this.ctx.setMessage("ARC TAN Specify endpoint:");
            else {
                const start = this.pts[0], end = this.pts[1];
                const mid = { x: (start.x + end.x)/2 + (end.y - start.y)*0.2, y: (start.y + end.y)/2 - (end.x - start.x)*0.2 };
                const res = getCircleFrom3Points(start, mid, end);
                if (res) {
                    const s: ArcShape = { 
                        id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
                        x: res.x, y: res.y, radius: res.radius, startAngle: res.startAngle, endAngle: res.endAngle, 
                        counterClockwise: res.counterClockwise, thickness: style.thickness, lineType: style.lineType 
                    };
                    this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                }
                this.ctx.onFinish();
            }
        }
    }

    onMove(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        const ortho = this.ctx.getSettings().ortho;

        if (this.mode === '3p') {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const cp = applyOrthoConstraint(p, this.pts[1], ortho, snapped);
                const res = getCircleFrom3Points(this.pts[0], this.pts[1], cp);
                if (res) this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x:res.x, y:res.y, radius:res.radius, startAngle:res.startAngle, endAngle:res.endAngle, counterClockwise:res.counterClockwise} as any]);
            }
        } else if (this.mode === 'center' && this.pts.length > 0) {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const cen = this.pts[0], start = this.pts[1];
                const cp = applyOrthoConstraint(p, cen, ortho, snapped);
                const r = distance(cen, start);
                const sa = Math.atan2(start.y - cen.y, start.x - cen.x);
                const ea = Math.atan2(cp.y - cen.y, cp.x - cen.x);
                this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x:cen.x, y:cen.y, radius:r, startAngle:sa, endAngle:ea, counterClockwise:true} as any]);
            }
        } else if (this.mode === '2p' && this.pts.length > 0) {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const cp = applyOrthoConstraint(p, this.pts[1], ortho, snapped);
                const res = getCircleFrom3Points(this.pts[0], cp, this.pts[1]);
                if (res) this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x:res.x, y:res.y, radius:res.radius, startAngle:res.startAngle, endAngle:res.endAngle, counterClockwise:res.counterClockwise} as any]);
            }
        } else if (this.mode === 'tan' && this.pts.length === 1) {
             const start = this.pts[0];
             const end = applyOrthoConstraint(p, start, ortho, snapped);
             const mid = { x: (start.x + end.x)/2 + (end.y - start.y)*0.2, y: (start.y + end.y)/2 - (end.x - start.x)*0.2 };
             const res = getCircleFrom3Points(start, mid, end);
             if (res) this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x:res.x, y:res.y, radius:res.radius, startAngle:res.startAngle, endAngle:res.endAngle, counterClockwise:res.counterClockwise} as any]);
        }
    }
    
    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
}

export class PolygonCommand implements CADCommand {
    name = "POLYGON"; public sides: number = 4; public center: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("POLYGON Enter number of sides <4>:"); }
    onInput(text: string): boolean {
        if (!this.center) {
            const val = parseInt(text);
            if (!isNaN(val) && val > 2) { this.sides = val; this.ctx.setMessage("POLYGON Specify center point:"); return true; }
        } else {
            const r = parseLength(text, this.ctx.getSettings().units === 'imperial');
            if (!isNaN(r)) { this.addPolygon(r); this.ctx.onFinish(); return true; }
        }
        return false;
    }
    onClick(p: Point, snapped: boolean) {
        if (!this.center) { this.center = p; this.ctx.setMessage("POLYGON Specify radius point:"); }
        else { 
            const finalP = applyOrthoConstraint(p, this.center, this.ctx.getSettings().ortho, snapped);
            this.addPolygon(distance(this.center, finalP)); 
            this.ctx.onFinish(); 
        }
    }
    private addPolygon(r: number) {
        if (!this.center) return;
        const pts = getPolygonPoints(this.center, this.sides, r, true);
        const style = getStyleSettings(this.ctx);
        const s: PolyShape = { id: generateId(), type: 'polygon', layer: style.layer, color: style.color, points: pts, closed: true, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }
    onMove(p: Point, snapped: boolean) {
        if (this.center) {
            const finalP = applyOrthoConstraint(p, this.center, this.ctx.getSettings().ortho, snapped);
            const pts = getPolygonPoints(this.center, this.sides, distance(this.center, finalP), true);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'polygon', isPreview:true, layer: style.layer, color: style.color, points: pts, closed: true} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class EllipseCommand implements CADCommand {
    name = "ELLIPSE"; 
    public pts: Point[] = [];
    public mode: 'center' | '2p' | '3p' | 'tan' = 'center';

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("ELLIPSE Specify center point or [2P/3P/Tan]:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'center' || t === 'c') {
            this.mode = 'center'; this.pts = [];
            this.ctx.setMessage("ELLIPSE CENTER Specify center point:");
            return true;
        }
        if (t === '2p') {
            this.mode = '2p'; this.pts = [];
            this.ctx.setMessage("ELLIPSE 2P Specify first endpoint of axis:");
            return true;
        }
        if (t === '3p') {
            this.mode = '3p'; this.pts = [];
            this.ctx.setMessage("ELLIPSE 3P Specify first endpoint of axis:");
            return true;
        }
        if (t === 'tan') {
            this.mode = 'tan'; this.pts = [];
            this.ctx.setMessage("ELLIPSE TAN Specify point on tangent line:");
            return true;
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }

    onClick(p: Point, snapped: boolean) {
        const ortho = this.ctx.getSettings().ortho;
        let finalP = p;
        if (this.pts.length > 0) {
            const anchor = (this.mode === 'center' || this.mode === 'tan') ? this.pts[0] : this.pts[this.pts.length - 1];
            finalP = applyOrthoConstraint(p, anchor, ortho, snapped);
        }

        this.pts.push(finalP);
        const style = getStyleSettings(this.ctx);

        if (this.mode === 'center') {
            if (this.pts.length === 1) this.ctx.setMessage("ELLIPSE CENTER Specify endpoint of axis:");
            else if (this.pts.length === 2) this.ctx.setMessage("ELLIPSE CENTER Specify distance to other axis (minor radius):");
            else {
                const cen = this.pts[0], major = this.pts[1], minorP = this.pts[2];
                const rx = distance(cen, major);
                const ry = distance(cen, minorP);
                const rot = Math.atan2(major.y - cen.y, major.x - cen.x);
                const s: EllipseShape = { id: generateId(), type: 'ellipse', layer: style.layer, color: style.color, x: cen.x, y: cen.y, rx, ry, rotation: rot, thickness: style.thickness };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
            }
        } else if (this.mode === '2p' || this.mode === '3p') {
            if (this.pts.length === 1) {
                this.ctx.setMessage(`ELLIPSE ${this.mode === '2p' ? '2P' : '3P'} Specify second endpoint of axis:`);
            } else if (this.pts.length === 2) {
                this.ctx.setMessage(`ELLIPSE ${this.mode === '2p' ? '2P' : '3P'} Specify distance to other axis:`);
            } else {
                const p1 = this.pts[0], p2 = this.pts[1], p3 = this.pts[2];
                const cen = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                const rx = distance(cen, p1);
                const ry = distance(cen, p3);
                const rot = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const s: EllipseShape = { id: generateId(), type: 'ellipse', layer: style.layer, color: style.color, x: cen.x, y: cen.y, rx, ry, rotation: rot, thickness: style.thickness };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
            }
        } else if (this.mode === 'tan') {
            if (this.pts.length === 1) this.ctx.setMessage("ELLIPSE TAN Specify major axis endpoint:");
            else if (this.pts.length === 2) this.ctx.setMessage("ELLIPSE TAN Specify minor axis endpoint:");
            else {
                const cen = this.pts[0], major = this.pts[1], minor = this.pts[2];
                const rx = distance(cen, major);
                const ry = distance(cen, minor);
                const rot = Math.atan2(major.y - cen.y, major.x - cen.x);
                const s: EllipseShape = { id: generateId(), type: 'ellipse', layer: style.layer, color: style.color, x: cen.x, y: cen.y, rx, ry, rotation: rot, thickness: style.thickness };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
            }
        }
    }

    onMove(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        const ortho = this.ctx.getSettings().ortho;

        if (this.mode === 'center' && this.pts.length > 0) {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const cen = this.pts[0], major = this.pts[1];
                const cp = applyOrthoConstraint(p, cen, ortho, snapped);
                const rx = distance(cen, major);
                const ry = distance(cen, cp);
                const rot = Math.atan2(major.y - cen.y, major.x - cen.x);
                this.ctx.setPreview([{id:'p', type:'ellipse', isPreview:true, layer: style.layer, color: style.color, x:cen.x, y:cen.y, rx, ry, rotation:rot} as any]);
            }
        } else if ((this.mode === '2p' || this.mode === '3p') && this.pts.length > 0) {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const p1 = this.pts[0], p2 = this.pts[1];
                const cen = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                const cp = applyOrthoConstraint(p, cen, ortho, snapped);
                const rx = distance(cen, p1);
                const ry = distance(cen, cp);
                const rot = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                this.ctx.setPreview([{id:'p', type:'ellipse', isPreview:true, layer: style.layer, color: style.color, x:cen.x, y:cen.y, rx, ry, rotation:rot} as any]);
            }
        } else if (this.mode === 'tan' && this.pts.length > 0) {
            if (this.pts.length === 1) {
                const cp = applyOrthoConstraint(p, this.pts[0], ortho, snapped);
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:cp.x, y2:cp.y} as any]);
            } else if (this.pts.length === 2) {
                const cen = this.pts[0], major = this.pts[1];
                const cp = applyOrthoConstraint(p, cen, ortho, snapped);
                const rx = distance(cen, major);
                const ry = distance(cen, cp);
                const rot = Math.atan2(major.y - cen.y, major.x - cen.x);
                this.ctx.setPreview([{id:'p', type:'ellipse', isPreview:true, layer: style.layer, color: style.color, x:cen.x, y:cen.y, rx, ry, rotation:rot} as any]);
            }
        }
    }

    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
}

export class RectCommand implements CADCommand {
    name = "RECT"; p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("RECT Specify first corner:"); }
    onClick(p: Point) {
        if (!this.p1) { this.p1 = p; this.ctx.setMessage("RECT Specify opposite corner:"); }
        else {
            const style = getStyleSettings(this.ctx);
            const s: RectShape = { id: generateId(), type: 'rect', layer: style.layer, color: style.color, x: Math.min(this.p1.x, p.x), y: Math.min(this.p1.y, p.y), width: Math.abs(p.x - this.p1.x), height: Math.abs(p.y - this.p1.y), thickness: style.thickness, lineType: style.lineType };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'rect', isPreview:true, layer: style.layer, color: style.color, x: Math.min(this.p1.x, p.x), y: Math.min(this.p1.y, p.y), width: Math.abs(p.x - this.p1.x), height: Math.abs(p.y - this.p1.y)} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class MoveCommand implements CADCommand {
    name = "MOVE"; base: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) {
            this.ctx.setMessage("MOVE Specify base point:"); 
        } else {
            this.ctx.setMessage("MOVE Select items or pick base point:"); 
        }
    }
    onClick(p: Point, snapped: boolean) {
        if (!this.base && this.ctx.getSelectedIds().length > 0) {
            this.base = p; 
            this.ctx.setMessage("MOVE Specify second point:");
            return;
        }
        if (!this.base) {
            // If nothing selected, maybe clicking hits something?
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage("MOVE Items selected. Specify base point:");
            } else {
                this.base = p; 
                this.ctx.setMessage("MOVE Specify second point:");
            }
        }
        else {
            const finalP = applyOrthoConstraint(p, this.base, this.ctx.getSettings().ortho, snapped);
            const dx = finalP.x - this.base.x, dy = finalP.y - this.base.y;
            const ids = this.ctx.getSelectedIds();
            this.ctx.setLayers(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(l => next[l] = next[l].map(s => ids.includes(s.id) ? moveShape(s, dx, dy) : s));
                return next;
            });
            this.ctx.onFinish();
        }
    }
    onMove(p: Point, snapped: boolean) {
        if (this.base) {
            const finalP = applyOrthoConstraint(p, this.base, this.ctx.getSettings().ortho, snapped);
            const dx = finalP.x - this.base.x, dy = finalP.y - this.base.y;
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat();
            this.ctx.setPreview(all.filter(s => ids.includes(s.id)).map(s => ({...moveShape(s, dx, dy), isPreview: true} as any)));
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class EraseCommand implements CADCommand {
    name = "ERASE"; constructor(public ctx: CommandContext) {}
    onStart() {
        const ids = this.ctx.getSelectedIds();
        if (ids.length > 0) {
            this.ctx.setLayers(prev => {
                const n = { ...prev };
                Object.keys(n).forEach(l => n[l] = n[l].filter(s => !ids.includes(s.id)));
                return n;
            });
            this.ctx.setSelectedIds([]);
            this.ctx.onFinish();
        } else { this.ctx.setMessage("ERASE Select items or type 'ALL':"); }
    }
    onInput(text: string): boolean {
        if (text.toLowerCase() === 'all') { this.ctx.setLayers(() => ({ '0': [] })); this.ctx.onFinish(); return true; }
        return false;
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (hit) {
            this.ctx.setLayers(prev => {
                const n = { ...prev };
                Object.keys(n).forEach(l => n[l] = n[l].filter(s => s.id !== hit.id));
                return n;
            });
        }
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class ZoomCommand implements CADCommand {
    name = "ZOOM"; constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("ZOOM Specify corner of window or [Extents/In/Out] <Extents>:"); }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'e' || t === 'extents') { this.ctx.setView({ scale: 0.05, originX: 0, originY: 0 }); this.ctx.onFinish(); return true; }
        if (t === 'i' || t === 'in') { this.ctx.setView(v => ({...v, scale: v.scale * 1.5})); this.ctx.onFinish(); return true; }
        if (t === 'o' || t === 'out') { this.ctx.setView(v => ({...v, scale: v.scale / 1.5})); this.ctx.onFinish(); return true; }
        return false;
    }
    onClick() { this.ctx.onFinish(); } onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class DistanceCommand implements CADCommand {
    name = "DIST"; public p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("DIST Specify first point:"); }
    onClick(p: Point, snapped: boolean) {
        if (!this.p1) { this.p1 = p; this.ctx.setMessage("DIST Specify second point:"); }
        else {
            const finalP = applyOrthoConstraint(p, this.p1, this.ctx.getSettings().ortho, snapped);
            const d = distance(this.p1, finalP);
            this.ctx.addLog(`DISTANCE: ${formatLength(d, this.ctx.getSettings().units === 'imperial')}`);
            this.ctx.onFinish();
        }
    }
    onMove(p: Point, snapped: boolean) {
        if (this.p1) {
            const finalP = applyOrthoConstraint(p, this.p1, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.p1.x, y1:this.p1.y, x2:finalP.x, y2:finalP.y} as any]);
        }
    }
    onEnter() {} onCancel() {}
}

export class AreaCommand implements CADCommand {
    name = "AREA"; public pts: Point[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("AREA Specify first corner point:"); }
    onClick(p: Point) {
        this.pts.push(p);
        this.ctx.setMessage(`AREA Specify next point or <Enter to finish> [Points: ${this.pts.length}]`);
    }
    onMove(p: Point) {
        if (this.pts.length > 0) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'pline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, p], closed: true} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 2) {
            const a = calculateArea(this.pts);
            this.ctx.addLog(`AREA: ${a.toFixed(2)} sq units`);
        }
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class DimensionCommand implements CADCommand {
    name = "DIM";
    public p1: Point | null = null;
    public p2: Point | null = null;
    private center: Point | null = null;
    
    constructor(public ctx: CommandContext, private dimType: DimensionType = 'linear') {
        this.name = `DIM_${dimType.toUpperCase()}`;
    }

    onStart() {
        if (this.dimType === 'radius' || this.dimType === 'diameter') {
            this.ctx.setMessage(`${this.name} Specify center point:`);
        } else if (this.dimType === 'ordinate') {
            this.ctx.setMessage(`${this.name} Specify point of interest (Origin):`);
        } else {
            this.ctx.setMessage(`${this.name} Specify first extension line origin:`);
        }
    }

    onClick(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        const appSettings = this.ctx.getSettings();

        if (this.dimType === 'radius' || this.dimType === 'diameter' || this.dimType === 'angular' || this.dimType === 'arc') {
            if (!this.center) {
                this.center = p;
                if (this.dimType === 'angular') this.ctx.setMessage(`${this.name} Specify first point on angle:`);
                else if (this.dimType === 'arc') this.ctx.setMessage(`${this.name} Specify first point of arc:`);
                else this.ctx.setMessage(`${this.name} Specify point on circle/arc:`);
            } else if (!this.p1 && (this.dimType === 'angular' || this.dimType === 'arc')) {
                this.p1 = p;
                this.ctx.setMessage(`${this.name} Specify second point:`);
            } else {
                const d = distance(this.center, p);
                let val = d;
                let prefix = '';
                if (this.dimType === 'radius') prefix = 'R';
                else if (this.dimType === 'diameter') { prefix = 'Ø'; val = d * 2; }
                else if (this.p1) {
                   const a1 = Math.atan2(this.p1.y - this.center.y, this.p1.x - this.center.x);
                   const a2 = Math.atan2(p.y - this.center.y, p.x - this.center.x);
                   let diff = Math.abs(a2 - a1);
                   if (diff > Math.PI) diff = 2 * Math.PI - diff;
                   
                   if (this.dimType === 'arc') {
                       prefix = '⌒';
                       val = d * diff;
                   } else if (this.dimType === 'angular') {
                       val = diff * 180 / Math.PI;
                       prefix = '';
                       const s: DimensionShape = {
                           id: generateId(), type: 'dimension', dimType: this.dimType,
                           layer: style.layer, color: style.color,
                           x1: this.center.x, y1: this.center.y,
                           x2: p.x, y2: p.y, dimX: p.x, dimY: p.y,
                           text: `${formatLength(val, false)}°`,
                           styleId: appSettings.activeDimStyle
                       };
                       this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                       this.ctx.onFinish();
                       return;
                   }
                }
                
                const s: DimensionShape = {
                    id: generateId(),
                    type: 'dimension',
                    dimType: this.dimType,
                    layer: style.layer,
                    color: style.color,
                    x1: this.center.x, y1: this.center.y,
                    x2: p.x, y2: p.y,
                    dimX: p.x, dimY: p.y,
                    text: `${prefix}${formatLength(val, appSettings.units === 'imperial')}`,
                    styleId: appSettings.activeDimStyle
                };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
            }
            return;
        }

        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage(`${this.name} ${this.dimType === 'ordinate' ? 'Specify leader location:' : 'Specify second extension line origin:'}`);
        } else if (this.dimType === 'ordinate') {
            const val = this.calculateDist(this.p1, this.p1, p);
            const s: DimensionShape = { 
                id: generateId(), 
                type: 'dimension', 
                dimType: this.dimType,
                layer: style.layer, 
                color: style.color, 
                x1: this.p1.x, y1: this.p1.y, 
                x2: p.x, y2: p.y, 
                dimX: p.x, dimY: p.y, 
                text: formatLength(val, appSettings.units === 'imperial'),
                styleId: appSettings.activeDimStyle
            };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        } else if (!this.p2) { 
            const finalP = applyOrthoConstraint(p, this.p1, this.ctx.getSettings().ortho, snapped);
            this.p2 = finalP; 
            this.ctx.setMessage(`${this.name} Specify dimension line location:`); 
        }
        else {
            const d = this.calculateDist(this.p1, this.p2, p);
            const s: DimensionShape = { 
                id: generateId(), 
                type: 'dimension', 
                dimType: this.dimType,
                layer: style.layer, 
                color: style.color, 
                x1: this.p1.x, y1: this.p1.y, 
                x2: this.p2.x, y2: this.p2.y, 
                dimX: p.x, dimY: p.y, 
                text: formatLength(d, appSettings.units === 'imperial'),
                styleId: appSettings.activeDimStyle
            };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }

    private calculateDist(p1: Point, p2: Point, loc: Point): number {
        if (this.dimType === 'ordinate') {
            const dx = Math.abs(loc.x - p1.x);
            const dy = Math.abs(loc.y - p1.y);
            return dx > dy ? p1.x : p1.y;
        }
        if (this.dimType === 'aligned') return distance(p1, p2);
        if (this.dimType === 'linear') {
            const dx = Math.abs(p2.x - p1.x);
            const dy = Math.abs(p2.y - p1.y);
            const vdx = Math.abs(loc.x - (p1.x + p2.x)/2);
            const vdy = Math.abs(loc.y - (p1.y + p2.y)/2);
            return vdx > vdy ? dy : dx;
        }
        return distance(p1, p2);
    }
    onMove(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        const appSettings = this.ctx.getSettings();

        if (this.dimType === 'radius' || this.dimType === 'diameter' || this.dimType === 'angular' || this.dimType === 'arc') {
            if (this.center) {
                const d = distance(this.center, p);
                let val = d;
                let prefix = '';
                let text = '';
                if (this.dimType === 'radius') { prefix = 'R'; text = `${prefix}${formatLength(val, appSettings.units === 'imperial')}`; }
                else if (this.dimType === 'diameter') { prefix = 'Ø'; val = d * 2; text = `${prefix}${formatLength(val, appSettings.units === 'imperial')}`; }
                else if (this.p1) {
                    const a1 = Math.atan2(this.p1.y - this.center.y, this.p1.x - this.center.x);
                    const a2 = Math.atan2(p.y - this.center.y, p.x - this.center.x);
                    let diff = Math.abs(a2 - a1);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    if (this.dimType === 'arc') {
                        prefix = '⌒';
                        text = `${prefix}${formatLength(d * diff, appSettings.units === 'imperial')}`;
                    } else if (this.dimType === 'angular') {
                        text = `${formatLength(diff * 180 / Math.PI, false)}°`;
                    }
                } else {
                    text = this.dimType.toUpperCase();
                }

                this.ctx.setPreview([{
                    id: 'p', type: 'dimension', isPreview: true,
                    dimType: this.dimType,
                    layer: style.layer, color: style.color,
                    x1: this.center.x, y1: this.center.y, x2: p.x, y2: p.y,
                    dimX: p.x, dimY: p.y,
                    text: text,
                    styleId: appSettings.activeDimStyle
                } as any]);
            }
            return;
        }

        if (this.dimType === 'ordinate') {
            if (this.p1) {
                const dx = Math.abs(p.x - this.p1.x);
                const dy = Math.abs(p.y - this.p1.y);
                const isXType = dx > dy;
                const val = isXType ? this.p1.x : this.p1.y;
                this.ctx.setPreview([{
                    id: 'p', type: 'dimension', isPreview: true,
                    dimType: this.dimType,
                    layer: style.layer, color: style.color,
                    x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                    dimX: p.x, dimY: p.y,
                    text: formatLength(val, appSettings.units === 'imperial'),
                    styleId: appSettings.activeDimStyle
                } as any]);
            }
            return;
        }

        if (this.p1 && !this.p2) {
            const finalP = applyOrthoConstraint(p, this.p1, appSettings.ortho, snapped);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.p1.x, y1:this.p1.y, x2:finalP.x, y2:finalP.y} as any]);
        } else if (this.p1 && this.p2) {
            const d = this.calculateDist(this.p1, this.p2, p);
            this.ctx.setPreview([{
                id: 'p', 
                type: 'dimension', 
                dimType: this.dimType,
                isPreview: true, 
                layer: style.layer, 
                color: style.color, 
                x1: this.p1.x, y1: this.p1.y, 
                x2: this.p2.x, y2: this.p2.y, 
                dimX: p.x, dimY: p.y, 
                text: formatLength(d, appSettings.units === 'imperial'),
                styleId: appSettings.activeDimStyle
            } as any]);
        }
    }
    onEnter() {}
    onCancel() { this.ctx.onFinish(); }
}

export class TextCommand implements CADCommand {
    name = "TEXT"; public point: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("TEXT Specify start point of text:"); }
    onClick(p: Point) {
        this.point = p;
        this.ctx.setMessage("TEXT Enter text content:");
    }
    onInput(text: string): boolean {
        if (this.point) {
            const style = getStyleSettings(this.ctx);
            const s: TextShape = { id: generateId(), type: 'text', layer: style.layer, color: style.color, x: this.point.x, y: this.point.y, content: text, size: style.textSize };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
            return true;
        }
        return false;
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class MTextCommand implements CADCommand {
    name = "MTEXT"; public point: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("MTEXT Specify first corner:"); }
    onClick(p: Point) {
        if (!this.point) { this.point = p; this.ctx.setMessage("MTEXT Specify opposite corner:"); }
        else {
            if (this.ctx.onExternalRequest) {
                this.ctx.onExternalRequest('mtext_editor', "", (content, props) => {
                    if (content) {
                        const style = getStyleSettings(this.ctx);
                        const s: MTextShape = { 
                            id: generateId(), 
                            type: 'mtext', 
                            layer: style.layer, 
                            color: style.color, 
                            x: Math.min(this.point!.x, p.x), 
                            y: Math.max(this.point!.y, p.y), 
                            width: Math.abs(p.x - this.point!.x), 
                            size: props?.size || style.textSize, 
                            rotation: props?.rotation || style.textRotation,
                            justification: props?.justification || style.textJustification as any,
                            content 
                        };
                        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                    }
                    this.ctx.onFinish();
                });
            } else { this.ctx.onFinish(); }
        }
    }
    onMove(p: Point) {
        if (this.point) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'rect', isPreview:true, layer: style.layer, color: style.color, x: Math.min(this.point.x, p.x), y: Math.min(this.point.y, p.y), width: Math.abs(p.x - this.point.x), height: Math.abs(p.y - this.point.y)} as any]);
        }
    }
    onEnter() {} onCancel() {}
}

export class PanCommand implements CADCommand {
    name = "PAN"; constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("PAN active. Drag canvas to move view."); }
    onClick() {} onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class OffsetCommand implements CADCommand {
    name = "OFFSET"; public dist: number = 0; public target: Shape | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("OFFSET Specify offset distance:"); }
    onInput(text: string): boolean {
        if (this.dist === 0) {
            const d = parseLength(text, this.ctx.getSettings().units === 'imperial');
            if (!isNaN(d) && d > 0) { this.dist = d; this.ctx.setMessage("OFFSET Select object to offset:"); return true; }
        }
        return false;
    }
    onClick(p: Point) {
        if (this.dist === 0) return;
        if (!this.target) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) { this.target = hit; this.ctx.setMessage("OFFSET Specify point on side to offset:"); }
        } else {
            const off = offsetShape(this.target, this.dist, p);
            if (off) {
                const style = getStyleSettings(this.ctx);
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), off]}));
                this.ctx.addLog(`OFFSET_CREATED: ${this.target.type}`);
            }
            // Reset target but keep distance for next object
            this.target = null;
            this.ctx.setMessage("OFFSET Select object to offset:");
        }
    }
    onMove() {} 
    onEnter() { this.ctx.onFinish(); } 
    onCancel() { this.ctx.onFinish(); }
}

export class RayCommand implements CADCommand {
    name = "RAY"; p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("RAY Specify start point:"); }
    onClick(p: Point) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("RAY Specify through point:");
        } else {
            const layer = getStyleSettings(this.ctx).layer;
            const shape: InfiniteLineShape = {
                id: generateId(), type: 'ray', layer, color: getStyleSettings(this.ctx).color,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                thickness: getStyleSettings(this.ctx).thickness, lineType: getStyleSettings(this.ctx).lineType
            };
            this.ctx.setLayers(prev => ({ ...prev, [layer]: [...(prev[layer] || []), shape] }));
            this.p1 = null;
            this.ctx.setMessage("RAY Specify start point:");
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id: 'preview', type: 'ray', isPreview: true,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                color: style.color, layer: style.layer
            } as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class XLineCommand implements CADCommand {
    name = "XLINE"; p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("XLINE Specify a point or [Hor/Ver/Ang/Bisect/Offset]:"); }
    onClick(p: Point) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("XLINE Specify through point:");
        } else {
            const layer = getStyleSettings(this.ctx).layer;
            const shape: InfiniteLineShape = {
                id: generateId(), type: 'xline', layer, color: getStyleSettings(this.ctx).color,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                thickness: getStyleSettings(this.ctx).thickness, lineType: getStyleSettings(this.ctx).lineType
            };
            this.ctx.setLayers(prev => ({ ...prev, [layer]: [...(prev[layer] || []), shape] }));
            this.p1 = null;
            this.ctx.setMessage("XLINE Specify a point:");
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id: 'preview', type: 'xline', isPreview: true,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                color: style.color, layer: style.layer
            } as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class FilletCommand implements CADCommand {
    name = "FILLET"; radius: number = 0; s1: Shape | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("FILLET Select first object or [Radius]:"); }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'r' || t === 'radius') { this.ctx.setMessage("FILLET Specify fillet radius:"); return true; }
        const r = parseLength(text, this.ctx.getSettings().units === 'imperial');
        if (!isNaN(r)) { this.radius = r; this.ctx.setMessage("FILLET Select first object:"); return true; }
        return false;
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (!hit) return;

        if (!this.s1) {
            this.s1 = hit;
            this.ctx.setSelectedIds([hit.id]);
            this.ctx.setMessage("FILLET Select second object:");
        } else {
            if (this.s1.id === hit.id) return;
            if (this.s1.type === 'line' && hit.type === 'line') {
                const res = filletLines(this.s1, hit, this.radius);
                if (res) {
                    this.ctx.setLayers(prev => {
                        const next = { ...prev };
                        Object.keys(next).forEach(l => {
                            next[l] = next[l].filter(s => s.id !== this.s1!.id && s.id !== hit.id);
                        });
                        const layer = getStyleSettings(this.ctx).layer;
                        next[layer] = [...(next[layer] || []), res.l1, res.l2];
                        if (res.arc) next[layer] = [...next[layer], res.arc];
                        return next;
                    });
                }
            }
            this.ctx.onFinish();
        }
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class TrimCommand implements CADCommand {
    name = "TRIM"; public cutters: Shape[] = []; selectingCutters = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        this.ctx.setMessage("TRIM Select cutting edges or <Enter to select all>:"); 
        this.ctx.setSelectedIds([]);
    }
    onClick(p: Point) {
        const all = Object.values(this.ctx.getLayers()).flat();
        const ts = this.ctx.getViewState().scale; 
        const threshold = 15 / ts;
        const hit = all.find(s => hitTestShape(p.x, p.y, s, threshold, this.ctx.getBlocks()));
        
        if (this.selectingCutters) {
            if (hit) {
                if (!this.cutters.find(c => c.id === hit.id)) {
                    this.cutters.push(hit);
                    this.ctx.setSelectedIds(this.cutters.map(c => c.id));
                    this.ctx.setMessage(`TRIM ${this.cutters.length} selected. Select more or <Enter> to continue:`);
                }
            }
        } else {
            if (hit) {
                const results = getTrimmedShapes(this.cutters, [hit], p);
                if (results.length > 0) {
                    this.ctx.setLayers(prev => {
                        const next = { ...prev };
                        Object.keys(next).forEach(l => {
                            const filtered = next[l].filter(s => s.id !== hit.id);
                            const added = results.filter(rs => rs.layer === l || (!rs.layer && l === hit.layer));
                            next[l] = [...filtered, ...added];
                        });
                        return next;
                    });
                    // After trimming, we stay in trim mode to allow more trims
                    this.ctx.setMessage("TRIM Select object to trim:");
                }
            }
        }
    }
    onMove() {}
    onEnter() {
        if (this.selectingCutters) {
            if (this.cutters.length === 0) {
                this.cutters = Object.values(this.ctx.getLayers()).flat();
            }
            this.selectingCutters = false;
            this.ctx.setSelectedIds([]);
            this.ctx.setMessage("TRIM Select object to trim:");
        } else {
            this.ctx.onFinish();
        }
    }
    onCancel() { this.ctx.onFinish(); }
}

export class LeaderCommand implements CADCommand {
    name = "LEADER"; public p1: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("LEADER Specify leader start point:"); }
    onClick(p: Point) {
        if (!this.p1) { this.p1 = p; this.ctx.setMessage("LEADER Specify leader end point:"); }
        else {
            const style = getStyleSettings(this.ctx);
            const s: LeaderShape = { id: generateId(), type: 'leader', layer: style.layer, color: style.color, x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y, text: "NOTE", size: style.textSize };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.p1.x, y1:this.p1.y, x2:p.x, y2:p.y} as any]);
        }
    }
    onEnter() {} onCancel() {}
}

export class SelectCommand implements CADCommand {
    name = "SELECT"; constructor(public ctx: CommandContext) {}
    onStart() { 
        this.ctx.setMessage("SELECT objects:"); 
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (hit) {
            this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
        }
    }
    onMove() {}
    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
}

export class SelectAllCommand implements CADCommand {
    name = "SELECT ALL"; constructor(public ctx: CommandContext) {}
    onStart() {
        const layers = this.ctx.getLayers();
        const allIds = Object.values(layers).flat().map(s => s.id);
        this.ctx.setSelectedIds(allIds);
        this.ctx.onFinish();
    }
    onClick() {} onMove() {} onEnter() {} onCancel() {}
}

export class CopyClipCommand implements CADCommand {
    name = "COPYCLIP"; 
    selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() {
        if (this.ctx.getSelectedIds().length > 0) {
            this.selecting = false;
            this.ctx.setMessage("COPYCLIP Specify base point:");
        } else {
            this.selecting = true;
            this.ctx.setMessage("COPYCLIP Select objects:");
        }
    }
    onClick(p: Point) { 
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`COPYCLIP ${this.ctx.getSelectedIds().length} objects selected. <Enter> to continue:`);
            }
        } else {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat();
            clipboardBuffer = JSON.parse(JSON.stringify(all.filter(s => ids.includes(s.id))));
            clipboardBasePoint = p; 
            this.ctx.onFinish(); 
        }
    }
    onMove() {} 
    onEnter() {
        if (this.selecting) {
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false;
                this.ctx.setMessage("COPYCLIP Specify base point:");
            } else {
                this.ctx.onFinish();
            }
        } else {
            this.ctx.onFinish();
        }
    }
    onCancel() { this.ctx.onFinish(); }
}

export class CutClipCommand implements CADCommand {
    name = "CUTCLIP"; 
    selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() {
        if (this.ctx.getSelectedIds().length > 0) {
            this.selecting = false;
            this.ctx.setMessage("CUTCLIP Specify base point:");
        } else {
            this.selecting = true;
            this.ctx.setMessage("CUTCLIP Select objects:");
        }
    }
    onClick(p: Point) { 
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`CUTCLIP ${this.ctx.getSelectedIds().length} objects selected. <Enter> to continue:`);
            }
        } else {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat();
            clipboardBuffer = JSON.parse(JSON.stringify(all.filter(s => ids.includes(s.id))));
            
            // Remove from layers
            this.ctx.setLayers(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(l => next[l] = next[l].filter(s => !ids.includes(s.id)));
                return next;
            });
            
            clipboardBasePoint = p; 
            this.ctx.onFinish(); 
        }
    }
    onMove() {} 
    onEnter() {
        if (this.selecting) {
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false;
                this.ctx.setMessage("CUTCLIP Specify base point:");
            } else {
                this.ctx.onFinish();
            }
        } else {
            this.ctx.onFinish();
        }
    }
    onCancel() { this.ctx.onFinish(); }
}

export class PasteClipCommand implements CADCommand {
    name = "PASTECLIP"; constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("PASTECLIP Specify insertion point:"); }
    onClick(p: Point) {
        const dx = p.x - clipboardBasePoint.x, dy = p.y - clipboardBasePoint.y;
        const style = getStyleSettings(this.ctx);
        const newShapes = clipboardBuffer.map(s => ({...moveShape(s, dx, dy), id: generateId(), layer: style.layer}));
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), ...newShapes]}));
        this.ctx.onFinish();
    }
    onMove(p: Point) {
        const dx = p.x - clipboardBasePoint.x, dy = p.y - clipboardBasePoint.y;
        this.ctx.setPreview(clipboardBuffer.map(s => ({...moveShape(s, dx, dy), isPreview: true} as any)));
    }
    onEnter() {} onCancel() {}
}

export class StretchCommand implements CADCommand {
    name = "STRETCH"; 
    public p1: Point | null = null; 
    public p2: Point | null = null;
    public base: Point | null = null;
    public selectedShapes: Shape[] = [];

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("STRETCH Select objects to stretch (Crossing Window):"); 
    }

    onClick(p: Point, snapped: boolean) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("STRETCH Specify opposite corner:");
        } else if (!this.p2) {
            this.p2 = p;
            const xMin = Math.min(this.p1.x, this.p2.x), xMax = Math.max(this.p1.x, this.p2.x);
            const yMin = Math.min(this.p1.y, this.p2.y), yMax = Math.max(this.p1.y, this.p2.y);
            const all = Object.values(this.ctx.getLayers()).flat();
            // Use getShapesInRect but specifically for crossing (true)
            this.selectedShapes = getShapesInRect(this.p1, this.p2, all, true);
            this.ctx.setMessage("STRETCH Specify base point:");
        } else if (!this.base) {
            this.base = p;
            this.ctx.setMessage("STRETCH Specify second point:");
        } else {
            const finalP = applyOrthoConstraint(p, this.base, this.ctx.getSettings().ortho, snapped);
            const dx = finalP.x - this.base.x, dy = finalP.y - this.base.y;
            const xMin = Math.min(this.p1.x, this.p2.x), xMax = Math.max(this.p1.x, this.p2.x);
            const yMin = Math.min(this.p1.y, this.p2.y), yMax = Math.max(this.p1.y, this.p2.y);
            
            this.ctx.setLayers(prev => {
                const next = { ...prev };
                const ids = this.selectedShapes.map(s => s.id);
                Object.keys(next).forEach(l => {
                    next[l] = next[l].map(s => ids.includes(s.id) ? stretchShape(s, xMin, yMin, xMax, yMax, dx, dy) : s);
                });
                return next;
            });
            this.ctx.onFinish();
        }
    }

    onMove(p: Point, snapped: boolean) {
        if (this.p1 && !this.p2) {
            // Visualize crossing selection window (Green dashed)
            const x = Math.min(this.p1.x, p.x), y = Math.min(this.p1.y, p.y);
            const w = Math.abs(p.x - this.p1.x), h = Math.abs(p.y - this.p1.y);
            this.ctx.setPreview([{
                id:'p', type:'rect', isPreview:true, 
                layer: 'defpoints', color: 'rgba(0, 255, 127, 0.8)', 
                filled: true,
                x, y, width: w, height: h
            } as any]);
        } else if (this.base && this.p1 && this.p2) {
            const finalP = applyOrthoConstraint(p, this.base, this.ctx.getSettings().ortho, snapped);
            const dx = finalP.x - this.base.x, dy = finalP.y - this.base.y;
            const xMin = Math.min(this.p1.x, this.p2.x), xMax = Math.max(this.p1.x, this.p2.x);
            const yMin = Math.min(this.p1.y, this.p2.y), yMax = Math.max(this.p1.y, this.p2.y);
            
            this.ctx.setPreview(this.selectedShapes.map(s => ({
                ...stretchShape(s, xMin, yMin, xMax, yMax, dx, dy),
                isPreview: true
            } as any)));
        }
    }

    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
}

export class HatchCommand implements CADCommand {
    name = "HATCH"; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) {
            this.applyHatch();
        } else {
            this.ctx.setMessage("HATCH Select closed shapes to fill:"); 
        }
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => ['rect', 'circle', 'pline', 'polygon', 'ellipse'].includes(s.type) && hitTestShape(p.x, p.y, s, 15/ts));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`HATCH ${this.ctx.getSelectedIds().length} selected. <Enter> to fill:`);
            }
        }
    }
    onMove() {}
    onEnter() {
        if (this.selecting && this.ctx.getSelectedIds().length > 0) {
            this.applyHatch();
        } else {
            this.ctx.onFinish();
        }
    }
    applyHatch() {
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].map(s => ids.includes(s.id) ? { ...s, filled: true } : s);
            });
            return next;
        });
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class RotateCommand implements CADCommand {
    name = "ROTATE"; base: Point | null = null; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { this.selecting = false; this.ctx.setMessage("ROTATE Specify base point:"); }
        else { this.selecting = true; this.ctx.setMessage("ROTATE Select objects:"); }
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`ROTATE ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.base) {
            this.base = p; this.ctx.setMessage("ROTATE Specify rotation angle:");
        } else {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            this.applyRotate(Math.atan2(dy, dx));
        }
    }
    onMove(p: Point) {
        if (this.base) {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            const angle = Math.atan2(dy, dx);
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            this.ctx.setPreview(all.map(s => ({...rotateShape(s, this.base!, angle), isPreview: true} as any)));
        }
    }
    applyRotate(angle: number) {
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].map(s => ids.includes(s.id) ? rotateShape(s, this.base!, angle) : s);
            });
            return next;
        });
        this.ctx.onFinish();
    }
    onEnter() { if (this.selecting) { this.selecting = false; this.ctx.setMessage("ROTATE Specify base point:"); } }
    onCancel() { this.ctx.onFinish(); }
}

export class ScaleCommand implements CADCommand {
    name = "SCALE"; base: Point | null = null; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { this.selecting = false; this.ctx.setMessage("SCALE Specify base point:"); }
        else { this.selecting = true; this.ctx.setMessage("SCALE Select objects:"); }
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`SCALE ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.base) {
            this.base = p; this.ctx.setMessage("SCALE Specify scale factor:");
        } else {
            const d1 = 100, d2 = distance(this.base, p);
            this.applyScale(d2 / d1);
        }
    }
    onMove(p: Point) {
        if (this.base) {
            const d1 = 100, d2 = distance(this.base, p);
            const factor = d2 / d1;
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            this.ctx.setPreview(all.map(s => ({...scaleShape(s, this.base!, factor), isPreview: true} as any)));
        }
    }
    applyScale(factor: number) {
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].map(s => ids.includes(s.id) ? scaleShape(s, this.base!, factor) : s);
            });
            return next;
        });
        this.ctx.onFinish();
    }
    onEnter() { if (this.selecting) { this.selecting = false; this.ctx.setMessage("SCALE Specify base point:"); } }
    onCancel() { this.ctx.onFinish(); }
}

export class MirrorCommand implements CADCommand {
    name = "MIRROR"; p1: Point | null = null; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { this.selecting = false; this.ctx.setMessage("MIRROR Specify first point of mirror line:"); }
        else { this.selecting = true; this.ctx.setMessage("MIRROR Select objects:"); }
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`MIRROR ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.p1) {
            this.p1 = p; this.ctx.setMessage("MIRROR Specify second point of mirror line:");
        } else {
            const ids = this.ctx.getSelectedIds();
            this.ctx.setLayers(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(l => {
                    next[l] = next[l].map(s => ids.includes(s.id) ? mirrorShape(s, this.p1!, p) : s);
                });
                return next;
            });
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            this.ctx.setPreview(all.map(s => ({...mirrorShape(s, this.p1!, p), isPreview: true} as any)));
        }
    }
    onEnter() { if (this.selecting) { this.selecting = false; this.ctx.setMessage("MIRROR Specify first point of mirror line:"); } }
    onCancel() { this.ctx.onFinish(); }
}

export class CopyCommand implements CADCommand {
    name = "COPY"; base: Point | null = null; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { this.selecting = false; this.ctx.setMessage("COPY Specify base point:"); }
        else { this.selecting = true; this.ctx.setMessage("COPY Select objects:"); }
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`COPY ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.base) {
            this.base = p; this.ctx.setMessage("COPY Specify second point:");
        } else {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            const style = getStyleSettings(this.ctx);
            const newShapes = all.map(s => ({...moveShape(s, dx, dy), id: generateId(), layer: style.layer}));
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), ...newShapes]}));
            // Continue copying like standard CAD
            this.ctx.setMessage("COPY Specify next point or <Enter> to finish:");
        }
    }
    onMove(p: Point) {
        if (this.base) {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            this.ctx.setPreview(all.map(s => ({...moveShape(s, dx, dy), isPreview: true} as any)));
        }
    }
    onEnter() { if (this.selecting) { this.selecting = false; this.ctx.setMessage("COPY Specify base point:"); } else { this.ctx.onFinish(); } }
    onCancel() { this.ctx.onFinish(); }
}

export class ExtendCommand implements CADCommand {
    name = "EXTEND"; boundaries: Shape[] = []; selectingBoundaries = true;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setSelectedIds([]); this.ctx.setMessage("EXTEND Select boundary edges or <Enter> to select all:"); }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts));
        if (this.selectingBoundaries) {
            if (hit) {
                if (!this.boundaries.find(b => b.id === hit.id)) {
                    this.boundaries.push(hit);
                    this.ctx.setSelectedIds(this.boundaries.map(b => b.id));
                    this.ctx.setMessage(`EXTEND ${this.boundaries.length} selected. Select more or <Enter> to continue:`);
                }
            }
        } else if (hit) {
            const results = getExtendedShapes(this.boundaries, [hit], p);
            if (results.length > 0) {
                this.ctx.setLayers(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(l => {
                        const filtered = next[l].filter(s => s.id !== hit.id);
                        const added = results.filter(rs => rs.layer === l || (!rs.layer && l === hit.layer));
                        next[l] = [...filtered, ...added];
                    });
                    return next;
                });
                this.ctx.setMessage("EXTEND Select object to extend:");
            }
        }
    }
    onMove() {}
    onEnter() {
        if (this.selectingBoundaries) {
            if (this.boundaries.length === 0) {
                this.boundaries = Object.values(this.ctx.getLayers()).flat();
            }
            this.selectingBoundaries = false;
            this.ctx.setSelectedIds([]);
            this.ctx.setMessage("EXTEND Select object to extend:");
        } else {
            this.ctx.onFinish();
        }
    }
    onCancel() { this.ctx.onFinish(); }
}

export class DonutCommand implements CADCommand {
    name = "DONUT"; public center: Point | null = null;
    public innerR: number = 0;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("DONUT Specify inner diameter <0.00>:"); }
    onInput(text: string): boolean {
        const val = parseLength(text, this.ctx.getSettings().units === 'imperial');
        if (this.center) {
            if (!isNaN(val) && val > 0) { this.addDonut(val / 2); this.ctx.onFinish(); return true; }
        } else if (this.innerR === 0) {
            if (!isNaN(val)) { this.innerR = val / 2; this.ctx.setMessage("DONUT Specify outer diameter <1.00>:"); return true; }
        } else {
            if (!isNaN(val) && val > 0) { this.addDonut(val / 2); this.ctx.onFinish(); return true; }
        }
        return false;
    }
    onClick(p: Point) {
        if (!this.center) {
            this.center = p;
            this.ctx.setMessage("DONUT Specify radius point:");
        } else {
            const r = distance(this.center, p);
            this.addDonut(r);
            this.ctx.onFinish();
        }
    }
    private addDonut(outerR: number) {
        if (!this.center) return;
        const style = getStyleSettings(this.ctx);
        const s: DonutShape = { 
            id: generateId(), type: 'donut', layer: style.layer, color: style.color, 
            x: this.center.x, y: this.center.y, innerRadius: this.innerR, outerRadius: outerR,
            thickness: style.thickness, lineType: style.lineType 
        };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }
    onMove(p: Point) {
        if (this.center) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id:'p', type:'donut', isPreview:true, layer: style.layer, color: style.color, 
                x:this.center.x, y:this.center.y, innerRadius:this.innerR, outerRadius:distance(this.center, p)
            } as any]);
        }
    }
    onEnter() { if (!this.center) { this.innerR = 0; this.ctx.setMessage("DONUT Specify center point:"); } }
    onCancel() { this.ctx.onFinish(); }
}

export class PointCommand implements CADCommand {
    name = "POINT";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("POINT Specify point:"); }
    onClick(p: Point) {
        const style = getStyleSettings(this.ctx);
        const s: PointShape = { id: generateId(), type: 'point', layer: style.layer, color: style.color, x: p.x, y: p.y, size: 10 };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        // Points usually allow multiple placements in one command
        this.ctx.addLog("POINT_CREATED");
    }
    onInput(text: string): boolean {
        const p = resolvePointInput(text, null, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint, this.ctx.getSettings().ortho);
        if (p) { this.onClick(p); return true; }
        return false;
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class ExplodeCommand implements CADCommand {
    name = "EXPLODE"; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { this.applyExplode(); }
        else { this.ctx.setMessage("EXPLODE Select objects:"); }
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts));
        if (hit) {
            this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
            this.applyExplode();
        }
    }
    applyExplode() {
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                const layerShapes = next[l];
                const exploded: Shape[] = [];
                const filtered = layerShapes.filter(s => {
                    if (ids.includes(s.id)) {
                        if (s.type === 'pline' || s.type === 'polygon' || s.type === 'rect') {
                            const pts = s.type === 'rect' ? [{x:s.x, y:s.y}, {x:s.x+s.width, y:s.y}, {x:s.x+s.width, y:s.y+s.height}, {x:s.x, y:s.y+s.height}] : s.points;
                            const closed = (s as any).closed || s.type === 'polygon' || s.type === 'rect';
                            for (let i=0; i<(closed ? pts.length : pts.length-1); i++) {
                                const p1 = pts[i], p2 = pts[(i+1)%pts.length];
                                exploded.push({ id: generateId(), type: 'line', layer: s.layer, color: s.color, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y } as any);
                            }
                            return false;
                        }
                    }
                    return true;
                });
                next[l] = [...filtered, ...exploded];
            });
            return next;
        });
        this.ctx.onFinish();
    }
    onMove() {} onEnter() {} onCancel() {}
}

export class ArrayCommand implements CADCommand {
    name = "ARRAY"; selecting = true;
    public rows: number = 2; public cols: number = 2;
    public rowDist: number = 500; public colDist: number = 500;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length === 0) this.ctx.setMessage("ARRAY Select objects:");
        else this.ctx.setMessage("ARRAY Rows <2>:");
    }
    onInput(text: string): boolean {
        const val = parseFloat(text);
        if (isNaN(val)) return false;
        if (this.ctx.getSelectedIds().length === 0) return false;
        
        if (this.rows === 2 && text !== "2") { this.rows = val; this.ctx.setMessage("ARRAY Columns <2>:"); return true; }
        if (this.cols === 2 && text !== "2") { this.cols = val; this.ctx.setMessage("ARRAY Row distance <500>:"); return true; }
        if (this.rowDist === 500 && text !== "500") { this.rowDist = val; this.ctx.setMessage("ARRAY Col distance <500>:"); return true; }
        this.colDist = val;
        this.applyArray();
        return true;
    }
    onClick(p: Point) {
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 10/this.ctx.getViewState().scale, this.ctx.getBlocks()));
        if (hit) {
            this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
            this.ctx.setMessage("ARRAY Rows <2> (Press Enter for 2):");
        }
    }
    applyArray() {
        const ids = this.ctx.getSelectedIds();
        const style = getStyleSettings(this.ctx);
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            const selectedShapes = Object.values(prev).flat().filter(s => ids.includes(s.id));
            const newShapes: Shape[] = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (r === 0 && c === 0) continue;
                    selectedShapes.forEach(s => {
                        const ns = moveShape(JSON.parse(JSON.stringify(s)), c * this.colDist, r * this.rowDist);
                        ns.id = generateId();
                        newShapes.push(ns);
                    });
                }
            }
            next[style.layer] = [...(next[style.layer] || []), ...newShapes];
            return next;
        });
        this.ctx.onFinish();
    }
    onEnter() { if (this.ctx.getSelectedIds().length > 0) this.applyArray(); }
    onMove() {} onCancel() { this.ctx.onFinish(); }
}

export class BlockCommand implements CADCommand {
    name = "BLOCK"; selecting = true;
    public blockName: string = ""; public basePoint: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length === 0) this.ctx.setMessage("BLOCK Select objects:");
        else this.ctx.setMessage("BLOCK Enter name:");
    }
    onInput(text: string): boolean {
        if (this.ctx.getSelectedIds().length === 0) return false;
        if (!this.blockName) {
            this.blockName = text.trim();
            this.ctx.setMessage("BLOCK Specify base point:");
            return true;
        }
        return false;
    }
    onClick(p: Point) {
        if (this.ctx.getSelectedIds().length === 0) {
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 10/this.ctx.getViewState().scale, this.ctx.getBlocks()));
            if (hit) this.ctx.setSelectedIds(prev => [...prev, hit.id]);
        } else if (!this.blockName) {
            this.ctx.addLog("Please enter block name first");
        } else if (!this.basePoint) {
            this.basePoint = p;
            this.createBlock();
        }
    }
    createBlock() {
        const ids = this.ctx.getSelectedIds();
        const selectedShapes = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
        const block: BlockDefinition = {
            id: generateId(),
            name: this.blockName,
            basePoint: this.basePoint!,
            shapes: selectedShapes.map(s => moveShape(JSON.parse(JSON.stringify(s)), -this.basePoint!.x, -this.basePoint!.y))
        };
        this.ctx.setBlocks(prev => ({ ...prev, [this.blockName]: block }));
        this.ctx.addLog(`BLOCK_CREATED: ${this.blockName}`);
        this.ctx.onFinish();
    }
    onMove() {} onEnter() {} onCancel() { this.ctx.onFinish(); }
}

export class InsertCommand implements CADCommand {
    name = "INSERT";
    blockName: string = "";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("INSERT Enter block name:"); }
    onInput(text: string): boolean {
        if (!this.blockName) {
            const blocks = this.ctx.getBlocks();
            const name = text.trim();
            if (blocks[name]) {
                this.blockName = name;
                this.ctx.setMessage(`INSERT ${this.blockName} Specify base point:`);
                return true;
            }
            this.ctx.setMessage("BLOCK_NOT_FOUND. Try again:");
            return false;
        }
        return false;
    }
    onClick(p: Point) {
        if (this.blockName) {
            const style = getStyleSettings(this.ctx);
            const s: Shape = {
                id: generateId(),
                type: 'block',
                blockId: this.blockName,
                x: p.x,
                y: p.y,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                layer: style.layer,
                color: style.color
            } as any;
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.blockName) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{
                id: 'preview',
                type: 'block',
                blockId: this.blockName,
                x: p.x,
                y: p.y,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                layer: style.layer,
                color: style.color,
                isPreview: true
            } as any]);
        }
    }
    onEnter() {} onCancel() { this.ctx.onFinish(); }
}

export class FilterCommand implements CADCommand {
    name = "FILTER";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("FILTER Enter type (line, circle, etc.):"); }
    onInput(text: string): boolean {
        const type = text.trim().toLowerCase();
        const all = Object.values(this.ctx.getLayers()).flat();
        const filtered = all.filter(s => s.type === type).map(s => s.id);
        this.ctx.setSelectedIds(filtered);
        this.ctx.addLog(`FILTERED: ${filtered.length} objects`);
        this.ctx.onFinish();
        return true;
    }
    onClick() {} onMove() {} onEnter() {} onCancel() { this.ctx.onFinish(); }
}

export class LayoutCommand implements CADCommand {
    name = "LAYOUT";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("LAYOUT (New/Set/Delete) <Set>:"); }
    onInput(text: string): boolean {
        const cmd = text.trim().toLowerCase();
        if (cmd === 'new') {
            const layouts = this.ctx.getLayouts();
            const id = 'layout' + (layouts.length + 1);
            const name = 'Layout' + (layouts.length + 1);
            this.ctx.setLayouts([...layouts, { id, name, paperSize: { width: 297, height: 210 }, viewports: [] }]);
            this.ctx.addLog(`LAYOUT_CREATED: ${name}`);
            this.ctx.onFinish();
            return true;
        } else if (cmd === 'delete') {
            this.ctx.setMessage("LAYOUT Delete name:");
            return true;
        } else {
            const layouts = this.ctx.getLayouts();
            const l = layouts.find(lo => lo.name.toLowerCase() === cmd || lo.id.toLowerCase() === cmd);
            if (l) {
                this.ctx.onExternalRequest?.('set_active_tab', l.id, () => {});
                this.ctx.onFinish();
                return true;
            }
            if (cmd === 'model') {
                this.ctx.onExternalRequest?.('set_active_tab', 'model', () => {});
                this.ctx.onFinish();
                return true;
            }
        }
        return false;
    }
    onClick() {} onMove() {} onEnter() {} onCancel() { this.ctx.onFinish(); }
}

export class FindCommand implements CADCommand {
    name = "FIND";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("FIND Enter text to search:"); }
    onInput(text: string): boolean {
        const search = text.trim().toLowerCase();
        const all = Object.values(this.ctx.getLayers()).flat();
        const found = all.filter(s => (s.type === 'text' || s.type === 'mtext') && s.content.toLowerCase().includes(search));
        if (found.length > 0) {
            this.ctx.setSelectedIds(found.map(s => s.id));
            const f = found[0] as any;
            this.ctx.setView({ scale: 0.1, originX: -f.x, originY: -f.y });
            this.ctx.addLog(`FOUND: ${found.length} items`);
        } else {
            this.ctx.addLog("NO_MATCHING_TEXT_FOUND");
        }
        this.ctx.onFinish();
        return true;
    }
    onClick() {} onMove() {} onEnter() {} onCancel() { this.ctx.onFinish(); }
}
