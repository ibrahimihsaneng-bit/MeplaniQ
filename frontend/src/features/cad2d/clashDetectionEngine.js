/**
 * clashDetectionEngine.js
 * 
 * Commercial 2D Multi-Discipline MEP Clash Collision Detection & Interference Resolution Engine.
 * 
 * Standards Reference:
 * - NFPA 90A / ASTM E814 / IBC 714: Wall Penetration Sleeves & Firestop Dampers
 * - NEC 300.8 / IPC 308: Multi-Trade Spatial Separation (Water vs. Electrical)
 * - SMACNA / CIBSE Guide E: Cross-Discipline Duct/Pipe Clearances
 */

/**
 * Check if two 2D line segments strictly intersect and find their intersection point.
 * @param {{x: number, y: number}} p1
 * @param {{x: number, y: number}} p2
 * @param {{x: number, y: number}} q1
 * @param {{x: number, y: number}} q2
 * @returns {{x: number, y: number, t: number, u: number, angleDeg: number}|null}
 */
export function getSegmentIntersection(p1, p2, q1, q2) {
  const dxP = p2.x - p1.x;
  const dyP = p2.y - p1.y;
  const dxQ = q2.x - q1.x;
  const dyQ = q2.y - q1.y;

  const denom = dxP * dyQ - dyP * dxQ;
  if (Math.abs(denom) < 1e-8) {
    return null; // Collinear or parallel
  }

  const dxStart = q1.x - p1.x;
  const dyStart = q1.y - p1.y;

  const t = (dxStart * dyQ - dyStart * dxQ) / denom;
  const u = (dxStart * dyP - dyStart * dxP) / denom;

  // Interior intersection check with tolerance
  if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) {
    const ix = p1.x + t * dxP;
    const iy = p1.y + t * dyP;

    // Angle of crossing
    const angleP = Math.atan2(dyP, dxP);
    const angleQ = Math.atan2(dyQ, dxQ);
    let diff = Math.abs((angleP - angleQ) * 180 / Math.PI);
    if (diff > 180) diff = 360 - diff;

    return {
      x: Math.round(ix),
      y: Math.round(iy),
      t,
      u,
      angleDeg: Math.round(diff)
    };
  }

  return null;
}

/**
 * Calculate distance from point p to line segment (a, b).
 * @param {{x: number, y: number}} p
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Scan the complete 2D model state for cross-discipline collisions:
 * 1. Plumbing Pipe vs. HVAC Duct (Hard interference)
 * 2. Plumbing Pipe vs. Electrical Conduit (Clearance / safety violation)
 * 3. HVAC Duct vs. Electrical Conduit
 * 4. MEP Services vs. Wall Polygons (Wall Penetrations without sleeves)
 * 
 * @param {Object} modelData - Floorplan solveData containing pipes, ducts, routes, rooms, walls
 * @param {Object} options - Configuration tolerances
 * @returns {Array<Object>} List of detected clash descriptors
 */
export function detectMepClashes(modelData, options = {}) {
  if (!modelData) return [];

  const {
    electricalWaterClearanceMm = 150, // Minimum separation between wet pipes and electrical runs
    includeWallPenetrations = true
  } = options;

  const clashes = [];
  const pipes = modelData.plumbing_pipes || [];
  const ducts = modelData.hvac_ducts || [];
  const conduits = modelData.electrical_routes || [];
  const rooms = modelData.rooms || [];

  // Helper to extract points array
  const normalizePts = (pts) => {
    if (!Array.isArray(pts)) return [];
    return pts.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
  };

  // 1. PLUMBING PIPE vs. HVAC DUCT (Hard Clash)
  pipes.forEach(pipe => {
    const pipePts = normalizePts(pipe.path_points || pipe.points);
    if (pipePts.length < 2) return;

    ducts.forEach(duct => {
      const ductPts = normalizePts(duct.path || duct.points);
      if (ductPts.length < 2) return;

      const ductHalfWidth = ((duct.width || 400) / 2) + 25; // with insulation margin

      for (let i = 0; i < pipePts.length - 1; i++) {
        const p1 = pipePts[i];
        const p2 = pipePts[i + 1];

        for (let j = 0; j < ductPts.length - 1; j++) {
          const q1 = ductPts[j];
          const q2 = ductPts[j + 1];

          const hit = getSegmentIntersection(p1, p2, q1, q2);
          if (hit) {
            clashes.push({
              id: `clash_pipe_duct_${pipe.id || i}_${duct.id || j}`,
              type: 'PIPE_VS_DUCT',
              severity: 'HARD',
              title: `Plumbing Pipe ⚔️ HVAC Duct Collision`,
              description: `${pipe.system_type || 'Plumbing Pipe'} (Ø${pipe.diameter_mm || 25}mm) physically intersects ${duct.name || 'HVAC Duct'} (${duct.width || 400}×${duct.height || 250}mm).`,
              x: hit.x,
              y: hit.y,
              point: { x: hit.x, y: hit.y },
              trade1: 'Plumbing',
              trade2: 'HVAC',
              item1: { type: 'PlumbingPipe', id: pipe.id, name: pipe.name || `Pipe ${pipe.id}`, system: pipe.system_type, segmentIndex: i },
              item2: { type: 'HvacDuct', id: duct.id, name: duct.name || `Duct ${duct.id}`, system: duct.system, segmentIndex: j },
              recommendedAction: 'Apply 45° elevation bypass loop or reroute pipe underneath duct.'
            });
          }
        }
      }
    });
  });

  // 2. PLUMBING PIPE vs. ELECTRICAL CONDUIT (Clearance Hazard)
  pipes.forEach(pipe => {
    const pipePts = normalizePts(pipe.path_points || pipe.points);
    if (pipePts.length < 2) return;

    conduits.forEach(conduit => {
      const condPts = normalizePts(conduit.points || conduit.path);
      if (condPts.length < 2) return;

      for (let i = 0; i < pipePts.length - 1; i++) {
        const p1 = pipePts[i];
        const p2 = pipePts[i + 1];

        for (let j = 0; j < condPts.length - 1; j++) {
          const q1 = condPts[j];
          const q2 = condPts[j + 1];

          const hit = getSegmentIntersection(p1, p2, q1, q2);
          if (hit) {
            clashes.push({
              id: `clash_pipe_elec_${pipe.id || i}_${conduit.id || j}`,
              type: 'PIPE_VS_ELECTRICAL',
              severity: 'CRITICAL',
              title: `Wet Pipe ⚔️ Electrical Conduit Proximity Hazard`,
              description: `${pipe.system_type || 'Plumbing Pipe'} intersects ${conduit.conduit_type || 'Conduit'} (${conduit.circuit_id || 'CKT'}). NEC 300.8 prohibits uncoordinated wet service crossing.`,
              x: hit.x,
              y: hit.y,
              point: { x: hit.x, y: hit.y },
              trade1: 'Plumbing',
              trade2: 'Electrical',
              item1: { type: 'PlumbingPipe', id: pipe.id, name: pipe.name || `Pipe ${pipe.id}`, system: pipe.system_type, segmentIndex: i },
              item2: { type: 'ElectricalRoute', id: conduit.id, name: `Conduit ${conduit.id}`, circuit: conduit.circuit_id, segmentIndex: j },
              recommendedAction: 'Maintain minimum 150mm vertical clearance or install waterproof barrier sleeve.'
            });
          }
        }
      }
    });
  });

  // 3. HVAC DUCT vs. ELECTRICAL CONDUIT (Spatial Clash)
  ducts.forEach(duct => {
    const ductPts = normalizePts(duct.path || duct.points);
    if (ductPts.length < 2) return;

    conduits.forEach(conduit => {
      const condPts = normalizePts(conduit.points || conduit.path);
      if (condPts.length < 2) return;

      for (let i = 0; i < ductPts.length - 1; i++) {
        const p1 = ductPts[i];
        const p2 = ductPts[i + 1];

        for (let j = 0; j < condPts.length - 1; j++) {
          const q1 = condPts[j];
          const q2 = condPts[j + 1];

          const hit = getSegmentIntersection(p1, p2, q1, q2);
          if (hit) {
            clashes.push({
              id: `clash_duct_elec_${duct.id || i}_${conduit.id || j}`,
              type: 'DUCT_VS_ELECTRICAL',
              severity: 'HARD',
              title: `HVAC Duct ⚔️ Conduit Collision`,
              description: `Duct ${duct.name || duct.id} intersects conduit ${conduit.circuit_id || conduit.id}.`,
              x: hit.x,
              y: hit.y,
              point: { x: hit.x, y: hit.y },
              trade1: 'HVAC',
              trade2: 'Electrical',
              item1: { type: 'HvacDuct', id: duct.id, name: duct.name || `Duct ${duct.id}`, segmentIndex: i },
              item2: { type: 'ElectricalRoute', id: conduit.id, name: `Conduit ${conduit.id}`, segmentIndex: j },
              recommendedAction: 'Reroute conduit over duct hanger trapeze.'
            });
          }
        }
      }
    });
  });

  // 4. MEP SERVICES vs. WALL POLYGONS (Wall Penetration Sleeves)
  if (includeWallPenetrations) {
    const existingSleeves = modelData.penetration_sleeves || [];
    const isSleevePresent = (pt) => {
      return existingSleeves.some(s => Math.hypot(s.x - pt.x, s.y - pt.y) < 150);
    };

    rooms.forEach((room, rIdx) => {
      const wallPoly = normalizePts(room.points);
      if (wallPoly.length < 3) return;

      for (let w = 0; w < wallPoly.length; w++) {
        const w1 = wallPoly[w];
        const w2 = wallPoly[(w + 1) % wallPoly.length];

        // Check Pipes penetrating wall
        pipes.forEach(pipe => {
          const pipePts = normalizePts(pipe.path_points || pipe.points);
          for (let i = 0; i < pipePts.length - 1; i++) {
            const hit = getSegmentIntersection(pipePts[i], pipePts[i + 1], w1, w2);
            if (hit && !isSleevePresent(hit)) {
              clashes.push({
                id: `clash_wall_pipe_${room.name || rIdx}_${pipe.id}_${w}`,
                type: 'WALL_PENETRATION',
                severity: 'SLEEVE_REQUIRED',
                title: `Wall Penetration Without Sleeve`,
                description: `${pipe.system_type || 'Plumbing Pipe'} penetrates wall of ${room.name || 'Room'} without standard pipe sleeve (IBC 714).`,
                x: hit.x,
                y: hit.y,
                point: { x: hit.x, y: hit.y },
                trade1: 'Plumbing',
                trade2: 'Architecture',
                item1: { type: 'PlumbingPipe', id: pipe.id, name: pipe.name || `Pipe ${pipe.id}`, diameter_mm: pipe.diameter_mm || 25 },
                item2: { type: 'Room', id: room.name, wallIndex: w },
                penetrationDetails: {
                  sleeveType: 'PIPE_SLEEVE',
                  annularClearanceMm: 25,
                  diameterMm: (pipe.diameter_mm || 25) + 50,
                  fireRatingHours: 2
                },
                recommendedAction: 'Install standard 2-hour fire-rated wall sleeve.'
              });
            }
          }
        });

        // Check Ducts penetrating wall
        ducts.forEach(duct => {
          const ductPts = normalizePts(duct.path || duct.points);
          for (let i = 0; i < ductPts.length - 1; i++) {
            const hit = getSegmentIntersection(ductPts[i], ductPts[i + 1], w1, w2);
            if (hit && !isSleevePresent(hit)) {
              clashes.push({
                id: `clash_wall_duct_${room.name || rIdx}_${duct.id}_${w}`,
                type: 'WALL_PENETRATION',
                severity: 'SLEEVE_REQUIRED',
                title: `Duct Wall Penetration (Fire Damper Required)`,
                description: `HVAC Duct (${duct.width || 400}×${duct.height || 250}mm) penetrates ${room.name || 'Room'} wall without fire damper sleeve (NFPA 90A).`,
                x: hit.x,
                y: hit.y,
                point: { x: hit.x, y: hit.y },
                trade1: 'HVAC',
                trade2: 'Architecture',
                item1: { type: 'HvacDuct', id: duct.id, width: duct.width || 400, height: duct.height || 250 },
                item2: { type: 'Room', id: room.name, wallIndex: w },
                penetrationDetails: {
                  sleeveType: 'DUCT_FIRE_DAMPER',
                  widthMm: (duct.width || 400) + 60,
                  heightMm: (duct.height || 250) + 60,
                  fireRatingHours: 2
                },
                recommendedAction: 'Install NFPA 90A Fire Damper with expansion sleeve.'
              });
            }
          }
        });
      }
    });
  }

  return clashes;
}

/**
 * Generate an Automated Wall Penetration Sleeve specification for a clash.
 * 
 * @param {Object} clash - The WALL_PENETRATION clash item
 * @returns {Object} Sleeve descriptor ready for rendering in LAYER_SLEEVES
 */
export function createPenetrationSleeve(clash) {
  if (!clash || !clash.point) return null;

  const isDuct = clash.penetrationDetails?.sleeveType === 'DUCT_FIRE_DAMPER' || clash.item1?.type === 'HvacDuct';
  const width = isDuct ? (clash.penetrationDetails?.widthMm || 480) : (clash.penetrationDetails?.diameterMm || 75);
  const height = isDuct ? (clash.penetrationDetails?.heightMm || 320) : width;

  return {
    id: `sleeve_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: isDuct ? 'DUCT_FIRE_DAMPER' : 'PIPE_SLEEVE',
    x: clash.point.x,
    y: clash.point.y,
    width,
    height,
    diameter_mm: !isDuct ? width : undefined,
    fireRatingHours: clash.penetrationDetails?.fireRatingHours || 2,
    serviceType: clash.item1?.type,
    serviceId: clash.item1?.id,
    label: isDuct ? `FD-2HR (${width}×${height})` : `SLV Ø${width}mm`,
    color: isDuct ? '#EF4444' : '#F59E0B'
  };
}

/**
 * Generate a 45° Orthogonal Bypass Detour Loop around a crossing obstruction.
 * 
 * @param {Array<{x: number, y: number}>} path - Original polyline points
 * @param {number} segmentIndex - Index of segment where clash occurred
 * @param {{x: number, y: number}} clashPoint - Exact intersection coordinates
 * @param {number} clearanceDistanceMm - Lateral detour distance (e.g. 350mm)
 * @returns {Array<{x: number, y: number}>} New path points with detour loop
 */
export function generateBypassDetour(path, segmentIndex, clashPoint, clearanceDistanceMm = 350) {
  if (!path || path.length < 2 || segmentIndex < 0 || segmentIndex >= path.length - 1) {
    return path;
  }

  const p1 = path[segmentIndex];
  const p2 = path[segmentIndex + 1];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const segLen = Math.hypot(dx, dy);

  if (segLen < 100) return path; // Too short to detour

  // Unit direction along segment
  const ux = dx / segLen;
  const uy = dy / segLen;

  // Perpendicular normal vector
  const nx = -uy;
  const ny = ux;

  // Step back and step forward along segment
  const step = Math.min(250, segLen / 4);

  const j1 = {
    x: Math.round(clashPoint.x - ux * step),
    y: Math.round(clashPoint.y - uy * step)
  };
  const j2 = {
    x: Math.round(j1.x + nx * clearanceDistanceMm),
    y: Math.round(j1.y + ny * clearanceDistanceMm)
  };
  const j3 = {
    x: Math.round(clashPoint.x + ux * step + nx * clearanceDistanceMm),
    y: Math.round(clashPoint.y + uy * step + ny * clearanceDistanceMm)
  };
  const j4 = {
    x: Math.round(clashPoint.x + ux * step),
    y: Math.round(clashPoint.y + uy * step)
  };

  // Construct new polyline with the 4-point detour
  const newPath = [
    ...path.slice(0, segmentIndex + 1),
    j1,
    j2,
    j3,
    j4,
    ...path.slice(segmentIndex + 1)
  ];

  return newPath;
}
