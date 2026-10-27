/**
 * osnapEngine.js
 * ==============
 * High-Precision Object Snapping (OSNAP) Engine for MeplanIQ 2D CAD Canvas.
 * Supports:
 *  - Endpoint (Square glyph)
 *  - Midpoint (Triangle glyph)
 *  - Perpendicular (Perpendicular glyph)
 *  - Intersection (Cross glyph)
 *  - Center (Circle glyph)
 *  - Grid Snap (Dot glyph)
 */

export const OSNAP_TYPES = {
  ENDPOINT: 'endpoint',
  MIDPOINT: 'midpoint',
  PERPENDICULAR: 'perpendicular',
  INTERSECTION: 'intersection',
  CENTER: 'center',
  GRID: 'grid'
};

/**
 * Calculates Euclidean distance between two points.
 */
export function ptDist(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Computes closest point on line segment AB to point P.
 */
export function projectPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return { pt: { x: a.x, y: a.y }, t: 0, dist: ptDist(p, a) };

  const apx = p.x - a.x;
  const apy = p.y - a.y;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = {
    x: a.x + t * abx,
    y: a.y + t * aby
  };
  return { pt: proj, t, dist: ptDist(p, proj) };
}

/**
 * Computes intersection between two line segments (if any).
 */
export function segmentIntersection(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return null;

  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    return {
      x: p1.x + u * (p2.x - p1.x),
      y: p1.y + u * (p2.y - p1.y)
    };
  }
  return null;
}

/**
 * Extracts all wall segments from solveData (rooms, wall_lines, wall_polygons).
 */
export function extractWallSegments(solveData) {
  const segments = [];

  // 1. Segments from Rooms
  (solveData?.rooms || []).forEach(room => {
    const pts = room.filleted_points || room.points || [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      segments.push({
        a: { x: p1[0], y: p1[1] },
        b: { x: p2[0], y: p2[1] },
        source: 'room',
        roomName: room.name,
        wallIndex: i
      });
    }
  });

  // 2. Segments from explicit wall_lines
  (solveData?.wall_lines || []).forEach((line, idx) => {
    segments.push({
      a: { x: line.x1, y: line.y1 },
      b: { x: line.x2, y: line.y2 },
      source: 'wall_line',
      id: line.id || `wl-${idx}`
    });
  });

  // 3. Outer boundary segments of combined wall polygons
  const combined = solveData?.combined_wall_polygons || [];
  combined.forEach((cWall, cIdx) => {
    const outer = cWall.outer_polygon || [];
    for (let i = 0; i < outer.length; i++) {
      const p1 = outer[i];
      const p2 = outer[(i + 1) % outer.length];
      segments.push({
        a: { x: p1[0], y: p1[1] },
        b: { x: p2[0], y: p2[1] },
        source: 'combined_wall',
        id: `cw-${cIdx}-${i}`
      });
    }
  });

  return segments;
}

/**
 * Searches for the nearest OSNAP point within tolerance.
 * Prioritizes: Endpoint > Midpoint > Intersection > Perpendicular > Grid
 */
export function findNearestOsnap(cursorPt, solveData, zoom, options = {}) {
  const {
    enabled = true,
    snapRadiusPx = 18,
    activeStartPoint = null,
    enableGridSnap = true,
    gridSize = 100
  } = options;

  if (!enabled || !cursorPt) return null;

  const toleranceCad = snapRadiusPx / zoom;
  let bestCandidate = null;
  let minDistance = Infinity;

  const segments = extractWallSegments(solveData);

  // 1. ENDPOINTS (Highest Priority)
  for (const seg of segments) {
    const dA = ptDist(cursorPt, seg.a);
    if (dA < toleranceCad && dA < minDistance) {
      minDistance = dA;
      bestCandidate = {
        point: { x: seg.a.x, y: seg.a.y },
        type: OSNAP_TYPES.ENDPOINT,
        label: 'Endpoint',
        distance: dA,
        color: '#10B981'
      };
    }
    const dB = ptDist(cursorPt, seg.b);
    if (dB < toleranceCad && dB < minDistance) {
      minDistance = dB;
      bestCandidate = {
        point: { x: seg.b.x, y: seg.b.y },
        type: OSNAP_TYPES.ENDPOINT,
        label: 'Endpoint',
        distance: dB,
        color: '#10B981'
      };
    }
  }

  // 2. MIDPOINTS
  for (const seg of segments) {
    const mid = {
      x: (seg.a.x + seg.b.x) / 2,
      y: (seg.a.y + seg.b.y) / 2
    };
    const dMid = ptDist(cursorPt, mid);
    // Allow midpoint if close and no closer endpoint
    if (dMid < toleranceCad && dMid < minDistance) {
      minDistance = dMid;
      bestCandidate = {
        point: mid,
        type: OSNAP_TYPES.MIDPOINT,
        label: 'Midpoint',
        distance: dMid,
        color: '#3B82F6'
      };
    }
  }

  // 3. INTERSECTIONS
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const isect = segmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (isect) {
        const dIsect = ptDist(cursorPt, isect);
        if (dIsect < toleranceCad && dIsect < minDistance) {
          minDistance = dIsect;
          bestCandidate = {
            point: isect,
            type: OSNAP_TYPES.INTERSECTION,
            label: 'Intersection',
            distance: dIsect,
            color: '#F59E0B'
          };
        }
      }
    }
  }

  // 4. PERPENDICULAR (Active only when drawing from a start point)
  if (activeStartPoint) {
    for (const seg of segments) {
      const proj = projectPointOnSegment(activeStartPoint, seg.a, seg.b);
      // If cursor is close to the perpendicular foot
      const dPerp = ptDist(cursorPt, proj.pt);
      if (dPerp < toleranceCad && dPerp < minDistance && proj.t > 0.05 && proj.t < 0.95) {
        minDistance = dPerp;
        bestCandidate = {
          point: proj.pt,
          type: OSNAP_TYPES.PERPENDICULAR,
          label: 'Perpendicular',
          distance: dPerp,
          color: '#EC4899'
        };
      }
    }
  }

  // 5. GRID SNAP FALLBACK
  if (!bestCandidate && enableGridSnap && gridSize > 0) {
    const gx = Math.round(cursorPt.x / gridSize) * gridSize;
    const gy = Math.round(cursorPt.y / gridSize) * gridSize;
    const gPt = { x: gx, y: gy };
    const dG = ptDist(cursorPt, gPt);
    if (dG < toleranceCad * 0.75) {
      return {
        point: gPt,
        type: OSNAP_TYPES.GRID,
        label: `Grid (${gridSize}mm)`,
        distance: dG,
        color: '#64748B'
      };
    }
  }

  return bestCandidate;
}
