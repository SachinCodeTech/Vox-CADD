
import { Shape, Point, AppSettings, LayerConfig, LineShape, CircleShape, RectShape, ArcShape, PolyShape, TextShape, MTextShape, EllipseShape, DimensionShape, AngularDimensionShape, PointShape, InfiniteLineShape, DonutShape, LeaderShape, ViewState, DoubleLineShape, DLineJustification, TextJustification, LineType } from '../types';
import { generateId, getCircleFrom3Points, formatLength, parseLength, hitTestShape, distance, getTrimmedShapes, moveShape, resolvePointInput, calculateArea, offsetShape, getPolygonPoints } from './cadService';

export interface CommandContext {
    getSettings: () => AppSettings;
    getLayers: () => Record<string, Shape[]>; 
    getLayerConfig: () => Record<string, LayerConfig>;
    getSelectedIds: () => string[]; 
    setLayers: (cb: (prev: Record<string, Shape[]>) => Record<string, Shape[]>) => void;
    setSelectedIds: (ids: string[]) => void;
    setPreview: (shapes: Shape[] | null) => void; 
    setMessage: (msg: string | null) => void;
    addLog: (msg: string) => void; 
    setView: (updater: ViewState | ((v: ViewState) => ViewState)) => void;
    getViewState: () => ViewState;
    onFinish: () => void;
    lastMousePoint: Point;
    start: (cmd: CADCommand) => void;
    onExternalRequest?: (type: string, data: any, callback: (result: any) => void) => void;
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
        textSize: settings.textSize || 250
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
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint);
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
    name = "DLINE"; public pts: Point[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("DLINE Specify start point:"); }
    onClick(p: Point) {
        this.pts.push(p);
        this.ctx.setMessage("DLINE Next point or <Enter to finish>");
    }
    onMove(p: Point) {
        if (this.pts.length > 0) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'dline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, p], thickness: 300, justification: 'zero'} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: DoubleLineShape = { id: generateId(), type: 'dline', layer: style.layer, color: style.color, points: this.pts, thickness: 300, justification: 'zero' };
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
    onClick(p: Point) {
        this.pts.push(p);
        this.ctx.setMessage("PLINE Next point or <Enter to finish>");
    }
    onMove(p: Point) {
        if (this.pts.length > 0) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'pline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, p]} as any]);
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
        const p = resolvePointInput(text, last, this.ctx.getSettings().units === 'imperial', this.ctx.lastMousePoint);
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

        this.pts.push(p);
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
                if (hitTestShape(p.x, p.y, shape, threshold)) return shape;
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

    onMove(p: Point) {
        const style = getStyleSettings(this.ctx);
        if (this.mode === 'default' && this.pts.length === 1) {
            this.ctx.setPreview([{id:'p', type:'circle', isPreview:true, layer: style.layer, color: style.color, x: this.pts[0].x, y: this.pts[0].y, radius: distance(this.pts[0], p)} as any]);
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
    public mode: '3p' | 'sce' | 'ser' = '3p';
    
    constructor(public ctx: CommandContext) {}
    
    onStart() { 
        this.ctx.setMessage("ARC Specify start point or [Center/End]:"); 
    }
    
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (this.pts.length === 0) {
            if (t === 'c' || t === 'center') {
                this.mode = 'sce';
                this.ctx.setMessage("ARC Specify center point:");
                return true;
            }
        } else if (this.pts.length === 1) {
            if (t === 'c' || t === 'center') {
                this.mode = 'sce';
                this.ctx.setMessage("ARC Specify center point:");
                return true;
            }
            if (t === 'e' || t === 'end') {
                this.mode = 'ser';
                this.ctx.setMessage("ARC Specify end point:");
                return true;
            }
            if (t === '3p') {
                this.mode = '3p';
                this.ctx.setMessage("ARC Specify second point (on arc):");
                return true;
            }
        } else if (this.pts.length === 2 && this.mode === 'ser') {
            const r = parseFloat(text);
            if (!isNaN(r) && r > 0) {
                this.createSerArc(this.pts[0], this.pts[1], r);
                // Continuous logic for SER mode
                const lastPoint = this.pts[1];
                this.pts = [lastPoint];
                this.ctx.setMessage("ARC Specify end point:");
                return true;
            }
        }
        return false;
    }

    onClick(p: Point) {
        this.pts.push(p);
        const style = getStyleSettings(this.ctx);

        if (this.mode === '3p') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("ARC Specify second point (on arc) or [Center/End]:");
            } else if (this.pts.length === 2) {
                this.ctx.setMessage("ARC Specify end point:");
            } else {
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
                // Continuous logic: last point becomes the new start point
                const lastPoint = this.pts[2];
                this.pts = [lastPoint];
                this.ctx.setMessage("ARC Specify second point (on arc) or [Center/End]:");
            }
        } else if (this.mode === 'sce') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("ARC Specify center point:");
            } else if (this.pts.length === 2) {
                this.ctx.setMessage("ARC Specify end point:");
            } else {
                const start = this.pts[0];
                const center = this.pts[1];
                const end = this.pts[2];
                const radius = distance(center, start);
                const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
                
                const cp = (start.x - center.x) * (end.y - center.y) - (start.y - center.y) * (end.x - center.x);
                const counterClockwise = cp > 0;
                
                const s: ArcShape = { 
                    id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
                    x: center.x, y: center.y, radius, 
                    startAngle, endAngle, 
                    counterClockwise,
                    thickness: style.thickness, lineType: style.lineType 
                };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                
                // Continuous logic: last point becomes the new start point
                const lastPoint = this.pts[2];
                this.pts = [lastPoint];
                this.ctx.setMessage("ARC Specify center point:");
            }
        } else if (this.mode === 'ser') {
            if (this.pts.length === 1) {
                this.ctx.setMessage("ARC Specify end point:");
            } else if (this.pts.length === 2) {
                this.ctx.setMessage("ARC Specify radius point or enter radius:");
            } else {
                const r = distance(this.pts[0], this.pts[2]);
                this.createSerArc(this.pts[0], this.pts[1], r);
                
                // Continuous logic: end point becomes the new start point
                const lastPoint = this.pts[1];
                this.pts = [lastPoint];
                this.ctx.setMessage("ARC Specify end point:");
            }
        }
    }

    private createSerArc(start: Point, end: Point, radius: number) {
        const d = distance(start, end);
        if (radius < d/2) {
            this.ctx.addLog("Radius too small for start/end points.");
            return;
        }
        const style = getStyleSettings(this.ctx);
        const mid = { x: (start.x + end.x)/2, y: (start.y + end.y)/2 };
        const h = Math.sqrt(radius*radius - (d/2)*(d/2));
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        
        // AutoCAD draws CCW. There are two possible centers. 
        // We pick the one that makes the arc CCW.
        const center = {
            x: mid.x - h * Math.sin(angle),
            y: mid.y + h * Math.cos(angle)
        };
        
        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
        const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

        // Determine direction dynamically
        const cp = (start.x - center.x) * (end.y - center.y) - (start.y - center.y) * (end.x - center.x);
        const counterClockwise = cp > 0;

        const s: ArcShape = { 
            id: generateId(), type: 'arc', layer: style.layer, color: style.color, 
            x: center.x, y: center.y, radius, 
            startAngle, endAngle, 
            counterClockwise,
            thickness: style.thickness, lineType: style.lineType 
        };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }

    onMove(p: Point) {
        const style = getStyleSettings(this.ctx);
        if (this.mode === '3p') {
            if (this.pts.length === 1) {
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:p.x, y2:p.y} as any]);
            } else if (this.pts.length === 2) {
                const res = getCircleFrom3Points(this.pts[0], this.pts[1], p);
                if (res) this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x: res.x, y: res.y, radius: res.radius, startAngle: res.startAngle, endAngle: res.endAngle, counterClockwise: res.counterClockwise} as any]);
            }
        } else if (this.mode === 'sce') {
            if (this.pts.length === 1) {
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:p.x, y2:p.y} as any]);
            } else if (this.pts.length === 2) {
                const start = this.pts[0];
                const center = this.pts[1];
                const radius = distance(center, start);
                const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                const endAngle = Math.atan2(p.y - center.y, p.x - center.x);
                const cp = (start.x - center.x) * (p.y - center.y) - (start.y - center.y) * (p.x - center.x);
                const counterClockwise = cp > 0;
                this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x: center.x, y: center.y, radius, startAngle, endAngle, counterClockwise} as any]);
            }
        } else if (this.mode === 'ser') {
            if (this.pts.length === 1) {
                this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.pts[0].x, y1:this.pts[0].y, x2:p.x, y2:p.y} as any]);
            } else if (this.pts.length === 2) {
                const start = this.pts[0];
                const end = this.pts[1];
                const radius = distance(start, p);
                const d = distance(start, end);
                if (radius >= d/2) {
                    const mid = { x: (start.x + end.x)/2, y: (start.y + end.y)/2 };
                    const h = Math.sqrt(radius*radius - (d/2)*(d/2));
                    const angle = Math.atan2(end.y - start.y, end.x - start.x);
                    const center = {
                        x: mid.x - h * Math.sin(angle),
                        y: mid.y + h * Math.cos(angle)
                    };
                    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
                    const cp = (start.x - center.x) * (end.y - center.y) - (start.y - center.y) * (end.x - center.x);
                    const counterClockwise = cp > 0;
                    this.ctx.setPreview([{id:'p', type:'arc', isPreview:true, layer: style.layer, color: style.color, x: center.x, y: center.y, radius, startAngle, endAngle, counterClockwise} as any]);
                }
            }
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
    onClick(p: Point) {
        if (!this.center) { this.center = p; this.ctx.setMessage("POLYGON Specify radius point:"); }
        else { this.addPolygon(distance(this.center, p)); this.ctx.onFinish(); }
    }
    private addPolygon(r: number) {
        if (!this.center) return;
        const pts = getPolygonPoints(this.center, this.sides, r, true);
        const style = getStyleSettings(this.ctx);
        const s: PolyShape = { id: generateId(), type: 'polygon', layer: style.layer, color: style.color, points: pts, closed: true, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }
    onMove(p: Point) {
        if (this.center) {
            const pts = getPolygonPoints(this.center, this.sides, distance(this.center, p), true);
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'polygon', isPreview:true, layer: style.layer, color: style.color, points: pts, closed: true} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class EllipseCommand implements CADCommand {
    name = "ELLIPSE"; public center: Point | null = null; public major: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("ELLIPSE Specify center point:"); }
    onClick(p: Point) {
        if (!this.center) { this.center = p; this.ctx.setMessage("ELLIPSE Specify endpoint of axis:"); }
        else if (!this.major) { this.major = p; this.ctx.setMessage("ELLIPSE Specify distance to other axis (minor radius):"); }
        else {
            const rx = distance(this.center, this.major);
            const ry = distance(this.center, p);
            const rot = Math.atan2(this.major.y - this.center.y, this.major.x - this.center.x);
            const style = getStyleSettings(this.ctx);
            const s: EllipseShape = { id: generateId(), type: 'ellipse', layer: style.layer, color: style.color, x: this.center.x, y: this.center.y, rx, ry, rotation: rot, thickness: style.thickness };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        const style = getStyleSettings(this.ctx);
        if (this.center && !this.major) {
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:this.center.x, y1:this.center.y, x2:p.x, y2:p.y} as any]);
        } else if (this.center && this.major) {
            const rx = distance(this.center, this.major);
            const ry = distance(this.center, p);
            const rot = Math.atan2(this.major.y - this.center.y, this.major.x - this.center.x);
            this.ctx.setPreview([{id:'p', type:'ellipse', isPreview:true, layer: style.layer, color: style.color, x:this.center.x, y:this.center.y, rx, ry, rotation: rot} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
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
    onStart() { this.ctx.setMessage("MOVE Select items and pick base point:"); }
    onClick(p: Point) {
        if (!this.base) { this.base = p; this.ctx.setMessage("MOVE Specify second point:"); }
        else {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            const ids = this.ctx.getSelectedIds();
            this.ctx.setLayers(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(l => next[l] = next[l].map(s => ids.includes(s.id) ? moveShape(s, dx, dy) : s));
                return next;
            });
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.base) {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
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
    onClick() {} onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
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
    onClick(p: Point) {
        if (!this.p1) { this.p1 = p; this.ctx.setMessage("DIST Specify second point:"); }
        else {
            const d = distance(this.p1, p);
            this.ctx.addLog(`DISTANCE: ${formatLength(d, this.ctx.getSettings().units === 'imperial')}`);
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
    name = "DIM"; public p1: Point | null = null; public p2: Point | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("DIM Specify first extension line origin:"); }
    onClick(p: Point) {
        if (!this.p1) { this.p1 = p; this.ctx.setMessage("DIM Specify second extension line origin:"); }
        else if (!this.p2) { this.p2 = p; this.ctx.setMessage("DIM Specify dimension line location:"); }
        else {
            const style = getStyleSettings(this.ctx);
            const d = distance(this.p1, this.p2);
            const s: DimensionShape = { id: generateId(), type: 'dimension', layer: style.layer, color: style.color, x1: this.p1.x, y1: this.p1.y, x2: this.p2.x, y2: this.p2.y, dimX: p.x, dimY: p.y, text: formatLength(d, this.ctx.getSettings().units === 'imperial') };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
            this.ctx.onFinish();
        }
    }
    onMove(p: Point) {
        if (this.p1 && this.p2) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:p.x, y1:p.y, x2:this.p1.x, y2:this.p1.y} as any]);
        }
    }
    onEnter() {} onCancel() {}
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
                this.ctx.onExternalRequest('mtext_editor', {}, (content) => {
                    if (content) {
                        const style = getStyleSettings(this.ctx);
                        const s: MTextShape = { id: generateId(), type: 'mtext', layer: style.layer, color: style.color, x: Math.min(this.point!.x, p.x), y: Math.max(this.point!.y, p.y), width: Math.abs(p.x - this.point!.x), size: style.textSize, content };
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
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 10));
            if (hit) { this.target = hit; this.ctx.setMessage("OFFSET Specify point on side to offset:"); }
        } else {
            const off = offsetShape(this.target, this.dist, p);
            if (off) {
                const style = getStyleSettings(this.ctx);
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), off]}));
            }
            this.ctx.onFinish();
        }
    }
    onMove() {} onEnter() {} onCancel() {}
}

export class TrimCommand implements CADCommand {
    name = "TRIM"; public cutters: Shape[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("TRIM Select cutting edges or <Enter to select all>:"); }
    onClick(p: Point) {
        const all = Object.values(this.ctx.getLayers()).flat();
        if (this.cutters.length === 0) {
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 10));
            if (hit) { this.cutters.push(hit); this.ctx.setMessage("TRIM Select next cutting edge or <Enter to finish selection>:"); }
        } else {
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 10));
            if (hit) {
                const results = getTrimmedShapes(this.cutters, [hit], p);
                this.ctx.setLayers(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(l => next[l] = next[l].filter(s => s.id !== hit.id).concat(results.filter(rs => rs.layer === l)));
                    return next;
                });
            }
        }
    }
    onMove() {}
    onEnter() {
        if (this.cutters.length === 0) { this.cutters = Object.values(this.ctx.getLayers()).flat(); this.ctx.setMessage("TRIM Select object to trim:"); }
        else { this.ctx.onFinish(); }
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
    name = "COPYCLIP"; constructor(public ctx: CommandContext) {}
    onStart() {
        const all = Object.values(this.ctx.getLayers()).flat();
        clipboardBuffer = JSON.parse(JSON.stringify(all.filter(s => this.ctx.getSelectedIds().includes(s.id))));
        this.ctx.setMessage("COPYCLIP Specify base point:");
    }
    onClick(p: Point) { clipboardBasePoint = p; this.ctx.onFinish(); }
    onMove() {} onEnter() {} onCancel() {}
}

export class CutClipCommand implements CADCommand {
    name = "CUTCLIP"; constructor(public ctx: CommandContext) {}
    onStart() {
        const ids = this.ctx.getSelectedIds();
        const all = Object.values(this.ctx.getLayers()).flat();
        clipboardBuffer = JSON.parse(JSON.stringify(all.filter(s => ids.includes(s.id))));
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => next[l] = next[l].filter(s => !ids.includes(s.id)));
            return next;
        });
        this.ctx.setMessage("CUTCLIP Specify base point:");
    }
    onClick(p: Point) { clipboardBasePoint = p; this.ctx.onFinish(); }
    onMove() {} onEnter() {} onCancel() {}
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

export class HatchCommand implements CADCommand {
    name = "HATCH"; constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("HATCH [Internal point]:"); }
    onClick() { this.ctx.onFinish(); } onMove() {} onEnter() {} onCancel() {}
}
