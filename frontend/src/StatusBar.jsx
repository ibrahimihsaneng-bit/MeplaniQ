import React from 'react';

export default function StatusBar({ 
  cursorCoords, 
  zoomLevel, 
  showGrid, 
  onToggleGrid, 
  showDimensions, 
  onToggleDimensions, 
  showDoors = true, 
  onToggleDoors, 
  showWindows = true, 
  onToggleWindows, 
  showHvac = true, 
  onToggleHvac, 
  showFurniture = true,
  onToggleFurniture,
  showPlumbing = true,
  onTogglePlumbing,
  showElectrical = true,
  onToggleElectrical,
  isResizeModeActive = false,
  onToggleResizeMode,
  scaleModeFixed = true,
  onToggleScaleMode,
  onResetView,
  onToggleValidation,
  issuesCount = 0
}) {
  const xStr = cursorCoords ? cursorCoords.x.toFixed(1) : "0.0";
  const yStr = cursorCoords ? cursorCoords.y.toFixed(1) : "0.0";

  return (
    <div className="status-bar">
      <div className="status-item coords">
        <span className="label">X:</span>
        <span className="value">{xStr} mm</span>
        <span className="separator">|</span>
        <span className="label">Y:</span>
        <span className="value">{yStr} mm</span>
      </div>

      <div className="status-controls">
        <div className="status-item">
          <span className="label">Zoom:</span>
          <span className="value">{Math.round(zoomLevel * 100)}%</span>
        </div>

        <button 
          className={`status-btn ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Toggle 1000mm / 100mm Metric Grid"
        >
          Grid: {showGrid ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showDimensions ? 'active' : ''}`}
          onClick={onToggleDimensions}
          title="Toggle Parametric CAD Dimension Lines"
        >
          Dims: {showDimensions ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showDoors ? 'active-doors' : ''}`}
          onClick={onToggleDoors}
          title="Toggle Architectural Door Swings & Frames"
        >
          Doors: {showDoors ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showWindows ? 'active-windows' : ''}`}
          onClick={onToggleWindows}
          title="Toggle Architectural Window Symbols"
        >
          Windows: {showWindows ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showHvac ? 'active-hvac' : ''}`}
          onClick={onToggleHvac}
          title="Toggle HVAC Equipment & Refrigerant Piping"
        >
          HVAC: {showHvac ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showFurniture ? 'active-furniture' : ''}`}
          onClick={onToggleFurniture}
          title="Toggle Bedroom Furniture (Beds)"
        >
          Furniture: {showFurniture ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showPlumbing ? 'active-hvac' : ''}`}
          onClick={onTogglePlumbing}
          title="Toggle Sanitary Fixtures & MEP Piping"
        >
          Plumbing: {showPlumbing ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${showElectrical ? 'active' : ''}`}
          onClick={onToggleElectrical}
          style={{
            borderColor: showElectrical ? '#F59E0B' : undefined,
            color: showElectrical ? '#FDE047' : undefined
          }}
          title="Toggle Electrical Fixtures, Conduits & Circuits"
        >
          Elect: {showElectrical ? 'ON' : 'OFF'}
        </button>

        <button 
          className={`status-btn ${isResizeModeActive ? 'active-resize' : ''}`}
          onClick={onToggleResizeMode}
          title="Toggle Canvas Interactive Room/Wall Resizing Handles (Clean Blueprint by Default)"
        >
          Resize Mode: {isResizeModeActive ? 'ON' : 'OFF'}
        </button>

        <button
          className={`status-btn ${scaleModeFixed ? 'active' : ''}`}
          onClick={onToggleScaleMode}
          title={scaleModeFixed
            ? 'Scale Mode: Fixed (Engineering) — Plumbing pipes drawn at true real-world mm dimensions. Click to switch to Dynamic mode.'
            : 'Scale Mode: Dynamic — Plumbing pipes scale with zoom level. Click to switch to Fixed Engineering mode.'}
        >
          {scaleModeFixed ? '⚙ Scale: Fixed' : '🔍 Scale: Dynamic'}
        </button>

        {onToggleValidation && (
          <button 
            className="status-btn"
            onClick={onToggleValidation}
            style={{
              backgroundColor: issuesCount > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(34, 197, 94, 0.15)',
              borderColor: issuesCount > 0 ? 'var(--status-warning)' : 'var(--status-success)',
              color: issuesCount > 0 ? 'var(--status-warning)' : 'var(--status-success)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Open Design Check & Auditing Panel"
          >
            <span>{issuesCount > 0 ? '⚠️' : '✅'}</span>
            <span>{issuesCount > 0 ? `${issuesCount} Issues` : 'Design Valid'}</span>
          </button>
        )}

        <button 
          className="status-btn"
          onClick={onResetView}
          title="Reset Zoom and Pan to Fit"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
