import React from 'react';

/**
 * ScheduleNavigation: Horizontal tab bar for selecting the active engineering schedule.
 * Enforces the Single Active Schedule rule.
 */
export default function ScheduleNavigation({
  activeTab = 'rooms',
  onTabChange,
  counts = {
    rooms: 0,
    openings: 0,
    hvac: 0,
    furniture: 0,
    plumbing: 0,
    electrical: 0
  },
  disciplineView = 'all'
}) {
  const tabs = [
    { id: 'rooms', label: 'Rooms', count: counts.rooms, icon: '📐', color: '#38BDF8' },
    { id: 'openings', label: 'Openings', count: counts.openings, icon: '🚪', color: '#38BDF8' },
    { id: 'hvac', label: 'HVAC', count: counts.hvac, icon: '❄️', color: '#C084FC' },
    { id: 'furniture', label: 'Furn.', count: counts.furniture, icon: '🪑', color: '#818CF8' },
    { id: 'plumbing', label: 'Plumb.', count: counts.plumbing, icon: '🚿', color: '#06B6D4' },
    { id: 'electrical', label: 'Elect.', count: counts.electrical, icon: '⚡', color: '#F59E0B' },
    { id: 'automation', label: 'Automation', count: counts.automation || '⚡', icon: '⚡', color: '#10B981' },
    { id: 'boq', label: 'Materials & Cost', count: counts.boq || 'BOQ', icon: '📊', color: '#F59E0B' }
  ];

  return (
    <div
      className="schedule-navigation flex items-center gap-1.5 shrink-0 overflow-x-auto"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}
      role="tablist"
      aria-label="Engineering Schedules"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const accent = tab.color || '#38BDF8';
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '4px 10px',
              border: isActive ? `1px solid ${accent}` : '1px solid #2A3441',
              backgroundColor: isActive ? `${accent}26` : 'rgba(24, 32, 47, 0.6)',
              color: isActive ? accent : '#94A3B8',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            title={`${tab.label} Schedule (${tab.count} items)`}
          >
            <span style={{ fontSize: '12px' }}>{tab.icon}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {tab.label}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isActive ? accent : '#64748B',
                backgroundColor: isActive ? `${accent}33` : 'rgba(255, 255, 255, 0.05)',
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
