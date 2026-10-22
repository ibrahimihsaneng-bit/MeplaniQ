"""
HVAC Acoustic Sound Attenuation & Room Noise Criteria (NC / dBA) Engine
Compliant with ASHRAE Handbook of Fundamentals (Chapter 8: Sound and Vibration)
and AHRI Standard 885 / ISO 3744.

Calculates:
1. Octave-band fan/AHU sound power levels (Lw) from 63 Hz to 8000 Hz.
2. Straight duct insertion loss (sheet metal lined/unlined).
3. Duct elbow insertion loss with/without turning vanes.
4. Sound attenuator / dissipative silencer insertion loss.
5. Branch duct sound power distribution.
6. End reflection loss at terminal diffusers.
7. Room sound absorption (Sabine equation) and room constant.
8. Sound pressure level (Lp) at receiver ear position (1.5m).
9. NC (Noise Criteria) rating curve fitting (NC-15 to NC-65) & overall dBA calculation.
10. Space-type acoustic compliance check (e.g., NC-30 for Private Offices, NC-25 for Bedrooms).
"""

import math
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

# Standard 8 Octave-Band Center Frequencies (Hz) per ISO / ASHRAE
OCTAVE_BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000]

# Standard A-weighting corrections (dB) per IEC 61672-1:2013
A_WEIGHTING_CORRECTIONS = {
    63: -26.2,
    125: -16.1,
    250: -8.6,
    500: -3.2,
    1000: 0.0,
    2000: 1.2,
    4000: 1.0,
    8000: -1.1
}

# Standard ASHRAE Noise Criteria (NC) curves (Lp in dB per octave band)
NC_CURVES = {
    "NC-20": [51, 40, 33, 26, 22, 19, 17, 16],
    "NC-25": [54, 44, 37, 31, 27, 24, 22, 21],
    "NC-30": [57, 48, 41, 35, 31, 29, 28, 27],
    "NC-35": [60, 52, 45, 40, 36, 34, 33, 32],
    "NC-40": [64, 56, 50, 45, 41, 39, 38, 37],
    "NC-45": [67, 60, 54, 49, 46, 44, 43, 42],
    "NC-50": [71, 64, 58, 54, 51, 49, 48, 47],
    "NC-55": [74, 67, 62, 58, 56, 54, 53, 52],
    "NC-60": [77, 71, 67, 63, 61, 59, 58, 57],
    "NC-65": [80, 75, 71, 68, 66, 64, 63, 62]
}

# ASHRAE Recommended NC & dBA targets by space type
SPACE_ACOUSTIC_CRITERIA = {
    "private_office": {"target_nc": 30, "target_dba": 35, "description": "Executive & Private Offices"},
    "conference_room": {"target_nc": 25, "target_dba": 30, "description": "Conference & Telepresence Rooms"},
    "open_office": {"target_nc": 35, "target_dba": 40, "description": "Open-Plan Workstations"},
    "bedroom": {"target_nc": 25, "target_dba": 30, "description": "Residential Bedrooms & Hotel Guestrooms"},
    "classroom": {"target_nc": 30, "target_dba": 35, "description": "Classrooms & Lecture Halls"},
    "auditorium": {"target_nc": 25, "target_dba": 30, "description": "Auditoriums & Concert Theaters"},
    "hospital_patient_room": {"target_nc": 30, "target_dba": 35, "description": "Hospital Patient Rooms"},
    "retail_store": {"target_nc": 40, "target_dba": 45, "description": "Retail Stores & Supermarkets"},
    "corridor": {"target_nc": 45, "target_dba": 50, "description": "Corridors & Lobbies"},
    "mechanical_room": {"target_nc": 55, "target_dba": 60, "description": "Plant & Mechanical Rooms"}
}


class DuctSectionInput(BaseModel):
    length_m: float = Field(..., gt=0, description="Duct segment length in meters")
    width_mm: float = Field(default=400, gt=0, description="Duct width in mm")
    height_mm: float = Field(default=300, gt=0, description="Duct height in mm")
    is_internally_lined: bool = Field(default=False, description="Whether duct has 25mm acoustic fiberglass lining")


class DuctAcousticsRequest(BaseModel):
    fan_airflow_cfm: float = Field(default=1500, gt=0, description="Fan airflow in CFM")
    fan_static_pressure_in_wg: float = Field(default=1.5, gt=0, description="Fan total static pressure in inches wg")
    fan_type: str = Field(default="centrifugal_airfoil", description="centrifugal_airfoil, centrifugal_fc, vane_axial, or plug_fan")
    duct_sections: List[DuctSectionInput] = Field(default_factory=list, description="Straight duct segments from AHU to diffuser")
    num_mitered_elbows_with_vanes: int = Field(default=2, ge=0)
    num_mitered_elbows_without_vanes: int = Field(default=0, ge=0)
    has_duct_silencer: bool = Field(default=False, description="Dissipative silencer installed in duct run")
    branch_ratio: float = Field(default=0.5, gt=0, le=1.0, description="Ratio of branch duct airflow to main airflow")
    room_length_m: float = Field(default=6.0, gt=0)
    room_width_m: float = Field(default=4.0, gt=0)
    room_height_m: float = Field(default=3.0, gt=0)
    space_type: str = Field(default="private_office", description="Key from SPACE_ACOUSTIC_CRITERIA")
    distance_to_diffuser_m: float = Field(default=2.5, gt=0, description="Distance from diffuser to occupant ear level (m)")


class OctaveBandResult(BaseModel):
    frequency_hz: int
    fan_lw_db: float
    straight_duct_loss_db: float
    elbow_loss_db: float
    silencer_loss_db: float
    branch_split_loss_db: float
    end_reflection_loss_db: float
    diffuser_lw_db: float
    room_attenuation_db: float
    receiver_lp_db: float
    receiver_lpa_dba: float


class AcousticAnalysisResponse(BaseModel):
    space_type: str
    target_nc: int
    target_dba: float
    calculated_nc: int
    calculated_dba: float
    is_compliant: bool
    compliance_margin_nc: int
    compliance_margin_dba: float
    recommendation: str
    octave_bands: List[OctaveBandResult]
    total_absorption_sabins_metric: float
    room_constant_m2: float


def calculate_fan_sound_power(airflow_cfm: float, static_press_in_wg: float, fan_type: str = "centrifugal_airfoil") -> Dict[int, float]:
    """
    Computes fan octave-band sound power level (Lw in dB re 10^-12 W) per ASHRAE Fundamentals Chapter 8.
    Base Formula: Lw = Kw + 10*log10(Q_cfm) + 20*log10(P_in_wg) + Blade Frequency Increment (BFI)
    """
    q = max(50.0, airflow_cfm)
    p = max(0.1, static_press_in_wg)
    base_lw = 10.0 * math.log10(q) + 20.0 * math.log10(p)

    # Specific sound power Kw by octave band (63Hz to 8000Hz)
    kw_profiles = {
        "centrifugal_airfoil": [40, 42, 40, 37, 34, 30, 26, 22],
        "centrifugal_fc": [43, 44, 43, 41, 38, 33, 29, 24],
        "vane_axial": [43, 44, 46, 45, 43, 40, 36, 32],
        "plug_fan": [42, 43, 41, 39, 36, 32, 28, 23]
    }
    kw = kw_profiles.get(fan_type.lower(), kw_profiles["centrifugal_airfoil"])

    lw_dict = {}
    for idx, freq in enumerate(OCTAVE_BANDS):
        lw_dict[freq] = round(base_lw + kw[idx], 1)
    return lw_dict


def calculate_straight_duct_attenuation(sections: List[DuctSectionInput]) -> Dict[int, float]:
    """
    Computes straight duct insertion loss in dB per ASHRAE Table 17 / AHRI 885.
    Lined ducts provide significant mid/high frequency attenuation (up to 4-10 dB/m).
    Unlined sheet metal ducts provide ~0.1 - 0.6 dB/m.
    """
    total_loss = {freq: 0.0 for freq in OCTAVE_BANDS}

    # Rates in dB/meter
    unlined_loss_per_m = {63: 0.10, 125: 0.10, 250: 0.15, 500: 0.15, 1000: 0.20, 2000: 0.20, 4000: 0.25, 8000: 0.30}
    lined_loss_per_m = {63: 0.6, 125: 1.2, 250: 3.5, 500: 6.5, 1000: 8.5, 2000: 7.0, 4000: 5.5, 8000: 4.0}

    for sec in sections:
        loss_table = lined_loss_per_m if sec.is_internally_lined else unlined_loss_per_m
        for freq in OCTAVE_BANDS:
            total_loss[freq] += sec.length_m * loss_table[freq]

    return {freq: round(val, 2) for freq, val in total_loss.items()}


def calculate_elbow_attenuation(mitered_with_vanes: int, mitered_without_vanes: int) -> Dict[int, float]:
    """
    Computes 90-degree duct elbow insertion loss per ASHRAE Chapter 8.
    """
    loss_vaned = {63: 0.5, 125: 1.0, 250: 2.0, 500: 3.0, 1000: 3.0, 2000: 3.0, 4000: 2.0, 8000: 1.5}
    loss_unvaned = {63: 1.0, 125: 2.0, 250: 4.0, 500: 6.0, 1000: 5.0, 2000: 4.0, 4000: 3.0, 8000: 2.0}

    total = {}
    for freq in OCTAVE_BANDS:
        val = mitered_with_vanes * loss_vaned[freq] + mitered_without_vanes * loss_unvaned[freq]
        total[freq] = round(val, 2)
    return total


def calculate_silencer_attenuation(has_silencer: bool) -> Dict[int, float]:
    """
    Standard 1.5m dissipative duct silencer insertion loss per AHRI Standard 885.
    """
    if not has_silencer:
        return {freq: 0.0 for freq in OCTAVE_BANDS}
    # Standard acoustic silencer insertion loss curve (dB)
    silencer_il = {63: 4.0, 125: 8.0, 250: 16.0, 500: 24.0, 1000: 28.0, 2000: 22.0, 4000: 16.0, 8000: 12.0}
    return silencer_il


def calculate_branch_split_loss(ratio: float) -> Dict[int, float]:
    """
    Sound power split across duct junction: Loss = 10 * log10(1 / ratio)
    """
    clamped_ratio = max(0.01, min(1.0, ratio))
    loss_db = round(10.0 * math.log10(1.0 / clamped_ratio), 1)
    return {freq: loss_db for freq in OCTAVE_BANDS}


def calculate_end_reflection_loss(diffuser_size_mm: float = 300.0) -> Dict[int, float]:
    """
    Duct end reflection loss at room termination. Lower frequencies reflect back into the duct.
    Per ASHRAE: Significant at 63Hz and 125Hz.
    """
    end_loss = {63: 10.0, 125: 6.0, 250: 2.5, 500: 1.0, 1000: 0.0, 2000: 0.0, 4000: 0.0, 8000: 0.0}
    return end_loss


def calculate_room_absorption_and_lp(
    diffuser_lw: Dict[int, float],
    room_length: float,
    room_width: float,
    room_height: float,
    distance_to_receiver: float
) -> tuple[Dict[int, float], float, float]:
    """
    Calculates room acoustic absorption using the Sabine equation:
    A = sum(S_i * alpha_i)
    Room constant R = A / (1 - alpha_avg)
    Directivity factor Q = 2 (ceiling mounted diffuser radiating into quarter-space/hemisphere)
    Lp = Lw + 10 * log10( Q / (4 * pi * r^2) + 4 / R ) + 0.5
    """
    floor_area = room_length * room_width
    ceiling_area = floor_area
    wall_area = 2 * (room_length + room_width) * room_height
    total_surface = floor_area + ceiling_area + wall_area

    # Average absorption coefficients for typical commercial/residential room with acoustic ceiling & carpet
    alpha_table = {
        63: 0.15,
        125: 0.20,
        250: 0.25,
        500: 0.35,
        1000: 0.40,
        2000: 0.45,
        4000: 0.40,
        8000: 0.35
    }

    q_directivity = 2.0  # Hemispherical / Ceiling mount
    r_dist = max(0.5, distance_to_receiver)

    lp_dict = {}
    total_a_metric = 0.0
    r_metric = 0.0

    for freq in OCTAVE_BANDS:
        alpha = alpha_table[freq]
        a_room = total_surface * alpha
        if freq == 1000:
            total_a_metric = a_room
            r_metric = a_room / max(0.01, 1.0 - alpha)

        room_const = a_room / max(0.01, 1.0 - alpha)
        # Spatial sound propagation term
        geom_term = (q_directivity / (4.0 * math.pi * (r_dist ** 2))) + (4.0 / room_const)
        delta_lp = 10.0 * math.log10(max(1e-6, geom_term)) + 0.5
        lp = diffuser_lw[freq] + delta_lp
        lp_dict[freq] = round(max(0.0, lp), 1)

    return lp_dict, round(total_a_metric, 2), round(r_metric, 2)


def evaluate_nc_and_dba(receiver_lp: Dict[int, float]) -> tuple[int, float]:
    """
    Fits the octave-band sound pressure level (Lp) against ASHRAE NC curves (NC-20 to NC-65).
    The NC rating is the highest NC curve that contains the sound spectrum.
    Computes overall A-weighted sound level (dBA).
    """
    # 1. NC Determination
    evaluated_nc = 20
    for nc_name, curve_vals in sorted(NC_CURVES.items(), key=lambda x: int(x[0].replace("NC-", ""))):
        nc_val = int(nc_name.replace("NC-", ""))
        exceeded = False
        for idx, freq in enumerate(OCTAVE_BANDS):
            if receiver_lp[freq] > curve_vals[idx]:
                exceeded = True
                break
        if not exceeded:
            evaluated_nc = nc_val
            break
        else:
            evaluated_nc = nc_val + 5

    evaluated_nc = min(65, max(15, evaluated_nc))

    # 2. Overall dBA calculation
    # Sum of energetic contributions: L_A = 10 * log10( sum( 10^( (Lp_i + A_i) / 10 ) ) )
    energy_sum = 0.0
    for freq in OCTAVE_BANDS:
        lpa = receiver_lp[freq] + A_WEIGHTING_CORRECTIONS[freq]
        energy_sum += 10.0 ** (lpa / 10.0)

    overall_dba = round(10.0 * math.log10(max(1.0, energy_sum)), 1)
    return evaluated_nc, overall_dba


def perform_hvac_acoustic_analysis(req: DuctAcousticsRequest) -> AcousticAnalysisResponse:
    """
    Full end-to-end HVAC Acoustic Analysis per ASHRAE Fundamentals Chapter 8.
    """
    # 1. Fan Sound Power
    fan_lw = calculate_fan_sound_power(req.fan_airflow_cfm, req.fan_static_pressure_in_wg, req.fan_type)

    # 2. Straight Duct Attenuation
    straight_loss = calculate_straight_duct_attenuation(req.duct_sections)

    # 3. Elbow Attenuation
    elbow_loss = calculate_elbow_attenuation(req.num_mitered_elbows_with_vanes, req.num_mitered_elbows_without_vanes)

    # 4. Silencer
    silencer_loss = calculate_silencer_attenuation(req.has_duct_silencer)

    # 5. Branch Split
    branch_loss = calculate_branch_split_loss(req.branch_ratio)

    # 6. End Reflection
    end_loss = calculate_end_reflection_loss()

    # Diffuser Lw calculation
    diffuser_lw = {}
    octave_results: List[OctaveBandResult] = []

    for freq in OCTAVE_BANDS:
        tot_attenuation = (
            straight_loss[freq] +
            elbow_loss[freq] +
            silencer_loss[freq] +
            branch_loss[freq] +
            end_loss[freq]
        )
        d_lw = max(0.0, fan_lw[freq] - tot_attenuation)
        diffuser_lw[freq] = round(d_lw, 1)

    # 7. Room Sound Attenuation & Receiver Lp
    receiver_lp, total_abs, room_const = calculate_room_absorption_and_lp(
        diffuser_lw,
        req.room_length_m,
        req.room_width_m,
        req.room_height_m,
        req.distance_to_diffuser_m
    )

    # 8. NC & dBA
    calc_nc, calc_dba = evaluate_nc_and_dba(receiver_lp)

    for freq in OCTAVE_BANDS:
        lpa = round(receiver_lp[freq] + A_WEIGHTING_CORRECTIONS[freq], 1)
        room_att = round(diffuser_lw[freq] - receiver_lp[freq], 1)
        octave_results.append(OctaveBandResult(
            frequency_hz=freq,
            fan_lw_db=fan_lw[freq],
            straight_duct_loss_db=straight_loss[freq],
            elbow_loss_db=elbow_loss[freq],
            silencer_loss_db=silencer_loss[freq],
            branch_split_loss_db=branch_loss[freq],
            end_reflection_loss_db=end_loss[freq],
            diffuser_lw_db=diffuser_lw[freq],
            room_attenuation_db=room_att,
            receiver_lp_db=receiver_lp[freq],
            receiver_lpa_dba=lpa
        ))

    # Criteria lookup
    crit = SPACE_ACOUSTIC_CRITERIA.get(req.space_type, SPACE_ACOUSTIC_CRITERIA["private_office"])
    target_nc = crit["target_nc"]
    target_dba = float(crit["target_dba"])

    is_compliant = (calc_nc <= target_nc) and (calc_dba <= target_dba)
    margin_nc = target_nc - calc_nc
    margin_dba = round(target_dba - calc_dba, 1)

    if is_compliant:
        recommendation = f"ACOUSTIC COMPLIANT: Space satisfies {crit['description']} criteria (NC-{calc_nc} <= NC-{target_nc}, {calc_dba} dBA <= {target_dba} dBA)."
    else:
        recommendation = f"ACOUSTIC REMEDIATION REQUIRED: Measured NC-{calc_nc} exceeds target NC-{target_nc} ({calc_dba} dBA > {target_dba} dBA). Recommend adding 25mm acoustic duct lining or installing a packaged dissipative sound attenuator."

    return AcousticAnalysisResponse(
        space_type=req.space_type,
        target_nc=target_nc,
        target_dba=target_dba,
        calculated_nc=calc_nc,
        calculated_dba=calc_dba,
        is_compliant=is_compliant,
        compliance_margin_nc=margin_nc,
        compliance_margin_dba=margin_dba,
        recommendation=recommendation,
        octave_bands=octave_results,
        total_absorption_sabins_metric=total_abs,
        room_constant_m2=room_const
    )
