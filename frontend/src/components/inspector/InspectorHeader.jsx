import React from 'react';
import { DISCIPLINE_CONFIG, DISCIPLINE_VIEWS } from '../../features/discipline/disciplineTypes';

/**
 * InspectorHeader: Sleek, compact header for the Engineering Inspector.
 */
export default function InspectorHeader({
  projectName,
  selectedElement,
  onClearSelection,
  onToggleCollapse,
  disciplineView = 'all'
}) {
  const activeDiscipline = DISCIPLINE_CONFIG[disciplineView] || DISCIPLINE_CONFIG[DISCIPLINE_VIEWS.ALL];
  return (
    <div
      className="inspector-header px-4 py-3 border-b border-[#2A3441] bg-[#111418] flex items-center justify-between shrink-0"
      style={{
        padding: '10px 16px',
        backgroundColor: '#111418',
        borderBottom: '1px solid #2A3441',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2
            style={{
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#F8FAFC',
              margin: 0
            }}
          >
            Engineering Inspector
          </h2>
          {disciplineView && disciplineView !== DISCIPLINE_VIEWS.ALL && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: activeDiscipline.color || '#38BDF8',
                backgroundColor: activeDiscipline.activeBg || 'rgba(56, 189, 248, 0.15)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${activeDiscipline.activeBorder || '#38BDF8'}`
              }}
              title={`Filtered to ${activeDiscipline.label} Discipline`}
            >
              {activeDiscipline.icon} {activeDiscipline.shortLabel}
            </span>
          )}
          {selectedElement && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}
            >
              {selectedElement.type}: {selectedElement.item?.id || selectedElement.item?.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            {projectName ? `${projectName} Engineering Data` : 'Project Engineering Data'}
          </span>
          {selectedElement && (
            <button
              type="button"
              onClick={onClearSelection}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '10.5px',
                cursor: 'pointer',
                padding: '0 4px',
                textDecoration: 'underline'
              }}
              title="Clear selection (Esc)"
            >
              ✕ Clear Selection
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inspector-collapse-btn"
          style={{
            background: 'transparent',
            border: '1px solid #2A3441',
            color: '#94A3B8',
            borderRadius: '6px',
            padding: '5px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
          title="Collapse Inspector to maximize CAD canvas"
        >
          <span>Collapse</span>
          <span>▶</span>
        </button>
      </div>
    </div>
  );
}
