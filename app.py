"""FastAPI MVP: resume parsing + job-to-candidate matching.

Stateless by design — no DB. A resume/job description is parsed and
matched within a single request.
ponytail: in-memory only, add PostgreSQL when candidates need to persist across requests.
"""
import io
import json
import os

import google.generativeai as genai
import numpy as np
import PyPDF2
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = genai.GenerativeModel("gemini-2.0-flash-lite")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

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


def ask_gemini_json(prompt: str) -> dict:
    response = gemini.generate_content(prompt)
    cleaned = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(502, f"Model returned non-JSON response: {cleaned[:200]}")


def parse_profile(text: str) -> dict:
    return ask_gemini_json(PROFILE_PROMPT.format(text=text[:8000]))


def generate_cover_letter(resume_text: str, job_description: str) -> dict:
    return ask_gemini_json(COVER_LETTER_PROMPT.format(resume_text=resume_text[:8000], job_description=job_description))


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
    return parse_profile(text)


@app.post("/cover-letter", response_model=CoverLetterResult)
async def cover_letter(job_description: str, resume: UploadFile = File(...)):
    text = extract_text(resume.filename, await resume.read())
    if not text.strip():
        raise HTTPException(400, "Could not extract any text from the file")
    result = generate_cover_letter(text, job_description)
    return CoverLetterResult(**result)


@app.post("/match", response_model=list[MatchResult])
async def match_candidates(job_description: str, resumes: list[UploadFile] = File(...)):
    job_emb = embedder.encode(job_description)
    results = []
    for resume in resumes:
        text = extract_text(resume.filename, await resume.read())
        if not text.strip():
            continue
        score = cosine(job_emb, embedder.encode(text))
        results.append(MatchResult(filename=resume.filename, score=round(score, 4), profile=parse_profile(text)))
    return sorted(results, key=lambda r: r.score, reverse=True)
