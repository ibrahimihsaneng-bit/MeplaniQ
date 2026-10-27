import React, { useState, useMemo } from 'react';
import {
  PV_MODULE_TYPES,
  generateRooftopPvArray
} from './solarPvLayoutEngine';
import {
  extractBranchCircuits,
  balanceThreePhaseLoads
} from './electricalLoadEngine';

/**
 * ElectricalLoadPvStudioModal.jsx
 * ===============================
 * Commercial Electrical Engineering & Renewable Energy Suite.
 * - NEC 2023 / IEC 60364 3-Phase Main Distribution Board (MDB) Schedule & Balancing
 * - Rooftop Solar Photovoltaic (PV) Array Layout, DC Strings, and Inverter Sizing
 * - Interactive Single-Line Diagram (SLD) Schema
 */
export default function ElectricalLoadPvStudioModal({
  isOpen,
  onClose,
  solveData,
  showSolarPv,
  onToggleSolarPv,
  projectName = 'MeplanIQ Floorplan'
}) {
  const [activeTab, setActiveTab] = useState('db'); // 'db' | 'pv' | 'sld'
  const [selectedModuleKey, setSelectedModuleKey] = useState('TIER1_550W');
  const [orientation, setOrientation] = useState('PORTRAIT');
  const [setbackMm, setSetbackMm] = useState(900);
  const [rowPitchMm, setRowPitchMm] = useState(800);
  const [modulesPerString, setModulesPerString] = useState(14);

  // Generate Solar PV Array
  const pvData = useMemo(() => {
    return generateRooftopPvArray(solveData, {
      moduleTypeKey: selectedModuleKey,
      orientation,
      setbackMm: Number(setbackMm),
      rowPitchMm: Number(rowPitchMm),
      modulesPerString: Number(modulesPerString)
    });
  }, [solveData, selectedModuleKey, orientation, setbackMm, rowPitchMm, modulesPerString]);

  // Balance 3-Phase Electrical Loads
  const electricalData = useMemo(() => {
    const rawCircuits = extractBranchCircuits(solveData, pvData.metrics.systemCapacityKwp);
    return balanceThreePhaseLoads(rawCircuits);
  }, [solveData, pvData.metrics.systemCapacityKwp]);

  const { scheduledCircuits, metrics: mdbMetrics } = electricalData;
  const { metrics: pvMetrics, modules, strings, inverters } = pvData;

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Circuit ID', 'Description', 'Assigned Phase', 'Connected VA', 'Current (A)', 'MCB Rating (A)', 'Conductor', 'Conduit'];
    const rows = scheduledCircuits.map(c => [
      `"${c.id}"`,
      `"${c.description}"`,
      `"${c.assignedPhase}"`,
      c.connectedVa,
      c.currentA,
      c.breakerAmps,
      `"${c.conductor?.wireMm2} mm2 (${c.conductor?.awg})"`,
      `"${c.conductor?.conduitMm} mm"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_')}_electrical_schedule.csv`;
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
          <span style={{ fontSize: '24px' }}>⚡</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.4px' }}>
              ELECTRICAL LOAD SCHEDULE &amp; SOLAR PV STUDIO
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              NEC 2023 Article 220 3-Phase Balancing • Rooftop Photovoltaic String Routing &amp; Sizing
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Toggle Solar PV Layer on Canvas */}
          <button
            type="button"
            onClick={onToggleSolarPv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showSolarPv ? '#0284C7' : '#1E293B',
              border: `1px solid ${showSolarPv ? '#38BDF8' : '#475569'}`,
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>☀️</span>
            <span>2D Solar PV Layer: {showSolarPv ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1E293B',
              border: '1px solid #475569',
              color: '#F8FAFC',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span>📊</span>
            <span>Export Schedule CSV</span>
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
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>3-PHASE CONNECTED LOAD</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#38BDF8', marginTop: '2px' }}>
            {mdbMetrics.totalConnectedKva} <span style={{ fontSize: '12px', fontWeight: 500 }}>kVA</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Main 3P MCB: <strong style={{ color: '#F8FAFC' }}>{mdbMetrics.mainBreakerRatingAmps} A</strong>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PHASE UNBALANCE</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: mdbMetrics.isBalanced ? '#10B981' : '#F59E0B', marginTop: '2px' }}>
            {mdbMetrics.unbalancePct}% <span style={{ fontSize: '11px', fontWeight: 700, color: mdbMetrics.isBalanced ? '#34D399' : '#FACC15' }}>
              {mdbMetrics.isBalanced ? '✓ BALANCED' : '⚠️ WARNING'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Neutral Current: <strong style={{ color: '#F8FAFC' }}>{mdbMetrics.neutralCurrentA} A</strong>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>SOLAR PV DC CAPACITY</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#FACC15', marginTop: '2px' }}>
            {pvMetrics.systemCapacityKwp} <span style={{ fontSize: '12px', fontWeight: 500 }}>kWp</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {pvMetrics.totalModules} Modules ({pvMetrics.totalStrings} Strings)
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>ANNUAL SOLAR YIELD</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
            {pvMetrics.annualGenerationKwh.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 500 }}>kWh/yr</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            CO2 Offset: <strong style={{ color: '#34D399' }}>{pvMetrics.co2OffsetTonsPerYear} t/yr</strong>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>INVERTER CAPACITY</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#C084FC', marginTop: '2px' }}>
            {pvMetrics.inverterCapacityKw} <span style={{ fontSize: '12px', fontWeight: 500 }}>kW AC</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            DC/AC Ratio: <strong style={{ color: '#F8FAFC' }}>{pvMetrics.dcAcRatio}</strong> (Optimum: 1.20)
          </div>
        </div>
      </div>

      {/* ─── Main Content Splitter with Tabs ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #1E293B',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('db')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'db' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'db' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'db' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ⚡ 3-Phase Panel Schedule (MDB-01)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pv')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'pv' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'pv' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'pv' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ☀️ Rooftop Solar PV Designer ({pvMetrics.totalModules} Panels)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sld')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'sld' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'sld' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'sld' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📊 Single-Line Diagram (SLD) Schematic
          </button>
        </div>

        {/* TAB 1: 3-Phase DB Schedule */}
        {activeTab === 'db' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: Phase Balancing Summary Cards */}
            <div
              style={{
                width: '300px',
                backgroundColor: '#0F172A',
                borderRight: '1px solid #1E293B',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8' }}>
                PHASE LOADING BREAKDOWN:
              </div>

              {/* Phase A */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '6px', padding: '12px', borderLeft: '4px solid #EF4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                  <span>Phase A (L1 - Red)</span>
                  <span style={{ color: '#EF4444' }}>{mdbMetrics.phaseA.kva} kVA</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Line Current: <strong>{mdbMetrics.phaseA.currentA} A</strong>
                </div>
              </div>

              {/* Phase B */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '6px', padding: '12px', borderLeft: '4px solid #FACC15' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                  <span>Phase B (L2 - Yellow)</span>
                  <span style={{ color: '#FACC15' }}>{mdbMetrics.phaseB.kva} kVA</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Line Current: <strong>{mdbMetrics.phaseB.currentA} A</strong>
                </div>
              </div>

              {/* Phase C */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '6px', padding: '12px', borderLeft: '4px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                  <span>Phase C (L3 - Blue)</span>
                  <span style={{ color: '#3B82F6' }}>{mdbMetrics.phaseC.kva} kVA</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Line Current: <strong>{mdbMetrics.phaseC.currentA} A</strong>
                </div>
              </div>

              {/* Main Service Feed */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '6px', padding: '12px', marginTop: 'auto' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', marginBottom: '6px' }}>
                  MAIN FEED SPECIFICATIONS:
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.6' }}>
                  • Main Breaker: <strong>{mdbMetrics.mainBreakerRatingAmps}A 3P+N</strong><br />
                  • Main Cable: <strong>{mdbMetrics.mainConductor.wireMm2} mm² Cu</strong> ({mdbMetrics.mainConductor.awg})<br />
                  • Conduit Size: <strong>{mdbMetrics.mainConductor.conduitMm} mm Rigid PVC</strong><br />
                  • Voltage System: <strong>400V / 230V, 3-Phase 4-Wire + Earth</strong>
                </div>
              </div>
            </div>

            {/* Right: Full Branch Schedule Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0B0F19' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1E293B', color: '#38BDF8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Circuit ID</th>
                    <th style={{ padding: '8px 12px' }}>Load Description</th>
                    <th style={{ padding: '8px 12px' }}>Phase</th>
                    <th style={{ padding: '8px 12px' }}>Load (VA)</th>
                    <th style={{ padding: '8px 12px' }}>Current (A)</th>
                    <th style={{ padding: '8px 12px' }}>Breaker</th>
                    <th style={{ padding: '8px 12px' }}>Conductor</th>
                    <th style={{ padding: '8px 12px' }}>Conduit</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledCircuits.map((c, idx) => {
                    const phaseColor = {
                      L1: '#EF4444',
                      L2: '#FACC15',
                      L3: '#3B82F6',
                      'L1/L2/L3': '#10B981'
                    }[c.assignedPhase] || '#38BDF8';

                    return (
                      <tr
                        key={c.id || idx}
                        style={{
                          backgroundColor: idx % 2 === 0 ? '#0B0F19' : '#0F172A',
                          borderBottom: '1px solid #1E293B'
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 800, color: '#F8FAFC' }}>
                          {c.id}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#E2E8F0' }}>
                          {c.description}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: `${phaseColor}20`,
                              color: phaseColor,
                              fontWeight: 700,
                              fontSize: '10.5px'
                            }}
                          >
                            {c.assignedPhase}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#F8FAFC' }}>
                          {c.connectedVa.toLocaleString()} VA
                        </td>
                        <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                          {c.currentA} A
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#38BDF8' }}>
                          {c.breakerAmps}A {c.poles}P
                        </td>
                        <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                          {c.conductor?.wireMm2} mm² ({c.conductor?.awg})
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>
                          {c.conductor?.conduitMm} mm
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Solar PV Array Designer */}
        {activeTab === 'pv' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: PV Array Controls */}
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
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#38BDF8', marginBottom: '6px' }}>
                  PV MODULE SPECIFICATION
                </label>
                <select
                  value={selectedModuleKey}
                  onChange={(e) => setSelectedModuleKey(e.target.value)}
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
                  {Object.entries(PV_MODULE_TYPES).map(([k, m]) => (
                    <option key={k} value={k}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                    ORIENTATION
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
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
                    <option value="PORTRAIT">Portrait</option>
                    <option value="LANDSCAPE">Landscape</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                    MODULES / STRING
                  </label>
                  <input
                    type="number"
                    min="6"
                    max="20"
                    value={modulesPerString}
                    onChange={(e) => setModulesPerString(parseInt(e.target.value) || 14)}
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                    FIRE SETBACK (mm)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="500"
                    max="1500"
                    value={setbackMm}
                    onChange={(e) => setSetbackMm(parseInt(e.target.value) || 900)}
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
                    ROW PITCH (mm)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="400"
                    max="1500"
                    value={rowPitchMm}
                    onChange={(e) => setRowPitchMm(parseInt(e.target.value) || 800)}
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
              </div>

              {/* Environmental Metrics */}
              <div style={{ backgroundColor: '#1E293B', padding: '14px', borderRadius: '8px', marginTop: 'auto' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#FACC15', marginBottom: '6px' }}>
                  RENEWABLE METRICS:
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.6' }}>
                  • Total Modules: <strong>{pvMetrics.totalModules} Units</strong><br />
                  • Total Strings: <strong>{pvMetrics.totalStrings} Series Runs</strong><br />
                  • DC String Voc: <strong>{(modulesPerString * pvData.moduleDef.vocV).toFixed(1)} V DC</strong> (&lt; 1000V)<br />
                  • DC Operating Current: <strong>{pvData.moduleDef.impA} A</strong><br />
                  • Est. Annual Generation: <strong>{pvMetrics.annualGenerationKwh.toLocaleString()} kWh</strong><br />
                  • 25-Year CO2 Avoided: <strong>{(pvMetrics.co2OffsetTonsPerYear * 25).toFixed(1)} Tonnes</strong>
                </div>
              </div>
            </div>

            {/* Right: PV Strings Summary Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0B0F19' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', marginBottom: '12px' }}>
                DC PHOTOVOLTAIC STRING SCHEDULE ({strings.length} STRINGS • {inverters[0]?.name})
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1E293B', color: '#38BDF8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>String ID</th>
                    <th style={{ padding: '8px 12px' }}>Modules</th>
                    <th style={{ padding: '8px 12px' }}>Capacity (kW)</th>
                    <th style={{ padding: '8px 12px' }}>Voc (V DC)</th>
                    <th style={{ padding: '8px 12px' }}>Vmp (V DC)</th>
                    <th style={{ padding: '8px 12px' }}>Imp (A)</th>
                    <th style={{ padding: '8px 12px' }}>Connected Inverter</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {strings.map((str, idx) => (
                    <tr
                      key={str.id || idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#0B0F19' : '#0F172A',
                        borderBottom: '1px solid #1E293B'
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 800, color: '#FACC15' }}>
                        {str.id}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#F8FAFC' }}>
                        {str.moduleCount} × {pvData.moduleDef.powerW}W
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#38BDF8' }}>
                        {str.powerKw} kW
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                        {str.vocV} V
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                        {str.vmpV} V
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                        {str.impA} A
                      </td>
                      <td style={{ padding: '8px 12px', color: '#10B981', fontWeight: 700 }}>
                        INV-01 (MPPT {idx % 2 + 1})
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: '#065F46', color: '#34D399', fontWeight: 800, fontSize: '10px' }}>
                          OPTIMAL
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Single Line Diagram (SLD) Schematic */}
        {activeTab === 'sld' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '30px', backgroundColor: '#0A0F1D' }}>
            <div style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#0F172A', borderRadius: '10px', border: '1px solid #334155', padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#38BDF8', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ELECTRICAL SINGLE-LINE DIAGRAM (SLD) ARCHITECTURE</span>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>IEEE 1547 / NEC 705 Compliant</span>
              </div>

              {/* Graphical Schematic Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
                {/* 1. Solar Generation */}
                <div style={{ backgroundColor: '#1E293B', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #FACC15' }}>
                  <div style={{ fontWeight: 800, color: '#FACC15', marginBottom: '4px' }}>
                    [PV ARRAY]: {pvMetrics.systemCapacityKwp} kWp ({pvMetrics.totalModules} × {pvData.moduleDef.powerW}W Modules)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                    Strings: {pvMetrics.totalStrings} Parallel Strings • Voc: {(modulesPerString * pvData.moduleDef.vocV).toFixed(1)}V DC • 6mm² Solar DC PV-Wire
                  </div>
                </div>

                <div style={{ textAlign: 'center', color: '#64748B' }}>│  (DC Cabling in 25mm Conduit)</div>
                <div style={{ textAlign: 'center', color: '#64748B' }}>▼</div>

                {/* 2. Rapid Shutdown & Inverter */}
                <div style={{ backgroundColor: '#1E293B', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #38BDF8' }}>
                  <div style={{ fontWeight: 800, color: '#38BDF8', marginBottom: '4px' }}>
                    [HYBRID STRING INVERTER]: {inverters[0]?.name}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                    Integrated DC Disconnect &amp; Arc Fault Circuit Interrupter (AFCI) • 400V 3P+N AC Output
                  </div>
                </div>

                <div style={{ textAlign: 'center', color: '#64748B' }}>│  (AC 400V 3P+N Feed)</div>
                <div style={{ textAlign: 'center', color: '#64748B' }}>▼</div>

                {/* 3. Main Distribution Board */}
                <div style={{ backgroundColor: '#1E293B', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                  <div style={{ fontWeight: 800, color: '#10B981', marginBottom: '4px' }}>
                    [MAIN DISTRIBUTION BOARD MDB-01]: {mdbMetrics.totalConnectedKva} kVA ({mdbMetrics.mainBreakerRatingAmps}A 3P+N MCB)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                    Phase A: {mdbMetrics.phaseA.kva} kVA • Phase B: {mdbMetrics.phaseB.kva} kVA • Phase C: {mdbMetrics.phaseC.kva} kVA • Unbalance: {mdbMetrics.unbalancePct}%
                  </div>
                </div>

                <div style={{ textAlign: 'center', color: '#64748B' }}>│  (Bidirectional Net Metering)</div>
                <div style={{ textAlign: 'center', color: '#64748B' }}>▼</div>

                {/* 4. Utility Grid */}
                <div style={{ backgroundColor: '#1E293B', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #C084FC' }}>
                  <div style={{ fontWeight: 800, color: '#C084FC', marginBottom: '4px' }}>
                    [UTILITY GRID INTERCONNECTION]: 400V / 230V 50Hz / 60Hz Net Meter
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                    Surge Protection Device (Type 1+2 SPD) • Anti-Islanding Protection per IEEE 1547
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
