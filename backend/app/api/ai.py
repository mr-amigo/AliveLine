from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core import paddle
from app.core.deps import ai_claim, current_user_id, get_estimator, get_step_splitter
from app.core.security import decode_claim
from app.domain.estimation import Estimator, StepSplitter
from app.schemas.ai import EstimateOut, EstimateRequest, StepDraftOut, StepsOut, StepsRequest
from app.schemas.billing import PortalOut

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/estimate", response_model=EstimateOut)
def estimate(
    data: EstimateRequest, _: int = Depends(ai_claim("estimate")), estimator: Estimator = Depends(get_estimator)
) -> EstimateOut:
    """Hours estimate for an assignment text. Served by the AI Lambda in prod (CloudFront /api/ai/*);
    `source` is "heuristic" when the LLM is unavailable. Needs a claim from /api/billing/claim."""
    return EstimateOut(**asdict(estimator.estimate(data.title, data.description, data.course_name)))


@router.post("/steps", response_model=StepsOut)
def steps(
    data: StepsRequest, _: int = Depends(ai_claim("steps")), splitter: StepSplitter = Depends(get_step_splitter)
) -> StepsOut:
    """Suggested ordered steps for a big assignment (AI Lambda). Empty when a split isn't logical or AI is down."""
    drafts = splitter.split(data.title, data.description, data.course_name, data.hours)
    return StepsOut(steps=[StepDraftOut(**asdict(d)) for d in drafts])


@router.post("/portal", response_model=PortalOut)
def portal(request: Request, user_id: int = Depends(current_user_id)) -> PortalOut:
    """Paddle customer-portal link. Lives here because only the AI Lambda can reach Paddle's API;
    the customer id comes signed from /api/billing/portal-claim."""
    claim = decode_claim(request.headers.get("x-portal-claim", ""), "portal")
    if claim is None or claim.get("sub") != str(user_id) or not claim.get("ctm"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Billing permission missing or expired, try again")
    try:
        return PortalOut(url=paddle.portal_url(claim["ctm"], claim.get("sub_id")))
    except paddle.PaddleError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
