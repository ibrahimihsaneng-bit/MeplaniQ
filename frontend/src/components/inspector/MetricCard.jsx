import React from 'react';

/**
 * MetricCard: Compact engineering overview card for the Inspector Summary.
 */
export default function MetricCard({
  label,
  value,
  subValue,
  icon,
  status = 'default',
  accentColor
}) {
  const getStatusColor = () => {
    if (status === 'success') return 'text-emerald-400';
    if (status === 'warning') return 'text-amber-400';
    if (status === 'error') return 'text-rose-400';
    return accentColor || 'text-slate-100';
  };

  return (
    <div
      className="metric-card bg-[#18202F]/70 border border-[#2A3441] rounded-lg p-2.5 flex flex-col justify-between transition-colors hover:border-[#384556]"
      style={{
        backgroundColor: 'rgba(24, 32, 47, 0.7)',
        border: '1px solid #2A3441',
        borderRadius: '8px',
        padding: '10px 12px'
      }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400"
          style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 600 }}
        >
          {label}
        </span>
        {icon && (
          <span className="text-xs opacity-70" style={{ fontSize: '12px' }}>
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span
          className={`text-lg font-bold tracking-tight ${getStatusColor()}`}
          style={{ fontSize: '17px', fontWeight: 700, color: status === 'success' ? '#34D399' : status === 'warning' ? '#FBBF24' : accentColor || '#F8FAFC' }}
        >
          {value}
        </span>
      </div>

      {subValue && (
        <span
          className="text-[10px] text-slate-500 font-medium mt-1 truncate"
          style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}
        >
          {subValue}
        </span>
      )}
    </div>
  );
}
