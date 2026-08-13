from typing import Literal, Optional

from pydantic import BaseModel, Field


class Parameter(BaseModel):
    name: str
    min: float
    max: float
    unit: Optional[str] = None


class Objective(BaseModel):
    name: str
    goal: Literal["maximize", "minimize"] = "maximize"
    unit: Optional[str] = None


class SessionCreate(BaseModel):
    name: str
    parameters: list[Parameter]
    objective: Objective


class TrialIn(BaseModel):
    params: dict[str, float]
    objective_value: float
    note: Optional[str] = None


class TrialOut(TrialIn):
    id: str
    source: Literal["historical", "suggested"] = "historical"


class SessionOut(BaseModel):
    id: str
    name: str
    parameters: list[Parameter]
    objective: Objective
    trials: list[TrialOut]


class Suggestion(BaseModel):
    params: dict[str, float]
    predicted_objective: Optional[float]
    uncertainty: Optional[float]
    expected_improvement: Optional[float]
    best_observed: Optional[float]
    n_trials: int


class ResultIn(BaseModel):
    params: dict[str, float]
    objective_value: float
    note: Optional[str] = None


class ExplainRequest(BaseModel):
    suggestion: Suggestion
    parameters: list[Parameter]
    objective: Objective


class ExplainResponse(BaseModel):
    explanation: str
    source: Literal["llm", "template"]


class CompareRequest(BaseModel):
    n_trials: int = Field(default=18, ge=3, le=60)
    seed: Optional[int] = None


class CompareTrace(BaseModel):
    trial: int
    bayesopt_best: float
    random_best: float


class CompareResponse(BaseModel):
    trace: list[CompareTrace]
    bayesopt_final: float
    random_final: float
    true_optimum: float
