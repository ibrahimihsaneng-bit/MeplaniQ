import React, { useState, useEffect } from 'react';

export const PLUMBING_CATEGORIES = {
  "Bathroom Fixtures": [
    { type: "Wash Basin", width: 600, height: 500 },
    { type: "WC", width: 400, height: 700 },
    { type: "Shower", width: 900, height: 900 },
    { type: "Bathtub", width: 1700, height: 800 },
    { type: "Bidet", width: 400, height: 600 }
  ],
  "Kitchen & Utility": [
    { type: "Kitchen Sink", width: 800, height: 600 },
    { type: "Refrigerator", width: 900, height: 750 },
    { type: "Washing Machine", width: 600, height: 600 },
    { type: "Dishwasher", width: 600, height: 600 }
  ]
};

export const PIPE_TYPES = ["Water Supply Pipe", "Drainage Pipe", "Floor Trap", "Vent Pipe"];

/** Engineering color palette — must mirror getPipeColor() in Canvas.jsx exactly */
export const PIPE_TYPE_COLORS = {
  "Water Supply Pipe": "#00BFFF",
  "Drainage Pipe":     "#2ECC71",
  "Floor Trap":        "#FFA500",
  "Vent Pipe":         "#9B59B6",
};

export function getPipeColor(typeOrId) {
  const t = (typeOrId || '').toLowerCase().trim();
  if (t.includes('hot') || t.includes('hw') || t.includes('geyser') || t.includes('heater')) return '#EF4444';
  if (t.includes('supply') || t.includes('wtr') || t.includes('cold') || t.includes('cw')) return '#00BFFF';
  if (t.includes('drain') || t.includes('waste') || t.includes('drn') || t.includes('soil')) return '#2ECC71';
  if (t.includes('floor trap') || t.includes('trap') || t.includes('flt')) return '#FFA500';
  if (t.includes('vent') || t.includes('vnt')) return '#9B59B6';
  return '#00BFFF';
}


function generateId(prefix, existingItems = []) {
  let count = 1;
  let candidate = `${prefix}-${count}`;
  while ((existingItems || []).some(f => (f?.id || '').toUpperCase() === candidate.toUpperCase())) {
    count++;
    candidate = `${prefix}-${count}`;
  }
  return candidate;
}

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
  width: '64px',
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: '600'
};

function FixtureRow({ fix, rooms, plumbingPipes, onUpdateFixture, onDeleteFixture }) {
  const [draft, setDraft] = useState(fix);

  // Sync draft if external prop changes
  useEffect(() => {
    setDraft(fix);
  }, [fix]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(fix);

  const handleChange = (updates) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleUpdate = () => {
    onUpdateFixture(draft.id, draft);
  };

  return (
    <tr>
      <td style={{ fontWeight: 'bold', color: '#7DD3FC' }}>{draft.id}</td>
      <td>
        <span style={{ color: '#E0F2FE' }}>{draft.type}</span><br />
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{draft.category}</span>
      </td>
      <td>
        <select 
          value={draft.host_room_id || ''} 
          onChange={(e) => handleChange({ host_room_id: e.target.value })}
          style={inputStyle}
        >
          {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>W:</span>
          <input type="number" value={Math.round(draft.width || 600)} onChange={(e) => handleChange({ width: Number(e.target.value) })} style={coordInputStyle} />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>H:</span>
          <input type="number" value={Math.round(draft.height || 500)} onChange={(e) => handleChange({ height: Number(e.target.value) })} style={coordInputStyle} />
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>X:</span>
          <input type="number" value={Math.round(draft.x || 0)} onChange={(e) => handleChange({ x: Number(e.target.value) })} style={coordInputStyle} />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>Y:</span>
          <input type="number" value={Math.round(draft.y || 0)} onChange={(e) => handleChange({ y: Number(e.target.value) })} style={coordInputStyle} />
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input 
            type="number" 
            min="0" 
            max="360" 
            step="15" 
            value={draft.rotation ?? 0} 
            onChange={(e) => handleChange({ rotation: Number(e.target.value) })} 
            style={{ ...coordInputStyle, width: '46px' }} 
            title="Rotation angle in degrees"
          />
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>°</span>
          <button
            type="button"
            title="Rotate +90°"
            onClick={() => handleChange({ rotation: ((Number(draft.rotation) || 0) + 90) % 360 })}
            style={{
              background: '#1E293B',
              border: '1px solid #38BDF8',
              color: '#38BDF8',
              borderRadius: '3px',
              padding: '2px 5px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              lineHeight: 1
            }}
          >
            ⟳ 90°
          </button>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <select
            value={draft?.supplyPipeId || ''}
            onChange={(e) => handleChange({ supplyPipeId: e.target.value })}
            style={{ ...inputStyle, borderLeft: '3px solid #00BFFF' }}
            title="Water Supply"
          >
            <option value="">-- No Supply --</option>
            {(plumbingPipes || []).filter(p => p?.type === 'Water Supply Pipe' || (p?.id || '').startsWith('WTR')).map(p => (
              <option key={p.id} value={p.id}>{p.id} (Supply)</option>
            ))}
          </select>
          <select
            value={draft?.drainagePipeId || ''}
            onChange={(e) => handleChange({ drainagePipeId: e.target.value })}
            style={{ ...inputStyle, borderLeft: '3px solid #2ECC71' }}
            title="Drainage / Waste"
          >
            <option value="">-- No Drainage --</option>
            {(plumbingPipes || []).filter(p => p?.type === 'Drainage Pipe' || (p?.id || '').startsWith('DRN')).map(p => (
              <option key={p.id} value={p.id}>{p.id} (Drain)</option>
            ))}
          </select>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" onClick={handleUpdate} disabled={!hasChanges}
            style={{ background: hasChanges ? '#0284C7' : '#334155', color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: hasChanges ? 'pointer' : 'default', fontSize: '11px', fontWeight: 'bold' }}>
            Update
          </button>
          <button type="button" onClick={() => onDeleteFixture(fix.id)}
            style={{ background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function PipeRow({ pipe, rooms, plumbingPipes, onUpdatePipe, onDeletePipe }) {
  const [draft, setDraft] = useState(pipe);

  useEffect(() => {
    setDraft(pipe);
  }, [pipe]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(pipe);

  const handleChange = (updates) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleUpdate = () => {
    onUpdatePipe(draft.id, draft);
  };

  const startX = draft.path?.[0]?.[0] || 0;
  const startY = draft.path?.[0]?.[1] || 0;
  const endX = draft.path?.[1]?.[0] || startX;
  const endY = draft.path?.[1]?.[1] || startY;

  return (
    <tr>
      <td style={{ fontWeight: 'bold', color: PIPE_TYPE_COLORS[draft.type] || '#7DD3FC', borderLeft: `3px solid ${PIPE_TYPE_COLORS[draft.type] || '#334155'}`, paddingLeft: '8px' }}>{draft.id}</td>

      <td>
        {/* Color-coded type badge — mirrors canvas getPipeColor() */}
        <div style={{ marginBottom: '3px' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: PIPE_TYPE_COLORS[draft.type] || '#94A3B8',
            color: '#0F172A',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '99px',
            letterSpacing: '0.03em'
          }}>
            {draft.type || '—'}
          </span>
        </div>
        <select value={draft.type || ''} onChange={(e) => handleChange({ type: e.target.value })} style={inputStyle}>
          {PIPE_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
        </select>
      </td>
      <td>
        <select value={draft.host_room_id || ''} onChange={(e) => handleChange({ host_room_id: e.target.value })} style={inputStyle}>
          {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
      </td>
      <td>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Ø:</span>
          <input type="number" value={draft.diameter || 110} onChange={(e) => handleChange({ diameter: Number(e.target.value) })} style={coordInputStyle} />
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>X:</span>
          <input type="number" value={Math.round(startX)} onChange={(e) => handleChange({ path: [[Number(e.target.value), startY], [endX, endY]] })} style={coordInputStyle} />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>Y:</span>
          <input type="number" value={Math.round(startY)} onChange={(e) => handleChange({ path: [[startX, Number(e.target.value)], [endX, endY]] })} style={coordInputStyle} />
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>X:</span>
          <input type="number" value={Math.round(endX)} onChange={(e) => handleChange({ path: [[startX, startY], [Number(e.target.value), endY]] })} style={coordInputStyle} />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>Y:</span>
          <input type="number" value={Math.round(endY)} onChange={(e) => handleChange({ path: [[startX, startY], [endX, Number(e.target.value)]] })} style={coordInputStyle} />
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select
            value={draft.connected_to || ''}
            onChange={(e) => handleChange({ connected_to: e.target.value })}
            style={inputStyle}
          >
            <option value="">-- City Sewer / Main --</option>
            {plumbingPipes.filter(p => p.id !== draft.id).map(p => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </select>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" onClick={handleUpdate} disabled={!hasChanges}
            style={{ background: hasChanges ? '#0284C7' : '#334155', color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: hasChanges ? 'pointer' : 'default', fontSize: '11px', fontWeight: 'bold' }}>
            Update
          </button>
          <button type="button" onClick={() => onDeletePipe(draft.id)}
            style={{ background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}


export default function PlumbingTable({ 
  rooms = [], 
  plumbingFixtures = [], 
  plumbingPipes = [], 
  onAddFixture, 
  onUpdateFixture, 
  onDeleteFixture,
  onAddPipe,
  onUpdatePipe,
  onDeletePipe
}) {
  const [showAddFixtureModal, setShowAddFixtureModal] = useState(false);
  const [showAddPipeModal, setShowAddPipeModal] = useState(false);

  const [newFixture, setNewFixture] = useState({ category: 'Bathroom Fixtures', type: 'Wash Basin', host_room_id: rooms[0]?.name || '', rotation: 0 });
  const [newPipe, setNewPipe] = useState({ type: 'Drainage Pipe', host_room_id: rooms[0]?.name || '', diameter: 110 });

  const handleAddFixtureSubmit = (e) => {
    e.preventDefault();
    const defaults = PLUMBING_CATEGORIES[newFixture?.category]?.find(item => item?.type === newFixture?.type);
    const prefix = newFixture?.type?.substring(0, 3).toUpperCase() || "FIX";
    
    // Intelligent defaults based on Host Room Geometry
    const hostRoomName = newFixture?.host_room_id || (rooms?.[0]?.name || "Room 1");
    const hostRoom = (rooms || []).find(r => (r?.name || '').toLowerCase().trim() === (hostRoomName || '').toLowerCase().trim()) || rooms?.[0];
    
    let defaultX = 0;
    let defaultY = 0;
    
    if (hostRoom?.points && Array.isArray(hostRoom.points) && hostRoom.points.length > 0) {
      const xs = hostRoom.points.map(p => p[0]);
      const ys = hostRoom.points.map(p => p[1]);
      const roomMinX = Math.min(...xs);
      const roomMinY = Math.min(...ys);
      defaultX = roomMinX + (defaults?.width ? defaults.width / 2 : 300) + 50;
      defaultY = roomMinY + (defaults?.height ? defaults.height / 2 : 250) + 50;
    }

    onAddFixture({
      id: generateId(prefix, plumbingFixtures || []),
      type: newFixture?.type || 'Fixture',
      category: newFixture?.category || 'General',
      host_room_id: hostRoomName,
      width: defaults?.width ?? 600,
      height: defaults?.height ?? 500,
      x: defaultX, 
      y: defaultY,
      rotation: Number(newFixture.rotation) || 0,
      connected_to: ''
    });
    setShowAddFixtureModal(false);
  };

  const handleAddPipeSubmit = (e) => {
    e.preventDefault();
    const t = (newPipe.type || '').toLowerCase();
    const prefix = t.includes('supply') ? 'WTR'
      : t.includes('drain') || t.includes('waste') ? 'DRN'
      : t.includes('trap') ? 'FLT'
      : t.includes('vent') ? 'VNT'
      : 'PIPE';
    onAddPipe({
      id: generateId(prefix, plumbingPipes),
      type: newPipe.type,
      host_room_id: newPipe.host_room_id || (rooms[0]?.name || "Room 1"),
      diameter: Number(newPipe.diameter),
      path: [[0, 0], [1000, 0]],
      connected_to: ''
    });
    setShowAddPipeModal(false);
  };

  return (
    <div className="table-responsive schedule-table-container">
      {/* PLUMBING FIXTURES HEADER */}
      <div style={{ padding: '8px 12px', backgroundColor: '#0B0F19', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
            PLUMBING FIXTURES SCHEDULE ({plumbingFixtures.length} item{plumbingFixtures.length === 1 ? '' : 's'})
          </span>
          <button
            type="button"
            onClick={() => setShowAddFixtureModal(true)}
            style={{
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>+</span>
            <span>Add Fixture</span>
          </button>
        </div>
      </div>

      {/* PLUMBING FIXTURES TABLE */}
      <table className="cad-table">
        <thead>
          <tr>
            <th>FIXTURE ID</th>
            <th>TYPE / CATEGORY</th>
            <th>HOST ROOM</th>
            <th>DIMENSIONS (W × H)</th>
            <th>COORDINATES (X, Y)</th>
            <th>ROTATION (°)</th>
            <th>CONNECTIONS (SUPPLY & DRAIN)</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {plumbingFixtures.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 600 }}>No plumbing fixtures added yet</span>
              </td>
            </tr>
          ) : (
            plumbingFixtures.map((fix) => (
              <FixtureRow 
                key={fix.id} 
                fix={fix} 
                rooms={rooms} 
                plumbingPipes={plumbingPipes}
                onUpdateFixture={onUpdateFixture} 
                onDeleteFixture={onDeleteFixture} 
              />
            ))
          )}
        </tbody>
      </table>

      {/* PLUMBING PIPES HEADER */}
      <div style={{ padding: '8px 12px', backgroundColor: '#0B0F19', borderBottom: '1px solid #1E293B', borderTop: '2px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
            WATER &amp; DRAINAGE LINES ({plumbingPipes.length} item{plumbingPipes.length === 1 ? '' : 's'})
          </span>
          <button
            type="button"
            onClick={() => setShowAddPipeModal(true)}
            style={{
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>+</span>
            <span>Add Pipe</span>
          </button>
        </div>
      </div>

      {/* PLUMBING PIPES TABLE */}
      <table className="cad-table">
        <thead>
          <tr>
            <th>PIPE ID</th>
            <th>TYPE</th>
            <th>HOST ROOM</th>
            <th>DIAMETER (mm)</th>
            <th>START (X,Y)</th>
            <th>END (X,Y)</th>
            <th>CONNECTED TO</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {plumbingPipes.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 600 }}>No plumbing pipes added yet</span>
              </td>
            </tr>
          ) : (
            plumbingPipes.map(pipe => (
              <PipeRow 
                key={pipe.id} 
                pipe={pipe} 
                rooms={rooms} 
                plumbingPipes={plumbingPipes}
                onUpdatePipe={onUpdatePipe} 
                onDeletePipe={onDeletePipe} 
              />
            ))
          )}
        </tbody>
      </table>

      {/* Add Fixture Modal */}
      {showAddFixtureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.78)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', color: '#F8FAFC' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#FFFFFF' }}>Add Plumbing Fixture</h3>
            <form onSubmit={handleAddFixtureSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Host Room</label>
                <select value={newFixture.host_room_id} onChange={(e) => setNewFixture({ ...newFixture, host_room_id: e.target.value })} style={inputStyle}>
                  {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Category</label>
                <select value={newFixture.category} onChange={(e) => setNewFixture({ ...newFixture, category: e.target.value, type: PLUMBING_CATEGORIES[e.target.value][0].type })} style={inputStyle}>
                  {Object.keys(PLUMBING_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Type</label>
                <select value={newFixture.type} onChange={(e) => setNewFixture({ ...newFixture, type: e.target.value })} style={inputStyle}>
                  {PLUMBING_CATEGORIES[newFixture.category]?.map(item => <option key={item.type} value={item.type}>{item.type}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Rotation Angle (°)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="360"
                    step="15"
                    value={newFixture.rotation ?? 0}
                    onChange={(e) => setNewFixture({ ...newFixture, rotation: Number(e.target.value) })}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 90, 180, 270].map(deg => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setNewFixture({ ...newFixture, rotation: deg })}
                        style={{
                          background: (newFixture.rotation ?? 0) === deg ? '#0284C7' : '#334155',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddFixtureModal(false)} style={{ flex: 1, padding: '8px', backgroundColor: '#334155', color: '#E2E8F0', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '8px', backgroundColor: '#0284C7', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Add Fixture</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Pipe Modal */}
      {showAddPipeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.78)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', color: '#F8FAFC' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#FFFFFF' }}>Add Plumbing Pipe</h3>
            <form onSubmit={handleAddPipeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Host Room</label>
                <select value={newPipe.host_room_id} onChange={(e) => setNewPipe({ ...newPipe, host_room_id: e.target.value })} style={inputStyle}>
                  {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Type</label>
                <select value={newPipe.type} onChange={(e) => setNewPipe({ ...newPipe, type: e.target.value })} style={inputStyle}>
                  {PIPE_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Diameter (mm)</label>
                <input type="number" value={newPipe.diameter} onChange={(e) => setNewPipe({ ...newPipe, diameter: Number(e.target.value) })} required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddPipeModal(false)} style={{ flex: 1, padding: '8px', backgroundColor: '#334155', color: '#E2E8F0', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '8px', backgroundColor: '#0284C7', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Add Pipe</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
