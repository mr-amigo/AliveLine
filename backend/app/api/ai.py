from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.core.deps import current_user_id, get_estimator, get_step_splitter
from app.domain.estimation import Estimator, StepSplitter
from app.schemas.ai import EstimateOut, EstimateRequest, StepDraftOut, StepsOut, StepsRequest

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/estimate", response_model=EstimateOut)
def estimate(
    data: EstimateRequest, _: int = Depends(current_user_id), estimator: Estimator = Depends(get_estimator)
) -> EstimateOut:
    """Hours estimate for an assignment text. Served by the AI Lambda in prod (CloudFront /api/ai/*);
    `source` is "heuristic" when the LLM is unavailable."""
    return EstimateOut(**asdict(estimator.estimate(data.title, data.description, data.course_name)))


@router.post("/steps", response_model=StepsOut)
def steps(
    data: StepsRequest, _: int = Depends(current_user_id), splitter: StepSplitter = Depends(get_step_splitter)
) -> StepsOut:
    """Suggested ordered steps for a big assignment (AI Lambda). Empty when a split isn't logical or AI is down."""
    drafts = splitter.split(data.title, data.description, data.course_name, data.hours)
    return StepsOut(steps=[StepDraftOut(**asdict(d)) for d in drafts])
