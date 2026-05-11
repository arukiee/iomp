"""
auth.py — JWT creation/validation, password hashing, role-based access dependencies
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Iterable
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from cache import redis_client

# ── Secret & algorithm ────────────────────────────────────────────────────────
SECRET_KEY             = os.getenv("EPICAST_SECRET_KEY", "EPICAST_SUPER_SECRET_2024_CHANGE_IN_PROD")
ALGORITHM              = "HS512"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS  = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
COOKIE_SECURE          = os.getenv("COOKIE_SECURE", "False").lower() in ("true", "1", "yes")
RATE_LIMIT_WINDOW      = 60
RATE_LIMIT_MAX_ATTEMPTS= 6

# ── Valid roles and permissions ───────────────────────────────────────────────
ROLES = {
    "admin":                 "Super Admin",
    "hospital_staff":        "Hospital Administrator",
    "clinic_staff":          "Clinic Staff",
    "public_health_officer": "Public Health Officer",
    "analyst":               "Analyst",
    "observer":              "Read-Only Observer",
}

READ_ONLY_ROLES = {"public_health_officer", "observer"}

ROLE_PERMISSIONS = {
    "admin": ["manage_users", "view_audit", "manage_sessions", "submit_reports", "review_alerts"],
    "hospital_staff": ["view_reports", "submit_reports", "view_alerts"],
    "clinic_staff": ["view_reports", "submit_reports"],
    "public_health_officer": ["view_reports", "view_alerts"],
    "analyst": ["view_reports", "view_forecasts", "view_alerts"],
    "observer": ["view_reports"],
}

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_token(value: str) -> str:
    return pwd_context.hash(value)


def verify_token(value: str, hashed: str) -> bool:
    return pwd_context.verify(value, hashed)


def create_access_token(subject: str, role: str, extra: dict = None,
                        expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "jti": str(uuid4()),
        # jose/python-jose requires iat as NumericDate (int), not an ISO string
        "iat": int(now.timestamp()),
    }
    if extra:
        payload.update(extra)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    token_id = str(uuid4())
    token = secrets.token_urlsafe(42)
    return token_id, token


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided")
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token subject missing")
    return {
        "username":        username,
        "role":            payload.get("role", "clinic_staff"),
        "assigned_clinic": payload.get("assigned_clinic", ""),
        "assigned_area":   payload.get("assigned_area", ""),
        "full_name":       payload.get("full_name", ""),
        "session_id":      payload.get("session_id", ""),
    }


def require_roles(*allowed_roles: Iterable[str]):
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return current_user
    return dependency


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_reporter(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] in READ_ONLY_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Role '{current_user['role']}' cannot submit reports")
    return current_user


def require_staff_or_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ("admin", "hospital_staff", "clinic_staff"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff or Admin access required")
    return current_user

async def _increment_rate_limit(key: str) -> int:
    if redis_client:
        try:
            value = await redis_client.incr(key)
            if value == 1:
                await redis_client.expire(key, RATE_LIMIT_WINDOW)
            return int(value)
        except Exception:
            pass

    # Local in-memory fallback for development and simple testing
    if not hasattr(_increment_rate_limit, "store"):
        _increment_rate_limit.store = {}

    now = datetime.now(timezone.utc)
    bucket = _increment_rate_limit.store.get(key, {"count": 0, "reset": now})
    if now >= bucket["reset"]:
        bucket = {"count": 0, "reset": now + timedelta(seconds=RATE_LIMIT_WINDOW)}
    bucket["count"] += 1
    _increment_rate_limit.store[key] = bucket
    return bucket["count"]

async def enforce_rate_limit(request: Request) -> str:
    key = f"rl:{request.client.host if request.client else 'unknown'}"
    attempts = await _increment_rate_limit(key)
    if attempts > RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait one minute before retrying.",
        )
    return key
