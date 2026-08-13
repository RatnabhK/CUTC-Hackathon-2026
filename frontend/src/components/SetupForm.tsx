import { useState } from "react";
import type { Objective, Parameter } from "../types";

interface Props {
  onCreate: (name: string, parameters: Parameter[], objective: Objective) => Promise<void>;
  busy: boolean;
  error: string | null;
}

const EXAMPLE_PARAMS: Parameter[] = [
  { name: "temperature", min: 20, max: 80, unit: "C" },
  { name: "concentration", min: 0.1, max: 2.0, unit: "M" },
];

export function SetupForm({ onCreate, busy, error }: Props) {
  const [name, setName] = useState("Reaction Yield Optimization");
  const [parameters, setParameters] = useState<Parameter[]>(EXAMPLE_PARAMS);
  const [objectiveName, setObjectiveName] = useState("yield");
  const [goal, setGoal] = useState<"maximize" | "minimize">("maximize");
  const [objectiveUnit, setObjectiveUnit] = useState("%");

  const updateParam = (idx: number, patch: Partial<Parameter>) => {
    setParameters((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addParam = () =>
    setParameters((ps) => [...ps, { name: `param_${ps.length + 1}`, min: 0, max: 1 }]);

  const removeParam = (idx: number) =>
    setParameters((ps) => ps.filter((_, i) => i !== idx));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name, parameters, { name: objectiveName, goal, unit: objectiveUnit || undefined });
  };

  return (
    <div className="card setup-card">
      <h2>Set up your experiment space</h2>
      <p className="muted">
        Define what you can control, what you're limited by, and what you're trying to optimize.
        BenchPilot will use this to fit a Gaussian Process and recommend the next experiment.
      </p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <div className="field-group">
          <div className="field-group-header">
            <span>Parameters (search space)</span>
            <button type="button" className="ghost-btn" onClick={addParam}>
              + add parameter
            </button>
          </div>
          {parameters.map((p, i) => (
            <div className="param-row" key={i}>
              <input
                className="param-name"
                value={p.name}
                onChange={(e) => updateParam(i, { name: e.target.value })}
                placeholder="name"
                required
              />
              <input
                type="number"
                value={p.min}
                onChange={(e) => updateParam(i, { min: Number(e.target.value) })}
                placeholder="min"
                required
              />
              <span className="tilde">to</span>
              <input
                type="number"
                value={p.max}
                onChange={(e) => updateParam(i, { max: Number(e.target.value) })}
                placeholder="max"
                required
              />
              <input
                className="param-unit"
                value={p.unit ?? ""}
                onChange={(e) => updateParam(i, { unit: e.target.value })}
                placeholder="unit"
              />
              {parameters.length > 1 && (
                <button type="button" className="icon-btn" onClick={() => removeParam(i)}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="field-group">
          <span>Objective</span>
          <div className="param-row">
            <input
              className="param-name"
              value={objectiveName}
              onChange={(e) => setObjectiveName(e.target.value)}
              placeholder="e.g. yield"
              required
            />
            <select value={goal} onChange={(e) => setGoal(e.target.value as "maximize" | "minimize")}>
              <option value="maximize">maximize</option>
              <option value="minimize">minimize</option>
            </select>
            <input
              className="param-unit"
              value={objectiveUnit}
              onChange={(e) => setObjectiveUnit(e.target.value)}
              placeholder="unit"
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Creating…" : "Create session"}
        </button>
      </form>
    </div>
  );
}
