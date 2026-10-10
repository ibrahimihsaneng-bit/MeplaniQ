"""
backend/electrical/validation.py
================================
Validation routines for electrical components, circuits, and wire routes.
Ensures topological consistency and parameter safety.
"""

from typing import Dict, Any, List, Optional
from backend.electrical.fixtures import get_fixture_definition
from backend.electrical.circuits import CIRCUIT_CATEGORY_SPECS


def validate_component_data(
    comp_dict: Dict[str, Any],
    existing_hvac_units: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Validates and normalizes component data dictionary.
    Returns the sanitized dictionary or raises ValueError.
    """
    comp_type = comp_dict.get("type", "recessed_downlight")
    fixture_spec = get_fixture_definition(comp_type)

    # Coordinates
    try:
        x = float(comp_dict.get("x", 0.0))
        y = float(comp_dict.get("y", 0.0))
    except (ValueError, TypeError):
        raise ValueError("Component x and y must be valid numeric coordinates.")

    wattage = comp_dict.get("wattage")
    if wattage is None:
        wattage = fixture_spec.get("default_wattage", 15.0)
    else:
        try:
            wattage = float(wattage)
            if wattage < 0:
                wattage = 0.0
        except (ValueError, TypeError):
            wattage = fixture_spec.get("default_wattage", 15.0)

    mounting = comp_dict.get("mounting") or fixture_spec.get("mounting", "ceiling")
    category = comp_dict.get("category") or fixture_spec.get("category", "lighting")
    name = comp_dict.get("name") or fixture_spec.get("label", comp_type)
    symbol = comp_dict.get("symbol") or fixture_spec.get("symbol", "generic_box")
    width_mm = float(comp_dict.get("width_mm") or fixture_spec.get("width_mm", 100.0))
    height_mm = float(comp_dict.get("height_mm") or fixture_spec.get("height_mm", 100.0))

    try:
        rotation = float(comp_dict.get("rotation", 0.0)) % 360.0
    except (ValueError, TypeError):
        rotation = 0.0

    linked_hvac_id = comp_dict.get("linked_hvac_id")
    if linked_hvac_id and existing_hvac_units:
        hvac_ids = {h.get("id") for h in existing_hvac_units if h.get("id")}
        if linked_hvac_id not in hvac_ids:
            # Not a hard failure, but preserve or warn
            pass

    return {
        "id": comp_dict.get("id"),
        "type": comp_type,
        "name": name,
        "category": category,
        "mounting": mounting,
        "wattage": round(wattage, 1),
        "voltage": float(comp_dict.get("voltage", 230.0)),
        "phase": comp_dict.get("phase", "1PH"),
        "circuit_id": comp_dict.get("circuit_id"),
        "host_room_id": comp_dict.get("host_room_id"),
        "host_room_name": comp_dict.get("host_room_name"),
        "linked_hvac_id": linked_hvac_id,
        "x": round(x, 1),
        "y": round(y, 1),
        "z_mounting_height_mm": comp_dict.get("z_mounting_height_mm"),
        "rotation": round(rotation, 1),
        "width_mm": round(width_mm, 1),
        "height_mm": round(height_mm, 1),
        "symbol": symbol,
        "snapped_to_wall": bool(comp_dict.get("snapped_to_wall", False)),
        "wall_normal_angle": float(comp_dict.get("wall_normal_angle", 0.0)),
        "properties": comp_dict.get("properties") or {}
    }


def validate_circuit_data(
    circuit_dict: Dict[str, Any],
    all_components: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Validates and normalizes circuit data dictionary.
    """
    name = (circuit_dict.get("name") or "").strip()
    if not name:
        name = "Circuit"

    category = (circuit_dict.get("category") or "lighting").lower().strip()
    if category not in CIRCUIT_CATEGORY_SPECS:
        category = "lighting"

    spec = CIRCUIT_CATEGORY_SPECS[category]

    breaker_a = circuit_dict.get("breaker_rating_a")
    if breaker_a is None:
        breaker_a = spec["default_breaker_a"]
    else:
        try:
            breaker_a = max(1.0, float(breaker_a))
        except (ValueError, TypeError):
            breaker_a = spec["default_breaker_a"]

    wire_gauge = circuit_dict.get("wire_gauge_sqmm")
    if wire_gauge is None:
        wire_gauge = spec["default_wire_gauge_sqmm"]
    else:
        try:
            wire_gauge = max(0.5, float(wire_gauge))
        except (ValueError, TypeError):
            wire_gauge = spec["default_wire_gauge_sqmm"]

    connected_ids = circuit_dict.get("connected_component_ids") or []
    if all_components:
        valid_comp_ids = {c.get("id") for c in all_components if c.get("id")}
        connected_ids = [cid for cid in connected_ids if cid in valid_comp_ids]

    return {
        "id": circuit_dict.get("id"),
        "name": name,
        "category": category,
        "source_db_id": circuit_dict.get("source_db_id"),
        "switch_id": circuit_dict.get("switch_id"),
        "breaker_rating_a": round(breaker_a, 1),
        "wire_gauge_sqmm": round(wire_gauge, 1),
        "connected_component_ids": connected_ids,
        "total_load_w": float(circuit_dict.get("total_load_w", 0.0)),
        "voltage": float(circuit_dict.get("voltage", 230.0)),
        "phase_designation": circuit_dict.get("phase_designation", "R"),
        "status": circuit_dict.get("status", "active"),
        "properties": circuit_dict.get("properties") or {}
    }


def validate_wire_route_data(route_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates wire route polyline points and conduit type.
    """
    points = route_dict.get("points") or []
    if len(points) < 2:
        raise ValueError("Wire route must have at least 2 coordinate points [start, end].")

    sanitized_pts = []
    for p in points:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            raise ValueError("Route point must be a list of two numeric coordinates [x, y].")
        try:
            sanitized_pts.append([round(float(p[0]), 1), round(float(p[1]), 1)])
        except (ValueError, TypeError):
            raise ValueError("Route point coordinates must be valid numbers.")

    conduit_type = route_dict.get("conduit_type", "slab_conduit")
    conductors = route_dict.get("conductors") or ["phase", "neutral", "earth"]

    return {
        "id": route_dict.get("id"),
        "circuit_id": route_dict.get("circuit_id"),
        "from_component_id": route_dict.get("from_component_id"),
        "to_component_id": route_dict.get("to_component_id"),
        "conduit_type": conduit_type,
        "conductors": conductors,
        "points": sanitized_pts,
        "length_mm": float(route_dict.get("length_mm", 0.0)),
        "is_auto_generated": bool(route_dict.get("is_auto_generated", False)),
        "properties": route_dict.get("properties") or {}
    }
