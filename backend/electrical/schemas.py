"""
backend/electrical/schemas.py
=============================
Pydantic schemas for the meplaniq Electrical Layout & Routing System.
Provides strongly-typed models for components (fixtures, switches, boards),
circuits (topology, ratings, wire sizes), and physical orthogonal wire routes.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


def safe_float(val: Any, default: float = 0.0) -> float:
    try:
        if val is None:
            return default
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_str(val: Any, default: str = "") -> str:
    return str(val).strip() if val is not None else default


class ElectricalComponentCreate(BaseModel):
    id: Optional[str] = None
    type: str  # e.g. "recessed_downlight", "socket_16a", "ac_isolator_20a"
    name: Optional[str] = None
    category: Optional[str] = None
    mounting: Optional[str] = None  # "ceiling" | "wall"
    wattage: Optional[float] = None
    voltage: Optional[float] = 230.0
    phase: Optional[str] = "1PH"
    circuit_id: Optional[str] = None
    host_room_id: Optional[str] = None
    host_room_name: Optional[str] = None
    linked_hvac_id: Optional[str] = None
    x: float
    y: float
    z_mounting_height_mm: Optional[float] = None
    rotation: Optional[float] = 0.0
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    symbol: Optional[str] = None
    snapped_to_wall: Optional[bool] = False
    wall_normal_angle: Optional[float] = 0.0
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalComponentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    mounting: Optional[str] = None
    wattage: Optional[float] = None
    voltage: Optional[float] = None
    phase: Optional[str] = None
    circuit_id: Optional[str] = None
    host_room_id: Optional[str] = None
    host_room_name: Optional[str] = None
    linked_hvac_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z_mounting_height_mm: Optional[float] = None
    rotation: Optional[float] = None
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    symbol: Optional[str] = None
    snapped_to_wall: Optional[bool] = None
    wall_normal_angle: Optional[float] = None
    properties: Optional[Dict[str, Any]] = None


class ElectricalComponentCAD(BaseModel):
    id: str
    type: str
    name: str
    category: str
    mounting: str
    wattage: float
    voltage: float = 230.0
    phase: str = "1PH"
    circuit_id: Optional[str] = None
    host_room_id: Optional[str] = None
    host_room_name: Optional[str] = None
    linked_hvac_id: Optional[str] = None
    x: float
    y: float
    z_mounting_height_mm: Optional[float] = None
    rotation: float = 0.0
    width_mm: float
    height_mm: float
    symbol: str
    snapped_to_wall: bool = False
    wall_normal_angle: float = 0.0
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalCircuitCreate(BaseModel):
    id: Optional[str] = None
    name: str
    category: str = "lighting"  # "lighting", "fan", "general_socket", "heavy_socket", "ac_radial", "geyser_radial"
    source_db_id: Optional[str] = None
    switch_id: Optional[str] = None
    breaker_rating_a: Optional[float] = 10.0
    wire_gauge_sqmm: Optional[float] = 1.5
    connected_component_ids: List[str] = Field(default_factory=list)
    total_load_w: Optional[float] = 0.0
    voltage: Optional[float] = 230.0
    phase_designation: Optional[str] = "R"
    status: Optional[str] = "active"
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalCircuitUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    source_db_id: Optional[str] = None
    switch_id: Optional[str] = None
    breaker_rating_a: Optional[float] = None
    wire_gauge_sqmm: Optional[float] = None
    connected_component_ids: Optional[List[str]] = None
    total_load_w: Optional[float] = None
    voltage: Optional[float] = None
    phase_designation: Optional[str] = None
    status: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class ElectricalCircuitCAD(BaseModel):
    id: str
    name: str
    category: str
    source_db_id: Optional[str] = None
    switch_id: Optional[str] = None
    breaker_rating_a: float = 10.0
    wire_gauge_sqmm: float = 1.5
    connected_component_ids: List[str] = Field(default_factory=list)
    total_load_w: float = 0.0
    voltage: float = 230.0
    phase_designation: str = "R"
    status: str = "active"
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalWireRouteCreate(BaseModel):
    id: Optional[str] = None
    circuit_id: Optional[str] = None
    from_component_id: Optional[str] = None
    to_component_id: Optional[str] = None
    conduit_type: Optional[str] = "slab_conduit"  # "pvc_rigid", "slab_conduit", "wall_conduit"
    conductors: List[str] = Field(default_factory=lambda: ["phase", "neutral", "earth"])
    points: List[List[float]] = Field(default_factory=list)
    length_mm: Optional[float] = 0.0
    is_auto_generated: Optional[bool] = False
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalWireRouteCAD(BaseModel):
    id: str
    circuit_id: Optional[str] = None
    from_component_id: Optional[str] = None
    to_component_id: Optional[str] = None
    conduit_type: str = "slab_conduit"
    conductors: List[str] = Field(default_factory=lambda: ["phase", "neutral", "earth"])
    points: List[List[float]] = Field(default_factory=list)
    length_mm: float = 0.0
    is_auto_generated: bool = False
    properties: Dict[str, Any] = Field(default_factory=dict)


class ElectricalLayoutResponse(BaseModel):
    components: List[ElectricalComponentCAD] = Field(default_factory=list)
    circuits: List[ElectricalCircuitCAD] = Field(default_factory=list)
    routes: List[ElectricalWireRouteCAD] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
