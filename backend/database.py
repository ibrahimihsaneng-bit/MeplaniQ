import os
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "projects.db")
_CURRENT_DB_PATH: Optional[str] = None


def get_db_path() -> str:
    """Returns the active SQLite database file path."""
    if _CURRENT_DB_PATH is not None:
        return _CURRENT_DB_PATH
    return os.environ.get("CAD_DB_PATH", DEFAULT_DB_PATH)


def set_db_path(path: Optional[str]):
    """Overrides the active database path (used for test isolation)."""
    global _CURRENT_DB_PATH
    _CURRENT_DB_PATH = path


def get_db_connection():
    """Returns a SQLite connection object."""
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


_IS_INITIALIZING = False


def init_db():
    """Initializes the SQLite database and creates the projects and furniture_catalog tables if missing."""
    global _IS_INITIALIZING
    if _IS_INITIALIZING:
        return
    _IS_INITIALIZING = True
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                cad_json_data TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS furniture_catalog (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                default_width REAL NOT NULL,
                default_height REAL NOT NULL,
                min_width REAL NOT NULL,
                max_width REAL NOT NULL,
                min_height REAL NOT NULL,
                max_height REAL NOT NULL,
                description TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_boq (
                project_id TEXT PRIMARY KEY,
                quality_tier TEXT NOT NULL,
                boq_json_data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()
        seed_furniture_catalog()
        seed_default_samples()
    finally:
        _IS_INITIALIZING = False


def seed_furniture_catalog():
    """Seeds the furniture_catalog table from FURNITURE_CATALOG definition if empty or missing items."""
    try:
        from backend.geometry import FURNITURE_CATALOG
        conn = get_db_connection()
        cursor = conn.cursor()
        for name, data in FURNITURE_CATALOG.items():
            cid = name.lower().replace(" ", "-").replace("&", "and")
            cursor.execute("""
                INSERT OR IGNORE INTO furniture_catalog (
                    id, name, category, default_width, default_height,
                    min_width, max_width, min_height, max_height, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                cid,
                name,
                data.get("category", "General"),
                float(data.get("default_width", 1000.0)),
                float(data.get("default_height", 600.0)),
                float(data.get("min_width", 200.0)),
                float(data.get("max_width", 3000.0)),
                float(data.get("min_height", 200.0)),
                float(data.get("max_height", 3000.0)),
                data.get("description", "")
            ))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Failed to seed furniture catalog:", e)


def get_db_furniture_catalog() -> List[Dict[str, Any]]:
    """Retrieves all items from furniture_catalog table."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, category, default_width, default_height,
               min_width, max_width, min_height, max_height, description
        FROM furniture_catalog
        ORDER BY category, name
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_catalog_item(item_type: str) -> Optional[Dict[str, Any]]:
    """Looks up a specific catalog item by name or id."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, category, default_width, default_height,
               min_width, max_width, min_height, max_height, description
        FROM furniture_catalog
        WHERE LOWER(name) = LOWER(?) OR LOWER(id) = LOWER(?)
    """, (item_type, item_type))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def seed_default_samples():
    """Ensures the 3 default sample projects ('Sample 1-BHK', 'Sample 2-BHK', 'Sample 3-BHK') exist in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Sample 1-BHK
    cursor.execute("SELECT id, name FROM projects WHERE id = 'default-sample-1bhk'")
    row_1 = cursor.fetchone()
    if not row_1:
        try:
            from backend.geometry import (
                DEFAULT_TEST_PAYLOAD,
                DEFAULT_TEST_OPENINGS,
                DEFAULT_TEST_HVAC,
                RoomPayload,
                OpeningPayload,
                HVACEquipmentPayload,
                process_geometry_solve_v2
            )
            rooms = [RoomPayload(**r) for r in DEFAULT_TEST_PAYLOAD]
            openings = [OpeningPayload(**o) for o in DEFAULT_TEST_OPENINGS]
            hvac = [HVACEquipmentPayload(**h) for h in DEFAULT_TEST_HVAC]
            solved = process_geometry_solve_v2(rooms, openings, hvac)
            pid = "default-sample-1bhk"
            pname = "Sample 1-BHK"
            pdate = "2026-01-01T00:00:00Z"
            solved.project_id = pid
            solved.project_name = pname
            solved.created_at = pdate
            save_project(name=pname, cad_dict=solved.model_dump(), project_id=pid, created_at=pdate)
        except Exception as e:
            print("Failed to seed Sample 1-BHK:", e)

    # 2. Sample 2-BHK
    cursor.execute("SELECT id FROM projects WHERE id = 'default-sample-2bhk'")
    if not cursor.fetchone():
        try:
            from backend.geometry import generate_2bhk_template_bytes, process_geometry_solve_v2
            from backend.excel_parser import parse_excel_floorplan
            excel_bytes = generate_2bhk_template_bytes()
            rooms, openings, hvac = parse_excel_floorplan(excel_bytes)
            solved = process_geometry_solve_v2(rooms, openings, hvac)
            pid = "default-sample-2bhk"
            pname = "Sample 2-BHK"
            pdate = "2026-01-01T00:00:01Z"
            solved.project_id = pid
            solved.project_name = pname
            solved.created_at = pdate
            save_project(name=pname, cad_dict=solved.model_dump(), project_id=pid, created_at=pdate)
        except Exception as e:
            print("Failed to seed Sample 2-BHK:", e)

    # 3. Sample 3-BHK
    cursor.execute("SELECT id FROM projects WHERE id = 'default-sample-3bhk'")
    if not cursor.fetchone():
        try:
            from backend.geometry import generate_custom_house_bytes, process_geometry_solve_v2
            from backend.excel_parser import parse_excel_floorplan
            excel_bytes = generate_custom_house_bytes()
            rooms, openings, hvac = parse_excel_floorplan(excel_bytes)
            solved = process_geometry_solve_v2(rooms, openings, hvac)
            pid = "default-sample-3bhk"
            pname = "Sample 3-BHK"
            pdate = "2026-01-01T00:00:02Z"
            solved.project_id = pid
            solved.project_name = pname
            solved.created_at = pdate
            save_project(name=pname, cad_dict=solved.model_dump(), project_id=pid, created_at=pdate)
        except Exception as e:
            print("Failed to seed Sample 3-BHK:", e)

    conn.close()


def get_all_projects_summary() -> List[Dict[str, Any]]:
    """Returns a summary list of all saved projects (id, name, created_at) ordered newest first."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, created_at FROM projects ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "created_at": row["created_at"]
        }
        for row in rows
    ]


def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full project payload including solved CAD JSON data by project_id."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, created_at, cad_json_data FROM projects WHERE id = ?
    """, (project_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    try:
        cad_data = json.loads(row["cad_json_data"])
    except Exception:
        cad_data = {}

    # Check if CAD data needs geometry solve (e.g. if saved as raw rooms payload)
    if isinstance(cad_data, dict) and "rooms" in cad_data and "wall_polygons" not in cad_data:
        try:
            from backend.geometry import (
                RoomPayload,
                OpeningPayload,
                HVACEquipmentPayload,
                process_geometry_solve_v2
            )
            raw_rooms = [
                RoomPayload(
                    name=r.get("name", "Room"),
                    points=r.get("points", []),
                    fillet_radius=r.get("fillet_radius", 0.0)
                )
                for r in cad_data.get("rooms", [])
            ]
            raw_openings = [
                OpeningPayload(**o) for o in cad_data.get("openings", [])
            ]
            raw_hvac = [
                HVACEquipmentPayload(**h) for h in cad_data.get("hvac_equipment", [])
            ]
            solved = process_geometry_solve_v2(raw_rooms, raw_openings, raw_hvac)
            cad_data = solved.model_dump()
        except Exception:
            pass

    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "cad_json_data": cad_data
    }


def save_project(name: str, cad_dict: Dict[str, Any], project_id: Optional[str] = None, created_at: Optional[str] = None) -> Dict[str, Any]:
    """Saves or updates a project in the SQLite database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    if not project_id:
        project_id = str(uuid.uuid4())

    if not created_at:
        created_at = datetime.now(timezone.utc).isoformat()
    json_str = json.dumps(cad_dict)

    cursor.execute("""
        INSERT OR REPLACE INTO projects (id, name, created_at, cad_json_data)
        VALUES (?, ?, ?, ?)
    """, (project_id, name, created_at, json_str))

    conn.commit()
    conn.close()

    return {
        "id": project_id,
        "name": name,
        "created_at": created_at,
        "cad_json_data": cad_dict
    }


def delete_project(project_id: str) -> bool:
    """Deletes a project from the SQLite database by project_id."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0


def update_project_cad_data(project_id: str, cad_dict: Dict[str, Any], name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Updates an existing project's CAD payload in the SQLite database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    project_name = name if name else row["name"]
    created_at = row["created_at"]
    json_str = json.dumps(cad_dict)

    cursor.execute("""
        UPDATE projects SET name = ?, cad_json_data = ? WHERE id = ?
    """, (project_name, json_str, project_id))
    conn.commit()
    conn.close()

    return {
        "id": project_id,
        "name": project_name,
        "created_at": created_at,
        "cad_json_data": cad_dict
    }


def save_project_boq(project_id: str, quality_tier: str, boq_data: Dict[str, Any]) -> Dict[str, Any]:
    """Saves or updates calculated BOQ data and selected quality tier for a project in SQLite."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    updated_at = datetime.now(timezone.utc).isoformat()
    json_str = json.dumps(boq_data)

    cursor.execute("""
        INSERT OR REPLACE INTO project_boq (project_id, quality_tier, boq_json_data, updated_at)
        VALUES (?, ?, ?, ?)
    """, (project_id, quality_tier, json_str, updated_at))

    conn.commit()
    conn.close()

    return {
        "project_id": project_id,
        "quality_tier": quality_tier,
        "updated_at": updated_at,
        "boq_data": boq_data
    }


def get_project_boq(project_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves saved BOQ data and tier selection for a project from SQLite."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT project_id, quality_tier, boq_json_data, updated_at
        FROM project_boq
        WHERE project_id = ?
    """, (project_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    try:
        boq_data = json.loads(row["boq_json_data"])
    except Exception:
        boq_data = {}

    return {
        "project_id": row["project_id"],
        "quality_tier": row["quality_tier"],
        "updated_at": row["updated_at"],
        "boq_data": boq_data
    }
