"""
report_routes.py — Clinic-level disease reports with role-based access control.
- Admin / hospital_staff: can report for any clinic
- clinic_staff: can only report for their assigned_clinic
- public_health_officer: read-only, cannot submit
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Report
from auth import get_current_user, require_reporter
from utils import compute_zone, refresh_area_alerts, log_activity

router = APIRouter(tags=["Reports"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CaseReportRequest(BaseModel):
    area_id:      str
    area_name:    str
    clinic_name:  str = ""
    latitude:     float = Field(..., ge=-90,  le=90)
    longitude:    float = Field(..., ge=-180, le=180)
    disease_name: str
    case_count:   int  = Field(0, ge=0)
    date:         Optional[str] = None


class DeathReportRequest(BaseModel):
    area_id:      str
    area_name:    str
    clinic_name:  str = ""
    latitude:     float = Field(..., ge=-90,  le=90)
    longitude:    float = Field(..., ge=-180, le=180)
    disease_name: str
    death_count:  int  = Field(0, ge=0)
    date:         Optional[str] = None


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _check_clinic_permission(current_user: dict, clinic_name: str):
    """Clinic staff can only report for their assigned clinic."""
    if current_user["role"] == "clinic_staff":
        assigned = current_user.get("assigned_clinic", "")
        if assigned and clinic_name and clinic_name != assigned:
            raise HTTPException(
                status_code=403,
                detail=f"You can only submit reports for your assigned clinic: {assigned}"
            )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/report_case", status_code=status.HTTP_201_CREATED)
async def report_case(
    body: CaseReportRequest,
    current_user: dict = Depends(require_reporter),
    db: Session = Depends(get_db),
):
    _check_clinic_permission(current_user, body.clinic_name)

    report = Report(
        area_id      = body.area_id,
        area_name    = body.area_name,
        clinic_name  = body.clinic_name,
        latitude     = body.latitude,
        longitude    = body.longitude,
        disease_name = body.disease_name,
        case_count   = body.case_count,
        death_count  = 0,
        timestamp    = body.date or _now_iso(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    all_reports = db.query(Report).all()
    zone_info   = compute_zone(report, all_reports)
    refresh_area_alerts(db)

    clinic_label = body.clinic_name or body.area_name
    log_activity(current_user["username"], f"SUBMITTED CASE REPORT: {body.disease_name} at {clinic_label}", db)

    return {
        "id":             report.id,
        "message":        "Case report submitted",
        "zone":           zone_info["zone"],
        "cluster_count":  zone_info["cluster_count"],
        "nearby_clinics": zone_info["nearby_clinics"],
    }


@router.post("/report_death", status_code=status.HTTP_201_CREATED)
async def report_death(
    body: DeathReportRequest,
    current_user: dict = Depends(require_reporter),
    db: Session = Depends(get_db),
):
    _check_clinic_permission(current_user, body.clinic_name)

    existing = (
        db.query(Report)
        .filter(
            Report.area_id      == body.area_id,
            Report.clinic_name  == body.clinic_name,
            Report.disease_name == body.disease_name,
        )
        .order_by(Report.id.desc())
        .first()
    )

    if existing:
        existing.death_count += body.death_count
        existing.timestamp    = _now_iso()
        db.commit()
        db.refresh(existing)
        report = existing
    else:
        report = Report(
            area_id      = body.area_id,
            area_name    = body.area_name,
            clinic_name  = body.clinic_name,
            latitude     = body.latitude,
            longitude    = body.longitude,
            disease_name = body.disease_name,
            case_count   = 0,
            death_count  = body.death_count,
            timestamp    = body.date or _now_iso(),
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    all_reports = db.query(Report).all()
    zone_info   = compute_zone(report, all_reports)
    refresh_area_alerts(db)

    clinic_label = body.clinic_name or body.area_name
    log_activity(current_user["username"], f"SUBMITTED DEATH REPORT: {body.disease_name} at {clinic_label}", db)

    return {
        "id":             report.id,
        "message":        "Death report submitted",
        "zone":           zone_info["zone"],
        "cluster_count":  zone_info["cluster_count"],
        "nearby_clinics": zone_info["nearby_clinics"],
    }


@router.get("/reports")
async def get_reports(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log_activity(current_user["username"], "VIEWED REPORTS", db)
    q = db.query(Report)

    # Clinic staff: filter to their clinic only
    if current_user["role"] == "clinic_staff" and current_user.get("assigned_clinic"):
        q = q.filter(Report.clinic_name == current_user["assigned_clinic"])
    # Hospital staff: filter to their area
    elif current_user["role"] == "hospital_staff" and current_user.get("assigned_area"):
        q = q.filter(Report.area_name == current_user["assigned_area"])

    reports = q.order_by(Report.id.desc()).all()
    return [
        {
            "id":           r.id,
            "area_id":      r.area_id,
            "area_name":    r.area_name,
            "clinic_name":  r.clinic_name,
            "latitude":     r.latitude,
            "longitude":    r.longitude,
            "disease_name": r.disease_name,
            "case_count":   r.case_count,
            "death_count":  r.death_count,
            "timestamp":    r.timestamp,
        }
        for r in reports
    ]
