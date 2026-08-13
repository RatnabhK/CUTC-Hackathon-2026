import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import type { CompareResponse } from "../types";

interface Props {
  sessionId: string;
  objectiveName: string;
}

export function CompareDemo({ sessionId, objectiveName }: Props) {
  const [nTrials, setNTrials] = useState(18);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.compare(sessionId, nTrials, seed);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Demo: BenchPilot vs. random experimentation</h3>
      </div>
      <p className="muted small">
        Runs both strategies against a hidden synthetic "true" yield landscape built from your
        search space, so you can see how many fewer trials BenchPilot needs to find a good result.
      </p>
      <div className="compare-controls">
        <label className="field small-field">
          <span>trial budget</span>
          <input
            type="number"
            min={3}
            max={60}
            value={nTrials}
            onChange={(e) => setNTrials(Number(e.target.value))}
          />
        </label>
        <label className="field small-field">
          <span>seed (optional)</span>
          <input
            type="number"
            value={seed ?? ""}
            placeholder="random"
            onChange={(e) => setSeed(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <button className="primary-btn" onClick={run} disabled={loading}>
          {loading ? "running…" : "run comparison"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={result.trace} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="trial"
                allowDecimals={false}
                stroke="var(--muted)"
                tick={{ fontSize: 12 }}
                label={{ value: "trial #", position: "insideBottom", offset: -2, fill: "var(--muted)" }}
              />
              <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }} />
              <Legend />
              <ReferenceLine
                y={result.true_optimum}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: "true optimum", fill: "var(--muted)", fontSize: 11, position: "insideTopRight" }}
              />
              <Line
                type="stepAfter"
                dataKey="bayesopt_best"
                name="BenchPilot"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="stepAfter"
                dataKey="random_best"
                name="Random search"
                stroke="var(--accent-3)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="compare-summary">
            <div className="stat">
              <span className="stat-label">BenchPilot best</span>
              <span className="stat-value mono accent">{result.bayesopt_final.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Random search best</span>
              <span className="stat-value mono">{result.random_final.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">gap vs. true optimum ({objectiveName})</span>
              <span className="stat-value mono">
                {(result.true_optimum - result.bayesopt_final).toFixed(2)} vs.{" "}
                {(result.true_optimum - result.random_final).toFixed(2)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
