
import DxfParser from 'dxf-parser';
import { 
    Shape, LineShape, CircleShape, RectShape, PolyShape, ArcShape, TextShape, 
    DoubleLineShape, EllipseShape, PointShape, DimensionShape, InfiniteLineShape, 
    Point, LayerConfig, MTextShape, AppSettings, BlockDefinition 
} from '../types';
import { generateId } from './cadService';
import { aciToHex, hexToACI } from './colorUtils';

const mmToDXFLineWeight = (mm: number | undefined): number => {
    if (mm === undefined || isNaN(mm)) return 25;
    const weights = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
    const val = Math.round(mm * 100);
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

export const shapesToDXF = (shapes: Shape[], layerConfigs?: Record<string, LayerConfig>, settings?: AppSettings): string => {
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
        const blockRecordHandles: string[] = [];
        writer.table("BLOCK_RECORD", hBlockRecord, 2, () => {
            ["*MODEL_SPACE", "*PAPER_SPACE"].forEach(name => {
                const h = writer.nextHandle();
                blockRecordHandles.push(h);
                writer.write(0, "BLOCK_RECORD");
                writer.write(5, h);
                writer.write(330, hBlockRecord);
                writer.write(100, "AcDbSymbolTableRecord");
                writer.write(100, "AcDbBlockTableRecord");
                writer.write(2, name);
            });
        });
        (writer as any)._blockRecordHandles = blockRecordHandles;
    });

    // BLOCKS SECTION
    writer.section("BLOCKS", () => {
        const blockRecordHandles = (writer as any)._blockRecordHandles || [];
        ["*MODEL_SPACE", "*PAPER_SPACE"].forEach((name, i) => {
            const hBegin = writer.nextHandle();
            writer.write(0, "BLOCK"); writer.write(5, hBegin);
            writer.write(330, blockRecordHandles[i]);
            writer.write(100, "AcDbEntity"); writer.write(8, "0");
            writer.write(100, "AcDbBlockBegin"); writer.write(2, name);
            writer.write(70, 0); writer.write(10, 0.0); writer.write(20, 0.0); writer.write(30, 0.0);
            writer.write(3, name); writer.write(1, "");
            writer.write(0, "ENDBLK"); writer.write(5, writer.nextHandle());
            writer.write(330, blockRecordHandles[i]);
            writer.write(100, "AcDbEntity"); writer.write(8, "0");
            writer.write(100, "AcDbBlockEnd");
        });
    });

    // ENTITIES SECTION
    writer.section("ENTITIES", () => {
        shapes.forEach(s => {
            const layer = (s.layer || "0").toString().toUpperCase();
            const color = hexToACI(s.color);
            const weight = mmToDXFLineWeight(s.thickness);
            
            const writeCommon = (type: string, subclass: string) => {
                writer.write(0, type);
                writer.write(5, writer.nextHandle());
                writer.write(330, (writer as any)._blockRecordHandles?.[0] || "0");
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

export const dxfToShapes = (dxfString: string): { 
    shapes: Shape[], 
    blocks?: Record<string, BlockDefinition>,
    layers?: Record<string, LayerConfig>,
    stats: { total: number, unsupported: number, counts: Record<string, number> } 
} => {
    const shapes: Shape[] = [];
    const blocks: Record<string, BlockDefinition> = {};
    const layers: Record<string, LayerConfig> = {};
    const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
    if (!dxfString) return { shapes: [], stats };
    
    try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfString);
        
        if (!dxf) return { shapes: [], stats };

        if (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) {
            Object.values(dxf.tables.layer.layers).forEach((l: any) => {
                layers[l.name] = {
                    id: l.name,
                    name: l.name,
                    visible: true,
                    locked: !!(l.frozen || l.locked),
                    frozen: !!l.frozen,
                    color: aciToHex(l.color),
                    thickness: 0.25,
                    lineType: 'continuous'
                };
            });
        }

        const convertEntity = (entity: any): Shape | null => {
            const id = generateId();
            const layer = entity.layer || '0';
            const color = aciToHex(entity.color);
            const thickness = 1;

            switch (entity.type) {
                case 'LINE':
                    return { id, layer, color, thickness, type: 'line', x1: entity.vertices[0].x, y1: entity.vertices[0].y, x2: entity.vertices[1].x, y2: entity.vertices[1].y } as any;
                case 'CIRCLE':
                    return { id, layer, color, thickness, type: 'circle', x: entity.center.x, y: entity.center.y, radius: entity.radius } as any;
                case 'ARC':
                    return { id, layer, color, thickness, type: 'arc', x: entity.center.x, y: entity.center.y, radius: entity.radius, startAngle: entity.startAngle, endAngle: entity.endAngle, counterClockwise: false } as any;
                case 'LWPOLYLINE':
                case 'POLYLINE':
                    if (entity.vertices && entity.vertices.length > 1) {
                        return { id, layer, color, thickness, type: 'pline', points: entity.vertices.map((v: any) => ({ x: v.x, y: v.y })), closed: entity.shape || entity.closed } as any;
                    }
                    break;
                case 'TEXT':
                case 'MTEXT':
                    return { id, layer, color, thickness, type: 'text', x: entity.position?.x || 0, y: entity.position?.y || 0, size: entity.textHeight || 2.5, content: entity.text || '', rotation: (entity.rotation || 0) * Math.PI / 180 } as any;
                case 'ELLIPSE':
                    const rx = Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2);
                    return { id, layer, color, thickness, type: 'ellipse', x: entity.center.x, y: entity.center.y, rx, ry: rx * entity.axisRatio, rotation: Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x) } as any;
                case 'POINT':
                    return { id, layer, color, thickness, type: 'point', x: entity.position.x, y: entity.position.y, size: 5 } as any;
                case 'INSERT':
                    return { id, layer, color, thickness, type: 'block', x: entity.position.x, y: entity.position.y, blockId: entity.name, scaleX: entity.xScale || 1, scaleY: entity.yScale || 1, rotation: (entity.rotation || 0) * Math.PI / 180 } as any;
                case 'SPLINE':
                    if (entity.controlPoints && entity.controlPoints.length > 1) {
                        return { id, layer, color, thickness, type: 'pline', points: entity.controlPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: entity.closed } as any;
                    }
                    break;
                case 'DIMENSION':
                    return { 
                        id, layer, color, thickness, type: 'dimension', 
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
                        return { id, layer, color, thickness, type: 'leader', x1: entity.vertices[0].x, y1: entity.vertices[0].y, x2: entity.vertices[1].x, y2: entity.vertices[1].y, text: '', size: 2.5 } as any;
                    }
                    break;
                case 'HATCH':
                    if (entity.boundaryPaths && entity.boundaryPaths.length > 0) {
                        const path = entity.boundaryPaths[0];
                        if (path.edges && path.edges.length > 0) {
                            const pts: Point[] = [];
                            path.edges.forEach((e: any) => {
                                if (e.startPoint) pts.push({ x: e.startPoint.x, y: e.startPoint.y });
                                if (e.endPoint) pts.push({ x: e.endPoint.x, y: e.endPoint.y });
                            });
                            if (pts.length > 1) {
                                return { id, layer, color, thickness, type: 'hatch', pattern: 'ansi31', points: pts, scale: 1, rotation: 0 } as any;
                            }
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
                blocks[name] = { id: name, name: name, basePoint: { x: 0, y: 0 }, shapes: blockShapes };
            });
        }

        if (dxf.entities) {
            dxf.entities.forEach((entity: any) => {
                stats.total++;
                stats.counts[entity.type] = (stats.counts[entity.type] || 0) + 1;
                const s = convertEntity(entity);
                if (s) shapes.push(s);
                else stats.unsupported++;
            });
        }
    } catch (error) {
        console.error("DXF Parsing error:", error);
    }
    
    return { shapes, blocks, layers, stats };
};
