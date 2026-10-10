import React, { useState, useEffect } from 'react';

export const FURNITURE_CATEGORIES = {
  "Bedroom": [
    { type: "Double Bed", width: 1800, height: 2000, label: "Double Bed (1800 × 2000 mm)" },
    { type: "Single Bed", width: 1000, height: 1900, label: "Single Bed (1000 × 1900 mm)" },
    { type: "Wardrobe", width: 1200, height: 600, label: "Wardrobe (1200 × 600 mm)" },
    { type: "Bedside Table", width: 450, height: 400, label: "Bedside Table (450 × 400 mm)" },
    { type: "Dressing Table", width: 1000, height: 450, label: "Dressing Table (1000 × 450 mm)" },
    { type: "Bed", width: 1500, height: 2000, label: "Standard Bed (1500 × 2000 mm)" }
  ],
  "Living & Lounge": [
    { type: "Sofa Set", width: 2000, height: 850, label: "Sofa Set (2000 × 850 mm)" },
    { type: "Coffee Table", width: 1000, height: 600, label: "Coffee Table (1000 × 600 mm)" },
    { type: "TV Unit", width: 1500, height: 400, label: "TV Unit (1500 × 400 mm)" },
    { type: "Bookshelf", width: 900, height: 350, label: "Bookshelf (900 × 350 mm)" }
  ],
  "Dining Area": [
    { type: "Dining Table", width: 1500, height: 900, label: "Dining Table (1500 × 900 mm)" },
    { type: "Dining Chairs", width: 450, height: 450, label: "Dining Chairs (450 × 450 mm)" },
    { type: "Crockery Unit", width: 1200, height: 450, label: "Crockery Unit (1200 × 450 mm)" }
  ],
  "Study & Office": [
    { type: "Study Desk", width: 1200, height: 600, label: "Study Desk (1200 × 600 mm)" },
    { type: "Office Chair", width: 600, height: 600, label: "Office Chair (600 × 600 mm)" },
    { type: "Filing Cabinet", width: 500, height: 500, label: "Filing Cabinet (500 × 500 mm)" }
  ],
  "General": [
    { type: "Standard Furniture Block", width: 1000, height: 600, label: "Standard Furniture Block (1000 × 600 mm)" }
  ]
};

export function getFurnitureDefaults(itemType) {
  if (!itemType || typeof itemType !== 'string') {
    return { width: 1000, height: 600, category: 'General', type: 'Standard Furniture Block' };
  }
  const clean = itemType.trim().toLowerCase();
  for (const [cat, items] of Object.entries(FURNITURE_CATEGORIES)) {
    for (const it of items) {
      if (it.type.toLowerCase() === clean) {
        return { width: it.width, height: it.height, category: cat, type: it.type };
      }
    }
  }
  if (clean.includes('bed')) return { width: 1800, height: 2000, category: 'Bedroom', type: 'Double Bed' };
  if (clean.includes('wardrobe')) return { width: 1200, height: 600, category: 'Bedroom', type: 'Wardrobe' };
  if (clean.includes('sofa')) return { width: 2000, height: 850, category: 'Living & Lounge', type: 'Sofa Set' };
  if (clean.includes('dining')) return { width: 1500, height: 900, category: 'Dining Area', type: 'Dining Table' };
  if (clean.includes('desk') || clean.includes('study')) return { width: 1200, height: 600, category: 'Study & Office', type: 'Study Desk' };
  if (clean.includes('chair')) return { width: 600, height: 600, category: 'Study & Office', type: 'Office Chair' };

  return { width: 1000, height: 600, category: 'General', type: 'Standard Furniture Block' };
}

export function getFurniturePrefix(itemType) {
  if (!itemType || typeof itemType !== 'string') return 'FURN';
  const clean = itemType.trim().toLowerCase();
  if (clean.includes('bed') || clean.includes('dressing')) return 'BED';
  if (clean.includes('chair')) return 'CHR';
  if (clean.includes('desk') || clean.includes('study')) return 'DESK';
  if (clean.includes('sofa') || clean.includes('couch')) return 'SOF';
  if (clean.includes('wardrobe') || clean.includes('closet')) return 'WRB';
  if (clean.includes('table') || clean.includes('coffee') || clean.includes('dining')) return 'TBL';
  if (clean.includes('tv') || clean.includes('media')) return 'TV';
  if (clean.includes('cabinet') || clean.includes('filing') || clean.includes('crockery') || clean.includes('bookshelf')) return 'CAB';
  return 'FURN';
}

export function generateNextFurnitureId(itemType, existingFurniture = []) {
  const prefix = getFurniturePrefix(itemType);
  let count = 1;
  let candidate = `${prefix}-${count}`;
  while ((existingFurniture || []).some(f => (f?.id || '').toUpperCase() === candidate.toUpperCase())) {
    count++;
    candidate = `${prefix}-${count}`;
  }
  return candidate;
}

export function getClearanceBadgeInfo(status) {
  const s = status || 'OK';
  if (s === 'OK') {
    return {
      text: '✓ Clear (≥200mm)',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.4)',
      tooltip: 'Safe placement: maintains ≥200mm clearance from doors and walls.'
    };
  }
  if (s.includes('Wall Collision')) {
    return {
      text: '⚠ Warning: Wall Collision',
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.18)',
      border: 'rgba(239, 68, 68, 0.5)',
      tooltip: 'Wall Collision: Item extends outside or penetrates the room wall boundary.'
    };
  }
  if (s.includes('Blocks Door') || s.includes('Door Swing Collision')) {
    return {
      text: '⚠ Warning: Blocks Door',
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.18)',
      border: 'rgba(239, 68, 68, 0.5)',
      tooltip: 'Door Obstruction: Item blocks or severely impedes the door swing passage.'
    };
  }
  if (s.includes('Overlap')) {
    const match = s.match(/Overlaps?\s*\(?([A-Za-z0-9_-]+)\)?/i);
    const text = match ? `⚠ Warning: Overlaps ${match[1]}` : '⚠ Warning: Furniture Overlap';
    return {
      text,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.18)',
      border: 'rgba(245, 158, 11, 0.5)',
      tooltip: `Collision: ${s}`
    };
  }
  if (s.includes('Close') || s.includes('Near')) {
    return {
      text: '⚠ Warning: Near Door (<200mm)',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      tooltip: 'Warning: Placed within 200mm of the door swing zone.'
    };
  }
  return {
    text: s.startsWith('Warning') ? `⚠ ${s}` : `⚠ Warning: ${s}`,
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.5)',
    tooltip: s
  };
}

function FurnitureRow({ furn, idx, rooms, allFurniture = [], onUpdateFurniture, inputStyle }) {
  const currentType = furn?.type || 'Bed';
  const currentW = Math.round(furn?.width ?? 1200);
  const currentH = Math.round(furn?.height ?? 1800);
  const currentX = Math.round(furn?.x ?? 0);
  const currentY = Math.round(furn?.y ?? 0);
  const currentRot = Math.round(furn?.rotation ?? 0);

  const [selectedType, setSelectedType] = useState(currentType);
  const [editW, setEditW] = useState(String(currentW));
  const [editH, setEditH] = useState(String(currentH));
  const [editX, setEditX] = useState(String(currentX));
  const [editY, setEditY] = useState(String(currentY));
  const [editRot, setEditRot] = useState(String(currentRot));
  const [isModified, setIsModified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dynamically sync dimensions, coordinates, rotation, and type when updated externally or dragged on canvas
  useEffect(() => {
    setSelectedType(furn?.type || 'Bed');
    setEditW(String(currentW));
    setEditH(String(currentH));
    setEditX(String(currentX));
    setEditY(String(currentY));
    setEditRot(String(currentRot));
    setIsModified(false);
    setErrorMsg('');
  }, [furn?.id, furn?.type, currentW, currentH, currentX, currentY, currentRot]);

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const defaults = getFurnitureDefaults(newType);
    const newPrefix = getFurniturePrefix(defaults.type);

    let nextId = furn?.id || `${newPrefix}-1`;
    if (!nextId.startsWith(newPrefix + '-')) {
      const otherIds = new Set(
        (allFurniture || [])
          .filter(f => f?.id !== furn?.id)
          .map(f => f?.id)
          .filter(Boolean)
      );
      let k = 1;
      while (otherIds.has(`${newPrefix}-${k}`)) {
        k++;
      }
      nextId = `${newPrefix}-${k}`;
    }

    setSelectedType(defaults.type);
    setEditW(String(defaults.width));
    setEditH(String(defaults.height));
    setIsModified(false);
    setErrorMsg('');

    if (onUpdateFurniture && furn?.id) {
      onUpdateFurniture('Furniture', furn.id, {
        id: nextId,
        newId: nextId,
        type: defaults.type,
        category: defaults.category,
        width: defaults.width,
        height: defaults.height,
        x: Number(editX),
        y: Number(editY),
        rotation: (Number(editRot) % 360 + 360) % 360
      });
    }
  };

  const handleDimensionChange = (setter) => (e) => {
    const val = e.target.value;
    // Allow empty string or non-negative numbers while typing
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setter(val);
      setIsModified(true);
      setErrorMsg('');
    }
  };

  const handleSave = () => {
    const trimmedW = editW.trim();
    const trimmedH = editH.trim();
    const trimmedX = editX.trim();
    const trimmedY = editY.trim();
    const trimmedRot = editRot.trim();

    const numW = Number(trimmedW);
    const numH = Number(trimmedH);
    const numX = Number(trimmedX);
    const numY = Number(trimmedY);
    const numRot = Number(trimmedRot);

    if (
      trimmedW === '' || trimmedH === '' || trimmedX === '' || trimmedY === '' || trimmedRot === '' ||
      isNaN(numW) || isNaN(numH) || isNaN(numX) || isNaN(numY) || isNaN(numRot) ||
      !isFinite(numW) || !isFinite(numH) || !isFinite(numX) || !isFinite(numY) || !isFinite(numRot) ||
      numW <= 0 || numH <= 0
    ) {
      setErrorMsg('Dimensions must be > 0 mm');
      return;
    }

    setErrorMsg('');
    setIsModified(false);

    if (onUpdateFurniture && furn?.id) {
      onUpdateFurniture('Furniture', furn.id, {
        type: selectedType,
        category: getFurnitureDefaults(selectedType).category,
        width: Math.round(numW),
        height: Math.round(numH),
        x: Math.round(numX),
        y: Math.round(numY),
        rotation: (Math.round(numRot) % 360 + 360) % 360
      });
    }
  };

  const handleQuickRotate = () => {
    const nextRot = ((currentRot + 90) % 360 + 360) % 360;
    setEditRot(String(nextRot));
    if (onUpdateFurniture && furn?.id) {
      onUpdateFurniture('Furniture', furn.id, {
        rotation: nextRot
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const coordInputStyle = {
    backgroundColor: '#0B0F19',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: isModified ? '#6366F1' : '#334155',
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

  const typeSelectStyle = {
    backgroundColor: '#0F172A',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#334155',
    color: '#E0E7FF',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '600',
    outline: 'none',
    width: '100%',
    minWidth: '160px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease'
  };

  const badgeInfo = getClearanceBadgeInfo(furn?.clearance_status);
  const isWarning = furn?.clearance_status && furn.clearance_status.includes('Warning');

  // Ensure selectedType matches an item in known types or falls back gracefully
  const allKnownTypes = Object.values(FURNITURE_CATEGORIES).flatMap(items => items.map(it => it.type));
  const resolvedTypeValue = allKnownTypes.includes(selectedType) ? selectedType : getFurnitureDefaults(selectedType).type;

  return (
    <tr key={`furn-${furn?.id || idx}`}>
      <td className="room-name-cell">
        <span
          className="room-color-badge"
          style={{ backgroundColor: '#818CF8' }}
        />
        {furn?.id || `FURN-${idx + 1}`}
      </td>
      <td>
        {onUpdateFurniture ? (
          <select
            value={resolvedTypeValue}
            onChange={handleTypeChange}
            style={typeSelectStyle}
            onFocus={(e) => { e.target.style.borderColor = '#6366F1'; }}
            onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
            title="Select furniture type and auto-fill standard dimensions"
          >
            {Object.entries(FURNITURE_CATEGORIES).map(([catName, items]) => (
              <optgroup
                key={catName}
                label={catName}
                style={{ backgroundColor: '#1E293B', color: '#94A3B8', fontWeight: 'bold' }}
              >
                {items.map(item => (
                  <option
                    key={item.type}
                    value={item.type}
                    style={{ backgroundColor: '#0F172A', color: '#E2E8F0', fontWeight: 'normal' }}
                  >
                    {item.label || item.type}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <span style={{ fontWeight: 600, color: '#C7D2FE' }}>{furn?.type || 'Bed'}</span>
        )}
      </td>
      <td>
        {onUpdateFurniture ? (
          <select 
            value={furn?.host_room_id || ''}
            onChange={(e) => onUpdateFurniture('Furniture', furn.id, { host_room_id: e.target.value })}
            style={inputStyle}
          >
            {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        ) : furn?.host_room_id}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>W:</span>
          <input
            type="text"
            inputMode="numeric"
            value={editW}
            onChange={handleDimensionChange(setEditW)}
            onKeyDown={handleKeyDown}
            style={coordInputStyle}
            title="Furniture Width in millimeters (editable)"
          />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>H:</span>
          <input
            type="text"
            inputMode="numeric"
            value={editH}
            onChange={handleDimensionChange(setEditH)}
            onKeyDown={handleKeyDown}
            style={coordInputStyle}
            title="Furniture Height/Length in millimeters (editable)"
          />
          <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '2px' }}>mm</span>
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>X:</span>
          <input
            type="number"
            value={editX}
            onChange={(e) => {
              setEditX(e.target.value);
              setIsModified(true);
            }}
            onKeyDown={handleKeyDown}
            style={coordInputStyle}
            title="CAD X Coordinate in millimeters"
          />
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>Y:</span>
          <input
            type="number"
            value={editY}
            onChange={(e) => {
              setEditY(e.target.value);
              setIsModified(true);
            }}
            onKeyDown={handleKeyDown}
            style={coordInputStyle}
            title="CAD Y Coordinate in millimeters"
          />
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            value={editRot}
            onChange={(e) => {
              setEditRot(e.target.value);
              setIsModified(true);
            }}
            onKeyDown={handleKeyDown}
            style={{ ...coordInputStyle, width: '52px' }}
            title="Rotation angle in degrees (0, 90, 180, 270)"
          />
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>°</span>
          <button
            type="button"
            onClick={handleQuickRotate}
            title="Quick Rotate 90° Clockwise"
            style={{
              background: '#1E293B',
              border: '1px solid #475569',
              color: '#A5B4FC',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ↻ 90°
          </button>
        </div>
      </td>
      <td>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: badgeInfo.bg,
            color: badgeInfo.color,
            border: `1px solid ${badgeInfo.border}`,
            whiteSpace: 'nowrap'
          }}
          title={badgeInfo.tooltip}
        >
          {badgeInfo.text}
        </span>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isModified}
            style={{
              backgroundColor: isModified ? '#6366F1' : '#1E293B',
              borderColor: isModified ? '#818CF8' : '#334155',
              color: isModified ? '#FFFFFF' : '#64748B',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isModified ? 'pointer' : 'default',
              transition: 'all 0.15s ease'
            }}
            title="Save manual coordinates and rotation"
          >
            {isModified ? 'Save' : 'Synced'}
          </button>
          {onUpdateFurniture && (
            <button
              type="button"
              onClick={() => onUpdateFurniture('DeleteFurniture', furn.id, {})}
              title={`Delete ${furn.id}`}
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
              Delete
            </button>
          )}
        </div>
        {errorMsg && (
          <span style={{ color: '#EF4444', fontSize: '10px', marginLeft: '6px' }}>
            {errorMsg}
          </span>
        )}
      </td>
    </tr>
  );
}

export function AddFurnitureModal({ isOpen, onClose, rooms = [], furniture = [], onConfirm }) {
  if (!isOpen) return null;

  const initialCat = "Bedroom";
  const defaultItem = FURNITURE_CATEGORIES[initialCat]?.[0] || { type: "Double Bed", width: 1800, height: 2000 };

  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.name || '');
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [selectedType, setSelectedType] = useState(defaultItem.type);
  const [customWidth, setCustomWidth] = useState(String(defaultItem.width));
  const [customHeight, setCustomHeight] = useState(String(defaultItem.height));
  const [error, setError] = useState('');

  // Keep selectedRoom valid if rooms list changes
  useEffect(() => {
    if (rooms && rooms.length > 0 && (!selectedRoom || !rooms.some(r => r.name === selectedRoom))) {
      setSelectedRoom(rooms[0].name);
    }
  }, [rooms, selectedRoom]);

  // Handle Category Change
  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    const firstItem = FURNITURE_CATEGORIES[cat]?.[0];
    if (firstItem) {
      setSelectedType(firstItem.type);
      setCustomWidth(String(firstItem.width));
      setCustomHeight(String(firstItem.height));
      setError('');
    }
  };

  // Handle Type Change
  const handleTypeSelect = (type) => {
    setSelectedType(type);
    const defaults = getFurnitureDefaults(type);
    setCustomWidth(String(defaults.width));
    setCustomHeight(String(defaults.height));
    if (defaults.category && defaults.category !== selectedCategory) {
      setSelectedCategory(defaults.category);
    }
    setError('');
  };

  // Reset to standard catalog dimensions
  const handleResetDimensions = () => {
    const defaults = getFurnitureDefaults(selectedType);
    setCustomWidth(String(defaults.width));
    setCustomHeight(String(defaults.height));
    setError('');
  };

  const previewId = generateNextFurnitureId(selectedType, furniture);
  const currentCategoryItems = FURNITURE_CATEGORIES[selectedCategory] || [];

  const handleConfirm = (e) => {
    e.preventDefault();
    const w = parseFloat(customWidth);
    const h = parseFloat(customHeight);
    if (!Number.isFinite(w) || w <= 0) {
      setError("Please enter a valid positive width in mm.");
      return;
    }
    if (!Number.isFinite(h) || h <= 0) {
      setError("Please enter a valid positive height/length in mm.");
      return;
    }

    const hostRoom = selectedRoom || (rooms[0]?.name) || "Room 1";

    onConfirm({
      id: previewId,
      type: selectedType,
      category: selectedCategory,
      host_room_id: hostRoom,
      width: Math.round(w),
      height: Math.round(h)
    });
  };

  const categoryIcons = {
    "Bedroom": "🛏️",
    "Living & Lounge": "🛋️",
    "Dining Area": "🍽️",
    "Study & Office": "💼",
    "General": "📦"
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
          border: '1px solid #475569',
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '9999px', padding: '2px 8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#A5B4FC', letterSpacing: '0.5px' }}>+ NEW FURNITURE</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
              Add Furniture Item
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              Select target room, category, and furniture type. Dimensions and IDs are auto-assigned.
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
          {/* Target Host Room */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Target Host Room <span style={{ color: '#EF4444' }}>*</span>
            </label>
            {rooms && rooms.length > 0 ? (
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#E2E8F0',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {rooms.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name} {r.carpet_area_sqm ? `(${(r.carpet_area_sqm).toFixed(1)} sq.m)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: '8px 12px', backgroundColor: '#0F172A', border: '1px dashed #475569', borderRadius: '6px', fontSize: '12px', color: '#94A3B8' }}>
                No rooms defined. Item will default to canvas coordinates (2000, 2000).
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Category
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(FURNITURE_CATEGORIES).map(cat => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isActive ? '#6366F1' : '#0F172A',
                      color: isActive ? '#FFFFFF' : '#94A3B8',
                      border: isActive ? '1px solid #6366F1' : '1px solid #334155',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{categoryIcons[cat] || '📦'}</span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Furniture Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Furniture Type &amp; Standard Size
            </label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeSelect(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#E2E8F0',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              {currentCategoryItems.map(item => (
                <option key={item.type} value={item.type}>
                  {item.label || `${item.type} (${item.width} × ${item.height} mm)`}
                </option>
              ))}
            </select>
          </div>

          {/* Dimensions Fine-tuning */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#CBD5E1' }}>
                Dimensions (Width × Height / Depth)
              </label>
              <button
                type="button"
                onClick={handleResetDimensions}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366F1',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Reset to default standard catalog dimensions"
              >
                ↺ Reset to Defaults
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Width (mm)</span>
                <input
                  type="number"
                  step="50"
                  min="100"
                  max="10000"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#E2E8F0',
                    padding: '6px 10px',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Height / Depth (mm)</span>
                <input
                  type="number"
                  step="50"
                  min="100"
                  max="10000"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#E2E8F0',
                    padding: '6px 10px',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
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
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Generated Item ID:</span>
              <span style={{
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                {previewId}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Target Placement:</span>
              <span style={{ fontSize: '12px', color: '#E2E8F0', fontWeight: 600 }}>
                Center of {selectedRoom || (rooms[0]?.name) || 'Room'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Footprint Size:</span>
              <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 600 }}>
                {customWidth || 0} × {customHeight || 0} mm
              </span>
            </div>
            <div style={{ marginTop: '2px', borderTop: '1px solid #1E293B', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: '#10B981' }}>✓ Automatic 200mm Door &amp; Wall Clearance Buffers Active</span>
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
                backgroundColor: '#6366F1',
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
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              <span>+ Add Furniture</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FurnitureTable({ rooms = [], furniture = [], onUpdateFurniture }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddFurnitureConfirm = (newItemData) => {
    setIsAddModalOpen(false);
    if (onUpdateFurniture) {
      onUpdateFurniture('AddFurniture', null, newItemData);
    }
  };

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

  return (
    <div className="table-responsive schedule-table-container">
      <div style={{ padding: '8px 12px', backgroundColor: '#0B0F19', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
            FURNITURE &amp; CLEARANCE SCHEDULE ({furniture.length} item{furniture.length === 1 ? '' : 's'})
          </span>
          {onUpdateFurniture && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              title="Add a new furniture item to the layout"
              style={{
                backgroundColor: '#6366F1',
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
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#4F46E5';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#6366F1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.35)';
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>+</span>
              <span>Add Furniture</span>
            </button>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#64748B' }}>
          Automatic 200mm Door &amp; Wall Clearance Buffers Active
        </span>
      </div>

      <table className="cad-table">
        <thead>
          <tr>
            <th>ITEM ID</th>
            <th>TYPE</th>
            <th>HOST ROOM</th>
            <th>DIMENSIONS (W × H)</th>
            <th>COORDINATES (X, Y)</th>
            <th>ROTATION</th>
            <th>CLEARANCE STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {furniture && furniture.length > 0 ? (
            furniture.map((furn, idx) => (
              <FurnitureRow
                key={`furn-row-${furn?.id || idx}`}
                furn={furn}
                idx={idx}
                rooms={rooms}
                allFurniture={furniture}
                onUpdateFurniture={onUpdateFurniture}
                inputStyle={inputStyle}
              />
            ))
          ) : (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 600 }}>No furniture added yet</span>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>Beds, sofas, wardrobes, desks, and tables will appear here with clearance validation</span>
                  {onUpdateFurniture && (
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      style={{
                        marginTop: '6px',
                        backgroundColor: '#6366F1',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
                      }}
                    >
                      <span>+</span>
                      <span>Add First Furniture Item</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Interactive Furniture Selection Modal */}
      <AddFurnitureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        rooms={rooms}
        furniture={furniture}
        onConfirm={handleAddFurnitureConfirm}
      />
    </div>
  );
}
