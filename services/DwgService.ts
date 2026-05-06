
import { createModule, LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { Shape, BlockDefinition, LayerConfig, Point, VoxProject, AppSettings, LayoutDefinition } from '../types';
import { generateId, getAllShapesBounds } from './cadService';
import { aciToHex, mapLineweight } from './colorUtils';

/**
 * DWG Service
 * 
 * Provides robust DWG file parsing. 
 * Includes a pure-TS header sniffer and a WASM-based full parser.
 * Handles environments where SharedArrayBuffer might be missing.
 */

let libredwg: any = null;
const WASM_CDN_URL = 'https://unpkg.com/@mlightcad/libredwg-web@0.7.1/wasm/libredwg-web.wasm';

// Prospective WASM URL for Vite environments
const wasmUrl = new URL('../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm', import.meta.url).href;

/**
 * Pure JS DWG Header Sniffer
 * Extracts version and basic metadata without WASM.
 */
export const sniffDwgHeader = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    if (buffer.byteLength < 6) return null;
    
    // Check for "AC" signature
    const sig = String.fromCharCode(view.getUint8(0), view.getUint8(1));
    if (sig !== 'AC') return null;
    
    const version = String.fromCharCode(
        view.getUint8(2), view.getUint8(3), 
        view.getUint8(4), view.getUint8(5)
    );
    
    const versionMap: Record<string, string> = {
        '1006': 'R10', '1009': 'R11/12', '1012': 'R13', '1014': 'R14',
        '1015': '2000', '1018': '2004', '1021': '2007', '1024': '2010',
        '1027': '2013', '1032': '2018'
    };
    
    return {
        signature: 'AC' + version,
        version: versionMap[version] || 'Unknown',
        year: parseInt(version) >= 1015 ? (version === '1015' ? 2000 : 2000 + (parseInt(version)-1015)*3/3) : null // Rough estimation
    };
};

export const initDwgService = async () => {
    if (libredwg) return libredwg;
    
    try {
        console.log("DWG Service: Initializing Professional Engine...");
        
        const isSharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';
        if (!isSharedArrayBufferSupported) {
            console.warn("DWG Service: SharedArrayBuffer is missing. Multi-threading disabled.");
        }

        let module: any;
        const locateFile = (path: string) => {
            if (path.endsWith('.wasm')) return wasmUrl;
            return path;
        };

        const cdnLocateFile = (path: string) => {
            if (path.endsWith('.wasm')) return WASM_CDN_URL;
            return path;
        };

        try {
            console.log("DWG Service: Loading WASM from Vite-resolved path...");
            module = await (createModule as any)({ locateFile });
        } catch (localErr) {
            console.warn("DWG Service: Local WASM load failed, fallback to CDN...", localErr);
            module = await (createModule as any)({ locateFile: cdnLocateFile });
        }

        if (!LibreDwg || typeof (LibreDwg as any).createByWasmInstance !== 'function') {
            throw new Error("LibreDwg API not available in module exports.");
        }

        libredwg = (LibreDwg as any).createByWasmInstance(module);
        console.log("DWG Service: Engine ready.");
        return libredwg;
    } catch (err) {
        console.error("DWG Service: Critical Init Failure", err);
        throw err;
    }
};

export const dwgToProject = async (buffer: ArrayBuffer, defaultSettings: AppSettings): Promise<VoxProject> => {
    // 1. Sniff Header First (No WASM required)
    const header = sniffDwgHeader(buffer);
    console.log("DWG Service: Sniffed Header:", header);

    try {
        const instance = await initDwgService();
        if (!instance) throw new Error("ENGINE_NOT_LOADED");

        console.log("DWG Service: Reading binary stream...");
        const dwgData = instance.dwg_read_data(new Uint8Array(buffer), Dwg_File_Type.DWG);
        if (!dwgData) {
            throw new Error(`FORMAT_READ_ERROR: This may be an unsupported or corrupted DWG version (${header?.signature || 'Unknown'})`);
        }

        console.log("DWG Service: Converting to object graph...");
        const db = instance.convert(dwgData);
        instance.dwg_free(dwgData);

        if (!db) throw new Error("GRAPH_CONVERSION_FAILED");

        const entities: Shape[] = [];
        const blocks: Record<string, BlockDefinition> = {};
        const layers: Record<string, LayerConfig> = {};
        const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
        const paperEntities: Shape[] = [];
        const layouts: Record<string, LayoutDefinition> = {};

        const cleanText = (text: string): string => {
            if (!text) return "";
            // Robust MText cleanup
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
                .replace(/\\/g, "");
        };

        const convertEntity = (ent: any): Shape | null => {
            if (!ent) return null;
            const id = generateId();
            const layer = ent.layer || '0';
            const type = ent.type;
            const color = aciToHex(ent.color, ent.true_color || ent.trueColor);
            const thickness = ent.thickness || mapLineweight(ent.lineweight);
            const lineScale = ent.ltScale || 1;
            
            stats.total++;
            stats.counts[type] = (stats.counts[type] || 0) + 1;

            switch (type) {
                case 'LINE':
                    if (ent.startPoint && ent.endPoint) {
                        return { id, type: 'line', layer, color, x1: ent.startPoint.x, y1: ent.startPoint.y, x2: ent.endPoint.x, y2: ent.endPoint.y, thickness, lineType: ent.lineType || 'continuous' } as any;
                    }
                    break;
                case 'CIRCLE':
                    if (ent.center) {
                        return { id, type: 'circle', layer, color, x: ent.center.x, y: ent.center.y, radius: ent.radius || 1, thickness, lineScale } as any;
                    }
                    break;
                case 'ARC':
                    if (ent.center) {
                        return { id, type: 'arc', layer, color, x: ent.center.x, y: ent.center.y, radius: ent.radius || 1, startAngle: ent.startAngle || 0, endAngle: ent.endAngle || Math.PI, counterClockwise: false, thickness, lineScale } as any;
                    }
                    break;
                case 'LWPOLYLINE':
                case 'POLYLINE1D':
                case 'POLYLINE2D':
                case 'POLYLINE3D':
                    if (ent.vertices && ent.vertices.length > 1) {
                        return { id: generateId(), type: 'pline', layer, color, points: ent.vertices.map((v: any) => ({ x: v.x, y: v.y, bulge: v.bulge })), closed: !!(ent.flag & 1) || !!ent.closed, thickness, lineScale, lineType: ent.lineType || 'continuous' } as any;
                    }
                    else if (ent.controlPoints && ent.controlPoints.length > 1) {
                        return { id: generateId(), type: 'pline', layer, color, points: ent.controlPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: !!ent.closed, thickness, lineScale } as any;
                    }
                    break;
                case 'SPLINE':
                    const splPoints = ent.controlPoints || ent.fitPoints || ent.vertices;
                    if (splPoints && splPoints.length > 1) {
                        return { id: generateId(), type: 'spline', layer, color, points: splPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: !!ent.closed, thickness, lineScale } as any;
                    }
                    break;
                case 'LEADER':
                    if (ent.vertices && ent.vertices.length >= 2) {
                        return { id: generateId(), type: 'leader', layer, color, x1: ent.vertices[0].x, y1: ent.vertices[0].y, x2: ent.vertices[1].x, y2: ent.vertices[1].y, text: '', size: 2.5, thickness, lineScale } as any;
                    }
                    break;
                case 'RAY':
                case 'XLINE':
                    if (ent.startPoint && ent.endPoint) {
                        return { id: generateId(), type: type.toLowerCase() as any, layer, color, x1: ent.startPoint.x, y1: ent.startPoint.y, x2: ent.endPoint.x, y2: ent.endPoint.y, thickness, lineScale } as any;
                    }
                    break;
                case 'SOLID':
                case '3DFACE':
                case 'TRACE':
                    const solidPts = ent.vertices || ent.points;
                    if (solidPts && solidPts.length >= 3) {
                        return { id: generateId(), type: 'polygon', layer, color, points: solidPts.map((v: any) => ({ x: v.x, y: v.y })), closed: true, filled: true, thickness, lineScale } as any;
                    }
                    break;
                case 'TEXT':
                case 'MTEXT':
                    const pos = ent.position || ent.insertPoint || ent.basePoint;
                    if (pos) {
                        const rawText = ent.text || ent.content || '';
                        return { 
                            id, type: (type === 'MTEXT' || rawText.includes('\n')) ? 'mtext' : 'text', 
                            layer, color, x: pos.x, y: pos.y, size: ent.height || 2.5, width: ent.width || 0, 
                            content: cleanText(rawText), rotation: ent.rotation || 0,
                            underline: /\\L/i.test(rawText), bold: rawText.includes('|b1'), thickness, lineScale 
                        } as any;
                    }
                    break;
                case 'ELLIPSE':
                    if (ent.center && ent.majorAxis && ent.ratio !== undefined) {
                        return { id, type: 'ellipse', layer, color, x: ent.center.x, y: ent.center.y, rx: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2), ry: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2) * ent.ratio, rotation: Math.atan2(ent.majorAxis.y, ent.majorAxis.x), thickness, lineScale } as any;
                    }
                    break;
                case 'INSERT':
                    if (ent.insertPoint && ent.blockName) {
                        return { id, type: 'block', layer, color, x: ent.insertPoint.x, y: ent.insertPoint.y, blockId: ent.blockName, scaleX: ent.scale?.x || 1, scaleY: ent.scale?.y || 1, rotation: ent.rotation || 0, thickness } as any;
                    }
                    break;
                case 'POINT':
                    if (ent.position) {
                        return { id, type: 'point', layer, color, x: ent.position.x, y: ent.position.y, size: 1, thickness, lineScale } as any;
                    }
                    break;
                case 'DIMENSION':
                    if (ent.definitionPoint && ent.textMidPoint) {
                        return { id, type: 'dimension', layer, color, dimType: 'aligned', x1: ent.definitionPoint.x || 0, y1: ent.definitionPoint.y || 0, x2: ent.definitionPoint2?.x || 0, y2: ent.definitionPoint2?.y || 0, dimX: ent.textMidPoint.x, dimY: ent.textMidPoint.y, text: ent.text || '', thickness, lineScale } as any;
                    }
                    break;
                case 'HATCH':
                    if (ent.boundaryPaths && Array.isArray(ent.boundaryPaths)) {
                        const pts: Point[] = [];
                        ent.boundaryPaths.forEach((path: any) => {
                            if (path?.vertices) path.vertices.forEach((v: any) => pts.push({ x: v.x, y: v.y, bulge: v.bulge }));
                        });
                        if (pts.length > 2) {
                            return { id, type: 'hatch', layer, color, points: pts, pattern: (ent.patternName || 'ansi31').toLowerCase(), scale: ent.patternScale || 1, rotation: (ent.patternAngle || 0) * (180 / Math.PI), thickness: 0.1 } as any;
                        }
                    }
                    break;
            }
            stats.unsupported++;
            return null;
        };

        // Layers Setup
        layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
        if (db.layers && Array.isArray(db.layers)) {
            db.layers.forEach((l: any) => {
                const name = l.name || l.id;
                layers[name] = { id: name, name: name, visible: true, locked: !!(l.flag & 4), frozen: !!(l.flag & 1), plottable: name.toLowerCase() !== 'defpoints', color: aciToHex(l.color), thickness: 0.25, lineType: 'continuous' };
            });
        }

        // Blocks Setup
        if (db.blocks && Array.isArray(db.blocks)) {
            db.blocks.forEach((b: any) => {
                const name = b.name || b.id;
                if (name && b.entities) {
                    const blockShapes: Shape[] = [];
                    b.entities.forEach((ent: any) => {
                        const s = convertEntity(ent);
                        if (s) blockShapes.push(s);
                    });
                    blocks[name] = { id: name, name: name, basePoint: b.basePoint || { x: 0, y: 0 }, shapes: blockShapes };
                }
            });
        }

        // Entities Setup
        if (db.entities && Array.isArray(db.entities)) {
            db.entities.forEach((ent: any) => {
                const s = convertEntity(ent);
                if (s) {
                    if (ent.isPaperSpace) paperEntities.push(s);
                    else entities.push(s);
                }
            });
        }

        if (paperEntities.length > 0) {
            layouts['layout1'] = { id: 'layout1', name: 'Layout1', paperSize: { width: 297, height: 210 }, entities: paperEntities, viewports: [{ id: 'vp1', x: 0, y: 0, width: 297, height: 210, viewState: { scale: 1, originX: 0, originY: 0 } }] };
        }

        return {
            version: "2.0",
            meta: { createdAt: new Date().toISOString(), lastModified: new Date().toISOString(), ...defaultSettings.metadata },
            settings: defaultSettings,
            layers,
            blocks,
            entities,
            lineTypes: {},
            textStyles: {},
            layouts,
            bounds: getAllShapesBounds(entities, blocks),
            stats
        };
    } catch (error) {
        console.error("DWG Service: Processing Error", error);
        throw error;
    }
};
