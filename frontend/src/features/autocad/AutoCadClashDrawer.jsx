import React from 'react';

/**
 * AutoCadClashDrawer.jsx
 * Multi-Discipline BIM Clash Detection Matrix & Spatial Coordination Panel.
 * Evaluates clearance, physical intersection, and code compliance across
 * Architecture, Structure, HVAC, Electrical, and Plumbing models.
 */
export default function AutoCadClashDrawer({
  clashData,
  onClose,
  onDownloadAuditReport,
  onHighlightClash
}) {
  if (!clashData) return null;

  const { clashes = [], summary = { total: 0, hard: 0, clearance: 0, status: 'COORDINATED' } } = clashData;
  const isPassing = summary.hard === 0;

  const disciplines = ['Architecture', 'Structure', 'HVAC', 'Electrical', 'Plumbing'];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '460px',
      height: '100%',
      backgroundColor: '#0B0F19',
      borderLeft: '1px solid #1E293B',
      boxShadow: '-10px 0 32px rgba(0,0,0,0.8)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 60,
      color: '#F8FAFC',
      fontSize: '12px',
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0F172A'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#F8FAFC' }}>
              BIM Clash & Coordination Engine
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Multi-Discipline Clearance Verification & Penetration Audit
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#94A3B8',
            borderRadius: '4px',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          ✕
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ padding: '16px 20px', background: '#0F172A', borderBottom: '1px solid #1E293B' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isPassing ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${isPassing ? '#22C55E' : '#EF4444'}`,
          borderRadius: '6px',
          padding: '10px 14px'
        }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>
              Coordination Status
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: isPassing ? '#4ADE80' : '#F87171' }}>
              {summary.status}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Hard Clashes</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: summary.hard > 0 ? '#EF4444' : '#4ADE80' }}>
                {summary.hard}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Clearances</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: summary.clearance > 0 ? '#F59E0B' : '#4ADE80' }}>
                {summary.clearance}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Coordination Matrix */}
        <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: '6px', padding: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '11px', color: '#38BDF8', marginBottom: '8px', textTransform: 'uppercase' }}>
            Multi-Discipline Interference Matrix
          </div>
          <table style={{ width: '100%', fontSize: '10px', textAlign: 'center', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                <th style={{ textAlign: 'left', padding: '4px' }}>Discipline</th>
                {disciplines.map(d => (
                  <th key={d} style={{ padding: '4px' }}>{d.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplines.map((rowD, rIdx) => (
                <tr key={rowD} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ textAlign: 'left', padding: '5px 4px', fontWeight: 700, color: '#E2E8F0' }}>{rowD}</td>
                  {disciplines.map((colD, cIdx) => {
                    if (rIdx === cIdx) {
                      return <td key={colD} style={{ color: '#475569' }}>—</td>;
                    }
                    const pairClashes = clashes.filter(c =>
                      (c.disciplineA === rowD && c.disciplineB === colD) ||
                      (c.disciplineA === colD && c.disciplineB === rowD)
                    );
                    const count = pairClashes.length;
                    return (
                      <td key={colD} style={{ padding: '4px' }}>
                        {count === 0 ? (
                          <span style={{ color: '#22C55E' }}>✓</span>
                        ) : (
                          <span style={{
                            background: pairClashes.some(p => p.severity === 'HARD') ? '#EF4444' : '#F59E0B',
                            color: '#FFFFFF',
                            borderRadius: '3px',
                            padding: '1px 5px',
                            fontWeight: 800
                          }}>
                            {count}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed Clash Incidents List */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '11px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
            Identified Incidents ({clashes.length})
          </div>

          {clashes.length === 0 ? (
            <div style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px dashed #22C55E',
              borderRadius: '6px',
              padding: '24px 16px',
              textAlign: 'center',
              color: '#4ADE80'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>✨</div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Zero Spatial Clashes Detected</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                All Architectural, Structural, and MEP systems are fully coordinated.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clashes.map((c, idx) => {
                const isHard = c.severity === 'HARD';
                return (
                  <div
                    key={c.id || idx}
                    style={{
                      background: '#1E293B',
                      border: `1px solid ${isHard ? '#EF4444' : '#F59E0B'}`,
                      borderRadius: '6px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: isHard ? '#991B1B' : '#92400E',
                        color: isHard ? '#FCA5A5' : '#FDE68A',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 800
                      }}>
                        {c.severity} CLASH
                      </span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {c.disciplineA} ↔ {c.disciplineB}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '11px', marginTop: '2px' }}>
                      {c.title}
                    </div>

                    <div style={{ fontSize: '11px', color: '#CBD5E1' }}>
                      {c.description}
                    </div>

                    <div style={{ fontSize: '10px', color: '#38BDF8', marginTop: '4px', borderTop: '1px solid #334155', paddingTop: '4px' }}>
                      💡 <strong>Recommendation:</strong> {c.recommendation}
                    </div>

                    {onHighlightClash && (
                      <button
                        type="button"
                        onClick={() => onHighlightClash(c.center)}
                        style={{
                          marginTop: '4px',
                          background: '#0F172A',
                          border: '1px solid #475569',
                          color: '#38BDF8',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: 700,
                          alignSelf: 'flex-start'
                        }}
                      >
                        🎯 Zoom to Clash
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #1E293B', background: '#0F172A', display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={onDownloadAuditReport}
          style={{
            flex: 1,
            background: '#0284C7',
            border: '1px solid #38BDF8',
            color: '#FFFFFF',
            padding: '8px',
            borderRadius: '4px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>📜</span>
          <span>Download Master Audit Dossier</span>
        </button>
      </div>
    </div>
  );
}
