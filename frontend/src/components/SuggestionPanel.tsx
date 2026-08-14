import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import { AnimatedNumber } from "./AnimatedNumber";
import { ConfidenceBar } from "./ConfidenceBar";
import { Spinner } from "./Spinner";
import type { Objective, Parameter, Suggestion } from "../types";

interface Props {
  sessionId: string;
  parameters: Parameter[];
  objective: Objective;
  refreshKey: number;
  onResultSubmitted: () => Promise<void>;
}

export function SuggestionPanel({ sessionId, parameters, objective, refreshKey, onResultSubmitted }: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string; source: string } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [resultValue, setResultValue] = useState<number>(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestion = async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);
    try {
      const s = await api.suggest(sessionId);
      setSuggestion(s);
      setResultValue(s.predicted_objective ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, refreshKey]);

  const explain = async () => {
    if (!suggestion) return;
    setExplaining(true);
    try {
      const res = await api.explain(suggestion, parameters, objective);
      setExplanation({ text: res.explanation, source: res.source });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExplaining(false);
    }
  };

  const submitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitResult(sessionId, suggestion.params, resultValue, note || undefined);
      setNote("");
      await onResultSubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card suggestion-card">
      <div className="card-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Next experiment
          {!loading && suggestion && <span className="pulse-dot" title="live recommendation" />}
        </h3>
        <button className="ghost-btn" onClick={loadSuggestion} disabled={loading}>
          {loading ? <Spinner size={12} /> : "↻"} refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !suggestion && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <div className="skeleton" style={{ height: 46, width: "100%" }} />
          <div className="skeleton" style={{ height: 60, width: "100%" }} />
          <div className="skeleton" style={{ height: 32, width: "60%" }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {suggestion && (
          <motion.div
            key={JSON.stringify(suggestion.params)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="suggested-params">
              {parameters.map((p) => (
                <div className="stat" key={p.name}>
                  <span className="stat-label">
                    {p.name} {p.unit && <em>({p.unit})</em>}
                  </span>
                  <span className="stat-value mono">
                    <AnimatedNumber value={suggestion.params[p.name]} decimals={3} />
                  </span>
                </div>
              ))}
            </div>

            {suggestion.n_trials === 0 ? (
              <p className="muted small">
                No prior trials — this is a space-filling starting point. Run it, then log the result.
              </p>
            ) : (
              <>
                <ConfidenceBar
                  predicted={suggestion.predicted_objective ?? 0}
                  uncertainty={suggestion.uncertainty ?? 0}
                />
                <div className="prediction-row">
                  <div className="stat">
                    <span className="stat-label">
                      predicted {objective.name} {objective.unit && <em>({objective.unit})</em>}
                    </span>
                    <span className="stat-value mono accent">
                      <AnimatedNumber value={suggestion.predicted_objective ?? 0} decimals={2} /> ±{" "}
                      <AnimatedNumber value={suggestion.uncertainty ?? 0} decimals={2} />
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">expected improvement</span>
                    <span className="stat-value mono">
                      <AnimatedNumber value={suggestion.expected_improvement ?? 0} decimals={4} />
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">best observed</span>
                    <span className="stat-value mono">
                      <AnimatedNumber value={suggestion.best_observed ?? 0} decimals={2} />
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">trials so far</span>
                    <span className="stat-value mono">
                      <AnimatedNumber value={suggestion.n_trials} decimals={0} />
                    </span>
                  </div>
                </div>
              </>
            )}

            <button className="ghost-btn" onClick={explain} disabled={explaining}>
              {explaining ? <Spinner size={12} /> : null}
              {explaining ? "thinking…" : "explain this pick"}
            </button>
            <AnimatePresence>
              {explanation && (
                <motion.div
                  className="explanation"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <pre>{explanation.text}</pre>
                  <span className="muted tiny">source: {explanation.source}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <hr />

            <form onSubmit={submitResult} className="result-form">
              <h4>Log actual result</h4>
              <label className="field small-field">
                <span>
                  actual {objective.name} {objective.unit && <em>({objective.unit})</em>}
                </span>
                <input
                  type="number"
                  step="any"
                  value={resultValue}
                  onChange={(e) => setResultValue(Number(e.target.value))}
                  required
                />
              </label>
              <label className="field small-field grow">
                <span>note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? <Spinner size={12} dark /> : null}
                {submitting ? "saving…" : "submit & get next recommendation"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
