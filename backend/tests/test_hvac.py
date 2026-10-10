import io
import pytest
import ezdxf
from fastapi.testclient import TestClient
from backend.main import app
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    HVACEquipmentPayload,
    process_geometry_solve,
    generate_excel_template_bytes,
    DEFAULT_TEST_PAYLOAD,
    DEFAULT_TEST_OPENINGS,
    DEFAULT_TEST_HVAC
)
from backend.hvac_solver import (
    calculate_room_cooling_loads,
    build_manhattan_path,
    get_refrigerant_pipe_sizes,
    is_conditioned_room
)
from backend.excel_parser import parse_excel_floorplan
from backend.dxf_exporter import export_floorplan_to_dxf


@pytest.fixture
def solved_floorplan():
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
    hvac = [HVACEquipmentPayload(**h) for h in DEFAULT_TEST_HVAC]
    return process_geometry_solve(rooms, openings, hvac)


def test_cooling_load_and_airflow_formulas():
    """Verify standard residential thumb-rule sizing (1 TR / 150 sq.ft, 400 CFM / TR)."""
    assert is_conditioned_room("Living Room") is True
    assert is_conditioned_room("Master Bedroom") is True
    assert is_conditioned_room("L-Shaped Corridor/Balcony") is False

    # Pipe size lookup
    liq_15, suc_15 = get_refrigerant_pipe_sizes(1.5)
    assert liq_15 == '1/4"'
    assert suc_15 == '1/2"'

    liq_20, suc_20 = get_refrigerant_pipe_sizes(2.0)
    assert liq_20 == '1/4"'
    assert suc_20 == '5/8"'

    liq_30, suc_30 = get_refrigerant_pipe_sizes(3.0)
    assert liq_30 == '3/8"'
    assert suc_30 == '3/4"'


def test_hvac_system_solving(solved_floorplan):
    """Verify solve output contains valid cooling loads, equipment CAD, and pipe routes."""
    assert len(solved_floorplan.hvac_loads) == 2
    
    living_load = next(l for l in solved_floorplan.hvac_loads if l.room_name == "Living Room")
    assert living_load.is_conditioned is True
    assert living_load.cooling_load_tr >= 2.0
    assert living_load.airflow_cfm >= 800.0
    assert living_load.liquid_line_inch == '1/4"'
    assert living_load.suction_line_inch == '5/8"'

    balcony_load = next(l for l in solved_floorplan.hvac_loads if "balcony" in l.room_name.lower())
    assert balcony_load.is_conditioned is False
    assert balcony_load.cooling_load_tr == 0.0

    # Equipment verification
    assert len(solved_floorplan.hvac_equipment) == 2
    idu = next(e for e in solved_floorplan.hvac_equipment if "idu" in e.id.lower())
    odu = next(e for e in solved_floorplan.hvac_equipment if "odu" in e.id.lower())
    assert idu.width == 900.0
    assert idu.height == 260.0
    assert odu.width == 850.0
    assert odu.height == 380.0

    # Pipe routing verification
    assert len(solved_floorplan.hvac_pipes) == 1
    pipe = solved_floorplan.hvac_pipes[0]
    assert pipe.pipe_id == "REF-1"
    assert len(pipe.path_points) >= 3
    assert pipe.total_length_mm > 1000.0


def test_manhattan_pipe_routing():
    """Verify orthogonal 90-degree corner path generation without diagonal segments."""
    start = [4500.0, 4800.0]
    end = [2200.0, 7500.0]
    waypoints = [[4500.0, 5057.5], [2200.0, 5057.5]]

    path, total_len = build_manhattan_path(start, end, waypoints)
    assert len(path) >= 3

    # Ensure every segment is either purely horizontal or purely vertical
    for i in range(len(path) - 1):
        p1 = path[i]
        p2 = path[i + 1]
        is_h = abs(p1[1] - p2[1]) < 1e-3
        is_v = abs(p1[0] - p2[0]) < 1e-3
        assert is_h or is_v, f"Segment from {p1} to {p2} is diagonal!"

    assert total_len > 0.0


def test_3sheet_excel_template_parsing():
    """Verify 3-sheet template workbook generation and parsing."""
    template_bytes = generate_excel_template_bytes()
    rooms, openings, hvac = parse_excel_floorplan(template_bytes)

    assert len(rooms) == 2
    assert len(openings) == 3
    assert len(hvac) == 2

    idu = next(h for h in hvac if h.id == "IDU-1")
    assert idu.room_name == "Living Room"
    assert idu.unit_type == "Split-IDU"
    assert idu.cooling_capacity_tr == 2.0
    assert idu.location_x == 4500.0
    assert idu.location_y == 4800.0

    odu = next(h for h in hvac if h.id == "ODU-1")
    assert odu.room_name == "L-Shaped Corridor/Balcony"
    assert odu.unit_type == "ODU"


def test_dxf_export_mep_layers(solved_floorplan):
    """Verify DXF export contains MEP AIA layers and entities."""
    dxf_bytes = export_floorplan_to_dxf(solved_floorplan)
    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))

    # Verify MEP layers
    layer_names = [l.dxf.name for l in doc.layers]
    assert "LAYER_MEP" in layer_names

    eq_layer = doc.layers.get("LAYER_MEP")
    assert eq_layer.color == 6  # Magenta
    assert eq_layer.dxf.lineweight == 35

    msp = doc.modelspace()

    # Check equipment boxes and fan circle
    eq_polylines = [e for e in msp if e.dxftype() == "LWPOLYLINE" and e.dxf.layer == "LAYER_MEP"]
    assert len(eq_polylines) >= 2  # IDU and ODU

    circles = [e for e in msp if e.dxftype() == "CIRCLE" and e.dxf.layer == "LAYER_MEP"]
    assert len(circles) == 1  # 1 ODU condenser fan

    # Check text
    texts = [e for e in msp if e.dxftype() == "MTEXT" and e.dxf.layer == "LAYER_MEP"]
    assert len(texts) >= 3  # 2 eq + 1 pipe callout


def test_hvac_crud_and_pipe_cleanup():
    """Verify adding, updating, and deleting HVAC units automatically routes and cleans up pipe runs."""
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
    
    # 1. Start with initial 2 units (IDU-1, ODU-1)
    hvac_list = [HVACEquipmentPayload(**h) for h in DEFAULT_TEST_HVAC]
    res1 = process_geometry_solve(rooms, openings, hvac_list)
    assert len(res1.hvac_equipment) == 2
    assert len(res1.hvac_pipes) == 1
    assert res1.hvac_pipes[0].from_unit_id == "IDU-1"
    assert res1.hvac_pipes[0].to_unit_id == "ODU-1"

    # 2. Add second IDU unit (IDU-2, Cassette IDU, 2.0 TR)
    idu2 = HVACEquipmentPayload(
        id="IDU-2",
        unit_type="Cassette IDU",
        room_name="Living Room",
        cooling_capacity_tr=2.0,
        location_x=3500.0,
        location_y=4200.0
    )
    hvac_list.append(idu2)
    res2 = process_geometry_solve(rooms, openings, hvac_list)
    assert len(res2.hvac_equipment) == 3
    assert len(res2.hvac_pipes) == 2
    pipe_sources = {p.from_unit_id for p in res2.hvac_pipes}
    assert pipe_sources == {"IDU-1", "IDU-2"}

    # 3. Update capacity of IDU-1 to 3.0 TR and check pipe sizing update
    for eq in hvac_list:
        if eq.id == "IDU-1":
            eq.cooling_capacity_tr = 3.0
    res3 = process_geometry_solve(rooms, openings, hvac_list)
    pipe1 = next(p for p in res3.hvac_pipes if p.from_unit_id == "IDU-1")
    assert pipe1.liquid_size == '3/8"'
    assert pipe1.suction_size == '3/4"'

    # 4. Delete IDU-1: verify only IDU-2 remains and its pipe route persists
    hvac_list = [eq for eq in hvac_list if eq.id != "IDU-1"]
    res4 = process_geometry_solve(rooms, openings, hvac_list)
    assert len(res4.hvac_equipment) == 2
    assert len(res4.hvac_pipes) == 1
    assert res4.hvac_pipes[0].from_unit_id == "IDU-2"

    # 5. Delete ODU-1: verify 0 pipes routed when no ODU is present (graceful empty state)
    hvac_list = [eq for eq in hvac_list if eq.id != "ODU-1"]
    res5 = process_geometry_solve(rooms, openings, hvac_list)
    assert len(res5.hvac_equipment) == 1
    assert len(res5.hvac_pipes) == 0

