/**
 * pipeRoutingEngine.js
 * ====================
 * Professional 2D Orthogonal MEP Pipe Routing & Sanitary Port Snapping Engine.
 * Compliant with IPC (International Plumbing Code) & NBC 2016 Standards.
 */

export const PLUMBING_SYSTEMS = {
  CW: {
    id: 'CW',
    name: 'Cold Water Supply',
    color: '#0284C7',
    defaultDiam: 25,
    diams: [15, 20, 25, 32, 40, 50],
    pipeType: 'Water Supply Pipe',
    icon: '💧'
  },
  HW: {
    id: 'HW',
    name: 'Hot Water Supply',
    color: '#EF4444',
    defaultDiam: 20,
    diams: [15, 20, 25, 32],
    pipeType: 'Hot Water Supply Pipe',
    icon: '🔥'
  },
  DRAIN: {
    id: 'DRAIN',
    name: 'Sanitary Drainage & Waste',
    color: '#10B981',
    defaultDiam: 110,
    diams: [40, 50, 75, 110, 160],
    defaultSlope: '1:50',
    slopeRatio: 0.02,
    pipeType: 'Drainage Pipe',
    icon: '🚽'
  },
  VENT: {
    id: 'VENT',
    name: 'Plumbing Vent Stack',
    color: '#8B5CF6',
    defaultDiam: 50,
    diams: [40, 50, 75, 110],
    pipeType: 'Vent Pipe',
    icon: '💨'
  }
};

/**
 * Extracts all snap connection ports from active plumbing fixtures.
 */
export function extractFixturePorts(fixtures = [], solveData = null) {
  const ports = [];

  fixtures.forEach((fix, idx) => {
    if (!fix) return;
    const room = solveData?.rooms?.find(r => 
      (r?.name || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim()
    );
    let cx = 0, cy = 0;
    if (room && Array.isArray(room.points) && room.points.length >= 3) {
      const xs = room.points.map(p => p[0]);
      const ys = room.points.map(p => p[1]);
      cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    }

    const fx = (Number.isFinite(Number(fix.x)) && Number(fix.x) !== 0) ? Number(fix.x) : cx;
    const fy = (Number.isFinite(Number(fix.y)) && Number(fix.y) !== 0) ? Number(fix.y) : cy;
    const fw = Number(fix.width) || 600;
    const fh = Number(fix.height) || 500;
    const rot = Number(fix.rotation) || 0;
    const rotRad = (rot * Math.PI) / 180;
    const fType = (fix.type || fix.name || '').toLowerCase();

    // 1. Cold Water Supply Port (Standard back-left port)
    const relSupplyX = -fw * 0.28;
    const relSupplyY = -fh * 0.38;
    const cwX = fx + (relSupplyX * Math.cos(rotRad) - relSupplyY * Math.sin(rotRad));
    const cwY = fy + (relSupplyX * Math.sin(rotRad) + relSupplyY * Math.cos(rotRad));

    ports.push({
      id: `${fix.id || idx}-CW`,
      fixtureId: fix.id,
      fixtureType: fix.type || 'Fixture',
      roomName: fix.host_room_id || room?.name,
      portType: 'CW',
      point: { x: Math.round(cwX), y: Math.round(cwY) },
      nominalDiam: 20,
      label: `${fix.id || 'Fix'} Cold Water Port (DN20)`,
      color: '#0284C7'
    });

    // 2. Hot Water Port (for Basins, Sinks, Showers, Bath tubs)
    if (fType.includes('basin') || fType.includes('sink') || fType.includes('shower') || fType.includes('bath') || fType.includes('tub')) {
      const relHwX = -fw * 0.12;
      const relHwY = -fh * 0.38;
      const hwX = fx + (relHwX * Math.cos(rotRad) - relHwY * Math.sin(rotRad));
      const hwY = fy + (relHwX * Math.sin(rotRad) + relHwY * Math.cos(rotRad));

      ports.push({
        id: `${fix.id || idx}-HW`,
        fixtureId: fix.id,
        fixtureType: fix.type || 'Fixture',
        roomName: fix.host_room_id || room?.name,
        portType: 'HW',
        point: { x: Math.round(hwX), y: Math.round(hwY) },
        nominalDiam: 20,
        label: `${fix.id || 'Fix'} Hot Water Port (DN20)`,
        color: '#EF4444'
      });
    }

    // 3. Drainage / Soil Port (Back-right discharge port)
    const relDrainX = fw * 0.28;
    const relDrainY = -fh * 0.38;
    const drX = fx + (relDrainX * Math.cos(rotRad) - relDrainY * Math.sin(rotRad));
    const drY = fy + (relDrainX * Math.sin(rotRad) + relDrainY * Math.cos(rotRad));

    const isSoilWc = fType.includes('wc') || fType.includes('toilet') || fType.includes('water closet');
    const drainDiam = isSoilWc ? 110 : (fType.includes('basin') ? 40 : 50);

    ports.push({
      id: `${fix.id || idx}-DRAIN`,
      fixtureId: fix.id,
      fixtureType: fix.type || 'Fixture',
      roomName: fix.host_room_id || room?.name,
      portType: 'DRAIN',
      point: { x: Math.round(drX), y: Math.round(drY) },
      nominalDiam: drainDiam,
      label: `${fix.id || 'Fix'} Drain Port (DN${drainDiam})`,
      color: '#10B981'
    });
  });

  return ports;
}

/**
 * Searches for the nearest fixture port to cursor within tolerance.
 */
export function findNearestFixturePort(cursorPt, ports = [], toleranceCad = 250) {
  if (!cursorPt || ports.length === 0) return null;

  let closest = null;
  let minDist = toleranceCad;

  for (const port of ports) {
    const d = Math.hypot(cursorPt.x - port.point.x, cursorPt.y - port.point.y);
    if (d < minDist) {
      minDist = d;
      closest = {
        ...port,
        distance: d
      };
    }
  }

  return closest;
}

/**
 * Generates an orthogonal (90° elbow) path between start point and end point.
 */
export function generateOrthogonalPath(startPt, endPt, mode = 'auto') {
  if (!startPt || !endPt) return [];
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;

  // Direct collinear segment
  if (Math.abs(dx) < 20 || Math.abs(dy) < 20) {
    return [
      { x: Math.round(startPt.x), y: Math.round(startPt.y) },
      { x: Math.round(endPt.x), y: Math.round(endPt.y) }
    ];
  }

  // Determine optimal 90° elbow corner
  const corner = (mode === 'vertical-first' || (mode === 'auto' && Math.abs(dy) > Math.abs(dx)))
    ? { x: Math.round(startPt.x), y: Math.round(endPt.y) }
    : { x: Math.round(endPt.x), y: Math.round(startPt.y) };

  return [
    { x: Math.round(startPt.x), y: Math.round(startPt.y) },
    corner,
    { x: Math.round(endPt.x), y: Math.round(endPt.y) }
  ];
}

/**
 * Computes IPC 704 standard slope, fall and total hydraulic length for a pipe route.
 */
export function calculatePipeMetrics(points = [], systemType = 'DRAIN', slopeRatio = 0.02) {
  if (!points || points.length < 2) {
    return { totalLengthMm: 0, fallMm: 0, slopeRatio, slopeStr: '1:50', elbowsCount: 0 };
  }

  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    totalLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  const isDrain = systemType === 'DRAIN';
  const effectiveSlope = isDrain ? slopeRatio : 0;
  const fallMm = Math.round(totalLength * effectiveSlope);
  const slopeStr = slopeRatio === 0.01 ? '1:100' : '1:50';
  const elbowsCount = Math.max(0, points.length - 2);

  return {
    totalLengthMm: Math.round(totalLength),
    fallMm,
    slopeRatio: effectiveSlope,
    slopeStr,
    elbowsCount
  };
}
