"""Synthetic ground-truth generator used only for the demo comparison view.

Builds a reproducible, bumpy "yield landscape" over the session's own search
space so the BayesianOptimizer vs. random-search comparison is meaningful for
whatever parameters the user actually defined, without needing real lab data.
"""

from __future__ import annotations

import numpy as np

from .optimizer import BayesianOptimizer
from .schemas import CompareResponse, CompareTrace, Objective, Parameter, TrialOut


class SyntheticLandscape:
    """Multimodal landscape built from several distinct local optima (max of
    bumps, not sum) so a lucky random sample can't accidentally saturate the
    global max by landing in the overlap of several bumps at once."""

    def __init__(self, dim: int, seed: int = 42, n_bumps: int = 6):
        rng = np.random.default_rng(seed)
        self.centers = rng.uniform(0.1, 0.9, size=(n_bumps, dim))
        self.widths = rng.uniform(0.05, 0.14, size=n_bumps)
        self.heights = rng.uniform(0.5, 0.85, size=n_bumps)
        self.heights[rng.integers(0, n_bumps)] = 1.0  # guarantee a clear global max
        self.dim = dim

    def eval01(self, x01: np.ndarray) -> float:
        d2 = np.sum((self.centers - x01) ** 2, axis=1)
        bump = self.heights * np.exp(-d2 / (2 * self.widths**2))
        return float(np.max(bump))

    def true_optimum01(self, n_grid: int = 20000, seed: int = 0) -> float:
        rng = np.random.default_rng(seed)
        samples = rng.uniform(size=(n_grid, self.dim))
        vals = [self.eval01(s) for s in samples]
        return float(np.max(vals))


def _make_trial(parameters: list[Parameter], x01: np.ndarray, value: float, idx: int) -> TrialOut:
    lo = np.array([p.min for p in parameters])
    hi = np.array([p.max for p in parameters])
    x_real = lo + x01 * (hi - lo)
    return TrialOut(
        id=f"synthetic-{idx}",
        params={p.name: float(v) for p, v in zip(parameters, x_real)},
        objective_value=float(value),
        source="suggested",
    )


def run_comparison(
    parameters: list[Parameter], objective: Objective, n_trials: int, seed: int | None = None
) -> CompareResponse:
    seed = seed if seed is not None else 7
    dim = len(parameters)
    landscape = SyntheticLandscape(dim=dim, seed=seed)

    def scale(v01: float) -> float:
        # map the (possibly overlapping-bump, >1) landscape value to a plausible yield percentage
        v01 = min(max(v01, 0.0), 1.0)
        raw = 35.0 + 60.0 * v01
        return raw if objective.goal == "maximize" else 100.0 - raw

    rng = np.random.default_rng(seed)
    n_warm = min(3, n_trials)
    warm_x01 = rng.uniform(size=(n_warm, dim))
    warm_vals = [scale(landscape.eval01(x) + rng.normal(0, 0.02)) for x in warm_x01]

    bo_trials = [_make_trial(parameters, x, v, i) for i, (x, v) in enumerate(zip(warm_x01, warm_vals))]
    rand_trials_vals = list(warm_vals)

    optimizer = BayesianOptimizer(parameters, objective)
    trace: list[CompareTrace] = []

    def best_so_far(vals: list[float]) -> float:
        arr = np.array(vals)
        return float(arr.max()) if objective.goal == "maximize" else float(arr.min())

    trace.append(
        CompareTrace(trial=n_warm, bayesopt_best=best_so_far(warm_vals), random_best=best_so_far(warm_vals))
    )

    for i in range(n_warm, n_trials):
        suggestion = optimizer.suggest(bo_trials, n_candidates=1500, rng_seed=seed + i)
        lo = np.array([p.min for p in parameters])
        hi = np.array([p.max for p in parameters])
        x_real = np.array([suggestion["params"][p.name] for p in parameters])
        x01 = (x_real - lo) / (hi - lo)
        bo_value = scale(landscape.eval01(x01) + rng.normal(0, 0.02))
        bo_trials.append(_make_trial(parameters, x01, bo_value, i))

        rand_x01 = rng.uniform(size=dim)
        rand_value = scale(landscape.eval01(rand_x01) + rng.normal(0, 0.02))
        rand_trials_vals.append(rand_value)

        trace.append(
            CompareTrace(
                trial=i + 1,
                bayesopt_best=best_so_far([t.objective_value for t in bo_trials]),
                random_best=best_so_far(rand_trials_vals),
            )
        )

    true_opt01 = landscape.true_optimum01(seed=seed)
    true_optimum = scale(true_opt01)

    return CompareResponse(
        trace=trace,
        bayesopt_final=trace[-1].bayesopt_best,
        random_final=trace[-1].random_best,
        true_optimum=true_optimum,
    )
