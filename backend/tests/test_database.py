import io
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_all_projects_summary, get_project_by_id, save_project
from backend.geometry import generate_excel_template_bytes

client = TestClient(app)


def test_database_init_and_seed():
    init_db()
    projects = get_all_projects_summary()
    assert len(projects) >= 1
    sample = projects[0]
    assert "id" in sample
    assert "name" in sample
    assert "created_at" in sample


def test_save_and_get_project():
    init_db()
    test_payload = {
        "rooms": [{"name": "Test Room", "points": [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]}]
    }
    saved = save_project("UnitTest Project", test_payload)
    assert saved["id"] is not None
    assert saved["name"] == "UnitTest Project"

    fetched = get_project_by_id(saved["id"])
    assert fetched is not None
    assert fetched["name"] == "UnitTest Project"
    assert fetched["cad_json_data"]["rooms"][0]["name"] == "Test Room"


def test_api_list_projects():
    response = client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "id" in data[0]
    assert "name" in data[0]
    assert "created_at" in data[0]


def test_api_get_project_by_id():
    response = client.get("/api/projects/default-sample-1bhk")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "default-sample-1bhk"
    assert "rooms" in data
    assert "wall_polygons" in data

    # Test invalid project ID returns 404
    missing_resp = client.get("/api/projects/invalid-id-xyz-999")
    assert missing_resp.status_code == 404


def test_api_upload_project():
    excel_bytes = generate_excel_template_bytes()
    file_payload = {
        "file": ("My_Uploaded_House.xlsx", io.BytesIO(excel_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }
    response = client.post("/api/projects", files=file_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] is not None
    assert "My_Uploaded_House" in data["project_name"]
    assert "rooms" in data
    assert len(data["rooms"]) > 0

    # Verify that the newly uploaded project is listed in GET /api/projects
    list_resp = client.get("/api/projects")
    assert list_resp.status_code == 200
    ids = [p["id"] for p in list_resp.json()]
    assert data["project_id"] in ids


def test_delete_project_endpoint():
    # Create project to delete
    saved = save_project("To Be Deleted", {"rooms": []})
    pid = saved["id"]

    # Delete via API
    del_resp = client.delete(f"/api/projects/{pid}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # Confirm not found
    get_resp = client.get(f"/api/projects/{pid}")
    assert get_resp.status_code == 404

    # Delete invalid ID returns 404
    del_invalid = client.delete("/api/projects/non-existent-id")
    assert del_invalid.status_code == 404


def test_update_project_endpoint():
    # Retrieve default seeded project
    get_resp = client.get("/api/projects/default-sample-1bhk")
    assert get_resp.status_code == 200
    project = get_resp.json()
    pid = project["project_id"]

    # Construct modified payload
    update_payload = {
        "name": "Updated Sample Plan",
        "rooms": [
            {
                "name": r["name"],
                "points": r["points"],
                "fillet_radius": 0.0
            }
            for r in project["rooms"]
        ],
        "openings": [
            {
                "id": "D1",
                "type": "Door",
                "host_room": "Living Room",
                "wall_side": "Top",
                "offset_mm": 1500.0,
                "width_mm": 1200.0,
                "height_mm": 2100.0,
                "swing": "Inward-Right"
            }
        ],
        "hvac_equipment": [
            {
                "id": "IDU-1",
                "room_name": "Living Room",
                "unit_type": "Split-IDU",
                "cooling_capacity_tr": 2.5,
                "location_x": 3000.0,
                "location_y": 2500.0,
                "status": "Active"
            }
        ]
    }

    # Execute PUT
    put_resp = client.put(f"/api/projects/{pid}", json=update_payload)
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["project_name"] == "Updated Sample Plan"
    assert len(updated["doors"]) == 1
    assert updated["doors"][0]["width_mm"] == 1200.0
    assert updated["doors"][0]["offset_mm"] == 1500.0
    assert updated["hvac_equipment"][0]["capacity_tr"] == 2.5

    # Verify persistent retrieval
    persisted = client.get(f"/api/projects/{pid}").json()
    assert persisted["project_name"] == "Updated Sample Plan"
    assert persisted["doors"][0]["width_mm"] == 1200.0

    # Test 404 on invalid project ID
    bad_put = client.put("/api/projects/non-existent-xyz", json=update_payload)
    assert bad_put.status_code == 404


def test_rename_project_endpoint():
    init_db()
    saved = save_project("Original Name", {"rooms": []})
    pid = saved["id"]

    resp = client.patch(f"/api/projects/{pid}/rename", json={"name": "Renamed Floorplan"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Floorplan"

    fetched = get_project_by_id(pid)
    assert fetched["name"] == "Renamed Floorplan"

    # Test 404 for invalid ID
    bad_rename = client.patch("/api/projects/invalid-id/rename", json={"name": "Test"})
    assert bad_rename.status_code == 404


def test_duplicate_project_endpoint():
    init_db()
    test_payload = {
        "rooms": [{"name": "Room A", "points": [[0, 0], [2000, 0], [2000, 2000], [0, 2000]]}],
        "hvac_ducts": [{"duct_id": "D-1"}]
    }
    saved = save_project("Source Plan", test_payload)
    pid = saved["id"]

    resp = client.post(f"/api/projects/{pid}/duplicate", json={"name": "Source Plan Cloned"})
    assert resp.status_code == 200
    dup_data = resp.json()
    assert dup_data["id"] != pid
    assert dup_data["name"] == "Source Plan Cloned"

    dup_fetched = get_project_by_id(dup_data["id"])
    assert dup_fetched is not None
    assert len(dup_fetched["cad_json_data"]["rooms"]) == 1
    assert dup_fetched["cad_json_data"]["rooms"][0]["name"] == "Room A"


def test_batch_delete_projects_endpoint():
    init_db()
    p1 = save_project("Batch 1", {"rooms": []})
    p2 = save_project("Batch 2", {"rooms": []})

    resp = client.post("/api/projects/batch-delete", json={"project_ids": [p1["id"], p2["id"]]})
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert resp.json()["deleted_count"] == 2

    assert get_project_by_id(p1["id"]) is None
    assert get_project_by_id(p2["id"]) is None


def test_export_dxf_endpoint():
    init_db()
    resp = client.get("/api/projects/default-sample-1bhk/export-dxf")
    assert resp.status_code == 200
    assert "application/dxf" in resp.headers.get("content-type", "")
    assert len(resp.content) > 100

