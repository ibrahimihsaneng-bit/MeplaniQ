"""
backend/electrical/circuits.py
==============================
Circuit specifications, conductor definitions, and topology calculations
for the meplaniq Electrical Layout & Routing System.
"""

from typing import Dict, Any, List, Optional

CIRCUIT_CATEGORY_SPECS: Dict[str, Dict[str, Any]] = {
    "lighting": {
        "label": "Lighting Circuit",
        "default_breaker_a": 10.0,
        "default_wire_gauge_sqmm": 1.5,
        "max_recommended_load_w": 800.0,
        "max_points": 10,
        "prefix": "L"
    },
    "fan": {
        "label": "Fan / Ventilation Circuit",
        "default_breaker_a": 10.0,
        "default_wire_gauge_sqmm": 1.5,
        "max_recommended_load_w": 600.0,
        "max_points": 8,
        "prefix": "F"
    },
    "general_socket": {
        "label": "5A General Power Sockets",
        "default_breaker_a": 16.0,
        "default_wire_gauge_sqmm": 2.5,
        "max_recommended_load_w": 1500.0,
        "max_points": 8,
        "prefix": "P"
    },
    "heavy_socket": {
        "label": "16A Heavy Power Sockets",
        "default_breaker_a": 20.0,
        "default_wire_gauge_sqmm": 4.0,
        "max_recommended_load_w": 3000.0,
        "max_points": 2,
        "prefix": "HP"
    },
    "ac_radial": {
        "label": "AC Dedicated Radial",
        "default_breaker_a": 20.0,
        "default_wire_gauge_sqmm": 4.0,
        "max_recommended_load_w": 2500.0,
        "max_points": 1,
        "prefix": "AC"
    },
    "geyser_radial": {
        "label": "Geyser Dedicated Radial",
        "default_breaker_a": 20.0,
        "default_wire_gauge_sqmm": 4.0,
        "max_recommended_load_w": 2500.0,
        "max_points": 1,
        "prefix": "GEY"
    }
}

CONDUCTOR_TYPES: Dict[str, Dict[str, Any]] = {
    "phase": {
        "label": "Phase / Live (L)",
        "color": "#F59E0B",
        "stroke_dasharray": "none",
        "description": "Current carrying line conductor"
    },
    "neutral": {
        "label": "Neutral (N)",
        "color": "#38BDF8",
        "stroke_dasharray": "4,3",
        "description": "Return conductor to source"
    },
    "earth": {
        "label": "Protective Earth (PE)",
        "color": "#10B981",
        "stroke_dasharray": "2,2",
        "description": "Equipment safety grounding"
    }
}

CONDUIT_TYPES: Dict[str, Dict[str, Any]] = {
    "pvc_rigid": {
        "label": "Rigid PVC Conduit",
        "color": "#94A3B8",
        "mounting": "surface"
    },
    "slab_conduit": {
        "label": "Ceiling Slab Embedded",
        "color": "#F59E0B",
        "mounting": "embedded_slab"
    },
    "wall_conduit": {
        "label": "Masonry Wall Chased",
        "color": "#64748B",
        "mounting": "embedded_wall"
    }
}


def get_circuit_defaults(category: str) -> Dict[str, Any]:
    cat = category.lower().strip()
    return CIRCUIT_CATEGORY_SPECS.get(cat, {
        "label": "General Circuit",
        "default_breaker_a": 16.0,
        "default_wire_gauge_sqmm": 2.5,
        "max_recommended_load_w": 1500.0,
        "max_points": 8,
        "prefix": "CKT"
    })


def generate_circuit_id(existing_ids: List[str], category: str = "lighting") -> str:
    spec = get_circuit_defaults(category)
    prefix = spec.get("prefix", "CKT")
    
    existing_upper = {i.upper() for i in existing_ids if i}
    count = 1
    candidate = f"{prefix}-{count}"
    while candidate.upper() in existing_upper:
        count += 1
        candidate = f"{prefix}-{count}"
    return candidate


def calculate_circuit_load(components: List[Dict[str, Any]]) -> float:
    """Calculates sum of wattages for all given components."""
    total = 0.0
    for c in components:
        w = c.get("wattage")
        if w is not None:
            try:
                total += float(w)
            except (ValueError, TypeError):
                pass
    return round(total, 2)


def validate_circuit_capacity(circuit: Dict[str, Any], components: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Checks if connected components exceed recommended circuit wattage or point counts.
    Returns status: 'optimal' | 'warning' | 'overloaded' with human-readable notes.
    """
    category = circuit.get("category", "lighting")
    spec = get_circuit_defaults(category)
    
    max_load = spec.get("max_recommended_load_w", 1500.0)
    max_points = spec.get("max_points", 10)
    
    total_load = calculate_circuit_load(components)
    point_count = len(components)
    
    warnings = []
    if total_load > max_load:
        warnings.append(f"Total load {total_load}W exceeds recommended {max_load}W for {category} circuit.")
    if point_count > max_points:
        warnings.append(f"Connected points ({point_count}) exceed recommended maximum ({max_points}).")
        
    return {
        "status": "warning" if warnings else "optimal",
        "total_load_w": total_load,
        "point_count": point_count,
        "max_recommended_load_w": max_load,
        "max_points": max_points,
        "warnings": warnings
    }


MV_PER_AMP_METER: Dict[float, float] = {
    1.5: 29.0,
    2.5: 18.0,
    4.0: 11.0,
    6.0: 7.3,
    10.0: 4.4,
    16.0: 2.8,
    25.0: 1.75,
    35.0: 1.25,
    50.0: 0.93,
    70.0: 0.63,
}


def calculate_voltage_drop(
    load_w: float,
    length_m: float,
    wire_gauge_sqmm: float = 1.5,
    voltage: float = 230.0,
    power_factor: float = 0.85
) -> Dict[str, Any]:
    """
    Computes single-phase circuit voltage drop according to IEC 60364-5-52 / BS 7671.
    Formula: Vd = (mV/A/m * Ib * L) / 1000
    """
    if voltage <= 0 or power_factor <= 0:
        return {"v_drop_v": 0.0, "v_drop_percent": 0.0, "is_compliant": True}

    current_a = round(load_w / (voltage * power_factor), 2)
    mv_per_a_m = MV_PER_AMP_METER.get(wire_gauge_sqmm, 29.0)

    v_drop_v = round((mv_per_a_m * current_a * length_m) / 1000.0, 2)
    v_drop_percent = round((v_drop_v / voltage) * 100.0, 2)

    return {
        "load_w": load_w,
        "current_a": current_a,
        "length_m": length_m,
        "wire_gauge_sqmm": wire_gauge_sqmm,
        "v_drop_v": v_drop_v,
        "v_drop_percent": v_drop_percent,
        "mv_per_a_m": mv_per_a_m
    }


def verify_circuit_voltage_drop(
    circuit: Dict[str, Any],
    length_m: float = 20.0,
    voltage: float = 230.0
) -> Dict[str, Any]:
    """
    Verifies circuit voltage drop against IEC 60364-5-52 limits:
    - Lighting: <= 3.0%
    - Small Power / Other: <= 5.0%
    """
    category = circuit.get("category", "lighting").lower()
    is_lighting = "light" in category
    max_drop = 3.0 if is_lighting else 5.0

    load_w = float(circuit.get("total_load_w", 500.0))
    wire_gauge = float(circuit.get("wire_gauge_sqmm", 1.5 if is_lighting else 2.5))

    vd_result = calculate_voltage_drop(load_w, length_m, wire_gauge, voltage=voltage)
    is_compliant = vd_result["v_drop_percent"] <= max_drop

    recommended_gauge = wire_gauge
    if not is_compliant:
        for gauge in sorted(MV_PER_AMP_METER.keys()):
            if gauge > wire_gauge:
                test_vd = calculate_voltage_drop(load_w, length_m, gauge, voltage=voltage)
                if test_vd["v_drop_percent"] <= max_drop:
                    recommended_gauge = gauge
                    break

    return {
        **vd_result,
        "max_allowed_drop_percent": max_drop,
        "is_compliant": is_compliant,
        "recommended_wire_gauge_sqmm": recommended_gauge,
        "upsize_required": recommended_gauge > wire_gauge
    }

