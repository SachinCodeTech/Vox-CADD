
import { 
  Shape, LayerConfig, AppSettings, LineShape, CircleShape, RectShape, PolyShape, 
  ArcShape, TextShape, MTextShape, EllipseShape, PointShape, DimensionShape, 
  InfiniteLineShape, DoubleLineShape, VoxProject, BlockDefinition, LineTypeDefinition, 
  TextStyleDefinition, ProjectMetadata, LayoutDefinition 
} from '../types';
import { generateId, getAllShapesBounds } from './cadService';

export const createEmptyVoxProject = (settings: AppSettings): VoxProject => {
  return {
    version: "2.0",
    meta: {
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      ...settings.metadata
    },
    settings,
    layers: { 
      '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
      'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
    },
    lineTypes: {},
    textStyles: {},
    blocks: {},
    entities: [],
    layouts: {},
    bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
  };
};

export const shapesToVox = (
  shapes: Shape[], 
  layers: Record<string, LayerConfig>, 
  settings: AppSettings,
  lineTypes: Record<string, LineTypeDefinition>,
  blocks?: Record<string, BlockDefinition>,
  layouts?: Record<string, LayoutDefinition>
): string => {
  const bounds = getAllShapesBounds(shapes, blocks);
  
  const vox: VoxProject = {
    version: "2.0",
    meta: {
      author: settings.metadata?.author,
      createdAt: settings.metadata?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      description: settings.metadata?.description,
      revision: settings.metadata?.revision
    },
    settings,
    layers,
    lineTypes, 
    textStyles: {}, 
    blocks: blocks || {},
    entities: shapes,
    layouts: layouts || {}, 
    bounds: bounds || { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }
  };

  return JSON.stringify(vox, null, 2);
};

export const voxToProject = (voxString: string): VoxProject | null => {
  if (!voxString) return null;
  
  try {
    let jsonStr = voxString.trim();
    
    // Attempt to isolate the main JSON object if there's trailing or leading garbage
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const vox: any = JSON.parse(jsonStr);
    
    // Support legacy VOX format if version < 2.0
    if (!vox.version || parseFloat(vox.version) < 2.0) {
       return migrateLegacyVox(vox);
    }

    return vox as VoxProject;
  } catch (e) {
    console.error("VOX Import Error:", e);
    // Log a snippet of the problematic content for easier debugging
    console.error("Content Snippet:", voxString.substring(0, 100));
    return null;
  }
};

const migrateLegacyVox = (legacy: any): VoxProject => {
    const layers: Record<string, LayerConfig> = {
        '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
        'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
    };
    if (Array.isArray(legacy.layers)) {
        legacy.layers.forEach((l: any) => { layers[l.id || l.name] = l; });
    }

    const entities: Shape[] = Array.isArray(legacy.entities) 
        ? legacy.entities.map((e: any) => mapVoxEntityToShape(e))
        : [];

    return {
        version: "2.0",
        meta: legacy.metadata || { createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
        settings: legacy.settings,
        layers,
        lineTypes: {},
        textStyles: {},
        blocks: legacy.blocks || {},
        entities,
        layouts: {},
        bounds: getAllShapesBounds(entities, legacy.blocks || {})
    };
};

// Legacy mapping for backward compatibility
const mapVoxEntityToShape = (e: any): Shape => {
  const base = {
    id: e.id || generateId(),
    layer: e.layer || "0",
    color: e.color || "#FFFFFF",
    thickness: e.thickness || 1,
    lineType: e.lineType || "continuous",
    opacity: e.opacity !== undefined ? e.opacity : 1,
    filled: e.filled || false
  };

  switch (e.type) {
    case "LINE":
      return { ...base, type: "line", x1: e.start.x, y1: e.start.y, x2: e.end.x, y2: e.end.y } as LineShape;
    case "CIRCLE":
      return { ...base, type: "circle", x: e.center.x, y: e.center.y, radius: e.radius } as CircleShape;
    case "RECTANGLE":
      return { ...base, type: "rect", x: e.x, y: e.y, width: e.width, height: e.height } as RectShape;
    case "POLYLINE":
      return { ...base, type: "pline", points: e.points, closed: e.closed } as PolyShape;
    case "POLYGON":
      return { ...base, type: "polygon", points: e.points, closed: true } as PolyShape;
    case "ARC":
      return { ...base, type: "arc", x: e.center.x, y: e.center.y, radius: e.radius, startAngle: e.startAngle, endAngle: e.endAngle, counterClockwise: e.counterClockwise } as ArcShape;
    case "TEXT":
      return { ...base, type: "text", x: e.position.x, y: e.position.y, content: e.content, size: e.size, rotation: e.rotation } as TextShape;
    case "MTEXT":
      return { ...base, type: "mtext", x: e.position.x, y: e.position.y, content: e.content, size: e.size, width: e.width } as MTextShape;
    case "ELLIPSE":
      return { ...base, type: "ellipse", x: e.center.x, y: e.center.y, rx: e.rx, ry: e.ry, rotation: e.rotation } as EllipseShape;
    case "SPLINE":
      return { ...base, type: "spline", points: e.points } as PolyShape;
    case "POINT":
      return { ...base, type: "point", x: e.position.x, y: e.position.y, size: e.size } as PointShape;
    case "DIMENSION":
      return { ...base, type: "dimension", x1: e.p1.x, y1: e.p1.y, x2: e.p2.x, y2: e.p2.y, dimX: e.dimPos.x, dimY: e.dimPos.y, text: e.text } as DimensionShape;
    case "RAY":
    case "XLINE":
      return { ...base, type: e.type.toLowerCase(), x1: e.p1.x, y1: e.p1.y, x2: e.p2.x, y2: e.p2.y } as InfiniteLineShape;
    case "DOUBLE_LINE":
      return { ...base, type: "dline", points: e.points, thickness: e.thickness, justification: e.justification } as DoubleLineShape;
    default:
      return { ...base, ...e.data, type: (e.type || 'line').toLowerCase() } as Shape;
  }
};
