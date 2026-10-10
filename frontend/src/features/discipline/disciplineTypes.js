/**
 * disciplineTypes.js
 * 
 * Production discipline definitions, visual states, and classification logic
 * for the meplaniq CAD Discipline Layout & Layer Filtering System.
 * 
 * Follows strict non-destructive principles:
 * - Master CAD data is never filtered, sliced, or mutated.
 * - Inactive discipline elements are ghosted/dimmed (default 18% opacity, pointerEvents: 'none').
 * - Selected elements always pop with 100% opacity and full interactivity.
 */

export const DISCIPLINE_VIEWS = {
  ALL: 'all',
  ARCHITECTURE: 'architecture',
  HVAC: 'hvac',
  PLUMBING: 'plumbing',
  ELECTRICAL: 'electrical'
};

export const DISCIPLINE_DISPLAY_MODES = {
  DIM: 'dim',       // Standard BIM ghosting / underlay (18% opacity, non-interactive)
  ISOLATE: 'isolate' // Strict MEP focus (0% opacity for non-architectural elements)
};

export const DISCIPLINE_CONFIG = {
  [DISCIPLINE_VIEWS.ALL]: {
    id: DISCIPLINE_VIEWS.ALL,
    label: 'All',
    shortLabel: 'ALL',
    icon: '🌐',
    color: '#94A3B8',
    activeBg: 'rgba(148, 163, 184, 0.15)',
    activeBorder: '#94A3B8',
    description: 'All disciplines visible and fully interactive',
    shortcut: '1'
  },
  [DISCIPLINE_VIEWS.ARCHITECTURE]: {
    id: DISCIPLINE_VIEWS.ARCHITECTURE,
    label: 'Architecture',
    shortLabel: 'ARCH',
    icon: '🏛️',
    color: '#38BDF8',
    activeBg: 'rgba(56, 189, 248, 0.15)',
    activeBorder: '#38BDF8',
    description: 'Architectural envelope, openings, walls & interior furniture',
    shortcut: '2'
  },
  [DISCIPLINE_VIEWS.HVAC]: {
    id: DISCIPLINE_VIEWS.HVAC,
    label: 'HVAC',
    shortLabel: 'HVAC',
    icon: '❄️',
    color: '#C084FC',
    activeBg: 'rgba(192, 132, 252, 0.15)',
    activeBorder: '#C084FC',
    description: 'Mechanical equipment (IDU/ODU) & refrigerant piping network',
    shortcut: '3'
  },
  [DISCIPLINE_VIEWS.PLUMBING]: {
    id: DISCIPLINE_VIEWS.PLUMBING,
    label: 'Plumbing',
    shortLabel: 'PLUMB',
    icon: '🚰',
    color: '#06B6D4',
    activeBg: 'rgba(6, 182, 212, 0.15)',
    activeBorder: '#06B6D4',
    description: 'Sanitary fixtures, water supply & drainage pipe networks',
    shortcut: '4'
  },
  [DISCIPLINE_VIEWS.ELECTRICAL]: {
    id: DISCIPLINE_VIEWS.ELECTRICAL,
    label: 'Electrical',
    shortLabel: 'ELECT',
    icon: '⚡',
    color: '#F59E0B',
    activeBg: 'rgba(245, 158, 11, 0.15)',
    activeBorder: '#F59E0B',
    description: 'Fixtures, switches, distribution circuits & conduit routing',
    shortcut: '5'
  }
};

/**
 * Defines which sub-disciplines belong to each view filter.
 */
export const DISCIPLINE_GROUPS = {
  [DISCIPLINE_VIEWS.ALL]: ['architecture', 'furniture', 'hvac', 'plumbing', 'electrical'],
  [DISCIPLINE_VIEWS.ARCHITECTURE]: ['architecture', 'furniture'],
  [DISCIPLINE_VIEWS.HVAC]: ['hvac'],
  [DISCIPLINE_VIEWS.PLUMBING]: ['plumbing'],
  [DISCIPLINE_VIEWS.ELECTRICAL]: ['electrical']
};

/**
 * Returns the discipline category for any CAD entity type.
 * Defaults to 'architecture' for unknown/legacy objects to avoid hiding them.
 */
export function getElementDiscipline(type, item) {
  if (!type && !item) return 'architecture';
  const lowerType = String(type || '').toLowerCase().trim();

  // HVAC
  if (lowerType === 'hvac' || lowerType === 'hvac_equipment' || lowerType === 'hvac_pipe' || lowerType.includes('hvac')) {
    return 'hvac';
  }

  // Plumbing
  if (lowerType === 'plumbing' || lowerType === 'plumbingfixture' || lowerType === 'plumbingpipe' || lowerType.includes('plumb')) {
    return 'plumbing';
  }

  // Electrical
  if (lowerType === 'electrical' || lowerType === 'electricalcomponent' || lowerType === 'electricalcircuit' || lowerType === 'electricalroute' || lowerType.includes('elect')) {
    return 'electrical';
  }

  // Furniture
  if (lowerType === 'furniture' || lowerType === 'furn') {
    return 'furniture';
  }

  // Fallback defaults to architecture (Walls, Doors, Windows, Rooms, Dimensions)
  return 'architecture';
}

/**
 * Computes the visual render state (opacity, interactivity, visibility)
 * for a specific discipline under the active discipline view and display mode.
 * 
 * @param {string} discipline - 'architecture' | 'furniture' | 'hvac' | 'plumbing' | 'electrical'
 * @param {string} activeView - One of DISCIPLINE_VIEWS ('all', 'architecture', etc.)
 * @param {string} displayMode - 'dim' | 'isolate'
 * @param {boolean} isSelected - Whether the entity is currently selected
 * @returns {{ visible: boolean, opacity: number, interactive: boolean, dimmed: boolean }}
 */
export function getDisciplineVisualState(discipline, activeView, displayMode = DISCIPLINE_DISPLAY_MODES.DIM, isSelected = false) {
  // 1. Actively selected items always pop with 100% opacity and full interactivity
  if (isSelected) {
    return { visible: true, opacity: 1.0, interactive: true, dimmed: false };
  }

  // 2. All View: Everything is active, 100% opacity and interactive
  if (!activeView || activeView === DISCIPLINE_VIEWS.ALL) {
    return { visible: true, opacity: 1.0, interactive: true, dimmed: false };
  }

  // 3. Check if this discipline is part of the active view
  const activeDisciplines = DISCIPLINE_GROUPS[activeView] || [];
  const isActive = activeDisciplines.includes(discipline);

  if (isActive) {
    return { visible: true, opacity: 1.0, interactive: true, dimmed: false };
  }

  // 4. Inactive discipline rendering logic
  if (displayMode === DISCIPLINE_DISPLAY_MODES.ISOLATE) {
    // In isolate mode: architectural boundaries remain as an ultra-subtle backdrop for MEP reference
    if (discipline === 'architecture') {
      return { visible: true, opacity: 0.12, interactive: false, dimmed: true };
    }
    // Other inactive MEP / furniture disciplines are hidden
    return { visible: false, opacity: 0.0, interactive: false, dimmed: true };
  }

  // 5. Default 'dim' (Ghost) mode:
  // - Architecture envelope (walls, doors) stays at ~25% as structural context
  // - Inactive MEP & Furniture stays at ~15%
  const dimOpacity = discipline === 'architecture' ? 0.25 : 0.15;
  return { visible: true, opacity: dimOpacity, interactive: false, dimmed: true };
}
