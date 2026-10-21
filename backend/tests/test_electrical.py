"""
backend/tests/test_electrical.py
================================
Unit and integration tests for the meplaniq Electrical Layout & Routing System.
Tests fixture definitions, circuit topologies, wall snapping, Manhattan wire routing,
persistence in SQLite cad_json_data, and REST API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.electrical.fixtures import (
    ELECTRICAL_FIXTURE_TYPES,
    get_fixture_definition,
    generate_component_id
)
from backend.electrical.circuits import (
    CIRCUIT_CATEGORY_SPECS,
    get_circuit_defaults,
    generate_circuit_id,
    calculate_circuit_load,
    validate_circuit_capacity
)
from backend.electrical.geometry import (
    snap_to_nearest_wall,
    find_host_room,
    compute_polyline_length,
    compute_manhattan_distance
)
from backend.electrical.routing import orthogonal_route, generate_circuit_routes
from backend.electrical.validation import (
    validate_component_data,
    validate_circuit_data,
    validate_wire_route_data
)
from backend.database import init_db, get_all_projects_summary, get_project_by_id

client = TestClient(app)


def setup_module():
    init_db()


def test_fixture_registry_definitions():
    """Verifies that all 16 standard fixtures exist with valid categories, mountings, and wattages."""
    expected_fixtures = [
        "recessed_downlight", "linear_tube_light", "wall_sconce", "chandelier", "outdoor_bulkhead",
        "ceiling_fan", "exhaust_fan",
        "single_switch", "multi_gang_switch", "two_way_switch", "dimmer_switch",
        "main_db",
        "socket_5a", "socket_16a", "ac_isolator_20a", "geyser_switch"
    ]
    for key in expected_fixtures:
        assert key in ELECTRICAL_FIXTURE_TYPES, f"Missing fixture {key}"
        spec = get_fixture_definition(key)
        assert "category" in spec
        assert "mounting" in spec
        assert "default_wattage" in spec
        assert spec["width_mm"] > 0
        assert spec["height_mm"] > 0
        assert "prefix" in spec


def test_component_id_generation():
    """Tests sequential prefix generation for electrical components."""
    existing = ["DL-1", "DL-2", "FAN-1"]
    new_dl = generate_component_id("recessed_downlight", existing)
    assert new_dl == "DL-3"

    new_fan = generate_component_id("ceiling_fan", existing)
    assert new_fan == "FAN-2"

    new_s16 = generate_component_id("socket_16a", existing)
    assert new_s16 == "S16-1"


def test_circuit_specifications_and_load_calc():
    """Tests circuit categories, default breaker sizes, wire sizes, and capacity validation."""
    for cat in ["lighting", "fan", "general_socket", "heavy_socket", "ac_radial", "geyser_radial"]:
        defaults = get_circuit_defaults(cat)
        assert defaults["default_breaker_a"] > 0
        assert defaults["default_wire_gauge_sqmm"] > 0

    components = [
        {"id": "DL-1", "wattage": 12.0},
        {"id": "DL-2", "wattage": 12.0},
        {"id": "FAN-1", "wattage": 75.0}
    ]
    total_w = calculate_circuit_load(components)
    assert total_w == 99.0

    ckt = {"category": "lighting"}
    res = validate_circuit_capacity(ckt, components)
    assert res["status"] == "optimal"
    assert res["total_load_w"] == 99.0


def test_geometry_and_wall_snapping():
    """Tests room boundary wall snapping and normal angle determination."""
    sample_rooms = [
        {
            "id": "R1",
            "name": "Living Room",
            "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]
        }
    ]
    # Point near south wall [2500, 20]
    snapped_x, snapped_y, angle, is_snapped = snap_to_nearest_wall(2500.0, 20.0, sample_rooms, max_snap_distance=200.0)
    assert is_snapped is True
    assert snapped_x == 2500.0
    # Should be offset into room (positive y)
    assert snapped_y > 0.0

    # Point in middle of room [2500, 2000] - should not snap with threshold 200
    mid_x, mid_y, _, mid_snapped = snap_to_nearest_wall(2500.0, 2000.0, sample_rooms, max_snap_distance=200.0)
    assert mid_snapped is False

    # Containment check
    host = find_host_room(2500.0, 2000.0, sample_rooms)
    assert host is not None
    assert host["name"] == "Living Room"


def test_orthogonal_manhattan_routing():
    """Tests orthogonal route generation between points."""
    start = [1000.0, 1000.0]
    end = [3000.0, 2500.0]

    route_x = orthogonal_route(start, end, prefer_x_first=True)
    assert len(route_x) == 3
    assert route_x[0] == [1000.0, 1000.0]
    assert route_x[1] == [3000.0, 1000.0]  # intermediate corner x-first
    assert route_x[2] == [3000.0, 2500.0]

    length = compute_polyline_length(route_x)
    manhattan = compute_manhattan_distance(start, end)
    assert length == manhattan == 3500.0


def test_generate_circuit_routes():
    """Tests daisy-chain routing from DB to switch to connected fixtures."""
    all_components = [
        {"id": "DB-1", "x": 500.0, "y": 500.0},
        {"id": "SW-1", "x": 1000.0, "y": 500.0},
        {"id": "DL-1", "x": 2000.0, "y": 1500.0},
        {"id": "DL-2", "x": 3000.0, "y": 1500.0}
    ]
    circuit = {
        "id": "L-1",
        "category": "lighting",
        "source_db_id": "DB-1",
        "switch_id": "SW-1",
        "connected_component_ids": ["DL-1", "DL-2"]
    }
    routes = generate_circuit_routes(circuit, all_components)
    assert len(routes) == 3  # DB -> SW, SW -> DL-1, DL-1 -> DL-2
    assert routes[0]["from_component_id"] == "DB-1"
    assert routes[0]["to_component_id"] == "SW-1"
    assert routes[1]["from_component_id"] == "SW-1"
    assert routes[1]["to_component_id"] == "DL-1"
    assert routes[2]["from_component_id"] == "DL-1"
    assert routes[2]["to_component_id"] == "DL-2"


def test_electrical_api_crud_and_persistence():
    """Tests full end-to-end electrical REST API endpoints against SQLite database."""
    projects = get_all_projects_summary()
    assert len(projects) > 0, "At least one default project should exist"
    project_id = projects[0]["id"]

    # 1. GET initial layout
    res = client.get(f"/api/projects/{project_id}/electrical")
    assert res.status_code == 200
    data = res.json()
    assert "components" in data
    assert "circuits" in data
    assert "routes" in data
    assert "summary" in data

    # 2. Add Downlight
    comp_payload = {
        "type": "recessed_downlight",
        "x": 2400.0,
        "y": 1800.0,
        "mounting": "ceiling"
    }
    res_comp = client.post(f"/api/projects/{project_id}/electrical/components", json=comp_payload)
    assert res_comp.status_code == 200
    created_comp = res_comp.json()["component"]
    comp_id = created_comp["id"]
    assert comp_id.startswith("DL-")
    assert created_comp["wattage"] == 12.0

    # 3. Add AC Isolator with linked HVAC
    ac_payload = {
        "type": "ac_isolator_20a",
        "x": 3000.0,
        "y": 100.0,
        "mounting": "wall",
        "linked_hvac_id": "HVAC-1"
    }
    res_ac = client.post(f"/api/projects/{project_id}/electrical/components", json=ac_payload)
    assert res_ac.status_code == 200
    ac_comp = res_ac.json()["component"]
    assert ac_comp["linked_hvac_id"] == "HVAC-1"
    assert ac_comp["wattage"] == 2500.0

    # 4. Create Circuit
    ckt_payload = {
        "name": "Master Lighting Circuit",
        "category": "lighting",
        "connected_component_ids": [comp_id]
    }
    res_ckt = client.post(f"/api/projects/{project_id}/electrical/circuits", json=ckt_payload)
    assert res_ckt.status_code == 200
    created_ckt = res_ckt.json()["circuit"]
    ckt_id = created_ckt["id"]
    assert ckt_id.startswith("L-")
    assert created_ckt["total_load_w"] == 12.0

    # 5. Run Auto-Route
    res_route = client.post(f"/api/projects/{project_id}/electrical/auto-route")
    assert res_route.status_code == 200

    # 6. Verify persistence by re-fetching project from SQLite
    db_proj = get_project_by_id(project_id)
    cad = db_proj["cad_json_data"]
    comp_ids = [c["id"] for c in cad.get("electrical_components", [])]
    assert comp_id in comp_ids
    assert ac_comp["id"] in comp_ids

    # 7. Clean up created test components
    del_res = client.delete(f"/api/projects/{project_id}/electrical/components/{comp_id}")
    assert del_res.status_code == 200
    del_ac = client.delete(f"/api/projects/{project_id}/electrical/components/{ac_comp['id']}")
    assert del_ac.status_code == 200
    del_ckt = client.delete(f"/api/projects/{project_id}/electrical/circuits/{ckt_id}")
    assert del_ckt.status_code == 200


def test_project_update_endpoint_preserves_electrical():
    """Verifies that PUT /api/projects/{project_id} preserves and updates electrical data."""
    projects = get_all_projects_summary()
    assert len(projects) > 0
    project_id = projects[0]["id"]
    
    # Send PUT with electrical_components and electrical_circuits
    test_comp = {
        "id": "EL-TEST-1",
        "type": "recessed_downlight",
        "name": "Recessed Downlight",
        "category": "lighting",
        "mounting": "ceiling",
        "wattage": 15.0,
        "x": 2000.0,
        "y": 2000.0,
        "rotation": 90.0,
        "circuit_id": "CKT-TEST-1"
    }
    test_ckt = {
        "id": "CKT-TEST-1",
        "name": "Living Lighting",
        "category": "lighting",
        "breaker_rating_a": 10.0,
        "wire_gauge_sqmm": 1.5,
        "connected_component_ids": ["EL-TEST-1"],
        "total_load_w": 15.0
    }
    
    existing = get_project_by_id(project_id)
    rooms = existing["cad_json_data"].get("rooms", [])
    room_payloads = [{"name": r["name"], "points": r["points"]} for r in rooms]
    
    put_payload = {
        "name": existing.get("name", "Test Project"),
        "rooms": room_payloads,
        "electrical_components": [test_comp],
        "electrical_circuits": [test_ckt],
        "electrical_routes": []
    }
    
    put_res = client.put(f"/api/projects/{project_id}", json=put_payload)
    assert put_res.status_code == 200
    resp_data = put_res.json()
    
    assert "electrical_components" in resp_data
    assert len(resp_data["electrical_components"]) == 1
    assert resp_data["electrical_components"][0]["id"] == "EL-TEST-1"
    assert resp_data["electrical_components"][0]["rotation"] == 90.0
    
    assert "electrical_circuits" in resp_data
    assert len(resp_data["electrical_circuits"]) == 1
    assert resp_data["electrical_circuits"][0]["id"] == "CKT-TEST-1"
    
    # Re-fetch from SQLite to ensure database persistence
    db_proj = get_project_by_id(project_id)
    db_cad = db_proj["cad_json_data"]
    assert len(db_cad.get("electrical_components", [])) == 1
    assert db_cad["electrical_components"][0]["id"] == "EL-TEST-1"
    assert len(db_cad.get("electrical_circuits", [])) == 1
    assert db_cad["electrical_circuits"][0]["id"] == "CKT-TEST-1"


def test_iec60364_voltage_drop_calculation():
    """Verifies IEC 60364-5-52 cable voltage drop calculations and auto-upsizing logic."""
    from backend.electrical.circuits import calculate_voltage_drop, verify_circuit_voltage_drop

    # Normal lighting circuit: 400W, 18m run, 1.5mm2 Cu
    res = calculate_voltage_drop(load_w=400.0, length_m=18.0, wire_gauge_sqmm=1.5)
    assert res["v_drop_percent"] < 3.0
    assert res["v_drop_v"] > 0
    assert res["current_a"] == pytest.approx(2.05, rel=1e-1)

    # Compliant check via verify_circuit_voltage_drop
    check = verify_circuit_voltage_drop({"category": "lighting", "total_load_w": 400.0, "wire_gauge_sqmm": 1.5}, length_m=18.0)
    assert check["is_compliant"] is True
    assert check["upsize_required"] is False
    assert check["recommended_wire_gauge_sqmm"] == 1.5

    # Long high-load circuit exceeding limit -> must recommend upsized conductor
    long_heavy = verify_circuit_voltage_drop(
        {"category": "heavy_socket", "total_load_w": 2800.0, "wire_gauge_sqmm": 2.5},
        length_m=42.0
    )
    # At 2800W / 42m on 2.5mm2 (18 mV/A/m): Vd = (18 * 14.32 * 42) / 1000 = 10.82V = 4.7%
    # On 1.5mm2 (29 mV/A/m): Vd = 17.43V = 7.58% > 5.0%
    exceeding = verify_circuit_voltage_drop(
        {"category": "heavy_socket", "total_load_w": 2800.0, "wire_gauge_sqmm": 1.5},
        length_m=42.0
    )
    assert exceeding["is_compliant"] is False
    assert exceeding["upsize_required"] is True
    assert exceeding["recommended_wire_gauge_sqmm"] >= 2.5

    # Extreme length (65m) requiring 4.0mm2 or larger
    extreme_run = verify_circuit_voltage_drop(
        {"category": "heavy_socket", "total_load_w": 2800.0, "wire_gauge_sqmm": 1.5},
        length_m=65.0
    )
    assert extreme_run["is_compliant"] is False
    assert extreme_run["upsize_required"] is True
    assert extreme_run["recommended_wire_gauge_sqmm"] >= 4.0


