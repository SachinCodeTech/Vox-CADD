
import DxfParser from 'dxf-parser';
import { Shape, LineShape, CircleShape, RectShape, PolyShape, ArcShape, TextShape, DoubleLineShape, EllipseShape, PointShape, DimensionShape, InfiniteLineShape, Point, LayerConfig, MTextShape, AppSettings } from '../types';
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
            // Ensure numbers have a decimal point if they are coordinates, scales, or angles
            // Group codes for doubles in DXF are typically 10-59, 140-147, 210-239, etc.
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
        if (this.output.length === 0) {
            console.warn("DXFWriter: Output body is empty. This might indicate no entities or failure.");
        }
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
        // For R15, we can leave it empty but structured
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
            writer.write(40, 1.0);
            writer.write(41, 1.0);
            writer.write(42, 50.0);
            writer.write(43, 0.0);
            writer.write(44, 0.0);
            writer.write(50, 0.0);
            writer.write(51, 0.0);
            writer.write(71, 0);
            writer.write(72, 100);
            writer.write(73, 1);
            writer.write(74, 3);
            writer.write(75, 1);
            writer.write(76, 1);
            writer.write(77, 0);
            writer.write(78, 0);
            writer.write(281, 0);
            writer.write(65, 1);
        });

        // LTYPE
        const ltypes = [
            { name: "CONTINUOUS", desc: "Solid line", pattern: [] },
            { name: "DASHED", desc: "Dashed line", pattern: [12.7, -6.35] },
            { name: "DOTTED", desc: "Dotted line", pattern: [0, -6.35] },
            { name: "CENTER", desc: "Center line", pattern: [31.75, -6.35, 6.35, -6.35] }
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
            writer.write(0, "STYLE");
            writer.write(5, writer.nextHandle());
            writer.write(330, hStyle);
            writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbTextStyleTableRecord");
            writer.write(2, "STANDARD");
            writer.write(70, 0);
            writer.write(40, 0.0);
            writer.write(41, 1.0);
            writer.write(50, 0.0);
            writer.write(71, 0);
            writer.write(42, 2.5);
            writer.write(3, "txt");
            writer.write(4, "");
        });

        // VIEW
        writer.table("VIEW", hView, 0, () => {});

        // UCS
        writer.table("UCS", hUCS, 0, () => {});

        // APPID
        writer.table("APPID", hAppId, 1, () => {
            writer.write(0, "APPID");
            writer.write(5, writer.nextHandle());
            writer.write(330, hAppId);
            writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbRegAppTableRecord");
            writer.write(2, "ACAD");
            writer.write(70, 0);
        });

        // DIMSTYLE
        writer.table("DIMSTYLE", hDimStyle, 1, () => {
            writer.write(0, "DIMSTYLE");
            writer.write(5, writer.nextHandle());
            writer.write(330, hDimStyle);
            writer.write(100, "AcDbSymbolTableRecord");
            writer.write(100, "AcDbDimStyleTableRecord");
            writer.write(2, "STANDARD");
            writer.write(70, 0);
            writer.write(41, 2.5);
            writer.write(42, 0.625);
            writer.write(43, 3.75);
            writer.write(44, 1.25);
            writer.write(73, 0);
            writer.write(74, 0);
            writer.write(140, 2.5);
            writer.write(147, 0.625);
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

        // Save handles for BLOCKS section
        (writer as any)._blockRecordHandles = blockRecordHandles;
    });

    // BLOCKS SECTION
    writer.section("BLOCKS", () => {
        const blockRecordHandles = (writer as any)._blockRecordHandles || [];
        ["*MODEL_SPACE", "*PAPER_SPACE"].forEach((name, i) => {
            const hBegin = writer.nextHandle();
            writer.write(0, "BLOCK");
            writer.write(5, hBegin);
            writer.write(330, blockRecordHandles[i]);
            writer.write(100, "AcDbEntity");
            writer.write(8, "0");
            writer.write(100, "AcDbBlockBegin");
            writer.write(2, name);
            writer.write(70, 0);
            writer.write(10, 0.0); writer.write(20, 0.0); writer.write(30, 0.0);
            writer.write(3, name);
            writer.write(1, "");
            
            writer.write(0, "ENDBLK");
            writer.write(5, writer.nextHandle());
            writer.write(330, blockRecordHandles[i]);
            writer.write(100, "AcDbEntity");
            writer.write(8, "0");
            writer.write(100, "AcDbBlockEnd");
        });
    });

    // ENTITIES SECTION
    writer.section("ENTITIES", () => {
        shapes.forEach(s => {
            try {
                const layer = (s.layer || "0").toString().toUpperCase();
                const color = hexToACI(s.color);
                const ltype = (s.lineType || "CONTINUOUS").toString().toUpperCase();
                const weight = mmToDXFLineWeight(s.thickness);

                const writeCommon = (entityType: string, subclass?: string) => {
                    writer.write(0, entityType);
                    writer.write(5, writer.nextHandle());
                    writer.write(330, (writer as any)._blockRecordHandles?.[0] || "0"); // Point to Model_Space
                    writer.write(100, "AcDbEntity");
                    writer.write(8, layer);
                    writer.write(62, color);
                    writer.write(6, ltype);
                    writer.write(370, weight);
                    if (subclass) writer.write(100, subclass);
                };

                switch(s.type) {
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
                        if (c.filled) {
                            // Add a solid hatch for filled circles
                            writeCommon("HATCH", "AcDbHatch");
                            writer.write(10, 0.0); writer.write(20, 0.0); writer.write(30, 0.0);
                            writer.write(210, 0.0); writer.write(220, 0.0); writer.write(230, 1.0);
                            writer.write(2, "SOLID");
                            writer.write(70, 1); // Solid fill
                            writer.write(71, 0); // Associative
                            writer.write(91, 1); // Number of boundary loops
                            writer.write(92, 1); // Boundary loop type (External)
                            writer.write(93, 1); // Number of edges
                            writer.write(72, 2); // Edge type (Circle)
                            writer.write(10, c.x); writer.write(20, c.y); writer.write(40, c.radius);
                            writer.write(50, 0.0); writer.write(51, 360.0); writer.write(73, 1);
                            writer.write(75, 1); // Hatch style
                            writer.write(76, 1); // Hatch pattern type
                            writer.write(98, 0); // Seed points
                        }
                        break;
                    }
                    case 'arc': {
                        const a = s as ArcShape;
                        writeCommon("ARC", "AcDbCircle");
                        writer.write(10, a.x); writer.write(20, a.y); writer.write(30, 0.0);
                        writer.write(40, a.radius);
                        writer.write(100, "AcDbArc");
                        let start = a.startAngle * 180 / Math.PI;
                        let end = a.endAngle * 180 / Math.PI;
                        if (a.counterClockwise) [start, end] = [end, start];
                        writer.write(50, start);
                        writer.write(51, end);
                        break;
                    }
                    case 'ellipse': {
                        const e = s as EllipseShape;
                        writeCommon("ELLIPSE", "AcDbEllipse");
                        writer.write(10, e.x); writer.write(20, e.y); writer.write(30, 0.0);
                        const isMinorGreater = e.ry > e.rx;
                        const majorLen = isMinorGreater ? e.ry : e.rx;
                        const minorLen = isMinorGreater ? e.rx : e.ry;
                        let rot = e.rotation || 0;
                        if (isMinorGreater) rot += Math.PI / 2;
                        writer.write(11, majorLen * Math.cos(rot));
                        writer.write(21, majorLen * Math.sin(rot));
                        writer.write(31, 0.0);
                        writer.write(40, minorLen / majorLen);
                        writer.write(41, 0.0);
                        writer.write(42, 2 * Math.PI);
                        break;
                    }
                    case 'pline':
                    case 'polygon':
                    case 'rect': {
                        const p = s as PolyShape;
                        let pts: Point[] = [];
                        let closed = 0;
                        if (s.type === 'rect') {
                            const r = s as RectShape;
                            pts = [{x:r.x, y:r.y}, {x:r.x+r.width, y:r.y}, {x:r.x+r.width, y:r.y+r.height}, {x:r.x, y:r.y+r.height}];
                            closed = 1;
                        } else {
                            pts = p.points;
                            closed = p.closed || s.type === 'polygon' ? 1 : 0;
                        }
                        writeCommon("LWPOLYLINE", "AcDbPolyline");
                        writer.write(90, pts.length);
                        writer.write(70, closed);
                        pts.forEach(pt => {
                            writer.write(10, pt.x);
                            writer.write(20, pt.y);
                        });
                        if (s.filled) {
                            // Add a solid hatch for filled polylines
                            writeCommon("HATCH", "AcDbHatch");
                            writer.write(10, 0.0); writer.write(20, 0.0); writer.write(30, 0.0);
                            writer.write(210, 0.0); writer.write(220, 0.0); writer.write(230, 1.0);
                            writer.write(2, "SOLID");
                            writer.write(70, 1);
                            writer.write(71, 0);
                            writer.write(91, 1);
                            writer.write(92, 1);
                            writer.write(93, pts.length);
                            pts.forEach((pt, i) => {
                                const next = pts[(i + 1) % pts.length];
                                writer.write(72, 1); // Edge type (Line)
                                writer.write(10, pt.x); writer.write(20, pt.y);
                                writer.write(11, next.x); writer.write(21, next.y);
                            });
                            writer.write(75, 1);
                            writer.write(76, 1);
                            writer.write(98, 0);
                        }
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
                    case 'mtext': {
                        const t = s as MTextShape;
                        writeCommon("MTEXT", "AcDbMText");
                        writer.write(10, t.x); writer.write(20, t.y); writer.write(30, 0.0);
                        writer.write(40, t.size);
                        writer.write(41, t.width || 100.0);
                        writer.write(71, 1); // Top left
                        writer.write(1, t.content);
                        break;
                    }
                    case 'spline': {
                        const p = s as PolyShape;
                        writeCommon("SPLINE", "AcDbSpline");
                        writer.write(70, 8); // Planar
                        writer.write(71, 3); // Degree
                        writer.write(74, p.points.length); // Number of fit points
                        p.points.forEach(pt => {
                            writer.write(11, pt.x);
                            writer.write(21, pt.y);
                            writer.write(31, 0.0);
                        });
                        break;
                    }
                    case 'ray':
                    case 'xline': {
                        const l = s as InfiniteLineShape;
                        writeCommon(s.type.toUpperCase(), s.type === 'ray' ? "AcDbRay" : "AcDbXline");
                        writer.write(10, l.x1); writer.write(20, l.y1); writer.write(30, 0.0);
                        writer.write(11, l.x2 - l.x1); writer.write(21, l.y2 - l.y1); writer.write(31, 0.0);
                        break;
                    }
                    case 'point': {
                        const p = s as PointShape;
                        writeCommon("POINT", "AcDbPoint");
                        writer.write(10, p.x); writer.write(20, p.y); writer.write(30, 0.0);
                        break;
                    }
                    case 'dimension': {
                        const d = s as DimensionShape;
                        writeCommon("DIMENSION", "AcDbDimension");
                        writer.write(2, "*D" + writer.nextHandle()); // Block name placeholder
                        writer.write(10, d.dimX); writer.write(20, d.dimY); writer.write(30, 0.0);
                        writer.write(11, (d.x1 + d.x2)/2); writer.write(21, (d.y1 + d.y2)/2); writer.write(31, 0.0);
                        writer.write(70, 0); // Aligned
                        writer.write(1, d.text || "");
                        writer.write(100, "AcDbAlignedDimension");
                        writer.write(13, d.x1); writer.write(23, d.y1); writer.write(33, 0.0);
                        writer.write(14, d.x2); writer.write(24, d.y2); writer.write(34, 0.0);
                        break;
                    }
                    case 'dline': {
                        const l = s as DoubleLineShape;
                        const pts = l.points;
                        if (!pts || pts.length < 2) break;
                        
                        const half = l.thickness / 2;
                        let off1 = -half, off2 = half;
                        if (l.justification === 'top') { off1 = 0; off2 = l.thickness; }
                        else if (l.justification === 'bottom') { off1 = -l.thickness; off2 = 0; }

                        const getParallelPts = (offset: number) => {
                            const result: Point[] = [];
                            for(let i=0; i < pts.length; i++) {
                                const prev = pts[i-1], cur = pts[i], next = pts[i+1];
                                let nx = 0, ny = 0;
                                if (!prev && next) {
                                    const dx = next.x - cur.x, dy = next.y - cur.y, len = Math.hypot(dx, dy) || 1;
                                    nx = -dy/len; ny = dx/len;
                                    result.push({x: cur.x + nx*offset, y: cur.y + ny*offset});
                                } else if (!next && prev) {
                                    const dx = cur.x - prev.x, dy = cur.y - prev.y, len = Math.hypot(dx, dy) || 1;
                                    nx = -dy/len; ny = dx/len;
                                    result.push({x: cur.x + nx*offset, y: cur.y + ny*offset});
                                } else if (prev && next) {
                                    const d1x = cur.x - prev.x, d1y = cur.y - prev.y, l1 = Math.hypot(d1x, d1y) || 1;
                                    const d2x = next.x - cur.x, d2y = next.y - cur.y, l2 = Math.hypot(d2x, d2y) || 1;
                                    const n1x = -d1y/l1, n1y = d1x/l1;
                                    const n2x = -d2y/l2, n2y = d2x/l2;
                                    const mx = (n1x + n2x), my = (n1y + n2y), ml = Math.hypot(mx, my);
                                    const miterLen = offset / (ml === 0 ? 1 : ml) * 2;
                                    result.push({x: cur.x + mx/(ml || 1) * miterLen, y: cur.y + my/(ml || 1) * miterLen});
                                }
                            }
                            return result;
                        };

                        const line1 = getParallelPts(off1);
                        const line2 = getParallelPts(off2);

                        [line1, line2].forEach(linePts => {
                            writeCommon("LWPOLYLINE", "AcDbPolyline");
                            writer.write(90, linePts.length);
                            writer.write(70, 0);
                            linePts.forEach(pt => {
                                writer.write(10, pt.x);
                                writer.write(20, pt.y);
                            });
                        });
                        break;
                    }
                }
            } catch (e) {
                console.error("DXF Export: Shape error", s, e);
            }
        });
    });

    // OBJECTS SECTION
    writer.section("OBJECTS", () => {
        const hRootDict = hDictionary;
        writer.write(0, "DICTIONARY");
        writer.write(5, hRootDict);
        writer.write(100, "AcDbDictionary");
        writer.write(281, 1);
        
        const dicts = [
            { name: "ACAD_GROUP", class: "AcDbDictionary" },
            { name: "ACAD_MLINESTYLE", class: "AcDbDictionary" },
            { name: "ACAD_COLOR", class: "AcDbDictionary" },
            { name: "ACAD_PLOTSETTINGS", class: "AcDbDictionary" },
            { name: "ACAD_PLOTSTYLENAME", class: "AcDbDictionary" }
        ];

        dicts.forEach(d => {
            const h = writer.nextHandle();
            writer.write(3, d.name);
            writer.write(350, h);
        });

        // Write the dictionaries themselves
        // For now, just empty dictionaries to satisfy the handles
        // This is much more compliant than just one dictionary
    });

    return writer.getOutput();
    } catch (error) {
        console.error("Critical Failure in shapesToDXF:", error);
        // Fallback to a minimal but valid DXF header to prevent 0B files
        return "999\r\nVoxCADD-ERROR-FALLBACK\r\n0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n";
    }
};

export const dxfToShapes = (dxfString: string): { shapes: Shape[], stats: { total: number, unsupported: number, counts: Record<string, number> } } => {
    const shapes: Shape[] = [];
    const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
    if (!dxfString) return { shapes: [], stats };
    
    try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfString);
        
        if (!dxf || !dxf.entities) return { shapes: [], stats };

        dxf.entities.forEach((entity: any) => {
            const id = generateId();
            const layer = entity.layer || '0';
            const color = aciToHex(entity.color);
            const thickness = 1; // Default
            stats.total++;
            stats.counts[entity.type] = (stats.counts[entity.type] || 0) + 1;

            let supported = true;
            try {
                switch (entity.type) {
                    case 'LINE':
                        shapes.push({
                            id, layer, color, thickness, type: 'line',
                            x1: entity.vertices[0].x, y1: entity.vertices[0].y,
                            x2: entity.vertices[1].x, y2: entity.vertices[1].y
                        } as LineShape);
                        break;
                    case 'CIRCLE':
                        shapes.push({
                            id, layer, color, thickness, type: 'circle',
                            x: entity.center.x, y: entity.center.y,
                            radius: entity.radius
                        } as CircleShape);
                        break;
                    case 'ARC':
                        shapes.push({
                            id, layer, color, thickness, type: 'arc',
                            x: entity.center.x, y: entity.center.y,
                            radius: entity.radius,
                            startAngle: entity.startAngle, // dxf-parser converts to radians usually
                            endAngle: entity.endAngle,
                            counterClockwise: false
                        } as ArcShape);
                        break;
                    case 'LWPOLYLINE':
                    case 'POLYLINE':
                        if (entity.vertices && entity.vertices.length > 1) {
                            const points = entity.vertices.map((v: any) => ({ x: v.x, y: v.y }));
                            shapes.push({
                                id, layer, color, thickness, type: 'pline',
                                points,
                                closed: entity.shape || entity.closed
                            } as PolyShape);
                        }
                        break;
                    case 'TEXT':
                    case 'MTEXT':
                        shapes.push({
                            id, layer, color, thickness, type: 'text',
                            x: entity.columnCenter ? entity.columnCenter.x : (entity.position ? entity.position.x : 0),
                            y: entity.columnCenter ? entity.columnCenter.y : (entity.position ? entity.position.y : 0),
                            size: entity.textHeight || 12,
                            content: entity.text || 'Text',
                            rotation: (entity.rotation || 0) * Math.PI / 180
                        } as TextShape);
                        break;
                    case 'ELLIPSE':
                        const rx = Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2);
                        const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);
                        shapes.push({
                            id, layer, color, thickness, type: 'ellipse',
                            x: entity.center.x, y: entity.center.y,
                            rx,
                            ry: rx * entity.axisRatio,
                            rotation
                        } as EllipseShape);
                        break;
                    case 'POINT':
                        shapes.push({
                            id, layer, color, thickness, type: 'point',
                            x: entity.position.x, y: entity.position.y,
                            size: 5
                        } as PointShape);
                        break;
                    default:
                        supported = false;
                        break;
                }
            } catch (err) {
                console.warn("Entity parsing failed:", entity.type, err);
                supported = false;
            }
            if (!supported) stats.unsupported++;
        });
    } catch (error) {
        console.error("DXF Parsing error:", error);
    }
    
    return { shapes, stats };
};

