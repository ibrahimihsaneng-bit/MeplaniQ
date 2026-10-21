"""
backend/tests/test_thermal_comfort_and_fittings.py
==================================================
Unit tests for ASHRAE 55 / ISO 7730 PMV/PPD thermal comfort analytics
and SMACNA duct fitting loss & fan static pressure calculations.
"""

import pytest
from backend.hvac_solver import calculate_ashrae_pmv_ppd, calculate_duct_fittings_and_pressure_loss


def test_ashrae_pmv_ppd_standard_office():
    """Verifies that 24.5°C with standard office clothing achieves compliant comfort."""
    res = calculate_ashrae_pmv_ppd(ta=24.5, tr=24.5, vel=0.18, rh=50.0, met=1.1, clo=0.65)
    assert "pmv" in res
    assert "ppd" in res
    assert -0.8 <= res["pmv"] <= 0.8
    assert res["ppd"] <= 20.0
    assert "Category" in res["category"]
    assert res["status"] in ["OPTIMAL", "COMPLIANT", "ACCEPTABLE"]


def test_ashrae_pmv_ppd_temperature_sensitivity():
    """Verifies that higher temperatures increase PMV and lower temperatures decrease PMV."""
    warm = calculate_ashrae_pmv_ppd(ta=28.0, tr=28.0, clo=0.8)
    cool = calculate_ashrae_pmv_ppd(ta=19.0, tr=19.0, clo=0.5)

    assert warm["pmv"] > 0
    assert "Warm" in warm["sensation"] or "Hot" in warm["sensation"]

    assert cool["pmv"] < 0
    assert "Cool" in cool["sensation"] or "Cold" in cool["sensation"]


def test_duct_fittings_and_fan_esp():
    """Verifies SMACNA dynamic fitting losses and fan external static pressure (ESP)."""
    mock_ducts = [
        {"p1": [0, 0], "p2": [4000, 0], "width_mm": 400, "height_mm": 250},
        {"p1": [4000, 0], "p2": [4000, 3000], "width_mm": 300, "height_mm": 200},
        {"p1": [4000, 3000], "p2": [8000, 3000], "width_mm": 250, "height_mm": 200}
    ]
    res = calculate_duct_fittings_and_pressure_loss(mock_ducts, total_cfm=1400.0)

    assert "fittings" in res
    assert len(res["fittings"]) >= 4
    # Check that elbow, reducer, and silencer exist
    types = [f["type"] for f in res["fittings"]]
    assert any("Elbow" in t for t in types)
    assert any("Reducer" in t for t in types)
    assert any("Attenuator" in t or "Silencer" in t for t in types)

    # Check ESP and fan power
    assert res["total_fan_static_pressure_pa"] > 150.0
    assert res["total_fan_static_pressure_in_wg"] > 0.5
    assert res["fan_bhp"] > 0.1
