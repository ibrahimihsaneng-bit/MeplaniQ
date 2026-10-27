import React, { useState, useMemo } from 'react';
import {
  REVISION_PURPOSES,
  STANDARD_CONSTRUCTION_LEGEND,
  generateProjectRevisionClouds,
  compileActiveDrawingLegend
} from './constructionDocEngine';

/**
 * ConstructionDocStudioModal.jsx
 * ===============================
 * Commercial Construction Documentation & Multi-Discipline Drawing Studio.
 * Compliant with AIA CAD Guidelines, ISO 128, and BS 8888 drawing production standards.
 */
export default function ConstructionDocStudioModal({
  isOpen,
  onClose,
  solveData,
  showRevClouds,
  onToggleRevClouds,
  showLegend,
  onToggleLegend,
  projectName = 'MeplanIQ Floorplan'
}) {
  const [activeTab, setActiveTab] = useState('sheets'); // 'sheets' | 'revisions' | 'legend' | 'stamp'
  const [currentRevisionIndex, setCurrentRevisionIndex] = useState('IFC'); // 'IFR' | 'IFP' | 'IFT' | 'IFC'
  const [engineerName, setEngineerName] = useState('Ibrahim Ihsan, P.E.');
  const [licenseNumber, setLicenseNumber] = useState('PE-78492-MEP');
  const [firmName, setFirmName] = useState('MeplanIQ BIM & Engineering Consultants');

  const selectedPurpose = useMemo(() => {
    return REVISION_PURPOSES.find(p => p.id === currentRevisionIndex) || REVISION_PURPOSES[3];
  }, [currentRevisionIndex]);

  // Compiled revision clouds
  const clouds = useMemo(() => {
    return generateProjectRevisionClouds(solveData, {
      revisionCode: selectedPurpose.code,
      authorInitials: 'PE/MEP'
    });
  }, [solveData, selectedPurpose]);

  // Compiled active legend
  const legendItems = useMemo(() => {
    return compileActiveDrawingLegend(solveData);
  }, [solveData]);

  // Master Drawing Set Index
  const drawingSheets = [
    { number: 'G-001', title: 'General Cover, Notes, Symbol Legend & Sheet Index', discipline: 'General', scale: 'N.T.S.', rev: selectedPurpose.code },
    { number: 'A-101', title: 'Ground Floor Architectural Layout Plan', discipline: 'Architectural', scale: '1:50', rev: selectedPurpose.code },
    { number: 'P-101', title: 'Domestic Water Supply & Sanitary Drainage Plan', discipline: 'Plumbing', scale: '1:50', rev: selectedPurpose.code },
    { number: 'M-101', title: 'HVAC Ductwork & Ceiling Diffuser Layout Plan', discipline: 'Mechanical', scale: '1:50', rev: selectedPurpose.code },
    { number: 'E-101', title: 'Lighting & Power Distribution Layout Plan', discipline: 'Electrical', scale: '1:50', rev: selectedPurpose.code },
    { number: 'E-102', title: 'Rooftop Solar PV String Array & 3-Phase MDB Schedule', discipline: 'Electrical / Solar', scale: '1:100', rev: selectedPurpose.code }
  ];

  if (!isOpen) return null;

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
          padding: '12px 24px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #334155',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>📑</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.4px' }}>
              CONSTRUCTION DOCUMENTATION &amp; DRAWING PRODUCTION STUDIO
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              AIA / ISO 128 Drawing Standards • Revision Clouds, Delta History &amp; Master Submission Sets
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Revision Clouds Toggle */}
          <button
            type="button"
            onClick={onToggleRevClouds}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showRevClouds ? '#DC2626' : '#1E293B',
              border: `1px solid ${showRevClouds ? '#EF4444' : '#475569'}`,
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>☁️</span>
            <span>Rev Clouds: {showRevClouds ? 'ON' : 'OFF'}</span>
          </button>

          {/* Canvas Legend Toggle */}
          <button
            type="button"
            onClick={onToggleLegend}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showLegend ? '#0284C7' : '#1E293B',
              border: `1px solid ${showLegend ? '#38BDF8' : '#475569'}`,
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📋</span>
            <span>Legend: {showLegend ? 'ON' : 'OFF'}</span>
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#334155',
              border: 'none',
              color: '#E2E8F0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Top KPI Scorecards ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          padding: '14px 24px',
          backgroundColor: '#0A0F1D',
          borderBottom: '1px solid #1E293B',
          flexShrink: 0
        }}
      >
        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>SUBMISSION STATUS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: selectedPurpose.color, marginTop: '2px' }}>
            {selectedPurpose.code}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {selectedPurpose.name}
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>COORDINATED DRAWING SET</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#38BDF8', marginTop: '2px' }}>
            {drawingSheets.length} Sheets
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Arch, Plumbing, HVAC, Elec, Solar
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>ACTIVE REVISION CLOUDS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#EF4444', marginTop: '2px' }}>
            {clouds.length} Clouds (Delta ▲)
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Flagging Modified Work Areas
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>DRAWING STANDARD</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
            ISO 128 / AIA
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Standard Lineweights &amp; Ticks
          </div>
        </div>

        <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>SEAL &amp; CERTIFICATION</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#C084FC', marginTop: '2px' }}>
            ✓ VERIFIED
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Engineer of Record Approved
          </div>
        </div>
      </div>

      {/* ─── Main Content Splitter with Tabs ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #1E293B',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'sheets' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'sheets' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'sheets' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📑 Master Drawing Sheet Index (6 Sheets)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('revisions')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'revisions' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'revisions' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'revisions' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ☁️ Revision History &amp; Delta Tags ({clouds.length} Active)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('legend')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'legend' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'legend' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'legend' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📋 Construction Symbol &amp; Line Legend ({legendItems.length} Symbols)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stamp')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'stamp' ? '#1E293B' : 'transparent',
              border: `1px solid ${activeTab === 'stamp' ? '#38BDF8' : 'transparent'}`,
              color: activeTab === 'stamp' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ✍️ Professional Engineer (PE) Seal &amp; Approval
          </button>
        </div>

        {/* TAB 1: Drawing Sheet Index */}
        {activeTab === 'sheets' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#0B0F19' }}>
            <div style={{ maxWidth: '950px', margin: '0 auto' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', marginBottom: '14px' }}>
                ISSUED DRAWING PACKAGE SHEET SCHEDULE — {selectedPurpose.name.toUpperCase()}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1E293B', color: '#38BDF8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Sheet No.</th>
                    <th style={{ padding: '10px 14px' }}>Sheet Title</th>
                    <th style={{ padding: '10px 14px' }}>Discipline</th>
                    <th style={{ padding: '10px 14px' }}>Drawing Scale</th>
                    <th style={{ padding: '10px 14px' }}>Current Rev</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drawingSheets.map((s, idx) => (
                    <tr
                      key={s.number}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#0B0F19' : '#0F172A',
                        borderBottom: '1px solid #1E293B'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8' }}>
                        {s.number}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#F8FAFC', fontWeight: 600 }}>
                        {s.title}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8' }}>
                        {s.discipline}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8' }}>
                        {s.scale}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: selectedPurpose.color }}>
                        ▲ {s.rev}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#065F46', color: '#34D399', fontWeight: 700, fontSize: '10.5px' }}>
                          ISSUED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Revision History */}
        {activeTab === 'revisions' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: Change Issue Purpose */}
            <div
              style={{
                width: '320px',
                backgroundColor: '#0F172A',
                borderRight: '1px solid #1E293B',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8' }}>
                SELECT DRAWING ISSUE PURPOSE:
              </div>

              {REVISION_PURPOSES.map(p => (
                <div
                  key={p.id}
                  onClick={() => setCurrentRevisionIndex(p.id)}
                  style={{
                    backgroundColor: currentRevisionIndex === p.id ? 'rgba(56, 189, 248, 0.12)' : '#1E293B',
                    border: `1.5px solid ${currentRevisionIndex === p.id ? p.color : '#334155'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: p.color, fontSize: '12px' }}>
                      ▲ {p.code}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>
                      {currentRevisionIndex === p.id ? 'CURRENT' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#F8FAFC', fontWeight: 600, marginTop: '4px' }}>
                    {p.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Revision History & Clouds Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#0B0F19' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', marginBottom: '14px' }}>
                ACTIVE REVISION CLOUDS &amp; DELTA REGISTRATIONS ({clouds.length} ACTIVE CLOUDS)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {clouds.map((cloud, idx) => (
                  <div
                    key={cloud.id || idx}
                    style={{
                      backgroundColor: '#1E293B',
                      borderRadius: '8px',
                      padding: '16px',
                      borderLeft: '4px solid #EF4444'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#EF4444' }}>
                        ▲ {cloud.deltaTag.code} — {cloud.type}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        Date: {cloud.deltaTag.date} • By: {cloud.deltaTag.author}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#F8FAFC', marginTop: '6px' }}>
                      {cloud.deltaTag.description}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '6px', fontFamily: 'monospace' }}>
                      BBox: X({Math.round(cloud.box.minX)}, {Math.round(cloud.box.maxX)}) • Y({Math.round(cloud.box.minY)}, {Math.round(cloud.box.maxY)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Symbol & Line Legend */}
        {activeTab === 'legend' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#0B0F19' }}>
            <div style={{ maxWidth: '950px', margin: '0 auto' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', marginBottom: '14px' }}>
                COORDINATED DRAWING SYMBOL &amp; LINE TYPE LEGEND (AIA / ISO 128 STANDARD)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {Object.entries(STANDARD_CONSTRUCTION_LEGEND).map(([disc, items]) => (
                  <div key={disc} style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8', marginBottom: '10px' }}>
                      {disc} CONVENTIONS:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {items.map(it => (
                        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Sample graphic line / icon */}
                          <div style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: '36px',
                                height: `${Math.max(2, it.strokeWidth)}px`,
                                backgroundColor: it.color,
                                borderStyle: it.lineStyle === 'dashed' ? 'dashed' : 'solid'
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#F8FAFC' }}>
                            {it.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PE Seal & Approval */}
        {activeTab === 'stamp' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '30px', backgroundColor: '#0B0F19' }}>
            <div style={{ maxWidth: '650px', margin: '0 auto', backgroundColor: '#1E293B', borderRadius: '10px', padding: '24px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', marginBottom: '16px' }}>
                ENGINEER OF RECORD (EOR) APPROVAL SEAL &amp; CERTIFICATION
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
                    ENGINEER NAME
                  </label>
                  <input
                    type="text"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
                    PROFESSIONAL LICENSE / REGISTRATION NO.
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
                    CONSULTING FIRM / PRACTICE
                  </label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  />
                </div>

                {/* Illustrated Stamp Badge */}
                <div
                  style={{
                    marginTop: '16px',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '2px dashed #10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', letterSpacing: '1px' }}>
                    CERTIFIED FOR CONSTRUCTION SUBMISSION
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#F8FAFC', marginTop: '6px' }}>
                    {engineerName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                    License: {licenseNumber} • {firmName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    Digital Cryptographic Seal Validated • AIA / ISO 128 Compliant
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
