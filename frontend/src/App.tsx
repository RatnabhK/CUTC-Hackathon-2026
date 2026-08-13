import { useState } from "react";
import { api } from "./api";
import { SetupForm } from "./components/SetupForm";
import { TrialsPanel } from "./components/TrialsPanel";
import { SuggestionPanel } from "./components/SuggestionPanel";
import { HistoryChart } from "./components/HistoryChart";
import { CompareDemo } from "./components/CompareDemo";
import type { Objective, Parameter, SessionOut } from "./types";

type Tab = "optimize" | "demo";

function App() {
  const [session, setSession] = useState<SessionOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>("optimize");

  const createSession = async (name: string, parameters: Parameter[], objective: Objective) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.createSession(name, parameters, objective);
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refreshSession = async () => {
    if (!session) return;
    const s = await api.getSession(session.id);
    setSession(s);
    setRefreshKey((k) => k + 1);
  };

  const addHistoricalTrial = async (
    params: Record<string, number>,
    objective_value: number,
    note?: string
  ) => {
    if (!session) return;
    setBusy(true);
    try {
      const s = await api.addTrials(session.id, [{ params, objective_value, note }]);
      setSession(s);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◎</span> BenchPilot
        </div>
        <span className="tagline">Bayesian-optimal next experiment, every time.</span>
        {session && (
          <button className="ghost-btn" onClick={() => setSession(null)}>
            new session
          </button>
        )}
      </header>

      <main>
        {!session && <SetupForm onCreate={createSession} busy={busy} error={error} />}

        {session && (
          <>
            <div className="session-header">
              <h1>{session.name}</h1>
              <span className="muted">
                {session.objective.goal} {session.objective.name}
                {session.objective.unit ? ` (${session.objective.unit})` : ""} over{" "}
                {session.parameters.map((p) => p.name).join(", ")}
              </span>
            </div>

            <div className="tabs">
              <button className={tab === "optimize" ? "tab active" : "tab"} onClick={() => setTab("optimize")}>
                Optimize
              </button>
              <button className={tab === "demo" ? "tab active" : "tab"} onClick={() => setTab("demo")}>
                Demo: BenchPilot vs. Random
              </button>
            </div>

            {tab === "optimize" && (
              <div className="grid">
                <div className="col">
                  <TrialsPanel
                    parameters={session.parameters}
                    objective={session.objective}
                    trials={session.trials}
                    onAdd={addHistoricalTrial}
                    busy={busy}
                  />
                  <HistoryChart trials={session.trials} objective={session.objective} />
                </div>
                <div className="col">
                  <SuggestionPanel
                    sessionId={session.id}
                    parameters={session.parameters}
                    objective={session.objective}
                    refreshKey={refreshKey}
                    onResultSubmitted={refreshSession}
                  />
                </div>
              </div>
            )}

            {tab === "demo" && (
              <CompareDemo sessionId={session.id} objectiveName={session.objective.name} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
