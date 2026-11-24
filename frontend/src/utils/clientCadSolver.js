/**
 * MeplanIQ In-Browser Autonomous CAD Solver & Local Database Engine
 * Provides instant 100% client-side fallback when the remote cloud backend is offline,
 * eliminating all "DOCTYPE is not valid JSON" errors on Vercel deployments.
 */

import defaultSamples from '../data/defaultSampleProjects.json';

const LOCAL_STORAGE_PROJECTS_KEY = "meplaniq:local_projects";

// Retrieve all local user projects from localStorage
export function getLocalStoredProjects() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Failed to read local projects from localStorage:", e);
    return {};
  }
}

// Save a project to localStorage
export function saveLocalProject(project) {
  try {
    const all = getLocalStoredProjects();
    const pid = project.id || project.project_id;
    all[pid] = project;
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(all));
    return project;
  } catch (e) {
    console.warn("Failed to save project to localStorage:", e);
    return project;
  }
}

// Remove a project from localStorage
export function deleteLocalProject(projectId) {
  try {
    const all = getLocalStoredProjects();
    delete all[projectId];
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to delete local project from localStorage:", e);
  }
}

// Get combined project list (Built-in Default Samples + Local Projects)
export function getCombinedProjectsSummary() {
  const localProjects = getLocalStoredProjects();
  const defaultSummaries = defaultSamples.summaries || [];

  // Map local projects to summary cards
  const localSummaries = Object.values(localProjects).map((p) => {
    const rooms = p.rooms || [];
    let totalArea = 0;
    rooms.forEach((r) => {
      totalArea += Number(r.carpet_area_sqm || r.area || 0);
    });

    const disciplines = ["Architecture"];
    if (p.hvac_equipment && p.hvac_equipment.length > 0) disciplines.push("HVAC");
    if (p.plumbing_fixtures && p.plumbing_fixtures.length > 0) disciplines.push("Plumbing");
    if (p.electrical_components && p.electrical_components.length > 0) disciplines.push("Electrical");

    return {
      id: p.project_id || p.id,
      name: p.project_name || p.name || "Custom Floorplan",
      created_at: p.created_at || new Date().toISOString(),
      room_count: rooms.length,
      total_area_sqm: Math.round(totalArea * 10) / 10,
      disciplines,
      preview_rooms: rooms.map((r) => ({
        name: r.name,
        points: r.points || r.filleted_points || []
      })),
      mep_counts: {
        hvac: (p.hvac_equipment || []).length,
        plumbing: (p.plumbing_fixtures || []).length,
        electrical: (p.electrical_components || []).length
      }
    };
  });

  // Combine, filtering duplicates by id
  const localIds = new Set(localSummaries.map((s) => s.id));
  const remainingDefaults = defaultSummaries.filter((d) => !localIds.has(d.id));

  return [...localSummaries, ...remainingDefaults];
}

// Get full project payload by ID (check local storage first, then default samples)
export function getCombinedProjectById(projectId) {
  const localProjects = getLocalStoredProjects();
  if (localProjects[projectId]) {
    return localProjects[projectId];
  }

  const defaultProjects = defaultSamples.projects || {};
  if (defaultProjects[projectId]) {
    return defaultProjects[projectId];
  }

  // Also check if any local project matches without exact case
  const found = Object.values(localProjects).find(
    (p) => (p.project_id || p.id) === projectId
  );
  if (found) return found;

  return null;
}

/**
 * Solve CAD geometry entirely in the browser using pure vector math.
 * Generates wall polygons, door leaves & swing arcs, window sills, and dimensions.
 */
export function solveGeometryInBrowser(nameOrPayload, roomsPayload, openingsPayload = [], hvacPayload = []) {
  let name = "Custom Floorplan";
  let rooms = [];
  let openings = [];
  let hvac = [];

  // Handle both solveGeometryInBrowser(name, rooms, openings, hvac)
  // and solveGeometryInBrowser({ name, rooms, openings, hvac_equipment })
  // and solveGeometryInBrowser("Project Name")
  if (typeof nameOrPayload === "object" && nameOrPayload !== null) {
    name = nameOrPayload.name || nameOrPayload.project_name || "Custom Floorplan";
    rooms = nameOrPayload.rooms || [];
    openings = nameOrPayload.openings || [];
    hvac = nameOrPayload.hvac_equipment || nameOrPayload.hvac || [];
  } else {
    name = typeof nameOrPayload === "string" && nameOrPayload.trim() ? nameOrPayload : "Custom Floorplan";
    rooms = Array.isArray(roomsPayload) ? roomsPayload : [];
    openings = Array.isArray(openingsPayload) ? openingsPayload : [];
    hvac = Array.isArray(hvacPayload) ? hvacPayload : [];
  }

  // Provide a clean default room if none provided
  if (!rooms || rooms.length === 0) {
    rooms = [
      {
        name: "Living Room",
        points: [
          [0, 0],
          [6000, 0],
          [6000, 4500],
          [0, 4500]
        ]
      },
      {
        name: "Bedroom",
        points: [
          [6000, 0],
          [10000, 0],
          [10000, 4500],
          [6000, 4500]
        ]
      }
    ];
  }

  const pid = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const processedRooms = rooms.map((r, idx) => {
    const pts = r.points || [];
    let xs = [], ys = [];
    pts.forEach(([x, y]) => {
      xs.push(x);
      ys.push(y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const w = (Math.max(...xs) - Math.min(...xs)) || 4000;
    const h = (Math.max(...ys) - Math.min(...ys)) || 4000;
    const areaSqm = Math.round((w * h / 1000000) * 100) / 100;
    const areaSqft = Math.round(areaSqm * 10.7639 * 10) / 10;

    return {
      name: r.name || `Room ${idx + 1}`,
      points: pts,
      filleted_points: pts,
      vertex_count: pts.length,
      carpet_area_sqm: areaSqm,
      carpet_area_sqft: areaSqft,
      centroid: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
    };
  });

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 10000; maxY = 8000;
  }

  // Outer building boundary with 230mm exterior wall thickness
  const wallThickness = 230;
  const outerPoly = [
    [minX - wallThickness, minY - wallThickness],
    [maxX + wallThickness, minY - wallThickness],
    [maxX + wallThickness, maxY + wallThickness],
    [minX - wallThickness, maxY + wallThickness]
  ];

  // Inner room boundaries as polygon holes
  const innerPolys = processedRooms.map((r) => r.points);

  const wallPolygons = [
    {
      wall_type: "combined",
      thickness_mm: wallThickness,
      outer_polygon: outerPoly,
      inner_polygons: innerPolys
    }
  ];

  // Format Doors
  const doors = (openingsPayload || [])
    .filter((o) => o.type === "Door")
    .map((o, idx) => {
      const w = Number(o.width_mm) || 900;
      const host = processedRooms.find((r) => r.name === o.host_room) || processedRooms[0] || { centroid: [2000, 0] };
      const hingeX = host.points ? host.points[0][0] + (Number(o.offset_mm) || 500) : 1000;
      const hingeY = host.points ? host.points[0][1] : 0;

      return {
        id: o.id || `D${idx + 1}`,
        host_room: o.host_room || host.name,
        wall_side: o.wall_side || "Bottom",
        width_mm: w,
        height_mm: 2100,
        hinge: [hingeX, hingeY],
        leaf_end: [hingeX, hingeY + w],
        label_x: hingeX + w / 2,
        label_y: hingeY + 150,
        jambs: [
          [hingeX, hingeY - 50, hingeX, hingeY + 50],
          [hingeX + w, hingeY - 50, hingeX + w, hingeY + 50]
        ]
      };
    });

  // Format Windows
  const windows = (openingsPayload || [])
    .filter((o) => o.type === "Window")
    .map((o, idx) => {
      const w = Number(o.width_mm) || 1200;
      const host = processedRooms.find((r) => r.name === o.host_room) || processedRooms[0] || { centroid: [2000, 2000] };
      const startX = host.points ? host.points[1][0] : 4000;
      const startY = host.points ? host.points[1][1] + (Number(o.offset_mm) || 500) : 1000;

      return {
        id: o.id || `W${idx + 1}`,
        host_room: o.host_room || host.name,
        wall_side: o.wall_side || "Right",
        width_mm: w,
        height_mm: 1200,
        sill_line: [startX - 50, startY, startX + 50, startY + w],
        glass_line: [startX, startY, startX, startY + w],
        frame_lines: [
          [startX - 100, startY, startX + 100, startY],
          [startX - 100, startY + w, startX + 100, startY + w]
        ],
        label_x: startX + 150,
        label_y: startY + w / 2
      };
    });

  // Format HVAC
  const hvacEquipment = (hvacPayload || []).map((h, idx) => ({
    id: h.id || `IDU-${idx + 1}`,
    room_name: h.room_name || "Room",
    unit_type: h.unit_type || "Split-IDU",
    capacity_tr: Number(h.cooling_capacity_tr || h.capacity_tr) || 1.5,
    location_x: Number(h.location_x || h.x) || 1500,
    location_y: Number(h.location_y || h.y) || 1500,
    status: h.status || "Active"
  }));

  // Automatic Dimensions
  const dimensions = [
    {
      id: "dim-overall-x",
      label: `${Math.round(maxX - minX)} mm`,
      dim_type: "linear",
      x1: minX,
      y1: minY - 400,
      x2: maxX,
      y2: minY - 400
    },
    {
      id: "dim-overall-y",
      label: `${Math.round(maxY - minY)} mm`,
      dim_type: "linear",
      x1: minX - 400,
      y1: minY,
      x2: minX - 400,
      y2: maxY
    }
  ];

  const solvedProject = {
    id: pid,
    project_id: pid,
    name: name || "Custom Floorplan",
    project_name: name || "Custom Floorplan",
    created_at: now,
    rooms: processedRooms,
    wall_polygons: wallPolygons,
    doors,
    windows,
    hvac_equipment: hvacEquipment,
    furniture: [],
    plumbing_fixtures: [],
    plumbing_pipes: [],
    electrical_components: [],
    electrical_circuits: [],
    electrical_routes: [],
    dimensions,
    cad_json_data: {
      rooms: processedRooms,
      doors,
      windows,
      hvac_equipment: hvacEquipment,
      wall_polygons: wallPolygons
    }
  };

  // Persist to local storage
  saveLocalProject(solvedProject);

  return solvedProject;
}

/**
 * Generate Room Program Proposal entirely in the browser.
 */
export function generateAreaProgramProposalLocal(params = {}) {
  const sqft = Number(params.target_area_sqft) || 1200;
  const beds = Math.max(1, Number(params.bedrooms) || 2);

  const rooms = [];
  // Living / Dining (approx 28%)
  const livingSqft = Math.round(sqft * 0.28);
  rooms.push({
    id: 1,
    name: "Living Room",
    category: "Living",
    width_mm: 5500,
    height_mm: 4800,
    target_area_sqft: livingSqft
  });

  // Master Bedroom (approx 22%)
  const masterSqft = Math.round(sqft * 0.22);
  rooms.push({
    id: 2,
    name: "Master Bedroom",
    category: "Bedroom",
    width_mm: 4200,
    height_mm: 4000,
    target_area_sqft: masterSqft
  });

  // Additional bedrooms
  for (let b = 2; b <= beds; b++) {
    const bedSqft = Math.round(sqft * 0.16);
    rooms.push({
      id: rooms.length + 1,
      name: `Bedroom ${b}`,
      category: "Bedroom",
      width_mm: 3800,
      height_mm: 3600,
      target_area_sqft: bedSqft
    });
  }

  // Kitchen (approx 12%)
  const kitchenSqft = Math.round(sqft * 0.12);
  rooms.push({
    id: rooms.length + 1,
    name: "Kitchen",
    category: "Utility",
    width_mm: 3400,
    height_mm: 3000,
    target_area_sqft: kitchenSqft
  });

  // Bathrooms
  rooms.push({
    id: rooms.length + 1,
    name: "Master Toilet",
    category: "Sanitary",
    width_mm: 2400,
    height_mm: 1800,
    target_area_sqft: 46
  });

  if (beds > 1) {
    rooms.push({
      id: rooms.length + 1,
      name: "Common Toilet",
      category: "Sanitary",
      width_mm: 2000,
      height_mm: 1800,
      target_area_sqft: 38
    });
  }

  const formattedRooms = rooms.map((r) => {
    const w = r.width_mm || 4000;
    const d = r.height_mm || r.depth_mm || 3500;
    const areaSqm = Math.round((w * d / 1000000) * 100) / 100;
    const areaSqft = Math.round(areaSqm * 10.7639 * 10) / 10;
    return {
      name: r.name,
      category: r.category || "General",
      width_mm: w,
      depth_mm: d,
      height_mm: d,
      area_sqm: areaSqm,
      area_sqft: areaSqft,
      target_area_sqft: r.target_area_sqft || areaSqft
    };
  });

  return {
    target_area_sqft: sqft,
    total_program_sqft: formattedRooms.reduce((sum, r) => sum + r.target_area_sqft, 0),
    allocated_rooms: formattedRooms,
    rooms: formattedRooms
  };
}

/**
 * Generate full Floorplan Project from Area program proposal in the browser.
 */
export function generateProjectFromAreaLocal(payload = {}) {
  const pName = payload.name || payload.project_name || "AI Generated Floorplan";
  const rawRooms = (Array.isArray(payload.rooms) && payload.rooms.length > 0)
    ? payload.rooms
    : (Array.isArray(payload.allocated_rooms) && payload.allocated_rooms.length > 0)
      ? payload.allocated_rooms
      : [
          { name: "Living Room", width_mm: 5500, depth_mm: 4500 },
          { name: "Master Bedroom", width_mm: 4200, depth_mm: 4000 },
          { name: "Kitchen", width_mm: 3400, depth_mm: 3000 }
        ];

  // Pack rooms into a 2D layout grid
  let currentX = 0;
  let currentY = 0;
  let rowMaxHeight = 0;
  const maxRowWidth = 12000; // 12 meters per row

  const placedRooms = rawRooms.map((r, idx) => {
    const w = Number(r.width_mm) || 4000;
    const h = Number(r.depth_mm || r.height_mm) || 3500;

    if (currentX + w > maxRowWidth && currentX > 0) {
      currentX = 0;
      currentY += rowMaxHeight;
      rowMaxHeight = 0;
    }

    const rx = currentX;
    const ry = currentY;

    currentX += w;
    if (h > rowMaxHeight) rowMaxHeight = h;

    return {
      name: r.name || `Room ${idx + 1}`,
      points: [
        [rx, ry],
        [rx + w, ry],
        [rx + w, ry + h],
        [rx, ry + h]
      ]
    };
  });

  // Generate standard doors & windows
  const openings = placedRooms.map((r, idx) => ({
    id: `D${idx + 1}`,
    host_room: r.name,
    type: "Door",
    wall_side: "Bottom",
    offset_mm: 800,
    width_mm: 900
  }));

  // Generate standard HVAC split units
  const hvac = placedRooms.map((r, idx) => {
    const pts = r.points;
    const centerX = (pts[0][0] + pts[1][0]) / 2;
    const centerY = (pts[0][1] + pts[2][1]) / 2;
    return {
      id: `IDU-${idx + 1}`,
      room_name: r.name,
      unit_type: "Split-IDU",
      cooling_capacity_tr: 1.5,
      location_x: centerX,
      location_y: centerY + 1000
    };
  });

  return solveGeometryInBrowser(pName, placedRooms, openings, hvac);
}

/**
 * Update an existing project in local storage.
 */
export function updateLocalProject(projectId, updatePayload = {}) {
  const existing = getCombinedProjectById(projectId) || {};
  const updated = {
    ...existing,
    ...updatePayload,
    id: projectId,
    project_id: projectId,
    project_name: updatePayload.project_name || updatePayload.name || existing.project_name || existing.name || "Floorplan",
    name: updatePayload.name || updatePayload.project_name || existing.name || existing.project_name || "Floorplan",
    updated_at: new Date().toISOString()
  };
  saveLocalProject(updated);
  return updated;
}

/**
 * Generate standard ASCII DXF floorplan file content.
 */
export function generateDxfContent(project = {}) {
  const lines = [
    "0", "SECTION",
    "2", "HEADER",
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "ENTITIES"
  ];

  function addPolyline(pts, layer = "WALL") {
    if (!pts || pts.length < 2) return;
    lines.push("0", "LWPOLYLINE");
    lines.push("8", layer);
    lines.push("90", String(pts.length));
    lines.push("70", "1"); // closed
    for (const [x, y] of pts) {
      lines.push("10", String(Math.round(x)));
      lines.push("20", String(Math.round(y)));
    }
  }

  function addLine(x1, y1, x2, y2, layer = "MISC") {
    lines.push("0", "LINE");
    lines.push("8", layer);
    lines.push("10", String(Math.round(x1)));
    lines.push("20", String(Math.round(y1)));
    lines.push("11", String(Math.round(x2)));
    lines.push("21", String(Math.round(y2)));
  }

  // Walls
  (project.wall_polygons || []).forEach((w) => {
    if (w.outer_polygon) addPolyline(w.outer_polygon, "WALLS_EXTERIOR");
    (w.inner_polygons || []).forEach((ip) => addPolyline(ip, "WALLS_INTERIOR"));
  });

  // Rooms
  (project.rooms || []).forEach((r) => {
    if (r.points) addPolyline(r.points, "ROOMS");
  });

  // Doors
  (project.doors || []).forEach((d) => {
    if (d.hinge && d.leaf_end) {
      addLine(d.hinge[0], d.hinge[1], d.leaf_end[0], d.leaf_end[1], "DOORS");
    }
  });

  // Windows
  (project.windows || []).forEach((w) => {
    if (w.glass_line) {
      addLine(w.glass_line[0], w.glass_line[1], w.glass_line[2], w.glass_line[3], "WINDOWS");
    }
  });

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n");
}

/**
 * Trigger DXF download entirely in the browser.
 */
export function downloadDxfInBrowser(project, filename = "Floorplan.dxf") {
  const content = generateDxfContent(project);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Calculate BOQ in browser when offline.
 */
export function calculateBoqLocal(project = {}, qualityTier = "medium") {
  const rooms = project.rooms || [];
  let carpetArea = 0;
  rooms.forEach((r) => {
    carpetArea += Number(r.carpet_area_sqm || 0);
  });
  if (carpetArea === 0) carpetArea = 85.0;

  const rates = {
    budget: { base_rate: 1800, name: "Economy Spec" },
    medium: { base_rate: 2600, name: "Standard Premium" },
    luxury: { base_rate: 4200, name: "Ultra Luxury" }
  };
  const rateInfo = rates[(qualityTier || "medium").toLowerCase()] || rates.medium;
  const sqft = carpetArea * 10.7639;
  const civilCost = Math.round(sqft * rateInfo.base_rate);
  const mepCost = Math.round(civilCost * 0.22);
  const finishCost = Math.round(civilCost * 0.18);
  const totalCost = civilCost + mepCost + finishCost;

  return {
    project_id: project.id || project.project_id,
    project_name: project.name || project.project_name || "Floorplan",
    quality_tier: qualityTier,
    specification_name: rateInfo.name,
    builtup_area_sqft: Math.round(sqft),
    carpet_area_sqm: Math.round(carpetArea * 10) / 10,
    cost_summary: {
      civil_structural_inr: civilCost,
      mep_engineering_inr: mepCost,
      finishes_fixtures_inr: finishCost,
      grand_total_inr: totalCost
    },
    line_items: [
      { item: "Substructure & RCC Superstructure", qty: Math.round(sqft), unit: "sq.ft", amount: civilCost },
      { item: "Electrical & Plumbing Infrastructure", qty: 1, unit: "lump-sum", amount: mepCost },
      { item: "Flooring, Joinery & Painting", qty: Math.round(sqft), unit: "sq.ft", amount: finishCost }
    ]
  };
}
