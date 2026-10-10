import React, { useState, useEffect } from 'react';

export function generateNextHVACId(unitType, existingEquipment = []) {
  const isODU = (unitType || '').toLowerCase().includes('odu');
  const prefix = isODU ? 'ODU' : 'IDU';
  let count = 1;
  let candidate = `${prefix}-${count}`;
  while ((existingEquipment || []).some(e => (e?.id || '').toUpperCase() === candidate.toUpperCase())) {
    count++;
    candidate = `${prefix}-${count}`;
  }
  return candidate;
}

export function AddHVACModal({ isOpen, onClose, rooms = [], equipment = [], onConfirm }) {
  if (!isOpen) return null;

  const unitOptions = [
    { type: 'High-Wall IDU', category: 'Indoor Unit', icon: '❄️', defaultCap: 1.5, desc: 'Wall-mounted split indoor unit' },
    { type: 'Cassette IDU', category: 'Indoor Unit', icon: '🌀', defaultCap: 2.0, desc: 'Ceiling recessed 4-way cassette' },
    { type: 'Ducted IDU', category: 'Indoor Unit', icon: '💨', defaultCap: 2.5, desc: 'Ceiling concealed ducted blower' },
    { type: 'Split ODU', category: 'Outdoor Unit', icon: '⚡', defaultCap: 2.0, desc: 'Condenser unit on balcony/exterior' },
    { type: 'VRF ODU', category: 'Outdoor Unit', icon: '🏢', defaultCap: 4.0, desc: 'High-efficiency multi-split condenser' }
  ];

  const tonnages = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

  const [selectedType, setSelectedType] = useState('High-Wall IDU');
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.name || 'Living Room');
  const [capacityTr, setCapacityTr] = useState(1.5);
  const [error, setError] = useState('');

  // Keep selectedRoom valid if rooms change
  useEffect(() => {
    if (rooms && rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0].name);
    }
  }, [rooms, selectedRoom]);

  // When type changes, adjust default capacity and recommended room
  const handleTypeChange = (newType) => {
    setSelectedType(newType);
    const opt = unitOptions.find(o => o.type === newType);
    if (opt) {
      setCapacityTr(opt.defaultCap);
      if (opt.type.includes('ODU')) {
        const balcony = rooms.find(r => r.name.toLowerCase().includes('balcony') || r.name.toLowerCase().includes('corridor') || r.name.toLowerCase().includes('terrace'));
        if (balcony) {
          setSelectedRoom(balcony.name);
        } else {
          setSelectedRoom('Exterior');
        }
      } else {
        const cond = rooms.find(r => !r.name.toLowerCase().includes('balcony') && !r.name.toLowerCase().includes('corridor'));
        if (cond) {
          setSelectedRoom(cond.name);
        }
      }
    }
  };

  const isODU = selectedType.toLowerCase().includes('odu');
  const generatedId = generateNextHVACId(selectedType, equipment);

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!selectedType) {
      setError('Please select an HVAC unit type.');
      return;
    }
    const cap = parseFloat(capacityTr);
    if (!Number.isFinite(cap) || cap <= 0) {
      setError('Please select a valid cooling capacity.');
      return;
    }

    onConfirm({
      id: generatedId,
      unit_type: selectedType,
      room_name: selectedRoom || (isODU ? 'Exterior' : (rooms[0]?.name || 'Living Room')),
      capacity_tr: cap,
      cooling_capacity_tr: cap
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#1E293B',
          border: '1px solid #8B5CF6',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#F8FAFC',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '9999px', padding: '2px 8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#C084FC', letterSpacing: '0.5px' }}>+ NEW HVAC MEP UNIT</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
              Add HVAC Equipment
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              Configure unit type, cooling capacity, and target room. Orthogonal refrigerant pipe runs are auto-routed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: 1
            }}
            title="Close dialog"
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.18)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '8px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Unit Type Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Unit Category &amp; Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '6px' }}>
              {unitOptions.map(opt => {
                const isActive = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleTypeChange(opt.type)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 10px',
                      backgroundColor: isActive ? 'rgba(139, 92, 246, 0.25)' : '#0F172A',
                      border: isActive ? '1.5px solid #A855F7' : '1px solid #334155',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px' }}>{opt.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#FFFFFF' : '#E2E8F0' }}>
                        {opt.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Host Room & Capacity Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Host Room <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#E2E8F0',
                  padding: '8px 10px',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {rooms.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name} {r.carpet_area_sqm ? `(${(r.carpet_area_sqm).toFixed(1)} m²)` : ''}
                  </option>
                ))}
                <option value="Exterior">Exterior / Outdoor Wall</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Cooling Capacity (TR) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={capacityTr}
                onChange={(e) => setCapacityTr(parseFloat(e.target.value) || 1.5)}
                style={{
                  width: '100%',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#C084FC',
                  padding: '8px 10px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {tonnages.map(t => (
                  <option key={t} value={t}>
                    {t.toFixed(1)} TR ({Math.round(t * 400)} CFM)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Placement & ID Summary Card */}
          <div style={{
            backgroundColor: '#0B0F19',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Generated Unit ID:</span>
              <span style={{
                backgroundColor: isODU ? '#EC4899' : '#8B5CF6',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                {generatedId}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Host Room:</span>
              <span style={{ fontSize: '12px', color: '#E2E8F0', fontWeight: 600 }}>
                {selectedRoom}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Capacity &amp; Airflow:</span>
              <span style={{ fontSize: '12px', color: '#C084FC', fontWeight: 600 }}>
                {capacityTr.toFixed(1)} TR • {Math.round(capacityTr * 400)} CFM
              </span>
            </div>
            <div style={{ marginTop: '2px', borderTop: '1px solid #1E293B', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: '#38BDF8' }}>
                🔗 Auto-routing orthogonal refrigerant lines (Liquid + Suction Copper)
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #475569',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: '#8B5CF6',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '7px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>+ Add HVAC Unit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HVACRow({ eq, idx, rooms, tonnages, unitTypes, onUpdateEquipment, inputStyle }) {
  const isODU = (eq.unit_type || '').toLowerCase().includes('odu');
  const currentX = Math.round(eq.x ?? eq.location_x ?? 0);
  const currentY = Math.round(eq.y ?? eq.location_y ?? 0);
  const currentType = eq.unit_type || 'Split-IDU';
  const currentRoom = eq.room_name || '';
  const currentCap = eq.capacity_tr ?? eq.cooling_capacity_tr ?? 1.5;

  const [selectedType, setSelectedType] = useState(currentType);
  const [selectedRoom, setSelectedRoom] = useState(currentRoom);
  const [selectedCap, setSelectedCap] = useState(currentCap);
  const [editX, setEditX] = useState(String(currentX));
  const [editY, setEditY] = useState(String(currentY));
  const [isModified, setIsModified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dynamically sync fields when dragged on canvas or updated externally
  useEffect(() => {
    setSelectedType(eq.unit_type || 'Split-IDU');
    setSelectedRoom(eq.room_name || '');
    setSelectedCap(eq.capacity_tr ?? eq.cooling_capacity_tr ?? 1.5);
    setEditX(String(currentX));
    setEditY(String(currentY));
    setIsModified(false);
    setErrorMsg('');
  }, [eq, currentX, currentY]);

  const handleSaveAll = () => {
    const trimmedX = editX.trim();
    const trimmedY = editY.trim();
    const numX = Number(trimmedX);
    const numY = Number(trimmedY);

    if (trimmedX === '' || trimmedY === '' || isNaN(numX) || isNaN(numY) || !isFinite(numX) || !isFinite(numY)) {
      setErrorMsg('Invalid coordinates');
      return;
    }

    setErrorMsg('');
    setIsModified(false);

    if (onUpdateEquipment) {
      onUpdateEquipment('HVAC', eq.id, {
        unit_type: selectedType,
        room_name: selectedRoom,
        capacity_tr: selectedCap,
        cooling_capacity_tr: selectedCap,
        location_x: Math.round(numX),
        location_y: Math.round(numY),
        x: Math.round(numX),
        y: Math.round(numY)
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveAll();
    }
  };

  const coordInputStyle = {
    backgroundColor: '#0B0F19',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#334155',
    color: '#E2E8F0',
    borderRadius: '4px',
    padding: '3px 6px',
    fontSize: '12px',
    width: '64px',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <tr key={`eq-${eq.id}-${idx}`}>
      <td className="room-name-cell">
        <span
          className="room-color-badge"
          style={{ backgroundColor: isODU ? '#EC4899' : '#8B5CF6' }}
        />
        {eq.id}
      </td>
      <td>
        {onUpdateEquipment ? (
          <select 
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setIsModified(true);
              onUpdateEquipment('HVAC', eq.id, { unit_type: e.target.value });
            }}
            style={inputStyle}
          >
            {unitTypes.map(ut => <option key={ut} value={ut}>{ut}</option>)}
          </select>
        ) : eq.unit_type}
      </td>
      <td>
        {onUpdateEquipment ? (
          <select 
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setIsModified(true);
              onUpdateEquipment('HVAC', eq.id, { room_name: e.target.value });
            }}
            style={inputStyle}
          >
            {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            <option value="Exterior">Exterior</option>
          </select>
        ) : eq.room_name}
      </td>
      <td className="metric-cell">
        {onUpdateEquipment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select 
              value={selectedCap}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1.0;
                setSelectedCap(val);
                setIsModified(true);
                onUpdateEquipment('HVAC', eq.id, { capacity_tr: val, cooling_capacity_tr: val });
              }}
              style={{ ...inputStyle, width: '60px' }}
            >
              {tonnages.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span>TR</span>
          </div>
        ) : (
          `${selectedCap.toFixed(1)} TR`
        )}
      </td>
      <td>
        {onUpdateEquipment ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#94A3B8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>X:</span>
              <input
                type="number"
                value={editX}
                onChange={(e) => { setEditX(e.target.value); setIsModified(true); setErrorMsg(''); }}
                onKeyDown={handleKeyDown}
                style={{
                  ...coordInputStyle,
                  borderColor: errorMsg ? '#EF4444' : (isModified ? '#A855F7' : '#334155')
                }}
                title="X coordinate in mm (Press Enter or click Update)"
              />
              <span style={{ color: '#94A3B8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", marginLeft: '2px' }}>Y:</span>
              <input
                type="number"
                value={editY}
                onChange={(e) => { setEditY(e.target.value); setIsModified(true); setErrorMsg(''); }}
                onKeyDown={handleKeyDown}
                style={{
                  ...coordInputStyle,
                  borderColor: errorMsg ? '#EF4444' : (isModified ? '#A855F7' : '#334155')
                }}
                title="Y coordinate in mm (Press Enter or click Update)"
              />
            </div>
            {errorMsg && (
              <span style={{ color: '#EF4444', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                {errorMsg}
              </span>
            )}
          </div>
        ) : (
          <span className="metric-cell">({currentX}, {currentY})</span>
        )}
      </td>
      <td>
        {onUpdateEquipment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleSaveAll}
              style={{
                backgroundColor: isModified ? '#8B5CF6' : '#1E293B',
                color: isModified ? '#FFFFFF' : '#94A3B8',
                border: `1px solid ${isModified ? '#A855F7' : '#475569'}`,
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Save all changes and update 2D CAD canvas & solver"
            >
              {isModified ? 'Save' : 'Synced'}
            </button>
            <button
              type="button"
              onClick={() => onUpdateEquipment('DeleteHVAC', eq.id, {})}
              title={`Delete ${eq.id} and associated refrigerant pipes`}
              style={{
                background: 'transparent',
                border: '1px solid #EF4444',
                color: '#EF4444',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#EF4444'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#EF4444'; }}
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function HVACTable({ rooms = [], loads = [], equipment = [], pipes = [], onUpdateEquipment }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const totalTonnage = loads.reduce((acc, l) => acc + (l.cooling_load_tr || 0), 0);
  const totalCfm = loads.reduce((acc, l) => acc + (l.airflow_cfm || 0), 0);

  const inputStyle = {
    backgroundColor: '#0B0F19',
    border: '1px solid #334155',
    color: '#C084FC',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '12px',
    width: '120px',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '600'
  };

  const tonnages = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const unitTypes = ['High-Wall IDU', 'Cassette IDU', 'Ducted IDU', 'Split ODU', 'VRF ODU'];

  const handleAddHVACConfirm = (newItemData) => {
    setIsAddModalOpen(false);
    if (onUpdateEquipment) {
      onUpdateEquipment('AddHVAC', null, newItemData);
    }
  };

  return (
    <div className="table-container hvac-dashboard-container">
      {/* Header & Metric Summary Cards */}
      <div className="table-header-row">
        <div>
          <h3 className="table-title">HVAC MEP Engineering Summary (Cooling Loads &amp; Equipment)</h3>
          <span className="table-subtitle" style={{ fontSize: '11px', color: '#94A3B8' }}>
            Standard Sizing: ~1.0 TR / 150 sq.ft • Airflow: 400 CFM / TR • Orthogonal Refrigerant Line Routing
          </span>
        </div>
        <span className="table-count-badge" style={{ borderColor: '#8B5CF6', color: '#C084FC' }}>
          {loads.length} Room(s) • Total: {totalTonnage.toFixed(1)} TR ({totalCfm} CFM) • {equipment.length} Units • {pipes.length} Pipe Run(s)
        </span>
      </div>

      {/* 1. Room Cooling Loads Table */}
      <div style={{ marginBottom: 18 }}>
        <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
          Room Cooling Loads &amp; Sizing Schedule
        </h4>
        <table className="cad-table">
          <thead>
            <tr>
              <th>Room Name</th>
              <th>Environment</th>
              <th>Carpet Area</th>
              <th>Cooling Load (TR)</th>
              <th>Airflow (CFM)</th>
              <th>Liquid Line Size</th>
              <th>Suction Line Size</th>
            </tr>
          </thead>
          <tbody>
            {loads.length > 0 ? (
              loads.map((load, idx) => (
                <tr key={`load-${idx}`}>
                  <td className="room-name-cell">
                    <span
                      className="room-color-badge"
                      style={{ backgroundColor: load.is_conditioned ? '#A855F7' : '#64748B' }}
                    />
                    {load.room_name}
                  </td>
                  <td>
                    <span className={`kind-tag ${load.is_conditioned ? 'conditioned-tag' : 'unconditioned-tag'}`}>
                      {load.is_conditioned ? 'Conditioned' : 'Unconditioned'}
                    </span>
                  </td>
                  <td className="metric-cell">{load.carpet_area_sqm.toFixed(1)} m² ({load.carpet_area_sqft.toFixed(1)} sq.ft)</td>
                  <td className="metric-cell" style={{ color: load.is_conditioned ? '#C084FC' : '#64748B', fontWeight: 600 }}>
                    {load.is_conditioned ? `${load.cooling_load_tr.toFixed(1)} TR` : '—'}
                  </td>
                  <td className="metric-cell">{load.is_conditioned ? `${load.airflow_cfm} CFM` : '—'}</td>
                  <td className="metric-cell">{load.liquid_line_inch !== 'N/A' ? `${load.liquid_line_inch} Copper` : '—'}</td>
                  <td className="metric-cell">{load.suction_line_inch !== 'N/A' ? `${load.suction_line_inch} Insulated` : '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#94A3B8' }}>
                  No room cooling loads available. Add rooms to compute thermal loads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 2. Assigned Equipment & Refrigerant Lines Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>
              MEP Equipment Schedule ({equipment.length} Units)
            </h4>
            {onUpdateEquipment && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                title="Add a new HVAC equipment unit"
                style={{
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#7C3AED';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#8B5CF6';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.35)';
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1 }}>+</span>
                <span>Add HVAC Unit</span>
              </button>
            )}
          </div>
          <table className="cad-table">
            <thead>
              <tr>
                <th>Unit ID</th>
                <th>Type</th>
                <th>Host Room</th>
                <th>Capacity</th>
                <th>Coordinates (X, Y)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {equipment.length > 0 ? (
                equipment.map((eq, idx) => (
                  <HVACRow
                    key={`eq-${eq.id}-${idx}`}
                    eq={eq}
                    idx={idx}
                    rooms={rooms}
                    tonnages={tonnages}
                    unitTypes={unitTypes}
                    onUpdateEquipment={onUpdateEquipment}
                    inputStyle={inputStyle}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px 12px', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#E2E8F0', fontWeight: 600 }}>No HVAC equipment units assigned</span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Add indoor units (IDU) and outdoor units (ODU) to generate refrigerant piping</span>
                      {onUpdateEquipment && (
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          style={{
                            marginTop: '4px',
                            backgroundColor: '#8B5CF6',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          + Add First HVAC Unit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
            Orthogonal Refrigerant Pipe Runs ({pipes.length} Runs)
          </h4>
          <table className="cad-table">
            <thead>
              <tr>
                <th>Pipe ID</th>
                <th>Connection</th>
                <th>Sizes (Liq / Suc)</th>
                <th>Run Length</th>
              </tr>
            </thead>
            <tbody>
              {pipes.length > 0 ? (
                pipes.map((p, idx) => (
                  <tr key={`pipe-${p.pipe_id}-${idx}`}>
                    <td className="metric-cell" style={{ fontWeight: 600, color: '#38BDF8' }}>{p.pipe_id}</td>
                    <td>{p.from_unit_id} → {p.to_unit_id}</td>
                    <td className="metric-cell">{p.liquid_size} + {p.suction_size}</td>
                    <td className="metric-cell" style={{ color: '#FACC15', fontWeight: 600 }}>
                      {p.total_length_mm.toFixed(0)} mm ({(p.total_length_mm / 1000.0).toFixed(2)} m)
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px 12px', color: '#94A3B8' }}>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      Refrigerant lines will be automatically routed when both IDU and ODU are present.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add HVAC Unit Modal */}
      <AddHVACModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        rooms={rooms}
        equipment={equipment}
        onConfirm={handleAddHVACConfirm}
      />
    </div>
  );
}
