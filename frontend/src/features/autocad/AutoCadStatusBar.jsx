import React, { useState } from 'react';

export default function AutoCadStatusBar({
  cursorCoords = { x: 0, y: 0 },
  settings,
  onToggleSetting,
  onUpdateSetting,
  onZoomExtents,
  onZoomReset
}) {
  const [showOsnapMenu, setShowOsnapMenu] = useState(false);

  const formatCoord = (val) => {
    return (val || 0).toFixed(2);
  };

  const statusToggles = [
    { key: 'grid', label: 'GRID', keycode: 'F7', active: settings.grid, title: 'Toggle Grid Display (F7)' },
    { key: 'snapToGrid', label: 'SNAP', keycode: 'F9', active: settings.snapToGrid, title: 'Snap to Grid (F9)' },
    { key: 'ortho', label: 'ORTHO', keycode: 'F8', active: settings.ortho, title: 'Ortho Mode - Lock 90° (F8)' },
    { key: 'polar', label: 'POLAR', keycode: 'F10', active: settings.polar, title: 'Polar Tracking (F10)' },
    { key: 'osnap', label: 'OSNAP', keycode: 'F3', active: settings.osnap, title: '2D Object Snapping (F3)', hasMenu: true },
    { key: 'dynamicInput', label: 'DYN', keycode: '', active: settings.dynamicInput, title: 'Dynamic Input on Cursor' }
  ];

  return (
    <footer className="autocad-status-bar" style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '28px',
      backgroundColor: '#090D16',
      borderTop: '1px solid #1E293B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '11px',
      fontFamily: 'Consolas, Monaco, monospace',
      color: '#94A3B8',
      userSelect: 'none',
      zIndex: 35
    }}>
      {/* Left: Dynamic Coordinate Tracker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          backgroundColor: '#1E293B',
          padding: '2px 8px',
          borderRadius: '3px',
          color: '#38BDF8',
          fontSize: '11px',
          letterSpacing: '0.04em'
        }}>
          <span>X: {formatCoord(cursorCoords.x)} mm</span>
          <span style={{ margin: '0 6px', color: '#475569' }}>|</span>
          <span>Y: {formatCoord(cursorCoords.y)} mm</span>
          <span style={{ margin: '0 6px', color: '#475569' }}>|</span>
          <span>Z: 0.00 mm</span>
        </div>

        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#64748B',
          backgroundColor: '#111827',
          padding: '2px 6px',
          borderRadius: '3px'
        }}>
          MODEL
        </span>
      </div>

      {/* Right: AutoCAD Drafting Aids Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
        {statusToggles.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onToggleSetting(item.key)}
              title={item.title}
              style={{
                background: item.active ? '#0284C7' : '#1E293B',
                border: `1px solid ${item.active ? '#38BDF8' : '#334155'}`,
                color: item.active ? '#FFFFFF' : '#94A3B8',
                fontWeight: item.active ? 700 : 500,
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: item.hasMenu ? '3px 0 0 3px' : '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>{item.label}</span>
              {item.keycode && <span style={{ fontSize: '9px', opacity: 0.7 }}>({item.keycode})</span>}
            </button>

            {item.hasMenu && (
              <button
                type="button"
                onClick={() => setShowOsnapMenu(prev => !prev)}
                title="OSNAP Settings"
                style={{
                  background: item.active ? '#0369A1' : '#1E293B',
                  border: `1px solid ${item.active ? '#38BDF8' : '#334155'}`,
                  borderLeft: 'none',
                  color: item.active ? '#FFFFFF' : '#94A3B8',
                  padding: '2px 4px',
                  borderRadius: '0 3px 3px 0',
                  cursor: 'pointer',
                  fontSize: '9px'
                }}
              >
                ▼
              </button>
            )}
          </div>
        ))}

        {/* Viewport Zoom Utilities */}
        <span style={{ color: '#334155', margin: '0 4px' }}>|</span>

        <button
          type="button"
          onClick={onZoomExtents}
          title="Zoom Extents (Z + E)"
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#CBD5E1',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          🔍 Extents
        </button>

        <button
          type="button"
          onClick={onZoomReset}
          title="Zoom 100%"
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#CBD5E1',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          1:1
        </button>

        {/* OSNAP Context Dropdown */}
        {showOsnapMenu && (
          <div style={{
            position: 'absolute',
            bottom: '32px',
            right: '80px',
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 50,
            minWidth: '160px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#38BDF8', borderBottom: '1px solid #1E293B', paddingBottom: '4px' }}>
              OSNAP MODES (F3)
            </div>
            {Object.entries({
              endpoint: 'Endpoint (□)',
              midpoint: 'Midpoint (△)',
              intersection: 'Intersection (✕)',
              center: 'Center (⊙)',
              perpendicular: 'Perpendicular (⦜)'
            }).map(([key, label]) => {
              const isChecked = settings.osnapModes[key];
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: '#E2E8F0' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      onUpdateSetting('osnapModes', {
                        ...settings.osnapModes,
                        [key]: !isChecked
                      });
                    }}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </footer>
  );
}
