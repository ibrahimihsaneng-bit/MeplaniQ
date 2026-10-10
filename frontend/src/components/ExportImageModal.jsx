import React, { useState } from 'react';
import { exportToImage, isLightBackground } from '../utils/exportImage';

export { exportToImage } from '../utils/exportImage';

export default function ExportImageModal({ isOpen, onClose }) {
  const [resolution, setResolution] = useState('2');
  const [bgColor, setBgColor] = useState('#FFFFFF'); // Default to Pure White as requested
  const [includeGrid, setIncludeGrid] = useState(true);
  const [paddingBuffer, setPaddingBuffer] = useState(75);
  const [format, setFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  if (!isOpen) return null;

  const isLight = isLightBackground(bgColor);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      await exportToImage({
        resolution,
        bgColor,
        includeGrid,
        paddingBuffer,
        format,
        fileName: `cad-floorplan-${bgColor === '#FFFFFF' ? 'white' : 'dark'}`
      });

      onClose();
    } catch (e) {
      console.error('Image export failed:', e);
      setExportError(e?.message || 'Export failed. Please check canvas content and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#1E293B', padding: '24px', borderRadius: '10px',
        width: '440px', maxWidth: '90vw', color: '#F8FAFC',
        boxShadow: '0 20px 35px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, color: '#E2E8F0', fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🖼️</span> Export Floorplan Image
          </h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Quality / Resolution Setting */}
        <div style={{ marginBottom: '14px', marginTop: '18px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
            Image Quality & Scale
          </label>
          <select 
            value={resolution} 
            onChange={e => setResolution(e.target.value)}
            disabled={isExporting}
            style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0F172A', color: '#E2E8F0', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            <option value="1">Standard Resolution (1x - 72 DPI)</option>
            <option value="2">High Resolution (2x - 144 DPI / Recommended)</option>
            <option value="4">Ultra HD / 4K Crisp (4x - 300 DPI Print)</option>
          </select>
        </div>

        {/* Background Color Setting */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
            Export Background Color
          </label>
          <select 
            value={bgColor} 
            onChange={e => setBgColor(e.target.value)}
            disabled={isExporting}
            style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0F172A', color: '#E2E8F0', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            <option value="#FFFFFF">Pure White (#FFFFFF - High Contrast Architectural)</option>
            <option value="#0F172A">Classic Dark CAD (#0F172A - Screen View)</option>
            <option value="#F1F5F9">Light Blueprint Paper (#F1F5F9)</option>
          </select>
        </div>

        {/* Smart Color Inversion Indicator Badge */}
        {isLight && (
          <div style={{
            marginBottom: '14px', padding: '8px 12px', backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '11px',
            color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span>✨</span>
            <span>
              <strong>Smart Inversion Active:</strong> Text labels, dimension numbers, and wall boundaries dynamically draw in deep black (<code style={{ color: '#E2E8F0' }}>#111111</code>) while preserving all MEP colors (Cyan water supply, Green drainage, Orange dots).
            </span>
          </div>
        )}

        {/* Grid Lines Toggle Control */}
        <div style={{ marginBottom: '14px', backgroundColor: '#0F172A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#E2E8F0', userSelect: 'none' }}>
            <input 
              type="checkbox"
              checked={includeGrid}
              onChange={e => setIncludeGrid(e.target.checked)}
              disabled={isExporting}
              style={{ width: '16px', height: '16px', accentColor: '#0284C7', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 500 }}>Include CAD Grid Lines</span>
          </label>
          <p style={{ margin: '4px 0 0 26px', fontSize: '11px', color: '#64748B' }}>
            {includeGrid 
              ? (isLight ? 'Rendered in subtle architectural light-gray (#E0E0E0).' : 'Rendered in subtle semi-transparent white.') 
              : 'Grid lines will be completely excluded from the exported image.'}
          </p>
        </div>

        {/* Professional Margin / Padding Buffer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
              Margin / Padding Buffer
            </label>
            <select 
              value={paddingBuffer} 
              onChange={e => setPaddingBuffer(Number(e.target.value))}
              disabled={isExporting}
              style={{ width: '100%', padding: '8px 10px', backgroundColor: '#0F172A', color: '#E2E8F0', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
            >
              <option value={50}>50px (Compact)</option>
              <option value={75}>75px (Standard Pro)</option>
              <option value={100}>100px (Spacious)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
              Image Format
            </label>
            <select 
              value={format} 
              onChange={e => setFormat(e.target.value)}
              disabled={isExporting}
              style={{ width: '100%', padding: '8px 10px', backgroundColor: '#0F172A', color: '#E2E8F0', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
            >
              <option value="png">PNG (Lossless & Crisp)</option>
              <option value="jpeg">JPEG (Compressed)</option>
            </select>
          </div>
        </div>

        {exportError && (
          <div style={{ marginBottom: '14px', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', color: '#F87171', fontSize: '12px' }}>
            ⚠ {exportError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            onClick={onClose}
            disabled={isExporting}
            style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #475569', color: '#CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            style={{ 
              padding: '8px 20px', 
              backgroundColor: isExporting ? '#0369A1' : '#0284C7', 
              border: 'none', 
              color: '#FFFFFF', 
              borderRadius: '6px', 
              cursor: isExporting ? 'wait' : 'pointer', 
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)'
            }}
          >
            {isExporting ? (
              <>
                <span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Generating Image...
              </>
            ) : (
              <>
                <span>💾</span> Download Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
