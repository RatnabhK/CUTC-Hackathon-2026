"""Plain-English explanation of a suggestion.

Uses the Claude API when ANTHROPIC_API_KEY is set. The model is only ever
handed numbers already computed by the optimizer (predicted objective,
uncertainty, expected improvement, best observed) and instructed to explain
them, never to invent its own numbers or recommend different parameters -
the optimizer stays the sole source of the recommendation.
"""

from __future__ import annotations

import os

import httpx

from .schemas import ExplainRequest

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-5-20250929"


def _template_explanation(req: ExplainRequest) -> str:
    s = req.suggestion
    param_str = ", ".join(f"{k}={v:.3g}" for k, v in s.params.items())
    lines = [f"- Next suggested experiment: {param_str}."]
    if s.n_trials == 0:
        lines.append("- No prior trials yet, so this point was chosen to spread out and map the space.")
        return "\n".join(lines)
    lines.append(
        f"- Predicted {req.objective.name}: {s.predicted_objective:.3g} "
        f"± {s.uncertainty:.3g} (1 std), based on {s.n_trials} trial(s) so far."
    )
    if s.best_observed is not None:
        lines.append(f"- Best result observed to date: {s.best_observed:.3g}.")
    lines.append(
        f"- Expected improvement score: {s.expected_improvement:.4g} — this balances trying a point "
        "predicted to beat the current best (exploitation) against a point the model is still "
        "uncertain about (exploration)."
    )
    return "\n".join(lines)


async def explain(req: ExplainRequest) -> tuple[str, str]:
    if not ANTHROPIC_API_KEY:
        return _template_explanation(req), "template"

    s = req.suggestion
    param_str = ", ".join(f"{k}={v:.4g}" for k, v in s.params.items())
    prompt = (
        f"A Bayesian optimization model evaluated {s.n_trials} prior experiment(s) and selected the "
        f"parameter combination {param_str} as the next experiment to run, targeting "
        f"{req.objective.goal} of {req.objective.name}.\n"
        f"Predicted {req.objective.name}: {s.predicted_objective}\n"
        f"Uncertainty (1 std dev): {s.uncertainty}\n"
        f"Expected improvement score: {s.expected_improvement}\n"
        f"Best result observed so far: {s.best_observed}\n\n"
        "Using only these exact numbers (do not invent any others, do not suggest different "
        "parameters), explain in 2-3 concise bullet points why this balances exploration vs. "
        "exploitation for the researcher. Plain language, no headers."
    )
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = "".join(block.get("text", "") for block in data.get("content", []))
            if text.strip():
                return text.strip(), "llm"
    except Exception:
        pass
    return _template_explanation(req), "template"
