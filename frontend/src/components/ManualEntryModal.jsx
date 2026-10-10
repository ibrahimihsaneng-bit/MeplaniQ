import React, { useState } from "react";
import { createManualProject } from "../api";

export default function ManualEntryModal({ isOpen, onClose, onProjectCreated }) {
  if (!isOpen) return null;

  const [projectName, setProjectName] = useState("Custom Floorplan");
  const [rooms, setRooms] = useState([
    { id: 1, name: "Living Room", x: 0, y: 0, width: 6000, height: 5000 },
    { id: 2, name: "Master Bedroom", x: 6000, y: 0, width: 4000, height: 5000 }
  ]);
  const [openings, setOpenings] = useState([
    { id: 1, host_room: "Living Room", type: "Door", wall_side: "Bottom", offset_mm: 1000, width_mm: 1000 },
    { id: 2, host_room: "Master Bedroom", type: "Window", wall_side: "Top", offset_mm: 1200, width_mm: 1500 }
  ]);
  const [hvacUnits, setHvacUnits] = useState([
    { id: 1, room_name: "Living Room", unit_type: "Split-IDU", capacity_tr: 2.0, x: 3000, y: 4800 },
    { id: 2, room_name: "Master Bedroom", unit_type: "Split-IDU", capacity_tr: 1.5, x: 8000, y: 4800 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selectedHostRoomId, setSelectedHostRoomId] = useState(1);

  // --- Smart Snap Room Attachment Handler ---
  const handleAttachRoom = (side) => {
    const host = rooms.find((r) => r.id === Number(selectedHostRoomId)) || rooms[0];
    if (!host) return;

    const nextId = rooms.length > 0 ? Math.max(...rooms.map((r) => r.id)) + 1 : 1;
    const w = 4000;
    const h = 4000;
    const hx = Number(host.x) || 0;
    const hy = Number(host.y) || 0;
    const hw = Number(host.width) || 4000;
    const hh = Number(host.height) || 4000;

    let nx = hx;
    let ny = hy;

    if (side === "right") {
      nx = hx + hw;
      ny = hy;
    } else if (side === "top") {
      nx = hx;
      ny = hy + hh;
    } else if (side === "left") {
      nx = Math.max(0, hx - w);
      ny = hy;
    } else if (side === "bottom") {
      nx = hx;
      ny = Math.max(0, hy - h);
    }

    setRooms([
      ...rooms,
      { id: nextId, name: `Room ${nextId}`, x: nx, y: ny, width: w, height: h }
    ]);
  };

  // --- Room Handlers ---
  const handleAddRoom = () => {
    const nextId = rooms.length > 0 ? Math.max(...rooms.map((r) => r.id)) + 1 : 1;
    // Guess a reasonable starting coordinate beside existing rooms
    let lastMaxX = 0;
    rooms.forEach((r) => {
      const right = (Number(r.x) || 0) + (Number(r.width) || 0);
      if (right > lastMaxX) lastMaxX = right;
    });
    setRooms([
      ...rooms,
      { id: nextId, name: `Room ${nextId}`, x: lastMaxX, y: 0, width: 4000, height: 4000 }
    ]);
  };

  const handleUpdateRoom = (id, field, value) => {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleRemoveRoom = (id) => {
    if (rooms.length <= 1) {
      setFormError("At least one room is required.");
      return;
    }
    const removedRoom = rooms.find((r) => r.id === id);
    setRooms(rooms.filter((r) => r.id !== id));
    // Also remove openings and HVAC assigned to this deleted room
    if (removedRoom) {
      setOpenings(openings.filter((o) => o.host_room !== removedRoom.name));
      setHvacUnits(hvacUnits.filter((h) => h.room_name !== removedRoom.name));
    }
  };

  // --- Opening Handlers ---
  const handleAddOpening = () => {
    const nextId = openings.length > 0 ? Math.max(...openings.map((o) => o.id)) + 1 : 1;
    const defaultHost = rooms.length > 0 ? rooms[0].name : "";
    setOpenings([
      ...openings,
      {
        id: nextId,
        host_room: defaultHost,
        type: "Door",
        wall_side: "Bottom",
        offset_mm: 1000,
        width_mm: 900
      }
    ]);
  };

  const handleUpdateOpening = (id, field, value) => {
    setOpenings(openings.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const handleRemoveOpening = (id) => {
    setOpenings(openings.filter((o) => o.id !== id));
  };

  // --- HVAC Handlers ---
  const handleAddHvac = () => {
    const nextId = hvacUnits.length > 0 ? Math.max(...hvacUnits.map((h) => h.id)) + 1 : 1;
    const defaultRoom = rooms.length > 0 ? rooms[0] : null;
    const locX = defaultRoom ? Number(defaultRoom.x) + Number(defaultRoom.width) / 2 : 2000;
    const locY = defaultRoom ? Number(defaultRoom.y) + Number(defaultRoom.height) - 200 : 2000;

    setHvacUnits([
      ...hvacUnits,
      {
        id: nextId,
        room_name: defaultRoom ? defaultRoom.name : "",
        unit_type: "Split-IDU",
        capacity_tr: 1.5,
        x: Math.round(locX),
        y: Math.round(locY)
      }
    ]);
  };

  const handleUpdateHvac = (id, field, value) => {
    setHvacUnits(hvacUnits.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const handleRemoveHvac = (id) => {
    setHvacUnits(hvacUnits.filter((h) => h.id !== id));
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setFormError("Project Name is required.");
      return;
    }

    if (rooms.length === 0) {
      setFormError("At least one room is required.");
      return;
    }

    // Validate room names and dimensions
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.name || !r.name.trim()) {
        setFormError(`Room #${i + 1} must have a name.`);
        return;
      }
      const w = Number(r.width);
      const h = Number(r.height);
      if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
        setFormError(`Room "${r.name}" must have valid positive Width and Height in mm.`);
        return;
      }
    }

    // Convert room dimensions into the 4 vertex points expected by the CAD solver
    const formattedRooms = rooms.map((r) => {
      const rx = Number(r.x) || 0;
      const ry = Number(r.y) || 0;
      const rw = Number(r.width);
      const rh = Number(r.height);
      return {
        name: r.name.trim(),
        points: [
          [rx, ry],
          [rx + rw, ry],
          [rx + rw, ry + rh],
          [rx, ry + rh]
        ],
        fillet_radius: 0.0
      };
    });

    // Format openings
    const formattedOpenings = openings.map((o, idx) => {
      const isDoor = o.type === "Door";
      return {
        id: isDoor ? `D${idx + 1}` : `W${idx + 1}`,
        type: o.type,
        host_room: o.host_room,
        wall_side: o.wall_side,
        offset_mm: Number(o.offset_mm) || 0,
        width_mm: Number(o.width_mm) || (isDoor ? 900 : 1200),
        height_mm: isDoor ? 2100.0 : 1200.0,
        swing: isDoor ? "Inward-Right" : ""
      };
    });

    // Format HVAC
    const formattedHvac = hvacUnits.map((h, idx) => {
      const isOdu = h.unit_type === "ODU";
      return {
        id: isOdu ? `ODU-${idx + 1}` : `IDU-${idx + 1}`,
        room_name: h.room_name,
        unit_type: h.unit_type || "Split-IDU",
        cooling_capacity_tr: Number(h.capacity_tr) || 1.5,
        location_x: Number(h.x) || 0,
        location_y: Number(h.y) || 0,
        status: "Active"
      };
    });

    const payload = {
      name: trimmedName,
      rooms: formattedRooms,
      openings: formattedOpenings,
      hvac_equipment: formattedHvac
    };

    try {
      setSubmitting(true);
      const created = await createManualProject(payload);
      if (onProjectCreated && created && created.project_id) {
        onProjectCreated(created.project_id);
      }
    } catch (err) {
      console.error("Manual Project creation error:", err);
      setFormError(err.message || "Failed to create project geometry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.9rem" }}>📝</span>
            <div>
              <h2 style={styles.modalTitle}>Create Project from Scratch</h2>
              <p style={styles.modalSubtitle}>
                Design custom floorplan rooms, openings, and HVAC equipment without an Excel file
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn} title="Close">
            ✕
          </button>
        </div>

        {formError && (
          <div style={styles.errorBox}>
            <span>⚠️ {formError}</span>
            <button onClick={() => setFormError(null)} style={styles.closeAlertBtn}>✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* 1. Project Name */}
          <div style={styles.section}>
            <label style={styles.sectionLabel} htmlFor="manualProjectName">
              Project Name <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              id="manualProjectName"
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Modern Villa Ground Floor, Office Layout A"
              style={styles.textInput}
            />
          </div>

          {/* 2. Rooms Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h3 style={styles.sectionHeading}>🏠 Rooms ({rooms.length})</h3>
                <span style={styles.sectionSubtext}>
                  Width and height are automatically mapped to rectangular CAD coordinates in mm
                </span>
              </div>
              <button type="button" onClick={handleAddRoom} style={styles.btnAddRow}>
                ➕ Add Room
              </button>
            </div>

            {/* Smart Room Snap Assistant Bar */}
            <div style={styles.snapAssistantBar}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38BDF8" }}>
                  ⚡ Smart Snap Assistant:
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94A3B8" }}>Attach next room to:</span>
                <select
                  value={selectedHostRoomId}
                  onChange={(e) => setSelectedHostRoomId(Number(e.target.value))}
                  style={styles.snapSelect}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `Room ${r.id}`} ({r.width}×{r.height}mm)
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleAttachRoom("right")}
                  style={styles.btnSnap}
                  title="Attach room directly against Right party wall"
                >
                  ➡️ + Attach Right
                </button>
                <button
                  type="button"
                  onClick={() => handleAttachRoom("top")}
                  style={styles.btnSnap}
                  title="Attach room directly against Top party wall"
                >
                  ⬆️ + Attach Top
                </button>
                <button
                  type="button"
                  onClick={() => handleAttachRoom("left")}
                  style={styles.btnSnap}
                  title="Attach room directly against Left party wall"
                >
                  ⬅️ + Attach Left
                </button>
                <button
                  type="button"
                  onClick={() => handleAttachRoom("bottom")}
                  style={styles.btnSnap}
                  title="Attach room directly against Bottom party wall"
                >
                  ⬇️ + Attach Bottom
                </button>
              </div>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Room Name</th>
                    <th style={styles.th}>X (mm)</th>
                    <th style={styles.th}>Y (mm)</th>
                    <th style={styles.th}>Width (mm)</th>
                    <th style={styles.th}>Height (mm)</th>
                    <th style={{ ...styles.th, width: "45px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td style={styles.td}>
                        <input
                          type="text"
                          required
                          value={room.name}
                          onChange={(e) => handleUpdateRoom(room.id, "name", e.target.value)}
                          placeholder="e.g. Living Room"
                          style={styles.cellInput}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={room.x}
                          onChange={(e) => handleUpdateRoom(room.id, "x", e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={room.y}
                          onChange={(e) => handleUpdateRoom(room.id, "y", e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          required
                          min="500"
                          step="100"
                          value={room.width}
                          onChange={(e) => handleUpdateRoom(room.id, "width", e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          required
                          min="500"
                          step="100"
                          value={room.height}
                          onChange={(e) => handleUpdateRoom(room.id, "height", e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                      <td style={styles.tdCenter}>
                        <button
                          type="button"
                          onClick={() => handleRemoveRoom(room.id)}
                          style={styles.btnDeleteRow}
                          title="Remove Room"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live 2D Footprint Mini-Preview */}
            {rooms.length > 0 && (() => {
              const minX = Math.min(...rooms.map((r) => Number(r.x) || 0));
              const maxX = Math.max(...rooms.map((r) => (Number(r.x) || 0) + (Number(r.width) || 0)));
              const minY = Math.min(...rooms.map((r) => Number(r.y) || 0));
              const maxY = Math.max(...rooms.map((r) => (Number(r.y) || 0) + (Number(r.height) || 0)));
              const totalW = Math.max(1000, maxX - minX);
              const totalH = Math.max(1000, maxY - minY);
              const pad = Math.max(totalW, totalH) * 0.1;
              const vbX = minX - pad;
              const vbY = minY - pad;
              const vbW = totalW + pad * 2;
              const vbH = totalH + pad * 2;
              const totalSqM = rooms.reduce((acc, r) => acc + ((Number(r.width) || 0) * (Number(r.height) || 0)) / 1e6, 0);
              const totalSqFt = totalSqM * 10.7639;

              return (
                <div style={styles.miniPreviewCard}>
                  <div style={styles.miniPreviewHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem" }}>📐</span>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#38BDF8" }}>
                        Live 2D Watertight Floorplan Preview
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                      Footprint: <strong style={{ color: "#F8FAFC" }}>{(totalW / 1000).toFixed(1)}m × {(totalH / 1000).toFixed(1)}m</strong>
                      {" | "}Carpet Area: <strong style={{ color: "#34D399" }}>{totalSqM.toFixed(1)} m² ({totalSqFt.toFixed(0)} sq.ft)</strong>
                    </div>
                  </div>
                  <div style={styles.svgPreviewWrapper}>
                    <svg
                      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                      style={{ width: "100%", height: "180px", display: "block" }}
                    >
                      <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="#0B0F19" />
                      {rooms.map((r, idx) => {
                        const rx = Number(r.x) || 0;
                        const ry = Number(r.y) || 0;
                        const rw = Number(r.width) || 4000;
                        const rh = Number(r.height) || 4000;
                        const svgY = maxY - (ry - minY) - rh + minY;
                        const colors = [
                          { fill: "rgba(56, 189, 248, 0.18)", stroke: "#38BDF8" },
                          { fill: "rgba(99, 102, 241, 0.18)", stroke: "#818CF8" },
                          { fill: "rgba(16, 185, 129, 0.18)", stroke: "#34D399" },
                          { fill: "rgba(245, 158, 11, 0.18)", stroke: "#FBBF24" },
                          { fill: "rgba(236, 72, 153, 0.18)", stroke: "#F472B6" }
                        ];
                        const c = colors[idx % colors.length];
                        return (
                          <g key={r.id}>
                            <rect
                              x={rx}
                              y={svgY}
                              width={rw}
                              height={rh}
                              fill={c.fill}
                              stroke={c.stroke}
                              strokeWidth={Math.max(25, vbW / 250)}
                            />
                            <text
                              x={rx + rw / 2}
                              y={svgY + rh / 2 - (vbH / 55)}
                              textAnchor="middle"
                              fill="#F8FAFC"
                              fontSize={Math.max(140, vbW / 30)}
                              fontWeight="bold"
                            >
                              {r.name || `Room ${r.id}`}
                            </text>
                            <text
                              x={rx + rw / 2}
                              y={svgY + rh / 2 + (vbH / 30)}
                              textAnchor="middle"
                              fill="#94A3B8"
                              fontSize={Math.max(100, vbW / 40)}
                            >
                              {(rw / 1000).toFixed(1)}m × {(rh / 1000).toFixed(1)}m
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>


          {/* 3. Openings Section (Doors & Windows) */}
          <div style={styles.section}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h3 style={styles.sectionHeading}>🚪 Doors & Windows ({openings.length})</h3>
                <span style={styles.sectionSubtext}>
                  Openings will be embedded directly into host room walls
                </span>
              </div>
              <button type="button" onClick={handleAddOpening} style={styles.btnAddRow}>
                ➕ Add Door / Window
              </button>
            </div>

            {openings.length === 0 ? (
              <p style={styles.emptyNote}>No openings added yet. Click "+ Add Door / Window" above.</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Host Room</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Wall Side</th>
                      <th style={styles.th}>Offset (mm)</th>
                      <th style={styles.th}>Width (mm)</th>
                      <th style={{ ...styles.th, width: "45px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openings.map((op) => (
                      <tr key={op.id}>
                        <td style={styles.td}>
                          <select
                            value={op.host_room}
                            onChange={(e) => handleUpdateOpening(op.id, "host_room", e.target.value)}
                            style={styles.cellSelect}
                          >
                            {rooms.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.td}>
                          <select
                            value={op.type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              handleUpdateOpening(op.id, "type", newType);
                              if (newType === "Window" && op.width_mm === 900) {
                                handleUpdateOpening(op.id, "width_mm", 1200);
                              } else if (newType === "Door" && op.width_mm === 1200) {
                                handleUpdateOpening(op.id, "width_mm", 900);
                              }
                            }}
                            style={styles.cellSelect}
                          >
                            <option value="Door">Door</option>
                            <option value="Window">Window</option>
                          </select>
                        </td>
                        <td style={styles.td}>
                          <select
                            value={op.wall_side}
                            onChange={(e) => handleUpdateOpening(op.id, "wall_side", e.target.value)}
                            style={styles.cellSelect}
                          >
                            <option value="Bottom">Bottom</option>
                            <option value="Top">Top</option>
                            <option value="Left">Left</option>
                            <option value="Right">Right</option>
                          </select>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={op.offset_mm}
                            onChange={(e) => handleUpdateOpening(op.id, "offset_mm", e.target.value)}
                            style={styles.cellInput}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            min="400"
                            step="50"
                            value={op.width_mm}
                            onChange={(e) => handleUpdateOpening(op.id, "width_mm", e.target.value)}
                            style={styles.cellInput}
                          />
                        </td>
                        <td style={styles.tdCenter}>
                          <button
                            type="button"
                            onClick={() => handleRemoveOpening(op.id)}
                            style={styles.btnDeleteRow}
                            title="Remove Opening"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. HVAC Equipment Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h3 style={styles.sectionHeading}>❄️ HVAC Equipment ({hvacUnits.length})</h3>
                <span style={styles.sectionSubtext}>
                  Indoor and outdoor air-conditioning units with cooling capacity
                </span>
              </div>
              <button type="button" onClick={handleAddHvac} style={styles.btnAddRow}>
                ➕ Add AC Unit
              </button>
            </div>

            {hvacUnits.length === 0 ? (
              <p style={styles.emptyNote}>No HVAC units added. Click "+ Add AC Unit" above.</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Room</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Capacity (TR)</th>
                      <th style={styles.th}>Location X (mm)</th>
                      <th style={styles.th}>Location Y (mm)</th>
                      <th style={{ ...styles.th, width: "45px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hvacUnits.map((unit) => (
                      <tr key={unit.id}>
                        <td style={styles.td}>
                          <select
                            value={unit.room_name}
                            onChange={(e) => handleUpdateHvac(unit.id, "room_name", e.target.value)}
                            style={styles.cellSelect}
                          >
                            {rooms.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.td}>
                          <select
                            value={unit.unit_type}
                            onChange={(e) => handleUpdateHvac(unit.id, "unit_type", e.target.value)}
                            style={styles.cellSelect}
                          >
                            <option value="Split-IDU">Split-IDU</option>
                            <option value="Cassette-IDU">Cassette-IDU</option>
                            <option value="ODU">Outdoor Unit (ODU)</option>
                          </select>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="10.0"
                            value={unit.capacity_tr}
                            onChange={(e) => handleUpdateHvac(unit.id, "capacity_tr", e.target.value)}
                            style={styles.cellInput}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            value={unit.x}
                            onChange={(e) => handleUpdateHvac(unit.id, "x", e.target.value)}
                            style={styles.cellInput}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            value={unit.y}
                            onChange={(e) => handleUpdateHvac(unit.id, "y", e.target.value)}
                            style={styles.cellInput}
                          />
                        </td>
                        <td style={styles.tdCenter}>
                          <button
                            type="button"
                            onClick={() => handleRemoveHvac(unit.id)}
                            style={styles.btnDeleteRow}
                            title="Remove AC Unit"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.btnCancel}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={styles.btnSubmit}>
              {submitting ? "⏳ Solving CAD Floorplan..." : "✨ Generate CAD Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(5px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem"
  },
  modalContent: {
    backgroundColor: "#1E293B",
    border: "1px solid #38BDF8",
    borderRadius: "16px",
    maxWidth: "880px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
    padding: "2rem",
    color: "#F8FAFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #334155"
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.45rem",
    fontWeight: 700,
    color: "#38BDF8"
  },
  modalSubtitle: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.85rem",
    color: "#94A3B8"
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontSize: "1.5rem",
    cursor: "pointer",
    padding: "0.25rem 0.5rem",
    lineHeight: 1,
    borderRadius: "6px"
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    border: "1px solid #EF4444",
    color: "#FCA5A5",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    marginBottom: "1.25rem",
    fontSize: "0.875rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  closeAlertBtn: {
    background: "transparent",
    border: "none",
    color: "#FCA5A5",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem"
  },
  section: {
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "1.25rem"
  },
  sectionLabel: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#F1F5F9",
    marginBottom: "0.5rem"
  },
  textInput: {
    width: "100%",
    backgroundColor: "#0B0F19",
    border: "1px solid #475569",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "#FFFFFF",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box"
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.85rem",
    flexWrap: "wrap",
    gap: "0.5rem"
  },
  sectionHeading: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#F8FAFC"
  },
  sectionSubtext: {
    display: "block",
    fontSize: "0.78rem",
    color: "#94A3B8",
    marginTop: "0.2rem"
  },
  btnAddRow: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    border: "1px solid #38BDF8",
    color: "#38BDF8",
    padding: "0.4rem 0.85rem",
    borderRadius: "6px",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease"
  },
  tableWrapper: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.85rem"
  },
  th: {
    textAlign: "left",
    padding: "0.5rem 0.6rem",
    color: "#94A3B8",
    fontWeight: 600,
    borderBottom: "1px solid #334155",
    fontSize: "0.8rem"
  },
  td: {
    padding: "0.4rem 0.4rem",
    borderBottom: "1px solid #1E293B"
  },
  tdCenter: {
    padding: "0.4rem 0.4rem",
    textAlign: "center",
    borderBottom: "1px solid #1E293B"
  },
  cellInput: {
    width: "100%",
    backgroundColor: "#0B0F19",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "0.45rem 0.6rem",
    color: "#FFFFFF",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box"
  },
  cellSelect: {
    width: "100%",
    backgroundColor: "#0B0F19",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "0.45rem 0.6rem",
    color: "#FFFFFF",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box"
  },
  btnDeleteRow: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#FCA5A5",
    borderRadius: "4px",
    padding: "0.3rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.8rem",
    lineHeight: 1
  },
  emptyNote: {
    margin: "0.5rem 0",
    color: "#94A3B8",
    fontSize: "0.85rem",
    fontStyle: "italic"
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.85rem",
    marginTop: "0.5rem",
    paddingTop: "1.25rem",
    borderTop: "1px solid #334155"
  },
  btnCancel: {
    backgroundColor: "#334155",
    color: "#E2E8F0",
    border: "none",
    borderRadius: "8px",
    padding: "0.7rem 1.4rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer"
  },
  btnSubmit: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "0.7rem 1.6rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.4)",
    transition: "all 0.15s ease"
  },
  snapAssistantBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    border: "1px dashed #38BDF8",
    borderRadius: "8px",
    padding: "0.6rem 0.85rem",
    marginBottom: "0.85rem",
    flexWrap: "wrap",
    gap: "0.5rem"
  },
  snapSelect: {
    backgroundColor: "#0F172A",
    border: "1px solid #475569",
    color: "#F8FAFC",
    padding: "0.3rem 0.6rem",
    borderRadius: "6px",
    fontSize: "0.82rem"
  },
  btnSnap: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    color: "#38BDF8",
    padding: "0.3rem 0.65rem",
    borderRadius: "6px",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease"
  },
  miniPreviewCard: {
    marginTop: "1rem",
    backgroundColor: "#0B0F19",
    border: "1px solid #334155",
    borderRadius: "8px",
    overflow: "hidden"
  },
  miniPreviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 0.85rem",
    backgroundColor: "#1E293B",
    borderBottom: "1px solid #334155",
    flexWrap: "wrap",
    gap: "0.4rem"
  },
  svgPreviewWrapper: {
    padding: "0.5rem",
    backgroundColor: "#0B0F19"
  }
};

