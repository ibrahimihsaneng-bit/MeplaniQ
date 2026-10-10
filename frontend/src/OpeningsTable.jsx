import React, { useState } from 'react';

export default function OpeningsTable({
  rooms = [],
  doors = [],
  windows = [],
  onUpdateOpening,
  onAddOpening
}) {
  const allOpenings = [
    ...doors.map(d => ({ ...d, kind: 'Door' })),
    ...windows.map(w => ({ ...w, kind: 'Window' }))
  ];

  // Defensive fallback if rooms are not yet loaded
  const availableRooms = rooms.length > 0 ? rooms : [{ name: 'Living Room' }];

  // State for the dedicated + Add Door / + Add Window row
  const [newType, setNewType] = useState('Door');
  const [newHostRoom, setNewHostRoom] = useState(availableRooms[0]?.name || 'Living Room');
  const [newWallSide, setNewWallSide] = useState('Bottom');
  const [newOffset, setNewOffset] = useState('1000');
  const [newWidth, setNewWidth] = useState('900');
  const [newHeight, setNewHeight] = useState('2100');
  const [newSwing, setNewSwing] = useState('Inward-Right');

  const doorWidths = [750, 800, 900, 1000, 1200];
  const windowWidths = [600, 900, 1200, 1500, 1800];
  const wallSides = ['Bottom', 'Right', 'Top', 'Left'];
  const swings = ['Inward-Right', 'Inward-Left', 'Outward-Right', 'Outward-Left'];

  const getNextId = (prefix, list) => {
    let num = 1;
    while (list.some(item => String(item.id).toUpperCase() === `${prefix}${num}`)) {
      num++;
    }
    return `${prefix}${num}`;
  };

  const handleTypeChange = (selectedType) => {
    setNewType(selectedType);
    if (selectedType === 'Door') {
      setNewWidth('900');
      setNewHeight('2100');
      setNewSwing('Inward-Right');
    } else {
      setNewWidth('1200');
      setNewHeight('1200');
      setNewSwing('');
    }
  };

  const handleAdd = (explicitType = null) => {
    const typeToAdd = explicitType || newType;
    const isDoor = typeToAdd === 'Door';

    const safeHostRoom = newHostRoom || availableRooms[0]?.name || 'Living Room';
    const safeOffset = Math.max(50, Number(newOffset) || 1000);
    const safeWidth = Math.max(300, Number(newWidth) || (isDoor ? 900 : 1200));
    const safeHeight = Math.max(300, Number(newHeight) || (isDoor ? 2100 : 1200));
    const safeSwing = isDoor ? (newSwing || 'Inward-Right') : 'Inward-Right';
    const safeId = isDoor ? getNextId('D', doors) : getNextId('W', windows);

    const newOpeningPayload = {
      id: safeId,
      type: typeToAdd,
      kind: typeToAdd,
      host_room: safeHostRoom,
      wall_side: newWallSide || 'Bottom',
      offset_mm: safeOffset,
      width_mm: safeWidth,
      height_mm: safeHeight,
      swing: safeSwing
    };

    if (onAddOpening) {
      onAddOpening(newOpeningPayload);
    } else if (onUpdateOpening) {
      onUpdateOpening('AddOpening', null, newOpeningPayload);
    }

    // Reset temporary row back to clean defaults
    setNewOffset('1000');
    if (isDoor) {
      setNewWidth('900');
      setNewHeight('2100');
    } else {
      setNewWidth('1200');
      setNewHeight('1200');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const inputStyle = {
    backgroundColor: '#0B0F19',
    border: '1px solid #334155',
    color: '#38BDF8',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    width: '100px',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '600'
  };

  const btnStyle = {
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
  };

  return (
    <div className="table-container">
      <div className="table-header-row">
        <div>
          <h3 className="table-title" style={{ margin: 0 }}>Architectural Openings Schedule (Doors & Windows)</h3>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            Modify existing openings or add new units using the input row below. Syncs automatically with CAD geometry cutouts.
          </span>
        </div>
        <span className="table-count-badge">
          {doors.length} Door(s) &bull; {windows.length} Window(s)
        </span>
      </div>
      <table className="cad-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Host Room</th>
            <th>Wall Side</th>
            <th>Offset from Corner (mm)</th>
            <th>Width (mm)</th>
            <th>Height (mm)</th>
            <th>Swing Direction</th>
            <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allOpenings.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: 'center', color: '#94A3B8', padding: '16px 0', fontSize: '12px' }}>
                No openings defined yet. Use the green/blue row below to add doors or windows.
              </td>
            </tr>
          ) : (
            allOpenings.map((op, idx) => {
              const isDoor = op.kind === 'Door';
              return (
                <tr key={`op-${op.id}-${idx}`}>
                  <td className="room-name-cell">
                    <span
                      className="room-color-badge"
                      style={{ backgroundColor: isDoor ? '#EAB308' : '#38BDF8' }}
                    />
                    {op.id}
                  </td>
                  <td>
                    <span className={`kind-tag ${isDoor ? 'door-tag' : 'window-tag'}`}>
                      {op.kind}
                    </span>
                  </td>
                  <td>
                    {onUpdateOpening ? (
                      <select 
                        value={op.host_room || ''}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { host_room: e.target.value })}
                        style={inputStyle}
                      >
                        {availableRooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                      </select>
                    ) : op.host_room}
                  </td>
                  <td>
                    {onUpdateOpening ? (
                      <select 
                        value={op.wall_side || 'Bottom'}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { wall_side: e.target.value })}
                        style={inputStyle}
                      >
                        {wallSides.map(side => <option key={side} value={side}>{side}</option>)}
                      </select>
                    ) : op.wall_side}
                  </td>
                  <td className="metric-cell">
                    {onUpdateOpening ? (
                      <input
                        type="number"
                        step="50"
                        min="50"
                        value={op.offset_mm ?? 1000}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { offset_mm: parseFloat(e.target.value) || 0 })}
                        style={inputStyle}
                      />
                    ) : (
                      `${op.offset_mm ?? 1000} mm`
                    )}
                  </td>
                  <td className="metric-cell">
                    {onUpdateOpening ? (
                      <select 
                        value={op.width_mm ?? (isDoor ? 900 : 1200)}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { width_mm: parseFloat(e.target.value) || 0 })}
                        style={inputStyle}
                      >
                        {(isDoor ? doorWidths : windowWidths).map(w => (
                          <option key={w} value={w}>{w} mm</option>
                        ))}
                      </select>
                    ) : (
                      `${op.width_mm} mm`
                    )}
                  </td>
                  <td className="metric-cell">
                    {onUpdateOpening ? (
                      <input
                        type="number"
                        step="50"
                        min="100"
                        value={op.height_mm ?? (isDoor ? 2100 : 1200)}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { height_mm: parseFloat(e.target.value) || 0 })}
                        style={inputStyle}
                        title="Opening Height in millimeters"
                      />
                    ) : (
                      `${op.height_mm} mm`
                    )}
                  </td>
                  <td>
                    {isDoor && onUpdateOpening ? (
                      <select 
                        value={op.swing || 'Inward-Right'}
                        onChange={(e) => onUpdateOpening(op.kind, op.id, { swing: e.target.value })}
                        style={{ ...inputStyle, width: '130px' }}
                      >
                        {swings.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (op.swing || 'N/A')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {onUpdateOpening && (
                      <button
                        onClick={() => onUpdateOpening('DeleteOpening', op.id, { kind: op.kind })}
                        title={`Remove ${op.kind} ${op.id}`}
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
                        onMouseOver={(e) => { e.target.style.background = '#EF4444'; e.target.style.color = '#FFFFFF'; }}
                        onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#EF4444'; }}
                      >
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}

          {/* Dedicated + Add Door / + Add Window Active Input Row */}
          <tr style={{ backgroundColor: 'rgba(56, 189, 248, 0.05)', borderTop: '2px solid #334155' }}>
            <td className="room-name-cell" style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 'bold' }}>
              {newType === 'Door' ? getNextId('D', doors) : getNextId('W', windows)}
            </td>
            <td>
              <select
                value={newType}
                onChange={(e) => handleTypeChange(e.target.value)}
                style={{ ...inputStyle, width: '85px', borderColor: newType === 'Door' ? '#EAB308' : '#38BDF8' }}
              >
                <option value="Door">Door</option>
                <option value="Window">Window</option>
              </select>
            </td>
            <td>
              <select
                value={newHostRoom}
                onChange={(e) => setNewHostRoom(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
              >
                {availableRooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </td>
            <td>
              <select
                value={newWallSide}
                onChange={(e) => setNewWallSide(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
              >
                {wallSides.map(side => <option key={side} value={side}>{side}</option>)}
              </select>
            </td>
            <td className="metric-cell">
              <input
                type="number"
                step="50"
                min="50"
                value={newOffset}
                onChange={(e) => setNewOffset(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Offset mm"
                style={inputStyle}
              />
            </td>
            <td className="metric-cell">
              <select
                value={newWidth}
                onChange={(e) => setNewWidth(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
              >
                {(newType === 'Door' ? doorWidths : windowWidths).map(w => (
                  <option key={w} value={w}>{w} mm</option>
                ))}
              </select>
            </td>
            <td className="metric-cell">
              <input
                type="number"
                step="50"
                value={newHeight}
                onChange={(e) => setNewHeight(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, width: '70px' }}
              />
            </td>
            <td>
              {newType === 'Door' ? (
                <select
                  value={newSwing}
                  onChange={(e) => setNewSwing(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ ...inputStyle, width: '130px' }}
                >
                  {swings.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span style={{ color: '#64748B', fontSize: '11px', paddingLeft: '8px' }}>&mdash;</span>
              )}
            </td>
            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                <button
                  onClick={() => handleAdd('Door')}
                  style={{ ...btnStyle, background: '#EAB308', color: '#0F172A' }}
                  onMouseOver={(e) => e.target.style.background = '#FACC15'}
                  onMouseOut={(e) => e.target.style.background = '#EAB308'}
                  title="Add a Door with current settings (or press Enter)"
                >
                  + Add Door
                </button>
                <button
                  onClick={() => handleAdd('Window')}
                  style={{ ...btnStyle, background: '#38BDF8', color: '#0F172A' }}
                  onMouseOver={(e) => e.target.style.background = '#7DD3FC'}
                  onMouseOut={(e) => e.target.style.background = '#38BDF8'}
                  title="Add a Window with current settings (or press Enter)"
                >
                  + Add Window
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
