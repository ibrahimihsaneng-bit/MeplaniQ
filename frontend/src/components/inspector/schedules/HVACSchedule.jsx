import React, { useState, useEffect } from 'react';
import ScheduleHeader from './ScheduleHeader';

const HVAC_UNIT_TYPES = [
  'High-Wall IDU',
  'Cassette IDU',
  'Ducted IDU',
  'Split ODU',
  'VRF ODU'
];

export default function HVACSchedule({
  rooms = [],
  equipment = [],
  loads = [],
  pipes = [],
  onUpdateEquipment,
  selectedElement,
  onSelectItem
}) {
  const [subView, setSubView] = useState('equipment'); // 'equipment' | 'loads'
  const [isAdding, setIsAdding] = useState(false);

  const availableRooms = rooms.length > 0 ? rooms : [{ name: 'Living Room' }];
  const [newType, setNewType] = useState('High-Wall IDU');
  const [newRoom, setNewRoom] = useState(availableRooms[0]?.name || 'Living Room');
  const [newCap, setNewCap] = useState('1.5');

  const totalCoolingTR = equipment.reduce((sum, eq) => sum + (Number(eq.capacity_tr ?? eq.cooling_capacity_tr) || 0), 0);

  const generateNextId = (unitType) => {
    const isODU = (unitType || '').toLowerCase().includes('odu');
    const prefix = isODU ? 'ODU' : 'IDU';
    let count = 1;
    let candidate = `${prefix}-${count}`;
    while (equipment.some(e => (e?.id || '').toUpperCase() === candidate.toUpperCase())) {
      count++;
      candidate = `${prefix}-${count}`;
    }
    return candidate;
  };

  const handleCreateHVAC = (e) => {
    e.preventDefault();
    const isODU = newType.toLowerCase().includes('odu');
    const cap = Math.max(0.5, Number(newCap) || 1.5);
    const generatedId = generateNextId(newType);

    const newUnit = {
      id: generatedId,
      unit_type: newType,
      room_name: newRoom || (isODU ? 'Exterior' : availableRooms[0]?.name || 'Living Room'),
      capacity_tr: cap,
      cooling_capacity_tr: cap,
      cfm: Math.round(cap * 400)
    };

    if (onUpdateEquipment) {
      onUpdateEquipment('AddHVAC', null, newUnit);
    }

    setIsAdding(false);
  };

  const filterOptions = [
    { id: 'equipment', label: 'Equipment', count: equipment.length },
    { id: 'loads', label: 'Room Loads', count: loads.length }
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScheduleHeader
        title="HVAC & MEP Schedule"
        count={equipment.length}
        countUnit="units"
        addLabel="+ Add HVAC"
        isAdding={isAdding}
        onAddClick={() => setIsAdding(prev => !prev)}
        filterOptions={filterOptions}
        activeFilter={subView}
        onFilterChange={setSubView}
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Inline Add HVAC Card */}
        {isAdding && (
          <form
            onSubmit={handleCreateHVAC}
            style={{
              backgroundColor: '#1C2430',
              border: '1px solid #38BDF8',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>
                + Place HVAC Unit
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>ASHRAE Heat Load Sizing</span>
            </div>

            <div>
              <label style={labelStyle}>Unit Type</label>
              <select
                value={newType}
                onChange={e => {
                  setNewType(e.target.value);
                  if (e.target.value.includes('ODU')) {
                    const balcony = availableRooms.find(r => r.name.toLowerCase().includes('balcony') || r.name.toLowerCase().includes('exterior'));
                    setNewRoom(balcony ? balcony.name : 'Exterior');
                  }
                }}
                style={selectStyle}
              >
                {HVAC_UNIT_TYPES.map(ut => (
                  <option key={ut} value={ut}>{ut}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Assigned Room</label>
                <select
                  value={newRoom}
                  onChange={e => setNewRoom(e.target.value)}
                  style={selectStyle}
                >
                  <option value="Exterior">Exterior / Balcony</option>
                  {availableRooms.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cooling Capacity</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newCap}
                    onChange={e => setNewCap(e.target.value)}
                    step="0.5"
                    min="0.5"
                    max="10"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>TR</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ ...primaryBtnStyle, backgroundColor: '#10B981' }}
              >
                + Add HVAC Unit
              </button>
            </div>
          </form>
        )}

        {/* Total Capacity Pill Banner */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px'
          }}
        >
          <span style={{ color: '#94A3B8' }}>Total Installed Tonnage:</span>
          <span style={{ fontWeight: 700, color: '#38BDF8', fontSize: '13px' }}>
            {totalCoolingTR.toFixed(1)} TR &bull; {Math.round(totalCoolingTR * 400)} CFM
          </span>
        </div>

        {/* View 1: Equipment Cards */}
        {subView === 'equipment' && (
          equipment.length === 0 && !isAdding ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                backgroundColor: 'rgba(24, 32, 47, 0.4)',
                border: '1px dashed #2A3441',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '24px' }}>❄️</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No HVAC equipment placed</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Place indoor and outdoor AC units to condition spaces</span>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                style={{ ...primaryBtnStyle, marginTop: '8px' }}
              >
                + Place First HVAC Unit
              </button>
            </div>
          ) : (
            equipment.map((eq, idx) => (
              <HVACCard
                key={`hvac-${eq.id || idx}`}
                eq={eq}
                rooms={availableRooms}
                isSelected={selectedElement?.type === 'HVAC' && selectedElement.item?.id === eq.id}
                onSelect={() => onSelectItem && onSelectItem({ type: 'HVAC', item: eq })}
                onUpdateEquipment={onUpdateEquipment}
              />
            ))
          )
        )}

        {/* View 2: Room Cooling Loads */}
        {subView === 'loads' && (
          loads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '12px' }}>
              No load calculations available for current room geometry.
            </div>
          ) : (
            loads.map((load, idx) => (
              <div
                key={`load-${load.room_name || idx}`}
                style={{
                  backgroundColor: '#18202F',
                  border: '1px solid #2A3441',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                    {load.room_name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: load.is_conditioned ? '#34D399' : '#94A3B8',
                      backgroundColor: load.is_conditioned ? 'rgba(52, 211, 153, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {load.is_conditioned ? 'Conditioned' : 'Unconditioned'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                  <div style={{ color: '#94A3B8' }}>
                    Carpet Area: <strong style={{ color: '#F8FAFC' }}>{load.carpet_area_sqm} m²</strong>
                  </div>
                  <div style={{ color: '#94A3B8' }}>
                    Airflow Req: <strong style={{ color: '#38BDF8' }}>{load.airflow_cfm} CFM</strong>
                  </div>
                  <div style={{ color: '#94A3B8' }}>
                    Design Load: <strong style={{ color: '#38BDF8' }}>{load.cooling_load_tr} TR</strong>
                  </div>
                  <div style={{ color: '#94A3B8' }}>
                    Refrig Lines: <strong style={{ color: '#F8FAFC' }}>{load.liquid_line_inch || '1/4"'} &bull; {load.suction_line_inch || '1/2"'}</strong>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

function HVACCard({ eq, rooms, isSelected, onSelect, onUpdateEquipment }) {
  const isODU = (eq.unit_type || '').toLowerCase().includes('odu');
  const [unitType, setUnitType] = useState(eq.unit_type || 'Split-IDU');
  const [roomName, setRoomName] = useState(eq.room_name || rooms[0]?.name || 'Living Room');
  const [capTr, setCapTr] = useState(String(eq.capacity_tr ?? eq.cooling_capacity_tr ?? 1.5));
  const [x, setX] = useState(String(Math.round(eq.x ?? eq.location_x ?? 0)));
  const [y, setY] = useState(String(Math.round(eq.y ?? eq.location_y ?? 0)));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setUnitType(eq.unit_type || 'Split-IDU');
    setRoomName(eq.room_name || rooms[0]?.name || 'Living Room');
    setCapTr(String(eq.capacity_tr ?? eq.cooling_capacity_tr ?? 1.5));
    setX(String(Math.round(eq.x ?? eq.location_x ?? 0)));
    setY(String(Math.round(eq.y ?? eq.location_y ?? 0)));
    setIsSaved(false);
  }, [eq, rooms]);

  const handleUpdate = () => {
    if (onUpdateEquipment) {
      const parsedCap = Math.max(0.5, Number(capTr) || 1.5);
      const parsedX = Math.round(Number(x) || 0);
      const parsedY = Math.round(Number(y) || 0);

      onUpdateEquipment('HVAC', eq.id, {
        unit_type: unitType,
        room_name: roomName,
        capacity_tr: parsedCap,
        cooling_capacity_tr: parsedCap,
        cfm: Math.round(parsedCap * 400),
        x: parsedX,
        y: parsedY,
        location_x: parsedX,
        location_y: parsedY
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onUpdateEquipment) {
      onUpdateEquipment('DeleteHVAC', eq.id, {});
    }
  };

  return (
    <div
      onClick={onSelect}
      style={{
        backgroundColor: '#18202F',
        border: isSelected ? '1px solid #2F80ED' : '1px solid #2A3441',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: isSelected ? '0 0 12px rgba(47, 128, 237, 0.25)' : 'none',
        transition: 'all 0.15s ease'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: isODU ? 'rgba(236, 72, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isODU ? '#F472B6' : '#38BDF8',
              border: `1px solid ${isODU ? 'rgba(236, 72, 153, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
            }}
          >
            {eq.id}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC' }}>
            {unitType}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>
          {capTr} TR ({Math.round(Number(capTr) * 400)} CFM)
        </span>
      </div>

      {/* Unit Type & Host Room */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Unit Type</label>
          <select
            value={unitType}
            onChange={e => setUnitType(e.target.value)}
            style={selectStyle}
          >
            {HVAC_UNIT_TYPES.map(ut => (
              <option key={ut} value={ut}>{ut}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Assigned Room</label>
          <select
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            style={selectStyle}
          >
            <option value="Exterior">Exterior / Balcony</option>
            {rooms.map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Capacity & Coordinates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Cooling (TR)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={capTr}
              onChange={e => setCapTr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="0.5"
              min="0.5"
              style={inputStyle}
            />
            <span style={unitStyle}>TR</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>X Coord</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={x}
              onChange={e => setX(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Y Coord</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={y}
              onChange={e => setY(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid #242E3D',
          marginTop: '2px'
        }}
      >
        <span style={{ fontSize: '11px', color: isSaved ? '#10B981' : '#64748B', fontWeight: isSaved ? 600 : 400 }}>
          {isSaved ? '✓ Unit parameters updated' : `Pos: (${x}, ${y}) mm`}
        </span>

        {isDeleting ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>Delete?</span>
            <button
              type="button"
              onClick={() => setIsDeleting(false)}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              style={{ ...primaryBtnStyle, backgroundColor: '#EF4444' }}
            >
              Confirm
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleUpdate}
              style={primaryBtnStyle}
              title="Update HVAC unit on canvas"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${eq.id}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#94A3B8',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  minHeight: '36px',
  backgroundColor: '#0B0F19',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 30px 6px 10px',
  fontSize: '12px',
  color: '#F8FAFC',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace"
};

const selectStyle = {
  width: '100%',
  minHeight: '36px',
  backgroundColor: '#0B0F19',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '12px',
  color: '#F8FAFC',
  outline: 'none',
  boxSizing: 'border-box'
};

const unitStyle = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '10.5px',
  color: '#64748B',
  pointerEvents: 'none',
  fontWeight: 600
};

const primaryBtnStyle = {
  minHeight: '36px',
  padding: '0 16px',
  backgroundColor: '#2F80ED',
  border: 'none',
  borderRadius: '6px',
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s ease'
};

const secondaryBtnStyle = {
  minHeight: '36px',
  padding: '0 12px',
  backgroundColor: 'transparent',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#94A3B8',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const dangerOutlineBtnStyle = {
  minHeight: '36px',
  padding: '0 14px',
  backgroundColor: 'transparent',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  borderRadius: '6px',
  color: '#F87171',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease'
};
