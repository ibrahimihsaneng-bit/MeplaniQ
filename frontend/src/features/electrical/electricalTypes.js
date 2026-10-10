/**
 * frontend/src/features/electrical/electricalTypes.js
 * ==================================================
 * Master Fixture Catalog, Circuit Specifications, and Drawing Styles
 * for meplaniq Electrical Layout & Routing System.
 */

export const ELECTRICAL_CATEGORIES = {
  lighting: { label: "Lighting", icon: "💡", color: "#F59E0B" },
  ventilation: { label: "Fans & Vent", icon: "🌀", color: "#06B6D4" },
  switch: { label: "Switches & Controls", icon: "🎛️", color: "#3B82F6" },
  distribution: { label: "Distribution Boards", icon: "⚡", color: "#EF4444" },
  power: { label: "Power & Radials", icon: "🔌", color: "#10B981" }
};

export const ELECTRICAL_FIXTURES = {
  // 1. LIGHTING
  recessed_downlight: {
    type: "recessed_downlight",
    label: "Recessed Downlight",
    category: "lighting",
    mounting: "ceiling",
    defaultWattage: 12,
    width: 200,
    height: 200,
    symbol: "circle_cross",
    prefix: "DL",
    color: "#F59E0B",
    icon: "🔅"
  },
  linear_tube_light: {
    type: "linear_tube_light",
    label: "Linear Tube Light",
    category: "lighting",
    mounting: "ceiling",
    defaultWattage: 20,
    width: 1200,
    height: 100,
    symbol: "linear_tube",
    prefix: "TL",
    color: "#FBBF24",
    icon: "━"
  },
  wall_sconce: {
    type: "wall_sconce",
    label: "Wall Sconce",
    category: "lighting",
    mounting: "wall",
    defaultWattage: 10,
    width: 150,
    height: 120,
    symbol: "semicircle_rays",
    prefix: "WS",
    color: "#F59E0B",
    icon: "🏮"
  },
  chandelier: {
    type: "chandelier",
    label: "Chandelier",
    category: "lighting",
    mounting: "ceiling",
    defaultWattage: 60,
    width: 600,
    height: 600,
    symbol: "chandelier_cluster",
    prefix: "CH",
    color: "#F59E0B",
    icon: "✨"
  },
  outdoor_bulkhead: {
    type: "outdoor_bulkhead",
    label: "Bulkhead Light",
    category: "lighting",
    mounting: "wall",
    defaultWattage: 15,
    width: 220,
    height: 150,
    symbol: "bulkhead_oval",
    prefix: "OB",
    color: "#F59E0B",
    icon: "💡"
  },

  // 2. FANS & VENTILATION
  ceiling_fan: {
    type: "ceiling_fan",
    label: "Ceiling Fan",
    category: "ventilation",
    mounting: "ceiling",
    defaultWattage: 75,
    width: 1200,
    height: 1200,
    symbol: "three_blade_fan",
    prefix: "FAN",
    color: "#06B6D4",
    icon: "🌀"
  },
  exhaust_fan: {
    type: "exhaust_fan",
    label: "Exhaust Fan",
    category: "ventilation",
    mounting: "wall",
    defaultWattage: 40,
    width: 300,
    height: 300,
    symbol: "exhaust_box",
    prefix: "EF",
    color: "#06B6D4",
    icon: "💨"
  },

  // 3. SWITCHES & CONTROLS
  single_switch: {
    type: "single_switch",
    label: "Single Switch",
    category: "switch",
    mounting: "wall",
    defaultWattage: 0,
    width: 100,
    height: 100,
    symbol: "switch_rocker",
    prefix: "SW",
    color: "#3B82F6",
    icon: "🔘"
  },
  multi_gang_switch: {
    type: "multi_gang_switch",
    label: "Multi-Gang Switchboard",
    category: "switch",
    mounting: "wall",
    defaultWattage: 0,
    width: 250,
    height: 100,
    symbol: "switch_multi",
    prefix: "MSW",
    color: "#3B82F6",
    icon: "🎛️"
  },
  two_way_switch: {
    type: "two_way_switch",
    label: "Two-Way Switch",
    category: "switch",
    mounting: "wall",
    defaultWattage: 0,
    width: 100,
    height: 100,
    symbol: "switch_twoway",
    prefix: "2W",
    color: "#3B82F6",
    icon: "⇅"
  },
  dimmer_switch: {
    type: "dimmer_switch",
    label: "Dimmer Switch",
    category: "switch",
    mounting: "wall",
    defaultWattage: 0,
    width: 100,
    height: 100,
    symbol: "switch_dimmer",
    prefix: "DIM",
    color: "#3B82F6",
    icon: "🎚️"
  },

  // 4. DISTRIBUTION BOARDS
  main_db: {
    type: "main_db",
    label: "Main DB (MDB)",
    category: "distribution",
    mounting: "wall",
    defaultWattage: 0,
    width: 500,
    height: 200,
    symbol: "main_db_panel",
    prefix: "DB",
    color: "#EF4444",
    icon: "⚡"
  },

  // 5. POWER & RADIALS
  socket_5a: {
    type: "socket_5a",
    label: "5A General Socket",
    category: "power",
    mounting: "wall",
    defaultWattage: 100,
    width: 100,
    height: 100,
    symbol: "socket_single",
    prefix: "S5",
    color: "#10B981",
    icon: "🔌"
  },
  socket_16a: {
    type: "socket_16a",
    label: "16A Heavy Socket",
    category: "power",
    mounting: "wall",
    defaultWattage: 1500,
    width: 120,
    height: 120,
    symbol: "socket_heavy",
    prefix: "S16",
    color: "#10B981",
    icon: "🔋"
  },
  ac_isolator_20a: {
    type: "ac_isolator_20a",
    label: "AC Isolator / 20A Radial",
    category: "power",
    mounting: "wall",
    defaultWattage: 2500,
    width: 150,
    height: 150,
    symbol: "ac_isolator",
    prefix: "AC",
    color: "#06B6D4",
    icon: "❄️"
  },
  geyser_switch: {
    type: "geyser_switch",
    label: "Geyser Switch / 20A",
    category: "power",
    mounting: "wall",
    defaultWattage: 2000,
    width: 120,
    height: 120,
    symbol: "geyser_radial",
    prefix: "GEY",
    color: "#F97316",
    icon: "♨️"
  }
};

export const CIRCUIT_SPECS = {
  lighting: {
    label: "Lighting Circuit",
    defaultBreaker: 10,
    defaultWireGauge: 1.5,
    maxLoad: 800,
    color: "#F59E0B"
  },
  fan: {
    label: "Fan Circuit",
    defaultBreaker: 10,
    defaultWireGauge: 1.5,
    maxLoad: 600,
    color: "#06B6D4"
  },
  general_socket: {
    label: "5A Power Sockets",
    defaultBreaker: 16,
    defaultWireGauge: 2.5,
    maxLoad: 1500,
    color: "#10B981"
  },
  heavy_socket: {
    label: "16A Heavy Power",
    defaultBreaker: 20,
    defaultWireGauge: 4.0,
    maxLoad: 3000,
    color: "#8B5CF6"
  },
  ac_radial: {
    label: "AC Dedicated Radial",
    defaultBreaker: 20,
    defaultWireGauge: 4.0,
    maxLoad: 2500,
    color: "#0284C7"
  },
  geyser_radial: {
    label: "Geyser Dedicated Radial",
    defaultBreaker: 20,
    defaultWireGauge: 4.0,
    maxLoad: 2500,
    color: "#EA580C"
  }
};

export const CONDUCTOR_STYLES = {
  phase: { label: "Phase (L)", stroke: "#F59E0B", dasharray: "none", width: 2 },
  neutral: { label: "Neutral (N)", stroke: "#38BDF8", dasharray: "4 3", width: 1.5 },
  earth: { label: "Earth (PE)", stroke: "#10B981", dasharray: "2 2", width: 1.5 }
};

export const CONDUIT_STYLES = {
  slab_conduit: { label: "Slab Embedded", color: "#F59E0B", strokeWidth: 2, dasharray: "none" },
  wall_conduit: { label: "Wall Chased", color: "#94A3B8", strokeWidth: 1.8, dasharray: "5 3" },
  pvc_rigid: { label: "Surface PVC", color: "#64748B", strokeWidth: 1.5, dasharray: "none" }
};

export function generateElectricalId(prefix = "EL", existing = []) {
  const existingUpper = new Set((existing || []).map(e => (e?.id || "").toUpperCase()));
  let count = 1;
  let candidate = `${prefix}-${count}`;
  while (existingUpper.has(candidate.toUpperCase())) {
    count++;
    candidate = `${prefix}-${count}`;
  }
  return candidate;
}
