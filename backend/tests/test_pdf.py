import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.pdf_exporter import generate_project_boq_pdf

client = TestClient(app)


def test_pdf_export_default_project():
    """Verifies that GET /api/projects/{id}/export-pdf streams a valid PDF blob."""
    response = client.get("/api/projects/default-sample-1bhk/export-pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 2000


def test_pdf_export_404_invalid_id():
    """Verifies 404 response for non-existent project ID."""
    response = client.get("/api/projects/invalid-id-xyz-999/export-pdf")
    assert response.status_code == 404


def test_pdf_generator_custom_data():
    """Verifies direct PDF generation with custom rooms, openings, and HVAC data."""
    custom_cad_data = {
        "project_id": "test-custom-123",
        "rooms": [
            {
                "name": "Master Suite",
                "vertex_count": 4,
                "carpet_area_sqm": 25.5,
                "carpet_area_sqft": 274.5,
                "wall_thickness_mm": 230.0,
                "points": [[0, 0], [5000, 0], [5000, 5100], [0, 5100]]
            },
            {
                "name": "Ensuite Bath",
                "vertex_count": 4,
                "carpet_area_sqm": 6.0,
                "carpet_area_sqft": 64.6,
                "wall_thickness_mm": 115.0,
                "points": [[5000, 0], [7000, 0], [7000, 3000], [5000, 3000]]
            }
        ],
        "doors": [
            {
                "id": "D1",
                "host_room": "Master Suite",
                "wall_side": "Bottom",
                "offset_mm": 1200.0,
                "width_mm": 900.0,
                "height_mm": 2100.0,
                "swing": "Inward-Left"
            }
        ],
        "windows": [
            {
                "id": "W1",
                "host_room": "Master Suite",
                "wall_side": "Top",
                "offset_mm": 1500.0,
                "width_mm": 1500.0,
                "height_mm": 1200.0
            }
        ],
        "hvac_loads": [
            {
                "room_name": "Master Suite",
                "carpet_area_sqm": 25.5,
                "carpet_area_sqft": 274.5,
                "is_conditioned": True,
                "cooling_load_tr": 1.83,
                "airflow_cfm": 732.0,
                "liquid_line_inch": "1/4\"",
                "suction_line_inch": "1/2\""
            }
        ],
        "hvac_equipment": [
            {
                "id": "IDU-1",
                "room_name": "Master Suite",
                "unit_type": "Split-IDU",
                "capacity_tr": 2.0,
                "x": 2500.0,
                "y": 4900.0,
                "status": "Active"
            }
        ],
        "hvac_pipes": [
            {
                "pipe_id": "P-1",
                "from_unit_id": "IDU-1",
                "to_unit_id": "ODU-1",
                "liquid_size": "1/4\"",
                "suction_size": "1/2\"",
                "total_length_mm": 4500.0
            }
        ]
    }

    pdf_bytes = generate_project_boq_pdf(
        project_name="Custom Villa Suite",
        created_at="2026-09-22T08:00:00+00:00",
        cad_data=custom_cad_data
    )

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 2000
