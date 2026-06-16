/**
 * VoxCADD Professional Architectural Snapping & Validation Engine
 * Align and validate generated CAD vectors with strict building codes and standard grid alignments.
 */

export interface SnappedCommandResult {
  original: string;
  snapped: string;
  type: 'LINE' | 'WALL' | 'RECTANGLE' | 'CIRCLE' | 'TEXT' | 'DIMENSION' | 'UNKNOWN';
  layer: string;
  changes: string[];
}

export interface SnappingEngineReport {
  originalCommands: string[];
  snappedCommands: string[];
  entities: SnappedCommandResult[];
  logs: string[];
  wallValidationPassed: boolean;
  wallErrorsCount: number;
}

// Helper to round coordinates to the nearest multiple of 50 or 100, while preserving precise dimensions (115, 230, 300, 750, 900)
function snapVal(val: number): { value: number; changeReason: string | null } {
  const rounded = Math.round(val);
  
  // Specific architectural dimension exceptions
  const exceptions = [
    { target: 115, tolerance: 25, label: "115mm (Partition Wall)" },
    { target: 230, tolerance: 25, label: "230mm (Perimeter Wall)" },
    { target: 300, tolerance: 30, label: "300mm (RCC Column Width)" },
    { target: 750, tolerance: 40, label: "750mm (Bath Door Swing)" },
    { target: 900, tolerance: 40, label: "900mm (Main Door Swing)" },
    { target: 1500, tolerance: 60, label: "1500mm (Standard Window)" },
    { target: 1800, tolerance: 60, label: "1800mm (Glazed Slider)" }
  ];

  for (const exp of exceptions) {
    if (Math.abs(rounded - exp.target) <= exp.tolerance) {
      if (rounded !== exp.target) {
        return { value: exp.target, changeReason: `Snapped coordinate delta to standard ${exp.label}` };
      }
      return { value: exp.target, changeReason: null };
    }
  }

  // Otherwise, default snap to nearest 100mm, fallback to 50mm
  const mod100 = rounded % 100;
  const mod50 = rounded % 50;

  if (Math.abs(mod100) <= 25) {
    const newVal = Math.round(rounded / 100) * 100;
    if (newVal !== rounded) {
      return { value: newVal, changeReason: "Aligned to 100mm major architectural grid" };
    }
  } else if (Math.abs(mod50) <= 15) {
    const newVal = Math.round(rounded / 50) * 50;
    if (newVal !== rounded) {
      return { value: newVal, changeReason: "Aligned to 50mm secondary circulation grid" };
    }
  }

  return { value: rounded, changeReason: null };
}

export function validateAndSnapCommands(commands: string[]): SnappingEngineReport {
  const snappedCommands: string[] = [];
  const entities: SnappedCommandResult[] = [];
  const logs: string[] = [];
  let currentLayer = "0";
  let wallErrorsCount = 0;

  for (const cmd of commands) {
    const trimmed = cmd.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    const op = parts[0].toLowerCase();

    // Track active layer
    if (op === 'la' && parts.length > 1) {
      currentLayer = parts[1];
      snappedCommands.push(trimmed);
      entities.push({
        original: trimmed,
        snapped: trimmed,
        type: 'UNKNOWN',
        layer: currentLayer,
        changes: []
      });
      continue;
    }

    // 1. Double Line Wall Command: dl [thickness] x1,y1 x2,y2
    if (op === 'dl' && parts.length >= 4) {
      let thickness = parseInt(parts[1]) || 230;
      const pt1Str = parts[2];
      const pt2Str = parts[3];
      const changes: string[] = [];

      // Validate standard wall thickness (230m or 115m)
      if (thickness !== 230 && thickness !== 115) {
        const correctThick = thickness < 172 ? 115 : 230;
        changes.push(`Corrected arbitrary wall width ${thickness}mm to standard ${correctThick}mm`);
        thickness = correctThick;
        wallErrorsCount++;
      }

      // Parse endpoints
      const [x1Raw, y1Raw] = pt1Str.split(',').map(Number);
      const [x2Raw, y2Raw] = pt2Str.split(',').map(Number);

      if (isNaN(x1Raw) || isNaN(y1Raw) || isNaN(x2Raw) || isNaN(y2Raw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      // Snap coordinates
      const sX1 = snapVal(x1Raw);
      const sY1 = snapVal(y1Raw);
      const sX2 = snapVal(x2Raw);
      const sY2 = snapVal(y2Raw);

      let x1 = sX1.value;
      let y1 = sY1.value;
      let x2 = sX2.value;
      let y2 = sY2.value;

      if (sX1.changeReason) changes.push(`P1 (X): ${sX1.changeReason}`);
      if (sY1.changeReason) changes.push(`P1 (Y): ${sY1.changeReason}`);
      if (sX2.changeReason) changes.push(`P2 (X): ${sX2.changeReason}`);
      if (sY2.changeReason) changes.push(`P2 (Y): ${sY2.changeReason}`);

      // Forced parallel Snapping: align orthogonal angles to perfect 0 or 90 degrees
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);

      if (dy > 0 && dy < 60) {
        changes.push(`Forced horizontal snap (aligned slightly tilted line of dy=${dy} to perfect horizontal)`);
        y2 = y1;
      } else if (dx > 0 && dx < 60) {
        changes.push(`Forced vertical snap (aligned slightly tilted line of dx=${dx} to perfect vertical)`);
        x2 = x1;
      }

      const snpCmd = `dl ${thickness} ${x1},${y1} ${x2},${y2}`;
      snappedCommands.push(snpCmd);

      if (changes.length > 0) {
        logs.push(`[WALL REPAIR] ${changes.join(' | ')}`);
      }

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'WALL',
        layer: currentLayer,
        changes
      });
      continue;
    }

    // 2. Standard Single Line Command: l x1,y1 x2,y2
    if (op === 'l' && parts.length >= 3) {
      const pt1Str = parts[1];
      const pt2Str = parts[2];
      const changes: string[] = [];

      const [x1Raw, y1Raw] = pt1Str.split(',').map(Number);
      const [x2Raw, y2Raw] = pt2Str.split(',').map(Number);

      if (isNaN(x1Raw) || isNaN(y1Raw) || isNaN(x2Raw) || isNaN(y2Raw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      const sX1 = snapVal(x1Raw);
      const sY1 = snapVal(y1Raw);
      const sX2 = snapVal(x2Raw);
      const sY2 = snapVal(y2Raw);

      let x1 = sX1.value;
      let y1 = sY1.value;
      let x2 = sX2.value;
      let y2 = sY2.value;

      if (sX1.changeReason) changes.push(`P1 (X): ${sX1.changeReason}`);
      if (sY1.changeReason) changes.push(`P1 (Y): ${sY1.changeReason}`);
      if (sX2.changeReason) changes.push(`P2 (X): ${sX2.changeReason}`);
      if (sY2.changeReason) changes.push(`P2 (Y): ${sY2.changeReason}`);

      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);

      if (dy > 0 && dy < 60) {
        changes.push("Aligned parallel lines of dy < 60 to horizontal plane");
        y2 = y1;
      } else if (dx > 0 && dx < 60) {
        changes.push("Aligned parallel lines of dx < 60 to vertical plane");
        x2 = x1;
      }

      const snpCmd = `l ${x1},${y1} ${x2},${y2}`;
      snappedCommands.push(snpCmd);

      if (changes.length > 0) {
        logs.push(`[LINE SNAP] ${changes.join(' | ')}`);
      }

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'LINE',
        layer: currentLayer,
        changes
      });
      continue;
    }

    // 3. Rectangle Command: rec x1,y1 x2,y2 [filled] [color]
    if (op === 'rec' && parts.length >= 3) {
      const pt1Str = parts[1];
      const pt2Str = parts[2];
      const filled = parts[3] || '';
      const color = parts[4] || '';
      const changes: string[] = [];

      const [x1Raw, y1Raw] = pt1Str.split(',').map(Number);
      const [x2Raw, y2Raw] = pt2Str.split(',').map(Number);

      if (isNaN(x1Raw) || isNaN(y1Raw) || isNaN(x2Raw) || isNaN(y2Raw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      let sX1 = snapVal(x1Raw).value;
      let sY1 = snapVal(y1Raw).value;
      let sX2 = snapVal(x2Raw).value;
      let sY2 = snapVal(y2Raw).value;

      // Check column snapping for A-COLS layer (force 300x300)
      if (currentLayer === 'A-COLS' || currentLayer === 'A-COLS') {
        const w = Math.abs(sX2 - sX1);
        const h = Math.abs(sY2 - sY1);
        if (Math.abs(w - 300) <= 50 || Math.abs(h - 300) <= 50) {
          if (w !== 300 || h !== 300) {
            changes.push(`Snapped structural column dimension of ${w}x${h}mm to standard 300x300mm core column`);
            sX2 = sX1 + 300;
            sY2 = sY1 + 300;
          }
        }
      }

      const fillingStr = filled ? ` ${filled}` : '';
      const colorStr = color ? ` ${color}` : '';
      const snpCmd = `rec ${sX1},${sY1} ${sX2},${sY2}${fillingStr}${colorStr}`;
      snappedCommands.push(snpCmd);

      if (changes.length > 0) {
        logs.push(`[RECT ALIGN] ${changes.join(' | ')}`);
      }

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'RECTANGLE',
        layer: currentLayer,
        changes
      });
      continue;
    }

    // 4. Circle Command: c x,y radius
    if (op === 'c' && parts.length >= 3) {
      const ptStr = parts[1];
      const rRaw = Number(parts[2]);
      const changes: string[] = [];

      const [xRaw, yRaw] = ptStr.split(',').map(Number);
      if (isNaN(xRaw) || isNaN(yRaw) || isNaN(rRaw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      const sX = snapVal(xRaw).value;
      const sY = snapVal(yRaw).value;
      const sR = snapVal(rRaw).value;

      if (sX !== xRaw || sY !== yRaw || sR !== rRaw) {
        changes.push(`Cleaned up circle position and radius to solid increments`);
      }

      const snpCmd = `c ${sX},${sY} ${sR}`;
      snappedCommands.push(snpCmd);

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'CIRCLE',
        layer: currentLayer,
        changes
      });
      continue;
    }

    // 5. Dimension Command: dim x1,y1 x2,y2 [override]
    if (op === 'dim' && parts.length >= 3) {
      const pt1Str = parts[1];
      const pt2Str = parts[2];
      const opt = parts.slice(3).join(' ');

      const [x1Raw, y1Raw] = pt1Str.split(',').map(Number);
      const [x2Raw, y2Raw] = pt2Str.split(',').map(Number);

      if (isNaN(x1Raw) || isNaN(y1Raw) || isNaN(x2Raw) || isNaN(y2Raw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      const sX1 = snapVal(x1Raw).value;
      const sY1 = snapVal(y1Raw).value;
      const sX2 = snapVal(x2Raw).value;
      const sY2 = snapVal(y2Raw).value;

      const optStr = opt ? ` ${opt}` : '';
      const snpCmd = `dim ${sX1},${sY1} ${sX2},${sY2}${optStr}`;
      snappedCommands.push(snpCmd);

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'DIMENSION',
        layer: currentLayer,
        changes: []
      });
      continue;
    }

    // 6. Text label: mt x,y [textValue]
    if (op === 'mt' && parts.length >= 3) {
      const ptStr = parts[1];
      const txt = parts.slice(2).join(' ');

      const [xRaw, yRaw] = ptStr.split(',').map(Number);
      if (isNaN(xRaw) || isNaN(yRaw)) {
        snappedCommands.push(trimmed);
        continue;
      }

      const sX = snapVal(xRaw).value;
      const sY = snapVal(yRaw).value;

      const snpCmd = `mt ${sX},${sY} ${txt}`;
      snappedCommands.push(snpCmd);

      entities.push({
        original: trimmed,
        snapped: snpCmd,
        type: 'TEXT',
        layer: currentLayer,
        changes: []
      });
      continue;
    }

    // Pass through other commands completely untouched (like structgrid, photodraft, suggestlayout, autodim)
    snappedCommands.push(trimmed);
  }

  return {
    originalCommands: commands,
    snappedCommands,
    entities,
    logs,
    wallValidationPassed: wallErrorsCount === 0,
    wallErrorsCount
  };
}
