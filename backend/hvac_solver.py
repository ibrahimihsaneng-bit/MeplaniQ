import math
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from shapely.geometry import Polygon


class HVACEquipmentPayload(BaseModel):
    id: str
    room_name: str
    unit_type: str = "Split-IDU"  # "Split-IDU", "ODU", "Cassette-IDU"
    cooling_capacity_tr: Optional[float] = None
    location_x: Optional[float] = None
    location_y: Optional[float] = None
    status: Optional[str] = "Active"


class HVACRoomLoad(BaseModel):
    room_name: str
    carpet_area_sqm: float
    carpet_area_sqft: float
    is_conditioned: bool
    cooling_load_tr: float
    airflow_cfm: float
    liquid_line_inch: str
    suction_line_inch: str


class HVACEquipmentCAD(BaseModel):
    id: str
    room_name: str
    unit_type: str  # "Split-IDU", "ODU", "Cassette-IDU"
    capacity_tr: float
    cfm: float
    x: float
    y: float
    width: float
    height: float
    rotation_deg: float = 0.0
    label_x: float
    label_y: float
    status: str = "Active"


class HVACPipeRoute(BaseModel):
    pipe_id: str
    from_unit_id: str
    to_unit_id: str
    liquid_size: str
    suction_size: str
    path_points: List[List[float]]  # Orthogonal 90° Manhattan path coordinates
    total_length_mm: float
    pipe_type: str = "Refrigerant Pair (Liquid + Suction)"


DEFAULT_TEST_HVAC = [
    {
        "id": "IDU-1",
        "room_name": "Living Room",
        "unit_type": "Split-IDU",
        "cooling_capacity_tr": 2.0,
        "location_x": 4500.0,
        "location_y": 4800.0,
        "status": "Active"
    },
    {
        "id": "ODU-1",
        "room_name": "L-Shaped Corridor/Balcony",
        "unit_type": "ODU",
        "cooling_capacity_tr": 2.0,
        "location_x": 2200.0,
        "location_y": 7500.0,
        "status": "Active"
    }
]


def is_conditioned_room(room_name: str) -> bool:
    """Determines whether a room is a conditioned living space based on standard architectural naming."""
    name_lower = room_name.lower()
    unconditioned_keywords = ["balcony", "corridor", "terrace", "deck", "verandah", "passage", "shaft", "duct", "stair"]
    for kw in unconditioned_keywords:
        if kw in name_lower:
            return False
    return True


def get_refrigerant_pipe_sizes(capacity_tr: float) -> Tuple[str, str]:
    """
    Returns standard copper refrigerant pipe diameters (Liquid Line, Suction Line) in inches.
    """
    if capacity_tr <= 1.5:
        return '1/4"', '1/2"'
    elif capacity_tr <= 2.5:
        return '1/4"', '5/8"'
    else:
        return '3/8"', '3/4"'


def calculate_room_cooling_loads(rooms_info: List[Any]) -> List[HVACRoomLoad]:
    """
    Computes cooling load tonnage, airflow (CFM), and refrigerant pipe sizing for all rooms.
    Rule of thumb: 1.0 TR per 150 sq.ft (~14.0 sq.m) for standard residential conditioned space.
    Airflow: 400 CFM per 1.0 TR.
    """
    loads: List[HVACRoomLoad] = []

    for r in rooms_info:
        conditioned = is_conditioned_room(r.name)
        if conditioned:
            # Sizing: ~1 TR per 150 sq.ft (rounded to 1 decimal place)
            raw_tr = r.carpet_area_sqft / 150.0
            # Standard residential capacity stepping: 1.0, 1.5, 2.0, 2.5, 3.0 TR
            tr_stepped = round(raw_tr * 2) / 2.0
            cooling_tr = max(1.0, tr_stepped)
            cfm = round(cooling_tr * 400.0)
            liq_size, suc_size = get_refrigerant_pipe_sizes(cooling_tr)
        else:
            cooling_tr = 0.0
            cfm = 0.0
            liq_size, suc_size = "N/A", "N/A"

        loads.append(HVACRoomLoad(
            room_name=r.name,
            carpet_area_sqm=r.carpet_area_sqm,
            carpet_area_sqft=r.carpet_area_sqft,
            is_conditioned=conditioned,
            cooling_load_tr=cooling_tr,
            airflow_cfm=cfm,
            liquid_line_inch=liq_size,
            suction_line_inch=suc_size
        ))

    return loads


def build_manhattan_path(start: List[float], end: List[float], waypoints: Optional[List[List[float]]] = None) -> Tuple[List[List[float]], float]:
    """
    Constructs an orthogonal 90-degree bend Manhattan path connecting start to end through waypoints.
    Returns path points list and total path length in mm.
    """
    raw_nodes = [start]
    if waypoints:
        raw_nodes.extend(waypoints)
    raw_nodes.append(end)

    path: List[List[float]] = [raw_nodes[0]]
    total_len = 0.0

    for i in range(len(raw_nodes) - 1):
        p1 = path[-1]
        p2 = raw_nodes[i + 1]

        if abs(p1[0] - p2[0]) > 1e-3 and abs(p1[1] - p2[1]) > 1e-3:
            # Insert 90-degree bend corner node (Horizontal then Vertical or Vertical then Horizontal)
            corner = [p1[0], p2[1]]
            path.append(corner)
            path.append(p2)
            total_len += abs(p1[1] - p2[1]) + abs(p1[0] - p2[0])
        else:
            path.append(p2)
            total_len += math.hypot(p2[0] - p1[0], p2[1] - p1[1])

    # Remove consecutive duplicate points
    deduped_path: List[List[float]] = [path[0]]
    for pt in path[1:]:
        if abs(pt[0] - deduped_path[-1][0]) > 1e-3 or abs(pt[1] - deduped_path[-1][1]) > 1e-3:
            deduped_path.append([round(pt[0], 2), round(pt[1], 2)])

    return deduped_path, round(total_len, 2)


def solve_hvac_system(
    rooms_data: List[Any],
    room_results: List[Any],
    user_equipment: Optional[List[HVACEquipmentPayload]] = None
) -> Tuple[List[HVACRoomLoad], List[HVACEquipmentCAD], List[HVACPipeRoute]]:
    """
    Solves HVAC engineering layout:
      1. Room cooling loads, CFM, and pipe sizing
      2. Equipment placement (IDU inside conditioned space, ODU on exterior perimeter)
      3. Orthogonal Manhattan refrigerant pipe routing
    """
    loads = calculate_room_cooling_loads(room_results)
    loads_map = {l.room_name: l for l in loads}

    equipment_list: List[HVACEquipmentCAD] = []
    pipe_routes: List[HVACPipeRoute] = []

    # Map room bounds
    room_bounds: Dict[str, Tuple[float, float, float, float]] = {}
    for r in rooms_data:
        poly = Polygon(r.points)
        room_bounds[r.name] = poly.bounds  # (minx, miny, maxx, maxy)

    # Process Equipment: from user payload or create default
    if user_equipment and len(user_equipment) > 0:
        for eq in user_equipment:
            r_load = loads_map.get(eq.room_name)
            cap = eq.cooling_capacity_tr if eq.cooling_capacity_tr is not None else (r_load.cooling_load_tr if r_load else 1.5)
            cfm = round(cap * 400.0)

            # Determine dimensions based on type
            u_type = eq.unit_type or "Split-IDU"
            if "odu" in u_type.lower():
                w, h = 850.0, 380.0
            elif "cassette" in u_type.lower():
                w, h = 840.0, 840.0
            else:  # High-Wall Split IDU
                w, h = 900.0, 260.0

            # Determine coordinates
            if eq.location_x is not None and eq.location_y is not None:
                x, y = float(eq.location_x), float(eq.location_y)
            else:
                bounds = room_bounds.get(eq.room_name)
                if bounds:
                    minx, miny, maxx, maxy = bounds
                    if "odu" in u_type.lower():
                        x, y = minx + (maxx - minx) * 0.7, miny + (maxy - miny) * 0.8
                    else:
                        x, y = minx + (maxx - minx) * 0.75, maxy - 200.0
                else:
                    x, y = 3000.0, 4800.0

            equipment_list.append(HVACEquipmentCAD(
                id=eq.id,
                room_name=eq.room_name,
                unit_type=u_type,
                capacity_tr=cap,
                cfm=cfm,
                x=x,
                y=y,
                width=w,
                height=h,
                rotation_deg=0.0,
                label_x=x,
                label_y=y - (h / 2.0 + 150.0),
                status=eq.status or "Active"
            ))
    else:
        # Generate default equipment for default layout
        # Conditioned room IDU:
        living_room = next((r for r in rooms_data if is_conditioned_room(r.name)), rooms_data[0] if rooms_data else None)
        balcony_room = next((r for r in rooms_data if not is_conditioned_room(r.name)), None)

        if living_room:
            r_load = loads_map.get(living_room.name)
            cap = r_load.cooling_load_tr if r_load else 2.0
            cfm = r_load.airflow_cfm if r_load else 800.0
            
            # Place IDU on Living Room top wall at X=4500, Y=4800
            equipment_list.append(HVACEquipmentCAD(
                id="IDU-1",
                room_name=living_room.name,
                unit_type="Split-IDU",
                capacity_tr=cap,
                cfm=cfm,
                x=4500.0,
                y=4800.0,
                width=900.0,
                height=260.0,
                rotation_deg=0.0,
                label_x=4500.0,
                label_y=4620.0,
                status="Active"
            ))

        if balcony_room:
            # Place ODU on Balcony at X=2200, Y=7500
            equipment_list.append(HVACEquipmentCAD(
                id="ODU-1",
                room_name=balcony_room.name,
                unit_type="ODU",
                capacity_tr=cap if living_room else 2.0,
                cfm=cfm if living_room else 800.0,
                x=2200.0,
                y=7500.0,
                width=850.0,
                height=380.0,
                rotation_deg=0.0,
                label_x=2200.0,
                label_y=7250.0,
                status="Active"
            ))

    # Auto-Route Refrigerant Lines between IDU and ODU pairs
    idus = [e for e in equipment_list if "idu" in e.unit_type.lower()]
    odus = [e for e in equipment_list if "odu" in e.unit_type.lower()]

    for idx, idu in enumerate(idus):
        odu = odus[idx] if idx < len(odus) else (odus[0] if odus else None)
        if not odu:
            continue

        liq_size, suc_size = get_refrigerant_pipe_sizes(idu.capacity_tr)

        # Route from IDU connection point -> along room boundary / perimeter -> to ODU
        idu_conn = [idu.x, idu.y + idu.height / 2.0]
        odu_conn = [odu.x, odu.y - odu.height / 2.0]

        dx = abs(odu_conn[0] - idu_conn[0])
        dy = abs(odu_conn[1] - idu_conn[1])
        if dy >= dx:
            mid_y = round(idu_conn[1] + (odu_conn[1] - idu_conn[1]) * 0.5, 2)
            waypoints = [[idu_conn[0], mid_y], [odu_conn[0], mid_y]]
        else:
            mid_x = round(idu_conn[0] + (odu_conn[0] - idu_conn[0]) * 0.5, 2)
            waypoints = [[mid_x, idu_conn[1]], [mid_x, odu_conn[1]]]

        path_pts, path_len = build_manhattan_path(idu_conn, odu_conn, waypoints)

        pipe_routes.append(HVACPipeRoute(
            pipe_id=f"REF-{idx + 1}",
            from_unit_id=idu.id,
            to_unit_id=odu.id,
            liquid_size=liq_size,
            suction_size=suc_size,
            path_points=path_pts,
            total_length_mm=path_len,
            pipe_type="Refrigerant Pair (Liquid + Suction)"
        ))

    return loads, equipment_list, pipe_routes
