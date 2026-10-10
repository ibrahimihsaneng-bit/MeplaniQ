"""
Bill of Materials (BOM/BOQ) & Construction Cost Estimation Engine
Calculates comprehensive civil materials (bricks/blocks, cement bags, sand, steel),
construction timeline (days/phases), labor workforce mandays and wages,
itemized MEP (Electrical, Plumbing, HVAC), and Architectural Furniture.

Supports 3 Quality Tiers:
- Low (Budget / Economy): ~₹1,650 - ₹1,850 / sq.ft
- Medium (Standard / Premium): ~₹2,200 - ₹2,450 / sq.ft
- High (Luxury / Architectural): ~₹2,900 - ₹3,500 / sq.ft
"""

import math
from typing import Dict, Any, List, Optional


# Comprehensive Rate & Specification Matrix across Quality Tiers
TIER_SPECIFICATIONS: Dict[str, Dict[str, Any]] = {
    "low": {
        "tier_name": "Budget / Economy",
        "badge_color": "#10B981",
        "description": "Cost-effective, durable construction with standard commercial-grade materials.",
        "civil": {
            "brick_type": "Solid Concrete Blocks (400x200x150 mm)",
            "brick_unit_cost": 38.0,  # ₹ per block
            "red_brick_unit_cost": 8.5,  # ₹ per traditional brick
            "cement_brand": "Standard 43 Grade PPC (Dalmia / Chettinad)",
            "cement_bag_cost": 360.0,  # ₹ per 50kg bag
            "msand_cost_per_cft": 52.0,  # ₹ per CFT
            "psand_cost_per_cft": 58.0,  # ₹ per CFT
            "steel_cost_per_kg": 64.0,  # ₹ per kg (Fe500D)
            "aggregate_cost_per_cft": 42.0,  # ₹ per CFT (20mm metal)
            "flooring_sqft_cost": 85.0,  # Basic ceramic/vitrified 2x2
        },
        "labor_daily_wages": {
            "head_mason": 1050.0,
            "mason": 950.0,
            "helper": 700.0,
            "electrician": 900.0,
            "plumber": 900.0,
            "carpenter": 950.0,
            "painter": 850.0
        },
        "mep": {
            "hvac_unit_costs": {
                "0.75": 28000.0,
                "1.0": 32000.0,
                "1.5": 36000.0,
                "2.0": 44000.0,
                "default": 36000.0
            },
            "hvac_brand_desc": "3-Star Fixed/Inverter Split AC (Voltas / Blue Star)",
            "hvac_copper_pipe_per_meter": 750.0,
            "electrical_db_cost": 4500.0,  # 8-way SPN DB + MCBs
            "switch_point_cost": 450.0,  # Anchor Roma modular plate + switch
            "downlight_cost": 350.0,  # Basic 7W-12W LED downlight
            "ceiling_fan_cost": 1800.0,  # Standard 3-blade induction fan
            "ac_isolator_cost": 850.0,  # 25A metal clad isolator
            "wiring_conduit_per_meter": 120.0,  # FR PVC conduit + 1.5/2.5 sqmm wire
            "wc_fixture_cost": 6500.0,  # Floor-mounted EWC with ceramic cistern (Cera/Parryware)
            "wash_basin_cost": 2200.0,  # Wall-hung wash basin with pillar tap
            "kitchen_sink_cost": 3500.0,  # Single-bowl SS 304 sink (Carysil/Nirali)
            "shower_mixer_cost": 2800.0,  # Basic 2-in-1 wall mixer
            "plumbing_pipe_per_meter": 220.0,  # Astral CPVC SDR-11 water supply + PVC drainage
        },
        "furniture_rates": {
            "king bed": 22000.0,
            "queen bed": 18000.0,
            "double bed": 17000.0,
            "single bed": 11000.0,
            "sofa set": 24000.0,
            "dining table": 16000.0,
            "coffee table": 4500.0,
            "kitchen counter": 12000.0,  # per running meter
            "wardrobe": 22000.0,
            "study desk": 6500.0,
            "general_furniture": 10000.0,
            "finish_description": "Commercial MR-Grade Plywood with 0.8mm standard laminate"
        }
    },
    "medium": {
        "tier_name": "Standard / Premium",
        "badge_color": "#0284C7",
        "description": "High-durability branded materials, 5-star inverter ACs, modular fittings, and premium finishes.",
        "civil": {
            "brick_type": "First-Class Wire-Cut Bricks / Solid Blocks",
            "brick_unit_cost": 48.0,
            "red_brick_unit_cost": 11.5,
            "cement_brand": "UltraTech Super / ACC Suraksha 53 Grade",
            "cement_bag_cost": 420.0,
            "msand_cost_per_cft": 62.0,
            "psand_cost_per_cft": 70.0,
            "steel_cost_per_kg": 72.0,  # Tata Tiscon / JSW Neosteel Fe550D
            "aggregate_cost_per_cft": 48.0,
            "flooring_sqft_cost": 140.0,  # Double-charged 800x800 vitrified tiles (Kajaria/Somany)
        },
        "labor_daily_wages": {
            "head_mason": 1250.0,
            "mason": 1100.0,
            "helper": 850.0,
            "electrician": 1100.0,
            "plumber": 1100.0,
            "carpenter": 1150.0,
            "painter": 1000.0
        },
        "mep": {
            "hvac_unit_costs": {
                "0.75": 38000.0,
                "1.0": 44000.0,
                "1.5": 49000.0,
                "2.0": 58000.0,
                "default": 49000.0
            },
            "hvac_brand_desc": "5-Star Heavy Duty Inverter Split AC (Daikin / Panasonic / Mitsubishi)",
            "hvac_copper_pipe_per_meter": 950.0,
            "electrical_db_cost": 7500.0,  # Legrand/Schneider 12-way VTPN DB + 4-Pole RCCB
            "switch_point_cost": 750.0,  # Legrand Arteor / Schneider AvatarOn modular plates
            "downlight_cost": 650.0,  # Philips / Havells COB recessed anti-glare downlight
            "ceiling_fan_cost": 3200.0,  # Atomberg / Orient BLDC Energy-saving 28W remote fan
            "ac_isolator_cost": 1400.0,  # Schneider modular high-current AC starter/isolator
            "wiring_conduit_per_meter": 180.0,  # Polycab / Finolex FRLS multi-strand copper wire
            "wc_fixture_cost": 13500.0,  # Jaquar / Kohler Rimless Wall-hung EWC with concealed dual-flush cistern
            "wash_basin_cost": 5500.0,  # Countertop oval ceramic basin with Jaquar tall-boy mixer
            "kitchen_sink_cost": 7500.0,  # Heavy 1.2mm SS 304 satin finish dual bowl sink with swivel faucet
            "shower_mixer_cost": 6500.0,  # Jaquar single-lever thermostatic wall diverter with overhead rain shower
            "plumbing_pipe_per_meter": 340.0,  # Supreme SDR-11 CPVC & SWR sound-damped soil drainage
        },
        "furniture_rates": {
            "king bed": 38000.0,
            "queen bed": 32000.0,
            "double bed": 30000.0,
            "single bed": 18000.0,
            "sofa set": 48000.0,
            "dining table": 32000.0,
            "coffee table": 9500.0,
            "kitchen counter": 24000.0,  # per running meter
            "wardrobe": 42000.0,
            "study desk": 13000.0,
            "general_furniture": 18000.0,
            "finish_description": "Marine-grade BWP 710 Plywood with 1mm matte laminates & Hettich soft-close hardware"
        }
    },
    "high": {
        "tier_name": "Luxury / Architectural",
        "badge_color": "#7C3AED",
        "description": "Bespoke architectural finishes, Italian marble/granite, VRF inverter systems, solid teak wood, smart home automation.",
        "civil": {
            "brick_type": "Dressed Laterite Stone / Machine-cut Interlocking Solid Blocks",
            "brick_unit_cost": 62.0,
            "red_brick_unit_cost": 15.0,
            "cement_brand": "UltraTech Weather Pro / Birla White 53 Grade",
            "cement_bag_cost": 490.0,
            "msand_cost_per_cft": 75.0,
            "psand_cost_per_cft": 85.0,
            "steel_cost_per_kg": 82.0,  # Tata Tiscon Super Ductile SD TMT
            "aggregate_cost_per_cft": 56.0,
            "flooring_sqft_cost": 280.0,  # Imported Italian Marble / Brazilian Granite / Large Slab Glazed Porcelain
        },
        "labor_daily_wages": {
            "head_mason": 1500.0,
            "mason": 1300.0,
            "helper": 950.0,
            "electrician": 1350.0,
            "plumber": 1350.0,
            "carpenter": 1400.0,
            "painter": 1200.0
        },
        "mep": {
            "hvac_unit_costs": {
                "0.75": 52000.0,
                "1.0": 62000.0,
                "1.5": 72000.0,
                "2.0": 88000.0,
                "default": 72000.0
            },
            "hvac_brand_desc": "Multi-Split VRF / Inverter Luxury Series (Daikin VRV / Mitsubishi Electric Heavy)",
            "hvac_copper_pipe_per_meter": 1350.0,
            "electrical_db_cost": 14000.0,  # Hager / ABB Intelligent Automation DB with Type-2 Surge Arrestor
            "switch_point_cost": 1600.0,  # Smart capacitive touch switches / Zigbee IoT automation modules
            "downlight_cost": 1400.0,  # Magnetic architectural track lights & trimless CRI>95 COBs
            "ceiling_fan_cost": 6800.0,  # Designer aerodynamic wooden-blade BLDC silent ceiling fan
            "ac_isolator_cost": 2600.0,  # Heavy duty concealed electronic motor starter
            "wiring_conduit_per_meter": 280.0,  # Zero-halogen FRLS armored cabling & metal conduit
            "wc_fixture_cost": 32000.0,  # Toto / Grohe / Kohler Wall-hung bidet smart toilet with sensor flush
            "wash_basin_cost": 14000.0,  # Italian composite stone monolithic basin with Grohe concealed wall mixer
            "kitchen_sink_cost": 16000.0,  # Franke / Carysil Quartz Composite scratch-resistant double-bowl sink
            "shower_mixer_cost": 18000.0,  # Grohe SmartControl 340mm ceiling rain-shower with 3-outlet thermostatic valve
            "plumbing_pipe_per_meter": 520.0,  # George Fischer / Astral Silencio acoustic insulated drainage & CPVC Pro
        },
        "furniture_rates": {
            "king bed": 75000.0,
            "queen bed": 62000.0,
            "double bed": 58000.0,
            "single bed": 32000.0,
            "sofa set": 115000.0,
            "dining table": 68000.0,
            "coffee table": 19000.0,
            "kitchen counter": 48000.0,  # per running meter
            "wardrobe": 85000.0,
            "study desk": 26000.0,
            "general_furniture": 35000.0,
            "finish_description": "Solid Teak Wood / Italian PU Lacquer veneer with Blum motorized push-to-open fittings"
        }
    }
}


def normalize_tier_key(quality_tier: Optional[str]) -> str:
    """Normalizes quality tier string to 'low', 'medium', or 'high'."""
    if not quality_tier:
        return "medium"
    normalized = str(quality_tier).strip().lower()
    if "low" in normalized or "budget" in normalized or "economy" in normalized:
        return "low"
    if "high" in normalized or "luxury" in normalized or "premium" in normalized:
        return "high"
    return "medium"


def calculate_wall_geometry_quantities(cad_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes exact wall centerline lengths, gross and net masonry surface areas,
    door/window cutout deductions, and masonry volume in cubic meters.
    """
    rooms = cad_data.get("rooms", []) or []
    wall_lines = cad_data.get("wall_lines", []) or []
    openings_doors = cad_data.get("doors", []) or []
    openings_windows = cad_data.get("windows", []) or []

    # Standard residential ceiling height: 3.0 meters (3000 mm)
    ceiling_height_m = 3.0

    # Calculate total wall length in meters
    total_wall_length_m = 0.0
    if wall_lines:
        for wl in wall_lines:
            sp = wl.get("start", [0, 0])
            ep = wl.get("end", [0, 0])
            dx = (ep[0] - sp[0]) / 1000.0
            dy = (ep[1] - sp[1]) / 1000.0
            total_wall_length_m += math.hypot(dx, dy)
        # In a double-line CAD layout, wall_lines often represent both faces;
        # if average thickness lines are present, normalize:
        if total_wall_length_m > 0 and len(rooms) > 0:
            # Check perimeter of all rooms as reference
            perim_sum = sum(float(r.get("perimeter_m", 0.0) or 0.0) for r in rooms)
            if perim_sum > 0:
                # Actual centerline wall length is roughly perim_sum / 1.7 (due to shared walls between rooms)
                total_wall_length_m = min(total_wall_length_m / 2.0, perim_sum * 0.75)
    else:
        # Fallback using room perimeters
        perim_sum = sum(float(r.get("perimeter_m", 0.0) or 0.0) for r in rooms)
        if perim_sum > 0:
            total_wall_length_m = perim_sum / 1.6
        else:
            # Fallback based on builtup area: approx sqrt(sqm) * 4 * 1.5
            sqm = float(cad_data.get("total_builtup_area_sqm") or cad_data.get("total_carpet_area_sqm") or 100.0)
            total_wall_length_m = math.sqrt(sqm) * 4.0 * 1.4

    # Split wall length: ~45% exterior load-bearing (230mm = 0.23m) and 55% interior partition (115mm = 0.115m)
    ext_wall_length_m = total_wall_length_m * 0.45
    int_wall_length_m = total_wall_length_m * 0.55

    # Gross wall area (both sides for plastering estimation)
    gross_wall_face_area_m2 = total_wall_length_m * ceiling_height_m

    # Compute door and window opening deductions
    door_openings_area_m2 = 0.0
    door_count = len(openings_doors)
    for d in openings_doors:
        w_m = float(d.get("width_mm", 900.0)) / 1000.0
        h_m = float(d.get("height_mm", 2100.0)) / 1000.0
        door_openings_area_m2 += (w_m * h_m)

    window_openings_area_m2 = 0.0
    window_count = len(openings_windows)
    for w in openings_windows:
        w_m = float(w.get("width_mm", 1200.0)) / 1000.0
        h_m = float(w.get("height_mm", 1200.0)) / 1000.0
        window_openings_area_m2 += (w_m * h_m)

    total_openings_area_m2 = door_openings_area_m2 + window_openings_area_m2

    # Net wall face area
    net_wall_face_area_m2 = max(gross_wall_face_area_m2 - total_openings_area_m2, gross_wall_face_area_m2 * 0.7)

    # Masonry Volume:
    # Exterior walls (0.23m thick) minus openings (~40% of openings are exterior)
    ext_openings_vol = (total_openings_area_m2 * 0.4) * 0.23
    ext_masonry_vol_m3 = max((ext_wall_length_m * ceiling_height_m * 0.23) - ext_openings_vol, 5.0)

    # Interior partition walls (0.115m thick) minus interior openings (~60%)
    int_openings_vol = (total_openings_area_m2 * 0.6) * 0.115
    int_masonry_vol_m3 = max((int_wall_length_m * ceiling_height_m * 0.115) - int_openings_vol, 3.0)

    total_net_masonry_vol_m3 = ext_masonry_vol_m3 + int_masonry_vol_m3

    # Plastering area: internal faces (2 sides of interior, 1 side of exterior) + external face
    # Formula: (2 * interior wall area) + (2 * exterior wall area) - (2 * openings area)
    total_plaster_area_m2 = (2.0 * gross_wall_face_area_m2) - (2.0 * total_openings_area_m2)

    return {
        "ceiling_height_m": ceiling_height_m,
        "total_wall_length_m": round(total_wall_length_m, 2),
        "exterior_wall_length_m": round(ext_wall_length_m, 2),
        "interior_wall_length_m": round(int_wall_length_m, 2),
        "gross_wall_face_area_m2": round(gross_wall_face_area_m2, 2),
        "door_count": door_count,
        "door_openings_area_m2": round(door_openings_area_m2, 2),
        "window_count": window_count,
        "window_openings_area_m2": round(window_openings_area_m2, 2),
        "total_openings_area_m2": round(total_openings_area_m2, 2),
        "net_wall_face_area_m2": round(net_wall_face_area_m2, 2),
        "net_masonry_volume_m3": round(total_net_masonry_vol_m3, 2),
        "total_plaster_area_m2": round(total_plaster_area_m2, 2)
    }


def calculate_project_boq(cad_data: Dict[str, Any], quality_tier: str = "medium") -> Dict[str, Any]:
    """
    Master computation function producing the comprehensive Bill of Materials (BOQ).
    """
    tier_key = normalize_tier_key(quality_tier)
    specs = TIER_SPECIFICATIONS[tier_key]

    # 1. Geometry & Floor Areas
    builtup_sqm = float(cad_data.get("total_builtup_area_sqm") or 0.0)
    carpet_sqm = float(cad_data.get("total_carpet_area_sqm") or 0.0)

    # Fallback to sum of room areas if not set
    rooms = cad_data.get("rooms", []) or []
    if carpet_sqm <= 0.0 and rooms:
        carpet_sqm = sum(float(r.get("area_sqm", 0.0) or 0.0) for r in rooms)

    if builtup_sqm <= 0.0:
        builtup_sqm = carpet_sqm * 1.2 if carpet_sqm > 0 else 115.0

    if carpet_sqm <= 0.0:
        carpet_sqm = builtup_sqm / 1.2

    sqft_multiplier = 10.7639
    builtup_sqft = builtup_sqm * sqft_multiplier
    carpet_sqft = carpet_sqm * sqft_multiplier

    # 2. Wall Geometry & Quantities
    wall_quant = calculate_wall_geometry_quantities(cad_data)
    net_masonry_vol_m3 = wall_quant["net_masonry_volume_m3"]
    total_plaster_area_m2 = wall_quant["total_plaster_area_m2"]

    # 3. Civil & Structural Materials Breakdown
    # Standard Brick count: 500 bricks per m³ of masonry (with 10mm mortar and 5% wastage)
    # Solid block count: ~82.5 6" blocks per m³
    standard_bricks_count = int(round(net_masonry_vol_m3 * 500))
    solid_blocks_count = int(round(net_masonry_vol_m3 * 82.5))

    # Cement Bags (50kg bags):
    # a. Masonry Mortar (1:6 mix): ~1.28 bags/m³ of masonry
    cement_masonry_bags = round(net_masonry_vol_m3 * 1.28, 1)
    # b. Plastering (12mm int + 15mm ext, 1:4 mix): ~0.15 bags/m² of plaster surface
    cement_plaster_bags = round(total_plaster_area_m2 * 0.15, 1)
    # c. RCC Structure (M20/M25 concrete for footings, plinth beam, columns, lintels, roof slab):
    #    Industry standard thumb rule: 0.40 bags per sq.ft of builtup area
    cement_rcc_bags = round(builtup_sqft * 0.40, 1)
    # d. Flooring screed & tile fixing: 0.05 bags per sq.ft of carpet area
    cement_flooring_bags = round(carpet_sqft * 0.05, 1)

    total_cement_bags = int(round(cement_masonry_bags + cement_plaster_bags + cement_rcc_bags + cement_flooring_bags))

    # Sand Quantities:
    # M-Sand (Manufactured Sand for RCC & Masonry): ~1.7 CFT per sq.ft of builtup area
    msand_cft = round(builtup_sqft * 1.7, 1)
    # P-Sand (Plastering Sand): ~0.7 CFT per sq.ft of builtup area
    psand_cft = round(builtup_sqft * 0.7, 1)
    total_sand_cft = round(msand_cft + psand_cft, 1)
    # Convert CFT to Metric Tons: 1 CFT sand ≈ 45 kg = 0.045 MT (approx 22.2 CFT per Ton)
    total_sand_tons = round(total_sand_cft * 0.045, 2)
    msand_tons = round(msand_cft * 0.045, 2)
    psand_tons = round(psand_cft * 0.045, 2)

    # Steel Rebar (TMT Fe550D / Fe500D):
    # Industry standard structural requirement: ~4.0 kg per sq.ft of builtup area
    steel_kg = round(builtup_sqft * 4.0, 1)
    steel_metric_tons = round(steel_kg / 1000.0, 3)

    # Coarse Aggregate (20mm / 40mm granite metal):
    # Standard: ~1.15 CFT per sq.ft of builtup area
    aggregate_cft = round(builtup_sqft * 1.15, 1)
    aggregate_tons = round(aggregate_cft * 0.048, 2)

    # Civil Costs Calculation
    civil_specs = specs["civil"]
    cost_bricks = round(solid_blocks_count * civil_specs["brick_unit_cost"], 2)
    cost_cement = round(total_cement_bags * civil_specs["cement_bag_cost"], 2)
    cost_msand = round(msand_cft * civil_specs["msand_cost_per_cft"], 2)
    cost_psand = round(psand_cft * civil_specs["psand_cost_per_cft"], 2)
    cost_steel = round(steel_kg * civil_specs["steel_cost_per_kg"], 2)
    cost_aggregate = round(aggregate_cft * civil_specs["aggregate_cost_per_cft"], 2)
    cost_flooring = round(carpet_sqft * civil_specs["flooring_sqft_cost"], 2)

    total_civil_materials_cost = round(
        cost_bricks + cost_cement + cost_msand + cost_psand + cost_steel + cost_aggregate + cost_flooring, 2
    )

    # 4. Construction Timeline & Schedule Engine
    # Total construction duration based on builtup sqft:
    # Base 90 days + (builtup_sqft / 18) days (e.g., 1,200 sqft ≈ 90 + 66 = 156 days)
    total_working_days = int(round(90.0 + (builtup_sqft / 18.0)))
    total_calendar_months = round(total_working_days / 25.0, 1)

    # 7-Phase Timeline Breakdown
    phase_weights = [
        ("Foundation & Substructure", 0.14, "Excavation, PCC, RCC column footings, plinth beam, and anti-termite treatment."),
        ("Superstructure Masonry", 0.18, f"Construction of exterior & interior walls ({solid_blocks_count:,} blocks / {standard_bricks_count:,} bricks)."),
        ("RCC Lintels & Roof Slab", 0.17, "Shuttering, TMT bar reinforcement, M25 concrete casting, and 21-day water curing."),
        ("MEP Concealed Rough-in", 0.11, "Electrical conduit routing, switchbox chasing, plumbing supply & drainage pipe runs."),
        ("Internal & External Plastering", 0.15, f"12mm internal & 15mm external plastering ({total_plaster_area_m2:,.0f} m² surface area)."),
        ("Flooring, Doors & Windows", 0.14, f"Vitrified tile laying ({carpet_sqft:,.0f} sq.ft), granite thresholds, door frames & windows fitting."),
        ("Painting, Fixtures & Handover", 0.11, "Putty, primer, premium emulsion coats, electrical/plumbing fixtures install, and final deep clean.")
    ]

    timeline_phases: List[Dict[str, Any]] = []
    current_day = 1
    for p_name, p_pct, p_desc in phase_weights:
        p_duration = max(int(round(total_working_days * p_pct)), 7)
        end_day = current_day + p_duration - 1
        timeline_phases.append({
            "phase_name": p_name,
            "duration_days": p_duration,
            "start_day": f"Day {current_day}",
            "end_day": f"Day {end_day}",
            "description": p_desc,
            "progress_percent": int(p_pct * 100)
        })
        current_day = end_day + 1

    # 5. Labor Workforce & Wages Engine
    # Mandays estimation per sq.ft:
    # Mason: ~0.18 mandays/sq.ft (split: 0.06 head mason, 0.12 general mason)
    # Helper: ~0.26 mandays/sq.ft
    # Electrician: ~0.045 mandays/sq.ft
    # Plumber: ~0.04 mandays/sq.ft
    # Carpenter: ~0.055 mandays/sq.ft
    # Painter: ~0.04 mandays/sq.ft
    mandays_head_mason = int(round(builtup_sqft * 0.06))
    mandays_mason = int(round(builtup_sqft * 0.12))
    mandays_helper = int(round(builtup_sqft * 0.26))
    mandays_electrician = int(round(builtup_sqft * 0.045))
    mandays_plumber = int(round(builtup_sqft * 0.04))
    mandays_carpenter = int(round(builtup_sqft * 0.055))
    mandays_painter = int(round(builtup_sqft * 0.04))

    wage_rates = specs["labor_daily_wages"]
    labor_head_mason_cost = mandays_head_mason * wage_rates["head_mason"]
    labor_mason_cost = mandays_mason * wage_rates["mason"]
    labor_helper_cost = mandays_helper * wage_rates["helper"]
    labor_electrician_cost = mandays_electrician * wage_rates["electrician"]
    labor_plumber_cost = mandays_plumber * wage_rates["plumber"]
    labor_carpenter_cost = mandays_carpenter * wage_rates["carpenter"]
    labor_painter_cost = mandays_painter * wage_rates["painter"]

    total_labor_mandays = (
        mandays_head_mason + mandays_mason + mandays_helper +
        mandays_electrician + mandays_plumber + mandays_carpenter + mandays_painter
    )
    total_labor_cost = round(
        labor_head_mason_cost + labor_mason_cost + labor_helper_cost +
        labor_electrician_cost + labor_plumber_cost + labor_carpenter_cost + labor_painter_cost, 2
    )

    labor_breakdown = [
        {"role": "Head Mason / Supervisor", "mandays": mandays_head_mason, "daily_wage": wage_rates["head_mason"], "total_cost": labor_head_mason_cost},
        {"role": "Civil Masons", "mandays": mandays_mason, "daily_wage": wage_rates["mason"], "total_cost": labor_mason_cost},
        {"role": "Civil Helpers (Male/Female)", "mandays": mandays_helper, "daily_wage": wage_rates["helper"], "total_cost": labor_helper_cost},
        {"role": "Licensed Electricians", "mandays": mandays_electrician, "daily_wage": wage_rates["electrician"], "total_cost": labor_electrician_cost},
        {"role": "Plumbers & Pipe Fitters", "mandays": mandays_plumber, "daily_wage": wage_rates["plumber"], "total_cost": labor_plumber_cost},
        {"role": "Carpenters & Woodworkers", "mandays": mandays_carpenter, "daily_wage": wage_rates["carpenter"], "total_cost": labor_carpenter_cost},
        {"role": "Painters & Polishers", "mandays": mandays_painter, "daily_wage": wage_rates["painter"], "total_cost": labor_painter_cost},
    ]

    # 6. MEP Engineering Itemized Costing
    mep_specs = specs["mep"]

    # a. HVAC System
    raw_hvac_list = cad_data.get("hvac_equipment", []) or []
    hvac_items: List[Dict[str, Any]] = []
    total_hvac_cost = 0.0

    if raw_hvac_list:
        for idx, h in enumerate(raw_hvac_list):
            h_type = str(h.get("type", "Split-IDU"))
            cap = str(h.get("capacity_tr", "1.5"))
            room = h.get("room_name", "Room")
            cost_unit = mep_specs["hvac_unit_costs"].get(cap, mep_specs["hvac_unit_costs"]["default"])
            # If ODU condenser, it shares compressor/piping setup (accounted as outdoor companion)
            is_odu = "ODU" in h_type
            unit_cost = cost_unit * 0.45 if is_odu else cost_unit
            total_hvac_cost += unit_cost
            hvac_items.append({
                "item_id": f"HVAC-{idx+1:02d}",
                "equipment": f"{h_type} ({cap} TR)",
                "room": room,
                "unit_cost": round(unit_cost, 2),
                "specification": mep_specs["hvac_brand_desc"]
            })
    else:
        # Generate default AC setup for bedrooms / living rooms
        ac_rooms = [r.get("name", "Bedroom") for r in rooms if any(k in r.get("name", "").lower() for k in ["bed", "living", "master"])]
        if not ac_rooms:
            ac_rooms = ["Living Room", "Master Bedroom"]
        for idx, r_name in enumerate(ac_rooms):
            cap = "1.5" if "living" in r_name.lower() else "1.0"
            unit_cost = mep_specs["hvac_unit_costs"].get(cap, mep_specs["hvac_unit_costs"]["default"])
            total_hvac_cost += unit_cost
            hvac_items.append({
                "item_id": f"HVAC-{idx+1:02d}",
                "equipment": f"Split-IDU ({cap} TR)",
                "room": r_name,
                "unit_cost": round(unit_cost, 2),
                "specification": mep_specs["hvac_brand_desc"]
            })

    # Copper piping & insulation: approx 6m per indoor unit
    copper_length_m = len(hvac_items) * 6.0
    copper_pipe_cost = round(copper_length_m * mep_specs["hvac_copper_pipe_per_meter"], 2)
    total_hvac_cost += copper_pipe_cost

    # b. Electrical Engineering
    el_components = cad_data.get("electrical_components", []) or []
    db_count = max(sum(1 for c in el_components if "distribution" in str(c.get("type", "")).lower() or "db" in str(c.get("type", "")).lower()), 1)
    light_count = sum(1 for c in el_components if "light" in str(c.get("type", "")).lower())
    fan_count = sum(1 for c in el_components if "fan" in str(c.get("type", "")).lower())
    socket_count = sum(1 for c in el_components if "socket" in str(c.get("type", "")).lower() or "switch" in str(c.get("type", "")).lower())
    ac_point_count = sum(1 for c in el_components if "ac" in str(c.get("type", "")).lower() or "isolator" in str(c.get("type", "")).lower())

    # Fallbacks based on rooms if electrical not auto-populated
    if light_count == 0:
        light_count = max(len(rooms) * 3, 10)
    if fan_count == 0:
        fan_count = max(len(rooms), 3)
    if socket_count == 0:
        socket_count = max(len(rooms) * 4, 14)
    if ac_point_count == 0:
        ac_point_count = len(hvac_items)

    cost_db = db_count * mep_specs["electrical_db_cost"]
    cost_lights = light_count * mep_specs["downlight_cost"]
    cost_fans = fan_count * mep_specs["ceiling_fan_cost"]
    cost_sockets = socket_count * mep_specs["switch_point_cost"]
    cost_ac_points = ac_point_count * mep_specs["ac_isolator_cost"]

    # Conduits & wiring: approx 2.5m per light/socket + 10m per AC point
    conduit_meters = round((light_count + socket_count) * 2.5 + (ac_point_count * 10.0), 1)
    cost_conduits = round(conduit_meters * mep_specs["wiring_conduit_per_meter"], 2)

    total_electrical_cost = round(cost_db + cost_lights + cost_fans + cost_sockets + cost_ac_points + cost_conduits, 2)

    electrical_breakdown = [
        {"item": "Main Distribution Board (DB & RCCB/MCBs)", "quantity": f"{db_count} Set(s)", "unit_rate": mep_specs["electrical_db_cost"], "total": cost_db},
        {"item": "LED Downlights & Ceiling Architectural Lights", "quantity": f"{light_count} Nos", "unit_rate": mep_specs["downlight_cost"], "total": cost_lights},
        {"item": "Ceiling BLDC / Remote Energy Fans", "quantity": f"{fan_count} Nos", "unit_rate": mep_specs["ceiling_fan_cost"], "total": cost_fans},
        {"item": "Modular Switch Plates & 6A/16A Power Sockets", "quantity": f"{socket_count} Points", "unit_rate": mep_specs["switch_point_cost"], "total": cost_sockets},
        {"item": "Heavy AC Starter / Isolator Points", "quantity": f"{ac_point_count} Points", "unit_rate": mep_specs["ac_isolator_cost"], "total": cost_ac_points},
        {"item": "FRLS Copper Wiring & Concealed Heavy PVC Conduits", "quantity": f"{conduit_meters:,.0f} Meters", "unit_rate": mep_specs["wiring_conduit_per_meter"], "total": cost_conduits},
    ]

    # c. Plumbing & Sanitary Engineering
    plumb_fixtures = cad_data.get("plumbing_fixtures", []) or []
    wc_count = sum(1 for p in plumb_fixtures if any(k in str(p.get("fixture_type", "")).lower() for k in ["wc", "closet", "toilet"]))
    basin_count = sum(1 for p in plumb_fixtures if any(k in str(p.get("fixture_type", "")).lower() for k in ["basin", "wash"]))
    sink_count = sum(1 for p in plumb_fixtures if any(k in str(p.get("fixture_type", "")).lower() for k in ["sink"]))
    shower_count = sum(1 for p in plumb_fixtures if any(k in str(p.get("fixture_type", "")).lower() for k in ["shower", "bath"]))

    # Fallbacks based on bathroom count in rooms
    bath_rooms = [r for r in rooms if any(k in r.get("name", "").lower() for k in ["bath", "toilet", "wash"])]
    num_baths = max(len(bath_rooms), 1)

    if wc_count == 0:
        wc_count = num_baths
    if basin_count == 0:
        basin_count = num_baths
    if sink_count == 0:
        sink_count = 1
    if shower_count == 0:
        shower_count = num_baths

    cost_wc = wc_count * mep_specs["wc_fixture_cost"]
    cost_basin = basin_count * mep_specs["wash_basin_cost"]
    cost_sink = sink_count * mep_specs["kitchen_sink_cost"]
    cost_shower = shower_count * mep_specs["shower_mixer_cost"]

    # Water supply CPVC & drainage SWR pipes (approx 18m per bathroom/kitchen)
    plumbing_pipe_meters = round((num_baths + 1) * 18.0, 1)
    cost_plumbing_pipes = round(plumbing_pipe_meters * mep_specs["plumbing_pipe_per_meter"], 2)

    total_plumbing_cost = round(cost_wc + cost_basin + cost_sink + cost_shower + cost_plumbing_pipes, 2)

    plumbing_breakdown = [
        {"item": "Water Closets (EWC & Cistern / Flush Valve)", "quantity": f"{wc_count} Nos", "unit_rate": mep_specs["wc_fixture_cost"], "total": cost_wc},
        {"item": "Wash Basins with Taps & Bottle Traps", "quantity": f"{basin_count} Nos", "unit_rate": mep_specs["wash_basin_cost"], "total": cost_basin},
        {"item": "Kitchen Stainless Steel / Quartz Sink Unit", "quantity": f"{sink_count} Nos", "unit_rate": mep_specs["kitchen_sink_cost"], "total": cost_sink},
        {"item": "Shower Diverters, Spout & Rain Shower Head", "quantity": f"{shower_count} Sets", "unit_rate": mep_specs["shower_mixer_cost"], "total": cost_shower},
        {"item": "Dual CPVC Hot/Cold Supply & SWR Soil Drainage Lines", "quantity": f"{plumbing_pipe_meters:,.0f} Meters", "unit_rate": mep_specs["plumbing_pipe_per_meter"], "total": cost_plumbing_pipes},
    ]

    # 7. Architectural Furniture Itemized Costing
    raw_furniture = cad_data.get("furniture", []) or []
    furniture_specs = specs["furniture_rates"]
    furniture_items: List[Dict[str, Any]] = []
    total_furniture_cost = 0.0

    if raw_furniture:
        for idx, f in enumerate(raw_furniture):
            f_name = str(f.get("name") or f.get("type") or "Furniture Item").lower()
            room = f.get("room_name", "Room")
            matched_rate = furniture_specs["general_furniture"]
            clean_title = f_name.title()

            if "king" in f_name or ("bed" in f_name and "king" in str(f.get("type", "")).lower()):
                matched_rate = furniture_specs["king bed"]
                clean_title = "King Size Master Bed"
            elif "queen" in f_name:
                matched_rate = furniture_specs["queen bed"]
                clean_title = "Queen Size Bed"
            elif "single bed" in f_name:
                matched_rate = furniture_specs["single bed"]
                clean_title = "Single Bed"
            elif "bed" in f_name:
                matched_rate = furniture_specs["double bed"]
                clean_title = "Double Bed"
            elif "sofa" in f_name:
                matched_rate = furniture_specs["sofa set"]
                clean_title = "Living Room Sofa Set (3+2)"
            elif "dining" in f_name:
                matched_rate = furniture_specs["dining table"]
                clean_title = "Dining Table (6-Seater)"
            elif "coffee" in f_name or "center" in f_name:
                matched_rate = furniture_specs["coffee table"]
                clean_title = "Coffee / Center Table"
            elif "counter" in f_name or "kitchen" in f_name:
                # Approximate 3 running meters
                matched_rate = furniture_specs["kitchen counter"] * 2.5
                clean_title = "Modular Kitchen Countertop & Cabinets"
            elif "wardrobe" in f_name or "closet" in f_name:
                matched_rate = furniture_specs["wardrobe"]
                clean_title = "Built-in Bedroom Wardrobe"
            elif "desk" in f_name or "study" in f_name or "table" in f_name:
                matched_rate = furniture_specs["study desk"]
                clean_title = "Study Desk / Work Table"

            total_furniture_cost += matched_rate
            furniture_items.append({
                "item_id": f"FURN-{idx+1:02d}",
                "name": clean_title,
                "room": room,
                "cost": round(matched_rate, 2),
                "finish": furniture_specs["finish_description"]
            })
    else:
        # Default furniture package for standard residential house
        default_furn = [
            ("King Size Master Bed with Storage", "Master Bedroom", furniture_specs["king bed"]),
            ("Double Bed with Headboard", "Bedroom 2", furniture_specs["double bed"]),
            ("Luxury Sofa Set (3+2 Seater)", "Living Room", furniture_specs["sofa set"]),
            ("Dining Table & 6 Chairs", "Dining", furniture_specs["dining table"]),
            ("Designer Coffee Table", "Living Room", furniture_specs["coffee table"]),
            ("Modular Kitchen Overhead & Base Cabinets", "Kitchen", furniture_specs["kitchen counter"] * 3.0),
        ]
        for idx, (f_title, f_room, f_cost) in enumerate(default_furn):
            total_furniture_cost += f_cost
            furniture_items.append({
                "item_id": f"FURN-{idx+1:02d}",
                "name": f_title,
                "room": f_room,
                "cost": round(f_cost, 2),
                "finish": furniture_specs["finish_description"]
            })

    total_furniture_cost = round(total_furniture_cost, 2)

    # 8. Grand Total & Rollup Summary
    subtotal_materials_and_labor = round(
        total_civil_materials_cost + total_labor_cost +
        total_electrical_cost + total_plumbing_cost + total_hvac_cost + total_furniture_cost, 2
    )

    # Contingency & Contractor Supervision (5%)
    contingency_cost = round(subtotal_materials_and_labor * 0.05, 2)
    grand_total_cost = round(subtotal_materials_and_labor + contingency_cost, 2)

    cost_per_sqft_builtup = round(grand_total_cost / builtup_sqft, 2) if builtup_sqft > 0 else 0.0
    cost_per_sqft_carpet = round(grand_total_cost / carpet_sqft, 2) if carpet_sqft > 0 else 0.0

    # Category Percentages
    pct_civil = round((total_civil_materials_cost / grand_total_cost) * 100, 1)
    pct_labor = round((total_labor_cost / grand_total_cost) * 100, 1)
    pct_electrical = round((total_electrical_cost / grand_total_cost) * 100, 1)
    pct_plumbing = round((total_plumbing_cost / grand_total_cost) * 100, 1)
    pct_hvac = round((total_hvac_cost / grand_total_cost) * 100, 1)
    pct_furniture = round((total_furniture_cost / grand_total_cost) * 100, 1)
    pct_contingency = round((contingency_cost / grand_total_cost) * 100, 1)

    return {
        "quality_tier": tier_key,
        "tier_name": specs["tier_name"],
        "tier_badge_color": specs["badge_color"],
        "tier_description": specs["description"],
        "summary": {
            "grand_total": grand_total_cost,
            "cost_per_sqft_builtup": cost_per_sqft_builtup,
            "cost_per_sqft_carpet": cost_per_sqft_carpet,
            "total_builtup_sqft": round(builtup_sqft, 1),
            "total_builtup_sqm": round(builtup_sqm, 2),
            "total_carpet_sqft": round(carpet_sqft, 1),
            "total_carpet_sqm": round(carpet_sqm, 2),
            "contingency_cost": contingency_cost,
            "subtotal": subtotal_materials_and_labor,
            "construction_duration_days": total_working_days,
            "construction_duration_months": total_calendar_months,
            "total_labor_mandays": total_labor_mandays,
            "total_labor_cost": total_labor_cost
        },
        "percentages": {
            "civil": pct_civil,
            "labor": pct_labor,
            "electrical": pct_electrical,
            "plumbing": pct_plumbing,
            "hvac": pct_hvac,
            "furniture": pct_furniture,
            "contingency": pct_contingency
        },
        "civil_materials": {
            "total_cost": total_civil_materials_cost,
            "solid_blocks_count": solid_blocks_count,
            "solid_block_unit_cost": civil_specs["brick_unit_cost"],
            "solid_blocks_cost": cost_bricks,
            "standard_bricks_count": standard_bricks_count,
            "standard_brick_unit_cost": civil_specs["red_brick_unit_cost"],
            "cement_total_bags": total_cement_bags,
            "cement_bag_cost": civil_specs["cement_bag_cost"],
            "cement_total_cost": cost_cement,
            "cement_brand": civil_specs["cement_brand"],
            "cement_breakdown": {
                "masonry_mortar_bags": cement_masonry_bags,
                "plastering_bags": cement_plaster_bags,
                "rcc_structure_bags": cement_rcc_bags,
                "flooring_screed_bags": cement_flooring_bags
            },
            "msand_cft": msand_cft,
            "msand_tons": msand_tons,
            "msand_cost": cost_msand,
            "psand_cft": psand_cft,
            "psand_tons": psand_tons,
            "psand_cost": cost_psand,
            "total_sand_cft": total_sand_cft,
            "total_sand_tons": total_sand_tons,
            "total_sand_cost": round(cost_msand + cost_psand, 2),
            "steel_kg": steel_kg,
            "steel_metric_tons": steel_metric_tons,
            "steel_cost": cost_steel,
            "aggregate_cft": aggregate_cft,
            "aggregate_tons": aggregate_tons,
            "aggregate_cost": cost_aggregate,
            "flooring_sqft": round(carpet_sqft, 1),
            "flooring_cost": cost_flooring,
            "wall_geometry": wall_quant
        },
        "construction_schedule": {
            "total_working_days": total_working_days,
            "total_months": total_calendar_months,
            "phases": timeline_phases
        },
        "labor": {
            "total_mandays": total_labor_mandays,
            "total_cost": total_labor_cost,
            "breakdown": labor_breakdown
        },
        "electrical": {
            "total_cost": total_electrical_cost,
            "items": electrical_breakdown
        },
        "plumbing": {
            "total_cost": total_plumbing_cost,
            "items": plumbing_breakdown
        },
        "hvac": {
            "total_cost": total_hvac_cost,
            "copper_piping_meters": copper_length_m,
            "copper_piping_cost": copper_pipe_cost,
            "brand_spec": mep_specs["hvac_brand_desc"],
            "items": hvac_items
        },
        "furniture": {
            "total_cost": total_furniture_cost,
            "finish_specification": furniture_specs["finish_description"],
            "items": furniture_items
        }
    }
