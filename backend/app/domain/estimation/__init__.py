"""Workload estimation strategies (pure domain; see docs/PLAN.md §5)."""
from app.domain.estimation.base import Estimate, Estimator
from app.domain.estimation.heuristic import HeuristicEstimator

__all__ = ["Estimate", "Estimator", "HeuristicEstimator"]
