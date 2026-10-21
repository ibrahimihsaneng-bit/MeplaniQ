"""
backend/ifc_exporter.py
=======================
Generates Industry Foundation Classes (IFC4 - ISO 16739-1:2018)
STEP Physical Format (.ifc) models from MeplanIQ CAD and MEP data.

Enables seamless OpenBIM interoperability with:
- Autodesk Revit
- Graphisoft ArchiCAD
- Solibri Model Checker
- Blender BIM Add-on
- Trimble Connect
"""

import time
import uuid
from typing import Dict, Any, List


def create_ifc_guid() -> str:
    """Generates a compressed 22-character base64 IFC Globally Unique Identifier."""
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
    u = uuid.uuid4().hex
    # Fallback to pseudo-deterministic 22-char IFC guid string
    guid_chars = []
    num = int(u, 16)
    while len(guid_chars) < 22:
        guid_chars.append(chars[num % 64])
        num //= 64
    return "".join(guid_chars)


def export_floorplan_to_ifc(solve_data: Dict[str, Any], project_name: str = "MeplanIQ Building") -> str:
    """
    Constructs an ISO 16739-1:2018 IFC4 compliant STEP string.
    Coordinates are in millimeters converted to meters (0.001 scale factor).
    """
    scale = 0.001
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    lines: List[str] = [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView_V1.0]'),'2;1');",
        f"FILE_NAME('{project_name}.ifc','{timestamp}',('MeplanIQ BIM Engineering'),('MeplanIQ Automation Engine'),'MeplanIQ IFC4 Exporter','Autodesk Revit / OpenBIM IFC4','Authorized');",
        "FILE_SCHEMA(('IFC4'));",
        "ENDSEC;",
        "",
        "DATA;"
    ]

    id_counter = 1
    def get_id() -> int:
        nonlocal id_counter
        res = id_counter
        id_counter += 1
        return res

    # 1. Base Project Setup & Units
    org_id = get_id()
    lines.append(f"#{org_id}=IFCORGANIZATION($,'MeplanIQ Civil & MEP Intelligence',$,$,$);")
    
    app_id = get_id()
    lines.append(f"#{app_id}=IFCAPPLICATION(#{org_id},'2.0','MeplanIQ CAD/BIM Engine','MeplanIQ');")

    person_id = get_id()
    lines.append(f"#{person_id}=IFCPERSON($,'Engineer','Lead BIM Coordinator',$,$,$,$,$);")

    person_org_id = get_id()
    lines.append(f"#{person_org_id}=IFCPERSONANDORGANIZATION(#{person_id},#{org_id},$);")

    owner_hist_id = get_id()
    lines.append(f"#{owner_hist_id}=IFCOWNERHISTORY(#{person_org_id},#{app_id},.READWRITE.,.NOCHANGE.,$,$,$,$);")

    # Dimensions & Units
    length_unit_id = get_id()
    lines.append(f"#{length_unit_id}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);")
    area_unit_id = get_id()
    lines.append(f"#{area_unit_id}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);")
    volume_unit_id = get_id()
    lines.append(f"#{volume_unit_id}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);")
    units_id = get_id()
    lines.append(f"#{units_id}=IFCUNITASSIGNMENT((#{length_unit_id},#{area_unit_id},#{volume_unit_id}));")

    # World Coordinate System
    origin_point_id = get_id()
    lines.append(f"#{origin_point_id}=IFCCARTESIANPOINT((0.,0.,0.));")
    axis_z_id = get_id()
    lines.append(f"#{axis_z_id}=IFCDIRECTION((0.,0.,1.));")
    axis_x_id = get_id()
    lines.append(f"#{axis_x_id}=IFCDIRECTION((1.,0.,0.));")
    wcs_placement_id = get_id()
    lines.append(f"#{wcs_placement_id}=IFCAXIS2PLACEMENT3D(#{origin_point_id},#{axis_z_id},#{axis_x_id});")

    geom_context_id = get_id()
    lines.append(f"#{geom_context_id}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#{wcs_placement_id},$);")

    # Spatial Hierarchy: Project -> Site -> Building -> Storey
    proj_guid = create_ifc_guid()
    proj_id = get_id()
    lines.append(f"#{proj_id}=IFCPROJECT('{proj_guid}',#{owner_hist_id},'{project_name}',$,$,$,$,(#{geom_context_id}),#{units_id});")

    site_guid = create_ifc_guid()
    site_id = get_id()
    lines.append(f"#{site_id}=IFCSITE('{site_guid}',#{owner_hist_id},'Default Site',$,$,#{wcs_placement_id},$,$,.ELEMENT.,(0,0,0),(0,0,0),0.,$,$);")

    bldg_guid = create_ifc_guid()
    bldg_id = get_id()
    lines.append(f"#{bldg_id}=IFCBUILDING('{bldg_guid}',#{owner_hist_id},'Main Building',$,$,#{wcs_placement_id},$,$,.ELEMENT.,$,$,$);")

    storey_guid = create_ifc_guid()
    storey_id = get_id()
    lines.append(f"#{storey_id}=IFCBUILDINGSTOREY('{storey_guid}',#{owner_hist_id},'Ground Floor (Level 0)',$,$,#{wcs_placement_id},$,$,.ELEMENT.,0.0);")

    # Aggregations
    rel_agg_site_id = get_id()
    lines.append(f"#{rel_agg_site_id}=IFCRELAGGREGATES('{create_ifc_guid()}',#{owner_hist_id},'ProjectToSite',$,#{proj_id},(#{site_id}));")
    rel_agg_bldg_id = get_id()
    lines.append(f"#{rel_agg_bldg_id}=IFCRELAGGREGATES('{create_ifc_guid()}',#{owner_hist_id},'SiteToBuilding',$,#{site_id},(#{bldg_id}));")
    rel_agg_storey_id = get_id()
    lines.append(f"#{rel_agg_storey_id}=IFCRELAGGREGATES('{create_ifc_guid()}',#{owner_hist_id},'BuildingToStorey',$,#{bldg_id},(#{storey_id}));")

    spatial_element_ids = []

    # 2. Export Architectural Walls (IfcWallStandardCase)
    walls = solve_data.get("walls", [])
    for idx, w in enumerate(walls):
        p1 = w.get("p1", [0, 0])
        p2 = w.get("p2", [0, 0])
        thick = float(w.get("thickness", 200)) * scale
        h = 3.0 # Standard 3.0m storey clear height

        wall_pt_id = get_id()
        lines.append(f"#{wall_pt_id}=IFCCARTESIANPOINT(({p1[0]*scale:.3f},{p1[1]*scale:.3f},0.));")
        wall_plc_id = get_id()
        lines.append(f"#{wall_plc_id}=IFCAXIS2PLACEMENT3D(#{wall_pt_id},#{axis_z_id},#{axis_x_id});")
        wall_lp_id = get_id()
        lines.append(f"#{wall_lp_id}=IFCLOCALPLACEMENT(#{wcs_placement_id},#{wall_plc_id});")

        wall_guid = create_ifc_guid()
        wall_id = get_id()
        lines.append(f"#{wall_id}=IFCWALLSTANDARDCASE('{wall_guid}',#{owner_hist_id},'Wall_{idx+1}',$,'Masonry Wall {int(thick*1000)}mm',#{wall_lp_id},$,$,.STANDARD.);")
        spatial_element_ids.append(wall_id)

    # 3. Export Structural Columns (IfcColumn)
    columns = solve_data.get("structural_columns", [])
    for idx, c in enumerate(columns):
        cx = float(c.get("center_x", c.get("x", 0))) * scale
        cy = float(c.get("center_y", c.get("y", 0))) * scale
        col_pt_id = get_id()
        lines.append(f"#{col_pt_id}=IFCCARTESIANPOINT(({cx:.3f},{cy:.3f},0.));")
        col_plc_id = get_id()
        lines.append(f"#{col_plc_id}=IFCAXIS2PLACEMENT3D(#{col_pt_id},#{axis_z_id},#{axis_x_id});")
        col_lp_id = get_id()
        lines.append(f"#{col_lp_id}=IFCLOCALPLACEMENT(#{wcs_placement_id},#{col_plc_id});")

        col_guid = create_ifc_guid()
        col_id = get_id()
        lines.append(f"#{col_id}=IFCCOLUMN('{col_guid}',#{owner_hist_id},'{c.get('id', f'Column_{idx+1}')}',$,'M25 Reinforced Concrete Column',#{col_lp_id},$,$,.COLUMN.);")
        spatial_element_ids.append(col_id)

    # 4. Export HVAC Ducts (IfcDuctSegment)
    ducts = solve_data.get("hvac_ducts", [])
    for idx, d in enumerate(ducts):
        p1 = d.get("p1", [0, 0])
        w_mm = d.get("width_mm", 300)
        h_mm = d.get("height_mm", 200)
        duct_pt_id = get_id()
        lines.append(f"#{duct_pt_id}=IFCCARTESIANPOINT(({p1[0]*scale:.3f},{p1[1]*scale:.3f},2.4));") # Duct centerline at Z=2.4m
        duct_plc_id = get_id()
        lines.append(f"#{duct_plc_id}=IFCAXIS2PLACEMENT3D(#{duct_pt_id},#{axis_z_id},#{axis_x_id});")
        duct_lp_id = get_id()
        lines.append(f"#{duct_lp_id}=IFCLOCALPLACEMENT(#{wcs_placement_id},#{duct_plc_id});")

        duct_guid = create_ifc_guid()
        duct_id = get_id()
        lines.append(f"#{duct_id}=IFCDUCTSEGMENT('{duct_guid}',#{owner_hist_id},'Duct_{idx+1}',$,'Galvanized GI Duct {int(w_mm)}x{int(h_mm)}mm',#{duct_lp_id},$,$,.RIGIDSEGMENT.);")
        spatial_element_ids.append(duct_id)

    # 5. Export Plumbing Pipes (IfcPipeSegment)
    pipes = solve_data.get("plumbing_pipes", [])
    for idx, p in enumerate(pipes):
        pts = p.get("points", [])
        if pts:
            pipe_pt_id = get_id()
            lines.append(f"#{pipe_pt_id}=IFCCARTESIANPOINT(({pts[0][0]*scale:.3f},{pts[0][1]*scale:.3f},0.3));")
            pipe_plc_id = get_id()
            lines.append(f"#{pipe_plc_id}=IFCAXIS2PLACEMENT3D(#{pipe_pt_id},#{axis_z_id},#{axis_x_id});")
            pipe_lp_id = get_id()
            lines.append(f"#{pipe_lp_id}=IFCLOCALPLACEMENT(#{wcs_placement_id},#{pipe_plc_id});")

            pipe_guid = create_ifc_guid()
            pipe_id = get_id()
            p_desc = "uPVC Gravity Soil Drainage" if p.get("type") == "drainage" else "CPVC Water Supply"
            lines.append(f"#{pipe_id}=IFCPIPESEGMENT('{pipe_guid}',#{owner_hist_id},'Pipe_{idx+1}',$,'{p_desc}',#{pipe_lp_id},$,$,.RIGIDSEGMENT.);")
            spatial_element_ids.append(pipe_id)

    # Contain all building elements in the storey
    if spatial_element_ids:
        contained_tuple = "(" + ",".join([f"#{i}" for i in spatial_element_ids]) + ")"
        rel_contained_id = get_id()
        lines.append(f"#{rel_contained_id}=IFCRELCONTAINEDINSPATIALSTRUCTURE('{create_ifc_guid()}',#{owner_hist_id},'StoreyElements',$,{contained_tuple},#{storey_id});")

    lines.append("ENDSEC;")
    lines.append("END-ISO-10303-21;")

    return "\n".join(lines)
