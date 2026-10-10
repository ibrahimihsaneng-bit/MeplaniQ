import React, { useState, useEffect, useCallback } from "react";

export default function BoqScheduleTable({
  boqData,
  activeTier = "medium",
  onSwitchTier,
  onOpenDashboard,
  onExportPdf1,
  onExportPdf2,
  isRecalculating = false,
  isExportingPdf1 = false,
  isExportingPdf2 = false
}) {
  const currentTier = boqData?.quality_tier || activeTier || "medium";
  const summary = boqData?.summary || {};
  const civil = boqData?.civil_materials || {};
  const schedule = boqData?.construction_schedule || {};
  const labor = boqData?.labor || {};
  const percentages = boqData?.percentages || {};

  // Default standard unit rates extracted from active quality tier
  const getDefaultRates = useCallback(() => {
    const c = boqData?.civil_materials || {};
    const l = boqData?.labor || {};
    return {
      solidBlock: c.solid_block_unit_cost || 42,
      cement: c.cement_bag_cost || 385,
      msand: c.msand_cft ? Number((c.msand_cost / c.msand_cft).toFixed(2)) : 52,
      psand: c.psand_cft ? Number((c.psand_cost / c.psand_cft).toFixed(2)) : 58,
      steel: c.steel_kg ? Number((c.steel_cost / c.steel_kg).toFixed(2)) : 72,
      aggregate: c.aggregate_cft ? Number((c.aggregate_cost / c.aggregate_cft).toFixed(2)) : 48,
      flooring: c.flooring_sqft ? Number((c.flooring_cost / c.flooring_sqft).toFixed(2)) : 140,
      laborDailyRate: l.total_mandays ? Number((l.total_cost / l.total_mandays).toFixed(2)) : 850
    };
  }, [boqData]);

  const [rates, setRates] = useState(getDefaultRates);
  const [hasCustomRates, setHasCustomRates] = useState(false);

  useEffect(() => {
    if (!hasCustomRates) {
      setRates(getDefaultRates());
    }
  }, [boqData, getDefaultRates, hasCustomRates]);

  const handleRateChange = (key, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setRates(prev => ({ ...prev, [key]: num }));
    setHasCustomRates(true);
  };

  const resetRates = () => {
    setRates(getDefaultRates());
    setHasCustomRates(false);
  };

  // Live dynamic cost computations
  const solidBlockCost = (civil.solid_blocks_count || 0) * (rates.solidBlock || 0);
  const cementCost = (civil.cement_total_bags || 0) * (rates.cement || 0);
  const msandCost = (civil.msand_cft || 0) * (rates.msand || 0);
  const psandCost = (civil.psand_cft || 0) * (rates.psand || 0);
  const steelCost = (civil.steel_kg || 0) * (rates.steel || 0);
  const aggregateCost = (civil.aggregate_cft || 0) * (rates.aggregate || 0);
  const flooringCost = (civil.flooring_sqft || 0) * (rates.flooring || 0);
  const laborCost = (labor.total_mandays || 0) * (rates.laborDailyRate || 0);

  const materialsAndLaborTotal = solidBlockCost + cementCost + msandCost + psandCost + steelCost + aggregateCost + flooringCost + laborCost;

  const originalCivilAndLabor = (civil.solid_blocks_cost || 0) + (civil.cement_total_cost || 0) + (civil.msand_cost || 0) + (civil.psand_cost || 0) + (civil.steel_cost || 0) + (civil.aggregate_cost || 0) + (civil.flooring_cost || 0) + (labor.total_cost || 0);
  const otherCost = Math.max(0, (summary.grand_total || 0) - originalCivilAndLabor);

  const effectiveGrandTotal = hasCustomRates ? (materialsAndLaborTotal + otherCost) : (summary.grand_total || 0);
  const builtupSqft = summary.total_builtup_sqft || (summary.cost_per_sqft_builtup ? (summary.grand_total / summary.cost_per_sqft_builtup) : 1);
  const effectiveCostPerSqft = builtupSqft > 0 ? Math.round(effectiveGrandTotal / builtupSqft) : (summary.cost_per_sqft_builtup || 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111418] text-slate-200 overflow-hidden">
      {/* 1. Control & Action Bar */}
      <div className="px-4 py-2.5 bg-[#151A20] border-b border-[#2A3441] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Tier Selector Pills & Custom Rates State */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quality Tier:</span>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs">
            <button
              onClick={() => onSwitchTier && onSwitchTier("low")}
              disabled={isRecalculating}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                currentTier === "low"
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🟢 Low (Budget)
            </button>
            <button
              onClick={() => onSwitchTier && onSwitchTier("medium")}
              disabled={isRecalculating}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                currentTier === "medium"
                  ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🔵 Medium (Standard)
            </button>
            <button
              onClick={() => onSwitchTier && onSwitchTier("high")}
              disabled={isRecalculating}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                currentTier === "high"
                  ? "bg-purple-500 text-white font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🟣 High (Luxury)
            </button>
          </div>

          {/* Custom Rates Badge & Reset Button */}
          {hasCustomRates && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                ⚡ Custom Rates Active
              </span>
              <button
                type="button"
                onClick={resetRates}
                className="text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 rounded transition"
                title="Reset unit rates to current tier standard defaults"
              >
                ↺ Reset Defaults
              </button>
            </div>
          )}

          {isRecalculating && (
            <span className="text-xs text-sky-400 flex items-center gap-1.5 ml-2">
              <div className="w-3 h-3 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
              Recalculating...
            </span>
          )}
        </div>

        {/* Action Buttons: TWO Dedicated PDFs + Full Dashboard */}
        <div className="flex items-center gap-2">
          {/* PDF 1: Quantities & Schedules Report */}
          <button
            onClick={onExportPdf1}
            disabled={isExportingPdf1}
            style={{
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: isExportingPdf1 ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
            }}
            title="Download PDF 1: Building Quantities, Spatial Summary & MEP Schedules Report"
          >
            {isExportingPdf1 ? 'Exporting...' : '📄 PDF 1: Quantities'}
          </button>

          {/* PDF 2: Material & Cost (BOQ) Report */}
          <button
            onClick={onExportPdf2}
            disabled={isExportingPdf2}
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              border: '1px solid #F87171',
              color: '#FFFFFF',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: isExportingPdf2 ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
            }}
            title="Download PDF 2: Material Quantities, Construction Schedule & Cost Estimation Report"
          >
            {isExportingPdf2 ? 'Exporting...' : '📑 PDF 2: Cost & BOQ'}
          </button>

          {/* Full Dashboard Modal Trigger */}
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #F59E0B',
                color: '#FBBF24',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Open Complete Full-Screen BOQ Dashboard"
            >
              📊 Full Dashboard ↗
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Summary KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-3 bg-black/40 border-b border-[#2A3441] shrink-0 text-xs">
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Grand Total</div>
          <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(effectiveGrandTotal)}</div>
          <div className="text-[10px] text-sky-400 font-mono mt-0.5">₹ {effectiveCostPerSqft.toLocaleString()}/sq.ft</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Duration</div>
          <div className="text-sm font-bold text-amber-400 mt-0.5">{schedule.total_working_days || 0} Days</div>
          <div className="text-[10px] text-slate-400 mt-0.5">~{schedule.total_months || 0} Months</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Wall Masonry</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">{civil.solid_blocks_count?.toLocaleString() || 0} Units</div>
          <div className="text-[10px] text-slate-400 mt-0.5">or {civil.standard_bricks_count?.toLocaleString() || 0} Bricks</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Cement (50kg)</div>
          <div className="text-sm font-bold text-white mt-0.5">{civil.cement_total_bags?.toLocaleString() || 0} Bags</div>
          <div className="text-[10px] text-slate-400 mt-0.5">₹ {rates.cement}/bag</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Sand (M & P)</div>
          <div className="text-sm font-bold text-sky-400 mt-0.5">{civil.total_sand_cft?.toLocaleString() || 0} CFT</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{civil.total_sand_tons || 0} Metric Tons</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">TMT Steel</div>
          <div className="text-sm font-bold text-indigo-400 mt-0.5">{civil.steel_kg?.toLocaleString() || 0} kg</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{civil.steel_metric_tons || 0} Tons</div>
        </div>

        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Labor Cost</div>
          <div className="text-sm font-bold text-teal-400 mt-0.5">{formatCurrency(laborCost)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{labor.total_mandays || 0} Mandays @ ₹{rates.laborDailyRate}/day</div>
        </div>
      </div>

      {/* 3. Materials & Quantities Schedule Table */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-3">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#1C222B] text-slate-300 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-[#2A3441]">
            <tr>
              <th className="py-2.5 px-3">Classification / Material</th>
              <th className="py-2.5 px-3">Specification & Grade</th>
              <th className="py-2.5 px-3 text-right">Quantity</th>
              <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
              <th className="py-2.5 px-3 text-right">Estimated Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A3441]/60 text-slate-300">
            {/* Masonry */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">🧱 Solid Concrete Blocks</td>
              <td className="py-2 px-3 text-slate-400">400x200x150 mm machine-cast solid masonry blocks</td>
              <td className="py-2 px-3 text-right font-mono text-emerald-400 font-bold">{civil.solid_blocks_count?.toLocaleString()} Units</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={rates.solidBlock}
                    onChange={(e) => handleRateChange("solidBlock", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(solidBlockCost)}</td>
            </tr>

            {/* Cement */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">🏷️ Cement (50kg Bags)</td>
              <td className="py-2 px-3 text-slate-400">{civil.cement_brand} (Mortar, Plaster, RCC Structure)</td>
              <td className="py-2 px-3 text-right font-mono text-sky-400 font-bold">{civil.cement_total_bags?.toLocaleString()} Bags</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rates.cement}
                    onChange={(e) => handleRateChange("cement", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(cementCost)}</td>
            </tr>

            {/* M-Sand */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">⏳ M-Sand (Manufactured Sand)</td>
              <td className="py-2 px-3 text-slate-400">Graded concrete & masonry sand ({civil.msand_tons} Metric Tons)</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">{civil.msand_cft?.toLocaleString()} CFT</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={rates.msand}
                    onChange={(e) => handleRateChange("msand", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(msandCost)}</td>
            </tr>

            {/* P-Sand */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">⏳ P-Sand (Plastering Sand)</td>
              <td className="py-2 px-3 text-slate-400">Fine washed sand for smooth plastering ({civil.psand_tons} Metric Tons)</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">{civil.psand_cft?.toLocaleString()} CFT</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={rates.psand}
                    onChange={(e) => handleRateChange("psand", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(psandCost)}</td>
            </tr>

            {/* Steel */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">🏗️ TMT Rebar Steel (Fe550D)</td>
              <td className="py-2 px-3 text-slate-400">High-yield structural reinforcement ({civil.steel_metric_tons} Metric Tons)</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-indigo-400">{civil.steel_kg?.toLocaleString()} kg</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={rates.steel}
                    onChange={(e) => handleRateChange("steel", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(steelCost)}</td>
            </tr>

            {/* Aggregate */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">🪨 Coarse Aggregate Metal</td>
              <td className="py-2 px-3 text-slate-400">20mm & 40mm Graded Blue Metal ({civil.aggregate_tons} Metric Tons)</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{civil.aggregate_cft?.toLocaleString()} CFT</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={rates.aggregate}
                    onChange={(e) => handleRateChange("aggregate", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(aggregateCost)}</td>
            </tr>

            {/* Flooring */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">✨ Flooring & Tiling</td>
              <td className="py-2 px-3 text-slate-400">Vitrified tiles / marble based on active tier</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{civil.flooring_sqft?.toLocaleString()} sq.ft</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rates.flooring}
                    onChange={(e) => handleRateChange("flooring", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(flooringCost)}</td>
            </tr>

            {/* Labor Wages */}
            <tr className="hover:bg-slate-800/40">
              <td className="py-2 px-3 font-semibold text-white">👷 Total Labor Wages</td>
              <td className="py-2 px-3 text-slate-400">Masons, helpers, electricians, plumbers, carpenters, painters</td>
              <td className="py-2 px-3 text-right font-mono text-teal-400 font-bold">{labor.total_mandays || 0} Mandays</td>
              <td className="py-2 px-3 text-right font-mono">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 text-[11px]">₹</span>
                  <input
                    type="number"
                    step="25"
                    min="0"
                    value={rates.laborDailyRate}
                    onChange={(e) => handleRateChange("laborDailyRate", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                    title="Average daily wage rate per manday"
                  />
                  <span className="text-[10px] text-slate-500">/day</span>
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatCurrency(laborCost)}</td>
            </tr>

            {/* Subtotal & Grand Total */}
            <tr className="bg-slate-900 font-bold text-white">
              <td className="py-2.5 px-3 text-xs" colSpan={2}>
                SUBTOTAL MATERIALS & LABOR {hasCustomRates && <span className="text-amber-400 font-normal">(CUSTOMIZED)</span>}
              </td>
              <td className="py-2.5 px-3 text-right font-mono" colSpan={2}>
                Cost / sq.ft: ₹ {effectiveCostPerSqft.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-sm text-sky-400">
                {formatCurrency(effectiveGrandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
