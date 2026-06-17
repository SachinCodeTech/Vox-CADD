import { 
  Shape, LayerConfig, AppSettings, LineShape, CircleShape, RectShape, PolyShape, 
  ArcShape, TextShape, MTextShape, EllipseShape, PointShape, DimensionShape, 
  InfiniteLineShape, DoubleLineShape, VoxProject, BlockDefinition, LineTypeDefinition, 
  TextStyleDefinition, ProjectMetadata, LayoutDefinition, LeaderShape, BlockShape, 
  HatchShape, DonutShape
} from '../types';
import { generateId, getAllShapesBounds, calculateShapeLength } from './cadService';

// Binary Type Map Configurations for CAD Entity Packs
const SHAPE_TYPE_TO_ID: Record<string, number> = {
  'line': 1,
  'circle': 2,
  'rect': 3,
  'pline': 4,
  'polygon': 5,
  'arc': 6,
  'text': 7,
  'mtext': 8,
  'ellipse': 9,
  'point': 10,
  'dimension': 11,
  'ray': 12,
  'xline': 13,
  'dline': 14,
  'leader': 15,
  'block': 16,
  'hatch': 17,
  'donut': 18
};

const SHAPE_ID_TO_TYPE: Record<number, string> = {
  1: 'line',
  2: 'circle',
  3: 'rect',
  4: 'pline',
  5: 'polygon',
  6: 'arc',
  7: 'text',
  8: 'mtext',
  9: 'ellipse',
  10: 'point',
  11: 'dimension',
  12: 'ray',
  13: 'xline',
  14: 'dline',
  15: 'leader',
  16: 'block',
  17: 'hatch',
  18: 'donut'
};

/**
 * Creates a standard empty VOX project skeleton.
 */
export const createEmptyVoxProject = (settings: AppSettings): VoxProject => {
  const defaultLayers: Record<string, LayerConfig> = { 
    '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
    'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' },
    
    // Standard User-specified layers
    'WALL': { id: 'WALL', name: 'WALL', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.30, lineType: 'continuous' },
    'DOOR': { id: 'DOOR', name: 'DOOR', visible: true, locked: false, frozen: false, plottable: true, color: '#4CAF50', thickness: 0.20, lineType: 'continuous' },
    'WINDOW': { id: 'WINDOW', name: 'WINDOW', visible: true, locked: false, frozen: false, plottable: true, color: '#00BCD4', thickness: 0.20, lineType: 'continuous' },
    'COLUMN': { id: 'COLUMN', name: 'COLUMN', visible: true, locked: false, frozen: false, plottable: true, color: '#FF00FF', thickness: 0.35, lineType: 'continuous' },
    'BEAM_CENTER': { id: 'BEAM_CENTER', name: 'BEAM_CENTER', visible: true, locked: false, frozen: false, plottable: true, color: '#F44336', thickness: 0.18, lineType: 'dashed' },
    'DIMENSION': { id: 'DIMENSION', name: 'DIMENSION', visible: true, locked: false, frozen: false, plottable: true, color: '#FFEB3B', thickness: 0.15, lineType: 'continuous' },
    'TEXT': { id: 'TEXT', name: 'TEXT', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.18, lineType: 'continuous' },
    'GRID': { id: 'GRID', name: 'GRID', visible: true, locked: false, frozen: false, plottable: true, color: '#607D8B', thickness: 0.15, lineType: 'continuous' },
    'FURNITURE': { id: 'FURNITURE', name: 'FURNITURE', visible: true, locked: false, frozen: false, plottable: true, color: '#81C784', thickness: 0.15, lineType: 'continuous' },

    // A- prefixed legacy/alternate standard layers
    'A-WALL': { id: 'A-WALL', name: 'A-WALL', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.30, lineType: 'continuous' },
    'A-WALL-INT': { id: 'A-WALL-INT', name: 'A-WALL-INT', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.25, lineType: 'continuous' },
    'A-DOOR': { id: 'A-DOOR', name: 'A-DOOR', visible: true, locked: false, frozen: false, plottable: true, color: '#4CAF50', thickness: 0.20, lineType: 'continuous' },
    'A-WINDOW': { id: 'A-WINDOW', name: 'A-WINDOW', visible: true, locked: false, frozen: false, plottable: true, color: '#00BCD4', thickness: 0.20, lineType: 'continuous' },
    'A-COLS': { id: 'A-COLS', name: 'A-COLS', visible: true, locked: false, frozen: false, plottable: true, color: '#FF00FF', thickness: 0.35, lineType: 'continuous' },
    'A-BEAMS': { id: 'A-BEAMS', name: 'A-BEAMS', visible: true, locked: false, frozen: false, plottable: true, color: '#F44336', thickness: 0.18, lineType: 'dashed' },
    'A-DIM': { id: 'A-DIM', name: 'A-DIM', visible: true, locked: false, frozen: false, plottable: true, color: '#FFEB3B', thickness: 0.15, lineType: 'continuous' },
    'A-TEXT': { id: 'A-TEXT', name: 'A-TEXT', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.18, lineType: 'continuous' },
    'A-GRID': { id: 'A-GRID', name: 'A-GRID', visible: true, locked: false, frozen: false, plottable: true, color: '#607D8B', thickness: 0.15, lineType: 'continuous' },
    'A-FURN': { id: 'A-FURN', name: 'A-FURN', visible: true, locked: false, frozen: false, plottable: true, color: '#81C784', thickness: 0.15, lineType: 'continuous' }
  };

  const project: VoxProject = {
    version: "2.1", 
    meta: {
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      author: settings.metadata?.author || "VoxCADD Designer",
      description: settings.metadata?.description || "CAD Drafting Model",
      revision: settings.metadata?.revision || "REV-01",
      projectRevision: settings.metadata?.projectRevision || "V-1.0"
    },
    settings,
    layers: defaultLayers,
    lineTypes: {},
    textStyles: {},
    blocks: {},
    entities: [],
    layouts: {},
    bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
  };

  project.stats = calculateVoxProjectStats(project);
  return project;
};

/**
 * Sanitizes coordinate entries, guaranteeing finite numbers.
 */
const sanitizeCoordinate = (val: any, fallback = 0): number => {
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return fallback;
    return val;
  }
  const num = parseFloat(val);
  return (isNaN(num) || !isFinite(num)) ? fallback : num;
};

/**
 * Fully sanitizes, normalizes, and precision-rounds a shape's drawing elements.
 * Rounds to 5 decimal places to remove floating noise & compress file size.
 */
export const sanitizeShape = (s: Shape): Shape => {
  const base = {
    id: s.id || generateId(),
    layer: s.layer || "0",
    color: s.color || "#FFFFFF",
    thickness: typeof s.thickness === 'number' ? s.thickness : 1,
    lineType: s.lineType || "continuous",
    opacity: s.opacity !== undefined ? sanitizeCoordinate(s.opacity, 1) : 1,
    filled: !!s.filled,
    lineScale: s.lineScale !== undefined ? sanitizeCoordinate(s.lineScale, 1) : 1,
  };

  const r = (n: any, fallback = 0) => {
    const raw = sanitizeCoordinate(n, fallback);
    return Math.round(raw * 100000) / 100000;
  };

  switch (s.type) {
    case 'line': {
      const ls = s as LineShape;
      return { ...base, type: 'line', x1: r(ls.x1), y1: r(ls.y1), x2: r(ls.x2), y2: r(ls.y2), arrowStart: !!ls.arrowStart, arrowEnd: !!ls.arrowEnd } as any;
    }
    case 'circle': {
      const cs = s as CircleShape;
      return { ...base, type: 'circle', x: r(cs.x), y: r(cs.y), radius: Math.max(0.0001, r(cs.radius, 1)) } as any;
    }
    case 'rect': {
      const rs = s as RectShape;
      return { ...base, type: 'rect', x: r(rs.x), y: r(rs.y), width: r(rs.width, 1), height: r(rs.height, 1), rotation: r((rs as any).rotation || 0) } as any;
    }
    case 'pline': {
      const ps = s as PolyShape;
      const points = (ps.points || []).map(p => ({ x: r(p.x), y: r(p.y), bulge: r(p.bulge || 0) }));
      return { ...base, type: 'pline', points, closed: !!ps.closed } as any;
    }
    case 'polygon': {
      const ps = s as PolyShape;
      const points = (ps.points || []).map(p => ({ x: r(p.x), y: r(p.y), bulge: r(p.bulge || 0) }));
      return { ...base, type: 'polygon', points, closed: true } as any;
    }
    case 'arc': {
      const as = s as ArcShape;
      return { ...base, type: 'arc', x: r(as.x), y: r(as.y), radius: Math.max(0.0001, r(as.radius, 1)), startAngle: r(as.startAngle), endAngle: r(as.endAngle), counterClockwise: !!as.counterClockwise } as any;
    }
    case 'text': {
      const ts = s as TextShape;
      return { ...base, type: 'text', x: r(ts.x), y: r(ts.y), content: ts.content || '', size: Math.max(0.1, r(ts.size, 10)), rotation: r(ts.rotation) } as any;
    }
    case 'mtext': {
      const ms = s as MTextShape;
      return { ...base, type: 'mtext', x: r(ms.x), y: r(ms.y), content: ms.content || '', size: Math.max(0.1, r(ms.size, 10)), width: Math.max(0.1, r(ms.width, 100)), rotation: r(ms.rotation || 0) } as any;
    }
    case 'ellipse': {
      const es = s as EllipseShape;
      return { ...base, type: 'ellipse', x: r(es.x), y: r(es.y), rx: Math.max(0.0001, r(es.rx, 1)), ry: Math.max(0.0001, r(es.ry, 1)), rotation: r(es.rotation || 0) } as any;
    }
    case 'point': {
      const pts = s as PointShape;
      return { ...base, type: 'point', x: r(pts.x), y: r(pts.y), size: Math.max(0.1, r(pts.size, 2)) } as any;
    }
    case 'dimension': {
      const ds = s as DimensionShape;
      return { 
        ...base, 
        type: 'dimension', 
        x1: r(ds.x1), 
        y1: r(ds.y1), 
        x2: r(ds.x2), 
        y2: r(ds.y2), 
        dimX: r(ds.dimX), 
        dimY: r(ds.dimY), 
        text: ds.text || '',
        dimType: ds.dimType || 'linear'
      } as any;
    }
    case 'ray':
    case 'xline': {
      const inf = s as InfiniteLineShape;
      return { ...base, type: s.type, x1: r(inf.x1), y1: r(inf.y1), x2: r(inf.x2, 1), y2: r(inf.y2, 0) } as any;
    }
    case 'dline': {
      const dls = s as DoubleLineShape;
      const points = (dls.points || []).map(p => ({ x: r(p.x), y: r(p.y) }));
      return { ...base, type: 'dline', points, thickness: Math.max(0.1, r(dls.thickness, 5)), justification: dls.justification || 'center' } as any;
    }
    case 'leader': {
      const ls = s as LeaderShape;
      return { ...base, type: 'leader', x1: r(ls.x1), y1: r(ls.y1), x2: r(ls.x2), y2: r(ls.y2), text: ls.text || '', size: r(ls.size, 2), arrowType: ls.arrowType || 'closed' } as any;
    }
    case 'block': {
      const bs = s as BlockShape;
      return { ...base, type: 'block', blockId: bs.blockId, x: r(bs.x), y: r(bs.y), scaleX: r(bs.scaleX, 1), scaleY: r(bs.scaleY, 1), rotation: r(bs.rotation || 0) } as any;
    }
    case 'hatch': {
      const hs = s as HatchShape;
      const points = (hs.points || []).map(p => ({ x: r(p.x), y: r(p.y) }));
      return { ...base, type: 'hatch', pattern: hs.pattern || 'solid', scale: r(hs.scale, 1), rotation: r(hs.rotation || 0), points } as any;
    }
    case 'donut': {
      const ds = s as DonutShape;
      return { ...base, type: 'donut', x: r(ds.x), y: r(ds.y), innerRadius: r(ds.innerRadius, 1), outerRadius: r(ds.outerRadius, 2) } as any;
    }
    default:
      return { ...base, ...s, type: s.type.toLowerCase() } as any;
  }
};

/**
 * Computes deep and complete project diagnostic analytics and metrics.
 */
export const calculateVoxProjectStats = (project: Partial<VoxProject>): any => {
  const shapes = project.entities || [];
  const layers = project.layers || {};
  
  const counts: Record<string, number> = {};
  const layerUsage: Record<string, number> = {};
  let totalLength = 0;
  let invisibleCount = 0;

  // Initialize all configured layers to 0 shapes
  Object.keys(layers).forEach(layerId => {
    layerUsage[layerId] = 0;
  });

  shapes.forEach(s => {
    const type = s.type || 'unknown';
    counts[type] = (counts[type] || 0) + 1;

    const layer = s.layer || '0';
    layerUsage[layer] = (layerUsage[layer] || 0) + 1;

    // Visual segment metric calculations
    if (['line', 'circle', 'rect', 'pline', 'polygon', 'arc', 'ellipse', 'dline'].includes(type)) {
      totalLength += calculateShapeLength(s);
    }

    let isGhost = false;
    if (type === 'line') {
      const ls = s as LineShape;
      if (ls.x1 === ls.x2 && ls.y1 === ls.y2) isGhost = true;
    } else if (type === 'circle') {
      const cs = s as CircleShape;
      if (cs.radius <= 0.001) isGhost = true;
    } else if (type === 'text' || type === 'mtext') {
      const ts = s as any;
      if (!ts.content || ts.content.trim() === '') isGhost = true;
    } else if (type === 'pline' || type === 'polygon' || type === 'dline') {
      const ps = s as any;
      if (!ps.points || ps.points.length <= 1) isGhost = true;
    }
    if (isGhost) invisibleCount++;
  });

  const unusedLayers = Object.keys(layerUsage).filter(layerId => layerUsage[layerId] === 0);

  // Advanced Stats calculations
  let totalWallLength = 0;
  let furnitureBlocksCount = 0;
  const furnitureBlockCounts: Record<string, number> = {};
  const furnitureKeywords = ['chair', 'table', 'tbl', 'desk', 'bed', 'sofa', 'furniture', 'furn', 'sink', 'toilet', 'tub', 'couch', 'chair', 'seat', 'armchair', 'stool'];

  shapes.forEach(s => {
    const type = s.type || '';
    const layerUpper = (s.layer || '').toUpperCase();
    const isWallLayer = layerUpper.includes('WALL') || layerUpper.includes('SECT');
    
    // Total Wall segment length (dline elements or lines/plines on Wall layers)
    if (type === 'dline') {
      totalWallLength += calculateShapeLength(s);
    } else if (isWallLayer && ['line', 'pline', 'polygon'].includes(type)) {
      totalWallLength += calculateShapeLength(s);
    }

    // Furniture block definition counts
    if (type === 'block') {
      const isFurnLayer = layerUpper.includes('FURN');
      const blockIdUpper = ((s as any).blockId || '').toUpperCase();
      const isFurnKeyword = furnitureKeywords.some(kw => blockIdUpper.includes(kw.toUpperCase()));
      if (isFurnLayer || isFurnKeyword) {
        furnitureBlocksCount++;
        const blockName = (s as any).blockId || 'Furniture Component';
        furnitureBlockCounts[blockName] = (furnitureBlockCounts[blockName] || 0) + 1;
      }
    }
  });

  return {
    total: shapes.length,
    unsupported: counts['unknown'] || 0,
    counts,
    layerUsage,
    unusedLayers,
    invisibleCount,
    totalLength: Math.round(totalLength * 100) / 100,
    estimatedSizeKB: "0 KB",
    advancedStats: {
      layerCounts: layerUsage,
      totalWallLength: Math.round(totalWallLength * 100) / 100,
      furnitureBlocksCount,
      furnitureBlockCounts
    }
  };
};

/**
 * Compact Binary Serializer for VoxProjects to improve network and export payloads.
 */
class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  constructor(initialSize = 1024 * 32) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  private ensureCapacity(bytesNeeded: number) {
    if (this.offset + bytesNeeded > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.offset + bytesNeeded);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }

  writeUint8(val: number) {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, val);
    this.offset += 1;
  }

  writeUint16(val: number) {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, val, true);
    this.offset += 2;
  }

  writeUint32(val: number) {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, val, true);
    this.offset += 4;
  }

  writeFloat32(val: number) {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, val, true);
    this.offset += 4;
  }

  writeString(str: string) {
    const utf8 = new TextEncoder().encode(str);
    this.writeUint16(utf8.length);
    this.ensureCapacity(utf8.length);
    new Uint8Array(this.buffer).set(utf8, this.offset);
    this.offset += utf8.length;
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }
}

/**
 * Compact Binary Deserializer for VoxProjects.
 */
class BinaryReader {
  private view: DataView;
  private bytes: Uint8Array;
  private offset: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.offset = 0;
  }

  readUint8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readUint16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFloat32(): number {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readString(): string {
    const len = this.readUint16();
    const sub = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return new TextDecoder().decode(sub);
  }
}

/**
 * Increment revision number (e.g., REV-01 -> REV-02) and append a timestamp.
 */
export const incrementProjectRevision = (metadata: ProjectMetadata | undefined): ProjectMetadata => {
  const currentMeta = metadata || { createdAt: new Date().toISOString(), lastModified: new Date().toISOString() };
  
  const prevRevision = currentMeta.revision || 'REV-00';
  // Match number in formats like "REV-01", "REV-02", "V-1.0", "3", etc.
  const match = prevRevision.match(/REV-(\d+)/i) || prevRevision.match(/REV\s*(\d+)/i) || prevRevision.match(/(\d+)/);
  let revNum = 0;
  if (match) {
    revNum = parseInt(match[1] || match[0], 10);
  }
  
  const nextRev = revNum + 1;
  const pad = nextRev < 10 ? '0' + nextRev : String(nextRev);
  
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestampStr = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  
  return {
    ...currentMeta,
    revision: `REV-${pad} (${timestampStr})`,
    lastModified: now.toISOString()
  };
};

/**
 * Serializes the whole drawing into .vox binary or string.
 */
export const shapesToVox = (
  shapes: Shape[], 
  layers: Record<string, LayerConfig>, 
  settings: AppSettings,
  lineTypes: Record<string, LineTypeDefinition>,
  blocks?: Record<string, BlockDefinition>,
  layouts?: Record<string, LayoutDefinition> | LayoutDefinition[],
  options?: { minify?: boolean; binary?: boolean }
): string | Uint8Array => {
  const sanitizedEntities = shapes.map(s => sanitizeShape(s));
  const bounds = getAllShapesBounds(sanitizedEntities, blocks);

  // Auto-increment the revision counter on save/serialization
  const updatedMeta = incrementProjectRevision(settings.metadata);
  if (settings.metadata) {
    settings.metadata.revision = updatedMeta.revision;
    settings.metadata.lastModified = updatedMeta.lastModified;
  } else {
    settings.metadata = updatedMeta;
  }
  
  let layoutsRecord: Record<string, LayoutDefinition> = {};
  if (layouts) {
    if (Array.isArray(layouts)) {
      layouts.forEach(l => {
        layoutsRecord[l.id] = l;
      });
    } else {
      layoutsRecord = layouts;
    }
  }

  const finalLayers = { ...layers };
  sanitizedEntities.forEach(s => {
    const l = s.layer || '0';
    if (!finalLayers[l]) {
      finalLayers[l] = {
        id: l,
        name: l,
        visible: true,
        locked: false,
        frozen: false,
        plottable: l.toLowerCase() !== 'defpoints',
        color: '#FFFFFF',
        thickness: 0.25,
        lineType: 'continuous'
      };
    }
  });
  
  const vox: VoxProject = {
    version: "2.1",
    meta: {
      author: settings.metadata?.author || "VoxCADD Designer",
      createdAt: settings.metadata?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      description: settings.metadata?.description,
      revision: settings.metadata?.revision || "REV-01",
      projectRevision: settings.metadata?.projectRevision || "V-1.0"
    },
    settings,
    layers: finalLayers,
    lineTypes, 
    textStyles: {}, 
    blocks: blocks || {},
    entities: sanitizedEntities,
    layouts: layoutsRecord, 
    bounds: bounds || { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
  };

  const stats = calculateVoxProjectStats(vox);
  vox.stats = stats;

  const forceBinary = options?.binary !== false; // Enable optimized binary packing by default
  
  if (forceBinary) {
    const writer = new BinaryWriter();
    // File signature: "VOXB" (4 bytes)
    writer.writeUint8(0x56);
    writer.writeUint8(0x4F);
    writer.writeUint8(0x53);
    writer.writeUint8(0x42);

    // Version: 210 (represents 2.1)
    writer.writeUint16(210);

    // Pack non-entity metadata and config records into JSON block
    const metaConfig = {
      meta: vox.meta,
      settings: vox.settings,
      layers: vox.layers,
      lineTypes: vox.lineTypes,
      textStyles: vox.textStyles,
      blocks: vox.blocks,
      layouts: vox.layouts
    };
    writer.writeString(JSON.stringify(metaConfig));

    // Pack Entities
    writer.writeUint32(sanitizedEntities.length);
    sanitizedEntities.forEach(s => {
      const typeId = SHAPE_TYPE_TO_ID[s.type] || 1;
      writer.writeUint8(typeId);
      
      // Base Properties
      writer.writeString(s.id);
      writer.writeString(s.layer);
      writer.writeString(s.color || '#FFFFFF');
      writer.writeFloat32(typeof s.thickness === 'number' ? s.thickness : parseFloat(s.thickness as any) || 0.25);
      writer.writeString(s.lineType || 'continuous');
      writer.writeFloat32(s.opacity !== undefined ? s.opacity : 1);
      writer.writeUint8(s.filled ? 1 : 0);
      writer.writeFloat32(s.lineScale !== undefined ? s.lineScale : 1);

      // Coordinates according to shape ID
      switch (s.type) {
        case 'line': {
          const ls = s as LineShape;
          writer.writeFloat32(ls.x1);
          writer.writeFloat32(ls.y1);
          writer.writeFloat32(ls.x2);
          writer.writeFloat32(ls.y2);
          writer.writeUint8(ls.arrowStart ? 1 : 0);
          writer.writeUint8(ls.arrowEnd ? 1 : 0);
          break;
        }
        case 'circle': {
          const cs = s as CircleShape;
          writer.writeFloat32(cs.x);
          writer.writeFloat32(cs.y);
          writer.writeFloat32(cs.radius);
          break;
        }
        case 'rect': {
          const rs = s as RectShape;
          writer.writeFloat32(rs.x);
          writer.writeFloat32(rs.y);
          writer.writeFloat32(rs.width);
          writer.writeFloat32(rs.height);
          writer.writeFloat32((rs as any).rotation || 0);
          break;
        }
        case 'pline':
        case 'polygon': {
          const ps = s as PolyShape;
          writer.writeUint8(ps.closed ? 1 : 0);
          writer.writeUint32(ps.points.length);
          ps.points.forEach(p => {
            writer.writeFloat32(p.x);
            writer.writeFloat32(p.y);
            writer.writeFloat32(p.bulge || 0);
          });
          break;
        }
        case 'arc': {
          const as = s as ArcShape;
          writer.writeFloat32(as.x);
          writer.writeFloat32(as.y);
          writer.writeFloat32(as.radius);
          writer.writeFloat32(as.startAngle);
          writer.writeFloat32(as.endAngle);
          writer.writeUint8(as.counterClockwise ? 1 : 0);
          break;
        }
        case 'text': {
          const ts = s as TextShape;
          writer.writeFloat32(ts.x);
          writer.writeFloat32(ts.y);
          writer.writeFloat32(ts.size);
          writer.writeFloat32(ts.rotation || 0);
          writer.writeString(ts.content || '');
          writer.writeString(ts.justification || 'left');
          writer.writeUint8((ts.bold ? 1 : 0) | (ts.italic ? 2 : 0) | (ts.underline ? 4 : 0));
          break;
        }
        case 'mtext': {
          const ms = s as MTextShape;
          writer.writeFloat32(ms.x);
          writer.writeFloat32(ms.y);
          writer.writeFloat32(ms.size);
          writer.writeFloat32(ms.width);
          writer.writeFloat32(ms.rotation || 0);
          writer.writeString(ms.content || '');
          writer.writeString(ms.justification || 'left');
          writer.writeUint8((ms.bold ? 1 : 0) | (ms.italic ? 2 : 0) | (ms.underline ? 4 : 0));
          break;
        }
        case 'ellipse': {
          const es = s as EllipseShape;
          writer.writeFloat32(es.x);
          writer.writeFloat32(es.y);
          writer.writeFloat32(es.rx);
          writer.writeFloat32(es.ry);
          writer.writeFloat32(es.rotation || 0);
          break;
        }
        case 'point': {
          const pts = s as PointShape;
          writer.writeFloat32(pts.x);
          writer.writeFloat32(pts.y);
          writer.writeFloat32(pts.size);
          break;
        }
        case 'dimension': {
          const ds = s as DimensionShape;
          writer.writeFloat32(ds.x1);
          writer.writeFloat32(ds.y1);
          writer.writeFloat32(ds.x2);
          writer.writeFloat32(ds.y2);
          writer.writeFloat32(ds.dimX);
          writer.writeFloat32(ds.dimY);
          writer.writeString(ds.text || '');
          writer.writeString(ds.dimType || 'linear');
          break;
        }
        case 'ray':
        case 'xline': {
          const inf = s as InfiniteLineShape;
          writer.writeFloat32(inf.x1);
          writer.writeFloat32(inf.y1);
          writer.writeFloat32(inf.x2);
          writer.writeFloat32(inf.y2);
          break;
        }
        case 'dline': {
          const dls = s as DoubleLineShape;
          writer.writeFloat32(dls.thickness);
          writer.writeString(dls.justification || 'center');
          writer.writeUint32(dls.points.length);
          dls.points.forEach(p => {
            writer.writeFloat32(p.x);
            writer.writeFloat32(p.y);
          });
          break;
        }
        case 'leader': {
          const ls = s as LeaderShape;
          writer.writeFloat32(ls.x1);
          writer.writeFloat32(ls.y1);
          writer.writeFloat32(ls.x2);
          writer.writeFloat32(ls.y2);
          writer.writeString(ls.text || '');
          writer.writeFloat32(ls.size || 2);
          writer.writeString(ls.arrowType || 'closed');
          break;
        }
        case 'block': {
          const bs = s as BlockShape;
          writer.writeString(bs.blockId);
          writer.writeFloat32(bs.x);
          writer.writeFloat32(bs.y);
          writer.writeFloat32(bs.scaleX);
          writer.writeFloat32(bs.scaleY);
          writer.writeFloat32(bs.rotation || 0);
          break;
        }
        case 'hatch': {
          const hs = s as HatchShape;
          writer.writeString(hs.pattern || 'solid');
          writer.writeFloat32(hs.scale || 1);
          writer.writeFloat32(hs.rotation || 0);
          writer.writeUint32(hs.points?.length || 0);
          (hs.points || []).forEach(p => {
            writer.writeFloat32(p.x);
            writer.writeFloat32(p.y);
          });
          break;
        }
        case 'donut': {
          const ds = s as DonutShape;
          writer.writeFloat32(ds.x);
          writer.writeFloat32(ds.y);
          writer.writeFloat32(ds.innerRadius);
          writer.writeFloat32(ds.outerRadius);
          break;
        }
      }
    });

    const finalBytes = writer.getUint8Array();
    stats.estimatedSizeKB = `${(finalBytes.length / 1024).toFixed(2)} KB`;
    vox.stats = stats;
    return finalBytes;
  }

  // Text JSON representation fallback
  if (options?.minify) {
    const rawJson = JSON.stringify(vox);
    const bytes = new TextEncoder().encode(rawJson).length;
    stats.estimatedSizeKB = `${(bytes / 1024).toFixed(2)} KB`;
    vox.stats = stats;
    return JSON.stringify(vox);
  } else {
    const formattedJson = JSON.stringify(vox, null, 2);
    const bytes = new TextEncoder().encode(formattedJson).length;
    stats.estimatedSizeKB = `${(bytes / 1024).toFixed(2)} KB`;
    vox.stats = stats;
    return JSON.stringify(vox, null, 2);
  }
};

/**
 * Imports and parses a .vox extension file, supporting both legacy JSON text and optimized Binary streams.
 */
export const voxToProject = (content: string | ArrayBuffer): VoxProject | null => {
  if (!content) return null;
  
  try {
    let buffer: ArrayBuffer;
    let isBinarySignature = false;

    if (content instanceof ArrayBuffer) {
      buffer = content;
      const view = new DataView(buffer);
      if (view.byteLength >= 4) {
        const b0 = view.getUint8(0);
        const b1 = view.getUint8(1);
        const b2 = view.getUint8(2);
        const b3 = view.getUint8(3);
        
        // "VOSB" in big endian represents binary vox signature
        if (b0 === 0x56 && b1 === 0x4F && b2 === 0x53 && b3 === 0x42) {
          isBinarySignature = true;
        }
      }
    } else {
      const trimmed = content.trim();
      if (trimmed.startsWith('999') || trimmed.includes('SECTION\nHEADER') || trimmed.includes('SECTION\r\nHEADER')) {
        return null; // DXF fallback
      }
      if (!trimmed.startsWith('{')) {
        return null;
      }
      const voxObj = JSON.parse(trimmed);
      let normalizedProject = (voxObj.version && parseFloat(voxObj.version) >= 2.0)
        ? voxObj as VoxProject
        : migrateLegacyVox(voxObj);

      normalizedProject.entities = (normalizedProject.entities || []).map(s => sanitizeShape(s));
      normalizedProject.bounds = getAllShapesBounds(normalizedProject.entities, normalizedProject.blocks) || { xMin: 0, yMin: 0, xMax: 100, yMax: 100 };
      normalizedProject.stats = calculateVoxProjectStats(normalizedProject);
      return normalizedProject;
    }

    if (isBinarySignature) {
      const reader = new BinaryReader(buffer);
      // Skip signature (4 bytes)
      reader.readUint8(); reader.readUint8(); reader.readUint8(); reader.readUint8();
      
      const versionNum = reader.readUint16();
      const versionStr = (versionNum / 100).toFixed(1);

      // Read metadata JSON chunk
      const configStr = reader.readString();
      const configObj = JSON.parse(configStr);

      // Read Entities
      const entityCount = reader.readUint32();
      const entities: Shape[] = [];

      for (let i = 0; i < entityCount; i++) {
        const typeId = reader.readUint8();
        const type = SHAPE_ID_TO_TYPE[typeId];
        if (!type) {
          throw new Error(`Unsupported binary shape ID: ${typeId}`);
        }

        // Base properties reconstruction
        const id = reader.readString();
        const layer = reader.readString();
        const color = reader.readString();
        const thickness = reader.readFloat32();
        const lineType = reader.readString() as any;
        const opacity = reader.readFloat32();
        const filled = reader.readUint8() === 1;
        const lineScale = reader.readFloat32();

        const baseShape: any = {
          id,
          type,
          layer,
          color: color || '#FFFFFF',
          thickness,
          lineType,
          opacity,
          filled,
          lineScale
        };

        switch (type) {
          case 'line': {
            const x1 = reader.readFloat32();
            const y1 = reader.readFloat32();
            const x2 = reader.readFloat32();
            const y2 = reader.readFloat32();
            const arrowStart = reader.readUint8() === 1;
            const arrowEnd = reader.readUint8() === 1;
            entities.push({ ...baseShape, x1, y1, x2, y2, arrowStart, arrowEnd });
            break;
          }
          case 'circle': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const radius = reader.readFloat32();
            entities.push({ ...baseShape, x, y, radius });
            break;
          }
          case 'rect': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const width = reader.readFloat32();
            const height = reader.readFloat32();
            const rotation = reader.readFloat32();
            entities.push({ ...baseShape, x, y, width, height, rotation });
            break;
          }
          case 'pline':
          case 'polygon': {
            const closed = reader.readUint8() === 1;
            const numPoints = reader.readUint32();
            const points: any[] = [];
            for (let p = 0; p < numPoints; p++) {
              const x = reader.readFloat32();
              const y = reader.readFloat32();
              const bulge = reader.readFloat32();
              points.push({ x, y, bulge });
            }
            entities.push({ ...baseShape, points, closed });
            break;
          }
          case 'arc': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const radius = reader.readFloat32();
            const startAngle = reader.readFloat32();
            const endAngle = reader.readFloat32();
            const counterClockwise = reader.readUint8() === 1;
            entities.push({ ...baseShape, x, y, radius, startAngle, endAngle, counterClockwise });
            break;
          }
          case 'text': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const size = reader.readFloat32();
            const rotation = reader.readFloat32();
            const content = reader.readString();
            const justification = reader.readString() as any;
            const styleFlags = reader.readUint8();
            const bold = (styleFlags & 1) !== 0;
            const italic = (styleFlags & 2) !== 0;
            const underline = (styleFlags & 4) !== 0;
            entities.push({ ...baseShape, x, y, size, rotation, content, justification, bold, italic, underline });
            break;
          }
          case 'mtext': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const size = reader.readFloat32();
            const width = reader.readFloat32();
            const rotation = reader.readFloat32();
            const content = reader.readString();
            const justification = reader.readString() as any;
            const styleFlags = reader.readUint8();
            const bold = (styleFlags & 1) !== 0;
            const italic = (styleFlags & 2) !== 0;
            const underline = (styleFlags & 4) !== 0;
            entities.push({ ...baseShape, x, y, size, width, rotation, content, justification, bold, italic, underline });
            break;
          }
          case 'ellipse': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const rx = reader.readFloat32();
            const ry = reader.readFloat32();
            const rotation = reader.readFloat32();
            entities.push({ ...baseShape, x, y, rx, ry, rotation });
            break;
          }
          case 'point': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const size = reader.readFloat32();
            entities.push({ ...baseShape, x, y, size });
            break;
          }
          case 'dimension': {
            const x1 = reader.readFloat32();
            const y1 = reader.readFloat32();
            const x2 = reader.readFloat32();
            const y2 = reader.readFloat32();
            const dimX = reader.readFloat32();
            const dimY = reader.readFloat32();
            const text = reader.readString();
            const dimType = reader.readString() as any;
            entities.push({ ...baseShape, x1, y1, x2, y2, dimX, dimY, text, dimType });
            break;
          }
          case 'ray':
          case 'xline': {
            const x1 = reader.readFloat32();
            const y1 = reader.readFloat32();
            const x2 = reader.readFloat32();
            const y2 = reader.readFloat32();
            entities.push({ ...baseShape, x1, y1, x2, y2 });
            break;
          }
          case 'dline': {
            const thicknessVal = reader.readFloat32();
            const justification = reader.readString() as any;
            const numPoints = reader.readUint32();
            const points: any[] = [];
            for (let p = 0; p < numPoints; p++) {
              const x = reader.readFloat32();
              const y = reader.readFloat32();
              points.push({ x, y });
            }
            entities.push({ ...baseShape, thickness: thicknessVal, justification, points });
            break;
          }
          case 'leader': {
            const x1 = reader.readFloat32();
            const y1 = reader.readFloat32();
            const x2 = reader.readFloat32();
            const y2 = reader.readFloat32();
            const text = reader.readString();
            const size = reader.readFloat32();
            const arrowType = reader.readString() as any;
            entities.push({ ...baseShape, x1, y1, x2, y2, text, size, arrowType });
            break;
          }
          case 'block': {
            const blockId = reader.readString();
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const scaleX = reader.readFloat32();
            const scaleY = reader.readFloat32();
            const rotation = reader.readFloat32();
            entities.push({ ...baseShape, blockId, x, y, scaleX, scaleY, rotation });
            break;
          }
          case 'hatch': {
            const pattern = reader.readString() as any;
            const scale = reader.readFloat32();
            const rotation = reader.readFloat32();
            const numPoints = reader.readUint32();
            const points: any[] = [];
            for (let p = 0; p < numPoints; p++) {
              const x = reader.readFloat32();
              const y = reader.readFloat32();
              points.push({ x, y });
            }
            entities.push({ ...baseShape, pattern, scale, rotation, points });
            break;
          }
          case 'donut': {
            const x = reader.readFloat32();
            const y = reader.readFloat32();
            const innerRadius = reader.readFloat32();
            const outerRadius = reader.readFloat32();
            entities.push({ ...baseShape, x, y, innerRadius, outerRadius });
            break;
          }
        }
      }

      const project: VoxProject = {
        version: versionStr,
        meta: configObj.meta || { createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
        settings: configObj.settings,
        layers: configObj.layers || {},
        lineTypes: configObj.lineTypes || {},
        textStyles: configObj.textStyles || {},
        blocks: configObj.blocks || {},
        entities,
        layouts: configObj.layouts || {},
        bounds: getAllShapesBounds(entities, configObj.blocks) || { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
      };

      project.stats = calculateVoxProjectStats(project);
      
      const realLen = buffer.byteLength;
      project.stats.estimatedSizeKB = `${(realLen / 1024).toFixed(2)} KB`;
      return project;
    } else {
      // Decode standard old JSON .vox
      const jsonStr = new TextDecoder().decode(buffer);
      const trimmed = jsonStr.trim();
      if (trimmed.startsWith('999') || trimmed.includes('SECTION\nHEADER')) {
        return null;
      }
      return voxToProject(trimmed);
    }
  } catch (e) {
    console.error("VOX Import Parser Error:", e);
    return null;
  }
};

/**
 * Migrates old legacy VOX projects into standard 2.x structures.
 */
const migrateLegacyVox = (legacy: any): VoxProject => {
  const layers: Record<string, LayerConfig> = {
    '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
    'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
  };
  
  if (Array.isArray(legacy.layers)) {
    legacy.layers.forEach((l: any) => { 
      const layerId = l.id || l.name || '0';
      layers[layerId] = {
        id: layerId,
        name: l.name || layerId,
        visible: l.visible !== undefined ? !!l.visible : true,
        locked: l.locked !== undefined ? !!l.locked : false,
        frozen: l.frozen !== undefined ? !!l.frozen : false,
        plottable: l.plottable !== undefined ? !!l.plottable : (layerId.toLowerCase() !== 'defpoints'),
        color: l.color || '#FFFFFF',
        thickness: l.thickness !== undefined ? l.thickness : 0.25,
        lineType: l.lineType || 'continuous'
      };
    });
  }

  const entities: Shape[] = Array.isArray(legacy.entities) 
    ? legacy.entities.map((e: any) => mapVoxEntityToShape(e))
    : [];

  return {
    version: "2.1",
    meta: legacy.metadata || legacy.meta || { createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    settings: legacy.settings,
    layers,
    lineTypes: {},
    textStyles: {},
    blocks: legacy.blocks || {},
    entities,
    layouts: {},
    bounds: getAllShapesBounds(entities, legacy.blocks || {}) || { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
  };
};

/**
 * Legacy entity mapper.
 */
const mapVoxEntityToShape = (e: any): Shape => {
  const base = {
    id: e.id || generateId(),
    layer: e.layer || "0",
    color: e.color || "#FFFFFF",
    thickness: e.thickness || 1,
    lineType: e.lineType || "continuous",
    opacity: e.opacity !== undefined ? e.opacity : 1,
    filled: !!e.filled
  };

  switch (e.type) {
    case "LINE":
      return { ...base, type: "line", x1: e.start?.x ?? e.x1 ?? 0, y1: e.start?.y ?? e.y1 ?? 0, x2: e.end?.x ?? e.x2 ?? 0, y2: e.end?.y ?? e.y2 ?? 0 } as LineShape;
    case "CIRCLE":
      return { ...base, type: "circle", x: e.center?.x ?? e.x ?? 0, y: e.center?.y ?? e.y ?? 0, radius: e.radius ?? 1 } as CircleShape;
    case "RECTANGLE":
    case "RECT":
      return { ...base, type: "rect", x: e.x ?? 0, y: e.y ?? 0, width: e.width ?? 1, height: e.height ?? 1, rotation: e.rotation ?? 0 } as RectShape;
    case "POLYLINE":
    case "pline":
      return { ...base, type: "pline", points: e.points || [], closed: !!e.closed } as PolyShape;
    case "POLYGON":
    case "polygon":
      return { ...base, type: "polygon", points: e.points || [], closed: true } as PolyShape;
    case "ARC":
      return { ...base, type: "arc", x: e.center?.x ?? e.x ?? 0, y: e.center?.y ?? e.y ?? 0, radius: e.radius ?? 1, startAngle: e.startAngle ?? 0, endAngle: e.endAngle ?? Math.PI, counterClockwise: !!e.counterClockwise } as ArcShape;
    case "TEXT":
      return { ...base, type: "text", x: e.position?.x ?? e.x ?? 0, y: e.position?.y ?? e.y ?? 0, content: e.content || '', size: e.size ?? 10, rotation: e.rotation ?? 0 } as TextShape;
    case "MTEXT":
      return { ...base, type: "mtext", x: e.position?.x ?? e.x ?? 0, y: e.position?.y ?? e.y ?? 0, content: e.content || '', size: e.size ?? 10, width: e.width ?? 100, rotation: e.rotation ?? 0 } as MTextShape;
    case "ELLIPSE":
      return { ...base, type: "ellipse", x: e.center?.x ?? e.x ?? 0, y: e.center?.y ?? e.y ?? 0, rx: e.rx ?? 1, ry: e.ry ?? 1, rotation: e.rotation ?? 0 } as EllipseShape;
    case "SPLINE":
      return { ...base, type: "spline", points: e.points || [] } as PolyShape;
    case "POINT":
      return { ...base, type: "point", x: e.position?.x ?? e.x ?? 0, y: e.position?.y ?? e.y ?? 0, size: e.size ?? 2 } as PointShape;
    case "DIMENSION":
      return { ...base, type: "dimension", x1: e.p1?.x ?? e.x1 ?? 0, y1: e.p1?.y ?? e.y1 ?? 0, x2: e.p2?.x ?? e.x2 ?? 0, y2: e.p2?.y ?? e.y2 ?? 0, dimX: e.dimPos?.x ?? e.dimX ?? 0, dimY: e.dimPos?.y ?? e.dimY ?? 0, text: e.text || '' } as DimensionShape;
    case "RAY":
    case "XLINE":
      return { ...base, type: e.type.toLowerCase(), x1: e.p1?.x ?? e.x1 ?? 0, y1: e.p1?.y ?? e.y1 ?? 0, x2: e.p2?.x ?? e.x2 ?? 0, y2: e.p2?.y ?? e.y2 ?? 0 } as InfiniteLineShape;
    case "DOUBLE_LINE":
      return { ...base, type: "dline", points: e.points || [], thickness: e.thickness ?? 5, justification: e.justification || 'center' } as DoubleLineShape;
    default:
      return { ...base, ...e.data, type: (e.type || 'line').toLowerCase() } as Shape;
  }
};

export class VoxService {
  static save(shapes: Shape[], projectName = "Untitled", existingMetadata?: any): string {
    const defaultMeta = {
      name: projectName,
      author: "Sachin",
      createdAt: new Date().toISOString(),
      revision: "REV-00",
      projectRevision: "V-1.0",
      description: ""
    };

    const currentMeta = existingMetadata || defaultMeta;

    // Increment revision
    const prevRevision = currentMeta.revision || 'REV-00';
    const match = prevRevision.match(/REV-(\d+)/i) || prevRevision.match(/REV\s*(\d+)/i) || prevRevision.match(/(\d+)/);
    let revNum = 0;
    if (match) {
      revNum = parseInt(match[1] || match[0], 10);
    }
    const nextRev = revNum + 1;
    const pad = nextRev < 10 ? '0' + nextRev : String(nextRev);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timestampStr = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

    const updatedMetadata = {
      ...currentMeta,
      name: currentMeta.name || projectName,
      createdAt: currentMeta.createdAt || now.toISOString(),
      lastModified: now.toISOString(),
      modifiedAt: now.toISOString(),
      revision: `REV-${pad}`,
      revisionTimestamp: timestampStr,
      savedAt: now.toISOString(),
      lastSavedTimestamp: timestampStr
    };

    // Propagate changes if existingMetadata is object
    if (existingMetadata) {
      existingMetadata.name = updatedMetadata.name;
      existingMetadata.author = updatedMetadata.author;
      existingMetadata.createdAt = updatedMetadata.createdAt;
      existingMetadata.lastModified = updatedMetadata.lastModified;
      existingMetadata.modifiedAt = updatedMetadata.modifiedAt;
      existingMetadata.revision = updatedMetadata.revision;
      existingMetadata.revisionTimestamp = updatedMetadata.revisionTimestamp;
      existingMetadata.savedAt = updatedMetadata.savedAt;
      existingMetadata.lastSavedTimestamp = updatedMetadata.lastSavedTimestamp;
    }

    const project = {
      version: "2.0",
      metadata: updatedMetadata,
      settings: {
        gridSize: 20,
        snapEnabled: true,
        units: "mm",
      },
      layers: [],
      shapes: shapes,
      statistics: {
        totalEntities: shapes.length,
        byType: shapes.reduce((acc, s) => {
          acc[s.type] = (acc[s.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };

    return JSON.stringify(project, null, 2);
  }

  static load(jsonString: string): { shapes: Shape[]; metadata: any } {
    try {
      const project = JSON.parse(jsonString);
      return {
        shapes: project.shapes || project.entities || [],
        metadata: project.metadata || project.meta || { name: project.fileName || "Imported Project" },
      };
    } catch (e) {
      console.error("Vox load failed", e);
      return { shapes: [], metadata: {} };
    }
  }
}
