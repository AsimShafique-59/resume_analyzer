# Resume Analyzer — AI Resume & Job-Matching Platform

An MVP that parses resumes, ranks candidates against a job description, and
generates tailored cover letters — with a recruiter dashboard on top.

## Features

- **Resume parsing** — PDF/DOCX → structured candidate profile (name, email,
  phone, skills, education, experience)
- **Semantic job-to-candidate matching** — ranks multiple resumes against one
  job description by meaning, not keywords
- **AI cover letters & resume feedback** — a tailored cover letter plus
  concrete suggestions for a specific job
- **Recruiter dashboard** — sortable ranked candidate list (by name or score)

## How the match score is generated

The match score is **not** keyword matching — it's semantic similarity:

1. The job description and each resume's extracted text are both encoded into
   384-dimensional vectors using the `all-MiniLM-L6-v2` sentence-transformer
   model (runs locally, no API call).
2. The score is the **cosine similarity** between the job vector and each
   resume vector, ranging 0–1 (shown as a percentage).
3. Candidates are sorted descending by that score.

Because it's embedding-based, a resume can score well even if it doesn't use
the exact wording of the job post — it's comparing meaning, not string
overlap. It's a single holistic number, not a breakdown by requirement; two
resumes with very different skill sets can land close in score if their
overall text is semantically similar to the JD.

## How parsing, cover letters, and feedback are generated

These three (structured profile, cover letter, feedback) all go through the
same path: extracted resume text (and job description, where relevant) is
sent to Groq (`llama-3.3-70b-versatile`) with a prompt that forces a strict
JSON response — see `PROFILE_PROMPT` and `COVER_LETTER_PROMPT` in `app.py`.
The model reads the actual resume content each time; nothing is templated or
cached, so results reflect the specific file uploaded.

## Architecture

```
frontend/ (React + Vite)  --/api/*-->  proxy  -->  backend (FastAPI, :8000)
                                                       |-- PyPDF2 / python-docx   (text extraction)
                                                       |-- sentence-transformers  (match scoring)
                                                       └-- Groq LLM               (parsing, cover letters, feedback)
```

Parsed resumes are saved to a shared library (SQLite, `app.db`) keyed by
filename, so they can be reused across tabs without re-uploading. Each
`/match` run is also persisted, and `/dashboard` returns the latest run —
survives a page refresh or server restart.
ponytail: SQLite is a single file, fine for one recruiter's workload. Move to
Postgres (+ a Railway volume, or S3 for the resume files) if this needs
concurrent writers or multi-user production use.

## Setup

```bash
cd resume_analyzer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
```

Create `resume_analyzer/.env`:

```
GROQ_API_KEY=your_key_here
```

Get a free key at [console.groq.com](https://console.groq.com).

## Run

One command, from `resume_analyzer/`:

```bash
./dev.sh
```

Starts the backend on `:8000` and the frontend on `:5173` (Ctrl+C stops
both). Open `http://localhost:5173`.

## API

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/parse-resume` | POST | resume file | structured profile JSON (saved to the library) |
| `/resumes` | GET | — | library list: `[{id, filename, name}]` |
| `/match` | POST | `job_description` (query param) + resume files and/or `resume_ids` | ranked list of `{filename, score, profile}` |
| `/cover-letter` | POST | `job_description` (query param) + resume file or `resume_id` | `{cover_letter, feedback[]}` |
| `/dashboard` | GET | — | latest match run: `{job_description, results[]}` |

Interactive docs at `http://localhost:8000/docs` while the backend is running.

## Deploy to Railway

This repo is a monorepo: the backend lives at the repo root, the frontend in
`frontend/`. Deploy them as two separate Railway services from the same
GitHub repo — each service gets its own root directory, build, and domain.

### 1. Backend service

1. New Project → Deploy from GitHub repo → pick this repo.
2. Leave **root directory** as `/` (repo root already has `app.py`,
   `requirements.txt`, and a `Procfile` — Railway's Railpack builder detects
   Python automatically and the `Procfile` sets the start command:
   `uvicorn app:app --host 0.0.0.0 --port $PORT`).
3. Variables → add `GROQ_API_KEY` (same value as your local `.env`).
4. Settings → Networking → **Generate Domain** to get a public URL
   (e.g. `https://backend-production-xxxx.up.railway.app`).

By default `app.db` (SQLite) lives on the container's ephemeral disk — it
resets on every redeploy. If you want the resume library and dashboard to
survive redeploys, attach a Railway **volume** (Settings → Volumes, mount
path e.g. `/data`), then add a `DB_PATH=/data/app.db` variable — `app.py`
already reads `DB_PATH` from the environment.

### 2. Frontend service

1. Add another service in the same project → same GitHub repo.
2. Settings → **Root Directory** → `frontend`.
3. Variables → add `VITE_API_BASE` = the backend's public URL from step 1.4
   (no trailing slash) — this gets baked into the build, so set it *before*
   the first deploy.
4. Variables → add `RAILPACK_STATIC_FILE_ROOT` = `dist` (Vite builds to
   `frontend/dist`; this tells Railpack to serve that folder as a static
   site instead of trying to run a Node server).
5. Settings → Networking → **Generate Domain**.

### 3. After both are live

Push to `main` and both services redeploy automatically — that's the whole
"deploy on my own" workflow going forward, no CLI needed.

If you ever change `VITE_API_BASE`, you must trigger a frontend rebuild
(redeploy) for it to take effect — it's compiled into the JS bundle, not
read at runtime.

## Tech stack

Python, FastAPI, Groq (LLM), sentence-transformers (embeddings), SQLite,
React, Vite. Deploys to Railway.
