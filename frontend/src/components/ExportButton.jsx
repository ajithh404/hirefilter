// ExportButton — generates and downloads a CSV of the screening results.
// Kept as its own component so the export logic is testable independently.

const HEADERS = [
  'Rank',
  'Name',
  'Overall Score',
  'Skills Match',
  'Experience Match',
  'Role Fit',
  'Recommendation',
  'Strengths',
  'Gaps',
  'Matched Keywords',
  'Rule-based Score',
]

function toCSV(results) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`

  const rows = results.map((c) => [
    c.rank,
    c.name,
    c.overall_score,
    c.skills_match,
    c.experience_match,
    c.role_fit,
    c.recommendation,
    (c.strengths  ?? []).join(' | '),
    (c.gaps       ?? []).join(' | '),
    (c.matched_keywords ?? []).join(', '),
    c.rule_based_score,
  ])

  return [HEADERS, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')
}

export default function ExportButton({ results, disabled }) {
  const handleExport = () => {
    const csv      = toCSV(results)
    const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url      = URL.createObjectURL(blob)
    const filename = `hirefilter-${new Date().toISOString().slice(0, 10)}.csv`

    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()

    URL.revokeObjectURL(url)
  }

  return (
    <button
      className="btn-secondary"
      onClick={handleExport}
      disabled={disabled || !results.length}
      type="button"
    >
      Export CSV
    </button>
  )
}
