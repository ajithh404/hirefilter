import { useState } from 'react'

// Helpers
function scoreColor(n) {
  if (n >= 75) return 'var(--green)'
  if (n >= 55) return 'var(--amber-mid)'
  return 'var(--red-mid)'
}

function verdictClass(rec) {
  if (rec === 'Strong Fit')   return 'strong'
  if (rec === 'Moderate Fit') return 'moderate'
  return 'notfit'
}

function verdictIcon(rec) {
  if (rec === 'Strong Fit')   return '✦'
  if (rec === 'Moderate Fit') return '◈'
  return '○'
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Sub-score bar row (Skills / Experience / Role Fit)
function SubScoreRow({ label, value }) {
  const color = scoreColor(value)
  return (
    <div className="sub-score-row">
      <span className="sub-score-label">{label}</span>
      <div className="sub-score-track">
        <div
          className="sub-score-fill"
          style={{ width: value + '%', background: color }}
        />
      </div>
      <span className="sub-score-val" style={{ color }}>{value}</span>
    </div>
  )
}

export default function CandidateCard({ candidate, index, total, compareMode, onToggleCompare, isSelectedForCompare }) {
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const vc    = verdictClass(candidate.recommendation)
  const color = scoreColor(candidate.overall_score)
  const delay = `${index * 0.07}s`

  // Copy a plain-text summary to clipboard
  const handleCopy = () => {
    const text = [
      `${candidate.name} — Score: ${candidate.overall_score}/100`,
      `Verdict: ${candidate.recommendation}`,
      `Skills: ${candidate.skills_match} | Experience: ${candidate.experience_match} | Role Fit: ${candidate.role_fit}`,
      `\nStrengths:\n${(candidate.strengths || []).map(s => `• ${s}`).join('\n')}`,
      `\nGaps:\n${(candidate.gaps || []).map(g => `• ${g}`).join('\n')}`,
      `\nReasoning: ${candidate.reasoning}`,
    ].join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={`card${isSelectedForCompare ? ' highlighted' : ''}`}
      id={`card-${index}`}
      style={{ animationDelay: delay }}
    >
      {/* ── Header: name + big score ── */}
      <div className="card-header">
        <div className="card-header-top">
          <div>
            <div className="card-name">{candidate.name}</div>
            <div className="card-meta">
              <span>Rank {candidate.rank} of {total}</span>
              {candidate.seniority_level && <span>{candidate.seniority_level}</span>}
              {candidate.years_experience && <span>~{candidate.years_experience} yrs exp</span>}
            </div>
          </div>
          <div className="card-score-block">
            <div className="card-score-num" style={{ color }}>{candidate.overall_score}</div>
            <div className="card-score-denom">/ 100</div>
          </div>
        </div>

        {/* Sub-score bars */}
        <div className="sub-score-bars">
          <SubScoreRow label="Skills"     value={candidate.skills_match} />
          <SubScoreRow label="Experience" value={candidate.experience_match} />
          <SubScoreRow label="Role Fit"   value={candidate.role_fit} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="card-body">

        {/* Verdict — big and prominent */}
        <div className={`card-verdict-row ${vc}`}>
          <span className="verdict-icon">{verdictIcon(candidate.recommendation)}</span>
          <div className="verdict-text-block">
            <div className={`verdict-label ${vc}`}>{candidate.recommendation}</div>
            <div className="verdict-sub">Final recommendation</div>
          </div>
        </div>

        {/* Extra info chips */}
        <div className="extra-info">
          {candidate.hire_urgency && (
            <div className="info-chip">
              <span className="info-chip-icon">
                {candidate.hire_urgency === 'High' ? '🔥' : candidate.hire_urgency === 'Medium' ? '⚡' : '🌱'}
              </span>
              {candidate.hire_urgency} priority
            </div>
          )}
          {candidate.matched_keywords?.length > 0 && (
            <div className="info-chip">
              <span className="info-chip-icon">🎯</span>
              {candidate.matched_keywords.length} keywords matched
            </div>
          )}
          {candidate.years_experience && (
            <div className="info-chip">
              <span className="info-chip-icon">📅</span>
              ~{candidate.years_experience} yrs experience
            </div>
          )}
        </div>

        {/* Matched keywords */}
        {candidate.matched_keywords?.length > 0 && (
          <div className="keywords-section">
            <div className="dim-label">JD keywords found in resume</div>
            <div className="keywords-row">
              {candidate.matched_keywords.slice(0, 9).map((kw) => (
                <span key={kw} className="keyword-chip">{kw}</span>
              ))}
              {candidate.matched_keywords.length > 9 && (
                <span className="keyword-chip">+{candidate.matched_keywords.length - 9}</span>
              )}
            </div>
          </div>
        )}

        {/* Strengths + Gaps side by side */}
        <div className="points-grid">
          <div>
            <div className="points-col-label">Strengths</div>
            <ul className="points-list">
              {(candidate.strengths || []).map((s, i) => (
                <li key={i} className="point-item">
                  <span className="point-icon">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="points-col-label">Gaps</div>
            <ul className="points-list">
              {(candidate.gaps || []).map((g, i) => (
                <li key={i} className="point-item">
                  <span className="point-icon" style={{ color: 'var(--red-mid)' }}>✗</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Interview questions accordion */}
        {candidate.interview_questions?.length > 0 && (
          <div className="interview-section">
            <button
              className={`interview-toggle${interviewOpen ? ' open' : ''}`}
              onClick={() => setInterviewOpen(!interviewOpen)}
              type="button"
            >
              <span>💬 &nbsp;Suggested interview questions ({candidate.interview_questions.length})</span>
              <Chevron />
            </button>
            {interviewOpen && (
              <div className="interview-body">
                {candidate.interview_questions.map((q, i) => (
                  <div key={i} className="interview-q">
                    <span className="interview-q-num">Q{i + 1}.</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actions: copy + compare ── */}
      <div className="card-actions">
        <button
          className={`copy-btn${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? '✓ Copied' : '⎘ Copy summary'}
        </button>

        {compareMode && (
          <button
            className={`btn-ghost${isSelectedForCompare ? ' active' : ''}`}
            onClick={() => onToggleCompare(index)}
            type="button"
          >
            {isSelectedForCompare ? '✓ Selected' : 'Compare'}
          </button>
        )}
      </div>
    </div>
  )
}
