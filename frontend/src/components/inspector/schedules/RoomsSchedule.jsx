import React, { useState, useEffect } from 'react';
import ScheduleHeader from './ScheduleHeader';

const ROOM_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function RoomsSchedule({
  rooms = [],
  onUpdateRoom,
  selectedElement,
  onSelectItem
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newRoomName, setNewRoomName] = useState(`Room ${rooms.length + 1}`);
  const [newRoomX, setNewRoomX] = useState('0');
  const [newRoomY, setNewRoomY] = useState('0');
  const [newRoomW, setNewRoomW] = useState('3000');
  const [newRoomH, setNewRoomH] = useState('3000');

  useEffect(() => {
    setNewRoomName(`Room ${rooms.length + 1}`);
  }, [rooms.length]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const name = newRoomName.trim() || `Room ${rooms.length + 1}`;
    const x = Number(newRoomX) || 0;
    const y = Number(newRoomY) || 0;
    const w = Number(newRoomW) > 0 ? Number(newRoomW) : 3000;
    const h = Number(newRoomH) > 0 ? Number(newRoomH) : 3000;

    const pts = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];

    if (onUpdateRoom) {
      onUpdateRoom('AddRoom', null, { name, points: pts });
    }

    setIsAdding(false);
    setNewRoomName(`Room ${rooms.length + 2}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScheduleHeader
        title="Rooms Schedule"
        count={rooms.length}
        countUnit="rooms"
        addLabel="+ Add Room"
        isAdding={isAdding}
        onAddClick={() => setIsAdding(prev => !prev)}
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
        {/* Inline Add Room Card */}
        {isAdding && (
          <form
            onSubmit={handleCreateRoom}
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
                + Define New Room
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Coordinates in mm</span>
            </div>

            <div>
              <label style={labelStyle}>Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="e.g. Master Bedroom"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>X Coordinate (mm)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newRoomX}
                    onChange={e => setNewRoomX(e.target.value)}
                    step="50"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Y Coordinate (mm)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newRoomY}
                    onChange={e => setNewRoomY(e.target.value)}
                    step="50"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Width (mm)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newRoomW}
                    onChange={e => setNewRoomW(e.target.value)}
                    step="50"
                    min="500"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Height (mm)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newRoomH}
                    onChange={e => setNewRoomH(e.target.value)}
                    step="50"
                    min="500"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
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
                + Create Room
              </button>
            </div>
          </form>
        )}

        {/* Room Item Cards */}
        {rooms.length === 0 && !isAdding ? (
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
            <span style={{ fontSize: '24px' }}>📐</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No rooms defined yet</span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Click "+ Add Room" to define your first spatial boundary</span>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              style={{ ...primaryBtnStyle, marginTop: '8px' }}
            >
              + Add First Room
            </button>
          </div>
        ) : (
          rooms.map((room, idx) => (
            <RoomCard
              key={`${room.name}-${idx}`}
              room={room}
              index={idx}
              isSelected={selectedElement?.type === 'Room' && selectedElement.item?.name === room.name}
              onSelect={() => onSelectItem && onSelectItem({ type: 'Room', item: room })}
              onUpdateRoom={onUpdateRoom}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RoomCard({ room, index, isSelected, onSelect, onUpdateRoom }) {
  const xs = (room.points || []).map(p => p[0]);
  const ys = (room.points || []).map(p => p[1]);
  const initialX = xs.length ? Math.min(...xs) : 0;
  const initialY = ys.length ? Math.min(...ys) : 0;
  const initialW = xs.length ? Math.max(...xs) - initialX : 3000;
  const initialH = ys.length ? Math.max(...ys) - initialY : 3000;

  const [name, setName] = useState(room.name || '');
  const [x, setX] = useState(String(initialX));
  const [y, setY] = useState(String(initialY));
  const [width, setWidth] = useState(String(initialW));
  const [height, setHeight] = useState(String(initialH));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setName(room.name || '');
    setX(String(initialX));
    setY(String(initialY));
    setWidth(String(initialW));
    setHeight(String(initialH));
    setIsSaved(false);
  }, [room.name, initialX, initialY, initialW, initialH]);

  const handleUpdate = () => {
    if (onUpdateRoom) {
      const trimmedName = name.trim() || room.name;
      const numX = Number(x) || 0;
      const numY = Number(y) || 0;
      const numW = Number(width) > 0 ? Number(width) : initialW;
      const numH = Number(height) > 0 ? Number(height) : initialH;

      const newPoints = [
        [numX, numY],
        [numX + numW, numY],
        [numX + numW, numY + numH],
        [numX, numY + numH]
      ];

      onUpdateRoom('Room', room.name, { name: trimmedName, points: newPoints });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onUpdateRoom) {
      onUpdateRoom('DeleteRoom', room.name, {});
    }
  };

  const carpetAreaSqm = room.carpet_area_sqm != null ? room.carpet_area_sqm : (initialW * initialH / 1e6);
  const carpetAreaSqft = (carpetAreaSqm * 10.7639).toFixed(0);

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
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: ROOM_COLORS[index % ROOM_COLORS.length]
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
            {room.name}
          </span>
          {isSelected && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
              Selected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8' }}>
            {carpetAreaSqm.toFixed(1)} m²
          </span>
          <span style={{ fontSize: '10px', color: '#64748B' }}>
            ({carpetAreaSqft} sq ft)
          </span>
        </div>
      </div>

      {/* Room Name Input */}
      <div>
        <label style={labelStyle}>Room Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUpdate()}
          style={inputStyle}
        />
      </div>

      {/* Coordinates (X, Y) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>X Coordinate</label>
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
          <label style={labelStyle}>Y Coordinate</label>
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

      {/* Dimensions (Width, Height) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Width</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={width}
              onChange={e => setWidth(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              min="500"
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
              min="500"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>
      </div>

      {/* Actions Row */}
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
          {isSaved ? '✓ Changes saved to canvas' : `Boundary: 4 points`}
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
              title="Update room coordinates and dimensions on canvas"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${room.name} and associated items`}
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
  padding: '6px 32px 6px 10px',
  fontSize: '13px',
  color: '#F8FAFC',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace"
};

const unitStyle = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '11px',
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
