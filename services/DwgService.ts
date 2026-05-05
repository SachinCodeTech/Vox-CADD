
import { createModule, LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
// @ts-ignore
const wasmUrl = new URL('../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm', import.meta.url).href;
import { Shape, BlockDefinition, LayerConfig, Point, VoxProject, AppSettings, LayoutDefinition } from '../types';
import { generateId, getAllShapesBounds } from './cadService';
import { aciToHex, mapLineweight } from './colorUtils';

let libredwg: any = null;
const WASM_CDN_URL = 'https://unpkg.com/@mlightcad/libredwg-web@0.7.1/wasm/libredwg-web.wasm';

export const initDwgService = async () => {
    if (libredwg) return libredwg;
    
    try {
        console.log("Initializing DWG Engine...");
        
        // Check for SharedArrayBuffer support
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn("SharedArrayBuffer is not available. Ensure COOP/COEP headers are set.");
            // We can't really "fix" this here, but we can log it.
        }

        let module: any;
        
        try {
            console.log("DWG Service: Attempting to load WASM via prospective URL:", wasmUrl);
            module = await (createModule as any)({
                locateFile: (path: string) => {
                    if (path.endsWith('.wasm')) return wasmUrl;
                    return path;
                }
            });
        } catch (localErr) {
            console.warn("DWG Service: Failed to load local WASM, falling back to CDN:", localErr);
            module = await (createModule as any)({
                locateFile: (path: string) => {
                    if (path.endsWith('.wasm')) return WASM_CDN_URL;
                    return path;
                }
            });
        }

        // Initialize LibreDwg from the wasm module instance
        if (!LibreDwg || typeof (LibreDwg as any).createByWasmInstance !== 'function') {
            throw new Error("LibreDwg not found or invalid. Check package configuration.");
        }

        libredwg = (LibreDwg as any).createByWasmInstance(module);
        
        console.log("DWG Engine Initialized Successfully");
        return libredwg;
    } catch (err) {
        console.error("DWG_ENGINE_INIT_FAILURE:", err);
        throw new Error(`DWG Engine failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    }
};

export const dwgToProject = async (buffer: ArrayBuffer, defaultSettings: AppSettings): Promise<VoxProject> => {
    try {
        const instance = await initDwgService();
        if (!instance) throw new Error("DWG_ENGINE_INIT_FAILED");

        // Read DWG binary data
        console.log("DWG Service: Reading buffer", buffer.byteLength);
        const dwgData = instance.dwg_read_data(new Uint8Array(buffer), Dwg_File_Type.DWG);
        if (!dwgData) {
            throw new Error("FAILED_TO_READ_DWG_BINARY - Check if file is valid DWG");
        }

        // Convert to high-level database structure
        console.log("DWG Service: Converting to database structure...");
        const db = instance.convert(dwgData);
        console.log("DWG Service: Database converted. Entities:", db?.entities?.length, "Blocks:", db?.blocks?.length, "Layers:", db?.layers?.length);
        
        // Free original data pointers
        instance.dwg_free(dwgData);

        const entities: Shape[] = [];
        const blocks: Record<string, BlockDefinition> = {};
        const layers: Record<string, LayerConfig> = {};
        const stats = {
            total: 0,
            unsupported: 0,
            counts: {} as Record<string, number>
        };

        const cleanLibreDwgText = (text: string): string => {
            if (!text) return "";
            return text
                .replace(/\\P/g, "\n")
                .replace(/\\L/g, "")
                .replace(/\\l/g, "")
                .replace(/\{[^;]*;/g, "")
                .replace(/\}/g, "")
                .replace(/\\S[^;]*;/g, "")
                .replace(/\\f[^;]*|[^;]*;/g, (match) => {
                    if (match.startsWith('\\f')) return ''; 
                    return match;
                })
                .replace(/\\A\d+;/g, "") 
                .replace(/\\H[\d\.]+x*;/g, "") 
                .replace(/\\C\d+;/g, "") 
                .replace(/\\W[\d\.]+;/g, "") 
                .replace(/\\T[\d\.]+;/g, "") 
                .replace(/\\Q[\d\.]+;/g, "") 
                .replace(/\\/g, ""); 
        };

        const paperEntities: Shape[] = [];
        const layouts: Record<string, LayoutDefinition> = {};

        // Helper to convert entities to shapes
        const convertEntity = (ent: any): Shape | null => {
            if (!ent) return null;
            const id = generateId();
            const layer = ent.layer || '0';
            const type = ent.type;
            const color = aciToHex(ent.color, ent.true_color || ent.trueColor);
            const thickness = ent.thickness || mapLineweight(ent.lineweight);
            const isPaper = !!ent.isPaperSpace || !!(ent.flag & 1); 
            const lineScale = ent.ltScale || 1;
            stats.total++;
            stats.counts[type] = (stats.counts[type] || 0) + 1;

            switch (type) {
                case 'LINE':
                    if (ent.startPoint && ent.endPoint) {
                        return {
                            id, type: 'line', layer, color,
                            x1: ent.startPoint.x, y1: ent.startPoint.y,
                            x2: ent.endPoint.x, y2: ent.endPoint.y,
                            thickness,
                            lineType: ent.lineTypeName || ent.lineType || 'continuous'
                        } as any;
                    }
                    break;
                case 'CIRCLE':
                    if (ent.center) {
                        return {
                            id, type: 'circle', layer, color,
                            x: ent.center.x, y: ent.center.y,
                            radius: ent.radius || 10,
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'ARC':
                    if (ent.center) {
                        return {
                            id, type: 'arc', layer, color,
                            x: ent.center.x, y: ent.center.y,
                            radius: ent.radius || 10,
                            startAngle: ent.startAngle || 0,
                            endAngle: ent.endAngle || Math.PI,
                            counterClockwise: false,
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'LWPOLYLINE':
                case 'POLYLINE1D':
                case 'POLYLINE2D':
                case 'POLYLINE3D':
                    if (ent.vertices && ent.vertices.length > 1) {
                        return {
                            id, type: 'pline', layer, color,
                            points: ent.vertices.map((v: any) => ({ x: v.x, y: v.y, bulge: v.bulge })),
                            closed: !!(ent.flag & 1),
                            thickness, lineScale,
                            lineType: ent.lineType || 'continuous'
                        } as any;
                    }
                    break;
                case 'TEXT':
                case 'MTEXT':
                case 'ATTRIB':
                case 'ATTDEF':
                    const pos = ent.position || ent.insertPoint || ent.basePoint;
                    if (pos) {
                        const rawText = ent.text || ent.content || '';
                        const hasUnderline = /\\L/i.test(rawText);
                        return {
                            id, type: (type === 'MTEXT' || rawText.includes('\n')) ? 'mtext' : 'text', 
                            layer, color,
                            x: pos.x, y: pos.y,
                            size: ent.height || 2.5,
                            width: ent.width || 0,
                            content: cleanLibreDwgText(rawText),
                            rotation: (ent.rotation || 0) * (180 / Math.PI),
                            underline: hasUnderline,
                            bold: rawText.includes('|b1'),
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'ELLIPSE':
                    if (ent.center && ent.majorAxis && ent.ratio !== undefined) {
                        return {
                            id, type: 'ellipse', layer, color,
                            x: ent.center.x, y: ent.center.y,
                            rx: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2),
                            ry: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2) * ent.ratio,
                            rotation: Math.atan2(ent.majorAxis.y, ent.majorAxis.x) * (180 / Math.PI),
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'INSERT':
                    if (ent.insertPoint && ent.blockName) {
                        const attributes: Record<string, string> = {};
                        if (ent.attributes && Array.isArray(ent.attributes)) {
                            ent.attributes.forEach((a: any) => {
                                if (a.tag) attributes[a.tag] = a.text || a.content;
                            });
                        }
                        return {
                            id, type: 'block', layer, color,
                            x: ent.insertPoint.x, y: ent.insertPoint.y,
                            blockId: ent.blockName,
                            scaleX: ent.scale?.x || 1,
                            scaleY: ent.scale?.y || 1,
                            rotation: (ent.rotation || 0) * (180 / Math.PI),
                            thickness,
                            attributes
                        } as any;
                    }
                    break;
                case 'SPLINE': {
                    const sPts = ent.controlPoints || ent.fitPoints;
                    if (sPts && sPts.length > 1) {
                        return {
                            id, type: 'pline', layer, color,
                            points: sPts.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: !!(ent.flag & 1),
                            thickness, lineScale
                        } as any;
                    }
                    break;
                }
                case 'POINT':
                    if (ent.position) {
                        return {
                            id, type: 'point', layer, color,
                            x: ent.position.x, y: ent.position.y,
                            size: 1, thickness, lineScale
                        } as any;
                    }
                    break;
                case 'DIMENSION':
                    if (ent.definitionPoint && ent.textMidPoint) {
                        return {
                            id, type: 'dimension', layer, color,
                            dimType: 'aligned',
                            x1: ent.definitionPoint.x || 0,
                            y1: ent.definitionPoint.y || 0,
                            x2: ent.definitionPoint2?.x || 0,
                            y2: ent.definitionPoint2?.y || 0,
                            dimX: ent.textMidPoint.x,
                            dimY: ent.textMidPoint.y,
                            text: ent.text || '',
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'LEADER':
                    if (ent.vertices && ent.vertices.length > 1) {
                        return {
                            id, type: 'leader', layer, color,
                            x1: ent.vertices[0].x, y1: ent.vertices[0].y,
                            x2: ent.vertices[1].x, y2: ent.vertices[1].y,
                            text: '', size: 2.5,
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case 'XLINE':
                case 'RAY':
                    if (ent.startPoint && ent.endPoint) {
                        return {
                            id, type: type === 'RAY' ? 'ray' : 'xline', layer, color,
                            x1: ent.startPoint.x, y1: ent.startPoint.y,
                            x2: ent.endPoint.x, y2: ent.endPoint.y,
                            thickness, lineScale
                        } as any;
                    }
                    break;
                case '3DFACE':
                    if (ent.vertices && ent.vertices.length >= 3) {
                        return {
                            id, type: 'polygon', layer, color,
                            points: ent.vertices.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: true, filled: false, thickness, lineScale
                        } as any;
                    }
                    break;
                case 'SOLID':
                case 'TRACE': {
                    const sPts = ent.points || ent.vertices;
                    if (sPts && sPts.length >= 3) {
                        const pts = [
                            { x: sPts[0].x, y: sPts[0].y },
                            { x: sPts[1].x, y: sPts[1].y },
                            { x: sPts[3]?.x || sPts[0].x, y: sPts[3]?.y || sPts[0].y },
                            { x: sPts[2].x, y: sPts[2].y }
                        ];
                        if (sPts.length === 3) pts.splice(2, 1);
                        return { id, layer, color, type: 'polygon', points: pts, closed: true, filled: true, thickness, lineScale } as any;
                    }
                    break;
                }
                case 'HATCH':
                    if (ent.boundaryPaths && Array.isArray(ent.boundaryPaths)) {
                        const allPoints: Point[] = [];
                        ent.boundaryPaths.forEach((path: any) => {
                            if (path && path.vertices) {
                                path.vertices.forEach((v: any) => allPoints.push({ x: v.x, y: v.y, bulge: v.bulge }));
                            } else if (path && path.edges) {
                                path.edges.forEach((e: any) => {
                                    if (e.startPoint) allPoints.push({ x: e.startPoint.x, y: e.startPoint.y });
                                });
                            }
                        });
                        
                        if (allPoints.length > 2) {
                            return {
                                id, type: 'hatch', layer, color,
                                points: allPoints,
                                pattern: (ent.patternName || 'ansi31').toLowerCase(),
                                scale: ent.patternScale || 1,
                                rotation: (ent.patternAngle || 0) * (180 / Math.PI),
                                thickness: 0.1
                            } as any;
                        }
                    }
                    break;
            }
            stats.unsupported++;
            return null;
        };

        // Parse Layers
        layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
        layers['defpoints'] = { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' };

        if (db.layers && Array.isArray(db.layers)) {
            db.layers.forEach((l: any) => {
                const name = l.name || l.id;
                layers[name] = {
                    id: name,
                    name: name,
                    visible: true,
                    locked: !!(l.flag & 4),
                    frozen: !!(l.flag & 1),
                    color: aciToHex(l.color),
                    thickness: 0.25,
                    lineType: 'continuous'
                };
            });
        }

        // Parse Blocks
        if (db.blocks && Array.isArray(db.blocks)) {
            db.blocks.forEach((b: any) => {
                const name = b.name || b.id;
                if (name && b.entities) {
                    const blockShapes: Shape[] = [];
                    b.entities.forEach((ent: any) => {
                        const s = convertEntity(ent);
                        if (s) blockShapes.push(s);
                    });
                    blocks[name] = {
                        id: name,
                        name: name,
                        basePoint: b.basePoint || { x: 0, y: 0 },
                        shapes: blockShapes
                    };
                }
            });
        }

        // Parse Entities (Model Space)
        if (db.entities && Array.isArray(db.entities)) {
            // Process in chunks to keep UI responsive for large files
            const CHUNK_SIZE = 500;
            for (let i = 0; i < db.entities.length; i += CHUNK_SIZE) {
                const chunk = db.entities.slice(i, i + CHUNK_SIZE);
                chunk.forEach((ent: any) => {
                    const s = convertEntity(ent);
                    if (s) {
                        if (ent.isPaperSpace) {
                            paperEntities.push(s);
                        } else {
                            entities.push(s);
                        }
                    }
                });
                // Small yield if it's a very large file
                if (db.entities.length > 2000) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }

        if (paperEntities.length > 0) {
            layouts['layout1'] = {
                id: 'layout1',
                name: 'Layout1',
                paperSize: { width: 297, height: 210 },
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

        const project: VoxProject = {
            version: "2.0",
            meta: {
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                ...defaultSettings.metadata
            },
            settings: defaultSettings,
            layers: Object.keys(layers).length > 0 ? layers : { 
                '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
                'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
            },
            blocks,
            entities,
            lineTypes: {},
            textStyles: {},
            layouts,
            bounds: getAllShapesBounds(entities, blocks),
            stats
        };

        return project;
    } catch (error) {
        console.error("DWG_SERVICE_ERROR:", error);
        throw error;
    }
};
