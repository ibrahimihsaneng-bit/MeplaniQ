import React from 'react';
import {
  DISCIPLINE_VIEWS,
  DISCIPLINE_DISPLAY_MODES,
  DISCIPLINE_CONFIG
} from './disciplineTypes';

/**
 * DisciplineSelector: Segmented discipline view selector docked in the top navbar.
 * Allows instant switching between All, Architecture, HVAC, Plumbing, and Electrical views,
 * along with a toggle for Dim (Ghosting) vs Isolate (Focus) rendering mode.
 */
export default function DisciplineSelector({
  activeView = DISCIPLINE_VIEWS.ALL,
  onViewChange,
  displayMode = DISCIPLINE_DISPLAY_MODES.DIM,
  onDisplayModeToggle
}) {
  const views = [
    DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.ALL],
    DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.ARCHITECTURE],
    DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.HVAC],
    DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.PLUMBING],
    DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.ELECTRICAL]
  ];

  return (
    <div
      className="cad-discipline-selector-container"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#0F172A',
        padding: '3px 4px',
        borderRadius: '8px',
        border: '1px solid #1E293B',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        userSelect: 'none'
      }}
      role="region"
      aria-label="CAD Discipline Layer Selector"
    >
      {/* 1. Segmented Discipline View Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'rgba(2, 6, 23, 0.5)',
          padding: '2px',
          borderRadius: '6px'
        }}
        role="tablist"
      >
        {views.map((v) => {
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onViewChange && onViewChange(v.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? (v.activeBg || 'rgba(56, 189, 248, 0.15)') : 'transparent',
                border: isActive ? `1px solid ${v.activeBorder || '#38BDF8'}` : '1px solid transparent',
                boxShadow: isActive ? `0 0 10px ${v.activeBg}` : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title={`${v.label} Discipline (${v.description}) • Shortcut: [${v.shortcut}]`}
            >
              <span style={{ fontSize: '12px', lineHeight: 1 }}>{v.icon}</span>
              <span style={{ letterSpacing: '0.02em' }}>{v.label}</span>
              {isActive && (
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: v.color,
                    boxShadow: `0 0 4px ${v.color}`
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Divider */}
      <div style={{ width: '1px', height: '18px', backgroundColor: '#334155' }} />

      {/* 3. Ghost / Isolate Mode Toggle */}
      <button
        type="button"
        onClick={() => onDisplayModeToggle && onDisplayModeToggle()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '5px',
          fontSize: '10px',
          fontWeight: 600,
          color: displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? '#F59E0B' : '#38BDF8',
          backgroundColor: displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(56, 189, 248, 0.10)',
          border: `1px solid ${displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.25)'}`,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap'
        }}
        title={
          displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE
            ? "Mode: Isolate (Inactive disciplines hidden). Click to switch to Ghost (Dim)."
            : "Mode: Ghost / Underlay (Inactive disciplines dimmed at 18%). Click to Isolate."
        }
      >
        <span>{displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE ? '🎯 Isolate' : '👻 Ghost'}</span>
      </button>
    </div>
  );
}
