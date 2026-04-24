
import { Shape, Point, AppSettings, SnapPoint, LineShape, DoubleLineShape, RectShape, ArcShape, CircleShape, EllipseShape, PolyShape, TextShape, MTextShape, SnapOptions, LeaderShape, ArcData } from '../types';

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const distance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
export const distSq = (p1: Point, p2: Point) => Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);

export const calculateArea = (points: Point[]): number => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
};

export const isPointInPoly = (p: Point, poly: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const isPointInRect = (p: Point, xMin: number, yMin: number, xMax: number, yMax: number): boolean => {
    return p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;
};

export const projectPointOnLine = (p: Point, a: Point, b: Point): Point => {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const lenSq = atob.x * atob.x + atob.y * atob.y;
    if (lenSq === 0) return a;
    const t = (atop.x * atob.x + atop.y * atob.y) / lenSq;
    return { x: a.x + t * atob.x, y: a.y + t * atob.y };
};

export const hitTestShape = (x: number, y: number, s: Shape, threshold: number): boolean => {
  switch (s.type) {
    case 'line': return distToSegment(x, y, s.x1, s.y1, s.x2, s.y2) < threshold;
    case 'circle': {
      const d = Math.sqrt(Math.pow(x - s.x, 2) + Math.pow(y - s.y, 2));
      return Math.abs(d - s.radius) < threshold || (s.filled && d <= s.radius);
    }
    case 'rect': {
      const inBounds = x >= s.x - threshold && x <= s.x + s.width + threshold && y >= s.y - threshold && y <= s.y + s.height + threshold;
      const onEdge = Math.abs(x - s.x) < threshold || Math.abs(x - (s.x + s.width)) < threshold || Math.abs(y - s.y) < threshold || Math.abs(y - (s.y + s.height)) < threshold;
      return s.filled ? inBounds : (inBounds && onEdge);
    }
    case 'text':
    case 'mtext': {
        const lines = s.type === 'mtext' ? s.content.split('\n') : [s.content];
        const h = s.size * (s.type === 'mtext' ? (lines.length * 1.2) : 1);
        // Estimate width if not explicit
        let w = (s as MTextShape).width;
        if (!w) {
            const maxChars = Math.max(...lines.map(l => l.length));
            w = maxChars * s.size * 0.6; // Average monospace char width
        }
        
        const xMin = s.x - (s.justification === 'center' ? w/2 : s.justification === 'right' ? w : 0);
        return x >= xMin - threshold && x <= xMin + w + threshold && y <= s.y + threshold && y >= s.y - h - threshold;
    }
    case 'arc': {
      const d = Math.sqrt(Math.pow(x - s.x, 2) + Math.pow(y - s.y, 2));
      if (Math.abs(d - s.radius) > threshold) return false;
      let angle = Math.atan2(y - s.y, x - s.x);
      let sA = s.startAngle, eA = s.endAngle;
      while (angle < 0) angle += Math.PI * 2;
      while (sA < 0) sA += Math.PI * 2;
      while (eA < 0) eA += Math.PI * 2;
      if (s.counterClockwise) { if (eA < sA) return angle >= sA || angle <= eA; return angle >= sA && angle <= eA; }
      else { if (sA < eA) return angle >= eA || angle <= sA; return angle >= eA && angle <= sA; }
    }
    case 'pline': case 'polygon': {
        for(let i=0; i<s.points.length-1; i++) {
            if (distToSegment(x, y, s.points[i].x, s.points[i].y, s.points[i+1].x, s.points[i+1].y) < threshold) return true;
        }
        if (s.closed && s.points.length > 2) {
            if (distToSegment(x, y, s.points[s.points.length-1].x, s.points[s.points.length-1].y, s.points[0].x, s.points[0].y) < threshold) return true;
            if (s.filled && isPointInPoly({x, y}, s.points)) return true;
        }
        return false;
    }
    case 'ellipse': {
        const dx = x - s.x, dy = y - s.y;
        const cos = Math.cos(-s.rotation), sin = Math.sin(-s.rotation);
        const tx = dx * cos - dy * sin, ty = dx * sin + dy * cos;
        const val = (tx * tx) / (s.rx * s.rx) + (ty * ty) / (s.ry * s.ry);
        return Math.abs(val - 1) < threshold / Math.min(s.rx, s.ry);
    }
  }
  return false;
};

export const getShapeBounds = (s: Shape): { xMin: number, yMin: number, xMax: number, yMax: number } => {
    switch (s.type) {
        case 'line':
            return { xMin: Math.min(s.x1, s.x2), yMin: Math.min(s.y1, s.y2), xMax: Math.max(s.x1, s.x2), yMax: Math.max(s.y1, s.y2) };
        case 'circle':
            return { xMin: s.x - s.radius, yMin: s.y - s.radius, xMax: s.x + s.radius, yMax: s.y + s.radius };
        case 'rect':
            return { xMin: s.x, yMin: s.y, xMax: s.x + s.width, yMax: s.y + s.height };
        case 'arc':
            // Simple bounding box for arc (can be refined but this is safe)
            return { xMin: s.x - s.radius, yMin: s.y - s.radius, xMax: s.x + s.radius, yMax: s.y + s.radius };
        case 'pline':
        case 'polygon':
        case 'spline':
            if (!s.points || s.points.length === 0) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
            let xMin = s.points[0].x, yMin = s.points[0].y, xMax = s.points[0].x, yMax = s.points[0].y;
            s.points.forEach(p => {
                xMin = Math.min(xMin, p.x); yMin = Math.min(yMin, p.y);
                xMax = Math.max(xMax, p.x); yMax = Math.max(yMax, p.y);
            });
            return { xMin, yMin, xMax, yMax };
        case 'text':
        case 'mtext': {
            const lines = s.type === 'mtext' ? s.content.split('\n') : [s.content];
            const h = s.size * (s.type === 'mtext' ? (lines.length * 1.2) : 1);
            let w = (s as MTextShape).width;
            if (!w) {
                const maxChars = Math.max(...lines.map(l => l.length));
                w = maxChars * s.size * 0.6;
            }
            const xMin = s.x - (s.justification === 'center' ? w/2 : s.justification === 'right' ? w : 0);
            return { xMin, yMin: s.y - h, xMax: xMin + w, yMax: s.y };
        }
        case 'ellipse':
            const maxR = Math.max(s.rx, s.ry);
            return { xMin: s.x - maxR, yMin: s.y - maxR, xMax: s.x + maxR, yMax: s.y + maxR };
        case 'point':
            return { xMin: s.x - 5, yMin: s.y - 5, xMax: s.x + 5, yMax: s.y + 5 };
        case 'dimension':
            return { 
                xMin: Math.min(s.x1, s.x2, s.dimX), 
                yMin: Math.min(s.y1, s.y2, s.dimY), 
                xMax: Math.max(s.x1, s.x2, s.dimX), 
                yMax: Math.max(s.y1, s.y2, s.dimY) 
            };
        default:
            return { xMin: -1e9, yMin: -1e9, xMax: 1e9, yMax: 1e9 };
    }
};

export const isRectIntersecting = (r1: { xMin: number, yMin: number, xMax: number, yMax: number }, r2: { xMin: number, yMin: number, xMax: number, yMax: number }): boolean => {
    return !(r2.xMin > r1.xMax || r2.xMax < r1.xMin || r2.yMin > r1.yMax || r2.yMax < r1.yMin);
};

export const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
  const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
  if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
};

export const moveShape = (s: Shape, dx: number, dy: number): Shape => {
    const ns = { ...s };
    switch (ns.type) {
        case 'line': ns.x1 += dx; ns.y1 += dy; ns.x2 += dx; ns.y2 += dy; break;
        case 'circle': case 'arc': case 'text': case 'mtext': case 'rect': case 'ellipse': case 'point':
            ns.x += dx; ns.y += dy; break;
        case 'pline': case 'polygon': case 'spline':
            ns.points = ns.points.map(p => ({ x: p.x + dx, y: p.y + dy })); break;
    }
    return ns as Shape;
};

export const getCircleFrom3Points = (p1: Point, p2: Point, p3: Point): ArcData | null => {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y;
    // Calculate the determinant (twice the signed area of the triangle)
    // In our Y-up coordinate system, D > 0 means the points p1, p2, p3 are in CCW order.
    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(D) < 0.000001) return null;
    
    const centerX = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
    const centerY = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
    const radius = Math.sqrt(Math.pow(x1 - centerX, 2) + Math.pow(y1 - centerY, 2));
    
    const startAngle = Math.atan2(y1 - centerY, x1 - centerX);
    const endAngle = Math.atan2(y3 - centerY, x3 - centerX);
    
    // ctx.arc's counterClockwise parameter: if true, draws CCW; if false, draws CW.
    // Since D > 0 means CCW orientation, we can use it directly.
    const counterClockwise = D > 0;
    
    return { x: centerX, y: centerY, radius, startAngle, endAngle, counterClockwise };
};

export const getPolygonPoints = (center: Point, sides: number, radius: number, inscribed: boolean, rotation: number = 0): Point[] => {
    const pts: Point[] = [];
    const step = (Math.PI * 2) / sides;
    const r = inscribed ? radius : radius / Math.cos(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * step;
        pts.push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) });
    }
    return pts;
};

export const parseLength = (str: string, isImperial: boolean): number => {
    if (!str) return 0;
    const clean = str.trim();
    if (clean === "") return 0;
    if (!isImperial) return parseFloat(clean);
    
    const feetRegex = /(-?\d+(\.\d+)?)'/;
    let totalInches = 0;
    let matched = false;
    const feetMatch = clean.match(feetRegex);
    if (feetMatch) {
        totalInches += parseFloat(feetMatch[1]) * 12;
        matched = true;
    }
    let inchesPart = feetMatch ? clean.substring(feetMatch.index! + feetMatch[0].length).trim() : clean;
    inchesPart = inchesPart.replace(/^[- "]+/, '').replace(/"$/, '');
    const inchMatch = inchesPart.match(/(-?\d+(\.\d+)?)/);
    if (inchMatch) {
        totalInches += parseFloat(inchMatch[1]);
        matched = true;
    }
    return matched ? totalInches : parseFloat(clean);
};

export const formatLength = (val: number, isImperial: boolean): string => {
    if (val === undefined || isNaN(val)) return "0.000";
    if (!isImperial) return val.toFixed(3);
    const absVal = Math.abs(val);
    const feet = Math.floor(absVal / 12);
    const inches = absVal % 12;
    return `${val < 0 ? "-" : ""}${feet}'${inches.toFixed(2)}"`;
};

export const getIntersection = (p1: Point, p2: Point, p3: Point, p4: Point, infinite: boolean = false): Point | null => {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 0.000001) return null; 
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (!infinite && (u < 0 || u > 1 || v < 0 || v > 1)) return null;
  return { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) };
};

export const getTrimmedShapes = (cutters: Shape[], targets: Shape[], pick: Point): Shape[] => {
    const results: Shape[] = [];
    targets.forEach(target => {
        if (target.type === 'line') {
            const intersections: Point[] = [];
            cutters.forEach(cutter => {
                const cutterSegments = getShapeSegments(cutter);
                cutterSegments.forEach(cs => {
                    const inter = getIntersection({x: target.x1, y: target.y1}, {x: target.x2, y: target.y2}, cs.p1, cs.p2);
                    if (inter) intersections.push(inter);
                });
            });

            if (intersections.length === 0) {
                results.push(target);
                return;
            }

            const uniqueInter = intersections.filter((v, i, a) => a.findIndex(t => distance(t, v) < 0.0001) === i);
            const p1 = {x: target.x1, y: target.y1};
            uniqueInter.sort((a, b) => distance(p1, a) - distance(p1, b));

            const segments: {p1: Point, p2: Point}[] = [];
            segments.push({p1: p1, p2: uniqueInter[0]});
            for(let i=0; i<uniqueInter.length-1; i++) {
                segments.push({p1: uniqueInter[i], p2: uniqueInter[i+1]});
            }
            segments.push({p1: uniqueInter[uniqueInter.length-1], p2: {x: target.x2, y: target.y2}});

            let closestIdx = -1;
            let minDist = Infinity;
            segments.forEach((seg, idx) => {
                const d = distToSegment(pick.x, pick.y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                if (d < minDist) {
                    minDist = d;
                    closestIdx = idx;
                }
            });

            segments.forEach((seg, idx) => {
                if (idx !== closestIdx) {
                    if (distance(seg.p1, seg.p2) > 0.001) {
                        results.push({ ...target, id: generateId(), x1: seg.p1.x, y1: seg.p1.y, x2: seg.p2.x, y2: seg.p2.y } as Shape);
                    }
                }
            });
        } else {
            results.push(target);
        }
    });
    return results;
};

export const getShapeSegments = (s: Shape): { p1: Point, p2: Point }[] => {
    const segments: { p1: Point, p2: Point }[] = [];
    switch (s.type) {
        case 'line':
            segments.push({ p1: { x: s.x1, y: s.y1 }, p2: { x: s.x2, y: s.y2 } });
            break;
        case 'rect':
            const p1 = { x: s.x, y: s.y };
            const p2 = { x: s.x + s.width, y: s.y };
            const p3 = { x: s.x + s.width, y: s.y + s.height };
            const p4 = { x: s.x, y: s.y + s.height };
            segments.push({ p1, p2 }, { p1: p2, p2: p3 }, { p1: p3, p2: p4 }, { p1: p4, p2: p1 });
            break;
        case 'pline':
        case 'polygon':
        case 'spline':
            for (let i = 0; i < s.points.length - 1; i++) {
                segments.push({ p1: s.points[i], p2: s.points[i + 1] });
            }
            if (s.closed || s.type === 'polygon') {
                segments.push({ p1: s.points[s.points.length - 1], p2: s.points[0] });
            }
            break;
        case 'ellipse': {
            const steps = 36;
            for (let i = 0; i < steps; i++) {
                const a1 = (i / steps) * Math.PI * 2;
                const a2 = ((i + 1) / steps) * Math.PI * 2;
                const getP = (a: number) => {
                    const dx = s.rx * Math.cos(a), dy = s.ry * Math.sin(a);
                    const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
                    return { x: s.x + dx * cos - dy * sin, y: s.y + dx * sin + dy * cos };
                };
                segments.push({ p1: getP(a1), p2: getP(a2) });
            }
            break;
        }
        case 'circle':
            const steps = 32;
            for (let i = 0; i < steps; i++) {
                const a1 = (i / steps) * Math.PI * 2;
                const a2 = ((i + 1) / steps) * Math.PI * 2;
                segments.push({
                    p1: { x: s.x + s.radius * Math.cos(a1), y: s.y + s.radius * Math.sin(a1) },
                    p2: { x: s.x + s.radius * Math.cos(a2), y: s.y + s.radius * Math.sin(a2) }
                });
            }
            break;
        case 'arc':
            const arcSteps = 16;
            let sA = s.startAngle, eA = s.endAngle;
            if (s.counterClockwise && eA < sA) eA += Math.PI * 2;
            if (!s.counterClockwise && sA < eA) sA += Math.PI * 2;
            const diff = eA - sA;
            for (let i = 0; i < arcSteps; i++) {
                const a1 = sA + (i / arcSteps) * diff;
                const a2 = sA + ((i + 1) / arcSteps) * diff;
                segments.push({
                    p1: { x: s.x + s.radius * Math.cos(a1), y: s.y + s.radius * Math.sin(a1) },
                    p2: { x: s.x + s.radius * Math.cos(a2), y: s.y + s.radius * Math.sin(a2) }
                });
            }
            break;
    }
    return segments;
};

export const resolvePointInput = (input: string, lastPoint: Point | null, isImperial: boolean, currentCursor?: Point, orthoEnabled?: boolean): Point | null => {
    const text = input.trim().toLowerCase();
    if (text === "") return null;

    if (!text.includes(',') && !text.includes('<') && !text.startsWith('@')) {
        const distValue = parseLength(text, isImperial);
        if (!isNaN(distValue) && lastPoint && currentCursor) {
            let dx = currentCursor.x - lastPoint.x;
            let dy = currentCursor.y - lastPoint.y;
            
            if (orthoEnabled) {
                if (Math.abs(dx) > Math.abs(dy)) dy = 0;
                else dx = 0;
            }
            
            const angle = Math.atan2(dy, dx);
            return {
                x: lastPoint.x + distValue * Math.cos(angle),
                y: lastPoint.y + distValue * Math.sin(angle)
            };
        }
    }

    let isRelative = text.startsWith('@');
    let workingText = isRelative ? text.substring(1) : text;
    let base = (isRelative && lastPoint) ? lastPoint : { x: 0, y: 0 };

    if (workingText.includes('<')) {
        const parts = workingText.split('<');
        if (parts.length !== 2) return null;
        const distValue = parseLength(parts[0], isImperial);
        const angleDeg = parseFloat(parts[1]);
        if (isNaN(distValue) || isNaN(angleDeg)) return null;
        const angleRad = angleDeg * Math.PI / 180;
        return {
            x: base.x + distValue * Math.cos(angleRad),
            y: base.y + distValue * Math.sin(angleRad)
        };
    }

    const parts = workingText.replace(',', ' ').split(/\s+/).filter(p => p !== "");
    if (parts.length === 2) {
        const dx = parseLength(parts[0], isImperial);
        const dy = parseLength(parts[1], isImperial);
        if (isNaN(dx) || isNaN(dy)) return null;

        return {
            x: base.x + dx,
            y: base.y + dy
        };
    }

    return null;
};

export const offsetShape = (s: Shape, dist: number, sidePoint: Point): Shape | null => {
    const id = generateId();
    switch (s.type) {
        case 'line': {
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return null;
            const nx = -dy / len, ny = dx / len;
            const p1o = { x: s.x1 + nx * dist, y: s.y1 + ny * dist };
            const p2o = { x: s.x1 - nx * dist, y: s.y1 - ny * dist };
            const finalOffset = distance(sidePoint, p1o) < distance(sidePoint, p2o) ? dist : -dist;
            return { ...s, id, x1: s.x1 + nx * finalOffset, y1: s.y1 + ny * finalOffset, x2: s.x2 + nx * finalOffset, y2: s.y2 + ny * finalOffset } as LineShape;
        }
        case 'circle': {
            const d = distance({ x: s.x, y: s.y }, sidePoint);
            const newRadius = d > s.radius ? s.radius + dist : Math.max(0.1, s.radius - dist);
            return { ...s, id, radius: newRadius } as CircleShape;
        }
        case 'arc': {
            const d = distance({ x: s.x, y: s.y }, sidePoint);
            const newRadius = d > s.radius ? s.radius + dist : Math.max(0.1, s.radius - dist);
            return { ...s, id, radius: newRadius } as ArcShape;
        }
        case 'rect': {
            const poly: PolyShape = { id, type: 'pline', layer: s.layer, color: s.color, points: [{ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y }, { x: s.x + s.width, y: s.y + s.height }, { x: s.x, y: s.y + s.height }], closed: true } as any;
            const offPoly = offsetShape(poly as any, dist, sidePoint) as PolyShape;
            if (!offPoly) return null;
            const pts = offPoly.points;
            const x = Math.min(pts[0].x, pts[2].x), y = Math.min(pts[0].y, pts[2].y);
            const w = Math.abs(pts[1].x - pts[0].x), h = Math.abs(pts[2].y - pts[1].y);
            return { ...s, id, x, y, width: w, height: h } as RectShape;
        }
        case 'pline': case 'polygon': case 'dline': {
            const pts = s.points;
            if (pts.length < 2) return null;
            const isClosed = (s as any).closed || s.type === 'polygon';
            const segments: { p1: Point, p2: Point }[] = [];
            for (let i = 0; i < (isClosed ? pts.length : pts.length - 1); i++) {
                segments.push({ p1: pts[i], p2: pts[(i + 1) % pts.length] });
            }

            const offsetSegments = segments.map(seg => {
                const dx = seg.p2.x - seg.p1.x, dy = seg.p2.y - seg.p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) return { p1: seg.p1, p2: seg.p2 };
                const nx = -dy / len, ny = dx / len;
                const test = { x: seg.p1.x + nx * dist, y: seg.p1.y + ny * dist };
                const finalOffset = distance(sidePoint, test) < distance(sidePoint, { x: seg.p1.x - nx * dist, y: seg.p1.y - ny * dist }) ? dist : -dist;
                return { p1: { x: seg.p1.x + nx * finalOffset, y: seg.p1.y + ny * finalOffset }, p2: { x: seg.p2.x + nx * finalOffset, y: seg.p2.y + ny * finalOffset } };
            });

            const newPts: Point[] = [];
            if (!isClosed) {
                newPts.push(offsetSegments[0].p1);
                for (let i = 0; i < offsetSegments.length - 1; i++) {
                    const inter = getIntersection(offsetSegments[i].p1, offsetSegments[i].p2, offsetSegments[i+1].p1, offsetSegments[i+1].p2, true);
                    newPts.push(inter || offsetSegments[i].p2);
                }
                newPts.push(offsetSegments[offsetSegments.length - 1].p2);
            } else {
                for (let i = 0; i < offsetSegments.length; i++) {
                    const cur = offsetSegments[i], next = offsetSegments[(i + 1) % offsetSegments.length];
                    const inter = getIntersection(cur.p1, cur.p2, next.p1, next.p2, true);
                    newPts.push(inter || cur.p2);
                }
            }
            
            return { ...s, id, points: newPts } as PolyShape;
        }
    }
    return null;
};

export const rotateShape = (s: Shape, base: Point, angle: number): Shape => {
    const ns = { ...s };
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const rotatePt = (p: Point) => {
        const dx = p.x - base.x, dy = p.y - base.y;
        return { x: base.x + dx * cos - dy * sin, y: base.y + dx * sin + dy * cos };
    };

    switch (ns.type) {
        case 'line': {
            const p1 = rotatePt({ x: ns.x1, y: ns.y1 }), p2 = rotatePt({ x: ns.x2, y: ns.y2 });
            ns.x1 = p1.x; ns.y1 = p1.y; ns.x2 = p2.x; ns.y2 = p2.y; break;
        }
        case 'circle': case 'arc': case 'text': case 'mtext': case 'rect': case 'point': {
            const p = rotatePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; 
            if (ns.type === 'text' || ns.type === 'mtext') (ns as any).rotation = ((ns as any).rotation || 0) + angle;
            if (ns.type === 'rect') {
                // Rect actually needs to become a Polyline or we need to support rotation in RectShape
                // For simplicity let's assume Rect is axis-aligned unless we add rotation field
                // Standard CAD usually turns rectangles into polylines for rotation
            }
            break;
        }
        case 'ellipse': {
            const p = rotatePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; ns.rotation += angle; break;
        }
        case 'pline': case 'polygon': case 'spline':
            ns.points = ns.points.map(p => rotatePt(p)); break;
    }
    return ns as Shape;
};

export const scaleShape = (s: Shape, base: Point, factor: number): Shape => {
    const ns = { ...s };
    const scalePt = (p: Point) => ({ x: base.x + (p.x - base.x) * factor, y: base.y + (p.y - base.y) * factor });

    switch (ns.type) {
        case 'line': {
            const p1 = scalePt({ x: ns.x1, y: ns.y1 }), p2 = scalePt({ x: ns.x2, y: ns.y2 });
            ns.x1 = p1.x; ns.y1 = p1.y; ns.x2 = p2.x; ns.y2 = p2.y; break;
        }
        case 'circle': case 'arc': {
            const p = scalePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; ns.radius *= factor; break;
        }
        case 'text': case 'mtext': {
            const p = scalePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; ns.size *= factor; break;
        }
        case 'rect': {
            const p = scalePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; ns.width *= factor; ns.height *= factor; break;
        }
        case 'ellipse': {
            const p = scalePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; ns.rx *= factor; ns.ry *= factor; break;
        }
        case 'point': {
            const p = scalePt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; break;
        }
        case 'pline': case 'polygon': case 'spline':
            ns.points = ns.points.map(p => scalePt(p)); break;
    }
    return ns as Shape;
};

export const mirrorShape = (s: Shape, p1: Point, p2: Point): Shape => {
    const ns = { ...s };
    const mirrorPt = (p: Point) => {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return p;
        const a = (dx * dx - dy * dy) / (dx * dx + dy * dy);
        const b = 2 * dx * dy / (dx * dx + dy * dy);
        const x = a * (p.x - p1.x) + b * (p.y - p1.y) + p1.x;
        const y = b * (p.x - p1.x) - a * (p.y - p1.y) + p1.y;
        return { x, y };
    };

    switch (ns.type) {
        case 'line': {
            const mp1 = mirrorPt({ x: ns.x1, y: ns.y1 }), mp2 = mirrorPt({ x: ns.x2, y: ns.y2 });
            ns.x1 = mp1.x; ns.y1 = mp1.y; ns.x2 = mp2.x; ns.y2 = mp2.y; break;
        }
        case 'circle': case 'arc': case 'text': case 'mtext': case 'rect': case 'ellipse': case 'point': {
            const p = mirrorPt({ x: ns.x, y: ns.y });
            ns.x = p.x; ns.y = p.y; 
            if (ns.type === 'arc') ns.counterClockwise = !ns.counterClockwise;
            // Mirroring text/rect/ellipse might need more complex angle flipping
            break;
        }
        case 'pline': case 'polygon': case 'spline':
            ns.points = ns.points.map(p => mirrorPt(p)); break;
    }
    return ns as Shape;
};

export const getExtendedShapes = (boundaries: Shape[], targets: Shape[], pick: Point): Shape[] => {
    const results: Shape[] = [];
    targets.forEach(target => {
        if (target.type === 'line') {
            const p1 = {x: target.x1, y: target.y1}, p2 = {x: target.x2, y: target.y2};
            
            // Determine which end is closer to pick point to know which way to extend
            const d1 = distance(pick, p1), d2 = distance(pick, p2);
            const nearPt = d1 < d2 ? p1 : p2;
            const farPt = d1 < d2 ? p2 : p1;
            
            // Ray from farPt through nearPt
            const dx = nearPt.x - farPt.x, dy = nearPt.y - farPt.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) { results.push(target); return; }
            const ux = dx/len, uy = dy/len;
            
            // Ray representation: nearPt + t * (ux, uy) where t > 0
            let minT = Infinity;
            let bestInter: Point | null = null;
            
            boundaries.forEach(boundary => {
                const segments = getShapeSegments(boundary);
                segments.forEach(seg => {
                    // Infinite line intersection
                    const inter = getIntersection(farPt, nearPt, seg.p1, seg.p2, true);
                    if (inter) {
                        // Check if intersection is on the boundary segment
                        const dToSeg = distToSegment(inter.x, inter.y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                        if (dToSeg < 0.001) {
                            // Check if it's in the extension direction (t > len)
                            const t = (inter.x - farPt.x) * ux + (inter.y - farPt.y) * uy;
                            if (t > len + 0.001 && t < minT) {
                                minT = t;
                                bestInter = inter;
                            }
                        }
                    }
                });
            });
            
            if (bestInter) {
                if (d1 < d2) {
                    results.push({ ...target, id: generateId(), x1: bestInter.x, y1: bestInter.y } as Shape);
                } else {
                    results.push({ ...target, id: generateId(), x2: bestInter.x, y2: bestInter.y } as Shape);
                }
            } else {
                results.push(target);
            }
        } else {
            results.push(target);
        }
    });
    return results;
};

export const stretchShape = (s: Shape, xMin: number, yMin: number, xMax: number, yMax: number, dx: number, dy: number): Shape => {
    const ns = { ...s };
    const inRect = (p: Point) => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;

    switch (ns.type) {
        case 'line':
            if (inRect({ x: ns.x1, y: ns.y1 })) { ns.x1 += dx; ns.y1 += dy; }
            if (inRect({ x: ns.x2, y: ns.y2 })) { ns.x2 += dx; ns.y2 += dy; }
            break;
        case 'circle':
            if (inRect({ x: ns.x, y: ns.y })) { ns.x += dx; ns.y += dy; }
            break;
        case 'arc':
            if (inRect({ x: ns.x, y: ns.y })) { ns.x += dx; ns.y += dy; }
            break;
        case 'rect': {
            const p1 = inRect({ x: ns.x, y: ns.y });
            const p2 = inRect({ x: ns.x + ns.width, y: ns.y });
            const p3 = inRect({ x: ns.x + ns.width, y: ns.y + ns.height });
            const p4 = inRect({ x: ns.x, y: ns.y + ns.height });
            
            if (p1 && p2 && p3 && p4) { ns.x += dx; ns.y += dy; }
            else {
                // If only some corners are inside, we must convert to pline to "stretch" correctly
                const poly: PolyShape = { ...ns, type: 'pline', points: [{ x: ns.x, y: ns.y }, { x: ns.x + ns.width, y: ns.y }, { x: ns.x + ns.width, y: ns.y + ns.height }, { x: ns.x, y: ns.y + ns.height }], closed: true };
                return stretchShape(poly, xMin, yMin, xMax, yMax, dx, dy);
            }
            break;
        }
        case 'pline': case 'polygon': case 'spline': case 'dline':
            ns.points = ns.points.map(p => inRect(p) ? { x: p.x + dx, y: p.y + dy } : p);
            break;
        case 'dimension':
            if (inRect({ x: ns.x1, y: ns.y1 })) { ns.x1 += dx; ns.y1 += dy; }
            if (inRect({ x: ns.x2, y: ns.y2 })) { ns.x2 += dx; ns.y2 += dy; }
            if (inRect({ x: ns.dimX, y: ns.dimY })) { ns.dimX += dx; ns.dimY += dy; }
            break;
    }
    return ns as Shape;
};

const SNAP_PRIORITY: Record<string, number> = {
    'end': 1,
    'int': 2,
    'appint': 2.5,
    'mid': 3,
    'cen': 4,
    'gcen': 4.5,
    'quad': 5,
    'perp': 6,
    'tan': 7,
    'ext': 8,
    'par': 9,
    'near': 10,
    'node': 11
};

export const findBestSnap = (p: Point, shapes: Shape[], options: SnapOptions, ts: number, basePoint: Point | null): SnapPoint | null => {
    const threshold = 15 / ts;
    const candidates: SnapPoint[] = [];

    const addCandidate = (x: number, y: number, type: SnapPoint['type']) => {
        const d = distance(p, { x, y });
        if (d <= threshold) {
            candidates.push({ x, y, type });
        }
    };

    // Performance: Spatial filtering - only check shapes within a bounding box around the cursor
    const xMin = p.x - threshold * 5, xMax = p.x + threshold * 5;
    const yMin = p.y - threshold * 5, yMax = p.y + threshold * 5;

    const nearbyShapes = shapes.filter(s => {
        const b = getShapeBounds(s);
        // For extension/apparent intersection, we might need a larger box, but let's start with this
        return !(b.xMax < xMin - 500/ts || b.xMin > xMax + 500/ts || b.yMax < yMin - 500/ts || b.yMin > yMax + 500/ts);
    });

    nearbyShapes.forEach(s => {
        switch (s.type) {
            case 'line':
                if (options.endpoint) { addCandidate(s.x1, s.y1, 'end'); addCandidate(s.x2, s.y2, 'end'); }
                if (options.midpoint) addCandidate((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 'mid');
                if (options.perpendicular && basePoint) {
                    const perp = projectPointOnLine(basePoint, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
                    addCandidate(perp.x, perp.y, 'perp');
                }
                if (options.extension) {
                    const ext = projectPointOnLine(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
                    const d1 = distance(ext, {x: s.x1, y: s.y1});
                    const d2 = distance(ext, {x: s.x2, y: s.y2});
                    const len = distance({x: s.x1, y: s.y1}, {x: s.x2, y: s.y2});
                    // If project point is outside the segment but close to the line
                    if ((d1 > len || d2 > len) && distance(p, ext) < threshold) {
                        addCandidate(ext.x, ext.y, 'ext');
                    }
                }
                if (options.parallel && basePoint) {
                    // If we are drawing a line from basePoint, check if current vector is parallel to s
                    const v1 = { x: p.x - basePoint.x, y: p.y - basePoint.y };
                    const v2 = { x: s.x2 - s.x1, y: s.y2 - s.y1 };
                    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                    if (len1 > 0 && len2 > 0) {
                        const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
                        if (Math.abs(Math.abs(dot) - 1) < 0.01) {
                            // Project p onto the parallel line through basePoint
                            const parallelPoint = { x: basePoint.x + (v2.x / len2) * len1 * (dot > 0 ? 1 : -1), y: basePoint.y + (v2.y / len2) * len1 * (dot > 0 ? 1 : -1) };
                            addCandidate(parallelPoint.x, parallelPoint.y, 'par');
                        }
                    }
                }
                if (options.nearest) {
                    const near = projectPointOnLine(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
                    const t = ((near.x - s.x1) * (s.x2 - s.x1) + (near.y - s.y1) * (s.y2 - s.y1)) / distSq({x:s.x1, y:s.y1}, {x:s.x2, y:s.y2});
                    if (t >= 0 && t <= 1) addCandidate(near.x, near.y, 'near');
                }
                break;
            case 'circle':
                if (options.center) addCandidate(s.x, s.y, 'cen');
                if (options.quadrant) {
                    addCandidate(s.x + s.radius, s.y, 'quad'); addCandidate(s.x - s.radius, s.y, 'quad');
                    addCandidate(s.x, s.y + s.radius, 'quad'); addCandidate(s.x, s.y - s.radius, 'quad');
                }
                if (options.tangent && basePoint) {
                    const d = distance({x: s.x, y: s.y}, basePoint);
                    if (d > s.radius) {
                        const angle = Math.acos(s.radius / d);
                        const baseAngle = Math.atan2(basePoint.y - s.y, basePoint.x - s.x);
                        const t1 = { x: s.x + s.radius * Math.cos(baseAngle + angle), y: s.y + s.radius * Math.sin(baseAngle + angle) };
                        const t2 = { x: s.x + s.radius * Math.cos(baseAngle - angle), y: s.y + s.radius * Math.sin(baseAngle - angle) };
                        addCandidate(t1.x, t1.y, 'tan');
                        addCandidate(t2.x, t2.y, 'tan');
                    }
                }
                if (options.nearest) {
                    const angle = Math.atan2(p.y - s.y, p.x - s.x);
                    addCandidate(s.x + s.radius * Math.cos(angle), s.y + s.radius * Math.sin(angle), 'near');
                }
                break;
            case 'arc':
                if (options.center) addCandidate(s.x, s.y, 'cen');
                if (options.endpoint) {
                    addCandidate(s.x + s.radius * Math.cos(s.startAngle), s.y + s.radius * Math.sin(s.startAngle), 'end');
                    addCandidate(s.x + s.radius * Math.cos(s.endAngle), s.y + s.radius * Math.sin(s.endAngle), 'end');
                }
                if (options.nearest) {
                    let angle = Math.atan2(p.y - s.y, p.x - s.x);
                    while (angle < 0) angle += Math.PI * 2;
                    let sA = s.startAngle, eA = s.endAngle;
                    while (sA < 0) sA += Math.PI * 2;
                    while (eA < 0) eA += Math.PI * 2;
                    let inArc = false;
                    if (s.counterClockwise) { if (eA < sA) inArc = angle >= sA || angle <= eA; else inArc = angle >= sA && angle <= eA; }
                    else { if (sA < eA) inArc = angle >= eA || angle <= sA; else inArc = angle >= eA && angle <= sA; }
                    if (inArc) addCandidate(s.x + s.radius * Math.cos(angle), s.y + s.radius * Math.sin(angle), 'near');
                }
                break;
            case 'pline': case 'polygon':
                s.points.forEach((pt, i) => {
                    if (options.endpoint) addCandidate(pt.x, pt.y, 'end');
                    if (options.midpoint && i < s.points.length - 1) addCandidate((pt.x + s.points[i + 1].x) / 2, (pt.y + s.points[i + 1].y) / 2, 'mid');
                    if (options.nearest && i < s.points.length - 1) {
                        const near = projectPointOnLine(p, s.points[i], s.points[i+1]);
                        const t = ((near.x - s.points[i].x) * (s.points[i+1].x - s.points[i].x) + (near.y - s.points[i].y) * (s.points[i+1].y - s.points[i].y)) / distSq(s.points[i], s.points[i+1]);
                        if (t >= 0 && t <= 1) addCandidate(near.x, near.y, 'near');
                    }
                });
                if ((s.closed || s.type === 'polygon') && s.points.length > 2) {
                    const last = s.points[s.points.length - 1], first = s.points[0];
                    if (options.midpoint) addCandidate((last.x + first.x) / 2, (last.y + first.y) / 2, 'mid');
                    if (options.gcenter) {
                        let cx = 0, cy = 0;
                        s.points.forEach(pt => { cx += pt.x; cy += pt.y; });
                        addCandidate(cx / s.points.length, cy / s.points.length, 'gcen');
                    }
                    if (options.nearest) {
                        const near = projectPointOnLine(p, last, first);
                        const t = ((near.x - last.x) * (first.x - last.x) + (near.y - last.y) * (first.y - last.y)) / distSq(last, first);
                        if (t >= 0 && t <= 1) addCandidate(near.x, near.y, 'near');
                    }
                }
                break;
            case 'rect':
                const corners = [{x:s.x, y:s.y}, {x:s.x+s.width, y:s.y}, {x:s.x+s.width, y:s.y+s.height}, {x:s.x, y:s.y+s.height}];
                if (options.endpoint) corners.forEach(c => addCandidate(c.x, c.y, 'end'));
                if (options.midpoint) {
                    for(let i=0; i<4; i++) {
                        const p1 = corners[i], p2 = corners[(i+1)%4];
                        addCandidate((p1.x+p2.x)/2, (p1.y+p2.y)/2, 'mid');
                    }
                }
                if (options.center || options.gcenter) addCandidate(s.x + s.width/2, s.y + s.height/2, 'gcen');
                if (options.nearest) {
                    for(let i=0; i<4; i++) {
                        const p1 = corners[i], p2 = corners[(i+1)%4];
                        const near = projectPointOnLine(p, p1, p2);
                        const t = ((near.x - p1.x) * (p2.x - p1.x) + (near.y - p1.y) * (p2.y - p1.y)) / distSq(p1, p2);
                        if (t >= 0 && t <= 1) addCandidate(near.x, near.y, 'near');
                    }
                }
                break;
        }
    });

    // 2. Intersection Snaps
    if (options.intersection || options.appint) {
        const segments: { p1: Point, p2: Point }[] = [];
        nearbyShapes.forEach(s => segments.push(...getShapeSegments(s)));

        for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
                // Regular intersection
                if (options.intersection) {
                    const inter = getIntersection(segments[i].p1, segments[i].p2, segments[j].p1, segments[j].p2);
                    if (inter) addCandidate(inter.x, inter.y, 'int');
                }
                // Apparent intersection
                if (options.appint) {
                    const inter = getIntersection(segments[i].p1, segments[i].p2, segments[j].p1, segments[j].p2, true);
                    if (inter) {
                        // Only add if it's NOT a regular intersection (to avoid duplicates)
                        const regular = getIntersection(segments[i].p1, segments[i].p2, segments[j].p1, segments[j].p2);
                        if (!regular) addCandidate(inter.x, inter.y, 'appint');
                    }
                }
            }
        }
    }

    if (candidates.length === 0) return null;

    // Priority sorting: Highest priority first, then closest distance
    candidates.sort((a, b) => {
        const pa = SNAP_PRIORITY[a.type] || 99;
        const pb = SNAP_PRIORITY[b.type] || 99;
        if (pa !== pb) return pa - pb;
        return distance(p, a) - distance(p, b);
    });

    return candidates[0];
};

export const getShapesInRect = (p1: Point, p2: Point, shapes: Shape[], crossing: boolean): Shape[] => {
    const xMin = Math.min(p1.x, p2.x), xMax = Math.max(p1.x, p2.x);
    const yMin = Math.min(p1.y, p2.y), yMax = Math.max(p1.y, p2.y);
    const rectSegs = [
        {p1:{x:xMin, y:yMin}, p2:{x:xMax, y:yMin}}, 
        {p1:{x:xMax, y:yMin}, p2:{x:xMax, y:yMax}}, 
        {p1:{x:xMax, y:yMax}, p2:{x:xMin, y:yMax}}, 
        {p1:{x:xMin, y:yMax}, p2:{x:xMin, y:yMin}}
    ];

    const isInside = (p: Point) => isPointInRect(p, xMin, yMin, xMax, yMax);

    return shapes.filter(s => {
        const bounds = getShapeBounds(s);
        
        // Quick rejection
        if (!isRectIntersecting({xMin, yMin, xMax, yMax}, bounds)) return false;

        // Container Check
        const allInside = () => {
            switch (s.type) {
                case 'line': return isInside({x:s.x1, y:s.y1}) && isInside({x:s.x2, y:s.y2});
                case 'circle': return bounds.xMin >= xMin && bounds.xMax <= xMax && bounds.yMin >= yMin && bounds.yMax <= yMax;
                case 'rect': return isInside({x:s.x, y:s.y}) && isInside({x:s.x+s.width, y:s.y+s.height});
                case 'arc': {
                    const pStart = { x: s.x + s.radius * Math.cos(s.startAngle), y: s.y + s.radius * Math.sin(s.startAngle) };
                    const pEnd = { x: s.x + s.radius * Math.cos(s.endAngle), y: s.y + s.radius * Math.sin(s.endAngle) };
                    return isInside(pStart) && isInside(pEnd) && bounds.xMin >= xMin && bounds.xMax <= xMax && bounds.yMin >= yMin && bounds.yMax <= yMax;
                }
                case 'pline': case 'polygon': case 'spline': case 'dline':
                    return s.points.every(isInside);
                case 'ellipse': case 'text': case 'mtext': case 'point':
                    return isInside({x:s.x, y:s.y}) && bounds.xMin >= xMin && bounds.xMax <= xMax && bounds.yMin >= yMin && bounds.yMax <= yMax;
                default: return false;
            }
        };

        if (allInside()) return true;
        if (!crossing) return false;

        // Crossing Check: Any point inside OR any intersection
        switch (s.type) {
            case 'line':
                return isInside({x:s.x1, y:s.y1}) || isInside({x:s.x2, y:s.y2}) || rectSegs.some(rs => getIntersection({x:s.x1, y:s.y1}, {x:s.x2, y:s.y2}, rs.p1, rs.p2) !== null);
            case 'circle': {
                const closestX = Math.max(xMin, Math.min(s.x, xMax));
                const closestY = Math.max(yMin, Math.min(s.y, yMax));
                const d2 = Math.pow(s.x - closestX, 2) + Math.pow(s.y - closestY, 2);
                return d2 <= s.radius * s.radius;
            }
            case 'rect': {
                return isRectIntersecting({xMin, yMin, xMax, yMax}, {xMin: s.x, yMin: s.y, xMax: s.x + s.width, yMax: s.y + s.height});
            }
            case 'arc':
            case 'ellipse':
            case 'pline':
            case 'polygon':
            case 'spline':
            case 'dline':
            case 'text':
            case 'mtext': {
                const segs = getShapeSegments(s);
                return segs.some(seg => isInside(seg.p1) || isInside(seg.p2) || rectSegs.some(rs => getIntersection(seg.p1, seg.p2, rs.p1, rs.p2) !== null));
            }
            case 'point':
                return isInside({x:s.x, y:s.y});
        }

        return false;
    });
};
