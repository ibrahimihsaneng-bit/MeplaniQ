import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalNavbar from '../components/GlobalNavbar';
import GlobalFooter from '../components/GlobalFooter';
import { createManualProject } from '../api';

const LESSONS = [
  {
    id: 'lesson-1',
    title: 'Lesson 1: Parametric Wall Offsetting & Wall Thickness Rules',
    category: 'Core Architecture',
    level: 'Beginner',
    summary: 'Master standard exterior structural envelope thickness (230mm) versus interior dividing partition walls (115mm), corner fillets, and gross vs. carpet area calculation.',
    keyPoints: [
      'Exterior load-bearing perimeter walls require 230mm (9-inch) offset.',
      'Interior acoustic and partition walls require 115mm (4.5-inch) offset.',
      'Polygon winding order (counter-clockwise) dictates inward vs. outward wall extrusion.',
      'Fillet radii apply rounded transitions at structural corner junctions.'
    ],
    samplePlan: {
      name: 'Lesson 1: 230mm Wall Offsets Practice',
      rooms: [
        {
          name: 'Living Room',
          fillet_radius: 0,
          points: [[0, 0], [6000, 0], [6000, 4500], [0, 4500]]
        },
        {
          name: 'Dining Space',
          fillet_radius: 0,
          points: [[6000, 0], [9500, 0], [9500, 4500], [6000, 4500]]
        }
      ],
      openings: [],
      hvac_equipment: []
    }
  },
  {
    id: 'lesson-2',
    title: 'Lesson 2: Door Swings, Wall Openings & Clearance Standards',
    category: 'Spatial Planning',
    level: 'Intermediate',
    summary: 'Learn how the CAD engine punches clean cutouts through double wall lines, calculates 90° door swing trajectory arcs, and validates hallway corridor clearances.',
    keyPoints: [
      'Standard residential bedroom doors require a minimum clear width of 900mm.',
      'Bathroom and powder room doors can be sized to 750mm or 800mm.',
      'Corner offset minimum: Leave at least 150mm - 200mm from wall corner for door frame architrave.',
      'Inward-left vs. inward-right swings dictate clearance boundaries for adjacent furniture.'
    ],
    samplePlan: {
      name: 'Lesson 2: Door Swings & Openings Practice',
      rooms: [
        {
          name: 'Master Suite',
          fillet_radius: 0,
          points: [[0, 0], [5000, 0], [5000, 4000], [0, 4000]]
        }
      ],
      openings: [
        {
          id: 'D-ENTRY',
          type: 'Door',
          host_room: 'Master Suite',
          wall_side: 'Bottom',
          offset_mm: 300,
          offset_from_corner: 300,
          width_mm: 900,
          width: 900,
          height_mm: 2100,
          height: 2100,
          swing: 'Inward-Left',
          swing_direction: 'Inward-Left'
        },
        {
          id: 'W-BALCONY',
          type: 'Window',
          host_room: 'Master Suite',
          wall_side: 'Top',
          offset_mm: 1200,
          offset_from_corner: 1200,
          width_mm: 1800,
          width: 1800,
          height_mm: 1500,
          height: 1500,
          swing: 'Inward-Left',
          swing_direction: 'Inward-Left'
        }
      ],
      hvac_equipment: []
    }
  },
  {
    id: 'lesson-3',
    title: 'Lesson 3: HVAC Heat-Load Sizing & Refrigerant Routing',
    category: 'MEP Engineering',
    level: 'Intermediate',
    summary: 'Calculate required cooling tonnage (Tons of Refrigeration, TR) based on room square footage, determine required airflow CFM (TR × 400), and route copper lines to ODUs.',
    keyPoints: [
      'Rule of thumb: 1.0 TR cools roughly 100 - 130 sq.ft of standard ceiling residential space.',
      'Airflow rule: Every 1.0 TR requires 400 CFM of supply air displacement.',
      'Split-IDU wall units should be positioned along short walls to avoid direct draft on beds.',
      'Outdoor Condenser Units (ODU) should be placed on exterior ledges or service balconies.'
    ],
    samplePlan: {
      name: 'Lesson 3: HVAC Tonnage & CFM Practice',
      rooms: [
        {
          name: 'Office Studio',
          fillet_radius: 0,
          points: [[0, 0], [4500, 0], [4500, 3600], [0, 3600]]
        },
        {
          name: 'Balcony Ledge',
          fillet_radius: 0,
          points: [[4500, 0], [6000, 0], [6000, 2000], [4500, 2000]]
        }
      ],
      openings: [],
      hvac_equipment: [
        {
          id: 'AC-STUDIO',
          room_name: 'Office Studio',
          unit_type: 'Split-IDU',
          cooling_capacity_tr: 1.5,
          location_x: 2250,
          location_y: 120
        },
        {
          id: 'ODU-BALCONY',
          room_name: 'Balcony Ledge',
          unit_type: 'Split-ODU',
          cooling_capacity_tr: 1.5,
          location_x: 5250,
          location_y: 500
        }
      ]
    }
  },
  {
    id: 'lesson-4',
    title: 'Lesson 4: 4-State Plumbing Auto-Routing & Riser Logic',
    category: 'MEP Engineering',
    level: 'Advanced',
    summary: 'Understand the deterministic 4-state routing algorithm for supply (cyan) and drainage (green) branch piping based on fixture orientation angle (0°, 90°, 180°, 270°).',
    keyPoints: [
      'State 1 (0°): Ports face trunk directly; routes shortest orthogonal run.',
      'State 2 (90°): Ports face right; routes single L-shape with supply inner (+70mm) and drainage outer (+140mm).',
      'State 3 (270°): Ports face left; routes single L-shape with drainage inner (-70mm) and supply outer (-140mm).',
      'State 4 (180°): Synchronized U-shape wraps around the same flank with zero pipe crossovers.'
    ],
    samplePlan: {
      name: 'Lesson 4: 4-State Plumbing Auto-Routing Practice',
      rooms: [
        {
          name: 'Ensuite Bathroom',
          fillet_radius: 0,
          points: [[0, 0], [3000, 0], [3000, 2400], [0, 2400]]
        }
      ],
      openings: [],
      hvac_equipment: [],
      furniture: [],
      plumbing_fixtures: [
        {
          id: 'PLM-BASIN',
          type: 'Wash Basin',
          category: 'Bathroom',
          host_room_id: 'Ensuite Bathroom',
          x: 600,
          y: 400,
          rotation: 90
        },
        {
          id: 'PLM-WC',
          type: 'Water Closet',
          category: 'Bathroom',
          host_room_id: 'Ensuite Bathroom',
          x: 1800,
          y: 400,
          rotation: 180
        }
      ],
      plumbing_pipes: [
        {
          id: 'PIPE-MAIN-DRAIN',
          type: 'Drainage Pipe',
          x: 400,
          y: 2000,
          end_x: 2800,
          end_y: 2000,
          diameter_mm: 110,
          slope_pct: 1.5
        },
        {
          id: 'PIPE-MAIN-SUPPLY',
          type: 'Water Supply Pipe',
          x: 400,
          y: 1850,
          end_x: 2800,
          end_y: 1850,
          diameter_mm: 25,
          slope_pct: 0
        }
      ]
    }
  },
  {
    id: 'lesson-5',
    title: 'Lesson 5: Bidirectional Excel Integration & BOQ Schedules',
    category: 'BIM & Documentation',
    level: 'Comprehensive',
    summary: 'Coordinate 5 separate architectural disciplines within a single Excel workbook. Learn how spreadsheet edits instantly reflect in CAD, and vice-versa.',
    keyPoints: [
      'Sheet 1: Room Coordinates Payload (Corner coordinates in mm).',
      'Sheet 2: Doors and Windows (Offset from corner, width, height, swing).',
      'Sheet 3: HVAC Equipment (Unit type, TR cooling tonnage, locations).',
      'Sheet 4: Furniture (Category, bounding box, rotation, clearance status).',
      'Sheet 5: Plumbing Fixtures & Branch Piping (Diameter, slope, connection ports).'
    ],
    samplePlan: {
      name: 'Lesson 5: Full BIM Schedule Practice',
      rooms: [
        {
          name: 'Living Room',
          fillet_radius: 0,
          points: [[0, 0], [5000, 0], [5000, 4000], [0, 4000]]
        },
        {
          name: 'Bedroom',
          fillet_radius: 0,
          points: [[5000, 0], [9000, 0], [9000, 4000], [5000, 4000]]
        }
      ],
      openings: [
        {
          id: 'D-MAIN',
          type: 'Door',
          host_room: 'Living Room',
          wall_side: 'Bottom',
          offset_mm: 400,
          offset_from_corner: 400,
          width_mm: 1000,
          width: 1000,
          height_mm: 2100,
          height: 2100,
          swing: 'Inward-Left',
          swing_direction: 'Inward-Left'
        }
      ],
      hvac_equipment: [
        {
          id: 'AC-LIV',
          room_name: 'Living Room',
          unit_type: 'Split-IDU',
          cooling_capacity_tr: 2.0,
          location_x: 2500,
          location_y: 150
        }
      ]
    }
  }
];

export default function LearnPage() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const handlePracticeLesson = async (lesson) => {
    try {
      setLoadingId(lesson.id);
      setError(null);
      const practicePlan = {
        ...lesson.samplePlan,
        name: `[Practice] ${lesson.title.split(':')[0]}: ${lesson.samplePlan.name}`
      };
      const solved = await createManualProject(practicePlan);
      if (solved && solved.project_id) {
        navigate(`/projects/${solved.project_id}/cad`);
      } else {
        navigate('/projects');
      }
    } catch (err) {
      console.error('Failed to create practice project:', err);
      setError(`Error creating practice session: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '3.5rem 1.5rem', width: '100%' }}>
        <div style={{ marginBottom: '3rem' }}>
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
            Curriculum &amp; Interactive Practice
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Learn Architecture &amp; MEP Engineering
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', maxWidth: '780px' }}>
            Interactive computational guides explaining parametric floorplan geometry, building clearances,
            and MEP mechanical systems. Click <strong>"Practice This in CAD"</strong> on any lesson to immediately
            load the geometry into the live CAD editor.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--status-error)',
            color: '#FCA5A5',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {LESSONS.map((lesson, idx) => (
            <div
              key={lesson.id}
              style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(47, 128, 237, 0.12)',
                      color: 'var(--accent-blue)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {lesson.category}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      Level: {lesson.level}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {lesson.title}
                  </h2>
                </div>

                <button
                  onClick={() => handlePracticeLesson(lesson)}
                  disabled={loadingId === lesson.id}
                  style={{
                    backgroundColor: 'var(--accent-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: loadingId === lesson.id ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(47, 128, 237, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue)'}
                >
                  {loadingId === lesson.id ? 'Creating Project...' : '🚀 Practice This in CAD'}
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>
                {lesson.summary}
              </p>

              <div style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.25rem'
              }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                  Key Architectural &amp; MEP Takeaways:
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  {lesson.keyPoints.map((pt, i) => (
                    <li key={i} style={{ marginBottom: '0.35rem' }}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
