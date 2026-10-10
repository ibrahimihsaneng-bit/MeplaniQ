import io
import math
from typing import Dict, Any, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side


def _safe_float(val: Any, fallback: float = 0.0) -> float:
    """Safely converts an arbitrary value to float, handling None, non-numeric strings, and infinities."""
    if val is None:
        return fallback
    try:
        res = float(val)
        return res if math.isfinite(res) else fallback
    except (ValueError, TypeError):
        return fallback


def _safe_str(val: Any, fallback: str = "") -> str:
    """Safely converts an arbitrary value to stripped string."""
    if val is None:
        return fallback
    return str(val).strip()


def export_project_to_excel(cad_data: Dict[str, Any], project_name: str = "Floorplan") -> bytes:
    """
    Converts a CAD project's geometry data (rooms, openings/doors/windows, HVAC equipment, and furniture)
    into a unified 4-sheet Excel (.xlsx) workbook compatible with the engine parser.

    Sheets:
      1. Room Coordinates Payload
      2. Doors and Windows
      3. HVAC Equipment
      4. Furniture Schedule
    """
    wb = openpyxl.Workbook()

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_align = Alignment(horizontal="center", vertical="center")
    empty_font = Font(name="Calibri", size=10, italic=True, color="64748B")

    # =========================================================================
    # Sheet 1: Room Coordinates Payload
    # =========================================================================
    ws1 = wb.active
    ws1.title = "Room Coordinates Payload"

    ws1.merge_cells("A1:E1")
    title1 = ws1["A1"]
    title1.value = "Parametric 2D CAD Building Floorplan Coordinates"
    title1.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title1.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title1.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 35

    headers1 = [
        "Room Name",
        "Fillet Radius (mm)",
        "Point Index",
        "X Coordinate (mm)",
        "Y Coordinate (mm)",
    ]
    ws1.append(headers1)
    fill1 = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    for col_idx in range(1, 6):
        cell = ws1.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill1
        cell.alignment = header_align
    ws1.row_dimensions[2].height = 25

    rooms = cad_data.get("rooms", []) if isinstance(cad_data, dict) else []
    row_counter1 = 3
    if rooms:
        for room in rooms:
            if not isinstance(room, dict):
                continue
            r_name = _safe_str(room.get("name"), "Room")
            fillet = _safe_float(room.get("fillet_radius"), 0.0)
            points = room.get("points", [])
            if isinstance(points, list):
                for idx, pt in enumerate(points, start=1):
                    if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                        x = _safe_float(pt[0], 0.0)
                        y = _safe_float(pt[1], 0.0)
                        ws1.append([r_name, fillet, idx, x, y])
                        for col_idx in range(1, 6):
                            c = ws1.cell(row=row_counter1, column=col_idx)
                            c.border = thin_border
                            if col_idx in (2, 3, 4, 5):
                                c.alignment = Alignment(horizontal="right", vertical="center")
                            else:
                                c.alignment = Alignment(horizontal="left", vertical="center")
                        row_counter1 += 1
    else:
        # Defensive empty state
        ws1.append(["—", 0.0, 0, 0.0, 0.0])
        for col_idx in range(1, 6):
            c = ws1.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 20
    ws1.column_dimensions["C"].width = 14
    ws1.column_dimensions["D"].width = 20
    ws1.column_dimensions["E"].width = 20

    # =========================================================================
    # Sheet 2: Doors and Windows
    # =========================================================================
    ws2 = wb.create_sheet(title="Doors and Windows")

    ws2.merge_cells("A1:H1")
    title2 = ws2["A1"]
    title2.value = "Architectural Openings Schedule (Doors & Windows)"
    title2.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title2.fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    title2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 35

    headers2 = [
        "Opening ID",
        "Type (Door/Window)",
        "Host Wall Room",
        "Wall Side (Bottom/Top/Left/Right)",
        "Offset from Corner (mm)",
        "Width (mm)",
        "Height (mm)",
        "Swing Direction",
    ]
    ws2.append(headers2)
    fill2 = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    for col_idx in range(1, 9):
        cell = ws2.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill2
        cell.alignment = header_align
    ws2.row_dimensions[2].height = 25

    row_counter2 = 3
    # Check if raw openings list is available, otherwise compile from doors and windows CAD lists
    if isinstance(cad_data, dict) and "openings" in cad_data and isinstance(cad_data["openings"], list) and len(cad_data["openings"]) > 0:
        for op in cad_data["openings"]:
            if not isinstance(op, dict):
                continue
            op_id = _safe_str(op.get("id"), f"OP-{row_counter2-2}")
            op_type = _safe_str(op.get("type"), "Door")
            host_room = _safe_str(op.get("host_room"), "")
            wall_side = _safe_str(op.get("wall_side"), "Bottom")
            offset_mm = _safe_float(op.get("offset_mm"), 0.0)
            width_mm = _safe_float(op.get("width_mm"), 900.0)
            height_mm = _safe_float(op.get("height_mm"), 2100.0)
            swing = _safe_str(op.get("swing"), "")

            ws2.append([op_id, op_type, host_room, wall_side, offset_mm, width_mm, height_mm, swing])
            for col_idx in range(1, 9):
                c = ws2.cell(row=row_counter2, column=col_idx)
                c.border = thin_border
                if col_idx in (5, 6, 7):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter2 += 1
    else:
        # Extract from doors list
        doors = cad_data.get("doors", []) if isinstance(cad_data, dict) else []
        if isinstance(doors, list):
            for d in doors:
                if not isinstance(d, dict):
                    continue
                op_id = _safe_str(d.get("id"), f"D{row_counter2-2}")
                op_type = "Door"
                host_room = _safe_str(d.get("host_room"), "")
                wall_side = _safe_str(d.get("wall_side"), "Bottom")
                offset_mm = _safe_float(d.get("offset_mm"), 0.0)
                width_mm = _safe_float(d.get("width_mm"), 900.0)
                height_mm = _safe_float(d.get("height_mm"), 2100.0)
                swing = _safe_str(d.get("swing"), "Inward-Right")

                ws2.append([op_id, op_type, host_room, wall_side, offset_mm, width_mm, height_mm, swing])
                for col_idx in range(1, 9):
                    c = ws2.cell(row=row_counter2, column=col_idx)
                    c.border = thin_border
                    if col_idx in (5, 6, 7):
                        c.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        c.alignment = Alignment(horizontal="left", vertical="center")
                row_counter2 += 1

        # Extract from windows list
        windows = cad_data.get("windows", []) if isinstance(cad_data, dict) else []
        if isinstance(windows, list):
            for w in windows:
                if not isinstance(w, dict):
                    continue
                op_id = _safe_str(w.get("id"), f"W{row_counter2-2}")
                op_type = "Window"
                host_room = _safe_str(w.get("host_room"), "")
                wall_side = _safe_str(w.get("wall_side"), "Top")
                offset_mm = _safe_float(w.get("offset_mm"), 0.0)
                width_mm = _safe_float(w.get("width_mm"), 1200.0)
                height_mm = _safe_float(w.get("height_mm"), 1200.0)
                swing = ""

                ws2.append([op_id, op_type, host_room, wall_side, offset_mm, width_mm, height_mm, swing])
                for col_idx in range(1, 9):
                    c = ws2.cell(row=row_counter2, column=col_idx)
                    c.border = thin_border
                    if col_idx in (5, 6, 7):
                        c.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        c.alignment = Alignment(horizontal="left", vertical="center")
                row_counter2 += 1

    # Defensive empty state if no openings were added
    if row_counter2 == 3:
        ws2.append(["—", "—", "No openings configured", "—", 0.0, 0.0, 0.0, "—"])
        for col_idx in range(1, 9):
            c = ws2.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font

    ws2.column_dimensions["A"].width = 14
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["C"].width = 28
    ws2.column_dimensions["D"].width = 32
    ws2.column_dimensions["E"].width = 24
    ws2.column_dimensions["F"].width = 16
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 22

    # =========================================================================
    # Sheet 3: HVAC Equipment
    # =========================================================================
    ws3 = wb.create_sheet(title="HVAC Equipment")

    ws3.merge_cells("A1:G1")
    title3 = ws3["A1"]
    title3.value = "MEP HVAC Equipment & Sizing Schedule"
    title3.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title3.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
    title3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 35

    headers3 = [
        "Unit ID",
        "Room Name",
        "Unit Type (Split-IDU/ODU/Cassette)",
        "Cooling Capacity (TR)",
        "Location X (mm)",
        "Location Y (mm)",
        "Status",
    ]
    ws3.append(headers3)
    fill3 = PatternFill(start_color="8B5CF6", end_color="8B5CF6", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws3.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill3
        cell.alignment = header_align
    ws3.row_dimensions[2].height = 25

    hvac_list = cad_data.get("hvac_equipment", []) if isinstance(cad_data, dict) else []
    row_counter3 = 3
    if isinstance(hvac_list, list) and len(hvac_list) > 0:
        for eq in hvac_list:
            if not isinstance(eq, dict):
                continue
            u_id = _safe_str(eq.get("id"), f"IDU-{row_counter3-2}")
            r_name = _safe_str(eq.get("room_name"), "")
            u_type = _safe_str(eq.get("unit_type"), "Split-IDU")
            cap = _safe_float(eq.get("capacity_tr") if eq.get("capacity_tr") is not None else eq.get("cooling_capacity_tr"), 1.5)
            loc_x = _safe_float(eq.get("x") if eq.get("x") is not None else eq.get("location_x"), 0.0)
            loc_y = _safe_float(eq.get("y") if eq.get("y") is not None else eq.get("location_y"), 0.0)
            status = _safe_str(eq.get("status"), "Active")

            ws3.append([u_id, r_name, u_type, cap, loc_x, loc_y, status])
            for col_idx in range(1, 8):
                c = ws3.cell(row=row_counter3, column=col_idx)
                c.border = thin_border
                if col_idx in (4, 5, 6):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter3 += 1
    else:
        # Defensive empty state
        ws3.append(["—", "No HVAC units assigned", "—", 0.0, 0.0, 0.0, "Inactive"])
        for col_idx in range(1, 8):
            c = ws3.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font

    ws3.column_dimensions["A"].width = 16
    ws3.column_dimensions["B"].width = 28
    ws3.column_dimensions["C"].width = 32
    ws3.column_dimensions["D"].width = 24
    ws3.column_dimensions["E"].width = 20
    ws3.column_dimensions["F"].width = 20
    ws3.column_dimensions["G"].width = 16

    # =========================================================================
    # Sheet 4: Furniture Schedule (Unified Multi-Sheet Consolidation)
    # =========================================================================
    ws4 = wb.create_sheet(title="Furniture Schedule")

    ws4.merge_cells("A1:G1")
    title4 = ws4["A1"]
    title4.value = "Architectural Furniture & Clearance Schedule"
    title4.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title4.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    title4.alignment = Alignment(horizontal="center", vertical="center")
    ws4.row_dimensions[1].height = 35

    headers4 = [
        "Item ID",
        "Type / Category",
        "Host Room",
        "Dimensions (W x H mm)",
        "Coordinates (X, Y)",
        "Rotation",
        "Clearance Status",
    ]
    ws4.append(headers4)
    fill4 = PatternFill(start_color="6366F1", end_color="6366F1", fill_type="solid")
    for col_idx in range(1, 8):
        cell = ws4.cell(row=2, column=col_idx)
        cell.font = header_font
        cell.fill = fill4
        cell.alignment = header_align
    ws4.row_dimensions[2].height = 25

    furniture_list = cad_data.get("furniture", []) if isinstance(cad_data, dict) else []
    row_counter4 = 3
    if isinstance(furniture_list, list) and len(furniture_list) > 0:
        for f in furniture_list:
            if not isinstance(f, dict):
                continue
            f_id = _safe_str(f.get("id"), f"FURN-{row_counter4-2}")
            f_type = _safe_str(f.get("type"), "Furniture")
            f_cat = _safe_str(f.get("category"), "")
            if f_cat and f_cat.lower() != f_type.lower():
                type_cat = f"{f_type} / {f_cat}"
            else:
                type_cat = f_type

            f_room = _safe_str(f.get("host_room_id") or f.get("host_room"), "Unassigned")
            f_w = _safe_float(f.get("width"), 1000.0)
            f_h = _safe_float(f.get("height"), 600.0)
            dim_str = f"{f_w:.0f} x {f_h:.0f} mm"

            f_x = _safe_float(f.get("x"), 0.0)
            f_y = _safe_float(f.get("y"), 0.0)
            coord_str = f"({f_x:.1f}, {f_y:.1f})"

            f_rot = _safe_float(f.get("rotation") if f.get("rotation") is not None else f.get("rotation_deg"), 0.0)
            rot_str = f"{f_rot:.0f}°"

            f_status = _safe_str(f.get("clearance_status"), "Clear (≥200mm)")

            ws4.append([f_id, type_cat, f_room, dim_str, coord_str, rot_str, f_status])
            for col_idx in range(1, 8):
                c = ws4.cell(row=row_counter4, column=col_idx)
                c.border = thin_border
                if col_idx in (4, 5, 6):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (1, 7):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter4 += 1
    else:
        # Defensive empty state
        ws4.append(["—", "No furniture items placed in project layout", "—", "—", "—", "—", "—"])
        for col_idx in range(1, 8):
            c = ws4.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font

    ws4.column_dimensions["A"].width = 16
    ws4.column_dimensions["B"].width = 28
    ws4.column_dimensions["C"].width = 24
    ws4.column_dimensions["D"].width = 24
    ws4.column_dimensions["E"].width = 22
    ws4.column_dimensions["F"].width = 16
    ws4.column_dimensions["G"].width = 28

    # --- Sheet 5: Plumbing Schedule ---
    ws5 = wb.create_sheet(title="Plumbing Schedule")
    
    ws5.merge_cells("A1:G1")
    title5 = ws5["A1"]
    title5.value = "Plumbing & Sanitary Schedule"
    title5.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title5.fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    title5.alignment = Alignment(horizontal="center", vertical="center")
    ws5.row_dimensions[1].height = 35

    header_fill5 = PatternFill(start_color="0EA5E9", end_color="0EA5E9", fill_type="solid")
    headers5 = ["Fixture ID", "Category / Type", "Host Room", "Dimensions (W x H mm)", "Coordinates (X, Y)", "Connection Status", "Run Length / Pipe ID"]
    ws5.append(headers5)
    for col_idx, h in enumerate(headers5, start=1):
        c = ws5.cell(row=2, column=col_idx)
        c.font = header_font
        c.fill = header_fill5
        c.alignment = header_align
        c.border = thin_border
    ws5.row_dimensions[2].height = 25
        
    plumbing_fixtures = []
    plumbing_pipes = []
    if isinstance(cad_data, dict):
        plumbing_fixtures = cad_data.get("plumbing_fixtures", [])
        plumbing_pipes = cad_data.get("plumbing_pipes", [])
    
    row_counter5 = 3
    if plumbing_fixtures or plumbing_pipes:
        for p in plumbing_fixtures:
            if not isinstance(p, dict) and not hasattr(p, "id"):
                continue
            if hasattr(p, "model_dump"):
                p = p.model_dump()
                
            p_id = _safe_str(p.get("id"), f"PLM-{row_counter5-2}")
            p_type = _safe_str(p.get("type"), "Wash Basin")
            p_cat = _safe_str(p.get("category"), "Bathroom")
            type_cat = f"{p_cat} / {p_type}"
            
            p_room = _safe_str(p.get("host_room_id"), "Unassigned")
            p_w = _safe_float(p.get("width"), 600.0)
            p_h = _safe_float(p.get("height"), 500.0)
            dim_str = f"{p_w:.0f} x {p_h:.0f} mm"
            
            p_x = _safe_float(p.get("x"), 0.0)
            p_y = _safe_float(p.get("y"), 0.0)
            coord_str = f"({p_x:.1f}, {p_y:.1f})"
            
            p_status = _safe_str(p.get("connected_to"), "Unconnected")
            
            ws5.append([p_id, type_cat, p_room, dim_str, coord_str, p_status, "—"])
            for col_idx in range(1, 8):
                c = ws5.cell(row=row_counter5, column=col_idx)
                c.border = thin_border
                if col_idx in (4, 5, 7):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (1, 6):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter5 += 1
            
        for pipe in plumbing_pipes:
            if not isinstance(pipe, dict) and not hasattr(pipe, "id"):
                continue
            if hasattr(pipe, "model_dump"):
                pipe = pipe.model_dump()
            
            p_id = _safe_str(pipe.get("id"), f"PIPE-{row_counter5-2}")
            p_type = _safe_str(pipe.get("type"), "Water Pipe")
            type_cat = f"Water/Drainage lines / {p_type}"
            
            p_room = _safe_str(pipe.get("host_room_id"), "Unassigned")
            p_diam = _safe_float(pipe.get("diameter"), 110.0)
            dim_str = f"Ø {p_diam:.0f} mm"
            
            path = pipe.get("path", [])
            coord_str = "—"
            run_length = 0.0
            if isinstance(path, list) and len(path) >= 2:
                try:
                    sx, sy = path[0]
                    coord_str = f"Start: ({_safe_float(sx):.1f}, {_safe_float(sy):.1f})"
                    import math
                    for i in range(len(path) - 1):
                        x1, y1 = path[i]
                        x2, y2 = path[i+1]
                        run_length += math.sqrt((x2-x1)**2 + (y2-y1)**2)
                except (ValueError, TypeError, IndexError):
                    coord_str = "Invalid Path"
                    run_length = 0.0
            
            p_status = _safe_str(pipe.get("connected_to"), "Unconnected")
            run_length_str = f"{run_length:.1f} mm"
            
            ws5.append([p_id, type_cat, p_room, dim_str, coord_str, p_status, run_length_str])
            for col_idx in range(1, 8):
                c = ws5.cell(row=row_counter5, column=col_idx)
                c.border = thin_border
                if col_idx in (4, 5, 7):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (1, 6):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter5 += 1
    else:
        ws5.append(["—", "No plumbing fixtures or pipes in project", "—", "—", "—", "—", "—"])
        for col_idx in range(1, 8):
            c = ws5.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font

    ws5.column_dimensions["A"].width = 16
    ws5.column_dimensions["B"].width = 35
    ws5.column_dimensions["C"].width = 24
    ws5.column_dimensions["D"].width = 24
    ws5.column_dimensions["E"].width = 30
    ws5.column_dimensions["F"].width = 20
    ws5.column_dimensions["G"].width = 24

    # =========================================================================
    # Sheet 6: Electrical Schedule & Circuits
    # =========================================================================
    ws6 = wb.create_sheet(title="Electrical Schedule")

    ws6.merge_cells("A1:I1")
    title6 = ws6["A1"]
    title6.value = "Electrical Layout, Fixtures & Conduits Schedule"
    title6.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    title6.fill = PatternFill(start_color="1E1B4B", end_color="1E1B4B", fill_type="solid")
    title6.alignment = Alignment(horizontal="center", vertical="center")
    ws6.row_dimensions[1].height = 35

    header_fill6 = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
    headers6 = [
        "Component ID",
        "Type",
        "Category",
        "Host Room",
        "Coordinates (X, Y)",
        "Rotation",
        "Wattage (W)",
        "Circuit ID",
        "Mounting",
    ]
    ws6.append(headers6)
    for col_idx, h in enumerate(headers6, start=1):
        c = ws6.cell(row=2, column=col_idx)
        c.font = header_font
        c.fill = header_fill6
        c.alignment = header_align
        c.border = thin_border
    ws6.row_dimensions[2].height = 25

    el_components = cad_data.get("electrical_components", []) if isinstance(cad_data, dict) else []
    el_circuits = cad_data.get("electrical_circuits", []) if isinstance(cad_data, dict) else []
    el_routes = cad_data.get("electrical_routes", []) if isinstance(cad_data, dict) else []

    row_counter6 = 3
    if el_components:
        for comp in el_components:
            if not isinstance(comp, dict):
                continue
            c_id = _safe_str(comp.get("id"), f"EL-{row_counter6-2}")
            c_type = _safe_str(comp.get("type"), "ceiling_light")
            c_cat = _safe_str(comp.get("category"), "lighting")
            c_room = _safe_str(comp.get("host_room_name") or comp.get("host_room_id"), "Room")
            cx = _safe_float(comp.get("x"), 0.0)
            cy = _safe_float(comp.get("y"), 0.0)
            coord_str = f"({cx:.1f}, {cy:.1f})"
            rot = _safe_float(comp.get("rotation"), 0.0)
            rot_str = f"{rot:.0f}°"
            watt = _safe_float(comp.get("wattage"), 15.0)
            ckt_id = _safe_str(comp.get("circuit_id"), "CKT-1")
            mnt = _safe_str(comp.get("mounting"), "ceiling")

            ws6.append([c_id, c_type, c_cat, c_room, coord_str, rot_str, watt, ckt_id, mnt])
            for col_idx in range(1, 10):
                c = ws6.cell(row=row_counter6, column=col_idx)
                c.border = thin_border
                if col_idx in (5, 6, 7):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (1, 8, 9):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")
            row_counter6 += 1
    else:
        ws6.append(["—", "No electrical fixtures placed", "—", "—", "—", "—", 0.0, "—", "—"])
        for col_idx in range(1, 10):
            c = ws6.cell(row=3, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = empty_font
        row_counter6 += 1

    ws6.column_dimensions["A"].width = 18
    ws6.column_dimensions["B"].width = 24
    ws6.column_dimensions["C"].width = 20
    ws6.column_dimensions["D"].width = 24
    ws6.column_dimensions["E"].width = 24
    ws6.column_dimensions["F"].width = 16
    ws6.column_dimensions["G"].width = 16
    ws6.column_dimensions["H"].width = 18
    ws6.column_dimensions["I"].width = 18

    # Serialize to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()

