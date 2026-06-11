
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
            
            // Aggressive cleaning
            if (actualText.startsWith('A$') || actualText.includes('$')) {
                actualText = actualText.split('*').pop() || actualText.replace(/A\$\w+/g, '');
            }
            actualText = actualText.trim();
            
            // Rejects anonymized AutoCAD labels, handles & block references
            if (/^\*[u|d|x|e|t|a][0-9]+/i.test(actualText) || /^\*[0-9]+/i.test(actualText) || /^[0-9a-f]{6,16}$/i.test(actualText)) {
                return '';
            }
            if (/A\$C[0-9a-f]+/i.test(actualText) || actualText.startsWith('A$C')) {
                return '';
            }

            // Allow common dimension placeholders and small strings (single letters like grids or labels)
            if (actualText === '<>' || actualText.length < 2) return actualText;

            // Robust MText / formatting cleanup
            let lastText = "";
            while (actualText !== lastText) {
                lastText = actualText;
                actualText = actualText
                    .replace(/\{([^}]+)\}/gi, "$1") // Extract text inside braces nested
                    .replace(/\\[fACWHQTQ][^;]*;/gi, "") // Remove style codes e.g. \fArial|b0|i0;
                    .replace(/\\px[^;]*;/gi, "") // Paragraph spacing
                    .replace(/\\pi[^;]*;/gi, "") // Indent
                    .replace(/\\pd[^;]*;/gi, "") // Tabs
                    .replace(/\\A[0-2];/gi, "") // Alignment
                    .replace(/\\S([^;^]*)[^;]*;/gi, "$1") // Stack fractions and formulas gracefully
                    .replace(/\\K[0-9a-fA-F]{6}/gi, "") // Color
                    .replace(/\\[c|C][0-9]{1,10};/gi, "") // Color codes
                    .replace(/\\[l|L]/gi, "") // Underline
                    .replace(/\\[o|O]/gi, "") // Overline
                    .replace(/\\P/gi, "\n") // Newlines
                    .replace(/\\~([^;]*);/gi, "$1") // Non-breaking space
                    .replace(/\\U\+([0-9A-F]{4})/gi, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
            }

            // Map standard AutoCAD control codes: %%c -> ⌀, %%d -> °, %%p -> ±, %%% -> %
            actualText = actualText
                .replace(/%%[cC]/g, '⌀')
                .replace(/%%[dD]/g, '°')
                .replace(/%%[pP]/g, '±')
                .replace(/%%[uU]/g, '')
                .replace(/%%[oO]/g, '')
                .replace(/%%%/g, '%');

            // final clean filter: if it's strictly numbers or just formatting residue, keep only standard text
            actualText = actualText.trim();
            if (actualText.length > 50 && !actualText.includes(' ') && /[A-Z0-9]{20,}/.test(actualText)) {
                return '';
            }

            return actualText;
        };

        const convertEntity = (ent: any, isInsideBlock = false): Shape | null => {
            if (!ent) return null;
            
            // Handle layer as string or object
            let layer = '0';
            // Resolve Layer Name from various possible properties
            if (typeof ent.layer === 'string') layer = ent.layer;
            else if (ent.layerName && typeof ent.layerName === 'string') layer = ent.layerName;
            else if (ent.layer && (ent.layer.name || ent.layer.layerName)) layer = ent.layer.name || ent.layer.layerName;
            else if (ent.layer && ent.layer.id) layer = String(ent.layer.id);
            else if (ent.layer_id) layer = String(ent.layer_id);
            
            // Normalize special AutoCAD layers
            const lowerLayer = layer.toLowerCase();
            if (lowerLayer === 'defpoints') layer = 'defpoints';
            else if (layer === '0' || lowerLayer === '0') layer = '0';
            
            // Robust type detection
            const type = (ent.type || ent.objectType || '').toUpperCase().trim();
            
            // Use ACI color (1-255), True Color, or ByLayer(256)/ByBlock(0)
            const rawTrueColor = ent.true_color || ent.trueColor || ent.truecolor || 0;
            const color = aciToHex(ent.color !== undefined ? ent.color : 256, rawTrueColor !== 0 ? rawTrueColor : undefined);
            
            // Map thickness/lineweight
            let thickness = 0.25;
            if (ent.thickness !== undefined && typeof ent.thickness === 'number' && ent.thickness > 0) {
                thickness = ent.thickness;
            } else {
                const lw = ent.lineweight !== undefined ? ent.lineweight : (ent.lineWeight !== undefined ? ent.lineWeight : -1);
                thickness = mapLineweight(lw) || 0.25;
            }

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
                            // Anti-radiating-lines filter (use 1e9 to avoid clipping actual sheet borders/grids)
                            const isStart0 = Math.abs(start.x) < 1e-6 && Math.abs(start.y) < 1e-6;
                            const isEnd0 = Math.abs(end.x) < 1e-6 && Math.abs(end.y) < 1e-6;
                            const dist = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
                            if (!isInsideBlock && (isStart0 || isEnd0) && dist > 1e9 && !(isStart0 && isEnd0)) return null;
                            
                            return { id: nextId(), type: 'line', layer, color, x1: start.x, y1: start.y, x2: end.x, y2: end.y, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('CIRCLE'): {
                        const center = ent.center || ent.center_point || ent.position;
                        if (center) {
                            return { id: nextId(), type: 'circle', layer, color, x: center.x, y: center.y, radius: ent.radius || 1, thickness, lineType, lineScale } as any;
                        }
                        break;
                    }
                    case type.includes('ARC'):
                        const arcCenter = ent.center || ent.center_point || ent.position;
                        if (arcCenter) {
                            return { id: nextId(), type: 'arc', layer, color, x: arcCenter.x, y: arcCenter.y, radius: ent.radius || 1, startAngle: ent.startAngle || 0, endAngle: ent.endAngle || Math.PI, counterClockwise: false, thickness, lineType, lineScale } as any;
                        }
                        break;
                    case type.includes('POLYLINE') || type.includes('LWPOLYLINE'): {
                        let vertices = (ent.vertices || ent.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                        if (vertices.length > 2) {
                            let lastNonZero = vertices.length - 1;
                            while (lastNonZero >= 0) {
                                const v = vertices[lastNonZero];
                                if (Math.abs(v.x) > 1e-6 || Math.abs(v.y) > 1e-6) {
                                    break;
                                }
                                lastNonZero--;
                            }
                            vertices = vertices.slice(0, lastNonZero + 2);
                        }
                        if (vertices.length > 1) {
                            return { id: nextId(), type: 'pline', layer, color, points: vertices.map((v: any) => ({ x: v.x, y: v.y, bulge: v.bulge || 0 })), closed: !!(ent.flag & 1) || !!ent.closed || !!ent.isClosed || !!(ent.flags & 1), thickness, lineType, lineScale } as any;
                        }
                        break;
                    }
                    case type.includes('SPLINE'): {
                        let splPoints = (ent.controlPoints || ent.fitPoints || ent.vertices || ent.points || []).filter((v: any) => v && isValid(v.x) && isValid(v.y));
                        if (splPoints.length > 2) {
                            let lastNonZero = splPoints.length - 1;
                            while (lastNonZero >= 0) {
                                const v = splPoints[lastNonZero];
                                if (Math.abs(v.x) > 1e-6 || Math.abs(v.y) > 1e-6) {
                                    break;
                                }
                                lastNonZero--;
                            }
                            splPoints = splPoints.slice(0, lastNonZero + 2);
                        }
                        if (splPoints.length > 1) {
                            return { id: nextId(), type: 'spline', layer, color, points: splPoints.map((v: any) => ({ x: v.x, y: v.y })), closed: !!ent.closed || !!ent.isClosed || !!(ent.flags & 1), thickness, lineType, lineScale } as any;
                        }
                        break;
                    }
                    case type.includes('TEXT') || type.includes('MTEXT') || type.includes('ATTRIB') || type.includes('ATTDEF'):
                        const pos = ent.position || ent.insertPoint || ent.basePoint || ent.insertionPoint || ent.location;
                        if (pos && isValid(pos.x) && isValid(pos.y)) {
                            const rawText = ent.text || ent.content || ent.contents || ent.textString || ent.value || ent.string || '';
                            let text = cleanText(rawText);
                            
                            // Fallback if empty but exists
                            if (text === '') text = '[Text]';

                            let fontFamily = 'standard';
                            const fMatch = rawText.match(/\\f([^;|]+)[;|]/);
                            if (fMatch) fontFamily = fMatch[1];
                            else if (ent.style) fontFamily = ent.style.name || ent.style.id || 'standard';
                            
                            const rawRot = ent.rotation !== undefined ? ent.rotation : 0;
                            const rotation = Math.abs(rawRot) > 2 * Math.PI ? rawRot * Math.PI / 180 : rawRot;
                            const h = ent.height || ent.textHeight || 2.5;
                            const width = ent.width || ent.rectWidth || 0;
                            // Set accurate attachmentPoint based on alignment fields if not explicitly specified
                            let attachmentPoint = ent.attachmentPoint || ent.attachment_point || 1;
                            if (!ent.attachmentPoint && !ent.attachment_point) {
                                const hAlg = ent.halign !== undefined ? ent.halign : (ent.hAlign !== undefined ? ent.hAlign : (ent.horizontalJustification !== undefined ? ent.horizontalJustification : 0));
                                const vAlg = ent.valign !== undefined ? ent.valign : (ent.vAlign !== undefined ? ent.vAlign : (ent.verticalJustification !== undefined ? ent.verticalJustification : 0));
                                if (hAlg === 4) {
                                    attachmentPoint = 5;
                                } else {
                                    const hIndex = (hAlg === 1) ? 2 : (hAlg === 2) ? 3 : 1;
                                    const vIndex = (vAlg === 3) ? 1 : (vAlg === 2) ? 4 : 7;
                                    if (vIndex === 1) attachmentPoint = hIndex;
                                    else if (vIndex === 4) attachmentPoint = 3 + hIndex;
                                    else attachmentPoint = 6 + hIndex;
                                }
                            }
                            
                            return { 
                                id: nextId(), type: (type.includes('MTEXT') || rawText.includes('\\P')) ? 'mtext' : 'text', 
                                layer, color, x: pos.x, y: pos.y, 
                                size: h, height: h, width, attachmentPoint,
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
                        const paths = ent.boundaryPaths || ent.paths || ent.loops || ent.boundary || ent.edges;
                        if (paths && Array.isArray(paths)) {
                            paths.forEach((path: any) => {
                                const pts: Point[] = [];
                                const pVertices = path?.vertices || path?.points || (Array.isArray(path) ? path : null);
                                if (Array.isArray(pVertices)) {
                                    pVertices.forEach((v: any) => {
                                        if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x, y: v.y, bulge: v.bulge });
                                    });
                                } else if (path && typeof path === 'object' && path.edges && Array.isArray(path.edges)) {
                                    path.edges.forEach((edge: any) => {
                                        if (edge.type === 'CircularArc' || edge.center) {
                                            const center = edge.center;
                                            const r = edge.radius || 1;
                                            const sa = edge.startAngle !== undefined ? edge.startAngle : 0;
                                            const ea = edge.endAngle !== undefined ? edge.endAngle : Math.PI * 2;
                                            const finalSa = Math.abs(sa) > 2 * Math.PI ? sa * Math.PI / 180 : sa;
                                            const finalEa = Math.abs(ea) > 2 * Math.PI ? ea * Math.PI / 180 : ea;
                                            const steps = 16;
                                            const diff = finalEa - finalSa;
                                            for (let i = 0; i <= steps; i++) {
                                                const a = finalSa + (i / steps) * diff;
                                                pts.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
                                            }
                                        } else {
                                            if (edge.startPoint && isValid(edge.startPoint.x) && isValid(edge.startPoint.y)) {
                                                pts.push({ x: edge.startPoint.x, y: edge.startPoint.y });
                                            }
                                            if (edge.endPoint && isValid(edge.endPoint.x) && isValid(edge.endPoint.y)) {
                                                pts.push({ x: edge.endPoint.x, y: edge.endPoint.y });
                                            }
                                            if (edge.vertices && Array.isArray(edge.vertices)) {
                                                edge.vertices.forEach((v: any) => {
                                                    if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x, y: v.y });
                                                });
                                            }
                                        }
                                    });
                                }
                                
                                // Remove duplicate consecutive coordinates
                                const cleanPts: Point[] = [];
                                pts.forEach(p => {
                                    if (cleanPts.length === 0) {
                                        cleanPts.push(p);
                                    } else {
                                        const last = cleanPts[cleanPts.length - 1];
                                        const dist = Math.hypot(p.x - last.x, p.y - last.y);
                                        if (dist > 1e-4) cleanPts.push(p);
                                    }
                                });
                                if (cleanPts.length >= 2) loops.push(cleanPts);
                            });
                        }
                        
                        // Fallback: If no loops were detected from boundary paths, check direct points/vertices of the Hatch entity
                        if (loops.length === 0 && ent.points && Array.isArray(ent.points)) {
                            const pts: Point[] = [];
                            ent.points.forEach((v: any) => {
                                if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x, y: v.y });
                            });
                            if (pts.length >= 2) loops.push(pts);
                        }
                        if (loops.length === 0 && ent.vertices && Array.isArray(ent.vertices)) {
                            const pts: Point[] = [];
                            ent.vertices.forEach((v: any) => {
                                if (v && isValid(v.x) && isValid(v.y)) pts.push({ x: v.x, y: v.y });
                            });
                            if (pts.length >= 2) loops.push(pts);
                        }

                        if (loops.length > 0) {
                            return { 
                                id: nextId(), 
                                type: 'hatch', 
                                layer, 
                                color, 
                                points: loops[0], 
                                loops, 
                                pattern: (ent.patternName || 'solid').toLowerCase(), 
                                scale: ent.patternScale || 1, 
                                rotation: ent.patternAngle || 0, 
                                filled: true, 
                                fill: true,
                                lineType,
                                thickness
                            } as any;
                        }
                        break;
                    case type.includes('INSERT') || type.includes('BLOCK'):
                        const insPoint = ent.insertPoint || ent.position || ent.insertionPoint || ent.insertion_point || ent.basePoint || ent.base_point || { x: 0, y: 0 };
                        const bItem = ent.blockName || ent.name || ent.block || ent.blockRecord || ent.block_record || ent.block_record_id || ent.block_record_handle || ent.block_header || ent.block_header_handle || ent.block_header_id || ent.block_id || ent.block_handle;
                        if (insPoint && bItem) {
                            // Extract block name or ID with recursive scan & multiple fallback keys
                            let blockId = '';
                            if (typeof bItem === 'string') {
                                blockId = bItem;
                            } else if (bItem && typeof bItem === 'object') {
                                const blockKeys = ['name', 'blockName', 'block_name', 'typename', 'id', 'handle', 'block_header_name', 'block_record_name'];
                                for (const key of blockKeys) {
                                    if (bItem[key] !== undefined && typeof bItem[key] === 'string' && bItem[key]) {
                                        blockId = bItem[key];
                                        break;
                                    }
                                }
                                if (!blockId && bItem.id !== undefined) {
                                    blockId = String(bItem.id);
                                }
                            }
                            if (!blockId && ent.block_header_name) blockId = String(ent.block_header_name);
                            if (!blockId && ent.block_record_name) blockId = String(ent.block_record_name);
                            if (!blockId && ent.block_id !== undefined) {
                                blockId = String(ent.block_id);
                            }
                            if (!blockId && ent.block_handle !== undefined) {
                                blockId = String(ent.block_handle);
                            }
                            
                            if (blockId) {
                                const scaleX = ent.scale?.x !== undefined ? ent.scale.x : (ent.xScale !== undefined ? ent.xScale : 1);
                                const scaleY = ent.scale?.y !== undefined ? ent.scale.y : (ent.yScale !== undefined ? ent.yScale : 1);
                                const rawRot = ent.rotation || 0;
                                const finalRot = Math.abs(rawRot) > 2 * Math.PI ? rawRot * Math.PI / 180 : rawRot;
                                return { id: nextId(), type: 'block', layer, color, x: insPoint.x, y: insPoint.y, blockId, scaleX, scaleY, scale: scaleX, rotation: finalRot, name: blockId, blockDefinition: ent.blockDefinition || ent.block || null } as any;
                            }
                        }
                        break;
                    case type.includes('DIMENSION') || type.includes('DIM'): {
                        const measurement = ent.measurement !== undefined ? ent.measurement : 0;
                        const rawDimText = ent.text || ent.content || ent.textString || '';
                        let formattedDimText = '';
                        
                        if (!rawDimText || rawDimText === '' || rawDimText === '<>') {
                            formattedDimText = measurement.toFixed(2);
                        } else {
                            formattedDimText = cleanText(rawDimText.replace('<>', measurement.toFixed(2)));
                        }

                        // Extract points common to many dimension types with maximum fallback protection
                        const d1 = ent.definitionPoint || ent.defPoint || ent.def_point || ent.extLine1 || ent.ext_line1 || ent.point1;
                        const d2 = ent.definitionPoint2 || ent.defPoint2 || ent.def_point2 || ent.defPoint_2 || ent.def_point_2 || ent.extLine2 || ent.ext_line2 || ent.point2;
                        const d3 = ent.definitionPoint3 || ent.defPoint3 || ent.def_point3 || ent.defPoint_3 || ent.def_point_3 || ent.dimLinePoint || ent.dim_line_point || ent.position || ent.point3;
                        const d4 = ent.definitionPoint4 || ent.defPoint4 || ent.def_point4 || ent.defPoint_4 || ent.def_point_4 || ent.point4;
                        const center = ent.center || ent.arcCenter || ent.arc_center || ent.centerPoint || ent.center_point;
                        
                        // Fallbacks for dimension points
                        const x1 = (d1?.x ?? 0), y1 = (d1?.y ?? 0);
                        const x2 = (d2?.x ?? (ent.insertionPoint?.x ?? x1)), y2 = (d2?.y ?? (ent.insertionPoint?.y ?? y1));
                        const x3 = (d3?.x ?? x1), y3 = (d3?.y ?? y1);
                        const x4 = (d4?.x ?? x2), y4 = (d4?.y ?? y2);
                        const cx = (center?.x ?? 0), cy = (center?.y ?? 0);

                        const dimX = (d3?.x ?? (ent.textPosition?.x ?? (ent.text_position?.x ?? (ent.textPoint?.x ?? (ent.text_point?.x ?? (x1 + x2)/2)))));
                        const dimY = (d3?.y ?? (ent.textPosition?.y ?? (ent.text_position?.y ?? (ent.textPoint?.y ?? (ent.text_point?.y ?? (y1 + y2)/2)))));

                        // Detect dimension type
                        let dimType: any = 'aligned';
                        const dimFlags = ent.dimensionType !== undefined ? ent.dimensionType : (ent.dimType !== undefined ? ent.dimType : (ent.dim_type !== undefined ? ent.dim_type : 0));
                        const actualType = (dimFlags & 0x07); // Lower 3 bits often hold the type

                        if (type.includes('RADIUS') || type.includes('RAD') || actualType === 4) dimType = 'radius';
                        else if (type.includes('DIAMETER') || type.includes('DIA') || actualType === 3) dimType = 'diameter';
                        else if (type.includes('ANGULAR') || type.includes('ANG') || actualType === 2 || actualType === 5) dimType = 'angular';
                        else if (type.includes('ORD_DIM') || type.includes('ORD') || actualType === 6) dimType = 'ordinate';
                        else if (type.includes('ARC') || actualType === 0x40) dimType = 'arc';
                        else if (type.includes('LINEAR') || type.includes('ROT') || actualType === 0) dimType = 'linear';
                        else dimType = 'aligned';
                        
                        const dimH = ent.height || ent.textHeight || ent.text_height || 2.5;
                        
                        let angle1 = ent.startAngle || ent.start_angle || 0;
                        let angle2 = ent.endAngle || ent.end_angle || 0;
                        
                        if (dimType === 'angular' || dimType === 'arc') {
                            // If angles aren't provided directly, calculate from definition points relative to center
                            if (ent.angle1 !== undefined) angle1 = ent.angle1;
                            else if (x1 !== cx || y1 !== cy) angle1 = Math.atan2(y1 - cy, x1 - cx);
                            
                            if (ent.angle2 !== undefined) angle2 = ent.angle2;
                            else if (x2 !== cx || y2 !== cy) angle2 = Math.atan2(y2 - cy, x2 - cx);
                        }

                        const dimRot = ent.rotation || 0;
                        const finalDimRot = Math.abs(dimRot) > 2 * Math.PI ? dimRot * Math.PI / 180 : dimRot;
                        return { 
                            id: nextId(), type: 'dimension', dimType, 
                            layer, color, 
                            x1, y1, x2, y2, x3, y3, x4, y4, cx, cy,
                            angle1, angle2,
                            dimX, dimY,
                            text: formattedDimText,
                            size: dimH, height: dimH,
                            rotation: finalDimRot,
                            thickness, lineType, lineScale
                        } as any;
                    }
                }
            } catch (err) {
                console.warn(`Extraction error for ${type}:`, err);
                stats.unsupported++;
            }

            if (!['POINT', 'VERTEX', 'SEQEND'].includes(type)) {
                stats.unsupported++;
            }
            return null;
        };

        // Layers Setup
        layers['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
        
        const processLayer = (l: any) => {
            if (!l) return;
            let name = typeof l.name === 'string' ? l.name : (l.layerName || l.layer_name || String(l.id || '0'));
            
            // Normalize special AutoCAD layers
            const lowerName = name.toLowerCase();
            if (lowerName === 'defpoints') name = 'defpoints';
            if (name === '0' || lowerName === '0') name = '0';

            // Extract ACI color - try multiple variants as provided by WASM
            const aci = l.color !== undefined ? l.color : 
                        (l.aci !== undefined ? l.aci : 
                        (l.color_index !== undefined ? l.color_index : 
                        (l.colorIndex !== undefined ? l.colorIndex : 7)));
            
            const rawLayerTrueColor = l.true_color || l.trueColor || l.truecolor || 0;
            const lColor = aciToHex(Math.abs(aci), rawLayerTrueColor !== 0 ? rawLayerTrueColor : undefined);

            if (name === '0' && layers['0']) {
                layers['0'].color = lColor;
                return;
            }
            
            const flag = l.flag !== undefined ? l.flag : (l.flags !== undefined ? l.flags : (l.status || 0));
            
            // Standard CAD Layer flags: 1=Frozen, 2=Frozen by default, 4=Locked
            const lineTypeVal = (l.lineType || l.linetype || l.linestyle || l.line_type || 'continuous');
            const layerLineTypeStr = typeof lineTypeVal === 'string' ? lineTypeVal : (lineTypeVal?.name || lineTypeVal?.id || 'continuous');
            
            layers[name] = { 
                id: name, 
                name: name, 
                visible: aci >= 0 && !(flag & 1),
                locked: !!(flag & 4), 
                frozen: !!(flag & 1), 
                plottable: name.toLowerCase() !== 'defpoints' && (l.is_plottable !== false && l.plot !== false && l.isPlottable !== false), 
                color: lColor, 
                thickness: mapLineweight(l.lineweight !== undefined ? l.lineweight : (l.lineWeight !== undefined ? l.lineWeight : l.lineweight_enum)) || 0.25, 
                lineType: layerLineTypeStr.toLowerCase() as any 
            };
        };
        
        const rawLayersList = db.layers || db.layer_records || db.layerRecords || db.layer || [];
        if (rawLayersList && Array.isArray(rawLayersList)) {
            const numLayers = rawLayersList.length;
            for (let i = 0; i < numLayers; i++) {
                if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
                processLayer(rawLayersList[i]);
            }
        } else if (rawLayersList && typeof rawLayersList === 'object') {
            Object.values(rawLayersList).forEach(processLayer);
        }

        // Blocks Setup
        const rawBlocks = db.blocks || db.block_records || db.blockRecords || db.block_headers || db.blockHeaders || [];
        if (rawBlocks) {
            const processBlockItem = (b: any, index: number) => {
                if (!b) return;
                let name = b.name || b.id || b.blockName || b.block_name || b.block_record_name;
                if (!name && b.block_header) {
                    name = b.block_header.name || b.block_header.id || b.block_header.handle;
                }
                if (!name && b.block_record) {
                    name = b.block_record.name || b.block_record.id || b.block_record.handle;
                }
                if (typeof name !== 'string') {
                    name = String(index);
                }
                if (name) {
                    const bEntities = b.entities || b.objects || b.shapes || [];
                    const blockShapes: Shape[] = [];
                    if (Array.isArray(bEntities)) {
                        bEntities.forEach((be: any) => {
                            const s = convertEntity(be, true);
                            if (s) blockShapes.push(s);
                        });
                    }
                    const bp = b.basePoint || b.base_point || b.position || b.insertionPoint || b.insertion_point || { x: 0, y: 0 };
                    const blockDef = { id: name, name: name, basePoint: { x: bp.x || 0, y: bp.y || 0 }, shapes: blockShapes };
                    
                    // Store block under multiple keys for resilient lookup
                    blocks[name] = blockDef;
                    blocks[name.toLowerCase().trim()] = blockDef;

                    // Also store by handle/ID if it exists to allow lookups by numeric reference
                    if (b.id && String(b.id) !== name) {
                        blocks[String(b.id)] = blockDef;
                        blocks[String(b.id).toLowerCase().trim()] = blockDef;
                    }
                    if (b.handle && String(b.handle) !== name) {
                        blocks[String(b.handle)] = blockDef;
                        blocks[String(b.handle).toLowerCase().trim()] = blockDef;
                    }
                    if (b.block_record_handle && String(b.block_record_handle) !== name) {
                        blocks[String(b.block_record_handle)] = blockDef;
                    }
                    if (b.block_header_handle && String(b.block_header_handle) !== name) {
                        blocks[String(b.block_header_handle)] = blockDef;
                    }
                }
            };

            if (Array.isArray(rawBlocks)) {
                const numRawBlocks = rawBlocks.length;
                for (let i = 0; i < numRawBlocks; i++) {
                    if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
                    processBlockItem(rawBlocks[i], i);
                }
            } else {
                const bKeys = Object.keys(rawBlocks);
                for (let i = 0; i < bKeys.length; i++) {
                    if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
                    processBlockItem(rawBlocks[bKeys[i]], i);
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

/**
 * Parses a DWG file or ArrayBuffer and returns the imported shapes.
 */
export const parseDwg = async (file: File | ArrayBuffer, defaultSettings?: AppSettings): Promise<Shape[]> => {
    let buffer: ArrayBuffer;
    if (file instanceof File) {
        buffer = await file.arrayBuffer();
    } else {
        buffer = file;
    }
    const safeSettings = defaultSettings || {
        limitsMin: { x: -10000, y: -10000 },
        limitsMax: { x: 10000, y: 10000 },
        drawingScale: 1.0,
        activeLayer: '0',
        activeColor: 'BYLAYER',
        activeLineType: 'bylayer',
        activeDimStyle: 'default',
        dimStyles: {},
        unit: 'mm' as const,
        grid: true,
        snap: true,
        ortho: false,
        polar: false,
        osnapMode: 1,
        polarAngle: 15,
        metadata: {},
        ctbFile: undefined
    };
    const proj = await dwgToProject(buffer, safeSettings as any as AppSettings);
    return proj.entities;
};

export const DwgService = {
    dwgToProject,
    parseDwg,
    sniffDwgHeader,
    initDwgService
};

export default DwgService;

