# MeplanIQ — 2D Architectural CAD & MEP Engineering Engine

An end-to-end parametric 2D Architectural CAD, MEP (Mechanical, Electrical, Plumbing) engineering drafting, and cost estimation platform built with **FastAPI**, **Shapely**, **ReportLab**, and **React 19 + Vite**.

---

## 🌟 Core Features

- **Architectural Drafting & Geometry Solve**:
  - Parametric room generation, filleted corners, party-wall offset detection, and polygon boundary calculation.
  - Interactive openings (doors with 90° swing arcs, windows with mullion lines).
  - Clearance checking & collision alerts for doors and walls.
- **Full MEP Engineering Disciplines**:
  - **HVAC**: Split-IDU, ODU placement, capacity (TR) & airflow (CFM) calculations, orthogonal refrigerant pair piping.
  - **Plumbing**: Sanitary fixture layouts, dual-line cold water supply & soil/waste drainage auto-routing, T-fittings and mechanical slope rules.
  - **Electrical**: 16 standard CAD symbols (downlights, tube lights, fans, sockets, distribution boards), circuit breaker sizing, and schematic conduit crossover wire hops.
  - **Furniture**: Standard architectural furniture blocks with smart deduplication and clearance validation.
- **3 Floorplan Creation Workflows**:
  - **6-Sheet Excel Roundtrip Engine**: Import/export complete project data across 6 engineering sheets (`Rooms`, `Doors & Windows`, `HVAC Equipment`, `Furniture Schedule`, `Plumbing Network`, and `Electrical Fixtures & Conduits`).
  - **Scratch / Manual Entry Mode**: Watertight 1-click room attachment assistant (`[+ Attach Right]`, `[+ Attach Top]`, etc.) with real-time vector mini-canvas preview.
  - **Area-to-Plan Generator**: Procedural room layout synthesis with real-world plot dimensions, setbacks, and instant MEP pre-population.
- **Professional Exports**:
  - **Vector PDF Blueprints**: Scaled 2D architectural drawing sheets (1:100 FIT) with standard title blocks, north arrows, room schedules, and legends.
  - **Bill of Quantities (BOQ)**: Interactive material & labor schedule with live customizable unit rates and instant cost recalculations.
  - **Layered DXF**: AutoCAD-compatible vector export organized into standardized CAD layers (`WALLS`, `DOORS`, `WINDOWS`, `HVAC`, `PLUMBING`, `ELECTRICAL`).

---

## 📁 Repository Structure

```text
cad_engine/
├── .gitignore                   # Ignored files (venv, node_modules, temp scripts, SQLite DBs)
├── README.md                    # Project documentation & setup instructions
├── pytest.ini                   # Pytest configuration
├── run_backend.bat              # Windows batch script to start FastAPI backend
├── run_frontend.bat             # Windows batch script to start Vite dev server
│
├── backend/                     # FastAPI Python Backend
│   ├── main.py                  # API endpoints & server entrypoint
│   ├── database.py              # SQLite storage for projects & CAD data
│   ├── models.py                # Pydantic schemas & payloads
│   ├── geometry.py              # Shapely geometric solving & room coordinate math
│   ├── excel_parser.py          # 6-sheet bidirectional Excel parser
│   ├── excel_exporter.py        # 6-sheet engineering Excel exporter
│   ├── pdf_exporter.py          # ReportLab vector blueprint & BOQ PDF generator
│   ├── dxf_exporter.py          # EzDXF layered AutoCAD export
│   ├── hvac_solver.py           # HVAC cooling load & airflow sizing
│   ├── plumbing_router.py       # Dual-line plumbing routing engine
│   ├── requirements.txt         # Python dependencies
│   ├── services/
│   │   ├── area_to_plan.py      # Area-to-Plan procedural generator with plot setbacks
│   │   └── mep_populator.py     # Automated MEP & furniture population service
│   ├── electrical/              # Electrical load calculations & breaker sizing
│   └── tests/                   # 121 comprehensive pytest test suites
│
└── frontend/                    # React 19 + Vite Frontend
    ├── package.json             # Node dependencies & build scripts
    ├── vite.config.js           # Vite configuration
    ├── src/
    │   ├── App.jsx              # Main application router
    │   ├── Canvas.jsx           # Central 2D CAD SVG interactive drafting canvas
    │   ├── pages/
    │   │   ├── HomePage.jsx     # Project dashboard & creation entrypoints
    │   │   └── EditorPage.jsx   # 2D CAD Studio & discipline coordination
    │   ├── components/
    │   │   ├── ManualEntryModal.jsx         # Watertight manual creation with mini-canvas
    │   │   ├── area-to-plan/                # Plot-constrained generator modal
    │   │   └── inspector/                   # Schedule tables & bottom docking drawer
    │   └── features/
    │       ├── boq/             # Interactive BOQ rate customizer & cost tables
    │       ├── electrical/      # Electrical SVG symbol renderers
    │       └── plumbing/        # Plumbing sanitaryware tables
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**

### 1. Backend Setup
```bash
# Navigate to project root
cd cad_engine

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```bash
# In a new terminal, navigate to frontend directory
cd cad_engine/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 🧪 Testing

### Backend Unit & Integration Tests (121 tests)
```bash
.venv\Scripts\activate
pytest backend/tests/ -v
```

### Frontend Build Verification
```bash
cd frontend
npm run build
```

---

## 📄 License
Proprietary engineering software. All rights reserved.
