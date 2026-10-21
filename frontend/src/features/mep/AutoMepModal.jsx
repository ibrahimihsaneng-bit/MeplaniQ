import React, { useState } from 'react';

export default function AutoMepModal({ isOpen, onClose, onApply, projectName }) {
  const [hvacType, setHvacType] = useState('ducted'); // 'ducted' | 'split'
  const [includeElectrical, setIncludeElectrical] = useState(true);
  const [includePlumbing, setIncludePlumbing] = useState(true);
  const [includeStructural, setIncludeStructural] = useState(true);
  const [includeClashDetection, setIncludeClashDetection] = useState(true);
  const [ductVelocity, setDuctVelocity] = useState('5.0'); // m/s
  const [targetLux, setTargetLux] = useState('200'); // Lux

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      hvacType,
      includeElectrical,
      includePlumbing,
      includeStructural,
      includeClashDetection,
      ductVelocity: parseFloat(ductVelocity) || 5.0,
      targetLux: parseInt(targetLux, 10) || 200
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '12px',
        width: '540px',
        maxWidth: '95vw',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>⚙️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#F8FAFC' }}>
                Coordinated Auto-MEP Engine
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>
                ASHRAE 90.1 • CIBSE Lux • UPC Plumbing • Multi-Discipline BIM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Project Reference Badge */}
          <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ color: '#94A3B8' }}>Active Floorplan:</span>
            <span style={{ fontWeight: 700, color: '#38BDF8' }}>{projectName || 'Parametric Project Floorplan'}</span>
          </div>

          {/* 1. HVAC System Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>
              💨 HVAC System Architecture
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => setHvacType('ducted')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${hvacType === 'ducted' ? '#F97316' : '#334155'}`,
                  backgroundColor: hvacType === 'ducted' ? 'rgba(249, 115, 22, 0.12)' : '#1E293B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#FB923C' }}>
                  <span>🏢</span>
                  <span>Central Ducted Air</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '4px' }}>
                  ASHRAE CLTD CFM calculation, AHU plant, main supply duct & 4-way ceiling diffusers.
                </div>
              </div>

              <div
                onClick={() => setHvacType('split')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${hvacType === 'split' ? '#A855F7' : '#334155'}`,
                  backgroundColor: hvacType === 'split' ? 'rgba(168, 85, 247, 0.12)' : '#1E293B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#C084FC' }}>
                  <span>❄️</span>
                  <span>Split-Unit AC</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '4px' }}>
                  Wall-mounted indoor IDUs paired with outdoor ODU condenser units.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Engineering Disciplines Checkboxes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>
              📐 Coordinated Multi-Discipline Packages
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#1E293B', padding: '12px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeElectrical}
                  onChange={(e) => setIncludeElectrical(e.target.checked)}
                  style={{ accentColor: '#EAB308', width: '15px', height: '15px' }}
                />
                <span>⚡ <strong>Electrical System:</strong> Main 3PH DB-01, Concealed Conduits, Downlights & Power Sockets</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includePlumbing}
                  onChange={(e) => setIncludePlumbing(e.target.checked)}
                  style={{ accentColor: '#06B6D4', width: '15px', height: '15px' }}
                />
                <span>🚰 <strong>Plumbing System:</strong> Ø32/25 DCW Cold Water Mains & Ø110 1:40 Gravity Soil Drainage</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeStructural}
                  onChange={(e) => setIncludeStructural(e.target.checked)}
                  style={{ accentColor: '#38BDF8', width: '15px', height: '15px' }}
                />
                <span>🏛️ <strong>Structural Grid:</strong> M25 RC Columns (300x300mm) & Grid Centerlines (A, B / 1, 2)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeClashDetection}
                  onChange={(e) => setIncludeClashDetection(e.target.checked)}
                  style={{ accentColor: '#EF4444', width: '15px', height: '15px' }}
                />
                <span>⚠️ <strong>BIM Clash Detection:</strong> Automated Collision Matrix (Structure vs Ductwork vs Plumbing)</span>
              </label>
            </div>
          </div>

          {/* 3. Engineering Standard Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                Trunk Duct Velocity (m/s)
              </label>
              <input
                type="number"
                value={ductVelocity}
                onChange={(e) => setDuctVelocity(e.target.value)}
                min="3.0"
                max="8.0"
                step="0.5"
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                Illumination Target (CIBSE Lux)
              </label>
              <input
                type="number"
                value={targetLux}
                onChange={(e) => setTargetLux(e.target.value)}
                min="100"
                max="500"
                step="50"
                style={{
                  width: '100%',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: '#0B1120'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              color: '#94A3B8',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: '1px solid #34D399',
              color: '#FFFFFF',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)'
            }}
          >
            <span>⚡</span>
            <span>Generate & Coordinate MEP</span>
          </button>
        </div>
      </div>
    </div>
  );
}
