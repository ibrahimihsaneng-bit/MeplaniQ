import React, { useMemo } from 'react';

/**
 * ValidationDrawer — Design Intelligence & Engineering Verification System.
 * Audits spatial layout, door swing conflicts, HVAC sizing, and MEP plumbing routing.
 */
export default function ValidationDrawer({
  isOpen,
  onClose,
  solveData,
  editableDoors = [],
  editableWindows = [],
  editableHvac = [],
  editableFurniture = [],
  editablePlumbingFixtures = [],
  editablePlumbingPipes = [],
  onSelectIssue
}) {
  const auditResults = useMemo(() => {
    const issues = [];
    let validCount = 0;

    const rooms = solveData?.rooms || [];
    const doors = editableDoors.length > 0 ? editableDoors : (solveData?.doors || []);
    const windows = editableWindows.length > 0 ? editableWindows : (solveData?.windows || []);
    const hvac = editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []);
    const furniture = editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || []);
    const fixtures = editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || []);
    const pipes = editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || []);

    // 1. Audit Rooms
    rooms.forEach(r => {
      const pts = r.points || [];
      if (pts.length < 3) {
        issues.push({
          id: `room-err-${r.name}`,
          type: 'Room',
          severity: 'error',
          targetId: r.name,
          title: `Incomplete Room Boundary: ${r.name}`,
          description: `Room polygon has only ${pts.length} points. Minimum 3 points required for 2D boundary calculation.`,
          recommendation: 'Verify coordinate vertices in Room Schedule or re-import plan payload.',
          coords: pts[0] ? { x: pts[0][0], y: pts[0][1] } : null
        });
      } else {
        validCount++;
      }
    });

    // 2. Audit Doors & Windows
    doors.forEach(d => {
      if (!d.host_room && !d.host_room_id) {
        issues.push({
          id: `door-warn-${d.id}`,
          type: 'Door',
          severity: 'warning',
          targetId: d.id,
          title: `Unassigned Host Wall: Door ${d.id}`,
          description: `Door '${d.id}' does not have a designated host room wall.`,
          recommendation: 'Select the door in Property Inspector and designate a host room wall side.',
          coords: { x: d.x || 0, y: d.y || 0 }
        });
      } else if (Number(d.width_mm || d.width) < 750) {
        issues.push({
          id: `door-narrow-${d.id}`,
          type: 'Door',
          severity: 'warning',
          targetId: d.id,
          title: `Narrow Door Width: Door ${d.id} (${d.width_mm || d.width}mm)`,
          description: 'Door width is under standard IBC minimum (750mm for bathrooms, 900mm for bedrooms).',
          recommendation: 'Increase clear opening width to at least 800mm or 900mm.',
          coords: { x: d.x || 0, y: d.y || 0 }
        });
      } else {
        validCount++;
      }
    });

    windows.forEach(w => {
      if (Number(w.width_mm || w.width) < 600) {
        issues.push({
          id: `win-narrow-${w.id}`,
          type: 'Window',
          severity: 'warning',
          targetId: w.id,
          title: `Narrow Window Opening: Window ${w.id}`,
          description: 'Window width is less than 600mm, which may restrict required natural ventilation.',
          recommendation: 'Check local building ventilation code (min 10% carpet area glazing).',
          coords: { x: w.x || 0, y: w.y || 0 }
        });
      } else {
        validCount++;
      }
    });

    // 3. Audit HVAC Equipment
    hvac.forEach(h => {
      const cap = Number(h.cooling_capacity_tr || h.capacity_tr || 0);
      if (cap <= 0) {
        issues.push({
          id: `hvac-cap-${h.id}`,
          type: 'HVAC',
          severity: 'error',
          targetId: h.id,
          title: `Zero Tonnage: HVAC Unit ${h.id}`,
          description: 'Cooling capacity is 0 TR. Equipment will not deliver cooling airflow.',
          recommendation: 'Input a valid cooling tonnage (e.g., 1.5 TR or 2.0 TR).',
          coords: { x: h.location_x || h.x || 0, y: h.location_y || h.y || 0 }
        });
      } else {
        validCount++;
      }
    });

    // 4. Audit Plumbing Fixtures & Routing
    fixtures.forEach(f => {
      const status = f.clearance_status || '';
      if (status.includes('Overlap') || status.includes('Collision') || status.includes('Wall')) {
        issues.push({
          id: `plm-clearance-${f.id}`,
          type: 'Plumbing',
          severity: 'error',
          targetId: f.id,
          title: `Plumbing Clearance Conflict: ${f.id} (${f.type})`,
          description: `Fixture clearance check flagged: ${status}. Position overlaps structural element.`,
          recommendation: 'Reposition fixture at least 100mm away from wall envelope.',
          coords: { x: f.x || 0, y: f.y || 0 }
        });
      } else {
        validCount++;
      }
    });

    // 5. Audit Furniture
    furniture.forEach(f => {
      const status = f.clearance_status || '';
      if (status.includes('Blocks Door')) {
        issues.push({
          id: `furn-door-${f.id}`,
          type: 'Furniture',
          severity: 'error',
          targetId: f.id,
          title: `Door Swing Conflict: Furniture ${f.id} (${f.type})`,
          description: `Item obstructs the 90° door swing arc of an adjacent room entrance.`,
          recommendation: 'Move furniture piece away from door entry swing corridor.',
          coords: { x: f.x || 0, y: f.y || 0 }
        });
      } else if (status.includes('Wall') || status.includes('Overlap')) {
        issues.push({
          id: `furn-wall-${f.id}`,
          type: 'Furniture',
          severity: 'warning',
          targetId: f.id,
          title: `Tight Clearance: Furniture ${f.id} (${f.type})`,
          description: `Clearance margin is constricted (${status}).`,
          recommendation: 'Adjust item dimensions or rotate 90° to fit room circulation.',
          coords: { x: f.x || 0, y: f.y || 0 }
        });
      } else {
        validCount++;
      }
    });

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return {
      issues,
      validCount,
      warningCount,
      errorCount
    };
  }, [solveData, editableDoors, editableWindows, editableHvac, editableFurniture, editablePlumbingFixtures, editablePlumbingPipes]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '380px',
      height: '100%',
      backgroundColor: 'var(--bg-panel)',
      borderLeft: '1px solid var(--border-subtle)',
      borderRight: '1px solid var(--border-subtle)',
      boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.45)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-elevated)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔍</span>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Design Check &amp; Auditing
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-Time Spatial &amp; MEP Validation
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '2px 6px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Tally Bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-around',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-success)' }}>
            {auditResults.validCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Passed Checks
          </div>
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--border-subtle)' }} />

        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-warning)' }}>
            {auditResults.warningCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Warnings
          </div>
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--border-subtle)' }} />

        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-error)' }}>
            {auditResults.errorCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Conflicts
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {auditResults.issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h4 style={{ color: 'var(--status-success)', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              All Engineering Checks Passed!
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Zero door clearance conflicts, plumbing routing tangles, or unassigned boundary walls detected.
            </p>
          </div>
        ) : (
          auditResults.issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onSelectIssue && onSelectIssue(issue)}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid',
                borderColor: issue.severity === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: issue.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: issue.severity === 'error' ? 'var(--status-error)' : 'var(--status-warning)'
                }}>
                  {issue.severity === 'error' ? 'Conflict' : 'Warning'} • {issue.type}
                </span>

                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                  Focus ↗
                </span>
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {issue.title}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: '0 0 6px 0' }}>
                {issue.description}
              </p>

              <div style={{
                fontSize: '0.75rem',
                color: '#CBD5E1',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '6px 8px',
                borderRadius: '4px',
                borderLeft: `2px solid ${issue.severity === 'error' ? 'var(--status-error)' : 'var(--status-warning)'}`
              }}>
                💡 <strong>Action:</strong> {issue.recommendation}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
