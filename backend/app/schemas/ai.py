from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EstimateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10_000)
    course_name: str | None = Field(default=None, max_length=100)


class EstimateOut(BaseModel):
    hours: float
    rationale: str
    source: Literal["ai", "heuristic"]


class StepsRequest(EstimateRequest):
    hours: float = Field(ge=0.5, le=100)  # the assignment's current estimate; steps add up to about this


class StepDraftOut(BaseModel):
    title: str
    hours: float


class StepsOut(BaseModel):
    steps: list[StepDraftOut]  # empty → the task is better done in one go
