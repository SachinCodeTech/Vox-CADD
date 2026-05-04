
import { createModule, LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
// @ts-ignore
import wasmUrl from '../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm?url';
import { Shape, BlockDefinition, LayerConfig, Point, VoxProject, AppSettings } from '../types';
import { generateId, getAllShapesBounds } from './cadService';
import { aciToHex } from './colorUtils';

let libredwg: any = null;
const WASM_CDN_URL = 'https://unpkg.com/@mlightcad/libredwg-web@0.7.1/wasm/libredwg-web.wasm';

export const initDwgService = async () => {
    if (libredwg) return libredwg;
    
    try {
        console.log("Initializing DWG Engine...");
        
        let module: any;
        
        try {
            console.log("DWG Service: Attempting to load WASM via managed URL:", wasmUrl);
            module = await (createModule as any)({
                locateFile: () => wasmUrl
            });
        } catch (localErr) {
            console.warn("DWG Service: Failed to load local WASM, falling back to CDN:", localErr);
            module = await (createModule as any)({
                locateFile: () => WASM_CDN_URL
            });
        }

        // Initialize LibreDwg from the wasm module instance
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

        // Helper to convert entities to shapes
        const convertEntity = (ent: any): Shape | null => {
            if (!ent) return null;
            const id = generateId();
            const layer = ent.layer || '0';
            const type = ent.type;
            const color = aciToHex(ent.color);
            stats.total++;
            stats.counts[type] = (stats.counts[type] || 0) + 1;

            switch (type) {
                case 'LINE':
                    if (ent.startPoint && ent.endPoint) {
                        return {
                            id, type: 'line', layer, color,
                            x1: ent.startPoint.x, y1: ent.startPoint.y,
                            x2: ent.endPoint.x, y2: ent.endPoint.y,
                            thickness: ent.thickness || 0.25,
                            lineType: ent.lineType || 'continuous'
                        } as any;
                    }
                    break;
                case 'CIRCLE':
                    if (ent.center) {
                        return {
                            id, type: 'circle', layer, color,
                            x: ent.center.x, y: ent.center.y,
                            radius: ent.radius || 10,
                            thickness: ent.thickness || 0.25
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
                            thickness: ent.thickness || 0.25
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
                            points: ent.vertices.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: !!(ent.flag & 1),
                            thickness: ent.thickness || 0.25,
                            lineType: ent.lineType || 'continuous'
                        } as any;
                    }
                    break;
                case 'TEXT':
                case 'MTEXT':
                    const pos = ent.position || ent.insertPoint || ent.basePoint;
                    if (pos) {
                        return {
                            id, type: 'text', layer, color,
                            x: pos.x, y: pos.y,
                            size: ent.height || 2.5,
                            content: (ent.text || ent.content || '').replace(/\\P/g, '\n').replace(/\{|}/g, ''),
                            rotation: (ent.rotation || 0) * (180 / Math.PI),
                            thickness: 0.25
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
                            thickness: 0.25
                        } as any;
                    }
                    break;
                case 'INSERT':
                    if (ent.insertPoint && ent.blockName) {
                        return {
                            id, type: 'block', layer, color,
                            x: ent.insertPoint.x, y: ent.insertPoint.y,
                            blockId: ent.blockName,
                            scaleX: ent.scale?.x || 1,
                            scaleY: ent.scale?.y || 1,
                            rotation: (ent.rotation || 0) * (180 / Math.PI),
                            thickness: 0.25
                        } as any;
                    }
                    break;
                case 'SPLINE':
                    const sPts = ent.controlPoints || ent.fitPoints;
                    if (sPts && sPts.length > 1) {
                        return {
                            id, type: 'pline', layer, color,
                            points: sPts.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: !!(ent.flag & 1),
                            thickness: 0.25
                        } as any;
                    }
                    break;
                case 'POINT':
                    if (ent.position) {
                        return {
                            id, type: 'point', layer, color,
                            x: ent.position.x, y: ent.position.y,
                            size: 1, thickness: 0.25
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
                            thickness: 0.25
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
                            thickness: 0.25
                        } as any;
                    }
                    break;
                case 'HATCH':
                    if (ent.boundaryPaths && Array.isArray(ent.boundaryPaths)) {
                        const allPoints: Point[] = [];
                        ent.boundaryPaths.forEach((path: any) => {
                            if (path && path.vertices) {
                                path.vertices.forEach((v: any) => allPoints.push({ x: v.x, y: v.y }));
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
                    if (s) entities.push(s);
                });
                // Small yield if it's a very large file
                if (db.entities.length > 2000) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
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
            layouts: {},
            bounds: getAllShapesBounds(entities, blocks),
            stats
        };

        return project;
    } catch (error) {
        console.error("DWG_SERVICE_ERROR:", error);
        throw error;
    }
};
