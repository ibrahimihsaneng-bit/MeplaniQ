import React, { useState, useEffect } from 'react';
import ScheduleHeader from './ScheduleHeader';
import {
  FURNITURE_CATEGORIES,
  getFurnitureDefaults,
  generateNextFurnitureId,
  getClearanceBadgeInfo
} from '../../../FurnitureTable';

export default function FurnitureSchedule({
  rooms = [],
  furniture = [],
  onUpdateFurniture,
  selectedElement,
  onSelectItem
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAdding, setIsAdding] = useState(false);

  // New Furniture form state
  const availableRooms = rooms.length > 0 ? rooms : [{ name: 'Living Room' }];
  const [newCategory, setNewCategory] = useState('Bedroom');
  const [newType, setNewType] = useState('Double Bed');
  const [newRoom, setNewRoom] = useState(availableRooms[0]?.name || 'Living Room');
  const [newWidth, setNewWidth] = useState('1800');
  const [newHeight, setNewHeight] = useState('2000');
  const [newRotation, setNewRotation] = useState('0');

  useEffect(() => {
    if (availableRooms.length > 0 && !newRoom) {
      setNewRoom(availableRooms[0].name);
    }
  }, [availableRooms, newRoom]);

  const handleCategoryChange = (cat) => {
    setNewCategory(cat);
    const presets = FURNITURE_CATEGORIES[cat] || [];
    if (presets.length > 0) {
      setNewType(presets[0].type);
      setNewWidth(String(presets[0].width));
      setNewHeight(String(presets[0].height));
    }
  };

  const handleTypeChange = (typ) => {
    setNewType(typ);
    const defaults = getFurnitureDefaults(typ);
    setNewWidth(String(defaults.width));
    setNewHeight(String(defaults.height));
  };

  const handleCreateFurniture = (e) => {
    e.preventDefault();
    const generatedId = generateNextFurnitureId(newType, furniture);
    const hostRoomObj = availableRooms.find(r => r.name === newRoom);

    // Initial center point inside host room if coordinates not specified
    let initX = 3000, initY = 3000;
    if (hostRoomObj && Array.isArray(hostRoomObj.points) && hostRoomObj.points.length >= 3) {
      const xs = hostRoomObj.points.map(p => p[0]);
      const ys = hostRoomObj.points.map(p => p[1]);
      initX = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
      initY = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    }

    const payload = {
      id: generatedId,
      type: newType,
      category: newCategory,
      host_room_id: newRoom || availableRooms[0]?.name || 'Living Room',
      width: Number(newWidth) || 1000,
      height: Number(newHeight) || 600,
      x: initX,
      y: initY,
      rotation: Number(newRotation) || 0
    };

    if (onUpdateFurniture) {
      onUpdateFurniture('AddFurniture', null, payload);
    }

    setIsAdding(false);
  };

  const categories = ['All', ...Object.keys(FURNITURE_CATEGORIES)];

  const filteredFurniture = furniture.filter(f => {
    if (selectedCategory === 'All') return true;
    const cat = f.category || getFurnitureDefaults(f.type).category;
    return cat.toLowerCase() === selectedCategory.toLowerCase();
  });

  const filterOptions = categories.map(cat => ({
    id: cat,
    label: cat,
    count: cat === 'All' ? furniture.length : furniture.filter(f => (f.category || getFurnitureDefaults(f.type).category) === cat).length
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScheduleHeader
        title="Furniture & Millwork"
        count={furniture.length}
        countUnit="pieces"
        addLabel="+ Add Furniture"
        isAdding={isAdding}
        onAddClick={() => setIsAdding(prev => !prev)}
        filterOptions={filterOptions}
        activeFilter={selectedCategory}
        onFilterChange={setSelectedCategory}
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
        {/* Inline Add Furniture Card */}
        {isAdding && (
          <form
            onSubmit={handleCreateFurniture}
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
                + Place Furniture Block
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>BIM Millwork Library</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={newCategory}
                  onChange={e => handleCategoryChange(e.target.value)}
                  style={selectStyle}
                >
                  {Object.keys(FURNITURE_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Furniture Type</label>
                <select
                  value={newType}
                  onChange={e => handleTypeChange(e.target.value)}
                  style={selectStyle}
                >
                  {(FURNITURE_CATEGORIES[newCategory] || []).map(it => (
                    <option key={it.type} value={it.type}>{it.type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Host Room</label>
                <select
                  value={newRoom}
                  onChange={e => setNewRoom(e.target.value)}
                  style={selectStyle}
                >
                  {availableRooms.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Initial Rotation</label>
                <select
                  value={newRotation}
                  onChange={e => setNewRotation(e.target.value)}
                  style={selectStyle}
                >
                  <option value="0">0° (North / Horizontal)</option>
                  <option value="90">90° (East / Vertical)</option>
                  <option value="180">180° (South / Inverted)</option>
                  <option value="270">270° (West / Vertical)</option>
                </select>
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
                    min="200"
                    style={inputStyle}
                  />
                  <span style={unitStyle}>mm</span>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Height (Depth)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newHeight}
                    onChange={e => setNewHeight(e.target.value)}
                    step="50"
                    min="200"
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
                + Place Furniture
              </button>
            </div>
          </form>
        )}

        {/* Furniture Cards */}
        {filteredFurniture.length === 0 && !isAdding ? (
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
            <span style={{ fontSize: '24px' }}>🪑</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No furniture items</span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Beds, desks, sofas, and wardrobes appear here with collision clearance checking</span>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              style={{ ...primaryBtnStyle, marginTop: '8px' }}
            >
              + Place First Item
            </button>
          </div>
        ) : (
          filteredFurniture.map((furn, idx) => (
            <FurnitureCard
              key={`furn-${furn.id || idx}`}
              furn={furn}
              rooms={availableRooms}
              isSelected={selectedElement?.type === 'Furniture' && selectedElement.item?.id === furn.id}
              onSelect={() => onSelectItem && onSelectItem({ type: 'Furniture', item: furn })}
              onUpdateFurniture={onUpdateFurniture}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FurnitureCard({ furn, rooms, isSelected, onSelect, onUpdateFurniture }) {
  const [type, setType] = useState(furn.type || 'Double Bed');
  const [hostRoom, setHostRoom] = useState(furn.host_room_id || furn.room_name || rooms[0]?.name || 'Living Room');
  const [width, setWidth] = useState(String(Math.round(furn.width || 1000)));
  const [height, setHeight] = useState(String(Math.round(furn.height || 600)));
  const [x, setX] = useState(String(Math.round(furn.x || 0)));
  const [y, setY] = useState(String(Math.round(furn.y || 0)));
  const [rotation, setRotation] = useState(Number(furn.rotation || 0) % 360);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setType(furn.type || 'Double Bed');
    setHostRoom(furn.host_room_id || furn.room_name || rooms[0]?.name || 'Living Room');
    setWidth(String(Math.round(furn.width || 1000)));
    setHeight(String(Math.round(furn.height || 600)));
    setX(String(Math.round(furn.x || 0)));
    setY(String(Math.round(furn.y || 0)));
    setRotation(Number(furn.rotation || 0) % 360);
    setIsSaved(false);
  }, [furn, rooms]);

  const handleUpdate = () => {
    if (onUpdateFurniture) {
      onUpdateFurniture('Furniture', furn.id, {
        type,
        host_room_id: hostRoom,
        width: Math.max(100, Number(width) || 1000),
        height: Math.max(100, Number(height) || 600),
        x: Math.round(Number(x) || 0),
        y: Math.round(Number(y) || 0),
        rotation: Number(rotation) % 360
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleRotate90 = (e) => {
    e.stopPropagation();
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    if (onUpdateFurniture) {
      onUpdateFurniture('Furniture', furn.id, { rotation: nextRot });
    }
  };

  const handleDelete = () => {
    if (onUpdateFurniture) {
      onUpdateFurniture('DeleteFurniture', furn.id, {});
    }
  };

  const badgeInfo = getClearanceBadgeInfo(furn.clearance_status);

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
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#A5B4FC',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}
          >
            {furn.id}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
            {type}
          </span>
        </div>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '4px',
            backgroundColor: badgeInfo.bg,
            color: badgeInfo.color,
            border: `1px solid ${badgeInfo.border}`
          }}
          title={badgeInfo.tooltip}
        >
          {badgeInfo.text}
        </span>
      </div>

      {/* Host Room & Rotation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
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
          <label style={labelStyle}>Rotation</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC', width: '36px', textAlign: 'center' }}>
              {rotation}°
            </span>
            <button
              type="button"
              onClick={handleRotate90}
              style={{
                ...secondaryBtnStyle,
                flex: 1,
                minHeight: '34px',
                color: '#38BDF8',
                borderColor: '#38BDF8',
                fontWeight: 600
              }}
              title="Rotate +90 degrees clockwise"
            >
              ⟳ 90°
            </button>
          </div>
        </div>
      </div>

      {/* Dimensions & Coordinates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
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
          </div>
        </div>

        <div>
          <label style={labelStyle}>Depth</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>X</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={x}
              onChange={e => setX(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Y</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={y}
              onChange={e => setY(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              step="50"
              style={inputStyle}
            />
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
          {isSaved ? '✓ Furniture updated' : `${width} × ${height} mm`}
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
              title="Update furniture position and dimensions"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${furn.id}`}
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
  padding: '6px 8px',
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
