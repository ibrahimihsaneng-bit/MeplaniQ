import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Canvas from '../Canvas';
import StatusBar from '../StatusBar';
import RoomTable from '../RoomTable';
import OpeningsTable from '../OpeningsTable';
import HVACTable from '../HVACTable';
import FurnitureTable from '../FurnitureTable';
import PlumbingTable from '../PlumbingTable';
import ErrorBoundary from '../components/ErrorBoundary';
import EngineeringInspector from '../components/inspector/EngineeringInspector';
import BottomScheduleEditor from '../components/inspector/BottomScheduleEditor';
import Toast from '../Toast';
import CloudModal from '../CloudModal';
import ExportImageModal from '../components/ExportImageModal';
import DisciplineSelector from '../features/discipline/DisciplineSelector';
import {
  DISCIPLINE_VIEWS,
  DISCIPLINE_DISPLAY_MODES,
  DISCIPLINE_CONFIG
} from '../features/discipline/disciplineTypes';
import { getCurrentUser, saveProjectToCloud } from '../supabaseClient';
import {
  fetchDefaultPayload,
  solveCadGeometry,
  uploadExcelPlan,
  exportDxf,
  downloadProjectPdf,
  downloadProjectExcel,
  exportExcel,
  fetchProjectById,
  updateProjectById,
  createManualProject,
  autoRouteElectrical,
  autoPopulateProjectMep,
  switchProjectVariant,
  calculateProjectBoq,
  fetchProjectBoq,
  calculateBoqLive,
  getProjectBoqPdfUrl,
  downloadProjectBoqPdf
} from '../api';
import QualityTierSelectorModal from '../features/boq/QualityTierSelectorModal';
import BoqDashboardModal from '../features/boq/BoqDashboardModal';
import ValidationDrawer from '../components/ValidationDrawer';
import { generateProjectCoordinatedMep, convertSolveDataToCadEntities } from '../features/mep/projectMepEngine';
import AutoMepModal from '../features/mep/AutoMepModal';
import MepCalculationModal from '../features/mep/MepCalculationModal';
import AutoCadClashDrawer from '../features/autocad/AutoCadClashDrawer';
import AutoCadEngineeringPanel from '../features/autocad/AutoCadEngineeringPanel';
import AutoCad3DViewport from '../features/autocad/AutoCad3DViewport';
import { generateMasterSubmissionAudit } from '../features/autocad/cadGeometryUtils';
import '../styles.css';

const DEFAULT_TRANSFORM = { x: 0, y: 0, width: 0.1, height: 0.1 };

export default function EditorPage() {
  const params = useParams();
  const rawId = params.id || params.projectId;
  const navigate = useNavigate();
  const location = useLocation();

  // Canonical project ID extraction & defensive sanitization
  const id = (rawId && rawId !== "undefined" && rawId !== "null" && rawId.trim()) ? rawId.trim() : null;

  const [solveData, setSolveData] = useState(null);
  const [editableDoors, setEditableDoors] = useState([]);
  const [editableWindows, setEditableWindows] = useState([]);
  const [editableHvac, setEditableHvac] = useState([]);
  const [editableFurniture, setEditableFurniture] = useState([]);
  const [editablePlumbingFixtures, setEditablePlumbingFixtures] = useState([]);
  const [editablePlumbingPipes, setEditablePlumbingPipes] = useState([]);
  const [editableElectricalComponents, setEditableElectricalComponents] = useState([]);
  const [editableElectricalCircuits, setEditableElectricalCircuits] = useState([]);
  const [editableElectricalRoutes, setEditableElectricalRoutes] = useState([]);
  const [selectedElectricalFixtureType, setSelectedElectricalFixtureType] = useState('recessed_downlight');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Canvas-First Workbench States
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'wall' | 'door' | 'window' | 'hvac' | 'plumbing' | 'furniture' | 'electrical'
  const [selectedElement, setSelectedElement] = useState(null);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState(false);

  // Coordinated Auto-MEP & BIM Studio States
  const [isAutoMepModalOpen, setIsAutoMepModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isClashDrawerOpen, setIsClashDrawerOpen] = useState(false);
  const [clashData, setClashData] = useState(null);
  const [isEngineeringPanelOpen, setIsEngineeringPanelOpen] = useState(false);
  const [is3DViewActive, setIs3DViewActive] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);

  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showDoors, setShowDoors] = useState(true);
  const [showWindows, setShowWindows] = useState(true);
  const [showHvac, setShowHvac] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [showPlumbing, setShowPlumbing] = useState(true);
  const [showElectrical, setShowElectrical] = useState(true);
  const [scaleModeFixed, setScaleModeFixed] = useState(true);
  const [isResizeModeActive, setIsResizeModeActive] = useState(false);
  const [canvasRenderKey, setCanvasRenderKey] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'openings' | 'hvac' | 'furniture' | 'plumbing' | 'electrical'
  const [disciplineView, setDisciplineView] = useState(() => {
    try {
      return localStorage.getItem(`meplaniq:discipline-view:${id || 'default'}`) || DISCIPLINE_VIEWS.ALL;
    } catch (e) {
      return DISCIPLINE_VIEWS.ALL;
    }
  });
  const [disciplineDisplayMode, setDisciplineDisplayMode] = useState(() => {
    try {
      return localStorage.getItem(`meplaniq:discipline-mode:${id || 'default'}`) || DISCIPLINE_DISPLAY_MODES.DIM;
    } catch (e) {
      return DISCIPLINE_DISPLAY_MODES.DIM;
    }
  });
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ x: 0, y: 0 });
  const [viewTransform, setViewTransform] = useState(DEFAULT_TRANSFORM);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingDxf, setIsExportingDxf] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [cloudModalInitialTab, setCloudModalInitialTab] = useState('projects');
  
  // BOQ & Cost Estimation State
  const [isBoqDashboardOpen, setIsBoqDashboardOpen] = useState(false);
  const [isTierSelectorOpen, setIsTierSelectorOpen] = useState(false);
  const [activeQualityTier, setActiveQualityTier] = useState("medium");
  const [boqData, setBoqData] = useState(null);
  const [isCalculatingBoq, setIsCalculatingBoq] = useState(false);
  const [isExportingBoqPdf, setIsExportingBoqPdf] = useState(false);

  const fileInputRef = useRef(null);
  const handleCycleVariantRef = useRef(null);

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const handleDisciplineViewChange = useCallback((newView) => {
    setDisciplineView(newView);
    try {
      localStorage.setItem(`meplaniq:discipline-view:${id || 'default'}`, newView);
    } catch (e) {
      console.error("Failed to save discipline view to localStorage", e);
    }

    // Automatically synchronize the bottom schedule table tab to match
    if (newView === DISCIPLINE_VIEWS.HVAC) {
      setActiveTab('hvac');
      setIsScheduleCollapsed(false);
    } else if (newView === DISCIPLINE_VIEWS.PLUMBING) {
      setActiveTab('plumbing');
      setIsScheduleCollapsed(false);
    } else if (newView === DISCIPLINE_VIEWS.ELECTRICAL) {
      setActiveTab('electrical');
      setIsScheduleCollapsed(false);
    } else if (newView === DISCIPLINE_VIEWS.ARCHITECTURE) {
      setActiveTab(prev => ['hvac', 'plumbing', 'electrical'].includes(prev) ? 'rooms' : prev);
    }

    const config = DISCIPLINE_CONFIG[newView];
    if (config) {
      showToast(`View switched to ${config.label} Discipline`, "info");
    }
  }, [id, showToast]);

  const handleToggleDisplayMode = useCallback(() => {
    setDisciplineDisplayMode(prev => {
      const next = prev === DISCIPLINE_DISPLAY_MODES.DIM
        ? DISCIPLINE_DISPLAY_MODES.ISOLATE
        : DISCIPLINE_DISPLAY_MODES.DIM;
      try {
        localStorage.setItem(`meplaniq:discipline-mode:${id || 'default'}`, next);
      } catch (e) {
        console.error("Failed to save discipline mode to localStorage", e);
      }
      showToast(
        next === DISCIPLINE_DISPLAY_MODES.ISOLATE 
          ? "Display Mode: Isolate (Inactive disciplines hidden)"
          : "Display Mode: Ghost (Inactive disciplines dimmed at 18%)",
        "info"
      );
      return next;
    });
  }, [id, showToast]);

  // Keyboard Shortcuts Listener for Tool Palette & Discipline Views
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Numerical keys 1-5 switch discipline view
      if (e.key === '1') {
        handleDisciplineViewChange(DISCIPLINE_VIEWS.ALL);
      } else if (e.key === '2') {
        handleDisciplineViewChange(DISCIPLINE_VIEWS.ARCHITECTURE);
      } else if (e.key === '3') {
        handleDisciplineViewChange(DISCIPLINE_VIEWS.HVAC);
      } else if (e.key === '4') {
        handleDisciplineViewChange(DISCIPLINE_VIEWS.PLUMBING);
      } else if (e.key === '5') {
        handleDisciplineViewChange(DISCIPLINE_VIEWS.ELECTRICAL);
      } else if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedElement(null);
        setIsValidationDrawerOpen(false);
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wall');
        setActiveTab('rooms');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'd' || e.key === 'D') {
        setActiveTool('door');
        setActiveTab('openings');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'n' || e.key === 'N') {
        setActiveTool('window');
        setActiveTab('openings');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hvac');
        setActiveTab('hvac');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('plumbing');
        setActiveTab('plumbing');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'f' || e.key === 'F') {
        setActiveTool('furniture');
        setActiveTab('furniture');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('electrical');
        setActiveTab('electrical');
        setIsScheduleCollapsed(false);
      } else if (e.key === 'g' || e.key === 'G') {
        setShowGrid(prev => !prev);
      } else if ((e.key === 'm' || e.key === 'M') || (e.key === 'Shift' && !e.ctrlKey && !e.altKey)) {
        if (handleCycleVariantRef.current) {
          handleCycleVariantRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDisciplineViewChange]);

  // Focus and highlight problem elements from the Validation Drawer
  const handleSelectIssue = useCallback((issue) => {
    if (issue?.coords && Number.isFinite(issue.coords.x) && Number.isFinite(issue.coords.y)) {
      setViewTransform(prev => ({
        ...prev,
        x: -issue.coords.x * prev.width + 450,
        y: -issue.coords.y * prev.height + 300
      }));
    }

    let targetItem = null;
    if (issue.type === 'Door') {
      targetItem = editableDoors.find(d => d.id === issue.targetId) || solveData?.doors?.find(d => d.id === issue.targetId);
    } else if (issue.type === 'Window') {
      targetItem = editableWindows.find(w => w.id === issue.targetId) || solveData?.windows?.find(w => w.id === issue.targetId);
    } else if (issue.type === 'HVAC') {
      targetItem = editableHvac.find(h => h.id === issue.targetId) || solveData?.hvac_equipment?.find(h => h.id === issue.targetId);
    } else if (issue.type === 'Plumbing') {
      targetItem = editablePlumbingFixtures.find(f => f.id === issue.targetId) || solveData?.plumbing_fixtures?.find(f => f.id === issue.targetId);
    } else if (issue.type === 'Furniture') {
      targetItem = editableFurniture.find(f => f.id === issue.targetId) || solveData?.furniture?.find(f => f.id === issue.targetId);
    } else if (issue.type === 'Room') {
      targetItem = solveData?.rooms?.find(r => r.name === issue.targetId);
    }

    if (targetItem) {
      setSelectedElement({ type: issue.type, item: targetItem });
      setIsInspectorCollapsed(false);
    }
  }, [editableDoors, editableWindows, editableHvac, editablePlumbingFixtures, editableFurniture, solveData]);

  // Total issues tally for status bar badge
  const totalIssuesCount = useMemo(() => {
    let count = 0;
    const fixtures = editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || []);
    const furniture = editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || []);
    const hvac = editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []);

    fixtures.forEach(f => {
      const s = f.clearance_status || '';
      if (s.includes('Overlap') || s.includes('Collision') || s.includes('Wall')) count++;
    });
    furniture.forEach(f => {
      const s = f.clearance_status || '';
      if (s.includes('Blocks') || s.includes('Wall') || s.includes('Overlap')) count++;
    });
    hvac.forEach(h => {
      if (Number(h.cooling_capacity_tr || h.capacity_tr || 0) <= 0) count++;
    });
    return count;
  }, [solveData, editablePlumbingFixtures, editableFurniture, editableHvac]);

  const handleSaveToCloud = async () => {
    if (!currentUser) {
      setCloudModalInitialTab('auth');
      setIsCloudModalOpen(true);
      return;
    }
    if (!solveData) {
      showToast("No active floorplan to save.", "error");
      return;
    }
    try {
      const res = await saveProjectToCloud(currentUser, solveData);
      showToast(`Floorplan successfully saved to ${res.storageType}!`, "success");
    } catch (err) {
      console.error("Cloud save error:", err);
      showToast(err.message || "Failed to save to Cloud.", "error");
    }
  };

  const handleOpenCloudVault = () => {
    if (!currentUser) {
      setCloudModalInitialTab('auth');
    } else {
      setCloudModalInitialTab('projects');
    }
    setIsCloudModalOpen(true);
  };

  const handleLoadCloudProject = async (cadPayload) => {
    if (!cadPayload) return;
    try {
      let solved;
      if (cadPayload.rooms) {
        solved = await createManualProject({
          name: cadPayload.project_name || "Cloud Floorplan",
          rooms: cadPayload.rooms.map(r => ({ name: r.name, points: r.points, fillet_radius: 0.0 })),
          openings: cadPayload.openings || [],
          hvac_equipment: cadPayload.hvac_equipment || []
        });
      }
      if (solved) {
        setSolveData(solved);
        setEditableDoors(solved.doors || []);
        setEditableWindows(solved.windows || []);
        setEditableHvac(solved.hvac_equipment || []);
        setEditableFurniture(solved.furniture || []);
        setEditablePlumbingFixtures(solved.plumbing_fixtures || []);
        setEditablePlumbingPipes(solved.plumbing_pipes || []);
        setEditableElectricalComponents(solved.electrical_components || cadPayload.electrical_components || []);
        setEditableElectricalCircuits(solved.electrical_circuits || cadPayload.electrical_circuits || []);
        setEditableElectricalRoutes(solved.electrical_routes || cadPayload.electrical_routes || []);
        setIsDirty(false);
        if (solved.rooms) {
          setViewTransform(calculateFitView(solved.rooms));
        }
        if (solved.project_id) {
          navigate(`/projects/${encodeURIComponent(solved.project_id)}/cad`, { replace: true });
        }
        showToast(`Loaded "${cadPayload.project_name || 'Floorplan'}" from Cloud Database!`, "success");
      }
    } catch (err) {
      console.error("Failed to solve cloud floorplan:", err);
      setSolveData(cadPayload);
      showToast("Loaded floorplan from cloud cache.", "info");
    }
  };

  const calculateFitView = useCallback((rooms) => {
    if (!rooms || rooms.length === 0) return DEFAULT_TRANSFORM;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    rooms.forEach(room => {
      const pts = room.filleted_points || room.points || [];
      pts.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
    });

    if (minX === Infinity) return DEFAULT_TRANSFORM;
    
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);

    const padding = 2000;
    const cadWidth = (maxX - minX) + padding * 2;
    const cadHeight = (maxY - minY) + padding * 2;
    
    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const containerHeight = typeof window !== 'undefined' ? window.innerHeight - 150 : 800;

    const zoomX = containerWidth / cadWidth;
    const zoomY = containerHeight / cadHeight;
    const zoom = Math.min(zoomX, zoomY, 1.0) || 0.1;

    const cadCenterX = (minX + maxX) / 2;
    const cadCenterY = (minY + maxY) / 2;

    const panX = containerWidth / 2 - cadCenterX * zoom;
    const panY = containerHeight / 2 - cadCenterY * zoom;

    return {
      x: panX,
      y: panY,
      width: zoom,
      height: zoom
    };
  }, []);

  // Redirect if missing ID on /projects route
  useEffect(() => {
    if (!id && location.pathname.startsWith('/projects')) {
      navigate('/projects', { replace: true });
    }
  }, [id, location.pathname, navigate]);

  const loadProjectData = useCallback(async (isCancelled = () => false) => {
    if (!id) {
      if (location.pathname.startsWith('/projects')) {
        return;
      }
      // On generic /editor route without project ID, load default demo payload
      setLoading(true);
      setError(null);
      try {
        const defaultPayload = await fetchDefaultPayload();
        if (isCancelled()) return;
        const solved = await solveCadGeometry(
          defaultPayload.rooms,
          defaultPayload.openings,
          defaultPayload.hvac_equipment
        );
        if (isCancelled()) return;
        setSolveData(solved);
        setEditableDoors(solved.doors || []);
        setEditableWindows(solved.windows || []);
        setEditableHvac(solved.hvac_equipment || []);
        setEditableFurniture(solved.furniture || []);
        setEditablePlumbingFixtures(solved.plumbing_fixtures || []);
        setEditablePlumbingPipes(solved.plumbing_pipes || []);
        setEditableElectricalComponents(solved.electrical_components || defaultPayload.electrical_components || []);
        setEditableElectricalCircuits(solved.electrical_circuits || defaultPayload.electrical_circuits || []);
        setEditableElectricalRoutes(solved.electrical_routes || defaultPayload.electrical_routes || []);
        setIsDirty(false);
        if (solved.rooms) {
          setViewTransform(calculateFitView(solved.rooms));
        }
        setCanvasRenderKey(Date.now());
      } catch (err) {
        if (isCancelled()) return;
        console.error("Initialization error:", err);
        setError("Failed to load default floorplan geometry.");
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
      return;
    }

    // We have a valid project ID: fetch from backend
    setLoading(true);
    setError(null);
    try {
      let payload = await fetchProjectById(id);
      if (isCancelled()) return;

      if (!payload) {
        throw new Error(`Project with ID '${id}' was not found.`);
      }

      // Re-solve on-the-fly if needed
      if ((!payload.wall_polygons || payload.wall_polygons.length === 0) && payload.rooms) {
        try {
          const solved = await solveCadGeometry(
            payload.rooms,
            payload.openings || [],
            payload.hvac_equipment || []
          );
          if (isCancelled()) return;
          payload = {
            ...solved,
            project_id: id,
            project_name: payload.name || payload.project_name || "Floorplan"
          };
        } catch (e) {
          console.warn("Failed to solve on-the-fly, using payload as-is:", e);
        }
      }

      setSolveData(payload);
      if (payload.layout_variant !== undefined) {
        setCurrentVariant(Number(payload.layout_variant) % 4);
      }
      setEditableDoors(payload.doors || []);
      setEditableWindows(payload.windows || []);
      setEditableHvac(payload.hvac_equipment || []);
      setEditableFurniture(payload.furniture || []);
      setEditablePlumbingFixtures(payload.plumbing_fixtures || []);
      setEditablePlumbingPipes(payload.plumbing_pipes || []);
      setEditableElectricalComponents(payload.electrical_components || []);
      setEditableElectricalCircuits(payload.electrical_circuits || []);
      setEditableElectricalRoutes(payload.electrical_routes || []);
      setIsDirty(false);
      if (payload.rooms && payload.rooms.length > 0) {
        setViewTransform(calculateFitView(payload.rooms));
      }
      setCanvasRenderKey(Date.now());
    } catch (err) {
      if (isCancelled()) return;
      console.error("Failed to load project:", err);
      setError(`Project "${id}" could not be loaded: ${err.message || 'Project not found.'}`);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }, [id, location.pathname, calculateFitView]);

  useEffect(() => {
    let cancelled = false;
    loadProjectData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadProjectData]);

  const [isPopulatingMep, setIsPopulatingMep] = useState(false);
  const [currentVariant, setCurrentVariant] = useState(0);
  const [isSwitchingVariant, setIsSwitchingVariant] = useState(false);

  // Convert solveData to CAD entities for 3D Viewport, Clash Detection, and Analytics Panel
  const cadEntities = useMemo(() => convertSolveDataToCadEntities(solveData), [solveData]);
  const detectedRoomsMemo = useMemo(() => (solveData?.rooms || []).map(r => ({
    name: r.name,
    carpet_area_sqm: r.carpet_area_sqm || 15,
    perimeter_m: 16
  })), [solveData]);

  const handleApplyCoordinatedMep = useCallback((options = {}) => {
    if (!solveData || !solveData.rooms || solveData.rooms.length === 0) {
      showToast("No rooms found to coordinate MEP. Please draw or load a floorplan first.", "warning");
      return;
    }

    try {
      showToast("⚙️ Computing ASHRAE CFM airflow, duct sizing & coordinated MEP...", "info");
      const res = generateProjectCoordinatedMep(solveData, options);

      if (!res || !res.success) {
        showToast(res?.error || "Failed to generate coordinated MEP.", "error");
        return;
      }

      setSolveData(prev => ({
        ...prev,
        hvac_ducts: res.hvac_ducts,
        hvac_diffusers: res.hvac_diffusers,
        hvac_return_grilles: res.hvac_return_grilles,
        hvac_equipment: [
          ...(prev?.hvac_equipment || []).filter(e => e.unit_type !== 'Central-AHU' && e.type !== 'AHU'),
          ...res.hvac_equipment
        ],
        structural_columns: res.structural_columns,
        structural_grid: res.structural_grid,
        clash_markers: res.clash_markers
      }));

      if (res.electrical_components && res.electrical_components.length > 0) {
        setEditableElectricalComponents(res.electrical_components);
      }
      if (res.electrical_routes && res.electrical_routes.length > 0) {
        setEditableElectricalRoutes(res.electrical_routes);
      }
      if (res.plumbing_fixtures && res.plumbing_fixtures.length > 0) {
        setEditablePlumbingFixtures(res.plumbing_fixtures);
      }
      if (res.plumbing_pipes && res.plumbing_pipes.length > 0) {
        setEditablePlumbingPipes(res.plumbing_pipes);
      }

      const cData = {
        clashes: res.clash_markers || [],
        summary: {
          total: res.clash_markers.length,
          hard: res.clash_markers.filter(c => c.severity === 'HARD').length,
          clearance: res.clash_markers.filter(c => c.severity === 'CLEARANCE').length,
          status: res.clash_markers.length === 0 ? 'COORDINATED' : 'INTERFERENCE_FLAGGED'
        }
      };
      setClashData(cData);

      setIsDirty(true);
      showToast(`Coordinated MEP Applied: ${res.summary.totalCfm} CFM Total Airflow (${res.summary.diffuserCount} Diffusers, ${res.summary.columnCount} Columns)`, "success");

      if (options.includeClashDetection && res.clash_markers.length > 0) {
        setIsClashDrawerOpen(true);
      }
    } catch (err) {
      console.error("Auto MEP Generation Error:", err);
      showToast("Error generating coordinated MEP: " + err.message, "error");
    }
  }, [solveData, showToast]);

  const handleGenerateMasterSubmissionAudit = useCallback(() => {
    if (!solveData) return;
    const entities = convertSolveDataToCadEntities(solveData);
    const detectedRooms = (solveData.rooms || []).map(r => ({
      name: r.name,
      carpet_area_sqm: r.carpet_area_sqm || 15,
      perimeter_m: 16
    }));
    const audit = generateMasterSubmissionAudit(entities, detectedRooms, solveData.project_name || "MeplanIQ Engineering Project");
    const jsonStr = JSON.stringify(audit, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(solveData.project_name || 'MeplanIQ_BIM').replace(/\s+/g, '_')}_Master_Audit_Dossier.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Master Engineering Certification Dossier exported (.JSON)!", "success");
  }, [solveData, showToast]);

  const handleAutoPopulateMep = async (options = {}) => {
    const currentProjectId = solveData?.project_id || id;
    if (!currentProjectId) {
      showToast("Please save or open a project first to auto-populate MEP.", "warning");
      return;
    }

    try {
      setIsPopulatingMep(true);
      showToast("⚡ Auto-populating MEP, Plumbing fixtures & Furniture...", "info");
      const res = await autoPopulateProjectMep(currentProjectId, options);
      if (res && res.solve_data) {
        setSolveData(res.solve_data);
        if (res.solve_data.doors) setEditableDoors(res.solve_data.doors);
        if (res.solve_data.windows) setEditableWindows(res.solve_data.windows);
        if (res.solve_data.electrical_components) {
          setEditableElectricalComponents(res.solve_data.electrical_components);
        }
        if (res.solve_data.electrical_circuits) {
          setEditableElectricalCircuits(res.solve_data.electrical_circuits);
        }
        if (res.solve_data.electrical_routes) {
          setEditableElectricalRoutes(res.solve_data.electrical_routes);
        }
        if (res.solve_data.hvac_equipment) {
          setEditableHvac(res.solve_data.hvac_equipment);
        }
        if (res.solve_data.furniture) {
          setEditableFurniture(res.solve_data.furniture);
        }
        if (res.solve_data.plumbing_fixtures) {
          setEditablePlumbingFixtures(res.solve_data.plumbing_fixtures);
        }
        if (res.solve_data.plumbing_pipes) {
          setEditablePlumbingPipes(res.solve_data.plumbing_pipes);
        }
        setIsDirty(false);
        setCanvasRenderKey(Date.now());
        const p = res.populated || {};
        showToast(
          `⚡ Populated: ${p.plumbing_fixtures_count || 0} Plumbing, ${p.plumbing_pipes_count || 0} Pipes, ${p.electrical_components_count || 0} Electrical, ${p.hvac_units_count || 0} HVAC!`,
          "success"
        );
      }
    } catch (err) {
      console.error("Auto-populate MEP error:", err);
      showToast("Failed to auto-populate MEP: " + err.message, "error");
    } finally {
      setIsPopulatingMep(false);
    }
  };

  const handleSwitchVariant = async (targetVariant) => {
    const currentProjectId = solveData?.project_id || id;
    if (!currentProjectId) {
      showToast("Please open a valid project to switch layout models.", "warning");
      return;
    }

    try {
      setIsSwitchingVariant(true);
      const v = Number(targetVariant) % 4;
      showToast(`🔄 Switching to Architectural Model ${v + 1}...`, "info");
      const updated = await switchProjectVariant(currentProjectId, v);
      if (updated) {
        setSolveData(updated);
        setCurrentVariant(v);
        if (updated.doors) setEditableDoors(updated.doors);
        if (updated.windows) setEditableWindows(updated.windows);
        if (updated.hvac_equipment) setEditableHvac(updated.hvac_equipment);
        if (updated.furniture) setEditableFurniture(updated.furniture);
        if (updated.plumbing_fixtures) setEditablePlumbingFixtures(updated.plumbing_fixtures);
        if (updated.plumbing_pipes) setEditablePlumbingPipes(updated.plumbing_pipes);
        if (updated.electrical_components) setEditableElectricalComponents(updated.electrical_components);
        if (updated.electrical_circuits) setEditableElectricalCircuits(updated.electrical_circuits);
        if (updated.electrical_routes) setEditableElectricalRoutes(updated.electrical_routes);

        setIsDirty(false);
        if (updated.rooms && updated.rooms.length > 0) {
          setViewTransform(calculateFitView(updated.rooms));
        }
        setCanvasRenderKey(Date.now());
        showToast(`Architectural Model ${v + 1} active! Carpet areas preserved.`, "success");
      }
    } catch (err) {
      console.error("Variant switch error:", err);
      showToast("Failed to switch model: " + err.message, "error");
    } finally {
      setIsSwitchingVariant(false);
    }
  };

  const handleCycleVariant = () => {
    handleSwitchVariant((currentVariant + 1) % 4);
  };
  handleCycleVariantRef.current = handleCycleVariant;

  const handleResetView = () => {
    if (solveData && solveData.rooms) {
      setViewTransform(calculateFitView(solveData.rooms));
    } else {
      setViewTransform(DEFAULT_TRANSFORM);
    }
    setCanvasRenderKey(Date.now());
  };

  const handleLiveItemUpdate = async (itemType, itemId, updates) => {
    let newDoors = editableDoors.length > 0 ? [...editableDoors] : [...(solveData?.doors || [])];
    let newWindows = editableWindows.length > 0 ? [...editableWindows] : [...(solveData?.windows || [])];
    let newHvac = editableHvac.length > 0 ? [...editableHvac] : [...(solveData?.hvac_equipment || [])];
    let newFurniture = editableFurniture.length > 0 ? [...editableFurniture] : [...(solveData?.furniture || [])];
    let newPlumbingFixtures = editablePlumbingFixtures.length > 0 ? [...editablePlumbingFixtures] : [...(solveData?.plumbing_fixtures || [])];
    let newPlumbingPipes = editablePlumbingPipes.length > 0 ? [...editablePlumbingPipes] : [...(solveData?.plumbing_pipes || [])];
    let newElectricalComponents = editableElectricalComponents.length > 0 ? [...editableElectricalComponents] : [...(solveData?.electrical_components || [])];
    let newElectricalCircuits = editableElectricalCircuits.length > 0 ? [...editableElectricalCircuits] : [...(solveData?.electrical_circuits || [])];
    let newElectricalRoutes = editableElectricalRoutes.length > 0 ? [...editableElectricalRoutes] : [...(solveData?.electrical_routes || [])];
    let newRooms = solveData?.rooms || [];
    let addedItemInfo = null;

    if (itemType === "Door") {
      newDoors = newDoors.map(d => d.id === itemId ? { ...d, ...updates } : d);
      setEditableDoors(newDoors);
    } else if (itemType === "Window") {
      newWindows = newWindows.map(w => w.id === itemId ? { ...w, ...updates } : w);
      setEditableWindows(newWindows);
    } else if (itemType === "HVAC") {
      const cap = updates.capacity_tr !== undefined ? Number(updates.capacity_tr) :
                  (updates.cooling_capacity_tr !== undefined ? Number(updates.cooling_capacity_tr) : undefined);
      newHvac = newHvac.map(eq => {
        if (eq.id !== itemId) return eq;
        const nextRoom = updates.room_name || eq.room_name;
        const hostRoom = (solveData?.rooms || []).find(r => (r.name || '').toLowerCase().trim() === (nextRoom || '').toLowerCase().trim());
        let nextX = updates.x !== undefined ? Number(updates.x) : (updates.location_x !== undefined ? Number(updates.location_x) : eq.x);
        let nextY = updates.y !== undefined ? Number(updates.y) : (updates.location_y !== undefined ? Number(updates.location_y) : eq.y);

        // If host room is changing, dynamically re-center inside the new host room
        if (updates.room_name && updates.room_name !== eq.room_name && hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3) {
          const xs = hostRoom.points.map(p => p[0]);
          const ys = hostRoom.points.map(p => p[1]);
          nextX = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
          nextY = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
        }

        const nextCap = cap !== undefined ? cap : (eq.capacity_tr ?? eq.cooling_capacity_tr ?? 1.5);
        const u_type = updates.unit_type || eq.unit_type || "Split-IDU";
        const isODU = u_type.toLowerCase().includes('odu');
        const isCassette = u_type.toLowerCase().includes('cassette');
        const w = isODU ? 850 : (isCassette ? 840 : 900);
        const h = isODU ? 380 : (isCassette ? 840 : 260);

        return {
          ...eq,
          ...updates,
          unit_type: u_type,
          room_name: nextRoom,
          capacity_tr: nextCap,
          cooling_capacity_tr: nextCap,
          cfm: Math.round(nextCap * 400),
          width: w,
          height: h,
          x: nextX,
          y: nextY,
          location_x: nextX,
          location_y: nextY,
          label_x: nextX,
          label_y: nextY - (h / 2.0 + 150.0)
        };
      });

      const nextHvacPipes = (solveData?.hvac_pipes || []).map(pipe => {
        if (pipe.from_unit_id !== itemId && pipe.to_unit_id !== itemId) return pipe;
        const fromEq = newHvac.find(e => e.id === pipe.from_unit_id);
        const toEq = newHvac.find(e => e.id === pipe.to_unit_id);
        if (!fromEq || !toEq) return pipe;

        const fromX = Number(fromEq.x ?? fromEq.location_x ?? 0);
        const fromY = Number(fromEq.y ?? fromEq.location_y ?? 0);
        const toX = Number(toEq.x ?? toEq.location_x ?? 0);
        const toY = Number(toEq.y ?? toEq.location_y ?? 0);

        const idu_conn = [fromX, fromY + (fromEq.height || 260) / 2.0];
        const odu_conn = [toX, toY - (toEq.height || 380) / 2.0];

        const dx = Math.abs(odu_conn[0] - idu_conn[0]);
        const dy = Math.abs(odu_conn[1] - idu_conn[1]);
        let pts;
        if (dy >= dx) {
          const midY = idu_conn[1] + (odu_conn[1] - idu_conn[1]) * 0.5;
          pts = [idu_conn, [idu_conn[0], midY], [odu_conn[0], midY], odu_conn];
        } else {
          const midX = idu_conn[0] + (odu_conn[0] - idu_conn[0]) * 0.5;
          pts = [idu_conn, [midX, idu_conn[1]], [midX, odu_conn[1]], odu_conn];
        }

        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          totalLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        }
        return {
          ...pipe,
          path_points: pts,
          total_length_mm: Math.round(totalLen)
        };
      });

      setEditableHvac(newHvac);
      setSolveData(prev => prev ? {
        ...prev,
        hvac_equipment: newHvac,
        hvac_pipes: nextHvacPipes
      } : prev);
    } else if (itemType === "DeleteHVAC") {
      newHvac = newHvac.filter(eq => eq.id !== itemId);
      setEditableHvac(newHvac);
      setSolveData(prev => prev ? {
        ...prev,
        hvac_equipment: (prev.hvac_equipment || []).filter(eq => eq.id !== itemId),
        hvac_pipes: (prev.hvac_pipes || []).filter(p => p.from_unit_id !== itemId && p.to_unit_id !== itemId)
      } : prev);
    } else if (itemType === "AddHVAC") {
      const u_type = updates?.unit_type || "Split-IDU";
      const isODU = u_type.toLowerCase().includes('odu');
      const isCassette = u_type.toLowerCase().includes('cassette');
      const prefix = isODU ? "ODU" : "IDU";

      let count = 1;
      let newId = updates?.id;
      if (!newId || newHvac.some(h => h.id === newId)) {
        newId = `${prefix}-${count}`;
        while (newHvac.some(h => h.id === newId)) {
          count++;
          newId = `${prefix}-${count}`;
        }
      }

      const hostRoomName = updates?.room_name || (isODU ? "Exterior" : (newRooms[0]?.name || "Living Room"));
      const hostRoom = newRooms.find(r => (r.name || '').toLowerCase().trim() === (hostRoomName || '').toLowerCase().trim());
      
      let initX = 3000, initY = 4800;
      if (hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3) {
        const xs = hostRoom.points.map(p => p[0]);
        const ys = hostRoom.points.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        initX = Math.round((minX + maxX) / 2);
        initY = isODU ? Math.round(minY + (maxY - minY) * 0.75) : Math.round(maxY - 250);
      } else if (isODU) {
        initX = 2200;
        initY = 7500;
      }

      if (updates?.x !== undefined) initX = Number(updates.x);
      if (updates?.y !== undefined) initY = Number(updates.y);

      // Avoid exact coordinate collisions with existing units
      if (newHvac.some(h => Math.abs((h.x || 0) - initX) < 100 && Math.abs((h.y || 0) - initY) < 100)) {
        initX += 200;
        initY += 200;
      }

      const w = isODU ? 850 : (isCassette ? 840 : 900);
      const h = isODU ? 380 : (isCassette ? 840 : 260);
      const cap = Number(updates?.capacity_tr) > 0 ? Number(updates.capacity_tr) : (isODU ? 2.0 : 1.5);

      const newEntry = {
        id: newId,
        room_name: hostRoomName,
        unit_type: u_type,
        capacity_tr: cap,
        cooling_capacity_tr: cap,
        cfm: Math.round(cap * 400),
        x: initX,
        y: initY,
        location_x: initX,
        location_y: initY,
        width: w,
        height: h,
        rotation_deg: 0,
        label_x: initX,
        label_y: initY - (h / 2.0 + 150.0),
        status: "Active"
      };

      addedItemInfo = newEntry;
      newHvac = [...newHvac, newEntry];
      setEditableHvac(newHvac);
      setSolveData(prev => prev ? {
        ...prev,
        hvac_equipment: [...(prev.hvac_equipment || []), newEntry]
      } : prev);
    } else if (itemType === "Furniture") {
      const nextId = updates.newId || updates.id || itemId;
      const safeNum = (v, fallback = 0) => (v !== undefined && Number.isFinite(Number(v))) ? Number(v) : fallback;
      const safeDim = (v, fallback = 1000) => (v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0) ? Number(v) : fallback;

      // Find host room bounds for clamping if outside
      const currentItem = newFurniture.find(f => f.id === itemId);
      const hostRoomName = updates.host_room_id || currentItem?.host_room_id;
      const hostRoom = (solveData?.rooms || []).find(r => (r.name || '').toLowerCase().trim() === (hostRoomName || '').toLowerCase().trim());

      let finalX = updates.x !== undefined ? safeNum(updates.x, currentItem?.x ?? 0) : undefined;
      let finalY = updates.y !== undefined ? safeNum(updates.y, currentItem?.y ?? 0) : undefined;

      // If host room is changing to a new room, dynamically re-center inside the new host room
      if (updates.host_room_id && currentItem && updates.host_room_id !== currentItem.host_room_id && hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3) {
        const xs = hostRoom.points.map(p => p[0]);
        const ys = hostRoom.points.map(p => p[1]);
        finalX = (Math.min(...xs) + Math.max(...xs)) / 2;
        finalY = (Math.min(...ys) + Math.max(...ys)) / 2;
      }

      // If coordinates are placed far outside the room boundary, safely clamp to interior limits
      if (hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3 && finalX !== undefined && finalY !== undefined) {
        const xs = hostRoom.points.map(p => p[0]);
        const ys = hostRoom.points.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        if (finalX < minX - 50 || finalX > maxX + 50 || finalY < minY - 50 || finalY > maxY + 50) {
          finalX = Math.min(maxX - 50, Math.max(minX + 50, finalX));
          finalY = Math.min(maxY - 50, Math.max(minY + 50, finalY));
        }
      }

      newFurniture = newFurniture.map(f => f.id === itemId ? {
        ...f,
        ...updates,
        id: nextId,
        type: updates.type || f.type || "Bed",
        category: updates.category || f.category,
        host_room_id: updates.host_room_id || f.host_room_id,
        width: updates.width !== undefined ? safeDim(updates.width, f.width) : f.width,
        height: updates.height !== undefined ? safeDim(updates.height, f.height) : f.height,
        x: finalX !== undefined ? finalX : f.x,
        y: finalY !== undefined ? finalY : f.y,
        rotation: updates.rotation !== undefined ? ((safeNum(updates.rotation, 0) % 360 + 360) % 360) : (f.rotation || 0)
      } : f);
      setEditableFurniture(newFurniture);
      setSolveData(prev => prev ? {
        ...prev,
        furniture: (prev.furniture || []).map(f => f.id === itemId ? {
          ...f,
          ...updates,
          id: nextId,
          type: updates.type || f.type || "Bed",
          category: updates.category || f.category,
          host_room_id: updates.host_room_id || f.host_room_id,
          width: updates.width !== undefined ? safeDim(updates.width, f.width) : f.width,
          height: updates.height !== undefined ? safeDim(updates.height, f.height) : f.height,
          x: finalX !== undefined ? finalX : f.x,
          y: finalY !== undefined ? finalY : f.y,
          rotation: updates.rotation !== undefined ? ((safeNum(updates.rotation, 0) % 360 + 360) % 360) : (f.rotation || 0)
        } : f)
      } : prev);
    } else if (itemType === "DeleteFurniture") {
      newFurniture = newFurniture.filter(f => f.id !== itemId);
      setEditableFurniture(newFurniture);
      setSolveData(prev => prev ? {
        ...prev,
        furniture: (prev.furniture || []).filter(f => f.id !== itemId)
      } : prev);
    } else if (itemType === "AddFurniture") {
      const hostRoomName = updates?.host_room_id || (newRooms[0]?.name) || "Room 1";
      const hostRoom = newRooms.find(r => (r.name || '').toLowerCase().trim() === (hostRoomName || '').toLowerCase().trim()) || newRooms[0];
      let initX = 2000, initY = 2000;
      if (hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3) {
        const xs = hostRoom.points.map(p => p[0]);
        const ys = hostRoom.points.map(p => p[1]);
        initX = (Math.min(...xs) + Math.max(...xs)) / 2;
        initY = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
      const type = updates?.type || "Double Bed";
      const cleanType = type.trim().toLowerCase();
      const prefix = (updates?.id && updates.id.includes('-')) ? updates.id.split('-')[0] : (
        cleanType.includes("bed") || cleanType.includes("dressing") ? "BED" :
        cleanType.includes("chair") ? "CHR" :
        cleanType.includes("desk") || cleanType.includes("study") ? "DESK" :
        cleanType.includes("sofa") || cleanType.includes("couch") ? "SOF" :
        cleanType.includes("wardrobe") || cleanType.includes("closet") ? "WRB" :
        cleanType.includes("table") || cleanType.includes("coffee") || cleanType.includes("dining") ? "TBL" :
        cleanType.includes("tv") || cleanType.includes("media") ? "TV" :
        cleanType.includes("cabinet") || cleanType.includes("filing") || cleanType.includes("crockery") || cleanType.includes("bookshelf") ? "CAB" : "FURN"
      );
      let count = 1;
      let newId = updates?.id;
      if (!newId || newFurniture.some(f => f.id === newId)) {
        newId = `${prefix}-${count}`;
        while (newFurniture.some(f => f.id === newId)) {
          count++;
          newId = `${prefix}-${count}`;
        }
      }

      // If coordinates overlap an existing item exactly at center, offset slightly so items don't stack directly
      let finalInitX = updates?.x !== undefined ? Number(updates.x) : initX;
      let finalInitY = updates?.y !== undefined ? Number(updates.y) : initY;
      if (newFurniture.some(f => Math.abs((f.x || 0) - finalInitX) < 80 && Math.abs((f.y || 0) - finalInitY) < 80)) {
        finalInitX += 180;
        finalInitY += 180;
      }

      const finalW = (Number.isFinite(Number(updates?.width)) && Number(updates?.width) > 0) ? Number(updates.width) : 1800;
      const finalH = (Number.isFinite(Number(updates?.height)) && Number(updates?.height) > 0) ? Number(updates.height) : 2000;

      const newEntry = {
        id: newId,
        type: type,
        category: updates?.category || "Bedroom",
        host_room_id: hostRoom?.name || hostRoomName,
        width: finalW,
        height: finalH,
        x: finalInitX,
        y: finalInitY,
        rotation: Number.isFinite(Number(updates?.rotation)) ? Number(updates.rotation) : 0
      };
      addedItemInfo = newEntry;
      newFurniture = [...newFurniture, newEntry];
      setEditableFurniture(newFurniture);
      setSolveData(prev => prev ? {
        ...prev,
        furniture: [...(prev.furniture || []), newEntry]
      } : prev);
    } else if (itemType === "Room") {
      newRooms = newRooms.map(r => r.name === itemId ? { ...r, ...updates } : r);
      if (updates && updates.name && updates.name !== itemId) {
        newDoors = newDoors.map(d => d.host_room === itemId ? { ...d, host_room: updates.name } : d);
        newWindows = newWindows.map(w => w.host_room === itemId ? { ...w, host_room: updates.name } : w);
        newHvac = newHvac.map(h => h.room_name === itemId ? { ...h, room_name: updates.name } : h);
        newFurniture = newFurniture.map(f => f.host_room_id === itemId ? { ...f, host_room_id: updates.name } : f);
        setEditableDoors(newDoors);
        setEditableWindows(newWindows);
        setEditableHvac(newHvac);
        setEditableFurniture(newFurniture);
      }
      if (updates && updates.points && Array.isArray(updates.points) && updates.points.length > 0) {
        const xs = updates.points.map(p => p[0]);
        const ys = updates.points.map(p => p[1]);
        const ncx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const ncy = (Math.min(...ys) + Math.max(...ys)) / 2;
        setSolveData(prev => prev ? {
          ...prev,
          furniture: (prev.furniture || []).map(f => {
            if (f.host_room_id === itemId || (updates.name && f.host_room_id === updates.name)) {
              return { ...f, x: ncx, y: ncy, host_room_id: updates.name || f.host_room_id };
            }
            return f;
          })
        } : prev);
      }
    } else if (itemType === "DeleteRoom") {
      newRooms = newRooms.filter(r => r.name !== itemId);
      newDoors = newDoors.filter(d => d.host_room !== itemId);
      newWindows = newWindows.filter(w => w.host_room !== itemId);
      newHvac = newHvac.filter(h => h.room_name !== itemId);
      newFurniture = newFurniture.filter(f => f.host_room_id !== itemId);
      setEditableDoors(newDoors);
      setEditableWindows(newWindows);
      setEditableHvac(newHvac);
      setEditableFurniture(newFurniture);
    } else if (itemType === "AddRoom") {
      newRooms = [...newRooms, updates];
    } else if (itemType === "AddOpening" || itemType === "AddDoor" || itemType === "AddWindow") {
      const isDoor = itemType === "AddDoor" || updates.type === "Door" || updates.kind === "Door";
      if (isDoor) {
        newDoors = [...newDoors, { ...updates, type: "Door" }];
        setEditableDoors(newDoors);
      } else {
        newWindows = [...newWindows, { ...updates, type: "Window" }];
        setEditableWindows(newWindows);
      }
    } else if (itemType === "DeleteOpening") {
      newDoors = newDoors.filter(d => d.id !== itemId);
      newWindows = newWindows.filter(w => w.id !== itemId);
      setEditableDoors(newDoors);
      setEditableWindows(newWindows);
    } else if (itemType === "AddPlumbingFixture") {
      let newId = updates.id;
      if (!newId) {
        let count = 1;
        newId = `PLM-${count}`;
        while (newPlumbingFixtures.some(f => f.id === newId)) {
          count++;
          newId = `PLM-${count}`;
        }
      }
      
      const hostRoomName = updates?.host_room_id || (newRooms[0]?.name || "Room 1");
      const hostRoom = newRooms.find(r => (r.name || '').toLowerCase().trim() === (hostRoomName || '').toLowerCase().trim()) || newRooms[0];
      let initX = 2000, initY = 2000;
      let roomMinX = 0, roomMaxX = 3000, roomMinY = 0, roomMaxY = 3000;
      if (hostRoom && Array.isArray(hostRoom.points) && hostRoom.points.length >= 3) {
        const xs = hostRoom.points.map(p => p[0]);
        const ys = hostRoom.points.map(p => p[1]);
        roomMinX = Math.min(...xs);
        roomMaxX = Math.max(...xs);
        roomMinY = Math.min(...ys);
        roomMaxY = Math.max(...ys);
        initX = (roomMinX + roomMaxX) / 2;
        initY = (roomMinY + roomMaxY) / 2;
      }

      const hostRoomClean = (hostRoomName || '').toLowerCase().trim();
      let supplyId = updates.supplyPipeId;
      let drainId = updates.drainagePipeId;

      // Smart Dual-Line Plumbing Auto-Routing:
      // 1. Water Supply Pipe
      let supplyPipe = newPlumbingPipes.find(p => 
        (supplyId && p.id === supplyId) || 
        ((p.host_room_id || '').toLowerCase().trim() === hostRoomClean && (p.type === 'Water Supply Pipe' || (p.type || '').includes('Supply') || (p.id || '').startsWith('WTR')))
      );
      if (!supplyPipe) {
        let count = 1;
        let pId = `WTR-${count}`;
        while (newPlumbingPipes.some(p => p.id === pId)) {
          count++;
          pId = `WTR-${count}`;
        }
        supplyPipe = {
          id: pId,
          type: 'Water Supply Pipe',
          host_room_id: hostRoom?.name || hostRoomName,
          diameter: 20,
          path: [[roomMinX, roomMinY + 40], [roomMaxX, roomMinY + 40]],
          x: roomMinX,
          y: roomMinY + 40,
          end_x: roomMaxX,
          end_y: roomMinY + 40,
          connected_to: newId
        };
        newPlumbingPipes = [...newPlumbingPipes, supplyPipe];
      }
      supplyId = supplyPipe.id;

      // 2. Drainage / Waste Pipe (offset by +100mm to avoid clash)
      let drainPipe = newPlumbingPipes.find(p => 
        (drainId && p.id === drainId) || 
        ((p.host_room_id || '').toLowerCase().trim() === hostRoomClean && (p.type === 'Drainage Pipe' || (p.type || '').includes('Drain') || (p.id || '').startsWith('DRN')))
      );
      if (!drainPipe) {
        let count = 1;
        let pId = `DRN-${count}`;
        while (newPlumbingPipes.some(p => p.id === pId)) {
          count++;
          pId = `DRN-${count}`;
        }
        const fType = (updates?.type || '').toLowerCase();
        let drainDiam = 110;
        if (fType.includes('basin') || fType.includes('bidet')) drainDiam = 40;
        else if (fType.includes('sink') || fType.includes('shower') || fType.includes('washing') || fType.includes('dish')) drainDiam = 50;
        else if (fType.includes('bath')) drainDiam = 75;

        drainPipe = {
          id: pId,
          type: 'Drainage Pipe',
          host_room_id: hostRoom?.name || hostRoomName,
          diameter: drainDiam,
          path: [[roomMinX, roomMinY + 100], [roomMaxX, roomMinY + 100]],
          x: roomMinX,
          y: roomMinY + 100,
          end_x: roomMaxX,
          end_y: roomMinY + 100,
          connected_to: newId
        };
        newPlumbingPipes = [...newPlumbingPipes, drainPipe];
      }
      drainId = drainPipe.id;

      setEditablePlumbingPipes(newPlumbingPipes);

      const newEntry = { 
        ...updates, 
        id: newId, 
        x: updates.x ?? initX, 
        y: updates.y ?? initY,
        supplyPipeId: supplyId,
        drainagePipeId: drainId
      };
      newPlumbingFixtures = [...newPlumbingFixtures, newEntry];
      setEditablePlumbingFixtures(newPlumbingFixtures);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_fixtures: [...(prev.plumbing_fixtures || []).filter(f => f.id !== newId), newEntry],
        plumbing_pipes: newPlumbingPipes
      } : prev);
    } else if (itemType === "UpdatePlumbingFixture") {
      newPlumbingFixtures = newPlumbingFixtures.map(f => f.id === itemId ? { ...f, ...updates } : f);
      setEditablePlumbingFixtures(newPlumbingFixtures);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_fixtures: (prev.plumbing_fixtures || []).map(f => f.id === itemId ? { ...f, ...updates } : f)
      } : prev);
    } else if (itemType === "DeletePlumbingFixture") {
      newPlumbingFixtures = newPlumbingFixtures.filter(f => f.id !== itemId);
      setEditablePlumbingFixtures(newPlumbingFixtures);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_fixtures: (prev.plumbing_fixtures || []).filter(f => f.id !== itemId)
      } : prev);
    } else if (itemType === "AddPlumbingPipe") {
      let newId = updates.id;
      if (!newId) {
        let count = 1;
        newId = `PIPE-${count}`;
        while (newPlumbingPipes.some(p => p.id === newId)) {
          count++;
          newId = `PIPE-${count}`;
        }
      }
      const newEntry = { ...updates, id: newId };
      newPlumbingPipes = [...newPlumbingPipes, newEntry];
      setEditablePlumbingPipes(newPlumbingPipes);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_pipes: [...(prev.plumbing_pipes || []).filter(p => p.id !== newId), newEntry]
      } : prev);
    } else if (itemType === "UpdatePlumbingPipe") {
      newPlumbingPipes = newPlumbingPipes.map(p => p.id === itemId ? { ...p, ...updates } : p);
      setEditablePlumbingPipes(newPlumbingPipes);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_pipes: (prev.plumbing_pipes || []).map(p => p.id === itemId ? { ...p, ...updates } : p)
      } : prev);
    } else if (itemType === "DeletePlumbingPipe") {
      newPlumbingPipes = newPlumbingPipes.filter(p => p.id !== itemId);
      setEditablePlumbingPipes(newPlumbingPipes);
      setSolveData(prev => prev ? {
        ...prev,
        plumbing_pipes: (prev.plumbing_pipes || []).filter(p => p.id !== itemId)
      } : prev);
    } else if (itemType === "AddElectricalComponent") {
      let newId = updates?.id;
      if (!newId) {
        let count = 1;
        newId = `EL-${count}`;
        while (newElectricalComponents.some(c => c.id === newId)) {
          count++;
          newId = `EL-${count}`;
        }
      }
      const newEntry = { ...updates, id: newId };
      addedItemInfo = newEntry;
      newElectricalComponents = [...newElectricalComponents, newEntry];

      // If component specifies a circuit_id on add, link to circuit
      if (newEntry.circuit_id) {
        newElectricalCircuits = newElectricalCircuits.map(ckt => {
          if (ckt.id === newEntry.circuit_id) {
            const ids = Array.from(new Set([...(ckt.connected_component_ids || []), newId]));
            const cktComps = newElectricalComponents.filter(c => ids.includes(c.id));
            const totalW = cktComps.reduce((acc, c) => acc + (Number(c.wattage) || 0), 0);
            return { ...ckt, connected_component_ids: ids, total_load_w: totalW };
          }
          return ckt;
        });
        setEditableElectricalCircuits(newElectricalCircuits);
      }

      setEditableElectricalComponents(newElectricalComponents);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_components: [...(prev.electrical_components || []).filter(c => c.id !== newId), newEntry],
        electrical_circuits: newElectricalCircuits
      } : prev);
    } else if (itemType === "UpdateElectricalComponent") {
      const oldComp = newElectricalComponents.find(c => c.id === itemId);
      newElectricalComponents = newElectricalComponents.map(c => c.id === itemId ? { ...c, ...updates } : c);

      // Synchronize circuit membership if circuit_id or wattage changed
      const oldCktId = oldComp?.circuit_id;
      const newCktId = updates?.circuit_id !== undefined ? updates.circuit_id : oldCktId;
      if (oldCktId !== newCktId || updates?.wattage !== undefined) {
        newElectricalCircuits = newElectricalCircuits.map(ckt => {
          let ids = [...(ckt.connected_component_ids || [])];
          if (oldCktId && ckt.id === oldCktId && oldCktId !== newCktId) {
            ids = ids.filter(cid => cid !== itemId);
          }
          if (newCktId && ckt.id === newCktId && !ids.includes(itemId)) {
            ids.push(itemId);
          }
          const cktComps = newElectricalComponents.filter(c => ids.includes(c.id));
          const totalW = cktComps.reduce((acc, c) => acc + (Number(c.wattage) || 0), 0);
          return { ...ckt, connected_component_ids: ids, total_load_w: totalW };
        });
        setEditableElectricalCircuits(newElectricalCircuits);
      }

      // Recalculate connected electrical routes if component position (x, y) changed
      if (updates.x !== undefined || updates.y !== undefined) {
        const nextX = Number(updates.x ?? oldComp?.x ?? 0);
        const nextY = Number(updates.y ?? oldComp?.y ?? 0);
        const oldX = Number(oldComp?.x ?? 0);
        const oldY = Number(oldComp?.y ?? 0);

        newElectricalRoutes = newElectricalRoutes.map(r => {
          const isFrom = r.from_component_id === itemId ||
            (r.points && r.points.length >= 2 && Math.hypot(r.points[0][0] - oldX, r.points[0][1] - oldY) < 60);
          const isTo = r.to_component_id === itemId ||
            (r.points && r.points.length >= 2 && Math.hypot(r.points[r.points.length - 1][0] - oldX, r.points[r.points.length - 1][1] - oldY) < 60);

          if (!isFrom && !isTo) return r;

          const p1 = isFrom ? [nextX, nextY] : [...(r.points?.[0] || [0, 0])];
          const p2 = isTo ? [nextX, nextY] : [...(r.points?.[r.points.length - 1] || [0, 0])];

          let pts;
          if (Math.abs(p1[0] - p2[0]) < 1 || Math.abs(p1[1] - p2[1]) < 1) {
            pts = [p1, p2];
          } else {
            const dx = Math.abs(p2[0] - p1[0]);
            const dy = Math.abs(p2[1] - p1[1]);
            if (dx >= dy) {
              pts = [p1, [p2[0], p1[1]], p2];
            } else {
              pts = [p1, [p1[0], p2[1]], p2];
            }
          }

          let lenMm = 0;
          for (let i = 0; i < pts.length - 1; i++) {
            lenMm += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
          }

          return {
            ...r,
            points: pts,
            length_mm: Math.round(lenMm)
          };
        });

        setEditableElectricalRoutes(newElectricalRoutes);
      }

      setEditableElectricalComponents(newElectricalComponents);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_components: (prev.electrical_components || []).map(c => c.id === itemId ? { ...c, ...updates } : c),
        electrical_circuits: newElectricalCircuits,
        electrical_routes: newElectricalRoutes
      } : prev);
    } else if (itemType === "DeleteElectricalComponent") {
      newElectricalComponents = newElectricalComponents.filter(c => c.id !== itemId);
      newElectricalCircuits = newElectricalCircuits.map(ckt => {
        const ids = (ckt.connected_component_ids || []).filter(cid => cid !== itemId);
        const cktComps = newElectricalComponents.filter(c => ids.includes(c.id));
        const totalW = cktComps.reduce((acc, c) => acc + (Number(c.wattage) || 0), 0);
        return { ...ckt, connected_component_ids: ids, total_load_w: totalW };
      });
      newElectricalRoutes = newElectricalRoutes.filter(r => r.from_component_id !== itemId && r.to_component_id !== itemId);
      setEditableElectricalComponents(newElectricalComponents);
      setEditableElectricalCircuits(newElectricalCircuits);
      setEditableElectricalRoutes(newElectricalRoutes);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_components: (prev.electrical_components || []).filter(c => c.id !== itemId),
        electrical_circuits: newElectricalCircuits,
        electrical_routes: newElectricalRoutes
      } : prev);
    } else if (itemType === "AddElectricalCircuit") {
      let newId = updates?.id;
      if (!newId) {
        let count = 1;
        newId = `CKT-${count}`;
        while (newElectricalCircuits.some(c => c.id === newId)) {
          count++;
          newId = `CKT-${count}`;
        }
      }
      const newEntry = {
        name: `Circuit ${newId}`,
        category: 'lighting',
        breaker_rating_a: 10,
        wire_gauge_sqmm: 1.5,
        connected_component_ids: [],
        total_load_w: 0,
        ...updates,
        id: newId
      };
      addedItemInfo = newEntry;
      newElectricalCircuits = [...newElectricalCircuits, newEntry];
      setEditableElectricalCircuits(newElectricalCircuits);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_circuits: [...(prev.electrical_circuits || []).filter(c => c.id !== newId), newEntry]
      } : prev);
    } else if (itemType === "UpdateElectricalCircuit") {
      newElectricalCircuits = newElectricalCircuits.map(c => c.id === itemId ? { ...c, ...updates } : c);
      setEditableElectricalCircuits(newElectricalCircuits);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_circuits: (prev.electrical_circuits || []).map(c => c.id === itemId ? { ...c, ...updates } : c)
      } : prev);
    } else if (itemType === "DeleteElectricalCircuit") {
      newElectricalCircuits = newElectricalCircuits.filter(c => c.id !== itemId);
      newElectricalComponents = newElectricalComponents.map(c => c.circuit_id === itemId ? { ...c, circuit_id: null } : c);
      newElectricalRoutes = newElectricalRoutes.filter(r => r.circuit_id !== itemId);
      setEditableElectricalComponents(newElectricalComponents);
      setEditableElectricalCircuits(newElectricalCircuits);
      setEditableElectricalRoutes(newElectricalRoutes);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_circuits: (prev.electrical_circuits || []).filter(c => c.id !== itemId),
        electrical_components: newElectricalComponents,
        electrical_routes: newElectricalRoutes
      } : prev);
    } else if (itemType === "AddElectricalRoute") {
      let newId = updates?.id;
      if (!newId) {
        let count = 1;
        newId = `WR-${count}`;
        while (newElectricalRoutes.some(r => r.id === newId)) {
          count++;
          newId = `WR-${count}`;
        }
      }
      const newEntry = { ...updates, id: newId };
      newElectricalRoutes = [...newElectricalRoutes, newEntry];
      setEditableElectricalRoutes(newElectricalRoutes);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_routes: [...(prev.electrical_routes || []).filter(r => r.id !== newId), newEntry]
      } : prev);
    } else if (itemType === "DeleteElectricalRoute") {
      newElectricalRoutes = newElectricalRoutes.filter(r => r.id !== itemId);
      setEditableElectricalRoutes(newElectricalRoutes);
      setSolveData(prev => prev ? {
        ...prev,
        electrical_routes: (prev.electrical_routes || []).filter(r => r.id !== itemId)
      } : prev);
    } else if (itemType === "AutoRouteElectrical") {
      const currentProjectId = solveData?.project_id || id;
      if (currentProjectId) {
        try {
          const res = await autoRouteElectrical(currentProjectId);
          if (res && res.routes) {
            newElectricalRoutes = res.routes;
            setEditableElectricalRoutes(newElectricalRoutes);
            setSolveData(prev => prev ? { ...prev, electrical_routes: newElectricalRoutes } : prev);
            showToast(`Auto-routed ${res.routes.length} electrical conduits!`, "success");
          }
        } catch (err) {
          console.error("Auto route error:", err);
          showToast("Failed to auto-route conduits: " + err.message, "error");
        }
      }
    } else if (itemType === "AutoPopulateMep") {
      await handleAutoPopulateMep(updates || {});
      return;
    } else if (itemType === "AutoRoutePlumbing") {
      await handleAutoPopulateMep({ include_plumbing: true, include_electrical: false, include_hvac: false, include_furniture: false });
      return;
    }

    const updatePayload = {
      name: solveData?.project_name || "Floorplan",
      rooms: newRooms.map(r => ({
        name: r.name,
        points: r.points,
        fillet_radius: 0.0
      })),
      openings: [
        ...newDoors.map(d => ({
          id: d.id,
          host_room: d.host_room,
          wall_side: d.wall_side,
          offset_mm: Number(d.offset_mm),
          width_mm: Number(d.width_mm),
          height_mm: Number(d.height_mm),
          type: "Door",
          swing: d.swing || "Inward-Right"
        })),
        ...newWindows.map(w => ({
          id: w.id,
          host_room: w.host_room,
          wall_side: w.wall_side,
          offset_mm: Number(w.offset_mm),
          width_mm: Number(w.width_mm),
          height_mm: Number(w.height_mm),
          type: "Window"
        }))
      ],
      hvac_equipment: newHvac.map(h => ({
        id: h.id,
        room_name: h.room_name,
        unit_type: h.unit_type,
        location_x: Number(h.location_x ?? h.x ?? 0),
        location_y: Number(h.location_y ?? h.y ?? 0),
        cooling_capacity_tr: Number(h.capacity_tr ?? h.cooling_capacity_tr ?? 1.5),
        status: h.status ?? "Active"
      })),
      furniture: newFurniture.map(f => ({
        id: f.id,
        type: f.type || "Bed",
        category: f.category,
        host_room_id: (itemType === "Room" && updates && updates.name && f.host_room_id === itemId) ? updates.name : (f.host_room_id || updates?.host_room_id),
        width: (Number.isFinite(Number(f.width)) && Number(f.width) > 0) ? Number(f.width) : 1000,
        height: (Number.isFinite(Number(f.height)) && Number(f.height) > 0) ? Number(f.height) : 600,
        x: Number.isFinite(Number(f.x)) ? Number(f.x) : 0,
        y: Number.isFinite(Number(f.y)) ? Number(f.y) : 0,
        rotation: Number.isFinite(Number(f.rotation)) ? ((Number(f.rotation) % 360 + 360) % 360) : 0
      })),
      plumbing_fixtures: newPlumbingFixtures.map(f => ({ ...f })),
      plumbing_pipes: newPlumbingPipes.map(p => ({ ...p })),
      electrical_components: newElectricalComponents.map(c => ({ ...c })),
      electrical_circuits: newElectricalCircuits.map(c => ({ ...c })),
      electrical_routes: newElectricalRoutes.map(r => ({ ...r }))
    };

    try {
      const currentProjectId = solveData?.project_id || id;
      let updated;
      if (currentProjectId) {
        updated = await updateProjectById(currentProjectId, updatePayload);
      } else {
        updated = await createManualProject(updatePayload);
      }
      if (updated) {
        setSolveData(updated);
        setEditableDoors(updated.doors || []);
        setEditableWindows(updated.windows || []);
        setEditableHvac(updated.hvac_equipment || []);
        setEditableFurniture(updated.furniture || []);
        setEditablePlumbingFixtures(updated.plumbing_fixtures || []);
        setEditablePlumbingPipes(updated.plumbing_pipes || []);
        setEditableElectricalComponents(updated.electrical_components || newElectricalComponents);
        setEditableElectricalCircuits(updated.electrical_circuits || newElectricalCircuits);
        setEditableElectricalRoutes(updated.electrical_routes || newElectricalRoutes);
        if (!currentProjectId && updated.project_id) {
          navigate(`/projects/${encodeURIComponent(updated.project_id)}/cad`, { replace: true });
        }
        let toastMsg = "Plan updated successfully!";
        if (itemType === "AddRoom") toastMsg = `Room '${updates.name}' added successfully!`;
        else if (itemType === "DeleteRoom") toastMsg = `Room '${itemId}' and associated items deleted successfully!`;
        else if (itemType === "AddOpening" || itemType === "AddDoor" || itemType === "AddWindow") {
          const kind = updates.type || (itemType === "AddDoor" ? "Door" : "Window");
          toastMsg = `${kind} '${updates.id}' added to ${updates.host_room}!`;
        } else if (itemType === "DeleteOpening") {
          toastMsg = `Opening '${itemId}' removed!`;
        } else if (itemType === "HVAC") {
          toastMsg = `HVAC Unit '${itemId}' updated!`;
        } else if (itemType === "AddHVAC") {
          toastMsg = addedItemInfo ? `HVAC Unit '${addedItemInfo.id}' (${addedItemInfo.unit_type}) added to ${addedItemInfo.room_name}!` : `HVAC Unit added successfully!`;
        } else if (itemType === "DeleteHVAC") {
          toastMsg = `HVAC Unit '${itemId}' and connected refrigerant pipes deleted!`;
        } else if (itemType === "AddFurniture") {
          toastMsg = addedItemInfo ? `Furniture '${addedItemInfo.id}' (${addedItemInfo.type}) added to ${addedItemInfo.host_room_id}!` : `Furniture item added successfully!`;
        } else if (itemType === "DeleteFurniture") {
          toastMsg = `Furniture '${itemId}' deleted successfully!`;
        } else if (itemType === "Furniture") {
          toastMsg = `Furniture item '${updates.newId || updates.id || itemId}' updated!`;
        } else if (itemType.includes("Plumbing")) {
          toastMsg = `Plumbing item ${itemType.startsWith("Add") ? "added" : itemType.startsWith("Update") ? "updated" : "deleted"} successfully!`;
        } else if (itemType === "AddElectricalCircuit") {
          toastMsg = `Circuit '${addedItemInfo?.id || updates?.id || itemId}' created successfully!`;
        } else if (itemType === "UpdateElectricalCircuit") {
          toastMsg = `Circuit '${itemId}' updated!`;
        } else if (itemType === "DeleteElectricalCircuit") {
          toastMsg = `Circuit '${itemId}' deleted!`;
        } else if (itemType === "AddElectricalComponent") {
          toastMsg = addedItemInfo ? `Electrical fixture '${addedItemInfo.id}' (${addedItemInfo.name || addedItemInfo.type}) added!` : `Electrical fixture added!`;
        } else if (itemType === "UpdateElectricalComponent") {
          toastMsg = `Electrical fixture '${itemId}' updated!`;
        } else if (itemType === "DeleteElectricalComponent") {
          toastMsg = `Electrical fixture '${itemId}' deleted!`;
        } else if (itemType === "AddElectricalRoute" || itemType === "DeleteElectricalRoute") {
          toastMsg = `Conduit route ${itemType === "AddElectricalRoute" ? "added" : "removed"}!`;
        }
        showToast(toastMsg, "success");
      }
    } catch (err) {
      console.error("Live sync failed", err);
      showToast(err.message || "Failed to update floorplan geometry.", "error");
    }
  };

  const handleUpdateOpening = useCallback((id, kind, field, value) => {
    setIsDirty(true);
    if (kind === 'Door') {
      setEditableDoors(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    } else {
      setEditableWindows(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    }
  }, []);

  const handleUpdateEquipment = useCallback((id, field, value) => {
    setIsDirty(true);
    setEditableHvac(prev => prev.map(eq => eq.id === id ? { ...eq, [field]: value } : eq));
  }, []);

  const handleSaveChanges = async () => {
    if (!solveData) return;
    const currentProjectId = solveData.project_id || id;
    if (!currentProjectId) {
      showToast("Cannot save changes: No active project ID.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload = {
        name: solveData.project_name || "Floorplan",
        rooms: (solveData.rooms || []).map(r => ({
          name: r.name,
          points: r.points,
          fillet_radius: 0.0
        })),
        openings: [
          ...editableDoors.map(d => ({
            id: d.id,
            type: "Door",
            host_room: d.host_room,
            wall_side: d.wall_side,
            offset_mm: d.offset_mm ?? 1000.0,
            width_mm: d.width_mm,
            height_mm: d.height_mm ?? 2100.0,
            swing: d.swing ?? "Inward-Right"
          })),
          ...editableWindows.map(w => ({
            id: w.id,
            type: "Window",
            host_room: w.host_room,
            wall_side: w.wall_side,
            offset_mm: w.offset_mm ?? 1000.0,
            width_mm: w.width_mm,
            height_mm: w.height_mm ?? 1200.0,
            swing: "Inward-Right"
          }))
        ],
        hvac_equipment: editableHvac.map(h => ({
          id: h.id,
          room_name: h.room_name,
          unit_type: h.unit_type,
          cooling_capacity_tr: h.capacity_tr ?? h.cooling_capacity_tr ?? 1.5,
          location_x: h.x ?? h.location_x ?? 0,
          location_y: h.y ?? h.location_y ?? 0,
          status: h.status ?? "Active"
        })),
        furniture: (editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || [])).map(f => ({
          id: f.id,
          type: f.type || "Bed",
          category: f.category,
          host_room_id: f.host_room_id,
          width: (Number.isFinite(Number(f.width)) && Number(f.width) > 0) ? Number(f.width) : 1000,
          height: (Number.isFinite(Number(f.height)) && Number(f.height) > 0) ? Number(f.height) : 600,
          x: Number.isFinite(Number(f.x)) ? Number(f.x) : 0,
          y: Number.isFinite(Number(f.y)) ? Number(f.y) : 0,
          rotation: Number.isFinite(Number(f.rotation)) ? ((Number(f.rotation) % 360 + 360) % 360) : 0
        })),
        plumbing_fixtures: (editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || [])),
        plumbing_pipes: (editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || [])),
        electrical_components: (editableElectricalComponents.length > 0 ? editableElectricalComponents : (solveData?.electrical_components || [])),
        electrical_circuits: (editableElectricalCircuits.length > 0 ? editableElectricalCircuits : (solveData?.electrical_circuits || [])),
        electrical_routes: (editableElectricalRoutes.length > 0 ? editableElectricalRoutes : (solveData?.electrical_routes || []))
      };

      const updated = await updateProjectById(currentProjectId, updatePayload);
      setSolveData(updated);
      
      setEditableDoors(updated.doors || []);
      setEditableWindows(updated.windows || []);
      setEditableHvac(updated.hvac_equipment || []);
      setEditableFurniture(updated.furniture || []);
      setEditablePlumbingFixtures(updated.plumbing_fixtures || []);
      setEditablePlumbingPipes(updated.plumbing_pipes || []);
      setEditableElectricalComponents(updated.electrical_components || []);
      setEditableElectricalCircuits(updated.electrical_circuits || []);
      setEditableElectricalRoutes(updated.electrical_routes || []);
      setIsDirty(false);
      showToast("Floorplan updated & saved successfully! Geometry recomputed.", "success");
    } catch (err) {
      console.error("Save error:", err);
      showToast(err.message || "Failed to save project changes.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const solved = await uploadExcelPlan(file);
      setSolveData(solved);
      
      setEditableDoors(solved.doors || []);
      setEditableWindows(solved.windows || []);
      setEditableHvac(solved.hvac_equipment || []);
      setEditableFurniture(solved.furniture || []);
      setIsDirty(false);
      if (solved && solved.rooms) {
        setViewTransform(calculateFitView(solved.rooms));
      }
      if (solved && solved.project_id) {
        navigate(`/projects/${encodeURIComponent(solved.project_id)}/cad`, { replace: true });
      }
      const hvacCount = solved.hvac_equipment?.length || 0;
      showToast(
        `Plan imported & saved! Solved ${solved.rooms.length} room(s), ${(solved.doors?.length || 0) + (solved.windows?.length || 0)} opening(s), & ${hvacCount} HVAC unit(s).`,
        "success"
      );
    } catch (err) {
      console.error("Upload error:", err);
      showToast(err.message || "Failed to process uploaded Excel floorplan.", "error");
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleExportDxf = async () => {
    if (!solveData) {
      showToast("No active plan geometry to export.", "error");
      return;
    }
    setIsExportingDxf(true);
    try {
      await exportDxf(solveData);
      showToast("AutoCAD (.DXF) exported successfully!", "success");
    } catch (err) {
      console.error("DXF export error:", err);
      showToast(err.message || "Failed to export AutoCAD (.DXF) drawing.", "error");
    } finally {
      setIsExportingDxf(false);
    }
  };

  // PDF 1: Building Spatial Quantities & Engineering Schedules Report
  const handleExportQuantitiesPdf = async () => {
    if (!solveData) {
      showToast("No active plan geometry to export.", "error");
      return;
    }
    const currentProjectId = solveData.project_id || id;

    setIsExportingPdf(true);
    try {
      await downloadProjectPdf(currentProjectId, solveData.project_name || "Quantities_Report", solveData);
      showToast("PDF 1: Building Quantities & Schedules Report exported successfully!", "success");
    } catch (err) {
      console.error("Quantities PDF export error:", err);
      showToast(err.message || "Failed to export Quantities PDF.", "error");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // PDF 2: Material Quantities & Construction Cost Estimation (BOQ) Report
  const handleExportBoqCostPdf = async () => {
    if (!solveData) {
      showToast("No active plan geometry to export.", "error");
      return;
    }
    const currentProjectId = solveData.project_id || id;

    setIsExportingBoqPdf(true);
    try {
      const tierToExport = activeQualityTier || boqData?.quality_tier || "medium";
      await downloadProjectBoqPdf(currentProjectId, tierToExport, solveData.project_name || "BOQ_Cost_Estimate", solveData);
      showToast(`PDF 2: ${tierToExport.toUpperCase()} Tier Cost & BOQ Report exported successfully!`, "success");
    } catch (err) {
      console.error("BOQ PDF export error:", err);
      showToast(err.message || "Failed to export BOQ PDF.", "error");
    } finally {
      setIsExportingBoqPdf(false);
    }
  };

  const handleExportPdf = handleExportQuantitiesPdf;

  const handleExportExcel = async () => {
    if (!solveData) {
      showToast("No active plan geometry to export.", "error");
      return;
    }

    setIsExportingExcel(true);
    try {
      // Assemble absolute latest live state to ensure newly added/updated items are exported
      const liveCadData = {
        ...(solveData || {}),
        project_id: solveData?.project_id || id,
        project_name: solveData?.project_name || "Floorplan",
        rooms: solveData?.rooms || [],
        doors: editableDoors.length > 0 ? editableDoors : (solveData?.doors || []),
        windows: editableWindows.length > 0 ? editableWindows : (solveData?.windows || []),
        hvac_equipment: editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []),
        furniture: editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || []),
        plumbing_fixtures: editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || []),
        plumbing_pipes: editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || [])
      };

      await exportExcel(liveCadData, solveData?.project_name || "Floorplan");
      showToast("Consolidated Excel workbook (.xlsx) exported successfully!", "success");
    } catch (err) {
      console.error("Excel export error:", err);
      // Fallback to project ID download if available
      const currentProjectId = solveData?.project_id || id;
      if (currentProjectId) {
        try {
          await downloadProjectExcel(currentProjectId, solveData?.project_name || "Project_Data");
          showToast("Consolidated Excel workbook (.xlsx) exported successfully!", "success");
          return;
        } catch (fallbackErr) {
          console.error("Fallback Excel export error:", fallbackErr);
        }
      }
      showToast(err.message || "Failed to export Excel workbook.", "error");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleOpenBoq = async () => {
    if (!solveData) {
      showToast("No active plan geometry to calculate BOQ.", "warning");
      return;
    }
    // If we already have boqData, open dashboard directly
    if (boqData) {
      setIsBoqDashboardOpen(true);
      return;
    }
    // If project already has saved boq in solveData, use it
    if (solveData.boq) {
      setBoqData(solveData.boq);
      setActiveQualityTier(solveData.quality_tier || solveData.boq.quality_tier || "medium");
      setIsBoqDashboardOpen(true);
      return;
    }
    // Otherwise open Tier Selector first
    setIsTierSelectorOpen(true);
  };

  const handleSelectQualityTier = async (selectedTier) => {
    setActiveQualityTier(selectedTier);
    setIsCalculatingBoq(true);
    try {
      const currentProjectId = solveData?.project_id || id;
      let resultBoq = null;
      if (currentProjectId) {
        const res = await calculateProjectBoq(currentProjectId, selectedTier);
        resultBoq = res.boq;
      } else {
        const res = await calculateBoqLive(solveData, selectedTier);
        resultBoq = res.boq;
      }
      setBoqData(resultBoq);
      setIsTierSelectorOpen(false);
      setIsBoqDashboardOpen(true);
      showToast(`Bill of Materials calculated for ${resultBoq.tier_name || selectedTier} tier!`, "success");
    } catch (err) {
      console.error("BOQ calculation failed:", err);
      showToast(err.message || "Failed to calculate BOQ.", "error");
    } finally {
      setIsCalculatingBoq(false);
    }
  };

  const handleSwitchTierFromDashboard = async (newTier) => {
    await handleSelectQualityTier(newTier);
  };

  const totalOpeningsCount = (editableDoors.length || solveData?.doors?.length || 0) + (editableWindows.length || solveData?.windows?.length || 0);

  const totalCarpetAreaSqM = useMemo(() => {
    return (solveData?.rooms || []).reduce((acc, r) => {
      const area = Number(r.carpet_area_m2 || (r.area_m2 ? r.area_m2 * 0.85 : 0)) || 0;
      return acc + area;
    }, 0);
  }, [solveData]);

  const totalCarpetAreaSqFt = useMemo(() => {
    return (totalCarpetAreaSqM * 10.7639).toFixed(1);
  }, [totalCarpetAreaSqM]);

  const totalHvacTR = useMemo(() => {
    const units = editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []);
    return units.reduce((acc, h) => acc + (Number(h.cooling_capacity_tr || h.capacity_tr || 0) || 0), 0);
  }, [editableHvac, solveData]);

  return (
    <div className="cad-workbench-layout">
      {/* 1. TOP NAVBAR */}
      <nav className="cad-top-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
          <button
            onClick={() => navigate('/projects')}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Return to Projects Dashboard"
          >
            ← Projects
          </button>

          <img 
            src="/logo-meplaniq-symbol.svg" 
            alt="meplaniq" 
            style={{ height: "32px", width: "32px", display: "block", borderRadius: "6px", flexShrink: 0 }} 
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Projects /</span>
            <span 
              title={solveData?.project_name || "Parametric Floorplan"}
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '220px'
              }}
            >
              {solveData?.project_name || "Parametric Floorplan"}
            </span>
          </div>

          {/* Live Save Status Indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: isDirty ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 197, 94, 0.12)',
            color: isDirty ? 'var(--status-warning)' : 'var(--status-success)',
            fontSize: '11px',
            fontWeight: 600,
            border: `1px solid ${isDirty ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDirty ? 'var(--status-warning)' : 'var(--status-success)' }}></span>
            <span>{isSaving ? 'Saving...' : isDirty ? 'Unsaved Changes' : 'Saved to Local DB'}</span>
          </div>
        </div>

        {/* Center: Undo/Redo & Discipline Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="btn-secondary"
              onClick={() => showToast("Undo action (Ctrl+Z)", "info")}
              style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Undo"
            >
              ↶ Undo
            </button>
            <button
              className="btn-secondary"
              onClick={() => showToast("Redo action (Ctrl+Y)", "info")}
              style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Redo"
            >
              ↷ Redo
            </button>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }} />

          {/* Discipline View Layer Selector */}
          <DisciplineSelector
            activeView={disciplineView}
            onViewChange={handleDisciplineViewChange}
            displayMode={disciplineDisplayMode}
            onDisplayModeToggle={handleToggleDisplayMode}
          />
        </div>

        {/* Right: Cloud Sync & Export Buttons */}
        {/* Right: Cloud Sync & Export Buttons - Responsive Non-overflowing Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0, maxWidth: '65vw' }}>
          <button
            className="btn-secondary"
            onClick={() => navigate(id ? `/projects/${id}/drafting` : '/drafting')}
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              borderColor: '#DC2626',
              color: '#EF4444',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Switch to AutoCAD-style Direct Drafting Mode"
          >
            <span>✏️</span>
            <span>AutoCAD</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleOpenCloudVault}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Open Cloud Floorplans Vault"
          >
            <span>☁</span>
            <span>Vault</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleSaveToCloud}
            disabled={!solveData}
            style={{
              backgroundColor: '#0284C7',
              borderColor: '#38BDF8',
              color: '#FFFFFF',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Backup complete CAD project state to Cloud Database"
          >
            <span>☁↑ Save</span>
          </button>

          <button
            className="btn-primary"
            onClick={handleSaveChanges}
            disabled={isSaving || !solveData}
            style={{
              backgroundColor: isDirty ? '#059669' : '#10B981',
              color: '#FFFFFF',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px',
              border: 'none',
              cursor: isSaving ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Save updated parameters to SQLite database & re-solve CAD geometry"
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>

          {/* 📸 Photo Export */}
          <button
            onClick={() => setIsExportImageModalOpen(true)}
            disabled={!solveData}
            style={{
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: '1px solid #38BDF8',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Export High-Resolution Vector Image / Photo"
          >
            📸 Photo
          </button>

          {/* 🔄 Cycle Architectural Model Variant */}
          <button
            onClick={handleCycleVariant}
            disabled={isSwitchingVariant || !solveData}
            style={{
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: '1px solid #A78BFA',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: (isSwitchingVariant || !solveData) ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Cycle Architectural Layout Models (Press Shift key to switch models)"
          >
            <span>{isSwitchingVariant ? '🔄...' : `🔄 Model ${currentVariant + 1}`}</span>
          </button>

          {/* 📐 Engineering Calculation & Sizing Sheet */}
          <button
            onClick={() => setIsCalcModalOpen(true)}
            disabled={!solveData}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #8B5CF6',
              color: '#C4B5FD',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Open MEP Engineering Calculation Sheet (ASHRAE Duct Aerodynamics, 3-Phase DB Schedule, UPC Hydraulics, BOQ)"
          >
            <span>📐 Calc Sheet</span>
          </button>

          {/* ⚡ Coordinated Auto-MEP Engine Trigger */}
          <button
            onClick={() => setIsAutoMepModalOpen(true)}
            disabled={!solveData}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: '1px solid #34D399',
              color: '#FFFFFF',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Open Coordinated Auto-MEP Engine (ASHRAE CFM Sized Ducts, Electrical DB-01, Plumbing & Structure)"
          >
            <span>⚡ Auto MEP</span>
          </button>

          {/* 🧊 3D Spatial BIM Extrusion Viewport */}
          <button
            onClick={() => setIs3DViewActive(true)}
            disabled={!solveData}
            style={{
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Inspect 3D Axonometric BIM Model with Extruded Walls, Elevated Ducts & Columns"
          >
            <span>🧊 3D View</span>
          </button>

          {/* ⚠️ Multi-Discipline BIM Clash Matrix */}
          <button
            onClick={() => {
              if (!clashData) {
                handleApplyCoordinatedMep({ includeClashDetection: true });
              } else {
                setIsClashDrawerOpen(prev => !prev);
              }
            }}
            disabled={!solveData}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #EF4444',
              color: '#FCA5A5',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="View Multi-Discipline BIM Clash Detection Matrix"
          >
            <span>⚠️ Clash Matrix</span>
            {clashData?.summary?.total > 0 && (
              <span style={{ backgroundColor: '#EF4444', color: '#FFF', fontSize: '9px', padding: '1px 4px', borderRadius: '4px' }}>
                {clashData.summary.total}
              </span>
            )}
          </button>

          {/* 📊 Computational Engineering Analytics Dashboard */}
          <button
            onClick={() => setIsEngineeringPanelOpen(prev => !prev)}
            disabled={!solveData}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #06B6D4',
              color: '#67E8F9',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="View NBC 2016 WFR, ASHRAE Cooling Loads, CIBSE Lux & Civil BOQ Dashboard"
          >
            <span>📊 Analytics</span>
          </button>

          {/* 🎓 Master Dissertation Audit Dossier */}
          <button
            onClick={handleGenerateMasterSubmissionAudit}
            disabled={!solveData}
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #A855F7',
              color: '#D8B4FE',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: !solveData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Export PhD Dissertation Grade Master Engineering Audit Dossier (.JSON)"
          >
            <span>🎓 Master Audit</span>
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />

          {/* 📊 Cost & BOQ Estimation Button */}
          <button
            onClick={handleOpenBoq}
            disabled={!solveData || isCalculatingBoq}
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              border: '1px solid #FCD34D',
              color: '#0F172A',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '6px',
              cursor: (!solveData || isCalculatingBoq) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.4)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Open Bill of Materials (BOQ) & Construction Cost Estimation (Low/Medium/High Tiers)"
          >
            {isCalculatingBoq ? (
              <span>⏳ Calculating...</span>
            ) : (
              <>
                <span>📊</span>
                <span>Cost & BOQ</span>
                {boqData && (
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#FFFFFF',
                    marginLeft: '2px',
                    textTransform: 'uppercase'
                  }}>
                    {boqData.quality_tier || 'Med'}
                  </span>
                )}
              </>
            )}
          </button>

          {/* 📄 PDF 1: Building Spatial Quantities & Engineering Schedules */}
          <button
            onClick={handleExportQuantitiesPdf}
            disabled={isExportingPdf || !solveData}
            style={{
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: isExportingPdf ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Download PDF 1: Building Spatial Quantities, Room Areas & MEP Schedules Report"
          >
            <span>{isExportingPdf ? 'Exporting...' : '📄 PDF 1: Quantities'}</span>
          </button>

          {/* 📑 PDF 2: Material Quantities & Cost Estimation (BOQ) */}
          <button
            onClick={handleExportBoqCostPdf}
            disabled={isExportingBoqPdf || !solveData}
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              border: '1px solid #F87171',
              color: '#FFFFFF',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: isExportingBoqPdf ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Download PDF 2: Classified Material Quantities (Blocks, Cement, Sand, Steel) & Cost Estimation (BOQ)"
          >
            <span>{isExportingBoqPdf ? 'Exporting...' : '📑 PDF 2: BOQ Cost'}</span>
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />

          {/* 📐 DXF Export */}
          <button
            onClick={handleExportDxf}
            disabled={isExportingDxf || !solveData}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: isExportingDxf ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Export AutoCAD R2018 DXF Drawing"
          >
            {isExportingDxf ? 'DXF...' : '📐 DXF'}
          </button>

          {/* 📊 Excel Export */}
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || !solveData}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: isExportingExcel ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Export Consolidated Excel (.xlsx) Schedules"
          >
            {isExportingExcel ? 'XLSX...' : '📊 Excel'}
          </button>
        </div>
      </nav>

      {error && solveData && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={loadProjectData}>
            Retry Load
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F19', color: '#94A3B8' }}>
          <div className="upload-spinner" style={{ width: 44, height: 44, borderWidth: 4, marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Opening CAD Canvas...</p>
          <p style={{ fontSize: 13, color: '#64748B' }}>Loading architectural geometry and spatial elements...</p>
        </div>
      ) : (error || !solveData) ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F19', color: '#94A3B8', padding: '2rem', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>
            ⚠️
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>
            Unable to Load CAD Canvas
          </h3>
          <p style={{ fontSize: 14, color: '#94A3B8', maxWidth: 460, marginBottom: 24, lineHeight: 1.6 }}>
            {error || (id ? `Project "${id}" could not be found or contains invalid geometry.` : "No project geometry was loaded.")}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate('/projects')}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              ← Return to Projects
            </button>
            <button
              onClick={() => loadProjectData()}
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="cad-workspace-body">
            {/* 1. LEFT VERTICAL TOOL PALETTE (~54px) */}
            <aside className="cad-tool-palette" aria-label="CAD Tool Palette">
              {/* Select Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select & Move (V or Esc)"
              >
                <span style={{ fontSize: '15px' }}>↖</span>
                <span className="tool-shortcut-badge">V</span>
              </button>

              <div className="tool-palette-divider" />

              {/* Wall / Room Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'wall' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('wall');
                  setActiveTab('rooms');
                  setIsScheduleCollapsed(false);
                }}
                title="Room Boundaries & Spatial Walls (W)"
              >
                <span>🧱</span>
                <span className="tool-shortcut-badge">W</span>
              </button>

              {/* Door Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'door' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('door');
                  setActiveTab('openings');
                  setIsScheduleCollapsed(false);
                }}
                title="Door Openings & Swings (D)"
              >
                <span>🚪</span>
                <span className="tool-shortcut-badge">D</span>
              </button>

              {/* Window Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'window' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('window');
                  setActiveTab('openings');
                  setIsScheduleCollapsed(false);
                }}
                title="Window Openings (N)"
              >
                <span>🪟</span>
                <span className="tool-shortcut-badge">N</span>
              </button>

              {/* HVAC Equipment Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'hvac' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('hvac');
                  setActiveTab('hvac');
                  setIsScheduleCollapsed(false);
                }}
                title="HVAC MEP & Sizing (H)"
              >
                <span>❄️</span>
                <span className="tool-shortcut-badge">H</span>
              </button>

              {/* Plumbing Fixture Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'plumbing' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('plumbing');
                  setActiveTab('plumbing');
                  setIsScheduleCollapsed(false);
                }}
                title="Plumbing Fixtures & Sanitary Piping (P)"
              >
                <span>🚰</span>
                <span className="tool-shortcut-badge">P</span>
              </button>

              {/* Furniture Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'furniture' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('furniture');
                  setActiveTab('furniture');
                  setIsScheduleCollapsed(false);
                }}
                title="Furniture & Millwork (F)"
              >
                <span>🛋️</span>
                <span className="tool-shortcut-badge">F</span>
              </button>

              {/* Electrical Tool */}
              <button
                type="button"
                className={`tool-palette-btn ${activeTool === 'electrical' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('electrical');
                  setActiveTab('electrical');
                  setIsScheduleCollapsed(false);
                }}
                title="Electrical Fixtures, Wiring & Circuits (E)"
              >
                <span>⚡</span>
                <span className="tool-shortcut-badge">E</span>
              </button>

              <div className="tool-palette-divider" />

              {/* Grid Toggle */}
              <button
                type="button"
                className={`tool-palette-btn ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(prev => !prev)}
                title="Toggle Metric Grid (G)"
              >
                <span>▦</span>
                <span className="tool-shortcut-badge">G</span>
              </button>

              {/* Reset View */}
              <button
                type="button"
                className="tool-palette-btn"
                onClick={handleResetView}
                title="Zoom to Fit Floorplan"
              >
                <span>⛶</span>
              </button>
            </aside>

            {/* 2. CENTER DOMINANT CAD VIEWPORT */}
            <div className="cad-viewport-container" style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>


              <ErrorBoundary name="2D CAD Canvas">
                <Canvas
                  key={canvasRenderKey}
                  solveData={solveData}
                  furniture={editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || [])}
                  plumbingFixtures={editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || [])}
                  plumbingPipes={editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || [])}
                  electricalComponents={editableElectricalComponents}
                  electricalCircuits={editableElectricalCircuits}
                  electricalRoutes={editableElectricalRoutes}
                  disciplineView={disciplineView}
                  disciplineDisplayMode={disciplineDisplayMode}
                  onDisciplineChange={handleDisciplineViewChange}
                  onDisplayModeToggle={handleToggleDisplayMode}
                  showGrid={showGrid}
                  showDimensions={showDimensions}
                  showDoors={showDoors}
                  showWindows={showWindows}
                  showHvac={showHvac}
                  showFurniture={showFurniture}
                  showPlumbing={showPlumbing}
                  showElectrical={showElectrical}
                  activeTool={activeTool}
                  selectedElectricalFixtureType={selectedElectricalFixtureType}
                  scaleModeFixed={scaleModeFixed}
                  isResizeModeActive={isResizeModeActive}
                  onLiveItemUpdate={handleLiveItemUpdate}
                  onCursorMove={setCursorCoords}
                  viewTransform={viewTransform}
                  setViewTransform={setViewTransform}
                  selectedItem={selectedElement}
                  onSelectItem={setSelectedElement}
                />
              </ErrorBoundary>

              {/* Validation & Auditing Drawer */}
              <ValidationDrawer
                isOpen={isValidationDrawerOpen}
                onClose={() => setIsValidationDrawerOpen(false)}
                solveData={solveData}
                editableDoors={editableDoors}
                editableWindows={editableWindows}
                editableHvac={editableHvac}
                editableFurniture={editableFurniture}
                editablePlumbingFixtures={editablePlumbingFixtures}
                editablePlumbingPipes={editablePlumbingPipes}
                onSelectIssue={handleSelectIssue}
              />

              {/* Floating Re-Open Button when Inspector is Collapsed */}
              {isInspectorCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsInspectorCollapsed(false)}
                  className="cad-inspector-open-tab"
                  title="Open Engineering Inspector"
                >
                  <span>◀ Project Summary</span>
                </button>
              )}
            </div>

            {/* 3. DEDICATED ENGINEERING INSPECTOR (Right Sidebar: Project Summary & Contextual Inspector) */}
            <EngineeringInspector
              solveData={solveData}
              editableDoors={editableDoors}
              editableWindows={editableWindows}
              editableHvac={editableHvac}
              editableFurniture={editableFurniture}
              editablePlumbingFixtures={editablePlumbingFixtures}
              editablePlumbingPipes={editablePlumbingPipes}
              editableElectricalComponents={editableElectricalComponents}
              editableElectricalCircuits={editableElectricalCircuits}
              selectedElement={selectedElement}
              onSelectItem={setSelectedElement}
              onLiveItemUpdate={handleLiveItemUpdate}
              isCollapsed={isInspectorCollapsed}
              onToggleCollapse={() => setIsInspectorCollapsed(prev => !prev)}
              totalIssuesCount={totalIssuesCount}
              disciplineView={disciplineView}
              onOpenBoq={handleOpenBoq}
              onExportPdf1={handleExportQuantitiesPdf}
              onExportPdf2={handleExportBoqCostPdf}
              isExportingPdf1={isExportingPdf}
              isExportingPdf2={isExportingBoqPdf}
            />
          </div>

          {/* 4. DOCKED BOTTOM SCHEDULE EDITOR (Spans 100% width up to the right end!) */}
          <BottomScheduleEditor
            solveData={solveData}
            editableDoors={editableDoors}
            editableWindows={editableWindows}
            editableHvac={editableHvac}
            editableFurniture={editableFurniture}
            editablePlumbingFixtures={editablePlumbingFixtures}
            editablePlumbingPipes={editablePlumbingPipes}
            editableElectricalComponents={editableElectricalComponents}
            editableElectricalCircuits={editableElectricalCircuits}
            editableElectricalRoutes={editableElectricalRoutes}
            selectedElement={selectedElement}
            onSelectItem={setSelectedElement}
            onLiveItemUpdate={handleLiveItemUpdate}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isCollapsed={isScheduleCollapsed}
            onToggleCollapse={() => setIsScheduleCollapsed(prev => !prev)}
            isExpanded={isScheduleExpanded}
            onToggleExpand={() => setIsScheduleExpanded(prev => !prev)}
            disciplineView={disciplineView}
            onAutoPopulateMep={handleAutoPopulateMep}
            onSwitchVariant={handleSwitchVariant}
            currentVariant={currentVariant}
            isPopulatingMep={isPopulatingMep}
            isSwitchingVariant={isSwitchingVariant}
            boqData={boqData}
            activeQualityTier={activeQualityTier}
            onSwitchTier={handleSwitchTierFromDashboard}
            onOpenBoq={handleOpenBoq}
            onExportPdf1={handleExportQuantitiesPdf}
            onExportPdf2={handleExportBoqCostPdf}
            isRecalculating={isCalculatingBoq}
            isExportingPdf1={isExportingPdf}
            isExportingPdf2={isExportingBoqPdf}
          />

          {/* 4. BOTTOM STATUS BAR */}
          <StatusBar
            cursorCoords={cursorCoords}
            zoomLevel={viewTransform.width}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(prev => !prev)}
            showDimensions={showDimensions}
            onToggleDimensions={() => setShowDimensions(prev => !prev)}
            showDoors={showDoors}
            onToggleDoors={() => setShowDoors(prev => !prev)}
            showWindows={showWindows}
            onToggleWindows={() => setShowWindows(prev => !prev)}
            showHvac={showHvac}
            onToggleHvac={() => setShowHvac(prev => !prev)}
            showFurniture={showFurniture}
            onToggleFurniture={() => setShowFurniture(prev => !prev)}
            showPlumbing={showPlumbing}
            onTogglePlumbing={() => setShowPlumbing(prev => !prev)}
            showElectrical={showElectrical}
            onToggleElectrical={() => setShowElectrical(prev => !prev)}
            isResizeModeActive={isResizeModeActive}
            onToggleResizeMode={() => setIsResizeModeActive(prev => !prev)}
            scaleModeFixed={scaleModeFixed}
            onToggleScaleMode={() => setScaleModeFixed(prev => !prev)}
            onResetView={handleResetView}
            onToggleValidation={() => setIsValidationDrawerOpen(prev => !prev)}
            issuesCount={totalIssuesCount}
          />
        </div>
      )}

      <CloudModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        currentProjectData={solveData}
        onLoadCloudProject={handleLoadCloudProject}
        onSaveToCloud={handleSaveToCloud}
        initialTab={cloudModalInitialTab}
      />
      <ExportImageModal 
        isOpen={isExportImageModalOpen} 
        onClose={() => setIsExportImageModalOpen(false)} 
      />
      <QualityTierSelectorModal
        isOpen={isTierSelectorOpen}
        onClose={() => setIsTierSelectorOpen(false)}
        activeTier={activeQualityTier}
        onSelectTier={handleSelectQualityTier}
        isCalculating={isCalculatingBoq}
      />
      <BoqDashboardModal
        isOpen={isBoqDashboardOpen}
        onClose={() => setIsBoqDashboardOpen(false)}
        boqData={boqData}
        projectId={solveData?.project_id || id}
        projectName={solveData?.project_name || "Floorplan"}
        onSwitchTier={handleSwitchTierFromDashboard}
        isRecalculating={isCalculatingBoq}
        onOpenTierSelector={() => {
          setIsTierSelectorOpen(true);
        }}
      />

      {/* Auto-MEP Configuration Modal */}
      <AutoMepModal
        isOpen={isAutoMepModalOpen}
        onClose={() => setIsAutoMepModalOpen(false)}
        onApply={handleApplyCoordinatedMep}
        projectName={solveData?.project_name}
      />

      {/* MEP Engineering Calculation & Sizing Sheet Modal */}
      <MepCalculationModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        solveData={solveData}
        projectName={solveData?.project_name || 'Project'}
      />

      {/* Multi-Discipline BIM Clash Matrix Drawer */}
      {isClashDrawerOpen && clashData && (
        <AutoCadClashDrawer
          clashData={clashData}
          onClose={() => setIsClashDrawerOpen(false)}
          onDownloadAuditReport={handleGenerateMasterSubmissionAudit}
          onHighlightClash={(pt) => showToast(`Inspecting clash at (${Math.round(pt.x)}, ${Math.round(pt.y)})`, "info")}
        />
      )}

      {/* Computational Engineering Analytics Dashboard */}
      {isEngineeringPanelOpen && (
        <AutoCadEngineeringPanel
          entities={cadEntities}
          detectedRooms={detectedRoomsMemo}
          onClose={() => setIsEngineeringPanelOpen(false)}
        />
      )}

      {/* 3D Spatial BIM Extrusion Viewport */}
      {is3DViewActive && (
        <AutoCad3DViewport
          entities={cadEntities}
          detectedRooms={detectedRoomsMemo}
          onClose={() => setIs3DViewActive(false)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
