"""
utils.py — Haversine distance, realistic Hyderabad zone classification,
           area-level alert creation, activity logging.
"""

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import List
from fastapi import Request
from sqlalchemy.orm import Session

from models import Report, Alert, ActivityLog


# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )

    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_client_ip(request: Request) -> str:
    for header in ("x-forwarded-for", "x-real-ip"):
        if header in request.headers:
            return request.headers[header].split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_device_fingerprint(request: Request) -> str:
    user_agent = request.headers.get("user-agent", "unknown")
    accept = request.headers.get("accept", "")
    fingerprint = f"{user_agent}|{accept}"[:240]
    return fingerprint


def obfuscate_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked = "*" * len(local)
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


def log_activity(username: str, action: str, db: Session, meta: str = "") -> None:
    meta_text = f" | {meta}" if meta else ""
    db.add(ActivityLog(username=username, action=f"{action}{meta_text}", timestamp=_now()))
    db.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Realistic Hyderabad density thresholds ────────────────────────────────────
# Low:    1 000 – 3 000  → may contribute to GREEN
# Medium: 3 000 – 7 000  → may contribute to YELLOW
# High:   7 000 – 12 000 → may contribute to RED
DENSITY_HIGH   = 7000   # case_count above this → RED regardless
DENSITY_MEDIUM = 3000   # case_count above this → at least YELLOW

CLUSTER_RADIUS_KM  = 5.0
CLUSTER_RED_THRESH = 2   # ≥ 2 nearby clinics reporting same disease → RED


# ── Clinic-level zone ─────────────────────────────────────────────────────────

def compute_zone(report: Report, all_reports: List[Report]) -> dict:
    """
    GREEN  — isolated clinic, low case count
    YELLOW — 1 nearby clinic within 5 km (same disease) OR medium density
    RED    — ≥ 2 nearby clinics within 5 km (same disease) OR high density
    """
    nearby_clinics = []
    nearby_areas   = []

    for r in all_reports:
        if r.id == report.id:
            continue
        if r.disease_name.lower() != report.disease_name.lower():
            continue
        dist = haversine_km(report.latitude, report.longitude, r.latitude, r.longitude)
        if dist <= CLUSTER_RADIUS_KM:
            label = r.clinic_name if r.clinic_name else r.area_name
            nearby_clinics.append(label)
            if r.area_name not in nearby_areas:
                nearby_areas.append(r.area_name)

    cluster_count = len(nearby_clinics)
    cases         = report.case_count

    if cluster_count >= CLUSTER_RED_THRESH or cases > DENSITY_HIGH:
        zone = "RED"
    elif cluster_count >= 1 or cases > DENSITY_MEDIUM:
        zone = "YELLOW"
    else:
        zone = "GREEN"

    return {
        "zone":           zone,
        "cluster_count":  cluster_count,
        "nearby_clinics": nearby_clinics,
        "nearby_areas":   nearby_areas,
    }


# ── Area-level zone aggregation ───────────────────────────────────────────────

ZONE_PRIORITY = {"RED": 2, "YELLOW": 1, "GREEN": 0}


def aggregate_area_zones(reports: List[Report]) -> dict:
    """
    Compute ONE final zone per area (RED > YELLOW > GREEN).
    Returns: {area_id: {zone, area_name, clinics, diseases, total_cases, ...}}
    """
    area_map = defaultdict(lambda: {
        "area_id": "", "area_name": "",
        "zone_priority": 0, "zone": "GREEN",
        "clinic_zones": [],        # list of (clinic_name, zone)
        "clinics": set(),
        "diseases": set(),
        "total_cases": 0, "total_deaths": 0,
        "lat": 0.0, "lon": 0.0, "coord_count": 0,
    })

    for r in reports:
        info = compute_zone(r, reports)
        key  = r.area_id
        d    = area_map[key]

        d["area_id"]    = r.area_id
        d["area_name"]  = r.area_name
        d["clinics"].add(r.clinic_name or r.area_name)
        d["diseases"].add(r.disease_name)
        d["total_cases"]  += r.case_count
        d["total_deaths"] += r.death_count
        d["clinic_zones"].append((r.clinic_name or r.area_name, info["zone"]))

        # Running centroid for marker placement
        d["lat"] += r.latitude
        d["lon"] += r.longitude
        d["coord_count"] += 1

        # Escalate area zone
        prio = ZONE_PRIORITY[info["zone"]]
        if prio > d["zone_priority"]:
            d["zone_priority"] = prio
            d["zone"]          = info["zone"]

    result = {}
    for key, v in area_map.items():
        cnt = v["coord_count"] or 1
        result[key] = {
            "area_id":       v["area_id"],
            "area_name":     v["area_name"],
            "zone":          v["zone"],
            "latitude":      round(v["lat"] / cnt, 6),
            "longitude":     round(v["lon"] / cnt, 6),
            "clinic_count":  len(v["clinics"]),
            "clinic_names":  sorted(v["clinics"]),
            "diseases":      sorted(v["diseases"]),
            "disease_count": len(v["diseases"]),
            "total_cases":   v["total_cases"],
            "total_deaths":  v["total_deaths"],
            "clinic_zones":  v["clinic_zones"],
        }
    return result


# ── Area-level alert helpers ──────────────────────────────────────────────────

def _build_area_alert_message(zone: str, disease: str, area_name: str,
                               clinic_count: int, clinic_names: list) -> str:
    names_str = ", ".join(clinic_names[:4])
    if len(clinic_names) > 4:
        names_str += f" +{len(clinic_names)-4} more"

    if zone == "RED":
        return (
            f"🚨 High-risk {disease} cluster detected in {area_name} involving "
            f"{clinic_count} nearby clinic{'s' if clinic_count != 1 else ''}. "
            f"Affected: {names_str}."
        )
    else:
        return (
            f"⚠️ Warning-level {disease} activity in {area_name}. "
            f"{clinic_count} clinic{'s' if clinic_count != 1 else ''} reporting elevated cases. "
            f"Monitoring: {names_str}."
        )


def ensure_area_alert(area_id: str, area_name: str, disease: str,
                      zone: str, clinic_names: list, db: Session) -> None:
    """Create/update a single area-level alert per area+disease."""
    if zone == "GREEN":
        return

    count   = len(clinic_names)
    message = _build_area_alert_message(zone, disease, area_name, count, clinic_names)
    affected_str = ",".join(clinic_names[:10])

    existing = (
        db.query(Alert)
        .filter(
            Alert.area_id      == area_id,
            Alert.disease_name == disease,
            Alert.status       == "active",
        )
        .first()
    )

    if existing:
        existing.message          = message
        existing.clinics_involved = count
        existing.affected_clinics = affected_str
        existing.risk_level       = zone
        existing.timestamp        = _now()
        db.commit()
        return

    db.add(Alert(
        area_id          = area_id,
        area_name        = area_name,
        disease_name     = disease,
        message          = message,
        clinics_involved = count,
        affected_clinics = affected_str,
        risk_level       = zone,
        status           = "active",
        timestamp        = _now(),
    ))
    db.commit()


def refresh_area_alerts(db: Session) -> None:
    """
    Recompute area-level alerts from all current reports.
    Called after any report is submitted.
    """
    from collections import defaultdict

    reports   = db.query(Report).all()
    area_data = aggregate_area_zones(reports)

    # Build per-area per-disease clinic lists
    area_disease_clinics = defaultdict(lambda: defaultdict(set))
    for r in reports:
        info = compute_zone(r, reports)
        if info["zone"] != "GREEN":
            area_disease_clinics[r.area_id][r.disease_name].add(
                r.clinic_name or r.area_name
            )

    for area_id, area_info in area_data.items():
        # For each disease active in this area
        for disease in area_info["diseases"]:
            clinics = sorted(area_disease_clinics[area_id].get(disease, set()))
            # Determine worst zone for this area+disease combo
            worst = "GREEN"
            for r in reports:
                if r.area_id != area_id or r.disease_name != disease:
                    continue
                info = compute_zone(r, reports)
                if ZONE_PRIORITY[info["zone"]] > ZONE_PRIORITY[worst]:
                    worst = info["zone"]
            if worst != "GREEN":
                ensure_area_alert(area_id, area_info["area_name"], disease,
                                  worst, clinics, db)


# ── Activity logging ──────────────────────────────────────────────────────────

def log_activity(username: str, action: str, db: Session, meta: str = "") -> None:
    meta_text = f" | {meta}" if meta else ""
    db.add(ActivityLog(username=username, action=f"{action}{meta_text}", timestamp=_now()))
    db.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
