/**
 * ductRoutingEngine.js
 * ====================
 * Professional 2D Central Ducted HVAC & Air Distribution CAD Engine.
 * Complies with SMACNA (Sheet Metal and Air Conditioning Contractors' National Association)
 * and ASHRAE Fundamentals (Duct Design & Air Distribution).
 */

export const HVAC_DUCT_SYSTEMS = {
  SUPPLY: {
    id: 'SUPPLY',
    name: 'Supply Air Duct',
    shortName: 'Supply',
    color: '#F97316',        // Bright Orange
    fillColor: 'rgba(249, 115, 22, 0.16)',
    activeFillColor: 'rgba(249, 115, 22, 0.35)',
    icon: '💨',
    defaultSize: { width: 400, height: 250 },
    defaultCfm: 400,
    sizes: [
      { width: 600, height: 350, label: '600x350 mm (Main Trunk)' },
      { width: 500, height: 300, label: '500x300 mm (Primary Branch)' },
      { width: 400, height: 250, label: '400x250 mm (Standard Branch)' },
      { width: 350, height: 200, label: '350x200 mm (Runout Branch)' },
      { width: 300, height: 200, label: '300x200 mm (Diffuser Neck)' },
      { width: 250, height: 150, label: '250x150 mm (Terminal Branch)' }
    ]
  },
  RETURN: {
    id: 'RETURN',
    name: 'Return Air Duct',
    shortName: 'Return',
    color: '#FB923C',        // Amber
    fillColor: 'rgba(251, 146, 60, 0.14)',
    activeFillColor: 'rgba(251, 146, 60, 0.30)',
    icon: '🔄',
    defaultSize: { width: 500, height: 300 },
    defaultCfm: 400,
    sizes: [
      { width: 600, height: 400, label: '600x400 mm (Main Return)' },
      { width: 500, height: 300, label: '500x300 mm (Return Trunk)' },
      { width: 400, height: 300, label: '400x300 mm (Return Branch)' },
      { width: 300, height: 250, label: '300x250 mm (Grille Drop)' }
    ]
  },
  EXHAUST: {
    id: 'EXHAUST',
    name: 'Exhaust Air Duct',
    shortName: 'Exhaust',
    color: '#06B6D4',        // Cyan
    fillColor: 'rgba(6, 182, 212, 0.14)',
    activeFillColor: 'rgba(6, 182, 212, 0.30)',
    icon: '🌪️',
    defaultSize: { width: 300, height: 200 },
    defaultCfm: 250,
    sizes: [
      { width: 400, height: 250, label: '400x250 mm (Main Exhaust)' },
      { width: 300, height: 200, label: '300x200 mm (Exhaust Branch)' },
      { width: 250, height: 150, label: '250x150 mm (Toilet Exhaust)' },
      { width: 200, height: 150, label: '200x150 mm (Kitchen Runout)' }
    ]
  },
  FRESH_AIR: {
    id: 'FRESH_AIR',
    name: 'Fresh Air / FA Intake',
    shortName: 'Fresh Air',
    color: '#10B981',        // Emerald Green
    fillColor: 'rgba(16, 185, 129, 0.14)',
    activeFillColor: 'rgba(16, 185, 129, 0.30)',
    icon: '🍃',
    defaultSize: { width: 350, height: 250 },
    defaultCfm: 300,
    sizes: [
      { width: 450, height: 300, label: '450x300 mm (FA Intake)' },
      { width: 350, height: 250, label: '350x250 mm (FA Primary)' },
      { width: 250, height: 200, label: '250x200 mm (FA Branch)' }
    ]
  }
};

export const HVAC_DIFFUSER_TYPES = {
  SUPPLY_4WAY: {
    id: 'SUPPLY_4WAY',
    name: '4-Way Ceiling Diffuser',
    system: 'SUPPLY',
    size: 450,
    neckSize: 250,
    defaultCfm: 150,
    throwRadiusMm: 3200,
    color: '#0EA5E9',
    icon: '💨'
  },
  SUPPLY_600: {
    id: 'SUPPLY_600',
    name: '600x600 Modular Diffuser',
    system: 'SUPPLY',
    size: 600,
    neckSize: 300,
    defaultCfm: 250,
    throwRadiusMm: 4200,
    color: '#0284C7',
    icon: '💨'
  },
  RETURN_GRILLE: {
    id: 'RETURN_GRILLE',
    name: 'Return Air Grille (RAG)',
    system: 'RETURN',
    size: 500,
    neckSize: 350,
    defaultCfm: 350,
    throwRadiusMm: 2200,
    color: '#FB923C',
    icon: '🔄'
  },
  EXHAUST_GRILLE: {
    id: 'EXHAUST_GRILLE',
    name: 'Exhaust Air Grille (EAG)',
    system: 'EXHAUST',
    size: 300,
    neckSize: 200,
    defaultCfm: 120,
    throwRadiusMm: 1800,
    color: '#06B6D4',
    icon: '🌪️'
  },
  LINEAR_SLOT: {
    id: 'LINEAR_SLOT',
    name: 'Linear Slot Diffuser (1200mm)',
    system: 'SUPPLY',
    size: 1200,
    widthMm: 1200,
    heightMm: 150,
    neckSize: 200,
    defaultCfm: 200,
    throwRadiusMm: 3500,
    color: '#38BDF8',
    icon: '➖'
  }
};

/**
 * Calculates airflow velocity in FPM (Feet Per Minute) using duct cross-sectional dimensions.
 * Velocity (FPM) = CFM / Area(sq ft)
 * Area (sq ft) = (W_mm / 304.8) * (H_mm / 304.8)
 */
export function calculateDuctVelocity(cfm = 400, widthMm = 400, heightMm = 250) {
  if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) {
    return { velocityFpm: 0, status: 'UNKNOWN', label: '0 FPM', color: '#94A3B8' };
  }
  const areaSqFt = (widthMm / 304.8) * (heightMm / 304.8);
  const velocityFpm = Math.round(Number(cfm) / areaSqFt);

  let status = 'OPTIMAL_BRANCH';
  let label = 'Optimal Branch (600-900 FPM)';
  let color = '#10B981'; // Green

  if (velocityFpm > 1400) {
    status = 'HIGH_VELOCITY_NOISE';
    label = 'High Velocity - Noise Risk (>1400 FPM)';
    color = '#EF4444'; // Red
  } else if (velocityFpm >= 950 && velocityFpm <= 1400) {
    status = 'OPTIMAL_TRUNK';
    label = 'Optimal Main Trunk (950-1400 FPM)';
    color = '#F59E0B'; // Amber
  } else if (velocityFpm < 500) {
    status = 'LOW_VELOCITY_OVERSIZED';
    label = 'Low Velocity - Oversized Duct (<500 FPM)';
    color = '#38BDF8'; // Blue
  }

  // Huebscher Circular Equivalent Diameter De = 1.30 * (A*B)^0.625 / (A+B)^0.25
  const eqDiamMm = Math.round(
    (1.30 * Math.pow(widthMm * heightMm, 0.625)) / Math.pow(widthMm + heightMm, 0.25)
  );

  return {
    velocityFpm,
    areaSqFt: Number(areaSqFt.toFixed(2)),
    eqDiamMm,
    status,
    label,
    color
  };
}

/**
 * Computes the 4 corners of a rectangular duct segment between p1 and p2 with given width.
 */
export function computeDuctSegmentCorners(p1, p2, widthMm = 300) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;

  const nx = -dy / len;
  const ny = dx / len;
  const halfW = widthMm / 2;

  return [
    { x: p1.x + nx * halfW, y: p1.y + ny * halfW },
    { x: p2.x + nx * halfW, y: p2.y + ny * halfW },
    { x: p2.x - nx * halfW, y: p2.y - ny * halfW },
    { x: p1.x - nx * halfW, y: p1.y - ny * halfW }
  ];
}

/**
 * Generates an SVG polygon points string from 4 corners.
 */
export function formatPolygonPoints(corners) {
  if (!corners || corners.length < 4) return '';
  return corners.map(c => `${Math.round(c.x)},${Math.round(c.y)}`).join(' ');
}

/**
 * Generates an aerodynamic airflow chevron arrow for a duct segment.
 */
export function computeAirflowChevron(p1, p2, widthMm = 300) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 200) return null;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const halfW = widthMm / 2;

  const arrowDist = Math.min(len * 0.75, Math.max(len * 0.25, len / 2));
  const ax = p1.x + ux * arrowDist;
  const ay = p1.y + uy * arrowDist;
  const aLen = Math.min(100, len * 0.25);
  const aWidth = Math.min(halfW * 0.65, 45);

  const aLeft = { x: ax - ux * aLen - ny * aWidth, y: ay - uy * aLen + nx * aWidth };
  const aRight = { x: ax - ux * aLen + ny * aWidth, y: ay - uy * aLen - nx * aWidth };
  const aInner = { x: ax - ux * (aLen * 0.45), y: ay - uy * (aLen * 0.45) };

  return {
    tip: { x: ax, y: ay },
    left: aLeft,
    inner: aInner,
    right: aRight,
    pointsStr: `${Math.round(ax)},${Math.round(ay)} ${Math.round(aLeft.x)},${Math.round(aLeft.y)} ${Math.round(aInner.x)},${Math.round(aInner.y)} ${Math.round(aRight.x)},${Math.round(aRight.y)}`
  };
}

/**
 * Finds the nearest duct segment to a diffuser or target coordinate, for flex duct takeoff snapping.
 */
export function findNearestDuct(pt, ducts = [], toleranceCad = 1500) {
  if (!pt || !ducts || ducts.length === 0) return null;

  let closest = null;
  let minDist = toleranceCad;

  ducts.forEach((duct, idx) => {
    const p1 = duct.p1 ? { x: duct.p1[0], y: duct.p1[1] } : (duct.x !== undefined ? { x: duct.x, y: duct.y } : null);
    const p2 = duct.p2 ? { x: duct.p2[0], y: duct.p2[1] } : (duct.end_x !== undefined ? { x: duct.end_x, y: duct.end_y } : null);
    if (!p1 || !p2) return;

    // Project pt onto segment p1-p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) return;

    const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq));
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const dist = Math.hypot(pt.x - projX, pt.y - projY);

    if (dist < minDist) {
      minDist = dist;
      closest = {
        duct,
        index: idx,
        distance: dist,
        projectedPoint: { x: Math.round(projX), y: Math.round(projY) },
        t
      };
    }
  });

  return closest;
}

/**
 * Generates an organic S-curved flexible duct bezier path from duct takeoff to diffuser.
 */
export function generateFlexDuctPath(startPt, endPt) {
  if (!startPt || !endPt) return '';
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  
  // Cubic Bezier control points
  const cx1 = startPt.x + dx * 0.4;
  const cy1 = startPt.y;
  const cx2 = startPt.x + dx * 0.6;
  const cy2 = endPt.y;

  return `M ${Math.round(startPt.x)} ${Math.round(startPt.y)} C ${Math.round(cx1)} ${Math.round(cy1)}, ${Math.round(cx2)} ${Math.round(cy2)}, ${Math.round(endPt.x)} ${Math.round(endPt.y)}`;
}
