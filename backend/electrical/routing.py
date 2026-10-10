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

    # Daisy-chain the loads
    remaining = list(connected_ids)
    # If switch is among connected loads, start from switch
    if current_source_id in remaining:
        remaining.remove(current_source_id)

    curr_id = current_source_id
    while remaining:
        if curr_id and curr_id in comp_map:
            curr_pos = [comp_map[curr_id].get("x", 0.0), comp_map[curr_id].get("y", 0.0)]
            # Find nearest neighbor in remaining
            nearest_id = min(
                remaining,
                key=lambda cid: compute_manhattan_distance(
                    curr_pos,
                    [comp_map[cid].get("x", 0.0), comp_map[cid].get("y", 0.0)]
                )
            )
        else:
            # First item as root
            nearest_id = remaining[0]
            curr_id = nearest_id
            remaining.remove(nearest_id)
            continue

        next_comp = comp_map[nearest_id]
        p_start = [comp_map[curr_id].get("x", 0.0), comp_map[curr_id].get("y", 0.0)]
        p_end = [next_comp.get("x", 0.0), next_comp.get("y", 0.0)]
        
        # Alternate x_first based on step to give natural conduit flow
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

    return routes
