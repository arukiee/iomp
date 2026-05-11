"""
main.py — Epicast FastAPI entry point
"""

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
from models import Base, User
from auth import hash_password

from routes.auth_routes      import router as auth_router
from routes.report_routes    import router as report_router
from routes.dashboard_routes import router as dashboard_router
from routes.alert_routes     import router as alert_router
from routes.log_routes       import router as log_router

ALLOWED_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://localhost:5176").split(",")

app = FastAPI(
    title   = "Epicast — Hyderabad Disease Outbreak Intelligence API",
    version = "3.0.0",
    docs_url="/docs", redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["Cache-Control"] = "no-store"
    return response

app.include_router(auth_router)
app.include_router(report_router)
app.include_router(dashboard_router)
app.include_router(alert_router)
app.include_router(log_router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _ensure_access_request_columns()
    _seed_users()
    _seed_hyderabad_data()


def _ensure_access_request_columns():
    """SQLite: add provision columns if DB was created before those fields existed."""
    url = str(engine.url)
    if not url.startswith("sqlite"):
        return
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            rows = conn.execute(text("PRAGMA table_info(access_requests)")).fetchall()
        except Exception:
            return
        names = {r[1] for r in rows}
        if "provisioned_username" not in names:
            conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_username VARCHAR DEFAULT ''"))
        if "provisioned_at" not in names:
            conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_at VARCHAR DEFAULT ''"))


def _seed_users():
    """Create default users for all roles if they don't exist."""
    db = SessionLocal()
    try:
        defaults = [
            # (username, password, role, assigned_clinic, assigned_area, full_name, email)
            ("admin",       "admin123",   "admin",               "",                    "",              "System Admin",              "admin@epicast.health"),
            ("dr_aig",      "clinic123",  "clinic_staff",        "AIG Hospital",        "Gachibowli",    "Dr. AIG Staff",             "dr.aig@epicast.health"),
            ("dr_apollo",   "clinic123",  "clinic_staff",        "Apollo Hospital",     "Jubilee Hills", "Dr. Apollo Staff",          "dr.apollo@epicast.health"),
            ("dr_yashoda",  "clinic123",  "clinic_staff",        "Yashoda Hospital",    "Secunderabad",  "Dr. Yashoda Staff",         "dr.yashoda@epicast.health"),
            ("hosp_gachi",  "hospital123","hospital_staff",      "",                    "Gachibowli",    "Gachibowli Hospital Admin", "admin.gachi@epicast.health"),
            ("hosp_jubil",  "hospital123","hospital_staff",      "",                    "Jubilee Hills", "Jubilee Hills Hospital Admin","admin.jubil@epicast.health"),
            ("pho_hyd",     "pho123",     "public_health_officer","",                   "",              "PHO Hyderabad",             "pho.hyd@epicast.health"),
        ]
        for uname, pwd, role, clinic, area, fname, email in defaults:
            user = db.query(User).filter(User.username == uname).first()
            if not user:
                db.add(User(
                    username        = uname,
                    password        = hash_password(pwd),
                    role            = role,
                    assigned_clinic = clinic,
                    assigned_area   = area,
                    full_name       = fname,
                    email           = email,
                ))
            elif not user.email:  # Update existing user if email is missing
                user.email = email
                db.commit()
        db.commit()
        print("[Epicast] ✔ Default users seeded")
    finally:
        db.close()


def _seed_hyderabad_data():
    from models import Report
    from utils import _now, refresh_area_alerts
    from datetime import datetime, timedelta, timezone

    db = SessionLocal()
    try:
        if db.query(Report).count() > 0:
            return

        import random
        random.seed(42)

        clinics = [
            # (area_id, area_name, clinic_name, lat, lon)
            ("HYD-GACHI","Gachibowli",   "AIG Hospital",              17.4400,78.3489),
            ("HYD-GACHI","Gachibowli",   "Continental Hospital",       17.4338,78.3536),
            ("HYD-GACHI","Gachibowli",   "Medicover Clinic",           17.4450,78.3520),
            ("HYD-JUBIL","Jubilee Hills","Apollo Hospital",             17.4239,78.4071),
            ("HYD-JUBIL","Jubilee Hills","Rainbow Hospital",            17.4300,78.4100),
            ("HYD-JUBIL","Jubilee Hills","Olive Clinic",                17.4200,78.4130),
            ("HYD-BANJA","Banjara Hills","Care Hospitals",              17.4126,78.4482),
            ("HYD-BANJA","Banjara Hills","Ankura Hospital",             17.4160,78.4440),
            ("HYD-BANJA","Banjara Hills","MaxCure Hospital",            17.4180,78.4500),
            ("HYD-HTECH","Hitech City",  "Yashoda Hitech",             17.4486,78.3908),
            ("HYD-HTECH","Hitech City",  "Shalini Hospital",           17.4510,78.3950),
            ("HYD-HTECH","Hitech City",  "Primus Clinic",              17.4460,78.3870),
            ("HYD-MADHA","Madhapur",     "Seven Hills Hospital",        17.4525,78.3913),
            ("HYD-MADHA","Madhapur",     "Madhava Clinic",             17.4550,78.3940),
            ("HYD-MADHA","Madhapur",     "Lotus Healthcare",           17.4480,78.3920),
            ("HYD-KUKAT","Kukatpally",   "KIMS Hospital",              17.4849,78.4138),
            ("HYD-KUKAT","Kukatpally",   "Mediwin Hospital",           17.4870,78.4160),
            ("HYD-KUKAT","Kukatpally",   "SunCare Clinic",             17.4820,78.4120),
            ("HYD-SECUN","Secunderabad", "Yashoda Hospital",           17.4399,78.4983),
            ("HYD-SECUN","Secunderabad", "Sunshine Hospital",          17.4420,78.5000),
            ("HYD-SECUN","Secunderabad", "Care Clinic",                17.4370,78.4960),
            ("HYD-AMEER","Ameerpet",     "Vijaya Hospital",            17.4375,78.4483),
            ("HYD-AMEER","Ameerpet",     "Vaibhav Clinic",             17.4395,78.4510),
            ("HYD-AMEER","Ameerpet",     "Ameerpet Health Centre",     17.4360,78.4460),
            ("HYD-LBNGA","LB Nagar",     "Rajeev Gandhi Hospital",     17.3472,78.5511),
            ("HYD-LBNGA","LB Nagar",     "Sparsh Hospital",            17.3490,78.5530),
            ("HYD-LBNGA","LB Nagar",     "LB General Clinic",          17.3450,78.5490),
            ("HYD-UPPAL","Uppal",        "Uppal General Hospital",     17.4055,78.5592),
            ("HYD-UPPAL","Uppal",        "City Care Clinic",           17.4070,78.5610),
            ("HYD-UPPAL","Uppal",        "Medicity Hospital",          17.4040,78.5570),
            ("HYD-KONDA","Kondapur",     "Aware Gleneagles Hospital",  17.4600,78.3724),
            ("HYD-KONDA","Kondapur",     "Kondapur Health Clinic",     17.4620,78.3750),
            ("HYD-KONDA","Kondapur",     "Synergy Hospitals",          17.4580,78.3700),
            ("HYD-MIYAP","Miyapur",      "Citizens Specialty Hospital",17.4963,78.3553),
            ("HYD-MIYAP","Miyapur",      "Miyapur Clinic",             17.4980,78.3570),
            ("HYD-MIYAP","Miyapur",      "Amrutha Hospital",           17.4940,78.3530),
            ("HYD-BEGUM","Begumpet",     "NIMS",                       17.4350,78.4651),
            ("HYD-BEGUM","Begumpet",     "Begumpet Health Centre",     17.4370,78.4670),
            ("HYD-BEGUM","Begumpet",     "Sterling Hospital",          17.4330,78.4630),
            ("HYD-TARNA","Tarnaka",      "Tarnaka Area Hospital",      17.4289,78.5424),
            ("HYD-TARNA","Tarnaka",      "St. Theresa's Clinic",       17.4310,78.5440),
            ("HYD-TARNA","Tarnaka",      "Osmania General Hospital",   17.3888,78.4771),
            ("HYD-CHARM","Charminar",    "Government General Hospital",17.3800,78.4741),
            ("HYD-CHARM","Charminar",    "Charminar Clinic",           17.3610,78.4720),
            ("HYD-CHARM","Charminar",    "Al-Shifa Hospital",          17.3580,78.4700),
        ]

        diseases = ["Dengue","Cholera","Malaria","COVID-19","Typhoid"]
        now = datetime.now(timezone.utc)

        for i, (area_id, area_name, clinic_name, lat, lon) in enumerate(clinics):
            disease = diseases[i % len(diseases)]
            for day_offset in range(0, 14, 3):
                ts = (now - timedelta(days=day_offset)).isoformat()
                # Realistic case counts: 50–2500 (not 20–800 which pushed density too high)
                cases  = random.randint(50, 2500)
                deaths = random.randint(0, max(1, cases // 80))
                db.add(Report(
                    area_id      = area_id,
                    area_name    = area_name,
                    clinic_name  = clinic_name,
                    latitude     = lat,
                    longitude    = lon,
                    disease_name = disease,
                    case_count   = cases,
                    death_count  = deaths,
                    timestamp    = ts,
                ))

        db.commit()
        refresh_area_alerts(db)

        total = db.query(Report).count()
        print(f"[Epicast] ✔ Hyderabad data seeded — {total} reports, {len(clinics)} clinics")
    finally:
        db.close()


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "app": "Epicast", "version": "3.0.0", "focus": "Hyderabad"}
