import React, { useState, useMemo } from 'react';
import {
  calculateDuctAerodynamics,
  calculate3PhaseLoadBalance,
  calculatePlumbingHydraulics,
  calculateBillOfQuantities,
  getRoomGeometry,
  classifyRoomType,
  calculateRoomCoolingAndCfm
} from './projectMepEngine';

export default function MepCalculationModal({ isOpen, onClose, solveData, projectName = 'MEP Project' }) {
  const [activeTab, setActiveTab] = useState('hvac'); // 'hvac' | 'electrical' | 'plumbing' | 'boq'
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Compute HVAC Duct Aerodynamics per room
  const hvacData = useMemo(() => {
    if (!solveData || !solveData.rooms) return { rooms: [], totals: {} };

    const roomsList = [];
    let totalCfm = 0;
    let totalSensibleW = 0;
    let maxVelocity = 0;

    solveData.rooms.forEach((rm, idx) => {
      const geom = getRoomGeometry(rm);
      const rType = classifyRoomType(rm.name || `Room ${idx + 1}`);
      const cooling = calculateRoomCoolingAndCfm(rType, geom.areaSqm);
      
      // Match with duct if present
      const matchedDuct = (solveData.hvac_ducts || []).find(d => d.room_id === rm.name || d.room_id === rm.id);
      const widthMm = matchedDuct ? matchedDuct.width_mm : (cooling.cfm > 300 ? 400 : (cooling.cfm > 180 ? 300 : 250));
      const heightMm = matchedDuct ? matchedDuct.height_mm : (cooling.cfm > 300 ? 250 : 200);

      const aero = calculateDuctAerodynamics(widthMm, heightMm, cooling.cfm);
      if (aero.velocityMs > maxVelocity) maxVelocity = aero.velocityMs;

      totalCfm += cooling.cfm;
      totalSensibleW += cooling.sensibleW;

      roomsList.push({
        id: rm.id || `RM-${idx + 1}`,
        name: rm.name || `Room ${idx + 1}`,
        type: rType,
        areaSqm: parseFloat(geom.areaSqm.toFixed(1)),
        sensibleW: cooling.sensibleW,
        cfm: cooling.cfm,
        ductSize: `${widthMm} × ${heightMm}`,
        dhMm: aero.dhMm,
        velocityMs: aero.velocityMs,
        frictionLossPaM: aero.frictionLossPaM,
        velocityPressurePa: aero.velocityPressurePa,
        status: aero.velocityMs <= 4.5 ? 'Whisper Quiet' : (aero.velocityMs <= 6.0 ? 'Optimal' : 'High Friction')
      });
    });

    const totalSensibleKw = parseFloat((totalSensibleW / 1000.0).toFixed(2));
    const totalTonsOfRefrigeration = parseFloat(((totalSensibleW / 3516.85) * 1.25).toFixed(2)); // Sensible + Latent TR
    const freshAirCfm = Math.round(totalCfm * 0.15); // ASHRAE 62.1 15% fresh air intake

    return {
      rooms: roomsList,
      totals: {
        totalCfm,
        totalSensibleKw,
        totalTonsOfRefrigeration,
        freshAirCfm,
        maxVelocity,
        supplyFanStaticPressurePa: 220
      }
    };
  }, [solveData]);

  // Compute 3-Phase Electrical Load Balance
  const electricalData = useMemo(() => {
    if (!solveData) return null;
    return calculate3PhaseLoadBalance(solveData.circuits || [], solveData.placed_components || []);
  }, [solveData]);

  // Compute Plumbing Hydraulics
  const plumbingData = useMemo(() => {
    if (!solveData) return null;
    return calculatePlumbingHydraulics(solveData.plumbing_fixtures || [], solveData.plumbing_pipes || []);
  }, [solveData]);

  // Compute BOQ and Embodied Carbon
  const boqData = useMemo(() => {
    if (!solveData) return null;
    return calculateBillOfQuantities(solveData);
  }, [solveData]);

  if (!isOpen) return null;

  // Export CSV Handler
  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const ts = new Date().toISOString().slice(0, 10);

    if (activeTab === 'hvac') {
      csvContent += `MEPLANIQ HVAC DUCT SIZING & AERODYNAMICS CALCULATION SHEET - ${projectName} (${ts})\n`;
      csvContent += "Room Name,Area (sqm),Sensible Load (W),Airflow (CFM),Duct Size (W x H mm),Hydraulic Dia (mm),Air Velocity (m/s),Friction Loss (Pa/m),Velocity Pressure (Pa),Status\n";
      hvacData.rooms.forEach(r => {
        csvContent += `"${r.name}",${r.areaSqm},${r.sensibleW},${r.cfm},"${r.ductSize}",${r.dhMm},${r.velocityMs},${r.frictionLossPaM},${r.velocityPressurePa},"${r.status}"\n`;
      });
      csvContent += `TOTALS,,${hvacData.totals.totalSensibleKw} kW,${hvacData.totals.totalCfm} CFM,,,,,,${hvacData.totals.totalTonsOfRefrigeration} TR\n`;
    } else if (activeTab === 'electrical') {
      csvContent += `MEPLANIQ ELECTRICAL 3-PHASE DB-01 LOAD BALANCING SCHEDULE - ${projectName} (${ts})\n`;
      csvContent += "Phase,Circuit ID,Circuit Name,Category,Connected Load (W),Current (A),Breaker MCB (A),Wire Gauge (sqmm)\n";
      ['R', 'Y', 'B'].forEach(pKey => {
        const pObj = electricalData?.phases[pKey];
        (pObj?.circuits || []).forEach(c => {
          csvContent += `"${pObj.name}","${c.id}","${c.name}","${c.category}",${c.loadW},${c.currentA},${c.breakerA},${c.wireGauge}\n`;
        });
      });
      csvContent += `TOTAL CONNECTED LOAD,,${electricalData?.totalConnectedKw} kW,,MAX DEMAND,,${electricalData?.maxDemandKva} kVA,UNBALANCE: ${electricalData?.unbalancePercent}%\n`;
    } else if (activeTab === 'plumbing') {
      csvContent += `MEPLANIQ PLUMBING & DRAINAGE HYDRAULIC SIZING SHEET - ${projectName} (${ts})\n`;
      csvContent += `Total Water Supply Fixture Units (WSFU),${plumbingData?.totalWsfu}\n`;
      csvContent += `Total Drainage Fixture Units (DFU),${plumbingData?.totalDfu}\n`;
      csvContent += `Peak Water Flow Demand,${plumbingData?.peakFlowLpm} LPM (${plumbingData?.peakFlowGpm} GPM)\n`;
      csvContent += `Main DCW Pipe Diameter,${plumbingData?.dcwDiameterMm} mm CPVC\n`;
      csvContent += `Water Velocity,${plumbingData?.velocityMs} m/s (${plumbingData?.velocityStatus})\n`;
      csvContent += `Head Loss Gradient,${plumbingData?.headLossKpaM} kPa/m\n`;
      csvContent += `Total DCW Pipe Length,${plumbingData?.totalDcwLengthM} m\n`;
      csvContent += `Total Soil Pipe Length,${plumbingData?.totalSoilLengthM} m\n`;
      csvContent += `Gravity Soil Stack,${plumbingData?.soilStackRecommendation}\n`;
    } else if (activeTab === 'boq') {
      csvContent += `MEPLANIQ BILL OF QUANTITIES (BOQ) & EMBODIED CARBON DOSSIER - ${projectName} (${ts})\n`;
      csvContent += "Discipline,Item Description,Quantity,Unit\n";
      csvContent += `HVAC,Galvanized GI Sheet Ductwork,${boqData?.hvac.ductAreaM2},m2 (${boqData?.hvac.ductWeightKg} kg)\n`;
      csvContent += `HVAC,4-Way Ceiling Diffusers,${boqData?.hvac.diffusersCount},units\n`;
      csvContent += `HVAC,Return Air Grilles,${boqData?.hvac.grillesCount},units\n`;
      csvContent += `Electrical,FRLS Copper Building Wires,${boqData?.electrical.wireLengthM},meters\n`;
      csvContent += `Electrical,Heavy-Duty Rigid PVC Conduits,${boqData?.electrical.conduitLengthM},meters\n`;
      csvContent += `Plumbing,CPVC Water Supply Piping,${boqData?.plumbing.waterPipeLengthM},meters\n`;
      csvContent += `Plumbing,uPVC Gravity Soil Drainage Piping,${boqData?.plumbing.drainPipeLengthM},meters\n`;
      csvContent += `Structural,M25 Concrete Columns Volume,${boqData?.structural.concreteVolumeM3},m3\n`;
      csvContent += `Structural,TMT 500D Reinforcement Rebar,${boqData?.structural.rebarWeightKg},kg\n`;
      csvContent += `Sustainability,Total Embodied Carbon Footprint,${boqData?.sustainability.totalEmbodiedCarbonKg},kg CO2e (${boqData?.sustainability.rating})\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MeplanIQ_${activeTab.toUpperCase()}_Calculation_${ts}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Summary Handler
  const handleCopySummary = () => {
    let summary = `MEPLANIQ COMPUTATIONAL MEP ENGINEERING DOSSIER\nProject: ${projectName}\nStandard: ASHRAE 90.1 • IEC 60364 • UPC\n----------------------------------------\n`;
    summary += `1. HVAC AIR DISTRIBUTION:\n`;
    summary += `   • Total Airflow: ${hvacData.totals.totalCfm} CFM (${Math.round(hvacData.totals.totalCfm * 1.699)} m3/h)\n`;
    summary += `   • Total Cooling Capacity: ${hvacData.totals.totalTonsOfRefrigeration} TR (${hvacData.totals.totalSensibleKw} kW Sensible)\n`;
    summary += `   • Fresh Air Ventilation: ${hvacData.totals.freshAirCfm} CFM (ASHRAE 62.1)\n`;
    summary += `   • Max Duct Velocity: ${hvacData.totals.maxVelocity} m/s\n\n`;

    summary += `2. ELECTRICAL 3-PHASE DB-01:\n`;
    summary += `   • Connected Load: ${electricalData?.totalConnectedKw} kW\n`;
    summary += `   • Max Demand: ${electricalData?.maxDemandKva} kVA (Diversity 0.75, PF 0.85)\n`;
    summary += `   • Phase Balance: ${electricalData?.unbalancePercent}% (${electricalData?.status})\n`;
    summary += `   • Incomer Breaker: 63A 4-Pole MCCB + 300mA ELCB\n\n`;

    summary += `3. PLUMBING HYDRAULICS:\n`;
    summary += `   • Peak Demand: ${plumbingData?.peakFlowLpm} LPM (${plumbingData?.peakFlowGpm} GPM) from ${plumbingData?.totalWsfu} WSFU\n`;
    summary += `   • Main Pipe: Ø${plumbingData?.dcwDiameterMm} CPVC @ ${plumbingData?.velocityMs} m/s\n`;
    summary += `   • Soil Drainage: ${plumbingData?.totalDfu} DFU on Ø110 uPVC (1:40 Fall)\n\n`;

    summary += `4. SUSTAINABILITY & CARBON:\n`;
    summary += `   • Embodied Carbon: ${boqData?.sustainability.totalEmbodiedCarbonKg} kg CO2e (${boqData?.sustainability.rating})\n`;

    navigator.clipboard.writeText(summary);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '12px',
        width: '1050px',
        maxWidth: '96vw',
        height: '85vh',
        maxHeight: '900px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>📐</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                  MEP Engineering Calculation & Sizing Sheet
                </h3>
                <span style={{
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase'
                }}>
                  Autodesk Revit / SMACNA Standard
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>
                Project: <strong style={{ color: '#E2E8F0' }}>{projectName}</strong> • ASHRAE 90.1 Aerodynamics • IEC 60364 DB Sizing • UPC Hydraulics
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopySummary}
              style={{
                backgroundColor: copiedNotification ? '#059669' : '#1E293B',
                border: '1px solid #334155',
                color: '#E2E8F0',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              title="Copy formatted engineering summary to clipboard"
            >
              <span>{copiedNotification ? '✓ Copied' : '📋 Copy Summary'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              style={{
                backgroundColor: '#0284C7',
                border: '1px solid #38BDF8',
                color: '#FFFFFF',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Export active calculation sheet to CSV"
            >
              <span>⬇️ Export CSV</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1E293B',
          backgroundColor: '#0A0F1D',
          padding: '0 24px',
          gap: '8px',
          flexShrink: 0
        }}>
          {[
            { id: 'hvac', label: '❄️ HVAC Aerodynamics & Duct Sizing', count: hvacData.rooms.length },
            { id: 'electrical', label: '⚡ 3-Phase DB-01 Balancing Schedule', count: electricalData?.phases ? (electricalData.phases.R.circuits.length + electricalData.phases.Y.circuits.length + electricalData.phases.B.circuits.length) : 0 },
            { id: 'plumbing', label: '🚰 Plumbing & Drainage Hydraulics', count: (solveData?.plumbing_fixtures || []).length },
            { id: 'boq', label: '📦 Bill of Quantities & Embodied Carbon', count: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #38BDF8' : '3px solid transparent',
                color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span style={{
                  backgroundColor: activeTab === tab.id ? 'rgba(56, 189, 248, 0.2)' : '#1E293B',
                  color: activeTab === tab.id ? '#38BDF8' : '#64748B',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Modal Body / Tab Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#090D16'
        }}>
          {/* TAB 1: HVAC DUCT AERODYNAMICS */}
          {activeTab === 'hvac' && (
            <div>
              {/* Summary KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Total Airflow</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {hvacData.totals.totalCfm} <span style={{ fontSize: '11px', color: '#64748B' }}>CFM</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    ≈ {Math.round(hvacData.totals.totalCfm * 1.699)} m³/h
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Cooling Capacity</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    {hvacData.totals.totalTonsOfRefrigeration} <span style={{ fontSize: '11px', color: '#64748B' }}>TR</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {hvacData.totals.totalSensibleKw} kW Sensible Load
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Fresh Air (ASHRAE 62.1)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#A78BFA', marginTop: '4px' }}>
                    {hvacData.totals.freshAirCfm} <span style={{ fontSize: '11px', color: '#64748B' }}>CFM</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>15% Positive Pressurization</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Max Air Velocity</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: hvacData.totals.maxVelocity <= 5.5 ? '#38BDF8' : '#F59E0B', marginTop: '4px' }}>
                    {hvacData.totals.maxVelocity} <span style={{ fontSize: '11px', color: '#64748B' }}>m/s</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Threshold ≤ 6.0 m/s</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>AHU Static Pressure</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#F8FAFC', marginTop: '4px' }}>
                    {hvacData.totals.supplyFanStaticPressurePa} <span style={{ fontSize: '11px', color: '#64748B' }}>Pa</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Equal Friction Sizing</div>
                </div>
              </div>

              {/* Table */}
              <div style={{ border: '1px solid #1E293B', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: '10px 14px' }}>Room / Zone</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Area (m²)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Cooling (W)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Airflow (CFM)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Duct Size (W×H mm)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Dh (mm)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Velocity (m/s)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>ΔP Friction (Pa/m)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Pv (Pa)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acoustic Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hvacData.rooms.map((rm, idx) => (
                      <tr
                        key={rm.id || idx}
                        style={{
                          borderBottom: '1px solid #1E293B',
                          backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#F1F5F9' }}>
                          {rm.name}
                          <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '6px', textTransform: 'capitalize' }}>
                            ({rm.type})
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#CBD5E1' }}>{rm.areaSqm}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{rm.sensibleW} W</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#38BDF8', fontWeight: 700 }}>{rm.cfm} CFM</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', color: '#FCD34D' }}>
                          {rm.ductSize}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94A3B8' }}>{rm.dhMm}</td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: rm.velocityMs <= 4.5 ? '#10B981' : (rm.velocityMs <= 6.0 ? '#38BDF8' : '#F59E0B')
                        }}>
                          {rm.velocityMs} m/s
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#CBD5E1' }}>{rm.frictionLossPaM}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94A3B8' }}>{rm.velocityPressurePa}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: rm.velocityMs <= 4.5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: rm.velocityMs <= 4.5 ? '#34D399' : '#38BDF8',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600
                          }}>
                            {rm.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ELECTRICAL 3-PHASE DB-01 BALANCING */}
          {activeTab === 'electrical' && electricalData && (
            <div>
              {/* Summary KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Total Connected Load</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                    {electricalData.totalConnectedKw} <span style={{ fontSize: '11px', color: '#64748B' }}>kW</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>415V 3-Phase, 50Hz</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Maximum Demand</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {electricalData.maxDemandKva} <span style={{ fontSize: '11px', color: '#64748B' }}>kVA</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>0.75 Diversity • 0.85 PF</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Phase Unbalance</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: electricalData.unbalancePercent <= 15 ? '#10B981' : '#F59E0B', marginTop: '4px' }}>
                    {electricalData.unbalancePercent}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Status: {electricalData.status}</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Main Incomer DB-01</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#A78BFA', marginTop: '4px' }}>
                    63A 4P MCCB
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>300mA ELCB / RCD Protection</div>
                </div>
              </div>

              {/* 3-Phase Tables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {['R', 'Y', 'B'].map(phaseKey => {
                  const pObj = electricalData.phases[phaseKey];
                  const phaseColors = {
                    R: { border: '#EF4444', text: '#F87171', bg: 'rgba(239, 68, 68, 0.08)' },
                    Y: { border: '#EAB308', text: '#FDE047', bg: 'rgba(234, 179, 8, 0.08)' },
                    B: { border: '#3B82F6', text: '#60A5FA', bg: 'rgba(59, 130, 246, 0.08)' }
                  }[phaseKey];

                  return (
                    <div key={phaseKey} style={{
                      backgroundColor: '#0F172A',
                      border: `1px solid ${phaseColors.border}`,
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: phaseColors.bg,
                        borderBottom: `1px solid ${phaseColors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <strong style={{ color: phaseColors.text, fontSize: '13px' }}>
                          {pObj.name}
                        </strong>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#F8FAFC' }}>
                          {(pObj.loadW / 1000.0).toFixed(2)} kW
                        </span>
                      </div>

                      <div style={{ padding: '8px' }}>
                        {pObj.circuits.length === 0 ? (
                          <div style={{ color: '#64748B', fontSize: '11px', textAlign: 'center', padding: '16px' }}>
                            Spare Way
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {pObj.circuits.map(c => (
                              <div key={c.id} style={{
                                backgroundColor: '#1E293B',
                                borderRadius: '6px',
                                padding: '8px 10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{c.name}</div>
                                  <div style={{ fontSize: '9px', color: '#94A3B8' }}>
                                    {c.category} • {c.wireGauge} mm² Cu
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ color: '#FCD34D', fontWeight: 700 }}>{c.loadW} W ({c.currentA}A)</div>
                                  <div style={{ fontSize: '9px', color: '#38BDF8', fontWeight: 600 }}>
                                    MCB: {c.breakerA}A
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: PLUMBING & DRAINAGE HYDRAULICS */}
          {activeTab === 'plumbing' && plumbingData && (
            <div>
              {/* Summary KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Water Demand (WSFU)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {plumbingData.totalWsfu} <span style={{ fontSize: '11px', color: '#64748B' }}>WSFU</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Hunter's Curve: {plumbingData.peakFlowLpm} LPM ({plumbingData.peakFlowGpm} GPM)
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Main DCW Supply Pipe</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    Ø{plumbingData.dcwDiameterMm} <span style={{ fontSize: '11px', color: '#64748B' }}>mm CPVC</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Velocity: {plumbingData.velocityMs} m/s ({plumbingData.velocityStatus})
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Friction Loss Gradient</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#A78BFA', marginTop: '4px' }}>
                    {plumbingData.headLossKpaM} <span style={{ fontSize: '11px', color: '#64748B' }}>kPa/m</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Total Loss: {plumbingData.totalPressureLossKpa} kPa
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Drainage Load (DFU)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                    {plumbingData.totalDfu} <span style={{ fontSize: '11px', color: '#64748B' }}>DFU</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Stack: Ø110 uPVC (1:40 Fall)
                  </div>
                </div>
              </div>

              {/* Fixture Schedule */}
              <div style={{ border: '1px solid #1E293B', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '12px 16px', backgroundColor: '#0F172A', borderBottom: '1px solid #1E293B', fontWeight: 700, fontSize: '13px' }}>
                  Sanitary Fixture & Unit Schedule (UPC Table 610.3 / 702.1)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #1E293B', textAlign: 'left' }}>
                      <th style={{ padding: '8px 14px' }}>Fixture Type</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center' }}>Count</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right' }}>WSFU / Fixture</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right' }}>Total WSFU</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right' }}>DFU / Fixture</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right' }}>Total DFU</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center' }}>Branch Conn</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>Water Closet (Flush Tank)</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: '#38BDF8' }}>{plumbingData.fixtureCounts.wc}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>2.5</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{(plumbingData.fixtureCounts.wc * 2.5).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>3.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#FCD34D', fontWeight: 600 }}>{(plumbingData.fixtureCounts.wc * 3.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace' }}>Ø15 DCW / Ø110 Soil</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>Lavatory Wash Basin</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: '#38BDF8' }}>{plumbingData.fixtureCounts.basin}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>1.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{(plumbingData.fixtureCounts.basin * 1.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>1.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#FCD34D', fontWeight: 600 }}>{(plumbingData.fixtureCounts.basin * 1.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace' }}>Ø15 DCW / Ø40 Waste</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>Shower Enclosure</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: '#38BDF8' }}>{plumbingData.fixtureCounts.shower}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>2.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{(plumbingData.fixtureCounts.shower * 2.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>2.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#FCD34D', fontWeight: 600 }}>{(plumbingData.fixtureCounts.shower * 2.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace' }}>Ø15 DCW / Ø50 Waste</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>Kitchen Sink</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: '#38BDF8' }}>{plumbingData.fixtureCounts.sink}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>1.5</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{(plumbingData.fixtureCounts.sink * 1.5).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>2.0</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#FCD34D', fontWeight: 600 }}>{(plumbingData.fixtureCounts.sink * 2.0).toFixed(1)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace' }}>Ø20 DCW / Ø50 Waste</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BILL OF QUANTITIES & EMBODIED CARBON */}
          {activeTab === 'boq' && boqData && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>EMBODIED CARBON FOOTPRINT</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    {boqData.sustainability.totalEmbodiedCarbonKg} <span style={{ fontSize: '12px', color: '#64748B' }}>kg CO₂e</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#34D399', marginTop: '2px', fontWeight: 600 }}>
                    {boqData.sustainability.rating}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>TOTAL SHEET DUCTWORK</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {boqData.hvac.ductWeightKg} <span style={{ fontSize: '12px', color: '#64748B' }}>kg GI Sheet</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Surface Area: {boqData.hvac.ductAreaM2} m² (22-Gauge)
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>STRUCTURAL CONCRETE & REBAR</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                    {boqData.structural.concreteVolumeM3} <span style={{ fontSize: '12px', color: '#64748B' }}>m³ M25</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Rebar: {boqData.structural.rebarWeightKg} kg Fe500D Steel
                  </div>
                </div>
              </div>

              {/* BOQ Breakdown Table */}
              <div style={{ border: '1px solid #1E293B', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: '10px 14px' }}>Discipline</th>
                      <th style={{ padding: '10px 14px' }}>Item Specification</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Calculated Quantity</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Unit</th>
                      <th style={{ padding: '10px 14px' }}>Engineering Standard</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#38BDF8', fontWeight: 700 }}>HVAC</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Galvanized Steel Rectangular Ductwork (Class B)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.hvac.ductAreaM2}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>m²</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>SMACNA HVAC Duct Construction</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#38BDF8', fontWeight: 700 }}>HVAC</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>4-Way Ceiling Diffusers (300×300 / 450×450)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.hvac.diffusersCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>Nos</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>ASHRAE 70 / ADC 1062</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#FCD34D', fontWeight: 700 }}>Electrical</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>FRLS Copper Single Core Building Wires (1.5 / 2.5 / 4.0 mm²)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.electrical.wireLengthM}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>Mtrs</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>IS 694 / IEC 60227</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#FCD34D', fontWeight: 700 }}>Electrical</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Medium Duty Rigid PVC Electrical Conduits (Ø20 / Ø25 mm)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.electrical.conduitLengthM}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>Mtrs</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>IS 9537 / IEC 61386</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 700 }}>Plumbing</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>CPVC SDR-11 Cold Water Supply Pipe (Ø20 - Ø32 mm)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.plumbing.waterPipeLengthM}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>Mtrs</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>ASTM D2846 / IS 15778</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 700 }}>Plumbing</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>uPVC Soil & Waste Drainage Pipe (Ø110 mm)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.plumbing.drainPipeLengthM}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>Mtrs</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>IS 13592 / BS EN 1329</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 14px', color: '#EC4899', fontWeight: 700 }}>Structural</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Reinforced Concrete Columns M25 Grade (300×300 mm)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{boqData.structural.concreteVolumeM3}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>m³</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>IS 456:2000 Code of Practice</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #1E293B',
          backgroundColor: '#0A0F1D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#64748B',
          flexShrink: 0
        }}>
          <div>
            Computational Sizing Engine • Compliant with ASHRAE Fundamentals & IEC 60364
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              color: '#F8FAFC',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
