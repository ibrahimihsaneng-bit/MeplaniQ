import os
import io
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from backend.excel_parser import parse_excel_floorplan, parse_excel_floorplan_full, ExcelParsingError
from backend.models import PlumbingFixturePayload, PlumbingPipePayload
from backend.geometry import (
    SolveRequest,
    SolveResponse,
    ProjectUpdateRequest,
    DEFAULT_TEST_PAYLOAD,
    DEFAULT_TEST_OPENINGS,
    DEFAULT_TEST_HVAC,
    RoomPayload,
    OpeningPayload,
    HVACEquipmentPayload,
    FurniturePayload,
    FurnitureCAD,
    process_geometry_solve,
    process_geometry_solve_v2,
    generate_excel_template_bytes,
    generate_2bhk_template_bytes,
    generate_custom_house_bytes
)
from backend.dxf_exporter import export_floorplan_to_dxf
from backend.pdf_exporter import generate_project_boq_pdf, generate_detailed_boq_pdf
from backend.excel_exporter import export_project_to_excel
from backend.database import (
    init_db,
    get_all_projects_summary,
    get_project_by_id,
    save_project,
    delete_project,
    update_project_cad_data,
    get_db_furniture_catalog,
    get_catalog_item,
    save_project_boq,
    get_project_boq
)
from backend.services.area_to_plan import (
    generate_default_room_program,
    generate_and_save_area_plan
)
from backend.services.boq_engine import (
    calculate_project_boq,
    TIER_SPECIFICATIONS
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes SQLite database tables and seeds default project on startup."""
    init_db()
    yield


app = FastAPI(
    title="Parametric 2D Architectural CAD Engine API",
    version="1.0.0",
    description="FastAPI Backend for 2D CAD Wall Offsetting, Fillet Engine, Doors & Windows, & Dimensioning",
    lifespan=lifespan
)

# Enable CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.routers.plumbing import router as plumbing_router
app.include_router(plumbing_router)

from backend.routers.electrical import router as electrical_router
app.include_router(electrical_router)

# Master project generation router
from backend.routers.master_project import router as master_project_router
app.include_router(master_project_router)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Parametric 2D Architectural CAD Engine",
        "version": "1.0.0"
    }


@app.get("/api/projects")
def list_projects():
    """Returns a list of all saved project summaries (id, name, created_at) ordered by newest first."""
    return get_all_projects_summary()


@app.get("/api/furniture-catalog")
def get_furniture_catalog():
    """Returns the multi-category furniture catalog with dimensions and category groupings."""
    return get_db_furniture_catalog()


@app.get("/api/projects/area-program-proposal")
@app.get("/api/area-program-proposal")
def get_area_program_proposal(
    target_area_sqft: float,
    bedrooms: int = 2,
    bathrooms: int = 2,
    include_kitchen: bool = True,
    include_dining: bool = True,
    include_living: bool = True,
    include_balcony: bool = False,
    building_type: str = "Residential"
):
    """
    Returns a deterministic, architectural room program allocating target square footage.
    Provides widths, depths, and areas for user inspection before generation.
    """
    if target_area_sqft <= 0:
        raise HTTPException(status_code=400, detail="Target area must be greater than zero.")
    try:
        program = generate_default_room_program(
            target_area_sqft=target_area_sqft,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            include_kitchen=include_kitchen,
            include_dining=include_dining,
            include_living=include_living,
            include_balcony=include_balcony,
            building_type=building_type
        )
        return {"target_area_sqft": target_area_sqft, "rooms": program}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Room proposal error: {str(e)}")


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    """Retrieves full saved CAD payload for a specific project by project_id."""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
    cad_data = project["cad_json_data"]
    if isinstance(cad_data, dict):
        cad_data["project_id"] = project["id"]
        cad_data["project_name"] = project["name"]
        cad_data["created_at"] = project["created_at"]
    return cad_data


@app.delete("/api/projects/{project_id}")
def delete_project_endpoint(project_id: str):
    """Deletes a saved project from the SQLite database."""
    deleted = delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")
    return {
        "status": "success",
        "message": f"Project '{project_id}' deleted successfully.",
        "deleted_id": project_id
    }


@app.put("/api/projects/{project_id}", response_model=SolveResponse)
def update_project_endpoint(project_id: str, request: ProjectUpdateRequest):
    """
    Accepts updated architectural parameters (rooms, openings, hvac_equipment),
    re-solves the 2D CAD geometry, and updates the project in the SQLite database.
    """
    existing = get_project_by_id(project_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    try:
        existing_cad = existing.get("cad_json_data", {})
        el_comps = request.electrical_components if request.electrical_components is not None else existing_cad.get("electrical_components", [])
        el_ckts = request.electrical_circuits if request.electrical_circuits is not None else existing_cad.get("electrical_circuits", [])
        el_routes = request.electrical_routes if request.electrical_routes is not None else existing_cad.get("electrical_routes", [])

        solved = process_geometry_solve_v2(
            payload_or_rooms=request.rooms,
            openings=request.openings or [],
            hvac_equipment=request.hvac_equipment or [],
            furniture=request.furniture or [],
            plumbing_fixtures=request.plumbing_fixtures or [],
            plumbing_pipes=request.plumbing_pipes or [],
            electrical_components=el_comps,
            electrical_circuits=el_ckts,
            electrical_routes=el_routes
        )
        
        project_name = request.name or existing.get("name", "Floorplan")
        solved.project_id = project_id
        solved.project_name = project_name
        solved.created_at = existing.get("created_at")
        solved.electrical_components = el_comps
        solved.electrical_circuits = el_ckts
        solved.electrical_routes = el_routes
        
        update_project_cad_data(
            project_id=project_id,
            cad_dict=solved.model_dump(),
            name=project_name
        )
        
        return solved
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geometry re-solving error: {str(e)}")


@app.get("/api/projects/{project_id}/export-pdf")
def export_project_pdf_endpoint(project_id: str):
    """
    Generates a professional Bill of Quantities (BOQ) and Project Summary PDF report
    for the specified project_id and streams it back as a downloadable PDF file.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    project_name = project.get("name", "Project_Report")
    created_at = project.get("created_at")

    try:
        pdf_bytes = generate_project_boq_pdf(project_name, created_at, cad_data)
        safe_name = "".join(c if (c.isalnum() or c in (' ', '_', '-')) else '_' for c in project_name).strip()
        filename = f"{safe_name}_Report.pdf" if safe_name else "Project_Report.pdf"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")


@app.get("/api/projects/{project_id}/export-excel")
def export_project_excel_endpoint(project_id: str):
    """
    Retrieves the project by ID from SQLite, converts the CAD data (rooms, openings, HVAC, and furniture)
    into the unified 4-sheet Excel format, and streams it back as a downloadable .xlsx file.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    project_name = project.get("name", "Project_Data")

    try:
        excel_bytes = export_project_to_excel(cad_data, project_name=project_name)
        safe_name = "".join(c if (c.isalnum() or c in ('_', '-')) else '_' for c in project_name).strip('_')
        filename = f"{safe_name}_Full_Schedule.xlsx" if safe_name else "Project_Full_Schedule.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation error: {str(e)}")


@app.post("/api/export-excel")
def export_excel_live_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    Accepts live solved CAD geometry payload (with rooms, openings, HVAC, furniture, and plumbing),
    generates a unified 5-sheet Excel workbook, and streams back the file download.
    """
    try:
        project_name = payload.get("project_name") or payload.get("name") or "Floorplan"
        excel_bytes = export_project_to_excel(payload, project_name=project_name)
        safe_name = "".join(c if (c.isalnum() or c in ('_', '-')) else '_' for c in project_name).strip('_')
        filename = f"{safe_name}_Full_Schedule.xlsx" if safe_name else "Floorplan_Full_Schedule.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation error: {str(e)}")


class CalculateBoqRequest(BaseModel):
    quality_tier: Optional[str] = "medium"


@app.get("/api/boq/tier-specifications")
def get_tier_specifications():
    """
    Returns the comprehensive specifications, materials, brands, and rates
    for all 3 quality tiers (Low/Budget, Medium/Standard, High/Luxury).
    """
    return TIER_SPECIFICATIONS


@app.post("/api/projects/{project_id}/calculate-boq")
def calculate_project_boq_endpoint(project_id: str, request: Optional[CalculateBoqRequest] = None):
    """
    Calculates detailed Bill of Materials (BOM/BOQ), material quantities (bricks, cement, sand, steel),
    construction timeline, labor wages, itemized MEP, and architectural furniture fitout
    based on the requested quality tier (Low, Medium, or High), saves to SQLite, and returns the result.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    tier = (request.quality_tier if request and request.quality_tier else "medium").lower()
    cad_data = project.get("cad_json_data", {})

    try:
        boq_data = calculate_project_boq(cad_data, quality_tier=tier)
        # Persist to project_boq table
        save_project_boq(project_id=project_id, quality_tier=tier, boq_data=boq_data)

        # Also sync into project CAD payload
        cad_data["boq"] = boq_data
        cad_data["quality_tier"] = tier
        update_project_cad_data(project_id=project_id, cad_dict=cad_data, name=project.get("name"))

        return {
            "status": "success",
            "project_id": project_id,
            "project_name": project.get("name"),
            "quality_tier": tier,
            "boq": boq_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BOQ calculation failed: {str(e)}")


@app.get("/api/projects/{project_id}/boq")
def get_project_boq_endpoint(project_id: str):
    """
    Retrieves the saved Bill of Materials (BOQ) and selected quality tier for a project.
    If no BOQ exists yet, automatically computes and saves a default 'Medium' tier estimate.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    saved_boq = get_project_boq(project_id)
    if saved_boq and saved_boq.get("boq_data"):
        return {
            "status": "success",
            "project_id": project_id,
            "project_name": project.get("name"),
            "quality_tier": saved_boq.get("quality_tier", "medium"),
            "updated_at": saved_boq.get("updated_at"),
            "boq": saved_boq["boq_data"]
        }

    # Otherwise auto-generate default Medium tier BOQ
    cad_data = project.get("cad_json_data", {})
    try:
        boq_data = calculate_project_boq(cad_data, quality_tier="medium")
        res = save_project_boq(project_id=project_id, quality_tier="medium", boq_data=boq_data)
        cad_data["boq"] = boq_data
        cad_data["quality_tier"] = "medium"
        update_project_cad_data(project_id=project_id, cad_dict=cad_data, name=project.get("name"))
        return {
            "status": "success",
            "project_id": project_id,
            "project_name": project.get("name"),
            "quality_tier": "medium",
            "updated_at": res.get("updated_at"),
            "boq": boq_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BOQ auto-generation failed: {str(e)}")


@app.post("/api/projects/calculate-boq-live")
def calculate_boq_live_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    Accepts live unsaved CAD geometry payload from the interactive canvas along with
    an optional 'quality_tier', computing the full BOQ estimation in real-time.
    """
    try:
        tier = str(payload.get("quality_tier") or "medium").lower()
        cad_data = payload.get("cad_data") or payload
        boq_data = calculate_project_boq(cad_data, quality_tier=tier)
        return {
            "status": "success",
            "quality_tier": tier,
            "boq": boq_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live BOQ calculation failed: {str(e)}")


@app.get("/api/projects/{project_id}/export-boq-pdf")
def export_project_boq_pdf_endpoint(project_id: str, quality_tier: Optional[str] = None):
    """
    Generates and streams a dedicated multi-page professional PDF report of the complete
    Bill of Materials (BOQ), civil materials schedule, 7-phase construction timeline,
    labor wages schedule, MEP schedule, and architectural furniture fitout.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    project_name = project.get("name", "Project")
    created_at = project.get("created_at")

    tier = quality_tier
    if not tier:
        saved = get_project_boq(project_id)
        tier = saved.get("quality_tier") if saved else "medium"

    try:
        boq_data = calculate_project_boq(cad_data, quality_tier=tier)
        pdf_bytes = generate_detailed_boq_pdf(project_name, created_at, cad_data, boq_data)
        safe_name = "".join(c if (c.isalnum() or c in (' ', '_', '-')) else '_' for c in project_name).strip()
        filename = f"{safe_name}_BOQ_Estimate_{tier.capitalize()}.pdf" if safe_name else f"BOQ_Estimate_{tier.capitalize()}.pdf"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BOQ PDF generation error: {str(e)}")


@app.post("/api/projects/export-pdf-live")
def export_pdf_live_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    Generates and streams the Building Spatial Quantities & Engineering Schedules PDF (PDF 1)
    directly from in-memory / live CAD geometry without requiring prior persistence.
    """
    cad_data = payload.get("cad_data") or payload
    project_name = payload.get("project_name") or cad_data.get("project_name") or "Quantities_Report"
    created_at = datetime.now(timezone.utc).isoformat()
    try:
        pdf_bytes = generate_project_boq_pdf(project_name, created_at, cad_data)
        safe_name = "".join(c if (c.isalnum() or c in (' ', '_', '-')) else '_' for c in project_name).strip()
        filename = f"{safe_name}_Report.pdf" if safe_name else "Quantities_Report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live PDF generation error: {str(e)}")


@app.post("/api/projects/export-boq-pdf-live")
def export_boq_pdf_live_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    Generates and streams the Classified Material Quantities & Cost Estimate (BOQ PDF 2)
    directly from in-memory / live CAD geometry for any requested quality tier.
    """
    tier = str(payload.get("quality_tier") or "medium").lower()
    cad_data = payload.get("cad_data") or payload
    project_name = payload.get("project_name") or cad_data.get("project_name") or "BOQ_Estimate"
    created_at = datetime.now(timezone.utc).isoformat()
    try:
        boq_data = payload.get("boq_data")
        if not boq_data:
            boq_data = calculate_project_boq(cad_data, quality_tier=tier)
        pdf_bytes = generate_detailed_boq_pdf(project_name, created_at, cad_data, boq_data)
        safe_name = "".join(c if (c.isalnum() or c in (' ', '_', '-')) else '_' for c in project_name).strip()
        filename = f"{safe_name}_BOQ_{tier.capitalize()}.pdf" if safe_name else f"BOQ_{tier.capitalize()}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live BOQ PDF generation error: {str(e)}")


@app.get("/api/projects/{project_id}/export-json")
def export_project_json_endpoint(project_id: str):
    """
    Exports a consolidated, structured JSON project definition containing rooms,
    openings (doors/windows with heights and swings), HVAC equipment, and furniture items.
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    project_name = project.get("name", "Project_Data")

    export_payload = {
        "version": "2.0",
        "project_id": project_id,
        "project_name": project_name,
        "created_at": project.get("created_at"),
        "rooms": cad_data.get("rooms", []),
        "doors": cad_data.get("doors", []),
        "windows": cad_data.get("windows", []),
        "hvac_equipment": cad_data.get("hvac_equipment", []),
        "hvac_pipes": cad_data.get("hvac_pipes", []),
        "furniture": cad_data.get("furniture", []),
        "dimensions": cad_data.get("dimensions", [])
    }

    safe_name = "".join(c if (c.isalnum() or c in (' ', '_', '-')) else '_' for c in project_name).strip()
    filename = f"{safe_name}_Project.json" if safe_name else "Project.json"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    return Response(
        content=json.dumps(export_payload, indent=2),
        media_type="application/json",
        headers=headers
    )


async def process_and_save_upload(file: UploadFile, custom_name: Optional[str] = None) -> SolveResponse:
    filename = (file.filename or "").lower()
    if not (filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload a standard Excel spreadsheet (.xlsx or .xls)."
        )

    try:
        contents = await file.read()
        (
            rooms, openings, hvac_eq,
            furniture, plm_fixtures, plm_pipes,
            el_comps, el_ckts, el_routes
        ) = parse_excel_floorplan_full(contents)
        solved_response = process_geometry_solve_v2(
            rooms,
            openings,
            hvac_eq,
            furniture=furniture,
            plumbing_fixtures=plm_fixtures,
            plumbing_pipes=plm_pipes,
            electrical_components=el_comps,
            electrical_circuits=el_ckts,
            electrical_routes=el_routes,
        )
        
        if custom_name and custom_name.strip():
            project_name = custom_name.strip()
        else:
            base_name = os.path.splitext(file.filename or "Floorplan")[0]
            project_name = f"{base_name} ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')})"
        
        saved = save_project(name=project_name, cad_dict=solved_response.model_dump())
        
        solved_response.project_id = saved["id"]
        solved_response.project_name = saved["name"]
        solved_response.created_at = saved["created_at"]
        
        return solved_response
    except ExcelParsingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geometry solving error: {str(e)}")


@app.post("/api/projects", response_model=SolveResponse)
async def create_project(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None)
):
    """
    Accepts an uploaded Excel (.xlsx) file, parses and solves CAD geometry,
    persists the project into SQLite with an optional custom name, and returns the solved payload with project metadata.
    """
    return await process_and_save_upload(file, custom_name=name)


class ManualProjectCreateRequest(BaseModel):
    name: str
    rooms: List[RoomPayload]
    openings: Optional[List[OpeningPayload]] = []
    hvac_equipment: Optional[List[HVACEquipmentPayload]] = []
    furniture: Optional[List[FurniturePayload]] = []
    plumbing_fixtures: Optional[List[PlumbingFixturePayload]] = []
    plumbing_pipes: Optional[List[PlumbingPipePayload]] = []
    electrical_components: Optional[List[Dict[str, Any]]] = None
    electrical_circuits: Optional[List[Dict[str, Any]]] = None
    electrical_routes: Optional[List[Dict[str, Any]]] = None

@app.post("/api/projects/manual", response_model=SolveResponse)
def create_project_manual(request: ManualProjectCreateRequest):
    """
    Accepts raw architectural floorplan JSON payload (rooms with coordinates, openings, HVAC),
    computes 2D CAD walls, offsets, doors/windows CAD geometry, and HVAC layout,
    persists the project to SQLite, and returns the solved CAD payload with project_id.
    """
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Project name is required.")
    if not request.rooms or len(request.rooms) == 0:
        raise HTTPException(status_code=400, detail="At least one room is required.")

    try:
        el_comps = request.electrical_components or []
        el_ckts = request.electrical_circuits or []
        el_routes = request.electrical_routes or []
        solved = process_geometry_solve_v2(
            payload_or_rooms=request.rooms,
            openings=request.openings or [],
            hvac_equipment=request.hvac_equipment or [],
            furniture=request.furniture or [],
            plumbing_fixtures=request.plumbing_fixtures or [],
            plumbing_pipes=request.plumbing_pipes or [],
            electrical_components=el_comps,
            electrical_circuits=el_ckts,
            electrical_routes=el_routes
        )
        project_name = request.name.strip()
        solved.electrical_components = el_comps
        solved.electrical_circuits = el_ckts
        solved.electrical_routes = el_routes
        saved = save_project(name=project_name, cad_dict=solved.model_dump())
        solved.project_id = saved["id"]
        solved.project_name = saved["name"]
        solved.created_at = saved["created_at"]
        return solved
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geometry solving error: {str(e)}")


class AreaGenerateRoomItem(BaseModel):
    name: str
    category: Optional[str] = "General"
    width_mm: float
    depth_mm: float

class AreaGenerateRequest(BaseModel):
    name: str
    target_area_sqft: float
    rooms: Optional[List[AreaGenerateRoomItem]] = None
    requirements: Optional[Dict[str, Any]] = None
    layout_variant: Optional[int] = 0
    include_mep: Optional[bool] = False
    plot_width_ft: Optional[float] = None
    plot_depth_ft: Optional[float] = None
    front_setback_ft: Optional[float] = None
    rear_setback_ft: Optional[float] = None

@app.post("/api/projects/generate-from-area", response_model=SolveResponse)
def generate_project_from_area_endpoint(request: AreaGenerateRequest):
    """
    Converts approved room program and square footage into 2D CAD polygons,
    auto-generates standard architectural openings, solves geometry with wall offsets/fillets,
    persists project in SQLite, and returns SolveResponse with project_id for CAD editor.
    """
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Project name is required.")
    if request.target_area_sqft <= 0:
        raise HTTPException(status_code=400, detail="Target floor area must be greater than zero.")
    
    rooms_data = None
    if request.rooms:
        rooms_data = [r.model_dump() for r in request.rooms]

    try:
        solved = generate_and_save_area_plan(
            project_name=request.name.strip(),
            target_area_sqft=request.target_area_sqft,
            rooms_data=rooms_data,
            requirements=request.requirements,
            layout_variant=request.layout_variant or 0,
            include_mep=bool(request.include_mep or (request.requirements and request.requirements.get("include_mep"))),
            plot_constraints={
                "plot_width_ft": request.plot_width_ft,
                "plot_depth_ft": request.plot_depth_ft,
                "front_setback_ft": request.front_setback_ft,
                "rear_setback_ft": request.rear_setback_ft
            } if (request.plot_width_ft or request.plot_depth_ft) else None
        )
        return solved
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Floorplan generation error: {str(e)}")



class SwitchVariantRequest(BaseModel):
    variant: int = 0


@app.post("/api/projects/{project_id}/switch-variant", response_model=SolveResponse)
def switch_variant_endpoint(project_id: str, request: Optional[SwitchVariantRequest] = None):
    """
    Cycles or switches the architectural model/layout variation for an existing project
    (Model 1: Classic Dual-Wing, Model 2: Mirrored Wings, Model 3: Executive Villa, Model 4: Mirrored Executive),
    re-generating openings, re-solving CAD geometry, and persisting to SQLite.
    """
    from backend.services.area_to_plan import switch_project_layout_variant
    variant = request.variant if request is not None else 0
    try:
        res = switch_project_layout_variant(project_id, variant=variant)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to switch variant: {str(e)}")



class AutoPopulateMepRequest(BaseModel):
    room_filter: Optional[List[str]] = None
    include_openings: Optional[bool] = True
    include_electrical: Optional[bool] = True
    include_hvac: Optional[bool] = True
    include_furniture: Optional[bool] = True
    include_plumbing: Optional[bool] = True
    clear_existing: Optional[bool] = False


@app.post("/api/projects/{project_id}/auto-populate-mep")
def auto_populate_mep_endpoint(project_id: str, request: Optional[AutoPopulateMepRequest] = None):
    """
    Deterministically populates standard electrical fixtures (lights, fans, switchboards, sockets, AC isolators),
    HVAC equipment (Split-IDU and exterior ODU), furniture, and plumbing fixtures/pipes according to room type,
    builds circuits and routes orthogonal wire conduits, re-solves CAD geometry,
    and saves the updated project to SQLite.
    """
    from backend.services.mep_populator import auto_populate_project_mep
    req = request or AutoPopulateMepRequest()
    try:
        options = {
            "include_openings": req.include_openings if req.include_openings is not None else True,
            "include_electrical": req.include_electrical if req.include_electrical is not None else True,
            "include_hvac": req.include_hvac if req.include_hvac is not None else True,
            "include_furniture": req.include_furniture if req.include_furniture is not None else True,
            "include_plumbing": req.include_plumbing if req.include_plumbing is not None else True,
            "clear_existing": req.clear_existing if req.clear_existing is not None else False
        }
        res = auto_populate_project_mep(
            project_id=project_id,
            room_filter=req.room_filter,
            options=options
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-populate MEP: {str(e)}")


@app.get("/api/default-payload", response_model=SolveRequest)
def get_default_payload():
    rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
    openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
    hvac = [HVACEquipmentPayload(**h) for h in DEFAULT_TEST_HVAC]
    return SolveRequest(rooms=rooms, openings=openings, hvac_equipment=hvac)


@app.get("/api/download-template")
def download_excel_template():
    """Returns a pre-filled Excel template (.xlsx) for building room coordinates, doors/windows, and HVAC equipment."""
    excel_bytes = generate_excel_template_bytes()
    headers = {
        "Content-Disposition": "attachment; filename=CAD_Floorplan_Template.xlsx"
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@app.get("/api/download-2bhk-template")
def download_2bhk_excel_template():
    """Returns a pre-filled 2-BHK Excel template (.xlsx) with 4 rooms, 5 openings, and 3 HVAC units."""
    excel_bytes = generate_2bhk_template_bytes()
    headers = {
        "Content-Disposition": "attachment; filename=New_House_Plan_Test.xlsx"
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@app.get("/api/download-custom-plan")
def download_custom_house_plan():
    """Returns a pre-filled 3-BHK custom house Excel template (.xlsx) with 6 rooms, 12 openings, and 4 HVAC units."""
    excel_bytes = generate_custom_house_bytes()
    headers = {
        "Content-Disposition": "attachment; filename=Custom_Full_House_Plan.xlsx"
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@app.post("/api/upload-plan", response_model=SolveResponse)
async def upload_excel_plan(file: UploadFile = File(...)):
    """
    Accepts an uploaded Excel (.xlsx) file, parses room coordinates, doors/windows, and HVAC equipment,
    validates geometry, solves the parametric 2D CAD floorplan layout, and persists to SQLite.
    """
    return await process_and_save_upload(file)


@app.post("/solve", response_model=SolveResponse)
def solve_cad_geometry(request: SolveRequest):
    try:
        if not request.rooms:
            raise HTTPException(status_code=400, detail="Rooms list cannot be empty")
        response = process_geometry_solve_v2(
            request.rooms, 
            request.openings, 
            request.hvac_equipment, 
            request.furniture,
            request.plumbing_fixtures,
            request.plumbing_pipes
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/export-dxf")
def export_dxf_endpoint(payload: SolveResponse):
    """
    Accepts solved floorplan geometry payload (SolveResponse),
    generates a metric AutoCAD R2018 DXF drawing, and streams back the file download.
    """
    try:
        dxf_bytes = export_floorplan_to_dxf(payload)
        headers = {
            "Content-Disposition": "attachment; filename=floorplan_export.dxf"
        }
        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DXF generation error: {str(e)}")

