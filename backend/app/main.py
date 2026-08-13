import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import llm, synthetic
from .optimizer import BayesianOptimizer
from .schemas import (
    CompareRequest,
    CompareResponse,
    ExplainRequest,
    ExplainResponse,
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


@app.post("/api/sessions", response_model=SessionOut)
def create_session(body: SessionCreate):
    if len(body.parameters) == 0:
        raise HTTPException(status_code=400, detail="at least one parameter is required")
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
        missing = [p.name for p in session.parameters if p.name not in t.params]
        if missing:
            raise HTTPException(status_code=400, detail=f"trial missing parameters: {missing}")
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
    missing = [p.name for p in session.parameters if p.name not in body.params]
    if missing:
        raise HTTPException(status_code=400, detail=f"result missing parameters: {missing}")
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
    return synthetic.run_comparison(session.parameters, session.objective, body.n_trials, body.seed)


@app.get("/api/health")
def health():
    return {"status": "ok"}
