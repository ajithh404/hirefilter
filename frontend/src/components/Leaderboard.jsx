import { useEffect, useRef } from 'react'

function scoreColor(n) {
  if (n >= 75) return 'var(--green)'
  if (n >= 55) return 'var(--amber-mid)'
  return 'var(--red-mid)'
}

function badgeClass(rec) {
  if (rec === 'Strong Fit')   return 'badge badge-strong'
  if (rec === 'Moderate Fit') return 'badge badge-moderate'
  return 'badge badge-notfit'
}

function useBarAnimation(results) {
  const barsRef = useRef([])
  useEffect(() => {
    if (!results.length) return
    requestAnimationFrame(() => {
      barsRef.current.forEach((el, i) => {
        if (el && results[i]) el.style.width = results[i].overall_score + '%'
      })
    })
  }, [results])
  return barsRef
}

export default function Leaderboard({ results, onRowClick }) {
  const barsRef = useBarAnimation(results)
  if (!results.length) return null

  return (
    <div className="leaderboard">
      <div className="leaderboard-head">
        <span className="leaderboard-head-title">Rankings</span>
        <span className="leaderboard-head-sub">
          {results.length} candidate{results.length !== 1 ? 's' : ''} · sorted by match score
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Candidate</th>
            <th style={{ width: 60 }}>Exp</th>
            <th style={{ width: 150 }}>Score</th>
            <th style={{ width: 140 }}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {results.map((c, i) => {
            const color = scoreColor(c.overall_score)
            return (
              <tr key={i} onClick={() => onRowClick(i)} title="Jump to profile">
                <td><span className="rank-num">{c.rank}</span></td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {c.seniority_level && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-faint)', marginTop: 2 }}>
                      {c.seniority_level}
                    </div>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-faint)' }}>
                  {c.years_experience ? `~${c.years_experience}y` : '—'}
                </td>
                <td>
                  <div className="score-bar-cell">
                    <span className="score-val" style={{ color }}>{c.overall_score}</span>
                    <div className="score-bar-track">
                      <div
                        ref={(el) => (barsRef.current[i] = el)}
                        className="score-bar-fill"
                        style={{ width: '0%', background: color }}
                      />
                    </div>
                  </div>
                </td>
                <td><span className={badgeClass(c.recommendation)}>{c.recommendation}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
