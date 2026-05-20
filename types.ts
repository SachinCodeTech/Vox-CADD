
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
  bulge?: number; // Added for Arcs in Polylines
}

export type ShapeType = 'line' | 'dline' | 'circle' | 'rect' | 'text' | 'mtext' | 'arc' | 'pline' | 'poly' | 'spline' | 'dimension' | 'dimang' | 'ellipse' | 'polygon' | 'point' | 'ray' | 'xline' | 'donut' | 'leader' | 'block' | 'hatch';

export type LineType = 'continuous' | 'dashed' | 'dotted' | 'center' | 'dashdot' | 'border' | 'divide' | 'phantom' | 'zigzag' | 'hotwater' | 'hidden' | 'gasLine' | 'fenceLine' | 'tracks' | 'batt' | 'zigzag2' | 'dots2' | 'dash2' | 'bylayer' | 'byblock';

export type TextJustification = 'left' | 'center' | 'right';

export interface BaseShape {
  id: string;
  type: ShapeType;
  layer: string;
  color?: string;
  thickness?: number | string; 
  lineType?: LineType;
  filled?: boolean; 
  fill?: boolean; 
  text?: string;
  height?: number;
  size?: number;
  opacity?: number;
  isPreview?: boolean; 
  lineScale?: number;
  /** @internal Cached bounding box for performance */
  _bounds?: { xMin: number, yMin: number, xMax: number, yMax: number };
  /** @internal Cached length/perimeter for line type scaling */
  _length?: number;
  /** @internal Cached segments for performance */
  _segments?: { p1: Point, p2: Point }[];
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
  height?: number; // Alias for size
  content: string;
  text?: string; // Alias for content
  rotation?: number; 
  justification?: TextJustification;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight?: boolean;
  highlightColor?: string;
  fontFamily?: string;
  attachmentPoint?: number;
}

export interface MTextShape extends BaseShape {
  type: 'mtext';
  x: number;
  y: number;
  width: number;
  size: number;
  height?: number; // Alias for size
  content: string;
  text?: string; // Alias for content
  lineHeight?: number;
  rotation?: number;
  justification?: TextJustification;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight?: boolean;
  highlightColor?: string;
  fontFamily?: string;
  attachmentPoint?: number;
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
  type: 'pline' | 'poly' | 'spline' | 'polygon';
  points: any[]; // Support both Point[] and number[]
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
  arrowType?: 'closed' | 'open' | 'tick' | 'dot' | 'none';
}

export type HatchPattern = 'solid' | 'ansi31' | 'ansi32' | 'ansi33' | 'ansi37' | 'ansi38' | 'dots' | 'cross' | 'net' | 'honey' | 'clay' | 'cork' | 'grass' | 'gravel' | 'stars' | 'brick' | 'hound' | 'grid' | 'triang' | 'zigzag';

export interface HatchShape extends BaseShape {
  type: 'hatch';
  pattern: HatchPattern;
  points: Point[]; // Main/outer loop for legacy support
  loops?: Point[][]; // Support for multiple loops (islands/holes)
  scale?: number;
  rotation?: number;
}

export interface BlockShape extends BaseShape {
  type: 'block';
  blockId: string;
  name?: string; // Phase 2 alias
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  scale?: number; // Phase 2 alias
  scaleZ?: number;
  rotation: number;
  attributes?: Record<string, string>;
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
  entities: Shape[]; // Title blocks, annotations in paper space
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
  plottable: boolean;
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
  polar: boolean;
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
  textPlacement?: 'above' | 'center' | 'below';
  unitFormat?: LinearUnitFormat;
  arrowScale?: number;
  arrowType?: 'closed' | 'open' | 'tick' | 'dot';
  fractionalPrecision?: number;
}

export interface LineTypeElement {
  type: 'dash' | 'text' | 'shape';
  value: number | string; // length for dash, string for text, shapeName for shape
  offset?: { x: number, y: number };
  scale?: number;
  rotation?: number;
}

export interface LineTypeDefinition {
  name: string;
  description: string;
  pattern: number[]; // simple pattern dash-space
  elements?: LineTypeElement[]; // complex pattern
}

export interface TextStyleDefinition {
  name: string;
  font: string;
  height: number;
  widthFactor: number;
  obliqueAngle: number;
}

export interface CtbPlotStyle {
  color: number; // ACI index 1-255
  plotColor: string | 'useObjectColor'; // Hex or 'useObjectColor'
  lineweight: number | 'useObjectLineweight'; // in mm
  lineStyle: LineType | 'useObjectLineStyle';
  screening: number; // 0-100
  lineEndStyle?: 'BUTT' | 'SQUARE' | 'ROUND' | 'DIAMOND';
  lineJoinStyle?: 'MITER' | 'BEVEL' | 'ROUND' | 'DIAMOND';
  fillStyle?: 'SOLID' | 'CHECKERBOARD' | 'CROSSHATCH';
}

export interface CtbFile {
  id: string;
  name: string;
  description: string;
  styles: Record<number, CtbPlotStyle>;
}

export interface NamedView extends ViewState {
  id: string;
  name: string;
}

export interface AppSettings {
  ortho: boolean;
  snap: boolean;
  grid: boolean;
  currentLayer: string;
  drawingScale: number; 
  penThickness: number | string;
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
  gridMajorInterval?: number;
  snapSpacing: number; 
  snapOptions: SnapOptions;
  polarTrackingEnabled?: boolean;
  polarAngles?: number[];
  showHUD: boolean; 
  showLineWeights: boolean;
  textSize: number;
  textRotation: number;
  textJustification: TextJustification;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  textHighlight?: boolean;
  activeDimStyle: string;
  dimStyles: Record<string, DimensionStyle>;
  ltScale: number;
  limitsMin: Point;
  limitsMax: Point;
  metadata?: ProjectMetadata;
  activeCtbId?: string;
  ctbFiles?: Record<string, CtbFile>;
  showCtbInView?: boolean;
  aiSuggestionsEnabled?: boolean;
  namedViews?: NamedView[];
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
  namedViews?: NamedView[];
  stats?: {
    total: number;
    unsupported: number;
    counts: Record<string, number>;
    layerUsage?: Record<string, number>;
    unusedLayers?: string[];
    invisibleCount?: number;
    totalLength?: number;
    estimatedSizeKB?: string;
  };
}

export interface SnapPoint {
  x: number;
  y: number;
  type: 'end' | 'mid' | 'cen' | 'quad' | 'int' | 'perp' | 'tan' | 'near' | 'node' | 'ext' | 'par' | 'gcen' | 'appint' | 'polar';
  lastPoint?: Point;
}
