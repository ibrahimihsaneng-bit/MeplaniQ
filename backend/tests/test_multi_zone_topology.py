import pytest
import time
from backend.geometry import RoomPayload, SpatialGraph, process_geometry_solve_v2

def test_parent_container_enclosure():
    # A parent container that is 10000x10000
    # Two child rooms inside that overlap initially.
    rooms = [
        RoomPayload(name="Main Footprint", points=[[0.0, 0.0], [10000.0, 0.0], [10000.0, 10000.0], [0.0, 10000.0]]),
        RoomPayload(name="Room A", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Room B", points=[[4000.0, 0.0], [9000.0, 0.0], [9000.0, 5000.0], [4000.0, 5000.0]])
    ]
    # In normal solve, B would be pushed right by A + 115mm.
    # Its solved_x should become 5115.0
    # The parent Main Footprint should also be solved, but not pushed by A or B.
    # In fact, the parent might get expanded if B exceeded 10000, but here 5115+5000 = 10115, so B WILL exceed 10000.
    # So B's max X will be 10115. The container should either clamp B, or B is clamped.
    # In our logic, children are clamped to parent! So B's solved_x maxes out at parent.width - B.width = 10000 - 5000 = 5000.
    # Wait, if B is clamped to 5000, then it overlaps with A (A is 0 to 5000). But there's no 115mm gap.
    # This is a collision constraint! Let's see what happens.
    
    resp = process_geometry_solve_v2(rooms)
    
    # 2 carpet rooms should be returned (Main Footprint is filtered out from solid rendering!)
    # Actually, is it filtered from `resp.rooms`? Let's check:
    # No, we only filtered it from `shifted_shapely_polys`, so it should still be in `resp.rooms`?
    # Let's check `resp.rooms` length.
    assert len(resp.rooms) == 3
    
    footprint = next(r for r in resp.rooms if r.name == "Main Footprint")
    room_a = next(r for r in resp.rooms if r.name == "Room A")
    room_b = next(r for r in resp.rooms if r.name == "Room B")
    
    # B should be clamped to max X = 10000
    b_xs = [p[0] for p in room_b.points]
    assert max(b_xs) <= 10000.0
    
def test_asymmetric_wing_pushing():
    # A Garage to the right of the living room
    rooms = [
        RoomPayload(name="Living Room", points=[[5000.0, 0.0], [10000.0, 0.0], [10000.0, 5000.0], [5000.0, 5000.0]]),
        RoomPayload(name="Garage", points=[[9000.0, 1000.0], [14000.0, 1000.0], [14000.0, 4000.0], [9000.0, 4000.0]])
    ]
    graph = SpatialGraph(rooms)
    assert graph.nodes[1].is_external_wing
    
    # Wing pushes? No. The graph should have an edge Living -> Garage, but NOT Garage -> Living.
    # Wait, Garage minx = 9000, Living maxx = 10000. Overlap!
    # Because Living is left of Garage, Living -> Garage exists. Garage will be pushed to 10115.
    
    shifted, _ , _= graph.solve()
    living = shifted[0]
    garage = shifted[1]
    
    l_min_x = min(p[0] for p in living.points)
    g_min_x = min(p[0] for p in garage.points)
    
    assert l_min_x == 5000.0 # Living didn't move left!
    assert g_min_x == 10115.0 # Garage moved right!
