"""
auth_routes.py — Login, logout, refresh, role previews, and demo access.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User, DeviceSession, RefreshToken, AccessRequest
from auth import (
    hash_password, verify_password, hash_token, verify_token,
    create_access_token, create_refresh_token,
    REFRESH_TOKEN_EXPIRE_DAYS, COOKIE_SECURE,
    ROLES, get_current_user, require_admin, enforce_rate_limit,
)
from utils import get_client_ip, get_device_fingerprint, log_activity, _now

router = APIRouter(tags=["Authentication"])


class LoginRequest(BaseModel):
    """`email` may be the user's registered email or username."""
    email: str
    password: str


class RequestDemoPayload(BaseModel):
    full_name: str
    email: EmailStr
    organization: str
    use_case: Optional[str] = ""


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    organization: Optional[str] = None


class ProvisionAccessRequestBody(BaseModel):
    provisioned_username: str = Field(..., min_length=1, max_length=64)


class CreateUserRequest(BaseModel):
    username: str
    password: str = Field(..., min_length=6)
    role: str = "clinic_staff"
    assigned_clinic: str = ""
    assigned_area: str = ""
    full_name: str = ""
    email: str = ""


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    assigned_clinic: Optional[str] = None
    assigned_area: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


ROLE_PREVIEWS = [
    {
        "role": "Super Admin",
        "scope": "Complete platform ownership with user and security controls.",
        "workflows": [
            "Provision trusted enterprise accounts",
            "Manage RBAC and audit policy",
            "Review security logs and session activity",
        ],
    },
    {
        "role": "Hospital Administrator",
        "scope": "Oversee outbreak intelligence for one or more hospitals.",
        "workflows": [
            "Approve clinical incident responses",
            "Monitor hospital cluster trends",
            "Authorize staff access and device safety",
        ],
    },
    {
        "role": "Clinic Staff",
        "scope": "Submit clinic-level reports and review local outbreak alerts.",
        "workflows": [
            "Record new case clusters",
            "Track treatment capacity",
            "Sync updates to area health officers",
        ],
    },
    {
        "role": "Public Health Officer",
        "scope": "Coordinate area-wide surveillance and response workflows.",
        "workflows": [
            "Review district risk dashboards",
            "Validate alerts and mitigation plans",
            "Authorize public health communications",
        ],
    },
    {
        "role": "Analyst",
        "scope": "Analyze historic trends and predictive outbreak signals.",
        "workflows": [
            "Generate trend analytics",
            "Validate predictive models",
            "Export intelligence summaries",
        ],
    },
    {
        "role": "Read-Only Observer",
        "scope": "Securely monitor reports without data modification access.",
        "workflows": [
            "View audit trails",
            "Track activity summaries",
            "Consume secure reporting dashboards",
        ],
    },
]


def _create_device_session(user: User, request: Request, db: Session) -> DeviceSession:
    device_name = request.headers.get("x-device-name") or request.headers.get("user-agent", "Web Browser").split(")")[0]
    session = DeviceSession(
        session_id=secrets.token_urlsafe(22),
        username=user.username,
        device_name=device_name,
        device_fingerprint=get_device_fingerprint(request),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        trusted=False,
        created_at=_now(),
        last_seen_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    await enforce_rate_limit(request)

    login_id = (body.email or "").strip()
    if not login_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter your email or username")

    user = (
        db.query(User)
        .filter((User.email == login_id) | (User.username == login_id))
        .first()
    )
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    device_session = _create_device_session(user, request, db)

    user.last_login_at = _now()
    db.commit()

    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        extra={
            "assigned_clinic": user.assigned_clinic or "",
            "assigned_area": user.assigned_area or "",
            "full_name": user.full_name or "",
            "session_id": device_session.session_id,
        },
    )

    refresh_token_id, refresh_token = create_refresh_token()
    db.add(RefreshToken(
        token_id=refresh_token_id,
        token_hash=hash_token(refresh_token),
        username=user.username,
        device_session_id=device_session.id,
        created_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=f"{refresh_token_id}.{refresh_token}",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )

    log_activity(user.username, "LOGIN_SUCCESS", db, meta=f"ip={get_client_ip(request)}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "role_label": ROLES.get(user.role, user.role),
        "assigned_clinic": user.assigned_clinic or "",
        "assigned_area": user.assigned_area or "",
        "full_name": user.full_name or "",
        "trusted_device": bool(device_session.trusted),
    }


@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    cookie = request.cookies.get("refresh_token")
    if not cookie or "." not in cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    refresh_id, refresh_secret = cookie.split(".", 1)
    refresh = db.query(RefreshToken).filter(RefreshToken.token_id == refresh_id, RefreshToken.revoked == False).first()
    if not refresh or datetime.now(timezone.utc) > datetime.fromisoformat(refresh.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

    if not verify_token(refresh_secret, refresh.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    refresh.revoked = True
    db.commit()

    user = db.query(User).filter(User.username == refresh.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_refresh_id, new_refresh_secret = create_refresh_token()
    db.add(RefreshToken(
        token_id=new_refresh_id,
        token_hash=hash_token(new_refresh_secret),
        username=user.username,
        device_session_id=refresh.device_session_id,
        created_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=f"{new_refresh_id}.{new_refresh_secret}",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )

    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        extra={
            "assigned_clinic": user.assigned_clinic or "",
            "assigned_area": user.assigned_area or "",
            "full_name": user.full_name or "",
            "session_id": refresh.device_session_id or "",
        },
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "role_label": ROLES.get(user.role, user.role),
    }


@router.post("/logout")
async def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cookie = request.cookies.get("refresh_token")
    if cookie and "." in cookie:
        refresh_id, _ = cookie.split(".", 1)
        refresh = db.query(RefreshToken).filter(RefreshToken.token_id == refresh_id).first()
        if refresh:
            refresh.revoked = True
            db.commit()

    response.delete_cookie("refresh_token", path="/")
    log_activity(current_user["username"], "LOGOUT", db, meta=f"ip={get_client_ip(request)}")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        **current_user,
        "role_label": ROLES.get(current_user["role"], current_user["role"]),
    }


@router.get("/auth/roles")
async def role_previews() -> List[dict]:
    return ROLE_PREVIEWS


@router.post("/request-demo")
async def request_demo_access(body: RequestDemoPayload, request: Request, db: Session = Depends(get_db)):
    use_case = (body.use_case or "").strip()[:5000]
    row = AccessRequest(
        full_name=body.full_name.strip(),
        email=str(body.email).strip(),
        organization=body.organization.strip(),
        use_case=use_case,
        created_at=_now(),
    )
    db.add(row)
    db.commit()

    meta = f"email={body.email} organization={body.organization}"
    if use_case:
        meta += f" use_case={use_case[:500]}"
    log_activity("anonymous", "REQUEST_DEMO_ACCESS", db, meta=meta)
    return {
        "message": "Your request has been recorded. A member of the EPICAST team will follow up within one business day.",
    }


@router.get("/admin/access-requests")
async def list_access_requests(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(AccessRequest).order_by(AccessRequest.id.desc()).limit(500).all()
    return [
        {
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "organization": r.organization,
            "use_case": r.use_case or "",
            "created_at": r.created_at,
            "provisioned_username": r.provisioned_username or "",
            "provisioned_at": r.provisioned_at or "",
        }
        for r in rows
    ]


@router.patch("/admin/access-requests/{request_id}")
async def mark_access_request_provisioned(
    request_id: int,
    body: ProvisionAccessRequestBody,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")
    row.provisioned_username = body.provisioned_username.strip()
    row.provisioned_at = _now()
    db.commit()
    log_activity(
        current_user["username"],
        f"ACCESS REQUEST #{request_id} PROVISIONED as {row.provisioned_username}",
        db,
    )
    return {"message": "Request marked as provisioned", "provisioned_username": row.provisioned_username}


@router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    log_activity(body.username or body.email, "FORGOT_PASSWORD_REQUEST", db, meta=f"email={body.email}")
    return {
        "message": "If this account exists, you will receive password reset instructions shortly.",
    }


@router.get("/auth/sessions")
async def active_sessions(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(DeviceSession).filter(DeviceSession.username == current_user["username"], DeviceSession.revoked == False).all()
    return [
        {
            "device_name": s.device_name,
            "ip_address": s.ip_address,
            "trusted": s.trusted,
            "last_seen_at": s.last_seen_at,
            "expires_at": s.expires_at,
        }
        for s in sessions
    ]


@router.get("/admin/users")
async def list_users(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [
        {
            "id":              u.id,
            "username":        u.username,
            "role":            u.role,
            "role_label":      ROLES.get(u.role, u.role),
            "assigned_clinic": u.assigned_clinic or "",
            "assigned_area":   u.assigned_area or "",
            "full_name":       u.full_name or "",
            "email":           u.email or "",
        }
        for u in users
    ]


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {list(ROLES.keys())}")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=body.username,
        password=hash_password(body.password),
        role=body.role,
        assigned_clinic=body.assigned_clinic,
        assigned_area=body.assigned_area,
        full_name=body.full_name,
        email=body.email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(current_user["username"], f"CREATED USER: {body.username} ({body.role})", db)
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "message": "User created successfully",
    }


@router.patch("/admin/users/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = body.role
    if body.assigned_clinic is not None:
        user.assigned_clinic = body.assigned_clinic
    if body.assigned_area is not None:
        user.assigned_area = body.assigned_area
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.password is not None and body.password.strip():
        user.password = hash_password(body.password)

    db.commit()
    log_activity(current_user["username"], f"UPDATED USER: {user.username}", db)
    return {"message": f"User {user.username} updated"}


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
    log_activity(current_user["username"], f"DELETED USER: {user.username}", db)
    return {"message": f"User {user.username} deleted"}
