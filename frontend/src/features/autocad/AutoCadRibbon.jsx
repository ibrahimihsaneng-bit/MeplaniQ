import React, { useState } from 'react';
import AutonomousSprintTimer from '../mep/AutonomousSprintTimer';

export default function AutoCadRibbon({
  activeTool,
  onSelectTool,
  layers,
  activeLayerId,
  onSelectLayer,
  onOpenLayerManager,
  onOpenBlockLibrary,
  onTogglePropertiesPanel,
  isPropertiesOpen,
  onToggleEngineeringPanel,
  isEngineeringPanelOpen,
  showThermalHeatmap = false,
  onToggleThermalHeatmap,
  is3DViewActive = false,
  onToggle3DView,
  onAutoDimensionAll,
  onInsertScheduleTable,
  onInsertTitleBlock,
  onGenerateStructuralGrid,
  onGenerateAutomatedMep,
  onGenerateAutomatedElectrical,
  onRunClashDetection,
  onGenerateMasterAudit,
  showWallDimensions,
  onToggleWallDimensions,
  settings,
  onUpdateSetting,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onConvertToBim,
  onSaveProject,
  onExportDxf,
  onExportSvg,
  onExportPng,
  onExportAutoLisp,
  onExportIfc,
  onClearAll,
  isConverting = false
}) {
  const [activeTab, setActiveTab] = useState('home');

  const drawTools = [
    { id: 'wall', label: 'Wall', icon: '🧱', shortcut: 'WALL', desc: 'Continuous Double Wall' },
    { id: 'door', label: 'Door', icon: '🚪', shortcut: 'D', desc: 'Parametric Swing Door' },
    { id: 'window', label: 'Window', icon: '🪟', shortcut: 'W', desc: 'Architectural Window' },
    { id: 'line', label: 'Line', icon: '📏', shortcut: 'L', desc: 'Single Line' },
    { id: 'polyline', label: 'Polyline', icon: '〰️', shortcut: 'PL', desc: 'Connected Polyline' },
    { id: 'rect', label: 'Rect', icon: '▭', shortcut: 'REC', desc: 'Rectangle / Room' },
    { id: 'circle', label: 'Circle', icon: '◯', shortcut: 'C', desc: 'Circle' },
    { id: 'arc', label: 'Arc', icon: '⌒', shortcut: 'A', desc: 'Arc' },
    { id: 'text', label: 'Text', icon: '🔤', shortcut: 'T', desc: 'Room Text Label' }
  ];

  const modifyTools = [
    { id: 'trim', label: 'Trim', icon: '✂️', shortcut: 'TR', desc: 'Trim Intersecting Line' },
    { id: 'extend', label: 'Extend', icon: '⤚', shortcut: 'EX', desc: 'Extend to Edge' },
    { id: 'fillet', label: 'Fillet', icon: '📐', shortcut: 'F', desc: 'Miter / Fillet Corner' },
    { id: 'chamfer', label: 'Chamfer', icon: '◿', shortcut: 'CHA', desc: 'Bevel Intersecting Corner' },
    { id: 'offset', label: 'Offset', icon: '⫽', shortcut: 'O', desc: 'Offset Parallel' },
    { id: 'move', label: 'Move', icon: '✥', shortcut: 'M', desc: 'Move Objects' },
    { id: 'copy', label: 'Copy', icon: '📋', shortcut: 'CO', desc: 'Copy Objects' },
    { id: 'rotate', label: 'Rotate', icon: '⟳', shortcut: 'RO', desc: 'Rotate Objects' },
    { id: 'mirror', label: 'Mirror', icon: '🪞', shortcut: 'MI', desc: 'Mirror across Axis' },
    { id: 'erase', label: 'Erase', icon: '🗑️', shortcut: 'E', desc: 'Delete Selected' },
    { id: 'select', label: 'Select', icon: '↖', shortcut: 'ESC', desc: 'Selection Pointer' }
  ];

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  return (
    <header className="autocad-ribbon-container" style={{
      backgroundColor: '#0F172A',
      borderBottom: '1px solid #334155',
      color: '#E2E8F0',
      userSelect: 'none',
      fontSize: '12px'
    }}>
      {/* Top Application Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        backgroundColor: '#090D16',
        borderBottom: '1px solid #1E293B'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#DC2626',
            color: 'white',
            fontWeight: 800,
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            letterSpacing: '0.05em'
          }}>
            <span>A</span>
            <span>AUTOCAD STUDIO</span>
          </div>
          <span style={{ color: '#64748B', fontSize: '11px' }}>|</span>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '12px' }}>MEPlanIQ Direct 2D Drafter</span>
          <span style={{ color: '#64748B', fontSize: '11px' }}>|</span>
          <AutonomousSprintTimer currentCycle={11} totalHours={24} />
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: canUndo ? '#E2E8F0' : '#475569',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: canRedo ? '#E2E8F0' : '#475569',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ↷ Redo
          </button>

          {/* New / Clear Drawing */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("⚠️ Clear current AutoCAD drawing?\n\nThis will remove all linework and blocks from the canvas.")) {
                onClearAll();
              }
            }}
            title="Start New / Clear Canvas"
            style={{
              background: '#1E293B',
              border: '1px solid #475569',
              color: '#F87171',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🗑️</span>
            <span>Clear</span>
          </button>

          <span style={{ color: '#334155', margin: '0 4px' }}>|</span>

          {/* Block Library Button */}
          <button
            type="button"
            onClick={onOpenBlockLibrary}
            style={{
              background: '#1E293B',
              border: '1px solid #38BDF8',
              color: '#38BDF8',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📦</span>
            <span>Block Library</span>
          </button>

          {/* Properties Panel Toggle */}
          <button
            type="button"
            onClick={onTogglePropertiesPanel}
            style={{
              background: isPropertiesOpen ? '#0284C7' : '#1E293B',
              border: `1px solid ${isPropertiesOpen ? '#38BDF8' : '#334155'}`,
              color: isPropertiesOpen ? '#FFFFFF' : '#CBD5E1',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            📋 Properties
          </button>

          {/* PhD Grade Engineering Analytics Panel Toggle */}
          <button
            type="button"
            onClick={onToggleEngineeringPanel}
            title="Open Computational BIM, NBC Compliance & MEP Engineering Dashboard"
            style={{
              background: isEngineeringPanelOpen ? '#4338CA' : '#1E293B',
              border: `1px solid ${isEngineeringPanelOpen ? '#818CF8' : '#334155'}`,
              color: isEngineeringPanelOpen ? '#FFFFFF' : '#C7D2FE',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔬</span>
            <span>BIM Analytics</span>
          </button>

          {/* Thermal / HVAC Heatmap View Toggle */}
          <button
            type="button"
            onClick={onToggleThermalHeatmap}
            title="Toggle ASHRAE Spatial Thermal Comfort Heatmap View"
            style={{
              background: showThermalHeatmap ? '#B45309' : '#1E293B',
              border: `1px solid ${showThermalHeatmap ? '#F59E0B' : '#334155'}`,
              color: showThermalHeatmap ? '#FFFFFF' : '#FDE68A',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🌡️</span>
            <span>Heatmap</span>
          </button>

          {/* 3D Spatial BIM Extrusion View Toggle */}
          <button
            type="button"
            onClick={onToggle3DView}
            title="Toggle 3D Spatial BIM Extrusion & Axonometric View (3D / ISO / ORBIT)"
            style={{
              background: is3DViewActive ? '#0284C7' : '#1E293B',
              border: `1px solid ${is3DViewActive ? '#38BDF8' : '#334155'}`,
              color: is3DViewActive ? '#FFFFFF' : '#38BDF8',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🧊</span>
            <span>3D View</span>
          </button>

          {/* Insert Architectural Schedule Table Button */}
          <button
            type="button"
            onClick={onInsertScheduleTable}
            title="Stamp Standard Architectural Room & Opening Schedule Table onto Sheet (TABLE)"
            style={{
              background: '#1E293B',
              border: '1px solid #38BDF8',
              color: '#38BDF8',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>📑</span>
            <span>Schedule</span>
          </button>

          {/* Insert Sheet Border & ISO Title Block Button */}
          <button
            type="button"
            onClick={onInsertTitleBlock}
            title="Fit ISO 5457 A1 Sheet Border & ISO 7200 Title Block with North Arrow (TITLEBLOCK / SHEET)"
            style={{
              background: '#1E293B',
              border: '1px solid #10B981',
              color: '#34D399',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🔲</span>
            <span>Title Block</span>
          </button>

          {/* Generate Structural Column Grid & Axis Bubbles */}
          <button
            type="button"
            onClick={onGenerateStructuralGrid}
            title="Auto-generate Reinforced Concrete Columns (300x300) and Structural Grid Axes (A, B, C... / 1, 2, 3...) (GRID / COLS)"
            style={{
              background: '#1E293B',
              border: '1px solid #F87171',
              color: '#FCA5A5',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🏛️</span>
            <span>Grid & Cols</span>
          </button>

          {/* Generate Automated Coordinated MEP Networks */}
          <button
            type="button"
            onClick={onGenerateAutomatedMep}
            title="Auto-route coordinated HVAC Supply Trunk & Diffusers and Domestic Cold Water & Drainage Networks (MEP / AUTODUCT)"
            style={{
              background: '#1E293B',
              border: '1px solid #FB923C',
              color: '#FDBA74',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>💨</span>
            <span>Auto MEP</span>
          </button>

          {/* Generate Automated Electrical Layout & Conduit Splines */}
          <button
            type="button"
            onClick={onGenerateAutomatedElectrical}
            title="Auto-wire CIBSE / IS 3646 compliant luminaires, switches, sockets, and curved conduit splines to Main DB (ELEC / AUTOWIRE)"
            style={{
              background: '#1E293B',
              border: '1px solid #F43F5E',
              color: '#FDA4AF',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>⚡</span>
            <span>Auto Elec</span>
          </button>

          {/* Multi-Discipline BIM Clash Detection Engine */}
          <button
            type="button"
            onClick={onRunClashDetection}
            title="Run Multi-Discipline BIM Clash Detection Matrix across Architecture, Structure & MEP (CLASH)"
            style={{
              background: '#1E293B',
              border: '1px solid #EF4444',
              color: '#FCA5A5',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>⚠️</span>
            <span>Clash Detect</span>
          </button>

          {/* Master Audit & Formal Submission Package */}
          <button
            type="button"
            onClick={onGenerateMasterAudit}
            title="Generate PhD Dissertation Grade Comprehensive Engineering Audit Dossier (.JSON / .CSV) (AUDIT)"
            style={{
              background: '#1E293B',
              border: '1px solid #A855F7',
              color: '#D8B4FE',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🎓</span>
            <span>Master Audit</span>
          </button>

          {/* Convert Linework to MEPlanIQ Solved Rooms */}
          <button
            type="button"
            onClick={onConvertToBim}
            disabled={isConverting}
            title="Detect closed wall loops and solve into MEPlanIQ Rooms + MEP layout"
            style={{
              backgroundColor: '#0284C7',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              fontWeight: 700,
              padding: '4px 14px',
              borderRadius: '4px',
              cursor: isConverting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>✨</span>
            <span>{isConverting ? 'Solving Topology...' : 'Convert Linework to Rooms'}</span>
          </button>

          <button
            type="button"
            onClick={onExportDxf}
            title="Export Direct AutoCAD DXF Linework"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#38BDF8',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            DXF
          </button>

          <button
            type="button"
            onClick={onExportSvg}
            title="Export Scalable Vector SVG"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#38BDF8',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            SVG
          </button>

          <button
            type="button"
            onClick={onExportAutoLisp}
            title="Export Autodesk AutoCAD AutoLISP (.lsp) Script"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#FCD34D',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            LSP
          </button>

          <button
            type="button"
            onClick={onExportIfc}
            title="Export Revit / OpenBIM IFC4 (.ifc) Model"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#A78BFA',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            IFC
          </button>

          <button
            type="button"
            onClick={onExportPng}
            title="Export High-Resolution PNG"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#38BDF8',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            PNG
          </button>

          <button
            type="button"
            onClick={onSaveProject}
            title="Save CAD Project"
            style={{
              background: '#16A34A',
              border: '1px solid #22C55E',
              color: 'white',
              fontWeight: 700,
              padding: '4px 14px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Ribbon Tool Panels */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: '#111827',
        minHeight: '84px',
        overflowX: 'auto'
      }}>
        {/* PANEL 1: DRAW TOOLS (9 Tools) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid #1F2937',
          paddingRight: '8px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
            {drawTools.map(t => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTool(t.id)}
                  title={`${t.label} (${t.shortcut}) - ${t.desc}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    background: isActive ? '#0284C7' : '#1F2937',
                    border: `1px solid ${isActive ? '#38BDF8' : '#374151'}`,
                    color: isActive ? '#FFFFFF' : '#D1D5DB',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    minWidth: '68px'
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
            Draw (Walls &amp; Openings)
          </div>
        </div>

        {/* PANEL 2: WALL SPEC */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid #1F2937',
          paddingRight: '8px',
          minWidth: '125px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>Thickness:</span>
              <select
                value={settings.wallThickness}
                onChange={(e) => onUpdateSetting('wallThickness', Number(e.target.value))}
                style={{ background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', fontSize: '11px', borderRadius: '3px', padding: '2px 4px' }}
              >
                <option value={100}>100 mm (Drywall)</option>
                <option value={150}>150 mm (Partition)</option>
                <option value={200}>200 mm (Load)</option>
                <option value={230}>230 mm (Brick 9")</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>Align:</span>
              <select
                value={settings.wallAlignment}
                onChange={(e) => onUpdateSetting('wallAlignment', e.target.value)}
                style={{ background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', fontSize: '11px', borderRadius: '3px', padding: '2px 4px' }}
              >
                <option value="center">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
            Wall Spec
          </div>
        </div>

        {/* PANEL 3: MODIFY TOOLS (10 Tools) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid #1F2937',
          paddingRight: '8px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
            {modifyTools.map(t => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTool(t.id)}
                  title={`${t.label} (${t.shortcut}) - ${t.desc}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    background: isActive ? '#0284C7' : '#1F2937',
                    border: `1px solid ${isActive ? '#38BDF8' : '#374151'}`,
                    color: isActive ? '#FFFFFF' : '#D1D5DB',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    minWidth: '66px'
                  }}
                >
                  <span style={{ fontSize: '12px' }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
            Modify Tools
          </div>
        </div>

        {/* PANEL 4: ANNOTATION & LIVE DIMS */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid #1F2937',
          paddingRight: '8px'
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onSelectTool('dimension')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                background: activeTool === 'dimension' ? '#0284C7' : '#1F2937',
                border: `1px solid ${activeTool === 'dimension' ? '#38BDF8' : '#374151'}`,
                color: activeTool === 'dimension' ? '#FFFFFF' : '#D1D5DB',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600
              }}
              title="Linear Dimension (DIM)"
            >
              <span>📏</span>
              <span>Dim</span>
            </button>
            <button
              type="button"
              onClick={onToggleWallDimensions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                background: showWallDimensions ? '#15803D' : '#1F2937',
                border: `1px solid ${showWallDimensions ? '#22C55E' : '#374151'}`,
                color: showWallDimensions ? '#FFFFFF' : '#D1D5DB',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600
              }}
              title="Toggle Live Wall Dimension Tags"
            >
              <span>📐</span>
              <span>Wall Dims</span>
            </button>
            <button
              type="button"
              onClick={onAutoDimensionAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                background: '#1E293B',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600
              }}
              title="Automatically Generate Perimeter Dimension Strings (AUTODIM)"
            >
              <span>⚡</span>
              <span>Auto Dim</span>
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
            Dimensions
          </div>
        </div>

        {/* PANEL 5: LAYERS */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: '160px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: activeLayer?.color || '#FFFFFF',
              boxShadow: '0 0 4px rgba(255,255,255,0.4)'
            }} />
            <select
              value={activeLayerId}
              onChange={(e) => onSelectLayer(e.target.value)}
              style={{
                flex: 1,
                background: '#1F2937',
                border: '1px solid #374151',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 4px',
                borderRadius: '4px'
              }}
            >
              {layers.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenLayerManager}
              title="Layer Properties Manager"
              style={{
                background: '#374151',
                border: '1px solid #4B5563',
                color: '#E5E7EB',
                padding: '3px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              ⚙️
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
            Layers
          </div>
        </div>
      </div>
    </header>
  );
}
