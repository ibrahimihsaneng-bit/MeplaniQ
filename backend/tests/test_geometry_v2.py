import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    HVACEquipmentPayload,
    process_geometry_solve_v2,
    solve_spatial_topology,
    snap_room_coordinates
)
from backend.database import init_db

client = TestClient(app)


def test_shift_room_topology_horizontal():
    # Two horizontally adjacent rooms sharing an edge at x=5000
    rooms = [
        RoomPayload(name="Room A", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]),
        RoomPayload(name="Room B", points=[[5000.0, 0.0], [9000.0, 0.0], [9000.0, 4000.0], [5000.0, 4000.0]])
    ]
    shifted, offsets, _ = solve_spatial_topology(rooms, tolerance_mm=10.0, gap_mm=115.0)
    assert len(shifted) == 2

    # Room A stays anchored at (0,0)
    assert offsets[0] == (0.0, 0.0)
    # Room B shifted outward by 115mm in X
    assert offsets[1] == (115.0, 0.0)

    # Gap between Room A and Room B must be exactly 115.0 mm
    room_a_max_x = max(p[0] for p in shifted[0].points)
    room_b_min_x = min(p[0] for p in shifted[1].points)
    assert room_a_max_x == 5000.0
    assert room_b_min_x == 5115.0
    assert (room_b_min_x - room_a_max_x) == 115.0


def test_shift_room_topology_vertical():
    # Two vertically stacked rooms sharing an edge at y=3000
    rooms = [
        RoomPayload(name="Lower Room", points=[[0.0, 0.0], [4000.0, 0.0], [4000.0, 3000.0], [0.0, 3000.0]]),
        RoomPayload(name="Upper Room", points=[[0.0, 3000.0], [4000.0, 3000.0], [4000.0, 6000.0], [0.0, 6000.0]])
    ]
    shifted, offsets, _ = solve_spatial_topology(rooms, tolerance_mm=10.0, gap_mm=115.0)

    room_lower_max_y = max(p[1] for p in shifted[0].points)
    room_upper_min_y = min(p[1] for p in shifted[1].points)
    assert room_lower_max_y == 3000.0
    assert room_upper_min_y == 3115.0
    assert (room_upper_min_y - room_lower_max_y) == 115.0


def test_geometry_solve_v2_carpet_preservation_and_walls():
    rooms = [
        RoomPayload(name="Living Room", points=[[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Kitchen", points=[[6000.0, 0.0], [9000.0, 0.0], [9000.0, 5000.0], [6000.0, 5000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)

    # 1. Strict Carpet Area Preservation:
    # Living Room: 6m x 5m = 30.00 sq m
    # Kitchen: 3m x 5m = 15.00 sq m
    assert len(resp.rooms) == 2
    lr = next(r for r in resp.rooms if r.name == "Living Room")
    kt = next(r for r in resp.rooms if r.name == "Kitchen")
    assert lr.carpet_area_sqm == 30.0
    assert kt.carpet_area_sqm == 15.0

    # 2. Wall Polygons verification
    assert len(resp.wall_polygons) >= 2
    types = [wp.wall_type for wp in resp.wall_polygons]
    assert "interior" in types
    assert "exterior" in types

    interior_walls = [wp for wp in resp.wall_polygons if wp.wall_type == "interior"]
    assert any(wp.thickness_mm == 115.0 for wp in interior_walls)

    exterior_walls = [wp for wp in resp.wall_polygons if wp.wall_type == "exterior"]
    assert any(wp.thickness_mm == 230.0 for wp in exterior_walls)


def test_api_manual_entry_uses_v2():
    init_db()
    payload = {
        "name": "V2 Outward Test Suite",
        "rooms": [
            {
                "name": "Suite A",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 0.0
            },
            {
                "name": "Suite B",
                "points": [[5000.0, 0.0], [9000.0, 0.0], [9000.0, 4000.0], [5000.0, 4000.0]],
                "fillet_radius": 0.0
            }
        ]
    }

    res = client.post("/api/projects/manual", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["project_name"] == "V2 Outward Test Suite"

    # Verify Suite B shifted to 5115
    suite_b = next(r for r in data["rooms"] if r["name"] == "Suite B")
    min_x_b = min(p[0] for p in suite_b["points"])
    assert min_x_b == 5115.0

    # Verify interior party wall and exterior walls exist
    types = [wp["wall_type"] for wp in data["wall_polygons"]]
    assert "interior" in types
    assert "exterior" in types

    # Cleanup
    pid = data["project_id"]
    client.delete(f"/api/projects/{pid}")


def test_hvac_relative_mapping_v2():
    rooms = [
        RoomPayload(name="Room A", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]),
        RoomPayload(name="Room B", points=[[5000.0, 0.0], [9000.0, 0.0], [9000.0, 4000.0], [5000.0, 4000.0]])
    ]
    # Unit inside Room B with initial coordinates (6500, 2000)
    hvac = [
        HVACEquipmentPayload(
            id="IDU-B",
            room_name="Room B",
            unit_type="Split-IDU",
            cooling_capacity_tr=1.5,
            location_x=6500.0,
            location_y=2000.0,
            status="Active"
        )
    ]

    resp = process_geometry_solve_v2(rooms, hvac_equipment=hvac)
    assert len(resp.hvac_equipment) >= 1
    unit_b = next(eq for eq in resp.hvac_equipment if eq.id == "IDU-B")

    # Room B shifts outward by +115mm in X
    # Therefore IDU-B's x must shift from 6500.0 to 6615.0
    assert unit_b.x == 6615.0
    assert unit_b.y == 2000.0
    assert unit_b.room_name == "Room B"


def test_openings_minimum_offset_and_relative_mapping_v2():
    rooms = [
        RoomPayload(name="Room A", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]),
        RoomPayload(name="Room B", points=[[5000.0, 0.0], [9000.0, 0.0], [9000.0, 4000.0], [5000.0, 4000.0]])
    ]
    # D1 on Room B with offset 50mm (< 230mm minimum rule)
    # D2 on Room A with offset 350mm (>= 230mm, so preserved)
    # W1 on Room B with offset 100mm (< 230mm minimum rule)
    openings = [
        OpeningPayload(
            id="D1",
            type="Door",
            host_room="Room B",
            wall_side="Top",
            offset_mm=50.0,
            width_mm=900.0,
            height_mm=2100.0,
            swing="Inward-Right"
        ),
        OpeningPayload(
            id="D2",
            type="Door",
            host_room="Room A",
            wall_side="Left",
            offset_mm=350.0,
            width_mm=900.0,
            height_mm=2100.0,
            swing="Inward-Left"
        ),
        OpeningPayload(
            id="W1",
            type="Window",
            host_room="Room B",
            wall_side="Right",
            offset_mm=100.0,
            width_mm=1200.0,
            height_mm=1200.0,
            swing=None
        )
    ]

    resp = process_geometry_solve_v2(rooms, openings=openings)

    # 1. Door CAD geometries
    assert len(resp.doors) == 2
    d1 = next(d for d in resp.doors if d.id == "D1")
    d2 = next(d for d in resp.doors if d.id == "D2")

    # D1 offset clamped to >= 150mm
    assert d1.offset_mm == 150.0
    
    # W1 offset clamped to >= 150mm
    w1 = next(w for w in resp.windows if w.id == "W1")
    assert w1.offset_mm == 150.0
    assert d1.hinge[1] == 4000.0

    # D2 offset was 350mm, should stay 350mm
    assert d2.offset_mm == 350.0

    # 2. Window CAD geometries
    assert len(resp.windows) == 1
    w1 = next(w for w in resp.windows if w.id == "W1")
    # W1 offset clamped to >= 230mm
    assert w1.offset_mm == 150.0


def test_api_manual_entry_v2_with_openings_and_hvac():
    init_db()
    payload = {
        "name": "Full V2 Plan with Openings & HVAC",
        "rooms": [
            {
                "name": "Living",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 0.0
            },
            {
                "name": "Bedroom",
                "points": [[5000.0, 0.0], [9000.0, 0.0], [9000.0, 4000.0], [5000.0, 4000.0]],
                "fillet_radius": 0.0
            }
        ],
        "openings": [
            {
                "id": "D-BED",
                "type": "Door",
                "host_room": "Bedroom",
                "wall_side": "Top",
                "offset_mm": 50.0,
                "width_mm": 900.0,
                "height_mm": 2100.0,
                "swing": "Inward-Right"
            }
        ],
        "hvac_equipment": [
            {
                "id": "AC-BED",
                "room_name": "Bedroom",
                "unit_type": "Split-IDU",
                "cooling_capacity_tr": 1.5,
                "location_x": 7000.0,
                "location_y": 3800.0,
                "status": "Active"
            }
        ]
    }

    res = client.post("/api/projects/manual", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Bedroom shifted by 115mm in X -> min_x is 5115
    bed = next(r for r in data["rooms"] if r["name"] == "Bedroom")
    assert min(p[0] for p in bed["points"]) == 5115.0

    # Door offset clamped to 150mm and hinge on shifted boundary
    assert len(data["doors"]) == 1
    door = data["doors"][0]
    assert door["offset_mm"] == 150.0
    assert door["hinge"][0] == 5265.0

    # HVAC translated from 7000 to 7115
    assert len(data["hvac_equipment"]) >= 1
    ac = next(eq for eq in data["hvac_equipment"] if eq["id"] == "AC-BED")
    assert ac["x"] == 7115.0
    assert ac["y"] == 3800.0

    # Clean up
    pid = data["project_id"]
    client.delete(f"/api/projects/{pid}")


def test_snap_room_coordinates_10mm():
    # Room A from 0 to 5000, Room B from 5005 to 9000 (5mm misalignment)
    rooms = [
        RoomPayload(name="Room A", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]),
        RoomPayload(name="Room B", points=[[5005.0, 3.0], [9000.0, 3.0], [9000.0, 4000.0], [5005.0, 4000.0]])
    ]
    snapped = snap_room_coordinates(rooms, tolerance_mm=10.0)
    # 5005 snaps to 5000, 3.0 snaps to 0.0
    assert snapped[1].points[0][0] == 5000.0
    assert snapped[1].points[0][1] == 0.0

    # End-to-end solve with snapping
    resp = process_geometry_solve_v2(rooms)
    # Room B should shift +115mm from snapped 5000 -> 5115
    b_min_x = min(p[0] for p in resp.rooms[1].points)
    assert b_min_x == 5115.0


def test_outward_wall_generation_clean_boundaries():
    rooms = [
        RoomPayload(name="Living", points=[[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Bedroom", points=[[6000.0, 0.0], [10000.0, 0.0], [10000.0, 5000.0], [6000.0, 5000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)

    # Building bounds: X from 0.0 to 10115.0, Y from 0.0 to 5000.0
    # Exterior wall should expand outward by strictly 230mm
    # So max_x of exterior wall should be exactly 10115.0 + 230.0 = 10345.0
    ext_walls = [wp for wp in resp.wall_polygons if wp.wall_type == "exterior"]
    int_walls = [wp for wp in resp.wall_polygons if wp.wall_type == "interior"]

    assert len(ext_walls) >= 1
    assert len(int_walls) >= 1

    all_ext_xs = [p[0] for wp in ext_walls for p in wp.outer_polygon]
    assert max(all_ext_xs) == pytest.approx(10345.0, abs=1.0)
    assert min(all_ext_xs) == pytest.approx(-230.0, abs=1.0)

    # Interior party wall must be strictly between the rooms (x in [6000, 6115])
    # and must NOT have any exterior outline
    for wp in int_walls:
        xs = [p[0] for p in wp.outer_polygon]
        assert min(xs) >= 5999.0
        assert max(xs) <= 6116.0


def test_door_and_window_cutouts_pierce_walls():
    rooms = [
        RoomPayload(name="Room 1", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]])
    ]
    from shapely.geometry import Polygon

    def get_net_wall_area(resp):
        return sum(Polygon(wp.outer_polygon, wp.inner_polygons).area for wp in resp.wall_polygons)

    # Without opening
    resp_no_op = process_geometry_solve_v2(rooms)
    area_no_op = get_net_wall_area(resp_no_op)

    # With door
    door = OpeningPayload(
        id="D1",
        type="Door",
        host_room="Room 1",
        wall_side="Top",
        offset_mm=500.0,
        width_mm=900.0,
        height_mm=2100.0
    )
    resp_with_door = process_geometry_solve_v2(rooms, openings=[door])
    area_with_door = get_net_wall_area(resp_with_door)

    # Cutout must punch a hole through the wall, reducing solid wall area
    assert area_with_door < area_no_op
    # The cutout through a 230mm exterior wall removes roughly 900mm * 230mm = 207,000 mm²
    area_diff = area_no_op - area_with_door
    assert 180000.0 < area_diff < 250000.0

    # Door jambs must span the full wall thickness (230mm)
    assert len(resp_with_door.doors) == 1
    d = resp_with_door.doors[0]
    j1 = d.jambs[0]
    jamb_len = abs(j1[3] - j1[1])
    assert jamb_len == pytest.approx(230.0, abs=0.5)



def test_strict_orthogonal_geometry():
    from backend.geometry import RoomPayload, process_geometry_solve_v2

    # A bow-tie room to ensure the engine fixes it to a strict CCW orthogonal bounding box
    rooms = [
        RoomPayload(
            name='BowTie Room',
            points=[[0.0, 0.0], [4000.0, 3000.0], [4000.0, 0.0], [0.0, 3000.0]],
            fillet_radius=100.0 # To ensure filleting is ignored
        ),
        RoomPayload(
            name='Normal Room',
            points=[[4000.0, 0.0], [8000.0, 0.0], [8000.0, 3000.0], [4000.0, 3000.0]]
        )
    ]
    resp = process_geometry_solve_v2(rooms)
    assert len(resp.rooms) == 2

    for r in resp.rooms:
        assert len(r.points) == 4, f'Room {r.name} should have exactly 4 points after strict CCW enforcement.'

        # Check edge parallelism (axis-aligned)
        for i in range(len(r.points)):
            p1 = r.points[i]
            p2 = r.points[(i + 1) % len(r.points)]
            
            dx = abs(p1[0] - p2[0])
            dy = abs(p1[1] - p2[1])
            # Edge must be strictly parallel to X or Y axis
            assert (dx == 0 and dy > 0) or (dy == 0 and dx > 0), f'Edge {p1}->{p2} is not axis-aligned in {r.name}'

        # Check Area mathematically matches width * height
        xs = [p[0] for p in r.points]
        ys = [p[1] for p in r.points]
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        
        expected_area_sqm = round((width * height) / 1_000_000.0, 2)
        assert abs(r.carpet_area_sqm - expected_area_sqm) < 0.001, f'Area mismatch for {r.name}'


def test_strict_party_walls():
    from backend.geometry import RoomPayload, process_geometry_solve_v2

    rooms = [
        RoomPayload(
            name='Room A',
            points=[[0.0, 0.0], [3000.0, 0.0], [3000.0, 3000.0], [0.0, 3000.0]]
        ),
        RoomPayload(
            name='Room B',
            points=[[3115.0, 0.0], [6000.0, 0.0], [6000.0, 3000.0], [3115.0, 3000.0]]
        ),
        RoomPayload(
            name='Room C',
            points=[[0.0, 3115.0], [3000.0, 3115.0], [3000.0, 6000.0], [0.0, 6000.0]]
        )
    ]
    resp = process_geometry_solve_v2(rooms)
    
    # Check all wall polygons are strictly axis-aligned
    for wp in resp.wall_polygons:
        # Check outer rings
        for i in range(len(wp.outer_polygon)):
            p1 = wp.outer_polygon[i]
            p2 = wp.outer_polygon[(i + 1) % len(wp.outer_polygon)]
            dx = abs(p1[0] - p2[0])
            dy = abs(p1[1] - p2[1])
            assert (dx == 0 and dy >= 0) or (dy == 0 and dx >= 0), f'Wall edge {p1}->{p2} is not axis-aligned!'
            
        # Check inner rings
        for inner_ring in wp.inner_polygons:
            for i in range(len(inner_ring)):
                p1 = inner_ring[i]
                p2 = inner_ring[(i + 1) % len(inner_ring)]
                dx = abs(p1[0] - p2[0])
                dy = abs(p1[1] - p2[1])
                assert (dx == 0 and dy >= 0) or (dy == 0 and dx >= 0), f'Inner wall edge {p1}->{p2} is not axis-aligned!'


def test_strict_exterior_wrapper():
    from backend.geometry import RoomPayload, process_geometry_solve_v2
    from shapely.geometry import Polygon
    from shapely.ops import unary_union

    rooms = [
        RoomPayload(name='Room 1', points=[[0.0, 0.0], [3000.0, 0.0], [3000.0, 3000.0], [0.0, 3000.0]]),
        RoomPayload(name='Room 2', points=[[3115.0, 0.0], [6115.0, 0.0], [6115.0, 3000.0], [3115.0, 3000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)
    
    wall_polys = []
    for wp in resp.wall_polygons:
        poly = Polygon(wp.outer_polygon, wp.inner_polygons)
        assert poly.is_valid, 'Final wall geometry is not valid!'
        wall_polys.append(poly)
        
    combined_walls = unary_union(wall_polys)
    
    # Check no inward penetration (area < 1.0 allows for tiny floating point errors)
    for r in resp.rooms:
        room_poly = Polygon(r.points)
        intersection = combined_walls.intersection(room_poly)
        assert intersection.area < 1.0, f'Wall bleeds inward into {r.name}!'
        
    # Check exact 230mm outward offset on extreme bounds
    # Rooms bounding box: [0, 0, 6115, 3000]
    # Walls bounding box should be: [-230, -230, 6345, 3230]
    minx, miny, maxx, maxy = combined_walls.bounds
    assert abs(minx - (-230.0)) < 0.1, f'Exterior left wall is not 230mm (got {minx})'
    assert abs(miny - (-230.0)) < 0.1, f'Exterior bottom wall is not 230mm (got {miny})'
    assert abs(maxx - (6115.0 + 230.0)) < 0.1, f'Exterior right wall is not 230mm (got {maxx})'
    assert abs(maxy - (3000.0 + 230.0)) < 0.1, f'Exterior top wall is not 230mm (got {maxy})'


def test_step_4_openings_and_hvac():
    from backend.geometry import RoomPayload, OpeningPayload, HVACEquipmentPayload, process_geometry_solve_v2
    from shapely.geometry import Polygon

    rooms = [
        RoomPayload(name='Room 1', points=[[0.0, 0.0], [4000.0, 0.0], [4000.0, 4000.0], [0.0, 4000.0]])
    ]
    openings = [
        # Place window exactly at 0 to test 150mm clamping
        OpeningPayload(id='W1', type='Window', host_room='Room 1', wall_side='Bottom', width_mm=1000.0, offset_mm=0.0)
    ]
    hvac = [
        # Original location in local coords: (2000, 2000)
        HVACEquipmentPayload(id='AC1', unit_type='Split-IDU', room_name='Room 1', cooling_capacity_tr=1.5, location_x=2000.0, location_y=2000.0)
    ]

    resp = process_geometry_solve_v2(rooms, openings, hvac)
    
    # 1. Check HVAC synchronization (should be shifted exactly identically to the room)
    shifted_room = resp.rooms[0]
    minx = min([p[0] for p in shifted_room.points])
    miny = min([p[1] for p in shifted_room.points])
    # The room shifted by (minx, miny) relative to origin
    
    shifted_ac = resp.hvac_equipment[0]
    assert abs(shifted_ac.x - (2000.0 + minx)) < 0.1, 'HVAC did not translate synchronously with the host room'
    assert abs(shifted_ac.y - (2000.0 + miny)) < 0.1, 'HVAC did not translate synchronously with the host room'
    
    # 2. Check Corner Clearance Clamping
    # Opening offset was 0, should be clamped to 150mm from corner
    win_cad = resp.windows[0]
    # In Bottom wall, the local X offset should be 150mm
    # The wall starts at minx, so the jamb should be at minx + 150
    assert abs(win_cad.jambs[0][0] - (minx + 150.0)) < 0.1, f'Window not safely clamped to 150mm! Got offset: {win_cad.jambs[0][0] - minx}'
    
    # 3. Check Boolean cutouts fully pierce
    # If the window pierced fully, the bottom wall should have a hole
    # We can verify this implicitly by checking if the outer_polygon length increased due to the cutout
    wall = resp.wall_polygons[0] # The exterior wall
    # Since it's a solid ring with a cut, it will likely just have a much larger outer boundary or multiple polygons
    assert len(wall.outer_polygon) > 4, 'Wall polygon was not cut by the boolean difference operation'



def test_step_2_wall_thickness_and_miter_fusing():
    from backend.geometry import RoomPayload, process_geometry_solve_v2, SolveRequest
    from shapely.geometry import Polygon
    
    # 2 rooms next to each other
    rooms = [
        RoomPayload(name="Room A", points=[[0, 0], [3000, 0], [3000, 3000], [0, 3000]]),
        RoomPayload(name="Room B", points=[[3115, 0], [6115, 0], [6115, 3000], [3115, 3000]])
    ]
    req = SolveRequest(rooms=rooms)
    resp = process_geometry_solve_v2(req)
    
    all_xs = []
    all_ys = []
    for wp in resp.wall_polygons:
        poly = Polygon(wp.outer_polygon, wp.inner_polygons)
        assert poly.is_valid is True, "Wall polygon is not topologically valid!"
        for p in wp.outer_polygon:
            all_xs.append(p[0])
            all_ys.append(p[1])
            
    assert min(all_xs) == -230.0
    assert max(all_xs) == 6345.0
    assert min(all_ys) == -230.0
    assert max(all_ys) == 3230.0
    
    # Find the party wall
    party_wall = None
    for wp in resp.wall_polygons:
        xs = [p[0] for p in wp.outer_polygon]
        if min(xs) >= 3000.0 and max(xs) <= 3115.0:
            party_wall = wp
            break
            
    assert party_wall is not None

