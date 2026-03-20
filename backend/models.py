from pydantic import BaseModel, Field, field_validator
from typing import Literal

class AnalyzeRequest(BaseModel):
    jd_text: str = Field(...)
    resumes: list[str] = Field(..., min_length=1, max_length=10)

    @field_validator("jd_text")
    @classmethod
    def jd_not_empty(cls, v):
        if not v.strip(): raise ValueError("Job description cannot be empty")
        return v

    @field_validator("resumes")
    @classmethod
    def resumes_not_empty(cls, v):
        cleaned = [r.strip() for r in v if r.strip()]
        if not cleaned: raise ValueError("At least one non-empty resume is required")
        return cleaned

class CandidateScore(BaseModel):
    rank: int
    name: str
    overall_score: int = Field(..., ge=0, le=100)
    skills_match: int = Field(..., ge=0, le=100)
    experience_match: int = Field(..., ge=0, le=100)
    role_fit: int = Field(..., ge=0, le=100)
    strengths: list[str]
    gaps: list[str]
    recommendation: Literal["Strong Fit", "Moderate Fit", "Not Fit"]
    reasoning: str
    rule_based_score: int
    matched_keywords: list[str]
    seniority_level: str = ""
    years_experience: int = 0
    hire_urgency: str = ""
    interview_questions: list[str] = []

class AnalyzeResponse(BaseModel):
    success: bool = True
    total_candidates: int
    jd_title: str
    results: list[CandidateScore]

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: str | None = None
