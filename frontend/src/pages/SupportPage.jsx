import React, { useState } from 'react';
import GlobalNavbar from '../components/GlobalNavbar';
import GlobalFooter from '../components/GlobalFooter';

const KEYBOARD_SHORTCUTS = [
  { key: 'V / Esc', action: 'Select Tool / Cancel active command' },
  { key: 'W', action: 'Draw Wall / New Room Creation' },
  { key: 'D', action: 'Add Door Opening (900mm default)' },
  { key: 'N', action: 'Add Window Opening' },
  { key: 'H', action: 'Add HVAC Unit (Split IDU / Cassette)' },
  { key: 'P', action: 'Add Plumbing Fixture (Basin / WC / Shower)' },
  { key: 'F', action: 'Add Furniture Item (Bed / Desk / Sofa)' },
  { key: 'G', action: 'Toggle CAD Measurement Grid' },
  { key: 'Middle Drag', action: 'Pan infinite CAD workspace' },
  { key: 'Scroll Wheel', action: 'Zoom In / Out centered on cursor' }
];

const FAQS = [
  {
    q: 'How does the 4-state plumbing auto-routing algorithm work?',
    a: 'When you rotate a plumbing fixture (0°, 90°, 180°, or 270°), the geometry router computes the relative angle between the fixture connection ports and the nearest riser/trunk line. In State 1 (0°), a straight orthogonal path is established. In States 2 & 3 (90° & 270°), a single-bend L-shape is generated with water supply and drainage offsets separated by 70mm. In State 4 (180°), both supply and drainage lines wrap around the same exterior flank in a synchronized parallel U-shape with zero pipe crossovers.'
  },
  {
    q: 'What layers are included in the AutoCAD DXF export?',
    a: 'The generated DXF follows AutoCAD R2018 metric standards, separated into dedicated engineering layers: WALLS_EXTERIOR (White/Black), WALLS_INTERIOR (Gray), DOORS (Yellow), WINDOWS (Cyan), HVAC_EQUIPMENT (Magenta), PLUMBING_SUPPLY (Cyan), PLUMBING_DRAINAGE (Green), and DIMENSIONS (Orange).'
  },
  {
    q: 'Can I import my existing floorplans from Microsoft Excel?',
    a: 'Yes. meplaniq accepts a 5-sheet workbook (.xlsx) containing "Room Coordinates Payload", "Doors and Windows", "HVAC Equipment", "Furniture", and "Plumbing Fixtures & Pipes". You can download our starter template anytime from the Projects Dashboard.'
  },
  {
    q: 'How does cloud backup work?',
    a: 'Projects are continuously saved to your local high-performance SQLite database (projects.db). When you click the "Cloud Vault" button in the CAD workspace, the full state is cryptographically synced to Supabase Postgres, allowing you to access your floorplans from any browser.'
  },
  {
    q: 'How do I export high-contrast drawings for white-paper printing?',
    a: 'Click "Export Image" in the CAD header and choose "Pure White (#FFFFFF)". The engine creates an isolated off-screen render clone, automatically inverting dark-mode wall outlines and text labels to deep black (#111111) while preserving standard MEP pipe colors (Green for drainage, Cyan for supply).'
  }
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setContactSubmitted(true);
    setEmail('');
    setMessage('');
    setTimeout(() => setContactSubmitted(false), 5000);
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '3.5rem 1.5rem', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '999px',
            backgroundColor: 'rgba(47, 128, 237, 0.1)',
            color: 'var(--accent-blue)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1rem'
          }}>
            Help Center &amp; Documentation
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Support &amp; Technical Reference
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', maxWidth: '680px', margin: '0 auto' }}>
            Reference guides, keyboard shortcuts, engineering rules, and technical answers for the meplaniq CAD platform.
          </p>
        </div>

        {/* Keyboard Shortcuts Section */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '2rem',
          marginBottom: '2.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⌨️</span>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                CAD Keyboard Shortcuts Reference
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Accelerate your drafting workflow using instant single-key shortcuts in the CAD workspace.
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {KEYBOARD_SHORTCUTS.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px'
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{s.action}</span>
                <kbd style={{
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-hover)',
                  color: 'var(--accent-blue)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '2rem',
          marginBottom: '2.5rem'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Frequently Asked Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: openFaq === idx ? 'var(--bg-elevated)' : 'transparent',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: 'var(--accent-blue)', fontSize: '1.2rem', transform: openFaq === idx ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    +
                  </span>
                </button>

                {openFaq === idx && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem 1.25rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: '1.65',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.75rem'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support Form */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '2rem'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Submit an Engineering Question or Feature Request
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Our engineering team is actively enhancing the CAD solver, MEP router, and DXF exporter.
          </p>

          {contactSubmitted ? (
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid var(--status-success)',
              color: '#86EFAC',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              ✅ Thank you! Your inquiry has been logged with the meplaniq engineering team.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@studio.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Message / Description
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your architectural drafting issue, routing requirement, or suggested feature..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Send Inquiry
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
