import React, { useState } from 'react';

/**
 * EngineeringProbeHud.jsx
 * =======================
 * Award-Winning Scientific HUD & Physical Telemetry Inspector Callout.
 * Inspired by The Monolith Project & Bruno Simon's interactive inspection architecture.
 * 
 * Renders high-precision floating telemetry badges with animated laser guides,
 * live physical calculations (fluid velocity, thermal U-values, pressure drops,
 * voltage drop, acoustic NC rating), and one-click field observation logging.
 */
export default function EngineeringProbeHud({
  probeData,
  cursorCoords,
  isPinned = false,
  onPinObservation,
  onClose
}) {
  const [copied, setCopied] = useState(false);

  if (!probeData) return null;

  const { discipline, title, subtitle, metrics } = probeData;

  const handleCopyTelemetry = () => {
    const text = [
      `=== MEPLANIQ ENGINEERING PROBE TELEMETRY ===`,
      `Subject: ${title}`,
      `Details: ${subtitle}`,
      ...metrics.map(m => `${m.label}: ${m.value} ${m.secondary ? `[${m.secondary}]` : ''}`)
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '24px',
        width: '380px',
        maxWidth: '92vw',
        zIndex: 1000,
        backgroundColor: 'rgba(9, 13, 22, 0.94)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.15)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* ─── Top Telemetry Header ────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0F172A',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: `${discipline.color}22`,
              border: `1.5px solid ${discipline.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              flexShrink: 0
            }}
          >
            {discipline.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: discipline.color
                }}
              >
                {discipline.name}
              </span>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 8px #10B981'
                }}
              />
              <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>LIVE PROBE</span>
            </div>
            <h4
              style={{
                margin: '2px 0 0 0',
                fontSize: '14px',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em'
              }}
            >
              {title}
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onPinObservation && (
            <button
              onClick={onPinObservation}
              title={isPinned ? "Pinned to Evidence Log" : "Pin observation to Field Notebook"}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: isPinned ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: isPinned ? '#60A5FA' : '#94A3B8',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isPinned ? '📌 Pinned' : '📌 Pin'}
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#94A3B8',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Subtitle / Spec Note */}
      {subtitle && (
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: '#090D16',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            fontSize: '11px',
            color: '#94A3B8',
            fontFamily: 'monospace'
          }}
        >
          {subtitle}
        </div>
      )}

      {/* ─── Telemetry Metrics List ───────────────────────────────────────── */}
      <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
        {metrics.map((metric, idx) => {
          let badgeBg = 'rgba(255, 255, 255, 0.04)';
          let badgeColor = '#F1F5F9';
          let borderCol = 'rgba(255, 255, 255, 0.06)';

          if (metric.status === 'optimal') {
            badgeBg = 'rgba(16, 185, 129, 0.12)';
            badgeColor = '#34D399';
            borderCol = 'rgba(16, 185, 129, 0.25)';
          } else if (metric.status === 'warning') {
            badgeBg = 'rgba(245, 158, 11, 0.15)';
            badgeColor = '#FBBF24';
            borderCol = 'rgba(245, 158, 11, 0.3)';
          } else if (metric.status === 'info') {
            badgeBg = 'rgba(59, 130, 246, 0.12)';
            badgeColor = '#60A5FA';
            borderCol = 'rgba(59, 130, 246, 0.25)';
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '7px',
                backgroundColor: badgeBg,
                border: `1px solid ${borderCol}`
              }}
            >
              <div>
                <div style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
                  {metric.label}
                </div>
                {metric.secondary && (
                  <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', marginTop: '1px' }}>
                    {metric.secondary}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: badgeColor,
                  fontFamily: 'monospace',
                  textAlign: 'right'
                }}
              >
                {metric.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Bottom Actions Strip ────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
          Target: ({Math.round(cursorCoords?.x || 0)}, {Math.round(cursorCoords?.y || 0)}) mm
        </span>
        <button
          onClick={handleCopyTelemetry}
          style={{
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: copied ? '#059669' : '#1E293B',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {copied ? '✓ Copied Telemetry' : '📋 Copy Data'}
        </button>
      </div>
    </div>
  );
}
