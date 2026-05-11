"""
alert_routes.py — Area-level alert retrieval and acknowledgement
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Alert
from auth import get_current_user
from utils import log_activity, _now

router = APIRouter(tags=["Alerts"])


def _fmt(a):
    return {
        "id":               a.id,
        "area_id":          a.area_id,
        "area_name":        a.area_name,
        "disease_name":     a.disease_name,
        "message":          a.message,
        "clinics_involved": a.clinics_involved,
        "affected_clinics": a.affected_clinics.split(",") if a.affected_clinics else [],
        "risk_level":       a.risk_level,
        "status":           a.status,
        "timestamp":        a.timestamp,
    }


@router.get("/dashboard/alerts")
async def get_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alerts = db.query(Alert).order_by(Alert.id.desc()).all()
    return [_fmt(a) for a in alerts]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "acknowledged"
    db.commit()

    log_activity(
        current_user["username"],
        f"ACKNOWLEDGED ALERT #{alert_id} — {alert.disease_name} in {alert.area_name}",
        db,
    )
    return {"message": f"Alert #{alert_id} acknowledged"}
