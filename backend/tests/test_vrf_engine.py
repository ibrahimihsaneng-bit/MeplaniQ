"""
Unit tests for VRF (Variable Refrigerant Flow) Multi-Split Heat Recovery Engineering Engine.
AHRI Standard 1230 & ASHRAE Standard 15 compliance test suite.
"""

import pytest
from backend.vrf_engine import (
    select_standard_idu,
    select_standard_odu,
    perform_vrf_system_analysis,
    VRFSystemRequest,
    IndoorUnitInput,
    REFRIGERANT_CONSTANTS
)


def test_vrf_idu_selection():
    """Verify correct indoor unit model, capacity, and pipe diameters."""
    model, kw, liq_mm, gas_mm = select_standard_idu(3200)
    assert kw == 3.6
    assert liq_mm == 6.35
    assert gas_mm == 12.70
    assert "Cassette" in model

    model_lg, kw_lg, liq_lg, gas_lg = select_standard_idu(6800)
    assert kw_lg == 7.1
    assert liq_lg == 9.52
    assert gas_lg == 15.88


def test_vrf_odu_sizing_and_combination_ratio():
    """Verify Outdoor Unit sizing maintains realistic combination ratio."""
    # 35 kW total indoor units
    model, hp, kw = select_standard_odu(35.0, target_cr=1.15)
    assert hp in [10.0, 12.0, 14.0]
    cr = (35.0 / kw) * 100
    assert 70.0 <= cr <= 130.0


def test_refrigerant_charge_and_ashrae_safety():
    """Verify field charge calculation and ASHRAE 15 RCL check."""
    req = VRFSystemRequest(
        refrigerant_type="R410A",
        system_type="heat_recovery_3pipe",
        odu_location="rooftop",
        odu_elevation_relative_m=12.0,
        indoor_units=[
            IndoorUnitInput(room_name="Living Room", room_area_sqm=35.0, cooling_load_watts=4500, ceiling_height_m=3.0, pipe_distance_to_odu_m=20.0),
            IndoorUnitInput(room_name="Master Bed", room_area_sqm=20.0, cooling_load_watts=2800, ceiling_height_m=3.0, pipe_distance_to_odu_m=25.0),
            IndoorUnitInput(room_name="Home Office", room_area_sqm=12.0, cooling_load_watts=1800, ceiling_height_m=3.0, pipe_distance_to_odu_m=18.0)
        ]
    )
    res = perform_vrf_system_analysis(req)

    assert res.total_idu_count == 3
    assert res.total_connected_cooling_load_kw == pytest.approx(9.1, abs=0.2)
    assert res.factory_refrigerant_charge_kg > 0
    assert res.additional_field_charge_kg > 0
    assert res.total_system_charge_kg == res.factory_refrigerant_charge_kg + res.additional_field_charge_kg
    assert res.oil_traps_required_count >= 1
    assert res.ashrae_15_rcl_limit_kg_m3 == 0.44
    assert res.estimated_heat_recovery_cop >= 6.5


def test_ashrae_15_hazard_trigger_in_confined_space():
    """Verify warning when large system charge leaks into an unventilated micro room."""
    req = VRFSystemRequest(
        refrigerant_type="R410A",
        indoor_units=[
            IndoorUnitInput(room_name="Conference Room", room_area_sqm=80.0, cooling_load_watts=12000, ceiling_height_m=3.0, pipe_distance_to_odu_m=40.0),
            IndoorUnitInput(room_name="Executive Suite", room_area_sqm=60.0, cooling_load_watts=8000, ceiling_height_m=3.0, pipe_distance_to_odu_m=35.0),
            IndoorUnitInput(room_name="Tiny Telephone Booth", room_area_sqm=1.5, cooling_load_watts=400, ceiling_height_m=2.4, pipe_distance_to_odu_m=30.0)
        ]
    )
    res = perform_vrf_system_analysis(req)

    assert res.smallest_room_name == "Tiny Telephone Booth"
    assert res.worst_case_concentration_kg_m3 > 0.44
    assert not res.is_ashrae_15_compliant
    assert res.safety_mitigation_required
    assert "ACTION REQUIRED" in res.engineering_summary
