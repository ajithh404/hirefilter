# HireFilter — AI Resume Screener

A hybrid resume screening system that combines rule-based keyword analysis with LLM-powered judgment to rank and evaluate candidates against a job description.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  InputPanel  →  App.jsx  →  Leaderboard + CandidateCard │
└─────────────────────┬───────────────────────────────────┘
                      │  POST /analyze  (JSON)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                         │
│  main.py  →  parser.py  →  scorer.py  →  Groq API      │
│              (text prep)   (2-pass)    (Llama 3.3 70B)  │
└─────────────────────────────────────────────────────────┘
```

### Scoring pipeline (two-pass hybrid)

**Pass 1 — Rule-based (fast, deterministic)**
- Keyword overlap: what fraction of the JD's tech skills appear in the resume
- Structural check: does the resume have experience / skills / education sections?
- Word count penalty: sparse resumes (< 100 words) get penalized

**Pass 2 — LLM refinement (Groq, llama-3.3-70b-versatile)**
- Scores three dimensions: `skills_match`, `experience_match`, `role_fit`
- Extracts specific strengths and gaps grounded in the resume text
- Provides a reasoning trace explaining the score

**Final score** = weighted blend of both passes:
```
skills_match × 0.40 + experience_match × 0.35 + role_fit × 0.25
```
blended with rule-based score at 20% weight as a sanity anchor.

---

## Tech stack

| Layer     | Technology                         |
|-----------|------------------------------------|
| Frontend  | React 18, Vite, vanilla CSS        |
| Backend   | Python, FastAPI, Uvicorn           |
| AI        | Groq API (llama-3.3-70b-versatile) |
| Parsing   | Custom regex + heuristics (parser.py) |
| Deploy    | Render (backend) · Vercel (frontend) |

---

## Local setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier is fine)

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Open .env and add your GROQ_API_KEY

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`.  
Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

npm install
npm run dev
```

App will open at `http://localhost:5173`.  
API calls are proxied to the FastAPI backend automatically (see `vite.config.js`).

---

## API reference

### `POST /analyze`

**Request:**
```json
{
  "jd_text": "We are looking for a Senior Python Engineer...",
  "resumes": [
    "Jane Doe\n5 years Python, FastAPI, AWS...",
    "John Smith\nMarketing lead, Excel..."
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total_candidates": 2,
  "jd_title": "Senior Python Engineer",
  "results": [
    {
      "rank": 1,
      "name": "Jane Doe",
      "overall_score": 84,
      "skills_match": 88,
      "experience_match": 82,
      "role_fit": 79,
      "strengths": ["Strong Python + FastAPI alignment", "AWS experience matches infra requirements", "5 years hits seniority bar"],
      "gaps": ["No mention of CI/CD tooling", "Missing Kubernetes experience", "No leadership examples"],
      "recommendation": "Strong Fit",
      "reasoning": "Jane's Python and FastAPI background directly matches the core stack...",
      "rule_based_score": 76,
      "matched_keywords": ["python", "fastapi", "aws", "sql"]
    }
  ]
}
```

### `GET /health`
Liveness check — returns `{ "status": "ok" }`.

### `POST /parse-resume`
Debug utility: see how the parser reads a resume (sections, name, word count).

---

## How to use it

1. **Paste or upload** the job description in §01
2. **Paste all resumes** in §02, separated by `---` — or upload one `.txt` file per candidate
3. Hit **Screen Candidates**
4. Review the ranked leaderboard, then dig into individual profile cards
5. Click **Export CSV** to download results for sharing

---

## Deployment

### Backend → Render

1. Push the `backend/` folder to a GitHub repo
2. Create a new **Web Service** on [Render](https://render.com)
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `GROQ_API_KEY=your_key`
6. Add `ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`

### Frontend → Vercel

1. Push the `frontend/` folder to GitHub
2. Import the repo on [Vercel](https://vercel.com)
3. Set environment variable: `VITE_API_URL=https://your-render-service.onrender.com`
4. Deploy — Vercel handles the Vite build automatically

---

## Project structure

```
hirefilter/
├── backend/
│   ├── main.py          # FastAPI app — routes, CORS, error handling
│   ├── parser.py        # Resume/JD text normalization and section detection
│   ├── scorer.py        # Two-pass scoring engine (rule-based + Groq LLM)
│   ├── models.py        # Pydantic request/response schemas
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx              # Main app — state, API calls, layout
    │   ├── index.css            # Design system (CSS variables + all styles)
    │   └── components/
    │       ├── InputPanel.jsx   # Paste/upload switcher
    │       ├── Leaderboard.jsx  # Ranked table with animated score bars
    │       ├── CandidateCard.jsx # Profile card with reasoning accordion
    │       └── ExportButton.jsx  # CSV export
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Design decisions worth noting

**Why hybrid scoring?**  
Pure LLM scoring can be inconsistent — giving 90/100 to a resume that matched zero keywords. The rule-based pass acts as a sanity anchor (blended at 20%). It also makes the system more resilient: if the Groq call fails, the pre-score still runs.

**Why concurrent scoring with a semaphore?**  
Groq's free tier has rate limits. `score_all_candidates` uses `asyncio.Semaphore(3)` to score up to 3 candidates in parallel without overwhelming the API.

**Why keep the API key server-side?**  
It never touches the browser. The frontend talks to your FastAPI backend; the backend holds the Groq key in a `.env` file. This is the right pattern for any production system.

**Why `.txt` only for file uploads?**  
PDF and DOCX require additional parsing libraries (PyMuPDF, python-docx) that add deployment complexity. The current version handles plain text; extracting from PDF/DOCX is a clear extension point.
