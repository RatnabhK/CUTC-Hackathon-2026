import { useState } from "react";
import type { Objective, Parameter, TrialOut } from "../types";

interface Props {
  parameters: Parameter[];
  objective: Objective;
  trials: TrialOut[];
  onAdd: (params: Record<string, number>, objective_value: number, note?: string) => Promise<void>;
  busy: boolean;
}

export function TrialsPanel({ parameters, objective, trials, onAdd, busy }: Props) {
  const emptyParams = Object.fromEntries(parameters.map((p) => [p.name, (p.min + p.max) / 2]));
  const [params, setParams] = useState<Record<string, number>>(emptyParams);
  const [value, setValue] = useState<number>(0);
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(params, value, note || undefined);
    setNote("");
  };

  return (
    <div className="card">
      <h3>Past trials</h3>
      <p className="muted small">
        Enter historical results so the model has something to learn from before it recommends
        anything.
      </p>

      <form onSubmit={submit} className="trial-form">
        {parameters.map((p) => (
          <label className="field small-field" key={p.name}>
            <span>
              {p.name} {p.unit && <em>({p.unit})</em>}
            </span>
            <input
              type="number"
              step="any"
              value={params[p.name]}
              min={p.min}
              max={p.max}
              onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: Number(e.target.value) }))}
              required
            />
          </label>
        ))}
        <label className="field small-field">
          <span>
            {objective.name} {objective.unit && <em>({objective.unit})</em>}
          </span>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            required
          />
        </label>
        <label className="field small-field grow">
          <span>note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" className="secondary-btn" disabled={busy}>
          + add trial
        </button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {parameters.map((p) => (
                <th key={p.name}>{p.name}</th>
              ))}
              <th>{objective.name}</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {trials.length === 0 && (
              <tr>
                <td colSpan={parameters.length + 3} className="muted">
                  No trials yet.
                </td>
              </tr>
            )}
            {trials.map((t, i) => (
              <tr key={t.id}>
                <td>{i + 1}</td>
                {parameters.map((p) => (
                  <td key={p.name}>{t.params[p.name]?.toFixed(3)}</td>
                ))}
                <td className="mono">{t.objective_value.toFixed(3)}</td>
                <td>
                  <span className={`badge ${t.source}`}>{t.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
