"""Bayesian optimization core: GP surrogate + Expected Improvement acquisition.

Deliberately hand-rolled on top of scikit-learn instead of ax-platform/botorch:
those pull in a heavy torch stack that's flaky to install on short notice, and
the actual math needed here (GP regression + EI over box constraints) is small
enough to own directly and explain to judges.
"""

from __future__ import annotations

import warnings

import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm
from sklearn.exceptions import ConvergenceWarning
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel

from .schemas import Objective, Parameter, TrialOut


class BayesianOptimizer:
    def __init__(self, parameters: list[Parameter], objective: Objective):
        self.parameters = parameters
        self.objective = objective
        self.dim = len(parameters)
        self.lo = np.array([p.min for p in parameters])
        self.hi = np.array([p.max for p in parameters])

    def _normalize(self, x: np.ndarray) -> np.ndarray:
        return (x - self.lo) / (self.hi - self.lo)

    def _denormalize(self, x01: np.ndarray) -> np.ndarray:
        return self.lo + x01 * (self.hi - self.lo)

    def _to_matrix(self, trials: list[TrialOut]) -> tuple[np.ndarray, np.ndarray]:
        X = np.array([[t.params[p.name] for p in self.parameters] for t in trials])
        y = np.array([t.objective_value for t in trials], dtype=float)
        if self.objective.goal == "minimize":
            y = -y
        return self._normalize(X), y

    def _fit_gp(
        self, X01: np.ndarray, y: np.ndarray, n_restarts: int = 6
    ) -> GaussianProcessRegressor:
        y_std = y.std() if y.std() > 1e-9 else 1.0
        y_norm = (y - y.mean()) / y_std
        kernel = ConstantKernel(1.0, (1e-2, 1e2)) * Matern(
            length_scale=[0.2] * self.dim, length_scale_bounds=(3e-2, 1.0), nu=2.5
        ) + WhiteKernel(noise_level=1e-2, noise_level_bounds=(1e-5, 0.5))
        gp = GaussianProcessRegressor(
            kernel=kernel, normalize_y=False, n_restarts_optimizer=n_restarts, random_state=0
        )
        # With only a handful of trials the fitted length scale routinely lands on
        # the bounds we deliberately set as regularization, so sklearn's warning
        # about that is expected noise rather than something to act on.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ConvergenceWarning)
            gp.fit(X01, y_norm)
        gp._y_mean_ = y.mean()
        gp._y_std_ = y_std
        return gp

    @staticmethod
    def _expected_improvement(
        gp: GaussianProcessRegressor, X01: np.ndarray, y_best_norm: float, xi: float = 0.01
    ) -> np.ndarray:
        mu, sigma = gp.predict(X01, return_std=True)
        sigma = np.maximum(sigma, 1e-9)
        improvement = mu - y_best_norm - xi
        z = improvement / sigma
        ei = improvement * norm.cdf(z) + sigma * norm.pdf(z)
        ei[sigma < 1e-9] = 0.0
        return ei

    def suggest(
        self,
        trials: list[TrialOut],
        n_candidates: int = 4000,
        rng_seed: int = 0,
        gp_restarts: int = 6,
        n_local_starts: int = 10,
    ):
        rng = np.random.default_rng(rng_seed)

        if len(trials) == 0:
            x01 = rng.uniform(size=self.dim)
            x = self._denormalize(x01)
            return {
                "params": {p.name: float(v) for p, v in zip(self.parameters, x)},
                "predicted_objective": None,
                "uncertainty": None,
                "expected_improvement": None,
                "best_observed": None,
                "n_trials": 0,
            }

        X01, y = self._to_matrix(trials)
        gp = self._fit_gp(X01, y, n_restarts=gp_restarts)
        y_norm = (y - gp._y_mean_) / gp._y_std_
        y_best_norm = y_norm.max()

        candidates = rng.uniform(size=(n_candidates, self.dim))
        ei = self._expected_improvement(gp, candidates, y_best_norm)

        if n_local_starts <= 0:
            # Coarse mode: take the best candidate straight from the vectorized
            # sweep. One batched predict is far cheaper than the hundreds of
            # single-point predicts L-BFGS needs, which matters when the demo
            # runs this hundreds of times over.
            best_idx = int(np.argmax(ei))
            best_x = candidates[best_idx]
            best_ei = float(ei[best_idx])
        else:
            top_idx = np.argsort(ei)[-n_local_starts:]
            best_x, best_ei = None, -np.inf
            for idx in top_idx:
                x0 = candidates[idx]
                res = minimize(
                    lambda x: -self._expected_improvement(gp, x.reshape(1, -1), y_best_norm)[0],
                    x0,
                    bounds=[(0.0, 1.0)] * self.dim,
                    method="L-BFGS-B",
                )
                if -res.fun > best_ei:
                    best_ei = -res.fun
                    best_x = np.clip(res.x, 0.0, 1.0)

        mu_norm, sigma_norm = gp.predict(best_x.reshape(1, -1), return_std=True)
        mu = mu_norm[0] * gp._y_std_ + gp._y_mean_
        sigma = sigma_norm[0] * gp._y_std_
        best_observed = y.max()

        if self.objective.goal == "minimize":
            mu, best_observed = -mu, -best_observed

        x_real = self._denormalize(best_x)
        return {
            "params": {p.name: float(v) for p, v in zip(self.parameters, x_real)},
            "predicted_objective": float(mu),
            "uncertainty": float(sigma),
            "expected_improvement": float(best_ei),
            "best_observed": float(best_observed),
            "n_trials": len(trials),
        }
