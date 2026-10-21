import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  dist,
  angleDeg,
  pointFromPolar,
  projectPointOntoSegment,
  calculateMiteredWallNetwork,
  createDoorOnWall,
  createWindowOnWall,
  filletLineSegments,
  rotateEntityGeometry,
  mirrorEntityGeometry,
  getEntityCenter,
  offsetSegment,
  extractRoomsFromLinework,
  trimEntitySegment,
  extendEntitySegment
} from './cadGeometryUtils';
import {
  findSnapTarget,
  findTrackingGuides,
  applyOrthoConstraint,
  applyPolarConstraint,
  snapToGrid,
  SNAP_TYPES
} from './cadSnapping';
import { renderCadBlock } from './renderCadBlock';

export default function AutoCadCanvas({
  entities = [],
  layers = [],
  activeLayerId,
  activeTool = 'wall',
  onSelectTool,
  settings,
  selectedIds = [],
  onSelectEntity,
  onSelectEntitiesInRect,
  onAddEntity,
  onUpdateEntity,
  onDeleteEntities,
  onCursorMove,
  onPromptUpdate,
  activeBlockToPlace = null,
  onClearActiveBlock,
  showWallDimensions = true,
  containerRef
}) {
  const svgRef = useRef(null);
  const worldGroupRef = useRef(null);
  const hasAutoZoomed = useRef(false);

  // Viewport transformation: pan and zoom
  const [viewTransform, setViewTransform] = useState({ x: 250, y: 350 });
  const [zoom, setZoom] = useState(0.08); // 1 screen px = 12.5 mm

  // Cursor state in screen and world mm coordinates
  const [screenCursor, setScreenCursor] = useState({ x: 0, y: 0 });
  const [worldCursor, setWorldCursor] = useState({ x: 0, y: 0 });

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Object snapping state
  const [activeSnap, setActiveSnap] = useState(null);
  const [trackingGuides, setTrackingGuides] = useState({ trackX: null, trackY: null });

  // Selection box state (drag on empty space)
  const [selectionBox, setSelectionBox] = useState(null);

  // Active drafting operation state
  const [draftState, setDraftState] = useState(null);

  // Active interactive DRAG/MOVE state for existing entities
  const [dragState, setDragState] = useState(null);

  // Fillet state: first selected segment
  const [filletFirstEntity, setFilletFirstEntity] = useState(null);

  // Transform entities into mitered walls for seamless corner rendering
  const walls = useMemo(() => entities.filter(e => e.type === 'wall'), [entities]);
  const otherEntities = useMemo(() => entities.filter(e => e.type !== 'wall'), [entities]);
  const miteredWalls = useMemo(() => calculateMiteredWallNetwork(walls, 70), [walls]);

  // Live real-time closed-room boundary detection and area calculation
  const detectedRooms = useMemo(() => {
    if (walls.length < 3) return [];
    try {
      const res = extractRoomsFromLinework(entities, 80);
      return res.rooms || [];
    } catch {
      return [];
    }
  }, [entities, walls]);

  // NATIVE SVG MATRIX COORDINATE PROJECTION (100.0% Sub-pixel precision)
  const getEventWorldCoords = useCallback((e) => {
    if (!svgRef.current || !worldGroupRef.current) {
      return { x: 0, y: 0, screenX: e.clientX, screenY: e.clientY };
    }
    const rect = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    try {
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = worldGroupRef.current.getScreenCTM();
      if (ctm) {
        const worldPt = pt.matrixTransform(ctm.inverse());
        return {
          x: Math.round(worldPt.x),
          y: Math.round(worldPt.y),
          screenX: sx,
          screenY: sy
        };
      }
    } catch (err) {
      // Fallback
    }

    const wx = (sx - viewTransform.x) / zoom;
    const wy = (rect.height - viewTransform.y - sy) / zoom;
    return {
      x: Math.round(wx),
      y: Math.round(wy),
      screenX: sx,
      screenY: sy
    };
  }, [viewTransform, zoom]);

  // Zoom Extents handler
  useEffect(() => {
    window.__autocadZoomExtents = () => {
      if (entities.length === 0) {
        setViewTransform({ x: 250, y: 350 });
        setZoom(0.08);
        return;
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      entities.forEach(ent => {
        const pts = [];
        if (ent.type === 'line') pts.push(ent.p1, ent.p2);
        if (ent.type === 'wall' && ent.centerline) pts.push(ent.centerline.p1, ent.centerline.p2);
        if (ent.type === 'rect') pts.push(ent.p1, ent.p2);
        if (ent.type === 'circle' && ent.center) {
          pts.push({ x: ent.center.x - ent.radius, y: ent.center.y - ent.radius });
          pts.push({ x: ent.center.x + ent.radius, y: ent.center.y + ent.radius });
        }
        if (ent.type === 'door' && ent.centerPt) pts.push(ent.centerPt);
        if (ent.type === 'window' && ent.centerPt) pts.push(ent.centerPt);
        pts.forEach(p => {
          if (p) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
        });
      });

      if (svgRef.current && minX !== Infinity) {
        const rect = svgRef.current.getBoundingClientRect();
        const bboxW = Math.max(2500, maxX - minX + 2500);
        const bboxH = Math.max(2500, maxY - minY + 2500);
        const newZoom = Math.min(rect.width / bboxW, rect.height / bboxH) * 0.85;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        setViewTransform({
          x: rect.width / 2 - centerX * newZoom,
          y: rect.height / 2 - centerY * newZoom
        });
        setZoom(Math.max(0.01, Math.min(2.0, newZoom)));
      }
    };
    return () => { delete window.__autocadZoomExtents; };
  }, [entities]);

  // AUTO-ZOOM TO FIT ON INITIAL LOAD (Solves the tiny starter room issue in Image 1)
  useEffect(() => {
    if (!hasAutoZoomed.current && entities.length > 0 && svgRef.current) {
      hasAutoZoomed.current = true;
      setTimeout(() => {
        if (window.__autocadZoomExtents) window.__autocadZoomExtents();
      }, 150);
    }
  }, [entities]);

  // Update prompt whenever tool or draft state changes
  useEffect(() => {
    if (!onPromptUpdate) return;
    if (activeBlockToPlace) {
      onPromptUpdate(`INSERT ${activeBlockToPlace.name}: Click on canvas to place block:`);
      return;
    }
    if (dragState) {
      if (dragState.type === 'stretch') onPromptUpdate("STRETCH: Drag vertex to resize wall, release to commit:");
      else onPromptUpdate("MOVE: Dragging object with magnetic snap, release to place:");
      return;
    }
    if (!draftState) {
      if (activeTool === 'wall') onPromptUpdate("WALL: Specify start point (Click existing wall to move/stretch):");
      else if (activeTool === 'door') onPromptUpdate("DOOR: Click on any wall to insert swing door:");
      else if (activeTool === 'window') onPromptUpdate("WINDOW: Click on any wall to insert window:");
      else if (activeTool === 'text') onPromptUpdate("TEXT: Click point to insert room text label:");
      else if (activeTool === 'fillet') onPromptUpdate("FILLET: Select first line or wall to miter corner:");
      else if (activeTool === 'move') onPromptUpdate("MOVE: Select object and drag to move:");
      else if (activeTool === 'line') onPromptUpdate("LINE: Specify first point:");
      else if (activeTool === 'polyline') onPromptUpdate("PLINE: Specify start point:");
      else if (activeTool === 'rect') onPromptUpdate("RECTANGLE: Specify first corner:");
      else if (activeTool === 'circle') onPromptUpdate("CIRCLE: Specify center point:");
      else if (activeTool === 'arc') onPromptUpdate("ARC: Specify start point:");
      else if (activeTool === 'dimension') onPromptUpdate("DIM: Specify first extension point:");
      else if (activeTool === 'offset') onPromptUpdate("OFFSET: Select entity to offset:");
      else if (activeTool === 'trim') onPromptUpdate("TRIM: Click crossing segment to trim:");
      else if (activeTool === 'erase') onPromptUpdate("ERASE: Select entities to delete:");
      else onPromptUpdate("Command: (Select object to see grip handles, drag to move)");
    } else {
      if (activeTool === 'wall') onPromptUpdate("WALL: Specify next point or [Close/Undo]:");
      else if (activeTool === 'line') onPromptUpdate("LINE: Specify next point or [Close/Undo]:");
      else if (activeTool === 'rect') onPromptUpdate("RECTANGLE: Specify opposite corner:");
      else if (activeTool === 'circle') onPromptUpdate("CIRCLE: Specify radius or second point:");
      else if (activeTool === 'dimension') onPromptUpdate("DIM: Specify second extension point:");
      else if (activeTool === 'fillet') onPromptUpdate("FILLET: Select second line to miter intersection:");
    }
  }, [activeTool, draftState, dragState, activeBlockToPlace, onPromptUpdate]);

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = Math.min(Math.max(0.005, zoom * factor), 5.0);

    setViewTransform(prev => ({
      x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / zoom)
    }));
    setZoom(newZoom);
  };

  // Hit-testing helper for entity bodies and grip handles
  const hitTestEntity = useCallback((pt, candidateEntities, toleranceMm = 250) => {
    for (let i = candidateEntities.length - 1; i >= 0; i--) {
      const ent = candidateEntities[i];
      if (ent.visible === false) continue;

      if (ent.type === 'wall' && ent.centerline) {
        // Check endpoint grips
        if (dist(pt, ent.centerline.p1) <= toleranceMm) return { entity: ent, grip: 'p1' };
        if (dist(pt, ent.centerline.p2) <= toleranceMm) return { entity: ent, grip: 'p2' };
        // Check wall body
        const proj = projectPointOntoSegment(pt, ent.centerline.p1, ent.centerline.p2);
        const halfThick = (ent.thickness || 150) / 2;
        if (proj.distance <= halfThick + toleranceMm * 0.7 && proj.t >= 0 && proj.t <= 1) {
          return { entity: ent, grip: 'body' };
        }
      } else if (ent.type === 'line' && ent.p1 && ent.p2) {
        if (dist(pt, ent.p1) <= toleranceMm) return { entity: ent, grip: 'p1' };
        if (dist(pt, ent.p2) <= toleranceMm) return { entity: ent, grip: 'p2' };
        const proj = projectPointOntoSegment(pt, ent.p1, ent.p2);
        if (proj.distance <= toleranceMm && proj.t >= 0 && proj.t <= 1) {
          return { entity: ent, grip: 'body' };
        }
      } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
        const minX = Math.min(ent.p1.x, ent.p2.x);
        const maxX = Math.max(ent.p1.x, ent.p2.x);
        const minY = Math.min(ent.p1.y, ent.p2.y);
        const maxY = Math.max(ent.p1.y, ent.p2.y);
        if (pt.x >= minX - toleranceMm && pt.x <= maxX + toleranceMm && pt.y >= minY - toleranceMm && pt.y <= maxY + toleranceMm) {
          return { entity: ent, grip: 'body' };
        }
      } else if (ent.type === 'block') {
        const bw = ent.width || 1000;
        const bh = ent.height || 1000;
        if (Math.abs(pt.x - ent.x) <= bw / 2 + toleranceMm && Math.abs(pt.y - ent.y) <= bh / 2 + toleranceMm) {
          return { entity: ent, grip: 'body' };
        }
      }
    }
    return null;
  }, []);

  // Mouse Move
  const handleMouseMove = (e) => {
    const coords = getEventWorldCoords(e);
    setScreenCursor({ x: coords.screenX, y: coords.screenY });

    if (isPanning) {
      setViewTransform(prev => ({
        x: prev.x + (e.clientX - panStart.x),
        y: prev.y + (e.clientY - panStart.y)
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (selectionBox) {
      setSelectionBox(prev => ({ ...prev, p2: { x: coords.x, y: coords.y } }));
      return;
    }

    let target = { x: coords.x, y: coords.y };
    let foundSnap = null;

    if (settings.osnap) {
      const anchor = draftState?.p1 || null;
      foundSnap = findSnapTarget(target, entities, anchor, {
        zoom,
        snapRadiusScreen: 26,
        modes: settings.osnapModes
      });
      if (foundSnap) {
        target = { ...foundSnap.point };
      }
    }

    // AutoTrack Object Snap Alignment Tracking Guides
    let guides = { trackX: null, trackY: null };
    if (settings.osnap && !foundSnap && (draftState?.p1 || activeTool === 'wall' || activeTool === 'line')) {
      guides = findTrackingGuides(target, entities, zoom, 14);
      if (guides.trackX) target.x = guides.trackX.x;
      if (guides.trackY) target.y = guides.trackY.y;
    }
    setTrackingGuides(guides);

    if (!foundSnap && draftState?.p1) {
      if (settings.ortho) {
        target = applyOrthoConstraint(draftState.p1, target);
      } else if (settings.polar) {
        const polarResult = applyPolarConstraint(draftState.p1, target, settings.polarStep);
        if (polarResult.snapped) {
          target = polarResult.point;
        }
      }
    } else if (!foundSnap && settings.snapToGrid) {
      target = snapToGrid(target, settings.gridSize);
    }

    setActiveSnap(foundSnap);
    setWorldCursor(target);
    if (onCursorMove) onCursorMove(target);

    // INTERACTIVE LIVE ENTITY DRAGGING / MOVING / STRETCHING
    if (dragState) {
      const dx = target.x - dragState.startPt.x;
      const dy = target.y - dragState.startPt.y;

      if (dragState.type === 'move') {
        const orig = dragState.originalEntity;
        if (orig.type === 'wall' && orig.centerline) {
          onUpdateEntity(dragState.entityId, {
            centerline: {
              p1: { x: Math.round(orig.centerline.p1.x + dx), y: Math.round(orig.centerline.p1.y + dy) },
              p2: { x: Math.round(orig.centerline.p2.x + dx), y: Math.round(orig.centerline.p2.y + dy) }
            }
          });
        } else if (orig.type === 'line') {
          onUpdateEntity(dragState.entityId, {
            p1: { x: Math.round(orig.p1.x + dx), y: Math.round(orig.p1.y + dy) },
            p2: { x: Math.round(orig.p2.x + dx), y: Math.round(orig.p2.y + dy) }
          });
        } else if (orig.type === 'rect') {
          onUpdateEntity(dragState.entityId, {
            p1: { x: Math.round(orig.p1.x + dx), y: Math.round(orig.p1.y + dy) },
            p2: { x: Math.round(orig.p2.x + dx), y: Math.round(orig.p2.y + dy) }
          });
        } else if (orig.type === 'block') {
          onUpdateEntity(dragState.entityId, {
            x: Math.round(orig.x + dx),
            y: Math.round(orig.y + dy)
          });
        }
      } else if (dragState.type === 'stretch') {
        const orig = dragState.originalEntity;
        if (orig.type === 'wall' && orig.centerline) {
          const newP1 = dragState.grip === 'p1' ? target : orig.centerline.p1;
          const newP2 = dragState.grip === 'p2' ? target : orig.centerline.p2;
          onUpdateEntity(dragState.entityId, {
            centerline: { p1: newP1, p2: newP2 }
          });
        } else if (orig.type === 'line') {
          const newP1 = dragState.grip === 'p1' ? target : orig.p1;
          const newP2 = dragState.grip === 'p2' ? target : orig.p2;
          onUpdateEntity(dragState.entityId, { p1: newP1, p2: newP2 });
        }
      }
    }
  };

  const findNearestWall = (pt) => {
    let nearest = null;
    let minD = 400;
    walls.forEach(w => {
      if (w.centerline) {
        const proj = projectPointOntoSegment(pt, w.centerline.p1, w.centerline.p2);
        if (proj.distance < minD) {
          minD = proj.distance;
          nearest = w;
        }
      }
    });
    return nearest;
  };

  // Mouse Down
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;

    const pt = { ...worldCursor };

    // 1. PLACE BLOCK
    if (activeBlockToPlace) {
      onAddEntity({
        type: 'block',
        blockId: activeBlockToPlace.id,
        name: activeBlockToPlace.name,
        category: activeBlockToPlace.category,
        x: pt.x,
        y: pt.y,
        width: activeBlockToPlace.width,
        height: activeBlockToPlace.height,
        icon: activeBlockToPlace.icon,
        layer: activeBlockToPlace.layer || activeLayerId
      });
      if (onClearActiveBlock) onClearActiveBlock();
      return;
    }

    // 2. DOOR
    if (activeTool === 'door') {
      const targetWall = findNearestWall(pt);
      if (targetWall) {
        const newDoor = createDoorOnWall(targetWall, pt, 900, 'inward-left');
        if (newDoor) onAddEntity({ ...newDoor, layer: 'A-DOOR' });
      }
      return;
    }

    // 3. WINDOW
    if (activeTool === 'window') {
      const targetWall = findNearestWall(pt);
      if (targetWall) {
        const newWindow = createWindowOnWall(targetWall, pt, 1200);
        if (newWindow) onAddEntity({ ...newWindow, layer: 'A-WIND' });
      }
      return;
    }

    // 4. TEXT
    if (activeTool === 'text') {
      const textVal = prompt("Enter Room or Annotation Label:", "BEDROOM 1");
      if (textVal && textVal.trim()) {
        onAddEntity({
          type: 'text',
          text: textVal.trim(),
          x: pt.x,
          y: pt.y,
          fontSize: 280,
          layer: 'A-TEXT'
        });
      }
      return;
    }

    // 5. FILLET
    if (activeTool === 'fillet') {
      if (activeSnap?.entityId) {
        const ent = entities.find(x => x.id === activeSnap.entityId);
        if (!filletFirstEntity) {
          setFilletFirstEntity(ent);
          onPromptUpdate && onPromptUpdate("FILLET: Select second line to miter corner:");
        } else {
          const s1 = filletFirstEntity.type === 'line' ? filletFirstEntity : { p1: filletFirstEntity.centerline?.p1, p2: filletFirstEntity.centerline?.p2, id: filletFirstEntity.id };
          const s2 = ent.type === 'line' ? ent : { p1: ent.centerline?.p1, p2: ent.centerline?.p2, id: ent.id };
          const res = filletLineSegments(s1, s2, 0);
          if (res) {
            if (filletFirstEntity.type === 'line') {
              onUpdateEntity(filletFirstEntity.id, { p1: res.newSeg1.p1, p2: res.newSeg1.p2 });
            } else {
              onUpdateEntity(filletFirstEntity.id, { centerline: { p1: res.newSeg1.p1, p2: res.newSeg1.p2 } });
            }
            if (ent.type === 'line') {
              onUpdateEntity(ent.id, { p1: res.newSeg2.p1, p2: res.newSeg2.p2 });
            } else {
              onUpdateEntity(ent.id, { centerline: { p1: res.newSeg2.p1, p2: res.newSeg2.p2 } });
            }
          }
          setFilletFirstEntity(null);
        }
      }
      return;
    }

    // 5.5 ROTATE TOOL
    if (activeTool === 'rotate') {
      const hitRotate = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      const targetIds = selectedIds.length > 0 ? selectedIds : (hitRotate ? [hitRotate.entity.id] : []);
      if (targetIds.length > 0) {
        targetIds.forEach(id => {
          const ent = entities.find(e => e.id === id);
          if (ent) {
            const rotated = rotateEntityGeometry(ent, 90);
            onUpdateEntity(id, rotated);
          }
        });
        onPromptUpdate && onPromptUpdate(`ROTATE: Rotated ${targetIds.length} object(s) 90°.`);
      } else {
        onPromptUpdate && onPromptUpdate("ROTATE: Click an entity to rotate 90°.");
      }
      return;
    }

    // 5.6 MIRROR TOOL
    if (activeTool === 'mirror') {
      const hitMirror = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      const targetIds = selectedIds.length > 0 ? selectedIds : (hitMirror ? [hitMirror.entity.id] : []);
      if (targetIds.length > 0) {
        targetIds.forEach(id => {
          const ent = entities.find(e => e.id === id);
          if (ent) {
            const mirrored = mirrorEntityGeometry(ent, 'vertical');
            onUpdateEntity(id, mirrored);
          }
        });
        onPromptUpdate && onPromptUpdate(`MIRROR: Mirrored ${targetIds.length} object(s).`);
      } else {
        onPromptUpdate && onPromptUpdate("MIRROR: Click an entity to mirror across axis.");
      }
      return;
    }

    // 5.7 COPY TOOL
    if (activeTool === 'copy') {
      const hitCopy = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      const targetIds = selectedIds.length > 0 ? selectedIds : (hitCopy ? [hitCopy.entity.id] : []);
      if (targetIds.length > 0) {
        targetIds.forEach(id => {
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
            onAddEntity(clone);
          }
        });
        onPromptUpdate && onPromptUpdate(`COPY: Cloned ${targetIds.length} object(s).`);
      } else {
        onPromptUpdate && onPromptUpdate("COPY: Click an entity to duplicate.");
      }
      return;
    }

    // 5.8 OFFSET TOOL
    if (activeTool === 'offset') {
      const hitOffset = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      if (hitOffset) {
        const ent = hitOffset.entity;
        const offsetDist = settings?.wallThickness || 150;
        if (ent.type === 'wall' && ent.centerline) {
          const off = offsetSegment(ent.centerline.p1, ent.centerline.p2, offsetDist, 1);
          onAddEntity({
            type: 'wall',
            centerline: off,
            thickness: ent.thickness || 150,
            layer: ent.layer || 'A-WALL'
          });
          onPromptUpdate && onPromptUpdate(`OFFSET: Parallel wall created with ${offsetDist} mm offset.`);
        } else if (ent.type === 'line' && ent.p1 && ent.p2) {
          const off = offsetSegment(ent.p1, ent.p2, offsetDist, 1);
          onAddEntity({
            type: 'line',
            p1: off.p1,
            p2: off.p2,
            layer: ent.layer || activeLayerId
          });
          onPromptUpdate && onPromptUpdate(`OFFSET: Parallel line created with ${offsetDist} mm offset.`);
        }
      } else {
        onPromptUpdate && onPromptUpdate("OFFSET: Click a line or wall to offset.");
      }
      return;
    }

    // 5.9 TRIM TOOL
    if (activeTool === 'trim') {
      const hitTrim = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      if (hitTrim) {
        const res = trimEntitySegment(hitTrim.entity, pt, entities);
        if (res) {
          if (res.action === 'delete') {
            onDeleteEntities([res.entityId]);
            onPromptUpdate && onPromptUpdate("TRIM: Object erased.");
          } else if (res.action === 'update') {
            onUpdateEntity(res.entityId, res.updates);
            onPromptUpdate && onPromptUpdate("TRIM: Segment trimmed to boundary.");
          } else if (res.action === 'split') {
            onUpdateEntity(res.entityId, res.updates);
            onAddEntity(res.extraEntity);
            onPromptUpdate && onPromptUpdate("TRIM: Segment trimmed and split at boundaries.");
          }
        } else {
          onPromptUpdate && onPromptUpdate("TRIM: No boundary intersection found to trim.");
        }
      } else {
        onPromptUpdate && onPromptUpdate("TRIM: Click a line or wall segment to trim.");
      }
      return;
    }

    // 5.10 EXTEND TOOL
    if (activeTool === 'extend') {
      const hitExtend = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
      if (hitExtend) {
        const res = extendEntitySegment(hitExtend.entity, pt, entities);
        if (res && res.action === 'update') {
          onUpdateEntity(res.entityId, res.updates);
          onPromptUpdate && onPromptUpdate("EXTEND: Extended to boundary edge.");
        } else {
          onPromptUpdate && onPromptUpdate("EXTEND: No intersecting boundary found along direction.");
        }
      } else {
        onPromptUpdate && onPromptUpdate("EXTEND: Click end of line or wall to extend.");
      }
      return;
    }

    // 6. CHECK FOR DRAGGING EXISTING ENTITY OR GRIP HANDLE
    // (Prevents accidental wild 13m segments when user clicks an existing wall!)
    const hit = hitTestEntity(pt, entities, Math.max(120, 18 / zoom));
    if (hit && (!draftState || activeTool === 'select' || activeTool === 'move')) {
      if (hit.grip === 'p1' || hit.grip === 'p2') {
        // Drag corner grip to STRETCH wall vertex
        onSelectEntity(hit.entity.id);
        setDragState({
          type: 'stretch',
          entityId: hit.entity.id,
          grip: hit.grip,
          startPt: pt,
          originalEntity: JSON.parse(JSON.stringify(hit.entity))
        });
        return;
      }
      if (hit.grip === 'body' || activeTool === 'move') {
        // Drag body to MOVE entity cleanly
        onSelectEntity(hit.entity.id);
        setDragState({
          type: 'move',
          entityId: hit.entity.id,
          startPt: pt,
          originalEntity: JSON.parse(JSON.stringify(hit.entity))
        });
        return;
      }
    }

    // 7. SELECT TOOL
    if (activeTool === 'select') {
      setSelectionBox({ p1: pt, p2: pt });
      return;
    }

    // 8. ERASE
    if (activeTool === 'erase') {
      if (activeSnap?.entityId) onDeleteEntities([activeSnap.entityId]);
      return;
    }

    // 9. WALL or LINE DRAWING CHAIN
    if (activeTool === 'wall' || activeTool === 'line') {
      if (!draftState) {
        setDraftState({ p1: pt });
      } else {
        const p1 = draftState.p1;
        const p2 = pt;
        if (dist(p1, p2) > 10) {
          if (activeTool === 'wall') {
            onAddEntity({
              type: 'wall',
              centerline: { p1, p2 },
              thickness: settings.wallThickness,
              alignment: settings.wallAlignment,
              layer: 'A-WALL'
            });
          } else {
            onAddEntity({
              type: 'line',
              p1,
              p2,
              layer: activeLayerId
            });
          }
          setDraftState({ p1: p2 });
        }
      }
      return;
    }

    // 10. RECTANGLE
    if (activeTool === 'rect') {
      if (!draftState) {
        setDraftState({ p1: pt });
      } else {
        const p1 = draftState.p1;
        const p2 = pt;
        if (dist(p1, p2) > 20) {
          onAddEntity({ type: 'rect', p1, p2, layer: activeLayerId });
        }
        setDraftState(null);
      }
      return;
    }

    // 11. CIRCLE
    if (activeTool === 'circle') {
      if (!draftState) {
        setDraftState({ center: pt });
      } else {
        const r = dist(draftState.center, pt);
        if (r > 10) {
          onAddEntity({ type: 'circle', center: draftState.center, radius: Math.round(r), layer: activeLayerId });
        }
        setDraftState(null);
      }
      return;
    }

    // 12. DIMENSION
    if (activeTool === 'dimension') {
      if (!draftState) {
        setDraftState({ p1: pt });
      } else {
        const p1 = draftState.p1;
        const p2 = pt;
        if (dist(p1, p2) > 10) {
          onAddEntity({ type: 'dimension', p1, p2, layer: 'A-DIMS' });
        }
        setDraftState(null);
      }
      return;
    }
  };

  // Mouse Up
  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // End drag/move/stretch operation cleanly
    if (dragState) {
      setDragState(null);
      return;
    }

    if (selectionBox) {
      const p1 = selectionBox.p1;
      const p2 = selectionBox.p2;
      const d = dist(p1, p2);
      if (d < 5) {
        if (activeSnap?.entityId) {
          onSelectEntity(activeSnap.entityId, e.shiftKey);
        } else {
          onSelectEntity(null);
        }
      } else {
        const isCrossing = p2.x < p1.x;
        onSelectEntitiesInRect({ p1, p2 }, isCrossing);
      }
      setSelectionBox(null);
    }
  };

  // Cancel on Escape or Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDraftState(null);
        setDragState(null);
        setActiveSnap(null);
        setSelectionBox(null);
        setFilletFirstEntity(null);
        onSelectEntity(null);
        if (onClearActiveBlock) onClearActiveBlock();
      } else if (e.key === 'Enter') {
        setDraftState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectEntity, onClearActiveBlock]);

  const activeDistance = draftState?.p1 ? dist(draftState.p1, worldCursor) : 0;
  const activeAngle = draftState?.p1 ? angleDeg(draftState.p1, worldCursor) : 0;

  return (
    <div
      ref={containerRef}
      className="autocad-canvas-viewport"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0A0E17',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : (dragState ? 'move' : 'crosshair')
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <pattern id="cad-grid-minor" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth={1 / zoom} />
          </pattern>
          <pattern id="cad-grid-major" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <rect width="1000" height="1000" fill="url(#cad-grid-minor)" />
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth={1.5 / zoom} />
          </pattern>
          {/* ARCHITECTURAL CAD HATCH PATTERNS */}
          <pattern id="cad-hatch-ansi31" width="250" height="250" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="250" stroke="rgba(56, 189, 248, 0.16)" strokeWidth={1.2 / zoom} />
          </pattern>
          <pattern id="cad-hatch-grid" width="300" height="300" patternUnits="userSpaceOnUse">
            <rect width="300" height="300" fill="none" stroke="rgba(148, 163, 184, 0.15)" strokeWidth={1 / zoom} />
          </pattern>
        </defs>

        <g
          ref={worldGroupRef}
          transform={`translate(${viewTransform.x}, ${(svgRef.current?.clientHeight || 600) - viewTransform.y}) scale(${zoom}, ${-zoom})`}
        >
          {settings.grid && (
            <rect x="-200000" y="-200000" width="400000" height="400000" fill="url(#cad-grid-major)" />
          )}

          <line x1="-100000" y1="0" x2="100000" y2="0" stroke="rgba(239, 68, 68, 0.45)" strokeWidth={1.2 / zoom} />
          <line x1="0" y1="-100000" x2="0" y2="100000" stroke="rgba(34, 197, 94, 0.45)" strokeWidth={1.2 / zoom} />
          <circle cx="0" cy="0" r={4 / zoom} fill="#EF4444" />

          {/* AUTOTRACK OBJECT SNAP ALIGNMENT GUIDE RAYS */}
          {trackingGuides.trackX && (
            <line
              x1={trackingGuides.trackX.x}
              y1="-100000"
              x2={trackingGuides.trackX.x}
              y2="100000"
              stroke="#22C55E"
              strokeWidth={1.2 / zoom}
              strokeDasharray={`${8 / zoom} ${6 / zoom}`}
              opacity={0.7}
            />
          )}
          {trackingGuides.trackY && (
            <line
              x1="-100000"
              y1={trackingGuides.trackY.y}
              x2="100000"
              y2={trackingGuides.trackY.y}
              stroke="#22C55E"
              strokeWidth={1.2 / zoom}
              strokeDasharray={`${8 / zoom} ${6 / zoom}`}
              opacity={0.7}
            />
          )}

          {/* LIVE DETECTED CLOSED ROOMS (FLOOR FILL & LIVE AREA BADGE) */}
          {detectedRooms.map((room, idx) => {
            if (!room.points || room.points.length < 3) return null;
            const ptsStr = room.points.map(pt => `${pt[0]},${pt[1]}`).join(' ');
            const cx = Math.round(room.points.reduce((acc, p) => acc + p[0], 0) / room.points.length);
            const cy = Math.round(room.points.reduce((acc, p) => acc + p[1], 0) / room.points.length);

            return (
              <g key={`detected-room-${idx}`} className="cad-detected-room">
                <polygon
                  points={ptsStr}
                  fill="url(#cad-hatch-ansi31)"
                  stroke="rgba(56, 189, 248, 0.35)"
                  strokeWidth={1.2 / zoom}
                  strokeDasharray={`${8 / zoom} ${6 / zoom}`}
                />
                <g
                  transform={`translate(${cx}, ${cy}) scale(${1 / zoom}, ${-1 / zoom})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt("Enter Custom Label for this Room (e.g. LIVING, BEDROOM, KITCHEN):", room.name || `Room ${idx + 1}`);
                    if (newName && newName.trim()) {
                      onAddEntity({
                        type: 'text',
                        text: newName.trim().toUpperCase(),
                        x: cx,
                        y: cy + 120,
                        fontSize: 280,
                        layer: 'A-TEXT'
                      });
                    }
                  }}
                >
                  <rect
                    x="-55"
                    y="-16"
                    width="110"
                    height="32"
                    rx="6"
                    fill="#0F172A"
                    fillOpacity="0.88"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="-2"
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="10"
                    fontWeight="800"
                    letterSpacing="0.05em"
                  >
                    ROOM {idx + 1} ✎
                  </text>
                  <text
                    x="0"
                    y="11"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {room.carpet_area_sqm} m²
                  </text>
                </g>
              </g>
            );
          })}

          {/* 1. SEAMLESS MITERED ARCHITECTURAL WALLS */}
          {miteredWalls.map((wall, wIdx) => {
            const isSelected = selectedIds.includes(wall.id);
            const wallColor = isSelected ? '#FACC15' : (wall.color || '#38BDF8');
            const strokeW = (isSelected ? 2.2 : 1.8) / zoom;
            const poly = wall.miteredPolygon || wall.polygon;
            if (!poly || poly.length < 4) return null;

            const p0 = poly[0], p1 = poly[1], p2 = poly[2], p3 = poly[3];

            return (
              <g key={wall.id || `wall-${wIdx}`} opacity={wall.visible === false ? 0 : 1}>
                <polygon
                  points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                  fill={isSelected ? "rgba(250, 204, 21, 0.25)" : "rgba(56, 189, 248, 0.14)"}
                  stroke="none"
                />

                <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={wallColor} strokeWidth={strokeW} strokeLinecap="round" />
                <line x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} stroke={wallColor} strokeWidth={strokeW} strokeLinecap="round" />

                {wall.startCap && (
                  <line x1={p0.x} y1={p0.y} x2={p3.x} y2={p3.y} stroke={wallColor} strokeWidth={strokeW} />
                )}
                {wall.endCap && (
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={wallColor} strokeWidth={strokeW} />
                )}

                {wall.centerline && (
                  <line
                    x1={wall.centerline.p1.x}
                    y1={wall.centerline.p1.y}
                    x2={wall.centerline.p2.x}
                    y2={wall.centerline.p2.y}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                )}

                {/* AUTOCAD BLUE GRIP SQUARES ON SELECTED WALLS */}
                {isSelected && wall.centerline && (
                  <g className="cad-grip-handles">
                    {/* Start Grip */}
                    <rect
                      x={wall.centerline.p1.x - 6 / zoom}
                      y={wall.centerline.p1.y - 6 / zoom}
                      width={12 / zoom}
                      height={12 / zoom}
                      fill="#0284C7"
                      stroke="#FFFFFF"
                      strokeWidth={1.5 / zoom}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* End Grip */}
                    <rect
                      x={wall.centerline.p2.x - 6 / zoom}
                      y={wall.centerline.p2.y - 6 / zoom}
                      width={12 / zoom}
                      height={12 / zoom}
                      fill="#0284C7"
                      stroke="#FFFFFF"
                      strokeWidth={1.5 / zoom}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Center Translation Grip */}
                    <rect
                      x={(wall.centerline.p1.x + wall.centerline.p2.x) / 2 - 5 / zoom}
                      y={(wall.centerline.p1.y + wall.centerline.p2.y) / 2 - 5 / zoom}
                      width={10 / zoom}
                      height={10 / zoom}
                      fill="#38BDF8"
                      stroke="#FFFFFF"
                      strokeWidth={1.2 / zoom}
                      style={{ cursor: 'move' }}
                    />
                  </g>
                )}

                {/* Real-time Wall Dimension Tag */}
                {showWallDimensions && wall.centerline && (
                  <g
                    transform={`translate(${(wall.centerline.p1.x + wall.centerline.p2.x) / 2}, ${(wall.centerline.p1.y + wall.centerline.p2.y) / 2}) scale(${1 / zoom}, ${-1 / zoom})`}
                  >
                    <rect x="-24" y="-10" width="48" height="14" rx="2" fill="#0A0E17" stroke="#334155" strokeWidth="0.8" />
                    <text x="0" y="0" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="700">
                      {Math.round(wall.length || dist(wall.centerline.p1, wall.centerline.p2))}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. OTHER COMMITTED ENTITIES */}
          {otherEntities.map((ent, eIdx) => {
            const entKey = ent.id || `cad-ent-${eIdx}`;
            const isSelected = selectedIds.includes(ent.id);
            const entColor = isSelected ? '#FACC15' : (ent.color || '#FFFFFF');
            const strokeW = (isSelected ? 2.5 : 1.5) / zoom;

            if (ent.type === 'line' && ent.p1 && ent.p2) {
              return (
                <g key={entKey}>
                  <line x1={ent.p1.x} y1={ent.p1.y} x2={ent.p2.x} y2={ent.p2.y} stroke={entColor} strokeWidth={strokeW} strokeLinecap="round" />
                  {isSelected && (
                    <>
                      <rect x={ent.p1.x - 6 / zoom} y={ent.p1.y - 6 / zoom} width={12 / zoom} height={12 / zoom} fill="#0284C7" stroke="#FFFFFF" strokeWidth={1.5 / zoom} />
                      <rect x={ent.p2.x - 6 / zoom} y={ent.p2.y - 6 / zoom} width={12 / zoom} height={12 / zoom} fill="#0284C7" stroke="#FFFFFF" strokeWidth={1.5 / zoom} />
                    </>
                  )}
                </g>
              );
            }

            if (ent.type === 'door' && ent.hingePt && ent.strikePt) {
              return (
                <g key={entKey} className="cad-door-entity">
                  <circle cx={ent.hingePt.x} cy={ent.hingePt.y} r={12 / zoom} fill="#EAB308" />
                  <circle cx={ent.strikePt.x} cy={ent.strikePt.y} r={12 / zoom} fill="#EAB308" />
                  <line x1={ent.hingePt.x} y1={ent.hingePt.y} x2={ent.leafEnd.x} y2={ent.leafEnd.y} stroke="#FACC15" strokeWidth={2.5 / zoom} />
                  <path d={ent.arcPath} fill="none" stroke="#EAB308" strokeWidth={1.2 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />
                </g>
              );
            }

            if (ent.type === 'window' && ent.startPt && ent.endPt) {
              return (
                <g key={entKey} className="cad-window-entity">
                  <line x1={ent.startPt.x} y1={ent.startPt.y} x2={ent.endPt.x} y2={ent.endPt.y} stroke="#34D399" strokeWidth={3 / zoom} />
                  <line x1={ent.startPt.x} y1={ent.startPt.y} x2={ent.endPt.x} y2={ent.endPt.y} stroke="#6EE7B7" strokeWidth={1.5 / zoom} />
                  <circle cx={ent.startPt.x} cy={ent.startPt.y} r={10 / zoom} fill="#059669" />
                  <circle cx={ent.endPt.x} cy={ent.endPt.y} r={10 / zoom} fill="#059669" />
                </g>
              );
            }

            if (ent.type === 'rect' && ent.p1 && ent.p2) {
              const rx = Math.min(ent.p1.x, ent.p2.x);
              const ry = Math.min(ent.p1.y, ent.p2.y);
              const rw = Math.abs(ent.p2.x - ent.p1.x);
              const rh = Math.abs(ent.p2.y - ent.p1.y);
              return (
                <rect key={entKey} x={rx} y={ry} width={rw} height={rh} fill={isSelected ? "rgba(250, 204, 21, 0.2)" : "none"} stroke={entColor} strokeWidth={strokeW} />
              );
            }

            if (ent.type === 'circle' && ent.center && ent.radius) {
              return (
                <circle key={entKey} cx={ent.center.x} cy={ent.center.y} r={ent.radius} fill={isSelected ? "rgba(250, 204, 21, 0.2)" : "none"} stroke={entColor} strokeWidth={strokeW} />
              );
            }

            if (ent.type === 'dimension' && ent.p1 && ent.p2) {
              const d = Math.round(dist(ent.p1, ent.p2));
              const mid = { x: (ent.p1.x + ent.p2.x) / 2, y: (ent.p1.y + ent.p2.y) / 2 };
              const tickLen = 8 / zoom;
              return (
                <g key={entKey} className="cad-dimension">
                  {/* Dimension line */}
                  <line x1={ent.p1.x} y1={ent.p1.y} x2={ent.p2.x} y2={ent.p2.y} stroke="#38BDF8" strokeWidth={1.4 / zoom} />
                  {/* 45-degree Architectural Ticks */}
                  <line
                    x1={ent.p1.x - tickLen * 0.7}
                    y1={ent.p1.y - tickLen * 0.7}
                    x2={ent.p1.x + tickLen * 0.7}
                    y2={ent.p1.y + tickLen * 0.7}
                    stroke="#38BDF8"
                    strokeWidth={2 / zoom}
                  />
                  <line
                    x1={ent.p2.x - tickLen * 0.7}
                    y1={ent.p2.y - tickLen * 0.7}
                    x2={ent.p2.x + tickLen * 0.7}
                    y2={ent.p2.y + tickLen * 0.7}
                    stroke="#38BDF8"
                    strokeWidth={2 / zoom}
                  />
                  {/* Extension marks */}
                  <circle cx={ent.p1.x} cy={ent.p1.y} r={3 / zoom} fill="#0284C7" />
                  <circle cx={ent.p2.x} cy={ent.p2.y} r={3 / zoom} fill="#0284C7" />
                  {/* Dimension label */}
                  <g transform={`translate(${mid.x}, ${mid.y}) scale(${1 / zoom}, ${-1 / zoom})`}>
                    <rect x="-35" y="-12" width="70" height="18" fill="#020617" stroke="#38BDF8" strokeWidth="1" rx="4" />
                    <text x="0" y="2" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="700" fontFamily="monospace">
                      {d} mm
                    </text>
                  </g>
                </g>
              );
            }

            if (ent.type === 'text' && ent.text) {
              return (
                <g key={entKey} transform={`translate(${ent.x}, ${ent.y}) scale(${1 / zoom}, ${-1 / zoom})`}>
                  <text x="0" y="0" fill={isSelected ? "#FACC15" : (ent.color || "#FFFFFF")} fontSize={(ent.fontSize || 250) * zoom * 0.08} fontWeight="700">
                    {ent.text}
                  </text>
                </g>
              );
            }

            if (ent.type === 'block') {
              return <g key={entKey}>{renderCadBlock(ent, isSelected, zoom)}</g>;
            }

            return null;
          })}

          {/* ACTIVE RUBBERBAND PREVIEW */}
          {draftState?.p1 && (
            <g className="cad-rubberband-preview">
              {activeTool === 'wall' ? (
                <line
                  x1={draftState.p1.x}
                  y1={draftState.p1.y}
                  x2={worldCursor.x}
                  y2={worldCursor.y}
                  stroke="#38BDF8"
                  strokeWidth={(settings.wallThickness || 150) / zoom}
                  strokeOpacity={0.4}
                />
              ) : (
                <line
                  x1={draftState.p1.x}
                  y1={draftState.p1.y}
                  x2={worldCursor.x}
                  y2={worldCursor.y}
                  stroke="#38BDF8"
                  strokeWidth={1.5 / zoom}
                  strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                />
              )}
              {/* Dynamic Distance & Angle HUD Badge */}
              {dist(draftState.p1, worldCursor) > 20 && (
                <g transform={`translate(${(draftState.p1.x + worldCursor.x) / 2}, ${(draftState.p1.y + worldCursor.y) / 2}) scale(${1 / zoom}, ${-1 / zoom})`}>
                  <rect
                    x="-65"
                    y="-14"
                    width="130"
                    height="24"
                    rx="5"
                    fill="#020617"
                    fillOpacity="0.9"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {Math.round(dist(draftState.p1, worldCursor))} mm | {Math.round(angleDeg(draftState.p1, worldCursor))}°
                  </text>
                </g>
              )}
            </g>
          )}

          {/* BLOCK PLACEMENT PREVIEW */}
          {activeBlockToPlace && (
            <g className="cad-block-placement-preview" opacity={0.75} style={{ pointerEvents: 'none' }}>
              {renderCadBlock({
                id: 'preview',
                blockId: activeBlockToPlace.id,
                name: activeBlockToPlace.name,
                x: worldCursor.x,
                y: worldCursor.y,
                width: activeBlockToPlace.width,
                height: activeBlockToPlace.height,
                rotation: 0
              }, false, zoom)}
            </g>
          )}

          {/* OBJECT SNAP GLYPH OVERLAY */}
          {activeSnap && (
            <g transform={`translate(${activeSnap.point.x}, ${activeSnap.point.y})`}>
              {activeSnap.type === SNAP_TYPES.ENDPOINT && (
                <rect x={-8 / zoom} y={-8 / zoom} width={16 / zoom} height={16 / zoom} fill="none" stroke="#22C55E" strokeWidth={2.5 / zoom} />
              )}
              {activeSnap.type === SNAP_TYPES.MIDPOINT && (
                <polygon
                  points={`0,${-9 / zoom} ${-8 / zoom},${8 / zoom} ${8 / zoom},${8 / zoom}`}
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth={2.5 / zoom}
                />
              )}
              {activeSnap.type === SNAP_TYPES.INTERSECTION && (
                <g stroke="#22C55E" strokeWidth={2.5 / zoom}>
                  <line x1={-7 / zoom} y1={-7 / zoom} x2={7 / zoom} y2={7 / zoom} />
                  <line x1={-7 / zoom} y1={7 / zoom} x2={7 / zoom} y2={-7 / zoom} />
                </g>
              )}
              {activeSnap.type === SNAP_TYPES.CENTER && (
                <circle cx="0" cy="0" r={9 / zoom} fill="none" stroke="#22C55E" strokeWidth={2.5 / zoom} />
              )}
              {activeSnap.type === SNAP_TYPES.PERPENDICULAR && (
                <path d={`M ${-8/zoom} 0 L 0 0 L 0 ${8/zoom}`} fill="none" stroke="#22C55E" strokeWidth={2.5 / zoom} />
              )}
            </g>
          )}

          {/* Selection Box */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.p1.x, selectionBox.p2.x)}
              y={Math.min(selectionBox.p1.y, selectionBox.p2.y)}
              width={Math.abs(selectionBox.p2.x - selectionBox.p1.x)}
              height={Math.abs(selectionBox.p2.y - selectionBox.p1.y)}
              fill={selectionBox.p2.x < selectionBox.p1.x ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)"}
              stroke={selectionBox.p2.x < selectionBox.p1.x ? "#22C55E" : "#3B82F6"}
              strokeWidth={1.5 / zoom}
              strokeDasharray={selectionBox.p2.x < selectionBox.p1.x ? `${6 / zoom} ${4 / zoom}` : undefined}
            />
          )}
        </g>
      </svg>

      {/* FULLSCREEN AUTOCAD CROSSHAIR CURSOR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: screenCursor.y, left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
        <div style={{ position: 'absolute', left: screenCursor.x, top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
        <div style={{ position: 'absolute', left: screenCursor.x - 5, top: screenCursor.y - 5, width: '10px', height: '10px', border: '1px solid rgba(255, 255, 255, 0.9)', boxSizing: 'border-box' }} />

        {/* Dynamic Input (DYN) Length & Angle HUD */}
        {settings.dynamicInput && draftState?.p1 && (
          <div style={{
            position: 'absolute',
            left: screenCursor.x + 18,
            top: screenCursor.y + 12,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid #38BDF8',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            fontFamily: 'Consolas, Monaco, monospace',
            color: '#FFFFFF',
            display: 'flex',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'none'
          }}>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>
              {Math.round(activeDistance)} mm
            </span>
            <span style={{ color: '#94A3B8' }}>
              &lt; {Math.round(activeAngle)}°
            </span>
          </div>
        )}

        {/* Magnetic OSNAP Badge */}
        {activeSnap && (
          <div style={{
            position: 'absolute',
            left: screenCursor.x + 18,
            top: screenCursor.y - 20,
            backgroundColor: '#15803D',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
          }}>
            {activeSnap.label}
          </div>
        )}
      </div>

      {/* Real-World CAD Scale Bar (Bottom Left) */}
      {(() => {
        const scaleDistMm = zoom > 0.05 ? 1000 : (zoom > 0.01 ? 5000 : 10000);
        const scaleBarPx = Math.max(30, scaleDistMm * zoom);
        return (
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '3px',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#94A3B8',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 25,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              width: `${scaleBarPx}px`,
              height: '4px',
              borderLeft: '2px solid #38BDF8',
              borderRight: '2px solid #38BDF8',
              borderBottom: '2px solid #38BDF8'
            }} />
            <span style={{ color: '#38BDF8', fontSize: '9px', marginTop: '2px', fontFamily: 'monospace' }}>
              {scaleDistMm >= 1000 ? `${scaleDistMm / 1000} m` : `${scaleDistMm} mm`} (Scale 1:{Math.round(1 / zoom)})
            </span>
          </div>
        );
      })()}
    </div>
  );
}
