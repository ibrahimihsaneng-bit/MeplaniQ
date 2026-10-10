import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import save_project, get_project_by_id, save_project_boq, get_project_boq
from backend.services.boq_engine import calculate_project_boq, TIER_SPECIFICATIONS
from backend.pdf_exporter import generate_detailed_boq_pdf


@pytest.fixture
def sample_cad_data():
    """Provides standard 2-BHK floorplan CAD payload for estimation."""
    return {
        "project_id": "test-boq-proj-01",
        "project_name": "Test Villa 2-BHK",
        "total_builtup_area_sqm": 115.0,  # ~1,238 sq.ft
        "total_carpet_area_sqm": 95.0,    # ~1,022 sq.ft
        "rooms": [
            {"name": "Living & Dining", "area_sqm": 35.0, "perimeter_m": 24.0},
            {"name": "Master Bedroom", "area_sqm": 20.0, "perimeter_m": 18.0},
            {"name": "Bedroom 2", "area_sqm": 16.0, "perimeter_m": 16.0},
            {"name": "Kitchen", "area_sqm": 14.0, "perimeter_m": 15.0},
            {"name": "Master Bathroom", "area_sqm": 5.0, "perimeter_m": 9.0},
            {"name": "Common Bathroom", "area_sqm": 5.0, "perimeter_m": 9.0},
        ],
        "doors": [
            {"width_mm": 1000.0, "height_mm": 2100.0},
            {"width_mm": 900.0, "height_mm": 2100.0},
            {"width_mm": 900.0, "height_mm": 2100.0},
            {"width_mm": 800.0, "height_mm": 2100.0},
        ],
        "windows": [
            {"width_mm": 1500.0, "height_mm": 1200.0},
            {"width_mm": 1200.0, "height_mm": 1200.0},
            {"width_mm": 1200.0, "height_mm": 1200.0},
        ],
        "furniture": [
            {"id": "F1", "name": "King Size Bed", "room_name": "Master Bedroom"},
            {"id": "F2", "name": "Double Bed", "room_name": "Bedroom 2"},
            {"id": "F3", "name": "L-Shape Sofa Set", "room_name": "Living & Dining"},
            {"id": "F4", "name": "Dining Table 6-Seater", "room_name": "Living & Dining"},
            {"id": "F5", "name": "Modular Kitchen Counter", "room_name": "Kitchen"},
        ],
        "hvac_equipment": [
            {"type": "Split-IDU", "capacity_tr": "1.5", "room_name": "Living & Dining"},
            {"type": "Split-IDU", "capacity_tr": "1.5", "room_name": "Master Bedroom"},
            {"type": "Split-IDU", "capacity_tr": "1.0", "room_name": "Bedroom 2"},
        ]
    }


def test_boq_calculation_structure(sample_cad_data):
    """Verifies that calculate_project_boq produces full civil, labor, MEP and furniture data."""
    boq = calculate_project_boq(sample_cad_data, quality_tier="medium")

    assert boq["quality_tier"] == "medium"
    assert "Standard" in boq["tier_name"]

    # Summary
    summary = boq["summary"]
    assert summary["grand_total"] > 1_500_000  # Expect realistic house cost > 15 Lakhs
    assert 1800 <= summary["cost_per_sqft_builtup"] <= 3500
    assert summary["construction_duration_days"] >= 120
    assert summary["total_labor_mandays"] > 300
    assert summary["total_labor_cost"] > 300_000

    # Civil Materials
    civil = boq["civil_materials"]
    assert civil["solid_blocks_count"] > 1000
    assert civil["standard_bricks_count"] > 5000
    assert civil["cement_total_bags"] > 300
    assert civil["total_sand_cft"] > 1000
    assert civil["total_sand_tons"] > 40
    assert civil["steel_kg"] > 2500
    assert civil["steel_metric_tons"] > 2.5

    # Construction Schedule
    sched = boq["construction_schedule"]
    assert len(sched["phases"]) == 7
    assert sched["total_working_days"] == summary["construction_duration_days"]

    # Labor
    labor = boq["labor"]
    assert len(labor["breakdown"]) >= 6

    # MEP & Furniture
    assert len(boq["electrical"]["items"]) >= 5
    assert len(boq["plumbing"]["items"]) >= 5
    assert len(boq["hvac"]["items"]) == 3
    assert len(boq["furniture"]["items"]) == 5


def test_quality_tier_cost_escalation(sample_cad_data):
    """Verifies that cost escalates strictly Low < Medium < High."""
    boq_low = calculate_project_boq(sample_cad_data, quality_tier="low")
    boq_med = calculate_project_boq(sample_cad_data, quality_tier="medium")
    boq_high = calculate_project_boq(sample_cad_data, quality_tier="high")

    cost_low = boq_low["summary"]["grand_total"]
    cost_med = boq_med["summary"]["grand_total"]
    cost_high = boq_high["summary"]["grand_total"]

    assert cost_low < cost_med < cost_high, f"Expected Low ({cost_low}) < Med ({cost_med}) < High ({cost_high})"

    # Rate per sqft escalation
    rate_low = boq_low["summary"]["cost_per_sqft_builtup"]
    rate_med = boq_med["summary"]["cost_per_sqft_builtup"]
    rate_high = boq_high["summary"]["cost_per_sqft_builtup"]

    assert rate_low < rate_med < rate_high


def test_database_persistence(sample_cad_data):
    """Verifies SQLite save and retrieve operations for project BOQ."""
    pid = "test-persist-boq-id"
    save_project("Test Persistence Project", sample_cad_data, project_id=pid)

    boq_data = calculate_project_boq(sample_cad_data, quality_tier="high")
    save_res = save_project_boq(project_id=pid, quality_tier="high", boq_data=boq_data)

    assert save_res["project_id"] == pid
    assert save_res["quality_tier"] == "high"

    retrieved = get_project_boq(pid)
    assert retrieved is not None
    assert retrieved["quality_tier"] == "high"
    assert retrieved["boq_data"]["summary"]["grand_total"] == boq_data["summary"]["grand_total"]


def test_detailed_boq_pdf_generation(sample_cad_data):
    """Verifies that generate_detailed_boq_pdf creates a valid multi-page PDF document."""
    boq_data = calculate_project_boq(sample_cad_data, quality_tier="medium")
    pdf_bytes = generate_detailed_boq_pdf(
        project_name="Test Luxury Residence",
        created_at="2026-10-09T00:00:00Z",
        cad_data=sample_cad_data,
        boq_data=boq_data
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF")


def test_api_endpoints_boq(sample_cad_data):
    """Verifies FastAPI endpoints for BOQ calculation, retrieval, and PDF streaming."""
    client = TestClient(app)
    pid = "test-api-boq-id"

    # 1. Save base project
    save_project("API BOQ Test Project", sample_cad_data, project_id=pid)

    # 2. Get Tier Specifications
    res_specs = client.get("/api/boq/tier-specifications")
    assert res_specs.status_code == 200
    specs = res_specs.json()
    assert "low" in specs and "medium" in specs and "high" in specs

    # 3. Calculate BOQ via POST
    res_calc = client.post(f"/api/projects/{pid}/calculate-boq", json={"quality_tier": "high"})
    assert res_calc.status_code == 200
    calc_json = res_calc.json()
    assert calc_json["status"] == "success"
    assert calc_json["quality_tier"] == "high"
    assert "boq" in calc_json
    assert calc_json["boq"]["civil_materials"]["solid_blocks_count"] > 0

    # 4. Retrieve saved BOQ via GET
    res_get = client.get(f"/api/projects/{pid}/boq")
    assert res_get.status_code == 200
    get_json = res_get.json()
    assert get_json["quality_tier"] == "high"

    # 5. Live calculation endpoint
    res_live = client.post("/api/projects/calculate-boq-live", json={"cad_data": sample_cad_data, "quality_tier": "low"})
    assert res_live.status_code == 200
    assert res_live.json()["quality_tier"] == "low"

    # 6. Stream BOQ PDF
    res_pdf = client.get(f"/api/projects/{pid}/export-boq-pdf?quality_tier=high")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 2000
    assert res_pdf.content.startswith(b"%PDF")
