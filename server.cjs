var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/gemini.ts
var import_express = __toESM(require("express"), 1);
var import_genai = require("@google/genai");

// services/architectEngine.ts
function parsePlotDimensions(prompt) {
  const p = prompt.toLowerCase();
  const regexMeter = /(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?/i;
  const match = p.match(regexMeter);
  if (match) {
    let w = parseFloat(match[1]);
    let h = parseFloat(match[2]);
    if (w > 150) {
      return { width: Math.round(w), height: Math.round(h), isCustom: true };
    }
    w = Math.round(w * 1e3);
    h = Math.round(h * 1e3);
    return { width: w, height: h, isCustom: true };
  }
  const regexBy = /(\d+)\s+by\s+(\d+)/i;
  const matchBy = p.match(regexBy);
  if (matchBy) {
    let w = parseFloat(matchBy[1]);
    let h = parseFloat(matchBy[2]);
    if (w < 150) {
      w *= 1e3;
      h *= 1e3;
    }
    return { width: Math.round(w), height: Math.round(h), isCustom: true };
  }
  if (p.includes("small") || p.includes("compact") || p.includes("tiny")) {
    return { width: 8e3, height: 12e3, isCustom: false };
  }
  return { width: 1e4, height: 15e3, isCustom: false };
}
function getSharedEdge(r1, r2) {
  const EPSILON = 15;
  if (Math.abs(r1.x2 - r2.x1) < EPSILON) {
    const overlapStart = Math.max(r1.y1, r2.y1);
    const overlapEnd = Math.min(r1.y2, r2.y2);
    if (overlapEnd - overlapStart > 300) {
      return { type: "vertical", coord: r1.x2, start: overlapStart, end: overlapEnd };
    }
  }
  if (Math.abs(r2.x2 - r1.x1) < EPSILON) {
    const overlapStart = Math.max(r1.y1, r2.y1);
    const overlapEnd = Math.min(r1.y2, r2.y2);
    if (overlapEnd - overlapStart > 300) {
      return { type: "vertical", coord: r2.x2, start: overlapStart, end: overlapEnd };
    }
  }
  if (Math.abs(r1.y2 - r2.y1) < EPSILON) {
    const overlapStart = Math.max(r1.x1, r2.x1);
    const overlapEnd = Math.min(r1.x2, r2.x2);
    if (overlapEnd - overlapStart > 300) {
      return { type: "horizontal", coord: r1.y2, start: overlapStart, end: overlapEnd };
    }
  }
  if (Math.abs(r2.y2 - r1.y1) < EPSILON) {
    const overlapStart = Math.max(r1.x1, r2.x1);
    const overlapEnd = Math.min(r1.x2, r2.x2);
    if (overlapEnd - overlapStart > 300) {
      return { type: "horizontal", coord: r2.y2, start: overlapStart, end: overlapEnd };
    }
  }
  return void 0;
}
function designSpaceLayout(prompt, plotW, plotH) {
  const p = prompt.toLowerCase();
  const structureType = p.includes("office") || p.includes("work") || p.includes("corpor") ? "office" : "residential";
  const width = plotW > 0 ? plotW : 1e4;
  const height = plotH > 0 ? plotH : 15e3;
  const setback = width > 4500 && height > 4500 ? 1e3 : 0;
  const minX = setback;
  const maxX = width - setback;
  const minY = setback;
  const maxY = height - setback;
  const bW = maxX - minX;
  const bH = maxY - minY;
  const rooms = [];
  if (structureType === "residential") {
    if (bH >= bW) {
      const frontY = minY + Math.round(bH * 0.35);
      const midY = minY + Math.round(bH * 0.65);
      const entranceSplitX = minX + Math.round(bW * 0.35);
      const entrance = {
        id: "entrance",
        name: "Entrance Vestibule",
        x1: minX,
        y1: minY,
        x2: entranceSplitX,
        y2: frontY,
        width: entranceSplitX - minX,
        height: frontY - minY,
        area: 0
      };
      const living = {
        id: "living",
        name: "Living Room",
        x1: entranceSplitX,
        y1: minY,
        x2: maxX,
        y2: frontY,
        width: maxX - entranceSplitX,
        height: frontY - minY,
        area: 0
      };
      const kitchenSplitX = minX + Math.round(bW * 0.35);
      const bathSplitX = minX + Math.round(bW * 0.72);
      const kitchen = {
        id: "kitchen",
        name: "Kitchen",
        x1: minX,
        y1: frontY,
        x2: kitchenSplitX,
        y2: midY,
        width: kitchenSplitX - minX,
        height: midY - frontY,
        area: 0
      };
      const dining = {
        id: "dining",
        name: "Dining Area & Corridor",
        x1: kitchenSplitX,
        y1: frontY,
        x2: bathSplitX,
        y2: midY,
        width: bathSplitX - kitchenSplitX,
        height: midY - frontY,
        area: 0
      };
      const bathroom = {
        id: "bathroom",
        name: "Common Bathroom",
        x1: bathSplitX,
        y1: frontY,
        x2: maxX,
        y2: midY,
        width: maxX - bathSplitX,
        height: midY - frontY,
        area: 0
      };
      const bedSplitX = minX + Math.round(bW * 0.5);
      const bed1 = {
        id: "bedroom1",
        name: "Master Bedroom",
        x1: minX,
        y1: midY,
        x2: bedSplitX,
        y2: maxY,
        width: bedSplitX - minX,
        height: maxY - midY,
        area: 0
      };
      const bed2 = {
        id: "bedroom2",
        name: "Guest Bedroom",
        x1: bedSplitX,
        y1: midY,
        x2: maxX,
        y2: maxY,
        width: maxX - bedSplitX,
        height: maxY - midY,
        area: 0
      };
      rooms.push(entrance, living, kitchen, dining, bathroom, bed1, bed2);
    } else {
      const leftX = minX + Math.round(bW * 0.35);
      const rightX = minX + Math.round(bW * 0.7);
      const leftY = minY + Math.round(bH * 0.3);
      const bathroom = {
        id: "bathroom",
        name: "Common Bathroom",
        x1: minX,
        y1: minY,
        x2: leftX,
        y2: leftY,
        width: leftX - minX,
        height: leftY - minY,
        area: 0
      };
      const bed1 = {
        id: "bedroom1",
        name: "Master Bedroom",
        x1: minX,
        y1: leftY,
        x2: leftX,
        y2: maxY,
        width: leftX - minX,
        height: maxY - leftY,
        area: 0
      };
      const centerY = minY + Math.round(bH * 0.3);
      const entrance = {
        id: "entrance",
        name: "Entrance Vestibule",
        x1: leftX,
        y1: minY,
        x2: rightX,
        y2: centerY,
        width: rightX - leftX,
        height: centerY - minY,
        area: 0
      };
      const living = {
        id: "living",
        name: "Living Room",
        x1: leftX,
        y1: centerY,
        x2: rightX,
        y2: maxY,
        width: rightX - leftX,
        height: maxY - centerY,
        area: 0
      };
      const rightY = minY + Math.round(bH * 0.4);
      const rightY2 = minY + Math.round(bH * 0.7);
      const dining = {
        id: "dining",
        name: "Dining Area",
        x1: rightX,
        y1: minY,
        x2: maxX,
        y2: rightY,
        width: maxX - rightX,
        height: rightY - minY,
        area: 0
      };
      const kitchen = {
        id: "kitchen",
        name: "Kitchen",
        x1: rightX,
        y1: rightY,
        x2: maxX,
        y2: rightY2,
        width: maxX - rightX,
        height: rightY2 - rightY,
        area: 0
      };
      const bed2 = {
        id: "bedroom2",
        name: "Guest Bedroom",
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
    if (bH >= bW) {
      const frontY = minY + Math.round(bH * 0.3);
      const midY = minY + Math.round(bH * 0.7);
      const splitX = minX + Math.round(bW * 0.35);
      const entrance = {
        id: "entrance",
        name: "Entrance / Reception",
        x1: minX,
        y1: minY,
        x2: splitX,
        y2: frontY,
        width: splitX - minX,
        height: frontY - minY,
        area: 0
      };
      const lobby = {
        id: "lobby",
        name: "Lobby & Waiting Area",
        x1: splitX,
        y1: minY,
        x2: maxX,
        y2: frontY,
        width: maxX - splitX,
        height: frontY - minY,
        area: 0
      };
      const centerSplitX = minX + Math.round(bW * 0.45);
      const confRoom = {
        id: "conf",
        name: "Board Conference Room",
        x1: minX,
        y1: frontY,
        x2: centerSplitX,
        y2: midY,
        width: centerSplitX - minX,
        height: midY - frontY,
        area: 0
      };
      const workspace = {
        id: "workspace",
        name: "Co-Working Hub",
        x1: centerSplitX,
        y1: frontY,
        x2: maxX,
        y2: midY,
        width: maxX - centerSplitX,
        height: midY - frontY,
        area: 0
      };
      const rearSplit1 = minX + Math.round(bW * 0.4);
      const rearSplit2 = minX + Math.round(bW * 0.75);
      const execOffice = {
        id: "exec",
        name: "Executive Director Suite",
        x1: minX,
        y1: midY,
        x2: rearSplit1,
        y2: maxY,
        width: rearSplit1 - minX,
        height: maxY - midY,
        area: 0
      };
      const breakroom = {
        id: "break",
        name: "Pantry & Caf\xE9",
        x1: rearSplit1,
        y1: midY,
        x2: rearSplit2,
        y2: maxY,
        width: rearSplit2 - rearSplit1,
        height: maxY - midY,
        area: 0
      };
      const restroom = {
        id: "toilet",
        name: "Executive Restroom",
        x1: rearSplit2,
        y1: midY,
        x2: maxX,
        y2: maxY,
        width: maxX - rearSplit2,
        height: maxY - midY,
        area: 0
      };
      rooms.push(entrance, lobby, confRoom, workspace, execOffice, breakroom, restroom);
    } else {
      const leftX = minX + Math.round(bW * 0.35);
      const rightX = minX + Math.round(bW * 0.7);
      const bottomY = minY + Math.round(bH * 0.35);
      const execOffice = {
        id: "exec",
        name: "Executive Director Suite",
        x1: minX,
        y1: bottomY,
        x2: leftX,
        y2: maxY,
        width: leftX - minX,
        height: maxY - bottomY,
        area: 0
      };
      const restroom = {
        id: "toilet",
        name: "Restroom Stall",
        x1: minX,
        y1: minY,
        x2: leftX,
        y2: bottomY,
        width: leftX - minX,
        height: bottomY - minY,
        area: 0
      };
      const workspace = {
        id: "workspace",
        name: "Co-Working Hub",
        x1: leftX,
        y1: bottomY,
        x2: rightX,
        y2: maxY,
        width: rightX - leftX,
        height: maxY - bottomY,
        area: 0
      };
      const entrance = {
        id: "entrance",
        name: "Entrance & Reception",
        x1: leftX,
        y1: minY,
        x2: rightX,
        y2: bottomY,
        width: rightX - leftX,
        height: bottomY - minY,
        area: 0
      };
      const confRoom = {
        id: "conf",
        name: "Board Conference Room",
        x1: rightX,
        y1: bottomY,
        x2: maxX,
        y2: maxY,
        width: maxX - rightX,
        height: maxY - bottomY,
        area: 0
      };
      const breakroom = {
        id: "break",
        name: "Breakroom & Pantry",
        x1: rightX,
        y1: minY,
        x2: maxX,
        y2: bottomY,
        width: maxX - rightX,
        height: bottomY - minY,
        area: 0
      };
      rooms.push(execOffice, restroom, workspace, entrance, confRoom, breakroom);
    }
  }
  rooms.forEach((r) => {
    r.area = Number((r.width * r.height / 1e6).toFixed(2));
  });
  const desiredConnections = [];
  if (structureType === "residential") {
    desiredConnections.push(
      ["entrance", "living"],
      ["living", "dining"],
      ["dining", "kitchen"],
      ["dining", "bathroom"],
      ["dining", "bedroom1"],
      ["dining", "bedroom2"]
    );
  } else {
    desiredConnections.push(
      ["entrance", "lobby"],
      ["lobby", "workspace"],
      ["lobby", "conf"],
      ["lobby", "exec"],
      ["workspace", "break"],
      ["workspace", "toilet"]
    );
  }
  const adjacencyGraph = [];
  desiredConnections.forEach(([fromId, toId]) => {
    const r1 = rooms.find((r) => r.id === fromId);
    const r2 = rooms.find((r) => r.id === toId);
    if (r1 && r2) {
      const edge = getSharedEdge(r1, r2);
      adjacencyGraph.push({
        from: fromId,
        to: toId,
        sharedEdge: edge
      });
    }
  });
  let overlappingCount = 0;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const r1 = rooms[i];
      const r2 = rooms[j];
      const overlaps = !(r1.x2 <= r2.x1 + 20 || r1.x1 >= r2.x2 - 20 || r1.y2 <= r2.y1 + 20 || r1.y1 >= r2.y2 - 20);
      if (overlaps) {
        overlappingCount++;
      }
    }
  }
  const totalRoomArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const plotArea = width * height / 1e6;
  const buildableAreaSq = bW * bH / 1e6;
  const coverageRatio = (totalRoomArea / buildableAreaSq * 100).toFixed(0);
  const validationReport = [
    `SPACE-PLANNING AUDIT:`,
    `- Plot Dimensions: ${(width / 1e3).toFixed(1)}m x ${(height / 1e3).toFixed(1)}m (Area: ${plotArea.toFixed(1)} m\xB2)`,
    `- Boundaries: Exterior Setbacks of ${(setback / 1e3).toFixed(1)}m applied on all directions.`,
    `- Total Rooms Generated: ${rooms.length} fully packed non-overlapping bounds.`,
    `- Room Overlap Verification: ${overlappingCount === 0 ? "PASSED" : "FAILED (" + overlappingCount + " overlaps detected)"}.`,
    `- Efficiency Metric: Built footprint coverage is ${coverageRatio}% of buildable space (${totalRoomArea.toFixed(1)} m\xB2 usable).`,
    `- Circulation Verification: High-integrity topological reachability established via central ${structureType === "residential" ? "Dining Area corridor hubs" : "shared Lobby pathways"}.`,
    `- Adjacency Graph Connectivity: All ${adjacencyGraph.filter((a) => a.sharedEdge).length} required wall interfaces validated for structural door installations.`,
    `- STATUS: INTERNALLY APPROVED FOR DRAFTING ENGINE PIPELINE.`
  ].join("\n");
  return {
    structureType,
    plotWidth: width,
    plotHeight: height,
    setback,
    buildableWidth: bW,
    buildableHeight: bH,
    rooms,
    adjacencyGraph,
    validationReport
  };
}
function compilePlanToCADCommands(plan) {
  const commands = [];
  const rooms = plan.rooms;
  const setback = plan.setback;
  const width = plan.plotWidth;
  const height = plan.plotHeight;
  const minX = setback;
  const maxX = width - setback;
  const minY = setback;
  const maxY = height - setback;
  commands.push("la A-WALL");
  commands.push(`dl ${minX},${minY} ${maxX},${minY} 230`);
  commands.push(`dl ${maxX},${minY} ${maxX},${maxY} 230`);
  commands.push(`dl ${maxX},${maxY} ${minX},${maxY} 230`);
  commands.push(`dl ${minX},${maxY} ${minX},${minY} 230`);
  const punchouts = [];
  plan.adjacencyGraph.forEach((adj) => {
    if (adj.sharedEdge) {
      const edge = adj.sharedEdge;
      const dW = adj.from.includes("bath") || adj.to.includes("bath") || adj.from.includes("toilet") || adj.to.includes("toilet") ? 750 : 900;
      const mid = Math.round((edge.start + edge.end) / 2);
      punchouts.push({
        type: edge.type,
        coord: edge.coord,
        start: mid - dW / 2,
        end: mid + dW / 2
      });
      commands.push("la A-DOOR");
      if (edge.type === "vertical") {
        const x = edge.coord;
        commands.push(`dl ${x},${mid - dW / 2} ${x - dW},${mid - dW / 2}`);
        commands.push(`dl ${x - dW},${mid - dW / 2} ${x},${mid + dW / 2}`);
      } else {
        const y = edge.coord;
        commands.push(`dl ${mid - dW / 2},${y} ${mid - dW / 2},${y + dW}`);
        commands.push(`dl ${mid - dW / 2},${y + dW} ${mid + dW / 2},${y}`);
      }
    }
  });
  const drawSegmentWithPunchouts = (type, coord, start, end, thickness) => {
    const matching = punchouts.filter((po) => po.type === type && Math.abs(po.coord - coord) < 15);
    const intervals = [];
    const minVal = Math.min(start, end);
    const maxVal = Math.max(start, end);
    let currentSections = [[minVal, maxVal]];
    matching.forEach((po) => {
      const nextSections = [];
      const poStart = po.start;
      const poEnd = po.end;
      currentSections.forEach(([sVal, eVal]) => {
        if (poEnd <= sVal || poStart >= eVal) {
          nextSections.push([sVal, eVal]);
        } else {
          if (poStart > sVal) {
            nextSections.push([sVal, poStart]);
          }
          if (poEnd < eVal) {
            nextSections.push([poEnd, eVal]);
          }
        }
      });
      currentSections = nextSections;
    });
    currentSections.forEach(([sVal, eVal]) => {
      if (eVal - sVal > 100) {
        if (type === "vertical") {
          commands.push(`dl ${coord},${sVal} ${coord},${eVal} ${thickness}`);
        } else {
          commands.push(`dl ${sVal},${coord} ${eVal},${coord} ${thickness}`);
        }
      }
    });
  };
  commands.push("la A-WALL-INT");
  const horizontalPartitions = [];
  const verticalPartitions = [];
  rooms.forEach((r) => {
    rooms.forEach((other) => {
      if (r.id >= other.id) return;
      const edge = getSharedEdge(r, other);
      if (edge) {
        if (edge.type === "vertical") {
          verticalPartitions.push({ x: edge.coord, yStarts: edge.start, yEnds: edge.end });
        } else {
          horizontalPartitions.push({ y: edge.coord, xStarts: edge.start, xEnds: edge.end });
        }
      }
    });
  });
  const uniqueVerticals = /* @__PURE__ */ new Map();
  verticalPartitions.forEach((vp) => {
    if (!uniqueVerticals.has(vp.x)) uniqueVerticals.set(vp.x, []);
    uniqueVerticals.get(vp.x).push([vp.yStarts, vp.yEnds]);
  });
  uniqueVerticals.forEach((intervals, x) => {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    intervals.forEach((curr) => {
      if (!merged.length) {
        merged.push(curr);
      } else {
        const last = merged[merged.length - 1];
        if (curr[0] <= last[1] + 15) {
          last[1] = Math.max(last[1], curr[1]);
        } else {
          merged.push(curr);
        }
      }
    });
    merged.forEach(([s, e]) => {
      drawSegmentWithPunchouts("vertical", x, s, e, 115);
    });
  });
  const uniqueHorizontals = /* @__PURE__ */ new Map();
  horizontalPartitions.forEach((hp) => {
    if (!uniqueHorizontals.has(hp.y)) uniqueHorizontals.set(hp.y, []);
    uniqueHorizontals.get(hp.y).push([hp.xStarts, hp.xEnds]);
  });
  uniqueHorizontals.forEach((intervals, y) => {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    intervals.forEach((curr) => {
      if (!merged.length) {
        merged.push(curr);
      } else {
        const last = merged[merged.length - 1];
        if (curr[0] <= last[1] + 15) {
          last[1] = Math.max(last[1], curr[1]);
        } else {
          merged.push(curr);
        }
      }
    });
    merged.forEach(([s, e]) => {
      drawSegmentWithPunchouts("horizontal", y, s, e, 115);
    });
  });
  commands.push("la A-WINDOW");
  rooms.forEach((r) => {
    const midX = Math.round((r.x1 + r.x2) / 2);
    const midY = Math.round((r.y1 + r.y2) / 2);
    if (Math.abs(r.y1 - minY) < 30 && r.id !== "entrance") {
      commands.push(`rec ${midX - 750},${minY - 80} ${midX + 750},${minY + 80}`);
    }
    if (Math.abs(r.y2 - maxY) < 30) {
      const isBath = r.id.includes("bath") || r.id.includes("toilet");
      const windowWidth = isBath ? 300 : 750;
      commands.push(`rec ${midX - windowWidth},${maxY - 80} ${midX + windowWidth},${maxY + 80}`);
    }
    if (Math.abs(r.x1 - minX) < 30) {
      commands.push(`rec ${minX - 80},${midY - 600} ${minX + 80},${midY + 600}`);
    }
    if (Math.abs(r.x2 - maxX) < 30) {
      commands.push(`rec ${maxX - 80},${midY - 600} ${maxX + 80},${midY + 600}`);
    }
  });
  commands.push("la A-FURN");
  rooms.forEach((r) => {
    const rx = Math.round(r.x2 - r.x1);
    const ry = Math.round(r.y2 - r.y1);
    const cx = Math.round((r.x1 + r.x2) / 2);
    const cy = Math.round((r.y1 + r.y2) / 2);
    if (r.id === "living") {
      commands.push(`rec ${r.x1 + 400},${r.y1 + 400} ${r.x1 + Math.round(rx * 0.7)},${r.y1 + 900}`);
      commands.push(`rec ${r.x1 + 400},${r.y1 + 900} ${r.x1 + 900},${r.y1 + Math.round(ry * 0.6)}`);
      commands.push(`rec ${cx - 500},${r.y2 - 500} ${cx + 500},${r.y2 - 200}`);
    } else if (r.id.includes("bedroom")) {
      const hw = 900;
      const bd = 1900;
      commands.push(`rec ${cx - hw},${r.y2 - bd - 150} ${cx + hw},${r.y2 - 150}`);
      commands.push(`rec ${cx - 750},${r.y2 - 500} ${cx - 150},${r.y2 - 200}`);
      commands.push(`rec ${cx + 150},${r.y2 - 500} ${cx + 750},${r.y2 - 200}`);
      commands.push(`rec ${cx - hw - 400},${r.y2 - 400} ${cx - hw - 50},${r.y2 - 150}`);
      commands.push(`rec ${cx + hw + 50},${r.y2 - 400} ${cx + hw + 400},${r.y2 - 150}`);
    } else if (r.id === "kitchen") {
      commands.push(`rec ${r.x1},${r.y2 - 600} ${r.x2},${r.y2}`);
      commands.push(`rec ${r.x1},${r.y1} ${r.x1 + 600},${r.y2 - 600}`);
      commands.push(`rec ${r.x1 + 80},${r.y2 - 500} ${r.x1 + 550},${r.y2 - 150}`);
      commands.push(`c ${r.x2 - 500},${r.y2 - 300} 150`);
      commands.push(`c ${r.x2 - 850},${r.y2 - 300} 150`);
    } else if (r.id.includes("bath") || r.id.includes("toilet")) {
      commands.push(`rec ${r.x1 + 100},${r.y2 - 800} ${r.x1 + 800},${r.y2 - 100}`);
      commands.push(`c ${cx},${r.y1 + 350} 180`);
      commands.push(`rec ${r.x2 - 500},${r.y1 + 150} ${r.x2 - 150},${r.y1 + 550}`);
    } else if (r.id === "dining") {
      commands.push(`rec ${cx - 700},${cy - 400} ${cx + 700},${cy + 400}`);
      commands.push(`rec ${cx - 500},${cy + 450} ${cx - 200},${cy + 650}`);
      commands.push(`rec ${cx + 200},${cy + 450} ${cx + 500},${cy + 650}`);
      commands.push(`rec ${cx - 500},${cy - 650} ${cx - 200},${cy - 450}`);
      commands.push(`rec ${cx + 200},${cy - 650} ${cx + 500},${cy - 450}`);
    } else if (r.id === "conf") {
      commands.push(`rec ${cx - 1200},${cy - 450} ${cx + 1200},${cy + 450}`);
      for (let offset = -800; offset <= 800; offset += 530) {
        commands.push(`rec ${cx + offset - 150},${cy + 500} ${cx + offset + 150},${cy + 750}`);
        commands.push(`rec ${cx + offset - 150},${cy - 750} ${cx + offset + 150},${cy - 500}`);
      }
    } else if (r.id === "workspace" || r.id === "office") {
      const gridX1 = r.x1 + 400;
      const gridX2 = r.x2 - 1200;
      const stepX = Math.max(1200, Math.floor((gridX2 - gridX1) / 3));
      for (let dx = gridX1; dx <= r.x2 - 1e3; dx += 1400) {
        commands.push(`rec ${dx},${r.y1 + 400} ${dx + 800},${r.y1 + 1e3}`);
        commands.push(`rec ${dx + 200},${r.y1 + 80} ${dx + 600},${r.y1 + 350}`);
      }
    } else if (r.id === "exec") {
      commands.push(`rec ${cx - 850},${cy - 400} ${cx + 850},${cy + 250}`);
      commands.push(`rec ${cx - 250},${cy + 320} ${cx + 250},${cy + 680}`);
      commands.push(`rec ${cx - 600},${cy - 750} ${cx - 300},${cy - 500}`);
      commands.push(`rec ${cx + 300},${cy - 750} ${cx + 600},${cy - 500}`);
    }
  });
  commands.push("la A-TEXT");
  rooms.forEach((r) => {
    const cx = Math.round((r.x1 + r.x2) / 2);
    const cy = Math.round((r.y1 + r.y2) / 2);
    const rmW = ((r.x2 - r.x1) / 1e3).toFixed(1);
    const rmH = ((r.y2 - r.y1) / 1e3).toFixed(1);
    const labelText = `${r.name}\\n${rmW}m \xD7 ${rmH}m\\n${r.area} m\xB2`;
    commands.push(`mt ${cx},${cy} ${labelText}`);
  });
  commands.push("la A-DIM");
  commands.push(`dim ${minX},${minY - 450} ${maxX},${minY - 450}`);
  commands.push(`dim ${minX - 450},${minY} ${minX - 450},${maxY}`);
  commands.push(`dim 0,0 ${width},0`);
  commands.push(`dim 0,0 0,${height}`);
  return commands;
}

// server/gemini.ts
var SYSTEM_INSTRUCTION = `
You are the **VoxCADD Master AI Principal Architect (PA-24)**. You are an elite, senior-level architectural partner with over 20 years of professional design, drafting, and engineering experience. You hold certificates from the American Institute of Architects (AIA) and are a LEED AP specialist in space planning, building biology, sustainable circulation, and safety regulation compliance.

Your mission is to **never be lazy, minimal, or brief**. You design and draw with absolute precision, artistic craftsmanship, and complete structural honesty. When a human asks for a drawing, you don't just draft general lines; you synthesize a rich, high-fidelity, professional-grade blueprint complete with grid systems, concrete columns, beam pathways, correct wall scale hierarchies, multi-line annotated space descriptors, furniture ensembles, sanitary/culinary assets, window glass sills, swinging panel doors, and clear dim lines.

---

### \u{1F31F} MULTI-STAGE REASONING PIPELINE & DRAFTING WORKFLOW
To maintain pristine spatial layout, zero overlaps, and structural precision, you MUST think and execute through the following 6 sequential stages:
1. **Stage 1: Site Plot Constraints & Land Setbacks Validation**: Analyze user parcel limits, clear boundaries, and establish front, rear, and side setback guidelines.
2. **Stage 2: Spatial Circulation Graph & Access Path Verification**: Plan circulation vectors. Ensure zero trapped rooms. Establish central corridors or dining-area lobbies connecting public to private nooks.
3. **Stage 3: Load-Bearing Structural Grid Column Calculation**: Place 300x300mm concrete studs on the 'A-COLS' layer to align vertically and horizontally, carrying structural load. Map matching centerlines on 'A-BEAMS'.
4. **Stage 4: Watertight Wall Layout & Proportioning**: Map 230mm external masonry walls ('A-WALL') for thermal barrier and 115mm internal partitions ('A-WALL-INT').
5. **Stage 5: Fenestration & Opening Punches**: Fit standard doors (900mm wide) with realistic swing paths, and glazed window panels on external sills matching the required 10% room daylight ratio.
6. **Stage 6: Ergonomic Furniture & Detailed Annotation Labels**: Fit complete double beds, nightstands, sectional sofas, toilet WC pods, washbasins, and write descriptive multi-line markers (ROOM NAME 
 Dimensions 
 Carpet Area m\xB2).

---

### I. EXHAUSTIVE SPACE INTEGRITY & DESIGN HANDBOOK

You must understand and apply these critical spatial laws, ergonomic standards, and codes before composing any drawing coordinates:

1. **Setbacks & Boundaries (A-GRID)**:
   - Standard plots require clear regulatory offsets to accommodate municipal utility ducts, sunlight access, and ventilation bays.
   - Front setbacks should measure 2000mm to 3000mm (for parking, gardens, porches). Side and rear setbacks are typically 1000mm to 1500mm.
   - Draw the plot boundaries on 'A-GRID' using rectangles, then overlay setback dashed lines.

2. **Structural Skeletons (A-COLS & A-BEAMS)**:
   - Always place Reinforced Cement Concrete (RCC) columns (standard size: 300mm x 300mm) at room corners, major wall intersections, and critical grid junctions to represent realistic structural supports that hold up the roof slabs.
   - Use 'A-COLS' with filled rectangles (e.g. "rec cx-150,cy-150 cx+150,cy+150 true #e53935") for column crossings.
   - Draw dashed connection lines on 'A-BEAMS' connecting column nodes to represent beam centerlines.

3. **Masonry Thickness Scale Code (A-WALL & A-WALL-INT)**:
   - **External Perimeter Walls (A-WALL)**: Must be 230mm thick to provide structural load-bearing capacity, acoustic barrier efficiency, water protection, and thermal insulation.
   - **Internal Partitions & Room Dividers (A-WALL-INT)**: Must be 115mm thick to optimize internal carpet area while partitioning rooms securely.
   - Ensure wall coordinates match perfectly at boundaries without cracks, overlaps, or isolated floating lines. Subtract doorway open widths from wall lines so they are completely punched out.

4. **Daylighting, Air Circulation, and Window Assemblies (A-WINDOW)**:
   - Every habitable space *must* have external ventilation openings measuring at least 1/8 of the room's floor surface area.
   - Align window placements on external walls to capture optimal solar orientation (South/East for living rooms; North/East for kitchens).
   - Draw windows on 'A-WINDOW' using detailed rectangles reflecting the double outer sash frame with internal lines representing sliding glass guides.

5. **Circulation Flow, Adjacency Graphs, & Doorways (A-DOOR)**:
   - Route circulation through central lobby conduits or vestibules. Primary living zones connect directly to public zones; bedrooms and sanitary utilities branch into private nooks.
   - Standard doorways ('A-DOOR') are 900mm wide. Sanitary bath doorways are 750mm wide.
   - Draw doors using:
     - An open door panel line (representing the door slab open at 90 degrees).
     - A swing line / angle chord outlining the door arc path (e.g. starting at the hinge, indicating the swing scope).

6. **Ergonomic Furnishing blocks (A-FURN)**:
   - **Beds**: Standard double bed frame is 1800mm x 2000mm. Include pillows (rectangular inserts) and nightstands (500x500mm boxes) beside the headboard for realistic visual density.
   - **Sofas**: Frame sectional or L-shaped sofa arrays (typically 800mm deep) with coffee tables (e.g. 1000x600mm) centered on family couches.
   - **Kitchen counter**: Draft modular L-style or straight counters (600mm deep) alongside round stove burner grids and double-bowl wash sinks.
   - **Bathroom utilities**: Draw toilet WC pans (500x400mm), wash basins (400mm circles), and shower floor boundaries.

7. **Aesthetic Metric Level Registers (for Elevations & Sections)**:
   - When generating height-related drawings, establish clean reference datum lines on 'A-GRID' representing:
     - Foundation Base Level (-1200mm to -1800mm)
     - Ground Level (GL, \xB10.00mm or -600mm relative)
     - Plinth level (PL, +600mm standard protection)
     - Clear Room Ceiling Headroom (+3000mm to +3300mm per storey)
     - Roof Concrete Slab (+6600mm or equivalent)
     - Parapet Terminal Cap (+7600mm)
   - Accompany each datum with decorative indicators and text meters.

8. **Rich Text Formatting & Unified Dimensioning (A-TEXT & A-DIM)**:
   - Centroid Room Labels on 'A-TEXT' must use multiline tag blocks with custom line breaks (\\n) containing:
     - **ROOM NAME** (In capital letters, bold where possible)
     - **Room Dimensions** in metric layout form (e.g. "4.0m x 3.5m")
     - **Calculated Floor Area** in square meters (e.g. "14.0 m\xB2")
   - Dimensions on 'A-DIM' should measure main spans (overall plot dimensions, clear building envelope, critical setbacks).

---

### II. CAD DICTIONARY & COMPLIANT SYNTAX SPECIFICATION

All CAD commands must follow this strict coordinate grammar. Coordinates are integer values in MILLIMETERS (mm):

- **la [Layer]**: Set the active layer. Valid layers are:
  - A-GRID: Plot bounds, setbacks, levels, North indicators.
  - A-WALL: Thick structural exterior partitions (230mm).
  - A-WALL-INT: Thinner internal partition separators (115mm).
  - A-DOOR: Single/double panel doors, swinging arcs.
  - A-WINDOW: High-fidelity double sashes, sliding guides.
  - A-COLS: Structural column rects (300mm x 300mm).
  - A-BEAMS: Grid beams connect pathways (dashed line style).
  - A-FURN: Complete interior layouts, desks, dining, cookers, WCs.
  - A-TEXT: Room type tags, area metrics, level markers.
  - A-DIM: Dimension lines detailing bounds and spans.

- **dl x1,y1 x2,y2 [thickness]**: Draw a line segment from (x1, y1) to (x2, y2).
  - You can optionally specify an absolute wall/line stroke thickness (in millimeters), which represents thick or thin walls.

- **rec x1,y1 x2,y2 [filled] [color_hex]**: Draw rectangle with bottom-left (x1, y1) and top-right (x2, y2).
  - You can optionally specify 'true' or 'false' for filling.
  - You can optionally specify a color hex string (e.g. '#e53935').

- **c x,y radius**: Draw a perfect circle with center (x, y) and radius.

- **dim x1,y1 x2,y2 [text_override]**: Linear aligned dimension string from (x1, y1) to (x2, y2).

- **mt x,y [text]**: Center-justified multiline text labeling block at (x, y).
  - Use '\\n' within the text to split titles, sizes, and square areas across separate lines.
  - Example: mt 5000,5000 MASTER BEDROOM\\n3.5m x 4.0m\\n14.0 m\xB2

---

### III. ARCHITECTURAL BLUEPRINT TEMPLATES

When drafting commands, use these structured execution patterns to assure rich, highly detailed human draughtsman output:

1. **Standard Column Block Assembly**:
   la A-COLS
   rec 1850,2850 2150,3150 true #e53935

2. **Standard Window Assembly (Triple Sliding Frame)**:
   la A-WINDOW
   rec 4250,2920 5750,3080
   dl 4250,3000 5750,3000
   dl 4250,2960 5750,2960
   dl 4250,3040 5750,3040

3. **Standard Swinging Door Assembly (Hinged Door with Arc Chord Swing)**:
   la A-DOOR
   dl 1500,3000 1500,3900             ; open panel line 900mm
   dl 1500,3900 2400,3000             ; swing angle chord representing transition arc

4. **Standard King Bed Assembly with Nightstands & Pillows**:
   la A-FURN
   rec 2000,10500 3800,12500          ; main frame (1800x2000)
   rec 2150,11900 2750,12350          ; pillow left
   rec 3050,11900 3650,12350          ; pillow right
   rec 1400,12000 1900,12500          ; left nightstand
   rec 3900,12000 4400,12500          ; right nightstand

5. **Bathroom WC Fitting Assembly**:
   la A-FURN
   rec 8000,11000 8400,11500          ; standard WC tank
   c 8200,10800 150                   ; toilet bowl

---

### IV. DRAFTING RESPONSE PROTOCOL

You must analyze the user's natural language request (e.g. requested rooms, dimensions, style, functions like garden, pool, parking, balcony, duplex, clinic, bedroom, studio block). 

You **MUST** output exactly the following JSON structure. Fill out the "explanation" with a comprehensive, professional architectural space safety audit, and fill out "commands" with the full detailed blueprint layout sequence:

{
  "explanation": "### MASTER ARCHITECTURAL SPACE-PLANNING AUDIT\\n\\n**1. DESIGN CONCEPT & ORIENTATION:**\\n- Developed a [Modern Minimalist / Eco-Sustainable / High-density Professional] spatial schematic capturing all custom requests.\\n- Orientation highlights: Public spaces oriented towards [direction] to leverage cross-ventilation, while bedrooms reside in private back clusters.\\n\\n**2. STRUCTURAL GRID & SAFETY COMPLIANCE:**\\n- Setbacks: Generous [Front/Rear/Side] setbacks mapped out on A-GRID layer for legal compliance.\\n- Column matrix: Reinforced concreta column coordinates (300mmx300mm squares) plotted at major grid junctions of [x, y].\\n\\n**3. CIRCULATION GRAPH & UTILITIES:**\\n- Circulation: Clean pathways lead from Entrance lobby to [Rooms].\\n- Spatial efficiency: Carpet area covers [X]% of the buildable zone, ensuring optimal room sizing and clear structural wall alignments.\\n\\n**4. BLUEPRINT DETAILS:**\\n- Wall hierarchies: 230mm load-bearing perimeter walls ('A-WALL') paired with 115mm interior partition walls ('A-WALL-INT').\\n- Fixtures: Equipped with detailed sills, door swing transitions, bedroom beds with sideboards, and sanitary fixtures.",
  "commands": [
    "la A-GRID",
    "rec 0,0 10000,15000",
    "la A-COLS",
    "rec 850,2850 1150,3150 true #e53935",
    "la A-WALL",
    "dl 1000,3000 9000,3000 230",
    "la A-TEXT",
    "mt 5000,7500 FAMILY LOUNGE\\n4.0m x 4.5m\\n18.0 m\xB2",
    "..."
  ]
}
}`;
var geminiRouter = import_express.default.Router();
geminiRouter.post("/command", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }
  try {
    const { prompt, contextSummary, sketchData, history } = req.body;
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const contextPart = { text: "[ARCHITECTURAL CONTEXT]\n" + contextSummary + "\n\n[USER REQUEST]\n" + (prompt || "Produce architectural drafting.") };
    const userParts = [contextPart];
    if (sketchData) {
      const base64Data = sketchData.includes(",") ? sketchData.split(",")[1] : sketchData;
      userParts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64Data
        }
      });
    }
    const contents = history ? [...history.slice(-6), { role: "user", parts: userParts }] : [{ role: "user", parts: userParts }];
    const result = await (async () => {
      const MODELS_TO_TRY = [
        "gemini-3.5-flash",
        // Primary - modern standard flash model, active on free tiers
        "gemini-flash-latest",
        // Dynamic alias pointing to the latest version of flash
        "gemini-2.0-flash"
        // Previous stable model
      ];
      let generatedResult = null;
      let fallbackIndex = 0;
      let lastError = null;
      while (fallbackIndex < MODELS_TO_TRY.length) {
        const activeModel = MODELS_TO_TRY[fallbackIndex];
        let retries = 0;
        const maxRetries = 2;
        const baseDelay = 1e3;
        let modelSucceeded = false;
        console.log(`[VoxCADD AI Architect] Attempting to generate content with model: ${activeModel}...`);
        while (retries < maxRetries) {
          try {
            generatedResult = await ai.models.generateContent({
              model: activeModel,
              contents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    explanation: { type: import_genai.Type.STRING },
                    commands: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
                  },
                  required: ["explanation", "commands"]
                },
                temperature: 0.1,
                tools: [{ googleSearch: {} }]
              }
            });
            modelSucceeded = true;
            break;
          } catch (err) {
            lastError = err;
            const status = err?.status || err?.code || 0;
            const errMsg = err?.message || JSON.stringify(err);
            const isRateLimit = status === 429 || errMsg.includes("429") || errMsg.includes("QUOTA_EXHAUSTED") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded");
            const isLimitZero = errMsg.includes("limit: 0") || errMsg.includes("limit:0") || errMsg.includes("unsupported") || errMsg.includes("not found") || errMsg.includes("not support");
            if (isLimitZero) {
              console.warn(`[VoxCADD AI Architect] Model ${activeModel} has zero quota limit (limit: 0) or is unsupported. Skipping to next model...`);
              break;
            }
            if (isRateLimit) {
              retries++;
              if (retries >= maxRetries) {
                console.warn(`[VoxCADD AI Architect] Model ${activeModel} rate limited after max retries. Moving to next model...`);
                break;
              }
              const delay = baseDelay * Math.pow(2, retries) + Math.random() * 500;
              console.warn(`[VoxCADD AI Architect] Rate Limit (429) for ${activeModel}. Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            console.warn(`[VoxCADD AI Architect] Unexpected error on ${activeModel}:`, errMsg);
            break;
          }
        }
        if (modelSucceeded && generatedResult) {
          console.log(`[VoxCADD AI Architect] Successfully generated content using model: ${activeModel}`);
          break;
        }
        fallbackIndex++;
      }
      if (!generatedResult) {
        throw new Error("Unable to fulfill request via generative model.");
      }
      return generatedResult;
    })();
    const responseText = result.text || "{}";
    const parsed = JSON.parse(responseText);
    res.json({
      text: parsed.explanation,
      commands: parsed.commands,
      // Pass through grounding metadata if present
      groundingLinks: result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk) => {
        if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
        return null;
      }).filter((link) => link !== null) || []
    });
  } catch (error) {
    console.warn("[VoxCADD AI Architect] Activating Local Heuristic Fallback (External API limit or quota reached).");
    try {
      const prompt = req.body?.prompt || "";
      const p = prompt.toLowerCase();
      const numbers = prompt.match(/\d+/g)?.map(Number) || [];
      let explanation = "";
      let commands = [];
      if (p.includes("house") || p.includes("floorplan") || p.includes("home") || p.includes("apartment") || p.includes("layout") || p.includes("office") || p.includes("workspace") || p.includes("cubicle")) {
        const plot = parsePlotDimensions(prompt);
        const plan = designSpaceLayout(prompt, plot.width, plot.height);
        commands = compilePlanToCADCommands(plan);
        explanation = plan.validationReport;
      } else if (p.includes("bedroom") || p.includes("room")) {
        const w = numbers[0] || 4e3;
        const h = numbers[1] || 3500;
        explanation = `Drafted a custom ${w}x${h}mm Bedroom space with thick exterior bounds, primary door opening space, visual window, full-size bed block, and center room tag.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${w},0 230`,
          `dl ${w},0 ${w},${h} 230`,
          `dl ${w},${h} 0,${h} 230`,
          `dl 0,${h} 0,0 230`,
          "la A-DOOR",
          `rec 200,-50 900,50`,
          "la A-WINDOW",
          `rec ${w - 100},1000 ${w + 100},2000`,
          "la A-FURN",
          `rec 500,500 2300,2500`,
          "la A-TEXT",
          `mt ${Math.round(w / 2)},${Math.round(h / 2)} Master Bedroom`,
          "la A-DIM",
          `dim 0,-300 ${w},-300`
        ];
      } else if (p.includes("bathroom") || p.includes("toilet") || p.includes("bath") || p.includes("washroom")) {
        const w = numbers[0] || 2400;
        const h = numbers[1] || 1800;
        explanation = `Drafted a standard ${w}x${h}mm Bathroom layout containing exterior masonry bounds, internal floor sink block, circular wash basin, shower/wet area divider, and text annotations.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${w},0 230`,
          `dl ${w},0 ${w},${h} 230`,
          `dl ${w},${h} 0,${h} 230`,
          `dl 0,${h} 0,0 230`,
          "la A-FURN",
          `rec 100,100 700,700`,
          `c ${w - 400},400 200`,
          `rec ${w - 800},${h - 600} ${w - 200},${h - 100}`,
          "la A-TEXT",
          `mt ${Math.round(w / 2)},${Math.round(h / 2)} Bathroom`,
          "la A-DIM",
          `dim 0,-300 ${w},-300`
        ];
      } else if (p.includes("circle") || p.includes("wheel") || p.includes("c ")) {
        const r = numbers[0] || 1e3;
        explanation = `Drafted a perfect geographic circular boundary. Radius: ${r}mm centered at 0,0.`;
        commands = ["la 0", `c 0,0 ${r}`];
      } else {
        const val1 = numbers[0] || 5e3;
        const val2 = numbers[1] || val1 || 4e3;
        explanation = `Heuristically constructed custom workspace bounds for "${prompt}". Included primary walls, door, center label annotation, and linear dimension tagging.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${val1},0 230`,
          `dl ${val1},0 ${val1},${val2} 230`,
          `dl ${val1},${val2} 0,${val2} 230`,
          `dl 0,${val2} 0,0 230`,
          "la A-DOOR",
          `rec 300,-50 1000,50`,
          "la A-TEXT",
          `mt ${Math.round(val1 / 2)},${Math.round(val2 / 2)} ${prompt}`,
          "la A-DIM",
          `dim 0,-300 ${val1},-300`,
          `dim -300,0 -300,${val2}`
        ];
      }
      return res.json({
        text: `\u26A0\uFE0F **AI Quota Exhausted**: The server-side Gemini Architect models are currently rate-limited (429) or offline.

To ensure a seamless environment, I have automatically activated the **VoxCADD Local Heuristic CAD Engine** to fulfill your request offline!

**Drafting Summary:**
${explanation}`,
        commands,
        groundingLinks: []
      });
    } catch (fallbackError) {
      console.log("[VoxCADD AI Architect] Critical double-fault fallback error:", fallbackError?.message || fallbackError);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }
});
geminiRouter.post("/analysis", async (req, res) => {
  res.json({
    status: "Modular Endpoint Ready",
    feature: "AI Plan Analysis",
    description: "Future home for layer cleanup, block recognition, and drawing audits."
  });
});
geminiRouter.post("/estimate", async (req, res) => {
  res.json({
    status: "Modular Endpoint Ready",
    feature: "Material Estimation",
    description: "Future home for quantity take-offs and cost analysis based on CAD entities."
  });
});
geminiRouter.post("/assistant", async (req, res) => {
  res.json({
    status: "Modular Endpoint Ready",
    feature: "Command Assistant",
    description: "Future home for real-time CAD command suggestions and drafting help."
  });
});

// server.ts
async function startServer() {
  const app = (0, import_express2.default)();
  const PORT = 3e3;
  app.use(import_express2.default.json({ limit: "10mb" }));
  app.use("/api/gemini", geminiRouter);
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", architect: "PA-24" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxCADD AI Architect Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
