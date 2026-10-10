import React, { useState } from 'react';

export const CAD_BLOCK_LIBRARY = [
  // Furniture
  { id: 'blk-bed-king', name: 'King Bed', category: 'furniture', width: 2000, height: 1800, icon: '🛏️', layer: 'A-FURN' },
  { id: 'blk-bed-queen', name: 'Queen Bed', category: 'furniture', width: 1900, height: 1500, icon: '🛏️', layer: 'A-FURN' },
  { id: 'blk-bed-single', name: 'Single Bed', category: 'furniture', width: 1900, height: 900, icon: '🛏️', layer: 'A-FURN' },
  { id: 'blk-sofa-3', name: 'Sofa (3-Seater)', category: 'furniture', width: 2100, height: 850, icon: '🛋️', layer: 'A-FURN' },
  { id: 'blk-sofa-2', name: 'Sofa (2-Seater)', category: 'furniture', width: 1500, height: 850, icon: '🛋️', layer: 'A-FURN' },
  { id: 'blk-dining-6', name: 'Dining Table (6P)', category: 'furniture', width: 1600, height: 900, icon: '🪑', layer: 'A-FURN' },
  { id: 'blk-wardrobe', name: 'Wardrobe', category: 'furniture', width: 1800, height: 600, icon: '🚪', layer: 'A-FURN' },
  { id: 'blk-desk', name: 'Study Desk', category: 'furniture', width: 1200, height: 600, icon: '🖥️', layer: 'A-FURN' },

  // Sanitary & Plumbing
  { id: 'blk-wc', name: 'WC / Toilet', category: 'plumbing', width: 500, height: 700, icon: '🚽', layer: 'P-PLUM' },
  { id: 'blk-basin', name: 'Wash Basin', category: 'plumbing', width: 550, height: 450, icon: '🚰', layer: 'P-PLUM' },
  { id: 'blk-shower', name: 'Shower Cabin', category: 'plumbing', width: 900, height: 900, icon: '🚿', layer: 'P-PLUM' },
  { id: 'blk-bath', name: 'Bathtub', category: 'plumbing', width: 1700, height: 750, icon: '🛁', layer: 'P-PLUM' },

  // Kitchen
  { id: 'blk-sink', name: 'Kitchen Sink', category: 'kitchen', width: 600, height: 600, icon: '🚰', layer: 'P-PLUM' },
  { id: 'blk-stove', name: 'Gas Stove / Cooktop', category: 'kitchen', width: 600, height: 600, icon: '🍳', layer: 'A-FURN' },
  { id: 'blk-fridge', name: 'Refrigerator', category: 'kitchen', width: 800, height: 700, icon: '🧊', layer: 'A-FURN' },

  // Electrical & HVAC
  { id: 'blk-fan', name: 'Ceiling Fan', category: 'electrical', width: 1200, height: 1200, icon: '🌀', layer: 'E-ELEC' },
  { id: 'blk-light', name: 'Recessed Downlight', category: 'electrical', width: 200, height: 200, icon: '💡', layer: 'E-ELEC' },
  { id: 'blk-ac-idu', name: 'Split AC (Indoor)', category: 'hvac', width: 950, height: 260, icon: '❄️', layer: 'M-HVAC' },
  { id: 'blk-ac-odu', name: 'Split AC (Outdoor)', category: 'hvac', width: 850, height: 350, icon: '⚙️', layer: 'M-HVAC' }
];

export default function AutoCadBlockLibrary({
  isOpen,
  onClose,
  onSelectBlock
}) {
  const [activeTab, setActiveTab] = useState('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Blocks' },
    { id: 'furniture', label: 'Furniture' },
    { id: 'plumbing', label: 'Sanitary' },
    { id: 'kitchen', label: 'Kitchen' },
    { id: 'electrical', label: 'Electrical' },
    { id: 'hvac', label: 'HVAC' }
  ];

  const filtered = activeTab === 'all'
    ? CAD_BLOCK_LIBRARY
    : CAD_BLOCK_LIBRARY.filter(b => b.category === activeTab);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '640px',
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
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
          padding: '12px 16px',
          backgroundColor: '#090D16',
          borderBottom: '1px solid #1E293B'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: '#38BDF8' }}>
            <span>📦</span>
            <span>Architectural CAD Block Library</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          backgroundColor: '#1E293B',
          borderBottom: '1px solid #334155'
        }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              style={{
                background: activeTab === cat.id ? '#0284C7' : '#0F172A',
                border: `1px solid ${activeTab === cat.id ? '#38BDF8' : '#334155'}`,
                color: activeTab === cat.id ? '#FFFFFF' : '#94A3B8',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11px'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Blocks Grid */}
        <div style={{
          padding: '16px',
          maxHeight: '380px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px'
        }}>
          {filtered.map(block => (
            <div
              key={block.id}
              onClick={() => {
                onSelectBlock(block);
                onClose();
              }}
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38BDF8';
                e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.backgroundColor = '#1E293B';
              }}
            >
              <div style={{ fontSize: '28px' }}>{block.icon}</div>
              <div style={{ fontWeight: 700, color: '#F8FAFC', textAlign: 'center' }}>
                {block.name}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                {block.width} × {block.height} mm
              </div>
              <div style={{
                backgroundColor: '#0F172A',
                color: '#38BDF8',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 600
              }}>
                Layer: {block.layer}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#090D16',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
