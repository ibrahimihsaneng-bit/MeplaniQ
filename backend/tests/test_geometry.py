import pytest
from backend.geometry import (
    RoomPayload,
    process_geometry_solve,
    compute_fillet_points,
    DEFAULT_TEST_PAYLOAD,
    generate_excel_template_bytes
)


def test_default_payload_solving():
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    response = process_geometry_solve(rooms)

    assert len(response.rooms) == 2
    
    living_room = next(r for r in response.rooms if r.name == "Living Room")
    assert living_room.carpet_area_sqm == 30.0
    assert living_room.carpet_area_sqft == 322.9
    assert living_room.centroid == [3000.0, 2500.0]

    corridor = next(r for r in response.rooms if r.name == "L-Shaped Corridor/Balcony")
    assert corridor.carpet_area_sqm > 0
    assert len(response.wall_polygons) > 0
    assert len(response.wall_lines) > 0
    assert len(response.dimensions) >= 3


def test_fillet_arc_generation():
    square_points = [[0.0, 0.0], [1000.0, 0.0], [1000.0, 1000.0], [0.0, 1000.0]]
    filleted = compute_fillet_points(square_points, fillet_radius=100.0, num_arc_segments=8)

    assert len(filleted) == 36
    assert isinstance(filleted[0][0], float)


def test_watertight_wall_union():
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    response = process_geometry_solve(rooms)

    combined_walls = [w for w in response.wall_polygons if w.wall_type == "combined"]
    assert len(combined_walls) > 0
    # Living Room and Corridor will likely merge into a single network with holes
    assert len(combined_walls[0].inner_polygons) > 0


def test_excel_template_generation():
    excel_bytes = generate_excel_template_bytes()
    assert len(excel_bytes) > 0
    # Signature of zip/xlsx file is 'PK'
    assert excel_bytes.startswith(b'PK')
