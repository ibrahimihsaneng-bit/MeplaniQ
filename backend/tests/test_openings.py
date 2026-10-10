import pytest
from shapely.geometry import Polygon
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    process_geometry_solve,
    generate_excel_template_bytes,
    DEFAULT_TEST_PAYLOAD,
    DEFAULT_TEST_OPENINGS
)
from backend.excel_parser import parse_excel_floorplan


def test_default_openings_solving():
    """Verify default room layout and openings generate valid door arcs and window symbols."""
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]

    solution = process_geometry_solve(rooms, openings)

    assert len(solution.doors) == 1
    assert len(solution.windows) == 2

    d1 = solution.doors[0]
    assert d1.id == "D1"
    assert d1.host_room == "Living Room"
    assert d1.width_mm == 900.0
    assert d1.arc_path.startswith("M")
    assert "A 900.0 900.0" in d1.arc_path
    assert len(d1.jambs) == 2

    w1 = next(w for w in solution.windows if w.id == "W1")
    assert w1.width_mm == 1200.0
    assert len(w1.lines) == 3  # Inner frame, center glass, outer sill
    assert len(w1.jambs) == 2


def test_multi_sheet_excel_template_parsing():
    """Verify multi-sheet template parsing reads both rooms and doors/windows."""
    template_bytes = generate_excel_template_bytes()
    rooms, openings, *rest = parse_excel_floorplan(template_bytes)

    assert len(rooms) == 2
    assert len(openings) == 3

    d1 = next(o for o in openings if o.id == "D1")
    assert d1.type == "Door"
    assert d1.wall_side == "Top"
    assert d1.offset_mm == 1000.0
    assert d1.width_mm == 900.0
    assert d1.swing == "Inward-Right"

    w1 = next(o for o in openings if o.id == "W1")
    assert w1.type == "Window"
    assert w1.wall_side == "Right"
    assert w1.offset_mm == 1500.0
    assert w1.width_mm == 1200.0


def test_door_swing_orientations():
    """Verify door leaf ends and swing arcs strictly orient for all 4 swing directions."""
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]

    swings = ["Inward-Right", "Inward-Left", "Outward-Right", "Outward-Left"]
    for s in swings:
        openings = [
            OpeningPayload(
                id=f"D-{s}",
                type="Door",
                host_room="Living Room",
                wall_side="Top",
                offset_mm=1000.0,
                width_mm=900.0,
                swing=s
            )
        ]
        sol = process_geometry_solve(rooms, openings)
        assert len(sol.doors) == 1
        door = sol.doors[0]
        assert door.swing == s
        assert door.hinge != door.leaf_end
        assert door.arc_path.startswith("M")


def test_boolean_wall_cutouts():
    """Verify wall opening cutouts subtract from wall polygons."""
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    
    # Solve without openings
    sol_no_op = process_geometry_solve(rooms, None)
    
    # Solve with door and windows
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
    sol_with_op = process_geometry_solve(rooms, openings)

    # Doors & windows should subtract area from combined wall mesh
    wall_area_no_op = sum(Polygon(w.outer_polygon).area for w in sol_no_op.wall_polygons)
    wall_area_with_op = sum(Polygon(w.outer_polygon).area for w in sol_with_op.wall_polygons)

    assert wall_area_with_op < wall_area_no_op
