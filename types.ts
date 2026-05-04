
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

export type ShapeType = 'line' | 'dline' | 'circle' | 'rect' | 'text' | 'mtext' | 'arc' | 'pline' | 'spline' | 'dimension' | 'dimang' | 'ellipse' | 'polygon' | 'point' | 'ray' | 'xline' | 'donut' | 'leader' | 'block' | 'hatch';

export type LineType = 'continuous' | 'dashed' | 'dotted' | 'center' | 'dashdot' | 'border' | 'divide' | 'phantom' | 'zigzag' | 'hotwater' | 'hidden' | 'gasLine' | 'fenceLine' | 'tracks' | 'batt' | 'zigzag2' | 'dots2' | 'dash2';

export type TextJustification = 'left' | 'center' | 'right';

export interface BaseShape {
  id: string;
  type: ShapeType;
  layer: string;
  color?: string;
  thickness?: number | string; 
  lineType?: LineType;
  filled?: boolean; 
  opacity?: number;
  isPreview?: boolean; 
  /** @internal Cached bounding box for performance */
  _bounds?: { xMin: number, yMin: number, xMax: number, yMax: number };
  /** @internal Cached length/perimeter for line type scaling */
  _length?: number;
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
  closed?: boolean;
}

export type DimensionType = 'linear' | 'aligned' | 'radius' | 'diameter' | 'angular' | 'arc' | 'ordinate';

export interface DimensionShape extends BaseShape {
  type: 'dimension';
  dimType: DimensionType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dimX: number;
  dimY: number;
  cx?: number; // Center X for radial/angular
  cy?: number; // Center Y for radial/angular
  angle1?: number;
  angle2?: number;
  text: string;
  styleId?: string;
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
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
  fontFamily?: string;
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
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
  fontFamily?: string;
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
  x: number;
  y: number;
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

export type HatchPattern = 'solid' | 'ansi31' | 'ansi32' | 'ansi37' | 'dots' | 'cross' | 'net' | 'honey' | 'clay' | 'cork' | 'grass' | 'gravel' | 'stars';

export interface HatchShape extends BaseShape {
  type: 'hatch';
  pattern: HatchPattern;
  points: Point[]; 
  scale?: number;
  rotation?: number;
}

export interface BlockShape extends BaseShape {
  type: 'block';
  blockId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface BlockDefinition {
  id: string;
  name: string;
  basePoint: Point;
  shapes: Shape[];
}

export interface LayoutViewport {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  viewState: ViewState;
}

export interface LayoutDefinition {
  id: string;
  name: string;
  paperSize: { width: number; height: number };
  viewports: LayoutViewport[];
}

export type Shape = LineShape | DoubleLineShape | DimensionShape | CircleShape | RectShape | TextShape | MTextShape | ArcShape | PolyShape | EllipseShape | PointShape | LeaderShape | InfiniteLineShape | AngularDimensionShape | DonutShape | BlockShape | HatchShape;

export interface ViewState {
  scale: number;
  originX: number;
  originY: number;
}

export type UnitType = 'metric' | 'imperial';
export type MetricSubUnit = 'm' | 'mm' | 'cm';
export type ImperialSubUnit = 'ft' | 'ft-in';

export type LinearUnitFormat = 'decimal' | 'architectural' | 'engineering' | 'fractional' | 'scientific';
export type AngularUnitFormat = 'decimalDegrees' | 'degMinSec' | 'grads' | 'radians' | 'surveyors';

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

export interface DimensionStyle {
  id: string;
  name: string;
  arrowSize: number;
  textSize: number;
  textOffset: number;
  extendLine: number;
  offsetLine: number;
  precision: number;
}

export interface LineTypeDefinition {
  name: string;
  description: string;
  pattern: number[]; // dash-space-dash-space
}

export interface TextStyleDefinition {
  name: string;
  font: string;
  height: number;
  widthFactor: number;
  obliqueAngle: number;
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
  linearFormat: LinearUnitFormat;
  angularFormat: AngularUnitFormat;
  anglePrecision: string;
  showDualUnits?: boolean;
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
  activeDimStyle: string;
  dimStyles: Record<string, DimensionStyle>;
  limitsMin: Point;
  limitsMax: Point;
  metadata?: ProjectMetadata;
}

export interface VoxProject {
  version: string;
  meta: ProjectMetadata;
  settings: AppSettings;
  layers: Record<string, LayerConfig>;
  lineTypes: Record<string, LineTypeDefinition>;
  textStyles: Record<string, TextStyleDefinition>;
  blocks: Record<string, BlockDefinition>;
  entities: Shape[];
  layouts: Record<string, LayoutDefinition>;
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number };
  stats?: {
    total: number;
    unsupported: number;
    counts: Record<string, number>;
  };
}

export interface SnapPoint {
  x: number;
  y: number;
  type: 'end' | 'mid' | 'cen' | 'quad' | 'int' | 'perp' | 'tan' | 'near' | 'node' | 'ext' | 'par' | 'gcen' | 'appint';
}
