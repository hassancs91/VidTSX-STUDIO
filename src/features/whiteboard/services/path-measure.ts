import type { PenPosition } from '../types';

export function measurePathLength(path: SVGPathElement): number {
  return path.getTotalLength();
}

export function pointAtLength(path: SVGPathElement, distance: number): PenPosition {
  const point = path.getPointAtLength(distance);
  return { x: point.x, y: point.y };
}

export function setDasharray(path: SVGPathElement, length: number): void {
  path.setAttribute('stroke-dasharray', String(length));
}

export function setDashoffset(path: SVGPathElement, offset: number): void {
  path.setAttribute('stroke-dashoffset', String(offset));
}
