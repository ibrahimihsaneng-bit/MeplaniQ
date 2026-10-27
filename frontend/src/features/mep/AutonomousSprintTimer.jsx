import React, { useState, useEffect } from 'react';

/**
 * AutonomousSprintTimer.jsx
 * =========================
 * Live 24-Hour Autonomous Evolution Engine Timer & Status Indicator.
 * Displays real-time countdown to the next hourly automated engineering update
 * within the 24-hour autonomous development window.
 */
export default function AutonomousSprintTimer({ currentCycle = 23, totalHours = 24 }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const savedTarget = localStorage.getItem('meplaniq_sprint_target');
    const now = Date.now();
    if (savedTarget && Number(savedTarget) > now) {
      return Math.round((Number(savedTarget) - now) / 1000);
    }
    // Default 1 hour cycle (3600 seconds)
    const target = now + 3600 * 1000;
    localStorage.setItem('meplaniq_sprint_target', String(target));
    return 3600;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const savedTarget = localStorage.getItem('meplaniq_sprint_target');
      const now = Date.now();
      if (savedTarget) {
        const diff = Math.round((Number(savedTarget) - now) / 1000);
        if (diff <= 0) {
          // Cycle rolled over, start next 1-hour cycle
          const nextTarget = now + 3600 * 1000;
          localStorage.setItem('meplaniq_sprint_target', String(nextTarget));
          setSecondsLeft(3600);
        } else {
          setSecondsLeft(diff);
        }
      } else {
        const nextTarget = now + 3600 * 1000;
        localStorage.setItem('meplaniq_sprint_target', String(nextTarget));
        setSecondsLeft(3600);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalElapsedHours = Math.min(totalHours, Math.max(1, currentCycle));
  const progressPercent = Math.round((totalElapsedHours / totalHours) * 100);

  return (
    <>
      {/* Third Item in Top Navbar: Prominent Live Autonomous Timer Pill */}
      <div
        onClick={() => setIsModalOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '3px 12px',
          borderRadius: '20px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #10B981',
          color: '#38BDF8',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          userSelect: 'none',
          boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
          transition: 'all 0.2s ease'
        }}
        title="MeplanIQ 24h Autonomous Evolution Engine — Click to view live schedule & hourly roadmap"
      >
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#10B981',
          boxShadow: '0 0 10px #10B981',
          display: 'inline-block',
          animation: 'pulse 1.5s infinite'
        }} />
        <span style={{ color: '#E2E8F0', fontWeight: 700 }}>⏱️ TIMER:</span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          fontWeight: 900,
          color: '#FACC15',
          letterSpacing: '0.04em'
        }}>
          {timeFormatted}
        </span>
        <span style={{ color: '#94A3B8', fontSize: '10px' }}>
          (Cycle {currentCycle}/{totalHours}h)
        </span>
        <span style={{
          backgroundColor: '#065F46',
          color: '#34D399',
          padding: '2px 7px',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 900,
          letterSpacing: '0.04em'
        }}>
          ● RUNNING
        </span>
      </div>

      {/* 24-Hour Autonomous Evolution Status Dialog */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 10, 20, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '560px',
            maxWidth: '92vw',
            color: '#F8FAFC',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>⏱️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#F8FAFC' }}>
                    24-Hour Autonomous Evolution Engine
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>
                    Continuous Autonomous Engineering • Hourly Update Cycles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Progress Tracker */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                  <span style={{ color: '#94A3B8' }}>24-Hour Engineering Window</span>
                  <strong style={{ color: '#38BDF8' }}>Cycle {currentCycle} of {totalHours} Hours ({progressPercent}%)</strong>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: '#10B981',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Next Release Countdown Card */}
              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>NEXT HOURLY AUTO-RELEASE IN</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#FACC15', fontFamily: 'monospace', marginTop: '2px' }}>
                    {timeFormatted}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#065F46',
                    color: '#34D399',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 800
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    24H SPRINT ACTIVE
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    Auto-sprint cycle every 60 minutes
                  </div>
                </div>
              </div>

              {/* Current Cycle Sprints */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#38BDF8' }}>
                  🚀 SPRINT MILESTONE PROGRESSION:
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 23 (Hour 9): Automated Room Space Boundary Detection &amp; 2D Thermal Zone Modeling
                    </span>
                    <span style={{ fontSize: '10px', color: '#34D399', fontWeight: 800 }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Algorithmic space boundary orientation detection (N/S/E/W perimeter vs core), ASHRAE 90.1 envelope U-values, solar heat flux, peak cooling kW, CFM supply airflow sizing &amp; in-canvas 2D load heatmap overlay.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 22 (Hour 8): Native AutoCAD AutoLISP Compiler &amp; Layer Standards Generator (.lsp / .scr)
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Direct compilation of 2D CAD entities into executable Autodesk AutoLISP scripts (.lsp) and command scripts (.scr) conforming to AIA / ISO 13567 CAD layer standards with block definitions, text styles, and dimstyles.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 21 (Hour 7): Automated Multi-Page Architectural &amp; MEP Titleblock Sheet Engine
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Standard ISO 7200 / ANSI Y14.1 titleblock sheets (A1, A0, Arch D), coordinate reference grid (A-F, 1-8), true north compass rose, graphic bar scale (1:50, 1:100), multi-sheet discipline sets (A-101, P-101, M-101, E-101, C-101) &amp; vector PDF print studio.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 20 (Hour 6): Multi-Discipline 2D MEP Clash Detection &amp; Penetration Sleeves
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Real-time geometric collision detection between plumbing pipes, HVAC ductwork, electrical conduits, and structural walls, with automated IBC 714 / NFPA 90A penetration sleeve sizing &amp; in-canvas 45° elevation offset bypasses.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 19 (Hour 5): Continuous Aligned Dimension Strings, Marquee Multi-Select &amp; Room Tagging
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Continuous chained dimension strings (ASME/ISO), window (blue) and crossing (green) multi-selection marquee, and Shoelace polygon centroid &amp; space area tags with ASHRAE 62.1 airflow requirements.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 18 (Hour 4): Electrical Homeruns, Multi-Drop Conduit Routing &amp; Circuit Distribution
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Multi-drop branch conduit routing (Slab, Surface, FMC), terminal junction snaps, angled homerun arrows with 3-conductor tick marks &amp; NEC voltage drop calculations.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 17 (Hour 3): Interactive 2D HVAC Ductwork Routing &amp; Ceiling Diffuser Distribution
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Double-line SMACNA duct routing (Supply/Return/Exhaust/FA), live airflow CFM &amp; velocity FPM engineering HUD, 90° miter elbows, and ceiling diffuser drops with air throw radius rings &amp; flex duct snap takeoffs.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 16 (Hour 2): Interactive 2D Orthogonal Pipe Routing &amp; Fixture Port Snaps
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Multi-system pipe routing (CW, HW, DRAIN, VENT), magnetic fixture port connection snaps, 90° auto-elbows &amp; IPC 704 slope indicators.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 15 (Hour 1): Interactive 2D Wall Drafting &amp; OSNAP Engine
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>✓ COMPLETED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    Interactive rubber-band wall drawing, Ortho 0°/90° lock, magnetic OSNAP glyphs, polygon loop closure &amp; dynamic length/angle HUD.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #38BDF8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                      Cycle 24 (Hour 10): 2D Electrical Load Schedule &amp; Photovoltaic String Array Routing
                    </span>
                    <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 700 }}>NEXT HOUR</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                    NEC Article 220 branch load schedule balancing, rooftop solar photovoltaic module string routing, inverter sizing, and 2D single-line diagram generation.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #64748B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>
                      Cycle 25-30 (Hours 11-24): Multi-Discipline Engineering Automation &amp; BIM Exchange
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>24H ROADMAP</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Automated drawing production, construction schedules, and industry-standard IFC / DWG exchange formats.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #1E293B',
              backgroundColor: '#0A0F1D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#64748B'
            }}>
              <span>MeplanIQ Autonomous Orchestrator • 24h Continuous Operation</span>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
