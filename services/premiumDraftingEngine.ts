import { Shape, Point, LineShape, CircleShape, RectShape, ArcShape, TextShape, MTextShape, DimensionShape, LineType } from '../types';

/**
 * Procedural UUID generator
 */
function uuid(): string {
  return 'e-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Direct programmatic door assembly. Generates door casing panel and a gorgeous quarter-circle swing arc.
 */
export function generateDoorAssembly(
  x: number,
  y: number,
  width: number,
  orientation: 'left' | 'right' | 'up' | 'down',
  layer: string = 'A-DOOR'
): Shape[] {
  const shapes: Shape[] = [];
  const doorId = uuid();
  const arcId = uuid();

  if (orientation === 'left') {
    // Door panel swings inside/downwards, hinged at (x, y)
    shapes.push({
      id: doorId,
      type: 'line',
      layer,
      x1: x,
      y1: y,
      x2: x - width,
      y2: y,
      thickness: 1,
    } as LineShape);

    // Quarter-circle swing arc representing door path
    shapes.push({
      id: arcId,
      type: 'arc',
      layer,
      x,
      y,
      radius: width,
      startAngle: Math.PI,
      endAngle: 1.5 * Math.PI,
      counterClockwise: false,
    } as ArcShape);
  } else if (orientation === 'right') {
    shapes.push({
      id: doorId,
      type: 'line',
      layer,
      x1: x,
      y1: y,
      x2: x + width,
      y2: y,
      thickness: 1,
    } as LineShape);

    shapes.push({
      id: arcId,
      type: 'arc',
      layer,
      x,
      y,
      radius: width,
      startAngle: 0,
      endAngle: 0.5 * Math.PI,
      counterClockwise: true,
    } as ArcShape);
  } else if (orientation === 'up') {
    shapes.push({
      id: doorId,
      type: 'line',
      layer,
      x1: x,
      y1: y,
      x2: x,
      y2: y + width,
      thickness: 1,
    } as LineShape);

    shapes.push({
      id: arcId,
      type: 'arc',
      layer,
      x,
      y,
      radius: width,
      startAngle: 0.5 * Math.PI,
      endAngle: Math.PI,
      counterClockwise: true,
    } as ArcShape);
  } else {
    shapes.push({
      id: doorId,
      type: 'line',
      layer,
      x1: x,
      y1: y,
      x2: x,
      y2: y - width,
      thickness: 1,
    } as LineShape);

    shapes.push({
      id: arcId,
      type: 'arc',
      layer,
      x,
      y,
      radius: width,
      startAngle: 1.5 * Math.PI,
      endAngle: 2 * Math.PI,
      counterClockwise: true,
    } as ArcShape);
  }

  return shapes;
}

/**
 * Creates high-quality triple-guide glasing window assembly representing glass sliding structures.
 */
export function generateWindowAssembly(
  x: number,
  y: number,
  size: number,
  orientation: 'horizontal' | 'vertical',
  wallThickness: number,
  layer: string = 'A-WINDOW'
): Shape[] {
  const shapes: Shape[] = [];
  const mid = size / 2;

  if (orientation === 'horizontal') {
    // Rect boundary representing external frame
    shapes.push({
      id: uuid(),
      type: 'rect',
      layer,
      x: x - mid,
      y: y - wallThickness / 2,
      width: size,
      height: wallThickness,
    } as RectShape);

    // Triple visual glass guides
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x - mid,
      y1: y,
      x2: x + mid,
      y2: y,
    } as LineShape);
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x - mid,
      y1: y - wallThickness / 4,
      x2: x + mid,
      y2: y - wallThickness / 4,
    } as LineShape);
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x - mid,
      y1: y + wallThickness / 4,
      x2: x + mid,
      y2: y + wallThickness / 4,
    } as LineShape);
  } else {
    // Vertical frame
    shapes.push({
      id: uuid(),
      type: 'rect',
      layer,
      x: x - wallThickness / 2,
      y: y - mid,
      width: wallThickness,
      height: size,
    } as RectShape);

    // Inner details
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x,
      y1: y - mid,
      x2: x,
      y2: y + mid,
    } as LineShape);
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x - wallThickness / 4,
      y1: y - mid,
      x2: x - wallThickness / 4,
      y2: y + mid,
    } as LineShape);
    shapes.push({
      id: uuid(),
      type: 'line',
      layer,
      x1: x + wallThickness / 4,
      y1: y - mid,
      x2: x + wallThickness / 4,
      y2: y + mid,
    } as LineShape);
  }

  return shapes;
}

/**
 * Builds the comprehensive 12m x 18m modern villa floor plan layer-by-layer.
 */
export function draft12x18ModernVillaPlan(): {
  layers: Record<string, Shape[]>;
  layerConfigs: any;
} {
  const layers: Record<string, Shape[]> = {
    'A-GRID': [],
    'A-WALL': [],
    'A-WALL-INT': [],
    'A-DOOR': [],
    'A-WINDOW': [],
    'A-COLS': [],
    'A-BEAMS': [],
    'A-FURN': [],
    'A-TEXT': [],
    'A-DIM': []
  };

  const layerConfigs = {
    'A-GRID': { id: 'A-GRID', name: 'A-GRID', visible: true, locked: false, frozen: false, plottable: true, color: '#ffeb3b', thickness: 0.15, lineType: 'continuous' },
    'A-WALL': { id: 'A-WALL', name: 'A-WALL', visible: true, locked: false, frozen: false, plottable: true, color: '#ffffff', thickness: 0.50, lineType: 'continuous' },
    'A-WALL-INT': { id: 'A-WALL-INT', name: 'A-WALL-INT', visible: true, locked: false, frozen: false, plottable: true, color: '#a1887f', thickness: 0.25, lineType: 'continuous' },
    'A-DOOR': { id: 'A-DOOR', name: 'A-DOOR', visible: true, locked: false, frozen: false, plottable: true, color: '#ffb74d', thickness: 0.18, lineType: 'continuous' },
    'A-WINDOW': { id: 'A-WINDOW', name: 'A-WINDOW', visible: true, locked: false, frozen: false, plottable: true, color: '#4fc3f7', thickness: 0.18, lineType: 'continuous' },
    'A-COLS': { id: 'A-COLS', name: 'A-COLS', visible: true, locked: false, frozen: false, plottable: true, color: '#e53935', thickness: 0.40, lineType: 'continuous' },
    'A-BEAMS': { id: 'A-BEAMS', name: 'A-BEAMS', visible: true, locked: false, frozen: false, plottable: true, color: '#26a69a', thickness: 0.15, lineType: 'dashed' },
    'A-FURN': { id: 'A-FURN', name: 'A-FURN', visible: true, locked: false, frozen: false, plottable: true, color: '#81c784', thickness: 0.15, lineType: 'continuous' },
    'A-TEXT': { id: 'A-TEXT', name: 'A-TEXT', visible: true, locked: false, frozen: false, plottable: true, color: '#e0e0e0', thickness: 0.18, lineType: 'continuous' },
    'A-DIM': { id: 'A-DIM', name: 'A-DIM', visible: true, locked: false, frozen: false, plottable: true, color: '#90a4ae', thickness: 0.15, lineType: 'continuous' }
  };

  const plotW = 12000;
  const plotH = 18000;
  
  const minX = 1000;
  const maxX = 11000;
  const minY = 2000;
  const maxY = 17000;

  // --- 1. PLOT LAYER (A-GRID) ---
  // Boundary Box
  layers['A-GRID'].push({
    id: uuid(),
    type: 'rect',
    layer: 'A-GRID',
    x: 0,
    y: 0,
    width: plotW,
    height: plotH,
    color: '#ffeb3b',
  } as RectShape);

  // Setback Boundary Dashed Lines
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: minX, y1: minY, x2: maxX, y2: minY, lineType: 'dashed' } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: maxX, y1: minY, x2: maxX, y2: maxY, lineType: 'dashed' } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: maxX, y1: maxY, x2: minX, y2: maxY, lineType: 'dashed' } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: minX, y1: maxY, x2: minX, y2: minY, lineType: 'dashed' } as LineShape);

  // North Indicator
  const nx = 11300;
  const ny = 1000;
  layers['A-GRID'].push({ id: uuid(), type: 'circle', layer: 'A-GRID', x: nx, y: ny, radius: 250 } as CircleShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: nx, y1: ny - 350, x2: nx, y2: ny + 350 } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: nx - 80, y1: ny - 150, x2: nx, y2: ny - 350 } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'line', layer: 'A-GRID', x1: nx + 80, y1: ny - 150, x2: nx, y2: ny - 350 } as LineShape);
  layers['A-GRID'].push({ id: uuid(), type: 'mtext', layer: 'A-GRID', x: nx, y: ny - 500, width: 200, size: 200, content: 'N', justification: 'center' } as MTextShape);

  // --- 2. STRUCTURAL COLUMNS & BEAMS (A-COLS & A-BEAMS) ---
  const cols = [
    { x: minX, y: minY }, { x: 5000, y: minY }, { x: 7000, y: minY }, { x: maxX, y: minY },
    { x: minX, y: 5000 }, { x: 6500, y: 5000 }, { x: 11000, y: 5000 },
    { x: minX, y: 9000 }, { x: 5500, y: 9000 }, { x: 9500, y: 9000 }, { x: maxX, y: 9000 },
    { x: minX, y: 13000 }, { x: 2500, y: 13000 }, { x: 5500, y: 13000 }, { x: 7500, y: 13000 }, { x: maxX, y: 13000 },
    { x: minX, y: 17000 }, { x: 2500, y: 17000 }, { x: 5500, y: 17000 }, { x: 11000, y: 17000 }
  ];

  cols.forEach(c => {
    // Drawing columns as filled rectangles
    layers['A-COLS'].push({
      id: uuid(),
      type: 'rect',
      layer: 'A-COLS',
      x: c.x - 150,
      y: c.y - 150,
      width: 300,
      height: 300,
      filled: true,
      color: '#e53935'
    } as any);
  });

  // Structural beams joining column lines
  // Horizontal beams
  const horizBeams = [
    { y: minY, x1: minX, x2: maxX },
    { y: 5000, x1: minX, x2: maxX },
    { y: 9000, x1: minX, x2: maxX },
    { y: 13000, x1: minX, x2: maxX },
    { y: 17000, x1: minX, x2: maxX }
  ];
  horizBeams.forEach(b => {
    layers['A-BEAMS'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-BEAMS',
      x1: b.x1,
      y1: b.y,
      x2: b.x2,
      y2: b.y,
      lineType: 'dashed',
    } as LineShape);
  });

  // Vertical beams
  const vertBeams = [
    { x: minX, y1: minY, y2: maxY },
    { x: 5000, y1: minY, y2: 5000 },
    { x: 7000, y1: minY, y2: 5000 },
    { x: 6500, y1: 5000, y2: 9000 },
    { x: 5500, y1: 9000, y2: 17000 },
    { x: 2500, y1: 13000, y2: 17000 },
    { x: 7500, y1: 13000, y2: 17000 },
    { x: maxX, y1: minY, y2: maxY }
  ];
  vertBeams.forEach(b => {
    layers['A-BEAMS'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-BEAMS',
      x1: b.x,
      y1: b.y1,
      x2: b.x,
      y2: b.y2,
      lineType: 'dashed',
    } as LineShape);
  });

  // --- 3. WALLS & DOORWAY OPENINGS (A-WALL & A-WALL-INT) ---
  // A structural draft maps lines with thickness representing walls. 
  // We specify double lines or solid thick single lines. Let's paint the full layout.
  // External walls (thickness 230)
  const extWalls = [
    // Bottom external
    { x1: minX, y1: minY, x2: maxX, y2: minY, t: 230 },
    // Top external
    { x1: minX, y1: maxY, x2: maxX, y2: maxY, t: 230 },
    // Left external
    { x1: minX, y1: minY, x2: minX, y2: maxY, t: 230 },
    // Right external
    { x1: maxX, y1: minY, x2: maxX, y2: maxY, t: 230 }
  ];
  // Subtractions for openings made natively by drawing discrete segments or specifying thick lines
  extWalls.forEach(w => {
    layers['A-WALL'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-WALL',
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
      thickness: w.t,
    } as LineShape);
  });

  // Internal walls partitions (thickness 115)
  const intWalls = [
    // Partition Y=5000
    { x1: minX, y1: 5000, x2: maxX, y2: 5000, t: 115 },
    // Partition Y=9000
    { x1: minX, y1: 9000, x2: maxX, y2: 9000, t: 115 },
    // Partition Y=13000
    { x1: minX, y1: 13000, x2: maxX, y2: 13000, t: 115 },
    // Split vertical rooms (Foyer/Living)
    { x1: 5000, y1: minY, x2: 5000, y2: 5000, t: 115 },
    // Foyer/Staircase partition
    { x1: 7000, y1: minY, x2: 7000, y2: 5000, t: 115 },
    // Split vertical guest bedroom
    { x1: 6500, y1: 5000, x2: 6500, y2: 9000, t: 115 },
    // Kitchen wall split
    { x1: 5500, y1: 9000, x2: 5500, y2: 13000, t: 115 },
    // Utility wall split
    { x1: 9500, y1: 9000, x2: 9500, y2: 13000, t: 115 },
    // Attached toilet split
    { x1: 2500, y1: 13000, x2: 2500, y2: 17000, t: 115 },
    // Dresser horizontal partition
    { x1: minX, y1: 14800, x2: 2500, y2: 14800, t: 115 },
    // Common bathroom partition
    { x1: 5500, y1: 13000, x2: 5500, y2: 17000, t: 115 },
    // Bedroom 2 wall split
    { x1: 7500, y1: 13000, x2: 7500, y2: 17000, t: 115 }
  ];
  intWalls.forEach(w => {
    layers['A-WALL-INT'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-WALL-INT',
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
      thickness: w.t,
    } as LineShape);
  });

  // --- 4. DOORS (A-DOOR) ---
  // Proper swing representations for door frames
  const doors = [
    // Entrance main door (swings into foyer, right hinged)
    { x: 5000, y: 2000, w: 900, orient: 'right' as const },
    // Living room door from Foyer
    { x: 5000, y: 5000, w: 900, orient: 'up' as const },
    // Bedroom 3 (Guest) from Living
    { x: 6500, y: 7000, w: 900, orient: 'right' as const },
    // Master Bedroom 1 from Corridor
    { x: 5500, y: 13000, w: 900, orient: 'left' as const },
    // Dressing Area to Bathroom
    { x: 2500, y: 14000, w: 750, orient: 'down' as const },
    // Bed 1 to Dressing 
    { x: 2500, y: 16000, w: 800, orient: 'up' as const },
    // Common Bathroom 
    { x: 5500, y: 14500, w: 750, orient: 'right' as const },
    // Bedroom 2 (Kids)
    { x: 7500, y: 13000, w: 900, orient: 'right' as const },
    // Kitchen door
    { x: 5500, y: 10500, w: 900, orient: 'down' as const },
    // Utility door
    { x: 9500, y: 11500, w: 750, orient: 'right' as const }
  ];
  doors.forEach(d => {
    layers['A-DOOR'].push(...generateDoorAssembly(d.x, d.y, d.w, d.orient));
  });

  // --- 5. WINDOWS (A-WINDOW) ---
  // Beautiful glass panels with sliding guidelines on external walls
  const windows = [
    // Entrance
    { x: 6000, y: minY, size: 1000, orient: 'horizontal' as const },
    // Living room windows
    { x: minX, y: 7000, size: 2000, orient: 'vertical' as const },
    // Guest Bedroom window
    { x: maxX, y: 7000, size: 1500, orient: 'vertical' as const },
    { x: 8750, y: 5000, size: 1200, orient: 'horizontal' as const },
    // Dining room window
    { x: minX, y: 11000, size: 1800, orient: 'vertical' as const },
    // Kitchen window
    { x: 7500, y: 9000, size: 1500, orient: 'horizontal' as const },
    // Utility ventilator
    { x: maxX, y: 11000, size: 800, orient: 'vertical' as const },
    // Attached bathroom ventilator (high level and narrow)
    { x: minX, y: 13900, size: 600, orient: 'vertical' as const },
    // Master Bedroom windows
    { x: 4000, y: maxY, size: 1800, orient: 'horizontal' as const },
    // Common bathroom ventilator
    { x: 6500, y: maxY, size: 600, orient: 'horizontal' as const },
    // Kids Bedroom window
    { x: 9250, y: maxY, size: 1800, orient: 'horizontal' as const }
  ];
  windows.forEach(w => {
    layers['A-WINDOW'].push(...generateWindowAssembly(w.x, w.y, w.size, w.orient, w.orient === 'horizontal' ? 230 : 230));
  });

  // --- 6. STAIRCASES (A-FURN) ---
  // Dedicated Stair run: Flight 1, landing, Flight 2
  // Stairs seat in compartment: 7000, 2000 to 11000, 5000 (width 4000, height 3000)
  // Inside the compartment, landing is Y=2000 to Y=2900.
  // Flights run in Y direction (2900 to 5000)
  // Let's draw the landing
  layers['A-FURN'].push({
    id: uuid(),
    type: 'rect',
    layer: 'A-FURN',
    x: 7000,
    y: 2000,
    width: 4000,
    height: 900
  } as RectShape);

  // Split down middle of stairwell
  layers['A-FURN'].push({
    id: uuid(),
    type: 'line',
    layer: 'A-FURN',
    x1: 9000,
    y1: 2900,
    x2: 9000,
    y2: 5000
  } as LineShape);

  // Draw 10 steps on Flight 1 (UP)
  const f1_x1 = 7000;
  const f1_x2 = 9000;
  let treadCount = 8;
  let gap = (5000 - 2900) / treadCount;
  for (let i = 0; i <= treadCount; i++) {
    const yStep = 2900 + i * gap;
    layers['A-FURN'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-FURN',
      x1: f1_x1,
      y1: yStep,
      x2: f1_x2,
      y2: yStep
    } as LineShape);
  }

  // Draw steps on Flight 2 (UP Continued to First floor)
  const f2_x1 = 9000;
  const f2_x2 = 11000;
  for (let i = 0; i <= treadCount; i++) {
    const yStep = 2900 + i * gap;
    layers['A-FURN'].push({
      id: uuid(),
      type: 'line',
      layer: 'A-FURN',
      x1: f2_x1,
      y1: yStep,
      x2: f2_x2,
      y2: yStep
    } as LineShape);
  }

  // Arrow representing climb sequence (UP direction)
  layers['A-FURN'].push({ id: uuid(), type: 'line', layer: 'A-FURN', x1: 8000, y1: 4800, x2: 8000, y2: 3000 } as LineShape);
  layers['A-FURN'].push({ id: uuid(), type: 'line', layer: 'A-FURN', x1: 8000, y1: 3000, x2: 10000, y2: 3000 } as LineShape);
  layers['A-FURN'].push({ id: uuid(), type: 'line', layer: 'A-FURN', x1: 10000, y1: 3000, x2: 10000, y2: 4500 } as LineShape);
  // Arrow head on upper flight
  layers['A-FURN'].push({ id: uuid(), type: 'line', layer: 'A-FURN', x1: 9850, y1: 4350, x2: 10000, y2: 4500 } as LineShape);
  layers['A-FURN'].push({ id: uuid(), type: 'line', layer: 'A-FURN', x1: 10150, y1: 4350, x2: 10000, y2: 4500 } as LineShape);

  // Text indicating climbing direction on Stairs
  layers['A-TEXT'].push({
    id: uuid(),
    type: 'mtext',
    layer: 'A-TEXT',
    x: 8000,
    y: 4900,
    width: 600,
    size: 150,
    content: 'UP',
    justification: 'center'
  } as MTextShape);

  // --- 7. FURNITURE ASSEMBLIES (A-FURN) ---
  // Let us draw detailed, recognizable assets:
  // Living room Sectional Sofa
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 1300, y: 5500, width: 3500, height: 850 } as RectShape); // Back sofa run
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 1300, y: 6350, width: 850, height: 1800 } as RectShape); // Sofa chaise extension
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 2600, y: 6800, width: 1200, height: 750 } as RectShape); // Coffee table
  // Television Cabinet/Console
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 5600, y: 6000, width: 600, height: 2000 } as RectShape);

  // Guest Bedroom Bed (Bed 3)
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 7500, y: 5300, width: 1600, height: 1900 } as RectShape); // Frame
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 7650, y: 5400, width: 550, height: 350 } as RectShape); // Pillow 1
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 8400, y: 5400, width: 550, height: 350 } as RectShape); // Pillow 2
  // Nightstands
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 7050, y: 5300, width: 400, height: 400 } as RectShape);
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 9150, y: 5300, width: 400, height: 400 } as RectShape);
  // Wardrobe
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 9800, y: 6200, width: 950, height: 2200 } as RectShape);

  // Dining Room Table & Chairs (For 6 People)
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 2000, y: 10500, width: 1800, height: 1000 } as RectShape); // Table
  // Chairs (drawn neatly)
  const cOffset = [2200, 2900, 3600];
  cOffset.forEach(ox => {
    layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: ox - 180, y: 10100, width: 360, height: 350 } as RectShape); // Bottom chair row
    layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: ox - 180, y: 11550, width: 360, height: 350 } as RectShape); // Top chair row
  });

  // Kitchen Modular Countertops
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 5500, y: 11200, width: 3000, height: 600 } as RectShape); // Bottom horizontal sink run
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 8000, y: 9200, width: 1200, height: 2000 } as RectShape); // Burner stove corner
  // Sink representation (Rectangle with an inner circle)
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 6000, y: 11250, width: 600, height: 450 } as RectShape);
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 6300, y: 11475, radius: 100 } as CircleShape);
  // Stove Burners
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 8600, y: 9800, radius: 150 } as CircleShape);
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 8600, y: 10300, radius: 150 } as CircleShape);

  // Utility Appliance Counter
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 9600, y: 9200, width: 1100, height: 650 } as RectShape); // Washer machine
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 10150, y: 9525, radius: 250 } as CircleShape); // Inner wash drum door

  // Master Bedroom Bed (Bed 1)
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 3000, y: 14800, width: 1900, height: 1800 } as RectShape);
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 3150, y: 16200, width: 650, height: 350 } as RectShape); // Pillow 1
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 4100, y: 16200, width: 650, height: 350 } as RectShape); // Pillow 2

  // Attached toilet fixtures
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 1100, y: 13100, width: 700, height: 600 } as RectShape); // WC
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 1450, y: 13400, radius: 150 } as CircleShape); // Oval WC flush
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 2100, y: 14200, radius: 150 } as CircleShape); // Wash basin

  // Common bathroom fixtures
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 5600, y: 16100, width: 1500, height: 800 } as RectShape); // Shower bed
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 5700, y: 13200, width: 700, height: 600 } as RectShape); // WC
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 6050, y: 13500, radius: 150 } as CircleShape);
  layers['A-FURN'].push({ id: uuid(), type: 'circle', layer: 'A-FURN', x: 6900, y: 14400, radius: 200 } as CircleShape); // Basin

  // Kids Bedroom twin beds
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 7700, y: 14800, width: 1200, height: 1800 } as RectShape); // Bed A
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 7800, y: 16100, width: 1000, height: 350 } as RectShape);
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 9500, y: 14800, width: 1200, height: 1800 } as RectShape); // Bed B
  layers['A-FURN'].push({ id: uuid(), type: 'rect', layer: 'A-FURN', x: 9600, y: 16100, width: 1000, height: 350 } as RectShape);

  // --- 8. ANNOTATIONS & TEXT LABELS (A-TEXT) ---
  const labelRooms = [
    { name: 'Front Porch\n(Verandah)', x1: 1000, y1: 2000, x2: 5000, y2: 5000, area: 12.0 },
    { name: 'Entrance Foyer', x1: 5000, y1: 2000, x2: 7000, y2: 5000, area: 6.0 },
    { name: 'Staircase Provision', x1: 7000, y1: 2000, x2: 11000, y2: 5000, area: 12.0 },
    { name: 'Living Room', x1: 1000, y1: 5000, x2: 6500, y2: 9000, area: 22.0 },
    { name: 'Guest Bedroom\n(Bedroom 3)', x1: 6500, y1: 5000, x2: 11000, y2: 9000, area: 18.0 },
    { name: 'Dining Area', x1: 1000, y1: 9000, x2: 5500, y2: 13000, area: 18.0 },
    { name: 'Kitchen', x1: 5500, y1: 9000, x2: 9500, y2: 13000, area: 16.0 },
    { name: 'Utility Yard', x1: 9500, y1: 9000, x2: 11000, y2: 13000, area: 6.0 },
    { name: 'Attached Bath\n(Toilet)', x1: 1000, y1: 13000, x2: 2500, y2: 14800, area: 2.7 },
    { name: 'Dressing Walkway', x1: 1000, y1: 14800, x2: 2500, y2: 17000, area: 3.3 },
    { name: 'Master Bedroom\n(Bedroom 1)', x1: 2500, y1: 13000, x2: 5500, y2: 17000, area: 12.0 },
    { name: 'Common Bathroom', x1: 5500, y1: 13000, x2: 7500, y2: 17000, area: 8.0 },
    { name: 'Kids Bedroom\n(Bedroom 2)', x1: 7500, y1: 13000, x2: 11000, y2: 17000, area: 14.0 }
  ];

  labelRooms.forEach(r => {
    const cx = Math.round((r.x1 + r.x2) / 2);
    const cy = Math.round((r.y1 + r.y2) / 2);
    const w = r.x2 - r.x1;
    const h = r.y2 - r.y1;
    
    // Calculate display dimensions in meters
    const mStrW = (w / 1000).toFixed(1);
    const mStrH = (h / 1000).toFixed(1);
    const displayContent = `${r.name}\\n${mStrW}m × ${mStrH}m\\n${r.area.toFixed(1)} m²`;

    layers['A-TEXT'].push({
      id: uuid(),
      type: 'mtext',
      layer: 'A-TEXT',
      x: cx,
      // Adjust offset vertically if room name is long or overlapping furniture
      y: r.name.includes('Bathroom') ? cy + 300 : cy,
      width: Math.max(200, Math.min(w - 200, 3000)),
      size: 180,
      content: displayContent,
      justification: 'center'
    } as MTextShape);
  });

  // Footer Building summary text
  layers['A-TEXT'].push({
    id: uuid(),
    type: 'mtext',
    layer: 'A-TEXT',
    x: 6000,
    y: 17650,
    width: 8000,
    size: 250,
    content: 'GROUND FLOOR PLAN // TOTAL BUILT AREA: 150.0m² // PLOT: 12m × 18m',
    justification: 'center'
  } as MTextShape);

  // --- 9. DIMENSION MARGINS (A-DIM) ---
  // Aligned dimension strings across sides indicating plot widths and offsets
  // Overall spans
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: 0, y1: -500, x2: plotW, y2: -500, dimX: plotW / 2, dimY: -400, text: '12.0 m' } as DimensionShape);
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: -500, y1: 0, x2: -500, y2: plotH, dimX: -400, dimY: plotH / 2, text: '18.0 m' } as DimensionShape);

  // Buildable spans showing setbacks
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: minX, y1: minY - 400, x2: maxX, y2: minY - 400, dimX: (minX+maxX)/2, dimY: minY - 300, text: '10.0 m (Cushion Width)' } as DimensionShape);
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: minX - 400, y1: minY, x2: minX - 400, y2: maxY, dimX: minX - 300, dimY: (minY+maxY)/2, text: '15.0 m (Cushion Depth)' } as DimensionShape);

  // Setback clearances
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: 0, y1: minY - 200, x2: minX, y2: minY - 200, dimX: minX / 2, dimY: minY - 100, text: '1.0m Setback' } as DimensionShape);
  layers['A-DIM'].push({ id: uuid(), type: 'dimension', dimType: 'linear', layer: 'A-DIM', x1: 0, y1: minY - 600, x2: 0, y2: minY, dimX: -200, dimY: minY / 2, text: '2.0m Front setback' } as DimensionShape);

  return { layers, layerConfigs };
}
