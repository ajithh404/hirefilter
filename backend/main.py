"""
main.py — HireFilter API server
Built with FastAPI + Groq (llama-3.3-70b-versatile)

Endpoints:
  GET  /health            → liveness check
  POST /analyze           → score resumes (JSON text input)
  POST /analyze-files     → score resumes (multipart file upload — PDF, DOCX, TXT)
  POST /parse-resume      → debug: see how the parser reads a resume
  POST /split-resumes     → debug: split bulk-paste into individual resumes

Run locally:
  uvicorn main:app --reload --port 8000

Environment variables (set in .env):
  GROQ_API_KEY      — required
  ALLOWED_ORIGINS   — comma-separated list of frontend origins (default: *)
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import AsyncGroq
from dotenv import load_dotenv

from models import AnalyzeRequest, AnalyzeResponse, CandidateScore, ErrorResponse
from parser import split_resumes, parse_resume, parse_jd
from scorer import score_all_candidates
from file_parser import extract_file_text

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)


# ── App lifecycle ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the Groq client once at startup; reuse it across all requests."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

    app.state.groq = AsyncGroq(api_key=api_key)
    logger.info("Groq client initialized")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="HireFilter API",
    description="Resume screening API — hybrid rule-based + LLM scoring",
    version="1.1.0",
    lifespan=lifespan,
)


# ── CORS ───────────────────────────────────────────────────────────────────────
# In production: set ALLOWED_ORIGINS=https://your-vercel-app.vercel.app

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ───────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="Internal server error", detail=str(exc)).model_dump(),
    )


# ── Shared scoring logic ───────────────────────────────────────────────────────

async def run_scoring_pipeline(
    jd_text: str,
    resume_texts: list,
    groq_client,
) -> AnalyzeResponse:
    """
    Core pipeline: parse -> validate -> score -> rank.
    Shared by both the JSON and file-upload endpoints.
    """
    jd = parse_jd(jd_text)
    parsed_resumes = [parse_resume(r) for r in resume_texts]

    # Drop resumes that are suspiciously short — likely parsing failures
    valid = [r for r in parsed_resumes if r.word_count >= 30]

    if not valid:
        raise HTTPException(
            status_code=422,
            detail="All provided resumes were too short to evaluate (< 30 words). "
                   "Check that the text was extracted correctly.",
        )

    skipped = len(parsed_resumes) - len(valid)
    if skipped:
        logger.warning("Skipped %d resume(s) — too short after extraction", skipped)

    results = await score_all_candidates(
        jd=jd,
        resumes=valid,
        groq_client=groq_client,
    )

    if not results:
        raise HTTPException(
            status_code=502,
            detail="Scoring failed for all candidates. Check your Groq API key.",
        )

    ranked = [
        CandidateScore(
            rank=i + 1,
            name=r.name,
            overall_score=r.overall_score,
            skills_match=r.skills_match,
            experience_match=r.experience_match,
            role_fit=r.role_fit,
            strengths=r.strengths,
            gaps=r.gaps,
            recommendation=r.recommendation,
            reasoning=r.reasoning,
            rule_based_score=r.rule_based_score,
            matched_keywords=r.matched_keywords,
        )
        for i, r in enumerate(results)
    ]

    return AnalyzeResponse(
        total_candidates=len(ranked),
        jd_title=jd.title or "Untitled Role",
        results=ranked,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health():
    """Liveness check — used by Render health probes."""
    return {"status": "ok", "version": "1.1.0"}


@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    tags=["screening"],
    summary="Score resumes against a JD (JSON text input)",
)
async def analyze(request: AnalyzeRequest, req: Request):
    """
    Primary endpoint for text-based input.
    Frontend sends pre-split resume strings (one per candidate).
    """
    logger.info("POST /analyze — %d resume(s)", len(request.resumes))
    return await run_scoring_pipeline(
        jd_text=request.jd_text,
        resume_texts=request.resumes,
        groq_client=req.app.state.groq,
    )


@app.post(
    "/analyze-files",
    response_model=AnalyzeResponse,
    tags=["screening"],
    summary="Score resumes against a JD (file upload — PDF, DOCX, TXT)",
)
async def analyze_files(
    req: Request,
    jd_file: UploadFile = File(..., description="Job description file (.pdf, .docx, .txt)"),
    resume_files: list[UploadFile] = File(..., description="Resume files — one per candidate"),
):
    """
    File-upload endpoint. Accepts actual PDF, DOCX, or TXT files.
    Extracts text from each file, then runs the same scoring pipeline.
    Limits: 1 JD file, 1-10 resume files.
    """
    if len(resume_files) > 10:
        raise HTTPException(status_code=422, detail="Maximum 10 resume files per request.")

    logger.info(
        "POST /analyze-files — JD: %s | %d resume(s)",
        jd_file.filename,
        len(resume_files),
    )

    # Extract JD text
    try:
        jd_bytes = await jd_file.read()
        jd_text  = extract_file_text(jd_file.filename, jd_bytes)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=f"JD file error: {e}")

    if not jd_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from the JD file. "
                   "Try a text-based PDF or a .docx file.",
        )

    # Extract resume texts — skip bad files, don't abort entire request
    resume_texts = []
    for f in resume_files:
        try:
            data = await f.read()
            text = extract_file_text(f.filename, data)
            if text.strip():
                resume_texts.append(text)
            else:
                logger.warning("No text extracted from %s — skipping", f.filename)
        except (ValueError, RuntimeError) as e:
            logger.error("Failed to extract %s: %s", f.filename, e)

    if not resume_texts:
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from any of the resume files.",
        )

    return await run_scoring_pipeline(
        jd_text=jd_text,
        resume_texts=resume_texts,
        groq_client=req.app.state.groq,
    )


# ── Debug / utility endpoints ──────────────────────────────────────────────────

@app.post("/split-resumes", tags=["utilities"])
async def split_resumes_endpoint(payload: dict):
    """Split a bulk-paste string into individual resume texts (debug)."""
    parts = split_resumes(payload.get("text", ""))
    return {"count": len(parts), "resumes": parts}


@app.post("/parse-resume", tags=["utilities"])
async def parse_resume_endpoint(payload: dict):
    """Debug: inspect how the parser reads a resume."""
    parsed = parse_resume(payload.get("text", ""))
    return {
        "name":               parsed.candidate_name,
        "word_count":         parsed.word_count,
        "sections_found":     list(parsed.sections.keys()),
        "normalized_preview": parsed.normalized[:500],
    }
