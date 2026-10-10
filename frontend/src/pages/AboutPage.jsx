import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalNavbar from '../components/GlobalNavbar';
import GlobalFooter from '../components/GlobalFooter';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '4rem 1.5rem', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '3.5rem', textAlign: 'center' }}>
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
            Mission &amp; Engineering Philosophy
          </div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.03em' }}>
            Bridging Architecture, CAD Geometry, and MEP Engineering
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.7', maxWidth: '750px', margin: '0 auto' }}>
            meplaniq was created to eliminate the manual, repetitive drafting friction in architectural floor planning, 
            bringing deterministic computational geometry and automated MEP routing directly into the browser.
          </p>
        </div>

        {/* Core Pillars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '4rem' }}>
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '2.25rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              The Problem with Legacy Architectural CAD
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1rem' }}>
              For decades, architects and MEP engineers have worked in silos. Drawing a 2-bedroom floorplan requires 
              manually offsetting wall lines, calculating room square footages, manually checking door swing clearances against furniture, 
              and estimating HVAC tonnage by hand. When room dimensions change, all MEP schedules and CAD drawings must be redrawn from scratch.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              Plumbing pipe clashes and clearance violations are routinely discovered only on the job site during construction, 
              leading to costly field rework and change orders.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '2.25rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Our Architectural Solution
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1rem' }}>
              meplaniq treats buildings as <strong>computational topologies</strong> rather than static collections of lines:
            </p>
            <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              <li><strong>Exact Wall Physics:</strong> 230mm exterior structural envelopes and 115mm partition walls are calculated using polygon normals and vector offsets in Python Shapely.</li>
              <li><strong>Intelligent Rotation Routing:</strong> Rotating a plumbing fixture immediately triggers our 4-state auto-routing engine, establishing parallel, non-crossing supply and drainage runs to the nearest riser stack.</li>
              <li><strong>Continuous Engineering Feedback:</strong> Airflow CFM, HVAC cooling tonnage, and furniture clearance distances update instantaneously as you draw.</li>
              <li><strong>Open Standard Compatibility:</strong> Everything you design exports directly to AutoCAD R2018 DXF with clean CAD layers, executive BOQ PDFs, and 5-sheet synchronized Excel workbooks.</li>
            </ul>
          </div>

          {/* Who is meplaniq for */}
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '2.25rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              Who meplaniq is Built For
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>
                  Architects &amp; Draftsmen
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  Quickly draft schematic floor plans, generate parametric interior layouts, and export clean AutoCAD DXFs without manual offsetting.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2ECC71', marginBottom: '0.5rem' }}>
                  MEP Consultants
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  Validate pipe riser locations, calculate cooling load tonnage (TR) and CFM airflow, and route zero-crossover plumbing runs automatically.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#C084FC', marginBottom: '0.5rem' }}>
                  Interior Designers
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  Ensure furniture placement strictly honors door swing arcs, corridor clearance requirements, and window sill heights.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F59E0B', marginBottom: '0.5rem' }}>
                  BIM Coordinators
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  Maintain 100% two-way data consistency across engineering schedules, spreadsheet inventories, and geometric drawing files.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
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
              boxShadow: '0 4px 14px rgba(47, 128, 237, 0.4)'
            }}
          >
            Launch CAD Studio &amp; Start Designing →
          </button>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
