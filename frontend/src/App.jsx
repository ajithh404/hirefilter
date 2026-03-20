import { useState, useEffect } from 'react'
import InputPanel    from './components/InputPanel'
import Leaderboard   from './components/Leaderboard'
import CandidateCard from './components/CandidateCard'
import ExportButton  from './components/ExportButton'
import './index.css'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

function splitResumes(bulk) {
  return bulk.split(/^\s*-{3,}\s*$/m).map(s => s.trim()).filter(Boolean)
}
function hasFiles(files) { return files && files.length > 0 }

// ── Compare modal ──────────────────────────────────────────────────────────────
function CompareModal({ a, b, onClose }) {
  if (!a || !b) return null

  const rows = [
    { label: 'Score',      aVal: a.overall_score, bVal: b.overall_score, numeric: true },
    { label: 'Skills',     aVal: a.skills_match,  bVal: b.skills_match,  numeric: true },
    { label: 'Experience', aVal: a.experience_match, bVal: b.experience_match, numeric: true },
    { label: 'Role Fit',   aVal: a.role_fit,      bVal: b.role_fit,      numeric: true },
    { label: 'Seniority',  aVal: a.seniority_level, bVal: b.seniority_level },
    { label: 'Exp (yrs)',  aVal: a.years_experience ? `~${a.years_experience}` : '—', bVal: b.years_experience ? `~${b.years_experience}` : '—' },
    { label: 'Verdict',    aVal: a.recommendation, bVal: b.recommendation },
    { label: 'Urgency',    aVal: a.hire_urgency,   bVal: b.hire_urgency },
  ]

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Side-by-side comparison</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="compare-grid">
            {/* Column A */}
            <div>
              <div className="compare-col-name">{a.name}</div>
              {rows.map((row) => (
                <div key={row.label} className="compare-row">
                  <span className="compare-row-label">{row.label}</span>
                  <span className={`compare-row-val${row.numeric && a[row.label?.toLowerCase()] > b[row.label?.toLowerCase()] ? ' highlight' : ''}`}>
                    {row.aVal ?? '—'}
                  </span>
                </div>
              ))}
              <div className="compare-row">
                <span className="compare-row-label">Strengths</span>
                <span className="compare-row-val" style={{ fontSize: 13 }}>
                  {(a.strengths || []).map((s, i) => <div key={i}>• {s}</div>)}
                </span>
              </div>
              <div className="compare-row">
                <span className="compare-row-label">Gaps</span>
                <span className="compare-row-val" style={{ fontSize: 13 }}>
                  {(a.gaps || []).map((g, i) => <div key={i}>• {g}</div>)}
                </span>
              </div>
            </div>

            {/* Column B */}
            <div>
              <div className="compare-col-name">{b.name}</div>
              {rows.map((row) => (
                <div key={row.label} className="compare-row">
                  <span className="compare-row-label">{row.label}</span>
                  <span className={`compare-row-val${row.numeric && b[row.label?.toLowerCase()] > a[row.label?.toLowerCase()] ? ' highlight' : ''}`}>
                    {row.bVal ?? '—'}
                  </span>
                </div>
              ))}
              <div className="compare-row">
                <span className="compare-row-label">Strengths</span>
                <span className="compare-row-val" style={{ fontSize: 13 }}>
                  {(b.strengths || []).map((s, i) => <div key={i}>• {s}</div>)}
                </span>
              </div>
              <div className="compare-row">
                <span className="compare-row-label">Gaps</span>
                <span className="compare-row-val" style={{ fontSize: 13 }}>
                  {(b.gaps || []).map((g, i) => <div key={i}>• {g}</div>)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Progress ticker ────────────────────────────────────────────────────────────
function ProgressTicker({ names, doneCount, total }) {
  if (!total) return null
  const pct = Math.round((doneCount / total) * 100)
  return (
    <div className="progress-bar-wrap">
      <div className="progress-label">
        <span>Screening candidates…</span>
        <span>{doneCount} / {total} complete</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="progress-steps">
        {names.map((name, i) => (
          <span
            key={i}
            className={`progress-step${i < doneCount ? ' done' : i === doneCount ? ' active' : ''}`}
          >
            {i < doneCount ? '✓ ' : i === doneCount ? '⟳ ' : ''}{name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [jdText,      setJdText]      = useState('')
  const [resumeText,  setResumeText]  = useState('')
  const [jdFiles,     setJdFiles]     = useState([])
  const [resumeFiles, setResumeFiles] = useState([])
  const [results,     setResults]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [statusMsg,   setStatusMsg]   = useState('')
  const [error,       setError]       = useState('')
  const [darkMode,    setDarkMode]    = useState(false)

  // Progress tracking
  const [progressNames, setProgressNames] = useState([])
  const [doneCount,     setDoneCount]     = useState(0)

  // Compare mode
  const [compareMode,    setCompareMode]    = useState(false)
  const [compareSelected, setCompareSelected] = useState([]) // up to 2 indices
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Apply dark mode to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const scrollToCard = (index) => {
    document.getElementById(`card-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ── Compare mode handlers ──────────────────────────────────────────────────
  const toggleCompareSelect = (index) => {
    setCompareSelected(prev => {
      if (prev.includes(index)) return prev.filter(i => i !== index)
      if (prev.length >= 2)     return [prev[1], index]
      return [...prev, index]
    })
  }

  const openCompare = () => setShowCompareModal(true)

  // ── Run handler — decides JSON vs file flow ────────────────────────────────
  const handleRun = async () => {
    setError('')
    setResults([])
    setDoneCount(0)
    setProgressNames([])

    if (hasFiles(jdFiles) || hasFiles(resumeFiles)) {
      await runFileAnalysis()
    } else {
      await runTextAnalysis()
    }
  }

  const runTextAnalysis = async () => {
    if (!jdText.trim()) { setError('The job description is empty.'); return }
    const resumes = splitResumes(resumeText)
    if (!resumes.length) { setError('No resumes found. Paste resumes separated by --- or upload files.'); return }

    // Fake names for progress (we don't know names yet) 
    const placeholders = resumes.map((_, i) => `Candidate ${i + 1}`)
    setProgressNames(placeholders)
    setLoading(true)

    try {
      const res  = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText, resumes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Error ${res.status}`)
      setDoneCount(resumes.length)
      finalise(data.results ?? [])
    } catch (err) {
      setError(`Something went wrong: ${err.message}`)
    } finally {
      setLoading(false)
      setProgressNames([])
    }
  }

  const runFileAnalysis = async () => {
    const jdSrc  = hasFiles(jdFiles)     ? 'file' : jdText.trim()     ? 'text' : null
    const resSrc = hasFiles(resumeFiles) ? 'file' : resumeText.trim() ? 'text' : null
    if (!jdSrc)  { setError('Please provide a job description.'); return }
    if (!resSrc) { setError('Please provide at least one resume.'); return }

    const count = hasFiles(resumeFiles) ? resumeFiles.length : splitResumes(resumeText).length
    setProgressNames(Array.from({ length: count }, (_, i) => `File ${i + 1}`))
    setLoading(true)

    try {
      const form = new FormData()
      if (hasFiles(jdFiles)) {
        form.append('jd_file', jdFiles[0])
      } else {
        form.append('jd_file', new Blob([jdText], { type: 'text/plain' }), 'jd.txt')
      }
      if (hasFiles(resumeFiles)) {
        resumeFiles.forEach(f => form.append('resume_files', f))
      } else {
        splitResumes(resumeText).forEach((text, i) =>
          form.append('resume_files', new Blob([text], { type: 'text/plain' }), `resume-${i+1}.txt`)
        )
      }

      const res  = await fetch(`${API_BASE}/analyze-files`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Error ${res.status}`)
      setDoneCount(count)
      finalise(data.results ?? [])
    } catch (err) {
      setError(`Something went wrong: ${err.message}`)
    } finally {
      setLoading(false)
      setProgressNames([])
    }
  }

  const finalise = (res) => {
    setResults(res)
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  // ── Stats summary bar ──────────────────────────────────────────────────────
  const strongCount    = results.filter(r => r.recommendation === 'Strong Fit').length
  const moderateCount  = results.filter(r => r.recommendation === 'Moderate Fit').length
  const avgScore       = results.length ? Math.round(results.reduce((s,r) => s + r.overall_score, 0) / results.length) : 0

  return (
    <>
      {/* ── Masthead ──────────────────────────────────────────── */}
      <header className="masthead">
        <div className="container">
          <div className="masthead-inner">
            <div style={{ width: 40 }} />
            <div className="masthead-center">
              <p className="masthead-eyebrow">Recruitment Intelligence &nbsp;·&nbsp; Vol. I</p>
              <h1 className="masthead-wordmark">Hire<em>Filter</em></h1>
              <p className="masthead-tagline">The resume screener that reads between the lines.</p>
            </div>
            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              {darkMode ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      <main className="container">

        {/* §01 — Job Description */}
        <section className="section">
          <div className="section-header">
            <span className="section-number">§ 01</span>
            <h2 className="section-title">The Role</h2>
            <span className="section-hint">paste text or upload PDF / DOCX</span>
          </div>
          <InputPanel
            id="jd-input"
            pasteLabel="Paste text"
            uploadLabel="Upload file"
            placeholder="Paste the full job description — requirements, responsibilities, nice-to-haves."
            value={jdText}
            onChange={setJdText}
            onFilesChange={setJdFiles}
            multiple={false}
          />
        </section>

        {/* §02 — Resumes */}
        <section className="section">
          <div className="section-header">
            <span className="section-number">§ 02</span>
            <h2 className="section-title">The Candidates</h2>
            <span className="section-hint">batch-paste or upload PDF / DOCX / TXT</span>
          </div>
          <InputPanel
            id="resume-input"
            pasteLabel="Paste text"
            uploadLabel="Upload files"
            placeholder={'Paste all resumes here, separated by ---\n\nJane Doe\nSoftware Engineer...\n\n---\n\nJohn Smith\nProduct Manager...'}
            value={resumeText}
            onChange={setResumeText}
            onFilesChange={setResumeFiles}
            multiple={true}
          />
        </section>

        {/* Action bar */}
        <div className="action-bar">
          <button className="btn-primary" onClick={handleRun} disabled={loading} type="button">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 1L11 6L2 11V1Z" fill="currentColor"/>
            </svg>
            {loading ? 'Screening…' : 'Screen Candidates'}
          </button>

          <ExportButton results={results} disabled={loading} />

          {results.length > 1 && !loading && (
            <button
              className={`btn-ghost${compareMode ? ' active' : ''}`}
              onClick={() => { setCompareMode(!compareMode); setCompareSelected([]); }}
              type="button"
            >
              ⇄ Compare mode
            </button>
          )}

          {error && <div className="error-banner">{error}</div>}
        </div>

        <hr className="divider" />

        {/* §03 — Results */}
        <section id="results-section" className="section">

          {/* Progress ticker while loading */}
          {loading && progressNames.length > 0 && (
            <ProgressTicker
              names={progressNames}
              doneCount={doneCount}
              total={progressNames.length}
            />
          )}

          {!results.length && !loading ? (
            <div className="empty-state">
              <span className="empty-state-icon">🗂</span>
              <p className="empty-state-title">No candidates screened yet.</p>
              <p className="empty-state-sub">
                Fill in the role and resumes above, then hit <em>Screen Candidates</em>.
              </p>
            </div>
          ) : results.length > 0 && (
            <>
              {/* Results toolbar with summary stats */}
              <div className="results-toolbar">
                <span className="results-toolbar-title">Results</span>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span className="badge badge-strong">{strongCount} Strong Fit</span>
                  <span className="badge badge-moderate">{moderateCount} Moderate</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-faint)' }}>
                    avg score: {avgScore}
                  </span>
                  <ExportButton results={results} disabled={false} />
                </div>
              </div>

              <Leaderboard results={results} onRowClick={scrollToCard} />

              <div className="cards-label">
                Candidate Profiles
                <small>
                  {compareMode
                    ? `select 2 to compare — ${compareSelected.length}/2 selected`
                    : 'click ranking row to jump to card'}
                </small>
              </div>

              <div className="cards-grid">
                {results.map((c, i) => (
                  <CandidateCard
                    key={i}
                    candidate={c}
                    index={i}
                    total={results.length}
                    compareMode={compareMode}
                    onToggleCompare={toggleCompareSelect}
                    isSelectedForCompare={compareSelected.includes(i)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>HireFilter &mdash; built for thoughtful hiring</p>
        </div>
      </footer>

      {/* ── Compare mode floating banner ── */}
      {compareMode && !showCompareModal && (
        <div className="compare-banner">
          <span>
            {compareSelected.length === 0 && 'Select 2 candidates to compare'}
            {compareSelected.length === 1 && 'Select 1 more candidate'}
            {compareSelected.length === 2 && `Comparing ${results[compareSelected[0]]?.name} vs ${results[compareSelected[1]]?.name}`}
          </span>
          {compareSelected.length === 2 && (
            <button onClick={openCompare}>View comparison →</button>
          )}
          <button className="cancel-compare" onClick={() => { setCompareMode(false); setCompareSelected([]); }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Compare modal ── */}
      {showCompareModal && compareSelected.length === 2 && (
        <CompareModal
          a={results[compareSelected[0]]}
          b={results[compareSelected[1]]}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </>
  )
}
