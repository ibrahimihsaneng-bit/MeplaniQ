import pytest
from fastapi.testclient import TestClient
from shapely.geometry import Polygon
from backend.main import app
from backend.services.area_to_plan import (
    generate_default_room_program,
    pack_rooms_into_coordinates,
    generate_default_openings,
    generate_and_save_area_plan,
    validate_packed_polygons
)
from backend.database import get_project_by_id

client = TestClient(app)


def test_generate_default_room_program():
    """Verify deterministic area budgeting and room sizing."""
    target_sqft = 1200.0
    program = generate_default_room_program(
        target_area_sqft=target_sqft,
        bedrooms=2,
        bathrooms=2,
        include_kitchen=True,
        include_dining=True,
        include_living=True
    )

    assert len(program) >= 5
    room_names = [r["name"] for r in program]
    assert "Living Room" in room_names
    assert "Master Bedroom" in room_names
    assert "Kitchen" in room_names

    # Check positive dimensions and minimum sizes
    for r in program:
        assert r["width_mm"] >= 1200.0
        assert r["depth_mm"] >= 1200.0
        assert r["area_sqm"] > 0
        assert r["area_sqft"] > 0

    total_net_sqft = sum(r["area_sqft"] for r in program)
    # Net carpet area should be roughly 75% to 95% of gross target area
    assert 0.75 * target_sqft <= total_net_sqft <= 1.05 * target_sqft


def test_pack_rooms_into_coordinates_no_overlap():
    """Verify that packed 2D rooms are valid polygons and never overlap in interior area."""
    program = generate_default_room_program(1500.0, bedrooms=3, bathrooms=2)
    packed_rooms = pack_rooms_into_coordinates(program)

    assert len(packed_rooms) == len(program)

    # Validate with Shapely
    validate_packed_polygons(packed_rooms)

    for i, r1 in enumerate(packed_rooms):
        p1 = Polygon(r1.points)
        assert p1.is_valid
        assert p1.area > 0
        for r2 in packed_rooms[i + 1:]:
            p2 = Polygon(r2.points)
            intersection = p1.intersection(p2)
            assert intersection.area < 1.0, f"Overlap between {r1.name} and {r2.name}"


def test_generate_default_openings():
    """Verify standard doors and windows are created for rooms."""
    program = generate_default_room_program(1200.0)
    packed_rooms = pack_rooms_into_coordinates(program)
    openings = generate_default_openings(packed_rooms)

    assert len(openings) >= 3
    types = [o.type for o in openings]
    assert "Door" in types
    assert "Window" in types


def test_generate_and_save_area_plan_e2e():
    """Verify full end-to-end geometry solve and SQLite persistence."""
    project_name = "Automated Unit Test Villa"
    solved = generate_and_save_area_plan(
        project_name=project_name,
        target_area_sqft=1400.0
    )

    assert solved.project_id is not None
    assert solved.project_name == project_name
    assert len(solved.rooms) > 0
    assert len(solved.combined_wall_polygons) > 0
    assert solved.total_carpet_area_sqm > 0

    # Verify project exists in SQLite database
    persisted = get_project_by_id(solved.project_id)
    assert persisted is not None
    assert persisted["name"] == project_name
    assert "rooms" in persisted["cad_json_data"]


def test_api_area_proposal_endpoint():
    """Verify GET /api/projects/area-program-proposal returns structured room program."""
    resp = client.get("/api/projects/area-program-proposal?target_area_sqft=1250&bedrooms=3&bathrooms=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_area_sqft"] == 1250.0
    assert len(data["rooms"]) >= 5


def test_api_generate_from_area_endpoint():
    """Verify POST /api/projects/generate-from-area creates project and returns CAD payload."""
    payload = {
        "name": "API Generated House",
        "target_area_sqft": 1100.0,
        "rooms": [
            {"name": "Living", "category": "Living", "width_mm": 4200.0, "depth_mm": 3600.0},
            {"name": "Dining", "category": "Dining", "width_mm": 3200.0, "depth_mm": 3000.0},
            {"name": "Kitchen", "category": "Kitchen", "width_mm": 3000.0, "depth_mm": 2700.0},
            {"name": "Bed 1", "category": "Bedroom", "width_mm": 3600.0, "depth_mm": 3300.0},
            {"name": "Bath 1", "category": "Bathroom", "width_mm": 2100.0, "depth_mm": 1500.0}
        ]
    }
    resp = client.post("/api/projects/generate-from-area", json=payload)
    assert resp.status_code == 200
    solved = resp.json()
    assert "project_id" in solved
    assert solved["project_id"] is not None
    assert len(solved["rooms"]) == 5
    assert len(solved["combined_wall_polygons"]) > 0


def test_api_generate_from_area_validation():
    """Verify invalid requests are cleanly rejected."""
    # Negative area
    resp = client.post("/api/projects/generate-from-area", json={"name": "Bad", "target_area_sqft": -50.0})
    assert resp.status_code == 400

    # Empty name
    resp = client.post("/api/projects/generate-from-area", json={"name": "  ", "target_area_sqft": 1000.0})
    assert resp.status_code == 400


def test_all_four_layout_variants_valid():
    """Verify all 4 architectural models pack without overlaps and pass validation."""
    program = generate_default_room_program(1400.0, bedrooms=3, bathrooms=2)
    for variant in range(4):
        packed = pack_rooms_into_coordinates(program, variant=variant)
        assert len(packed) == len(program)
        validate_packed_polygons(packed)


def test_api_switch_variant_endpoint():
    """Verify POST /api/projects/{project_id}/switch-variant cycles models and persists."""
    # 1. Create plan with variant 0
    payload = {
        "name": "Multi-Model Villa",
        "target_area_sqft": 1200.0,
        "layout_variant": 0
    }
    resp = client.post("/api/projects/generate-from-area", json=payload)
    assert resp.status_code == 200
    solved0 = resp.json()
    proj_id = solved0["project_id"]
    assert proj_id is not None

    # 2. Switch to variant 1 (mirrored)
    resp1 = client.post(f"/api/projects/{proj_id}/switch-variant", json={"variant": 1})
    assert resp1.status_code == 200
    solved1 = resp1.json()
    assert len(solved1["rooms"]) == len(solved0["rooms"])

    # 3. Switch to variant 2 (executive front suite)
    resp2 = client.post(f"/api/projects/{proj_id}/switch-variant", json={"variant": 2})
    assert resp2.status_code == 200
    solved2 = resp2.json()
    assert len(solved2["rooms"]) == len(solved0["rooms"])

    # 4. Check persistence in SQLite
    proj = get_project_by_id(proj_id)
    assert proj["cad_json_data"]["layout_variant"] == 2

