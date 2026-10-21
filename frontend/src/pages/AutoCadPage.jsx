import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AutoCadRibbon from '../features/autocad/AutoCadRibbon';
import AutoCadCanvas from '../features/autocad/AutoCadCanvas';
import AutoCadCommandLine from '../features/autocad/AutoCadCommandLine';
import AutoCadStatusBar from '../features/autocad/AutoCadStatusBar';
import AutoCadLayerManager from '../features/autocad/AutoCadLayerManager';
import AutoCadPropertiesPanel from '../features/autocad/AutoCadPropertiesPanel';
import AutoCadBlockLibrary from '../features/autocad/AutoCadBlockLibrary';
import AutoCadEngineeringPanel from '../features/autocad/AutoCadEngineeringPanel';
import AutoCad3DViewport from '../features/autocad/AutoCad3DViewport';
import { useCadDraftingStore } from '../features/autocad/useCadDraftingStore';
import {
  extractRoomsFromLinework,
  parseCadInput,
  dist,
  rotateEntityGeometry,
  mirrorEntityGeometry,
  recalculateDoorGeometry,
  generateAutoDimensions,
  generateScheduleTable,
  generateTitleBlockAndBorder,
  generateStructuralGridAndColumns,
  generateAutomatedMepNetworks,
  generateAutomatedElectricalSystem
} from '../features/autocad/cadGeometryUtils';
import { fetchProjectById, updateProjectById, createManualProject, solveCadGeometry, exportDxf } from '../api';
import Toast from '../Toast';

export default function AutoCadPage() {
  const params = useParams();
  const rawId = params.id || params.projectId;
  const projectId = (rawId && rawId !== "undefined" && rawId !== "null" && rawId.trim()) ? rawId.trim() : null;
  const navigate = useNavigate();

  const containerRef = useRef(null);

  // CAD Drafting State Store
  const {
    entities,
    setEntities,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    activeTool,
    setActiveTool,
    selectedIds,
    setSelectedIds,
    selectEntity,
    selectEntitiesInRect,
    settings,
    toggleSetting,
    updateSetting,
    addEntity,
    addEntities,
    updateEntity,
    deleteEntities,
    undo,
    redo,
    clearAll,
    canUndo,
    canRedo
  } = useCadDraftingStore();

  // Command prompt & console history
  const [promptText, setPromptText] = useState("Command: ");
  const [commandHistory, setCommandHistory] = useState([
    { text: "MEPlanIQ AutoCAD Direct Drafting Studio [Version 2.5 - Professional Edition]", type: "info" },
    { text: "Seamless Corner Mitering & OSNAP Active. Type LINE, WALL, DOOR, WINDOW, FILLET, TRIM or ESC.", type: "info" }
  ]);

  // Status & modal visibility
  const [cursorCoords, setCursorCoords] = useState({ x: 0, y: 0 });
  const [isLayerManagerOpen, setIsLayerManagerOpen] = useState(false);
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isEngineeringPanelOpen, setIsEngineeringPanelOpen] = useState(false);
  const [showWallDimensions, setShowWallDimensions] = useState(true);
  const [showThermalHeatmap, setShowThermalHeatmap] = useState(false);
  const [is3DViewActive, setIs3DViewActive] = useState(false);
  const [activeBlockToPlace, setActiveBlockToPlace] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionModal, setConversionModal] = useState(null);
  const [projectName, setProjectName] = useState("Direct CAD Plan");

  const appendHistory = useCallback((text, type = 'normal') => {
    setCommandHistory(prev => [...prev, { text, type, time: Date.now() }]);
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    setToastMessage({ message: msg, type });
  }, []);

  // Selected entity for Properties Panel
  const selectedEntity = entities.find(e => selectedIds.includes(e.id)) || null;

  // Live Detected Rooms from CAD linework planar topology
  const detectedRooms = useMemo(() => extractRoomsFromLinework(entities), [entities]);

  // 1. Load project or initialize demo starter walls
  useEffect(() => {
    if (!projectId) {
      if (entities.length === 0) {
        // Create 4 cleanly connecting walls forming a 5000 x 4000 mm room
        const demoWalls = [
          { type: 'wall', centerline: { p1: { x: 0, y: 0 }, p2: { x: 5000, y: 0 } }, thickness: 150, layer: 'A-WALL' },
          { type: 'wall', centerline: { p1: { x: 5000, y: 0 }, p2: { x: 5000, y: 4000 } }, thickness: 150, layer: 'A-WALL' },
          { type: 'wall', centerline: { p1: { x: 5000, y: 4000 }, p2: { x: 0, y: 4000 } }, thickness: 150, layer: 'A-WALL' },
          { type: 'wall', centerline: { p1: { x: 0, y: 4000 }, p2: { x: 0, y: 0 } }, thickness: 150, layer: 'A-WALL' }
        ];
        addEntities(demoWalls);
        appendHistory("Loaded starter room (5000 x 4000 mm). Wall corners automatically mitered.", "info");
      }
      return;
    }

    async function loadProject() {
      try {
        appendHistory(`Loading project ${projectId}...`, "info");
        const proj = await fetchProjectById(projectId);
        if (proj && proj.name) setProjectName(proj.name);

        const cadData = proj.cad_data || proj.cad_json_data;
        if (cadData) {
          const parsed = typeof cadData === 'string' ? JSON.parse(cadData) : cadData;
          if (parsed.drafting_entities && Array.isArray(parsed.drafting_entities)) {
            setEntities(parsed.drafting_entities);
            appendHistory(`Loaded ${parsed.drafting_entities.length} CAD entities.`, "info");
          } else if (parsed.rooms && Array.isArray(parsed.rooms)) {
            const reconstructed = [];
            parsed.rooms.forEach(room => {
              const pts = room.points || [];
              for (let i = 0; i < pts.length; i++) {
                const next = pts[(i + 1) % pts.length];
                reconstructed.push({
                  type: 'wall',
                  centerline: { p1: { x: pts[i][0], y: pts[i][1] }, p2: { x: next[0], y: next[1] } },
                  thickness: 150,
                  layer: 'A-WALL'
                });
              }
            });
            if (reconstructed.length > 0) {
              setEntities(reconstructed);
              appendHistory(`Converted ${parsed.rooms.length} rooms into CAD walls.`, "info");
            }
          }
        }
      } catch (err) {
        appendHistory(`Failed to load project: ${err.message}`, "error");
        showToast("Error loading project data.", "error");
      }
    }
    loadProject();
  }, [projectId]);

  // 1.5 Quick Selection Transform Handlers
  const handleRotateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      const ent = entities.find(e => e.id === id);
      if (ent) {
        const rotated = rotateEntityGeometry(ent, 90);
        updateEntity(id, rotated);
      }
    });
    appendHistory(`ROTATE: Rotated ${selectedIds.length} object(s) 90°.`);
  }, [selectedIds, entities, updateEntity, appendHistory]);

  const handleMirrorSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      const ent = entities.find(e => e.id === id);
      if (ent) {
        const mirrored = mirrorEntityGeometry(ent, 'vertical');
        updateEntity(id, mirrored);
      }
    });
    appendHistory(`MIRROR: Mirrored ${selectedIds.length} object(s).`);
  }, [selectedIds, entities, updateEntity, appendHistory]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const newCopies = [];
    selectedIds.forEach(id => {
      const ent = entities.find(e => e.id === id);
      if (ent) {
        const clone = JSON.parse(JSON.stringify(ent));
        delete clone.id;
        const shift = 400;
        if (clone.type === 'wall' && clone.centerline) {
          clone.centerline.p1.x += shift;
          clone.centerline.p1.y += shift;
          clone.centerline.p2.x += shift;
          clone.centerline.p2.y += shift;
        } else if (clone.type === 'line' && clone.p1 && clone.p2) {
          clone.p1.x += shift;
          clone.p1.y += shift;
          clone.p2.x += shift;
          clone.p2.y += shift;
        } else if (clone.type === 'rect' && clone.p1 && clone.p2) {
          clone.p1.x += shift;
          clone.p1.y += shift;
          clone.p2.x += shift;
          clone.p2.y += shift;
        } else if (clone.type === 'circle' && clone.center) {
          clone.center.x += shift;
          clone.center.y += shift;
        } else if (clone.x !== undefined && clone.y !== undefined) {
          clone.x += shift;
          clone.y += shift;
        }
        newCopies.push(clone);
      }
    });
    if (newCopies.length > 0) {
      addEntities(newCopies);
      appendHistory(`COPY: Duplicated ${newCopies.length} object(s).`);
    }
  }, [selectedIds, entities, addEntities, appendHistory]);

  const handleAutoDimensionAll = useCallback(() => {
    const newDims = generateAutoDimensions(entities);
    if (newDims.length > 0) {
      addEntities(newDims);
      appendHistory(`AUTODIM: Generated ${newDims.length} perimeter dimension strings.`);
      showToast(`Generated ${newDims.length} architectural dimension strings`, "success");
    } else {
      showToast("No walls found to dimension", "info");
    }
  }, [entities, addEntities, appendHistory, showToast]);

  const handleInsertScheduleTable = useCallback(() => {
    let minX = 0, minY = 0, maxX = 6000, maxY = 5000;
    if (entities.length > 0) {
      const xs = [];
      const ys = [];
      entities.forEach(e => {
        if (e.centerline) {
          xs.push(e.centerline.p1.x, e.centerline.p2.x);
          ys.push(e.centerline.p1.y, e.centerline.p2.y);
        } else if (e.p1 && e.p2) {
          xs.push(e.p1.x, e.p2.x);
          ys.push(e.p1.y, e.p2.y);
        } else if (e.x !== undefined && e.y !== undefined) {
          xs.push(e.x);
          ys.push(e.y);
        }
      });
      if (xs.length > 0) {
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
      }
    }
    const origin = { x: maxX + 1000, y: minY };
    const tableEntities = generateScheduleTable(entities, detectedRooms, origin);
    if (tableEntities.length > 0) {
      addEntities(tableEntities);
      appendHistory(`TABLE: Generated Architectural Permit Schedule with ${tableEntities.length} linework/text entities.`);
      showToast("Permit Schedule Table placed in drawing", "success");
    } else {
      showToast("No schedule items to display", "info");
    }
  }, [entities, detectedRooms, addEntities, appendHistory, showToast]);

  const handleInsertTitleBlock = useCallback(() => {
    const borderEntities = generateTitleBlockAndBorder(entities, projectName || "BIM RESEARCH PROJECT", "A1");
    // Filter out previous title blocks/borders if re-running
    const cleanEntities = entities.filter(e => !e.isSheetBorder && !e.isTitleBlock);
    setEntities([...cleanEntities, ...borderEntities]);
    appendHistory(`SHEET: Fitted ISO 5457 A1 Sheet Border & ISO 7200 Title Block with North Arrow (${borderEntities.length} entities).`);
    showToast("ISO A1 Sheet Border & Title Block stamped!", "success");
  }, [entities, projectName, setEntities, appendHistory, showToast]);

  const handleGenerateStructuralGrid = useCallback(() => {
    const structuralElements = generateStructuralGridAndColumns(entities, 300);
    if (structuralElements.length > 0) {
      // Remove any existing structural columns/gridlines if regenerating
      const cleanEntities = entities.filter(e => !e.isStructural);
      setEntities([...cleanEntities, ...structuralElements]);
      const colCount = structuralElements.filter(e => e.type === 'column').length;
      const gridCount = structuralElements.filter(e => e.type === 'gridline').length;
      appendHistory(`GRID: Placed ${colCount} reinforced concrete columns (300x300mm) and ${gridCount} structural grid axes with inter-bay dimensions.`);
      showToast(`Generated ${colCount} columns and ${gridCount} grid axes!`, "success");
    } else {
      showToast("No walls found to compute structural column grid", "info");
    }
  }, [entities, setEntities, appendHistory, showToast]);

  const handleGenerateAutomatedMep = useCallback(() => {
    const mepElements = generateAutomatedMepNetworks(entities, detectedRooms);
    if (mepElements.length > 0) {
      // Remove any previous MEP entities if re-running
      const cleanEntities = entities.filter(e => !e.isMep);
      setEntities([...cleanEntities, ...mepElements]);
      const ductCount = mepElements.filter(e => e.type === 'mep-duct').length;
      const termCount = mepElements.filter(e => e.type === 'air-terminal').length;
      const pipeCount = mepElements.filter(e => e.type === 'mep-pipe').length;
      appendHistory(`MEP: Routed coordinated MEP systems (${ductCount} supply duct runs, ${termCount} diffusers/grilles, and ${pipeCount} water/soil pipe runs).`);
      showToast(`Generated ${ductCount} ducts & ${pipeCount} plumbing lines!`, "success");
    } else {
      showToast("No walls found to route MEP systems", "info");
    }
  }, [entities, detectedRooms, setEntities, appendHistory, showToast]);

  const handleGenerateAutomatedElectrical = useCallback(() => {
    const elecElements = generateAutomatedElectricalSystem(entities, detectedRooms);
    if (elecElements.length > 0) {
      // Filter out any previous electrical elements if re-running
      const cleanEntities = entities.filter(e => !e.isElectrical);
      setEntities([...cleanEntities, ...elecElements]);
      const lightCount = elecElements.filter(e => e.type === 'elec-fixture' && e.subType === 'downlight').length;
      const socketCount = elecElements.filter(e => e.type === 'elec-fixture' && e.subType === 'receptacle').length;
      const conduitCount = elecElements.filter(e => e.type === 'elec-conduit').length;
      appendHistory(`ELEC: Auto-wired ${lightCount} luminaires, ${socketCount} receptacles, and ${conduitCount} conduit splines to Main DB-01.`);
      showToast(`Wired ${lightCount} luminaires & ${conduitCount} conduit circuits!`, "success");
    } else {
      showToast("No architectural envelope found to wire electrical circuits", "info");
    }
  }, [entities, detectedRooms, setEntities, appendHistory, showToast]);

  const handleFlipDoorSwing = useCallback(() => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      const ent = entities.find(e => e.id === id);
      if (ent && ent.type === 'door') {
        const cur = ent.swing || 'inward-left';
        const flipped = cur.includes('left') ? cur.replace('left', 'right') : cur.replace('right', 'left');
        const updated = recalculateDoorGeometry(ent, flipped, ent.widthMm);
        updateEntity(id, updated);
      }
    });
    appendHistory("DOOR: Flipped swing direction.");
  }, [selectedIds, entities, updateEntity, appendHistory]);

  // 2. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'F3') {
        e.preventDefault();
        toggleSetting('osnap');
        appendHistory(`OSNAP: ${!settings.osnap ? 'ON' : 'OFF'}`, 'info');
      } else if (e.key === 'F7') {
        e.preventDefault();
        toggleSetting('grid');
        appendHistory(`GRID: ${!settings.grid ? 'ON' : 'OFF'}`, 'info');
      } else if (e.key === 'F8') {
        e.preventDefault();
        toggleSetting('ortho');
        appendHistory(`ORTHO: ${!settings.ortho ? 'ON' : 'OFF'}`, 'info');
      } else if (e.key === 'F10') {
        e.preventDefault();
        toggleSetting('polar');
        appendHistory(`POLAR: ${!settings.polar ? 'ON' : 'OFF'}`, 'info');
      } else if (e.key === 'F9') {
        e.preventDefault();
        toggleSetting('snapToGrid');
        appendHistory(`SNAP: ${!settings.snapToGrid ? 'ON' : 'OFF'}`, 'info');
      } else if (e.key === 'Delete') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteEntities(selectedIds);
          appendHistory(`Deleted ${selectedIds.length} entity/entities.`, 'normal');
        }
      } else if (e.key.toLowerCase() === 'r' && selectedIds.length > 0) {
        e.preventDefault();
        handleRotateSelected();
      } else if (e.key.toLowerCase() === 'm' && selectedIds.length > 0) {
        e.preventDefault();
        handleMirrorSelected();
      } else if (e.key.toLowerCase() === 'c' && selectedIds.length > 0 && !e.ctrlKey) {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key.toLowerCase() === 'f' && selectedIds.length > 0) {
        e.preventDefault();
        handleFlipDoorSwing();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (undo()) appendHistory("UNDO", "normal");
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (redo()) appendHistory("REDO", "normal");
      } else if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedIds([]);
        setActiveBlockToPlace(null);
        appendHistory("*Cancel*", "normal");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    settings,
    selectedIds,
    undo,
    redo,
    toggleSetting,
    deleteEntities,
    handleRotateSelected,
    handleMirrorSelected,
    handleDuplicateSelected,
    handleFlipDoorSwing,
    appendHistory
  ]);

  // 3. Command Line Execution Handler
  const handleExecuteCommand = useCallback((cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;

    appendHistory(`Command: ${cleanCmd}`);

    switch (cleanCmd) {
      case 'W':
      case 'WALL':
        setActiveTool('wall');
        appendHistory("WALL Specify start point (corners miter automatically):");
        break;

      case 'D':
      case 'DOOR':
        setActiveTool('door');
        appendHistory("DOOR Click on wall to place door:");
        break;

      case 'WND':
      case 'WINDOW':
        setActiveTool('window');
        appendHistory("WINDOW Click on wall to place window:");
        break;

      case 'T':
      case 'TEXT':
        setActiveTool('text');
        appendHistory("TEXT Click point to place text label:");
        break;

      case 'F':
      case 'FILLET':
        setActiveTool('fillet');
        appendHistory("FILLET Select first line to miter corner:");
        break;

      case 'CHA':
      case 'CHAMFER':
        setActiveTool('chamfer');
        appendHistory("CHAMFER Select first line to chamfer corner:");
        break;

      case 'L':
      case 'LINE':
        setActiveTool('line');
        appendHistory("LINE Specify first point:");
        break;

      case 'PL':
      case 'PLINE':
        setActiveTool('polyline');
        appendHistory("PLINE Specify start point:");
        break;

      case 'REC':
      case 'RECTANGLE':
        setActiveTool('rect');
        appendHistory("RECTANGLE Specify first corner:");
        break;

      case 'C':
      case 'CIRCLE':
        setActiveTool('circle');
        appendHistory("CIRCLE Specify center point:");
        break;

      case 'A':
      case 'ARC':
        setActiveTool('arc');
        appendHistory("ARC Specify start point:");
        break;

      case 'O':
      case 'OFFSET':
        setActiveTool('offset');
        appendHistory("OFFSET Specify offset distance (click line to offset):");
        break;

      case 'RO':
      case 'ROTATE':
        setActiveTool('rotate');
        appendHistory("ROTATE Specify base point and rotation angle:");
        break;

      case 'MI':
      case 'MIRROR':
        setActiveTool('mirror');
        appendHistory("MIRROR Specify first point of mirror line:");
        break;

      case 'CO':
      case 'CP':
      case 'COPY':
        setActiveTool('copy');
        appendHistory("COPY Specify base point to copy entities:");
        break;

      case 'NEW':
      case 'QNEW':
        if (window.confirm("⚠️ Clear current AutoCAD drawing?\n\nThis will remove all linework and blocks.")) {
          clearAll();
          appendHistory("NEW Clean drawing session created.");
        }
        break;

      case 'TR':
      case 'TRIM':
        setActiveTool('trim');
        appendHistory("TRIM Select object to trim:");
        break;

      case 'EX':
      case 'EXTEND':
        setActiveTool('extend');
        appendHistory("EXTEND Select boundary edge:");
        break;

      case 'E':
      case 'ERASE':
      case 'DEL':
        if (selectedIds.length > 0) {
          deleteEntities(selectedIds);
          appendHistory(`ERASE ${selectedIds.length} object(s) erased.`);
        } else {
          setActiveTool('erase');
          appendHistory("ERASE Select objects to delete:");
        }
        break;

      case 'DIM':
      case 'DIMENSION':
        setActiveTool('dimension');
        appendHistory("DIM Specify extension line origin:");
        break;

      case 'BLK':
      case 'BLOCK':
      case 'INSERT':
        setIsBlockLibraryOpen(true);
        appendHistory("Opening Architectural Block Library...");
        break;

      case 'PROP':
      case 'PROPERTIES':
        setIsPropertiesOpen(prev => !prev);
        appendHistory("Toggled Properties Palette.");
        break;

      case 'ENG':
      case 'BIM':
      case 'ANALYTICS':
      case 'COMPLIANCE':
        setIsEngineeringPanelOpen(prev => !prev);
        appendHistory("Toggled BIM Engineering Analytics & Compliance Dashboard.");
        break;

      case 'DIMS':
        setShowWallDimensions(prev => !prev);
        appendHistory(`Wall Dimensions: ${!showWallDimensions ? 'ON' : 'OFF'}`);
        break;

      case 'HEATMAP':
      case 'HVACMAP':
      case 'THERMAL':
        setShowThermalHeatmap(prev => !prev);
        appendHistory(`ASHRAE Thermal Comfort Heatmap: ${!showThermalHeatmap ? 'ON' : 'OFF'}`);
        break;

      case '3D':
      case 'ISO':
      case 'ORBIT':
      case 'AXO':
      case 'EXTRUDE':
        setIs3DViewActive(true);
        appendHistory("Toggled 3D Spatial BIM Axonometric Extrusion View.");
        break;

      case 'PLAN':
      case '2D':
        setIs3DViewActive(false);
        appendHistory("Switched to 2D Plan View.");
        break;

      case 'AUTODIM':
      case 'DIMALL':
        handleAutoDimensionAll();
        break;

      case 'TABLE':
      case 'SCHEDULE':
        handleInsertScheduleTable();
        break;

      case 'TITLEBLOCK':
      case 'BORDER':
      case 'SHEET':
      case 'FRAME':
        handleInsertTitleBlock();
        break;

      case 'GRID':
      case 'COLS':
      case 'COLUMN':
      case 'COLUMNS':
        handleGenerateStructuralGrid();
        break;

      case 'MEP':
      case 'AUTODUCT':
      case 'AUTOPLUMB':
      case 'DUCTS':
        handleGenerateAutomatedMep();
        break;

      case 'ELEC':
      case 'ELECTRICAL':
      case 'AUTOWIRE':
      case 'WIRING':
      case 'LIGHTING':
        handleGenerateAutomatedElectrical();
        break;

      case 'U':
      case 'UNDO':
        if (undo()) appendHistory("UNDO");
        else appendHistory("Nothing to undo.", "error");
        break;

      case 'REDO':
        if (redo()) appendHistory("REDO");
        else appendHistory("Nothing to redo.", "error");
        break;

      case 'ZE':
      case 'ZOOM':
        if (window.__autocadZoomExtents) {
          window.__autocadZoomExtents();
          appendHistory("ZOOM Extents");
        }
        break;

      case 'CLEAR':
      case 'CLS':
        setCommandHistory([]);
        break;

      default:
        appendHistory(`Unknown command "${cleanCmd}". Type WALL, DOOR, WINDOW, FILLET, LINE, REC, DIM, or BLK.`, 'error');
        break;
    }
  }, [selectedIds, deleteEntities, undo, redo, showWallDimensions, showThermalHeatmap, handleAutoDimensionAll, handleInsertScheduleTable, handleInsertTitleBlock, handleGenerateStructuralGrid, handleGenerateAutomatedMep, handleGenerateAutomatedElectrical, appendHistory]);

  // Coordinate Input Handler
  const handleCoordinateSubmit = useCallback((coordStr) => {
    appendHistory(`Input: ${coordStr}`);
    const pt = parseCadInput(coordStr, cursorCoords, settings.ortho ? 0 : 45);
    if (!pt) {
      appendHistory(`Invalid coordinate format: "${coordStr}".`, "error");
      return;
    }

    if (activeTool === 'wall' || activeTool === 'line') {
      const p1 = cursorCoords;
      const p2 = pt;
      if (activeTool === 'wall') {
        addEntity({
          type: 'wall',
          centerline: { p1, p2 },
          thickness: settings.wallThickness,
          layer: 'A-WALL'
        });
        appendHistory(`WALL placed to (${pt.x}, ${pt.y})`);
      } else {
        addEntity({
          type: 'line',
          p1,
          p2,
          layer: activeLayerId
        });
        appendHistory(`LINE placed to (${pt.x}, ${pt.y})`);
      }
      setCursorCoords(pt);
    } else {
      appendHistory(`Point accepted: (${pt.x}, ${pt.y})`);
      setCursorCoords(pt);
    }
  }, [cursorCoords, settings, activeTool, activeLayerId, addEntity, appendHistory]);

  // "Convert Linework to Parametric Floor Plan"
  const handleConvertToBim = async () => {
    try {
      setIsConverting(true);
      appendHistory("Analyzing CAD linework topology...", "info");

      const result = extractRoomsFromLinework(entities, 70);

      if (!result.rooms || result.rooms.length === 0) {
        appendHistory("Topology Solver: No closed loops found. Ensure walls meet at corners.", "error");
        showToast("No closed rooms detected. Connect walls to form closed loops.", "warning");
        setIsConverting(false);
        return;
      }

      appendHistory(`Detected ${result.rooms.length} closed room boundary/boundaries!`, "info");
      const solved = await solveCadGeometry(result.rooms);
      appendHistory(`MEPlanIQ Solver: Carpet Area = ${solved.total_carpet_area_sqm} m², Built-up Area = ${solved.total_builtup_area_sqm} m²`, "info");

      setConversionModal({
        rooms: result.rooms,
        solved,
        warnings: result.warnings
      });
      showToast(`Successfully solved ${result.rooms.length} rooms!`, "success");
    } catch (err) {
      appendHistory(`Conversion failed: ${err.message}`, "error");
      showToast(`Conversion failed: ${err.message}`, "error");
    } finally {
      setIsConverting(false);
    }
  };

  // Save Project
  const handleSaveProject = async () => {
    try {
      appendHistory("Saving project...", "info");
      const payloadData = {
        drafting_entities: entities,
        layers: layers,
        drafting_settings: settings
      };

      if (projectId) {
        await updateProjectById(projectId, payloadData);
        appendHistory(`Project ${projectId} saved successfully.`, "info");
        showToast("CAD project saved successfully!", "success");
      } else {
        const created = await createManualProject(projectName || "AutoCAD Draft Plan");
        if (created && created.id) {
          await updateProjectById(created.id, payloadData);
          appendHistory(`Created new project ${created.id}.`, "info");
          showToast("New CAD project created and saved!", "success");
          navigate(`/projects/${created.id}/drafting`, { replace: true });
        }
      }
    } catch (err) {
      appendHistory(`Save failed: ${err.message}`, "error");
      showToast(`Save failed: ${err.message}`, "error");
    }
  };

  // Export DXF
  const handleExportDxf = async () => {
    try {
      appendHistory("Generating direct AutoCAD DXF...", "info");
      const roomAnalysis = extractRoomsFromLinework(entities, 80);
      const roomsToExport = roomAnalysis.rooms.length > 0 ? roomAnalysis.rooms : [
        { name: "Draft_Zone", points: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]] }
      ];
      await exportDxf(roomsToExport);
      appendHistory("DXF export initiated.", "info");
      showToast("AutoCAD DXF downloaded successfully!", "success");
    } catch (err) {
      appendHistory(`DXF export failed: ${err.message}`, "error");
      showToast("DXF export failed.", "error");
    }
  };

  const handleExportSvg = () => {
    try {
      const svgElem = document.querySelector('.autocad-page-container svg');
      if (!svgElem) {
        showToast("No active drafting viewport found.", "error");
        return;
      }
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgElem);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'AutoCAD_Plan'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Vector SVG exported successfully!", "success");
      appendHistory("Exported vector SVG file.", "info");
    } catch (err) {
      showToast(`SVG export failed: ${err.message}`, "error");
    }
  };

  const handleExportPng = () => {
    try {
      const svgElem = document.querySelector('.autocad-page-container svg');
      if (!svgElem) {
        showToast("No active drafting viewport found.", "error");
        return;
      }
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgElem);
      const img = new Image();
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = Math.max(1600, (svgElem.clientWidth || 800) * 2);
        cvs.height = Math.max(1200, (svgElem.clientHeight || 600) * 2);
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#0A0E17';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.href = cvs.toDataURL('image/png');
        a.download = `${projectName || 'AutoCAD_Plan'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("High-Res PNG snapshot exported!", "success");
        appendHistory("Exported high-res PNG image.", "info");
      };
      img.src = url;
    } catch (err) {
      showToast(`PNG export failed: ${err.message}`, "error");
    }
  };

  return (
    <div className="autocad-page-container" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0A0E17',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Top AutoCAD Ribbon */}
      <AutoCadRibbon
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onOpenLayerManager={() => setIsLayerManagerOpen(true)}
        onOpenBlockLibrary={() => setIsBlockLibraryOpen(true)}
        onTogglePropertiesPanel={() => setIsPropertiesOpen(prev => !prev)}
        isPropertiesOpen={isPropertiesOpen}
        onToggleEngineeringPanel={() => setIsEngineeringPanelOpen(prev => !prev)}
        isEngineeringPanelOpen={isEngineeringPanelOpen}
        showWallDimensions={showWallDimensions}
        onToggleWallDimensions={() => setShowWallDimensions(prev => !prev)}
        showThermalHeatmap={showThermalHeatmap}
        onToggleThermalHeatmap={() => setShowThermalHeatmap(prev => !prev)}
        is3DViewActive={is3DViewActive}
        onToggle3DView={() => setIs3DViewActive(prev => !prev)}
        onAutoDimensionAll={handleAutoDimensionAll}
        onInsertScheduleTable={handleInsertScheduleTable}
        onInsertTitleBlock={handleInsertTitleBlock}
        onGenerateStructuralGrid={handleGenerateStructuralGrid}
        onGenerateAutomatedMep={handleGenerateAutomatedMep}
        onGenerateAutomatedElectrical={handleGenerateAutomatedElectrical}
        settings={settings}
        onUpdateSetting={updateSetting}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onConvertToBim={handleConvertToBim}
        onSaveProject={handleSaveProject}
        onExportDxf={handleExportDxf}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onClearAll={clearAll}
        isConverting={isConverting}
      />

      {/* Main Drafting Canvas Viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AutoCadCanvas
          entities={entities}
          layers={layers}
          activeLayerId={activeLayerId}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          settings={settings}
          selectedIds={selectedIds}
          onSelectEntity={selectEntity}
          onSelectEntitiesInRect={selectEntitiesInRect}
          onAddEntity={addEntity}
          onUpdateEntity={updateEntity}
          onDeleteEntities={deleteEntities}
          onCursorMove={setCursorCoords}
          onPromptUpdate={setPromptText}
          activeBlockToPlace={activeBlockToPlace}
          onClearActiveBlock={() => setActiveBlockToPlace(null)}
          showWallDimensions={showWallDimensions}
          showThermalHeatmap={showThermalHeatmap}
          containerRef={containerRef}
        />

        {/* 3D Spatial BIM Axonometric Extrusion Viewport */}
        {is3DViewActive && (
          <AutoCad3DViewport
            entities={entities}
            detectedRooms={detectedRooms}
            onClose={() => setIs3DViewActive(false)}
          />
        )}

        {/* Floating Selection Quick-Action Palette */}
        {selectedIds.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #38BDF8',
            borderRadius: '24px',
            padding: '4px 12px',
            zIndex: 40,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
          }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, paddingRight: '4px', borderRight: '1px solid #334155' }}>
              {selectedIds.length} Selected
            </span>

            <button
              type="button"
              onClick={handleRotateSelected}
              title="Rotate 90° (R)"
              style={{ background: '#1E293B', border: '1px solid #475569', color: '#38BDF8', padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>⟳</span> Rotate
            </button>

            <button
              type="button"
              onClick={handleMirrorSelected}
              title="Mirror (M)"
              style={{ background: '#1E293B', border: '1px solid #475569', color: '#38BDF8', padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>⇄</span> Mirror
            </button>

            <button
              type="button"
              onClick={handleDuplicateSelected}
              title="Duplicate (C)"
              style={{ background: '#1E293B', border: '1px solid #475569', color: '#38BDF8', padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>📋</span> Duplicate
            </button>

            {selectedEntity?.type === 'door' && (
              <button
                type="button"
                onClick={handleFlipDoorSwing}
                title="Flip Swing (F)"
                style={{ background: '#1E293B', border: '1px solid #475569', color: '#FACC15', padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>🚪</span> Flip Swing
              </button>
            )}

            <button
              type="button"
              onClick={() => deleteEntities(selectedIds)}
              title="Delete (Del)"
              style={{ background: '#7F1D1D', border: '1px solid #EF4444', color: '#F8FAFC', padding: '4px 8px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>🗑️</span>
            </button>
          </div>
        )}

        {/* Floating Command Line HUD */}
        <AutoCadCommandLine
          promptText={promptText}
          history={commandHistory}
          onExecuteCommand={handleExecuteCommand}
          onCoordinateSubmit={handleCoordinateSubmit}
          onCancelCommand={() => {
            setActiveTool('select');
            setSelectedIds([]);
            setActiveBlockToPlace(null);
            appendHistory("*Cancel*");
          }}
        />

        {/* Properties Inspector Panel (Right) */}
        {isPropertiesOpen && selectedEntity && (
          <AutoCadPropertiesPanel
            selectedEntity={selectedEntity}
            layers={layers}
            onUpdateEntity={updateEntity}
            onDeleteEntity={(id) => deleteEntities([id])}
            onClose={() => setIsPropertiesOpen(false)}
          />
        )}

        {/* PhD Grade BIM Engineering Analytics & Compliance Panel (Right) */}
        {isEngineeringPanelOpen && (
          <AutoCadEngineeringPanel
            entities={entities}
            detectedRooms={detectedRooms}
            onClose={() => setIsEngineeringPanelOpen(false)}
          />
        )}

        {/* View Mode Switcher Pill (Top Right) */}
        <div style={{
          position: 'absolute',
          top: 14,
          right: (isPropertiesOpen && selectedEntity) ? 310 : (isEngineeringPanelOpen ? 450 : 18),
          display: 'flex',
          gap: '8px',
          zIndex: 30,
          transition: 'right 0.2s ease'
        }}>
          {projectId && (
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/cad`)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <span>📐</span>
              <span>Switch to Parametric Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/projects')}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #475569',
              color: '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Bottom AutoCAD Status Bar */}
      <AutoCadStatusBar
        cursorCoords={cursorCoords}
        settings={settings}
        onToggleSetting={toggleSetting}
        onUpdateSetting={updateSetting}
        onZoomExtents={() => {
          if (window.__autocadZoomExtents) window.__autocadZoomExtents();
        }}
        onZoomReset={() => {
          if (window.__autocadZoomExtents) window.__autocadZoomExtents();
        }}
      />

      {/* Layer Properties Manager */}
      <AutoCadLayerManager
        isOpen={isLayerManagerOpen}
        onClose={() => setIsLayerManagerOpen(false)}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectActiveLayer={setActiveLayerId}
        onUpdateLayers={setLayers}
      />

      {/* Architectural CAD Block Library */}
      <AutoCadBlockLibrary
        isOpen={isBlockLibraryOpen}
        onClose={() => setIsBlockLibraryOpen(false)}
        onSelectBlock={(block) => {
          setActiveBlockToPlace(block);
          appendHistory(`Selected Block: ${block.name}. Click on canvas to insert.`);
        }}
      />

      {/* BIM Conversion Results Modal */}
      {conversionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110
        }}>
          <div style={{
            backgroundColor: '#0F172A',
            border: '1px solid #38BDF8',
            borderRadius: '10px',
            width: '560px',
            padding: '24px',
            color: '#F8FAFC',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '20px' }}>🎉</span>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#38BDF8' }}>
                Topology Solved: {conversionModal.rooms.length} Closed Rooms Detected
              </h3>
            </div>

            <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Your CAD linework was successfully converted into parametric architectural rooms.
            </p>

            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: '#94A3B8' }}>Total Carpet Area:</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#38BDF8' }}>
                  {conversionModal.solved?.total_carpet_area_sqm || 0} m²
                </div>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Total Built-up Area:</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#22C55E' }}>
                  {conversionModal.solved?.total_builtup_area_sqm || 0} m²
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConversionModal(null)}
                style={{
                  background: '#334155',
                  border: '1px solid #475569',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Keep in AutoCAD Studio
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const savePayload = {
                      rooms: conversionModal.rooms,
                      drafting_entities: entities
                    };
                    if (projectId) {
                      await updateProjectById(projectId, savePayload);
                      navigate(`/projects/${projectId}/cad`);
                    } else {
                      const created = await createManualProject("AutoCAD Converted Plan");
                      if (created && created.id) {
                        await updateProjectById(created.id, savePayload);
                        navigate(`/projects/${created.id}/cad`);
                      }
                    }
                  } catch (e) {
                    showToast("Failed to transition: " + e.message, "error");
                  }
                }}
                style={{
                  background: '#0284C7',
                  border: '1px solid #38BDF8',
                  color: 'white',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}
              >
                Open in Full MEP Studio →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
