from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.core.deps import current_user_id, get_estimator
from app.domain.estimation import Estimator
from app.schemas.ai import EstimateOut, EstimateRequest

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/estimate", response_model=EstimateOut)
def estimate(
    data: EstimateRequest, _: int = Depends(current_user_id), estimator: Estimator = Depends(get_estimator)
) -> EstimateOut:
    """Hours estimate for an assignment text. Served by the AI Lambda in prod (CloudFront /api/ai/*);
    `source` is "heuristic" when the LLM is unavailable."""
    return EstimateOut(**asdict(estimator.estimate(data.title, data.description, data.course_name)))
