import React, { useState, useMemo, useRef } from 'react';
import {
  SHEET_SIZES,
  DRAWING_SCALES,
  SHEET_DISCIPLINES,
  computeModelBounds,
  calculateViewportFit,
  generateGraphicBarScale,
  generateProjectSheetSet
} from './titleblockEngine';

/**
 * CadSheetLayoutModal.jsx
 * =======================
 * Commercial Architectural & MEP Paper Space Sheet Layout Studio.
 * Generates ISO/ANSI coordinated drawing sets (A1, A0, Arch D) with titleblocks,
 * true north compass, metric bar scale, discipline viewports, and vector PDF printing.
 */
export default function CadSheetLayoutModal({
  isOpen,
  onClose,
  solveData,
  projectMetadata = {}
}) {
  const [selectedSheetId, setSelectedSheetId] = useState('sheet_A-101');
  const [selectedPaperSize, setSelectedPaperSize] = useState('A1');
  const [selectedScaleId, setSelectedScaleId] = useState('1:50');
  const printContainerRef = useRef(null);

  const sheetSize = SHEET_SIZES[selectedPaperSize] || SHEET_SIZES.A1;
  const scaleObj = DRAWING_SCALES.find(s => s.id === selectedScaleId) || DRAWING_SCALES[1];

  // Compile multi-sheet set for the project
  const sheets = useMemo(() => {
    return generateProjectSheetSet(projectMetadata, {
      sheetSize: selectedPaperSize,
      scaleId: selectedScaleId
    });
  }, [projectMetadata, selectedPaperSize, selectedScaleId]);

  const activeSheet = useMemo(() => {
    return sheets.find(s => s.id === selectedSheetId) || sheets[0];
  }, [sheets, selectedSheetId]);

  // Compute model bounds and viewport transform
  const modelBounds = useMemo(() => {
    return computeModelBounds(solveData);
  }, [solveData]);

  const viewportFit = useMemo(() => {
    return calculateViewportFit(sheetSize, modelBounds, scaleObj.ratio);
  }, [sheetSize, modelBounds, scaleObj]);

  const graphicScale = useMemo(() => {
    return generateGraphicBarScale(selectedScaleId, 35, sheetSize.heightMm - 30);
  }, [selectedScaleId, sheetSize]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const disciplineColor = {
    'A-101': '#38BDF8',
    'P-101': '#06B6D4',
    'M-101': '#10B981',
    'E-101': '#F59E0B',
    'C-101': '#EF4444'
  }[activeSheet.sheetNumber] || '#38BDF8';

  const layers = activeSheet.layers;

  return (
    <div
      className="cad-sheet-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.96)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* ─── Top Control Toolbar ────────────────────────────────────────── */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #334155',
          flexShrink: 0
        }}
      >
        {/* Left: Title & Sheet Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📐</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.5px' }}>
                PAPER SPACE SHEET STUDIO
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                ISO 7200 / ANSI Y14.1 Coordinated Multi-Sheet Drawing Set
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

          {/* Sheet Selector Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {sheets.map(sh => {
              const isSelected = sh.id === selectedSheetId;
              const tabColor = {
                'A-101': '#38BDF8',
                'P-101': '#06B6D4',
                'M-101': '#10B981',
                'E-101': '#F59E0B',
                'C-101': '#EF4444'
              }[sh.sheetNumber] || '#38BDF8';

              return (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => setSelectedSheetId(sh.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#1E293B' : 'transparent',
                    border: `1px solid ${isSelected ? tabColor : '#334155'}`,
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ color: tabColor, fontWeight: 900 }}>{sh.sheetNumber}</span>
                  <span>{sh.discipline.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Paper Size, Scale & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Paper Size Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>PAPER:</span>
            <select
              value={selectedPaperSize}
              onChange={(e) => setSelectedPaperSize(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #475569',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {Object.values(SHEET_SIZES).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.widthMm}×{s.heightMm}mm)</option>
              ))}
            </select>
          </div>

          {/* Scale Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>SCALE:</span>
            <select
              value={selectedScaleId}
              onChange={(e) => setSelectedScaleId(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #475569',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {DRAWING_SCALES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Print / Export Button */}
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>🖨️</span>
            <span>Print / Vector PDF</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* ─── Sheet Preview Canvas (Center) ─────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
          backgroundColor: '#0B0F19'
        }}
      >
        <div
          ref={printContainerRef}
          className="print-sheet-wrapper"
          style={{
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            borderRadius: '2px',
            backgroundColor: '#FFFFFF',
            lineHeight: 0
          }}
        >
          {/* Physical SVG Paper Sheet */}
          <svg
            width={`${sheetSize.widthMm * 1.1}px`}
            height={`${sheetSize.heightMm * 1.1}px`}
            viewBox={`0 0 ${sheetSize.widthMm} ${sheetSize.heightMm}`}
            style={{
              backgroundColor: '#FFFFFF',
              display: 'block'
            }}
          >
            <defs>
              {/* Hatch pattern for wall bodies */}
              <pattern id="sheet_wall_hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#CBD5E1" strokeWidth="1" />
              </pattern>
            </defs>

            {/* 1. PAPER MARGINS & BORDER LINES (ISO 5457) */}
            {/* Outer sheet edge guide (20mm binding edge left, 10mm others) */}
            <rect
              x="20"
              y="10"
              width={sheetSize.widthMm - 30}
              height={sheetSize.heightMm - 20}
              fill="none"
              stroke="#0F172A"
              strokeWidth="0.8"
            />
            {/* Inner margin boundary */}
            <rect
              x="21"
              y="11"
              width={sheetSize.widthMm - 32}
              height={sheetSize.heightMm - 22}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="0.3"
            />

            {/* 2. COORDINATE REFERENCE GRID (A-H, 1-8 along borders) */}
            {['A', 'B', 'C', 'D', 'E', 'F'].map((letter, idx) => {
              const yStep = (sheetSize.heightMm - 20) / 6;
              const yPos = 10 + yStep * idx + yStep / 2;
              return (
                <g key={`grid-y-${letter}`}>
                  <text x="14" y={yPos} textAnchor="middle" dominantBaseline="middle" fill="#64748B" fontSize="3.5" fontWeight="700">
                    {letter}
                  </text>
                  <text x={sheetSize.widthMm - 5} y={yPos} textAnchor="middle" dominantBaseline="middle" fill="#64748B" fontSize="3.5" fontWeight="700">
                    {letter}
                  </text>
                  <line x1="20" y1={10 + yStep * (idx + 1)} x2="17" y2={10 + yStep * (idx + 1)} stroke="#64748B" strokeWidth="0.4" />
                </g>
              );
            })}

            {[1, 2, 3, 4, 5, 6, 7, 8].map((num, idx) => {
              const xStep = (sheetSize.widthMm - 30) / 8;
              const xPos = 20 + xStep * idx + xStep / 2;
              return (
                <g key={`grid-x-${num}`}>
                  <text x={xPos} y="6" textAnchor="middle" dominantBaseline="middle" fill="#64748B" fontSize="3.5" fontWeight="700">
                    {num}
                  </text>
                  <text x={xPos} y={sheetSize.heightMm - 4} textAnchor="middle" dominantBaseline="middle" fill="#64748B" fontSize="3.5" fontWeight="700">
                    {num}
                  </text>
                  <line x1={20 + xStep * (idx + 1)} y1="10" x2={20 + xStep * (idx + 1)} y2="7" stroke="#64748B" strokeWidth="0.4" />
                </g>
              );
            })}

            {/* 3. DRAWING VIEWPORT (Transformed 2D CAD Model) */}
            <g
              id="SHEET_VIEWPORT"
              transform={`translate(${viewportFit.offsetX}, ${viewportFit.offsetY}) scale(${viewportFit.scale}, ${-viewportFit.scale})`}
            >
              {/* WALLS & ROOMS */}
              {layers.walls && (solveData?.rooms || []).map((r, rIdx) => {
                const pts = r.points || [];
                if (pts.length < 3) return null;
                const pointsStr = pts.map(p => `${Array.isArray(p) ? p[0] : p.x},${Array.isArray(p) ? p[1] : p.y}`).join(' ');
                return (
                  <polygon
                    key={`sheet-room-${rIdx}`}
                    points={pointsStr}
                    fill="url(#sheet_wall_hatch)"
                    stroke="#0F172A"
                    strokeWidth={25}
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* OPENINGS (Doors & Windows) */}
              {layers.openings && (solveData?.doors || []).map(door => (
                <g key={`sheet-door-${door.id}`} transform={`translate(${door.x || 0}, ${door.y || 0})`}>
                  <rect x="-450" y="-100" width="900" height="200" fill="#FFFFFF" stroke="#0F172A" strokeWidth="15" />
                  <path d="M -450 0 A 900 900 0 0 1 450 0" fill="none" stroke="#64748B" strokeWidth="10" strokeDasharray="30 20" />
                </g>
              ))}

              {/* ROOM TAGS */}
              {layers.roomTags && (solveData?.room_tags || []).map(tag => (
                <g key={`sheet-tag-${tag.id}`} transform={`translate(${tag.x}, ${tag.y}) scale(1, -1)`}>
                  <rect x="-800" y="-300" width="1600" height="600" rx="80" fill="#FFFFFF" stroke="#0F172A" strokeWidth="20" />
                  <text x="0" y="-70" textAnchor="middle" fill="#0F172A" fontSize="130" fontWeight="900" fontFamily="sans-serif">
                    {tag.roomName || 'ROOM'}
                  </text>
                  <text x="0" y="140" textAnchor="middle" fill="#475569" fontSize="100" fontWeight="700" fontFamily="sans-serif">
                    {tag.areaM2} m² ({tag.areaSqFt} sq ft)
                  </text>
                </g>
              ))}

              {/* DIMENSIONS */}
              {layers.dimensions && (solveData?.dimensions || []).map(dim => (
                <g key={`sheet-dim-${dim.id}`}>
                  <line x1={dim.dim_x1} y1={dim.dim_y1} x2={dim.dim_x2} y2={dim.dim_y2} stroke="#0284C7" strokeWidth="15" />
                  <line x1={dim.ext1_x1} y1={dim.ext1_y1} x2={dim.ext1_x2} y2={dim.ext1_y2} stroke="#0284C7" strokeWidth="10" strokeDasharray="30 15" />
                  <line x1={dim.ext2_x1} y1={dim.ext2_y1} x2={dim.ext2_x2} y2={dim.ext2_y2} stroke="#0284C7" strokeWidth="10" strokeDasharray="30 15" />
                  <line x1={dim.tick1_x1} y1={dim.tick1_y1} x2={dim.tick1_x2} y2={dim.tick1_y2} stroke="#0284C7" strokeWidth="25" />
                  <line x1={dim.tick2_x1} y1={dim.tick2_y1} x2={dim.tick2_x2} y2={dim.tick2_y2} stroke="#0284C7" strokeWidth="25" />
                  <g transform={`translate(${dim.label_x}, ${dim.label_y}) scale(1, -1)`}>
                    <rect x="-400" y="-120" width="800" height="240" fill="#FFFFFF" stroke="#0284C7" strokeWidth="10" />
                    <text x="0" y="40" textAnchor="middle" fill="#0284C7" fontSize="100" fontWeight="800" fontFamily="sans-serif">
                      {dim.label}
                    </text>
                  </g>
                </g>
              ))}

              {/* PLUMBING PIPES & FIXTURES */}
              {layers.plumbing && (
                <g id="SHEET_PLUMBING_LAYER">
                  {(solveData?.plumbing_fixtures || []).map(f => (
                    <g key={`sheet-fix-${f.id}`} transform={`translate(${f.x}, ${f.y})`}>
                      <rect x={-(f.width || 600) / 2} y={-(f.height || 600) / 2} width={f.width || 600} height={f.height || 600} fill="#E0F2FE" stroke="#0284C7" strokeWidth="20" rx="40" />
                      <text x="0" y="40" textAnchor="middle" fill="#0369A1" fontSize="100" fontWeight="800" transform="scale(1, -1)" fontFamily="sans-serif">
                        {f.name || f.type || 'WC'}
                      </text>
                    </g>
                  ))}
                  {(solveData?.plumbing_pipes || []).map(pipe => {
                    const pts = pipe.path_points || pipe.points || [];
                    if (pts.length < 2) return null;
                    const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Array.isArray(p) ? p[0] : p.x} ${Array.isArray(p) ? p[1] : p.y}`).join(' ');
                    const isSoil = (pipe.system_type || '').includes('SOIL') || (pipe.system_type || '').includes('DRAIN');
                    return (
                      <path
                        key={`sheet-pipe-${pipe.id}`}
                        d={pathStr}
                        fill="none"
                        stroke={isSoil ? '#D97706' : '#0284C7'}
                        strokeWidth={pipe.diameter_mm || 25}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              )}

              {/* HVAC DUCTS & DIFFUSERS */}
              {layers.hvac && (
                <g id="SHEET_HVAC_LAYER">
                  {(solveData?.hvac_ducts || []).map(duct => {
                    const pts = duct.path || duct.points || [];
                    if (pts.length < 2) return null;
                    const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Array.isArray(p) ? p[0] : p.x} ${Array.isArray(p) ? p[1] : p.y}`).join(' ');
                    return (
                      <g key={`sheet-duct-${duct.id}`}>
                        <path d={pathStr} fill="none" stroke="#059669" strokeWidth={duct.width || 400} strokeLinejoin="miter" strokeLinecap="square" />
                        <path d={pathStr} fill="none" stroke="#FFFFFF" strokeWidth="15" strokeDasharray="60 30" />
                      </g>
                    );
                  })}
                  {(solveData?.hvac_diffusers || []).map(diff => (
                    <g key={`sheet-diff-${diff.id}`} transform={`translate(${diff.x}, ${diff.y})`}>
                      <rect x="-225" y="-225" width="450" height="450" fill="#D1FAE5" stroke="#059669" strokeWidth="20" />
                      <line x1="-225" y1="-225" x2="225" y2="225" stroke="#059669" strokeWidth="15" />
                      <line x1="-225" y1="225" x2="225" y2="-225" stroke="#059669" strokeWidth="15" />
                    </g>
                  ))}
                </g>
              )}

              {/* ELECTRICAL CONDUITS & HOMERUNS */}
              {layers.electrical && (
                <g id="SHEET_ELECTRICAL_LAYER">
                  {(solveData?.electrical_routes || []).map(route => {
                    const pts = route.points || [];
                    if (pts.length < 2) return null;
                    const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Array.isArray(p) ? p[0] : p.x} ${Array.isArray(p) ? p[1] : p.y}`).join(' ');
                    return (
                      <path
                        key={`sheet-elec-${route.id}`}
                        d={pathStr}
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="15"
                        strokeDasharray={route.conduit_type === 'FLEXIBLE' ? '40 20' : 'none'}
                      />
                    );
                  })}
                  {(solveData?.electrical_components || []).map(comp => (
                    <g key={`sheet-comp-${comp.id}`} transform={`translate(${comp.x}, ${comp.y})`}>
                      <circle r="150" fill="#FEF3C7" stroke="#D97706" strokeWidth="20" />
                    </g>
                  ))}
                </g>
              )}

              {/* PENETRATION SLEEVES */}
              {layers.sleeves && (solveData?.penetration_sleeves || []).map(sleeve => (
                <g key={`sheet-slv-${sleeve.id}`} transform={`translate(${sleeve.x}, ${sleeve.y})`}>
                  <circle r="120" fill="none" stroke="#DC2626" strokeWidth="25" />
                  <g transform="scale(1, -1)">
                    <text x="0" y="30" textAnchor="middle" fill="#DC2626" fontSize="70" fontWeight="900" fontFamily="sans-serif">
                      SLV
                    </text>
                  </g>
                </g>
              ))}

              {/* CLASH BEACONS (On Coordination Sheet) */}
              {layers.clashes && (solveData?.clash_markers || []).map((clash, idx) => (
                <g key={`sheet-clash-${idx}`} transform={`translate(${clash.x || clash.center?.x || 0}, ${clash.y || clash.center?.y || 0})`}>
                  <circle r="250" fill="rgba(239, 68, 68, 0.3)" stroke="#EF4444" strokeWidth="30" />
                </g>
              ))}
            </g>

            {/* 4. TRUE NORTH COMPASS ROSE (Top Right) */}
            <g transform={`translate(${sheetSize.widthMm - 45}, 40)`}>
              {/* Outer compass ring */}
              <circle r="14" fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.8" />
              {/* North Arrow Pointer */}
              <polygon points="0,-12 3,0 0,-2 -3,0" fill="#0F172A" />
              <polygon points="0,12 3,0 0,2 -3,0" fill="#94A3B8" />
              <text x="0" y="-14" textAnchor="middle" fill="#0F172A" fontSize="4.5" fontWeight="900" fontFamily="sans-serif">
                N
              </text>
            </g>

            {/* 5. METRIC GRAPHIC BAR SCALE */}
            <g transform={`translate(${graphicScale.x}, ${graphicScale.y})`}>
              <text x="0" y="-3" textAnchor="start" fill="#0F172A" fontSize="3" fontWeight="700" fontFamily="sans-serif">
                SCALE {activeSheet.scaleId} (METRIC)
              </text>
              {graphicScale.intervals.map((inter, i) => (
                <g key={`bar-inter-${i}`}>
                  <rect
                    x={inter.x}
                    y="0"
                    width={graphicScale.mmPerMeter * (i === 3 ? 3 : 1)}
                    height={graphicScale.barHeight}
                    fill={i % 2 === 0 ? '#0F172A' : '#E2E8F0'}
                    stroke="#0F172A"
                    strokeWidth="0.4"
                  />
                  <text x={inter.x} y="8" textAnchor="middle" fill="#0F172A" fontSize="2.8" fontWeight="600" fontFamily="sans-serif">
                    {inter.label}
                  </text>
                </g>
              ))}
              <text x={graphicScale.totalWidth} y="8" textAnchor="middle" fill="#0F172A" fontSize="2.8" fontWeight="600" fontFamily="sans-serif">
                5m
              </text>
            </g>

            {/* 6. ISO 7200 TITLEBLOCK STAMP BOX (Bottom Right Corner: 185mm x 65mm) */}
            {(() => {
              const tbW = 185;
              const tbH = 65;
              const tbX = sheetSize.widthMm - 10 - tbW;
              const tbY = sheetSize.heightMm - 10 - tbH;

              return (
                <g id="ISO_TITLEBLOCK_STAMP" transform={`translate(${tbX}, ${tbY})`}>
                  {/* Titleblock Container */}
                  <rect x="0" y="0" width={tbW} height={tbH} fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.8" />

                  {/* Horizontal dividers */}
                  <line x1="0" y1="18" x2={tbW} y2="18" stroke="#0F172A" strokeWidth="0.5" />
                  <line x1="0" y1="36" x2={tbW} y2="36" stroke="#0F172A" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2={tbW} y2="50" stroke="#0F172A" strokeWidth="0.5" />

                  {/* Vertical dividers */}
                  <line x1="125" y1="36" x2="125" y2={tbH} stroke="#0F172A" strokeWidth="0.5" />
                  <line x1="60" y1="50" x2="60" y2={tbH} stroke="#0F172A" strokeWidth="0.5" />

                  {/* Block 1: Studio & Client Branding */}
                  <rect x="2" y="2" width="14" height="14" fill="#0284C7" rx="1.5" />
                  <text x="9" y="10.5" textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize="6" fontWeight="900">
                    MQ
                  </text>
                  <text x="20" y="7" fill="#0F172A" fontSize="4.5" fontWeight="900" fontFamily="sans-serif">
                    MEPLANIQ BIM &amp; CAD STUDIO
                  </text>
                  <text x="20" y="12" fill="#64748B" fontSize="2.8" fontWeight="600" fontFamily="sans-serif">
                    Automated MEP Engineering &amp; Architectural Systems
                  </text>
                  <text x={tbW - 4} y="7" textAnchor="end" fill="#64748B" fontSize="2.8" fontFamily="sans-serif">
                    PROJECT NO: <b>{activeSheet.projectNumber}</b>
                  </text>

                  {/* Block 2: Project Title & Client */}
                  <text x="4" y="23" fill="#64748B" fontSize="2.5" fontWeight="700" fontFamily="sans-serif">
                    PROJECT TITLE:
                  </text>
                  <text x="4" y="29" fill="#0F172A" fontSize="4.2" fontWeight="800" fontFamily="sans-serif">
                    {activeSheet.projectName.toUpperCase()}
                  </text>
                  <text x="4" y="33.5" fill="#64748B" fontSize="2.6" fontFamily="sans-serif">
                    CLIENT: {activeSheet.clientName}
                  </text>

                  {/* Block 3: Sheet Title & Discipline */}
                  <text x="4" y="41" fill="#64748B" fontSize="2.5" fontWeight="700" fontFamily="sans-serif">
                    SHEET TITLE:
                  </text>
                  <text x="4" y="46.5" fill="#0F172A" fontSize="3.8" fontWeight="900" fontFamily="sans-serif">
                    {activeSheet.sheetTitle}
                  </text>

                  {/* Block 4: Sheet Number & Discipline Stamp */}
                  <rect x="127" y="38" width="56" height="25" fill="#0F172A" rx="1" />
                  <text x="155" y="44" textAnchor="middle" fill={disciplineColor} fontSize="3.2" fontWeight="800" fontFamily="sans-serif">
                    {activeSheet.discipline}
                  </text>
                  <text x="155" y="56" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900" fontFamily="sans-serif">
                    {activeSheet.sheetNumber}
                  </text>
                  <text x="155" y="61" textAnchor="middle" fill="#94A3B8" fontSize="2.6" fontFamily="sans-serif">
                    SHEET {activeSheet.pageIndex} OF {activeSheet.totalPages}
                  </text>

                  {/* Block 5: Scale, Date, Rev */}
                  <text x="4" y="54" fill="#64748B" fontSize="2.4" fontFamily="sans-serif">
                    SCALE: <b>{activeSheet.scaleId} @ {selectedPaperSize}</b>
                  </text>
                  <text x="4" y="61" fill="#64748B" fontSize="2.4" fontFamily="sans-serif">
                    DATE: <b>{activeSheet.date}</b>
                  </text>
                  <text x="64" y="54" fill="#64748B" fontSize="2.4" fontFamily="sans-serif">
                    STATUS: <b>{activeSheet.status}</b>
                  </text>
                  <text x="64" y="61" fill="#64748B" fontSize="2.4" fontFamily="sans-serif">
                    REVISION: <b>{activeSheet.revision}</b>
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* ─── Print Specific CSS Styles ─────────────────────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .cad-sheet-modal-backdrop,
          .cad-sheet-modal-backdrop * {
            visibility: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .cad-sheet-modal-backdrop {
            position: fixed !important;
            inset: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #FFFFFF !important;
          }
          .print-sheet-wrapper {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
