
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
        const layers: Record<string, LayerConfig> = {
            '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FF0000', thickness: 0.25, lineType: 'continuous' },
            'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
        };
        const stats = { total: 0, unsupported: 0, counts: {} as Record<string, number> };
        const paperEntities: Shape[] = [];
        const layouts: Record<string, LayoutDefinition> = {};

        const cleanText = (text: string): string => {
            if (!text) return "";
            
            let actualText = text;
            // Clean up AutoCAD anonymous names and garbage codes
            if (actualText.startsWith('A$') || actualText.includes('$')) {
                actualText = actualText.split('*').pop() || actualText;
            }
            if (actualText.includes(';')) {
                actualText = actualText.split(';').pop() || actualText;
            }

            // Robust MText cleanup
            return actualText
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
            
            // Handle layer as string or object
            let layer = '0';
            if (typeof ent.layer === 'string') layer = ent.layer;
            else if (ent.layer && typeof ent.layer.name === 'string') layer = ent.layer.name;
            else if (typeof ent.layerName === 'string') layer = ent.layerName;
            else if (ent.layer && ent.layer.id) layer = String(ent.layer.id);
            else if (ent.layer_id) layer = String(ent.layer_id);
            
            // Normalize special AutoCAD layers
            const lowerLayer = layer.toLowerCase();
            if (lowerLayer === 'defpoints') layer = 'defpoints';
            if (layer === '0' || lowerLayer === '0') layer = '0';
            
            // Robust type detection - using includes as suggested
            const type = (ent.type || ent.objectType || '').toUpperCase().trim();
            const color = aciToHex(ent.color, ent.true_color || ent.trueColor);
            const thickness = ent.thickness !== undefined && typeof ent.thickness === 'number' ? ent.thickness : mapLineweight(ent.lineweight || ent.lineWeight);
            const lineType = (ent.lineType || ent.linetype || 'bylayer').toLowerCase();
            const lineScale = ent.ltScale || ent.lineTypeScale || 1;

            const isValid = (val: any) => typeof val === 'number' && isFinite(val) && Math.abs(val) < 1e12;
            
            // Improved unique ID generation for each imported entity
            const nextId = () => `dwg-${type.toLowerCase()}-${generateId()}`;

            stats.total++;
            stats.counts[type] = (stats.counts[type] || 0) + 1;

            try {
                switch (true) {
                    case type.includes('LINE') && !type.includes('POLYLINE') && !type.includes('XLINE'):
                        const start = ent.startPoint || ent.start_point || ent.points?.[0] || ent.start;
                        const end = ent.endPoint || ent.end_point || ent.points?.[1] || ent.end;
                        if (start && end && isValid(start.x) && isValid(start.y) && isValid(end.x) && isValid(end.y)) {
                            // Anti-radiating-lines filter
                            const isStart0 = Math.abs(start.x) < 1e-6 && Math.abs(start.y) < 1e-6;
                            const isEnd0 = Math.abs(end.x) < 1e-6 && Math.abs(end.y) < 1e-6;
                            const dist = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
                            if ((isStart0 || isEnd0) && dist > 1e5 && !(isStart0 && isEnd0)) return null;
                            
                            return { id: nextId(), type: 'line', layer, color, x1: start.x, y1: start.y, x2: end.x, y2: end.y, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('CIRCLE'):
                        const center = ent.center || ent.center_point || ent.position;
                        if (center) {
                            return { id: nextId(), type: 'circle', layer, color, x: center.x, y: center.y, radius: ent.radius || 1, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('ARC'):
                        const arcCenter = ent.center || ent.center_point || ent.position;
                        if (arcCenter) {
                            return { id: nextId(), type: 'arc', layer, color, x: arcCenter.x, y: arcCenter.y, radius: ent.radius || 1, startAngle: ent.startAngle || 0, endAngle: ent.endAngle || Math.PI, counterClockwise: false, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('POLYLINE') || type.includes('LWPOLYLINE'):
                        let vertices = (ent.vertices || ent.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                        if (vertices.length > 2) {
                            const hasManyNonZero = vertices.filter((v: any) => Math.abs(v.x) > 1e-6 || Math.abs(v.y) > 1e-6).length > vertices.length / 2;
                            if (hasManyNonZero) {
                                vertices = vertices.filter((v: any) => Math.abs(v.x) > 1e-6 || Math.abs(v.y) < 1e-6);
                            }
                        }
                        if (vertices.length > 1) {
                            return { id: nextId(), type: 'pline', layer, color, points: vertices.map((v: any) => ({ x: v.x, y: v.y, bulge: v.bulge || 0 })), closed: !!(ent.flag & 1) || !!ent.closed || !!ent.isClosed, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('SPLINE'):
                        const splPoints = (ent.controlPoints || ent.fitPoints || ent.vertices || ent.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                        if (splPoints.length > 1) {
                            return { id: nextId(), type: 'spline', layer, color, points: splPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: !!ent.closed || !!ent.isClosed, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('TEXT') || type.includes('MTEXT') || type.includes('ATTRIB') || type.includes('ATTDEF'):
                        const pos = ent.position || ent.insertPoint || ent.basePoint || ent.insertionPoint || ent.location;
                        if (pos && isValid(pos.x) && isValid(pos.y)) {
                            const rawText = ent.text || ent.content || ent.textString || ent.value || ent.string || '';
                            const text = cleanText(rawText);
                            let fontFamily = 'standard';
                            const fMatch = rawText.match(/\\f([^;|]+)[;|]/);
                            if (fMatch) fontFamily = fMatch[1];
                            else if (ent.style) fontFamily = ent.style.name || ent.style.id || 'standard';
                            
                            const rotation = ent.rotation !== undefined ? ent.rotation : 0;
                            const h = ent.height || ent.textHeight || 2.5;
                            return { 
                                id: nextId(), type: (type.includes('MTEXT') || rawText.includes('\P')) ? 'mtext' : 'text', 
                                layer, color, x: pos.x, y: pos.y, 
                                size: h, height: h,
                                content: text, text: text, rotation, fontFamily,
                                underline: /\\L/i.test(rawText), bold: rawText.includes('|b1'), thickness, lineType, lineScale 
                            } as any;
                        }
                        break;
                    case type.includes('ELLIPSE'):
                        const eCenter = ent.center || ent.position;
                        const eMajor = ent.majorAxis || ent.major_axis;
                        if (eCenter && eMajor && ent.ratio !== undefined) {
                            const rot = Math.atan2(eMajor.y, eMajor.x);
                            return { id: nextId(), type: 'ellipse', layer, color, x: eCenter.x, y: eCenter.y, rx: Math.sqrt(eMajor.x**2 + eMajor.y**2), ry: Math.sqrt(eMajor.x**2 + eMajor.y**2) * ent.ratio, rotation: rot, thickness, lineType } as any;
                        }
                        break;
                    case type.includes('HATCH'):
                        const loops: Point[][] = [];
                        const paths = ent.boundaryPaths || ent.paths || ent.loops || ent.boundary;
                        if (paths && Array.isArray(paths)) {
                            paths.forEach((path: any) => {
                                const pts: Point[] = [];
                                const pVertices = path?.vertices || path?.points || path?.edges || (Array.isArray(path) ? path : []);
                                if (Array.isArray(pVertices)) {
                                    pVertices.forEach((v: any) => {
                                        if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x, y: v.y, bulge: v.bulge });
                                    });
                                }
                                if (pts.length >= 2) loops.push(pts);
                            });
                        }
                        if (loops.length > 0) {
                            return { id: nextId(), type: 'hatch', layer, color, points: loops[0], loops, pattern: (ent.patternName || 'solid').toLowerCase(), scale: ent.patternScale || 1, rotation: ent.patternAngle || 0, filled: true, fill: true } as any;
                        }
                        break;
                    case type.includes('INSERT') || type.includes('BLOCK'):
                        const insPoint = ent.insertPoint || ent.position || ent.insertionPoint;
                        const bName = ent.blockName || ent.name || ent.block;
                        if (insPoint && bName) {
                            const blockId = typeof bName === 'string' ? bName : (bName.name || bName.id || '0');
                            const scaleX = ent.scale?.x || ent.xScale || 1;
                            const scaleY = ent.scale?.y || ent.yScale || 1;
                            return { id: nextId(), type: 'block', layer, color, x: insPoint.x, y: insPoint.y, blockId, scaleX, scaleY, rotation: ent.rotation || 0, name: blockId } as any;
                        }
                        break;
                    case type.includes('DIMENSION') || type.includes('DIM'):
                        const dimText = ent.measurement !== undefined ? `${ent.measurement.toFixed(2)}` : (ent.text || 'DIM');
                        const dimPos = ent.textPosition || ent.text_point || ent.insertionPoint || ent.definitionPoint || ent.defPoint || ent.position;
                        if (dimPos && isValid(dimPos.x) && isValid(dimPos.y)) {
                            return { 
                                id: nextId(), type: 'text', layer, color, 
                                x: dimPos.x, y: dimPos.y, 
                                text: dimText, content: dimText, 
                                size: 2.8, height: 2.8,
                                rotation: 0, fontFamily: 'standard'
                            } as any;
                        }
                        break;
                }
            } catch (err) {
                console.warn(`Extraction error for ${type}:`, err);
                stats.unsupported++;
            }

            if (!['POINT', 'VERTEX', 'SEQEND'].includes(type) && !stats.counts[type]) {
                stats.unsupported++;
            }
            return null;
        };

        // Layers Setup
        layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
        
        const processLayer = (l: any) => {
            if (!l) return;
            let name = typeof l.name === 'string' ? l.name : (l.layerName || String(l.id || '0'));
            
            // Normalize special AutoCAD layers
            const lowerName = name.toLowerCase();
            if (lowerName === 'defpoints') name = 'defpoints';
            if (name === '0' || lowerName === '0') name = '0';

            if (name === '0' && layers['0']) {
                // Update 0 layer if properties found
                if (l.color !== undefined) layers['0'].color = aciToHex(Math.abs(l.color));
                return;
            }
            
            const aci = l.color !== undefined ? l.color : (l.aci !== undefined ? l.aci : 7);
            const flag = l.flag !== undefined ? l.flag : (l.flags || 0);
            
            // Standard CAD Layer flags: 1=Frozen, 2=Frozen by default, 4=Locked
            layers[name] = { 
                id: name, 
                name: name, 
                visible: aci >= 0 && !(flag & 1),
                locked: !!(flag & 4), 
                frozen: !!(flag & 1), 
                plottable: name.toLowerCase() !== 'defpoints' && (l.is_plottable !== false && l.plot !== false && l.isPlottable !== false), 
                color: aciToHex(Math.abs(aci)), 
                thickness: mapLineweight(l.lineweight || l.lineWeight || l.lineweight_enum || l.lineWeight_enum) || 0.25, 
                lineType: (l.lineType || l.linetype || l.linestyle || 'continuous').toLowerCase() as any 
            };
        };
        if (db.layers && Array.isArray(db.layers)) {
            const numLayers = db.layers.length;
            for (let i = 0; i < numLayers; i++) {
                if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
                processLayer(db.layers[i]);
            }
        }

        // Blocks Setup
        const rawBlocks = db.blocks || db.block_records || db.blockRecords || [];
        if (rawBlocks) {
            if (Array.isArray(rawBlocks)) {
                const numRawBlocks = rawBlocks.length;
                for (let i = 0; i < numRawBlocks; i++) {
                    if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
                    const b = rawBlocks[i];
                    const name = b.name || b.id || b.blockName;
                    if (name) {
                        const bEntities = b.entities || b.objects || [];
                        const blockShapes: Shape[] = [];
                        if (Array.isArray(bEntities)) {
                            bEntities.forEach((be: any) => {
                                const s = convertEntity(be);
                                if (s) blockShapes.push(s);
                            });
                        }
                        const bp = b.basePoint || b.position || { x: 0, y: 0 };
                        blocks[name] = { id: name, name: name, basePoint: { x: bp.x || 0, y: bp.y || 0 }, shapes: blockShapes };
                    }
                }
            } else {
                const bKeys = Object.keys(rawBlocks);
                for (let i = 0; i < bKeys.length; i++) {
                    if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
                    const name = bKeys[i];
                    const b = rawBlocks[name];
                    const bEntities = b.entities || b.objects || [];
                    const blockShapes: Shape[] = [];
                    if (Array.isArray(bEntities)) {
                        bEntities.forEach((be: any) => {
                            const s = convertEntity(be);
                            if (s) blockShapes.push(s);
                        });
                    }
                    const bp = b.basePoint || b.position || { x: 0, y: 0 };
                    blocks[name] = { id: name, name: name, basePoint: { x: bp.x || 0, y: bp.y || 0 }, shapes: blockShapes };
                }
            }
        }

        // Entities Setup
        const rawEntities = db.entities || db.objects || [];
        if (Array.isArray(rawEntities)) {
            const numEntities = rawEntities.length;
            for (let i = 0; i < numEntities; i++) {
                if (i % 1000 === 0) await new Promise(r => setTimeout(r, 0));
                const ent = rawEntities[i];
                const s = convertEntity(ent);
                if (s) {
                    if (!layers[s.layer]) {
                        layers[s.layer] = { id: s.layer, name: s.layer, visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
                    }
                    if (ent.isPaperSpace || ent.inPaperSpace || ent.paper_space) paperEntities.push(s);
                    else entities.push(s);
                }
            }
        }
        if (paperEntities.length > 0) {
            layouts['layout1'] = { id: 'layout1', name: 'Layout1', paperSize: { width: 297, height: 210 }, entities: paperEntities, viewports: [{ id: 'vp1', x: 0, y: 0, width: 297, height: 210, viewState: { scale: 1, originX: 0, originY: 0 } }] };
        }
        
        console.log(`✅ DWG Import Finished:`);
        console.log(`   • Total Shapes Imported: ${entities.length}`);
        console.log(`   • Unsupported Entities: ${stats.unsupported}`);
        console.log(`   • Entities breakdown:`, stats.counts);
        console.log(`   • Layers Detected: ${Object.keys(layers).length}`);

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
