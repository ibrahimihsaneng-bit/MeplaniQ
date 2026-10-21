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
