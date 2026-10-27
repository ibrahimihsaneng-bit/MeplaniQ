import React, { useState, useMemo } from 'react';
import {
  LAYER_STANDARDS,
  compileAutoLispScript,
  compileAutoCadScript
} from './autolispCompilerEngine';

/**
 * AutoCadLispStudioModal.jsx
 * ==========================
 * Interactive Autodesk AutoCAD & AutoLISP Code Studio.
 * Compiles 2D architectural & MEP CAD model geometry into production-grade
 * executable AutoLISP (.lsp) and AutoCAD Batch Command Scripts (.scr).
 */
export default function AutoCadLispStudioModal({
  isOpen,
  onClose,
  solveData,
  projectName = 'MeplanIQ Floorplan'
}) {
  const [outputFormat, setOutputFormat] = useState('lsp'); // 'lsp' | 'scr'
  const [standard, setStandard] = useState('AIA'); // 'AIA' | 'ISO13567'
  const [units, setUnits] = useState('mm'); // 'mm' | 'm'
  const [scale, setScale] = useState('1:50');
  const [includeHatches, setIncludeHatches] = useState(true);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeRoomTags, setIncludeRoomTags] = useState(true);
  const [includeMep, setIncludeMep] = useState(true);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'guide' | 'layers'
  const [copied, setCopied] = useState(false);

  // Compile code
  const compiledOutput = useMemo(() => {
    const opts = {
      standard,
      units,
      scale,
      includeHatches,
      includeDimensions,
      includeRoomTags,
      includeMep,
      projectName
    };
    if (outputFormat === 'scr') {
      return compileAutoCadScript(solveData, opts);
    }
    return compileAutoLispScript(solveData, opts);
  }, [outputFormat, standard, units, scale, includeHatches, includeDimensions, includeRoomTags, includeMep, projectName, solveData]);

  // Statistics
  const stats = useMemo(() => {
    const lines = compiledOutput.split('\n');
    const wallCount = (solveData?.wall_polygons || solveData?.walls || []).length;
    const doorCount = (solveData?.doors || []).length;
    const ductCount = (solveData?.hvac_ducts || []).length;
    const pipeCount = (solveData?.plumbing_pipes || []).length;
    const roomCount = (solveData?.rooms || []).length;
    return {
      lineCount: lines.length,
      byteSize: new Blob([compiledOutput]).size,
      wallCount,
      doorCount,
      mepCount: ductCount + pipeCount,
      roomCount
    };
  }, [compiledOutput, solveData]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(compiledOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download file
  const handleDownload = () => {
    const ext = outputFormat === 'scr' ? 'scr' : 'lsp';
    const mime = 'text/plain;charset=utf-8';
    const blob = new Blob([compiledOutput], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanName = (projectName || 'MeplanIQ').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${cleanName}_${standard}_${units}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const currentLayers = (LAYER_STANDARDS[standard] || LAYER_STANDARDS.AIA).layers;

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
          <span style={{ fontSize: '22px' }}>⚙️</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.4px' }}>
              AUTOCAD &amp; AUTOLISP COMPILER STUDIO
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              Native Autodesk AutoCAD (.lsp / .scr) Code Generator • {LAYER_STANDARDS[standard].name}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: copied ? '#059669' : '#1E293B',
              border: `1px solid ${copied ? '#34D399' : '#475569'}`,
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284C7',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(56, 189, 248, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>💾</span>
            <span>Download .{outputFormat}</span>
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

          <button
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

      {/* ─── Main Content Splitter ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: Compiler Configuration Sidebar */}
        <div
          style={{
            width: '320px',
            backgroundColor: '#0F172A',
            borderRight: '1px solid #1E293B',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto'
          }}
        >
          {/* Format Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#38BDF8', marginBottom: '6px' }}>
              OUTPUT TARGET FORMAT
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setOutputFormat('lsp')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: outputFormat === 'lsp' ? '#0284C7' : '#1E293B',
                  border: `1px solid ${outputFormat === 'lsp' ? '#38BDF8' : '#334155'}`,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                AutoLISP (.lsp)
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat('scr')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: outputFormat === 'scr' ? '#0284C7' : '#1E293B',
                  border: `1px solid ${outputFormat === 'scr' ? '#38BDF8' : '#334155'}`,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                Script (.scr)
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
              {outputFormat === 'lsp'
                ? 'Full AutoLISP routine with blocks, undo handling, and MEPLANIQ_BUILD command.'
                : 'AutoCAD LT compatible command script. Run via SCRIPT command.'}
            </div>
          </div>

          {/* Layer Standard */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
              CAD LAYER STANDARD
            </label>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '7px 10px',
                fontSize: '12px'
              }}
            >
              <option value="AIA">AIA CAD Guidelines (US - Standard)</option>
              <option value="ISO13567">ISO 13567 (International)</option>
            </select>
          </div>

          {/* Units & Scale */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                DRAWING UNITS
              </label>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '12px'
                }}
              >
                <option value="mm">Millimeters (1:1)</option>
                <option value="m">Meters (1:0.001)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>
                ANNOTATION SCALE
              </label>
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '12px'
                }}
              >
                <option value="1:20">1:20</option>
                <option value="1:50">1:50</option>
                <option value="1:100">1:100</option>
              </select>
            </div>
          </div>

          {/* Subsystem Toggles */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '8px' }}>
              INCLUDED SUBSYSTEMS
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeHatches}
                  onChange={(e) => setIncludeHatches(e.target.checked)}
                />
                <span>🧱 Solid Wall &amp; Column Hatches</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeMep}
                  onChange={(e) => setIncludeMep(e.target.checked)}
                />
                <span>⚡ MEP (HVAC, Plumbing, Electrical, Sleeves)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeDimensions}
                  onChange={(e) => setIncludeDimensions(e.target.checked)}
                />
                <span>📏 Aligned Dimension Strings</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeRoomTags}
                  onChange={(e) => setIncludeRoomTags(e.target.checked)}
                />
                <span>🏷️ Room Centroid Tags &amp; Areas</span>
              </label>
            </div>
          </div>

          {/* Quick Metrics */}
          <div
            style={{
              backgroundColor: '#1E293B',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              marginTop: 'auto'
            }}
          >
            <div style={{ fontWeight: 800, color: '#38BDF8', marginBottom: '6px' }}>
              COMPILER STATS:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', marginBottom: '3px' }}>
              <span>Total Code Lines:</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700 }}>{stats.lineCount.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', marginBottom: '3px' }}>
              <span>Payload Size:</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700 }}>{(stats.byteSize / 1024).toFixed(1)} KB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', marginBottom: '3px' }}>
              <span>Walls &amp; Doors:</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700 }}>{stats.wallCount + stats.doorCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
              <span>MEP Runs &amp; Fix:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>{stats.mepCount}</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Main Workspace (Tabs: Code | Guide | Layer Table) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0B0F19' }}>
          {/* Sub-Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              backgroundColor: '#0F172A',
              borderBottom: '1px solid #1E293B'
            }}
          >
            <button
              onClick={() => setActiveTab('code')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'code' ? '#1E293B' : 'transparent',
                border: `1px solid ${activeTab === 'code' ? '#38BDF8' : 'transparent'}`,
                color: activeTab === 'code' ? '#38BDF8' : '#94A3B8',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              💻 Generated Code Preview
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'guide' ? '#1E293B' : 'transparent',
                border: `1px solid ${activeTab === 'guide' ? '#38BDF8' : 'transparent'}`,
                color: activeTab === 'guide' ? '#38BDF8' : '#94A3B8',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📋 AutoCAD Run Guide
            </button>
            <button
              onClick={() => setActiveTab('layers')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'layers' ? '#1E293B' : 'transparent',
                border: `1px solid ${activeTab === 'layers' ? '#38BDF8' : 'transparent'}`,
                color: activeTab === 'layers' ? '#38BDF8' : '#94A3B8',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📑 Layer Standard Table ({Object.keys(currentLayers).length})
            </button>
          </div>

          {/* TAB 1: Code Preview */}
          {activeTab === 'code' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              <pre
                style={{
                  margin: 0,
                  fontFamily: '"Fira Code", Consolas, Monaco, monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#E2E8F0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {compiledOutput}
              </pre>
            </div>
          )}

          {/* TAB 2: Run Guide */}
          {activeTab === 'guide' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: '800px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#38BDF8', marginBottom: '8px' }}>
                How to Run in Autodesk AutoCAD (or BricsCAD / ZWCAD)
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
                Follow these standard architectural CAD steps to execute the compiled code directly inside your CAD viewport.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #38BDF8' }}>
                  <div style={{ fontWeight: 800, color: '#F8FAFC', marginBottom: '4px', fontSize: '13px' }}>
                    Method 1: Drag &amp; Drop (Fastest)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', lineHeight: '1.6' }}>
                    1. Download the <code style={{ color: '#38BDF8' }}>.{outputFormat}</code> file using the top button.<br />
                    2. Open Autodesk AutoCAD with a new blank drawing.<br />
                    3. Drag and drop the downloaded file directly onto the AutoCAD drawing window.<br />
                    4. In the AutoCAD command line, type <strong style={{ color: '#34D399' }}>MEPLANIQ_BUILD</strong> and press <kbd style={{ backgroundColor: '#334155', padding: '2px 6px', borderRadius: '4px' }}>Enter</kbd>.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                  <div style={{ fontWeight: 800, color: '#F8FAFC', marginBottom: '4px', fontSize: '13px' }}>
                    Method 2: APPLOAD Command (AutoLISP)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', lineHeight: '1.6' }}>
                    1. Type <code style={{ color: '#38BDF8' }}>APPLOAD</code> in AutoCAD and press Enter.<br />
                    2. Browse and select the downloaded <code style={{ color: '#38BDF8' }}>.lsp</code> file, then click <strong>Load</strong>.<br />
                    3. Run <strong style={{ color: '#34D399' }}>MEPLANIQ_BUILD</strong> to generate all entities with colors, lineweights, and layers.<br />
                    4. To remove and reset, type <strong style={{ color: '#EF4444' }}>MEPLANIQ_PURGE</strong>.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ fontWeight: 800, color: '#F8FAFC', marginBottom: '4px', fontSize: '13px' }}>
                    Method 3: AutoCAD LT / Command Script (.scr)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', lineHeight: '1.6' }}>
                    1. Choose <strong>Script (.scr)</strong> in the left sidebar.<br />
                    2. In AutoCAD LT, type <code style={{ color: '#38BDF8' }}>SCRIPT</code> and press Enter.<br />
                    3. Select the <code style={{ color: '#38BDF8' }}>.scr</code> file to run batch line and layer generation automatically.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Layer Table */}
          {activeTab === 'layers' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1E293B', color: '#38BDF8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Layer Name</th>
                    <th style={{ padding: '8px 12px' }}>ACI Color</th>
                    <th style={{ padding: '8px 12px' }}>Lineweight</th>
                    <th style={{ padding: '8px 12px' }}>Linetype</th>
                    <th style={{ padding: '8px 12px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(currentLayers).map((l, i) => (
                    <tr
                      key={l.name}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#0B0F19' : '#0F172A',
                        borderBottom: '1px solid #1E293B'
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#F8FAFC' }}>
                        {l.name}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '2px',
                              backgroundColor: {
                                1: '#EF4444',
                                2: '#FACC15',
                                3: '#10B981',
                                4: '#06B6D4',
                                5: '#3B82F6',
                                6: '#EC4899',
                                7: '#FFFFFF',
                                8: '#64748B',
                                9: '#94A3B8',
                                30: '#F97316'
                              }[l.color] || '#FFFFFF',
                              border: '1px solid #334155'
                            }}
                          />
                          <span>Color {l.color}</span>
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{l.lw} mm</td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{l.linetype || 'Continuous'}</td>
                      <td style={{ padding: '8px 12px', color: '#64748B' }}>{l.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
