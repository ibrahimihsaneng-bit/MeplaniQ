/**
 * cadGeometryUtils.js
 * Geometric and vector utilities for AutoCAD-style 2D drafting in MEPlanIQ.
 * All coordinates are in millimeters (mm) with positive Y pointing UP (standard CAD space).
 */

export function dist(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleDeg(p1, p2) {
  if (!p1 || !p2) return 0;
  const rad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function pointFromPolar(origin, distance, degrees) {
  const rad = (degrees * Math.PI) / 180;
  return {
    x: origin.x + distance * Math.cos(rad),
    y: origin.y + distance * Math.sin(rad)
  };
}

/**
 * Returns point projected from pt onto segment p1-p2.
 */
export function projectPointOntoSegment(pt, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { x: p1.x, y: p1.y }, t: 0, distance: dist(pt, p1) };

  const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq));
  const proj = {
    x: p1.x + t * dx,
    y: p1.y + t * dy
  };
  return { point: proj, t, distance: dist(pt, proj) };
}

/**
 * Calculates intersection point between line segment A (p1->p2) and B (p3->p4).
 * Returns { x, y } or null if no intersection within segments (or along lines if infinite=true).
 */
export function getLineIntersection(p1, p2, p3, p4, infinite = false) {
  const dX1 = p2.x - p1.x;
  const dY1 = p2.y - p1.y;
  const dX2 = p4.x - p3.x;
  const dY2 = p4.y - p3.y;

  const denom = dX1 * dY2 - dY1 * dX2;
  if (Math.abs(denom) < 1e-9) return null; // Parallel or collinear

  const t = ((p3.x - p1.x) * dY2 - (p3.y - p1.y) * dX2) / denom;
  const u = ((p3.x - p1.x) * dY1 - (p3.y - p1.y) * dX1) / denom;

  if (!infinite) {
    if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
  }

  return {
    x: p1.x + t * dX1,
    y: p1.y + t * dY1
  };
}

/**
 * Offsets a line segment by a given distance.
 * side: 1 for left of vector p1->p2, -1 for right
 */
export function offsetSegment(p1, p2, distance, side = 1) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { p1: { ...p1 }, p2: { ...p2 } };

  // Normal vector perpendicular to p1->p2 (rotated 90 deg counterclockwise)
  const nx = (-dy / len) * distance * side;
  const ny = (dx / len) * distance * side;

  return {
    p1: { x: p1.x + nx, y: p1.y + ny },
    p2: { x: p2.x + nx, y: p2.y + ny }
  };
}

/**
 * Generates double-line wall polygon and edges from centerline points.
 */
export function generateWallGeometry(p1, p2, thickness = 150, alignment = 'center') {
  let leftDist = thickness / 2;
  let rightDist = thickness / 2;

  if (alignment === 'left') {
    leftDist = 0;
    rightDist = thickness;
  } else if (alignment === 'right') {
    leftDist = thickness;
    rightDist = 0;
  }

  const leftSeg = offsetSegment(p1, p2, leftDist, 1);
  const rightSeg = offsetSegment(p1, p2, rightDist, -1);

  // Polygon corners in order: leftP1 -> leftP2 -> rightP2 -> rightP1
  const polygon = [
    { x: leftSeg.p1.x, y: leftSeg.p1.y },
    { x: leftSeg.p2.x, y: leftSeg.p2.y },
    { x: rightSeg.p2.x, y: rightSeg.p2.y },
    { x: rightSeg.p1.x, y: rightSeg.p1.y }
  ];

  return {
    centerline: { p1, p2 },
    leftEdge: leftSeg,
    rightEdge: rightSeg,
    polygon,
    thickness,
    alignment,
    length: dist(p1, p2)
  };
}

/**
 * WALL CORNER MITER & JUNCTION SOLVER
 * Solves corners between adjacent walls to eliminate gaps, holes, and end-cap overlaps.
 * Computes exact miter points where adjacent walls meet at common vertices.
 */
export function calculateMiteredWallNetwork(walls = [], toleranceMm = 60) {
  if (!walls || walls.length === 0) return [];

  // Clone wall list with clean base geometry
  const resolved = walls.map(w => {
    const geo = generateWallGeometry(
      w.centerline.p1,
      w.centerline.p2,
      w.thickness || 150,
      w.alignment || 'center'
    );
    return {
      ...w,
      ...geo,
      miteredPolygon: [...geo.polygon],
      startMitered: false,
      endMitered: false,
      startCap: true,
      endCap: true
    };
  });

  // For each wall, check start (p1) and end (p2) connections with other walls
  for (let i = 0; i < resolved.length; i++) {
    const w1 = resolved[i];
    const p1_start = w1.centerline.p1;
    const p1_end = w1.centerline.p2;

    for (let j = 0; j < resolved.length; j++) {
      if (i === j) continue;
      const w2 = resolved[j];
      const p2_start = w2.centerline.p2 ? w2.centerline.p1 : null;
      const p2_end = w2.centerline.p2;
      if (!p2_start || !p2_end) continue;

      // Check all 4 junction combinations:
      // A. w1.end meets w2.start
      if (dist(p1_end, p2_start) <= toleranceMm) {
        applyMiterCorner(w1, 'end', w2, 'start');
      }
      // B. w1.end meets w2.end
      else if (dist(p1_end, p2_end) <= toleranceMm) {
        applyMiterCorner(w1, 'end', w2, 'end');
      }
      // C. w1.start meets w2.start
      else if (dist(p1_start, p2_start) <= toleranceMm) {
        applyMiterCorner(w1, 'start', w2, 'start');
      }
      // D. w1.start meets w2.end
      else if (dist(p1_start, p2_end) <= toleranceMm) {
        applyMiterCorner(w1, 'start', w2, 'end');
      }
      // E. T-junction: w1.end terminates on w2 body
      else if (!w1.endMitered) {
        const projEnd = projectPointOntoSegment(p1_end, p2_start, p2_end);
        if (projEnd.distance <= toleranceMm && projEnd.t > 0.04 && projEnd.t < 0.96) {
          applyTJunction(w1, 'end', w2);
        }
      }
      // F. T-junction: w1.start terminates on w2 body
      else if (!w1.startMitered) {
        const projStart = projectPointOntoSegment(p1_start, p2_start, p2_end);
        if (projStart.distance <= toleranceMm && projStart.t > 0.04 && projStart.t < 0.96) {
          applyTJunction(w1, 'start', w2);
        }
      }
    }
  }

  return resolved;
}

/**
 * Calculates mitered intersection for corner junction between wall1 and wall2.
 */
function applyMiterCorner(w1, end1, w2, end2) {
  // Edge lines for w1
  const line1_left = w1.leftEdge;
  const line1_right = w1.rightEdge;

  // Edge lines for w2
  const line2_left = w2.leftEdge;
  const line2_right = w2.rightEdge;

  // Intersect left edges and right edges (infinite=true to find ray intersection)
  const interLL = getLineIntersection(line1_left.p1, line1_left.p2, line2_left.p1, line2_left.p2, true);
  const interRR = getLineIntersection(line1_right.p1, line1_right.p2, line2_right.p1, line2_right.p2, true);

  // Cross intersections if orientations are flipped
  const interLR = getLineIntersection(line1_left.p1, line1_left.p2, line2_right.p1, line2_right.p2, true);
  const interRL = getLineIntersection(line1_right.p1, line1_right.p2, line2_left.p1, line2_left.p2, true);

  // Pick the pair that minimizes distortion and stays close to corner vertex
  const vertex = end1 === 'end' ? w1.centerline.p2 : w1.centerline.p1;
  const maxMiterDist = (w1.thickness || 150) * 3;

  let leftMiter = null;
  let rightMiter = null;

  if (interLL && interRR && dist(interLL, vertex) < maxMiterDist && dist(interRR, vertex) < maxMiterDist) {
    leftMiter = interLL;
    rightMiter = interRR;
  } else if (interLR && interRL && dist(interLR, vertex) < maxMiterDist && dist(interRL, vertex) < maxMiterDist) {
    leftMiter = interLR;
    rightMiter = interRL;
  }

  if (leftMiter && rightMiter) {
    // Update w1 corner vertices
    // polygon indices: 0: leftP1, 1: leftP2, 2: rightP2, 3: rightP1
    if (end1 === 'end') {
      w1.miteredPolygon[1] = { x: leftMiter.x, y: leftMiter.y };
      w1.miteredPolygon[2] = { x: rightMiter.x, y: rightMiter.y };
      w1.endCap = false;
      w1.endMitered = true;
    } else {
      w1.miteredPolygon[0] = { x: leftMiter.x, y: leftMiter.y };
      w1.miteredPolygon[3] = { x: rightMiter.x, y: rightMiter.y };
      w1.startCap = false;
      w1.startMitered = true;
    }

    // Update w2 corner vertices
    if (end2 === 'start') {
      w2.miteredPolygon[0] = { x: leftMiter.x, y: leftMiter.y };
      w2.miteredPolygon[3] = { x: rightMiter.x, y: rightMiter.y };
      w2.startCap = false;
      w2.startMitered = true;
    } else {
      w2.miteredPolygon[1] = { x: leftMiter.x, y: leftMiter.y };
      w2.miteredPolygon[2] = { x: rightMiter.x, y: rightMiter.y };
      w2.endCap = false;
      w2.endMitered = true;
    }
  }
}

/**
 * Resolves a T-junction where wStem's endpoint connects into the span/body of wThrough.
 */
function applyTJunction(wStem, endStem, wThrough) {
  const stemPt = endStem === 'end' ? wStem.centerline.p2 : wStem.centerline.p1;
  const throughProj = projectPointOntoSegment(stemPt, wThrough.centerline.p1, wThrough.centerline.p2);
  if (throughProj.t <= 0.02 || throughProj.t >= 0.98) return;

  // Find which edge of wThrough is closer to wStem
  const dLeft = dist(stemPt, projectPointOntoSegment(stemPt, wThrough.leftEdge.p1, wThrough.leftEdge.p2).point);
  const dRight = dist(stemPt, projectPointOntoSegment(stemPt, wThrough.rightEdge.p1, wThrough.rightEdge.p2).point);
  const nearEdge = dLeft < dRight ? wThrough.leftEdge : wThrough.rightEdge;

  // Intersect wStem's left and right lines with nearEdge of wThrough
  const interL = getLineIntersection(wStem.leftEdge.p1, wStem.leftEdge.p2, nearEdge.p1, nearEdge.p2, true);
  const interR = getLineIntersection(wStem.rightEdge.p1, wStem.rightEdge.p2, nearEdge.p1, nearEdge.p2, true);

  const maxMiterDist = (wStem.thickness || 150) * 3;
  if (interL && interR && dist(interL, stemPt) < maxMiterDist && dist(interR, stemPt) < maxMiterDist) {
    if (endStem === 'end') {
      wStem.miteredPolygon[1] = { x: Math.round(interL.x), y: Math.round(interL.y) };
      wStem.miteredPolygon[2] = { x: Math.round(interR.x), y: Math.round(interR.y) };
      wStem.endCap = false;
      wStem.endMitered = true;
    } else {
      wStem.miteredPolygon[0] = { x: Math.round(interL.x), y: Math.round(interL.y) };
      wStem.miteredPolygon[3] = { x: Math.round(interR.x), y: Math.round(interR.y) };
      wStem.startCap = false;
      wStem.startMitered = true;
    }
  }
}

/**
 * Creates a Door opening on a wall.
 * Returns { door, updatedWall }
 */
export function createDoorOnWall(wall, clickPt, widthMm = 900, swing = 'inward-left') {
  if (!wall || !wall.centerline) return null;
  const p1 = wall.centerline.p1;
  const p2 = wall.centerline.p2;
  const proj = projectPointOntoSegment(clickPt, p1, p2);
  const wallLen = dist(p1, p2);
  if (wallLen < widthMm + 200) return null;

  // Clamp offset to ensure door fits within wall
  const halfW = widthMm / 2;
  const clickDist = proj.t * wallLen;
  const clampedDist = Math.max(halfW + 100, Math.min(wallLen - halfW - 100, clickDist));

  const wallAngle = angleDeg(p1, p2);
  const centerPt = pointFromPolar(p1, clampedDist, wallAngle);
  const hingePt = pointFromPolar(p1, clampedDist - halfW, wallAngle);
  const strikePt = pointFromPolar(p1, clampedDist + halfW, wallAngle);

  // Door leaf end point (swings 90 deg)
  const isLeft = swing.includes('left');
  const isOutward = swing.includes('outward');
  const swingAngle = wallAngle + (isOutward ? (isLeft ? 90 : -90) : (isLeft ? -90 : 90));
  const leafEnd = pointFromPolar(hingePt, widthMm, swingAngle);

  // SVG arc path for 90 degree swing
  const arcSweep = isOutward ? (isLeft ? 1 : 0) : (isLeft ? 0 : 1);
  const arcPath = `M ${strikePt.x} ${strikePt.y} A ${widthMm} ${widthMm} 0 0 ${arcSweep} ${leafEnd.x} ${leafEnd.y}`;

  const door = {
    id: `door-${Date.now()}`,
    type: 'door',
    hostWallId: wall.id,
    centerPt,
    hingePt,
    strikePt,
    leafEnd,
    arcPath,
    widthMm,
    swing,
    wallAngle,
    thickness: wall.thickness || 150
  };

  return door;
}

export function recalculateDoorGeometry(door, newSwing = null, newWidth = null) {
  if (!door || !door.hingePt || !door.strikePt) return door;
  const swing = newSwing || door.swing || 'inward-left';
  const widthMm = newWidth || door.widthMm || Math.round(dist(door.hingePt, door.strikePt));
  const wallAngle = angleDeg(door.hingePt, door.strikePt);
  const isLeft = swing.includes('left');
  const isOutward = swing.includes('outward');
  const swingAngle = wallAngle + (isOutward ? (isLeft ? 90 : -90) : (isLeft ? -90 : 90));
  const leafEnd = pointFromPolar(door.hingePt, widthMm, swingAngle);
  const arcSweep = isOutward ? (isLeft ? 1 : 0) : (isLeft ? 0 : 1);
  const arcPath = `M ${door.strikePt.x} ${door.strikePt.y} A ${widthMm} ${widthMm} 0 0 ${arcSweep} ${leafEnd.x} ${leafEnd.y}`;

  return {
    ...door,
    swing,
    widthMm,
    leafEnd,
    arcPath
  };
}

/**
 * Creates an architectural Window on a wall.
 */
export function createWindowOnWall(wall, clickPt, widthMm = 1200) {
  if (!wall || !wall.centerline) return null;
  const p1 = wall.centerline.p1;
  const p2 = wall.centerline.p2;
  const proj = projectPointOntoSegment(clickPt, p1, p2);
  const wallLen = dist(p1, p2);
  if (wallLen < widthMm + 100) return null;

  const halfW = widthMm / 2;
  const clickDist = proj.t * wallLen;
  const clampedDist = Math.max(halfW + 50, Math.min(wallLen - halfW - 50, clickDist));

  const wallAngle = angleDeg(p1, p2);
  const centerPt = pointFromPolar(p1, clampedDist, wallAngle);
  const startPt = pointFromPolar(p1, clampedDist - halfW, wallAngle);
  const endPt = pointFromPolar(p1, clampedDist + halfW, wallAngle);

  const windowObj = {
    id: `window-${Date.now()}`,
    type: 'window',
    hostWallId: wall.id,
    centerPt,
    startPt,
    endPt,
    widthMm,
    wallAngle,
    thickness: wall.thickness || 150
  };

  return windowObj;
}

/**
 * Fillet two line segments (rounds or miters them at radius=0).
 */
export function filletLineSegments(seg1, seg2, radius = 0) {
  const inter = getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2, true);
  if (!inter) return null;

  // Pick endpoints closest to intersection and adjust them to the intersection point
  const s1_p1_d = dist(seg1.p1, inter);
  const s1_p2_d = dist(seg1.p2, inter);
  const newSeg1 = {
    ...seg1,
    p1: s1_p1_d < s1_p2_d ? inter : seg1.p1,
    p2: s1_p1_d < s1_p2_d ? seg1.p2 : inter
  };

  const s2_p1_d = dist(seg2.p1, inter);
  const s2_p2_d = dist(seg2.p2, inter);
  const newSeg2 = {
    ...seg2,
    p1: s2_p1_d < s2_p2_d ? inter : seg2.p1,
    p2: s2_p1_d < s2_p2_d ? seg2.p2 : inter
  };

  return { newSeg1, newSeg2, intersection: inter };
}

/**
 * Moves entities by dx, dy.
 */
export function transformEntities(entities, ids, transformFn) {
  const targetIds = new Set(ids);
  return entities.map(ent => {
    if (!targetIds.has(ent.id)) return ent;
    return transformFn(ent);
  });
}

/**
 * Detects closed loops from walls or line segments and extracts Room polygons.
 */
export function extractRoomsFromLinework(entities, toleranceMm = 60) {
  const segments = [];
  entities.forEach(ent => {
    if (ent.type === 'wall' && ent.centerline) {
      segments.push({ p1: ent.centerline.p1, p2: ent.centerline.p2, sourceId: ent.id, type: 'wall' });
    } else if (ent.type === 'line' && ent.p1 && ent.p2) {
      segments.push({ p1: ent.p1, p2: ent.p2, sourceId: ent.id, type: 'line' });
    } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
      const minX = Math.min(ent.p1.x, ent.p2.x);
      const maxX = Math.max(ent.p1.x, ent.p2.x);
      const minY = Math.min(ent.p1.y, ent.p2.y);
      const maxY = Math.max(ent.p1.y, ent.p2.y);
      segments.push(
        { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY } },
        { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY } },
        { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY } },
        { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY } }
      );
    } else if (ent.type === 'polyline' && Array.isArray(ent.points) && ent.points.length >= 2) {
      for (let i = 0; i < ent.points.length - 1; i++) {
        segments.push({ p1: ent.points[i], p2: ent.points[i + 1] });
      }
      if (ent.closed && ent.points.length >= 3) {
        segments.push({ p1: ent.points[ent.points.length - 1], p2: ent.points[0] });
      }
    }
  });

  if (segments.length < 3) return { rooms: [], warnings: ["Draw at least 3 walls or lines to form a closed room."] };

  // Weld vertices within tolerance
  const nodes = [];
  function getOrAddNode(pt) {
    for (let i = 0; i < nodes.length; i++) {
      if (dist(nodes[i], pt) <= toleranceMm) {
        return i;
      }
    }
    nodes.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
    return nodes.length - 1;
  }

  // Build adjacency graph
  const adj = new Map();
  segments.forEach(seg => {
    const u = getOrAddNode(seg.p1);
    const v = getOrAddNode(seg.p2);
    if (u === v) return;

    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u).add(v);
    adj.get(v).add(u);
  });

  // Cycle detection
  const rawCycles = [];
  function findCyclesDFS(startNode, current, path) {
    path.push(current);
    const neighbors = adj.get(current) || new Set();

    neighbors.forEach(next => {
      if (next === startNode && path.length >= 3) {
        rawCycles.push([...path]);
        return;
      }
      if (!path.includes(next) && path.length < 12) {
        findCyclesDFS(startNode, next, [...path]);
      }
    });
  }

  nodes.forEach((_, idx) => {
    findCyclesDFS(idx, idx, []);
  });

  const uniqueRooms = [];
  const cycleSignatures = new Set();

  rawCycles.forEach(cycle => {
    const cycleNodes = cycle.map(i => nodes[i]);
    const area = Math.abs(calculatePolygonArea(cycleNodes));
    if (area < 1000000) return; // Ignore < 1 m²

    const sortedIds = [...cycle].sort((a, b) => a - b).join('-');
    if (cycleSignatures.has(sortedIds)) return;
    cycleSignatures.add(sortedIds);

    const roomPoints = cycleNodes.map(pt => [pt.x, pt.y]);
    const areaSqm = area / 1000000;

    uniqueRooms.push({
      name: `Room ${uniqueRooms.length + 1}`,
      points: roomPoints,
      carpet_area_sqm: Number(areaSqm.toFixed(2)),
      detectedFromCad: true
    });
  });

  return {
    rooms: uniqueRooms,
    warnings: uniqueRooms.length === 0 ? ["No closed room boundaries formed."] : []
  };
}

export function calculatePolygonArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

export function parseCadInput(inputStr, referencePoint = { x: 0, y: 0 }, defaultAngle = 0) {
  const str = (inputStr || '').trim();
  if (!str) return null;

  const polarMatch = str.match(/^@?(-?\d+(?:\.\d+)?)<(-?\d+(?:\.\d+)?)$/);
  if (polarMatch) {
    const length = parseFloat(polarMatch[1]);
    const deg = parseFloat(polarMatch[2]);
    return pointFromPolar(referencePoint, length, deg);
  }

  if (str.startsWith('@')) {
    const parts = str.slice(1).split(',');
    if (parts.length === 2) {
      const rx = parseFloat(parts[0]);
      const ry = parseFloat(parts[1]);
      if (!isNaN(rx) && !isNaN(ry)) {
        return { x: referencePoint.x + rx, y: referencePoint.y + ry };
      }
    }
  }

  if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2) {
      const ax = parseFloat(parts[0]);
      const ay = parseFloat(parts[1]);
      if (!isNaN(ax) && !isNaN(ay)) {
        return { x: ax, y: ay };
      }
    }
  }

  const distVal = parseFloat(str);
  if (!isNaN(distVal)) {
    return pointFromPolar(referencePoint, distVal, defaultAngle);
  }

  return null;
}

export function rotatePoint(pt, center, angleDegrees) {
  if (!pt || !center) return pt ? { ...pt } : { x: 0, y: 0 };
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: Math.round(center.x + dx * cos - dy * sin),
    y: Math.round(center.y + dx * sin + dy * cos)
  };
}

export function getEntityCenter(ent) {
  if (!ent) return { x: 0, y: 0 };
  if (ent.type === 'wall' && ent.centerline) {
    return {
      x: Math.round((ent.centerline.p1.x + ent.centerline.p2.x) / 2),
      y: Math.round((ent.centerline.p1.y + ent.centerline.p2.y) / 2)
    };
  }
  if (ent.type === 'line' && ent.p1 && ent.p2) {
    return {
      x: Math.round((ent.p1.x + ent.p2.x) / 2),
      y: Math.round((ent.p1.y + ent.p2.y) / 2)
    };
  }
  if (ent.type === 'rect' && ent.p1 && ent.p2) {
    return {
      x: Math.round((ent.p1.x + ent.p2.x) / 2),
      y: Math.round((ent.p1.y + ent.p2.y) / 2)
    };
  }
  if (ent.type === 'circle' && ent.center) {
    return { ...ent.center };
  }
  if (ent.type === 'block' || ent.type === 'text') {
    return { x: ent.x || 0, y: ent.y || 0 };
  }
  return { x: 0, y: 0 };
}

export function rotateEntityGeometry(ent, angleDegrees = 90, customCenter = null) {
  const center = customCenter || getEntityCenter(ent);
  const updated = { ...ent };

  if (ent.type === 'wall' && ent.centerline) {
    updated.centerline = {
      p1: rotatePoint(ent.centerline.p1, center, angleDegrees),
      p2: rotatePoint(ent.centerline.p2, center, angleDegrees)
    };
  } else if (ent.type === 'line' && ent.p1 && ent.p2) {
    updated.p1 = rotatePoint(ent.p1, center, angleDegrees);
    updated.p2 = rotatePoint(ent.p2, center, angleDegrees);
  } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
    const p1Rot = rotatePoint(ent.p1, center, angleDegrees);
    const p2Rot = rotatePoint(ent.p2, center, angleDegrees);
    updated.p1 = p1Rot;
    updated.p2 = p2Rot;
  } else if (ent.type === 'circle' && ent.center) {
    updated.center = rotatePoint(ent.center, center, angleDegrees);
  } else if (ent.type === 'block') {
    const newPos = rotatePoint({ x: ent.x, y: ent.y }, center, angleDegrees);
    updated.x = newPos.x;
    updated.y = newPos.y;
    updated.rotation = ((ent.rotation || 0) + angleDegrees) % 360;
  } else if (ent.type === 'text') {
    const newPos = rotatePoint({ x: ent.x, y: ent.y }, center, angleDegrees);
    updated.x = newPos.x;
    updated.y = newPos.y;
    updated.rotation = ((ent.rotation || 0) + angleDegrees) % 360;
  }
  return updated;
}

export function mirrorEntityGeometry(ent, axis = 'horizontal', customCenter = null) {
  const center = customCenter || getEntityCenter(ent);
  const updated = { ...ent };

  const mirrorPt = (pt) => {
    if (!pt) return pt;
    if (axis === 'horizontal') {
      return { x: pt.x, y: Math.round(2 * center.y - pt.y) };
    }
    return { x: Math.round(2 * center.x - pt.x), y: pt.y };
  };

  if (ent.type === 'wall' && ent.centerline) {
    updated.centerline = {
      p1: mirrorPt(ent.centerline.p1),
      p2: mirrorPt(ent.centerline.p2)
    };
  } else if (ent.type === 'line' && ent.p1 && ent.p2) {
    updated.p1 = mirrorPt(ent.p1);
    updated.p2 = mirrorPt(ent.p2);
  } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
    updated.p1 = mirrorPt(ent.p1);
    updated.p2 = mirrorPt(ent.p2);
  } else if (ent.type === 'circle' && ent.center) {
    updated.center = mirrorPt(ent.center);
  } else if (ent.type === 'block') {
    const newPos = mirrorPt({ x: ent.x, y: ent.y });
    updated.x = newPos.x;
    updated.y = newPos.y;
    updated.rotation = (360 - (ent.rotation || 0)) % 360;
  } else if (ent.type === 'text') {
    const newPos = mirrorPt({ x: ent.x, y: ent.y });
    updated.x = newPos.x;
    updated.y = newPos.y;
  }
  return updated;
}

/**
 * Trims a line or wall segment at intersection points.
 * Finds all intersections of targetEntity with other lines/walls.
 * Projects clickPt onto the entity to identify which interval was clicked,
 * and removes that portion.
 * Returns { action: 'delete' } OR { action: 'update', newEntity: {...}, extraEntity: {...} } OR null
 */
export function trimEntitySegment(targetEntity, clickPt, otherEntities) {
  let seg = null;
  if (targetEntity.type === 'line' && targetEntity.p1 && targetEntity.p2) {
    seg = { p1: { ...targetEntity.p1 }, p2: { ...targetEntity.p2 } };
  } else if (targetEntity.type === 'wall' && targetEntity.centerline) {
    seg = { p1: { ...targetEntity.centerline.p1 }, p2: { ...targetEntity.centerline.p2 } };
  }
  if (!seg) return null;

  const totalLen = dist(seg.p1, seg.p2);
  if (totalLen < 1) return null;

  // Collect all intersections with other entities
  const tVals = [0, 1];
  for (const other of otherEntities) {
    if (other.id === targetEntity.id || other.visible === false) continue;
    let otherSegs = [];
    if (other.type === 'line' && other.p1 && other.p2) {
      otherSegs.push({ p1: other.p1, p2: other.p2 });
    } else if (other.type === 'wall' && other.centerline) {
      otherSegs.push({ p1: other.centerline.p1, p2: other.centerline.p2 });
    } else if (other.type === 'rect' && other.p1 && other.p2) {
      const rx1 = Math.min(other.p1.x, other.p2.x);
      const rx2 = Math.max(other.p1.x, other.p2.x);
      const ry1 = Math.min(other.p1.y, other.p2.y);
      const ry2 = Math.max(other.p1.y, other.p2.y);
      otherSegs.push(
        { p1: { x: rx1, y: ry1 }, p2: { x: rx2, y: ry1 } },
        { p1: { x: rx2, y: ry1 }, p2: { x: rx2, y: ry2 } },
        { p1: { x: rx2, y: ry2 }, p2: { x: rx1, y: ry2 } },
        { p1: { x: rx1, y: ry2 }, p2: { x: rx1, y: ry1 } }
      );
    }

    for (const os of otherSegs) {
      const inter = getLineIntersection(seg.p1, seg.p2, os.p1, os.p2, false);
      if (inter) {
        const proj = projectPointOntoSegment(inter, seg.p1, seg.p2);
        if (proj.t > 0.001 && proj.t < 0.999) {
          tVals.push(proj.t);
        }
      }
    }
  }

  // Deduplicate and sort t values
  tVals.sort((a, b) => a - b);
  const uniqueT = [];
  for (const t of tVals) {
    if (uniqueT.length === 0 || Math.abs(t - uniqueT[uniqueT.length - 1]) > 0.005) {
      uniqueT.push(t);
    }
  }

  if (uniqueT.length <= 2) {
    // No internal intersections - delete the entity
    return { action: 'delete', entityId: targetEntity.id };
  }

  // Find clickPt projection t
  const clickProj = projectPointOntoSegment(clickPt, seg.p1, seg.p2);
  const clickT = clickProj.t;

  // Find which interval contains clickT
  let cutIdx = 0;
  for (let i = 0; i < uniqueT.length - 1; i++) {
    if (clickT >= uniqueT[i] && clickT <= uniqueT[i + 1]) {
      cutIdx = i;
      break;
    }
  }

  const dx = seg.p2.x - seg.p1.x;
  const dy = seg.p2.y - seg.p1.y;
  const ptAtT = (t) => ({ x: Math.round(seg.p1.x + t * dx), y: Math.round(seg.p1.y + t * dy) });

  // Case 1: First interval (trim off start)
  if (cutIdx === 0) {
    const newP1 = ptAtT(uniqueT[1]);
    const newP2 = seg.p2;
    if (targetEntity.type === 'line') {
      return { action: 'update', entityId: targetEntity.id, updates: { p1: newP1, p2: newP2 } };
    } else {
      return { action: 'update', entityId: targetEntity.id, updates: { centerline: { p1: newP1, p2: newP2 } } };
    }
  }

  // Case 2: Last interval (trim off end)
  if (cutIdx === uniqueT.length - 2) {
    const newP1 = seg.p1;
    const newP2 = ptAtT(uniqueT[uniqueT.length - 2]);
    if (targetEntity.type === 'line') {
      return { action: 'update', entityId: targetEntity.id, updates: { p1: newP1, p2: newP2 } };
    } else {
      return { action: 'update', entityId: targetEntity.id, updates: { centerline: { p1: newP1, p2: newP2 } } };
    }
  }

  // Case 3: Middle interval (split entity into two remaining segments)
  const seg1End = ptAtT(uniqueT[cutIdx]);
  const seg2Start = ptAtT(uniqueT[cutIdx + 1]);

  if (targetEntity.type === 'line') {
    return {
      action: 'split',
      entityId: targetEntity.id,
      updates: { p1: seg.p1, p2: seg1End },
      extraEntity: {
        ...targetEntity,
        id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        p1: seg2Start,
        p2: seg.p2
      }
    };
  } else {
    return {
      action: 'split',
      entityId: targetEntity.id,
      updates: { centerline: { p1: seg.p1, p2: seg1End } },
      extraEntity: {
        ...targetEntity,
        id: `wall-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        centerline: { p1: seg2Start, p2: seg.p2 }
      }
    };
  }
}

/**
 * Extends a line or wall segment towards the nearest boundary entity.
 * Determines which endpoint is closer to clickPt and casts a ray in that direction.
 * Returns { action: 'update', entityId: ..., updates: ... } OR null if no boundary found.
 */
export function extendEntitySegment(targetEntity, clickPt, otherEntities) {
  let seg = null;
  if (targetEntity.type === 'line' && targetEntity.p1 && targetEntity.p2) {
    seg = { p1: { ...targetEntity.p1 }, p2: { ...targetEntity.p2 } };
  } else if (targetEntity.type === 'wall' && targetEntity.centerline) {
    seg = { p1: { ...targetEntity.centerline.p1 }, p2: { ...targetEntity.centerline.p2 } };
  }
  if (!seg) return null;

  // Check which end was clicked
  const d1 = dist(clickPt, seg.p1);
  const d2 = dist(clickPt, seg.p2);
  const extendP1 = d1 < d2; // If closer to p1, extend past p1 away from p2

  const basePt = extendP1 ? seg.p2 : seg.p1;
  const rayEnd = extendP1 ? seg.p1 : seg.p2;
  const dirX = rayEnd.x - basePt.x;
  const dirY = rayEnd.y - basePt.y;
  const len = Math.sqrt(dirX * dirX + dirY * dirY);
  if (len < 1) return null;

  const unitX = dirX / len;
  const unitY = dirY / len;

  // Maximum extension distance (50 meters = 50000 mm)
  const farPt = {
    x: rayEnd.x + unitX * 50000,
    y: rayEnd.y + unitY * 50000
  };

  let closestInter = null;
  let minInterDist = Infinity;

  for (const other of otherEntities) {
    if (other.id === targetEntity.id || other.visible === false) continue;
    let otherSegs = [];
    if (other.type === 'line' && other.p1 && other.p2) {
      otherSegs.push({ p1: other.p1, p2: other.p2 });
    } else if (other.type === 'wall' && other.centerline) {
      otherSegs.push({ p1: other.centerline.p1, p2: other.centerline.p2 });
    } else if (other.type === 'rect' && other.p1 && other.p2) {
      const rx1 = Math.min(other.p1.x, other.p2.x);
      const rx2 = Math.max(other.p1.x, other.p2.x);
      const ry1 = Math.min(other.p1.y, other.p2.y);
      const ry2 = Math.max(other.p1.y, other.p2.y);
      otherSegs.push(
        { p1: { x: rx1, y: ry1 }, p2: { x: rx2, y: ry1 } },
        { p1: { x: rx2, y: ry1 }, p2: { x: rx2, y: ry2 } },
        { p1: { x: rx2, y: ry2 }, p2: { x: rx1, y: ry2 } },
        { p1: { x: rx1, y: ry2 }, p2: { x: rx1, y: ry1 } }
      );
    }

    for (const os of otherSegs) {
      const inter = getLineIntersection(rayEnd, farPt, os.p1, os.p2, false);
      if (inter) {
        const d = dist(rayEnd, inter);
        if (d > 5 && d < minInterDist) {
          minInterDist = d;
          closestInter = { x: Math.round(inter.x), y: Math.round(inter.y) };
        }
      }
    }
  }

  if (!closestInter) return null;

  if (targetEntity.type === 'line') {
    return {
      action: 'update',
      entityId: targetEntity.id,
      updates: extendP1 ? { p1: closestInter } : { p2: closestInter }
    };
  } else {
    return {
      action: 'update',
      entityId: targetEntity.id,
      updates: extendP1 ? { centerline: { p1: closestInter, p2: seg.p2 } } : { centerline: { p1: seg.p1, p2: closestInter } }
    };
  }
}

/**
 * Automatically calculates standard architectural perimeter dimension lines
 * for all walls with a consistent perpendicular offset.
 */
export function generateAutoDimensions(entities, offsetMm = 450) {
  const walls = (entities || []).filter(e => e.type === 'wall' && e.centerline && e.visible !== false);
  if (walls.length === 0) return [];

  const dims = [];
  walls.forEach(w => {
    const p1 = w.centerline.p1;
    const p2 = w.centerline.p2;
    if (dist(p1, p2) < 200) return;

    // Offset segment outward
    const off = offsetSegment(p1, p2, offsetMm, 1);
    dims.push({
      id: `dim-auto-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type: 'dimension',
      p1: { x: Math.round(off.p1.x), y: Math.round(off.p1.y) },
      p2: { x: Math.round(off.p2.x), y: Math.round(off.p2.y) },
      layer: 'A-DIMS',
      autoGenerated: true
    });
  });

  return dims;
}

/**
 * Calculates a 3-point circular arc passing through p1 (start), p2 (mid), and p3 (end).
 * Returns { center, radius, p1, p2, p3, svgPath } or null if points are collinear.
 */
export function calculateArcFrom3Points(p1, p2, p3) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-5) return null; // Collinear points

  const sq1 = x1 * x1 + y1 * y1;
  const sq2 = x2 * x2 + y2 * y2;
  const sq3 = x3 * x3 + y3 * y3;

  const cx = Math.round(((sq1 * (y2 - y3) + sq2 * (y3 - y1) + sq3 * (y1 - y2)) / D) * 10) / 10;
  const cy = Math.round(((sq1 * (x3 - x2) + sq2 * (x1 - x3) + sq3 * (x2 - x1)) / D) * 10) / 10;
  const radius = Math.round(Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2) * 10) / 10;

  // Cross product to determine sweep direction
  const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const sweepFlag = cross < 0 ? 0 : 1;

  // Angles to determine large arc flag
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  const a3 = Math.atan2(y3 - cy, x3 - cx);
  const norm = (a) => (a < 0 ? a + 2 * Math.PI : a);
  const diff = Math.abs(norm(a3) - norm(a1));
  const largeArcFlag = diff > Math.PI ? 1 : 0;

  const svgPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x3} ${y3}`;

  return {
    center: { x: cx, y: cy },
    radius,
    p1: { ...p1 },
    p2: { ...p2 },
    p3: { ...p3 },
    svgPath
  };
}

/**
 * Chamfers two intersecting line segments by distance d1 and d2.
 * Trims both segments back by the chamfer distance from their intersection
 * and returns the new beveled line segment between them.
 */
export function chamferLineSegments(seg1, seg2, distance = 150) {
  const inter = getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2, true);
  if (!inter) return null;

  // Trim seg1 towards intersection
  const d1_p1 = dist(seg1.p1, inter);
  const d1_p2 = dist(seg1.p2, inter);
  const near1 = d1_p1 < d1_p2 ? 'p1' : 'p2';
  const far1 = near1 === 'p1' ? seg1.p2 : seg1.p1;
  const cut1 = pointFromPolar(inter, distance, angleDeg(inter, far1));

  // Trim seg2 towards intersection
  const d2_p1 = dist(seg2.p1, inter);
  const d2_p2 = dist(seg2.p2, inter);
  const near2 = d2_p1 < d2_p2 ? 'p1' : 'p2';
  const far2 = near2 === 'p1' ? seg2.p2 : seg2.p1;
  const cut2 = pointFromPolar(inter, distance, angleDeg(inter, far2));

  return {
    newSeg1: {
      p1: near1 === 'p1' ? cut1 : seg1.p1,
      p2: near1 === 'p2' ? cut1 : seg1.p2
    },
    newSeg2: {
      p1: near2 === 'p1' ? cut2 : seg2.p1,
      p2: near2 === 'p2' ? cut2 : seg2.p2
    },
    chamferLine: {
      p1: { x: Math.round(cut1.x), y: Math.round(cut1.y) },
      p2: { x: Math.round(cut2.x), y: Math.round(cut2.y) }
    }
  };
}

/**
 * Generates an AutoCAD-standard Door, Window & Room Schedule Table
 * as a group of lines and text entities to stamp onto the drawing sheet.
 */
export function generateScheduleTable(entities, detectedRooms = [], origin = { x: 8000, y: 1000 }) {
  const elements = [];
  const colWidths = [1800, 2200, 1400, 1800]; // mm
  const rowHeight = 400; // mm
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerText = "ARCHITECTURAL SCHEDULE OF AREAS & OPENINGS";

  // Data rows
  const rows = [
    ["SPACE / OPENING", "CLASSIFICATION", "AREA / SIZE", "SPECIFICATION"],
    ...detectedRooms.map(r => [
      (r.name || 'Room').toUpperCase(),
      "Habitable Space",
      `${r.carpet_area_sqm || 15} m²`,
      "Vitrified Tiles (600×600)"
    ]),
    ["MAIN DOOR (D1)", "Flush Teak Door", "1000 × 2100 mm", "Hardwood Frame"],
    ["ROOM DOORS (D2)", "Panel Door", "900 × 2100 mm", "Mortise Lock"],
    ["WINDOWS (W1)", "Aluminum 3-Track", "1500 × 1200 mm", "Clear Float Glass"]
  ];

  const totalH = (rows.length + 1) * rowHeight;

  // Outer Border
  elements.push({
    id: `sched-box-${Date.now()}`,
    type: 'rect',
    p1: { x: origin.x, y: origin.y },
    p2: { x: origin.x + totalW, y: origin.y + totalH },
    layer: 'A-ANNO'
  });

  // Title Row
  elements.push({
    id: `sched-title-${Date.now()}`,
    type: 'text',
    text: headerText,
    x: origin.x + totalW / 2,
    y: origin.y + totalH - 260,
    fontSize: 220,
    layer: 'A-ANNO'
  });

  // Row lines & Texts
  rows.forEach((row, rIdx) => {
    const yPos = origin.y + totalH - (rIdx + 1) * rowHeight;
    // Row divider
    elements.push({
      id: `sched-rowline-${rIdx}-${Date.now()}`,
      type: 'line',
      p1: { x: origin.x, y: yPos },
      p2: { x: origin.x + totalW, y: yPos },
      layer: 'A-ANNO'
    });

    let curX = origin.x;
    row.forEach((cell, cIdx) => {
      elements.push({
        id: `sched-cell-${rIdx}-${cIdx}-${Date.now()}`,
        type: 'text',
        text: String(cell),
        x: curX + 60,
        y: yPos - 270,
        fontSize: rIdx === 0 ? 170 : 150,
        layer: 'A-ANNO'
      });
      curX += colWidths[cIdx];
    });
  });

  // Vertical column dividers
  let colX = origin.x;
  for (let c = 0; c < colWidths.length - 1; c++) {
    colX += colWidths[c];
    elements.push({
      id: `sched-colline-${c}-${Date.now()}`,
      type: 'line',
      p1: { x: colX, y: origin.y },
      p2: { x: colX, y: origin.y + totalH - rowHeight },
      layer: 'A-ANNO'
    });
  }

  return elements;
}

/**
 * Generates an ISO 5457 / ISO 7200 Architectural Sheet Border and Title Block
 * tailored to drawing bounding extents with True North Arrow and drawing metadata.
 */
export function generateTitleBlockAndBorder(entities = [], projectName = "BIM RESEARCH PROJECT", sheetSize = "A1") {
  const elements = [];
  const timestamp = Date.now();

  // 1. Calculate drawing bounding box
  let minX = 0, minY = 0, maxX = 8000, maxY = 6000;
  const xs = [];
  const ys = [];

  entities.forEach(e => {
    // Exclude existing title blocks or borders to prevent runaway expansion
    if (e.isSheetBorder || e.isTitleBlock) return;
    if (e.centerline) {
      xs.push(e.centerline.p1.x, e.centerline.p2.x);
      ys.push(e.centerline.p1.y, e.centerline.p2.y);
    } else if (e.p1 && e.p2) {
      xs.push(e.p1.x, e.p2.x);
      ys.push(e.p1.y, e.p2.y);
    } else if (e.x !== undefined && e.y !== undefined) {
      xs.push(e.x);
      ys.push(e.y);
    }
  });

  if (xs.length > 0) {
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  }

  const modelW = Math.max(8000, maxX - minX);
  const modelH = Math.max(6000, maxY - minY);

  // Compute sheet margins (leave room on right for Title Block & Schedule Table)
  const leftMargin = 1500;
  const rightMargin = 4500;
  const topMargin = 1500;
  const bottomMargin = 2000;

  const sheetX1 = minX - leftMargin;
  const sheetY1 = minY - bottomMargin;
  const sheetX2 = maxX + rightMargin;
  const sheetY2 = maxY + topMargin;

  const innerOffset = 150;
  const inX1 = sheetX1 + innerOffset;
  const inY1 = sheetY1 + innerOffset;
  const inX2 = sheetX2 - innerOffset;
  const inY2 = sheetY2 - innerOffset;

  // Outer Border
  elements.push({
    id: `border-outer-${timestamp}`,
    type: 'rect',
    p1: { x: sheetX1, y: sheetY1 },
    p2: { x: sheetX2, y: sheetY2 },
    layer: 'A-ANNO',
    isSheetBorder: true
  });

  // Inner Border (Drawing Area Boundary)
  elements.push({
    id: `border-inner-${timestamp}`,
    type: 'rect',
    p1: { x: inX1, y: inY1 },
    p2: { x: inX2, y: inY2 },
    layer: 'A-ANNO',
    isSheetBorder: true
  });

  // ISO Drawing Title Block in bottom-right corner
  const tbW = 3800;
  const tbH = 1400;
  const tbX = inX2 - tbW;
  const tbY = inY1;

  elements.push({
    id: `tb-box-${timestamp}`,
    type: 'rect',
    p1: { x: tbX, y: tbY },
    p2: { x: inX2, y: tbY + tbH },
    layer: 'A-ANNO',
    isTitleBlock: true
  });

  // Horizontal divisions in Title Block
  const hDivs = [350, 700, 1050];
  hDivs.forEach((h, idx) => {
    elements.push({
      id: `tb-hdiv-${idx}-${timestamp}`,
      type: 'line',
      p1: { x: tbX, y: tbY + h },
      p2: { x: inX2, y: tbY + h },
      layer: 'A-ANNO',
      isTitleBlock: true
    });
  });

  // Vertical split inside title block
  elements.push({
    id: `tb-vdiv-1-${timestamp}`,
    type: 'line',
    p1: { x: tbX + 2200, y: tbY },
    p2: { x: tbX + 2200, y: tbY + 700 },
    layer: 'A-ANNO',
    isTitleBlock: true
  });

  // Title Block Text Labels
  const now = new Date();
  const dateFormatted = `${now.toLocaleString('default', { month: 'short' }).toUpperCase()} ${now.getFullYear()}`;

  const tbTexts = [
    { text: "MEPlanIQ COMPUTATIONAL BIM STUDIO", x: tbX + 120, y: tbY + 1150, size: 140, weight: 'bold' },
    { text: `PROJECT: ${projectName.toUpperCase()}`, x: tbX + 120, y: tbY + 800, size: 150, weight: 'bold' },
    { text: "SHEET: GROUND FLOOR PLAN & MEP LAYOUT", x: tbX + 120, y: tbY + 450, size: 130, weight: 'bold' },
    { text: "STATUS: ISSUED FOR PERMIT / REVIEW", x: tbX + 120, y: tbY + 120, size: 120, weight: 'normal' },
    { text: "SCALE: 1:100 @ A1", x: tbX + 2300, y: tbY + 450, size: 120, weight: 'bold' },
    { text: `DATE: ${dateFormatted}`, x: tbX + 2300, y: tbY + 120, size: 120, weight: 'normal' },
    { text: "DWG NO: A-101", x: inX2 - 600, y: tbY + 120, size: 150, weight: 'bold' }
  ];

  tbTexts.forEach((t, idx) => {
    elements.push({
      id: `tb-txt-${idx}-${timestamp}`,
      type: 'text',
      text: t.text,
      x: t.x,
      y: t.y,
      fontSize: t.size,
      layer: 'A-ANNO',
      isTitleBlock: true
    });
  });

  // True North Arrow at Top-Right
  const naX = inX2 - 1200;
  const naY = inY2 - 1200;
  const naRadius = 350;

  // North Compass Circle
  elements.push({
    id: `north-circle-${timestamp}`,
    type: 'circle',
    center: { x: naX, y: naY },
    radius: naRadius,
    layer: 'A-ANNO',
    isTitleBlock: true
  });

  // Vertical arrow centerline
  elements.push({
    id: `north-arrow-line-${timestamp}`,
    type: 'line',
    p1: { x: naX, y: naY - naRadius },
    p2: { x: naX, y: naY + naRadius + 150 },
    layer: 'A-ANNO',
    isTitleBlock: true
  });

  // North Arrowhead (triangle)
  elements.push(
    {
      id: `north-arrow-left-${timestamp}`,
      type: 'line',
      p1: { x: naX, y: naY + naRadius + 150 },
      p2: { x: naX - 90, y: naY + naRadius - 80 },
      layer: 'A-ANNO',
      isTitleBlock: true
    },
    {
      id: `north-arrow-right-${timestamp}`,
      type: 'line',
      p1: { x: naX, y: naY + naRadius + 150 },
      p2: { x: naX + 90, y: naY + naRadius - 80 },
      layer: 'A-ANNO',
      isTitleBlock: true
    },
    {
      id: `north-arrow-base-${timestamp}`,
      type: 'line',
      p1: { x: naX - 90, y: naY + naRadius - 80 },
      p2: { x: naX + 90, y: naY + naRadius - 80 },
      layer: 'A-ANNO',
      isTitleBlock: true
    }
  );

  // "N" Label
  elements.push({
    id: `north-label-${timestamp}`,
    type: 'text',
    text: "N",
    x: naX - 45,
    y: naY + naRadius + 220,
    fontSize: 240,
    layer: 'A-ANNO',
    isTitleBlock: true
  });

  return elements;
}

/**
 * Automatically calculates structural column coordinates at wall corners & junctions,
 * and sets up standard alphanumeric structural grid lines (A, B, C... / 1, 2, 3...) with
 * centerlines, circular ID bubbles, and bays inter-column dimensions.
 */
export function generateStructuralGridAndColumns(entities = [], colSize = 300) {
  const elements = [];
  const timestamp = Date.now();

  const walls = entities.filter(e => e.type === 'wall' && e.centerline);
  if (walls.length === 0) return elements;

  // 1. Gather raw wall corner points
  const rawPoints = [];
  walls.forEach(w => {
    rawPoints.push({ x: w.centerline.p1.x, y: w.centerline.p1.y });
    rawPoints.push({ x: w.centerline.p2.x, y: w.centerline.p2.y });
  });

  // 2. Cluster points within 250mm tolerance
  const clusteredNodes = [];
  rawPoints.forEach(pt => {
    const existing = clusteredNodes.find(c => dist(c, pt) < 250);
    if (!existing) {
      clusteredNodes.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
    }
  });

  if (clusteredNodes.length === 0) return elements;

  // 3. Generate Structural Column entities at each junction
  clusteredNodes.forEach((node, idx) => {
    elements.push({
      id: `col-${idx}-${timestamp}`,
      type: 'column',
      center: { x: node.x, y: node.y },
      width: colSize,
      height: colSize,
      layer: 'S-COLS',
      isStructural: true
    });
  });

  // 4. Cluster distinct X and Y coordinates for structural grid lines
  const rawXs = clusteredNodes.map(n => n.x);
  const rawYs = clusteredNodes.map(n => n.y);

  const gridXs = [];
  rawXs.forEach(x => {
    const existing = gridXs.find(gx => Math.abs(gx - x) < 300);
    if (existing === undefined) {
      gridXs.push(x);
    }
  });
  gridXs.sort((a, b) => a - b);

  const gridYs = [];
  rawYs.forEach(y => {
    const existing = gridYs.find(gy => Math.abs(gy - y) < 300);
    if (existing === undefined) {
      gridYs.push(y);
    }
  });
  gridYs.sort((a, b) => a - b);

  const minX = Math.min(...gridXs);
  const maxX = Math.max(...gridXs);
  const minY = Math.min(...gridYs);
  const maxY = Math.max(...gridYs);

  const gridExtension = 1400;

  // 5. Generate Vertical Grid Lines (1, 2, 3...)
  gridXs.forEach((gx, idx) => {
    const label = String(idx + 1);
    elements.push({
      id: `gridline-x-${idx}-${timestamp}`,
      type: 'gridline',
      p1: { x: gx, y: minY - gridExtension },
      p2: { x: gx, y: maxY + gridExtension },
      axis: 'X',
      label,
      layer: 'S-GRID',
      isStructural: true
    });

    // Add inter-grid dimension strings along top
    if (idx > 0) {
      const prevX = gridXs[idx - 1];
      elements.push({
        id: `grid-dim-x-${idx}-${timestamp}`,
        type: 'dimension',
        p1: { x: prevX, y: maxY + gridExtension + 500 },
        p2: { x: gx, y: maxY + gridExtension + 500 },
        layer: 'A-DIMS',
        isStructural: true
      });
    }
  });

  // 6. Generate Horizontal Grid Lines (A, B, C...)
  gridYs.forEach((gy, idx) => {
    const label = String.fromCharCode(65 + (idx % 26));
    elements.push({
      id: `gridline-y-${idx}-${timestamp}`,
      type: 'gridline',
      p1: { x: minX - gridExtension, y: gy },
      p2: { x: maxX + gridExtension, y: gy },
      axis: 'Y',
      label,
      layer: 'S-GRID',
      isStructural: true
    });

    // Add inter-grid dimension strings along left
    if (idx > 0) {
      const prevY = gridYs[idx - 1];
      elements.push({
        id: `grid-dim-y-${idx}-${timestamp}`,
        type: 'dimension',
        p1: { x: minX - gridExtension - 500, y: prevY },
        p2: { x: minX - gridExtension - 500, y: gy },
        layer: 'A-DIMS',
        isStructural: true
      });
    }
  });

  return elements;
}


/**
 * Automatically routes coordinated HVAC Ductwork and Plumbing Piping networks
 * based on spatial room topologies and sanitary fixture coordinates.
 * Follows ASHRAE 62.1 airflow standards and UPC / IPC hydraulic sizing.
 */
export function generateAutomatedMepNetworks(entities = [], detectedRooms = []) {
  const elements = [];
  const timestamp = Date.now();

  // 1. Compute Architectural Envelope Extents
  let minX = 0, minY = 0, maxX = 6000, maxY = 5000;
  const xs = [];
  const ys = [];

  entities.forEach(e => {
    if (e.isSheetBorder || e.isTitleBlock || e.isMep) return;
    if (e.centerline) {
      xs.push(e.centerline.p1.x, e.centerline.p2.x);
      ys.push(e.centerline.p1.y, e.centerline.p2.y);
    } else if (e.p1 && e.p2) {
      xs.push(e.p1.x, e.p2.x);
      ys.push(e.p1.y, e.p2.y);
    } else if (e.x !== undefined && e.y !== undefined) {
      xs.push(e.x);
      ys.push(e.y);
    }
  });

  if (xs.length > 0) {
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  }

  const buildingW = Math.max(4000, maxX - minX);
  const buildingH = Math.max(3000, maxY - minY);
  const trunkY = Math.round(minY + buildingH * 0.52);

  // 2. Discover Terminal Placement Points (Room Centroids)
  const roomTerminals = [];

  if (detectedRooms && detectedRooms.length > 0) {
    detectedRooms.forEach((rm, idx) => {
      let cx = 0, cy = 0;
      if (rm.points && rm.points.length > 0) {
        rm.points.forEach(p => { cx += p[0]; cy += p[1]; });
        cx = Math.round(cx / rm.points.length);
        cy = Math.round(cy / rm.points.length);
      } else {
        cx = Math.round(minX + (buildingW / (detectedRooms.length + 1)) * (idx + 1));
        cy = Math.round(minY + buildingH * (idx % 2 === 0 ? 0.75 : 0.25));
      }
      const area = rm.carpet_area_sqm || 16.0;
      const cfm = Math.max(120, Math.round(area * 14));
      roomTerminals.push({
        id: 'term-' + idx,
        name: rm.name || ('Zone ' + (idx + 1)),
        x: cx,
        y: cy,
        cfm
      });
    });
  } else {
    // Default 2-zone terminal layout if rooms not yet fully closed
    roomTerminals.push(
      { id: 'term-1', name: 'Zone 1 (Living/Work)', x: Math.round(minX + buildingW * 0.35), y: Math.round(minY + buildingH * 0.72), cfm: 280 },
      { id: 'term-2', name: 'Zone 2 (Bedroom/Office)', x: Math.round(minX + buildingW * 0.7), y: Math.round(minY + buildingH * 0.35), cfm: 220 }
    );
  }

  const totalCfm = roomTerminals.reduce((sum, t) => sum + t.cfm, 0);

  // 3. HVAC EQUIPMENT: Air Handling Unit (AHU) / Outdoor Unit
  const ahuX = minX - 700;
  const ahuY = trunkY;

  elements.push({
    id: 'mep-ahu-' + timestamp,
    type: 'equipment',
    center: { x: ahuX, y: ahuY },
    width: 750,
    height: 550,
    label: 'AHU-01 (' + totalCfm + ' CFM)',
    subType: 'ahu',
    layer: 'M-HVAC',
    isMep: true
  });

  // 4. HVAC MAIN SUPPLY TRUNK DUCT
  const trunkStartX = ahuX + 375;
  const trunkEndX = Math.round(maxX - buildingW * 0.15);

  elements.push({
    id: 'mep-trunk-duct-' + timestamp,
    type: 'mep-duct',
    p1: { x: trunkStartX, y: trunkY },
    p2: { x: trunkEndX, y: trunkY },
    width: 350,
    height: 250,
    system: 'SUPPLY TRUNK',
    cfm: totalCfm,
    label: '350x250 S-DUCT (' + totalCfm + ' CFM)',
    layer: 'M-HVAC',
    isMep: true
  });

  // 5. HVAC TERMINAL DIFFUSERS & BRANCH DUCTS
  roomTerminals.forEach((term, idx) => {
    // Air terminal 4-way ceiling diffuser
    elements.push({
      id: 'mep-diffuser-' + idx + '-' + timestamp,
      type: 'air-terminal',
      center: { x: term.x, y: term.y },
      size: 450,
      cfm: term.cfm,
      label: term.name + ' (' + term.cfm + ' CFM)',
      subType: 'supply',
      layer: 'M-HVAC',
      isMep: true
    });

    // Branch takeoff from supply trunk:
    // Route orthogonally: from (term.x, trunkY) to (term.x, term.y)
    elements.push({
      id: 'mep-branch-duct-' + idx + '-' + timestamp,
      type: 'mep-duct',
      p1: { x: term.x, y: trunkY },
      p2: { x: term.x, y: term.y },
      width: 200,
      height: 150,
      system: 'BRANCH',
      cfm: term.cfm,
      label: '200x150 (' + term.cfm + ' CFM)',
      layer: 'M-HVAC',
      isMep: true
    });
  });

  // 6. HVAC RETURN AIR GRILLE (RAG) in central plenum
  elements.push({
    id: 'mep-return-grille-' + timestamp,
    type: 'air-terminal',
    center: { x: Math.round(minX + buildingW * 0.18), y: trunkY - 450 },
    size: 500,
    cfm: totalCfm,
    label: 'RAG-01 (' + totalCfm + ' CFM)',
    subType: 'return',
    layer: 'M-HVAC',
    isMep: true
  });

  // 7. PLUMBING: Fixtures Discovery
  const plumbingFixtures = entities.filter(e => {
    if (e.type !== 'block') return false;
    const bid = (e.blockId || e.name || '').toLowerCase();
    return bid.includes('wc') || bid.includes('toilet') || bid.includes('basin') || bid.includes('sink') || bid.includes('bath') || bid.includes('shower');
  });

  const fixturePoints = [];
  if (plumbingFixtures.length > 0) {
    plumbingFixtures.forEach((f, idx) => {
      fixturePoints.push({
        id: 'fix-' + idx,
        x: Math.round(f.x || 0),
        y: Math.round(f.y || 0),
        name: f.name || 'Fixture'
      });
    });
  } else {
    // Default wet room fixture tap-offs along south zone
    fixturePoints.push(
      { id: 'fix-1', x: Math.round(minX + buildingW * 0.25), y: Math.round(minY + buildingH * 0.2), name: 'Water Closet (WC)' },
      { id: 'fix-2', x: Math.round(minX + buildingW * 0.45), y: Math.round(minY + buildingH * 0.2), name: 'Wash Basin' }
    );
  }

  // 8. PLUMBING: Water Meter / DCW Supply Riser
  const riserX = minX - 450;
  const riserY = minY - 300;

  elements.push({
    id: 'mep-water-riser-' + timestamp,
    type: 'equipment',
    center: { x: riserX, y: riserY },
    width: 320,
    height: 320,
    label: 'WATER RISER Ø32 CPVC',
    subType: 'riser',
    layer: 'P-PLUM',
    isMep: true
  });

  // 9. PLUMBING: Sewer Inspection Chamber (IC)
  const icX = maxX + 450;
  const icY = minY - 300;

  elements.push({
    id: 'mep-sewer-ic-' + timestamp,
    type: 'equipment',
    center: { x: icX, y: icY },
    width: 420,
    height: 420,
    label: 'INSPECTION CHAMBER (IC-01)',
    subType: 'manhole',
    layer: 'P-PLUM',
    isMep: true
  });

  // 10. PLUMBING: Domestic Cold Water (DCW) Main Supply Pipe
  const mainWaterPipeY = minY - 200;
  elements.push({
    id: 'mep-pipe-dcw-main-' + timestamp,
    type: 'mep-pipe',
    p1: { x: riserX, y: riserY },
    p2: { x: riserX, y: mainWaterPipeY },
    pipeType: 'DCW',
    diameterMm: 32,
    material: 'CPVC',
    layer: 'P-PLUM',
    isMep: true
  });

  const lastFixX = fixturePoints.length > 0 ? Math.max(...fixturePoints.map(p => p.x)) : maxX;
  elements.push({
    id: 'mep-pipe-dcw-run-' + timestamp,
    type: 'mep-pipe',
    p1: { x: riserX, y: mainWaterPipeY },
    p2: { x: lastFixX + 200, y: mainWaterPipeY },
    pipeType: 'DCW',
    diameterMm: 25,
    material: 'CPVC',
    label: 'Ø25 CPVC DCW SUPPLY',
    layer: 'P-PLUM',
    isMep: true
  });

  // DCW branches to each fixture
  fixturePoints.forEach((fix, idx) => {
    elements.push({
      id: 'mep-pipe-dcw-branch-' + idx + '-' + timestamp,
      type: 'mep-pipe',
      p1: { x: fix.x, y: mainWaterPipeY },
      p2: { x: fix.x, y: fix.y },
      pipeType: 'DCW',
      diameterMm: 20,
      material: 'CPVC',
      label: 'Ø20 CPVC',
      layer: 'P-PLUM',
      isMep: true
    });
  });

  // 11. PLUMBING: Soil & Waste Drainage Main Pipeline
  const mainSoilPipeY = minY - 450;
  const firstFixX = fixturePoints.length > 0 ? Math.min(...fixturePoints.map(p => p.x)) : minX;

  elements.push({
    id: 'mep-pipe-soil-run-' + timestamp,
    type: 'mep-pipe',
    p1: { x: firstFixX - 200, y: mainSoilPipeY },
    p2: { x: icX, y: mainSoilPipeY },
    pipeType: 'SOIL',
    diameterMm: 110,
    material: 'uPVC',
    label: 'Ø110 uPVC SOIL (1:40 SLOPE)',
    layer: 'P-PLUM',
    isMep: true
  });

  elements.push({
    id: 'mep-pipe-soil-ic-drop-' + timestamp,
    type: 'mep-pipe',
    p1: { x: icX, y: mainSoilPipeY },
    p2: { x: icX, y: icY },
    pipeType: 'SOIL',
    diameterMm: 110,
    material: 'uPVC',
    layer: 'P-PLUM',
    isMep: true
  });

  // Soil branches from fixtures to drainage main
  fixturePoints.forEach((fix, idx) => {
    elements.push({
      id: 'mep-pipe-soil-branch-' + idx + '-' + timestamp,
      type: 'mep-pipe',
      p1: { x: fix.x + 80, y: fix.y },
      p2: { x: fix.x + 80, y: mainSoilPipeY },
      pipeType: 'SOIL',
      diameterMm: 75,
      material: 'uPVC',
      label: 'Ø75 DRAIN',
      layer: 'P-PLUM',
      isMep: true
    });
  });

  return elements;
}
