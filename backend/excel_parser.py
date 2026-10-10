import io
from typing import List, Dict, Any, Optional, Tuple
import openpyxl
from shapely.geometry import Polygon
from backend.geometry import RoomPayload, OpeningPayload, HVACEquipmentPayload, FurniturePayload
from backend.models import PlumbingFixturePayload, PlumbingPipePayload


class ExcelParsingError(ValueError):
    """Custom exception raised when an Excel floorplan fails validation or parsing."""
    pass


def normalize_header(header_val: Any) -> str:
    """Normalizes header string for case-insensitive matching."""
    if header_val is None:
        return ""
    return str(header_val).strip().lower()


import re

def find_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match required CAD room template columns.
    Expected columns:
      - Room Name
      - Fillet Radius (mm)
      - Point Index
      - X Coordinate (mm)
      - Y Coordinate (mm)
    """
    mapping: Dict[str, int] = {}
    
    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()
        if re.search(r'\b(room|room_name)\b', norm) and not re.search(r'\b(host)\b', norm):
            mapping["room_name"] = idx
        elif re.search(r'\b(fillet|radius)\b', norm):
            mapping["fillet_radius"] = idx
        elif re.search(r'\b(point|index|vertex)\b', norm):
            mapping["point_index"] = idx
        elif re.search(r'\b(x|x_coord)\b', norm) or norm.startswith("x"):
            mapping["x"] = idx
        elif re.search(r'\b(y|y_coord)\b', norm) or norm.startswith("y"):
            mapping["y"] = idx

    required = ["room_name", "x", "y"]
    if all(k in mapping for k in required):
        return mapping
    return None


def find_openings_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match Doors and Windows opening columns.
    Expected columns:
      - Opening ID
      - Type (Door/Window)
      - Host Wall Room
      - Wall Side (Bottom/Top/Left/Right)
      - Offset from Corner (mm)
      - Width (mm)
      - Height (mm)
      - Swing Direction
    """
    mapping: Dict[str, int] = {}

    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()

        if re.search(r'\b(opening|id)\b', norm):
            mapping["id"] = idx
        elif re.search(r'\b(type)\b', norm):
            mapping["type"] = idx
        elif re.search(r'\b(host|host_room)\b', norm):
            mapping["host_room"] = idx
        elif re.search(r'\b(side|wall_side)\b', norm):
            mapping["wall_side"] = idx
        elif re.search(r'\b(offset)\b', norm):
            mapping["offset_mm"] = idx
        elif re.search(r'\b(width)\b', norm):
            mapping["width_mm"] = idx
        elif re.search(r'\b(height)\b', norm):
            mapping["height_mm"] = idx
        elif re.search(r'\b(swing)\b', norm):
            mapping["swing"] = idx

    required = ["id", "type", "host_room", "wall_side", "offset_mm", "width_mm"]
    if all(k in mapping for k in required):
        return mapping
    return None


def find_hvac_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match HVAC Equipment columns.
    Expected columns:
      - Unit ID
      - Room Name
      - Unit Type
      - Cooling Capacity (TR)
      - Location X (mm)
      - Location Y (mm)
      - Status
    """
    mapping: Dict[str, int] = {}

    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()

        if "type" in norm:
            mapping["unit_type"] = idx
        elif "room" in norm:
            mapping["room_name"] = idx
        elif re.search(r'\b(id|unit id|equipment id|eq id)\b', norm) or norm == "unit id" or norm == "id":
            mapping["id"] = idx
        elif any(k in norm for k in ["capacity", "tr", "tonnage", "cooling"]):
            mapping["cooling_capacity_tr"] = idx
        elif "location x" in norm or "loc_x" in norm or norm.startswith("x"):
            mapping["location_x"] = idx
        elif "location y" in norm or "loc_y" in norm or norm.startswith("y"):
            mapping["location_y"] = idx
        elif "status" in norm:
            mapping["status"] = idx

    required = ["id", "room_name"]
    if all(k in mapping for k in required):
        return mapping
    return None


def _parse_coords(val: Any) -> Optional[Tuple[float, float]]:
    if val is None:
        return None
    s = str(val).strip()
    nums = re.findall(r'[-+]?\d*\.?\d+', s)
    if len(nums) >= 2:
        try:
            return float(nums[0]), float(nums[1])
        except (ValueError, TypeError):
            return None
    return None


def _parse_dimensions(val: Any) -> Tuple[Optional[float], Optional[float]]:
    if val is None:
        return None, None
    s = str(val).strip()
    nums = re.findall(r'[-+]?\d*\.?\d+', s)
    if len(nums) >= 2:
        try:
            return float(nums[0]), float(nums[1])
        except (ValueError, TypeError):
            return None, None
    elif len(nums) == 1:
        try:
            return float(nums[0]), None
        except (ValueError, TypeError):
            return None, None
    return None, None


def find_furniture_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match Furniture Schedule columns.
    Expected columns: Item ID, Type / Category, Host Room, Dimensions, Coordinates, Rotation, Clearance Status
    """
    mapping: Dict[str, int] = {}
    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()
        if any(k in norm for k in ["item id", "item_id", "furniture id", "furniture_id"]):
            mapping["id"] = idx
        elif norm == "id":
            mapping["id"] = idx
        elif any(k in norm for k in ["type / category", "type/category", "category / type"]):
            mapping["type_category"] = idx
        elif "category" in norm:
            mapping["category"] = idx
        elif "type" in norm:
            mapping["type"] = idx
        elif any(k in norm for k in ["host room", "host_room", "room"]):
            mapping["host_room"] = idx
        elif any(k in norm for k in ["dimension", "w x h", "size"]):
            mapping["dimensions"] = idx
        elif norm == "width" or "width" in norm:
            mapping["width"] = idx
        elif norm == "height" or "height" in norm:
            mapping["height"] = idx
        elif any(k in norm for k in ["coordinate", "coords", "location", "pos"]):
            mapping["coordinates"] = idx
        elif norm in ("x", "x (mm)", "loc_x"):
            mapping["x"] = idx
        elif norm in ("y", "y (mm)", "loc_y"):
            mapping["y"] = idx
        elif any(k in norm for k in ["rotation", "angle", "rot"]):
            mapping["rotation"] = idx
        elif any(k in norm for k in ["clearance", "clearance status", "status"]):
            mapping["clearance_status"] = idx

    if ("id" in mapping or "type" in mapping or "type_category" in mapping) and ("host_room" in mapping or "coordinates" in mapping or "x" in mapping):
        return mapping
    return None


def find_plumbing_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match Plumbing Schedule columns.
    Expected columns: Fixture ID / Pipe ID, Category / Type, Host Room, Dimensions, Coordinates, Connection Status, Run Length
    """
    mapping: Dict[str, int] = {}
    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()
        if any(k in norm for k in ["run length", "run_length"]):
            mapping["run_length"] = idx
        elif any(k in norm for k in ["fixture id", "item id"]) or norm in ("id", "pipe id", "fixture_id"):
            mapping["id"] = idx
        elif any(k in norm for k in ["category / type", "type / category", "category/type"]):
            mapping["type_category"] = idx
        elif "category" in norm:
            mapping["category"] = idx
        elif "type" in norm:
            mapping["type"] = idx
        elif any(k in norm for k in ["host room", "host_room", "room"]):
            mapping["host_room"] = idx
        elif any(k in norm for k in ["dimension", "diameter", "diam", "w x h"]):
            mapping["dimensions"] = idx
        elif norm == "width":
            mapping["width"] = idx
        elif norm == "height":
            mapping["height"] = idx
        elif any(k in norm for k in ["coordinate", "coord", "start", "path", "location"]):
            mapping["coordinates"] = idx
        elif norm in ("x", "loc_x"):
            mapping["x"] = idx
        elif norm in ("y", "loc_y"):
            mapping["y"] = idx
        elif any(k in norm for k in ["connection status", "connected to", "connected_to", "status"]):
            mapping["status"] = idx
        elif "length" in norm:
            mapping["run_length"] = idx

    if ("id" in mapping or "type" in mapping or "type_category" in mapping) and ("host_room" in mapping or "coordinates" in mapping or "dimensions" in mapping):
        return mapping

    return None


def find_electrical_header_mapping(row_values: List[Any]) -> Optional[Dict[str, int]]:
    """
    Scans row values to match Electrical Fixtures / Conduits columns.
    Expected columns: Component ID, Type, Category, Host Room, Coordinates, Rotation, Wattage, Circuit ID, Mounting
    """
    mapping: Dict[str, int] = {}
    for idx, val in enumerate(row_values):
        if val is None:
            continue
        norm = str(val).strip().lower()
        if any(k in norm for k in ["component id", "fixture id", "item id", "comp id"]) or norm == "id":
            mapping["id"] = idx
        elif norm in ("type", "fixture type", "unit type"):
            mapping["type"] = idx
        elif "category" in norm:
            mapping["category"] = idx
        elif any(k in norm for k in ["host room", "host_room", "room"]):
            mapping["host_room"] = idx
        elif any(k in norm for k in ["coordinate", "coord", "location"]):
            mapping["coordinates"] = idx
        elif norm in ("x", "loc_x", "location x"):
            mapping["x"] = idx
        elif norm in ("y", "loc_y", "location y"):
            mapping["y"] = idx
        elif any(k in norm for k in ["rotation", "angle", "rot"]):
            mapping["rotation"] = idx
        elif any(k in norm for k in ["wattage", "watts", "load", "power"]):
            mapping["wattage"] = idx
        elif any(k in norm for k in ["circuit id", "circuit_id", "circuit", "ckt"]):
            mapping["circuit_id"] = idx
        elif any(k in norm for k in ["mounting", "mount type", "mount"]):
            mapping["mounting"] = idx

    if ("id" in mapping or "type" in mapping) and ("host_room" in mapping or "coordinates" in mapping or "x" in mapping or "circuit_id" in mapping):
        return mapping
    return None


def _parse_excel_floorplan_internal(file_bytes: bytes):
    if not file_bytes:
        raise ExcelParsingError("Uploaded file is empty.")


    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        raise ExcelParsingError(f"Failed to read Excel workbook: {str(e)}")

    if not wb.sheetnames:
        raise ExcelParsingError("Workbook contains no worksheets.")

    # 1. Parse Room Coordinates from Sheet 1 (or active sheet)
    ws_rooms = wb.active
    for name in wb.sheetnames:
        if "room" in name.lower() or "coord" in name.lower():
            ws_rooms = wb[name]
            break

    header_mapping = None
    header_row_idx = None

    for row_idx, row in enumerate(ws_rooms.iter_rows(values_only=True), start=1):
        if row_idx > 10:
            break
        mapping = find_header_mapping(list(row))
        if mapping:
            header_mapping = mapping
            header_row_idx = row_idx
            break

    if not header_mapping:
        raise ExcelParsingError(
            "Could not find required room coordinate columns in Excel sheet. "
            "Please ensure headers include 'Room Name', 'Point Index', 'X Coordinate (mm)', and 'Y Coordinate (mm)'."
        )

    rooms_data: Dict[str, Dict[str, Any]] = {}

    for row_idx, row in enumerate(ws_rooms.iter_rows(min_row=header_row_idx + 1, values_only=True), start=header_row_idx + 1):
        if not any(cell is not None and str(cell).strip() != "" for cell in row):
            continue

        raw_name = row[header_mapping["room_name"]] if header_mapping["room_name"] < len(row) else None
        if raw_name is None or str(raw_name).strip() == "":
            continue
        room_name = str(raw_name).strip()

        try:
            raw_x = row[header_mapping["x"]] if header_mapping["x"] < len(row) else None
            raw_y = row[header_mapping["y"]] if header_mapping["y"] < len(row) else None
            if raw_x is None or raw_y is None:
                raise ValueError("Coordinate value cannot be empty.")
            x = float(raw_x)
            y = float(raw_y)
        except (ValueError, TypeError):
            raise ExcelParsingError(
                f"Row {row_idx}: Invalid coordinate values for room '{room_name}'. X and Y must be valid numbers."
            )

        fillet_radius = 0.0
        if "fillet_radius" in header_mapping and header_mapping["fillet_radius"] < len(row):
            raw_fillet = row[header_mapping["fillet_radius"]]
            if raw_fillet is not None and str(raw_fillet).strip() != "":
                try:
                    fillet_radius = max(0.0, float(raw_fillet))
                except (ValueError, TypeError):
                    fillet_radius = 0.0

        point_idx = row_idx
        if "point_index" in header_mapping and header_mapping["point_index"] < len(row):
            raw_idx = row[header_mapping["point_index"]]
            if raw_idx is not None and str(raw_idx).strip() != "":
                try:
                    point_idx = int(float(raw_idx))
                except (ValueError, TypeError):
                    point_idx = row_idx

        if room_name not in rooms_data:
            rooms_data[room_name] = {
                "name": room_name,
                "fillet_radius": fillet_radius,
                "vertices": []
            }
        else:
            if fillet_radius > 0:
                rooms_data[room_name]["fillet_radius"] = fillet_radius

        rooms_data[room_name]["vertices"].append({
            "index": point_idx,
            "row": row_idx,
            "point": [x, y]
        })

    if not rooms_data:
        raise ExcelParsingError("The Excel sheet does not contain any valid room coordinate records.")

    parsed_rooms: List[RoomPayload] = []

    for room_name, rdata in rooms_data.items():
        rdata["vertices"].sort(key=lambda v: (v["index"], v["row"]))
        points = [v["point"] for v in rdata["vertices"]]

        if len(points) < 3:
            raise ExcelParsingError(
                f"Room '{room_name}' has only {len(points)} coordinate vertex/vertices. "
                f"A closed room polygon must have at least 3 vertices."
            )

        try:
            poly = Polygon(points)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.area < 1e-4:
                raise ExcelParsingError(
                    f"Room '{room_name}' forms a degenerate polygon with zero area. "
                    f"Please verify that the coordinates form a closed 2D polygon."
                )
        except ExcelParsingError:
            raise
        except Exception as e:
            raise ExcelParsingError(f"Room '{room_name}' has invalid geometry: {str(e)}")

        parsed_rooms.append(RoomPayload(
            name=room_name,
            points=points,
            fillet_radius=rdata["fillet_radius"]
        ))

    # 2. Parse Doors and Windows from Sheet 2 (or matching sheet)
    parsed_openings: List[OpeningPayload] = []
    ws_openings = None

    for name in wb.sheetnames:
        if "door" in name.lower() or "window" in name.lower() or "opening" in name.lower():
            ws_openings = wb[name]
            break

    if ws_openings:
        openings_mapping = None
        openings_row_idx = None

        for row_idx, row in enumerate(ws_openings.iter_rows(values_only=True), start=1):
            if row_idx > 10:
                break
            omap = find_openings_header_mapping(list(row))
            if omap:
                openings_mapping = omap
                openings_row_idx = row_idx
                break

        if openings_mapping and openings_row_idx:
            for row_idx, row in enumerate(ws_openings.iter_rows(min_row=openings_row_idx + 1, values_only=True), start=openings_row_idx + 1):
                if not any(cell is not None and str(cell).strip() != "" for cell in row):
                    continue

                op_id = str(row[openings_mapping["id"]]).strip() if openings_mapping["id"] < len(row) and row[openings_mapping["id"]] is not None else f"OP-{row_idx}"
                op_type = str(row[openings_mapping["type"]]).strip() if openings_mapping["type"] < len(row) and row[openings_mapping["type"]] is not None else "Door"
                host_room = str(row[openings_mapping["host_room"]]).strip() if openings_mapping["host_room"] < len(row) and row[openings_mapping["host_room"]] is not None else parsed_rooms[0].name
                wall_side = str(row[openings_mapping["wall_side"]]).strip() if openings_mapping["wall_side"] < len(row) and row[openings_mapping["wall_side"]] is not None else "Top"

                try:
                    offset_mm = float(row[openings_mapping["offset_mm"]]) if openings_mapping["offset_mm"] < len(row) and row[openings_mapping["offset_mm"]] is not None else 0.0
                    width_mm = float(row[openings_mapping["width_mm"]]) if openings_mapping["width_mm"] < len(row) and row[openings_mapping["width_mm"]] is not None else 900.0
                except (ValueError, TypeError):
                    continue

                height_mm = 2100.0 if op_type.lower() == "door" else 1200.0
                if "height_mm" in openings_mapping and openings_mapping["height_mm"] < len(row):
                    raw_h = row[openings_mapping["height_mm"]]
                    if raw_h is not None and str(raw_h).strip() != "":
                        try:
                            height_mm = float(raw_h)
                        except (ValueError, TypeError):
                            pass

                swing = "Inward-Right"
                if "swing" in openings_mapping and openings_mapping["swing"] < len(row):
                    raw_swing = row[openings_mapping["swing"]]
                    if raw_swing is not None and str(raw_swing).strip() != "":
                        swing = str(raw_swing).strip()

                parsed_openings.append(OpeningPayload(
                    id=op_id,
                    type="Door" if "door" in op_type.lower() else "Window",
                    host_room=host_room,
                    wall_side=wall_side.capitalize(),
                    offset_mm=max(0.0, offset_mm),
                    width_mm=max(100.0, width_mm),
                    height_mm=max(100.0, height_mm),
                    swing=swing
                ))

    # 3. Parse HVAC Equipment from Sheet 3 (or matching sheet)
    parsed_hvac: List[HVACEquipmentPayload] = []
    ws_hvac = None

    for name in wb.sheetnames:
        if "hvac" in name.lower() or "mep" in name.lower() or "equipment" in name.lower():
            ws_hvac = wb[name]
            break

    if ws_hvac:
        hvac_mapping = None
        hvac_row_idx = None

        for row_idx, row in enumerate(ws_hvac.iter_rows(values_only=True), start=1):
            if row_idx > 10:
                break
            hmap = find_hvac_header_mapping(list(row))
            if hmap:
                hvac_mapping = hmap
                hvac_row_idx = row_idx
                break

        if hvac_mapping and hvac_row_idx:
            for row_idx, row in enumerate(ws_hvac.iter_rows(min_row=hvac_row_idx + 1, values_only=True), start=hvac_row_idx + 1):
                if not any(cell is not None and str(cell).strip() != "" for cell in row):
                    continue

                unit_id = str(row[hvac_mapping["id"]]).strip() if hvac_mapping["id"] < len(row) and row[hvac_mapping["id"]] is not None else f"EQ-{row_idx}"
                room_name = str(row[hvac_mapping["room_name"]]).strip() if hvac_mapping["room_name"] < len(row) and row[hvac_mapping["room_name"]] is not None else parsed_rooms[0].name
                unit_type = str(row[hvac_mapping["unit_type"]]).strip() if "unit_type" in hvac_mapping and hvac_mapping["unit_type"] < len(row) and row[hvac_mapping["unit_type"]] is not None else "Split-IDU"

                cooling_tr = None
                if "cooling_capacity_tr" in hvac_mapping and hvac_mapping["cooling_capacity_tr"] < len(row):
                    raw_tr = row[hvac_mapping["cooling_capacity_tr"]]
                    if raw_tr is not None and str(raw_tr).strip() != "":
                        try:
                            cooling_tr = float(raw_tr)
                        except (ValueError, TypeError):
                            pass

                loc_x, loc_y = None, None
                if "location_x" in hvac_mapping and hvac_mapping["location_x"] < len(row):
                    raw_x = row[hvac_mapping["location_x"]]
                    if raw_x is not None and str(raw_x).strip() != "":
                        try:
                            loc_x = float(raw_x)
                        except (ValueError, TypeError):
                            pass

                if "location_y" in hvac_mapping and hvac_mapping["location_y"] < len(row):
                    raw_y = row[hvac_mapping["location_y"]]
                    if raw_y is not None and str(raw_y).strip() != "":
                        try:
                            loc_y = float(raw_y)
                        except (ValueError, TypeError):
                            pass

                status = "Active"
                if "status" in hvac_mapping and hvac_mapping["status"] < len(row):
                    raw_st = row[hvac_mapping["status"]]
                    if raw_st is not None and str(raw_st).strip() != "":
                        status = str(raw_st).strip()

                parsed_hvac.append(HVACEquipmentPayload(
                    id=unit_id,
                    room_name=room_name,
                    unit_type=unit_type,
                    cooling_capacity_tr=cooling_tr,
                    location_x=loc_x,
                    location_y=loc_y,
                    status=status
                ))

    # 4. Parse Furniture Schedule from Sheet 4 (or matching sheet)
    parsed_furniture: List[FurniturePayload] = []
    ws_furniture = None
    for name in wb.sheetnames:
        if "furniture" in name.lower():
            ws_furniture = wb[name]
            break

    if ws_furniture:
        furn_mapping = None
        furn_row_idx = None
        for row_idx, row in enumerate(ws_furniture.iter_rows(values_only=True), start=1):
            if row_idx > 10:
                break
            fmap = find_furniture_header_mapping(list(row))
            if fmap:
                furn_mapping = fmap
                furn_row_idx = row_idx
                break

        if furn_mapping and furn_row_idx:
            for row_idx, row in enumerate(ws_furniture.iter_rows(min_row=furn_row_idx + 1, values_only=True), start=furn_row_idx + 1):
                if not any(cell is not None and str(cell).strip() != "" for cell in row):
                    continue

                raw_id = row[furn_mapping["id"]] if "id" in furn_mapping and furn_mapping["id"] < len(row) else None
                if raw_id is not None and str(raw_id).strip() in ("—", "-", ""):
                    continue

                f_id = str(raw_id).strip() if raw_id is not None else f"FURN-{row_idx}"
                f_type = "Bed"
                f_cat = "Bedroom"

                if "type_category" in furn_mapping and furn_mapping["type_category"] < len(row):
                    raw_tc = str(row[furn_mapping["type_category"]] or "").strip()
                    if "/" in raw_tc:
                        parts = [p.strip() for p in raw_tc.split("/", 1)]
                        f_type = parts[0] or "Bed"
                        f_cat = parts[1] or "Bedroom"
                    elif raw_tc:
                        f_type = raw_tc
                else:
                    if "type" in furn_mapping and furn_mapping["type"] < len(row) and row[furn_mapping["type"]] is not None:
                        f_type = str(row[furn_mapping["type"]]).strip()
                    if "category" in furn_mapping and furn_mapping["category"] < len(row) and row[furn_mapping["category"]] is not None:
                        f_cat = str(row[furn_mapping["category"]]).strip()

                host_room = str(row[furn_mapping["host_room"]]).strip() if "host_room" in furn_mapping and furn_mapping["host_room"] < len(row) and row[furn_mapping["host_room"]] is not None else (parsed_rooms[0].name if parsed_rooms else "Room")

                w, h = 1000.0, 600.0
                if "dimensions" in furn_mapping and furn_mapping["dimensions"] < len(row):
                    dw, dh = _parse_dimensions(row[furn_mapping["dimensions"]])
                    if dw is not None:
                        w = dw
                    if dh is not None:
                        h = dh
                else:
                    if "width" in furn_mapping and furn_mapping["width"] < len(row) and row[furn_mapping["width"]] is not None:
                        try:
                            w = float(row[furn_mapping["width"]])
                        except (ValueError, TypeError):
                            pass
                    if "height" in furn_mapping and furn_mapping["height"] < len(row) and row[furn_mapping["height"]] is not None:
                        try:
                            h = float(row[furn_mapping["height"]])
                        except (ValueError, TypeError):
                            pass

                x, y = 0.0, 0.0
                if "coordinates" in furn_mapping and furn_mapping["coordinates"] < len(row):
                    coords = _parse_coords(row[furn_mapping["coordinates"]])
                    if coords:
                        x, y = coords
                else:
                    if "x" in furn_mapping and furn_mapping["x"] < len(row) and row[furn_mapping["x"]] is not None:
                        try:
                            x = float(row[furn_mapping["x"]])
                        except (ValueError, TypeError):
                            pass
                    if "y" in furn_mapping and furn_mapping["y"] < len(row) and row[furn_mapping["y"]] is not None:
                        try:
                            y = float(row[furn_mapping["y"]])
                        except (ValueError, TypeError):
                            pass

                rot = 0.0
                if "rotation" in furn_mapping and furn_mapping["rotation"] < len(row) and row[furn_mapping["rotation"]] is not None:
                    raw_rot = str(row[furn_mapping["rotation"]]).strip()
                    rot_matches = re.findall(r'[-+]?\d*\.?\d+', raw_rot)
                    if rot_matches:
                        try:
                            rot = float(rot_matches[0])
                        except (ValueError, TypeError):
                            pass

                c_status = "OK"
                if "clearance_status" in furn_mapping and furn_mapping["clearance_status"] < len(row) and row[furn_mapping["clearance_status"]] is not None:
                    c_status = str(row[furn_mapping["clearance_status"]]).strip()

                parsed_furniture.append(FurniturePayload(
                    id=f_id,
                    type=f_type,
                    category=f_cat,
                    host_room_id=host_room,
                    width=w,
                    height=h,
                    x=x,
                    y=y,
                    rotation=rot,
                    clearance_status=c_status
                ))

    # 5. Parse Plumbing Schedule from Sheet 5 (or matching sheet)
    parsed_plumbing_fixtures: List[PlumbingFixturePayload] = []
    parsed_plumbing_pipes: List[PlumbingPipePayload] = []
    ws_plumbing = None
    for name in wb.sheetnames:
        if any(k in name.lower() for k in ["plumb", "sanitary", "pipe"]):
            ws_plumbing = wb[name]
            break

    if ws_plumbing:
        plm_mapping = None
        plm_row_idx = None
        for row_idx, row in enumerate(ws_plumbing.iter_rows(values_only=True), start=1):
            if row_idx > 10:
                break
            pmap = find_plumbing_header_mapping(list(row))
            if pmap:
                plm_mapping = pmap
                plm_row_idx = row_idx
                break

        if plm_mapping and plm_row_idx:
            for row_idx, row in enumerate(ws_plumbing.iter_rows(min_row=plm_row_idx + 1, values_only=True), start=plm_row_idx + 1):
                if not any(cell is not None and str(cell).strip() != "" for cell in row):
                    continue

                raw_id = row[plm_mapping["id"]] if "id" in plm_mapping and plm_mapping["id"] < len(row) else None
                if raw_id is not None and str(raw_id).strip() in ("—", "-", ""):
                    continue

                p_id = str(raw_id).strip() if raw_id is not None else f"PLM-{row_idx}"
                p_type = "Wash Basin"
                p_cat = "Bathroom"

                if "type_category" in plm_mapping and plm_mapping["type_category"] < len(row):
                    raw_tc = str(row[plm_mapping["type_category"]] or "").strip()
                    if "/" in raw_tc:
                        parts = [p.strip() for p in raw_tc.split("/", 1)]
                        p_cat = parts[0] or "Bathroom"
                        p_type = parts[1] or "Wash Basin"
                    elif raw_tc:
                        p_type = raw_tc
                else:
                    if "type" in plm_mapping and plm_mapping["type"] < len(row) and row[plm_mapping["type"]] is not None:
                        p_type = str(row[plm_mapping["type"]]).strip()
                    if "category" in plm_mapping and plm_mapping["category"] < len(row) and row[plm_mapping["category"]] is not None:
                        p_cat = str(row[plm_mapping["category"]]).strip()

                host_room = str(row[plm_mapping["host_room"]]).strip() if "host_room" in plm_mapping and plm_mapping["host_room"] < len(row) and row[plm_mapping["host_room"]] is not None else (parsed_rooms[0].name if parsed_rooms else "Room")

                status_val = "Connected"
                if "status" in plm_mapping and plm_mapping["status"] < len(row) and row[plm_mapping["status"]] is not None:
                    status_val = str(row[plm_mapping["status"]]).strip()

                is_pipe = "pipe" in p_id.lower() or "pipe" in p_type.lower() or "drain" in p_type.lower() or "water" in p_cat.lower()

                if is_pipe:
                    diam = 110.0
                    if "dimensions" in plm_mapping and plm_mapping["dimensions"] < len(row):
                        dw, _ = _parse_dimensions(row[plm_mapping["dimensions"]])
                        if dw is not None:
                            diam = dw
                    
                    start_coords = None
                    if "coordinates" in plm_mapping and plm_mapping["coordinates"] < len(row):
                        start_coords = _parse_coords(row[plm_mapping["coordinates"]])
                    
                    path = [list(start_coords), [start_coords[0] + 1000.0, start_coords[1]]] if start_coords else [[0.0, 0.0], [1000.0, 0.0]]
                    parsed_plumbing_pipes.append(PlumbingPipePayload(
                        id=p_id,
                        type=p_type,
                        host_room_id=host_room,
                        diameter=diam,
                        path=path,
                        connected_to=status_val,
                        clearance_status="OK"
                    ))
                else:
                    w, h = 600.0, 500.0
                    if "dimensions" in plm_mapping and plm_mapping["dimensions"] < len(row):
                        dw, dh = _parse_dimensions(row[plm_mapping["dimensions"]])
                        if dw is not None:
                            w = dw
                        if dh is not None:
                            h = dh

                    x, y = 0.0, 0.0
                    if "coordinates" in plm_mapping and plm_mapping["coordinates"] < len(row):
                        coords = _parse_coords(row[plm_mapping["coordinates"]])
                        if coords:
                            x, y = coords

                    parsed_plumbing_fixtures.append(PlumbingFixturePayload(
                        id=p_id,
                        type=p_type,
                        category=p_cat,
                        host_room_id=host_room,
                        width=w,
                        height=h,
                        x=x,
                        y=y,
                        rotation=0.0,
                        connected_to=status_val,
                        clearance_status="OK"
                    ))

    # 6. Parse Electrical Schedule from Sheet 6 (or matching sheet)
    parsed_electrical_components: List[Dict[str, Any]] = []
    parsed_electrical_circuits: List[Dict[str, Any]] = []
    parsed_electrical_routes: List[Dict[str, Any]] = []
    ws_electrical = None
    for name in wb.sheetnames:
        if any(k in name.lower() for k in ["electr", "circuit", "conduit", "wire", "power"]):
            ws_electrical = wb[name]
            break

    if ws_electrical:
        el_mapping = None
        el_row_idx = None
        for row_idx, row in enumerate(ws_electrical.iter_rows(values_only=True), start=1):
            if row_idx > 10:
                break
            emap = find_electrical_header_mapping(list(row))
            if emap:
                el_mapping = emap
                el_row_idx = row_idx
                break

        if el_mapping and el_row_idx:
            for row_idx, row in enumerate(ws_electrical.iter_rows(min_row=el_row_idx + 1, values_only=True), start=el_row_idx + 1):
                if not any(cell is not None and str(cell).strip() != "" for cell in row):
                    continue

                raw_id = row[el_mapping["id"]] if "id" in el_mapping and el_mapping["id"] < len(row) else None
                if raw_id is not None and str(raw_id).strip() in ("—", "-", ""):
                    continue

                c_id = str(raw_id).strip() if raw_id is not None else f"EL-{row_idx}"
                c_type = str(row[el_mapping["type"]]).strip() if "type" in el_mapping and el_mapping["type"] < len(row) and row[el_mapping["type"]] is not None else "ceiling_light"
                c_cat = str(row[el_mapping["category"]]).strip() if "category" in el_mapping and el_mapping["category"] < len(row) and row[el_mapping["category"]] is not None else "lighting"
                host_room = str(row[el_mapping["host_room"]]).strip() if "host_room" in el_mapping and el_mapping["host_room"] < len(row) and row[el_mapping["host_room"]] is not None else (parsed_rooms[0].name if parsed_rooms else "Room")

                x, y = 0.0, 0.0
                if "coordinates" in el_mapping and el_mapping["coordinates"] < len(row):
                    coords = _parse_coords(row[el_mapping["coordinates"]])
                    if coords:
                        x, y = coords
                else:
                    if "x" in el_mapping and el_mapping["x"] < len(row) and row[el_mapping["x"]] is not None:
                        try:
                            x = float(row[el_mapping["x"]])
                        except (ValueError, TypeError):
                            pass
                    if "y" in el_mapping and el_mapping["y"] < len(row) and row[el_mapping["y"]] is not None:
                        try:
                            y = float(row[el_mapping["y"]])
                        except (ValueError, TypeError):
                            pass

                rot = 0.0
                if "rotation" in el_mapping and el_mapping["rotation"] < len(row) and row[el_mapping["rotation"]] is not None:
                    rot_matches = re.findall(r'[-+]?\d*\.?\d+', str(row[el_mapping["rotation"]]))
                    if rot_matches:
                        try:
                            rot = float(rot_matches[0])
                        except (ValueError, TypeError):
                            pass

                wattage = 15.0
                if "wattage" in el_mapping and el_mapping["wattage"] < len(row) and row[el_mapping["wattage"]] is not None:
                    w_matches = re.findall(r'[-+]?\d*\.?\d+', str(row[el_mapping["wattage"]]))
                    if w_matches:
                        try:
                            wattage = float(w_matches[0])
                        except (ValueError, TypeError):
                            pass

                circuit_id = "CKT-1"
                if "circuit_id" in el_mapping and el_mapping["circuit_id"] < len(row) and row[el_mapping["circuit_id"]] is not None:
                    raw_ckt = str(row[el_mapping["circuit_id"]]).strip()
                    if raw_ckt:
                        circuit_id = raw_ckt

                mounting = "ceiling"
                if "mounting" in el_mapping and el_mapping["mounting"] < len(row) and row[el_mapping["mounting"]] is not None:
                    mounting = str(row[el_mapping["mounting"]]).strip()

                if c_id.startswith("WIRE") or c_id.startswith("RT-") or "conduit" in c_type.lower():
                    parsed_electrical_routes.append({
                        "id": c_id,
                        "circuit_id": circuit_id,
                        "type": c_type,
                        "path": [[x, y], [x + 500.0, y]],
                        "wire_type": "2.5mm_copper",
                        "length_mm": 500.0
                    })
                elif c_id.startswith("CKT") and c_type.lower() == "circuit":
                    parsed_electrical_circuits.append({
                        "id": c_id,
                        "name": host_room,
                        "type": c_cat,
                        "breaker_rating_a": 16,
                        "wire_gauge": "2.5 mm² Cu",
                        "voltage": 230,
                        "connected_component_ids": [],
                        "total_load_w": wattage
                    })
                else:
                    parsed_electrical_components.append({
                        "id": c_id,
                        "type": c_type,
                        "category": c_cat,
                        "x": x,
                        "y": y,
                        "rotation": rot,
                        "host_room_id": host_room,
                        "host_room_name": host_room,
                        "circuit_id": circuit_id,
                        "wattage": wattage,
                        "mounting": mounting
                    })

    return (
        parsed_rooms,
        parsed_openings,
        parsed_hvac,
        parsed_furniture,
        parsed_plumbing_fixtures,
        parsed_plumbing_pipes,
        parsed_electrical_components,
        parsed_electrical_circuits,
        parsed_electrical_routes
    )


def parse_excel_floorplan_full(file_bytes: bytes) -> Tuple[
    List[RoomPayload],
    List[OpeningPayload],
    List[HVACEquipmentPayload],
    List[FurniturePayload],
    List[PlumbingFixturePayload],
    List[PlumbingPipePayload],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]]
]:
    """
    Parses an uploaded Excel workbook (.xlsx / .xls) across all 6 disciplines:
      1. Room Coordinates
      2. Doors & Windows
      3. HVAC Equipment
      4. Furniture Schedule
      5. Plumbing Fixtures & Pipes
      6. Electrical Fixtures, Circuits & Conduits
    """
    return parse_excel_floorplan(file_bytes, return_full=True)  # type: ignore


def parse_excel_floorplan(file_bytes: bytes, return_full: bool = False):
    """
    Parses an uploaded Excel workbook (.xlsx / .xls).
    If return_full=False (default), returns the backward-compatible 3-tuple:
      (rooms, openings, hvac)
    If return_full=True, returns the complete 9-tuple across all 6 sheets:
      (rooms, openings, hvac, furniture, plumbing_fixtures, plumbing_pipes,
       electrical_components, electrical_circuits, electrical_routes)
    """
    full_result = _parse_excel_floorplan_internal(file_bytes)
    if return_full:
        return full_result
    return full_result[0], full_result[1], full_result[2]


