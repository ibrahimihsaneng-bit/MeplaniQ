/**
 * titleblockEngine.js
 * 
 * Commercial Architectural & MEP Paper Space Sheet Layout & Titleblock Engine.
 * Conforms to ISO 7200 (Technical documentation title blocks) and ISO 5457 (Drawing sheet sizes).
 */

export const SHEET_SIZES = {
  A0: { id: 'A0', name: 'ISO A0 Landscape', widthMm: 1189, heightMm: 841, standard: 'ISO 5457' },
  A1: { id: 'A1', name: 'ISO A1 Landscape', widthMm: 841, heightMm: 594, standard: 'ISO 5457' },
  A2: { id: 'A2', name: 'ISO A2 Landscape', widthMm: 594, heightMm: 420, standard: 'ISO 5457' },
  A3: { id: 'A3', name: 'ISO A3 Landscape', widthMm: 420, heightMm: 297, standard: 'ISO 5457' },
  ARCH_D: { id: 'ARCH_D', name: 'US Arch D (24"×36")', widthMm: 914.4, heightMm: 609.6, standard: 'ANSI Y14.1' },
  ARCH_E: { id: 'ARCH_E', name: 'US Arch E (36"×48")', widthMm: 1219.2, heightMm: 914.4, standard: 'ANSI Y14.1' }
};

export const DRAWING_SCALES = [
  { id: '1:20', label: '1:20 (Details)', ratio: 0.05 },
  { id: '1:50', label: '1:50 (Standard Architectural)', ratio: 0.02 },
  { id: '1:100', label: '1:100 (General MEP Layout)', ratio: 0.01 },
  { id: '1:200', label: '1:200 (Site & Campus Plan)', ratio: 0.005 }
];

export const SHEET_DISCIPLINES = {
  ARCHITECTURAL: {
    sheetNumber: 'A-101',
    discipline: 'ARCHITECTURAL',
    sheetTitle: 'GROUND FLOOR GENERAL ARRANGEMENT & ROOM SCHEDULE',
    layers: {
      walls: true,
      openings: true,
      furniture: true,
      dimensions: true,
      roomTags: true,
      plumbing: false,
      hvac: false,
      electrical: false,
      clashes: false,
      sleeves: false
    }
  },
  PLUMBING: {
    sheetNumber: 'P-101',
    discipline: 'PLUMBING & SANITARY',
    sheetTitle: 'PLUMBING FIXTURE RETICULATION & DRAINAGE GRADIENT PLAN',
    layers: {
      walls: true,
      openings: true,
      furniture: false,
      dimensions: false,
      roomTags: true,
      plumbing: true,
      hvac: false,
      electrical: false,
      clashes: false,
      sleeves: true
    }
  },
  HVAC: {
    sheetNumber: 'M-101',
    discipline: 'MECHANICAL / HVAC',
    sheetTitle: 'DUCTED AIR DISTRIBUTION & CEILING DIFFUSER LAYOUT',
    layers: {
      walls: true,
      openings: true,
      furniture: false,
      dimensions: false,
      roomTags: true,
      plumbing: false,
      hvac: true,
      electrical: false,
      clashes: false,
      sleeves: true
    }
  },
  ELECTRICAL: {
    sheetNumber: 'E-101',
    discipline: 'ELECTRICAL & LIGHTING',
    sheetTitle: 'LIGHTING, POWER CONDUITS & HOMERUN CIRCUIT DISTRIBUTION',
    layers: {
      walls: true,
      openings: true,
      furniture: false,
      dimensions: false,
      roomTags: true,
      plumbing: false,
      hvac: false,
      electrical: true,
      clashes: false,
      sleeves: false
    }
  },
  COORDINATION: {
    sheetNumber: 'C-101',
    discipline: 'MEP COORDINATION',
    sheetTitle: 'MULTI-TRADE CLASH COORDINATION & PENETRATION SLEEVES',
    layers: {
      walls: true,
      openings: true,
      furniture: false,
      dimensions: false,
      roomTags: true,
      plumbing: true,
      hvac: true,
      electrical: true,
      clashes: true,
      sleeves: true
    }
  }
};

/**
 * Compute the bounding box of the entire 2D floorplan model.
 * @param {Object} modelData
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, centerX: number, centerY: number}}
 */
export function computeModelBounds(modelData) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  const pushPt = (x, y) => {
    if (x != null && !isNaN(x) && y != null && !isNaN(y)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  };

  // Rooms / Walls
  (modelData?.rooms || []).forEach(r => {
    (r.points || []).forEach(p => {
      pushPt(Array.isArray(p) ? p[0] : p.x, Array.isArray(p) ? p[1] : p.y);
    });
  });

  // Plumbing Fixtures
  (modelData?.plumbing_fixtures || []).forEach(f => pushPt(f.x, f.y));

  // Ducts
  (modelData?.hvac_ducts || []).forEach(d => {
    (d.path || d.points || []).forEach(p => pushPt(Array.isArray(p) ? p[0] : p.x, Array.isArray(p) ? p[1] : p.y));
  });

  // Electrical Components
  (modelData?.electrical_components || []).forEach(c => pushPt(c.x, c.y));

  if (!isFinite(minX)) {
    minX = 0; maxX = 12000; minY = 0; maxY = 8000;
  }

  const width = Math.max(1000, maxX - minX);
  const height = Math.max(1000, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * Compute optimal viewport transform to fit model onto sheet paper.
 * 
 * @param {Object} sheetSize - Item from SHEET_SIZES
 * @param {Object} modelBounds - Output of computeModelBounds
 * @param {number} scaleRatio - e.g. 0.02 for 1:50, or null for auto-fit
 * @returns {{scale: number, scaleLabel: string, offsetX: number, offsetY: number, viewportWidth: number, viewportHeight: number}}
 */
export function calculateViewportFit(sheetSize, modelBounds, scaleRatio = null) {
  const marginBindingLeft = 25; // 25mm left binding edge
  const marginOther = 12; // 12mm top, bottom, right
  const titleblockWidth = 190; // Titleblock reserved width (mm)

  // Usable viewport canvas in mm on physical sheet paper
  const viewportWidthMm = sheetSize.widthMm - marginBindingLeft - marginOther;
  const viewportHeightMm = sheetSize.heightMm - (marginOther * 2);

  // Model size in mm
  const modelW = modelBounds.width;
  const modelH = modelBounds.height;

  let chosenRatio = scaleRatio;
  let chosenLabel = '1:50';

  if (!chosenRatio) {
    // Auto-select largest standard scale that fits within paper
    for (const sc of DRAWING_SCALES) {
      const drawnW = modelW * sc.ratio;
      const drawnH = modelH * sc.ratio;
      if (drawnW <= (viewportWidthMm - 30) && drawnH <= (viewportHeightMm - 30)) {
        chosenRatio = sc.ratio;
        chosenLabel = sc.id;
        break;
      }
    }
    if (!chosenRatio) {
      chosenRatio = Math.min((viewportWidthMm - 40) / modelW, (viewportHeightMm - 40) / modelH);
      chosenLabel = `1:${Math.round(1 / chosenRatio)}`;
    }
  } else {
    const match = DRAWING_SCALES.find(s => Math.abs(s.ratio - scaleRatio) < 1e-4);
    chosenLabel = match ? match.id : `1:${Math.round(1 / scaleRatio)}`;
  }

  // Centering on paper:
  // Center of usable drawing area (offset from sheet origin 0,0)
  const paperCenterXMm = marginBindingLeft + (viewportWidthMm - titleblockWidth * 0.4) / 2;
  const paperCenterYMm = marginOther + viewportHeightMm / 2;

  // Viewport translation: map model center to paper center
  const offsetX = paperCenterXMm - modelBounds.centerX * chosenRatio;
  const offsetY = paperCenterYMm - modelBounds.centerY * chosenRatio;

  return {
    scale: chosenRatio,
    scaleLabel: chosenLabel,
    offsetX,
    offsetY,
    viewportWidth: viewportWidthMm,
    viewportHeight: viewportHeightMm,
    paperCenterX: paperCenterXMm,
    paperCenterY: paperCenterYMm
  };
}

/**
 * Generate standard graphic bar scale geometry for SVG paper rendering.
 * @param {string} scaleId - '1:50' | '1:100' etc.
 * @param {number} x - Origin X on sheet (mm)
 * @param {number} y - Origin Y on sheet (mm)
 * @returns {Object}
 */
export function generateGraphicBarScale(scaleId = '1:50', x = 0, y = 0) {
  // 1:50 means 1m in real world is 20mm on paper
  // 1:100 means 1m in real world is 10mm on paper
  const mmPerMeter = scaleId === '1:20' ? 50 : (scaleId === '1:50' ? 20 : (scaleId === '1:100' ? 10 : 5));
  const barHeight = 4;

  const intervals = [
    { label: '0m', x: 0 },
    { label: '1m', x: mmPerMeter },
    { label: '2m', x: mmPerMeter * 2 },
    { label: '5m', x: mmPerMeter * 5 }
  ];

  const totalWidth = mmPerMeter * 5;

  return {
    x,
    y,
    totalWidth,
    barHeight,
    intervals,
    mmPerMeter
  };
}

/**
 * Build the complete multi-sheet documentation set for a project.
 * 
 * @param {Object} projectMetadata - Project name, client, number, date
 * @param {Object} options - Paper size & scale preferences
 * @returns {Array<Object>} List of sheet descriptors
 */
export function generateProjectSheetSet(projectMetadata = {}, options = {}) {
  const sheetSizeKey = options.sheetSize || 'A1';
  const sheetSize = SHEET_SIZES[sheetSizeKey] || SHEET_SIZES.A1;
  const projectName = projectMetadata.name || projectMetadata.project_name || 'Commercial Facility MEP';
  const clientName = projectMetadata.client || 'MeplaniQ Engineering Clients';
  const projectNumber = projectMetadata.id || 'MPQ-2026-001';
  const currentDate = new Date().toISOString().split('T')[0];

  return Object.values(SHEET_DISCIPLINES).map((disc, idx) => ({
    id: `sheet_${disc.sheetNumber}`,
    sheetNumber: disc.sheetNumber,
    sheetTitle: disc.sheetTitle,
    discipline: disc.discipline,
    pageIndex: idx + 1,
    totalPages: Object.keys(SHEET_DISCIPLINES).length,
    sheetSize,
    scaleId: options.scaleId || (disc.discipline === 'ARCHITECTURAL' ? '1:50' : '1:100'),
    projectName,
    clientName,
    projectNumber,
    date: currentDate,
    revision: 'REV 0',
    status: 'ISSUED FOR APPROVAL',
    layers: disc.layers
  }));
}
