
import { createModule, LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { Shape } from '../types';
import { generateId } from './cadService';

let libredwg: any = null;

export const initDwgService = async () => {
    if (libredwg) return libredwg;
    
    // LibreDwg.create takes the directory path where wasm files are located
    const baseUrl = window.location.origin + '/';
    libredwg = await LibreDwg.create(baseUrl); 
    return libredwg;
};

export interface DwgImportResult {
    shapes: Shape[];
    stats: {
        total: number;
        unsupported: number;
        counts: Record<string, number>;
    };
}

export const dwgToShapes = async (buffer: ArrayBuffer): Promise<DwgImportResult> => {
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
        const db = instance.convert(dwgData);
        
        // Free original data pointers
        instance.dwg_free(dwgData);

        const shapes: Shape[] = [];
        const stats = {
            total: 0,
            unsupported: 0,
            counts: {} as Record<string, number>
        };

        if (!db.entities || !Array.isArray(db.entities)) {
            return { shapes: [], stats };
        }

        db.entities.forEach((ent: any) => {
            const id = generateId();
            const layer = ent.layer || '0';
            const type = ent.type;
            stats.total++;
            
            // Increment type counts
            stats.counts[type] = (stats.counts[type] || 0) + 1;

            let supported = true;

            switch (type) {
                case 'LINE':
                    if (ent.startPoint && ent.endPoint) {
                        shapes.push({
                            id, type: 'line', layer, color: '#FFFFFF',
                            x1: ent.startPoint.x, y1: ent.startPoint.y,
                            x2: ent.endPoint.x, y2: ent.endPoint.y,
                            thickness: 0.25
                        });
                    }
                    break;
                case 'CIRCLE':
                    if (ent.center) {
                        shapes.push({
                            id, type: 'circle', layer, color: '#FFFFFF',
                            x: ent.center.x, y: ent.center.y,
                            radius: ent.radius || 10,
                            thickness: 0.25
                        });
                    }
                    break;
                case 'ARC':
                    if (ent.center) {
                        shapes.push({
                            id, type: 'arc', layer, color: '#FFFFFF',
                            x: ent.center.x, y: ent.center.y,
                            radius: ent.radius || 10,
                            startAngle: ent.startAngle || 0,
                            endAngle: ent.endAngle || Math.PI,
                            counterClockwise: false,
                            thickness: 0.25
                        });
                    }
                    break;
                case 'LWPOLYLINE':
                case 'POLYLINE2D':
                case 'POLYLINE3D':
                    if (ent.vertices && ent.vertices.length > 1) {
                        shapes.push({
                            id, type: 'pline', layer, color: '#FFFFFF',
                            points: ent.vertices.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: !!(ent.flag & 1),
                            thickness: 0.25
                        });
                    }
                    break;
                case 'TEXT':
                case 'MTEXT':
                    const pos = ent.position || ent.insertPoint || ent.basePoint;
                    if (pos) {
                        shapes.push({
                            id, type: 'text', layer, color: '#FFFFFF',
                            x: pos.x, y: pos.y,
                            size: ent.height || 2.5,
                            content: (ent.text || ent.content || '').replace(/\\P/g, '\n').replace(/\{|}/g, ''), // Basic MText formatting removal
                            rotation: ent.rotation || 0,
                            thickness: 0.25
                        });
                    }
                    break;
                case 'HATCH':
                    // Map hatch boundaries to polylines or basic shapes
                    if (ent.boundaryPaths && Array.isArray(ent.boundaryPaths)) {
                        ent.boundaryPaths.forEach((path: any) => {
                            if (path.vertices && path.vertices.length > 1) {
                                shapes.push({
                                    id: generateId(), type: 'pline', layer, color: '#FFFFFF',
                                    points: path.vertices.map((v: any) => ({ x: v.x, y: v.y })),
                                    closed: true, filled: true, opacity: 0.3,
                                    thickness: 0.1
                                });
                            } else if (path.edges && Array.isArray(path.edges)) {
                                path.edges.forEach((edge: any) => {
                                    if (edge.type === 1 && edge.start && edge.end) { // Line edge
                                        shapes.push({
                                            id: generateId(), type: 'line', layer, color: '#FFFFFF',
                                            x1: edge.start.x, y1: edge.start.y,
                                            x2: edge.end.x, y2: edge.end.y,
                                            thickness: 0.1
                                        });
                                    } else if (edge.type === 2) { // Circular edge
                                        shapes.push({
                                            id: generateId(), type: 'circle', layer, color: '#FFFFFF',
                                            x: edge.center.x, y: edge.center.y,
                                            radius: edge.radius,
                                            thickness: 0.1
                                        });
                                    }
                                });
                            }
                        });
                    }
                    break;
                case 'ELLIPSE':
                    if (ent.center && ent.majorAxis && ent.ratio !== undefined) {
                        shapes.push({
                            id, type: 'ellipse', layer, color: '#FFFFFF',
                            x: ent.center.x, y: ent.center.y,
                            rx: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2),
                            ry: Math.sqrt(ent.majorAxis.x ** 2 + ent.majorAxis.y ** 2) * ent.ratio,
                            rotation: Math.atan2(ent.majorAxis.y, ent.majorAxis.x),
                            thickness: 0.25
                        });
                    }
                    break;
                case 'SPLINE':
                    if (ent.fitPoints && ent.fitPoints.length > 1) {
                        shapes.push({
                            id, type: 'pline', layer, color: '#FFFFFF',
                            points: ent.fitPoints.map((v: any) => ({ x: v.x, y: v.y })),
                            closed: !!(ent.flag & 1),
                            thickness: 0.25
                        });
                    }
                    break;
                case 'POINT':
                    if (ent.position) {
                        shapes.push({
                            id, type: 'point', layer, color: '#FFFFFF',
                            x: ent.position.x, y: ent.position.y,
                            size: 1, thickness: 0.25
                        });
                    }
                    break;
                default:
                    supported = false;
                    break;
            }

            if (!supported) stats.unsupported++;
        });

        return { shapes, stats };
    } catch (error) {
        console.error("DWG_SERVICE_ERROR:", error);
        throw error;
    }
};
