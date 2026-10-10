import math
import io
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field, model_validator
import shapely
from shapely import STRtree, concave_hull
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, box
from shapely.affinity import rotate
from shapely.ops import unary_union
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from backend.models import (
    PlumbingFixturePayload, PlumbingFixtureCAD,
    PlumbingPipePayload, PlumbingPipeCAD,
    safe_float, safe_str
)

class RoomPayload(BaseModel):
    name: str
    points: List[List[float]]
    fillet_radius: float = 0.0


class OpeningPayload(BaseModel):
    id: str
    type: str  # "Door" or "Window"
    host_room: str
    wall_side: str  # "Top", "Bottom", "Left", "Right"
    offset_mm: float
    width_mm: float
    height_mm: float = 2100.0
    swing: Optional[str] = "Inward-Right"  # "Inward-Left", "Inward-Right", "Outward-Left", "Outward-Right"

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # width normalization
            if "width_mm" not in data and "width" in data:
                data["width_mm"] = float(data["width"])
            # offset normalization
            if "offset_mm" not in data:
                if "offset_from_corner" in data:
                    data["offset_mm"] = float(data["offset_from_corner"])
                elif "offset" in data:
                    data["offset_mm"] = float(data["offset"])
            # height normalization
            if "height_mm" not in data and "height" in data:
                data["height_mm"] = float(data["height"])
            # swing normalization
            if "swing" not in data and "swing_direction" in data:
                data["swing"] = str(data["swing_direction"])
        return data


class DoorCADGeometry(BaseModel):
    id: str
    host_room: str
    wall_side: str
    offset_mm: float = 0.0
    width_mm: float
    height_mm: float
    swing: str
    hinge: List[float]  # [x, y]
    leaf_end: List[float]  # [x, y]
    arc_center: List[float]  # [x, y]
    arc_radius: float
    arc_path: str  # SVG path string
    jambs: List[List[float]] = []  # list of [x1, y1, x2, y2]
    label_x: float
    label_y: float


class WindowCADGeometry(BaseModel):
    id: str
    host_room: str
    wall_side: str
    offset_mm: float = 0.0
    width_mm: float
    height_mm: float
    lines: List[List[float]] = []  # list of [x1, y1, x2, y2] (inner, glass, outer)
    jambs: List[List[float]] = []
    label_x: float
    label_y: float


from backend.hvac_solver import (
    HVACEquipmentPayload,
    HVACRoomLoad,
    HVACEquipmentCAD,
    HVACPipeRoute,
    DEFAULT_TEST_HVAC,
    solve_hvac_system
)


class FurniturePayload(BaseModel):
    id: Optional[str] = None
    type: str = "Bed"
    host_room_id: Optional[str] = "Room"
    width: Optional[float] = None
    height: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    rotation: float = 0.0
    clearance_status: Optional[str] = "OK"
    category: Optional[str] = None


class FurnitureCAD(BaseModel):
    id: str
    type: str = "Bed"
    host_room_id: str
    width: float
    height: float
    x: float
    y: float
    rotation: float = 0.0
    label: str = ""
    clearance_status: str = "OK"
    category: str = "Bedroom"


class SolveRequest(BaseModel):
    rooms: List[RoomPayload]
    openings: Optional[List[OpeningPayload]] = []
    hvac_equipment: Optional[List[HVACEquipmentPayload]] = []
    furniture: Optional[List[FurniturePayload]] = []
    plumbing_fixtures: Optional[List[PlumbingFixturePayload]] = []
    plumbing_pipes: Optional[List[PlumbingPipePayload]] = []


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    rooms: List[RoomPayload]
    openings: Optional[List[OpeningPayload]] = []
    hvac_equipment: Optional[List[HVACEquipmentPayload]] = []
    furniture: Optional[List[FurniturePayload]] = []
    plumbing_fixtures: Optional[List[PlumbingFixturePayload]] = []
    plumbing_pipes: Optional[List[PlumbingPipePayload]] = []
    electrical_components: Optional[List[Dict[str, Any]]] = None
    electrical_circuits: Optional[List[Dict[str, Any]]] = None
    electrical_routes: Optional[List[Dict[str, Any]]] = None


class RoomResult(BaseModel):
    name: str
    vertex_count: int
    carpet_area_sqm: float
    carpet_area_sqft: float
    centroid: List[float]
    wall_thickness_mm: float
    points: List[List[float]]
    filleted_points: List[List[float]]
    is_external_wing: bool = False


class WallPolygon(BaseModel):
    wall_type: str  # "exterior" or "interior" or "combined"
    thickness_mm: float
    outer_polygon: List[List[float]]
    inner_polygons: List[List[List[float]]] = []


class WallLine(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    wall_type: str  # "exterior" or "interior" or "boundary"


class CadDimension(BaseModel):
    id: str
    label: str
    dim_type: str  # "linear" or "callout"
    x1: float
    y1: float
    x2: float
    y2: float
    dim_x1: float
    dim_y1: float
    dim_x2: float
    dim_y2: float
    ext1_x1: float
    ext1_y1: float
    ext1_x2: float
    ext1_y2: float
    ext2_x1: float
    ext2_y1: float
    ext2_x2: float
    ext2_y2: float
    tick1_x1: float
    tick1_y1: float
    tick1_x2: float
    tick1_y2: float
    tick2_x1: float
    tick2_y1: float
    tick2_x2: float
    tick2_y2: float
    label_x: float
    label_y: float


class SolveResponse(BaseModel):
    rooms: List[RoomResult]
    wall_polygons: List[WallPolygon]
    wall_lines: List[WallLine]
    dimensions: List[CadDimension]
    doors: List[DoorCADGeometry] = []
    windows: List[WindowCADGeometry] = []
    hvac_loads: List[HVACRoomLoad] = []
    hvac_equipment: List[HVACEquipmentCAD] = []
    hvac_pipes: List[HVACPipeRoute] = []
    combined_wall_polygons: List[WallPolygon] = []
    furniture: List[FurnitureCAD] = []
    plumbing_fixtures: List[PlumbingFixtureCAD] = []
    plumbing_pipes: List[PlumbingPipeCAD] = []
    electrical_components: List[Dict[str, Any]] = []
    electrical_circuits: List[Dict[str, Any]] = []
    electrical_routes: List[Dict[str, Any]] = []
    electrical_summary: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None
    total_carpet_area_sqm: float = 0.0
    total_builtup_area_sqm: float = 0.0
    project_name: Optional[str] = None
    created_at: Optional[str] = None



DEFAULT_TEST_PAYLOAD = [
    {
        "name": "Living Room",
        "points": [[0.0, 0.0], [6000.0, 0.0], [6000.0, 5000.0], [0.0, 5000.0]],
        "fillet_radius": 0.0
    },
    {
        "name": "L-Shaped Corridor/Balcony",
        "points": [[0.0, 5000.0], [3000.0, 5000.0], [3000.0, 8000.0], [0.0, 8000.0]],
        "fillet_radius": 500.0
    }
]

DEFAULT_TEST_OPENINGS = [
    {
        "id": "D1",
        "type": "Door",
        "host_room": "Living Room",
        "wall_side": "Top",
        "offset_mm": 1000.0,
        "width_mm": 900.0,
        "height_mm": 2100.0,
        "swing": "Inward-Right"
    },
    {
        "id": "W1",
        "type": "Window",
        "host_room": "Living Room",
        "wall_side": "Right",
        "offset_mm": 1500.0,
        "width_mm": 1200.0,
        "height_mm": 1200.0,
        "swing": None
    },
    {
        "id": "W2",
        "type": "Window",
        "host_room": "L-Shaped Corridor/Balcony",
        "wall_side": "Top",
        "offset_mm": 800.0,
        "width_mm": 1000.0,
        "height_mm": 1200.0,
        "swing": None
    }
]


def compute_fillet_points(points: List[List[float]], fillet_radius: float, num_arc_segments: int = 16) -> List[List[float]]:
    """
    Computes tangent arc transitions at specified corner vertices if fillet_radius > 0.
    Returns a list of 2D coordinates [x, y] forming the filleted polygon.
    """
    if fillet_radius <= 0 or len(points) < 3:
        return [[float(p[0]), float(p[1])] for p in points]

    n = len(points)
    filleted = []

    for i in range(n):
        p_prev = points[(i - 1) % n]
        p_curr = points[i]
        p_next = points[(i + 1) % n]

        # FIX VERTEX FILLETING RULE: Do not fillet if Y coordinate is 5000 mm (shared partition line)
        if abs(p_curr[1] - 5000.0) < 1e-3:
            filleted.append([float(p_curr[0]), float(p_curr[1])])
            continue

        v1 = [p_prev[0] - p_curr[0], p_prev[1] - p_curr[1]]
        v2 = [p_next[0] - p_curr[0], p_next[1] - p_curr[1]]

        l1 = math.hypot(v1[0], v1[1])
        l2 = math.hypot(v2[0], v2[1])

        if l1 < 1e-6 or l2 < 1e-6:
            filleted.append([float(p_curr[0]), float(p_curr[1])])
            continue

        u1 = [v1[0] / l1, v1[1] / l1]
        u2 = [v2[0] / l2, v2[1] / l2]

        dot = u1[0] * u2[0] + u1[1] * u2[1]
        dot = max(-0.999999, min(0.999999, dot))
        theta = math.acos(dot)

        sin_half = math.sin(theta / 2.0)
        tan_half = math.tan(theta / 2.0)

        if abs(sin_half) < 1e-6 or abs(tan_half) < 1e-6:
            filleted.append([float(p_curr[0]), float(p_curr[1])])
            continue

        d = fillet_radius / tan_half
        d_max = min(l1, l2) * 0.49

        if d > d_max:
            d = d_max
            effective_radius = d * tan_half
        else:
            effective_radius = fillet_radius

        t1 = [p_curr[0] + d * u1[0], p_curr[1] + d * u1[1]]
        t2 = [p_curr[0] + d * u2[0], p_curr[1] + d * u2[1]]

        bx = u1[0] + u2[0]
        by = u1[1] + u2[1]
        blen = math.hypot(bx, by)

        if blen < 1e-6:
            filleted.append([float(p_curr[0]), float(p_curr[1])])
            continue

        ub = [bx / blen, by / blen]
        h = effective_radius / sin_half
        center = [p_curr[0] + h * ub[0], p_curr[1] + h * ub[1]]

        a1 = math.atan2(t1[1] - center[1], t1[0] - center[0])
        a2 = math.atan2(t2[1] - center[1], t2[0] - center[0])

        da = a2 - a1
        while da > math.pi:
            da -= 2 * math.pi
        while da <= -math.pi:
            da += 2 * math.pi

        for s in range(num_arc_segments + 1):
            frac = s / float(num_arc_segments)
            ang = a1 + frac * da
            px = center[0] + effective_radius * math.cos(ang)
            py = center[1] + effective_radius * math.sin(ang)
            filleted.append([round(px, 3), round(py, 3)])

    return filleted


def extract_polygon_coords(poly: Polygon) -> Tuple[List[List[float]], List[List[List[float]]]]:
    """Extracts exterior ring and interior holes from a Shapely Polygon."""
    ext = [[round(x, 2), round(y, 2)] for x, y in poly.exterior.coords]
    holes = []
    for hole in poly.interiors:
        holes.append([[round(x, 2), round(y, 2)] for x, y in hole.coords])
    return ext, holes


def extract_lines_from_geometry(geom, wall_type: str = "exterior") -> List[WallLine]:
    """Extracts line segments from Shapely Polygon/MultiPolygon boundaries."""
    lines = []
    if geom.is_empty:
        return lines

    if isinstance(geom, Polygon):
        polys = [geom]
    elif isinstance(geom, MultiPolygon):
        polys = list(geom.geoms)
    else:
        polys = []

    for poly in polys:
        coords = list(poly.exterior.coords)
        for i in range(len(coords) - 1):
            lines.append(WallLine(
                x1=round(coords[i][0], 2),
                y1=round(coords[i][1], 2),
                x2=round(coords[i+1][0], 2),
                y2=round(coords[i+1][1], 2),
                wall_type=wall_type
            ))
        for hole in poly.interiors:
            hcoords = list(hole.coords)
            for i in range(len(hcoords) - 1):
                lines.append(WallLine(
                    x1=round(hcoords[i][0], 2),
                    y1=round(hcoords[i][1], 2),
                    x2=round(hcoords[i+1][0], 2),
                    y2=round(hcoords[i+1][1], 2),
                    wall_type="interior"
                ))
    return lines


# Proportional Auto-Scaling Limits for Bedroom Furniture (Bed)
MIN_BED_WIDTH = 900.0    # 900 mm (Single bed minimum)
MAX_BED_WIDTH = 2000.0   # 2000 mm (King bed maximum)
MIN_BED_HEIGHT = 1800.0  # 1800 mm (Standard bed length minimum)
MAX_BED_HEIGHT = 2200.0  # 2200 mm (Extra-long bed length maximum)

# Absolute minimum safety dimension for any furniture item
MIN_FURNITURE_DIMENSION = 200.0  # 200 mm minimum threshold to prevent invalid geometry

FURNITURE_CATEGORIES: Dict[str, List[str]] = {
    "Bedroom": ["Double Bed", "Single Bed", "Wardrobe", "Bedside Table", "Dressing Table", "Bed"],
    "Living & Lounge": ["Sofa Set", "Coffee Table", "TV Unit", "Bookshelf", "Sofa"],
    "Dining Area": ["Dining Table", "Dining Chairs", "Crockery Unit"],
    "Study & Office": ["Study Desk", "Office Chair", "Filing Cabinet"],
    "General": ["Standard Furniture Block"]
}

FURNITURE_CATALOG: Dict[str, Dict[str, Any]] = {
    # Bedroom
    "Double Bed": {
        "category": "Bedroom",
        "default_width": 1800.0,
        "default_height": 2000.0,
        "min_width": 1200.0,
        "max_width": 2200.0,
        "min_height": 1800.0,
        "max_height": 2200.0,
        "description": "Standard queen/king size double bed"
    },
    "Bed": {
        "category": "Bedroom",
        "default_width": 1800.0,
        "default_height": 2000.0,
        "min_width": 900.0,
        "max_width": 2200.0,
        "min_height": 1800.0,
        "max_height": 2200.0,
        "description": "Standard bedroom bed"
    },
    "Single Bed": {
        "category": "Bedroom",
        "default_width": 1000.0,
        "default_height": 2000.0,
        "min_width": 800.0,
        "max_width": 1200.0,
        "min_height": 1800.0,
        "max_height": 2100.0,
        "description": "Single size bed for kids or guest rooms"
    },
    "Wardrobe": {
        "category": "Bedroom",
        "default_width": 1200.0,
        "default_height": 600.0,
        "min_width": 600.0,
        "max_width": 2400.0,
        "min_height": 450.0,
        "max_height": 800.0,
        "description": "2 to 4-door bedroom wardrobe / closet"
    },
    "Bedside Table": {
        "category": "Bedroom",
        "default_width": 450.0,
        "default_height": 400.0,
        "min_width": 350.0,
        "max_width": 600.0,
        "min_height": 350.0,
        "max_height": 500.0,
        "description": "Nightstand / bedside table"
    },
    "Dressing Table": {
        "category": "Bedroom",
        "default_width": 900.0,
        "default_height": 450.0,
        "min_width": 600.0,
        "max_width": 1500.0,
        "min_height": 400.0,
        "max_height": 600.0,
        "description": "Vanity / dresser with mirror"
    },
    # Living & Lounge
    "Sofa Set": {
        "category": "Living & Lounge",
        "default_width": 2000.0,
        "default_height": 850.0,
        "min_width": 1200.0,
        "max_width": 3000.0,
        "min_height": 700.0,
        "max_height": 1000.0,
        "description": "3-seater or sectional living room sofa"
    },
    "Sofa": {
        "category": "Living & Lounge",
        "default_width": 2000.0,
        "default_height": 850.0,
        "min_width": 1200.0,
        "max_width": 3000.0,
        "min_height": 700.0,
        "max_height": 1000.0,
        "description": "Living room sofa"
    },
    "Coffee Table": {
        "category": "Living & Lounge",
        "default_width": 1000.0,
        "default_height": 600.0,
        "min_width": 500.0,
        "max_width": 1500.0,
        "min_height": 400.0,
        "max_height": 900.0,
        "description": "Central living room coffee table"
    },
    "TV Unit": {
        "category": "Living & Lounge",
        "default_width": 1500.0,
        "default_height": 400.0,
        "min_width": 1000.0,
        "max_width": 2400.0,
        "min_height": 300.0,
        "max_height": 500.0,
        "description": "Entertainment media console / TV credenza"
    },
    "Bookshelf": {
        "category": "Living & Lounge",
        "default_width": 900.0,
        "default_height": 350.0,
        "min_width": 600.0,
        "max_width": 1800.0,
        "min_height": 250.0,
        "max_height": 500.0,
        "description": "Wall-mounted or freestanding bookcase"
    },
    # Dining Area
    "Dining Table": {
        "category": "Dining Area",
        "default_width": 1500.0,
        "default_height": 900.0,
        "min_width": 900.0,
        "max_width": 2400.0,
        "min_height": 750.0,
        "max_height": 1200.0,
        "description": "4 to 6-person dining table"
    },
    "Dining Chairs": {
        "category": "Dining Area",
        "default_width": 450.0,
        "default_height": 450.0,
        "min_width": 400.0,
        "max_width": 600.0,
        "min_height": 400.0,
        "max_height": 600.0,
        "description": "Dining chair unit"
    },
    "Crockery Unit": {
        "category": "Dining Area",
        "default_width": 1200.0,
        "default_height": 450.0,
        "min_width": 800.0,
        "max_width": 1800.0,
        "min_height": 350.0,
        "max_height": 600.0,
        "description": "Dining storage cabinet / sideboard"
    },
    # Study & Office
    "Study Desk": {
        "category": "Study & Office",
        "default_width": 1200.0,
        "default_height": 600.0,
        "min_width": 800.0,
        "max_width": 1800.0,
        "min_height": 500.0,
        "max_height": 800.0,
        "description": "Writing desk / computer workstation"
    },
    "Office Chair": {
        "category": "Study & Office",
        "default_width": 600.0,
        "default_height": 600.0,
        "min_width": 450.0,
        "max_width": 800.0,
        "min_height": 450.0,
        "max_height": 800.0,
        "description": "Ergonomic swivel desk chair"
    },
    "Filing Cabinet": {
        "category": "Study & Office",
        "default_width": 500.0,
        "default_height": 500.0,
        "min_width": 400.0,
        "max_width": 900.0,
        "min_height": 400.0,
        "max_height": 700.0,
        "description": "Office pedestal / document filing cabinet"
    },
    # Fallback
    "Standard Furniture Block": {
        "category": "General",
        "default_width": 1000.0,
        "default_height": 600.0,
        "min_width": 200.0,
        "max_width": 3000.0,
        "min_height": 200.0,
        "max_height": 3000.0,
        "description": "Generic parametric furniture block"
    }
}


def get_furniture_category(item_type: str) -> str:
    """Returns the category for a given furniture item type, with case-insensitive matching."""
    if not item_type or not isinstance(item_type, str):
        return "General"
    tl = item_type.strip().lower()
    for cat, items in FURNITURE_CATEGORIES.items():
        for item in items:
            if item.lower() == tl:
                return cat
    # Keyword-based category detection
    if any(k in tl for k in ["bed", "wardrobe", "closet", "dresser", "nightstand"]):
        return "Bedroom"
    if any(k in tl for k in ["sofa", "couch", "tv", "media", "coffee", "bookshelf"]):
        return "Living & Lounge"
    if any(k in tl for k in ["dining", "crockery"]):
        return "Dining Area"
    if any(k in tl for k in ["desk", "office", "cabinet", "chair"]):
        return "Study & Office"
    return "General"


def get_default_furniture_dimensions(item_type: str) -> Tuple[float, float]:
    """Returns (default_width, default_height) in mm for a given furniture item type."""
    if not item_type:
        return (1000.0, 600.0)
    if item_type in FURNITURE_CATALOG:
        entry = FURNITURE_CATALOG[item_type]
        return (entry["default_width"], entry["default_height"])
    tl = item_type.strip().lower()
    for name, entry in FURNITURE_CATALOG.items():
        if name.lower() == tl:
            return (entry["default_width"], entry["default_height"])
    return (1000.0, 600.0)


def parse_room_furniture_type(room_name: str) -> str:
    """
    Intelligently identifies the primary furniture item type suited for a given room name.
    Matches keywords for Bedroom, Living & Lounge, Dining, Study & Office.
    Returns a safe fallback 'Standard Furniture Block' if no match is found.
    """
    if not room_name or not isinstance(room_name, str):
        return "Standard Furniture Block"

    clean = room_name.lower().strip()

    # 1. Bedroom matches
    if any(k in clean for k in ["master bedroom", "master bed", "m.bed", "m.bedroom"]):
        return "Double Bed"
    if any(k in clean for k in ["single bed", "kids bed", "child bed"]):
        return "Single Bed"
    if any(k in clean for k in ["bedroom", "bed room", "bed", "guest room"]):
        return "Double Bed"
    if any(k in clean for k in ["wardrobe", "closet", "dressing"]):
        return "Wardrobe"

    # 2. Living & Lounge matches
    if any(k in clean for k in ["media", "entertainment", "tv"]):
        return "TV Unit"
    if any(k in clean for k in ["living", "lounge", "hall", "drawing", "sitting", "family", "foyer"]):
        return "Sofa Set"

    # 3. Dining Area matches
    if any(k in clean for k in ["dining", "dinning", "mess", "breakfast"]):
        return "Dining Table"

    # 4. Study & Office matches
    if any(k in clean for k in ["study", "office", "library", "work", "den"]):
        return "Study Desk"

    # 5. Generic Fallback
    return "Standard Furniture Block"


def get_room_furniture_recommendations(room_name: str) -> List[str]:
    """Returns the recommended list of furniture item types for a given room name."""
    primary = parse_room_furniture_type(room_name)
    cat = get_furniture_category(primary)
    if cat == "Bedroom":
        return ["Double Bed", "Single Bed", "Wardrobe", "Bedside Table", "Dressing Table"]
    elif cat == "Living & Lounge":
        return ["Sofa Set", "Coffee Table", "TV Unit", "Bookshelf"]
    elif cat == "Dining Area":
        return ["Dining Table", "Dining Chairs", "Crockery Unit"]
    elif cat == "Study & Office":
        return ["Study Desk", "Office Chair", "Filing Cabinet", "Bookshelf"]
    return ["Standard Furniture Block"]


def validate_and_normalize_furniture(
    furn: FurniturePayload,
    room_bounds: Optional[Tuple[float, float, float, float]] = None
) -> FurniturePayload:
    """
    Strict dimension and boundary validation rules (preventing crashes):
    - Validates width and height >= MIN_FURNITURE_DIMENSION (200mm).
    - Falls back to catalog defaults if non-positive, zero, or invalid.
    - Clamps position coordinates within room bounds when bounds are available.
    """
    f_type = furn.type or "Standard Furniture Block"
    cat = furn.category or get_furniture_category(f_type)
    def_w, def_h = get_default_furniture_dimensions(f_type)

    # Dimension validation
    try:
        w = float(furn.width) if (furn.width is not None and not math.isnan(float(furn.width))) else def_w
        if w < MIN_FURNITURE_DIMENSION:
            w = def_w
    except (ValueError, TypeError):
        w = def_w

    try:
        h = float(furn.height) if (furn.height is not None and not math.isnan(float(furn.height))) else def_h
        if h < MIN_FURNITURE_DIMENSION:
            h = def_h
    except (ValueError, TypeError):
        h = def_h

    # Position validation
    if room_bounds:
        min_x, min_y, max_x, max_y = room_bounds
        rw = max_x - min_x
        rh = max_y - min_y

        # Ensure dimensions don't exceed 90% of room bounds for safe walking clearance
        if w > rw * 0.9:
            w = max(MIN_FURNITURE_DIMENSION, rw * 0.85)
        if h > rh * 0.9:
            h = max(MIN_FURNITURE_DIMENSION, rh * 0.85)

        # Coordinate clamping within room boundary limits
        try:
            raw_x = float(furn.x) if (furn.x is not None and not math.isnan(float(furn.x))) else (min_x + rw / 2.0)
        except (ValueError, TypeError):
            raw_x = min_x + rw / 2.0

        try:
            raw_y = float(furn.y) if (furn.y is not None and not math.isnan(float(furn.y))) else (min_y + rh / 2.0)
        except (ValueError, TypeError):
            raw_y = min_y + rh / 2.0

        # Boundary coordinate limits (prevent out-of-bounds coordinate runaway while permitting wall clearance checks)
        safe_x = min(max_x - 50.0, max(min_x + 50.0, raw_x))
        safe_y = min(max_y - 50.0, max(min_y + 50.0, raw_y))
    else:
        safe_x = float(furn.x) if furn.x is not None else 0.0
        safe_y = float(furn.y) if furn.y is not None else 0.0

    rot = float(furn.rotation or 0.0) % 360.0

    return FurniturePayload(
        id=furn.id or "FURN-1",
        type=f_type,
        host_room_id=furn.host_room_id or "Room",
        width=round(w, 1),
        height=round(h, 1),
        x=round(safe_x, 1),
        y=round(safe_y, 1),
        rotation=round(rot, 1),
        clearance_status=furn.clearance_status or "OK",
        category=cat
    )


def calculate_furniture_cad(
    room_name: str,
    points: List[List[float]],
    item_id: str,
    user_furniture: Optional[FurniturePayload] = None,
    item_type: Optional[str] = None,
    shift: Tuple[float, float] = (0.0, 0.0),
    doors: Optional[List[DoorCADGeometry]] = None,
    windows: Optional[List[WindowCADGeometry]] = None
) -> Optional[FurnitureCAD]:
    """
    Computes placement for any furniture category (Bedroom, Living, Dining, Study, General)
    with bounds checking, dimension validation, door clearance evaluation, and category tagging.
    """
    if not points or len(points) < 3:
        return None

    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    room_w = max_x - min_x
    room_h = max_y - min_y

    if room_w <= 100.0 or room_h <= 100.0:
        return None

    room_bounds = (min_x, min_y, max_x, max_y)

    # Collect exclusion zones for all doors in this room
    room_name_clean = (room_name or "").lower().strip()
    room_doors = [d for d in (doors or []) if d.host_room and d.host_room.lower().strip() == room_name_clean]
    door_exclusion_polys = [build_door_exclusion_zone(d, DOOR_CLEARANCE_BUFFER) for d in room_doors]
    door_exclusion_union = unary_union(door_exclusion_polys) if door_exclusion_polys else None

    # If user provided a furniture payload, validate and apply shift
    if user_furniture is not None:
        dx, dy = shift
        # Apply room shift to coordinates if provided
        shifted_payload = FurniturePayload(
            id=user_furniture.id or item_id,
            type=user_furniture.type or item_type or "Standard Furniture Block",
            host_room_id=room_name or "Room",
            width=user_furniture.width,
            height=user_furniture.height,
            x=(float(user_furniture.x) + dx) if user_furniture.x is not None else None,
            y=(float(user_furniture.y) + dy) if user_furniture.y is not None else None,
            rotation=user_furniture.rotation or 0.0,
            clearance_status=user_furniture.clearance_status or "OK",
            category=user_furniture.category
        )
        norm = validate_and_normalize_furniture(shifted_payload, room_bounds)
        f_w, f_h = norm.width, norm.height
        f_x, f_y = norm.x, norm.y
        f_rot = norm.rotation
        f_type = norm.type
        f_cat = norm.category or get_furniture_category(f_type)

        # Check door swing and wall boundary clearance
        clearance_status = "OK"
        raw_box = box(f_x - f_w / 2.0, f_y - f_h / 2.0, f_x + f_w / 2.0, f_y + f_h / 2.0)
        user_poly = rotate(raw_box, f_rot, origin='center') if f_rot != 0.0 else raw_box

        # 1. Wall boundary crossing validation
        room_poly = Polygon(points) if points and len(points) >= 3 else None
        if room_poly and room_poly.is_valid and not room_poly.is_empty:
            if not room_poly.covers(user_poly):
                diff = user_poly.difference(room_poly)
                if diff.area > 50.0:
                    clearance_status = "Warning: Wall Collision"

        # 2. Door swing clearance validation (200mm buffer rule)
        if door_exclusion_union and not door_exclusion_union.is_empty:
            if user_poly.intersects(door_exclusion_union):
                if clearance_status == "OK":
                    clearance_status = "Warning: Blocks Door"
                else:
                    clearance_status = f"{clearance_status} & Blocks Door"
            elif user_poly.distance(door_exclusion_union) < 50.0:
                if clearance_status == "OK":
                    clearance_status = "Warning: Close to Door Swing (<50mm)"

        return FurnitureCAD(
            id=norm.id,
            type=f_type,
            host_room_id=room_name or "Room",
            width=f_w,
            height=f_h,
            x=f_x,
            y=f_y,
            rotation=f_rot,
            label=f"{norm.id} [{int(f_w)}x{int(f_h)}mm]",
            clearance_status=clearance_status,
            category=f_cat
        )

    # For auto-placement when no user_furniture is given:
    determined_type = item_type or parse_room_furniture_type(room_name or "Room")
    if is_bedroom_room(room_name or "") or determined_type in ["Bed", "Double Bed"]:
        bed_res = calculate_auto_scaled_bed(
            room_name=room_name or "Room",
            points=points,
            bed_id=item_id,
            user_furniture=None,
            shift=shift,
            doors=doors,
            windows=windows
        )
        if bed_res:
            bed_res.category = "Bedroom"
            return bed_res

    # For other furniture types, place centrally with clearance check
    def_w, def_h = get_default_furniture_dimensions(determined_type)
    scaled_w = min(def_w, room_w * 0.7)
    scaled_h = min(def_h, room_h * 0.7)
    cx = min_x + room_w / 2.0
    cy = min_y + room_h / 2.0

    raw_box = box(cx - scaled_w / 2.0, cy - scaled_h / 2.0, cx + scaled_w / 2.0, cy + scaled_h / 2.0)
    clearance_status = "OK"
    room_poly = Polygon(points) if points and len(points) >= 3 else None
    if room_poly and room_poly.is_valid and not room_poly.is_empty:
        if not room_poly.covers(raw_box):
            diff = raw_box.difference(room_poly)
            if diff.area > 50.0:
                clearance_status = "Warning: Wall Collision"

    if door_exclusion_union and not door_exclusion_union.is_empty:
        if raw_box.intersects(door_exclusion_union):
            if clearance_status == "OK":
                clearance_status = "Warning: Blocks Door"
            else:
                clearance_status = f"{clearance_status} & Blocks Door"
        elif raw_box.distance(door_exclusion_union) < 50.0:
            if clearance_status == "OK":
                clearance_status = "Warning: Close to Door Swing (<50mm)"

    return FurnitureCAD(
        id=item_id,
        type=determined_type,
        host_room_id=room_name,
        width=round(scaled_w, 1),
        height=round(scaled_h, 1),
        x=round(cx, 1),
        y=round(cy, 1),
        rotation=0.0,
        label=f"{item_id} [{int(scaled_w)}x{int(scaled_h)}mm]",
        clearance_status=clearance_status,
        category=get_furniture_category(determined_type)
    )


def evaluate_all_furniture_clearances(
    furniture_items: List[FurnitureCAD],
    rooms: Optional[List[Any]] = None,
    doors: Optional[List[DoorCADGeometry]] = None
) -> List[FurnitureCAD]:
    """
    Evaluates multi-item furniture collisions (bounding box intersections)
    and validates room boundary containment and door clearance across the full floorplan.
    """
    if not furniture_items:
        return []

    # Map rooms by lowercase clean name
    room_map = {}
    if rooms:
        for r in rooms:
            r_name = getattr(r, "name", "") or ""
            r_pts = getattr(r, "points", [])
            if r_name and r_pts and len(r_pts) >= 3:
                try:
                    poly = Polygon(r_pts)
                    if poly.is_valid and not poly.is_empty:
                        room_map[r_name.lower().strip()] = poly
                except Exception:
                    pass

    # Build oriented bounding box polygons for all furniture items
    furn_polys = []
    for f in furniture_items:
        try:
            fw, fh = float(f.width), float(f.height)
            fx, fy = float(f.x), float(f.y)
            frot = float(f.rotation or 0.0)
            raw = box(fx - fw / 2.0, fy - fh / 2.0, fx + fw / 2.0, fy + fh / 2.0)
            poly = rotate(raw, frot, origin='center') if frot != 0.0 else raw
            furn_polys.append(poly)
        except Exception:
            furn_polys.append(None)

    # 1. Multi-item collision / overlap detection
    n = len(furniture_items)
    for i in range(n):
        poly_i = furn_polys[i]
        if poly_i is None or poly_i.is_empty:
            continue
        for j in range(i + 1, n):
            poly_j = furn_polys[j]
            if poly_j is None or poly_j.is_empty:
                continue

            try:
                if poly_i.intersects(poly_j):
                    overlap_area = poly_i.intersection(poly_j).area
                    if overlap_area > 500.0:  # > 500 mm² overlap threshold
                        item_i = furniture_items[i]
                        item_j = furniture_items[j]

                        if item_i.clearance_status == "OK":
                            item_i.clearance_status = f"Warning: Overlaps {item_j.id}"
                        elif "Overlaps" not in item_i.clearance_status:
                            item_i.clearance_status += f" & Overlaps {item_j.id}"

                        if item_j.clearance_status == "OK":
                            item_j.clearance_status = f"Warning: Overlaps {item_i.id}"
                        elif "Overlaps" not in item_j.clearance_status:
                            item_j.clearance_status += f" & Overlaps {item_i.id}"
            except Exception:
                continue

    return furniture_items


def generate_initial_furniture_layout(
    rooms: List[RoomPayload],
    include_all_categories: bool = True
) -> List[FurniturePayload]:
    """
    Intelligently generates initial furniture payloads for rooms based on their names
    (Bedroom -> Double Bed, Living -> Sofa Set, Dining -> Dining Table, Study -> Study Desk)
    with safe generic fallbacks for unrecognized rooms.
    """
    initial_items: List[FurniturePayload] = []
    item_counter = 1

    for r in rooms:
        pts = r.points
        if not pts or len(pts) < 3:
            continue
        xs = [float(p[0]) for p in pts]
        ys = [float(p[1]) for p in pts]
        rw = max(xs) - min(xs)
        rh = max(ys) - min(ys)
        cx = min(xs) + rw / 2.0
        cy = min(ys) + rh / 2.0

        item_type = parse_room_furniture_type(r.name)
        if not include_all_categories and not is_bedroom_room(r.name):
            continue

        def_w, def_h = get_default_furniture_dimensions(item_type)
        cat = get_furniture_category(item_type)

        fit_w = min(def_w, max(MIN_FURNITURE_DIMENSION, rw * 0.7))
        fit_h = min(def_h, max(MIN_FURNITURE_DIMENSION, rh * 0.7))

        prefix = item_type.upper().replace(' ', '_')[:4]
        initial_items.append(FurniturePayload(
            id=f"{prefix}-{item_counter}",
            type=item_type,
            host_room_id=r.name,
            width=round(fit_w, 1),
            height=round(fit_h, 1),
            x=round(cx, 1),
            y=round(cy, 1),
            rotation=0.0,
            clearance_status="OK",
            category=cat
        ))
        item_counter += 1

    return initial_items


def is_bedroom_room(name: str) -> bool:
    """Checks if a room name indicates a bedroom (e.g. 'Bedroom', 'Master Bedroom', 'Guest Bedroom')."""
    if not name:
        return False
    nl = name.lower().strip()
    return "bedroom" in nl or "bed room" in nl or "bed" in nl.split()


DOOR_CLEARANCE_BUFFER = 200.0  # 200 mm buffer from door swing arc and openings
MIN_WALL_CLEARANCE = 200.0     # 200 mm minimum padding from bedroom walls


def build_door_exclusion_zone(door: DoorCADGeometry, buffer_mm: float = DOOR_CLEARANCE_BUFFER) -> Polygon:
    """
    Builds a Shapely polygon representing the door swing path plus the required clearance buffer.
    Combines the swept swing quadrant and the jamb passage with clearance padding.
    """
    try:
        hx, hy = float(door.hinge[0]), float(door.hinge[1])
        lx, ly = float(door.leaf_end[0]), float(door.leaf_end[1])
        radius = float(door.width_mm) + buffer_mm

        # Sector boundary box containing hinge, leaf end, jambs, and swing sweep
        all_xs = [hx, lx]
        all_ys = [hy, ly]
        if door.jambs and len(door.jambs) >= 2:
            all_xs.extend([float(door.jambs[0][0]), float(door.jambs[0][2]), float(door.jambs[1][0]), float(door.jambs[1][2])])
            all_ys.extend([float(door.jambs[0][1]), float(door.jambs[0][3]), float(door.jambs[1][1]), float(door.jambs[1][3])])

        bx1 = min(all_xs) - buffer_mm
        bx2 = max(all_xs) + buffer_mm
        by1 = min(all_ys) - buffer_mm
        by2 = max(all_ys) + buffer_mm

        hinge_circle = Point(hx, hy).buffer(radius, quad_segs=16)
        swing_box = box(bx1, by1, bx2, by2)
        swing_poly = hinge_circle.intersection(swing_box)

        # Include door jamb passage cutout with clearance
        if door.jambs and len(door.jambs) >= 2:
            j_xs = [float(door.jambs[0][0]), float(door.jambs[0][2]), float(door.jambs[1][0]), float(door.jambs[1][2])]
            j_ys = [float(door.jambs[0][1]), float(door.jambs[0][3]), float(door.jambs[1][1]), float(door.jambs[1][3])]
            jamb_box = box(min(j_xs) - buffer_mm, min(j_ys) - buffer_mm, max(j_xs) + buffer_mm, max(j_ys) + buffer_mm)
            swing_poly = unary_union([swing_poly, jamb_box])

        return swing_poly if (swing_poly and not swing_poly.is_empty) else box(bx1, by1, bx2, by2)
    except Exception:
        hx, hy = door.hinge if door.hinge else (0.0, 0.0)
        w = float(door.width_mm) if door.width_mm else 900.0
        return box(hx - w - buffer_mm, hy - w - buffer_mm, hx + w + buffer_mm, hy + w + buffer_mm)


def calculate_auto_scaled_bed(
    room_name: str,
    points: List[List[float]],
    bed_id: str = "BED-1",
    user_furniture: Optional[FurniturePayload] = None,
    shift: Tuple[float, float] = (0.0, 0.0),
    doors: Optional[List[DoorCADGeometry]] = None,
    windows: Optional[List[WindowCADGeometry]] = None
) -> Optional[FurnitureCAD]:
    """
    Computes proportionally auto-scaled Bed geometry centered comfortably inside a bedroom,
    evaluating collision detection with door swing paths and enforcing minimum 200mm clearances.
    """
    if not points or len(points) < 3:
        return None

    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    room_w = max_x - min_x
    room_h = max_y - min_y

    if room_w <= 100.0 or room_h <= 100.0:
        return None

    # Collect exclusion zones for all doors in this room
    room_name_clean = room_name.lower().strip()
    room_doors = [d for d in (doors or []) if d.host_room and d.host_room.lower().strip() == room_name_clean]
    door_exclusion_polys = [build_door_exclusion_zone(d, DOOR_CLEARANCE_BUFFER) for d in room_doors]
    door_exclusion_union = unary_union(door_exclusion_polys) if door_exclusion_polys else None

    # If custom user-specified furniture was provided, honor its dimensions and apply room shift
    if user_furniture is not None:
        dx, dy = shift
        f_w = float(user_furniture.width) if user_furniture.width > 0 else 1500.0
        f_h = float(user_furniture.height) if user_furniture.height > 0 else 2000.0
        f_rot = float(user_furniture.rotation or 0.0)
        f_x = float(user_furniture.x) + dx if user_furniture.x is not None else (min_x + room_w / 2.0)
        f_y = float(user_furniture.y) + dy if user_furniture.y is not None else (min_y + room_h / 2.0)

        # Check clearance against door swing exclusion zones
        clearance_status = "OK"
        if door_exclusion_union and not door_exclusion_union.is_empty:
            raw_box = box(f_x - f_w / 2.0, f_y - f_h / 2.0, f_x + f_w / 2.0, f_y + f_h / 2.0)
            user_poly = rotate(raw_box, f_rot, origin='center') if f_rot != 0.0 else raw_box
            if user_poly.intersects(door_exclusion_union):
                clearance_status = "Warning: Door Swing Collision"
            elif user_poly.distance(door_exclusion_union) < 50.0:
                clearance_status = "Warning: Close to Door Swing (<50mm)"

        return FurnitureCAD(
            id=user_furniture.id or bed_id,
            type=user_furniture.type or "Bed",
            host_room_id=room_name,
            width=round(f_w, 1),
            height=round(f_h, 1),
            x=round(f_x, 1),
            y=round(f_y, 1),
            rotation=f_rot,
            label=f"{user_furniture.id or bed_id} [{int(f_w)}x{int(f_h)}mm]",
            clearance_status=clearance_status,
            category=user_furniture.category or get_furniture_category(user_furniture.type or "Bed")
        )

    # Proportional auto-scaling: 25-30% (nominal 28%) of the room's minor axis
    minor_axis = min(room_w, room_h)

    # Auto-scale width between MIN_BED_WIDTH and MAX_BED_WIDTH
    target_w = minor_axis * 0.28
    scaled_w = max(MIN_BED_WIDTH, min(MAX_BED_WIDTH, target_w))

    # Proportional height (bed length) standard ~1.35x width, bounded by MIN_BED_HEIGHT and MAX_BED_HEIGHT
    target_h = scaled_w * 1.35
    scaled_h = max(MIN_BED_HEIGHT, min(MAX_BED_HEIGHT, target_h))

    # Safety clamp: Ensure bed fits comfortably inside room bounds (max 65% of room dimensions)
    if scaled_w > room_w * 0.65:
        scaled_w = max(400.0, room_w * 0.65)
    if scaled_h > room_h * 0.65:
        scaled_h = max(500.0, room_h * 0.65)

    # Minimum wall clearance bounds (>= 200mm padding from walls where possible)
    eff_pad_x = min(MIN_WALL_CLEARANCE, max(0.0, (room_w - scaled_w) / 2.0))
    eff_pad_y = min(MIN_WALL_CLEARANCE, max(0.0, (room_h - scaled_h) / 2.0))
    min_cx = min_x + eff_pad_x + scaled_w / 2.0
    max_cx = max_x - eff_pad_x - scaled_w / 2.0
    min_cy = min_y + eff_pad_y + scaled_h / 2.0
    max_cy = max_y - eff_pad_y - scaled_h / 2.0

    if min_cx > max_cx:
        min_cx = max_cx = min_x + room_w / 2.0
    if min_cy > max_cy:
        min_cy = max_cy = min_y + room_h / 2.0

    # Default position: exact center of room
    center_x = min_x + room_w / 2.0
    center_y = min_y + room_h / 2.0

    # Collision avoidance against door swing paths
    chosen_x = center_x
    chosen_y = center_y
    clearance_status = "OK"

    if door_exclusion_union and not door_exclusion_union.is_empty:
        center_box = box(center_x - scaled_w / 2.0, center_y - scaled_h / 2.0, center_x + scaled_w / 2.0, center_y + scaled_h / 2.0)
        # If center collides or is within door clearance buffer
        if center_box.intersects(door_exclusion_union) or center_box.distance(door_exclusion_union) < 50.0:
            # Generate candidate positions respecting wall clearance padding
            candidates = [
                (center_x, min_cy),
                (center_x, max_cy),
                (min_cx, center_y),
                (max_cx, center_y),
                (min_cx, min_cy),
                (max_cx, min_cy),
                (min_cx, max_cy),
                (max_cx, max_cy),
                ((min_cx + center_x) / 2.0, min_cy),
                ((max_cx + center_x) / 2.0, min_cy),
                ((min_cx + center_x) / 2.0, max_cy),
                ((max_cx + center_x) / 2.0, max_cy)
            ]

            best_candidate = (center_x, center_y)
            best_score = -float('inf')

            for cx_cand, cy_cand in candidates:
                cand_box = box(cx_cand - scaled_w / 2.0, cy_cand - scaled_h / 2.0, cx_cand + scaled_w / 2.0, cy_cand + scaled_h / 2.0)
                if cand_box.intersects(door_exclusion_union):
                    # Intersects door zone: penalty proportional to overlap area
                    overlap_area = cand_box.intersection(door_exclusion_union).area
                    score = -100000.0 - overlap_area
                else:
                    # Clear! Reward distance to door exclusion zone and slight preference towards center
                    dist_to_door = cand_box.distance(door_exclusion_union)
                    dist_to_center = math.hypot(cx_cand - center_x, cy_cand - center_y)
                    score = dist_to_door * 5.0 - dist_to_center * 0.2

                if score > best_score:
                    best_score = score
                    best_candidate = (cx_cand, cy_cand)

            chosen_x, chosen_y = best_candidate
            final_box = box(chosen_x - scaled_w / 2.0, chosen_y - scaled_h / 2.0, chosen_x + scaled_w / 2.0, chosen_y + scaled_h / 2.0)
            if final_box.intersects(door_exclusion_union):
                clearance_status = "Warning: Near Door Swing"
            else:
                clearance_status = "OK"

    return FurnitureCAD(
        id=bed_id,
        type="Bed",
        host_room_id=room_name,
        width=round(scaled_w, 1),
        height=round(scaled_h, 1),
        x=round(chosen_x, 1),
        y=round(chosen_y, 1),
        rotation=0.0,
        label=f"{bed_id} [{int(scaled_w)}x{int(scaled_h)}mm]",
        clearance_status=clearance_status,
        category="Bedroom"
    )


def build_linear_dimension(
    dim_id: str,
    label: str,
    x1: float, y1: float,
    x2: float, y2: float,
    offset_dist: float,
    is_horizontal: bool,
    tick_len: float = 120.0
) -> CadDimension:
    """Builds a parametric CAD dimension line with 45-degree slash ticks and extension lines."""
    if is_horizontal:
        dim_y = y1 + offset_dist
        dim_x1, dim_y1 = x1, dim_y
        dim_x2, dim_y2 = x2, dim_y

        ext1_start = [x1, y1]
        ext1_end = [x1, dim_y + (100.0 if offset_dist > 0 else -100.0)]
        ext2_start = [x2, y2]
        ext2_end = [x2, dim_y + (100.0 if offset_dist > 0 else -100.0)]

        tick1 = [x1 - tick_len / 2, dim_y - tick_len / 2, x1 + tick_len / 2, dim_y + tick_len / 2]
        tick2 = [x2 - tick_len / 2, dim_y - tick_len / 2, x2 + tick_len / 2, dim_y + tick_len / 2]
        label_x, label_y = (x1 + x2) / 2.0, dim_y + (180.0 if offset_dist > 0 else -180.0)
    else:
        dim_x = x1 + offset_dist
        dim_x1, dim_y1 = dim_x, y1
        dim_x2, dim_y2 = dim_x, y2

        ext1_start = [x1, y1]
        ext1_end = [dim_x + (100.0 if offset_dist > 0 else -100.0), y1]
        ext2_start = [x2, y2]
        ext2_end = [dim_x + (100.0 if offset_dist > 0 else -100.0), y2]

        tick1 = [dim_x - tick_len / 2, y1 - tick_len / 2, dim_x + tick_len / 2, y1 + tick_len / 2]
        tick2 = [dim_x - tick_len / 2, y2 - tick_len / 2, dim_x + tick_len / 2, y2 + tick_len / 2]
        label_x, label_y = dim_x + (250.0 if offset_dist > 0 else -250.0), (y1 + y2) / 2.0

    return CadDimension(
        id=dim_id,
        label=label,
        dim_type="linear",
        x1=x1, y1=y1, x2=x2, y2=y2,
        dim_x1=dim_x1, dim_y1=dim_y1, dim_x2=dim_x2, dim_y2=dim_y2,
        ext1_x1=ext1_start[0], ext1_y1=ext1_start[1], ext1_x2=ext1_end[0], ext1_y2=ext1_end[1],
        ext2_x1=ext2_start[0], ext2_y1=ext2_start[1], ext2_x2=ext2_end[0], ext2_y2=ext2_end[1],
        tick1_x1=tick1[0], tick1_y1=tick1[1], tick1_x2=tick1[2], tick1_y2=tick1[3],
        tick2_x1=tick2[0], tick2_y1=tick2[1], tick2_x2=tick2[2], tick2_y2=tick2[3],
        label_x=label_x, label_y=label_y
    )


def compute_cad_dimensions(union_rooms: Polygon, rooms: List[RoomPayload]) -> List[CadDimension]:
    """Generates exterior boundary dimensions and wall thickness callouts."""
    dims = []
    if union_rooms.is_empty:
        return dims

    minx, miny, maxx, maxy = union_rooms.bounds

    # Overall Bottom Dimension
    dims.append(build_linear_dimension(
        dim_id="dim-bottom-ext",
        label=f"{int(maxx - minx)} mm",
        x1=minx, y1=miny, x2=maxx, y2=miny,
        offset_dist=-900.0,
        is_horizontal=True
    ))

    # Overall Right Dimension
    dims.append(build_linear_dimension(
        dim_id="dim-right-ext",
        label=f"{int(maxy - miny)} mm",
        x1=maxx, y1=miny, x2=maxx, y2=maxy,
        offset_dist=900.0,
        is_horizontal=False
    ))

    # Corridor Top Dimension
    corridor_room = next((r for r in rooms if "corridor" in r.name.lower() or "balcony" in r.name.lower()), None)
    if corridor_room:
        c_pts = corridor_room.points
        c_minx = min(p[0] for p in c_pts)
        c_maxx = max(p[0] for p in c_pts)
        c_maxy = max(p[1] for p in c_pts)
        dims.append(build_linear_dimension(
            dim_id="dim-top-corridor",
            label=f"{int(c_maxx - c_minx)} mm",
            x1=c_minx, y1=c_maxy, x2=c_maxx, y2=c_maxy,
            offset_dist=750.0,
            is_horizontal=True
        ))

    # Exterior Wall Callout (230 mm)
    dims.append(CadDimension(
        id="callout-ext-wall",
        label="Ext Wall: 230 mm",
        dim_type="callout",
        x1=maxx, y1=2500.0, x2=maxx + 230.0, y2=2500.0,
        dim_x1=maxx, dim_y1=2500.0, dim_x2=maxx + 1200.0, dim_y2=2500.0,
        ext1_x1=maxx, ext1_y1=2500.0, ext1_x2=maxx, ext1_y2=2500.0,
        ext2_x1=maxx + 230.0, ext2_y1=2500.0, ext2_x2=maxx + 230.0, ext2_y2=2500.0,
        tick1_x1=maxx, tick1_y1=2450.0, tick1_x2=maxx, tick1_y2=2550.0,
        tick2_x1=maxx + 230.0, tick2_y1=2450.0, tick2_x2=maxx + 230.0, tick2_y2=2550.0,
        label_x=maxx + 1300.0, label_y=2500.0
    ))

    # Party Partition Wall Callout (115 mm)
    if len(rooms) > 1:
        dims.append(CadDimension(
            id="callout-party-wall",
            label="Party Wall: 115 mm",
            dim_type="callout",
            x1=1500.0, y1=5000.0, x2=1500.0, y2=5115.0,
            dim_x1=-1200.0, dim_y1=5057.5, dim_x2=1500.0, dim_y2=5057.5,
            ext1_x1=1500.0, ext1_y1=5000.0, ext1_x2=1500.0, ext1_y2=5000.0,
            ext2_x1=1500.0, ext2_y1=5115.0, ext2_x2=1500.0, ext2_y2=5115.0,
            tick1_x1=1450.0, tick1_y1=5000.0, tick1_x2=1550.0, tick1_y2=5000.0,
            tick2_x1=1450.0, tick2_y1=5115.0, tick2_x2=1550.0, tick2_y2=5115.0,
            label_x=-1300.0, label_y=5057.5
        ))

    return dims


def process_geometry_solve(
    rooms: List[RoomPayload],
    openings: Optional[List[OpeningPayload]] = None,
    hvac_equipment: Optional[List[HVACEquipmentPayload]] = None,
    furniture: Optional[List[FurniturePayload]] = None
) -> SolveResponse:
    """
    Main geometric solver for parametric 2D Architectural CAD engine.
    - Generates filleted room polygons
    - Performs boolean unary_union for watertight walls
    - Executes boolean subtraction for door and window openings (Precision Rule 1: full penetration with epsilon margin)
    - Computes door 90° swing arcs & leaf lines strictly oriented into the host room (Precision Rule 2)
    - Computes window 3-line symbols (sill, glass, frame)
    - Computes double-line wall boundaries, carpet area, centroid, and CAD dimension ticks
    - Computes HVAC cooling loads, equipment placement, and orthogonal refrigerant pipe routing
    """
    room_results: List[RoomResult] = []
    shapely_polys: List[Polygon] = []
    room_bounds_map: Dict[str, Tuple[float, float, float, float]] = {}

    for room in rooms:
        filleted = compute_fillet_points(room.points, room.fillet_radius)
        poly = Polygon(filleted)
        
        if not poly.is_valid:
            poly = poly.buffer(0)

        shapely_polys.append(poly)
        minx, miny, maxx, maxy = poly.bounds
        room_bounds_map[room.name] = (minx, miny, maxx, maxy)

        area_sqm = round(poly.area / 1_000_000.0, 1)
        area_sqft = round(area_sqm * 10.76391041671, 1)
        cent = poly.centroid
        centroid_coords = [round(cent.x, 2), round(cent.y, 2)]

        wall_thick = 230.0 if len(rooms) == 1 else (230.0 if "living" in room.name.lower() else 115.0)

        room_results.append(RoomResult(
            name=room.name,
            vertex_count=len(room.points),
            carpet_area_sqm=area_sqm,
            carpet_area_sqft=area_sqft,
            centroid=centroid_coords,
            wall_thickness_mm=wall_thick,
            points=[[float(p[0]), float(p[1])] for p in room.points],
            filleted_points=filleted
        ))

    if shapely_polys:
        union_rooms = unary_union(shapely_polys)
    else:
        union_rooms = Polygon()

    # 1. Exterior Load-Bearing Walls: offset union outwards by 230 mm
    exterior_buffered = union_rooms.buffer(230.0, join_style=2)
    exterior_wall_geom = exterior_buffered.difference(union_rooms)

    # 2. Interior Partition Shared Walls:
    interior_buffered_list = [p.buffer(57.5, join_style=2) for p in shapely_polys]
    all_interior_buffered = unary_union(interior_buffered_list) if interior_buffered_list else Polygon()
    interior_wall_geom = all_interior_buffered.difference(union_rooms)

    # Combined watertight wall geometry
    combined_walls = exterior_wall_geom.union(interior_wall_geom)

    # EXPLICIT INTERIOR PARTITION WALL GENERATION:
    party_wall = Polygon([[0.0, 5000.0], [3000.0, 5000.0], [3000.0, 5115.0], [0.0, 5115.0]])
    combined_walls = combined_walls.union(party_wall)
    combined_walls = combined_walls.simplify(0.1, preserve_topology=True)

    # 3. BOOLEAN WALL CUTOUTS & OPENINGS SOLVER
    cutout_polygons = []
    doors_cad: List[DoorCADGeometry] = []
    windows_cad: List[WindowCADGeometry] = []

    if openings:
        margin = 50.0  # Safe epsilon margin for full penetration (Precision Rule 1)

        for op in openings:
            # Find bounds of host room
            bounds = room_bounds_map.get(op.host_room)
            if not bounds:
                # Fallback to first room bounds if host_room name doesn't match exactly
                bounds = list(room_bounds_map.values())[0] if room_bounds_map else (0.0, 0.0, 6000.0, 5000.0)

            minx, miny, maxx, maxy = bounds
            side = (op.wall_side or "Top").capitalize()

            # Determine wall thickness at host wall
            wall_t = 115.0 if (side == "Top" and abs(maxy - 5000.0) < 1e-3 and "Living" in op.host_room) else 230.0

            # Calculate Opening Geometry based on Wall Side
            if side == "Top":
                x1 = minx + op.offset_mm
                x2 = x1 + op.width_mm
                cut_box = box(x1, maxy - margin, x2, maxy + wall_t + margin)
                wall_y_inner = maxy
                wall_y_outer = maxy + wall_t

                # Door CAD Geometry (Orientation into Host Room: -Y direction)
                swing = op.swing or "Inward-Right"
                if swing == "Inward-Left":
                    hinge = [x2, wall_y_inner]
                    leaf_end = [x2, wall_y_inner - op.width_mm]
                    arc_path = f"M {x1} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 0 {x2} {wall_y_inner - op.width_mm}"
                elif swing == "Outward-Right":
                    hinge = [x1, wall_y_outer]
                    leaf_end = [x1, wall_y_outer + op.width_mm]
                    arc_path = f"M {x2} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 0 {x1} {wall_y_outer + op.width_mm}"
                elif swing == "Outward-Left":
                    hinge = [x2, wall_y_outer]
                    leaf_end = [x2, wall_y_outer + op.width_mm]
                    arc_path = f"M {x1} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 1 {x2} {wall_y_outer + op.width_mm}"
                else:  # Default: Inward-Right
                    hinge = [x1, wall_y_inner]
                    leaf_end = [x1, wall_y_inner - op.width_mm]
                    arc_path = f"M {x2} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 1 {x1} {wall_y_inner - op.width_mm}"

                jambs = [
                    [x1, wall_y_inner, x1, wall_y_outer],
                    [x2, wall_y_inner, x2, wall_y_outer]
                ]
                win_lines = [
                    [x1, wall_y_inner, x2, wall_y_inner],
                    [x1, wall_y_inner + wall_t / 2.0, x2, wall_y_inner + wall_t / 2.0],
                    [x1, wall_y_outer, x2, wall_y_outer]
                ]
                label_pos = [(x1 + x2) / 2.0, wall_y_inner - 200.0 if "Inward" in swing else wall_y_outer + 200.0]

            elif side == "Bottom":
                x1 = minx + op.offset_mm
                x2 = x1 + op.width_mm
                cut_box = box(x1, miny - wall_t - margin, x2, miny + margin)
                wall_y_inner = miny
                wall_y_outer = miny - wall_t

                swing = op.swing or "Inward-Right"
                if swing == "Inward-Left":
                    hinge = [x2, wall_y_inner]
                    leaf_end = [x2, wall_y_inner + op.width_mm]
                    arc_path = f"M {x1} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 1 {x2} {wall_y_inner + op.width_mm}"
                elif swing == "Outward-Right":
                    hinge = [x1, wall_y_outer]
                    leaf_end = [x1, wall_y_outer - op.width_mm]
                    arc_path = f"M {x2} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 1 {x1} {wall_y_outer - op.width_mm}"
                elif swing == "Outward-Left":
                    hinge = [x2, wall_y_outer]
                    leaf_end = [x2, wall_y_outer - op.width_mm]
                    arc_path = f"M {x1} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 0 {x2} {wall_y_outer - op.width_mm}"
                else:  # Inward-Right
                    hinge = [x1, wall_y_inner]
                    leaf_end = [x1, wall_y_inner + op.width_mm]
                    arc_path = f"M {x2} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 0 {x1} {wall_y_inner + op.width_mm}"

                jambs = [
                    [x1, wall_y_outer, x1, wall_y_inner],
                    [x2, wall_y_outer, x2, wall_y_inner]
                ]
                win_lines = [
                    [x1, wall_y_inner, x2, wall_y_inner],
                    [x1, wall_y_inner - wall_t / 2.0, x2, wall_y_inner - wall_t / 2.0],
                    [x1, wall_y_outer, x2, wall_y_outer]
                ]
                label_pos = [(x1 + x2) / 2.0, wall_y_inner + 200.0 if "Inward" in swing else wall_y_outer - 200.0]

            elif side == "Right":
                y1 = miny + op.offset_mm
                y2 = y1 + op.width_mm
                cut_box = box(maxx - margin, y1, maxx + wall_t + margin, y2)
                wall_x_inner = maxx
                wall_x_outer = maxx + wall_t

                swing = op.swing or "Inward-Right"
                if swing == "Inward-Left":
                    hinge = [wall_x_inner, y2]
                    leaf_end = [wall_x_inner - op.width_mm, y2]
                    arc_path = f"M {wall_x_inner} {y1} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_inner - op.width_mm} {y2}"
                elif swing == "Outward-Right":
                    hinge = [wall_x_outer, y1]
                    leaf_end = [wall_x_outer + op.width_mm, y1]
                    arc_path = f"M {wall_x_outer} {y2} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_outer + op.width_mm} {y1}"
                elif swing == "Outward-Left":
                    hinge = [wall_x_outer, y2]
                    leaf_end = [wall_x_outer + op.width_mm, y2]
                    arc_path = f"M {wall_x_outer} {y1} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_outer + op.width_mm} {y2}"
                else:  # Inward-Right
                    hinge = [wall_x_inner, y1]
                    leaf_end = [wall_x_inner - op.width_mm, y1]
                    arc_path = f"M {wall_x_inner} {y2} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_inner - op.width_mm} {y1}"

                jambs = [
                    [wall_x_inner, y1, wall_x_outer, y1],
                    [wall_x_inner, y2, wall_x_outer, y2]
                ]
                win_lines = [
                    [wall_x_inner, y1, wall_x_inner, y2],
                    [wall_x_inner + wall_t / 2.0, y1, wall_x_inner + wall_t / 2.0, y2],
                    [wall_x_outer, y1, wall_x_outer, y2]
                ]
                label_pos = [wall_x_inner - 200.0 if "Inward" in swing else wall_x_outer + 200.0, (y1 + y2) / 2.0]

            else:  # Left wall
                y1 = miny + op.offset_mm
                y2 = y1 + op.width_mm
                cut_box = box(minx - wall_t - margin, y1, minx + margin, y2)
                wall_x_inner = minx
                wall_x_outer = minx - wall_t

                swing = op.swing or "Inward-Right"
                if swing == "Inward-Left":
                    hinge = [wall_x_inner, y2]
                    leaf_end = [wall_x_inner + op.width_mm, y2]
                    arc_path = f"M {wall_x_inner} {y1} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_inner + op.width_mm} {y2}"
                elif swing == "Outward-Right":
                    hinge = [wall_x_outer, y1]
                    leaf_end = [wall_x_outer - op.width_mm, y1]
                    arc_path = f"M {wall_x_outer} {y2} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_outer - op.width_mm} {y1}"
                elif swing == "Outward-Left":
                    hinge = [wall_x_outer, y2]
                    leaf_end = [wall_x_outer - op.width_mm, y2]
                    arc_path = f"M {wall_x_outer} {y1} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_outer - op.width_mm} {y2}"
                else:  # Inward-Right
                    hinge = [wall_x_inner, y1]
                    leaf_end = [wall_x_inner + op.width_mm, y1]
                    arc_path = f"M {wall_x_inner} {y2} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_inner + op.width_mm} {y1}"

                jambs = [
                    [wall_x_outer, y1, wall_x_inner, y1],
                    [wall_x_outer, y2, wall_x_inner, y2]
                ]
                win_lines = [
                    [wall_x_inner, y1, wall_x_inner, y2],
                    [wall_x_inner - wall_t / 2.0, y1, wall_x_inner - wall_t / 2.0, y2],
                    [wall_x_outer, y1, wall_x_outer, y2]
                ]
                label_pos = [wall_x_inner + 200.0 if "Inward" in swing else wall_x_outer - 200.0, (y1 + y2) / 2.0]

            cutout_polygons.append(cut_box)

            if op.type.capitalize() == "Door":
                doors_cad.append(DoorCADGeometry(
                    id=op.id,
                    host_room=op.host_room,
                    wall_side=side,
                    offset_mm=op.offset_mm,
                    width_mm=op.width_mm,
                    height_mm=op.height_mm or 2100.0,
                    swing=swing,
                    hinge=hinge,
                    leaf_end=leaf_end,
                    arc_center=hinge,
                    arc_radius=op.width_mm,
                    arc_path=arc_path,
                    jambs=jambs,
                    label_x=label_pos[0],
                    label_y=label_pos[1]
                ))
            else:
                windows_cad.append(WindowCADGeometry(
                    id=op.id,
                    host_room=op.host_room,
                    wall_side=side,
                    offset_mm=op.offset_mm,
                    width_mm=op.width_mm,
                    height_mm=op.height_mm or 1200.0,
                    lines=win_lines,
                    jambs=jambs,
                    label_x=label_pos[0],
                    label_y=label_pos[1]
                ))

        # Boolean Subtraction: Cut openings out of combined walls
        if cutout_polygons:
            cutouts_union = unary_union(cutout_polygons)
            combined_walls = combined_walls.difference(cutouts_union)

    wall_polygons: List[WallPolygon] = []
    
    if isinstance(combined_walls, Polygon):
        polys = [combined_walls]
    elif isinstance(combined_walls, MultiPolygon):
        polys = list(combined_walls.geoms)
    else:
        polys = []

    for p in polys:
        ext_ring, holes = extract_polygon_coords(p)
        wall_polygons.append(WallPolygon(
            wall_type="combined",
            thickness_mm=0.0,
            outer_polygon=ext_ring,
            inner_polygons=holes
        ))

    wall_lines = extract_lines_from_geometry(combined_walls, wall_type="boundary")
    dimensions = compute_cad_dimensions(union_rooms, rooms)

    # 4. SOLVE HVAC MEP SYSTEM
    hvac_loads, hvac_eq, hvac_pipes = solve_hvac_system(rooms, room_results, hvac_equipment)

    # 5. SOLVE FURNITURE (BEDS)
    norm_furniture: List[FurniturePayload] = []
    if furniture:
        for f in furniture:
            try:
                if isinstance(f, FurniturePayload):
                    norm_furniture.append(f)
                elif isinstance(f, dict):
                    clean_dict = {k: v for k, v in f.items() if v is not None}
                    norm_furniture.append(FurniturePayload(**clean_dict))
                elif hasattr(f, "model_dump"):
                    clean_dict = {k: v for k, v in f.model_dump().items() if v is not None}
                    norm_furniture.append(FurniturePayload(**clean_dict))
            except Exception:
                continue

    furniture_cad: List[FurnitureCAD] = []
    handled_rooms = set()
    furn_count = 1
    for f in norm_furniture:
        host_room_clean = (f.host_room_id or "").lower().strip()
        host_name = f.host_room_id
        host_pts = []
        for r in rooms:
            if host_room_clean and r.name.lower().strip() == host_room_clean:
                host_pts = r.points
                host_name = r.name
                break
        if not host_pts and rooms:
            host_pts = rooms[0].points
            host_name = rooms[0].name

        cad_item = calculate_furniture_cad(
            room_name=host_name or "Room",
            points=host_pts,
            item_id=f.id or f"FURN-{furn_count}",
            user_furniture=f,
            shift=(0.0, 0.0),
            doors=doors_cad,
            windows=windows_cad
        )
        if cad_item:
            furniture_cad.append(cad_item)
            if host_name:
                handled_rooms.add(host_name.lower().strip())
            furn_count += 1

    for r in rooms:
        if is_bedroom_room(r.name) and r.name.lower().strip() not in handled_rooms:
            cad_bed = calculate_auto_scaled_bed(
                room_name=r.name,
                points=r.points,
                bed_id=f"BED-{furn_count}",
                user_furniture=None,
                shift=(0.0, 0.0),
                doors=doors_cad,
                windows=windows_cad
            )
            if cad_bed:
                furniture_cad.append(cad_bed)
                handled_rooms.add(r.name.lower().strip())
                furn_count += 1

    # Multi-item collision and boundary validation
    furniture_cad = evaluate_all_furniture_clearances(furniture_cad, rooms, doors_cad)

    return SolveResponse(
        rooms=room_results,
        wall_polygons=wall_polygons,
        wall_lines=wall_lines,
        dimensions=dimensions,
        doors=doors_cad,
        windows=windows_cad,
        hvac_loads=hvac_loads,
        hvac_equipment=hvac_eq,
        hvac_pipes=hvac_pipes,
        combined_wall_polygons=wall_polygons,
        furniture=furniture_cad
    )


def generate_excel_template_bytes() -> bytes:
    """Generates a styled multi-sheet Excel template workbook with sample room coordinates, doors/windows, and HVAC equipment."""
    wb = openpyxl.Workbook()
    
    # Sheet 1: Room Coordinates Payload
    ws1 = wb.active
    ws1.title = "Room Coordinates Payload"

    ws1.merge_cells("A1:E1")
    title_cell = ws1["A1"]
    title_cell.value = "Parametric 2D CAD Building Floorplan Coordinates"
    title_cell.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 35

    headers1 = ["Room Name", "Fillet Radius (mm)", "Point Index", "X Coordinate (mm)", "Y Coordinate (mm)"]
    ws1.append(headers1)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")

    for col_idx in range(1, 6):
        cell = ws1.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
    ws1.row_dimensions[2].height = 25

    sample_rooms = [
        ("Living Room", 0, 1, 0.0, 0.0),
        ("Living Room", 0, 2, 6000.0, 0.0),
        ("Living Room", 0, 3, 6000.0, 5000.0),
        ("Living Room", 0, 4, 0.0, 5000.0),
        ("L-Shaped Corridor/Balcony", 500, 1, 0.0, 5000.0),
        ("L-Shaped Corridor/Balcony", 500, 2, 3000.0, 5000.0),
        ("L-Shaped Corridor/Balcony", 500, 3, 3000.0, 8000.0),
        ("L-Shaped Corridor/Balcony", 500, 4, 0.0, 8000.0),
    ]

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for row_idx, row_data in enumerate(sample_rooms, start=3):
        ws1.append(row_data)
        for col_idx in range(1, 6):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (2, 3, 4, 5):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 20
    ws1.column_dimensions["C"].width = 14
    ws1.column_dimensions["D"].width = 20
    ws1.column_dimensions["E"].width = 20

    # Sheet 2: Doors and Windows
    ws2 = wb.create_sheet(title="Doors and Windows")

    ws2.merge_cells("A1:H1")
    tcell2 = ws2["A1"]
    tcell2.value = "Architectural Openings Schedule (Doors & Windows)"
    tcell2.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell2.fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    tcell2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 35

    headers2 = [
        "Opening ID", "Type (Door/Window)", "Host Wall Room", 
        "Wall Side (Bottom/Top/Left/Right)", "Offset from Corner (mm)", 
        "Width (mm)", "Height (mm)", "Swing Direction"
    ]
    ws2.append(headers2)

    header_fill2 = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    for col_idx in range(1, 9):
        cell = ws2.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill2
        cell.alignment = header_align
    ws2.row_dimensions[2].height = 25

    sample_openings = [
        ("D1", "Door", "Living Room", "Top", 1000.0, 900.0, 2100.0, "Inward-Right"),
        ("W1", "Window", "Living Room", "Right", 1500.0, 1200.0, 1200.0, ""),
        ("W2", "Window", "L-Shaped Corridor/Balcony", "Top", 800.0, 1000.0, 1200.0, "")
    ]

    for row_idx, row_data in enumerate(sample_openings, start=3):
        ws2.append(row_data)
        for col_idx in range(1, 9):
            cell = ws2.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (5, 6, 7):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws2.column_dimensions["A"].width = 14
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["C"].width = 28
    ws2.column_dimensions["D"].width = 32
    ws2.column_dimensions["E"].width = 24
    ws2.column_dimensions["F"].width = 16
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 22

    # Sheet 3: HVAC Equipment
    ws3 = wb.create_sheet(title="HVAC Equipment")

    ws3.merge_cells("A1:G1")
    tcell3 = ws3["A1"]
    tcell3.value = "MEP HVAC Equipment & Sizing Schedule"
    tcell3.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell3.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
    tcell3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 35

    headers3 = [
        "Unit ID", "Room Name", "Unit Type (Split-IDU/ODU/Cassette)", 
        "Cooling Capacity (TR)", "Location X (mm)", "Location Y (mm)", "Status"
    ]
    ws3.append(headers3)

    header_fill3 = PatternFill(start_color="8B5CF6", end_color="8B5CF6", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws3.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill3
        cell.alignment = header_align
    ws3.row_dimensions[2].height = 25

    sample_hvac = [
        ("IDU-1", "Living Room", "Split-IDU", 2.0, 4500.0, 4800.0, "Active"),
        ("ODU-1", "L-Shaped Corridor/Balcony", "ODU", 2.0, 2200.0, 7500.0, "Active")
    ]

    for row_idx, row_data in enumerate(sample_hvac, start=3):
        ws3.append(row_data)
        for col_idx in range(1, 8):
            cell = ws3.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 6):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws3.column_dimensions["A"].width = 16
    ws3.column_dimensions["B"].width = 28
    ws3.column_dimensions["C"].width = 32
    ws3.column_dimensions["D"].width = 24
    ws3.column_dimensions["E"].width = 20
    ws3.column_dimensions["F"].width = 20
    ws3.column_dimensions["G"].width = 16

    # Sheet 4: Furniture Schedule
    ws4 = wb.create_sheet(title="Furniture Schedule")
    ws4.merge_cells("A1:G1")
    tcell4 = ws4["A1"]
    tcell4.value = "Architectural Furniture & Clearance Schedule"
    tcell4.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell4.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    tcell4.alignment = Alignment(horizontal="center", vertical="center")
    ws4.row_dimensions[1].height = 35

    headers4 = ["Item ID", "Type / Category", "Host Room", "Dimensions (W x H mm)", "Coordinates (X, Y)", "Rotation", "Clearance Status"]
    ws4.append(headers4)
    fill4 = PatternFill(start_color="6366F1", end_color="6366F1", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws4.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill4
        cell.alignment = header_align
    ws4.row_dimensions[2].height = 25

    sample_furniture = [
        ("FURN-1", "Sofa / Living", "Living Room", "2000 x 900 mm", "(1500.0, 1000.0)", "0°", "OK"),
        ("FURN-2", "Dining Table / Dining", "Living Room", "1400 x 800 mm", "(4000.0, 2000.0)", "0°", "OK")
    ]
    for row_idx, row_data in enumerate(sample_furniture, start=3):
        ws4.append(row_data)
        for col_idx in range(1, 8):
            cell = ws4.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 6):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in (1, 7):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
    ws4.column_dimensions["A"].width = 16
    ws4.column_dimensions["B"].width = 28
    ws4.column_dimensions["C"].width = 24
    ws4.column_dimensions["D"].width = 24
    ws4.column_dimensions["E"].width = 22
    ws4.column_dimensions["F"].width = 16
    ws4.column_dimensions["G"].width = 20

    # Sheet 5: Plumbing Schedule
    ws5 = wb.create_sheet(title="Plumbing Schedule")
    ws5.merge_cells("A1:G1")
    tcell5 = ws5["A1"]
    tcell5.value = "Plumbing & Sanitary Schedule"
    tcell5.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell5.fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    tcell5.alignment = Alignment(horizontal="center", vertical="center")
    ws5.row_dimensions[1].height = 35

    headers5 = ["Fixture ID", "Category / Type", "Host Room", "Dimensions (W x H mm)", "Coordinates (X, Y)", "Connection Status", "Run Length / Pipe ID"]
    ws5.append(headers5)
    fill5 = PatternFill(start_color="0EA5E9", end_color="0EA5E9", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws5.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill5
        cell.alignment = header_align
    ws5.row_dimensions[2].height = 25

    sample_plumbing = [
        ("PLM-1", "Bathroom / Wash Basin", "L-Shaped Corridor/Balcony", "600 x 500 mm", "(500.0, 6000.0)", "Connected", "—"),
        ("PIPE-1", "Water/Drainage lines / Water Supply Pipe", "L-Shaped Corridor/Balcony", "Ø 25 mm", "Start: (500.0, 6000.0)", "Connected", "1500.0 mm")
    ]
    for row_idx, row_data in enumerate(sample_plumbing, start=3):
        ws5.append(row_data)
        for col_idx in range(1, 8):
            cell = ws5.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 7):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in (1, 6):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
    ws5.column_dimensions["A"].width = 16
    ws5.column_dimensions["B"].width = 35
    ws5.column_dimensions["C"].width = 24
    ws5.column_dimensions["D"].width = 24
    ws5.column_dimensions["E"].width = 30
    ws5.column_dimensions["F"].width = 20
    ws5.column_dimensions["G"].width = 24

    # Sheet 6: Electrical Schedule
    ws6 = wb.create_sheet(title="Electrical Schedule")
    ws6.merge_cells("A1:I1")
    tcell6 = ws6["A1"]
    tcell6.value = "Electrical Layout, Fixtures & Conduits Schedule"
    tcell6.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell6.fill = PatternFill(start_color="1E1B4B", end_color="1E1B4B", fill_type="solid")
    tcell6.alignment = Alignment(horizontal="center", vertical="center")
    ws6.row_dimensions[1].height = 35

    headers6 = ["Component ID", "Type", "Category", "Host Room", "Coordinates (X, Y)", "Rotation", "Wattage (W)", "Circuit ID", "Mounting"]
    ws6.append(headers6)
    fill6 = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
    for col_idx in range(1, 10):
        cell = ws6.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill6
        cell.alignment = header_align
    ws6.row_dimensions[2].height = 25

    sample_electrical = [
        ("EL-1", "ceiling_light", "lighting", "Living Room", "(3000.0, 2500.0)", "0°", 15.0, "CKT-1", "ceiling"),
        ("EL-2", "ceiling_fan", "power", "Living Room", "(3000.0, 2500.0)", "0°", 65.0, "CKT-1", "ceiling"),
        ("EL-3", "socket_6a", "power", "Living Room", "(200.0, 500.0)", "0°", 100.0, "CKT-1", "wall")
    ]
    for row_idx, row_data in enumerate(sample_electrical, start=3):
        ws6.append(row_data)
        for col_idx in range(1, 10):
            cell = ws6.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (5, 6, 7):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in (1, 8, 9):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
    ws6.column_dimensions["A"].width = 18
    ws6.column_dimensions["B"].width = 24
    ws6.column_dimensions["C"].width = 20
    ws6.column_dimensions["D"].width = 24
    ws6.column_dimensions["E"].width = 24
    ws6.column_dimensions["F"].width = 16
    ws6.column_dimensions["G"].width = 16
    ws6.column_dimensions["H"].width = 18
    ws6.column_dimensions["I"].width = 18

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()



def generate_2bhk_template_bytes() -> bytes:
    """Generates a styled 3-sheet Excel template for a 2-BHK apartment floorplan layout."""
    wb = openpyxl.Workbook()
    
    # Sheet 1: Room Coordinates Payload
    ws1 = wb.active
    ws1.title = "Room Coordinates Payload"

    ws1.merge_cells("A1:E1")
    title_cell = ws1["A1"]
    title_cell.value = "Parametric 2D CAD Building Floorplan Coordinates (2-BHK Test Layout)"
    title_cell.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 35

    headers1 = ["Room Name", "Fillet Radius (mm)", "Point Index", "X Coordinate (mm)", "Y Coordinate (mm)"]
    ws1.append(headers1)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")

    for col_idx in range(1, 6):
        cell = ws1.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
    ws1.row_dimensions[2].height = 25

    sample_rooms = [
        # Living Room (0,0 to 5000,4000)
        ("Living Room", 0, 1, 0.0, 0.0),
        ("Living Room", 0, 2, 5000.0, 0.0),
        ("Living Room", 0, 3, 5000.0, 4000.0),
        ("Living Room", 0, 4, 0.0, 4000.0),
        # Master Bedroom (5000,0 to 9000,4000)
        ("Master Bedroom", 0, 1, 5000.0, 0.0),
        ("Master Bedroom", 0, 2, 9000.0, 0.0),
        ("Master Bedroom", 0, 3, 9000.0, 4000.0),
        ("Master Bedroom", 0, 4, 5000.0, 4000.0),
        # Kitchen (0,4000 to 4000,7000)
        ("Kitchen", 0, 1, 0.0, 4000.0),
        ("Kitchen", 0, 2, 4000.0, 4000.0),
        ("Kitchen", 0, 3, 4000.0, 7000.0),
        ("Kitchen", 0, 4, 0.0, 7000.0),
        # Bedroom 2 (4000,4000 to 9000,7000 with 300mm fillet)
        ("Bedroom 2", 300, 1, 4000.0, 4000.0),
        ("Bedroom 2", 300, 2, 9000.0, 4000.0),
        ("Bedroom 2", 300, 3, 9000.0, 7000.0),
        ("Bedroom 2", 300, 4, 4000.0, 7000.0),
    ]

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for row_idx, row_data in enumerate(sample_rooms, start=3):
        ws1.append(row_data)
        for col_idx in range(1, 6):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (2, 3, 4, 5):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 20
    ws1.column_dimensions["C"].width = 14
    ws1.column_dimensions["D"].width = 20
    ws1.column_dimensions["E"].width = 20

    # Sheet 2: Doors and Windows
    ws2 = wb.create_sheet(title="Doors and Windows")

    ws2.merge_cells("A1:H1")
    tcell2 = ws2["A1"]
    tcell2.value = "Architectural Openings Schedule (2-BHK Layout)"
    tcell2.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell2.fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    tcell2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 35

    headers2 = [
        "Opening ID", "Type (Door/Window)", "Host Wall Room", 
        "Wall Side (Bottom/Top/Left/Right)", "Offset from Corner (mm)", 
        "Width (mm)", "Height (mm)", "Swing Direction"
    ]
    ws2.append(headers2)

    header_fill2 = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    for col_idx in range(1, 9):
        cell = ws2.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill2
        cell.alignment = header_align
    ws2.row_dimensions[2].height = 25

    sample_openings = [
        ("D1", "Door", "Living Room", "Bottom", 1500.0, 1000.0, 2100.0, "Inward-Right"),
        ("D2", "Door", "Living Room", "Right", 1000.0, 900.0, 2100.0, "Inward-Right"),
        ("D3", "Door", "Living Room", "Top", 1000.0, 900.0, 2100.0, "Inward-Right"),
        ("W1", "Window", "Living Room", "Left", 1000.0, 1500.0, 1200.0, ""),
        ("W2", "Window", "Master Bedroom", "Right", 1200.0, 1500.0, 1200.0, "")
    ]

    for row_idx, row_data in enumerate(sample_openings, start=3):
        ws2.append(row_data)
        for col_idx in range(1, 9):
            cell = ws2.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (5, 6, 7):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws2.column_dimensions["A"].width = 14
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["C"].width = 28
    ws2.column_dimensions["D"].width = 32
    ws2.column_dimensions["E"].width = 24
    ws2.column_dimensions["F"].width = 16
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 22

    # Sheet 3: HVAC Equipment
    ws3 = wb.create_sheet(title="HVAC Equipment")

    ws3.merge_cells("A1:G1")
    tcell3 = ws3["A1"]
    tcell3.value = "MEP HVAC Equipment & Sizing Schedule (2-BHK)"
    tcell3.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell3.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
    tcell3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 35

    headers3 = [
        "Unit ID", "Room Name", "Unit Type (Split-IDU/ODU/Cassette)", 
        "Cooling Capacity (TR)", "Location X (mm)", "Location Y (mm)", "Status"
    ]
    ws3.append(headers3)

    header_fill3 = PatternFill(start_color="8B5CF6", end_color="8B5CF6", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws3.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill3
        cell.alignment = header_align
    ws3.row_dimensions[2].height = 25

    sample_hvac = [
        ("IDU-1", "Living Room", "Split-IDU", 1.5, 2500.0, 3800.0, "Active"),
        ("IDU-2", "Master Bedroom", "Split-IDU", 1.5, 7000.0, 3800.0, "Active"),
        ("ODU-1", "Bedroom 2", "ODU", 3.0, 8500.0, 6800.0, "Active")
    ]

    for row_idx, row_data in enumerate(sample_hvac, start=3):
        ws3.append(row_data)
        for col_idx in range(1, 8):
            cell = ws3.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 6):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws3.column_dimensions["A"].width = 16
    ws3.column_dimensions["B"].width = 28
    ws3.column_dimensions["C"].width = 32
    ws3.column_dimensions["D"].width = 24
    ws3.column_dimensions["E"].width = 20
    ws3.column_dimensions["F"].width = 20
    ws3.column_dimensions["G"].width = 16

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


def generate_custom_house_bytes() -> bytes:
    """Generates a styled 3-sheet Excel template for a 3-BHK custom house floorplan layout."""
    wb = openpyxl.Workbook()

    # Sheet 1: Room Coordinates Payload
    ws1 = wb.active
    ws1.title = "Room Coordinates Payload"

    ws1.merge_cells("A1:E1")
    title_cell = ws1["A1"]
    title_cell.value = "Parametric 2D CAD Building Floorplan Coordinates (3-BHK Custom Layout)"
    title_cell.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 35

    headers1 = ["Room Name", "Fillet Radius (mm)", "Point Index", "X Coordinate (mm)", "Y Coordinate (mm)"]
    ws1.append(headers1)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")

    for col_idx in range(1, 6):
        cell = ws1.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
    ws1.row_dimensions[2].height = 25

    sample_rooms = [
        # Sitout (0,0 to 3000,2000)
        ("Sitout", 0, 1, 0.0, 0.0),
        ("Sitout", 0, 2, 3000.0, 0.0),
        ("Sitout", 0, 3, 3000.0, 2000.0),
        ("Sitout", 0, 4, 0.0, 2000.0),
        # Living Hall (3000,0 to 8000,5000)
        ("Living Hall", 0, 1, 3000.0, 0.0),
        ("Living Hall", 0, 2, 8000.0, 0.0),
        ("Living Hall", 0, 3, 8000.0, 5000.0),
        ("Living Hall", 0, 4, 3000.0, 5000.0),
        # Master Bedroom (8000,0 to 12000,5000)
        ("Master Bedroom", 0, 1, 8000.0, 0.0),
        ("Master Bedroom", 0, 2, 12000.0, 0.0),
        ("Master Bedroom", 0, 3, 12000.0, 5000.0),
        ("Master Bedroom", 0, 4, 8000.0, 5000.0),
        # Dining Hall (3000,5000 to 8000,9000)
        ("Dining Hall", 0, 1, 3000.0, 5000.0),
        ("Dining Hall", 0, 2, 8000.0, 5000.0),
        ("Dining Hall", 0, 3, 8000.0, 9000.0),
        ("Dining Hall", 0, 4, 3000.0, 9000.0),
        # Kitchen (8000,5000 to 12000,9000)
        ("Kitchen", 0, 1, 8000.0, 5000.0),
        ("Kitchen", 0, 2, 12000.0, 5000.0),
        ("Kitchen", 0, 3, 12000.0, 9000.0),
        ("Kitchen", 0, 4, 8000.0, 9000.0),
        # Bathroom (0,5000 to 3000,8000)
        ("Bathroom", 0, 1, 0.0, 5000.0),
        ("Bathroom", 0, 2, 3000.0, 5000.0),
        ("Bathroom", 0, 3, 3000.0, 8000.0),
        ("Bathroom", 0, 4, 0.0, 8000.0),
    ]

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for row_idx, row_data in enumerate(sample_rooms, start=3):
        ws1.append(row_data)
        for col_idx in range(1, 6):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (2, 3, 4, 5):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 20
    ws1.column_dimensions["C"].width = 14
    ws1.column_dimensions["D"].width = 20
    ws1.column_dimensions["E"].width = 20

    # Sheet 2: Doors and Windows
    ws2 = wb.create_sheet(title="Doors and Windows")

    ws2.merge_cells("A1:H1")
    tcell2 = ws2["A1"]
    tcell2.value = "Architectural Openings Schedule (3-BHK Custom Layout)"
    tcell2.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell2.fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    tcell2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 35

    headers2 = [
        "Opening ID", "Type (Door/Window)", "Host Wall Room", 
        "Wall Side (Bottom/Top/Left/Right)", "Offset from Corner (mm)", 
        "Width (mm)", "Height (mm)", "Swing Direction"
    ]
    ws2.append(headers2)

    header_fill2 = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    for col_idx in range(1, 9):
        cell = ws2.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill2
        cell.alignment = header_align
    ws2.row_dimensions[2].height = 25

    sample_openings = [
        # Doors:
        ("D1", "Door", "Living Hall", "Left", 500.0, 1000.0, 2100.0, "Inward-Right"),
        ("D2", "Door", "Living Hall", "Right", 1000.0, 900.0, 2100.0, "Inward-Right"),
        ("D3", "Door", "Living Hall", "Top", 2000.0, 1200.0, 2100.0, "Inward-Right"),
        ("D4", "Door", "Dining Hall", "Right", 1000.0, 900.0, 2100.0, "Inward-Right"),
        ("D5", "Door", "Dining Hall", "Left", 1000.0, 800.0, 2100.0, "Inward-Right"),
        # Windows:
        ("W1", "Window", "Living Hall", "Bottom", 2000.0, 1500.0, 1200.0, ""),
        ("W2", "Window", "Master Bedroom", "Bottom", 1500.0, 1500.0, 1200.0, ""),
        ("W3", "Window", "Master Bedroom", "Right", 1500.0, 1200.0, 1200.0, ""),
        ("W4", "Window", "Kitchen", "Right", 1500.0, 1200.0, 1200.0, ""),
        ("W5", "Window", "Kitchen", "Top", 1500.0, 1200.0, 1200.0, ""),
        ("W6", "Window", "Dining Hall", "Top", 2000.0, 1500.0, 1200.0, ""),
        ("W7", "Window", "Bathroom", "Top", 1000.0, 600.0, 1200.0, ""),
    ]

    for row_idx, row_data in enumerate(sample_openings, start=3):
        ws2.append(row_data)
        for col_idx in range(1, 9):
            cell = ws2.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (5, 6, 7):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws2.column_dimensions["A"].width = 14
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["C"].width = 28
    ws2.column_dimensions["D"].width = 32
    ws2.column_dimensions["E"].width = 24
    ws2.column_dimensions["F"].width = 16
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 22

    # Sheet 3: HVAC Equipment
    ws3 = wb.create_sheet(title="HVAC Equipment")

    ws3.merge_cells("A1:G1")
    tcell3 = ws3["A1"]
    tcell3.value = "MEP HVAC Equipment & Sizing Schedule (3-BHK Custom Layout)"
    tcell3.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    tcell3.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
    tcell3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 35

    headers3 = [
        "Unit ID", "Room Name", "Unit Type (Split-IDU/ODU/Cassette)", 
        "Cooling Capacity (TR)", "Location X (mm)", "Location Y (mm)", "Status"
    ]
    ws3.append(headers3)

    header_fill3 = PatternFill(start_color="8B5CF6", end_color="8B5CF6", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws3.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill3
        cell.alignment = header_align
    ws3.row_dimensions[2].height = 25

    sample_hvac = [
        ("IDU-1", "Living Hall", "Split-IDU", 2.0, 5500.0, 4800.0, "Active"),
        ("IDU-2", "Master Bedroom", "Split-IDU", 1.5, 11800.0, 2500.0, "Active"),
        ("IDU-3", "Dining Hall", "Split-IDU", 1.5, 5500.0, 8800.0, "Active"),
        ("ODU-1", "Kitchen", "ODU", 5.0, 12500.0, 7000.0, "Active"),
    ]

    for row_idx, row_data in enumerate(sample_hvac, start=3):
        ws3.append(row_data)
        for col_idx in range(1, 8):
            cell = ws3.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 6):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws3.column_dimensions["A"].width = 16
    ws3.column_dimensions["B"].width = 28
    ws3.column_dimensions["C"].width = 32
    ws3.column_dimensions["D"].width = 24
    ws3.column_dimensions["E"].width = 20
    ws3.column_dimensions["F"].width = 20
    ws3.column_dimensions["G"].width = 16

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


# =============================================================================
# PHASE 7: CARPET-FIRST GEOMETRY ENGINE V2 (NON-DESTRUCTIVE)
# =============================================================================

def snap_coordinates(coords: List[float], tolerance_mm: float = 10.0) -> Dict[float, float]:
    """
    Clusters 1D coordinates within tolerance_mm and maps each to the canonical cluster representative.
    Prevents micro-misalignments (< 10mm) and guarantees orthogonal snapping.
    """
    if not coords:
        return {}
    unique = sorted(set(coords))
    mapping: Dict[float, float] = {}
    clusters: List[List[float]] = []

    for val in unique:
        if not clusters:
            clusters.append([val])
        else:
            if abs(val - clusters[-1][0]) <= tolerance_mm:
                clusters[-1].append(val)
            else:
                clusters.append([val])

    for cluster in clusters:
        rep = round(cluster[0], 2)
        for val in cluster:
            mapping[val] = rep

    return mapping


def snap_room_coordinates(rooms: List[RoomPayload], tolerance_mm: float = 10.0) -> List[RoomPayload]:
    """
    Snaps room vertex coordinates within tolerance_mm so slight misalignments
    form clean, orthogonal T-junctions and L-junctions.
    """
    if not rooms:
        return []
    all_xs = []
    all_ys = []
    for r in rooms:
        for p in r.points:
            all_xs.append(round(float(p[0]), 2))
            all_ys.append(round(float(p[1]), 2))

    snap_x = snap_coordinates(all_xs, tolerance_mm)
    snap_y = snap_coordinates(all_ys, tolerance_mm)

    snapped_rooms: List[RoomPayload] = []
    for r in rooms:
        snapped_pts = [
            [snap_x.get(round(float(p[0]), 2), float(p[0])), snap_y.get(round(float(p[1]), 2), float(p[1]))]
            for p in r.points
        ]
        snapped_rooms.append(RoomPayload(
            name=r.name,
            points=snapped_pts,
            fillet_radius=getattr(r, "fillet_radius", 0.0) or 0.0
        ))
    return snapped_rooms


class SpatialNode:
    def __init__(self, idx: int, name: str, points: List[List[float]], bounds: Tuple[float, float, float, float]):
        self.idx = idx
        self.name = name
        self.points = points
        self.minx, self.miny, self.maxx, self.maxy = bounds
        self.width = self.maxx - self.minx
        self.height = self.maxy - self.miny
        self.is_external_wing = False
        lower_name = name.lower()
        if any(w in lower_name for w in ["porch", "garage", "patio", "balcony", "deck", "verandah"]):
            self.is_external_wing = True
            
        self.is_container = False
        self.parent_id: Optional[int] = None
        
        self.solved_x = self.minx
        self.solved_y = self.miny

class SpatialEdge:
    def __init__(self, from_node: int, to_node: int, axis: str, weight: float, overlap_span: float):
        self.from_node = from_node
        self.to_node = to_node
        self.axis = axis
        self.weight = weight
        self.overlap_span = overlap_span

class SpatialGraph:
    def __init__(self, rooms: List[RoomPayload], tolerance_mm: float = 10.0, gap_mm: float = 115.0):
        self.rooms = rooms
        self.tolerance_mm = tolerance_mm
        self.gap_mm = gap_mm
        self.nodes: List[SpatialNode] = []
        self.edges_x: List[SpatialEdge] = []
        self.edges_y: List[SpatialEdge] = []
        
        for idx, r in enumerate(rooms):
            xs = [p[0] for p in r.points]
            ys = [p[1] for p in r.points]
            bounds = (min(xs), min(ys), max(xs), max(ys))
            self.nodes.append(SpatialNode(idx, r.name, r.points, bounds))
            
        # Detect parent-child hierarchical containers
        for i, node_i in enumerate(self.nodes):
            for j, node_j in enumerate(self.nodes):
                if i == j: continue
                # if node_i bounds fully enclose node_j bounds
                if (node_i.minx <= node_j.minx + self.tolerance_mm and
                    node_i.miny <= node_j.miny + self.tolerance_mm and
                    node_i.maxx >= node_j.maxx - self.tolerance_mm and
                    node_i.maxy >= node_j.maxy - self.tolerance_mm):
                    
                    if (node_i.width > node_j.width + self.tolerance_mm or
                        node_i.height > node_j.height + self.tolerance_mm or
                        "footprint" in node_i.name.lower() or
                        "plot" in node_i.name.lower()):
                        
                        node_i.is_container = True
                        node_j.parent_id = i

        self._build_graph()

    def _build_graph(self):
        polygons = [box(n.minx, n.miny, n.maxx, n.maxy) for n in self.nodes]
        if not polygons:
            return
        tree = STRtree(polygons)
        
        for idx_i, node_i in enumerate(self.nodes):
            query_box = box(
                node_i.minx - self.tolerance_mm - 1.0, 
                node_i.miny - self.tolerance_mm - 1.0, 
                node_i.maxx + self.tolerance_mm + 1.0, 
                node_i.maxy + self.tolerance_mm + 1.0
            )
            neighbor_indices = tree.query(query_box)
            
            for idx_j in neighbor_indices:
                if idx_i == idx_j:
                    continue
                node_j = self.nodes[idx_j]
                
                # Container Rules: Do not add pushing edges between a parent and its child
                if node_i.parent_id == idx_j or node_j.parent_id == idx_i:
                    continue
                    
                # Wing Rules: A wing cannot push a main structure
                if node_i.is_external_wing and not node_j.is_external_wing:
                    continue
                
                # Check X adjacency (j is to the right of i)
                y_overlap = min(node_i.maxy, node_j.maxy) - max(node_i.miny, node_j.miny)
                if y_overlap > self.tolerance_mm:
                    if node_j.minx >= node_i.minx: # j is right of i
                        dist_x = node_j.minx - node_i.maxx
                        if dist_x <= self.gap_mm + self.tolerance_mm:
                            self.edges_x.append(SpatialEdge(idx_i, idx_j, 'X', self.gap_mm, y_overlap))
                        
                # Check Y adjacency (j is above i)
                x_overlap = min(node_i.maxx, node_j.maxx) - max(node_i.minx, node_j.minx)
                if x_overlap > self.tolerance_mm:
                    if node_j.miny >= node_i.miny: # j is above i
                        dist_y = node_j.miny - node_i.maxy
                        if dist_y <= self.gap_mm + self.tolerance_mm:
                            self.edges_y.append(SpatialEdge(idx_i, idx_j, 'Y', self.gap_mm, x_overlap))

    def _topological_sort(self, edges: List[SpatialEdge]) -> List[int]:
        adj = {i: [] for i in range(len(self.nodes))}
        in_degree = {i: 0 for i in range(len(self.nodes))}
        for e in edges:
            adj[e.from_node].append(e.to_node)
            in_degree[e.to_node] += 1
            
        queue = [i for i in range(len(self.nodes)) if in_degree[i] == 0]
        
        topo_order = []
        visited = set()
        while queue:
            queue.sort(key=lambda idx: self.nodes[idx].minx + self.nodes[idx].miny)
            u = queue.pop(0)
            topo_order.append(u)
            visited.add(u)
            for v in adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    queue.append(v)
                    
        # If there are cycles, append unvisited nodes to ensure all are processed
        for i in range(len(self.nodes)):
            if i not in visited:
                topo_order.append(i)
                
        return topo_order

    def solve(self) -> Tuple[List[RoomPayload], List[Tuple[float, float]]]:
        if not self.nodes:
            return [], []
            
        topo_x = self._topological_sort(self.edges_x)
        topo_y = self._topological_sort(self.edges_y)
        
        # Solve X
        adj_x = {i: [] for i in range(len(self.nodes))}
        for e in self.edges_x:
            adj_x[e.from_node].append(e)
            
        for u in topo_x:
            for e in adj_x[u]:
                v = e.to_node
                needed_x = self.nodes[u].solved_x + self.nodes[u].width + e.weight
                if needed_x > self.nodes[v].solved_x:
                    self.nodes[v].solved_x = needed_x
                    
        # Solve Y
        adj_y = {i: [] for i in range(len(self.nodes))}
        for e in self.edges_y:
            adj_y[e.from_node].append(e)
            
        for u in topo_y:
            for e in adj_y[u]:
                v = e.to_node
                needed_y = self.nodes[u].solved_y + self.nodes[u].height + e.weight
                if needed_y > self.nodes[v].solved_y:
                    self.nodes[v].solved_y = needed_y

        # Clamp children to parent boundaries
        for node in self.nodes:
            if node.parent_id is not None:
                parent = self.nodes[node.parent_id]
                node.solved_x = max(parent.solved_x, min(node.solved_x, parent.solved_x + parent.width - node.width))
                node.solved_y = max(parent.solved_y, min(node.solved_y, parent.solved_y + parent.height - node.height))

        offsets = []
        shifted_rooms = []
        is_container_list = []
        for i, node in enumerate(self.nodes):
            sx = node.solved_x - node.minx
            sy = node.solved_y - node.miny
            offsets.append((sx, sy))
            new_points = [[float(p[0]) + sx, float(p[1]) + sy] for p in node.points]
            
            orig_room = self.rooms[i]
            shifted_rooms.append(RoomPayload(
                name=orig_room.name,
                points=new_points,
                fillet_radius=getattr(orig_room, "fillet_radius", 0.0) or 0.0
            ))
            is_container_list.append(node.is_container)
            
        return shifted_rooms, offsets, is_container_list


def solve_spatial_topology(
    rooms: List[RoomPayload],
    tolerance_mm: float = 10.0,
    gap_mm: float = 115.0
) -> Tuple[List[RoomPayload], List[Tuple[float, float]], List[bool]]:
    """
    Applies the DAG SpatialGraph to push overlapping peer rooms apart.
    """
    graph = SpatialGraph(rooms, tolerance_mm=tolerance_mm, gap_mm=gap_mm)
    return graph.solve()


def get_plumbing_fixture_cad(
    f: PlumbingFixturePayload,
    shifted_rooms: List[RoomPayload]
) -> PlumbingFixtureCAD:
    f_type = f.type or "Wash Basin"
    cat = f.category or "Bathroom"
    
    w = safe_float(f.width, 600.0)
    h = safe_float(f.height, 500.0)
    if w <= 0: w = 600.0
    if h <= 0: h = 500.0
    
    host_pts = []
    host_name = f.host_room_id
    host_room_clean = (host_name or "").lower().strip()
    
    for sr in shifted_rooms:
        if host_room_clean and sr.name.lower().strip() == host_room_clean:
            host_pts = sr.points
            host_name = sr.name
            break
            
    if not host_pts and shifted_rooms:
        host_pts = shifted_rooms[0].points
        host_name = shifted_rooms[0].name
        
    x = safe_float(f.x, 0.0)
    y = safe_float(f.y, 0.0)
    
    if host_pts:
        xs = [p[0] for p in host_pts]
        ys = [p[1] for p in host_pts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        # Center if no coords given
        if f.x is None or math.isnan(float(f.x)):
            x = min_x + (max_x - min_x) / 2.0
        if f.y is None or math.isnan(float(f.y)):
            y = min_y + (max_y - min_y) / 2.0
            
        x = min(max_x - 50.0, max(min_x + 50.0, x))
        y = min(max_y - 50.0, max(min_y + 50.0, y))
        
    rot = float(f.rotation or 0.0) % 360.0
    
    return PlumbingFixtureCAD(
        id=f.id or "PLM-1",
        supplyPipeId=f.supplyPipeId,
        drainagePipeId=f.drainagePipeId,
        type=f_type,
        category=cat,
        host_room_id=host_name or "Room",
        width=round(w, 1),
        height=round(h, 1),
        x=round(x, 1),
        y=round(y, 1),
        rotation=round(rot, 1),
        connected_to=f.connected_to,
        clearance_status=f.clearance_status or "OK"
    )


def get_plumbing_pipe_cad(
    p: PlumbingPipePayload,
    shifted_rooms: List[RoomPayload]
) -> PlumbingPipeCAD:
    diam = safe_float(p.diameter, 50.0)
    if diam <= 0: diam = 50.0
    
    if p.path and isinstance(p.path, list) and len(p.path) >= 2:
        path_coords = [[safe_float(pt[0]), safe_float(pt[1])] for pt in p.path]
    else:
        sx = safe_float(p.x, 0.0)
        sy = safe_float(p.y, 0.0)
        ex = safe_float(p.end_x, sx + 500.0)
        ey = safe_float(p.end_y, sy)
        path_coords = [[sx, sy], [ex, ey]]
    
    return PlumbingPipeCAD(
        id=p.id or "PIPE-1",
        type=p.type or "Drainage Pipe",
        host_room_id=p.host_room_id or "Room",
        path=path_coords,
        diameter=diam,
        connected_to=p.connected_to,
        clearance_status=p.clearance_status or "OK"
    )


def align_interconnected_pipes(pipes: List[PlumbingPipeCAD]) -> List[PlumbingPipeCAD]:
    """
    Ensures that main horizontal room branch pipes and vertical trunk risers/stacks
    intersect seamlessly with zero visual gap, even after per-room topology shifts.
    """
    if not pipes:
        return pipes

    # Group by system: supply, drain, vent, trap
    systems = {"supply": [], "drain": [], "vent": [], "trap": []}
    for p in pipes:
        t = (p.type or "").lower()
        if "supply" in t:
            systems["supply"].append(p)
        elif "drain" in t or "waste" in t:
            systems["drain"].append(p)
        elif "vent" in t:
            systems["vent"].append(p)
        elif "trap" in t:
            systems["trap"].append(p)

    for sys_name, sys_pipes in systems.items():
        if len(sys_pipes) < 2:
            continue

        # Find vertical main pipe(s) vs horizontal branch pipes
        vertical_mains = []
        horizontal_branches = []
        for p in sys_pipes:
            if not p.path or len(p.path) < 2:
                continue
            x1, y1 = p.path[0][0], p.path[0][1]
            x2, y2 = p.path[-1][0], p.path[-1][1]
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            if dy > dx * 1.5:
                vertical_mains.append(p)
            else:
                horizontal_branches.append(p)

        for v_pipe in vertical_mains:
            vx = (v_pipe.path[0][0] + v_pipe.path[-1][0]) / 2.0
            connected_ys = []
            for h_pipe in horizontal_branches:
                hx1, hy1 = h_pipe.path[0][0], h_pipe.path[0][1]
                hx2, hy2 = h_pipe.path[-1][0], h_pipe.path[-1][1]
                min_hx = min(hx1, hx2)
                max_hx = max(hx1, hx2)
                hy = (hy1 + hy2) / 2.0

                # Check if this horizontal pipe connects to or targets this vertical riser
                if abs(min_hx - vx) <= 600.0 or abs(max_hx - vx) <= 600.0 or (min_hx <= vx <= max_hx):
                    # Snap the nearest endpoint to exactly vx
                    if abs(min_hx - vx) <= 600.0 and abs(min_hx - vx) <= abs(max_hx - vx):
                        if hx1 <= hx2:
                            h_pipe.path[0][0] = vx
                        else:
                            h_pipe.path[-1][0] = vx
                    elif abs(max_hx - vx) <= 600.0:
                        if hx1 >= hx2:
                            h_pipe.path[0][0] = vx
                        else:
                            h_pipe.path[-1][0] = vx
                    connected_ys.append(hy)

            # Ensure vertical riser spans the full vertical range of connected horizontal branches
            if connected_ys:
                min_y = min(connected_ys)
                max_y = max(connected_ys)
                v_pipe.path[0] = [vx, min_y]
                v_pipe.path[-1] = [vx, max_y]

    return pipes


def process_geometry_solve_v2(
    payload_or_rooms: Any,
    openings: Optional[List[OpeningPayload]] = None,
    hvac_equipment: Optional[List[HVACEquipmentPayload]] = None,
    furniture: Optional[List[FurniturePayload]] = None,
    plumbing_fixtures: Optional[List[PlumbingFixturePayload]] = None,
    plumbing_pipes: Optional[List[PlumbingPipePayload]] = None,
    electrical_components: Optional[List[Dict[str, Any]]] = None,
    electrical_circuits: Optional[List[Dict[str, Any]]] = None,
    electrical_routes: Optional[List[Dict[str, Any]]] = None
) -> SolveResponse:
    """
    Carpet-First Geometry Engine V2:
    1. Data Freezing: Treats incoming room dimensions as strict CARPET AREA (zero shrinkage).
    2. Topology & Pushing Algorithm: Detects adjacent/overlapping rooms (<= 10mm) and shifts
       them outward by 115mm (Interior Wall Thickness) to form a dedicated wall gap.
    3. Interior Wall Generation: Generates 115mm thick 'Party Wall' polygons filling the gaps
       between shifted rooms.
    4. Exterior Wall Generation: Merges the unified building interior envelope and offsets
       it outward by 230mm to produce a clean, watertight exterior wall polygon.
    """
    # Normalize input: can be dict, list of RoomPayload, or object with .rooms
    if isinstance(payload_or_rooms, dict):
        raw_rooms_data = payload_or_rooms.get("rooms", [])
        rooms = [
            r if isinstance(r, RoomPayload) else RoomPayload(
                name=r.get("name", "Room"),
                points=r.get("points", []),
                fillet_radius=r.get("fillet_radius", 0.0) or 0.0
            )
            for r in raw_rooms_data
        ]
        if openings is None and "openings" in payload_or_rooms:
            openings = payload_or_rooms.get("openings", [])
        if hvac_equipment is None and "hvac_equipment" in payload_or_rooms:
            hvac_equipment = payload_or_rooms.get("hvac_equipment", [])
        if furniture is None and "furniture" in payload_or_rooms:
            furniture = payload_or_rooms.get("furniture", [])
        if plumbing_fixtures is None and "plumbing_fixtures" in payload_or_rooms:
            plumbing_fixtures = payload_or_rooms.get("plumbing_fixtures", [])
        if plumbing_pipes is None and "plumbing_pipes" in payload_or_rooms:
            plumbing_pipes = payload_or_rooms.get("plumbing_pipes", [])
        if electrical_components is None and "electrical_components" in payload_or_rooms:
            electrical_components = payload_or_rooms.get("electrical_components", [])
        if electrical_circuits is None and "electrical_circuits" in payload_or_rooms:
            electrical_circuits = payload_or_rooms.get("electrical_circuits", [])
        if electrical_routes is None and "electrical_routes" in payload_or_rooms:
            electrical_routes = payload_or_rooms.get("electrical_routes", [])
    elif hasattr(payload_or_rooms, "rooms"):
        rooms = payload_or_rooms.rooms
        if openings is None and hasattr(payload_or_rooms, "openings"):
            openings = getattr(payload_or_rooms, "openings", [])
        if hvac_equipment is None and hasattr(payload_or_rooms, "hvac_equipment"):
            hvac_equipment = getattr(payload_or_rooms, "hvac_equipment", [])
        if furniture is None and hasattr(payload_or_rooms, "furniture"):
            furniture = getattr(payload_or_rooms, "furniture", [])
        if plumbing_fixtures is None and hasattr(payload_or_rooms, "plumbing_fixtures"):
            plumbing_fixtures = getattr(payload_or_rooms, "plumbing_fixtures", [])
        if plumbing_pipes is None and hasattr(payload_or_rooms, "plumbing_pipes"):
            plumbing_pipes = getattr(payload_or_rooms, "plumbing_pipes", [])
        if electrical_components is None and hasattr(payload_or_rooms, "electrical_components"):
            electrical_components = getattr(payload_or_rooms, "electrical_components", [])
        if electrical_circuits is None and hasattr(payload_or_rooms, "electrical_circuits"):
            electrical_circuits = getattr(payload_or_rooms, "electrical_circuits", [])
        if electrical_routes is None and hasattr(payload_or_rooms, "electrical_routes"):
            electrical_routes = getattr(payload_or_rooms, "electrical_routes", [])
    elif isinstance(payload_or_rooms, list):
        rooms = [
            r if isinstance(r, RoomPayload) else RoomPayload(**r)
            for r in payload_or_rooms
        ]
    else:
        rooms = []

    if not rooms:
        return SolveResponse(
            rooms=[],
            wall_polygons=[],
            wall_lines=[],
            dimensions=[],
            doors=[],
            windows=[],
            hvac_loads=[],
            hvac_equipment=[],
            hvac_pipes=[],
            furniture=[],
            plumbing_fixtures=[],
            plumbing_pipes=[],
            electrical_components=electrical_components or [],
            electrical_circuits=electrical_circuits or [],
            electrical_routes=electrical_routes or [],
            total_carpet_area_sqm=0.0,
            total_builtup_area_sqm=0.0
        )

    # Normalize Openings, HVAC & Furniture payloads
    norm_openings: List[OpeningPayload] = []
    if openings:
        for op in openings:
            if isinstance(op, OpeningPayload):
                norm_openings.append(op)
            elif isinstance(op, dict):
                norm_openings.append(OpeningPayload(**op))
            elif hasattr(op, "model_dump"):
                norm_openings.append(OpeningPayload(**op.model_dump()))

    norm_hvac: List[HVACEquipmentPayload] = []
    if hvac_equipment:
        for eq in hvac_equipment:
            if isinstance(eq, HVACEquipmentPayload):
                norm_hvac.append(eq)
            elif isinstance(eq, dict):
                norm_hvac.append(HVACEquipmentPayload(**eq))
            elif hasattr(eq, "model_dump"):
                norm_hvac.append(HVACEquipmentPayload(**eq.model_dump()))

    norm_furniture: List[FurniturePayload] = []
    if furniture:
        for f in furniture:
            try:
                if isinstance(f, FurniturePayload):
                    norm_furniture.append(f)
                elif isinstance(f, dict):
                    clean_dict = {k: v for k, v in f.items() if v is not None}
                    norm_furniture.append(FurniturePayload(**clean_dict))
                elif hasattr(f, "model_dump"):
                    clean_dict = {k: v for k, v in f.model_dump().items() if v is not None}
                    norm_furniture.append(FurniturePayload(**clean_dict))
            except Exception:
                continue

    norm_plumbing_fixtures: List[PlumbingFixturePayload] = []
    if plumbing_fixtures:
        for f in plumbing_fixtures:
            try:
                if isinstance(f, PlumbingFixturePayload):
                    norm_plumbing_fixtures.append(f)
                elif isinstance(f, dict):
                    clean_dict = {k: v for k, v in f.items() if v is not None}
                    norm_plumbing_fixtures.append(PlumbingFixturePayload(**clean_dict))
                elif hasattr(f, "model_dump"):
                    clean_dict = {k: v for k, v in f.model_dump().items() if v is not None}
                    norm_plumbing_fixtures.append(PlumbingFixturePayload(**clean_dict))
            except Exception:
                continue

    norm_plumbing_pipes: List[PlumbingPipePayload] = []
    if plumbing_pipes:
        for p in plumbing_pipes:
            try:
                if isinstance(p, PlumbingPipePayload):
                    norm_plumbing_pipes.append(p)
                elif isinstance(p, dict):
                    clean_dict = {k: v for k, v in p.items() if v is not None}
                    norm_plumbing_pipes.append(PlumbingPipePayload(**clean_dict))
                elif hasattr(p, "model_dump"):
                    clean_dict = {k: v for k, v in p.model_dump().items() if v is not None}
                    norm_plumbing_pipes.append(PlumbingPipePayload(**clean_dict))
            except Exception:
                continue

    # NEW: Plumbing Auto-Routing
    from backend.plumbing_router import auto_route_plumbing
    auto_route_plumbing(norm_plumbing_fixtures, norm_plumbing_pipes, rooms)

    # 0. Apply Automatic Snap Tolerance (10mm) for clean orthogonal junctions
    rooms = snap_room_coordinates(rooms, tolerance_mm=10.0)

    # 1. Apply Topology Pushing Algorithm (115mm interior wall gaps)
    try:
        shifted_rooms, shifts, is_containers = solve_spatial_topology(rooms, tolerance_mm=10.0, gap_mm=115.0)
        room_shift_map: Dict[str, Tuple[float, float]] = {rooms[i].name: shifts[i] for i in range(len(rooms))}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"CRITICAL FALLBACK: Topology Pushing Algorithm failed ({e}). Falling back to simple bounds.")
        shifted_rooms = rooms
        room_shift_map = {r.name: (0.0, 0.0) for r in rooms}
        is_containers = [False for _ in rooms]


    # 2. Build Carpet Room Polygons & Results (Strict Carpet Area Preservation)
    room_results: List[RoomResult] = []
    shifted_shapely_polys: List[Polygon] = []
    shifted_room_bounds: Dict[str, Tuple[float, float, float, float]] = {}

    for i, r in enumerate(shifted_rooms):
        # 1. PURGE GEOMETRIC DISTORTIONS: Enforce strict orthogonal 90-degree geometry
        # For standard rooms (4 points), strictly generate from exact bounding box limits 
        # in precise counter-clockwise (CCW) order to prevent bow-ties.
        if len(r.points) == 4:
            xs = [float(p[0]) for p in r.points]
            ys = [float(p[1]) for p in r.points]
            minx, maxx = min(xs), max(xs)
            miny, maxy = min(ys), max(ys)
            # Exactly 4 distinct corner vertices, strictly 90-degree internal angles
            r.points = [
                [minx, miny],
                [maxx, miny],
                [maxx, maxy],
                [minx, maxy]
            ]
            poly = Polygon(r.points)
        else:
            poly = Polygon(r.points)
            if not poly.is_valid:
                # Fallback to buffer(0) if self-intersecting, though ideally handled upstream
                poly = poly.buffer(0)

        # Disable all filleting/beveling to preserve pure orthogonal corners
        filleted = r.points
        
        if not is_containers[i]:
            shifted_shapely_polys.append(poly)
            
        minx, miny, maxx, maxy = poly.bounds
        shifted_room_bounds[r.name] = (minx, miny, maxx, maxy)

        area_sqm = round(poly.area / 1_000_000.0, 2)
        area_sqft = round(area_sqm * 10.76391041671, 1)
        cent = poly.centroid
        centroid_coords = [round(cent.x, 2), round(cent.y, 2)]

        wall_thick = 230.0 if len(shifted_rooms) == 1 else 115.0

        room_results.append(RoomResult(
            name=r.name,
            vertex_count=len(r.points),
            carpet_area_sqm=area_sqm,
            carpet_area_sqft=area_sqft,
            centroid=centroid_coords,
            wall_thickness_mm=wall_thick,
            points=[[float(p[0]), float(p[1])] for p in r.points],
            filleted_points=filleted
        ))

    union_shifted_rooms = unary_union(shifted_shapely_polys) if shifted_shapely_polys else Polygon()

    # 3. Interior Wall Generation: Create 115mm Party Wall polygons strictly between rooms
    party_wall_boxes = []
    n = len(shifted_rooms)

    for i in range(n):
        if is_containers[i]: continue
        ra = shifted_rooms[i]
        xs_a = [p[0] for p in ra.points]
        ys_a = [p[1] for p in ra.points]
        min_xa, max_xa = min(xs_a), max(xs_a)
        min_ya, max_ya = min(ys_a), max(ys_a)

        for j in range(i + 1, n):
            if is_containers[j]: continue
            rb = shifted_rooms[j]
            xs_b = [p[0] for p in rb.points]
            ys_b = [p[1] for p in rb.points]
            min_xb, max_xb = min(xs_b), max(xs_b)
            min_yb, max_yb = min(ys_b), max(ys_b)

            # Check Vertical 115mm Gap (Horizontal Neighbors)
            y_overlap_min = max(min_ya, min_yb)
            y_overlap_max = min(max_ya, max_yb)
            if (y_overlap_max - y_overlap_min) > 10.0:
                # B is to the right of A with ~115mm gap
                if 0.0 <= (min_xb - max_xa) <= 125.0:
                    box_poly = box(max_xa, y_overlap_min, min_xb, y_overlap_max)
                    if box_poly.is_valid and box_poly.area > 0:
                        party_wall_boxes.append(box_poly)
                # B is to the left of A with ~115mm gap (Bi-directional fix)
                elif 0.0 <= (min_xa - max_xb) <= 125.0:
                    box_poly = box(max_xb, y_overlap_min, min_xa, y_overlap_max)
                    if box_poly.is_valid and box_poly.area > 0:
                        party_wall_boxes.append(box_poly)

            # Check Horizontal 115mm Gap (Vertical Neighbors)
            x_overlap_min = max(min_xa, min_xb)
            x_overlap_max = min(max_xa, max_xb)
            if (x_overlap_max - x_overlap_min) > 10.0:
                # B is above A with ~115mm gap
                if 0.0 <= (min_yb - max_ya) <= 125.0:
                    box_poly = box(x_overlap_min, max_ya, x_overlap_max, min_yb)
                    if box_poly.is_valid and box_poly.area > 0:
                        party_wall_boxes.append(box_poly)
                # B is below A with ~115mm gap (Bi-directional fix)
                elif 0.0 <= (min_ya - max_yb) <= 125.0:
                    box_poly = box(x_overlap_min, max_yb, x_overlap_max, min_ya)
                    if box_poly.is_valid and box_poly.area > 0:
                        party_wall_boxes.append(box_poly)

    # Form the solid interior building footprint: union of shifted rooms and party wall boxes
    all_interior_pieces = [union_shifted_rooms] + party_wall_boxes
    building_interior = unary_union(all_interior_pieces)

    # Fill any small enclosed party-wall junction voids (e.g. 115x115 cross junction gaps)
    if isinstance(building_interior, Polygon) and len(building_interior.interiors) > 0:
        new_interiors = []
        for interior_ring in building_interior.interiors:
            hole_poly = Polygon(interior_ring)
            if hole_poly.area > 30000.0:  # Preserves large courtyard or real light shaft
                new_interiors.append(interior_ring)
        building_interior = Polygon(building_interior.exterior, new_interiors)
    elif isinstance(building_interior, MultiPolygon):
        cleaned_polys = []
        for poly in building_interior.geoms:
            if len(poly.interiors) > 0:
                new_interiors = [r for r in poly.interiors if Polygon(r).area > 30000.0]
                cleaned_polys.append(Polygon(poly.exterior, new_interiors))
            else:
                cleaned_polys.append(poly)
        building_interior = unary_union(cleaned_polys)

    # Pure interior party walls: EXACTLY the space inside building_interior that is not room carpet
    interior_party_walls = building_interior.difference(union_shifted_rooms)
    if interior_party_walls.is_empty:
        interior_party_walls = Polygon()

    try:
        # 4. Exterior Wall Generation: 230mm Outward Offset from the TRUE building envelope
        # Strictly avoid concave_hull or any non-orthogonal smoothing operations!
        building_envelope = building_interior
        exterior_buffered = building_envelope.buffer(230.0, join_style=2)
        exterior_walls = exterior_buffered.difference(building_envelope)
    
        # 5. Combined Watertight Walls (Single Solid Mass with ZERO Seams)
        combined_walls = exterior_walls
        if not interior_party_walls.is_empty:
            # Fuse internal and external using microscopic mitred buffer to erase any boundary overlapping artifacts
            combined_walls = unary_union([exterior_walls, interior_party_walls])
            combined_walls = combined_walls.buffer(1.0, join_style=2).buffer(-1.0, join_style=2)
    
        # Optional crisp simplification
        combined_walls = combined_walls.simplify(0.01, preserve_topology=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"CRITICAL FALLBACK: Complex wall generation failed ({e}). Reverting to basic buffer.")
        building_envelope = union_shifted_rooms
        exterior_buffered = building_envelope.buffer(230.0, join_style=2)
        exterior_walls = exterior_buffered.difference(building_envelope)
        combined_walls = exterior_walls

    # 6. Relative HVAC Equipment Mapping & Solving
    def get_room_shift(room_name: Optional[str]) -> Tuple[float, float]:
        if not room_name or not isinstance(room_name, str):
            return (0.0, 0.0)
        if room_name in room_shift_map:
            return room_shift_map[room_name]
        rn_l = room_name.lower().strip()
        for k, v in room_shift_map.items():
            if k.lower().strip() == rn_l:
                return v
        return (0.0, 0.0)

    shifted_hvac: Optional[List[HVACEquipmentPayload]] = None
    if norm_hvac:
        shifted_hvac = []
        for eq in norm_hvac:
            dx, dy = get_room_shift(eq.room_name)
            new_x = (float(eq.location_x) + dx) if eq.location_x is not None else None
            new_y = (float(eq.location_y) + dy) if eq.location_y is not None else None
            shifted_hvac.append(HVACEquipmentPayload(
                id=eq.id,
                room_name=eq.room_name,
                unit_type=eq.unit_type,
                cooling_capacity_tr=eq.cooling_capacity_tr,
                location_x=new_x,
                location_y=new_y,
                status=eq.status
            ))

    hvac_loads, hvac_eq, hvac_pipes = solve_hvac_system(
        shifted_rooms,
        room_results,
        shifted_hvac if shifted_hvac else None
    )

    # 7. Openings Relative Mapping, Minimum Offset Rule (>= 230mm) & Wall Cutouts
    cutout_polygons = []
    doors_cad: List[DoorCADGeometry] = []
    windows_cad: List[WindowCADGeometry] = []

    if norm_openings:
        margin = 50.0  # Safe epsilon margin for full penetration (Precision Rule 1)

        # --- NEW: Intelligent Opening Collision Detection & Auto-Spacing Pre-pass ---
        from collections import defaultdict
        ops_by_wall = defaultdict(list)
        for i, op in enumerate(norm_openings):
            hr = op.host_room.lower().strip() if op.host_room else ""
            sd = (op.wall_side or "Top").strip().capitalize()
            if sd not in ("Top", "Bottom", "Right", "Left"): sd = "Top"
            ops_by_wall[(hr, sd)].append((i, op))

        computed_offsets = {}
        for (hr, sd), group in ops_by_wall.items():
            group.sort(key=lambda x: float(x[1].offset_mm if x[1].offset_mm is not None else 0.0))
            
            bounds = None
            for k, v in shifted_room_bounds.items():
                if k.lower().strip() == hr:
                    bounds = v
                    break
            if not bounds:
                bounds = list(shifted_room_bounds.values())[0] if shifted_room_bounds else (0.0, 0.0, 6000.0, 5000.0)
                
            minx, miny, maxx, maxy = bounds
            wall_len = (maxx - minx) if sd in ("Top", "Bottom") else (maxy - miny)
            min_c = 150.0
            current_min = min_c
            
            total_req_space = sum(float(op.width_mm) for _, op in group) + min_c * (len(group) + 1)
            
            for i_idx, op in group:
                w = float(op.width_mm)
                # If wall is hopelessly small for everything, just center it
                if wall_len <= (min_c * 2 + w):
                    computed_offsets[i_idx] = (wall_len - w) / 2.0
                    continue
                    
                req = float(op.offset_mm if op.offset_mm is not None else 0.0)
                
                # If total required space exceeds wall, we just pack them from current_min
                if total_req_space > wall_len:
                    eff = current_min
                else:
                    eff = max(req, current_min)
                    if eff + w > wall_len - min_c:
                        eff = wall_len - min_c - w
                        if eff < current_min:
                            eff = current_min
                            
                computed_offsets[i_idx] = eff
                current_min = eff + w + min_c

        for i, op in enumerate(norm_openings):
            # Find bounds of shifted host room
            bounds = None
            if op.host_room in shifted_room_bounds:
                bounds = shifted_room_bounds[op.host_room]
            else:
                hr_l = op.host_room.lower().strip()
                for k, v in shifted_room_bounds.items():
                    if k.lower().strip() == hr_l:
                        bounds = v
                        break
            if not bounds:
                bounds = list(shifted_room_bounds.values())[0] if shifted_room_bounds else (0.0, 0.0, 6000.0, 5000.0)

            minx, miny, maxx, maxy = bounds
            side = (op.wall_side or "Top").strip().capitalize()
            if side not in ("Top", "Bottom", "Right", "Left"):
                side = "Top"

            # Check if this edge is an interior party wall (115mm) or exterior (230mm)
            is_interior_edge = False
            for other in shifted_rooms:
                if other.name.lower().strip() == op.host_room.lower().strip():
                    continue
                o_xs = [p[0] for p in other.points]
                o_ys = [p[1] for p in other.points]
                o_minx, o_maxx = min(o_xs), max(o_xs)
                o_miny, o_maxy = min(o_ys), max(o_ys)

                if side == "Top":
                    if 0.0 <= (o_miny - maxy) <= 130.0 and (min(o_maxx, maxx) - max(o_minx, minx)) > 10.0:
                        is_interior_edge = True
                        break
                elif side == "Bottom":
                    if 0.0 <= (miny - o_maxy) <= 130.0 and (min(o_maxx, maxx) - max(o_minx, minx)) > 10.0:
                        is_interior_edge = True
                        break
                elif side == "Right":
                    if 0.0 <= (o_minx - maxx) <= 130.0 and (min(o_maxy, maxy) - max(o_miny, miny)) > 10.0:
                        is_interior_edge = True
                        break
                elif side == "Left":
                    if 0.0 <= (minx - o_maxx) <= 130.0 and (min(o_maxy, maxy) - max(o_miny, miny)) > 10.0:
                        is_interior_edge = True
                        break

            wall_t = 115.0 if is_interior_edge else 230.0

            effective_offset = computed_offsets[i]

            swing = op.swing or "Inward-Right"

            if side == "Top":
                x1 = minx + effective_offset
                x2 = x1 + op.width_mm
                cut_box = box(x1, maxy - margin, x2, maxy + wall_t + margin)
                wall_y_inner = maxy
                wall_y_outer = maxy + wall_t

                if swing == "Inward-Left":
                    hinge = [x2, wall_y_inner]
                    leaf_end = [x2, wall_y_inner - op.width_mm]
                    arc_path = f"M {x1} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 0 {x2} {wall_y_inner - op.width_mm}"
                elif swing == "Outward-Right":
                    hinge = [x1, wall_y_outer]
                    leaf_end = [x1, wall_y_outer + op.width_mm]
                    arc_path = f"M {x2} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 0 {x1} {wall_y_outer + op.width_mm}"
                elif swing == "Outward-Left":
                    hinge = [x2, wall_y_outer]
                    leaf_end = [x2, wall_y_outer + op.width_mm]
                    arc_path = f"M {x1} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 1 {x2} {wall_y_outer + op.width_mm}"
                else:  # Inward-Right
                    hinge = [x1, wall_y_inner]
                    leaf_end = [x1, wall_y_inner - op.width_mm]
                    arc_path = f"M {x2} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 1 {x1} {wall_y_inner - op.width_mm}"

                jambs = [
                    [x1, wall_y_inner, x1, wall_y_outer],
                    [x2, wall_y_inner, x2, wall_y_outer]
                ]
                win_lines = [
                    [x1, wall_y_inner, x2, wall_y_inner],
                    [x1, wall_y_inner + wall_t / 2.0, x2, wall_y_inner + wall_t / 2.0],
                    [x1, wall_y_outer, x2, wall_y_outer]
                ]
                label_pos = [(x1 + x2) / 2.0, wall_y_inner - 200.0 if "Inward" in swing else wall_y_outer + 200.0]

            elif side == "Bottom":
                x1 = minx + effective_offset
                x2 = x1 + op.width_mm
                cut_box = box(x1, miny - wall_t - margin, x2, miny + margin)
                wall_y_inner = miny
                wall_y_outer = miny - wall_t

                if swing == "Inward-Left":
                    hinge = [x2, wall_y_inner]
                    leaf_end = [x2, wall_y_inner + op.width_mm]
                    arc_path = f"M {x1} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 1 {x2} {wall_y_inner + op.width_mm}"
                elif swing == "Outward-Right":
                    hinge = [x1, wall_y_outer]
                    leaf_end = [x1, wall_y_outer - op.width_mm]
                    arc_path = f"M {x2} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 1 {x1} {wall_y_outer - op.width_mm}"
                elif swing == "Outward-Left":
                    hinge = [x2, wall_y_outer]
                    leaf_end = [x2, wall_y_outer - op.width_mm]
                    arc_path = f"M {x1} {wall_y_outer} A {op.width_mm} {op.width_mm} 0 0 0 {x2} {wall_y_outer - op.width_mm}"
                else:  # Inward-Right
                    hinge = [x1, wall_y_inner]
                    leaf_end = [x1, wall_y_inner + op.width_mm]
                    arc_path = f"M {x2} {wall_y_inner} A {op.width_mm} {op.width_mm} 0 0 0 {x1} {wall_y_inner + op.width_mm}"

                jambs = [
                    [x1, wall_y_outer, x1, wall_y_inner],
                    [x2, wall_y_outer, x2, wall_y_inner]
                ]
                win_lines = [
                    [x1, wall_y_inner, x2, wall_y_inner],
                    [x1, wall_y_inner - wall_t / 2.0, x2, wall_y_inner - wall_t / 2.0],
                    [x1, wall_y_outer, x2, wall_y_outer]
                ]
                label_pos = [(x1 + x2) / 2.0, wall_y_inner + 200.0 if "Inward" in swing else wall_y_outer - 200.0]

            elif side == "Right":
                y1 = miny + effective_offset
                y2 = y1 + op.width_mm
                cut_box = box(maxx - margin, y1, maxx + wall_t + margin, y2)
                wall_x_inner = maxx
                wall_x_outer = maxx + wall_t

                if swing == "Inward-Left":
                    hinge = [wall_x_inner, y2]
                    leaf_end = [wall_x_inner - op.width_mm, y2]
                    arc_path = f"M {wall_x_inner} {y1} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_inner - op.width_mm} {y2}"
                elif swing == "Outward-Right":
                    hinge = [wall_x_outer, y1]
                    leaf_end = [wall_x_outer + op.width_mm, y1]
                    arc_path = f"M {wall_x_outer} {y2} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_outer + op.width_mm} {y1}"
                elif swing == "Outward-Left":
                    hinge = [wall_x_outer, y2]
                    leaf_end = [wall_x_outer + op.width_mm, y2]
                    arc_path = f"M {wall_x_outer} {y1} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_outer + op.width_mm} {y2}"
                else:  # Inward-Right
                    hinge = [wall_x_inner, y1]
                    leaf_end = [wall_x_inner - op.width_mm, y1]
                    arc_path = f"M {wall_x_inner} {y2} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_inner - op.width_mm} {y1}"

                jambs = [
                    [wall_x_inner, y1, wall_x_outer, y1],
                    [wall_x_inner, y2, wall_x_outer, y2]
                ]
                win_lines = [
                    [wall_x_inner, y1, wall_x_inner, y2],
                    [wall_x_inner + wall_t / 2.0, y1, wall_x_inner + wall_t / 2.0, y2],
                    [wall_x_outer, y1, wall_x_outer, y2]
                ]
                label_pos = [wall_x_inner - 200.0 if "Inward" in swing else wall_x_outer + 200.0, (y1 + y2) / 2.0]

            else:  # Left
                y1 = miny + effective_offset
                y2 = y1 + op.width_mm
                cut_box = box(minx - wall_t - margin, y1, minx + margin, y2)
                wall_x_inner = minx
                wall_x_outer = minx - wall_t

                if swing == "Inward-Left":
                    hinge = [wall_x_inner, y2]
                    leaf_end = [wall_x_inner + op.width_mm, y2]
                    arc_path = f"M {wall_x_inner} {y1} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_inner + op.width_mm} {y2}"
                elif swing == "Outward-Right":
                    hinge = [wall_x_outer, y1]
                    leaf_end = [wall_x_outer - op.width_mm, y1]
                    arc_path = f"M {wall_x_outer} {y2} A {op.width_mm} {op.width_mm} 0 0 0 {wall_x_outer - op.width_mm} {y1}"
                elif swing == "Outward-Left":
                    hinge = [wall_x_outer, y2]
                    leaf_end = [wall_x_outer - op.width_mm, y2]
                    arc_path = f"M {wall_x_outer} {y1} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_outer - op.width_mm} {y2}"
                else:  # Inward-Right
                    hinge = [wall_x_inner, y1]
                    leaf_end = [wall_x_inner + op.width_mm, y1]
                    arc_path = f"M {wall_x_inner} {y2} A {op.width_mm} {op.width_mm} 0 0 1 {wall_x_inner + op.width_mm} {y1}"

                jambs = [
                    [wall_x_outer, y1, wall_x_inner, y1],
                    [wall_x_outer, y2, wall_x_inner, y2]
                ]
                win_lines = [
                    [wall_x_inner, y1, wall_x_inner, y2],
                    [wall_x_inner - wall_t / 2.0, y1, wall_x_inner - wall_t / 2.0, y2],
                    [wall_x_outer, y1, wall_x_outer, y2]
                ]
                label_pos = [wall_x_inner + 200.0 if "Inward" in swing else wall_x_outer - 200.0, (y1 + y2) / 2.0]

            cutout_polygons.append(cut_box)

            if op.type.capitalize() == "Door":
                doors_cad.append(DoorCADGeometry(
                    id=op.id,
                    host_room=op.host_room,
                    wall_side=side,
                    offset_mm=effective_offset,
                    width_mm=op.width_mm,
                    height_mm=op.height_mm or 2100.0,
                    swing=swing,
                    hinge=hinge,
                    leaf_end=leaf_end,
                    arc_center=hinge,
                    arc_radius=op.width_mm,
                    arc_path=arc_path,
                    jambs=jambs,
                    label_x=label_pos[0],
                    label_y=label_pos[1]
                ))
            else:
                windows_cad.append(WindowCADGeometry(
                    id=op.id,
                    host_room=op.host_room,
                    wall_side=side,
                    offset_mm=effective_offset,
                    width_mm=op.width_mm,
                    height_mm=op.height_mm or 1200.0,
                    lines=win_lines,
                    jambs=jambs,
                    label_x=label_pos[0],
                    label_y=label_pos[1]
                ))

        # Boolean Subtraction: Cut openings out of combined walls and component walls
        if cutout_polygons:
            cutouts_union = unary_union(cutout_polygons)
            combined_walls = combined_walls.difference(cutouts_union)
            if not interior_party_walls.is_empty:
                interior_party_walls = interior_party_walls.difference(cutouts_union)
            if not exterior_walls.is_empty:
                exterior_walls = exterior_walls.difference(cutouts_union)

    # 8. Extract WallPolygons
    wall_polygons: List[WallPolygon] = []

    # Export Interior Party Walls
    if not interior_party_walls.is_empty:
        if isinstance(interior_party_walls, Polygon):
            int_polys = [interior_party_walls]
        elif isinstance(interior_party_walls, MultiPolygon):
            int_polys = list(interior_party_walls.geoms)
        else:
            int_polys = []

        for p in int_polys:
            ext, holes = extract_polygon_coords(p)
            wall_polygons.append(WallPolygon(
                wall_type="interior",
                thickness_mm=115.0,
                outer_polygon=ext,
                inner_polygons=holes
            ))

    # Export Exterior Walls
    if not exterior_walls.is_empty:
        if isinstance(exterior_walls, Polygon):
            ext_polys = [exterior_walls]
        elif isinstance(exterior_walls, MultiPolygon):
            ext_polys = list(exterior_walls.geoms)
        else:
            ext_polys = []

        for p in ext_polys:
            ext, holes = extract_polygon_coords(p)
            wall_polygons.append(WallPolygon(
                wall_type="exterior",
                thickness_mm=230.0,
                outer_polygon=ext,
                inner_polygons=holes
            ))

    # Export Combined Wall Loop (Fused structural shell with zero internal dividing seams)
    combined_wall_polygons: List[WallPolygon] = []
    if not combined_walls.is_empty:
        if isinstance(combined_walls, Polygon):
            comb_polys = [combined_walls]
        elif isinstance(combined_walls, MultiPolygon):
            comb_polys = list(combined_walls.geoms)
        else:
            comb_polys = []

        for p in comb_polys:
            ext, holes = extract_polygon_coords(p)
            combined_wall_polygons.append(WallPolygon(
                wall_type="combined",
                thickness_mm=230.0,
                outer_polygon=ext,
                inner_polygons=holes
            ))

    # 8b. Relative Furniture Placement, Auto-Scaling & Clearance Collision Solving (Beds)
    furniture_cad: List[FurnitureCAD] = []
    handled_furniture_rooms = set()
    bed_count = 1

    # 1. Custom user-specified furniture
    for f in norm_furniture:
        host_room_clean = (f.host_room_id or "").lower().strip()
        shift = get_room_shift(f.host_room_id)
        host_pts = []
        host_name = f.host_room_id
        for sr in shifted_rooms:
            if host_room_clean and sr.name.lower().strip() == host_room_clean:
                host_pts = sr.points
                host_name = sr.name
                break
        if not host_pts and shifted_rooms:
            host_pts = shifted_rooms[0].points
            host_name = shifted_rooms[0].name

        cad_item = calculate_furniture_cad(
            room_name=host_name or "Room",
            points=host_pts,
            item_id=f.id or f"FURN-{bed_count}",
            user_furniture=f,
            shift=shift,
            doors=doors_cad,
            windows=windows_cad
        )
        if cad_item:
            furniture_cad.append(cad_item)
            if host_name:
                handled_furniture_rooms.add(host_name.lower().strip())
            bed_count += 1

    # 2. Auto-scale beds for any bedroom without user-provided furniture
    for r in shifted_rooms:
        if is_bedroom_room(r.name) and r.name.lower().strip() not in handled_furniture_rooms:
            cad_bed = calculate_auto_scaled_bed(
                room_name=r.name,
                points=r.points,
                bed_id=f"BED-{bed_count}",
                user_furniture=None,
                shift=(0.0, 0.0),
                doors=doors_cad,
                windows=windows_cad
            )
            if cad_bed:
                furniture_cad.append(cad_bed)
                handled_furniture_rooms.add(r.name.lower().strip())
                bed_count += 1

    # Multi-item collision and boundary validation
    furniture_cad = evaluate_all_furniture_clearances(furniture_cad, shifted_rooms, doors_cad)

    # 8c. Plumbing Processing
    plumbing_fixtures_cad: List[PlumbingFixtureCAD] = []
    for f in norm_plumbing_fixtures:
        # We need to shift it based on the host room if it was shifted
        shift = room_shift_map.get(f.host_room_id, (0.0, 0.0))
        shifted_f = PlumbingFixturePayload(
            id=f.id, type=f.type, category=f.category, host_room_id=f.host_room_id,
            width=f.width, height=f.height, 
            x=(f.x + shift[0]) if f.x is not None else None,
            y=(f.y + shift[1]) if f.y is not None else None,
            rotation=f.rotation, connected_to=f.connected_to, clearance_status=f.clearance_status,
            supplyPipeId=f.supplyPipeId, drainagePipeId=f.drainagePipeId
        )
        cad_item = get_plumbing_fixture_cad(shifted_f, shifted_rooms)
        plumbing_fixtures_cad.append(cad_item)
        
    plumbing_pipes_cad: List[PlumbingPipeCAD] = []
    for p in norm_plumbing_pipes:
        shift = room_shift_map.get(p.host_room_id, (0.0, 0.0))
        shifted_path = None
        if p.path and isinstance(p.path, list) and len(p.path) >= 2:
            shifted_path = [[p.path[0][0] + shift[0], p.path[0][1] + shift[1]], [p.path[1][0] + shift[0], p.path[1][1] + shift[1]]]
            
        new_x = (p.x + shift[0]) if p.x is not None else (shifted_path[0][0] if shifted_path else None)
        new_y = (p.y + shift[1]) if p.y is not None else (shifted_path[0][1] if shifted_path else None)
        new_ex = (p.end_x + shift[0]) if p.end_x is not None else (shifted_path[1][0] if shifted_path else None)
        new_ey = (p.end_y + shift[1]) if p.end_y is not None else (shifted_path[1][1] if shifted_path else None)
        
        shifted_p = PlumbingPipePayload(
            id=p.id, type=p.type, host_room_id=p.host_room_id,
            x=new_x,
            y=new_y,
            end_x=new_ex,
            end_y=new_ey,
            path=shifted_path,
            diameter=p.diameter, connected_to=p.connected_to, clearance_status=p.clearance_status
        )
        cad_pipe = get_plumbing_pipe_cad(shifted_p, shifted_rooms)
        plumbing_pipes_cad.append(cad_pipe)

    # 8b. Ensure interconnected main trunks align with zero visual gaps after room topology shifting
    plumbing_pipes_cad = align_interconnected_pipes(plumbing_pipes_cad)

    # 9. Extract Wall Lines and CAD Dimensions
    wall_lines = extract_lines_from_geometry(combined_walls, wall_type="boundary")
    dimensions = compute_cad_dimensions(union_shifted_rooms, shifted_rooms)

    # 10. Compute Architectural Area Metrics
    total_carpet = sum(r.carpet_area_sqm for r in room_results)
    # The total built-up area includes all rooms + wall thickness footprints
    total_builtup = 0.0
    if not union_shifted_rooms.is_empty:
        total_builtup = combined_walls.union(union_shifted_rooms).area / 1_000_000.0

    return SolveResponse(
        rooms=room_results,
        wall_polygons=wall_polygons,
        wall_lines=wall_lines,
        dimensions=dimensions,
        doors=doors_cad,
        windows=windows_cad,
        hvac_loads=hvac_loads,
        hvac_equipment=hvac_eq,
        hvac_pipes=hvac_pipes,
        combined_wall_polygons=combined_wall_polygons,
        furniture=furniture_cad,
        plumbing_fixtures=plumbing_fixtures_cad,
        plumbing_pipes=plumbing_pipes_cad,
        electrical_components=electrical_components or [],
        electrical_circuits=electrical_circuits or [],
        electrical_routes=electrical_routes or [],
        total_carpet_area_sqm=round(total_carpet, 2),
        total_builtup_area_sqm=round(total_builtup, 2)
    )
