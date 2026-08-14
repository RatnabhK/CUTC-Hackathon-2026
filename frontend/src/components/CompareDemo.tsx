import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { AnimatedNumber } from "./AnimatedNumber";
import { Spinner } from "./Spinner";
import type { CompareResponse } from "../types";

interface Props {
  sessionId: string;
  objectiveName: string;
  objectiveGoal: "maximize" | "minimize";
}

const tooltipStyle = {
  background: "var(--panel-solid)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 12px 30px -14px rgba(0,0,0,0.7)",
  fontSize: 12,
};

export function CompareDemo({ sessionId, objectiveName, objectiveGoal }: Props) {
  const [nTrials, setNTrials] = useState(18);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gapFromOptimum = (value: number, optimum: number) => {
    if (objectiveGoal === "maximize") {
      return optimum - value;
    }

    return value - optimum;
  };

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
        <motion.button
          className="primary-btn"
          onClick={run}
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
        >
          {loading ? <Spinner size={12} dark /> : null}
          {loading ? "running…" : "run comparison"}
        </motion.button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !result && (
        <div className="skeleton" style={{ height: 280, width: "100%", borderRadius: 12 }} />
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={result.trace} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="bpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="randGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-3)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--accent-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="trial"
                  allowDecimals={false}
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                  label={{ value: "trial #", position: "insideBottom", offset: -2, fill: "var(--muted)" }}
                />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <ReferenceLine
                  y={result.true_optimum}
                  stroke="var(--muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: "true optimum",
                    fill: "var(--muted)",
                    fontSize: 11,
                    position: "insideTopRight",
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="bayesopt_best"
                  name="BenchPilot"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#bpGradient)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="stepAfter"
                  dataKey="random_best"
                  name="Random search"
                  stroke="var(--accent-3)"
                  strokeWidth={2}
                  fill="url(#randGradient)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="compare-summary">
              <div className="stat">
                <span className="stat-label">BenchPilot best</span>
                <span className="stat-value mono accent">
                  <AnimatedNumber value={result.bayesopt_final} decimals={2} />
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Random search best</span>
                <span className="stat-value mono">
                  <AnimatedNumber value={result.random_final} decimals={2} />
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">gap vs. true optimum ({objectiveName})</span>
                <span className="stat-value mono">
                  <AnimatedNumber value={gapFromOptimum(result.bayesopt_final, result.true_optimum)} decimals={2} /> vs.{" "}
                  <AnimatedNumber value={gapFromOptimum(result.random_final, result.true_optimum)} decimals={2} />
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
