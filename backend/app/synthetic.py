"""Synthetic ground-truth generator used only for the demo comparison view.

Builds a reproducible, bumpy "yield landscape" over the session's own search
space so the BayesianOptimizer vs. random-search comparison is meaningful for
whatever parameters the user actually defined, without needing real lab data.

A single run against random search proves very little — random search gets lucky
sometimes. So the comparison runs several independent replicates on the same
landscape (varying only the starting points and the random draws) and reports
the median with an interquartile band, plus how often BenchPilot actually won.
"""

from __future__ import annotations

import numpy as np

from .optimizer import BayesianOptimizer
from .schemas import CompareResponse, CompareTrace, Objective, Parameter, TrialOut

# Cheaper optimizer settings for the demo: this runs n_replicates x n_trials
# GP fits, so the full-quality settings used for real recommendations would make
# the demo take far too long to sit through.
_DEMO_GP_RESTARTS = 1
_DEMO_CANDIDATES = 1500
# Coarse argmax over the candidate sweep instead of L-BFGS refinement. Besides
# being cheaper, it measured *better* here (~0.81 vs ~0.73 win rate): refining
# hard onto sharp EI peaks over-exploits on a multimodal landscape, while the
# sweep keeps more spread. The real recommendation path still refines.
_DEMO_LOCAL_STARTS = 0

_NOISE_SD = 0.02


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

    def true_optimum01(self) -> float:
        """Exact global max.

        Because eval01 takes the max over bumps, every point scores at most the
        height of some bump, and the centre of the tallest bump attains exactly
        that height. No sampling needed.
        """
        return float(self.heights.max())


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


def _is_better(a: float, b: float, goal: str) -> bool:
    return a > b if goal == "maximize" else a < b


def _run_replicate(
    parameters: list[Parameter],
    objective: Objective,
    landscape: SyntheticLandscape,
    scale,
    n_trials: int,
    n_warm: int,
    rep_seed: int,
) -> tuple[list[float], list[float]]:
    """One head-to-head run. Returns (benchpilot_curve, random_curve) of
    best-so-far values, both starting from the same warm-start observations."""
    dim = len(parameters)
    rng = np.random.default_rng(rep_seed)
    lo = np.array([p.min for p in parameters])
    hi = np.array([p.max for p in parameters])

    def observe(x01: np.ndarray) -> float:
        return scale(landscape.eval01(x01) + rng.normal(0, _NOISE_SD))

    warm_x01 = rng.uniform(size=(n_warm, dim))
    warm_vals = [observe(x) for x in warm_x01]

    bo_trials = [_make_trial(parameters, x, v, i) for i, (x, v) in enumerate(zip(warm_x01, warm_vals))]
    bo_vals = list(warm_vals)
    rand_vals = list(warm_vals)

    optimizer = BayesianOptimizer(parameters, objective)

    def best_so_far(vals: list[float]) -> float:
        return float(max(vals)) if objective.goal == "maximize" else float(min(vals))

    bo_curve = [best_so_far(bo_vals)]
    rand_curve = [best_so_far(rand_vals)]

    for i in range(n_warm, n_trials):
        suggestion = optimizer.suggest(
            bo_trials,
            n_candidates=_DEMO_CANDIDATES,
            rng_seed=rep_seed + i,
            gp_restarts=_DEMO_GP_RESTARTS,
            n_local_starts=_DEMO_LOCAL_STARTS,
        )
        x_real = np.array([suggestion["params"][p.name] for p in parameters])
        x01 = (x_real - lo) / (hi - lo)
        bo_value = observe(x01)
        bo_trials.append(_make_trial(parameters, x01, bo_value, i))
        bo_vals.append(bo_value)

        rand_vals.append(observe(rng.uniform(size=dim)))

        bo_curve.append(best_so_far(bo_vals))
        rand_curve.append(best_so_far(rand_vals))

    return bo_curve, rand_curve


def run_comparison(
    parameters: list[Parameter],
    objective: Objective,
    n_trials: int,
    seed: int | None = None,
    n_replicates: int = 8,
) -> CompareResponse:
    seed = seed if seed is not None else 7
    dim = len(parameters)
    landscape = SyntheticLandscape(dim=dim, seed=seed)

    def scale(v01: float) -> float:
        # map the landscape value to a plausible yield percentage
        v01 = min(max(v01, 0.0), 1.0)
        raw = 35.0 + 60.0 * v01
        return raw if objective.goal == "maximize" else 100.0 - raw

    n_warm = min(3, n_trials)

    bo_runs: list[list[float]] = []
    rand_runs: list[list[float]] = []
    for r in range(n_replicates):
        bo_curve, rand_curve = _run_replicate(
            parameters, objective, landscape, scale, n_trials, n_warm, rep_seed=seed * 1000 + r
        )
        bo_runs.append(bo_curve)
        rand_runs.append(rand_curve)

    bo = np.array(bo_runs)  # (replicates, steps)
    rand = np.array(rand_runs)

    # For minimization the "better" tail is the low one, so the band bounds swap.
    lo_pct, hi_pct = 25, 75
    bo_med = np.median(bo, axis=0)
    rand_med = np.median(rand, axis=0)
    bo_lo = np.percentile(bo, lo_pct, axis=0)
    bo_hi = np.percentile(bo, hi_pct, axis=0)
    rand_lo = np.percentile(rand, lo_pct, axis=0)
    rand_hi = np.percentile(rand, hi_pct, axis=0)

    trace = [
        CompareTrace(
            trial=n_warm + i,
            bayesopt_best=float(bo_med[i]),
            bayesopt_lo=float(bo_lo[i]),
            bayesopt_hi=float(bo_hi[i]),
            random_best=float(rand_med[i]),
            random_lo=float(rand_lo[i]),
            random_hi=float(rand_hi[i]),
        )
        for i in range(bo.shape[1])
    ]

    true_optimum = scale(landscape.true_optimum01())
    bo_final = float(bo_med[-1])
    rand_final = float(rand_med[-1])

    wins = sum(
        1 for r in range(n_replicates) if _is_better(bo[r, -1], rand[r, -1], objective.goal)
    )

    # How many trials BenchPilot needed to reach random search's *final* result.
    trials_to_match: int | None = None
    for i in range(bo.shape[1]):
        if bo_med[i] == rand_final or _is_better(bo_med[i], rand_final, objective.goal):
            trials_to_match = n_warm + i
            break

    return CompareResponse(
        trace=trace,
        bayesopt_final=bo_final,
        random_final=rand_final,
        true_optimum=true_optimum,
        bayesopt_gap=abs(true_optimum - bo_final),
        random_gap=abs(true_optimum - rand_final),
        n_replicates=n_replicates,
        bayesopt_win_rate=wins / n_replicates,
        trials_to_match=trials_to_match,
    )
