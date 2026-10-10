import React, { useState } from "react";
import { getProjectBoqPdfUrl } from "../../api";

export default function BoqDashboardModal({
  isOpen,
  onClose,
  boqData,
  projectId,
  projectName = "Floorplan",
  onSwitchTier,
  isRecalculating = false,
  onOpenTierSelector
}) {
  const [activeTab, setActiveTab] = useState("civil");

  if (!isOpen || !boqData) return null;

  const currentTier = boqData.quality_tier || "medium";
  const summary = boqData.summary || {};
  const civil = boqData.civil_materials || {};
  const schedule = boqData.construction_schedule || {};
  const labor = boqData.labor || {};
  const electrical = boqData.electrical || {};
  const plumbing = boqData.plumbing || {};
  const hvac = boqData.hvac || {};
  const furniture = boqData.furniture || {};
  const percentages = boqData.percentages || {};

  const pdfUrl = projectId ? getProjectBoqPdfUrl(projectId, currentTier) : null;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const tabs = [
    { id: "civil", label: "🧱 Civil & Structural", count: `${civil.cement_total_bags || 0} Bags` },
    { id: "schedule", label: "⏱️ Schedule & Labor", count: `${schedule.total_working_days || 0} Days` },
    { id: "furniture", label: "🛋️ Furniture & Fitout", count: `${furniture.items?.length || 0} Items` },
    { id: "electrical", label: "⚡ Electrical", count: `${electrical.items?.length || 0} Items` },
    { id: "plumbing", label: "🚰 Plumbing", count: `${plumbing.items?.length || 0} Items` },
    { id: "hvac", label: "❄️ HVAC Climate", count: `${hvac.items?.length || 0} Units` },
    { id: "distribution", label: "📊 Cost Rollup", count: "100%" }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      className="animate-in fade-in duration-200"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1240px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '92vh'
        }}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 text-xl font-bold shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Bill of Materials (BOQ) & Cost Estimation
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {projectName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Built-up: <span className="text-slate-200 font-semibold">{summary.total_builtup_sqft?.toLocaleString()} sq.ft</span> ({summary.total_builtup_sqm} m²) • Carpet: <span className="text-slate-200 font-semibold">{summary.total_carpet_sqft?.toLocaleString()} sq.ft</span>
              </p>
            </div>
          </div>

          {/* Tier Switcher Pills & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Click Tier Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
              <button
                onClick={() => onSwitchTier("low")}
                disabled={isRecalculating}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  currentTier === "low"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🟢 Budget (Low)
              </button>
              <button
                onClick={() => onSwitchTier("medium")}
                disabled={isRecalculating}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  currentTier === "medium"
                    ? "bg-sky-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🔵 Standard (Medium)
              </button>
              <button
                onClick={() => onSwitchTier("high")}
                disabled={isRecalculating}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  currentTier === "high"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🟣 Luxury (High)
              </button>
            </div>

            {/* Change Tier / Details Modal Button */}
            {onOpenTierSelector && (
              <button
                onClick={onOpenTierSelector}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="View Tier Details and Specifications"
              >
                ⚙️ Specs
              </button>
            )}

            {/* Export Dedicated PDF */}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-md shadow-red-900/20 flex items-center gap-1.5 transition"
              >
                <span>📄 Export PDF</span>
              </a>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close BOQ Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Recalculating Overlay Bar */}
        {isRecalculating && (
          <div className="bg-sky-500/20 border-b border-sky-500/40 px-6 py-1.5 text-xs text-sky-300 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-sky-300/30 border-t-sky-300 rounded-full animate-spin" />
            Recalculating quantities and rates for <strong className="capitalize">{currentTier}</strong> tier...
          </div>
        )}

        {/* Executive KPI Metric Grid */}
        <div className="p-4 md:px-6 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Grand Total */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Grand Total</div>
            <div className="text-base md:text-lg font-black text-white mt-1">
              {formatCurrency(summary.grand_total)}
            </div>
            <div className="text-[11px] text-sky-400 font-mono mt-0.5">
              ₹ {summary.cost_per_sqft_builtup?.toLocaleString()} / sq.ft
            </div>
          </div>

          {/* Card 2: Timeline */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Duration</div>
            <div className="text-base md:text-lg font-black text-amber-400 mt-1">
              {schedule.total_working_days} Days
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ~{schedule.total_months} Months (7 Phases)
            </div>
          </div>

          {/* Card 3: Wall Blocks */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Wall Masonry</div>
            <div className="text-base md:text-lg font-black text-emerald-400 mt-1">
              {civil.solid_blocks_count?.toLocaleString()} Units
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              or {civil.standard_bricks_count?.toLocaleString()} Red Bricks
            </div>
          </div>

          {/* Card 4: Cement */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Cement (50kg)</div>
            <div className="text-base md:text-lg font-black text-white mt-1">
              {civil.cement_total_bags?.toLocaleString()} Bags
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              RCC, Plaster & Mortar
            </div>
          </div>

          {/* Card 5: Sand */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sand (M & P)</div>
            <div className="text-base md:text-lg font-black text-sky-400 mt-1">
              {civil.total_sand_cft?.toLocaleString()} CFT
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {civil.total_sand_tons} Metric Tons
            </div>
          </div>

          {/* Card 6: Labor Wages */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Labor Wages</div>
            <div className="text-base md:text-lg font-black text-indigo-400 mt-1">
              {formatCurrency(labor.total_cost)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {labor.total_mandays} Mandays Total
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-900/90 flex gap-2 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-400 bg-sky-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50">
          {/* TAB 1: CIVIL & STRUCTURAL */}
          {activeTab === "civil" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Civil & Structural Materials Schedule</h3>
                  <p className="text-xs text-slate-400">
                    Quantities derived directly from CAD wall geometry, openings deductions, and structural load standards.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Subtotal Civil Materials</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(civil.total_cost)}</div>
                </div>
              </div>

              {/* Civil Materials Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Material / Item</th>
                      <th className="py-3 px-4">Technical Specification</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Unit Rate</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🧱 Wall Masonry Units</td>
                      <td className="py-3 px-4 text-slate-400">
                        Solid concrete blocks (400x200x150mm) or wire-cut bricks based on 3.0m ceiling height
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.solid_blocks_count?.toLocaleString()} Units</td>
                      <td className="py-3 px-4 text-right font-mono">₹ {civil.solid_block_unit_cost?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.solid_blocks_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🏷️ Cement (50kg Bags)</td>
                      <td className="py-3 px-4 text-slate-400">
                        {civil.cement_brand}
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Masonry: {civil.cement_breakdown?.masonry_mortar_bags} bags | Plaster: {civil.cement_breakdown?.plastering_bags} bags | RCC: {civil.cement_breakdown?.rcc_structure_bags} bags | Flooring: {civil.cement_breakdown?.flooring_screed_bags} bags
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.cement_total_bags?.toLocaleString()} Bags</td>
                      <td className="py-3 px-4 text-right font-mono">₹ {civil.cement_bag_cost?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.cement_total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">⏳ M-Sand (Manufactured Sand)</td>
                      <td className="py-3 px-4 text-slate-400">
                        Graded concrete and structural masonry sand ({civil.msand_tons} Metric Tons)
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.msand_cft?.toLocaleString()} CFT</td>
                      <td className="py-3 px-4 text-right font-mono">₹ 62.00 / CFT</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.msand_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">⏳ P-Sand (Plastering Sand)</td>
                      <td className="py-3 px-4 text-slate-400">
                        Fine washed sand for smooth interior and exterior plastering ({civil.psand_tons} Metric Tons)
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.psand_cft?.toLocaleString()} CFT</td>
                      <td className="py-3 px-4 text-right font-mono">₹ 70.00 / CFT</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.psand_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🏗️ TMT Rebar Steel</td>
                      <td className="py-3 px-4 text-slate-400">
                        Fe550D High-Yield Earthquake Resistant Steel ({civil.steel_metric_tons} Metric Tons)
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.steel_kg?.toLocaleString()} kg</td>
                      <td className="py-3 px-4 text-right font-mono">₹ 72.00 / kg</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.steel_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🪨 Coarse Aggregate Metal</td>
                      <td className="py-3 px-4 text-slate-400">
                        20mm & 40mm Graded Blue Metal Granite ({civil.aggregate_tons} Metric Tons)
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.aggregate_cft?.toLocaleString()} CFT</td>
                      <td className="py-3 px-4 text-right font-mono">₹ 48.00 / CFT</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.aggregate_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">✨ Flooring & Wall Tiling</td>
                      <td className="py-3 px-4 text-slate-400">
                        Double-charged vitrified tiles / marble based on active tier
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{civil.flooring_sqft?.toLocaleString()} sq.ft</td>
                      <td className="py-3 px-4 text-right font-mono">₹ 140.00 / sq.ft</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.flooring_cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Geometry Details Card */}
              {civil.wall_geometry && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
                  <div className="font-semibold text-white mb-2">📐 Architectural Geometry Takeoffs:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-slate-400">Wall Length: </span>
                      <strong className="text-white">{civil.wall_geometry.total_wall_length_m} m</strong>
                      <div className="text-[10px] text-slate-500">Ext: {civil.wall_geometry.exterior_wall_length_m}m | Int: {civil.wall_geometry.interior_wall_length_m}m</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Net Masonry Vol: </span>
                      <strong className="text-white">{civil.wall_geometry.net_masonry_volume_m3} m³</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Plaster Area: </span>
                      <strong className="text-white">{civil.wall_geometry.total_plaster_area_m2} m²</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Openings Deducted: </span>
                      <strong className="text-white">{civil.wall_geometry.door_count} Doors, {civil.wall_geometry.window_count} Windows</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULE & LABOR */}
          {activeTab === "schedule" && (
            <div className="space-y-6">
              {/* Timeline Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">7-Phase Construction Timeline Schedule</h3>
                  <p className="text-xs text-slate-400">
                    Estimated working days and phased milestone progression from site mobilization to final handover.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Duration</div>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {schedule.total_working_days} Days (~{schedule.total_months} Months)
                  </div>
                </div>
              </div>

              {/* 7-Phase Gantt-like List */}
              <div className="space-y-3">
                {schedule.phases?.map((p, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          Phase {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-white">{p.phase_name}</h4>
                      </div>
                      <div className="text-xs font-mono font-semibold text-slate-300">
                        {p.duration_days} Days ({p.start_day} – {p.end_day})
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sky-500 to-blue-600 h-2 rounded-full"
                        style={{ width: `${p.progress_percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400">{p.description}</p>
                  </div>
                ))}
              </div>

              {/* Labor Workforce Breakdown */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Labor Workforce & Mandays Schedule</h3>
                    <p className="text-xs text-slate-400">
                      Trade wages and total mandays allocated across construction lifecycle.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Labor Cost</div>
                    <div className="text-lg font-bold text-indigo-400 font-mono">{formatCurrency(labor.total_cost)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Labor Role / Trade</th>
                        <th className="py-3 px-4 text-right">Estimated Mandays</th>
                        <th className="py-3 px-4 text-right">Daily Wage (₹)</th>
                        <th className="py-3 px-4 text-right">Total Wage Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {labor.breakdown?.map((l, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-white">{l.role}</td>
                          <td className="py-3 px-4 text-right font-mono">{l.mandays} Mandays</td>
                          <td className="py-3 px-4 text-right font-mono">₹ {l.daily_wage?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(l.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FURNITURE & WOODWORK */}
          {activeTab === "furniture" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Architectural Furniture Fitout</h3>
                  <p className="text-xs text-slate-400">
                    Finish Specification: <span className="text-slate-200 font-medium">{furniture.finish_specification}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Furniture Cost</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(furniture.total_cost)}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Host Room</th>
                      <th className="py-3 px-4">Specification & Joinery</th>
                      <th className="py-3 px-4 text-right">Fitout Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {furniture.items?.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-slate-400">{f.item_id}</td>
                        <td className="py-3 px-4 font-semibold text-white">{f.name}</td>
                        <td className="py-3 px-4 text-slate-300">{f.room}</td>
                        <td className="py-3 px-4 text-slate-400">{f.finish}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(f.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ELECTRICAL */}
          {activeTab === "electrical" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Electrical Engineering Schedule</h3>
                  <p className="text-xs text-slate-400">
                    Distribution board, lighting points, power sockets, AC isolators, and heavy concealed conduits.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Electrical Cost</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(electrical.total_cost)}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Line Item</th>
                      <th className="py-3 px-4 text-right">Quantity / Scope</th>
                      <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {electrical.items?.map((el, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{el.item}</td>
                        <td className="py-3 px-4 text-right font-mono">{el.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono">₹ {el.unit_rate?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(el.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PLUMBING */}
          {activeTab === "plumbing" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Plumbing & Sanitary Schedule</h3>
                  <p className="text-xs text-slate-400">
                    Sanitaryware fixtures, mixers, taps, CPVC hot/cold water supply, and SWR soil drainage lines.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Plumbing Cost</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(plumbing.total_cost)}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Line Item</th>
                      <th className="py-3 px-4 text-right">Quantity / Scope</th>
                      <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {plumbing.items?.map((pl, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{pl.item}</td>
                        <td className="py-3 px-4 text-right font-mono">{pl.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono">₹ {pl.unit_rate?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(pl.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: HVAC */}
          {activeTab === "hvac" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">HVAC Climate Systems Schedule</h3>
                  <p className="text-xs text-slate-400">
                    Specification: <span className="text-slate-200 font-medium">{hvac.brand_spec}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total HVAC Cost</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(hvac.total_cost)}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Equipment Unit</th>
                      <th className="py-3 px-4">Host Room</th>
                      <th className="py-3 px-4">Specification</th>
                      <th className="py-3 px-4 text-right">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {hvac.items?.map((hv, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-slate-400">{hv.item_id}</td>
                        <td className="py-3 px-4 font-semibold text-white">{hv.equipment}</td>
                        <td className="py-3 px-4 text-slate-300">{hv.room}</td>
                        <td className="py-3 px-4 text-slate-400">{hv.specification}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(hv.unit_cost)}</td>
                      </tr>
                    ))}
                    {hvac.copper_piping_cost > 0 && (
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-slate-400">PIPE-01</td>
                        <td className="py-3 px-4 font-semibold text-white">Refrigerant Copper Piping</td>
                        <td className="py-3 px-4 text-slate-300">All AC Units</td>
                        <td className="py-3 px-4 text-slate-400">Insulated twin copper runs ({hvac.copper_piping_meters} m)</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(hvac.copper_piping_cost)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: COST ROLLUP & PERCENTAGES */}
          {activeTab === "distribution" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Project Cost Rollup & Distribution</h3>
                  <p className="text-xs text-slate-400">
                    Overall cost breakdown across civil, labor, MEP, furniture, and design contingencies.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Grand Total Estimate</div>
                  <div className="text-xl font-black text-sky-400 font-mono">{formatCurrency(summary.grand_total)}</div>
                </div>
              </div>

              {/* Progress Bar Breakdown */}
              <div className="w-full bg-slate-800 rounded-xl h-4 overflow-hidden flex shadow-inner">
                <div style={{ width: `${percentages.civil}%` }} className="bg-emerald-500 h-full" title={`Civil: ${percentages.civil}%`} />
                <div style={{ width: `${percentages.labor}%` }} className="bg-indigo-500 h-full" title={`Labor: ${percentages.labor}%`} />
                <div style={{ width: `${percentages.electrical}%` }} className="bg-sky-500 h-full" title={`Electrical: ${percentages.electrical}%`} />
                <div style={{ width: `${percentages.plumbing}%` }} className="bg-teal-500 h-full" title={`Plumbing: ${percentages.plumbing}%`} />
                <div style={{ width: `${percentages.hvac}%` }} className="bg-purple-500 h-full" title={`HVAC: ${percentages.hvac}%`} />
                <div style={{ width: `${percentages.furniture}%` }} className="bg-pink-500 h-full" title={`Furniture: ${percentages.furniture}%`} />
                <div style={{ width: `${percentages.contingency}%` }} className="bg-amber-500 h-full" title={`Contingency: ${percentages.contingency}%`} />
              </div>

              {/* Summary Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Component</th>
                      <th className="py-3 px-4">Scope Description</th>
                      <th className="py-3 px-4 text-right">Share %</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🟢 1. Civil & Structural Materials</td>
                      <td className="py-3 px-4 text-slate-400">Masonry, cement, sand, steel rebars, tiles</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.civil}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(civil.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🟣 2. Labor & Construction Wages</td>
                      <td className="py-3 px-4 text-slate-400">Head mason, masons, helpers, electricians, plumbers</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.labor}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(labor.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🔵 3. Electrical Engineering</td>
                      <td className="py-3 px-4 text-slate-400">DB, LED lights, BLDC fans, modular plates & conduit</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.electrical}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(electrical.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🩵 4. Plumbing & Sanitary</td>
                      <td className="py-3 px-4 text-slate-400">EWCs, basins, sink, showers, dual supply & drainage lines</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.plumbing}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(plumbing.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">💜 5. HVAC Climate Systems</td>
                      <td className="py-3 px-4 text-slate-400">Split IDU/ODU condensers & insulated copper runs</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.hvac}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(hvac.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🩷 6. Architectural Furniture</td>
                      <td className="py-3 px-4 text-slate-400">Beds, sofas, dining, modular kitchen woodwork</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.furniture}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(furniture.total_cost)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">🟡 7. Contingency & Overheads (5%)</td>
                      <td className="py-3 px-4 text-slate-400">Contractor supervision, site overheads & material wastage buffer</td>
                      <td className="py-3 px-4 text-right font-mono">{percentages.contingency}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatCurrency(summary.contingency_cost)}</td>
                    </tr>
                    <tr className="bg-slate-800/60 font-bold">
                      <td className="py-3.5 px-4 text-white text-sm" colSpan={2}>
                        GRAND TOTAL ESTIMATE ({summary.cost_per_sqft_builtup?.toLocaleString()} ₹/sq.ft)
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm text-sky-400">100.0%</td>
                      <td className="py-3.5 px-4 text-right font-mono text-base text-sky-400">
                        {formatCurrency(summary.grand_total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Selected Quality: <strong className="text-white capitalize">{boqData.tier_name || currentTier}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
