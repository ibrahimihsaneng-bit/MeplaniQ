
def test_end_to_end_step5_massive_project():
    from backend.geometry import RoomPayload, OpeningPayload, HVACEquipmentPayload, process_geometry_solve_v2
    from backend.dxf_exporter import export_floorplan_to_dxf

    # Create 13 rooms in a grid-like or complex layout
    rooms = []
    for i in range(3):
        for j in range(4):
            rooms.append(RoomPayload(
                name=f'Room_{i}_{j}',
                points=[
                    [i*3115.0, j*3115.0], 
                    [i*3115.0 + 3000.0, j*3115.0], 
                    [i*3115.0 + 3000.0, j*3115.0 + 3000.0], 
                    [i*3115.0, j*3115.0 + 3000.0]
                ]
            ))
    # Add Garage
    rooms.append(RoomPayload(
        name='Garage',
        points=[
            [-4115.0, 0.0],
            [-115.0, 0.0],
            [-115.0, 6115.0],
            [-4115.0, 6115.0]
        ]
    ))
    # Add Porch
    rooms.append(RoomPayload(
        name='Porch',
        points=[
            [0.0, -2115.0],
            [6115.0, -2115.0],
            [6115.0, -115.0],
            [0.0, -115.0]
        ]
    ))
    
    # Total rooms: 12 + 1 + 1 = 14 rooms
    
    openings = [
        OpeningPayload(id='D1', type='Door', host_room='Room_0_0', wall_side='Top', offset_mm=500.0, width_mm=900.0)
    ]
    
    hvac = [
        HVACEquipmentPayload(id='AC1', unit_type='Split-IDU', room_name='Room_0_0', location_x=1000.0, location_y=1000.0, cooling_capacity_tr=1.5)
    ]

    resp = process_geometry_solve_v2(rooms, openings, hvac)
    
    assert len(resp.rooms) == 14
    assert resp.total_carpet_area_sqm > 0
    assert resp.total_builtup_area_sqm > resp.total_carpet_area_sqm
    
    # Test DXF Export doesnt crash and generates a file
    dxf_bytes = export_floorplan_to_dxf(resp)
    assert len(dxf_bytes) > 1000, 'DXF file too small, likely empty'
    
    dxf_str = dxf_bytes.decode('utf-8')
    assert 'LAYER_ROOMS' in dxf_str
    assert 'LAYER_WALLS' in dxf_str
    assert 'LAYER_OPENINGS' in dxf_str
    assert 'LAYER_MEP' in dxf_str
