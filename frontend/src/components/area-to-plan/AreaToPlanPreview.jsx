import React from "react";

const CATEGORY_COLORS = {
  Living: { fill: "rgba(47, 128, 237, 0.15)", stroke: "#2F80ED", text: "#2F80ED" },
  Dining: { fill: "rgba(86, 204, 242, 0.15)", stroke: "#56CCF2", text: "#56CCF2" },
  Kitchen: { fill: "rgba(242, 153, 74, 0.15)", stroke: "#F2994A", text: "#F2994A" },
  Bedroom: { fill: "rgba(155, 81, 224, 0.15)", stroke: "#9B51E0", text: "#BB6BD9" },
  Bathroom: { fill: "rgba(39, 174, 96, 0.15)", stroke: "#27AE60", text: "#27AE60" },
  Balcony: { fill: "rgba(235, 87, 87, 0.15)", stroke: "#EB5757", text: "#EB5757" },
  General: { fill: "rgba(180, 190, 200, 0.15)", stroke: "#828282", text: "#BDBDBD" },
};

export default function AreaToPlanPreview({ rooms }) {
  if (!rooms || rooms.length === 0) {
    return (
      <div
        style={{
          height: "260px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-panel)",
          border: "1px dashed var(--border-subtle)",
          borderRadius: "10px",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
        }}
      >
        No rooms defined yet. Add rooms or generate a proposal to preview.
      </div>
    );
  }

  // Calculate deterministic layout coordinates matching backend packing
  const publicCategories = new Set(["Living", "Dining", "Kitchen", "Balcony", "Entry", "Porch", "Public"]);
  let band0 = [];
  let band1 = [];

  if (rooms.length <= 2) {
    band0 = [...rooms];
  } else {
    rooms.forEach((r) => {
      if (publicCategories.has(r.category)) {
        band0.push(r);
      } else {
        band1.push(r);
      }
    });

    if (band0.length === 0 && band1.length > 0) {
      const half = Math.floor(band1.length / 2);
      band0 = band1.slice(0, half);
      band1 = band1.slice(half);
    } else if (band1.length === 0 && band0.length > 0) {
      const half = Math.floor(band0.length / 2);
      band1 = band0.slice(half);
      band0 = band0.slice(0, half);
    }
  }

  const packedRects = [];
  let currentX = 0;
  let band0MaxDepth = 0;

  band0.forEach((r) => {
    const w = parseFloat(r.width_mm) || 3600;
    const d = parseFloat(r.depth_mm) || 3000;
    packedRects.push({
      ...r,
      x: currentX,
      y: 0,
      w,
      d,
    });
    currentX += w;
    if (d > band0MaxDepth) band0MaxDepth = d;
  });

  if (band1.length > 0) {
    currentX = 0;
    const baseY = band0MaxDepth;
    band1.forEach((r) => {
      const w = parseFloat(r.width_mm) || 3600;
      const d = parseFloat(r.depth_mm) || 3000;
      packedRects.push({
        ...r,
        x: currentX,
        y: baseY,
        w,
        d,
      });
      currentX += w;
    });
  }

  // Determine bounding box
  let minX = 0;
  let maxX = 1000;
  let minY = 0;
  let maxY = 1000;

  packedRects.forEach((r) => {
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.d > maxY) maxY = r.y + r.d;
  });

  const padX = (maxX - minX) * 0.08;
  const padY = (maxY - minY) * 0.08;
  const viewBox = `${minX - padX} ${minY - padY} ${maxX - minX + padX * 2} ${maxY - minY + padY * 2}`;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "10px",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
          📐 Spatial Arrangement Preview (Top-Down 2D)
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Total Footprint: {((maxX - minX) / 1000).toFixed(1)}m × {((maxY - minY) / 1000).toFixed(1)}m
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: "260px",
          backgroundColor: "#0D1117",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox={viewBox}
          style={{ width: "100%", height: "100%", transform: "scaleY(-1)" }} // Flip Y so 0,0 is bottom-left
        >
          {/* Subtle grid pattern background */}
          <defs>
            <pattern id="preview-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
              <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="50" />
            </pattern>
          </defs>
          <rect
            x={minX - padX}
            y={minY - padY}
            width={maxX - minX + padX * 2}
            height={maxY - minY + padY * 2}
            fill="url(#preview-grid)"
          />

          {/* Room Rectangles */}
          {packedRects.map((r, idx) => {
            const theme = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.General;
            const wM = (r.w / 1000).toFixed(1);
            const dM = (r.d / 1000).toFixed(1);

            return (
              <g key={`preview-room-${idx}`}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.d}
                  fill={theme.fill}
                  stroke={theme.stroke}
                  strokeWidth="60"
                  rx="40"
                  ry="40"
                />
                {/* Text rendered in un-flipped scale so letters are right-side-up */}
                <g transform={`translate(${r.x + r.w / 2}, ${r.y + r.d / 2}) scale(1, -1)`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#FFFFFF"
                    fontSize="320"
                    fontWeight="700"
                    style={{ fontFamily: "inherit" }}
                  >
                    {r.name}
                  </text>
                  <text
                    y="380"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={theme.text}
                    fontSize="240"
                    fontWeight="600"
                    style={{ fontFamily: "inherit" }}
                  >
                    {wM}m × {dM}m ({( (r.w * r.d) / 1000000 ).toFixed(1)} m²)
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
