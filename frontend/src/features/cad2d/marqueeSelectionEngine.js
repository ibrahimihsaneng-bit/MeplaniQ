/**
 * marqueeSelectionEngine.js
 * 
 * Commercial CAD Window & Crossing Marquee Selection Engine (AutoCAD/Revit standard).
 * 
 * - Drag Left -> Right: WINDOW SELECTION (Blue solid box)
 *   Entities must be 100% strictly enclosed within the selection marquee.
 * 
 * - Drag Right -> Left: CROSSING SELECTION (Green dashed box)
 *   Entities touching, crossing, or enclosed within the selection marquee are selected.
 */

/**
 * Check if a 2D point lies strictly inside an axis-aligned bounding box.
 * @param {{x: number, y: number}} pt
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} box
 * @returns {boolean}
 */
export function isPointInBox(pt, box) {
  if (!pt || !box) return false;
  return pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY;
}

/**
 * Check if an entity bounding box is completely enclosed within a marquee box.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} entityBox
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} marqueeBox
 * @returns {boolean}
 */
export function isBoxEnclosedInBox(entityBox, marqueeBox) {
  if (!entityBox || !marqueeBox) return false;
  return (
    entityBox.minX >= marqueeBox.minX &&
    entityBox.maxX <= marqueeBox.maxX &&
    entityBox.minY >= marqueeBox.minY &&
    entityBox.maxY <= marqueeBox.maxY
  );
}

/**
 * Check if two axis-aligned bounding boxes overlap (intersect).
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} b1
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} b2
 * @returns {boolean}
 */
export function doBoxesOverlap(b1, b2) {
  if (!b1 || !b2) return false;
  return !(
    b1.maxX < b2.minX ||
    b1.minX > b2.maxX ||
    b1.maxY < b2.minY ||
    b1.minY > b2.maxY
  );
}

/**
 * Check if a 2D line segment intersects an axis-aligned box (Liang-Barsky clipping).
 * @param {{x: number, y: number}} p1
 * @param {{x: number, y: number}} p2
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} box
 * @returns {boolean}
 */
export function doesSegmentIntersectBox(p1, p2, box) {
  if (!p1 || !p2 || !box) return false;

  // If either point is inside, it intersects
  if (isPointInBox(p1, box) || isPointInBox(p2, box)) return true;

  // Bounding box pre-check
  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  if (segMaxX < box.minX || segMinX > box.maxX || segMaxY < box.minY || segMinY > box.maxY) {
    return false;
  }

  // Liang-Barsky parametric clipping
  let p = [
    -(p2.x - p1.x),
    p2.x - p1.x,
    -(p2.y - p1.y),
    p2.y - p1.y
  ];
  let q = [
    p1.x - box.minX,
    box.maxX - p1.x,
    p1.y - box.minY,
    box.maxY - p1.y
  ];

  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // Parallel and outside
    } else {
      let t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u2) return false;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return false;
        if (t < u2) u2 = t;
      }
    }
  }

  return u1 <= u2;
}

/**
 * Check if any segment of a polyline/path intersects a box.
 * @param {Array<{x: number, y: number}>} points
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} box
 * @returns {boolean}
 */
export function doesPolylineIntersectBox(points, box) {
  if (!points || points.length === 0) return false;
  if (points.length === 1) return isPointInBox(points[0], box);

  for (let i = 0; i < points.length - 1; i++) {
    if (doesSegmentIntersectBox(points[i], points[i + 1], box)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if ALL points in a polyline are enclosed in a box.
 * @param {Array<{x: number, y: number}>} points
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} box
 * @returns {boolean}
 */
export function isPolylineEnclosedInBox(points, box) {
  if (!points || points.length === 0) return false;
  return points.every(pt => isPointInBox(pt, box));
}

/**
 * Build normalized AABB box from two corners (drag start and current mouse).
 * @param {{x: number, y: number}} startPt
 * @param {{x: number, y: number}} currentPt
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, isCrossing: boolean}}
 */
export function createMarqueeBox(startPt, currentPt) {
  const minX = Math.min(startPt.x, currentPt.x);
  const maxX = Math.max(startPt.x, currentPt.x);
  const minY = Math.min(startPt.y, currentPt.y);
  const maxY = Math.max(startPt.y, currentPt.y);

  // Dragging right-to-left means Crossing Selection
  const isCrossing = currentPt.x < startPt.x;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    isCrossing
  };
}

/**
 * Scan all model entities and find all items caught in the marquee window or crossing box.
 * 
 * @param {Object} marqueeBox - Output of createMarqueeBox
 * @param {Object} solveData - The complete 2D CAD CAD model state
 * @returns {Array<{type: string, id: string|number, item: Object, bounds: Object}>}
 */
export function queryMarqueeSelection(marqueeBox, solveData) {
  if (!marqueeBox || !solveData || marqueeBox.width < 5 || marqueeBox.height < 5) {
    return [];
  }

  const { isCrossing } = marqueeBox;
  const matches = [];

  // 1. Plumbing Fixtures (point / bounding box)
  if (Array.isArray(solveData.plumbing_fixtures)) {
    solveData.plumbing_fixtures.forEach(fix => {
      const w = fix.width || 600;
      const h = fix.height || 600;
      const fBox = {
        minX: fix.x - w / 2,
        maxX: fix.x + w / 2,
        minY: fix.y - h / 2,
        maxY: fix.y + h / 2
      };

      const selected = isCrossing ? doBoxesOverlap(fBox, marqueeBox) : isBoxEnclosedInBox(fBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'PlumbingFixture', id: fix.id, item: fix, bounds: fBox });
      }
    });
  }

  // 2. Plumbing Pipes (polyline paths)
  if (Array.isArray(solveData.plumbing_pipes)) {
    solveData.plumbing_pipes.forEach(pipe => {
      const pts = pipe.path_points || [];
      if (pts.length < 2) return;

      const selected = isCrossing
        ? doesPolylineIntersectBox(pts, marqueeBox)
        : isPolylineEnclosedInBox(pts, marqueeBox);

      if (selected) {
        matches.push({ type: 'PlumbingPipe', id: pipe.id, item: pipe });
      }
    });
  }

  // 3. HVAC Ducts (polyline paths)
  if (Array.isArray(solveData.hvac_ducts)) {
    solveData.hvac_ducts.forEach(duct => {
      const pts = duct.points || [];
      if (pts.length < 2) return;

      const selected = isCrossing
        ? doesPolylineIntersectBox(pts, marqueeBox)
        : isPolylineEnclosedInBox(pts, marqueeBox);

      if (selected) {
        matches.push({ type: 'HvacDuct', id: duct.id, item: duct });
      }
    });
  }

  // 4. HVAC Diffusers (terminal points)
  if (Array.isArray(solveData.hvac_diffusers)) {
    solveData.hvac_diffusers.forEach(diff => {
      const s = diff.size || 450;
      const dBox = {
        minX: diff.x - s / 2,
        maxX: diff.x + s / 2,
        minY: diff.y - s / 2,
        maxY: diff.y + s / 2
      };

      const selected = isCrossing ? doBoxesOverlap(dBox, marqueeBox) : isBoxEnclosedInBox(dBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'HvacDiffuser', id: diff.id, item: diff, bounds: dBox });
      }
    });
  }

  // 5. HVAC Equipment
  if (Array.isArray(solveData.hvac_equipment)) {
    solveData.hvac_equipment.forEach(eq => {
      const w = eq.width || 800;
      const h = eq.height || 600;
      const eqBox = {
        minX: eq.x - w / 2,
        maxX: eq.x + w / 2,
        minY: eq.y - h / 2,
        maxY: eq.y + h / 2
      };

      const selected = isCrossing ? doBoxesOverlap(eqBox, marqueeBox) : isBoxEnclosedInBox(eqBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'HVAC', id: eq.id, item: eq, bounds: eqBox });
      }
    });
  }

  // 6. Electrical Components (Sockets, Switches, DBs, Luminaires)
  if (Array.isArray(solveData.electrical_components)) {
    solveData.electrical_components.forEach(comp => {
      const s = 300;
      const cBox = {
        minX: comp.x - s / 2,
        maxX: comp.x + s / 2,
        minY: comp.y - s / 2,
        maxY: comp.y + s / 2
      };

      const selected = isCrossing ? doBoxesOverlap(cBox, marqueeBox) : isBoxEnclosedInBox(cBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'ElectricalComponent', id: comp.id, item: comp, bounds: cBox });
      }
    });
  }

  // 7. Electrical Routes / Conduits (polyline paths)
  if (Array.isArray(solveData.electrical_routes)) {
    solveData.electrical_routes.forEach(route => {
      const pts = route.points || [];
      if (pts.length < 2) return;

      const selected = isCrossing
        ? doesPolylineIntersectBox(pts, marqueeBox)
        : isPolylineEnclosedInBox(pts, marqueeBox);

      if (selected) {
        matches.push({ type: 'ElectricalRoute', id: route.id, item: route });
      }
    });
  }

  // 8. Furniture Elements
  if (Array.isArray(solveData.furniture)) {
    solveData.furniture.forEach(furn => {
      const w = furn.width || 800;
      const h = furn.height || 800;
      const fBox = {
        minX: furn.x - w / 2,
        maxX: furn.x + w / 2,
        minY: furn.y - h / 2,
        maxY: furn.y + h / 2
      };

      const selected = isCrossing ? doBoxesOverlap(fBox, marqueeBox) : isBoxEnclosedInBox(fBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'Furniture', id: furn.id, item: furn, bounds: fBox });
      }
    });
  }

  // 9. Doors and Windows
  if (Array.isArray(solveData.doors)) {
    solveData.doors.forEach(door => {
      const w = door.width_mm || 900;
      const dBox = {
        minX: door.x - w / 2,
        maxX: door.x + w / 2,
        minY: door.y - w / 2,
        maxY: door.y + w / 2
      };
      const selected = isCrossing ? doBoxesOverlap(dBox, marqueeBox) : isBoxEnclosedInBox(dBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'Door', id: door.id, item: door, bounds: dBox });
      }
    });
  }

  if (Array.isArray(solveData.windows)) {
    solveData.windows.forEach(win => {
      const w = win.width_mm || 1200;
      const wBox = {
        minX: win.x - w / 2,
        maxX: win.x + w / 2,
        minY: win.y - 200,
        maxY: win.y + 200
      };
      const selected = isCrossing ? doBoxesOverlap(wBox, marqueeBox) : isBoxEnclosedInBox(wBox, marqueeBox);
      if (selected) {
        matches.push({ type: 'Window', id: win.id, item: win, bounds: wBox });
      }
    });
  }

  // 10. Dimensions
  if (Array.isArray(solveData.dimensions)) {
    solveData.dimensions.forEach(dim => {
      const pts = [
        dim.p1 || { x: dim.dim_x1 || 0, y: dim.dim_y1 || 0 },
        dim.p2 || { x: dim.dim_x2 || 0, y: dim.dim_y2 || 0 }
      ];
      const selected = isCrossing
        ? doesPolylineIntersectBox(pts, marqueeBox)
        : isPolylineEnclosedInBox(pts, marqueeBox);

      if (selected) {
        matches.push({ type: 'Dimension', id: dim.id, item: dim });
      }
    });
  }

  return matches;
}

/**
 * Group selection list by entity type for summary stats.
 * @param {Array<Object>} selectedItems
 * @returns {Object} { counts: { [type: string]: number }, total: number }
 */
export function summarizeSelection(selectedItems) {
  if (!Array.isArray(selectedItems)) return { counts: {}, total: 0 };
  const counts = {};
  selectedItems.forEach(item => {
    counts[item.type] = (counts[item.type] || 0) + 1;
  });
  return { counts, total: selectedItems.length };
}
