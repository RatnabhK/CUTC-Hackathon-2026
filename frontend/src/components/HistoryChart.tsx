import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Objective, TrialOut } from "../types";

interface Props {
  trials: TrialOut[];
  objective: Objective;
}

export function HistoryChart({ trials, objective }: Props) {
  const data = trials.map((t, i) => ({
    trial: i + 1,
    value: t.objective_value,
    source: t.source,
  }));

  const historical = data.filter((d) => d.source === "historical");
  const suggested = data.filter((d) => d.source === "suggested");

  if (trials.length === 0) {
    return (
      <div className="card">
        <h3>Progress</h3>
        <p className="muted small">Add trials to see the objective trend over time.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Progress</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="trial"
            name="trial"
            allowDecimals={false}
            stroke="var(--muted)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="value"
            name={objective.name}
            stroke="var(--muted)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }}
          />
          <Scatter name="historical" data={historical} fill="var(--accent-2)" />
          <Scatter name="suggested" data={suggested} fill="var(--accent)" />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <i className="dot" style={{ background: "var(--accent-2)" }} /> historical
        </span>
        <span>
          <i className="dot" style={{ background: "var(--accent)" }} /> BenchPilot-suggested
        </span>
      </div>
    </div>
  );
}

export function BestSoFarLine({ trials, objective }: Props) {
  let best = objective.goal === "maximize" ? -Infinity : Infinity;
  const data = trials.map((t, i) => {
    best =
      objective.goal === "maximize" ? Math.max(best, t.objective_value) : Math.min(best, t.objective_value);
    return { trial: i + 1, best };
  });

  if (trials.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="trial" allowDecimals={false} stroke="var(--muted)" tick={{ fontSize: 12 }} />
        <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }} />
        <Line type="stepAfter" dataKey="best" stroke="var(--accent)" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
