import React, { useState } from "react";

const CATEGORIES = ["Living", "Dining", "Kitchen", "Bedroom", "Bathroom", "Balcony", "General"];

export default function AreaToPlanRoomTable({ rooms, onUpdateRooms }) {
  const [newRoomName, setNewRoomName] = useState("");
  const [newCategory, setNewCategory] = useState("Bedroom");
  const [newWidth, setNewWidth] = useState(3600);
  const [newDepth, setNewDepth] = useState(3000);

  const handleCellChange = (index, field, value) => {
    const updated = rooms.map((r, i) => {
      if (i !== index) return r;
      const mod = { ...r, [field]: value };
      if (field === "width_mm" || field === "depth_mm") {
        const w = parseFloat(field === "width_mm" ? value : r.width_mm) || 0;
        const d = parseFloat(field === "depth_mm" ? value : r.depth_mm) || 0;
        const areaSqm = (w * d) / 1000000.0;
        mod.area_sqm = Math.round(areaSqm * 100) / 100;
        mod.area_sqft = Math.round(areaSqm * 10.7639 * 10) / 10;
      }
      return mod;
    });
    onUpdateRooms(updated);
  };

  const handleDeleteRoom = (index) => {
    if (rooms.length <= 1) {
      alert("At least one room is required for a valid floorplan.");
      return;
    }
    const updated = rooms.filter((_, i) => i !== index);
    onUpdateRooms(updated);
  };

  const handleAddRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert("Please provide a name for the new room.");
      return;
    }
    const w = parseFloat(newWidth) || 3000;
    const d = parseFloat(newDepth) || 3000;
    const areaSqm = (w * d) / 1000000.0;
    const newRoom = {
      name: newRoomName.trim(),
      category: newCategory,
      width_mm: w,
      depth_mm: d,
      area_sqm: Math.round(areaSqm * 100) / 100,
      area_sqft: Math.round(areaSqm * 10.7639 * 10) / 10,
    };
    onUpdateRooms([...rooms, newRoom]);
    setNewRoomName("");
    setNewWidth(3600);
    setNewDepth(3000);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "10px",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
          📋 Programmed Spaces & Dimensions ({rooms.length})
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Dimensions are in millimetres (mm)
        </span>
      </div>

      <div style={{ overflowX: "auto", maxHeight: "280px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>Space Name</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>Category</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>Width (mm)</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>Depth (mm)</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>Carpet Area</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r, index) => {
              const isInvalidDim = (r.width_mm || 0) < 1200 || (r.depth_mm || 0) < 1200;

              return (
                <tr
                  key={`room-row-${index}`}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: index % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                  }}
                >
                  <td style={{ padding: "6px 12px" }}>
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => handleCellChange(index, "name", e.target.value)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-subtle)",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        width: "100%",
                        minWidth: "120px",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 12px" }}>
                    <select
                      value={r.category || "General"}
                      onChange={(e) => handleCellChange(index, "category", e.target.value)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-subtle)",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "6px 12px" }}>
                    <input
                      type="number"
                      step="100"
                      min="1200"
                      value={r.width_mm}
                      onChange={(e) => handleCellChange(index, "width_mm", parseFloat(e.target.value) || 0)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: isInvalidDim ? "#EB5757" : "var(--text-primary)",
                        border: `1px solid ${isInvalidDim ? "#EB5757" : "var(--border-subtle)"}`,
                        padding: "5px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        width: "90px",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 12px" }}>
                    <input
                      type="number"
                      step="100"
                      min="1200"
                      value={r.depth_mm}
                      onChange={(e) => handleCellChange(index, "depth_mm", parseFloat(e.target.value) || 0)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: isInvalidDim ? "#EB5757" : "var(--text-primary)",
                        border: `1px solid ${isInvalidDim ? "#EB5757" : "var(--border-subtle)"}`,
                        padding: "5px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        width: "90px",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.area_sqm} m²</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "4px" }}>
                      ({r.area_sqft} sq.ft)
                    </span>
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    <button
                      onClick={() => handleDeleteRoom(index)}
                      title="Remove Room"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#EB5757",
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Space Form */}
      <form
        onSubmit={handleAddRoom}
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <input
          type="text"
          placeholder="New Room Name (e.g. Study)"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          style={{
            backgroundColor: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "0.82rem",
            flex: 1,
            minWidth: "140px",
          }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={{
            backgroundColor: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "0.82rem",
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            type="number"
            step="100"
            min="1200"
            placeholder="Width"
            value={newWidth}
            onChange={(e) => setNewWidth(e.target.value)}
            style={{
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              padding: "6px 8px",
              borderRadius: "6px",
              fontSize: "0.82rem",
              width: "75px",
            }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>×</span>
          <input
            type="number"
            step="100"
            min="1200"
            placeholder="Depth"
            value={newDepth}
            onChange={(e) => setNewDepth(e.target.value)}
            style={{
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              padding: "6px 8px",
              borderRadius: "6px",
              fontSize: "0.82rem",
              width: "75px",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            padding: "6px 14px",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.82rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>➕</span>
          <span>Add Space</span>
        </button>
      </form>
    </div>
  );
}
