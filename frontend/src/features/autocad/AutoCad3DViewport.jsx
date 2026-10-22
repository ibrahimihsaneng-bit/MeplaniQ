import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateBlenderPythonScript } from '../mep/blenderExportBridge';

/**
 * AutoCad3DViewport.jsx
 * High-Performance Three.js 3D WebGL Spatial BIM Engine.
 * 
 * Features:
 * 1. Full Unrestricted 360° Orbital Rotation & Preset Cameras (Iso NE/NW/SE/SW, Top Plan, Elevations).
 * 2. Interactive Wall Selection (Interior & Exterior) with Hover Highlights, Wall Inspector & Deletion.
 * 3. Realistic Standard 3D Architectural Doors (Jambs, Swinging Leaf, Brass Handle, Lintel Header)
 *    and Windows (UPVC Frame, Mullions, Transparent Translucent Glazing, Sill & Lintel).
 * 4. Complete 3D MEP Systems:
 *    - HVAC Ducts (Metallic Galvanized Iron with Flanges & Ceiling Diffusers)
 *    - AC Refrigerant Lines (Insulated Copper Twin Lines + Wall-mounted Split AC Indoor Units)
 *    - Domestic Plumbing (DCW Blue CPVC, DHW Red CPVC pipes with elbows)
 *    - Drainage & Waste Soil Stacks (Vertical 110mm PVC Risers with 1:50 Sloped Branches)
 *    - Fire Protection Sprinklers (Red Steel Piping with Brass Deflector Sprinkler Heads)
 *    - Electrical Conduits & Ceiling Downlights with Soft Point Illumination
 * 5. First-Person Walkthrough ("Game-like" FPS Mode):
 *    - 1.6m eye height, WASD / Arrow movement, Sprint (Shift), Mouse-look.
 *    - Walk through open doorways into any room, live room detection HUD.
 * 6. Standalone Blender Python script export (.py).
 */
export default function AutoCad3DViewport({
  entities = [],
  detectedRooms = [],
  solveData = null,
  onDeleteEntity,
  onClose
}) {
  const mountRef = useRef(null);

  // View & Mode State
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState(null);
  const [walkSpeed, setWalkSpeed] = useState(3.0); // m/s
  const [deletedWallIds, setDeletedWallIds] = useState(new Set());
  const [selectedWall, setSelectedWall] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Discipline Filter Toggles
  const [showArch, setShowArch] = useState(true);
  const [showDoorsWindows, setShowDoorsWindows] = useState(true);
  const [showColumns, setShowColumns] = useState(true);
  const [showHvac, setShowHvac] = useState(true);
  const [showAcPipes, setShowAcPipes] = useState(true);
  const [showPlumb, setShowPlumb] = useState(true);
  const [showFire, setShowFire] = useState(true);
  const [showElec, setShowElec] = useState(true);

  // Camera Info
  const [cameraStats, setCameraStats] = useState({ azimuth: 45, polar: 45, distance: 15 });

  // Refs for Three.js instance objects
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const wallMeshesRef = useRef([]);
  const animFrameRef = useRef(null);
  const keysDownRef = useRef({});
  const mouseLookRef = useRef({ isDragging: false, prevX: 0, prevY: 0, yaw: 0, pitch: 0 });

  // Show transient toast notification
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3500);
  }, []);

  // Calculate building center & bounds in meters
  const buildingBounds = useMemo(() => {
    let minX = 0, maxX = 12000, minY = 0, maxY = 8000;
    const xs = [];
    const ys = [];

    entities.forEach(e => {
      if (e.isSheetBorder || e.isTitleBlock) return;
      if (e.centerline) {
        xs.push(e.centerline.p1.x, e.centerline.p2.x);
        ys.push(e.centerline.p1.y, e.centerline.p2.y);
      } else if (e.p1 && e.p2) {
        xs.push(e.p1.x, e.p2.x);
        ys.push(e.p1.y, e.p2.y);
      } else if (e.x !== undefined && e.y !== undefined) {
        xs.push(e.x);
        ys.push(e.y);
      } else if (e.center) {
        xs.push(e.center.x);
        ys.push(e.center.y);
      }
    });

    if (xs.length > 0) {
      minX = Math.min(...xs);
      maxX = Math.max(...xs);
      minY = Math.min(...ys);
      maxY = Math.max(...ys);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const sizeX = Math.max(3000, maxX - minX);
    const sizeY = Math.max(3000, maxY - minY);

    return {
      cxM: cx / 1000.0,
      cyM: cy / 1000.0,
      widthM: sizeX / 1000.0,
      depthM: sizeY / 1000.0,
      minX: minX / 1000.0,
      maxX: maxX / 1000.0,
      minY: minY / 1000.0,
      maxY: maxY / 1000.0
    };
  }, [entities]);

  // Handle Wall Deletion
  const handleDeleteWall = useCallback((wallId) => {
    if (!wallId) return;
    setDeletedWallIds(prev => new Set(prev).add(wallId));
    setSelectedWall(null);
    if (onDeleteEntity) {
      onDeleteEntity(wallId);
    }
    showToast(`Wall [${wallId}] deleted from 3D model.`);
  }, [onDeleteEntity, showToast]);

  // Keyboard shortcut listener for Delete/Backspace in 3D view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWall) {
        e.preventDefault();
        handleDeleteWall(selectedWall.id);
      } else if (e.key === 'Escape') {
        if (isWalkMode) {
          setIsWalkMode(false);
        } else if (selectedWall) {
          setSelectedWall(null);
        } else if (onClose) {
          onClose();
        }
      }
      keysDownRef.current[e.code] = true;
    };

    const handleKeyUp = (e) => {
      keysDownRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedWall, isWalkMode, handleDeleteWall, onClose]);

  // Three.js Scene Setup & Geometry Construction
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    // 1. SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.012);

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    const radius = Math.max(12, Math.max(buildingBounds.widthM, buildingBounds.depthM) * 1.5);
    camera.position.set(
      buildingBounds.cxM + radius * 0.7,
      radius * 0.8,
      -buildingBounds.cyM + radius * 0.7
    );
    camera.lookAt(buildingBounds.cxM, 1.5, -buildingBounds.cyM);

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(buildingBounds.cxM, 1.2, -buildingBounds.cyM);
    // Unrestricted 360 rotation without artificial clamping
    controls.minDistance = 1.0;
    controls.maxDistance = 250.0;
    controls.minPolarAngle = 0.02;
    controls.maxPolarAngle = Math.PI - 0.02;
    controls.enableRotate = !isWalkMode;

    // 5. LIGHTING
    // Ambient soft daylight
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    // Directional Sunlight with Shadows
    const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.4);
    sunLight.position.set(
      buildingBounds.cxM + 25,
      40,
      -buildingBounds.cyM + 25
    );
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    const d = Math.max(20, Math.max(buildingBounds.widthM, buildingBounds.depthM));
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Subtle blue architectural fill light
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(
      buildingBounds.cxM - 20,
      15,
      -buildingBounds.cyM - 20
    );
    scene.add(fillLight);

    // 6. GROUND SLAB & GRID
    const groundGeo = new THREE.PlaneGeometry(
      buildingBounds.widthM + 20,
      buildingBounds.depthM + 20
    );
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(buildingBounds.cxM, -0.01, -buildingBounds.cyM);
    ground.receiveShadow = true;
    scene.add(ground);

    // Precision Architectural Grid
    const grid = new THREE.GridHelper(
      Math.max(buildingBounds.widthM, buildingBounds.depthM) + 20,
      20,
      0x38bdf8,
      0x1e293b
    );
    grid.position.set(buildingBounds.cxM, 0, -buildingBounds.cyM);
    scene.add(grid);

    // Building Floor Slab
    const slabGeo = new THREE.BoxGeometry(
      buildingBounds.widthM + 0.8,
      0.15,
      buildingBounds.depthM + 0.8
    );
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.set(buildingBounds.cxM, -0.075, -buildingBounds.cyM);
    slabMesh.receiveShadow = true;
    scene.add(slabMesh);

    // 7. BUILD 3D ARCHITECTURAL & MEP GEOMETRY
    const wallMeshes = [];
    wallMeshesRef.current = wallMeshes;

    // Materials
    const wallExteriorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.1
    });
    const wallInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      metalness: 0.05
    });
    const wallSelectedMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3
    });

    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });

    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const winGlassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.2
    });

    const ductMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 });
    const acCopperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.2 });
    const acInsulationMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const acUnitMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 });
    const pipeWaterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 });
    const pipeHotMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.3 });
    const pipeDrainMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
    const firePipeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
    const fireSprinklerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });
    const columnMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, metalness: 0.3 });
    const conduitMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

    // A. WALLS
    if (showArch) {
      const wallEntities = entities.filter(e => {
        if (deletedWallIds.has(e.id)) return false;
        return (e.type === 'wall' || e.layer === 'A-WALL') && (e.centerline || (e.p1 && e.p2));
      });

      wallEntities.forEach((w, wIdx) => {
        const p1 = w.centerline ? w.centerline.p1 : w.p1;
        const p2 = w.centerline ? w.centerline.p2 : w.p2;
        const x1 = p1.x / 1000.0;
        const y1 = p1.y / 1000.0;
        const x2 = p2.x / 1000.0;
        const y2 = p2.y / 1000.0;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.05) return;

        const th = (w.thickness || 200) / 1000.0;
        const h = 3.0; // standard 3m ceiling
        const isExterior = (w.thickness || 200) >= 180;

        const wallGeo = new THREE.BoxGeometry(len, h, th);
        const wallMesh = new THREE.Mesh(
          wallGeo,
          selectedWall?.id === (w.id || `wall-${wIdx}`) ? wallSelectedMat : (isExterior ? wallExteriorMat : wallInteriorMat)
        );

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const angle = -Math.atan2(dy, dx);

        wallMesh.position.set(midX, h / 2, -midY);
        wallMesh.rotation.y = angle;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        wallMesh.userData = {
          id: w.id || `wall-${wIdx}`,
          type: 'wall',
          isExterior,
          lengthM: len,
          thicknessMm: (w.thickness || 200),
          heightM: h,
          originalMat: isExterior ? wallExteriorMat : wallInteriorMat
        };

        scene.add(wallMesh);
        wallMeshes.push(wallMesh);
      });
    }

    // B. DOORS & WINDOWS
    if (showDoorsWindows) {
      // 1. DOORS
      const doorEntities = entities.filter(e => e.type === 'door' || e.layer === 'A-DOOR');
      doorEntities.forEach((d, dIdx) => {
        const posX = (d.x ?? d.center?.x ?? d.p1?.x ?? 0) / 1000.0;
        const posY = (d.y ?? d.center?.y ?? d.p1?.y ?? 0) / 1000.0;
        const doorW = (d.width || 900) / 1000.0;
        const doorH = 2.1; // standard 2.1m door height
        const wallH = 3.0;
        const rot = -(d.rotation || 0) * (Math.PI / 180);

        const doorGroup = new THREE.Group();
        doorGroup.position.set(posX, 0, -posY);
        doorGroup.rotation.y = rot;

        // Lintel Header above door (2.1m to 3.0m)
        const lintelGeo = new THREE.BoxGeometry(doorW, wallH - doorH, 0.2);
        const lintelMesh = new THREE.Mesh(lintelGeo, wallInteriorMat);
        lintelMesh.position.set(0, doorH + (wallH - doorH) / 2, 0);
        lintelMesh.castShadow = true;
        doorGroup.add(lintelMesh);

        // Door Jamb Outer Frame
        const frameThickness = 0.05;
        const frameDepth = 0.12;

        // Top frame
        const topFrameGeo = new THREE.BoxGeometry(doorW + frameThickness * 2, frameThickness, frameDepth);
        const topFrame = new THREE.Mesh(topFrameGeo, doorFrameMat);
        topFrame.position.set(0, doorH, 0);
        doorGroup.add(topFrame);

        // Left jamb
        const sideFrameGeo = new THREE.BoxGeometry(frameThickness, doorH, frameDepth);
        const leftJamb = new THREE.Mesh(sideFrameGeo, doorFrameMat);
        leftJamb.position.set(-doorW / 2 - frameThickness / 2, doorH / 2, 0);
        doorGroup.add(leftJamb);

        // Right jamb
        const rightJamb = new THREE.Mesh(sideFrameGeo, doorFrameMat);
        rightJamb.position.set(doorW / 2 + frameThickness / 2, doorH / 2, 0);
        doorGroup.add(rightJamb);

        // Door Leaf Panel (slightly ajar at 20 degrees swing for realism and depth)
        const leafW = doorW * 0.96;
        const leafH = doorH * 0.98;
        const leafTh = 0.04;
        const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafTh);
        const leafMesh = new THREE.Mesh(leafGeo, doorLeafMat);
        // Pivot at left edge
        leafMesh.position.set(leafW / 2, leafH / 2, 0);
        const swingPivot = new THREE.Group();
        swingPivot.position.set(-doorW / 2 + 0.02, 0, 0);
        swingPivot.rotation.y = 0.35; // ~20 deg ajar
        swingPivot.add(leafMesh);

        // Metallic Handle & Lever
        const handleLeverGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12);
        const handleLever = new THREE.Mesh(handleLeverGeo, doorHandleMat);
        handleLever.rotation.z = Math.PI / 2;
        handleLever.position.set(leafW - 0.08, 1.0, 0.04);
        swingPivot.add(handleLever);

        doorGroup.add(swingPivot);
        scene.add(doorGroup);
      });

      // 2. WINDOWS
      const windowEntities = entities.filter(e => e.type === 'window' || e.layer === 'A-GLAZ');
      windowEntities.forEach((win, wIdx) => {
        const posX = (win.x ?? win.center?.x ?? win.p1?.x ?? 0) / 1000.0;
        const posY = (win.y ?? win.center?.y ?? win.p1?.y ?? 0) / 1000.0;
        const winW = (win.width || 1200) / 1000.0;
        const sillH = 0.9;
        const winH = 1.2;
        const lintelH = 3.0 - (sillH + winH);
        const rot = -(win.rotation || 0) * (Math.PI / 180);

        const winGroup = new THREE.Group();
        winGroup.position.set(posX, 0, -posY);
        winGroup.rotation.y = rot;

        // Sill wall (0 to 0.9m)
        const sillGeo = new THREE.BoxGeometry(winW, sillH, 0.2);
        const sillMesh = new THREE.Mesh(sillGeo, wallExteriorMat);
        sillMesh.position.set(0, sillH / 2, 0);
        winGroup.add(sillMesh);

        // Lintel wall (2.1m to 3.0m)
        const lintelGeo = new THREE.BoxGeometry(winW, lintelH, 0.2);
        const lintelMesh = new THREE.Mesh(lintelGeo, wallExteriorMat);
        lintelMesh.position.set(0, sillH + winH + lintelH / 2, 0);
        winGroup.add(lintelMesh);

        // Window Frame
        const frameTh = 0.04;
        const frameOuterGeo = new THREE.BoxGeometry(winW, winH, 0.08);
        const frameOuter = new THREE.Mesh(frameOuterGeo, winFrameMat);
        frameOuter.position.set(0, sillH + winH / 2, 0);
        winGroup.add(frameOuter);

        // Glass Glazing Pane
        const glassGeo = new THREE.BoxGeometry(winW - 0.08, winH - 0.08, 0.015);
        const glassMesh = new THREE.Mesh(glassGeo, winGlassMat);
        glassMesh.position.set(0, sillH + winH / 2, 0);
        winGroup.add(glassMesh);

        // Vertical Mullion Bar
        const mullionGeo = new THREE.BoxGeometry(0.03, winH - 0.08, 0.04);
        const mullionMesh = new THREE.Mesh(mullionGeo, winFrameMat);
        mullionMesh.position.set(0, sillH + winH / 2, 0);
        winGroup.add(mullionMesh);

        scene.add(winGroup);
      });
    }

    // C. STRUCTURAL COLUMNS
    if (showColumns) {
      const colEntities = entities.filter(e => e.type === 'column' || e.type === 'structural-column' || e.layer === 'S-COLS');
      colEntities.forEach(col => {
        const cx = (col.center?.x ?? col.x ?? 0) / 1000.0;
        const cy = (col.center?.y ?? col.y ?? 0) / 1000.0;
        const w = (col.width || 300) / 1000.0;
        const d = (col.height || col.width || 300) / 1000.0;
        const h = 3.0;

        const colGeo = new THREE.BoxGeometry(w, h, d);
        const colMesh = new THREE.Mesh(colGeo, columnMat);
        colMesh.position.set(cx, h / 2, -cy);
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        scene.add(colMesh);
      });
    }

    // D. HVAC DUCTWORK & DIFFUSERS
    if (showHvac) {
      const ducts = entities.filter(e => e.type === 'mep-duct' || e.layer === 'M-HVAC');
      ducts.forEach(d => {
        if (!d.p1 || !d.p2) return;
        const x1 = d.p1.x / 1000.0;
        const y1 = d.p1.y / 1000.0;
        const x2 = d.p2.x / 1000.0;
        const y2 = d.p2.y / 1000.0;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.05) return;

        const dw = (d.width || 350) / 1000.0;
        const dh = (d.height || 250) / 1000.0;
        const ductElevation = 2.55; // 2.55m overhead elevation

        const ductGeo = new THREE.BoxGeometry(len, dh, dw);
        const ductMesh = new THREE.Mesh(ductGeo, ductMat);

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const angle = -Math.atan2(dy, dx);

        ductMesh.position.set(midX, ductElevation, -midY);
        ductMesh.rotation.y = angle;
        ductMesh.castShadow = true;
        scene.add(ductMesh);

        // Ceiling Diffuser drops at terminal ends
        const diffGeo = new THREE.BoxGeometry(0.5, 0.04, 0.5);
        const diffMesh = new THREE.Mesh(diffGeo, ductMat);
        diffMesh.position.set(x2, 2.7, -y2);
        scene.add(diffMesh);
      });
    }

    // E. AC REFRIGERANT COPPER LINES & SPLIT UNITS
    if (showAcPipes) {
      // 1. Indoor Split Units placed along room walls
      detectedRooms.forEach((rm, rIdx) => {
        const pts = rm.points || [];
        if (pts.length < 3) return;
        const rx = pts[0][0] / 1000.0;
        const ry = pts[0][1] / 1000.0;

        // AC Wall Unit Body (0.9m x 0.3m x 0.22m)
        const acUnitGeo = new THREE.BoxGeometry(0.9, 0.3, 0.22);
        const acMesh = new THREE.Mesh(acUnitGeo, acUnitMat);
        acMesh.position.set(rx + 0.5, 2.4, -ry);
        acMesh.castShadow = true;
        scene.add(acMesh);

        // Front Air Louver
        const louverGeo = new THREE.BoxGeometry(0.8, 0.03, 0.04);
        const louverMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const louver = new THREE.Mesh(louverGeo, louverMat);
        louver.position.set(rx + 0.5, 2.3, -ry + 0.1);
        scene.add(louver);

        // Twin Copper Refrigerant Lines running from AC unit to exterior
        const pStart = new THREE.Vector3(rx + 0.8, 2.5, -ry);
        const pMid = new THREE.Vector3(rx + 0.8, 2.65, -ry - 0.8);
        const pEnd = new THREE.Vector3(buildingBounds.maxX, 2.65, -ry - 0.8);

        const copperCurve = new THREE.CatmullRomCurve3([pStart, pMid, pEnd]);
        // Suction line (insulated black Armaflex)
        const suctionGeo = new THREE.TubeGeometry(copperCurve, 20, 0.022, 8, false);
        const suctionMesh = new THREE.Mesh(suctionGeo, acInsulationMat);
        scene.add(suctionMesh);

        // Liquid line (bare copper)
        const pStart2 = pStart.clone().add(new THREE.Vector3(0.04, 0, 0));
        const pMid2 = pMid.clone().add(new THREE.Vector3(0.04, 0, 0));
        const pEnd2 = pEnd.clone().add(new THREE.Vector3(0.04, 0, 0));
        const liquidCurve = new THREE.CatmullRomCurve3([pStart2, pMid2, pEnd2]);
        const liquidGeo = new THREE.TubeGeometry(liquidCurve, 20, 0.012, 8, false);
        const liquidMesh = new THREE.Mesh(liquidGeo, acCopperMat);
        scene.add(liquidMesh);
      });
    }

    // F. DOMESTIC PLUMBING PIPES & DRAINAGE STACKS
    if (showPlumb) {
      const pipes = entities.filter(e => e.type === 'mep-pipe' || e.layer === 'P-PLUM' || e.layer === 'P-SANR');
      pipes.forEach(p => {
        if (!p.p1 || !p.p2) return;
        const x1 = p.p1.x / 1000.0;
        const y1 = p.p1.y / 1000.0;
        const x2 = p.p2.x / 1000.0;
        const y2 = p.p2.y / 1000.0;

        const isDrain = (p.layer === 'P-SANR' || p.system === 'DRAINAGE' || (p.diameter || 25) >= 75);
        const isHot = (p.system === 'HOT_WATER' || p.layer === 'P-HOT');
        const diam = (p.diameter || (isDrain ? 110 : 25)) / 1000.0;
        const elev = isDrain ? 0.25 : 0.45; // Under-floor or low wall skirting

        const curve = new THREE.LineCurve3(
          new THREE.Vector3(x1, elev, -y1),
          new THREE.Vector3(x2, elev - (isDrain ? 0.03 : 0), -y2)
        );
        const pipeGeo = new THREE.TubeGeometry(curve, 12, diam / 2, 8, false);
        const mat = isDrain ? pipeDrainMat : (isHot ? pipeHotMat : pipeWaterMat);
        const pipeMesh = new THREE.Mesh(pipeGeo, mat);
        scene.add(pipeMesh);
      });

      // Vertical Soil & Waste Stacks (110mm PVC Risers from floor to roof)
      const stackX = buildingBounds.minX + 1.2;
      const stackY = buildingBounds.minY + 1.2;
      const stackGeo = new THREE.CylinderGeometry(0.055, 0.055, 3.2, 16);
      const stackMesh = new THREE.Mesh(stackGeo, pipeDrainMat);
      stackMesh.position.set(stackX, 1.6, -stackY);
      scene.add(stackMesh);
    }

    // G. FIRE SPRINKLER PIPING & PENDANT HEADS (NFPA 13)
    if (showFire) {
      const fireElevation = 2.85; // 2.85m overhead fire protection grid
      const fireMainX = buildingBounds.cxM;
      const fireCurve = new THREE.LineCurve3(
        new THREE.Vector3(buildingBounds.minX + 0.5, fireElevation, -fireMainX),
        new THREE.Vector3(buildingBounds.maxX - 0.5, fireElevation, -fireMainX)
      );
      const fireGeo = new THREE.TubeGeometry(fireCurve, 16, 0.032, 8, false);
      const fireMesh = new THREE.Mesh(fireGeo, firePipeMat);
      scene.add(fireMesh);

      // Sprinkler Pendant Heads
      const numSprinklers = Math.max(3, Math.round(buildingBounds.widthM / 3.5));
      for (let i = 0; i < numSprinklers; i++) {
        const sx = buildingBounds.minX + 1.5 + i * 3.2;
        if (sx > buildingBounds.maxX - 1.0) break;

        // Vertical drop nipple
        const nippleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8);
        const nipple = new THREE.Mesh(nippleGeo, firePipeMat);
        nipple.position.set(sx, fireElevation - 0.075, -fireMainX);
        scene.add(nipple);

        // Brass Deflector Plate
        const deflectorGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.008, 12);
        const deflector = new THREE.Mesh(deflectorGeo, fireSprinklerMat);
        deflector.position.set(sx, fireElevation - 0.15, -fireMainX);
        scene.add(deflector);
      }
    }

    // H. ELECTRICAL CONDUITS & DOWNLIGHTS
    if (showElec) {
      const lights = entities.filter(e => e.type === 'elec-fixture' || e.type === 'block' || e.layer === 'E-ELEC');
      lights.forEach((l, lIdx) => {
        const lx = (l.center?.x ?? l.x ?? 0) / 1000.0;
        const ly = (l.center?.y ?? l.y ?? 0) / 1000.0;

        // Downlight Fixture Body at ceiling (2.95m)
        const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 0.9
        });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(lx, 2.95, -ly);
        scene.add(lightMesh);

        // Soft Point Illumination
        if (lIdx < 6) {
          const pointLight = new THREE.PointLight(0xfffbeb, 8, 4.5);
          pointLight.position.set(lx, 2.8, -ly);
          scene.add(pointLight);
        }

        // Ceiling Conduit Link
        const conduitCurve = new THREE.LineCurve3(
          new THREE.Vector3(lx, 2.96, -ly),
          new THREE.Vector3(buildingBounds.cxM, 2.96, -buildingBounds.cyM)
        );
        const conduitGeo = new THREE.TubeGeometry(conduitCurve, 8, 0.01, 6, false);
        const conduitMesh = new THREE.Mesh(conduitGeo, conduitMat);
        scene.add(conduitMesh);
      });
    }

    // 8. RAYCASTER FOR INTERACTIVE WALL SELECTION & HOVER
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh = null;

    const handlePointerMove = (e) => {
      if (isWalkMode && mouseLookRef.current.isDragging) {
        // First Person Mouse Look
        const dx = e.clientX - mouseLookRef.current.prevX;
        const dy = e.clientY - mouseLookRef.current.prevY;
        mouseLookRef.current.prevX = e.clientX;
        mouseLookRef.current.prevY = e.clientY;

        mouseLookRef.current.yaw -= dx * 0.003;
        mouseLookRef.current.pitch = Math.max(-1.4, Math.min(1.4, mouseLookRef.current.pitch - dy * 0.003));

        camera.rotation.set(0, 0, 0);
        camera.rotation.y = mouseLookRef.current.yaw;
        camera.rotation.x = mouseLookRef.current.pitch;
        return;
      }

      // Orbit Mode Raycast
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(wallMeshesRef.current);

      if (intersects.length > 0) {
        const topMesh = intersects[0].object;
        if (hoveredMesh !== topMesh && topMesh.userData?.id !== selectedWall?.id) {
          if (hoveredMesh && hoveredMesh.userData?.id !== selectedWall?.id) {
            hoveredMesh.material = hoveredMesh.userData.originalMat;
          }
          hoveredMesh = topMesh;
          hoveredMesh.material = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.35,
            roughness: 0.4
          });
          container.style.cursor = 'pointer';
        }
      } else {
        if (hoveredMesh && hoveredMesh.userData?.id !== selectedWall?.id) {
          hoveredMesh.material = hoveredMesh.userData.originalMat;
        }
        hoveredMesh = null;
        container.style.cursor = isWalkMode ? 'crosshair' : 'grab';
      }
    };

    const handleClick = (e) => {
      if (isWalkMode) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(wallMeshesRef.current);

      if (intersects.length > 0) {
        const topMesh = intersects[0].object;
        const uData = topMesh.userData;
        setSelectedWall(uData);
      } else {
        setSelectedWall(null);
      }
    };

    const handleMouseDown = (e) => {
      if (isWalkMode) {
        mouseLookRef.current.isDragging = true;
        mouseLookRef.current.prevX = e.clientX;
        mouseLookRef.current.prevY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      if (isWalkMode) {
        mouseLookRef.current.isDragging = false;
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // 9. ANIMATION & GAME-LIKE WALKTHROUGH LOOP
    let lastTime = performance.now();

    const animate = (currentTime) => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = Math.min(0.1, (currentTime - lastTime) / 1000.0);
      lastTime = currentTime;

      if (isWalkMode) {
        // FPS Movement Loop
        const keys = keysDownRef.current;
        const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? walkSpeed * 2.0 : walkSpeed) * delta;

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseLookRef.current.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseLookRef.current.yaw);

        if (keys['KeyW'] || keys['ArrowUp']) camera.position.addScaledVector(forward, speed);
        if (keys['KeyS'] || keys['ArrowDown']) camera.position.addScaledVector(forward, -speed);
        if (keys['KeyD'] || keys['ArrowRight']) camera.position.addScaledVector(right, speed);
        if (keys['KeyA'] || keys['ArrowLeft']) camera.position.addScaledVector(right, -speed);

        // Keep standard eye height at 1.6m
        camera.position.y = 1.6;

        // Live Room Detection
        const curX = camera.position.x * 1000.0;
        const curY = -camera.position.z * 1000.0;
        let detected = null;
        for (const rm of detectedRooms) {
          const pts = rm.points || [];
          if (pts.length >= 3) {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i][0], yi = pts[i][1];
              const xj = pts[j][0], yj = pts[j][1];
              const intersect = ((yi > curY) !== (yj > curY)) &&
                (curX < (xj - xi) * (curY - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            if (inside) {
              detected = rm.name || rm.label || 'Occupied Space';
              break;
            }
          }
        }
        setCurrentRoomName(detected);
      } else {
        // Orbit Controls & Stats Update
        if (autoRotate) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 2.0;
        } else {
          controls.autoRotate = false;
        }
        controls.update();

        const spherical = new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target)
        );
        setCameraStats({
          azimuth: Math.round(THREE.MathUtils.radToDeg(spherical.theta) + 360) % 360,
          polar: Math.round(THREE.MathUtils.radToDeg(spherical.phi)),
          distance: Math.round(spherical.radius)
        });
      }

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // 10. RESIZE HANDLER
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [
    entities,
    detectedRooms,
    deletedWallIds,
    selectedWall,
    buildingBounds,
    isWalkMode,
    autoRotate,
    walkSpeed,
    showArch,
    showDoorsWindows,
    showColumns,
    showHvac,
    showAcPipes,
    showPlumb,
    showFire,
    showElec
  ]);

  // Enter / Exit First-Person Walkthrough Mode
  const toggleWalkMode = () => {
    if (!isWalkMode) {
      // Enter FPS mode: place camera inside first room or center
      const startX = buildingBounds.cxM;
      const startZ = -buildingBounds.cyM;
      if (cameraRef.current) {
        cameraRef.current.position.set(startX, 1.6, startZ);
        mouseLookRef.current.yaw = 0;
        mouseLookRef.current.pitch = 0;
        cameraRef.current.rotation.set(0, 0, 0);
      }
      setIsWalkMode(true);
      showToast("Walk Mode Active: Use WASD / Arrows to walk, Drag mouse to look around.");
    } else {
      setIsWalkMode(false);
      setCurrentRoomName(null);
      // Reset camera to orbital view
      if (cameraRef.current && controlsRef.current) {
        const radius = Math.max(14, buildingBounds.widthM * 1.5);
        cameraRef.current.position.set(
          buildingBounds.cxM + radius * 0.7,
          radius * 0.8,
          -buildingBounds.cyM + radius * 0.7
        );
        controlsRef.current.target.set(buildingBounds.cxM, 1.2, -buildingBounds.cyM);
        controlsRef.current.update();
      }
      showToast("Returned to 360° Orbital BIM View.");
    }
  };

  // Camera Presets
  const setCameraPreset = (type) => {
    if (isWalkMode) setIsWalkMode(false);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const r = Math.max(14, buildingBounds.widthM * 1.4);
    const cx = buildingBounds.cxM;
    const cz = -buildingBounds.cyM;
    controls.target.set(cx, 1.2, cz);

    switch (type) {
      case 'iso-ne':
        camera.position.set(cx + r * 0.7, r * 0.7, cz + r * 0.7);
        break;
      case 'iso-nw':
        camera.position.set(cx - r * 0.7, r * 0.7, cz + r * 0.7);
        break;
      case 'iso-se':
        camera.position.set(cx + r * 0.7, r * 0.7, cz - r * 0.7);
        break;
      case 'iso-sw':
        camera.position.set(cx - r * 0.7, r * 0.7, cz - r * 0.7);
        break;
      case 'top':
        camera.position.set(cx, r * 1.8, cz + 0.01);
        break;
      case 'front':
        camera.position.set(cx, 1.6, cz + r * 1.2);
        break;
      case 'side':
        camera.position.set(cx + r * 1.2, 1.6, cz);
        break;
      case 'reset':
      default:
        camera.position.set(cx + r * 0.7, r * 0.8, cz + r * 0.7);
        break;
    }
    controls.update();
  };

  // Export Blender Python Script
  const handleExportBlender = () => {
    const pyScript = generateBlenderPythonScript(entities, solveData, solveData?.project_name || "MeplanIQ 3D Model");
    const blob = new Blob([pyScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(solveData?.project_name || 'meplaniq_bim').replace(/\s+/g, '_')}_blender.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded Blender scene import script (.py).");
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0A0F1D',
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: 40
      }}
    >
      {/* Three.js WebGL Mount Canvas */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />

      {/* Floating Header / Discipline Toolbar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
        color: '#F8FAFC',
        fontSize: '12px',
        maxWidth: '480px',
        zIndex: 50
      }}>
        {/* Title & Exit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🧊</span>
            <div>
              <span style={{ fontWeight: 800, color: '#38BDF8', fontSize: '13px' }}>
                MEPlanIQ 3D Spatial BIM Engine
              </span>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                Three.js WebGL • 360° Free Orbit • First-Person Walk
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Return to 2D Plan View"
            style={{
              background: '#DC2626',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '11px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)'
            }}
          >
            ✕ Exit 3D
          </button>
        </div>

        {/* Camera Info & Walk Mode Trigger */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94A3B8' }}>
          <div>
            Azimuth: <strong style={{ color: '#E2E8F0' }}>{cameraStats.azimuth}°</strong> • Tilt: <strong style={{ color: '#E2E8F0' }}>{cameraStats.polar}°</strong>
          </div>
          <button
            type="button"
            onClick={toggleWalkMode}
            style={{
              background: isWalkMode ? '#10B981' : '#0284C7',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '4px 10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{isWalkMode ? '🛰️ Return to Orbit' : '🚶 Walk Inside (FPS)'}</span>
          </button>
        </div>

        {/* View Presets & Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setCameraPreset('iso-ne')}
            style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            Iso NE
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('iso-nw')}
            style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            Iso NW
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('top')}
            style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            Top Plan
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('front')}
            style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            Elevation
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate(p => !p)}
            style={{
              background: autoRotate ? '#0284C7' : '#1E293B',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              padding: '4px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700
            }}
          >
            {autoRotate ? '⏸️ Stop 360' : '🔄 360° Spin'}
          </button>
        </div>

        {/* Discipline Layer Toggles */}
        <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          <button
            type="button"
            onClick={() => setShowArch(p => !p)}
            style={{ background: showArch ? '#0369A1' : '#1E293B', border: '1px solid #38BDF8', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            🧱 Walls
          </button>
          <button
            type="button"
            onClick={() => setShowDoorsWindows(p => !p)}
            style={{ background: showDoorsWindows ? '#047857' : '#1E293B', border: '1px solid #34D399', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            🚪 Doors/Windows
          </button>
          <button
            type="button"
            onClick={() => setShowColumns(p => !p)}
            style={{ background: showColumns ? '#1D4ED8' : '#1E293B', border: '1px solid #60A5FA', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            🏛️ Columns
          </button>
          <button
            type="button"
            onClick={() => setShowHvac(p => !p)}
            style={{ background: showHvac ? '#C2410C' : '#1E293B', border: '1px solid #FB923C', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            💨 HVAC Ducts
          </button>
          <button
            type="button"
            onClick={() => setShowAcPipes(p => !p)}
            style={{ background: showAcPipes ? '#B45309' : '#1E293B', border: '1px solid #F59E0B', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            ❄️ AC Copper Lines
          </button>
          <button
            type="button"
            onClick={() => setShowPlumb(p => !p)}
            style={{ background: showPlumb ? '#0284C7' : '#1E293B', border: '1px solid #38BDF8', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            🚰 Plumbing/Drain
          </button>
          <button
            type="button"
            onClick={() => setShowFire(p => !p)}
            style={{ background: showFire ? '#B91C1C' : '#1E293B', border: '1px solid #F87171', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            🚒 Fire Sprinklers
          </button>
          <button
            type="button"
            onClick={() => setShowElec(p => !p)}
            style={{ background: showElec ? '#9333EA' : '#1E293B', border: '1px solid #C084FC', color: '#FFFFFF', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            ⚡ Lighting
          </button>
          <button
            type="button"
            onClick={handleExportBlender}
            style={{
              background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
              border: '1px solid #FB923C',
              color: '#FFFFFF',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700
            }}
          >
            📦 Blender (.py)
          </button>
        </div>
      </div>

      {/* Interactive Wall Inspector & Deletion Card */}
      {selectedWall && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid #0284C7',
          borderRadius: '12px',
          padding: '12px 18px',
          boxShadow: '0 12px 32px rgba(2, 132, 199, 0.35)',
          color: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 60,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div>
            <div style={{ fontWeight: 800, color: '#38BDF8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧱</span>
              <span>{selectedWall.isExterior ? 'Exterior Building Envelope Wall' : 'Interior Partition Wall'}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              Length: <strong style={{ color: '#E2E8F0' }}>{selectedWall.lengthM.toFixed(2)} m</strong> • Thickness: <strong style={{ color: '#E2E8F0' }}>{selectedWall.thicknessMm} mm</strong> • Height: <strong style={{ color: '#E2E8F0' }}>3.00 m</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDeleteWall(selectedWall.id)}
            style={{
              background: '#DC2626',
              border: '1px solid #EF4444',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '6px 12px',
              fontWeight: 800,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
            }}
          >
            <span>🗑️ Delete Wall (Del)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedWall(null)}
            style={{
              background: '#334155',
              border: 'none',
              color: '#94A3B8',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* First-Person Walkthrough HUD Overlay */}
      {isWalkMode && (
        <>
          {/* Central Target Crosshair */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            border: '2px solid rgba(56, 189, 248, 0.65)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 45
          }}>
            <div style={{
              width: '2px',
              height: '2px',
              background: '#38BDF8',
              borderRadius: '50%',
              margin: '3px auto'
            }} />
          </div>

          {/* Bottom Movement HUD */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #10B981',
            borderRadius: '24px',
            padding: '8px 20px',
            color: '#F8FAFC',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
            zIndex: 55
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#34D399' }}>
              <span>🚶</span>
              <span>First-Person Walkthrough</span>
            </span>
            {currentRoomName && (
              <span style={{ background: '#064E3B', color: '#A7F3D0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                📍 Inside: {currentRoomName}
              </span>
            )}
            <span style={{ color: '#94A3B8', fontSize: '11px' }}>
              <strong>WASD</strong> Walk • <strong>Shift</strong> Sprint • <strong>Drag</strong> Look Around
            </span>
            <button
              type="button"
              onClick={toggleWalkMode}
              style={{
                background: '#047857',
                border: '1px solid #34D399',
                color: '#FFFFFF',
                borderRadius: '12px',
                padding: '3px 10px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              Exit (ESC)
            </button>
          </div>
        </>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #38BDF8',
          borderRadius: '8px',
          padding: '10px 16px',
          color: '#F8FAFC',
          fontSize: '12px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 70
        }}>
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
