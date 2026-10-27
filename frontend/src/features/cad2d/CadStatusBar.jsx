import React from 'react';
import { PLUMBING_SYSTEMS } from './pipeRoutingEngine';

/**
 * CadStatusBar.jsx
 * ================
 * Professional CAD Drafting Status Bar dock at the bottom of the 2D CAD canvas.
 * Provides live coordinate readouts, OSNAP/ORTHO status toggles, plumbing pipe selectors,
 * and contextual drafting shortcuts.
 */
export default function CadStatusBar({
  cursorCoords = { x: 0, y: 0 },
  orthoActive = false,
  onToggleOrtho,
  osnapActive = true,
  onToggleOsnap,
  polarActive = false,
  onTogglePolar,
  showGrid = true,
  onToggleGrid,
  activeTool = 'select',
  draftingPointsCount = 0,
  onFinishDrafting,
  onCancelDrafting,
  onCloseRoom,
  // Plumbing System Selector Props
  pipeSystem = 'CW',
  onChangePipeSystem,
  pipeDiameter = 25,
  onChangePipeDiameter,
  pipeSlope = '1:50',
  onChangePipeSlope
}) {
  const isDrafting = draftingPointsCount > 0;
  const currentSys = PLUMBING_SYSTEMS[pipeSystem] || PLUMBING_SYSTEMS.CW;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #334155',
        borderRadius: '8px',
        color: '#E2E8F0',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        zIndex: 50,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto'
      }}
    >
      {/* LEFT: Contextual Drafting Guidance & Live Coordinates */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {/* Live Coordinate Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '11.5px', flexShrink: 0 }}>
          <span style={{ color: '#64748B' }}>CAD COORDS:</span>
          <span style={{ color: '#38BDF8', fontWeight: 700 }}>
            X: {Math.round(cursorCoords.x).toLocaleString()} mm
          </span>
          <span style={{ color: '#34D399', fontWeight: 700 }}>
            Y: {Math.round(cursorCoords.y).toLocaleString()} mm
          </span>
        </div>

        <div style={{ width: '1px', height: '16px', backgroundColor: '#334155', flexShrink: 0 }} />

        {/* Dynamic Context Hint */}
        <div style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeTool === 'wall' && (
            isDrafting ? (
              <>
                <span style={{ color: '#FACC15', fontWeight: 700 }}>● DRAFTING WALL:</span>
                <span>Click next point.</span>
                <span style={{ color: '#38BDF8' }}>[Shift]</span>
                <span>toggle Ortho •</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>[C]</span>
                <span>Close Room •</span>
                <span style={{ color: '#EF4444' }}>[Esc]</span>
                <span>Cancel</span>
              </>
            ) : (
              <>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>✏️ WALL TOOL:</span>
                <span>Click on canvas to place the starting point.</span>
              </>
            )
          )}

          {activeTool === 'plumbing' && (
            isDrafting ? (
              <>
                <span style={{ color: currentSys.color, fontWeight: 700 }}>
                  ● ROUTING {currentSys.name.toUpperCase()} (⌀{pipeDiameter}mm):
                </span>
                <span>Click waypoint or fixture port to connect •</span>
                <span style={{ color: '#38BDF8' }}>[Enter]</span>
                <span>Finish •</span>
                <span style={{ color: '#EF4444' }}>[Esc]</span>
                <span>Cancel</span>
              </>
            ) : (
              <>
                <span style={{ color: '#06B6D4', fontWeight: 700 }}>🚰 PIPE ROUTER:</span>
                <span>Click to start pipe route or snap directly to any fixture port.</span>
              </>
            )
          )}

          {activeTool === 'door' && (
            <>
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>🚪 DOOR TOOL:</span>
              <span>Hover over wall to host.</span>
              <span style={{ color: '#FDE68A' }}>[F]</span>
              <span>Flip Swing •</span>
              <span style={{ color: '#FDE68A' }}>[Space]</span>
              <span>Flip Hinge • Click to place.</span>
            </>
          )}

          {activeTool === 'window' && (
            <>
              <span style={{ color: '#0EA5E9', fontWeight: 700 }}>🪟 WINDOW TOOL:</span>
              <span>Hover over wall segment and click to place window.</span>
            </>
          )}

          {activeTool === 'select' && (
            <>
              <span style={{ color: '#64748B' }}>💡 Tip:</span>
              <span>Select elements to inspect or drag to modify. Switch tool on left palette.</span>
            </>
          )}
        </div>
      </div>

      {/* CENTER: Active Plumbing System & Diameter Quick Selector when activeTool === 'plumbing' */}
      {activeTool === 'plumbing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
          <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>SYSTEM:</span>
          {Object.values(PLUMBING_SYSTEMS).map(sys => {
            const isSelected = pipeSystem === sys.id;
            return (
              <button
                key={sys.id}
                type="button"
                onClick={() => onChangePipeSystem?.(sys.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? sys.color : 'transparent',
                  border: isSelected ? 'none' : '1px solid #475569',
                  color: isSelected ? '#FFFFFF' : '#CBD5E1',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={`Switch to ${sys.name}`}
              >
                <span>{sys.icon}</span>
                <span>{sys.id}</span>
              </button>
            );
          })}

          <div style={{ width: '1px', height: '14px', backgroundColor: '#475569', margin: '0 2px' }} />

          <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>DIAM:</span>
          <select
            value={pipeDiameter}
            onChange={(e) => onChangePipeDiameter?.(Number(e.target.value))}
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#F8FAFC',
              fontSize: '10.5px',
              padding: '2px 4px',
              cursor: 'pointer'
            }}
          >
            {currentSys.diams.map(d => (
              <option key={d} value={d}>⌀{d}mm</option>
            ))}
          </select>

          {pipeSystem === 'DRAIN' && (
            <>
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700, marginLeft: '4px' }}>SLOPE:</span>
              <button
                type="button"
                onClick={() => onChangePipeSlope?.(pipeSlope === '1:50' ? '1:100' : '1:50')}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#065F46',
                  border: '1px solid #10B981',
                  color: '#A7F3D0',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Toggle self-cleansing slope (IPC 704 standard)"
              >
                {pipeSlope} ({(pipeSlope === '1:50' ? 20 : 10)}mm/m)
              </button>
            </>
          )}
        </div>
      )}

      {/* RIGHT: Drafting Status Toggles & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Active Drafting Action Controls */}
        {isDrafting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
            {activeTool === 'wall' && draftingPointsCount >= 3 && (
              <button
                type="button"
                onClick={onCloseRoom}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  backgroundColor: '#065F46',
                  border: '1px solid #10B981',
                  color: '#A7F3D0',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                title="Complete polygon and generate enclosed Room"
              >
                ✓ Close Room (C)
              </button>
            )}
            <button
              type="button"
              onClick={onFinishDrafting}
              style={{
                padding: '3px 10px',
                borderRadius: '4px',
                backgroundColor: activeTool === 'plumbing' ? currentSys.color : '#1E293B',
                border: `1px solid ${activeTool === 'plumbing' ? '#FFFFFF' : '#475569'}`,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title={activeTool === 'plumbing' ? "Commit and finalize pipe route" : "Finish current wall chain"}
            >
              {activeTool === 'plumbing' ? "✓ Finish Pipe (Enter)" : "Finish Wall (Enter)"}
            </button>
            <button
              type="button"
              onClick={onCancelDrafting}
              style={{
                padding: '3px 10px',
                borderRadius: '4px',
                backgroundColor: '#450A0A',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title="Cancel current drawing"
            >
              Cancel (Esc)
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#334155' }} />
          </div>
        )}

        {/* ORTHO Toggle (F8) */}
        <button
          type="button"
          onClick={onToggleOrtho}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: orthoActive ? '#0284C7' : '#1E293B',
            border: `1px solid ${orthoActive ? '#38BDF8' : '#334155'}`,
            color: orthoActive ? '#FFFFFF' : '#94A3B8',
            fontWeight: 700,
            fontSize: '10.5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Toggle Orthogonal Mode (0°/90° Lock) [F8]"
        >
          ORTHO {orthoActive ? 'ON' : 'OFF'}
        </button>

        {/* OSNAP Toggle (F3) */}
        <button
          type="button"
          onClick={onToggleOsnap}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: osnapActive ? '#059669' : '#1E293B',
            border: `1px solid ${osnapActive ? '#34D399' : '#334155'}`,
            color: osnapActive ? '#FFFFFF' : '#94A3B8',
            fontWeight: 700,
            fontSize: '10.5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Toggle Object Snap (Endpoints, Midpoints, Perpendicular) [F3]"
        >
          OSNAP {osnapActive ? 'ON' : 'OFF'}
        </button>

        {/* POLAR Toggle (F10) */}
        <button
          type="button"
          onClick={onTogglePolar}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: polarActive ? '#7C3AED' : '#1E293B',
            border: `1px solid ${polarActive ? '#A78BFA' : '#334155'}`,
            color: polarActive ? '#FFFFFF' : '#94A3B8',
            fontWeight: 700,
            fontSize: '10.5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Toggle Polar Snap (45° Tracking) [F10]"
        >
          POLAR {polarActive ? 'ON' : 'OFF'}
        </button>

        {/* GRID Toggle (F7) */}
        <button
          type="button"
          onClick={onToggleGrid}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: showGrid ? '#334155' : '#1E293B',
            border: `1px solid ${showGrid ? '#64748B' : '#334155'}`,
            color: showGrid ? '#F8FAFC' : '#64748B',
            fontWeight: 700,
            fontSize: '10.5px',
            cursor: 'pointer'
          }}
          title="Toggle Background Grid [F7]"
        >
          GRID
        </button>
      </div>
    </div>
  );
}
