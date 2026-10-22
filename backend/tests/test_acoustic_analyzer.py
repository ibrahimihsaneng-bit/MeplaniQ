"""
Unit tests for HVAC Acoustic Sound Attenuation & Room Noise Criteria (NC / dBA)
ASHRAE Fundamentals Chapter 8 compliance suite.
"""

import pytest
from backend.acoustic_analyzer import (
    calculate_fan_sound_power,
    calculate_straight_duct_attenuation,
    calculate_elbow_attenuation,
    calculate_silencer_attenuation,
    calculate_branch_split_loss,
    calculate_end_reflection_loss,
    calculate_room_absorption_and_lp,
    evaluate_nc_and_dba,
    perform_hvac_acoustic_analysis,
    DuctAcousticsRequest,
    DuctSectionInput,
    OCTAVE_BANDS,
    SPACE_ACOUSTIC_CRITERIA
)


def test_fan_sound_power_scaling():
    """Verify fan sound power increases with higher airflow and static pressure."""
    low_fan = calculate_fan_sound_power(airflow_cfm=500, static_press_in_wg=0.5)
    high_fan = calculate_fan_sound_power(airflow_cfm=3000, static_press_in_wg=2.0)

    for freq in OCTAVE_BANDS:
        assert high_fan[freq] > low_fan[freq], f"High fan Lw must exceed low fan at {freq}Hz"
        assert 30.0 < high_fan[freq] < 110.0


def test_duct_attenuation_lined_vs_unlined():
    """Lined ducts must attenuate substantially more than bare sheet metal."""
    unlined_sections = [DuctSectionInput(length_m=10.0, is_internally_lined=False)]
    lined_sections = [DuctSectionInput(length_m=10.0, is_internally_lined=True)]

    unlined_loss = calculate_straight_duct_attenuation(unlined_sections)
    lined_loss = calculate_straight_duct_attenuation(lined_sections)

    for freq in [250, 500, 1000, 2000]:
        assert lined_loss[freq] > unlined_loss[freq] * 5.0


def test_silencer_attenuation():
    """Silencer should provide up to 20-30 dB attenuation in speech frequencies."""
    no_silencer = calculate_silencer_attenuation(False)
    with_silencer = calculate_silencer_attenuation(True)

    assert no_silencer[1000] == 0.0
    assert with_silencer[1000] >= 25.0


def test_end_reflection_loss():
    """End reflection must be prominent at low frequencies (63 & 125 Hz) and minimal at high frequencies."""
    loss = calculate_end_reflection_loss()
    assert loss[63] > loss[125] > loss[500]
    assert loss[1000] == 0.0


def test_acoustic_analysis_compliance_workflow():
    """Test full acoustic analysis pipeline with private office target."""
    req = DuctAcousticsRequest(
        fan_airflow_cfm=1200,
        fan_static_pressure_in_wg=1.2,
        fan_type="centrifugal_airfoil",
        duct_sections=[
            DuctSectionInput(length_m=8.0, is_internally_lined=True),
            DuctSectionInput(length_m=4.0, is_internally_lined=False)
        ],
        num_mitered_elbows_with_vanes=2,
        num_mitered_elbows_without_vanes=0,
        has_duct_silencer=True,
        branch_ratio=0.3,
        room_length_m=5.0,
        room_width_m=4.0,
        room_height_m=3.0,
        space_type="private_office",
        distance_to_diffuser_m=2.2
    )

    res = perform_hvac_acoustic_analysis(req)

    assert len(res.octave_bands) == 8
    assert res.target_nc == 30
    assert res.target_dba == 35.0
    assert res.calculated_nc <= 35
    assert res.calculated_dba > 0.0
    assert "ACOUSTIC" in res.recommendation


def test_acoustic_remediation_trigger():
    """An unattenuated high-pressure fan must trigger acoustic remediation."""
    req = DuctAcousticsRequest(
        fan_airflow_cfm=5000,
        fan_static_pressure_in_wg=3.5,
        fan_type="vane_axial",
        duct_sections=[
            DuctSectionInput(length_m=2.0, is_internally_lined=False)
        ],
        num_mitered_elbows_with_vanes=0,
        num_mitered_elbows_without_vanes=1,
        has_duct_silencer=False,
        branch_ratio=1.0,
        room_length_m=4.0,
        room_width_m=3.0,
        room_height_m=2.8,
        space_type="conference_room",
        distance_to_diffuser_m=1.8
    )

    res = perform_hvac_acoustic_analysis(req)
    assert not res.is_compliant
    assert "REMEDIATION REQUIRED" in res.recommendation
