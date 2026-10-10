import pytest
from backend.geometry import process_geometry_solve_v2, RoomPayload, OpeningPayload, SolveRequest

def test_opening_auto_spacing():
    # 1 room, 3 doors on Top wall all clustered at 0 offset
    rooms = [
        RoomPayload(name="Room1", points=[[0,0], [6000,0], [6000,6000], [0,6000]])
    ]
    openings = [
        OpeningPayload(id="D1", host_room="Room1", wall_side="Top", type="Door", width_mm=900.0, offset_mm=0.0),
        OpeningPayload(id="D2", host_room="Room1", wall_side="Top", type="Door", width_mm=900.0, offset_mm=0.0),
        OpeningPayload(id="D3", host_room="Room1", wall_side="Top", type="Door", width_mm=900.0, offset_mm=0.0)
    ]
    
    req = SolveRequest(rooms=rooms, openings=openings)
    res = process_geometry_solve_v2(req)
    
    assert len(res.doors) == 3
    # Check effective offsets
    offsets = sorted([d.offset_mm for d in res.doors])
    
    # min clearance = 150
    # First door at 150
    assert offsets[0] == 150.0
    # Second door should be packed after first: 150 + 900 + 150 = 1200
    assert offsets[1] == 1200.0
    # Third door should be packed after second: 1200 + 900 + 150 = 2250
    assert offsets[2] == 2250.0

