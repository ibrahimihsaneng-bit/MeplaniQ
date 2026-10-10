import React, { useState, useEffect } from 'react';
import ScheduleHeader from './ScheduleHeader';

const WALL_SIDES = ['Bottom', 'Right', 'Top', 'Left'];
const DOOR_SWINGS = ['Inward-Right', 'Inward-Left', 'Outward-Right', 'Outward-Left'];

export default function OpeningsSchedule({
  rooms = [],
  doors = [],
  windows = [],
  onUpdateOpening,
  selectedElement,
  onSelectItem
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'doors' | 'windows'
  const [isAdding, setIsAdding] = useState(false);

  // New Opening Form State
  const availableRooms = rooms.length > 0 ? rooms : [{ name: 'Living Room' }];
  const [newType, setNewType] = useState('Door');
  const [newHostRoom, setNewHostRoom] = useState(availableRooms[0]?.name || 'Living Room');
  const [newWallSide, setNewWallSide] = useState('Bottom');
  const [newOffset, setNewOffset] = useState('1000');
  const [newWidth, setNewWidth] = useState('900');
  const [newHeight, setNewHeight] = useState('2100');
  const [newSwing, setNewSwing] = useState('Inward-Right');

  useEffect(() => {
    if (availableRooms.length > 0 && !newHostRoom) {
      setNewHostRoom(availableRooms[0].name);
    }
  }, [availableRooms, newHostRoom]);

  const handleTypeChange = (t) => {
    setNewType(t);
    if (t === 'Door') {
      setNewWidth('900');
      setNewHeight('2100');
      setNewSwing('Inward-Right');
    } else {
      setNewWidth('1200');
      setNewHeight('1200');
      setNewSwing('');
    }
  };

  const getNextId = (prefix, list) => {
    let num = 1;
    while (list.some(item => String(item.id).toUpperCase() === `${prefix}${num}`)) {
      num++;
    }
    return `${prefix}${num}`;
  };

  const handleCreateOpening = (e) => {
    e.preventDefault();
    const isDoor = newType === 'Door';
    const safeHostRoom = newHostRoom || availableRooms[0]?.name || 'Living Room';
    const safeOffset = Math.max(50, Number(newOffset) || 1000);
    const safeWidth = Math.max(300, Number(newWidth) || (isDoor ? 900 : 1200));
    const safeHeight = Math.max(300, Number(newHeight) || (isDoor ? 2100 : 1200));
    const safeSwing = isDoor ? (newSwing || 'Inward-Right') : 'Inward-Right';
    const safeId = isDoor ? getNextId('D', doors) : getNextId('W', windows);

    const newOpeningPayload = {
      id: safeId,
      type: newType,
      kind: newType,
      host_room: safeHostRoom,
      wall_side: newWallSide || 'Bottom',
      offset_mm: safeOffset,
      width_mm: safeWidth,
      height_mm: safeHeight,
      swing: safeSwing
    };

    if (onUpdateOpening) {
      onUpdateOpening('AddOpening', null, newOpeningPayload);
    }

    setIsAdding(false);
  };

  // Combine and sort
  const allOpenings = [
    ...doors.map(d => ({ ...d, kind: 'Door' })),
    ...windows.map(w => ({ ...w, kind: 'Window' }))
  ];

  const filteredOpenings = allOpenings.filter(item => {
    if (filter === 'doors') return item.kind === 'Door';
    if (filter === 'windows') return item.kind === 'Window';
    return true;
  });

  const filterOptions = [
    { id: 'all', label: 'All', count: allOpenings.length },
    { id: 'doors', label: 'Doors', count: doors.length },
    { id: 'windows', label: 'Windows', count: windows.length }
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScheduleHeader
        title="Openings Schedule"
        count={allOpenings.length}
        countUnit="openings"
        addLabel="+ Add Opening"
        isAdding={isAdding}
        onAddClick={() => setIsAdding(prev => !prev)}
        filterOptions={filterOptions}
        activeFilter={filter}
        onFilterChange={setFilter}
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
        {/* Inline Add Opening Card */}
        {isAdding && (
          <form
            onSubmit={handleCreateOpening}
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
                + Place New Opening
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Snap to Host Wall</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Opening Type</label>
                <select
                  value={newType}
                  onChange={e => handleTypeChange(e.target.value)}
                  style={selectStyle}
                >
                  <option value="Door">Door (Hinged)</option>
                  <option value="Window">Window (Glazed)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Host Room</label>
                <select
                  value={newHostRoom}
                  onChange={e => setNewHostRoom(e.target.value)}
                  style={selectStyle}
                >
                  {availableRooms.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Wall Orientation</label>
                <select
                  value={newWallSide}
                  onChange={e => setNewWallSide(e.target.value)}
                  style={selectStyle}
                >
                  {WALL_SIDES.map(side => (
                    <option key={side} value={side}>{side} Wall</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Offset from Corner</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newOffset}
                    onChange={e => setNewOffset(e.target.value)}
                    step="50"
                    min="50"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Width</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newWidth}
                    onChange={e => setNewWidth(e.target.value)}
                    step="50"
                    min="300"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Height</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newHeight}
                    onChange={e => setNewHeight(e.target.value)}
                    step="50"
                    min="300"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>
            </div>

            {newType === 'Door' && (
              <div>
                <label style={labelStyle}>Door Swing Direction</label>
                <select
                  value={newSwing}
                  onChange={e => setNewSwing(e.target.value)}
                  style={selectStyle}
                >
                  {DOOR_SWINGS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

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
                + Insert Opening
              </button>
            </div>
          </form>
        )}

        {/* List of Openings */}
        {filteredOpenings.length === 0 && !isAdding ? (
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
            <span style={{ fontSize: '24px' }}>🚪</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No openings found</span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Add doors and windows snapped into room boundary walls</span>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              style={{ ...primaryBtnStyle, marginTop: '8px' }}
            >
              + Add First Opening
            </button>
          </div>
        ) : (
          filteredOpenings.map(item => (
            <OpeningCard
              key={`${item.kind}-${item.id}`}
              item={item}
              rooms={availableRooms}
              isSelected={
                (selectedElement?.type === 'Door' || selectedElement?.type === 'Window') &&
                selectedElement.item?.id === item.id
              }
              onSelect={() => onSelectItem && onSelectItem({ type: item.kind, item })}
              onUpdateOpening={onUpdateOpening}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OpeningCard({ item, rooms, isSelected, onSelect, onUpdateOpening }) {
  const isDoor = item.kind === 'Door';
  const [hostRoom, setHostRoom] = useState(item.host_room || rooms[0]?.name || 'Living Room');
  const [wallSide, setWallSide] = useState(item.wall_side || 'Bottom');
  const [offset, setOffset] = useState(String(item.offset_mm ?? 1000));
  const [width, setWidth] = useState(String(item.width_mm ?? (isDoor ? 900 : 1200)));
  const [height, setHeight] = useState(String(item.height_mm ?? (isDoor ? 2100 : 1200)));
  const [swing, setSwing] = useState(item.swing || 'Inward-Right');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setHostRoom(item.host_room || rooms[0]?.name || 'Living Room');
    setWallSide(item.wall_side || 'Bottom');
    setOffset(String(item.offset_mm ?? 1000));
    setWidth(String(item.width_mm ?? (isDoor ? 900 : 1200)));
    setHeight(String(item.height_mm ?? (isDoor ? 2100 : 1200)));
    setSwing(item.swing || 'Inward-Right');
    setIsSaved(false);
  }, [item, rooms, isDoor]);

  const handleUpdate = () => {
    if (onUpdateOpening) {
      const updates = {
        host_room: hostRoom,
        wall_side: wallSide,
        offset_mm: Math.max(50, Number(offset) || 1000),
        width_mm: Math.max(300, Number(width) || (isDoor ? 900 : 1200)),
        height_mm: Math.max(300, Number(height) || (isDoor ? 2100 : 1200)),
        ...(isDoor ? { swing } : {})
      };

      onUpdateOpening(isDoor ? 'Door' : 'Window', item.id, updates);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onUpdateOpening) {
      onUpdateOpening('DeleteOpening', item.id, {});
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
              backgroundColor: isDoor ? 'rgba(56, 189, 248, 0.15)' : 'rgba(139, 92, 246, 0.15)',
              color: isDoor ? '#38BDF8' : '#A78BFA',
              border: `1px solid ${isDoor ? 'rgba(56, 189, 248, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
            }}
          >
            {item.id}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC' }}>
            {item.kind} &bull; {item.host_room || 'Room'}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
          {wallSide} Wall
        </span>
      </div>

      {/* Host Room & Wall Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Host Room</label>
          <select
            value={hostRoom}
            onChange={e => setHostRoom(e.target.value)}
            style={selectStyle}
          >
            {rooms.map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Wall Side</label>
          <select
            value={wallSide}
            onChange={e => setWallSide(e.target.value)}
            style={selectStyle}
          >
            {WALL_SIDES.map(side => (
              <option key={side} value={side}>{side} Wall</option>
            ))}
          </select>
        </div>
      </div>

      {/* Offset & Dimensions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Corner Offset</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={offset}
              onChange={e => setOffset(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Width</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={width}
              onChange={e => setWidth(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Height</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>
      </div>

      {/* Door Swing */}
      {isDoor && (
        <div>
          <label style={labelStyle}>Door Swing Direction</label>
          <select
            value={swing}
            onChange={e => setSwing(e.target.value)}
            style={selectStyle}
          >
            {DOOR_SWINGS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

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
          {isSaved ? '✓ Geometry cut updated' : `${width} × ${height} mm`}
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
              title="Update opening on canvas"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${item.id}`}
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
