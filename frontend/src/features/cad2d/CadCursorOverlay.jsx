import React from 'react';
import { OSNAP_TYPES } from './osnapEngine';
import { formatCadLength, formatCadAngle } from './cadDrawingUtils';
import { PLUMBING_SYSTEMS, generateOrthogonalPath, calculatePipeMetrics } from './pipeRoutingEngine';
import {
  HVAC_DUCT_SYSTEMS,
  HVAC_DIFFUSER_TYPES,
  calculateDuctVelocity,
  computeDuctSegmentCorners,
  formatPolygonPoints,
  computeAirflowChevron,
  generateFlexDuctPath
} from './ductRoutingEngine';
import {
  CONDUIT_TYPES,
  WIRE_GAUGES,
  calculateCircuitLoading,
  generateHomerunLeader
} from './electricalRoutingEngine';

/**
 * CadCursorOverlay.jsx
 * ====================
 * Renders high-precision CAD drafting overlays directly inside the transformed SVG:
 *  - OSNAP Magnetic Glyphs (Square, Triangle, Perpendicular, Intersection)
 *  - Rubber-Band Wall & Pipe Drafting Polylines with 90° Orthogonal Elbows
 *  - Interactive 2D HVAC Ductwork Rubber-Band (SMACNA Compliant Double-Line & Velocity HUD)
 *  - Ceiling Diffuser Air Throw Radius & Flex Duct Takeoff Previews
 *  - Interactive 2D Electrical Conduit Routing & Homerun Arrow Generation
 *  - Electrical Terminal Magnetic Port Snapping & Voltage Drop HUD
 *  - Fixture Connection Port Magnetic Snapping Rings
 *  - Live Dynamic Pipe Length, Diameter, Fall & Slope HUD
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
  windowConfig = { width: 1200 },
  // Plumbing Engine Props
  fixturePorts = [],
  snappedPort = null,
  pipeSystem = 'CW',
  pipeDiameter = 25,
  pipeSlopeRatio = 0.02,
  // HVAC Engine Props
  hvacToolMode = 'duct',
  ductSystem = 'SUPPLY',
  ductWidth = 400,
  ductHeight = 250,
  ductCfm = 400,
  diffuserType = 'SUPPLY_4WAY',
  diffuserCfm = 150,
  nearestDuctTakeoff = null,
  // Electrical Engine Props
  electricalPorts = [],
  snappedElectricalPort = null,
  electricalToolMode = 'component',
  conduitType = 'SLAB',
  wireGauge = '2.5',
  activeCircuitId = 'CKT-1',
  nearestDbPort = null,
  selectedElectricalFixtureType = 'recessed_downlight'
}) {
  const glyphSize = 14 / zoom;
  const halfGlyph = glyphSize / 2;
  const currentSys = PLUMBING_SYSTEMS[pipeSystem] || PLUMBING_SYSTEMS.CW;

  return (
    <g id="CAD_DYNAMIC_OVERLAY" style={{ pointerEvents: 'none' }}>
      {/* 1. PLUMBING FIXTURE CONNECTION PORTS (When activeTool === 'plumbing') */}
      {activeTool === 'plumbing' && fixturePorts.map(port => {
        const isSnapped = snappedPort?.id === port.id;
        const r = (isSnapped ? 12 : 7) / zoom;
        const color = port.color || '#0284C7';

        return (
          <g key={port.id} transform={`translate(${port.point.x}, ${port.point.y})`}>
            {/* Outer halo */}
            <circle
              cx="0"
              cy="0"
              r={r}
              fill={color}
              fillOpacity={isSnapped ? 0.95 : 0.55}
              stroke="#FFFFFF"
              strokeWidth={(isSnapped ? 2.5 : 1.5) / zoom}
            />
            {/* Inner core */}
            <circle cx="0" cy="0" r={r * 0.4} fill="#FFFFFF" />

            {/* Target Ring if Snapped */}
            {isSnapped && (
              <circle
                cx="0"
                cy="0"
                r={r * 1.6}
                fill="none"
                stroke={color}
                strokeWidth={1.8 / zoom}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              />
            )}

            {/* Snapped Port Tooltip Badge */}
            {isSnapped && (
              <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(16, -12)`}>
                <rect
                  x="0"
                  y="0"
                  width={port.label.length * 6.5 + 24}
                  height="22"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.95)"
                  stroke={color}
                  strokeWidth="1.2"
                />
                <text x="8" y="15" fill="#FFFFFF" fontSize="9.5" fontWeight="700">
                  ⚡ {port.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 1B. ELECTRICAL COMPONENT CONNECTION PORTS (When activeTool === 'electrical') */}
      {activeTool === 'electrical' && electricalPorts.map(port => {
        const isSnapped = snappedElectricalPort?.id === port.id;
        const r = (isSnapped ? 13 : (port.isDb ? 11 : 7.5)) / zoom;
        const color = port.color || '#F59E0B';

        return (
          <g key={port.id} transform={`translate(${port.point.x}, ${port.point.y})`}>
            <circle
              cx="0"
              cy="0"
              r={r}
              fill={color}
              fillOpacity={isSnapped ? 0.95 : 0.55}
              stroke="#FFFFFF"
              strokeWidth={(isSnapped ? 2.5 : 1.5) / zoom}
            />
            <circle cx="0" cy="0" r={r * 0.4} fill="#FFFFFF" />

            {isSnapped && (
              <circle
                cx="0"
                cy="0"
                r={r * 1.6}
                fill="none"
                stroke={color}
                strokeWidth={1.8 / zoom}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              />
            )}

            {isSnapped && (
              <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(16, -12)`}>
                <rect
                  x="0"
                  y="0"
                  width={port.label.length * 6.8 + 24}
                  height="22"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.95)"
                  stroke={color}
                  strokeWidth="1.2"
                />
                <text x="8" y="15" fill="#FFFFFF" fontSize="9.5" fontWeight="700">
                  {port.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 2. OSNAP MAGNETIC GLYPH */}
      {osnapPt && !snappedPort && (
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

      {/* 3. LIVE PIPE ROUTING RUBBER-BAND (ORTHOGONAL 90° ELBOWS) */}
      {draftingState?.active && draftingState.tool === 'pipe' && draftingState.points?.length > 0 && cursorPt && (
        <g id="DRAFTING_PIPE_RUBBERBAND">
          {(() => {
            const lastPt = draftingState.points[draftingState.points.length - 1];
            const targetPt = snappedPort ? snappedPort.point : cursorPt;
            const orthoPath = generateOrthogonalPath(lastPt, targetPt);
            const allPoints = [...draftingState.points.slice(0, -1), ...orthoPath];
            const metrics = calculatePipeMetrics(allPoints, pipeSystem, pipeSlopeRatio);

            const strokeW = Math.max(3 / zoom, (pipeDiameter || 25) / 8);
            const sysColor = currentSys.color;

            return (
              <>
                {/* Established Pipe Segments */}
                {draftingState.points.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = draftingState.points[idx - 1];
                  return (
                    <line
                      key={`pipe-fixed-${idx}`}
                      x1={prev.x}
                      y1={prev.y}
                      x2={pt.x}
                      y2={pt.y}
                      stroke={sysColor}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Live stretching orthogonal segments with elbows */}
                {orthoPath.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = orthoPath[idx - 1];
                  return (
                    <line
                      key={`pipe-ortho-${idx}`}
                      x1={prev.x}
                      y1={prev.y}
                      x2={pt.x}
                      y2={pt.y}
                      stroke={sysColor}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                    />
                  );
                })}

                {/* 90° Elbow fitting circles at corners */}
                {allPoints.slice(1, -1).map((pt, idx) => (
                  <circle
                    key={`pipe-elbow-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={strokeW * 1.4}
                    fill={sysColor}
                    stroke="#FFFFFF"
                    strokeWidth={1.2 / zoom}
                  />
                ))}

                {/* Dynamic Pipe HUD Tag at Endpoint / Midpoint */}
                {(() => {
                  const midX = (lastPt.x + targetPt.x) / 2;
                  const midY = (lastPt.y + targetPt.y) / 2;
                  const isDrain = pipeSystem === 'DRAIN';

                  return (
                    <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect
                        x="-100"
                        y="-16"
                        width="200"
                        height="32"
                        rx="5"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke={sysColor}
                        strokeWidth="1.5"
                      />
                      <text x="0" y="-3" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="800">
                        {currentSys.icon} {currentSys.id} • ⌀{pipeDiameter}mm • {formatCadLength(metrics.totalLengthMm)}
                      </text>
                      <text x="0" y="10" textAnchor="middle" fill={isDrain ? "#34D399" : "#38BDF8"} fontSize="8.5" fontWeight="600">
                        {isDrain ? `Slope ${metrics.slopeStr} (Fall: ${metrics.fallMm}mm) • ${metrics.elbowsCount} Elbows` : `${metrics.elbowsCount} Elbows • Ortho Route`}
                      </text>
                    </g>
                  );
                })()}
              </>
            );
          })()}
        </g>
      )}

      {/* 4. LIVE WALL DRAFTING RUBBER-BAND */}
      {draftingState?.active && draftingState.tool === 'wall' && draftingState.points?.length > 0 && cursorPt && (
        <g id="DRAFTING_WALL_RUBBERBAND">
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
                <line
                  x1={lastPt.x}
                  y1={lastPt.y}
                  x2={targetPt.x}
                  y2={targetPt.y}
                  stroke={isClosing ? '#10B981' : '#38BDF8'}
                  strokeWidth={2.5 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                />

                {len > 50 && (
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

      {/* 5. SMART WALL-HOSTED DOOR PREVIEW */}
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

      {/* 6. SMART WALL-HOSTED WINDOW PREVIEW */}
      {activeTool === 'window' && closestWall && (
        <g id="WINDOW_WALL_PREVIEW" transform={`translate(${closestWall.projectedPoint.x}, ${closestWall.projectedPoint.y}) rotate(${closestWall.angleDeg})`}>
          {(() => {
            const w = windowConfig.width || 1200;
            const halfW = w / 2;
            return (
              <>
                <rect
                  x={-halfW}
                  y="-100"
                  width={w}
                  height="200"
                  fill="rgba(14, 165, 233, 0.25)"
                  stroke="#0EA5E9"
                  strokeWidth={2 / zoom}
                />
                <line x1={-halfW} y1="-30" x2={halfW} y2="-30" stroke="#38BDF8" strokeWidth={2 / zoom} />
                <line x1={-halfW} y1="30" x2={halfW} y2="30" stroke="#38BDF8" strokeWidth={2 / zoom} />
                <line x1={-halfW - 50} y1="105" x2={halfW + 50} y2="105" stroke="#FFFFFF" strokeWidth={2.5 / zoom} />

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

      {/* 7. LIVE HVAC DUCTWORK ROUTING RUBBER-BAND */}
      {draftingState?.active && draftingState.tool === 'duct' && draftingState.points?.length > 0 && cursorPt && (
        <g id="DRAFTING_HVAC_DUCT_RUBBERBAND">
          {(() => {
            const currentDuctSys = HVAC_DUCT_SYSTEMS[ductSystem] || HVAC_DUCT_SYSTEMS.SUPPLY;
            const ductColor = currentDuctSys.color;
            const ductFill = currentDuctSys.fillColor;
            const w = ductWidth || 400;
            const h = ductHeight || 250;
            const cfm = ductCfm || 400;
            const velMetrics = calculateDuctVelocity(cfm, w, h);

            const lastPt = draftingState.points[draftingState.points.length - 1];
            const targetPt = cursorPt;
            const orthoPath = generateOrthogonalPath(lastPt, targetPt);
            const allPoints = [...draftingState.points.slice(0, -1), ...orthoPath];

            // Calculate total duct path length
            let totalLengthMm = 0;
            for (let i = 0; i < allPoints.length - 1; i++) {
              totalLengthMm += Math.hypot(allPoints[i + 1].x - allPoints[i].x, allPoints[i + 1].y - allPoints[i].y);
            }

            return (
              <>
                {/* 1. Established Multi-Segment Duct Bodies */}
                {draftingState.points.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = draftingState.points[idx - 1];
                  const corners = computeDuctSegmentCorners(prev, pt, w);
                  const chevron = computeAirflowChevron(prev, pt, w);
                  if (!corners) return null;

                  return (
                    <g key={`fixed-duct-${idx}`}>
                      <polygon
                        points={formatPolygonPoints(corners)}
                        fill={ductFill}
                        stroke={ductColor}
                        strokeWidth={2 / zoom}
                        strokeLinejoin="miter"
                      />
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={ductColor}
                        strokeWidth={1.2 / zoom}
                        strokeDasharray={`${80 / zoom} ${40 / zoom}`}
                      />
                      {chevron && (
                        <polygon points={chevron.pointsStr} fill={ductColor} opacity="0.8" />
                      )}
                    </g>
                  );
                })}

                {/* 2. Active Stretching Orthogonal Duct Segments */}
                {orthoPath.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = orthoPath[idx - 1];
                  const corners = computeDuctSegmentCorners(prev, pt, w);
                  const chevron = computeAirflowChevron(prev, pt, w);
                  if (!corners) return null;

                  return (
                    <g key={`ortho-duct-${idx}`}>
                      <polygon
                        points={formatPolygonPoints(corners)}
                        fill={currentDuctSys.activeFillColor}
                        stroke={ductColor}
                        strokeWidth={2.2 / zoom}
                        strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                        strokeLinejoin="miter"
                      />
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={ductColor}
                        strokeWidth={1.2 / zoom}
                        strokeDasharray={`${40 / zoom} ${20 / zoom}`}
                      />
                      {chevron && (
                        <polygon points={chevron.pointsStr} fill={ductColor} opacity="0.9" />
                      )}
                    </g>
                  );
                })}

                {/* 3. 90° Elbow Miter Bends at Waypoints */}
                {allPoints.slice(1, -1).map((pt, idx) => (
                  <rect
                    key={`duct-elbow-${idx}`}
                    x={pt.x - (w * 0.45)}
                    y={pt.y - (w * 0.45)}
                    width={w * 0.9}
                    height={w * 0.9}
                    fill={currentDuctSys.activeFillColor}
                    stroke={ductColor}
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${6 / zoom} ${3 / zoom}`}
                  />
                ))}

                {/* 4. Live SMACNA / ASHRAE Duct Engineering HUD */}
                {(() => {
                  const midX = (lastPt.x + targetPt.x) / 2;
                  const midY = (lastPt.y + targetPt.y) / 2;

                  return (
                    <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect
                        x="-125"
                        y="-18"
                        width="250"
                        height="36"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.96)"
                        stroke={ductColor}
                        strokeWidth="1.6"
                      />
                      <text x="0" y="-4" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="800">
                        {currentDuctSys.icon} {currentDuctSys.shortName.toUpperCase()} {w}x{h} mm • {cfm} CFM
                      </text>
                      <text x="0" y="10" textAnchor="middle" fill={velMetrics.color} fontSize="8.5" fontWeight="700">
                        ⚡ {velMetrics.velocityFpm} FPM • {velMetrics.status === 'OPTIMAL_BRANCH' ? 'Optimal Branch' : (velMetrics.status === 'OPTIMAL_TRUNK' ? 'Optimal Trunk' : 'Check Velocity')} • {formatCadLength(totalLengthMm)}
                      </text>
                    </g>
                  );
                })()}
              </>
            );
          })()}
        </g>
      )}

      {/* 8. CEILING DIFFUSER & AIR TERMINAL PLACEMENT PREVIEW */}
      {activeTool === 'hvac' && hvacToolMode === 'diffuser' && cursorPt && (
        <g id="HVAC_DIFFUSER_PREVIEW" transform={`translate(${cursorPt.x}, ${cursorPt.y})`}>
          {(() => {
            const spec = HVAC_DIFFUSER_TYPES[diffuserType] || HVAC_DIFFUSER_TYPES.SUPPLY_4WAY;
            const color = spec.color || '#0EA5E9';
            const s = spec.size || 450;
            const hs = s / 2;
            const throwR = spec.throwRadiusMm || 3200;
            const cfm = diffuserCfm || spec.defaultCfm;

            return (
              <>
                {/* 1. Air Throw Coverage Circle (Dashed SMACNA Throw Radius) */}
                <circle
                  cx="0"
                  cy="0"
                  r={throwR}
                  fill={color}
                  fillOpacity="0.04"
                  stroke={color}
                  strokeWidth={1.5 / zoom}
                  strokeDasharray={`${80 / zoom} ${40 / zoom}`}
                />

                {/* 2. Optional Flex Duct Takeoff Snapping */}
                {nearestDuctTakeoff && (
                  <g transform={`translate(${-cursorPt.x}, ${-cursorPt.y})`}>
                    <path
                      d={generateFlexDuctPath(nearestDuctTakeoff.projectedPoint, cursorPt)}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={2.5 / zoom}
                      strokeDasharray={`${12 / zoom} ${6 / zoom}`}
                    />
                    {/* Takeoff collar at duct edge */}
                    <circle
                      cx={nearestDuctTakeoff.projectedPoint.x}
                      cy={nearestDuctTakeoff.projectedPoint.y}
                      r={10 / zoom}
                      fill="#0EA5E9"
                      stroke="#FFFFFF"
                      strokeWidth={1.5 / zoom}
                    />
                    <g transform={`translate(${nearestDuctTakeoff.projectedPoint.x}, ${nearestDuctTakeoff.projectedPoint.y}) scale(${1 / zoom}, ${-1 / zoom}) translate(14, -8)`}>
                      <rect x="0" y="0" width="105" height="18" rx="3" fill="#0F172A" stroke="#0EA5E9" strokeWidth="1" />
                      <text x="6" y="12" fill="#BAE6FD" fontSize="8.5" fontWeight="700">
                        ⚡ Duct Takeoff Collar
                      </text>
                    </g>
                  </g>
                )}

                {/* 3. Diffuser Geometric Body Preview */}
                {diffuserType === 'LINEAR_SLOT' ? (
                  <g>
                    <rect
                      x={-600}
                      y={-75}
                      width={1200}
                      height={150}
                      fill="rgba(56, 189, 248, 0.25)"
                      stroke={color}
                      strokeWidth={2 / zoom}
                    />
                    <line x1={-580} y1={-25} x2={580} y2={-25} stroke={color} strokeWidth={1.2 / zoom} />
                    <line x1={-580} y1={25} x2={580} y2={25} stroke={color} strokeWidth={1.2 / zoom} />
                  </g>
                ) : (
                  <g>
                    {/* Outer Square Frame */}
                    <rect
                      x={-hs}
                      y={-hs}
                      width={s}
                      height={s}
                      fill="rgba(14, 165, 233, 0.28)"
                      stroke={color}
                      strokeWidth={2.2 / zoom}
                    />
                    {/* Inner Square Frame */}
                    <rect
                      x={-hs * 0.5}
                      y={-hs * 0.5}
                      width={s * 0.5}
                      height={s * 0.5}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.6 / zoom}
                    />
                    {/* 4 Diagonal Blades / Louvers */}
                    <line x1={-hs} y1={-hs} x2={-hs * 0.5} y2={-hs * 0.5} stroke={color} strokeWidth={1.4 / zoom} />
                    <line x1={hs} y1={-hs} x2={hs * 0.5} y2={-hs * 0.5} stroke={color} strokeWidth={1.4 / zoom} />
                    <line x1={-hs} y1={hs} x2={-hs * 0.5} y2={hs * 0.5} stroke={color} strokeWidth={1.4 / zoom} />
                    <line x1={hs} y1={hs} x2={hs * 0.5} y2={hs * 0.5} stroke={color} strokeWidth={1.4 / zoom} />
                  </g>
                )}

                {/* 4. Live Diffuser Engineering HUD Badge */}
                <g transform={`scale(${1 / zoom}, ${-1 / zoom}) translate(0, ${-hs - 40})`}>
                  <rect
                    x="-90"
                    y="-12"
                    width="180"
                    height="24"
                    rx="5"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke={color}
                    strokeWidth="1.5"
                  />
                  <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700">
                    {spec.icon} {spec.name} • {cfm} CFM
                  </text>
                </g>
              </>
            );
          })()}
        </g>
      )}

      {/* 9. LIVE ELECTRICAL CONDUIT ROUTING RUBBER-BAND */}
      {draftingState?.active && draftingState.tool === 'conduit' && draftingState.points?.length > 0 && cursorPt && (
        <g id="DRAFTING_CONDUIT_RUBBERBAND">
          {(() => {
            const currentCStyle = CONDUIT_TYPES[conduitType] || CONDUIT_TYPES.SLAB;
            const strokeColor = currentCStyle.color;
            const strokeW = (currentCStyle.strokeWidth || 2.2) / zoom;
            const lastPt = draftingState.points[draftingState.points.length - 1];
            const targetPt = snappedElectricalPort ? snappedElectricalPort.point : cursorPt;
            const orthoPath = generateOrthogonalPath(lastPt, targetPt);
            const allPoints = [...draftingState.points.slice(0, -1), ...orthoPath];

            let totalLengthMm = 0;
            for (let i = 0; i < allPoints.length - 1; i++) {
              totalLengthMm += Math.hypot(allPoints[i + 1].x - allPoints[i].x, allPoints[i + 1].y - allPoints[i].y);
            }

            const loadMetrics = calculateCircuitLoading([], totalLengthMm, wireGauge);

            return (
              <>
                {/* 1. Established Conduit Segments */}
                {draftingState.points.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = draftingState.points[idx - 1];
                  return (
                    <g key={`fixed-conduit-${idx}`}>
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={strokeColor}
                        strokeWidth={strokeW * 1.5}
                        strokeLinecap="round"
                        opacity={0.8}
                      />
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#FFFFFF"
                        strokeWidth={1 / zoom}
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    </g>
                  );
                })}

                {/* 2. Active Stretching Orthogonal Conduit Segments */}
                {orthoPath.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = orthoPath[idx - 1];
                  return (
                    <g key={`ortho-conduit-${idx}`}>
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={strokeColor}
                        strokeWidth={strokeW * 1.5}
                        strokeLinecap="round"
                        strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                        opacity={0.85}
                      />
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#FFFFFF"
                        strokeWidth={1 / zoom}
                        strokeLinecap="round"
                        strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                        opacity={0.95}
                      />
                    </g>
                  );
                })}

                {/* 3. Conduit Junction Circles at Corners */}
                {allPoints.slice(1, -1).map((pt, idx) => (
                  <circle
                    key={`conduit-bend-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={5.5 / zoom}
                    fill={strokeColor}
                    stroke="#FFFFFF"
                    strokeWidth={1.2 / zoom}
                  />
                ))}

                {/* 4. Live Electrical Engineering HUD */}
                {(() => {
                  const midX = (lastPt.x + targetPt.x) / 2;
                  const midY = (lastPt.y + targetPt.y) / 2;

                  return (
                    <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect
                        x="-125"
                        y="-18"
                        width="250"
                        height="36"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.96)"
                        stroke={strokeColor}
                        strokeWidth="1.6"
                      />
                      <text x="0" y="-4" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="800">
                        {currentCStyle.icon} {currentCStyle.name} • {wireGauge}mm² Cu
                      </text>
                      <text x="0" y="10" textAnchor="middle" fill={loadMetrics.statusColor} fontSize="8.5" fontWeight="700">
                        ⚡ {formatCadLength(totalLengthMm)} • Vdrop: {loadMetrics.voltageDropPercent}% ({loadMetrics.isCompliant ? '✓ <3% NEC' : '⚠ Exceeds Limit'})
                      </text>
                    </g>
                  );
                })()}
              </>
            );
          })()}
        </g>
      )}

      {/* 10. ELECTRICAL HOMERUN ARROW LEADER PREVIEW */}
      {activeTool === 'electrical' && electricalToolMode === 'homerun' && cursorPt && (
        <g id="ELECTRICAL_HOMERUN_PREVIEW">
          {(() => {
            const startPt = snappedElectricalPort ? snappedElectricalPort.point : cursorPt;
            const targetDb = nearestDbPort ? nearestDbPort.point : null;
            const homerun = generateHomerunLeader(startPt, targetDb, 3);
            if (!homerun) return null;

            return (
              <>
                {/* Stem Line */}
                <line
                  x1={homerun.stemStart.x}
                  y1={homerun.stemStart.y}
                  x2={homerun.stemEnd.x}
                  y2={homerun.stemEnd.y}
                  stroke="#F59E0B"
                  strokeWidth={2.5 / zoom}
                  strokeLinecap="round"
                />

                {/* Solid Arrowhead pointing towards DB */}
                <polygon
                  points={homerun.arrowPointsStr}
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth={1 / zoom}
                />

                {/* Conductor Ticks (Phase, Neutral, Ground) */}
                {homerun.slashes.map((s, sIdx) => (
                  <line
                    key={`slash-${sIdx}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke="#F59E0B"
                    strokeWidth={2 / zoom}
                    strokeLinecap="round"
                  />
                ))}

                {/* Homerun Engineering Tag */}
                <g transform={`translate(${homerun.tagPos.x}, ${homerun.tagPos.y}) scale(${1 / zoom}, ${-1 / zoom})`}>
                  <rect
                    x="-75"
                    y="-12"
                    width="150"
                    height="24"
                    rx="5"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                  />
                  <text x="0" y="4" textAnchor="middle" fill="#FDE68A" fontSize="9" fontWeight="800">
                    ⚡ HOMERUN ► DB ({activeCircuitId})
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
