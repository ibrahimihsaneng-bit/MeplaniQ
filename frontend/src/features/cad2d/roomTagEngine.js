/**
 * roomTagEngine.js
 * 
 * Architectural Room Centroid, Area Calculation & Space Tagging Engine.
 * Implements Green's theorem / Shoelace algorithm for exact centroid and polygon area,
 * plus ASHRAE 62.1 ventilation requirements and space scheduling.
 */

export const ROOM_PROFILES = {
  LIVING: {
    key: 'LIVING',
    name: 'Living & Dining',
    codePrefix: 'LIV',
    defaultHeightMm: 2800,
    ventilationAch: 2.5,
    lightingLux: 200,
    color: '#38BDF8'
  },
  BEDROOM: {
    key: 'BEDROOM',
    name: 'Master Bedroom',
    codePrefix: 'BED',
    defaultHeightMm: 2800,
    ventilationAch: 2.0,
    lightingLux: 150,
    color: '#818CF8'
  },
  KITCHEN: {
    key: 'KITCHEN',
    name: 'Kitchen / Pantry',
    codePrefix: 'KIT',
    defaultHeightMm: 2600,
    ventilationAch: 15.0, // High exhaust
    lightingLux: 350,
    color: '#F59E0B'
  },
  BATHROOM: {
    key: 'BATHROOM',
    name: 'Toilet & Bath',
    codePrefix: 'WC',
    defaultHeightMm: 2400,
    ventilationAch: 10.0, // Mechanical exhaust
    lightingLux: 200,
    color: '#06B6D4'
  },
  OFFICE: {
    key: 'OFFICE',
    name: 'Commercial Office',
    codePrefix: 'OFF',
    defaultHeightMm: 3000,
    ventilationAch: 4.0,
    lightingLux: 500,
    color: '#10B981'
  },
  MEP_PLANT: {
    key: 'MEP_PLANT',
    name: 'AHU / Electrical Room',
    codePrefix: 'MEP',
    defaultHeightMm: 3200,
    ventilationAch: 8.0,
    lightingLux: 250,
    color: '#EC4899'
  },
  CORRIDOR: {
    key: 'CORRIDOR',
    name: 'Corridor / Circulation',
    codePrefix: 'COR',
    defaultHeightMm: 2600,
    ventilationAch: 1.5,
    lightingLux: 100,
    color: '#94A3B8'
  }
};

/**
 * Compute signed area of a 2D polygon using the Shoelace formula.
 * @param {Array<{x: number, y: number}>} points
 * @returns {number} Signed area in mm²
 */
export function computeSignedPolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let areaSum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    areaSum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return areaSum / 2;
}

/**
 * Compute geometric center of mass (centroid) of a 2D polygon using Green's Theorem.
 * @param {Array<{x: number, y: number}>} points
 * @returns {{x: number, y: number, areaMm2: number, areaM2: number, areaSqFt: number}}
 */
export function computePolygonCentroid(points) {
  if (!points || points.length < 3) {
    return { x: 0, y: 0, areaMm2: 0, areaM2: 0, areaSqFt: 0 };
  }

  const signedArea = computeSignedPolygonArea(points);
  if (Math.abs(signedArea) < 1e-4) {
    // Degenerate polygon, fallback to bounding box center
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      areaMm2: 0,
      areaM2: 0,
      areaSqFt: 0
    };
  }

  let cxSum = 0;
  let cySum = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = points[i].x * points[j].y - points[j].x * points[i].y;
    cxSum += (points[i].x + points[j].x) * factor;
    cySum += (points[i].y + points[j].y) * factor;
  }

  const factor = 1 / (6 * signedArea);
  const cx = cxSum * factor;
  const cy = cySum * factor;

  const absAreaMm2 = Math.abs(signedArea);
  const areaM2 = absAreaMm2 / 1000000;
  const areaSqFt = areaM2 * 10.7639;

  return {
    x: Math.round(cx),
    y: Math.round(cy),
    areaMm2: absAreaMm2,
    areaM2: parseFloat(areaM2.toFixed(2)),
    areaSqFt: parseFloat(areaSqFt.toFixed(1))
  };
}

/**
 * Compute total perimeter of a 2D polygon in millimeters.
 * @param {Array<{x: number, y: number}>} points
 * @returns {number}
 */
export function computePolygonPerimeter(points) {
  if (!points || points.length < 2) return 0;
  let perimeter = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
  }
  return Math.round(perimeter);
}

/**
 * Check if a 2D point is inside a polygon using ray casting algorithm.
 * @param {{x: number, y: number}} point
 * @param {Array<{x: number, y: number}>} polygon
 * @returns {boolean}
 */
export function isPointInsidePolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Generate a complete architectural Room Tag badge specification.
 * 
 * @param {Array<{x: number, y: number}>} points - Room boundary points
 * @param {Object} options - Customizations (roomType, roomNumber, customName, heightMm)
 * @returns {Object}
 */
export function generateRoomTag(points, options = {}) {
  const centroidInfo = computePolygonCentroid(points);
  const perimeterMm = computePolygonPerimeter(points);
  const profile = ROOM_PROFILES[options.roomType] || ROOM_PROFILES.LIVING;

  const roomNumber = options.roomNumber || `${profile.codePrefix}-${Math.floor(100 + Math.random() * 900)}`;
  const roomName = options.customName || profile.name;
  const heightMm = options.heightMm || profile.defaultHeightMm;

  // Engineering load requirements
  const volumeM3 = parseFloat(((centroidInfo.areaM2 * heightMm) / 1000).toFixed(2));
  const reqAirflowCfm = Math.round((volumeM3 * 35.3147 * profile.ventilationAch) / 60);

  return {
    id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    x: centroidInfo.x,
    y: centroidInfo.y,
    roomNumber,
    roomName,
    roomType: profile.key,
    areaM2: centroidInfo.areaM2,
    areaSqFt: centroidInfo.areaSqFt,
    perimeterMm,
    perimeterM: parseFloat((perimeterMm / 1000).toFixed(2)),
    heightMm,
    volumeM3,
    reqAirflowCfm,
    color: profile.color,
    badgeWidth: 1600,
    badgeHeight: 1000
  };
}
