from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import current_user, get_db
from app.domain.billing import Feature, LimitReached
from app.models import User
from app.schemas.billing import BillingOut, ClaimIn, ClaimOut
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("", response_model=BillingOut)
def get_billing(user: User = Depends(current_user)) -> BillingOut:
    return BillingOut(**billing_service.summary(user), checkout=billing_service.checkout_config(user))


@router.post("/claim", response_model=ClaimOut)
def claim(data: ClaimIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ClaimOut:
    """Counts an AI use against the plan's limits; the token goes to the AI Lambda in `X-AI-Claim`.
    402 = Pro needed (trials used up), 429 = monthly AI cap."""
    try:
        out = billing_service.claim(db, user, Feature(data.feature), data.assignment_id)
    except LimitReached as e:
        code = status.HTTP_402_PAYMENT_REQUIRED if e.pro_required else status.HTTP_429_TOO_MANY_REQUESTS
        raise HTTPException(code, str(e)) from e
    return ClaimOut(**out)


@router.post("/portal-claim")
def portal_claim(user: User = Depends(current_user)) -> dict[str, str]:
    """Signed customer id for the AI Lambda, which asks Paddle for a portal link (backend has no internet)."""
    token = billing_service.portal_claim(user)
    if token is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No subscription yet")
    return {"token": token}


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request, db: Session = Depends(get_db), paddle_signature: str | None = Header(default=None)) -> dict[str, str]:
    """Paddle notifications (subscription.*). Bad signature → 400 (never 403: CloudFront maps it to the SPA)."""
    raw = await request.body()
    try:
        result = billing_service.apply_webhook(db, raw, paddle_signature)
    except billing_service.InvalidWebhook as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return {"result": result}
