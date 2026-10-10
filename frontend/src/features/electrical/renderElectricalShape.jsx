/**
 * frontend/src/features/electrical/renderElectricalShape.jsx
 * ==========================================================
 * Professional CAD Vector SVG symbol renderer for 16 standard electrical fixtures.
 * Renders centered at (0, 0) inside a transformed SVG <g> group.
 */

import React from 'react';
import { ELECTRICAL_FIXTURES } from './electricalTypes';

export function renderElectricalShape(component, isSelected = false, isHovered = false) {
  const typeKey = (component.type || '').toLowerCase().trim();
  const spec = ELECTRICAL_FIXTURES[typeKey] || {
    width: component.width_mm || 150,
    height: component.height_mm || 150,
    color: '#F59E0B',
    symbol: 'generic'
  };

  const w = component.width_mm || spec.width || 150;
  const h = component.height_mm || spec.height || 150;
  const hw = w / 2;
  const hh = h / 2;
  const primaryColor = isSelected ? '#38BDF8' : isHovered ? '#FDE047' : spec.color || '#F59E0B';
  const strokeColor = isSelected ? '#38BDF8' : '#E2E8F0';
  const strokeWidth = isSelected ? 2.5 : 1.5;

  const renderSymbolContent = () => {
    switch (spec.symbol) {
      // 1. RECESSED DOWNLIGHT
      case 'circle_cross': {
        const r = Math.min(hw, hh) * 0.85;
        return (
          <>
            <circle cx="0" cy="0" r={r} fill="rgba(245, 158, 11, 0.15)" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-r * 0.7} y1={-r * 0.7} x2={r * 0.7} y2={r * 0.7} stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={r * 0.7} y1={-r * 0.7} x2={-r * 0.7} y2={r * 0.7} stroke={primaryColor} strokeWidth={strokeWidth} />
          </>
        );
      }

      // 2. LINEAR TUBE LIGHT
      case 'linear_tube': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="4" fill="rgba(251, 191, 36, 0.2)" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-hw + 15} y1="0" x2={hw - 15} y2="0" stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
            <circle cx={-hw + 15} cy="0" r="3" fill={primaryColor} />
            <circle cx={hw - 15} cy="0" r="3" fill={primaryColor} />
          </>
        );
      }

      // 3. WALL SCONCE
      case 'semicircle_rays': {
        const r = Math.min(hw, hh);
        return (
          <>
            {/* Base plate on wall */}
            <line x1={-hw} y1="0" x2={hw} y2="0" stroke={primaryColor} strokeWidth={strokeWidth * 2} />
            {/* Sconce dome */}
            <path d={`M ${-hw * 0.8} 0 A ${hw * 0.8} ${hh * 0.9} 0 0 1 ${hw * 0.8} 0 Z`} fill="rgba(245, 158, 11, 0.25)" stroke={primaryColor} strokeWidth={strokeWidth} />
            {/* Radial emission rays */}
            <line x1="0" y1={-hh * 0.9} x2="0" y2={-hh * 1.3} stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-hw * 0.5} y1={-hh * 0.7} x2={-hw * 0.8} y2={-hh * 1.1} stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={hw * 0.5} y1={-hh * 0.7} x2={hw * 0.8} y2={-hh * 1.1} stroke={primaryColor} strokeWidth={strokeWidth} />
          </>
        );
      }

      // 4. CHANDELIER
      case 'chandelier_cluster': {
        const r = Math.min(hw, hh) * 0.8;
        return (
          <>
            <circle cx="0" cy="0" r={r} fill="none" stroke={primaryColor} strokeWidth={strokeWidth} strokeDasharray="4 3" />
            <circle cx="0" cy="0" r={r * 0.4} fill="rgba(245, 158, 11, 0.4)" stroke={primaryColor} strokeWidth={strokeWidth} />
            {/* 4 satellite crystal points */}
            {[0, 90, 180, 270].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const px = r * 0.75 * Math.cos(rad);
              const py = r * 0.75 * Math.sin(rad);
              return <circle key={deg} cx={px} cy={py} r={r * 0.2} fill={primaryColor} />;
            })}
          </>
        );
      }

      // 5. BULKHEAD
      case 'bulkhead_oval': {
        return (
          <>
            <ellipse cx="0" cy="0" rx={hw * 0.85} ry={hh * 0.7} fill="rgba(245, 158, 11, 0.18)" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-hw * 0.85} y1="0" x2={hw * 0.85} y2="0" stroke={primaryColor} strokeWidth={strokeWidth * 0.8} />
            <line x1="0" y1={-hh * 0.7} x2="0" y2={hh * 0.7} stroke={primaryColor} strokeWidth={strokeWidth * 0.8} />
          </>
        );
      }

      // 6. CEILING FAN
      case 'three_blade_fan': {
        const r = Math.min(hw, hh) * 0.9;
        return (
          <>
            {/* Outer sweep limit */}
            <circle cx="0" cy="0" r={r} fill="rgba(6, 182, 212, 0.05)" stroke={primaryColor} strokeWidth={1} strokeDasharray="3 3" />
            {/* 3 blades at 120 degrees */}
            {[0, 120, 240].map((deg) => (
              <g key={deg} transform={`rotate(${deg})`}>
                <path d={`M 0 0 C 15 ${-r * 0.4}, 25 ${-r * 0.8}, 0 ${-r} C -25 ${-r * 0.8}, -15 ${-r * 0.4}, 0 0 Z`} fill="rgba(6, 182, 212, 0.35)" stroke={primaryColor} strokeWidth={strokeWidth} />
              </g>
            ))}
            {/* Center motor hub */}
            <circle cx="0" cy="0" r={r * 0.18} fill="#0F172A" stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
          </>
        );
      }

      // 7. EXHAUST FAN
      case 'exhaust_fan': {
        const r = Math.min(hw, hh) * 0.8;
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} fill="rgba(6, 182, 212, 0.1)" stroke={primaryColor} strokeWidth={strokeWidth} />
            <circle cx="0" cy="0" r={r} fill="none" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-r} y1={-r} x2={r} y2={r} stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={r} y1={-r} x2={-r} y2={r} stroke={primaryColor} strokeWidth={strokeWidth} />
          </>
        );
      }

      // 8. SINGLE ROCKER SWITCH
      case 'switch_rocker': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="2" fill="#1E293B" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1="0" y1={-hh * 0.6} x2="0" y2={hh * 0.6} stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
            <circle cx="0" cy={-hh * 0.6} r="3" fill={primaryColor} />
          </>
        );
      }

      // 9. MULTI-GANG SWITCH
      case 'switch_multi': {
        const slotW = w / 4;
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="3" fill="#1E293B" stroke={primaryColor} strokeWidth={strokeWidth} />
            {[-slotW, 0, slotW].map((cx, i) => (
              <line key={i} x1={cx} y1={-hh * 0.6} x2={cx} y2={hh * 0.6} stroke={primaryColor} strokeWidth={strokeWidth * 1.2} />
            ))}
          </>
        );
      }

      // 10. TWO-WAY SWITCH
      case 'switch_twoway': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="2" fill="#1E293B" stroke={primaryColor} strokeWidth={strokeWidth} />
            <path d={`M 0 ${-hh * 0.6} L 0 ${hh * 0.6} M -6 ${-hh * 0.3} L 0 ${-hh * 0.6} L 6 ${-hh * 0.3} M -6 ${hh * 0.3} L 0 ${hh * 0.6} L 6 ${hh * 0.3}`} fill="none" stroke={primaryColor} strokeWidth={strokeWidth} />
          </>
        );
      }

      // 11. DIMMER SWITCH
      case 'switch_dimmer': {
        const r = Math.min(hw, hh) * 0.6;
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="2" fill="#1E293B" stroke={primaryColor} strokeWidth={strokeWidth} />
            <circle cx="0" cy="0" r={r} fill="none" stroke={primaryColor} strokeWidth={strokeWidth} />
            <circle cx="0" cy="0" r={r * 0.3} fill={primaryColor} />
            <line x1="0" y1={-r} x2="0" y2={-r * 0.3} stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
          </>
        );
      }

      // 12. MAIN DISTRIBUTION BOARD (MDB)
      case 'main_db_panel': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="3" fill="#0F172A" stroke="#EF4444" strokeWidth={strokeWidth * 2} />
            {/* Split warning pattern */}
            <path d={`M ${-hw} ${-hh} L 0 ${hh} L ${hw} ${-hh}`} fill="none" stroke="#EF4444" strokeWidth={strokeWidth} />
            <rect x={-hw * 0.7} y={-hh * 0.4} width={w * 0.7} height={h * 0.8} fill="rgba(239, 68, 68, 0.2)" stroke="#EF4444" strokeWidth={1} />
            <text x="0" y="4" textAnchor="middle" fill="#F87171" fontSize="11" fontWeight="800" fontFamily="sans-serif">MDB</text>
          </>
        );
      }

      // 13. 5A SINGLE POWER SOCKET
      case 'socket_single': {
        const r = Math.min(hw, hh) * 0.85;
        return (
          <>
            {/* Semicircle */}
            <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`} fill="rgba(16, 185, 129, 0.2)" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-r} y1="0" x2={r} y2="0" stroke={primaryColor} strokeWidth={strokeWidth} />
            {/* 2 pin ticks */}
            <circle cx={-r * 0.4} cy={-r * 0.4} r="2.5" fill={primaryColor} />
            <circle cx={r * 0.4} cy={-r * 0.4} r="2.5" fill={primaryColor} />
          </>
        );
      }

      // 14. 16A HEAVY POWER SOCKET
      case 'socket_heavy': {
        const r = Math.min(hw, hh) * 0.85;
        return (
          <>
            <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`} fill="rgba(16, 185, 129, 0.3)" stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
            <line x1={-r} y1="0" x2={r} y2="0" stroke={primaryColor} strokeWidth={strokeWidth * 1.5} />
            {/* 3 heavy pins (triangular earth + 2 line) */}
            <circle cx="0" cy={-r * 0.65} r="3.5" fill={primaryColor} />
            <circle cx={-r * 0.45} cy={-r * 0.3} r="3" fill={primaryColor} />
            <circle cx={r * 0.45} cy={-r * 0.3} r="3" fill={primaryColor} />
          </>
        );
      }

      // 15. AC ISOLATOR (20A RADIAL)
      case 'ac_isolator': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="3" fill="#0F172A" stroke="#0284C7" strokeWidth={strokeWidth * 1.8} />
            <circle cx="0" cy="0" r={Math.min(hw, hh) * 0.55} fill="rgba(2, 132, 199, 0.2)" stroke="#0284C7" strokeWidth={strokeWidth} />
            <line x1="0" y1={-hh * 0.5} x2="0" y2={hh * 0.5} stroke="#38BDF8" strokeWidth={strokeWidth * 1.5} />
            <text x="0" y={hh * 0.8} textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="800" fontFamily="sans-serif">AC</text>
          </>
        );
      }

      // 16. GEYSER SWITCH
      case 'geyser_radial': {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="3" fill="#0F172A" stroke="#EA580C" strokeWidth={strokeWidth * 1.8} />
            <circle cx="0" cy={-hh * 0.2} r={Math.min(hw, hh) * 0.4} fill="rgba(234, 88, 12, 0.2)" stroke="#EA580C" strokeWidth={strokeWidth} />
            <path d={`M ${-hw * 0.3} ${hh * 0.3} Q 0 ${hh * 0.1} ${hw * 0.3} ${hh * 0.3}`} fill="none" stroke="#EA580C" strokeWidth={strokeWidth * 1.2} />
            <text x="0" y={hh * 0.75} textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="800" fontFamily="sans-serif">GEY</text>
          </>
        );
      }

      // GENERIC BOX FALLBACK
      default: {
        return (
          <>
            <rect x={-hw} y={-hh} width={w} height={h} rx="3" fill="#1E293B" stroke={primaryColor} strokeWidth={strokeWidth} />
            <line x1={-hw} y1={-hh} x2={hw} y2={hh} stroke={primaryColor} strokeWidth={1} />
            <line x1={hw} y1={-hh} x2={-hw} y2={hh} stroke={primaryColor} strokeWidth={1} />
          </>
        );
      }
    }
  };

  return (
    <g className="electrical-fixture-symbol" style={{ cursor: 'pointer' }}>
      {renderSymbolContent()}
      {/* Label / ID */}
      <text
        x="0"
        y={hh + 14}
        textAnchor="middle"
        fill={isSelected ? '#38BDF8' : '#CBD5E1'}
        fontSize="11"
        fontWeight="700"
        fontFamily="'JetBrains Mono', monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {component.id || spec.prefix}
      </text>
    </g>
  );
}
