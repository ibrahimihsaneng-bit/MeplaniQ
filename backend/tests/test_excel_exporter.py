import io
import pytest
import openpyxl
from fastapi.testclient import TestClient
from backend.main import app
from backend.excel_exporter import export_project_to_excel
from backend.excel_parser import parse_excel_floorplan
from backend.database import init_db, get_project_by_id

client = TestClient(app)


def test_export_project_to_excel_structure():
    sample_cad_data = {
        "rooms": [
            {
                "name": "Master Suite",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 200.0
            }
        ],
        "doors": [
            {
                "id": "D1",
                "host_room": "Master Suite",
                "wall_side": "Bottom",
                "offset_mm": 1000.0,
                "width_mm": 900.0,
                "height_mm": 2100.0,
                "swing": "Inward-Right"
            }
        ],
        "windows": [
            {
                "id": "W1",
                "host_room": "Master Suite",
                "wall_side": "Top",
                "offset_mm": 1500.0,
                "width_mm": 1200.0,
                "height_mm": 1200.0
            }
        ],
        "hvac_equipment": [
            {
                "id": "IDU-1",
                "room_name": "Master Suite",
                "unit_type": "Split-IDU",
                "capacity_tr": 1.5,
                "x": 2500.0,
                "y": 3800.0,
                "status": "Active"
            }
        ]
    }

    excel_bytes = export_project_to_excel(sample_cad_data, project_name="Master Suite Plan")
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 1000

    # Unified 4-sheet verification
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert wb.sheetnames == [
        "Room Coordinates Payload",
        "Doors and Windows",
        "HVAC Equipment",
        "Furniture Schedule",
        "Plumbing Schedule",
        "Electrical Schedule"
    ]

    # Round-trip verification using the parser
    rooms, openings, hvac = parse_excel_floorplan(excel_bytes)
    assert len(rooms) == 1
    assert rooms[0].name == "Master Suite"
    assert len(rooms[0].points) == 4
    assert rooms[0].fillet_radius == 200.0

    assert len(openings) == 2
    door = next(o for o in openings if o.type == "Door")
    assert door.id == "D1"
    assert door.width_mm == 900.0

    window = next(o for o in openings if o.type == "Window")
    assert window.id == "W1"
    assert window.width_mm == 1200.0

    assert len(hvac) == 1
    assert hvac[0].id == "IDU-1"
    assert hvac[0].cooling_capacity_tr == 1.5


def test_export_excel_api_endpoint():
    init_db()
    # Test on default sample 1bhk
    resp = client.get("/api/projects/default-sample-1bhk/export-excel")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "Sample" in resp.headers["content-disposition"]
    assert resp.headers["content-disposition"].endswith('.xlsx"')

    excel_bytes = resp.content
    rooms, openings, hvac = parse_excel_floorplan(excel_bytes)
    assert len(rooms) >= 1

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert "Furniture Schedule" in wb.sheetnames

    # Test 404 for invalid project ID
    bad_resp = client.get("/api/projects/non-existent-id-12345/export-excel")
    assert bad_resp.status_code == 404


def test_export_excel_furniture_schedule():
    cad_data = {
        "rooms": [{"name": "Bedroom", "points": [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]}],
        "furniture": [
            {"id": "BED-1", "type": "Double Bed", "category": "Bedroom", "host_room_id": "Bedroom", "width": 1800, "height": 2000, "x": 2000, "y": 1500, "rotation": 0, "clearance_status": "Clear (≥200mm)"},
            {"id": "WRB-1", "type": "Wardrobe", "category": "Bedroom", "host_room_id": "Bedroom", "width": 1200, "height": 600, "x": 1000, "y": 500, "rotation": 90, "clearance_status": "Clear (≥200mm)"}
        ]
    }
    excel_bytes = export_project_to_excel(cad_data, project_name="Furn Test")
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert "Furniture Schedule" in wb.sheetnames
    ws = wb["Furniture Schedule"]

    # Verify column headers (Row 2, 7 active columns)
    expected_headers = [
        "Item ID",
        "Type / Category",
        "Host Room",
        "Dimensions (W x H mm)",
        "Coordinates (X, Y)",
        "Rotation",
        "Clearance Status"
    ]
    for col_idx, expected in enumerate(expected_headers, start=1):
        assert ws.cell(row=2, column=col_idx).value == expected

    # Verify Row 3 (BED-1)
    assert ws.cell(row=3, column=1).value == "BED-1"
    assert ws.cell(row=3, column=2).value == "Double Bed / Bedroom"
    assert ws.cell(row=3, column=3).value == "Bedroom"
    assert ws.cell(row=3, column=4).value == "1800 x 2000 mm"
    assert ws.cell(row=3, column=5).value == "(2000.0, 1500.0)"
    assert ws.cell(row=3, column=6).value == "0°"
    assert ws.cell(row=3, column=7).value == "Clear (≥200mm)"

    # Verify Row 4 (WRB-1)
    assert ws.cell(row=4, column=1).value == "WRB-1"
    assert ws.cell(row=4, column=2).value == "Wardrobe / Bedroom"
    assert ws.cell(row=4, column=6).value == "90°"


def test_export_excel_plumbing_schedule():
    cad_data = {
        "rooms": [{"name": "Bathroom", "points": [[0, 0], [2000, 0], [2000, 2000], [0, 2000]]}],
        "plumbing_fixtures": [
            {"id": "WC-1", "type": "WC", "category": "Bathroom fixtures", "host_room_id": "Bathroom", "width": 400, "height": 650, "x": 1000, "y": 500, "connected_to": "PIPE-1"}
        ],
        "plumbing_pipes": [
            {"id": "PIPE-1", "type": "Drainage Pipe", "host_room_id": "Bathroom", "diameter": 110, "path": [[1000, 500], [1000, 0]], "connected_to": "Main Sewer"}
        ]
    }
    excel_bytes = export_project_to_excel(cad_data, project_name="Plumb Test")
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert "Plumbing Schedule" in wb.sheetnames
    ws = wb["Plumbing Schedule"]

    # Verify column headers (Row 2, 7 active columns)
    expected_headers = [
        "Fixture ID",
        "Category / Type",
        "Host Room",
        "Dimensions (W x H mm)",
        "Coordinates (X, Y)",
        "Connection Status",
        "Run Length / Pipe ID"
    ]
    for col_idx, expected in enumerate(expected_headers, start=1):
        assert ws.cell(row=2, column=col_idx).value == expected

    # Verify Row 3 (WC-1)
    assert ws.cell(row=3, column=1).value == "WC-1"
    assert ws.cell(row=3, column=2).value == "Bathroom fixtures / WC"
    assert ws.cell(row=3, column=3).value == "Bathroom"
    assert ws.cell(row=3, column=4).value == "400 x 650 mm"
    assert ws.cell(row=3, column=5).value == "(1000.0, 500.0)"
    assert ws.cell(row=3, column=6).value == "PIPE-1"
    assert ws.cell(row=3, column=7).value == "—"

    # Verify Row 4 (PIPE-1)
    assert ws.cell(row=4, column=1).value == "PIPE-1"
    assert ws.cell(row=4, column=2).value == "Water/Drainage lines / Drainage Pipe"
    assert ws.cell(row=4, column=4).value == "Ø 110 mm"
    assert ws.cell(row=4, column=5).value == "Start: (1000.0, 500.0)"
    assert ws.cell(row=4, column=6).value == "Main Sewer"
    assert ws.cell(row=4, column=7).value == "500.0 mm"


def test_export_excel_empty_state_defensive():
    """Verify that completely empty or undefined schedules render fallback rows without raising Python exceptions."""
    empty_bytes = export_project_to_excel({}, project_name="Blank Plan")
    assert isinstance(empty_bytes, bytes)
    assert len(empty_bytes) > 500

    wb = openpyxl.load_workbook(io.BytesIO(empty_bytes))
    assert len(wb.sheetnames) == 6
    assert wb.sheetnames == [
        "Room Coordinates Payload",
        "Doors and Windows",
        "HVAC Equipment",
        "Furniture Schedule",
        "Plumbing Schedule",
        "Electrical Schedule"
    ]

    # Verify each sheet contains clean fallback indicators
    ws1 = wb["Room Coordinates Payload"]
    assert ws1.cell(row=3, column=1).value == "—"

    ws2 = wb["Doors and Windows"]
    assert "No openings" in str(ws2.cell(row=3, column=3).value)

    ws3 = wb["HVAC Equipment"]
    assert "No HVAC" in str(ws3.cell(row=3, column=2).value)

    ws4 = wb["Furniture Schedule"]
    assert "No furniture" in str(ws4.cell(row=3, column=2).value)

    ws6 = wb["Electrical Schedule"]
    assert "No electrical" in str(ws6.cell(row=3, column=2).value)



def test_export_excel_live_post_endpoint():
    """Verify POST /api/export-excel endpoint returns a valid 4-sheet Excel file from live payload."""
    payload = {
        "project_name": "Penthouse Suite",
        "rooms": [
            {"name": "Living Room", "points": [[0, 0], [6000, 0], [6000, 5000], [0, 5000]], "fillet_radius": 0}
        ],
        "doors": [
            {"id": "D1", "host_room": "Living Room", "wall_side": "Bottom", "offset_mm": 1000, "width_mm": 900, "height_mm": 2100}
        ],
        "hvac_equipment": [
            {"id": "IDU-1", "room_name": "Living Room", "unit_type": "Split-IDU", "capacity_tr": 2.0, "x": 3000, "y": 4500}
        ],
        "furniture": [
            {"id": "SOF-1", "type": "Sofa Set", "category": "Living & Lounge", "host_room_id": "Living Room", "width": 2200, "height": 900, "x": 3000, "y": 2500, "rotation": 0, "clearance_status": "Clear (≥200mm)"}
        ]
    }
    resp = client.post("/api/export-excel", json=payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "Penthouse_Suite_Full_Schedule.xlsx" in resp.headers["content-disposition"]

    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    assert len(wb.sheetnames) == 6
    ws_furn = wb["Furniture Schedule"]
    assert ws_furn.cell(row=3, column=1).value == "SOF-1"
    assert ws_furn.cell(row=3, column=2).value == "Sofa Set / Living & Lounge"


def test_export_json_api_endpoint():
    init_db()
    resp = client.get("/api/projects/default-sample-1bhk/export-json")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    data = resp.json()
    assert data["version"] == "2.0"
    assert "rooms" in data
    assert "furniture" in data
