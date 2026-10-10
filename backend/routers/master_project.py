from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from backend.master_project.generator import generate_master_residential_project

router = APIRouter(prefix="/api/projects", tags=["MasterProject"]) 

@router.post("/master-generate", response_model=Dict[str, Any])
def generate_master_project_endpoint():
    """Generate the comprehensive master residential project and persist it.
    Returns the saved project metadata and solved CAD payload.
    """
    try:
        result = generate_master_residential_project()
        return {
            "status": result.get("status"),
            "project": result.get("project"),
            "solve_response": result.get("solve_response"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Master project generation error: {str(e)}")
