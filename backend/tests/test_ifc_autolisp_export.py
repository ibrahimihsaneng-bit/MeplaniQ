"""
backend/tests/test_ifc_autolisp_export.py
=========================================
Unit tests for Autodesk AutoLISP (.lsp) and ISO 16739-1 IFC4 OpenBIM exporters.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.autolisp_exporter import export_floorplan_to_autolisp
from backend.ifc_exporter import export_floorplan_to_ifc

client = TestClient(app)

MOCK_SOLVE_DATA = {
    "walls": [
        {"p1": [0, 0], "p2": [5000, 0], "thickness": 200},
        {"p1": [5000, 0], "p2": [5000, 4000], "thickness": 200},
        {"p1": [5000, 4000], "p2": [0, 4000], "thickness": 200},
        {"p1": [0, 4000], "p2": [0, 0], "thickness": 200}
    ],
    "structural_columns": [
        {"id": "COL-1", "center_x": 0, "center_y": 0, "size": 300},
        {"id": "COL-2", "center_x": 5000, "center_y": 0, "size": 300}
    ],
    "hvac_ducts": [
        {"p1": [1000, 2000], "p2": [4000, 2000], "width_mm": 350, "height_mm": 250}
    ],
    "circuits": [
        {"id": "CKT-1", "name": "Living Light", "category": "lighting", "total_load_w": 360}
    ],
    "plumbing_pipes": [
        {"points": [[1000, 500], [1000, 3500]], "type": "drainage"}
    ]
}


def test_autolisp_export_structure():
    """Verifies that generated AutoLISP routine contains standard syntax, layers, and commands."""
    lsp = export_floorplan_to_autolisp(MOCK_SOLVE_DATA, project_name="Test Project")
    assert "(defun c:MEPDRAW" in lsp
    assert "(defun c:MEPCLEAN" in lsp
    assert "A-WALL-EXTR" in lsp
    assert "S-COLS" in lsp
    assert "M-DUCT-SUPP" in lsp
    assert "_zoom" in lsp
    assert "_pline" in lsp or "_line" in lsp


def test_ifc4_export_structure():
    """Verifies that generated IFC model conforms to ISO 16739-1:2018 IFC4 schema."""
    ifc = export_floorplan_to_ifc(MOCK_SOLVE_DATA, project_name="Test Building")
    assert "ISO-10303-21;" in ifc
    assert "FILE_SCHEMA(('IFC4'));" in ifc
    assert "IFCPROJECT" in ifc
    assert "IFCSITE" in ifc
    assert "IFCBUILDING" in ifc
    assert "IFCBUILDINGSTOREY" in ifc
    assert "IFCWALLSTANDARDCASE" in ifc
    assert "IFCCOLUMN" in ifc
    assert "IFCDUCTSEGMENT" in ifc
    assert "IFCPIPESEGMENT" in ifc
    assert "END-ISO-10303-21;" in ifc


def test_autolisp_rest_endpoint():
    """Tests POST /api/export-autolisp endpoint."""
    res = client.post("/api/export-autolisp", json=MOCK_SOLVE_DATA)
    assert res.status_code == 200
    assert "MEPDRAW" in res.text
    assert "Content-Disposition" in res.headers
    assert res.headers["Content-Disposition"].endswith(".lsp")


def test_ifc_rest_endpoint():
    """Tests POST /api/export-ifc endpoint."""
    res = client.post("/api/export-ifc", json=MOCK_SOLVE_DATA)
    assert res.status_code == 200
    assert "ISO-10303-21;" in res.text
    assert "IFC4" in res.text
    assert "Content-Disposition" in res.headers
    assert res.headers["Content-Disposition"].endswith(".ifc")
