import React, { useState, useMemo } from 'react';
import {
  CSI_DIVISIONS,
  RATE_TIERS,
  CURRENCY_SYMBOLS,
  calculateCad2dBoqTakeoff,
  exportBoqToCsv
} from './cad2dBoqEngine';

/**
 * CadBoqStudioModal.jsx
 * =====================
 * Interactive Commercial Bill of Quantities (BOQ) & Quantity Surveying (QS) Studio.
 * Computes exact quantitative takeoffs directly from live 2D CAD geometry, compliant
 * with RICS NRM2 and CSI MasterFormat 2020 standards.
 */
export default function CadBoqStudioModal({
  isOpen,
  onClose,
  solveData,
  projectName = 'MeplanIQ Building Project'
}) {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'divisions' | 'rooms' | 'summary'
  const [tier, setTier] = useState('standard');
  const [currency, setCurrency] = useState('USD');
  const [opPercent, setOpPercent] = useState(12.0);
  const [contPercent, setContPercent] = useState(5.0);
  const [filterDivision, setFilterDivision] = useState('ALL');
  const [copied, setCopied] = useState(false);

  // Compute BOQ Takeoff
  const boqData = useMemo(() => {
    return calculateCad2dBoqTakeoff(solveData, {
      tier,
      currency,
      overheadProfitPercent: Number(opPercent) || 12.0,
      contingencyPercent: Number(contPercent) || 5.0,
      unitScale: 0.001
    });
  }, [solveData, tier, currency, opPercent, contPercent]);

  // Copy CSV to clipboard
  const handleCopyCsv = () => {
    const csv = exportBoqToCsv(boqData);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const csv = exportBoqToCsv(boqData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanName = (projectName || 'MeplanIQ_BOQ').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${cleanName}_BOQ_${tier}_${currency}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download JSON
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(boqData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanName = (projectName || 'MeplanIQ_BOQ').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${cleanName}_BOQ_${tier}_${currency}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const currSym = boqData.currency?.symbol || '$';

  // Filtered line items
  const filteredItems = boqData.lineItems.filter(item => {
    if (filterDivision === 'ALL') return true;
    return item.divisionCode === filterDivision;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.95)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* ─── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0F172A'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px'
            }}
          >
            💰
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                Commercial Bill of Quantities (BOQ) Takeoff Studio
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60A5FA',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#60A5FA',
                    boxShadow: '0 0 6px #60A5FA'
                  }}
                />
                RICS NRM2 & CSI MASTERFORMAT
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Exact 2D geometric quantity surveying for Architecture, Structural Concrete, Finishes, HVAC, Plumbing & Electrical
            </p>
          </div>
        </div>

        {/* Action Buttons & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleCopyCsv}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              backgroundColor: copied ? '#059669' : '#1E293B',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? '✓ Copied CSV' : '📋 Copy CSV'}
          </button>

          <button
            onClick={handleDownloadCsv}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            📊 Export CSV (Excel)
          </button>

          <button
            onClick={handleDownloadJson}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              backgroundColor: '#1E293B',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            💾 Export JSON
          </button>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '8px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Parameter Configuration Strip ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '12px 24px',
          backgroundColor: '#0B1120',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '13px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94A3B8' }}>Quality Tier:</span>
          <select
            value={tier}
            onChange={e => setTier(e.target.value)}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 10px',
              color: '#F8FAFC',
              fontSize: '12px'
            }}
          >
            {Object.values(RATE_TIERS).map(t => (
              <option key={t.id} value={t.id}>{t.label} ({t.multiplier}x)</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94A3B8' }}>Currency:</span>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 10px',
              color: '#F8FAFC',
              fontSize: '12px'
            }}
          >
            {Object.values(CURRENCY_SYMBOLS).map(c => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94A3B8' }}>Overhead &amp; Profit:</span>
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={opPercent}
            onChange={e => setOpPercent(e.target.value)}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#F8FAFC',
              fontSize: '12px',
              width: '60px'
            }}
          />
          <span style={{ color: '#64748B' }}>%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94A3B8' }}>Contingency:</span>
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={contPercent}
            onChange={e => setContPercent(e.target.value)}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#F8FAFC',
              fontSize: '12px',
              width: '60px'
            }}
          />
          <span style={{ color: '#64748B' }}>%</span>
        </div>

        {/* Highlighted Project Metrics */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <span style={{ color: '#94A3B8', fontSize: '11px', display: 'block' }}>GRAND TOTAL ESTIMATE</span>
            <span style={{ color: '#34D399', fontSize: '16px', fontWeight: 800 }}>
              {currSym}{boqData.metrics.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '16px' }}>
            <span style={{ color: '#94A3B8', fontSize: '11px', display: 'block' }}>RATE PER M²</span>
            <span style={{ color: '#60A5FA', fontSize: '15px', fontWeight: 700 }}>
              {currSym}{boqData.metrics.costPerM2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²
            </span>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '16px' }}>
            <span style={{ color: '#94A3B8', fontSize: '11px', display: 'block' }}>MEASURED AREA</span>
            <span style={{ color: '#F1F5F9', fontSize: '15px', fontWeight: 700 }}>
              {boqData.metrics.totalMeasuredAreaM2} m²
            </span>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0F172A'
        }}
      >
        <button
          onClick={() => setActiveTab('items')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'items' ? '#10B981' : 'transparent',
            color: activeTab === 'items' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📑 Detailed Line Items ({boqData.lineItems.length})
        </button>

        <button
          onClick={() => setActiveTab('divisions')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'divisions' ? '#10B981' : 'transparent',
            color: activeTab === 'divisions' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📊 Division Cost Breakdown
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'rooms' ? '#10B981' : 'transparent',
            color: activeTab === 'rooms' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🏠 Room Finish Schedules ({boqData.roomSchedules.length})
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'summary' ? '#10B981' : 'transparent',
            color: activeTab === 'summary' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📈 Financial Summary &amp; Multipliers
        </button>

        {activeTab === 'items' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Filter Division:</span>
            <select
              value={filterDivision}
              onChange={e => setFilterDivision(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#F8FAFC',
                fontSize: '12px'
              }}
            >
              <option value="ALL">All CSI Divisions</option>
              {Object.values(CSI_DIVISIONS).map(d => (
                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ─── Tab Content Body ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', backgroundColor: '#090D16' }}>
        {/* TAB 1: Detailed Line Items Table */}
        {activeTab === 'items' && (
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '12px 16px', width: '60px' }}>Div</th>
                  <th style={{ padding: '12px 16px', width: '90px' }}>Item Code</th>
                  <th style={{ padding: '12px 16px' }}>Item Description</th>
                  <th style={{ padding: '12px 16px', width: '60px', textAlign: 'center' }}>Unit</th>
                  <th style={{ padding: '12px 16px', width: '90px', textAlign: 'right' }}>Net Qty</th>
                  <th style={{ padding: '12px 16px', width: '70px', textAlign: 'right' }}>Waste</th>
                  <th style={{ padding: '12px 16px', width: '90px', textAlign: 'right' }}>Gross Qty</th>
                  <th style={{ padding: '12px 16px', width: '100px', textAlign: 'right' }}>Rate ({currSym})</th>
                  <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right' }}>Total Cost ({currSym})</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const divMeta = Object.values(CSI_DIVISIONS).find(d => d.code === item.divisionCode);
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: divMeta ? `${divMeta.color}22` : '#334155',
                            color: divMeta ? divMeta.color : '#94A3B8'
                          }}
                        >
                          {item.divisionCode}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#94A3B8' }}>{item.itemCode}</td>
                      <td style={{ padding: '10px 16px', color: '#F1F5F9', fontWeight: 500 }}>{item.description}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94A3B8' }}>{item.unit}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#CBD5E1' }}>{item.netQuantity.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#64748B' }}>{item.wastePercent}%</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#60A5FA', fontWeight: 600 }}>{item.grossQuantity.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#CBD5E1' }}>{item.unitRate.toFixed(2)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>
                        {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Division Cost Breakdown */}
        {activeTab === 'divisions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '20px'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#FFFFFF' }}>CSI Division Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {boqData.divisionSummaries.map((div, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                        Div {div.code}: {div.name}
                      </span>
                      <span style={{ color: '#34D399', fontWeight: 700 }}>
                        {currSym}{div.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({div.percentage}%)
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#1E293B', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, div.percentage)}%`,
                          backgroundColor: div.color,
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '20px'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#FFFFFF' }}>Engineering Cost Insights</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderLeft: '4px solid #3B82F6' }}>
                  <div style={{ fontWeight: 700, color: '#93C5FD' }}>Civil &amp; Architectural Envelope</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>
                    Includes 200mm/150mm blockwork, solid columns, double-glazed windows, and doors. Represents the primary structural investment.
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10B981' }}>
                  <div style={{ fontWeight: 700, color: '#A7F3D0' }}>Mechanical &amp; Plumbing Distribution</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>
                    Galvanized steel ductwork, fiberglass thermal insulation, ceiling diffusers, PPR cold/hot water distribution, and drainage stacks.
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(236, 72, 153, 0.08)', borderLeft: '4px solid #EC4899' }}>
                  <div style={{ fontWeight: 700, color: '#FBCFE8' }}>Electrical Power &amp; Renewable Solar PV</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>
                    Slab/wall concealed conduits, copper branch circuit wiring, LED panels, 3-phase MDB, and rooftop ballasted solar photovoltaic modules.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Room Finish Schedules */}
        {activeTab === 'rooms' && (
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '12px 16px' }}>#</th>
                  <th style={{ padding: '12px 16px' }}>Room Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Floor Area (m²)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Perimeter (m)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Wall Plaster &amp; Paint (m²)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ceiling Area (m²)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Est. Room Finishes Cost ({currSym})</th>
                </tr>
              </thead>
              <tbody>
                {boqData.roomSchedules.map((room, idx) => {
                  const estFinishes = (room.floorAreaM2 * 52) + (room.perimeterM * 12) + (room.wallAreaM2 * 24.3) + (room.ceilingAreaM2 * 38);
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: '#64748B' }}>{room.roomIndex}</td>
                      <td style={{ padding: '10px 16px', color: '#F1F5F9', fontWeight: 600 }}>{room.name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#60A5FA' }}>{room.floorAreaM2}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#CBD5E1' }}>{room.perimeterM}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#CBD5E1' }}>{room.wallAreaM2}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#CBD5E1' }}>{room.ceilingAreaM2}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>
                        {estFinishes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Summary & Multipliers */}
        {activeTab === 'summary' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '24px'
              }}
            >
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#FFFFFF' }}>Master Bill of Quantities Financial Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ color: '#94A3B8' }}>Net Direct Construction Subtotal</span>
                  <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                    {currSym}{boqData.metrics.directSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ color: '#94A3B8' }}>Contractor Overhead &amp; Profit ({opPercent}%)</span>
                  <span style={{ color: '#60A5FA', fontWeight: 600 }}>
                    +{currSym}{boqData.metrics.overheadProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ color: '#94A3B8' }}>Design &amp; Construction Contingency ({contPercent}%)</span>
                  <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                    +{currSym}{boqData.metrics.contingency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontSize: '16px' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 700 }}>GRAND TOTAL ESTIMATE</span>
                  <span style={{ color: '#34D399', fontWeight: 800 }}>
                    {currSym}{boqData.metrics.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
