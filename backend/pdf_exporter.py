import io
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    Flowable,
    PageBreak
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw total page numbers
    along with running header and footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Footer
        footer_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(A4[0] - 36, 24, footer_text)
        self.drawString(36, 24, "Parametric 2D CAD Engine • Architectural BOQ & MEP Engineering Report")

        # Footer rule
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 36, A4[0] - 36, 36)

        self.restoreState()


class FloorplanBlueprintFlowable(Flowable):
    """
    Renders an architectural 2D vector blueprint directly onto the ReportLab canvas.
    Features:
    - Double architectural border
    - Scaled room polygon outlines with room names and carpet areas
    - Witness dimension lines (overall width & depth in meters/feet)
    - Doors with hinge leaves and 90° swing arcs
    - Window frames and openings
    - Compass North Arrow
    - Title Block with scale, revision, and project metadata
    - Architectural Legend
    """
    def __init__(
        self,
        cad_data: Dict[str, Any],
        project_name: str = "Architectural Floorplan",
        width: float = 523.0,
        height: float = 440.0,
    ):
        super().__init__()
        self.cad_data = cad_data or {}
        self.project_name = project_name
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()

        w = self.width
        h = self.height

        # 1. Blueprint Background & Framing
        c.setFillColor(colors.HexColor("#FFFFFF"))
        c.rect(0, 0, w, h, fill=1, stroke=0)

        # Architectural Double Border
        c.setStrokeColor(colors.HexColor("#0F172A"))
        c.setLineWidth(1.5)
        c.rect(2, 2, w - 4, h - 4, fill=0, stroke=1)
        c.setLineWidth(0.5)
        c.rect(5, 5, w - 10, h - 10, fill=0, stroke=1)

        # 2. Extract Data Collections
        rooms = self.cad_data.get("rooms", [])
        doors = self.cad_data.get("doors", [])
        windows = self.cad_data.get("windows", [])

        all_x = []
        all_y = []
        for r in rooms:
            pts = r.get("filleted_points") or r.get("points") or []
            for pt in pts:
                if len(pt) >= 2:
                    all_x.append(float(pt[0]))
                    all_y.append(float(pt[1]))

        # Title Block dimensions in bottom-right corner
        tb_w = 205.0
        tb_h = 56.0
        tb_x = w - 5 - tb_w
        tb_y = 5.0

        # Viewport margins
        margin_left = 28.0
        margin_bottom = tb_h + 16.0
        margin_right = 16.0
        margin_top = 28.0

        vw_x = margin_left
        vw_y = margin_bottom
        vw_w = w - margin_left - margin_right
        vw_h = h - margin_bottom - margin_top

        if all_x and all_y:
            min_x, max_x = min(all_x), max(all_x)
            min_y, max_y = min(all_y), max(all_y)
            cad_w = max(1.0, max_x - min_x)
            cad_h = max(1.0, max_y - min_y)

            pad_x = cad_w * 0.08
            pad_y = cad_h * 0.08
            scale_x = vw_w / (cad_w + 2 * pad_x)
            scale_y = vw_h / (cad_h + 2 * pad_y)
            scale = min(scale_x, scale_y)

            cx = (min_x + max_x) / 2.0
            cy = (min_y + max_y) / 2.0
            scr_cx = vw_x + vw_w / 2.0
            scr_cy = vw_y + vw_h / 2.0

            def to_scr(px, py):
                return (
                    scr_cx + (px - cx) * scale,
                    scr_cy + (py - cy) * scale
                )

            room_palette = [
                colors.HexColor("#F8FAFC"),
                colors.HexColor("#F1F5F9"),
                colors.HexColor("#EFF6FF"),
                colors.HexColor("#F0FDF4")
            ]

            # Draw Room Polygons
            for idx, r in enumerate(rooms):
                pts = r.get("filleted_points") or r.get("points") or []
                if len(pts) >= 3:
                    p = c.beginPath()
                    start_sx, start_sy = to_scr(float(pts[0][0]), float(pts[0][1]))
                    p.moveTo(start_sx, start_sy)
                    for pt in pts[1:]:
                        sx, sy = to_scr(float(pt[0]), float(pt[1]))
                        p.lineTo(sx, sy)
                    p.close()

                    c.setFillColor(room_palette[idx % len(room_palette)])
                    c.setStrokeColor(colors.HexColor("#334155"))
                    c.setLineWidth(1.2)
                    c.drawPath(p, fill=1, stroke=1)

                    # Centroid Label
                    r_xs = [float(pt[0]) for pt in pts]
                    r_ys = [float(pt[1]) for pt in pts]
                    rc_x = sum(r_xs) / len(r_xs)
                    rc_y = sum(r_ys) / len(r_ys)
                    lsx, lsy = to_scr(rc_x, rc_y)

                    r_name = str(r.get("name", f"Room {idx+1}")).upper()
                    area_sqm = float(r.get("carpet_area_sqm", 0.0))
                    area_sqft = float(r.get("carpet_area_sqft", 0.0))

                    c.setFont("Helvetica-Bold", 7.5)
                    c.setFillColor(colors.HexColor("#0F172A"))
                    c.drawCentredString(lsx, lsy + 3, r_name)

                    c.setFont("Helvetica", 6.0)
                    c.setFillColor(colors.HexColor("#64748B"))
                    c.drawCentredString(lsx, lsy - 7, f"{area_sqm:.1f} m² ({area_sqft:.0f} sq.ft)")

            # Draw Windows
            c.setStrokeColor(colors.HexColor("#0284C7"))
            c.setLineWidth(1.2)
            for win in windows:
                lines = win.get("lines", [])
                for line in lines:
                    if len(line) >= 4:
                        x1, y1 = to_scr(float(line[0]), float(line[1]))
                        x2, y2 = to_scr(float(line[2]), float(line[3]))
                        c.line(x1, y1, x2, y2)
                lx = win.get("label_x")
                ly = win.get("label_y")
                wid = win.get("id", "W")
                if lx is not None and ly is not None:
                    sx, sy = to_scr(float(lx), float(ly))
                    c.setFont("Helvetica-Bold", 5.5)
                    c.setFillColor(colors.HexColor("#0284C7"))
                    c.drawCentredString(sx, sy, wid)

            # Draw Doors
            for d in doors:
                hinge = d.get("hinge")
                leaf_end = d.get("leaf_end")
                radius = float(d.get("arc_radius", d.get("width_mm", 900.0)))
                did = d.get("id", "D")

                if hinge and leaf_end:
                    hx, hy = to_scr(float(hinge[0]), float(hinge[1]))
                    lx, ly = to_scr(float(leaf_end[0]), float(leaf_end[1]))

                    # Leaf line
                    c.setStrokeColor(colors.HexColor("#059669"))
                    c.setLineWidth(1.0)
                    c.line(hx, hy, lx, ly)

                    # Swing arc
                    scr_r = radius * scale
                    c.setStrokeColor(colors.HexColor("#10B981"))
                    c.setLineWidth(0.75)
                    c.arc(hx - scr_r, hy - scr_r, hx + scr_r, hy + scr_r)

                dlx = d.get("label_x")
                dly = d.get("label_y")
                if dlx is not None and dly is not None:
                    sx, sy = to_scr(float(dlx), float(dly))
                    c.setFont("Helvetica-Bold", 5.5)
                    c.setFillColor(colors.HexColor("#059669"))
                    c.drawCentredString(sx, sy, did)

            # Draw Witness Dimension Lines
            dim_y = margin_bottom - 6.0
            dim_x1, _ = to_scr(min_x, min_y)
            dim_x2, _ = to_scr(max_x, min_y)
            c.setStrokeColor(colors.HexColor("#94A3B8"))
            c.setLineWidth(0.6)
            c.line(dim_x1, dim_y - 3, dim_x1, dim_y + 3)
            c.line(dim_x2, dim_y - 3, dim_x2, dim_y + 3)
            c.line(dim_x1, dim_y, dim_x2, dim_y)
            width_m = cad_w / 1000.0
            width_ft = width_m * 3.28084
            c.setFont("Helvetica-Bold", 6.0)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawCentredString((dim_x1 + dim_x2) / 2.0, dim_y + 2, f"↔ {width_m:.2f} m ({width_ft:.1f} ft)")

        else:
            c.setFont("Helvetica", 10)
            c.setFillColor(colors.HexColor("#94A3B8"))
            c.drawCentredString(w / 2.0, h / 2.0, "No architectural room polygons available.")

        # 3. North Arrow (Top-Right)
        na_x = w - 24.0
        na_y = h - 22.0
        c.setStrokeColor(colors.HexColor("#0F172A"))
        c.setLineWidth(0.8)
        c.circle(na_x, na_y, 9, fill=0, stroke=1)
        c.setFillColor(colors.HexColor("#0F172A"))
        p_arrow = c.beginPath()
        p_arrow.moveTo(na_x, na_y + 7)
        p_arrow.lineTo(na_x - 3, na_y - 2)
        p_arrow.lineTo(na_x + 3, na_y - 2)
        p_arrow.close()
        c.drawPath(p_arrow, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 6.0)
        c.drawCentredString(na_x, na_y + 10, "N")

        # 4. Architectural Legend (Top-Left)
        leg_x = 12.0
        leg_y = h - 18.0
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(colors.HexColor("#0F172A"))
        c.drawString(leg_x, leg_y, "ARCHITECTURAL 2D BLUEPRINT")

        items = [
            ("Wall / Room", colors.HexColor("#334155")),
            ("Door Swing", colors.HexColor("#059669")),
            ("Window", colors.HexColor("#0284C7"))
        ]
        curr_lx = leg_x + 115.0
        for label, col in items:
            c.setStrokeColor(col)
            c.setLineWidth(1.2)
            c.line(curr_lx, leg_y + 2, curr_lx + 10, leg_y + 2)
            c.setFont("Helvetica", 5.5)
            c.setFillColor(colors.HexColor("#64748B"))
            c.drawString(curr_lx + 13, leg_y, label)
            curr_lx += 65.0

        # 5. Title Block (Bottom-Right)
        c.setFillColor(colors.HexColor("#F8FAFC"))
        c.setStrokeColor(colors.HexColor("#0F172A"))
        c.setLineWidth(0.75)
        c.rect(tb_x, tb_y, tb_w, tb_h, fill=1, stroke=1)

        c.line(tb_x, tb_y + 36, tb_x + tb_w, tb_y + 36)
        c.line(tb_x, tb_y + 18, tb_x + tb_w, tb_y + 18)
        c.line(tb_x + 102, tb_y, tb_x + 102, tb_y + 36)

        c.setFont("Helvetica-Bold", 6.0)
        c.setFillColor(colors.HexColor("#0284C7"))
        c.drawString(tb_x + 6, tb_y + 45, "PROJECT BLUEPRINT")

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(colors.HexColor("#0F172A"))
        proj_display = self.project_name[:26] if len(self.project_name) > 26 else self.project_name
        c.drawString(tb_x + 6, tb_y + 38, proj_display)

        c.setFont("Helvetica", 5.5)
        c.setFillColor(colors.HexColor("#64748B"))
        c.drawString(tb_x + 6, tb_y + 24, "SCALE: 1:100 (FIT)")
        c.drawString(tb_x + 108, tb_y + 24, "DISCIPLINE: ARCH 2D")

        curr_date = datetime.now(timezone.utc).strftime("%d-%b-%Y")
        c.drawString(tb_x + 6, tb_y + 8, f"DATE: {curr_date}")
        c.drawString(tb_x + 108, tb_y + 8, "REV: 01 (FINAL)")

        c.restoreState()


def generate_project_boq_pdf(project_name: str, created_at: Optional[str], cad_data: Dict[str, Any]) -> bytes:
    """
    Generates a professional Bill of Quantities (BOQ) and Project Summary PDF report.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")    # Deep Slate
    c_accent = colors.HexColor("#0284C7")     # Sky Blue
    c_hvac = colors.HexColor("#7C3AED")       # Purple
    c_success = colors.HexColor("#059669")    # Emerald
    c_dark_text = colors.HexColor("#1E293B")
    c_light_bg = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#E2E8F0")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748B")
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6
    )
    subsection_heading = ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=c_accent,
        spaceBefore=8,
        spaceAfter=4
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=c_dark_text
    )
    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=c_dark_text
    )
    cell_header = ParagraphStyle(
        'TableHeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    story = []

    # 1. HEADER BANNER BLOCK
    formatted_date = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    if created_at:
        try:
            d = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            formatted_date = d.strftime('%B %d, %Y at %H:%M UTC')
        except Exception:
            pass

    header_table_data = [
        [
            Paragraph(f"<b>{project_name}</b>", title_style),
            Paragraph(f"<b>ENGINEERING REPORT & BOQ</b><br/><font color='#64748B'>Report Generated: {formatted_date}</font>", ParagraphStyle('RightMeta', parent=subtitle_style, alignment=2))
        ],
        [
            Paragraph("Automated Parametric Architectural Floorplan, Openings Schedule & MEP Load Sizing", subtitle_style),
            Paragraph(f"Project ID: {cad_data.get('project_id', 'N/A')}", ParagraphStyle('RightId', parent=subtitle_style, alignment=2))
        ]
    ]
    header_table = Table(header_table_data, colWidths=[320, 203])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceBefore=2, spaceAfter=10))

    # Page 1: Architectural Vector Blueprint Drawing
    if cad_data and cad_data.get("rooms"):
        story.append(FloorplanBlueprintFlowable(cad_data=cad_data, project_name=project_name, width=523.0, height=440.0))
        story.append(PageBreak())

    # Extract Data Collections
    rooms = cad_data.get("rooms", [])
    doors = cad_data.get("doors", [])
    windows = cad_data.get("windows", [])
    hvac_loads = cad_data.get("hvac_loads", [])
    hvac_equipment = cad_data.get("hvac_equipment", [])
    hvac_pipes = cad_data.get("hvac_pipes", [])

    total_carpet_sqm = sum(r.get("carpet_area_sqm", 0.0) for r in rooms)
    total_carpet_sqft = sum(r.get("carpet_area_sqft", 0.0) for r in rooms)
    total_openings = len(doors) + len(windows)
    total_tonnage = sum(l.get("cooling_load_tr", 0.0) for l in hvac_loads)
    total_cfm = sum(l.get("airflow_cfm", 0.0) for l in hvac_loads)
    total_pipe_len_m = sum(p.get("total_length_mm", 0.0) for p in hvac_pipes) / 1000.0

    # 2. EXECUTIVE KPI CALLOUT BLOCK
    kpi_data = [
        [
            Paragraph(f"<b>{len(rooms)}</b><br/><font color='#64748B' size=7>TOTAL ROOMS</font>", ParagraphStyle('KPI', alignment=1, fontSize=13, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph(f"<b>{total_carpet_sqm:.1f} m²</b><br/><font color='#64748B' size=7>{total_carpet_sqft:.0f} SQ.FT CARPET</font>", ParagraphStyle('KPI', alignment=1, fontSize=13, fontName='Helvetica-Bold', textColor=c_accent)),
            Paragraph(f"<b>{total_openings}</b><br/><font color='#64748B' size=7>{len(doors)} DOORS / {len(windows)} WIN</font>", ParagraphStyle('KPI', alignment=1, fontSize=13, fontName='Helvetica-Bold', textColor=c_success)),
            Paragraph(f"<b>{total_tonnage:.1f} TR</b><br/><font color='#64748B' size=7>{int(total_cfm)} CFM COOLING</font>", ParagraphStyle('KPI', alignment=1, fontSize=13, fontName='Helvetica-Bold', textColor=c_hvac)),
            Paragraph(f"<b>{total_pipe_len_m:.1f} m</b><br/><font color='#64748B' size=7>REFRIGERANT RUNS</font>", ParagraphStyle('KPI', alignment=1, fontSize=13, fontName='Helvetica-Bold', textColor=colors.HexColor("#D97706")))
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[104, 105, 104, 105, 105])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_light_bg),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # 3. ROOM SPATIAL DATA SCHEDULE
    story.append(Paragraph("1. Room Spatial Data Summary", section_heading))
    room_table_rows = [
        [
            Paragraph("Room Name", cell_header),
            Paragraph("Vertices", cell_header),
            Paragraph("Carpet Area (m²)", cell_header),
            Paragraph("Carpet Area (sq.ft)", cell_header),
            Paragraph("Wall Thickness", cell_header)
        ]
    ]

    for idx, r in enumerate(rooms):
        bg_row = c_light_bg if idx % 2 == 1 else colors.white
        room_table_rows.append([
            Paragraph(r.get("name", f"Room {idx+1}"), cell_bold),
            Paragraph(str(r.get("vertex_count", len(r.get("points", [])))), cell_style),
            Paragraph(f"{r.get('carpet_area_sqm', 0.0):.2f} m²", cell_style),
            Paragraph(f"{r.get('carpet_area_sqft', 0.0):.1f} sq.ft", cell_style),
            Paragraph(f"{r.get('wall_thickness_mm', 230):.0f} mm", cell_style)
        ])

    # Summary Row
    room_table_rows.append([
        Paragraph("<b>Total Floor Carpet Area</b>", cell_bold),
        Paragraph(f"<b>{len(rooms)} Rooms</b>", cell_bold),
        Paragraph(f"<b>{total_carpet_sqm:.2f} m²</b>", cell_bold),
        Paragraph(f"<b>{total_carpet_sqft:.1f} sq.ft</b>", cell_bold),
        Paragraph("—", cell_style)
    ])

    room_table = Table(room_table_rows, colWidths=[150, 70, 100, 100, 103])
    room_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E0F2FE")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, c_accent),
    ]))
    story.append(room_table)
    story.append(Spacer(1, 10))

    # 4. ARCHITECTURAL OPENINGS SCHEDULE
    story.append(Paragraph("2. Architectural Openings Schedule (Doors & Windows)", section_heading))
    all_openings = [
        {**d, "kind": "Door"} for d in doors
    ] + [
        {**w, "kind": "Window"} for w in windows
    ]

    if not all_openings:
        story.append(Paragraph("<i>No doors or windows registered in active plan.</i>", subtitle_style))
    else:
        opening_rows = [
            [
                Paragraph("ID", cell_header),
                Paragraph("Type", cell_header),
                Paragraph("Host Room", cell_header),
                Paragraph("Side", cell_header),
                Paragraph("Offset (mm)", cell_header),
                Paragraph("Width (mm)", cell_header),
                Paragraph("Height (mm)", cell_header),
                Paragraph("Swing / Specs", cell_header)
            ]
        ]
        for idx, op in enumerate(all_openings):
            is_door = op.get("kind") == "Door"
            opening_rows.append([
                Paragraph(op.get("id", f"OP-{idx+1}"), cell_bold),
                Paragraph(f"<font color='{'#D97706' if is_door else '#0284C7'}'><b>{op.get('kind')}</b></font>", cell_style),
                Paragraph(op.get("host_room", "—"), cell_style),
                Paragraph(op.get("wall_side", "—"), cell_style),
                Paragraph(f"{op.get('offset_mm', 1000):.0f} mm", cell_style),
                Paragraph(f"{op.get('width_mm', 900):.0f} mm", cell_style),
                Paragraph(f"{op.get('height_mm', 2100 if is_door else 1200):.0f} mm", cell_style),
                Paragraph(op.get("swing", "Fixed" if not is_door else "Inward-Right"), cell_style)
            ])

        openings_table = Table(opening_rows, colWidths=[45, 55, 110, 55, 65, 65, 65, 63])
        openings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), c_primary),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_light_bg]),
        ]))
        story.append(openings_table)

    story.append(Spacer(1, 10))

    # 5. HVAC MEP ENGINEERING BOQ
    hvac_block = []
    hvac_block.append(Paragraph("3. HVAC MEP Engineering Bill of Quantities (BOQ)", section_heading))

    # Subsection 3A: Room Loads
    hvac_block.append(Paragraph("3.1 Room Cooling Load Sizing Summary", subsection_heading))
    load_rows = [
        [
            Paragraph("Room Name", cell_header),
            Paragraph("Conditioned", cell_header),
            Paragraph("Carpet Area", cell_header),
            Paragraph("Required (TR)", cell_header),
            Paragraph("Airflow (CFM)", cell_header),
            Paragraph("Liquid Line", cell_header),
            Paragraph("Suction Line", cell_header)
        ]
    ]
    for idx, ld in enumerate(hvac_loads):
        is_cond = ld.get("is_conditioned", False)
        load_rows.append([
            Paragraph(ld.get("room_name", f"Room {idx+1}"), cell_bold),
            Paragraph("<font color='#059669'><b>YES</b></font>" if is_cond else "<font color='#64748B'>NO</font>", cell_style),
            Paragraph(f"{ld.get('carpet_area_sqm', 0.0):.1f} m²", cell_style),
            Paragraph(f"<b>{ld.get('cooling_load_tr', 0.0):.1f} TR</b>" if is_cond else "—", cell_style),
            Paragraph(f"{ld.get('airflow_cfm', 0.0):.0f} CFM" if is_cond else "—", cell_style),
            Paragraph(ld.get("liquid_line_inch", "—"), cell_style),
            Paragraph(ld.get("suction_line_inch", "—"), cell_style)
        ])
    load_rows.append([
        Paragraph("<b>Total Sizing</b>", cell_bold),
        Paragraph("—", cell_style),
        Paragraph(f"<b>{total_carpet_sqm:.1f} m²</b>", cell_bold),
        Paragraph(f"<b>{total_tonnage:.1f} TR</b>", cell_bold),
        Paragraph(f"<b>{int(total_cfm)} CFM</b>", cell_bold),
        Paragraph("—", cell_style),
        Paragraph("—", cell_style)
    ])
    loads_table = Table(load_rows, colWidths=[120, 65, 75, 75, 75, 55, 58])
    loads_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_hvac),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#F3E8FF")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, c_hvac),
    ]))
    hvac_block.append(loads_table)
    hvac_block.append(Spacer(1, 8))

    # Subsection 3B: Equipment
    hvac_block.append(Paragraph("3.2 Assigned Equipment Schedule", subsection_heading))
    eq_rows = [
        [
            Paragraph("Unit ID", cell_header),
            Paragraph("Type", cell_header),
            Paragraph("Host Room", cell_header),
            Paragraph("Capacity (TR)", cell_header),
            Paragraph("CAD Location (X, Y)", cell_header),
            Paragraph("Status", cell_header)
        ]
    ]
    for eq in hvac_equipment:
        is_odu = "odu" in eq.get("unit_type", "").lower()
        eq_rows.append([
            Paragraph(eq.get("id", "EQ"), cell_bold),
            Paragraph(f"<font color='{'#DB2777' if is_odu else '#7C3AED'}'><b>{eq.get('unit_type')}</b></font>", cell_style),
            Paragraph(eq.get("room_name", "—"), cell_style),
            Paragraph(f"<b>{eq.get('capacity_tr', 1.5):.1f} TR</b>", cell_style),
            Paragraph(f"({int(eq.get('x', 0))}, {int(eq.get('y', 0))})", cell_style),
            Paragraph(f"<font color='#059669'>● {eq.get('status', 'Active')}</font>", cell_style)
        ])
    eq_table = Table(eq_rows, colWidths=[65, 90, 130, 75, 100, 63])
    eq_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_light_bg]),
    ]))
    hvac_block.append(eq_table)
    hvac_block.append(Spacer(1, 8))

    # Subsection 3C: Refrigerant Piping BOQ
    hvac_block.append(Paragraph("3.3 Refrigerant Piping Bill of Materials", subsection_heading))
    pipe_rows = [
        [
            Paragraph("Pipe Run ID", cell_header),
            Paragraph("Connection (From ➔ To)", cell_header),
            Paragraph("Liquid + Suction Sizes", cell_header),
            Paragraph("Length (mm)", cell_header),
            Paragraph("Length (m)", cell_header)
        ]
    ]
    for p in hvac_pipes:
        length_mm = p.get("total_length_mm", 0.0)
        pipe_rows.append([
            Paragraph(p.get("pipe_id", "PIPE"), cell_bold),
            Paragraph(f"{p.get('from_unit_id')} ➔ {p.get('to_unit_id')}", cell_style),
            Paragraph(f"{p.get('liquid_size', '')} + {p.get('suction_size', '')}", cell_style),
            Paragraph(f"{length_mm:.0f} mm", cell_style),
            Paragraph(f"<b>{(length_mm/1000.0):.2f} m</b>", cell_style)
        ])
    pipe_rows.append([
        Paragraph("<b>Total Refrigerant Piping Required</b>", cell_bold),
        Paragraph(f"<b>{len(hvac_pipes)} Run(s)</b>", cell_bold),
        Paragraph("ASTM B280 Refrigerant Copper", cell_style),
        Paragraph(f"<b>{(total_pipe_len_m * 1000.0):.0f} mm</b>", cell_bold),
        Paragraph(f"<font color='#D97706'><b>{total_pipe_len_m:.2f} METERS</b></font>", cell_bold)
    ])
    pipes_table = Table(pipe_rows, colWidths=[80, 140, 140, 80, 83])
    pipes_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#D97706")),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#FEF3C7")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#D97706")),
    ]))
    hvac_block.append(pipes_table)

    story.append(KeepTogether(hvac_block))

    # 4. ARCHITECTURAL FURNITURE & CLEARANCE SCHEDULE
    furniture_list = cad_data.get("furniture", [])
    if furniture_list:
        furn_block = []
        furn_block.append(Spacer(1, 10))
        furn_block.append(Paragraph("4. Architectural Furniture & Clearance Schedule", section_heading))
        furn_rows = [
            [
                Paragraph("Item ID", cell_header),
                Paragraph("Furniture Type", cell_header),
                Paragraph("Category", cell_header),
                Paragraph("Host Room", cell_header),
                Paragraph("Dimensions (W x H)", cell_header),
                Paragraph("Coordinates (X, Y)", cell_header),
                Paragraph("Clearance & Safety Status", cell_header)
            ]
        ]
        for f in furniture_list:
            f_id = str(f.get("id", "FURN"))
            f_type = str(f.get("type", "Furniture"))
            f_cat = str(f.get("category", "General"))
            f_room = str(f.get("host_room_id", "—"))
            w = float(f.get("width", 1000.0) or 1000.0)
            h = float(f.get("height", 600.0) or 600.0)
            x = float(f.get("x", 0.0) or 0.0)
            y = float(f.get("y", 0.0) or 0.0)
            status = str(f.get("clearance_status", "OK") or "OK")
            status_color = "#DC2626" if "Warning" in status else "#059669"
            furn_rows.append([
                Paragraph(f_id, cell_bold),
                Paragraph(f_type, cell_style),
                Paragraph(f_cat, cell_style),
                Paragraph(f_room, cell_style),
                Paragraph(f"{w:.0f} × {h:.0f} mm", cell_style),
                Paragraph(f"({x:.0f}, {y:.0f})", cell_style),
                Paragraph(f"<font color='{status_color}'><b>{status}</b></font>", cell_style)
            ])
        furn_table = Table(furn_rows, colWidths=[65, 95, 75, 80, 85, 68, 55])
        furn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_light_bg]),
        ]))
        furn_block.append(furn_table)
        story.append(KeepTogether(furn_block))

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def generate_detailed_boq_pdf(
    project_name: str,
    created_at: Optional[str],
    cad_data: Dict[str, Any],
    boq_data: Dict[str, Any]
) -> bytes:
    """
    Generates a dedicated, comprehensive Bill of Materials (BOM/BOQ) & Cost Estimation
    PDF report detailing civil structural materials, labor mandays, 7-phase construction timeline,
    itemized MEP engineering (HVAC, Electrical, Plumbing), and Architectural Furniture.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    c_primary = colors.HexColor("#0F172A")
    c_accent = colors.HexColor("#0284C7")
    c_success = colors.HexColor("#059669")
    c_warning = colors.HexColor("#D97706")
    c_purple = colors.HexColor("#7C3AED")
    c_dark_text = colors.HexColor("#1E293B")
    c_light_bg = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#E2E8F0")

    tier_color_hex = boq_data.get("tier_badge_color", "#0284C7")
    c_tier = colors.HexColor(tier_color_hex)

    title_style = ParagraphStyle(
        'BOQTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary
    )
    subtitle_style = ParagraphStyle(
        'BOQSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748B")
    )
    section_heading = ParagraphStyle(
        'BOQSectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6
    )
    cell_style = ParagraphStyle(
        'BOQCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_dark_text
    )
    cell_bold = ParagraphStyle(
        'BOQCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=c_dark_text
    )
    cell_right = ParagraphStyle(
        'BOQCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=c_dark_text
    )
    cell_right_bold = ParagraphStyle(
        'BOQCellRightBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=c_dark_text
    )
    cell_header = ParagraphStyle(
        'BOQTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white
    )

    story = []

    # 1. HEADER WITH QUALITY TIER BADGE
    formatted_date = datetime.now(timezone.utc).strftime('%B %d, %Y')
    tier_name = boq_data.get("tier_name", "Standard / Premium").upper()

    summary = boq_data.get("summary", {})
    grand_total = summary.get("grand_total", 0.0)
    rate_builtup = summary.get("cost_per_sqft_builtup", 0.0)
    builtup_sqft = summary.get("total_builtup_sqft", 0.0)
    carpet_sqft = summary.get("total_carpet_sqft", 0.0)
    duration_days = summary.get("construction_duration_days", 0)
    duration_months = summary.get("construction_duration_months", 0.0)
    labor_mandays = summary.get("total_labor_mandays", 0)
    labor_cost = summary.get("total_labor_cost", 0.0)

    header_data = [
        [
            Paragraph(f"<b>{project_name}</b>", title_style),
            Paragraph(f"<font color='{tier_color_hex}'><b>[{tier_name} QUALITY TIER]</b></font><br/><b>BILL OF MATERIALS & COST ESTIMATE</b>", ParagraphStyle('RightMeta', parent=subtitle_style, alignment=2))
        ],
        [
            Paragraph(f"Parametric Civil, MEP & Architectural Fitout Estimation • Built-up: {builtup_sqft:,.0f} sq.ft ({summary.get('total_builtup_sqm', 0.0):.1f} m²)", subtitle_style),
            Paragraph(f"Date: {formatted_date} | Project ID: {cad_data.get('project_id', 'N/A')}", ParagraphStyle('RightId', parent=subtitle_style, alignment=2))
        ]
    ]
    hdr_table = Table(header_data, colWidths=[320, 203])
    hdr_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(hdr_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_tier, spaceBefore=2, spaceAfter=8))

    # Page 1: Architectural Vector Blueprint Drawing
    if cad_data and cad_data.get("rooms"):
        story.append(FloorplanBlueprintFlowable(cad_data=cad_data, project_name=project_name, width=523.0, height=440.0))
        story.append(PageBreak())

    # 2. KEY KPI CARDS
    kpi_data = [
        [
            Paragraph(f"<b>₹ {grand_total:,.0f}</b><br/><font color='#64748B' size=7>GRAND TOTAL ESTIMATE</font>", ParagraphStyle('K1', alignment=1, fontSize=12, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph(f"<b>₹ {rate_builtup:,.0f} / sq.ft</b><br/><font color='#64748B' size=7>BUILT-UP AREA RATE</font>", ParagraphStyle('K2', alignment=1, fontSize=12, fontName='Helvetica-Bold', textColor=c_tier)),
            Paragraph(f"<b>{duration_days} Days</b><br/><font color='#64748B' size=7>~{duration_months:.1f} CALENDAR MONTHS</font>", ParagraphStyle('K3', alignment=1, fontSize=12, fontName='Helvetica-Bold', textColor=c_warning)),
            Paragraph(f"<b>{labor_mandays} Mandays</b><br/><font color='#64748B' size=7>₹ {labor_cost:,.0f} LABOR WAGES</font>", ParagraphStyle('K4', alignment=1, fontSize=12, fontName='Helvetica-Bold', textColor=c_success))
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[130, 131, 131, 131])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_light_bg),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # 3. CIVIL & STRUCTURAL MATERIALS SCHEDULE
    civil = boq_data.get("civil_materials", {})
    story.append(Paragraph("1. Civil & Structural Materials Schedule", section_heading))

    cement_breakdown = civil.get("cement_breakdown", {})
    cement_subtext = f"Masonry: {cement_breakdown.get('masonry_mortar_bags', 0):.0f} bags, Plaster: {cement_breakdown.get('plastering_bags', 0):.0f} bags, RCC: {cement_breakdown.get('rcc_structure_bags', 0):.0f} bags, Floor: {cement_breakdown.get('flooring_screed_bags', 0):.0f} bags"

    civil_rows = [
        [
            Paragraph("Material & Component", cell_header),
            Paragraph("Technical Specification", cell_header),
            Paragraph("Quantity", cell_header),
            Paragraph("Unit Rate (₹)", cell_header),
            Paragraph("Amount (₹)", cell_header)
        ],
        [
            Paragraph("<b>Wall Masonry Units</b>", cell_bold),
            Paragraph(f"{civil.get('solid_blocks_count', 0):,} Solid Blocks (or {civil.get('standard_bricks_count', 0):,} Wire-Cut Bricks)", cell_style),
            Paragraph(f"{civil.get('solid_blocks_count', 0):,} Units", cell_style),
            Paragraph(f"₹ {civil.get('solid_block_unit_cost', 0):.2f} / unit", cell_right),
            Paragraph(f"₹ {civil.get('solid_blocks_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>Cement (50kg Bags)</b>", cell_bold),
            Paragraph(f"{civil.get('cement_brand', 'PPC/OPC 53 Grade')}<br/><font color='#64748B' size=7>{cement_subtext}</font>", cell_style),
            Paragraph(f"{civil.get('cement_total_bags', 0):,} Bags", cell_style),
            Paragraph(f"₹ {civil.get('cement_bag_cost', 0):.2f} / bag", cell_right),
            Paragraph(f"₹ {civil.get('cement_total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>M-Sand (Manufactured Sand)</b>", cell_bold),
            Paragraph(f"Concrete, RCC & Masonry Grade ({civil.get('msand_tons', 0):.1f} Metric Tons)", cell_style),
            Paragraph(f"{civil.get('msand_cft', 0):,.1f} CFT", cell_style),
            Paragraph("₹ 62.00 / CFT", cell_right),
            Paragraph(f"₹ {civil.get('msand_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>P-Sand (Plastering Sand)</b>", cell_bold),
            Paragraph(f"Washed Fine Plastering Sand ({civil.get('psand_tons', 0):.1f} Metric Tons)", cell_style),
            Paragraph(f"{civil.get('psand_cft', 0):,.1f} CFT", cell_style),
            Paragraph("₹ 70.00 / CFT", cell_right),
            Paragraph(f"₹ {civil.get('psand_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>TMT Rebar Steel</b>", cell_bold),
            Paragraph(f"Fe550D High-Yield Earthquake Resistant ({civil.get('steel_metric_tons', 0):.2f} MT)", cell_style),
            Paragraph(f"{civil.get('steel_kg', 0):,.0f} kg", cell_style),
            Paragraph("₹ 72.00 / kg", cell_right),
            Paragraph(f"₹ {civil.get('steel_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>Coarse Aggregate Metal</b>", cell_bold),
            Paragraph(f"20mm & 40mm Graded Blue Metal ({civil.get('aggregate_tons', 0):.1f} MT)", cell_style),
            Paragraph(f"{civil.get('aggregate_cft', 0):,.1f} CFT", cell_style),
            Paragraph("₹ 48.00 / CFT", cell_right),
            Paragraph(f"₹ {civil.get('aggregate_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>Flooring & Wall Tiling</b>", cell_bold),
            Paragraph("Vitrified 800x800 Double-Charged / Marble Tiles", cell_style),
            Paragraph(f"{civil.get('flooring_sqft', 0):,.0f} sq.ft", cell_style),
            Paragraph("₹ 140.00 / sq.ft", cell_right),
            Paragraph(f"₹ {civil.get('flooring_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>Subtotal Civil & Structural Materials</b>", cell_bold),
            Paragraph("—", cell_style),
            Paragraph("—", cell_style),
            Paragraph("—", cell_right),
            Paragraph(f"<b>₹ {civil.get('total_cost', 0):,.2f}</b>", cell_right_bold)
        ]
    ]

    civil_table = Table(civil_rows, colWidths=[130, 163, 75, 75, 80])
    civil_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
    ]))
    story.append(civil_table)
    story.append(Spacer(1, 10))

    # 4. CONSTRUCTION PHASES TIMELINE
    schedule = boq_data.get("construction_schedule", {})
    phases = schedule.get("phases", [])
    if phases:
        story.append(Paragraph("2. Construction Phased Timeline (Schedule in Days)", section_heading))
        sched_rows = [
            [
                Paragraph("Phase", cell_header),
                Paragraph("Construction Phase Name", cell_header),
                Paragraph("Duration", cell_header),
                Paragraph("Milestone Timeline", cell_header),
                Paragraph("Key Construction Deliverables", cell_header)
            ]
        ]
        for idx, p in enumerate(phases):
            sched_rows.append([
                Paragraph(f"Phase {idx+1}", cell_bold),
                Paragraph(p.get("phase_name", ""), cell_bold),
                Paragraph(f"{p.get('duration_days', 0)} Days", cell_style),
                Paragraph(f"{p.get('start_day', '')} – {p.get('end_day', '')}", cell_style),
                Paragraph(p.get("description", ""), cell_style)
            ])
        sched_rows.append([
            Paragraph("<b>Total Duration</b>", cell_bold),
            Paragraph(f"<b>{schedule.get('total_working_days', 0)} Working Days (~{schedule.get('total_months', 0):.1f} Calendar Months)</b>", cell_bold),
            Paragraph("—", cell_style),
            Paragraph("Day 1 – Handover", cell_style),
            Paragraph("Complete Turnkey Architectural Handover", cell_style)
        ])
        sched_table = Table(sched_rows, colWidths=[45, 125, 55, 85, 213])
        sched_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#334155")),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
        ]))
        story.append(sched_table)
        story.append(Spacer(1, 10))

    # 5. LABOR WORKFORCE & WAGES
    labor = boq_data.get("labor", {})
    labor_list = labor.get("breakdown", [])
    if labor_list:
        story.append(Paragraph("3. Construction Labor Workforce & Wage Schedule", section_heading))
        labor_rows = [
            [
                Paragraph("Trade / Skill Category", cell_header),
                Paragraph("Workforce Role", cell_header),
                Paragraph("Estimated Mandays", cell_header),
                Paragraph("Daily Wage (₹)", cell_header),
                Paragraph("Total Wage Cost (₹)", cell_header)
            ]
        ]
        for l in labor_list:
            labor_rows.append([
                Paragraph(l.get("role", "").split("/")[0], cell_bold),
                Paragraph(l.get("role", ""), cell_style),
                Paragraph(f"{l.get('mandays', 0)} Mandays", cell_style),
                Paragraph(f"₹ {l.get('daily_wage', 0):,.2f}", cell_right),
                Paragraph(f"₹ {l.get('total_cost', 0):,.2f}", cell_right_bold)
            ])
        labor_rows.append([
            Paragraph("<b>Total Workforce</b>", cell_bold),
            Paragraph(f"<b>{labor.get('total_mandays', 0)} Total Mandays</b>", cell_bold),
            Paragraph("—", cell_style),
            Paragraph("—", cell_right),
            Paragraph(f"<b>₹ {labor.get('total_cost', 0):,.2f}</b>", cell_right_bold)
        ])
        labor_table = Table(labor_rows, colWidths=[130, 143, 80, 85, 85])
        labor_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0D9488")),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
        ]))
        story.append(labor_table)
        story.append(Spacer(1, 10))

    # 6. MEP ENGINEERING SCHEDULE (Electrical, Plumbing, HVAC)
    story.append(Paragraph("4. MEP Engineering Infrastructure Schedule", section_heading))
    mep_combined_rows = [
        [
            Paragraph("MEP Division", cell_header),
            Paragraph("Line Item Description", cell_header),
            Paragraph("Quantity / Scope", cell_header),
            Paragraph("Unit Rate (₹)", cell_header),
            Paragraph("Subtotal (₹)", cell_header)
        ]
    ]

    # Electrical Items
    for el in boq_data.get("electrical", {}).get("items", []):
        mep_combined_rows.append([
            Paragraph("<font color='#0284C7'><b>Electrical</b></font>", cell_style),
            Paragraph(el.get("item", ""), cell_style),
            Paragraph(str(el.get("quantity", "")), cell_style),
            Paragraph(f"₹ {el.get('unit_rate', 0):,.2f}", cell_right),
            Paragraph(f"₹ {el.get('total', 0):,.2f}", cell_right_bold)
        ])
    # Plumbing Items
    for pl in boq_data.get("plumbing", {}).get("items", []):
        mep_combined_rows.append([
            Paragraph("<font color='#0D9488'><b>Plumbing</b></font>", cell_style),
            Paragraph(pl.get("item", ""), cell_style),
            Paragraph(str(pl.get("quantity", "")), cell_style),
            Paragraph(f"₹ {pl.get('unit_rate', 0):,.2f}", cell_right),
            Paragraph(f"₹ {pl.get('total', 0):,.2f}", cell_right_bold)
        ])
    # HVAC Items
    hvac_data = boq_data.get("hvac", {})
    for hv in hvac_data.get("items", []):
        mep_combined_rows.append([
            Paragraph("<font color='#7C3AED'><b>HVAC</b></font>", cell_style),
            Paragraph(f"{hv.get('equipment', '')} - {hv.get('room', '')}<br/><font color='#64748B' size=7>{hv.get('specification', '')}</font>", cell_style),
            Paragraph("1 Unit", cell_style),
            Paragraph(f"₹ {hv.get('unit_cost', 0):,.2f}", cell_right),
            Paragraph(f"₹ {hv.get('unit_cost', 0):,.2f}", cell_right_bold)
        ])
    if hvac_data.get("copper_piping_cost", 0) > 0:
        mep_combined_rows.append([
            Paragraph("<font color='#7C3AED'><b>HVAC</b></font>", cell_style),
            Paragraph("Refrigerant Copper Piping with Nitrile Rubber Insulation", cell_style),
            Paragraph(f"{hvac_data.get('copper_piping_meters', 0):.0f} Meters", cell_style),
            Paragraph("—", cell_right),
            Paragraph(f"₹ {hvac_data.get('copper_piping_cost', 0):,.2f}", cell_right_bold)
        ])

    mep_total = (
        boq_data.get("electrical", {}).get("total_cost", 0.0) +
        boq_data.get("plumbing", {}).get("total_cost", 0.0) +
        boq_data.get("hvac", {}).get("total_cost", 0.0)
    )
    mep_combined_rows.append([
        Paragraph("<b>Total MEP Engineering</b>", cell_bold),
        Paragraph("Electrical, Plumbing & HVAC Systems Combined", cell_style),
        Paragraph("—", cell_style),
        Paragraph("—", cell_right),
        Paragraph(f"<b>₹ {mep_total:,.2f}</b>", cell_right_bold)
    ])

    mep_table = Table(mep_combined_rows, colWidths=[70, 203, 85, 80, 85])
    mep_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
    ]))
    story.append(mep_table)
    story.append(Spacer(1, 10))

    # 7. ARCHITECTURAL FURNITURE FITOUT SCHEDULE
    furniture = boq_data.get("furniture", {})
    furn_items = furniture.get("items", [])
    if furn_items:
        story.append(Paragraph("5. Architectural Furniture Fitout Schedule", section_heading))
        furn_rows = [
            [
                Paragraph("Item Code", cell_header),
                Paragraph("Furniture Item & Description", cell_header),
                Paragraph("Host Room", cell_header),
                Paragraph("Material & Joinery Finish", cell_header),
                Paragraph("Fitout Cost (₹)", cell_header)
            ]
        ]
        for f in furn_items:
            furn_rows.append([
                Paragraph(f.get("item_id", ""), cell_bold),
                Paragraph(f.get("name", ""), cell_style),
                Paragraph(f.get("room", ""), cell_style),
                Paragraph(f.get("finish", furniture.get("finish_specification", "")), cell_style),
                Paragraph(f"₹ {f.get('cost', 0):,.2f}", cell_right_bold)
            ])
        furn_rows.append([
            Paragraph("<b>Total Furniture</b>", cell_bold),
            Paragraph("Architectural Woodwork & Loose Furniture Fitout", cell_style),
            Paragraph("—", cell_style),
            Paragraph("—", cell_style),
            Paragraph(f"<b>₹ {furniture.get('total_cost', 0):,.2f}</b>", cell_right_bold)
        ])
        furn_table = Table(furn_rows, colWidths=[65, 150, 80, 140, 88])
        furn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
        ]))
        story.append(furn_table)
        story.append(Spacer(1, 10))

    # 8. GRAND TOTAL SUMMARY ROLLUP
    story.append(Paragraph("6. Project Cost Grand Summary Rollup", section_heading))
    pct = boq_data.get("percentages", {})
    summary_rows = [
        [
            Paragraph("Cost Component", cell_header),
            Paragraph("Scope Description", cell_header),
            Paragraph("Share %", cell_header),
            Paragraph("Estimated Cost (₹)", cell_header)
        ],
        [
            Paragraph("<b>1. Civil & Structural Materials</b>", cell_bold),
            Paragraph(f"Masonry, Cement, Sand, Steel, Flooring ({builtup_sqft:,.0f} sq.ft)", cell_style),
            Paragraph(f"{pct.get('civil', 0):.1f}%", cell_right),
            Paragraph(f"₹ {civil.get('total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>2. Labor & Construction Wages</b>", cell_bold),
            Paragraph(f"Mason, Helper, Tradesmen Mandays ({labor_mandays} mandays)", cell_style),
            Paragraph(f"{pct.get('labor', 0):.1f}%", cell_right),
            Paragraph(f"₹ {labor_cost:,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>3. Electrical Engineering</b>", cell_bold),
            Paragraph("DB, LED downlights, BLDC fans, modular plates & conduits", cell_style),
            Paragraph(f"{pct.get('electrical', 0):.1f}%", cell_right),
            Paragraph(f"₹ {boq_data.get('electrical', {}).get('total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>4. Plumbing & Sanitary</b>", cell_bold),
            Paragraph("EWCs, basins, sink, showers, CPVC water & SWR drainage", cell_style),
            Paragraph(f"{pct.get('plumbing', 0):.1f}%", cell_right),
            Paragraph(f"₹ {boq_data.get('plumbing', {}).get('total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>5. HVAC Climate Systems</b>", cell_bold),
            Paragraph("Split IDU/ODU condensers & insulated copper runs", cell_style),
            Paragraph(f"{pct.get('hvac', 0):.1f}%", cell_right),
            Paragraph(f"₹ {boq_data.get('hvac', {}).get('total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>6. Furniture & Woodwork</b>", cell_bold),
            Paragraph("Beds, sofas, dining, modular kitchen woodwork", cell_style),
            Paragraph(f"{pct.get('furniture', 0):.1f}%", cell_right),
            Paragraph(f"₹ {furniture.get('total_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>7. Contingency & Supervision (5%)</b>", cell_bold),
            Paragraph("Contractor supervision, waste buffer & site overheads", cell_style),
            Paragraph(f"{pct.get('contingency', 0):.1f}%", cell_right),
            Paragraph(f"₹ {summary.get('contingency_cost', 0):,.2f}", cell_right_bold)
        ],
        [
            Paragraph("<b>GRAND TOTAL PROJECT ESTIMATE</b>", cell_bold),
            Paragraph(f"<b>Estimated Built-up Area Rate: ₹ {rate_builtup:,.0f} / sq.ft</b>", cell_bold),
            Paragraph("<b>100.0%</b>", cell_right_bold),
            Paragraph(f"<b>₹ {grand_total:,.2f}</b>", ParagraphStyle('GrandTot', parent=cell_right_bold, textColor=c_tier, fontSize=10))
        ]
    ]

    summary_table = Table(summary_rows, colWidths=[150, 193, 60, 120])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, c_light_bg]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#FEF3C7")),
    ]))
    story.append(KeepTogether(summary_table))

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()

