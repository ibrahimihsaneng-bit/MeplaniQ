from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from backend.models import (
    PlumbingFixturePayload, PlumbingFixtureUpdate,
    PlumbingPipePayload, PlumbingPipeUpdate,
    safe_float, safe_str
)
from backend.database import get_project_by_id, update_project_cad_data
from backend.geometry import (
    RoomPayload,
    get_plumbing_fixture_cad,
    get_plumbing_pipe_cad,
    SolveResponse
)

router = APIRouter(prefix="/api/projects/{project_id}/plumbing", tags=["Plumbing"])

def _get_shifted_rooms(cad_data: Dict[str, Any]) -> List[RoomPayload]:
    rooms_data = cad_data.get("rooms", [])
    return [RoomPayload(name=r.get("name", "Room"), points=r.get("points", [])) for r in rooms_data]

@router.post("-fixtures", response_model=Dict[str, Any])
def add_plumbing_fixture(project_id: str, fixture: PlumbingFixturePayload):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    if "plumbing_fixtures" not in cad_data:
        cad_data["plumbing_fixtures"] = []
        
    # Recalculate CAD geometry for the new fixture
    shifted_rooms = _get_shifted_rooms(cad_data)
    cad_fixture = get_plumbing_fixture_cad(fixture, shifted_rooms)
    
    cad_data["plumbing_fixtures"].append(cad_fixture.model_dump())
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "fixture": cad_fixture.model_dump(), "cad_data": cad_data}

@router.put("-fixtures/{fixture_id}", response_model=Dict[str, Any])
def update_plumbing_fixture(project_id: str, fixture_id: str, update_data: PlumbingFixtureUpdate):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    fixtures = cad_data.get("plumbing_fixtures", [])
    
    fixture_idx = next((i for i, f in enumerate(fixtures) if f.get("id") == fixture_id), None)
    if fixture_idx is None:
        raise HTTPException(status_code=404, detail=f"Plumbing fixture with ID '{fixture_id}' not found")
        
    existing_f = fixtures[fixture_idx]
    
    # Merge updates safely
    payload = PlumbingFixturePayload(
        id=fixture_id,
        type=update_data.type if update_data.type is not None else existing_f.get("type", "Wash Basin"),
        category=update_data.category if update_data.category is not None else existing_f.get("category", "Bathroom"),
        host_room_id=update_data.host_room_id if update_data.host_room_id is not None else existing_f.get("host_room_id", "Room"),
        width=update_data.width if update_data.width is not None else existing_f.get("width"),
        height=update_data.height if update_data.height is not None else existing_f.get("height"),
        x=update_data.x if update_data.x is not None else existing_f.get("x"),
        y=update_data.y if update_data.y is not None else existing_f.get("y"),
        rotation=update_data.rotation if update_data.rotation is not None else existing_f.get("rotation", 0.0),
        connected_to=update_data.connected_to if update_data.connected_to is not None else existing_f.get("connected_to"),
        clearance_status=update_data.clearance_status if update_data.clearance_status is not None else existing_f.get("clearance_status", "OK")
    )
    
    shifted_rooms = _get_shifted_rooms(cad_data)
    cad_fixture = get_plumbing_fixture_cad(payload, shifted_rooms)
    
    fixtures[fixture_idx] = cad_fixture.model_dump()
    cad_data["plumbing_fixtures"] = fixtures
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "fixture": cad_fixture.model_dump(), "cad_data": cad_data}

@router.delete("-fixtures/{fixture_id}")
def delete_plumbing_fixture(project_id: str, fixture_id: str):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    fixtures = cad_data.get("plumbing_fixtures", [])
    
    filtered_fixtures = [f for f in fixtures if f.get("id") != fixture_id]
    if len(filtered_fixtures) == len(fixtures):
        raise HTTPException(status_code=404, detail=f"Plumbing fixture with ID '{fixture_id}' not found")
        
    cad_data["plumbing_fixtures"] = filtered_fixtures
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "message": f"Deleted plumbing fixture '{fixture_id}'", "cad_data": cad_data}

@router.post("-pipes", response_model=Dict[str, Any])
def add_plumbing_pipe(project_id: str, pipe: PlumbingPipePayload):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    if "plumbing_pipes" not in cad_data:
        cad_data["plumbing_pipes"] = []
        
    shifted_rooms = _get_shifted_rooms(cad_data)
    cad_pipe = get_plumbing_pipe_cad(pipe, shifted_rooms)
    
    cad_data["plumbing_pipes"].append(cad_pipe.model_dump())
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "pipe": cad_pipe.model_dump(), "cad_data": cad_data}

@router.put("-pipes/{pipe_id}", response_model=Dict[str, Any])
def update_plumbing_pipe(project_id: str, pipe_id: str, update_data: PlumbingPipeUpdate):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    pipes = cad_data.get("plumbing_pipes", [])
    
    pipe_idx = next((i for i, p in enumerate(pipes) if p.get("id") == pipe_id), None)
    if pipe_idx is None:
        raise HTTPException(status_code=404, detail=f"Plumbing pipe with ID '{pipe_id}' not found")
        
    existing_p = pipes[pipe_idx]
    
    # Safely extract end points from the existing pipe's CAD path if x, y, end_x, end_y are missing
    path = existing_p.get("path", [[0,0], [0,0]])
    ex_x, ex_y = path[0][0], path[0][1]
    ex_end_x, ex_end_y = path[1][0], path[1][1] if len(path) > 1 else (ex_x, ex_y)
    
    payload = PlumbingPipePayload(
        id=pipe_id,
        type=update_data.type if update_data.type is not None else existing_p.get("type", "Drainage Pipe"),
        host_room_id=update_data.host_room_id if update_data.host_room_id is not None else existing_p.get("host_room_id", "Room"),
        x=update_data.x if update_data.x is not None else ex_x,
        y=update_data.y if update_data.y is not None else ex_y,
        end_x=update_data.end_x if update_data.end_x is not None else ex_end_x,
        end_y=update_data.end_y if update_data.end_y is not None else ex_end_y,
        diameter=update_data.diameter if update_data.diameter is not None else existing_p.get("diameter"),
        connected_to=update_data.connected_to if update_data.connected_to is not None else existing_p.get("connected_to"),
        clearance_status=update_data.clearance_status if update_data.clearance_status is not None else existing_p.get("clearance_status", "OK")
    )
    
    shifted_rooms = _get_shifted_rooms(cad_data)
    cad_pipe = get_plumbing_pipe_cad(payload, shifted_rooms)
    
    pipes[pipe_idx] = cad_pipe.model_dump()
    cad_data["plumbing_pipes"] = pipes
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "pipe": cad_pipe.model_dump(), "cad_data": cad_data}

@router.delete("-pipes/{pipe_id}")
def delete_plumbing_pipe(project_id: str, pipe_id: str):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
        
    cad_data = project.get("cad_json_data", {})
    pipes = cad_data.get("plumbing_pipes", [])
    
    filtered_pipes = [p for p in pipes if p.get("id") != pipe_id]
    if len(filtered_pipes) == len(pipes):
        raise HTTPException(status_code=404, detail=f"Plumbing pipe with ID '{pipe_id}' not found")
        
    cad_data["plumbing_pipes"] = filtered_pipes
    update_project_cad_data(project_id, cad_data, project.get("name"))
    
    return {"status": "success", "message": f"Deleted plumbing pipe '{pipe_id}'", "cad_data": cad_data}
