import React, { useState, useMemo } from 'react';
import {
  CLIMATE_ZONES,
  ENVELOPE_STANDARDS,
  compileFloorplanThermalZones
} from './thermalZoneEngine';

/**
 * ThermalZoneStudioModal.jsx
 * ==========================
 * Commercial ASHRAE 90.1 / ISO 52016 2D Thermal Zone & Building Physics Studio.
 * Analyzes space boundaries, orientation-dependent solar gains, conduction,
 * and internal loads to compute peak cooling/heating kW, CFM, and zone heatmaps.
 */
export default function ThermalZoneStudioModal({
  isOpen,
  onClose,
  solveData,
  showThermalHeatmap,
  onToggleThermalHeatmap,
  projectName = 'MeplanIQ Floorplan'
}) {
  const [selectedClimateKey, setSelectedClimateKey] = useState('ZONE_3');
  const [selectedEnvelopeKey, setSelectedEnvelopeKey] = useState('ASHRAE_90_1_2019');
  const [ceilingHeightM, setCeilingHeightM] = useState(2.8);
  const [glazingRatio, setGlazingRatio] = useState(0.25);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const climate = CLIMATE_ZONES[selectedClimateKey] || CLIMATE_ZONES.ZONE_3;
  const envelope = ENVELOPE_STANDARDS[selectedEnvelopeKey] || ENVELOPE_STANDARDS.ASHRAE_90_1_2019;

  // Compile thermal zones
  const thermalData = useMemo(() => {
    return compileFloorplanThermalZones(solveData, {
      climate,
      envelope,
      ceilingHeightM: Number(ceilingHeightM),
      glazingRatio: Number(glazingRatio)
    });
  }, [solveData, climate, envelope, ceilingHeightM, glazingRatio]);

  const { zones, totals } = thermalData;

  const activeZone = useMemo(() => {
    if (!selectedRoomId) return zones[0] || null;
    return zones.find(z => z.roomId === selectedRoomId) || zones[0] || null;
  }, [zones, selectedRoomId]);

  // Export CSV summary
  const handleExportCsv = () => {
    const headers = ['Room Name', 'Area (m2)', 'Zone Classification', 'Dominant Orientation', 'Exposed Wall (m)', 'Cooling (kW)', 'Cooling (BTU/h)', 'Airflow (CFM)', 'Heating (kW)', 'Density (W/m2)', 'Status'];
    const rows = zones.map(z => [
      `"${z.roomName}"`,
      z.areaM2,
      `"${z.zoneClassification}"`,
      `"${z.boundary.primaryOrientation}"`,
      z.boundary.exposedLengthM.toFixed(1),
      z.totalCoolingKw,
      z.totalCoolingBtu,
      z.requiredAirflowCfm,
      z.totalHeatingKw,
      z.loadDensityWm2,
      `"${z.heatBadge}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_')}_thermal_zones.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.95)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* ─── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #334155',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>🌡️</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.4px' }}>
              2D THERMAL ZONE &amp; SPACE BOUNDARY STUDIO
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              ASHRAE 90.1 / ISO 52016 Peak Cooling, Heating &amp; Supply Airflow (CFM) Calculations
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Canvas Heatmap Overlay Toggle */}
          <button
            type="button"
            onClick={onToggleThermalHeatmap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showThermalHeatmap ? '#D97706' : '#1E293B',
              border: `1px solid ${showThermalHeatmap ? '#F59E0B' : '#475569'}`,
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🔥</span>
            <span>2D Canvas Heatmap: {showThermalHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284C7',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span>📊</span>
            <span>Export CSV</span>
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#334155',
              border: 'none',
              color: '#E2E8F0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Top KPI Scorecards ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          padding: '14px 24px',
          backgroundColor: '#0A0F1D',
          borderBottom: '1px solid #1E293B',
          flexShrink: 0
        }}
      >
        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PEAK COOLING LOAD</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#38BDF8', marginTop: '2px' }}>
            {totals.totalCoolingKw} <span style={{ fontSize: '12px', fontWeight: 500 }}>kW</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {totals.totalCoolingBtu.toLocaleString()} BTU/h ({totals.totalCoolingTons} TR)
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>DESIGN AIRFLOW (CFM)</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
            {totals.totalAirflowCfm.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 500 }}>CFM</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            @ 12.5°C Supply Air (ΔT = 10.5K)
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>DESIGN HEATING LOAD</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
            {totals.totalHeatingKw} <span style={{ fontSize: '12px', fontWeight: 500 }}>kW</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Winter Outdoor: {climate.winterToutC}°C
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>AVG LOAD DENSITY</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#C084FC', marginTop: '2px' }}>
            {totals.avgLoadDensityWm2} <span style={{ fontSize: '12px', fontWeight: 500 }}>W/m²</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Total Area: {totals.totalFloorAreaM2} m²
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>ACTIVE SPACES</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#F8FAFC', marginTop: '2px' }}>
            {totals.roomCount} <span style={{ fontSize: '12px', fontWeight: 500 }}>Thermal Zones</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Full Space Boundary Coverage
          </div>
        </div>
      </div>

      {/* ─── Main Content Splitter ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: Climate & Envelope Parameters Sidebar */}
        <div
          style={{
            width: '320px',
            backgroundColor: '#0F172A',
            borderRight: '1px solid #1E293B',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          {/* Climate Zone */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#38BDF8', marginBottom: '6px' }}>
              ASHRAE CLIMATE LOCATION
            </label>
            <select
              value={selectedClimateKey}
              onChange={(e) => setSelectedClimateKey(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '7px 10px',
                fontSize: '11.5px'
              }}
            >
              {Object.entries(CLIMATE_ZONES).map(([k, c]) => (
                <option key={k} value={k}>{c.name}</option>
              ))}
            </select>
            <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '4px' }}>
              Summer Design: {climate.summerToutC}°C • Winter: {climate.winterToutC}°C
            </div>
          </div>

          {/* Envelope Standard */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
              ENVELOPE INSULATION GRADE
            </label>
            <select
              value={selectedEnvelopeKey}
              onChange={(e) => setSelectedEnvelopeKey(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '7px 10px',
                fontSize: '11.5px'
              }}
            >
              {Object.entries(ENVELOPE_STANDARDS).map(([k, env]) => (
                <option key={k} value={k}>{env.name}</option>
              ))}
            </select>
            <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '4px' }}>
              Wall U: {envelope.wallUValue} W/m²K • Window U: {envelope.windowUValue} W/m²K (SHGC {envelope.windowShgc})
            </div>
          </div>

          {/* Ceiling Height & Glazing Ratio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                CEILING HEIGHT (m)
              </label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="6.0"
                value={ceilingHeightM}
                onChange={(e) => setCeilingHeightM(parseFloat(e.target.value) || 2.8)}
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                WINDOW RATIO (WWR)
              </label>
              <select
                value={glazingRatio}
                onChange={(e) => setGlazingRatio(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '12px'
                }}
              >
                <option value={0.15}>15% (Low)</option>
                <option value={0.25}>25% (Standard)</option>
                <option value={0.40}>40% (High Glass)</option>
                <option value={0.60}>60% (Curtain Wall)</option>
              </select>
            </div>
          </div>

          {/* Heatmap Legend */}
          <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8', marginBottom: '8px' }}>
              THERMAL LOAD DENSITY LEGEND:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#EF4444' }} />
                <span>&gt; 130 W/m² (Critical Peak Solar)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#F59E0B' }} />
                <span>100 – 130 W/m² (High Perimeter Load)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#10B981' }} />
                <span>70 – 100 W/m² (Moderate Occupancy)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#38BDF8' }} />
                <span>&lt; 70 W/m² (Low / Core / Corridor)</span>
              </div>
            </div>
          </div>

          {/* Selected Zone Detail Card */}
          {activeZone && (
            <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${activeZone.heatColor}` }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#F8FAFC' }}>
                INSPECTING: {activeZone.roomName.toUpperCase()}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                Zone: <strong style={{ color: activeZone.heatColor }}>{activeZone.zoneClassification}</strong>
              </div>
              <div style={{ fontSize: '10.5px', color: '#E2E8F0', marginTop: '6px', lineHeight: '1.5' }}>
                • Cooling: <strong>{activeZone.totalCoolingKw} kW</strong> ({activeZone.totalCoolingBtu.toLocaleString()} BTU/h)<br />
                • Supply Airflow: <strong style={{ color: '#10B981' }}>{activeZone.requiredAirflowCfm} CFM</strong><br />
                • Heating: <strong>{activeZone.totalHeatingKw} kW</strong><br />
                • Load Density: <strong>{activeZone.loadDensityWm2} W/m²</strong><br />
                • Wall Solar &amp; Cond: {activeZone.breakdownCooling.wallCondW + activeZone.breakdownCooling.windowSolarW} W<br />
                • Internal (People/LPD/EPD): {activeZone.breakdownCooling.peopleSensibleW + activeZone.breakdownCooling.lightingW + activeZone.breakdownCooling.equipmentW} W
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Thermal Zone Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0B0F19' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8' }}>
              THERMAL ZONE SCHEDULE &amp; AIRFLOW DISTRIBUTION ({zones.length} SPACES)
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Click any row to inspect breakdown
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1E293B', color: '#38BDF8', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Space Name</th>
                <th style={{ padding: '8px 12px' }}>Area (m²)</th>
                <th style={{ padding: '8px 12px' }}>Zone Classification</th>
                <th style={{ padding: '8px 12px' }}>Exposed Wall</th>
                <th style={{ padding: '8px 12px' }}>Cooling (kW)</th>
                <th style={{ padding: '8px 12px' }}>Airflow (CFM)</th>
                <th style={{ padding: '8px 12px' }}>Heating (kW)</th>
                <th style={{ padding: '8px 12px' }}>Density (W/m²)</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, idx) => {
                const isSelected = z.roomId === activeZone?.roomId;
                return (
                  <tr
                    key={z.roomId || idx}
                    onClick={() => setSelectedRoomId(z.roomId)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : (idx % 2 === 0 ? '#0B0F19' : '#0F172A'),
                      borderBottom: '1px solid #1E293B',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#F8FAFC' }}>
                      {z.roomName}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{z.areaM2}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: z.heatFill,
                          color: z.heatColor,
                          fontWeight: 700,
                          fontSize: '10.5px'
                        }}
                      >
                        {z.zoneClassification}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                      {z.boundary.exposedLengthM.toFixed(1)} m ({z.boundary.primaryOrientation})
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: '#38BDF8' }}>
                      {z.totalCoolingKw} kW
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: '#10B981' }}>
                      {z.requiredAirflowCfm} CFM
                    </td>
                    <td style={{ padding: '8px 12px', color: '#F59E0B' }}>
                      {z.totalHeatingKw} kW
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {z.loadDensityWm2} W/m²
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: `${z.heatColor}25`,
                          color: z.heatColor
                        }}
                      >
                        {z.heatBadge}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
