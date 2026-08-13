import uuid
from dataclasses import dataclass, field

from .schemas import Objective, Parameter, TrialOut


@dataclass
class Session:
    id: str
    name: str
    parameters: list[Parameter]
    objective: Objective
    trials: list[TrialOut] = field(default_factory=list)


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, Session] = {}

    def create(self, name: str, parameters: list[Parameter], objective: Objective) -> Session:
        session_id = str(uuid.uuid4())
        session = Session(id=session_id, name=name, parameters=parameters, objective=objective)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def add_trial(self, session_id: str, trial: TrialOut) -> None:
        self._sessions[session_id].trials.append(trial)

    def list(self) -> list[Session]:
        return list(self._sessions.values())


store = SessionStore()
