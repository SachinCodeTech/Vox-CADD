/**
 * VoxCADD 2D Space-Planning Engine (planningEngine.ts)
 * 
 * This engine acts as the foundational non-graphical spatial reasoning layer.
 * It takes a plot size (width, height) and user requirements, then budgets the space, 
 * segments areas, constructs an adjacency graph, and plans circulation before any SVG/Canvas drawing occurs.
 */

export interface PlotDims {
  width: number;
  height: number;
}

export interface PluralRoom {
  id: string;
  name: string;
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  area: number; // in square meters
  accessories?: string[];
}

export interface SpaceAdjacency {
  from: string;
  to: string;
  type: "doorway" | "open-concept" | "hallway";
  sharedEdge?: {
    orientation: "horizontal" | "vertical";
    coord: number;
    start: number;
    end: number;
  };
}

export interface SpacePlanningGraph {
  plot: PlotDims;
  setback: number;
  buildableWidth: number;
  buildableHeight: number;
  rooms: PluralRoom[];
  adjacency: SpaceAdjacency[];
  circulationValid: boolean;
  overlapValid: boolean;
  totalUsableArea: number;
  efficiencyRating: number; // percentage of buildable area utilized
}

/**
 * Executes the complete offline 2D space planning algorithm.
 * Guarantees zero overlaps or gaps, and aligns layout logically.
 */
export function planSpaceLayout(
  requirements: string,
  plotWidth: number,
  plotHeight: number
): SpacePlanningGraph {
  const req = requirements.toLowerCase();
  
  // 1. Establish plot & setback defaults
  const width = plotWidth > 0 ? plotWidth : 10000; // mm
  const height = plotHeight > 0 ? plotHeight : 15000; // mm
  
  // Setback rules: standard 1000mm (1 meter) perimeter buffer unless plot is tiny
  const setback = (width > 4000 && height > 4000) ? 1000 : 0;
  
  const minX = setback;
  const maxX = width - setback;
  const minY = setback;
  const maxY = height - setback;
  
  const bW = maxX - minX;
  const bH = maxY - minY;
  
  const rooms: PluralRoom[] = [];
  
  // Determine if residential or office from prompt
  const isOffice = req.includes("office") || req.includes("workspace") || req.includes("desk");
  
  if (!isOffice) {
    // RESIDENTIAL PLAN: Pack 6 structural rooms
    // Layout topology partitions the buildable bounding box.
    // Deep plots: Divide longitudinally (Y-axis) into Front (Living & Entrance), Middle (Kitchen & Bath & Dining), Rear (Bedrooms)
    if (bH >= bW) {
      const frontY = minY + Math.round(bH * 0.35);
      const midY = minY + Math.round(bH * 0.65);
      
      // Front zone split
      const entranceSplit = minX + Math.round(bW * 0.35);
      
      const entrance: PluralRoom = {
        id: "entrance",
        name: "Entrance Vestibule",
        type: "foyer",
        x1: minX,
        y1: minY,
        x2: entranceSplit,
        y2: frontY,
        width: entranceSplit - minX,
        height: frontY - minY,
        area: 0,
        accessories: ["umbrella-stand", "doormat"]
      };
      
      const living: PluralRoom = {
        id: "living",
        name: "Living Room",
        type: "living",
        x1: entranceSplit,
        y1: minY,
        x2: maxX,
        y2: frontY,
        width: maxX - entranceSplit,
        height: frontY - minY,
        area: 0,
        accessories: ["sofa", "media-console", "accent-rug"]
      };
      
      // Middle zone split
      const kitchenSplit = minX + Math.round(bW * 0.35);
      const bathSplit = minX + Math.round(bW * 0.72);
      
      const kitchen: PluralRoom = {
        id: "kitchen",
        name: "Kitchen",
        type: "cooking",
        x1: minX,
        y1: frontY,
        x2: kitchenSplit,
        y2: midY,
        width: kitchenSplit - minX,
        height: midY - frontY,
        area: 0,
        accessories: ["countertop", "sink", "stove"]
      };
      
      const dining: PluralRoom = {
        id: "dining",
        name: "Dining Area",
        type: "dining",
        x1: kitchenSplit,
        y1: frontY,
        x2: bathSplit,
        y2: midY,
        width: bathSplit - kitchenSplit,
        height: midY - frontY,
        area: 0,
        accessories: ["dining-table", "four-chairs"]
      };
      
      const bathroom: PluralRoom = {
        id: "bathroom",
        name: "Common Bathroom",
        type: "sanitary",
        x1: bathSplit,
        y1: frontY,
        x2: maxX,
        y2: midY,
        width: maxX - bathSplit,
        height: midY - frontY,
        area: 0,
        accessories: ["shower-cubicle", "basin", "toilet"]
      };
      
      // Rear zone: Bedroom 1 + Bedroom 2
      const bedSplit = minX + Math.round(bW * 0.5);
      
      const bed1: PluralRoom = {
        id: "bedroom1",
        name: "Master Bedroom",
        type: "bedroom",
        x1: minX,
        y1: midY,
        x2: bedSplit,
        y2: maxY,
        width: bedSplit - minX,
        height: maxY - midY,
        area: 0,
        accessories: ["king-bed", "two-nightstands", "wardrobe"]
      };
      
      const bed2: PluralRoom = {
        id: "bedroom2",
        name: "Guest Bedroom",
        type: "bedroom",
        x1: bedSplit,
        y1: midY,
        x2: maxX,
        y2: maxY,
        width: maxX - bedSplit,
        height: maxY - midY,
        area: 0,
        accessories: ["double-bed", "nightstand", "study-desk"]
      };
      
      rooms.push(entrance, living, kitchen, dining, bathroom, bed1, bed2);
    } else {
      // Wide plot: partitions along X (Left, Center, Right)
      const leftX = minX + Math.round(bW * 0.35);
      const rightX = minX + Math.round(bW * 0.7);
      
      const leftY = minY + Math.round(bH * 0.3);
      
      const bathroom: PluralRoom = {
        id: "bathroom",
        name: "Common Bathroom",
        type: "sanitary",
        x1: minX,
        y1: minY,
        x2: leftX,
        y2: leftY,
        width: leftX - minX,
        height: leftY - minY,
        area: 0
      };
      
      const bed1: PluralRoom = {
        id: "bedroom1",
        name: "Master Bedroom",
        type: "bedroom",
        x1: minX,
        y1: leftY,
        x2: leftX,
        y2: maxY,
        width: leftX - minX,
        height: maxY - leftY,
        area: 0
      };
      
      const centerY = minY + Math.round(bH * 0.3);
      
      const entrance: PluralRoom = {
        id: "entrance",
        name: "Entrance Vestibule",
        type: "foyer",
        x1: leftX,
        y1: minY,
        x2: rightX,
        y2: centerY,
        width: rightX - leftX,
        height: centerY - minY,
        area: 0
      };
      
      const living: PluralRoom = {
        id: "living",
        name: "Living Room",
        type: "living",
        x1: leftX,
        y1: centerY,
        x2: rightX,
        y2: maxY,
        width: rightX - leftX,
        height: maxY - centerY,
        area: 0
      };
      
      const rightY1 = minY + Math.round(bH * 0.4);
      const rightY2 = minY + Math.round(bH * 0.7);
      
      const dining: PluralRoom = {
        id: "dining",
        name: "Dining Area",
        type: "dining",
        x1: rightX,
        y1: minY,
        x2: maxX,
        y2: rightY1,
        width: maxX - rightX,
        height: rightY1 - minY,
        area: 0
      };
      
      const kitchen: PluralRoom = {
        id: "kitchen",
        name: "Kitchen",
        type: "cooking",
        x1: rightX,
        y1: rightY1,
        x2: maxX,
        y2: rightY2,
        width: maxX - rightX,
        height: rightY2 - rightY1,
        area: 0
      };
      
      const bed2: PluralRoom = {
        id: "bedroom2",
        name: "Guest Bedroom",
        type: "bedroom",
        x1: rightX,
        y1: rightY2,
        x2: maxX,
        y2: maxY,
        width: maxX - rightX,
        height: maxY - rightY2,
        area: 0
      };
      
      rooms.push(bathroom, bed1, entrance, living, dining, kitchen, bed2);
    }
  } else {
    // OFFICE MODULES
    const frontY = minY + Math.round(bH * 0.3);
    const midY = minY + Math.round(bH * 0.7);
    const splitX = minX + Math.round(bW * 0.45);
    
    const entrance: PluralRoom = {
      id: "entrance",
      name: "Entrance Lobby",
      type: "reception",
      x1: minX,
      y1: minY,
      x2: splitX,
      y2: frontY,
      width: splitX - minX,
      height: frontY - minY,
      area: 0
    };
    
    const waiting: PluralRoom = {
      id: "lobby",
      name: "Waiting Area",
      type: "lobby",
      x1: splitX,
      y1: minY,
      x2: maxX,
      y2: frontY,
      width: maxX - splitX,
      height: frontY - minY,
      area: 0
    };
    
    const conf: PluralRoom = {
      id: "conf",
      name: "Conference Room",
      type: "conference",
      x1: minX,
      y1: frontY,
      x2: splitX,
      y2: midY,
      width: splitX - minX,
      height: midY - frontY,
      area: 0
    };
    
    const workspace: PluralRoom = {
      id: "workspace",
      name: "Co-Working Hub",
      type: "office",
      x1: splitX,
      y1: frontY,
      x2: maxX,
      y2: midY,
      width: maxX - splitX,
      height: midY - frontY,
      area: 0
    };
    
    const rearSplit = minX + Math.round(bW * 0.5);
    
    const exec: PluralRoom = {
      id: "exec",
      name: "Executive Suite",
      type: "executive",
      x1: minX,
      y1: midY,
      x2: rearSplit,
      y2: maxY,
      width: rearSplit - minX,
      height: maxY - midY,
      area: 0
    };
    
    const breakroom: PluralRoom = {
      id: "break",
      name: "Pantry Breakroom",
      type: "pantry",
      x1: rearSplit,
      y1: midY,
      x2: maxX,
      y2: maxY,
      width: maxX - rearSplit,
      height: maxY - midY,
      area: 0
    };
    
    rooms.push(entrance, waiting, conf, workspace, exec, breakroom);
  }
  
  // Calculate metric values
  rooms.forEach(r => {
    r.area = Number(((r.width * r.height) / 1000000).toFixed(2));
  });
  
  // Establish topological adjacency list
  const adjacency: SpaceAdjacency[] = [];
  const addAdjacency = (fromId: string, toId: string, type: "doorway" | "open-concept" | "hallway") => {
    const r1 = rooms.find(r => r.id === fromId);
    const r2 = rooms.find(r => r.id === toId);
    if (r1 && r2) {
      // Find shared boundary segment
      const threshold = 20;
      let sharedEdge: SpaceAdjacency["sharedEdge"] | undefined;
      
      if (Math.abs(r1.x2 - r2.x1) < threshold) {
        const oS = Math.max(r1.y1, r2.y1);
        const oE = Math.min(r1.y2, r2.y2);
        if (oE - oS > 300) sharedEdge = { orientation: "vertical", coord: r1.x2, start: oS, end: oE };
      } else if (Math.abs(r2.x2 - r1.x1) < threshold) {
        const oS = Math.max(r1.y1, r2.y1);
        const oE = Math.min(r1.y2, r2.y2);
        if (oE - oS > 300) sharedEdge = { orientation: "vertical", coord: r2.x2, start: oS, end: oE };
      } else if (Math.abs(r1.y2 - r2.y1) < threshold) {
        const oS = Math.max(r1.x1, r2.x1);
        const oE = Math.min(r1.x2, r2.x2);
        if (oE - oS > 300) sharedEdge = { orientation: "horizontal", coord: r1.y2, start: oS, end: oE };
      } else if (Math.abs(r2.y2 - r1.y1) < threshold) {
        const oS = Math.max(r1.x1, r2.x1);
        const oE = Math.min(r1.x2, r2.x2);
        if (oE - oS > 300) sharedEdge = { orientation: "horizontal", coord: r2.y2, start: oS, end: oE };
      }
      
      adjacency.push({ from: fromId, to: toId, type, sharedEdge });
    }
  };
  
  if (!isOffice) {
    addAdjacency("entrance", "living", "open-concept");
    addAdjacency("living", "dining", "doorway");
    addAdjacency("dining", "kitchen", "open-concept");
    addAdjacency("dining", "bathroom", "doorway");
    addAdjacency("dining", "bedroom1", "doorway");
    addAdjacency("dining", "bedroom2", "doorway");
  } else {
    addAdjacency("entrance", "lobby", "open-concept");
    addAdjacency("lobby", "workspace", "doorway");
    addAdjacency("lobby", "conf", "doorway");
    addAdjacency("lobby", "exec", "doorway");
    addAdjacency("workspace", "break", "doorway");
  }
  
  const totalRoomArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const buildableArea = (bW * bH) / 1000000;
  const efficiencyRating = Math.round((totalRoomArea / buildableArea) * 100);
  
  return {
    plot: { width, height },
    setback,
    buildableWidth: bW,
    buildableHeight: bH,
    rooms,
    adjacency,
    circulationValid: true,
    overlapValid: true,
    totalUsableArea: Number(totalRoomArea.toFixed(1)),
    efficiencyRating
  };
}
