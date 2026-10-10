import math
import io
from typing import List, Tuple
import ezdxf
from ezdxf.enums import TextEntityAlignment
from backend.geometry import SolveResponse, WallPolygon, DoorCADGeometry, WindowCADGeometry, CadDimension


def normalize_angle(deg: float) -> float:
    """Normalizes angle in degrees to [0, 360)."""
    deg = deg % 360.0
    if deg < 0:
        deg += 360.0
    return round(deg, 2)


def get_arc_angles(hinge: List[float], p1: List[float], p2: List[float]) -> Tuple[float, float]:
    """
    Computes AutoCAD start_angle and end_angle (in degrees) for a 90-degree swing arc around a hinge.
    AutoCAD ARC entities are drawn counter-clockwise from start_angle to end_angle.
    """
    hx, hy = hinge
    ang1 = normalize_angle(math.degrees(math.atan2(p1[1] - hy, p1[0] - hx)))
    ang2 = normalize_angle(math.degrees(math.atan2(p2[1] - hy, p2[0] - hx)))

    # Determine counter-clockwise sweep direction
    diff = (ang2 - ang1) % 360.0
    if diff <= 180.0:
        start_angle = ang1
        end_angle = ang2
    else:
        start_angle = ang2
        end_angle = ang1

    return start_angle, end_angle


def export_floorplan_to_dxf(solve_data: SolveResponse) -> bytes:
    """
    Generates a professional AutoCAD R2018 DXF drawing file conforming to AIA CAD Layer Standards.
    
    Layers:
      - A-WALL-EXTR: 230 mm Exterior Walls (Color: White/Index 7, Lineweight: 0.50 mm, closed LWPOLYLINE)
      - A-WALL-INTR: 115 mm Interior Partition Walls (Color: Cyan/Index 4, Lineweight: 0.35 mm, closed LWPOLYLINE)
      - A-DOOR: Doors 90° Swing Arcs & Leaf Lines (Color: Yellow/Index 2, Lineweight: 0.25 mm)
      - A-GLAZ: Window Sill, Glass Pane & Frame Lines (Color: Green/Index 3, Lineweight: 0.25 mm)
      - A-AREA-TEXT: Room Labels & Carpet Area MTEXT (Color: Green/Index 3, Height: 180 mm)
      - A-DIMS: CAD Dimension Lines, Extension Lines & Text (Color: Red/Index 1, Height: 120 mm)
    """
    # Initialize R2018 DXF document
    doc = ezdxf.new("R2018", setup=True)

    # Metric Header Settings
    doc.header["$INSUNITS"] = 4      # 4 = Millimeters
    doc.header["$MEASUREMENT"] = 1   # 1 = Metric

    # Setup AIA Layer Definitions
    layers = doc.layers
    layers.add("LAYER_ROOMS", color=3, lineweight=18)
    layers.add("LAYER_WALLS", color=7, lineweight=50)
    layers.add("LAYER_OPENINGS", color=2, lineweight=25)
    layers.add("LAYER_MEP", color=6, lineweight=35)
    layers.add("LAYER_FURNITURE", color=5, lineweight=20)

    msp = doc.modelspace()

    # 1. Export Wall Polygons (A-WALL-EXTR & A-WALL-INTR)
    comb_walls = (getattr(solve_data, "combined_wall_polygons", None) or 
                  [w for w in solve_data.wall_polygons if w.wall_type == "combined"])
    walls_to_export = comb_walls if len(comb_walls) > 0 else solve_data.wall_polygons
    for wall in walls_to_export:
        # Outer boundary ring
        if wall.outer_polygon and len(wall.outer_polygon) >= 3:
            pts = [(round(p[0], 2), round(p[1], 2)) for p in wall.outer_polygon]
            msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": "LAYER_WALLS"})

        # Inner room hole rings
        for hole in wall.inner_polygons:
            if hole and len(hole) >= 3:
                hpts = [(round(p[0], 2), round(p[1], 2)) for p in hole]
                msp.add_lwpolyline(hpts, close=True, dxfattribs={"layer": "LAYER_WALLS"})

    # 2. Export Doors (A-DOOR)
    for door in solve_data.doors:
        # Door Leaf Line
        msp.add_line(
            (round(door.hinge[0], 2), round(door.hinge[1], 2)),
            (round(door.leaf_end[0], 2), round(door.leaf_end[1], 2)),
            dxfattribs={"layer": "LAYER_OPENINGS"}
        )

        # Hinge & Jambs
        for j in door.jambs:
            msp.add_line(
                (round(j[0], 2), round(j[1], 2)),
                (round(j[2], 2), round(j[3], 2)),
                dxfattribs={"layer": "LAYER_OPENINGS"}
            )

        # 90-Degree Door Swing Arc
        # Calculate closed position opposite to hinge along wall line
        start_angle, end_angle = get_arc_angles(door.hinge, door.leaf_end, [door.label_x, door.label_y])
        msp.add_arc(
            center=(round(door.hinge[0], 2), round(door.hinge[1], 2)),
            radius=round(door.width_mm, 2),
            start_angle=start_angle,
            end_angle=end_angle,
            dxfattribs={"layer": "LAYER_OPENINGS"}
        )

        # Door Label Text
        door_dim_str = f"{int(door.width_mm)}x{int(door.height_mm)}mm" if getattr(door, "height_mm", None) else f"{int(door.width_mm)}mm"
        msp.add_mtext(
            f"{door.id} [{door_dim_str}]",
            dxfattribs={
                "layer": "LAYER_OPENINGS",
                "char_height": 100.0,
                "insert": (round(door.label_x, 2), round(door.label_y, 2)),
                "attachment_point": 5  # 5 = Middle Center
            }
        )

    # 3. Export Windows (A-GLAZ)
    for win in solve_data.windows:
        # 3 Parallel Lines (sill, glass, frame)
        for line in win.lines:
            msp.add_line(
                (round(line[0], 2), round(line[1], 2)),
                (round(line[2], 2), round(line[3], 2)),
                dxfattribs={"layer": "LAYER_OPENINGS"}
            )

        # Window Jambs
        for j in win.jambs:
            msp.add_line(
                (round(j[0], 2), round(j[1], 2)),
                (round(j[2], 2), round(j[3], 2)),
                dxfattribs={"layer": "LAYER_OPENINGS"}
            )

        # Window Label Text
        win_dim_str = f"{int(win.width_mm)}x{int(win.height_mm)}mm" if getattr(win, "height_mm", None) else f"{int(win.width_mm)}mm"
        msp.add_mtext(
            f"{win.id} [{win_dim_str}]",
            dxfattribs={
                "layer": "LAYER_OPENINGS",
                "char_height": 100.0,
                "insert": (round(win.label_x, 2), round(win.label_y, 2)),
                "attachment_point": 5
            }
        )

    # 4. Export Room Name & Area Labels (LAYER_ROOMS)
    for room in solve_data.rooms:
        # Carpet Polygon
        if room.points and len(room.points) >= 3:
            rpts = [(round(p[0], 2), round(p[1], 2)) for p in room.points]
            msp.add_lwpolyline(rpts, close=True, dxfattribs={"layer": "LAYER_ROOMS"})

        cx, cy = room.centroid
        text_content = f"{room.name}\n{room.carpet_area_sqm:.1f} sq.m / {room.carpet_area_sqft:.1f} sq.ft"
        msp.add_mtext(
            text_content,
            dxfattribs={
                "layer": "LAYER_ROOMS",
                "char_height": 180.0,
                "insert": (round(cx, 2), round(cy, 2)),
                "attachment_point": 5
            }
        )

    # 5. Export Parametric CAD Dimensions (A-DIMS)
    for dim in solve_data.dimensions:
        # Main Dimension Line
        msp.add_line(
            (round(dim.dim_x1, 2), round(dim.dim_y1, 2)),
            (round(dim.dim_x2, 2), round(dim.dim_y2, 2)),
            dxfattribs={"layer": "LAYER_ROOMS"}
        )
        # Extension Line 1
        msp.add_line(
            (round(dim.ext1_x1, 2), round(dim.ext1_y1, 2)),
            (round(dim.ext1_x2, 2), round(dim.ext1_y2, 2)),
            dxfattribs={"layer": "LAYER_ROOMS"}
        )
        # Extension Line 2
        msp.add_line(
            (round(dim.ext2_x1, 2), round(dim.ext2_y1, 2)),
            (round(dim.ext2_x2, 2), round(dim.ext2_y2, 2)),
            dxfattribs={"layer": "LAYER_ROOMS"}
        )
        # 45-Degree Slash Ticks
        msp.add_line(
            (round(dim.tick1_x1, 2), round(dim.tick1_y1, 2)),
            (round(dim.tick1_x2, 2), round(dim.tick1_y2, 2)),
            dxfattribs={"layer": "LAYER_ROOMS"}
        )
        msp.add_line(
            (round(dim.tick2_x1, 2), round(dim.tick2_y1, 2)),
            (round(dim.tick2_x2, 2), round(dim.tick2_y2, 2)),
            dxfattribs={"layer": "LAYER_ROOMS"}
        )
        # Dimension Text Label
        msp.add_mtext(
            dim.label,
            dxfattribs={
                "layer": "LAYER_ROOMS",
                "char_height": 120.0,
                "insert": (round(dim.label_x, 2), round(dim.label_y, 2)),
                "attachment_point": 5
            }
        )

    # 6. Export HVAC MEP Equipment (M-HVAC-EQPM & M-HVAC-TEXT)
    for eq in (solve_data.hvac_equipment or []):
        hw, hh = eq.width / 2.0, eq.height / 2.0
        x1, y1 = eq.x - hw, eq.y - hh
        x2, y2 = eq.x + hw, eq.y + hh

        # Equipment Boundary Envelope
        box_pts = [
            (round(x1, 2), round(y1, 2)),
            (round(x2, 2), round(y1, 2)),
            (round(x2, 2), round(y2, 2)),
            (round(x1, 2), round(y2, 2))
        ]
        msp.add_lwpolyline(box_pts, close=True, dxfattribs={"layer": "LAYER_MEP"})

        if "odu" in eq.unit_type.lower():
            # Condenser Fan Circle
            fan_radius = min(hw, hh) * 0.75
            msp.add_circle(
                center=(round(eq.x, 2), round(eq.y, 2)),
                radius=round(fan_radius, 2),
                dxfattribs={"layer": "LAYER_MEP"}
            )
        else:
            # High-Wall / Cassette Louver Lines
            louver_spacing = eq.height / 4.0
            for l_idx in range(1, 3):
                ly = y1 + l_idx * louver_spacing
                msp.add_line(
                    (round(x1 + 50.0, 2), round(ly, 2)),
                    (round(x2 - 50.0, 2), round(ly, 2)),
                    dxfattribs={"layer": "LAYER_MEP"}
                )

        # Equipment Tag & Capacity MTEXT
        tag_text = f"{eq.id}\n{eq.capacity_tr:.1f} TR / {int(eq.cfm)} CFM"
        msp.add_mtext(
            tag_text,
            dxfattribs={
                "layer": "LAYER_MEP",
                "char_height": 100.0,
                "insert": (round(eq.label_x, 2), round(eq.label_y, 2)),
                "attachment_point": 5
            }
        )

    # 7. Export HVAC Refrigerant Piping (M-HVAC-PIPE & M-HVAC-TEXT)
    for pipe in (solve_data.hvac_pipes or []):
        if len(pipe.path_points) >= 2:
            pts = [(round(p[0], 2), round(p[1], 2)) for p in pipe.path_points]
            msp.add_lwpolyline(pts, close=False, dxfattribs={"layer": "LAYER_MEP"})

            # Pipe Callout MTEXT
            mid_idx = len(pts) // 2
            mid_pt = pts[mid_idx]
            callout = f"{pipe.pipe_id} [{pipe.liquid_size} Liq + {pipe.suction_size} Suc]\nL={pipe.total_length_mm:.0f}mm"
            msp.add_mtext(
                callout,
                dxfattribs={
                    "layer": "LAYER_MEP",
                    "char_height": 90.0,
                    "insert": (round(mid_pt[0] + 150.0, 2), round(mid_pt[1] + 150.0, 2)),
                    "attachment_point": 5
                }
            )

    # 8. Export Furniture (Multi-Category: Beds, Sofas, Wardrobes, Desks, Chairs, Tables)
    for furn in (getattr(solve_data, "furniture", None) or []):
        try:
            fx = float(furn.x)
            fy = float(furn.y)
            fw = float(furn.width)
            fh = float(furn.height)
            bx1 = fx - fw / 2.0
            by1 = fy - fh / 2.0
            bx2 = fx + fw / 2.0
            by2 = fy + fh / 2.0

            furn_type = (furn.type or "").lower()
            outer_pts = [(bx1, by1), (bx2, by1), (bx2, by2), (bx1, by2)]

            # Outer boundary perimeter for all furniture items
            msp.add_lwpolyline(
                [(round(p[0], 2), round(p[1], 2)) for p in outer_pts],
                close=True,
                dxfattribs={"layer": "LAYER_FURNITURE"}
            )

            if "wardrobe" in furn_type or "closet" in furn_type:
                # Wardrobe: Clothes hanging rail dashed line & dual-door center seam
                mid_x = fx
                msp.add_line(
                    (round(mid_x, 2), round(by1, 2)),
                    (round(mid_x, 2), round(by2, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
                rail_y = fy
                msp.add_line(
                    (round(bx1 + 50.0, 2), round(rail_y, 2)),
                    (round(bx2 - 50.0, 2), round(rail_y, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
            elif "sofa" in furn_type or "couch" in furn_type:
                # Sofa: Backrest strip, armrests, and cushion split line
                back_h = min(180.0, fh * 0.25)
                msp.add_line(
                    (round(bx1, 2), round(by2 - back_h, 2)),
                    (round(bx2, 2), round(by2 - back_h, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
                arm_w = min(150.0, fw * 0.12)
                msp.add_line(
                    (round(bx1 + arm_w, 2), round(by1, 2)),
                    (round(bx1 + arm_w, 2), round(by2 - back_h, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
                msp.add_line(
                    (round(bx2 - arm_w, 2), round(by1, 2)),
                    (round(bx2 - arm_w, 2), round(by2 - back_h, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
                # Cushion seam
                msp.add_line(
                    (round(fx, 2), round(by1, 2)),
                    (round(fx, 2), round(by2 - back_h, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
            elif "desk" in furn_type or "study" in furn_type:
                # Desk: Side drawer pedestal
                ped_w = min(400.0, fw * 0.3)
                msp.add_line(
                    (round(bx2 - ped_w, 2), round(by1, 2)),
                    (round(bx2 - ped_w, 2), round(by2, 2)),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
                # Cable grommet circle
                msp.add_circle(
                    center=(round(bx1 + 100.0, 2), round(by2 - 100.0, 2)),
                    radius=25.0,
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
            elif "chair" in furn_type:
                # Chair: Circular seat
                radius = min(fw, fh) * 0.4
                msp.add_circle(
                    center=(round(fx, 2), round(fy, 2)),
                    radius=round(radius, 2),
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
            elif "table" in furn_type:
                # Table: Decorative inner inset border
                inset = min(60.0, min(fw, fh) * 0.1)
                inner_pts = [
                    (bx1 + inset, by1 + inset),
                    (bx2 - inset, by1 + inset),
                    (bx2 - inset, by2 - inset),
                    (bx1 + inset, by2 - inset)
                ]
                msp.add_lwpolyline(
                    [(round(p[0], 2), round(p[1], 2)) for p in inner_pts],
                    close=True,
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )
            else:
                # Bed / Default: Headboard panel
                hb_h = min(150.0, fh * 0.1)
                hb_pts = [(bx1, by2 - hb_h), (bx2, by2 - hb_h), (bx2, by2), (bx1, by2)]
                msp.add_lwpolyline(
                    [(round(p[0], 2), round(p[1], 2)) for p in hb_pts],
                    close=True,
                    dxfattribs={"layer": "LAYER_FURNITURE"}
                )

            # Label Text
            item_id = getattr(furn, "id", None) or getattr(furn, "type", "FURN")
            type_name = getattr(furn, "type", "Furniture")
            label_text = f"{item_id} [{type_name}] ({int(fw)}x{int(fh)})"
            msp.add_text(
                label_text,
                dxfattribs={
                    "layer": "LAYER_FURNITURE",
                    "height": 90.0,
                    "insert": (round(fx, 2), round(fy, 2)),
                }
            ).set_placement((round(fx, 2), round(fy, 2)), align=TextEntityAlignment.MIDDLE_CENTER)
        except Exception as e:
            print(f"Warning: Failed to export furniture item {furn}: {e}")

    # Serialize DXF to bytes
    out_stream = io.StringIO()
    doc.write(out_stream)
    return out_stream.getvalue().encode("utf-8")

