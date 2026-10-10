"""
backend/routers/electrical.py
=============================
FastAPI router for the meplaniq Electrical Layout & Routing System.
Provides REST endpoints for electrical components, circuits, and wire routing.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from backend.electrical.schemas import (
    ElectricalComponentCreate,
    ElectricalComponentUpdate,
    ElectricalCircuitCreate,
    ElectricalCircuitUpdate,
    ElectricalWireRouteCreate,
    ElectricalLayoutResponse
)
from backend.electrical import service

router = APIRouter(prefix="/api/projects/{project_id}/electrical", tags=["Electrical"])


@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any])
def get_electrical_layout_endpoint(project_id: str):
    try:
        return service.get_electrical_layout(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch electrical layout: {str(e)}")


@router.post("/components", response_model=Dict[str, Any])
def add_electrical_component_endpoint(project_id: str, comp_data: ElectricalComponentCreate):
    try:
        return service.add_component(project_id, comp_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add electrical component: {str(e)}")


@router.put("/components/{component_id}", response_model=Dict[str, Any])
def update_electrical_component_endpoint(
    project_id: str,
    component_id: str,
    update_data: ElectricalComponentUpdate
):
    try:
        return service.update_component(project_id, component_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update electrical component: {str(e)}")


@router.delete("/components/{component_id}", response_model=Dict[str, Any])
def delete_electrical_component_endpoint(project_id: str, component_id: str):
    try:
        return service.delete_component(project_id, component_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete electrical component: {str(e)}")


@router.post("/circuits", response_model=Dict[str, Any])
def create_electrical_circuit_endpoint(project_id: str, circuit_data: ElectricalCircuitCreate):
    try:
        return service.create_circuit(project_id, circuit_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create electrical circuit: {str(e)}")


@router.put("/circuits/{circuit_id}", response_model=Dict[str, Any])
def update_electrical_circuit_endpoint(
    project_id: str,
    circuit_id: str,
    update_data: ElectricalCircuitUpdate
):
    try:
        return service.update_circuit(project_id, circuit_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update electrical circuit: {str(e)}")


@router.delete("/circuits/{circuit_id}", response_model=Dict[str, Any])
def delete_electrical_circuit_endpoint(project_id: str, circuit_id: str):
    try:
        return service.delete_circuit(project_id, circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete electrical circuit: {str(e)}")


@router.post("/routes", response_model=Dict[str, Any])
def add_electrical_route_endpoint(project_id: str, route_data: ElectricalWireRouteCreate):
    try:
        return service.add_route(project_id, route_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add electrical route: {str(e)}")


@router.delete("/routes/{route_id}", response_model=Dict[str, Any])
def delete_electrical_route_endpoint(project_id: str, route_id: str):
    try:
        return service.delete_route(project_id, route_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete electrical route: {str(e)}")


@router.post("/auto-route", response_model=Dict[str, Any])
def auto_route_electrical_endpoint(project_id: str):
    try:
        return service.auto_route_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-route electrical conduits: {str(e)}")
