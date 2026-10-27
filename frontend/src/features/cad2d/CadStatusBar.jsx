import React from 'react';
import { PLUMBING_SYSTEMS } from './pipeRoutingEngine';
import { HVAC_DUCT_SYSTEMS, HVAC_DIFFUSER_TYPES, calculateDuctVelocity } from './ductRoutingEngine';
import { CONDUIT_TYPES, WIRE_GAUGES } from './electricalRoutingEngine';
import { ROOM_PROFILES } from './roomTagEngine';

/**
 * CadStatusBar.jsx
 * ================
 * Professional CAD Drafting Status Bar dock at the bottom of the 2D CAD canvas.
 * Provides live coordinate readouts, OSNAP/ORTHO status toggles, plumbing pipe selectors,
 * HVAC duct & diffuser selectors, Electrical conduit & homerun selectors, and contextual drafting shortcuts.
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
  onChangePipeSlope,
  // HVAC System Selector Props
  hvacToolMode = 'duct',
  onChangeHvacToolMode,
  ductSystem = 'SUPPLY',
  onChangeDuctSystem,
  ductWidth = 400,
  ductHeight = 250,
  onChangeDuctSize,
  ductCfm = 400,
  onChangeDuctCfm,
  diffuserType = 'SUPPLY_4WAY',
  onChangeDiffuserType,
  diffuserCfm = 150,
  onChangeDiffuserCfm,
  // Electrical System Selector Props
  electricalToolMode = 'component',
  onChangeElectricalToolMode,
  conduitType = 'SLAB',
  onChangeConduitType,
  wireGauge = '2.5',
  onChangeWireGauge,
  activeCircuitId = 'CKT-1',
  onChangeActiveCircuitId,
  electricalCircuits = [],
  selectedElectricalFixtureType = 'recessed_downlight',
  onChangeElectricalFixtureType,
  // Multi-Selection Props (Cycle 19)
  multiSelection = [],
  onBatchDelete,
  onClearSelection,
  // Dimension Tool Props (Cycle 19)
  dimensionMode = 'aligned',
  onChangeDimensionMode,
  dimensionUnit = 'mm',
  onChangeDimensionUnit,
  onAutoOuterWallDimensions,
  // Room Tagging Props (Cycle 19)
  selectedRoomType = 'LIVING',
  onChangeRoomType,
  onAutoTagRooms,
  // 2D MEP Clash & Penetration Sleeves Props (Cycle 20)
  clashesCount = 0,
  onResolveAllClashes,
  showSleeves = true,
  onToggleSleeves,
  // Multi-Page Titleblock Sheet Studio (Cycle 21)
  onOpenSheetStudio,
  // Native AutoCAD AutoLISP Studio (Cycle 22)
  onOpenLispStudio,
  // 2D Thermal Zone Modeling (Cycle 23)
  showThermalHeatmap = false,
  onToggleThermalHeatmap,
  onOpenThermalStudio
}) {
  const isDrafting = draftingPointsCount > 0;
  const currentSys = PLUMBING_SYSTEMS[pipeSystem] || PLUMBING_SYSTEMS.CW;
  const currentDuctSys = HVAC_DUCT_SYSTEMS[ductSystem] || HVAC_DUCT_SYSTEMS.SUPPLY;
  const velMetrics = calculateDuctVelocity(ductCfm, ductWidth, ductHeight);
  const currentConduitStyle = CONDUIT_TYPES[conduitType] || CONDUIT_TYPES.SLAB;

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

          {activeTool === 'hvac' && (
            hvacToolMode === 'duct' ? (
              isDrafting ? (
                <>
                  <span style={{ color: currentDuctSys.color, fontWeight: 700 }}>
                    ● ROUTING {currentDuctSys.shortName.toUpperCase()} DUCT ({ductWidth}x{ductHeight}mm):
                  </span>
                  <span>Click waypoint to bend 90° •</span>
                  <span style={{ color: '#38BDF8' }}>[Enter]</span>
                  <span>Finish •</span>
                  <span style={{ color: '#EF4444' }}>[Esc]</span>
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#F97316', fontWeight: 700 }}>💨 DUCT ROUTER:</span>
                  <span>Click canvas to start trunk/branch duct route •</span>
                  <span style={{ color: '#FDBA74' }}>[Tab]</span>
                  <span>Switch to Diffuser Drop</span>
                </>
              )
            ) : (
              <>
                <span style={{ color: '#0EA5E9', fontWeight: 700 }}>🎯 CEILING DIFFUSER TOOL:</span>
                <span>Click inside room ceiling to place • Snaps flex duct takeoff to nearest duct</span>
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

          {activeTool === 'electrical' && (
            electricalToolMode === 'conduit' ? (
              isDrafting ? (
                <>
                  <span style={{ color: currentConduitStyle.color, fontWeight: 700 }}>
                    ● ROUTING {currentConduitStyle.name.toUpperCase()} ({wireGauge}mm²):
                  </span>
                  <span>Click fixture port to connect •</span>
                  <span style={{ color: '#38BDF8' }}>[Enter]</span>
                  <span>Finish •</span>
                  <span style={{ color: '#EF4444' }}>[Esc]</span>
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚡ CONDUIT ROUTER:</span>
                  <span>Click fixture terminal port to start conduit branch •</span>
                  <span style={{ color: '#FDE68A' }}>[Tab]</span>
                  <span>Switch Tool</span>
                </>
              )
            ) : (electricalToolMode === 'homerun' ? (
              <>
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>🏹 HOMERUN LEADER:</span>
                <span>Click terminal fixture to shoot homerun arrow back to Distribution Board (DB)</span>
              </>
            ) : (
              <>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>💡 ELECTRICAL FIXTURE:</span>
                <span>Click canvas to place component •</span>
                <span style={{ color: '#38BDF8' }}>[Tab]</span>
                <span>Switch to Conduit / Homerun</span>
              </>
            ))
          )}

          {activeTool === 'select' && (
            multiSelection && multiSelection.length > 0 ? (
              <>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>✨ MULTI-SELECTION:</span>
                <span>{multiSelection.length} entities selected • [Del] Delete All • [Esc] Clear Selection</span>
              </>
            ) : (
              <>
                <span style={{ color: '#64748B' }}>💡 Tip:</span>
                <span>Drag left-to-right for Window Select (Blue) • Drag right-to-left for Crossing Select (Green).</span>
              </>
            )
          )}

          {activeTool === 'dimension' && (
            <>
              <span style={{ color: '#38BDF8', fontWeight: 700 }}>📐 DIMENSION:</span>
              <span>Click Point 1 ➔ Point 2 ➔ Drag offset to place • Continuous chain dimensioning supported.</span>
            </>
          )}

          {activeTool === 'room_tag' && (
            <>
              <span style={{ color: '#10B981', fontWeight: 700 }}>🏷️ ROOM TAG:</span>
              <span>Click inside room polygon to calculate exact centroid &amp; floor area (m² / sq ft).</span>
            </>
          )}
        </div>
      </div>

      {/* CENTER: Real-Time Multi-Discipline 2D Clash Collision Bar */}
      {clashesCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(239, 68, 68, 0.18)', padding: '4px 12px', borderRadius: '6px', border: '1px solid #EF4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}>
          <span style={{ color: '#FCA5A5', fontSize: '11px', fontWeight: 800 }}>
            ⚠️ {clashesCount} {clashesCount === 1 ? 'CLASH' : 'CLASHES'} DETECTED
          </span>
          <button
            type="button"
            onClick={onResolveAllClashes}
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Automatically install wall penetration sleeves &amp; bypass crossing services"
          >
            ⚡ Auto-Resolve All
          </button>
        </div>
      )}

      {/* CENTER: Multi-Selection Floating Action Bar */}
      {multiSelection && multiSelection.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1E293B', padding: '4px 12px', borderRadius: '6px', border: '1px solid #38BDF8', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <span style={{ color: '#38BDF8', fontSize: '11px', fontWeight: 800 }}>
            ✨ {multiSelection.length} ITEMS SELECTED
          </span>
          <button
            type="button"
            onClick={onBatchDelete}
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Delete all selected items (Delete/Backspace)"
          >
            🗑️ Delete Selected
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              backgroundColor: '#334155',
              color: '#94A3B8',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Clear selection (Escape)"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* CENTER: Dimension Tool Mode & Auto-Dimensioner */}
      {activeTool === 'dimension' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(30, 41, 59, 0.9)', padding: '3px 10px', borderRadius: '6px', border: '1px solid #38BDF8' }}>
          <span style={{ color: '#38BDF8', fontSize: '10px', fontWeight: 800 }}>DIMENSION:</span>
          <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0F172A', padding: '2px', borderRadius: '4px' }}>
            {[
              { id: 'aligned', label: '📐 Aligned' },
              { id: 'linear', label: '📏 Linear' },
              { id: 'chain', label: '🔗 Chain' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeDimensionMode?.(m.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '3px',
                  backgroundColor: dimensionMode === m.id ? '#0284C7' : 'transparent',
                  color: dimensionMode === m.id ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0F172A', padding: '2px', borderRadius: '4px' }}>
            {['mm', 'm', 'ft_in'].map(u => (
              <button
                key={u}
                type="button"
                onClick={() => onChangeDimensionUnit?.(u)}
                style={{
                  padding: '3px 6px',
                  fontSize: '9px',
                  fontWeight: 700,
                  borderRadius: '3px',
                  backgroundColor: dimensionUnit === u ? '#38BDF8' : 'transparent',
                  color: dimensionUnit === u ? '#0F172A' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAutoOuterWallDimensions}
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 800,
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Auto-generate dimension strings for all exterior room walls"
          >
            ⚡ Auto Wall Dims
          </button>
        </div>
      )}

      {/* CENTER: Room Tagging Profiles & Auto-Tagger */}
      {activeTool === 'room_tag' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(30, 41, 59, 0.9)', padding: '3px 10px', borderRadius: '6px', border: '1px solid #10B981' }}>
          <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 800 }}>ROOM TYPE:</span>
          <select
            value={selectedRoomType}
            onChange={(e) => onChangeRoomType?.(e.target.value)}
            style={{
              backgroundColor: '#0F172A',
              color: '#F8FAFC',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #334155'
            }}
          >
            {Object.values(ROOM_PROFILES).map(p => (
              <option key={p.key} value={p.key}>{p.name} ({p.codePrefix})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onAutoTagRooms}
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 800,
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Automatically compute centroids and tag all room spaces"
          >
            ⚡ Auto-Tag All Rooms
          </button>
        </div>
      )}

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

      {/* CENTER: Active HVAC System & Tool Quick Selector when activeTool === 'hvac' */}
      {activeTool === 'hvac' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
          {/* Mode Toggle: Duct vs Diffuser */}
          <div style={{ display: 'flex', backgroundColor: '#0F172A', borderRadius: '4px', padding: '1px', border: '1px solid #475569' }}>
            <button
              type="button"
              onClick={() => onChangeHvacToolMode?.('duct')}
              style={{
                padding: '2px 8px',
                borderRadius: '3px',
                backgroundColor: hvacToolMode === 'duct' ? '#F97316' : 'transparent',
                border: 'none',
                color: hvacToolMode === 'duct' ? '#FFFFFF' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              💨 Duct Route
            </button>
            <button
              type="button"
              onClick={() => onChangeHvacToolMode?.('diffuser')}
              style={{
                padding: '2px 8px',
                borderRadius: '3px',
                backgroundColor: hvacToolMode === 'diffuser' ? '#0EA5E9' : 'transparent',
                border: 'none',
                color: hvacToolMode === 'diffuser' ? '#FFFFFF' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🎯 Diffuser Drop
            </button>
          </div>

          <div style={{ width: '1px', height: '14px', backgroundColor: '#475569', margin: '0 2px' }} />

          {hvacToolMode === 'duct' ? (
            <>
              {/* System Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>SYS:</span>
              {Object.values(HVAC_DUCT_SYSTEMS).map(sys => {
                const isSelected = ductSystem === sys.id;
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => onChangeDuctSystem?.(sys.id)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? sys.color : 'transparent',
                      border: isSelected ? 'none' : '1px solid #475569',
                      color: isSelected ? '#FFFFFF' : '#CBD5E1',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title={sys.name}
                  >
                    {sys.shortName}
                  </button>
                );
              })}

              <div style={{ width: '1px', height: '14px', backgroundColor: '#475569', margin: '0 2px' }} />

              {/* Size Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>SIZE:</span>
              <select
                value={`${ductWidth}x${ductHeight}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  onChangeDuctSize?.(w, h);
                }}
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
                {currentDuctSys.sizes.map(s => (
                  <option key={`${s.width}x${s.height}`} value={`${s.width}x${s.height}`}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* CFM Preset */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>CFM:</span>
              <select
                value={ductCfm}
                onChange={(e) => onChangeDuctCfm?.(Number(e.target.value))}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#FED7AA',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {[150, 250, 400, 600, 800, 1200, 1600].map(c => (
                  <option key={c} value={c}>{c} CFM</option>
                ))}
              </select>

              {/* Velocity Indicator Pill */}
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: velMetrics.color + '22',
                  border: `1px solid ${velMetrics.color}`,
                  color: velMetrics.color,
                  fontSize: '10px',
                  fontWeight: 700
                }}
                title={velMetrics.label}
              >
                {velMetrics.velocityFpm} FPM
              </span>
            </>
          ) : (
            <>
              {/* Diffuser Type Selector */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>TYPE:</span>
              <select
                value={diffuserType}
                onChange={(e) => onChangeDiffuserType?.(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#38BDF8',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {Object.values(HVAC_DIFFUSER_TYPES).map(dt => (
                  <option key={dt.id} value={dt.id}>
                    {dt.icon} {dt.name}
                  </option>
                ))}
              </select>

              {/* Diffuser CFM */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>AIRFLOW:</span>
              <select
                value={diffuserCfm}
                onChange={(e) => onChangeDiffuserCfm?.(Number(e.target.value))}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#BAE6FD',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {[80, 120, 150, 200, 250, 350, 500].map(c => (
                  <option key={c} value={c}>{c} CFM</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* CENTER: Active Electrical System & Tool Quick Selector when activeTool === 'electrical' */}
      {activeTool === 'electrical' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
          {/* Mode Toggle: Component vs Conduit vs Homerun */}
          <div style={{ display: 'flex', backgroundColor: '#0F172A', borderRadius: '4px', padding: '1px', border: '1px solid #475569' }}>
            <button
              type="button"
              onClick={() => onChangeElectricalToolMode?.('component')}
              style={{
                padding: '2px 7px',
                borderRadius: '3px',
                backgroundColor: electricalToolMode === 'component' ? '#38BDF8' : 'transparent',
                border: 'none',
                color: electricalToolMode === 'component' ? '#0F172A' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              💡 Fixture
            </button>
            <button
              type="button"
              onClick={() => onChangeElectricalToolMode?.('conduit')}
              style={{
                padding: '2px 7px',
                borderRadius: '3px',
                backgroundColor: electricalToolMode === 'conduit' ? '#F59E0B' : 'transparent',
                border: 'none',
                color: electricalToolMode === 'conduit' ? '#0F172A' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚡ Conduit
            </button>
            <button
              type="button"
              onClick={() => onChangeElectricalToolMode?.('homerun')}
              style={{
                padding: '2px 7px',
                borderRadius: '3px',
                backgroundColor: electricalToolMode === 'homerun' ? '#10B981' : 'transparent',
                border: 'none',
                color: electricalToolMode === 'homerun' ? '#FFFFFF' : '#94A3B8',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🏹 Homerun
            </button>
          </div>

          <div style={{ width: '1px', height: '14px', backgroundColor: '#475569', margin: '0 2px' }} />

          {electricalToolMode === 'conduit' ? (
            <>
              {/* Conduit Type Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>CONDUIT:</span>
              {Object.values(CONDUIT_TYPES).slice(0, 3).map(ct => {
                const isSelected = conduitType === ct.id;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => onChangeConduitType?.(ct.id)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? ct.color : 'transparent',
                      border: isSelected ? 'none' : '1px solid #475569',
                      color: isSelected ? '#0F172A' : '#CBD5E1',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title={ct.name}
                  >
                    {ct.name.split(' ')[0]}
                  </button>
                );
              })}

              <div style={{ width: '1px', height: '14px', backgroundColor: '#475569', margin: '0 2px' }} />

              {/* Wire Gauge Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>WIRE:</span>
              <select
                value={wireGauge}
                onChange={(e) => onChangeWireGauge?.(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#FDE68A',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {Object.entries(WIRE_GAUGES).map(([k, w]) => (
                  <option key={k} value={k}>{w.gauge} ({w.mcb})</option>
                ))}
              </select>

              {/* Circuit Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>CIRCUIT:</span>
              <select
                value={activeCircuitId}
                onChange={(e) => onChangeActiveCircuitId?.(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#38BDF8',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {(electricalCircuits && electricalCircuits.length > 0 ? electricalCircuits : [
                  { id: 'CKT-1', name: 'CKT-1 (Lighting)' },
                  { id: 'CKT-2', name: 'CKT-2 (Power Sockets)' },
                  { id: 'CKT-3', name: 'CKT-3 (AC/Heater)' }
                ]).map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </>
          ) : (electricalToolMode === 'homerun' ? (
            <>
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>PANEL CKT:</span>
              <select
                value={activeCircuitId}
                onChange={(e) => onChangeActiveCircuitId?.(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#FACC15',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {(electricalCircuits && electricalCircuits.length > 0 ? electricalCircuits : [
                  { id: 'CKT-1', name: 'CKT-1 (Lighting)' },
                  { id: 'CKT-2', name: 'CKT-2 (Power Sockets)' },
                  { id: 'CKT-3', name: 'CKT-3 (AC/Heater)' }
                ]).map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
              <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 700 }}>
                ✓ Conductor: 3W (P+N+E) • 2.5mm² Cu
              </span>
            </>
          ) : (
            <>
              {/* Fixture Component Picker */}
              <span style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 700 }}>FIXTURE:</span>
              <select
                value={selectedElectricalFixtureType}
                onChange={(e) => onChangeElectricalFixtureType?.(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#38BDF8',
                  fontSize: '10.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <option value="recessed_downlight">💡 Downlight (15W)</option>
                <option value="surface_ceiling_light">💡 Ceiling Light (24W)</option>
                <option value="switch_1way">🔘 1-Way Switch</option>
                <option value="switch_2way">🔘 2-Way Switch</option>
                <option value="receptacle_duplex">🔌 16A Duplex Socket (200W)</option>
                <option value="receptacle_single">🔌 Single Socket (100W)</option>
                <option value="distribution_board">⚡ DB Main Panel (10kW)</option>
                <option value="ceiling_fan">🌀 Ceiling Fan (75W)</option>
                <option value="ac_isolator">❄️ AC Isolator (2500W)</option>
              </select>
            </>
          ))}
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
                backgroundColor: activeTool === 'electrical' ? '#F59E0B' : (activeTool === 'hvac' ? currentDuctSys.color : (activeTool === 'plumbing' ? currentSys.color : '#1E293B')),
                border: `1px solid ${activeTool === 'electrical' || activeTool === 'hvac' || activeTool === 'plumbing' ? '#FFFFFF' : '#475569'}`,
                color: activeTool === 'electrical' ? '#0F172A' : '#FFFFFF',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title={activeTool === 'electrical' ? "Commit and finalize conduit route" : (activeTool === 'hvac' ? "Commit and finalize duct route" : (activeTool === 'plumbing' ? "Commit and finalize pipe route" : "Finish current wall chain"))}
            >
              {activeTool === 'electrical' ? "✓ Finish Conduit (Enter)" : (activeTool === 'hvac' ? "✓ Finish Duct (Enter)" : (activeTool === 'plumbing' ? "✓ Finish Pipe (Enter)" : "Finish Wall (Enter)"))}
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

        {/* SLEEVES Toggle */}
        <button
          type="button"
          onClick={onToggleSleeves}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: showSleeves ? '#D97706' : '#1E293B',
            border: `1px solid ${showSleeves ? '#F59E0B' : '#334155'}`,
            color: showSleeves ? '#FFFFFF' : '#94A3B8',
            fontWeight: 700,
            fontSize: '10.5px',
            cursor: 'pointer'
          }}
          title="Toggle Wall Penetration Sleeves & Fire Dampers"
        >
          🧱 SLEEVES {showSleeves ? 'ON' : 'OFF'}
        </button>

        {/* TITLEBLOCK SHEETS STUDIO (Cycle 21) */}
        {onOpenSheetStudio && (
          <button
            type="button"
            onClick={onOpenSheetStudio}
            style={{
              padding: '3px 10px',
              borderRadius: '4px',
              backgroundColor: '#0284C7',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '10.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
              transition: 'all 0.15s ease'
            }}
            title="Open Architectural & MEP Titleblock Sheet Studio (A1/A0/Arch D Print Sets)"
          >
            <span>📄</span>
            <span>SHEETS</span>
          </button>
        )}

        {/* AUTOCAD AUTOLISP STUDIO (Cycle 22) */}
        {onOpenLispStudio && (
          <button
            type="button"
            onClick={onOpenLispStudio}
            style={{
              padding: '3px 10px',
              borderRadius: '4px',
              backgroundColor: '#4338CA',
              border: '1px solid #818CF8',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '10.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 0 10px rgba(129, 140, 248, 0.35)',
              transition: 'all 0.15s ease'
            }}
            title="Open Autodesk AutoCAD AutoLISP (.lsp) & Script (.scr) Compiler Studio"
          >
            <span>⚙️</span>
            <span>LISP</span>
          </button>
        )}

        {/* THERMAL HEATMAP Toggle (Cycle 23) */}
        {onToggleThermalHeatmap && (
          <button
            type="button"
            onClick={onToggleThermalHeatmap}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: showThermalHeatmap ? '#D97706' : '#1E293B',
              border: `1px solid ${showThermalHeatmap ? '#F59E0B' : '#334155'}`,
              color: showThermalHeatmap ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '10.5px',
              cursor: 'pointer'
            }}
            title="Toggle 2D ASHRAE 90.1 Thermal Zone Heatmap Overlay"
          >
            🌡️ HEATMAP {showThermalHeatmap ? 'ON' : 'OFF'}
          </button>
        )}

        {/* THERMAL ZONE STUDIO (Cycle 23) */}
        {onOpenThermalStudio && (
          <button
            type="button"
            onClick={onOpenThermalStudio}
            style={{
              padding: '3px 10px',
              borderRadius: '4px',
              backgroundColor: '#B45309',
              border: '1px solid #F59E0B',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '10.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.35)',
              transition: 'all 0.15s ease'
            }}
            title="Open 2D Thermal Zone & Space Boundary Studio (ASHRAE Cooling/Heating Loads & CFM)"
          >
            <span>🌡️</span>
            <span>THERMAL</span>
          </button>
        )}
      </div>
    </div>
  );
}
