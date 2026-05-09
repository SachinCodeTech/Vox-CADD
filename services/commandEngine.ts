
import { Shape, Point, AppSettings, LayerConfig, LineShape, CircleShape, RectShape, ArcShape, PolyShape, TextShape, MTextShape, EllipseShape, DimensionShape, AngularDimensionShape, PointShape, InfiniteLineShape, DonutShape, LeaderShape, ViewState, DoubleLineShape, DLineJustification, TextJustification, LineType, BlockDefinition, LayoutDefinition, LayoutViewport, DimensionType, BlockShape, HatchShape } from '../types';
import { generateId, getCircleFrom3Points, formatLength, formatAngle, parseLength, hitTestShape, distance, getTrimmedShapes, moveShape, resolvePointInput, calculateArea, offsetShape, getPolygonPoints, stretchShape, getShapesInRect, rotateShape, scaleShape, mirrorShape, getExtendedShapes, filletLines, chamferLines, modifyShapeByGrip, isPointInsideShape, getShapeBoundaryPoints, isShapeClosed, getShapeBounds, extractBoundaryFromShapes, getAllShapesBounds } from './cadService';

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
    getCanvasSize: () => { width: number, height: number };
    getActiveViewport: () => LayoutViewport | undefined;
    saveToViewHistory: () => void;
    getViewHistory: () => ViewState[];
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
    onClick(p: Point, snapped: boolean, shiftKey?: boolean): void;
    onMove(p: Point, snapped: boolean, shiftKey?: boolean): void;
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

const getStyleSettings = (ctx: CommandContext, commandName?: string) => {
    const settings = ctx.getSettings();
    const layer = settings.currentLayer;
    const layerConfig = ctx.getLayerConfig()[layer];
    
    let activeLineType = settings.activeLineType;
    
    // Auto-logic: some tools default to "reference" (dashed) line types
    const refTools = ['XLINE', 'RAY', 'RECT', 'SPLINE', 'CIRCLE'];
    if (commandName && refTools.includes(commandName.toUpperCase())) {
        // If the current linetype is continuous, we default these special tools to dashed/reference
        if (activeLineType === 'continuous') {
            activeLineType = 'dashed'; 
        }
    }

    return {
        layer,
        color: layerConfig?.color || '#FFFFFF',
        thickness: settings.penThickness,
        lineType: activeLineType,
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
    
    click(p: Point, snapped: boolean = false, shiftKey: boolean = false) { 
        this.ctx.lastMousePoint = p;
        if (this.active) this.active.onClick(p, snapped, shiftKey);
    }
    
    move(p: Point, snapped: boolean = false, shiftKey: boolean = false) { 
        this.ctx.lastMousePoint = p;
        if (this.active) this.active.onMove(p, snapped, shiftKey);
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
    name = "LINE"; public pts: Point[] = []; private segmentIds: string[] = [];
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("LINE Specify start point:"); }
    onClick(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const id = this.addSegment(anchor, finalP);
            this.segmentIds.push(id);
            this.pts.push(finalP);
        } else { this.pts.push(p); }
        this.ctx.setMessage("LINE Specify next point or [Close/Undo]:");
    }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'c' || t === 'close') {
            if (this.pts.length > 2) {
                this.addSegment(this.pts[this.pts.length - 1], this.pts[0]);
                this.ctx.onFinish();
                return true;
            } else {
                this.ctx.addLog("At least 3 points required to close.");
                return true;
            }
        }
        if (t === 'u' || t === 'undo') {
            if (this.pts.length > 1) {
                const lastId = this.segmentIds.pop();
                if (lastId) {
                    this.ctx.setLayers(prev => {
                        const next = { ...prev };
                        Object.keys(next).forEach(l => {
                            next[l] = next[l].filter(s => s.id !== lastId);
                        });
                        return next;
                    });
                }
                this.pts.pop();
                this.ctx.setMessage("LINE Specify next point or [Close/Undo]:");
                return true;
            } else if (this.pts.length === 1) {
                this.pts = [];
                this.ctx.setMessage("LINE Specify start point:");
                return true;
            }
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }
    private addSegment(p1: Point, p2: Point): string {
        const style = getStyleSettings(this.ctx, this.name);
        const id = generateId();
        const s: LineShape = { id, type: 'line', layer: style.layer, color: style.color, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        return id;
    }
    onMove(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const cp = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx, this.name);
            this.ctx.setPreview([{id:'p', type:'line', isPreview:true, layer: style.layer, color: style.color, x1:anchor.x, y1:anchor.y, x2:cp.x, y2:cp.y} as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); }
    onCancel() { 
        // If cancelled, should we remove what we drew? Usually CAD keeps it.
        this.ctx.onFinish(); 
    }
}

export class DoubleLineCommand implements CADCommand {
    name = "DLINE"; public pts: Point[] = []; public thickness: number = 230; public justification: DLineJustification = 'zero';
    constructor(public ctx: CommandContext) {}
    onStart() { 
        this.ctx.setMessage("DLINE Specify start point or [Thickness/Justification]:"); 
    }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 't' || t === 'thickness') {
            this.ctx.setMessage("DLINE Specify wall thickness:");
            return true;
        }
        if (t === 'j' || t === 'justification') {
            this.ctx.setMessage("DLINE Enter justification [Top/Zero/Bottom] <zero>:");
            return true;
        }
        if (t === 'c' || t === 'close') {
            if (this.pts.length > 2) {
                const style = getStyleSettings(this.ctx, this.name);
                const s: DoubleLineShape = { id: generateId(), type: 'dline', layer: style.layer, color: style.color, points: [...this.pts, this.pts[0]], thickness: this.thickness, justification: this.justification, closed: true };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
                return true;
            }
        }
        if (t === 'u' || t === 'undo') {
            if (this.pts.length > 0) {
                this.pts.pop();
                this.ctx.setMessage(this.pts.length > 0 ? "DLINE Next point:" : "DLINE Specify start point:");
                return true;
            }
        }
        
        if (t === 'top') { this.justification = 'top'; this.ctx.setMessage("Justification: TOP. Specify start point:"); return true; }
        if (t === 'zero' || t === 'z') { this.justification = 'zero'; this.ctx.setMessage("Justification: ZERO. Specify start point:"); return true; }
        if (t === 'bottom' || t === 'b') { this.justification = 'bottom'; this.ctx.setMessage("Justification: BOTTOM. Specify start point:"); return true; }
        
        if (!isNaN(parseFloat(t)) && !t.includes(',') && this.pts.length === 0) {
            this.thickness = parseFloat(t);
            this.ctx.setMessage("DLINE Thickness set. Specify start point:");
            return true;
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
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
            this.ctx.setPreview([{id:'p', type:'dline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, finalP], thickness: this.thickness, justification: this.justification} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: DoubleLineShape = { id: generateId(), type: 'dline', layer: style.layer, color: style.color, points: this.pts, thickness: this.thickness, justification: this.justification };
            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        }
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class PolyCommand implements CADCommand {
    name = "PLINE"; public pts: Point[] = []; mode: 'line' | 'arc' = 'line'; prevTangent: number | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("PLINE Specify start point:"); }
    onClick(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            let finalP = {...applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped)};
            
            if (this.mode === 'arc' && this.pts.length > 0) {
                // Calculate bulge for arc segment
                // If we have a previous tangent, we try to maintain continuity
                const dist = distance(anchor, finalP);
                if (dist > 0.001) {
                    if (this.prevTangent !== null) {
                        const chordAngle = Math.atan2(finalP.y - anchor.y, finalP.x - anchor.x);
                        let alpha = this.prevTangent - chordAngle;
                        while(alpha > Math.PI) alpha -= 2*Math.PI;
                        while(alpha < -Math.PI) alpha += 2*Math.PI;
                        
                        // bulge = tan(alpha/2)
                        const bulge = Math.tan(alpha / 2);
                        anchor.bulge = bulge;
                        this.prevTangent = chordAngle - alpha; // Update tangent for next segment
                    } else {
                        // First arc segment without tangent context: use semi-circle or simple arc
                        anchor.bulge = 1.0; 
                        const chordAngle = Math.atan2(finalP.y - anchor.y, finalP.x - anchor.x);
                        this.prevTangent = chordAngle - Math.PI/2; 
                    }
                }
            } else {
                this.prevTangent = Math.atan2(finalP.y - anchor.y, finalP.x - anchor.x);
                anchor.bulge = 0;
            }
            this.pts.push(finalP);
        } else {
            this.pts.push(p);
        }
        this.ctx.setMessage(`PLINE Next point or [Arc/Close/Undo/Line] (${this.mode.toUpperCase()}):`);
    }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'a' || t === 'arc') { this.mode = 'arc'; this.ctx.setMessage("PLINE Specify endpoint of arc:"); return true; }
        if (t === 'l' || t === 'line') { this.mode = 'line'; this.ctx.setMessage("PLINE Specify next point:"); return true; }
        if (t === 'c' || t === 'close') {
            if (this.pts.length > 2) {
                const style = getStyleSettings(this.ctx);
                const s: PolyShape = { id: generateId(), type: 'pline', layer: style.layer, color: style.color, points: JSON.parse(JSON.stringify(this.pts)), closed: true, thickness: style.thickness, lineType: style.lineType };
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
                this.ctx.onFinish();
                return true;
            }
        }
        if (t === 'u' || t === 'undo') {
            if (this.pts.length > 0) {
                this.pts.pop();
                if (this.pts.length > 0) {
                    const lastIdx = this.pts.length - 1;
                    if (lastIdx > 0) {
                        const p1 = this.pts[lastIdx-1], p2 = this.pts[lastIdx];
                        this.prevTangent = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                        if (p1.bulge) {
                             const chordAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                             const alpha = 2 * Math.atan(p1.bulge);
                             this.prevTangent = chordAngle - alpha;
                        }
                    } else { this.prevTangent = null; }
                }
                this.ctx.setMessage(this.pts.length > 0 ? "PLINE Next point:" : "PLINE Specify start point:");
                return true;
            }
        }
        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
        if (p) { this.onClick(p, false); return true; }
        return false;
    }
    onMove(p: Point, snapped: boolean) {
        if (this.pts.length > 0) {
            const anchor = this.pts[this.pts.length - 1];
            const finalP = applyOrthoConstraint(p, anchor, this.ctx.getSettings().ortho, snapped);
            const style = getStyleSettings(this.ctx);
            
            const previewPts = JSON.parse(JSON.stringify(this.pts));
            if (this.mode === 'arc') {
                const dist = distance(anchor, finalP);
                if (dist > 0.001 && this.prevTangent !== null) {
                    const chordAngle = Math.atan2(finalP.y - anchor.y, finalP.x - anchor.x);
                    let alpha = this.prevTangent - chordAngle;
                    while(alpha > Math.PI) alpha -= 2*Math.PI;
                    while(alpha < -Math.PI) alpha += 2*Math.PI;
                    previewPts[previewPts.length-1].bulge = Math.tan(alpha / 2);
                } else if (dist > 0.001) {
                    previewPts[previewPts.length-1].bulge = 1.0;
                }
            }
            
            this.ctx.setPreview([{id:'p', type:'pline', isPreview:true, layer: style.layer, color: style.color, points: [...previewPts, finalP]} as any]);
        }
    }
    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: PolyShape = { id: generateId(), type: 'pline', layer: style.layer, color: style.color, points: [...this.pts], closed: false, thickness: style.thickness, lineType: style.lineType };
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

    constructor(public ctx: CommandContext) { }

    onStart() {
        this.ctx.setMessage("SPLINE: Sketch naturally (Drag) or tap points. [Enter to finish]");
    }

    onClick(p: Point) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.pts = [p];
        } else {
            // Check if we are finishing a freehand stroke or just adding a vertex
            const last = this.pts[this.pts.length - 1];
            if (distance(last, p) > 2) {
                this.pts.push(p);
            }
        }
        this.ctx.setMessage("SPLINE: Drawing... Drag to sketch or tap. [Enter to finish]");
    }

    onMove(p: Point) {
        if (this.isDrawing && this.pts.length > 0) {
            const last = this.pts[this.pts.length - 1];
            // Finer threshold for more natural freehand drawing
            if (distance(last, p) > 3) {
                this.pts.push(p);
            }
            const style = getStyleSettings(this.ctx);
            // Preview shows the smoothed quadratic spline path
            this.ctx.setPreview([{
                id: 'p_spline',
                type: 'spline',
                isPreview: true,
                layer: style.layer,
                color: style.color,
                points: [...this.pts, p]
            } as any]);
        }
    }

    onEnter() {
        if (this.pts.length > 1) {
            const style = getStyleSettings(this.ctx);
            const s: Shape = {
                id: generateId(),
                type: 'spline',
                points: this.pts,
                layer: style.layer,
                color: style.color,
                thickness: style.thickness,
                lineType: style.lineType
            } as any;
            this.ctx.setLayers(prev => ({ ...prev, [style.layer]: [...(prev[style.layer] || []), s] }));
        }
        this.isDrawing = false;
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
    public isDiameter: boolean = false;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("CIRCLE Specify center point for circle or [3P/2P/Ttr (tan tan radius)]:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        // Mode selection at start
        if (this.pts.length === 0 && this.selectedShapes.length === 0) {
            if (t === '2p') { 
                this.mode = '2p'; 
                this.ctx.setMessage("CIRCLE Specify first end point of circle's diameter:"); 
                return true; 
            }
            if (t === '3p') { 
                this.mode = '3p'; 
                this.ctx.setMessage("CIRCLE Specify first point on circle:"); 
                return true; 
            }
            if (t === 'ttr' || t === 't') {
                this.mode = 'ttr';
                this.ctx.setMessage("CIRCLE Specify point on object for first tangent of circle:");
                return true;
            }
        }

        // Diameter/Radius switch when center is picked
        if (this.mode === 'default' && this.pts.length === 1) {
            if (t === 'd' || t === 'diameter') {
                this.isDiameter = true;
                this.ctx.setMessage("CIRCLE Specify diameter of circle:");
                return true;
            }
            if (t === 'r' || t === 'radius') {
                this.isDiameter = false;
                this.ctx.setMessage("CIRCLE Specify radius of circle or [Diameter]:");
                return true;
            }

            const val = parseLength(text, this.ctx.getSettings());
            if (!isNaN(val)) {
                this.radius = this.isDiameter ? val / 2 : val;
                this.finish();
                return true;
            }
        }

        if (this.mode === 'ttr' && this.selectedShapes.length === 2) {
            const r = parseLength(text, this.ctx.getSettings());
            if (!isNaN(r) && r > 0) {
                this.radius = r;
                this.solveTTR();
                return true;
            }
        }

        const last = this.pts.length > 0 ? this.pts[this.pts.length - 1] : null;
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
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
                    this.pts.push(p); 
                    if (this.selectedShapes.length === 1) {
                        this.ctx.setMessage("CIRCLE Specify point on object for second tangent of circle:");
                    } else if (this.selectedShapes.length === 2) {
                        this.ctx.setMessage("CIRCLE Specify radius of circle:");
                    }
                } else {
                    this.ctx.addLog("No object found at selection point.");
                }
            } else {
                this.radius = distance(this.pts[1] || this.pts[0], p);
                this.solveTTR();
            }
            return;
        }

        if (this.mode === '2p') {
            this.pts.push(p);
            if (this.pts.length === 1) {
                this.ctx.setMessage("CIRCLE Specify second end point of circle's diameter:");
            } else {
                const center = { x: (this.pts[0].x + this.pts[1].x) / 2, y: (this.pts[0].y + this.pts[1].y) / 2 };
                this.radius = distance(this.pts[0], this.pts[1]) / 2;
                this.addCircle(center, this.radius);
                this.ctx.onFinish();
            }
            return;
        }

        if (this.mode === '3p') {
            this.pts.push(p);
            if (this.pts.length === 1) {
                this.ctx.setMessage("CIRCLE Specify second point on circle:");
            } else if (this.pts.length === 2) {
                this.ctx.setMessage("CIRCLE Specify third point on circle:");
            } else {
                const circ = getCircleFrom3Points(this.pts[0], this.pts[1], this.pts[2]);
                if (circ) {
                    this.addCircle({ x: circ.x, y: circ.y }, circ.radius);
                    this.ctx.onFinish();
                } else {
                    this.ctx.addLog("Points are collinear. Circle cannot be calculated.");
                    this.pts = [];
                    this.onStart();
                }
            }
            return;
        }

        if (this.mode === 'default') {
            if (this.pts.length === 0) {
                this.pts.push(p);
                this.ctx.setMessage("CIRCLE Specify radius of circle or [Diameter]:");
            } else {
                const r = distance(this.pts[0], p);
                this.radius = this.isDiameter ? r / 2 : r;
                this.finish();
            }
        }
    }

    private finish() {
        if (this.pts.length > 0) {
            this.addCircle(this.pts[0], this.radius);
        }
        this.ctx.onFinish();
    }

    private findShapeAt(p: Point): Shape | null {
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

        if (s1.type === 'line' && s2.type === 'line') {
            const getLineEq = (l: LineShape) => {
                const A = l.y1 - l.y2;
                const B = l.x2 - l.x1;
                const C = l.x1 * l.y2 - l.x2 * l.y1;
                return { A, B, C, norm: Math.sqrt(A*A + B*B) };
            };

            const eq1 = getLineEq(s1);
            const eq2 = getLineEq(s2);

            const offset1 = [eq1.C + this.radius * eq1.norm, eq1.C - this.radius * eq1.norm];
            const offset2 = [eq2.C + this.radius * eq2.norm, eq2.C - this.radius * eq2.norm];

            let bestCenter: Point | null = null;
            let minDist = Infinity;
            const target = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };

            for (const c1 of offset1) {
                for (const c2 of offset2) {
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
        const style = getStyleSettings(this.ctx, this.name);
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
        const style = getStyleSettings(this.ctx, this.name);
        if (this.mode === 'default' && this.pts.length === 1) {
            const r = this.isDiameter ? distance(this.pts[0], p) / 2 : distance(this.pts[0], p);
            this.ctx.setPreview([{id:'p', type:'circle', isPreview:true, layer: style.layer, color: style.color, x: this.pts[0].x, y: this.pts[0].y, radius: r} as any]);
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
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
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
    name = "POLYGON"; 
    public sides: number = 4; 
    public center: Point | null = null;
    public mode: 'inscribed' | 'circumscribed' | 'edge' = 'inscribed';
    public step: 'sides' | 'center' | 'mode' | 'radius' = 'sides';

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("POLYGON Enter number of sides <4>:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        if (this.step === 'sides') {
            if (t === '') {
                this.step = 'center';
                this.ctx.setMessage("POLYGON Specify center of polygon or [Edge]:"); 
                return true;
            }
            const val = parseInt(t);
            if (!isNaN(val) && val > 2) { 
                this.sides = val; 
                this.step = 'center';
                this.ctx.setMessage("POLYGON Specify center of polygon or [Edge]:"); 
                return true; 
            }
        } else if (this.step === 'center') {
            if (t === 'e' || t === 'edge') {
                this.mode = 'edge';
                this.step = 'radius'; // radiuse step here will mean selecting edge points
                this.ctx.setMessage("POLYGON Specify first endpoint of edge:");
                return true;
            }
            const p = resolvePointInput(text, null, this.ctx.getSettings(), this.ctx.lastMousePoint);
            if (p) {
                this.center = p;
                this.step = 'mode';
                this.ctx.setMessage("POLYGON Enter an option [Inscribed in circle/Circumscribed about circle] <I>:");
                return true;
            }
        } else if (this.step === 'mode') {
            if (t === '' || t === 'i' || t === 'inscribed') {
                this.mode = 'inscribed';
                this.step = 'radius';
                this.ctx.setMessage("POLYGON Specify radius of circle (Inscribed in circle):");
                return true;
            }
            if (t === 'c' || t === 'circumscribed') {
                this.mode = 'circumscribed';
                this.step = 'radius';
                this.ctx.setMessage("POLYGON Specify radius of circle (Circumscribed about circle):");
                return true;
            }
        } else if (this.step === 'radius') {
            if (this.mode === 'edge') {
                const p = resolvePointInput(text, this.ctx.lastMousePoint, this.ctx.getSettings());
                if (p) { this.onClick(p, false); return true; }
            } else {
                const r = parseLength(text, this.ctx.getSettings());
                if (!isNaN(r)) { 
                    this.addPolygon(r); 
                    this.ctx.onFinish(); 
                    return true; 
                }
            }
        }
        return false;
    }

    onClick(p: Point, snapped: boolean) {
        if (this.step === 'center') {
            this.center = p;
            this.step = 'mode';
            this.ctx.setMessage("POLYGON Enter an option [Inscribed in circle/Circumscribed about circle] <I>:");
        } else if (this.step === 'mode') {
            // Default to inscribed and use this click as the radius point
            this.mode = 'inscribed';
            const finalP = applyOrthoConstraint(p, this.center || p, this.ctx.getSettings().ortho, snapped);
            this.addPolygon(distance(this.center || p, finalP)); 
            this.ctx.onFinish();
        } else if (this.step === 'radius') {
            if (this.mode === 'edge') {
                if (!this.center) {
                    this.center = p;
                    this.ctx.setMessage("POLYGON Specify second endpoint of edge:");
                } else {
                    this.addEdgePolygon(this.center, p);
                    this.ctx.onFinish();
                }
            } else {
                const finalP = applyOrthoConstraint(p, this.center || p, this.ctx.getSettings().ortho, snapped);
                this.addPolygon(distance(this.center || p, finalP)); 
                this.ctx.onFinish(); 
            }
        }
    }

    private addPolygon(r: number) {
        if (!this.center) return;
        const vertexR = this.mode === 'circumscribed' ? r / Math.cos(Math.PI / this.sides) : r;
        const pts = getPolygonPoints(this.center, this.sides, vertexR, true);
        const style = getStyleSettings(this.ctx);
        const s: PolyShape = { id: generateId(), type: 'polygon', layer: style.layer, color: style.color, points: pts, closed: true, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }

    private addEdgePolygon(p1: Point, p2: Point) {
        // Calculate center and radius from edge
        const d = distance(p1, p2);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const interiorAngle = ((this.sides - 2) * Math.PI) / this.sides;
        const exteriorAngle = Math.PI - interiorAngle;
        
        // Find center by rotating p2 around p1
        const r = d / (2 * Math.sin(Math.PI / this.sides));
        const centerAngle = angle + (Math.PI - interiorAngle) / 2;
        const center = {
            x: p1.x + r * Math.cos(centerAngle),
            y: p1.y + r * Math.sin(centerAngle)
        };
        
        const pts = getPolygonPoints(center, this.sides, r, true, centerAngle + Math.PI + Math.PI/this.sides);
        const style = getStyleSettings(this.ctx);
        const s: PolyShape = { id: generateId(), type: 'polygon', layer: style.layer, color: style.color, points: pts, closed: true, thickness: style.thickness, lineType: style.lineType };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
    }

    onMove(p: Point, snapped: boolean) {
        const style = getStyleSettings(this.ctx);
        if (this.center && (this.step === 'radius' || this.step === 'mode')) {
            if (this.mode === 'edge') {
                const angle = Math.atan2(p.y - this.center.y, p.x - this.center.x);
                const d = distance(this.center, p);
                const interiorAngle = ((this.sides - 2) * Math.PI) / this.sides;
                const r = d / (2 * Math.sin(Math.PI / this.sides));
                const centerAngle = angle + (Math.PI - interiorAngle) / 2;
                const center = {
                    x: this.center.x + r * Math.cos(centerAngle),
                    y: this.center.y + r * Math.sin(centerAngle)
                };
                const pts = getPolygonPoints(center, this.sides, r, true, centerAngle + Math.PI + Math.PI/this.sides);
                this.ctx.setPreview([{id:'p', type:'polygon', isPreview:true, layer: style.layer, color: style.color, points: pts, closed: true} as any]);
            } else {
                const finalP = applyOrthoConstraint(p, this.center, this.ctx.getSettings().ortho, snapped);
                const r = distance(this.center, finalP);
                const vertexR = this.mode === 'circumscribed' ? r / Math.cos(Math.PI / this.sides) : r;
                const pts = getPolygonPoints(this.center, this.sides, vertexR, true);
                this.ctx.setPreview([{id:'p', type:'polygon', isPreview:true, layer: style.layer, color: style.color, points: pts, closed: true} as any]);
            }
        }
    }

    onEnter() { 
        if (this.step === 'mode') {
            this.mode = 'inscribed';
            this.step = 'radius';
            this.ctx.setMessage("POLYGON Specify radius of circle:");
        } else {
            this.ctx.onFinish(); 
        }
    }
    
    onCancel() { this.ctx.onFinish(); }
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
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
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
    name = "RECT"; 
    p1: Point | null = null;
    width: number | null = null;
    height: number | null = null;
    rotation: number = 0;
    mode: 'default' | 'dimensions' | 'rotation' = 'default';

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("RECT Specify first corner point or [Dimensions/Rotation]:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        if (t === 'd' || t === 'dimensions') {
            this.mode = 'dimensions';
            this.ctx.setMessage("RECT Specify width for rectangles:");
            return true;
        }
        if (t === 'r' || t === 'rotation') {
            this.mode = 'rotation';
            this.ctx.setMessage("RECT Specify rotation angle <0>:");
            return true;
        }

        const val = parseLength(text, this.ctx.getSettings());
        if (!isNaN(val)) {
            if (this.mode === 'dimensions') {
                if (this.width === null) {
                    this.width = val;
                    this.ctx.setMessage("RECT Specify height for rectangles:");
                } else {
                    this.height = val;
                    if (this.p1) {
                        this.ctx.setMessage("RECT Specify other corner point (direction):");
                    } else {
                        this.ctx.setMessage("RECT Specify first corner point:");
                    }
                    this.mode = 'default';
                }
                return true;
            }
            if (this.mode === 'rotation') {
                this.rotation = (val * Math.PI) / 180;
                this.mode = 'default';
                this.ctx.setMessage("RECT Specify opposite corner point:");
                return true;
            }
        }

        const last = this.p1 || null;
        const p = resolvePointInput(text, last, this.ctx.getSettings(), this.ctx.lastMousePoint);
        if (p) { this.onClick(p); return true; }
        return false;
    }

    onClick(p: Point) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("RECT Specify opposite corner point or [Dimensions/Rotation]:");
        } else {
            if (this.width !== null && this.height !== null) {
                // Determine direction based on click relative to p1
                const dx = p.x >= this.p1.x ? this.width : -this.width;
                const dy = p.y >= this.p1.y ? this.height : -this.height;
                this.addRect(dx, dy);
            } else {
                this.addRect(p.x - this.p1.x, p.y - this.p1.y);
            }
        }
    }

    private addRect(w: number, h: number) {
        if (!this.p1) return;
        const style = getStyleSettings(this.ctx, this.name);
        // If rotation is 0, we can use a simple rect or a pline. 
        // Standard RECT usually creates a closed PLINE.
        const points: Point[] = [
            this.p1,
            this.rotatePoint({ x: this.p1.x + w, y: this.p1.y }, this.p1, this.rotation),
            this.rotatePoint({ x: this.p1.x + w, y: this.p1.y + h }, this.p1, this.rotation),
            this.rotatePoint({ x: this.p1.x, y: this.p1.y + h }, this.p1, this.rotation)
        ];

        const s: PolyShape = { 
            id: generateId(), 
            type: 'pline', 
            layer: style.layer, 
            color: style.color, 
            points, 
            closed: true, 
            thickness: style.thickness, 
            lineType: style.lineType 
        };
        this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), s]}));
        this.ctx.onFinish();
    }

    private rotatePoint(p: Point, center: Point, angle: number): Point {
        if (angle === 0) return p;
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const px = p.x - center.x;
        const py = p.y - center.y;
        return {
            x: px * c - py * s + center.x,
            y: px * s + py * c + center.y
        };
    }

    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx, this.name);
            let w = p.x - this.p1.x;
            let h = p.y - this.p1.y;
            
            if (this.width !== null && this.height !== null) {
                w = p.x >= this.p1.x ? this.width : -this.width;
                h = p.y >= this.p1.y ? this.height : -this.height;
            }

            const points: Point[] = [
                this.p1,
                this.rotatePoint({ x: this.p1.x + w, y: this.p1.y }, this.p1, this.rotation),
                this.rotatePoint({ x: this.p1.x + w, y: this.p1.y + h }, this.p1, this.rotation),
                this.rotatePoint({ x: this.p1.x, y: this.p1.y + h }, this.p1, this.rotation)
            ];

            this.ctx.setPreview([{
                id: 'p', 
                type: 'pline', 
                isPreview: true, 
                layer: style.layer, 
                color: style.color, 
                points, 
                closed: true
            } as any]);
        }
    }

    onEnter() { this.ctx.onFinish(); } 
    onCancel() { this.ctx.onFinish(); }
}

export class MoveCommand implements CADCommand {
    name = "MOVE"; 
    base: Point | null = null; 
    selecting = true;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) {
            this.selecting = false;
            this.ctx.setMessage("MOVE Specify base point:"); 
        } else {
            this.selecting = true;
            this.ctx.setMessage("MOVE Select items:"); 
        }
    }

    onInput(text: string): boolean {
        if (this.selecting) return false;
        
        if (this.base) {
            // Direct distance entry or relative coordinate
            const p = resolvePointInput(text, this.base, this.ctx.getSettings(), this.ctx.lastMousePoint);
            if (p) {
                this.applyMove(p);
                return true;
            }
        }
        return false;
    }

    onClick(p: Point, snapped: boolean) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`MOVE ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.base) {
            this.base = p; 
            this.ctx.setMessage("MOVE Specify second point:");
        } else {
            const finalP = applyOrthoConstraint(p, this.base, this.ctx.getSettings().ortho, snapped);
            this.applyMove(finalP);
        }
    }

    private applyMove(target: Point) {
        if (!this.base) return;
        const dx = target.x - this.base.x, dy = target.y - this.base.y;
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => next[l] = next[l].map(s => ids.includes(s.id) ? moveShape(s, dx, dy) : s));
            return next;
        });
        this.ctx.onFinish();
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

    onEnter() { 
        if (this.selecting) {
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false;
                this.ctx.setMessage("MOVE Specify base point:");
            } else {
                this.ctx.onFinish();
            }
        } else {
            this.ctx.onFinish(); 
        }
    }

    onCancel() { this.ctx.onFinish(); }
}

export class EraseCommand implements CADCommand {
    name = "ERASE";
    constructor(public ctx: CommandContext) {}
    onStart() {
        const ids = this.ctx.getSelectedIds();
        if (ids.length > 0) {
            this.erase(ids);
            this.ctx.onFinish();
        } else {
            this.ctx.setMessage("ERASE Select objects to erase or type 'ALL':");
        }
    }
    onInput(text: string): boolean {
        if (text.toLowerCase() === 'all') {
            this.ctx.setLayers(prev => {
                const n = { ...prev };
                Object.keys(n).forEach(l => n[l] = []);
                return n;
            });
            this.ctx.setSelectedIds([]);
            this.ctx.onFinish();
            return true;
        }
        return false;
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 20/ts, this.ctx.getBlocks()));
        if (hit) {
            this.ctx.setSelectedIds(prev => {
                const list = Array.isArray(prev) ? prev : [];
                return list.includes(hit.id) ? list : [...list, hit.id];
            });
            this.ctx.setMessage(`ERASE ${this.ctx.getSelectedIds().length} objects selected. <Enter> to erase:`);
        }
    }
    private erase(ids: string[]) {
        this.ctx.setLayers(prev => {
            const n = { ...prev };
            Object.keys(n).forEach(l => {
                n[l] = n[l].filter(s => !ids.includes(s.id));
            });
            return n;
        });
        this.ctx.setSelectedIds([]);
    }
    onMove() {}
    onEnter() {
        const ids = this.ctx.getSelectedIds();
        if (ids.length > 0) {
            this.erase(ids);
        }
        this.ctx.onFinish();
    }
    onCancel() { this.ctx.onFinish(); }
}

export class ZoomCommand implements CADCommand {
    name = "ZOOM"; public p1: Point | null = null;
    constructor(public ctx: CommandContext, private initialSub?: string) {}

    onStart() { 
        if (this.initialSub) {
            this.onInput(this.initialSub);
        } else {
            this.ctx.setMessage("ZOOM Specify corner of window or [All/Extents/Previous/In/Out/Pan] <Extents>:"); 
        }
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'e' || t === 'extents' || t === 'a' || t === 'all' || t === '') { 
            const isAll = t === 'a' || t === 'all';
            const settings = this.ctx.getSettings();
            const activeVp = this.ctx.getActiveViewport();
            const limits = isAll ? { min: settings.limitsMin, max: settings.limitsMax } : undefined;
            const bounds = getAllShapesBounds(this.ctx.getLayers(), this.ctx.getBlocks(), limits);
            
            this.ctx.saveToViewHistory();

            if (bounds) {
                const w = Math.max(0.001, bounds.xMax - bounds.xMin);
                const h = Math.max(0.001, bounds.yMax - bounds.yMin);
                const centerX = (bounds.xMax + bounds.xMin) / 2;
                const centerY = (bounds.yMax + bounds.yMin) / 2;
                
                const canvas = this.ctx.getCanvasSize();
                const ts_scale = settings.drawingScale;
                // Safe padding: ZOOM ALL ~10%, EXTENTS tighter ~5%
                const padding = isAll ? 0.90 : 0.95; 
                
                if (activeVp) {
                    const scale = Math.min(activeVp.width / w, activeVp.height / h);
                    const finalScale = scale * padding;
                    this.ctx.setView({ scale: finalScale, originX: -centerX * finalScale, originY: centerY * finalScale });
                } else {
                    const scale = Math.min(canvas.width / (w * ts_scale), canvas.height / (h * ts_scale));
                    const finalScale = scale * padding;
                    this.ctx.setView({ 
                        scale: finalScale, 
                        originX: -centerX * finalScale * ts_scale, 
                        originY: centerY * finalScale * ts_scale 
                    });
                }
                
                this.ctx.addLog(`ZOOM_${isAll ? 'ALL' : 'EXTENTS'}: Bounds=[${bounds.xMin.toFixed(0)}, ${bounds.yMin.toFixed(0)} to ${bounds.xMax.toFixed(0)}, ${bounds.yMax.toFixed(0)}]`);
            } else {
                // If no bounds and isExtents, we don't change much, if isAll we show limits.
                if (isAll) {
                    const w = Math.max(1, Math.abs(settings.limitsMax.x - settings.limitsMin.x));
                    const h = Math.max(1, Math.abs(settings.limitsMax.y - settings.limitsMin.y));
                    const centerX = (settings.limitsMax.x + settings.limitsMin.x) / 2;
                    const centerY = (settings.limitsMax.y + settings.limitsMin.y) / 2;
                    const canvas = this.ctx.getCanvasSize();
                    const ts_scale = settings.drawingScale;
                    
                    if (activeVp) {
                        const scale = (Math.min(activeVp.width / w, activeVp.height / h)) * 0.9;
                        this.ctx.setView({ scale, originX: -centerX * scale, originY: centerY * scale });
                    } else {
                        const scale = (Math.min(canvas.width / (w * ts_scale), canvas.height / (h * ts_scale))) * 0.9;
                        this.ctx.setView({ 
                            scale, 
                            originX: -centerX * scale * ts_scale, 
                            originY: centerY * scale * ts_scale 
                        });
                    }
                    this.ctx.addLog("ZOOM_ALL: Showing drawing limits.");
                } else {
                    this.ctx.addLog("ZOOM_EXTENTS: Drawing is empty.");
                }
            }
            this.ctx.onFinish();
            return true;
        }
        if (t === 'w' || t === 'window') {
            this.ctx.setMessage("ZOOM Window: Specify first corner:");
            this.p1 = null;
            return true;
        }
        if (t === 'p' || t === 'prev' || t === 'previous') {
            const h = this.ctx.getViewHistory();
            if (h && h.length > 0) {
                const prev = h[h.length - 1];
                this.ctx.setView(prev);
                this.ctx.addLog("ZOOM_PREVIOUS: View restored.");
            } else {
                this.ctx.addLog("ZOOM_PREVIOUS: No previous view stored.");
            }
            this.ctx.onFinish();
            return true;
        }
        if (t === 'r' || t === 'realtime') {
            this.ctx.start(new ZoomRealTimeCommand(this.ctx));
            return true;
        }
        if (t === 'pan' || t === 'pn' || t === 'p pan') {
            this.ctx.start(new PanCommand(this.ctx));
            return true;
        }
        if (t === 'i' || t === 'in' || t === '+') { 
            this.applyZoomDiscrete(1.25);
            return true; 
        }
        if (t === 'o' || t === 'out' || t === '-') { 
            this.applyZoomDiscrete(1/1.25);
            return true; 
        }
        return false;
    }

    private applyZoomDiscrete(factor: number) {
        this.ctx.saveToViewHistory();
        const v = this.ctx.getViewState();
        const cursor = this.ctx.lastMousePoint;
        const ts_old = v.scale * this.ctx.getSettings().drawingScale;
        const ts_new = v.scale * factor * this.ctx.getSettings().drawingScale;

        // Zoom toward cursor/touch center
        // originX_new = originX_old + wx * (ts_old - ts_new)
        // originY_new = originY_old - wy * (ts_old - ts_new)
        this.ctx.setView(v => ({
            ...v,
            scale: v.scale * factor,
            originX: v.originX + cursor.x * (ts_old - ts_new),
            originY: v.originY - cursor.y * (ts_old - ts_new)
        }));
        this.ctx.onFinish();
    }

    onClick(p: Point, snapped: boolean, shiftKey?: boolean) {
        if (!this.p1) {
            this.p1 = p;
            this.ctx.setMessage("ZOOM Window: Specify opposite corner:");
        } else {
            const x1 = Math.min(this.p1.x, p.x);
            const x2 = Math.max(this.p1.x, p.x);
            const y1 = Math.min(this.p1.y, p.y);
            const y2 = Math.max(this.p1.y, p.y);
            
            const w = Math.max(0.001, x2 - x1);
            const h = Math.max(0.001, y2 - y1);
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
            const canvas = this.ctx.getCanvasSize();
            const ts_scale = this.ctx.getSettings().drawingScale;
            
            this.ctx.saveToViewHistory();
            const scale = Math.min(canvas.width / w, canvas.height / h) / ts_scale;
            const padding = 0.95; // Use slightly less scale to ensure we see the whole window inside
            const finalScale = scale * padding;
            
            this.ctx.setView({ 
                scale: finalScale, 
                originX: -centerX * finalScale * ts_scale, 
                originY: centerY * finalScale * ts_scale 
            });
            
            console.log(`[DEBUG] ZOOM_WINDOW: p1=[${this.p1.x.toFixed(1)}, ${this.p1.y.toFixed(1)}], p2=[${p.x.toFixed(1)}, ${p.y.toFixed(1)}], scale=${finalScale.toFixed(4)}`);
            this.ctx.onFinish();
        }
    }

    onMove(p: Point, snapped: boolean, shiftKey?: boolean) {
        if (this.p1) {
            this.ctx.setPreview([{
                id: 'z_window',
                type: 'rect',
                x: Math.min(this.p1.x, p.x),
                y: Math.min(this.p1.y, p.y),
                width: Math.abs(p.x - this.p1.x),
                height: Math.abs(p.y - this.p1.y),
                isPreview: true,
                layer: '0',
                color: '#00bcd4',
                lineType: 'dashed'
            } as any]);
        }
    }
    onEnter() { this.onInput(''); }
    onCancel() { this.ctx.onFinish(); }
}

export class ZoomRealTimeCommand implements CADCommand {
    name = "ZOOM_RT";
    base: Point | null = null;
    startView: ViewState | null = null;

    constructor(public ctx: CommandContext) {}

    onStart() {
        this.ctx.setMessage("ZOOM REALTIME: Drag vertically to zoom. Press Enter to exit.");
    }

    onClick(p: Point) {
        if (!this.base) {
            this.base = p;
            this.startView = { ...this.ctx.getViewState() };
        } else {
            this.base = null;
            this.startView = null;
            this.ctx.setMessage("ZOOM REALTIME: Click to start drag or Enter to exit.");
        }
    }

    onMove(p: Point) {
        if (this.base && this.startView) {
            const dy = this.base.y - p.y; 
            const factor = Math.pow(1.005, dy); 
            
            const nextScale = Math.max(0.000001, this.startView.scale * factor);
            const ts_old = this.startView.scale * this.ctx.getSettings().drawingScale;
            const ts_new = nextScale * this.ctx.getSettings().drawingScale;

            // Zoom around the base point (world space)
            this.ctx.setView({
                ...this.startView,
                scale: nextScale,
                originX: this.startView.originX + this.base.x * (ts_old - ts_new),
                originY: this.startView.originY - this.base.y * (ts_old - ts_new)
            });
        }
    }

    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
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
            this.ctx.addLog(`DISTANCE: ${formatLength(d, this.ctx.getSettings())}`);
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
    onStart() { this.ctx.setMessage("AREA Specify first corner point or [Object]:"); }
    onClick(p: Point) {
        if (this.pts.length === 0) {
            // Check if user clicked inside a closed object
            const allShapes = (Object.values(this.ctx.getLayers()).flat() as Shape[]);
            const hit = allShapes.find(s => isShapeClosed(s) && isPointInsideShape(p, s));
            if (hit) {
                const area = calculateArea(getShapeBoundaryPoints(hit));
                this.showResult(area);
                this.ctx.onFinish();
                return;
            }
        }
        this.pts.push(p);
        this.ctx.setMessage(`AREA Specify next point or <Enter to finish> [Points: ${this.pts.length}]`);
    }

    private showResult(a: number) {
        const settings = this.ctx.getSettings();
        const isMetric = settings.units === 'metric';
        const subUnit = settings.unitSubtype; 
        
        let displayArea = a;
        let unitStr = "sq units";

        if (isMetric) {
            if (subUnit === 'mm') {
                if (a > 1000000) {
                    displayArea = a / 1000000;
                    unitStr = "sq. m";
                } else if (a > 10000) {
                    displayArea = a / 100;
                    unitStr = "sq. cm";
                } else {
                    unitStr = "sq. mm";
                }
            } else if (subUnit === 'cm') {
                if (a > 10000) {
                    displayArea = a / 10000;
                    unitStr = "sq. m";
                } else {
                    unitStr = "sq. cm";
                }
            } else if (subUnit === 'm') {
                unitStr = "sq. m";
            }
        } else {
            unitStr = "sq. ft"; 
        }

        this.ctx.addLog(`AREA: ${displayArea.toFixed(4)} ${unitStr}`);
    }

    onMove(p: Point) {
        if (this.pts.length > 0) {
            const style = getStyleSettings(this.ctx);
            this.ctx.setPreview([{id:'p', type:'pline', isPreview:true, layer: style.layer, color: style.color, points: [...this.pts, p], closed: true} as any]);
        }
    }
    onInput(text: string) {
        const t = text.trim().toLowerCase();
        if (t === 'o' || t === 'object') {
            this.ctx.setMessage("AREA Select object:");
            return true;
        }
        return false;
    }
    onEnter() {
        if (this.pts.length > 2) {
            const a = calculateArea(this.pts);
            this.showResult(a);
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
                           text: formatAngle(val * Math.PI / 180, this.ctx.getSettings()),
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
                    text: `${prefix}${formatLength(val, appSettings)}`,
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
                text: formatLength(val, appSettings),
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
                text: formatLength(d, appSettings),
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
                if (this.dimType === 'radius') { prefix = 'R'; text = `${prefix}${formatLength(val, appSettings)}`; }
                else if (this.dimType === 'diameter') { prefix = 'Ø'; val = d * 2; text = `${prefix}${formatLength(val, appSettings)}`; }
                else if (this.p1) {
                    const a1 = Math.atan2(this.p1.y - this.center.y, this.p1.x - this.center.x);
                    const a2 = Math.atan2(p.y - this.center.y, p.x - this.center.x);
                    let diff = Math.abs(a2 - a1);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    if (this.dimType === 'arc') {
                        prefix = '⌒';
                        text = `${prefix}${formatLength(d * diff, appSettings)}`;
                    } else if (this.dimType === 'angular') {
                        text = formatAngle(diff, appSettings);
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
                    text: formatLength(val, appSettings),
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
                text: formatLength(d, appSettings),
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
    name = "PAN"; 
    base: Point | null = null;
    startView: ViewState | null = null;

    constructor(public ctx: CommandContext) {}
    
    onStart() { 
        this.ctx.setMessage("PAN: Click two points to move view or [Drag] with left-button. Enter to exit."); 
    }
    
    onClick(p: Point, snapped: boolean, shiftKey?: boolean) {
        if (!this.base) {
            this.base = p;
            this.startView = { ...this.ctx.getViewState() };
            this.ctx.setMessage("PAN: Specify second point:");
        } else {
            const dx = p.x - this.base.x;
            const dy = p.y - this.base.y;
            
            const settings = this.ctx.getSettings();
            const ts = this.startView!.scale * settings.drawingScale;
            
            this.ctx.setView({
                ...this.startView!,
                originX: this.startView!.originX + (dx * ts),
                originY: this.startView!.originY - (dy * ts)
            });
            this.ctx.onFinish();
        }
    }

    onMove(p: Point, snapped: boolean, shiftKey?: boolean) {
        if (this.base && this.startView) {
            const dx = p.x - this.base.x;
            const dy = p.y - this.base.y;
            const ts = this.startView.scale * this.ctx.getSettings().drawingScale;
            
            // Limit coordinate range to prevent instability
            const nextView = {
                ...this.startView,
                originX: this.startView.originX + (dx * ts),
                originY: this.startView.originY - (dy * ts)
            };
            
            // Sanity check
            if (isNaN(nextView.originX) || isNaN(nextView.originY)) return;
            if (Math.abs(nextView.originX) > 1e12 || Math.abs(nextView.originY) > 1e12) return;

            this.ctx.setView(nextView);
        }
    }

    onEnter() { this.ctx.onFinish(); } 
    onCancel() { this.ctx.onFinish(); }
}

export class OffsetCommand implements CADCommand {
    name = "OFFSET"; 
    public dist: number = 0; 
    public target: Shape | null = null;
    public mode: 'dist' | 'through' = 'dist';

    constructor(public ctx: CommandContext) {}

    onStart() { 
        this.ctx.setMessage("OFFSET Specify offset distance or [Through] <" + (this.dist || "Through") + ">:"); 
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        if (t === 't' || t === 'through') {
            this.mode = 'through';
            this.ctx.setMessage("OFFSET Select object to offset:");
            return true;
        }

        if (this.target === null) {
            const d = parseLength(text, this.ctx.getSettings());
            if (!isNaN(d) && d > 0) { 
                this.dist = d; 
                this.mode = 'dist';
                this.ctx.setMessage("OFFSET Select object to offset:"); 
                return true; 
            }
        }
        return false;
    }

    onClick(p: Point) {
        if (!this.target) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) { 
                this.target = hit; 
                this.ctx.setMessage(this.mode === 'through' ? "OFFSET Specify through point:" : "OFFSET Specify point on side to offset:"); 
            }
        } else {
            let off: Shape | null = null;
            if (this.mode === 'through') {
                // Calculate distance from p to target
                // For now, distance function in cadService might not support point-to-unbounded-shape perfectly
                // but we can estimate or use offsetShape with a calculated distance.
                // Professional CAD does this accurately.
                // Simple implementation: calculate minDist from p to target
                // We'll use a placeholder for now or a simple distance calculation if available.
                const d = this.getMinDist(p, this.target);
                off = offsetShape(this.target, d, p);
            } else {
                off = offsetShape(this.target, this.dist, p);
            }

            if (off) {
                const style = getStyleSettings(this.ctx);
                this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), off!]}));
                this.ctx.addLog(`OFFSET_CREATED: ${this.target.type}`);
            }
            // Reset target but keep distance/mode for next object
            this.target = null;
            this.ctx.setMessage("OFFSET Select object to offset:");
        }
    }

    private getMinDist(p: Point, s: Shape): number {
        // Very basic min distance approximation for 'Through'
        if (s.type === 'line') {
            const l = s as LineShape;
            const A = p.x - l.x1, B = p.y - l.y1, C = l.x2 - l.x1, D = l.y2 - l.y1;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            const param = lenSq !== 0 ? dot / lenSq : -1;
            let xx, yy;
            if (param < 0) { xx = l.x1; yy = l.y1; }
            else if (param > 1) { xx = l.x2; yy = l.y2; }
            else { xx = l.x1 + param * C; yy = l.y1 + param * D; }
            return Math.sqrt((p.x - xx)**2 + (p.y - yy)**2);
        }
        if (s.type === 'circle') {
            const c = s as CircleShape;
            return Math.abs(distance(p, {x: c.x, y: c.y}) - c.radius);
        }
        return 0; // Default
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
            const style = getStyleSettings(this.ctx, this.name);
            const layer = style.layer;
            const shape: InfiniteLineShape = {
                id: generateId(), type: 'ray', layer, color: style.color,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                thickness: style.thickness, lineType: style.lineType
            };
            this.ctx.setLayers(prev => ({ ...prev, [layer]: [...(prev[layer] || []), shape] }));
            this.p1 = null;
            this.ctx.setMessage("RAY Specify start point:");
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx, this.name);
            this.ctx.setPreview([{
                id: 'preview', type: 'ray', isPreview: true,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                color: style.color, layer: style.layer, lineType: style.lineType
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
            const style = getStyleSettings(this.ctx, this.name);
            const layer = style.layer;
            const shape: InfiniteLineShape = {
                id: generateId(), type: 'xline', layer, color: style.color,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                thickness: style.thickness, lineType: style.lineType
            };
            this.ctx.setLayers(prev => ({ ...prev, [layer]: [...(prev[layer] || []), shape] }));
            this.p1 = null;
            this.ctx.setMessage("XLINE Specify a point:");
        }
    }
    onMove(p: Point) {
        if (this.p1) {
            const style = getStyleSettings(this.ctx, this.name);
            this.ctx.setPreview([{
                id: 'preview', type: 'xline', isPreview: true,
                x1: this.p1.x, y1: this.p1.y, x2: p.x, y2: p.y,
                color: style.color, layer: style.layer, lineType: style.lineType
            } as any]);
        }
    }
    onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class FilletCommand implements CADCommand {
    name = "FILLET"; radius: number = 0; s1: Shape | null = null; isMultiple: boolean = false;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("FILLET Select first object or [Radius/Multiple] <" + this.radius + ">:"); }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'r' || t === 'radius') { this.ctx.setMessage("FILLET Specify fillet radius <" + this.radius + ">:"); return true; }
        if (t === 'm' || t === 'multiple') { this.isMultiple = true; this.ctx.setMessage("FILLET [Multiple] Select first object or [Radius]:"); return true; }
        const r = parseLength(text, this.ctx.getSettings());
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
                    this.ctx.addLog("FILLET_CREATED");
                }
            }
            if (this.isMultiple) {
                this.s1 = null;
                this.ctx.setSelectedIds([]);
                this.ctx.setMessage("FILLET Select first object:");
            } else {
                this.ctx.onFinish();
            }
        }
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class ChamferCommand implements CADCommand {
    name = "CHAMFER"; dist1: number = 0; dist2: number = 0; s1: Shape | null = null; isMultiple: boolean = false;
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("CHAMFER Select first line or [Distance/Multiple] <" + this.dist1 + ", " + (this.dist2 || this.dist1) + ">:"); }
    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        if (t === 'd' || t === 'distance') { this.ctx.setMessage("CHAMFER Specify first chamfer distance <" + this.dist1 + ">:"); return true; }
        if (t === 'm' || t === 'multiple') { this.isMultiple = true; this.ctx.setMessage("CHAMFER [Multiple] Select first line or [Distance]:"); return true; }
        const d = parseLength(text, this.ctx.getSettings());
        if (!isNaN(d)) {
            if (this.dist1 === 0 || text.includes('d')) { // Simplified check for "re-setting" distance
                 this.dist1 = d; this.ctx.setMessage("CHAMFER Specify second chamfer distance <" + this.dist1 + ">:"); 
            }
            else { this.dist2 = d; this.ctx.setMessage("CHAMFER Select first line:"); }
            return true;
        }
        return false;
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (!hit || hit.type !== 'line') return;

        if (!this.s1) {
            this.s1 = hit;
            this.ctx.setSelectedIds([hit.id]);
            this.ctx.setMessage("CHAMFER Select second line:");
        } else {
            if (this.s1.id === hit.id) return;
            const res = chamferLines(this.s1 as LineShape, hit as LineShape, this.dist1, this.dist2 || this.dist1);
            if (res) {
                this.ctx.setLayers(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(l => {
                        next[l] = next[l].filter(s => s.id !== this.s1!.id && s.id !== hit.id);
                    });
                    const layer = getStyleSettings(this.ctx).layer;
                    next[layer] = [...(next[layer] || []), res.l1, res.l2];
                    if (res.chamfer) next[layer] = [...next[layer], res.chamfer];
                    return next;
                });
                this.ctx.addLog("CHAMFER_CREATED");
            }
            if (this.isMultiple) {
                this.s1 = null;
                this.ctx.setSelectedIds([]);
                this.ctx.setMessage("CHAMFER Select first line:");
            } else {
                this.ctx.onFinish();
            }
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
    onClick(p: Point, snapped: boolean, shiftKey?: boolean) {
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
        } else if (hit) {
            const results = shiftKey 
                ? getExtendedShapes(this.cutters, [hit], p)
                : getTrimmedShapes(this.cutters, [hit], p);
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
                this.ctx.setMessage(shiftKey ? "EXTEND Select object to extend:" : "TRIM Select object to trim:");
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

export class RotateCommand implements CADCommand {
    name = "ROTATE"; 
    base: Point | null = null; 
    selecting = true;
    mode: 'angle' | 'reference' | 'ref_second' = 'angle';
    isCopy: boolean = false;
    refPoint1: Point | null = null;
    refAngle: number | null = null;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { 
            this.selecting = false; 
            this.ctx.setMessage("ROTATE Specify base point:"); 
        }
        else { 
            this.selecting = true; 
            this.ctx.setMessage("ROTATE Select objects:"); 
        }
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        if (this.selecting) return false;

        if (!this.base) return false;

        if (this.mode === 'angle') {
            if (t === 'c' || t === 'copy') {
                this.isCopy = true;
                this.ctx.setMessage("ROTATE [Copy] Specify rotation angle or [Reference]:");
                return true;
            }
            if (t === 'r' || t === 'reference') {
                this.mode = 'reference';
                this.ctx.setMessage("ROTATE Specify reference angle <0>:");
                return true;
            }

            const val = parseFloat(text); // Angle is always numeric degrees
            if (!isNaN(val)) {
                this.applyRotate((val * Math.PI) / 180);
                return true;
            }
        } else if (this.mode === 'reference') {
             const val = parseFloat(text);
             if (!isNaN(val)) {
                 this.refAngle = (val * Math.PI) / 180;
                 this.mode = 'ref_second';
                 this.ctx.setMessage("ROTATE Specify new angle:");
                 return true;
             }
        }

        return false;
    }

    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`ROTATE ${this.ctx.getSelectedIds().length} selected. <Enter> to continue:`);
            }
        } else if (!this.base) {
            this.base = p; 
            this.ctx.setMessage("ROTATE Specify rotation angle or [Copy/Reference]:");
        } else if (this.mode === 'reference') {
            this.refPoint1 = p;
            this.refAngle = Math.atan2(p.y - this.base.y, p.x - this.base.x);
            this.mode = 'ref_second';
            this.ctx.setMessage("ROTATE Specify second point (direction):");
        } else if (this.mode === 'ref_second') {
            const secondAngle = Math.atan2(p.y - this.base.y, p.x - this.base.x);
            const angle = secondAngle - (this.refAngle || 0);
            this.applyRotate(angle);
        } else {
            const dx = p.x - this.base.x, dy = p.y - this.base.y;
            this.applyRotate(Math.atan2(dy, dx));
        }
    }

    onMove(p: Point) {
        if (this.base) {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            
            let angle = 0;
            if (this.mode === 'ref_second') {
                const secondAngle = Math.atan2(p.y - this.base.y, p.x - this.base.x);
                angle = secondAngle - (this.refAngle || 0);
            } else {
                angle = Math.atan2(p.y - this.base.y, p.x - this.base.x);
            }

            this.ctx.setPreview(all.map(s => ({...rotateShape(s, this.base!, angle), isPreview: true} as any)));
        }
    }

    applyRotate(angle: number) {
        const ids = this.ctx.getSelectedIds();
        const style = getStyleSettings(this.ctx);
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                const selectedOnLayer = next[l].filter(s => ids.includes(s.id));
                const rotated = selectedOnLayer.map(s => rotateShape(s, this.base!, angle));
                
                if (this.isCopy) {
                    // Generate new IDs for copies
                    const copies = rotated.map(s => ({ ...s, id: generateId(), layer: style.layer }));
                    next[style.layer] = [...(next[style.layer] || []), ...copies];
                } else {
                    next[l] = next[l].map(s => ids.includes(s.id) ? rotateShape(s, this.base!, angle) : s);
                }
            });
            return next;
        });
        this.ctx.onFinish();
    }

    onEnter() { 
        if (this.selecting) { 
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false; 
                this.ctx.setMessage("ROTATE Specify base point:"); 
            } else {
                this.ctx.onFinish();
            }
        } else {
            this.ctx.onFinish();
        }
    }

    onCancel() { this.ctx.onFinish(); }
}

export class ScaleCommand implements CADCommand {
    name = "SCALE"; 
    base: Point | null = null; 
    selecting = true;
    mode: 'factor' | 'reference' | 'ref_second' = 'factor';
    isCopy: boolean = false;
    refDist: number | null = null;

    constructor(public ctx: CommandContext) {}

    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { 
            this.selecting = false; 
            this.ctx.setMessage("SCALE Specify base point:"); 
        }
        else { 
            this.selecting = true; 
            this.ctx.setMessage("SCALE Select objects:"); 
        }
    }

    onInput(text: string): boolean {
        const t = text.trim().toLowerCase();
        
        if (this.selecting) return false;
        if (!this.base) return false;

        if (this.mode === 'factor') {
            if (t === 'c' || t === 'copy') {
                this.isCopy = true;
                this.ctx.setMessage("SCALE [Copy] Specify scale factor or [Reference]:");
                return true;
            }
            if (t === 'r' || t === 'reference') {
                this.mode = 'reference';
                this.ctx.setMessage("SCALE Specify reference length <1>:");
                return true;
            }

            const val = parseLength(text, this.ctx.getSettings());
            if (!isNaN(val)) {
                this.applyScale(val);
                return true;
            }
        } else if (this.mode === 'reference') {
             const val = parseLength(text, this.ctx.getSettings());
             if (!isNaN(val)) {
                 this.refDist = val;
                 this.mode = 'ref_second';
                 this.ctx.setMessage("SCALE Specify new length:");
                 return true;
             }
        } else if (this.mode === 'ref_second') {
             const val = parseLength(text, this.ctx.getSettings());
             if (!isNaN(val)) {
                 const factor = val / (this.refDist || 1);
                 this.applyScale(factor);
                 return true;
             }
        }

        return false;
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
            this.base = p; 
            this.ctx.setMessage("SCALE Specify scale factor or [Copy/Reference]:");
        } else if (this.mode === 'reference') {
            this.refDist = distance(this.base, p);
            this.mode = 'ref_second';
            this.ctx.setMessage("SCALE Specify new length:");
        } else if (this.mode === 'ref_second') {
            const newDist = distance(this.base, p);
            const factor = newDist / (this.refDist || 1);
            this.applyScale(factor);
        } else {
            const d1 = 100, d2 = distance(this.base, p);
            this.applyScale(d2 / d1);
        }
    }

    onMove(p: Point) {
        if (this.base) {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            
            let factor = 1;
            if (this.mode === 'ref_second') {
                const newDist = distance(this.base, p);
                factor = newDist / (this.refDist || 1);
            } else {
                const d1 = 100, d2 = distance(this.base, p);
                factor = d2 / d1;
            }

            this.ctx.setPreview(all.map(s => ({...scaleShape(s, this.base!, factor), isPreview: true} as any)));
        }
    }

    applyScale(factor: number) {
        if (factor === 0) return;
        const ids = this.ctx.getSelectedIds();
        const style = getStyleSettings(this.ctx);
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                const selectedOnLayer = next[l].filter(s => ids.includes(s.id));
                const scaled = selectedOnLayer.map(s => scaleShape(s, this.base!, factor));
                
                if (this.isCopy) {
                    const copies = scaled.map(s => ({ ...s, id: generateId(), layer: style.layer }));
                    next[style.layer] = [...(next[style.layer] || []), ...copies];
                } else {
                    next[l] = next[l].map(s => ids.includes(s.id) ? scaleShape(s, this.base!, factor) : s);
                }
            });
            return next;
        });
        this.ctx.onFinish();
    }

    onEnter() { 
        if (this.selecting) { 
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false; 
                this.ctx.setMessage("SCALE Specify base point:"); 
            } else {
                this.ctx.onFinish();
            }
        } else {
            this.ctx.onFinish();
        }
    }

    onCancel() { this.ctx.onFinish(); }
}

export class MirrorCommand implements CADCommand {
    name = "MIRROR"; p1: Point | null = null; p2: Point | null = null; selecting = true; awaitingErase = false;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) { 
            this.selecting = false; 
            this.ctx.setMessage("MIRROR Specify first point of mirror line:"); 
        } else { 
            this.selecting = true; 
            this.ctx.setMessage("MIRROR Select objects:"); 
        }
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
            this.p1 = p; 
            this.ctx.setMessage("MIRROR Specify second point of mirror line:");
        } else if (!this.p2) {
            this.p2 = p;
            this.ctx.setMessage("MIRROR Erase source objects? [Yes/No] <N>:");
            this.awaitingErase = true;
        }
    }
    onMove(p: Point) {
        if (this.p1 && !this.awaitingErase) {
            const ids = this.ctx.getSelectedIds();
            const all = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
            this.ctx.setPreview(all.map(s => ({...mirrorShape(s, this.p1!, p), isPreview: true} as any)));
        }
    }
    onInput(text: string): boolean {
        if (this.awaitingErase) {
            const t = text.trim().toLowerCase();
            if (t === 'y' || t === 'yes' || t === 'n' || t === 'no' || t === '') {
                const erase = (t === 'y' || t === 'yes');
                this.applyMirror(erase);
                return true;
            }
        }
        return false;
    }
    applyMirror(erase: boolean) {
        const ids = this.ctx.getSelectedIds();
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                const mirrored = next[l].filter(s => ids.includes(s.id)).map(s => mirrorShape(s, this.p1!, this.p2!));
                if (erase) {
                    next[l] = next[l].filter(s => !ids.includes(s.id));
                }
                next[l] = [...next[l], ...mirrored];
            });
            return next;
        });
        this.ctx.onFinish();
    }
    onEnter() { 
        if (this.selecting) { 
            this.selecting = false; 
            this.ctx.setMessage("MIRROR Specify first point of mirror line:"); 
        } else if (this.awaitingErase) {
            this.applyMirror(false);
        }
    }
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
    onClick(p: Point, snapped: boolean, shiftKey?: boolean) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (this.selectingBoundaries) {
            if (hit) {
                if (!this.boundaries.find(b => b.id === hit.id)) {
                    this.boundaries.push(hit);
                    this.ctx.setSelectedIds(this.boundaries.map(b => b.id));
                    this.ctx.setMessage(`EXTEND ${this.boundaries.length} selected. Select more or <Enter> to continue:`);
                }
            }
        } else if (hit) {
            const results = shiftKey
                ? getTrimmedShapes(this.boundaries, [hit], p)
                : getExtendedShapes(this.boundaries, [hit], p);
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
                this.ctx.setMessage(shiftKey ? "TRIM Select object to trim:" : "EXTEND Select object to extend:");
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
        const val = parseLength(text, this.ctx.getSettings());
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
        const p = resolvePointInput(text, null, this.ctx.getSettings(), this.ctx.lastMousePoint);
        if (p) { this.onClick(p); return true; }
        return false;
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
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
        if (this.ctx.getSelectedIds().length > 0) {
            this.selecting = false;
            this.ctx.setMessage("BLOCK Objects selected. Enter block name:");
        } else {
            this.ctx.setMessage("BLOCK Select objects to include in block:");
        }
    }
    onInput(text: string): boolean {
        if (!this.blockName) {
            const name = text.trim();
            if (!name) return false;
            this.blockName = name;
            this.ctx.setMessage(`BLOCK [${this.blockName}] Specify base point:`);
            this.selecting = false;
            return true;
        }
        return false;
    }
    onClick(p: Point) {
        if (this.selecting) {
            const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
            const all = Object.values(this.ctx.getLayers()).flat();
            const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
            if (hit) {
                this.ctx.setSelectedIds(prev => prev.includes(hit.id) ? prev : [...prev, hit.id]);
                this.ctx.setMessage(`BLOCK ${this.ctx.getSelectedIds().length} objects. <Enter> to name block:`);
            }
        } else if (!this.basePoint) {
            this.basePoint = p;
            this.createBlock();
        }
    }
    onEnter() {
        if (this.selecting) {
            if (this.ctx.getSelectedIds().length > 0) {
                this.selecting = false;
                this.ctx.setMessage("BLOCK Enter block name:");
            } else {
                this.ctx.addLog("No objects selected for block.");
                this.ctx.onFinish();
            }
        } else if (!this.blockName) {
            // Already handled by onInput, but just in case
        }
    }
    createBlock() {
        const ids = this.ctx.getSelectedIds();
        const selectedShapes = Object.values(this.ctx.getLayers()).flat().filter(s => ids.includes(s.id));
        if (selectedShapes.length === 0 || !this.blockName || !this.basePoint) return;

        const block: BlockDefinition = {
            id: generateId(),
            name: this.blockName,
            basePoint: this.basePoint!,
            shapes: selectedShapes.map(s => moveShape(JSON.parse(JSON.stringify(s)), -this.basePoint!.x, -this.basePoint!.y))
        };
        
        const style = getStyleSettings(this.ctx);
        const instance: Shape = {
            id: generateId(),
            type: 'block',
            blockId: this.blockName,
            x: this.basePoint.x,
            y: this.basePoint.y,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            layer: style.layer,
            color: style.color
        } as any;

        this.ctx.setBlocks(prev => ({ ...prev, [this.blockName]: block }));
        
        // Remove original shapes and add block instance
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].filter(s => !ids.includes(s.id));
            });
            next[style.layer] = [...(next[style.layer] || []), instance];
            return next;
        });

        this.ctx.addLog(`BLOCK_CREATED: ${this.blockName}`);
        this.ctx.onFinish();
    }
    onMove() {}
    onCancel() { this.ctx.onFinish(); }
}

export class ExplodeCommand implements CADCommand {
    name = "EXPLODE"; selecting = true;
    constructor(public ctx: CommandContext) {}
    onStart() { 
        if (this.ctx.getSelectedIds().length > 0) {
            this.explodeSelected();
        } else {
            this.ctx.setMessage("EXPLODE Select blocks to explode:"); 
        }
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => s.type === 'block' && hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (hit && hit.type === 'block') {
            this.explode(hit as BlockShape);
        }
    }
    explodeSelected() {
        const ids = this.ctx.getSelectedIds();
        const all = Object.values(this.ctx.getLayers()).flat();
        const targets = all.filter(s => s.type === 'block' && ids.includes(s.id)) as BlockShape[];
        if (targets.length > 0) {
            targets.forEach(t => this.explode(t, false));
            this.ctx.onFinish();
        }
    }
    explode(s: BlockShape, finish: boolean = true) {
        const block = this.ctx.getBlocks()[s.blockId];
        if (!block) return;
        const explodedShapes = block.shapes.map(bs => moveShape(JSON.parse(JSON.stringify(bs)), s.x, s.y));
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].filter(sh => sh.id !== s.id);
            });
            explodedShapes.forEach(es => {
                const l = es.layer || '0';
                next[l] = [...(next[l] || []), es];
            });
            return next;
        });
        this.ctx.addLog("BLOCK_EXPLODED");
        if (finish) this.ctx.onFinish();
    }
    onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class ImportCommand implements CADCommand {
    name = "IMPORT";
    constructor(public ctx: CommandContext) {}
    onStart() { this.ctx.setMessage("IMPORT Paste JSON block definitions:"); }
    onInput(text: string): boolean {
        try {
            const data = JSON.parse(text);
            if (data.blocks) {
                this.ctx.setBlocks(prev => ({ ...prev, ...data.blocks }));
                this.ctx.addLog(`Imported ${Object.keys(data.blocks).length} blocks.`);
            } else if (data.shapes) {
                // Import as a new block maybe?
                const name = "IMPORTED_" + Date.now();
                this.ctx.setBlocks(prev => ({ ...prev, [name]: { id: generateId(), name, basePoint: {x:0, y:0}, shapes: data.shapes } }));
                this.ctx.addLog(`Imported shapes as block: ${name}`);
            }
            this.ctx.onFinish();
            return true;
        } catch (e) {
            this.ctx.setMessage("Invalid JSON. Try again or Cancel:");
            return false;
        }
    }
    onClick() {} onMove() {} onEnter() { this.ctx.onFinish(); } onCancel() { this.ctx.onFinish(); }
}

export class HatchCommand implements CADCommand {
    name = "HATCH"; 
    constructor(public ctx: CommandContext) {}
    onStart() {
        // If there's a selection, try hatching that
        const selectedIds = this.ctx.getSelectedIds();
        if (selectedIds.length > 0) {
            const allShapes = Object.values(this.ctx.getLayers()).flat();
            const selectedShapes = allShapes.filter(s => selectedIds.includes(s.id));
            
            // First check if any single shape is closed
            const closedShapes = selectedShapes.filter(isShapeClosed);
            if (closedShapes.length > 0) {
                this.triggerSelector(closedShapes);
                return;
            }
            
            // Then check if the selection of multiple entities forms a closed boundary
            const combinedBoundary = extractBoundaryFromShapes(selectedShapes);
            if (combinedBoundary) {
                // Hack: We need a temporary shape to represent this boundary for triggerSelector
                const tempShape: PolyShape = { id: 'temp', type: 'pline', points: combinedBoundary, closed: true, layer: '0', color: '#888888' };
                this.triggerSelector([tempShape]);
                return;
            }
        }
        this.ctx.setMessage("HATCH: Select closed boundary entities or click inside:");
    }

    private triggerSelector(targets: Shape[]) {
        if (this.ctx.onExternalRequest) {
            this.ctx.onExternalRequest('hatch_selector', null, (pattern) => {
                if (pattern) {
                    const style = getStyleSettings(this.ctx);
                    targets.forEach(boundary => {
                        const points = getShapeBoundaryPoints(boundary);
                        if (points.length > 2) {
                            const bounds = getShapeBounds(boundary);
                            const width = bounds.xMax - bounds.xMin;
                            const height = bounds.yMax - bounds.yMin;
                            const diagonal = Math.sqrt(width * width + height * height);
                            
                            // Auto-scale logic: 
                            // We want roughly 20 lines across the diagonal.
                            // Base spacing for lines is 24, for dots is 12.
                            const baseSpacing = pattern === 'dots' ? 12 : 24;
                            let autoScale = diagonal / (20 * baseSpacing);

                            // Clamp to reasonable defaults
                            autoScale = Math.max(0.01, Math.min(100, autoScale));

                            const hatch: HatchShape = {
                                id: generateId(), type: 'hatch', pattern: pattern, points: [...points],
                                layer: style.layer, color: style.color, 
                                scale: autoScale, 
                                rotation: pattern.startsWith('ansi3') ? 0 : 0
                            };
                            this.ctx.setLayers(prev => ({...prev, [style.layer]: [...(prev[style.layer] || []), hatch]}));
                        }
                    });
                    this.ctx.onFinish();
                } else {
                    this.ctx.onFinish();
                }
            });
        }
    }

    onClick(p: Point) {
        const all = Object.values(this.ctx.getLayers()).flat();
        // Find smallest closed shape containing the point
        const boundaries = all.filter(s => isShapeClosed(s) && isPointInsideShape(p, s));
        
        if (boundaries.length > 0) {
            // Sort by "area" roughly (estimate by bounds) to find smallest nesting
            boundaries.sort((a, b) => {
                const ba = getShapeBounds(a);
                const bb = getShapeBounds(b);
                const aa = (ba.xMax - ba.xMin) * (ba.yMax - ba.yMin);
                const ab = (bb.xMax - bb.xMin) * (bb.yMax - bb.yMin);
                return aa - ab;
            });
            
            const target = boundaries[0];
            this.triggerSelector([target]);
        } else {
            this.ctx.setMessage("HATCH: No closed boundary found. Click again.");
        }
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
    onStart() { 
        this.ctx.setMessage("FILTER: Criteria (e.g. 'type:line', 'layer:0', 'color:red', 'len>100')."); 
    }
    onInput(text: string): boolean {
        const input = text.trim().toLowerCase();
        if (!input) {
            this.ctx.onFinish();
            return true;
        }

        const all = Object.values(this.ctx.getLayers()).flat();
        let filtered = [...all];

        const terms = input.split(/\s+/);
        terms.forEach(term => {
            if (term.includes(':') || term.includes('>') || term.includes('<') || term.includes('=')) {
                let key: string, val: string, op = ':';
                if (term.includes('>')) { [key, val] = term.split('>'); op = '>'; }
                else if (term.includes('<')) { [key, val] = term.split('<'); op = '<'; }
                else if (term.includes('=')) { [key, val] = term.split('='); op = '='; }
                else if (term.includes(':')) { [key, val] = term.split(':'); op = ':'; }
                else { key = term; val = ''; }

                key = key.toLowerCase();
                const numVal = parseFloat(val);

                if (key === 'l' || key === 'layer') {
                    filtered = filtered.filter(s => s.layer.toLowerCase() === val.toLowerCase());
                } else if (key === 'c' || key === 'color') {
                    filtered = filtered.filter(s => s.color?.toLowerCase().includes(val.toLowerCase()));
                } else if (key === 't' || key === 'type') {
                    filtered = filtered.filter(s => s.type.toLowerCase().includes(val.toLowerCase()));
                } else if (key === 'r' || key === 'radius') {
                    filtered = filtered.filter(s => (s.type === 'circle' || s.type === 'arc') && this.compare(s.radius, numVal, op));
                } else if (key === 'len' || key === 'length') {
                    filtered = filtered.filter(s => {
                        let len = 0;
                        if (s.type === 'line') len = Math.hypot(s.x2-s.x1, s.y2-s.y1);
                        else if (s.type === 'circle') len = 2 * Math.PI * s.radius;
                        else if (s.type === 'pline') {
                            for(let i=0; i<s.points.length-1; i++) len += Math.hypot(s.points[i+1].x-s.points[i].x, s.points[i+1].y-s.points[i].y);
                        }
                        return this.compare(len, numVal, op);
                    });
                }
            } else {
                // General match
                filtered = filtered.filter(s => 
                    s.type.toLowerCase() === term || 
                    s.layer.toLowerCase() === term ||
                    (s.color && s.color.toLowerCase().includes(term))
                );
            }
        });

        const ids = filtered.map(s => s.id);
        this.ctx.setSelectedIds(ids);
        this.ctx.addLog(`FILTERED: ${ids.length} shapes selected`);
        this.ctx.onFinish();
        return true;
    }
    private compare(v: number, target: number, op: string) {
        if (op === '>') return v > target;
        if (op === '<') return v < target;
        if (op === '=' || op === ':') return Math.abs(v - target) < 0.001;
        return false;
    }
    onClick() { this.ctx.onFinish(); } 
    onMove() {} 
    onEnter() { this.ctx.onFinish(); } 
    onCancel() { this.ctx.onFinish(); }
}

export class GripEditCommand implements CADCommand {
    name = "GRIP_EDIT";
    shape: Shape | null = null;
    gripIndex: number = -1;
    
    constructor(public ctx: CommandContext, params: { shapeId: string, gripIndex: number }) {
        const all = Object.values(this.ctx.getLayers()).flat();
        this.shape = all.find(s => s.id === params.shapeId) || null;
        this.gripIndex = params.gripIndex;
    }
    
    onStart() { 
        this.ctx.setMessage("GRIP EDIT: Drag to stretch object:"); 
    }
    
    onMove(p: Point, snapped: boolean) {
        if (!this.shape) return;
        const pts = (this.shape as any).points;
        const origin = (this.gripIndex === -1 || !pts) ? {x:0, y:0} : pts[this.gripIndex];
        const finalP = applyOrthoConstraint(p, origin, this.ctx.getSettings().ortho, snapped);
        const newShape = modifyShapeByGrip(this.shape, this.gripIndex, finalP);
        this.ctx.setPreview([newShape]);
    }
    
    onClick(p: Point, snapped: boolean) {
        if (!this.shape) return;
        const pts = (this.shape as any).points;
        const origin = (this.gripIndex === -1 || !pts) ? {x:0, y:0} : pts[this.gripIndex];
        const finalP = applyOrthoConstraint(p, origin, this.ctx.getSettings().ortho, snapped);
        this.applyGrip(finalP);
    }
    
    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
    
    applyGrip(p: Point) {
        if (!this.shape) { this.ctx.onFinish(); return; }
        const newShape = modifyShapeByGrip(this.shape, this.gripIndex, p);
        this.ctx.setLayers(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(l => {
                next[l] = next[l].map(s => s.id === this.shape!.id ? newShape : s);
            });
            return next;
        });
        this.ctx.onFinish();
    }
}

export class MatchPropertiesCommand implements CADCommand {
    name = "MATCHPROP";
    source: Shape | null = null;
    constructor(public ctx: CommandContext) {}
    onStart() {
        this.ctx.setMessage("MATCHPROP Select source object:");
    }
    onClick(p: Point) {
        const ts = this.ctx.getViewState().scale * this.ctx.getSettings().drawingScale;
        const all = Object.values(this.ctx.getLayers()).flat();
        const hit = all.find(s => hitTestShape(p.x, p.y, s, 15/ts, this.ctx.getBlocks()));
        if (!hit) return;

        if (!this.source) {
            this.source = hit;
            this.ctx.setMessage("MATCHPROP Select destination objects:");
            this.ctx.setSelectedIds([hit.id]);
        } else {
            const updates: Partial<Shape> = {
                color: this.source.color,
                layer: this.source.layer,
                lineType: this.source.lineType,
                thickness: this.source.thickness
            };
            
            // If it's a hatch, maybe match hatch properties too
            if (this.source.type === 'hatch' && hit.type === 'hatch') {
                (updates as HatchShape).pattern = this.source.pattern;
                (updates as HatchShape).scale = this.source.scale;
                (updates as HatchShape).rotation = this.source.rotation;
            }

            this.ctx.setLayers(prev => {
                const next = { ...prev };
                let found = false;
                Object.keys(next).forEach(l => {
                    const idx = next[l].findIndex(s => s.id === hit.id);
                    if (idx !== -1) {
                        const updated = { ...next[l][idx], ...updates } as Shape;
                        next[l] = [...next[l]];
                        
                        if (updated.layer !== l) {
                            next[l].splice(idx, 1);
                            const newL = updated.layer || '0';
                            next[newL] = [...(next[newL] || []), updated];
                        } else {
                            next[l][idx] = updated;
                        }
                        found = true;
                    }
                });
                return next;
            });
            this.ctx.addLog("Properties matched");
        }
    }
    onMove(p: Point) {}
    onEnter() { this.ctx.onFinish(); }
    onCancel() { this.ctx.onFinish(); }
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
            this.ctx.setLayouts([...layouts, { id, name, paperSize: { width: 297, height: 210 }, viewports: [], entities: [] }]);
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
