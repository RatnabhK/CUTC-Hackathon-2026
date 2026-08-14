export interface Parameter {
  name: string;
  min: number;
  max: number;
  unit?: string;
}

export interface Objective {
  name: string;
  goal: "maximize" | "minimize";
  unit?: string;
}

export interface TrialOut {
  id: string;
  params: Record<string, number>;
  objective_value: number;
  note?: string;
  source: "historical" | "suggested";
}

export interface SessionOut {
  id: string;
  name: string;
  parameters: Parameter[];
  objective: Objective;
  trials: TrialOut[];
}

export interface Suggestion {
  params: Record<string, number>;
  predicted_objective: number | null;
  uncertainty: number | null;
  expected_improvement: number | null;
  best_observed: number | null;
  n_trials: number;
}

export interface ExplainResponse {
  explanation: string;
  source: "llm" | "template";
}

export interface CompareTrace {
  trial: number;
  bayesopt_best: number;
  bayesopt_lo: number;
  bayesopt_hi: number;
  random_best: number;
  random_lo: number;
  random_hi: number;
}

export interface CompareResponse {
  trace: CompareTrace[];
  bayesopt_final: number;
  random_final: number;
  true_optimum: number;
  bayesopt_gap: number;
  random_gap: number;
  n_replicates: number;
  bayesopt_win_rate: number;
  trials_to_match: number | null;
}
