import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders, Play, RotateCcw, AlertCircle, Sparkles, Ruler } from 'lucide-react';
import { Shape, Point, LineShape, CircleShape, RectShape, TextShape, MTextShape, DimensionShape } from '../types';

interface SectionGeneratorPanelProps {
  layers: Record<string, Shape[]>;
  onClose: () => void;
  onUpdateAllLayers: (layers: Record<string, Shape[]>) => void;
}

const generateId = () => {
  return "sec_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36).substring(-4);
};

export default function SectionGeneratorPanel({
  layers,
  onClose,
  onUpdateAllLayers
}: SectionGeneratorPanelProps) {
  // Draggable state for floating panel
  const [pos, setPos] = useState({ x: 100, y: 150 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Custom adjustable heights (in millimeters)
  const [foundationDepth, setFoundationDepth] = useState<number>(1500);
  const [plinthHeight, setPlinthHeight] = useState<number>(600);
  const [floorHeight, setFloorHeight] = useState<number>(3150);
  const [slabThickness, setSlabThickness] = useState<number>(150);
  const [parapetHeight, setParapetHeight] = useState<number>(900);
  const [numFloors, setNumFloors] = useState<number>(2);

  const [analyzedWalls, setAnalyzedWalls] = useState<{ cx: number; thick: number; isOuter: boolean }[]>([]);
  const [detectedRooms, setDetectedRooms] = useState<{ name: string; cx: number; width: number }[]>([]);

  // Draggable panel handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
    };
    const handleEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  // Analyze floor plan geometries for section cut
  useEffect(() => {
    // 1. Gather all line/rect elements from wall layers
    const wallLayers = ['A-WALL', 'A-WALL-INT', '0'];
    const wallShapes: Shape[] = [];
    wallLayers.forEach(l => {
      if (layers[l]) {
        wallShapes.push(...layers[l]);
      }
    });

    // 2. Extract potential vertical wall lines & rects
    const wallCoords: { x: number; thick: number }[] = [];
    wallShapes.forEach(s => {
      if (!s) return;
      if (s.type === 'line') {
        const l = s as LineShape;
        const isVert = Math.abs(l.x1 - l.x2) < 20;
        if (isVert) {
          const thickness = s.layer === 'A-WALL-INT' ? 115 : 230;
          wallCoords.push({ x: (l.x1 + l.x2) / 2, thick: thickness });
        }
      } else if (s.type === 'rect') {
        const r = s as any;
        if (r.width > 0 && r.height > 1000) {
          // Vertical bounding boxes of walls
          const thickness = s.layer === 'A-WALL-INT' ? 115 : 230;
          wallCoords.push({ x: r.x + r.width / 2, thick: thickness });
        }
      } else if (s.type === 'dline') {
        const dl = s as any;
        const isVert = Math.abs(dl.x1 - dl.x2) < 20;
        if (isVert) {
          wallCoords.push({ x: (dl.x1 + dl.x2) / 2, thick: dl.thickness || 230 });
        }
      }
    });

    // 3. Cluster wall coordinates to avoid multiple near duplicates (within 350mm)
    let sorted = [...wallCoords].sort((a, b) => a.x - b.x);
    const clustered: { cx: number; thick: number; isOuter: boolean }[] = [];
    
    sorted.forEach(wc => {
      const match = clustered.find(c => Math.abs(c.cx - wc.x) < 350);
      if (match) {
        // Average coordinates and take max thickness
        match.cx = (match.cx + wc.x) / 2;
        match.thick = Math.max(match.thick, wc.thick);
      } else {
        clustered.push({ cx: wc.x, thick: wc.thick, isOuter: false });
      }
    });

    // Mark leftmost and rightmost as outer structural walls
    if (clustered.length >= 2) {
      clustered[0].isOuter = true;
      clustered[clustered.length - 1].isOuter = true;
      clustered[0].thick = 230;
      clustered[clustered.length - 1].thick = 230;
    }

    // Default template walls if none are found in the empty canvas
    const finalWalls = clustered.length >= 2 ? clustered : [
      { cx: 1000, thick: 230, isOuter: true },
      { cx: 5000, thick: 115, isOuter: false },
      { cx: 9000, thick: 230, isOuter: true }
    ];
    setAnalyzedWalls(finalWalls);

    // 4. Detect Rooms based on TEXT elements positioned between the walls
    const textLayer = layers['A-TEXT'] || [];
    const rooms: { name: string; cx: number; width: number }[] = [];

    // Loop through adjacent walls and identify rooms
    for (let i = 0; i < finalWalls.length - 1; i++) {
      const wLeft = finalWalls[i];
      const wRight = finalWalls[i+1];
      const midX = (wLeft.cx + wRight.cx) / 2;
      const span = wRight.cx - wLeft.cx;

      // Find any text layer content sitting in this coordinate zone
      const labelShape = textLayer.find(s => {
        if (!s) return false;
        const xVal = (s as any).x;
        return xVal > wLeft.cx && xVal < wRight.cx;
      });

      let roomLabel = `ROOM ${i + 1}`;
      if (labelShape) {
        const textContent = (labelShape as any).content || "";
        const lines = textContent.split('\n');
        // Extract room name (usually first line, e.g. "LIVING ROOM")
        const namePart = lines[0]?.trim();
        if (namePart && namePart.length > 2 && isNaN(Number(namePart))) {
          roomLabel = namePart.toUpperCase();
        }
      } else {
        // Inferred names based on indices
        if (i === 0) roomLabel = "FAMILY LOUNGE";
        else if (i === 1) roomLabel = "BEDROOM";
      }

      rooms.push({
        name: roomLabel,
        cx: midX,
        width: span
      });
    }
    setDetectedRooms(rooms);
  }, [layers]);

  // Handle section drawing injection into model space
  const handleGenerateCADSection = () => {
    // Determine dynamic offset point outside current drawing limits to avoid cluttering
    let maxEndX = 10000;
    let maxEndY = 15000;
    Object.values(layers).flat().forEach((s: any) => {
      if (!s) return;
      if (s.x1 !== undefined) {
        maxEndX = Math.max(maxEndX, s.x1, s.x2);
        maxEndY = Math.max(maxEndY, s.y1, s.y2);
      }
      if (s.x !== undefined) {
        maxEndX = Math.max(maxEndX, s.x + (s.width || 0));
        maxEndY = Math.max(maxEndY, s.y + (s.height || 0));
      }
    });

    const offX = Math.max(12000, Math.ceil((maxEndX + 4000) / 1000) * 1000);
    const yRef = 18000; // standard vertical reference offset

    // Define structure of deep updated layers payload
    const copyLayers = { ...layers };

    // Clear old section shapes to support iterative tweaks
    const filterOutSection = (arr: Shape[] = []) => {
      return arr.filter((s: any) => {
        // Exclude elements placed on our section offset/reference levels yRef
        if (s.layer === 'A-GRID' || s.layer === 'A-WALL' || s.layer === 'A-WALL-INT' || s.layer === 'A-TEXT' || s.layer === 'A-DIM' || s.layer === 'A-COLS') {
          if (s.y1 !== undefined && s.y1 >= yRef - foundationDepth - 1000) return false;
          if (s.y !== undefined && s.y >= yRef - foundationDepth - 1000) return false;
        }
        return true;
      });
    };

    Object.keys(copyLayers).forEach(layerId => {
      copyLayers[layerId] = filterOutSection(copyLayers[layerId]);
    });

    const ensureLayerList = (layerId: string) => {
      if (!copyLayers[layerId]) {
        copyLayers[layerId] = [];
      }
    };

    ensureLayerList('A-GRID');
    ensureLayerList('A-WALL');
    ensureLayerList('A-WALL-INT');
    ensureLayerList('A-TEXT');
    ensureLayerList('A-DIM');
    ensureLayerList('A-COLS');

    const totalHeight = plinthHeight + numFloors * floorHeight;
    const roofLevel = yRef + totalHeight;
    const parapetLevel = roofLevel + parapetHeight;

    const leftOuterWall = analyzedWalls[0]?.cx || 1000;
    const rightOuterWall = analyzedWalls[analyzedWalls.length - 1]?.cx || 9000;

    // Helper to draw horizontal level indicator line & bubble
    const addLevelIndicator = (name: string, yVal: number, relHeightText: string) => {
      copyLayers['A-GRID'].push({
        id: generateId(),
        type: 'line',
        layer: 'A-GRID',
        color: '#7f8c8d',
        x1: offX + leftOuterWall - 1000,
        y1: yVal,
        x2: offX + rightOuterWall + 1000,
        y2: yVal,
        lineType: 'center'
      } as LineShape);

      copyLayers['A-GRID'].push({
        id: generateId(),
        type: 'circle',
        layer: 'A-GRID',
        color: '#95a5a6',
        x: offX + rightOuterWall + 1400,
        y: yVal,
        radius: 180
      } as CircleShape);

      copyLayers['A-GRID'].push({
        id: generateId(),
        type: 'line',
        layer: 'A-GRID',
        color: '#7f8c8d',
        x1: offX + rightOuterWall + 1000,
        y1: yVal,
        x2: offX + rightOuterWall + 1400,
        y2: yVal
      } as LineShape);

      copyLayers['A-TEXT'].push({
        id: generateId(),
        type: 'text',
        layer: 'A-TEXT',
        color: '#ffffff',
        x: offX + rightOuterWall + 1700,
        y: yVal - 50,
        size: 130,
        content: name
      } as any);

      copyLayers['A-TEXT'].push({
        id: generateId(),
        type: 'text',
        layer: 'A-TEXT',
        color: '#00bcd4',
        x: offX + rightOuterWall + 1700,
        y: yVal - 220,
        size: 110,
        content: relHeightText
      } as any);
    };

    // Draw active layers of elevation datum
    addLevelIndicator('PARAPET LEVEL', parapetLevel, `+${((parapetLevel - yRef)/100).toFixed(2)}m`);
    addLevelIndicator('ROOF SLAB LEVEL', roofLevel, `+${((roofLevel - yRef)/100).toFixed(2)}m`);
    for (let f = 1; f < numFloors; f++) {
      const fLevel = yRef + plinthHeight + f * floorHeight;
      addLevelIndicator(`FLOOR ${f + 1} LEVEL`, fLevel, `+${((fLevel - yRef)/100).toFixed(2)}m`);
    }
    addLevelIndicator('GROUND FLOOR LEVEL', yRef + plinthHeight, `+${(plinthHeight/100).toFixed(2)}m`);
    addLevelIndicator('PLINTH LEVEL', yRef + plinthHeight - 150, `+${((plinthHeight - 150)/100).toFixed(2)}m`);
    addLevelIndicator('GROUND LEVEL (GL)', yRef, '±0.00m');
    addLevelIndicator('FOUNDATION BOTTOM', yRef - foundationDepth, `-${(foundationDepth/100).toFixed(2)}m`);

    // Draw Concrete slabs
    const drawCutSlabCAD = (yVal: number) => {
      copyLayers['A-COLS'].push({
        id: generateId(),
        type: 'rect',
        layer: 'A-COLS',
        color: '#95a5a6',
        x: offX + leftOuterWall - 230,
        y: yVal,
        width: (rightOuterWall - leftOuterWall) + 460,
        height: slabThickness,
        filled: true
      } as any);
    };

    // GF level slab, roof slab, intermediate story slabs
    for (let f = 1; f <= numFloors; f++) {
      const sy = yRef + plinthHeight + f * floorHeight - slabThickness;
      drawCutSlabCAD(sy);
    }

    // Stepped footings and walls for each clustered wall path
    analyzedWalls.forEach(wall => {
      const curX = offX + wall.cx;
      const t = wall.thick;

      // 1. Vertical wall masonry structure
      const wallTop = wall.isOuter ? parapetLevel : roofLevel;
      
      // Outer vs inner partitions splits
      copyLayers[wall.thick === 115 ? 'A-WALL-INT' : 'A-WALL'].push({
        id: generateId(),
        type: 'rect',
        layer: wall.thick === 115 ? 'A-WALL-INT' : 'A-WALL',
        color: '#ffffff',
        x: curX - t / 2,
        y: yRef + plinthHeight,
        width: t,
        height: (wallTop - (yRef + plinthHeight)),
        filled: true
      } as any);

      // 2. Concrete footing bed (foundation depth bottom)
      const footingY = yRef - foundationDepth;
      copyLayers['A-COLS'].push({
        id: generateId(),
        type: 'rect',
        layer: 'A-COLS',
        color: '#e74c3c',
        x: curX - 350,
        y: footingY,
        width: 700,
        height: 300,
        filled: false
      } as any);

      // 3. Stepped masonry footing step 1 (550 wide)
      copyLayers['A-WALL'].push({
        id: generateId(),
        type: 'rect',
        layer: 'A-WALL',
        color: '#ecf0f1',
        x: curX - 275,
        y: footingY + 300,
        width: 550,
        height: 300,
        filled: false
      } as any);

      // 4. Stepped footing step 2 (450 wide)
      copyLayers['A-WALL'].push({
        id: generateId(),
        type: 'rect',
        layer: 'A-WALL',
        color: '#ecf0f1',
        x: curX - 225,
        y: footingY + 600,
        width: 450,
        height: 300,
        filled: false
      } as any);

      // 5. Stem Wall up to Plinth (300 wide)
      copyLayers['A-WALL'].push({
        id: generateId(),
        type: 'rect',
        layer: 'A-WALL',
        color: '#ffffff',
        x: curX - 150,
        y: footingY + 900,
        width: 300,
        height: (yRef + plinthHeight) - (footingY + 900),
        filled: true
      } as any);
    });

    // Draw Parapet coping caps on outer walls
    const capW = 320;
    copyLayers['A-WALL'].push({
      id: generateId(),
      type: 'rect',
      layer: 'A-WALL',
      color: '#bdc3c7',
      x: offX + leftOuterWall - capW / 2,
      y: parapetLevel,
      width: capW,
      height: 80,
      filled: true
    } as any);

    copyLayers['A-WALL'].push({
      id: generateId(),
      type: 'rect',
      layer: 'A-WALL',
      color: '#bdc3c7',
      x: offX + rightOuterWall - capW / 2,
      y: parapetLevel,
      width: capW,
      height: 80,
      filled: true
    } as any);

    // Annotate Room Labels centered on each floor level
    detectedRooms.forEach(room => {
      for (let f = 0; f < numFloors; f++) {
        const textY = yRef + plinthHeight + f * floorHeight + floorHeight / 2 - 200;
        copyLayers['A-TEXT'].push({
          id: generateId(),
          type: 'mtext',
          layer: 'A-TEXT',
          color: '#00bcd4',
          x: offX + room.cx,
          y: textY,
          width: room.width - 500,
          bold: true,
          size: 160,
          content: `${room.name}\nFLR ${f + 1}`,
          justification: 'center'
        } as any);
      }
    });

    // Overall descriptive labels for Section
    const titleY = yRef - foundationDepth - 800;
    copyLayers['A-TEXT'].push({
      id: generateId(),
      type: 'mtext',
      layer: 'A-TEXT',
      color: '#1abc9c',
      x: offX + (leftOuterWall + rightOuterWall) / 2,
      y: titleY,
      width: 7000,
      bold: true,
      size: 260,
      content: 'BUILDING CROSS SECTION',
      justification: 'center'
    } as any);

    copyLayers['A-TEXT'].push({
      id: generateId(),
      type: 'mtext',
      layer: 'A-TEXT',
      color: '#ffffff',
      x: offX + (leftOuterWall + rightOuterWall) / 2,
      y: titleY - 300,
      width: 7000,
      size: 130,
      content: 'GENERATED SECTION // STEPPED MASONRY FOOTINGS & REINFORCED CONCRETE SLABS',
      justification: 'center'
    } as any);

    // Add Height Dimension strings
    // 1. Foundation depth
    copyLayers['A-DIM'].push({
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: 'A-DIM',
      color: '#00bcd4',
      x1: offX + leftOuterWall - 400,
      y1: yRef,
      x2: offX + leftOuterWall - 400,
      y2: yRef - foundationDepth,
      dimX: offX + leftOuterWall - 1000,
      dimY: yRef - foundationDepth / 2,
      text: `<> (Depth: ${(foundationDepth/1000).toFixed(2)}m)`
    } as any);

    // 2. Clear Floor Height
    copyLayers['A-DIM'].push({
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: 'A-DIM',
      color: '#00bcd4',
      x1: offX + leftOuterWall - 400,
      y1: yRef + plinthHeight,
      x2: offX + leftOuterWall - 400,
      y2: yRef + plinthHeight + floorHeight - slabThickness,
      dimX: offX + leftOuterWall - 1000,
      dimY: yRef + plinthHeight + (floorHeight - slabThickness) / 2,
      text: `<> (Clear: ${((floorHeight - slabThickness)/1000).toFixed(2)}m)`
    } as any);

    // 3. Overall span width
    copyLayers['A-DIM'].push({
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: 'A-DIM',
      color: '#00bcd4',
      x1: offX + leftOuterWall,
      y1: yRef,
      x2: offX + rightOuterWall,
      y2: yRef,
      dimX: offX + (leftOuterWall + rightOuterWall)/2,
      dimY: yRef - 400,
      text: `<> (Width)`
    } as any);

    // Push states to store
    onUpdateAllLayers(copyLayers);
  };

  // Compute scale and offsets inside preview panel (SVG width = 360, height = 240)
  const leftW = analyzedWalls[0]?.cx ?? 1000;
  const rightW = analyzedWalls[analyzedWalls.length - 1]?.cx ?? 9000;
  const planSpan = rightW - leftW;
  
  const hExtremes = analyzedWalls.map(w => w.cx);
  const minX = Math.min(...hExtremes, 0) - 1000;
  const maxX = Math.max(...hExtremes, 10000) + 1000;
  const rangeX = maxX - minX;

  const totalSectY = foundationDepth + plinthHeight + numFloors * floorHeight + parapetHeight + 1000;
  
  // Map drawing coordinates directly to SVG viewport
  const mapX = (cadX: number) => {
    return 15 + ((cadX - minX) / rangeX) * 330;
  };
  
  const mapY = (cadY: number) => {
    // 0 is bottom foundation level in SVG, scaled up
    const minYValue = -foundationDepth - 1000;
    const rangeY = totalSectY;
    return 210 - ((cadY - minYValue) / rangeY) * 180;
  };

  const svgGroundY = mapY(0);
  const svgPlinthY = mapY(plinthHeight);
  const svgFoundY = mapY(-foundationDepth);
  const svgRoofY = mapY(plinthHeight + numFloors * floorHeight);
  const svgParapetY = mapY(plinthHeight + numFloors * floorHeight + parapetHeight);

  return (
    <div
      style={{ top: pos.y, left: pos.x }}
      className="absolute w-[400px] bg-slate-950/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md z-[200] flex flex-col overflow-hidden select-none no-tap"
    >
      {/* Title Bar draggable */}
      <div
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        className="px-4 py-3 bg-neutral-900 border-b border-white/5 cursor-grab active:cursor-grabbing flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-cyan-400 animate-pulse" />
          <span className="font-semibold text-white tracking-wide text-xs uppercase">VOXCADD Section Generator</span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
        {/* Real-time reactive visual SVG preview */}
        <div className="sticky top-0 bg-neutral-950 border border-white/10 rounded-lg p-2 flex flex-col align-center">
          <span className="text-[10px] text-neutral-400 font-bold uppercase mb-1 tracking-wider text-center">Interactive Section Preview</span>
          
          <svg className="w-full h-[180px] bg-black/80 rounded border border-white/5" viewBox="0 0 380 220">
            {/* Grid gridlines */}
            <g opacity="0.1">
              <line x1="0" y1="20" x2="380" y2="20" stroke="#fff" strokeWidth="0.5" />
              <line x1="0" y1="60" x2="380" y2="60" stroke="#fff" strokeWidth="0.5" />
              <line x1="0" y1="100" x2="380" y2="100" stroke="#fff" strokeWidth="0.5" />
              <line x1="0" y1="140" x2="380" y2="140" stroke="#fff" strokeWidth="0.5" />
              <line x1="0" y1="180" x2="380" y2="180" stroke="#fff" strokeWidth="0.5" />
            </g>

            {/* Earth GL fill */}
            <rect x="0" y={svgGroundY} width="380" height={220 - svgGroundY} fill="#111" opacity="0.6"/>
            
            {/* Ground line GL */}
            <line x1="5" y1={svgGroundY} x2="375" y2={svgGroundY} stroke="#7f8c8d" strokeWidth="2" strokeDasharray="5,3" />
            <text x="310" y={svgGroundY - 4} fontSize="8" fill="#7f8c8d" className="font-semibold">GL ±0.00</text>

            {/* Plinth datum */}
            <line x1="5" y1={svgPlinthY} x2="375" y2={svgPlinthY} stroke="#e67e22" strokeWidth="1" strokeDasharray="3,3" />
            <text x="310" y={svgPlinthY - 4} fontSize="8" fill="#e67e22" className="font-semibold">PL +{(plinthHeight/1000).toFixed(2)}m</text>

            {/* Foundation depth line */}
            <line x1="5" y1={svgFoundY} x2="375" y2={svgFoundY} stroke="#c0392b" strokeWidth="1" />

            {/* Render analyzed walls with stepped foundations */}
            {analyzedWalls.map((wall, index) => {
              const wx = mapX(wall.cx);
              const wt = (wall.thick / rangeX) * 330;
              const wTopY = mapY(wall.isOuter ? (plinthHeight + numFloors * floorHeight + parapetHeight) : (plinthHeight + numFloors * floorHeight));
              
              return (
                <g key={`preview-wall-${index}`}>
                  {/* Concrete Footing at bottom */}
                  <rect
                    x={wx - 10}
                    y={svgFoundY - 5}
                    width="20"
                    height="5"
                    fill="none"
                    stroke="#c0392b"
                    strokeWidth="1.2"
                  />
                  {/* Stepped footing masonry */}
                  <rect
                    x={wx - 6}
                    y={svgFoundY - 14}
                    width="12"
                    height="9"
                    fill="none"
                    stroke="#7f8c8d"
                    strokeWidth="1"
                  />
                  {/* Vertical wall shaft */}
                  <rect
                    x={wx - Math.max(2, wt / 2)}
                    y={wTopY}
                    width={Math.max(4, wt)}
                    height={svgPlinthY - wTopY}
                    fill="#34495e"
                    stroke="#95a5a6"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Slabs */}
            {Array.from({ length: numFloors }).map((_, f) => {
              const sy = mapY(plinthHeight + (f + 1) * floorHeight);
              const slabH = (slabThickness / totalSectY) * 180;
              return (
                <rect
                  key={`preview-slab-${f}`}
                  x={mapX(leftW - 300)}
                  y={sy}
                  width={mapX(rightW + 300) - mapX(leftW - 300)}
                  height={Math.max(3, slabH)}
                  fill="#7f8c8d"
                  opacity="0.9"
                />
              );
            })}

            {/* Text details */}
            {detectedRooms.map((room, rIdx) => (
              <text
                key={`preview-room-title-${rIdx}`}
                x={mapX(room.cx)}
                y={svgPlinthY - 30}
                fontSize="8"
                fill="#00bcd4"
                textAnchor="middle"
                className="font-bold opacity-80"
              >
                {room.name}
              </text>
            ))}

            <text x="20" y="210" fontSize="8" fill="#1abc9c">FOUNDATION VISUALIZED</text>
          </svg>
        </div>

        {/* Height configuration sliders */}
        <div className="flex flex-col gap-3">
          <div className="border border-white/5 rounded-lg p-3 bg-neutral-900/40">
            <div className="flex justify-between items-center text-xs text-neutral-300 font-bold mb-1">
              <span>Foundation Depth</span>
              <span className="text-cyan-400 font-mono">{(foundationDepth / 1000).toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="800"
              max="2500"
              step="50"
              value={foundationDepth}
              onChange={(e) => setFoundationDepth(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-ew-resize h-1 bg-neutral-800 rounded-lg"
            />
          </div>

          <div className="border border-white/5 rounded-lg p-3 bg-neutral-900/40">
            <div className="flex justify-between items-center text-xs text-neutral-300 font-bold mb-1">
              <span>Plinth Level (PL)</span>
              <span className="text-cyan-400 font-mono">{plinthHeight} mm</span>
            </div>
            <input
              type="range"
              min="300"
              max="1200"
              step="50"
              value={plinthHeight}
              onChange={(e) => setPlinthHeight(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-ew-resize h-1 bg-neutral-800 rounded-lg"
            />
          </div>

          <div className="border border-white/5 rounded-lg p-3 bg-neutral-900/40">
            <div className="flex justify-between items-center text-xs text-neutral-300 font-bold mb-1">
              <span>Floor-to-Floor Height</span>
              <span className="text-cyan-400 font-mono">{(floorHeight / 1000).toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="2700"
              max="3600"
              step="50"
              value={floorHeight}
              onChange={(e) => setFloorHeight(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-ew-resize h-1 bg-neutral-800 rounded-lg"
            />
          </div>

          {/* Number of floors toggles */}
          <div className="flex gap-2">
            <div className="flex-1 border border-white/5 rounded-lg p-3 bg-neutral-900/40 flex flex-col justify-between">
              <span className="text-xs text-neutral-300 font-bold mb-2">Slab Thickness</span>
              <select
                value={slabThickness}
                onChange={(e) => setSlabThickness(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-white/10 rounded px-2 py-1 text-xs text-white"
              >
                <option value={100}>100 mm (Thin)</option>
                <option value={150}>150 mm (Standard)</option>
                <option value={200}>200 mm (Heavy)</option>
                <option value={250}>250 mm (Commercial)</option>
              </select>
            </div>

            <div className="flex-1 border border-white/5 rounded-lg p-3 bg-neutral-900/40 flex flex-col justify-between">
              <span className="text-xs text-neutral-300 font-bold mb-2">Number of Stories</span>
              <div className="flex gap-1 justify-between bg-black rounded p-1 border border-white/10">
                {[1, 2, 3].map((f) => (
                  <button
                    key={`num-fl-${f}`}
                    type="button"
                    onClick={() => setNumFloors(f)}
                    className={`flex-1 text-center py-1 text-[11px] font-bold rounded transition-all ${numFloors === f ? 'bg-cyan-500 text-black' : 'text-neutral-400 hover:text-white'}`}
                  >
                    {f}F
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-white/5 rounded-lg p-3 bg-neutral-900/40">
            <div className="flex justify-between items-center text-xs text-neutral-300 font-bold mb-1">
              <span>Parapet Height</span>
              <span className="text-cyan-400 font-mono">{parapetHeight} mm</span>
            </div>
            <input
              type="range"
              min="600"
              max="1200"
              step="50"
              value={parapetHeight}
              onChange={(e) => setParapetHeight(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-ew-resize h-1 bg-neutral-800 rounded-lg"
            />
          </div>
        </div>

        {/* Dynamic Spatial integrity check feedback */}
        <div className="border border-cyan-500/10 rounded-lg p-3 bg-cyan-950/20 text-[11px] leading-relaxed flex gap-2 text-neutral-300">
          <Sparkles size={16} className="text-cyan-400 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-cyan-400">AUTOMATIC SECTION CALCULATION</p>
            <p>Analyzed floor plan contains <strong>{analyzedWalls.length}</strong> main wall slices. Calculated total section height <strong>{((plinthHeight + numFloors * floorHeight + parapetHeight)/1000).toFixed(2)}m</strong>.</p>
          </div>
        </div>

        <button
          onClick={handleGenerateCADSection}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Play size={14} className="fill-black" />
          <span>Generate Section CAD Drawing</span>
        </button>
      </div>
    </div>
  );
}
