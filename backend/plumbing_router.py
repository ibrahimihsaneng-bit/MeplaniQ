import math
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


def calculate_water_hammer_and_surge_protection(
    total_wsfu: float = 12.5,
    flow_velocity_ms: float = 1.8,
    pipe_material: str = "CPVC"
) -> Dict[str, Any]:
    """
    Computes acoustic pressure wave velocity and Joukowsky transient water hammer surge
    per PDI-WH 201 & ASSE 1010 standards.
    Formula: Delta P_wh = rho * a * Delta v
    """
    rho = 1000.0  # Water density, kg/m³
    wave_speed = 600.0 if pipe_material.upper() == "CPVC" else 1250.0  # m/s

    surge_pa = rho * wave_speed * flow_velocity_ms
    surge_kpa = round(surge_pa / 1000.0, 1)
    surge_psi = round(surge_kpa * 0.145038, 1)

    static_kpa = 300.0  # Nominal operating pressure, ~43.5 psi
    peak_kpa = round(static_kpa + surge_kpa, 1)
    peak_psi = round(peak_kpa * 0.145038, 1)

    # Maximum test pressure rating for CPVC schedule 40 / 80
    max_allowable_kpa = 1100.0
    exceeds_safe_pressure = peak_kpa > max_allowable_kpa

    # PDI-WH 201 Arrestor Sizing Rules
    if total_wsfu <= 11.0:
        arrestor_size = "Size A (1 - 11 WSFU)"
        pdi_code = "A"
    elif total_wsfu <= 32.0:
        arrestor_size = "Size B (12 - 32 WSFU)"
        pdi_code = "B"
    elif total_wsfu <= 60.0:
        arrestor_size = "Size C (33 - 60 WSFU)"
        pdi_code = "C"
    elif total_wsfu <= 113.0:
        arrestor_size = "Size D (61 - 113 WSFU)"
        pdi_code = "D"
    else:
        arrestor_size = "Size E (114 - 154 WSFU)"
        pdi_code = "E"

    damped_peak_kpa = min(peak_kpa, 750.0)
    damped_peak_psi = round(damped_peak_kpa * 0.145038, 1)

    return {
        "wave_speed_ms": wave_speed,
        "flow_velocity_ms": flow_velocity_ms,
        "surge_kpa": surge_kpa,
        "surge_psi": surge_psi,
        "peak_kpa": peak_kpa,
        "peak_psi": peak_psi,
        "max_allowable_kpa": max_allowable_kpa,
        "exceeds_safe_pressure": exceeds_safe_pressure,
        "arrestor_size": arrestor_size,
        "pdi_code": pdi_code,
        "recommended_arrestors": ["WHA-01 (WC Flush Valve)", "WHA-02 (Kitchen / Utility Solenoid)"],
        "damped_peak_kpa": damped_peak_kpa,
        "damped_peak_psi": damped_peak_psi,
        "compliance_standard": "PDI-WH 201 / ASSE 1010 / UPC 609.10"
    }


def calculate_drainage_slopes_and_clearance(
    pipes: List[Dict[str, Any]] = None,
    total_drain_length_m: float = 14.5
) -> Dict[str, Any]:
    """
    Computes gravity soil & waste drainage fall, invert levels (IL), and ceiling plenum clearance.
    Standards: UPC Table 702.1 & IPC 704.1 (1:40 / 2.5% for Ø110, 1:50 / 2.0% for Ø75/Ø50).
    """
    slope_percent = 2.5  # 1:40 gradient
    fall_per_meter_mm = 25.0  # mm/m

    total_fall_mm = round(total_drain_length_m * fall_per_meter_mm, 1)
    trap_invert_level_m = -0.300
    inspection_chamber_il_m = round(trap_invert_level_m - (total_fall_mm / 1000.0), 3)

    # Ceiling Plenum 3D Clearance Check
    slab_soffit_z_m = 2.85
    finished_ceiling_z_m = 2.40
    plenum_depth_mm = round((slab_soffit_z_m - finished_ceiling_z_m) * 1000.0, 1)  # 450 mm

    soil_pipe_od_mm = 110.0
    required_space_mm = round(total_fall_mm + soil_pipe_od_mm, 1)
    clearance_margin_mm = round(plenum_depth_mm - required_space_mm, 1)
    is_clearance_safe = clearance_margin_mm >= 50.0  # At least 50mm buffer

    return {
        "gradient_ratio": "1:40 (2.5% Fall)",
        "fall_per_meter_mm": fall_per_meter_mm,
        "total_run_length_m": total_drain_length_m,
        "total_fall_mm": total_fall_mm,
        "trap_invert_level_m": trap_invert_level_m,
        "inspection_chamber_il_m": inspection_chamber_il_m,
        "plenum_depth_mm": plenum_depth_mm,
        "required_space_mm": required_space_mm,
        "clearance_margin_mm": clearance_margin_mm,
        "is_clearance_safe": is_clearance_safe,
        "status": "COMPLIANT_NO_COLLISION" if is_clearance_safe else "RESERVED_FALL_WARNING",
        "standard": "UPC Table 702.1 / IPC Section 704.1"
    }




def calculate_plumbing_wsfu_and_dfu(fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes Water Supply Fixture Units (WSFU per IPC Table 610.3 / UPC Table 6-4)
    and Drainage Fixture Units (DFU per IPC Table 709.1 / UPC Table 7-3).
    Evaluates design peak water demand via Hunter's curve and sizes main supply and drain pipes.
    """
    wsfu_lookup = {
        "wash basin": 1.0, "basin": 1.0, "sink": 1.5, "kitchen sink": 1.5,
        "wc": 2.5, "toilet": 2.5, "water closet": 2.5, "bidet": 1.0,
        "shower": 2.0, "bathtub": 2.0, "tub": 2.0,
        "washing machine": 2.0, "dishwasher": 1.5, "urinal": 2.0
    }
    dfu_lookup = {
        "wash basin": 1.0, "basin": 1.0, "sink": 2.0, "kitchen sink": 2.0,
        "wc": 4.0, "toilet": 4.0, "water closet": 4.0, "bidet": 1.0,
        "shower": 2.0, "bathtub": 2.0, "tub": 2.0,
        "washing machine": 3.0, "dishwasher": 2.0, "floor trap": 2.0, "trap": 2.0
    }

    total_wsfu = 0.0
    total_dfu = 0.0
    fixture_breakdown = []

    for f in fixtures:
        f_type = (f.get("type", "") or f.get("name", "")).lower().strip()
        f_wsfu = 1.0
        f_dfu = 1.0
        for key, val in wsfu_lookup.items():
            if key in f_type:
                f_wsfu = val
                break
        for key, val in dfu_lookup.items():
            if key in f_type:
                f_dfu = val
                break
        total_wsfu += f_wsfu
        total_dfu += f_dfu
        fixture_breakdown.append({
            "id": f.get("id", "FIX"),
            "type": f.get("type", "Fixture"),
            "wsfu": f_wsfu,
            "dfu": f_dfu
        })

    total_wsfu = round(max(1.0, total_wsfu), 1)
    total_dfu = round(max(1.0, total_dfu), 1)

    # Hunter's Curve equation for flush tank systems
    # Q (GPM) = 4.0 * (WSFU)^0.55
    flow_gpm = round(4.0 * (total_wsfu ** 0.55), 1)
    flow_lpm = round(flow_gpm * 3.78541, 1)

    # Main Supply Pipe Sizing (Velocity limit 1.5 - 2.0 m/s per IPC 604.8)
    if flow_lpm <= 25.0:
        supply_pipe_mm = 20.0
        supply_pipe_inch = "3/4\""
    elif flow_lpm <= 45.0:
        supply_pipe_mm = 25.0
        supply_pipe_inch = "1\""
    elif flow_lpm <= 80.0:
        supply_pipe_mm = 32.0
        supply_pipe_inch = "1-1/4\""
    elif flow_lpm <= 140.0:
        supply_pipe_mm = 40.0
        supply_pipe_inch = "1-1/2\""
    else:
        supply_pipe_mm = 50.0
        supply_pipe_inch = "2\""

    # Building Drain / Sewer Sizing per IPC Table 710.1(1)
    if total_dfu <= 20.0:
        drain_pipe_mm = 75.0
        drain_pipe_inch = "3\""
        min_slope_pct = 2.0  # 1:50
    elif total_dfu <= 160.0:
        drain_pipe_mm = 110.0
        drain_pipe_inch = "4\""
        min_slope_pct = 2.0  # 1:50
    else:
        drain_pipe_mm = 160.0
        drain_pipe_inch = "6\""
        min_slope_pct = 1.0  # 1:100

    return {
        "total_wsfu": total_wsfu,
        "total_dfu": total_dfu,
        "design_flow_gpm": flow_gpm,
        "design_flow_lpm": flow_lpm,
        "recommended_supply_pipe_mm": supply_pipe_mm,
        "recommended_supply_pipe_inch": supply_pipe_inch,
        "recommended_drain_pipe_mm": drain_pipe_mm,
        "recommended_drain_pipe_inch": drain_pipe_inch,
        "min_drain_slope_pct": min_slope_pct,
        "fixture_count": len(fixtures),
        "fixture_breakdown": fixture_breakdown,
        "compliance_standard": "IPC 604.8 / IPC 709.1 / UPC Table 6-4"
    }


def calculate_water_storage_and_booster_pump(
    occupant_count: int = 6,
    building_height_m: float = 12.0
) -> Dict[str, Any]:
    """
    Computes Domestic Overhead Tank (OHT), Underground Sump Tank,
    and Pressure Booster Pump Capacity per NBC 2016 Part 9 / IPC.
    Baseline demand: 135 L/head/day.
    """
    occupants = max(2, occupant_count)
    per_capita_lpd = 135.0
    daily_demand_liters = occupants * per_capita_lpd

    # Storage tank capacities:
    # Overhead Tank (OHT): ~50% of daily demand, rounded to standard 500L/1000L step
    oht_liters = max(1000, math.ceil((daily_demand_liters * 0.50) / 250.0) * 250)
    # Underground Sump: 100% daily demand + fire buffer, rounded to 500L
    sump_liters = max(2000, math.ceil((daily_demand_liters * 1.00) / 500.0) * 500)

    # Booster Pump Sizing:
    # Refill OHT within 1.5 to 2.0 hours
    pump_flow_lpm = round(oht_liters / 90.0, 1)  # 90 mins refill
    # Total Dynamic Head (TDH): static height + friction (25%) + residual nozzle pressure (1.0 bar = 10m)
    static_head_m = building_height_m + 2.5
    friction_head_m = static_head_m * 0.25
    residual_head_m = 10.0
    total_head_m = round(static_head_m + friction_head_m + residual_head_m, 1)

    # Hydraulic Power = (rho * g * Q * H) / (1000 * efficiency)
    # Q in m3/s, rho=1000, g=9.81, eta=0.60
    q_m3s = (pump_flow_lpm / 1000.0) / 60.0
    hydraulic_power_kw = (1000.0 * 9.81 * q_m3s * total_head_m) / (1000.0 * 0.60)
    # Motor rating with 25% safety margin
    motor_kw = round(max(0.75, hydraulic_power_kw * 1.25), 2)
    motor_hp = round(motor_kw * 1.34102, 2)
    standard_motor_hp = 1.0 if motor_hp <= 1.0 else (1.5 if motor_hp <= 1.5 else (2.0 if motor_hp <= 2.0 else 3.0))

    return {
        "occupants_count": occupants,
        "daily_demand_liters": round(daily_demand_liters, 0),
        "overhead_tank_liters": oht_liters,
        "underground_sump_liters": sump_liters,
        "pump_flow_lpm": pump_flow_lpm,
        "total_dynamic_head_m": total_head_m,
        "calculated_motor_hp": motor_hp,
        "standard_booster_pump_hp": standard_motor_hp,
        "pump_type": "Multi-Stage Vertical Inline Booster Pump with VFD Pressure Transducer",
        "standard": "NBC 2016 Part 9 Section 1 / IS 1172 / IPC"
    }
