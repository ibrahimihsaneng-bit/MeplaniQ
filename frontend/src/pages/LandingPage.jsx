import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalNavbar from '../components/GlobalNavbar';
import GlobalFooter from '../components/GlobalFooter';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      {/* Hero Section */}
      <section style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '5rem 1.5rem 3.5rem 1.5rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Release / Innovation Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 14px',
          borderRadius: '999px',
          backgroundColor: 'rgba(47, 128, 237, 0.1)',
          border: '1px solid rgba(47, 128, 237, 0.3)',
          color: 'var(--accent-blue)',
          fontSize: '0.82rem',
          fontWeight: 600,
          marginBottom: '1.75rem'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></span>
          meplaniq • Computational Architecture &amp; BIM Engineering
        </div>

        {/* Main Headline */}
        <h1 style={{
          fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
          fontWeight: 800,
          lineHeight: '1.12',
          letterSpacing: '-0.035em',
          color: 'var(--text-primary)',
          maxWidth: '960px',
          margin: '0 auto 1.5rem auto'
        }}>
          Parametric Floor Planning &amp; Intelligent MEP Engineering.
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
          maxWidth: '780px',
          margin: '0 auto 2.5rem auto'
        }}>
          Transform architectural sketches into parametric CAD walls, automated 4-state plumbing routes, 
          HVAC heat-load tonnage calculations, and synchronized Excel/DXF schedules in milliseconds.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3.5rem' }}>
          <button
            onClick={() => navigate('/drafting')}
            style={{
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'transform 0.15s ease, background-color 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span>✏️</span>
            <span>AutoCAD Direct Drafter</span>
          </button>

          <button
            onClick={() => navigate('/projects')}
            style={{
              backgroundColor: 'var(--accent-blue)',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(47, 128, 237, 0.4)',
              transition: 'transform 0.15s ease, background-color 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-blue)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span>📐</span>
            <span>Launch CAD Studio</span>
          </button>

          <button
            onClick={() => navigate('/community')}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-panel)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            Browse Community Plans →
          </button>
        </div>

        {/* Interactive CAD Preview Showcase Card */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '1080px',
          margin: '0 auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          textAlign: 'left'
        }}>
          {/* Mock Workbench Window Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }}></span>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }}></span>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E' }}></span>
              <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                meplaniq CAD Workspace • 2-BHK Master Suite (Solved 230mm Wall Offsets)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(46, 204, 113, 0.15)', color: '#2ECC71', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                Drainage: Auto-Routed (Green)
              </span>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0, 191, 255, 0.15)', color: '#00BFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0, 191, 255, 0.3)' }}>
                Supply: Parallel +70mm (Cyan)
              </span>
            </div>
          </div>

          {/* Architectural SVG Drawing Sample */}
          <div style={{
            backgroundColor: '#0F1115',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            height: '380px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="100%" height="100%" viewBox="0 0 900 360" style={{ userSelect: 'none' }}>
              {/* CAD Grid */}
              <defs>
                <pattern id="landingGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1F2633" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#landingGrid)" />

              {/* Room 1: Master Bedroom */}
              <g>
                {/* Wall Exterior */}
                <rect x="80" y="50" width="360" height="260" fill="rgba(30, 41, 59, 0.35)" stroke="#64748B" strokeWidth="6" />
                {/* Wall Interior Offset (230mm) */}
                <rect x="96" y="66" width="328" height="228" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                <text x="260" y="160" textAnchor="middle" fill="#F8FAFC" fontSize="15" fontWeight="700">Master Bedroom</text>
                <text x="260" y="180" textAnchor="middle" fill="#94A3B8" fontSize="12">18.4 m² • 198 sq.ft</text>

                {/* Door Opening & 90° Swing Arc */}
                <path d="M 80 230 A 70 70 0 0 1 150 300" fill="none" stroke="#FACC15" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="80" y1="230" x2="80" y2="300" stroke="#FACC15" strokeWidth="2.5" />
                <text x="105" y="270" fill="#FACC15" fontSize="11" fontWeight="600">D-1 (900mm)</text>

                {/* Split AC Unit */}
                <rect x="200" y="66" width="120" height="26" rx="4" fill="rgba(192, 132, 252, 0.25)" stroke="#C084FC" strokeWidth="1.8" />
                <text x="260" y="83" textAnchor="middle" fill="#E9D5FF" fontSize="10" fontWeight="600">AC-1 (1.5 TR • 600 CFM)</text>
              </g>

              {/* Room 2: Attached Ensuite Bathroom */}
              <g>
                <rect x="460" y="50" width="360" height="260" fill="rgba(15, 23, 42, 0.6)" stroke="#64748B" strokeWidth="6" />
                <rect x="476" y="66" width="328" height="228" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                <text x="640" y="120" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="700">Master Bath &amp; Plumbing Chase</text>
                <text x="640" y="138" textAnchor="middle" fill="#94A3B8" fontSize="11">7.2 m² • 77.5 sq.ft</text>

                {/* Plumbing Fixtures */}
                {/* Wash Basin */}
                <rect x="500" y="80" width="70" height="50" rx="6" fill="rgba(6, 182, 212, 0.2)" stroke="#06B6D4" strokeWidth="2" />
                <text x="535" y="110" textAnchor="middle" fill="#67E8F9" fontSize="10" fontWeight="600">Basin</text>

                {/* Toilet WC */}
                <rect x="620" y="80" width="55" height="75" rx="14" fill="rgba(6, 182, 212, 0.2)" stroke="#06B6D4" strokeWidth="2" />
                <text x="647.5" y="120" textAnchor="middle" fill="#67E8F9" fontSize="10" fontWeight="600">WC</text>

                {/* Shower Enclosure */}
                <rect x="710" y="80" width="75" height="75" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="4 3" />
                <circle cx="747.5" cy="117.5" r="8" fill="rgba(6, 182, 212, 0.3)" stroke="#06B6D4" strokeWidth="1.5" />

                {/* 4-State Synchronized Auto-Routed Plumbing Lines */}
                {/* Main Drainage Trunk (Green) */}
                <line x1="490" y1="260" x2="790" y2="260" stroke="#2ECC71" strokeWidth="3.5" />
                <text x="795" y="264" fill="#2ECC71" fontSize="10" fontWeight="700">MAIN DRAIN RISER</text>

                {/* Main Water Supply Trunk (Cyan) */}
                <line x1="490" y1="240" x2="790" y2="240" stroke="#00BFFF" strokeWidth="2.5" />
                <text x="795" y="244" fill="#00BFFF" fontSize="10" fontWeight="700">COLD WATER RISER</text>

                {/* Basin Branch Runs (L-Shape 90° state) */}
                <path d="M 535 130 L 535 240" stroke="#00BFFF" strokeWidth="2" fill="none" />
                <path d="M 545 130 L 545 260" stroke="#2ECC71" strokeWidth="2.5" fill="none" />
                <circle cx="535" cy="240" r="3" fill="#00BFFF" />
                <circle cx="545" cy="260" r="3.5" fill="#2ECC71" />

                {/* WC Branch Runs (Parallel U-Shape 180° State) */}
                <path d="M 640 155 L 640 240" stroke="#00BFFF" strokeWidth="2" fill="none" />
                <path d="M 655 155 L 655 260" stroke="#2ECC71" strokeWidth="2.5" fill="none" />
                <circle cx="640" cy="240" r="3" fill="#00BFFF" />
                <circle cx="655" cy="260" r="3.5" fill="#2ECC71" />

                {/* Floor Trap (FT) */}
                <circle cx="700" cy="210" r="10" fill="rgba(255, 165, 0, 0.25)" stroke="#FFA500" strokeWidth="2" />
                <path d="M 700 220 L 700 260" stroke="#2ECC71" strokeWidth="2" fill="none" />
                <text x="700" y="200" textAnchor="middle" fill="#FFA500" fontSize="9" fontWeight="700">FT-1</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section style={{
        backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '5rem 1.5rem'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Engineered for Architectural Precision
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto' }}>
              Every calculation in meplaniq is backed by deterministic geometry algorithms, eliminating drafting guesswork and engineering clashes.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.75rem'
          }}>
            {/* Feature 1 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>📐</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Parametric Wall Offsetting
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Computes 230mm structural exterior and 115mm interior partition boundaries, corner fillets, and carpet area calculations automatically.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>🚰</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                4-State Plumbing Auto-Routing
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Intelligent routing for supply &amp; drainage pipes based on fixture rotation (0°, 90°, 180°, 270°) with synchronized parallel lanes and 0 crossovers.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>❄️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                HVAC Load &amp; Copper Routing
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Calculates cooling tonnage (TR), airflow CFM, and connects indoor split or cassette units to outdoor condensing units with insulated line routes.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>📊</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                5-Sheet Bidirectional Excel Sync
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Two-way data binding with Microsoft Excel. Import or export rooms, doors, windows, HVAC, furniture, and plumbing schedules seamlessly.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>📄</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                AutoCAD DXF &amp; BOQ PDF
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Export standard AutoCAD R2018 DXF files with organized layers, printable executive Bill of Quantities PDFs, and 300-DPI high-contrast images.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.75rem'
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>☁️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Cloud Vault &amp; Local Persistence
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Auto-saves every design revision to high-speed SQLite, with one-click cloud backup and remote restoration via Supabase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '5rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '3.5rem 2rem',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Start Designing with Architectural Intelligence
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
            No heavy desktop installations required. Launch the browser-based CAD canvas or choose a pre-configured template.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/projects')}
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Open CAD Studio →
            </button>
            <button
              onClick={() => navigate('/learn')}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Explore Learning Modules
            </button>
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
