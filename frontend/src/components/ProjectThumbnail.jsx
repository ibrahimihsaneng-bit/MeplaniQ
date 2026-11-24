import React, { useMemo } from 'react';

/**
 * ProjectThumbnail.jsx
 * ====================
 * High-performance 2D CAD mini-preview rendered using pure SVG.
 * Generates an architectural footprint thumbnail from the project's room boundary coordinates.
 */
export default function ProjectThumbnail({
  previewRooms = [],
  disciplines = [],
  aspectRatio = "16/9",
  className = ""
}) {
  const { viewBox, validPolygons, hasValidGeometry } = useMemo(() => {
    if (!previewRooms || !Array.isArray(previewRooms) || previewRooms.length === 0) {
      return { viewBox: "0 0 1000 600", validPolygons: [], hasValidGeometry: false };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const polys = [];

    previewRooms.forEach((rm, rIdx) => {
      const rawPts = rm.points || rm.filleted_points || [];
      if (!Array.isArray(rawPts) || rawPts.length < 3) return;

      const normPts = [];
      rawPts.forEach(pt => {
        const x = Array.isArray(pt) ? pt[0] : pt.x;
        const y = Array.isArray(pt) ? pt[1] : pt.y;
        if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          normPts.push([x, y]);
        }
      });

      if (normPts.length >= 3) {
        polys.push({
          name: rm.name || `Room ${rIdx + 1}`,
          pts: normPts,
          pointsStr: normPts.map(p => `${p[0]},${p[1]}`).join(' ')
        });
      }
    });

    if (polys.length === 0 || minX === Infinity || maxX === -Infinity || maxX <= minX || maxY <= minY) {
      return { viewBox: "0 0 1000 600", validPolygons: [], hasValidGeometry: false };
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const padX = spanX * 0.12;
    const padY = spanY * 0.12;

    const vbX = minX - padX;
    const vbY = minY - padY;
    const vbW = spanX + padX * 2;
    const vbH = spanY + padY * 2;

    return {
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      validPolygons: polys,
      hasValidGeometry: true,
      vbW,
      vbH
    };
  }, [previewRooms]);

  const hasHvac = disciplines.includes("HVAC");
  const hasPlumbing = disciplines.includes("Plumbing");
  const hasElectrical = disciplines.includes("Electrical");

  return (
    <div
      className={`project-thumbnail-wrapper ${className}`}
      style={{
        width: '100%',
        aspectRatio: aspectRatio,
        backgroundColor: '#090D16',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}
    >
      {/* Background CAD Technical Grid Pattern */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="thumb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#thumb-grid)" />
      </svg>

      {hasValidGeometry ? (
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            transform: 'scaleY(-1)', // Flip Y so standard CAD Cartesian (Y up) renders upright
            padding: '8px'
          }}
        >
          {/* Room polygons */}
          {validPolygons.map((poly, idx) => {
            const colors = [
              { fill: 'rgba(56, 189, 248, 0.12)', stroke: '#38BDF8' },
              { fill: 'rgba(129, 140, 248, 0.12)', stroke: '#818CF8' },
              { fill: 'rgba(52, 211, 153, 0.12)', stroke: '#34D399' },
              { fill: 'rgba(251, 146, 60, 0.12)', stroke: '#FB923C' }
            ];
            const c = colors[idx % colors.length];

            return (
              <g key={`thumb-poly-${idx}`}>
                <polygon
                  points={poly.pointsStr}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth="80" // Scales with typical 10000mm floorplans
                  strokeLinejoin="round"
                />
                {/* Vertex pins */}
                {poly.pts.map((pt, pIdx) => (
                  <circle
                    key={`v-${pIdx}`}
                    cx={pt[0]}
                    cy={pt[1]}
                    r="45"
                    fill={c.stroke}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      ) : (
        /* Empty / Conceptual Blueprint Illustration */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748B' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px dashed rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8',
              fontSize: '18px'
            }}
          >
            📐
          </div>
          <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em', color: '#64748B' }}>
            Parametric CAD Blueprint
          </span>
        </div>
      )}

      {/* Floating Discipline Micro-Badges on top right of thumbnail */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px',
          zIndex: 2
        }}
      >
        {hasHvac && (
          <span
            title="HVAC Air Ductwork Included"
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(6, 182, 212, 0.25)',
              border: '1px solid #06B6D4',
              color: '#67E8F9'
            }}
          >
            HVAC
          </span>
        )}
        {hasPlumbing && (
          <span
            title="Hydraulic Plumbing Piping Included"
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(14, 165, 233, 0.25)',
              border: '1px solid #0EA5E9',
              color: '#7DD3FC'
            }}
          >
            PLUMB
          </span>
        )}
        {hasElectrical && (
          <span
            title="Electrical Branch Circuit Routing Included"
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(245, 158, 11, 0.25)',
              border: '1px solid #F59E0B',
              color: '#FDE68A'
            }}
          >
            ELEC
          </span>
        )}
      </div>

      {/* CAD Watermark pill on bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '8px',
          fontSize: '9px',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.45)',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          padding: '1px 6px',
          borderRadius: '3px',
          pointerEvents: 'none'
        }}
      >
        2D VECTOR FOOTPRINT
      </div>
    </div>
  );
}
