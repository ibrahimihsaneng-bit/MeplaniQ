import html2canvas from 'html2canvas';

/**
 * Checks if a color string represents a light/neutral tone that requires
 * high-contrast inversion on white backgrounds, while strictly preserving
 * saturated functional colors (like green drainage, cyan supply, orange dots, yellow doors).
 */
export function isLightColor(colorStr) {
  if (!colorStr) return false;
  const c = String(colorStr).trim().toLowerCase();

  // Explicit dark-theme light neutrals and whites
  if (
    c === '#ffffff' ||
    c === 'white' ||
    c === '#f8fafc' ||
    c === '#f1f5f9' ||
    c === '#e2e8f0' ||
    c === '#e0e7ff' ||
    c === '#a5b4fc' ||
    c === '#e9d5ff' ||
    c === '#94a3b8' ||
    c === '#cbd5e1' ||
    c === '#64748b' ||
    c === '#f3f4f6'
  ) {
    return true;
  }

  if (c.startsWith('rgba(255,') || c.startsWith('rgba(255, 255, 255')) {
    return true;
  }

  // Parse HEX codes
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    const hex = c.length === 4
      ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
      : c.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;

    // Check color saturation (difference between max and min channel).
    // Saturated colors like Green (#2ECC71), Cyan (#00BFFF), Orange (#FFA500),
    // Yellow (#FACC15), Purple (#A855F7) have delta > 60 and MUST BE PRESERVED.
    const delta = Math.max(r, g, b) - Math.min(r, g, b);
    if (delta > 60) {
      return false; // Functional MEP / category color -> PRESERVE
    }

    // Low saturation: check relative luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 160;
  }

  // Parse RGB / RGBA
  if (c.startsWith('rgb')) {
    const match = c.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = Number(match[0]) || 0;
      const g = Number(match[1]) || 0;
      const b = Number(match[2]) || 0;
      const delta = Math.max(r, g, b) - Math.min(r, g, b);
      if (delta > 60) return false;
      return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
    }
  }

  return false;
}

/**
 * Checks if the target export background is a light color (e.g. Pure White #FFFFFF).
 */
export function isLightBackground(bgColor) {
  if (!bgColor) return false;
  const str = String(bgColor).trim().toLowerCase();
  if (str === '#ffffff' || str === 'white' || str === '#f1f5f9' || str === '#f8fafc' || str === '#e2e8f0') {
    return true;
  }
  return isLightColor(str);
}

/**
 * Dedicated, isolated Image Export handler for CAD floorplans.
 * 
 * Features:
 * - Isolated background override (solid #FFFFFF or user selection)
 * - Smart high-contrast color inversion for white/light text, walls, dimensions
 * - Strict preservation of functional MEP color codes (cyan, green, orange, purple)
 * - Grid toggle control with subtle light-gray (#E0E0E0) rendering on white background
 * - Professional 50px-100px padding margin buffer around exported floorplan
 * - Zero mutation of live workspace or dark theme styling
 */
export async function exportToImage({
  targetElement = null,
  resolution = '2',
  bgColor = '#0F172A',
  includeGrid = true,
  paddingBuffer = 75,
  format = 'png',
  fileName = 'cad-floorplan'
} = {}) {
  // 1. Locate the target DOM element safely
  const element = targetElement || document.querySelector('.canvas-wrapper') || document.querySelector('.cad-canvas');
  if (!element) {
    throw new Error('Target CAD canvas element not found in DOM.');
  }

  const isLightBg = isLightBackground(bgColor);
  const scale = Math.max(1, parseInt(resolution, 10) || 2);
  const paddingPx = Math.max(50, Math.min(100, Number(paddingBuffer) || 75)) * scale;

  // 2. Perform off-screen rendering via html2canvas with isolated onclone transformations.
  // Changes are applied ONLY to the isolated offscreen clonedDoc, completely protecting the live UI.
  const renderedCanvas = await html2canvas(element, {
    scale: scale,
    backgroundColor: bgColor,
    logging: false,
    useCORS: true,
    allowTaint: true,
    ignoreElements: (node) => {
      if (!node) return false;
      return Boolean(node?.classList?.contains?.('exclude-export'));
    },
    onclone: (clonedDoc) => {
      try {
        const clonedWrapper = clonedDoc?.querySelector?.('.canvas-wrapper') || clonedDoc?.body;
        if (clonedWrapper?.style) {
          clonedWrapper.style.backgroundColor = bgColor;
        }

        const clonedSvg = clonedWrapper?.querySelector?.('svg.cad-canvas') || clonedWrapper?.querySelector?.('svg') || clonedDoc?.querySelector?.('svg');
        if (!clonedSvg) return;

        if (clonedSvg?.style) {
          clonedSvg.style.backgroundColor = bgColor;
        }

        // Hide any floating HTML overlay controls / tooltips / item edit dialogs
        const overlayEls = clonedWrapper?.querySelectorAll?.('.exclude-export, .status-bar, div[style*="position: absolute"]');
        overlayEls?.forEach?.(el => {
          if (el && el !== clonedWrapper && el?.style) {
            el.style.display = 'none';
          }
        });

        // A. Isolated Export Canvas Background Override:
        // Update the SVG background rectangle (which is <rect width="100%" height="100%" fill="#0F172A" /> in Canvas.jsx)
        const bgRect = clonedSvg.querySelector('rect[width="100%"]');
        if (bgRect) {
          bgRect.setAttribute('fill', bgColor);
          if (bgRect.style) bgRect.style.fill = bgColor;
        }

        // B. Grid Toggle Control:
        const gridRect = clonedSvg.querySelector('rect[fill*="grid-major"]');
        if (!includeGrid) {
          // User chose to hide grid lines completely
          if (gridRect) gridRect.remove();
        } else if (isLightBg) {
          // If shown on a white background, render grid lines in subtle light-gray (#E0E0E0)
          const minorPath = clonedSvg.querySelector('#grid-minor path');
          if (minorPath) {
            minorPath.setAttribute('stroke', '#E0E0E0');
            if (minorPath.style) minorPath.style.stroke = '#E0E0E0';
          }
          const majorPath = clonedSvg.querySelector('#grid-major path');
          if (majorPath) {
            majorPath.setAttribute('stroke', '#D4D4D8');
            if (majorPath.style) majorPath.style.stroke = '#D4D4D8';
          }
        }

        // C. Clean up interactive editor handles & drag previews
        const handlesLayer = clonedSvg.querySelector('#LAYER_ROOM_HANDLES');
        if (handlesLayer) handlesLayer.remove();
        const previewLayer = clonedSvg.querySelector('#LAYER_RESIZE_PREVIEW');
        if (previewLayer) previewLayer.remove();

        // D. Smart Color Inversion for High-Contrast Readability:
        if (isLightBg) {
          // 1. Room boundaries & Wall lines:
          // Invert white boundaries to deep black (#000000 / #111111)
          const wallPaths = clonedSvg.querySelectorAll('#LAYER_WALLS path');
          wallPaths?.forEach?.(p => {
            const currentStroke = p.getAttribute('stroke');
            if (!currentStroke || currentStroke.toLowerCase() === '#ffffff' || currentStroke.toLowerCase() === 'white' || currentStroke.includes('255, 255, 255')) {
              p.setAttribute('stroke', '#111111');
            }
          });

          const wallLines = clonedSvg.querySelectorAll('#LAYER_WALLS line');
          wallLines?.forEach?.(l => {
            const currentStroke = l.getAttribute('stroke');
            if (!currentStroke || currentStroke.toLowerCase() === '#ffffff' || currentStroke.toLowerCase() === 'white' || currentStroke.includes('255, 255, 255')) {
              l.setAttribute('stroke', '#111111');
            }
          });

          // 2. General text labels:
          // Invert white/light text to deep black (#111111) and remove dark text-shadows
          const allTexts = clonedSvg.querySelectorAll('text');
          allTexts?.forEach?.(t => {
            if (t.style) t.style.textShadow = 'none';

            // If dimension text, enforce deep black
            if (t.closest && t.closest('#LAYER_DIMENSIONS')) {
              t.setAttribute('fill', '#111111');
              if (t.style) t.style.fill = '#111111';
              return;
            }

            const fill = t.getAttribute('fill') || '';
            if (isLightColor(fill)) {
              t.setAttribute('fill', '#111111');
              if (t.style) t.style.fill = '#111111';
            }
          });

          // 3. Dimension numbers and lines:
          const dimLayer = clonedSvg.querySelector('#LAYER_DIMENSIONS');
          if (dimLayer) {
            const dimLines = dimLayer.querySelectorAll('line');
            dimLines?.forEach?.(l => {
              l.setAttribute('stroke', '#111111');
              if (l.style) l.style.stroke = '#111111';
            });
            const dimTexts = dimLayer.querySelectorAll('text');
            dimTexts?.forEach?.(t => {
              t.setAttribute('fill', '#111111');
              if (t.style) {
                t.style.textShadow = 'none';
                t.style.fill = '#111111';
              }
            });
          }

          // 4. Origin marker ring:
          const originCircle = clonedSvg.querySelector('#LAYER_ORIGIN circle');
          if (originCircle) {
            const s = originCircle.getAttribute('stroke');
            if (s && (s.toLowerCase() === '#ffffff' || s.toLowerCase() === 'white')) {
              originCircle.setAttribute('stroke', '#111111');
            }
          }

          // 5. Junction node rings:
          const fittingCircles = clonedSvg.querySelectorAll(
            '.plumbing-trunk-junction circle, .plumbing-branch-supply circle, .plumbing-branch-drain circle'
          );
          fittingCircles?.forEach?.(c => {
            const s = c.getAttribute('stroke');
            if (s && (s.toLowerCase() === '#ffffff' || s.toLowerCase() === 'white')) {
              c.setAttribute('stroke', '#111111');
            }
          });

          // PRESERVE SPECIFIC COLORS:
          // Green drainage pipes (#2ECC71), Cyan water supply pipes (#00BFFF / #38BDF8),
          // Orange anchor dots (#FFA500 / #F59E0B), Yellow doors (#FACC15),
          // Purple HVAC (#C084FC / #A855F7), and room pastel fills are untouched.
        }
      } catch (err) {
        console.warn('Error during export DOM clone optimization:', err);
      }
    }
  });

  // 3. Professional Margin / Padding Buffer with Off-Screen Canvas Rendering:
  // Paint a solid background (Pure White #FFFFFF or selected color) and add
  // a clean 50px-100px padding buffer around the floorplan to prevent any edge clipping.
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = renderedCanvas.width + paddingPx * 2;
  offscreenCanvas.height = renderedCanvas.height + paddingPx * 2;

  const offscreenCtx = offscreenCanvas.getContext('2d');
  if (!offscreenCtx) {
    throw new Error('Could not create off-screen canvas 2D context.');
  }

  // Paint solid export background
  offscreenCtx.fillStyle = bgColor;
  offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  // Draw the rendered floorplan centered with padding buffer
  offscreenCtx.drawImage(renderedCanvas, paddingPx, paddingPx);

  // 4. Download generation
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const fileExt = format === 'jpeg' ? 'jpg' : 'png';
  const dataUrl = offscreenCanvas.toDataURL(mimeType, format === 'jpeg' ? 0.95 : undefined);

  const link = document.createElement('a');
  link.download = `${fileName}.${fileExt}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return {
    success: true,
    width: offscreenCanvas.width,
    height: offscreenCanvas.height,
    paddingPx,
    format: fileExt
  };
}
