/**
 * dimensioningEngine.js
 * 
 * High-Precision Aligned, Linear & Continuous Chained CAD Dimensioning Engine.
 * Conforms to ANSI/ASME Y14.5 and ISO 129-1 architectural and MEP dimensioning standards.
 */

/**
 * Format linear dimension measurement into human-readable engineering unit string.
 * @param {number} distanceMm - Distance in millimeters
 * @param {string} unit - 'mm' | 'm' | 'ft_in'
 * @param {number} precision - Decimals
 * @returns {string}
 */
export function formatDimensionText(distanceMm, unit = 'mm', precision = 0) {
  if (distanceMm == null || isNaN(distanceMm)) return '0 mm';

  if (unit === 'm') {
    return `${(distanceMm / 1000).toFixed(2)} m`;
  } else if (unit === 'ft_in') {
    const totalInches = distanceMm / 25.4;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'-${inches}"`;
  } else {
    // Default millimeters
    const rounded = Math.round(distanceMm);
    return `${rounded.toLocaleString()} mm`;
  }
}

/**
 * Calculate standard architectural tick marks (45-degree angled slash).
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} dimAngleRad - Angle of the dimension line
 * @param {number} tickLength - Half length of tick (default 100mm)
 * @returns {{x1: number, y1: number, x2: number, y2: number}}
 */
export function calculateArchitecturalTick(x, y, dimAngleRad, tickLength = 100) {
  // Architectural tick is 45 degrees relative to dimension line or screen
  const tickAngle = dimAngleRad + Math.PI / 4;
  const dx = Math.cos(tickAngle) * tickLength;
  const dy = Math.sin(tickAngle) * tickLength;
  return {
    x1: x - dx,
    y1: y - dy,
    x2: x + dx,
    y2: y + dy
  };
}

/**
 * Compute geometry for an Aligned Dimension String between two points with normal offset.
 * 
 * @param {{x: number, y: number}} p1 - First point
 * @param {{x: number, y: number}} p2 - Second point
 * @param {number|{x: number, y: number}} offsetParam - Offset distance in mm or reference mouse point
 * @param {Object} options
 * @returns {Object} Complete dimension geometry ready for SVG rendering
 */
export function calculateAlignedDimension(p1, p2, offsetParam = 300, options = {}) {
  const {
    unit = 'mm',
    tickStyle = 'tick', // 'tick' | 'arrow' | 'dot'
    extOriginGap = 60,  // Gap between geometry and witness line start (mm)
    extOvershoot = 120, // Extension beyond dimension line (mm)
    tickLength = 90     // Half-length of 45-degree tick mark
  } = options;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 1) {
    return null; // Degenerate segment
  }

  // Unit vector along dimension line
  const ux = dx / distance;
  const uy = dy / distance;

  // Unit normal vector perpendicular to dimension line
  let nx = -uy;
  let ny = ux;

  let offsetDistance = 300;
  if (typeof offsetParam === 'number') {
    offsetDistance = offsetParam;
  } else if (offsetParam && typeof offsetParam.x === 'number') {
    // Project offset point onto normal vector
    const toPtX = offsetParam.x - p1.x;
    const toPtY = offsetParam.y - p1.y;
    offsetDistance = toPtX * nx + toPtY * ny;
  }

  // Adjust normal if offset is negative to keep offsetDistance positive
  const sign = offsetDistance >= 0 ? 1 : -1;
  const absOffset = Math.abs(offsetDistance);
  const effNx = nx * sign;
  const effNy = ny * sign;

  // Dimension line endpoints
  const dim1 = {
    x: p1.x + effNx * absOffset,
    y: p1.y + effNy * absOffset
  };
  const dim2 = {
    x: p2.x + effNx * absOffset,
    y: p2.y + effNy * absOffset
  };

  // Witness / Extension line 1 (from p1 out past dim1)
  const ext1 = {
    x1: p1.x + effNx * extOriginGap,
    y1: p1.y + effNy * extOriginGap,
    x2: dim1.x + effNx * extOvershoot,
    y2: dim1.y + effNy * extOvershoot
  };

  // Witness / Extension line 2 (from p2 out past dim2)
  const ext2 = {
    x1: p2.x + effNx * extOriginGap,
    y1: p2.y + effNy * extOriginGap,
    x2: dim2.x + effNx * extOvershoot,
    y2: dim2.y + effNy * extOvershoot
  };

  // Dimension line angle
  const angleRad = Math.atan2(dy, dx);
  let textAngleDeg = (angleRad * 180) / Math.PI;
  // Keep text upright for readability (-90 to +90 degrees)
  if (textAngleDeg > 90) {
    textAngleDeg -= 180;
  } else if (textAngleDeg < -90) {
    textAngleDeg += 180;
  }

  // Architectural tick marks
  const tick1 = calculateArchitecturalTick(dim1.x, dim1.y, angleRad, tickLength);
  const tick2 = calculateArchitecturalTick(dim2.x, dim2.y, angleRad, tickLength);

  // Text midpoint
  const midX = (dim1.x + dim2.x) / 2;
  const midY = (dim1.y + dim2.y) / 2;

  // Offset text slightly above dimension line
  const textOffset = 80;
  const textX = midX + effNx * textOffset;
  const textY = midY + effNy * textOffset;

  return {
    id: `dim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: 'aligned',
    p1: { x: p1.x, y: p1.y },
    p2: { x: p2.x, y: p2.y },
    offsetDistance: absOffset * sign,
    distance_mm: Math.round(distance),
    label: formatDimensionText(distance, unit),
    dim1,
    dim2,
    ext1,
    ext2,
    tick1,
    tick2,
    // Flattened compatibility properties
    dim_x1: dim1.x,
    dim_y1: dim1.y,
    dim_x2: dim2.x,
    dim_y2: dim2.y,
    ext1_x1: ext1.x1,
    ext1_y1: ext1.y1,
    ext1_x2: ext1.x2,
    ext1_y2: ext1.y2,
    ext2_x1: ext2.x1,
    ext2_y1: ext2.y1,
    ext2_x2: ext2.x2,
    ext2_y2: ext2.y2,
    tick1_x1: tick1.x1,
    tick1_y1: tick1.y1,
    tick1_x2: tick1.x2,
    tick1_y2: tick1.y2,
    tick2_x1: tick2.x1,
    tick2_y1: tick2.y1,
    tick2_x2: tick2.x2,
    tick2_y2: tick2.y2,
    label_x: textX,
    label_y: textY,
    textPosition: { x: textX, y: textY },
    textAngle: textAngleDeg,
    normal: { x: effNx, y: effNy },
    direction: { x: ux, y: uy },
    unit,
    tickStyle
  };
}

/**
 * Continuous / Chain Dimension Continuation (AutoCAD DIMCONTINUE).
 * Takes an existing dimension segment and chains the next point along the exact same baseline!
 * 
 * @param {Object} prevDim - The preceding dimension in the chain
 * @param {{x: number, y: number}} nextPoint - The next point to chain to
 * @param {Object} options
 * @returns {Object}
 */
export function chainDimensionContinuation(prevDim, nextPoint, options = {}) {
  if (!prevDim || !prevDim.p2 || !nextPoint) return null;

  const p1 = prevDim.p2; // Chain starts from end of previous
  const p2 = nextPoint;

  return calculateAlignedDimension(p1, p2, prevDim.offsetDistance, {
    ...options,
    unit: prevDim.unit || options.unit || 'mm',
    tickStyle: prevDim.tickStyle || options.tickStyle || 'tick'
  });
}

/**
 * Auto-generate exterior dimension strings along all exterior room perimeter edges.
 * Standard architectural documentation package:
 * Generates continuous dimension chains with automatic outward witness lines.
 * 
 * @param {Array<{x: number, y: number}>} polygonPoints - Room polygon vertices
 * @param {number} offsetDistanceMm - Offset distance from exterior face (e.g. 600mm)
 * @returns {Array<Object>} List of dimension objects
 */
export function generateExteriorWallDimensions(polygonPoints, offsetDistanceMm = 600) {
  if (!polygonPoints || polygonPoints.length < 3) return [];

  // Determine polygon winding order (shoelace formula)
  let shoelaceSum = 0;
  const n = polygonPoints.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    shoelaceSum += (polygonPoints[j].x - polygonPoints[i].x) * (polygonPoints[j].y + polygonPoints[i].y);
  }
  // If shoelaceSum > 0, points are clockwise; if < 0, counter-clockwise
  const isClockwise = shoelaceSum > 0;

  const dimensions = [];
  for (let i = 0; i < n; i++) {
    const p1 = polygonPoints[i];
    const p2 = polygonPoints[(i + 1) % n];

    // Compute outward normal
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 50) continue; // Skip microscopic edges

    // Outward normal:
    // For CCW winding: normal = (dy / len, -dx / len)
    // For CW winding: normal = (-dy / len, dx / len)
    const effOffset = isClockwise ? -offsetDistanceMm : offsetDistanceMm;

    const dim = calculateAlignedDimension(p1, p2, effOffset, {
      unit: 'mm',
      tickStyle: 'tick',
      extOriginGap: 80,
      extOvershoot: 150
    });

    if (dim) {
      dimensions.push(dim);
    }
  }

  return dimensions;
}
