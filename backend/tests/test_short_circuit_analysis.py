"""
backend/tests/test_short_circuit_analysis.py
============================================
Pytest test suite for IEC 60909-0 & IEEE 141 short-circuit fault current analysis
and protective device breaking capacity verification.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.electrical.short_circuit import (
    calculate_transformer_impedance,
    calculate_cable_impedance,
    calculate_peak_factor_kappa,
    calculate_fault_point_iec60909,
    analyze_building_electrical_network_faults
)

client = TestClient(app)


def test_transformer_impedance_calculation():
    """
    Verifies transformer impedance calculation (160 kVA, 415V secondary, 4.0% uk).
    Formula: Z_T = (uk/100) * (U_n^2 / S_rT)
    """
    res = calculate_transformer_impedance(rated_kva=160.0, secondary_v=415.0, uk_percent=4.0)
    # Z_T = 0.04 * (415^2) / 160000 = 0.04 * 172225 / 160000 = 0.043056 ohm = ~43.06 mohm
    assert res["z_t_mohm"] == pytest.approx(43.056, 0.05)
    assert res["r_t_mohm"] > 0
    assert res["x_t_mohm"] > 0
    assert res["x_t_mohm"] < res["z_t_mohm"]


def test_cable_impedance_calculation():
    """
    Verifies cable resistance and reactance for copper conductors at 20°C.
    R = (rho * L) / S, X = x0 * L
    """
    # 12m of 70mm² copper
    res = calculate_cable_impedance(length_m=12.0, cross_section_sqmm=70.0, conductor_material="copper")
    # R = (0.017241 * 12) / 70 = 0.002955 ohm = 2.96 mohm
    assert res["r_mohm"] == pytest.approx(2.956, 0.05)
    # X = 0.08 mohm/m * 12m = 0.96 mohm
    assert res["x_mohm"] == pytest.approx(0.96, 0.02)
    assert res["z_mohm"] > res["r_mohm"]


def test_peak_factor_kappa():
    """
    Verifies peak asymmetrical short circuit factor kappa = 1.02 + 0.98 * e^(-3 * R/X).
    """
    # R/X = 0 -> kappa = 1.02 + 0.98 = 2.00
    assert calculate_peak_factor_kappa(0.0) == 2.00

    # R/X = 0.2 -> kappa = 1.02 + 0.98 * e^(-0.6) = 1.02 + 0.98 * 0.5488 = ~1.558
    assert calculate_peak_factor_kappa(0.2) == pytest.approx(1.558, 0.02)

    # R/X = 1.0 -> kappa = 1.02 + 0.98 * e^(-3) = 1.02 + 0.98 * 0.0498 = ~1.069
    assert calculate_peak_factor_kappa(1.0) == pytest.approx(1.069, 0.02)


def test_fault_point_iec60909():
    """
    Verifies symmetrical prospective fault current I_k'' and peak asymmetrical i_p
    at a 3-phase busbar fault point.
    """
    # R = 10 mohm, X = 45 mohm -> Z = 46.10 mohm
    res = calculate_fault_point_iec60909(
        point_name="Test Incomer Bus",
        r_cumulative_ohm=0.010,
        x_cumulative_ohm=0.045,
        voltage_line_v=415.0,
        voltage_factor_c=1.05,
        breaker_rating_a=200.0,
        breaker_type="MCCB",
        rated_icu_ka=25.0,
        conductor_size_sqmm=70.0
    )
    # I_k'' = (1.05 * 415) / (sqrt(3) * 0.046097) = 251.58 / 0.04610 = 5.46 kA
    assert res["ik_double_prime_ka"] == pytest.approx(5.46, 0.1)
    assert res["ip_peak_ka"] > res["ik_double_prime_ka"]
    # 25.0 kA rated I_cu >= 5.46 kA -> Breaking capacity compliant
    assert res["is_breaking_capacity_adequate"] is True
    assert res["safety_margin_percent"] > 70.0
    assert res["is_thermal_withstand_safe"] is True
    assert res["status"] == "PASS_COMPLIANT"


def test_analyze_building_electrical_network_faults():
    """
    Verifies full building electrical network hierarchy analysis:
    Transformer -> MDB -> SMDB -> Final DBs -> Branch circuits.
    """
    study = analyze_building_electrical_network_faults(transformer_kva=160.0, utility_fault_mva=250.0)

    assert study["standard"] == "IEC 60909-0:2016 / IEEE 141 (Red Book)"
    assert len(study["nodes"]) >= 6
    assert study["all_compliant"] is True
    assert study["overall_status"] == "IEC_COMPLIANT"

    # Incomer busbar fault is higher than branch outlet fault
    mdb_node = next(n for n in study["nodes"] if "MDB-01" in n["point_name"])
    socket_node = next(n for n in study["nodes"] if "Sockets" in n["point_name"])

    assert mdb_node["ik_double_prime_ka"] > socket_node["ik_double_prime_ka"]
    assert mdb_node["rated_icu_ka"] == 25.0
    assert socket_node["rated_icu_ka"] == 6.0
    assert mdb_node["is_breaking_capacity_adequate"] is True
    assert socket_node["is_breaking_capacity_adequate"] is True


def test_short_circuit_rest_endpoints():
    """
    Tests REST API endpoint POST /api/electrical/short-circuit-analysis.
    """
    response = client.post("/api/electrical/short-circuit-analysis", json={
        "transformer_kva": 200.0,
        "utility_fault_mva": 300.0
    })
    assert response.status_code == 200
    data = response.json()
    assert data["transformer_kva"] == 200.0
    assert "nodes" in data
    assert len(data["nodes"]) >= 6
    assert data["overall_status"] == "IEC_COMPLIANT"
