from pydantic import BaseModel
from typing import Optional, List, Dict, Any

def safe_float(val: Any, default: float = 0.0) -> float:
    try:
        if val is None:
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_str(val: Any, default: str = "") -> str:
    return str(val).strip() if val is not None else default

class PlumbingFixturePayload(BaseModel):
    id: Optional[str] = None
    supplyPipeId: Optional[str] = None
    drainagePipeId: Optional[str] = None
    type: str = "Wash Basin" 
    category: str = "Bathroom"
    host_room_id: Optional[str] = "Room"
    width: Optional[float] = None
    height: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    rotation: float = 0.0
    connected_to: Optional[str] = None
    clearance_status: Optional[str] = "OK"

class PlumbingFixtureCAD(BaseModel):
    id: str
    supplyPipeId: Optional[str] = None
    drainagePipeId: Optional[str] = None
    type: str
    category: str
    host_room_id: str
    width: float
    height: float
    x: float
    y: float
    rotation: float = 0.0
    connected_to: Optional[str] = None
    clearance_status: str = "OK"

class PlumbingPipePayload(BaseModel):
    id: Optional[str] = None
    type: str = "Water Supply Pipe"
    host_room_id: Optional[str] = "Room"
    x: Optional[float] = None
    y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None
    path: Optional[List[List[float]]] = None
    diameter: Optional[float] = None
    connected_to: Optional[str] = None
    clearance_status: Optional[str] = "OK"

class PlumbingPipeCAD(BaseModel):
    id: str
    type: str
    host_room_id: str
    path: List[List[float]]
    diameter: float
    connected_to: Optional[str] = None
    clearance_status: str = "OK"

class PlumbingFixtureUpdate(BaseModel):
    type: Optional[str] = None
    supplyPipeId: Optional[str] = None
    drainagePipeId: Optional[str] = None
    category: Optional[str] = None
    host_room_id: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    rotation: Optional[float] = None
    connected_to: Optional[str] = None
    clearance_status: Optional[str] = None

class PlumbingPipeUpdate(BaseModel):
    type: Optional[str] = None
    host_room_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None
    diameter: Optional[float] = None
    connected_to: Optional[str] = None
    clearance_status: Optional[str] = None
