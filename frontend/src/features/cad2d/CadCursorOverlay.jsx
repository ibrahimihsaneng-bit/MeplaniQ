import React from 'react';
import { OSNAP_TYPES } from './osnapEngine';
import { formatCadLength, formatCadAngle } from './cadDrawingUtils';

/**
 * CadCursorOverlay.jsx
 * ====================
 * Renders high-precision CAD drafting overlays directly inside the transformed SVG:
 *  - OSNAP Magnetic Glyphs (Square, Triangle, Perpendicular, Intersection)
 *  - Rubber-Band Wall / Pipe Drafting Polyline
 *  - Live Dynamic Dimension and Angle Readout HUD
 *  - Wall Closure Snap Target
 *  - Door / Window Live Wall-Hosting Previews
 */
export default function CadCursorOverlay({
  zoom = 1,
  cursorPt,
  osnapPt,
  activeTool = 'select',
  draftingState,
  closestWall,
  doorConfig = { width: 900, flipSwing: false, flipHinge: false },
  windowConfig = { width: 1200 }
}) {
  const glyphSize = 14 / zoom;
  const halfGlyph = glyphSize / 2;

  return (
    <g id="CAD_DYNAMIC_OVERLAY" style={{ pointerEvents: 'none' }}>
      {/* 1. OSNAP MAGNETIC GLYPH */}
      {osnapPt && (
        <g transform={`translate(${osnapPt.point.x}, ${osnapPt.point.y})`}>
          {osnapPt.type === OSNAP_TYPES.ENDPOINT && (
            <rect
              x={-halfGlyph}
              y={-halfGlyph}
              width={glyphSize}
              height={glyphSize}
              fill="none"
              stroke="#10B981"
              strokeWidth={2 / zoom}
            />
          )}

          {osnapPt.type === OSNAP_TYPES.MIDPOINT && (
            <polygon
              points={`0,${halfGlyph} ${-halfGlyph},${-halfGlyph} ${halfGlyph},${-halfGlyph}`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2 / zoom}
            />
          )}

          {osnapPt.type === OSNAP_TYPES.INTERSECTION && (
            <g stroke="#F59E0B" strokeWidth={2 / zoom}>
              <line x1={-halfGlyph} y1={-halfGlyph} x2={halfGlyph} y2={halfGlyph} />
              <line x1={-halfGlyph} y1={halfGlyph} x2={halfGlyph} y2={-halfGlyph} />
            </g>
          )}

          {osnapPt.type === OSNAP_TYPES.PERPENDICULAR && (
            <g stroke="#EC4899" strokeWidth={2 / zoom}>
              <line x1={-halfGlyph} y1={halfGlyph} x2={halfGlyph} y2={halfGlyph} />
              <line x1={0} y1={halfGlyph} x2={0} y2={-halfGlyph} />
              <polyline points={`0,0 ${halfGlyph * 0.6},0 ${halfGlyph * 0.6},${halfGlyph * 0.6}`} fill="none" />
            </g>
          )}

          {osnapPt.type === OSNAP_TYPES.GRID && (
            <circle cx="0" cy="0" r={3 / zoom} fill="#94A3B8" />
          )}

          {/* OSNAP Type Label */}
          <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(${halfGlyph + 8}, -6)`}>
            <rect
              x="0"
              y="0"
              width={osnapPt.label.length * 6.5 + 10}
              height="15"
              rx="3"
              fill="rgba(15, 23, 42, 0.9)"
              stroke={osnapPt.color}
              strokeWidth="1"
            />
            <text x="5" y="11" fill="#F8FAFC" fontSize="9" fontWeight="700">
              {osnapPt.label}
            </text>
          </g>
        </g>
      )}

      {/* 2. LIVE DRAFTING RUBBER-BAND (WALLS & PIPES) */}
      {draftingState?.active && draftingState.points?.length > 0 && cursorPt && (
        <g id="DRAFTING_RUBBERBAND">
          {/* Established multi-segment vertices */}
          {draftingState.points.map((pt, idx) => {
            if (idx === 0) return null;
            const prev = draftingState.points[idx - 1];
            return (
              <line
                key={`draft-seg-${idx}`}
                x1={prev.x}
                y1={prev.y}
                x2={pt.x}
                y2={pt.y}
                stroke="#38BDF8"
                strokeWidth={2.5 / zoom}
              />
            );
          })}

          {/* Active stretching segment from last point to cursor */}
          {(() => {
            const lastPt = draftingState.points[draftingState.points.length - 1];
            const targetPt = cursorPt;
            const dx = targetPt.x - lastPt.x;
            const dy = targetPt.y - lastPt.y;
            const len = Math.hypot(dx, dy);
            const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
            const midX = (lastPt.x + targetPt.x) / 2;
            const midY = (lastPt.y + targetPt.y) / 2;

            const isClosing = draftingState.isNearStart;

            return (
              <>
                {/* Rubber-band Line */}
                <line
                  x1={lastPt.x}
                  y1={lastPt.y}
                  x2={targetPt.x}
                  y2={targetPt.y}
                  stroke={isClosing ? '#10B981' : '#38BDF8'}
                  strokeWidth={2.5 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                />

                {/* Wall thickness ghost preview */}
                {activeTool === 'wall' && len > 50 && (
                  (() => {
                    const halfT = 100; // 200mm wall
                    const nx = (-dy / len) * halfT;
                    const ny = (dx / len) * halfT;
                    const polyPts = [
                      `${lastPt.x + nx},${lastPt.y + ny}`,
                      `${targetPt.x + nx},${targetPt.y + ny}`,
                      `${targetPt.x - nx},${targetPt.y - ny}`,
                      `${lastPt.x - nx},${lastPt.y - ny}`
                    ].join(' ');
                    return (
                      <polygon
                        points={polyPts}
                        fill="rgba(56, 189, 248, 0.15)"
                        stroke="rgba(56, 189, 248, 0.5)"
                        strokeWidth={1 / zoom}
                      />
                    );
                  })()
                )}

                {/* Dynamic HUD Tag at Midpoint */}
                <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                  <rect
                    x="-65"
                    y="-12"
                    width="130"
                    height="24"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke={isClosing ? '#10B981' : '#38BDF8'}
                    strokeWidth="1.2"
                  />
                  <text x="0" y="4" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="700">
                    <tspan fill="#FACC15">{formatCadLength(len)}</tspan>
                    <tspan fill="#94A3B8"> • </tspan>
                    <tspan fill="#38BDF8">{formatCadAngle(angleDeg)}</tspan>
                  </text>
                </g>

                {/* Closing Room Indicator */}
                {isClosing && (
                  <g transform={`translate(${targetPt.x}, ${targetPt.y}) scale(${1 / zoom}, ${-1 / zoom}) translate(16, -16)`}>
                    <rect x="0" y="0" width="120" height="20" rx="4" fill="#065F46" stroke="#34D399" strokeWidth="1" />
                    <text x="60" y="14" textAnchor="middle" fill="#A7F3D0" fontSize="9.5" fontWeight="800">
                      ✓ CLOSE ROOM LOOP
                    </text>
                  </g>
                )}
              </>
            );
          })()}
        </g>
      )}

      {/* 3. SMART WALL-HOSTED DOOR PREVIEW */}
      {activeTool === 'door' && closestWall && (
        <g id="DOOR_WALL_PREVIEW" transform={`translate(${closestWall.projectedPoint.x}, ${closestWall.projectedPoint.y}) rotate(${closestWall.angleDeg})`}>
          {(() => {
            const w = doorConfig.width || 900;
            const halfW = w / 2;
            const swingDir = doorConfig.flipSwing ? -1 : 1;
            const hingeSide = doorConfig.flipHinge ? -1 : 1;

            return (
              <>
                {/* Wall Cleavage Highlight */}
                <rect
                  x={-halfW}
                  y="-110"
                  width={w}
                  height="220"
                  fill="rgba(245, 158, 11, 0.25)"
                  stroke="#F59E0B"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                />

                {/* Jambs */}
                <rect x={-halfW} y="-100" width="50" height="200" fill="#F59E0B" />
                <rect x={halfW - 50} y="-100" width="50" height="200" fill="#F59E0B" />

                {/* Leaf and 90° Swing Arc */}
                <g transform={`translate(${hingeSide === 1 ? -halfW : halfW}, 0)`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={swingDir * w}
                    stroke="#F59E0B"
                    strokeWidth={2.5 / zoom}
                  />
                  {/* Arc */}
                  <path
                    d={`M ${hingeSide * w} 0 A ${w} ${w} 0 0 ${swingDir === 1 ? (hingeSide === 1 ? 0 : 1) : (hingeSide === 1 ? 1 : 0)} 0 ${swingDir * w}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                  />
                </g>

                {/* Info Badge */}
                <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(0, -60)`}>
                  <rect x="-80" y="-10" width="160" height="20" rx="4" fill="#0F172A" stroke="#F59E0B" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#FDE68A" fontSize="9" fontWeight="700">
                    DOOR {w}mm [F:Flip / Space:Hinge]
                  </text>
                </g>
              </>
            );
          })()}
        </g>
      )}

      {/* 4. SMART WALL-HOSTED WINDOW PREVIEW */}
      {activeTool === 'window' && closestWall && (
        <g id="WINDOW_WALL_PREVIEW" transform={`translate(${closestWall.projectedPoint.x}, ${closestWall.projectedPoint.y}) rotate(${closestWall.angleDeg})`}>
          {(() => {
            const w = windowConfig.width || 1200;
            const halfW = w / 2;
            return (
              <>
                {/* Wall Opening */}
                <rect
                  x={-halfW}
                  y="-100"
                  width={w}
                  height="200"
                  fill="rgba(14, 165, 233, 0.25)"
                  stroke="#0EA5E9"
                  strokeWidth={2 / zoom}
                />
                {/* Glazing Panes */}
                <line x1={-halfW} y1="-30" x2={halfW} y2="-30" stroke="#38BDF8" strokeWidth={2 / zoom} />
                <line x1={-halfW} y1="30" x2={halfW} y2="30" stroke="#38BDF8" strokeWidth={2 / zoom} />
                {/* Sill */}
                <line x1={-halfW - 50} y1="105" x2={halfW + 50} y2="105" stroke="#FFFFFF" strokeWidth={2.5 / zoom} />

                {/* Info Badge */}
                <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(0, -50)`}>
                  <rect x="-70" y="-10" width="140" height="20" rx="4" fill="#0F172A" stroke="#0EA5E9" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#BAE6FD" fontSize="9" fontWeight="700">
                    WINDOW {w}mm [Click to Place]
                  </text>
                </g>
              </>
            );
          })()}
        </g>
      )}
    </g>
  );
}
