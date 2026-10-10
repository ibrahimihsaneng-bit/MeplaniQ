import pytest
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    FurniturePayload,
    FurnitureCAD,
    SolveRequest,
    is_bedroom_room,
    calculate_auto_scaled_bed,
    process_geometry_solve,
    process_geometry_solve_v2,
    MIN_BED_WIDTH,
    MAX_BED_WIDTH,
    MIN_BED_HEIGHT,
    MAX_BED_HEIGHT,
    DOOR_CLEARANCE_BUFFER,
    MIN_WALL_CLEARANCE,
    MIN_FURNITURE_DIMENSION,
    FURNITURE_CATEGORIES,
    FURNITURE_CATALOG,
    get_furniture_category,
    get_default_furniture_dimensions,
    parse_room_furniture_type,
    get_room_furniture_recommendations,
    validate_and_normalize_furniture,
    calculate_furniture_cad
)
from backend.database import get_db_furniture_catalog, get_catalog_item
from backend.dxf_exporter import export_floorplan_to_dxf
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_is_bedroom_room():
    assert is_bedroom_room("Bedroom") is True
    assert is_bedroom_room("Master Bedroom") is True
    assert is_bedroom_room("Guest Bedroom") is True
    assert is_bedroom_room("Bed Room 2") is True
    assert is_bedroom_room("Living Room") is False
    assert is_bedroom_room("Kitchen") is False
    assert is_bedroom_room("Toilet") is False
    assert is_bedroom_room("") is False


def test_calculate_auto_scaled_bed():
    # 5000 x 4000 room
    points = [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]]
    bed = calculate_auto_scaled_bed("Master Bedroom", points)
    assert bed is not None
    assert bed.type == "Bed"
    assert bed.host_room_id == "Master Bedroom"

    # Minor axis = 4000. 28% = 1120. Bounded between 900 and 2000 => 1120.
    # Height = 1120 * 1.35 = 1512, clamped to min 1800 => 1800.
    assert bed.width == 1120.0
    assert bed.height == 1800.0
    # Center = (2500, 2000)
    assert bed.x == 2500.0
    assert bed.y == 2000.0
    # Must fit within 65% of room bounds (5000 * 0.65 = 3250, 4000 * 0.65 = 2600)
    assert bed.width <= 5000.0 * 0.65
    assert bed.height <= 4000.0 * 0.65
    assert bed.clearance_status == "OK"


def test_calculate_auto_scaled_bed_small_room():
    # Very small bedroom 1200 x 1200
    points = [[0.0, 0.0], [1200.0, 0.0], [1200.0, 1200.0], [0.0, 1200.0]]
    bed = calculate_auto_scaled_bed("Kids Bedroom", points)
    assert bed is not None
    # Must not exceed 65% of room dimensions
    assert bed.width <= 1200.0 * 0.65
    assert bed.height <= 1200.0 * 0.65


def test_auto_furniture_generation_in_solve():
    rooms = [
        RoomPayload(name="Living Room", points=[[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Master Bedroom", points=[[6000.0, 0.0], [10000.0, 0.0], [10000.0, 4000.0], [6000.0, 4000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)
    assert hasattr(resp, "furniture")
    assert len(resp.furniture) == 1
    bed = resp.furniture[0]
    assert bed.host_room_id == "Master Bedroom"
    assert bed.type == "Bed"
    assert bed.width >= MIN_BED_WIDTH
    assert bed.height >= MIN_BED_HEIGHT
    assert bed.clearance_status == "OK"


def test_custom_furniture_overrides_and_shifts():
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]])
    ]
    custom_furn = [
        FurniturePayload(
            id="CUSTOM-BED-1",
            type="Bed",
            host_room_id="Master Bedroom",
            width=1800.0,
            height=2100.0,
            x=2000.0,
            y=2000.0,
            rotation=90.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, furniture=custom_furn)
    assert len(resp.furniture) == 1
    bed = resp.furniture[0]
    assert bed.id == "CUSTOM-BED-1"
    assert bed.width == 1800.0
    assert bed.height == 2100.0
    assert bed.rotation == 90.0
    assert bed.clearance_status == "OK"


def test_furniture_door_collision_avoidance():
    # 4000 x 3000 bedroom with a large door on the top wall swinging inward into the center
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [4000.0, 0.0], [4000.0, 3000.0], [0.0, 3000.0]])
    ]
    openings = [
        OpeningPayload(
            id="D1",
            type="Door",
            host_room="Master Bedroom",
            wall_side="Top",
            offset_mm=1400.0,
            width_mm=1000.0,
            height_mm=2100.0,
            swing="Inward-Right"
        )
    ]
    resp = process_geometry_solve_v2(rooms, openings=openings)
    assert len(resp.furniture) == 1
    bed = resp.furniture[0]

    # Door swing reaches y = 3000 - 1000 = 2000mm.
    # Center of room was (2000, 1500). Top of bed at center would be 1500 + 900 = 2400 (overlap with door swing!).
    # Collision solver shifts the bed downwards away from the door swing path:
    assert bed.y < 1500.0  # Shifted down
    # Top of bed must clear door swing plus buffer
    bed_top = bed.y + bed.height / 2.0
    # Door swing sweep goes down to y=2000 - buffer
    assert bed_top <= 2000.0 or bed.x < 1400.0 or bed.x > 2400.0


def test_custom_furniture_collision_warning():
    # Place custom bed directly inside the door swing sweep path
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [4000.0, 0.0], [4000.0, 3000.0], [0.0, 3000.0]])
    ]
    openings = [
        OpeningPayload(
            id="D1",
            type="Door",
            host_room="Master Bedroom",
            wall_side="Top",
            offset_mm=1500.0,
            width_mm=1000.0,
            height_mm=2100.0,
            swing="Inward-Right"
        )
    ]
    custom_furn = [
        FurniturePayload(
            id="COLLIDING-BED",
            type="Bed",
            host_room_id="Master Bedroom",
            width=1600.0,
            height=2000.0,
            x=2000.0,
            y=2300.0,  # Directly in front of the door swing!
            rotation=0.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, openings=openings, furniture=custom_furn)
    assert len(resp.furniture) == 1
    bed = resp.furniture[0]
    assert "Warning" in bed.clearance_status


def test_furniture_wall_clearance():
    # Ensure auto-placed bed maintains >= 200mm padding from room boundary
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)
    bed = resp.furniture[0]
    min_x = bed.x - bed.width / 2.0
    max_x = bed.x + bed.width / 2.0
    min_y = bed.y - bed.height / 2.0
    max_y = bed.y + bed.height / 2.0

    assert min_x >= 200.0
    assert max_x <= 5000.0 - 200.0
    assert min_y >= 200.0
    assert max_y <= 4000.0 - 200.0


def test_furniture_dxf_export():
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]])
    ]
    resp = process_geometry_solve_v2(rooms)
    dxf_bytes = export_floorplan_to_dxf(resp)
    assert len(dxf_bytes) > 0
    dxf_str = dxf_bytes.decode("utf-8")
    assert "LAYER_FURNITURE" in dxf_str


def test_api_manual_project_furniture():
    payload = {
        "name": "Furniture Test Project",
        "rooms": [
            {
                "name": "Master Bedroom",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 0.0
            }
        ],
        "openings": [],
        "hvac_equipment": [],
        "furniture": []
    }
    response = client.post("/api/projects/manual", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "furniture" in data
    assert len(data["furniture"]) >= 1
    assert data["furniture"][0]["type"] == "Bed"
    assert data["furniture"][0]["clearance_status"] == "OK"


def test_furniture_custom_dimensions_update():
    """Verify that editing width and height updates the furniture dimensions accurately."""
    payload = {
        "name": "Custom Dimensions Test",
        "rooms": [
            {
                "name": "Master Bedroom",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 0.0
            }
        ],
        "openings": [],
        "hvac_equipment": [],
        "furniture": [
            {
                "id": "BED-1",
                "type": "Bed",
                "host_room_id": "Master Bedroom",
                "width": 1600.0,
                "height": 2000.0,
                "x": 2500.0,
                "y": 2000.0,
                "rotation": 0.0
            }
        ]
    }
    response = client.post("/api/projects/manual", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["furniture"]) == 1
    bed = data["furniture"][0]
    assert bed["width"] == 1600.0
    assert bed["height"] == 2000.0
    assert bed["x"] == 2500.0
    assert bed["y"] == 2000.0
    assert "1600x2000mm" in bed["label"]
    assert bed["clearance_status"] == "OK"


def test_furniture_catalog_integrity():
    """Verify that all 4 primary room categories + general fallback are properly defined in catalog."""
    assert "Bedroom" in FURNITURE_CATEGORIES
    assert "Living & Lounge" in FURNITURE_CATEGORIES
    assert "Dining Area" in FURNITURE_CATEGORIES
    assert "Study & Office" in FURNITURE_CATEGORIES

    for cat_name, items in FURNITURE_CATEGORIES.items():
        if cat_name != "General":
            assert len(items) >= 3
        else:
            assert len(items) >= 1
        for item in items:
            assert item in FURNITURE_CATALOG
            cat_info = FURNITURE_CATALOG[item]
            assert cat_info["category"] == cat_name
            assert cat_info["default_width"] >= MIN_FURNITURE_DIMENSION
            assert cat_info["default_height"] >= MIN_FURNITURE_DIMENSION
            assert cat_info["min_width"] >= MIN_FURNITURE_DIMENSION
            assert cat_info["min_height"] >= MIN_FURNITURE_DIMENSION

    # Verify SQLite catalog seeding and API endpoint
    db_items = get_db_furniture_catalog()
    assert len(db_items) >= 15
    table_item = get_catalog_item("Dining Table")
    assert table_item is not None
    assert table_item["category"] == "Dining Area"

    # API endpoint GET /api/furniture-catalog
    res = client.get("/api/furniture-catalog")
    assert res.status_code == 200
    api_items = res.json()
    assert len(api_items) >= 15
    assert any(i["name"] == "Sofa Set" for i in api_items)


def test_room_name_parser():
    """Verify room name parsing to appropriate furniture item type and categories."""
    assert parse_room_furniture_type("Master Bedroom") == "Double Bed"
    assert parse_room_furniture_type("Kids Bed Room") == "Single Bed"
    assert parse_room_furniture_type("Living Room") == "Sofa Set"
    assert parse_room_furniture_type("TV Lounge") == "TV Unit"
    assert parse_room_furniture_type("Dining Room") == "Dining Table"
    assert parse_room_furniture_type("Office Study") == "Study Desk"
    assert parse_room_furniture_type("Pantry / Storage") == "Standard Furniture Block"

    # Category matching
    assert get_furniture_category("Double Bed") == "Bedroom"
    assert get_furniture_category("Wardrobe") == "Bedroom"
    assert get_furniture_category("Sofa Set") == "Living & Lounge"
    assert get_furniture_category("Coffee Table") == "Living & Lounge"
    assert get_furniture_category("Dining Table") == "Dining Area"
    assert get_furniture_category("Study Desk") == "Study & Office"
    assert get_furniture_category("Office Chair") == "Study & Office"

    # Recommendations
    recs = get_room_furniture_recommendations("Living Room")
    assert "Sofa Set" in recs
    assert "Coffee Table" in recs


def test_multi_category_custom_furniture_solve():
    """Verify multi-category custom furniture items are solved correctly with category tags and dimensions."""
    rooms = [
        RoomPayload(name="Living Room", points=[[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Dining Room", points=[[6000.0, 0.0], [10000.0, 0.0], [10000.0, 5000.0], [6000.0, 5000.0]]),
        RoomPayload(name="Study Room", points=[[0.0, 5000.0], [5000.0, 5000.0], [5000.0, 9000.0], [0.0, 9000.0]])
    ]
    custom_furniture = [
        FurniturePayload(
            id="SOFA-1",
            type="Sofa Set",
            host_room_id="Living Room",
            width=2200.0,
            height=900.0,
            x=2000.0,
            y=2000.0
        ),
        FurniturePayload(
            id="DINING-1",
            type="Dining Table",
            host_room_id="Dining Room",
            width=1800.0,
            height=900.0,
            x=8000.0,
            y=2500.0
        ),
        FurniturePayload(
            id="DESK-1",
            type="Study Desk",
            host_room_id="Study Room",
            width=1200.0,
            height=600.0,
            x=2000.0,
            y=7000.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, furniture=custom_furniture)
    assert len(resp.furniture) == 3
    sofa = next(f for f in resp.furniture if f.id == "SOFA-1")
    assert sofa.category == "Living & Lounge"
    assert sofa.width == 2200.0
    assert sofa.height == 900.0

    dining = next(f for f in resp.furniture if f.id == "DINING-1")
    assert dining.category == "Dining Area"
    assert dining.width == 1800.0
    assert dining.height == 900.0

    desk = next(f for f in resp.furniture if f.id == "DESK-1")
    assert desk.category == "Study & Office"
    assert desk.width == 1200.0
    assert desk.height == 600.0


def test_dimension_validation_and_fallback():
    """Verify that dimensions < 200mm, non-positive, zero, or invalid cleanly fall back to defaults without raising errors."""
    room_bounds = (0.0, 0.0, 5000.0, 4000.0)

    # 1. Negative width and zero height
    invalid_furn = FurniturePayload(
        id="TEST-1",
        type="Wardrobe",
        host_room_id="Master Bedroom",
        width=-100.0,
        height=0.0,
        x=2000.0,
        y=2000.0
    )
    norm = validate_and_normalize_furniture(invalid_furn, room_bounds)
    assert norm.width >= MIN_FURNITURE_DIMENSION
    assert norm.height >= MIN_FURNITURE_DIMENSION
    # Wardrobe default is 1200x600
    assert norm.width == 1200.0
    assert norm.height == 600.0
    assert norm.category == "Bedroom"

    # 2. Too small (< 200mm)
    tiny_furn = FurniturePayload(
        id="TEST-2",
        type="Dining Table",
        host_room_id="Dining Room",
        width=50.0,
        height=100.0
    )
    norm_tiny = validate_and_normalize_furniture(tiny_furn, room_bounds)
    assert norm_tiny.width == 1500.0  # Default Dining Table width
    assert norm_tiny.height == 900.0  # Default Dining Table height


def test_null_safety_in_api():
    """Verify API handles partial/null values gracefully without 500 crashes."""
    payload = {
        "name": "Null Safety Test",
        "rooms": [
            {
                "name": "Master Bedroom",
                "points": [[0.0, 0.0], [5000.0, 0.0], [5000.0, 4000.0], [0.0, 4000.0]],
                "fillet_radius": 0.0
            }
        ],
        "openings": [],
        "hvac_equipment": [],
        "furniture": [
            {
                "id": None,
                "type": "Wardrobe",
                "host_room_id": None,
                "width": None,
                "height": None,
                "x": None,
                "y": None,
                "rotation": 0.0
            }
        ]
    }
    response = client.post("/api/projects/manual", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["furniture"]) >= 1
    furn = data["furniture"][0]
    assert furn["width"] >= MIN_FURNITURE_DIMENSION
    assert furn["height"] >= MIN_FURNITURE_DIMENSION


def test_furniture_furniture_overlap_detection():
    """Verify that two furniture items placed at overlapping coordinates trigger an overlap warning."""
    rooms = [
        RoomPayload(name="Living Room", points=[[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]])
    ]
    furniture = [
        FurniturePayload(
            id="SOF-1",
            type="Sofa",
            host_room_id="Living Room",
            width=2000.0,
            height=850.0,
            x=3000.0,
            y=2500.0,
            rotation=0.0
        ),
        FurniturePayload(
            id="TBL-1",
            type="Coffee Table",
            host_room_id="Living Room",
            width=1000.0,
            height=600.0,
            x=3000.0,
            y=2600.0,  # Directly overlapping SOF-1
            rotation=0.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, furniture=furniture)
    assert len(resp.furniture) == 2
    f_sof = next(f for f in resp.furniture if f.id == "SOF-1")
    f_tbl = next(f for f in resp.furniture if f.id == "TBL-1")
    assert "Warning" in f_sof.clearance_status
    assert "Overlap" in f_sof.clearance_status
    assert "TBL-1" in f_sof.clearance_status
    assert "Warning" in f_tbl.clearance_status
    assert "Overlap" in f_tbl.clearance_status
    assert "SOF-1" in f_tbl.clearance_status


def test_furniture_wall_collision_warning():
    """Verify that a furniture item extending across the room wall triggers a Wall Collision warning."""
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [4000.0, 0.0], [4000.0, 4000.0], [0.0, 4000.0]])
    ]
    # Wardrobe of 1200x600 placed at x=200.0, y=2000.0 (left edge = -400.0, penetrates left wall)
    furniture = [
        FurniturePayload(
            id="WRB-1",
            type="Wardrobe",
            host_room_id="Master Bedroom",
            width=1200.0,
            height=600.0,
            x=200.0,
            y=2000.0,
            rotation=0.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, furniture=furniture)
    assert len(resp.furniture) == 1
    wrb = resp.furniture[0]
    assert "Warning: Wall Collision" in wrb.clearance_status


def test_furniture_out_of_bounds_clamping():
    """Verify that coordinates placed completely outside room boundary are safely clamped to interior."""
    rooms = [
        RoomPayload(name="Study", points=[[0.0, 0.0], [3000.0, 0.0], [3000.0, 3000.0], [0.0, 3000.0]])
    ]
    # Desk with coordinates placed far outside (x=9999.0, y=-5000.0)
    furniture = [
        FurniturePayload(
            id="DESK-1",
            type="Study Desk",
            host_room_id="Study",
            width=1200.0,
            height=600.0,
            x=9999.0,
            y=-5000.0,
            rotation=0.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, furniture=furniture)
    assert len(resp.furniture) == 1
    desk = resp.furniture[0]
    assert 0.0 <= desk.x <= 3000.0
    assert 0.0 <= desk.y <= 3000.0


def test_furniture_door_blocks_warning():
    """Verify that furniture placed directly inside door swing zone triggers Blocks Door warning."""
    rooms = [
        RoomPayload(name="Master Bedroom", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 5000.0], [0.0, 5000.0]])
    ]
    openings = [
        OpeningPayload(
            id="D-ENT",
            type="Door",
            host_room="Master Bedroom",
            wall_side="Bottom",
            offset_mm=1000.0,
            width_mm=900.0,
            height_mm=2100.0,
            swing="Inward-Right"
        )
    ]
    furniture = [
        FurniturePayload(
            id="BED-1",
            type="Double Bed",
            host_room_id="Master Bedroom",
            width=1800.0,
            height=2000.0,
            x=1450.0,
            y=1000.0,  # Right in front of door swing on bottom wall
            rotation=0.0
        )
    ]
    resp = process_geometry_solve_v2(rooms, openings=openings, furniture=furniture)
    assert len(resp.furniture) == 1
    bed = resp.furniture[0]
    assert "Blocks Door" in bed.clearance_status

