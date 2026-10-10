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
