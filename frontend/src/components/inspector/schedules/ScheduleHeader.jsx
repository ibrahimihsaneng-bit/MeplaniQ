import React from 'react';

/**
 * ScheduleHeader: Standardized compact header for each active engineering schedule.
 */
export default function ScheduleHeader({
  title,
  count,
  countUnit = 'items',
  addLabel = '+ Add Item',
  onAddClick,
  isAdding = false,
  filterOptions = null,
  activeFilter = null,
  onFilterChange = null
}) {
  return (
    <div
      className="schedule-header border-b border-[#2A3441] bg-[#111418] px-4 py-2.5 shrink-0"
      style={{
        borderBottom: '1px solid #2A3441',
        backgroundColor: '#111418',
        padding: '10px 16px',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <h3
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#F8FAFC',
              margin: 0
            }}
          >
            {title}
          </h3>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            {count} {countUnit} defined
          </span>
        </div>

        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            style={{
              backgroundColor: isAdding ? '#1E293B' : '#2F80ED',
              border: isAdding ? '1px solid #334155' : 'none',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
            title={isAdding ? "Cancel adding new item" : `Add new ${title.toLowerCase()}`}
          >
            <span>{isAdding ? '✕ Cancel' : addLabel}</span>
          </button>
        )}
      </div>

      {filterOptions && filterOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', overflowX: 'auto' }}>
          {filterOptions.map((opt) => {
            const isSelected = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange && onFilterChange(opt.id)}
                style={{
                  fontSize: '10.5px',
                  fontWeight: isSelected ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid #38BDF8' : '1px solid #2A3441',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(24, 32, 47, 0.5)',
                  color: isSelected ? '#38BDF8' : '#94A3B8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {opt.label} {opt.count !== undefined && `(${opt.count})`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
