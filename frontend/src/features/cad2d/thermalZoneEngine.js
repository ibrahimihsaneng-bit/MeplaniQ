/**
 * frontend/src/features/cad2d/thermalZoneEngine.js
 * =================================================
 * Commercial-Grade Building Physics & 2D Thermal Zone Modeling Engine.
 * Implements ASHRAE Fundamentals / ISO 52016-1 steady-state and peak load
 * heat balance calculations for architectural 2D floorplan space boundaries.
 * 
 * Computes:
 * - Directional solar radiation exposure (N, S, E, W perimeter vs core)
 * - Conduction heat transfer through exterior envelope walls and fenestration
 * - Internal sensible & latent heat gains (occupancy, lighting LPD, equipment EPD)
 * - Peak summer cooling load (kW, BTU/h, CFM) & winter design heating load
 * - 2D CAD visual heatmap color-coding and zone boundary polylines
 */

export const CLIMATE_ZONES = {
  ZONE_1: {
    id: 'ZONE_1',
    name: 'Zone 1: Very Hot & Humid (Miami / Gulf / Equator)',
    summerToutC: 38.0,
    winterToutC: 12.0,
    solarPeakWm2: 850
  },
  ZONE_2: {
    id: 'ZONE_2',
    name: 'Zone 2: Hot & Humid (Houston / Phoenix)',
    summerToutC: 36.0,
    winterToutC: 5.0,
    solarPeakWm2: 800
  },
  ZONE_3: {
    id: 'ZONE_3',
    name: 'Zone 3: Warm & Temperate (Atlanta / Los Angeles / Sydney)',
    summerToutC: 33.0,
    winterToutC: 0.0,
    solarPeakWm2: 750
  },
  ZONE_4: {
    id: 'ZONE_4',
    name: 'Zone 4: Mixed & Continental (New York / London / Tokyo)',
    summerToutC: 31.0,
    winterToutC: -8.0,
    solarPeakWm2: 700
  },
  ZONE_5: {
    id: 'ZONE_5',
    name: 'Zone 5: Cold & Subarctic (Chicago / Toronto / Berlin)',
    summerToutC: 29.0,
    winterToutC: -18.0,
    solarPeakWm2: 650
  }
};

export const ENVELOPE_STANDARDS = {
  ASHRAE_90_1_2019: {
    id: 'ASHRAE_90_1_2019',
    name: 'ASHRAE 90.1-2019 High Performance',
    wallUValue: 0.28,      // W/(m²·K)
    windowUValue: 1.45,    // W/(m²·K) Double Low-E Argon
    windowShgc: 0.35,      // Solar Heat Gain Coefficient
    roofUValue: 0.16,      // W/(m²·K)
    infiltrationAch: 0.25  // Air Changes / Hour
  },
  STANDARD_COMMERCIAL: {
    id: 'STANDARD_COMMERCIAL',
    name: 'Standard Commercial Code (IECC Baseline)',
    wallUValue: 0.45,
    windowUValue: 2.40,
    windowShgc: 0.50,
    roofUValue: 0.25,
    infiltrationAch: 0.40
  },
  UNINSULATED_LEGACY: {
    id: 'UNINSULATED_LEGACY',
    name: 'Legacy Uninsulated Masonry',
    wallUValue: 1.65,
    windowUValue: 5.20,    // Single pane clear
    windowShgc: 0.82,
    roofUValue: 0.70,
    infiltrationAch: 0.80
  }
};

export const SPACE_THERMAL_PROFILES = {
  LIVING: {
    type: 'LIVING',
    name: 'Living & Dining Area',
    occupantDensityM2PerPerson: 10.0,
    sensibleHeatPerPersonW: 75,
    latentHeatPerPersonW: 55,
    lpdWm2: 7.0,   // Lighting Power Density
    epdWm2: 8.0,   // Equipment Power Density
    coolingSetpointC: 23.0,
    heatingSetpointC: 21.0
  },
  BEDROOM: {
    type: 'BEDROOM',
    name: 'Bedroom Suite',
    occupantDensityM2PerPerson: 15.0,
    sensibleHeatPerPersonW: 70,
    latentHeatPerPersonW: 45,
    lpdWm2: 5.0,
    epdWm2: 5.0,
    coolingSetpointC: 22.0,
    heatingSetpointC: 21.0
  },
  KITCHEN: {
    type: 'KITCHEN',
    name: 'Kitchen / Cooking Area',
    occupantDensityM2PerPerson: 8.0,
    sensibleHeatPerPersonW: 90,
    latentHeatPerPersonW: 95,
    lpdWm2: 10.0,
    epdWm2: 35.0, // Cooking appliance thermal load
    coolingSetpointC: 23.0,
    heatingSetpointC: 20.0
  },
  OFFICE: {
    type: 'OFFICE',
    name: 'Commercial Office Space',
    occupantDensityM2PerPerson: 9.0,
    sensibleHeatPerPersonW: 75,
    latentHeatPerPersonW: 55,
    lpdWm2: 8.5,
    epdWm2: 15.0, // Workstations, monitors, printers
    coolingSetpointC: 22.5,
    heatingSetpointC: 21.0
  },
  BATHROOM: {
    type: 'BATHROOM',
    name: 'Toilet / Restroom (Plumbing Core)',
    occupantDensityM2PerPerson: 25.0,
    sensibleHeatPerPersonW: 70,
    latentHeatPerPersonW: 40,
    lpdWm2: 6.0,
    epdWm2: 2.0,
    coolingSetpointC: 24.0,
    heatingSetpointC: 20.0
  },
  CORRIDOR: {
    type: 'CORRIDOR',
    name: 'Corridor / Public Circulation',
    occupantDensityM2PerPerson: 30.0,
    sensibleHeatPerPersonW: 75,
    latentHeatPerPersonW: 55,
    lpdWm2: 4.0,
    epdWm2: 1.0,
    coolingSetpointC: 25.0,
    heatingSetpointC: 19.0
  },
  DEFAULT: {
    type: 'DEFAULT',
    name: 'General Space',
    occupantDensityM2PerPerson: 12.0,
    sensibleHeatPerPersonW: 75,
    latentHeatPerPersonW: 55,
    lpdWm2: 7.5,
    epdWm2: 10.0,
    coolingSetpointC: 23.0,
    heatingSetpointC: 21.0
  }
};

/**
 * Classify room polygon edges into directional orientations (N, S, E, W)
 * and determine exposed exterior wall vs internal partition length.
 */
export function analyzeSpaceBoundaries(roomPoints, overallBounds, wallThicknessMm = 200) {
  if (!roomPoints || roomPoints.length < 3) {
    return {
      perimeterMm: 0,
      exposedLengthMm: 0,
      internalLengthMm: 0,
      orientationBreakdown: { North: 0, South: 0, East: 0, West: 0 },
      isPerimeter: false,
      primaryOrientation: 'CORE'
    };
  }

  let totalPerimeter = 0;
  let exposedLength = 0;
  const orientationLengths = { North: 0, South: 0, East: 0, West: 0 };

  const n = roomPoints.length;
  const margin = wallThicknessMm * 2.5;

  for (let i = 0; i < n; i++) {
    const p1 = roomPoints[i];
    const p2 = roomPoints[(i + 1) % n];
    const x1 = Array.isArray(p1) ? p1[0] : p1.x;
    const y1 = Array.isArray(p1) ? p1[1] : p1.y;
    const x2 = Array.isArray(p2) ? p2[0] : p2.x;
    const y2 = Array.isArray(p2) ? p2[1] : p2.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLen = Math.hypot(dx, dy);
    totalPerimeter += segLen;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Check if edge is on outer perimeter of overall floorplan
    const isExposed = (
      Math.abs(midX - overallBounds.minX) < margin ||
      Math.abs(midX - overallBounds.maxX) < margin ||
      Math.abs(midY - overallBounds.minY) < margin ||
      Math.abs(midY - overallBounds.maxY) < margin
    );

    if (isExposed) {
      exposedLength += segLen;
      // Determine orientation of exposed wall based on outer normal
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal wall: checks if top (North) or bottom (South)
        if (midY > (overallBounds.minY + overallBounds.maxY) / 2) {
          orientationLengths.North += segLen;
        } else {
          orientationLengths.South += segLen;
        }
      } else {
        // Vertical wall: checks if right (East) or left (West)
        if (midX > (overallBounds.minX + overallBounds.maxX) / 2) {
          orientationLengths.East += segLen;
        } else {
          orientationLengths.West += segLen;
        }
      }
    }
  }

  // Determine dominant orientation
  let primaryOrientation = 'CORE';
  let maxOrientationLen = 0;
  for (const [dir, len] of Object.entries(orientationLengths)) {
    if (len > maxOrientationLen) {
      maxOrientationLen = len;
      primaryOrientation = dir;
    }
  }

  const isPerimeter = exposedLength > 0.15 * totalPerimeter;
  if (!isPerimeter) {
    primaryOrientation = 'CORE';
  }

  return {
    perimeterMm: Math.round(totalPerimeter),
    perimeterM: totalPerimeter / 1000,
    exposedLengthMm: Math.round(exposedLength),
    exposedLengthM: exposedLength / 1000,
    internalLengthM: (totalPerimeter - exposedLength) / 1000,
    orientationBreakdown: orientationLengths,
    isPerimeter,
    primaryOrientation
  };
}

/**
 * Calculate peak cooling and heating thermal loads for a room zone.
 */
export function calculateRoomThermalZone(room, overallBounds, options = {}) {
  const {
    climate = CLIMATE_ZONES.ZONE_3,
    envelope = ENVELOPE_STANDARDS.ASHRAE_90_1_2019,
    ceilingHeightM = 2.8,
    glazingRatio = 0.25 // 25% window-to-wall ratio on exposed walls
  } = options;

  const pts = room.filleted_points || room.points || [];
  const roomName = (room.name || 'Room').trim();
  const roomTypeClean = (room.room_type || room.type || '').toUpperCase();
  const profile = SPACE_THERMAL_PROFILES[roomTypeClean] ||
    Object.values(SPACE_THERMAL_PROFILES).find(p => roomName.toUpperCase().includes(p.type)) ||
    SPACE_THERMAL_PROFILES.DEFAULT;

  const areaM2 = Number(room.area_m2 || 0) || 15.0;
  const volumeM3 = areaM2 * ceilingHeightM;

  // Boundary analysis
  const boundary = analyzeSpaceBoundaries(pts, overallBounds);

  // 1. Envelope Conduction & Solar Load (Summer Peak)
  const TinCool = profile.coolingSetpointC;
  const deltaTCool = Math.max(0, climate.summerToutC - TinCool);

  const exposedWallGrossM2 = boundary.exposedLengthM * ceilingHeightM;
  const windowAreaM2 = boundary.isPerimeter ? exposedWallGrossM2 * glazingRatio : 0;
  const netWallAreaM2 = Math.max(0, exposedWallGrossM2 - windowAreaM2);

  // Wall Conduction (Q = U * A * ΔT)
  const qWallCond = netWallAreaM2 * envelope.wallUValue * deltaTCool;

  // Window Conduction (Q = U * A * ΔT)
  const qWindowCond = windowAreaM2 * envelope.windowUValue * deltaTCool;

  // Window Solar Gain (Q = A * SHGC * SolarFlux * OrientationFactor)
  const orientationSolarMultiplier = {
    South: 0.85,
    West: 1.00, // Peak late-afternoon solar load
    East: 0.70,
    North: 0.35,
    CORE: 0.0
  }[boundary.primaryOrientation] || 0.50;

  const qWindowSolar = windowAreaM2 * envelope.windowShgc * (climate.solarPeakWm2 * orientationSolarMultiplier);

  // 2. Infiltration sensible load (Q = 1.2 * InfiltrationM3/s * 1005 * ΔT)
  const infiltrationM3s = (volumeM3 * envelope.infiltrationAch) / 3600.0;
  const qInfiltrationSensible = 1.2 * infiltrationM3s * 1005 * deltaTCool;

  // 3. Internal Heat Gains
  const occupants = Math.max(1, Math.round(areaM2 / profile.occupantDensityM2PerPerson));
  const qPeopleSensible = occupants * profile.sensibleHeatPerPersonW;
  const qPeopleLatent = occupants * profile.latentHeatPerPersonW;
  const qLighting = areaM2 * profile.lpdWm2;
  const qEquipment = areaM2 * profile.epdWm2;

  // Total Sensible & Latent Heat
  const totalSensibleW = Math.round(qWallCond + qWindowCond + qWindowSolar + qInfiltrationSensible + qPeopleSensible + qLighting + qEquipment);
  const totalLatentW = Math.round(qPeopleLatent);
  const totalCoolingW = totalSensibleW + totalLatentW;
  const totalCoolingKw = Number((totalCoolingW / 1000).toFixed(2));
  const totalCoolingBtu = Math.round(totalCoolingW * 3.412142); // 1 W = 3.412 BTU/h
  const totalCoolingTons = Number((totalCoolingBtu / 12000).toFixed(2)); // 1 Ton = 12,000 BTU/h

  // Required Supply Airflow (CFM @ 12.5°C supply air temperature differential ΔT = 10.5 K)
  // CFM = Q_sensible_BTU / (1.08 * ΔT_F)
  const deltaTF = deltaTCool * 1.8;
  const qSensibleBtu = totalSensibleW * 3.412142;
  const requiredAirflowCfm = Math.max(50, Math.round(qSensibleBtu / (1.08 * Math.max(18, deltaTF))));

  // Winter Heating Load (Conduction + Infiltration at Winter Design ΔT)
  const TinHeat = profile.heatingSetpointC;
  const deltaTHeat = Math.max(0, TinHeat - climate.winterToutC);
  const qWallHeat = netWallAreaM2 * envelope.wallUValue * deltaTHeat;
  const qWindowHeat = windowAreaM2 * envelope.windowUValue * deltaTHeat;
  const qInfHeat = 1.2 * infiltrationM3s * 1005 * deltaTHeat;
  const totalHeatingW = Math.round(qWallHeat + qWindowHeat + qInfHeat);
  const totalHeatingKw = Number((totalHeatingW / 1000).toFixed(2));

  // Thermal Load Density (W/m²)
  const loadDensityWm2 = areaM2 > 0 ? Math.round(totalCoolingW / areaM2) : 0;

  // Visual Heatmap Classification & Colors
  let heatColor = '#38BDF8';
  let heatFill = 'rgba(56, 189, 248, 0.22)';
  let heatBadge = 'LOW LOAD';
  let zoneClassification = 'CORE INTERIOR';

  if (loadDensityWm2 > 130) {
    heatColor = '#EF4444';
    heatFill = 'rgba(239, 68, 68, 0.35)';
    heatBadge = 'CRITICAL PEAK';
  } else if (loadDensityWm2 > 100) {
    heatColor = '#F59E0B';
    heatFill = 'rgba(245, 158, 11, 0.30)';
    heatBadge = 'HIGH LOAD';
  } else if (loadDensityWm2 > 70) {
    heatColor = '#10B981';
    heatFill = 'rgba(16, 185, 129, 0.26)';
    heatBadge = 'MODERATE';
  }

  if (boundary.isPerimeter) {
    zoneClassification = `${boundary.primaryOrientation} PERIMETER`;
  }

  return {
    roomId: room.id || room.name,
    roomName,
    roomType: profile.name,
    points: pts,
    centroid: room.centroid || [0, 0],
    areaM2: Number(areaM2.toFixed(1)),
    ceilingHeightM,
    volumeM3: Math.round(volumeM3),
    boundary,
    zoneClassification,
    occupants,
    // Cooling metrics
    totalCoolingW,
    totalCoolingKw,
    totalCoolingBtu,
    totalCoolingTons,
    requiredAirflowCfm,
    loadDensityWm2,
    breakdownCooling: {
      wallCondW: Math.round(qWallCond),
      windowCondW: Math.round(qWindowCond),
      windowSolarW: Math.round(qWindowSolar),
      infiltrationW: Math.round(qInfiltrationSensible),
      peopleSensibleW: Math.round(qPeopleSensible),
      peopleLatentW: Math.round(qPeopleLatent),
      lightingW: Math.round(qLighting),
      equipmentW: Math.round(qEquipment)
    },
    // Heating metrics
    totalHeatingW,
    totalHeatingKw,
    // Visual presentation
    heatColor,
    heatFill,
    heatBadge
  };
}

/**
 * Solve thermal zones for all rooms in a 2D floorplan model.
 */
export function compileFloorplanThermalZones(solveData, options = {}) {
  const rooms = solveData?.rooms || [];
  if (rooms.length === 0) {
    return {
      zones: [],
      totals: {
        totalCoolingKw: 0,
        totalHeatingKw: 0,
        totalCoolingBtu: 0,
        totalCoolingTons: 0,
        totalAirflowCfm: 0,
        avgLoadDensityWm2: 0,
        totalFloorAreaM2: 0,
        roomCount: 0
      }
    };
  }

  // Calculate overall floorplan bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rooms.forEach(r => {
    const pts = r.filleted_points || r.points || [];
    pts.forEach(p => {
      const x = Array.isArray(p) ? p[0] : p.x;
      const y = Array.isArray(p) ? p[1] : p.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
  });

  const overallBounds = {
    minX: isFinite(minX) ? minX : 0,
    minY: isFinite(minY) ? minY : 0,
    maxX: isFinite(maxX) ? maxX : 10000,
    maxY: isFinite(maxY) ? maxY : 8000
  };

  const zones = rooms.map(r => calculateRoomThermalZone(r, overallBounds, options));

  // Compute building totals
  let totalCoolingW = 0;
  let totalHeatingW = 0;
  let totalAirflowCfm = 0;
  let totalFloorAreaM2 = 0;

  zones.forEach(z => {
    totalCoolingW += z.totalCoolingW;
    totalHeatingW += z.totalHeatingW;
    totalAirflowCfm += z.requiredAirflowCfm;
    totalFloorAreaM2 += z.areaM2;
  });

  const totalCoolingKw = Number((totalCoolingW / 1000).toFixed(1));
  const totalHeatingKw = Number((totalHeatingW / 1000).toFixed(1));
  const totalCoolingBtu = Math.round(totalCoolingW * 3.412142);
  const totalCoolingTons = Number((totalCoolingBtu / 12000).toFixed(2));
  const avgLoadDensityWm2 = totalFloorAreaM2 > 0 ? Math.round(totalCoolingW / totalFloorAreaM2) : 0;

  return {
    zones,
    overallBounds,
    totals: {
      totalCoolingKw,
      totalHeatingKw,
      totalCoolingBtu,
      totalCoolingTons,
      totalAirflowCfm,
      avgLoadDensityWm2,
      totalFloorAreaM2: Number(totalFloorAreaM2.toFixed(1)),
      roomCount: rooms.length
    }
  };
}
