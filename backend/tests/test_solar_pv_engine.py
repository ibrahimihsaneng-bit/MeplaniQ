"""
Unit tests for Solar Photovoltaic (PV) Rooftop Generation & Battery Storage (BESS)
IEEE 1547 / IEC 61724 / NREL PVWatts compliance suite.
"""

import pytest
from backend.solar_pv_engine import (
    calculate_optimal_tilt,
    calculate_plane_of_array_multiplier,
    size_rooftop_solar_pv,
    SolarPVRequest,
    STANDARD_PV_MODULE
)


def test_optimal_tilt_calculation():
    """Verify optimal tilt angle corresponds to geographical latitude."""
    equatorial = calculate_optimal_tilt(10.0)
    assert equatorial >= 10.0  # Min 10 deg for rainwater drainage

    tropical = calculate_optimal_tilt(18.0)
    assert 14.0 <= tropical <= 18.0

    temperate = calculate_optimal_tilt(45.0)
    assert 38.0 <= temperate <= 45.0


def test_rooftop_packing_and_string_sizing():
    """Verify module count, setback clearances, and electrical inverter sizing."""
    req = SolarPVRequest(
        rooftop_area_sqm=200.0,
        latitude_deg=13.0,
        avg_daily_load_kwh=40.0,
        battery_backup_hours=4.0
    )
    res = size_rooftop_solar_pv(req)

    assert res.usable_rooftop_sqm < 200.0
    assert res.usable_rooftop_sqm == pytest.approx(144.0, abs=1.0)
    assert res.total_modules_count > 0
    assert res.system_capacity_kwp > 10.0
    assert 1.05 <= res.dc_ac_ratio <= 1.35
    assert res.modules_per_string * res.strings_parallel_count == res.total_modules_count


def test_bess_sizing_lifepo4_vs_lead_acid():
    """Verify LiFePO4 requires lower nominal kWh due to 85% DoD vs 50% for Lead-Acid."""
    req_lifepo4 = SolarPVRequest(
        rooftop_area_sqm=150.0,
        avg_daily_load_kwh=50.0,
        battery_backup_hours=6.0,
        battery_chemistry="lifepo4"
    )
    req_lead_acid = SolarPVRequest(
        rooftop_area_sqm=150.0,
        avg_daily_load_kwh=50.0,
        battery_backup_hours=6.0,
        battery_chemistry="lead_acid"
    )

    res_lifepo4 = size_rooftop_solar_pv(req_lifepo4)
    res_lead_acid = size_rooftop_solar_pv(req_lead_acid)

    assert res_lifepo4.battery_usable_kwh == pytest.approx(res_lead_acid.battery_usable_kwh, abs=0.1)
    assert res_lifepo4.battery_nominal_kwh < res_lead_acid.battery_nominal_kwh
    assert res_lifepo4.battery_dod_pct == 85.0
    assert res_lead_acid.battery_dod_pct == 50.0


def test_monthly_generation_and_poa_transposition():
    """Verify 12 monthly generation profiles are generated with positive yields."""
    req = SolarPVRequest(
        rooftop_area_sqm=300.0,
        climate_zone="tropical_sunny",
        avg_daily_load_kwh=80.0
    )
    res = size_rooftop_solar_pv(req)

    assert len(res.monthly_data) == 12
    for m in res.monthly_data:
        assert m.ac_generation_kwh > 0.0
        assert m.poa_kwh_m2_day > 0.0
        assert m.solar_self_consumed_kwh <= m.ac_generation_kwh
        assert m.grid_exported_kwh >= 0.0

    assert res.annual_generation_kwh > 10000.0
    assert res.specific_yield_kwh_per_kwp >= 1200.0  # Typical tropical specific yield


def test_financial_and_environmental_metrics():
    """Verify CAPEX, payback period, and CO2 emission offset calculations."""
    req = SolarPVRequest(
        rooftop_area_sqm=180.0,
        avg_daily_load_kwh=35.0,
        electricity_tariff_per_kwh=9.0,
        feed_in_tariff_per_kwh=4.0
    )
    res = size_rooftop_solar_pv(req)

    assert res.estimated_capex_pv > 0.0
    assert res.estimated_capex_bess > 0.0
    assert res.total_capex == res.estimated_capex_pv + res.estimated_capex_bess
    assert res.annual_energy_cost_savings > 0.0
    assert 1.0 < res.simple_payback_years < 15.0
    assert res.co2_offset_tonnes_per_year > 0.0
    assert "SOLAR PV & BESS SIZED" in res.engineering_summary
