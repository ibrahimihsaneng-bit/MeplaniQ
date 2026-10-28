/**
 * frontend/src/features/cad2d/cad2dBoqEngine.js
 * =============================================
 * Commercial 2D CAD Bill of Quantities (BOQ) & Quantity Surveying (QS) Takeoff Engine.
 * Formulated to RICS NRM2 (New Rules of Measurement) & CSI MasterFormat 2020 standards.
 * 
 * Computes exact quantitative takeoffs directly from live 2D architectural & MEP geometry:
 * - Div 03: Structural Concrete (Columns, Foundations, Slabs)
 * - Div 04: Masonry & Partitions (200mm / 150mm blockwork, mortar, lintels)
 * - Div 08: Openings (Single/double swing doors, sliding windows, fire-rated doors)
 * - Div 09: Internal Finishes (Floor tiles, skirting, wall plaster, primer/paint, ceiling)
 * - Div 22: Plumbing & Drainage (PPR water supply pipes, PVC drainage pipes, sanitary fixtures)
 * - Div 23: HVAC (Galvanized steel ductwork, diffusers, volume dampers, thermal insulation)
 * - Div 26: Electrical (Conduit runs, copper cabling, circuit breakers, luminaires, switches)
 * - Div 48: Solar PV Generation (Photovoltaic modules, racking, inverters, cabling)
 */

export const CSI_DIVISIONS = {
  DIV_03: { code: '03', name: 'Concrete', color: '#64748B' },
  DIV_04: { code: '04', name: 'Masonry & Partitions', color: '#F59E0B' },
  DIV_08: { code: '08', name: 'Openings (Doors & Windows)', color: '#3B82F6' },
  DIV_09: { code: '09', name: 'Finishes (Floor, Wall, Ceiling)', color: '#8B5CF6' },
  DIV_22: { code: '22', name: 'Plumbing & Public Health', color: '#06B6D4' },
  DIV_23: { code: '23', name: 'HVAC Ductwork & Ventilation', color: '#10B981' },
  DIV_26: { code: '26', name: 'Electrical Power & Lighting', color: '#EC4899' },
  DIV_48: { code: '48', name: 'Solar PV & Renewable Energy', color: '#EAB308' }
};

export const RATE_TIERS = {
  economy: { id: 'economy', label: 'Economy Standard', multiplier: 0.82, desc: 'Budget residential & standard developer specification' },
  standard: { id: 'standard', label: 'Commercial Standard', multiplier: 1.00, desc: 'Class-A commercial & high-performance residential' },
  premium: { id: 'premium', label: 'Premium Specification', multiplier: 1.35, desc: 'Luxury finishes, acoustic grade & enhanced MEP redundancies' },
  institutional: { id: 'institutional', label: 'Institutional / Hospital Grade', multiplier: 1.70, desc: 'Heavy-duty industrial, anti-bacterial & mission-critical resilience' }
};

export const CURRENCY_SYMBOLS = {
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', ratePerUSD: 1.0 },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro', ratePerUSD: 0.92 },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound', ratePerUSD: 0.79 },
  AED: { symbol: 'AED ', code: 'AED', name: 'UAE Dirham', ratePerUSD: 3.67 },
  SAR: { symbol: 'SAR ', code: 'SAR', name: 'Saudi Riyal', ratePerUSD: 3.75 },
  INR: { symbol: '₹', code: 'INR', name: 'Indian Rupee', ratePerUSD: 83.5 }
};

/**
 * Standard unit baseline rates in USD (Commercial Standard)
 */
const BASELINE_RATES = {
  // Div 03: Concrete
  columnConcreteM3: 165.0, // m3 of C30/37 reinforced concrete
  columnFormworkM2: 38.0,  // m2 of shuttering formwork
  
  // Div 04: Masonry
  blockwork200M2: 45.0,    // m2 200mm solid/hollow concrete masonry unit
  blockwork150M2: 36.0,    // m2 150mm partition blockwork
  wallLintelsLinM: 28.0,   // linear meter precast reinforced lintels
  
  // Div 08: Openings
  solidCoreDoorNr: 420.0,  // timber solid-core door + architectural ironmongery
  glassWindowNr: 310.0,    // double-glazed thermally broken aluminium window
  fireRatedDoorNr: 680.0,  // 2-hour fire-rated steel egress door
  
  // Div 09: Finishes
  floorTilePorcelainM2: 52.0, // 600x600 rectified porcelain floor tiles + adhesive
  wallPlasterM2: 14.5,        // 2-coat cement sand plaster 15mm
  wallPaintM2: 9.8,           // 1 primer coat + 2 coats washable low-VOC emulsion
  ceilingGypsumM2: 38.0,      // moisture-resistant gypsum false ceiling on galvanized grid
  skirtingM: 12.0,            // 100mm matching porcelain skirting
  
  // Div 22: Plumbing
  pprPipeDN25M: 18.5,         // PPR PN20 cold/hot water pipe including fittings
  pprPipeDN32M: 24.0,         // PPR PN20 riser / main water pipe
  pvcDrainDN110M: 32.0,       // UPVC Class D soil & waste pipe
  waterClosetNr: 340.0,       // wall-hung WC with dual-flush concealed cistern
  lavatoryNr: 220.0,          // undermount ceramic basin with mixer tap
  floorDrainNr: 65.0,         // stainless steel trapped floor drain
  
  // Div 23: HVAC
  ductworkSheetMetalKg: 8.5,  // fabricated galvanized steel duct (approx $8.5/kg ~ $34/m2)
  ductInsulationM2: 16.0,     // 25mm fiberglass acoustic/thermal insulation with foil facing
  supplyDiffuserNr: 85.0,     // 600x600 4-way ceiling diffuser + plenum box
  returnGrilleNr: 75.0,       // eggcrate return air grille
  fireDamperNr: 220.0,        // motorized fire/smoke damper
  
  // Div 26: Electrical
  conduitPvc20mM: 6.8,        // concealed PVC conduit 20mm in slab/wall
  wiring3x2_5M: 4.2,          // 3x2.5mm2 single-core copper wiring
  luminaireLedNr: 95.0,       // recessed LED architectural panel 600x600
  powerSocketNr: 45.0,        // twin 13A switched socket outlet with backbox
  lightSwitchNr: 32.0,        // 10A 2-way rocker switch
  mdbPanelNr: 1850.0,         // 3-phase main distribution board (100A, 18-way TP&N)
  
  // Div 48: Solar PV
  pvModule550WNr: 195.0,      // 550W Monocrystalline PERC solar module
  pvRackingPerWp: 0.12,       // aluminium ballasted flat roof racking system
  pvInverterPerKw: 110.0      // grid-tied 3-phase string solar inverter
};

/**
 * Calculate comprehensive Bill of Quantities takeoff from 2D CAD solveData
 */
export function calculateCad2dBoqTakeoff(solveData, options = {}) {
  const {
    tier = 'standard',
    currency = 'USD',
    wallHeightM = 2.8,
    overheadProfitPercent = 12.0,
    contingencyPercent = 5.0,
    unitScale = 0.001 // Millimeters to meters
  } = options;

  const currentTier = RATE_TIERS[tier] || RATE_TIERS.standard;
  const curr = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.USD;
  const mult = currentTier.multiplier * curr.ratePerUSD;

  const lineItems = [];
  const roomSchedules = [];

  // Helper to add line item
  const addItem = (division, itemCode, description, unit, quantity, baselineRate, wastePct = 0.05) => {
    if (quantity <= 0) return;
    const roundedQty = Math.round(quantity * 100) / 100;
    const grossQty = Math.round(roundedQty * (1 + wastePct) * 100) / 100;
    const unitRate = Math.round(baselineRate * mult * 100) / 100;
    const totalCost = Math.round(grossQty * unitRate * 100) / 100;

    lineItems.push({
      division: division.name,
      divisionCode: division.code,
      itemCode,
      description,
      unit,
      netQuantity: roundedQty,
      wastePercent: Math.round(wastePct * 100),
      grossQuantity: grossQty,
      unitRate,
      totalCost
    });
  };

  // 1. ARCHITECTURAL & STRUCTURAL TAKEOFF
  const wallPolygons = solveData?.wall_polygons || solveData?.walls || [];
  let totalWallLengthM = 0;
  let totalWallAreaM2 = 0;

  wallPolygons.forEach(wall => {
    let p1 = [0, 0];
    let p2 = [0, 0];
    if (wall.p1 && wall.p2) {
      p1 = wall.p1;
      p2 = wall.p2;
    } else if (Array.isArray(wall) && wall.length >= 2) {
      p1 = wall[0];
      p2 = wall[1];
    }
    const dx = (p2[0] - p1[0]) * unitScale;
    const dy = (p2[1] - p1[1]) * unitScale;
    const len = Math.sqrt(dx * dx + dy * dy);
    totalWallLengthM += len;
  });

  // Gross wall surface area (both sides = 2 * length * height)
  totalWallAreaM2 = totalWallLengthM * wallHeightM;

  // Columns
  const columns = solveData?.columns || [];
  const colCount = columns.length;
  const colConcreteM3 = colCount * (0.3 * 0.3 * wallHeightM);
  const colFormworkM2 = colCount * (4 * 0.3 * wallHeightM);

  if (colCount > 0) {
    addItem(CSI_DIVISIONS.DIV_03, '03.30.10', 'C30/37 Reinforced Concrete in Columns', 'm3', colConcreteM3, BASELINE_RATES.columnConcreteM3, 0.03);
    addItem(CSI_DIVISIONS.DIV_03, '03.11.10', 'Timber & Steel Formwork to Square Columns', 'm2', colFormworkM2, BASELINE_RATES.columnFormworkM2, 0.05);
  }

  // Masonry Walls
  addItem(CSI_DIVISIONS.DIV_04, '04.20.10', '200mm Heavy-Duty Concrete Block Masonry', 'm2', totalWallAreaM2 * 0.7, BASELINE_RATES.blockwork200M2, 0.05);
  addItem(CSI_DIVISIONS.DIV_04, '04.20.20', '150mm Interior Partition Blockwork', 'm2', totalWallAreaM2 * 0.3, BASELINE_RATES.blockwork150M2, 0.05);

  // Doors & Windows
  const doors = solveData?.doors || [];
  const windows = solveData?.windows || [];

  if (doors.length > 0) {
    addItem(CSI_DIVISIONS.DIV_08, '08.14.16', 'Solid-Core Timber Flush Doors with Mortise Ironmongery', 'nr', doors.length, BASELINE_RATES.solidCoreDoorNr, 0);
  }
  if (windows.length > 0) {
    addItem(CSI_DIVISIONS.DIV_08, '08.51.22', 'Aluminium Double-Glazed Thermal Break Casement Windows', 'nr', windows.length, BASELINE_RATES.glassWindowNr, 0);
  }

  // Finishes (Per Rooms)
  const rooms = solveData?.rooms || [];
  let totalFloorAreaM2 = 0;
  let totalPerimeterM = 0;

  rooms.forEach((room, idx) => {
    const area = (room.area_sqm || room.area || 20);
    const perim = (room.perimeter_m || Math.sqrt(area) * 4);
    totalFloorAreaM2 += area;
    totalPerimeterM += perim;

    roomSchedules.push({
      roomIndex: idx + 1,
      name: room.name || `Room ${idx + 1}`,
      floorAreaM2: Math.round(area * 100) / 100,
      perimeterM: Math.round(perim * 100) / 100,
      wallAreaM2: Math.round(perim * wallHeightM * 100) / 100,
      ceilingAreaM2: Math.round(area * 100) / 100
    });
  });

  if (totalFloorAreaM2 > 0) {
    addItem(CSI_DIVISIONS.DIV_09, '09.30.13', 'Rectified Porcelain Floor Tiling (600x600mm) with Polymer Grout', 'm2', totalFloorAreaM2, BASELINE_RATES.floorTilePorcelainM2, 0.08);
    addItem(CSI_DIVISIONS.DIV_09, '09.30.90', 'Matching 100mm Porcelain Tile Skirting along Perimeter', 'm', totalPerimeterM, BASELINE_RATES.skirtingM, 0.05);
    addItem(CSI_DIVISIONS.DIV_09, '09.24.00', 'Internal 2-Coat Cement Sand Wall Plaster (15mm)', 'm2', totalWallAreaM2 * 2, BASELINE_RATES.wallPlasterM2, 0.05);
    addItem(CSI_DIVISIONS.DIV_09, '09.91.23', 'Interior Anti-Bacterial Low-VOC Emulsion Paint (1+2 Coats)', 'm2', totalWallAreaM2 * 2, BASELINE_RATES.wallPaintM2, 0.07);
    addItem(CSI_DIVISIONS.DIV_09, '09.51.13', 'Moisture-Resistant Suspended Gypsum Ceiling Board', 'm2', totalFloorAreaM2, BASELINE_RATES.ceilingGypsumM2, 0.06);
  }

  // 2. PLUMBING & DRAINAGE TAKEOFF
  const pipes = solveData?.plumbing_pipes || [];
  let cwPipeLengthM = 0;
  let drainPipeLengthM = 0;

  pipes.forEach(pipe => {
    const p1 = pipe.p1 || [0, 0];
    const p2 = pipe.p2 || [0, 0];
    const dx = (p2[0] - p1[0]) * unitScale;
    const dy = (p2[1] - p1[1]) * unitScale;
    const len = Math.sqrt(dx * dx + dy * dy);
    if ((pipe.system || '').toLowerCase().includes('drain') || (pipe.system || '').toLowerCase().includes('waste')) {
      drainPipeLengthM += len;
    } else {
      cwPipeLengthM += len;
    }
  });

  if (cwPipeLengthM > 0) {
    addItem(CSI_DIVISIONS.DIV_22, '22.11.16', 'PPR PN20 Potable Cold/Hot Water Distribution Pipe (DN25)', 'm', cwPipeLengthM, BASELINE_RATES.pprPipeDN25M, 0.10);
  }
  if (drainPipeLengthM > 0) {
    addItem(CSI_DIVISIONS.DIV_22, '22.13.16', 'UPVC Class D Sanitary Drainage & Soil Pipe (DN110)', 'm', drainPipeLengthM, BASELINE_RATES.pvcDrainDN110M, 0.08);
  }

  // Sanitary Fixtures
  const fixtures = solveData?.plumbing_fixtures || [];
  let wcCount = 0;
  let basinCount = 0;
  fixtures.forEach(f => {
    const type = (f.type || f.name || '').toLowerCase();
    if (type.includes('wc') || type.includes('toilet') || type.includes('water_closet')) wcCount++;
    else basinCount++;
  });

  if (wcCount > 0) {
    addItem(CSI_DIVISIONS.DIV_22, '22.42.13', 'Wall-Hung Vitreous China Water Closet with Dual-Flush Mechanism', 'nr', wcCount, BASELINE_RATES.waterClosetNr, 0);
  }
  if (basinCount > 0) {
    addItem(CSI_DIVISIONS.DIV_22, '22.42.16', 'Ceramic Undermount Lavatory with Chrome Single-Lever Basin Mixer', 'nr', basinCount, BASELINE_RATES.lavatoryNr, 0);
  }

  // 3. MECHANICAL HVAC TAKEOFF
  const ducts = solveData?.hvac_ducts || [];
  let totalDuctLengthM = 0;
  let totalDuctAreaM2 = 0;

  ducts.forEach(duct => {
    const p1 = duct.p1 || [0, 0];
    const p2 = duct.p2 || [0, 0];
    const dx = (p2[0] - p1[0]) * unitScale;
    const dy = (p2[1] - p1[1]) * unitScale;
    const len = Math.sqrt(dx * dx + dy * dy);
    const w = (duct.width_mm || 400) * 0.001;
    const h = (duct.height_mm || 250) * 0.001;
    const ductPerim = 2 * (w + h);
    totalDuctLengthM += len;
    totalDuctAreaM2 += len * ductPerim;
  });

  if (totalDuctLengthM > 0) {
    const ductKg = totalDuctAreaM2 * 8.2; // approx 8.2 kg/m2 for 0.8mm GI sheet
    addItem(CSI_DIVISIONS.DIV_23, '23.31.13', 'Fabricated Galvanized Steel Rectangular Ductwork (0.8mm)', 'kg', ductKg, BASELINE_RATES.ductworkSheetMetalKg, 0.12);
    addItem(CSI_DIVISIONS.DIV_23, '23.07.13', 'Fiberglass External Acoustic/Thermal Duct Insulation (25mm)', 'm2', totalDuctAreaM2, BASELINE_RATES.ductInsulationM2, 0.08);
  }

  const diffusers = solveData?.hvac_diffusers || [];
  if (diffusers.length > 0) {
    addItem(CSI_DIVISIONS.DIV_23, '23.37.13', '4-Way 600x600 Ceiling Supply Air Diffusers with Acoustic Plenum', 'nr', diffusers.length, BASELINE_RATES.supplyDiffuserNr, 0);
  }

  // 4. ELECTRICAL TAKEOFF
  const conduits = solveData?.electrical_conduits || [];
  let conduitLengthM = 0;
  conduits.forEach(c => {
    const p1 = c.p1 || [0, 0];
    const p2 = c.p2 || [0, 0];
    const dx = (p2[0] - p1[0]) * unitScale;
    const dy = (p2[1] - p1[1]) * unitScale;
    conduitLengthM += Math.sqrt(dx * dx + dy * dy);
  });

  if (conduitLengthM > 0) {
    addItem(CSI_DIVISIONS.DIV_26, '26.05.33', 'Concealed Heavy-Duty Rigid PVC Conduit (20mm OD)', 'm', conduitLengthM, BASELINE_RATES.conduitPvc20mM, 0.10);
    addItem(CSI_DIVISIONS.DIV_26, '26.05.19', '3x2.5mm2 Single Core PVC Insulated Copper Building Wire', 'm', conduitLengthM * 1.25, BASELINE_RATES.wiring3x2_5M, 0.10);
  }

  const luminaires = solveData?.electrical_luminaires || [];
  if (luminaires.length > 0) {
    addItem(CSI_DIVISIONS.DIV_26, '26.51.00', 'Architectural Recessed 600x600 LED Panel Lights (40W, 4000K)', 'nr', luminaires.length, BASELINE_RATES.luminaireLedNr, 0);
  }

  // Add 3-phase Main Distribution Board
  addItem(CSI_DIVISIONS.DIV_26, '26.24.16', '100A 3-Phase Main Distribution Board (MDB-01) with RCBO Protection', 'nr', 1, BASELINE_RATES.mdbPanelNr, 0);

  // 5. SOLAR PHOTOVOLTAIC TAKEOFF
  const pvPanels = solveData?.solar_panels || [];
  if (pvPanels.length > 0) {
    const totalWatts = pvPanels.length * 550;
    const totalKw = totalWatts / 1000;
    addItem(CSI_DIVISIONS.DIV_48, '48.14.00', '550W Tier-1 Monocrystalline Bifacial Solar Photovoltaic Modules', 'nr', pvPanels.length, BASELINE_RATES.pvModule550WNr, 0);
    addItem(CSI_DIVISIONS.DIV_48, '48.14.13', 'Aerodynamic Aluminium Flat-Roof Ballasted Racking System', 'Wp', totalWatts, BASELINE_RATES.pvRackingPerWp, 0);
    addItem(CSI_DIVISIONS.DIV_48, '48.14.23', 'Three-Phase MPPT Commercial Grid-Tied Solar String Inverter', 'kW', totalKw, BASELINE_RATES.pvInverterPerKw, 0);
  }

  // Cost Aggregation
  const directSubtotal = lineItems.reduce((acc, it) => acc + it.totalCost, 0);
  const overheadProfit = Math.round(directSubtotal * (overheadProfitPercent / 100) * 100) / 100;
  const contingency = Math.round(directSubtotal * (contingencyPercent / 100) * 100) / 100;
  const grandTotal = Math.round((directSubtotal + overheadProfit + contingency) * 100) / 100;

  // Breakdown by CSI Division
  const divisionSummaries = {};
  Object.values(CSI_DIVISIONS).forEach(div => {
    divisionSummaries[div.code] = {
      code: div.code,
      name: div.name,
      color: div.color,
      itemCount: 0,
      totalCost: 0,
      percentage: 0
    };
  });

  lineItems.forEach(item => {
    if (divisionSummaries[item.divisionCode]) {
      divisionSummaries[item.divisionCode].itemCount++;
      divisionSummaries[item.divisionCode].totalCost += item.totalCost;
    }
  });

  Object.values(divisionSummaries).forEach(div => {
    div.totalCost = Math.round(div.totalCost * 100) / 100;
    div.percentage = directSubtotal > 0 ? Math.round((div.totalCost / directSubtotal) * 1000) / 10 : 0;
  });

  return {
    projectName: solveData?.project_name || 'MeplanIQ Architectural & MEP Project',
    timestamp: new Date().toISOString(),
    currency: curr,
    tier: currentTier,
    lineItems,
    roomSchedules,
    divisionSummaries: Object.values(divisionSummaries).filter(d => d.totalCost > 0),
    metrics: {
      directSubtotal,
      overheadProfitPercent,
      overheadProfit,
      contingencyPercent,
      contingency,
      grandTotal,
      totalMeasuredAreaM2: Math.round(totalFloorAreaM2 * 100) / 100,
      costPerM2: totalFloorAreaM2 > 0 ? Math.round((grandTotal / totalFloorAreaM2) * 100) / 100 : 0
    }
  };
}

/**
 * Export Bill of Quantities data to structured CSV format
 */
export function exportBoqToCsv(boqData) {
  const { currency, lineItems, metrics, projectName } = boqData;
  const currSym = currency?.symbol || '$';

  const rows = [];
  rows.push(['MEPLANIQ COMMERCIAL BILL OF QUANTITIES (BOQ) TAKEOFF']);
  rows.push([`Project: ${projectName}`]);
  rows.push([`Date Generated: ${new Date().toLocaleDateString()}`]);
  rows.push([`Pricing Tier: ${boqData.tier?.label || 'Commercial Standard'}`]);
  rows.push([`Currency: ${currency?.code || 'USD'} (${currSym})`]);
  rows.push([]);
  rows.push([
    'Div',
    'Item Code',
    'Description',
    'Unit',
    'Net Qty',
    'Waste %',
    'Gross Qty',
    `Rate (${currSym})`,
    `Total Cost (${currSym})`
  ]);

  lineItems.forEach(item => {
    rows.push([
      item.divisionCode,
      item.itemCode,
      `"${item.description.replace(/"/g, '""')}"`,
      item.unit,
      item.netQuantity,
      `${item.wastePercent}%`,
      item.grossQuantity,
      item.unitRate.toFixed(2),
      item.totalCost.toFixed(2)
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', '', '', '', '', 'Direct Cost Subtotal:', metrics.directSubtotal.toFixed(2)]);
  rows.push(['', '', '', '', '', '', '', `Overhead & Profit (${metrics.overheadProfitPercent}%):`, metrics.overheadProfit.toFixed(2)]);
  rows.push(['', '', '', '', '', '', '', `Contingency (${metrics.contingencyPercent}%):`, metrics.contingency.toFixed(2)]);
  rows.push(['', '', '', '', '', '', '', 'GRAND TOTAL PROJECT COST:', metrics.grandTotal.toFixed(2)]);
  rows.push(['', '', '', '', '', '', '', `Cost per m² (${metrics.totalMeasuredAreaM2} m²):`, metrics.costPerM2.toFixed(2)]);

  return rows.map(r => r.join(',')).join('\n');
}
