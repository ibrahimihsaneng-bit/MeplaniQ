import React, { useState, useEffect } from 'react';

export default function RoomTable({ rooms = [], onUpdateRoom, onAddRoom }) {
  const [newRoomName, setNewRoomName] = useState("New Room");
  const [newRoomX, setNewRoomX] = useState("0");
  const [newRoomY, setNewRoomY] = useState("0");
  const [newRoomW, setNewRoomW] = useState("3000");
  const [newRoomH, setNewRoomH] = useState("3000");

  const handleAddNewRoom = () => {
    const name = newRoomName.trim() || `Room ${(rooms?.length || 0) + 1}`;
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

    if (onAddRoom) {
      onAddRoom({ name, points: pts });
    } else if (onUpdateRoom) {
      onUpdateRoom("AddRoom", null, { name, points: pts });
    }

    // Reset temporary input row back to default values cleanly
    setNewRoomName(`Room ${(rooms?.length || 0) + 2}`);
    setNewRoomX("0");
    setNewRoomY("0");
    setNewRoomW("3000");
    setNewRoomH("3000");
  };

  const handleNewRoomKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddNewRoom();
    }
  };

  return (
    <div className="table-container">
      <h3 className="table-title">Room Spatial Data Summary</h3>
      <table className="cad-table">
        <thead>
          <tr>
            <th>Room Name</th>
            <th>X (mm)</th>
            <th>Y (mm)</th>
            <th>Width (mm)</th>
            <th>Height (mm)</th>
            <th>Carpet Area (sq.m)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(!rooms || rooms.length === 0) && (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', color: '#94A3B8', padding: '16px 0', fontSize: '12px' }}>
                No rooms defined yet. Use the light-blue row below to add your first room.
              </td>
            </tr>
          )}
          {rooms && rooms.map((room, index) => (
            <RoomRow key={`${room.name}-${index}`} room={room} index={index} onUpdateRoom={onUpdateRoom} />
          ))}

          {/* Add Room Row */}
          <tr style={{ backgroundColor: "rgba(56, 189, 248, 0.05)" }}>
            <td className="room-name-cell">
              <input 
                type="text" 
                value={newRoomName} 
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={handleNewRoomKeyDown}
                placeholder="Room Name"
                style={{ width: "110px", background: "#1E293B", border: "1px dashed #475569", color: "white", padding: "6px 8px", borderRadius: "4px", fontSize: "12px" }} 
              />
            </td>
            <td>
              <input 
                type="number" 
                value={newRoomX} 
                onChange={e => setNewRoomX(e.target.value)} 
                onKeyDown={handleNewRoomKeyDown}
                style={inputStyle} 
              />
            </td>
            <td>
              <input 
                type="number" 
                value={newRoomY} 
                onChange={e => setNewRoomY(e.target.value)} 
                onKeyDown={handleNewRoomKeyDown}
                style={inputStyle} 
              />
            </td>
            <td>
              <input 
                type="number" 
                value={newRoomW} 
                onChange={e => setNewRoomW(e.target.value)} 
                onKeyDown={handleNewRoomKeyDown}
                style={inputStyle} 
              />
            </td>
            <td>
              <input 
                type="number" 
                value={newRoomH} 
                onChange={e => setNewRoomH(e.target.value)} 
                onKeyDown={handleNewRoomKeyDown}
                style={inputStyle} 
              />
            </td>
            <td className="metric-cell" style={{ color: '#94A3B8' }}>--</td>
            <td>
              <button 
                onClick={handleAddNewRoom} 
                style={{ ...btnStyle, background: "#10B981" }} 
                onMouseOver={(e)=>e.target.style.background="#34D399"} 
                onMouseOut={(e)=>e.target.style.background="#10B981"}
                title="Add this room to the floorplan and recalculate geometry"
              >
                + Add Room
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { 
  width: "75px", 
  background: "#1E293B", 
  border: "1px solid #475569", 
  color: "white", 
  padding: "6px 8px", 
  borderRadius: "4px",
  fontSize: "12px"
};

const btnStyle = {
  background: "#38BDF8",
  color: "#0F172A",
  border: "none",
  padding: "6px 12px",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
  transition: "background 0.2s"
};

function RoomRow({ room, index, onUpdateRoom }) {
  const xs = (room.points || []).map(p => p[0]);
  const ys = (room.points || []).map(p => p[1]);
  const initialX = xs.length ? Math.min(...xs) : 0;
  const initialY = ys.length ? Math.min(...ys) : 0;
  const initialW = xs.length ? Math.max(...xs) - initialX : 3000;
  const initialH = ys.length ? Math.max(...ys) - initialY : 3000;

  const [editName, setEditName] = useState(room.name || '');
  const [editX, setEditX] = useState(String(initialX));
  const [editY, setEditY] = useState(String(initialY));
  const [editW, setEditW] = useState(String(initialW));
  const [editH, setEditH] = useState(String(initialH));

  useEffect(() => {
    setEditName(room.name || '');
    setEditX(String(initialX));
    setEditY(String(initialY));
    setEditW(String(initialW));
    setEditH(String(initialH));
  }, [room.name, initialX, initialY, initialW, initialH]);

  const handleUpdate = () => {
    if (onUpdateRoom) {
      const name = editName.trim() || room.name;
      const x = Number(editX) || 0;
      const y = Number(editY) || 0;
      const w = Number(editW) > 0 ? Number(editW) : initialW;
      const h = Number(editH) > 0 ? Number(editH) : initialH;

      const newPoints = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ];
      onUpdateRoom("Room", room.name, { name: name, points: newPoints });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleUpdate();
  };

  return (
    <tr>
      <td className="room-name-cell">
        <span className="room-color-badge" style={{ backgroundColor: getRoomBadgeColor(index) }}></span>
        <input 
          type="text" 
          value={editName} 
          onChange={e => setEditName(e.target.value)} 
          onKeyDown={handleKeyDown} 
          style={{ width: "110px", background: "transparent", border: "1px solid transparent", color: "white", padding: "4px 4px", fontSize: "14px", fontWeight: "600", outline: "none", borderBottom: "1px solid #334155" }}
          onFocus={e => e.target.style.border = "1px solid #38BDF8"}
          onBlur={e => e.target.style.border = "1px solid transparent"}
        />
      </td>
      <td>
        <input type="number" value={editX} onChange={e => setEditX(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
      </td>
      <td>
        <input type="number" value={editY} onChange={e => setEditY(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
      </td>
      <td>
        <input type="number" value={editW} onChange={e => setEditW(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
      </td>
      <td>
        <input type="number" value={editH} onChange={e => setEditH(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
      </td>
      <td className="metric-cell">
        {room.carpet_area_sqm != null ? `${room.carpet_area_sqm.toFixed(1)} sq.m` : `${(initialW * initialH / 1e6).toFixed(1)} sq.m`}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={handleUpdate} style={btnStyle} onMouseOver={(e)=>e.target.style.background="#7DD3FC"} onMouseOut={(e)=>e.target.style.background="#38BDF8"}>
            Update
          </button>
          <button
            type="button"
            onClick={() => onUpdateRoom && onUpdateRoom("DeleteRoom", room.name, {})}
            title={`Delete ${room.name} and associated openings/HVAC/furniture`}
            style={{
              background: 'transparent',
              border: '1px solid #EF4444',
              color: '#EF4444',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => { e.target.style.background = '#EF4444'; e.target.style.color = '#FFFFFF'; }}
            onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#EF4444'; }}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function getRoomBadgeColor(index) {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  return colors[index % colors.length];
}