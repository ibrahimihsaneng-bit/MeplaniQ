import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.plumbing_router import (
    calculate_water_hammer_and_surge_protection,
    calculate_drainage_slopes_and_clearance
)

client = TestClient(app)


def test_water_hammer_joukowsky_cpvc():
    """
    Verifies Joukowsky transient water hammer calculation for CPVC piping
    per PDI-WH 201 & ASSE 1010.
    """
    res = calculate_water_hammer_and_surge_protection(
        total_wsfu=18.5,
        flow_velocity_ms=1.8,
        pipe_material="CPVC"
    )
    assert res["wave_speed_ms"] == 600.0
    assert res["flow_velocity_ms"] == 1.8
    # rho (1000) * a (600) * v (1.8) = 1,080,000 Pa = 1080.0 kPa
    assert res["surge_kpa"] == 1080.0
    assert res["surge_psi"] == pytest.approx(156.6, 0.2)
    # Peak = 300 kPa static + 1080 kPa surge = 1380.0 kPa
    assert res["peak_kpa"] == 1380.0
    assert res["exceeds_safe_pressure"] is True
    # WSFU 18.5 falls in PDI Size B (12 - 32 WSFU)
    assert res["pdi_code"] == "B"
    assert "Size B" in res["arrestor_size"]
    assert res["damped_peak_kpa"] <= 750.0


def test_water_hammer_arrestor_sizing_categories():
    """
    Verifies PDI-WH 201 arrestor sizing thresholds (Size A to E).
    """
    res_a = calculate_water_hammer_and_surge_protection(total_wsfu=8.0)
    assert res_a["pdi_code"] == "A"

    res_b = calculate_water_hammer_and_surge_protection(total_wsfu=25.0)
    assert res_b["pdi_code"] == "B"

    res_c = calculate_water_hammer_and_surge_protection(total_wsfu=45.0)
    assert res_c["pdi_code"] == "C"

    res_d = calculate_water_hammer_and_surge_protection(total_wsfu=85.0)
    assert res_d["pdi_code"] == "D"

    res_e = calculate_water_hammer_and_surge_protection(total_wsfu=140.0)
    assert res_e["pdi_code"] == "E"


def test_drainage_slopes_and_invert_levels():
    """
    Verifies UPC Table 702.1 & IPC 704.1 gravity drainage slope (1:40 / 2.5% fall)
    and ceiling plenum clearance margin.
    """
    res = calculate_drainage_slopes_and_clearance(total_drain_length_m=14.5)
    assert res["fall_per_meter_mm"] == 25.0
    # 14.5m * 25 mm/m = 362.5 mm fall
    assert res["total_fall_mm"] == 362.5
    assert res["trap_invert_level_m"] == -0.300
    # IL = -0.300 - 0.3625 = -0.6625 m (rounds to -0.662 or -0.663)
    assert res["inspection_chamber_il_m"] in (-0.662, -0.663)
    # Plenum depth = (2.85 - 2.40) * 1000 = 450.0 mm
    assert res["plenum_depth_mm"] == 450.0
    # Required space = 362.5 + 110 = 472.5 mm -> Clearance is negative or reserved warning
    assert "clearance_margin_mm" in res
    assert "standard" in res


def test_water_hammer_and_drainage_rest_endpoints():
    """
    Tests REST endpoints for water hammer and drainage slope calculation.
    """
    wh_resp = client.post("/api/plumbing/water-hammer-analysis", json={
        "total_wsfu": 15.0,
        "flow_velocity_ms": 1.6,
        "pipe_material": "CPVC"
    })
    assert wh_resp.status_code == 200
    wh_data = wh_resp.json()
    assert wh_data["pdi_code"] == "B"
    assert wh_data["surge_kpa"] == 960.0

    dr_resp = client.post("/api/plumbing/drainage-slope-clearance", json={
        "total_drain_length_m": 12.0
    })
    assert dr_resp.status_code == 200
    dr_data = dr_resp.json()
    assert dr_data["fall_per_meter_mm"] == 25.0
    assert dr_data["total_fall_mm"] == 300.0
