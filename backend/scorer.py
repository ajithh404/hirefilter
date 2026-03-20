"""
scorer.py — Hybrid resume scoring engine
Two-pass approach: rule-based pre-score + LLM (Groq) refinement.
"""

import re, json, asyncio, logging
from dataclasses import dataclass, field
from groq import AsyncGroq
from parser import ParsedResume, ParsedJD, extract_skills_from_text

logger = logging.getLogger(__name__)

WEIGHTS = {"skills_match": 0.40, "experience_match": 0.35, "role_fit": 0.25}
RULE_BLEND_FACTOR = 0.20


@dataclass
class ScoreResult:
    name: str
    overall_score: int
    skills_match: int
    experience_match: int
    role_fit: int
    strengths: list[str]
    gaps: list[str]
    recommendation: str
    reasoning: str
    rule_based_score: int
    matched_keywords: list[str]
    # New enriched fields
    seniority_level: str = ""
    years_experience: int = 0
    hire_urgency: str = ""
    interview_questions: list[str] = field(default_factory=list)


def keyword_overlap_score(jd: ParsedJD, resume: ParsedResume) -> tuple[int, list[str]]:
    if not jd.required_skills:
        return 50, []
    resume_skills = set(extract_skills_from_text(resume.normalized))
    jd_skills     = set(jd.required_skills)
    matched       = jd_skills & resume_skills
    base  = len(matched) / len(jd_skills)
    bonus = (sum(1 for s in matched if s in resume.sections.get("skills", "").lower()) / max(len(jd_skills), 1)) * 0.15
    return round(min(1.0, base + bonus) * 100), sorted(matched)


def rule_based_pre_score(jd: ParsedJD, resume: ParsedResume) -> int:
    keyword_score, _ = keyword_overlap_score(jd, resume)
    structural_bonus = (
        (5 if "experience" in resume.sections else 0) +
        (3 if "skills"     in resume.sections else 0) +
        (2 if "education"  in resume.sections else 0)
    )
    word_penalty = 20 if resume.word_count < 100 else (8 if resume.word_count < 200 else 0)
    return max(0, min(100, keyword_score + structural_bonus - word_penalty))


LLM_PROMPT = """
You are a senior technical recruiter with 10 years of experience. Evaluate this candidate.

<job_description>
{jd_text}
</job_description>

<resume>
{resume_text}
</resume>

Candidate name detected: {candidate_name}

Respond ONLY with a valid JSON object. No markdown, no text outside the JSON.

{{
  "name": "<confirm or correct the candidate name>",
  "skills_match": <0-100>,
  "experience_match": <0-100>,
  "role_fit": <0-100>,
  "strengths": ["<specific strength citing resume evidence>", "<strength 2>", "<strength 3>"],
  "gaps": ["<specific gap>", "<gap 2>", "<gap 3>"],
  "recommendation": "<Strong Fit | Moderate Fit | Not Fit>",
  "reasoning": "<2-3 sentences citing specific resume evidence>",
  "seniority_level": "<Intern | Junior | Mid-level | Senior | Lead | Principal>",
  "years_experience": <integer, estimated total years>,
  "hire_urgency": "<High | Medium | Low based on how rare this profile is>",
  "interview_questions": [
    "<targeted question based on a gap or strength>",
    "<question 2>",
    "<question 3>"
  ]
}}

Scoring guidance:
- skills_match: technical skill alignment with JD requirements
- experience_match: seniority, years, domain relevance
- role_fit: career trajectory, communication, cultural signals
- hire_urgency: High = rare profile/strong fit, Medium = solid but common, Low = weak fit
- interview_questions: make them specific to THIS candidate, not generic
- Strong Fit ≥ 75 composite, Moderate Fit 50-74, Not Fit < 50
""".strip()


async def llm_score(jd: ParsedJD, resume: ParsedResume, groq_client: AsyncGroq, model: str = "llama-3.3-70b-versatile") -> dict:
    prompt = LLM_PROMPT.format(
        jd_text=jd.normalized[:4000],
        resume_text=resume.normalized[:3000],
        candidate_name=resume.candidate_name,
    )
    response = await groq_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1000,
    )
    raw   = response.choices[0].message.content.strip()
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        logger.error("LLM returned non-JSON: %s", raw[:300])
        raise ValueError(f"LLM response was not valid JSON: {e}") from e


def blend_scores(rule_score: int, llm_skills: int, llm_exp: int, llm_fit: int) -> int:
    llm_composite = (
        llm_skills * WEIGHTS["skills_match"] +
        llm_exp    * WEIGHTS["experience_match"] +
        llm_fit    * WEIGHTS["role_fit"]
    )
    return max(0, min(100, round(RULE_BLEND_FACTOR * rule_score + (1 - RULE_BLEND_FACTOR) * llm_composite)))


def derive_recommendation(score: int) -> str:
    if score >= 75: return "Strong Fit"
    if score >= 50: return "Moderate Fit"
    return "Not Fit"


async def score_candidate(jd: ParsedJD, resume: ParsedResume, groq_client: AsyncGroq) -> ScoreResult:
    rule_score, matched_keywords = keyword_overlap_score(jd, resume)
    structural_score = rule_based_pre_score(jd, resume)
    llm_data = await llm_score(jd, resume, groq_client)

    llm_skills = max(0, min(100, int(llm_data.get("skills_match", 50))))
    llm_exp    = max(0, min(100, int(llm_data.get("experience_match", 50))))
    llm_fit    = max(0, min(100, int(llm_data.get("role_fit", 50))))
    overall    = blend_scores(structural_score, llm_skills, llm_exp, llm_fit)

    return ScoreResult(
        name=llm_data.get("name", "").strip() or resume.candidate_name,
        overall_score=overall,
        skills_match=llm_skills,
        experience_match=llm_exp,
        role_fit=llm_fit,
        strengths=llm_data.get("strengths", [])[:3],
        gaps=llm_data.get("gaps", [])[:3],
        recommendation=derive_recommendation(overall),
        reasoning=llm_data.get("reasoning", ""),
        rule_based_score=structural_score,
        matched_keywords=matched_keywords,
        seniority_level=llm_data.get("seniority_level", ""),
        years_experience=int(llm_data.get("years_experience", 0) or 0),
        hire_urgency=llm_data.get("hire_urgency", ""),
        interview_questions=llm_data.get("interview_questions", [])[:3],
    )


async def score_all_candidates(jd: ParsedJD, resumes: list[ParsedResume], groq_client: AsyncGroq, concurrency: int = 3) -> list[ScoreResult]:
    semaphore = asyncio.Semaphore(concurrency)

    async def score_with_limit(resume):
        async with semaphore:
            return await score_candidate(jd, resume, groq_client)

    results = await asyncio.gather(*[score_with_limit(r) for r in resumes], return_exceptions=True)
    clean   = [r for r in results if not isinstance(r, Exception)]
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error("Scoring failed for candidate %d: %s", i, r)

    clean.sort(key=lambda r: r.overall_score, reverse=True)
    return clean
