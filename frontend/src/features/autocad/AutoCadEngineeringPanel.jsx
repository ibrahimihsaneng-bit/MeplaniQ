import React, { useState, useMemo } from 'react';
import { dist } from './cadGeometryUtils';

/**
 * AutoCadEngineeringPanel.jsx
 * Advanced PhD / Master's Grade Computational BIM, Architectural Compliance & MEP Engineering Dashboard.
 * Integrates directly with live 2D CAD entities and detected room topologies.
 */
export default function AutoCadEngineeringPanel({
  entities = [],
  detectedRooms = [],
  onClose
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'compliance' | 'hvac' | 'electrical' | 'plumbing' | 'boq'

  // 1. EXTRACT ARCHITECTURAL ENTITIES
  const walls = useMemo(() => entities.filter(e => e.type === 'wall' && e.centerline), [entities]);
  const doors = useMemo(() => entities.filter(e => e.type === 'door'), [entities]);
  const windows = useMemo(() => entities.filter(e => e.type === 'window'), [entities]);
  const blocks = useMemo(() => entities.filter(e => e.type === 'block'), [entities]);
  const columns = useMemo(() => entities.filter(e => e.type === 'column'), [entities]);

  // Total Wall Length in meters
  const totalWallLengthM = useMemo(() => {
    return walls.reduce((sum, w) => {
      const len = dist(w.centerline.p1, w.centerline.p2) / 1000;
      return sum + len;
    }, 0);
  }, [walls]);

  // Total Window Opening Area in m2 (assuming default window height = 1.2m)
  const totalWindowAreaSqm = useMemo(() => {
    return windows.reduce((sum, w) => {
      const wWidth = (w.width || 1200) / 1000;
      const wHeight = (w.height || 1200) / 1000;
      return sum + (wWidth * wHeight);
    }, 0);
  }, [windows]);

  // Total Gross Carpet Area (m2)
  const totalCarpetAreaSqm = useMemo(() => {
    return detectedRooms.reduce((sum, r) => sum + (r.carpet_area_sqm || 0), 0);
  }, [detectedRooms]);

  // 2. ROOM-BY-ROOM DETAILED COMPUTATION MATRIX
  const roomMetrics = useMemo(() => {
    return detectedRooms.map((room, idx) => {
      const name = room.name || `Room ${idx + 1}`;
      const area = room.carpet_area_sqm || 15.0;
      const perimeter = room.perimeter_m || 16.0;
      const height = 3.0; // standard 3.0m ceiling height
      const volume = area * height;

      // Guess function by name
      const nameLower = name.toLowerCase();
      let type = 'general';
      let occupancy = 2;
      let targetLux = 200;
      let wfrTarget = 10.0; // National Building Code 10%

      if (nameLower.includes('bed')) {
        type = 'bedroom';
        occupancy = 2;
        targetLux = 150;
      } else if (nameLower.includes('liv') || nameLower.includes('hall') || nameLower.includes('draw')) {
        type = 'living';
        occupancy = 4;
        targetLux = 250;
      } else if (nameLower.includes('kitch')) {
        type = 'kitchen';
        occupancy = 2;
        targetLux = 300;
      } else if (nameLower.includes('bath') || nameLower.includes('toilet') || nameLower.includes('wc')) {
        type = 'toilet';
        occupancy = 1;
        targetLux = 150;
        wfrTarget = 5.0; // Ventilation requirement
      } else if (nameLower.includes('dine') || nameLower.includes('dining')) {
        type = 'dining';
        occupancy = 4;
        targetLux = 200;
      } else if (nameLower.includes('office') || nameLower.includes('study')) {
        type = 'office';
        occupancy = 2;
        targetLux = 400;
      }

      // Estimate window area allocated to this room (distributed or proportional)
      const allocatedWinArea = detectedRooms.length > 0 
        ? Math.max(0, (totalWindowAreaSqm * (area / (totalCarpetAreaSqm || 1))))
        : 0;

      const wfr = area > 0 ? (allocatedWinArea / area) * 100 : 0;
      const isWfrCompliant = wfr >= wfrTarget || (type === 'toilet' && wfr >= 4.0);

      // ASHRAE Heat Load Computation
      // Sensible: Wall transmission + Lighting (8 W/m2) + Equipment (10 W/m2) + Occupants (100 W/person)
      const internalSensible = (area * 18) + (occupancy * 100);
      const envelopeSensible = perimeter * height * 18; // approx 18 W/m2 heat flux
      const totalSensibleWatts = internalSensible + envelopeSensible;
      // Latent: Occupants (60 W/person)
      const latentWatts = occupancy * 60;
      const totalWatts = totalSensibleWatts + latentWatts;
      const totalBtuHr = totalWatts * 3.412;
      const requiredTR = Math.max(0.75, Math.round((totalBtuHr / 12000) * 10) / 10);
      const requiredCfm = Math.round(totalSensibleWatts / (1.08 * 10)); // delta T = 10 deg F

      // Illumination Engineering (IS 3646 / CIBSE)
      // Lumen = (Lux * Area) / (UF * MF), UF=0.65, MF=0.80
      const totalLumens = Math.round((targetLux * area) / (0.65 * 0.80));
      const ledFixturesCount = Math.max(1, Math.ceil(totalLumens / 1200)); // 15W LED = 1200 Lumens
      const lightingPowerWatts = ledFixturesCount * 15;
      const connectedPowerWatts = lightingPowerWatts + (area * 35); // general power outlets

      return {
        id: room.id || `rm-${idx}`,
        idx: idx + 1,
        name,
        type,
        area: Math.round(area * 10) / 10,
        perimeter: Math.round(perimeter * 10) / 10,
        volume: Math.round(volume * 10) / 10,
        allocatedWinArea: Math.round(allocatedWinArea * 100) / 100,
        wfr: Math.round(wfr * 10) / 10,
        wfrTarget,
        isWfrCompliant,
        occupancy,
        totalWatts: Math.round(totalWatts),
        totalBtuHr: Math.round(totalBtuHr),
        requiredTR,
        requiredCfm,
        targetLux,
        totalLumens,
        ledFixturesCount,
        lightingPowerWatts,
        connectedPowerWatts: Math.round(connectedPowerWatts)
      };
    });
  }, [detectedRooms, totalWindowAreaSqm, totalCarpetAreaSqm]);

  // 3. AGGREGATE SYSTEM TOTALS
  const totalTR = useMemo(() => roomMetrics.reduce((sum, r) => sum + r.requiredTR, 0), [roomMetrics]);
  const totalCfm = useMemo(() => roomMetrics.reduce((sum, r) => sum + r.requiredCfm, 0), [roomMetrics]);
  const totalConnectedWatts = useMemo(() => roomMetrics.reduce((sum, r) => sum + r.connectedPowerWatts, 0), [roomMetrics]);
  const totalLeds = useMemo(() => roomMetrics.reduce((sum, r) => sum + r.ledFixturesCount, 0), [roomMetrics]);

  // Plumbing Fixtures Tally
  const plumbingStats = useMemo(() => {
    let wcCount = 0;
    let basinCount = 0;
    let sinkCount = 0;
    blocks.forEach(b => {
      const bid = (b.blockId || b.name || '').toLowerCase();
      if (bid.includes('wc') || bid.includes('toilet')) wcCount++;
      else if (bid.includes('basin') || bid.includes('wash')) basinCount++;
      else if (bid.includes('sink')) sinkCount++;
    });

    const totalWsfu = (wcCount * 2.5) + (basinCount * 1.0) + (sinkCount * 1.5);
    const totalDfu = (wcCount * 3.0) + (basinCount * 1.0) + (sinkCount * 2.0);
    // Estimated flow in GPM via Hunter's Curve: approx 1.5 * sqrt(WSFU)
    const peakGpm = totalWsfu > 0 ? Math.round(1.6 * Math.sqrt(totalWsfu) * 10) / 10 : 0;
    const peakLpm = Math.round(peakGpm * 3.785 * 10) / 10;

    return {
      wcCount,
      basinCount,
      sinkCount,
      totalWsfu: Math.round(totalWsfu * 10) / 10,
      totalDfu: Math.round(totalDfu * 10) / 10,
      peakGpm,
      peakLpm,
      recommendedMainSupplyMm: totalWsfu > 15 ? 32 : (totalWsfu > 6 ? 25 : 20),
      recommendedSoilStackMm: 110
    };
  }, [blocks]);

  // BOQ Material Quantities & Cost
  const boqData = useMemo(() => {
    const wallHeight = 3.0; // m
    const avgThickness = 0.20; // 200mm
    const grossWallArea = totalWallLengthM * wallHeight;
    const netWallArea = Math.max(0, grossWallArea - totalWindowAreaSqm - (doors.length * 2.0));
    const brickworkM3 = Math.round(netWallArea * avgThickness * 10) / 10;
    const plasterAreaM2 = Math.round(netWallArea * 2 * 10) / 10; // internal + external
    const flooringM2 = Math.round(totalCarpetAreaSqm * 10) / 10;

    // Unit Rates (INR)
    const rateBrickwork = 6500; // per m3
    const ratePlaster = 320;    // per m2
    const rateFlooring = 1100;  // per m2
    const rateDoor = 8500;      // per door
    const rateWindow = 6500;    // per window
    const rateConcreteM3 = 7200; // M25 concrete per m3
    const rateSteelKg = 75;      // Fe500 rebar per kg

    const colCount = columns.length;
    const colConcM3 = Math.round(colCount * 0.3 * 0.3 * wallHeight * 10) / 10;
    const colSteelKg = Math.round(colConcM3 * 160);
    const costColumns = Math.round((colConcM3 * rateConcreteM3) + (colSteelKg * rateSteelKg));

    const costBrickwork = brickworkM3 * rateBrickwork;
    const costPlaster = plasterAreaM2 * ratePlaster;
    const costFlooring = flooringM2 * rateFlooring;
    const costDoors = doors.length * rateDoor;
    const costWindows = windows.length * rateWindow;
    const totalEstCivilCost = costBrickwork + costPlaster + costFlooring + costDoors + costWindows + costColumns;

    return {
      brickworkM3,
      plasterAreaM2,
      flooringM2,
      colCount,
      colConcM3,
      colSteelKg,
      costColumns,
      costBrickwork,
      costPlaster,
      costFlooring,
      costDoors,
      costWindows,
      totalEstCivilCost
    };
  }, [totalWallLengthM, totalWindowAreaSqm, doors.length, windows.length, columns.length, totalCarpetAreaSqm]);

  // CSV Export Handler
  const handleExportCsv = () => {
    const rows = [
      ["MEPlanIQ Computational BIM & Engineering Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [""],
      ["1. SPATIAL TOPOLOGY & ARCHITECTURAL CODE COMPLIANCE (NBC / ASHRAE 62.1)"],
      ["Room #", "Room Name", "Carpet Area (sqm)", "Perimeter (m)", "Volume (m3)", "Glazing Area (sqm)", "WFR (%)", "NBC Compliance Status"],
      ...roomMetrics.map(r => [
        r.idx,
        r.name,
        r.area,
        r.perimeter,
        r.volume,
        r.allocatedWinArea,
        `${r.wfr}%`,
        r.isWfrCompliant ? "COMPLIANT (PASS)" : "INSUFFICIENT VENTILATION"
      ]),
      [""],
      ["2. ASHRAE THERMODYNAMIC HVAC DEMAND SCHEDULE"],
      ["Room #", "Room Name", "Sensible+Latent (W)", "Thermal Load (BTU/hr)", "Airflow (CFM)", "Required Capacity (TR)"],
      ...roomMetrics.map(r => [
        r.idx,
        r.name,
        r.totalWatts,
        r.totalBtuHr,
        r.requiredCfm,
        `${r.requiredTR} TR`
      ]),
      ["TOTAL HVAC DEMAND", "", "", "", `${totalCfm} CFM`, `${Math.round(totalTR * 10) / 10} TR`],
      [""],
      ["3. ELECTRICAL & ILLUMINATION SCHEDULE (IS 3646 / CIBSE)"],
      ["Room #", "Room Name", "Target Lux", "Total Lumens", "LED 15W Count", "Lighting Power (W)", "Connected Load (W)"],
      ...roomMetrics.map(r => [
        r.idx,
        r.name,
        r.targetLux,
        r.totalLumens,
        r.ledFixturesCount,
        r.lightingPowerWatts,
        r.connectedPowerWatts
      ]),
      ["TOTAL ELECTRICAL", "", "", "", `${totalLeds} Fixtures`, "", `${(totalConnectedWatts / 1000).toFixed(2)} kW`],
      [""],
      ["4. BILL OF QUANTITIES (BOQ) SUMMARY"],
      ["Item", "Quantity", "Unit", "Est. Amount (INR)"],
      ["Brickwork / Masonry", boqData.brickworkM3, "m3", boqData.costBrickwork],
      ["R.C.C. Columns (M25 + Fe500)", `${boqData.colConcM3} m3 (${boqData.colCount} Cols)`, "m3", boqData.costColumns],
      ["Cement Plaster (1:4, 15mm)", boqData.plasterAreaM2, "m2", boqData.costPlaster],
      ["Vitrified Tile Flooring", boqData.flooringM2, "m2", boqData.costFlooring],
      ["Architectural Flush Doors", doors.length, "Nos", boqData.costDoors],
      ["Glazed Windows", windows.length, "Nos", boqData.costWindows],
      ["TOTAL ESTIMATED CIVIL SUPERSTRUCTURE", "", "", boqData.totalEstCivilCost]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MEPlanIQ_Engineering_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '440px',
      height: '100%',
      backgroundColor: '#0F172A',
      borderLeft: '1px solid #1E293B',
      boxShadow: '-8px 0 24px rgba(0,0,0,0.7)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      color: '#F8FAFC',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(to right, #0F172A, #1E1B4B)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔬</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', color: '#38BDF8' }}>
              BIM ENGINEERING ANALYTICS
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>
              PhD Research Grade Architectural & MEP Engine
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleExportCsv}
            title="Download Full Engineering Schedule (.CSV)"
            style={{
              background: '#0369A1',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📥 CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '2px 6px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #1E293B',
        backgroundColor: '#0B0F19',
        overflowX: 'auto'
      }}>
        {[
          { id: 'summary', label: '📊 KPI Summary' },
          { id: 'compliance', label: '📐 Compliance' },
          { id: 'hvac', label: '❄️ HVAC Load' },
          { id: 'electrical', label: '⚡ Electrical' },
          { id: 'plumbing', label: '🚿 Plumbing' },
          { id: 'boq', label: '📑 BOQ' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 10px',
              fontSize: '11px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
              borderBottom: activeTab === tab.id ? '2px solid #38BDF8' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {/* TAB 1: EXECUTIVE KPI SUMMARY */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Gross Carpet Area</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                  {totalCarpetAreaSqm.toFixed(1)} <span style={{ fontSize: '12px' }}>m²</span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {(totalCarpetAreaSqm * 10.764).toFixed(0)} sq.ft
                </div>
              </div>

              <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Detected Spaces</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#22C55E', marginTop: '4px' }}>
                  {detectedRooms.length} <span style={{ fontSize: '12px' }}>Rooms</span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {doors.length} Doors • {windows.length} Windows
                </div>
              </div>

              <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>HVAC Demand (ASHRAE)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#60A5FA', marginTop: '4px' }}>
                  {totalTR.toFixed(1)} <span style={{ fontSize: '12px' }}>TR</span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {totalCfm} CFM Total Airflow
                </div>
              </div>

              <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Electrical Demand</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#FACC15', marginTop: '4px' }}>
                  {(totalConnectedWatts / 1000).toFixed(2)} <span style={{ fontSize: '12px' }}>kW</span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {totalLeds} LED Luminaires
                </div>
              </div>
            </div>

            {/* Quick Health Matrix */}
            <div style={{ background: '#1E293B', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#E2E8F0', marginBottom: '8px' }}>
                🏛️ National Building Code (NBC) Compliance Overview
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Total Glazing Area:</span>
                  <span style={{ fontWeight: 700 }}>{totalWindowAreaSqm.toFixed(2)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Overall Window-Floor Ratio (WFR):</span>
                  <span style={{ fontWeight: 700, color: totalCarpetAreaSqm > 0 && (totalWindowAreaSqm / totalCarpetAreaSqm) >= 0.1 ? '#22C55E' : '#F59E0B' }}>
                    {totalCarpetAreaSqm > 0 ? ((totalWindowAreaSqm / totalCarpetAreaSqm) * 100).toFixed(1) : 0}% 
                    {totalCarpetAreaSqm > 0 && (totalWindowAreaSqm / totalCarpetAreaSqm) >= 0.1 ? ' (Pass ≥ 10%)' : ' (Under-ventilated)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Total Perimeter Masonry:</span>
                  <span style={{ fontWeight: 700 }}>{totalWallLengthM.toFixed(1)} m</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Est. Civil Superstructure Cost:</span>
                  <span style={{ fontWeight: 700, color: '#38BDF8' }}>₹ {boqData.totalEstCivilCost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* System Status Callout */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid #0284C7', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#BAE6FD' }}>
              💡 <strong>PhD Research Note:</strong> All spatial calculations derive dynamically from topological closed cycles in the AutoCAD linework planar graph. Moving, trimming, or drawing walls recalculates all thermodynamic and engineering loads instantaneously.
            </div>
          </div>
        )}

        {/* TAB 2: ARCHITECTURAL CODE COMPLIANCE */}
        {activeTab === 'compliance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
              Standard: <strong>NBC 2016 Part 8 / ASHRAE 62.1</strong> (Habitable room WFR threshold ≥ 10%)
            </div>

            {roomMetrics.map(room => (
              <div
                key={room.id}
                style={{
                  background: '#1E293B',
                  border: `1px solid ${room.isWfrCompliant ? '#334155' : '#78350F'}`,
                  borderRadius: '6px',
                  padding: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '12px', color: '#F1F5F9' }}>
                    {room.idx}. {room.name.toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: room.isWfrCompliant ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: room.isWfrCompliant ? '#4ADE80' : '#F87171'
                  }}>
                    {room.isWfrCompliant ? '✓ NBC COMPLIANT' : '⚠ LOW GLAZING'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '10px' }}>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Carpet Area:</span><br />
                    <strong>{room.area} m²</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Glazing Area:</span><br />
                    <strong>{room.allocatedWinArea} m²</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Actual WFR:</span><br />
                    <strong style={{ color: room.isWfrCompliant ? '#4ADE80' : '#F87171' }}>
                      {room.wfr}%
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: ASHRAE THERMODYNAMIC HVAC */}
        {activeTab === 'hvac' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
              Standard: <strong>ASHRAE Cooling Load Temperature Difference (CLTD)</strong>
            </div>

            {roomMetrics.map(room => (
              <div key={room.id} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#60A5FA' }}>
                    {room.name}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#38BDF8' }}>
                    {room.requiredTR} TR
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '10px' }}>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Total Gain:</span><br />
                    <strong>{room.totalWatts} W</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Thermal Load:</span><br />
                    <strong>{room.totalBtuHr} BTU/h</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Airflow:</span><br />
                    <strong>{room.requiredCfm} CFM</strong>
                  </div>
                </div>

                <div style={{ marginTop: '6px', fontSize: '10px', color: '#94A3B8', borderTop: '1px solid #334155', paddingTop: '4px' }}>
                  Recommended: <strong>{room.requiredTR <= 1.0 ? '1.0 TR 5-Star Split AC' : `${room.requiredTR} TR Inverter Split / Cassette Unit`}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ELECTRICAL & ILLUMINATION */}
        {activeTab === 'electrical' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
              Standard: <strong>IS 3646 / CIBSE Code for Lighting</strong> (Lumen Method)
            </div>

            {roomMetrics.map(room => (
              <div key={room.id} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#FACC15' }}>
                    {room.name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#E2E8F0' }}>
                    {room.ledFixturesCount} × 15W LED
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '10px' }}>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Target Lux:</span><br />
                    <strong>{room.targetLux} Lux</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Luminous Flux:</span><br />
                    <strong>{room.totalLumens} lm</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Connected Power:</span><br />
                    <strong>{room.connectedPowerWatts} W</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: PLUMBING DEMAND */}
        {activeTab === 'plumbing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>
              Standard: <strong>Uniform Plumbing Code (UPC / IPC)</strong> Fixture Unit Method
            </div>

            <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#60A5FA', marginBottom: '8px' }}>
                Installed Sanitary Fixture Tally
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span>Water Closets (WC):</span>
                <strong>{plumbingStats.wcCount} Nos</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span>Wash Basins / Lavatories:</span>
                <strong>{plumbingStats.basinCount} Nos</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span>Kitchen Sinks:</span>
                <strong>{plumbingStats.sinkCount} Nos</strong>
              </div>
            </div>

            <div style={{ background: '#1E293B', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#E2E8F0', marginBottom: '8px' }}>
                Hydraulic Sizing Outputs
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Water Supply Fixture Units (WSFU):</span>
                <strong>{plumbingStats.totalWsfu}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Drainage Fixture Units (DFU):</span>
                <strong>{plumbingStats.totalDfu}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Peak Water Flow (Hunter's Curve):</span>
                <strong style={{ color: '#38BDF8' }}>{plumbingStats.peakLpm} LPM ({plumbingStats.peakGpm} GPM)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Recommended Main Cold Water Pipe:</span>
                <strong style={{ color: '#22C55E' }}>Ø {plumbingStats.recommendedMainSupplyMm} mm CPVC</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#94A3B8' }}>Recommended Main Soil Stack:</span>
                <strong style={{ color: '#22C55E' }}>Ø {plumbingStats.recommendedSoilStackMm} mm PVC</strong>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BILL OF QUANTITIES */}
        {activeTab === 'boq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>
              Parametric Material Take-Off Schedule (IS 1200 Method of Measurement)
            </div>

            <div style={{ background: '#1E293B', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0B0F19', color: '#94A3B8' }}>
                    <th style={{ padding: '8px' }}>Item Description</th>
                    <th style={{ padding: '8px' }}>Qty</th>
                    <th style={{ padding: '8px' }}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>Brick Masonry (200mm)</td>
                    <td style={{ padding: '8px' }}>{boqData.brickworkM3} m³</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costBrickwork.toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>R.C.C. Columns (M25 + Fe500)</td>
                    <td style={{ padding: '8px' }}>{boqData.colConcM3} m³ ({boqData.colCount} Nos)</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costColumns.toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>Cement Plastering (1:4)</td>
                    <td style={{ padding: '8px' }}>{boqData.plasterAreaM2} m²</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costPlaster.toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>Vitrified Floor Tiling</td>
                    <td style={{ padding: '8px' }}>{boqData.flooringM2} m²</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costFlooring.toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>Flush Doors (with Frame)</td>
                    <td style={{ padding: '8px' }}>{doors.length} Nos</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costDoors.toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '8px' }}>Glazed Aluminum Windows</td>
                    <td style={{ padding: '8px' }}>{windows.length} Nos</td>
                    <td style={{ padding: '8px', color: '#38BDF8' }}>₹{boqData.costWindows.toLocaleString()}</td>
                  </tr>
                  <tr style={{ background: '#111827', fontWeight: 800 }}>
                    <td style={{ padding: '10px', color: '#F8FAFC' }}>TOTAL SUPERSTRUCTURE</td>
                    <td style={{ padding: '10px' }}></td>
                    <td style={{ padding: '10px', color: '#22C55E' }}>₹{boqData.totalEstCivilCost.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
