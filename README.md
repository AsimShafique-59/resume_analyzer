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

Stateless by design — no database. Each request parses/matches/generates
within itself; the dashboard just re-renders the last `/match` response held
in frontend state. Add persistence (e.g. SQLite/Postgres) if candidates need
to survive across requests or across recruiters.

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
| `/parse-resume` | POST | resume file | structured profile JSON |
| `/match` | POST | `job_description` (query param) + resume files | ranked list of `{filename, score, profile}` |
| `/cover-letter` | POST | `job_description` (query param) + resume file | `{cover_letter, feedback[]}` |

Interactive docs at `http://localhost:8000/docs` while the backend is running.

## Tech stack

Python, FastAPI, Groq (LLM), sentence-transformers (embeddings), React, Vite.
