import React, { useState } from "react";

export default function QualityTierSelectorModal({
  isOpen,
  onClose,
  activeTier = "medium",
  onSelectTier,
  isCalculating = false
}) {
  const [selectedTier, setSelectedTier] = useState(activeTier || "medium");

  if (!isOpen) return null;

  const tiers = [
    {
      id: "low",
      name: "Budget / Economy",
      tag: "Cost-Effective & Functional",
      color: "emerald",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      accentBorder: "hover:border-emerald-500/50",
      activeRing: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5",
      rateRange: "₹ 1,650 – ₹ 1,850 / sq.ft",
      features: [
        { label: "Masonry", value: "Solid Concrete Blocks (400x200x150 mm)" },
        { label: "Cement", value: "Standard 43 Grade PPC (Dalmia / Chettinad)" },
        { label: "Flooring", value: "Standard Ceramic / 2x2 Vitrified Tiles" },
        { label: "HVAC", value: "3-Star Fixed/Inverter Split ACs" },
        { label: "Electrical", value: "Anchor Roma Modular Plates & LED fixtures" },
        { label: "Plumbing", value: "Cera / Parryware Floor-mounted EWCs" },
        { label: "Furniture", value: "Commercial MR-grade plywood with 0.8mm laminate" }
      ]
    },
    {
      id: "medium",
      name: "Standard / Premium",
      tag: "Recommended for Modern Homes",
      recommended: true,
      color: "sky",
      badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      accentBorder: "hover:border-sky-500/50",
      activeRing: "ring-2 ring-sky-500 border-sky-500 bg-sky-500/5",
      rateRange: "₹ 2,200 – ₹ 2,450 / sq.ft",
      features: [
        { label: "Masonry", value: "First-Class Wire-Cut Bricks / Solid Blocks" },
        { label: "Cement", value: "UltraTech Super / ACC Suraksha 53 Grade" },
        { label: "Flooring", value: "800x800 Double-Charged Vitrified Tiles (Kajaria)" },
        { label: "HVAC", value: "5-Star Inverter Split ACs (Daikin / Panasonic)" },
        { label: "Electrical", value: "Legrand / Schneider Modular Plates & BLDC Fans" },
        { label: "Plumbing", value: "Jaquar / Kohler Rimless EWCs & Diverters" },
        { label: "Furniture", value: "Marine BWP 710 Plywood + 1mm Laminate / Hettich" }
      ]
    },
    {
      id: "high",
      name: "Luxury / Architectural",
      tag: "Bespoke High-End Finishes",
      color: "purple",
      badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      accentBorder: "hover:border-purple-500/50",
      activeRing: "ring-2 ring-purple-500 border-purple-500 bg-purple-500/5",
      rateRange: "₹ 2,900 – ₹ 3,500 / sq.ft",
      features: [
        { label: "Masonry", value: "Dressed Laterite Stone / Interlocking Blocks" },
        { label: "Cement", value: "UltraTech Weather Pro / Birla White 53 Grade" },
        { label: "Flooring", value: "Italian Marble / Brazilian Granite / Large Slabs" },
        { label: "HVAC", value: "Multi-Split VRF / Daikin VRV Inverter System" },
        { label: "Electrical", value: "Smart Capacitive Touch / Zigbee IoT Home Automation" },
        { label: "Plumbing", value: "Grohe / Toto Sensor Smart Toilets & Rain Showers" },
        { label: "Furniture", value: "Solid Teak Wood / Italian PU Lacquer / Blum motorized" }
      ]
    }
  ];

  const handleConfirm = () => {
    onSelectTier(selectedTier);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCalculating) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '980px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1e293b',
            backgroundColor: '#0b1120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}
            >
              🏗️
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Select Construction Quality Tier
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
                  Step 1 of 2
                </span>
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Choose the material specifications and finish grade to calculate the Bill of Materials (BOQ).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tier Cards Grid */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}
        >
          {tiers.map((t) => {
            const isSelected = selectedTier === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTier(t.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #334155',
                  backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                  boxShadow: isSelected ? '0 0 20px rgba(2, 132, 199, 0.25)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
              >
                {t.recommended && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '16px',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.5)'
                    }}
                  >
                    ★ Most Popular
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: t.id === 'low' ? 'rgba(16, 185, 129, 0.15)' : t.id === 'medium' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                        color: t.id === 'low' ? '#34d399' : t.id === 'medium' ? '#38bdf8' : '#c084fc',
                        border: `1px solid ${t.id === 'low' ? 'rgba(16, 185, 129, 0.3)' : t.id === 'medium' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                      }}
                    >
                      {t.tag}
                    </span>
                    <input
                      type="radio"
                      name="quality_tier_radio"
                      checked={isSelected}
                      onChange={() => setSelectedTier(t.id)}
                      style={{ cursor: 'pointer', accentColor: '#0284c7', width: '16px', height: '16px' }}
                    />
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>{t.name}</h3>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
                    Est. Rate: <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>{t.rateRange}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {t.features.map((f, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{f.label}: </span>
                        <span style={{ color: '#e2e8f0' }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                  <div
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: isSelected ? '#0284c7' : 'rgba(51, 65, 85, 0.5)',
                      color: '#ffffff',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isSelected ? '✓ Selected Tier' : 'Select Tier'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#0b1120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>ℹ️ You can change this tier anytime inside the BOQ Dashboard.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#cbd5e1',
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isCalculating}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: isCalculating ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isCalculating ? 0.6 : 1
              }}
            >
              {isCalculating ? (
                <span>Calculating BOQ...</span>
              ) : (
                <>
                  <span>📊 Calculate Bill of Materials</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
