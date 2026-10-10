import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.area_to_plan import generate_and_save_area_plan
from backend.database import get_project_by_id

client = TestClient(app)


def test_auto_populate_mep_endpoint_e2e():
    """Verify that auto-populating MEP creates electrical, HVAC, and furniture components with routing."""
    # 1. Create a project via area-to-plan
    solved = generate_and_save_area_plan(
        project_name="MEP Automation Test Villa",
        target_area_sqft=1200.0
    )
    project_id = solved.project_id
    assert project_id is not None

    # Verify project has rooms
    project_before = get_project_by_id(project_id)
    cad_before = project_before["cad_json_data"]
    assert len(cad_before["rooms"]) >= 5

    # 2. Call auto-populate-mep endpoint
    payload = {
        "include_electrical": True,
        "include_hvac": True,
        "include_furniture": True,
        "include_plumbing": True,
        "clear_existing": True
    }
    resp = client.post(f"/api/projects/{project_id}/auto-populate-mep", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["status"] == "success"
    assert data["project_id"] == project_id
    populated = data["populated"]

    # Verify components counts
    assert populated["electrical_components_count"] >= 10
    assert populated["circuits_count"] >= 4
    assert populated["conduit_routes_count"] >= 5
    assert populated["hvac_units_count"] >= 2
    assert populated["furniture_items_count"] >= 4
    assert populated["plumbing_fixtures_count"] >= 5
    assert populated["plumbing_pipes_count"] >= 4

    # 3. Verify SQLite persisted data
    project_after = get_project_by_id(project_id)
    cad_after = project_after["cad_json_data"]

    el_comps = cad_after.get("electrical_components", [])
    assert len(el_comps) >= 10

    # Verify distribution board exists
    db_list = [c for c in el_comps if c.get("type") == "distribution_board"]
    assert len(db_list) >= 1

    # Verify ceiling fans exist
    fan_list = [c for c in el_comps if c.get("type") == "ceiling_fan"]
    assert len(fan_list) >= 2

    # Verify downlights exist
    dl_list = [c for c in el_comps if c.get("type") == "recessed_downlight"]
    assert len(dl_list) >= 4

    # Verify HVAC units exist
    hvac_list = cad_after.get("hvac_equipment", [])
    assert len(hvac_list) >= 2
    types = {h.get("unit_type") for h in hvac_list}
    assert "Split-IDU" in types
    assert "ODU" in types

    # Verify wire routes exist
    routes = cad_after.get("electrical_routes", [])
    assert len(routes) >= 5

    # Verify plumbing fixtures exist in SQLite
    plumb_fixtures = cad_after.get("plumbing_fixtures", [])
    assert len(plumb_fixtures) >= 5
    p_types = {p.get("type") for p in plumb_fixtures}
    assert "Water Closet" in p_types
    assert "Wash Basin" in p_types

    # Verify plumbing pipes exist in SQLite
    plumb_pipes = cad_after.get("plumbing_pipes", [])
    assert len(plumb_pipes) >= 4

