import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import llm, synthetic
from .optimizer import BayesianOptimizer
from .schemas import (
    CompareRequest,
    CompareResponse,
    ExplainRequest,
    ExplainResponse,
    Parameter,
    ResultIn,
    SessionCreate,
    SessionOut,
    Suggestion,
    TrialIn,
    TrialOut,
)
from .store import store

app = FastAPI(title="BenchPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    """Flatten pydantic's nested error payload into one readable sentence.

    The UI surfaces `detail` directly, so a raw pydantic dump would be unreadable
    for the researcher filling in the form.
    """
    messages = []
    for err in exc.errors():
        msg = err.get("msg", "invalid value")
        msg = msg.removeprefix("Value error, ")
        loc = [str(p) for p in err.get("loc", []) if p not in ("body",)]
        messages.append(f"{'.'.join(loc)}: {msg}" if loc else msg)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


def _session_out(session) -> SessionOut:
    return SessionOut(
        id=session.id,
        name=session.name,
        parameters=session.parameters,
        objective=session.objective,
        trials=session.trials,
    )


def _get_session(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


def _validate_against_space(params: dict[str, float], parameters: list[Parameter]) -> None:
    """Reject trials that don't line up with the session's declared search space.

    Out-of-range points would be normalized outside [0, 1] for the GP while the
    acquisition optimizer stays clamped to the box, so the model would be fit on
    a region it can never propose from.
    """
    declared = {p.name for p in parameters}
    missing = sorted(declared - params.keys())
    if missing:
        raise HTTPException(
            status_code=400, detail=f"missing values for parameter(s): {', '.join(missing)}"
        )

    unknown = sorted(params.keys() - declared)
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"unknown parameter(s) not in this search space: {', '.join(unknown)}",
        )

    out_of_range = [
        f"{p.name}={params[p.name]:g} (allowed {p.min:g} to {p.max:g})"
        for p in parameters
        if not (p.min <= params[p.name] <= p.max)
    ]
    if out_of_range:
        raise HTTPException(
            status_code=400, detail=f"value(s) outside the search space: {'; '.join(out_of_range)}"
        )


@app.post("/api/sessions", response_model=SessionOut)
def create_session(body: SessionCreate):
    session = store.create(body.name, body.parameters, body.objective)
    return _session_out(session)


@app.get("/api/sessions", response_model=list[SessionOut])
def list_sessions():
    return [_session_out(s) for s in store.list()]


@app.get("/api/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: str):
    return _session_out(_get_session(session_id))


@app.post("/api/sessions/{session_id}/trials", response_model=SessionOut)
def add_trials(session_id: str, trials: list[TrialIn]):
    session = _get_session(session_id)
    for t in trials:
        _validate_against_space(t.params, session.parameters)
    for t in trials:
        store.add_trial(
            session_id,
            TrialOut(
                id=str(uuid.uuid4()),
                params=t.params,
                objective_value=t.objective_value,
                note=t.note,
                source="historical",
            ),
        )
    return _session_out(_get_session(session_id))


@app.get("/api/sessions/{session_id}/suggest", response_model=Suggestion)
def suggest(session_id: str):
    session = _get_session(session_id)
    optimizer = BayesianOptimizer(session.parameters, session.objective)
    result = optimizer.suggest(session.trials)
    return Suggestion(**result)


@app.post("/api/sessions/{session_id}/results", response_model=SessionOut)
def submit_result(session_id: str, body: ResultIn):
    session = _get_session(session_id)
    _validate_against_space(body.params, session.parameters)
    store.add_trial(
        session_id,
        TrialOut(
            id=str(uuid.uuid4()),
            params=body.params,
            objective_value=body.objective_value,
            note=body.note,
            source="suggested",
        ),
    )
    return _session_out(_get_session(session_id))


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(body: ExplainRequest):
    text, source = await llm.explain(body)
    return ExplainResponse(explanation=text, source=source)


@app.post("/api/sessions/{session_id}/compare", response_model=CompareResponse)
def compare(session_id: str, body: CompareRequest):
    session = _get_session(session_id)
    return synthetic.run_comparison(
        session.parameters,
        session.objective,
        body.n_trials,
        body.seed,
        body.n_replicates,
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
