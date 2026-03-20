"""
parser.py — Resume & JD text extraction utilities
Author: built by hand, not generated wholesale

Design decisions:
  - Resumes pasted in bulk are separated by "---" lines (common convention)
  - We normalize unicode, collapse excessive whitespace, strip page artifacts
  - Section headers are detected via a heuristic keyword list so the scorer
    can later weight sections differently (skills > hobbies)
  - File bytes (PDF/DOCX) are handled upstream; this module only deals with
    already-extracted plain text so the parser stays dependency-light
"""

import re
from dataclasses import dataclass, field


# ── Data shapes ────────────────────────────────────────────────────────────────

@dataclass
class ParsedResume:
    raw: str                          # original text, untouched
    normalized: str                   # cleaned text sent to the scorer
    sections: dict[str, str]          # detected sections (skills, experience, etc.)
    candidate_name: str = "Unknown"   # best-guess name from first lines
    word_count: int = 0


@dataclass
class ParsedJD:
    raw: str
    normalized: str
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)
    title: str = ""


# ── Section keywords the parser looks for ──────────────────────────────────────
# Order matters: we'll match the first keyword that hits on a heading line

SECTION_MARKERS = {
    "contact":     ["contact", "email", "phone", "linkedin", "github"],
    "summary":     ["summary", "objective", "profile", "about", "overview"],
    "experience":  ["experience", "work history", "employment", "career"],
    "education":   ["education", "academic", "qualification", "degree"],
    "skills":      ["skills", "technologies", "tech stack", "competencies", "tools"],
    "projects":    ["projects", "portfolio", "works", "case studies"],
    "certifications": ["certifications", "certificates", "credentials", "licenses"],
    "achievements":["achievements", "awards", "honors", "recognition"],
    "languages":   ["languages", "spoken", "linguistic"],
    "interests":   ["interests", "hobbies", "activities"],
}


# ── Text normalization ─────────────────────────────────────────────────────────

def normalize_text(text: str) -> str:
    """
    Clean up resume text that came from copy-paste or PDF extraction.
    Keeps structure (newlines) but removes noise.
    """
    if not text:
        return ""

    # 1. Normalize unicode quotes, dashes, bullets to ASCII equivalents
    replacements = {
        "\u2019": "'", "\u2018": "'",   # curly quotes
        "\u201c": '"', "\u201d": '"',   # curly double quotes
        "\u2013": "-", "\u2014": "-",   # en/em dash
        "\u2022": "-", "\u25cf": "-",   # bullet points
        "\u00a0": " ",                   # non-breaking space
        "\ufeff": "",                    # BOM
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)

    # 2. Remove repeated special chars (e.g. "=====", "-----" section dividers)
    text = re.sub(r"[=\-_*]{4,}", "", text)

    # 3. Collapse 3+ blank lines into 2 (preserve paragraph structure)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 4. Strip trailing whitespace from each line
    lines = [line.rstrip() for line in text.splitlines()]

    # 5. Remove lines that are purely page artifacts (page numbers, headers)
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip lone page numbers, "Curriculum Vitae" headers, etc.
        if re.fullmatch(r"(page\s*\d+|\d+|curriculum vitae|resume|cv)", stripped, re.IGNORECASE):
            continue
        cleaned.append(line)

    return "\n".join(cleaned).strip()


# ── Candidate name heuristic ───────────────────────────────────────────────────

def extract_name(text: str) -> str:
    """
    Heuristic: names are usually in the first 3 non-empty lines,
    are 2-4 words long, and don't contain digits or common keywords.
    Falls back to 'Unknown Candidate'.
    """
    skip_words = {"resume", "curriculum", "vitae", "cv", "profile", "contact"}

    for line in text.splitlines()[:6]:
        stripped = line.strip()
        if not stripped:
            continue
        words = stripped.split()
        if 2 <= len(words) <= 4:
            lower_words = [w.lower() for w in words]
            # Reject if it looks like a section header or contains digits
            if any(w in skip_words for w in lower_words):
                continue
            if re.search(r"\d", stripped):
                continue
            # Reject if it looks like an email or URL
            if "@" in stripped or "http" in stripped.lower():
                continue
            # Looks like a name — title-case it for consistency
            return stripped.title()

    return "Unknown Candidate"


# ── Section detection ──────────────────────────────────────────────────────────

def extract_sections(text: str) -> dict[str, str]:
    """
    Splits resume text into labeled sections by detecting heading lines.
    A heading line is short (< 6 words) and matches a known section keyword.
    Returns a dict: { section_name: section_text }
    """
    sections: dict[str, str] = {"_preamble": ""}
    current_section = "_preamble"
    current_lines: list[str] = []

    for line in text.splitlines():
        stripped = line.strip().lower()
        matched_section = None

        # Check if this line is a section heading
        if stripped and len(stripped.split()) <= 6:
            for section, keywords in SECTION_MARKERS.items():
                if any(kw in stripped for kw in keywords):
                    matched_section = section
                    break

        if matched_section and matched_section != current_section:
            # Save previous section
            sections[current_section] = "\n".join(current_lines).strip()
            current_section = matched_section
            current_lines = []
        else:
            current_lines.append(line)

    # Don't forget the last section
    sections[current_section] = "\n".join(current_lines).strip()

    return {k: v for k, v in sections.items() if v}  # drop empty sections


# ── Skill keyword extraction (pre-LLM step) ────────────────────────────────────
# This runs before the Groq call so the scorer has a fast rule-based signal too.

COMMON_TECH_SKILLS = {
    # Languages
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
    "kotlin", "swift", "ruby", "php", "scala", "r", "matlab", "sql", "bash",
    "shell", "html", "css", "c",
    # Frameworks / libraries
    "react", "angular", "vue", "next.js", "django", "flask", "fastapi",
    "spring", "node.js", "express", "tensorflow", "pytorch", "scikit-learn",
    "pandas", "numpy", "hugging face", "transformers",
    # Infra / tools
    "aws", "gcp", "azure", "docker", "kubernetes", "git", "linux",
    "postgresql", "mysql", "mongodb", "redis", "kafka", "spark",
    "tableau", "power bi", "excel", "jira", "figma",
    # Concepts
    "machine learning", "deep learning", "nlp", "llm", "api", "rest",
    "graphql", "microservices", "ci/cd", "agile", "scrum",
}


def extract_skills_from_text(text: str) -> list[str]:
    """Pull tech keywords that appear verbatim in the text (case-insensitive)."""
    text_lower = text.lower()
    found = []
    for skill in COMMON_TECH_SKILLS:
        # Use word-boundary match so "c" doesn't match inside "cache"
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)
    return sorted(found)


# ── Main public functions ──────────────────────────────────────────────────────

def split_resumes(bulk_text: str) -> list[str]:
    """
    Split a bulk-paste string into individual resume texts.
    Candidates are separated by a line containing only '---'.
    """
    # Regex: line that is exactly 3+ dashes, possibly with surrounding whitespace
    parts = re.split(r"(?m)^\s*-{3,}\s*$", bulk_text)
    return [p.strip() for p in parts if p.strip()]


def parse_resume(raw_text: str) -> ParsedResume:
    """
    Full pipeline: normalize → detect name → split sections → extract skills.
    Returns a ParsedResume ready for the scorer.
    """
    normalized = normalize_text(raw_text)
    name = extract_name(normalized)
    sections = extract_sections(normalized)
    word_count = len(normalized.split())

    return ParsedResume(
        raw=raw_text,
        normalized=normalized,
        sections=sections,
        candidate_name=name,
        word_count=word_count,
    )


def parse_jd(raw_text: str) -> ParsedJD:
    """
    Parse a job description — extract title guess and skill keywords
    so the scorer can do a fast pre-match before the LLM call.
    """
    normalized = normalize_text(raw_text)

    # Guess job title: usually the first short non-empty line
    title = ""
    for line in normalized.splitlines():
        stripped = line.strip()
        if stripped and len(stripped.split()) <= 8:
            title = stripped
            break

    required_skills = extract_skills_from_text(normalized)

    return ParsedJD(
        raw=raw_text,
        normalized=normalized,
        required_skills=required_skills,
        preferred_skills=[],   # LLM will fill in the nuanced preferred list
        title=title,
    )
