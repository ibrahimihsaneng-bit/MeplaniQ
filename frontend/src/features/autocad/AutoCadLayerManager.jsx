import React, { useState } from 'react';

export default function AutoCadLayerManager({
  isOpen,
  onClose,
  layers,
  activeLayerId,
  onSelectActiveLayer,
  onUpdateLayers
}) {
  const [newLayerName, setNewLayerName] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState(activeLayerId);

  if (!isOpen) return null;

  const handleToggleVisible = (id) => {
    onUpdateLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const handleToggleLocked = (id) => {
    onUpdateLayers(layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  };

  const handleColorChange = (id, newColor) => {
    onUpdateLayers(layers.map(l => l.id === id ? { ...l, color: newColor } : l));
  };

  const handleCreateLayer = () => {
    if (!newLayerName.trim()) return;
    const layerId = newLayerName.trim().toUpperCase().replace(/\s+/g, '-');
    if (layers.some(l => l.id === layerId)) {
      alert("A layer with this name already exists.");
      return;
    }
    const newLayer = {
      id: layerId,
      name: newLayerName.trim(),
      color: '#FFFFFF',
      lineweight: 0.25,
      visible: true,
      locked: false
    };
    onUpdateLayers([...layers, newLayer]);
    setNewLayerName("");
    setSelectedLayerId(layerId);
  };

  const handleDeleteLayer = (id) => {
    if (id === '0' || id === activeLayerId) {
      alert("Cannot delete Layer 0 or the current active layer.");
      return;
    }
    onUpdateLayers(layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId('0');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '680px',
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        color: '#E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: '12px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: '#090D16',
          borderBottom: '1px solid #1E293B'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
            <span>📑</span>
            <span>Layer Properties Manager</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#1E293B',
          borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="New layer name..."
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              style={{
                background: '#0F172A',
                border: '1px solid #475569',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            />
            <button
              type="button"
              onClick={handleCreateLayer}
              style={{
                background: '#0284C7',
                border: '1px solid #38BDF8',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              + New Layer
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onSelectActiveLayer(selectedLayerId)}
              style={{
                background: '#16A34A',
                border: '1px solid #22C55E',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✓ Set Current
            </button>
            <button
              type="button"
              onClick={() => handleDeleteLayer(selectedLayerId)}
              style={{
                background: '#DC2626',
                border: '1px solid #EF4444',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        {/* Layers Table */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94A3B8', fontSize: '11px' }}>
                <th style={{ padding: '6px' }}>Current</th>
                <th style={{ padding: '6px' }}>Name</th>
                <th style={{ padding: '6px', textAlign: 'center' }}>On/Off</th>
                <th style={{ padding: '6px', textAlign: 'center' }}>Lock</th>
                <th style={{ padding: '6px' }}>Color</th>
                <th style={{ padding: '6px' }}>Lineweight</th>
              </tr>
            </thead>
            <tbody>
              {layers.map(layer => {
                const isCurrent = layer.id === activeLayerId;
                const isSelected = layer.id === selectedLayerId;
                return (
                  <tr
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'transparent',
                      borderBottom: '1px solid #1E293B',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {isCurrent ? <span style={{ color: '#22C55E', fontWeight: 800 }}>✓</span> : ''}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600, color: isCurrent ? '#38BDF8' : '#F1F5F9' }}>
                      {layer.name}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleVisible(layer.id); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                      >
                        {layer.visible ? '💡' : '🌑'}
                      </button>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleLocked(layer.id); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                      >
                        {layer.locked ? '🔒' : '🔓'}
                      </button>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="color"
                          value={layer.color || '#FFFFFF'}
                          onChange={(e) => handleColorChange(layer.id, e.target.value)}
                          style={{
                            width: '24px',
                            height: '24px',
                            border: 'none',
                            padding: 0,
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{layer.color}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px', color: '#CBD5E1' }}>
                      {layer.lineweight} mm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '10px 18px',
          backgroundColor: '#090D16',
          borderTop: '1px solid #1E293B'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
