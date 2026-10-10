import pytest
from backend.models import PlumbingFixturePayload, PlumbingPipePayload
from backend.geometry import process_geometry_solve_v2, RoomPayload, SolveResponse

def test_plumbing_additive_integration():
    rooms = [
        RoomPayload(name="Bathroom", points=[[0,0], [3000,0], [3000,3000], [0,3000]])
    ]
    fixtures = [
        PlumbingFixturePayload(id="WC-1", type="WC", category="Bathroom", host_room_id="Bathroom", x=500, y=500)
    ]
    pipes = [
        PlumbingPipePayload(id="PIPE-1", type="Drainage Pipe", host_room_id="Bathroom", x=500, y=500, end_x=1000, end_y=1000, diameter=110.0)
    ]
    
    response = process_geometry_solve_v2(
        payload_or_rooms=rooms,
        plumbing_fixtures=fixtures,
        plumbing_pipes=pipes
    )
    
    assert isinstance(response, SolveResponse)
    assert len(response.plumbing_fixtures) == 1
    assert response.plumbing_fixtures[0].id == "WC-1"
    assert response.plumbing_fixtures[0].x == 500.0
    
    assert len(response.plumbing_pipes) >= 1
    assert response.plumbing_pipes[0].id == "PIPE-1"
    assert response.plumbing_pipes[0].diameter == 110.0
