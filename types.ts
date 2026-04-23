
export interface ArcData {
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type ShapeType = 'line' | 'dline' | 'circle' | 'rect' | 'text' | 'mtext' | 'arc' | 'pline' | 'spline' | 'dimension' | 'dimang' | 'ellipse' | 'polygon' | 'point' | 'ray' | 'xline' | 'donut' | 'leader';

export type LineType = 'continuous' | 'dashed' | 'dotted' | 'center';

export type TextJustification = 'left' | 'center' | 'right';

export interface BaseShape {
  id: string;
  type: ShapeType;
  layer: string;
  color: string;
  thickness?: number; 
  lineType?: LineType;
  filled?: boolean; 
  opacity?: number;
  isPreview?: boolean; 
}

export interface LineShape extends BaseShape {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export type DLineJustification = 'top' | 'zero' | 'bottom';

export interface DoubleLineShape extends BaseShape {
  type: 'dline';
  points: Point[];
  thickness: number; 
  justification: DLineJustification;
}

export interface DimensionShape extends BaseShape {
  type: 'dimension';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dimX: number;
  dimY: number;
  text: string;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextShape extends BaseShape {
  type: 'text';
  x: number;
  y: number;
  size: number;
  content: string;
  rotation?: number; 
  justification?: TextJustification;
}

export interface MTextShape extends BaseShape {
  type: 'mtext';
  x: number;
  y: number;
  width: number;
  size: number;
  content: string;
  lineHeight?: number;
  rotation?: number;
  justification?: TextJustification;
}

export interface ArcShape extends BaseShape {
  type: 'arc';
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise?: boolean;
}

export interface PolyShape extends BaseShape {
  type: 'pline' | 'spline' | 'polygon';
  points: Point[];
  closed?: boolean;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number; 
}

export interface PointShape extends BaseShape {
  type: 'point';
  x: number;
  y: number;
  size: number;
}

export interface InfiniteLineShape extends BaseShape {
  type: 'ray' | 'xline';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AngularDimensionShape extends BaseShape {
  type: 'dimang';
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  text: string;
}

export interface DonutShape extends BaseShape {
  type: 'donut';
  innerRadius: number;
  outerRadius: number;
}

export interface LeaderShape extends BaseShape {
  type: 'leader';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  size: number;
}

export type Shape = LineShape | DoubleLineShape | DimensionShape | CircleShape | RectShape | TextShape | MTextShape | ArcShape | PolyShape | EllipseShape | PointShape | LeaderShape | InfiniteLineShape | AngularDimensionShape | DonutShape;

export interface ViewState {
  scale: number;
  originX: number;
  originY: number;
}

export type UnitType = 'metric' | 'imperial';
export type MetricSubUnit = 'm' | 'mm';
export type ImperialSubUnit = 'ft' | 'ft-in';

export interface LayerConfig {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  frozen: boolean;
  color: string;
  thickness: number;
  lineType: LineType;
}

export interface SnapOptions {
  endpoint: boolean;
  midpoint: boolean;
  center: boolean;
  quadrant: boolean;
  intersection: boolean;
  perpendicular: boolean;
  tangent: boolean;
  nearest: boolean;
  node: boolean;
  extension: boolean;
  parallel: boolean;
  gcenter: boolean;
  appint: boolean;
}

export interface ProjectMetadata {
  author?: string;
  createdAt: string;
  lastModified: string;
  description?: string;
  revision?: string;
  projectRevision?: string;
}

export interface AppSettings {
  ortho: boolean;
  snap: boolean;
  grid: boolean;
  currentLayer: string;
  drawingScale: number; 
  penThickness: number;
  activeLineType: LineType;
  cursorX: number; 
  cursorY: number;
  units: UnitType; 
  unitSubtype: string;
  precision: string;
  fillEnabled: boolean;
  gridSpacing: number; 
  snapSpacing: number; 
  snapOptions: SnapOptions;
  showHUD: boolean; 
  showLineWeights: boolean;
  textSize: number;
  textRotation: number;
  textJustification: TextJustification;
  metadata?: ProjectMetadata;
}

export interface SnapPoint {
  x: number;
  y: number;
  type: 'end' | 'mid' | 'cen' | 'quad' | 'int' | 'perp' | 'tan' | 'near' | 'node' | 'ext' | 'par' | 'gcen' | 'appint';
}
