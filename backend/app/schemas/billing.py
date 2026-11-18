from typing import Literal

from pydantic import BaseModel, Field

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
    feature: Literal["estimate", "steps", "bulk"]
    #: For "estimate": the assignment being estimated (asking again for an AI-estimated one = re-estimate).
    assignment_id: int | None = None
    #: For "bulk": how many items the pass will estimate.
    count: int = Field(default=1, ge=1, le=30)


class ClaimOut(BaseModel):
    token: str
    feature: str
    billing: BillingOut


class PortalOut(BaseModel):
    url: str
