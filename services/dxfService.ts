
import DxfParser from 'dxf-parser';
import { 
    Shape, LineShape, CircleShape, RectShape, PolyShape, ArcShape, TextShape, 
    DoubleLineShape, EllipseShape, PointShape, DimensionShape, InfiniteLineShape, 
    Point, LayerConfig, MTextShape, AppSettings, BlockDefinition, VoxProject, LineTypeDefinition 
} from '../types';
import { generateId, getAllShapesBounds } from './cadService';
import { aciToHex, hexToACI } from './colorUtils';

const mmToDXFLineWeight = (mm: number | string | undefined): number => {
    if (mm === undefined || mm === '' || mm === 'bylayer' || mm === 'BYLAYER') return -1;
    if (mm === 'byblock' || mm === 'BYBLOCK') return -2;
    const num = typeof mm === 'string' ? parseFloat(mm) : mm;
    if (isNaN(num)) return -1;
    const weights = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
    const val = Math.round(num * 100);
    let closest = weights[0];
    let minDiff = Math.abs(val - weights[0]);
    for (const w of weights) {
        const diff = Math.abs(val - w);
        if (diff < minDiff) {
            minDiff = diff;
            closest = w;
        }
    }
    return closest;
};

class DXFWriter {
    private handle = 1;
    private output = "";

    nextHandle(): string {
        return (this.handle++).toString(16).toUpperCase();
    }

    write(code: number, value: any) {
        let val = value;
        if (typeof value === 'number') {
            if ((code >= 10 && code <= 59) || (code >= 140 && code <= 147) || (code >= 210 && code <= 239) || code === 40 || code === 41 || code === 42) {
                val = value.toFixed(8).replace(/\.?0+$/, (m) => m.indexOf('.') > -1 ? '.0' : '');
                if (val.endsWith('.')) val += '0';
            }
        }
        this.output += `${code}\r\n${val}\r\n`;
    }

    section(name: string, callback: () => void) {
        this.write(0, "SECTION");
        this.write(2, name);
        callback();
        this.write(0, "ENDSEC");
    }

    table(name: string, handle: string, count: number, callback: () => void) {
        this.write(0, "TABLE");
        this.write(2, name);
        this.write(5, handle);
        this.write(330, "0");
        this.write(100, "AcDbSymbolTable");
        this.write(70, count);
        callback();
        this.write(0, "ENDTAB");
    }

    getOutput(): string {
        const result = "999\r\nVoxCADD-Project-v1.0.0\r\n" + this.output + "0\r\nEOF\r\n";
        return result;
    }
}

export const shapesToDXF = (
    shapes: Shape[], 
    layerConfigs?: Record<string, LayerConfig>, 
    settings?: AppSettings,
    blocks?: Record<string, BlockDefinition>
): string => {
    try {
        const writer = new DXFWriter();
        const baseLayers = { ...(layerConfigs || {}) };
    if (!baseLayers['0']) {
        baseLayers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
    }
    const layers = baseLayers;
    const blockRecords: Record<string, string> = {};
    
    // Handles for tables
    const hLType = writer.nextHandle();
    const hLayer = writer.nextHandle();
    const hStyle = writer.nextHandle();
    const hView = writer.nextHandle();
    const hUCS = writer.nextHandle();
    const hAppId = writer.nextHandle();
    const hDimStyle = writer.nextHandle();
    const hBlockRecord = writer.nextHandle();
    const hDictionary = writer.nextHandle();

    // HEADER SECTION
    writer.section("HEADER", () => {
        writer.write(9, "$ACADVER");
        writer.write(1, "AC1015"); // AutoCAD 2000
        writer.write(9, "$ACADMAINTVER");
        writer.write(70, 25);
        writer.write(9, "$HANDSEED");
        writer.write(5, "FFFF");
        writer.write(9, "$INSBASE");
        writer.write(10, 0); writer.write(20, 0); writer.write(30, 0);
        writer.write(9, "$EXTMIN");
        writer.write(10, -1000); writer.write(20, -1000); writer.write(30, 0);
        writer.write(9, "$EXTMAX");
        writer.write(10, 1000); writer.write(20, 1000); writer.write(30, 0);
        writer.write(9, "$INSUNITS");
        writer.write(70, settings?.units === 'metric' ? 4 : 1); // 4=mm, 1=inches
        
        // Linear Units Format & Precision
        const lUnitsMap: Record<string, number> = { 'scientific': 1, 'decimal': 2, 'engineering': 3, 'architectural': 4, 'fractional': 5 };
        writer.write(9, "$LUNITS");
        writer.write(70, lUnitsMap[settings?.linearFormat || 'decimal'] || 2);
        writer.write(9, "$LUPREC");
        writer.write(70, settings?.precision ? (settings.precision.split('.')[1]?.length || 0) : 4);

        // Angular Units Format & Precision
        const aUnitsMap: Record<string, number> = { 'decimalDegrees': 0, 'degMinSec': 1, 'grads': 2, 'radians': 3, 'surveyors': 4 };
        writer.write(9, "$AUNITS");
        writer.write(70, aUnitsMap[settings?.angularFormat || 'decimalDegrees'] || 0);
        writer.write(9, "$AUPREC");
        writer.write(70, parseInt(settings?.anglePrecision || '0'));

        writer.write(9, "$MEASUREMENT");
        writer.write(70, settings?.units === 'metric' ? 1 : 0); // 1=metric, 0=imperial
        writer.write(9, "$LTSCALE");
        writer.write(40, 1.0);
        writer.write(9, "$CELWEIGHT");
        writer.write(370, 25); // 0.25mm default
    });

    // CLASSES SECTION
    writer.section("CLASSES", () => {
        // Some CAD software expects basic classes even if empty
    });

    // TABLES SECTION
    writer.section("TABLES", () => {
        // VPORT
        writer.table("VPORT", writer.nextHandle(), 1, () => {
            writer.write(0, "VPORT");
            writer.write(5, writer.nextHandle());
            writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbViewportTableRecord");
            writer.write(2, "*ACTIVE");
            writer.write(70, 0);
            writer.write(10, 0.0); writer.write(20, 0.0);
            writer.write(11, 1.0); writer.write(21, 1.0);
            writer.write(12, 0.0); writer.write(22, 0.0);
            writer.write(13, 0.0); writer.write(23, 0.0);
            writer.write(14, 10.0); writer.write(24, 10.0);
            writer.write(15, 10.0); writer.write(25, 10.0);
            writer.write(16, 0.0); writer.write(26, 0.0); writer.write(36, 1.0);
            writer.write(17, 0.0); writer.write(27, 0.0); writer.write(37, 0.0);
            writer.write(40, 1.0); writer.write(41, 1.0); writer.write(42, 50.0);
            writer.write(43, 0.0); writer.write(44, 0.0);
            writer.write(50, 0.0); writer.write(51, 0.0);
            writer.write(71, 0); writer.write(72, 100); writer.write(73, 1);
            writer.write(74, 3); writer.write(75, 1); writer.write(76, 1);
            writer.write(77, 0); writer.write(78, 0); writer.write(281, 0);
            writer.write(65, 1);
        });

        // LTYPE
        const ltypes = [
            { name: "CONTINUOUS", desc: "Solid line", pattern: [] },
            { name: "DASHED", desc: "Dashed line", pattern: [12.7, -6.35] }
        ];
        writer.table("LTYPE", hLType, ltypes.length, () => {
            ltypes.forEach(lt => {
                writer.write(0, "LTYPE");
                writer.write(5, writer.nextHandle());
                writer.write(330, hLType);
                writer.write(100, "AcDbSymbolTableRecord");
                writer.write(100, "AcDbLinetypeTableRecord");
                writer.write(2, lt.name);
                writer.write(70, 0);
                writer.write(3, lt.desc);
                writer.write(72, 65);
                writer.write(73, lt.pattern.length);
                writer.write(40, lt.pattern.reduce((a, b) => a + Math.abs(b), 0));
                lt.pattern.forEach(p => writer.write(49, p));
            });
        });

        // LAYER
        const layerList = Object.values(layers);
        writer.table("LAYER", hLayer, layerList.length, () => {
            layerList.forEach(l => {
                writer.write(0, "LAYER");
                writer.write(5, writer.nextHandle());
                writer.write(330, hLayer);
                writer.write(100, "AcDbSymbolTableRecord");
                writer.write(100, "AcDbLayerTableRecord");
                writer.write(2, (l.name || "0").toString().toUpperCase());
                writer.write(70, 0);
                writer.write(62, hexToACI(l.color));
                writer.write(6, (l.lineType || "CONTINUOUS").toUpperCase());
                writer.write(370, mmToDXFLineWeight(l.thickness || 0.25));
            });
        });

        // STYLE
        writer.table("STYLE", hStyle, 1, () => {
            writer.write(0, "STYLE"); writer.write(5, writer.nextHandle());
            writer.write(330, hStyle);
            writer.write(100, "AcDbSymbolTableRecord"); writer.write(100, "AcDbTextStyleTableRecord");
            writer.write(2, "STANDARD"); writer.write(70, 0); writer.write(40, 0.0);
            writer.write(41, 1.0); writer.write(50, 0.0); writer.write(71, 0);
            writer.write(42, 2.5); writer.write(3, "txt"); writer.write(4, "");
        });

        // Other basic tables
        writer.table("VIEW", hView, 0, () => {});
        writer.table("UCS", hUCS, 0, () => {});
        writer.table("APPID", hAppId, 1, () => {
            writer.write(0, "APPID"); writer.write(5, writer.nextHandle());
            writer.write(330, hAppId); writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbRegAppTableRecord"); writer.write(2, "ACAD");
            writer.write(70, 0);
        });
        writer.table("DIMSTYLE", hDimStyle, 1, () => {
            writer.write(0, "DIMSTYLE"); writer.write(5, writer.nextHandle());
            writer.write(330, hDimStyle); writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbDimStyleTableRecord"); writer.write(2, "STANDARD");
            writer.write(70, 0); writer.write(41, 2.5); writer.write(42, 0.625);
            writer.write(43, 3.75); writer.write(44, 1.25); writer.write(73, 0);
            writer.write(74, 0); writer.write(140, 2.5); writer.write(147, 0.625);
            writer.write(172, 1);
        });

        // BLOCK_RECORD
        const blockNames = blocks ? Object.keys(blocks) : [];
        const blockRecordHandles: Record<string, string> = {};
        
        writer.table("BLOCK_RECORD", hBlockRecord, 2 + blockNames.length, () => {
            ["*MODEL_SPACE", "*PAPER_SPACE", ...blockNames].forEach(name => {
                const h = writer.nextHandle();
                blockRecordHandles[name] = h;
                writer.write(0, "BLOCK_RECORD");
                writer.write(5, h);
                writer.write(330, hBlockRecord);
                writer.write(100, "AcDbSymbolTableRecord");
                writer.write(100, "AcDbBlockTableRecord");
                writer.write(2, name);
            });
        });
        (writer as any)._blockRecordHandlesMap = blockRecordHandles;
    });

    // BLOCKS SECTION
    writer.section("BLOCKS", () => {
        const hMap = (writer as any)._blockRecordHandlesMap || {};
        
        // Model and Paper space
        ["*MODEL_SPACE", "*PAPER_SPACE"].forEach(name => {
            const hBegin = writer.nextHandle();
            writer.write(0, "BLOCK"); writer.write(5, hBegin);
            writer.write(330, hMap[name]);
            writer.write(100, "AcDbEntity"); writer.write(8, "0");
            writer.write(100, "AcDbBlockBegin"); writer.write(2, name);
            writer.write(70, 0); writer.write(10, 0.0); writer.write(20, 0.0); writer.write(30, 0.0);
            writer.write(3, name); writer.write(1, "");
            writer.write(0, "ENDBLK"); writer.write(5, writer.nextHandle());
            writer.write(330, hMap[name]);
            writer.write(100, "AcDbEntity"); writer.write(8, "0");
            writer.write(100, "AcDbBlockEnd");
        });

        // Custom blocks
        if (blocks) {
            Object.values(blocks).forEach(b => {
                const hBegin = writer.nextHandle();
                writer.write(0, "BLOCK"); writer.write(5, hBegin);
                writer.write(330, hMap[b.name]);
                writer.write(100, "AcDbEntity"); writer.write(8, "0");
                writer.write(100, "AcDbBlockBegin"); 
                writer.write(2, b.name);
                writer.write(70, 0); 
                writer.write(10, b.basePoint?.x || 0); 
                writer.write(20, b.basePoint?.y || 0); 
                writer.write(30, 0.0);
                writer.write(3, b.name); writer.write(1, "");

                // Block Entities (simplified, skipping nested blocks for now to avoid complexity)
                // In a full implementation, we'd recursively write entities here.
                
                writer.write(0, "ENDBLK"); writer.write(5, writer.nextHandle());
                writer.write(330, hMap[b.name]);
                writer.write(100, "AcDbEntity"); writer.write(8, "0");
                writer.write(100, "AcDbBlockEnd");
            });
        }
    });

    // ENTITIES SECTION
    writer.section("ENTITIES", () => {
        const hMap = (writer as any)._blockRecordHandlesMap || {};
        shapes.forEach(s => {
            const layer = (s.layer || "0").toString().toUpperCase();
            const color = hexToACI(s.color);
            const weight = mmToDXFLineWeight(s.thickness);
            
            const writeCommon = (type: string, subclass: string) => {
                writer.write(0, type);
                writer.write(5, writer.nextHandle());
                writer.write(330, hMap["*MODEL_SPACE"] || "0");
                writer.write(100, "AcDbEntity");
                writer.write(8, layer);
                writer.write(62, color);
                writer.write(370, weight);
                writer.write(100, subclass);
            };

            switch (s.type) {
                case 'line': {
                    const l = s as LineShape;
                    writeCommon("LINE", "AcDbLine");
                    writer.write(10, l.x1); writer.write(20, l.y1); writer.write(30, 0.0);
                    writer.write(11, l.x2); writer.write(21, l.y2); writer.write(31, 0.0);
                    break;
                }
                case 'circle': {
                    const c = s as CircleShape;
                    writeCommon("CIRCLE", "AcDbCircle");
                    writer.write(10, c.x); writer.write(20, c.y); writer.write(30, 0.0);
                    writer.write(40, c.radius);
                    break;
                }
                case 'pline': {
                    const p = s as PolyShape;
                    writeCommon("LWPOLYLINE", "AcDbPolyline");
                    writer.write(90, p.points.length);
                    writer.write(70, p.closed ? 1 : 0);
                    p.points.forEach(pt => {
                        writer.write(10, pt.x);
                        writer.write(20, pt.y);
                    });
                    break;
                }
                case 'text': {
                    const t = s as TextShape;
                    writeCommon("TEXT", "AcDbText");
                    writer.write(10, t.x); writer.write(20, t.y); writer.write(30, 0.0);
                    writer.write(40, t.size);
                    writer.write(1, t.content);
                    writer.write(50, (t.rotation || 0) * 180 / Math.PI);
                    if (t.justification === 'center') {
                        writer.write(72, 1);
                        writer.write(11, t.x); writer.write(21, t.y); writer.write(31, 0);
                    } else if (t.justification === 'right') {
                        writer.write(72, 2);
                        writer.write(11, t.x); writer.write(21, t.y); writer.write(31, 0);
                    }
                    break;
                }
                case 'mtext': {
                    const t = s as MTextShape;
                    writeCommon("MTEXT", "AcDbMText");
                    writer.write(10, t.x); writer.write(20, t.y); writer.write(30, 0.0);
                    writer.write(40, t.size);
                    writer.write(41, t.width || 0);
                    writer.write(1, t.content);
                    writer.write(50, (t.rotation || 0) * 180 / Math.PI);
                    break;
                }
                case 'block': {
                    const i = s as any;
                    writeCommon("INSERT", "AcDbBlockReference");
                    writer.write(2, i.blockId);
                    writer.write(10, i.x); writer.write(20, i.y); writer.write(30, 0.0);
                    writer.write(41, i.scaleX || 1.0);
                    writer.write(42, i.scaleY || 1.0);
                    writer.write(43, i.scaleZ || 1.0);
                    writer.write(50, (i.rotation || 0) * 180 / Math.PI);
                    break;
                }
            }
        });
    });

    return writer.getOutput();
    } catch (error) {
        return "0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n";
    }
};

const cleanMText = (text: string): string => {
    if (!text) return "";
    // Remove common MTEXT formatting codes: \P (newline), \S (stack), \L (underline start), \l (underline end), etc.
    // Also {\fArial|b0|i0|c0|p34;Text} style markings
    return text
        .replace(/\\P/g, "\n")
        .replace(/\\L/g, "")
        .replace(/\\l/g, "")
        .replace(/\{[^;]*;/g, "")
        .replace(/\}/g, "")
        .replace(/\\S[^;]*;/g, "")
        .replace(/\\f[^;]*;/g, "")
        .replace(/\\A[^;]*;/g, "")
        .replace(/\\H[^;]*;/g, "")
        .replace(/\\C[^;]*;/g, "")
        .replace(/\\W[^;]*;/g, "")
        .replace(/\\T[^;]*;/g, "")
        .replace(/\\Q[^;]*;/g, "")
        .replace(/\\/g, ""); // Final slash removal if any left
};

const parseLayers = (dxf: any, lineTypes: Record<string, LineTypeDefinition>): Record<string, LayerConfig> => {
    const layers: Record<string, LayerConfig> = {};
    
    // Ensure default layers exist
    layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
    layers['defpoints'] = { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' };

    if (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) {
        Object.values(dxf.tables.layer.layers).forEach((l: any) => {
            const layerName = l.name || '0';
            const ltName = (l.lineTypeName || 'continuous').toLowerCase();
            layers[layerName] = {
                id: layerName,
                name: layerName,
                visible: l.color !== undefined ? l.color >= 0 : true,
                locked: !!l.locked,
                frozen: !!l.frozen,
                color: aciToHex(l.color !== undefined ? Math.abs(l.color) : 7) || '#FFFFFF',
                thickness: l.lineWeight && l.lineWeight > 0 ? l.lineWeight / 100 : 0.25,
                lineType: ltName as any
            };
        });
    }
    return layers;
};

const parseLineTypes = (dxf: any): Record<string, LineTypeDefinition> => {
    const lineTypes: Record<string, LineTypeDefinition> = {
        'continuous': { name: 'continuous', description: 'Solid line', pattern: [] }
    };

    if (dxf.tables && dxf.tables.ltype && dxf.tables.ltype.lineTypes) {
        Object.values(dxf.tables.ltype.lineTypes).forEach((lt: any) => {
            const name = (lt.name || '').toLowerCase();
            if (!name) return;

            const pattern: number[] = [];
            if (lt.pattern && Array.isArray(lt.pattern)) {
                // AutoCAD pattern: positive is dash, negative is gap, zero is dot
                // We'll normalize this for ctx.setLineDash (which expects positive numbers for dash AND gap)
                lt.pattern.forEach((p: number) => {
                    pattern.push(Math.abs(p));
                });
            }

            lineTypes[name] = {
                name: name,
                description: lt.description || '',
                pattern: pattern
            };
        });
    }
    return lineTypes;
};

export const dxfToProject = (dxfString: string, defaultSettings: AppSettings): VoxProject => {
    const entities: Shape[] = [];
    const blocks: Record<string, BlockDefinition> = {};
    const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
    let lineTypes: Record<string, LineTypeDefinition> = {
        'continuous': { name: 'continuous', description: 'Solid line', pattern: [] }
    };
    let layers: Record<string, LayerConfig> = { 
        '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
        'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
    };
    
    try {
        if (!dxfString) throw new Error("Empty DXF string");
        
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfString);
        
        if (!dxf) throw new Error("Could not parse DXF");

        lineTypes = parseLineTypes(dxf);
        layers = parseLayers(dxf, lineTypes);

        const convertEntity = (entity: any): Shape | null => {
            const id = generateId();
            const layer = entity.layer || '0';
            const color = aciToHex(entity.color);
            const thickness = entity.lineWeight && entity.lineWeight > 0 ? entity.lineWeight / 100 : undefined;
            const lineType = (entity.lineTypeName || 'byLayer').toLowerCase();

            switch (entity.type) {
                case 'LINE':
                    return { id, layer, color, thickness, lineType, type: 'line', x1: entity.vertices[0].x, y1: entity.vertices[0].y, x2: entity.vertices[1].x, y2: entity.vertices[1].y } as any;
                case 'CIRCLE':
                    return { id, layer, color, thickness, lineType, type: 'circle', x: entity.center.x, y: entity.center.y, radius: entity.radius } as any;
                case 'ARC':
                    return { id, layer, color, thickness, lineType, type: 'arc', x: entity.center.x, y: entity.center.y, radius: entity.radius, startAngle: entity.startAngle, endAngle: entity.endAngle, counterClockwise: false } as any;
                case 'LWPOLYLINE':
                case 'POLYLINE':
                    if (entity.vertices && entity.vertices.length > 1) {
                        return { id, layer, color, thickness, lineType, type: 'pline', points: entity.vertices.map((v: any) => ({ x: v.x, y: v.y })), closed: entity.shape || entity.closed } as any;
                    }
                    break;
                case 'TEXT':
                    return { 
                        id, layer, color, thickness, lineType, type: 'text', 
                        x: entity.position?.x || 0, 
                        y: entity.position?.y || 0, 
                        size: entity.textHeight || 2.5, 
                        content: entity.text || '', 
                        rotation: (entity.rotation || 0) * Math.PI / 180,
                        justification: entity.halign === 1 ? 'center' : entity.halign === 2 ? 'right' : 'left'
                    } as any;
                case 'MTEXT':
                    return { 
                        id, layer, color, thickness, lineType, type: 'mtext', 
                        x: entity.position?.x || 0, 
                        y: entity.position?.y || 0, 
                        width: entity.width || 0,
                        size: entity.textHeight || 2.5, 
                        content: cleanMText(entity.text || ''), 
                        rotation: (entity.rotation || 0) * Math.PI / 180 
                    } as any;
                case 'ELLIPSE':
                    const rx = Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2);
                    return { id, layer, color, thickness, lineType, type: 'ellipse', x: entity.center.x, y: entity.center.y, rx, ry: rx * entity.axisRatio, rotation: Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x) } as any;
                case 'POINT':
                    return { id, layer, color, thickness, lineType, type: 'point', x: entity.position.x, y: entity.position.y, size: 5 } as any;
                case 'INSERT':
                    return { id, layer, color, thickness, lineType, type: 'block', x: entity.position.x, y: entity.position.y, blockId: entity.name, scaleX: entity.xScale || 1, scaleY: entity.yScale || 1, rotation: (entity.rotation || 0) * Math.PI / 180 } as any;
                case 'SPLINE':
                    if (entity.controlPoints && entity.controlPoints.length > 1) {
                        return { id, layer, color, thickness, lineType, type: 'pline', points: entity.controlPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: entity.closed } as any;
                    }
                    break;
                case 'DIMENSION':
                    return { 
                        id, layer, color, thickness, lineType, type: 'dimension', 
                        dimType: 'aligned', 
                        x1: entity.definitionPoint.x, y1: entity.definitionPoint.y,
                        x2: entity.definitionPoint2?.x || entity.definitionPoint.x, 
                        y2: entity.definitionPoint2?.y || entity.definitionPoint.y,
                        dimX: entity.textMidPoint?.x || entity.definitionPoint.x,
                        dimY: entity.textMidPoint?.y || entity.definitionPoint.y,
                        text: entity.text || ''
                    } as any;
                case 'LEADER':
                    if (entity.vertices && entity.vertices.length > 1) {
                        return { id, layer, color, thickness, lineType, type: 'leader', x1: entity.vertices[0].x, y1: entity.vertices[0].y, x2: entity.vertices[1].x, y2: entity.vertices[1].y, text: '', size: 2.5 } as any;
                    }
                    break;
                case 'HATCH':
                    if (entity.boundaryPaths && entity.boundaryPaths.length > 0) {
                        const pts: Point[] = [];
                        entity.boundaryPaths.forEach((path: any) => {
                            if (path.edges) {
                                path.edges.forEach((e: any) => {
                                    if (e.startPoint) pts.push({ x: e.startPoint.x, y: e.startPoint.y });
                                    if (e.endPoint) pts.push({ x: e.endPoint.x, y: e.endPoint.y });
                                });
                            } else if (path.vertices) {
                                path.vertices.forEach((v: any) => pts.push({ x: v.x, y: v.y }));
                            }
                        });
                        
                        if (pts.length > 2) {
                            return { 
                                id, layer, color, thickness, lineType, type: 'hatch', 
                                pattern: (entity.patternName || 'ansi31').toLowerCase(), 
                                points: pts, 
                                scale: entity.patternScale || 1, 
                                rotation: (entity.patternAngle || 0) * Math.PI / 180 
                            } as any;
                        }
                    }
                    break;
            }
            return null;
        };

        if (dxf.blocks) {
            Object.keys(dxf.blocks).forEach(name => {
                const b = dxf.blocks[name];
                const blockShapes: Shape[] = [];
                if (b.entities) {
                    b.entities.forEach((ent: any) => {
                        const s = convertEntity(ent);
                        if (s) blockShapes.push(s);
                    });
                }
                const basePoint = b.position ? { x: b.position.x, y: b.position.y } : { x: 0, y: 0 };
                blocks[name] = { id: name, name: name, basePoint, shapes: blockShapes };
            });
        }

        if (dxf.entities) {
            dxf.entities.forEach((entity: any) => {
                stats.total++;
                stats.counts[entity.type] = (stats.counts[entity.type] || 0) + 1;
                const s = convertEntity(entity);
                if (s) entities.push(s);
                else stats.unsupported++;
            });
        }
    } catch (error) {
        console.error("DXF Parsing error:", error);
    }
    
    return {
        version: "2.0",
        meta: {
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            ...defaultSettings.metadata
        },
        settings: defaultSettings,
        layers,
        blocks,
        entities,
        lineTypes,
        textStyles: {},
        layouts: {},
        bounds: getAllShapesBounds(entities, blocks),
        stats
    };
};
