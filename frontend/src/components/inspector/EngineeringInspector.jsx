import React, { useState, useMemo } from 'react';
import InspectorHeader from './InspectorHeader';
import InspectorSummary from './InspectorSummary';

/**
 * EngineeringInspector: Dedicated right-sidebar inspector housing the Project Summary
 * and contextual element property inspector when items are selected on canvas.
 * (Schedule table editing has been relocated to the bottom dock).
 */
export default function EngineeringInspector({
  solveData,
  editableDoors = [],
  editableWindows = [],
  editableHvac = [],
  editableFurniture = [],
  editablePlumbingFixtures = [],
  editablePlumbingPipes = [],
  editableElectricalComponents = [],
  editableElectricalCircuits = [],
  selectedElement,
  onSelectItem,
  onLiveItemUpdate,
  isCollapsed = false,
  onToggleCollapse,
  totalIssuesCount = 0,
  disciplineView = 'all',
  onOpenBoq,
  onExportPdf1,
  onExportPdf2,
  isExportingPdf1 = false,
  isExportingPdf2 = false
}) {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Derived dataset counts
  const rooms = solveData?.rooms || [];
  const doors = editableDoors.length > 0 ? editableDoors : (solveData?.doors || []);
  const windows = editableWindows.length > 0 ? editableWindows : (solveData?.windows || []);
  const hvac = editableHvac.length > 0 ? editableHvac : (solveData?.hvac_equipment || []);
  const furniture = editableFurniture.length > 0 ? editableFurniture : (solveData?.furniture || []);
  const fixtures = editablePlumbingFixtures.length > 0 ? editablePlumbingFixtures : (solveData?.plumbing_fixtures || []);
  const pipes = editablePlumbingPipes.length > 0 ? editablePlumbingPipes : (solveData?.plumbing_pipes || []);

  const totalOpeningsCount = doors.length + windows.length;
  const totalHvacTR = useMemo(() => {
    return hvac.reduce((acc, eq) => acc + (Number(eq.capacity_tr ?? eq.cooling_capacity_tr) || 0), 0);
  }, [hvac]);

  const totalCarpetAreaSqM = solveData?.total_carpet_area_sqm || rooms.reduce((acc, r) => acc + (r.carpet_area_sqm || 0), 0);
  const totalCarpetAreaSqFt = (totalCarpetAreaSqM * 10.7639).toFixed(0);

  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      className="cad-engineering-inspector flex h-full min-h-0 flex-col bg-[#111418] border-l border-[#2A3441] z-20 shrink-0"
      style={{
        width: '380px',
        maxWidth: '100vw',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111418',
        borderLeft: '1px solid #2A3441',
        zIndex: 20,
        flexShrink: 0,
        position: 'relative'
      }}
      aria-label="Engineering Inspector"
    >
      {/* 1. Header */}
      <InspectorHeader
        projectName={solveData?.project_name}
        selectedElement={selectedElement}
        onClearSelection={() => onSelectItem && onSelectItem(null)}
        onToggleCollapse={onToggleCollapse}
        disciplineView={disciplineView}
      />

      {/* 2. Project Summary (Carpet Area, Rooms/Zones, HVAC Cooling, Audit Status) */}
      <InspectorSummary
        totalCarpetAreaSqM={totalCarpetAreaSqM}
        totalCarpetAreaSqFt={totalCarpetAreaSqFt}
        roomsCount={rooms.length}
        openingsCount={totalOpeningsCount}
        totalHvacTR={totalHvacTR}
        hvacUnitsCount={hvac.length}
        totalIssuesCount={totalIssuesCount}
        isExpanded={isSummaryExpanded}
        onToggle={() => setIsSummaryExpanded(prev => !prev)}
        onOpenBoq={onOpenBoq}
        onExportPdf1={onExportPdf1}
        onExportPdf2={onExportPdf2}
        isExportingPdf1={isExportingPdf1}
        isExportingPdf2={isExportingPdf2}
      />

      {/* 3. Contextual Inspector (Shown when an element is selected on canvas) */}
      {selectedElement && (
        <div
          className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <ContextualElementInspector
            element={selectedElement}
            rooms={rooms}
            circuits={editableElectricalCircuits}
            hvacEquipment={hvac}
            onUpdate={onLiveItemUpdate}
            onClear={() => onSelectItem && onSelectItem(null)}
          />
        </div>
      )}
    </aside>
  );
}

function ContextualElementInspector({ element, rooms, circuits = [], hvacEquipment = [], onUpdate, onClear }) {
  const item = element.item || {};
  const type = element.type;

  const [x, setX] = useState(String(Math.round(item.x ?? item.location_x ?? 0)));
  const [y, setY] = useState(String(Math.round(item.y ?? item.location_y ?? 0)));
  const [width, setWidth] = useState(String(Math.round(item.width ?? item.width_mm ?? 1000)));
  const [height, setHeight] = useState(String(Math.round(item.height ?? item.height_mm ?? 600)));
  const [rotation, setRotation] = useState(Number(item.rotation ?? item.rotation_deg ?? 0) % 360);
  const [swing, setSwing] = useState(item.swing || 'Inward-Right');
  const [capTr, setCapTr] = useState(String(item.capacity_tr ?? item.cooling_capacity_tr ?? 1.5));
  const [wattage, setWattage] = useState(String(item.wattage ?? 15));
  const [circuitId, setCircuitId] = useState(item.circuit_id || '');
  const [linkedHvacId, setLinkedHvacId] = useState(item.linked_hvac_id || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    if (!onUpdate) return;
    const numX = Math.round(Number(x) || 0);
    const numY = Math.round(Number(y) || 0);
    const numW = Math.max(100, Number(width) || 1000);
    const numH = Math.max(100, Number(height) || 600);

    const updates = {
      x: numX,
      y: numY,
      location_x: numX,
      location_y: numY,
      width: numW,
      width_mm: numW,
      height: numH,
      height_mm: numH,
      rotation: rotation % 360,
      rotation_deg: rotation % 360,
      swing,
      capacity_tr: Number(capTr) || 1.5,
      cooling_capacity_tr: Number(capTr) || 1.5
    };

    if (type === 'Furniture') onUpdate('Furniture', item.id, updates);
    else if (type === 'HVAC') onUpdate('HVAC', item.id, updates);
    else if (type === 'Door') onUpdate('Door', item.id, updates);
    else if (type === 'Window') onUpdate('Window', item.id, updates);
    else if (type === 'PlumbingFixture') onUpdate('UpdatePlumbingFixture', item.id, updates);
    else if (type === 'ElectricalComponent' || type === 'Electrical') {
      onUpdate('UpdateElectricalComponent', item.id, {
        ...updates,
        wattage: Number(wattage) || 0,
        circuit_id: circuitId || null,
        linked_hvac_id: linkedHvacId || null
      });
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleRotate90 = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    const key = item.rotation_deg !== undefined ? 'rotation_deg' : 'rotation';
    if (type === 'Furniture') onUpdate('Furniture', item.id, { [key]: nextRot });
    else if (type === 'HVAC') onUpdate('HVAC', item.id, { [key]: nextRot });
    else if (type === 'PlumbingFixture') onUpdate('UpdatePlumbingFixture', item.id, { [key]: nextRot });
    else if (type === 'ElectricalComponent' || type === 'Electrical') {
      onUpdate('UpdateElectricalComponent', item.id, { rotation: nextRot });
    }
  };

  const handleDelete = () => {
    onClear();
    if (type === 'Furniture') onUpdate('DeleteFurniture', item.id);
    else if (type === 'HVAC') onUpdate('DeleteHVAC', item.id);
    else if (type === 'Door' || type === 'Window') onUpdate('DeleteOpening', item.id);
    else if (type === 'PlumbingFixture') onUpdate('DeletePlumbingFixture', item.id);
    else if (type === 'ElectricalComponent' || type === 'Electrical') {
      onUpdate('DeleteElectricalComponent', item.id);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#18202F',
        border: '1px solid #38BDF8',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 14px rgba(56, 189, 248, 0.15)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            {item.id || item.name}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
            {type} Inspector
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer' }}
          title="Deselect element"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
        Host: <strong style={{ color: '#F8FAFC' }}>{item.host_room || item.host_room_id || item.room_name || 'Root Floorplan'}</strong>
      </div>

      {/* Coordinates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>X Coordinate</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={x}
              onChange={e => setX(e.target.value)}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Y Coordinate</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={y}
              onChange={e => setY(e.target.value)}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Width</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={width}
              onChange={e => setWidth(e.target.value)}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Length / Height</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              step="50"
              style={inputStyle}
            />
            <span style={unitStyle}>mm</span>
          </div>
        </div>
      </div>

      {/* Rotation / Swing / Capacity */}
      {(type === 'Furniture' || type === 'PlumbingFixture' || type === 'HVAC' || type === 'ElectricalComponent' || type === 'Electrical') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111418', padding: '8px 10px', borderRadius: '6px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Rotation: </span>
            <strong style={{ fontSize: '12px', color: '#F8FAFC' }}>{rotation}°</strong>
          </div>
          <button
            type="button"
            onClick={handleRotate90}
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38BDF8',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⟳ Rotate 90°
          </button>
        </div>
      )}

      {type === 'Door' && (
        <div>
          <label style={labelStyle}>Door Swing Direction</label>
          <select
            value={swing}
            onChange={e => setSwing(e.target.value)}
            style={selectStyle}
          >
            <option value="Inward-Right">Inward-Right</option>
            <option value="Inward-Left">Inward-Left</option>
            <option value="Outward-Right">Outward-Right</option>
            <option value="Outward-Left">Outward-Left</option>
          </select>
        </div>
      )}

      {type === 'HVAC' && (
        <div>
          <label style={labelStyle}>Cooling Capacity</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={capTr}
              onChange={e => setCapTr(e.target.value)}
              step="0.5"
              min="0.5"
              style={inputStyle}
            />
            <span style={unitStyle}>TR</span>
          </div>
        </div>
      )}

      {(type === 'ElectricalComponent' || type === 'Electrical') && (
        <>
          <div>
            <label style={labelStyle}>Fixture Type / Mounting</label>
            <div style={{ fontSize: '12px', color: '#FDE047', fontWeight: 600 }}>
              {item.name || item.type} ({item.mounting || 'ceiling'})
            </div>
          </div>
          <div>
            <label style={labelStyle}>Wattage Rating</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={wattage}
                onChange={e => setWattage(e.target.value)}
                step="1"
                min="0"
                style={inputStyle}
              />
              <span style={unitStyle}>W</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assigned Circuit</label>
            <select
              value={circuitId}
              onChange={e => setCircuitId(e.target.value)}
              style={selectStyle}
            >
              <option value="">(None / Unassigned)</option>
              {circuits.map(c => (
                <option key={c.id} value={c.id}>{c.id}: {c.name}</option>
              ))}
            </select>
          </div>
          {item.type === 'ac_isolator_20a' && (
            <div>
              <label style={labelStyle}>Linked HVAC Unit</label>
              <select
                value={linkedHvacId}
                onChange={e => setLinkedHvacId(e.target.value)}
                style={selectStyle}
              >
                <option value="">(Select AC)</option>
                {hvacEquipment.map(h => (
                  <option key={h.id} value={h.id}>{h.id} ({h.type || 'AC'})</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #242E3D' }}>
        <span style={{ fontSize: '11px', color: isSaved ? '#10B981' : '#64748B', fontWeight: isSaved ? 600 : 400 }}>
          {isSaved ? '✓ Saved to canvas' : `Live editing`}
        </span>

        {isDeleting ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>Delete?</span>
            <button
              type="button"
              onClick={() => setIsDeleting(false)}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              style={{ ...primaryBtnStyle, backgroundColor: '#EF4444' }}
            >
              Confirm
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSave}
              style={primaryBtnStyle}
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              style={dangerOutlineBtnStyle}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#94A3B8',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  minHeight: '36px',
  backgroundColor: '#0B0F19',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 28px 6px 10px',
  fontSize: '12px',
  color: '#F8FAFC',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace"
};

const selectStyle = {
  width: '100%',
  minHeight: '36px',
  backgroundColor: '#0B0F19',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '12px',
  color: '#F8FAFC',
  outline: 'none',
  boxSizing: 'border-box'
};

const unitStyle = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '10.5px',
  color: '#64748B',
  pointerEvents: 'none',
  fontWeight: 600
};

const primaryBtnStyle = {
  minHeight: '36px',
  padding: '0 16px',
  backgroundColor: '#2F80ED',
  border: 'none',
  borderRadius: '6px',
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s ease'
};

const secondaryBtnStyle = {
  minHeight: '36px',
  padding: '0 12px',
  backgroundColor: 'transparent',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#94A3B8',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const dangerOutlineBtnStyle = {
  minHeight: '36px',
  padding: '0 14px',
  backgroundColor: 'transparent',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  borderRadius: '6px',
  color: '#F87171',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease'
};
