from typing import List, Dict, Any, Optional
from backend.models import PlumbingPipePayload, PlumbingFixturePayload


def auto_route_plumbing(
    fixtures: List[PlumbingFixturePayload],
    pipes: List[PlumbingPipePayload],
    rooms: List[Any],
):
    """
    Automated dual-line MEP router for plumbing fixtures and unified trunk network.

    Per fixture:
      - Provisions 1 Water Supply Pipe (20mm, cyan #00BFFF) if missing
      - Provisions 1 Drainage Pipe (dynamic diam, green #2ECC71) if missing

    After per-fixture provisioning:
      - Interconnects main horizontal and vertical trunk lines across different
        rooms (Kitchen, Utility, Bathroom) into a single, continuous, unified
        network layout with zero visual gaps.
      - Provisions vertical main trunk risers/stacks (e.g. WTR-MAIN, DRN-MAIN)
        along common plumbing walls and extends horizontal room pipes to intersect
        the vertical trunks directly.

    Designated Color Map:
      Water Supply Pipe → #00BFFF (Cyan / Light Blue)
      Drainage Pipe     → #2ECC71 (Green)
      Floor Trap        → #FFA500 (Orange)
      Vent Pipe         → #9B59B6 (Purple)
    """
    if not fixtures and not pipes:
        return

    # ── Room bound lookup ─────────────────────────────────────────────────────
    room_bounds: Dict[str, Dict[str, float]] = {}
    for r in rooms:
        pts = getattr(r, "points", None)
        if not pts:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        r_name = (getattr(r, "name", "") or "").lower().strip()
        room_bounds[r_name] = {
            "min_x": min(xs),
            "max_x": max(xs),
            "min_y": min(ys),
            "max_y": max(ys),
        }

    existing_ids = {p.id for p in pipes if p.id}

    # ── Per-fixture provisioning ───────────────────────────────────────────────
    for f in fixtures:
        hr_name = f.host_room_id or (rooms[0].name if rooms else "Room")
        hr_key = hr_name.lower().strip()
        bounds = room_bounds.get(hr_key)
        if not bounds:
            bounds = next(iter(room_bounds.values())) if room_bounds else {
                "min_x": 0.0, "max_x": 3000.0, "min_y": 0.0, "max_y": 3000.0,
            }

        # 1. Water Supply Pipe
        supply_pipe = None
        if f.supplyPipeId and f.supplyPipeId in existing_ids:
            supply_pipe = next((p for p in pipes if p.id == f.supplyPipeId), None)
        if not supply_pipe:
            supply_pipe = next(
                (p for p in pipes
                 if (p.host_room_id or "").lower().strip() == hr_key
                 and ("supply" in (p.type or "").lower() or "wtr" in (p.id or "").lower())
                 and "main" not in (p.id or "").lower()),
                None,
            )
        if not supply_pipe:
            count = len([p for p in pipes if "wtr" in (p.id or "").lower()]) + 1
            pid = f"WTR-{count}"
            while pid in existing_ids:
                count += 1
                pid = f"WTR-{count}"
            p_y = bounds["min_y"] + 40.0
            supply_pipe = PlumbingPipePayload(
                id=pid,
                type="Water Supply Pipe",
                host_room_id=hr_name,
                diameter=20.0,
                x=bounds["min_x"],
                y=p_y,
                end_x=bounds["max_x"],
                end_y=p_y,
                path=[[bounds["min_x"], p_y], [bounds["max_x"], p_y]],
                connected_to=f.id or "",
                clearance_status="OK",
            )
            pipes.append(supply_pipe)
            existing_ids.add(pid)
        f.supplyPipeId = supply_pipe.id

        # 2. Drainage / Waste Pipe
        drain_pipe = None
        if f.drainagePipeId and f.drainagePipeId in existing_ids:
            drain_pipe = next((p for p in pipes if p.id == f.drainagePipeId), None)
        if not drain_pipe:
            drain_pipe = next(
                (p for p in pipes
                 if (p.host_room_id or "").lower().strip() == hr_key
                 and ("drain" in (p.type or "").lower()
                      or "waste" in (p.type or "").lower()
                      or "drn" in (p.id or "").lower())
                 and "main" not in (p.id or "").lower()),
                None,
            )
        if not drain_pipe:
            count = len([p for p in pipes if "drn" in (p.id or "").lower()]) + 1
            pid = f"DRN-{count}"
            while pid in existing_ids:
                count += 1
                pid = f"DRN-{count}"

            f_type = (f.type or "").lower()
            if any(k in f_type for k in ("basin", "bidet", "lavatory")):
                diam = 40.0
            elif any(k in f_type for k in ("sink", "shower", "washing", "dish")):
                diam = 50.0
            elif "bath" in f_type:
                diam = 75.0
            else:
                diam = 110.0  # WC / standard soil pipe

            p_y = bounds["min_y"] + 100.0
            drain_pipe = PlumbingPipePayload(
                id=pid,
                type="Drainage Pipe",
                host_room_id=hr_name,
                diameter=diam,
                x=bounds["min_x"],
                y=p_y,
                end_x=bounds["max_x"],
                end_y=p_y,
                path=[[bounds["min_x"], p_y], [bounds["max_x"], p_y]],
                connected_to=f.id or "",
                clearance_status="OK",
            )
            pipes.append(drain_pipe)
            existing_ids.add(pid)
        f.drainagePipeId = drain_pipe.id

    # ── Inter-room trunk join pass: Horizontal & Vertical Interconnection ──────
    def _get_pipe_bounds(p: PlumbingPipePayload):
        if p.path and len(p.path) >= 2:
            x1, y1 = float(p.path[0][0]), float(p.path[0][1])
            x2, y2 = float(p.path[-1][0]), float(p.path[-1][1])
        else:
            x1, y1 = float(p.x or 0), float(p.y or 0)
            x2 = float(p.end_x or (p.x or 0) + 1000)
            y2 = float(p.end_y or p.y or 0)
        return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)

    # Classify pipes by system type
    systems: Dict[str, List[PlumbingPipePayload]] = {
        "supply": [],
        "drain": [],
        "vent": [],
        "trap": []
    }
    for p in pipes:
        t = (p.type or "").lower()
        if "supply" in t:
            systems["supply"].append(p)
        elif "drain" in t or "waste" in t:
            systems["drain"].append(p)
        elif "vent" in t:
            systems["vent"].append(p)
        elif "trap" in t:
            systems["trap"].append(p)

    # For supply and drain systems: interconnect horizontal and vertical main trunks
    for sys_name, sys_pipes in [("supply", systems["supply"]), ("drain", systems["drain"])]:
        if len(sys_pipes) < 2:
            continue

        # Separate existing vertical mains from horizontal branch pipes
        horizontal_pipes = []
        vertical_mains = []
        for p in sys_pipes:
            min_x, min_y, max_x, max_y = _get_pipe_bounds(p)
            dx = max_x - min_x
            dy = max_y - min_y
            if dy > dx * 1.5:
                vertical_mains.append(p)
            else:
                horizontal_pipes.append(p)

        if not horizontal_pipes:
            continue

        # Find the common vertical riser X coordinate:
        # Default for project layout: X=3900 for supply, X=3950 for drainage (along shared Kitchen/Utility/Bathroom boundary)
        if sys_name == "supply":
            riser_x = 3900.0
            main_id = "WTR-MAIN"
            main_type = "Water Supply Pipe"
            main_diam = 32.0
            connected_target = "City Water Main"
        else:
            riser_x = 3950.0
            main_id = "DRN-MAIN"
            main_type = "Drainage Pipe"
            main_diam = 110.0
            connected_target = "Building Sewer Main"

        # Trim every horizontal pipe to terminate precisely at the final fixture connection point
        h_ys = []
        for p in horizontal_pipes:
            min_x, min_y, max_x, max_y = _get_pipe_bounds(p)
            mid_y = (min_y + max_y) / 2.0
            h_ys.append(mid_y)

            # Find all fixtures connected to this pipe to determine exact trimming boundaries
            p_room = (p.host_room_id or "").lower().strip()
            connected_fixs = [
                f for f in fixtures 
                if f.supplyPipeId == p.id 
                or f.drainagePipeId == p.id 
                or p.connected_to == f.id
                or ((f.host_room_id or "").lower().strip() == p_room 
                    and ((sys_name == "supply" and ("supply" in (p.type or "").lower() or (p.id or "").startswith("WTR")))
                         or (sys_name == "drainage" and ("drain" in (p.type or "").lower() or (p.id or "").startswith("DRN")))))
            ]
            target_xs = []
            for f in connected_fixs:
                import math
                fw = float(f.width or 600.0)
                fh = float(f.height or 500.0)
                fx = float(f.x or 0.0)
                fy = float(f.y or 0.0)
                rot = float(f.rotation or 0.0)
                rot_rad = math.radians((rot % 360 + 360) % 360)
                cos_r = math.cos(rot_rad)
                sin_r = math.sin(rot_rad)

                if sys_name == "supply":
                    rel_x = -fw * 0.28
                    rel_y = -fh * 0.38
                else:
                    rel_x = fw * 0.28
                    rel_y = -fh * 0.38

                port_x = fx + (rel_x * cos_r - rel_y * sin_r)
                port_y = fy + (rel_x * sin_r + rel_y * cos_r)

                # The 4 Deterministic Routing States for horizontal trunk landing X:
                # State 1: Direct Connection (0°)
                # State 2: L-Shape Variation (90°)
                # State 3: L-Shape Variation (270°)
                # State 4: U-Shape Back-Routing (180°)
                norm_rot = int(round(rot)) % 360
                if 45 <= norm_rot < 135:
                    rot_state = 2  # State 2: 90°
                elif 135 <= norm_rot < 225:
                    rot_state = 4  # State 4: 180°
                elif 225 <= norm_rot < 315:
                    rot_state = 3  # State 3: 270°
                else:
                    rot_state = 1  # State 1: 0°

                abs_cos_r = abs(cos_r)
                abs_sin_r = abs(sin_r)
                half_w = fw / 2.0
                half_h = fh / 2.0
                bound_dx = half_w * abs_cos_r + half_h * abs_sin_r
                min_fx = fx - bound_dx
                max_fx = fx + bound_dx

                pipe_min_x = min(p.path[0][0], p.path[1][0]) if p.path and len(p.path) >= 2 else min_x
                pipe_max_x = max(p.path[0][0], p.path[1][0]) if p.path and len(p.path) >= 2 else max_x
                pipe_mid_x = (pipe_min_x + pipe_max_x) / 2.0
                wrap_left = fx >= pipe_mid_x

                is_trunk_below = mid_y < fy
                if is_trunk_below:
                    if rot_state == 1:
                        # State 1: Direct Connection (0°)
                        landing_x = port_x
                    elif rot_state == 2:
                        # State 2: L-Shape (90°)
                        landing_x = max_fx + (70.0 if sys_name == "supply" else 140.0)
                    elif rot_state == 3:
                        # State 3: L-Shape (270°)
                        landing_x = min_fx - (140.0 if sys_name == "supply" else 70.0)
                    else:
                        # State 4: Synchronized Parallel U-Shape (180°)
                        if wrap_left:
                            landing_x = min_fx - (130.0 if sys_name == "supply" else 60.0)
                        else:
                            landing_x = max_fx + (60.0 if sys_name == "supply" else 130.0)
                else:
                    if rot_state == 4:
                        landing_x = port_x
                    elif rot_state == 2:
                        landing_x = max_fx + (140.0 if sys_name == "supply" else 70.0)
                    elif rot_state == 3:
                        landing_x = min_fx - (70.0 if sys_name == "supply" else 140.0)
                    else:
                        # State 1: 0° with trunk above
                        if wrap_left:
                            landing_x = min_fx - (60.0 if sys_name == "supply" else 130.0)
                        else:
                            landing_x = max_fx + (130.0 if sys_name == "supply" else 60.0)

                target_xs.append(landing_x)

            if target_xs:
                if riser_x <= min(target_xs):
                    # Pipe is to the right of riser (e.g. Bathroom):
                    # Starts at riser_x and stops precisely at the final fixture landing X
                    new_min_x = riser_x
                    new_max_x = max(target_xs)
                elif riser_x >= max(target_xs):
                    # Pipe is to the left of riser (e.g. Kitchen, Utility):
                    # Starts at the final fixture landing X and stops precisely at riser_x
                    new_min_x = min(target_xs)
                    new_max_x = riser_x
                else:
                    new_min_x = min(min(target_xs), riser_x)
                    new_max_x = max(max(target_xs), riser_x)
            else:
                # Fallback if no fixtures assigned yet
                new_min_x = min_x
                new_max_x = max_x
                if max_x < riser_x:
                    new_max_x = riser_x
                elif min_x > riser_x:
                    new_min_x = riser_x

            p.x = new_min_x
            p.y = mid_y
            p.end_x = new_max_x
            p.end_y = mid_y
            p.path = [[new_min_x, mid_y], [new_max_x, mid_y]]
            if not p.connected_to or p.connected_to.startswith("PLM"):
                p.connected_to = main_id

        # Ensure a main vertical trunk pipe exists intersecting all horizontal branches
        min_trunk_y = min(h_ys) if h_ys else 4100.0
        max_trunk_y = max(h_ys) if h_ys else 8100.0

        existing_main = next((p for p in vertical_mains if p.id == main_id), None)
        if existing_main:
            existing_main.x = riser_x
            existing_main.y = min_trunk_y
            existing_main.end_x = riser_x
            existing_main.end_y = max_trunk_y
            existing_main.path = [[riser_x, min_trunk_y], [riser_x, max_trunk_y]]
        elif main_id not in existing_ids:
            new_main = PlumbingPipePayload(
                id=main_id,
                type=main_type,
                host_room_id="Kitchen",
                diameter=main_diam,
                x=riser_x,
                y=min_trunk_y,
                end_x=riser_x,
                end_y=max_trunk_y,
                path=[[riser_x, min_trunk_y], [riser_x, max_trunk_y]],
                connected_to=connected_target,
                clearance_status="OK"
            )
            pipes.append(new_main)
            existing_ids.add(main_id)
