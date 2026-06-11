import { Shape, BlockDefinition } from '../types';
import { getShapeBounds, isRectIntersecting } from './cadService';

export interface Bounds {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export class QuadTreeNode {
  boundary: Bounds;
  shapes: { shape: Shape; bounds: Bounds }[] = [];
  children: [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode] | null = null;
  depth: number;
  capacity: number;
  maxDepth: number;

  constructor(boundary: Bounds, depth = 0, capacity = 32, maxDepth = 8) {
    this.boundary = boundary;
    this.depth = depth;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
  }

  isIntersecting(b1: Bounds, b2: Bounds): boolean {
    return isRectIntersecting(b1, b2);
  }

  subdivide() {
    const { xMin, yMin, xMax, yMax } = this.boundary;
    const midX = (xMin + xMax) / 2;
    const midY = (yMin + yMax) / 2;

    this.children = [
      // Top-Left (North-West)
      new QuadTreeNode({ xMin, yMin: midY, xMax: midX, yMax }, this.depth + 1, this.capacity, this.maxDepth),
      // Top-Right (North-East)
      new QuadTreeNode({ xMin: midX, yMin: midY, xMax, yMax }, this.depth + 1, this.capacity, this.maxDepth),
      // Bottom-Left (South-West)
      new QuadTreeNode({ xMin, yMin, xMax: midX, yMax: midY }, this.depth + 1, this.capacity, this.maxDepth),
      // Bottom-Right (South-East)
      new QuadTreeNode({ xMin: midX, yMin, xMax, yMax: midY }, this.depth + 1, this.capacity, this.maxDepth),
    ];

    // Distribute current shapes
    const existing = this.shapes;
    this.shapes = [];
    for (const item of existing) {
      this.insertToChildren(item.shape, item.bounds);
    }
  }

  insertToChildren(shape: Shape, bounds: Bounds): boolean {
    if (!this.children) return false;
    let placed = false;
    for (const child of this.children) {
      if (this.isIntersecting(child.boundary, bounds)) {
        child.insert(shape, bounds);
        placed = true;
      }
    }
    return placed;
  }

  insert(shape: Shape, bounds: Bounds) {
    if (!this.isIntersecting(this.boundary, bounds)) {
      return;
    }

    if (this.children) {
      this.insertToChildren(shape, bounds);
      return;
    }

    this.shapes.push({ shape, bounds });

    if (this.shapes.length > this.capacity && this.depth < this.maxDepth) {
      // Avoid infinite subdivision on degenerate zero-area nodes
      const dx = this.boundary.xMax - this.boundary.xMin;
      const dy = this.boundary.yMax - this.boundary.yMin;
      if (Math.abs(dx) > 1e-4 && Math.abs(dy) > 1e-4) {
        this.subdivide();
      }
    }
  }

  query(box: Bounds, resultSet: Set<Shape>) {
    if (!this.isIntersecting(this.boundary, box)) {
      return;
    }

    if (this.children) {
      for (const child of this.children) {
        child.query(box, resultSet);
      }
    } else {
      for (const item of this.shapes) {
        if (this.isIntersecting(item.bounds, box)) {
          resultSet.add(item.shape);
        }
      }
    }
  }
}

export class DrawingSpatialIndex {
  root: QuadTreeNode;
  bounds: Bounds;

  constructor(shapes: Shape[], blocks?: Record<string, BlockDefinition>) {
    // Determine the optimal viewport coordinates
    let xMin = -1000;
    let yMin = -1000;
    let xMax = 1000;
    let yMax = 1000;

    if (shapes.length > 0) {
      let first = true;
      for (const s of shapes) {
        let b = s._bounds;
        if (!b) {
          b = getShapeBounds(s, blocks) || { xMin: -100, yMin: -100, xMax: 100, yMax: 100 };
          // Cache the bounding box for future passes
          s._bounds = b;
        }
        
        // Ensure bounds coordinates are valid numeric shapes
        const bxMin = (!b || isNaN(b.xMin) || !isFinite(b.xMin)) ? -100 : b.xMin;
        const bymin = (!b || isNaN(b.yMin) || !isFinite(b.yMin)) ? -100 : b.yMin;
        const bxMax = (!b || isNaN(b.xMax) || !isFinite(b.xMax)) ? 100 : b.xMax;
        const bymax = (!b || isNaN(b.yMax) || !isFinite(b.yMax)) ? 100 : b.yMax;

        if (first) {
          xMin = bxMin;
          yMin = bymin;
          xMax = bxMax;
          yMax = bymax;
          first = false;
        } else {
          xMin = Math.min(xMin, bxMin);
          yMin = Math.min(yMin, bymin);
          xMax = Math.max(xMax, bxMax);
          yMax = Math.max(yMax, bymax);
        }
      }
    }

    // Ensure final collected bounding values are fully sanitized numeric coordinates
    if (isNaN(xMin) || !isFinite(xMin)) xMin = -1000;
    if (isNaN(yMin) || !isFinite(yMin)) yMin = -1000;
    if (isNaN(xMax) || !isFinite(xMax)) xMax = 1000;
    if (isNaN(yMax) || !isFinite(yMax)) yMax = 1000;

    // Add padding to satisfy dynamic zoom queries
    const dx = xMax - xMin;
    const dy = yMax - yMin;
    const padX = Math.max(10, dx * 0.1);
    const padY = Math.max(10, dy * 0.1);
    
    this.bounds = {
      xMin: xMin - padX,
      yMin: yMin - padY,
      xMax: xMax + padX,
      yMax: yMax + padY,
    };

    this.root = new QuadTreeNode(this.bounds);

    for (const s of shapes) {
      const b = s._bounds || getShapeBounds(s, blocks) || { xMin: -100, yMin: -100, xMax: 100, yMax: 100 };
      this.root.insert(s, b);
    }
  }

  query(box: Bounds): Shape[] {
    const resultSet = new Set<Shape>();
    this.root.query(box, resultSet);
    return Array.from(resultSet);
  }
}
