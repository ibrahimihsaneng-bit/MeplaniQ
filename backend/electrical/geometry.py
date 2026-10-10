"""
backend/electrical/geometry.py
==============================
Spatial geometry utilities for the meplaniq Electrical Layout & Routing System.
Provides room containment tests, wall snapping, wall normal orientation,
and Manhattan path distance calculations.
"""

import math
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import Point, Polygon, LineString


def find_host_room(x: float, y: float, rooms: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Finds which room contains point (x, y).
    Returns the room dictionary or None if outside all rooms.
    """
    pt = Point(x, y)
    best_room = None
    min_dist = float("inf")

    for room in rooms:
        pts = room.get("points", [])
        if len(pts) >= 3:
            try:
                poly = Polygon(pts)
                if poly.is_valid and poly.contains(pt):
                    return room
                dist = poly.distance(pt)
                if dist < min_dist:
                    min_dist = dist
                    best_room = room
            except Exception:
                continue

    # If within 150mm of boundary, associate with nearest room
    if min_dist <= 150.0:
        return best_room
    return None


def snap_to_nearest_wall(
    x: float,
    y: float,
    rooms: List[Dict[str, Any]],
    max_snap_distance: float = 300.0,
    wall_offset_mm: float = 25.0
) -> Tuple[float, float, float, bool]:
    """
    Finds the closest wall segment from room polygons.
    If within max_snap_distance, snaps point to the wall with an inward offset.
    Returns: (snapped_x, snapped_y, normal_angle_deg, is_snapped)
    """
    pt = Point(x, y)
    best_dist = float("inf")
    best_proj = (x, y)
    best_angle = 0.0
    best_room_poly = None

    for room in rooms:
        pts = room.get("points", [])
        if len(pts) < 3:
            continue
        try:
            poly = Polygon(pts)
            if not poly.is_valid:
                poly = poly.buffer(0)
        except Exception:
            continue

        n = len(pts)
        for i in range(n):
            p1 = pts[i]
            p2 = pts[(i + 1) % n]
            line = LineString([p1, p2])
            dist = line.distance(pt)

            if dist < best_dist:
                best_dist = dist
                best_room_poly = poly
                # Projection onto segment
                proj_dist = line.project(pt)
                proj_pt = line.interpolate(proj_dist)
                best_proj = (proj_pt.x, proj_pt.y)

                # Segment angle
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                seg_angle = math.degrees(math.atan2(dy, dx))

                # Normal angles: perpendicular to segment
                normal_1 = (seg_angle + 90.0) % 360.0
                normal_2 = (seg_angle - 90.0) % 360.0

                # Test which normal points toward the interior of the room
                test_dist = 50.0
                test_pt_1 = Point(
                    proj_pt.x + test_dist * math.cos(math.radians(normal_1)),
                    proj_pt.y + test_dist * math.sin(math.radians(normal_1))
                )
                if poly.contains(test_pt_1):
                    best_angle = normal_1
                else:
                    best_angle = normal_2

    if best_dist <= max_snap_distance:
        # Slightly offset into room so symbol doesn't overlap wall line
        rad = math.radians(best_angle)
        snapped_x = round(best_proj[0] + wall_offset_mm * math.cos(rad), 1)
        snapped_y = round(best_proj[1] + wall_offset_mm * math.sin(rad), 1)
        return snapped_x, snapped_y, round(best_angle, 1), True

    return round(x, 1), round(y, 1), 0.0, False


def compute_manhattan_distance(pt1: List[float], pt2: List[float]) -> float:
    """Computes Manhattan distance |x1 - x2| + |y1 - y2|."""
    return round(abs(pt1[0] - pt2[0]) + abs(pt1[1] - pt2[1]), 1)


def compute_polyline_length(points: List[List[float]]) -> float:
    """Computes total length of a polyline given sequence of [x, y] coordinates."""
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(len(points) - 1):
        dx = points[i + 1][0] - points[i][0]
        dy = points[i + 1][1] - points[i][1]
        total += math.hypot(dx, dy)
    return round(total, 1)
