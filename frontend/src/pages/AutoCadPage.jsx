import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AutoCadRibbon from '../features/autocad/AutoCadRibbon';
import AutoCadCanvas from '../features/autocad/AutoCadCanvas';
import AutoCadCommandLine from '../features/autocad/AutoCadCommandLine';
import AutoCadStatusBar from '../features/autocad/AutoCadStatusBar';
import AutoCadLayerManager from '../features/autocad/AutoCadLayerManager';
import AutoCadPropertiesPanel from '../features/autocad/AutoCadPropertiesPanel';
import AutoCadBlockLibrary from '../features/autocad/AutoCadBlockLibrary';
import { useCadDraftingStore } from '../features/autocad/useCadDraftingStore';
import { extractRoomsFromLinework, parseCadInput, dist } from '../features/autocad/cadGeometryUtils';
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
  const [showWallDimensions, setShowWallDimensions] = useState(true);
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
  }, [settings, selectedIds, undo, redo, toggleSetting, deleteEntities, appendHistory]);

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
        appendHistory("OFFSET Specify offset distance:");
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

      case 'DIMS':
        setShowWallDimensions(prev => !prev);
        appendHistory(`Wall Dimensions: ${!showWallDimensions ? 'ON' : 'OFF'}`);
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
  }, [selectedIds, deleteEntities, undo, redo, showWallDimensions, appendHistory]);

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
        showWallDimensions={showWallDimensions}
        onToggleWallDimensions={() => setShowWallDimensions(prev => !prev)}
        settings={settings}
        onUpdateSetting={updateSetting}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onConvertToBim={handleConvertToBim}
        onSaveProject={handleSaveProject}
        onExportDxf={handleExportDxf}
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
          containerRef={containerRef}
        />

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

        {/* View Mode Switcher Pill (Top Right) */}
        <div style={{
          position: 'absolute',
          top: 14,
          right: isPropertiesOpen && selectedEntity ? 310 : 18,
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
