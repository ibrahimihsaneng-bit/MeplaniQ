#import "report-theme.typ": report-accent, report-theme

#show: report-theme.with(
  title: "Meplaniq Logo System Specification",
  author: "Manus",
  rhythm: "report",
  running-header: true,
)

#page(margin: (top: 18%, x: 2.2cm), numbering: none, header: none)[
  #align(center)[
    #text(size: 26pt, weight: "bold", fill: report-accent)[Meplaniq Logo System]
    #v(0.5em)
    #text(size: 14pt, fill: luma(80))[Production specification and export handoff]
    #v(2em)
    #image("logo_icon_primary.png", width: 55%)
    #v(1.5em)
    #text(size: 11pt)[Approved symbol-only MEP coordination mark]
    #v(1em)
    #text(size: 9pt, fill: luma(90))[Master artboard: 2400 × 2400 units · Primary palette · Transparent background]
  ]
]

#page(numbering: none, header: none)[
  #outline(title: [Contents], indent: 1.5em)
]

#counter(page).update(1)

= Design premise

The Meplaniq mark is a four-zone technical coordination symbol. Each quadrant represents a major MEP discipline, while the shared center and controlled negative space express integration and workflow coordination.

- Upper-left: mechanical and equipment
- Upper-right: electrical and power
- Lower-left: plumbing and water
- Lower-right: AC, HVAC, and airflow

The mark is intentionally symbol-only. A wordmark lockup is not included in this specification because the exact `meplaniq` wordmark typography has not yet been approved.

= Construction measurements

#set par(first-line-indent: 0em)

#table(
  columns: (2.8fr, 1.2fr, 2.2fr),
  inset: 7pt,
  stroke: 0.4pt + luma(190),
  fill: (x, y) => if y == 0 { luma(235) } else { white },
  [*Property*], [*Value*], [*Production meaning*],
  [SVG viewBox], [`0 0 2400 2400`], [Centered master artboard],
  [Center axis], [`x = 1200, y = 1200`], [Four zones align to the center],
  [Source geometry], [1920 × 1920], [Approved artwork area],
  [Master inset], [240 units], [Clear breathing room around source geometry],
  [Suggested clear-space unit X], [120 units], [Minimum protected space],
  [Visible width], [≈ 97.45%], [Based on approved raster bounds],
  [Visible height], [≈ 98.91%], [Based on approved raster bounds],
)

== Clear space

Define *X = 120 master units*. Keep at least `1X` of empty space between the visible silhouette and any text, border, UI control, image, or neighboring mark. The supplied master artboard provides approximately `2X` of practical breathing room on each side.

== Geometry rules

Preserve the four-zone order, the central negative space, the relative mass of each quadrant, and the clean discipline boundaries. Do not add outlines, glows, bevels, shadows, gradients, or 3D effects to the core mark.

= Approved color system

#table(
  columns: (1.4fr, 2.3fr, 1.3fr, 1.6fr),
  inset: 7pt,
  stroke: 0.4pt + luma(190),
  fill: (x, y) => if y == 0 { luma(235) } else { white },
  [*Token*], [*Component*], [*HEX*], [*Role*],
  [`mech-blue`], [Mechanical / equipment], [`#123B7A`], [Structural anchor],
  [`elec-amber`], [Electrical / power], [`#F4B400`], [Energy and signal],
  [`plumb-cyan`], [Plumbing / water], [`#00A6D6`], [Water and flow],
  [`hvac-green`], [AC / HVAC / airflow], [`#1F9D55`], [Air and efficiency],
  [`control-violet`], [Fixtures / controls accent], [`#7C3AED`], [UI/detail accent],
)

The primary logo uses the four discipline colors. The violet control color is reserved for application UI, technical legends, selected states, and future responsive detail. It is not required as a fifth full-size quadrant in the core symbol.

#pagebreak()

= Standard logo variants

#table(
  columns: (1.5fr, 2.6fr, 2.8fr),
  inset: 7pt,
  stroke: 0.4pt + luma(190),
  fill: (x, y) => if y == 0 { luma(235) } else { white },
  [*Variant*], [*Use*], [*Master file*],
  [Primary], [Main website and product identity], [`svg/logo_icon_primary.svg`],
  [Dark], [Dark product UI and dark brand surfaces], [`svg/logo_icon_dark.svg`],
  [Monochrome], [Print, stamp, emboss, and one-color reproduction], [`svg/logo_icon_mono.svg`],
  [Reverse], [White mark on dark or colored surfaces], [`svg/logo_icon_reverse.svg`],
)

== Minimum sizes

#table(
  columns: (3.4fr, 1.4fr, 2.6fr),
  inset: 7pt,
  stroke: 0.4pt + luma(190),
  fill: (x, y) => if y == 0 { luma(235) } else { white },
  [*Application*], [*Minimum*], [*Guidance*],
  [Favicon / browser tab], [16 px], [Prefer 32 px or 48 px],
  [Compact UI icon], [24 px], [Use primary icon only],
  [App navigation], [32 px], [Do not add violet detail],
  [Header icon], [48 px], [Primary or dark variant],
  [Digital standalone mark], [64 px], [Full color or monochrome],
  [Print standalone mark], [12 mm], [Use vector SVG],
)

== Background guidance

Approved backgrounds are white, transparent, light neutral surfaces, deep navy or graphite using the dark variant, and solid dark surfaces using the reverse variant. Avoid busy photography, low-contrast gray, uncontrolled gradients, colored outlines, and forced white boxes around a mark that already has transparency.

= Incorrect usage

Do not stretch, compress, rotate, crop, or redraw the symbol. Do not change the quadrant order, fill the negative-space center, replace the approved colors arbitrarily, or add a wordmark before typography is approved. Do not add shadows, glow, chrome, bevels, or 3D extrusion.

= Export handoff

The SVG masters are editable vector reconstructions of the approved raster artwork. They use four filled path groups on a 2400-unit artboard and preserve the approved silhouette and component order. The original generated raster is retained separately for comparison.

For trademark filing, manufacturing, embroidery, or other high-volume fabrication, a designer should perform a final manual Bézier/path review and approve the exact geometry before legal registration or production.

#table(
  columns: (3.2fr, 3.6fr),
  inset: 7pt,
  stroke: 0.4pt + luma(190),
  fill: (x, y) => if y == 0 { luma(235) } else { white },
  [*Package area*], [*Included files*],
  [Vector masters], [`logo_icon_primary.svg`, `logo_icon_dark.svg`, `logo_icon_mono.svg`, `logo_icon_reverse.svg`],
  [PNG masters], [`logo_icon_primary.png`, `logo_icon_dark.png`, `logo_icon_mono.png`, `logo_icon_reverse.png`],
  [Favicon sizes], [16, 24, 32, 48, 64, 128, 256, and 512 px],
  [Documentation], [`brand_logo_system_spec.md` and this PDF],
)

#v(2em)
#align(center)[#text(size: 9pt, fill: luma(90))[Meplaniq symbol-only logo system · Production handoff · Color and geometry specification]]
