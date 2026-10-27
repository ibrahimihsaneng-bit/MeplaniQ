/**
 * cadDrawingUtils.js
 * ==================
 * Essential CAD Drafting Mathematics and Architectural Geometry Utilities.
 */

import { ptDist, projectPointOnSegment, extractWallSegments } from './osnapEngine';

export { ptDist };

/**
 * Applies Orthogonal constraint (0°, 90°, 180°, 270°) relative to startPoint.
 */
export function applyOrthoConstraint(startPt, rawPt, isShiftDown = false) {
  if (!startPt || isShiftDown) return rawPt;

  const dx = rawPt.x - startPt.x;
  const dy = rawPt.y - startPt.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: rawPt.x, y: startPt.y };
  } else {
    return { x: startPt.x, y: rawPt.y };
  }
}

/**
 * Applies Polar angle tracking (snaps to increments of polarStepDeg, default 45°).
 */
export function applyPolarConstraint(startPt, rawPt, polarStepDeg = 45) {
  if (!startPt) return rawPt;

  const dx = rawPt.x - startPt.x;
  const dy = rawPt.y - startPt.y;
  const length = Math.hypot(dx, dy);
  if (length < 10) return rawPt;

  const rawAngle = Math.atan2(dy, dx);
  const rawDeg = (rawAngle * 180) / Math.PI;
  const normalizedDeg = (rawDeg + 360) % 360;

  const snappedDeg = Math.round(normalizedDeg / polarStepDeg) * polarStepDeg;
  const rad = (snappedDeg * Math.PI) / 180;

  return {
    x: startPt.x + length * Math.cos(rad),
    y: startPt.y + length * Math.sin(rad),
    snappedAngleDeg: snappedDeg
  };
}

/**
 * Formats length into architectural notation (millimeters or meters).
 */
export function formatCadLength(mm, unit = 'mm') {
  if (unit === 'm') {
    return `${(mm / 1000).toFixed(2)} m`;
  }
  return `${Math.round(mm).toLocaleString()} mm`;
}

/**
 * Formats angle in degrees.
 */
export function formatCadAngle(radOrDeg, isRad = false) {
  let deg = isRad ? (radOrDeg * 180) / Math.PI : radOrDeg;
  deg = (deg % 360 + 360) % 360;
  return `${deg.toFixed(1)}°`;
}

/**
 * Computes polygon area using the Shoelace formula (returns area in m²).
 */
export function computePolygonAreaSqm(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = Array.isArray(points[i]) ? { x: points[i][0], y: points[i][1] } : points[i];
    const p2 = Array.isArray(points[j]) ? { x: points[j][0], y: points[j][1] } : points[j];
    area += p1.x * p2.y;
    area -= p2.x * p1.y;
  }
  return Math.abs(area) / (2 * 1e6); // mm² to m²
}

/**
 * Computes centroid of a polygon.
 */
export function computePolygonCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  points.forEach(p => {
    sx += Array.isArray(p) ? p[0] : p.x;
    sy += Array.isArray(p) ? p[1] : p.y;
  });
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * Creates 4-point wall polygon from line segment with wall thickness.
 */
export function createWallPolygonFromLine(p1, p2, thicknessMm = 200) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];

  const halfT = thicknessMm / 2;
  const nx = (-dy / len) * halfT;
  const ny = (dx / len) * halfT;

  return [
    [Math.round(p1.x + nx), Math.round(p1.y + ny)],
    [Math.round(p2.x + nx), Math.round(p2.y + ny)],
    [Math.round(p2.x - nx), Math.round(p2.y - ny)],
    [Math.round(p1.x - nx), Math.round(p1.y - ny)]
  ];
}

/**
 * Detects the closest wall segment to cursor for hosting Doors, Windows, or Pipe Clamps.
 */
export function detectClosestWall(cursorPt, solveData, maxHitDistCad = 350) {
  if (!cursorPt) return null;
  const segments = extractWallSegments(solveData);

  let closest = null;
  let minDist = maxHitDistCad;

  for (const seg of segments) {
    const proj = projectPointOnSegment(cursorPt, seg.a, seg.b);
    if (proj.dist < minDist && proj.t >= 0 && proj.t <= 1) {
      minDist = proj.dist;
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const segLen = Math.hypot(dx, dy);
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      // Normal vector pointing perpendicular to wall
      const normX = -dy / (segLen || 1);
      const normY = dx / (segLen || 1);

      closest = {
        segment: seg,
        projectedPoint: proj.pt,
        t: proj.t,
        distance: proj.dist,
        wallLength: segLen,
        angleRad,
        angleDeg: (angleDeg + 360) % 360,
        normal: { x: normX, y: normY },
        hostRoom: seg.roomName || 'Wall'
      };
    }
  }

  return closest;
}
