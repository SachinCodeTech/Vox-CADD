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
      this.subdivide();
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
          b = getShapeBounds(s, blocks);
          // Cache the bounding box for future passes
          s._bounds = b;
        }
        if (first) {
          xMin = b.xMin;
          yMin = b.yMin;
          xMax = b.xMax;
          yMax = b.yMax;
          first = false;
        } else {
          xMin = Math.min(xMin, b.xMin);
          yMin = Math.min(yMin, b.yMin);
          xMax = Math.max(xMax, b.xMax);
          yMax = Math.max(yMax, b.yMax);
        }
      }
    }

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
      const b = s._bounds || getShapeBounds(s, blocks);
      this.root.insert(s, b);
    }
  }

  query(box: Bounds): Shape[] {
    const resultSet = new Set<Shape>();
    this.root.query(box, resultSet);
    return Array.from(resultSet);
  }
}
