import uuid
from typing import List, Dict, Any

from backend.geometry import RoomPayload, SolveResponse, process_geometry_solve_v2
from backend.database import save_project

# Helper to generate rectangle points (clockwise) given origin (x, y) and size (width, depth)
def _rect_points(x: float, y: float, width: float, depth: float) -> List[List[float]]:
    return [
        [x, y],
        [x + width, y],
        [x + width, y + depth],
        [x, y + depth]
    ]

# Define the master residential layout (dimensions in millimeters)
_ROOM_DEFINITIONS = [
    {"name": "Living Room", "w": 5000, "d": 4500},
    {"name": "Dining Hall", "w": 4000, "d": 3500},
    {"name": "Master Bedroom", "w": 4500, "d": 4000},
    {"name": "Secondary Bedroom", "w": 4000, "d": 3500},
    {"name": "Master Toilet", "w": 2400, "d": 1800},
    {"name": "Common Toilet", "w": 2200, "d": 1800},
    {"name": "Kitchen", "w": 3500, "d": 3000},
    {"name": "Utility", "w": 2500, "d": 1800},
]

def generate_master_residential_project() -> Dict[str, Any]:
    """Generate a comprehensive residential project using existing services.

    Returns a dictionary with the saved project metadata and the solved CAD payload.
    """
    # Simple layout: place rooms in a horizontal line with a small gap
    gap = 500  # mm gap between rooms
    current_x = 0
    rooms: List[RoomPayload] = []
    for defn in _ROOM_DEFINITIONS:
        points = _rect_points(current_x, 0, defn["w"], defn["d"])
        rooms.append(RoomPayload(name=defn["name"], points=points))
        current_x += defn["w"] + gap

    # No explicit openings, hvac, furniture – let the solver generate defaults where possible
    solved: SolveResponse = process_geometry_solve_v2(
        payload_or_rooms=rooms,
        openings=[],
        hvac_equipment=[],
        furniture=[],
        plumbing_fixtures=[],
        plumbing_pipes=[],
        electrical_components=[],
        electrical_circuits=[],
        electrical_routes=[],
    )

    # Persist the project
    project_name = "Master Residential Project"
    saved = save_project(name=project_name, cad_dict=solved.model_dump())
    solved.project_id = saved["id"]
    solved.project_name = saved["name"]
    solved.created_at = saved["created_at"]

    return {"status": "success", "project": saved, "solve_response": solved}
