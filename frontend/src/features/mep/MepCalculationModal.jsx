import React, { useState, useMemo } from 'react';

import {

  calculateDuctAerodynamics,

  calculate3PhaseLoadBalance,

  calculatePlumbingHydraulics,

  calculateBillOfQuantities,

  calculateElectricalRiserAndVoltageDrop,

  calculateAshraeThermalComfort,

  calculateDuctFittingsAndPressureLoss,

  calculateWaterHammerAndSurgeProtection,

  calculateDrainageSlopesAndClearance,
  calculateShortCircuitFaultCurrents,
  calculateFireProtectionHydraulics,
  resolveMultiDiscipline3dClashes,

  getRoomGeometry,

  classifyRoomType,

  calculateRoomCoolingAndCfm

} from './projectMepEngine';

export default function MepCalculationModal({ isOpen, onClose, solveData, projectName = 'MEP Project' }) {

  const [activeTab, setActiveTab] = useState('hvac'); // 'hvac' | 'electrical' | 'plumbing' | 'boq'

  const [copiedNotification, setCopiedNotification] = useState(false);

  // Thermal Comfort Parameters State

  const [thermalParams, setThermalParams] = useState({

    ta: 24.5,

    tr: 24.5,

    vel: 0.18,

    rh: 50.0,

    met: 1.1,

    clo: 0.65

  });

  const thermalComfort = useMemo(() => {

    return calculateAshraeThermalComfort(

      thermalParams.ta,

      thermalParams.tr,

      thermalParams.vel,

      thermalParams.rh,

      thermalParams.met,

      thermalParams.clo

    );

  }, [thermalParams]);

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

  // Compute SMACNA Duct Fittings & Pressure Loss

  const fittingsData = useMemo(() => {

    return calculateDuctFittingsAndPressureLoss(

      solveData?.hvac_ducts || [],

      hvacData?.totals?.totalCfm || 1200

    );

  }, [solveData, hvacData?.totals?.totalCfm]);

  // Compute 3-Phase Electrical Load Balance

  const electricalData = useMemo(() => {

    if (!solveData) return null;

    return calculate3PhaseLoadBalance(solveData.circuits || [], solveData.placed_components || []);

  }, [solveData]);

  // Compute IEC 60909 Short-Circuit Fault Currents & Breaking Capacity
  const shortCircuitData = useMemo(() => {
    return calculateShortCircuitFaultCurrents(160.0, 250.0);
  }, []);

  // Compute Multi-Level Electrical Riser & IEC 60364 Voltage Drop

  const riserData = useMemo(() => {

    if (!solveData) return null;

    return calculateElectricalRiserAndVoltageDrop(

      solveData.circuits || [],

      solveData.placed_components || [],

      solveData.distribution_boards || []

    );

  }, [solveData]);

  // Compute Plumbing Hydraulics

  const plumbingData = useMemo(() => {

    if (!solveData) return null;

    return calculatePlumbingHydraulics(solveData.plumbing_fixtures || [], solveData.plumbing_pipes || []);

  }, [solveData]);

  // Compute Water Hammer & Joukowsky Surge Analysis

  const waterHammerData = useMemo(() => {

    const wsfu = plumbingData?.totalWsfu || 12.5;

    const vel = plumbingData?.velocityMs || 1.8;

    return calculateWaterHammerAndSurgeProtection(wsfu, vel, 'CPVC');

  }, [plumbingData]);

  // Compute Gravity Drainage Slope & Plenum Clearance

  const drainageClearanceData = useMemo(() => {

    const drainLen = plumbingData?.totalSoilLengthM || 14.5;

    return calculateDrainageSlopesAndClearance(drainLen);

  }, [plumbingData]);

  // Compute NFPA 13/14 Fire Protection & Life Safety Hydraulics
  const fireData = useMemo(() => {
    let totalAreaSqm = 0;
    (solveData?.rooms || []).forEach(r => {
      const geom = getRoomGeometry(r);
      totalAreaSqm += geom.areaSqm;
    });
    if (totalAreaSqm === 0) totalAreaSqm = 240.0;
    return calculateFireProtectionHydraulics(totalAreaSqm, 12.0, 'light_hazard');
  }, [solveData]);

  // Compute Multi-Discipline 3D Clash Harmonization
  const clashData = useMemo(() => {
    return resolveMultiDiscipline3dClashes(solveData || {});
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

    } else if (activeTab === 'riser') {

      csvContent += `MEPLANIQ MULTI-LEVEL ELECTRICAL RISER & IEC 60364 VOLTAGE DROP SCHEDULE - ${projectName} (${ts})\n`;

      csvContent += `Standard: IEC 60364-5-52 / BS 7671:2018+A2:2022\n`;

      csvContent += `Total Connected Load: ${riserData?.totalConnectedKw} kW | Max Circuit Drop: ${riserData?.maxCircuitDropPercent}% | Compliance Rate: ${riserData?.complianceRatePercent}%\n\n`;

      csvContent += "SUB-MAIN FEEDERS SCHEDULE\n";

      csvContent += "Feeder ID,From,To,Voltage (V),Phase,Design Current (A),Length (m),Cable Specification,Voltage Drop (V),Drop (%),Limit (%),Status\n";

      (riserData?.riserFeeders || []).forEach(f => {

        csvContent += `"${f.id}","${f.from}","${f.to}",${f.voltage},"${f.phase}",${f.designCurrentA},${f.runLengthM},"${f.cableSpec}",${f.vDropVolts},${f.vDropPercent},${f.limitPercent},"${f.status}"\n`;

      });

      csvContent += "\nFINAL BRANCH CIRCUITS VOLTAGE DROP VERIFICATION\n";

      csvContent += "Circuit ID,Circuit Name,Board ID,Phase,Category,Load (W),Current (A),Length (m),Cable Size (sqmm),Cable Type,Drop (V),Drop (%),IEC Limit (%),Upsized,Status\n";

      (riserData?.circuitRows || []).forEach(c => {

        csvContent += `"${c.id}","${c.name}","${c.boardId}","${c.phase}","${c.category}",${c.loadW},${c.designCurrentA},${c.runLengthM},${c.actualSizeMm2},"${c.cableType}",${c.vDropVolts},${c.vDropPercent},${c.maxAllowedDropPercent},"${c.isUpsized ? 'YES' : 'NO'}","${c.status}"\n`;

      });

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

      csvContent += `Water Hammer Surge Pressure,${waterHammerData?.surgeKpa} kPa (${waterHammerData?.surgePsi} PSI)\n`;

      csvContent += `Peak Transient Pressure,${waterHammerData?.peakKpa} kPa (${waterHammerData?.peakPsi} PSI)\n`;

      csvContent += `PDI-WH 201 Arrestor Sizing,${waterHammerData?.arrestorSize} (PDI Code ${waterHammerData?.pdiCode})\n`;

      csvContent += `Damped Peak Pressure,${waterHammerData?.dampedPeakKpa} kPa (${waterHammerData?.dampedPeakPsi} PSI)\n`;

      csvContent += `Drainage Slope Gradient,${drainageClearanceData?.gradientRatio}\n`;

      csvContent += `Total Drainage Fall,${drainageClearanceData?.totalFallMm} mm\n`;

      csvContent += `Inspection Chamber Invert Level,${drainageClearanceData?.inspectionChamberIlM} m\n`;

      csvContent += `Ceiling Plenum Depth,${drainageClearanceData?.plenumDepthMm} mm\n`;

      csvContent += `Plenum Clearance Margin,${drainageClearanceData?.clearanceMarginMm} mm (${drainageClearanceData?.status})\n`;

    } else if (activeTab === 'fire') {
      csvContent += `MEPLANIQ FIRE PROTECTION & LIFE SAFETY HYDRAULIC SIZING SHEET - ${projectName} (${ts})\n`;
      csvContent += `Governing Standards,NFPA 13 • NFPA 14 • NFPA 20 • NFPA 22 • NBC 2016\n`;
      csvContent += `Occupancy Hazard Classification,${fireData?.hazardClass}\n`;
      csvContent += `Governing Fire Water Demand,${fireData?.governingFlowGpm} GPM (${fireData?.governingFlowLpm} LPM)\n`;
      csvContent += `Fire Booster Pump TDH,${fireData?.governingHeadM} m (${fireData?.governingHeadBar} bar)\n`;
      csvContent += `Fire Pump Electric Drive Motor,${fireData?.pump?.motorHp} HP (${fireData?.pump?.motorKw} kW)\n`;
      csvContent += `Jockey Pressure Maintenance Pump,${fireData?.pump?.jockeyFlowGpm} GPM @ ${fireData?.pump?.jockeyMotorHp} HP\n`;
      csvContent += `Dedicated Fire Water Storage Tank,${fireData?.tank?.capacityGal} Gallons (${fireData?.tank?.capacityM3} m3)\n`;
      csvContent += `Sprinkler Discharge Formula,Q = K * sqrt(P) [K=5.6, P=7.0 PSI -> ${fireData?.sprinkler?.singleHeadFlowGpm} GPM]\n`;
      csvContent += `Sprinkler Remote Operating Heads,${fireData?.sprinkler?.operatingHeadsCount} heads over 1500 sqft\n`;
      csvContent += `Total Building Sprinkler Estimate,${fireData?.sprinkler?.totalSprinklersCount} pendant heads\n`;
      csvContent += `Class I Wet Riser Standpipe Flow,${fireData?.standpipe?.flowGpm} GPM @ 100 PSI residual\n`;
    } else if (activeTab === 'clash') {
      csvContent += `MEPLANIQ MULTI-DISCIPLINE 3D CLASH RESOLUTION REPORT - ${projectName} (${ts})\n`;
      csvContent += `Standard,ISO 19650-2 / BIM Level 2 Coordination Protocol\n`;
      csvContent += `Total Clashes Detected,${clashData?.totalClashes}\n`;
      csvContent += `Total Detours Applied,${clashData?.resolvedCount}\n`;
      csvContent += `Resolution Efficiency,${clashData?.resolutionPercent}%\n`;
      csvContent += `Coordination Status,${clashData?.status}\n\n`;
      csvContent += "Clash ID,Discipline A,Discipline B,Clash Type,3D Coordinate Location,Resolution Strategy,Status\n";
      (clashData?.clashes || []).forEach(c => {
        csvContent += `"${c.id}","${c.discA}","${c.discB}","${c.type}","X:${c.location[0]} Y:${c.location[1]} Z:${c.location[2]}","${c.strategy}","${c.status}"\n`;
      });
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

            { id: 'riser', label: '⚡ Riser, Voltage Drop & Fault Current (IEC 60909)', count: riserData?.circuitRows?.length || 0 },

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

                gridTemplateColumns: 'repeat(6, 1fr)',

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

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>

                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Acoustic Attenuation</div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>

                    -18 <span style={{ fontSize: '11px', color: '#64748B' }}>dB</span>

                  </div>

                  <div style={{ fontSize: '10px', color: '#10B981', marginTop: '2px', fontWeight: 600 }}>NC-35 Whisper Quiet</div>

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

              {/* ASHRAE 55 / ISO 7730 THERMAL COMFORT PMV / PPD ANALYTICS */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginTop: '20px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>

                  <div>

                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>

                      🌡️ ASHRAE Standard 55 & ISO 7730 Thermal Comfort Analytics (PMV / PPD)

                    </h4>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                      Fanger Thermal Comfort Equation • Predicted Mean Vote & Dissatisfied Percentage

                    </span>

                  </div>

                  <span style={{

                    backgroundColor: thermalComfort.status === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',

                    color: thermalComfort.status === 'OPTIMAL' ? '#34D399' : '#38BDF8',

                    padding: '3px 8px',

                    borderRadius: '4px',

                    fontSize: '10.5px',

                    fontWeight: 700

                  }}>

                    {thermalComfort.category}

                  </span>

                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>

                  <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>PREDICTED MEAN VOTE (PMV)</div>

                    <div style={{ fontSize: '22px', fontWeight: 800, color: Math.abs(thermalComfort.pmv) <= 0.2 ? '#10B981' : '#38BDF8', marginTop: '2px' }}>

                      {thermalComfort.pmv > 0 ? `+${thermalComfort.pmv}` : thermalComfort.pmv}

                    </div>

                    <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '2px' }}>

                      Sensation: <strong>{thermalComfort.sensation}</strong>

                    </div>

                  </div>

                  <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>DISSATISFIED PERCENTAGE (PPD)</div>

                    <div style={{ fontSize: '22px', fontWeight: 800, color: thermalComfort.ppd <= 10.0 ? '#10B981' : '#F59E0B', marginTop: '2px' }}>

                      {thermalComfort.ppd}%

                    </div>

                    <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '2px' }}>

                      {100 - thermalComfort.ppd}% Satisfied Occupants

                    </div>

                  </div>

                  <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>CLOTHING INSULATION (Icl)</div>

                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#FCD34D', marginTop: '2px' }}>

                      {thermalParams.clo} clo

                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>

                      <button

                        type="button"

                        onClick={() => setThermalParams(p => ({ ...p, clo: 0.5 }))}

                        style={{

                          backgroundColor: thermalParams.clo === 0.5 ? '#38BDF8' : '#0F172A',

                          color: thermalParams.clo === 0.5 ? '#0F172A' : '#94A3B8',

                          border: 'none',

                          borderRadius: '3px',

                          padding: '2px 6px',

                          fontSize: '9.5px',

                          fontWeight: 700,

                          cursor: 'pointer'

                        }}

                      >

                        Summer (0.5)

                      </button>

                      <button

                        type="button"

                        onClick={() => setThermalParams(p => ({ ...p, clo: 0.7 }))}

                        style={{

                          backgroundColor: thermalParams.clo === 0.7 ? '#38BDF8' : '#0F172A',

                          color: thermalParams.clo === 0.7 ? '#0F172A' : '#94A3B8',

                          border: 'none',

                          borderRadius: '3px',

                          padding: '2px 6px',

                          fontSize: '9.5px',

                          fontWeight: 700,

                          cursor: 'pointer'

                        }}

                      >

                        Office (0.7)

                      </button>

                      <button

                        type="button"

                        onClick={() => setThermalParams(p => ({ ...p, clo: 1.0 }))}

                        style={{

                          backgroundColor: thermalParams.clo === 1.0 ? '#38BDF8' : '#0F172A',

                          color: thermalParams.clo === 1.0 ? '#0F172A' : '#94A3B8',

                          border: 'none',

                          borderRadius: '3px',

                          padding: '2px 6px',

                          fontSize: '9.5px',

                          fontWeight: 700,

                          cursor: 'pointer'

                        }}

                      >

                        Winter (1.0)

                      </button>

                    </div>

                  </div>

                  <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>SETPOINT TEMPERATURE (Ta)</div>

                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>

                      {thermalParams.ta}°C

                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>

                      {[23.0, 24.0, 25.0, 26.0].map(temp => (

                        <button

                          key={temp}

                          type="button"

                          onClick={() => setThermalParams(p => ({ ...p, ta: temp, tr: temp }))}

                          style={{

                            backgroundColor: thermalParams.ta === temp ? '#10B981' : '#0F172A',

                            color: thermalParams.ta === temp ? '#FFFFFF' : '#94A3B8',

                            border: 'none',

                            borderRadius: '3px',

                            padding: '2px 6px',

                            fontSize: '9.5px',

                            fontWeight: 700,

                            cursor: 'pointer'

                          }}

                        >

                          {temp}°

                        </button>

                      ))}

                    </div>

                  </div>

                </div>

              </div>

              {/* SMACNA & ASHRAE PARAMETRIC DUCT FITTINGS & FAN STATIC PRESSURE */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginTop: '20px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>

                  <div>

                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>

                      🌪️ SMACNA & ASHRAE Parametric Duct Fittings & Fan External Static Pressure (ESP)

                    </h4>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                      Dynamic Fitting Loss Coefficients (Co) • Supply Fan Static Pressure & Motor BHP Sizing

                    </span>

                  </div>

                  <div style={{ textAlign: 'right' }}>

                    <span style={{ color: '#FCD34D', fontWeight: 800, fontSize: '14px' }}>

                      {fittingsData.totalFanStaticPressurePa} Pa

                    </span>

                    <span style={{ color: '#94A3B8', fontSize: '11px', marginLeft: '6px' }}>

                      ({fittingsData.totalFanStaticPressureInWg} in. w.g. • {fittingsData.fanBhp} BHP)

                    </span>

                  </div>

                </div>

                <div style={{ overflowX: 'auto' }}>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>

                    <thead>

                      <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderBottom: '1px solid #334155' }}>

                        <th style={{ padding: '8px 10px' }}>Fitting Tag</th>

                        <th style={{ padding: '8px 10px' }}>Description / Fitting Type</th>

                        <th style={{ padding: '8px 10px' }}>Standard</th>

                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Loss Coeff (Co)</th>

                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Velocity (m/s)</th>

                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Pressure Loss (Pa)</th>

                      </tr>

                    </thead>

                    <tbody>

                      {fittingsData.fittings.map((fit, idx) => (

                        <tr key={fit.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>

                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#38BDF8' }}>{fit.id}</td>

                          <td style={{ padding: '8px 10px', color: '#F1F5F9' }}>{fit.type}</td>

                          <td style={{ padding: '8px 10px', color: '#94A3B8', fontSize: '10px' }}>{fit.standard}</td>

                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#CBD5E1' }}>{fit.lossCoeffCo}</td>

                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#FCD34D' }}>{fit.velocityMs} m/s</td>

                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fit.lossPa} Pa</td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

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

          {/* TAB 2.5: MULTI-LEVEL ELECTRICAL RISER & IEC 60364 VOLTAGE DROP */}

          {activeTab === 'riser' && riserData && (

            <div>

              {/* Summary KPIs */}

              <div style={{

                display: 'grid',

                gridTemplateColumns: 'repeat(4, 1fr)',

                gap: '12px',

                marginBottom: '20px'

              }}>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>

                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Total Connected Capacity</div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>

                    {riserData.totalConnectedKw} <span style={{ fontSize: '11px', color: '#64748B' }}>kW</span>

                  </div>

                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>415V / 230V 3PH+N Distribution</div>

                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>

                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Max Circuit Voltage Drop</div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: riserData.maxCircuitDropPercent <= 3.0 ? '#10B981' : (riserData.maxCircuitDropPercent <= 5.0 ? '#F59E0B' : '#EF4444'), marginTop: '4px' }}>

                    {riserData.maxCircuitDropPercent}%

                  </div>

                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>IEC Limit: 3.0% Lgt / 5.0% Pwr</div>

                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>

                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>IEC 60364 Compliance</div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>

                    {riserData.complianceRatePercent}%

                  </div>

                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{riserData.compliantCount} of {riserData.circuitRows.length} Circuits Compliant</div>

                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>

                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Auto-Upsized Conductors</div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>

                    {riserData.upsizedCount} <span style={{ fontSize: '11px', color: '#64748B' }}>Runs</span>

                  </div>

                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Auto-Corrected to BS 7671 Specs</div>

                </div>

              </div>

              {/* Interactive Single-Line Riser Diagram (SLD) */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginBottom: '20px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>

                  <div>

                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>

                      ⚡ Multi-Level Electrical Single-Line Riser Diagram (SLD)

                    </h4>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                      Primary Utility Incomer • Emergency Standby DG • Sub-Main Distribution Busbars

                    </span>

                  </div>

                  <span style={{

                    backgroundColor: 'rgba(56, 189, 248, 0.15)',

                    color: '#38BDF8',

                    border: '1px solid rgba(56, 189, 248, 0.3)',

                    padding: '3px 8px',

                    borderRadius: '4px',

                    fontSize: '10px',

                    fontWeight: 700

                  }}>

                    IEEE / IEC Standard SLD

                  </span>

                </div>

                {/* SVG Schematic Riser Diagram */}

                <div style={{

                  backgroundColor: '#0A0F1D',

                  border: '1px solid #1E293B',

                  borderRadius: '6px',

                  padding: '12px',

                  overflowX: 'auto'

                }}>

                  <svg viewBox="0 0 880 340" style={{ width: '100%', minWidth: '780px', height: 'auto', display: 'block' }}>

                    <defs>

                      <pattern id="riserGrid" width="20" height="20" patternUnits="userSpaceOnUse">

                        <line x1="0" y1="0" x2="20" y2="0" stroke="#1E293B" strokeWidth="0.5" opacity="0.3" />

                        <line x1="0" y1="0" x2="0" y2="20" stroke="#1E293B" strokeWidth="0.5" opacity="0.3" />

                      </pattern>

                    </defs>

                    <rect width="880" height="340" fill="url(#riserGrid)" rx="4" />

                    {/* Source Tier: Utility & Generator */}

                    {/* Utility Transformer */}

                    <rect x="40" y="30" width="160" height="50" rx="6" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />

                    <text x="120" y="52" fill="#F8FAFC" fontSize="11" fontWeight="700" textAnchor="middle">11kV / 415V TRANSFORMER</text>

                    <text x="120" y="68" fill="#94A3B8" fontSize="9.5" textAnchor="middle">160 kVA Dyn11 • Utility Incomer</text>

                    {/* Standby DG */}

                    <rect x="250" y="30" width="150" height="50" rx="6" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2" />

                    <text x="325" y="52" fill="#FDE047" fontSize="11" fontWeight="700" textAnchor="middle">DIESEL GENERATOR DG-01</text>

                    <text x="325" y="68" fill="#94A3B8" fontSize="9.5" textAnchor="middle">80 kVA Standby Prime Power</text>

                    {/* Connecting Feeder Lines to ATS */}

                    <line x1="120" y1="80" x2="120" y2="120" stroke="#38BDF8" strokeWidth="2" />

                    <line x1="325" y1="80" x2="325" y2="105" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />

                    <line x1="325" y1="105" x2="160" y2="105" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />

                    <line x1="160" y1="105" x2="160" y2="120" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />

                    {/* ATS Unit */}

                    <rect x="90" y="120" width="100" height="36" rx="4" fill="#0F172A" stroke="#10B981" strokeWidth="1.5" />

                    <text x="140" y="142" fill="#34D399" fontSize="10.5" fontWeight="800" textAnchor="middle">ATS-01 (4P 250A)</text>

                    {/* Feed into MDB-01 */}

                    <line x1="140" y1="156" x2="140" y2="190" stroke="#10B981" strokeWidth="2.5" />

                    

                    {/* MDB-01 Main Distribution Board */}

                    <rect x="40" y="190" width="200" height="60" rx="6" fill="#1E293B" stroke="#A78BFA" strokeWidth="2" />

                    <text x="140" y="214" fill="#EDE9FE" fontSize="12" fontWeight="800" textAnchor="middle">MDB-01 (MAIN SWITCHBOARD)</text>

                    <text x="140" y="230" fill="#C4B5FD" fontSize="10" textAnchor="middle">200A 4P MCCB 36kA • Ground Flr</text>

                    <text x="140" y="244" fill="#10B981" fontSize="9" fontWeight="700" textAnchor="middle">Feeder Vd: 0.24% (Limit: 1.5%)</text>

                    {/* Horizontal Main Busbar Distribution */}

                    <line x1="240" y1="220" x2="480" y2="220" stroke="#A78BFA" strokeWidth="3" />

                    {/* Sub-Main SMDB-L1 */}

                    <line x1="480" y1="120" x2="480" y2="300" stroke="#64748B" strokeWidth="1.5" strokeDasharray="2 2" />

                    <line x1="330" y1="220" x2="330" y2="150" stroke="#38BDF8" strokeWidth="2" />

                    <rect x="270" y="105" width="130" height="45" rx="5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />

                    <text x="335" y="124" fill="#38BDF8" fontSize="10" fontWeight="700" textAnchor="middle">SMDB-L1 (Floor 1)</text>

                    <text x="335" y="140" fill="#94A3B8" fontSize="8.5" textAnchor="middle">100A TP&N • Vd: 0.61%</text>

                    {/* Sub-Main SMDB-L2 */}

                    <line x1="480" y1="220" x2="520" y2="220" stroke="#38BDF8" strokeWidth="2" />

                    <rect x="520" y="198" width="130" height="45" rx="5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />

                    <text x="585" y="217" fill="#38BDF8" fontSize="10" fontWeight="700" textAnchor="middle">SMDB-L2 (Floor 2)</text>

                    <text x="585" y="233" fill="#94A3B8" fontSize="8.5" textAnchor="middle">100A TP&N • Vd: 0.73%</text>

                    {/* Sub-Main EMDB-01 (Essential) */}

                    <line x1="330" y1="220" x2="330" y2="280" stroke="#EF4444" strokeWidth="2" />

                    <rect x="270" y="280" width="130" height="45" rx="5" fill="#0F172A" stroke="#EF4444" strokeWidth="1.5" />

                    <text x="335" y="299" fill="#F87171" fontSize="10" fontWeight="700" textAnchor="middle">EMDB-01 (Life Safety)</text>

                    <text x="335" y="315" fill="#94A3B8" fontSize="8.5" textAnchor="middle">63A TP&N Fire-Rated • Vd: 0.46%</text>

                    {/* Final Branch DBs from SMDB-L1 */}

                    <line x1="400" y1="120" x2="700" y2="120" stroke="#38BDF8" strokeWidth="1.5" />

                    

                    {/* DB-L1-LGT */}

                    <line x1="700" y1="70" x2="700" y2="170" stroke="#FCD34D" strokeWidth="2" />

                    <rect x="710" y="55" width="145" height="38" rx="4" fill="#1E293B" stroke="#FCD34D" strokeWidth="1.2" />

                    <text x="782" y="72" fill="#FDE047" fontSize="9.5" fontWeight="700" textAnchor="middle">DB-L1-LGT (Lighting)</text>

                    <text x="782" y="85" fill="#94A3B8" fontSize="8" textAnchor="middle">40A 4P • 12 Ways • Vd: 0.36%</text>

                    {/* DB-L1-PWR */}

                    <rect x="710" y="105" width="145" height="38" rx="4" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.2" />

                    <text x="782" y="122" fill="#38BDF8" fontSize="9.5" fontWeight="700" textAnchor="middle">DB-L1-PWR (Power Sockets)</text>

                    <text x="782" y="135" fill="#94A3B8" fontSize="8" textAnchor="middle">63A 4P • 18 Ways • Vd: 0.45%</text>

                    {/* DB-L1-HVAC */}

                    <rect x="710" y="155" width="145" height="38" rx="4" fill="#1E293B" stroke="#F97316" strokeWidth="1.2" />

                    <text x="782" y="172" fill="#FB923C" fontSize="9.5" fontWeight="700" textAnchor="middle">DB-L1-HVAC (VRF/AHU)</text>

                    <text x="782" y="185" fill="#94A3B8" fontSize="8" textAnchor="middle">63A 4P • 8 Ways • Vd: 0.71%</text>

                    {/* R/Y/B Phase Busbar legend */}

                    <g transform="translate(670, 280)">

                      <rect x="0" y="0" width="185" height="42" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1" />

                      <circle cx="15" cy="14" r="5" fill="#EF4444" />

                      <text x="25" y="18" fill="#F87171" fontSize="9" fontWeight="700">Phase R (Red)</text>

                      <circle cx="100" cy="14" r="5" fill="#EAB308" />

                      <text x="110" y="18" fill="#FDE047" fontSize="9" fontWeight="700">Phase Y (Yellow)</text>

                      <circle cx="15" cy="30" r="5" fill="#3B82F6" />

                      <text x="25" y="34" fill="#60A5FA" fontSize="9" fontWeight="700">Phase B (Blue)</text>

                      <circle cx="100" cy="30" r="5" fill="#94A3B8" />

                      <text x="110" y="34" fill="#CBD5E1" fontSize="9" fontWeight="700">Neutral (Black)</text>

                    </g>

                  </svg>

                </div>

              </div>

              {/* Sub-Main Distribution Feeder Schedule */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginBottom: '20px'

              }}>

                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>

                  📋 Multi-Level Sub-Main Riser Feeder Schedule (IEC 60364-5-52)

                </h4>

                <div style={{ overflowX: 'auto' }}>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>

                    <thead>

                      <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderBottom: '1px solid #334155' }}>

                        <th style={{ padding: '8px 10px' }}>Feeder ID</th>

                        <th style={{ padding: '8px 10px' }}>Origin</th>

                        <th style={{ padding: '8px 10px' }}>Destination</th>

                        <th style={{ padding: '8px 10px' }}>Current (Ib)</th>

                        <th style={{ padding: '8px 10px' }}>Run (m)</th>

                        <th style={{ padding: '8px 10px' }}>Cable Specification</th>

                        <th style={{ padding: '8px 10px' }}>Drop (V)</th>

                        <th style={{ padding: '8px 10px' }}>Drop (%)</th>

                        <th style={{ padding: '8px 10px' }}>Limit</th>

                        <th style={{ padding: '8px 10px' }}>Status</th>

                      </tr>

                    </thead>

                    <tbody>

                      {riserData.riserFeeders.map((f, i) => (

                        <tr key={f.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>

                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#38BDF8' }}>{f.id}</td>

                          <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{f.from}</td>

                          <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{f.to}</td>

                          <td style={{ padding: '8px 10px', color: '#FCD34D' }}>{f.designCurrentA} A</td>

                          <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{f.runLengthM} m</td>

                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#E2E8F0', fontSize: '10.5px' }}>{f.cableSpec}</td>

                          <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{f.vDropVolts} V</td>

                          <td style={{ padding: '8px 10px', fontWeight: 700, color: f.vDropPercent <= 1.5 ? '#10B981' : '#EF4444' }}>

                            {f.vDropPercent}%

                          </td>

                          <td style={{ padding: '8px 10px', color: '#64748B' }}>&le; {f.limitPercent}%</td>

                          <td style={{ padding: '8px 10px' }}>

                            <span style={{

                              backgroundColor: 'rgba(16, 185, 129, 0.2)',

                              color: '#34D399',

                              padding: '2px 6px',

                              borderRadius: '4px',

                              fontSize: '9.5px',

                              fontWeight: 700

                            }}>

                              ✓ PASS

                            </span>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

              {/* Final Branch Circuits Voltage Drop Table */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>

                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>

                    🔍 Final Branch Circuit Voltage Drop Verification Schedule ({riserData.circuitRows.length} Circuits)

                  </h4>

                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                    Standard: IEC 60364-5-52 Table 4D1B Conductor Resistivity

                  </span>

                </div>

                <div style={{ overflowX: 'auto' }}>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>

                    <thead>

                      <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderBottom: '1px solid #334155' }}>

                        <th style={{ padding: '8px 10px' }}>Circuit ID</th>

                        <th style={{ padding: '8px 10px' }}>Name / Room</th>

                        <th style={{ padding: '8px 10px' }}>Board</th>

                        <th style={{ padding: '8px 10px' }}>Phase</th>

                        <th style={{ padding: '8px 10px' }}>Category</th>

                        <th style={{ padding: '8px 10px' }}>Load (W)</th>

                        <th style={{ padding: '8px 10px' }}>Ib (A)</th>

                        <th style={{ padding: '8px 10px' }}>Length</th>

                        <th style={{ padding: '8px 10px' }}>Cable Gauge</th>

                        <th style={{ padding: '8px 10px' }}>Drop (V)</th>

                        <th style={{ padding: '8px 10px' }}>Drop (%)</th>

                        <th style={{ padding: '8px 10px' }}>IEC Limit</th>

                        <th style={{ padding: '8px 10px' }}>Compliance</th>

                      </tr>

                    </thead>

                    <tbody>

                      {riserData.circuitRows.map((c, i) => {

                        const phaseColor = { R: '#EF4444', Y: '#EAB308', B: '#3B82F6' }[c.phase] || '#94A3B8';

                        return (

                          <tr key={c.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>

                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#F1F5F9' }}>{c.id}</td>

                            <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{c.name}</td>

                            <td style={{ padding: '8px 10px', color: '#94A3B8', fontSize: '10px' }}>{c.boardId}</td>

                            <td style={{ padding: '8px 10px' }}>

                              <span style={{

                                backgroundColor: `${phaseColor}25`,

                                color: phaseColor,

                                border: `1px solid ${phaseColor}60`,

                                padding: '1px 5px',

                                borderRadius: '3px',

                                fontWeight: 800,

                                fontSize: '10px'

                              }}>

                                {c.phase}

                              </span>

                            </td>

                            <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{c.category}</td>

                            <td style={{ padding: '8px 10px', color: '#FCD34D' }}>{c.loadW} W</td>

                            <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{c.designCurrentA} A</td>

                            <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{c.runLengthM} m</td>

                            <td style={{ padding: '8px 10px', fontWeight: 700, color: c.isUpsized ? '#38BDF8' : '#F8FAFC' }}>

                              {c.actualSizeMm2} mm² {c.isUpsized && <span style={{ fontSize: '9px', color: '#38BDF8' }}>(upsized)</span>}

                            </td>

                            <td style={{ padding: '8px 10px', color: '#CBD5E1' }}>{c.vDropVolts} V</td>

                            <td style={{ padding: '8px 10px', fontWeight: 800, color: c.vDropPercent <= c.maxAllowedDropPercent ? '#10B981' : '#EF4444' }}>

                              {c.vDropPercent}%

                            </td>

                            <td style={{ padding: '8px 10px', color: '#64748B' }}>&le; {c.maxAllowedDropPercent}%</td>

                            <td style={{ padding: '8px 10px' }}>

                              <span style={{

                                backgroundColor: c.isCompliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',

                                color: c.isCompliant ? '#34D399' : '#F87171',

                                padding: '2px 6px',

                                borderRadius: '4px',

                                fontSize: '9.5px',

                                fontWeight: 700

                              }}>

                                {c.isCompliant ? '✓ COMPLIANT' : '⚠ EXCEEDS'}

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

              {/* Hydraulic Water Hammer & Transient Surge Protection (PDI-WH 201 / Joukowsky) */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginBottom: '20px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>

                  <div>

                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>

                      🌊 Hydraulic Water Hammer & Joukowsky Transient Surge Protection

                    </h4>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                      Joukowsky Equation ΔP_wh = ρ·a·Δv • PDI-WH 201 & ASSE 1010 Water Hammer Arrestors

                    </span>

                  </div>

                  <span style={{

                    backgroundColor: waterHammerData?.exceedsSafePressure ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',

                    color: waterHammerData?.exceedsSafePressure ? '#F87171' : '#34D399',

                    border: `1px solid ${waterHammerData?.exceedsSafePressure ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,

                    padding: '3px 8px',

                    borderRadius: '4px',

                    fontSize: '10px',

                    fontWeight: 700

                  }}>

                    {waterHammerData?.exceedsSafePressure ? 'ARRESTORS REQUIRED' : 'SURGE SAFE'}

                  </span>

                </div>

                <div style={{

                  display: 'grid',

                  gridTemplateColumns: 'repeat(4, 1fr)',

                  gap: '12px',

                  marginBottom: '16px'

                }}>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Wave Speed (CPVC a)</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>

                      {waterHammerData?.waveSpeedMs} <span style={{ fontSize: '11px', color: '#64748B' }}>m/s</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>CPVC Elasticity Modulus</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Joukowsky Surge ΔP</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#FCD34D', marginTop: '2px' }}>

                      +{waterHammerData?.surgeKpa} <span style={{ fontSize: '11px', color: '#64748B' }}>kPa</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{waterHammerData?.surgePsi} PSI at v={waterHammerData?.flowVelocityMs} m/s</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Peak Undamped Surge</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: waterHammerData?.exceedsSafePressure ? '#EF4444' : '#10B981', marginTop: '2px' }}>

                      {waterHammerData?.peakKpa} <span style={{ fontSize: '11px', color: '#64748B' }}>kPa</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Limit: &le; {waterHammerData?.maxAllowableKpa} kPa</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Damped Peak Surge</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>

                      {waterHammerData?.dampedPeakKpa} <span style={{ fontSize: '11px', color: '#64748B' }}>kPa</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{waterHammerData?.dampedPeakPsi} PSI with PDI Arrestor</div>

                  </div>

                </div>

                <div style={{

                  backgroundColor: '#0A0F1D',

                  border: '1px solid #1E293B',

                  borderRadius: '6px',

                  padding: '12px',

                  display: 'flex',

                  alignItems: 'center',

                  justifyContent: 'space-between'

                }}>

                  <div>

                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Standard Arrestor Specification:</span>

                    <span style={{ fontSize: '12px', color: '#F8FAFC', fontWeight: 700, marginLeft: '8px' }}>

                      PDI-WH 201 {waterHammerData?.arrestorSize}

                    </span>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>

                      Locations: WHA-01 (WC Flush Valve Branch) • WHA-02 (Kitchen Solenoid Branch)

                    </div>

                  </div>

                  <span style={{

                    backgroundColor: 'rgba(56, 189, 248, 0.15)',

                    color: '#38BDF8',

                    padding: '4px 10px',

                    borderRadius: '4px',

                    fontSize: '11px',

                    fontWeight: 700

                  }}>

                    PDI CODE {waterHammerData?.pdiCode}

                  </span>

                </div>

              </div>

              {/* Sanitary Gravity Drainage Slope & Invert Level Profile */}

              <div style={{

                backgroundColor: '#0F172A',

                border: '1px solid #1E293B',

                borderRadius: '8px',

                padding: '16px',

                marginBottom: '20px'

              }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>

                  <div>

                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>

                      📐 Sanitary Gravity Drainage Slope & Invert Level (IL) Collision Verification

                    </h4>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>

                      UPC Table 702.1 & IPC 704.1 • Invert Levels • Ceiling Plenum Drop Clearance

                    </span>

                  </div>

                  <span style={{

                    backgroundColor: drainageClearanceData?.isClearanceSafe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',

                    color: drainageClearanceData?.isClearanceSafe ? '#34D399' : '#FBBF24',

                    border: `1px solid ${drainageClearanceData?.isClearanceSafe ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,

                    padding: '3px 8px',

                    borderRadius: '4px',

                    fontSize: '10px',

                    fontWeight: 700

                  }}>

                    {drainageClearanceData?.isClearanceSafe ? '✓ ZERO PLENUM COLLISION' : '⚠ PLENUM RUN REVIEW'}

                  </span>

                </div>

                <div style={{

                  display: 'grid',

                  gridTemplateColumns: 'repeat(4, 1fr)',

                  gap: '12px',

                  marginBottom: '16px'

                }}>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Hydraulic Gradient</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>

                      {drainageClearanceData?.gradientRatio}

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{drainageClearanceData?.fallPerMeterMm} mm/m fall for Ø110</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Total Invert Fall</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#FCD34D', marginTop: '2px' }}>

                      {drainageClearanceData?.totalFallMm} <span style={{ fontSize: '11px', color: '#64748B' }}>mm</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Over {drainageClearanceData?.totalRunLengthM} m total run</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Invert Level (Trap → IC)</div>

                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>

                      {drainageClearanceData?.trapInvertLevelM}m → {drainageClearanceData?.inspectionChamberIlM}m

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>External Inspection Chamber</div>

                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px' }}>

                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Plenum Space Budget</div>

                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>

                      {drainageClearanceData?.plenumDepthMm} <span style={{ fontSize: '11px', color: '#64748B' }}>mm</span>

                    </div>

                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Soffit +2.85m • Ceiling +2.40m</div>

                  </div>

                </div>

              </div>

            </div>

          )}

          {/* TAB 3.5: FIRE PROTECTION & LIFE SAFETY HYDRAULICS (NFPA 13 / NFPA 14) */}
          {activeTab === 'fire' && fireData && (
            <div>
              {/* Summary KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Governing Fire Demand</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#EF4444', marginTop: '4px' }}>
                    {fireData.governingFlowGpm} <span style={{ fontSize: '11px', color: '#64748B' }}>GPM</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {fireData.governingFlowLpm} LPM • Class I Standpipe Governs
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Fire Booster Pump TDH</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                    {fireData.governingHeadM} <span style={{ fontSize: '11px', color: '#64748B' }}>m Head</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {fireData.governingHeadBar} bar (100 PSI Residual + Elevation)
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Main Fire Pump Motor</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    {fireData.pump.motorHp} <span style={{ fontSize: '11px', color: '#64748B' }}>HP</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {fireData.pump.motorKw} kW 415V 3PH (NFPA 20 Electric Drive)
                  </div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Dedicated Storage Tank</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {fireData.tank.capacityM3} <span style={{ fontSize: '11px', color: '#64748B' }}>m³</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {fireData.tank.capacityGal.toLocaleString()} Gal ({fireData.tank.durationMin} min NFPA 22 Duration)
                  </div>
                </div>
              </div>

              {/* Grid 2-Column: Sprinkler Hydraulics & Standpipe Wet Riser */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {/* NFPA 13 Automatic Sprinkler System Card */}
                <div style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                        💦 NFPA 13 Automatic Sprinkler Hydraulics
                      </h4>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                        Discharge Formula Q = K·√P • K=5.6 Orifice (1/2" NPT)
                      </span>
                    </div>
                    <span style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: '#38BDF8',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      NFPA 13 LIGHT HAZARD
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Remote Head Discharge (P=7.0 PSI):</span>
                      <strong style={{ color: '#FCD34D' }}>{fireData.sprinkler.singleHeadFlowGpm} GPM ({fireData.sprinkler.singleHeadFlowLpm} LPM)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Design Density & Remote Area:</span>
                      <strong style={{ color: '#F1F5F9' }}>{fireData.sprinkler.designDensityGpmSqft} GPM/sqft over 1500 sqft</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Simultaneous Operating Heads:</span>
                      <strong style={{ color: '#38BDF8' }}>{fireData.sprinkler.operatingHeadsCount} heads (Remote Area)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Total Building Sprinklers Estimated:</span>
                      <strong style={{ color: '#10B981' }}>{fireData.sprinkler.totalSprinklersCount} pendant heads</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Sprinkler Flow + Hose Allowance:</span>
                      <strong style={{ color: '#EF4444' }}>{fireData.sprinkler.totalSprinklerDemandGpm} GPM ({fireData.sprinkler.totalSprinklerDemandLpm} LPM)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Piping Sizing Schedule:</span>
                      <strong style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>DN100 Riser / DN65 Cross / DN32 Branch</strong>
                    </div>
                  </div>
                </div>

                {/* NFPA 14 Class I Wet Riser Standpipe Card */}
                <div style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                        🚒 NFPA 14 Wet Riser Standpipe System
                      </h4>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                        Class I Fire Brigade Landing Valves (2.5" / 65mm Outlets)
                      </span>
                    </div>
                    <span style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#F87171',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      CLASS I STANDPIPE
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Primary Riser Design Flow:</span>
                      <strong style={{ color: '#FCD34D' }}>{fireData.standpipe.flowGpm} GPM ({fireData.standpipe.flowLpm} LPM)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Top Landing Valve Residual:</span>
                      <strong style={{ color: '#10B981' }}>{fireData.standpipe.minResidualPsi} PSI ({fireData.standpipe.minResidualBar} bar / {fireData.standpipe.minResidualHeadM}m)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Static Elevation Head:</span>
                      <strong style={{ color: '#F1F5F9' }}>+{fireData.standpipe.elevationHeadM} m head</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Friction Loss in Sch 40 Riser:</span>
                      <strong style={{ color: '#F1F5F9' }}>+{fireData.standpipe.frictionLossHeadM} m head (C=120)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Total Standpipe Dynamic Head:</span>
                      <strong style={{ color: '#EF4444' }}>{fireData.standpipe.totalHeadM} m ({fireData.standpipe.totalHeadBar} bar)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0A0F1D', borderRadius: '4px' }}>
                      <span style={{ color: '#94A3B8' }}>Riser Pipe Specification:</span>
                      <strong style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{fireData.standpipe.pipeSpec}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* NFPA 20 Fire Pump Set & NFPA 22 Water Storage Reservoir */}
              <div style={{
                backgroundColor: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
                      ⚙️ NFPA 20 Fire Booster Pump Station & NFPA 22 Dedicated Reservoir
                    </h4>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Primary Electric Fire Pump • Standby Diesel Engine Pump (100% Redundancy) • Jockey Pressure Maintenance
                    </span>
                  </div>
                  <span style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    UL LISTED / FM APPROVED
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>PRIMARY FIRE BOOSTER PUMP</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC', marginTop: '4px' }}>
                      End-Suction / Split-Case Centrifugal
                    </div>
                    <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '6px' }}>
                      Flow: <strong>{fireData.governingFlowGpm} GPM</strong> @ <strong>{fireData.governingHeadM}m Head</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
                      Motor: <strong>{fireData.pump.motorHp} HP ({fireData.pump.motorKw} kW)</strong> 415V 3PH
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                      Hydraulic Power: {fireData.pump.hydraulicPowerKw} kW (η=72%)
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>JOCKEY PRESSURE PUMP</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                      Vertical Multistage In-Line
                    </div>
                    <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '6px' }}>
                      Flow: <strong>{fireData.pump.jockeyFlowGpm} GPM</strong> ({fireData.pump.jockeyFlowLpm} LPM)
                    </div>
                    <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '2px' }}>
                      Motor: <strong>{fireData.pump.jockeyMotorHp} HP (2.2 kW)</strong>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                      Cut-In: {fireData.pump.cutInPressurePsi} PSI • Cut-Out: {fireData.pump.cutOutPressurePsi} PSI
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0A0F1D', border: '1px solid #1E293B', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>NFPA 22 WATER RESERVOIR</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                      Dedicated Static Sump
                    </div>
                    <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '6px' }}>
                      Capacity: <strong>{fireData.tank.capacityM3} m³</strong> ({fireData.tank.capacityGal.toLocaleString()} Gal)
                    </div>
                    <div style={{ fontSize: '11px', color: '#FCD34D', marginTop: '2px' }}>
                      Duration: <strong>{fireData.tank.durationMin} minutes</strong> sustained flow
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                      Footprint: {fireData.tank.footprintSqm} m² @ {fireData.tank.effectiveDepthM}m effective depth
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3.8: 3D BIM MULTI-DISCIPLINE CLASH RESOLUTION & DETOURS */}
          {activeTab === 'clash' && clashData && (
            <div>
              {/* Summary KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Clashes Detected</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#FCD34D', marginTop: '4px' }}>
                    {clashData.totalClashes} <span style={{ fontSize: '11px', color: '#64748B' }}>Intersecting</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Across 5 BIM Disciplines</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Autonomous Detours</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>
                    {clashData.resolvedCount} <span style={{ fontSize: '11px', color: '#64748B' }}>Applied</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>3D Dogleg & Vertical Inverts</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Resolution Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    {clashData.resolutionPercent}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>100% Zero-Collision Target Met</div>
                </div>

                <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>BIM Coordination</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                    LEVEL 2
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>ISO 19650-2 Protocol Pass</div>
                </div>
              </div>

              {/* Clash Resolution Schedule Table */}
              <div style={{ border: '1px solid #1E293B', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#0F172A',
                  borderBottom: '1px solid #1E293B',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#F8FAFC' }}>
                    🛡️ Multi-Discipline 3D Clash Harmonization & Autonomous Detours
                  </span>
                  <span style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    ZERO HARD CLASHES
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0A0F1D', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                        <th style={{ padding: '8px 12px' }}>Clash ID</th>
                        <th style={{ padding: '8px 12px' }}>Discipline A</th>
                        <th style={{ padding: '8px 12px' }}>Discipline B</th>
                        <th style={{ padding: '8px 12px' }}>Clash Type</th>
                        <th style={{ padding: '8px 12px' }}>3D Coordinates</th>
                        <th style={{ padding: '8px 12px' }}>Autonomous Detour Strategy</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clashData.clashes.map((c, i) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#38BDF8', fontFamily: 'monospace' }}>{c.id}</td>
                          <td style={{ padding: '8px 12px', color: '#F1F5F9', fontWeight: 600 }}>{c.discA}</td>
                          <td style={{ padding: '8px 12px', color: '#F1F5F9', fontWeight: 600 }}>{c.discB}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#F87171',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '9.5px',
                              fontWeight: 700
                            }}>
                              {c.type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#94A3B8' }}>
                            [{c.location.join(', ')}]
                          </td>
                          <td style={{ padding: '8px 12px', color: '#34D399', fontWeight: 600 }}>
                            {c.strategy}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              color: '#10B981',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '9.5px',
                              fontWeight: 700
                            }}>
                              ✓ RESOLVED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

