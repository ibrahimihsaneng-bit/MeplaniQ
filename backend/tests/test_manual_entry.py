import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_project_by_id

client = TestClient(app)


def test_create_project_manual_success():
    init_db()
    payload = {
        "name": "Architectural Studio Loft",
        "rooms": [
            {
                "name": "Main Studio",
                "points": [[0.0, 0.0], [8000.0, 0.0], [8000.0, 6000.0], [0.0, 6000.0]],
                "fillet_radius": 0.0
            },
            {
                "name": "Restroom",
                "points": [[8000.0, 0.0], [11000.0, 0.0], [11000.0, 3000.0], [8000.0, 3000.0]],
                "fillet_radius": 0.0
            }
        ],
        "openings": [
            {
                "id": "D1",
                "type": "Door",
                "host_room": "Main Studio",
                "wall_side": "Bottom",
                "offset_mm": 1500.0,
                "width_mm": 1000.0,
                "height_mm": 2100.0,
                "swing": "Inward-Right"
            },
            {
                "id": "W1",
                "type": "Window",
                "host_room": "Main Studio",
                "wall_side": "Top",
                "offset_mm": 2000.0,
                "width_mm": 1500.0,
                "height_mm": 1200.0,
                "swing": ""
            }
        ],
        "hvac_equipment": [
            {
                "id": "IDU-1",
                "room_name": "Main Studio",
                "unit_type": "Split-IDU",
                "cooling_capacity_tr": 2.5,
                "location_x": 4000.0,
                "location_y": 5800.0,
                "status": "Active"
            }
        ]
    }

    response = client.post("/api/projects/manual", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["project_id"] is not None
    assert data["project_name"] == "Architectural Studio Loft"
    assert len(data["rooms"]) == 2
    assert len(data["wall_polygons"]) > 0
    # Phase 7 Step 1 focuses on shifted rooms and 115mm/230mm walls
    types = [wp["wall_type"] for wp in data["wall_polygons"]]
    assert "interior" in types
    assert "exterior" in types

    # Verify persistent retrieval
    pid = data["project_id"]
    get_resp = client.get(f"/api/projects/{pid}")
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["project_name"] == "Architectural Studio Loft"
    assert len(fetched["rooms"]) == 2

    # Clean up
    del_resp = client.delete(f"/api/projects/{pid}")
    assert del_resp.status_code == 200


def test_create_project_manual_validation():
    init_db()

    # Empty name should fail
    bad_name = {
        "name": "   ",
        "rooms": [{"name": "Room 1", "points": [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]}]
    }
    resp1 = client.post("/api/projects/manual", json=bad_name)
    assert resp1.status_code == 400

    # Empty rooms should fail
    bad_rooms = {
        "name": "No Rooms Plan",
        "rooms": []
    }
    resp2 = client.post("/api/projects/manual", json=bad_rooms)
    assert resp2.status_code == 400
