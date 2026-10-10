@echo off
echo Starting Parametric 2D CAD Engine Backend (FastAPI)...
cd /d %~dp0
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
