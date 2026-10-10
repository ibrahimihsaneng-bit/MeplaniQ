import React from "react";

export default function AreaToPlanSummary({ targetAreaSqft, rooms }) {
  const SQFT_TO_SQM = 0.092903;
  const SQM_TO_SQFT = 1 / SQFT_TO_SQM;

  const totalProgrammedSqft = rooms.reduce((acc, r) => {
    const w = parseFloat(r.width_mm) || 0;
    const d = parseFloat(r.depth_mm) || 0;
    const areaSqm = (w * d) / 1000000.0;
    return acc + areaSqm * SQM_TO_SQFT;
  }, 0);

  const totalProgrammedSqm = totalProgrammedSqft * SQFT_TO_SQM;
  const targetAreaSqm = targetAreaSqft * SQFT_TO_SQM;
  const deltaSqft = totalProgrammedSqft - targetAreaSqft;
  const deltaPercent = targetAreaSqft > 0 ? (deltaSqft / targetAreaSqft) * 100 : 0;

  const isBalanced = Math.abs(deltaPercent) <= 5.0;
  const isWarning = Math.abs(deltaPercent) > 15.0;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "10px",
        padding: "1rem 1.25rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <div>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 700 }}>
          Target Gross Area
        </span>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
          {Math.round(targetAreaSqft).toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>sq.ft</span>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          ≈ {targetAreaSqm.toFixed(1)} m²
        </div>
      </div>

      <div>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 700 }}>
          Programmed Net Carpet
        </span>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent-blue)", marginTop: "2px" }}>
          {Math.round(totalProgrammedSqft).toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>sq.ft</span>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          {totalProgrammedSqm.toFixed(1)} m² ({rooms.length} spaces)
        </div>
      </div>

      <div>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 700 }}>
          Budget Delta
        </span>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: isWarning ? "#EB5757" : isBalanced ? "#27AE60" : "#F2994A",
            marginTop: "2px",
          }}
        >
          {deltaSqft >= 0 ? `+${Math.round(deltaSqft)}` : `${Math.round(deltaSqft)}`}{" "}
          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>sq.ft</span>
        </div>
        <div style={{ fontSize: "0.8rem", color: isWarning ? "#EB5757" : isBalanced ? "#27AE60" : "#F2994A", fontWeight: 600 }}>
          {deltaPercent >= 0 ? `+${deltaPercent.toFixed(1)}%` : `${deltaPercent.toFixed(1)}%`}{" "}
          {isBalanced ? "✓ Well Balanced" : deltaSqft < 0 ? "(Under budget)" : "(Over budget)"}
        </div>
      </div>

      <div>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 700 }}>
          Wall & Circulation Est.
        </span>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
          {Math.max(0, Math.round(targetAreaSqft - totalProgrammedSqft)).toLocaleString()}{" "}
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>sq.ft</span>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          ~{Math.max(0, Math.round(((targetAreaSqft - totalProgrammedSqft) / targetAreaSqft) * 100))}% envelope factor
        </div>
      </div>
    </div>
  );
}
