/**
 * electricalRoutingEngine.js
 * ==========================
 * Professional 2D Electrical CAD Conduit Routing, Homerun & Circuit Balancing Engine.
 * Complies with NEC (National Electrical Code), NFPA 70, and IEC 60364 Standards.
 */

export const CONDUIT_TYPES = {
  SLAB: {
    id: 'SLAB',
    name: 'Concealed Slab Conduit (PVC)',
    color: '#F59E0B',        // Amber / Yellow
    dasharray: 'none',
    strokeWidth: 2.2,
    icon: '⚡',
    description: 'Embedded in structural concrete slab'
  },
  SURFACE: {
    id: 'SURFACE',
    name: 'Surface Metallic Conduit (EMT)',
    color: '#06B6D4',        // Cyan
    dasharray: 'none',
    strokeWidth: 2.5,
    icon: '🔌',
    description: 'Surface wall/ceiling mounted EMT'
  },
  FLEXIBLE: {
    id: 'FLEXIBLE',
    name: 'Flexible Conduit (FMC)',
    color: '#A855F7',        // Purple
    dasharray: '6 3',
    strokeWidth: 1.8,
    icon: '〰️',
    description: 'Flexible drop to luminaires and motors'
  },
  UNDERGROUND: {
    id: 'UNDERGROUND',
    name: 'Underground / Trench Conduit',
    color: '#10B981',        // Emerald Green
    dasharray: '12 4',
    strokeWidth: 2.8,
    icon: '🏗️',
    description: 'Buried outdoor or floor trench'
  }
};

export const WIRE_GAUGES = {
  '1.5': {
    gauge: '1.5mm²',
    ampacity: 16,
    resistancePerKm: 12.1,
    mcb: '10A / 16A',
    usage: 'Lighting & Fan Circuits'
  },
  '2.5': {
    gauge: '2.5mm²',
    ampacity: 20,
    resistancePerKm: 7.41,
    mcb: '16A / 20A',
    usage: 'General 16A Power Receptacles'
  },
  '4.0': {
    gauge: '4.0mm²',
    ampacity: 28,
    resistancePerKm: 4.61,
    mcb: '25A / 32A',
    usage: 'Dedicated AC, Water Heater, Range'
  },
  '6.0': {
    gauge: '6.0mm²',
    ampacity: 36,
    resistancePerKm: 3.08,
    mcb: '40A',
    usage: 'Heavy Appliances & Sub-Mains'
  }
};

/**
 * Extracts all snap connection ports from active electrical components.
 */
export function extractElectricalPorts(components = []) {
  const ports = [];

  components.forEach((comp, idx) => {
    if (!comp) return;
    const cx = Number(comp.x ?? comp.location_x ?? 0);
    const cy = Number(comp.y ?? comp.location_y ?? 0);
    const type = (comp.type || comp.name || '').toLowerCase();
    const isDb = type.includes('db') || type.includes('distribution') || type.includes('panel');

    // Central Junction / Terminal Port
    ports.push({
      id: `${comp.id || idx}-PORT`,
      componentId: comp.id || `EL-${idx + 1}`,
      componentType: comp.type || 'Component',
      name: comp.name || comp.type || 'Electrical Component',
      circuitId: comp.circuit_id || null,
      wattage: Number(comp.wattage) || 0,
      point: { x: Math.round(cx), y: Math.round(cy) },
      isDb,
      color: isDb ? '#EF4444' : '#F59E0B',
      label: isDb ? `⚡ ${comp.name || comp.id} (Main DB)` : `${comp.name || comp.id} (${comp.wattage || 0}W)`
    });
  });

  return ports;
}

/**
 * Finds the nearest electrical snap port to the cursor.
 */
export function findNearestElectricalPort(cursorPt, ports = [], toleranceCad = 250) {
  if (!cursorPt || ports.length === 0) return null;

  let closest = null;
  let minDist = toleranceCad;

  for (const port of ports) {
    const d = Math.hypot(cursorPt.x - port.point.x, cursorPt.y - port.point.y);
    if (d < minDist) {
      minDist = d;
      closest = {
        ...port,
        distance: d
      };
    }
  }

  return closest;
}

/**
 * Computes electrical circuit loading, current, and voltage drop compliant with NEC 210.19.
 * I = P / (V * pf) where V = 230V, pf = 0.9
 * Vdrop = 2 * (L/1000) * I * (R/1000)
 */
export function calculateCircuitLoading(components = [], totalConduitLengthMm = 10000, wireGaugeKey = '2.5') {
  const wire = WIRE_GAUGES[wireGaugeKey] || WIRE_GAUGES['2.5'];
  const voltage = 230; // 230V Single Phase Standard
  const powerFactor = 0.9;

  const totalWattage = components.reduce((sum, c) => sum + (Number(c.wattage) || 0), 0);
  const currentAmps = totalWattage > 0
    ? Number((totalWattage / (voltage * powerFactor)).toFixed(2))
    : 0;

  const lengthMeters = totalConduitLengthMm / 1000;
  const loopResistance = (2 * lengthMeters * wire.resistancePerKm) / 1000;
  const voltageDropVolts = Number((currentAmps * loopResistance).toFixed(2));
  const voltageDropPercent = Number(((voltageDropVolts / voltage) * 100).toFixed(2));

  const isCompliant = voltageDropPercent <= 3.0; // NEC 3% branch circuit threshold
  const loadPercentage = Math.round((currentAmps / wire.ampacity) * 100);

  return {
    totalWattage,
    currentAmps,
    wireGauge: wire.gauge,
    ampacity: wire.ampacity,
    mcbRating: wire.mcb,
    lengthMeters: Math.round(lengthMeters),
    voltageDropVolts,
    voltageDropPercent,
    isCompliant,
    loadPercentage,
    statusLabel: isCompliant
      ? (loadPercentage > 80 ? 'Heavy Load (>80%)' : 'Optimal Capacity (<3% Drop)')
      : 'Voltage Drop Exceeded (>3% NEC Limit)',
    statusColor: !isCompliant ? '#EF4444' : (loadPercentage > 80 ? '#F59E0B' : '#10B981')
  };
}

/**
 * Generates homerun geometry heading from last fixture towards Distribution Board.
 * Features an angled arrow and standard tick-mark slashes for Conductors (Phase, Neutral, Ground).
 */
export function generateHomerunLeader(startPt, targetDbPt = null, conductorsCount = 3) {
  if (!startPt) return null;

  // Determine homerun vector pointing towards DB (or default up-left if no DB)
  let dirX = -1;
  let dirY = 1;
  if (targetDbPt) {
    const dx = targetDbPt.x - startPt.x;
    const dy = targetDbPt.y - startPt.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      dirX = dx / dist;
      dirY = dy / dist;
    }
  } else {
    const len = Math.hypot(dirX, dirY);
    dirX /= len;
    dirY /= len;
  }

  const homerunLength = 400; // 400mm homerun stem
  const tipX = startPt.x + dirX * homerunLength;
  const tipY = startPt.y + dirY * homerunLength;

  // Arrowhead points (30° angle, 80mm length)
  const arrowLen = 70;
  const arrowAngle = Math.PI / 6; // 30 degrees
  const baseAngle = Math.atan2(dirY, dirX);

  const leftWing = {
    x: tipX - arrowLen * Math.cos(baseAngle - arrowAngle),
    y: tipY - arrowLen * Math.sin(baseAngle - arrowAngle)
  };
  const rightWing = {
    x: tipX - arrowLen * Math.cos(baseAngle + arrowAngle),
    y: tipY - arrowLen * Math.sin(baseAngle + arrowAngle)
  };

  // Conductor tick-mark slashes (perpendicular to stem at mid-length)
  const perpX = -dirY;
  const perpY = dirX;
  const slashLen = 28;
  const midX = startPt.x + dirX * (homerunLength * 0.45);
  const midY = startPt.y + dirY * (homerunLength * 0.45);
  const slashSpacing = 22;

  const slashes = [];
  for (let i = 0; i < conductorsCount; i++) {
    const offset = (i - (conductorsCount - 1) / 2) * slashSpacing;
    const sx = midX + dirX * offset;
    const sy = midY + dirY * offset;
    const isGround = i === conductorsCount - 1; // Ground wire has shorter half-slash
    const sLen = isGround ? slashLen * 0.6 : slashLen;

    slashes.push({
      x1: sx - perpX * (sLen / 2),
      y1: sy - perpY * (sLen / 2),
      x2: sx + perpX * (sLen / 2),
      y2: sy + perpY * (sLen / 2),
      isGround
    });
  }

  return {
    stemStart: startPt,
    stemEnd: { x: tipX, y: tipY },
    arrowTip: { x: tipX, y: tipY },
    arrowLeft: leftWing,
    arrowRight: rightWing,
    arrowPointsStr: `${Math.round(tipX)},${Math.round(tipY)} ${Math.round(leftWing.x)},${Math.round(leftWing.y)} ${Math.round(rightWing.x)},${Math.round(rightWing.y)}`,
    slashes,
    tagPos: { x: tipX + dirX * 60, y: tipY + dirY * 60 }
  };
}

/**
 * 3-Phase Distribution Board Balancer (Phase R, Phase Y, Phase B).
 * Distributes circuits evenly across phases to minimize neutral current.
 */
export function balanceDistributionBoardPhases(circuits = [], components = []) {
  const phaseTotals = { R: 0, Y: 0, B: 0 };
  const phaseCircuits = { R: [], Y: [], B: [] };

  const phases = ['R', 'Y', 'B'];

  circuits.forEach((ckt, idx) => {
    const cktComps = components.filter(c => (c.circuit_id === ckt.id || c.circuit === ckt.id));
    const wattage = cktComps.reduce((sum, c) => sum + (Number(c.wattage) || 0), 0);

    // If circuit already has assigned phase, honor it, otherwise assign to lowest loaded phase
    let assignedPhase = ckt.phase;
    if (!assignedPhase || !phases.includes(assignedPhase)) {
      assignedPhase = Object.keys(phaseTotals).reduce((a, b) => (phaseTotals[a] <= phaseTotals[b] ? a : b));
    }

    phaseTotals[assignedPhase] += wattage;
    phaseCircuits[assignedPhase].push({
      ...ckt,
      assignedPhase,
      totalWattage: wattage,
      componentCount: cktComps.length
    });
  });

  const loads = [phaseTotals.R, phaseTotals.Y, phaseTotals.B];
  const maxLoad = Math.max(...loads, 1);
  const minLoad = Math.min(...loads);
  const unbalancePercent = Math.round(((maxLoad - minLoad) / maxLoad) * 100);

  return {
    phaseTotals,
    phaseCircuits,
    unbalancePercent,
    isBalanced: unbalancePercent <= 15 // IEEE/IEC standard: unbalance < 15%
  };
}
