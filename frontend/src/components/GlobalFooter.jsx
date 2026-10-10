import React from 'react';
import { Link } from 'react-router-dom';

export default function GlobalFooter() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-panel)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '3rem 2rem 2rem 2rem',
      marginTop: 'auto',
      color: 'var(--text-secondary)',
      fontSize: '0.875rem'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '2.5rem',
        marginBottom: '2.5rem'
      }}>
        {/* Brand Column */}
        <div>
          <img 
            src="/logo-meplaniq-dark.svg" 
            alt="meplaniq" 
            style={{ height: '44px', width: '44px', marginBottom: '0.5rem', display: 'block', borderRadius: '8px' }} 
          />
          <span style={{ 
            fontSize: '1.1rem', 
            fontWeight: 700, 
            color: 'var(--text-primary)', 
            letterSpacing: '-0.02em',
            display: 'block',
            marginBottom: '0.75rem'
          }}>
            meplaniq
          </span>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Parametric 2D architectural floor planning, mechanical/electrical/plumbing (MEP) auto-routing, and intelligent BIM engineering platform.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              backgroundColor: 'rgba(47, 128, 237, 0.1)',
              color: 'var(--accent-blue)',
              border: '1px solid rgba(47, 128, 237, 0.25)',
              fontWeight: 600
            }}>
              AutoCAD R2018 DXF Ready
            </span>
          </div>
        </div>

        {/* Platform Column */}
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>
            Platform
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <li><Link to="/projects" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Projects Dashboard</Link></li>
            <li><Link to="/learn" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Architectural Lessons</Link></li>
            <li><Link to="/community" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Community Floorplans</Link></li>
            <li><Link to="/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Engineering Docs & Shortcuts</Link></li>
          </ul>
        </div>

        {/* Capabilities */}
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>
            CAD & MEP Capabilities
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
            <li>Parametric 230mm & 115mm Wall Offsetting</li>
            <li>Rotation-Aware Plumbing Auto-Routing</li>
            <li>HVAC Heat Load Tonnage & Sizing Engine</li>
            <li>AutoCAD DXF & BOQ PDF Exporters</li>
            <li>Bidirectional 5-Sheet Excel Synchronization</li>
          </ul>
        </div>

        {/* Standards & Compliance */}
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>
            Standards & Architecture
          </h4>
          <p style={{ lineHeight: '1.6', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Built in conformance with International Building Code (IBC) door clearances and National Plumbing Code slope and drainage requirements.
          </p>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Engineered with React 18, Vite, Python FastAPI & Shapely.
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <div>
          © {new Date().getFullYear()} meplaniq Platform. All rights reserved. Professional CAD & BIM Suite.
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/about" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>About</Link>
          <Link to="/support" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Support & Documentation</Link>
          <Link to="/community" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Community</Link>
        </div>
      </div>
    </footer>
  );
}
