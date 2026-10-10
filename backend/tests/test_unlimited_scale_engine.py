import pytest
import time
from backend.geometry import RoomPayload, SpatialGraph, process_geometry_solve_v2

def test_spatial_graph_construction():
    rooms = [
        RoomPayload(name="Room 1", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Room 2", points=[[5000.0, 0.0], [10000.0, 0.0], [10000.0, 5000.0], [5000.0, 5000.0]]),
        RoomPayload(name="Room 3", points=[[0.0, 5000.0], [5000.0, 5000.0], [5000.0, 10000.0], [0.0, 10000.0]])
    ]
    graph = SpatialGraph(rooms, gap_mm=115.0)
    
    assert len(graph.nodes) == 3
    # 1->2 is X adjacency, 1->3 is Y adjacency
    assert len(graph.edges_x) == 1
    assert len(graph.edges_y) == 1
    
    assert graph.edges_x[0].from_node == 0
    assert graph.edges_x[0].to_node == 1
    assert graph.edges_x[0].weight == 115.0
    
    assert graph.edges_y[0].from_node == 0
    assert graph.edges_y[0].to_node == 2
    assert graph.edges_y[0].weight == 115.0
    
    topo_x = graph._topological_sort(graph.edges_x)
    assert topo_x.index(0) < topo_x.index(1)
    
    topo_y = graph._topological_sort(graph.edges_y)
    assert topo_y.index(0) < topo_y.index(2)


def test_scale_13_room_luxury_villa():
    rooms = []
    # Grid of 3x4 rooms (12 rooms) + 1 garage
    for i in range(3):
        for j in range(4):
            x = i * 4000.0
            y = j * 4000.0
            rooms.append(RoomPayload(
                name=f"Room_{i}_{j}",
                points=[[x, y], [x + 4000.0, y], [x + 4000.0, y + 4000.0], [x, y + 4000.0]]
            ))
    # Add Garage to the right of the top-right room
    rooms.append(RoomPayload(
        name="Garage",
        points=[[12000.0, 12000.0], [18000.0, 12000.0], [18000.0, 18000.0], [12000.0, 18000.0]]
    ))
    
    start_time = time.time()
    resp = process_geometry_solve_v2(rooms)
    duration = time.time() - start_time
    
    assert len(resp.rooms) == 13
    assert duration < 0.3, f"13 room solve took too long: {duration}s"
    
    # Check no overlap
    for i in range(len(resp.rooms)):
        min_xi = min(p[0] for p in resp.rooms[i].points)
        max_xi = max(p[0] for p in resp.rooms[i].points)
        min_yi = min(p[1] for p in resp.rooms[i].points)
        max_yi = max(p[1] for p in resp.rooms[i].points)
        
        for j in range(i + 1, len(resp.rooms)):
            min_xj = min(p[0] for p in resp.rooms[j].points)
            max_xj = max(p[0] for p in resp.rooms[j].points)
            min_yj = min(p[1] for p in resp.rooms[j].points)
            max_yj = max(p[1] for p in resp.rooms[j].points)
            
            # Check overlap logic
            # They must be separated by at least 114.9 if adjacent
            x_overlap = max(0, min(max_xi, max_xj) - max(min_xi, min_xj))
            y_overlap = max(0, min(max_yi, max_yj) - max(min_yi, min_yj))
            assert not (x_overlap > 1.0 and y_overlap > 1.0), f"Overlap between room {i} and {j}"

def test_scale_50_room_massive_campus():
    rooms = []
    # Grid of 5x10 rooms (50 rooms)
    for i in range(5):
        for j in range(10):
            x = i * 3000.0
            y = j * 3000.0
            rooms.append(RoomPayload(
                name=f"Unit_{i}_{j}",
                points=[[x, y], [x + 3000.0, y], [x + 3000.0, y + 3000.0], [x, y + 3000.0]]
            ))
            
    start_time = time.time()
    resp = process_geometry_solve_v2(rooms)
    duration = time.time() - start_time
    
    assert len(resp.rooms) == 50
    assert duration < 1.0, f"50 room solve took too long: {duration}s"

def test_external_wings_t_junctions():
    rooms = [
        RoomPayload(name="Living Room", points=[[0.0, 0.0], [5000.0, 0.0], [5000.0, 5000.0], [0.0, 5000.0]]),
        RoomPayload(name="Garage", points=[[5000.0, 1000.0], [9000.0, 1000.0], [9000.0, 4000.0], [5000.0, 4000.0]])
    ]
    graph = SpatialGraph(rooms)
    assert not graph.nodes[0].is_external_wing
    assert graph.nodes[1].is_external_wing
    
    resp = process_geometry_solve_v2(rooms)
    assert len(resp.rooms) == 2
    # The garage is shifted right by 115mm to form party wall
    g_minx = min(p[0] for p in resp.rooms[1].points)
    assert g_minx == 5115.0
