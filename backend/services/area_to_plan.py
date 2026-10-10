"""
backend/services/area_to_plan.py
================================
Deterministic Architectural Room Program & 2D Spatial Packing Engine for meplaniq.

Converts square footage (or square metres) and architectural requirements into:
1. Balanced, anthropometrically sensible room dimension proposals.
2. Non-overlapping contiguous 2D Shapely polygonal coordinates (RoomPayload).
3. Standard architectural doors and windows (OpeningPayload).
4. Direct feed into existing process_geometry_solve_v2 and SQLite persistence.
"""

import math
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import Polygon
from backend.geometry import (
    RoomPayload,
    OpeningPayload,
    process_geometry_solve_v2,
    SolveResponse
)
from backend.database import save_project, get_project_by_id, update_project_cad_data

# Architectural constants
SQFT_TO_SQM = 0.09290304
SQM_TO_SQFT = 1.0 / SQFT_TO_SQM
SQFT_TO_SQMM = 92903.04
SQM_TO_SQMM = 1_000_000.0

# Minimum habitable room dimensions in mm (NBC 2016 / IBC guidelines)
MIN_ROOM_WIDTH_MM = 1500.0
MIN_ROOM_DEPTH_MM = 1500.0
MIN_BATH_WIDTH_MM = 1200.0
MIN_BATH_DEPTH_MM = 1500.0


def round_to_hundred(val: float) -> float:
    """Rounds millimetre dimensions to the nearest 100 mm increment for clean construction drafting."""
    return max(100.0, round(val / 100.0) * 100.0)


def generate_default_room_program(
    target_area_sqft: float,
    bedrooms: int = 2,
    bathrooms: int = 2,
    include_kitchen: bool = True,
    include_dining: bool = True,
    include_living: bool = True,
    include_balcony: bool = False,
    building_type: str = "Residential"
) -> List[Dict[str, Any]]:
    """
    Deterministically computes a balanced, realistic room program allocating the target area.
    Dedicates ~12-14% of gross area to internal wall thicknesses and circulation.
    """
    bedrooms = max(1, min(6, int(bedrooms)))
    bathrooms = max(1, min(4, int(bathrooms)))
    
    # Net usable carpet area budget in sq.mm
    # Reserve ~13% for circulation corridors and wall envelopes
    usable_ratio = 0.87
    total_gross_sqmm = float(target_area_sqft) * SQFT_TO_SQMM
    net_usable_sqmm = total_gross_sqmm * usable_ratio

    # Define relative area allocation weights and ideal aspect ratios (W / D)
    raw_specs = []
    
    if include_living:
        raw_specs.append({
            "name": "Living Room",
            "category": "Living",
            "weight": 26.0,
            "aspect_ratio": 1.25,
            "min_w": 3600.0,
            "min_d": 3000.0
        })

    if include_dining:
        raw_specs.append({
            "name": "Dining Room",
            "category": "Dining",
            "weight": 15.0,
            "aspect_ratio": 1.15,
            "min_w": 3000.0,
            "min_d": 2700.0
        })

    if include_kitchen:
        raw_specs.append({
            "name": "Kitchen",
            "category": "Kitchen",
            "weight": 13.0,
            "aspect_ratio": 1.20,
            "min_w": 2700.0,
            "min_d": 2400.0
        })

    # Bedrooms allocation
    bed_weights = [18.0, 14.0, 13.0, 12.0, 11.0, 10.0]
    for b in range(bedrooms):
        b_name = "Master Bedroom" if b == 0 else f"Bedroom {b + 1}"
        w_weight = bed_weights[b] if b < len(bed_weights) else 10.0
        raw_specs.append({
            "name": b_name,
            "category": "Bedroom",
            "weight": w_weight,
            "aspect_ratio": 1.15,
            "min_w": 3300.0 if b == 0 else 3000.0,
            "min_d": 3000.0 if b == 0 else 2700.0
        })

    # Bathrooms allocation
    for bt in range(bathrooms):
        bt_name = "Master Bathroom" if bt == 0 else f"Bathroom {bt + 1}"
        raw_specs.append({
            "name": bt_name,
            "category": "Bathroom",
            "weight": 5.5 if bt == 0 else 4.5,
            "aspect_ratio": 1.35,
            "min_w": 2100.0,
            "min_d": 1500.0
        })

    if include_balcony:
        raw_specs.append({
            "name": "Balcony / Porch",
            "category": "Balcony",
            "weight": 5.0,
            "aspect_ratio": 2.0,
            "min_w": 3000.0,
            "min_d": 1500.0
        })

    total_weight = sum(s["weight"] for s in raw_specs)
    program: List[Dict[str, Any]] = []

    for spec in raw_specs:
        allocated_sqmm = (spec["weight"] / total_weight) * net_usable_sqmm
        ar = spec["aspect_ratio"]
        # W * D = A and W / D = AR  =>  W = sqrt(A * AR), D = W / AR
        calc_w = math.sqrt(allocated_sqmm * ar)
        calc_d = allocated_sqmm / calc_w if calc_w > 0 else 3000.0
        
        # Enforce minimum code requirements
        final_w = round_to_hundred(max(spec["min_w"], calc_w))
        final_d = round_to_hundred(max(spec["min_d"], calc_d))
        actual_area_sqm = round((final_w * final_d) / SQM_TO_SQMM, 2)
        actual_area_sqft = round(actual_area_sqm * SQM_TO_SQFT, 1)

        program.append({
            "name": spec["name"],
            "category": spec["category"],
            "width_mm": final_w,
            "depth_mm": final_d,
            "area_sqm": actual_area_sqm,
            "area_sqft": actual_area_sqft
        })

    return program


def pack_rooms_into_coordinates(rooms: List[Dict[str, Any]], variant: int = 0) -> List[RoomPayload]:
    """
    Packs a list of room specifications into contiguous, non-overlapping 2D rectangular
    polygons suitable for process_geometry_solve_v2.

    Supports 4 distinct architectural models/variations via layout_variant (mod 4):
    - Model 1 (Variant 0): Classic Dual-Wing (Public Left, Private Right, Master Suite Rear)
    - Model 2 (Variant 1): Mirrored Wings (Private Left, Public Right, Master Suite Rear)
    - Model 3 (Variant 2): Executive Villa (Public Left, Private Right, Master Suite Front-Facing)
    - Model 4 (Variant 3): Mirrored Executive (Private Left, Public Right, Master Suite Front-Facing)
    """
    if not rooms:
        return []

    v = int(variant) % 4

    if len(rooms) == 1:
        r = rooms[0]
        w = float(r.get("width_mm", 4000.0))
        d = float(r.get("depth_mm", 3500.0))
        name = str(r.get("name", "Room"))
        points = [[0.0, 0.0], [w, 0.0], [w, d], [0.0, d]]
        return [RoomPayload(name=name, points=points)]

    if len(rooms) == 2:
        r1, r2 = rooms[0], rooms[1]
        w1 = float(r1.get("width_mm", 4000.0))
        d1 = float(r1.get("depth_mm", 3500.0))
        w2 = float(r2.get("width_mm", 4000.0))
        d2 = float(r2.get("depth_mm", 3500.0))
        max_d = max(d1, d2)
        if v in (1, 3):
            p1 = [[w2, 0.0], [w1 + w2, 0.0], [w1 + w2, max_d], [w2, max_d]]
            p2 = [[0.0, 0.0], [w2, 0.0], [w2, max_d], [0.0, max_d]]
        else:
            p1 = [[0.0, 0.0], [w1, 0.0], [w1, max_d], [0.0, max_d]]
            p2 = [[w1, 0.0], [w1 + w2, 0.0], [w1 + w2, max_d], [w1, max_d]]
        return [
            RoomPayload(name=str(r1.get("name", "Room 1")), points=p1),
            RoomPayload(name=str(r2.get("name", "Room 2")), points=p2)
        ]

    # Segregate rooms into public (Col 0) and private (Col 1)
    public_keywords = {"living", "dining", "kitchen", "balcony", "entry", "porch", "hall", "drawing", "foyer", "utility", "store"}
    col0_specs: List[Dict[str, Any]] = []
    col1_specs: List[Dict[str, Any]] = []

    for r in rooms:
        name_lower = str(r.get("name", "")).lower()
        cat_lower = str(r.get("category", "")).lower()
        if any(k in name_lower or k in cat_lower for k in public_keywords):
            col0_specs.append(r)
        else:
            col1_specs.append(r)

    # Balance if one column is empty
    if not col0_specs and col1_specs:
        half = max(1, len(col1_specs) // 2)
        col0_specs = col1_specs[:half]
        col1_specs = col1_specs[half:]
    elif not col1_specs and col0_specs:
        half = max(1, len(col0_specs) // 2)
        col1_specs = col0_specs[:half:]
        col0_specs = col0_specs[:half:]

    # Sort Col 0: Living/Entry first (Y=0), then Dining, then Kitchen, then Balcony/Utility
    def col0_priority(spec: Dict[str, Any]) -> int:
        n = spec.get("name", "").lower()
        c = spec.get("category", "").lower()
        if "living" in n or "entry" in n or "foyer" in n or "hall" in n:
            return 0
        if "dining" in n or "dining" in c:
            return 1
        if "kitchen" in n or "kitchen" in c:
            return 2
        return 3

    col0_specs.sort(key=col0_priority)

    # In Col 1, separate bedrooms and bathrooms
    bedrooms: List[Dict[str, Any]] = []
    bathrooms: List[Dict[str, Any]] = []
    other_col1: List[Dict[str, Any]] = []

    for r in col1_specs:
        n = str(r.get("name", "")).lower()
        c = str(r.get("category", "")).lower()
        if "bath" in n or "toilet" in n or "bath" in c:
            bathrooms.append(r)
        elif "bed" in n or "bed" in c:
            bedrooms.append(r)
        else:
            other_col1.append(r)

    # Determine Column widths
    w0_raw = max([float(r.get("width_mm", 4000.0)) for r in col0_specs]) if col0_specs else 4500.0
    col1_widths = [float(r.get("width_mm", 4000.0)) for r in (bedrooms or col1_specs)]
    w1_raw = max(col1_widths) if col1_widths else 4200.0

    w0 = round_to_hundred(max(3000.0, min(6500.0, w0_raw)))
    w1 = round_to_hundred(max(3000.0, min(6500.0, w1_raw)))

    # Determine column X boundaries based on variant
    if v in (1, 3):
        col_priv_x0 = 0.0
        col_priv_x1 = w1
        col_pub_x0 = w1
        col_pub_x1 = w1 + w0
    else:
        col_pub_x0 = 0.0
        col_pub_x1 = w0
        col_priv_x0 = w0
        col_priv_x1 = w0 + w1

    # Compute Col 0 (Public) rooms coordinates
    packed_rooms: List[RoomPayload] = []
    cur_y0 = 0.0

    for r in col0_specs:
        raw_w = float(r.get("width_mm", w0))
        raw_d = float(r.get("depth_mm", 3000.0))
        target_area = raw_w * raw_d
        d = round_to_hundred(max(MIN_ROOM_DEPTH_MM, target_area / w0))
        name = str(r.get("name", "Room"))
        points = [
            [round(col_pub_x0, 1), round(cur_y0, 1)],
            [round(col_pub_x1, 1), round(cur_y0, 1)],
            [round(col_pub_x1, 1), round(cur_y0 + d, 1)],
            [round(col_pub_x0, 1), round(cur_y0 + d, 1)]
        ]
        packed_rooms.append(RoomPayload(name=name, points=points, fillet_radius=0.0))
        cur_y0 += d

    total_d0 = cur_y0

    # Stack Col 1 (Private) rooms
    cur_y1 = 0.0

    front_bedrooms = [b for b in bedrooms if "master" not in b.get("name", "").lower()]
    master_bedrooms = [b for b in bedrooms if "master" in b.get("name", "").lower()]
    if not master_bedrooms and bedrooms:
        master_bedrooms = [bedrooms[-1]]
        front_bedrooms = bedrooms[:-1]

    def add_col1_room(spec: Dict[str, Any], default_name: str, default_d: float, is_last: bool = False):
        nonlocal cur_y1
        raw_w = float(spec.get("width_mm", w1))
        raw_d = float(spec.get("depth_mm", default_d))
        target_area = raw_w * raw_d
        calc_d = round_to_hundred(target_area / w1)

        remaining_d = total_d0 - cur_y1
        if is_last and remaining_d >= MIN_ROOM_DEPTH_MM and abs(remaining_d - calc_d) <= 1200.0:
            d = remaining_d
        else:
            d = max(MIN_ROOM_DEPTH_MM, calc_d)

        name = str(spec.get("name", default_name))
        points = [
            [round(col_priv_x0, 1), round(cur_y1, 1)],
            [round(col_priv_x1, 1), round(cur_y1, 1)],
            [round(col_priv_x1, 1), round(cur_y1 + d, 1)],
            [round(col_priv_x0, 1), round(cur_y1 + d, 1)]
        ]
        packed_rooms.append(RoomPayload(name=name, points=points, fillet_radius=0.0))
        cur_y1 += d

    def add_col1_bathrooms():
        nonlocal cur_y1
        if not bathrooms:
            return
        if len(bathrooms) >= 2:
            b1, b2 = bathrooms[0], bathrooms[1]
            d_b = round_to_hundred(max(MIN_BATH_DEPTH_MM, (float(b1.get("depth_mm", 1800.0)) + float(b2.get("depth_mm", 1800.0))) / 2.0))
            bw1 = round_to_hundred(w1 / 2.0)

            p_b1 = [
                [round(col_priv_x0, 1), round(cur_y1, 1)],
                [round(col_priv_x0 + bw1, 1), round(cur_y1, 1)],
                [round(col_priv_x0 + bw1, 1), round(cur_y1 + d_b, 1)],
                [round(col_priv_x0, 1), round(cur_y1 + d_b, 1)]
            ]
            p_b2 = [
                [round(col_priv_x0 + bw1, 1), round(cur_y1, 1)],
                [round(col_priv_x1, 1), round(cur_y1, 1)],
                [round(col_priv_x1, 1), round(cur_y1 + d_b, 1)],
                [round(col_priv_x0 + bw1, 1), round(cur_y1 + d_b, 1)]
            ]
            packed_rooms.append(RoomPayload(name=str(b1.get("name", "Bathroom 1")), points=p_b1, fillet_radius=0.0))
            packed_rooms.append(RoomPayload(name=str(b2.get("name", "Bathroom 2")), points=p_b2, fillet_radius=0.0))
            cur_y1 += d_b

            for b_rem in bathrooms[2:]:
                raw_d = float(b_rem.get("depth_mm", 1800.0))
                d_r = round_to_hundred(max(MIN_BATH_DEPTH_MM, raw_d))
                p_rem = [
                    [round(col_priv_x0, 1), round(cur_y1, 1)],
                    [round(col_priv_x1, 1), round(cur_y1, 1)],
                    [round(col_priv_x1, 1), round(cur_y1 + d_r, 1)],
                    [round(col_priv_x0, 1), round(cur_y1 + d_r, 1)]
                ]
                packed_rooms.append(RoomPayload(name=str(b_rem.get("name", "Bathroom")), points=p_rem, fillet_radius=0.0))
                cur_y1 += d_r
        else:
            b = bathrooms[0]
            raw_d = float(b.get("depth_mm", 1800.0))
            d_b = round_to_hundred(max(MIN_BATH_DEPTH_MM, raw_d))
            p_b = [
                [round(col_priv_x0, 1), round(cur_y1, 1)],
                [round(col_priv_x1, 1), round(cur_y1, 1)],
                [round(col_priv_x1, 1), round(cur_y1 + d_b, 1)],
                [round(col_priv_x0, 1), round(cur_y1 + d_b, 1)]
            ]
            packed_rooms.append(RoomPayload(name=str(b.get("name", "Bathroom")), points=p_b, fillet_radius=0.0))
            cur_y1 += d_b

    if v in (2, 3):
        for mb in master_bedrooms:
            add_col1_room(mb, "Master Bedroom", 3600.0, is_last=False)
        add_col1_bathrooms()
        for idx_fb, b in enumerate(front_bedrooms):
            is_last = (idx_fb == len(front_bedrooms) - 1 and not other_col1)
            add_col1_room(b, "Bedroom", 3200.0, is_last=is_last)
        for idx_o, o in enumerate(other_col1):
            is_last = (idx_o == len(other_col1) - 1)
            add_col1_room(o, "Room", 2800.0, is_last=is_last)
    else:
        for b in front_bedrooms:
            add_col1_room(b, "Bedroom", 3200.0, is_last=False)
        for o in other_col1:
            add_col1_room(o, "Room", 2800.0, is_last=False)
        add_col1_bathrooms()
        for idx_mb, mb in enumerate(master_bedrooms):
            is_last = (idx_mb == len(master_bedrooms) - 1)
            add_col1_room(mb, "Master Bedroom", 3600.0, is_last=is_last)

    # Verify no overlapping interior polygons with Shapely
    validate_packed_polygons(packed_rooms)

    return packed_rooms


def validate_packed_polygons(rooms: List[RoomPayload]) -> None:
    """
    Asserts that every room polygon is valid, positive-area, and shares zero overlapping interior area.
    """
    for r in rooms:
        poly = Polygon(r.points)
        if not poly.is_valid:
            raise ValueError(f"Generated room '{r.name}' has an invalid polygon geometry.")
        if poly.area <= 0:
            raise ValueError(f"Generated room '{r.name}' has non-positive area ({poly.area}).")

    for i, r1 in enumerate(rooms):
        p1 = Polygon(r1.points)
        for r2 in rooms[i + 1:]:
            p2 = Polygon(r2.points)
            intersection = p1.intersection(p2)
            # Touching edges have intersection dimension 1 (line) or 0 (point), area is 0
            if intersection.area > 1.0:  # Allow 1 sq.mm numerical margin
                raise ValueError(
                    f"Overlapping geometry detected between '{r1.name}' and '{r2.name}' (overlap area: {intersection.area:.1f} mm²)."
                )


def generate_default_openings(rooms: List[RoomPayload]) -> List[OpeningPayload]:
    """
    Generates standard architectural doors and windows for the generated room layout.
    """
    openings: List[OpeningPayload] = []
    opening_counter = 1

    for r in rooms:
        pts = r.points
        if len(pts) < 4:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        w = max_x - min_x
        d = max_y - min_y
        name = r.name.lower()

        # Main Entrance Door for Living Room
        if "living" in name:
            if min_y == 0.0 and w >= 1500:
                openings.append(OpeningPayload(
                    id=f"D{opening_counter}",
                    type="Door",
                    host_room=r.name,
                    wall_side="Bottom",
                    offset_mm=round(min(800.0, w * 0.2), 1),
                    width_mm=1000.0,
                    height_mm=2100.0,
                    swing="Inward-Right"
                ))
                opening_counter += 1
            # Living Room Window
            if w >= 2400:
                openings.append(OpeningPayload(
                    id=f"W{opening_counter}",
                    type="Window",
                    host_room=r.name,
                    wall_side="Bottom" if min_y == 0 else "Left",
                    offset_mm=round(w * 0.55, 1),
                    width_mm=1500.0,
                    height_mm=1400.0,
                    swing="Inward-Right"
                ))
                opening_counter += 1

        # Bedroom Doors & Windows
        elif "bedroom" in name:
            # Door on bottom or left side
            door_side = "Bottom" if min_y > 0 else "Left"
            openings.append(OpeningPayload(
                id=f"D{opening_counter}",
                type="Door",
                host_room=r.name,
                wall_side=door_side,
                offset_mm=400.0,
                width_mm=900.0,
                height_mm=2100.0,
                swing="Inward-Right"
            ))
            opening_counter += 1
            # Window on Top exterior wall
            if w >= 2000:
                openings.append(OpeningPayload(
                    id=f"W{opening_counter}",
                    type="Window",
                    host_room=r.name,
                    wall_side="Top",
                    offset_mm=round(max(600.0, (w - 1200.0) / 2.0), 1),
                    width_mm=1200.0,
                    height_mm=1200.0,
                    swing="Inward-Right"
                ))
                opening_counter += 1

        # Kitchen Windows & Doors
        elif "kitchen" in name:
            # Kitchen Door
            openings.append(OpeningPayload(
                id=f"D{opening_counter}",
                type="Door",
                host_room=r.name,
                wall_side="Left" if min_x > 0 else "Bottom",
                offset_mm=300.0,
                width_mm=850.0,
                height_mm=2100.0,
                swing="Inward-Left"
            ))
            opening_counter += 1
            # Kitchen Window
            openings.append(OpeningPayload(
                id=f"W{opening_counter}",
                type="Window",
                host_room=r.name,
                wall_side="Right" if max_x > min_x else "Bottom",
                offset_mm=round(max(400.0, (d - 1000.0) / 2.0), 1),
                width_mm=1000.0,
                height_mm=1000.0,
                swing="Inward-Right"
            ))
            opening_counter += 1

        # Bathroom Doors
        elif "bath" in name or "toilet" in name:
            openings.append(OpeningPayload(
                id=f"D{opening_counter}",
                type="Door",
                host_room=r.name,
                wall_side="Bottom" if min_y > 0 else "Left",
                offset_mm=250.0,
                width_mm=750.0,
                height_mm=2100.0,
                swing="Inward-Left"
            ))
            opening_counter += 1

    return openings


def generate_and_save_area_plan(
    project_name: str,
    target_area_sqft: float,
    rooms_data: Optional[List[Dict[str, Any]]] = None,
    requirements: Optional[Dict[str, Any]] = None,
    layout_variant: int = 0,
    include_mep: bool = False,
    plot_constraints: Optional[Dict[str, Any]] = None
) -> SolveResponse:
    """
    High-level orchestrator:
    1. If rooms_data is omitted, computes deterministic room proposal from target_area_sqft.
    2. Packs rooms into non-overlapping contiguous 2D coordinates (RoomPayload) according to layout_variant.
    3. Derives standard openings (doors and windows).
    4. Solves CAD geometry via process_geometry_solve_v2.
    5. Persists project to SQLite database via save_project.
    6. Automatically populates full MEP (electrical, plumbing, HVAC, furniture) if include_mep is True.
    7. Returns fully populated SolveResponse with project_id and metadata.
    """
    if not project_name or not project_name.strip():
        project_name = "Architectural Residence"
    project_name = project_name.strip()

    if target_area_sqft <= 0:
        raise ValueError("Target floor area must be greater than zero.")

    if not rooms_data or len(rooms_data) == 0:
        req = requirements or {}
        rooms_data = generate_default_room_program(
            target_area_sqft=target_area_sqft,
            bedrooms=req.get("bedrooms", 2),
            bathrooms=req.get("bathrooms", 2),
            include_kitchen=req.get("include_kitchen", True),
            include_dining=req.get("include_dining", True),
            include_living=req.get("include_living", True),
            include_balcony=req.get("include_balcony", False),
            building_type=req.get("building_type", "Residential")
        )

    # Convert to packed RoomPayload instances with target layout variant
    room_payloads = pack_rooms_into_coordinates(rooms_data, variant=layout_variant)
    
    # Auto-generate standard doors and windows
    openings = generate_default_openings(room_payloads)

    # Solve parametric 2D CAD geometry (walls, offsets, fillets, schedules)
    solved = process_geometry_solve_v2(
        payload_or_rooms=room_payloads,
        openings=openings
    )

    solved_dict = solved.model_dump()
    solved_dict["layout_variant"] = int(layout_variant) % 4
    if plot_constraints:
        solved_dict["plot_constraints"] = plot_constraints

    # Persist in SQLite
    saved = save_project(name=project_name, cad_dict=solved_dict)
    
    solved.project_id = saved["id"]
    solved.project_name = saved["name"]
    solved.created_at = saved["created_at"]

    # Auto-populate full MEP if requested
    if include_mep or (requirements and requirements.get("include_mep")):
        from backend.services.mep_populator import auto_populate_project_mep
        mep_res = auto_populate_project_mep(saved["id"], options={"clear_existing": True})
        return SolveResponse(**mep_res["solve_data"])

    return solved



def switch_project_layout_variant(
    project_id: str,
    variant: int = 0
) -> SolveResponse:
    """
    Switches an existing project's architectural model / layout variation
    (Model 1: Classic, Model 2: Mirrored Wings, Model 3: Executive Villa, Model 4: Mirrored Executive),
    re-generating openings, re-solving CAD geometry, and persisting the updated plan in SQLite.
    If MEP was previously populated, MEP is automatically re-populated to fit the new room configuration.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    existing_rooms = cad_data.get("rooms", [])
    if not existing_rooms:
        raise ValueError("Project has no rooms to repack.")

    public_keywords = {"living", "dining", "kitchen", "balcony", "entry", "porch", "hall", "drawing", "foyer", "utility", "store"}
    room_specs = []
    for r in existing_rooms:
        pts = r.get("points", [])
        if pts:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            w = max(1000.0, max(xs) - min(xs))
            d = max(1000.0, max(ys) - min(ys))
        else:
            w, d = 4000.0, 3500.0
        
        name = r.get("name", "Room")
        nl = name.lower()
        cat = "Public" if any(k in nl for k in public_keywords) else "Private"
        room_specs.append({
            "name": name,
            "width_mm": w,
            "depth_mm": d,
            "category": cat
        })

    # Repack with target variant
    new_room_payloads = pack_rooms_into_coordinates(room_specs, variant=variant)
    new_openings = generate_default_openings(new_room_payloads)

    had_mep = bool(cad_data.get("electrical_components") or cad_data.get("plumbing_fixtures"))

    solved = process_geometry_solve_v2(
        payload_or_rooms=new_room_payloads,
        openings=new_openings
    )

    solved_dict = solved.model_dump()
    solved_dict["project_id"] = project_id
    solved_dict["project_name"] = project.get("name")
    solved_dict["created_at"] = project.get("created_at")
    solved_dict["layout_variant"] = int(variant) % 4

    update_project_cad_data(project_id, solved_dict)

    if had_mep:
        from backend.services.mep_populator import auto_populate_project_mep
        mep_res = auto_populate_project_mep(project_id, options={"clear_existing": True})
        return SolveResponse(**mep_res["solve_data"])

    return solved
