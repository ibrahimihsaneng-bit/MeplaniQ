import React, { useState, useEffect } from 'react';
import ScheduleHeader from './ScheduleHeader';
import {
  PLUMBING_CATEGORIES,
  PIPE_TYPES,
  PIPE_TYPE_COLORS,
  getPipeColor
} from '../../../PlumbingTable';

export default function PlumbingSchedule({
  rooms = [],
  plumbingFixtures = [],
  plumbingPipes = [],
  onAddFixture,
  onUpdateFixture,
  onDeleteFixture,
  onAddPipe,
  onUpdatePipe,
  onDeletePipe,
  selectedElement,
  onSelectItem
}) {
  const [subView, setSubView] = useState('fixtures'); // 'fixtures' | 'pipes'
  const [isAdding, setIsAdding] = useState(false);

  const availableRooms = rooms.length > 0 ? rooms : [{ name: 'Bath' }];

  // New Fixture State
  const [newCat, setNewCat] = useState('Bathroom Fixtures');
  const [newType, setNewType] = useState('Wash Basin');
  const [newRoom, setNewRoom] = useState(availableRooms[0]?.name || 'Bath');
  const [newW, setNewW] = useState('600');
  const [newH, setNewH] = useState('500');
  const [newRot, setNewRot] = useState('0');

  // New Pipe State
  const [newPipeType, setNewPipeType] = useState('Water Supply Pipe');
  const [pipeX1, setPipeX1] = useState('2000');
  const [pipeY1, setPipeY1] = useState('2000');
  const [pipeX2, setPipeX2] = useState('4000');
  const [pipeY2, setPipeY2] = useState('2000');
  const [pipeDia, setPipeDia] = useState('25');

  useEffect(() => {
    if (availableRooms.length > 0 && !newRoom) {
      setNewRoom(availableRooms[0].name);
    }
  }, [availableRooms, newRoom]);

  const handleFixtureTypeChange = (typ) => {
    setNewType(typ);
    const catItems = PLUMBING_CATEGORIES[newCat] || [];
    const item = catItems.find(i => i.type === typ);
    if (item) {
      setNewW(String(item.width));
      setNewH(String(item.height));
    }
  };

  const generateFixtureId = (typ) => {
    let pfx = 'PLM';
    const clean = typ.toLowerCase();
    if (clean.includes('basin') || clean.includes('sink')) pfx = 'WB';
    else if (clean.includes('wc') || clean.includes('toilet')) pfx = 'WC';
    else if (clean.includes('shower')) pfx = 'SH';
    else if (clean.includes('bath')) pfx = 'BT';
    else if (clean.includes('fridge') || clean.includes('refrig')) pfx = 'RF';
    else if (clean.includes('wash') || clean.includes('machine')) pfx = 'WM';

    let count = 1;
    let candidate = `${pfx}-${count}`;
    while (plumbingFixtures.some(f => (f?.id || '').toUpperCase() === candidate.toUpperCase())) {
      count++;
      candidate = `${pfx}-${count}`;
    }
    return candidate;
  };

  const generatePipeId = (pt) => {
    let pfx = 'PIP';
    const clean = pt.toLowerCase();
    if (clean.includes('supply') || clean.includes('wtr')) pfx = 'WTR';
    else if (clean.includes('drain') || clean.includes('waste')) pfx = 'DRN';
    else if (clean.includes('trap')) pfx = 'FLT';
    else if (clean.includes('vent')) pfx = 'VNT';

    let count = 1;
    let candidate = `${pfx}-${count}`;
    while (plumbingPipes.some(p => (p?.id || '').toUpperCase() === candidate.toUpperCase())) {
      count++;
      candidate = `${pfx}-${count}`;
    }
    return candidate;
  };

  const handleCreateFixture = (e) => {
    e.preventDefault();
    const generatedId = generateFixtureId(newType);
    const hostRoomObj = availableRooms.find(r => r.name === newRoom);

    let initX = 2500, initY = 2500;
    if (hostRoomObj && Array.isArray(hostRoomObj.points) && hostRoomObj.points.length >= 3) {
      const xs = hostRoomObj.points.map(p => p[0]);
      const ys = hostRoomObj.points.map(p => p[1]);
      initX = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
      initY = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    }

    const payload = {
      id: generatedId,
      type: newType,
      category: newCat,
      host_room: newRoom,
      width: Number(newW) || 600,
      height: Number(newH) || 500,
      x: initX,
      y: initY,
      rotation: Number(newRot) || 0
    };

    if (onAddFixture) {
      onAddFixture(payload);
    }

    setIsAdding(false);
  };

  const handleCreatePipe = (e) => {
    e.preventDefault();
    const generatedId = generatePipeId(newPipeType);

    const payload = {
      id: generatedId,
      pipe_type: newPipeType,
      type: newPipeType,
      x1: Number(pipeX1) || 0,
      y1: Number(pipeY1) || 0,
      x2: Number(pipeX2) || 0,
      y2: Number(pipeY2) || 0,
      diameter_mm: Number(pipeDia) || 25
    };

    if (onAddPipe) {
      onAddPipe(payload);
    }

    setIsAdding(false);
  };

  const filterOptions = [
    { id: 'fixtures', label: 'Fixtures', count: plumbingFixtures.length },
    { id: 'pipes', label: 'Pipes & Drainage', count: plumbingPipes.length }
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScheduleHeader
        title="Plumbing & Sanitary"
        count={plumbingFixtures.length + plumbingPipes.length}
        countUnit="items"
        addLabel={subView === 'fixtures' ? '+ Add Fixture' : '+ Add Pipe'}
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
        {/* Inline Add Fixture Form */}
        {isAdding && subView === 'fixtures' && (
          <form
            onSubmit={handleCreateFixture}
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
                + Place Plumbing Fixture
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Sanitary MEP Block</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={newCat}
                  onChange={e => {
                    setNewCat(e.target.value);
                    const items = PLUMBING_CATEGORIES[e.target.value] || [];
                    if (items.length > 0) {
                      setNewType(items[0].type);
                      setNewW(String(items[0].width));
                      setNewH(String(items[0].height));
                    }
                  }}
                  style={selectStyle}
                >
                  {Object.keys(PLUMBING_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Fixture Type</label>
                <select
                  value={newType}
                  onChange={e => handleFixtureTypeChange(e.target.value)}
                  style={selectStyle}
                >
                  {(PLUMBING_CATEGORIES[newCat] || []).map(i => (
                    <option key={i.type} value={i.type}>{i.type}</option>
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
                <label style={labelStyle}>Rotation</label>
                <select
                  value={newRot}
                  onChange={e => setNewRot(e.target.value)}
                  style={selectStyle}
                >
                  <option value="0">0° (North)</option>
                  <option value="90">90° (East)</option>
                  <option value="180">180° (South)</option>
                  <option value="270">270° (West)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Width</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={newW}
                    onChange={e => setNewW(e.target.value)}
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
                    value={newH}
                    onChange={e => setNewH(e.target.value)}
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
                + Place Fixture
              </button>
            </div>
          </form>
        )}

        {/* Inline Add Pipe Form */}
        {isAdding && subView === 'pipes' && (
          <form
            onSubmit={handleCreatePipe}
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
                + Route Pipe Line
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Water Supply / Drainage</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Pipe System Type</label>
                <select
                  value={newPipeType}
                  onChange={e => setNewPipeType(e.target.value)}
                  style={selectStyle}
                >
                  {PIPE_TYPES.map(pt => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Diameter</label>
                <select
                  value={pipeDia}
                  onChange={e => setPipeDia(e.target.value)}
                  style={selectStyle}
                >
                  {['15', '20', '25', '32', '40', '50', '75', '110'].map(d => (
                    <option key={d} value={d}>Ø {d} mm</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
              <div>
                <label style={labelStyle}>X1</label>
                <input
                  type="number"
                  value={pipeX1}
                  onChange={e => setPipeX1(e.target.value)}
                  step="50"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Y1</label>
                <input
                  type="number"
                  value={pipeY1}
                  onChange={e => setPipeY1(e.target.value)}
                  step="50"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>X2</label>
                <input
                  type="number"
                  value={pipeX2}
                  onChange={e => setPipeX2(e.target.value)}
                  step="50"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Y2</label>
                <input
                  type="number"
                  value={pipeY2}
                  onChange={e => setPipeY2(e.target.value)}
                  step="50"
                  style={inputStyle}
                />
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
                + Connect Pipe
              </button>
            </div>
          </form>
        )}

        {/* View 1: Fixtures */}
        {subView === 'fixtures' && (
          plumbingFixtures.length === 0 && !isAdding ? (
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
              <span style={{ fontSize: '24px' }}>🚿</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No plumbing fixtures</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Place sinks, basins, WCs, and showers to connect water supply and drainage</span>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                style={{ ...primaryBtnStyle, marginTop: '8px' }}
              >
                + Place First Fixture
              </button>
            </div>
          ) : (
            plumbingFixtures.map((fix, idx) => (
              <FixtureCard
                key={`fix-${fix.id || idx}`}
                fix={fix}
                rooms={availableRooms}
                isSelected={selectedElement?.type === 'PlumbingFixture' && selectedElement.item?.id === fix.id}
                onSelect={() => onSelectItem && onSelectItem({ type: 'PlumbingFixture', item: fix })}
                onUpdate={onUpdateFixture}
                onDelete={onDeleteFixture}
              />
            ))
          )
        )}

        {/* View 2: Piping Lines */}
        {subView === 'pipes' && (
          plumbingPipes.length === 0 && !isAdding ? (
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
              <span style={{ fontSize: '24px' }}>🚰</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>No pipe runs routed</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Route water supply and drainage runs between fixtures</span>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                style={{ ...primaryBtnStyle, marginTop: '8px' }}
              >
                + Route First Pipe
              </button>
            </div>
          ) : (
            plumbingPipes.map((pipe, idx) => (
              <PipeCard
                key={`pipe-${pipe.id || idx}`}
                pipe={pipe}
                isSelected={selectedElement?.type === 'Plumbing' && selectedElement.item?.id === pipe.id}
                onSelect={() => onSelectItem && onSelectItem({ type: 'Plumbing', item: pipe })}
                onUpdate={onUpdatePipe}
                onDelete={onDeletePipe}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}

function FixtureCard({ fix, rooms, isSelected, onSelect, onUpdate, onDelete }) {
  const [type, setType] = useState(fix.type || 'Wash Basin');
  const [hostRoom, setHostRoom] = useState(fix.host_room || rooms[0]?.name || 'Bath');
  const [width, setWidth] = useState(String(Math.round(fix.width || 600)));
  const [height, setHeight] = useState(String(Math.round(fix.height || 500)));
  const [x, setX] = useState(String(Math.round(fix.x || 0)));
  const [y, setY] = useState(String(Math.round(fix.y || 0)));
  const [rotation, setRotation] = useState(Number(fix.rotation || 0) % 360);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setType(fix.type || 'Wash Basin');
    setHostRoom(fix.host_room || rooms[0]?.name || 'Bath');
    setWidth(String(Math.round(fix.width || 600)));
    setHeight(String(Math.round(fix.height || 500)));
    setX(String(Math.round(fix.x || 0)));
    setY(String(Math.round(fix.y || 0)));
    setRotation(Number(fix.rotation || 0) % 360);
    setIsSaved(false);
  }, [fix, rooms]);

  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate(fix.id, {
        type,
        host_room: hostRoom,
        width: Math.max(100, Number(width) || 600),
        height: Math.max(100, Number(height) || 500),
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
    if (onUpdate) {
      onUpdate(fix.id, { rotation: nextRot });
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(fix.id);
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
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#38BDF8',
              border: '1px solid rgba(2, 132, 199, 0.3)'
            }}
          >
            {fix.id}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
            {type}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          {hostRoom}
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
              title="Rotate +90 degrees"
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
          <input
            type="number"
            value={width}
            onChange={e => setWidth(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Depth</label>
          <input
            type="number"
            value={height}
            onChange={e => setHeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>X</label>
          <input
            type="number"
            value={x}
            onChange={e => setX(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Y</label>
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
          {isSaved ? '✓ Fixture saved' : `${width} × ${height} mm`}
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
              title="Update plumbing fixture on canvas"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${fix.id}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PipeCard({ pipe, isSelected, onSelect, onUpdate, onDelete }) {
  const [pipeType, setPipeType] = useState(pipe.pipe_type || pipe.type || 'Water Supply Pipe');
  const [x1, setX1] = useState(String(Math.round(pipe.x1 || 0)));
  const [y1, setY1] = useState(String(Math.round(pipe.y1 || 0)));
  const [x2, setX2] = useState(String(Math.round(pipe.x2 || 0)));
  const [y2, setY2] = useState(String(Math.round(pipe.y2 || 0)));
  const [diameter, setDiameter] = useState(String(pipe.diameter_mm || 25));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setPipeType(pipe.pipe_type || pipe.type || 'Water Supply Pipe');
    setX1(String(Math.round(pipe.x1 || 0)));
    setY1(String(Math.round(pipe.y1 || 0)));
    setX2(String(Math.round(pipe.x2 || 0)));
    setY2(String(Math.round(pipe.y2 || 0)));
    setDiameter(String(pipe.diameter_mm || 25));
    setIsSaved(false);
  }, [pipe]);

  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate(pipe.id, {
        pipe_type: pipeType,
        type: pipeType,
        x1: Math.round(Number(x1) || 0),
        y1: Math.round(Number(y1) || 0),
        x2: Math.round(Number(x2) || 0),
        y2: Math.round(Number(y2) || 0),
        diameter_mm: Number(diameter) || 25
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(pipe.id);
    }
  };

  const pipeColor = getPipeColor(pipeType);

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
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: pipeColor
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
            {pipe.id}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            {pipeType}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: pipeColor, fontWeight: 700 }}>
          Ø {diameter} mm
        </span>
      </div>

      {/* Type & Diameter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Pipe Type</label>
          <select
            value={pipeType}
            onChange={e => setPipeType(e.target.value)}
            style={selectStyle}
          >
            {PIPE_TYPES.map(pt => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Diameter</label>
          <select
            value={diameter}
            onChange={e => setDiameter(e.target.value)}
            style={selectStyle}
          >
            {['15', '20', '25', '32', '40', '50', '75', '110'].map(d => (
              <option key={d} value={d}>Ø {d} mm</option>
            ))}
          </select>
        </div>
      </div>

      {/* Start / End Points */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
        <div>
          <label style={labelStyle}>X1</label>
          <input
            type="number"
            value={x1}
            onChange={e => setX1(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Y1</label>
          <input
            type="number"
            value={y1}
            onChange={e => setY1(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>X2</label>
          <input
            type="number"
            value={x2}
            onChange={e => setX2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Y2</label>
          <input
            type="number"
            value={y2}
            onChange={e => setY2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
            step="50"
            style={inputStyle}
          />
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
          {isSaved ? '✓ Pipe run updated' : `Length: ${Math.round(Math.hypot(Number(x2) - Number(x1), Number(y2) - Number(y1)))} mm`}
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
              title="Update pipe run on canvas"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
              title={`Delete ${pipe.id}`}
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
