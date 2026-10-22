"""
backend/tests/test_fire_protection.py
=====================================
Pytest test suite for NFPA 13, NFPA 14 & NFPA 20 Fire Protection Hydraulics,
sprinkler discharge, wet riser standpipe, and booster pump sizing.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.fire_protection import (
    calculate_sprinkler_head_discharge,
    calculate_fire_sprinkler_system_demand,
    calculate_wet_riser_standpipe_hydraulics,
    calculate_fire_pump_and_tank_sizing,
    analyze_building_fire_protection_system
)

client = TestClient(app)


def test_sprinkler_head_discharge():
    """
    Verifies single sprinkler head discharge: Q = K * sqrt(P) per NFPA 13 Clause 27.2.
    For K=5.6 and P=7.0 psi: Q = 5.6 * sqrt(7) = 14.81 gpm (~56.1 L/min).
    """
    res = calculate_sprinkler_head_discharge(k_factor=5.6, residual_pressure_psi=7.0)
    assert res["flow_gpm"] == pytest.approx(14.81, 0.05)
    assert res["flow_lpm"] == pytest.approx(56.1, 0.2)
    assert res["pressure_bar"] == pytest.approx(0.48, 0.02)
    assert "1/2 inch" in res["standard_orifice"]


def test_fire_sprinkler_system_demand_light_vs_ordinary():
    """
    Verifies NFPA 13 sprinkler hydraulic demand for Light Hazard vs Ordinary Hazard Group 1.
    """
    # Light Hazard
    light = calculate_fire_sprinkler_system_demand(floor_area_sqm=300.0, hazard_class="light_hazard")
    assert light["design_density_gpm_sqft"] == 0.10
    assert light["remote_area_sqft"] == 1500.0
    assert light["hose_stream_allowance_gpm"] == 100.0
    assert light["operating_sprinklers_count"] == 8
    assert light["total_sprinkler_demand_gpm"] > 250.0

    # Ordinary Hazard Group 1
    ordinary = calculate_fire_sprinkler_system_demand(floor_area_sqm=300.0, hazard_class="ordinary_hazard_1")
    assert ordinary["design_density_gpm_sqft"] == 0.15
    assert ordinary["hose_stream_allowance_gpm"] == 250.0
    assert ordinary["operating_sprinklers_count"] == 12
    assert ordinary["total_sprinkler_demand_gpm"] > light["total_sprinkler_demand_gpm"]


def test_wet_riser_standpipe_hydraulics():
    """
    Verifies NFPA 14 Class I wet riser standpipe flow (500 gpm) and 100 psi residual pressure.
    """
    standpipe = calculate_wet_riser_standpipe_hydraulics(building_height_m=15.0, standpipe_class="Class I")
    assert standpipe["total_standpipe_gpm"] == 500.0
    assert standpipe["min_residual_pressure_psi"] == 100.0
    assert standpipe["min_residual_bar"] == pytest.approx(6.89, 0.05)
    assert standpipe["static_elevation_head_m"] == 15.0
    assert standpipe["total_required_head_m"] > 80.0
    assert standpipe["total_required_bar"] > 8.0


def test_fire_pump_and_tank_sizing():
    """
    Verifies NFPA 20 fire pump power and NFPA 22 water storage capacity.
    """
    res = calculate_fire_pump_and_tank_sizing(
        design_flow_gpm=500.0,
        total_dynamic_head_m=86.0,
        operating_duration_min=45.0,
        pump_efficiency=0.72
    )
    assert res["design_flow_gpm"] == 500.0
    # Hydraulic kW = (1000 * 9.80665 * 0.03155 * 86.0) / 0.72 = ~36.9 kW
    assert res["hydraulic_power_kw"] == pytest.approx(37.0, 1.0)
    assert res["recommended_motor_hp"] in (50.0, 60.0)
    assert res["recommended_motor_kw"] > 35.0

    # Jockey pump: ~10 gpm, 3 HP
    assert res["jockey_pump"]["flow_gpm"] == 10.0
    assert res["jockey_pump"]["motor_hp"] == 3.0

    # Storage tank: 500 gpm * 45 min = 22,500 gal = ~85.2 m³
    assert res["tank_capacity_gal"] == 22500
    assert res["tank_capacity_m3"] == pytest.approx(85.2, 0.5)


def test_integrated_building_fire_protection_system():
    """
    Verifies unified building fire protection analysis.
    """
    study = analyze_building_fire_protection_system(
        floor_area_sqm=350.0,
        building_height_m=12.0,
        hazard_class="light_hazard"
    )
    assert study["status"] == "NFPA_COMPLIANT"
    assert study["governing_fire_flow_gpm"] >= 500.0
    assert "sprinkler_system" in study
    assert "standpipe_system" in study
    assert "fire_pump" in study
    assert study["compliance_summary"]["sprinkler_coverage_verified"] is True
    assert study["compliance_summary"]["standpipe_residual_pressure_adequate"] is True


def test_fire_protection_rest_endpoints():
    """
    Tests REST API endpoint POST /api/fire-protection/hydraulic-analysis.
    """
    response = client.post("/api/fire-protection/hydraulic-analysis", json={
        "floor_area_sqm": 400.0,
        "building_height_m": 15.0,
        "hazard_class": "light_hazard"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "NFPA_COMPLIANT"
    assert data["governing_fire_flow_gpm"] >= 500.0
    assert data["fire_pump"]["tank_capacity_m3"] > 50.0
