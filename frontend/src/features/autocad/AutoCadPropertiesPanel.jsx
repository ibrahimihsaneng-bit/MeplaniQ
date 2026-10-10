import React from 'react';
import { dist, angleDeg } from './cadGeometryUtils';

export default function AutoCadPropertiesPanel({
  selectedEntity,
  layers = [],
  onUpdateEntity,
  onDeleteEntity,
  onClose
}) {
  if (!selectedEntity) return null;

  const layer = layers.find(l => l.id === selectedEntity.layer) || layers[0];

  return (
    <aside className="autocad-properties-panel" style={{
      position: 'absolute',
      top: '12px',
      right: '16px',
      width: '280px',
      maxHeight: 'calc(100% - 70px)',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #334155',
      borderRadius: '8px',
      boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      color: '#E2E8F0',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      fontSize: '12px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: '#090D16',
        borderBottom: '1px solid #1E293B'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#38BDF8' }}>
          <span>📋</span>
          <span>Properties: {selectedEntity.type?.toUpperCase()}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '15px' }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Layer */}
        <div>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
            Layer
          </label>
          <select
            value={selectedEntity.layer || '0'}
            onChange={(e) => onUpdateEntity(selectedEntity.id, { layer: e.target.value })}
            style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
          >
            {layers.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
            Color Override
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={selectedEntity.color || layer?.color || '#FFFFFF'}
              onChange={(e) => onUpdateEntity(selectedEntity.id, { color: e.target.value })}
              style={{ width: '32px', height: '26px', border: 'none', padding: 0, borderRadius: '3px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: '#CBD5E1' }}>{selectedEntity.color || 'ByLayer'}</span>
          </div>
        </div>

        {/* WALL PROPERTIES */}
        {selectedEntity.type === 'wall' && (
          <>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Thickness (mm)
              </label>
              <select
                value={selectedEntity.thickness || 150}
                onChange={(e) => onUpdateEntity(selectedEntity.id, { thickness: Number(e.target.value) })}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
              >
                <option value={100}>100 mm (Drywall / Partition)</option>
                <option value={150}>150 mm (Standard Partition)</option>
                <option value={200}>200 mm (Load-bearing)</option>
                <option value={230}>230 mm (Exterior 9" Brick)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Length (mm)
              </label>
              <input
                type="number"
                readOnly
                value={Math.round(dist(selectedEntity.centerline?.p1, selectedEntity.centerline?.p2))}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#38BDF8', padding: '5px', borderRadius: '4px', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Angle
              </label>
              <input
                type="text"
                readOnly
                value={`${Math.round(angleDeg(selectedEntity.centerline?.p1, selectedEntity.centerline?.p2))}°`}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#94A3B8', padding: '5px', borderRadius: '4px' }}
              />
            </div>
          </>
        )}

        {/* DOOR PROPERTIES */}
        {selectedEntity.type === 'door' && (
          <>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Door Width (mm)
              </label>
              <select
                value={selectedEntity.widthMm || 900}
                onChange={(e) => onUpdateEntity(selectedEntity.id, { widthMm: Number(e.target.value) })}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
              >
                <option value={750}>750 mm (Bathroom Door)</option>
                <option value={900}>900 mm (Bedroom Standard)</option>
                <option value={1000}>1000 mm (Main Entrance)</option>
                <option value={1200}>1200 mm (Double / Wide)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Swing Direction
              </label>
              <select
                value={selectedEntity.swing || 'inward-left'}
                onChange={(e) => onUpdateEntity(selectedEntity.id, { swing: e.target.value })}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
              >
                <option value="inward-left">Inward - Left Swing</option>
                <option value="inward-right">Inward - Right Swing</option>
                <option value="outward-left">Outward - Left Swing</option>
                <option value="outward-right">Outward - Right Swing</option>
              </select>
            </div>
          </>
        )}

        {/* WINDOW PROPERTIES */}
        {selectedEntity.type === 'window' && (
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
              Window Width (mm)
            </label>
            <select
              value={selectedEntity.widthMm || 1200}
              onChange={(e) => onUpdateEntity(selectedEntity.id, { widthMm: Number(e.target.value) })}
              style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
            >
              <option value={600}>600 mm (Ventilator)</option>
              <option value={900}>900 mm (Small Window)</option>
              <option value={1200}>1200 mm (Standard Window)</option>
              <option value={1500}>1500 mm (Wide Window)</option>
              <option value={1800}>1800 mm (3-Panel Window)</option>
            </select>
          </div>
        )}

        {/* TEXT PROPERTIES */}
        {selectedEntity.type === 'text' && (
          <>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Label Text
              </label>
              <input
                type="text"
                value={selectedEntity.text || ''}
                onChange={(e) => onUpdateEntity(selectedEntity.id, { text: e.target.value })}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Font Height (mm)
              </label>
              <input
                type="number"
                value={selectedEntity.fontSize || 250}
                onChange={(e) => onUpdateEntity(selectedEntity.id, { fontSize: Number(e.target.value) })}
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '5px', borderRadius: '4px' }}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#090D16',
        borderTop: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '10px', color: '#64748B' }}>ID: {selectedEntity.id}</span>
        <button
          type="button"
          onClick={() => onDeleteEntity(selectedEntity.id)}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#EF4444',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          🗑️ Erase
        </button>
      </div>
    </aside>
  );
}
