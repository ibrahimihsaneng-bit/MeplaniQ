import React from 'react';
import MetricCard from './MetricCard';

/**
 * InspectorSummary: Collapsible summary section displaying the 4 core BIM metrics.
 */
export default function InspectorSummary({
  totalCarpetAreaSqM = 0,
  totalCarpetAreaSqFt = 0,
  roomsCount = 0,
  openingsCount = 0,
  totalHvacTR = 0,
  hvacUnitsCount = 0,
  totalIssuesCount = 0,
  isExpanded = true,
  onToggle,
  onOpenBoq,
  onExportPdf1,
  onExportPdf2,
  isExportingPdf1 = false,
  isExportingPdf2 = false
}) {
  return (
    <div className="inspector-summary border-b border-[#2A3441] bg-[#111418] shrink-0">
      {/* Collapsible Accordion Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.02] transition-colors select-none"
        style={{
          width: '100%',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          color: '#CBD5E1',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          cursor: 'pointer'
        }}
        title={isExpanded ? "Collapse project summary" : "Expand project summary"}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8' }}>
            Project Summary
          </span>
          {!isExpanded && (
            <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 500, backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              {totalCarpetAreaSqM.toFixed(1)} m² &bull; {roomsCount} rooms
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#64748B', transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          ▼
        </span>
      </button>

      {/* 2x2 Compact Metric Grid & PDF Center */}
      {isExpanded && (
        <>
          <div
            className="grid grid-cols-2 gap-2 p-3 pt-0"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              padding: '4px 14px 10px 14px'
            }}
          >
            <MetricCard
              label="Carpet Area"
              value={`${totalCarpetAreaSqM.toFixed(1)} m²`}
              subValue={`${totalCarpetAreaSqFt} sq ft`}
              icon="📐"
              accentColor="#F8FAFC"
            />
            <MetricCard
              label="Rooms / Zones"
              value={`${roomsCount}`}
              subValue={`${openingsCount} openings`}
              icon="🚪"
              accentColor="#F8FAFC"
            />
            <MetricCard
              label="HVAC Cooling"
              value={`${totalHvacTR.toFixed(1)} TR`}
              subValue={`${hvacUnitsCount} unit${hvacUnitsCount === 1 ? '' : 's'}`}
              icon="❄️"
              accentColor="#38BDF8"
            />
            <MetricCard
              label="Audit Status"
              value={totalIssuesCount > 0 ? `${totalIssuesCount} Warnings` : '✓ Valid'}
              subValue={totalIssuesCount > 0 ? 'Review Warnings' : 'Code Check Pass'}
              icon="🛡️"
              status={totalIssuesCount > 0 ? 'warning' : 'success'}
            />
          </div>

          {/* Quick PDF & BOQ Export Center */}
          <div
            style={{
              padding: '0 14px 12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={onExportPdf1}
                disabled={isExportingPdf1}
                style={{
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  border: '1px solid #38BDF8',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: isExportingPdf1 ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 4px rgba(2, 132, 199, 0.3)'
                }}
                title="Export PDF 1: Building Spatial Quantities & Engineering Schedules Report"
              >
                <span>{isExportingPdf1 ? 'Exporting...' : '📄 PDF 1: Quantities'}</span>
              </button>

              <button
                type="button"
                onClick={onExportPdf2}
                disabled={isExportingPdf2}
                style={{
                  background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                  border: '1px solid #F87171',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: isExportingPdf2 ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 4px rgba(220, 38, 38, 0.3)'
                }}
                title="Export PDF 2: Material Quantities & Cost Estimation (BOQ) Report"
              >
                <span>{isExportingPdf2 ? 'Exporting...' : '📑 PDF 2: BOQ Cost'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenBoq}
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                border: '1px solid #FCD34D',
                color: '#0F172A',
                fontSize: '11px',
                fontWeight: 800,
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
              }}
              title="Open Bill of Materials & Construction Cost Estimation (Low/Medium/High Tiers)"
            >
              <span>📊 Bill of Materials & Cost (BOQ)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
