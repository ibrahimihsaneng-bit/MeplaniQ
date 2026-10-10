# Meplaniq Logo System — Production Specification

**Status:** Approved symbol/color direction for production handoff  
**Brand:** Meplaniq  
**Logo type:** Symbol-only MEP coordination mark  
**Master artboard:** 2400 × 2400 units  
**Primary export:** Transparent SVG and PNG

> This package documents the approved symbol-only artwork and the approved MEP color mapping. A wordmark lockup is intentionally not included because the exact wordmark typography has not yet been approved.

## 1. Design premise

The mark is a four-zone technical coordination symbol. Each quadrant represents a major system discipline while the shared center and clean negative space express coordination and integration.

- **Upper-left:** mechanical/equipment
- **Upper-right:** electrical/power
- **Lower-left:** plumbing/water
- **Lower-right:** AC/HVAC/airflow

The identity should feel engineered, modular, coordinated, and software-ready—not like a literal floor plan or building icon.

## 2. Construction and measurements

### Master coordinate system

| Property | Specification |
|---|---:|
| SVG viewBox | `0 0 2400 2400` |
| Center axis | `x = 1200`, `y = 1200` |
| Source geometry area | 1920 × 1920 units |
| Master inset | 240 units on each side |
| Source-to-master scale | 1:1 inside centered artboard |
| Approx. visible mark width | 1871 source px / 1920 ≈ 97.45% |
| Approx. visible mark height | 1899 source px / 1920 ≈ 98.91% |
| Suggested clear-space unit X | 120 units minimum |

### Clear space

Define **X = 120 master units**. Keep at least `1X` of empty space around the visible outermost silhouette. The supplied master artboard includes approximately `2X` of practical breathing room on each side.

Do not place text, borders, UI controls, photography, or other marks inside the clear-space zone.

### Construction rules

1. Keep the four discipline zones aligned to the central horizontal and vertical axes.
2. Preserve the central negative space; do not fill it with color or type.
3. Preserve the relative weight of the four zones; no zone should visually overpower the full system without a product-specific reason.
4. Use flat fills and clean boundaries in the master logo.
5. Do not add outlines, glows, bevels, shadows, gradients, or 3D effects to the core mark.
6. Use the same geometry in all primary, dark, reverse, and monochrome variants.

## 3. Approved semantic color system

| Token | Component | HEX | RGB | Recommended use |
|---|---|---|---|---|
| `mech-blue` | Mechanical / equipment | `#123B7A` | `18, 59, 122` | Primary structural anchor |
| `elec-amber` | Electrical / power | `#F4B400` | `244, 180, 0` | Energy and electrical signal |
| `plumb-cyan` | Plumbing / water | `#00A6D6` | `0, 166, 214` | Water, piping, flow |
| `hvac-green` | AC / HVAC / airflow | `#1F9D55` | `31, 157, 85` | Airflow, efficiency, environment |
| `control-violet` | Fixtures / controls accent | `#7C3AED` | `124, 58, 237` | UI/control accent only; not required in the core symbol |

### Color application

- The **primary logo** uses the four discipline colors.
- The fixtures/controls violet is reserved for application UI, diagrams, selected states, or future responsive detail—not for adding a fifth large quadrant to the core mark.
- On white or transparent backgrounds, use the primary palette.
- On dark backgrounds, use the supplied lightened `dark` variant.
- For one-color printing, use the monochrome variant.

## 4. Standard variants

| Variant | Purpose | File |
|---|---|---|
| Primary | Main website and product identity | `svg/logo_icon_primary.svg` |
| Dark | Dark UI and dark brand surfaces | `svg/logo_icon_dark.svg` |
| Monochrome | Print, emboss, stamp, and one-color reproduction | `svg/logo_icon_mono.svg` |
| Reverse | White mark on dark/colored surfaces | `svg/logo_icon_reverse.svg` |
| Approved raster | Original approved artwork reference | `png/logo_icon_approved-raster-1920.png` |

## 5. Minimum sizes

| Application | Minimum recommended size |
|---|---:|
| Favicon / browser tab | 16 px; prefer 32 px or 48 px |
| Compact UI icon | 24 px |
| App navigation | 32 px |
| Header icon | 48 px |
| Digital standalone mark | 64 px |
| Print standalone mark | 12 mm |
| Large-format print | Use SVG; no fixed upper limit |

At 16–24 px, use the primary icon only. Do not add the violet control accent at these sizes.

## 6. Background rules

### Approved

- White
- Transparent
- Very light neutral surfaces
- Deep navy or graphite using `logo_icon_dark.svg`
- Solid dark color using `logo_icon_reverse.svg`

### Not approved

- Busy photography behind the mark
- Low-contrast mid-gray backgrounds
- Pattern fills inside the mark
- Uncontrolled gradients
- Colored outlines around the mark
- Placing the mark inside a forced white rectangle when transparency is available

## 7. Incorrect usage

Do not:

- Stretch or compress the symbol
- Rotate the symbol
- Change the quadrant order
- Replace the approved colors with arbitrary colors without a system reason
- Add a wordmark before its typography is approved
- Fill the negative-space center
- Apply drop shadows, 3D extrusion, glow, chrome, or bevels
- Crop into the symbol
- Rebuild the mark with a different gap or component arrangement
- Use the violet control accent as a fifth full-size discipline zone

## 8. Export and handoff notes

The SVG masters are editable vector reconstructions of the approved raster artwork. They use four clean filled path groups on a 2400-unit artboard and preserve the approved symbol silhouette and component order.

The original generated raster is included as `logo_icon_approved-raster-1920.png` for reference. If the logo later becomes a registered identity or needs manufacturing-grade precision, a designer should perform a final manual Bézier cleanup and approve the exact path geometry before legal trademark filing or high-volume fabrication.

## 9. Package inventory

### Vector masters

- `svg/logo_icon_primary.svg`
- `svg/logo_icon_dark.svg`
- `svg/logo_icon_mono.svg`
- `svg/logo_icon_reverse.svg`

### PNG exports

- `png/logo_icon_primary.png` — 1024 px
- `png/logo_icon_dark.png` — 1024 px
- `png/logo_icon_mono.png` — 1024 px
- `png/logo_icon_reverse.png` — 1024 px
- `png/favicon-16.png`
- `png/favicon-24.png`
- `png/favicon-32.png`
- `png/favicon-48.png`
- `png/favicon-64.png`
- `png/favicon-128.png`
- `png/favicon-256.png`
- `png/favicon-512.png`
- `png/logo_icon_approved-raster-1920.png`

## 10. Recommended next step

Before creating a wordmark lockup, approve the symbol system first. After approval, define the exact `meplaniq` wordmark, choose a licensed or open font direction, and document the horizontal lockup spacing separately rather than guessing typography inside this symbol-only package.
