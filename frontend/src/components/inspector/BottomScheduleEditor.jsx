import React from 'react';
import ScheduleNavigation from './ScheduleNavigation';
import RoomTable from '../../RoomTable';
import OpeningsTable from '../../OpeningsTable';
import HVACTable from '../../HVACTable';
import FurnitureTable from '../../FurnitureTable';
import PlumbingTable from '../../PlumbingTable';
import ElectricalTable from '../../features/electrical/ElectricalTable';
import AutomationHub from '../../features/automation/AutomationHub';
import BoqScheduleTable from '../../features/boq/BoqScheduleTable';

/**
 * BottomScheduleEditor: Docked horizontal schedule editor positioned underneath
 * the CAD Canvas, providing generous horizontal space for table editing across
 * Rooms, Openings, HVAC, Furniture, Plumbing, Electrical, Automation Hub, and BOQ.
 */
export default function BottomScheduleEditor({
  solveData,
  editableDoors = [],
  editableWindows = [],
  editableHvac = [],
  editableFurniture = [],
  editablePlumbingFixtures = [],
  editablePlumbingPipes = [],
  editableElectricalComponents = [],
  editableElectricalCircuits = [],
  editableElectricalRoutes = [],
  selectedElement,
  onSelectItem,
  onLiveItemUpdate,
  activeTab = 'rooms',
  setActiveTab,
  isCollapsed = false,
  onToggleCollapse,
  isExpanded = false,
  onToggleExpand,
  disciplineView = 'all',
  onAutoPopulateMep,
  onSwitchVariant,
  currentVariant = 0,
  isPopulatingMep = false,
  isSwitchingVariant = false,
  boqData = null,
  activeQualityTier = "medium",
  onSwitchTier,
  onOpenBoq,
  onExportPdf1,
  onExportPdf2,
  isRecalculating = false,
  isExportingPdf1 = false,
  isExportingPdf2 = false
}) {
  const rooms = solveData?.rooms || [];
  const doors = editableDoors.length > 0 ? editableDoors : (solveData?.doors || []);
  const windows = editableWindows.length > 0 ? editableWindows : (solveData?.windows || []);
  const hvac = editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []);
  const furniture = editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || []);
  const fixtures = editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || []);
  const pipes = editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || []);

  const totalOpeningsCount = doors.length + windows.length;

  const scheduleCounts = {
    rooms: rooms.length,
    openings: totalOpeningsCount,
    hvac: hvac.length,
    furniture: furniture.length,
    plumbing: fixtures.length + pipes.length,
    electrical: (editableElectricalComponents?.length || 0) + (editableElectricalCircuits?.length || 0),
    automation: '⚡',
    boq: boqData ? `${boqData.quality_tier?.slice(0, 3).toUpperCase() || 'BOQ'}` : 'BOQ'
  };

  return (
    <aside
      className={`cad-bottom-inspector ${isCollapsed ? 'collapsed' : ''} ${isExpanded ? 'expanded' : ''}`}
      style={{
        backgroundColor: '#111418',
        borderTop: '1px solid #2A3441',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 25,
        flexShrink: 0,
        height: isCollapsed ? '40px' : isExpanded ? '440px' : '280px',
        transition: 'height 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        position: 'relative',
        width: '100%'
      }}
      aria-label="Engineering Schedules Dock"
    >
      {/* Dock Header with Tabs on Left and Expand/Collapse on Right */}
      <div
        className="bottom-inspector-header"
        onClick={() => {
          if (isCollapsed && onToggleCollapse) {
            onToggleCollapse();
          }
        }}
        style={{
          height: '40px',
          minHeight: '40px',
          padding: '0 12px',
          backgroundColor: '#151A20',
          borderBottom: '1px solid #2A3441',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          userSelect: 'none',
          cursor: isCollapsed ? 'pointer' : 'default'
        }}
      >
        {/* Left Side: Schedule Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflowX: 'auto' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94A3B8',
              whiteSpace: 'nowrap',
              marginRight: '4px'
            }}
          >
            Schedules:
          </span>
          <ScheduleNavigation
            activeTab={activeTab}
            disciplineView={disciplineView}
            onTabChange={(tabId) => {
              if (isCollapsed && onToggleCollapse) {
                onToggleCollapse();
              }
              setActiveTab && setActiveTab(tabId);
            }}
            counts={scheduleCounts}
          />
        </div>

        {/* Right Side: PDF Exports & Expand / Collapse Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Quick PDF 1: Quantities Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExportPdf1 && onExportPdf1();
            }}
            disabled={isExportingPdf1}
            style={{
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              border: '1px solid #38BDF8',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: isExportingPdf1 ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 1px 4px rgba(2, 132, 199, 0.3)'
            }}
            title="Download PDF 1: Building Spatial Quantities & Engineering Schedules Report"
          >
            <span>{isExportingPdf1 ? 'Exporting...' : '📄 PDF: Quantities'}</span>
          </button>

          {/* Quick PDF 2: Cost & BOQ Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExportPdf2 && onExportPdf2();
            }}
            disabled={isExportingPdf2}
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              border: '1px solid #F87171',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: isExportingPdf2 ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 1px 4px rgba(220, 38, 38, 0.3)'
            }}
            title="Download PDF 2: Material Quantities, Construction Timeline & Cost Estimation Report"
          >
            <span>{isExportingPdf2 ? 'Exporting...' : '📑 PDF: BOQ Cost'}</span>
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#2A3441', margin: '0 2px' }} />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand && onToggleExpand();
            }}
            style={{
              background: isExpanded && !isCollapsed ? 'rgba(47, 128, 237, 0.15)' : 'transparent',
              border: '1px solid #2A3441',
              color: isExpanded && !isCollapsed ? '#38BDF8' : '#94A3B8',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={isExpanded ? "Compact Height (280px)" : "Expand Height (440px)"}
          >
            <span>{isExpanded ? '⤡ Compact' : '⤢ Expand'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse && onToggleCollapse();
            }}
            style={{
              background: isCollapsed ? 'rgba(47, 128, 237, 0.15)' : 'transparent',
              border: '1px solid #2A3441',
              color: isCollapsed ? '#38BDF8' : '#94A3B8',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={isCollapsed ? "Open Schedules" : "Collapse Schedules"}
          >
            <span>{isCollapsed ? '▲ Open Schedules' : '▼ Collapse'}</span>
          </button>
        </div>
      </div>

      {/* Dock Content Body: Active Schedule Table */}
      <div
        className="bottom-inspector-content"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'auto',
          display: isCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          backgroundColor: '#0F172A',
          padding: '8px 14px'
        }}
      >
        {activeTab === 'rooms' && (
          <RoomTable
            rooms={rooms}
            onUpdateRoom={onLiveItemUpdate}
          />
        )}

        {activeTab === 'openings' && (
          <OpeningsTable
            rooms={rooms}
            doors={doors}
            windows={windows}
            onUpdateOpening={onLiveItemUpdate}
          />
        )}

        {activeTab === 'hvac' && (
          <HVACTable
            rooms={rooms}
            loads={solveData?.hvac_loads || []}
            equipment={hvac}
            pipes={solveData?.hvac_pipes || []}
            onUpdateEquipment={onLiveItemUpdate}
          />
        )}

        {activeTab === 'furniture' && (
          <FurnitureTable
            rooms={rooms}
            furniture={furniture}
            onUpdateFurniture={onLiveItemUpdate}
          />
        )}

        {activeTab === 'plumbing' && (
          <PlumbingTable
            rooms={rooms}
            plumbingFixtures={fixtures}
            plumbingPipes={pipes}
            onAddFixture={(updates) => onLiveItemUpdate('AddPlumbingFixture', null, updates)}
            onUpdateFixture={(id, updates) => onLiveItemUpdate('UpdatePlumbingFixture', id, updates)}
            onDeleteFixture={(id) => onLiveItemUpdate('DeletePlumbingFixture', id, null)}
            onAddPipe={(updates) => onLiveItemUpdate('AddPlumbingPipe', null, updates)}
            onUpdatePipe={(id, updates) => onLiveItemUpdate('UpdatePlumbingPipe', id, updates)}
            onDeletePipe={(id) => onLiveItemUpdate('DeletePlumbingPipe', id, null)}
          />
        )}

        {activeTab === 'electrical' && (
          <ElectricalTable
            rooms={rooms}
            electricalComponents={editableElectricalComponents}
            electricalCircuits={editableElectricalCircuits}
            electricalRoutes={editableElectricalRoutes}
            hvacEquipment={hvac}
            onAddComponent={(compData) => onLiveItemUpdate('AddElectricalComponent', null, compData)}
            onUpdateComponent={(id, updates) => onLiveItemUpdate('UpdateElectricalComponent', id, updates)}
            onDeleteComponent={(id) => onLiveItemUpdate('DeleteElectricalComponent', id, null)}
            onAddCircuit={(cktData) => onLiveItemUpdate('AddElectricalCircuit', null, cktData)}
            onUpdateCircuit={(id, updates) => onLiveItemUpdate('UpdateElectricalCircuit', id, updates)}
            onDeleteCircuit={(id) => onLiveItemUpdate('DeleteElectricalCircuit', id, null)}
            onAddRoute={(routeData) => onLiveItemUpdate('AddElectricalRoute', null, routeData)}
            onDeleteRoute={(id) => onLiveItemUpdate('DeleteElectricalRoute', id, null)}
            onAutoRoute={() => onLiveItemUpdate('AutoRouteElectrical', null, null)}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationHub
            solveData={solveData}
            editableElectricalComponents={editableElectricalComponents}
            editableElectricalCircuits={editableElectricalCircuits}
            editableElectricalRoutes={editableElectricalRoutes}
            editablePlumbingFixtures={fixtures}
            editablePlumbingPipes={pipes}
            editableHvac={hvac}
            editableFurniture={furniture}
            onAutoPopulateMep={onAutoPopulateMep}
            onAutoRouteElectrical={() => onLiveItemUpdate('AutoRouteElectrical', null, null)}
            onAutoRoutePlumbing={() => onLiveItemUpdate('AutoRoutePlumbing', null, null)}
            onSwitchVariant={onSwitchVariant}
            currentVariant={currentVariant}
            isPopulating={isPopulatingMep}
            isSwitchingVariant={isSwitchingVariant}
          />
        )}

        {activeTab === 'boq' && (
          <BoqScheduleTable
            boqData={boqData}
            activeTier={activeQualityTier}
            onSwitchTier={onSwitchTier}
            onOpenDashboard={onOpenBoq}
            onExportPdf1={onExportPdf1}
            onExportPdf2={onExportPdf2}
            isRecalculating={isRecalculating}
            isExportingPdf1={isExportingPdf1}
            isExportingPdf2={isExportingPdf2}
          />
        )}
      </div>
    </aside>
  );
}
