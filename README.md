# BenchPilot

**BenchPilot helps researchers decide which experiment to run next when time, money, or materials
are limited.**

Built for the CUTC: Transform Hackathon 2026, Apps track.

## The problem

Running experiments is expensive — every trial costs time, reagents, or compute. Researchers
often pick the next set of parameters to try by intuition or brute-force grid search, which wastes
trials exploring regions that were never going to be good.

BenchPilot closes the loop instead:

1. A researcher uploads previous trials — e.g. temperature, concentration, reaction time, and the
   resulting yield.
2. They set an objective and a constraint, e.g. *maximize yield while keeping temperature below
   80°C*.
3. A Bayesian optimization model proposes the next experiment to run, along with its predicted
   result and how uncertain that prediction is.
4. The researcher runs it, enters the measured result, and the model updates and proposes the
   next one.

It is not a research-paper uploader or a chatbot — it's a closed-loop experimental decision tool.
The math (a Gaussian Process fit to your trials + an Expected Improvement acquisition function) is
the core; an LLM is only used afterwards to narrate the optimizer's own numbers in plain English,
never to invent a recommendation of its own.

### What the demo actually shows

The demo view races BenchPilot against random experimentation on a synthetic landscape built from
your search space. A single race proves little — random search gets lucky sometimes — so it repeats
the race across several replicates and reports the **median** with an interquartile band, plus how
often BenchPilot actually won.

On our synthetic benchmark (2 parameters, 18-trial budget, 8 replicates across 8 landscape seeds)
BenchPilot won about **73%** of individual races and finished closer to the optimum on **7 of 8**
landscapes, with a mean gap of ~9.5 versus ~19.9 for random search. It does not win every seed, and
the demo is built to show that rather than hide it — try seed 3 to see a landscape where random
search keeps up.

These numbers come from a synthetic test function, not from wet-lab data. They illustrate the
method; they are not a claim about any particular real experiment.

## How it works

1. Define your parameters (name + min/max bounds — bounds double as your constraints, e.g.
   `temperature: 20–80°C`) and an objective (name + maximize/minimize).
2. Enter past trial results, or none — BenchPilot starts with a space-filling point if there's no
   data yet.
3. It fits a Gaussian Process to the trials and proposes the next point via Expected Improvement,
   optimized with multi-start L-BFGS-B over the normalized search space.
4. You run the real experiment, log the measured result, and it refits and proposes the next one.
5. The "Demo" tab races BenchPilot against random search on a synthetic landscape built from your
   own search space, repeated over several replicates so the comparison isn't a single lucky run.

Inputs are validated on both ends: parameter names must be unique and non-blank, every range needs
`min < max`, and logged trials must fall inside the declared bounds — an out-of-range point would
be fit by the GP but could never be proposed back, since the acquisition search is clamped to the
box. The measured-result field is deliberately left blank rather than prefilled with the model's
prediction, so a prediction can't be submitted back as if it were data.

## Stack

- **Backend** (`backend/`): FastAPI + scikit-learn (GP regression, hand-rolled Expected
  Improvement acquisition — deliberately not ax-platform/botorch, which pull in a heavy torch
  stack that's flaky to install on short notice). Optional Claude API call for a plain-English
  explanation of each recommendation, using only the exact numbers the optimizer already computed
  (falls back to a template if no API key is set).
- **Frontend** (`frontend/`): React + Vite + TypeScript, Recharts for the progress and comparison
  charts.

## Running locally

Backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (separate terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend expects the API at `http://localhost:8000` (override with
`VITE_API_BASE` in a `frontend/.env` file).

Optional: set `ANTHROPIC_API_KEY` in the backend's environment to get LLM-written explanations of
each recommendation instead of the template fallback.

## Repo structure

```
backend/
  app/
    main.py         FastAPI routes + request validation
    optimizer.py     GP + Expected Improvement acquisition
    synthetic.py     synthetic landscape + replicated demo comparison
    llm.py           explanation layer (Claude API or template fallback)
    store.py         in-memory session store
    schemas.py       request/response models + validators
frontend/
  src/
    App.tsx                  app shell, session state
    components/
      SetupForm.tsx           define parameters + objective
      TrialsPanel.tsx          log historical trials
      SuggestionPanel.tsx      next-experiment recommendation + result logging
      HistoryChart.tsx         objective-over-time chart
      CompareDemo.tsx          replicated BenchPilot vs. random search demo
      ConfidenceBar.tsx        prediction-uncertainty band
      AnimatedNumber.tsx       count-up number display
      Spinner.tsx              loading indicator
```
