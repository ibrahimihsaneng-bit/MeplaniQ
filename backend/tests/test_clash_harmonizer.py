"""
backend/tests/test_clash_harmonizer.py
======================================
Pytest test suite for 3D multi-discipline MEP clash detection,
spatial clearance harmonization, and autonomous detour routing.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.clash_harmonizer import (
    check_box_overlap,
    calculate_line_segment_distance_2d,
    harmonize_mep_spatial_coordination
)

client = TestClient(app)


def test_check_box_overlap():
    """
    Verifies 3D Axis-Aligned Bounding Box (AABB) intersection detection.
    """
    # Overlapping boxes
    box_a = (0.0, 0.0, 2000.0, 500.0, 500.0, 2500.0)
    box_b = (200.0, 200.0, 2200.0, 600.0, 600.0, 2600.0)
    assert check_box_overlap(box_a, box_b) is True

    # Separated boxes (in Z axis)
    box_c = (0.0, 0.0, 1000.0, 500.0, 500.0, 1500.0)
    assert check_box_overlap(box_a, box_c) is False


def test_line_segment_distance_2d():
    """
    Verifies 2D minimum distance calculation between linear routes.
    """
    seg_1 = ((0.0, 0.0), (1000.0, 0.0))
    seg_2 = ((0.0, 100.0), (1000.0, 100.0))
    dist = calculate_line_segment_distance_2d(seg_1[0], seg_1[1], seg_2[0], seg_2[1])
    assert dist == pytest.approx(100.0, 0.01)


def test_hvac_duct_vs_structural_column_clash_and_detour():
    """
    Verifies that a duct running directly into a column is detected and assigned a lateral dogleg detour.
    """
    ducts = [{
        "id": "DUCT-MAIN-01",
        "p1": [0.0, 2000.0],
        "p2": [5000.0, 2000.0],
        "width": 500.0,
        "height": 300.0,
        "z_elevation_mm": 2500.0
    }]
    columns = [{
        "id": "COL-C1",
        "x": 2500.0,
        "y": 2000.0,
        "size": 350.0
    }]

    res = harmonize_mep_spatial_coordination(ducts=ducts, columns=columns)
    assert res["total_clashes_detected"] >= 1
    assert res["total_detours_generated"] >= 1
    assert res["resolution_efficiency_percent"] == 100.0

    clash = res["clashes"][0]
    assert clash["discipline_a"] == "HVAC Ductwork"
    assert clash["discipline_b"] == "Structural Column"
    assert "45° Lateral Dogleg" in clash["resolution_strategy"]


def test_hvac_vs_plumbing_gravity_cross_clearance():
    """
    Verifies that a drainage pipe crossing directly on top of a duct is detected and assigned vertical offset.
    """
    ducts = [{
        "id": "DUCT-01",
        "p1": [1000.0, 3000.0],
        "p2": [4000.0, 3000.0],
        "z_elevation_mm": 2500.0
    }]
    pipes = [{
        "id": "PIPE-SOIL-01",
        "path": [[2500.0, 2000.0], [2500.0, 4000.0]],
        "z_elevation_mm": 2600.0  # Only 100mm vertical buffer
    }]

    res = harmonize_mep_spatial_coordination(ducts=ducts, pipes=pipes)
    assert res["total_clashes_detected"] >= 1
    clash = res["clashes"][0]
    assert "Plumbing" in clash["discipline_b"]
    assert "Vertical Invert Transition" in clash["resolution_strategy"]


def test_electrical_vs_plumbing_150mm_separation_rule():
    """
    Verifies enforcement of IEC 60364-5-52 Rule 528.2 (150 mm separation from moisture/pipes).
    """
    electrical_routes = [{
        "id": "EL-ROUTE-01",
        "path": [[1000.0, 1000.0], [3000.0, 1000.0]]
    }]
    pipes = [{
        "id": "PIPE-WATER-01",
        "path": [[1000.0, 1060.0], [3000.0, 1060.0]]  # Only 60mm separation!
    }]

    res = harmonize_mep_spatial_coordination(pipes=pipes, electrical_routes=electrical_routes)
    assert res["total_clashes_detected"] >= 1
    clash = res["clashes"][0]
    assert clash["clash_type"] == "ELECTROMAGNETIC_MOISTURE_PROXIMITY"
    assert "IEC 60364-5-52" in clash["resolution_strategy"]


def test_clash_rest_endpoints():
    """
    Tests REST endpoint POST /api/mep/resolve-clashes-3d.
    """
    payload = {
        "hvac_ducts": [{
            "id": "DUCT-01",
            "p1": [0.0, 2000.0],
            "p2": [4000.0, 2000.0],
            "width": 400.0,
            "height": 250.0,
            "z_elevation_mm": 2500.0
        }],
        "structural_columns": [{
            "id": "COL-01",
            "x": 2000.0,
            "y": 2000.0,
            "size": 300.0
        }]
    }
    response = client.post("/api/mep/resolve-clashes-3d", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_clashes_detected"] >= 1
    assert data["resolution_efficiency_percent"] == 100.0
    assert data["coordination_status"] == "ZERO_HARD_CLASHES_VERIFIED"
