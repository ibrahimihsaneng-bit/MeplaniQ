import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';

export default function GlobalNavbar() {
  const navigate = useNavigate();

  return (
    <nav className="global-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img 
            src="/logo-meplaniq-dark.svg" 
            alt="meplaniq" 
            style={{ height: '44px', width: '44px', display: 'block', borderRadius: '8px' }} 
          />
          <span style={{ 
            fontSize: '1.15rem', 
            fontWeight: 700, 
            color: 'var(--text-primary)', 
            letterSpacing: '-0.02em',
            lineHeight: 1
          }}>
            meplaniq
          </span>
        </Link>

        <div className="global-nav-links">
          <NavLink 
            to="/" 
            end
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink 
            to="/projects" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            Projects
          </NavLink>
          <NavLink 
            to="/drafting" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ color: '#EF4444', fontWeight: 800 }}>A</span>
            AutoCAD Studio
          </NavLink>
          <NavLink 
            to="/learn" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            Learn
          </NavLink>
          <NavLink 
            to="/community" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            Community
          </NavLink>
          <NavLink 
            to="/about" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            About
          </NavLink>
          <NavLink 
            to="/support" 
            className={({ isActive }) => `global-nav-link ${isActive ? 'active' : ''}`}
          >
            Support
          </NavLink>
        </div>
      </div>

      <div className="global-nav-actions">
        <Link 
          to="/drafting" 
          style={{
            textDecoration: 'none',
            color: '#38BDF8',
            fontSize: '0.875rem',
            padding: '7px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            fontWeight: 600,
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.16)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)'}
        >
          <span>✏️</span>
          <span>AutoCAD Drafter</span>
        </Link>
        <button
          onClick={() => navigate('/projects')}
          style={{
            backgroundColor: 'var(--accent-blue)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(47, 128, 237, 0.35)',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue)'}
        >
          <span>📐</span>
          <span>Launch CAD Studio</span>
        </button>
      </div>
    </nav>
  );
}
