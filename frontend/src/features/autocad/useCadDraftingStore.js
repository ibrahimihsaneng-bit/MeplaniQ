/**
 * useCadDraftingStore.js
 * Central state management hook for AutoCAD Drafting Studio in MEPlanIQ.
 */

import { useState, useCallback, useRef } from 'react';
import { generateWallGeometry } from './cadGeometryUtils';

export const DEFAULT_LAYERS = [
  { id: '0', name: '0 (Default)', color: '#FFFFFF', lineweight: 0.25, visible: true, locked: false },
  { id: 'A-WALL', name: 'A-WALL (Walls)', color: '#38BDF8', lineweight: 0.50, visible: true, locked: false },
  { id: 'A-DOOR', name: 'A-DOOR (Doors)', color: '#FACC15', lineweight: 0.25, visible: true, locked: false },
  { id: 'A-WIND', name: 'A-WIND (Windows)', color: '#34D399', lineweight: 0.25, visible: true, locked: false },
  { id: 'S-COLS', name: 'S-COLS (Structural Columns)', color: '#38BDF8', lineweight: 0.50, visible: true, locked: false },
  { id: 'S-GRID', name: 'S-GRID (Structural Axes)', color: '#F87171', lineweight: 0.25, visible: true, locked: false },
  { id: 'M-HVAC', name: 'M-HVAC (Mechanical)', color: '#FB923C', lineweight: 0.35, visible: true, locked: false },
  { id: 'P-PLUM', name: 'P-PLUM (Plumbing)', color: '#60A5FA', lineweight: 0.35, visible: true, locked: false },
  { id: 'E-ELEC', name: 'E-ELEC (Electrical)', color: '#F43F5E', lineweight: 0.35, visible: true, locked: false },
  { id: 'A-DIMS', name: 'A-DIMS (Dimensions)', color: '#94A3B8', lineweight: 0.18, visible: true, locked: false },
  { id: 'A-TEXT', name: 'A-TEXT (Annotations)', color: '#E2E8F0', lineweight: 0.25, visible: true, locked: false },
  { id: 'A-ANNO', name: 'A-ANNO (Sheet & Title Block)', color: '#10B981', lineweight: 0.35, visible: true, locked: false }
];

export function useCadDraftingStore(initialEntities = []) {
  const [entities, setEntitiesInternal] = useState(initialEntities);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('A-WALL');
  const [activeTool, setActiveTool] = useState('wall'); // 'select' | 'wall' | 'line' | 'rect' | 'circle' | 'arc' | 'dimension' | 'offset' | 'trim' | 'erase' | 'measure'
  const [selectedIds, setSelectedIds] = useState([]);

  // Drafting settings & toggles
  const [settings, setSettings] = useState({
    ortho: false,            // F8
    polar: true,             // F10
    polarStep: 45,           // 15, 30, 45, 90
    osnap: true,             // F3
    osnapModes: {
      endpoint: true,
      midpoint: true,
      intersection: true,
      center: true,
      perpendicular: true
    },
    grid: true,              // F7
    snapToGrid: false,       // F9
    gridSize: 100,           // mm
    dynamicInput: true,      // DYN
    wallThickness: 150,      // mm
    wallAlignment: 'center', // 'center' | 'left' | 'right'
    unit: 'mm'               // 'mm' | 'm' | 'ft'
  });

  // Undo / Redo history
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const pushSnapshot = useCallback((currentEntities) => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(currentEntities)));
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = []; // Clear redo on new action
  }, []);

  const addEntity = useCallback((entityData) => {
    setEntitiesInternal(prev => {
      pushSnapshot(prev);
      const newEntity = {
        id: entityData.id || `ent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        layer: entityData.layer || activeLayerId,
        color: entityData.color || (layers.find(l => l.id === (entityData.layer || activeLayerId))?.color || '#FFFFFF'),
        visible: true,
        ...entityData
      };

      // Auto-compute wall geometry if type is wall
      if (newEntity.type === 'wall' && newEntity.centerline) {
        const wallGeo = generateWallGeometry(
          newEntity.centerline.p1,
          newEntity.centerline.p2,
          newEntity.thickness || settings.wallThickness,
          newEntity.alignment || settings.wallAlignment
        );
        Object.assign(newEntity, wallGeo);
      }

      return [...prev, newEntity];
    });
  }, [activeLayerId, layers, pushSnapshot, settings.wallThickness, settings.wallAlignment]);

  const addEntities = useCallback((newEntitiesList) => {
    setEntitiesInternal(prev => {
      pushSnapshot(prev);
      const sanitized = (newEntitiesList || []).map((ent, idx) => ({
        ...ent,
        id: ent.id || `ent-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`
      }));
      return [...prev, ...sanitized];
    });
  }, [pushSnapshot]);

  const updateEntity = useCallback((id, updates) => {
    setEntitiesInternal(prev => {
      pushSnapshot(prev);
      return prev.map(ent => (ent.id === id ? { ...ent, ...updates } : ent));
    });
  }, [pushSnapshot]);

  const deleteEntities = useCallback((idsToDelete) => {
    if (!idsToDelete || idsToDelete.length === 0) return;
    setEntitiesInternal(prev => {
      pushSnapshot(prev);
      const deleteSet = new Set(idsToDelete);
      return prev.filter(ent => !deleteSet.has(ent.id));
    });
    setSelectedIds([]);
  }, [pushSnapshot]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return false;
    const previous = undoStackRef.current.pop();
    setEntitiesInternal(current => {
      redoStackRef.current.push(JSON.parse(JSON.stringify(current)));
      return previous;
    });
    setSelectedIds([]);
    return true;
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return false;
    const next = redoStackRef.current.pop();
    setEntitiesInternal(current => {
      undoStackRef.current.push(JSON.parse(JSON.stringify(current)));
      return next;
    });
    setSelectedIds([]);
    return true;
  }, []);

  const clearAll = useCallback(() => {
    setEntitiesInternal(prev => {
      pushSnapshot(prev);
      return [];
    });
    setSelectedIds([]);
  }, [pushSnapshot]);

  const toggleSetting = useCallback((settingKey) => {
    setSettings(prev => ({
      ...prev,
      [settingKey]: !prev[settingKey]
    }));
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const selectEntity = useCallback((id, multi = false) => {
    if (!id) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(prev => {
      if (multi) {
        return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);

  const selectEntitiesInRect = useCallback((rect, crossing = false) => {
    // Selection window vs crossing selection
    const minX = Math.min(rect.p1.x, rect.p2.x);
    const maxX = Math.max(rect.p1.x, rect.p2.x);
    const minY = Math.min(rect.p1.y, rect.p2.y);
    const maxY = Math.max(rect.p1.y, rect.p2.y);

    const hitIds = [];
    entities.forEach(ent => {
      let entMinX = 0, entMaxX = 0, entMinY = 0, entMaxY = 0;
      if (ent.type === 'line' && ent.p1 && ent.p2) {
        entMinX = Math.min(ent.p1.x, ent.p2.x);
        entMaxX = Math.max(ent.p1.x, ent.p2.x);
        entMinY = Math.min(ent.p1.y, ent.p2.y);
        entMaxY = Math.max(ent.p1.y, ent.p2.y);
      } else if (ent.type === 'wall' && ent.centerline) {
        entMinX = Math.min(ent.centerline.p1.x, ent.centerline.p2.x);
        entMaxX = Math.max(ent.centerline.p1.x, ent.centerline.p2.x);
        entMinY = Math.min(ent.centerline.p1.y, ent.centerline.p2.y);
        entMaxY = Math.max(ent.centerline.p1.y, ent.centerline.p2.y);
      } else if (ent.type === 'rect' && ent.p1 && ent.p2) {
        entMinX = Math.min(ent.p1.x, ent.p2.x);
        entMaxX = Math.max(ent.p1.x, ent.p2.x);
        entMinY = Math.min(ent.p1.y, ent.p2.y);
        entMaxY = Math.max(ent.p1.y, ent.p2.y);
      } else {
        return;
      }

      if (crossing) {
        // Any overlap qualifies
        if (!(entMaxX < minX || entMinX > maxX || entMaxY < minY || entMinY > maxY)) {
          hitIds.push(ent.id);
        }
      } else {
        // Must be completely inside window
        if (entMinX >= minX && entMaxX <= maxX && entMinY >= minY && entMaxY <= maxY) {
          hitIds.push(ent.id);
        }
      }
    });

    setSelectedIds(hitIds);
  }, [entities]);

  return {
    entities,
    setEntities: setEntitiesInternal,
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
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0
  };
}
