/**
 * cadSnapping.js
 * High-precision AutoCAD Object Snapping (OSNAP) & Ortho/Polar Constraint Engine.
 */

import { dist, projectPointOntoSegment, getLineIntersection, pointFromPolar } from './cadGeometryUtils';

export const SNAP_TYPES = {
  ENDPOINT: 'endpoint',         // Square glyph □
  MIDPOINT: 'midpoint',         // Triangle glyph △
  INTERSECTION: 'intersection', // Cross glyph ✕
  CENTER: 'center',             // Circle glyph ⊙
  PERPENDICULAR: 'perpendicular',// Right-angle glyph ⦜
  NEAREST: 'nearest'            // Nearest on entity
};

/**
 * Finds the closest snap target among all committed entities.
 * Prioritizes wall vertices and endpoints.
 */
export function findSnapTarget(cursorMm, entities, activePointMm = null, options = {}) {
  const {
    zoom = 0.08,
    snapRadiusScreen = 24, // Generous magnetic snap zone
    modes = {
      endpoint: true,
      midpoint: true,
      intersection: true,
      center: true,
      perpendicular: true
    }
  } = options;

  const snapRadiusMm = snapRadiusScreen / zoom;
  let closestSnap = null;
  let minDistance = snapRadiusMm;

  function checkCandidate(pt, type, label, entityId = null, priorityBonus = 0) {
    if (!pt || isNaN(pt.x) || isNaN(pt.y)) return;
    const d = dist(cursorMm, pt) - priorityBonus;
    if (d < minDistance) {
      minDistance = d;
      closestSnap = {
        point: { x: Math.round(pt.x), y: Math.round(pt.y) },
        type,
        label,
        entityId,
        distance: d
      };
    }
  }

  // Collect linear segments and circles from all entities
  const segments = [];
  const circles = [];

  entities.forEach(ent => {
    if (ent.visible === false) return;

    if (ent.type === 'wall' && ent.centerline) {
      // Wall centerline (highest priority snap)
      segments.push({ p1: ent.centerline.p1, p2: ent.centerline.p2, entityId: ent.id, isWallCenter: true });
      
      // Also include outer miter corners if available
      if (ent.miteredPolygon && ent.miteredPolygon.length === 4) {
        ent.miteredPolygon.forEach(pt => {
          if (modes.endpoint) {
            checkCandidate(pt, SNAP_TYPES.ENDPOINT, 'Wall Corner', ent.id, 10);
          }
        });
      }
    } else if (ent.type === 'line' && ent.p1 && ent.p2) {
      segments.push({ p1: ent.p1, p2: ent.p2, entityId: ent.id });
    } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
      const minX = Math.min(ent.p1.x, ent.p2.x);
      const maxX = Math.max(ent.p1.x, ent.p2.x);
      const minY = Math.min(ent.p1.y, ent.p2.y);
      const maxY = Math.max(ent.p1.y, ent.p2.y);
      segments.push(
        { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY }, entityId: ent.id },
        { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY }, entityId: ent.id },
        { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY }, entityId: ent.id },
        { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY }, entityId: ent.id }
      );
    } else if (ent.type === 'circle' && ent.center && ent.radius) {
      circles.push({ center: ent.center, radius: ent.radius, entityId: ent.id });
    } else if (ent.type === 'door' && ent.hingePt && ent.strikePt) {
      segments.push({ p1: ent.hingePt, p2: ent.strikePt, entityId: ent.id });
    } else if (ent.type === 'window' && ent.startPt && ent.endPt) {
      segments.push({ p1: ent.startPt, p2: ent.endPt, entityId: ent.id });
    }
  });

  // Check Endpoints and Midpoints
  segments.forEach(seg => {
    if (modes.endpoint) {
      const bonus = seg.isWallCenter ? 30 : 0;
      checkCandidate(seg.p1, SNAP_TYPES.ENDPOINT, seg.isWallCenter ? 'Wall Endpoint' : 'Endpoint', seg.entityId, bonus);
      checkCandidate(seg.p2, SNAP_TYPES.ENDPOINT, seg.isWallCenter ? 'Wall Endpoint' : 'Endpoint', seg.entityId, bonus);
    }
    if (modes.midpoint) {
      const mid = {
        x: (seg.p1.x + seg.p2.x) / 2,
        y: (seg.p1.y + seg.p2.y) / 2
      };
      checkCandidate(mid, SNAP_TYPES.MIDPOINT, seg.isWallCenter ? 'Wall Midpoint' : 'Midpoint', seg.entityId);
    }
    if (modes.perpendicular && activePointMm) {
      const proj = projectPointOntoSegment(activePointMm, seg.p1, seg.p2);
      if (proj.t > 0.05 && proj.t < 0.95) {
        checkCandidate(proj.point, SNAP_TYPES.PERPENDICULAR, 'Perpendicular', seg.entityId);
      }
    }
  });

  // Check Circles
  if (modes.center) {
    circles.forEach(c => {
      checkCandidate(c.center, SNAP_TYPES.CENTER, 'Center', c.entityId);
    });
  }

  // Check Intersections
  if (modes.intersection) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i];
        const s2 = segments[j];
        const inter = getLineIntersection(s1.p1, s1.p2, s2.p1, s2.p2, false);
        if (inter) {
          checkCandidate(inter, SNAP_TYPES.INTERSECTION, 'Intersection', null, 20);
        }
      }
    }
  }

  return closestSnap;
}

export function applyOrthoConstraint(anchor, cursor) {
  if (!anchor) return cursor;
  const dx = Math.abs(cursor.x - anchor.x);
  const dy = Math.abs(cursor.y - anchor.y);

  if (dx >= dy) {
    return { x: cursor.x, y: anchor.y };
  } else {
    return { x: anchor.x, y: cursor.y };
  }
}

export function applyPolarConstraint(anchor, cursor, stepDeg = 45, toleranceDeg = 5) {
  if (!anchor) return { point: cursor, snapped: false, angle: 0 };
  const d = dist(anchor, cursor);
  if (d < 10) return { point: cursor, snapped: false, angle: 0 };

  const rawRad = Math.atan2(cursor.y - anchor.y, cursor.x - anchor.x);
  let rawDeg = (rawRad * 180) / Math.PI;
  if (rawDeg < 0) rawDeg += 360;

  const nearestStep = Math.round(rawDeg / stepDeg) * stepDeg;
  const diff = Math.abs(rawDeg - nearestStep);

  if (diff <= toleranceDeg || Math.abs(diff - 360) <= toleranceDeg) {
    const finalDeg = (nearestStep % 360 + 360) % 360;
    return {
      point: pointFromPolar(anchor, d, finalDeg),
      snapped: true,
      angle: finalDeg
    };
  }

  return { point: cursor, snapped: false, angle: Math.round(rawDeg) };
}

export function snapToGrid(point, gridSizeMm = 100) {
  return {
    x: Math.round(point.x / gridSizeMm) * gridSizeMm,
    y: Math.round(point.y / gridSizeMm) * gridSizeMm
  };
}
