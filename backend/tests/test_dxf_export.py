import io
import pytest
import ezdxf
from fastapi.testclient import TestClient
from backend.main import app
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    process_geometry_solve,
    DEFAULT_TEST_PAYLOAD,
    DEFAULT_TEST_OPENINGS,
    FurnitureCAD
)
from backend.dxf_exporter import export_floorplan_to_dxf


@pytest.fixture
def solved_floorplan():
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
    return process_geometry_solve(rooms, openings)


def test_dxf_header_and_layers(solved_floorplan):
    """Verify DXF export header unit system ($INSUNITS=4, $MEASUREMENT=1) and AIA layer definitions."""
    dxf_bytes = export_floorplan_to_dxf(solved_floorplan)
    assert dxf_bytes is not None
    assert len(dxf_bytes) > 0

    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))

    # Verify Metric Units
    assert doc.header["$INSUNITS"] == 4      # Millimeters
    assert doc.header["$MEASUREMENT"] == 1   # Metric

    # Verify CAD Layers
    layer_names = [l.dxf.name for l in doc.layers]
    expected_layers = ["LAYER_ROOMS", "LAYER_WALLS", "LAYER_OPENINGS", "LAYER_MEP"]
    for l_name in expected_layers:
        assert l_name in layer_names

    # Check Layer Attributes (Colors & Lineweights)
    wall_extr = doc.layers.get("LAYER_WALLS")
    assert wall_extr.color == 7  # White
    assert wall_extr.dxf.lineweight == 50

    door_layer = doc.layers.get("LAYER_OPENINGS")
    assert door_layer.color == 2  # Yellow

    
    
    

    door_layer = doc.layers.get("LAYER_OPENINGS")
    assert door_layer.color == 2
    assert door_layer.dxf.lineweight == 25

    
    
    

    area_text_layer = doc.layers.get("LAYER_ROOMS")
    assert area_text_layer.color == 3
    assert area_text_layer.dxf.lineweight == 18

    
    
    


def test_dxf_modelspace_entities(solved_floorplan):
    """Verify modelspace contains required entity types (LWPOLYLINE, ARC, LINE, MTEXT)."""
    dxf_bytes = export_floorplan_to_dxf(solved_floorplan)
    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))
    msp = doc.modelspace()

    entity_types = {e.dxftype() for e in msp}
    assert "LWPOLYLINE" in entity_types
    assert "LINE" in entity_types
    assert "ARC" in entity_types
    assert "MTEXT" in entity_types

    # Count LWPOLYLINE wall entities
    polylines = [e for e in msp if e.dxftype() == "LWPOLYLINE" and e.dxf.layer in ("LAYER_WALLS", "LAYER_ROOMS")]
    assert len(polylines) >= 1

    # Check door arcs
    arcs = [e for e in msp if e.dxftype() == "ARC" and e.dxf.layer == "LAYER_OPENINGS"]
    assert len(arcs) == 1
    arc = arcs[0]
    assert arc.dxf.radius == 900.0

    # Check window lines
    glaz_lines = [e for e in msp if e.dxftype() == "LINE" and e.dxf.layer == "LAYER_OPENINGS"]
    assert len(glaz_lines) >= 6  # 2 windows * (3 parallel lines + jambs)

    # Check room area labels and dimension labels
    area_texts = [e for e in msp if e.dxftype() == "MTEXT" and e.dxf.layer == "LAYER_ROOMS"]
    assert len(area_texts) >= 2  # Living Room, Balcony

    dim_texts = [e for e in msp if e.dxftype() == "MTEXT" and e.dxf.layer == "LAYER_ROOMS"]
    assert len(dim_texts) >= 4


def test_export_dxf_endpoint(solved_floorplan):
    """Test POST /api/export-dxf FastAPI endpoint."""
    client = TestClient(app)
    response = client.post("/api/export-dxf", json=solved_floorplan.model_dump())

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/dxf"
    assert "floorplan_export.dxf" in response.headers["content-disposition"]
    
    dxf_bytes = response.content
    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))
    assert doc.header["$INSUNITS"] == 4


def test_dxf_multi_category_furniture_and_heights(solved_floorplan):
    """Verify DXF export correctly renders multi-category furniture items and opening height annotations."""
    # Add multi-category furniture items
    solved_floorplan.furniture = [
        FurnitureCAD(id="WRB-1", type="Wardrobe", host_room_id="Living Room", width=1200.0, height=600.0, x=1500.0, y=1000.0, label="WRB-1", clearance_status="OK", category="Bedroom"),
        FurnitureCAD(id="SOF-1", type="Sofa Set", host_room_id="Living Room", width=2000.0, height=900.0, x=3000.0, y=1500.0, label="SOF-1", clearance_status="OK", category="Living & Lounge"),
        FurnitureCAD(id="DSK-1", type="Study Desk", host_room_id="Living Room", width=1200.0, height=600.0, x=1500.0, y=3000.0, label="DSK-1", clearance_status="OK", category="Study & Office"),
        FurnitureCAD(id="CHR-1", type="Office Chair", host_room_id="Living Room", width=600.0, height=600.0, x=2500.0, y=3000.0, label="CHR-1", clearance_status="OK", category="Study & Office"),
        FurnitureCAD(id="TBL-1", type="Dining Table", host_room_id="Living Room", width=1600.0, height=900.0, x=4500.0, y=3500.0, label="TBL-1", clearance_status="OK", category="Dining Area"),
        FurnitureCAD(id="BED-1", type="Double Bed", host_room_id="Living Room", width=1800.0, height=2000.0, x=4500.0, y=1500.0, label="BED-1", clearance_status="OK", category="Bedroom"),
    ]

    # Ensure opening heights are set
    if solved_floorplan.doors:
        solved_floorplan.doors[0].height_mm = 2100.0
    if solved_floorplan.windows:
        solved_floorplan.windows[0].height_mm = 1200.0

    dxf_bytes = export_floorplan_to_dxf(solved_floorplan)
    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))
    msp = doc.modelspace()

    # Verify LAYER_FURNITURE exists in layers
    layer_names = [l.dxf.name for l in doc.layers]
    assert "LAYER_FURNITURE" in layer_names

    # Verify furniture entities on LAYER_FURNITURE
    furniture_entities = [e for e in msp if e.dxf.layer == "LAYER_FURNITURE"]
    assert len(furniture_entities) > 0

    furn_types = {e.dxftype() for e in furniture_entities}
    # Outer perimeters and table/bed insets use LWPOLYLINE
    assert "LWPOLYLINE" in furn_types
    # Wardrobe rail/seam, Sofa cushions/backrest, Desk pedestal use LINE
    assert "LINE" in furn_types
    # Chair circular cushion, Desk cable grommet use CIRCLE
    assert "CIRCLE" in furn_types
    # Labels use TEXT
    assert "TEXT" in furn_types

    # Verify all furniture item labels appear in TEXT entities
    furn_texts = [e.dxf.text for e in furniture_entities if e.dxftype() == "TEXT"]
    for expected_id in ["WRB-1", "SOF-1", "DSK-1", "CHR-1", "TBL-1", "BED-1"]:
        assert any(expected_id in t for t in furn_texts)

    # Verify opening labels contain height annotations in MTEXT on LAYER_OPENINGS
    opening_texts = [e.text for e in msp if e.dxftype() == "MTEXT" and e.dxf.layer == "LAYER_OPENINGS"]
    assert any("2100mm" in t for t in opening_texts)
    assert any("1200mm" in t for t in opening_texts)
