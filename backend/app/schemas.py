import math
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class Parameter(BaseModel):
    name: str
    min: float = Field(allow_inf_nan=False)
    max: float = Field(allow_inf_nan=False)
    unit: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("parameter name cannot be blank")
        return stripped

    @model_validator(mode="after")
    def range_must_be_valid(self):
        if self.min >= self.max:
            raise ValueError(
                f"parameter '{self.name}': min ({self.min:g}) must be strictly less than "
                f"max ({self.max:g})"
            )
        return self


class Objective(BaseModel):
    name: str
    goal: Literal["maximize", "minimize"] = "maximize"
    unit: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("objective name cannot be blank")
        return stripped


class SessionCreate(BaseModel):
    name: str
    parameters: list[Parameter] = Field(min_length=1)
    objective: Objective

    @model_validator(mode="after")
    def parameter_names_must_be_unique(self):
        seen: set[str] = set()
        dupes: list[str] = []
        for p in self.parameters:
            if p.name in seen and p.name not in dupes:
                dupes.append(p.name)
            seen.add(p.name)
        if dupes:
            raise ValueError(f"duplicate parameter names: {', '.join(dupes)}")
        if self.objective.name in seen:
            raise ValueError(
                f"objective name '{self.objective.name}' collides with a parameter name"
            )
        return self


class TrialIn(BaseModel):
    params: dict[str, float]
    objective_value: float = Field(allow_inf_nan=False)
    note: Optional[str] = None

    @field_validator("params")
    @classmethod
    def param_values_must_be_finite(cls, v: dict[str, float]) -> dict[str, float]:
        bad = [k for k, val in v.items() if not math.isfinite(val)]
        if bad:
            raise ValueError(f"non-finite values for: {', '.join(sorted(bad))}")
        return v


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


class ResultIn(TrialIn):
    pass


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
    n_replicates: int = Field(default=8, ge=1, le=25)


class CompareTrace(BaseModel):
    trial: int
    # median across replicates, with the interquartile band around it
    bayesopt_best: float
    bayesopt_lo: float
    bayesopt_hi: float
    random_best: float
    random_lo: float
    random_hi: float


class CompareResponse(BaseModel):
    trace: list[CompareTrace]
    bayesopt_final: float
    random_final: float
    true_optimum: float
    # distance from the true optimum, always >= 0 regardless of maximize/minimize
    bayesopt_gap: float
    random_gap: float
    n_replicates: int
    # fraction of replicates where BenchPilot strictly beat random search
    bayesopt_win_rate: float
    # trials BenchPilot needed to match random search's final median result
    trials_to_match: Optional[int]
