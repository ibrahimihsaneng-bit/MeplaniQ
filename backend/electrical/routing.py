"""
backend/electrical/routing.py
=============================
Deterministic orthogonal (Manhattan) routing engine for electrical wire conduits.
Connects Main DB to switches/isolators and chains fixtures logically and orthogonally.
"""

from typing import List, Dict, Any, Optional
from backend.electrical.geometry import compute_polyline_length, compute_manhattan_distance


def orthogonal_route(
    start: List[float],
    end: List[float],
    prefer_x_first: bool = True
) -> List[List[float]]:
    """
    Generates a deterministic Manhattan orthogonal path between two points.
    Returns 2 or 3 points: [start, (optional intermediate corner), end].
    """
    x1, y1 = round(start[0], 1), round(start[1], 1)
    x2, y2 = round(end[0], 1), round(end[1], 1)

    # If collinear horizontally or vertically
    if abs(x1 - x2) < 1.0 or abs(y1 - y2) < 1.0:
        return [[x1, y1], [x2, y2]]

    if prefer_x_first:
        corner = [x2, y1]
    else:
        corner = [x1, y2]

    return [[x1, y1], corner, [x2, y2]]


def generate_circuit_routes(
    circuit: Dict[str, Any],
    all_components: List[Dict[str, Any]],
    start_route_index: int = 1
) -> List[Dict[str, Any]]:
    """
    Generates orthogonal wire routes for a single circuit:
    1. Connects source DB -> switch (or first load if direct/radial)
    2. Connects switch -> first load
    3. Daisy-chains remaining connected loads using nearest-neighbor Manhattan order
    """
    comp_map = {c.get("id"): c for c in all_components if c.get("id")}
    
    connected_ids = [cid for cid in circuit.get("connected_component_ids", []) if cid in comp_map]
    if not connected_ids:
        return []

    routes: List[Dict[str, Any]] = []
    route_counter = start_route_index
    circuit_id = circuit.get("id", "CKT")
    circuit_cat = circuit.get("category", "lighting")

    # Determine conduit type based on circuit
    conduit_type = "slab_conduit"
    if circuit_cat in ["heavy_socket", "general_socket"]:
        conduit_type = "wall_conduit"
    elif circuit_cat in ["ac_radial", "geyser_radial"]:
        conduit_type = "wall_conduit"

    source_db_id = circuit.get("source_db_id")
    switch_id = circuit.get("switch_id")

    # Find starting component
    current_source_id = None
    if source_db_id and source_db_id in comp_map:
        current_source_id = source_db_id
    elif switch_id and switch_id in comp_map:
        current_source_id = switch_id

    # If we have a DB and a switch, connect DB -> switch first
    if source_db_id and switch_id and source_db_id in comp_map and switch_id in comp_map and source_db_id != switch_id:
        db_comp = comp_map[source_db_id]
        sw_comp = comp_map[switch_id]
        p_start = [db_comp.get("x", 0.0), db_comp.get("y", 0.0)]
        p_end = [sw_comp.get("x", 0.0), sw_comp.get("y", 0.0)]
        pts = orthogonal_route(p_start, p_end, prefer_x_first=True)
        length = compute_polyline_length(pts)
        
        routes.append({
            "id": f"WR-{circuit_id}-{route_counter}",
            "circuit_id": circuit_id,
            "from_component_id": source_db_id,
            "to_component_id": switch_id,
            "conduit_type": "slab_conduit",
            "conductors": ["phase", "neutral", "earth"],
            "points": pts,
            "length_mm": length,
            "is_auto_generated": True,
            "properties": {"role": "feeder_to_switch"}
        })
        route_counter += 1
        current_source_id = switch_id

    # Check if components span multiple distinct rooms
    room_groups: Dict[str, List[str]] = {}
    for cid in connected_ids:
        r_name = comp_map[cid].get("host_room_name") or comp_map[cid].get("host_room_id") or "default"
        room_groups.setdefault(r_name, []).append(cid)

    # Single-room circuit or synthetic unit test: standard nearest-neighbor daisy-chain
    if len(room_groups) <= 1:
        remaining = list(connected_ids)
        if current_source_id in remaining:
            remaining.remove(current_source_id)

        curr_id = current_source_id
        while remaining:
            if curr_id and curr_id in comp_map:
                curr_pos = [comp_map[curr_id].get("x", 0.0), comp_map[curr_id].get("y", 0.0)]
                nearest_id = min(
                    remaining,
                    key=lambda cid: compute_manhattan_distance(
                        curr_pos,
                        [comp_map[cid].get("x", 0.0), comp_map[cid].get("y", 0.0)]
                    )
                )
            else:
                nearest_id = remaining[0]
                curr_id = nearest_id
                remaining.remove(nearest_id)
                continue

            next_comp = comp_map[nearest_id]
            p_start = [comp_map[curr_id].get("x", 0.0), comp_map[curr_id].get("y", 0.0)]
            p_end = [next_comp.get("x", 0.0), next_comp.get("y", 0.0)]
            
            prefer_x = (route_counter % 2 == 0)
            pts = orthogonal_route(p_start, p_end, prefer_x_first=prefer_x)
            length = compute_polyline_length(pts)

            routes.append({
                "id": f"WR-{circuit_id}-{route_counter}",
                "circuit_id": circuit_id,
                "from_component_id": curr_id,
                "to_component_id": nearest_id,
                "conduit_type": conduit_type,
                "conductors": ["phase", "neutral", "earth"],
                "points": pts,
                "length_mm": length,
                "is_auto_generated": True,
                "properties": {"role": "load_interconnect"}
            })
            route_counter += 1
            curr_id = nearest_id
            remaining.remove(nearest_id)
    else:
        # Multi-room circuit: isolate conduit routing per room to avoid crossing furniture & partition walls!
        for r_name, r_cids in room_groups.items():
            r_switch = next((cid for cid in r_cids if "switch" in comp_map[cid].get("type", "").lower()), None)
            local_root = r_switch or r_cids[0]

            # Feeder drop from DB to room root
            if source_db_id and source_db_id in comp_map and local_root != source_db_id:
                p_db = [comp_map[source_db_id].get("x", 0.0), comp_map[source_db_id].get("y", 0.0)]
                p_root = [comp_map[local_root].get("x", 0.0), comp_map[local_root].get("y", 0.0)]
                pts = orthogonal_route(p_db, p_root, prefer_x_first=True)
                routes.append({
                    "id": f"WR-{circuit_id}-{route_counter}",
                    "circuit_id": circuit_id,
                    "from_component_id": source_db_id,
                    "to_component_id": local_root,
                    "conduit_type": "slab_conduit",
                    "conductors": ["phase", "neutral", "earth"],
                    "points": pts,
                    "length_mm": compute_polyline_length(pts),
                    "is_auto_generated": True,
                    "properties": {"role": f"feeder_to_{r_name}"}
                })
                route_counter += 1

            # Chain remaining loads within THIS room only
            rem = [cid for cid in r_cids if cid != local_root]
            c_curr = local_root
            while rem:
                c_pos = [comp_map[c_curr].get("x", 0.0), comp_map[c_curr].get("y", 0.0)]
                near_id = min(rem, key=lambda cid: compute_manhattan_distance(c_pos, [comp_map[cid].get("x", 0.0), comp_map[cid].get("y", 0.0)]))
                p_start = c_pos
                p_end = [comp_map[near_id].get("x", 0.0), comp_map[near_id].get("y", 0.0)]
                pts = orthogonal_route(p_start, p_end, prefer_x_first=(route_counter % 2 == 0))
                routes.append({
                    "id": f"WR-{circuit_id}-{route_counter}",
                    "circuit_id": circuit_id,
                    "from_component_id": c_curr,
                    "to_component_id": near_id,
                    "conduit_type": conduit_type,
                    "conductors": ["phase", "neutral", "earth"],
                    "points": pts,
                    "length_mm": compute_polyline_length(pts),
                    "is_auto_generated": True,
                    "properties": {"role": "room_local_branch", "room": r_name}
                })
                route_counter += 1
                c_curr = near_id
                rem.remove(near_id)

    return routes
