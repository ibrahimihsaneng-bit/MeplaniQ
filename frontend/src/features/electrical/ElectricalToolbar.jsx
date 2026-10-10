/**
 * frontend/src/features/electrical/ElectricalToolbar.jsx
 * ======================================================
 * Floating secondary toolbar for fixture selection and routing actions
 * when the Electrical tool mode is active.
 */

import React, { useState } from 'react';
import { ELECTRICAL_CATEGORIES, ELECTRICAL_FIXTURES } from './electricalTypes';

export default function ElectricalToolbar({
  selectedFixtureType = 'recessed_downlight',
  onSelectFixtureType,
  onAutoPopulate,
  onAutoRoute,
  onClearRoutes,
  totalComponents = 0,
  totalCircuits = 0
}) {
  const [activeCategory, setActiveCategory] = useState('lighting');

  const fixturesInCategory = Object.values(ELECTRICAL_FIXTURES).filter(
    (f) => f.category === activeCategory
  );

  return (
    <div
      className="electrical-floating-toolbar"
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        backgroundColor: 'rgba(17, 20, 24, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2A3441',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '90vw',
        overflowX: 'auto',
        color: '#E2E8F0',
        userSelect: 'none'
      }}
    >
      {/* Category Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid #334155', paddingRight: '10px' }}>
        {Object.entries(ELECTRICAL_CATEGORIES).map(([catKey, cat]) => {
          const isActive = activeCategory === catKey;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setActiveCategory(catKey)}
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: isActive ? '1px solid #38BDF8' : '1px solid transparent',
                color: isActive ? '#38BDF8' : '#94A3B8',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              title={cat.label}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Fixtures in Selected Category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        {fixturesInCategory.map((f) => {
          const isSelected = selectedFixtureType === f.type;
          return (
            <button
              key={f.type}
              type="button"
              onClick={() => onSelectFixtureType && onSelectFixtureType(f.type)}
              style={{
                background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                border: isSelected ? '1px solid #F59E0B' : '1px solid #334155',
                color: isSelected ? '#FDE047' : '#CBD5E1',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title={`${f.label} (${f.mounting}, ${f.defaultWattage}W)`}
            >
              <span style={{ fontSize: '13px' }}>{f.icon}</span>
              <span>{f.label}</span>
              <span style={{ fontSize: '9px', opacity: 0.7, padding: '1px 3px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px' }}>
                {f.defaultWattage > 0 ? `${f.defaultWattage}W` : f.mounting}
              </span>
            </button>
          );
        })}
      </div>

      {/* Routing & Automation Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #334155', paddingLeft: '10px' }}>
        {onAutoPopulate && (
          <button
            type="button"
            onClick={onAutoPopulate}
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: '1px solid #34D399',
              color: '#FFFFFF',
              borderRadius: '5px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
            }}
            title="Automatically populate standard electrical fixtures for all rooms"
          >
            <span>⚡</span>
            <span>Auto-Populate Fixtures</span>
          </button>
        )}

        <button
          type="button"
          onClick={onAutoRoute}
          style={{
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            border: '1px solid #38BDF8',
            color: '#FFFFFF',
            borderRadius: '5px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
          }}
          title="Compute deterministic Manhattan orthogonal routes for all circuits"
        >
          <span>⚡</span>
          <span>Auto-Route Conduits</span>
        </button>

        {onClearRoutes && (
          <button
            type="button"
            onClick={onClearRoutes}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94A3B8',
              borderRadius: '5px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            title="Clear wire routes"
          >
            Clear Routes
          </button>
        )}
      </div>
    </div>
  );
}
