# HireFilter — Demo Video Script
Target length: 3–4 minutes. Record with screen capture + face cam or voice only.

---

## [0:00 – 0:20] Hook

> "Most resume screening is either a spreadsheet nightmare or a black-box AI tool you can't explain.
> HireFilter does something different — it shows you *why* a candidate scored what they scored,
> using a hybrid approach I built from scratch."

*[Show the live app URL loading in the browser]*

---

## [0:20 – 0:45] The problem you're solving

> "When you're hiring, you might get 20, 50, 100 resumes for one role.
> Reading each one carefully takes hours. And gut-feel ranking isn't consistent.
> HireFilter takes a JD and a batch of resumes and gives you a ranked shortlist in about 30 seconds."

---

## [0:45 – 1:15] Architecture walkthrough (talk while showing the GitHub repo)

> "Quick look at how it's built. FastAPI backend in Python — this is where all the actual
> logic lives. There are two files I want to highlight:"

*[Open parser.py]*
> "parser.py — I wrote a custom text normaliser that strips PDF artifacts, detects resume
> sections using keyword heuristics, and extracts candidate names from the first few lines.
> This runs before any AI call."

*[Open scorer.py]*
> "scorer.py — this is the scoring engine. It's two passes. First, a rule-based keyword
> overlap score — what fraction of the JD's required skills appear in the resume. Second,
> a Groq API call to Llama 3.3 70B, which scores three dimensions: skills match, experience
> match, and role fit. The final score blends both — so the LLM can't give someone a 95
> if they matched zero keywords."

---

## [1:15 – 2:15] Live demo

*[Switch to the app — already loaded]*

> "Let me show you this running. I've got a Software Engineer JD from a data platform team."

*[Paste job-description.txt into §01]*

> "And here are 5 candidates — ranging from a strong senior engineer to a final-year student
> to someone who's primarily frontend. All pasted in one block, separated by three dashes."

*[Paste resumes-all.txt into §02]*

> "Hit Screen Candidates."

*[Click the button — wait for results]*

> "Okay, results are in. We've got a ranked leaderboard at the top — Vikram scored 86,
> Rahul 79, Priya 74..."

*[Scroll through leaderboard]*

> "Let me click into Vikram's card."

*[Scroll to Vikram's card]*

> "Three sub-scores — skills 91, experience 88, role fit 82. Matched keywords right here —
> FastAPI, PostgreSQL, AWS, Docker, Kubernetes. Specific strengths pulled from his actual
> resume. And if I click 'Why this score'..."

*[Toggle the reasoning accordion]*

> "...the model explains its reasoning. That's important — you can audit it."

*[Scroll to Aisha's card]*

> "Compare that to Aisha — she's primarily frontend, scored 28. Not Fit. The gaps are clear:
> no Python backend experience, no AWS, no SQL beyond basics. Honest assessment."

---

## [2:15 – 2:40] Export

*[Click Export CSV]*

> "One click exports the full results to CSV — name, all three sub-scores, recommendation,
> strengths, gaps, matched keywords. Ready to drop into a Google Sheet or share with the team."

---

## [2:40 – 3:10] File upload

> "Quick note on input — you're not limited to pasting text. Switch to 'Upload file' here..."

*[Click Upload tab on JD panel]*

> "...and you can drop in a PDF or DOCX directly. The backend extracts text using PyMuPDF
> for PDFs and python-docx for Word files — handles multi-column layouts, table-based skill
> sections, the works."

---

## [3:10 – 3:30] Close

> "The whole thing runs on Render for the backend, Vercel for the frontend.
> The Groq API key lives server-side — it never touches the browser.
> Code is on GitHub, link in the description."

> "That's HireFilter. A screening tool that's explainable, fast, and actually reads
> between the lines."

---

## Recording tips

- Use OBS or Loom (loom.com is easiest — free, shareable link instantly)
- Record at 1920×1080, zoom browser to 110% so text is legible
- Have the sample data files open in a text editor to paste quickly
- Do a dry run first — the Render free tier may need a 30s warm-up if it's been idle
- Keep the terminal visible in one corner if showing the FastAPI logs adds credibility
