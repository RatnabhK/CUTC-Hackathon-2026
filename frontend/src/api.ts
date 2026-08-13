import type {
  CompareResponse,
  ExplainResponse,
  Objective,
  Parameter,
  SessionOut,
  Suggestion,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createSession: (name: string, parameters: Parameter[], objective: Objective) =>
    request<SessionOut>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name, parameters, objective }),
    }),

  getSession: (id: string) => request<SessionOut>(`/api/sessions/${id}`),

  addTrials: (
    id: string,
    trials: { params: Record<string, number>; objective_value: number; note?: string }[]
  ) =>
    request<SessionOut>(`/api/sessions/${id}/trials`, {
      method: "POST",
      body: JSON.stringify(trials),
    }),

  suggest: (id: string) => request<Suggestion>(`/api/sessions/${id}/suggest`),

  submitResult: (
    id: string,
    params: Record<string, number>,
    objective_value: number,
    note?: string
  ) =>
    request<SessionOut>(`/api/sessions/${id}/results`, {
      method: "POST",
      body: JSON.stringify({ params, objective_value, note }),
    }),

  explain: (suggestion: Suggestion, parameters: Parameter[], objective: Objective) =>
    request<ExplainResponse>("/api/explain", {
      method: "POST",
      body: JSON.stringify({ suggestion, parameters, objective }),
    }),

  compare: (id: string, n_trials: number, seed?: number) =>
    request<CompareResponse>(`/api/sessions/${id}/compare`, {
      method: "POST",
      body: JSON.stringify({ n_trials, seed }),
    }),
};
