import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  /** A trial outside the declared bounds would be fit by the GP but could never
   * be proposed back, since the acquisition search is clamped to the box. */
  const outOfRange = parameters.filter((p) => {
    const v = params[p.name];
    return !Number.isFinite(v) || v < p.min || v > p.max;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (outOfRange.length) {
      const p = outOfRange[0];
      setLocalError(
        `"${p.name}" must be between ${p.min} and ${p.max}${p.unit ? ` ${p.unit}` : ""}.`
      );
      return;
    }
    const measured = Number(value);
    if (value.trim() === "" || !Number.isFinite(measured)) {
      setLocalError(`Enter the ${objective.name} recorded for this trial.`);
      return;
    }

    setLocalError(null);
    await onAdd(params, measured, note || undefined);
    setValue("");
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
        {parameters.map((p) => {
          const bad = outOfRange.some((o) => o.name === p.name);
          return (
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
                title={`allowed range: ${p.min} to ${p.max}`}
                style={bad ? { borderColor: "var(--error)" } : undefined}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [p.name]: Number(e.target.value) }))
                }
                required
              />
            </label>
          );
        })}
        <label className="field small-field">
          <span>
            {objective.name} {objective.unit && <em>({objective.unit})</em>}
          </span>
          <input
            type="number"
            step="any"
            value={value}
            placeholder="measured"
            onChange={(e) => setValue(e.target.value)}
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

      {localError && <p className="error">{localError}</p>}

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
            <AnimatePresence initial={false}>
              {trials.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, backgroundColor: "rgba(94, 234, 212, 0.18)" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(94, 234, 212, 0)" }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                >
                  <td>{i + 1}</td>
                  {parameters.map((p) => (
                    <td key={p.name}>{t.params[p.name]?.toFixed(3)}</td>
                  ))}
                  <td className="mono">{t.objective_value.toFixed(3)}</td>
                  <td>
                    <span className={`badge ${t.source}`}>{t.source}</span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
