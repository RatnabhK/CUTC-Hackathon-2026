import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
}

const tooltipStyle = {
  background: "var(--panel-solid)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 12px 30px -14px rgba(0,0,0,0.7)",
  fontSize: 12,
};

export function CompareDemo({ sessionId, objectiveName }: Props) {
  const [nTrials, setNTrials] = useState(18);
  const [nReplicates, setNReplicates] = useState(8);
  const [seed, setSeed] = useState<number | undefined>(7);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.compare(sessionId, nTrials, seed, nReplicates);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Recharts stacks an Area on a base offset to draw a floating band, so the
  // upper series carries only the height of the interquartile range.
  const banded = result?.trace.map((t) => ({
    ...t,
    bpBase: t.bayesopt_lo,
    bpBand: t.bayesopt_hi - t.bayesopt_lo,
    rndBase: t.random_lo,
    rndBand: t.random_hi - t.random_lo,
  }));

  const winPct = result ? Math.round(result.bayesopt_win_rate * 100) : 0;

  return (
    <div className="card">
      <div className="card-header">
        <h3>Demo: BenchPilot vs. random experimentation</h3>
      </div>
      <p className="muted small">
        Both strategies run against a hidden synthetic landscape built from your search space,
        starting from the same trials. Because a single run can go either way on luck, this repeats
        the whole race several times and plots the <strong>median</strong> with an interquartile
        band. Change the seed to draw a different landscape.
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
          <span>repeats</span>
          <input
            type="number"
            min={1}
            max={25}
            value={nReplicates}
            onChange={(e) => setNReplicates(Number(e.target.value))}
          />
        </label>
        <label className="field small-field">
          <span>landscape seed</span>
          <input
            type="number"
            value={seed ?? ""}
            placeholder="default: 7"
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
          {loading ? `running ${nReplicates} races…` : "run comparison"}
        </motion.button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="skeleton" style={{ height: 280, width: "100%", borderRadius: 12 }} />
      )}

      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={banded} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="trial"
                  allowDecimals={false}
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "trial #",
                    position: "insideBottom",
                    offset: -2,
                    fill: "var(--muted)",
                  }}
                />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    typeof value === "number" ? value.toFixed(2) : String(value ?? ""),
                    String(name ?? ""),
                  ]}
                />
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

                {/* interquartile bands, drawn as invisible base + visible height */}
                <Area
                  type="stepAfter"
                  dataKey="bpBase"
                  stackId="bp"
                  stroke="none"
                  fill="none"
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter"
                  dataKey="bpBand"
                  stackId="bp"
                  stroke="none"
                  fill="var(--accent)"
                  fillOpacity={0.16}
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter"
                  dataKey="rndBase"
                  stackId="rnd"
                  stroke="none"
                  fill="none"
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter"
                  dataKey="rndBand"
                  stackId="rnd"
                  stroke="none"
                  fill="var(--accent-3)"
                  fillOpacity={0.14}
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />

                <Line
                  type="stepAfter"
                  dataKey="bayesopt_best"
                  name="BenchPilot (median)"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="stepAfter"
                  dataKey="random_best"
                  name="Random search (median)"
                  stroke="var(--accent-3)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="compare-summary">
              <div className="stat">
                <span className="stat-label">BenchPilot median</span>
                <span className="stat-value mono accent">
                  <AnimatedNumber value={result.bayesopt_final} decimals={2} />
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Random search median</span>
                <span className="stat-value mono">
                  <AnimatedNumber value={result.random_final} decimals={2} />
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">gap to optimum ({objectiveName})</span>
                <span className="stat-value mono">
                  <AnimatedNumber value={result.bayesopt_gap} decimals={2} /> vs.{" "}
                  <AnimatedNumber value={result.random_gap} decimals={2} />
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">BenchPilot won</span>
                <span className="stat-value mono">
                  {winPct}% <span className="muted tiny">of {result.n_replicates} races</span>
                </span>
              </div>
            </div>

            <p className="muted small" style={{ marginBottom: 0 }}>
              {result.trials_to_match !== null ? (
                <>
                  BenchPilot matched random search's {nTrials}-trial result in{" "}
                  <strong>{result.trials_to_match} trials</strong>
                  {result.trials_to_match < nTrials
                    ? ` — ${nTrials - result.trials_to_match} experiments saved.`
                    : "."}
                </>
              ) : (
                <>
                  On this landscape random search kept up — BenchPilot didn't reach its final result
                  within the budget. Worth showing: it doesn't win every seed.
                </>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
