import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { renderElectricalShape } from './features/electrical/renderElectricalShape';
import { ELECTRICAL_FIXTURES, CONDUIT_STYLES } from './features/electrical/electricalTypes';
import {
  DISCIPLINE_VIEWS,
  DISCIPLINE_DISPLAY_MODES,
  DISCIPLINE_CONFIG,
  getDisciplineVisualState
} from './features/discipline/disciplineTypes';

function renderFurnitureShape(furn, fx, fy, fw, fh, bx, by, zoom, hasWarning) {
  const typeClean = (furn?.type || '').toLowerCase().trim();
  const statusStr = furn?.clearance_status || '';
  const isSevere = hasWarning && (statusStr.includes('Wall') || statusStr.includes('Blocks Door') || statusStr.includes('Overlap'));
  const mainStroke = hasWarning ? (isSevere ? "#EF4444" : "#F59E0B") : "#818CF8";
  const mainFill = hasWarning ? (isSevere ? "rgba(239, 68, 68, 0.20)" : "rgba(245, 158, 11, 0.16)") : "rgba(99, 102, 241, 0.12)";
  const strokeW = 2 / zoom;
  const thinStrokeW = 1.2 / zoom;

  // 1. WARDROBE / CLOSET
  if (typeClean.includes('wardrobe') || typeClean.includes('closet')) {
    const doorCount = fw >= 1600 ? 3 : 2;
    const doorWidth = fw / doorCount;
    const railY = by + fh * 0.45;
    return (
      <g className="cad-shape-wardrobe">
        <rect
          x={bx}
          y={by}
          width={fw}
          height={fh}
          rx={3 / zoom}
          ry={3 / zoom}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        <line
          x1={bx + 15 / zoom}
          y1={railY}
          x2={bx + fw - 15 / zoom}
          y2={railY}
          stroke="#A5B4FC"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${8 / zoom} ${4 / zoom}`}
        />
        {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
          <line
            key={`w-tick-${i}`}
            x1={bx + fw * ratio}
            y1={railY - 12 / zoom}
            x2={bx + fw * ratio}
            y2={railY + 12 / zoom}
            stroke="#818CF8"
            strokeWidth={thinStrokeW}
          />
        ))}
        {Array.from({ length: doorCount - 1 }).map((_, i) => {
          const splitX = bx + doorWidth * (i + 1);
          return (
            <line
              key={`w-split-${i}`}
              x1={splitX}
              y1={by}
              x2={splitX}
              y2={by + fh}
              stroke="#6366F1"
              strokeWidth={thinStrokeW}
            />
          );
        })}
        {Array.from({ length: doorCount }).map((_, i) => {
          const handleX = bx + doorWidth * i + (i % 2 === 0 ? doorWidth - 25 / zoom : 25 / zoom);
          return (
            <rect
              key={`w-handle-${i}`}
              x={handleX - 3 / zoom}
              y={by + fh * 0.2}
              width={6 / zoom}
              height={Math.min(30 / zoom, fh * 0.3)}
              rx={2 / zoom}
              fill="#C7D2FE"
            />
          );
        })}
      </g>
    );
  }

  // 2. SOFA / SOFA SET
  if (typeClean.includes('sofa') || typeClean.includes('couch')) {
    const backDepth = Math.min(220, fh * 0.28);
    const armWidth = Math.min(180, fw * 0.12);
    const seatW = fw - armWidth * 2;
    const seatH = fh - backDepth;
    const cushionCount = fw >= 1600 ? 3 : 2;
    const cushionW = seatW / cushionCount;

    return (
      <g className="cad-shape-sofa">
        <rect
          x={bx}
          y={by}
          width={fw}
          height={fh}
          rx={14 / zoom}
          ry={14 / zoom}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        <rect
          x={bx + armWidth * 0.5}
          y={by + fh - backDepth}
          width={Math.max(0, fw - armWidth)}
          height={Math.max(0, backDepth - 4 / zoom)}
          rx={8 / zoom}
          ry={8 / zoom}
          fill="rgba(99, 102, 241, 0.35)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
        <rect
          x={bx + 3 / zoom}
          y={by + 3 / zoom}
          width={Math.max(0, armWidth - 6 / zoom)}
          height={Math.max(0, fh - 6 / zoom)}
          rx={8 / zoom}
          ry={8 / zoom}
          fill="rgba(99, 102, 241, 0.45)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
        <rect
          x={bx + fw - armWidth + 3 / zoom}
          y={by + 3 / zoom}
          width={Math.max(0, armWidth - 6 / zoom)}
          height={Math.max(0, fh - 6 / zoom)}
          rx={8 / zoom}
          ry={8 / zoom}
          fill="rgba(99, 102, 241, 0.45)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
        {Array.from({ length: cushionCount }).map((_, i) => (
          <rect
            key={`sofa-cush-${i}`}
            x={bx + armWidth + cushionW * i + 3 / zoom}
            y={by + 5 / zoom}
            width={Math.max(0, cushionW - 6 / zoom)}
            height={Math.max(0, seatH - 8 / zoom)}
            rx={6 / zoom}
            ry={6 / zoom}
            fill="rgba(224, 231, 255, 0.22)"
            stroke="#A5B4FC"
            strokeWidth={thinStrokeW}
          />
        ))}
      </g>
    );
  }

  // 3. DESK / STUDY DESK
  if (typeClean.includes('desk') || typeClean.includes('study')) {
    const pedWidth = Math.min(450, fw * 0.32);
    const pedDepth = fh * 0.85;
    const grommetR = Math.min(22, Math.min(fw, fh) * 0.04);

    return (
      <g className="cad-shape-desk">
        <rect
          x={bx}
          y={by}
          width={fw}
          height={fh}
          rx={5 / zoom}
          ry={5 / zoom}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        <rect
          x={bx + fw - pedWidth - 8 / zoom}
          y={by + (fh - pedDepth) / 2}
          width={Math.max(0, pedWidth)}
          height={Math.max(0, pedDepth)}
          rx={3 / zoom}
          ry={3 / zoom}
          fill="rgba(99, 102, 241, 0.3)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
        <line
          x1={bx + fw - pedWidth / 2 - 20 / zoom}
          y1={by + fh * 0.35}
          x2={bx + fw - pedWidth / 2 + 20 / zoom}
          y2={by + fh * 0.35}
          stroke="#E0E7FF"
          strokeWidth={2 / zoom}
        />
        <line
          x1={bx + fw - pedWidth / 2 - 20 / zoom}
          y1={by + fh * 0.65}
          x2={bx + fw - pedWidth / 2 + 20 / zoom}
          y2={by + fh * 0.65}
          stroke="#E0E7FF"
          strokeWidth={2 / zoom}
        />
        <circle
          cx={bx + 50 / zoom}
          cy={by + fh - 50 / zoom}
          r={Math.max(2, grommetR / zoom)}
          fill="none"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
      </g>
    );
  }

  // 4. CHAIR / OFFICE CHAIR / DINING CHAIRS
  if (typeClean.includes('chair')) {
    const seatR = Math.min(fw, fh) * 0.38;
    const backWidth = fw * 0.75;
    const backHeight = Math.min(100, fh * 0.2);

    return (
      <g className="cad-shape-chair">
        <ellipse
          cx={fx}
          cy={fy - fh * 0.05}
          rx={Math.max(4, seatR)}
          ry={Math.max(4, seatR * 0.9)}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        <rect
          x={bx + (fw - backWidth) / 2}
          y={by + fh - backHeight - 8 / zoom}
          width={Math.max(0, backWidth)}
          height={Math.max(0, backHeight)}
          rx={Math.max(2, backHeight / 2)}
          ry={Math.max(2, backHeight / 2)}
          fill="rgba(99, 102, 241, 0.45)"
          stroke="#818CF8"
          strokeWidth={strokeW}
        />
        <rect
          x={bx + 6 / zoom}
          y={fy - seatR * 0.4}
          width={Math.max(2, Math.min(35 / zoom, fw * 0.12))}
          height={Math.max(4, seatR * 0.8)}
          rx={3 / zoom}
          fill="rgba(199, 210, 254, 0.5)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
        <rect
          x={bx + fw - Math.min(35 / zoom, fw * 0.12) - 6 / zoom}
          y={fy - seatR * 0.4}
          width={Math.max(2, Math.min(35 / zoom, fw * 0.12))}
          height={Math.max(4, seatR * 0.8)}
          rx={3 / zoom}
          fill="rgba(199, 210, 254, 0.5)"
          stroke="#818CF8"
          strokeWidth={thinStrokeW}
        />
      </g>
    );
  }

  // 5. TABLE / DINING TABLE / COFFEE TABLE
  if (typeClean.includes('table')) {
    const legInset = Math.min(50 / zoom, Math.min(fw, fh) * 0.14);
    const legSize = Math.min(45 / zoom, Math.min(fw, fh) * 0.12);

    return (
      <g className="cad-shape-table">
        <rect
          x={bx}
          y={by}
          width={fw}
          height={fh}
          rx={8 / zoom}
          ry={8 / zoom}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        <rect
          x={bx + 12 / zoom}
          y={by + 12 / zoom}
          width={Math.max(0, fw - 24 / zoom)}
          height={Math.max(0, fh - 24 / zoom)}
          rx={5 / zoom}
          ry={5 / zoom}
          fill="none"
          stroke="#A5B4FC"
          strokeWidth={thinStrokeW}
          strokeDasharray={`${8 / zoom} ${4 / zoom}`}
        />
        <rect x={bx + legInset} y={by + legInset} width={legSize} height={legSize} rx={2 / zoom} fill="#818CF8" />
        <rect x={bx + fw - legInset - legSize} y={by + legInset} width={legSize} height={legSize} rx={2 / zoom} fill="#818CF8" />
        <rect x={bx + legInset} y={by + fh - legInset - legSize} width={legSize} height={legSize} rx={2 / zoom} fill="#818CF8" />
        <rect x={bx + fw - legInset - legSize} y={by + fh - legInset - legSize} width={legSize} height={legSize} rx={2 / zoom} fill="#818CF8" />
      </g>
    );
  }

  // 6. TV UNIT / CONSOLE / BOOKSHELF / CABINET / FILING CABINET
  if (typeClean.includes('tv') || typeClean.includes('unit') || typeClean.includes('cabinet') || typeClean.includes('bookshelf') || typeClean.includes('crockery')) {
    const colCount = fw >= 1400 ? 3 : 2;
    const colW = fw / colCount;

    return (
      <g className="cad-shape-console">
        <rect
          x={bx}
          y={by}
          width={fw}
          height={fh}
          rx={3 / zoom}
          ry={3 / zoom}
          fill={mainFill}
          stroke={mainStroke}
          strokeWidth={strokeW}
        />
        {Array.from({ length: colCount - 1 }).map((_, i) => (
          <line
            key={`console-col-${i}`}
            x1={bx + colW * (i + 1)}
            y1={by}
            x2={bx + colW * (i + 1)}
            y2={by + fh}
            stroke="#818CF8"
            strokeWidth={thinStrokeW}
          />
        ))}
        {typeClean.includes('tv') && (
          <rect
            x={bx + (fw - Math.min(700, fw * 0.6)) / 2}
            y={by + fh * 0.4}
            width={Math.min(700, fw * 0.6)}
            height={Math.max(10 / zoom, fh * 0.2)}
            rx={2 / zoom}
            fill="#C7D2FE"
            stroke="#818CF8"
            strokeWidth={thinStrokeW}
          />
        )}
      </g>
    );
  }

  // 7. BED / DOUBLE BED / SINGLE BED (Default Bedroom item)
  const hbHeight = Math.min(160, fh * 0.12);
  const hbY = by + fh - hbHeight;
  const isDoubleOrLarger = fw >= 1200;
  const pillowHeight = Math.min(420, fh * 0.2);
  const pillowY = hbY - pillowHeight - 20;
  const foldY = by + fh * 0.52;

  return (
    <g className="cad-shape-bed">
      <rect
        x={bx}
        y={by}
        width={fw}
        height={fh}
        rx={10 / zoom}
        ry={10 / zoom}
        fill={mainFill}
        stroke={mainStroke}
        strokeWidth={strokeW}
      />
      <rect
        x={bx + 6 / zoom}
        y={by + 6 / zoom}
        width={Math.max(0, fw - 12 / zoom)}
        height={Math.max(0, foldY - by - 6 / zoom)}
        rx={6 / zoom}
        ry={6 / zoom}
        fill="rgba(99, 102, 241, 0.22)"
        stroke="none"
      />
      <line
        x1={bx + 10}
        y1={foldY}
        x2={bx + fw - 10}
        y2={foldY}
        stroke="#A5B4FC"
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${6 / zoom} ${3 / zoom}`}
      />
      <rect
        x={bx - 20 / zoom}
        y={hbY}
        width={fw + 40 / zoom}
        height={hbHeight}
        rx={4 / zoom}
        ry={4 / zoom}
        fill="rgba(99, 102, 241, 0.45)"
        stroke="#818CF8"
        strokeWidth={strokeW}
      />
      {isDoubleOrLarger ? (
        <>
          <rect
            x={bx + (fw * 0.08)}
            y={pillowY}
            width={fw * 0.38}
            height={pillowHeight}
            rx={8 / zoom}
            ry={8 / zoom}
            fill="rgba(224, 231, 255, 0.55)"
            stroke="#C7D2FE"
            strokeWidth={1.5 / zoom}
          />
          <rect
            x={bx + fw - (fw * 0.08) - (fw * 0.38)}
            y={pillowY}
            width={fw * 0.38}
            height={pillowHeight}
            rx={8 / zoom}
            ry={8 / zoom}
            fill="rgba(224, 231, 255, 0.55)"
            stroke="#C7D2FE"
            strokeWidth={1.5 / zoom}
          />
        </>
      ) : (
        <rect
          x={bx + (fw * 0.18)}
          y={pillowY}
          width={fw * 0.64}
          height={pillowHeight}
          rx={8 / zoom}
          ry={8 / zoom}
          fill="rgba(224, 231, 255, 0.55)"
          stroke="#C7D2FE"
          strokeWidth={1.5 / zoom}
        />
      )}
    </g>
  );
}

function renderPlumbingShape(fix, fx, fy, fw, fh, bx, by, zoom) {
  const typeClean = (fix?.type || '').toLowerCase().trim();
  const strokeColor = "#06B6D4"; // Cyan-500
  const fillColor = "rgba(6, 182, 212, 0.15)";
  const strokeW = 2 / zoom;
  const thinStrokeW = 1.2 / zoom;

  if (typeClean.includes('wc') || typeClean.includes('toilet') || typeClean.includes('bidet')) {
    const tankH = fh * 0.25;
    return (
      <g>
        <rect x={bx} y={by} width={fw} height={tankH} rx={4 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        <ellipse cx={fx} cy={by + tankH + (fh - tankH)/2} rx={fw * 0.35} ry={(fh - tankH)/2} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
      </g>
    );
  }

  if (typeClean.includes('basin') || typeClean.includes('sink')) {
    return (
      <g>
        <rect x={bx} y={by} width={fw} height={fh} rx={8 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        <ellipse cx={fx} cy={fy} rx={fw * 0.35} ry={fh * 0.35} fill="none" stroke={strokeColor} strokeWidth={thinStrokeW} />
        <circle cx={fx} cy={by + fh * 0.1} r={3 / zoom} fill={strokeColor} />
      </g>
    );
  }

  if (typeClean.includes('shower')) {
    return (
      <g>
        <rect x={bx} y={by} width={fw} height={fh} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        <line x1={bx} y1={by} x2={bx+fw} y2={by+fh} stroke={strokeColor} strokeWidth={thinStrokeW} strokeDasharray={`${4/zoom} ${4/zoom}`} />
        <line x1={bx+fw} y1={by} x2={bx} y2={by+fh} stroke={strokeColor} strokeWidth={thinStrokeW} strokeDasharray={`${4/zoom} ${4/zoom}`} />
        <circle cx={fx} cy={fy} r={fh*0.1} fill="none" stroke={strokeColor} strokeWidth={thinStrokeW} />
      </g>
    );
  }

  if (typeClean.includes('bathtub') || typeClean.includes('tub')) {
    return (
      <g>
        <rect x={bx} y={by} width={fw} height={fh} rx={16 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        <rect x={bx + fw * 0.05} y={by + fh * 0.1} width={fw * 0.9} height={fh * 0.8} rx={12 / zoom} fill="none" stroke={strokeColor} strokeWidth={thinStrokeW} />
        <circle cx={bx + fw * 0.15} cy={fy} r={5 / zoom} fill="none" stroke={strokeColor} strokeWidth={thinStrokeW} />
      </g>
    );
  }

  if (typeClean.includes('washing') || typeClean.includes('dishwasher') || typeClean.includes('fridge') || typeClean.includes('refrigerator')) {
    return (
      <g>
        <rect x={bx} y={by} width={fw} height={fh} rx={4 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        {typeClean.includes('washing') && (
          <circle cx={fx} cy={fy} r={Math.min(fw, fh) * 0.3} fill="none" stroke={strokeColor} strokeWidth={thinStrokeW} />
        )}
        {(typeClean.includes('fridge') || typeClean.includes('refrigerator')) && (
          <line x1={bx + fw * 0.2} y1={by} x2={bx + fw * 0.2} y2={by + fh} stroke={strokeColor} strokeWidth={thinStrokeW} />
        )}
      </g>
    );
  }

  return (
    <g>
      <rect x={bx} y={by} width={fw} height={fh} rx={8 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
    </g>
  );
}

/**
 * getPipeColor — centralized MEP pipe type → engineering color mapping.
 * Identical colors used in both canvas SVG rendering and data table badges.
 *   Water Supply Pipe  → #00BFFF  (Cyan / Light Blue)
 *   Drainage Pipe      → #2ECC71  (Green)
 *   Floor Trap         → #FFA500  (Orange)
 *   Vent Pipe          → #9B59B6  (Purple)
 *   Unknown            → #94A3B8  (Slate fallback)
 */
function getPipeColor(pipeTypeOrId) {
  const t = (pipeTypeOrId || '').toLowerCase().trim();
  if (t.includes('hot') || t.includes('hw') || t.includes('geyser') || t.includes('heater')) return '#EF4444'; // Hot Water Supply Pipe (Red #EF4444)
  if (t.includes('supply') || t.includes('wtr') || t.includes('cold') || t.includes('cw'))    return '#00BFFF'; // Cold Water Supply Pipe (Cyan / Light Blue)
  if (t.includes('drain') || t.includes('waste') || t.includes('drn') || t.includes('soil')) return '#2ECC71'; // Drainage Pipe (Green)
  if (t.includes('floor trap') || t.includes('trap') || t.includes('flt')) return '#FFA500'; // Floor Trap (Orange)
  if (t.includes('vent') || t.includes('vnt'))      return '#9B59B6'; // Vent Pipe (Purple)
  return '#00BFFF'; // Default safe MEP cyan
}


/**
 * getTrunkConnectionPath — smart rotation-aware multi-bend MEP routing engine.
 * Computes Straight, L-Shape, or U-Shape (back-routing) branches based on fixture rotation and trunk position.
 *
 * @param {number} portX - Absolute X of the connection port
 * @param {number} portY - Absolute Y of the connection port
 * @param {object} pipe - Target trunk pipe
 * @param {object} [fixtureContext] - Optional context: { fx, fy, fw, fh, rot, isSupply }
 * @returns {object} { points: [[x, y], ...], targetPoint: [x, y], routeType: 'Straight' | 'L-Shape' | 'U-Shape' }
 */
function getTrunkConnectionPath(portX, portY, pipe, fixtureContext = null) {
  if (!pipe || !Number.isFinite(portX) || !Number.isFinite(portY)) return null;
  let path = pipe.path;
  if (!path || !Array.isArray(path) || path.length < 2) {
    const sx = Number(pipe.x ?? 0);
    const sy = Number(pipe.y ?? 0);
    const ex = Number(pipe.end_x ?? (sx + 500));
    const ey = Number(pipe.end_y ?? sy);
    path = [[sx, sy], [ex, ey]];
  }

  const p1 = path[0];
  const p2 = path[1];
  const x1 = Number(p1[0]) || 0;
  const y1 = Number(p1[1]) || 0;
  const x2 = Number(p2[0]) || 0;
  const y2 = Number(p2[1]) || 0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  // If no fixture context provided, fallback to direct orthogonal projection
  if (!fixtureContext) {
    if (isHorizontal) {
      const trunkY = (y1 + y2) / 2;
      return {
        points: [[portX, portY], [portX, trunkY]],
        targetPoint: [portX, trunkY],
        routeType: 'Straight'
      };
    } else {
      const trunkX = (x1 + x2) / 2;
      return {
        points: [[portX, portY], [trunkX, portY]],
        targetPoint: [trunkX, portY],
        routeType: 'Straight'
      };
    }
  }

  const fx = Number(fixtureContext.fx) || portX;
  const fy = Number(fixtureContext.fy) || portY;
  const fw = Number(fixtureContext.fw) || 600;
  const fh = Number(fixtureContext.fh) || 500;
  const rot = Number(fixtureContext.rot) || 0;
  const isSupply = !!fixtureContext.isSupply;

  // Normalized rotation in [0, 360)
  const normRot = ((Math.round(rot) % 360) + 360) % 360;

  // The 4 Deterministic Routing States:
  // State 1: Direct Connection (0°)
  // State 2: Single L-Shape (90°)
  // State 3: Single L-Shape (270°)
  // State 4: U-Shape Back-Routing (180°)
  let rotState = 1;
  if (normRot >= 45 && normRot < 135) {
    rotState = 2; // 90°
  } else if (normRot >= 135 && normRot < 225) {
    rotState = 4; // 180°
  } else if (normRot >= 225 && normRot < 315) {
    rotState = 3; // 270°
  } else {
    rotState = 1; // 0°
  }

  // Calculate unrotated bounding box half-extents
  const rotRad = (normRot * Math.PI) / 180;
  const cosR = Math.abs(Math.cos(rotRad));
  const sinR = Math.abs(Math.sin(rotRad));
  const halfW = fw / 2;
  const halfH = fh / 2;
  const boundDx = halfW * cosR + halfH * sinR;
  const boundDy = halfW * sinR + halfH * cosR;
  const minX = fx - boundDx;
  const maxX = fx + boundDx;
  const minY = fy - boundDy;
  const maxY = fy + boundDy;

  let branchPoints = [];
  let targetPoint = [0, 0];
  let routeType = 'Direct';

  if (isHorizontal) {
    const trunkY = (y1 + y2) / 2;
    const isTrunkBelow = trunkY < fy;

    // Determine pipe direction towards the room's riser / main trunk anchor
    let pipeMinX = x1;
    let pipeMaxX = x2;
    if (Array.isArray(pipe?.path) && pipe.path.length >= 2) {
      pipeMinX = Math.min(pipe.path[0][0], pipe.path[1][0]);
      pipeMaxX = Math.max(pipe.path[0][0], pipe.path[1][0]);
    }
    const pipeMidX = (pipeMinX + pipeMaxX) / 2;
    const wrapLeft = fx >= pipeMidX; // True if fixture is on the east side heading west towards riser

    if (isTrunkBelow) {
      // Trunk is below the fixture (Standard floorplan layout)
      if (rotState === 1) {
        // ── STATE 1: Direct Connection (0°) ──
        // Ports align directly with trunk lines below. Shortest orthogonal path, 0 unnecessary bends.
        branchPoints = [
          [portX, portY],
          [portX, trunkY]
        ];
        targetPoint = [portX, trunkY];
        routeType = 'Direct';
      } else if (rotState === 2) {
        // ── STATE 2: L-Shape Variation (90°) ──
        // Ports face right (+X). Exactly one clean 90° bend (Single L-shape).
        // Consistent hierarchy & parallel spacing: Supply (closer to bottom trunk) turns at +70mm, Drainage turns at +140mm.
        const cornerX = maxX + (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [cornerX, portY],
          [cornerX, trunkY]
        ];
        targetPoint = [cornerX, trunkY];
        routeType = 'L-Shape';
      } else if (rotState === 3) {
        // ── STATE 3: L-Shape Variation (270°) ──
        // Ports face left (-X). Exactly one clean 90° bend (Single L-shape).
        // Consistent hierarchy & parallel spacing: Drainage (closer to bottom trunk) turns at -70mm, Supply turns at -140mm.
        const cornerX = minX - (isSupply ? 140 : 70);
        branchPoints = [
          [portX, portY],
          [cornerX, portY],
          [cornerX, trunkY]
        ];
        targetPoint = [cornerX, trunkY];
        routeType = 'L-Shape';
      } else {
        // ── STATE 4: Synchronized Parallel U-Shape Routing (180°) ──
        // Ports face away from trunk (+Y). Double-bend pattern wrapping rear & flank.
        // Both pipes route together along the back and wrap around the SAME flank heading towards the riser.
        // Locked parallel offset: 70mm constant gap maintained along rear and flank. Zero crossovers!
        let backY;
        let sideX;
        if (wrapLeft) {
          // Drain is on left (closer to left flank) => Inner Lane (+60mm)
          // Supply is on right (further from left flank) => Outer Lane (+130mm)
          backY = maxY + (isSupply ? 130 : 60);
          sideX = minX - (isSupply ? 130 : 60);
        } else {
          // Supply is on right (closer to right flank) => Inner Lane (+60mm)
          // Drain is on left (further from right flank) => Outer Lane (+130mm)
          backY = maxY + (isSupply ? 60 : 130);
          sideX = maxX + (isSupply ? 60 : 130);
        }

        branchPoints = [
          [portX, portY],
          [portX, backY],
          [sideX, backY],
          [sideX, trunkY]
        ];
        targetPoint = [sideX, trunkY];
        routeType = 'U-Shape';
      }
    } else {
      // Trunk is above the fixture
      if (rotState === 4) {
        // 180°: Ports face UP directly towards trunk. Direct connection!
        branchPoints = [
          [portX, portY],
          [portX, trunkY]
        ];
        targetPoint = [portX, trunkY];
        routeType = 'Direct';
      } else if (rotState === 2) {
        // 90°: L-Shape turning upward (Drain closer to top trunk turns at +70mm, Supply at +140mm)
        const cornerX = maxX + (isSupply ? 140 : 70);
        branchPoints = [
          [portX, portY],
          [cornerX, portY],
          [cornerX, trunkY]
        ];
        targetPoint = [cornerX, trunkY];
        routeType = 'L-Shape';
      } else if (rotState === 3) {
        // 270°: L-Shape turning upward (Supply closer to top trunk turns at -70mm, Drain at -140mm)
        const cornerX = minX - (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [cornerX, portY],
          [cornerX, trunkY]
        ];
        targetPoint = [cornerX, trunkY];
        routeType = 'L-Shape';
      } else {
        // 0°: Synchronized Parallel U-Shape wrapping rearward below and up to trunk above
        let backY;
        let sideX;
        if (wrapLeft) {
          // Supply is at left => Inner Lane (-60mm)
          // Drain is at right => Outer Lane (-130mm)
          backY = minY - (isSupply ? 60 : 130);
          sideX = minX - (isSupply ? 60 : 130);
        } else {
          // Drain is at right => Inner Lane (-60mm)
          // Supply is at left => Outer Lane (-130mm)
          backY = minY - (isSupply ? 130 : 60);
          sideX = maxX + (isSupply ? 130 : 60);
        }

        branchPoints = [
          [portX, portY],
          [portX, backY],
          [sideX, backY],
          [sideX, trunkY]
        ];
        targetPoint = [sideX, trunkY];
        routeType = 'U-Shape';
      }
    }
  } else {
    // Vertical Trunk Line (trunkX)
    const trunkX = (x1 + x2) / 2;
    const isTrunkRight = trunkX >= fx;

    // Determine pipe direction towards trunk anchor / riser along Y
    let pipeMinY = y1;
    let pipeMaxY = y2;
    if (Array.isArray(pipe?.path) && pipe.path.length >= 2) {
      pipeMinY = Math.min(pipe.path[0][1], pipe.path[1][1]);
      pipeMaxY = Math.max(pipe.path[0][1], pipe.path[1][1]);
    }
    const pipeMidY = (pipeMinY + pipeMaxY) / 2;
    const wrapDown = fy >= pipeMidY;

    if (isTrunkRight) {
      if (rotState === 2) {
        // 90°: Ports face right towards trunk. Direct connection!
        branchPoints = [
          [portX, portY],
          [trunkX, portY]
        ];
        targetPoint = [trunkX, portY];
        routeType = 'Direct';
      } else if (rotState === 1) {
        // 0°: L-Shape turning right to trunkX
        const cornerY = minY - (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [portX, cornerY],
          [trunkX, cornerY]
        ];
        targetPoint = [trunkX, cornerY];
        routeType = 'L-Shape';
      } else if (rotState === 4) {
        // 180°: L-Shape turning right to trunkX
        const cornerY = maxY + (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [portX, cornerY],
          [trunkX, cornerY]
        ];
        targetPoint = [trunkX, cornerY];
        routeType = 'L-Shape';
      } else {
        // 270°: Ports face left (away from trunk on right). Synchronized U-Shape back-routing!
        let backX;
        let sideY;
        if (wrapDown) {
          backX = minX - (isSupply ? 130 : 60);
          sideY = minY - (isSupply ? 130 : 60);
        } else {
          backX = minX - (isSupply ? 60 : 130);
          sideY = maxY + (isSupply ? 60 : 130);
        }
        branchPoints = [
          [portX, portY],
          [backX, portY],
          [backX, sideY],
          [trunkX, sideY]
        ];
        targetPoint = [trunkX, sideY];
        routeType = 'U-Shape';
      }
    } else {
      // Trunk is to the left of the fixture
      if (rotState === 3) {
        // 270°: Ports face left towards trunk. Direct connection!
        branchPoints = [
          [portX, portY],
          [trunkX, portY]
        ];
        targetPoint = [trunkX, portY];
        routeType = 'Direct';
      } else if (rotState === 1) {
        // 0°: L-Shape turning left to trunkX
        const cornerY = minY - (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [portX, cornerY],
          [trunkX, cornerY]
        ];
        targetPoint = [trunkX, cornerY];
        routeType = 'L-Shape';
      } else if (rotState === 4) {
        // 180°: L-Shape turning left to trunkX
        const cornerY = maxY + (isSupply ? 70 : 140);
        branchPoints = [
          [portX, portY],
          [portX, cornerY],
          [trunkX, cornerY]
        ];
        targetPoint = [trunkX, cornerY];
        routeType = 'L-Shape';
      } else {
        // 90°: Ports face right (away from trunk on left). Synchronized U-Shape back-routing!
        let backX;
        let sideY;
        if (wrapDown) {
          backX = maxX + (isSupply ? 130 : 60);
          sideY = minY - (isSupply ? 130 : 60);
        } else {
          backX = maxX + (isSupply ? 60 : 130);
          sideY = maxY + (isSupply ? 60 : 130);
        }
        branchPoints = [
          [portX, portY],
          [backX, portY],
          [backX, sideY],
          [trunkX, sideY]
        ];
        targetPoint = [trunkX, sideY];
        routeType = 'U-Shape';
      }
    }
  }

  return {
    points: branchPoints,
    targetPoint: targetPoint,
    routeType: routeType
  };
}

/**
 * findConduitIntersections — identifies orthogonal crossing points between distinct electrical routes.
 * Used to render schematic jumper arcs ("wire hops") so crossing conduits never look spliced.
 */
function findConduitIntersections(routes) {
  const crossings = [];
  if (!routes || routes.length < 2) return crossings;

  const segments = [];
  routes.forEach((r, rIdx) => {
    const pts = r.points || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const isHoriz = Math.abs(p1[1] - p2[1]) < 2;
      const isVert = Math.abs(p1[0] - p2[0]) < 2;
      segments.push({ rIdx, p1, p2, isHoriz, isVert, route: r });
    }
  });

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.rIdx === s2.rIdx) continue;

      let hSeg = null, vSeg = null;
      if (s1.isHoriz && s2.isVert) { hSeg = s1; vSeg = s2; }
      else if (s1.isVert && s2.isHoriz) { hSeg = s2; vSeg = s1; }

      if (hSeg && vSeg) {
        const hY = hSeg.p1[1];
        const minHX = Math.min(hSeg.p1[0], hSeg.p2[0]) + 15;
        const maxHX = Math.max(hSeg.p1[0], hSeg.p2[0]) - 15;
        const vX = vSeg.p1[0];
        const minVY = Math.min(vSeg.p1[1], vSeg.p2[1]) + 15;
        const maxVY = Math.max(vSeg.p1[1], vSeg.p2[1]) - 15;

        if (vX > minHX && vX < maxHX && hY > minVY && hY < maxVY) {
          crossings.push({
            x: vX,
            y: hY,
            conduitType: hSeg.route?.conduit_type || 'slab_conduit'
          });
        }
      }
    }
  }
  return crossings;
}

export default function Canvas({ 
  solveData, 
  furniture = [],
  plumbingFixtures = [],
  plumbingPipes = [],
  electricalComponents = [],
  electricalCircuits = [],
  electricalRoutes = [],
  disciplineView = 'all',
  disciplineDisplayMode = 'dim',
  onDisciplineChange,
  onDisplayModeToggle,
  showGrid, 
  showDimensions = true,
  showDoors = true,
  showWindows = true,
  showHvac = true,
  showFurniture = true,
  showPlumbing = true,
  showElectrical = true,
  activeTool = 'select',
  selectedElectricalFixtureType = 'recessed_downlight',
  scaleModeFixed = true,
  isResizeModeActive = false,
  onCursorMove, 
  onLiveItemUpdate, 
  viewTransform, 
  setViewTransform,
  selectedItem: controlledSelectedItem,
  onSelectItem
}) {
  const svgRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [internalSelectedItem, setInternalSelectedItem] = useState(null);
  const selectedItem = controlledSelectedItem !== undefined ? controlledSelectedItem : internalSelectedItem;

  // ─── Discipline Visual States ─────────────────────────────────────────────
  const archVisualState = useMemo(() => 
    getDisciplineVisualState('architecture', disciplineView, disciplineDisplayMode),
    [disciplineView, disciplineDisplayMode]
  );
  const furnVisualState = useMemo(() => 
    getDisciplineVisualState('furniture', disciplineView, disciplineDisplayMode),
    [disciplineView, disciplineDisplayMode]
  );
  const hvacVisualState = useMemo(() => 
    getDisciplineVisualState('hvac', disciplineView, disciplineDisplayMode),
    [disciplineView, disciplineDisplayMode]
  );
  const plumbVisualState = useMemo(() => 
    getDisciplineVisualState('plumbing', disciplineView, disciplineDisplayMode),
    [disciplineView, disciplineDisplayMode]
  );
  const electVisualState = useMemo(() => 
    getDisciplineVisualState('electrical', disciplineView, disciplineDisplayMode),
    [disciplineView, disciplineDisplayMode]
  );

  const activeDisciplineConfig = DISCIPLINE_CONFIG[disciplineView] || DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.ALL];
  const setSelectedItem = useCallback((val) => {
    setInternalSelectedItem(prev => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      if (onSelectItem) onSelectItem(nextVal);
      return nextVal;
    });
  }, [onSelectItem]);
  const [dragState, setDragState] = useState(null);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ width: 1000, height: 800 });

  // Orthogonal crossover points for schematic conduit jumper arcs
  const conduitCrossings = useMemo(() => {
    return findConduitIntersections(electricalRoutes);
  }, [electricalRoutes]);

  // ─── Dynamic 2D Measurement Tape Tool (M) ──────────────────────────────────
  const [tapeMeasureActive, setTapeMeasureActive] = useState(false);
  const [tapeStart, setTapeStart] = useState(null);
  const [tapeEnd, setTapeEnd] = useState(null);
  const [tapeHover, setTapeHover] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.key === 'm' || e.key === 'M') {
        setTapeMeasureActive(prev => {
          if (prev) {
            setTapeStart(null);
            setTapeEnd(null);
            setTapeHover(null);
            return false;
          }
          return true;
        });
      } else if (e.key === 'Escape') {
        if (tapeMeasureActive || tapeStart) {
          setTapeMeasureActive(false);
          setTapeStart(null);
          setTapeEnd(null);
          setTapeHover(null);
        } else if (selectedItem) {
          setSelectedItem(null);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem && selectedItem.item) {
          e.preventDefault();
          const id = selectedItem.item.id;
          const type = selectedItem.type;
          if (type === "Furniture") onLiveItemUpdate?.("DeleteFurniture", id);
          else if (type === "PlumbingFixture") onLiveItemUpdate?.("DeletePlumbingFixture", id);
          else if (type === "PlumbingPipe") onLiveItemUpdate?.("DeletePlumbingPipe", id);
          else if (type === "ElectricalComponent" || type === "Electrical") onLiveItemUpdate?.("DeleteElectricalComponent", id);
          else if (type === "HVAC") onLiveItemUpdate?.("DeleteHVAC", id);
          else if (type === "Door" || type === "Window") onLiveItemUpdate?.("DeleteOpening", id);
          setSelectedItem(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tapeMeasureActive, tapeStart, selectedItem, onLiveItemUpdate, setSelectedItem]);

  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setBounds({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);


  const getSvgCoordinates = useCallback((e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const cadX = (clientX - viewTransform.x) / viewTransform.width;
    const cadY = (bounds.height - clientY - viewTransform.y) / viewTransform.width;

    return { x: cadX, y: cadY };
  }, [viewTransform, bounds.height]);

  const handleMouseMove = (e) => {
    const coords = getSvgCoordinates(e);
    if (tapeMeasureActive && tapeStart && !tapeEnd) {
      setTapeHover(coords);
    }

    if (dragState) {
      if (dragState.type === "RoomResize") {
        // Snap coordinates to 50mm grid for clean architectural precision
        const snapX = Math.round(coords.x / 50) * 50;
        const snapY = Math.round(coords.y / 50) * 50;

        let { minX, maxX, minY, maxY } = dragState.initialBounds;

        if (dragState.mode === "corner") {
          const cIdx = dragState.cornerIndex;
          if (cIdx === 0) { // Bottom-Left
            minX = Math.min(maxX - 800, snapX);
            minY = Math.min(maxY - 800, snapY);
          } else if (cIdx === 1) { // Bottom-Right
            maxX = Math.max(minX + 800, snapX);
            minY = Math.min(maxY - 800, snapY);
          } else if (cIdx === 2) { // Top-Right
            maxX = Math.max(minX + 800, snapX);
            maxY = Math.max(minY + 800, snapY);
          } else if (cIdx === 3) { // Top-Left
            minX = Math.min(maxX - 800, snapX);
            maxY = Math.max(minY + 800, snapY);
          }
        } else if (dragState.mode === "wall") {
          const side = dragState.wallSide;
          if (side === "Bottom") {
            minY = Math.min(maxY - 800, snapY);
          } else if (side === "Top") {
            maxY = Math.max(minY + 800, snapY);
          } else if (side === "Left") {
            minX = Math.min(maxX - 800, snapX);
          } else if (side === "Right") {
            maxX = Math.max(minX + 800, snapX);
          }
        }

        const newPoints = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY]
        ];

        setDragState(prev => ({
          ...prev,
          currentPoints: newPoints,
          currentWidth: maxX - minX,
          currentHeight: maxY - minY,
          currentAreaSqm: ((maxX - minX) * (maxY - minY)) / 1e6
        }));
      } else if (dragState.type === "PlumbingFixtureRotate" || dragState.type === "ElectricalComponentRotate" || dragState.type === "FurnitureRotate") {
        const cursorAngleDeg = (Math.atan2(coords.y - dragState.centerY, coords.x - dragState.centerX) * 180) / Math.PI;
        const rawAngle = ((cursorAngleDeg - 90) % 360 + 360) % 360;
        const snapStep = e.shiftKey ? 5 : 15;
        const newRot = (Math.round(rawAngle / snapStep) * snapStep) % 360;
        setDragState(prev => ({
          ...prev,
          currentRotation: newRot
        }));
      } else {
        const dx = coords.x - dragState.startCursorX;
        const dy = coords.y - dragState.startCursorY;
        setDragState(prev => ({ ...prev, dx, dy }));
      }
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y - dy
      }));

      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseDown = (e) => {
    if (tapeMeasureActive) {
      const pt = getSvgCoordinates(e);
      if (!tapeStart || tapeEnd) {
        setTapeStart(pt);
        setTapeEnd(null);
        setTapeHover(pt);
      } else {
        setTapeEnd(pt);
        setTapeHover(null);
      }
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = (e) => {
    setIsPanning(false);

    if (e && activeTool === 'electrical' && onLiveItemUpdate && !dragState) {
      const dist = Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y);
      if (dist < 6) {
        const pt = getSvgCoordinates(e);
        const spec = ELECTRICAL_FIXTURES[selectedElectricalFixtureType] || ELECTRICAL_FIXTURES.recessed_downlight;
        onLiveItemUpdate('AddElectricalComponent', null, {
          type: selectedElectricalFixtureType || 'recessed_downlight',
          name: spec.label,
          category: spec.category,
          mounting: spec.mounting,
          wattage: spec.defaultWattage,
          x: Math.round(pt.x),
          y: Math.round(pt.y),
          rotation: 0
        });
        return;
      }
    }

    if (dragState && onLiveItemUpdate) {
      if (dragState.type === "RoomResize") {
        if (dragState.currentPoints) {
          onLiveItemUpdate("Room", dragState.roomName, { points: dragState.currentPoints });
        }
      } else if (dragState.type === "HVAC") {
        const dx = dragState.dx || 0;
        const dy = dragState.dy || 0;
        const finalX = Math.round(dragState.startOffsetX + dx);
        const finalY = Math.round(dragState.startOffsetY + dy);
        onLiveItemUpdate("HVAC", dragState.item.id, { 
          location_x: finalX, 
          location_y: finalY,
          x: finalX,
          y: finalY
        });
      } else if (dragState.type === "Furniture") {
        const dx = dragState.dx || 0;
        const dy = dragState.dy || 0;
        const finalX = Math.round(dragState.startOffsetX + dx);
        const finalY = Math.round(dragState.startOffsetY + dy);
        onLiveItemUpdate("Furniture", dragState.item.id, { 
          x: finalX, 
          y: finalY
        });
      } else if (dragState.type === "FurnitureRotate") {
        const finalRot = dragState.currentRotation ?? dragState.initialRotation ?? 0;
        if (dragState.item?.id) {
          onLiveItemUpdate("Furniture", dragState.item.id, { 
            rotation: finalRot
          });
          setSelectedItem(prev => (prev?.item?.id === dragState.item.id) 
            ? { ...prev, item: { ...prev.item, rotation: finalRot } } 
            : prev);
        }
      } else if (dragState.type === "PlumbingFixture") {
        const dx = dragState.dx || 0;
        const dy = dragState.dy || 0;
        const finalX = Math.round(dragState.startOffsetX + dx);
        const finalY = Math.round(dragState.startOffsetY + dy);
        onLiveItemUpdate("UpdatePlumbingFixture", dragState.item.id, { 
          x: finalX, 
          y: finalY
        });
      } else if (dragState.type === "PlumbingFixtureRotate") {
        const finalRot = dragState.currentRotation ?? dragState.initialRotation ?? 0;
        if (dragState.item?.id) {
          onLiveItemUpdate("UpdatePlumbingFixture", dragState.item.id, { 
            rotation: finalRot
          });
          setSelectedItem(prev => (prev?.item?.id === dragState.item.id) 
            ? { ...prev, item: { ...prev.item, rotation: finalRot } } 
            : prev);
        }
      } else if (dragState.type === "ElectricalComponentRotate") {
        const finalRot = dragState.currentRotation ?? dragState.initialRotation ?? 0;
        if (dragState.item?.id) {
          onLiveItemUpdate("UpdateElectricalComponent", dragState.item.id, { 
            rotation: finalRot
          });
          setSelectedItem(prev => (prev?.item?.id === dragState.item.id) 
            ? { ...prev, item: { ...prev.item, rotation: finalRot } } 
            : prev);
        }
      } else if (dragState.type === "ElectricalComponent") {
        const dx = dragState.dx || 0;
        const dy = dragState.dy || 0;
        const finalX = Math.round(dragState.startOffsetX + dx);
        const finalY = Math.round(dragState.startOffsetY + dy);
        onLiveItemUpdate("UpdateElectricalComponent", dragState.item.id, { 
          x: finalX, 
          y: finalY
        });
      } else if (dragState.type === "Door" || dragState.type === "Window") {
        const dx = dragState.dx;
        const dy = dragState.dy;
        const ws = dragState.item.wall_side;
        let delta = 0;
        if (ws === "Bottom") delta = dx;
        else if (ws === "Right") delta = dy;
        else if (ws === "Top") delta = -dx;
        else if (ws === "Left") delta = -dy;
        
        const finalOffset = Math.max(50, dragState.startOffset + delta);
        onLiveItemUpdate(dragState.type, dragState.item.id, { offset_mm: finalOffset });
      }
    }
    setDragState(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();

    const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
    const newZoom = viewTransform.width * zoomFactor;

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cadX = (px - viewTransform.x) / viewTransform.width;
    const cadY = (bounds.height - py - viewTransform.y) / viewTransform.width;

    const newPanX = px - cadX * newZoom;
    const newPanY = bounds.height - py - cadY * newZoom;

    setViewTransform({
      x: newPanX,
      y: newPanY,
      width: newZoom,
      height: newZoom
    });
  };

  const roomColors = ['rgba(59, 130, 246, 0.12)', 'rgba(16, 185, 129, 0.12)', 'rgba(245, 158, 11, 0.12)'];
  const zoom = viewTransform.width;

  // Helper to get bounding box of room points
  const getRoomBounds = (points) => {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  };

  return (
    <div className="canvas-wrapper">
      <svg
        ref={svgRef}
        className={`cad-canvas ${isPanning ? 'panning' : ''}`}
        width="100%" height="100%"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="grid-minor" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1 / zoom} />
          </pattern>
          <pattern id="grid-major" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <rect width="1000" height="1000" fill="url(#grid-minor)" />
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth={2 / zoom} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="#0F172A" />

        <g transform={`translate(${viewTransform.x}, ${bounds.height - viewTransform.y}) scale(${zoom}, ${-zoom})`}>
          {showGrid && (
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-major)" />
          )}

          {/* World Origin Axes (0,0) */}
          <line x1="-50000" y1="0" x2="50000" y2="0" stroke="rgba(239, 68, 68, 0.35)" strokeWidth={1.5 / zoom} />
          <line x1="0" y1="-50000" x2="0" y2="50000" stroke="rgba(34, 197, 94, 0.35)" strokeWidth={1.5 / zoom} />

          {/* ORIGIN (0,0) MARKER */}
          <g
            id="LAYER_ORIGIN"
            transform="translate(0, 0)"
            style={{
              opacity: archVisualState.opacity,
              pointerEvents: archVisualState.interactive ? 'auto' : 'none',
              transition: 'opacity 0.2s ease'
            }}
          >
            <g transform={`scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <circle cx="0" cy="0" r="3.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="-8" y1="0" x2="8" y2="0" stroke="#EF4444" strokeWidth="1" />
              <line x1="0" y1="-8" x2="0" y2="8" stroke="#EF4444" strokeWidth="1" />
              <text x="6" y="-6" fill="#EF4444" fontSize="7.5" fontWeight="600" opacity="0.8">
                (0,0)
              </text>
            </g>
          </g>

          {/* LAYER_ROOMS */}
          <g
            id="LAYER_ROOMS"
            style={{
              opacity: archVisualState.opacity,
              pointerEvents: archVisualState.interactive ? 'auto' : 'none',
              transition: 'opacity 0.2s ease'
            }}
          >
            {(!solveData?.rooms || solveData.rooms.length === 0) && (
              <g transform={`translate(2000, 2000) scale(${1 / zoom}, ${-1 / zoom})`}>
                <rect x="-190" y="-35" width="380" height="70" rx="8" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
                <text textAnchor="middle" y="-6" fill="#94A3B8" fontSize="13" fontWeight="600">
                  No rooms defined in this floorplan.
                </text>
                <text textAnchor="middle" y="18" fill="#38BDF8" fontSize="11" fontWeight="500">
                  Switch to "Rooms" tab to add your first room.
                </text>
              </g>
            )}
            {solveData?.rooms?.map((room, idx) => {
              const pts = room.filleted_points || room.points || [];
              const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(" ");
              return (
                <polygon
                  key={`room-poly-${idx}`}
                  points={pointsStr}
                  fill={roomColors[idx % roomColors.length]}
                  stroke="none"
                />
              );
            })}
          </g>

          {/* LAYER_WALLS */}
          <g
            id="LAYER_WALLS"
            style={{
              opacity: archVisualState.dimmed
                ? (disciplineDisplayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? 0.18 : 0.35)
                : 1.0,
              pointerEvents: archVisualState.interactive ? 'auto' : 'none',
              transition: 'opacity 0.2s ease'
            }}
          >
            {(() => {
              const combinedWalls = (solveData?.combined_wall_polygons && solveData.combined_wall_polygons.length > 0)
                ? solveData.combined_wall_polygons
                : solveData?.wall_polygons?.filter(w => w.wall_type === "combined");
              const hasCombined = combinedWalls && combinedWalls.length > 0;
              const wallsToRender = hasCombined ? combinedWalls : solveData?.wall_polygons;

              return wallsToRender?.map((wall, idx) => {
                const outerPts = wall.outer_polygon || [];
                const outerStr = outerPts.map(p => `${p[0]} ${p[1]}`).join(" L ");
                const innerStrs = wall.inner_polygons?.map(hole => `M ${hole.map(p => `${p[0]} ${p[1]}`).join(" L ")} Z`).join(" ") || "";
                return (
                  <path
                    key={`wall-core-${wall.wall_type || 'poly'}-${idx}`}
                    d={`M ${outerStr} Z ${innerStrs}`}
                    fill="#1E293B"
                    fillRule="evenodd"
                    stroke="#FFFFFF"
                    strokeWidth={1.5 / zoom}
                    strokeLinejoin="miter"
                  />
                );
              });
            })()}

            {/* Fallback to wall_lines only if no combined wall polygons are present */}
            {!solveData?.combined_wall_polygons?.length && !solveData?.wall_polygons?.some(w => w.wall_type === "combined") &&
              solveData?.wall_lines?.map((line, idx) => (
                <line
                  key={`wall-line-${idx}`}
                  x1={line.x1} y1={line.y1}
                  x2={line.x2} y2={line.y2}
                  stroke="#FFFFFF"
                  strokeWidth={1.5 / zoom}
                />
              ))
            }
          </g>

          {/* LAYER_STRUCTURE (Structural Grid & Reinforced Concrete Columns) */}
          {((solveData?.structural_grid && solveData.structural_grid.length > 0) ||
            (solveData?.structural_columns && solveData.structural_columns.length > 0)) && (
            <g id="LAYER_STRUCTURE" style={{ pointerEvents: 'none' }}>
              {/* Structural Grid Centerlines */}
              {(solveData?.structural_grid || []).map((grid, gIdx) => {
                const p1 = grid.p1 || [0, 0];
                const p2 = grid.p2 || [0, 0];
                const r = 220;
                return (
                  <g key={`struct-grid-${grid.id || gIdx}`} className="cad-grid-line">
                    <line
                      x1={p1[0]}
                      y1={p1[1]}
                      x2={p2[0]}
                      y2={p2[1]}
                      stroke="#0284C7"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray={`${120 / zoom} ${40 / zoom} ${30 / zoom} ${40 / zoom}`}
                      opacity={0.65}
                    />
                    {/* Top / End Bubble */}
                    <circle cx={p2[0]} cy={p2[1]} r={r} fill="#0F172A" stroke="#0284C7" strokeWidth={1.8 / zoom} />
                    <g transform={`translate(${p2[0]}, ${p2[1]}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <text textAnchor="middle" dominantBaseline="middle" fill="#38BDF8" fontSize="13" fontWeight="bold">
                        {grid.name}
                      </text>
                    </g>
                    {/* Bottom / Start Bubble */}
                    <circle cx={p1[0]} cy={p1[1]} r={r} fill="#0F172A" stroke="#0284C7" strokeWidth={1.8 / zoom} />
                    <g transform={`translate(${p1[0]}, ${p1[1]}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <text textAnchor="middle" dominantBaseline="middle" fill="#38BDF8" fontSize="13" fontWeight="bold">
                        {grid.name}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Structural Columns */}
              {(solveData?.structural_columns || []).map((col, cIdx) => {
                const s = col.size || 300;
                const hs = s / 2;
                return (
                  <g key={`struct-col-${col.id || cIdx}`} className="cad-column">
                    <rect
                      x={col.x - hs}
                      y={col.y - hs}
                      width={s}
                      height={s}
                      fill="rgba(6, 182, 212, 0.28)"
                      stroke="#06B6D4"
                      strokeWidth={2 / zoom}
                    />
                    <line x1={col.x - hs} y1={col.y - hs} x2={col.x + hs} y2={col.y + hs} stroke="#06B6D4" strokeWidth={1 / zoom} />
                    <line x1={col.x - hs} y1={col.y + hs} x2={col.x + hs} y2={col.y - hs} stroke="#06B6D4" strokeWidth={1 / zoom} />
                    <g transform={`translate(${col.x}, ${col.y + hs + 80}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect x="-18" y="-9" width="36" height="18" rx="3" fill="#0F172A" stroke="#06B6D4" strokeWidth="0.8" />
                      <text x="0" y="3" textAnchor="middle" dominantBaseline="middle" fill="#67E8F9" fontSize="9" fontWeight="700">
                        {col.name || `C${cIdx + 1}`}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* LAYER_FURNITURE */}
          {showFurniture && (() => {
            const activeFurniture = (furniture && Array.isArray(furniture) && furniture.length > 0)
              ? furniture
              : (solveData?.furniture || []);

            if (activeFurniture.length === 0) return null;

            return (
              <g
                id="LAYER_FURNITURE"
                style={{
                  opacity: furnVisualState.opacity,
                  pointerEvents: furnVisualState.interactive ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease'
                }}
              >
                {activeFurniture.map((furn, idx) => {
                  if (!furn) return null;
                  const isDragging = dragState?.item?.id === furn.id && dragState?.type === "Furniture";
                  const isRotating = dragState?.type === "FurnitureRotate" && dragState?.item?.id === furn.id;
                  const tx = isDragging ? dragState.dx : 0;
                  const ty = isDragging ? dragState.dy : 0;
                  const fx = (Number(furn.x) || 0) + tx;
                  const fy = (Number(furn.y) || 0) + ty;
                  const fw = Number(furn.width) || 1500;
                  const fh = Number(furn.height) || 2000;
                  const rot = isRotating ? (dragState.currentRotation ?? Number(furn.rotation) ?? 0) : (Number(furn.rotation) || 0);
                  const bx = fx - fw / 2;
                  const by = fy - fh / 2;

                  const isSelected = selectedItem?.item?.id === furn.id && selectedItem?.type === "Furniture";
                  const hasWarning = furn.clearance_status && furn.clearance_status.includes("Warning");
                  const statusStr = furn.clearance_status || '';
                  const isSevereCollision = hasWarning && (statusStr.includes('Wall') || statusStr.includes('Blocks Door') || statusStr.includes('Overlap'));
                  const warningColor = isSevereCollision ? '#EF4444' : '#F59E0B';

                  const rotRad = (rot * Math.PI) / 180;
                  const Ledge = Math.max(fw, fh) / 2 + 30;
                  const Lhandle = Ledge + Math.max(100, 32 / zoom);
                  const Lbtn = Lhandle + Math.max(90, 26 / zoom);

                  const topEdgeX = fx - Ledge * Math.sin(rotRad);
                  const topEdgeY = fy + Ledge * Math.cos(rotRad);
                  const handleX  = fx - Lhandle * Math.sin(rotRad);
                  const handleY  = fy + Lhandle * Math.cos(rotRad);
                  const btnX     = fx - Lbtn * Math.sin(rotRad);
                  const btnY     = fy + Lbtn * Math.cos(rotRad);

                  return (
                    <g key={`furn-wrapper-${furn.id || 'f'}-${idx}`}>
                      <g
                        transform={rot ? `rotate(${rot}, ${fx}, ${fy})` : undefined}
                        onPointerDown={(e) => {
                          if (!furnVisualState.interactive && !isSelected) return;
                          e.stopPropagation();
                          setSelectedItem({ type: "Furniture", item: furn });
                          const pt = getSvgCoordinates(e);
                          setDragState({
                            type: "Furniture",
                            item: furn,
                            startCursorX: pt.x,
                            startCursorY: pt.y,
                            startOffsetX: Number(furn.x) || 0,
                            startOffsetY: Number(furn.y) || 0,
                            dx: 0,
                            dy: 0
                          });
                        }}
                        style={{
                          cursor: (furnVisualState.interactive || isSelected) ? (isDragging ? "grabbing" : "grab") : "default",
                          opacity: isSelected ? 1 : undefined,
                          filter: isSelected
                            ? "drop-shadow(0px 0px 8px #818CF8)"
                            : (hasWarning
                                ? (isSevereCollision
                                    ? "drop-shadow(0px 0px 8px rgba(239, 68, 68, 0.8))"
                                    : "drop-shadow(0px 0px 6px rgba(245, 158, 11, 0.7))")
                                : "none"),
                          pointerEvents: (furnVisualState.interactive || isSelected) ? "all" : "none"
                        }}
                        className="cad-furniture-group"
                      >
                        {/* Render Category-Specific Architectural Shape */}
                        {renderFurnitureShape(furn, fx, fy, fw, fh, bx, by, zoom, hasWarning)}

                        {/* Visual Warning Outlines */}
                        {hasWarning && (
                          <rect
                            x={bx - 10 / zoom}
                            y={by - 10 / zoom}
                            width={fw + 20 / zoom}
                            height={fh + 20 / zoom}
                            rx={6 / zoom}
                            ry={6 / zoom}
                            fill="none"
                            stroke={warningColor}
                            strokeWidth={2.5 / zoom}
                            strokeDasharray={`${8 / zoom} ${5 / zoom}`}
                            style={{ pointerEvents: 'none' }}
                          />
                        )}

                        {/* Warning Indicator: Full banner when selected, discreet dot when resting */}
                        {hasWarning && isSelected && (
                          <g
                            transform={`translate(${fx}, ${by + fh + 20 / zoom}) scale(${1 / zoom}, ${-1 / zoom})`}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            <rect
                              x={-55}
                              y={-10}
                              width={110}
                              height={20}
                              rx={10}
                              fill={isSevereCollision ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)'}
                              stroke="#FFFFFF"
                              strokeWidth="1.2"
                            />
                            <text
                              x={0}
                              y={0}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#FFFFFF"
                              fontSize="9"
                              fontWeight="700"
                            >
                              {statusStr.includes('Wall')
                                ? '⚠ Wall Collision'
                                : (statusStr.includes('Blocks Door')
                                  ? '⚠ Blocks Door'
                                  : (statusStr.includes('Overlap')
                                    ? '⚠ Overlap'
                                    : '⚠ Near Door'))}
                            </text>
                          </g>
                        )}

                        {hasWarning && !isSelected && (
                          <g
                            transform={`translate(${bx + fw}, ${by + fh}) scale(${1 / zoom}, ${-1 / zoom})`}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            <circle
                              cx={0}
                              cy={0}
                              r={6}
                              fill={isSevereCollision ? '#EF4444' : '#F59E0B'}
                              stroke="#FFFFFF"
                              strokeWidth="1.2"
                            />
                            <text
                              x={0}
                              y={0.5}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#FFFFFF"
                              fontSize="7.5"
                              fontWeight="bold"
                            >
                              !
                            </text>
                          </g>
                        )}

                        {/* Architectural Furniture Label: Compact resting tag vs. Click-to-Expand Badge */}
                        {isSelected ? (
                          <g
                            transform={`translate(${fx}, ${fy}) scale(${1 / zoom}, ${-1 / zoom})`}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            <rect
                              x={-75}
                              y={-22}
                              width={150}
                              height={44}
                              rx={8}
                              fill="rgba(15, 23, 42, 0.96)"
                              stroke="#818CF8"
                              strokeWidth="1.5"
                            />
                            <text
                              y={-7}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#F8FAFC"
                              fontSize="9.5"
                              fontWeight="700"
                            >
                              {`🪑 ${furn?.id || 'FURN'} • ${furn?.type || 'Furniture'}`}
                            </text>
                            <text
                              y={9}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#94A3B8"
                              fontSize="8"
                              fontWeight="600"
                            >
                              {`${Math.round(fw)} × ${Math.round(fh)} mm${furn?.host_room_id ? ` • ${furn.host_room_id}` : ''}`}
                            </text>
                          </g>
                        ) : (
                          <g
                            transform={`translate(${fx}, ${fy}) scale(${1 / zoom}, ${-1 / zoom})`}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            <text
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#E2E8F0"
                              fontSize="7.5"
                              fontWeight="600"
                              style={{ textShadow: '0px 1px 4px rgba(15, 23, 42, 0.95)' }}
                            >
                              {furn?.type || furn?.id || 'FURN'}
                            </text>
                          </g>
                        )}
                      </g>

                      {/* ROTATION HANDLE + 90° SNAP BUTTON */}
                      {isSelected && (
                        <g className="furniture-rotation-ui" style={{ pointerEvents: 'all' }}>
                          {/* Stem line */}
                          <line
                            x1={topEdgeX}
                            y1={topEdgeY}
                            x2={handleX}
                            y2={handleY}
                            stroke="#818CF8"
                            strokeWidth={1.8 / zoom}
                            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                            strokeOpacity={0.85}
                          />

                          {/* Circular Rotation Handle */}
                          <g
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const pt = getSvgCoordinates(e);
                              const curRot = Number(furn.rotation) || 0;
                              const startAngle = (Math.atan2(pt.y - fy, pt.x - fx) * 180) / Math.PI;
                              setDragState({
                                type: "FurnitureRotate",
                                item: furn,
                                centerX: fx,
                                centerY: fy,
                                initialRotation: curRot,
                                startCursorAngle: startAngle,
                                currentRotation: curRot
                              });
                            }}
                            style={{ cursor: isRotating ? "grabbing" : "grab" }}
                            title="Drag to rotate furniture"
                          >
                            <circle cx={handleX} cy={handleY} r={16 / zoom} fill="transparent" />
                            <circle cx={handleX} cy={handleY} r={9 / zoom} fill="#6366F1" stroke="#FFFFFF" strokeWidth={2 / zoom} />
                            <circle cx={handleX} cy={handleY} r={3.5 / zoom} fill="#FFFFFF" />
                          </g>

                          {/* Quick 90° Rotate Pill Button */}
                          <g
                            transform={`translate(${btnX}, ${btnY}) scale(${1 / zoom}, ${-1 / zoom})`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const curRot = Number(furn.rotation) || 0;
                              const nextRot = (curRot + 90) % 360;
                              if (onLiveItemUpdate) {
                                onLiveItemUpdate("Furniture", furn.id, { rotation: nextRot });
                              }
                              setSelectedItem(prev => (prev?.item?.id === furn.id) 
                                ? { ...prev, item: { ...prev.item, rotation: nextRot } } 
                                : prev);
                            }}
                            style={{ cursor: 'pointer' }}
                            title="Click to turn 90° clockwise"
                          >
                            <rect
                              x={-34}
                              y={-12}
                              width={68}
                              height={24}
                              rx={12}
                              fill="#4F46E5"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' }}
                            />
                            <text
                              x={0}
                              y={1}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#FFFFFF"
                              fontSize="10"
                              fontWeight="700"
                              style={{ userSelect: 'none' }}
                            >
                              ⟳ +90°
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* LAYER_PLUMBING */}
          {showPlumbing && (() => {
            const activeFixtures = (plumbingFixtures && Array.isArray(plumbingFixtures) && plumbingFixtures.length > 0)
              ? plumbingFixtures
              : (solveData?.plumbing_fixtures || []);
            const activePipes = (plumbingPipes && Array.isArray(plumbingPipes) && plumbingPipes.length > 0)
              ? plumbingPipes
              : (solveData?.plumbing_pipes || []);

            if (activeFixtures.length === 0 && activePipes.length === 0) return null;

            // ─── Stroke width helpers ────────────────────────────────────────────────
            const trunkSW = (diam) => scaleModeFixed
              ? Math.max(diam / 6, 3.5)
              : Math.max(2.5 / zoom, diam / zoom);
            const branchSW = (diam) => scaleModeFixed
              ? Math.max(diam / 8, 3)
              : Math.max(2 / zoom, 3);
            const nodeSW = scaleModeFixed ? 2 : Math.max(1.5 / zoom, 2);
            const nodeR = (base) => scaleModeFixed ? base : Math.max((base * 0.8) / zoom, base);

            // ─── PASS 0: INTERCONNECTED TRUNK NETWORK FITTINGS ────────────────────────
            // Detect all intersection nodes where horizontal room pipes meet vertical main risers/stacks
            const junctionFittings = [];
            const vertPipes = activePipes.filter(p => {
              const path = p?.path;
              if (!path || path.length < 2) return false;
              return Math.abs(path[1][0] - path[0][0]) < Math.abs(path[1][1] - path[0][1]);
            });
            const horizPipes = activePipes.filter(p => {
              const path = p?.path;
              if (!path || path.length < 2) return false;
              return Math.abs(path[1][0] - path[0][0]) >= Math.abs(path[1][1] - path[0][1]);
            });

            for (const vp of vertPipes) {
              const vx = (vp.path[0][0] + vp.path[1][0]) / 2;
              const vyMin = Math.min(vp.path[0][1], vp.path[1][1]);
              const vyMax = Math.max(vp.path[0][1], vp.path[1][1]);
              const vColor = getPipeColor(vp.type || vp.id);

              for (const hp of horizPipes) {
                const hColor = getPipeColor(hp.type || hp.id);
                if (hColor !== vColor) continue;

                const hy = (hp.path[0][1] + hp.path[1][1]) / 2;
                const hxMin = Math.min(hp.path[0][0], hp.path[1][0]);
                const hxMax = Math.max(hp.path[0][0], hp.path[1][0]);

                if (vx >= hxMin - 80 && vx <= hxMax + 80 && hy >= vyMin - 80 && hy <= vyMax + 80) {
                  junctionFittings.push({
                    key: `fit-${vp.id}-${hp.id}`,
                    x: vx,
                    y: hy,
                    color: vColor,
                    diam: Math.max(Number(vp.diameter) || 25, Number(hp.diameter) || 25)
                  });
                }
              }
            }

            return (
              <g
                id="LAYER_PLUMBING"
                style={{
                  opacity: plumbVisualState.opacity,
                  pointerEvents: plumbVisualState.interactive ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease'
                }}
              >


                {/* PASS 1 — PER-ROOM TRUNK PIPE SEGMENTS (strictly trimmed, solid) */}
                {activePipes.map((pipe, idx) => {
                  if (!pipe) return null;
                  let path = pipe?.path;
                  if (!path || !Array.isArray(path) || path.length < 2) {
                    const sx = Number(pipe?.x ?? 0);
                    const sy = Number(pipe?.y ?? 0);
                    const ex = Number(pipe?.end_x ?? (sx + 500));
                    const ey = Number(pipe?.end_y ?? sy);
                    path = [[sx, sy], [ex, ey]];
                  }

                  let p0 = [Number(path[0][0]) || 0, Number(path[0][1]) || 0];
                  let p1 = [Number(path[1][0]) || 0, Number(path[1][1]) || 0];
                  const isHoriz = Math.abs(p1[0] - p0[0]) >= Math.abs(p1[1] - p0[1]);

                  // Dynamic Strict Trimming for Horizontal Pipes hosting fixtures:
                  // Limit the pipe to run strictly between the vertical riser and the furthest fixture connection.
                  if (isHoriz) {
                    const isSupply = (pipe.type || '').toLowerCase().includes('supply') || (pipe.id || '').startsWith('WTR');
                    const isDrain = (pipe.type || '').toLowerCase().includes('drain') || (pipe.type || '').toLowerCase().includes('waste') || (pipe.id || '').startsWith('DRN');

                    const hostFixs = activeFixtures.filter(f =>
                      f?.supplyPipeId === pipe.id ||
                      f?.drainagePipeId === pipe.id ||
                      (pipe.connected_to && (pipe.connected_to === f.id || f.id === pipe.connected_to)) ||
                      ((f?.host_room_id || '').toLowerCase().trim() === (pipe.host_room_id || '').toLowerCase().trim() && (isSupply || isDrain))
                    );

                    if (hostFixs.length > 0) {
                      const targetXs = [];
                      for (const f of hostFixs) {
                        const fw = Number(f.width) || 600;
                        const fh = Number(f.height) || 500;
                        const isRotating = dragState?.type === "PlumbingFixtureRotate" && dragState?.item?.id === f.id;
                        const rot = isRotating ? (dragState.currentRotation ?? Number(f.rotation) ?? 0) : (Number(f.rotation) || 0);
                        const rotRad = (rot * Math.PI) / 180;
                        const relX = isSupply ? (-fw * 0.28) : (fw * 0.28);
                        const relY = -Number(f.height || 500) * 0.38;
                        const isDragging = dragState?.item?.id === f.id && dragState?.type === "PlumbingFixture";
                        const tx = isDragging ? (dragState.dx || 0) : 0;
                        const ty = isDragging ? (dragState.dy || 0) : 0;
                        const fx = (Number(f.x) || 0) + tx;
                        const fy = (Number(f.y) || 0) + ty;
                        const pX = fx + (relX * Math.cos(rotRad) - relY * Math.sin(rotRad));
                        const pY = fy + (relX * Math.sin(rotRad) + relY * Math.cos(rotRad));

                        const branch = getTrunkConnectionPath(pX, pY, pipe, { fx, fy, fw, fh, rot, isSupply });
                        if (branch && branch.targetPoint && Number.isFinite(branch.targetPoint[0])) {
                          targetXs.push(branch.targetPoint[0]);
                        } else if (Number.isFinite(pX) && pX > 0) {
                          targetXs.push(pX);
                        }
                      }

                      if (targetXs.length > 0) {
                        const riserX = isSupply ? 3900 : 3950;
                        const minTarget = Math.min(...targetXs);
                        const maxTarget = Math.max(...targetXs);

                        if (riserX <= minTarget) {
                          // Room is to the right of riser (e.g. Bathroom):
                          // Pipe starts at riserX and terminates strictly at maxTarget
                          p0[0] = riserX;
                          p1[0] = maxTarget;
                        } else if (riserX >= maxTarget) {
                          // Room is to the left of riser (e.g. Kitchen, Utility):
                          // Pipe starts at minTarget and terminates strictly at riserX
                          p0[0] = minTarget;
                          p1[0] = riserX;
                        }
                      }
                    }
                  }

                  const ptsStr = `${p0[0]},${p0[1]} ${p1[0]},${p1[1]}`;
                  const isSelected = selectedItem?.item?.id === pipe.id && selectedItem?.type === "PlumbingPipe";

                  const midX = (p0[0] + p1[0]) / 2;
                  const midY = (p0[1] + p1[1]) / 2;

                  const pipeType = pipe.type || "Pipe";
                  const strokeC = getPipeColor(pipeType);
                  const diam = (pipe.diameter > 0 ? pipe.diameter : 25);

                  return (
                    <g key={`pipe-${pipe.id || idx}`}
                       onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: "PlumbingPipe", item: pipe }); }}
                       style={{ cursor: "pointer", filter: isSelected ? `drop-shadow(0px 0px 6px ${strokeC})` : "none" }}>
                      {/* Single clean solid trunk — no dashes, no inner highlight, no artifacts */}
                      <polyline
                        points={ptsStr}
                        fill="none"
                        stroke={strokeC}
                        strokeWidth={trunkSW(diam)}
                        strokeOpacity={0.92}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Pipe label: Compact resting tag vs. Click-to-Expand Badge */}
                      <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {isSelected ? (
                          <g>
                            <rect
                              x={-75}
                              y={-11}
                              width={150}
                              height={22}
                              rx={4}
                              fill="rgba(15, 23, 42, 0.95)"
                              stroke={strokeC}
                              strokeWidth="1.2"
                            />
                            <text
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#FFFFFF"
                              fontSize="8.5"
                              fontWeight="700"
                            >
                              {`🚰 ${pipe.id} • ⌀${diam}mm ${pipe.connected_to ? '→ ' + pipe.connected_to : ''}`}
                            </text>
                          </g>
                        ) : (
                          <text
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill={strokeC}
                            fontSize="6.5"
                            fontWeight="600"
                            style={{ textShadow: '0px 1px 3px rgba(15, 23, 42, 0.95)' }}
                          >
                            {`${pipe.id} (⌀${diam}mm)`}
                          </text>
                        )}
                      </g>
                    </g>
                  );
                })}

                {/* PASS 1.5 — MECHANICAL TRUNK JUNCTION FITTINGS (T-Fittings & Crosses) */}
                {junctionFittings.map((fit) => (
                  <g key={fit.key} className="plumbing-trunk-junction">
                    <circle
                      cx={fit.x}
                      cy={fit.y}
                      r={nodeR(6.5)}
                      fill={fit.color}
                      stroke="#FFFFFF"
                      strokeWidth={nodeSW}
                    />
                  </g>
                ))}

                {/* PASS 2 — SOLID ORTHOGONAL BRANCH LINES (Port → Trunk, ZERO gaps) */}
                {activeFixtures.map((fix, fIdx) => {
                  if (!fix) return null;
                  const isDragging = dragState?.item?.id === fix.id && dragState?.type === "PlumbingFixture";
                  const tx = isDragging ? (dragState.dx || 0) : 0;
                  const ty = isDragging ? (dragState.dy || 0) : 0;

                  const room = solveData?.rooms?.find(r => (r?.name || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim());
                  let cx = 0, cy = 0;
                  if (room && Array.isArray(room.points) && room.points.length >= 3) {
                    const xs = room.points.map(p => p[0]);
                    const ys = room.points.map(p => p[1]);
                    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                  }
                  const baseFx = (Number.isFinite(Number(fix.x)) && Number(fix.x) !== 0) ? Number(fix.x) : cx;
                  const baseFy = (Number.isFinite(Number(fix.y)) && Number(fix.y) !== 0) ? Number(fix.y) : cy;
                  const fx = baseFx + tx;
                  const fy = baseFy + ty;
                  const fw = Number(fix.width) || 600;
                  const fh = Number(fix.height) || 500;
                  const isRotating = dragState?.type === "PlumbingFixtureRotate" && dragState?.item?.id === fix.id;
                  const rot = isRotating ? (dragState.currentRotation ?? Number(fix.rotation) ?? 0) : (Number(fix.rotation) || 0);
                  const rotRad = (rot * Math.PI) / 180;

                  // Port positions (world coords)
                  const relSupplyX = -fw * 0.28, relSupplyY = -fh * 0.38;
                  const relDrainX  =  fw * 0.28, relDrainY  = -fh * 0.38;
                  const supplyX = fx + (relSupplyX * Math.cos(rotRad) - relSupplyY * Math.sin(rotRad));
                  const supplyY = fy + (relSupplyX * Math.sin(rotRad) + relSupplyY * Math.cos(rotRad));
                  const drainX  = fx + (relDrainX  * Math.cos(rotRad) - relDrainY  * Math.sin(rotRad));
                  const drainY  = fy + (relDrainX  * Math.sin(rotRad) + relDrainY  * Math.cos(rotRad));

                  const supplyPipe = activePipes.find(p => p?.id === fix.supplyPipeId) ||
                    activePipes.find(p => (p?.host_room_id || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim() &&
                      ((p?.type || '').includes('Supply') || (p?.id || '').startsWith('WTR')));

                  const drainPipe = activePipes.find(p => p?.id === fix.drainagePipeId) ||
                    activePipes.find(p => (p?.host_room_id || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim() &&
                      ((p?.type || '').includes('Drain') || (p?.type || '').includes('drain') || (p?.id || '').startsWith('DRN')));

                  const supplyBranch = supplyPipe ? getTrunkConnectionPath(supplyX, supplyY, supplyPipe, { fx, fy, fw, fh, rot, isSupply: true, fixtureType: fix.type }) : null;
                  const drainBranch  = drainPipe  ? getTrunkConnectionPath(drainX,  drainY,  drainPipe,  { fx, fy, fw, fh, rot, isSupply: false, fixtureType: fix.type }) : null;

                  const supplyColor = getPipeColor(supplyPipe?.type || 'Water Supply Pipe');
                  const drainColor  = getPipeColor(drainPipe?.type  || 'Drainage Pipe');
                  const supplyDiam  = Number(supplyPipe?.diameter) || 20;
                  const drainDiam   = Number(drainPipe?.diameter)  || 110;

                  return (
                    <g key={`plm-branch-group-${fix.id || fIdx}`}>
                      {/* Water Supply Branch — solid, uniform, no dashes */}
                      {supplyBranch && supplyBranch.points && (
                        <g className="plumbing-branch-supply">
                          <polyline
                            points={supplyBranch.points.map(pt => `${pt[0]},${pt[1]}`).join(' ')}
                            fill="none"
                            stroke={supplyColor}
                            strokeWidth={branchSW(supplyDiam)}
                            strokeOpacity={0.95}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* T-fitting junction node */}
                          <circle
                            cx={supplyBranch.targetPoint[0]}
                            cy={supplyBranch.targetPoint[1]}
                            r={nodeR(5.5)}
                            fill={supplyColor}
                            stroke="#FFFFFF"
                            strokeWidth={nodeSW}
                          />
                        </g>
                      )}

                      {/* Drainage Branch — solid, uniform, no dashes */}
                      {drainBranch && drainBranch.points && (
                        <g className="plumbing-branch-drain">
                          <polyline
                            points={drainBranch.points.map(pt => `${pt[0]},${pt[1]}`).join(' ')}
                            fill="none"
                            stroke={drainColor}
                            strokeWidth={branchSW(drainDiam)}
                            strokeOpacity={0.95}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Junction fitting node */}
                          <circle
                            cx={drainBranch.targetPoint[0]}
                            cy={drainBranch.targetPoint[1]}
                            r={nodeR(6.5)}
                            fill={drainColor}
                            stroke="#FFFFFF"
                            strokeWidth={nodeSW}
                          />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* PASS 3 — FIXTURES + ANCHORED PORT CIRCLES */}
                {activeFixtures.map((fix, idx) => {
                  if (!fix) return null;
                  const isDragging = dragState?.item?.id === fix.id && dragState?.type === "PlumbingFixture";
                  const tx = isDragging ? dragState.dx : 0;
                  const ty = isDragging ? dragState.dy : 0;

                  const room = solveData?.rooms?.find(r => (r?.name || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim());
                  let cx = 0, cy = 0;
                  if (room && Array.isArray(room.points) && room.points.length >= 3) {
                    const xs = room.points.map(p => p[0]);
                    const ys = room.points.map(p => p[1]);
                    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                  }
                  const baseFx = (Number.isFinite(Number(fix.x)) && Number(fix.x) !== 0) ? Number(fix.x) : cx;
                  const baseFy = (Number.isFinite(Number(fix.y)) && Number(fix.y) !== 0) ? Number(fix.y) : cy;
                  const fx = baseFx + tx;
                  const fy = baseFy + ty;
                  const fw = Number(fix.width) || 600;
                  const fh = Number(fix.height) || 500;
                  const isRotating = dragState?.type === "PlumbingFixtureRotate" && dragState?.item?.id === fix.id;
                  const rot = isRotating ? (dragState.currentRotation ?? Number(fix.rotation) ?? 0) : (Number(fix.rotation) || 0);
                  const rotRad = (rot * Math.PI) / 180;
                  const isSelected = selectedItem?.item?.id === fix.id && selectedItem?.type === "PlumbingFixture";

                  const relSupplyX = -fw * 0.28, relSupplyY = -fh * 0.38;
                  const relDrainX  =  fw * 0.28, relDrainY  = -fh * 0.38;
                  const supplyX = fx + (relSupplyX * Math.cos(rotRad) - relSupplyY * Math.sin(rotRad));
                  const supplyY = fy + (relSupplyX * Math.sin(rotRad) + relSupplyY * Math.cos(rotRad));
                  const drainX  = fx + (relDrainX  * Math.cos(rotRad) - relDrainY  * Math.sin(rotRad));
                  const drainY  = fy + (relDrainX  * Math.sin(rotRad) + relDrainY  * Math.cos(rotRad));

                  const supplyPipe = activePipes.find(p => p?.id === fix.supplyPipeId) ||
                    activePipes.find(p => (p?.host_room_id || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim() &&
                      ((p?.type || '').includes('Supply') || (p?.id || '').startsWith('WTR')));
                  const drainPipe = activePipes.find(p => p?.id === fix.drainagePipeId) ||
                    activePipes.find(p => (p?.host_room_id || '').toLowerCase().trim() === (fix?.host_room_id || '').toLowerCase().trim() &&
                      ((p?.type || '').includes('Drain') || (p?.type || '').includes('drain') || (p?.id || '').startsWith('DRN')));

                  const supplyColor = getPipeColor(supplyPipe?.type || 'Water Supply Pipe');
                  const drainColor  = getPipeColor(drainPipe?.type  || 'Drainage Pipe');

                  return (
                    <g key={`plm-${fix.id || idx}`}
                      onPointerDown={(e) => {
                        if (!plumbVisualState.interactive && !isSelected) return;
                        e.stopPropagation();
                        setSelectedItem({ type: "PlumbingFixture", item: fix });
                        const pt = getSvgCoordinates(e);
                        setDragState({ type: "PlumbingFixture", item: fix, startCursorX: pt.x, startCursorY: pt.y, startOffsetX: baseFx, startOffsetY: baseFy, dx: 0, dy: 0 });
                      }}
                      style={{
                        cursor: (plumbVisualState.interactive || isSelected) ? (isDragging ? "grabbing" : "grab") : "default",
                        opacity: isSelected ? 1 : undefined,
                        filter: (isSelected || isDragging || isRotating) ? "drop-shadow(0px 0px 6px #06B6D4)" : "none",
                        pointerEvents: (plumbVisualState.interactive || isSelected) ? "all" : "none"
                      }}>

                      {/* Fixture Silhouette */}
                      <g transform={rot ? `rotate(${rot}, ${fx}, ${fy})` : undefined}>
                        {renderPlumbingShape(fix, fx, fy, fw, fh, fx - fw / 2, fy - fh / 2, zoom)}
                      </g>

                      {/* Supply Port Node — colored to match pipe type */}
                      {supplyPipe && (
                        <g title={`Supply Port → ${supplyPipe.id}`}>
                          <circle cx={supplyX} cy={supplyY} r={nodeR(8.5)} fill={supplyColor} stroke="#FFFFFF" strokeWidth={nodeSW} />
                          <circle cx={supplyX} cy={supplyY} r={nodeR(3.5)} fill="#FFFFFF" />
                        </g>
                      )}

                      {/* Drain Port Node — colored to match pipe type */}
                      {drainPipe && (
                        <g title={`Drain Port → ${drainPipe.id}`}>
                          <circle cx={drainX} cy={drainY} r={nodeR(8.5)} fill={drainColor} stroke="#FFFFFF" strokeWidth={nodeSW} />
                          <circle cx={drainX} cy={drainY} r={nodeR(3.5)} fill="#FFFFFF" />
                        </g>
                      )}

                      {/* Fixture label: Compact resting tag vs. Click-to-Expand Badge */}
                      <g transform={`translate(${fx}, ${fy}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {isSelected ? (
                          <g>
                            <rect
                              x={-75}
                              y={-22}
                              width={150}
                              height={44}
                              rx={8}
                              fill="rgba(15, 23, 42, 0.96)"
                              stroke="#38BDF8"
                              strokeWidth="1.5"
                            />
                            <text
                              y={-7}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#F8FAFC"
                              fontSize="9.5"
                              fontWeight="700"
                            >
                              {`🚿 ${fix?.id || 'PLM'} • ${fix?.type || 'Fixture'}`}
                            </text>
                            <text
                              y={9}
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#94A3B8"
                              fontSize="8"
                              fontWeight="600"
                            >
                              {`${Math.round(fw)} × ${Math.round(fh)} mm${fix?.host_room_id ? ` • ${fix.host_room_id}` : ''}`}
                            </text>
                          </g>
                        ) : (
                          <text
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill="#CFFAFE"
                            fontSize="7.5"
                            fontWeight="600"
                            style={{ textShadow: '0px 1px 3px rgba(15, 23, 42, 0.95)' }}
                          >
                            {fix?.type || fix?.id || 'PLM'}
                          </text>
                        )}
                      </g>

                      {/* Interactive Canvas Rotation Controls for Selected Plumbing Fixture */}
                      {isSelected && (() => {
                        const Ledge = fh / 2;
                        const Lhandle = fh / 2 + Math.max(140, 35 / zoom);
                        const Lbtn = Lhandle + Math.max(110, 28 / zoom);

                        const topEdgeX = fx - Ledge * Math.sin(rotRad);
                        const topEdgeY = fy + Ledge * Math.cos(rotRad);
                        const handleX  = fx - Lhandle * Math.sin(rotRad);
                        const handleY  = fy + Lhandle * Math.cos(rotRad);
                        const btnX     = fx - Lbtn * Math.sin(rotRad);
                        const btnY     = fy + Lbtn * Math.cos(rotRad);

                        return (
                          <g className="plumbing-interactive-rotation-group">
                            {/* Stem line from top edge of fixture to handle */}
                            <line
                              x1={topEdgeX}
                              y1={topEdgeY}
                              x2={handleX}
                              y2={handleY}
                              stroke="#00BFFF"
                              strokeWidth={1.8 / zoom}
                              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                              strokeOpacity={0.85}
                            />

                            {/* Circular Rotation Handle */}
                            <g
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const pt = getSvgCoordinates(e);
                                const curRot = Number(fix.rotation) || 0;
                                const startAngle = (Math.atan2(pt.y - fy, pt.x - fx) * 180) / Math.PI;
                                setDragState({
                                  type: "PlumbingFixtureRotate",
                                  item: fix,
                                  centerX: fx,
                                  centerY: fy,
                                  initialRotation: curRot,
                                  startCursorAngle: startAngle,
                                  currentRotation: curRot
                                });
                              }}
                              style={{ cursor: isRotating ? "grabbing" : "grab" }}
                              title="Drag to rotate fixture"
                            >
                              {/* Invisible hit target for easy clicking/dragging */}
                              <circle cx={handleX} cy={handleY} r={16 / zoom} fill="transparent" />
                              {/* Outer ring */}
                              <circle cx={handleX} cy={handleY} r={9 / zoom} fill="#0284C7" stroke="#FFFFFF" strokeWidth={2 / zoom} />
                              {/* Inner accent dot */}
                              <circle cx={handleX} cy={handleY} r={3.5 / zoom} fill="#FFFFFF" />
                            </g>

                            {/* Quick 90° Rotate Pill Button */}
                            <g
                              transform={`translate(${btnX}, ${btnY}) scale(${1 / zoom}, ${-1 / zoom})`}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const curRot = Number(fix.rotation) || 0;
                                const nextRot = (curRot + 90) % 360;
                                if (onLiveItemUpdate) {
                                  onLiveItemUpdate("UpdatePlumbingFixture", fix.id, { rotation: nextRot });
                                }
                                setSelectedItem(prev => (prev?.item?.id === fix.id) 
                                  ? { ...prev, item: { ...prev.item, rotation: nextRot } } 
                                  : prev);
                              }}
                              style={{ cursor: "pointer" }}
                              title="Click to rotate +90°"
                            >
                              <rect x="-26" y="-11" width="52" height="22" rx="11" fill="#0369A1" stroke="#38BDF8" strokeWidth={1.2} />
                              <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" style={{ pointerEvents: "none", userSelect: "none" }}>
                                ⟳ 90°
                              </text>
                            </g>

                            {/* Dynamic Angle Indicator Badge during rotation drag */}
                            {isRotating && (
                              <g transform={`translate(${fx}, ${fy - (fh / 2 + 25 / zoom)}) scale(${1 / zoom}, ${-1 / zoom})`}>
                                <rect x="-22" y="-10" width="44" height="20" rx="4" fill="#0F172A" stroke="#00BFFF" strokeWidth={1.2} />
                                <text x="0" y="4" textAnchor="middle" fill="#00BFFF" fontSize="11" fontWeight="bold">
                                  {`${rot}°`}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })()}
                    </g>
                  );
                })}
              </g>
            );
          })()}


          {/* LAYER_WINDOWS */}
          {showWindows && (
            <g
              id="LAYER_WINDOWS"
              style={{
                opacity: archVisualState.opacity,
                pointerEvents: archVisualState.interactive ? 'auto' : 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              {solveData?.windows?.map((win, idx) => {
                const isDragging = dragState?.item?.id === win.id;
                const tx = isDragging ? dragState.dx : 0;
                const ty = isDragging ? dragState.dy : 0;
                const isSelected = selectedItem?.item?.id === win.id;
                return (
                  <g key={`win-${win.id}-${idx}`}
                    transform={isDragging ? `translate(${tx}, ${ty})` : undefined}
                    onPointerDown={(e) => {
                      if (!archVisualState.interactive && !isSelected) return;
                      e.stopPropagation();
                      setSelectedItem({ type: "Window", item: win });
                      const pt = getSvgCoordinates(e);
                      setDragState({ type: "Window", item: win, startCursorX: pt.x, startCursorY: pt.y, startOffset: win.offset_mm, dx: 0, dy: 0 });
                    }}
                    style={{
                      cursor: (archVisualState.interactive || isSelected) ? "grab" : "default",
                      opacity: isSelected ? 1 : undefined,
                      filter: isSelected ? "drop-shadow(0px 0px 4px #38BDF8)" : "none",
                      pointerEvents: (archVisualState.interactive || isSelected) ? "all" : "none"
                    }}
                  >
                    {/* Hitbox */}
                    {win.lines && win.lines[0] && <circle cx={(win.lines[0][0]+win.lines[0][2])/2} cy={(win.lines[0][1]+win.lines[0][3])/2} r={win.width_mm/2} fill="transparent" />}
                    {win.jambs?.map((j, jidx) => (
                      <line
                        key={`win-jamb-${jidx}`}
                        x1={j[0]} y1={j[1]} x2={j[2]} y2={j[3]}
                        stroke="#38BDF8"
                        strokeWidth={2 / zoom}
                      />
                    ))}
                    {win.lines?.map((l, lidx) => (
                      <line
                        key={`win-line-${lidx}`}
                        x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]}
                        stroke="#38BDF8"
                        strokeWidth={(lidx === 1 ? 2.5 : 1.5) / zoom}
                      />
                    ))}
                    {/* Window label: Compact resting tag vs. Click-to-Expand Badge */}
                    <g transform={`translate(${win.label_x}, ${win.label_y}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {isSelected ? (
                        <g>
                          <rect
                            x={-50}
                            y={-10}
                            width={100}
                            height={20}
                            rx={4}
                            fill="rgba(15, 23, 42, 0.95)"
                            stroke="#38BDF8"
                            strokeWidth="1.2"
                          />
                          <text textAnchor="middle" alignmentBaseline="middle" fill="#38BDF8" fontSize="8.5" fontWeight="700">
                            {`🪟 ${win.id} • ${win.width_mm}mm`}
                          </text>
                        </g>
                      ) : (
                        <text textAnchor="middle" alignmentBaseline="middle" fill="#38BDF8" fontSize="7.5" fontWeight="600" style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}>
                          {win.id}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* LAYER_DOORS */}
          {showDoors && (
            <g
              id="LAYER_DOORS"
              style={{
                opacity: archVisualState.opacity,
                pointerEvents: archVisualState.interactive ? 'auto' : 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              {solveData?.doors?.map((door, idx) => {
                const isDragging = dragState?.item?.id === door.id;
                const tx = isDragging ? dragState.dx : 0;
                const ty = isDragging ? dragState.dy : 0;
                const isSelected = selectedItem?.item?.id === door.id;
                return (
                  <g key={`door-${door.id}-${idx}`}
                    transform={isDragging ? `translate(${tx}, ${ty})` : undefined}
                    onPointerDown={(e) => {
                      if (!archVisualState.interactive && !isSelected) return;
                      e.stopPropagation();
                      setSelectedItem({ type: "Door", item: door });
                      const pt = getSvgCoordinates(e);
                      setDragState({ type: "Door", item: door, startCursorX: pt.x, startCursorY: pt.y, startOffset: door.offset_mm, dx: 0, dy: 0 });
                    }}
                    style={{
                      cursor: (archVisualState.interactive || isSelected) ? "grab" : "default",
                      opacity: isSelected ? 1 : undefined,
                      filter: isSelected ? "drop-shadow(0px 0px 4px #FACC15)" : "none",
                      pointerEvents: (archVisualState.interactive || isSelected) ? "all" : "none"
                    }}
                  >
                    {/* Hitbox for easier dragging */}
                    {door.hinge && door.jambs && door.jambs[0] && door.jambs[1] && (
                      <circle cx={(door.jambs[0][0]+door.jambs[1][0])/2} cy={(door.jambs[0][1]+door.jambs[1][1])/2} r={door.width_mm/2} fill="transparent" />
                    )}
                    {door.jambs?.map((j, jidx) => (
                      <line
                        key={`door-jamb-${jidx}`}
                        x1={j[0]} y1={j[1]} x2={j[2]} y2={j[3]}
                        stroke="#EAB308"
                        strokeWidth={2 / zoom}
                      />
                    ))}
                    {door.hinge && door.leaf_end && (
                      <line
                        x1={door.hinge[0]} y1={door.hinge[1]}
                        x2={door.leaf_end[0]} y2={door.leaf_end[1]}
                        stroke="#FACC15"
                        strokeWidth={2.5 / zoom}
                      />
                    )}
                    <path
                      d={door.arc_path}
                      fill="rgba(234, 179, 8, 0.08)"
                      stroke="#EAB308"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                    />
                    {/* Door label: Compact resting tag vs. Click-to-Expand Badge */}
                    <g transform={`translate(${door.label_x}, ${door.label_y}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {isSelected ? (
                        <g>
                          <rect
                            x={-55}
                            y={-10}
                            width={110}
                            height={20}
                            rx={4}
                            fill="rgba(15, 23, 42, 0.95)"
                            stroke="#FACC15"
                            strokeWidth="1.2"
                          />
                          <text textAnchor="middle" alignmentBaseline="middle" fill="#FACC15" fontSize="8.5" fontWeight="700">
                            {`🚪 ${door.id} • ${door.width_mm}mm`}
                          </text>
                        </g>
                      ) : (
                        <text textAnchor="middle" alignmentBaseline="middle" fill="#FACC15" fontSize="7.5" fontWeight="600" style={{ textShadow: '0px 1px 4px rgba(0,0,0,0.9)' }}>
                          {door.id}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* LAYER_DIMENSIONS */}
          {showDimensions && (
            <g
              id="LAYER_DIMENSIONS"
              style={{
                opacity: archVisualState.dimmed ? 0.15 : 1.0,
                pointerEvents: archVisualState.interactive ? 'auto' : 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              {solveData?.dimensions?.map((dim) => (
                <g key={dim.id} className="cad-dimension-group">
                  <line x1={dim.dim_x1} y1={dim.dim_y1} x2={dim.dim_x2} y2={dim.dim_y2} stroke="#38BDF8" strokeWidth={1.5 / zoom} />
                  <line x1={dim.ext1_x1} y1={dim.ext1_y1} x2={dim.ext1_x2} y2={dim.ext1_y2} stroke="rgba(56, 189, 248, 0.6)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
                  <line x1={dim.ext2_x1} y1={dim.ext2_y1} x2={dim.ext2_x2} y2={dim.ext2_y2} stroke="rgba(56, 189, 248, 0.6)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
                  <line x1={dim.tick1_x1} y1={dim.tick1_y1} x2={dim.tick1_x2} y2={dim.tick1_y2} stroke="#38BDF8" strokeWidth={2 / zoom} />
                  <line x1={dim.tick2_x1} y1={dim.tick2_y1} x2={dim.tick2_x2} y2={dim.tick2_y2} stroke="#38BDF8" strokeWidth={2 / zoom} />
                  <g transform={`translate(${dim.label_x}, ${dim.label_y}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    <text textAnchor="middle" alignmentBaseline="middle" fill="#38BDF8" fontSize="9.5" fontWeight="600" style={{ textShadow: '0px 1px 4px rgba(15, 23, 42, 0.95)' }}>
                      {dim.label}
                    </text>
                  </g>
                </g>
              ))}
            </g>
          )}

          {/* LAYER_HVAC */}
          {showHvac && (
            <g
              id="LAYER_HVAC"
              style={{
                opacity: hvacVisualState.opacity,
                pointerEvents: hvacVisualState.interactive ? 'auto' : 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              {solveData?.hvac_pipes?.map((pipe, pidx) => {
                let pts = pipe.path_points || [];
                let lengthMm = pipe.total_length_mm || 0;

                // Live dynamic stretching during drag of HVAC unit
                if (dragState?.type === "HVAC" && dragState?.item?.id) {
                  const draggingId = dragState.item.id;
                  const isFrom = pipe.from_unit_id === draggingId;
                  const isTo = pipe.to_unit_id === draggingId;

                  if (isFrom || isTo) {
                    const fromEq = (solveData?.hvac_equipment || []).find(e => e.id === pipe.from_unit_id);
                    const toEq = (solveData?.hvac_equipment || []).find(e => e.id === pipe.to_unit_id);
                    const tx = dragState.dx || 0;
                    const ty = dragState.dy || 0;

                    const fromX = (fromEq?.x ?? fromEq?.location_x ?? 0) + (isFrom ? tx : 0);
                    const fromY = (fromEq?.y ?? fromEq?.location_y ?? 0) + (isFrom ? ty : 0);
                    const toX = (toEq?.x ?? toEq?.location_x ?? 0) + (isTo ? tx : 0);
                    const toY = (toEq?.y ?? toEq?.location_y ?? 0) + (isTo ? ty : 0);

                    const idu_conn = [fromX, fromY + (fromEq?.height || 260) / 2.0];
                    const odu_conn = [toX, toY - (toEq?.height || 380) / 2.0];

                    const dx = Math.abs(odu_conn[0] - idu_conn[0]);
                    const dy = Math.abs(odu_conn[1] - idu_conn[1]);
                    if (dy >= dx) {
                      const midY = idu_conn[1] + (odu_conn[1] - idu_conn[1]) * 0.5;
                      pts = [idu_conn, [idu_conn[0], midY], [odu_conn[0], midY], odu_conn];
                    } else {
                      const midX = idu_conn[0] + (odu_conn[0] - idu_conn[0]) * 0.5;
                      pts = [idu_conn, [midX, idu_conn[1]], [midX, odu_conn[1]], odu_conn];
                    }

                    lengthMm = 0;
                    for (let i = 0; i < pts.length - 1; i++) {
                      lengthMm += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
                    }
                  }
                }

                const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(" ");
                const midIdx = Math.floor(pts.length / 2);
                const midPt = pts[midIdx] || [0, 0];
                const isSelected = Boolean(selectedItem?.item?.pipe_id === pipe.pipe_id || selectedItem?.item?.id === pipe.pipe_id);
                return (
                  <g
                    key={`pipe-group-${pipe.pipe_id}-${pidx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem({ type: "HVACPipe", item: pipe });
                    }}
                    style={{ cursor: "pointer", filter: isSelected ? "drop-shadow(0px 0px 6px #A855F7)" : "none" }}
                  >
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="rgba(168, 85, 247, 0.35)"
                      strokeWidth={6 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#C084FC"
                      strokeWidth={2.5 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {pipe.path_points.map((pt, idx) => (
                      <circle
                        key={`pt-${idx}`}
                        cx={pt[0]}
                        cy={pt[1]}
                        r={3.5 / zoom}
                        fill="#A855F7"
                        stroke="#FFFFFF"
                        strokeWidth={1 / zoom}
                      />
                    ))}
                    {/* HVAC Pipe label: Compact resting tag vs. Click-to-Expand Badge */}
                    <g transform={`translate(${midPt[0]}, ${midPt[1] + 10 / zoom}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {isSelected ? (
                        <g>
                          <rect
                            x={-85}
                            y={-11}
                            width={170}
                            height={22}
                            rx={4}
                            fill="rgba(15, 23, 42, 0.95)"
                            stroke="#A855F7"
                            strokeWidth="1.2"
                          />
                          <text
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill="#E9D5FF"
                            fontSize="8.5"
                            fontWeight="700"
                          >
                            {`❄ ${pipe.pipe_id} [${pipe.liquid_size || '1/4"'} + ${pipe.suction_size || '1/2"'}] • ${(lengthMm / 1000).toFixed(1)}m`}
                          </text>
                        </g>
                      ) : (
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fill="#E9D5FF"
                          fontSize="6.5"
                          fontWeight="600"
                          style={{ textShadow: '0px 1px 3px rgba(15, 23, 42, 0.95)' }}
                        >
                          {pipe.pipe_id}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {solveData?.hvac_equipment?.map((eq, eidx) => {
                const isODU = eq.unit_type.toLowerCase().includes("odu");
                const hw = eq.width / 2.0;
                const hh = eq.height / 2.0;
                const color = isODU ? "#EC4899" : "#A855F7";
                const bgFill = isODU ? "rgba(236, 72, 153, 0.2)" : "rgba(168, 85, 247, 0.25)";

                const isDragging = dragState?.item?.id === eq.id && dragState?.type === "HVAC";
                const tx = isDragging ? dragState.dx : 0;
                const ty = isDragging ? dragState.dy : 0;
                const isSelected = selectedItem?.item?.id === eq.id;

                return (
                  <g 
                    key={`eq-${eq.id}-${eidx}`}
                    transform={isDragging ? `translate(${tx}, ${ty})` : undefined}
                    onPointerDown={(e) => {
                      if (!hvacVisualState.interactive && !isSelected) return;
                      e.stopPropagation();
                      setSelectedItem({ type: "HVAC", item: eq });
                      const pt = getSvgCoordinates(e);
                      setDragState({
                        type: "HVAC",
                        item: eq,
                        startCursorX: pt.x,
                        startCursorY: pt.y,
                        startOffsetX: eq.x ?? eq.location_x ?? 0,
                        startOffsetY: eq.y ?? eq.location_y ?? 0,
                        dx: 0,
                        dy: 0
                      });
                    }}
                    style={{ 
                      cursor: (hvacVisualState.interactive || isSelected) ? (isDragging ? "grabbing" : "grab") : "default",
                      opacity: isSelected ? 1 : undefined,
                      filter: (isSelected || isDragging) ? "drop-shadow(0px 0px 6px #C084FC)" : "none",
                      pointerEvents: (hvacVisualState.interactive || isSelected) ? "all" : "none"
                    }}
                  >
                    <rect
                      x={eq.x - hw}
                      y={eq.y - hh}
                      width={eq.width}
                      height={eq.height}
                      rx={4 / zoom}
                      fill={bgFill}
                      stroke={color}
                      strokeWidth={2 / zoom}
                    />
                    {isODU ? (
                      <g>
                        <circle
                          cx={eq.x}
                          cy={eq.y}
                          r={Math.min(hw, hh) * 0.7}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5 / zoom}
                          strokeDasharray={`${6 / zoom} ${3 / zoom}`}
                        />
                        <line x1={eq.x - 60} y1={eq.y} x2={eq.x + 60} y2={eq.y} stroke={color} strokeWidth={1.5 / zoom} />
                        <line x1={eq.x} y1={eq.y - 60} x2={eq.x} y2={eq.y + 60} stroke={color} strokeWidth={1.5 / zoom} />
                      </g>
                    ) : (
                      <g>
                        <line x1={eq.x - hw + 60} y1={eq.y - 30} x2={eq.x + hw - 60} y2={eq.y - 30} stroke={color} strokeWidth={1.5 / zoom} />
                        <line x1={eq.x - hw + 60} y1={eq.y + 30} x2={eq.x + hw - 60} y2={eq.y + 30} stroke={color} strokeWidth={1.5 / zoom} />
                      </g>
                    )}
                    {/* HVAC Equipment label: Compact resting tag vs. Click-to-Expand Badge */}
                    <g transform={`translate(${eq.label_x}, ${eq.label_y}) scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {isSelected ? (
                        <g>
                          <rect
                            x={-80}
                            y={-22}
                            width={160}
                            height={44}
                            rx={8}
                            fill="rgba(15, 23, 42, 0.96)"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                          <text
                            y={-7}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill="#F8FAFC"
                            fontSize="9.5"
                            fontWeight="700"
                          >
                            {`❄️ ${eq.id} • ${isODU ? 'ODU' : 'Split-IDU'}`}
                          </text>
                          <text
                            y={9}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill={color}
                            fontSize="8"
                            fontWeight="600"
                          >
                            {`${(eq.capacity_tr || 1.5).toFixed(1)} TR  •  ${Math.round(eq.cfm || 600)} CFM${eq.room_name ? ` • ${eq.room_name}` : ''}`}
                          </text>
                        </g>
                      ) : (
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fill={color}
                          fontSize="7.5"
                          fontWeight="bold"
                          style={{ textShadow: '0px 1px 3px rgba(15, 23, 42, 0.95)' }}
                        >
                          {eq.id}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* Central Ducted HVAC Air Handling Unit (AHU) */}
              {(solveData?.hvac_equipment || []).filter(eq => eq.unit_type === 'Central-AHU' || eq.type === 'AHU').map((ahu, aIdx) => {
                const w = ahu.width || 600;
                const h = ahu.height || 900;
                return (
                  <g key={`ahu-${ahu.id || aIdx}`} className="cad-ahu-unit">
                    <rect
                      x={ahu.x - w / 2}
                      y={ahu.y - h / 2}
                      width={w}
                      height={h}
                      rx={8 / zoom}
                      fill="rgba(249, 115, 22, 0.22)"
                      stroke="#F97316"
                      strokeWidth={2.5 / zoom}
                    />
                    <circle cx={ahu.x} cy={ahu.y} r={Math.min(w, h) * 0.35} fill="none" stroke="#F97316" strokeWidth={1.5 / zoom} strokeDasharray={`${8 / zoom} ${4 / zoom}`} />
                    <line x1={ahu.x - w / 2} y1={ahu.y} x2={ahu.x + w / 2} y2={ahu.y} stroke="#F97316" strokeWidth={1.2 / zoom} />
                    <g transform={`translate(${ahu.x}, ${ahu.y - h / 2 - 120}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect x="-90" y="-12" width="180" height="24" rx="4" fill="#0F172A" stroke="#F97316" strokeWidth="1.2" />
                      <text x="0" y="4" textAnchor="middle" dominantBaseline="middle" fill="#FED7AA" fontSize="10" fontWeight="800">
                        💨 {ahu.name || 'AHU-01'}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Central Ducted HVAC Duct Segments (Supply / Return / Branch) */}
              {(solveData?.hvac_ducts || []).map((duct, dIdx) => {
                const p1 = duct.p1 || [0, 0];
                const p2 = duct.p2 || [0, 0];
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const len = Math.hypot(dx, dy);
                if (len < 1) return null;
                const nx = -dy / len;
                const ny = dx / len;
                const halfW = (duct.width || 300) / 2;
                const c1 = [p1[0] + nx * halfW, p1[1] + ny * halfW];
                const c2 = [p2[0] + nx * halfW, p2[1] + ny * halfW];
                const c3 = [p2[0] - nx * halfW, p2[1] - ny * halfW];
                const c4 = [p1[0] - nx * halfW, p1[1] - ny * halfW];
                const polyPoints = `${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${c3[0]},${c3[1]} ${c4[0]},${c4[1]}`;
                const midX = (p1[0] + p2[0]) / 2;
                const midY = (p1[1] + p2[1]) / 2;
                const isTrunk = duct.system === 'SUPPLY';
                const ductColor = isTrunk ? '#F97316' : '#FB923C';

                // Aerodynamic Airflow Direction Indicator Chevron (SMACNA Standard)
                const ux = dx / len;
                const uy = dy / len;
                const arrowDist = Math.min(len * 0.75, Math.max(len * 0.25, len / 2));
                const ax = p1[0] + ux * arrowDist;
                const ay = p1[1] + uy * arrowDist;
                const aLen = Math.min(120, len * 0.25);
                const aWidth = Math.min(halfW * 0.6, 50);
                const aLeftX = ax - ux * aLen - ny * aWidth;
                const aLeftY = ay - uy * aLen + nx * aWidth;
                const aRightX = ax - ux * aLen + ny * aWidth;
                const aRightY = ay - uy * aLen - nx * aWidth;
                const aInnerX = ax - ux * (aLen * 0.5);
                const aInnerY = ay - uy * (aLen * 0.5);

                return (
                  <g key={`duct-${duct.id || dIdx}`} className="cad-hvac-duct">
                    <polygon
                      points={polyPoints}
                      fill={isTrunk ? "rgba(249, 115, 22, 0.16)" : "rgba(251, 146, 60, 0.12)"}
                      stroke={ductColor}
                      strokeWidth={2 / zoom}
                      strokeLinejoin="miter"
                    />
                    <line
                      x1={p1[0]}
                      y1={p1[1]}
                      x2={p2[0]}
                      y2={p2[1]}
                      stroke={ductColor}
                      strokeWidth={1.2 / zoom}
                      strokeDasharray={`${80 / zoom} ${40 / zoom}`}
                    />
                    {len > 350 && (
                      <polygon
                        points={`${ax},${ay} ${aLeftX},${aLeftY} ${aInnerX},${aInnerY} ${aRightX},${aRightY}`}
                        fill={ductColor}
                        opacity="0.8"
                      />
                    )}
                    {len > 550 && (
                      <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                        <rect x="-85" y="-10" width="170" height="20" rx="4" fill="#0F172A" stroke={ductColor} strokeWidth="1" />
                        <text x="0" y="3.5" textAnchor="middle" dominantBaseline="middle" fill="#FED7AA" fontSize="8" fontWeight="700">
                          {duct.label || `${duct.width}x${duct.height} (${duct.cfm || 200} CFM)`}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 4-Way Ceiling Diffusers */}
              {(solveData?.hvac_diffusers || []).map((diff, dfIdx) => {
                const s = diff.size || 450;
                const hs = s / 2;
                return (
                  <g key={`diff-${diff.id || dfIdx}`} className="cad-diffuser">
                    <rect
                      x={diff.x - hs}
                      y={diff.y - hs}
                      width={s}
                      height={s}
                      fill="rgba(14, 165, 233, 0.25)"
                      stroke="#0EA5E9"
                      strokeWidth={2 / zoom}
                    />
                    <rect
                      x={diff.x - hs * 0.5}
                      y={diff.y - hs * 0.5}
                      width={s * 0.5}
                      height={s * 0.5}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={1.5 / zoom}
                    />
                    <line x1={diff.x - hs} y1={diff.y - hs} x2={diff.x - hs * 0.5} y2={diff.y - hs * 0.5} stroke="#38BDF8" strokeWidth={1.2 / zoom} />
                    <line x1={diff.x + hs} y1={diff.y - hs} x2={diff.x + hs * 0.5} y2={diff.y - hs * 0.5} stroke="#38BDF8" strokeWidth={1.2 / zoom} />
                    <line x1={diff.x - hs} y1={diff.y + hs} x2={diff.x - hs * 0.5} y2={diff.y + hs * 0.5} stroke="#38BDF8" strokeWidth={1.2 / zoom} />
                    <line x1={diff.x + hs} y1={diff.y + hs} x2={diff.x + hs * 0.5} y2={diff.y + hs * 0.5} stroke="#38BDF8" strokeWidth={1.2 / zoom} />
                    <g transform={`translate(${diff.x}, ${diff.y - hs - 70}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect x="-55" y="-8" width="110" height="16" rx="3" fill="#0F172A" stroke="#0EA5E9" strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" dominantBaseline="middle" fill="#BAE6FD" fontSize="8.5" fontWeight="700">
                        💨 {diff.cfm || 150} CFM
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Central Return Air Grille (RAG) */}
              {(solveData?.hvac_return_grilles || []).map((rag, rIdx) => {
                const s = rag.size || 500;
                const hs = s / 2;
                return (
                  <g key={`rag-${rag.id || rIdx}`} className="cad-return-grille">
                    <rect
                      x={rag.x - hs}
                      y={rag.y - hs}
                      width={s}
                      height={s}
                      fill="rgba(168, 85, 247, 0.25)"
                      stroke="#A855F7"
                      strokeWidth={2 / zoom}
                    />
                    <line x1={rag.x - hs + 40} y1={rag.y - hs + 40} x2={rag.x + hs - 40} y2={rag.y + hs - 40} stroke="#A855F7" strokeWidth={1.5 / zoom} />
                    <line x1={rag.x - hs + 40} y1={rag.y + hs - 40} x2={rag.x + hs - 40} y2={rag.y - hs + 40} stroke="#A855F7" strokeWidth={1.5 / zoom} />
                    <g transform={`translate(${rag.x}, ${rag.y - hs - 70}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect x="-60" y="-8" width="120" height="16" rx="3" fill="#0F172A" stroke="#A855F7" strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" dominantBaseline="middle" fill="#E9D5FF" fontSize="8.5" fontWeight="700">
                        🔄 RAG ({rag.cfm || 600} CFM)
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* LAYER_ELECTRICAL */}
          {showElectrical && (
            <g
              id="LAYER_ELECTRICAL"
              style={{
                opacity: electVisualState.opacity,
                pointerEvents: electVisualState.interactive ? 'auto' : 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              {/* LAYER_ELECTRICAL_ROUTES (Rendered below components) */}
              <g id="LAYER_ELECTRICAL_ROUTES">
                {(electricalRoutes || []).map((route, rIdx) => {
                  let pts = route.points || [];
                  if (pts.length < 2) return null;

                  // Live dynamic Manhattan routing during drag of electrical component (fan, light, socket, switch, DB)
                  if (dragState?.type === 'ElectricalComponent' && dragState?.item?.id) {
                    const draggingId = dragState.item.id;
                    const origX = dragState.item.x ?? 0;
                    const origY = dragState.item.y ?? 0;
                    const tx = dragState.dx || 0;
                    const ty = dragState.dy || 0;
                    const dragX = origX + tx;
                    const dragY = origY + ty;

                    const isFrom = route.from_component_id === draggingId ||
                      (Math.hypot(pts[0][0] - origX, pts[0][1] - origY) < 60);
                    const isTo = route.to_component_id === draggingId ||
                      (Math.hypot(pts[pts.length - 1][0] - origX, pts[pts.length - 1][1] - origY) < 60);

                    if (isFrom || isTo) {
                      const p1 = isFrom ? [dragX, dragY] : [...pts[0]];
                      const p2 = isTo ? [dragX, dragY] : [...pts[pts.length - 1]];

                      if (Math.abs(p1[0] - p2[0]) < 1 || Math.abs(p1[1] - p2[1]) < 1) {
                        pts = [p1, p2];
                      } else {
                        const dx = Math.abs(p2[0] - p1[0]);
                        const dy = Math.abs(p2[1] - p1[1]);
                        if (dx >= dy) {
                          pts = [p1, [p2[0], p1[1]], p2];
                        } else {
                          pts = [p1, [p1[0], p2[1]], p2];
                        }
                      }
                    }
                  }

                  const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
                  const conduitStyle = CONDUIT_STYLES[route.conduit_type] || CONDUIT_STYLES.slab_conduit;
                  
                  return (
                    <g key={`route-${route.id || rIdx}`} className="electrical-conduit-route">
                      {/* Outer conduit casing */}
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke={conduitStyle.color || '#F59E0B'}
                        strokeWidth={(conduitStyle.strokeWidth || 2.5) / zoom}
                        strokeDasharray={conduitStyle.dasharray ? conduitStyle.dasharray.split(' ').map(n => n / zoom).join(' ') : 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.8}
                      />
                      {/* Inner Phase line */}
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth={1.2 / zoom}
                        opacity={0.9}
                      />
                    </g>
                  );
                })}

                {/* Conduit Crossover Jumper Arcs ("Wire Hops") at orthogonal intersections */}
                {conduitCrossings.map((cross, cIdx) => {
                  const r = 40; // 40mm jumper arc radius
                  const cStyle = CONDUIT_STYLES[cross.conduitType] || CONDUIT_STYLES.slab_conduit;
                  return (
                    <g key={`conduit-hop-${cIdx}`} className="cad-conduit-hop" style={{ pointerEvents: 'none' }}>
                      {/* Background mask disc to break the perpendicular wire underneath */}
                      <circle cx={cross.x} cy={cross.y} r={r * 0.9} fill="#0F172A" />
                      {/* Semicircular bridge arc jumping over the intersection */}
                      <path
                        d={`M ${cross.x - r} ${cross.y} A ${r} ${r} 0 0 1 ${cross.x + r} ${cross.y}`}
                        fill="none"
                        stroke={cStyle.color || '#F59E0B'}
                        strokeWidth={(cStyle.strokeWidth || 2.5) / zoom}
                        strokeDasharray={cStyle.dasharray ? cStyle.dasharray.split(' ').map(n => n / zoom).join(' ') : 'none'}
                        strokeLinecap="round"
                      />
                      {/* Inner Phase line arc */}
                      <path
                        d={`M ${cross.x - r} ${cross.y} A ${r} ${r} 0 0 1 ${cross.x + r} ${cross.y}`}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth={1.2 / zoom}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>

              {/* LAYER_ELECTRICAL_COMPONENTS */}
              <g id="LAYER_ELECTRICAL_COMPONENTS">
                {(electricalComponents || []).map((comp, cIdx) => {
                  const isDragging = dragState?.type === 'ElectricalComponent' && dragState?.item?.id === comp.id;
                  const isRotating = dragState?.type === 'ElectricalComponentRotate' && dragState?.item?.id === comp.id;
                  const tx = isDragging ? (dragState.dx || 0) : 0;
                  const ty = isDragging ? (dragState.dy || 0) : 0;
                  const cx = (comp.x || 0) + tx;
                  const cy = (comp.y || 0) + ty;
                  const rot = isRotating ? (dragState.currentRotation ?? Number(comp.rotation) ?? 0) : (Number(comp.rotation) || 0);
                  const isSelected = selectedItem?.item?.id === comp.id;

                  const rotRad = (rot * Math.PI) / 180;
                  const Ledge = 80;
                  const Lhandle = Ledge + Math.max(100, 28 / zoom);
                  const Lbtn = Lhandle + Math.max(90, 24 / zoom);

                  const topEdgeX = cx - Ledge * Math.sin(rotRad);
                  const topEdgeY = cy + Ledge * Math.cos(rotRad);
                  const handleX  = cx - Lhandle * Math.sin(rotRad);
                  const handleY  = cy + Lhandle * Math.cos(rotRad);
                  const btnX     = cx - Lbtn * Math.sin(rotRad);
                  const btnY     = cy + Lbtn * Math.cos(rotRad);

                  return (
                    <g key={`el-${comp.id || cIdx}`}>
                      <g
                        transform={`translate(${cx}, ${cy}) rotate(${rot})`}
                        onPointerDown={(e) => {
                          if (!electVisualState.interactive && !isSelected) return;
                          e.stopPropagation();
                          setSelectedItem({ type: "ElectricalComponent", item: comp });
                          const pt = getSvgCoordinates(e);
                          setDragState({
                            type: "ElectricalComponent",
                            item: comp,
                            startCursorX: pt.x,
                            startCursorY: pt.y,
                            startOffsetX: comp.x || 0,
                            startOffsetY: comp.y || 0,
                            dx: 0,
                            dy: 0
                          });
                        }}
                        style={{
                          cursor: (electVisualState.interactive || isSelected) ? (isDragging ? 'grabbing' : 'grab') : 'default',
                          opacity: isSelected ? 1 : undefined,
                          filter: isSelected ? 'drop-shadow(0px 0px 8px #F59E0B)' : 'none',
                          pointerEvents: (electVisualState.interactive || isSelected) ? 'all' : 'none'
                        }}
                      >
                        {renderElectricalShape(comp, isSelected, false)}
                      </g>

                      {/* Interactive Canvas Rotation Controls for Selected Electrical Fixture */}
                      {isSelected && (
                        <g className="electrical-interactive-rotation-group">
                          {/* Stem line */}
                          <line
                            x1={topEdgeX}
                            y1={topEdgeY}
                            x2={handleX}
                            y2={handleY}
                            stroke="#F59E0B"
                            strokeWidth={1.8 / zoom}
                            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                            strokeOpacity={0.85}
                          />

                          {/* Circular Rotation Handle */}
                          <g
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const pt = getSvgCoordinates(e);
                              const curRot = Number(comp.rotation) || 0;
                              const startAngle = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI;
                              setDragState({
                                type: "ElectricalComponentRotate",
                                item: comp,
                                centerX: cx,
                                centerY: cy,
                                initialRotation: curRot,
                                startCursorAngle: startAngle,
                                currentRotation: curRot
                              });
                            }}
                            style={{ cursor: isRotating ? "grabbing" : "grab" }}
                            title="Drag to rotate fixture"
                          >
                            <circle cx={handleX} cy={handleY} r={16 / zoom} fill="transparent" />
                            <circle cx={handleX} cy={handleY} r={9 / zoom} fill="#D97706" stroke="#FFFFFF" strokeWidth={2 / zoom} />
                            <circle cx={handleX} cy={handleY} r={3.5 / zoom} fill="#FFFFFF" />
                          </g>

                          {/* Quick 90° Rotate Pill Button */}
                          <g
                            transform={`translate(${btnX}, ${btnY}) scale(${1 / zoom}, ${-1 / zoom})`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const curRot = Number(comp.rotation) || 0;
                              const nextRot = (curRot + 90) % 360;
                              if (onLiveItemUpdate) {
                                onLiveItemUpdate("UpdateElectricalComponent", comp.id, { rotation: nextRot });
                              }
                              setSelectedItem(prev => (prev?.item?.id === comp.id) 
                                ? { ...prev, item: { ...prev.item, rotation: nextRot } } 
                                : prev);
                            }}
                            style={{ cursor: "pointer" }}
                            title="Click to rotate +90°"
                          >
                            <rect x="-26" y="-11" width="52" height="22" rx="11" fill="#B45309" stroke="#FDE047" strokeWidth={1.2} />
                            <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" style={{ pointerEvents: "none", userSelect: "none" }}>
                              ⟳ 90°
                            </text>
                          </g>

                          {/* Dynamic Angle Indicator Badge during rotation drag */}
                          {isRotating && (
                            <g transform={`translate(${cx}, ${cy - (80 + 25 / zoom)}) scale(${1 / zoom}, ${-1 / zoom})`}>
                              <rect x="-22" y="-10" width="44" height="20" rx="4" fill="#0F172A" stroke="#F59E0B" strokeWidth={1.2} />
                              <text x="0" y="4" textAnchor="middle" fill="#FDE047" fontSize="11" fontWeight="bold">
                                {`${rot}°`}
                              </text>
                            </g>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          )}

          {/* LAYER_ANNOTATIONS */}
          <g
            id="LAYER_ANNOTATIONS"
            style={{
              opacity: archVisualState.dimmed ? 0.35 : 1.0,
              pointerEvents: archVisualState.interactive ? 'auto' : 'none',
              transition: 'opacity 0.2s ease'
            }}
          >
            {solveData?.rooms?.map((room, idx) => {
              const [cx, cy] = room.centroid || [0, 0];
              return (
                <g key={`annotation-${idx}`} transform={`translate(${cx}, ${cy})`}>
                  <g transform={`scale(${1 / zoom}, ${-1 / zoom})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    <text
                      y="-4"
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="10"
                      fontWeight="700"
                      letterSpacing="0.4px"
                      style={{ textShadow: '0px 2px 6px rgba(0,0,0,0.95)' }}
                    >
                      {(room.name || '').toUpperCase()}
                    </text>
                    <text
                      y="10"
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="8"
                      fontWeight="500"
                      style={{ textShadow: '0px 1px 4px rgba(0,0,0,0.95)' }}
                    >
                      {`${(room.carpet_area_sqm || 0).toFixed(1)} m² • ${Math.round(room.carpet_area_sqft || 0)} sq ft`}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* LAYER_CLASH_MARKERS (Multi-Discipline BIM Spatial Clashes) */}
          {solveData?.clash_markers && solveData.clash_markers.length > 0 && (
            <g id="LAYER_CLASH_MARKERS" style={{ pointerEvents: 'none' }}>
              {solveData.clash_markers.map((clash, cIdx) => {
                const cx = clash.center?.x ?? clash.x ?? 0;
                const cy = clash.center?.y ?? clash.y ?? 0;
                const isHard = clash.severity === 'HARD';
                const color = isHard ? '#EF4444' : '#F59E0B';
                const r = 240;
                return (
                  <g key={`clash-${clash.id || cIdx}`} className="cad-clash-indicator">
                    <circle cx={cx} cy={cy} r={r} fill={isHard ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)"} stroke={color} strokeWidth={2 / zoom} strokeDasharray={`${120 / zoom} ${60 / zoom}`} />
                    <circle cx={cx} cy={cy} r={r * 0.4} fill={color} />
                    <g transform={`translate(${cx}, ${cy - r - 80}) scale(${1 / zoom}, ${-1 / zoom})`}>
                      <rect x="-40" y="-10" width="80" height="20" rx="4" fill="#0A0E17" stroke={color} strokeWidth="1" />
                      <text x="0" y="4" textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize="9" fontWeight="800">
                        ⚠️ {clash.severity}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* INTERACTIVE ROOM CORNER & WALL RESIZE HANDLES (Visible only when isResizeModeActive is true and architecture is interactive) */}
          {isResizeModeActive && archVisualState.interactive && (
            <g id="LAYER_ROOM_HANDLES">
              {solveData?.rooms?.map((room, rIdx) => {
                const rawPoints = room.points || [];
                if (rawPoints.length < 4) return null;
                const bounds = getRoomBounds(rawPoints);
                const { minX, maxX, minY, maxY } = bounds;

                const corners = [
                  { idx: 0, x: minX, y: minY, cursor: 'nesw-resize', label: 'BL' },
                  { idx: 1, x: maxX, y: minY, cursor: 'nwse-resize', label: 'BR' },
                  { idx: 2, x: maxX, y: maxY, cursor: 'nesw-resize', label: 'TR' },
                  { idx: 3, x: minX, y: maxY, cursor: 'nwse-resize', label: 'TL' }
                ];

                const wallMidpoints = [
                  { side: 'Bottom', x: (minX + maxX) / 2, y: minY, cursor: 'ns-resize' },
                  { side: 'Right', x: maxX, y: (minY + maxY) / 2, cursor: 'ew-resize' },
                  { side: 'Top', x: (minX + maxX) / 2, y: maxY, cursor: 'ns-resize' },
                  { side: 'Left', x: minX, y: (minY + maxY) / 2, cursor: 'ew-resize' }
                ];

                return (
                  <g key={`room-handles-${rIdx}`}>
                    <rect
                      x={minX} y={minY}
                      width={maxX - minX} height={maxY - minY}
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.25)"
                      strokeWidth={1 / zoom}
                      strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                    />

                    {wallMidpoints.map((w, wIdx) => (
                      <g key={`wall-handle-${wIdx}`}>
                        <rect
                          x={w.side === 'Bottom' || w.side === 'Top' ? w.x - 200 : w.x - (6 / zoom)}
                          y={w.side === 'Left' || w.side === 'Right' ? w.y - 200 : w.y - (6 / zoom)}
                          width={w.side === 'Bottom' || w.side === 'Top' ? 400 : (12 / zoom)}
                          height={w.side === 'Left' || w.side === 'Right' ? 400 : (12 / zoom)}
                          fill="transparent"
                          style={{ cursor: w.cursor }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const pt = getSvgCoordinates(e);
                            setDragState({
                              type: 'RoomResize',
                              mode: 'wall',
                              wallSide: w.side,
                              roomName: room.name,
                              initialBounds: bounds,
                              startCursorX: pt.x,
                              startCursorY: pt.y,
                              currentPoints: rawPoints
                            });
                          }}
                        />
                        <circle
                          cx={w.x} cy={w.y}
                          r={5.5 / zoom}
                          fill="#F59E0B"
                          stroke="#FFFFFF"
                          strokeWidth={1.5 / zoom}
                          style={{ cursor: w.cursor, pointerEvents: 'none' }}
                        />
                      </g>
                    ))}

                    {corners.map((c) => (
                      <g key={`corner-handle-${c.idx}`}>
                        <circle
                          cx={c.x} cy={c.y}
                          r={24 / zoom}
                          fill="transparent"
                          style={{ cursor: c.cursor }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const pt = getSvgCoordinates(e);
                            setDragState({
                              type: 'RoomResize',
                              mode: 'corner',
                              cornerIndex: c.idx,
                              roomName: room.name,
                              initialBounds: bounds,
                              startCursorX: pt.x,
                              startCursorY: pt.y,
                              currentPoints: rawPoints
                            });
                          }}
                        />
                        <circle
                          cx={c.x} cy={c.y}
                          r={8 / zoom}
                          fill="#38BDF8"
                          stroke="#FFFFFF"
                          strokeWidth={2 / zoom}
                          style={{ cursor: c.cursor, pointerEvents: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                        />
                      </g>
                    ))}
                  </g>
                );
              })}
            </g>
          )}

          {/* DYNAMIC LIVE DRAG PREVIEW FOR ROOM RESIZING */}
          {dragState && dragState.type === 'RoomResize' && dragState.currentPoints && (
            <g id="LAYER_RESIZE_PREVIEW">
              <polygon
                points={dragState.currentPoints.map(p => `${p[0]},${p[1]}`).join(" ")}
                fill="rgba(56, 189, 248, 0.22)"
                stroke="#38BDF8"
                strokeWidth={2.5 / zoom}
                strokeDasharray={`${8 / zoom} ${4 / zoom}`}
              />

              {/* Floating Real-Time Bounding Dimension Badge */}
              {(() => {
                const pts = dragState.currentPoints;
                const xs = pts.map(p => p[0]);
                const ys = pts.map(p => p[1]);
                const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                const w = Math.round(dragState.currentWidth || 0);
                const h = Math.round(dragState.currentHeight || 0);
                const area = (dragState.currentAreaSqm || 0).toFixed(1);

                return (
                  <g transform={`translate(${cx}, ${cy}) scale(${1 / zoom}, ${-1 / zoom})`}>
                    <rect
                      x="-110" y="-22"
                      width="220" height="44"
                      rx="8"
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                    />
                    <text textAnchor="middle" y="-4" fill="#38BDF8" fontSize="12" fontWeight="700">
                      {`↔ ${w} mm  ×  ↕ ${h} mm`}
                    </text>
                    <text textAnchor="middle" y="14" fill="#E2E8F0" fontSize="11" fontWeight="600">
                      {`Area: ${area} sq.m`}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* LAYER_TAPE_MEASURE */}
          {tapeMeasureActive && tapeStart && (tapeEnd || tapeHover) && (() => {
            const endPt = tapeEnd || tapeHover;
            const dx = endPt.x - tapeStart.x;
            const dy = endPt.y - tapeStart.y;
            const distMm = Math.hypot(dx, dy);
            const distM = (distMm / 1000).toFixed(2);
            const totalInches = distMm / 25.4;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);
            const midX = (tapeStart.x + endPt.x) / 2;
            const midY = (tapeStart.y + endPt.y) / 2;
            const angleRad = Math.atan2(dy, dx);
            const perpX = -Math.sin(angleRad) * (12 / zoom);
            const perpY = Math.cos(angleRad) * (12 / zoom);

            return (
              <g id="LAYER_TAPE_MEASURE" style={{ pointerEvents: 'none' }}>
                {/* Main measurement line */}
                <line
                  x1={tapeStart.x}
                  y1={tapeStart.y}
                  x2={endPt.x}
                  y2={endPt.y}
                  stroke="#EC4899"
                  strokeWidth={2.5 / zoom}
                  strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                />
                {/* Start crosshair */}
                <circle cx={tapeStart.x} cy={tapeStart.y} r={5 / zoom} fill="#EC4899" stroke="#FFFFFF" strokeWidth={1.5 / zoom} />
                <line x1={tapeStart.x - perpX} y1={tapeStart.y - perpY} x2={tapeStart.x + perpX} y2={tapeStart.y + perpY} stroke="#EC4899" strokeWidth={2 / zoom} />
                {/* End crosshair */}
                <circle cx={endPt.x} cy={endPt.y} r={5 / zoom} fill={tapeEnd ? "#EC4899" : "#F472B6"} stroke="#FFFFFF" strokeWidth={1.5 / zoom} />
                <line x1={endPt.x - perpX} y1={endPt.y - perpY} x2={endPt.x + perpX} y2={endPt.y + perpY} stroke="#EC4899" strokeWidth={2 / zoom} />

                {/* Dimension Badge */}
                <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}, ${-1 / zoom})`}>
                  <rect
                    x="-85"
                    y="-22"
                    width="170"
                    height="44"
                    rx="6"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke="#EC4899"
                    strokeWidth="1.5"
                  />
                  <text textAnchor="middle" y="-4" fill="#F472B6" fontSize="12" fontWeight="700">
                    {`${Math.round(distMm)} mm (${distM} m)`}
                  </text>
                  <text textAnchor="middle" y="14" fill="#E2E8F0" fontSize="10" fontWeight="600">
                    {`${feet}'-${inches}" (${(distMm / 25.4).toFixed(1)} in)`}
                  </text>
                </g>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Floating Canvas Legend Tip */}
      {isResizeModeActive && (
        <div className="exclude-export" style={{
          position: 'absolute',
          bottom: 12,
          left: 16,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '6px 12px',
          fontSize: '11px',
          color: '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          pointerEvents: 'none'
        }}>
          <span><strong style={{ color: '#38BDF8' }}>🔵 Cyan Dots:</strong> Drag Room Corners</span>
          <span><strong style={{ color: '#F59E0B' }}>🟠 Orange Dots:</strong> Drag Room Walls</span>
          <span><strong style={{ color: '#10B981' }}>🖱 Pan:</strong> Drag Background</span>
        </div>
      )}

      {/* Interactive Overlay for Selected Item */}
      {selectedItem && (
        <div className="exclude-export" style={{
          position: "absolute", top: 16, right: 16, width: 280,
          background: "rgba(15, 23, 42, 0.95)", border: "1px solid #334155",
          borderRadius: 8, padding: 16, color: "white", zIndex: 50,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: "#38BDF8" }}>Edit {selectedItem.type}</h4>
            <button onClick={() => setSelectedItem(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 16 }}>&times;</button>
          </div>
          <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#94A3B8" }}>ID: {selectedItem.item.id}</p>
          
          {selectedItem.type === "Furniture" && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Width (mm)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.width} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate("Furniture", selectedItem.item.id, { width: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}
              />
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Height / Length (mm)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.height} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate("Furniture", selectedItem.item.id, { height: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 12 }}
              />
            </>
          )}

          {selectedItem.type === "PlumbingFixture" && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Width (mm)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.width} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate("UpdatePlumbingFixture", selectedItem.item.id, { width: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}
              />
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Height / Length (mm)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.height} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate("UpdatePlumbingFixture", selectedItem.item.id, { height: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}
              />
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Rotation (°)</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input 
                  type="number" 
                  min="0"
                  max="360"
                  step="15"
                  key={`rot-${selectedItem.item.id}-${selectedItem.item.rotation || 0}`}
                  defaultValue={selectedItem.item.rotation || 0} 
                  onBlur={(e) => {
                    if (onLiveItemUpdate) {
                      const val = ((Number(e.target.value) % 360) + 360) % 360;
                      onLiveItemUpdate("UpdatePlumbingFixture", selectedItem.item.id, { rotation: val });
                    }
                  }}
                  style={{ flex: 1, background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextRot = ((Number(selectedItem.item.rotation || 0) + 90) % 360);
                    if (onLiveItemUpdate) onLiveItemUpdate("UpdatePlumbingFixture", selectedItem.item.id, { rotation: nextRot });
                    setSelectedItem(prev => ({ ...prev, item: { ...prev.item, rotation: nextRot } }));
                  }}
                  title="Quick Rotate 90°"
                  style={{ background: "#0284C7", border: "none", color: "white", padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 12 }}
                >
                  ⟳ 90°
                </button>
              </div>
            </>
          )}

          {(selectedItem.type === "ElectricalComponent" || selectedItem.type === "Electrical") && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Rating / Wattage (W)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.wattage || 0} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate("UpdateElectricalComponent", selectedItem.item.id, { wattage: Number(e.target.value) || 0 });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}
              />
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Assigned Circuit</label>
              <select 
                defaultValue={selectedItem.item.circuit_id || ""}
                onChange={(e) => {
                  const cktVal = e.target.value || null;
                  if (onLiveItemUpdate) onLiveItemUpdate("UpdateElectricalComponent", selectedItem.item.id, { circuit_id: cktVal });
                  setSelectedItem(prev => ({ ...prev, item: { ...prev.item, circuit_id: cktVal } }));
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}
              >
                <option value="">(None / Unassigned)</option>
                {(electricalCircuits || []).map(c => (
                  <option key={c.id} value={c.id}>{c.id}: {c.name}</option>
                ))}
              </select>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Rotation (°)</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input 
                  type="number" 
                  min="0"
                  max="360"
                  step="15"
                  key={`rot-el-${selectedItem.item.id}-${selectedItem.item.rotation || 0}`}
                  defaultValue={selectedItem.item.rotation || 0} 
                  onBlur={(e) => {
                    if (onLiveItemUpdate) {
                      const val = ((Number(e.target.value) % 360) + 360) % 360;
                      onLiveItemUpdate("UpdateElectricalComponent", selectedItem.item.id, { rotation: val });
                    }
                  }}
                  style={{ flex: 1, background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextRot = ((Number(selectedItem.item.rotation || 0) + 90) % 360);
                    if (onLiveItemUpdate) onLiveItemUpdate("UpdateElectricalComponent", selectedItem.item.id, { rotation: nextRot });
                    setSelectedItem(prev => ({ ...prev, item: { ...prev.item, rotation: nextRot } }));
                  }}
                  title="Quick Rotate 90°"
                  style={{ background: "#F59E0B", border: "none", color: "#111418", padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 12 }}
                >
                  ⟳ 90°
                </button>
              </div>
            </>
          )}

          {(selectedItem.type === "Door" || selectedItem.type === "Window") && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Width (mm)</label>
              <input 
                type="number" 
                defaultValue={selectedItem.item.width_mm} 
                onBlur={(e) => {
                  if (onLiveItemUpdate) onLiveItemUpdate(selectedItem.type, selectedItem.item.id, { width_mm: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 12 }}
              />
            </>
          )}

          {selectedItem.type === "HVAC" && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Cooling Capacity (TR)</label>
              <input 
                type="number" 
                step="0.5" 
                defaultValue={selectedItem.item.cooling_capacity_tr} 
                onBlur={(e) => {
                  if(onLiveItemUpdate) onLiveItemUpdate("HVAC", selectedItem.item.id, { cooling_capacity_tr: Number(e.target.value) });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 12 }}
              />
            </>
          )}

          {(selectedItem.type === "Door") && (
            <>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Swing</label>
              <select 
                defaultValue={selectedItem.item.swing} 
                onChange={(e) => {
                  if(onLiveItemUpdate) onLiveItemUpdate(selectedItem.type, selectedItem.item.id, { swing: e.target.value });
                }}
                style={{ width: "100%", background: "#1E293B", border: "1px solid #475569", color: "white", padding: "6px 8px", borderRadius: 4, marginBottom: 12 }}
              >
                <option value="Inward-Left">Inward-Left</option>
                <option value="Inward-Right">Inward-Right</option>
                <option value="Outward-Left">Outward-Left</option>
                <option value="Outward-Right">Outward-Right</option>
              </select>
            </>
          )}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                if (!selectedItem || !selectedItem.item) return;
                const id = selectedItem.item.id;
                const type = selectedItem.type;
                if (type === "Furniture") onLiveItemUpdate?.("DeleteFurniture", id);
                else if (type === "PlumbingFixture") onLiveItemUpdate?.("DeletePlumbingFixture", id);
                else if (type === "PlumbingPipe") onLiveItemUpdate?.("DeletePlumbingPipe", id);
                else if (type === "ElectricalComponent" || type === "Electrical") onLiveItemUpdate?.("DeleteElectricalComponent", id);
                else if (type === "HVAC") onLiveItemUpdate?.("DeleteHVAC", id);
                else if (type === "Door" || type === "Window") onLiveItemUpdate?.("DeleteOpening", id);
                setSelectedItem(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.color = "#FFFFFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; e.currentTarget.style.color = "#FCA5A5"; }}
              title="Delete this item from canvas (or press Delete key)"
            >
              🗑️ Delete {selectedItem.type}
            </button>
            <span style={{ fontSize: 10, color: "#64748B" }}>or press Del key</span>
          </div>
          <p style={{ fontSize: 11, color: "#64748B", margin: "10px 0 0 0" }}>Tip: Drag item or press Delete key to remove.</p>
        </div>
      )}

      {/* Floating Active Discipline Badge in Viewport */}
      {disciplineView !== DISCIPLINE_VIEWS.ALL && (
        <div
          className="cad-viewport-discipline-badge"
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${activeDisciplineConfig.color || '#38BDF8'}`,
            padding: '5px 12px',
            borderRadius: '20px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 15,
            userSelect: 'none'
          }}
        >
          <span style={{ fontSize: '13px' }}>{activeDisciplineConfig.icon}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em' }}>
            {activeDisciplineConfig.shortLabel} VIEW
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: disciplineDisplayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? '#F59E0B' : '#94A3B8',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '1px 6px',
              borderRadius: '10px'
            }}
          >
            {disciplineDisplayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? 'ISOLATED' : 'GHOSTED'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onDisciplineChange) onDisciplineChange(DISCIPLINE_VIEWS.ALL);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0 2px',
              marginLeft: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Reset to All Disciplines View (Shortcut: 1)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Tape Measure Toggle & Status Bar */}
      <div
        className="cad-tape-measure-toggle exclude-export"
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <button
          type="button"
          onClick={() => {
            setTapeMeasureActive(prev => {
              if (prev) {
                setTapeStart(null);
                setTapeEnd(null);
                setTapeHover(null);
                return false;
              }
              return true;
            });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: tapeMeasureActive ? '#DB2777' : 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#FFFFFF',
            border: tapeMeasureActive ? '1px solid #F472B6' : '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.15s ease'
          }}
          title="Tape Measure Tool (Shortcut: M / Esc to cancel)"
        >
          <span>📏</span>
          <span>{tapeMeasureActive ? 'Tape Active (M)' : 'Tape Measure (M)'}</span>
        </button>
        {tapeMeasureActive && (
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.90)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#CBD5E1'
            }}
          >
            {!tapeStart ? 'Click 1st point to measure' : !tapeEnd ? 'Click 2nd point to lock measurement' : 'Measurement locked. Click again for new, or Esc to exit.'}
          </div>
        )}
      </div>
    </div>
  );
}

