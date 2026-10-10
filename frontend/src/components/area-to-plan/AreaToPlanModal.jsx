import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAreaProgramProposal, generateProjectFromArea } from "../../api";
import AreaToPlanSummary from "./AreaToPlanSummary";
import AreaToPlanPreview from "./AreaToPlanPreview";
import AreaToPlanRoomTable from "./AreaToPlanRoomTable";

const PRESETS = [
  { label: "800 sq.ft (Compact 2-BHK)", sqft: 800, beds: 2, baths: 1 },
  { label: "1,200 sq.ft (Standard 3-BHK)", sqft: 1200, beds: 3, baths: 2 },
  { label: "1,800 sq.ft (Spacious Villa)", sqft: 1800, beds: 3, baths: 3 },
  { label: "2,500 sq.ft (Luxury Residence)", sqft: 2500, beds: 4, baths: 4 },
];

export default function AreaToPlanModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  // Step state: 1 (Config), 2 (Review & Refine), 3 (Generating Telemetry)
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("Modern Residence");
  const [unit, setUnit] = useState("sqft"); // "sqft" | "sqm"
  const [targetAreaInput, setTargetAreaInput] = useState(1200);

  // Requirements
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [includeKitchen, setIncludeKitchen] = useState(true);
  const [includeDining, setIncludeDining] = useState(true);
  const [includeLiving, setIncludeLiving] = useState(true);
  const [includeBalcony, setIncludeBalcony] = useState(false);

  // Plot Constraints & MEP Automation
  const [includeMep, setIncludeMep] = useState(true);
  const [plotWidth, setPlotWidth] = useState("");
  const [plotDepth, setPlotDepth] = useState("");
  const [frontSetback, setFrontSetback] = useState("");
  const [rearSetback, setRearSetback] = useState("");
  const [showPlotConstraints, setShowPlotConstraints] = useState(false);

  // Program & generation state
  const [rooms, setRooms] = useState([]);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [generatingCad, setGeneratingCad] = useState(false);
  const [error, setError] = useState(null);
  const [telemetryStage, setTelemetryStage] = useState(0);

  if (!isOpen) return null;

  const targetAreaSqft = unit === "sqm" ? (parseFloat(targetAreaInput) || 0) * 10.7639 : parseFloat(targetAreaInput) || 0;

  const handleApplyPreset = (p) => {
    setTargetAreaInput(unit === "sqm" ? Math.round(p.sqft * 0.092903) : p.sqft);
    setBedrooms(p.beds);
    setBathrooms(p.baths);
  };

  const handleFetchProposal = async (e) => {
    if (e) e.preventDefault();
    if (!projectName.trim()) {
      setError("Please specify a project name.");
      return;
    }
    if (targetAreaSqft < 250) {
      setError("Target area must be at least 250 sq.ft (≈23 m²).");
      return;
    }

    try {
      setLoadingProposal(true);
      setError(null);
      const res = await fetchAreaProgramProposal({
        target_area_sqft: targetAreaSqft,
        bedrooms,
        bathrooms,
        include_kitchen: includeKitchen,
        include_dining: includeDining,
        include_living: includeLiving,
        include_balcony: includeBalcony,
      });

      if (res && res.rooms) {
        setRooms(res.rooms);
        setStep(2);
      } else {
        throw new Error("Received empty room program from server.");
      }
    } catch (err) {
      setError(`Failed to generate room program: ${err.message}`);
    } finally {
      setLoadingProposal(false);
    }
  };

  const handleGenerateCad = async () => {
    if (!rooms || rooms.length === 0) {
      setError("Room program is empty. Please add at least one space.");
      return;
    }

    try {
      setGeneratingCad(true);
      setStep(3);
      setError(null);

      // Progressive telemetry simulation for technical feedback
      setTelemetryStage(1);
      await new Promise((r) => setTimeout(r, 350));
      setTelemetryStage(2);
      await new Promise((r) => setTimeout(r, 400));
      setTelemetryStage(3);

      const payload = {
        name: projectName.trim(),
        target_area_sqft: targetAreaSqft,
        include_mep: includeMep,
        plot_width_ft: plotWidth ? parseFloat(plotWidth) : null,
        plot_depth_ft: plotDepth ? parseFloat(plotDepth) : null,
        front_setback_ft: frontSetback ? parseFloat(frontSetback) : null,
        rear_setback_ft: rearSetback ? parseFloat(rearSetback) : null,
        rooms: rooms.map((r) => ({
          name: r.name,
          category: r.category || "General",
          width_mm: parseFloat(r.width_mm) || 3000,
          depth_mm: parseFloat(r.depth_mm) || 3000,
        })),
        requirements: {
          bedrooms,
          bathrooms,
          include_kitchen: includeKitchen,
          include_dining: includeDining,
          include_living: includeLiving,
          include_balcony: includeBalcony,
          include_mep: includeMep,
        },
      };

      const solved = await generateProjectFromArea(payload);

      setTelemetryStage(4);
      await new Promise((r) => setTimeout(r, 300));
      setTelemetryStage(5);

      if (solved && solved.project_id) {
        onClose();
        navigate(`/projects/${encodeURIComponent(solved.project_id)}/cad`);
      } else {
        throw new Error("Server did not return a valid project ID.");
      }
    } catch (err) {
      setError(`CAD Generation Failed: ${err.message}`);
      setStep(2); // return to review step on failure
    } finally {
      setGeneratingCad(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !generatingCad) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-workspace)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: step === 2 ? "1080px" : "680px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          transition: "max-width 0.25s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>📐</span>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                AI Square-Footage to Parametric CAD Floorplan
              </h2>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {step === 1 && "Step 1 of 2: Define your building scope, target square-footage, and room requirements."}
              {step === 2 && "Step 2 of 2: Review room dimensions, adjust proportions, and generate parametric CAD geometry."}
              {step === 3 && "Executing deterministic spatial packing & computational CAD solve..."}
            </p>
          </div>

          {!generatingCad && (
            <button
              onClick={onClose}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "rgba(235, 87, 87, 0.15)",
              borderBottom: "1px solid rgba(235, 87, 87, 0.3)",
              color: "#EB5757",
              fontSize: "0.88rem",
              fontWeight: 500,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
          {step === 1 && (
            <form onSubmit={handleFetchProposal} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Project Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Modern Two-Story Residence"
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              {/* Target Area & Unit Toggle */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Target Building Area
                  </label>
                  <div style={{ display: "flex", border: "1px solid var(--border-subtle)", borderRadius: "6px", overflow: "hidden" }}>
                    <button
                      type="button"
                      onClick={() => setUnit("sqft")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: unit === "sqft" ? "var(--accent-blue)" : "var(--bg-panel)",
                        color: unit === "sqft" ? "#FFFFFF" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      sq.ft
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit("sqm")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: unit === "sqm" ? "var(--accent-blue)" : "var(--bg-panel)",
                        color: unit === "sqm" ? "#FFFFFF" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      m²
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="number"
                    step={unit === "sqm" ? "1" : "10"}
                    min={unit === "sqm" ? "25" : "250"}
                    required
                    value={targetAreaInput}
                    onChange={(e) => setTargetAreaInput(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: "var(--bg-input)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", width: "120px" }}>
                    {unit === "sqft" ? `≈ ${(targetAreaSqft * 0.092903).toFixed(1)} m²` : `≈ ${Math.round(targetAreaSqft)} sq.ft`}
                  </div>
                </div>

                {/* Architectural Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      style={{
                        backgroundColor: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-subtle)",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Mix Requirements */}
              <div
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Architectural Room Program Presets
                </span>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                  {/* Bedrooms */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Bedrooms
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={`bed-${num}`}
                          type="button"
                          onClick={() => setBedrooms(num)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: "6px",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            backgroundColor: bedrooms === num ? "var(--accent-blue)" : "var(--bg-input)",
                            color: bedrooms === num ? "#FFFFFF" : "var(--text-primary)",
                            border: "1px solid var(--border-subtle)",
                            cursor: "pointer",
                          }}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bathrooms */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Bathrooms
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={`bath-${num}`}
                          type="button"
                          onClick={() => setBathrooms(num)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: "6px",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            backgroundColor: bathrooms === num ? "var(--accent-blue)" : "var(--bg-input)",
                            color: bathrooms === num ? "#FFFFFF" : "var(--text-primary)",
                            border: "1px solid var(--border-subtle)",
                            cursor: "pointer",
                          }}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Zones Checklist */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeLiving}
                      onChange={(e) => setIncludeLiving(e.target.checked)}
                    />
                    Living Room
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeDining}
                      onChange={(e) => setIncludeDining(e.target.checked)}
                    />
                    Dining Room
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeKitchen}
                      onChange={(e) => setIncludeKitchen(e.target.checked)}
                    />
                    Kitchen
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeBalcony}
                      onChange={(e) => setIncludeBalcony(e.target.checked)}
                    />
                    Balcony / Verandah
                  </label>
                </div>
              </div>

              {/* Optional Plot Dimension Envelope */}
              <div
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "0.85rem 1.25rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowPlotConstraints(!showPlotConstraints)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>🏡</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      Plot Boundary & Setbacks (Optional)
                    </span>
                    {plotWidth && plotDepth && (
                      <span style={{ fontSize: "0.75rem", backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38BDF8", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                        {plotWidth}ft × {plotDepth}ft
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {showPlotConstraints ? "▲ Hide" : "▼ Specify Plot"}
                  </span>
                </div>

                {showPlotConstraints && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.85rem", marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle)" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Plot Width (ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 30"
                        value={plotWidth}
                        onChange={(e) => setPlotWidth(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Plot Depth (ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 40"
                        value={plotDepth}
                        onChange={(e) => setPlotDepth(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Front Setback (ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 5"
                        value={frontSetback}
                        onChange={(e) => setFrontSetback(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Rear Setback (ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 3"
                        value={rearSetback}
                        onChange={(e) => setRearSetback(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA */}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingProposal}
                  style={{
                    backgroundColor: "var(--accent-blue)",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 22px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: loadingProposal ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 8px rgba(47, 128, 237, 0.35)",
                  }}
                >
                  <span>{loadingProposal ? "Calculating..." : "Generate Room Program ➔"}</span>
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Summary Metrics */}
              <AreaToPlanSummary targetAreaSqft={targetAreaSqft} rooms={rooms} />

              {/* Grid: Preview & Room Table */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(300px, 1fr) minmax(360px, 1.2fr)",
                  gap: "1.25rem",
                  alignItems: "start",
                }}
              >
                <AreaToPlanPreview rooms={rooms} />
                <AreaToPlanRoomTable rooms={rooms} onUpdateRooms={setRooms} />
              </div>

              {/* ⚡ Instant Complete MEP & Furnishing Toggle Card */}
              <div
                style={{
                  padding: "0.85rem 1.15rem",
                  backgroundColor: includeMep ? "rgba(14, 165, 233, 0.12)" : "var(--bg-panel)",
                  border: includeMep ? "1px solid #38BDF8" : "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => setIncludeMep(!includeMep)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <span style={{ fontSize: "1.4rem" }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: includeMep ? "#38BDF8" : "var(--text-primary)" }}>
                      Pre-populate Full MEP Engineering & Furnishing
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      Includes electrical downlights, ceiling fans, AC split units, plumbing dual lines (cold/hot/drain) & clearance-tested furniture
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={includeMep}
                  onChange={(e) => setIncludeMep(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: "19px", height: "19px", accentColor: "#0284C7", cursor: "pointer" }}
                />
              </div>

              {/* Step 2 Actions */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  ◀ Back to Specs
                </button>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                      padding: "9px 16px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateCad}
                    style={{
                      backgroundColor: "var(--accent-blue)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "9px 24px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 2px 10px rgba(47, 128, 237, 0.4)",
                    }}
                  >
                    <span>📐</span>
                    <span>Generate Parametric CAD Floorplan</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div
              style={{
                padding: "2.5rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.5rem",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  border: "4px solid rgba(47, 128, 237, 0.2)",
                  borderTopColor: "var(--accent-blue)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />

              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
                  Generating Parametric Floorplan
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Solving 2D computational geometry and wall offsets...
                </p>
              </div>

              {/* Technical Telemetry Checklist */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "420px",
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ color: telemetryStage >= 1 ? "#27AE60" : "var(--text-secondary)" }}>
                  {telemetryStage >= 1 ? "✓" : "○"} Validating area requirements & room aspect ratios
                </div>
                <div style={{ color: telemetryStage >= 2 ? "#27AE60" : "var(--text-secondary)" }}>
                  {telemetryStage >= 2 ? "✓" : "○"} Solving 2D spatial packing & party walls
                </div>
                <div style={{ color: telemetryStage >= 3 ? "#27AE60" : "var(--text-secondary)" }}>
                  {telemetryStage >= 3 ? "✓" : "○"} Deriving wall offsets (230mm/115mm) & filleted corners
                </div>
                <div style={{ color: telemetryStage >= 4 ? "#27AE60" : "var(--text-secondary)" }}>
                  {telemetryStage >= 4 ? "✓" : "○"} Persisting floorplan to SQLite CAD database
                </div>
                <div style={{ color: telemetryStage >= 5 ? "#2F80ED" : "var(--text-secondary)", fontWeight: 600 }}>
                  {telemetryStage >= 5 ? "➔" : "○"} Launching CAD Canvas Workspace...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
