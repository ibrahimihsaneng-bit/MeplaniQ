/**
 * frontend/src/features/electrical/ElectricalTable.jsx
 * ====================================================
 * Comprehensive engineering schedule table for electrical fixtures,
 * circuits, and conduit wire routes docked in the BottomScheduleEditor.
 */

import React, { useState, useEffect } from 'react';
import {
  ELECTRICAL_FIXTURES,
  CIRCUIT_SPECS,
  generateElectricalId
} from './electricalTypes';

const inputStyle = {
  backgroundColor: '#0F172A',
  borderColor: '#334155',
  color: '#E2E8F0',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};

const coordInputStyle = {
  ...inputStyle,
  width: '68px',
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: '600'
};

function FixtureRow({ comp, rooms, circuits, hvacEquipment, onUpdateComponent, onDeleteComponent }) {
  const [draft, setDraft] = useState(comp);

  useEffect(() => {
    setDraft(comp);
  }, [comp]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(comp);

  const handleChange = (field, val) => {
    setDraft(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    onUpdateComponent && onUpdateComponent(comp.id, draft);
  };

  const spec = ELECTRICAL_FIXTURES[draft.type] || {};

  return (
    <tr
      style={{
        borderBottom: '1px solid #1E293B',
        backgroundColor: hasChanges ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
        fontSize: '12px'
      }}
    >
      {/* ID */}
      <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#38BDF8', whiteSpace: 'nowrap' }}>
        {comp.id}
      </td>

      {/* Type */}
      <td style={{ padding: '6px 8px' }}>
        <select
          value={draft.type || ''}
          onChange={(e) => {
            const nextType = e.target.value;
            const nextSpec = ELECTRICAL_FIXTURES[nextType] || {};
            setDraft(prev => ({
              ...prev,
              type: nextType,
              name: prev.name === spec.label ? nextSpec.label : prev.name,
              category: nextSpec.category || prev.category,
              mounting: nextSpec.mounting || prev.mounting,
              wattage: nextSpec.defaultWattage !== undefined ? nextSpec.defaultWattage : prev.wattage,
              width_mm: nextSpec.width || prev.width_mm,
              height_mm: nextSpec.height || prev.height_mm,
              symbol: nextSpec.symbol || prev.symbol
            }));
          }}
          style={inputStyle}
        >
          {Object.entries(ELECTRICAL_FIXTURES).map(([k, s]) => (
            <option key={k} value={k}>{s.icon} {s.label}</option>
          ))}
        </select>
      </td>

      {/* Name / Description */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="text"
          value={draft.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          style={inputStyle}
        />
      </td>

      {/* Host Room */}
      <td style={{ padding: '6px 8px' }}>
        <select
          value={draft.host_room_id || draft.host_room_name || ''}
          onChange={(e) => {
            const selectedRoom = rooms.find(r => (r.id || r.name) === e.target.value);
            setDraft(prev => ({
              ...prev,
              host_room_id: selectedRoom ? (selectedRoom.id || selectedRoom.name) : e.target.value,
              host_room_name: selectedRoom ? selectedRoom.name : e.target.value
            }));
          }}
          style={inputStyle}
        >
          <option value="">(Auto-Detect)</option>
          {rooms.map((r, i) => (
            <option key={r.id || i} value={r.id || r.name}>{r.name || `Room ${i + 1}`}</option>
          ))}
        </select>
      </td>

      {/* Circuit Assignment */}
      <td style={{ padding: '6px 8px' }}>
        <select
          value={draft.circuit_id || ''}
          onChange={(e) => handleChange('circuit_id', e.target.value || null)}
          style={inputStyle}
        >
          <option value="">(None)</option>
          {circuits.map(c => (
            <option key={c.id} value={c.id}>{c.id}: {c.name}</option>
          ))}
        </select>
      </td>

      {/* Mounting */}
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            backgroundColor: draft.mounting === 'wall' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: draft.mounting === 'wall' ? '#60A5FA' : '#FBBF24'
          }}
        >
          {draft.mounting || 'ceiling'}
        </span>
      </td>

      {/* Rating / Wattage */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="1"
          value={draft.wattage !== undefined ? draft.wattage : 0}
          onChange={(e) => handleChange('wattage', parseFloat(e.target.value) || 0)}
          style={{ ...coordInputStyle, width: '58px' }}
        />
      </td>

      {/* Linked HVAC (for AC Isolator) */}
      <td style={{ padding: '6px 8px' }}>
        {draft.type === 'ac_isolator_20a' ? (
          <select
            value={draft.linked_hvac_id || ''}
            onChange={(e) => handleChange('linked_hvac_id', e.target.value || null)}
            style={inputStyle}
          >
            <option value="">(Select AC Unit)</option>
            {(hvacEquipment || []).map(h => (
              <option key={h.id} value={h.id}>{h.id} ({h.type || 'AC'})</option>
            ))}
          </select>
        ) : (
          <span style={{ color: '#475569', fontSize: '11px' }}>—</span>
        )}
      </td>

      {/* X (mm) */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="50"
          value={draft.x !== undefined ? draft.x : 0}
          onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)}
          style={coordInputStyle}
        />
      </td>

      {/* Y (mm) */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="50"
          value={draft.y !== undefined ? draft.y : 0}
          onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)}
          style={coordInputStyle}
        />
      </td>

      {/* Rotation (deg) */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="15"
          value={draft.rotation !== undefined ? draft.rotation : 0}
          onChange={(e) => handleChange('rotation', parseFloat(e.target.value) || 0)}
          style={{ ...coordInputStyle, width: '52px' }}
        />
      </td>

      {/* Actions */}
      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            background: hasChanges ? '#0284C7' : '#1E293B',
            color: hasChanges ? '#FFFFFF' : '#64748B',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: hasChanges ? 'pointer' : 'default',
            marginRight: '6px'
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onDeleteComponent && onDeleteComponent(comp.id)}
          style={{
            background: 'transparent',
            color: '#EF4444',
            border: '1px solid #7F1D1D',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
          title="Delete Fixture"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function CircuitRow({ circuit, components, onUpdateCircuit, onDeleteCircuit }) {
  const [draft, setDraft] = useState(circuit);

  useEffect(() => {
    setDraft(circuit);
  }, [circuit]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(circuit);

  const handleSave = () => {
    onUpdateCircuit && onUpdateCircuit(circuit.id, draft);
  };

  const spec = CIRCUIT_SPECS[draft.category] || {};
  const isOverloaded = (draft.total_load_w || 0) > (spec.maxLoad || 1500);

  return (
    <tr
      style={{
        borderBottom: '1px solid #1E293B',
        backgroundColor: hasChanges ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
        fontSize: '12px'
      }}
    >
      <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#38BDF8' }}>
        {circuit.id}
      </td>
      <td style={{ padding: '6px 8px' }}>
        <input
          type="text"
          value={draft.name || ''}
          onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
          style={inputStyle}
        />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <select
          value={draft.category || 'lighting'}
          onChange={(e) => {
            const cat = e.target.value;
            const cSpec = CIRCUIT_SPECS[cat] || {};
            setDraft(prev => ({
              ...prev,
              category: cat,
              breaker_rating_a: cSpec.defaultBreaker || prev.breaker_rating_a,
              wire_gauge_sqmm: cSpec.defaultWireGauge || prev.wire_gauge_sqmm
            }));
          }}
          style={inputStyle}
        >
          {Object.entries(CIRCUIT_SPECS).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
      </td>
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="1"
          value={draft.breaker_rating_a || 10}
          onChange={(e) => setDraft(prev => ({ ...prev, breaker_rating_a: parseFloat(e.target.value) || 10 }))}
          style={{ ...coordInputStyle, width: '56px' }}
        />
        <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '3px' }}>A</span>
      </td>
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          step="0.5"
          value={draft.wire_gauge_sqmm || 1.5}
          onChange={(e) => setDraft(prev => ({ ...prev, wire_gauge_sqmm: parseFloat(e.target.value) || 1.5 }))}
          style={{ ...coordInputStyle, width: '56px' }}
        />
        <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '3px' }}>mm²</span>
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
        {(draft.connected_component_ids || []).length}
      </td>
      <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: isOverloaded ? '#EF4444' : '#10B981' }}>
        {draft.total_load_w || 0} W
        {isOverloaded && <span style={{ fontSize: '10px', marginLeft: '4px' }} title={`Exceeds ${spec.maxLoad}W limit`}>⚠️</span>}
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            background: hasChanges ? '#0284C7' : '#1E293B',
            color: hasChanges ? '#FFFFFF' : '#64748B',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: hasChanges ? 'pointer' : 'default',
            marginRight: '6px'
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onDeleteCircuit && onDeleteCircuit(circuit.id)}
          style={{
            background: 'transparent',
            color: '#EF4444',
            border: '1px solid #7F1D1D',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
          title="Delete Circuit"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function ElectricalTable({
  rooms = [],
  electricalComponents = [],
  electricalCircuits = [],
  electricalRoutes = [],
  hvacEquipment = [],
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  onAddCircuit,
  onUpdateCircuit,
  onDeleteCircuit,
  onAddRoute,
  onDeleteRoute,
  onAutoRoute
}) {
  const [subTab, setSubTab] = useState('components'); // 'components' | 'circuits' | 'routes'

  const handleAddFixtureClick = () => {
    const firstRoom = rooms[0];
    let cx = 2000;
    let cy = 2000;
    if (firstRoom && firstRoom.points && firstRoom.points.length > 0) {
      const xs = firstRoom.points.map(p => p[0]);
      const ys = firstRoom.points.map(p => p[1]);
      cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
      cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    }
    const spec = ELECTRICAL_FIXTURES['recessed_downlight'];
    const newId = generateElectricalId('DL', electricalComponents);

    onAddComponent && onAddComponent({
      id: newId,
      type: 'recessed_downlight',
      name: spec.label,
      category: spec.category,
      mounting: spec.mounting,
      wattage: spec.defaultWattage,
      x: cx,
      y: cy,
      rotation: 0,
      host_room_id: firstRoom ? (firstRoom.id || firstRoom.name) : null,
      host_room_name: firstRoom ? firstRoom.name : null
    });
  };

  const handleAddCircuitClick = () => {
    const newId = generateElectricalId('L', electricalCircuits);
    onAddCircuit && onAddCircuit({
      id: newId,
      name: `Circuit ${newId}`,
      category: 'lighting',
      breaker_rating_a: 10,
      wire_gauge_sqmm: 1.5,
      connected_component_ids: []
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      {/* Top Header Controls: Subtabs + Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        {/* Subtabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'components', label: 'Fixtures', count: electricalComponents.length, icon: '💡' },
            { id: 'circuits', label: 'Circuits', count: electricalCircuits.length, icon: '⚡' },
            { id: 'routes', label: 'Conduits & Routes', count: electricalRoutes.length, icon: '〰️' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                border: subTab === t.id ? '1px solid #38BDF8' : '1px solid #334155',
                backgroundColor: subTab === t.id ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
                color: subTab === t.id ? '#38BDF8' : '#94A3B8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.8, background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '10px' }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {subTab === 'components' && (
            <button
              type="button"
              onClick={handleAddFixtureClick}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                color: '#34D399',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>+</span>
              <span>Add Fixture</span>
            </button>
          )}

          {subTab === 'circuits' && (
            <button
              type="button"
              onClick={handleAddCircuitClick}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                color: '#34D399',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>+</span>
              <span>Create Circuit</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAutoRoute}
            style={{
              backgroundColor: 'rgba(2, 132, 199, 0.2)',
              border: '1px solid #38BDF8',
              color: '#38BDF8',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Auto-route Manhattan conduits connecting DB to switchboards and lights"
          >
            <span>⚡</span>
            <span>Auto-Route</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #1E293B', borderRadius: '4px' }}>
        {subTab === 'components' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#151A20', zIndex: 2 }}>
              <tr style={{ borderBottom: '2px solid #2A3441', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px' }}>ID</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px' }}>Label / Name</th>
                <th style={{ padding: '8px' }}>Host Room</th>
                <th style={{ padding: '8px' }}>Circuit</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Mount</th>
                <th style={{ padding: '8px' }}>Watts</th>
                <th style={{ padding: '8px' }}>Linked HVAC</th>
                <th style={{ padding: '8px' }}>X (mm)</th>
                <th style={{ padding: '8px' }}>Y (mm)</th>
                <th style={{ padding: '8px' }}>Rot (°)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {electricalComponents.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No electrical fixtures placed. Click "+ Add Fixture" or select the Electrical tool (⚡ / 'E') on the left palette to click on canvas.
                  </td>
                </tr>
              ) : (
                electricalComponents.map((comp) => (
                  <FixtureRow
                    key={comp.id}
                    comp={comp}
                    rooms={rooms}
                    circuits={electricalCircuits}
                    hvacEquipment={hvacEquipment}
                    onUpdateComponent={onUpdateComponent}
                    onDeleteComponent={onDeleteComponent}
                  />
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'circuits' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#151A20', zIndex: 2 }}>
              <tr style={{ borderBottom: '2px solid #2A3441', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px' }}>Circuit ID</th>
                <th style={{ padding: '8px' }}>Circuit Name</th>
                <th style={{ padding: '8px' }}>Category</th>
                <th style={{ padding: '8px' }}>Breaker (A)</th>
                <th style={{ padding: '8px' }}>Wire (mm²)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Points</th>
                <th style={{ padding: '8px' }}>Total Load</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {electricalCircuits.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No circuits created yet. Click "+ Create Circuit" to define distribution circuits.
                  </td>
                </tr>
              ) : (
                electricalCircuits.map((ckt) => (
                  <CircuitRow
                    key={ckt.id}
                    circuit={ckt}
                    components={electricalComponents}
                    onUpdateCircuit={onUpdateCircuit}
                    onDeleteCircuit={onDeleteCircuit}
                  />
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'routes' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#151A20', zIndex: 2 }}>
              <tr style={{ borderBottom: '2px solid #2A3441', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px' }}>Route ID</th>
                <th style={{ padding: '8px' }}>Circuit</th>
                <th style={{ padding: '8px' }}>From</th>
                <th style={{ padding: '8px' }}>To</th>
                <th style={{ padding: '8px' }}>Conduit Type</th>
                <th style={{ padding: '8px' }}>Conductors</th>
                <th style={{ padding: '8px' }}>Length (m)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Auto?</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {electricalRoutes.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No conduit routes generated. Click "⚡ Auto-Route" to compute orthogonal paths automatically.
                  </td>
                </tr>
              ) : (
                electricalRoutes.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1E293B', fontSize: '12px' }}>
                    <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#F59E0B' }}>
                      {r.id}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{r.circuit_id || '—'}</td>
                    <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace" }}>{r.from_component_id || '—'}</td>
                    <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace" }}>{r.to_component_id || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.conduit_type || 'slab_conduit'}</td>
                    <td style={{ padding: '6px 8px', fontSize: '11px', color: '#94A3B8' }}>
                      {(r.conductors || ['phase', 'neutral', 'earth']).join(', ')}
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {((r.length_mm || 0) / 1000).toFixed(2)} m
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {r.is_auto_generated ? '✓' : 'Manual'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onDeleteRoute && onDeleteRoute(r.id)}
                        style={{
                          background: 'transparent',
                          color: '#EF4444',
                          border: '1px solid #7F1D1D',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                        title="Delete Route"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
