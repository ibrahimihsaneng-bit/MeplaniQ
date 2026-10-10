import React, { useState } from 'react';

/**
 * AutomationHub: Central command hub inside the bottom dock for 
 * 1-click MEP automation, multi-model architectural layout variation switching,
 * and dual-line plumbing & conduit network management.
 */
export default function AutomationHub({
  solveData,
  editableElectricalComponents = [],
  editableElectricalCircuits = [],
  editableElectricalRoutes = [],
  editablePlumbingFixtures = [],
  editablePlumbingPipes = [],
  editableHvac = [],
  editableFurniture = [],
  onAutoPopulateMep,
  onAutoRouteElectrical,
  onAutoRoutePlumbing,
  onSwitchVariant,
  currentVariant = 0,
  isPopulating = false,
  isSwitchingVariant = false
}) {
  const [includeOpenings, setIncludeOpenings] = useState(true);
  const [includeElectrical, setIncludeElectrical] = useState(true);
  const [includePlumbing, setIncludePlumbing] = useState(true);
  const [includeHvac, setIncludeHvac] = useState(true);
  const [includeFurniture, setIncludeFurniture] = useState(true);
  const [clearExisting, setClearExisting] = useState(false);

  const VARIANTS = [
    {
      id: 0,
      name: "Model 1: Classic Dual-Wing",
      desc: "Day Wing (Living, Dining, Kitchen) on Left • Night Wing (Bedrooms, Baths) on Right • Master Suite at Rear.",
      badge: "Standard Compact Villa"
    },
    {
      id: 1,
      name: "Model 2: Mirrored Wings",
      desc: "Night Wing on Left • Day Wing on Right • Master Suite at Rear • Mirrored plot orientation.",
      badge: "Mirrored Plot Orientation"
    },
    {
      id: 2,
      name: "Model 3: Executive Villa",
      desc: "Day Wing on Left • Master Suite Front-Facing on Right • Rear Secondary Bedrooms & Baths.",
      badge: "Front-Facing Master Suite"
    },
    {
      id: 3,
      name: "Model 4: Mirrored Executive",
      desc: "Master Suite Front-Facing on Left • Day Wing on Right • Balanced dual frontage.",
      badge: "Mirrored Front Suite"
    }
  ];

  const handleRunAutomation = (customOpts = null) => {
    if (onAutoPopulateMep) {
      if (customOpts && typeof customOpts === 'object' && !customOpts.nativeEvent) {
        onAutoPopulateMep(customOpts);
      } else {
        onAutoPopulateMep({
          include_openings: includeOpenings,
          include_electrical: includeElectrical,
          include_plumbing: includePlumbing,
          include_hvac: includeHvac,
          include_furniture: includeFurniture,
          clear_existing: clearExisting
        });
      }
    }
  };

  const activeVariantId = Number(currentVariant || solveData?.layout_variant || 0) % 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', color: '#E2E8F0', padding: '4px 0' }}>
      {/* Top Banner: Quick Stats & Automation Trigger */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px'
      }}>
        {/* Card 1: Selective / Full MEP & Architectural Automation */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid #1E293B',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>⚡</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Selective &amp; Full Automation
                </span>
              </div>
              <span style={{ fontSize: '10px', backgroundColor: '#0284C7', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                SELECTIVE / ALL
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
              Choose individual disciplines to automate, or generate everything at once. Existing doors, windows, and MEP elements are safely preserved.
            </p>

            {/* Checkboxes for 5 Disciplines */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginTop: '10px', fontSize: '11px', color: '#CBD5E1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeOpenings} onChange={e => setIncludeOpenings(e.target.checked)} />
                🚪 Doors &amp; Windows
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeFurniture} onChange={e => setIncludeFurniture(e.target.checked)} />
                🪑 Furniture Layout
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeElectrical} onChange={e => setIncludeElectrical(e.target.checked)} />
                ⚡ Electrical &amp; Conduits
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeHvac} onChange={e => setIncludeHvac(e.target.checked)} />
                ❄️ HVAC (IDU/ODU)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includePlumbing} onChange={e => setIncludePlumbing(e.target.checked)} />
                🚿 Plumbing &amp; Pipes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#F59E0B' }}>
                <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} />
                🧹 Clear Existing
              </label>
            </div>

            {/* 1-Click Quick Discipline Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              <span style={{ fontSize: '10px', color: '#94A3B8', width: '100%', fontWeight: 600 }}>Quick 1-Click Automation:</span>
              <button
                type="button"
                onClick={() => handleRunAutomation({ include_openings: true, include_electrical: false, include_hvac: false, include_furniture: false, include_plumbing: false, clear_existing: false })}
                disabled={isPopulating}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38BDF8', color: '#38BDF8', cursor: 'pointer', fontWeight: 600 }}
              >
                + Only Doors/Windows
              </button>
              <button
                type="button"
                onClick={() => handleRunAutomation({ include_openings: false, include_electrical: false, include_hvac: false, include_furniture: true, include_plumbing: false, clear_existing: false })}
                disabled={isPopulating}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid #A855F7', color: '#C084FC', cursor: 'pointer', fontWeight: 600 }}
              >
                + Only Furniture
              </button>
              <button
                type="button"
                onClick={() => handleRunAutomation({ include_openings: false, include_electrical: true, include_hvac: false, include_furniture: false, include_plumbing: false, clear_existing: false })}
                disabled={isPopulating}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #F59E0B', color: '#FBBF24', cursor: 'pointer', fontWeight: 600 }}
              >
                + Only Electrical
              </button>
              <button
                type="button"
                onClick={() => handleRunAutomation({ include_openings: false, include_electrical: false, include_hvac: true, include_furniture: false, include_plumbing: false, clear_existing: false })}
                disabled={isPopulating}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.15)', border: '1px solid #EC4899', color: '#F472B6', cursor: 'pointer', fontWeight: 600 }}
              >
                + Only HVAC
              </button>
              <button
                type="button"
                onClick={() => handleRunAutomation({ include_openings: false, include_electrical: false, include_hvac: false, include_furniture: false, include_plumbing: true, clear_existing: false })}
                disabled={isPopulating}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#34D399', cursor: 'pointer', fontWeight: 600 }}
              >
                + Only Plumbing
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRunAutomation()}
            disabled={isPopulating}
            style={{
              backgroundColor: isPopulating ? '#475569' : '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isPopulating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
              transition: 'background 0.15s ease'
            }}
          >
            <span>{isPopulating ? '⚡ Populating Selected Disciplines...' : '⚡ Generate Selected Disciplines'}</span>
          </button>
        </div>

        {/* Card 2: Live Discipline Schedule Metrics */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid #1E293B',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px' }}>📊</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Engineering Schedule Metrics
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px' }}>
              <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid #0891B2', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: '#06B6D4', fontWeight: 700 }}>PLUMBING</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#E0F2FE' }}>
                  {editablePlumbingFixtures.length} fix. / {editablePlumbingPipes.length} pipes
                </div>
              </div>
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #D97706', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: '#F59E0B', fontWeight: 700 }}>ELECTRICAL</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#FEF3C7' }}>
                  {editableElectricalComponents.length} comp. / {editableElectricalRoutes.length} cond.
                </div>
              </div>
              <div style={{ backgroundColor: 'rgba(192, 132, 252, 0.1)', border: '1px solid #9333EA', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: '#C084FC', fontWeight: 700 }}>HVAC</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#F3E8FF' }}>
                  {editableHvac.length} units
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onAutoRouteElectrical}
              style={{
                flex: 1,
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #F59E0B',
                color: '#FBBF24',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Auto-route Manhattan orthogonal conduit wiring to DB"
            >
              ⚡ Re-Route Conduits
            </button>
            <button
              type="button"
              onClick={onAutoRoutePlumbing || (() => onAutoPopulateMep({ include_plumbing: true, include_electrical: false, include_hvac: false, include_furniture: false }))}
              style={{
                flex: 1,
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid #06B6D4',
                color: '#38BDF8',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Auto-route dual-line plumbing network (cyan supply + green drainage)"
            >
              🚿 Route Dual-Line Pipes
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Multi-Model Architectural Variation Switcher */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid #1E293B',
        borderRadius: '8px',
        padding: '12px 16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔄</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Multi-Model Architectural Variation Switcher
              </span>
              <span style={{
                fontSize: '10px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                SHIFT to Cycle
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '3px 0 0 0' }}>
              Click any model or press <strong>Shift</strong> key to cycle through different room arrangements while keeping carpet areas 100% constant.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSwitchVariant && onSwitchVariant((activeVariantId + 1) % 4)}
            disabled={isSwitchingVariant}
            style={{
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isSwitchingVariant ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.35)'
            }}
          >
            <span>{isSwitchingVariant ? 'Switching...' : `🔄 Cycle to Model ${((activeVariantId + 1) % 4) + 1} (Shift)`}</span>
          </button>
        </div>

        {/* 4 Architectural Model Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {VARIANTS.map(v => {
            const isActive = activeVariantId === v.id;
            return (
              <div
                key={v.id}
                onClick={() => onSwitchVariant && onSwitchVariant(v.id)}
                style={{
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                  border: isActive ? '2px solid #10B981' : '1px solid #334155',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: isSwitchingVariant ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#34D399' : '#F1F5F9' }}>
                    {v.name}
                  </span>
                  {isActive && (
                    <span style={{
                      fontSize: '9px',
                      backgroundColor: '#10B981',
                      color: '#000',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 800
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#6EE7B7', fontWeight: 600, marginBottom: '4px' }}>
                  {v.badge}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.35 }}>
                  {v.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
