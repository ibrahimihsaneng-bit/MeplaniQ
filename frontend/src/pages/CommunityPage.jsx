import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalNavbar from '../components/GlobalNavbar';
import GlobalFooter from '../components/GlobalFooter';
import { createManualProject } from '../api';

const COMMUNITY_PLANS = [
  {
    id: 'comm-2bhk-urban',
    title: '2-BHK Contemporary Urban Residence',
    author: 'Studio ArchiForm',
    type: 'Residential',
    areaSqFt: 865,
    areaSqM: 80.4,
    roomsCount: 4,
    openingsCount: 6,
    hvacCount: 3,
    description: 'Optimized 2-bedroom floorplan with 230mm perimeter walls, cross-ventilation window placements, and dual ensuite split-AC layouts.',
    tags: ['2-BHK', 'Apartment', '230mm Walls', 'IBC Compliant'],
    likes: 142,
    planData: {
      name: 'Community: 2-BHK Contemporary Urban',
      rooms: [
        { name: 'Living & Dining', fillet_radius: 0, points: [[0, 0], [6000, 0], [6000, 4200], [0, 4200]] },
        { name: 'Kitchen', fillet_radius: 0, points: [[6000, 0], [9000, 0], [9000, 3000], [6000, 3000]] },
        { name: 'Master Bedroom', fillet_radius: 0, points: [[0, 4200], [4500, 4200], [4500, 8000], [0, 8000]] },
        { name: 'Guest Bedroom', fillet_radius: 0, points: [[4500, 4200], [9000, 4200], [9000, 8000], [4500, 8000]] }
      ],
      openings: [
        { id: 'D-MAIN', type: 'Door', host_room: 'Living & Dining', wall_side: 'Bottom', offset_mm: 300, offset_from_corner: 300, width_mm: 1000, width: 1000, height_mm: 2100, height: 2100, swing: 'Inward-Left', swing_direction: 'Inward-Left' },
        { id: 'D-MBR', type: 'Door', host_room: 'Master Bedroom', wall_side: 'Bottom', offset_mm: 200, offset_from_corner: 200, width_mm: 900, width: 900, height_mm: 2100, height: 2100, swing: 'Inward-Right', swing_direction: 'Inward-Right' },
        { id: 'D-GBR', type: 'Door', host_room: 'Guest Bedroom', wall_side: 'Bottom', offset_mm: 200, offset_from_corner: 200, width_mm: 900, width: 900, height_mm: 2100, height: 2100, swing: 'Inward-Left', swing_direction: 'Inward-Left' },
        { id: 'W-LIV', type: 'Window', host_room: 'Living & Dining', wall_side: 'Top', offset_mm: 1500, offset_from_corner: 1500, width_mm: 1800, width: 1800, height_mm: 1400, height: 1400, swing: 'Inward-Left', swing_direction: 'Inward-Left' }
      ],
      hvac_equipment: [
        { id: 'AC-LIV', room_name: 'Living & Dining', unit_type: 'Split-IDU', cooling_capacity_tr: 2.0, location_x: 3000, location_y: 120 },
        { id: 'AC-MBR', room_name: 'Master Bedroom', unit_type: 'Split-IDU', cooling_capacity_tr: 1.5, location_x: 2250, location_y: 4320 },
        { id: 'AC-GBR', room_name: 'Guest Bedroom', unit_type: 'Split-IDU', cooling_capacity_tr: 1.5, location_x: 6750, location_y: 4320 }
      ]
    }
  },
  {
    id: 'comm-studio-micro',
    title: 'Compact Minimalist Studio Apartment',
    author: 'K. Tanaka BIM Design',
    type: 'Micro-Housing',
    areaSqFt: 420,
    areaSqM: 39.0,
    roomsCount: 2,
    openingsCount: 3,
    hvacCount: 1,
    description: 'High-density micro-unit emphasizing multifunctional living zones, corner bathroom plumbing stack, and compact wardrobe clearances.',
    tags: ['Studio', 'Compact', 'Plumbing Stack', 'Space Saving'],
    likes: 98,
    planData: {
      name: 'Community: Compact Minimalist Studio',
      rooms: [
        { name: 'Studio Living Space', fillet_radius: 0, points: [[0, 0], [5500, 0], [5500, 5000], [0, 5000]] },
        { name: 'Bath & Sanitary Chase', fillet_radius: 0, points: [[5500, 0], [8000, 0], [8000, 2600], [5500, 2600]] }
      ],
      openings: [
        { id: 'D-ENTRY', type: 'Door', host_room: 'Studio Living Space', wall_side: 'Bottom', offset_mm: 300, offset_from_corner: 300, width_mm: 900, width: 900, height_mm: 2100, height: 2100, swing: 'Inward-Left', swing_direction: 'Inward-Left' },
        { id: 'D-BATH', type: 'Door', host_room: 'Bath & Sanitary Chase', wall_side: 'Left', offset_mm: 200, offset_from_corner: 200, width_mm: 750, width: 750, height_mm: 2100, height: 2100, swing: 'Inward-Right', swing_direction: 'Inward-Right' }
      ],
      hvac_equipment: [
        { id: 'AC-STUDIO', room_name: 'Studio Living Space', unit_type: 'Split-IDU', cooling_capacity_tr: 1.5, location_x: 2750, location_y: 120 }
      ]
    }
  },
  {
    id: 'comm-clinic-mep',
    title: 'Outpatient Medical Clinic & MEP Chases',
    author: 'Healthcare Infrastructure Group',
    type: 'Commercial',
    areaSqFt: 1250,
    areaSqM: 116.1,
    roomsCount: 5,
    openingsCount: 8,
    hvacCount: 4,
    description: 'Specialized healthcare floorplan featuring clinical handwash basins, patient examination rooms, and ceiling cassette air handlers with positive pressure zoning.',
    tags: ['Healthcare', 'Clinic', 'Cassette AC', 'Plumbing'],
    likes: 85,
    planData: {
      name: 'Community: Outpatient Medical Clinic',
      rooms: [
        { name: 'Reception & Waiting', fillet_radius: 0, points: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] },
        { name: 'Consultation Room 1', fillet_radius: 0, points: [[6000, 0], [10500, 0], [10500, 4000], [6000, 4000]] },
        { name: 'Consultation Room 2', fillet_radius: 0, points: [[0, 4000], [4500, 4000], [4500, 7500], [0, 7500]] },
        { name: 'Procedure Room', fillet_radius: 0, points: [[4500, 4000], [10500, 4000], [10500, 7500], [4500, 7500]] }
      ],
      openings: [
        { id: 'D-CLINIC-ENT', type: 'Door', host_room: 'Reception & Waiting', wall_side: 'Bottom', offset_mm: 400, offset_from_corner: 400, width_mm: 1200, width: 1200, height_mm: 2100, height: 2100, swing: 'Inward-Left', swing_direction: 'Inward-Left' },
        { id: 'D-EXAM1', type: 'Door', host_room: 'Consultation Room 1', wall_side: 'Left', offset_mm: 200, offset_from_corner: 200, width_mm: 900, width: 900, height_mm: 2100, height: 2100, swing: 'Inward-Right', swing_direction: 'Inward-Right' }
      ],
      hvac_equipment: [
        { id: 'AC-REC', room_name: 'Reception & Waiting', unit_type: 'Cassette-IDU', cooling_capacity_tr: 2.5, location_x: 3000, location_y: 2000 },
        { id: 'AC-PROC', room_name: 'Procedure Room', unit_type: 'Cassette-IDU', cooling_capacity_tr: 3.0, location_x: 7500, location_y: 5750 }
      ]
    }
  },
  {
    id: 'comm-3bhk-duplex',
    title: '3-BHK Executive Villa with Ensuite Plumbing',
    author: 'Vanguard Architects',
    type: 'Luxury Residential',
    areaSqFt: 1820,
    areaSqM: 169.1,
    roomsCount: 6,
    openingsCount: 12,
    hvacCount: 5,
    description: 'Expansive family residence featuring separate wet/dry kitchen zones, 3 luxury ensuite bathrooms with 4-state plumbing auto-routing, and multi-zone split ACs.',
    tags: ['3-BHK', 'Villa', 'Luxury', 'Ensuite Plumbing'],
    likes: 210,
    planData: {
      name: 'Community: 3-BHK Executive Villa',
      rooms: [
        { name: 'Grand Living Hall', fillet_radius: 0, points: [[0, 0], [7500, 0], [7500, 5000], [0, 5000]] },
        { name: 'Dining & Kitchen', fillet_radius: 0, points: [[7500, 0], [12000, 0], [12000, 5000], [7500, 5000]] },
        { name: 'Master Suite', fillet_radius: 0, points: [[0, 5000], [6000, 5000], [6000, 9500], [0, 9500]] },
        { name: 'Bedroom 2', fillet_radius: 0, points: [[6000, 5000], [12000, 5000], [12000, 9500], [6000, 9500]] }
      ],
      openings: [
        { id: 'D-VILLA-ENT', type: 'Door', host_room: 'Grand Living Hall', wall_side: 'Bottom', offset_mm: 500, offset_from_corner: 500, width_mm: 1200, width: 1200, height_mm: 2200, height: 2200, swing: 'Inward-Left', swing_direction: 'Inward-Left' },
        { id: 'D-MSUITE', type: 'Door', host_room: 'Master Suite', wall_side: 'Bottom', offset_mm: 300, offset_from_corner: 300, width_mm: 950, width: 950, height_mm: 2100, height: 2100, swing: 'Inward-Right', swing_direction: 'Inward-Right' }
      ],
      hvac_equipment: [
        { id: 'AC-LIV-GR', room_name: 'Grand Living Hall', unit_type: 'Cassette-IDU', cooling_capacity_tr: 3.0, location_x: 3750, location_y: 2500 },
        { id: 'AC-MS-VIL', room_name: 'Master Suite', unit_type: 'Split-IDU', cooling_capacity_tr: 2.0, location_x: 3000, location_y: 5120 }
      ]
    }
  }
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const [forkingId, setForkingId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [error, setError] = useState(null);

  const handleForkPlan = async (plan) => {
    try {
      setForkingId(plan.id);
      setError(null);
      const forkData = {
        ...plan.planData,
        name: `[Community] ${plan.title}`
      };
      const solved = await createManualProject(forkData);
      if (solved && solved.project_id) {
        navigate(`/projects/${solved.project_id}/cad`);
      } else {
        navigate('/projects');
      }
    } catch (err) {
      console.error('Failed to fork project:', err);
      setError(`Failed to fork project: ${err.message}`);
    } finally {
      setForkingId(null);
    }
  };

  const filteredPlans = filterType === 'All' 
    ? COMMUNITY_PLANS 
    : COMMUNITY_PLANS.filter(p => p.type === filterType || p.tags.includes(filterType));

  return (
    <div style={{ backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '3.5rem 1.5rem', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div>
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
              marginBottom: '0.75rem'
            }}>
              Curated Community Designs
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Architectural Community Gallery
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '0.5rem', maxWidth: '700px' }}>
              Explore, fork, and adapt verified parametric architectural plans. Every template includes 
              pre-calculated wall thicknesses, opening schedules, and MEP equipment.
            </p>
          </div>

          <button
            onClick={() => navigate('/projects')}
            style={{
              backgroundColor: 'var(--accent-blue)',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(47, 128, 237, 0.35)'
            }}
          >
            <span>➕</span>
            <span>Publish Your Plan</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['All', 'Residential', 'Luxury Residential', 'Commercial', 'Micro-Housing'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              style={{
                backgroundColor: filterType === f ? 'var(--accent-blue)' : 'var(--bg-panel)',
                color: filterType === f ? '#FFFFFF' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: filterType === f ? 'var(--accent-blue)' : 'var(--border-subtle)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {f}
            </button>
          ))}
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

        {/* Project Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.75rem'
        }}>
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(47, 128, 237, 0.12)',
                    color: 'var(--accent-blue)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {plan.type}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ❤️ {plan.likes}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {plan.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  by {plan.author}
                </p>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                  {plan.description}
                </p>

                {/* Metrics Pill Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  textAlign: 'center',
                  marginBottom: '1.25rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Carpet Area</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.areaSqFt} sq.ft</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rooms</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.roomsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HVAC Units</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#C084FC' }}>{plan.hvacCount}</div>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {plan.tags.map(t => (
                    <span key={t} style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleForkPlan(plan)}
                disabled={forkingId === plan.id}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--accent-blue)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: forkingId === plan.id ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(47, 128, 237, 0.3)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue)'}
              >
                <span>🍴</span>
                <span>{forkingId === plan.id ? 'Cloning Plan into CAD...' : 'Fork & Open in CAD'}</span>
              </button>
            </div>
          ))}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
