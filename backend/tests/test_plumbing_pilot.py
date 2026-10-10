import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db
import openpyxl
import io

client = TestClient(app)

def setup_module(module):
    init_db()

def test_plumbing_pilot_project_dry_run():
    """
    Step 2: Pilot Testing & Sample Project Validation.
    Creates a detailed multi-zone pilot project with a Kitchen and a Toilet,
    injects plumbing fixtures and utility pipes, and completely validates the
    unified 5-sheet Excel exporter.
    """
    pilot_payload = {
        "project_name": "Pilot CAD Project - MEP Validation",
        "rooms": [
            {
                "name": "Kitchen",
                "points": [[0, 0], [4000, 0], [4000, 3000], [0, 3000]],
                "fillet_radius": 0
            },
            {
                "name": "Toilet",
                "points": [[4000, 0], [6000, 0], [6000, 2000], [4000, 2000]],
                "fillet_radius": 0
            }
        ],
        "plumbing_fixtures": [
            # Kitchen Fixtures
            {
                "id": "KS-01",
                "type": "Kitchen Sink",
                "category": "Kitchen & Utility",
                "host_room_id": "Kitchen",
                "width": 800,
                "height": 600,
                "x": 1000,
                "y": 2800,
                "connected_to": "DRN-KITCHEN"
            },
            {
                "id": "WM-01",
                "type": "Washing Machine",
                "category": "Kitchen & Utility",
                "host_room_id": "Kitchen",
                "width": 600,
                "height": 600,
                "x": 2000,
                "y": 2800,
                "connected_to": "DRN-KITCHEN"
            },
            # Toilet Fixtures
            {
                "id": "WC-01",
                "type": "WC",
                "category": "Bathroom Fixtures",
                "host_room_id": "Toilet",
                "width": 400,
                "height": 700,
                "x": 4500,
                "y": 1800,
                "connected_to": "DRN-MAIN-110"
            },
            {
                "id": "SHW-01",
                "type": "Shower",
                "category": "Bathroom Fixtures",
                "host_room_id": "Toilet",
                "width": 900,
                "height": 900,
                "x": 5500,
                "y": 500,
                "connected_to": "DRN-MAIN-110"
            },
            {
                "id": "BSN-01",
                "type": "Wash Basin",
                "category": "Bathroom Fixtures",
                "host_room_id": "Toilet",
                "width": 600,
                "height": 500,
                "x": 4500,
                "y": 500,
                "connected_to": "DRN-MAIN-110"
            }
        ],
        "plumbing_pipes": [
            {
                "id": "DRN-KITCHEN",
                "type": "Drainage Pipe",
                "host_room_id": "Kitchen",
                "diameter": 50,
                "path": [[1000, 2800], [2000, 2800], [4000, 2800]],
                "connected_to": "DRN-MAIN-110"
            },
            {
                "id": "DRN-MAIN-110",
                "type": "Drainage Pipe",
                "host_room_id": "Toilet",
                "diameter": 110,
                "path": [[4000, 2800], [4500, 1800], [4500, 0]],
                "connected_to": "City Sewer"
            },
            {
                "id": "WTR-SUPPLY-25",
                "type": "Water Supply Pipe",
                "host_room_id": "Toilet",
                "diameter": 25,
                "path": [[4000, -1000], [4500, 500]],
                "connected_to": "Main Water Line"
            }
        ]
    }

    # 1. Export the live pilot payload
    resp = client.post("/api/export-excel", json=pilot_payload)
    assert resp.status_code == 200, "Failed to export Excel workbook for pilot project"
    assert "Pilot_CAD_Project_-_MEP_Validation_Full_Schedule.xlsx" in resp.headers["content-disposition"]

    # 2. Inspect Excel Sheet Structure (6-Sheet Complete Roundtrip Architecture)
    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    assert wb.sheetnames == [
        "Room Coordinates Payload",
        "Doors and Windows",
        "HVAC Equipment",
        "Furniture Schedule",
        "Plumbing Schedule",
        "Electrical Schedule"
    ]

    # 3. Validate Plumbing & Sanitary Output Data
    ws_plumbing = wb["Plumbing Schedule"]
    
    # Identify row counts (Headers + 5 fixtures + 3 pipes)
    # The fixture list will take up rows 3 to 7
    assert ws_plumbing.cell(row=3, column=1).value == "KS-01"
    assert ws_plumbing.cell(row=3, column=2).value == "Kitchen & Utility / Kitchen Sink"
    assert ws_plumbing.cell(row=3, column=3).value == "Kitchen"
    assert ws_plumbing.cell(row=3, column=6).value == "DRN-KITCHEN"

    assert ws_plumbing.cell(row=4, column=1).value == "WM-01"
    assert ws_plumbing.cell(row=5, column=1).value == "WC-01"
    assert ws_plumbing.cell(row=6, column=1).value == "SHW-01"
    assert ws_plumbing.cell(row=7, column=1).value == "BSN-01"
    
    # The pipes take up rows 8 to 10
    assert ws_plumbing.cell(row=8, column=1).value == "DRN-KITCHEN"
    assert ws_plumbing.cell(row=8, column=4).value == "Ø 50 mm"
    # DRN-KITCHEN run length: [1000, 2800] -> [2000, 2800] (1000) -> [4000, 2800] (2000) = 3000 mm
    assert ws_plumbing.cell(row=8, column=7).value == "3000.0 mm"
    
    assert ws_plumbing.cell(row=9, column=1).value == "DRN-MAIN-110"
    assert ws_plumbing.cell(row=9, column=4).value == "Ø 110 mm"
    
    assert ws_plumbing.cell(row=10, column=1).value == "WTR-SUPPLY-25"
    assert ws_plumbing.cell(row=10, column=2).value == "Water/Drainage lines / Water Supply Pipe"
    assert ws_plumbing.cell(row=10, column=4).value == "Ø 25 mm"

def test_defensive_plumbing_payloads():
    """
    Validates that missing coordinate fields, corrupted inputs, or empty arrays
    are gracefully handled by safe_float / safe_str handlers without crashing.
    """
    defensive_payload = {
        "project_name": "Defensive Validation",
        "rooms": [],
        "plumbing_fixtures": [
            {
                "id": None,
                "type": 123, # Corrupt string
                "category": None,
                "width": "NaN",
                "height": None,
                "x": "corrupt_data",
                "y": None
            }
        ],
        "plumbing_pipes": [
            {
                "diameter": "invalid_diameter",
                "path": "Not an array"
            }
        ]
    }
    
    resp = client.post("/api/export-excel", json=defensive_payload)
    assert resp.status_code == 200, "Defensive payload crashed the endpoint"
    
    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    ws_plumbing = wb["Plumbing Schedule"]
    
    # 0.0 defaults should be applied
    assert ws_plumbing.cell(row=3, column=5).value == "(0.0, 0.0)"
