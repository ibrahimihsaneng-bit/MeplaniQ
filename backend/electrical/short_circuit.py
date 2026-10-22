"""
backend/electrical/short_circuit.py
===================================
IEC 60909-0:2016 & IEEE 141 (Red Book) Short-Circuit Fault Current Analysis
and Protective Device Breaking Capacity Verification Engine.

Calculates:
- Network Source & Transformer Impedance (Z_Q, Z_T)
- Feeder Cable Resistance & Reactance (R_k, X_k, Z_k)
- Symmetrical Prospective Initial Short-Circuit Current (I_k'')
- Peak Factor (kappa) and Peak Asymmetrical Dynamic Current (i_p)
- Breaking Capacity Verification for Protective Devices (I_cu / I_cn per IEC 60947-2 & IEC 60898-1)
- Conductor Adiabatic Thermal Withstand (k²S² >= I²t per IEC 60364-5-54)
"""

import math
from typing import Dict, Any, List, Optional


def calculate_transformer_impedance(
    rated_kva: float = 160.0,
    primary_kv: float = 11.0,
    secondary_v: float = 415.0,
    uk_percent: float = 4.0,
    load_loss_w: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes distribution transformer impedance referred to low-voltage secondary side.
    Per IEC 60909-0 Clause 6.3.2.
    """
    if rated_kva <= 0 or secondary_v <= 0:
        return {"z_t_ohm": 0.0, "r_t_ohm": 0.0, "x_t_ohm": 0.0}

    rated_va = rated_kva * 1000.0
    u_n2 = secondary_v

    # Total transformer impedance Z_T = (u_k / 100) * (U_n^2 / S_rT)
    z_t = (uk_percent / 100.0) * (u_n2 ** 2) / rated_va

    # Nominal copper load loss P_krT estimate (~1.5% of kVA if not specified)
    p_krt = load_loss_w if load_loss_w is not None else (0.015 * rated_va)
    r_t = p_krt * (u_n2 ** 2) / (rated_va ** 2)

    # Reactance X_T = sqrt(Z_T^2 - R_T^2)
    x_t = math.sqrt(max(0.0, (z_t ** 2) - (r_t ** 2)))

    return {
        "rated_kva": rated_kva,
        "secondary_v": secondary_v,
        "uk_percent": uk_percent,
        "z_t_ohm": round(z_t, 6),
        "r_t_ohm": round(r_t, 6),
        "x_t_ohm": round(x_t, 6),
        "z_t_mohm": round(z_t * 1000.0, 3),
        "r_t_mohm": round(r_t * 1000.0, 3),
        "x_t_mohm": round(x_t * 1000.0, 3),
    }


def calculate_cable_impedance(
    length_m: float,
    cross_section_sqmm: float,
    conductor_material: str = "copper",
    temp_c: float = 20.0,
    reactance_mohm_per_m: float = 0.08
) -> Dict[str, Any]:
    """
    Computes cable resistance and reactance at reference temperature.
    For maximum short circuit current, conductor resistance is calculated at 20°C (IEC 60909-0 Clause 5.3).
    """
    if length_m <= 0 or cross_section_sqmm <= 0:
        return {"r_ohm": 0.0, "x_ohm": 0.0, "z_ohm": 0.0}

    # Resistivity rho: Copper = 0.017241 ohm.mm²/m at 20°C, Aluminum = 0.028264
    rho_20 = 0.017241 if conductor_material.lower() == "copper" else 0.028264
    temp_coeff = 0.00393 if conductor_material.lower() == "copper" else 0.00403
    rho_t = rho_20 * (1.0 + temp_coeff * (temp_c - 20.0))

    r_cable = (rho_t * length_m) / cross_section_sqmm
    x_cable = (reactance_mohm_per_m / 1000.0) * length_m
    z_cable = math.hypot(r_cable, x_cable)

    return {
        "length_m": length_m,
        "cross_section_sqmm": cross_section_sqmm,
        "r_ohm": round(r_cable, 6),
        "x_ohm": round(x_cable, 6),
        "z_ohm": round(z_cable, 6),
        "r_mohm": round(r_cable * 1000.0, 3),
        "x_mohm": round(x_cable * 1000.0, 3),
        "z_mohm": round(z_cable * 1000.0, 3),
    }


def calculate_peak_factor_kappa(r_over_x: float) -> float:
    """
    Calculates the peak factor kappa for asymmetrical short-circuit current per IEC 60909-0:
    kappa = 1.02 + 0.98 * e^(-3 * R/X)
    """
    if r_over_x < 0:
        return 1.02
    return round(1.02 + 0.98 * math.exp(-3.0 * r_over_x), 3)


def calculate_fault_point_iec60909(
    point_name: str,
    r_cumulative_ohm: float,
    x_cumulative_ohm: float,
    voltage_line_v: float = 415.0,
    voltage_factor_c: float = 1.05,
    breaker_rating_a: float = 100.0,
    breaker_type: str = "MCCB",
    rated_icu_ka: float = 25.0,
    is_three_phase: bool = True,
    conductor_size_sqmm: float = 25.0,
    fault_clearance_time_s: float = 0.04
) -> Dict[str, Any]:
    """
    Calculates prospective symmetrical initial short-circuit current (I_k''),
    peak dynamic current (i_p), and verifies protective device breaking capacity.
    """
    z_k = math.hypot(r_cumulative_ohm, x_cumulative_ohm)
    if z_k <= 0:
        z_k = 0.0001

    r_over_x = r_cumulative_ohm / x_cumulative_ohm if x_cumulative_ohm > 0 else 1.0
    kappa = calculate_peak_factor_kappa(r_over_x)

    # Voltage calculation:
    # 3-Phase fault: I_k'' = (c * U_n) / (sqrt(3) * Z_k)
    # 1-Phase fault: I_k'' = (c * U_n_phase) / Z_k_loop
    if is_three_phase:
        nom_v = voltage_line_v
        i_k_double_prime = (voltage_factor_c * nom_v) / (math.sqrt(3.0) * z_k)
    else:
        phase_v = voltage_line_v / math.sqrt(3.0)
        i_k_double_prime = (voltage_factor_c * phase_v) / z_k

    i_k_ka = round(i_k_double_prime / 1000.0, 2)

    # Peak dynamic current: i_p = kappa * sqrt(2) * I_k''
    i_p_ka = round(kappa * math.sqrt(2.0) * i_k_ka, 2)

    # Breaking Capacity verification
    is_breaking_capacity_adequate = rated_icu_ka >= i_k_ka
    safety_margin_percent = round(((rated_icu_ka - i_k_ka) / rated_icu_ka) * 100.0, 1)

    # Adiabatic Thermal Conductor Withstand (IEC 60364-5-54)
    # k factor: 115 for PVC copper, 143 for XLPE copper
    k_factor = 115.0
    withstand_current_ka = round((k_factor * conductor_size_sqmm / math.sqrt(fault_clearance_time_s)) / 1000.0, 2)
    is_thermal_withstand_safe = withstand_current_ka >= i_k_ka

    return {
        "point_name": point_name,
        "is_three_phase": is_three_phase,
        "nominal_voltage_v": voltage_line_v,
        "r_k_mohm": round(r_cumulative_ohm * 1000.0, 3),
        "x_k_mohm": round(x_cumulative_ohm * 1000.0, 3),
        "z_k_mohm": round(z_k * 1000.0, 3),
        "r_over_x": round(r_over_x, 3),
        "kappa": kappa,
        "ik_double_prime_ka": i_k_ka,
        "ip_peak_ka": i_p_ka,
        "breaker_type": breaker_type,
        "breaker_rating_a": breaker_rating_a,
        "rated_icu_ka": rated_icu_ka,
        "is_breaking_capacity_adequate": is_breaking_capacity_adequate,
        "safety_margin_percent": safety_margin_percent,
        "conductor_size_sqmm": conductor_size_sqmm,
        "thermal_withstand_ka": withstand_current_ka,
        "is_thermal_withstand_safe": is_thermal_withstand_safe,
        "status": "PASS_COMPLIANT" if (is_breaking_capacity_adequate and is_thermal_withstand_safe) else "RUPTURE_HAZARD"
    }


def analyze_building_electrical_network_faults(
    transformer_kva: float = 160.0,
    utility_fault_mva: float = 250.0,
    sub_feeders: Optional[List[Dict[str, Any]]] = None,
    branch_circuits: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Executes full multi-tier short-circuit fault current study across the complete electrical distribution tree:
    1. Grid Incomer Source (Utility)
    2. Distribution Transformer LV Terminals
    3. Main Distribution Board (MDB-01) Incomer Busbar
    4. Sub-Distribution Boards (SMDB-01, DB-L1-LGT, DB-L1-PWR)
    5. Representative Final Branch Circuits
    """
    # 1. Grid Source Incomer Impedance referred to 415V
    u_n_lv = 415.0
    c_factor = 1.05
    s_kq_va = utility_fault_mva * 1e6
    z_q = (c_factor * (u_n_lv ** 2)) / s_kq_va
    r_q = 0.1 * z_q  # Standard network assumption X_Q >> R_Q
    x_q = math.sqrt(max(0.0, z_q ** 2 - r_q ** 2))

    # 2. Transformer Impedance (160kVA, uk=4%)
    tx = calculate_transformer_impedance(rated_kva=transformer_kva, secondary_v=u_n_lv, uk_percent=4.0)
    r_t = tx["r_t_ohm"]
    x_t = tx["x_t_ohm"]

    # Cumulative at Transformer Secondary Terminals
    r_cum = r_q + r_t
    x_cum = x_q + x_t

    hierarchy_nodes: List[Dict[str, Any]] = []

    # Node 1: Transformer LV Bushings
    tx_node = calculate_fault_point_iec60909(
        point_name="TX-01 LV Secondary Bushings",
        r_cumulative_ohm=r_cum,
        x_cumulative_ohm=x_cum,
        voltage_line_v=u_n_lv,
        breaker_rating_a=250.0,
        breaker_type="ACB / Incomer Isolator",
        rated_icu_ka=50.0,
        conductor_size_sqmm=120.0
    )
    hierarchy_nodes.append(tx_node)

    # 3. Main Distribution Board (MDB-01)
    # Feeder: 12m of 4x70mm² Copper
    main_feeder = calculate_cable_impedance(length_m=12.0, cross_section_sqmm=70.0)
    r_cum += main_feeder["r_ohm"]
    x_cum += main_feeder["x_ohm"]

    mdb_node = calculate_fault_point_iec60909(
        point_name="MDB-01 Main Incomer Busbar",
        r_cumulative_ohm=r_cum,
        x_cumulative_ohm=x_cum,
        voltage_line_v=u_n_lv,
        breaker_rating_a=200.0,
        breaker_type="MCCB",
        rated_icu_ka=25.0,
        conductor_size_sqmm=70.0
    )
    hierarchy_nodes.append(mdb_node)

    # 4. Sub-Main Distribution Board (SMDB-01)
    # Feeder: 25m of 4x25mm² Copper
    smdb_feeder = calculate_cable_impedance(length_m=25.0, cross_section_sqmm=25.0)
    r_smdb = r_cum + smdb_feeder["r_ohm"]
    x_smdb = x_cum + smdb_feeder["x_ohm"]

    smdb_node = calculate_fault_point_iec60909(
        point_name="SMDB-01 Floor Sub-Main Board",
        r_cumulative_ohm=r_smdb,
        x_cumulative_ohm=x_smdb,
        voltage_line_v=u_n_lv,
        breaker_rating_a=63.0,
        breaker_type="MCCB",
        rated_icu_ka=16.0,
        conductor_size_sqmm=25.0
    )
    hierarchy_nodes.append(smdb_node)

    # 5. Final Distribution Board DB-L1-PWR (Power)
    # Feeder: 15m of 4x10mm² Copper
    db_pwr_feeder = calculate_cable_impedance(length_m=15.0, cross_section_sqmm=10.0)
    r_db_pwr = r_smdb + db_pwr_feeder["r_ohm"]
    x_db_pwr = x_smdb + db_pwr_feeder["x_ohm"]

    db_pwr_node = calculate_fault_point_iec60909(
        point_name="DB-L1-PWR Distribution Board",
        r_cumulative_ohm=r_db_pwr,
        x_cumulative_ohm=x_db_pwr,
        voltage_line_v=u_n_lv,
        breaker_rating_a=40.0,
        breaker_type="MCB / ELCB",
        rated_icu_ka=10.0,
        conductor_size_sqmm=10.0
    )
    hierarchy_nodes.append(db_pwr_node)

    # 6. Final Distribution Board DB-L1-LGT (Lighting)
    # Feeder: 18m of 4x6mm² Copper
    db_lgt_feeder = calculate_cable_impedance(length_m=18.0, cross_section_sqmm=6.0)
    r_db_lgt = r_smdb + db_lgt_feeder["r_ohm"]
    x_db_lgt = x_smdb + db_lgt_feeder["x_ohm"]

    db_lgt_node = calculate_fault_point_iec60909(
        point_name="DB-L1-LGT Distribution Board",
        r_cumulative_ohm=r_db_lgt,
        x_cumulative_ohm=x_db_lgt,
        voltage_line_v=u_n_lv,
        breaker_rating_a=32.0,
        breaker_type="MCB",
        rated_icu_ka=10.0,
        conductor_size_sqmm=6.0
    )
    hierarchy_nodes.append(db_lgt_node)

    # 7. Final Branch Circuit Socket Outlet (230V 1PH, 20m of 2.5mm² Cu)
    # Single-phase loop impedance requires 2 * cable run (phase + neutral)
    socket_branch = calculate_cable_impedance(length_m=20.0, cross_section_sqmm=2.5)
    r_socket = r_db_pwr + (2.0 * socket_branch["r_ohm"])
    x_socket = x_db_pwr + (2.0 * socket_branch["x_ohm"])

    socket_node = calculate_fault_point_iec60909(
        point_name="Branch Sockets (Kitchen / Living Outlets)",
        r_cumulative_ohm=r_socket,
        x_cumulative_ohm=x_socket,
        voltage_line_v=u_n_lv,
        breaker_rating_a=16.0,
        breaker_type="MCB Type C",
        rated_icu_ka=6.0,
        is_three_phase=False,
        conductor_size_sqmm=2.5
    )
    hierarchy_nodes.append(socket_node)

    # 8. Final Branch Circuit Lighting Point (230V 1PH, 25m of 1.5mm² Cu)
    light_branch = calculate_cable_impedance(length_m=25.0, cross_section_sqmm=1.5)
    r_light = r_db_lgt + (2.0 * light_branch["r_ohm"])
    x_light = x_db_lgt + (2.0 * light_branch["x_ohm"])

    light_node = calculate_fault_point_iec60909(
        point_name="Branch Lighting Points (Ceiling Luminaires)",
        r_cumulative_ohm=r_light,
        x_cumulative_ohm=x_light,
        voltage_line_v=u_n_lv,
        breaker_rating_a=10.0,
        breaker_type="MCB Type B",
        rated_icu_ka=6.0,
        is_three_phase=False,
        conductor_size_sqmm=1.5
    )
    hierarchy_nodes.append(light_node)

    # Network summary metrics
    max_ik_ka = max(n["ik_double_prime_ka"] for n in hierarchy_nodes)
    max_ip_ka = max(n["ip_peak_ka"] for n in hierarchy_nodes)
    min_safety_margin = min(n["safety_margin_percent"] for n in hierarchy_nodes)
    all_compliant = all(n["is_breaking_capacity_adequate"] and n["is_thermal_withstand_safe"] for n in hierarchy_nodes)

    return {
        "standard": "IEC 60909-0:2016 / IEEE 141 (Red Book)",
        "grid_supply_fault_mva": utility_fault_mva,
        "transformer_kva": transformer_kva,
        "nominal_system_voltage_v": u_n_lv,
        "voltage_factor_c": c_factor,
        "source_impedance": {
            "grid_z_mohm": round(z_q * 1000.0, 3),
            "transformer_z_mohm": tx["z_t_mohm"],
            "transformer_r_mohm": tx["r_t_mohm"],
            "transformer_x_mohm": tx["x_t_mohm"],
        },
        "max_prospective_ik_ka": max_ik_ka,
        "max_peak_dynamic_ip_ka": max_ip_ka,
        "min_safety_margin_percent": min_safety_margin,
        "all_compliant": all_compliant,
        "overall_status": "IEC_COMPLIANT" if all_compliant else "DEVICE_UNDER_RATED_WARNING",
        "nodes": hierarchy_nodes
    }
