"""
backend/electrical/service.py
=============================
Core service orchestration for the meplaniq Electrical Layout & Routing System.
Handles persistence in SQLite cad_json_data, wall snapping, room association,
topological connectivity, and deterministic auto-routing.
"""

from typing import Dict, Any, List, Optional
from backend.database import get_project_by_id, update_project_cad_data
from backend.electrical.fixtures import generate_component_id, get_fixture_definition
from backend.electrical.circuits import (
    generate_circuit_id,
    calculate_circuit_load,
    validate_circuit_capacity
)
from backend.electrical.geometry import (
    find_host_room,
    snap_to_nearest_wall,
    compute_polyline_length
)
from backend.electrical.routing import generate_circuit_routes
from backend.electrical.validation import (
    validate_component_data,
    validate_circuit_data,
    validate_wire_route_data
)
from backend.electrical.schemas import (
    ElectricalComponentCreate,
    ElectricalComponentUpdate,
    ElectricalCircuitCreate,
    ElectricalCircuitUpdate,
    ElectricalWireRouteCreate
)


def _ensure_electrical_keys(cad_data: Dict[str, Any]) -> None:
    if "electrical_components" not in cad_data or not isinstance(cad_data["electrical_components"], list):
        cad_data["electrical_components"] = []
    if "electrical_circuits" not in cad_data or not isinstance(cad_data["electrical_circuits"], list):
        cad_data["electrical_circuits"] = []
    if "electrical_routes" not in cad_data or not isinstance(cad_data["electrical_routes"], list):
        cad_data["electrical_routes"] = []


def get_electrical_layout(project_id: str) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    components = cad_data["electrical_components"]
    circuits = cad_data["electrical_circuits"]
    routes = cad_data["electrical_routes"]

    # Compute summary
    cat_counts: Dict[str, int] = {}
    total_wattage = 0.0
    for c in components:
        cat = c.get("category", "lighting")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        total_wattage += float(c.get("wattage", 0.0))

    summary = {
        "total_components": len(components),
        "total_circuits": len(circuits),
        "total_routes": len(routes),
        "total_load_w": round(total_wattage, 1),
        "category_breakdown": cat_counts
    }

    return {
        "components": components,
        "circuits": circuits,
        "routes": routes,
        "summary": summary
    }


def add_component(project_id: str, comp_data: ElectricalComponentCreate) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    raw_dict = comp_data.model_dump()
    rooms = cad_data.get("rooms", [])

    # Spatial host room check
    if not raw_dict.get("host_room_id") or not raw_dict.get("host_room_name"):
        host = find_host_room(raw_dict["x"], raw_dict["y"], rooms)
        if host:
            raw_dict["host_room_id"] = host.get("id") or host.get("name")
            raw_dict["host_room_name"] = host.get("name")

    # Spec lookup
    spec = get_fixture_definition(raw_dict.get("type", "recessed_downlight"))
    mounting = raw_dict.get("mounting") or spec.get("mounting", "ceiling")

    # Snap to wall if wall mounting is specified
    if mounting == "wall":
        snapped_x, snapped_y, angle, is_snapped = snap_to_nearest_wall(
            raw_dict["x"], raw_dict["y"], rooms
        )
        if is_snapped:
            raw_dict["x"] = snapped_x
            raw_dict["y"] = snapped_y
            raw_dict["wall_normal_angle"] = angle
            raw_dict["rotation"] = angle
            raw_dict["snapped_to_wall"] = True

    # ID Generation
    existing_ids = [c.get("id") for c in cad_data["electrical_components"] if c.get("id")]
    if not raw_dict.get("id"):
        raw_dict["id"] = generate_component_id(raw_dict.get("type", "recessed_downlight"), existing_ids)

    hvac_units = cad_data.get("hvac_equipment", [])
    validated = validate_component_data(raw_dict, existing_hvac_units=hvac_units)

    cad_data["electrical_components"].append(validated)

    # If linked to a circuit, update circuit load
    circuit_id = validated.get("circuit_id")
    if circuit_id:
        for ckt in cad_data["electrical_circuits"]:
            if ckt.get("id") == circuit_id:
                if validated["id"] not in ckt.setdefault("connected_component_ids", []):
                    ckt["connected_component_ids"].append(validated["id"])
                ckt_comps = [c for c in cad_data["electrical_components"] if c.get("id") in ckt["connected_component_ids"]]
                ckt["total_load_w"] = calculate_circuit_load(ckt_comps)

    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "component": validated, "cad_data": cad_data}


def update_component(
    project_id: str,
    comp_id: str,
    update_data: ElectricalComponentUpdate
) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    components = cad_data["electrical_components"]
    idx = next((i for i, c in enumerate(components) if c.get("id") == comp_id), None)
    if idx is None:
        raise ValueError(f"Electrical component with ID '{comp_id}' not found.")

    existing = components[idx]
    update_dict = update_data.model_dump(exclude_unset=True)

    # Merge
    merged = {**existing, **update_dict}
    rooms = cad_data.get("rooms", [])

    # If position changed and is wall-mounted, re-snap
    if ("x" in update_dict or "y" in update_dict) and merged.get("mounting") == "wall":
        snapped_x, snapped_y, angle, is_snapped = snap_to_nearest_wall(
            merged["x"], merged["y"], rooms
        )
        if is_snapped:
            merged["x"] = snapped_x
            merged["y"] = snapped_y
            merged["wall_normal_angle"] = angle
            merged["rotation"] = angle
            merged["snapped_to_wall"] = True

    hvac_units = cad_data.get("hvac_equipment", [])
    validated = validate_component_data(merged, existing_hvac_units=hvac_units)
    components[idx] = validated

    # Synchronize circuit membership if circuit_id changed
    old_circuit_id = existing.get("circuit_id")
    new_circuit_id = validated.get("circuit_id")
    if old_circuit_id != new_circuit_id:
        for ckt in cad_data["electrical_circuits"]:
            ids = ckt.setdefault("connected_component_ids", [])
            if ckt.get("id") == old_circuit_id and comp_id in ids:
                ids.remove(comp_id)
            if ckt.get("id") == new_circuit_id and comp_id not in ids:
                ids.append(comp_id)

    # Recalculate circuit loads
    for ckt in cad_data["electrical_circuits"]:
        ckt_comps = [c for c in components if c.get("id") in ckt.get("connected_component_ids", [])]
        ckt["total_load_w"] = calculate_circuit_load(ckt_comps)

    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "component": validated, "cad_data": cad_data}


def delete_component(project_id: str, comp_id: str) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    components = cad_data["electrical_components"]
    filtered = [c for c in components if c.get("id") != comp_id]
    if len(filtered) == len(components):
        raise ValueError(f"Electrical component with ID '{comp_id}' not found.")

    cad_data["electrical_components"] = filtered

    # Remove component ID from any circuits
    for ckt in cad_data["electrical_circuits"]:
        ids = ckt.get("connected_component_ids", [])
        if comp_id in ids:
            ids.remove(comp_id)
        ckt_comps = [c for c in filtered if c.get("id") in ids]
        ckt["total_load_w"] = calculate_circuit_load(ckt_comps)

    # Remove any wire routes referencing this component
    routes = cad_data["electrical_routes"]
    cad_data["electrical_routes"] = [
        r for r in routes
        if r.get("from_component_id") != comp_id and r.get("to_component_id") != comp_id
    ]

    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "message": f"Deleted component {comp_id}", "cad_data": cad_data}


def create_circuit(project_id: str, circuit_data: ElectricalCircuitCreate) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    raw_dict = circuit_data.model_dump()
    existing_ids = [c.get("id") for c in cad_data["electrical_circuits"] if c.get("id")]
    if not raw_dict.get("id"):
        raw_dict["id"] = generate_circuit_id(existing_ids, raw_dict.get("category", "lighting"))

    components = cad_data["electrical_components"]
    validated = validate_circuit_data(raw_dict, all_components=components)

    # Calculate load
    ckt_comps = [c for c in components if c.get("id") in validated.get("connected_component_ids", [])]
    validated["total_load_w"] = calculate_circuit_load(ckt_comps)

    cad_data["electrical_circuits"].append(validated)
    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "circuit": validated, "cad_data": cad_data}


def update_circuit(
    project_id: str,
    circuit_id: str,
    update_data: ElectricalCircuitUpdate
) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    circuits = cad_data["electrical_circuits"]
    idx = next((i for i, c in enumerate(circuits) if c.get("id") == circuit_id), None)
    if idx is None:
        raise ValueError(f"Electrical circuit with ID '{circuit_id}' not found.")

    existing = circuits[idx]
    update_dict = update_data.model_dump(exclude_unset=True)
    merged = {**existing, **update_dict}

    components = cad_data["electrical_components"]
    validated = validate_circuit_data(merged, all_components=components)

    ckt_comps = [c for c in components if c.get("id") in validated.get("connected_component_ids", [])]
    validated["total_load_w"] = calculate_circuit_load(ckt_comps)

    circuits[idx] = validated
    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "circuit": validated, "cad_data": cad_data}


def delete_circuit(project_id: str, circuit_id: str) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    circuits = cad_data["electrical_circuits"]
    filtered = [c for c in circuits if c.get("id") != circuit_id]
    if len(filtered) == len(circuits):
        raise ValueError(f"Electrical circuit with ID '{circuit_id}' not found.")

    cad_data["electrical_circuits"] = filtered

    # Remove attached routes
    routes = cad_data["electrical_routes"]
    cad_data["electrical_routes"] = [r for r in routes if r.get("circuit_id") != circuit_id]

    # Disassociate components
    for comp in cad_data["electrical_components"]:
        if comp.get("circuit_id") == circuit_id:
            comp["circuit_id"] = None

    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "message": f"Deleted circuit {circuit_id}", "cad_data": cad_data}


def add_route(project_id: str, route_data: ElectricalWireRouteCreate) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    raw_dict = route_data.model_dump()
    validated = validate_wire_route_data(raw_dict)

    if not validated.get("id"):
        count = len(cad_data["electrical_routes"]) + 1
        validated["id"] = f"WR-{count}"

    if not validated.get("length_mm") or validated["length_mm"] == 0:
        validated["length_mm"] = compute_polyline_length(validated["points"])

    cad_data["electrical_routes"].append(validated)
    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "route": validated, "cad_data": cad_data}


def delete_route(project_id: str, route_id: str) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    routes = cad_data["electrical_routes"]
    filtered = [r for r in routes if r.get("id") != route_id]
    if len(filtered) == len(routes):
        raise ValueError(f"Electrical route with ID '{route_id}' not found.")

    cad_data["electrical_routes"] = filtered
    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "message": f"Deleted route {route_id}", "cad_data": cad_data}


def auto_route_project(project_id: str) -> Dict[str, Any]:
    project = get_project_by_id(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    cad_data = project.get("cad_json_data", {})
    _ensure_electrical_keys(cad_data)

    components = cad_data["electrical_components"]
    circuits = cad_data["electrical_circuits"]

    # Filter out previously auto-generated routes to avoid stale duplicates, keeping manual routes
    manual_routes = [r for r in cad_data["electrical_routes"] if not r.get("is_auto_generated", False)]
    new_routes = list(manual_routes)

    route_idx = 1
    for ckt in circuits:
        ckt_routes = generate_circuit_routes(ckt, components, start_route_index=route_idx)
        new_routes.extend(ckt_routes)
        route_idx += len(ckt_routes) + 1

    cad_data["electrical_routes"] = new_routes
    update_project_cad_data(project_id, cad_data, project.get("name"))
    return {"status": "success", "routes_generated": len(new_routes) - len(manual_routes), "routes": new_routes, "cad_data": cad_data}
