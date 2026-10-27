"""
Unit tests for Advanced Plumbing & Hydraulics Engineering Suite.
IPC 604 Water Supply (WSFU & Hunter's Curve), IPC 709 Drainage (DFU),
and NBC 2016 Part 9 Storage Tanks & Booster Pumps.
"""

import pytest
from backend.plumbing_router import (
    calculate_plumbing_wsfu_and_dfu,
    calculate_water_storage_and_booster_pump
)


def test_wsfu_and_dfu_fixture_calculations():
    """Verify WSFU and DFU calculations for standard bathroom & kitchen fixtures."""
    fixtures = [
        {"id": "WC-1", "type": "Water Closet"},
        {"id": "WB-1", "type": "Wash Basin"},
        {"id": "SH-1", "type": "Shower"},
        {"id": "KS-1", "type": "Kitchen Sink"},
        {"id": "WM-1", "type": "Washing Machine"}
    ]
    res = calculate_plumbing_wsfu_and_dfu(fixtures)

    assert res["fixture_count"] == 5
    # WC(2.5) + Basin(1.0) + Shower(2.0) + Sink(1.5) + WM(2.0) = 9.0 WSFU
    assert res["total_wsfu"] == pytest.approx(9.0, abs=0.5)
    # WC(4.0) + Basin(1.0) + Shower(2.0) + Sink(2.0) + WM(3.0) = 12.0 DFU
    assert res["total_dfu"] == pytest.approx(12.0, abs=0.5)
    assert res["design_flow_lpm"] > 0.0
    assert res["recommended_supply_pipe_mm"] in [20.0, 25.0, 32.0]
    assert res["recommended_drain_pipe_mm"] in [75.0, 110.0]


def test_storage_tanks_and_booster_pump_sizing():
    """Verify NBC 2016 per-capita daily demand, OHT volume, and pump HP sizing."""
    res = calculate_water_storage_and_booster_pump(occupant_count=8, building_height_m=15.0)

    # 8 occupants * 135 L = 1080 L daily demand
    assert res["daily_demand_liters"] == 1080.0
    # OHT >= 50% daily demand (min 1000L)
    assert res["overhead_tank_liters"] >= 1000
    # Sump >= 100% daily demand (min 2000L)
    assert res["underground_sump_liters"] >= 2000
    assert res["pump_flow_lpm"] > 10.0
    assert res["total_dynamic_head_m"] > 15.0
    assert res["standard_booster_pump_hp"] in [1.0, 1.5, 2.0, 3.0]
