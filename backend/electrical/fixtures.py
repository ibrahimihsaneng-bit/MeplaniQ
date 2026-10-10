"""
backend/electrical/fixtures.py
==============================
Master Fixture Registry for meplaniq Electrical Layout & Routing System.
Defines specifications, mounting types, ratings, categories, and ID prefixes for all 16 standard fixtures.
"""

from typing import Dict, Any, List

ELECTRICAL_FIXTURE_TYPES: Dict[str, Dict[str, Any]] = {
    # 1. LIGHTING
    "recessed_downlight": {
        "category": "lighting",
        "label": "Recessed Downlight",
        "mounting": "ceiling",
        "default_wattage": 12.0,
        "width_mm": 200.0,
        "height_mm": 200.0,
        "symbol": "circle_cross",
        "prefix": "DL"
    },
    "linear_tube_light": {
        "category": "lighting",
        "label": "Linear / Tube Light",
        "mounting": "ceiling",
        "default_wattage": 20.0,
        "width_mm": 1200.0,
        "height_mm": 100.0,
        "symbol": "linear_tube",
        "prefix": "TL"
    },
    "wall_sconce": {
        "category": "lighting",
        "label": "Wall Sconce",
        "mounting": "wall",
        "default_wattage": 10.0,
        "width_mm": 150.0,
        "height_mm": 120.0,
        "symbol": "semicircle_rays",
        "prefix": "WS"
    },
    "chandelier": {
        "category": "lighting",
        "label": "Chandelier",
        "mounting": "ceiling",
        "default_wattage": 60.0,
        "width_mm": 600.0,
        "height_mm": 600.0,
        "symbol": "chandelier_cluster",
        "prefix": "CH"
    },
    "outdoor_bulkhead": {
        "category": "lighting",
        "label": "Outdoor / Bulkhead Light",
        "mounting": "wall",
        "default_wattage": 15.0,
        "width_mm": 220.0,
        "height_mm": 150.0,
        "symbol": "bulkhead_oval",
        "prefix": "OB"
    },

    # 2. FANS / VENTILATION
    "ceiling_fan": {
        "category": "ventilation",
        "label": "Ceiling Fan",
        "mounting": "ceiling",
        "default_wattage": 75.0,
        "width_mm": 1200.0,
        "height_mm": 1200.0,
        "symbol": "three_blade_fan",
        "prefix": "FAN"
    },
    "exhaust_fan": {
        "category": "ventilation",
        "label": "Exhaust Fan",
        "mounting": "wall",
        "default_wattage": 40.0,
        "width_mm": 300.0,
        "height_mm": 300.0,
        "symbol": "exhaust_box",
        "prefix": "EF"
    },

    # 3. SWITCHES
    "single_switch": {
        "category": "switch",
        "label": "Single-Gang Rocker Switch",
        "mounting": "wall",
        "default_wattage": 0.0,
        "width_mm": 100.0,
        "height_mm": 100.0,
        "symbol": "switch_rocker",
        "prefix": "SW"
    },
    "multi_gang_switch": {
        "category": "switch",
        "label": "Multi-Gang Switchboard",
        "mounting": "wall",
        "default_wattage": 0.0,
        "width_mm": 250.0,
        "height_mm": 100.0,
        "symbol": "switch_multi",
        "prefix": "MSW"
    },
    "two_way_switch": {
        "category": "switch",
        "label": "Two-Way Switch",
        "mounting": "wall",
        "default_wattage": 0.0,
        "width_mm": 100.0,
        "height_mm": 100.0,
        "symbol": "switch_twoway",
        "prefix": "2W"
    },
    "dimmer_switch": {
        "category": "switch",
        "label": "Dimmer Switch",
        "mounting": "wall",
        "default_wattage": 0.0,
        "width_mm": 100.0,
        "height_mm": 100.0,
        "symbol": "switch_dimmer",
        "prefix": "DIM"
    },

    # 4. DISTRIBUTION
    "main_db": {
        "category": "distribution",
        "label": "Main Distribution Board (MDB)",
        "mounting": "wall",
        "default_wattage": 0.0,
        "width_mm": 500.0,
        "height_mm": 200.0,
        "symbol": "main_db_panel",
        "prefix": "DB"
    },

    # 5. POWER SOCKETS & RADIALS
    "socket_5a": {
        "category": "socket",
        "label": "5A General Power Socket",
        "mounting": "wall",
        "default_wattage": 100.0,
        "width_mm": 100.0,
        "height_mm": 100.0,
        "symbol": "socket_single",
        "prefix": "S5"
    },
    "socket_16a": {
        "category": "socket",
        "label": "16A Heavy Power Socket",
        "mounting": "wall",
        "default_wattage": 1500.0,
        "width_mm": 120.0,
        "height_mm": 120.0,
        "symbol": "socket_heavy",
        "prefix": "S16"
    },
    "ac_isolator_20a": {
        "category": "hvac_power",
        "label": "AC Isolator / 20A Radial",
        "mounting": "wall",
        "default_wattage": 2500.0,
        "width_mm": 150.0,
        "height_mm": 150.0,
        "symbol": "ac_isolator",
        "prefix": "AC"
    },
    "geyser_switch": {
        "category": "water_heater",
        "label": "Geyser Switch / 20A Radial",
        "mounting": "wall",
        "default_wattage": 2000.0,
        "width_mm": 120.0,
        "height_mm": 120.0,
        "symbol": "geyser_radial",
        "prefix": "GEY"
    }
}


def get_fixture_definition(type_key: str) -> Dict[str, Any]:
    """Retrieves definition dictionary for a given fixture type, or returns a safe fallback."""
    clean_key = type_key.lower().strip()
    if clean_key in ELECTRICAL_FIXTURE_TYPES:
        return ELECTRICAL_FIXTURE_TYPES[clean_key]
    
    # Fuzzy fallback matching
    for key, spec in ELECTRICAL_FIXTURE_TYPES.items():
        if key in clean_key or clean_key in key:
            return spec

    return {
        "category": "general",
        "label": type_key.title(),
        "mounting": "wall",
        "default_wattage": 50.0,
        "width_mm": 150.0,
        "height_mm": 150.0,
        "symbol": "generic_box",
        "prefix": "EL"
    }


def generate_component_id(type_key: str, existing_ids: List[str]) -> str:
    """Generates a clean sequential ID such as DL-1, FAN-2, S16-1."""
    spec = get_fixture_definition(type_key)
    prefix = spec.get("prefix", "EL")
    
    existing_upper = {i.upper() for i in existing_ids if i}
    count = 1
    candidate = f"{prefix}-{count}"
    while candidate.upper() in existing_upper:
        count += 1
        candidate = f"{prefix}-{count}"
    return candidate
