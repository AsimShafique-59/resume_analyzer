import { useEffect, useMemo, useState } from 'react'
import { getDashboard } from '../api'

function sortValue(row, key) {
  if (key === 'name') return (row.profile?.name || row.filename).toLowerCase()
  if (key === 'score') return row.score
  return ''
}

export default function Dashboard() {
  const [sort, setSort] = useState({ key: 'score', dir: -1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ job_description: null, results: [] })

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const results = data.results
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return 0
    })
  }, [results, sort])

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: -prev.dir } : { key, dir: -1 }))
  }

  return (
    <div className="card">
      <h2>Recruiter dashboard</h2>
      <p className="hint">
        {data.job_description
          ? `Ranked candidates for: "${data.job_description.slice(0, 90)}${data.job_description.length > 90 ? '…' : ''}"`
          : 'Run "Match & Rank" first to populate this dashboard.'}
      </p>

      {loading && <p className="status">Loading…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && !results.length && <p className="status">No candidates ranked yet.</p>}

      {!loading && !error && results.length > 0 && (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th className={sort.key === 'name' ? 'active' : ''} onClick={() => toggleSort('name')}>
                Candidate {sort.key === 'name' ? (sort.dir === 1 ? '▲' : '▼') : ''}
              </th>
              <th>Top skills</th>
              <th className={sort.key === 'score' ? 'active' : ''} onClick={() => toggleSort('score')}>
                Match score {sort.key === 'score' ? (sort.dir === 1 ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.filename}>
                <td>
                  <span className="rank-badge">{i + 1}</span>
                </td>
                <td>
                  <div className="match-name">{r.profile?.name || r.filename}</div>
                  <div className="match-file">{r.filename}</div>
                </td>
                <td>
                  <div className="chips">
                    {(r.profile?.skills || []).slice(0, 4).map((s) => (
                      <span className="chip" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="score-cell">
                    <span className="pct">{Math.round(r.score * 100)}%</span>
                    <div className="bar">
                      <span style={{ width: `${Math.round(r.score * 100)}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
