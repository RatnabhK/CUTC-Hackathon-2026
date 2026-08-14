import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Objective, Parameter } from "../types";

interface Props {
  onCreate: (name: string, parameters: Parameter[], objective: Objective) => Promise<void>;
  busy: boolean;
  error: string | null;
}

interface ParamRow extends Parameter {
  _id: string;
}

const makeId = () => Math.random().toString(36).slice(2);

const EXAMPLE_PARAMS: ParamRow[] = [
  { _id: makeId(), name: "temperature", min: 20, max: 80, unit: "C" },
  { _id: makeId(), name: "concentration", min: 0.1, max: 2.0, unit: "M" },
];

export function SetupForm({ onCreate, busy, error }: Props) {
  const [name, setName] = useState("Reaction Yield Optimization");
  const [parameters, setParameters] = useState<ParamRow[]>(EXAMPLE_PARAMS);
  const [objectiveName, setObjectiveName] = useState("yield");
  const [goal, setGoal] = useState<"maximize" | "minimize">("maximize");
  const [objectiveUnit, setObjectiveUnit] = useState("%");

  const updateParam = (id: string, patch: Partial<Parameter>) => {
    setParameters((ps) => ps.map((p) => (p._id === id ? { ...p, ...patch } : p)));
  };

  const addParam = () =>
    setParameters((ps) => [...ps, { _id: makeId(), name: `param_${ps.length + 1}`, min: 0, max: 1 }]);

  const removeParam = (id: string) => setParameters((ps) => ps.filter((p) => p._id !== id));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean: Parameter[] = parameters.map(({ _id, ...p }) => p);
    onCreate(name, clean, { name: objectiveName, goal, unit: objectiveUnit || undefined });
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
          <AnimatePresence initial={false}>
            {parameters.map((p) => (
              <motion.div
                className="param-row"
                key={p._id}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <input
                  className="param-name"
                  value={p.name}
                  onChange={(e) => updateParam(p._id, { name: e.target.value })}
                  placeholder="name"
                  required
                />
                <input
                  type="number"
                  value={p.min}
                  onChange={(e) => updateParam(p._id, { min: Number(e.target.value) })}
                  placeholder="min"
                  required
                />
                <span className="tilde">to</span>
                <input
                  type="number"
                  value={p.max}
                  onChange={(e) => updateParam(p._id, { max: Number(e.target.value) })}
                  placeholder="max"
                  required
                />
                <input
                  className="param-unit"
                  value={p.unit ?? ""}
                  onChange={(e) => updateParam(p._id, { unit: e.target.value })}
                  placeholder="unit"
                />
                {parameters.length > 1 && (
                  <button type="button" className="icon-btn" onClick={() => removeParam(p._id)}>
                    ×
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
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

        <motion.button
          type="submit"
          className="primary-btn"
          disabled={busy}
          whileHover={{ scale: busy ? 1 : 1.02 }}
          whileTap={{ scale: busy ? 1 : 0.98 }}
        >
          {busy ? "Creating…" : "Create session"}
        </motion.button>
      </form>
    </div>
  );
}
