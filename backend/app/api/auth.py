import os
import time
from collections import defaultdict
from dataclasses import dataclass

from fastapi import Header, HTTPException
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Admin emails — comma-separated in env, unlimited queries
ADMIN_EMAILS = set(
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "").split(",")
    if e.strip()
)

_supabase = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, _SUPABASE_SERVICE_KEY)
    return _supabase


@dataclass
class AuthUser:
    id: str
    email: str
    is_admin: bool


async def get_current_user(authorization: str = Header(default="")) -> AuthUser:
    """Extract and verify user from Supabase JWT. Returns AuthUser."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization[7:]

    try:
        sb = _get_supabase()
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = user_response.user
        email = (user.email or "").lower()
        return AuthUser(
            id=user.id,
            email=email,
            is_admin=email in ADMIN_EMAILS,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Rate Limiter ──────────────────────────────────────────────────

QUERY_LIMIT = 15
WINDOW_SECONDS = 12 * 60 * 60  # 12 hours

# In-memory store: user_id -> list of timestamps
_query_timestamps: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(user: AuthUser) -> dict:
    """
    Check if user is within rate limit. Admins are always allowed.
    Returns dict with:
    - allowed: bool
    - remaining: int (queries left, -1 for unlimited)
    - reset_in: int (seconds until next query available, 0 if allowed)
    """
    if user.is_admin:
        return {"allowed": True, "remaining": -1, "reset_in": 0}

    now = time.time()
    cutoff = now - WINDOW_SECONDS

    timestamps = [t for t in _query_timestamps[user.id] if t > cutoff]
    _query_timestamps[user.id] = timestamps

    remaining = max(0, QUERY_LIMIT - len(timestamps))

    if len(timestamps) >= QUERY_LIMIT:
        oldest = min(timestamps)
        reset_in = int((oldest + WINDOW_SECONDS) - now)
        return {"allowed": False, "remaining": 0, "reset_in": max(0, reset_in)}

    return {"allowed": True, "remaining": remaining, "reset_in": 0}


def record_query(user: AuthUser) -> int:
    """Record a query and return remaining count. Returns -1 for admins (unlimited)."""
    if user.is_admin:
        return -1

    _query_timestamps[user.id].append(time.time())
    now = time.time()
    cutoff = now - WINDOW_SECONDS
    active = [t for t in _query_timestamps[user.id] if t > cutoff]
    _query_timestamps[user.id] = active
    return max(0, QUERY_LIMIT - len(active))
