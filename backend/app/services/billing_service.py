"""Plans, usage limits and Paddle webhooks."""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import utcnow
from app.core.security import create_claim
from app.domain import billing
from app.domain.billing import Feature, Usage
from app.models import Assignment, BillingEvent, User

log = logging.getLogger("aliveline")

AI_AUDIENCE = "ai"
PORTAL_AUDIENCE = "portal"
SIGNATURE_TOLERANCE = timedelta(minutes=5)


class InvalidWebhook(Exception):
    pass


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; everything stored is UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt is not None and dt.tzinfo is None else dt


def user_is_pro(user: User, now: datetime | None = None) -> bool:
    return billing.is_pro(user.plan, _aware(user.plan_until), now or utcnow())


def _usage(user: User) -> Usage:
    return Usage(trial_uses=dict(user.trial_uses or {}), ai_month=user.ai_month, ai_month_count=user.ai_month_count or 0)


def summary(user: User, now: datetime | None = None) -> dict[str, Any]:
    """Plan + remaining limits, shown in Settings and next to Pro features."""
    now = now or utcnow()
    pro = user_is_pro(user, now)
    return {
        "plan": "pro" if pro else "free",
        "plan_until": _aware(user.plan_until) if pro else None,
        "subscription_status": user.paddle_status,
        "can_manage": bool(user.paddle_customer_id),
        "trials_left": billing.trials_left(user.trial_uses or {}),
        "ai_used": billing.ai_used_this_month(_usage(user), now),
        "ai_limit": billing.MONTHLY_AI["pro" if pro else "free"],
    }


def checkout_config(user: User) -> dict[str, Any] | None:
    """Paddle.js settings, or None when checkout isn't open to this user yet (sandbox → testers only)."""
    s = get_settings()
    if not (s.paddle_client_token and s.paddle_price_monthly and s.paddle_price_yearly):
        return None
    testers = {e.strip().lower() for e in s.billing_testers.split(",") if e.strip()}
    if s.paddle_env != "production" and user.email not in testers:
        return None
    return {
        "environment": s.paddle_env,
        "client_token": s.paddle_client_token,
        "prices": {"monthly": s.paddle_price_monthly, "yearly": s.paddle_price_yearly},
    }


def claim(db: Session, user: User, feature: Feature, assignment_id: int | None = None, count: int = 1) -> dict[str, Any]:
    """Counts one use of an AI feature and returns a signed permission for the AI Lambda.

    Asking again for an assignment the AI already estimated is a re-estimate (Pro feature with trials).
    Raises billing.LimitReached.
    """
    now = utcnow()
    if feature is Feature.ESTIMATE and assignment_id is not None:
        a = db.get(Assignment, assignment_id)
        if a is not None and a.user_id == user.id and a.estimate_source == "ai":
            feature = Feature.REESTIMATE
    calls = count if feature is Feature.BULK else 1
    usage = _usage(user)
    billing.consume(usage, feature, calls, user_is_pro(user, now), now)
    user.trial_uses, user.ai_month, user.ai_month_count = usage.trial_uses, usage.ai_month, usage.ai_month_count
    db.commit()
    scope = "steps" if feature is Feature.STEPS else "estimate"
    # A bulk pass makes many sequential calls with one claim; single calls need only a moment.
    token = create_claim(user.id, AI_AUDIENCE, 15 if feature is Feature.BULK else 2, scope=scope)
    return {"token": token, "feature": feature.value, "billing": summary(user, now)}


def portal_claim(user: User) -> str | None:
    if not user.paddle_customer_id:
        return None
    extra = {"ctm": user.paddle_customer_id}
    if user.paddle_subscription_id:
        extra["sub_id"] = user.paddle_subscription_id
    return create_claim(user.id, PORTAL_AUDIENCE, 2, **extra)


def verify_signature(raw: bytes, header: str | None, secret: str, now: datetime) -> None:
    """Paddle-Signature: `ts=<unix>;h1=<hex hmac-sha256 of "ts:body">`."""
    if not header:
        raise InvalidWebhook("missing signature")
    parts = dict(p.split("=", 1) for p in header.split(";") if "=" in p)
    ts, h1 = parts.get("ts", ""), parts.get("h1", "")
    if not ts.isdigit() or abs(now.timestamp() - int(ts)) > SIGNATURE_TOLERANCE.total_seconds():
        raise InvalidWebhook("stale signature")
    expected = hmac.new(secret.encode(), f"{ts}:".encode() + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, h1):
        raise InvalidWebhook("bad signature")


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def _find_user(db: Session, data: dict[str, Any]) -> User | None:
    user_id = (data.get("custom_data") or {}).get("user_id")
    if user_id is not None and str(user_id).isdigit():
        user = db.get(User, int(user_id))
        if user is not None:
            return user
    if data.get("id"):
        user = db.scalar(select(User).where(User.paddle_subscription_id == data["id"]))
        if user is not None:
            return user
    if data.get("customer_id"):
        return db.scalar(select(User).where(User.paddle_customer_id == data["customer_id"]))
    return None


def apply_webhook(db: Session, raw: bytes, signature: str | None, now: datetime | None = None) -> str:
    """Verifies and applies one Paddle notification; returns what happened (for logs/tests)."""
    secret = get_settings().paddle_webhook_secret
    if not secret:
        raise InvalidWebhook("webhooks not configured")
    now = now or utcnow()
    verify_signature(raw, signature, secret, now)
    event = json.loads(raw)
    event_id, event_type = str(event.get("event_id", "")), str(event.get("event_type", ""))
    if not event_id or db.get(BillingEvent, event_id) is not None:
        return "duplicate"
    db.add(BillingEvent(event_id=event_id, event_type=event_type))
    result = "ignored"
    if event_type.startswith("subscription."):
        result = _apply_subscription(db, event.get("data") or {}, _parse_dt(event.get("occurred_at")) or now)
    db.commit()
    log.info("paddle webhook %s %s: %s", event_type, event_id, result)
    return result


def _apply_subscription(db: Session, data: dict[str, Any], occurred_at: datetime) -> str:
    user = _find_user(db, data)
    if user is None:
        return "unknown user"
    last = _aware(user.billing_event_at)
    if last is not None and occurred_at < last:
        return "out of order"
    status = str(data.get("status", ""))
    period_end = _parse_dt((data.get("current_billing_period") or {}).get("ends_at"))
    user.plan, user.plan_until = billing.subscription_plan(status, period_end)
    # Cancelled in the portal: Paddle keeps "active" until the period ends, with a scheduled cancel.
    scheduled = data.get("scheduled_change") or {}
    user.paddle_status = "cancels" if status in billing.PRO_STATUSES and scheduled.get("action") == "cancel" else status
    user.paddle_subscription_id = data.get("id") or user.paddle_subscription_id
    user.paddle_customer_id = data.get("customer_id") or user.paddle_customer_id
    user.billing_event_at = occurred_at
    return f"{user.plan} ({status})"


def reset_billing(db: Session, email: str) -> dict[str, Any]:
    """Ops (testing): back to a fresh Free account: plan, Paddle link, trial uses and monthly AI count."""
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        return {"reset": False}
    user.plan, user.plan_until = "free", None
    user.paddle_customer_id = user.paddle_subscription_id = user.paddle_status = None
    user.billing_event_at = None
    user.trial_uses, user.ai_month, user.ai_month_count = {}, None, 0
    db.commit()
    return {"reset": True}


def grant_pro(db: Session, email: str, days: int) -> dict[str, Any]:
    """Ops: give Pro by hand (testers, friends); `days=0` takes it back."""
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        return {"granted": False}
    user.plan = "pro" if days > 0 else "free"
    user.plan_until = utcnow() + timedelta(days=days) if days > 0 else None
    db.commit()
    return {"granted": days > 0, "plan_until": user.plan_until.isoformat() if user.plan_until else None}
