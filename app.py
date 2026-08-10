"""FastAPI MVP: resume parsing + job-to-candidate matching.

Parsing and cover-letter generation are stateless (one request in, one
response out). Match runs are persisted to SQLite so the recruiter dashboard
survives a page refresh or server restart.
ponytail: SQLite is a single file, fine for one recruiter's workload. Move to
Postgres if this needs concurrent writers / multi-user production use.
"""
import io
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

import numpy as np
import PyPDF2
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
GROQ_MODEL = "llama-3.3-70b-versatile"
embedder = SentenceTransformer("all-MiniLM-L6-v2")

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                job_description TEXT NOT NULL,
                filename TEXT NOT NULL,
                score REAL NOT NULL,
                profile TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS resumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                text TEXT NOT NULL,
                profile TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


init_db()

app = FastAPI(title="Resume Parsing & Matching MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILE_PROMPT = """Extract a structured candidate profile from this resume text.
Return ONLY valid JSON with keys: name, email, phone, skills (list of strings),
education (list of strings), experience (list of strings). Use null/[] if unknown.

Resume text:
{text}
"""

COVER_LETTER_PROMPT = """You are a career coach. Given a resume and a job description, produce:
1. A tailored, concise cover letter (3-4 paragraphs) connecting the candidate's actual
   experience to this specific job.
2. Resume feedback: a list of concrete, actionable suggestions to better match this job.

Return ONLY valid JSON with keys: cover_letter (string), feedback (list of strings).

Resume text:
{resume_text}

Job description:
{job_description}
"""


def extract_text(filename: str, raw: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PyPDF2.PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if filename.lower().endswith(".docx"):
        doc = Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)
    raise HTTPException(400, "Only PDF and DOCX resumes are supported")


def ask_groq_json(prompt: str) -> dict:
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(502, f"Model returned non-JSON response: {content[:200]}")


def parse_profile(text: str) -> dict:
    return ask_groq_json(PROFILE_PROMPT.format(text=text[:8000]))


def generate_cover_letter(resume_text: str, job_description: str) -> dict:
    return ask_groq_json(COVER_LETTER_PROMPT.format(resume_text=resume_text[:8000], job_description=job_description))


def save_resume(filename: str, text: str, profile: dict) -> int:
    """Add/update a resume in the shared library, keyed by filename."""
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        cur = conn.execute(
            "UPDATE resumes SET text = ?, profile = ?, created_at = ? WHERE filename = ?",
            (text, json.dumps(profile), created_at, filename),
        )
        if cur.rowcount:
            return conn.execute("SELECT id FROM resumes WHERE filename = ?", (filename,)).fetchone()["id"]
        cur = conn.execute(
            "INSERT INTO resumes (filename, text, profile, created_at) VALUES (?, ?, ?, ?)",
            (filename, text, json.dumps(profile), created_at),
        )
        return cur.lastrowid


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class MatchResult(BaseModel):
    filename: str
    score: float
    profile: dict


class CoverLetterResult(BaseModel):
    cover_letter: str
    feedback: list[str]


@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    text = extract_text(file.filename, await file.read())
    if not text.strip():
        raise HTTPException(400, "Could not extract any text from the file")
    profile = parse_profile(text)
    resume_id = save_resume(file.filename, text, profile)
    return {**profile, "id": resume_id}


@app.get("/resumes")
async def list_resumes():
    with db() as conn:
        rows = conn.execute("SELECT id, filename, profile FROM resumes ORDER BY created_at DESC").fetchall()
    return [
        {"id": r["id"], "filename": r["filename"], "name": json.loads(r["profile"]).get("name")} for r in rows
    ]


@app.post("/cover-letter", response_model=CoverLetterResult)
async def cover_letter(
    job_description: str,
    resume: UploadFile | None = File(None),
    resume_id: int | None = Form(None),
):
    if resume is not None:
        text = extract_text(resume.filename, await resume.read())
        if not text.strip():
            raise HTTPException(400, "Could not extract any text from the file")
        save_resume(resume.filename, text, parse_profile(text))
    elif resume_id is not None:
        with db() as conn:
            row = conn.execute("SELECT text FROM resumes WHERE id = ?", (resume_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Resume not found in library")
        text = row["text"]
    else:
        raise HTTPException(400, "Provide a resume file or resume_id")
    result = generate_cover_letter(text, job_description)
    return CoverLetterResult(**result)


@app.post("/match", response_model=list[MatchResult])
async def match_candidates(
    job_description: str,
    resumes: list[UploadFile] = File(default=[]),
    resume_ids: list[int] = Form(default=[]),
):
    candidates: list[tuple[str, str, dict]] = []

    for resume in resumes:
        text = extract_text(resume.filename, await resume.read())
        if not text.strip():
            continue
        profile = parse_profile(text)
        save_resume(resume.filename, text, profile)
        candidates.append((resume.filename, text, profile))

    if resume_ids:
        placeholders = ",".join("?" * len(resume_ids))
        with db() as conn:
            rows = conn.execute(
                f"SELECT filename, text, profile FROM resumes WHERE id IN ({placeholders})", resume_ids
            ).fetchall()
        candidates += [(r["filename"], r["text"], json.loads(r["profile"])) for r in rows]

    if not candidates:
        raise HTTPException(400, "Provide at least one resume file or resume_id")

    job_emb = embedder.encode(job_description)
    results = [
        MatchResult(filename=filename, score=round(cosine(job_emb, embedder.encode(text)), 4), profile=profile)
        for filename, text, profile in candidates
    ]
    results.sort(key=lambda r: r.score, reverse=True)

    run_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.executemany(
            "INSERT INTO matches (run_id, job_description, filename, score, profile, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [(run_id, job_description, r.filename, r.score, json.dumps(r.profile), created_at) for r in results],
        )
    return results


@app.get("/dashboard")
async def dashboard():
    with db() as conn:
        latest = conn.execute("SELECT run_id, job_description FROM matches ORDER BY created_at DESC LIMIT 1").fetchone()
        if not latest:
            return {"job_description": None, "results": []}
        rows = conn.execute(
            "SELECT filename, score, profile FROM matches WHERE run_id = ? ORDER BY score DESC",
            (latest["run_id"],),
        ).fetchall()
    return {
        "job_description": latest["job_description"],
        "results": [
            {"filename": r["filename"], "score": r["score"], "profile": json.loads(r["profile"])} for r in rows
        ],
    }
