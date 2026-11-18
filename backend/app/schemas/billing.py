from typing import Literal

from pydantic import BaseModel

from app.schemas.common import UtcDatetime


class CheckoutConfig(BaseModel):
    environment: str
    client_token: str
    prices: dict[str, str]


class BillingOut(BaseModel):
    plan: Literal["free", "pro"]
    plan_until: UtcDatetime | None
    subscription_status: str | None
    can_manage: bool
    trials_left: dict[str, int]
    ai_used: int
    ai_limit: int
    #: null → checkout not open for this account yet (UI shows "Pro coming soon").
    checkout: CheckoutConfig | None = None


class ClaimIn(BaseModel):
    feature: Literal["estimate", "steps"]
    #: For "estimate": the assignment being estimated (asking again for an AI-estimated one = re-estimate).
    assignment_id: int | None = None


class ClaimOut(BaseModel):
    token: str
    feature: str
    billing: BillingOut


class PortalOut(BaseModel):
    url: str
