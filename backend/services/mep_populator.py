"""
backend/services/mep_populator.py
=================================
Automated Room-Based MEP (Mechanical, Electrical, Plumbing) & Architectural Furniture Populator.

Deterministically populates standard engineering equipment and architectural items
based on room geometry, room type, and anthropometric architectural guidelines:
1. Electrical Components: Ceiling fans, downlights/tubes, switchboards, heavy & general sockets, AC isolators, DB.
2. Electrical Circuits & Orthogonal Conduits: Lighting, power, AC circuits with Manhattan wire routes.
3. HVAC Equipment: Split-IDU units paired with outdoor ODU condensers sized by room cooling load.
4. Architectural Blocks / Furniture: Beds, dining tables, sofas, sanitary fixtures (WC, basin).
"""

import math
from typing import List, Dict, Any, Optional, Tuple
from backend.database import get_project_by_id, update_project_cad_data
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    HVACEquipmentPayload,
    FurniturePayload,
    process_geometry_solve_v2,
    SolveResponse
)
from backend.models import PlumbingFixturePayload, PlumbingPipePayload
from backend.plumbing_router import auto_route_plumbing
from backend.electrical.fixtures import ELECTRICAL_FIXTURE_TYPES
from backend.electrical.routing import generate_circuit_routes
from backend.services.area_to_plan import generate_default_openings



def _get_room_bounds(room_dict: Dict[str, Any]) -> Tuple[float, float, float, float, float, float, float, float]:
    """Returns (min_x, max_x, min_y, max_y, width, depth, cx, cy) for a room."""
    pts = room_dict.get("points", [])
    if not pts:
        return 0.0, 3000.0, 0.0, 3000.0, 3000.0, 3000.0, 1500.0, 1500.0
    xs = [float(p[0]) for p in pts]
    ys = [float(p[1]) for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max(1000.0, max_x - min_x)
    d = max(1000.0, max_y - min_y)
    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    return min_x, max_x, min_y, max_y, w, d, cx, cy


def _classify_room(name: str) -> str:
    """Classifies a room name into a standard room functional type."""
    n = (name or "").lower().strip()
    if "living" in n or "hall" in n or "drawing" in n or "lounge" in n or "foyer" in n:
        return "living"
    if "dining" in n:
        return "dining"
    if "kitchen" in n or "pantry" in n or "utility" in n:
        return "kitchen"
    if "master" in n and ("bed" in n or "room" in n):
        return "master_bedroom"
    if "bed" in n:
        return "bedroom"
    if "master" in n and ("bath" in n or "toilet" in n):
        return "master_bathroom"
    if "bath" in n or "toilet" in n or "powder" in n or "wc" in n or "wash" in n:
        return "bathroom"
    if "balcony" in n or "porch" in n or "verandah" in n:
        return "balcony"
    return "general"


def generate_room_mep(
    room: Dict[str, Any],
    room_index: int = 1,
    existing_comp_ids: Optional[set] = None,
    include_electrical: bool = True,
    include_hvac: bool = True,
    include_furniture: bool = True,
    include_plumbing: bool = True
) -> Dict[str, Any]:
    """
    Generates deterministic electrical components, HVAC units, furniture, and plumbing fixtures for a single room.
    """
    if existing_comp_ids is None:
        existing_comp_ids = set()

    room_name = room.get("name", f"Room {room_index}")
    room_id = room.get("id") or room_name
    room_type = _classify_room(room_name)
    min_x, max_x, min_y, max_y, w, d, cx, cy = _get_room_bounds(room)

    components: List[Dict[str, Any]] = []
    hvac_units: List[HVACEquipmentPayload] = []
    furniture_items: List[FurniturePayload] = []
    plumbing_fixtures_items: List[PlumbingFixturePayload] = []

    def make_comp(
        comp_type: str,
        x: float,
        y: float,
        prefix: str,
        mounting: Optional[str] = None,
        custom_name: Optional[str] = None,
        linked_hvac: Optional[str] = None,
        circuit_id: Optional[str] = None
    ) -> Dict[str, Any]:
        cid = f"{prefix}_{room_index}"
        c = 1
        while cid in existing_comp_ids:
            c += 1
            cid = f"{prefix}_{room_index}_{c}"
        existing_comp_ids.add(cid)

        spec = ELECTRICAL_FIXTURE_TYPES.get(comp_type, {})
        default_w = float(spec.get("default_wattage", 12.0))
        cat = spec.get("category", "lighting")
        m_type = mounting or spec.get("mounting", "ceiling")
        sym = spec.get("symbol", "circle_cross")
        w_mm = float(spec.get("width_mm", 200.0))
        h_mm = float(spec.get("height_mm", 200.0))
        lbl = custom_name or spec.get("label", comp_type)

        return {
            "id": cid,
            "type": comp_type,
            "name": f"{lbl} ({room_name})",
            "category": cat,
            "mounting": m_type,
            "wattage": default_w,
            "voltage": 230.0,
            "phase": "1PH",
            "circuit_id": circuit_id,
            "host_room_id": room_id,
            "host_room_name": room_name,
            "linked_hvac_id": linked_hvac,
            "x": round(x, 1),
            "y": round(y, 1),
            "rotation": 0.0,
            "width_mm": w_mm,
            "height_mm": h_mm,
            "symbol": sym,
            "snapped_to_wall": (m_type == "wall"),
            "wall_normal_angle": 0.0,
            "properties": {}
        }

    # ==========================================
    # 1. ELECTRICAL GENERATION PER ROOM TYPE
    # ==========================================
    if include_electrical:
        if room_type == "living":
            # Center Ceiling Fan
            components.append(make_comp("ceiling_fan", cx, cy, "FAN", circuit_id="CKT-L1"))
            # 4 Recessed Downlights in 2x2 grid
            dx = min(w * 0.25, 1200.0)
            dy = min(d * 0.25, 1200.0)
            components.append(make_comp("recessed_downlight", cx - dx, cy - dy, "DL", circuit_id="CKT-L1"))
            components.append(make_comp("recessed_downlight", cx + dx, cy - dy, "DL", circuit_id="CKT-L1"))
            components.append(make_comp("recessed_downlight", cx - dx, cy + dy, "DL", circuit_id="CKT-L1"))
            components.append(make_comp("recessed_downlight", cx + dx, cy + dy, "DL", circuit_id="CKT-L1"))
            # Switchboard near entrance
            components.append(make_comp("multi_gang_switch", min_x + 350.0, min_y + 120.0, "SW", mounting="wall", circuit_id="CKT-L1"))
            # TV Entertainment Socket 16A
            components.append(make_comp("socket_16a", max_x - 300.0, cy, "SKT16", mounting="wall", custom_name="TV Entertainment 16A", circuit_id="CKT-P1"))
            # General Socket 6A
            components.append(make_comp("socket_6a", min_x + 300.0, max_y - 300.0, "SKT6", mounting="wall", circuit_id="CKT-P1"))
            # AC Isolator 20A
            components.append(make_comp("ac_isolator_20a", cx, min_y + 120.0, "AC_ISO", mounting="wall", linked_hvac=f"AC_IDU_{room_index}", circuit_id="CKT-AC"))

        elif room_type == "master_bedroom":
            # Center Fan
            components.append(make_comp("ceiling_fan", cx, cy, "FAN", circuit_id="CKT-L2"))
            # 2-4 Downlights
            dx = min(w * 0.25, 1000.0)
            components.append(make_comp("recessed_downlight", cx - dx, cy, "DL", circuit_id="CKT-L2"))
            components.append(make_comp("recessed_downlight", cx + dx, cy, "DL", circuit_id="CKT-L2"))
            # Switchboard near door
            components.append(make_comp("multi_gang_switch", min_x + 350.0, min_y + 120.0, "SW", mounting="wall", circuit_id="CKT-L2"))
            # Bedside Sockets
            components.append(make_comp("socket_6a", min_x + 300.0, cy, "SKT6", mounting="wall", circuit_id="CKT-P1"))
            components.append(make_comp("socket_16a", max_x - 300.0, max_y - 300.0, "SKT16", mounting="wall", circuit_id="CKT-P1"))
            # AC Isolator 20A
            components.append(make_comp("ac_isolator_20a", cx, max_y - 120.0, "AC_ISO", mounting="wall", linked_hvac=f"AC_IDU_{room_index}", circuit_id="CKT-AC"))

        elif room_type == "bedroom":
            # Center Fan
            components.append(make_comp("ceiling_fan", cx, cy, "FAN", circuit_id="CKT-L2"))
            # Downlights
            dy = min(d * 0.25, 900.0)
            components.append(make_comp("recessed_downlight", cx, cy - dy, "DL", circuit_id="CKT-L2"))
            components.append(make_comp("recessed_downlight", cx, cy + dy, "DL", circuit_id="CKT-L2"))
            # Switchboard
            components.append(make_comp("multi_gang_switch", min_x + 350.0, min_y + 120.0, "SW", mounting="wall", circuit_id="CKT-L2"))
            # Sockets
            components.append(make_comp("socket_6a", min_x + 300.0, max_y - 300.0, "SKT6", mounting="wall", circuit_id="CKT-P1"))
            # AC Isolator 20A
            components.append(make_comp("ac_isolator_20a", max_x - 120.0, cy, "AC_ISO", mounting="wall", linked_hvac=f"AC_IDU_{room_index}", circuit_id="CKT-AC"))

        elif room_type == "kitchen":
            # Linear Tube Light
            components.append(make_comp("linear_tube_light", cx, cy, "TL", circuit_id="CKT-L1"))
            # Exhaust Fan on wall
            components.append(make_comp("exhaust_fan", min_x + 120.0, max_y - 350.0, "EF", mounting="wall", circuit_id="CKT-L1"))
            # Switchboard
            components.append(make_comp("multi_gang_switch", min_x + 350.0, min_y + 120.0, "SW", mounting="wall", circuit_id="CKT-L1"))
            # Countertop Heavy Sockets 16A (Mixer, Microwave, Fridge)
            components.append(make_comp("socket_16a", min_x + 350.0, cy, "SKT16_MICROWAVE", mounting="wall", custom_name="Microwave 16A", circuit_id="CKT-P2"))
            components.append(make_comp("socket_16a", max_x - 350.0, cy, "SKT16_FRIDGE", mounting="wall", custom_name="Refrigerator 16A", circuit_id="CKT-P2"))

        elif room_type == "dining":
            # Chandelier / Center light
            components.append(make_comp("chandelier", cx, cy, "CH", circuit_id="CKT-L1"))
            if d >= 3200.0:
                components.append(make_comp("ceiling_fan", cx, cy + 900.0, "FAN", circuit_id="CKT-L1"))
            # Switchboard
            components.append(make_comp("multi_gang_switch", min_x + 350.0, min_y + 120.0, "SW", mounting="wall", circuit_id="CKT-L1"))
            components.append(make_comp("socket_6a", max_x - 300.0, min_y + 300.0, "SKT6", mounting="wall", circuit_id="CKT-P1"))

        elif room_type in ["bathroom", "master_bathroom"]:
            # Recessed Downlight (Waterproof)
            components.append(make_comp("recessed_downlight", cx, cy, "DL", circuit_id="CKT-L2"))
            # Exhaust Fan
            components.append(make_comp("exhaust_fan", max_x - 120.0, cy, "EF", mounting="wall", circuit_id="CKT-L2"))
            # Geyser Point 20A
            components.append(make_comp("geyser_point_20a", max_x - 150.0, max_y - 300.0, "GYS", mounting="wall", circuit_id="CKT-P2"))
            # Switch
            components.append(make_comp("single_switch", min_x + 250.0, min_y + 150.0, "SW", mounting="wall", circuit_id="CKT-L2"))

        elif room_type == "balcony":
            components.append(make_comp("outdoor_bulkhead", cx, cy, "OB", mounting="wall", circuit_id="CKT-L1"))
            components.append(make_comp("single_switch", min_x + 200.0, min_y + 150.0, "SW", mounting="wall", circuit_id="CKT-L1"))

    # ==========================================
    # 2. HVAC EQUIPMENT GENERATION (IDU + ODU)
    # ==========================================
    if include_hvac and room_type in ["living", "master_bedroom", "bedroom"]:
        area_sqm = (w * d) / 1_000_000.0
        # Realistic sizing: 1.0 TR up to 14 sqm, 1.5 TR up to 24 sqm, 2.0 TR larger
        tr = 1.0 if area_sqm < 14.0 else (1.5 if area_sqm < 24.0 else 2.0)
        
        idu_id = f"AC_IDU_{room_index}"
        odu_id = f"AC_ODU_{room_index}"

        # Indoor Split-IDU placed near exterior wall perimeter
        idu_y = min_y + 150.0 if room_type == "living" else max_y - 150.0
        hvac_units.append(HVACEquipmentPayload(
            id=idu_id,
            room_name=room_name,
            unit_type="Split-IDU",
            cooling_capacity_tr=tr,
            location_x=round(cx, 1),
            location_y=round(idu_y, 1),
            status="Active"
        ))

        # Outdoor Condensing Unit (ODU) placed just outside the exterior perimeter
        odu_y = min_y - 380.0 if room_type == "living" else max_y + 380.0
        hvac_units.append(HVACEquipmentPayload(
            id=odu_id,
            room_name=room_name,
            unit_type="ODU",
            cooling_capacity_tr=tr,
            location_x=round(cx, 1),
            location_y=round(odu_y, 1),
            status="Active"
        ))

    # ==========================================
    # 3. ARCHITECTURAL BLOCKS / FURNITURE
    # ==========================================
    if include_furniture:
        if room_type == "living":
            furniture_items.append(FurniturePayload(
                id=f"SOFA_{room_index}",
                type="Sofa Set",
                host_room_id=room_name,
                width=2100.0,
                height=850.0,
                x=round(cx, 1),
                y=round(cy - 400.0, 1),
                rotation=0.0,
                category="Living"
            ))
            furniture_items.append(FurniturePayload(
                id=f"CTBL_{room_index}",
                type="Coffee Table",
                host_room_id=room_name,
                width=1000.0,
                height=550.0,
                x=round(cx, 1),
                y=round(cy + 450.0, 1),
                rotation=0.0,
                category="Living"
            ))

        elif room_type == "master_bedroom":
            furniture_items.append(FurniturePayload(
                id=f"KBED_{room_index}",
                type="King Bed",
                host_room_id=room_name,
                width=1900.0,
                height=2100.0,
                x=round(cx, 1),
                y=round(cy, 1),
                rotation=0.0,
                category="Bedroom"
            ))

        elif room_type == "bedroom":
            furniture_items.append(FurniturePayload(
                id=f"DBED_{room_index}",
                type="Double Bed",
                host_room_id=room_name,
                width=1600.0,
                height=2000.0,
                x=round(cx, 1),
                y=round(cy, 1),
                rotation=0.0,
                category="Bedroom"
            ))

        elif room_type == "dining":
            furniture_items.append(FurniturePayload(
                id=f"DTBL_{room_index}",
                type="Dining Table",
                host_room_id=room_name,
                width=1600.0,
                height=900.0,
                x=round(cx, 1),
                y=round(cy, 1),
                rotation=0.0,
                category="Dining"
            ))

        elif room_type == "kitchen":
            counter_len = round(max(1500.0, d * 0.7), 100)
            furniture_items.append(FurniturePayload(
                id=f"KCNT_{room_index}",
                type="Kitchen Counter",
                host_room_id=room_name,
                width=600.0,
                height=float(counter_len),
                x=round(min_x + 350.0, 1),
                y=round(cy, 1),
                rotation=0.0,
                category="Kitchen"
            ))

        elif room_type in ["bathroom", "master_bathroom"]:
            furniture_items.append(FurniturePayload(
                id=f"WC_{room_index}",
                type="Water Closet",
                host_room_id=room_name,
                width=650.0,
                height=450.0,
                x=round(min_x + 450.0, 1),
                y=round(min_y + 450.0, 1),
                rotation=0.0,
                category="Plumbing"
            ))
            furniture_items.append(FurniturePayload(
                id=f"WB_{room_index}",
                type="Wash Basin",
                host_room_id=room_name,
                width=550.0,
                height=420.0,
                x=round(min_x + 450.0, 1),
                y=round(max_y - 450.0, 1),
                rotation=0.0,
                category="Plumbing"
            ))

    # ==========================================
    # 4. PLUMBING FIXTURES GENERATION (WC, Basin, Sink, Shower, Floor Trap)
    # ==========================================
    if include_plumbing:
        if room_type in ["bathroom", "master_bathroom"]:
            # Water Closet (WC)
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"WC_{room_index}",
                type="Water Closet",
                category="Bathroom",
                host_room_id=room_name,
                width=650.0,
                height=450.0,
                x=round(min_x + 450.0, 1),
                y=round(min_y + 450.0, 1),
                rotation=0.0,
                clearance_status="OK"
            ))
            # Wash Basin
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"WB_{room_index}",
                type="Wash Basin",
                category="Bathroom",
                host_room_id=room_name,
                width=550.0,
                height=420.0,
                x=round(min_x + 450.0, 1),
                y=round(max_y - 450.0, 1),
                rotation=0.0,
                clearance_status="OK"
            ))
            # Shower Enclosure
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"SHW_{room_index}",
                type="Shower",
                category="Bathroom",
                host_room_id=room_name,
                width=900.0,
                height=900.0,
                x=round(max_x - 550.0, 1),
                y=round(max_y - 550.0, 1),
                rotation=0.0,
                clearance_status="OK"
            ))
            # Floor Trap
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"FT_{room_index}",
                type="Floor Trap",
                category="Bathroom",
                host_room_id=room_name,
                width=150.0,
                height=150.0,
                x=round(max_x - 350.0, 1),
                y=round(min_y + 350.0, 1),
                rotation=0.0,
                clearance_status="OK"
            ))

        elif room_type == "kitchen":
            # Kitchen Sink
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"KSINK_{room_index}",
                type="Kitchen Sink",
                category="Kitchen",
                host_room_id=room_name,
                width=800.0,
                height=500.0,
                x=round(min_x + 500.0, 1),
                y=round(cy, 1),
                rotation=0.0,
                clearance_status="OK"
            ))

        elif room_type in ["utility", "balcony"]:
            plumbing_fixtures_items.append(PlumbingFixturePayload(
                id=f"WM_{room_index}",
                type="Washing Machine Point",
                category="Utility",
                host_room_id=room_name,
                width=600.0,
                height=600.0,
                x=round(cx, 1),
                y=round(cy, 1),
                rotation=0.0,
                clearance_status="OK"
            ))

    return {
        "components": components,
        "hvac": hvac_units,
        "furniture": furniture_items,
        "plumbing": plumbing_fixtures_items
    }




def generate_standard_ducted_hvac_and_structure(raw_rooms: List[Dict[str, Any]]):
    """
    Generates industry-standard ASHRAE 90.1 ducted air distribution with CFM airflow calculation,
    AHU equipment, rectangular supply ducts, 4-way diffusers, and IS 456 M25 structural column grid.
    """
    if not raw_rooms:
        return [], [], [], [], [], None

    min_x, max_x = float('inf'), -float('inf')
    min_y, max_y = float('inf'), -float('inf')
    room_geos = []

    for r in raw_rooms:
        rx1, rx2, ry1, ry2, rw, rd, rcx, rcy = _get_room_bounds(r)
        min_x = min(min_x, rx1)
        max_x = max(max_x, rx2)
        min_y = min(min_y, ry1)
        max_y = max(max_y, ry2)
        r_type = _classify_room(r.get("name", ""))
        area_sqm = (rw * rd) / 1_000_000.0
        sensible_w = round(area_sqm * 110.0)
        cfm = max(120, round(sensible_w * 0.27))
        room_geos.append({
            "name": r.get("name", "Room"),
            "type": r_type,
            "min_x": rx1, "max_x": rx2, "min_y": ry1, "max_y": ry2,
            "cx": rcx, "cy": rcy, "w": rw, "d": rd,
            "area_sqm": area_sqm, "cfm": cfm
        })

    b_w = max_x - min_x
    b_h = max_y - min_y
    spine_y = round(min_y + b_h * 0.52, 1)

    conditioned_rooms = [rm for rm in room_geos if rm["type"] != "balcony"]
    total_cfm = sum(rm["cfm"] for rm in conditioned_rooms)
    total_tr = round(total_cfm / 400.0, 1)

    ahu_x = round(min_x - 650.0, 1)
    ahu_equipment = {
        "id": "AHU-01",
        "name": f"AHU-01 ({total_cfm} CFM / {total_tr} TR)",
        "unit_type": "Central-AHU",
        "cooling_capacity_tr": total_tr,
        "cfm": total_cfm,
        "x": ahu_x,
        "y": spine_y,
        "location_x": ahu_x,
        "location_y": spine_y,
        "width": 600.0,
        "height": 900.0,
        "status": "Active"
    }

    ducts = []
    diffusers = []

    trunk_w = 450.0 if total_cfm >= 600 else 350.0
    trunk_h = 300.0 if total_cfm >= 600 else 250.0
    trunk_end_x = round(max_x - b_w * 0.12, 1)

    ducts.append({
        "id": "DUCT-TRUNK-01",
        "system": "SUPPLY",
        "p1": [ahu_x + 300.0, spine_y],
        "p2": [trunk_end_x, spine_y],
        "width": trunk_w,
        "height": trunk_h,
        "cfm": total_cfm,
        "label": f"{int(trunk_w)}x{int(trunk_h)} S-DUCT ({total_cfm} CFM)",
        "layer": "M-HVAC"
    })

    for idx, rm in enumerate(conditioned_rooms, start=1):
        d_id = f"DIFFUSER-{idx}"
        diffusers.append({
            "id": d_id,
            "name": f"Diffuser {idx}",
            "x": rm["cx"],
            "y": rm["cy"],
            "size": 450.0,
            "cfm": rm["cfm"],
            "subType": "supply",
            "room_name": rm["name"],
            "label": f"4-WAY DIFFUSER ({rm['cfm']} CFM)"
        })

        br_w = 250.0 if rm["cfm"] >= 250 else 200.0
        br_h = 150.0
        ducts.append({
            "id": f"DUCT-BRANCH-{idx}",
            "system": "BRANCH",
            "p1": [rm["cx"], spine_y],
            "p2": [rm["cx"], rm["cy"]],
            "width": br_w,
            "height": br_h,
            "cfm": rm["cfm"],
            "label": f"{int(br_w)}x{int(br_h)} ({rm['cfm']} CFM)",
            "layer": "M-HVAC"
        })

    return_grilles = [{
        "id": "RAG-01",
        "name": f"RAG-01 ({total_cfm} CFM Return)",
        "x": round(min_x + b_w * 0.25, 1),
        "y": round(spine_y - 450.0, 1),
        "size": 550.0,
        "cfm": total_cfm,
        "label": f"RAG-01 ({total_cfm} CFM RETURN)"
    }]

    raw_corners = []
    for r in raw_rooms:
        for p in r.get("points", []):
            raw_corners.append((round(float(p[0])), round(float(p[1]))))

    unique_cols = []
    for pt in raw_corners:
        if not any(math.hypot(c[0] - pt[0], c[1] - pt[1]) < 300.0 for c in unique_cols):
            unique_cols.append(pt)

    columns = []
    for c_idx, col in enumerate(unique_cols, start=1):
        columns.append({
            "id": f"COL-{c_idx}",
            "name": f"C{c_idx}",
            "x": col[0],
            "y": col[1],
            "size": 300.0,
            "shape": "square",
            "material": "M25 Reinforced Concrete",
            "reinforcement": "4-T16 + 2-T12 (Fe500)",
            "load_kn": 480.0
        })

    unique_xs = sorted(list({round(c[0] / 100.0) * 100 for c in unique_cols}))
    unique_ys = sorted(list({round(c[1] / 100.0) * 100 for c in unique_cols}))

    grid = []
    for gi, gx in enumerate(unique_xs):
        lbl = chr(65 + (gi % 26))
        grid.append({
            "id": f"GRID-X-{lbl}",
            "name": lbl,
            "axis": "X",
            "coord": gx,
            "p1": [gx, min_y - 800.0],
            "p2": [gx, max_y + 800.0]
        })
    for gi, gy in enumerate(unique_ys):
        lbl = str(gi + 1)
        grid.append({
            "id": f"GRID-Y-{lbl}",
            "name": lbl,
            "axis": "Y",
            "coord": gy,
            "p1": [min_x - 800.0, gy],
            "p2": [max_x + 800.0, gy]
        })

    return ducts, diffusers, return_grilles, columns, grid, ahu_equipment


def auto_populate_project_mep(
    project_id: str,
    room_filter: Optional[List[str]] = None,
    options: Optional[Dict[str, bool]] = None
) -> Dict[str, Any]:
    """
    High-level orchestrator that auto-populates all engineering disciplines for a project:
    1. Loads project CAD data from SQLite.
    2. Identifies rooms and runs deterministic generation.
    3. Adds a Master Distribution Board (DB).
    4. Builds standard circuits (Lighting, Power, Heavy, AC).
    5. Generates orthogonal Manhattan conduit wire routes.
    6. Re-solves geometry via process_geometry_solve_v2.
    7. Persists in SQLite and returns updated solve payload.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    raw_rooms = cad_data.get("rooms", [])
    if not raw_rooms:
        raise ValueError(f"Project '{project_id}' has no rooms to populate.")

    opts = options or {}
    include_electrical = opts.get("include_electrical", True)
    include_hvac = opts.get("include_hvac", True)
    include_furniture = opts.get("include_furniture", True)
    include_plumbing = opts.get("include_plumbing", True)
    clear_existing = opts.get("clear_existing", False)

    existing_components = [] if (clear_existing and include_electrical) else list(cad_data.get("electrical_components", []))
    existing_hvac = [] if (clear_existing and include_hvac) else list(cad_data.get("hvac_equipment", []))
    existing_furniture = [] if (clear_existing and include_furniture) else list(cad_data.get("furniture", []))
    existing_plumbing = [] if (clear_existing and include_plumbing) else list(cad_data.get("plumbing_fixtures", []))
    existing_pipes = [] if (clear_existing and include_plumbing) else list(cad_data.get("plumbing_pipes", []))
    existing_comp_ids = {c.get("id") for c in existing_components if c.get("id")}

    # Main DB placement
    has_db = any(c.get("type") == "distribution_board" for c in existing_components)
    main_db_id = "DB_MAIN"
    if include_electrical and not has_db:
        first_room = raw_rooms[0]
        min_x, max_x, min_y, max_y, w, d, cx, cy = _get_room_bounds(first_room)
        db_comp = {
            "id": main_db_id,
            "type": "distribution_board",
            "name": "Main Distribution Board (MDB)",
            "category": "distribution",
            "mounting": "wall",
            "wattage": 0.0,
            "voltage": 415.0,
            "phase": "3PH",
            "circuit_id": None,
            "host_room_id": first_room.get("id") or first_room.get("name"),
            "host_room_name": first_room.get("name"),
            "x": round(min_x + 300.0, 1),
            "y": round(min_y + 100.0, 1),
            "rotation": 0.0,
            "width_mm": 450.0,
            "height_mm": 600.0,
            "symbol": "distribution_board",
            "snapped_to_wall": True,
            "wall_normal_angle": 0.0,
            "properties": {"main_incomer_rating_a": 63}
        }
        existing_components.append(db_comp)
        existing_comp_ids.add(main_db_id)

    # Process each room
    new_components: List[Dict[str, Any]] = []
    new_hvac: List[HVACEquipmentPayload] = []
    new_furniture: List[FurniturePayload] = []
    new_plumbing: List[PlumbingFixturePayload] = []

    for idx, r in enumerate(raw_rooms, start=1):
        r_name = r.get("name", "")
        if room_filter and r_name not in room_filter:
            continue

        res = generate_room_mep(
            room=r,
            room_index=idx,
            existing_comp_ids=existing_comp_ids,
            include_electrical=include_electrical,
            include_hvac=include_hvac,
            include_furniture=include_furniture,
            include_plumbing=include_plumbing
        )
        new_components.extend(res["components"])
        new_hvac.extend(res["hvac"])
        new_furniture.extend(res["furniture"])
        new_plumbing.extend(res["plumbing"])

    all_components = existing_components + new_components

    # Define standard circuits & routes if electrical is requested
    if include_electrical:
        circuits_list: List[Dict[str, Any]] = [
            {
                "id": "CKT-L1",
                "name": "Circuit L1 - Living & Kitchen Lighting",
                "category": "lighting",
                "source_db_id": main_db_id,
                "breaker_rating_a": 10.0,
                "wire_gauge_sqmm": 1.5,
                "voltage": 230.0,
                "phase": "1PH",
                "connected_component_ids": [c["id"] for c in all_components if c.get("circuit_id") == "CKT-L1"]
            },
            {
                "id": "CKT-L2",
                "name": "Circuit L2 - Bedroom & Bath Lighting",
                "category": "lighting",
                "source_db_id": main_db_id,
                "breaker_rating_a": 10.0,
                "wire_gauge_sqmm": 1.5,
                "voltage": 230.0,
                "phase": "1PH",
                "connected_component_ids": [c["id"] for c in all_components if c.get("circuit_id") == "CKT-L2"]
            },
            {
                "id": "CKT-P1",
                "name": "Circuit P1 - General Power Sockets",
                "category": "general_socket",
                "source_db_id": main_db_id,
                "breaker_rating_a": 16.0,
                "wire_gauge_sqmm": 2.5,
                "voltage": 230.0,
                "phase": "1PH",
                "connected_component_ids": [c["id"] for c in all_components if c.get("circuit_id") == "CKT-P1"]
            },
            {
                "id": "CKT-P2",
                "name": "Circuit P2 - Kitchen & Geyser Heavy Loads",
                "category": "heavy_socket",
                "source_db_id": main_db_id,
                "breaker_rating_a": 20.0,
                "wire_gauge_sqmm": 4.0,
                "voltage": 230.0,
                "phase": "1PH",
                "connected_component_ids": [c["id"] for c in all_components if c.get("circuit_id") == "CKT-P2"]
            },
            {
                "id": "CKT-AC",
                "name": "Circuit AC - Air Conditioning Radial Feeder",
                "category": "ac_radial",
                "source_db_id": main_db_id,
                "breaker_rating_a": 25.0,
                "wire_gauge_sqmm": 4.0,
                "voltage": 230.0,
                "phase": "1PH",
                "connected_component_ids": [c["id"] for c in all_components if c.get("circuit_id") == "CKT-AC"]
            }
        ]

        # Calculate circuit loads
        for ckt in circuits_list:
            c_ids = set(ckt["connected_component_ids"])
            total_w = sum(float(c.get("wattage", 0.0)) for c in all_components if c.get("id") in c_ids)
            ckt["total_load_w"] = round(total_w, 1)

        # Generate wire routes
        all_routes: List[Dict[str, Any]] = []
        route_counter = 1
        for ckt in circuits_list:
            routes = generate_circuit_routes(ckt, all_components, start_route_index=route_counter)
            all_routes.extend(routes)
            route_counter += len(routes)
    else:
        circuits_list = list(cad_data.get("electrical_circuits", []))
        all_routes = list(cad_data.get("electrical_routes", []))


    # Combine HVAC, Furniture, and Plumbing
    all_hvac = existing_hvac + [h.model_dump() for h in new_hvac]
    # Deduplicate furniture to prevent multiple duplicate beds/tables stacking in the same room
    deduped_furniture = []
    seen_furniture_keys = set()
    for f in existing_furniture:
        f_type = (f.get("type") or "").lower().strip()
        r_id = (f.get("host_room_id") or "").lower().strip()
        is_bed = "bed" in f_type
        key = (r_id, "bed" if is_bed else f_type)
        if key not in seen_furniture_keys:
            seen_furniture_keys.add(key)
            deduped_furniture.append(f)

    for f in new_furniture:
        f_dict = f.model_dump()
        f_type = (f_dict.get("type") or "").lower().strip()
        r_id = (f_dict.get("host_room_id") or "").lower().strip()
        is_bed = "bed" in f_type
        key = (r_id, "bed" if is_bed else f_type)
        if key not in seen_furniture_keys:
            seen_furniture_keys.add(key)
            deduped_furniture.append(f_dict)

    all_furniture = deduped_furniture
    all_plumbing_fixtures = existing_plumbing + [p.model_dump() for p in new_plumbing]
    all_plumbing_pipes = list(existing_pipes)

    rooms_payload = [RoomPayload(**r) for r in raw_rooms]

    # Reconstruct openings safely so doors and windows are never lost
    raw_openings = list(cad_data.get("openings", []))
    if not raw_openings:
        for d in cad_data.get("doors", []):
            raw_openings.append({
                "id": d.get("id"),
                "type": "Door",
                "host_room": d.get("host_room"),
                "wall_side": d.get("wall_side"),
                "offset_mm": float(d.get("offset_mm", 300)),
                "width_mm": float(d.get("width_mm", 900)),
                "height_mm": float(d.get("height_mm", 2100)),
                "swing": d.get("swing", "Inward-Right")
            })
        for w in cad_data.get("windows", []):
            raw_openings.append({
                "id": w.get("id"),
                "type": "Window",
                "host_room": w.get("host_room"),
                "wall_side": w.get("wall_side"),
                "offset_mm": float(w.get("offset_mm", 1000)),
                "width_mm": float(w.get("width_mm", 1500)),
                "height_mm": float(w.get("height_mm", 1400)),
                "swing": "Inward-Left"
            })

    include_openings = opts.get("include_openings", True)
    if include_openings and not raw_openings:
        openings_payload = generate_default_openings(rooms_payload)
    else:
        openings_payload = [OpeningPayload(**o) for o in raw_openings]

    hvac_payload = [HVACEquipmentPayload(**h) for h in all_hvac]
    furniture_payload = [FurniturePayload(**f) for f in all_furniture]

    solved: SolveResponse = process_geometry_solve_v2(
        payload_or_rooms=rooms_payload,
        openings=openings_payload,
        hvac_equipment=hvac_payload,
        furniture=furniture_payload,
        plumbing_fixtures=all_plumbing_fixtures,
        plumbing_pipes=all_plumbing_pipes,
        electrical_components=all_components,
        electrical_circuits=circuits_list,
        electrical_routes=all_routes
    )

    solved_dict = solved.model_dump()
    solved_dict["project_id"] = project_id
    solved_dict["project_name"] = project.get("name")
    solved_dict["created_at"] = project.get("created_at")
    solved_dict["openings"] = [o.model_dump() for o in openings_payload]

    # Generate standard ducted HVAC (CFM sized) & structural column grid
    if include_hvac:
        d_ducts, d_diffusers, d_rags, d_cols, d_grid, d_ahu = generate_standard_ducted_hvac_and_structure(raw_rooms)
        solved_dict["hvac_ducts"] = d_ducts
        solved_dict["hvac_diffusers"] = d_diffusers
        solved_dict["hvac_return_grilles"] = d_rags
        solved_dict["structural_columns"] = d_cols
        solved_dict["structural_grid"] = d_grid
        if d_ahu:
            solved_dict["hvac_equipment"].append(d_ahu)

    # Persist in SQLite
    update_project_cad_data(project_id, solved_dict)

    return {
        "status": "success",
        "project_id": project_id,
        "populated": {
            "doors_count": len(solved.doors),
            "windows_count": len(solved.windows),
            "electrical_components_count": len(all_components),
            "circuits_count": len(circuits_list),
            "conduit_routes_count": len(all_routes),
            "hvac_units_count": len(all_hvac),
            "furniture_items_count": len(all_furniture),
            "plumbing_fixtures_count": len(solved.plumbing_fixtures),
            "plumbing_pipes_count": len(solved.plumbing_pipes)
        },
        "solve_data": solved_dict
    }
