"""Minimal Paddle Billing API client (AI Lambda only: the backend Lambda has no internet)."""

import json
import urllib.request

from app.core.config import get_settings

API = {"sandbox": "https://sandbox-api.paddle.com", "production": "https://api.paddle.com"}


class PaddleError(Exception):
    pass


def portal_url(customer_id: str, subscription_id: str | None) -> str:
    """One-time customer portal link (manage card, cancel, invoices)."""
    s = get_settings()
    if not s.paddle_api_key:
        raise PaddleError("Payments are not configured")
    body = {"subscription_ids": [subscription_id]} if subscription_id else {}
    req = urllib.request.Request(
        f"{API.get(s.paddle_env, API['sandbox'])}/customers/{customer_id}/portal-sessions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {s.paddle_api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 (fixed https host)
            return str(json.load(resp)["data"]["urls"]["general"]["overview"])
    except (OSError, KeyError, ValueError) as e:
        raise PaddleError("Could not open the billing portal, try again") from e
