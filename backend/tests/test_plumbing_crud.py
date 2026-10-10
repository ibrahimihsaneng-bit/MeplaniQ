import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_plumbing_crud_flow():
    # 1. Create a dummy project
    project_payload = {
        "name": "Plumbing Test Project",
        "rooms": [
            {
                "name": "Bathroom",
                "points": [[0, 0], [3000, 0], [3000, 3000], [0, 3000]]
            }
        ]
    }
    res = client.post("/api/projects/manual", json=project_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    project_id = data["project_id"]
    
    # Verify initial state has no plumbing
    assert "plumbing_fixtures" not in data or len(data["plumbing_fixtures"]) == 0
    
    # 2. Add Plumbing Fixture
    add_fixture_payload = {
        "id": "WC-1",
        "type": "WC",
        "category": "Bathroom",
        "host_room_id": "Bathroom",
        "x": 500,
        "y": 500
    }
    res = client.post(f"/api/projects/{project_id}/plumbing-fixtures", json=add_fixture_payload)
    assert res.status_code == 200, res.text
    added_data = res.json()
    assert added_data["status"] == "success"
    assert added_data["fixture"]["id"] == "WC-1"
    assert added_data["fixture"]["x"] == 500.0
    
    # Fetch project to verify it's saved
    res = client.get(f"/api/projects/{project_id}")
    assert res.status_code == 200
    saved_project = res.json()
    assert len(saved_project["plumbing_fixtures"]) == 1
    assert saved_project["plumbing_fixtures"][0]["id"] == "WC-1"
    
    # 3. Update Plumbing Fixture (partial update)
    update_payload = {
        "x": 1000, # Move it
        "clearance_status": "Warning"
    }
    res = client.put(f"/api/projects/{project_id}/plumbing-fixtures/WC-1", json=update_payload)
    assert res.status_code == 200, res.text
    updated_data = res.json()
    assert updated_data["status"] == "success"
    assert updated_data["fixture"]["x"] == 1000.0
    assert updated_data["fixture"]["y"] == 500.0 # existing field preserved
    assert updated_data["fixture"]["clearance_status"] == "Warning"
    
    # 4. Add Plumbing Pipe
    add_pipe_payload = {
        "id": "PIPE-1",
        "type": "Drainage Pipe",
        "host_room_id": "Bathroom",
        "x": 1000,
        "y": 500,
        "end_x": 1000,
        "end_y": 0,
        "diameter": 110.0
    }
    res = client.post(f"/api/projects/{project_id}/plumbing-pipes", json=add_pipe_payload)
    assert res.status_code == 200, res.text
    added_pipe = res.json()
    assert added_pipe["pipe"]["id"] == "PIPE-1"
    
    # 5. Update Plumbing Pipe
    update_pipe_payload = {
        "diameter": 160.0
    }
    res = client.put(f"/api/projects/{project_id}/plumbing-pipes/PIPE-1", json=update_pipe_payload)
    assert res.status_code == 200, res.text
    updated_pipe = res.json()
    assert updated_pipe["pipe"]["diameter"] == 160.0
    assert updated_pipe["pipe"]["type"] == "Drainage Pipe" # preserved
    
    # 6. Delete Plumbing Pipe
    res = client.delete(f"/api/projects/{project_id}/plumbing-pipes/PIPE-1")
    assert res.status_code == 200, res.text
    
    # 7. Delete Plumbing Fixture
    res = client.delete(f"/api/projects/{project_id}/plumbing-fixtures/WC-1")
    assert res.status_code == 200, res.text
    
    # Fetch project to verify deletion
    res = client.get(f"/api/projects/{project_id}")
    assert res.status_code == 200
    final_project = res.json()
    assert len(final_project.get("plumbing_fixtures", [])) == 0
    assert len(final_project.get("plumbing_pipes", [])) == 0

def test_plumbing_crud_404s():
    # Attempting to update a non-existent project
    res = client.post("/api/projects/invalid-id/plumbing-fixtures", json={"id": "WC-1"})
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
    
    # Create project to test invalid fixture ID
    project_payload = {
        "name": "Plumbing 404 Test",
        "rooms": [{"name": "Room", "points": [[0, 0], [10, 0], [10, 10], [0, 10]]}]
    }
    project_id = client.post("/api/projects/manual", json=project_payload).json()["project_id"]
    
    # Update invalid fixture
    res = client.put(f"/api/projects/{project_id}/plumbing-fixtures/WC-99", json={"x": 0})
    assert res.status_code == 404
    assert "WC-99" in res.json()["detail"]
    
    # Delete invalid fixture
    res = client.delete(f"/api/projects/{project_id}/plumbing-fixtures/WC-99")
    assert res.status_code == 404
    assert "WC-99" in res.json()["detail"]

def test_live_sync_plumbing_export_excel():
    # We want to test POST /api/export-excel with live plumbing data
    payload = {
        "name": "Live Plumbing Export",
        "rooms": [
            {
                "name": "Bathroom",
                "vertex_count": 4,
                "carpet_area_sqm": 9.0,
                "carpet_area_sqft": 96.0,
                "centroid": [1500, 1500],
                "wall_thickness_mm": 230,
                "points": [[0,0], [3000,0], [3000,3000], [0,3000]],
                "filleted_points": []
            }
        ],
        "plumbing_fixtures": [
            {
                "id": "WC-LIVE",
                "type": "WC",
                "category": "Bathroom",
                "host_room_id": "Bathroom",
                "width": 500,
                "height": 500,
                "x": 1000,
                "y": 1000,
                "rotation": 0,
                "clearance_status": "OK"
            }
        ]
    }
    
    # This just ensures it doesn't crash and returns the Excel file
    res = client.post("/api/export-excel", json=payload)
    assert res.status_code == 200
    assert "application/vnd.openxmlformats" in res.headers["content-type"]
