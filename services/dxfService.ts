
import DxfParser from 'dxf-parser';
import { 
    Shape, LineShape, CircleShape, RectShape, PolyShape, ArcShape, TextShape, 
    DoubleLineShape, EllipseShape, PointShape, DimensionShape, InfiniteLineShape, 
    Point, LayerConfig, MTextShape, AppSettings, BlockDefinition, VoxProject, LineTypeDefinition,
    DimensionStyle, LayoutDefinition, DimensionType
} from '../types';
import { generateId, getAllShapesBounds } from './cadService';
import { aciToHex, hexToACI, mapLineweight } from './colorUtils';

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

const writeEntity = (
    writer: DXFWriter, 
    s: Shape, 
    ownerHandle: string, 
    layerConfigs: Record<string, LayerConfig>, 
    settings: AppSettings
) => {
    const layer = (s.layer || "0").toString().toUpperCase();
    const color = hexToACI(s.color);
    const weight = mmToDXFLineWeight(s.thickness);
    
    const writeCommon = (type: string, subclass: string) => {
        writer.write(0, type);
        writer.write(5, writer.nextHandle());
        writer.write(330, ownerHandle);
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
        case 'arc': {
            const a = s as ArcShape;
            writeCommon("ARC", "AcDbCircle");
            writer.write(100, "AcDbArc");
            writer.write(10, a.x); writer.write(20, a.y); writer.write(30, 0.0);
            writer.write(40, a.radius);
            writer.write(50, (a.startAngle || 0) * 180 / Math.PI);
            writer.write(51, (a.endAngle || 0) * 180 / Math.PI);
            break;
        }
        case 'rect': {
            const r = s as RectShape;
            writeCommon("LWPOLYLINE", "AcDbPolyline");
            writer.write(90, 4);
            writer.write(70, 1);
            writer.write(10, r.x); writer.write(20, r.y);
            writer.write(10, r.x + r.width); writer.write(20, r.y);
            writer.write(10, r.x + r.width); writer.write(20, r.y + r.height);
            writer.write(10, r.x); writer.write(20, r.y + r.height);
            break;
        }
        case 'ellipse': {
            const e = s as EllipseShape;
            writeCommon("ELLIPSE", "AcDbEllipse");
            writer.write(10, e.x); writer.write(20, e.y); writer.write(30, 0.0);
            // Major axis vector
            const majorX = e.rx * Math.cos(e.rotation || 0);
            const majorY = e.rx * Math.sin(e.rotation || 0);
            writer.write(11, majorX); writer.write(21, majorY); writer.write(31, 0.0);
            writer.write(40, e.ry / e.rx);
            writer.write(41, 0.0); // Start parameter
            writer.write(42, 2 * Math.PI); // End parameter
            break;
        }
        case 'spline': {
            const sp = s as PolyShape;
            writeCommon("SPLINE", "AcDbSpline");
            writer.write(70, 8); // Planar + Closed if applicable
            writer.write(71, 3); // Degree 3 (Cubic)
            writer.write(72, 0); // Number of knots
            writer.write(73, sp.points.length); // Number of control points
            writer.write(74, 0); // Number of fit points
            sp.points.forEach(pt => {
                writer.write(10, pt.x);
                writer.write(20, pt.y);
                writer.write(30, 0.0);
            });
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
};

export const shapesToDXF = (
    shapes: Shape[], 
    layerConfigs: Record<string, LayerConfig> = {}, 
    settings: AppSettings = {} as any,
    blocks?: Record<string, BlockDefinition>
): string => {
    try {
        const writer = new DXFWriter();
        const baseLayers = { ...layerConfigs };
    if (!baseLayers['0']) {
        baseLayers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
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

                // Block Entities
                if (b.shapes && b.shapes.length > 0) {
                    // Temporarily redirect entities to this block's record handle
                    const originalGetModelSpaceHandle = (writer as any)._getModelSpaceHandle;
                    (writer as any)._getCurrentBlockHandle = () => hMap[b.name];
                    
                    b.shapes.forEach(bs => {
                        writeEntity(writer, bs, hMap[b.name], layerConfigs || {}, settings || {} as any);
                    });
                    
                    delete (writer as any)._getCurrentBlockHandle;
                }
                
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
            writeEntity(writer, s, hMap["*MODEL_SPACE"] || "0", layers, settings);
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
    layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FF0000', thickness: 0.25, lineType: 'continuous' };
    layers['defpoints'] = { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' };

    if (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) {
        const dLayers = Object.values(dxf.tables.layer.layers);
        const numLayers = dLayers.length;
        for (let i = 0; i < numLayers; i++) {
            const l: any = dLayers[i];
            let layerName = l.name || '0';
            
            // Normalize special AutoCAD layers
            const lowerLayerName = layerName.toLowerCase();
            if (lowerLayerName === 'defpoints') layerName = 'defpoints';
            if (layerName === '0' || lowerLayerName === '0') layerName = '0';

            const ltName = (l.lineTypeName || 'continuous').toLowerCase();
            const aci = l.color !== undefined ? l.color : 7;
            const flags = l.flags || 0;
            
            layers[layerName] = {
                id: layerName,
                name: layerName,
                visible: aci >= 0 && !(flags & 1),
                locked: !!(flags & 4),
                frozen: !!(flags & 1),
                plottable: layerName.toLowerCase() !== 'defpoints' && (l.isPlottable !== false),
                color: aciToHex(Math.abs(aci)) || '#FFFFFF',
                thickness: mapLineweight(l.lineWeight) || 0.25,
                lineType: ltName as any
            };
        }
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

const parseDimStyles = (dxf: any): Record<string, DimensionStyle> => {
    const styles: Record<string, DimensionStyle> = {
        'standard': { id: 'standard', name: 'Standard', arrowSize: 2.5, textSize: 2.5, textOffset: 0.625, extendLine: 1.25, offsetLine: 0.625, precision: 2 }
    };
    if (dxf.tables && dxf.tables.dimstyle && dxf.tables.dimstyle.styles) {
        Object.values(dxf.tables.dimstyle.styles).forEach((s: any) => {
            const name = (s.name || 'standard').toLowerCase();
            styles[name] = {
                id: name,
                name: s.name || 'Standard',
                arrowSize: s.dimasz || 2.5,
                textSize: s.dimtxt || 2.5,
                textOffset: s.dimgap || 0.625,
                extendLine: s.dimexe || 1.25,
                offsetLine: s.dimexo || 0.625,
                precision: s.dimdec || 2
            };
        });
    }
    return styles;
};

export const dxfToProject = async (dxfString: string, defaultSettings: AppSettings): Promise<VoxProject> => {
    const entities: Shape[] = [];
    const blocks: Record<string, BlockDefinition> = {};
    const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
    let lineTypes: Record<string, LineTypeDefinition> = {
        'continuous': { name: 'continuous', description: 'Solid line', pattern: [] }
    };
    let layers: Record<string, LayerConfig> = { 
        '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FF0000', thickness: 0.25, lineType: 'continuous' },
        'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
    };
    let dimStyles: Record<string, DimensionStyle> = {};
    let layouts: Record<string, LayoutDefinition> = {};
    
    try {
        if (!dxfString) throw new Error("Empty DXF string");
        
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfString);
        
        if (!dxf) throw new Error("Could not parse DXF");

        lineTypes = parseLineTypes(dxf);
        layers = parseLayers(dxf, lineTypes);
        dimStyles = parseDimStyles(dxf);
        const paperEntities: Shape[] = [];

        const convertEntity = (entity: any, offset: { x: number, y: number } = { x: 0, y: 0 }): Shape | null => {
            if (!entity) return null;
            
            // Handle layer as string or object
            let layer = '0';
            if (typeof entity.layer === 'string') layer = entity.layer;
            else if (entity.layer && typeof entity.layer.name === 'string') layer = entity.layer.name;
            else if (typeof entity.layerName === 'string') layer = entity.layerName;
            
            // Normalize special AutoCAD layers
            const lowerLayer = layer.toLowerCase();
            if (lowerLayer === 'defpoints') layer = 'defpoints';
            if (layer === '0' || lowerLayer === '0') layer = '0';
            
            const aci = entity.color !== undefined ? entity.color : 256; // 256 = Bylayer
            const color = aciToHex(aci);
            const thickness = mapLineweight(entity.lineWeight);
            const lineType = (entity.lineTypeName || 'bylayer').toLowerCase();
            const isPaper = !!entity.inPaperSpace;

            const isValid = (val: any) => typeof val === 'number' && isFinite(val) && Math.abs(val) < 1e12;
            
            const type = (entity.type || '').toLowerCase();
            const nextId = () => `dxf-${type}-${generateId()}`;

            // Ensure layer metadata exists for this layer name
            if (!layers[layer]) {
                layers[layer] = { id: layer, name: layer, visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
            }

            switch (entity.type) {
                case 'LINE':
                    const v1 = (entity.vertices && entity.vertices[0]) || entity.start || { x: 0, y: 0 };
                    const v2 = (entity.vertices && entity.vertices[1]) || entity.end || { x: 0, y: 0 };
                    if (isValid(v1.x) && isValid(v1.y) && isValid(v2.x) && isValid(v2.y)) {
                        // Filter radiating ghost lines to origin
                        const is1_0 = Math.abs(v1.x) < 1e-6 && Math.abs(v1.y) < 1e-6;
                        const is2_0 = Math.abs(v2.x) < 1e-6 && Math.abs(v2.y) < 1e-6;
                        const d = Math.sqrt((v1.x - v2.x)**2 + (v1.y - v2.y)**2);
                        if ((is1_0 || is2_0) && d > 1e5 && !(is1_0 && is2_0)) return null;

                        return { id: nextId(), layer, color, thickness, lineType, type: 'line', x1: v1.x - offset.x, y1: v1.y - offset.y, x2: v2.x - offset.x, y2: v2.y - offset.y } as any;
                    }
                    break;
                case 'CIRCLE':
                    if (entity.center && isValid(entity.center.x) && isValid(entity.center.y)) {
                        return { id: nextId(), layer, color, thickness, lineType, type: 'circle', x: entity.center.x - offset.x, y: entity.center.y - offset.y, radius: entity.radius || 0 } as any;
                    }
                    break;
                case 'ARC':
                    if (entity.center && isValid(entity.center.x) && isValid(entity.center.y)) {
                        return { id: nextId(), layer, color, thickness, lineType, type: 'arc', x: entity.center.x - offset.x, y: entity.center.y - offset.y, radius: entity.radius || 0, startAngle: entity.startAngle || 0, endAngle: entity.endAngle || 0, counterClockwise: false } as any;
                    }
                    break;
                case 'LWPOLYLINE':
                case 'POLYLINE':
                    let vts = (entity.vertices || entity.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                    
                    if (vts.length > 2) {
                        const hasManyNonZero = vts.filter((v: any) => Math.abs(v.x) > 1e-6 || Math.abs(v.y) > 1e-6).length > vts.length / 2;
                        if (hasManyNonZero) {
                            vts = vts.filter((v: any) => Math.abs(v.x) > 1e-6 || Math.abs(v.y) > 1e-6);
                        }
                    }

                    if (vts.length > 1) {
                        return { 
                            id: nextId(), layer, color, thickness, lineType, type: 'pline', 
                            points: vts.map((v: any) => ({ x: v.x - offset.x, y: v.y - offset.y, bulge: v.bulge || 0 })), 
                            closed: !!(entity.shape || entity.closed || (entity.flags & 1))
                        } as any;
                    }
                    break;
                case 'TEXT':
                    const tPos = entity.position || entity.insertionPoint || { x: 0, y: 0 };
                    if (isValid(tPos.x) && isValid(tPos.y)) {
                        const rawText = entity.text || '';
                        let fontFamily = 'standard';
                        const fMatch = rawText.match(/\\f([^;|]+)[;|]/);
                        if (fMatch) fontFamily = fMatch[1];
                        else if (entity.styleName) fontFamily = entity.styleName;

                        return { 
                            id: nextId(), layer, color, thickness, lineType, type: 'text', 
                            x: tPos.x - offset.x, 
                            y: tPos.y - offset.y, 
                            size: entity.textHeight || 2.5, 
                            content: rawText, 
                            rotation: (entity.rotation || 0) * Math.PI / 180,
                            justification: entity.halign === 1 ? 'center' : entity.halign === 2 ? 'right' : 'left',
                            attachmentPoint: entity.attachmentPoint || (entity.valign === 1 ? 7 : entity.valign === 2 ? 4 : entity.valign === 3 ? 1 : 1), // Map valign to attachment point
                            fontFamily
                        } as any;
                    }
                    break;
                case 'MTEXT':
                    const mtPos = entity.position || entity.insertionPoint || { x: 0, y: 0 };
                    if (isValid(mtPos.x) && isValid(mtPos.y)) {
                        const rawText = entity.text || '';
                        const hasUnderline = /\\L/i.test(rawText);
                        
                        let fontFamily = 'standard';
                        const fMatch = rawText.match(/\\f([^;|]+)[;|]/);
                        if (fMatch) fontFamily = fMatch[1];
                        else if (entity.styleName) fontFamily = entity.styleName;

                        return { 
                            id: nextId(), layer, color, thickness, lineType, type: 'mtext', 
                            x: mtPos.x - offset.x, 
                            y: mtPos.y - offset.y, 
                            width: entity.width || 0,
                            size: entity.textHeight || 2.5, 
                            content: cleanMText(rawText), 
                            rotation: (entity.rotation || 0) * Math.PI / 180,
                            attachmentPoint: entity.attachmentPoint || 1,
                            underline: hasUnderline,
                            bold: rawText.includes('|b1'),
                            fontFamily
                        } as any;
                    }
                    break;
                case 'ELLIPSE':
                    if (entity.center && entity.majorAxisEndPoint && isValid(entity.center.x)) {
                        const rx = Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2);
                        return { id: nextId(), layer, color, thickness, lineType, type: 'ellipse', x: entity.center.x - offset.x, y: entity.center.y - offset.y, rx, ry: rx * (entity.axisRatio || 1), rotation: Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x) } as any;
                    }
                    break;
                case 'POINT':
                    const pPos = entity.position || { x: 0, y: 0 };
                    if (isValid(pPos.x) && isValid(pPos.y)) {
                        return { id: nextId(), layer, color, thickness, lineType, type: 'point', x: pPos.x - offset.x, y: pPos.y - offset.y, size: 5 } as any;
                    }
                    break;
                case 'INSERT':
                    const insPos = entity.position || { x: 0, y: 0 };
                    if (isValid(insPos.x) && isValid(insPos.y)) {
                        const bName = (entity.name || entity.block || "").toUpperCase();
                        return { 
                            id: nextId(), layer, color, thickness, lineType, 
                            type: 'block', 
                            x: insPos.x - offset.x, 
                            y: insPos.y - offset.y, 
                            blockId: bName, 
                            name: bName,
                            scaleX: entity.xScale || 1, 
                            scaleY: entity.yScale || 1, 
                            scaleZ: entity.zScale || 1,
                            rotation: (entity.rotation || 0) * Math.PI / 180 
                        } as any;
                    }
                    break;
                case 'SPLINE':
                    const ctrlPts = (entity.controlPoints || entity.vertices || entity.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                    if (ctrlPts.length > 1) {
                        return { id: nextId(), layer, color, thickness, lineType, type: 'pline', points: ctrlPts.map((v: any) => ({ x: (v.x || 0) - offset.x, y: (v.y || 0) - offset.y })), closed: !!entity.closed } as any;
                    }
                    break;
                case 'ATTDEF':
                case 'ATTRIB':
                    const attPos = entity.position || { x: 0, y: 0 };
                    return { 
                        id: nextId(), layer, color, thickness, lineType, type: 'text', 
                        x: attPos.x - offset.x, 
                        y: attPos.y - offset.y, 
                        size: entity.textHeight || 2.5, 
                        content: entity.text || entity.tag || '', 
                        rotation: (entity.rotation || 0) * Math.PI / 180,
                    } as any;
                case 'XLINE':
                case 'RAY':
                    const basePt = entity.basePoint || entity.position || { x: 0, y: 0 };
                    const dir = entity.directionVector || entity.unitVector || { x: 1, y: 0 };
                    if (isValid(basePt.x) && isValid(basePt.y) && isValid(dir.x) && isValid(dir.y)) {
                        return {
                            id: nextId(), layer, color, thickness, lineType, type: (entity.type.toLowerCase() as any),
                            x1: basePt.x - offset.x, y1: basePt.y - offset.y,
                            x2: (basePt.x + dir.x) - offset.x,
                            y2: (basePt.y + dir.y) - offset.y
                        } as any;
                    }
                    break;
                case '3DFACE':
                    if (entity.vertices && entity.vertices.length >= 3) {
                        const pts = entity.vertices.slice(0, 4).map((v: any) => ({ x: v.x - offset.x, y: v.y - offset.y }));
                        return { id: nextId(), layer, color, thickness, lineType, type: 'polygon', points: pts, closed: true, filled: false } as any;
                    }
                    break;
                case 'IMAGE':
                case 'WIPEOUT':
                    const imgPos = entity.position || { x: 0, y: 0 };
                    return { 
                        id: nextId(), layer, color, thickness, lineType, type: 'rect', 
                        x: imgPos.x - offset.x, y: imgPos.y - offset.y, 
                        width: entity.width || 10, height: entity.height || 10, 
                        rotation: (entity.rotation || 0) * Math.PI / 180 
                    } as any;
                case 'DIMENSION':
                    if (entity.definitionPoint && entity.definitionPoint2 && isValid(entity.definitionPoint.x) && isValid(entity.definitionPoint2.x)) {
                        const dp1 = entity.definitionPoint;
                        const dp2 = entity.definitionPoint2;
                        const tmp = entity.textMidPoint;
                        const useTmp = tmp && isValid(tmp.x) && (tmp.x !== 0 || tmp.y !== 0);
                        
                        let dType: DimensionType = 'linear';
                        if (entity.dimensionType === 4) dType = 'radius';
                        else if (entity.dimensionType === 3) dType = 'diameter';
                        else if (entity.dimensionType === 2) dType = 'angular';
                        
                        return { 
                            id: nextId(), layer, color, thickness, lineType, type: 'dimension', 
                            dimType: dType, 
                            x1: dp1.x - offset.x, y1: dp1.y - offset.y,
                            x2: dp2.x - offset.x, y2: dp2.y - offset.y,
                            dimX: useTmp ? (tmp.x - offset.x) : ((dp1.x + dp2.x) / 2 - offset.x),
                            dimY: useTmp ? (tmp.y - offset.y) : ((dp1.y + dp2.y) / 2 - offset.y),
                            text: entity.text || ''
                        } as any;
                    }
                    break;
                case 'LEADER':
                    if (entity.vertices && entity.vertices.length > 1) {
                        const v1 = entity.vertices[0];
                        const v2 = entity.vertices[1];
                        if (isValid(v1.x) && isValid(v1.y) && isValid(v2.x) && isValid(v2.y)) {
                            const useV2 = (v2.x !== 0 || v2.y !== 0) || (v1.x === 0 && v1.y === 0);
                            return { 
                                id: nextId(), layer, color, thickness, lineType, type: 'leader', 
                                x1: v1.x - offset.x, y1: v1.y - offset.y, 
                                x2: useV2 ? (v2.x - offset.x) : (v1.x - offset.x + 0.001), 
                                y2: useV2 ? (v2.y - offset.y) : (v1.y - offset.y + 0.001), 
                                text: '', size: 2.5 
                            } as any;
                        }
                    }
                    break;
                case 'SOLID':
                case 'TRACE': {
                    if (entity.points && entity.points.length >= 3) {
                        const pts = [
                            { x: entity.points[0].x - offset.x, y: entity.points[0].y - offset.y },
                            { x: entity.points[1].x - offset.x, y: entity.points[1].y - offset.y },
                            { x: (entity.points[3]?.x || entity.points[2].x) - offset.x, y: (entity.points[3]?.y || entity.points[2].y) - offset.y }, 
                            { x: entity.points[2].x - offset.x, y: entity.points[2].y - offset.y }
                        ].filter(p => isValid(p.x + offset.x));
                        if (pts.length >= 3) {
                            return { id: nextId(), layer, color, thickness, lineType, type: 'polygon', points: pts, closed: true, filled: true } as any;
                        }
                    }
                    break;
                }
                case 'HATCH':
                    if (entity.boundaryPaths && entity.boundaryPaths.length > 0) {
                        const loops: Point[][] = [];
                        entity.boundaryPaths.forEach((path: any) => {
                            const pts: Point[] = [];
                            if (path.edges && path.edges.length > 0) {
                                path.edges.forEach((e: any) => {
                                    if (e.startPoint && isValid(e.startPoint.x)) pts.push({ x: e.startPoint.x - offset.x, y: e.startPoint.y - offset.y });
                                    if (e.endPoint && isValid(e.endPoint.x)) pts.push({ x: e.endPoint.x - offset.x, y: e.endPoint.y - offset.y });
                                });
                            } else if (path.vertices && path.vertices.length > 0) {
                                path.vertices.forEach((v: any) => {
                                    if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x - offset.x, y: v.y - offset.y, bulge: v.bulge });
                                });
                            }
                            if (pts.length >= 2) loops.push(pts);
                        });
                        
                        if (loops.length > 0) {
                            return { 
                                id: nextId(), layer, color, thickness, lineType, type: 'hatch', 
                                pattern: (entity.patternName || 'solid').toLowerCase(), 
                                points: loops[0],
                                loops, 
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
            const blockNames = Object.keys(dxf.blocks);
            const numBlocks = blockNames.length;
            for (let i = 0; i < numBlocks; i++) {
                // Yielding point
                if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
                
                const name = blockNames[i];
                const b = dxf.blocks[name];
                const bp = (b as any).position || (b as any).origin;
                const basePoint = bp ? { x: bp.x || 0, y: bp.y || 0 } : { x: 0, y: 0 };
                const blockShapes: Shape[] = [];
                if (b.entities) {
                    const numEnt = b.entities.length;
                    for (let j = 0; j < numEnt; j++) {
                        const s = convertEntity(b.entities[j], basePoint);
                        if (s) blockShapes.push(s);
                    }
                }
                blocks[name.toUpperCase()] = { id: name.toUpperCase(), name: name.toUpperCase(), basePoint, shapes: blockShapes };
            }
        }

        if (dxf.entities) {
            const numEntities = dxf.entities.length;
            for (let i = 0; i < numEntities; i++) {
                // Yielding point for entities
                if (i % 1000 === 0) await new Promise(resolve => setTimeout(resolve, 0));

                const entity = dxf.entities[i];
                stats.total++;
                stats.counts[entity.type] = (stats.counts[entity.type] || 0) + 1;
                const s = convertEntity(entity);
                if (s) {
                    if (entity.inPaperSpace) {
                        paperEntities.push(s);
                    } else {
                        entities.push(s);
                    }
                }
                else stats.unsupported++;
            }
        }

        if (paperEntities.length > 0) {
            layouts['layout1'] = {
                id: 'layout1',
                name: 'Layout1',
                paperSize: { width: 297, height: 210 }, // A4 Landscape
                entities: paperEntities,
                viewports: [
                    {
                        id: 'vp1',
                        x: 0, y: 0, width: 297, height: 210,
                        viewState: { scale: 1, originX: 0, originY: 0 }
                    }
                ]
            };
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
        settings: {
            ...defaultSettings,
            dimStyles: { ...defaultSettings.dimStyles, ...dimStyles }
        },
        layers,
        blocks,
        entities,
        lineTypes,
        textStyles: {},
        layouts,
        bounds: getAllShapesBounds(entities, blocks),
        stats
    };
};
