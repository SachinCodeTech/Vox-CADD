
import { Shape, LayerConfig, AppSettings, LineShape, CircleShape, RectShape, PolyShape, ArcShape, TextShape, MTextShape, EllipseShape, PointShape, DimensionShape, InfiniteLineShape, DoubleLineShape } from '../types';
import { generateId } from './cadService';

export interface VoxProject {
  app: "VoxCADD";
  version: "1.0";
  units: string;
  metadata: {
    author?: string;
    createdAt: string;
    lastModified: string;
    description?: string;
    revision?: string;
  };
  settings: AppSettings;
  layers: LayerConfig[];
  entities: any[];
}

export const shapesToVox = (shapes: Shape[], layers: Record<string, LayerConfig>, settings: AppSettings): string => {
  const vox: VoxProject = {
    app: "VoxCADD",
    version: "1.0",
    units: settings.units === 'metric' ? "mm" : "inch",
    metadata: {
      author: settings.metadata?.author,
      createdAt: settings.metadata?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      description: settings.metadata?.description,
      revision: settings.metadata?.revision
    },
    settings: settings,
    layers: Object.values(layers),
    entities: shapes.map(s => mapShapeToVoxEntity(s))
  };

  return JSON.stringify(vox, null, 2);
};

const mapShapeToVoxEntity = (s: Shape): any => {
  const base = {
    id: s.id,
    layer: s.layer || "0",
    color: s.color,
    thickness: s.thickness,
    lineType: s.lineType || "continuous",
    opacity: s.opacity !== undefined ? s.opacity : 1,
    filled: s.filled || false
  };

  switch (s.type) {
    case 'line': {
      const l = s as LineShape;
      return { ...base, type: "LINE", start: { x: l.x1, y: l.y1 }, end: { x: l.x2, y: l.y2 } };
    }
    case 'circle': {
      const c = s as CircleShape;
      return { ...base, type: "CIRCLE", center: { x: c.x, y: c.y }, radius: c.radius };
    }
    case 'rect': {
      const r = s as RectShape;
      return { ...base, type: "RECTANGLE", x: r.x, y: r.y, width: r.width, height: r.height };
    }
    case 'pline': {
      const p = s as PolyShape;
      return { ...base, type: "POLYLINE", points: p.points, closed: p.closed };
    }
    case 'polygon': {
      const p = s as PolyShape;
      return { ...base, type: "POLYGON", points: p.points };
    }
    case 'arc': {
      const a = s as ArcShape;
      return { ...base, type: "ARC", center: { x: a.x, y: a.y }, radius: a.radius, startAngle: a.startAngle, endAngle: a.endAngle, counterClockwise: a.counterClockwise };
    }
    case 'text': {
      const t = s as TextShape;
      return { ...base, type: "TEXT", position: { x: t.x, y: t.y }, content: t.content, size: t.size, rotation: t.rotation };
    }
    case 'mtext': {
      const t = s as MTextShape;
      return { ...base, type: "MTEXT", position: { x: t.x, y: t.y }, content: t.content, size: t.size, width: t.width };
    }
    case 'ellipse': {
      const e = s as EllipseShape;
      return { ...base, type: "ELLIPSE", center: { x: e.x, y: e.y }, rx: e.rx, ry: e.ry, rotation: e.rotation };
    }
    case 'spline': {
      const p = s as PolyShape;
      return { ...base, type: "SPLINE", points: p.points };
    }
    case 'point': {
      const p = s as PointShape;
      return { ...base, type: "POINT", position: { x: p.x, y: p.y }, size: p.size };
    }
    case 'dimension': {
      const d = s as DimensionShape;
      return { ...base, type: "DIMENSION", p1: { x: d.x1, y: d.y1 }, p2: { x: d.x2, y: d.y2 }, dimPos: { x: d.dimX, y: d.dimY }, text: d.text };
    }
    case 'ray':
    case 'xline': {
      const l = s as InfiniteLineShape;
      return { ...base, type: s.type.toUpperCase(), p1: { x: l.x1, y: l.y1 }, p2: { x: l.x2, y: l.y2 } };
    }
    case 'dline': {
      const l = s as DoubleLineShape;
      return { ...base, type: "DOUBLE_LINE", points: l.points, thickness: l.thickness, justification: l.justification };
    }
    default:
      return { ...base, type: s.type.toUpperCase(), data: s };
  }
};

export const voxToShapes = (voxString: string): { shapes: Shape[], layers: Record<string, LayerConfig>, settings: AppSettings } | null => {
  try {
    const vox: VoxProject = JSON.parse(voxString);
    if (vox.app !== "VoxCADD") return null;

    const layers: Record<string, LayerConfig> = {};
    vox.layers.forEach(l => { layers[l.id] = l; });

    const shapes: Shape[] = vox.entities.map(e => mapVoxEntityToShape(e));

    return { shapes, layers, settings: vox.settings };
  } catch (e) {
    console.error("VOX Import Error:", e);
    return null;
  }
};

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
      return { ...base, ...e.data, type: e.type.toLowerCase() } as Shape;
  }
};
